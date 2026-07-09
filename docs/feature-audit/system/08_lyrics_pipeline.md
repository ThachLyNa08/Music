# Luồng xử lý Lời bài hát (Lyrics Pipeline)

## 1. Mục đích chức năng
Quản lý vòng đời của Lời bài hát: Từ lúc lưu trữ (chuỗi LRC / Plain Text) trong Database, cho đến quá trình xử lý ngầm (Crawling) và bước hiển thị (Parsing) đồng bộ thời gian ở Client.

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai.
- Giải thích: Bảng `songs` cung cấp 2 trường `lyrics` (Chữ thuần) và `synced_lyrics` (Định dạng LRC `[00:15.5]`). Có công cụ xuất danh sách (Export Backlog) các bài hát đang trống lời để Admin xử lý. 

## 4. Luồng xử lý tổng quát
1. **Lưu trữ DB:** `synced_lyrics` chứa Text có gắn timestamp.
2. **Crawl Lời tự động (Nếu có phát triển API crawler):** Backend có thể tích hợp dịch vụ từ Musixmatch API, Spotify API hoặc LrcLib để tự động cào (Crawl) lyric về lưu vào DB.
3. **Parse (Phân tích cú pháp):** Thực hiện chủ yếu tại Frontend (`LyricsPanel.vue`).
   - Tách chuỗi gốc bằng ký tự xuống dòng `\n`.
   - Dùng Regex `\[(\d{2}):(\d{2}\.\d+)\](.*)` để tách phút, giây và chữ.
   - Tính toán ra số Giây tuyệt đối: `(Phút * 60) + Giây`.
   - Lưu vào mảng Objects `{ time: 15.5, text: "Ah!" }`.
4. **Đồng bộ thời gian thực:**
   - Khi bài hát đang phát (`timeupdate`), tìm kiếm dòng Lyric có `time <= currentTime` gần nhất để gán class `active`.

## 5. Luồng xử lý chi tiết
- **Trường hợp Lời Plain Text (Fallback):** Nếu Regex Parse LRC trả về mảng rỗng (Vì chữ không có ngoặc vuông Timestamp), hệ thống hiểu đây là Lời thuần túy. Giao diện sẽ cuộn tay.

## 6. Vị trí code frontend
```txt
apps/frontend/src/components/player/LyricsPanel.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/controllers/admin_lyrics.routes.js (Nếu có)
```

## 8. Vị trí code AI service nếu có
(Tương lai) Dùng Whisper Model để tự động Transcription âm thanh ra file LRC.

## 9. API liên quan
Không áp dụng. Trả kèm trong API lấy Song Detail.

## 10. Database liên quan
Cột `lyrics`, `synced_lyrics`.

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
Không giới hạn.

## 13. Dữ liệu đầu vào và đầu ra
Không.

## 14. Loading / Empty / Error state trên giao diện
Không.

## 15. Điểm đã làm tốt
- Chia ra 2 loại cột `lyrics` và `synced_lyrics` rõ ràng, giúp ứng dụng không bị phụ thuộc hoàn toàn vào file LRC (Vốn dĩ hiếm có ở nhạc Indie).

## 16. Hạn chế hiện tại
- Việc Parse LRC ở mỗi thiết bị client có thể gây trễ (Lag) nhẹ nếu file LRC quá dài (Nhạc 1 tiếng đồng hồ), dù không đáng kể. Tốt nhất là parse ở Backend và trả JSON.

## 17. Đề xuất hoàn thiện
- Dời logic Parse LRC về Node.js. Node.js đọc LRC, chuyển thành mảng JSON `{ time, text }` rồi gửi cho Frontend. Frontend đỡ tốn CPU cắt chuỗi.

## 18. Bằng chứng mã nguồn đã kiểm tra
Khung logic bám sát định dạng DB Schema của dự án.
