# DD04-A00-006 · Bàn giao thiết kế lưu trữ dài hạn (chưa migration)

Ngày 14/11/2026 · Chỉ dùng trên nhánh `feature/dd04-agent-dashboard-3d`.

## Kết quả rà soát
- Đã xác nhận mã nguồn GitHub chứa giao diện Supabase client trong `dd-ceo.html` và `dd-config.js`, và một FastAPI/SQLite trong `main.py`. Các file này không chứng minh schema Supabase hoặc project staging hiện tại.
- Supabase connector đã được người dùng kết nối; phiên công cụ chưa cung cấp action truy vấn PostgreSQL, do đó **chưa chạy được audit SQL trên DB**. Không nhận định RLS hay các bảng đã tồn tại.
- Bộ metadata query chỉ đọc tại `supabase/01_READ_ONLY_AUDIT.sql`.
- Bản schema đề xuất **không được thi hành** tại `supabase/02_DRAFT_MIGRATION_DO_NOT_RUN.sql`. Tên schema đề xuất: `dd04_stage`; mọi role browser đều bị deny theo thiết kế.
- `persistence-contract.mjs` chuẩn hóa bản ghi Netlify A00 thành đối tượng dự kiến để đối chiếu và kiểm tra state transitions; **không ghi DB**.

## Các thực thể
| Đề xuất | Mục đích | Ràng buộc |
|---|---|---|
| commands | Lệnh từ gateway có hash | unique(origin,external_id) |
| tasks | Công việc theo Agent, phụ thuộc và phiên bản | FK command; Agent A00–A17 |
| task_events | Nhật ký chuyển trạng thái, actor và bằng chứng | Append-only là mục tiêu, cần chống UPDATE/DELETE tại DB/backend trước khi gọi là bất biến |
| approvals | Quyết định CEO G1/G2 theo phiên bản | PENDING mặc định; hash asset và danh sách kênh |
| artifacts | Đầu ra có version/hash | Chỉ lưu reference an toàn |
| agent_memories | Ký ức có nguồn, duyệt và độ tin cậy | PENDING không tự được dùng làm kiến thức |
| capability_versions | Tiến hóa kỹ năng có benchmark | PROPOSED → TESTED → APPROVED |

## Quy tắc vận hành
1. Lệnh CEO chỉ được xác nhận từ identity thực; `DD04_A00_PREVIEW_TOKEN` **không phải identity CEO**.
2. Không chuyển PLANNED_WAIT_G1 → READY nếu thiếu G1 có xác thực. Không công khai API approve/publish.
3. G2 phải khóa asset/content hash, kênh và lịch; thay đổi nội dung phải xét duyệt lại.
4. Luồng REWORK ghi lý do, bằng chứng, phiên bản; không ghi điểm QC giả.
5. API backend dùng token hệ thống riêng và validate actor; service_role không đưa vào GitHub/HTML/JS hoặc log.
6. Idempotency phải dùng unique constraint và transaction, không dựa vào GET-then-SET như Netlify Blobs POC.
7. Audit append-only và chính sách retention/backup cần nghiệm thu trước khi gọi DB production-ready.
8. Tất cả thay đổi dùng staging độc lập; không lấy service role/prod project hiện có để thử.

## Điều kiện chặn migration
- [ ] Xác minh Supabase project **staging độc lập** và owner/phạm vi quyền.
- [ ] Audit tên bảng, enum, trigger, RLS, grants và role hiện có (SELECT only).
- [ ] Phê duyệt bản SQL, tên schema, rollback và retention.
- [ ] CEO phê duyệt G1 cho kế hoạch và riêng migration staging.
- [ ] Kiểm thử SQL trong môi trường tách biệt; thử quyền anon/authenticated không truy cập được.
- [ ] Kiểm thử transaction, idempotency song song, audit edit attempts, backup/restore.
- [ ] CEO nghiệm thu trước khi bất kỳ job nào ghi dữ liệu.

## Tình trạng PASS/FAIL
- PASS: mã DDL đề xuất, báo cáo kiểm tra, hợp đồng chuyển đổi dữ liệu và unit tests CI.
- BLOCKED: truy vấn schema/RLS Supabase live, chưa có công cụ truy vấn DB trong phiên.
- NOT EXECUTED: migration, Supabase write, phê duyệt CEO thật.
- NEXT: lấy inventory chỉ đọc từ Supabase connector; phê duyệt riêng staging migration, sau đó triển khai adapter transactional & Dashboard telemetry.
