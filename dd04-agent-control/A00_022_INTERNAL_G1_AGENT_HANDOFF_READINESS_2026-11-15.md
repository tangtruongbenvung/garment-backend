# DD04-A00-022 — TỔNG HỢP THỰC THI / KIỂM SOÁT G1 NỘI BỘ VÀ BÀN GIAO AGENT

**Ngày:** 15/11/2026  
**Dự án:** Supabase staging `wbvkqfnrlasmtizjszab`, `dd04_stage`  
**Trạng thái:** MÃ NGUỒN + THIẾT KẾ, CHƯA MIGRATION A00-022, CHƯA MỞ WORKER  
**Nguồn:** A00-020/021, chỉ đạo CEO ủy quyền Agent nội bộ; CEO duyệt G2 đăng bài và ngoại lệ tài chính.  
**Production:** KHÔNG thay đổi.

## 1. Chứng cứ tại thời điểm rà soát DB

- `commands`: 2, `tasks`: 14, `PLANNED_WAIT_G1`: 14.
- `approvals`: 2 bản ghi G1 `PENDING`; chưa có approval G1 có hiệu lực.
- `a00_worker_identities`: 0 ACTIVE; `a00_task_contexts`: 0; `a00_transition_events`: 0; `v55_agent_handoff_events`: 0; `v55_publish_jobs`: 0.
- `v55_finance_policies` ACTIVE: 0. Không có hạn mức tài chính CEO phê duyệt để A11 cấp quyền chi tiêu.
- Các trigger **còn hoạt động**: `dd04_tasks_guard` (cấm đổi status), `dd04_commands_guard` (cấm đổi command.status), `dd04_approval_guard` (cấm đổi decision G1/G2), `a00_context_transition_guard` (đòi legacy G1 APPROVED, status của task gốc và audit), `a00_transition_event_guard` (owner, QC, artifact), `a00_v55_handoff_insert_guard`. Không sửa/disable bất kỳ trigger nào.
- CI từ những giai đoạn trước chứng minh syntax, RLS và kết nối Netlify đọc thật; **không chứng minh giao dịch phê duyệt/bàn giao Agent thật**.

## 2. Đã triển khai trên GitHub

- `dd04-agent-control/a00-022-delegated-transaction-preflight.mjs` — kiểm tra G1 nội bộ theo snapshot được đọc trong giao dịch SERIALIZABLE; bằng chứng độc lập A00/A02/A09/A11 gắn packet SHA256/tenant/command; bắt buộc A11 có policy ACTIVE, sổ dự phòng ngân sách đã khóa và đủ hạn mức.
- Không có policy A11 ACTIVE ⇒ fail closed, **không ngầm định ngân sách bằng 0 là đã được duyệt**.
- Tổng mức cam kết chiến dịch và từng lần chi được so với hạn mức, vượt hạn mức ⇒ `CEO_FINANCE_EXCEPTION_REQUIRED`, không cấp quyền giải ngân.
- `evaluateA0022Handoff`: kiểm tenant, command, dependency, thứ tự A00→A03→A04→A05→A08→A09, revision, hash nội dung và kiểm tra byte/hash lưu trữ thực. A03/A04 phải có A00 kiểm tra nội bộ; A05 chuyển sản phẩm sang A08 để QC, sau đó A08→A09. Không yêu cầu QC từ A08/A09 **trước khi** chính hai Agent đó được nhận nhiệm vụ.
- `evaluateA0022FinalQC`: cùng hash tài sản được A08/A09 kiểm độc lập, chỉ đánh dấu *đủ điều kiện trình CEO duyệt G2*, không cấp quyền tự đăng.
- Tất cả quyết định preflight đều `executable:false`, `spend_allowed:false`, `publish_allowed:false`; tên `DB_SERIALIZABLE_READ` trong dữ liệu chỉ là contract, không có quyền nếu được caller tự dựng.
- Tests `dd04-a00-022-delegation.test.mjs` và `dd04-a00-022-sql-contract.test.mjs` kiểm tình huống tự duyệt, giả nguồn, sai tenant, stale revision, quá hạn mức, tự tạo QC và thứ tự Agent.

## 3. SQL đề xuất — CHƯA ĐƯỢC PHÉP CHẠY TRÊN STAGING

`dd04-agent-control/supabase/26_A00_022_DELEGATED_G1_FINANCE_REVIEW_ONLY_DO_NOT_RUN.sql`

Tệp này là **thiết kế ứng viên**, gồm năm bảng: chính sách ủy quyền, bản ghi kiểm tra độc lập, ngân sách dự phòng, quyết định G1 nội bộ và hàng đợi ngoại lệ tài chính CEO. SQL bật RLS, từ chối công khai và khóa việc đổi `ACTIVE` / `APPROVED_INTERNAL`. **Chưa có giao dịch đặc quyền chuyển trạng thái, chưa có hàm tổng hợp ngân sách chống đồng thời, và KHÔNG thể sử dụng để mở Agent.**

Không chạy SQL 26 trực tiếp lên staging: chỉ sau khi có SQL tích hợp cuối cùng đã rà soát, hash SHA-256 rõ ràng và phê duyệt migration **riêng biệt của CEO**.

