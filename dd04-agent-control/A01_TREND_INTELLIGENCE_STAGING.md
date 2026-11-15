# DD04-A01-001 — Thiết kế Ban Nghiên cứu Xu hướng | STAGING ONLY
Ngày 2026-11-15 · Căn cứ DD04 V5.3 và hồ sơ bàn giao 18 Agent.
## Phạm vi
A01 Trend Intelligence nghiên cứu nguồn nội dung, lập bằng chứng, đề xuất cơ hội sáng tạo và bàn giao A00/A02/A03. A02 chịu trách nhiệm chiến lược từng kênh. A00 điều phối và trình CEO G1. A03 viết N kịch bản theo N channel profile. A08/A09 thẩm định; A07 chỉ được hoạt động sau G2 hợp lệ. CEO là người duyệt duy nhất.
## Sản phẩm thiết kế
- `a01-trend-intelligence.mjs`: module thuần Node, nhận dữ liệu nghiên cứu do người vận hành cung cấp, chuẩn hóa nguồn/ngày/metrics; lập concepts và channel_matches gắn `channel_id`, `profile_version`, `profile_sha256`; xuất `content_sha256` cùng handoff, fail closed khi sửa nội dung.
- `tests/dd04-a01-trend-intelligence.test.mjs`: kiểm tra khóa G1/G2, tính toàn vẹn hash, thời lượng, nguồn, phép đo không hợp lệ và liên kết bằng chứng.
- Không có crawler/connector TikTok-Facebook, không LLM live, không chạy schedule, không kết nối DB, không API ghi, không tạo dữ liệu giả thành dữ liệu thực.
## Quy trình đề xuất (chỉ là thiết kế; chưa kích hoạt production)
1. A00 tạo nhiệm vụ theo campaign/ngày, research_id, deadline và kênh mục tiêu (G1 chờ duyệt).
2. A01 tiếp nhận đề bài, thu thập bằng chứng hợp pháp: URL công khai, nội dung quan sát, ngày quan sát, nền tảng, loại nguồn và chỉ số đã kiểm chứng (nếu có). Không suy diễn lượt xem từ nguồn không đo được.
3. A01 phân tích chủ đề, diễn biến, insight, đề xuất concept 20–60 giây mẹ/bé hoạt hình hư cấu Việt Nam; ghi rủi ro nội dung, quyền sở hữu, an toàn trẻ và mức độ trùng lặp cần rà soát.
4. Khi có hồ sơ kênh đã chốt, A01 đề xuất channel_matches với đúng version/hash; A02 xác minh phù hợp và khác biệt hóa giữa các kênh.
5. A01 bàn giao A00/A02/A03 dữ liệu có hash. A00 lập hồ sơ G1 có ngân sách/phạm vi + bằng chứng CEO duyệt riêng. Chưa có G1 thì dừng ở nháp; không khởi chạy sản xuất.
6. A03/A04/A05 sản xuất theo kênh, A08/A09 QC; A00 trình CEO G2 gồm asset/caption/channel/lịch/revision/hash; A07 chỉ thực hiện qua luồng cho phép sau G2.
7. Sau triển khai thực: A10/A11 phân tích dữ liệu 30 ngày, A01 nhận phản hồi về xu hướng. 20 kênh là mục tiêu khởi động chưa được xác nhận có tài khoản thật.
## Đầu ra đề xuất
`campaign_id/research_id/research_window/research_question/evidence[]/concepts[]/channel_matches[]/content_sha256/handoff`.
Nguồn có `source_url, observed_at, source_type, source_platform, verification`; concept bắt buộc liên kết evidence_id và nêu rủi ro. Metrics chưa xác minh không được dùng làm KPI thật. Hash không có chữ ký số; không thay thế audit database hay xác thực CEO.
## Chế độ hoạt động
- Ngày vận hành dự kiến: báo cáo xu hướng hằng ngày; báo cáo tổng hợp hằng tuần; review 30 ngày theo dữ liệu thật — chỉ kích hoạt lịch sau khi A00/G1 cho phép.
- Kiểm chứng ý tưởng: tính thời sự, độ phù hợp mẹ/bé hư cấu Việt Nam, độ khác biệt giữa kênh, khả năng sản xuất, tuân thủ và độ tin cậy của nguồn. Chưa có điểm số KPI chính thức vì không có baseline dữ liệu thật.
- Bảo mật: không dùng token/API key trong code hoặc báo cáo. Thu thập đúng điều khoản nền tảng; không scraping vượt quyền, không tạo tương tác giả.
## Đề xuất schema staging về sau — CHƯA CHẠY SQL
`a01_research_runs` (tenant,campaign,revision,hash,state), `a01_evidence` (source,observed_at,source_type,metrics,verification), `a01_opportunities` (concept,risks,evidence_refs), `a01_channel_matches` (channel_id,profile_version,profile_hash,fit_reason). Cần tenant RLS, role A00/A01/A02/CEO, audit append-only, hạn mức nguồn, kiểm idempotency và chính sách lưu trữ. SQL phải duyệt riêng cho đúng staging project `wbvkqfnrlasmtizjszab`, không chạm `ykhrtrvstymfjnzdgzna`.
## Nghiệm thu / giới hạn
PASS chỉ khi GitHub xác nhận commit và CI kiểm thử đạt. Chưa được gọi Agent thực sự hoạt động nếu thiếu feed/DB/LLM và phê duyệt. G1/G2 vẫn LOCKED. Mọi migration, cấp quyền và thao tác production đều ngoài phạm vi.
## Nhiệm vụ kế
A00 đánh giá đặc tả; A02 chuẩn hóa channel profile; xác lập nguồn dữ liệu hợp lệ và cơ chế kiểm chứng chỉ số; CEO duyệt riêng kế hoạch G1 và SQL staging khi thực sự cần persistence.