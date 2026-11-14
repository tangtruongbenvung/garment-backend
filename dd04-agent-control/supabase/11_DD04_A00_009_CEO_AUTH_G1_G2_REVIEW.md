# DD04-A00-009 — CEO Auth + G1/G2 (BẢN THIẾT KẾ CHỜ DUYỆT)

Ngày: 14/11/2026. Phạm vi chỉ staging `wbvkqfnrlasmtizjszab`. **Không migration, không tạo tài khoản CEO hộ, không mở chốt G1/G2.**

## 1. Bằng chứng kiểm tra thực tế
- Supabase staging `auth.users`: **0 người dùng** tại thời điểm kiểm tra.
- Database V2 có 7 bảng, các trigger `dd04_approval_guard`, `dd04_approval_insert_guard`, `dd04_commands_guard`, `dd04_tasks_guard` đang chặn mọi quyết định approval hoặc task chuyển trạng thái.
- A00 hiện nhận `DD04_A00_PREVIEW_TOKEN`: **không phải xác thực người/CEO**.
- Một lệnh thử đã ghi thành công `cmd_91c7ce5ec8760df9fa0f`; không được tự duyệt lệnh này hoặc cho chạy Agent.
- Mọi quyền Auth staging riêng biệt, không đồng bộ tài khoản Auth project hiện hữu `ykhrtrvstymfjnzdgzna`.

## 2. Phần code đã chuẩn bị và chưa kết nối vào thao tác phê duyệt thật
- `dd04-agent-control/ceo-approval-contract.mjs`:
  1) Gọi Supabase Auth `GET /auth/v1/user` trên **đúng staging project** để kiểm tra access token hiện hành. Không đọc quyền CEO từ `user_metadata` hay token A00.
  2) `verifyCeoEnrollment()`: ngoài danh tính, cần bản ghi phân quyền `CEO / ACTIVE` đúng `tenant_id` do **server truy vấn database**. MFA `aal2` phải đến từ **phiên được backend xác minh**, không phải từ browser hoặc hàng phân quyền.
  3) `prepareGateDecision()`: chỉ tạo đề xuất G1/G2 có hash, phiên bản, ngân sách/kế hoạch (G1), nội dung cuối/kênh/lịch/QC/compliance (G2). Kết quả `executable:false`, chưa ghi DB, không nới chốt.
- `tests/dd04-ceo-approval-contract.test.mjs`: kiểm thử người khác tenant, giả mạo vai trò, không MFA, token từ project khác, thiếu G1/G2 evidence.
- Đây chỉ là **hợp đồng backend**; chưa có `CEO Session` route hay `Approve` route vì chưa có enrollment và transaction bảo vệ.

## 3. Hạ tầng và migration V3 cần CEO duyệt RIÊNG
Đề xuất SQL riêng, **không chạy ở V2 hiện hành**, cho staging project:
- Tạo bảng private `dd04_stage.ceo_enrollments` với `tenant_id`, `user_id` FK `auth.users(id)`, `role='CEO'`, `status`, `authorized_by`, `authorized_at`, kiểm soát duy nhất một CEO ACTIVE/tenant.
- Không public GRANT/Policy cho browser; admin bootstrap có kiểm tra danh tính và CEO chấp thuận. Không tự cấp CEO theo email, theo tên hoặc `user_metadata`.
- Bổ sung audit `dd04_stage.approval_decision_events` append-only hoặc bảng tương đương (quyết định CEO phải truy xuất độc lập với `approvals`). Giữ hashes/version, actor ID, timestamp, rejected reason.
- Xây hàm/transaction private kiểm tra CEO enrollment và MFA xác minh tại thời điểm quyết định, row lock command/approval, compare snapshot hash/revision chống TOCTOU, kiểm tra G1 trước READY và G2 trước A07. Không cho chuyển trạng thái bằng UPDATE trực tiếp, chỉ qua một entrypoint backend được kiểm toán.
- Review kỹ quyền thực thi: `SECURITY DEFINER` nguy hiểm, mặc định **không dùng**; nếu thật sự cần, private schema, explicit least-privilege role, deny PUBLIC/anon/authenticated, fixed search_path, authenticated ID check và test giả mạo. Không cấp quyền cho A00 operator token.
- G2 chỉ APPROVED khi hash của file/thành phẩm cuối khớp, kênh đích, lịch xuất bản, A08 QC PASS, A09 Compliance PASS; thay đổi bất kỳ yếu tố nào buộc duyệt lại. A07 chỉ thực hiện sau G2 còn hiệu lực.
- Làm rõ nghiệp vụ REJECT/REWORK/REVOKE, version/hashes, tenant boundaries; không quyết định chỉ dựa client claims.
- Thử nghiệm *có kiểm soát trên staging* với người dùng CEO và nhân viên thật (tài khoản demo riêng, không mượn credential production). Test G1/G2 signed + audited, replay, concurrency, wrong tenant, stale hash, no MFA, unauthorized users.

## 4. Quy trình đăng ký CEO (chưa thực hiện)
1. CEO tự tạo/đăng ký tài khoản trong Supabase **staging** qua luồng Auth được duyệt (email thực có xác minh và MFA TOTP); không gửi password/OTP cho ChatGPT.
2. Backend đọc `auth.users.id` sau login và xác minh session, không copy UUID từ database cũ.
3. CEO duyệt **riêng migration V3**, bootstrap enrollment đúng tenant staging. ID tenant `DD04_STAGING_TENANT_ID` phải được đọc từ Netlify phía server (không đưa token hoặc database URL vào báo cáo).
4. Chỉ sau khi đóng đủ bằng chứng Auth + owner, thực thi transaction phê duyệt; mở màn hình CEO. Không thêm tùy chọn tự cấp role trên giao diện nhân viên.

## 5. Bảng nghiệm thu
| Công việc | Trạng thái |
|---|---|
| Rà soát Auth & trigger staging | PASS |
| Bộ kiểm tra Auth và đề xuất G1/G2 (pure code) | CODE DONE / CI TEST |
| CEO đăng nhập thật, MFA aal2 | NOT IMPLEMENTED |
| Bảng CEO enrollment và approval event | DESIGN ONLY |
| G1 thật & task READY | BLOCKED cho đến khi CEO duyệt migration V3 + test |
| G2 thật & publish A07 | BLOCKED |
| Production changes | NONE |

## 6. Quyết định CEO cần sau bước này
- Phê duyệt **chỉ việc tạo tài khoản CEO staging và thiết lập MFA** qua UI Supabase (không tự chạy migration).
- Trình riêng bản migration V3 với SQL có thể review, rollback, quyền least privilege và kịch bản kiểm thử trước khi CEO quyết định cho phép áp dụng.
- Tiếp tục giữ Draft PR, không merge.

Tham khảo Supabase: https://supabase.com/docs/guides/auth và https://supabase.com/docs/guides/auth/auth-mfa.
