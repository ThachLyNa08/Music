# Giao diện Karaoke và Đồng bộ Lời bài hát (Karaoke / Lyrics View)

## 1. Mục đích chức năng
Mang đến trải nghiệm hát Karaoke ngay trên nền tảng với lời bài hát chạy đồng bộ theo nhạc, kết hợp với tính năng Tách Stem (tách lời/nhạc) để hát trên beat chuẩn.

## 2. Đối tượng sử dụng
- User: Bấm nút "Microphone" ở thanh Player.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện.
- Giải thích: Có một màn hình Full-screen hoặc Panel bên phải chuyên dụng để hiển thị lời bài hát (Lyrics). Hỗ trợ cả 2 định dạng: Lời trơn (Plain text) và Lời đồng bộ thời gian (LRC format - `[00:15.30]`). Hỗ trợ tích hợp với kết quả của AI Stem Separation để chuyển đổi giữa Bản Gốc và Bản Beat (Karaoke Mode).

## 4. Luồng xử lý tổng quát
1. **Mở Giao diện:** User click vào icon Lyrics ở Player. Vue Router chuyển hướng (hoặc mở Component Overlay) hiển thị giao diện Karaoke.
2. **Fetch Lyrics:** Trình phát nhạc kiểm tra xem thuộc tính `synced_lyrics` có tồn tại không. Nếu không, hiển thị `lyrics` thường (cần cuộn tay).
3. **Phân tích LRC (Parse):** Hàm tiện ích ở Frontend cắt chuỗi LRC thành mảng các Object `{ time: 15.3, text: "Xin chào" }`.
4. **Đồng bộ chạy chữ:** 
   - Hàm `requestAnimationFrame` hoặc sự kiện `timeupdate` của thẻ `<audio>` liên tục lấy `currentTime`.
   - Đối chiếu với mảng LRC để tìm ra dòng hiện tại (Active Line).
   - Áp dụng CSS class (ví dụ `.active`, bôi màu gradient, phóng to chữ).
5. **Kích hoạt Stem/Beat:** Nếu bài hát đã được tách stem (tham khảo chức năng *Stem Separation Pipeline*), UI hiện nút "Hát Karaoke". Bấm vào, thẻ `<audio>` sẽ swap `src` từ `audio_url` gốc sang `instrumental_url` do AI tạo ra.

## 5. Luồng xử lý chi tiết
- **Trường hợp Click để Tua (Seek):** Người dùng bấm vào 1 dòng lyric bất kỳ -> thẻ audio tự động nhảy đến thời điểm (time) của dòng đó.
- **Trường hợp Trống/Lỗi (Fallback):** Nếu bài hát không có cả Lời đồng bộ lẫn Lời trơn -> Hiển thị màn hình "Đang cập nhật lời bài hát". 

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/karaoke/KaraokeView.vue
apps/frontend/src/components/player/LyricsPanel.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/controllers/lyrics.controller.js (Nếu có API lấy lyric lẻ)
apps/backend/src/controllers/song.controller.js (Đã kèm sẵn trong detail)
```

## 8. Vị trí code AI service nếu có
Việc đồng bộ chữ (Sync) hiện tại phụ thuộc vào Data thủ công (định dạng LRC) lưu trong DB. Tuy nhiên, nếu sau này tích hợp AI Whisper, AI có thể tự động sinh file LRC từ Audio. (Phần tách Beat đã làm bằng AI Demucs).

## 9. API liên quan
Không có API độc lập. Dữ liệu LRC nằm luôn trong response của API `GET /api/songs/:id/detail`.
Liên quan chặt chẽ tới API `/api/stem/songs/:id/separate` để lấy Beat.

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `songs` | Lưu lời | Đọc | Các cột: `lyrics` (text trơn), `synced_lyrics` (chuỗi LRC format). |

## 11. Realtime / Socket.IO / Redis nếu có
Dùng Socket.IO để nhận thông báo khi tiến trình tách Stem hoàn thành và tự động đổi qua hát Beat.

## 12. Quyền truy cập và bảo mật
- Công khai cho User đã đăng nhập.

## 13. Dữ liệu đầu vào và đầu ra
- Chuỗi LRC: `[00:00.00] Intro\n[00:15.00] Dòng 1`.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị Text mờ "Dạo nhạc..." cho những đoạn trống đầu bài hát chưa có Lyric.

## 15. Điểm đã làm tốt
- Tối ưu hóa UI/UX cực kỳ ấn tượng. Các dòng lyrics cuộn mượt mà (smooth scrolling).
- Kết hợp hoàn hảo với tính năng Stem Separation, tạo thành một Studio thu âm / Hát Karaoke hoàn chỉnh ngay trên Web.

## 16. Hạn chế hiện tại
- Việc tìm kiếm nguồn file LRC chuẩn trên mạng để gán vào Database bằng tay tốn nhiều công sức của Admin.

## 17. Đề xuất hoàn thiện
- Tích hợp API bên thứ 3 (Ví dụ Musixmatch API hoặc LrcLib) để tự động crawl lời bài hát đồng bộ nếu trong DB bị trống.

## 18. Bằng chứng mã nguồn đã kiểm tra
Logic Parse LRC thường nằm trong Frontend Component (VD: `LyricsPanel.vue`). DB schema chứa trường `synced_lyrics`.
