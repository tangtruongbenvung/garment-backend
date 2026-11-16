# DD04-A00-013 | Thiết kế giao dịch phê duyệt CEO G1/G2 — STAGING REVIEW, KHÔNG THỰC THI

Ngày: 2026-11-15. Phạm vi dự kiến: đúng Supabase `wbvkqfnrlasmtizjszab`, tenant `6bc73b49-a396-4c7d-b390-ab6339d547cd`.

## 1. Trạng thái quan sát được (đã kiểm thử)
- `ceo_enrollments`: duy nhất CEO `ACTIVE`, đúng user Auth. Đã nghiệm thu `INITIAL_OWNER_MFA`, có audit.
- 9 bảng DD04 staging đều bật RLS, 7 bảng cũ vẫn hoạt động. Trigger `dd04_approval_guard` từ chối UPDATE decision; guard command/task từ chối thay đổi status.
- Bản G1 demo `approval_id=be8c9e62-fe68-448a-8822-bffbbb96f937` hiện `PENDING`, `revision=1`, `proposal_sha256` khớp `commands.input_sha256`, nhưng **chưa có hồ sơ kế hoạch/chi phí** được server xác thực. Không đủ căn cứ để quyết định G1.
- G2 chưa có final asset package, manifest kênh/lịch, báo cáo A08/A09 theo đúng asset hash; tuyệt đối không dựng bằng chứng giả.

## 2. Yêu cầu khóa bất biến
Một lệnh duyệt đến từ Dashboard CEO phải có: JWT Auth staging còn hạn, `/auth/v1/user` xác minh cùng token, JWT issuer/sub/session_id/aal2 khớp, session thực tại `auth.sessions` có `aal2` và `factor_id` trỏ TOTP verified, CEO `ACTIVE` đúng tenant, approval đang `PENDING` và đúng revision/hash. Không tin vào `user_metadata`, role từ client, hoặc token A00.

Backend chỉ dùng kết nối DB server-side có TLS CA chuẩn. `service_role` / password / JWT không ghi logs hay file. Tất cả phép ghi cần nằm trong **một transaction** bảo đảm:
- `SELECT ... FOR UPDATE` ở command/approval/packet; transaction rollback toàn bộ nếu bất kỳ điều kiện nào sai.
- Unique key chống click lặp/idempotency theo `(tenant_id,approval_id,revision)`; cùng request phải trả về quyết định có thật, request khác không được ghi đè.
- G1 cần packet: kế hoạch có phạm vi, ngân sách, danh sách channel_ids, phiên bản profile mỗi kênh, fingerprint/sha tính phía server; xác minh G1 không chỉ duyệt bản message ban đầu.
- G2 cần G1 đã APPROVED, asset manifest version+hash của video/ảnh/caption, danh sách kênh đích, lịch công bố, A08 và A09 PASS trên **cùng hash**. Không dùng cờ boolean QC từ client.
- Sửa video/caption/kênh/lịch/phiên bản sau G2 phải tạo revision mới và khóa publish job cũ (bao gồm trường hợp lịch bị đổi).
- `APPROVED` hay `REJECTED` đều lưu actor, server time, reason/comment (nếu có), hash packet, revision, kiểm chứng session; không ghi lại token/OTP.
- Audit là append-only: không cho UPDATE/DELETE. Khi thiếu quyền đăng nền tảng, không được coi `PUBLISHED`; tạo yêu cầu bàn giao người đăng có quyền.

## 3. Migration phải trình CEO phê duyệt riêng
Bản SQL cần được review trước khi `apply_migration`:
1. Thêm bảng `approval_packets` (snapshot kế hoạch hoặc sản phẩm cuối, revision, packet_sha256, immutable fields).
2. Thêm bảng `gate_decision_events` append-only và ràng buộc có command/approval đúng tenant.
3. Giao dịch quyết định có kiểm soát dùng server-only private DB role/function; tuyệt đối **không** cấp EXECUTE cho anon/authenticated.
4. Chỉ thay `dd04_approval_guard` bằng điều kiện bắt buộc giao dịch đã xác thực, không tắt trigger hàng loạt, không mở update trực tiếp và không cho phép người dùng đổi `approved_by`.
5. Nếu cần cập nhật trạng thái command/task, thực hiện qua cùng state transition guard có kiểm chứng; không mở transition tùy ý.
6. Tách cổng G2 và publish job; database decision thành công **không** tự kích hoạt A07 khi còn thiếu đăng nhập nền tảng/quyền đăng.
7. Chỉ migrate khi SQL, rollback, kiểm thử quyền và chữ ký approval hash được CEO chốt riêng.

