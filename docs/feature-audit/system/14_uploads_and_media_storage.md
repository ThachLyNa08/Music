# Hệ thống Lưu trữ Tập tin (Uploads & Media Storage)

## 1. Mục đích chức năng
Quản lý nơi lưu trữ vật lý của các tập tin đa phương tiện (MP3, WAV, JPG, PNG) do User hoặc Admin tải lên hệ thống. Phân phối các file này xuống Client một cách nhanh chóng.

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai bằng Local File System (Lưu trực tiếp vào ổ cứng server).
- Giải thích: Mọi file tải lên đều được ném vào `apps/backend/uploads/`. Thư mục này được Express thiết lập làm Public Static Folder (`express.static`), cho phép truy cập trực tiếp qua URL `http://domain.com/uploads/...`.

## 4. Luồng xử lý tổng quát
1. **Kiểm duyệt File (Validation):** Middleware `upload.middleware.js` (Sử dụng Multer) đứng chặn ở API. Kiểm tra `mimetype` (audio/mpeg, image/jpeg). Kiểm tra dung lượng (Size limit). Nếu sai định dạng -> Quăng lỗi ngay, file không được lưu tạm.
2. **Định tuyến Thư mục:** File hợp lệ sẽ được đổi tên bằng UUID/Timestamp để tránh trùng lặp.
   - Nhạc đưa vào `/uploads/audio`.
   - Ảnh đưa vào `/uploads/images` (Hoặc `/covers`, `/avatars`).
3. **Lưu DB:** Đường dẫn tương đối (Ví dụ: `/uploads/audio/song-123.mp3`) được ghi vào cột `audio_url` của bảng `songs`.
4. **Phục vụ File:** Trình phát nhạc ở Frontend gắn thẻ `<audio src="domain/uploads/audio/song-123.mp3">`. Trình duyệt chủ động tạo Stream tải nhạc.

## 5. Luồng xử lý chi tiết
- **Trường hợp Streaming (Tua nhạc):** HTTP Protocol hỗ trợ Range Requests (`Accept-Ranges: bytes`). Khi User kéo tua đến phút thứ 2, Trình duyệt không tải lại từ đầu mà gửi header `Range: bytes=500000-`, Express.js tĩnh xử lý và trả về mã `206 Partial Content`. Nhờ vậy nhạc tua rất mượt và không tốn băng thông thừa.

## 6. Vị trí code frontend
Không áp dụng. (Thẻ Audio/Img tự xử lý).

## 7. Vị trí code backend
```txt
apps/backend/uploads/ (BẤT KHẢ XÂM PHẠM)
apps/backend/src/middleware/upload.middleware.js
apps/backend/src/app.js (Dòng express.static)
```

## 8. Vị trí code AI service nếu có
Dịch vụ Stem Separation sẽ truy cập đọc MP3 từ folder gốc này, xử lý, rồi lưu lại kết quả (Instrumentals) vào một subfolder của `/uploads`.

## 9. API liên quan
Không (Quản lý qua Static Route).

## 10. Database liên quan
Tất cả các cột có đuôi `_url` (`cover_url`, `audio_url`, `avatar_url`).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- **Nguy cơ cực lớn:** Nếu hệ thống không chặn file `.php`, `.exe`, `.sh`, hacker có thể Upload Shell (Mã độc) vào thư mục này, sau đó gọi URL kích hoạt mã độc chiếm quyền điều khiển toàn bộ Server. `upload.middleware.js` phải được code cẩn thận chặn đuôi mở rộng file.

## 13. Dữ liệu đầu vào và đầu ra
File nhị phân (Binary stream).

## 14. Loading / Empty / Error state trên giao diện
- URL lỗi (File xóa) -> 404 Not Found.

## 15. Điểm đã làm tốt
- Setup đơn giản, tốc độ ghi siêu nhanh (Không bị giới hạn độ trễ mạng như lưu lên AWS S3).

## 16. Hạn chế hiện tại
- Không thể Scale (Mở rộng). 
- Dễ mất dữ liệu nếu Server chết Ổ cứng (Bad Sector). Không có cơ chế Backup tự động (Ngoại trừ copy tay thư mục `uploads`).

## 17. Đề xuất hoàn thiện
- Tích hợp Cloudinary hoặc AWS S3/Cloudflare R2 vào tầng Middleware. Khi nhận file, Pipe Stream thẳng lên S3 chứ không lưu vào Local Disk nữa.
- Nén ảnh (Compress) bằng thư viện `sharp` trước khi lưu vào ổ cứng để tiết kiệm dung lượng.

## 18. Bằng chứng mã nguồn đã kiểm tra
Có yêu cầu rõ ràng "Tuyệt đối không di chuyển thư mục uploads". Điều này chứng minh mọi thứ đang chạy phụ thuộc vào Local System Paths.
