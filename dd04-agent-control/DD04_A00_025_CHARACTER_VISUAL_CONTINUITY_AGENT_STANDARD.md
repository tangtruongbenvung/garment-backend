# DD04-A00-025 — QUY CHUẨN NHÂN VẬT / PHONG CÁCH / TÍNH NHẤT QUÁN VÀ PHỐI HỢP AGENT
Ngày 15/11/2026 · Áp dụng thiết kế DD-04 trên nhánh PR #7, **staging only**.

## 1. Ba nguyên tắc CEO đã chốt
1. **Trong một video**: mẹ, bé và mọi nhân vật xuất hiện phải giữ nguyên nhận dạng (khuôn mặt, tóc, tông da, tỷ lệ, quần áo, giọng đặc trưng), chỉ đổi biểu cảm, động tác, góc quay hay đạo cụ an toàn; không nhảy nhận dạng giữa cảnh.
2. **Trong toàn bộ một kênh**: giữ cùng hai nhân vật mẹ/bé và phong cách hình ảnh, bối cảnh, nhịp lời thoại, màu sắc qua tất cả video; kênh khác dùng bộ nhân vật riêng. Nếu đổi bản sắc, phải **tăng version**, kiểm duyệt và khóa hash mới, không ghi đè im lặng lên video cũ.
3. **Đẹp, cuốn hút và phù hợp gia đình Việt**: hình hoạt hình 3D cách điệu không giả người thật; thoại tiếng Việt tự nhiên, không máy móc; tình huống hài gắn sinh hoạt Việt Nam, không định kiến vùng miền, không miệt thị cha mẹ/trẻ nhỏ, không mô tả hành vi nguy hiểm, không nhạc/hình thiếu quyền, không seeding giả/spam.

## 2. Khung dữ liệu máy đọc được (JSON Schema)
- `contracts/channel_character_bible.schema.json`: một Character Bible cho từng kênh, tách rõ invariant của MẸ và BÉ, `channel_id`, version, profile hash, tiếng Việt và quy tắc văn hóa.
- `contracts/channel_visual_style.schema.json`: phong cách hoạt hình, màu nền, thiết kế nhà Việt, ánh sáng, bố cục video dọc 9:16, phụ đề, âm thanh.
- `contracts/channel_continuity_rules.schema.json`: danh sách trường khóa, trường có thể thay đổi, kiểm liên cảnh / liên video, điều kiện thay đổi version, QC A08/A09.
- `a00-025-channel-identity-lock.mjs`: sinh hồ sơ ổn định theo channel_id/platform/version và profile_sha256, băm SHA256 độc lập cho character/style/rules và cả bundle.
- `a00-024-content-factory-draft.mjs`: đóng dấu `channel_identity_sha256`, `channel_character_bible_sha256`, `channel_visual_style_sha256` lên **từng cảnh A04**, truyền qua A05 và gắn kiểm tra consistency vào A08.
- `a00-025-channel-identity.test.mjs`: so sánh hai video cùng kênh, so kênh khác, sửa trái phép một cảnh, đổi phiên bản, đổi profile SHA, 20 kênh tách biệt.

## 3. Bàn giao Agent và điều kiện nghiệm thu
| Chủ trì | Đầu ra có version/hash | Agent nhận | Điều kiện PASS |
|---|---|---|---|
| A00/A02/A06 | Channel profile + hash định vị | A03, A04 | đúng kênh, version không bị thay |
| A03 | hook, kịch bản hài mẹ/bé 20–60s, caption, `reply_library.json` | A04 | ngôn ngữ Việt tự nhiên, mạch truyện rõ |
| A04 | Character Bible, style guide, reference image hash, prompt/cảnh | A05 | đúng hash mỗi cảnh; sau khi có ảnh thật phải kiểm byte/image và khuôn mặt bằng A08 |
| A05 | shot list/video 9:16, giọng, phụ đề, âm thanh có quyền, file video hash | A08 | đúng thời lượng, nhịp dựng, không lỗi liên cảnh |
| A08 | bằng chứng QC kỹ thuật, mỹ thuật, nhịp kể, consistency liên video | A09 | kiểm độc lập, không đánh dấu PASS khi chỉ có prompt |
| A09 | bằng chứng tuân thủ/đặc điểm văn hóa Việt, an toàn trẻ, bản quyền | CEO G2 | lời thoại phù hợp, không giả mạo/spam |
| CEO | G2 của **video/caption/kênh/lịch và hash cuối** | A07 | Agent không tự đăng và không thay asset sau G2 |

A00 yêu cầu A04/A05 sửa lỗi nếu hash channel khác, thay nhân vật, thay giọng hoặc thiếu bằng chứng quyền nhạc. Mọi lần sửa tăng revision và ghi nhật ký; nếu asset cuối khác hash đã G2 thì CEO phải duyệt lại.

## 4. Thang chất lượng gợi ý cho QC (không tự động hợp thức hóa)
- **Bắt buộc**: đúng nhân vật và nhận diện kênh; không lỗi văn hóa/an toàn; ảnh/video gốc có hash file thật; không vi phạm bản quyền; thời lượng 20–60 giây; G2 duyệt cuối.
- **Đánh giá định tính**: hook 1–3 giây, mạch truyện dễ hiểu, biểu cảm, ánh sáng, chuyển động mượt, thoại tự nhiên, cú chốt hài và phụ đề tiếng Việt.
- **Không dùng điểm chất lượng để vượt bảo vệ**: dù điểm cao vẫn HOLD nếu sai nhân vật, thiếu QC, thiếu quyền sử dụng hoặc G2 chưa duyệt.

## 5. Giới hạn thực tế của bản đã viết
- Đây là **thiết kế hợp đồng + generator prompt/storyboard**. Sinh cùng hash không chứng minh các hình ảnh do AI khác nhau thực tế giống nhau. Chỉ khi có **reference image thật**, đối chiếu byte/hash storage, kiểm khung hình và A08 đánh giá hình/giọng mới được PASS visual continuity.
- Chưa có backend ghi hồ sơ nhân vật vào DB hoặc object storage, chưa render ảnh/video, chưa Agent A04/A05 chạy API provider, chưa có Agent handoff thật trong Master Task Ledger, chưa tự đăng.
- Không mở tài chính A11 cho xây kênh. Không thay đổi Supabase migration/prod. Mọi công cụ có chi phí phải được cấp quyền riêng; không có công cụ thì chỉ chuẩn bị gói nội dung.
- G2 của CEO áp dụng cho **sản phẩm hoàn chỉnh trước đăng**, không tạo thêm phê duyệt chi tiết cho mỗi bước nội bộ.
