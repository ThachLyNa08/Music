# Thư viện Cá nhân (Library, Liked Songs & Recently Played)

## 1. Mục đích chức năng
Nơi lưu trữ và truy cập nhanh các nội dung âm nhạc mà người dùng yêu thích hoặc tương tác gần đây. Giống như tủ đĩa cá nhân, giúp cá nhân hóa trải nghiệm.

## 2. Đối tượng sử dụng
- User: Xem nhạc đã thích, danh sách phát, nghệ sĩ đã theo dõi, và lịch sử nghe nhạc.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện 100% với giao diện tương tự Spotify.
- Giải thích: Có trang `/collection/tracks` (Liked Songs) hiển thị các bài hát có `is_liked = true` trong database. Trang `/collection/history` (Recently Played) truy xuất bảng `listening_history`. 

## 4. Luồng xử lý tổng quát
1. **Bài hát đã thích (Liked Songs):**
   - Nút thả tim (Heart icon) ở mọi nơi (Player, Danh sách, Chi tiết) gọi API `POST /api/songs/:id/like` hoặc `DELETE`.
   - Bảng `song_likes` lưu `(user_id, song_id, liked_at)`.
   - Gọi API `GET /api/songs/liked` để đổ danh sách ra giao diện (sắp xếp theo `liked_at` DESC).
2. **Nghe gần đây (Recently Played):**
   - Backend hứng API `/api/songs/:id/listen` mỗi khi user nghe 1 bài.
   - API `GET /api/library/recently-played` sẽ GROUP BY bài hát, lấy lần nghe cuối cùng `MAX(created_at)`.
3. **Nghệ sĩ đang theo dõi:**
   - Cập nhật qua nút "Follow" (`POST /api/artists/:id/follow`).

## 5. Luồng xử lý chi tiết
- **Trường hợp Đồng bộ trạng thái:** Nếu user unlike một bài hát trong màn hình Liked Songs, bài hát có thể ẩn đi ngay lập tức nhờ Vue Reactivity, hoặc làm mờ đi cho đến khi user reload trang. Trạng thái `is_liked` được đồng bộ toàn cục qua Pinia Store (nếu có cache) hoặc re-fetch.
- **Trường hợp Trùng lặp Recently Played:** Người dùng nghe 1 bài 10 lần trong ngày thì recently played chỉ hiển thị bài đó 1 lần ở vị trí trên cùng (Logic Backend xử lý `GROUP BY song_id` hoặc lấy log gần nhất).

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/library/LibraryView.vue
apps/frontend/src/views/library/LikedSongsView.vue
apps/frontend/src/views/library/RecentlyPlayedView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/song.routes.js (like/unlike)
apps/backend/src/routes/library.routes.js (recently-played)
```

## 8. Vị trí code AI service nếu có
Không liên quan trực tiếp, nhưng `listening_history` là Data đầu vào cho AI Recommendation.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/songs/:id/like`| Thích bài hát | Có | `song.controller.js` |
| DELETE| `/api/songs/:id/like`| Bỏ thích bài hát| Có | `song.controller.js` |
| GET | `/api/songs/liked`| Lấy DS đã thích | Có | `song.controller.js` |
| GET | `/api/library/recently-played`| Lịch sử nghe | Có | `library.controller.js` |

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `song_likes` | Liên kết User - Song | Đọc/Ghi |
| `listening_history`| Lịch sử thời gian thực | Đọc/Ghi |

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Middleware `authenticate` cho tất cả route.

## 13. Dữ liệu đầu vào và đầu ra
- API Liked Songs Output: Mảng các bài hát được format qua hàm `hydrateLikedState` (đảm bảo `is_liked = 1`).

## 14. Loading / Empty / Error state trên giao diện
- Nếu thư viện rỗng: Hiển thị icon trái tim vỡ hoặc thông điệp "Hãy tìm bài hát và thả tim". 

## 15. Điểm đã làm tốt
- UI/UX mượt mà, phản hồi ngay lập tức khi bấm nút Like nhờ Vue Optimistic UI update.

## 16. Hạn chế hiện tại
- Chưa có tính năng search/filter cục bộ bên trong trang Liked Songs (ví dụ có 1000 bài thì khó tìm).

## 17. Đề xuất hoàn thiện
- Tính năng Cache Offline cho Liked Songs (Giống tính năng Download của Spotify).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra `song.routes.js`, `song.controller.js` (Hàm `likeSong`, `unlikeSong`, `getLikedSongs`).
