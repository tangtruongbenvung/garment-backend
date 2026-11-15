# DD04-A00-017 — PHỤ LỤC QUẢN TRỊ V5.5 — CEO CHỈ ĐIỀU HÀNH & NGOẠI LỆ TÀI CHÍNH
**Ngày:** 2026-11-15 (Asia/Bangkok)  
**Nguồn quyết định:** CEO trong Project “18 AI Agent”: “CEO chỉ gửi lệnh và tài liệu hình ảnh cần thiết để ra lệnh và liên quan tới tài chính. Còn các việc còn lại theo chức năng nhiệm vụ vai trò AI Agent tự động duyệt đồng thời lập danh sách theo dõi”.  
**Trạng thái:** Chính sách và mã kiểm tra ở nhánh staging. **Chưa có migration/cấp quyền xuất bản tự động**. Quy tắc này **thay thế V5.3 (CEO G1/G2) và V5.4 (CEO G2)** trong phạm vi nội dung DD-04, nhưng không hủy quyền hạn CEO trong quản trị tài chính, ngân sách và các quyết định ngoài phạm vi ủy quyền.

## I. Điều CEO thực hiện
1. **Ra lệnh** qua Gateway Telegram/Zalo/Dashboard xác thực; đính kèm ảnh, video, file tài liệu/mô tả làm brief. A00 xác nhận người gửi, tạo `command_id`, ghi nguồn, hash, timestamp và phân công.
2. **Quyết định tài chính** nếu vượt trần ngân sách đã cấu hình, hợp đồng/nghĩa vụ chi tiêu, mua dịch vụ mới, tăng hạn mức, thanh toán, rủi ro tài chính. CEO có thể thay chính sách hoặc dừng toàn hệ thống bằng kênh được xác thực.
3. **Theo dõi** kết quả và các ngoại lệ qua bảng công việc A00–A17; CEO không cần vào hàng chờ duyệt video từng ngày.
4. **Không bị yêu cầu duyệt** kế hoạch G1 thường lệ, kịch bản A03, media A04/A05, QC A08/A09, bản đăng cuối G2 thường lệ nếu đều thuộc chính sách có thẩm quyền.

## II. Quyền kiểm soát tự động từng Agent
| Agent | Quyền chủ động | Bằng chứng khi bàn giao |
|---|---|---|
| A00 | Xác thực lệnh, phân rã và định tuyến; quyết định handoff đúng agent | `command_id`, `task_id`, version, routing, audit |
| A01/A12/A13 | Nghiên cứu xu hướng, đối thủ, viral từ nguồn hợp lệ | URL/source/observed_at/confidence |
| A02 | Duyệt chiến lược kênh trong profile và hạn mức đã cấp | `channel_id`, profile version/hash |
| A03 | N kênh = N kịch bản khác nhau, reply library | Script/caption hash, chính sách giọng điệu |
| A04/A05 | Tạo ảnh/nhân vật/video, tự sửa lỗi kỹ thuật | Tài sản thực, media hash, duration, cost |
| A06 | Đóng gói đúng kênh & lịch, đối chiếu phiên bản | publish packet hash, channel/schedule |
| A08 | QC ngôn ngữ/hình/media độc lập; trả REWORK/HOLD | `qc_report` PASS, report hash |
| A09 | Kiểm soát bản quyền, an toàn trẻ em, chính sách, chống spam | Compliance PASS/HOLD và bằng chứng |
| A11 | Kiểm chi phí; nằm trong hạn mức thì thông qua, vượt trần → CEO | cost ledger và limit policy hash |
| A07 | Tiền kiểm xuất bản, chỉ chuyển thành job nếu được backend cho phép và đủ quyền API | channel auth, policy hash, job-id và kết quả thật |
| A10/A14/A15/A16/A17 | Đo dữ liệu thật, bán hàng/CSKH, lắng nghe và tương tác đúng quyền | nguồn thật, consent, audit, giới hạn anti-spam |

Agent **không được dùng tên CEO** để tự ký kết quả; mỗi sự kiện ghi `actor_kind='AGENT'`, agent ID, `policy_version`, hash trước/sau, thời điểm, lý do. Mỗi vai trò chỉ được duyệt **đầu ra đúng phạm vi**, không tự sửa chính sách cấp phép cho chính mình.

