# DD04 — CHỈ ĐẠO ĐIỀU HÀNH PHÂN QUYỀN (CEO 2026-11-15)
Trạng thái: chỉ đạo nghiệp vụ mới; thiết kế staging; KHÔNG phải xác nhận đã mở khóa DB/G1/G2, KHÔNG triển khai production.
Thay thế định hướng "CEO phê duyệt mọi nhiệm vụ G1/G2" trong bản V5.3 và chính sách V5.4 cũ, đối với *quy trình dự kiến sau khi kiểm thử và được phê duyệt triển khai riêng*. Giữ nguyên mọi khóa đang có cho đến khi chuyển đổi được nghiệm thu.

## 1. Điều hành
- CEO: gửi lệnh, ảnh/tài liệu, yêu cầu, giới hạn ngân sách; quyết định tài chính vượt thẩm quyền đã cấu hình. Không làm công việc phê duyệt nội dung thường nhật.
- A00: xác thực Gateway Telegram/Zalo, cấp command_id/task_id, triệu tập đúng Agent, chia việc, giám sát SLA, xử lý vòng lặp sửa lỗi và ghi nhật ký chung. A00 không tự nâng hạn mức.
- Agent chuyên môn: tự xác nhận công việc thuộc quyền; đầu ra phải đủ evidence/phiên bản/hash và check của người/bộ phận nhận. Không dùng lời tự báo PASS thay bằng chứng.
- Phê duyệt G1 (kế hoạch/phạm vi/budget): nội bộ thông qua khi A00/A02/A11 và kiểm soát áp dụng PASS, ngân sách nằm trong hạn mức chính sách đang ACTIVE, không có legal/policy hold. Vượt hạn mức chuyển CEO, giữ BLOCKED.
- Phê duyệt G2 (sản phẩm cuối/kênh/lịch): đề xuất ủy quyền cho A08 QC + A09 Compliance độc lập + A06 xác minh channel/profile/lịch + A07 kiểm tra quyền đăng; chỉ đủ điều kiện nếu G1 hợp lệ và mọi artifact/caption/hash/revision/channel/schedule khớp. Đổi bất kỳ phần nào thu hồi G2 cũ, duyệt lại. A07 không tự duyệt G2, không đăng khi thiếu quyền API; trường hợp không được ủy quyền hợp lệ phải chuyển nhân sự có quyền.
- CEO không cần duyệt nội dung thường lệ. Quyết định pháp lý, cấp quyền, bảo mật, quyền tài khoản và điều kiện bắt buộc của nền tảng không được tự động vượt qua chỉ vì quy trình nội bộ đã PASS.
- Không thay đổi production, không migration; chỉ bản đặc tả và module preflight không thực thi.

## 2. Bảng phân quyền đề xuất
| Bước | Agent chủ trì | Agent kiểm tra/cấp quyền | Trả về khi lỗi |
|---|---|---|---|
| Nhận lệnh/giao việc | A00 | Gateway auth + policy | A00 |
| Trend | A01 | A02/A09 khi cần | A01 |
| Channel Strategy | A02 | A00 + A11 về budget | A02 |
| Script / reply_library.json | A03 | A08/A09 | A03 |
| Image/character | A04 | A08/A09 | A04 |
| Video | A05 | A08/A09 | A05 |
| Channel/lịch | A06 | A09 + A07 entitlement | A06 |
| Final packet G2 | A00 tổng hợp | A08, A09, A06 độc lập | Chủ tài sản |
| Publishing | A07 | kiểm G2, quyền thật, audit | A00/nhân viên được ủy quyền |
| Intelligence/Finance | A10/A11 | A00, CEO nếu vượt thẩm quyền | Agent phụ trách |
| Sales/CSKH/ANT | A14–A17 | A09, chính sách chống spam | Agent phụ trách |

