# DD04-A00-018 — PERSISTENCE / MASTER TASK LEDGER — STAGING HANDOFF
Ngày 15/11/2026. Trạng thái: code và SQL review; **CHƯA MIGRATION**, chưa cấp quyền hoạt động hoặc đăng bài.
## 1. Nguồn trạng thái xác minh
Supabase project `wbvkqfnrlasmtizjszab`, schema `dd04_stage`; 9 bảng có RLS true, chưa có pg_policies. Guards command/task/approval/event đang hiện diện. Các bảng gốc `commands`, `tasks`, `task_events`, `approvals` không bị thay đổi.
## 2. Mã nguồn
- `a00-018-existing-ledger-read-repository.mjs`: bộ đọc `dd04_stage.tasks` nối `commands` có tenant binding + owner Agent scope, transaction `BEGIN READ ONLY`; lịch sử sự kiện read-only; giới hạn trang; rollback và release connection; tuyệt đối không UPDATE/INSERT, không khẳng định đây là 18 Agent đang chạy.
- `tests/dd04-a00-018-read-ledger.test.mjs`: tenant mismatch, agent scope, injection filter, commit/rollback, giới hạn và read-only.
- `supabase/21_A00_018_PERSISTENCE_REVIEW_ONLY_DO_NOT_RUN.sql`: đề xuất các bảng workflow/task context, authority, events, policy, commitments, exception queue; RLS bật và không grant quyền công khai. **KHÔNG CHẠY**. Đây mới là schema review, chưa gồm toàn bộ authorization & atomic mutation giao dịch nên không vận hành như migration hoàn chỉnh.
- `A00_016_017_ACCEPTANCE_2026-11-15.md`: biên bản nghiệm thu code/CI và các điểm không đạt vận hành.
## 3. Chính sách API dự kiến
- Server-side xác thực JWT Supabase Auth, session còn hiệu lực, tenant membership/role trong DB, trạng thái ACTIVE; không tin `user_metadata` hoặc string `SERVER_VERIFIED_*` do client gửi.
- CEO MFA aal2 bắt buộc nếu giải quyết ngoại lệ tài chính. A00/Agent cần danh tính/capability theo bản quyền đã cấp, phân quyền theo tenant + nhiệm vụ/Agent.
- READ API worklist phục vụ CEO/A00/Agent theo nhiệm vụ; không đẩy PII/token/service_role ra client.
- WRITE API chỉ sau migration/review: server lock task `FOR UPDATE`, kiểm expected revision + evidence hash, independent reviewer, dependencies, channel profile, idempotency; một transaction ghi state+event, rollback cùng nhau.
- A11: transaction lock scope-period per tenant và aggregate amounts reserved/spent; check authority evidence và scope; ngoài hạn mức ghi finance exception, KHÔNG chi tiền. CEO chỉ nhìn hàng đợi tài chính vượt thẩm quyền.
- G1/G2 theo policy phân quyền mới được áp dụng qua transaction đã review; A07 yêu cầu current G2+unchanged final hash+platform entitlement. Giữ khóa cũ cho đến khi migration riêng được phê duyệt.
## 4. Những chỗ cố ý chưa mở
- Chưa tạo DB table mới. Chưa triển khai read endpoint HTTP vì chưa có private server auth adapter tin cậy cho quyền Agent/A00. Giao diện chưa gắn backend mới.
- `PRIVATE_SERVER_AUTH_ADAPTER` trong code là *contract* chứ chưa phải bằng chứng cryptographic; không cho client tự tạo serverContext.
- Không viết hay trả kết quả PASS cho 18 Agent thật. Không dùng RLS no-policy như cách cấp quyền đọc; muốn mở cần role + tenancy policies được review.
## 5. Các gate nghiệm thu staging thật
1. Duyệt SQL review phiên bản cuối và tenant/project staging, rollback.
2. Cấu hình dedicated least privilege role & server Auth/AAL, kiểm test cross-tenant, disabled agent, revoke session.
3. Kiểm chống forged PASS, self approval, stale revision/hash, duplicate request, concurrent reserve, overspend split campaigns/period.
4. Test worklist từ DB có nhiều actor, route theo channel, lưu event append-only và idempotency.
5. Test G1/G2 cũ vẫn khóa trong lúc chuyển đổi, A07 không thể đăng trước khi có quyền chính thức.
6. Netlify Deploy Preview + CI, CEO nghiệm thu, sau đó mới bàn giao vận hành.
## 6. Kết quả
A00-018: PASS phần thiết kế schema / code read-only khi CI xác nhận; FAIL persistence ghi và phân quyền production-like do migration chưa duyệt. Không thay production.
