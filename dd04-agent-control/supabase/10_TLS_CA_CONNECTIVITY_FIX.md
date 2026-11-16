# DD04-A00-008 — TLS CA fix / biên bản sửa lỗi kết nối

**Ngày:** 14/11/2026  
**Bằng chứng từ CEO:** Operator Test `GET /api/dd04-a00/diagnostics` trả HTTP 503, `error_code=DB_TLS_VERIFICATION_FAILED`.

## Kết quả chẩn đoán
- Lỗi thuộc bước xác minh chứng chỉ TLS PostgreSQL từ Netlify Function đến Supabase transaction pooler.
- Không phải bằng chứng mật khẩu hoặc schema DD04 bị lỗi.
- Kiểm tra SQL read-only trên staging cho thấy `commands=0`, `tasks=0`, `approvals=0`, `task_events=0`, chưa có lệnh được ghi.
- **Không được** tắt TLS hay dùng `rejectUnauthorized:false` / `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Tài liệu: https://supabase.com/docs/guides/platform/ssl-enforcement — chế độ verify-full dùng chứng chỉ CA Supabase tải từ Database Settings → SSL Configuration.

## Sửa code trên nhánh feature
1. `pg-tls.mjs` xác thực CA là chứng chỉ X509, pin đúng hostname staging, dùng `ssl:{ca,servername,rejectUnauthorized:true}`.
2. Loại bỏ tham số `sslmode` trong chuỗi kết nối được chuyển cho `node-postgres` sau khi đã kiểm tra không có `sslmode=disable`, tránh URL override cấu hình CA.
3. Netlify Function chỉ báo `SUPABASE_STAGING_POSTGRES_CONFIGURED` khi có đủ 4 biến (STORE, DB URL, TENANT ID, CA PEM); báo `SUPABASE_STAGING_TLS_CA_REQUIRED` khi thiếu chứng chỉ.
4. Unit tests `tests/dd04-pg-tls.test.mjs` dùng Node root certificate fixture để thử cấu hình TLS; không chứa khóa bí mật hoặc certificate của database thật.

## Bước thao tác Netlify của CEO — không gửi mật khẩu
1. Mở đúng `https://supabase.com/dashboard/project/wbvkqfnrlasmtizjszab` → Project Settings → Database → SSL Configuration → tải **CA certificate** của project staging.
2. Dùng trình soạn thảo văn bản mở file `.crt` hoặc `.pem`, sao chép toàn bộ từ `-----BEGIN CERTIFICATE-----` đến `-----END CERTIFICATE-----`.
3. Netlify `ducduy-ai-os-test` → Project configuration → Environment variables → Add a variable:
   - Key: `DD04_STAGING_DB_CA_PEM`;
   - Scope: Functions;
   - Deploy Previews: dán nguyên PEM, giữ cả BEGIN/END (hoặc dùng chuỗi `\n` đúng dạng nếu giao diện không hỗ trợ đa dòng);
   - Production và context khác: Empty.
4. Không chụp ảnh có `DD04_STAGING_DATABASE_URL` hay token. Không dùng CA lấy từ project cũ.
5. Sau redeploy preview, health phải báo `SUPABASE_STAGING_POSTGRES_CONFIGURED`. Tiếp tục bấm `Kiểm tra Supabase (chỉ đọc)`, kỳ vọng `HTTP 200, tables=7`; nếu lỗi thì dừng và báo `error_code`, không gửi lệnh POST.

## Giới hạn
- Chưa được kiểm thử kết nối thật vì không có quyền thay đổi env Netlify và không đọc được mật khẩu của CEO.
- Chưa có ghi command/task vào staging; G1/G2 và production không đổi.
- Không migration nào được chạy bởi bản sửa TLS.
