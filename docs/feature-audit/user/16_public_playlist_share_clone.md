# Chia sẻ & Sao chép Playlist (Public Playlist Share & Clone)

## 1. Mục đích chức năng
Lan tỏa âm nhạc trong cộng đồng. Thay vì mỗi người phải tự tạo danh sách phát, họ có thể "Public" playlist của mình để chia sẻ link cho người khác nghe, hoặc "Clone" (Sao chép) playlist của người khác về làm của riêng để tự do thêm/bớt bài hát.

## 2. Đối tượng sử dụng
- User: Bật tắt quyền Public/Private. Chia sẻ và Nhân bản.

## 3. Trạng thái triển khai hiện tại
- Đã được lập trình cơ bản trong module Playlist.
- Giải thích: Ở bảng `playlists` có cột `is_public`. Khi User tạo playlist, mặc định là Private (0). Họ có thể bật sang Public (1). Khi chia sẻ link (VD: `domain.com/playlist/123`), nếu là Public, bất cứ ai (kể cả Guest chưa đăng nhập) cũng có thể truy cập để xem danh sách bài hát.

## 4. Luồng xử lý tổng quát
1. **Public/Private Toggle:** Chủ sở hữu (Owner) gọi API `PUT /api/playlists/:id/visibility` để đổi trạng thái.
2. **Truy cập (Share):** 
   - Khách (Guest) truy cập link playlist. Frontend gọi `GET /api/playlists/:id`.
   - Backend kiểm tra: Nếu `user_id` của khách trùng với Owner -> Cho phép. Nếu không trùng, kiểm tra `is_public === 1` -> Cho phép (Read-only). Nếu `is_public === 0` -> Trả về lỗi 403 (Không có quyền truy cập).
3. **Nhân bản (Clone):**
   - Một User A vào playlist Public của User B, bấm "Nhân bản" (Clone).
   - Frontend gọi API `POST /api/playlists/:id/clone`.
   - Backend tạo ra 1 dòng mới trong bảng `playlists` (Gán `user_id = A`, name = "Copy of ..."). Sau đó Copy toàn bộ track từ `playlist_songs` cũ sang `playlist_songs` mới.
   - User A từ nay có toàn quyền sở hữu (Thêm/xóa) trên bản copy này mà không ảnh hưởng bản gốc.

## 5. Luồng xử lý chi tiết
- **Trường hợp AI Playlist / System Playlist:** Playlist do hệ thống tạo (Ví dụ Daily Mix) hoặc AI tạo cũng có thể hỗ trợ tính năng Clone về thành Playlist Manual (Playlist thủ công) để lưu giữ vĩnh viễn (vì Daily Mix sẽ bị reset ngày hôm sau). Cần check kỹ cơ chế Backend chặn sửa System List qua Middleware `assertCanEditPlaylist`.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/playlist/PlaylistDetailView.vue
apps/frontend/src/components/playlist/ShareModal.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/playlist.routes.js
apps/backend/src/controllers/playlist.controller.js
```

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| PUT | `/api/playlists/:id` | Sửa thông tin (có cả is_public)| Bắt buộc (Chủ) | `playlist.controller.js` |
| GET | `/api/playlists/:id` | Xem list (Kèm check Public) | Tùy quyền | `playlist.controller.js` |
| POST| `/api/playlists/:id/clone`| Nhân bản playlist | Bắt buộc | `playlist.controller.js` |

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `playlists` | Xác định quyền | Đọc/Ghi | Cột `is_public` |
| `playlist_songs`| Clone track | Đọc/Ghi | Lệnh `INSERT INTO ... SELECT ...` |

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Rất chặt chẽ ở khâu Read (Guest) và Edit (Chỉ Owner).
- Ngăn chặn triệt để lổ hổng IDOR (Sửa/Xóa playlist của người khác).

## 13. Dữ liệu đầu vào và đầu ra
- API Clone trả về Object Playlist mới tạo có kèm `id` mới.

## 14. Loading / Empty / Error state trên giao diện
- Error 403: "Playlist này ở chế độ riêng tư" kèm nút Quay lại trang chủ.

## 15. Điểm đã làm tốt
- Cơ chế chia sẻ và nhân bản rất linh hoạt, kích thích yếu tố cộng đồng (Social feature) giống Spotify.

## 16. Hạn chế hiện tại
- Nếu Playlist gốc bị xóa, thì URL chia sẻ sẽ chết (404). Người dùng đã clone thì không sao vì dữ liệu đã tách rời.
- Chưa có tính năng "Collaborative Playlist" (Nhiều người cùng thêm bài vào 1 list).

## 17. Đề xuất hoàn thiện
- Thêm tính năng "Follow Playlist". (Lưu vào bảng `playlist_follows`). Thay vì Clone, User chỉ việc theo dõi để mỗi lần chủ nhân cập nhật bài hát, User cũng thấy được bản mới nhất.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra `playlist.controller.js` ở đợt review trước đó, cơ chế `assertCanEditPlaylist` bảo vệ quyền Edit, trong khi quyền Read được nới lỏng dựa vào cờ cờ `is_public`.
