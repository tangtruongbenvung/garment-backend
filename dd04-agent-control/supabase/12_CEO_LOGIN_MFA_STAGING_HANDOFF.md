# DD04-A00-009 — Trang đăng nhập CEO và MFA · Staging handoff

**Ngày:** 14/11/2026  
**Đích duy nhất:** Deploy Preview #1 + Supabase `wbvkqfnrlasmtizjszab`. **Không chạy migration, không cấp quyền CEO và không mở G1/G2**.

## 1. Phần đã viết mã
- `dd04-agent-control/ceo-login.html`: đăng nhập bằng email/mật khẩu hoặc liên kết email, xem trạng thái phiên Auth và đăng ký/xác minh MFA TOTP.
- `dd04-agent-control/ceo-login.js`: Supabase Auth REST dùng **publishable key** (công khai), không dùng service key; endpoint được cố định đúng staging.
- `dd04-agent-control/ceo-login.css`: giao diện thuần tiếng Việt, responsive.
- `tests/dd04-ceo-login.test.mjs`: kiểm thử tĩnh về giới hạn hostname, callback, không lưu token trong localStorage/cookie và không chứa endpoint duyệt G1/G2.
- Không cung cấp token cho ChatGPT, không đưa mật khẩu hoặc mã TOTP vào GitHub, không nhập mã token A00 vào trang này.

## 2. Xử lý phiên và giới hạn thực tế
- Khi email trả về URL `#access_token=...`, script đọc fragment và gọi `history.replaceState` xóa fragment khỏi thanh địa chỉ trước khi gọi API.
- Truy vấn `GET /auth/v1/user` để xác minh email/identity. Các token chỉ được giữ trong bộ nhớ của tab hiện tại; refresh hoặc đóng tab cần đăng nhập lại.
- Đăng nhập email: `POST /auth/v1/otp`, `create_user:false`, redirect_to được cố định tới trang CEO Staging; không tạo tài khoản mới.
- Đăng nhập mật khẩu: `POST /auth/v1/token?grant_type=password`.
- MFA: tạo TOTP factor; hiển thị **secret** ngắn hạn chỉ để nhập ứng dụng Authenticator; challenge & verify; không lưu secret. Chưa đưa TOTP AAL2 thành quyền CEO vì chưa có enrollment DB / backend Auth verification.
- Kết nối Supabase từ browser: chỉ `https://wbvkqfnrlasmtizjszab.supabase.co`, CSP hạn chế; trang này KHÔNG gọi 7 bảng `dd04_stage`.
- Trang vẫn chỉ là thử nghiệm. Login thành công/MFA thành công **không cấp** role CEO và không thay đổi trạng thái nhiệm vụ.

## 3. Bước cần CEO thao tác trên Supabase staging (sau khi kiểm tra Deploy Preview PASS)
**Quan trọng:** Hiện Site URL và Redirect URLs của CEO đang trỏ về root của Deploy Preview. Để phiên Auth không gửi tới Dashboard không có xử lý callback, cần chỉnh về đường dẫn riêng.
1. Vào `https://supabase.com/dashboard/project/wbvkqfnrlasmtizjszab/auth/url-configuration`.
2. Đổi **Site URL** thành **chính xác** `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html`.
3. Trong **Redirect URLs**, bấm Add URL và thêm **chính xác** cùng đường dẫn trang `ceo-login.html`. Không cần wildcard, không thêm production.
4. Sau khi xác nhận đường dẫn riêng hoạt động, có thể cân nhắc xóa Redirect URL cũ chỉ tới root. Việc thay đổi này chỉ trong **Auth config của staging**.
5. Dùng liên kết trang login mới, nhập email đã xác nhận và chọn gửi email đăng nhập. **Không gửi lại invite** vì tài khoản đã tồn tại.
6. Mở email mới; kiểm tra URL không còn chuyển tới localhost/root. Nếu URL có token, không chụp/không dán lên chat.
7. Trang sẽ xóa fragment, gọi Supabase Auth, xác minh phiên. Sau đó chọn **Tạo MFA**, nhập secret vào app Authenticator, nhập mã 6 số.
8. Nếu TOTP đã đăng ký, bấm **Kiểm tra MFA đã đăng ký** và xác minh bằng mã.

## 4. Nghiệm thu
| Hạng mục | Trạng thái |
|---|---|
| Trang CEO Auth và MFA trên feature branch | Code created |
| GitHub Actions test và Netlify Preview | Verify CI |
| Auth URL config cho callback riêng | CẦN CEO thao tác |
| Gửi magic link / xác minh phiên thật | CHƯA KIỂM THỬ |
| Đăng ký và xác minh MFA aal2 thực tế | CHƯA KIỂM THỬ |
| Server verifies role CEO per tenant | CHƯA CÓ MIGRATION V3 |
| CEO G1/G2 database decision | ĐANG KHÓA |
| Supabase production/existing project changed | KHÔNG |

## 5. Bước sau
Sau khi đăng nhập và MFA đạt thử nghiệm, thiết kế V3 (enrollment CEO, audit decisions, transactional gate), trình CEO duyệt SQL **riêng**, chỉ khi được duyệt mới apply trên `wbvkqfnrlasmtizjszab`. Không thể suy quyền CEO từ email hoặc việc truy cập Supabase Dashboard.
