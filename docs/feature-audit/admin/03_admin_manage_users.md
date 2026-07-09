# Quản lý Người dùng (Admin Manage Users)

## 1. Mục đích chức năng
Trang quản trị cho phép Admin xem danh sách toàn bộ người dùng trên hệ thống, phân trang, lọc theo trạng thái (Active/Banned) hoặc trạng thái gói cước (Premium). Hỗ trợ khóa (khóa mỏm) hoặc cấp quyền cho tài khoản.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện.
- Giải thích: Tại trang Admin, có một Data Table liệt kê ID, Email, Display Name, Role, Status và trạng thái Premium. Có chức năng Search (tìm qua Email/Tên). Có chức năng xuất báo cáo (Export CSV/Excel).

## 4. Luồng xử lý tổng quát
1. **Lấy danh sách (`GET /api/admin/users`):** Truy vấn có phân trang (Pagination), hỗ trợ lọc qua query (VD: `?status=active&role=user&search=abc`).
2. **Khóa/Mở khóa User (`PUT /api/admin/users/:id/status`):** Đổi `status` trong DB từ `active` sang `banned`. Nếu bị Banned, user không thể đăng nhập (Middleware auth sẽ chặn).
3. **Phân quyền (`PUT /api/admin/users/:id/role`):** Đổi `role` từ `user` sang `admin` và ngược lại.
4. **Quản lý Premium thủ công (`PUT /api/admin/users/:id/premium`):** Admin có thể cấp/gia hạn gói Premium thủ công (ví dụ tặng quà, giải quyết khiếu nại).
5. **Tổng quan Overview (`GET /api/admin/users/overview`):** Đếm số user active, banned, tổng số admin.

## 5. Luồng xử lý chi tiết
- **Trường hợp Khóa (Ban) người dùng:** Hệ thống không xóa bản ghi (Hard Delete) mà chỉ đổi status. Điều này để bảo toàn tính toàn vẹn dữ liệu (Referential Integrity) với bảng `listening_history` và `payment_transactions`. Nếu xóa cứng, hệ thống báo cáo doanh thu sẽ bị hỏng.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/ManageUsersView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js (và admin.users.controller.js)
```

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/users`| DS người dùng | Admin | `admin.controller.js`|
| PUT | `/api/admin/users/:id/status`| Khóa (Ban)| Admin | `admin.controller.js`|
| PUT | `/api/admin/users/:id/premium`| Tặng Premium| Admin | `admin.controller.js`|
| GET | `/api/admin/users/export`| Xuất báo cáo| Admin | `admin.controller.js`|

## 10. Database liên quan
- Bảng `users` (Đọc/Ghi).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin`. 
- Cần cẩn thận chống lỗi Admin tự khóa chính mình (hoặc phải có tài khoản Super Admin).

## 13. Dữ liệu đầu vào và đầu ra
- Output list API: `[ { id: 1, email: "...", display_name: "...", role: "admin", status: "active", premium_expires_at: "..." } ]`.

## 14. Loading / Empty / Error state trên giao diện
- Table có Skeleton Loading.

## 15. Điểm đã làm tốt
- Tách bạch các API Update: Thay vì 1 API `PUT /users/:id` khổng lồ, Backend tách thành `/role`, `/status`, `/premium` giúp frontend dễ dàng tạo các Modal nhỏ lẻ gọn gàng và tránh gửi nhầm data.

## 16. Hạn chế hiện tại
- Nếu User bị Banned khi đang online, họ vẫn tiếp tục thao tác được cho đến khi token JWT hết hạn, vì Middleware auth chỉ check JWT Signature (trừ khi có blacklist Redis).

## 17. Đề xuất hoàn thiện
- Thêm cơ chế chặn ngay lập tức (Kick user out): Lưu vào Redis hoặc ở middleware `authenticate` mỗi lần check luôn DB (đánh đổi hiệu suất).

## 18. Bằng chứng mã nguồn đã kiểm tra
Code route có sẵn ở `admin.routes.js`. Lọc và phân trang hỗ trợ ở controller.
