# Quản lý Giao dịch & Premium (Admin Payments & Premium)

## 1. Mục đích chức năng
Quản trị doanh thu, xem xét các giao dịch từ SePay (Thành công/Thất bại), hỗ trợ hoàn tiền hoặc hủy giao dịch treo. Quản lý trạng thái gói cước (Premium) của khách hàng.

## 2. Đối tượng sử dụng
- Admin (Role Kế toán / Support).

## 3. Trạng thái triển khai hiện tại
- Đã tách làm 2 controller: `admin_payments.controller.js` và `admin_premium.controller.js`.
- Giải thích: Có sẵn Bảng thống kê Giao dịch (Payments) và Bảng danh sách người dùng trả phí (Premium Users). Hỗ trợ Export báo cáo tài chính.

## 4. Luồng xử lý tổng quát
1. **Quản lý Thanh toán (Payments):**
   - API `GET /api/admin/payments` trả về mọi giao dịch (Pending, Success, Failed, Cancelled).
   - KPI Doanh thu (`GET /api/admin/payments/summary`): Tổng thu tháng, tỉ lệ nạp thành công.
   - Hủy Giao dịch Treo (`POST /api/admin/payments/:id/cancel`): Nếu SePay không nhận được tiền trong 30 phút, Admin (hoặc Cronjob) có thể chủ động Hủy (Cancel).
2. **Quản lý Gói cước (Premium):**
   - API `GET /api/admin/premium/users` liệt kê những user đang có `premium_expires_at > NOW()`.
   - Xem cấu hình gói (`GET /api/admin/premium/plans`): Giá bán, thời hạn.
   - Sửa tay (Thêm/Bớt ngày) (`POST /api/admin/premium/users/:id/update`): Cho phép gia hạn đền bù cho khách nếu hệ thống lỗi.
   - Hủy gói (`POST /api/admin/premium/users/:id/cancel`).

## 5. Luồng xử lý chi tiết
- **Trường hợp Hoàn tiền:** Chưa có luồng API hoàn tiền tự động qua ngân hàng (Refund API của SePay/VietQR không khả dụng cho cá nhân), việc Cancel chỉ có ý nghĩa ghi sổ, không kích phát chuyển tiền.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/PaymentsView.vue
apps/frontend/src/views/admin/PremiumUsersView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin_payments.controller.js
apps/backend/src/controllers/admin_premium.controller.js
```

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/payments`| Xem list giao dịch | Admin | `admin_payments.controller.js` |
| POST | `/api/admin/payments/:id/cancel`| Hủy Pending | Admin | `admin_payments.controller.js` |
| GET | `/api/admin/premium/users`| Lấy list VIP | Admin | `admin_premium.controller.js` |
| POST | `/api/admin/premium/users/:id/update`| Cấp/Sửa VIP tay | Admin | `admin_premium.controller.js` |

## 10. Database liên quan
- Bảng `payment_transactions` (Lịch sử nạp).
- Bảng `users` (Cột `premium_expires_at`).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng cho Admin. (Realtime thanh toán trả về cho khách chứ không đẩy cho trang Admin).

## 12. Quyền truy cập và bảo mật
- Phân quyền Admin nhạy cảm.

## 13. Dữ liệu đầu vào và đầu ra
- API Update Premium Input: `{ action: "add_days", value: 30 }`.

## 14. Loading / Empty / Error state trên giao diện
- Lọc theo khoảng ngày (Date Range Picker) khi xem doanh thu.

## 15. Điểm đã làm tốt
- Tách bạch Logic Payments (Giao dịch dòng tiền) và Premium (Trạng thái sử dụng dịch vụ) rất khoa học. 

## 16. Hạn chế hiện tại
- Việc "Cancel" thanh toán Pending yêu cầu làm thủ công thay vì Tự động dọn dẹp bởi Cronjob.

## 17. Đề xuất hoàn thiện
- Thêm Biểu đồ Hình Quạt (Pie Chart) để chia tỉ lệ Gói cước (Gói 1 tháng bán nhiều hơn Gói 1 năm hay không).

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra `admin.routes.js` từ dòng 83-114. File gộp cho 2 tài liệu `admin/10_admin_payments.md` và `admin/11_admin_premium.md` (Tôi ghi chép chung kiến trúc).
