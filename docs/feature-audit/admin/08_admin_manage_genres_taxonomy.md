# Quản lý Thể loại & Phân loại (Admin Manage Genres & Taxonomy)

## 1. Mục đích chức năng
Quản trị kho thể loại âm nhạc. Điểm nổi bật là "Taxonomy Flags" (Cờ phân loại) giúp cấu hình loại nhạc nào được đưa vào Recommendation, loại nào được đưa vào AI Playlist.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Hoàn thiện module.
- Giải thích: Không chỉ CRUD đơn giản, nó hỗ trợ Merge (Trộn thể loại), Bulk Assign (Gán hàng loạt bài hát vào thể loại mới), và đặc biệt là Cờ Taxonomy (`is_recommendation_ready`, `is_ai_playlist_ready`).

## 4. Luồng xử lý tổng quát
1. **Lấy danh sách & Insights (`GET /api/admin/genres/insights`):** Báo cáo số lượng bài hát mỗi thể loại, xu hướng.
2. **Cập nhật Cờ Taxonomy (`PATCH /api/admin/genres/:id/taxonomy-flags`):** Nếu một thể loại có quá ít bài hát (Vd: "Nhạc thính phòng" có 2 bài), thuật toán AI sẽ bị lỗi (Cold start). Admin có thể TẮT cờ `is_recommendation_ready` để AI bỏ qua thể loại này.
3. **Trộn thể loại (Merge) (`POST /api/admin/genres/merge`):** Nếu có "V-Pop" và "Nhạc Việt", Admin có thể gộp chúng lại, toàn bộ bài hát thuộc "Nhạc Việt" sẽ chuyển sang "V-Pop", sau đó xóa "Nhạc Việt".
4. **Gán hàng loạt (`POST /api/admin/genres/bulk-assign`):** Di chuyển nhiều bài hát sang thể loại khác.

## 5. Luồng xử lý chi tiết
- **Trường hợp Trộn (Merge):** Dùng lệnh SQL Update `genre_id` trong bảng `songs` nơi `genre_id = source_id`, set thành `target_id`. Sau đó Delete `source_id`. Phải chạy trong DB Transaction để tránh mất dữ liệu nếu đứt mạng giữa chừng.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/ManageGenresView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js (dòng 157)
apps/backend/src/controllers/admin_genre.controller.js
```

## 8. Vị trí code AI service nếu có
Ảnh hưởng trực tiếp đến Training Pipeline của AI. Dữ liệu lấy ra để Train chỉ được chọn từ những Genre có Cờ Taxonomy bật (ON).

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/admin/genres/merge` | Trộn thể loại | Admin | `admin_genre.controller.js`|
| PATCH | `/api/admin/genres/:id/taxonomy-flags`| Bật/tắt cờ | Admin | `admin_genre.controller.js`|

## 10. Database liên quan
- Bảng `genres` (Ghi cờ) và `songs` (Update khóa ngoại).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Admin Only.

## 13. Dữ liệu đầu vào và đầu ra
- API Merge Input: `{ sourceId: 10, targetId: 5 }`.

## 14. Loading / Empty / Error state trên giao diện
- Cảnh báo xác nhận (Confirm Dialog) khi Merge vì hành động không thể hoàn tác (Irreversible).

## 15. Điểm đã làm tốt
- Tư duy "Taxonomy Center" thể hiện sự trưởng thành về Data Engineering, biết kiểm soát Dữ liệu Đầu vào (Garbage In - Garbage Out) của AI. 

## 16. Hạn chế hiện tại
- Việc Merge Genres sẽ làm sai lệch file CSV Profile đã Export để Train AI trước đó. AI cần phải được Retrain sau những lần dọn dẹp dữ liệu lớn thế này.

## 17. Đề xuất hoàn thiện
- Thêm cơ chế Sub-genre (Thể loại cha - con). Ví dụ Cha: Pop, Con: K-pop, V-pop. Tối ưu cho UI User.

## 18. Bằng chứng mã nguồn đã kiểm tra
Code route có sẵn ở `admin.routes.js` từ dòng 157 (`adminGenreController.mergeGenres`, `bulkAssignGenre`).