## 4. Vấn đề thiết kế bắt buộc xử lý trước migration cuối

1. **Canonical G1**: 14 task gốc luôn `PLANNED_WAIT_G1`. Trigger `dd04_tasks_guard` cấm đổi state; G1 hiện PENDING và `dd04_approval_guard` cấm tự đổi. Thiết kế migration phải định nghĩa một đường chuyển được ủy quyền/chứng thực **không làm giả G1 CEO và không tắt trigger**, đối chiếu với Master Task Ledger, lưu immutable event ở mọi bước.
2. **Finance A11**: tạo/kích hoạt chính sách giới hạn tài chính CEO phê duyệt, đồng bộ sổ dự phòng `SERIALIZABLE` theo tenant + campaign + kỳ; chống chia nhỏ lệnh/chi vượt hạn mức và concurrent overspend. Không có policy ACTIVE ⇒ HOLD. Những gì vượt hạn mức chỉ thêm vào hàng đợi CEO, không chi tiền.
3. **Worker identity**: quản trị viên tin cậy cấp worker tokens ngẫu nhiên, hash trong DB, secret tại backend; quyền riêng từng Agent, thu hồi/hết hạn, cross-tenant; không đưa token vào browser/LLM.
4. **Tạo artifact**: A03/A04/A05 chỉ lưu đầu ra nếu đã đối chiếu SHA256 của **bytes thực** trong storage, không tin tên file/metadata JSON tự khai. `reply_library.json` và QC tiếng Việt bắt buộc; không mạo danh người xem.
5. **Handoff thực**: giao dịch duy nhất insert audit, CAS revision, chuyển quyền quản lý task, kiểm phụ thuộc, các artifact và bảo toàn Master Task Ledger; rollback cùng lúc khi lỗi. A08 và A09 kiểm duyệt độc lập sau A05; **G2 cuối vẫn do CEO phê duyệt chính xác file/caption/kênh/lịch**.
6. **Ngân sách AI**: chưa cấp quyền chi tiêu ⇒ chỉ được dry-run offline không dùng API trả phí, không được tạo video trả phí hoặc publish.

## 5. Thứ tự nghiệm thu staging khi đã có SQL cuối cùng được CEO duyệt

G1 riêng có chính sách CEO → worker A00 có quyền đã cấp → kiểm A11 policy và giữ ngân sách → A00 bàn giao A03 → A03 kịch bản & reply_library → A04 ảnh/character → A05 video 20–60s → A08 QC → A09 compliance → CEO G2 cuối (kênh/lịch/caption/asset hash) → A07 chỉ khi có quyền nền tảng hợp lệ.

- Positive: 1 command thử nghiệm, đúng tenant, chi phí 0 có policy cho phép, 1 artifact hash đúng, handoff các Agent với auth thực, audit immutable, CAS và rollback.
- Negative: unapproved G1, stale revision, idempotency collision, thiếu A11 policy, budget split, actor giả, tự review, QC sai hash, revoked worker, G2 thiếu, không có quyền đăng.
- Bằng chứng: SQL migration version, approved filename/hash, authenticated session, timestamp, event IDs, test logs, trạng thái cuối; không bao gồm mật khẩu/token.

## 6. Quyết định nghiệm thu

- **A00-022 preflight và SQL thiết kế:** PASS kiểm thử nguồn + SQL trên PostgreSQL 17 tạm thời (GitHub Actions run 578 / 43680538752, cả 3 nhóm PASS).
- **A00-022 migration staging:** NOT APPLIED.
- **A00-022 giao dịch phê duyệt nội bộ + bàn giao Agent thật:** NOT TESTED / NOT PASSED.
- **A03/A04/A05 live providers:** NOT AUTHORIZED; **A07 publish:** LOCKED; production unchanged.

### Quyết định cần CEO duyệt tiếp

Không phê duyệt bằng câu chung "tiếp tục". Khi hoàn tất bản migration tích hợp, trình đúng SQL byte SHA-256, target staging, kiểm thử PostgreSQL riêng và phạm vi thay đổi trigger/policy để CEO duyệt. Chỉ sau phê duyệt mới apply và chạy giao dịch thực.

## 7. Chứng cứ CI cập nhật
- GitHub Actions run **578**, URL https://github.com/tangtruongbenvung/garment-backend/actions/runs/43680538752 — `test-a00`, `validate-windows-powershell`, `validate-sql-ephemeral` đều thành công.
- CI đã **thực thi SQL 26 trên PostgreSQL 17 disposable duy nhất**, sau fixture và SQL 24, sau đó xác nhận 5 bảng có RLS bật, không có policy/runtime grant và G1 thử nghiệm vẫn PENDING.
- Trong CI, fixture không có toàn bộ trigger legacy, nên kiểm tra trigger legacy trên **Supabase staging thật đã dùng SELECT read-only** và xác nhận `dd04_tasks_guard`, `dd04_approval_guard`, `a00_context_transition_guard` còn được bật.
- Staging `a00_022_%` tables = **0**; `v55_finance_policies` ACTIVE = **0**; worker ACTIVE = **0**. **Chưa có migration A00-022, không có bàn giao Agent thực trên staging.**
