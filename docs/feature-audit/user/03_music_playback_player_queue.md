# Phát nhạc & Hàng đợi (Music Playback & Player Queue)

## 1. Mục đích chức năng
Chức năng này quản lý việc phát nhạc (âm thanh local hoặc qua Spotify SDK), quản lý hàng đợi (queue), các chế độ phát (shuffle, repeat) và tự động ghi nhận lịch sử nghe nhạc (tracking listen) để phục vụ hệ thống gợi ý SVD. Ngoài ra còn hỗ trợ "Auto-continue" (phát nhạc liên tục khi hết danh sách).

## 2. Đối tượng sử dụng
- User: Tác nhân chính trải nghiệm phát nhạc trên frontend.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành tốt.
- Giải thích: State được quản lý tập trung và chặt chẽ bằng Pinia (`player.js`), kết hợp cả Audio DOM native và Spotify Web Playback SDK. Hỗ trợ đầy đủ tracking lịch sử, shuffle, lưu phiên nghe nhạc vào localStorage để khôi phục khi reload. Hệ thống Auto-continue hoạt động trơn tru dựa trên thuật toán lấy bài hát tương tự.

## 4. Luồng xử lý tổng quát
1. Người dùng bấm Play một bài hát trên giao diện (ví dụ từ trang Home, Profile, Playlist).
2. Action gọi vào `usePlayerStore.playSong(song, queueContext, context)`.
3. Store kiểm tra xem bài hát có thuộc Spotify hay Local MP3. Nếu là MP3, sử dụng thẻ `new Audio()`. Nếu là Spotify, gọi `Spotify.Player`.
4. Khi nhạc bắt đầu phát, store ghi nhận thời điểm bắt đầu (`currentListenStartAt`).
5. Khi người dùng nghe qua một thời lượng hoặc tỉ lệ % nhất định, hoặc khi bài hát kết thúc/bỏ qua, timer sẽ gửi API `POST /api/songs/:id/listen` để ghi vào DB `listening_history`.
6. Khi bài hát kết thúc (`ended` event), hệ thống gọi `next()`, chạy sang bài tiếp theo trong `queue` hoặc `shuffleOrder`.
7. Nếu hết `queue`, store tự động gọi API `GET /api/songs/:id/auto-continue` để lấy thêm bài nhét vào queue.

## 5. Luồng xử lý chi tiết
- **Trường hợp phát nhạc thường:** Audio DOM update thời gian (`timeupdate`), cập nhật state `currentTime` và `duration`.
- **Trường hợp phát nhạc Spotify:** Yêu cầu khởi tạo SDK, lấy device ID và token. Nếu trình duyệt chặn Autoplay, sinh ra trạng thái báo lỗi.
- **Trường hợp tracking nghe nhạc:** Có timeout 5s để trigger in_progress. Khi skip, gửi action lên server để tính completion_rate. Điều kiện tracking: Nghe > 5s, hoặc > 10%, hoặc completed/skipped.
- **Trường hợp Shuffle:** Tạo một mảng `shuffleOrder` lưu các index ngẫu nhiên, giữ bài đang nghe ở vị trí số 0.
- **Trường hợp khôi phục phiên (Restore Session):** Token localStorage `musicflow_player_session_{id}` lưu lại queue, volume, shuffle state và currentTime. 
- **Trường hợp Auto-continue:** Backend lấy `seed_song_id`, truy vấn dựa trên `genre_id` và `artist_id` với trọng số (SVD/Content-based nhẹ) để nạp thêm vào Queue nếu User chưa tắt.

## 6. Vị trí code frontend
```txt
apps/frontend/src/stores/player.js
apps/frontend/src/components/player/MusicPlayer.vue
apps/frontend/src/components/player/PlayerBar.vue
apps/frontend/src/components/player/FullscreenPlayer.vue
```
- `player.js`: Cốt lõi của toàn bộ hệ thống phát nhạc. Quản lý trạng thái Play, Pause, Queue, Tracking history, Auto Continue và Spotify SDK.
- `MusicPlayer.vue` / `PlayerBar.vue`: Component thanh phát nhạc nằm dưới đáy ứng dụng.
- `FullscreenPlayer.vue`: Giao diện phát nhạc toàn màn hình (hiển thị Lyrics hoặc Cover phóng to).

## 7. Vị trí code backend
```txt
apps/backend/src/routes/song.routes.js
apps/backend/src/controllers/song.controller.js
```
- `song.routes.js`: Định nghĩa `POST /:id/listen`, `GET /:id/auto-continue`.
- `song.controller.js`: Xử lý hàm `recordListen` (INSERT/UPDATE bảng `listening_history`). Hàm `getAutoContinueSongs` lấy các bài hát gợi ý dựa trên context bài cuối cùng để thêm vào hàng đợi.

## 8. Vị trí code AI service nếu có
Việc gợi ý auto-continue hiện tại nằm ở MySQL (Backend). Sẽ kết hợp điểm số AI `recommendations` nếu có trong bảng.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/songs/:id/listen` | Ghi nhận lịch sử nghe | Có | `song.controller.js` |
| GET | `/api/songs/:id/auto-continue`| Lấy bài hát chạy tiếp theo | Tùy chọn | `song.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `listening_history` | Lưu trữ dữ liệu tracking (completion_rate, is_skipped) | Ghi/Update | Explicit feedback cho AI |
| `songs` | Truy xuất thông tin audio_url | Đọc | Lấy link MP3 |

## 11. Realtime / Socket.IO / Redis nếu có
Chưa phát hiện sử dụng Socket.IO cho tính năng Playback Queue. (Có thể dùng cho Remote Control sau này nhưng hiện tại là local state).

## 12. Quyền truy cập và bảo mật
- API `recordListen` yêu cầu đăng nhập.
- Audio URL được trả thẳng về Client, có thể cần cơ chế Signed URL nếu muốn chống download lậu trong tương lai.

## 13. Dữ liệu đầu vào và đầu ra
- Input `recordListen`: `history_id`, `listen_duration`, `song_duration`, `completion_rate`, `is_completed`, `is_skipped`, `skip_at_sec`, `source`.
- Output: Trả về `history_id` mới nếu là bản record đầu tiên của phiên.

## 14. Loading / Empty / Error state trên giao diện
- `spotifyError`: Hiển thị lỗi nếu không load được Spotify SDK.
- Player có Loading spinner khi `audio` đang buffer (`waiting` event).
- Các nút Play/Pause/Next/Prev tự động disable nếu `queue` rỗng.

## 15. Điểm đã làm tốt
- Tích hợp Spotify Web Playback SDK rất khéo léo để fallback.
- Chế độ Shuffle làm chuẩn xác (tạo mảng phụ `shuffleOrder` không phá vỡ `queue` gốc).
- Cơ chế Tracking rất thông minh (Debounce, tracking update) phục vụ đắc lực cho SVD.

## 16. Hạn chế hiện tại
- Chưa mã hóa audio (HLS / DRM), MP3 phơi bày trên Network tab dễ bị tải lậu.
- Nếu Backend load chậm bài hát, player có thể bị khựng.

## 17. Đề xuất hoàn thiện
- Cân nhắc sử dụng HLS stream (m3u8) thay vì trả thẳng MP3 tĩnh nếu triển khai quy mô lớn để bảo vệ bản quyền.
- Bổ sung nút tùy chỉnh chất lượng (128kbps, 320kbps).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/frontend/src/stores/player.js`
- `apps/frontend/src/components/player/PlayerBar.vue`
- `apps/backend/src/routes/song.routes.js`
- `apps/backend/src/controllers/song.controller.js`