## III. Phê duyệt nội bộ tự động
- Kiểm tra điều kiện/đầu ra bằng Agent nhận việc hoặc Agent QC **độc lập**; ràng buộc `task_id`, `channel_id`, `revision`, `sha256`. Nếu không đủ bằng chứng thì `HOLD`, không giả lập PASS.
- Chi phí chỉ thông qua khi đã có **quy chế tài chính do CEO cấu hình** và ledger đúng nguồn, nằm trong hạn mức. Chưa có trần thì `CEO_FINANCE_POLICY_REQUIRED`, không được tự gán giá trị mặc định.
- Sau sản xuất, A08 + A09 PASS cùng packet hash; A06 đối chiếu kênh, hồ sơ, lịch; A07 kiểm quyền platform riêng và idempotency. Khi bất kỳ điều kiện thay đổi phải quay vòng QC mới.
- Trên staging hiện tại, đây mới là **preflight trong code**, không phải tự tạo APPROVED trên DB.
- Tự động xuất bản lên Fanpage/TikTok thật chỉ khi CEO đã cho phép riêng việc kết nối tài khoản, công cụ hợp lệ có quyền đăng, giới hạn tần suất và circuit breaker, migration giao dịch được nghiệm thu. Hiện `publishing_enabled=false`.

## IV. Danh sách theo dõi bắt buộc
Mỗi record cần: mã lệnh, nhiệm vụ, kênh, agent phụ trách, agent duyệt, phiên bản/hash, trạng thái `QUEUED / IN_PROGRESS / QC_PASS / REWORK / HOLD / WAITING_CEO_FINANCE / AUTO_APPROVED / READY_TO_PUBLISH / PUBLISHED / FAILED`, thời gian, nguồn bằng chứng, chi phí dự kiến/thực tế nếu có, job ID, URL bài đăng/đơn chứng thực nếu thực sự đăng, cảnh báo và bước tiếp theo. Không suy luận `AUTO_APPROVED` từ trạng thái `DONE` hay demo.

Danh sách hiển thị: lọc theo Agent, kênh, ngày, trạng thái, campaign; tách khối “Đang làm / Đang chờ QC / Bị chặn / Tài chính cần CEO / Đã đăng / Lỗi”; báo cáo hằng ngày bằng dữ liệu thật. Không tính bản ghi chưa có nguồn là số 0.

## V. Cơ chế bảo mật và giới hạn
- Sửa nội dung, file, caption, kênh, lịch => hash mới và đánh giá A08/A09/authorization lại.
- A07 không đăng trong trường hợp thiếu token nền tảng hợp lệ, rate limit, nội dung vi phạm, kênh không hợp lệ, vượt hạn mức. Không tạo fake post URL.
- Cấm Agent tự khởi tạo/điều chỉnh budget limit, hợp đồng chi tiêu, production migration, giả danh người dùng, tự comment chéo, tạo review giả.
- Phân quyền nhận lệnh Gateway vẫn phải xác minh CEO trước; ảnh/file CEO cung cấp là **dữ liệu đầu vào**, không tự được chạy như hướng dẫn hệ thống.
- **V5.3/v5.4 trên database hiện có vẫn là legacy, trigger G1/G2 chưa mở.** Không tự ký duyệt G1 demo PENDING, không migration production.
- CEO vẫn là người có quyền đình chỉ, thay quy chế, chi tiêu ngoài hạn mức; chỉ không phải duyệt từng nội dung/kịch bản thông thường.

## VI. Bằng chứng & kế hoạch phát hành
1. `v55-automatic-delegation.mjs`: finance escalation, role-based handoff, final publication *candidate* fail-closed, worklist normalization.
2. `netlify/functions/dd04-ceo-agent-worklist.mjs`: API **chỉ đọc**, chỉ preview, yêu cầu Auth session & CEO ACTIVE, đọc các task thực từ `dd04_stage.tasks`; không ghi quyết định.
3. `ceo-login.html/js/css`: màn hình CEO hiển thị danh sách công việc theo agent, bộ lọc và tình trạng bản ghi thực, không tự nhận AI đang chạy.
4. Kiểm thử định kỳ: vượt trần, thiếu policy, sai hash, không đủ QC, sai platform, nội dung đổi, trạng thái legacy, cross-tenant, Auth hết hạn. Tất cả phải fail closed.
5. **Bước tới cần migration được duyệt riêng:** bảng chính sách tài chính có CEO signature, Agent handoff events, versioned publish packet, QC evidence, publish jobs idempotent và audit immutable. Bất kỳ thao tác đăng thật cần phê duyệt kết nối nền tảng riêng, không tự thực thi khi mới có lệnh “triển khai staging”.
