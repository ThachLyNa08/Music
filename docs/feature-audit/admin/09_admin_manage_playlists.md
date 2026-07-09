# Quản lý Playlist (Admin Manage System Playlists)

## 1. Mục đích chức năng
Quản trị viên có thể theo dõi, đánh giá và cấu hình các danh sách phát tự động (System Playlists) do hệ thống và AI tạo ra. Mục tiêu là đảm bảo chất lượng thuật toán "Daily Mix", "Weekly Mix" hoạt động ổn định và bài hát không bị rỗng.

## 2. Đối tượng sử dụng
- Admin: Theo dõi và thao tác thủ công (Regenerate).

## 3. Trạng thái triển khai hiện tại
- Đã phát triển phân hệ System Playlists chuyên biệt bên trong Admin Panel.
- Giải thích: Khác với User Playlist, System Playlist chứa từ khóa hệ thống (`system_key`) như `dailymix_01`. Tại trang admin này, hệ thống thống kê có bao nhiêu playlist đang ở trạng thái rỗng, playlist nào đang phục vụ lượng lớn người dùng, và cung cấp nút Regenerate (Chạy lại logic thuật toán sinh list) cho 1 hoặc toàn bộ system playlist.

## 4. Luồng xử lý tổng quát
1. **Theo dõi Tổng quan (`GET /api/admin/system-playlists/summary`):** Backend đếm tổng số playlist system, số playlist trống (0 bài hát), và lấy log hoạt động 7 ngày qua.
2. **Liệt kê Danh sách (`GET /api/admin/system-playlists`):** Lấy danh sách phân trang các playlist. Cột "Sức khỏe" (Health) được tính dựa trên số lượng bài hát và `updated_at`.
3. **Chi tiết & Activity Log:** Admin bấm vào 1 playlist để xem danh sách bài hát bên trong và log những lần AI/Thuật toán cập nhật nó.
4. **Tái tạo (Regenerate - Thủ công):** 
   - Backend cung cấp `POST /api/admin/system-playlists/:id/regenerate`.
   - Admin kích hoạt, hệ thống sẽ chọc vào `recommendation.controller.js` (hoặc Recommendation Service) để bắt nó chạy lại hàm điền bài hát (Fill) dựa theo Genre/Sở thích người dùng (Chủ sở hữu của Playlist đó).
5. **Regenerate Hàng loạt (`POST /api/admin/system-playlists/regenerate-all`):** Trigger cronjob chạy ngầm tái tạo toàn bộ playlist trống trong DB.

## 5. Luồng xử lý chi tiết
- **Trường hợp Playist Rỗng:** System playlist thường xuyên được sinh ra khi user đăng nhập lần đầu nhưng do lỗi logic (ví dụ user không follow ai và bảng `songs` chưa đủ nhạc), list có thể bị rỗng. Trang Admin sẽ bôi đỏ các playlist có track_count = 0.
- **Trường hợp Phân biệt Loại Playlist:** Hệ thống có 3 type: `manual`, `ai_generated`, `system`. Chức năng này của admin CHỈ quét các playlist có type = `system`.
- **Trường hợp Performance:** Tính năng Regenerate-all nếu có 100,000 user sẽ cực kỳ nặng nề. Backend nên xử lý dạng Background Queue hoặc chia lô (Batch processing) để không sập server Node.js.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/SystemPlaylistsView.vue
apps/frontend/src/views/admin/SystemPlaylistDetailView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js
```
- Endpoint `/system-playlists/*` điều phối chức năng này.

## 8. Vị trí code AI service nếu có
Tính năng Regenerate có thể gọi API sang FastAPI nếu Playlist đó cấu hình lấy từ AI thay vì Heuristic DB.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/system-playlists/summary`| KPI Playlist | Admin | `admin.controller.js` |
| GET | `/api/admin/system-playlists`| Danh sách System List| Admin | `admin.controller.js` |
| POST | `/api/admin/system-playlists/:id/regenerate`| Tạo lại cho 1 list | Admin | `admin.controller.js` |
| POST | `/api/admin/system-playlists/regenerate-all`| Tạo lại toàn bộ | Admin | `admin.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `playlists` | Lọc danh sách | Đọc | `is_system = 1` hoặc `type = 'system'` |
| `playlist_songs`| Tính track_count | Đọc | Group by `playlist_id` |
| `users` | Tìm chủ sở hữu | Đọc | System list gắn với từng cá nhân |

## 11. Realtime / Socket.IO / Redis nếu có
Không áp dụng, cập nhật thủ công bằng nút F5 hoặc Polling từ UI.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin` bảo vệ.

## 13. Dữ liệu đầu vào và đầu ra
- Output list API: Trả về JSON chứa `id, name, type, user_id, user_email, track_count, last_updated`.

## 14. Loading / Empty / Error state trên giao diện
- Tính năng Regenerate All hiển thị thanh tiến trình (Loading Overlay) cảnh báo không đóng trình duyệt nếu Backend chưa chạy mô hình Asynchronous Queue.

## 15. Điểm đã làm tốt
- Phát triển một trang riêng để "Kiểm toán" (Audit) chất lượng recommendation, một tính năng cực kỳ nâng cao mà các project thông thường hay bỏ sót. Nó cho phép Dev/Admin biết thuật toán của mình chạy có lỗi rỗng dữ liệu hay không.

## 16. Hạn chế hiện tại
- Regenerate All hiện tại đang bị phụ thuộc vào Node.js Event Loop. Nếu số lượng list quá lớn, API sẽ Timeout trước khi xử lý xong vòng lặp For.

## 17. Đề xuất hoàn thiện
- Đẩy logic Regenerate-All sang Redis Task Queue (BullMQ) hoặc RabbitMQ.
- Phân biệt rõ Playlist Rỗng là do Thuật toán yếu kém, hay do User thiếu Data hành vi (Cold-start problem) để có cảnh báo chính xác.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/routes/admin.routes.js`
- Sự tồn tại của khối endpoint `/system-playlists` trong controller.
