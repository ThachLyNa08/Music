# Chi tiết Bài Hát, Nghệ Sĩ, Album

## 1. Mục đích chức năng
Chức năng này cung cấp một trang chi tiết dành riêng cho từng đối tượng âm nhạc chính (Song, Artist, Album). Tại đây, người dùng có thể xem tất cả thông tin liên quan, lời bài hát (lyrics), danh sách bài hát (album), hoặc toàn bộ discography (đĩa nhạc) và thông tin cá nhân của một nghệ sĩ.

## 2. Đối tượng sử dụng
- User: Khám phá sâu hơn về bài hát, nghệ sĩ hoặc album mình quan tâm.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tốt.
- Giải thích: Frontend đã xử lý giao diện cực kỳ phong phú, sử dụng component extraction (lấy màu nền chủ đạo từ ảnh cover - dominantColor). Backend query phức tạp gộp nhiều context (Artist Pick, Album/Single count, Related Artists) bằng nhiều truy vấn SQL kết hợp để trả về 1 block dữ liệu JSON duy nhất. Tích hợp Lời bài hát với API ngoài.

## 4. Luồng xử lý tổng quát
- **Song Detail:** `/song/:id` -> Gọi `GET /api/songs/:id/detail`. Hiển thị Hero Banner lớn, nạp Lời bài hát từ API riêng. Hiển thị tiếp các bài hát liên quan.
- **Artist Profile:** `/artist/:id` -> Gọi `GET /api/artists/:id`. Hiển thị Hero banner khổng lồ, số follower, số người nghe, tiểu sử. Nút "Follow". Hiển thị Popular Songs, Albums, Singles, và mục Fans Also Like.
- **Album Detail:** `/album/:id` -> Gọi `GET /api/albums/:id/detail`. Hiển thị ảnh cover, năm release. Liệt kê toàn bộ các tracks bên trong album (sử dụng component SongRow).

## 5. Luồng xử lý chi tiết
- **Trường hợp Trích xuất màu chủ đạo (Dominant Color):** Sử dụng hàm `extractDominantColor()` ở frontend để quét ảnh avatar/cover, sau đó apply CSS Custom Properties (e.g., `--artist-color`) làm nền trong suốt tạo hiệu ứng kính (glassmorphism).
- **Trường hợp Follow Nghệ sĩ:** Nhấn nút Follow, Frontend gọi `POST /api/artists/:id/follow` kèm token. Backend insert vào bảng `artist_follows` (ignore nếu trùng). Cập nhật realtime số follower hiển thị trên giao diện (count++).
- **Trường hợp Play Artist:** Nút Play trên trang Artist sẽ lấy mảng `popular_songs` hoặc `songs` làm queue, `queueContext.source = 'artist'`.
- **Trường hợp Lyrics Sync:** Trong Song Detail, gọi `getLyricsBySongId` (API ngoài/LRC format). Backend (hoặc frontend) bóc tách chuỗi Lyrics `[00:xx]`, render dưới dạng đọc hoặc chạy cuộn.
- **Trường hợp Artist Pick:** Ở trang Artist, backend tự động tính "Lựa chọn của nghệ sĩ" bằng cách ưu tiên 1 bài hát phổ biến nhất hoặc 1 album mới nhất làm Highlight Card.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/song/SongDetailView.vue
apps/frontend/src/views/artist/ArtistView.vue
apps/frontend/src/views/album/AlbumDetailView.vue
apps/frontend/src/utils/colorPalette.js
```
- `SongDetailView.vue`: Xử lý giao diện 2 cột, Lời bài hát và Các bài hát liên quan.
- `ArtistView.vue`: Giao diện phức tạp nhất. Có Sticky Header ẩn hiện khi cuộn, phân trang Tabs (Singles / Albums), và mục About mờ ảo.
- `AlbumDetailView.vue`: Liệt kê bài hát trong Album.
- `colorPalette.js`: Logic trích xuất màu chủ đạo.

## 7. Vị trí code backend
```txt
apps/backend/src/controllers/artist.controller.js
apps/backend/src/controllers/song.controller.js
apps/backend/src/controllers/album.controller.js
```
- `artist.controller.js`: Xử lý `getArtistById` là một trong những API nặng nhất, chạy ít nhất 7 query (artist info, follow check, album count, popular songs, all songs, albums, singles, related artists) rồi gom lại.
- Tương tự cho `album.controller.js` và `song.controller.js`.

## 8. Vị trí code AI service nếu có
Chức năng này chỉ truy xuất CSDL, không sử dụng AI service. (Gợi ý Related Songs được xử lý thông qua cùng `genre_id` trong MySQL).

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/artists/:id` | Lấy chi tiết nghệ sĩ | Không (Optional) | `artist.controller.js` |
| POST | `/api/artists/:id/follow` | Theo dõi nghệ sĩ | Có | `artist.controller.js` |
| GET | `/api/songs/:id/detail` | Chi tiết bài hát | Không (Optional) | `song.controller.js` |
| GET | `/api/albums/:id/detail` | Chi tiết Album | Không (Optional) | `album.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `artists` | Thông tin nghệ sĩ, follower, avatar | Đọc | Lấy metadata |
| `artist_follows`| Quan hệ Follow | Đọc/Ghi | Xác định is_following |
| `albums` | Thông tin đĩa nhạc, số track | Đọc | Join với songs |

## 11. Realtime / Socket.IO / Redis nếu có
Chưa áp dụng. 

## 12. Quyền truy cập và bảo mật
- Hành động Follow, Like bài hát bắt buộc phải có token hợp lệ.

## 13. Dữ liệu đầu vào và đầu ra
- Input: Params `id` trên URL.
- Output `getArtistById`: Object JSON khổng lồ chứa `{ popular_songs, songs, albums, singles, artist_pick, fans_also_like, is_following, ...artistInfo }`.

## 14. Loading / Empty / Error state trên giao diện
- Trang hiển thị Vòng xoay (Spinner) khi fetch.
- Error state màu đỏ, nút trở về trang chủ nếu gõ ID không tồn tại (404).

## 15. Điểm đã làm tốt
- Component `colorPalette.js` phối màu nền Dynamic theo Cover tạo cảm giác Premium giống Spotify.
- Backend cấu trúc Payload rất tiện cho Frontend, gộp hết vào 1 response thay vì phải bắt Frontend gọi 5-6 API lắt nhắt.

## 16. Hạn chế hiện tại
- Truy vấn `getArtistById` khá nặng. Dù có Index, MySQL vẫn phải thực thi nhiều câu query JOIN bảng `listening_history` (qua Views/Subquery). Nếu traffic cực cao sẽ nghẽn.
- Lyrics đang fetch real-time, nếu bên Provider API sập thì không load được.

## 17. Đề xuất hoàn thiện
- Thêm Redis caching cho các API Detail (ví dụ cache 5-10 phút).
- Tách API lấy Albums/Singles/Related Artists thành API lazy load riêng rẽ để tăng tốc độ phản hồi TTI (Time to Interactive).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/views/artist/ArtistView.vue`
- `apps/frontend/src/views/song/SongDetailView.vue`
- `apps/backend/src/controllers/artist.controller.js`
