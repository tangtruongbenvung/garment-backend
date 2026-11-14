# DD04-A00-007 — Biên bản thực thi Migration V2 lần 1 (FAIL / ROLLED BACK)

**Ngày:** 14/11/2026  
**Phê duyệt CEO:** Chỉ Migration V2 trên project Supabase staging `wbvkqfnrlasmtizjszab`, không thay đổi production.  
**Project đang bảo vệ:** `ykhrtrvstymfjnzdgzna` — KHÔNG được thực thi ở đây.

## 1. Kiểm tra trước thực thi
- Supabase staging: `ACTIVE_HEALTHY`, tên `ducduy-ai-os-dd04-staging`, PostgreSQL 17.11.
- Các bảng ứng dụng trong `public` / `dd04_stage`: 0; migration history: 0.
- Supabase Security Advisor: 0 lints.
- Nguồn SQL V2 lúc gọi: GitHub blob SHA `76517ada9dccd1d3e53ab0495cd5d30c2ea99a5c`, 7 bảng, BEGIN/COMMIT.
- Tên migration đã gửi: `dd04_a00_v2_private_7_tables_g1_locked`.

## 2. Kết quả
- Lệnh Supabase `apply_migration`: **FAIL**.
- PostgreSQL lỗi `42601`: `syntax error at or near "$"`, vị trí khai báo hàm `guard_command_state`.
- Nguyên nhân phát hiện khi đọc lại SQL: 4 cặp dollar-quote bị viết `$` thay vì `$$` trong các hàm trigger (4 opening và 4 closing).
- **Dừng thực thi tại đây**; không thử chạy lại SQL tự động.

## 3. Bằng chứng an toàn sau lỗi
- `list_tables` staging `public` và `dd04_stage`: **[]**.
- `list_migrations`: **[]**.
- `information_schema / pg_namespace` xác nhận không tồn tại `dd04_stage`; `public` có **0 bảng ứng dụng**.
- Như vậy PostgreSQL không ghi nhận schema/tables/migration từ lần gọi thất bại.
- Project hiện hữu không được gọi DDL, chỉ staging ID đã phê duyệt là đích apply.

## 4. Sửa mã nguồn CHƯA thi hành
- Commit `42087ec7528d1fe19f1766f84885f8c3c62953a6`: thay 4 cặp delimiter PL/pgSQL thành `$$`.
- Bổ sung kiểm thử CI kiểm đếm 8 cặp dollar-quote để ngăn lỗi tương tự.
- Mã V2 được cập nhật trong cùng file review-only nhưng là **nội dung đã thay đổi so với lần thực thi đầu**, vì vậy **cần CEO phê duyệt lại việc thử APPLY bản sửa** sau khi xem bằng chứng CI.
- Không có migration V2 đã chạy thành công. Dashboard A00 hiện vẫn dùng Netlify Blobs, không phải Supabase.

## 5. Điều kiện để thử lại
1. CI test SQL static PASS cho commit cuối.
2. Project staging vẫn `ACTIVE_HEALTHY`, 0 bảng DD04, 0 migrations.
3. CEO duyệt riêng thử lại SQL V2 đã sửa dollar-quote, chỉ trên `wbvkqfnrlasmtizjszab`.
4. Sau khi thực thi thành công mới kiểm tra 7 tables, RLS/policies, ACL, trigger guards, linter và quyền anon/authenticated.