## 4. Phân công Agent và nghiệm thu
- A00: chuẩn bị G1/G2 approval packet và gắn đúng command/campaign/channel, revision.
- A02: strategy/channel profile và scope ngân sách; A11: kiểm soát ngân sách.
- A03: N kênh = N kịch bản khác nhau, kèm `reply_library.json` theo ngữ cảnh.
- A04/A05: file media thực, metadata/hashes; A06: preview đúng kênh đích/lịch.
- A08/A09: báo cáo PASS cùng final asset hash; không Agent nào cấp phép thay CEO.
- A07: chỉ nhận job sau G2 APPROVED cùng hash hiện hành và kiểm tra quyền API nền tảng.
- Test bắt buộc: không token, token A00, JWT giả/hết hạn, MFA aal1, session revoked, CEO không active, cross-tenant, approval đã quyết định, stale revision/hash, thiếu scope/ngân sách, G2 chưa G1, QC thiếu hoặc mismatch, thay channel/schedule, nhấn lặp.

## 5. Kết quả triển khai trên nhánh hiện tại
- `dd04-agent-control/ceo-gate-review-core.mjs`: kiểm tra điều kiện xem hồ sơ với JWT/MFA và CEO, mô tả bằng chứng còn thiếu; `decision_enabled:false`.
- `netlify/functions/dd04-ceo-gate-review.mjs`: API `POST /api/dd04-ceo-gate-review`, `BEGIN READ ONLY`, chỉ Deploy Preview.
- `dd04-agent-control/ceo-login.html/js`: mục 4 xem xét approval theo UUID; không có nút phê duyệt.
- `tests/dd04-ceo-gate-review.test.mjs`: test xác thực và fail closed.
- GitHub CI và Netlify Deploy Preview đã PASS tại commit `58a7211840362b8f93ac58ac2130ad5a56e37d4d`.

### Quyết định quản trị
**Chưa được phép gỡ khóa G1/G2 ở DB** chỉ từ yêu cầu triển khai code. Cần CEO xem, nghiệm thu và phê duyệt bản SQL giao dịch cụ thể. Số liệu chưa có không được giả định đạt QC hoặc bằng 0.

## 6. DD04-A00-014 — Hoàn thiện giao diện và luồng MFA (15/11/2026)
- Loại bỏ cảnh báo cứng sai thực tế `Chưa có quyền CEO` trên trang đăng nhập. Giao diện phân biệt bốn điều kiện **Auth / CEO ACTIVE / MFA của phiên / giao dịch G1-G2** dựa trên API server.
- Đăng nhập Auth sẽ tự kiểm tra đăng ký TOTP và đọc readiness; không mặc định yêu cầu đăng ký MFA mới. Sau khi challenge/verify TOTP trả token mới, giao diện tự gọi lại readiness để đối chiếu `aal2` trong `auth.sessions`.
- Chỉ khi Auth, CEO ACTIVE và MFA `aal2` được server xác minh, mục **Xem hồ sơ G1/G2 — chỉ đọc** mới xuất hiện.
- `POST /api/dd04-ceo-gate-list`: trả tối đa 30 yêu cầu `PENDING`, khóa MFA2/CEO, lọc đúng tenant và truy vấn `BEGIN READ ONLY`. CEO chọn trong dropdown; không phải copy UUID thủ công.
- Tất cả giao diện, API và thử nghiệm chỉ chạy ở Netlify Deploy Preview. Không migration, không sửa `approvals`, không kích hoạt A07.
- Bằng chứng CI: commit `08b6eb99aee3aed805077f11c428a047048b1fe4`, GitHub `test-a00` PASS và Netlify deploy preview SUCCESS.
- Bước tiếp theo: thiết kế và trình duyệt **SQL approval-packet + transaction** có gắn phạm vi/ngân sách G1 và bằng chứng asset/QC G2; tuyệt đối không duyệt bản demo khi chưa có bằng chứng thật.
