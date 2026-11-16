# DD04-A00-030 — FB002 BẾP NHÀ BÔNG: VIDEO THÍ ĐIỂM THẬT & CỔNG STAGING
Ngày 15/11/2026. Nhánh PR #7 DRAFT. Tuyệt đối staging-only.

## 1. Sản phẩm video có thể xem
Đã tạo video MP4 **FB002 Bếp Nhà Bông**, mẹ Hạnh và bé Bông hoạt hình hư cấu gần ảnh thật, sinh hoạt tại gian bếp Việt Nam với rau củ bằng đồ chơi.
- Video file (chỉ đính kèm trong hội thoại, KHÔNG upload GitHub): `DD04_FB002_Bep_Nha_Bong_VIDEO_THI_DIEM_30s.mp4`
- H.264 + AAC; **576×1024**, 24 fps, **30.000 giây**, 11,971,526 bytes.
- SHA-256: `64712de79c838721883358d0cf4b380acbcb860a25d6772a09311854bf867103`.
- Gốc 1 ảnh six-panel photoreal hư cấu được tách thành 6 cảnh, bố cục dọc, hiệu ứng zoom-pan nhẹ (Ken Burns), phụ đề tiếng Việt và nhạc nền giai điệu nguyên bản tổng hợp cục bộ; KHÔNG có voiceover.
- Cốt truyện: bé Bông chơi làm đầu bếp với rau củ/chuối đồ chơi, mẹ Hạnh ngạc nhiên, cả hai cùng cười và ôm nhau.
- Source image `a_bright_warm_high_resolution_photographic_colla.png` thuộc hội thoại và không phải ảnh thật của trẻ em.
- Có `PILOT_MANIFEST.json`, ảnh chụp preview, ZIP gồm file MP4 và bằng chứng.
- **Hạn chế**: đây là *video storyboard chuyển động trên ảnh tĩnh*, KHÔNG phải AI video với miệng/cơ thể chuyển động tự nhiên. Không có bằng chứng A08/A09 độc lập đã kiểm duyệt, không có G2 và không được đăng.

## 2. Staging Supabase hiện vẫn fail-closed
Trực tiếp truy vấn project `wbvkqfnrlasmtizjszab`:
- `storage.buckets=0`.
- `dd04_stage.a00_026_%` bảng media = 0.
- A00 worker ACTIVE=0, publish jobs=0.
- **Chưa có upload/readback video hoặc ảnh lên Supabase Storage**, chưa có A08/A09 DB audit PASS và chưa có Agent handoff G1/A05 thật.
- SQL30 `30_A00_026_REFERENCE_MEDIA_REGISTRY_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql` SHA-256 `a550ecbdd064c455d3c23c85c5c8f6e17f6b0de52c53fdd9bbf7ddd7de7fa4fa` **CHƯA CÓ CEO PHÊ DUYỆT RIÊNG** và **CHƯA CHẠY**.
- Supabase chính thức hỗ trợ tạo private bucket qua dashboard/Storage API, hạn mức MIME và file; object download private cần auth JWT/RLS (https://supabase.com/docs/guides/storage/buckets/fundamentals và https://supabase.com/docs/guides/storage/serving/downloads).
- Supabase connector trong chat chưa cung cấp binary object upload; backend adapter, script private bucket đã viết và CI PASS nhưng chưa thể tuyên bố live Storage hoạt động.

## 2A. Storage bucket created on live staging AFTER initial read-only audit
- Authorized staging task included setting up private image storage. Applied **only** bucket configuration to project `wbvkqfnrlasmtizjszab`, without applying SQL30 or changing production.
- Final live readback: `storage.buckets` includes exactly `dd04-media-private-staging` with `public=false`, `file_size_limit=12582912`, `allowed_mime_types=['image/png','image/jpeg','image/webp']`.
- `storage.objects` currently has **0 objects** in this bucket; no bucket-specific public RLS policy. No upload/readback through Supabase yet.
- No user secrets exposed, no Agent worker activated. `a00_026_%` media tables remain 0, G2/publishing locked.
- Private bucket creation is a **staging Storage configuration write**, not SQL30 schema migration or a real successful media pipeline.

## 3. Trình tự để vận hành video AI thật trên staging
1. CEO phê duyệt **chính xác SQL30 với SHA-256 trên** cho riêng project staging, sau đó A00 áp migration và hậu kiểm RLS/immutability.
2. Tạo bucket `dd04-media-private-staging` **private**, PNG/JPEG/WebP, tối đa 12MB, dùng official Storage API với backend key chỉ nằm ở server. Không đưa service-role lên trình duyệt/chat/GitHub. Chỉ cho phép `staging`, tenant & channel whitelist. Kiểm tra upload + download real byte SHA cho FB001/FB002/TT002.
3. Thiết kế và áp quyền đăng ký/thu hồi Agent thử nghiệm A04/A05/A08/A09 qua backend; các danh tính hiện chưa ACTIVE. Không tự mô phỏng signed audit event.
4. A08/A09 đánh giá **hình ảnh thật**: nhất quán mẹ/bé từng cảnh và giữa các video, ngôn ngữ và phong tục Việt, an toàn trẻ, nguồn nhạc/tranh, và ghi sự kiện kiểm duyệt bất biến.
5. Render từ ảnh chuẩn sang **chuyển động nhân vật thực** bằng công cụ có quyền hoạt động, kèm âm thanh tiếng Việt, kiểm file `ffprobe` và SHA. Không có quyền model video trả phí nên chưa gọi. A08/A09 phải kiểm duyệt video, CEO G2 quyết định chính xác asset/caption/kênh/lịch, A07 đăng bằng quyền hợp lệ.
6. Chỉ sau các bằng chứng live, mới nâng tình trạng `VIDEO_READY_FOR_G2`. Hiện: `TECHNICAL_PILOT_HOLD_A08_A09`.

## 4. Báo cáo trạng thái
PASS: tạo và kiểm tra MP4 thực, 30s dọc, file hash; backend Storage code & tests, staging SQL read-only checks.
PASS: private staging bucket metadata/configuration verified. FAIL/CHƯA: SQL30, upload/readback actual image bytes through Supabase, independent A08/A09, true AI character-motion video, G2.
Production: KHÔNG THAY ĐỔI. Chi phí AI: KHÔNG PHÁT SINH. Không đăng bài.
