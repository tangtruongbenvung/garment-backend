# DD04-A00-020 — HỒ SƠ TRÌNH CEO PHÊ DUYỆT MIGRATION STAGING RIÊNG

**Ngày:** 15/11/2026  
**Trạng thái:** TRÌNH DUYỆT — CHƯA ĐƯỢC CEO PHÊ DUYỆT  
**Mã quyết định:** DD04-CEO-MIG-A00-020-20261115  
**Chỉ áp dụng:** Supabase project `wbvkqfnrlasmtizjszab`, schema `dd04_stage`.

## 1. Đúng bản SQL đề nghị phê duyệt

- Filename: `dd04-agent-control/supabase/24_A00_020_FINAL_CANDIDATE_STAGING_ONLY_DO_NOT_RUN.sql`
- SHA-256 (raw UTF-8 file): `0b2f684246e7c222e2cf593e6a8c27fac331cf35e1b8704dc91799ee927d2685`
- GitHub branch: `feature/dd04-a00-020-atomic-ledger-handoff`
- Pull request: https://github.com/tangtruongbenvung/garment-backend/pull/6 (draft; **không merge production**).
- Previous SQL 22 has been retired and replaced by a non-executable comment-only tombstone.

**Phạm vi duyệt:** Cho phép apply **một migration cấu trúc + quyền runtime A00-020 vào đúng project staging** sau khi xác nhận tệp và SHA-256 khớp. KHÔNG bao gồm quyền kích hoạt Agent, cấp khóa API chi phí, sửa production, thay G1/G2, đăng Facebook/TikTok, hoặc merge GitHub vào production.

## 2. Những gì migration sẽ tạo hoặc thay đổi

1. Tạo **4 bảng mới** trong `dd04_stage`: `a00_worker_identities`, `a00_workflow_instances`, `a00_task_contexts`, `a00_transition_events`.
2. Tạo `dd04_a00_runtime` **NOLOGIN, NOBYPASSRLS**, chỉ dùng cho backend đã cấp quyền đăng nhập riêng; không cấp mật khẩu hoặc role membership trong migration.
3. Áp dụng RLS cho cả bốn bảng; bổ sung policy có giới hạn tenant/worker-secret cho những bảng DD04 hiện hữu cần đọc/ghi. Không cấp quyền browser/anon/authenticated trực tiếp.
4. Bổ sung các hàm kiểm tra worker, Agent, tenant, subject và capability trong DB, giới hạn EXECUTE.
5. Bổ sung trigger bất biến event, audit bắt buộc trước đổi trạng thái, G1/canonical guard, dual QC A08/A09, báo cáo kiểm duyệt và handoff V5.5 có bằng chứng.
6. Giữ nguyên dữ liệu hiện hữu, không backfill nhiệm vụ cũ, không tạo worker ACTIVE, không đổi G1/G2 hay A07 publishing.

## 3. Bằng chứng kiểm thử an toàn

GitHub Actions **Run 522** (ID `43669796597`) trên PostgreSQL 17 **tạm thời**, KHÔNG phải Supabase staging:

| Hạng mục | Kết quả |
|---|---|
| Node syntax/unit and SQL contract tests | PASS |
| Windows PowerShell parse | PASS |
| PostgreSQL 17 migration SQL parses + applies to isolated baseline | PASS |
| 4 new tables + RLS + role NOLOGIN/NOBYPASSRLS | PASS |
| Trigger và policy hiện diện | PASS |
| Không cấp quyền trực tiếp cho anon/authenticated/service_role lên bảng mới | PASS |
| Worker chưa được provision không đọc được task/không có authority | PASS |
| Baseline G1 PENDING vẫn còn sau migration mô phỏng | PASS |
| Authenticated active-worker, cross-tenant/cancellation/concurrency tests trên Supabase staging | **CHƯA THỰC HIỆN** |
| CEO Deploy Preview worklist có MFA AAL2 | **CHƯA NGHIỆM THU THẬT** |

**Lưu ý:** CI dùng schema fixture mô phỏng và không thay thế thử nghiệm PostgreSQL thực trên staging. SQL hash trên được phát ra bởi CI chính thức, không phải blob SHA của GitHub.

## 4. Trình tự sau khi CEO duyệt migration

1. Đọc lại tệp trên GitHub và tính SHA256; khác một ký tự là STOP.
2. Xác minh project id staging chính xác, kiểm tra migration history chống chạy trùng.
3. Apply migration đúng tên/phạm vi đã duyệt, dùng Supabase migration tool, lưu version/result.
4. Chạy truy vấn hậu kiểm **read-only** tại `25_A00_020_POST_APPROVAL_READ_ONLY_ACCEPTANCE.sql`; lấy số bảng, policy, trigger, quyền anon/authenticated/service_role, danh sách worker.
5. Provision kết nối backend **least-privilege** và worker credentials chỉ qua secret manager/trusted administrator, không qua chat; thử thu hồi và cross-tenant với các danh tính thử nghiệm.
6. Thử lưu task, đăng ký artifact, attach, SUBMIT, A08/A09 QC, REWORK, auto-handoff, idempotency, stale revision, rollback và lỗi giao dịch.
7. Giải quyết riêng **ủy quyền G1 nội bộ có xác thực + A11 tài chính** theo chỉ đạo mới trước khi mở executor; không tự cập nhật bảng `approvals` vì trigger cũ vẫn khóa.
8. Chỉ khi toàn bộ kết quả PASS và giới hạn ngân sách AI được duyệt mới thử A03 -> A04 -> A05, sau đó A08/A09; A07 vẫn yêu cầu G2 CEO và platform entitlement.

## 5. Câu lệnh CEO phê duyệt riêng

> Tôi phê duyệt migration A00-020 chỉ trên Supabase staging project `wbvkqfnrlasmtizjszab`, schema `dd04_stage`, đúng tệp `24_A00_020_FINAL_CANDIDATE_STAGING_ONLY_DO_NOT_RUN.sql` có SHA-256 `0b2f684246e7c222e2cf593e6a8c27fac331cf35e1b8704dc91799ee927d2685`. Cho phép kiểm thử nghiệm thu staging sau migration; chưa cho phép thay đổi production, cấp chi phí API AI hoặc đăng bài.

Nếu CEO không duyệt hoặc SHA không trùng: **STOP**, không migration. Không suy diễn phê duyệt từ yêu cầu “tiếp tục” hoặc từ CI PASS.
