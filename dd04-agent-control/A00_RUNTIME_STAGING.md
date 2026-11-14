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
