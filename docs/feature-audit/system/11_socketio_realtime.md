# Mạng Thời gian thực Socket.IO (Realtime Socket.IO)

## 1. Mục đích chức năng
Xóa bỏ giới hạn truyền thống của REST API (Chỉ có Client hỏi - Server trả lời). Bổ sung khả năng Giao tiếp Hai chiều (Bi-directional), cho phép Server chủ động "đẩy" (Push) dữ liệu xuống Client. Mở khóa hàng loạt tính năng cao cấp như: Chat, Thông báo, Listen Together, Cập nhật thanh toán.

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai hoàn chỉnh với quy mô Room-based.
- Giải thích: Server khởi tạo `socket.io`. Mọi client khi đăng nhập sẽ tạo kết nối và join vào Room cá nhân (`user:{userId}`). Middleware của Socket.IO kiểm tra JWT Token (Handshake) để xác thực người dùng. File `socket.service.js` xuất (Export) ra các hàm tiện ích (`emitChatMessage`, `emitPaymentSuccess`) để các Controller có thể gọi dễ dàng.

## 4. Luồng xử lý tổng quát
1. **Khởi tạo (Handshake):** Khi tải trang web, Vue.js gọi `io(URL, { auth: { token: JWT } })`.
2. **Xác thực:** Backend Socket.IO chặn event `connection`, parse Token. Nếu hợp lệ, cho phép kết nối.
3. **Join Room (Phân cụm):** 
   - Backend gọi `socket.join('user:' + userId)`.
   - Khi chat, Backend gọi `socket.join('conversation:' + convId)`.
4. **Phát tín hiệu (Emit):**
   - Khi có người gửi tin nhắn, Server nhận, lưu DB, rồi gọi `io.to('conversation:' + convId).emit('chat:new_message', data)`.
   - Khi tách Stem (Karaoke) thành công, Server gọi `io.to('user:' + userId).emit('stem:completed', data)`.
5. **Client Lắng nghe (Listen):** 
   - Vue Component `mounted()` đăng ký các hàm `socket.on(...)` để nhận data và cập nhật UI (Vue Store).

## 5. Luồng xử lý chi tiết
- **Trường hợp Trùng lặp Tab (Multiple Tabs):** Một user mở 3 tab trình duyệt sẽ có 3 socket kết nối khác nhau, nhưng cả 3 đều được gán chung vào room `user:5`. Khi Server gửi thông báo thanh toán `io.to('user:5')`, cả 3 tab đều nhận được và hiển thị chung 1 popup, không bị miss data.
- **Trường hợp Đứt kết nối (Disconnect):** Socket.IO có cơ chế tự động reconnect. Khi Reconnect thành công, có thể xảy ra tình trạng Missed Events, do đó luôn phải kết hợp với REST API để đồng bộ những tin nhắn lỡ.

## 6. Vị trí code frontend
```txt
apps/frontend/src/plugins/socket.js (Nơi khởi tạo instance)
apps/frontend/src/App.vue (Nơi lắng nghe sự kiện Global như notification, payment)
```

## 7. Vị trí code backend
```txt
apps/backend/src/services/socket.service.js
```

## 8. Vị trí code AI service nếu có
Không kết nối trực tiếp, FastAPI gửi tín hiệu HTTP Webhook về Node.js, Node.js dịch nó ra Socket.IO Push.

## 9. API liên quan
Không áp dụng (Chạy qua TCP/WebSockets).

## 10. Database liên quan
Không trực tiếp.

## 11. Realtime / Socket.IO / Redis nếu có
Tên các Event quan trọng:
- `chat:new_message`, `chat:message_deleted`, `chat:reaction_updated`
- `listen_together:session_started`, `listen_together:sync_play`
- `notification:new`
- `payment:success`, `stem:completed`

## 12. Quyền truy cập và bảo mật
- Xác thực bằng JWT ngay lúc Handshake (Bảo mật).

## 13. Dữ liệu đầu vào và đầu ra
(Theo chuẩn JSON của Socket.IO).

## 14. Loading / Empty / Error state trên giao diện
Không áp dụng trực tiếp.

## 15. Điểm đã làm tốt
- Gom các thao tác emit phức tạp vào `socket.service.js` và Export ra ngoài. Giúp các Controller (như `message.controller.js`) không bị phình to logic Socket, code cực kỳ Clean (Sạch).

## 16. Hạn chế hiện tại
- Nếu dự án có 2 Backend Server (Scale Horizontal), User A cắm ở Server 1, User B cắm ở Server 2. Khi User A gửi tin cho User B, Server 1 gửi Socket nhưng User B sẽ KHÔNG NHẬN ĐƯỢC vì khác instance.

## 17. Đề xuất hoàn thiện
- Cài đặt `socket.io-redis-adapter`. Tất cả các Backend Server sẽ liên lạc với nhau qua Redis Pub/Sub, đảm bảo Socket Event được phát tới mọi ngóc ngách của hệ thống dù User đang kết nối vào Server vật lý nào.

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra `socket.service.js` qua các lời gọi từ `message.controller.js` ở đợt review trước.
