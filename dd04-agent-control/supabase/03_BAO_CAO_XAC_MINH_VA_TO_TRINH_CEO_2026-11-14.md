# DD04-A00-006 · BIÊN BẢN XÁC MINH SUPABASE VÀ TỜ TRÌNH CEO

**Ngày rà soát:** 14/11/2026
**Phạm vi:** Supabase metadata / read-only SQL. Không thay đổi database, migration, RLS hoặc production.
**Tình trạng:** PASS kiểm tra danh mục + schema/RLS metadata; BLOCKED migration vì chưa có staging độc lập.

## 1. Phạm vi nguồn bằng chứng

- Supabase connector `list_projects`, `get_project`, `list_branches`, `list_tables`, `list_migrations`, `execute_sql` chỉ SELECT metadata, `get_advisors(security)`.
- GitHub repository `tangtruongbenvung/garment-backend`, nhánh `ducduy-ai-os-development`, file `dd-config.js`: publishable key đã được đối chiếu **khớp** dự án Supabase duy nhất được trả về. Không ghi lại khóa trong báo cáo này.
- Chưa thử làm người dùng anon/authenticated; chưa kiểm thử chính sách quyền bằng session thực; chưa xác minh toàn bộ quyền ngoài tài khoản connector.

## 2. Nhận diện môi trường

| Hạng mục | Kết quả |
|---|---|
| Projects có quyền xem | 1 |
| Project name | tangtruongbenvung's Project |
| Project ref | `ykhrtrvstymfjnzdgzna` |
| Organization ref | `auxsjxzbyxfprexqrnvg` |
| Region | `ap-northeast-1` |
| Status | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.6 |
| Supabase development branches | 0 |
| Branch staging độc lập | KHÔNG CÓ TRONG DANH SÁCH |
| Project staging độc lập | KHÔNG CÓ TRONG DANH SÁCH CONNECTOR HIỆN TẠI |
| Đang được ứng dụng hiện có tham chiếu | CÓ (khớp publishable key trong GitHub) |

**Kết luận kiểm soát:** Dự án hiện hữu phải coi là dữ liệu đang phục vụ ứng dụng, không được thử migration. Không tuyên bố project là production tuyệt đối chỉ từ tên gọi hoặc key.

## 3. SQL metadata / RLS

- 39 bảng thường/partition trong schema `public`; **39 bật RLS**, 0 tắt RLS.
- Không tồn tại schema `dd04_stage`; không có bảng `dd04_commands`, `dd04_tasks`, `dd04_task_events`, `dd04_approvals`, `dd04_agent_memories`, `dd04_capability_versions`, `dd04_artifacts`.
- Các bảng hiện có trùng chức năng một phần: `dd_agents` (12 hàng, theo summary list_tables), `dd_user_roles`, `dd_approval_requests`, `dd_audit_logs`, `dd08_tasks`.
- Quyền select tại catalog: `anon=false`, `authenticated=true` cho 5 bảng trên. RLS vẫn quyết định hàng dữ liệu; không suy diễn authenticated có quyền thấy mọi hàng.
- Policies:
  - `dd_agents`: `SELECT` cho authenticated với `dd_is_any_member()`.
  - `dd_user_roles`: `SELECT` cho user tự đọc hoặc CEO của công ty.
  - `dd_approval_requests`: `SELECT` người yêu cầu hoặc CEO; không tìm thấy policy ghi trong khảo sát public.
  - `dd_audit_logs`: CEO của company được `SELECT`.
  - `dd08_tasks`: `SELECT/INSERT/UPDATE` gắn khách hàng và actor; KHÔNG phù hợp sử dụng lại để lưu nhiệm vụ AI không có customer_id.
- Helpers `dd_is_ceo`, `dd_is_member`, `dd08_is_ceo`, `dd08_is_staff`: `SECURITY DEFINER=true`, anon execute=false, authenticated execute=true. Cần review logic trước khi reuse.

## 4. Security Advisors (chỉ cảnh báo, chưa xác minh exploit)

- 3 bảng RLS bật nhưng không policy: `dd08_integration_events`, `dd08_sku_mappings`, `dd10m_doc_counters`.
- 8 hàm SECURITY DEFINER mà `anon` có EXECUTE; 25 cảnh báo role authenticated. Không chỉnh sửa dự án hiện hành. Rà soát riêng theo tác động ứng dụng.
- Linter docs:
  - https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  - https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## 5. Đối chiếu 7 bảng thiết kế DD-04

