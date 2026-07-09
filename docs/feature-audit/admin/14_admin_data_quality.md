# Giám sát Chất lượng Dữ liệu (Admin Data Quality & Health)

## 1. Mục đích chức năng
(Gộp chung Data Quality và System Health). Cung cấp cái nhìn toàn cảnh về độ "Sạch" của Data và độ "Khỏe" của Server. Giúp Admin phát hiện những bài hát bị mất file MP3 (Link chết), bài hát thiếu Metadata quan trọng, và theo dõi trạng thái sống sót (Uptime) của các API bên ngoài.

## 2. Đối tượng sử dụng
- Admin (Role Data Manager / SysOps).

## 3. Trạng thái triển khai hiện tại
- Đã được lập trình.
- Giải thích: Backend có Endpoint xuất ra Báo cáo "Metadata Issues" và "Data Quality Issues". Chức năng này sẽ Query toàn bộ database tìm ra những dòng nào bị NULL ở các cột bắt buộc, hoặc kiểm tra tính hợp lệ của File. Có kiểm tra API FastAPI/AI Status.

## 4. Luồng xử lý tổng quát
1. **Kiểm tra Bài hát/Nghệ sĩ Lỗi (`GET /api/admin/data-quality/issues`):** 
   - Truy vấn MySQL: `SELECT id FROM songs WHERE audio_url IS NULL OR cover_url IS NULL`.
   - Truy vấn Nghệ sĩ: Tìm các ID không có Bio hoặc Avatar.
2. **Theo dõi File Hệ Thống (`GET /api/admin/data-quality/summary`):** Thống kê theo số lượng (Vd: "Có 50 bài hát lỗi File", "20 thể loại bị Rỗng").
3. **Theo dõi AI Server (`GET /api/admin/ai-status`):** Bắn Ping HTTP đến `apps/ai-service` (FastAPI ở cổng 8000). Nếu trả về 200, đánh dấu màu Xanh. Nếu Timeout, đánh dấu màu Đỏ (Offline).
4. **Export Dữ liệu (`GET /api/admin/music-data-tools/lyrics-backlog/export`):** Kéo xuất danh sách những bài hát chưa có Lyrics để Admin phân công cho CTV nhập liệu.

## 5. Luồng xử lý chi tiết
- **Trường hợp Link Ảnh chết (Broken Media):** Một số ảnh URL (Ví dụ lấy từ mạng lưới ngoài thay vì `/uploads`) có thể bị Error 404 sau 1 thời gian. Nếu Backend rảnh rỗi, có thể chạy Cronjob đi Ping từng Link Ảnh để rà soát tự động, nhưng hiện tại chủ yếu query tìm NULL/Rỗng.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/DataQualityView.vue
apps/frontend/src/views/admin/DashboardView.vue (Widget System Health)
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js (dòng 37-38, 49)
apps/backend/src/controllers/admin.controller.js
apps/backend/src/controllers/admin_music_data_tools.controller.js
```

## 8. Vị trí code AI service nếu có
Có API `/ai-status` chuyên gọi Ping chéo đến `apps/ai-service` để check sức khỏe mô hình tách Stem và API Recommendation.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/data-quality/summary`| KPI Data | Admin | `admin.controller.js`|
| GET | `/api/admin/data-quality/issues` | Danh sách Data lỗi| Admin | `admin.controller.js`|
| GET | `/api/admin/ai-status` | Sức khỏe FastAPI| Admin | `admin.controller.js`|
| GET | `/api/admin/songs/metadata-issues`| Báo cáo MP3 hỏng| Admin | `admin.controller.js`|

## 10. Database liên quan
- Toàn bộ cơ sở dữ liệu. Tìm kiếm `IS NULL` hoặc `length(field) = 0`.

## 11. Realtime / Socket.IO / Redis nếu có
Không.

## 12. Quyền truy cập và bảo mật
- Admin Only.

## 13. Dữ liệu đầu vào và đầu ra
- Output Data Quality: `{ "missingAudio": 5, "missingCover": 12, "emptyGenres": 2 }`.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị danh sách Table với nút Action "Sửa ngay" (Link thẳng tới trang Song Detail / Artist Detail).

## 15. Điểm đã làm tốt
- Xây dựng được module Music Data Tools rất uy tín. Hệ thống tự chỉ ra điểm khiếm khuyết của nó thay vì đợi người dùng khiếu nại "Bài này bấm vào không nghe được".

## 16. Hạn chế hiện tại
- Check URL ngoài Internet (ví dụ Spotify CDN cover) chưa thể làm Realtime vì tốn băng thông.

## 17. Đề xuất hoàn thiện
- Thêm cảnh báo bằng Bot Telegram mỗi khi tỷ lệ Data Lỗi vượt ngưỡng 5% tổng dung lượng DB.

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra khai báo route ở `admin.routes.js` dòng 19-27, 37-38, 49. (Tài liệu này gộp cấu trúc cho file số 14 và 15 của thư mục admin).
