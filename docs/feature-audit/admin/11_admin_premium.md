# Quản lý Gói cước Premium (Admin Premium)

## 1. Mục đích chức năng
Quản trị danh sách người dùng đang sử dụng gói trả phí (Premium). Giúp Admin thống kê số lượng VIP Users, cảnh báo các tài khoản sắp hết hạn, đồng thời hỗ trợ thao tác thủ công (cấp thêm ngày, hủy gói) khi cần giải quyết khiếu nại.

## 2. Đối tượng sử dụng
- Admin.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai.
- Giải thích: Tại Admin Panel có trang Quản lý Premium. Hiển thị danh sách người dùng có cờ Premium, ngày kích hoạt, ngày hết hạn. Bảng tóm tắt (Summary) thống kê nhanh tỷ lệ phần trăm tài khoản Premium trên tổng số user.

## 4. Luồng xử lý tổng quát
1. **Lấy Danh sách VIP (`GET /api/admin/premium/users`):** Lọc ra các `users` có cột `premium_expires_at > NOW()`.
2. **Cập nhật thủ công (`POST /api/admin/premium/users/:id/update`):** Khi Admin muốn tặng thêm ngày sử dụng (Ví dụ: Server sập, đền bù khách 3 ngày), Frontend gửi action `add_days` và `value = 3`. Backend update `premium_expires_at`.
3. **Hủy gói (`POST /api/admin/premium/users/:id/cancel`):** Đặt `premium_expires_at = NULL` hoặc bằng quá khứ. Ngay lập tức người dùng mất quyền lợi nghe nhạc chất lượng cao.
4. **Cấu hình giá (`GET /api/admin/premium/plans`):** (Tương lai) Quản lý các cấu hình gói như 1 Tháng (49k), 1 Năm (499k).

## 5. Luồng xử lý chi tiết
- **Trường hợp Gia hạn:** Nếu User đang còn 5 ngày, Admin cộng thêm 3 ngày, Backend phải tính toán cẩn thận cộng dồn thành 8 ngày (Từ `premium_expires_at` hiện tại), không phải tính từ ngày bấm.
- **Trường hợp Hết hạn:** Hệ thống không xóa dữ liệu, chỉ là so sánh `NOW() > premium_expires_at` trong Middleware `requirePremium`, nếu đúng thì tự rớt hạng xuống Free. Không cần Cronjob chạy hàng ngày để quét khóa tài khoản.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/PremiumUsersView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js (dòng 83-90)
apps/backend/src/controllers/admin_premium.controller.js
```

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/premium/summary` | KPI Premium | Admin | `admin_premium.controller.js`|
| GET | `/api/admin/premium/users` | List User VIP | Admin | `admin_premium.controller.js`|
| POST| `/api/admin/premium/users/:id/update`| Cấp/Sửa VIP | Admin | `admin_premium.controller.js`|
| POST| `/api/admin/premium/users/:id/cancel`| Hủy VIP | Admin | `admin_premium.controller.js`|

## 10. Database liên quan
- Bảng `users` (Đọc/Ghi cột `premium_expires_at`).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin`. Tránh lạm dụng tính năng cấp VIP bừa bãi.

## 13. Dữ liệu đầu vào và đầu ra
- API Update VIP: `{ action: "add_days", value: 30 }`.

## 14. Loading / Empty / Error state trên giao diện
- Có biểu đồ Pie Chart nhỏ hiển thị tỷ lệ Active / Expired.

## 15. Điểm đã làm tốt
- Sử dụng hàm DATE trong SQL để quản lý thời hạn linh hoạt. Logic tính toán ngày đền bù được xử lý cẩn thận ở Backend.

## 16. Hạn chế hiện tại
- Chưa có Audit Log ghi lại hành động của Admin (Admin A đã cấp 30 ngày cho User B vào lúc nào).

## 17. Đề xuất hoàn thiện
- Thêm Bảng `admin_logs` để Audit các thao tác cập nhật Premium.

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra khối mã Route `// Quản lý Premium` tại `admin.routes.js`.
