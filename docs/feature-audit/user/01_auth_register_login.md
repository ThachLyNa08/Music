# Xác thực & Đăng nhập (Auth & Login)

## 1. Mục đích chức năng
Chức năng này cho phép người dùng (User) tạo tài khoản mới, đăng nhập vào hệ thống, duy trì phiên đăng nhập bằng JWT Token (Access & Refresh Token) và lấy thông tin cá nhân hiện tại. Đây là cửa ngõ đầu tiên để người dùng truy cập vào các tính năng cá nhân hóa của MusicFlow.

## 2. Đối tượng sử dụng
- User: Tác nhân chính (đăng ký, đăng nhập hệ thống).
- Admin: Tác nhân phụ (đăng nhập vào trang quản trị).

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tốt.
- Giải thích: Có đầy đủ frontend, backend API, xử lý JWT an toàn (refresh token), mã hóa mật khẩu với bcrypt, kiểm tra chặt chẽ phân quyền luồng User/Admin, và lưu khởi tạo dữ liệu ban đầu cho Cold Start (sở thích thể loại, nghệ sĩ).

## 4. Luồng xử lý tổng quát
1. Người dùng nhập thông tin đăng nhập/đăng ký trên giao diện.
2. Frontend gọi API qua module `authApi.js`.
3. Backend route `/api/auth/login` hoặc `/api/auth/register` tiếp nhận.
4. `auth.controller.js` kiểm tra dữ liệu, hash password hoặc so sánh password, truy vấn bảng `users`.
5. Tạo cặp JWT (AccessToken & RefreshToken), lưu RefreshToken vào Redis.
6. Backend trả dữ liệu (user, token) về Frontend.
7. Frontend lưu token vào localStorage, cập nhật Pinia store, khôi phục session nhạc và chuyển hướng vào trang chủ hoặc admin dashboard tùy theo role.

## 5. Luồng xử lý chi tiết
- **Trường hợp thành công (Đăng ký):** Lưu thông tin user, thêm vào bảng `user_genre_preferences` và `user_artist_preferences` (Cold Start), khởi tạo các playlist hệ thống tự động, sinh token và trả về thành công.
- **Trường hợp thành công (Đăng nhập):** Tìm user, kiểm tra tài khoản không bị khoá, so sánh bcrypt, cập nhật JWT và Redis cache.
- **Trường hợp lỗi:** Nhập sai email/password trả về 401. Đăng ký trùng email trả về 409. 
- **Trường hợp tài khoản bị khoá:** Status là `locked`, API trả về 403.
- **Trường hợp phiên hết hạn:** Frontend tự động gọi `/api/auth/refresh` bằng RefreshToken. Nếu Token trong Redis đã bị thu hồi hoặc sai, yêu cầu đăng nhập lại.
- **Trường hợp phân quyền:** Nếu tài khoản User cố đăng nhập trang Admin, Frontend sẽ báo lỗi và đẩy về. Tương tự với Admin đăng nhập trang User.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/auth/LoginView.vue
apps/frontend/src/views/auth/RegisterView.vue
apps/frontend/src/stores/auth.js
apps/frontend/src/api/auth.js
apps/frontend/src/router/index.js
```
- `LoginView.vue`: Hiển thị giao diện đăng nhập User, gọi hành động login của store.
- `RegisterView.vue`: Hiển thị giao diện đăng ký đa bước (thông tin cơ bản -> chọn thể loại -> chọn nghệ sĩ).
- `stores/auth.js`: Quản lý state của người dùng, phân quyền (isAdmin), lưu token, gọi API và điều hướng, gọi thêm chức năng khôi phục PlayerSession.
- `api/auth.js`: Chứa hàm gọi Axios tới các endpoint `/api/auth/`.
- `router/index.js`: Navigation guard kiểm tra `requiresAuth`, `requiresAdmin`, chặn truy cập trái phép.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/auth.routes.js
apps/backend/src/controllers/auth.controller.js
apps/backend/src/middleware/auth.middleware.js
```
- `auth.routes.js`: Định nghĩa các endpoint `register`, `login`, `refresh`, `logout`, `me` kèm validation với `express-validator`.
- `auth.controller.js`: Xử lý nghiệp vụ chính, hash mật khẩu, giao tiếp Redis lưu token, transaction tạo dữ liệu ban đầu cho User.
- `auth.middleware.js`: (Suy luận) Middleware `authenticate` kiểm tra và giải mã Access Token trên Header Bearer.