| DD-04 đề xuất | Bảng liên quan đã có | Kết luận |
|---|---|---|
| commands | Không có bảng lệnh Agent | Cần tạo mới riêng staging |
| tasks | dd08_tasks (CRM) | Không dùng chung; thiếu khái niệm Agent, phụ thuộc và evidence |
| task_events | dd_audit_logs chung | Cần event log trạng thái riêng; tránh ghi audit giả |
| approvals | dd_approval_requests | Quy tắc G1/G2, hash asset, kênh và lịch chưa tương đương |
| artifacts | Không có bảng manifest tương đương | Cần mới |
| agent_memories | Không có bộ nhớ Agent đã kiểm chứng | Cần mới |
| capability_versions | dd_agents (12 bản ghi agent cũ) | Cần nâng 18 hồ sơ Agent + version/benchmark riêng |

## 6. Những chỉnh sửa BẮT BUỘC trước khi cho phép chạy bản DDL draft

Bản nháp `02_DRAFT_MIGRATION_DO_NOT_RUN.sql` chỉ là đề xuất, **chưa được duyệt**. Cần bổ sung:
1. Tenant/company scope (company_id) có FK/nguồn danh tính hợp lệ trong staging độc lập; không trỏ trực tiếp tới UUID công ty từ DB cũ.
2. Kiểm tra G1/G2 bằng identity thực thay cho `DD04_A00_PREVIEW_TOKEN`. Token operator không phải chứng thực CEO.
3. Unique index cho idempotency, transaction-safe command/task/event/approval insert; xử lý retry và thao tác đồng thời.
4. Event log append-only tại DB, không chỉ quy ước UI; policy retention và backup/restore.
5. Enforce FK cùng company trên quan hệ command-task-artifact; cấm cross-tenant reference.
6. Tách Data API exposed schemas khỏi private schema, tối thiểu quyền; kiểm thử `anon`, user khác company, staff, CEO.
7. Chốt công thức trạng thái, retry, dead-letter, QC evidence; `DONE` chỉ sau QC hợp lệ.
8. Có migration đã review, rollback, test và bằng chứng trước khi chuyển adapter A00 sang database mới.

## 7. Phương án staging được đề xuất

**Ưu tiên: Tạo Supabase project riêng cho DD-04 staging**, đặt tên gợi ý `ducduy-ai-os-dd04-staging`, không copy dữ liệu công ty thật và không dùng lại service_role key/connection string từ project cũ.

Một database branch cũng là lựa chọn, nhưng nằm dưới vòng đời dự án hiện có và có rủi ro nhầm merge/reset; với yêu cầu độc lập và tránh ảnh hưởng production, project tách biệt dễ kiểm soát hơn.

**Không tạo project hay branch trong lượt rà soát này.** Chỉ thực hiện sau khi kiểm tra chi phí theo organization và CEO chấp thuận nếu có phát sinh.

## 8. Phiếu quyết định CEO — HAI cổng riêng

### Giai đoạn A: Hạ tầng staging
- **Đề nghị CEO phê duyệt về mặt nguyên tắc** tạo một project Supabase staging độc lập.
- Điều kiện trước hành động tạo: kiểm tra báo giá chi phí thực tế của organization, CEO xác nhận đồng ý mức phí, chỉ tạo trong organization được xác nhận.
- Không tự ý triển khai schema.

### Giai đoạn B: Migration DD-04
- **Chưa đề nghị phê duyệt thực thi migration ngay**.
- Trình CEO bản migration V2 sau khi có project staging, có schema/review, kiểm thử quyền, migration/rollback và dry-run; cần CEO phê duyệt riêng việc chạy migration.
- Cấm chạy SQL draft hiện tại trên `ykhrtrvstymfjnzdgzna`.

## 9. PASS/FAIL/NEXT
| Hạng mục | Trạng thái |
|---|---|
| Xác minh các project Supabase hiện thấy | PASS |
| Truy vấn schema/RLS metadata | PASS |
| So sánh DD-04 với DB hiện hữu | PASS |
| Xác minh staging độc lập | FAIL — chưa có trong phạm vi kết nối |
| Migration DD-04 | NOT RUN, đang CHỜ CEO phê duyệt riêng |
| Kết nối A00 với Supabase dài hạn | BLOCKED |
| Next | Chốt project staging độc lập + chi phí, thiết kế DDL V2, trình CEO duyệt migration |

**Không có thay đổi dữ liệu, bảng, quyền, migration, production trong quá trình kiểm tra.**
