# Tracking và Ghi nhận Lịch sử nghe nhạc (Listening History Tracking)

## 1. Mục đích chức năng
Thu thập và ghi nhận chính xác hành vi nghe nhạc của người dùng. Hệ thống không chỉ đếm số lượt nghe (play count) mà còn phân tích chất lượng của lượt nghe đó (nghe hết bài, bỏ qua giữa chừng, thời lượng nghe) để làm dữ liệu đầu vào quan trọng (Implicit Feedback) cho Hệ thống gợi ý âm nhạc (Recommendation Engine).

## 2. Đối tượng sử dụng
- User: Xem lại lịch sử nghe nhạc của mình (Recently Played).
- System/Backend: Dùng dữ liệu này để tính toán độ yêu thích (Implicit Rating) và feed vào AI Model.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành rất tốt.
- Giải thích: Không chỉ dừng lại ở việc gọi API "cộng 1 view" đơn giản. Frontend gửi payload chi tiết (thời gian đã nghe, % hoàn thành, nguồn phát) qua API `POST /api/songs/:id/listen`. Backend xử lý logic tự động suy luận `is_skipped`, `completion_rate` nếu frontend gửi thiếu. Hệ thống hỗ trợ chế độ "in_progress" (cập nhật liên tục khi đang nghe) hoặc ghi nhận 1 lần khi bài hát kết thúc/chuyển bài.

## 4. Luồng xử lý tổng quát
1. **Frontend (Player Store):** Khi bài hát bắt đầu phát hoặc khi chuyển bài (Next/Prev), Player sẽ tính toán `listen_duration`.
2. **Gửi API:** Frontend gửi `POST /api/songs/:id/listen` kèm theo các tham số: `history_id` (để update nếu đang in_progress), `listen_duration`, `song_duration`, `completion_rate`, `is_skipped`, `source`.
3. **Backend (`song.controller.js - recordListen`):** 
   - Xác thực bài hát có tồn tại không.
   - Tính toán lại `completion_rate` = `listen_duration` / `song_duration` nếu bị khuyết.
   - Đánh dấu `is_completed = true` nếu `completion_rate >= 0.8` (nghe trên 80%).
   - Đánh dấu `is_skipped = true` nếu nghe dưới 30s hoặc dưới 30% và không phải đang "in_progress".
   - Tính toán Implicit Rating (VD: 5đ cho Completed + Liked, 4đ cho Completed, 1đ cho Skipped).
4. **Lưu DB:** Cập nhật bảng `listening_history` (INSERT mới hoặc UPDATE nếu truyền `history_id`).
5. **Cộng view:** Nếu nghe hợp lệ (ví dụ > 30s), kích hoạt tăng `play_count` trong bảng `songs` (có thể qua trigger hoặc cronjob).

## 5. Luồng xử lý chi tiết
- **Trường hợp Spotify Track:** Nếu ID bài hát truyền vào là chuỗi `spotify:track:xxx`, Backend gọi `spotifyService.resolveSpotifyTrack()` để tải bài đó về DB local trước, sau đó mới ghi nhận lịch sử vào bài hát local.
- **Trường hợp Implicit Rating (Tính điểm ngầm):** Hành vi của người dùng được quy đổi thành điểm số từ 1 đến 5.
  - Nghe hết bài + Đã like: 5 điểm.
  - Nghe hết bài (không like): 4 điểm.
  - Nghe 1 phần (> 50%): 3 điểm.
  - Nghe ít (< 50%): 2 điểm.
  - Skip ngay từ đầu (< 30s hoặc < 30%): 1 điểm (hoặc đánh dấu âm).
- **Trường hợp Context/Source:** Tham số `source` lưu lại người dùng nghe bài này từ đâu (ví dụ: `playlist`, `search`, `home_recommendation`). Giúp đánh giá hiệu quả của hệ thống gợi ý.

## 6. Vị trí code frontend
```txt
apps/frontend/src/stores/player.js
```
- Pinia store theo dõi sự kiện `timeupdate` và `ended` của thẻ `<audio>` để kích hoạt hàm `reportListen()`.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/song.routes.js
apps/backend/src/controllers/song.controller.js
```
- `recordListen` function xử lý logic phân tích chất lượng lượt nghe và lưu DB.

## 8. Vị trí code AI service nếu có
Chức năng này chuẩn bị dữ liệu (Dataset) cho thuật toán Recommendation (ví dụ BPR-MF/SVD) bên `apps/ai-service`. Khi có dữ liệu `implicit_rating` từ 1-5, mô hình AI dễ dàng train hơn thay vì chỉ đếm số lần nghe.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/songs/:id/listen`| Ghi nhận lượt nghe | Có | `song.controller.js` |
| GET | `/api/library/recently-played`| Lấy lịch sử | Có | `library.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `listening_history` | Lưu từng sự kiện nghe nhạc | Đọc/Ghi | Cột: `user_id, song_id, listen_duration, completion_rate, is_skipped, implicit_rating` |
| `songs` | Cập nhật `play_count` | Đọc/Ghi | Tổng số lượt nghe |
| `artists` | (Tùy chọn) cập nhật `total_plays` | Đọc/Ghi | |

## 11. Realtime / Socket.IO / Redis nếu có
Chưa áp dụng. Ghi nhận API gọi dạng HTTP REST bình thường (có thể dùng `navigator.sendBeacon` ở frontend khi đóng trang).

## 12. Quyền truy cập và bảo mật
- Bắt buộc phải xác thực (`authenticate`). User nào thì ghi lịch sử cho user đó.
- Không cho phép truyền ID giả hoặc thời lượng ảo (Backend tự clamp `listen_duration` không vượt quá `song_duration`).

## 13. Dữ liệu đầu vào và đầu ra
- **Input:** JSON Body `{ "listen_duration": 120, "song_duration": 180, "source": "playlist" }`.
- **Output:** `{ "success": true, "history_id": 1045 }` (trả về ID để frontend có thể tiếp tục update nếu nghe tiếp).

## 14. Loading / Empty / Error state trên giao diện
- Chức năng này chạy ngầm (Background Sync), người dùng không nhìn thấy Loading hay Error. Lỗi mạng sẽ bị bắt và ghi log qua `console.warn` ở frontend để không gián đoạn trải nghiệm nghe nhạc.

## 15. Điểm đã làm tốt
- Cơ chế gom nhóm tham số (completion rate, is_skipped) tự động tại backend để giảm bớt gánh nặng xử lý và chống gian lận từ frontend.
- Cấu trúc DB `listening_history` thiết kế chuẩn để chuẩn bị cho Machine Learning sau này.

## 16. Hạn chế hiện tại
- Tần suất gọi API có thể cao nếu frontend gọi liên tục ở chế độ `in_progress`.
- Nếu frontend sập đột ngột (tắt tab trình duyệt) mà chưa gọi API `ended` thì lượt nghe cuối cùng có thể bị mất hoặc không chính xác.

## 17. Đề xuất hoàn thiện
- Thêm Redis hoặc RabbitMQ làm buffer queue để hứng request `/listen` nhằm giảm tải trực tiếp lên MySQL (Write-heavy).
- Frontend nên implement cơ chế batching (gom 5-10 bài nghe gửi 1 lần) hoặc `sendBeacon` khi unload trang.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/routes/song.routes.js`
- `apps/backend/src/controllers/song.controller.js` (Hàm `recordListen`)
