# Chi tiết Người dùng phía Quản trị (Admin User Detail)

## 1. Mục đích chức năng
Cung cấp góc nhìn kính lúp (Deep-dive) vào một cá nhân cụ thể. Admin có thể xem toàn bộ hành vi của người dùng đó (lịch sử nghe, sở thích, lịch sử giao dịch) để hỗ trợ (Customer Support) hoặc phân tích gian lận.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành hệ thống API truy xuất.
- Giải thích: Có trang chi tiết chứa nhiều Tab. Tab Engagement Summary, Heatmap (Biểu đồ nhiệt nghe nhạc), Transaction History, System Playlists.

## 4. Luồng xử lý tổng quát
1. **Lấy Data cơ bản (`GET /api/admin/users/:id/detail`):** Thông tin cơ bản.
2. **Lấy Engagement Summary (`GET /api/admin/users/:id/engagement-summary`):** Đếm số lượt nghe hoàn thành, số bài hát đã thích.
3. **Lấy Heatmap (`GET /api/admin/users/:id/listening-heatmap`):** Dữ liệu dạng ma trận (Thứ/Giờ) đếm số lượng bản ghi trong `listening_history`. Phục vụ vẽ biểu đồ hoạt động.
4. **Lịch sử Thanh toán (`GET /api/admin/payments?userId=...`):** Tìm kiếm giao dịch của người này.
5. **Recommendations Preview (`GET /api/admin/recommendation/users/:id/preview`):** Xem trước AI đang gợi ý gì cho ông này.

## 5. Luồng xử lý chi tiết
- **Trường hợp Debug Thuật toán:** Admin vào Tab Recommendations Preview để xem kết quả. Giúp kiểm tra xem mô hình AI (Matrix Factorization) có hoạt động đúng với sở thích thực tế của User này ở Tab Engagement hay không.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/UserDetailAdminView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js
```

## 8. Vị trí code AI service nếu có
Dùng API AI Recommendation Preview.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/users/:id/detail`| Info cơ bản | Admin | `admin.controller.js`|
| GET | `/api/admin/users/:id/engagement-summary`| Tương tác| Admin | `admin.controller.js`|
| GET | `/api/admin/users/:id/listening-heatmap`| Biểu đồ giờ/ngày | Admin | `admin.controller.js`|

## 10. Database liên quan
- Tra cứu bảng `listening_history`, `song_likes`, `payment_transactions`, `playlists`.

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Rất nhạy cảm về quyền riêng tư. Chỉ Admin mới được truy cập dữ liệu hành vi của user. (Có thể vi phạm GDPR nếu nền tảng ở Châu Âu, nhưng ở mức đồ án/startup thì tính năng này rất cần để CSKH).

## 13. Dữ liệu đầu vào và đầu ra
- Heatmap Output: Mảng các object `{ dayOfWeek: 2, hour: 14, count: 5 }`.

## 14. Loading / Empty / Error state trên giao diện
- Nếu user chưa nghe bài nào, tab Engagement / Heatmap hiển thị "Không có dữ liệu tương tác".

## 15. Điểm đã làm tốt
- Cung cấp một bộ công cụ phân tích cá nhân (Micro-analytics) cực kỳ chuyên sâu thay vì chỉ có form "Đổi tên, đổi pass" như các Admin Panel sơ sài.

## 16. Hạn chế hiện tại
- Việc query thẳng vào `listening_history` bằng `GROUP BY DAY, HOUR` tốn tài nguyên DB nếu User đó có quá nhiều data (Hàng chục ngàn lượt nghe).

## 17. Đề xuất hoàn thiện
- Đẩy logic tính toán Heatmap xuống Cronjob hoặc chỉ query giới hạn trong 90 ngày gần nhất.

## 18. Bằng chứng mã nguồn đã kiểm tra
Các endpoint này đã được định nghĩa trong file `admin.routes.js` (từ dòng 73-75).
