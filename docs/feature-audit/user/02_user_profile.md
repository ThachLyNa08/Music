# Hồ sơ cá nhân (User Profile)

## 1. Mục đích chức năng
Chức năng này cho phép người dùng xem và quản lý thông tin cá nhân của mình, bao gồm: đổi tên hiển thị, cập nhật ảnh đại diện (avatar), viết tiểu sử (bio). Ngoài ra trang hồ sơ còn tổng hợp các số liệu thống kê như thời gian nghe nhạc, danh sách các bài hát/nghệ sĩ/thể loại nghe nhiều nhất, các playlist công khai và nghệ sĩ đang theo dõi.

## 2. Đối tượng sử dụng
- User: Xem và chỉnh sửa hồ sơ cá nhân của mình. Xem hồ sơ công khai của người khác.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tốt.
- Giải thích: Frontend đã xử lý giao diện Profile rất phong phú (UI cao cấp, có blur background). Backend API đầy đủ cho việc lấy số liệu thống kê phức tạp (từ listening_history), playlist công khai, nghệ sĩ theo dõi và cả upload avatar. Dữ liệu chạy hoàn chỉnh bằng SQL query.

## 4. Luồng xử lý tổng quát
1. Frontend truy cập `/profile`.
2. Frontend gọi API `/api/users/me/profile`.
3. Backend `user.controller.js` sẽ tổng hợp dữ liệu từ bảng `users`, `listening_history`, `playlists`, `artist_follows` qua hàng loạt query SQL tối ưu.
4. Trả về JSON chứa: user info, stats, top_genres, top_artists_month, top_tracks_month, recently_played, public_playlists.
5. Khi User đổi Avatar, Frontend gọi API POST `/api/users/me/avatar` đính kèm file formData.
6. Backend lưu file (qua upload middleware) vào thư mục `uploads/images/` và lưu đường dẫn vào DB.

## 5. Luồng xử lý chi tiết
- **Trường hợp xem hồ sơ chính mình:** Sử dụng token hiện tại để gọi `getFullProfile`. Các số liệu thời gian nghe (tháng này, tất cả) có thể lọc theo `time_range`.
- **Trường hợp cập nhật ảnh:** Backend `upload.middleware.js` nhận file (giới hạn định dạng), lưu thư mục và gán biến `req.file`. Controller cập nhật bảng `users`.
- **Trường hợp xem hồ sơ người khác (`/users/:id`):** Gọi API `getPublicProfile`. Controller chỉ trả về playlist có `is_public = 1` và danh sách followed_artists (không có lịch sử nghe nhạc).
- **Trường hợp lỗi:** Không tìm thấy user (404), File không hợp lệ (400).
- **Trường hợp chưa đủ dữ liệu nghe nhạc:** Giao diện hiển thị trạng thái "Chưa đủ dữ liệu thể loại. Hãy nghe thêm nhạc!".

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/profile/ProfileView.vue
apps/frontend/src/views/user/PublicUserProfileView.vue
apps/frontend/src/components/profile/EditProfileModal.vue
```
- `ProfileView.vue`: Hiển thị Dashboard toàn diện của User, chia các section (Hero banner, Thống kê, Bài hát hàng đầu, Nghệ sĩ theo dõi).
- `PublicUserProfileView.vue`: (Suy luận qua Router) Giao diện hồ sơ khi xem user khác.
- `EditProfileModal.vue`: Popup cập nhật bio, tên hiển thị và up ảnh avatar mới.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/user.routes.js
apps/backend/src/controllers/user.controller.js
apps/backend/src/middleware/upload.middleware.js
```
- `user.routes.js`: Định nghĩa các endpoint `/me/profile`, `/me/avatar`, `/:id/public-profile`...
- `user.controller.js`: Xử lý cực kỳ nhiều SQL query (sử dụng Window Functions, CTE) để tổng hợp `stats`, `topTracks`, `topArtists` từ `listening_history`.
- `upload.middleware.js`: (Cấu hình multer) xử lý multipart/form-data.

## 8. Vị trí code AI service nếu có
Chức năng này không sử dụng AI service.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/users/me/profile` | Lấy dữ liệu profile đầy đủ & stats | Có | `user.controller.js` |
| PUT | `/api/users/me/profile` | Sửa bio, name | Có | `user.controller.js` |
| POST| `/api/users/me/avatar` | Upload ảnh đại diện | Có | `user.controller.js` |
| GET | `/api/users/me/recently-played` | Lịch sử nghe nhạc mở rộng | Có | `user.controller.js` |
| GET | `/api/users/:id/public-profile` | Xem hồ sơ công khai của user khác | Có | `user.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `users` | Lấy và cập nhật avatar, bio | Đọc/Ghi | Cột bio được kiểm tra auto-add nếu thiếu |
| `listening_history` | Tổng hợp thời gian nghe, top bài/thể loại | Đọc | Lọc theo user, sort DESC, group by |
| `playlists` | Lấy playlist công khai | Đọc | Điều kiện is_public = 1 |
| `artist_follows` | Lấy danh sách nghệ sĩ user theo dõi | Đọc | JOIN với bảng artists |

## 11. Realtime / Socket.IO / Redis nếu có
Chức năng này chưa phát hiện sử dụng Socket.IO. Không cache Redis API profile để đảm bảo số liệu real-time chính xác.

## 12. Quyền truy cập và bảo mật
- Mọi route đều yêu cầu `authenticate`. API Public Profile có chặn truy cập nếu user không có token hợp lệ.
- File upload được giới hạn qua middleware (thường là filter định dạng `.jpg`, `.png`).
- Bảo mật quyền truy cập: Một user không thể sửa `bio`/`avatar` thông qua API của user khác (API lấy ID trực tiếp từ `req.user.id`).

## 13. Dữ liệu đầu vào và đầu ra
- API `PUT profile`: `name`, `bio`.
- API `POST avatar`: `multipart/form-data` chứa file `avatar`.
- Output: Trả về Object `{ stats, top_genres, top_artists_month, ... }` khổng lồ gộp chung (aggreation).

## 14. Loading / Empty / Error state trên giao diện
- Có vòng xoay spinner cho trạng thái loading.
- Có Error state màu đỏ, nút Retry nếu lỗi mạng.
- Khi User không có avatar, hiển thị thẻ màu fallback có chữ cái đầu tiên (e.g. `U`).
- Xử lý thiếu data (Empty State) cho thể loại bằng thẻ p "Chưa đủ dữ liệu thể loại...".

## 15. Điểm đã làm tốt
- Tận dụng CTE và Window Function trong MySQL để truy vấn phân nhóm (lấy danh sách mới nhất) cực kỳ hiệu quả thay vì logic nặng ở backend.
- UI Frontend được thiết kế theo phong cách glassmorphism sang trọng, mượt mà.

## 16. Hạn chế hiện tại
- Phân trang (Pagination) ở các mục top chưa thực sự mạnh, Backend giới hạn trả cứng 50 bài hát.
- Việc tính toán các chỉ số Top Tracks/Artists thời gian thực từ bảng `listening_history` nếu dữ liệu lớn có thể gây chậm query. 

## 17. Đề xuất hoàn thiện
- Thêm caching (Redis) vào route `getFullProfile` hoặc View Materialized (Event-driven) khi scale hệ thống lớn.
- Bật tính năng crop ảnh Avatar ở client-side trước khi upload.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/views/profile/ProfileView.vue`
- `apps/backend/src/routes/user.routes.js`
- `apps/backend/src/controllers/user.controller.js`
