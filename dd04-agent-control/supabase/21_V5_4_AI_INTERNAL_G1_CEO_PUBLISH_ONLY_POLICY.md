# DD04 V5.4 — PHỤ LỤC THAY ĐỔI CƠ CHẾ PHÊ DUYỆT (CEO 15/11/2026)
**Trạng thái:** CEO yêu cầu điều chỉnh kiến trúc; code preflight đang triển khai trên nhánh staging; **chưa migration**, không thay production, không ghi quyết định thật.

## 1. Quyết định mới thay thế phần nào của V5.3
Hợp đồng V5.3 yêu cầu CEO duyệt cả G1 kế hoạch/ngân sách và G2 nội dung cuối. **Phê duyệt điều chỉnh V5.4 của CEO thay quy định đó như sau:** CEO **chỉ trực tiếp phê duyệt xuất bản nội dung** (G2), còn các cổng nội bộ và G1 được Agent chuyên trách tự đánh giá/phối hợp thực hiện trong **quy chế và trần chi phí được cấu hình**. Không giả mạo chữ ký hay danh tính CEO trong hồ sơ tự động.

Các quyết định đổi chính sách gốc, kết nối/chi tiêu ngoài hạn mức, thay đổi production vẫn phải chờ chỉ đạo quản trị riêng; đây **không** phải hàng đợi phê duyệt từng bài. Khi chạm hạn mức/rủi ro, Agent dừng `HOLD_POLICY`/`BUDGET_BLOCKED` để xử lý hoặc xin quyết định riêng, không tự cho phép.

| Cổng | Đơn vị xử lý | Điều kiện | Quyền cuối |
|---|---|---|---|
| G1 — nội bộ | A00 điều phối, A02 kiểm định vị kênh, A11 đối chiếu trần chi phí, A08 chất lượng, A09 tuân thủ | Tài liệu kế hoạch phiên bản hóa, kênh và mỗi kênh một kịch bản độc lập, 5 kiểm tra PASS, trong giới hạn đã cấu hình | `AUTO_AGENT_CHECKPOINT`, không yêu cầu CEO duyệt từng kế hoạch |
| Sản xuất | A03, A04, A05; A06 đóng gói | Tài sản và đầu ra thực, đủ kênh, khớp định vị | Agent vận hành |
| QC trước khi trình CEO | A08+A09, A11 nếu có phát sinh chi phí | PASS gắn đúng final package hash/version; nếu lỗi tự trả sửa | Agent tự xử lý, không được tuyên bố CEO duyệt |
| G2 — đăng bài | **CEO thật qua Auth + MFA aal2** | Xem được video/ảnh/caption, kênh, lịch, revision/hash, QC PASS, quyền đăng | CEO chọn **Duyệt / Yêu cầu sửa / Từ chối** |
| Sau G2 | A07 + nhân viên có quyền nếu API thiếu | Hash hiện tại khớp G2, đúng kênh và thời điểm, idempotency | Chỉ đăng trong phạm vi đã duyệt |

## 2. Số lượng kênh và khả năng giảm tải CEO
- Với N kênh trong campaign, A03 tạo **N kịch bản khác hướng nhau**, mỗi kịch bản gắn profile và version riêng của kênh; các Agent làm song song.
- CEO có thể xem **bảng duyệt hàng loạt** theo ngày/campaign, lọc Fanpage/TikTok, chọn tối đa một nhóm giới hạn (định hướng 50 mục/phiên).
- **Một lần nhấn “Duyệt lô” là N quyết định G2 có căn cứ riêng**, không phải cho phép đăng mọi bài sau này. Lô phải ràng buộc danh sách content_id, channel_id, asset+caption hash, revision, schedule; kiểm tra tất cả item cùng phiên MFA CEO và lưu sự kiện audit riêng từng item. Nếu một item lỗi, không được đăng item đó; thiết kế transaction sẽ phải làm rõ atomic all-or-nothing hoặc per-item với báo cáo chi tiết trước khi triển khai.
- Lịch, video, ảnh, caption, channel hoặc hash thay đổi sau duyệt => **đòi G2 mới**. Không có “CEO duyệt trước tất cả video tương lai”.

## 3. Bảo vệ bắt buộc
- Quy tắc AI PASS là internal approval, không phải `approvals.approved_by` của CEO; lưu `agent_id,source,sha256,revision,policy_version,result,checked_at` làm bằng chứng.
- Không cho Agent tự tăng trần ngân sách/chi phí, tự thay policy, mở network permission, hoặc tự kích hoạt publishing.
- Không coi bản demo là video đã QC thật. Nếu thiếu A08/A09 report hoặc chưa có quyền nền tảng, trạng thái `BLOCKED`.
- V5.4 **không được tự động chạy** trên DB V2 hiện tại: trigger G1/G2 vẫn khóa; bản `G1 PENDING` demo cũ không được tự ký bởi AI.
- Chỉ staging, không ảnh hưởng các module production khác.

## 4. Thực thi theo hai đợt
**Đợt 1 (hiện tại):** cập nhật đặc tả, pure preflight `agent-auto-approval-policy.mjs`, thử nghiệm phủ định, giao diện chỉ rõ CEO xử lý duy nhất “Duyệt đăng bài”. Không migration, không ghi phê duyệt, không đăng thật.

**Đợt 2 (phải duyệt riêng migration):** tạo bảng hồ sơ phiên bản hóa plan/agent_qc/final_publish_packet, transaction G1 AI audit và G2 CEO Auth/MFA, append-only publish authorization, liên kết A07, duyệt lô fail-closed và các test chống đăng trùng. Chỉ được bật sau khi có bằng chứng end-to-end trên staging.

## 5. Kịch bản kiểm thử bắt buộc
1. A00/A02/A08/A09/A11 PASS + kế hoạch đủ chứng cứ, trong hạn mức => G1 tự động hợp lệ **chỉ khi** migration được CEO duyệt và chạy.
2. Vượt budget, thiếu hạn mức, thiếu kênh/script, QC HOLD hoặc sai version/hash => fail closed, không trình duyệt đăng.
3. A03 kênh N sinh N kịch bản khác nhau; A06 đảm bảo channel_profile version và lịch.
4. G2 AI tự duyệt => từ chối; CEO Auth không MFA aal2 => từ chối; CEO khác tenant => từ chối.
5. G2 thiếu QC/ảnh/video/caption, thay hash/phiên bản/kênh/lịch => từ chối.
6. Lô có bản ghi trùng, phiên bản cũ, lịch sai => không tạo publish job.
7. A07 không có token đúng quyền => giao nhân viên, không báo PUBLISHED.
8. Production không đổi.

## 6. Bằng chứng nguồn
- V5.3: `DD04_HOP_DONG_GIAO_VIEC_18_AGENT_V5_3.md` (nguyên tắc G1+G2 cũ).
- V5.4: Chỉ thị mới từ CEO trong Project chat ngày 15/11/2026: “CEO phê duyệt đăng bài, các khâu phê duyệt khác được làm tự động thông qua AI Agent...”
- GitHub feature branch `feature/dd04-agent-dashboard-3d`: phần preflight và test được thêm riêng, chưa thay DB.
