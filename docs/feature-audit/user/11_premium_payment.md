# Thanh toán và Nâng cấp Premium (Premium Payment)

## 1. Mục đích chức năng
Cho phép người dùng mua các gói Premium (Ví dụ: 30 ngày, 90 ngày, 365 ngày) để trải nghiệm các tính năng nâng cao (Không quảng cáo, tách giọng hát AI tốc độ cao, tải Instrumental/Beat, tạo playlist AI không giới hạn). 

## 2. Đối tượng sử dụng
- User: Xem các gói, tạo mã QR, quét mã thanh toán, và xem trạng thái giao dịch.
- Admin: (Nằm ở tài liệu Admin) Đối soát, hủy giao dịch pending, xem lịch sử giao dịch toàn hệ thống.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành rất tốt, tích hợp thực tế.
- Giải thích: Frontend có giao diện Premium bắt mắt, kết nối với cổng thanh toán SePay. User chỉ cần quét mã QR (VietQR) có sẵn số tiền và lời nhắn (payment_code). Giao diện trạng thái giao dịch sẽ tự động cập nhật qua Long-polling/Socket.IO khi có giao dịch thành công gửi về.

## 4. Luồng xử lý tổng quát
1. **Trang Gói Cước (`/premium`):** User click "Nâng cấp", frontend gọi `POST /api/payments/sepay/create` truyền `plan_id`.
2. **Khởi tạo Giao dịch (Pending):** Backend sinh một `payment_code` duy nhất (VD: `MF123456789...`), insert trạng thái `pending` vào DB `payment_transactions`, và trả về URL ảnh VietQR.
3. **Thanh toán:** User dùng App ngân hàng quét mã QR, chuyển khoản.
4. **Theo dõi (Polling):** Trong lúc user quét, trang chờ thanh toán liên tục gọi `GET /api/payments/:orderCode/status` mỗi 5-10s hoặc lắng nghe Socket.
5. **Webhook nhận kết quả:** Ngân hàng -> SePay -> Webhook Backend (`POST /api/payments/sepay/webhook`).
6. **Xác nhận (Success):** Backend đối chiếu `payment_code`, check số tiền (`transferAmount >= amount`), cập nhật trạng thái `paid` trong `payment_transactions`, đồng thời gia hạn `premium_expires_at` của User. Bắn thông báo Socket cho Frontend cập nhật UI thành công.

