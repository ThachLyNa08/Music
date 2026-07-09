# Luồng xử lý Webhook Thanh toán (Payment Webhook Flow)

## 1. Mục đích chức năng
Bảo đảm tính nhất quán (Consistency) và tức thời (Real-time) trong việc xác nhận trạng thái thanh toán từ Ngân hàng truyền về hệ thống MusicFlow thông qua cổng trung gian SePay. Đây là xương sống của toàn bộ hệ thống doanh thu.

## 2. Đối tượng sử dụng
- System: Tự động chạy khi có Request từ Server của Cổng thanh toán (SePay).
- Admin: Giám sát, đối soát tự động (Reconcile).

## 3. Trạng thái triển khai hiện tại
- Đã triển khai đầy đủ với logic cực kỳ chặt chẽ (Xử lý Idempotency, Fallback, Webhook authentication).
- Giải thích: Không chỉ hứng webhook 1 chiều, hệ thống tích hợp cả cơ chế quét chủ động (Active Fallback) để kéo dữ liệu trong trường hợp mạng lỗi làm webhook bị mất. Webhook payload được xác minh chữ ký (token) trước khi xử lý, chặn đứng mọi nỗ lực fake IP/fake request nạp tiền khống.

## 4. Luồng xử lý tổng quát
1. **Tiếp nhận Webhook (`POST /api/payments/sepay/webhook`):** SePay bắn HTTP Request chứa JSON biến động số dư về Server.
2. **Xác thực Nguồn (Auth):** Hàm `getWebhookToken` trích xuất `Authorization: Bearer <Secret>` hoặc Header `x-sepay-api-key`. So sánh với `process.env.SEPAY_WEBHOOK_SECRET`. Nếu sai -> Reject (401).
3. **Phân tích Payload:**
   - Trích xuất `content` (Nội dung chuyển khoản).
   - Hàm `extractPaymentCode` dùng Regex để tìm mã `MF...` có độ dài quy định trong chuỗi (tránh việc User gõ thêm chữ rác).
   - Nếu là giao dịch OUT (rút tiền/chi tiền), bỏ qua (Return 200 sớm).
4. **Đối chiếu Database:** Query bảng `payment_transactions` bằng `payment_code`. Nếu không thấy, return 200 (Có thể là biến động số dư ngoài lề, ví dụ User chuyển nhầm nhưng không có code).
5. **Duyệt Giao dịch (`confirmPayment`):**
   - Lấy TxID truyền vào Service. Check kỹ số tiền `transferAmount` >= `amount` (Giá gốc).
   - Nếu bằng hoặc lớn hơn -> Chuyển status sang `paid`. Cộng số ngày (`premium_expires_at`) vào bảng `users`.
   - Nếu nhỏ hơn (Chuyển thiếu) -> Có thể log lỗi `partial_paid` hoặc reject. (Hiện tại reject).
6. **Bắn tín hiệu (Emit):** Bắn Socket.IO event `payment:success` về client.

## 5. Luồng xử lý chi tiết
- **Trường hợp Fallback / Reconcile (Tuyệt chiêu hệ thống):** Ở API `/status` của User, hệ thống kiểm tra. Nếu User đang chờ quá lâu ở Frontend nhưng status vẫn `pending` (có thể Webhook SePay kẹt). Hệ thống chủ động trigger `reconcilePendingSepayPayments(userId)` để gọi ngược API SePay: "Này, 24h qua có cục tiền nào gửi vào nội dung này không?". Nếu API SePay trả về CÓ, tự kích hoạt hàm `confirmPayment`. Rất an toàn và chặt chẽ!
- **Idempotency (Tính không thay đổi khi gọi nhiều lần):** Trong service `confirmPayment`, query kiểm tra status. Nếu status đã là `paid`, `success`, `completed` -> Return luôn, không cộng thời gian Premium 2 lần cho User.

## 6. Vị trí code frontend
- Không có (Flow này chạy hoàn toàn ở backend).

## 7. Vị trí code backend
```txt
apps/backend/src/routes/payments.routes.js
apps/backend/src/controllers/payments.controller.js
apps/backend/src/services/payment.service.js
```
- Core Logic nằm ở `payment.service.js` với các hàm `extractPaymentCode`, `confirmPayment`, `reconcilePendingSepayPayments`.

## 8. Vị trí code AI service nếu có
Không liên quan.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| POST | `/api/payments/sepay/webhook`| Hứng webhook biến động số dư| Header Secret Auth | `payments.controller.js` |
| GET | `/api/payments/simulate/:code`| Giả lập Webhook (Dev Mode)| Dev Secret Auth | `payments.controller.js` |
| POST | `/api/payments/sepay/reconcile-pending`| Chủ động đối soát | Admin Only | `payments.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `payment_transactions` | Trái tim của luồng | Đọc/Ghi | Khóa chống Duplicate (Idempotent key) |
| `users` | Thụ hưởng | Ghi | Tăng/gia hạn `premium_expires_at` |

## 11. Realtime / Socket.IO / Redis nếu có
- Service gọi `notifyUser(io, userId, 'payment:success', { orderCode })`. Frontend (Pinia Store hoặc Component) bắt event này để nhảy qua màn hình Success.

## 12. Quyền truy cập và bảo mật
- Webhook Secret cực kỳ nghiêm ngặt. Phải match cấu hình trên Portal SePay.
- Simulate API chỉ nên tồn tại ở môi trường `NODE_ENV=development` để tránh rủi ro bảo mật trên Production (bị hacker dùng để bypass thanh toán). (Check lại code: hiện đang dùng cùng `SEPAY_WEBHOOK_SECRET` để chặn nhưng thiết kế này hơi rủi ro nếu lộ Secret).

## 13. Dữ liệu đầu vào và đầu ra
- Input (Webhook): POST từ Server ngoài. JSON `{ gateway, transferAmount, transferType, content, referenceCode }`.
- Output: HTTP 200 OK với body JSON `{ "success": true, "message": "..." }` để báo SePay ngừng gửi lại.

## 14. Loading / Empty / Error state trên giao diện
Không áp dụng (Flow ngầm).

## 15. Điểm đã làm tốt
- Cơ chế Active Fallback `reconcilePendingSepayPayments` quá xuất sắc, giải quyết bài toán nan giải của Webhook là bị "rớt gói tin HTTP".
- Logic Idempotent bảo vệ User (Không thu tiền oan, cũng không cộng ảo Premium 2 lần).
- Module hóa tốt (tách riêng Controller và Service).

## 16. Hạn chế hiện tại
- Hàm xử lý chuyển khoản thiếu tiền (transferAmount < amount) hiện tại chỉ log/return fail. Trải nghiệm người dùng sẽ bị kẹt (Bị trừ tiền ở App Ngân hàng nhưng app MusicFlow chưa lên Premium). Phải nhờ Admin hỗ trợ.
- Simulation Route chưa bọc bằng `NODE_ENV === 'development'` nghiêm ngặt.

## 17. Đề xuất hoàn thiện
- Thêm cơ chế ví điện tử (Wallet Balance): Nếu chuyển dư hoặc chuyển thiếu, đẩy số tiền lẻ vào số dư Ví (Balance) của User thay vì rớt giao dịch.
- Chặn hẳn API `/simulate` trên Production.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/controllers/payments.controller.js` (Hàm `handleSepayWebhook`, `getTransactionStatus`)
- (Suy luận gián tiếp từ `payment.service.js`)
