# DD04-A00-004 — Runtime tiếp nhận và phân tuyến (staging preview)

## Tình trạng
Mã backend Netlify Function thực thi quy tắc nhận lệnh và tạo bản ghi lệnh/task/meeting/approval PENDING. **Chưa phải multi-agent LLM runtime, chưa Telegram, chưa xác thực danh tính CEO, chưa đủ điều kiện nghiệp vụ sản xuất/đăng bài.**

- Endpoint: `GET /api/dd04-a00/health` (trả trạng thái cấu hình, không chứa secrets).
- Endpoint có bảo vệ: `POST /api/dd04-a00/commands` và `GET /api/dd04-a00/commands/:id`.
- Giới hạn: chỉ chạy khi `CONTEXT=deploy-preview`, mặc định khóa POST/GET dữ liệu.
- Đầu vào POST: `{"external_id":"manual-0001","message_text":"Tạo một video hoạt hình mẹ bé 30 giây"}`, content-type application/json.
- Token từ Netlify Environment variables: `DD04_A00_PREVIEW_TOKEN` chuỗi ngẫu nhiên tối thiểu 32 ký tự, **chỉ khai báo cho Deploy Previews/Functions, không đưa token vào chat/repo/ảnh/log**.
- Dùng `Authorization: Bearer <token>`; token chỉ đại diện cho người vận hành thử nghiệm, KHÔNG phải chứng thực CEO.
- Mọi yêu cầu đều mặc định `WAITING_CEO_PLAN`, `approvals.PLAN=PENDING`; không có endpoint approve/publish.

## Lưu trữ
`@netlify/blobs` `getDeployStore('dd04-a00-runtime-poc')`: cô lập theo từng deploy. Không chung dữ liệu với production, không giữ lịch sử khi chuyển sang một deploy mới. Đây là cách thử luồng online an toàn, **không thay thế cơ sở dữ liệu giao dịch**. Concurrent writes vẫn cần DB có constraint/idempotency trước khi vận hành.

## Test
`node --test tests/dd04-a00.test.mjs` và workflow `DD04 A00 preview checks` trên GitHub. Cần thử nghiệm HTTP thật sau khi cấu hình token trên Netlify.

## Nguyên tắc tiếp theo
- Kiểm tra schema/RLS Supabase STAGING chỉ đọc trước khi xin CEO duyệt migration staging riêng.
- Thêm xác thực CEO dựa trên identity được ủy quyền; audit bất biến, transaction/idempotency DB.
- Sau đó Gateway Telegram xác thực; tiếp đến runtime A03/A04/A05/A08/A09.
- Cổng G1/G2 phải được CEO xác thực và khóa asset hashes; hiện CHƯA IMPLEMENTED.

## PASS / FAIL
PASS kỹ thuật nếu CI unit test xanh, Netlify build thành công, GET /health trả cấu hình, chưa cấu hình secret thì POST bị khóa; sau khi cấu hình secret test một lệnh tạo và lệnh lặp ra 201/200. FAIL nếu endpoint công khai ghi dữ liệu, lộ token, có lệnh tự approve, hoặc tác động production.

## P0.5 — Dashboard đọc dữ liệu A00 có xác thực (14/11/2026)
- URL: `/dd04-agent-control/`, tab **A00 · Dữ liệu API thật**.
- Nhập `DD04_A00_PREVIEW_TOKEN` trong biểu mẫu (password, không lưu persistent) rồi chọn **Tải danh sách lệnh trong deploy** để gọi GET `/api/dd04-a00/commands`.
- API trả tối đa 30 lệnh đã lưu trong `getDeployStore` hiện tại; phân biệt nguồn `DEPLOY_SCOPED_BLOBS_API`. Có thể đọc cụ thể GET `/api/dd04-a00/commands/:id` (1–5 ID) mà không phải dùng dữ liệu demo.
- Dashboard hiển thị task_graph, trạng thái, phân tuyến Agent, G1, biên bản nháp, audit. Khi chưa có job telemetry, **không tuyên bố Agent đang thực thi**.
- Đây là dữ liệu backend thực của lần thử, **không phải nhiệm vụ đã được Agent AI thực hiện**.
- Mỗi lần deploy thay đổi vùng lưu riêng của Netlify Blobs. Lệnh trước đó có thể không còn. Lúc đó tạo một lệnh thử mới trên `/dd04-agent-control/operator-test.html` sau deploy; không hiển thị kết quả demo thay thế.
- **Không phù hợp lưu trữ dài hạn**. Chờ kiểm tra schema/RLS staging rồi xin duyệt migration staging riêng, thiết kế auth CEO và event-store transactional.
- Không có thao tác ghi, phê duyệt hay publication ở Dashboard live.

### Bài nghiệm thu online
1. Tạo lệnh test tại operator-test của Deploy Preview hiện hành; HTTP 201.
2. Mở Dashboard → A00 · Dữ liệu API thật, nhập token, chọn Tải danh sách; phải có mã lệnh cùng 7 task trạng thái `PLANNED_WAIT_G1`.
3. Kiểm tra màn hình 3D hiển thị phân tuyến đúng, G1 Pending, audit nhận lệnh.
4. Không cấp token thì API list phải 401; không biến cấu hình thì 503.
5. Không có 20 task demo trong tab live; không có quyền duyệt G1/G2.