A12/A13 hỗ trợ nghiên cứu xu hướng A01, A16/A17 chỉ tương tác hợp pháp, không bình luận/tự khen giả.

## 3. Hạn mức và thẩm quyền tài chính
- Chưa có số VND cụ thể. Không tự đặt hạn mức mặc định bằng 0 hay vô hạn để "thông qua".
- Policy phải có policy_id, phiên bản, tenant, chữ ký phê chuẩn hợp lệ, hiệu lực, budget_limit_vnd theo phạm vi/campaign/kỳ, currency=VND, người cấu hình và chứng cứ.
- A11 tính tổng cam kết/đã chi để chặn chia nhỏ lệnh vượt hạn mức; thiếu dữ liệu = BLOCKED, vượt hạn mức = ESCALATED_TO_CEO.
- Không Agent nào được tạo khoản thanh toán, mua công cụ, cấp quyền tài khoản, hoặc chuyển tiền ngoài policy và quyền hợp lệ.

## 4. Danh sách theo dõi chung (master task ledger)
Mọi Agent đọc trạng thái theo quyền tenant; cập nhật qua giao dịch có audit append-only và idempotency, không sửa log cũ.
Bắt buộc: tenant_id, command_id, task_id, campaign_id, channel_id (nếu có), agent_owner, assigned_agents, dependency_ids, task_type, status, priority, deadline, input_refs, input_sha256, output_refs, output_sha256, revision, profile_version, profile_sha256, qa_agent, compliance_agent, approval_authority, approval_policy_version, budget_vnd, committed_budget_vnd, finance_decision, created_at, updated_at, evidence_refs, failure_reason, next_action.
Trạng thái: RECEIVED → PLANNED → ASSIGNED → IN_PROGRESS → INTERNAL_REVIEW → NEEDS_FIX / APPROVED_INTERNAL → READY_TO_PUBLISH → PUBLISHED / HANDED_TO_HUMAN; BLOCKED / ESCALATED_TO_CEO / CANCELLED là nhánh ngoại lệ.
Mỗi sự kiện: event_id, task_id, from_state, to_state, actor, actor_role, transition_reason, evidence_hash, server_timestamp, idempotency_key.
A00 lưu biên bản điều phối, cung cấp danh sách việc cần xử lý; CEO chỉ thấy hàng đợi tài chính ngoại lệ + báo cáo tổng hợp, vẫn có quyền xem toàn bộ audit.

## 5. Ranh giới bảo mật & chuyển đổi tương thích
Các tệp hiện hành `ceo-approval-contract.mjs`, `agent-auto-approval-policy.mjs` (G2 CEO_ONLY), transaction plan và trigger `dd04_approval_guard` vẫn phản ánh cơ chế cũ; **KHÔNG sửa/bypass trực tiếp** trong đợt cập nhật chỉ đạo.
Trước khi áp dụng: (1) phân quyền Agent với chứng cứ server; (2) xác định chính sách hạn mức tài chính; (3) thiết kế atomic G1/G2 decision + audit/RLS; (4) test cross-tenant, forged PASS, stale hash/revision, self-approval, thiếu quyền đăng, vượt budget, click lặp, đổi kênh/lịch; (5) trình duyệt riêng migration và cấu hình staging; (6) chạy nghiệm thu staging. Không dùng claim tự khai của Agent làm bằng chứng độc lập.

## 6. A01 áp dụng
A01 thu thập nguồn hợp pháp, research pack, concept và channel-fit có profile version/hash. A02 rà soát chiến lược; A09 rà tuân thủ; A00 tiếp nhận task ledger và điều phối A03. A01 không được tự công bố xu hướng chưa xác minh là kết quả thật.

## 7. Tình trạng hiện tại
PASS: tài liệu chỉ đạo mới được lưu trong feature branch.
PENDING: CI, các policy preflight mới, DB, API, gateway, ledger thực, đồng bộ A00/A01/A02 và quyền publish; không gọi là đã vận hành.
