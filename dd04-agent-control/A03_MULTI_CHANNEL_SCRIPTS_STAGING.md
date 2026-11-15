# DD04-A03-001 — Một kênh một kịch bản, không trùng hướng sáng tạo

**Ngày:** 14/11/2026. **Môi trường:** feature branch + Netlify Deploy Preview #1, chỉ test sandbox.  
**Quyết định nghiệp vụ CEO:** Mỗi đầu việc/campaign cần xuất đúng N kịch bản cho N kênh được giao. Ví dụ N=5 sẽ có 5 kịch bản khác biệt, tương ứng 5 sản phẩm video. Không sản xuất hàng loạt một kịch bản rồi thay caption để tạo nhiều video.

## Hợp đồng dữ liệu
`POST /api/dd04-a00/a03-preview`, header `Authorization: Bearer <DD04_A00_PREVIEW_TOKEN>`, `Content-Type: application/json`. API chỉ hoạt động trên hostname deploy-preview hợp lệ, không gọi LLM, không ghi Supabase, không chạy G1/G2.

Input:
```json
{
  "campaign_id": "DD04-TEST-20261114",
  "channels": [
    {"channel_id":"demo-01","name":"Kênh demo 1","platform":"FANPAGE"},
    {"channel_id":"demo-02","name":"Kênh demo 2","platform":"TIKTOK"},
    {"channel_id":"demo-03","name":"Kênh demo 3","platform":"FANPAGE"},
    {"channel_id":"demo-04","name":"Kênh demo 4","platform":"TIKTOK"},
    {"channel_id":"demo-05","name":"Kênh demo 5","platform":"FANPAGE"}
  ]
}
```
Output: `channel_count == script_count == 5`; mỗi `script` có `channel_id,channel_name,platform,script_id,creative{title,approach,story,hook,beats,punchline},scenes,duration_seconds,video_brief,caption,reply_library,review,fingerprint`. Nhiệm vụ `A08/A09` còn `PENDING`, G1/G2 `NOT_APPROVED`, `publishing_allowed:false`.

## Kiểm tra khác biệt và chống trùng
- Từ 1 đến 20 kênh trong một yêu cầu. Khóa trùng `channel_id`; mặc định không nhận trùng `channel_name`; yêu cầu `platform` thuộc FANPAGE/TIKTOK.
- Đủ 20 hướng sáng tạo mẫu tách biệt (đảo vai, trinh thám, đóng nghề nghiệp, thi tài, anh hùng, thú bông, hiểu nhầm, thể thao, kỳ ảo, thời gian, sân khấu, đồ vật, nhiếp ảnh, phiêu lưu, tưởng tượng, nấu ăn, tòa án, quan sát, trao đổi, trình diễn).
- Tại runtime kiểm tra trùng tên kịch bản và hướng thể hiện sau chuẩn hóa tiếng Việt; xuất `fingerprint` SHA-256, nội dung từng cảnh và kênh.
- Dữ liệu đang là **bộ mẫu có sẵn**, chỉ kiểm chứng tuyến nghiệp vụ / số lượng / tính đa dạng. Chưa phải so trùng ngữ nghĩa bằng embedding hoặc đánh giá đạo diễn A08/A09. Chưa có AI sinh kịch bản thật dựa trên profile và trend thực tế.
- Không dùng hình ảnh người thật, không gợi tình huống gây nguy hiểm cho trẻ em, không dùng tục ngữ thô tục hoặc bình luận giả.
- `reply_library` có phản hồi cho tình huống tích cực/hỏi đáp/góp ý, không kích hoạt A16/A17.

## Thao tác thử nghiệm
1. Mở `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/a03-preview.html`.
2. Nhập khóa vận hành Deploy Preview hiện có **tại trang đó**, không gửi trong chat.
3. Mặc định `5` kênh demo, chỉnh số kênh từ 1–20; mỗi dòng nhập mã kênh, tên kênh, nền tảng FANPAGE/TIKTOK.
4. Nhấn **Tạo đủ kịch bản theo kênh**.
5. Xem từng kịch bản 30 giây và trạng thái G1/G2; xuất JSON chứa các trường `reply_library`. File này là bản nháp kiểm thử, không phải chứng cứ Agent đang chạy.
6. Nhấn **Xóa kết quả và khóa** khi hoàn tất.

## Tiến độ và ranh giới
| Hạng mục | Trạng thái |
|---|---|
| Quy tắc 1 channel → 1 script | CODE + CI TEST |
| 5 channels → 5 different titles / approaches / scenes | CODE + CI TEST |
| 20 channels → 20 distinct approaches | CODE + CI TEST |
| A03 script preview UI / JSON handoff | CODE + CI TEST |
| Nhập profile từng kênh, trend, tự gọi LLM, tối ưu semantic duplication | CHƯA CÓ |
| A08/A09 đánh giá nội dung thực tế, chấm PASS | CHƯA CÓ |
| A00 tạo nhiệm vụ và tự chạy A03 sau G1 thực tế | BLOCKED BY CEO AUTH/G1 |
| A04/A05 video sản xuất thật | CHƯA CÓ |
| A07 đăng bài, G2 duyệt thật | BLOCKED |
| Supabase V2 database schema / production | KHÔNG THAY ĐỔI |

**Bước tới:** Khi CEO Auth G1 hoạt động thật, thiết kế công việc cha `campaign` + N `script_tasks` riêng trong phiên bản schema review và trình CEO phê duyệt migration tương ứng. A03 AI sẽ sinh kịch bản theo profile từng kênh, A08 kiểm tra trùng cấu trúc/nội dung/ngữ nghĩa và A09 kiểm duyệt tuân thủ. Nếu trùng thì tái tạo, không gửi video trùng qua A04/A05.
