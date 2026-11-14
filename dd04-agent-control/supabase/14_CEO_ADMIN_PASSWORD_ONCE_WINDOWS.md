# DD04-A00-009 — Quy trình đặt mật khẩu 1 lần, KHÔNG CẦN EMAIL

**Phạm vi:** Supabase Auth staging `wbvkqfnrlasmtizjszab` **duy nhất**.  
**Tình trạng:** Script code được viết và CI kiểm thử tĩnh; **chưa chạy với secret key thật**, chưa cập nhật mật khẩu CEO.  
**Cấm:** Không đưa khóa secret/service_role lên chat, GitHub, Netlify public, browser JS hay clipboard chia sẻ; không chạy migration, không cấp quyền CEO, không mở G1/G2, không sửa project khác.

## Tại sao chọn PowerShell LOCAL thay vì Netlify Function
- Không tạo API công khai (kể cả API có token) có quyền quản trị toàn bộ Supabase Auth.
- Khóa admin và mật khẩu nhập trực tiếp qua prompt **ẩn** trên máy CEO, chỉ tồn tại trong tiến trình PowerShell. PowerShell vẫn phải tạm chuyển SecureString sang string để gửi HTTPS; không thể cam kết xóa mọi bản sao bộ nhớ tức thì.
- Không ghi dữ liệu nhạy cảm vào file, env, nhật ký hoặc lệnh command-line.
- Target `project_ref` và `auth.users.id` được cố định ngay trong code; GET trước khi PUT để xác minh email và confirmed state.
- Script kiểm tra **chỉ đọc theo mặc định**; chỉ thực thi khi có tham số `-Apply` **và** chuỗi xác nhận `SET STAGING PASSWORD`.
- Sau khi bắt đầu PUT, một local marker chứa *chỉ timestamp, project/user ID* ngăn chạy lại vô ý. Marker chỉ là cơ chế phòng lặp **trên máy đó**, không phải khóa toàn hệ thống; không chạy script ở máy khác.
- **Không** đặt mật khẩu qua PostgreSQL SQL; thao tác đúng qua Auth Admin API.

## Thao tác trên Windows
1. Mở `https://supabase.com/dashboard/project/wbvkqfnrlasmtizjszab/settings/api-keys`; vào **Secret API keys**.
2. Tìm một **Secret Key** cho **chính** staging, thường có prefix `sb_secret_`. Nếu chỉ có legacy `service_role` thì có thể dùng key đó; không dùng `anon` / `sb_publishable_`.
3. Không gửi/không chụp key. Không copy key vào ô nhắn tin. Không đưa key vào Netlify Environment Variables cho quy trình này.
4. Tải file `dd04-agent-control/scripts/dd04-set-ceo-password-once.ps1` từ GitHub **feature branch** bằng **Raw → Save As**, giữ nguyên tên file, đặt tại Downloads. Đọc/kiểm tra file bằng Notepad trước khi chạy.
5. Mở **Windows PowerShell** bình thường, không yêu cầu Run as administrator. Gõ:
   ```powershell
   cd "$env:USERPROFILE\Downloads"
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\dd04-set-ceo-password-once.ps1"
   ```
   Nhập **email Auth staging** và **secret key staging** vào lời nhắc; kết quả mong đợi `READ-ONLY PASS`.
6. Chỉ sau READ-ONLY PASS và CEO sẵn sàng thay đổi mật khẩu Auth staging, gõ:
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\dd04-set-ceo-password-once.ps1" -Apply
   ```
   - Nhập lại email và secret key staging ở màn hình prompt.
   - Xác nhận chính xác `SET STAGING PASSWORD`.
   - Nhập mật khẩu **mới** hai lần ở ô ẩn, >=12 ký tự, chữ thường/chữ hoa/số/ký tự đặc biệt.
   - Không dùng lại mật khẩu Dashboard, GitHub hoặc database.
7. Kỳ vọng `PASS - Supabase Auth xác nhận cập nhật mật khẩu...`; test đăng nhập bằng mật khẩu mới tại `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html`. Sau đó thiết lập MFA TOTP bằng Authenticator.
8. Sau khi xong, xóa file script ở Downloads; **không** lưu secret/password ở nơi khác. Có thể cân nhắc rotate secret key ngay sau thao tác (phải rà soát ứng dụng đang sử dụng khóa trước khi rotate).

## Khi gặp lỗi
- Nếu bước dry-run không PASS: **dừng**. Kiểm tra đúng project, user, email và loại khóa. Không bật `-Apply`.
- Nếu bước `-Apply` đã chạy nhưng không PASS: **dừng**; script có marker tại `%LOCALAPPDATA%\DucDuyAiOs\dd04-ceo-first-password.attempted`. Không xóa marker để chạy lại bừa bãi. Trước hết thử đăng nhập bằng mật khẩu mới, hoặc quản trị viên kiểm tra Auth logs.
- Script có thể không tương thích với chính sách PowerShell của doanh nghiệp; không thay đổi chính sách hệ thống. Khi thiếu quyền chạy, dừng và trao đổi.
- Nếu email ghi nhận khác hoặc User ID thay đổi, script **cố ý từ chối**. Không chỉnh ID để làm việc trên tài khoản khác.
- Secret key mới thay đổi theo môi trường Auth gateway; nếu `sb_secret_` bị Auth Admin endpoint từ chối trên môi trường đang dùng, dừng ở dry-run và dùng SDK chuẩn `supabase-js` trong script local được review trước khi thử thao tác. Không đưa service_role key lên trình duyệt.

## PASS/FAIL
| Công việc | Trạng thái |
|---|---|
| Script PowerShell code, target staging cố định | Code ready |
| Kiểm thử tĩnh CI | Xem GitHub Actions |
| Dry-run với secret key của CEO | CHƯA THỰC HIỆN |
| Cập nhật password Auth thật | CHƯA THỰC HIỆN |
| Đăng nhập tài khoản/MFA | CHƯA NGHIỆM THU |
| Schema migration, CEO enrollment, G1/G2 | KHÔNG THAY ĐỔI |
| Production hoặc project Supabase hiện hữu | KHÔNG THAY ĐỔI |

Nguồn: Supabase Auth Admin `updateUserById` và `getUserById`: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid .
