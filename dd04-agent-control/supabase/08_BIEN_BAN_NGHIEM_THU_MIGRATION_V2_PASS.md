# DD04-A00-007 — BIÊN BẢN NGHIỆM THU MIGRATION V2 (PASS)

**Ngày:** 14/11/2026  
**Phê duyệt CEO:** thực thi lại SQL V2 tại commit `42087ec7528d1fe19f1766f84885f8c3c62953a6`, chỉ dự án Supabase staging `wbvkqfnrlasmtizjszab`, không thay đổi project hiện hữu.  
**Kết luận:** **PASS migration và kiểm thử database giới hạn**. Chưa nghiệm thu vận hành A00/Agent hoặc phê duyệt CEO thật.

## 1. Xác minh trước khi thực thi
- Project: `ducduy-ai-os-dd04-staging`, ref `wbvkqfnrlasmtizjszab`, trạng thái `ACTIVE_HEALTHY`, PostgreSQL 17.11.
- Project hiện hữu cần bảo vệ: `ykhrtrvstymfjnzdgzna` (không dùng làm đích migration).
- Bảng ứng dụng: 0, migrations: 0.
- SQL được truy xuất đúng tại GitHub commit CEO chỉ định. File blob SHA: `5462275799ae6a7b5382a1d25854c0372f86cba9`, trùng SHA của file trên nhánh staging.
- Bảy lệnh `CREATE TABLE dd04_stage.*`; 8 cặp dollar-quote cho hàm trigger; transaction `BEGIN/COMMIT`.
- Bản thử lần trước đã thất bại syntax và không để lại schema/migration; tham khảo `07_BIEN_BAN_MIGRATION_V2_FAIL_CU_PHAP.md`.

## 2. Thực thi
- Công cụ: Supabase `apply_migration`, chỉ project `wbvkqfnrlasmtizjszab`.
- Migration name: `dd04_a00_v2_private_7_tables_g1_locked`.
- Supabase trả `{"success":true}`.
- Xác nhận `list_migrations`: version `20261114121640`, name `dd04_a00_v2_private_7_tables_g1_locked`.

## 3. Bằng chứng schema/RLS/policies
- Đúng 7 bảng `dd04_stage`: `commands`, `tasks`, `task_events`, `approvals`, `artifacts`, `agent_memories`, `capability_versions`.
- 7/7 `relrowsecurity = true`; `relforcerowsecurity = false` (owner bypasses RLS, không đồng nghĩa cho phép browser).
- Cả 7 bảng có `anon SELECT=false, anon INSERT=false, authenticated SELECT=false, authenticated INSERT=false` theo PostgreSQL privilege catalog.
- `has_schema_privilege(anon,dd04_stage,USAGE)=false`; `has_schema_privilege(authenticated,dd04_stage,USAGE)=false`.
- Không có `pg_policies` trong schema private (`0`); không mở quyền trực tiếp bằng browser.
- 8 hàm đều `security_definer=false`; `anon_execute=false`, `auth_execute=false`.
- 9 trigger cấu hình đã `enabled='O'`:
  - `dd04_commands_guard`; `dd04_tasks_guard`
  - `dd04_approval_guard`, `dd04_approval_insert_guard`, `dd04_approval_no_delete`
  - `dd04_task_events_immutable`, `dd04_artifacts_immutable`
  - `dd04_memories_guard`, `dd04_capabilities_guard`.
- Security Advisor trả 7 findings `rls_enabled_no_policy` mức `INFO`: **có chủ đích** do private schema và deny permissions; không nên tự mở policy để xóa cảnh báo. Tham khảo https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## 4. Kiểm thử hành vi G1/G2 & nhật ký
Đã thực hiện **trên staging duy nhất**, thông qua `BEGIN; DO ... EXCEPTION ...; ROLLBACK;` với bản ghi thử nghiệm riêng. Các lỗi mong đợi được kiểm tra chính xác bằng `MESSAGE_TEXT`:
1. INSERT command ở trạng thái `READY` bị từ chối: `DD04_COMMAND_G1_REQUIRED`.
2. INSERT command hợp lệ `WAITING_CEO_PLAN` để thử các FK.
3. INSERT task ở `READY` bị từ chối: `DD04_G1_PENDING_TASK_ONLY`.
4. UPDATE task từ `PLANNED_WAIT_G1` → `READY` bị từ chối: `DD04_TASK_TRANSITIONS_NOT_ENABLED`.
5. INSERT snapshot `G1=PENDING` và `G2=PENDING` hợp lệ.
6. UPDATE `G1` → `APPROVED` bị từ chối: `DD04_CEO_AUTH_APPROVAL_NOT_CONFIGURED`.
7. UPDATE `G2` → `APPROVED` bị từ chối: `DD04_CEO_AUTH_APPROVAL_NOT_CONFIGURED`.
8. UPDATE nhật ký `task_events` bị từ chối: `DD04_AUDIT_APPEND_ONLY`.
9. Sau `ROLLBACK`, **7/7 bảng có 0 hàng** theo SQL read-only độc lập.

**Giới hạn:** Đây là kiểm thử âm tính và metadata. Chưa thực hiện kiểm thử tích hợp login CEO thật, đa tenant bằng các danh tính Supabase Auth riêng, hoặc thử từ Data API ở browser. Chưa kiểm thử rollback sau khi migration đã commit.

## 5. Chưa được phép/tự nhận
- Không có quyền phê duyệt G1/G2 thật được mở bởi migration; các trigger đang **khóa toàn bộ thay đổi quyết định**.
- Không có adapter A00 kết nối Supabase; A00 hiện tại vẫn dùng Netlify Blobs theo deploy.
- Chưa có tạo/đăng nội dung, chưa có tự động kết nối Telegram/Zalo, chưa chuyển sản phẩm đến A07.
- Không cấp service_role/secret key vào client, không kết nối production.
- SQL/schema hiện là V2; mọi thay đổi schema tiếp theo cần quy trình CEO duyệt riêng.

## 6. Tình trạng và bước tiếp
| Hạng mục | Trạng thái |
|---|---|
| Đúng project staging | PASS |
| Applied migration V2 | PASS |
| 7/7 tables RLS enabled | PASS |
| Chặn anon/auth direct permissions | PASS theo pg_catalog |
| 9 triggers installed/enabled | PASS |
| Negative G1/G2 + event immutability rollback tests | PASS |
| 0 demo rows after rollback | PASS |
| CEO real authentication and gateway | NOT IMPLEMENTED |
| A00 persistence adapter + safe transactional writes | NOT IMPLEMENTED |
| Production protected (không có DDL calls) | PASS phạm vi hành động |

**NEXT (trình CEO):** Thiết kế adapter backend kết nối Supabase private schema với danh tính server, tenant enrollment staging, transactional idempotency và hệ thống CEO Auth G1/G2; sau đó trình duyệt riêng việc kết nối/lưu dữ liệu test thật. Không tự thêm schema/policy/function khi chưa được duyệt.
