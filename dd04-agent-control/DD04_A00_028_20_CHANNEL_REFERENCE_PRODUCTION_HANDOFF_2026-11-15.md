# DD04 A00-028 — 20 KÊNH: TRIỂN KHAI HÀNG ĐỢI ẢNH THAM CHIẾU VÀ CHUẨN BỊ VIDEO

Ngày 15/11/2026. Phạm vi **GitHub PR #7 (Draft), staging only**. Quyết định CEO: đã chốt bộ thiết kế 20 kênh độc lập, chuyển sang công việc chuẩn bị ảnh tham chiếu và dây chuyền video.

## Tài liệu nguồn đã được đọc

- `DD04_20_KENH_BO_NHAN_DIEN_V1_2026-11-15/` trong bộ tài liệu người dùng đã chốt:
  `MASTER_CHANNEL_LEDGER.json` và từng kênh có `character_bible.json`, `a04_reference_prompts.json`, `reference_manifest.json`, `phase_content_plan.json`, `agent_handoff.json`, `reply_library.json`.
- Các bộ hồ sơ mô tả **20 cặp mẹ–bé riêng biệt, 10 Fanpage + 10 TikTok**, mỗi kênh 7 góc/biểu cảm tham chiếu, cùng bản sắc qua MOI → CHUYEN_TIEP → BAN_HANG.
- Poster ảnh tham chiếu 20 kênh gần nhất được chốt dùng làm **bảng cảm hứng và phân biệt phong cách**, không tự động dùng từng mặt từ ảnh ghép làm ảnh nhận diện gốc có độ phân giải và hash lưu trữ. Có một số nhãn trong poster không khớp tên kênh ở registry; **không tự đồng nhất hoặc đổi tên kênh**. Hồ sơ theo channel_id được ưu tiên cho việc đặt job.

## Đã triển khai trên GitHub

- `dd04-agent-control/a00-028-reference-production-queue.mjs` tạo danh sách có kiểm tra scope:
  đúng 20 kênh, 10/10, 20 cặp tên mẹ–bé riêng, **140 nhiệm vụ A04**, mỗi kênh 7 khung:
  mother_front, mother_three_quarter, mother_expressions, baby_front, baby_three_quarter, baby_expressions, family_joint.
- Mỗi job mang mã nhiệm vụ, channel_id, phiên bản 1, hash gói nhận diện, vị trí ảnh, QC A08/A09 PENDING; không có provider call/chi phí.
- Cổng `checkA0028ReferenceGate()` khóa A05 khi thiếu 7 ảnh thật có hash, không đúng kênh, thiếu QC; ngay cả nếu cấu trúc kiểm tra PASS, **không tự cho render/đăng bài** vì cần chứng thực sự kiện QC từ DB và quyền công cụ riêng.
- Test `tests/dd04-a00-028-reference-queue.test.mjs` chứng minh 140 job không trùng, trạng thái chưa render, không trộn kênh, từ chối QC giả và giữ khóa G2.

## Tài liệu bàn giao thực tế

`DD04_A00_028_20_KENH_A04_A05_HANDOFF_STAGING.zip` tạo từ hồ sơ kênh đã chốt trong môi trường hội thoại, gồm:
- 20 thư mục riêng theo channel_id, mỗi thư mục có:
  - `A04_REFERENCE_RENDER_QUEUE.json` — 7 prompt theo đúng appearance/character bible v1.
  - `A08_A09_IMAGE_QC.json` — kiểm mặt Việt hư cấu, an toàn trẻ, tuân thủ văn hóa; mọi mục PENDING.
  - `A03_A05_PHASE_VIDEO_PLAN.json` — nội dung đầu tiên và định hướng 3 giai đoạn giữ nguyên nhận diện.
  - `GATE_STATUS.json` — chặn A05 khi ảnh/QC chưa đủ.
- `A00_028_MASTER_QUEUE.csv` / `A00_028_MASTER_QUEUE.json`: 20 kênh và 140 nhiệm vụ.
- `A00_028_SHA256_MANIFEST.json`: checksum từng tệp.
- `README_HUONG_DAN.md`: thứ tự công việc cho Agent.
- Tệp ZIP được kiểm tra CRC, SHA-256 `6d488aca1f50d64151fa41a56ad3609d2400a4387d5a045891cd154e50a6dec9`.

## Giới hạn thực tế và chốt kiểm soát

- **PASS**: Gói job và tài liệu theo 20 kênh, test mã nguồn; CI còn phải được kiểm tra trạng thái mới nhất trước nghiệm thu.
- **CHƯA RENDER**: 140 ảnh; chưa có 20 bộ ảnh gốc đã được A08/A09 duyệt, chưa có video xuất file, chưa tích hợp công cụ tạo hình/video có quyền trên staging.
- **KHÔNG ĐƯỢC PHÉP**: giả chất lượng ảnh, cho Agent tự duyệt nội dung chưa xem, dùng danh tính người thật, mạo danh khách, chi API, đăng thiếu G2, merge production.
- `30_A00_026_REFERENCE_MEDIA_REGISTRY_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql` vẫn là ứng viên **chưa được CEO phê duyệt migration**. Không chạy migration hoặc tạo bucket lưu dữ liệu bằng quyền rộng.
- Thứ tự nghiệm thu thật: xác thực 2 ảnh gốc/1 kênh → tạo 5 góc/biểu cảm bổ sung → lưu private storage và đọc lại byte hash → A08/A09 xem ảnh và ký sự kiện riêng → A04 tạo frame → A05 dựng 20–60 giây → A08/A09 QC video → CEO G2 → A07 đăng nếu được cấp quyền.
