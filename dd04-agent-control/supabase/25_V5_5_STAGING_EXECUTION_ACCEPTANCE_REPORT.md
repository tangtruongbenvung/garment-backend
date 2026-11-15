# DD04-A00-019 — Biên bản triển khai V5.5 staging và nghiệm thu theo 5 bước
**Ngày:** 2026-11-15 (GMT+7)  
**Nguồn phê duyệt:** CEO trong Project chat phê duyệt (1) nghiệm thu lệnh thật, (2) migration riêng staging, (3) nối AI tạo kịch bản/nội dung, (4) mô phỏng bàn giao/sửa lỗi, (5) cuối cùng thử đăng tài khoản được cấp quyền.

## Phạm vi và bằng chứng
GitHub repo `tangtruongbenvung/garment-backend`, branch `feature/dd04-agent-dashboard-3d`; Netlify Preview #1 `https://deploy-preview-1--ducduy-ai-os-test.netlify.app/`; Supabase **staging duy nhất** `wbvkqfnrlasmtizjszab`, tenant `6bc73b49-a396-4c7d-b390-ab6339d547cd`. Production `ykhrtrvstymfjnzdgzna` không truy cập hay thay đổi.

### Bước 1 — CEO đã gửi lệnh thật: PASS ở tiếp nhận DB
- Supabase DB xác nhận lệnh `cmd_ad8d209b8d5a73044753`, nguồn `CEO_STAGING_WEB`, `created_by=b11f7154-5f5d-4b55-a497-90e8adf2525e`, thời gian `2026-11-15 01:47:23 UTC`.
- **7 task** và **1 task_event**; trạng thái `WAITING_CEO_PLAN` với G1 **PENDING**. Không coi đây là đã hoàn thành AI Agent hoặc thay thế duyệt tự động.
- A00 `diagnose()` được chỉnh sửa để yêu cầu có đủ 7 bảng lõi thay vì đúng tổng 7 bảng sau migration; CI kiểm thử mock 14 bảng.

### Bước 2 — Migration V5.5: PASS / đã áp dụng
- SQL đã được CEO phê duyệt: `dd04-agent-control/supabase/24_V5_5_COMMAND_MEDIA_FINANCE_HANDOFF_REVIEW_ONLY.sql`.
- Migration thực thi thành công: `20261115015022 dd04_a00_019_v55_evidence_locked_5_tables`.
- 5 bảng mới: `v55_command_media`, `v55_finance_policies`, `v55_finance_cases`, `v55_agent_handoff_events`, `v55_publish_jobs`; tổng **14 bảng**.
- 5 bảng mới bật RLS, `anon`/`authenticated` không có quyền trực tiếp SELECT/INSERT/UPDATE/DELETE, 5 trigger bất biến trước UPDATE/DELETE.
- Bảng mới đều 0 bản ghi tại thời điểm kiểm tra. Chính sách tài chính chỉ nhận `PROPOSED`; handoff chỉ `PENDING`; publish job chỉ `BLOCKED`. **Không cấp quyền chi/duyệt/đăng**.

### Bước 3 — A03 AI tạo kịch bản: code + mock tests PASS, external billing BLOCKED
- `dd04-agent-control/a03-openai-provider.mjs` triển khai kết nối `POST https://api.openai.com/v1/responses` theo tài liệu API chính thức. Không dùng khóa API trong client.
- Bộ kiểm tra yêu cầu đúng N kênh, N kịch bản có hướng sáng tạo khác nhau; tiếng Việt, nhân vật hoạt hình mẹ/bé Việt Nam hư cấu, 20–60 giây, scenes, caption, `reply_library.json`, QC A08/A09 `PENDING`.
- Trả lỗi nếu thiếu khóa/model, thiếu `SERVER_VERIFIED_FINANCE`, sai định dạng hoặc response của provider lỗi 429/không phải JSON.
- Endpoint `/api/dd04-a03-ai-drafts` **fail-closed**: Auth+MFA+CEO active, nhưng sẽ từ chối gọi model tới khi CEO cấu hình hạn mức tài chính `ACTIVE`, cost reservation theo request và khóa API server. **Chưa có bằng chứng mô hình AI đã trả phản hồi thực**, chưa tính chi phí.
- Không có API tạo video/hình ảnh thật, chưa có A04/A05 provider và chưa bàn giao A08/A09 trực tiếp từ model.

### Bước 4 — Agent QC handoff / sửa lỗi: simulation tests PASS, live handoff BLOCKED
- `dd04-agent-control/v55-agent-rework-simulator.mjs` + `tests/dd04-v55-agent-rework.test.mjs` kiểm tra:
  A03 SUBMIT_DRAFT → A08 PASS → A09 PASS → A07 rà quyền đăng.
  A08 REWORK → A03 REVISE làm tăng revision và reset **cả A08/A09 về PENDING**.
  Sai hash, nhấn PASS lặp, Agent không đúng quyền, A07 tự PUBLISH: từ chối.
- Đây là **pure simulation**, không ghi vào `dd04_stage.tasks`, không ghi `v55_agent_handoff_events` và không thể đăng.

### Bước 5 — Facebook/TikTok đăng thật: NOT STARTED
- Cần tạo/đối chiếu kênh hợp lệ, xác minh quyền nền tảng được nhân viên/CEO kết nối an toàn, cấp quyền riêng cho từng kênh, A07 idempotency, xác thực QC/chi phí/hash/lịch.
- Không đưa token platform vào chat/GitHub, không gọi API đăng trước khi được cấp quyền hợp lệ và bộ giao dịch staging được nghiệm thu.
- Nếu không có quyền API hợp lệ, A07 chỉ tạo bản nháp cho người được cấp quyền đăng thủ công.

## Kết quả kiểm thử CI
- Commit `2e559a212ebb6599547e50c9f8c36e4f4c0d2df7`: GitHub `test-a00` PASS, Windows PowerShell validation PASS, Netlify preview SUCCESS.
- Không có thao tác migration hay viết dữ liệu vào production.

## Blocker cần giải quyết tiếp
1. CEO cấu hình hạn mức tiền cho phép AI và kênh/chiến dịch; thiết kế transaction kích hoạt `v55_finance_policies` và giữ chỗ chi phí từng request, migration riêng được duyệt.
2. Cấu hình `DD04_STAGING_OPENAI_API_KEY`, `DD04_STAGING_OPENAI_MODEL` trong Netlify **Deploy Previews only**; không gửi khóa trong chat, chỉ bật sau khi ngân sách ACTIVE.
3. Channel Registry V2 có profile/kênh thực gắn hash/revision; A03 output → durable artifacts và A08/A09 reviewer thực.
4. Worker queue/handoff có Auth nội bộ, nhật ký append-only và policy hiệu lực; bằng chứng QA thật.
5. A04/A05 media generation, cost monitor, A06 packet scheduler, A07 platform permitted posting and recovery/idempotency.

**Trạng thái tổng:** Bước 1 và 2 PASS thực DB; bước 3 và 4 PASS code/tests nhưng **chưa chạy AI thật**; bước 5 chưa bắt đầu vì chưa có tài khoản được xác minh và chưa có nội dung QC thật.
