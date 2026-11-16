# DD04-A00-021 — CẤU HÌNH NETLIFY DEPLOY PREVIEW (STAGING ONLY)

**Dự án:** Đức Duy AI OS / DD04  
**Site Netlify:** `ducduy-ai-os-test`  
**Staging Supabase:** `wbvkqfnrlasmtizjszab` — tenant `6bc73b49-a396-4c7d-b390-ab6339d547cd`  
**GitHub Draft PR:** #6 — `feature/dd04-a00-020-atomic-ledger-handoff`.

> **STATUS: SOURCE CODE PREPARED, NETLIFY ENVIRONMENT NOT YET CONFIGURED.** There is no connected Netlify administration tool in this ChatGPT session. Never describe GitHub commits as proof of Netlify secret installation.

## Phần đã xây dựng

- `dd04-agent-control/a00-021-backend-runtime.mjs`: client PostgreSQL server-only cho backend role `dd04_a00_backend`; chỉ chấp nhận project `wbvkqfnrlasmtizjszab`, TLS có CA và `rejectUnauthorized:true`. Hỗ trợ **Direct** IPv6 hoặc **Session pooler** IPv4 (port **5432**, không dùng transaction pooler 6543 cho bước kiểm thử `SET ROLE`).
- `netlify/functions/dd04-a00-021-backend-probe.mjs`: HTTP `POST /api/dd04-a00-021-backend-probe`, chỉ chạy trên Netlify Deploy Preview, phải có Supabase Auth bearer token đã kiểm chứng và MFA `aal2`. Không nhận DB credential từ request, không ghi dữ liệu, không trả chuỗi kết nối/mật khẩu; kiểm tra `current_user=dd04_a00_backend`, `SET LOCAL ROLE dd04_a00_runtime`, worker chưa được cấp quyền và rollback.
- **Chưa có endpoint thực thi tạo video / chuyển G1 / gửi bài.**

## Ba biến bắt buộc để thử kết nối

Tại Netlify → Site `ducduy-ai-os-test` → **Project configuration / Environment variables** → **Add a variable**. Chọn:
- **Scope: Functions**, không Builds/All scopes.
- **Context: Deploy Previews**. Nếu tài khoản hỗ trợ override giá trị theo Branch, giới hạn thêm đúng `feature/dd04-a00-020-atomic-ledger-handoff`; không đưa secret vào mọi nhánh không tin cậy.
- Bật **Contains secret values** cho mật khẩu/URL.
- Không đặt biến ở Production, Branch deploys, Local development, hoặc file `netlify.toml`.

| Key | Giá trị trong Netlify (không ghi giá trị bí mật trong GitHub/chat) |
|---|---|
| `DD04_A00_BACKEND_DATABASE_URL` | Connection URL đúng role `dd04_a00_backend`; lấy mật khẩu từ Supabase Vault `dd04_a00_backend_login_staging` bằng tài khoản quản trị an toàn |
| `DD04_STAGING_DB_CA_PEM` | Supabase DB TLS CA PEM đã được quản trị viên xác minh; sử dụng chứng chỉ phù hợp với endpoint/pooler thực tế, không đặt `rejectUnauthorized:false` |
| `DD04_STAGING_TENANT_ID` | `6bc73b49-a396-4c7d-b390-ab6339d547cd` |

### Chọn host và loại kết nối

**Ưu tiên cho Netlify serverless: Session Pooler (IPv4).** Vào Supabase staging → **Connect** → chọn **Session pooler**, sao chép hostname thật. URL định dạng:

`postgresql://dd04_a00_backend.wbvkqfnrlasmtizjszab:<VAULT_PASSWORD>@<COPIED_AP_NORTHEAST_1_POOLER_HOST>:5432/postgres`

Không tự đoán chỉ số `aws-0` hay `aws-1` từ vùng; lấy từ giao diện Connect của project thật. Nếu chữ cái đặc biệt có trong mật khẩu phải percent-encode; mật khẩu được sinh là hex nên không cần.

**Tùy chọn Direct** chỉ khi Netlify Function có IPv6 hoặc Supabase có IPv4 add-on đã được phê duyệt chi phí:

`postgresql://dd04_a00_backend:<VAULT_PASSWORD>@db.wbvkqfnrlasmtizjszab.supabase.co:5432/postgres`

Đừng mua IPv4 add-on hoặc nâng cấp gói chỉ để thử nghiệm này khi chưa có quyết định tài chính. **Không dùng** postgres admin, service_role, public key, transaction pooler `6543`, hay URL trỏ project production.

## Cách lấy secret an toàn

Mật khẩu backend đã tồn tại trong **Supabase Vault**, không hiện ở chat. Quản trị viên đăng nhập Supabase staging, đọc bí mật với đúng quyền và nhập trực tiếp vào Netlify Functions environment secret; không gửi mật khẩu/connection URL hoàn chỉnh vào ChatGPT, PR, ticket hoặc ảnh chụp màn hình. **MCP ChatGPT không giải mã và không xuất bí mật**.

## Triển khai Deploy Preview

1. Đối chiếu PR #6 vẫn là **Draft**, chưa merge, chưa thay đổi production.
2. Cài 3 biến trên trong scope/functions/context đúng. Tránh context value mặc định áp dụng tất cả môi trường.
3. Trigger **Redeploy Deploy Preview từ PR #6** sau khi cập nhật biến. Netlify functions chỉ nhận env values tại thời điểm deploy, nên cấu hình xong phải redeploy.
4. Truy cập URL Deploy Preview chính xác Netlify cấp cho PR #6 (dạng `https://deploy-preview-6--ducduy-ai-os-test.netlify.app` **chỉ là ví dụ**, kiểm tra URL ở Netlify UI).
5. Gọi POST `/api/dd04-a00-021-backend-probe` bằng bearer token Supabase staging với MFA `aal2`. Không gửi token qua chat. **Không có nút công khai**, ưu tiên gọi qua kiểm thử nội bộ có xác thực.
6. Kết quả thành công phải là `ok:true`, `status:STAGING_BACKEND_RLS_PROBE_PASS`, `login_role:dd04_a00_backend`, `runtime_role:dd04_a00_runtime`, `worker_active:false`, `can_publish:false`. Không xuất bản ghi Task.

## Nghiệm thu và giới hạn

- **PASS** khi connection thật Netlify Functions dùng secret scope Preview thành công, SSL verify, chuyển role và trả về body ngắn như trên; test truy cập unauthenticated trả 401; Production hostname trả 403.
- **FAIL/CẦN XỬ LÝ** nếu `STAGING_DATABASE_CONNECTION_UNAVAILABLE`: kiểm tra Session pooler vs Direct IPv6, quyền PostgreSQL, CA phù hợp, env scope hoặc redeploy; không tắt TLS.
- **Chưa PASS**: Netlify vẫn chưa được cấu hình từ công cụ này, chưa có bằng chứng request từ Deploy Preview.
- **Chưa mở**: Agent worker token `DD04_A00_WORKER_CREDENTIAL`, thực thi A03/A04/A05, nội bộ G1, A11 chi phí, A07 đăng bài. Mọi quyền đăng vẫn cần CEO G2.

## Tham khảo
- Netlify Environment Variables: https://docs.netlify.com/build/environment-variables/overview/
- Netlify Functions environment: https://docs.netlify.com/build/functions/environment-variables/
- Supabase Connection Types: https://supabase.com/docs/guides/database/connecting-to-postgres
