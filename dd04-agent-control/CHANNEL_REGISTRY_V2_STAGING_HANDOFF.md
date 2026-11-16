# DD04-CHANNEL-REGISTRY-V2 — Hồ sơ triển khai staging, CHỜ DUYỆT MIGRATION

Ngày 14/11/2026. Trạng thái **CODE READY / DATABASE NOT MIGRATED**. Cấu hình CEO Auth/MFA và G1/G2 vẫn chưa nghiệm thu, nên không được bật nghiệp vụ thực thi hay cấp quyền cho bất kỳ Agent nào.

## 1. Bằng chứng đọc cơ sở dữ liệu, không thay đổi
Project duy nhất: `wbvkqfnrlasmtizjszab` (DD04 staging). Schema hiện hữu `dd04_stage` có chính xác **7 bảng**: `commands`, `tasks`, `task_events`, `artifacts`, `approvals`, `agent_memories`, `capability_versions`. Cả 7 đang bật RLS. Chưa có bảng Registry. Supabase migration history hiện có `20261114121640 — dd04_a00_v2_private_7_tables_g1_locked`. Schema `public` không chứa những bảng DD-04 này.
Không sửa hoặc đổi tên các bảng nêu trên.

## 2. Mô hình V2 mới
| Bảng đề xuất ở `dd04_stage` | Khóa/chức năng |
|---|---|
| `channels` | Composite PK `tenant_id,channel_id`, nền tảng, tên kênh, tài khoản nền tảng đã xác minh hay chưa |
| `channel_profile_versions` | Bản chiến lược **bất biến** V1/V2/V3, content pillars, character bible, brand voice, `profile_sha256`; chỉ append version mới |
| `channel_agent_assignments` | `tenant_id,channel_id,agent_id` và trách nhiệm, các vai trò theo từng kênh |
| `channel_content_history` | Content hash / concept / storage_ref / QC, đúng `tenant_id+channel_id+profile_version+hash` và đúng task |
| `channel_task_context` | Ràng buộc task A00/A03 với phiên bản hồ sơ kênh; FK sang `dd04_stage.tasks` đã có |
| `channel_change_requests` | Đề xuất thay đổi hướng kênh, từ V0→V1 hoặc Vn→Vn+1, chờ G1 CEO |

**RLS:** cả 6 bảng mới đều bật RLS và REVOKE PUBLIC/anon/authenticated. Không tạo policy tự cấp quyền hoặc mở Data API. Đây là thiết kế deny-by-default, không phải hệ thống đăng nhập / phê duyệt đã hoạt động. Cần migration bảo mật/authorization được CEO nghiệm thu riêng sau CEO Auth/MFA.

**Khóa hồ sơ:** hàm trigger chống UPDATE/DELETE bản profile versions; proposal và quyết định quản lý riêng tại change_requests, tránh tự thay đổi định vị của kênh đang sản xuất. Thực thi G1 thực tế phải có xác minh CEO server-side và lịch sử audit riêng, chưa được xây hoặc mở trong V2.

## 3. Mã nguồn đã triển khai trên Draft PR
- `channel-registry-v2.mjs`: logic kiểm tra 1/5/20/300 kênh; validate profile, tạo một task theo đúng kênh/Agent; version change request chờ CEO, không mở G1/G2.
- `channel-context-core.mjs`: snapshot sha256, chặn task sai kênh/sai phiên bản/sai Agent.
- `a03-channel-script-planner.mjs`: nếu có profile kênh thì kết quả A03 phải gắn phiên bản và hash của đúng channel, không được coi template là đã phù hợp tự động; A08 phải QC.
- `channel-control.html` / `channel-control.js`: tìm/lọc 20–300 kênh demo, xem bốn tab, sửa nháp chiến lược, phân công Agent theo kênh, phân trang; nhập JSON tối đa 2MB và xuất bản nháp JSON. **Tất cả chỉ hoạt động trên bộ nhớ tab**, reload mất dữ liệu nếu chưa xuất file; không lưu database thật.
- `supabase/15_CHANNEL_REGISTRY_V2_REVIEW_ONLY.sql`: **SQL mẫu để CEO và kỹ thuật rà soát**, tuyệt đối chưa chạy migration.

## 4. Test bắt buộc
- `tests/dd04-channel-registry-v2.test.mjs`: đúng N kênh/N task, SHA đúng kênh, reject duplicate, đổi version không tự approve.
- `tests/dd04-channel-registry-v2-schema.test.mjs`: SQL chỉ `dd04_stage`, RLS tất cả 6 bảng, REVOKE rõ ràng, không DROP/ALTER 7 bảng cũ.
- `tests/dd04-channel-context.test.mjs`: Agent sai channel hoặc version → fail closed.
- `tests/dd04-channel-control-ui.test.mjs`: UI staging không gọi API server, không ghi Supabase.
- Workflow CI `.github/workflows/dd04-a00-preview.yml`; Netlify Deploy Preview PR#1.

## 5. Trước khi CEO được yêu cầu phê duyệt thực thi migration
1. CEO đọc SQL review-only và thiết kế ở trên.
2. Kỹ thuật bổ sung/kiểm thử runbook rollback an toàn **trên cơ sở dữ liệu thử nghiệm cô lập** hoặc với transaction kiểm thử schema, KHÔNG dùng project hiện hữu/production.
3. Đối chiếu quyền private schema, RLS và trigger immutable với chính project staging read-only.
4. Rà soát quyền Auth/MFA CEO và service-side authorization; chưa cấp quyền ghi cho nhân viên, Agent hay browser.
5. CEO phê duyệt **riêng một lần** việc thi hành trên project `wbvkqfnrlasmtizjszab`, ghi rõ commit/hash SQL; chỉ sau đó mới gọi migration API.

## 6. Giới hạn
**Chưa có dữ liệu kênh thật, metadata thật, liên kết Fanpage/TikTok thật, workflow gửi G1/G2, live LLM A03, QC thực tế, tạo video thật hoặc lịch sử data thật.**
300 kênh chỉ là kiểm thử UI scale, không phải KPI. Khi hoàn tất CEO Auth/G1, có thể phát triển lớp lưu trữ tenant-scoped và dashboard live, nhưng đừng biến số liệu mock thành số liệu thật.
