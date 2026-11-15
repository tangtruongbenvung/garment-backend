# DD04-A00-008 — A00 Runtime ↔ Supabase staging (server-only)

**Ngày:** 14/11/2026  
**Trạng thái:** Code + CI PASS; kết nối runtime với Postgres **chưa được kích hoạt** cho tới khi Netlify Deploy Preview được cấu hình biến môi trường chính xác và nghiệm thu API live.  
**Project đích duy nhất:** `wbvkqfnrlasmtizjszab` — `ducduy-ai-os-dd04-staging`  
**Project được bảo vệ:** `ykhrtrvstymfjnzdgzna` (không kết nối)  
**Không migration mới. Không G1/G2 tự động, không tạo nội dung, không đăng.**

## 1. Code triển khai
- `dd04-agent-control/supabase-pg-repository.mjs`: adapter server-only, SQL parameterized, transaction `BEGIN/COMMIT/ROLLBACK` cho 1 lệnh + tasks + pending G1 + audit event.
- `netlify/functions/dd04-a00.mjs`: chọn `DD04_A00_STORE=POSTGRES` **chỉ** khi bật rõ ràng. Nếu không cấu hình sẽ tiếp tục POC `DEPLOY_SCOPED_BLOBS`, không tự ghi DB.
- `dd04-agent-control/live-dashboard.js`: hỗ trợ `SUPABASE_STAGING_POSTGRES` bên cạnh `DEPLOY_SCOPED_BLOBS_API`.
- `tests/dd04-postgres-adapter.test.mjs`: unit tests với PG giả lập (giới hạn: không phải DB live).
- `package.json`: dependency server-only `pg` pinned. Phải kiểm tra bản build Netlify thực tế.

## 2. Các biến môi trường Netlify cần CEO/nhân sự có quyền Site cấu hình
**Chỉ trong Netlify Site `ducduy-ai-os-test` → Deploy Preview; tuyệt đối KHÔNG đặt ở production hoặc public `dd-config.js`.** Không gửi khóa hay URL chứa mật khẩu vào ChatGPT/GitHub/log.

| Tên biến | Giá trị | Nhạy cảm |
|---|---|---|
| `DD04_A00_STORE` | `POSTGRES` (bật mode riêng, mặc định là BLOBS) | Không |
| `DD04_STAGING_DATABASE_URL` | URI PostgreSQL **transaction pooler** lấy trực tiếp từ Supabase staging → Project Connect → Transaction pooler, có mật khẩu. Port thông thường 6543; username phải `postgres.wbvkqfnrlasmtizjszab` | **Có — SECRET** |
| `DD04_STAGING_TENANT_ID` | UUID v4 **cố định** dành cho dữ liệu thử nghiệm, tạo 1 lần bằng PowerShell `[guid]::NewGuid().ToString()`; không lấy UUID company production | Không (nhưng phải cố định) |
| `DD04_A00_PREVIEW_TOKEN` | Khóa operator thử nghiệm hiện có, dài ít nhất 32 ký tự | **Có — SECRET** |

**Quyền Netlify:** Environment variables phải áp dụng Functions runtime của Deploy Preview; tạo biến xong redeploy Deploy Preview. Không cần GitHub secrets. Không dùng pooler session port 5432 cho serverless nếu transaction pooler khả dụng.

## 3. Guard của adapter
- Parse URL và xác minh đích chỉ là `db.wbvkqfnrlasmtizjszab.supabase.co:5432` hoặc `*.pooler.supabase.com:6543` với username `postgres.wbvkqfnrlasmtizjszab`; từ chối project ref khác; từ chối `sslmode=disable`.
- PG Pool dùng TLS `rejectUnauthorized:true`, connection timeout, max 3.
- API chỉ hoạt động trên hostname Deploy Preview Đức Duy, yêu cầu Bearer token đã cấu hình, health public không trả secrets.
- Không có fallback sang Blobs nếu đã bật PG nhưng PG không kết nối được (fail closed).
- Mọi DB query có `tenant_id` và tham số SQL, không truy cập project cũ.
- `unique(tenant_id,source,external_id)` + PostgreSQL `ON CONFLICT DO NOTHING` để đảm bảo xử lý tranh chấp đồng thời; cùng input trả HTTP 200 duplicate, khác nội dung trả HTTP 409.
- Ghi command, 7 task graph, G1 PENDING và COMMAND_ACCEPTED event trong **một transaction**; DB không cho trạng thái READY/G1 APPROVED.
- GET /commands/:id và GET /commands đọc lại từ Supabase; không tự dựng dữ liệu giả. Dashboard gắn nguồn `SUPABASE_STAGING_POSTGRES`.

## 4. Điều kiện nghiệm thu trực tuyến sau khi CEO cấu hình
1. Mở `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/api/dd04-a00/health`, phải thấy `persistent_store: SUPABASE_STAGING_POSTGRES_CONFIGURED` (chỉ báo cấu hình, chưa xác nhận kết nối).
2. Mở `/dd04-agent-control/operator-test.html`, nhập staging token, gửi lệnh thử không chứa dữ liệu thật → HTTP 201; gửi trùng HTTP 200; đọc lại HTTP 200 và `WAITING_CEO_PLAN`.
3. Mở Dashboard 3D → A00 · Dữ liệu API thật → tải danh sách. Kết quả phải có `source: SUPABASE_STAGING_POSTGRES`.
4. Supabase SQL **chỉ đọc** trên project staging: kiểm tra 1 commands, 7 tasks, 1 G1/PENDING, 1 task_event (nếu chỉ 1 command test) và cross-tenant không đọc được bằng tenant khác.
5. Redeploy preview, đọc lại **cùng command_id** vẫn có record; xác minh persistence xuyên deploy.
6. Cố tình nhập cùng external_id khác message, HTTP 409; không sinh task thừa.
7. Xác nhận G1/G2 vẫn bị khóa; không chuyển trạng thái hoặc đăng.

## 5. Phạm vi chưa có
- **Chưa thể kết nối live từ công cụ GitHub/Supabase** nếu chưa có quyền đặt secret Netlify; công cụ Supabase không tự đẩy PostgreSQL connection string vào Netlify.
- Chưa có CEO Supabase Auth gateway / tenant enrollment thật. V2 database trigger khóa toàn bộ quyết định phê duyệt và trạng thái thực thi.
- Chưa có job worker, A03 viết kịch bản thật, A04/05, A08/09 QC thật.
- Backend mã đọc từ DB trong cùng request; hiện không có session-based login, chỉ token operator staging.
- Khi cần chuyển khỏi demo/POC sang hệ thống vận hành thật phải thêm IAM, quyền CEO, worker token, RLS/RPC, audit proof, backup/restore.

## 6. PASS/FAIL
| Hạng mục | Kết quả |
|---|---|
| SQL adapter transactional, source stage guard, record readback | PASS mã nguồn |
| Unit tests state/duplicate/target (mock) | PASS CI |
| Deploy Preview build | Xem kết quả Netlify theo commit |
| Netlify DB environment configured | CHƯA XÁC NHẬN |
| POST live A00 → Supabase | CHƯA NGHIỆM THU |
| GET sau redeploy | CHƯA NGHIỆM THU |
| Production thay đổi | KHÔNG |

**Hành động CEO/nhân sự Netlify:** Cấu hình env secret đúng staging, sau đó chạy nghiệm thu theo từng bước; không cần migration mới.
