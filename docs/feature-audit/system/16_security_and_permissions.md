# Bảo mật, Phân quyền & Giới hạn (Security & Permissions)

## 1. Mục đích chức năng
Thiết lập các chốt chặn (Guard) xuyên suốt hệ thống để ngăn chặn tấn công mạng, chống leo thang đặc quyền (Privilege Escalation), và bảo vệ tài nguyên trả phí (Premium).

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Đã được nhúng chặt (Hard-coded) vào kiến trúc Express Router.

## 4. Luồng xử lý tổng quát
1. **Tầng Request (Cổng vào):**
   - **CORS:** Chỉ cho phép Domain của Frontend được phép gọi API (Chặn tấn công XHR từ web lạ).
   - **Rate Limiting:** Chặn ddos bằng cách giới hạn số IP (Nếu có cấu hình ngầm `helmet` hoặc `express-rate-limit`).
2. **Tầng Auth (Định danh):**
   - Middleware `authenticate`: Ép mọi người dùng phải có JWT hợp lệ. (Sử dụng cho tất cả API User).
3. **Tầng Role/Permissions (Phân quyền):**
   - Middleware `requireAdmin`: Truy vấn role, chặn truy cập `/api/admin/*`. 
   - Middleware `requirePremium`: Kiểm tra cờ `premium_expires_at > NOW()`, chặn các tính năng như Tách Beat, Nghe Lossless.
4. **Tầng Ownership (Sở hữu tài nguyên):**
   - Middleware hoặc Logic `assertCanEditPlaylist`: Mặc dù User có Token, nhưng sửa Playlist số ID 15 mà ID đó của User khác tạo thì vẫn văng lỗi 403. Ngăn tấn công IDOR (Insecure Direct Object Reference).

## 5. Luồng xử lý chi tiết
- **Trường hợp Upload File:** Middleware Multer đã chặn (Filtering) extension độc hại (Không cho up `.php`, `.exe`). Ngoài ra, File sau khi Upload được đổi tên (Hash) để Hacker không đoán được đường dẫn nhúng mã độc.
- **Trường hợp Thanh toán Webhook:** Ngăn chặn làm giả giao dịch SePay (Tự bắn API báo nạp 1 triệu). Có kiểm tra Cờ API Key SePay và đối soát số tiền (Amount Matching).

## 6. Vị trí code frontend
Không (Tuy có Route Meta Auth ở Vue Router nhưng dễ bị Bypass).

## 7. Vị trí code backend
```txt
apps/backend/src/middleware/auth.middleware.js
apps/backend/src/middleware/upload.middleware.js
apps/backend/src/routes/*.js
```

## 8. Vị trí code AI service nếu có
Được ẩn đằng sau Proxy/Node.js, đóng Port 8000.

## 9. API liên quan
Toàn bộ.

## 10. Database liên quan
- Bảng `users` (Check role).

## 11. Realtime / Socket.IO / Redis nếu có
Xác thực Token khi Socket Handshake. Ngăn Hacker nghe lén (Eavesdropping) tin nhắn của Room khác.

## 12. Quyền truy cập và bảo mật
Cốt lõi của Hệ thống.

## 13. Dữ liệu đầu vào và đầu ra
Không có.

## 14. Loading / Empty / Error state trên giao diện
Lỗi `401 Unauthorized` hoặc `403 Forbidden`.

## 15. Điểm đã làm tốt
- Phân tầng bảo mật rất sâu (Defense in Depth). 

## 16. Hạn chế hiện tại
- Nếu Database bị rò rỉ (SQL Injection), thì Data sẽ mất sạch vì chưa có mã hóa (Encryption) các trường nhạy cảm như Tên, Lịch sử nghe (Ngoại trừ Password đã băm).

## 17. Đề xuất hoàn thiện
- Áp dụng ORM hoặc query Builder chuyên sâu (Ví dụ Prisma/Knex) nếu muốn phòng ngừa 100% SQL Injection từ các chuỗi Search chưa được Escape (Dù thư viện `mysql2` pool hỗ trợ Prepared Statements khá tốt).

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra cấu trúc Middleware bảo vệ các tuyến API nhạy cảm.
