# DD04-A00-010 — CEO Auth + MFA readiness + G1/G2 preflight | staging handoff

Ngày 14/11/2026. Triển khai trên Draft PR #1, nhánh feature/dd04-agent-dashboard-3d. **Không mở duyệt G1/G2 khi chưa có CEO đã xác minh, MFA aal2 và bảng enrollment. Không migration hay thay đổi production.**

## Bằng chứng đọc đúng project Supabase staging (wbvkqfnrlasmtizjszab)
- User Auth ID `b11f7154-5f5d-4b55-a497-90e8adf2525e`, email xác minh, encrypted_password có giá trị (không chứng minh người dùng có/biết mật khẩu).
- Có 0 factor MFA đã `verified`. CEO chưa đạt MFA AAL2.
- `dd04_stage.ceo_enrollments` không tồn tại; 7 bảng DD04 đang có đều bật RLS.
- G1 và G2 chưa có chức năng duyệt thực tế: DB triggers giữ nguyên.

## Code đã hoàn thiện
1. `dd04-agent-control/ceo-readiness-core.mjs`: Gọi Auth `/auth/v1/user`, chỉ sau khi xác minh đúng access token mới phân tích claims JWT issuer/sub/session_id/AAL, phải kiểm tra phiên đang tồn tại trong DB Auth. Không nhận role từ `user_metadata` hoặc UI.
2. `netlify/functions/dd04-ceo-readiness.mjs`: POST `/api/dd04-ceo-readiness` trên host Deploy Preview; truy vấn **BEGIN READ ONLY** các bảng `auth.sessions`, `auth.mfa_factors`, `dd04_stage.ceo_enrollments` (nếu có). Không tạo/đổi dữ liệu, không ghi logs token, không cấp quyền CEO, không duyệt G1/G2. Status luôn ghi `G1_enabled:false,G2_enabled:false`.
3. `dd04-agent-control/ceo-login.html/js`: Sau đăng nhập có nút **Kiểm tra quyền CEO · MFA · G1/G2**; token chỉ nằm trong bộ nhớ tab. Sửa phát hiện các factor đã đăng ký từ `/auth/v1/user` thay vì gọi `GET /auth/v1/factors` không được hỗ trợ.
4. `dd04-agent-control/ceo-gates-preflight.mjs`: kiểm thử chuẩn bị quyết định G1/G2 trên dữ liệu snapshot do backend cung cấp: CEO + đúng tenant, approval PENDING, hash/revision không đổi, G2 phải có G1 đã phê duyệt, final asset hash/kênh/lịch trùng, QC A08 & compliance A09 đều PASS có bằng chứng phía server. Kết quả `executable:false` và **không ghi SQL**.
5. `supabase/16_CEO_ENROLLMENT_REVIEW_ONLY.sql`: đề xuất 2 bảng **ceo_enrollments** và **ceo_enrollment_events** trong `dd04_stage`. RLS bật, deny grants, một CEO ACTIVE mỗi tenant; chưa chạy, không seed user.
6. CI: `tests/dd04-ceo-readiness.test.mjs`, `tests/dd04-ceo-gates-preflight.test.mjs`, mở rộng `tests/dd04-ceo-login.test.mjs`.

## Thứ tự thao tác CEO tại Windows (các bước có thể làm ngay)
1. Truy cập trang riêng `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html`. **Không** dùng token A00 làm CEO.
2. Nhập email Auth staging, thử đăng nhập bằng mật khẩu người dùng đã tự thiết lập. **Không gửi mật khẩu hoặc ảnh URL có token cho ChatGPT.** Nếu chưa biết mật khẩu thì phải hoàn tất luồng recovery hoặc quy trình đặt mật khẩu admin một lần riêng trong staging, không chạy script nếu không xác minh được đúng project/user.
3. Khi đăng nhập thành công, bấm **Tạo MFA bằng ứng dụng Authenticator**. Nhập secret chỉ vào ứng dụng trên điện thoại (Google/Microsoft Authenticator), sau đó nhập mã sáu chữ số để challenge + verify. Không gửi mã / secret cho ChatGPT. Nếu đã có factor, dùng **Kiểm tra MFA đã đăng ký** → **Xác minh MFA**.
4. Nhấn **Kiểm tra quyền CEO · MFA · G1/G2**. Kết quả đúng phải xác minh Auth, MFA AAL2; enrollment và G1/G2 vẫn khóa cho đến khi được cấp quyền qua quyết định và migration riêng.
5. CEO rà soát `16_CEO_ENROLLMENT_REVIEW_ONLY.sql` và **phê duyệt riêng** chỉ khi chấp nhận áp dụng đúng staging project. Sau đó một người có quyền quản trị bootstrap sẽ phải đối chiếu đúng tenant/Auth user, xác minh bằng chứng 2 bên; hiện chưa triển khai.
6. Một migration tiếp theo **riêng** sẽ thay thế block trigger G1/G2 bằng transaction bảo đảm danh tính CEO + MFA + current snapshot + audit, rồi chạy các test phân quyền, phản hồi thực tế. Việc cấp enrollment không tự mở quyền duyệt.

## PASS/FAIL hiện thời
| Việc | Trạng thái |
|---|---|
| Có user Auth staging đã xác minh email | PASS |
| Khả năng kiểm tra Auth/MFA read-only và fail-closed | CODE + CI |
| AAL2 MFA thật | FAIL/CHƯA CÓ |
| CEO enrollment ACTIVE trên staging | FAIL/CHƯA CÓ BẢNG |
| G1/G2 phát sinh DB decision | BLOCKED |
| A07 xuất bản | BLOCKED |
| Bảy bảng cũ và production | KHÔNG THAY ĐỔI |

**Cấm:** không làm `INSERT` / `UPDATE` approvals trực tiếp từ Admin token; không đặt quyền dựa vào email/claim user_metadata; không dùng A00 token cấp CEO; không chuyển trực tiếp task sang READY; không tự đăng video.
