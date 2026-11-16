# A00-021 — Báo cáo tài khoản PostgreSQL backend và kiểm thử Agent trên staging
Ngày 15/11/2026 — Project wbvkqfnrlasmtizjszab, schema dd04_stage

## Đã thực hiện trên Supabase staging thật
- Migration **20261115030436_dd04_a00_021_staging_backend_login_vault**: success=true.
- Tài khoản **dd04_a00_backend**: LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS, NOREPLICATION, connection limit 3.
- Membership `dd04_a00_runtime` dành riêng cho backend: **SET=true, INHERIT=false, ADMIN=false**. Backend không có quyền trực tiếp USAGE trên schema DD04, không SELECT trực tiếp tasks, không SELECT Vault. Runtime role vẫn NOLOGIN/NOBYPASSRLS.
- Mật khẩu 48 byte ngẫu nhiên (hex 96 ký tự) được sinh trong DO block bởi PostgreSQL và lưu trong **Supabase Vault** tên `dd04_a00_backend_login_staging`; không xuất qua ChatGPT/CI/GitHub.
- Bản ghi Vault chỉ trả về name/id, không truy xuất plaintext.
- Phiên `dd04_a00_runtime` **không có worker credential**: đọc tasks=0, contexts=0, `a00_authorized(...,'READ')=false`. Kiểm thử bằng giao dịch tạm thời và ROLLBACK, không lưu grant SET cho postgres.
- Phiên thử nghiệm có **A00 ACTIVE chỉ trong giao dịch**: tạo commands thử, chèn task `PLANNED_WAIT_G1`, sự kiện `TASK_PLAN_SAVED` qua RLS thành công rồi ROLLBACK. Đối chiếu sau đó: 14 nhiệm vụ gốc, 14 chờ G1, 0 worker, 0 command/event thử, 0 handoff, 0 publish job.
- Thử nghiệm bổ sung với A03 ACTIVE đã bị công cụ chặn theo cơ chế an toàn; KHÔNG ghi PASS cho bước này.
- Kiểm thử trực tiếp bằng đăng nhập `dd04_a00_backend` từ Netlify **chưa thực hiện**: chưa cài đặt mật khẩu và CA vào secret manager của Netlify; không có Netlify connector trong phiên này.

## Bản sửa mã nguồn
- `a00-020-db-actor-resolver.mjs`: trước đây SELECT trực tiếp bảng `a00_worker_identities` vốn bị RLS/GRANT khóa; thay bằng các hàm SECURITY DEFINER giới hạn `a00_current_agent`, `a00_current_subject`, `a00_authorized` kiểm tra đúng tenant và quyền.
- `a00-021-backend-runtime.mjs`: connection-pool chỉ nhận URL có hostname `db.wbvkqfnrlasmtizjszab.supabase.co`, user `dd04_a00_backend`, database `postgres`, port 5432, TLS chứng chỉ được kiểm tra. Chỉ server, không có HTTP write endpoint và không bật sản xuất.
- `tests/dd04-a00-021-backend-runtime.test.mjs`: chặn URL production, user postgres/service_role, TLS disable, port/database sai.
- `tests/sql/dd04-a00-021-ephemeral-agent-write-and-handoff.sql`: kiểm tra worker A00 lưu nhiệm vụ/audit và từ chối handoff khi chưa có SUBMIT/điều kiện G1, rollback trên PostgreSQL 17 CI độc lập. Được xác minh từ kết quả GitHub Actions mới nhất, không mặc định PASS.

## Cấu hình còn thiếu — thao tác qua quản trị viên ứng dụng, không qua chat
Để backend Netlify dùng được tài khoản vừa tạo, quản trị viên phải cài **environment secrets** với phạm vi *deploy-preview/staging only*:

- `DD04_A00_BACKEND_DATABASE_URL`: `postgresql://dd04_a00_backend:<mật-khẩu-Vault>@db.wbvkqfnrlasmtizjszab.supabase.co:5432/postgres`
- `DD04_STAGING_DB_CA_PEM`: CA PEM thật của Supabase staging để TLS `rejectUnauthorized:true`.
- `DD04_STAGING_TENANT_ID`: UUID tenant staging xác thực.
- `DD04_A00_WORKER_CREDENTIAL`: token của một Agent đã được duyệt, sinh ngẫu nhiên và lưu server-side; **CHƯA CẤP**.

Không dùng prefix `PUBLIC_`, `VITE_`, `NEXT_PUBLIC_`, không cho LLM đọc bí mật. Nhân viên quản trị có quyền Netlify cần cài và xác nhận chỉ Netlify function mới thấy biến. Chưa có quyền cài Netlify secret trong phiên này, **không tự nhận kết nối deploy PASS**.

## Đánh giá vận hành
- Backend DB role + Vault + membership: **PASS trên Supabase staging**.
- A00 plan insertion + audit theo quyền runtime trong ROLLBACK: **PASS** (không COMMIT dữ liệu thử).
- Live backend LOGIN qua URL/TLS: **CHƯA TEST**.
- Live Agent SUBMIT/REVIEW/auto-handoff và COMMIT thật: **CHƯA PASS**; G1 và canonical tasks vẫn bị khóa. Không bypass cổng.
- A03/A04/A05 + A08/A09: **CHƯA KÍCH HOẠT**.
- Production và chi phí API: **không thay đổi**.

## Yêu cầu nghiệm thu tiếp
1. Bằng chứng deploy-preview Netlify có connection backend riêng, không xuất mật khẩu, role=dd04_a00_backend trước SET ROLE và role=dd04_a00_runtime sau SET.
2. Cấp worker credentials đúng 18-Agent role/capability từ quản trị viên tin cậy; tenant, expiry, revocation, rate-limit.
3. G1 ủy quyền nội bộ/A11 tài chính cần migration/quy trình phê duyệt riêng; nếu G1 PENDING thì tự bàn giao phải từ chối.
4. Gắn artifact thực, đối chiếu file bytes/hash, A08/A09 độc lập, kiểm tra stale revision/rollback/auto-handoff.
5. Khi toàn bộ PASS mới mở thử A03→A04→A05→A08/A09; không đăng khi thiếu CEO G2.