## 5. Luồng xử lý chi tiết
- **Trường hợp Fake/Simulate:** Hỗ trợ API `/simulate/:paymentCode` để test môi trường local/dev mà không cần chuyển tiền thật.
- **Trường hợp Quá hạn (Expired):** Nếu sau 10 phút user không chuyển khoản, giao dịch tự động chuyển `expired` qua logic lazy-check lúc lấy lịch sử hoặc cronjob ngầm.
- **Trường hợp Giao dịch bất thường:** Nếu chuyển khoản thiếu tiền hoặc dư tiền, hệ thống vẫn ghi nhận webhook nhưng đánh dấu `partial_paid` hoặc `overpaid`, user phải liên hệ admin để gỡ rối. Tính năng "Đối soát" (Reconcile) của Admin dùng cho các trường hợp Webhook tới trễ.
- **Trường hợp Active Fallback:** Ở API `getTransactionStatus`, nếu giao dịch đang `pending`, backend thực hiện Fallback Check gọi ngược API SePay (hoặc chạy logic `reconcilePendingSepayPayments`) để lôi dữ liệu về trong trường hợp Webhook bị rớt mạng. Điều này đảm bảo user không bị kẹt ở màn hình Pending quá lâu.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/premium/PremiumView.vue
apps/frontend/src/views/premium/CheckoutView.vue
apps/frontend/src/views/premium/PaymentSuccessView.vue
```
- `PremiumView`: Landing page giới thiệu tính năng và bảng giá (Pricing Table).
- `CheckoutView`: Trang hiển thị QR Code và Modal đếm ngược (Countdown) 10 phút.
- `PaymentSuccessView`: Màn hình pháo hoa ăn mừng khi nhận tín hiệu thành công.

## 7. Vị trí code backend
```txt
apps/backend/src/routes/payments.routes.js
apps/backend/src/controllers/payments.controller.js
apps/backend/src/services/payment.service.js
```
- `payments.controller.js`: Chứa hàm tạo giao dịch, lấy status, và Endpoint hứng Webhook.

## 8. Vị trí code AI service nếu có
Không liên quan trực tiếp. Mặc dù Premium mở khóa tính năng AI, nhưng flow thanh toán thì không gọi AI.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/payments/plans` | Xem danh sách gói | Không | `payments.controller.js` |
| POST| `/api/payments/sepay/create`| Tạo order + QR code| Có | `payments.controller.js` |
| GET | `/api/payments/:code/status`| Polling trạng thái| Có | `payments.controller.js` |
| POST| `/api/payments/sepay/webhook`| Hứng webhook từ SePay| Server-to-Server | `payments.controller.js` |
| GET | `/api/payments/my-premium`| Lấy trạng thái gói hiện tại| Có | `payments.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `premium_plans` | Bảng giá | Đọc | Lấy giá tiền và hạn ngày |
| `payment_transactions` | Giao dịch cụ thể | Đọc/Ghi | Status: pending, paid, cancelled, expired |
| `user_subscriptions` | Lịch sử gói | Đọc/Ghi | (Tùy chọn) Tracking chi tiết |
| `users` | Cập nhật hạn | Ghi | Cột `premium_expires_at` |

## 11. Realtime / Socket.IO / Redis nếu có
- Socket.IO cực kỳ quan trọng: Trong `handleSepayWebhook`, khi giao dịch thành công, backend gọi `confirmPayment(..., io)`. Service `payment.service.js` sẽ bắn event `payment:success` vào phòng (room) của user đó, giúp UI chuyển ngay lập tức sang trang Thành công mà không cần F5.
- Cấu trúc: `io.to(userId.toString()).emit('payment:success', { orderCode })`.

## 12. Quyền truy cập và bảo mật
- Endpoint Webhook `/api/payments/sepay/webhook` bắt buộc phải có Authorization Bearer là Secret Token cấu hình trên portal SePay, chống Request giả mạo nạp tiền khống.
- Transaction của ai thì chỉ người đó được xem trạng thái (Check ID).

## 13. Dữ liệu đầu vào và đầu ra
- **Tạo Giao dịch:** `{ "plan_id": 2 }` -> Output JSON chứa `qr_code_url` (URL VietQR), `payment_code` (Nội dung CK), và `amount`.
- **Webhook Payload (SePay):** `{ "gateway": "sepay", "transferAmount": 50000, "content": "MF99...", "referenceCode": "MB123" }`.

## 14. Loading / Empty / Error state trên giao diện
- Trang Checkout có Skeleton/Loading khi đợi backend sinh QR.
- Khi Hủy thanh toán hoặc Quá 10 phút, đổi giao diện thành Error State "Giao dịch hết hạn" kèm nút Thử lại.

## 15. Điểm đã làm tốt
- VietQR chuẩn xác, sinh QR chứa sẵn số tài khoản, số tiền và nội dung CK bằng API (không phải QR tĩnh), triệt tiêu lỗi nhập sai số tiền.
- Chống nghẽn khi Webhook thất bại bằng cơ chế Fallback Check ở API GetStatus (Giao tiếp ngược lấy log chuyển khoản 24h gần nhất).

## 16. Hạn chế hiện tại
- Nếu Admin cấu hình sai Bank BIN / Bank Account trong biến môi trường `.env`, mã QR sẽ sinh sai và tiền không về ví.
- Bảng `payment_transactions` và `user_subscriptions` đang hơi nhập nhằng (có vẻ payment handle mọi thứ, còn subscription dư thừa chưa có logic Recurring tự động trừ tiền).

## 17. Đề xuất hoàn thiện
- Thống nhất bỏ hoặc gộp `user_subscriptions` nếu không triển khai Auto-Renewal (Trừ tiền tự động hàng tháng như Netflix). Ở VN thường xài gói mua đứt 1-3-12 tháng (One-time payment).
- Gửi Email xác nhận thanh toán thành công (Invoice).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/controllers/payments.controller.js`
- `apps/backend/src/routes/payments.routes.js`