## 8. Vị trí code AI service nếu có
Chức năng này không sử dụng AI service.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/auth/register` | Đăng ký tài khoản | Không | `auth.controller.js` |
| POST | `/api/auth/login` | Đăng nhập hệ thống | Không | `auth.controller.js` |
| POST | `/api/auth/refresh` | Lấy lại token mới từ refresh token | Không | `auth.controller.js` |
| POST | `/api/auth/logout` | Xóa refresh token ở Redis | Có | `auth.controller.js` |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại | Có | `auth.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `users` | Lưu thông tin định danh | Đọc/Ghi | Hash password, lưu role, email |
| `user_genre_preferences` | Lưu sở thích thể loại | Ghi | Khởi tạo khi đăng ký |
| `user_artist_preferences` | Lưu sở thích nghệ sĩ | Ghi | Khởi tạo khi đăng ký |
| `playlists` | Danh sách phát hệ thống | Ghi | Tạo các playlist tự động |

## 11. Realtime / Socket.IO / Redis nếu có
- Có dùng Redis để lưu `refreshToken` theo định dạng key `refresh:{userId}` với TTL 30 ngày. 
- Giúp hệ thống dễ dàng thu hồi phiên đăng nhập mà không cần chờ JWT hết hạn.

## 12. Quyền truy cập và bảo mật
- Password được mã hóa `bcrypt` với cost là 12.
- Token được cấp phát qua `jsonwebtoken` (JWT).
- Route đăng xuất và lấy thông tin `/api/auth/me` được bảo vệ bởi middleware `authenticate`.
- Phân luồng User/Admin chặt chẽ trong frontend Store và Navigation Guard.

## 13. Dữ liệu đầu vào và đầu ra
- Input đăng ký: `email`, `password`, `display_name`, `genre_ids` (mảng >= 3), `artist_ids` (mảng >= 1).
- Input đăng nhập: `email`, `password`.
- Output thành công: `user` object (không có password), `accessToken`, `refreshToken`.

## 14. Loading / Empty / Error state trên giao diện
- Frontend có biến `loading` bật lên khi submit.
- Có Error Banner (animate-shake) hiển thị lỗi khi server báo sai mật khẩu/email.
- Form đăng ký có loading trạng thái khi tìm nghệ sĩ/thể loại và báo lỗi validator.

## 15. Điểm đã làm tốt
- Xử lý JWT Access/Refresh Token kèm Blacklist/Whitelist trên Redis chuẩn chỉ (`auth.controller.js`).
- Database Transaction được dùng khi đăng ký (Tạo user + Preferences + Playlist) để đảm bảo toàn vẹn dữ liệu.
- Phân luồng logic User/Admin rõ ràng ở Frontend (`stores/auth.js`).

## 16. Hạn chế hiện tại
- Chưa có tính năng Quên mật khẩu (Forgot Password) / Reset Password bằng Email.
- Đăng nhập Social (Google, Facebook) chưa triển khai hoặc chưa rõ phần code. (Có route `spotify.routes.js` nhưng cần xác định rõ).

## 17. Đề xuất hoàn thiện
- Thêm chức năng reset mật khẩu qua email OTP hoặc link kích hoạt.
- Hoàn thiện luồng OAuth với Spotify hoặc Google nếu muốn mở rộng social login.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/views/auth/LoginView.vue`
- `apps/frontend/src/views/auth/RegisterView.vue`
- `apps/frontend/src/stores/auth.js`
- `apps/backend/src/routes/auth.routes.js`
- `apps/backend/src/controllers/auth.controller.js`
- `database/schema/musicflow_schema.sql`
