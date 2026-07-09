# Quản lý Nghệ sĩ & Album (Admin Manage Artists & Albums)

## 1. Mục đích chức năng
Quản trị toàn diện danh mục Nghệ sĩ và Album. Mặc dù khi upload bài hát mới, hệ thống tự động sinh Artist/Album, nhưng trang này cung cấp cho Admin khả năng Edit chuyên sâu (Ảnh đại diện nghệ sĩ, Tiểu sử, Đồng bộ hóa dữ liệu tự động).

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã có đầy đủ các endpoint phục vụ Frontend quản lý.
- Giải thích: Có trang liệt kê Albums và Artists riêng biệt. Tính năng đột phá là "Sync Missing Metadata" và "Sync Bio". Admin có thể tự động crawl dữ liệu Nghệ sĩ còn thiếu thay vì phải Google và Copy-Paste thủ công.

## 4. Luồng xử lý tổng quát
1. **Danh sách Nghệ sĩ/Album (`GET /api/admin/artists`, `GET /api/admin/albums`):** Lấy danh sách, phân trang, lọc.
2. **Cập nhật Ảnh (`PUT /api/admin/artists/:id`):** Dùng chung `upload.middleware` để upload ảnh `avatar`.
3. **Đồng bộ Tự động (`POST /api/admin/artists/:id/sync-metadata`):** Backend chọc ra ngoài (API Spotify hoặc Wikipedia hoặc AI Service) để tìm kiếm Bio và Ảnh dựa trên `artist_name`. Ghi đè vào database.
4. **Quản lý Bài hát trong Album (`PUT /api/admin/albums/:id/songs/reorder`):** Sắp xếp thứ tự các track (Track number) bên trong 1 Album.

## 5. Luồng xử lý chi tiết
- **Trường hợp Nghệ sĩ Vô danh:** Nếu `sync-metadata` không tìm thấy kết quả từ nguồn bên ngoài (Ví dụ ca sĩ Indie), Backend sẽ không ghi đè dữ liệu cũ.
- **Tính năng Bulk Sync:** Admin có thể gọi `/api/admin/artists/sync-missing-bio` để hệ thống tự động dò tìm và điền tiểu sử cho TẤT CẢ các nghệ sĩ đang bị trống.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/ManageArtistsView.vue
apps/frontend/src/views/admin/ManageAlbumsView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js (Phần xử lý Artists và Albums)
```

## 8. Vị trí code AI service nếu có
Việc sinh tiểu sử (Bio) có thể gọi trực tiếp sang OpenAI/Gemini để "Viết 1 đoạn giới thiệu 50 chữ về ca sĩ Sơn Tùng M-TP".

## 9. API liên quan
Nổi bật:
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/admin/artists/sync-missing-bio`| Crawl Bio hàng loạt| Admin | `admin.controller.js`|
| POST | `/api/admin/artists/:id/sync-metadata`| Crawl data lẻ | Admin | `admin.controller.js`|
| PUT | `/api/admin/albums/:id/songs/reorder`| Đổi thứ tự track | Admin | `admin.controller.js`|

## 10. Database liên quan
- Tra cứu bảng `artists`, `albums`, `songs`.

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin`.

## 13. Dữ liệu đầu vào và đầu ra
- API Reorder Input: `{ songIds: [3, 1, 5] }`

## 14. Loading / Empty / Error state trên giao diện
- Thanh toán trình chạy dài (Progress bar) khi chạy Bulk Sync.

## 15. Điểm đã làm tốt
- Tính năng Tự động Đồng bộ (Sync) tiết kiệm hàng trăm giờ nhập liệu thủ công (Data Entry) cho Admin. Rất phù hợp với hệ thống làm tự động hóa.

## 16. Hạn chế hiện tại
- Việc Sync từ API ngoài nếu quá nhanh có thể bị block IP (Rate limit). Cần cấu trúc Queue và độ trễ (Delay).

## 17. Đề xuất hoàn thiện
- Đẩy tiến trình Bulk Sync sang Background Task (BullMQ).
- Hỗ trợ "Merge Artist" (Trộn 2 nghệ sĩ vào làm 1 nếu Admin lỡ gõ sai chính tả tạo ra 2 bản ghi giống nhau).

## 18. Bằng chứng mã nguồn đã kiểm tra
Code route có sẵn ở `admin.routes.js` dòng 132-156.
