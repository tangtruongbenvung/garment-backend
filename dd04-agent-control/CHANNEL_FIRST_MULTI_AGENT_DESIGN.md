# DD04-A06-CHANNEL-CENTER V1 — Quản lý theo kênh / Agent theo chiến lược

**Nguồn yêu cầu:** CEO yêu cầu mỗi kênh có nhận diện và định hướng riêng xuyên suốt, nhiều Agent cùng tham gia quản lý một kênh và từng đầu việc N kênh = N kịch bản.  
**Đối chiếu Hợp đồng DD04 V5.3:** A02 xây chiến lược và đề xuất đổi định vị; A03 giao `script.md`, `caption.txt`, `reply_library.json`; A04 theo `character_id`/brand kit; A05 theo script/nhân vật; A06 tổ chức kênh; A08/A09 rà nội dung; A07 chỉ đăng sau G2. A00 điều phối và giữ khóa G1/G2.

## I. Cấu trúc màn hình quản trị
1. **Tổng quan nhiều kênh:** số kênh hợp lệ thực, nền tảng, nhóm, nhân sự/Agent; lúc chưa kết nối DB, chỉ hiển thị số liệu mô phỏng và ghi rõ DEMO.
2. **Thanh danh sách kênh:** tìm theo tên/mã, lọc nền tảng, phân trang (10/20/50). Giao diện tối đa 300 kênh mẫu để kiểm thử tải UI; 300 là công suất định hướng, không phải số lượng KPI.
3. **Chi tiết kênh → 4 tab:**
   - **Định hướng kênh:** định vị, khách xem, trụ cột nội dung, giọng điệu, character bible, visual style, quy tắc CTA, nội dung cấm, mục tiêu, phiên bản.
   - **Agent phụ trách:** danh sách Agent tham gia và trách nhiệm cụ thể trên đúng `channel_id`.
   - **Nhiệm vụ & nội dung:** A02 → A03 → A04/A05 → A08/A09 → A06/G2/A07; mỗi kênh có task riêng, ranh giới G1/G2.
   - **Phiên bản & QC:** ai đề xuất thay đổi, phiên bản hồ sơ, bằng chứng/hash, thay đổi cần CEO duyệt, nội dung trước đó dùng để tránh trùng.
4. **Thiết lập thực tế:** Khi được CEO duyệt kiến trúc DB mới mới được nhập dữ liệu thật và phân quyền nhân viên; prototype chỉ mô phỏng, không tự động lấy danh sách kênh từ nền tảng.

## II. Hợp đồng hồ sơ kênh (channel profile version)
```json
{
 "channel_id":"FB001", "platform":"FANPAGE", "name":"Tên kênh",
 "version":1, "positioning":"định vị riêng", "audience":"nhóm người xem",
 "content_pillars":"trụ cột, hướng câu chuyện", "tone":"giọng văn và nhịp hài",
 "character_bible":"nhân vật cố định, tính cách, mối quan hệ",
 "visual_style":"hình ảnh cố định", "forbidden":"những điều không được làm",
 "cta_policy":"quy tắc CTA", "target_outcome":"mục tiêu đã xác nhận",
 "assigned_agents":["A00","A02","A03","A04","A05","A06","A07","A08","A09","A10"]
}
```
`snapshotChannel(profile)` tạo `profile_sha256` theo nội dung và phiên bản. Đầu việc Agent phải gửi `channel_id`, `profile_version`, `profile_sha256`; thiếu hoặc khác phiên bản thì **FAIL CLOSED**, không được giả lập Agent đang chạy hoặc duyệt. `makeAgentHandoff` tạo brief đã khóa tới Agent trong danh sách phụ trách; `inspectDeliverable` từ chối đầu ra sai kênh/phiên bản/người thực hiện. Khớp context mới chỉ đạt kiểm tra kỹ thuật, **không phải QC PASS**.

## III. Chống lệch định hướng và tránh video trùng
- A02 là chủ sở hữu đề xuất chiến lược nhưng không tự phê duyệt thay đổi quan trọng; CEO duyệt G1 phạm vi và khi đổi định vị.
- A00 chụp `snapshot` theo phiên bản lúc giao nhiệm vụ và buộc tất cả Agent cùng dùng đúng mã kênh + hash.
- A03 tạo đúng số lượng N kịch bản cho N kênh được giao, mỗi bản khác tên/góc sáng tạo/cốt truyện; chưa xem template sáng tạo là đáp ứng chiến lược thật. Khi có `profile`, mẫu A03 sẽ gắn toàn bộ bối cảnh riêng với cờ `REQUIRES_A08_PROFILE_ALIGNMENT_REVIEW`.
- A04/A05 phải giữ nhân vật, phong cách, ngôn ngữ cùng profile. A08 so sánh với nội dung cũ trong **cùng kênh** và giữa các kênh (concept/hook/punchline/shot sequence/semantic similarity), không được đăng hai video trùng chỉ thay caption.
- A09 rà bản quyền, tác động với trẻ 0–36 tháng, ngôn từ, chính sách TikTok/Facebook.
- Khi đổi hồ sơ từ V1→V2: khóa nhiệm vụ cũ, tạo diff và đề xuất CEO duyệt; không âm thầm cập nhật profile mới vào tài sản cũ. Đổi video/caption/lịch/kênh sau G2 phải yêu cầu G2 mới.

## IV. Công việc mã nguồn đã tạo
- `channel-control.html`, `channel-control.css`, `channel-control.js`: màn hình quản lý theo kênh responsive, demo 20 hoặc 100/300 kênh, lọc và xem hồ sơ/Agent/tasks/version.
- `channel-context-core.mjs`: snapshot + SHA-256, kiểm tra hồ sơ tối thiểu, nhận bàn giao Agent đúng identity, kiểm đầu ra fail-closed, generator demo 20/300.
- `a03-channel-script-planner.mjs`: cho phép thêm `profile` từng kênh, liên kết `profile_version` + `profile_sha256` và trạng thái QC riêng; **không** đưa script template lên workflow thực.
- CI: `dd04-channel-context.test.mjs`, `dd04-channel-control-ui.test.mjs`, các kiểm thử A03 profile riêng.

## V. Giới hạn và bước phát triển kế
**Chưa có:** database channel registry & strategy version thật; lưu lịch sử dài hạn; phân quyền RLS theo kênh; Agent LLM thật; chấm chất lượng/kiểm trùng bằng semantic embeddings; xác thực CEO/MFA và G1/G2 thật.

**Đề xuất migration staging V3 — chỉ trình duyệt, KHÔNG CHẠY:** `channels` (sổ kênh và giấy phép), `channel_profile_versions` (hồ sơ bất biến), `channel_agent_assignments` (vai trò), `channel_content_history` (script/concept/asset hash), `channel_task_context` (bản snapshot và cơ sở giao việc), `channel_change_requests` (diff, G1 approval). Bảng được đề xuất bổ sung sau khi rà 7 bảng DD04 V2 hiện có; chưa quyết định tên schema/SQL vật lý. Mỗi bảng tenant-scoped, RLS/fail-closed cho nhân viên, CEO phê duyệt cuối cùng.

**Lệnh ưu tiên:** Hoàn thiện CEO Auth/MFA vào buổi tiếp theo; sau đó trình CEO duyệt kiến trúc V3 trên staging trước migration. Không migration hoặc thay production trong gói này.
