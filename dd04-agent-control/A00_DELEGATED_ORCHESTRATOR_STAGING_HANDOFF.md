# DD04-A00-016/017 — Bàn giao xây lại A00 theo chỉ đạo CEO | 2026-11-15
## Phạm vi
Source: DD04 V5.3, bàn giao 18 Agent ngày 15/11/2026, chỉ đạo ủy quyền CEO mới tại `DD04_DELEGATED_OPERATING_DIRECTIVE_2026-11-15.md`.
Đây là mã nguồn preflight staging-only. Không có API ghi, SQL migration, Netlify runtime mới, quyền phê duyệt thật, Telegram/Zalo gateway thật, hay quyền đăng.
## Kết quả
1. `a00-delegated-orchestrator.mjs`: khung workflow CONTENT/TREND/SALES/COMMUNITY/FINANCE trên 18 vai trò, task phụ thuộc, kiểm chuyển START/SUBMIT/APPROVE/REWORK, chống trùng idempotency, chặn Agent tự APPROVE task của chính mình, khóa A07, dựng danh sách theo dõi từ snapshot.
2. A11 `reviewFinance`: policy phiên bản có tenant/scope/period/currency/VND/evidence; chặn thiếu quyền, thiếu phạm vi, sai tenant, hết hiệu lực, commitment trùng, request đã tồn tại, số vượt safe integer; tính tổng cam kết và yêu cầu hiện tại. Nếu vượt hạn mức, `ESCALATED_TO_CEO`. Không tự tạo hạn mức hay thanh toán.
3. `a00-delegated-gates.mjs`: G1 yêu cầu A00/A02/A11/A09 PASS độc lập; G2 yêu cầu A06/A08/A09/A07 PASS độc lập + G1 hiện hành + asset/caption/schedule/profile hash + quyền đăng đã xác minh; kết quả luôn `executable:false` và `publish_allowed:false`. A07 không tự phê duyệt G2.
4. Test: `dd04-a00-delegated-orchestrator.test.mjs`, `dd04-a00-delegated-gates.test.mjs`. Phải chạy Node test và CI trước khi nghiệm thu.
## Giới hạn cực kỳ quan trọng
- `SERVER_VERIFIED_*` hiện mới là điều kiện hình dạng dữ liệu, KHÔNG có adapter server DB xác thực chữ ký hoặc nguồn dữ liệu. Caller giả mạo có thể tự dựng object. Vì vậy tuyệt đối KHÔNG nối module này thẳng với request bên ngoài; chỉ dùng mã nguồn tách biệt để review.
- Bộ worklist chỉ là tổng hợp snapshot trong bộ nhớ, KHÔNG persistent, không realtime hoặc đa nhân viên. Không được hiển thị là nhiệm vụ thật.
- Workflow mới là scaffold chuyên môn, chưa đủ mọi dependency của 18 Agent; các tác vụ có kênh chưa được fanout N kênh/N script; sẽ cần viết adapter fanout với channel profile immutable.
- Tính tổng A11 mới tin danh sách commitments người gọi truyền vào: trước vận hành cần transaction DB khóa hàng và tính snapshot ledger toàn kỳ/scope; chống race, double-spend, split budget across campaigns, rollback và idempotent server quyết định.
- `ceo-approval-contract.mjs`, `agent-auto-approval-policy.mjs` và các Postgres trigger hiện hữu không sửa. CEO G1/G2 logic cũ sẽ tiếp tục khóa phát hành.
## Kiến trúc DB giai đoạn tiếp, ĐỀ XUẤT — KHÔNG CHẠY
Trước migration cần đọc schema, trigger, unique/index/RLS đầy đủ và tạo SQL review riêng. Dự kiến bổ sung:
- `delegation_policies`: chính sách thẩm quyền active/version/tenant/scope/hạn mức; không cho Agent tự cấp.
- `workflow_instances`, `task_dependencies`, `agent_authority_assignments`: chi tiết điều phối theo campaign/channel, quyền Agent xác thực.
- `task_transition_events`: append-only, idempotency unique, actor/auth/session, evidence/version/hash.
- `finance_commitments`: ledger ngân sách theo tenant/campaign/scope/period, reserve atomic trước chi, aggregate + lock, unique source request; `finance_exceptions`: hàng đợi riêng CEO có status/audit.
- `gate_packets`, `gate_review_events`: evidence bất biến có version/hash, A08/A09/A06 và các reviewer độc lập, mô hình ủy quyền.
Xem xét tái sử dụng `dd04_stage.commands/tasks/task_events/approvals` để không nhân đôi dữ liệu. RLS đúng tenant, hạn chế quyền authenticated/anon, không bỏ trigger hay bypass guard; migration staging cần CEO phê duyệt riêng.
## Bản đồ giao tiếp
CEO lệnh/ảnh/tài liệu → Gateway xác thực → A00 command+task ledger → A01/A02/A12/A13 chiến lược → A03 N kịch bản đúng N kênh → A04/A05 → A08/A09 → A06 → gate packet G2 → A07 quyền hợp lệ → A10/A11 → A14–A17 theo yêu cầu. Ngoại lệ tài chính A11 gửi CEO; lỗi chuyên môn trả Agent ban đầu; A00 theo dõi và audit.
## Nghiệm thu
PASS được phép công bố khi GitHub commit tồn tại. CI cần xác minh riêng; staging DB unchanged. Không được tuyên bố 18 Agent hoạt động, chỉ là phần khung code.
## Hành động tiếp
(1) Node tests+CI, chỉnh lỗi; (2) adapter authoritative server cho roles, evidence, policy và global ledger; (3) UI master worklist đọc staging sau khi có schema; (4) SQL review+RLS+rollback và CEO duyệt riêng staging trước migration; (5) end-to-end thử lỗi chuyển giao, vượt hạn mức, stale hash, cross tenant, bị thu hồi quyền đăng; (6) chỉ sau nghiệm thu mới kích hoạt.
