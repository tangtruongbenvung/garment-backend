# DD04-A00-007 — MIGRATION V2 / CEO REVIEW PACK
**Ngày:** 14/11/2026  
**Trạng thái:** DRAFT — CHƯA PHÊ DUYỆT CHẠY SQL; KHÔNG MIGRATION  
**Target dự kiến:** \`ducduy-ai-os-dd04-staging\` (\`wbvkqfnrlasmtizjszab\`)  
**Project cần bảo vệ:** \`ykhrtrvstymfjnzdgzna\` — tuyệt đối không chạy bản DD04 V2 tại đây.

## 1. Bằng chứng đầu vào đã xác minh
- Supabase project staging độc lập đã tạo và ACTIVE_HEALTHY, PostgreSQL 17.11, \`public\` chưa có bảng ứng dụng, migration history rỗng tại kiểm tra trước.
- Project cũ chứa 39 bảng public của DD-03/DD-08/DD-10; 39 bật RLS. Không dùng lại data, auth.users, service_role key hay các hàm \`dd_is_ceo()\` cũ.
- Mã V1 ở \`02_DRAFT_MIGRATION_DO_NOT_RUN.sql\` là nguồn so sánh, không phải migration được duyệt.
- Hợp đồng input A00 trong \`persistence-contract.mjs\`; A00 runtime vẫn dùng Netlify Blobs theo deploy, chưa liên kết Supabase.

## 2. Bộ hồ sơ
- \`04_MIGRATION_V2_REVIEW_ONLY.sql\`: bản DDL V2 (7 bảng, chỉ lưu GitHub, không được hệ thống tự chạy).
- \`05_READ_ONLY_PRECHECK_V2.sql\`: truy vấn chỉ đọc để xác minh trước khi chạy.
- \`tests/dd04-schema-v2.test.mjs\`: kiểm thử tĩnh về số bảng, RLS, quyền, chống trùng và cơ chế khóa phê duyệt.
- Tất cả các đường dẫn nằm trong feature branch \`feature/dd04-agent-dashboard-3d\`, Draft PR #1.

## 3. Bảy bảng
| Bảng | Mục đích | Khóa và kiểm soát |
|---|---|---|
| \`commands\` | Lệnh gốc A00, thời điểm, nguồn, input hash | composite PK tenant/command; unique tenant/source/external_id |
| \`tasks\` | Công việc A00–A17, phụ thuộc, phiên bản, QC | composite FK cùng tenant/command; trạng thái chờ G1 ban đầu |
| \`task_events\` | Lịch sử sự kiện, actor, before/after, evidence | append-only trigger (chặn UPDATE/DELETE thông thường) |
| \`approvals\` | G1/G2, nội dung/hash, kênh/lịch, CEO | PENDING mặc định, không mở đổi quyết định cho tới khi Auth đủ chuẩn |
| \`artifacts\` | Manifest file/asset theo version/hash | không ghi đè version cũ |
| \`agent_memories\` | Kiến thức có nguồn, confidence và người duyệt | PENDING; chưa tự coi là VERIFIED |
| \`capability_versions\` | Kỹ năng Agent, benchmark, lịch sử phát triển | PROPOSED; chưa tự coi là APPROVED |

## 4. Các chốt an toàn
1. **Tách tenant:** mỗi command/task/event/artifact/approval mang \`tenant_id\`; quan hệ task và artifact dùng composite FK nhằm chống tham chiếu chéo tenant/command. Root tenant được xác thực/bảo đảm từ backend staging riêng, chưa có bảng company thứ 8; bước sau phải thiết kế tenant bootstrap trước khi ghi thật.
2. **Chống trùng:** \`unique(tenant_id,source,external_id)\` trong DB; kết hợp transaction khi viết API thật. Chưa có adapter transactional trong V2.
3. **G1/G2:** schema thiết kế hash và nhân sự duyệt, nhưng **không tự nhận đã xác thực CEO**. Để tránh sai quyền, triggers CHẶN cập nhật trạng thái command/task và duyệt G1/G2 cho tới khi migration bổ sung Auth+RPC kiểm duyệt riêng được CEO phê duyệt.
4. **Audit/artifact:** trigger chống UPDATE/DELETE của event và asset manifest; quyền owner/superuser vẫn có thể chỉnh DDL, nên chưa tuyên bố tamper-proof tuyệt đối.
5. **Private schema:** \`dd04_stage\` không nằm trong exposed API schemas; thu hồi schema/table/sequence/function privileges từ PUBLIC/anon/authenticated, RLS enabled cho cả 7 bảng, không tạo permissive policy.
6. **Memory/skills:** trí nhớ mặc định PENDING và năng lực mặc định PROPOSED, không tự động thăng cấp, không train lại model.
7. **Dữ liệu:** migration này không di chuyển dữ liệu cũ, không copy \`auth.users\`, không ghi token/key trong SQL.

## 5. Acceptance gates (chưa hoàn tất cho phép migration)
- [x] Bản thiết kế V2 với 7 bảng + chốt bảo mật viết trên GitHub riêng.
- [x] Tạo bộ kiểm thử tĩnh CI.
- [ ] CEO phê duyệt riêng **chạy SQL Migration V2** trên đúng project ref \`wbvkqfnrlasmtizjszab\`.
- [ ] Kiểm tra live \`public\` không có dữ liệu DD04, \`dd04_stage\` chưa có, migration chưa chạy ngay trước thực thi.
- [ ] Lên kế hoạch backup/restore; staging đang rỗng nhưng vẫn cần checkpoint pre/post và cách thu hồi.
- [ ] SQL được parse/thử bằng PostgreSQL staging cô lập có quyền hợp lệ; unit tests tĩnh không chứng minh DDL có thể apply.
- [ ] Post-execution verify đúng 7 bảng, RLS, privilege, trigger, 0 policies công khai; Supabase Security Advisor.
- [ ] Test anon/authenticated bị từ chối; service-only chính sách backend được kiểm soát; attempt giả danh CEO/G1/G2 bị chặn.
- [ ] API A00 chuyển sang adapter giao dịch bền vững trong bước riêng, không lấy dữ liệu demo làm KPI thật.

## 6. Quy trình thực thi đề xuất SAU KHI CEO duyệt (chưa thực hiện)
A. Kiểm tra chính xác target ID bằng Supabase project list và check tên + URL. Đối chiếu current Project ID tránh nhầm. Chạy riêng SELECT preflight.  
B. Chốt backup/checkpoint, kiểm soát quyền migration, review chính xác commit SHA của file V2.  
C. Dùng cơ chế \`apply_migration\` theo khuyến nghị công cụ, chỉ vào project staging ID được duyệt, đặt migration name có phiên bản, một lần, tránh apply lặp.  
D. Xác minh metadata/triggers/RLS và các phép thử DML âm tính trong **staging**. Không deploy runtime A00 sang Supabase chỉ vì DDL đã áp dụng.  
E. Nghiệm thu CEO; lập biên bản PASS/FAIL; nếu fail thì dừng tích hợp, rà soát đối tượng đã tạo và thực hiện rollback đã được phê duyệt.

## 7. Kế hoạch khôi phục / rollback (thiết kế, chưa chạy)
- Vì target staging hiện không có dữ liệu ứng dụng, phương án an toàn nhất khi DDL thất bại là dừng mọi API ghi, đánh giá từng đối tượng mới trước khi xóa. Không dùng \`DROP SCHEMA CASCADE\` tự động.
- Bản DDL có \`BEGIN/COMMIT\`; lỗi trước commit thông thường rollback toàn transaction. Trường hợp đã commit phải có phê duyệt cho thao tác xóa **chỉ trên project staging**.
- Ghi commit SHA, timestamp, số bảng, RLS/policies, linter trước và sau. Sao lưu cấu hình/env riêng không chứa secret trong log.
- Không tái sử dụng khóa API production và không thay đổi site \`ducduy\`.

## 8. Quyết định xin CEO (tách khỏi phê duyệt thiết kế)
> Đề nghị CEO duyệt nội dung bản Migration V2 và chỉ sau khi nghiệm thu kế hoạch kiểm thử/khôi phục, cho phép riêng việc APPLY V2 lên project \`wbvkqfnrlasmtizjszab\`. Cho đến khi có quyết định rõ ràng, TRẠNG THÁI = DO NOT EXECUTE.

**Kết luận:** DDL V2 + review pack đủ để trình duyệt mã nguồn, **chưa đủ để tuyên bố migration thành công, RLS đã chạy, hay A00 sử dụng cơ sở dữ liệu lâu dài**.
