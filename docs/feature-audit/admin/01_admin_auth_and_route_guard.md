# Route Guard và Bảo mật Admin (Admin Auth & Route Guard)

## 1. Mục đích chức năng
Bảo vệ khu vực quản trị (Admin Panel) khỏi những truy cập trái phép. Đảm bảo chỉ những người dùng có phân quyền (role = 'admin') mới có thể vào các trang cấu hình, xem dashboard và thay đổi dữ liệu hệ thống.

## 2. Đối tượng sử dụng
- Admin: Người quản trị truy cập.
- System: Tự động chặn các Request từ User thường.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện và tích hợp toàn diện trên cả Frontend và Backend.
- Giải thích: Ở Frontend, Vue Router sử dụng `beforeEach` (Navigation Guard) để kiểm tra role trước khi load component. Ở Backend, Express Router sử dụng middleware `requireAdmin` chặn mọi API bắt đầu bằng `/api/admin`. 

## 4. Luồng xử lý tổng quát
1. **Frontend Guard:** Khi người dùng nhập URL `/admin/...` vào trình duyệt, Vue Router kích hoạt Navigation Guard.
2. **Kiểm tra Store:** Guard lấy trạng thái user từ Pinia `auth` store.
3. **Quyết định (Frontend):**
   - Nếu chưa đăng nhập: Chuyển hướng về `/login` kèm theo tham số `redirect`.
   - Nếu đã đăng nhập nhưng role không phải `admin`: Chuyển hướng về trang chủ `/` (hoặc hiển thị trang 403 Forbidden).
   - Nếu là `admin`: Cho phép render component Admin.
4. **Backend Guard:** Khi Frontend gọi bất kỳ API nào thuộc `admin.routes.js`.
5. **Kiểm tra Token & Role:** Middleware `authenticate` giải mã JWT lấy `userId`. Middleware `requireAdmin` query DB hoặc lấy role từ token.
6. **Quyết định (Backend):** 
   - Nếu role khác `admin`: Trả về `HTTP 403 Forbidden` (`message: 'Yêu cầu quyền quản trị'`).

## 5. Luồng xử lý chi tiết
- **Trường hợp Đổi Role đột ngột:** Nếu admin đang thao tác nhưng bị một super-admin khác giáng cấp xuống user thường trong DB. Token JWT vẫn còn hạn nhưng khi gọi API hệ thống sẽ lấy dữ liệu mới nhất (hoặc token cũ chứa role cũ). Ở dự án này, `requireAdmin` cần kiểm tra role thực tế trong Database thay vì chỉ tin tưởng vào JWT payload để tránh rủi ro bảo mật (Insecure Direct Object Reference).

## 6. Vị trí code frontend
```txt
apps/frontend/src/router/index.js
apps/frontend/src/layouts/AdminLayout.vue
```
- `router/index.js` cấu hình meta `requiresAdmin: true`.
- `AdminLayout.vue` hiển thị sidebar chuyên dụng cho Admin, khác biệt hoàn toàn với `UserLayout`.

## 7. Vị trí code backend
```txt
apps/backend/src/middleware/auth.middleware.js
apps/backend/src/routes/admin.routes.js
```
- `auth.middleware.js`: Xuất hàm `requireAdmin`.
- `admin.routes.js`: Tất cả các routes đều bị khóa lại ở dòng đầu tiên: `router.use(authenticate, requireAdmin);`.

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan
Không có API xử lý trực tiếp, chức năng này hoạt động dưới dạng Middleware bảo vệ các API khác. 

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `users` | Xác định quyền | Đọc | Cột `role` ('admin', 'user') |

## 11. Realtime / Socket.IO / Redis nếu có
Không áp dụng.

## 12. Quyền truy cập và bảo mật
- Đây chính là chốt chặn bảo mật quan trọng nhất của hệ thống quản trị. Ngăn chặn triệt để lỗ hổng Broken Access Control (BAC).

## 13. Dữ liệu đầu vào và đầu ra
- Input: Request Header chứa `Authorization: Bearer <Token>`.
- Output: Gọi `next()` nếu pass, hoặc trả JSON Error 403 nếu rớt.

## 14. Loading / Empty / Error state trên giao diện
- Frontend: Không hiển thị loading, quá trình check route diễn ra chớp nhoáng ở client-side. Nếu lỗi trả về trang 403 "Bạn không có quyền truy cập".

## 15. Điểm đã làm tốt
- Áp dụng triệt để "Defense in Depth" (Bảo vệ nhiều lớp). Chặn ở Frontend để tăng trải nghiệm (không load thừa UI), chặn ở Backend để đảm bảo bảo mật tuyệt đối (chống dùng Postman gọi API lậu).
- Thiết kế layout admin tách biệt.

## 16. Hạn chế hiện tại
- Không có hệ thống phân quyền chi tiết (RBAC) cho Admin. Chỉ có 2 mức: User và Admin. Mọi admin đều có quyền tối cao giống nhau (quản lý cả thanh toán, sửa xóa bài hát, khóa user).

## 17. Đề xuất hoàn thiện
- Mở rộng RBAC: Thêm các role như `content_manager` (chỉ sửa bài hát), `support` (chỉ xem lịch sử thanh toán).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/routes/admin.routes.js`
- `apps/frontend/src/router/index.js` (logic meta)
