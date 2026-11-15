# DD04-A00-009 — Thiết lập mật khẩu lần đầu qua Supabase Auth staging

**Phạm vi:** Chỉ `wbvkqfnrlasmtizjszab` và Deploy Preview #1. Không migration, không cấp quyền CEO, không mở G1/G2, không thay đổi project cũ.

## Quy trình
1. CEO có tài khoản Auth email đã xác minh. Chưa có mật khẩu riêng: không tạo lại hay gửi invite.
2. Truy cập `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html`.
3. Nhập email rồi bấm **Thiết lập / quên mật khẩu**. Browser gọi `POST https://wbvkqfnrlasmtizjszab.supabase.co/auth/v1/recover?redirect_to=...` bằng public publishable key.
4. Hạn mức email mặc định **2 email/giờ** trên staging Free. Khi API trả 429, không gửi lại nhiều lần; không tự điều chỉnh quota hoặc SMTP.
5. Supabase gửi email recovery. CEO mở liên kết mới trực tiếp, không dán token URL vào ChatGPT.
6. Trang xử lý `#type=recovery&access_token=...`: **xóa URL fragment ngay**, xác minh tài khoản `GET /auth/v1/user`, chỉ sau đó hiển thị form đặt mật khẩu.
7. Mật khẩu phải >=12 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt, nhập lại trùng; trình duyệt gửi `PUT /auth/v1/user` với bearer recovery token. Không ghi database DD04.
8. Sau khi cập nhật thành công trang **xóa phiên khỏi bộ nhớ**. CEO đăng nhập bằng email/mật khẩu mới và tiếp tục MFA.
9. Không dùng mật khẩu Supabase Dashboard, mật khẩu Postgres hoặc A00 Preview Token để đăng nhập Auth.

## Kiểm tra
- Trang và bộ mã CI kiểm thử các chốt `recoveryMode`, `accessToken`, xác thực người dùng trước khi cập nhật, đối chiếu mật khẩu và không lưu token.
- **Live browser sign-in / recovery chưa được xác nhận** cho đến khi CEO thao tác và báo kết quả.
- Nếu CEO không nhận được email, kiểm tra Auth logs và email rate limits trước khi gửi lại.

## Giới hạn
Trang là thử nghiệm; chưa có backend CEO enrollment, MFA assurance cấp server, và transaction G1/G2. Không được hiểu việc đặt mật khẩu là quyền CEO.

Nguồn: https://supabase.com/docs/guides/auth/passwords , https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
