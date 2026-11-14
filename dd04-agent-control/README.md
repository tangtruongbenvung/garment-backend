# DD04-A00-003 — 18 Agent Control Center (preview)
Ngày: 2026-11-14. Phạm vi: giao diện chỉ đọc dùng để CEO đánh giá trên Netlify Deploy Preview.

## Đường dẫn
`/dd04-agent-control/` trên bản deploy preview của Pull Request.

## Nguồn và bảo vệ dữ liệu
- Chỉ dùng thông tin vai trò A00–A17 theo hợp đồng V5.3 và 20 bản ghi công việc demo tổng hợp.
- Không gọi API, không ghi dữ liệu, không nhận token, không kết nối Supabase/Telegram/Meta/TikTok.
- Không có chức năng phê duyệt G1/G2 hay xuất bản. Không được coi trạng thái demo là tiến độ Agent thực tế.
- Không thay đổi index.html hoặc các module DD-03, DD-10, DD-08 hiện hữu.
- Netlify hiện publish thư mục gốc (.) từ nhánh ducduy-ai-os-development. File này nằm trong thư mục con; PR preview có thể xem tại /dd04-agent-control/.

## Checklist nghiệm thu CEO
1. PR được Netlify cấp link preview riêng và HTTP 200 cho /dd04-agent-control/.
2. Menu 5 màn hình hoạt động, 18 hồ sơ đúng mã A00–A17.
3. Xoay/phóng bản đồ, chọn Agent, lọc công việc đều hoạt động.
4. Hiển thị DEMO trên toàn bộ giao diện, không cho nhập hoặc phê duyệt.
5. Kiểm tra trên máy tính và điện thoại; chụp ảnh bằng chứng.
6. Ghi lỗi và sửa trên feature branch; CEO nghiệm thu mới được đề xuất merge.

## Sau bản preview
P0.4: runtime A00 có auth, lưu command/task/meeting, telemetry thật, API tách biệt với trang tĩnh; kiểm tra staging DB/roles trước khi xin migration staging. G1/G2 chỉ dùng xác thực CEO thật.