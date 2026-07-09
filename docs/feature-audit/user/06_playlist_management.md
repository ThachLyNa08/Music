# Quản lý Playlist và Thư viện cá nhân (Library & Playlist Management)

## 1. Mục đích chức năng
Cho phép người dùng tạo, chỉnh sửa, xóa và quản lý các danh sách phát cá nhân (Playlist). Người dùng có thể thêm/bớt bài hát, thay đổi thứ tự (reorder) và lưu trữ các Playlist do hệ thống hoặc AI tạo vào thư viện (Library) của mình.

## 2. Đối tượng sử dụng
- User: Quản lý thư viện cá nhân của mình.
- System/AI: Tự động khởi tạo Playlist tự động (System/AI Playlists).

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành rất tốt.
- Giải thích: Frontend đã xử lý logic kéo thả sắp xếp (reorder) mượt mà, đổi cover ảnh playlist và modal quản lý bài hát. Backend có cơ chế rạch ròi giữa Manual Playlist (thủ công) và System/AI Playlist. Chặn quyền thao tác trái phép (VD: không cho phép người dùng tự sửa AI Playlist trừ khi nhấn "Clone" để nhân bản).

## 4. Luồng xử lý tổng quát
1. **Trang thư viện (Library):** Gọi `GET /api/playlists` để lấy danh sách các playlist thủ công do user tạo và các playlist hệ thống/AI mà user đã bấm "Lưu".
2. **Tạo Playlist mới:** Nhấn "Tạo mới" -> `POST /api/playlists`. Backend khởi tạo bản ghi trong bảng `playlists`.
3. **Thêm bài hát vào Playlist:** User mở Menu "Thêm vào playlist" -> Chọn Playlist. Frontend gọi `POST /api/playlists/:id/songs` truyền `song_id`. Backend tính toán `position = MAX(position) + 1` để xếp bài hát xuống cuối.
4. **Chi tiết Playlist (`PlaylistDetailView.vue`):** Lấy danh sách bài hát qua `GET /api/playlists/:id`.
5. **Sửa thứ tự:** Frontend dùng kéo thả (Drag and Drop). Khi thả xong, gửi mảng `songIds` lên `PATCH /api/playlists/:id/songs/reorder`. Backend update lại toàn bộ cột `position`.
6. **Sao chép Playlist (Clone):** Đối với các Playlist Hệ Thống (được AI tạo), user không thể thêm/bớt bài. Phải dùng tính năng Clone (`POST /api/playlists/:id/clone`) để tạo ra 1 bản sao "Manual" để sửa.

## 5. Luồng xử lý chi tiết
- **Trường hợp xóa bài hát:** Gọi `DELETE /api/playlists/:id/songs/:song_id`.
- **Trường hợp cập nhật thông tin Playlist:** Đổi tên, mô tả, Cover Image qua form `FormData` gửi lên `PATCH /api/playlists/:id`. Backend dùng middleware `upload` nhận file lưu vào `uploads/images/`.
- **Trường hợp System Playlist:** Bảng `playlists` phân loại qua cột `type` (manual, ai, system). User không thể chỉnh sửa `is_system = 1`. 
- **Trường hợp Cover Playlist tự động:** Nếu Playlist do user tạo chưa có ảnh cover, SQL Query ở `playlist.controller.js` sử dụng Correlated Subquery lấy ảnh cover của bài hát đầu tiên trong list (`effective_cover_url`).

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/library/LibraryView.vue
apps/frontend/src/views/library/PlaylistDetailView.vue
apps/frontend/src/stores/library.js
```
- `LibraryView.vue`: Danh sách thư viện, tổng hợp Playlist đã tạo và Playlist/Album đã lưu (Saved).
- `PlaylistDetailView.vue`: Giao diện chi tiết một playlist, có nút sửa, xóa, và cơ chế sắp xếp bài hát.
- `library.js` (Store): Quản lý Modal "Add to Playlist" sử dụng chung ở mọi nơi, gọi API thêm bài vào Playlist.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/playlist.routes.js
apps/backend/src/controllers/playlist.controller.js
apps/backend/src/middleware/playlist.middleware.js
```
- `playlist.controller.js`: Xử lý CRUD khổng lồ. 
- `playlist.middleware.js`: Hàm `assertCanEditPlaylist` bảo vệ route, check kỹ quyền sở hữu và `is_system` trước khi cho sửa.

