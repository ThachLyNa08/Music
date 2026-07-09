# Hệ thống Xác thực & Token (Auth, JWT, Refresh Token)

## 1. Mục đích chức năng
Bảo mật hệ thống thông qua cơ chế Token-based Authentication. Giúp người dùng duy trì phiên đăng nhập lâu dài (Refresh Token) mà vẫn đảm bảo tính an toàn (Access Token ngắn hạn) và giảm tải cho Database.

## 2. Đối tượng sử dụng
- System (Bảo vệ API).

## 3. Trạng thái triển khai hiện tại
- Đã triển khai cặp Access Token & Refresh Token.
- Hỗ trợ Middleware kiểm tra Token.

## 4. Luồng xử lý tổng quát
1. **Đăng nhập (`POST /api/auth/login`):** Hệ thống kiểm tra mật khẩu. Nếu đúng, cấp 2 loại token:
   - `AccessToken`: Sống ngắn (Vd 15-60 phút), chứa `id, role`, dùng để gọi các API.
   - `RefreshToken`: Sống lâu (Vd 7-30 ngày), lưu vào Database (Bảng `refresh_tokens` hoặc Redis).
2. **Gọi API được bảo vệ:**
   - Frontend gửi Request Header: `Authorization: Bearer <AccessToken>`.
   - Middleware `authenticate` giải mã JWT bằng Secret Key. Nếu hợp lệ -> Cho phép đi tiếp, gán `req.user`. Nếu hết hạn -> Báo lỗi 401 Unauthorized.
3. **Cấp lại Token (Silent Refresh):** 
   - Khi bị 401, Frontend tự động ngầm gửi `POST /api/auth/refresh-token` kèm theo `RefreshToken`.
   - Backend so khớp `RefreshToken` với DB. Nếu khớp và còn hạn, cấp ra `AccessToken` mới. Frontend lấy token mới này gọi lại API vừa thất bại.
4. **Đăng xuất (`POST /api/auth/logout`):** Xóa `RefreshToken` trong DB, vô hiệu hóa phiên bản hiện tại.

## 5. Luồng xử lý chi tiết
- **Trường hợp Token bị Trộm:** Kẻ gian lấy được AccessToken chỉ dùng được 15 phút. Nếu lấy được RefreshToken, người dùng thật có thể bấm "Đăng xuất khỏi thiết bị khác" (Thu hồi toàn bộ RefreshToken trong DB), lúc này hacker gửi RefreshToken lên sẽ bị Backend từ chối.

## 6. Vị trí code frontend
```txt
apps/frontend/src/api/index.js (Axios Interceptors bắt lỗi 401 và gọi Refresh API)
apps/frontend/src/stores/auth.store.js
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/auth.routes.js
apps/backend/src/controllers/auth.controller.js
apps/backend/src/middleware/auth.middleware.js
```

## 8. Vị trí code AI service nếu có
FastAPI không xử lý Auth trực tiếp mà tin tưởng (Trust) Node.js Backend truyền lệnh xuống, hoặc dùng chung JWT Secret để tự Verify.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích |
| ----------- | -------- | -------- |
| POST | `/api/auth/login` | Lấy cặp Token |
| POST | `/api/auth/refresh-token`| Xin lại Access Token |
| POST | `/api/auth/logout` | Hủy Token |

## 10. Database liên quan
- Bảng `refresh_tokens` hoặc lưu thẳng vào `Redis`.

## 11. Realtime / Socket.IO / Redis nếu có
- Socket.IO sử dụng cơ chế Auth Handshake: Client gửi token trong phần `auth: { token: "..." }` khi connect. Middleware Socket sẽ verify JWT.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin` và `requirePremium` dựa trên thông tin payload của JWT (Hoặc query thêm DB để chắc chắn).

## 13. Dữ liệu đầu vào và đầu ra
- Trả về JSON: `{ accessToken: "eyJ...", refreshToken: "..." }`.

## 14. Loading / Empty / Error state trên giao diện
Không có UI trực tiếp, chạy ngầm (Silent).

## 15. Điểm đã làm tốt
- Axios Interceptor ở frontend xử lý lỗi 401 cực kỳ mượt mà. Người dùng hoàn toàn không biết token bị hết hạn, trải nghiệm không bị đứt đoạn.

## 16. Hạn chế hiện tại
- Nếu AccessToken còn hạn nhưng Admin đổi Role (Banned/Giáng cấp), JWT payload vẫn báo là hợp lệ cho tới khi hết phút thứ 15.

## 17. Đề xuất hoàn thiện
- Thêm cơ chế Blacklist token tạm thời bằng Redis cho những tài khoản bị đổi mật khẩu hoặc bị Banned đột xuất.

## 18. Bằng chứng mã nguồn đã kiểm tra
Logic Auth và Token luân chuyển trong Middleware `auth.middleware.js`.
