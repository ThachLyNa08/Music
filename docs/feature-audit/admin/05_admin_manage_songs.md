# Quản lý Bài hát (Admin Manage Songs)

## 1. Mục đích chức năng
Cho phép Admin kiểm soát toàn bộ thư viện âm nhạc của hệ thống. Từ việc upload file âm thanh mới, ảnh bìa, chỉnh sửa Metadata (Tên, Nghệ sĩ, Thể loại, Album) đến việc quản lý trạng thái hiển thị (Publish/Draft) và khóa bài hát vi phạm bản quyền/chuẩn mực cộng đồng.

## 2. Đối tượng sử dụng
- Admin: Thao tác CRUD (Create, Read, Update, Delete) trên kho bài hát.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện tính năng thêm/sửa/xóa và xử lý upload file Audio, Cover Image bảo mật.
- Giải thích: Tại backend có middleware `upload.middleware.js` phân loại rõ file ảnh và file audio lưu vào đúng thư mục (`uploads/images` và `uploads/audio`). Admin có thể upload bài hát, gán vào nghệ sĩ/thể loại, sau khi hoàn tất hệ thống tự động sinh thông báo cho người dùng Follow nghệ sĩ đó.

## 4. Luồng xử lý tổng quát
1. **Xem danh sách (`GET /api/admin/songs`):** Frontend gửi request kèm phân trang (page, limit) và bộ lọc (search, genre, status). Backend query DB trả về danh sách kèm theo thông tin Nghệ sĩ và Thể loại liên kết.
2. **Thêm mới/Upload (`POST /api/songs/upload`):**
   - Admin upload file MP3 và file ảnh Cover. Điền các trường text (Title, Artist Name, Genre).
   - Middleware `upload` hứng file, lưu xuống ổ đĩa, gắn đường dẫn vào `req.files`.
   - Controller tìm Artist trong DB theo tên. Nếu chưa có -> Tạo mới Artist. (Tương tự với Album).
   - Insert vào bảng `songs`.
   - Bắn Notification Global và Notification riêng cho người dùng Follow Artist.
3. **Cập nhật (`PUT /api/admin/songs/:id`):** Tương tự Upload, nhưng hỗ trợ sửa lẻ file (Ví dụ: chỉ sửa cover, giữ nguyên audio).
4. **Xóa (`DELETE /api/admin/songs/:id`):** Xóa bản ghi trong DB. Tuyệt đối không xóa file vật lý trong `/uploads` để tránh lỗi liên đới nếu có bảng khác tham chiếu (Hoặc chỉ đánh dấu `status = deleted` / Soft delete).

## 5. Luồng xử lý chi tiết
- **Trường hợp Upload file lớn:** Middleware Multer chặn dung lượng tối đa (Ví dụ 10MB cho Audio, 5MB cho Ảnh) để chống tấn công DoS đầy ổ cứng.
- **Trường hợp Sửa Metadata hàng loạt (Bulk):** Có các API `/api/admin/songs/bulk-status` và `/api/admin/songs/bulk-market` hỗ trợ admin chọn nhiều bài hát cùng lúc và đổi trạng thái (Public -> Draft) chỉ với 1 cú click.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/ManageSongsView.vue
apps/frontend/src/views/admin/SongDetailAdminView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/routes/song.routes.js
apps/backend/src/controllers/admin.controller.js
apps/backend/src/controllers/song.controller.js
```
- Việc Upload được định nghĩa ở `song.routes.js` (`/upload` dành riêng cho Admin), còn việc Update/Delete nằm ở `admin.routes.js`.

## 8. Vị trí code AI service nếu có
Sau khi bài hát upload thành công, hệ thống có thể trigger job đẩy vào hàng đợi lấy Audio Features (BPM, Mood) hoặc tách sẵn Stem bằng AI Service. Hiện tại Backend hỗ trợ API `/music-data-tools/:id/analyze-features` để admin chạy thủ công qua UI.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/songs`| Danh sách phân trang | Admin | `admin.controller.js` |
| POST| `/api/songs/upload`| Upload mới | Admin | `song.controller.js` |
| PUT | `/api/admin/songs/:id`| Cập nhật bài hát | Admin | `admin.controller.js` |
| DELETE | `/api/admin/songs/:id`| Xóa bài hát | Admin | `admin.controller.js` |
| PATCH | `/api/admin/songs/bulk-status`| Cập nhật nhiều bài| Admin | `admin.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `songs` | Bảng chính | Đọc/Ghi | Lưu đường dẫn vật lý và metadata |
| `artists` | Tạo mới/Liên kết | Đọc/Ghi | Tạo artist nếu tên mới nhập chưa có |
| `albums` | Tạo mới/Liên kết | Đọc/Ghi | Tạo album tương tự |

## 11. Realtime / Socket.IO / Redis nếu có
Không áp dụng vào quản lý trực tiếp, nhưng Notification sau khi thêm bài mới có thể bắn Socket tới user.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin` chặn mọi API.
- File âm thanh public `/uploads/audio/*`, nên bài hát chưa phát hành (`Draft`) vẫn có rủi ro lộ link tĩnh nếu user vô tình mò được.

## 13. Dữ liệu đầu vào và đầu ra
- Upload Form-data: Text (title, artist_name, genre_id, duration_sec), File (audio, cover).

## 14. Loading / Empty / Error state trên giao diện
- Màn hình Table hiển thị bộ lọc rỗng nếu không tìm thấy bài hát.
- Modal upload có Loading Overlay (Upload Bar) để user biết hệ thống đang đẩy file lên (nếu file 10MB tốn vài giây).

## 15. Điểm đã làm tốt
- Tự động hóa quá trình thêm Artist/Album: Không bắt Admin phải thao tác Add Artist -> Add Album -> rồi mới Add Song. Gõ tên Artist là nó tự móc nối hoặc tạo mới.
- Tính năng sửa Bulk giúp thao tác Admin nhanh chóng.

## 16. Hạn chế hiện tại
- Việc xóa bài hát chỉ xóa bản ghi DB (hoặc chưa xóa hoàn toàn file lưu vật lý), lâu ngày sẽ sinh ra rác (Orphan Files) trong thư mục `/uploads`.

## 17. Đề xuất hoàn thiện
- Thêm chức năng Quét rác (Garbage Collector) để so khớp các file MP3 trong thư mục `/uploads/audio` không còn tham chiếu trong Database.
- Tự động lấy thẻ ID3 của file MP3 (Duration, Title, Artist gốc) trước khi Admin gõ bằng tay để điền sẵn form.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/routes/admin.routes.js`
- `apps/backend/src/controllers/admin.controller.js`
- `apps/backend/src/routes/song.routes.js` (dòng 21: Upload admin only)