## 8. Vị trí code AI service nếu có
Chức năng này không trực tiếp gọi AI, nhưng nó làm nền tảng quản lý kết quả từ AI (các AI Playlists được lưu vào bảng `playlists` với `type = 'ai'`).

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/playlists` | Lấy danh sách Playlist của User | Có | `playlist.controller.js` |
| POST | `/api/playlists` | Tạo Playlist mới | Có | `playlist.controller.js` |
| GET | `/api/playlists/:id` | Xem chi tiết Playlist (Bài hát) | Tùy chọn (check Public) | `playlist.controller.js` |
| POST| `/api/playlists/:id/songs` | Thêm bài vào playlist | Có | `playlist.controller.js` |
| PATCH | `/api/playlists/:id/songs/reorder`| Đổi thứ tự | Có | `playlist.controller.js` |
| POST | `/api/playlists/:id/clone` | Nhân bản playlist hệ thống | Có | `playlist.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `playlists` | Lưu thông tin Playlist | Đọc/Ghi | `type`: manual/ai/system, `is_public` |
| `playlist_songs`| Cầu nối n-n (Playlist - Song)| Đọc/Ghi | Có cột `position` để sắp xếp |
| `user_saved_playlists`| Bảng lưu Playlist hệ thống| Đọc/Ghi | Lưu vào Library |

## 11. Realtime / Socket.IO / Redis nếu có
Chức năng này chưa sử dụng Realtime/Redis.

## 12. Quyền truy cập và bảo mật
- **Kỹ lưỡng nhất hệ thống:** Middleware `assertCanEditPlaylist` kiểm tra chặt chẽ `user_id` khớp với `req.user.id`, kiểm tra `type` phải là `manual`, nếu là `system/ai` sẽ block 403 Forbidden.
- Playlist Private (`is_public = 0`) chỉ người tạo mới xem được qua `GET /api/playlists/:id`.

## 13. Dữ liệu đầu vào và đầu ra
- API `POST /songs/reorder` nhận `songIds: [34, 12, 90]`.
- API `PATCH /` nhận `FormData` (tên, mô tả, cover file).

## 14. Loading / Empty / Error state trên giao diện
- **Loading:** Cả trang Playlist và Thư viện đều có state Loading vòng xoay.
- **Empty:** Nếu Playlist rỗng -> Hiển thị "Chưa có bài hát nào". Hiển thị ô tìm kiếm gợi ý thêm bài hát (Search to add).
- Modal tạo mới hiển thị báo lỗi đỏ nếu bỏ trống tên.

## 15. Điểm đã làm tốt
- Cơ chế Fallback Cover Image bằng Subquery ở Backend cực thông minh, tránh tốn dung lượng ổ cứng tạo ảnh phụ.
- Tính năng Clone giúp dung hòa giữa AI Playlist (Read-only) và Nhu cầu cá nhân hóa (Editable).

## 16. Hạn chế hiện tại
- Tính năng Reorder gửi toàn bộ mảng `songIds` có thể nặng nếu Playlist có 10,000 bài hát.
- Thiếu phân trang (Pagination) cho `playlist_songs` khi danh sách quá dài.

## 17. Đề xuất hoàn thiện
- Thêm Pagination ở trang Chi tiết Playlist để render mượt hơn cho những danh sách khổng lồ.
- Hỗ trợ collaborative playlist (Nhiều user cùng chung 1 playlist).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/views/library/LibraryView.vue`
- `apps/frontend/src/views/library/PlaylistDetailView.vue`
- `apps/backend/src/routes/playlist.routes.js`
- `apps/backend/src/controllers/playlist.controller.js`
