# DD04-A00-020 — Biên bản bàn giao code và nghiệm thu staging (15/11/2026)

## Phạm vi
- Repository: tangtruongbenvung/garment-backend; PR #6 (DRAFT, không merge production).
- Database staging: wbvkqfnrlasmtizjszab / dd04_stage; tuyệt đối không tác động ykhrtrvstymfjnzdgzna.
- Quyền điều hành mới: CEO xử lý ngoại lệ tài chính vượt thẩm quyền và duyệt đăng cuối. Tự duyệt nội bộ chỉ khi có phân quyền server và bằng chứng; chưa tháo khóa G1 cũ.

## Hạng mục đã lập trình
1. `a00-020-save-task-plan.mjs`: ghi toàn bộ DAG nhiệm vụ và event vào `tasks` / `task_events` có sẵn bằng một giao dịch SERIALIZABLE; chỉ ghi `PLANNED_WAIT_G1`. Có khóa idempotency trên tenant/command, kiểm DAG, chống trùng, rollback, yêu cầu A00 xác minh từ DB. Không cung cấp HTTP write endpoint.
2. `a00-020-atomic-ledger-repository.mjs`: giao dịch thay đổi trạng thái trong `a00_task_contexts` (schema review-only); kiểm expected revision, G1, tenant, Agent owner, reviewer độc lập; audit từng chuyển tiếp; tự mở task phụ thuộc khi có đủ trạng thái đã duyệt; khóa A07. `v55_agent_handoff_events` chỉ ghi PENDING, không tự ghi PASS.
3. `22_A00_020_REVIEW_ONLY_DO_NOT_RUN.sql`: các bảng workflow, task context và audit append-only; RLS mặc định từ chối; không phải migration đã duyệt.
4. `netlify/functions/dd04-a00-020-worklist.mjs`: API read-only thật truy vấn bảng DD04 hiện có, chỉ cho CEO với Auth/MFA AAL2/enrollment ACTIVE và đúng tenant.
5. `ceo-login.html` + `ceo-login.js`: hiển thị bảng Master Task Ledger từ API khi đã xác minh quyền CEO trong phiên.
6. Unit tests cho rollback, idempotency, chống giả quyền, G1 chưa duyệt, kiểm reviewer, kiểm DAG; CI thực thi bài test.

## Bằng chứng Supabase đọc trực tiếp
- 2 commands, 14 tasks, 0 v55_agent_handoff_events, 0 finance_cases, 0 publish_jobs.
- 14 task đã lưu vẫn `PLANNED_WAIT_G1`.
- `dd04_stage.guard_task_state` vẫn chặn thay đổi legacy task status.
- `dd04_stage.deny_approval_decision` vẫn chặn ghi G1/G2.
- RLS đang bật; chưa có policies cho actor runtime.

## Trạng thái nghiệm thu
- PASS: code push vào feature branch và PR; các truy vấn READ từ DD04 staging chạy.
- PASS/FAIL CI phải xác minh bằng workflow commit mới nhất, không suy diễn từ lần chạy trước.
- CHƯA PASS: xác minh endpoint Deploy Preview bằng phiên CEO MFA thật.
- CHƯA PASS: transaction ghi trên staging. SQL 22 chưa chạy, thiếu private actor resolver và phân quyền DB chuyên biệt.
- KHÓA: thanh toán tự động, G1/G2 decision, A07 publishing, kích hoạt A03/A04/A05/A08/A09 executor.
- **Không thể gọi 18 Agent hoạt động thật** chỉ dựa trên contract và test mô phỏng.

## Trước khi kích hoạt tiếp
1. Rà soát SQL 22, sửa và xác định actor resolver/capability không thể giả mạo; review riêng tenant, isolation và rollback.
2. CEO phê duyệt đúng SQL migration mới cho **chính project staging** trước khi chạy; không suy diễn từ phê duyệt V5.5.
3. Kiểm thử thật CREATE/COMMIT/ROLLBACK, idempotency cạnh tranh, failed QC, reviewer tự duyệt, tenant sai, G1 missing, A07 locked.
4. Sau nghiệm thu A00, triển khai A03 theo N kênh=N kịch bản có profile/hash; A04 ảnh nhân vật; A05 video 20–60s; A08 QC kỹ thuật; A09 compliance độc lập. Cần QC PASS, sản phẩm cuối giữ hash trước G2.
5. Khi chính sách ủy quyền G1 nội bộ được duyệt bằng thay đổi DB có audit, thay logic G1 cũ bằng cổng ủy quyền hợp lệ; CEO chỉ còn phê duyệt tài chính vượt quyền và G2 đăng bài.

## Chú ý
Mọi file trong PR #6 thuộc staging review. Cấm merge production, cấm dán khóa API, không bật provider có chi phí hoặc đăng Facebook/TikTok trước khi có quyền và nghiệm thu.
