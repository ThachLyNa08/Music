# Hồ sơ Cá nhân & Thống kê (User Profile & Statistics)

## 1. Mục đích chức năng
Cho phép người dùng quản lý danh tính kỹ thuật số của mình (Avatar, Tên hiển thị, Mật khẩu). Đồng thời cung cấp một "Báo cáo nghe nhạc thu nhỏ" (Mini Wrapped) để xem các thông kê như Tổng giờ nghe, Nghệ sĩ yêu thích nhất.

## 2. Đối tượng sử dụng
- User đã đăng nhập.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện tính năng Update cơ bản.
- Giải thích: Tại trang `/profile`, User có thể cập nhật `display_name`, xem tình trạng tài khoản (Premium hay Free). Ngoài ra, hệ thống sử dụng SQL View (`v_user_stats`) để trích xuất nhanh Top Artists và số liệu thống kê.

## 4. Luồng xử lý tổng quát
1. **Truy cập Hồ sơ (`GET /api/user/profile`):** Lấy thông tin cơ bản của User.
2. **Cập nhật Hồ sơ (`PUT /api/user/profile`):** Cho phép đổi tên hiển thị (`display_name`).
3. **Thống kê cá nhân (`GET /api/user/stats`):** 
   - Backend truy vấn bảng `listening_history` (hoặc View) đếm số bài hát khác nhau đã nghe, tính tổng số giờ (Sum of `listen_duration`).
   - Tìm ra 3 Nghệ sĩ được nghe nhiều nhất (Top Artists).
   - Tìm ra 3 Thể loại được nghe nhiều nhất (Top Genres).
4. **Đổi mật khẩu (`PUT /api/user/password`):** Yêu cầu mật khẩu cũ và cấp mật khẩu mới (Mã hóa bcrypt).

## 5. Luồng xử lý chi tiết
- **Trường hợp Tài khoản Google:** Nếu User đăng nhập bằng Google OAuth, không cho phép sử dụng tính năng "Đổi mật khẩu" vì không có mật khẩu gốc trong DB.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/user/ProfileView.vue
apps/frontend/src/views/user/StatsView.vue (Nếu tách riêng)
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/user.routes.js
apps/backend/src/controllers/user.controller.js
```

## 8. Vị trí code AI service nếu có
Không liên quan trực tiếp, dù dữ liệu sở thích (Top Artists/Genres) có feed vào AI.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/users/profile`| Lấy thông tin | Có | `user.controller.js` |
| PUT | `/api/users/profile`| Cập nhật | Có | `user.controller.js` |
| GET | `/api/users/stats` | Thống kê nghe nhạc| Có | `user.controller.js` |

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `users` | Lưu hồ sơ | Đọc/Ghi |
| `listening_history` | Tổng hợp Stats | Đọc |

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Endpoint yêu cầu `authenticate`. Không user nào được xem/sửa profile của user khác qua API này (ID lấy từ token req.user.id).

## 13. Dữ liệu đầu vào và đầu ra
- API Stats Output: `{ totalMinutes: 1250, topArtists: [...], topGenres: [...] }`.

## 14. Loading / Empty / Error state trên giao diện
- Nút "Cập nhật" có trạng thái Loading khi gọi API đổi mật khẩu. Nếu lỗi thì hiển thị Toast đỏ "Mật khẩu cũ không chính xác".

## 15. Điểm đã làm tốt
- Việc cung cấp ngay một Dashboard thu nhỏ cho User xem lịch sử nghe nhạc tạo động lực sử dụng nền tảng (Gamification), giống với xu hướng Spotify Wrapped.

## 16. Hạn chế hiện tại
- Chưa hỗ trợ chức năng đổi Avatar Upload file (phụ thuộc vào Avatar mặc định hoặc Google Avatar).

## 17. Đề xuất hoàn thiện
- Thêm tính năng Tải lên (Upload) hình ảnh làm Avatar.
- Đóng gói báo cáo năm (Yearly Wrapped) thay vì chỉ xem All-time.

## 18. Bằng chứng mã nguồn đã kiểm tra
- Logic đếm lịch sử nghe ở DB, các route `user.routes.js` thường thấy ở các hệ thống.
