# Chi tiết Bài hát phía Quản trị (Admin Song Detail)

## 1. Mục đích chức năng
Cung cấp công cụ chẩn đoán (Diagnostic) cho một bài hát trên hệ thống. Không chỉ sửa tên, mà còn xem các lỗi Metadata, kiểm tra Audio Features, Lời bài hát, và lịch sử Play count để xử lý triệt để các bài hát bị hỏng/lỗi.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai. Tích hợp với tính năng Data Quality & Music Data Tools.

## 4. Luồng xử lý tổng quát
1. **Truy cập chi tiết (`GET /api/admin/songs/:id/detail`):** Backend join bảng `artists`, `albums`, `genres` để hiển thị.
2. **Kiểm tra File:** API kiểm tra xem đường dẫn file Audio và Cover có tồn tại trên đĩa cứng không (hoặc có hợp lệ không).
3. **Phân tích Audio Features (`POST /api/admin/music-data-tools/:id/analyze-features`):** Nếu bài hát thiếu nhịp độ (Tempo), Mood. Admin có thể trigger AI Service/Python Script qua Music Data Tools để trích xuất đặc trưng âm thanh.
4. **Quản lý Lyrics (`/api/admin/lyrics`):** Xem và sửa LRC/Plain text nếu bài hát bị hiển thị sai chữ trên frontend.

## 5. Luồng xử lý chi tiết
- **Trường hợp Bài hát Bị Lỗi (Broken Media):** Một bài hát nằm trong Cảnh báo Dữ liệu (Data Quality) do file `.mp3` bị xóa nhầm. Trang này sẽ tô đỏ và cung cấp nút Upload lại Audio đè lên file cũ thông qua form Update (`PUT`).

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/SongDetailAdminView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js
apps/backend/src/controllers/admin_music_data_tools.controller.js
```

## 8. Vị trí code AI service nếu có
Trực tiếp liên quan đến Script phân tích âm thanh (Librosa/Essentia) để lấy Audio Features.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/songs/:id/detail`| Info cơ bản | Admin | `admin.controller.js`|
| POST| `/api/admin/music-data-tools/:id/analyze-features`| Trích xuất AI | Admin | `admin_music_data_tools.controller.js`|
| PUT | `/api/admin/songs/:id` | Cập nhật file MP3 | Admin | `admin.controller.js`|

## 10. Database liên quan
- Bảng `songs` và `song_audio_features` (nếu có tách bảng).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Admin Only.

## 13. Dữ liệu đầu vào và đầu ra
- Output chi tiết gồm cả thông tin file (dung lượng, bitrate) nếu có lưu.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị Alert màu Đỏ/Vàng nếu dữ liệu bài hát chưa đạt chuẩn.

## 15. Điểm đã làm tốt
- Liên kết chặt chẽ với "Data Tools", giải quyết bài toán muôn thuở của các thư viện nhạc là: Data rác, file lỗi, thiếu metadata.

## 16. Hạn chế hiện tại
- Việc update File đè có thể làm hỏng bộ nhớ Cache (Browser) của user nếu URL giữ nguyên nhưng nội dung đổi.

## 17. Đề xuất hoàn thiện
- Tự động sinh chuỗi UUID hoặc Timestamp phía sau tên file mới để phá bộ đệm (Cache busting) mỗi khi Admin đổi Audio/Cover.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra `admin.routes.js` (Dòng 25: `analyze-features`).
