# Tin nhắn và Nghe nhạc chung (Messaging & Listen Together)

## 1. Mục đích chức năng
Biến MusicFlow thành một mạng xã hội âm nhạc thu nhỏ. Người dùng có thể nhắn tin trực tiếp cho nhau, chia sẻ bài hát, thả biểu tượng cảm xúc (Reaction) và đặc biệt là tính năng "Listen Together MVP" (Nghe cùng nhau) để đồng bộ trải nghiệm nghe nhạc theo thời gian thực.

## 2. Đối tượng sử dụng
- User đã đăng nhập.

## 3. Trạng thái triển khai hiện tại
- Đã phát triển một module Messaging đồ sộ với Socket.IO.
- Giải thích: Tại giao diện, người dùng có hộp thư (Conversations List). Bấm vào 1 người để chat trực tiếp (Direct Chat). Ngoài việc gửi Text, người dùng có thể Share Bài hát (`shareSongToUser`), Share Playlist. Khi có tin nhắn mới, Socket.IO sẽ báo có Unread Badge. Ngoài ra hệ thống hỗ trợ cả Pin Message và thả Emoji Reaction vào từng tin nhắn. Bất ngờ nhất là hệ thống chứa các endpoint MVP cho "Listen Session" (Phòng nghe nhạc chung).

## 4. Luồng xử lý tổng quát
1. **Khởi tạo Cuộc trò chuyện:** User tìm kiếm bạn bè (`/api/messages/users/search`) và tạo phòng chat 1-1 (`/api/messages/conversations/direct`).
2. **Gửi tin nhắn (Gửi Text hoặc Chia sẻ Nhạc):**
   - API `POST /api/messages/conversations/:id/messages` (gửi chữ).
   - API `POST /api/messages/conversations/:id/share-song` (đính kèm ID bài hát).
3. **Cập nhật Realtime:** Backend lưu DB (bảng `messages`), sau đó dùng `emitChatMessage` qua Socket.IO đẩy ngay tin nhắn xuống frontend của người nhận (nếu người đó đang online).
4. **Phòng Nghe Chung (Listen Together):**
   - Một người bấm Start (`/start`). Backend sinh System Message "A đã bắt đầu phiên nghe cùng nhau".
   - Người kia bấm Join (`/join`). Từ đó trở đi, mọi thao tác Play/Pause/Seek có thể được đồng bộ qua kênh Socket.IO riêng (`listen_together:...`).

## 5. Luồng xử lý chi tiết
- **Trường hợp Offline:** Nếu người nhận không online, tin nhắn nằm trong DB. Lần tới họ đăng nhập, API `getUnreadCount` sẽ báo có tin chưa đọc.
- **Trường hợp Xóa tin nhắn:** API `DELETE` sẽ đánh dấu xóa hoặc xóa mềm. Socket cũng đẩy tín hiệu `chat:message_deleted` để frontend rút lại tin nhắn.
- **Trường hợp Pin/Unpin:** Tạo thông báo hệ thống tự động (System Message) chèn vào giữa đoạn chat (Ví dụ: "Huy đã ghim một bài hát").

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/messages/ChatView.vue (Hoặc thư mục tương tự)
apps/frontend/src/components/chat/MessageList.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/message.routes.js
apps/backend/src/controllers/message.controller.js
apps/backend/src/services/message.service.js
apps/backend/src/services/listenSession.service.js
```

## 8. Vị trí code AI service nếu có
Không sử dụng AI.

## 9. API liên quan
Rất nhiều API, nổi bật:
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/messages/conversations`| Lấy DS hộp thoại | Có | `message.controller.js` |
| POST | `/api/messages/conversations/:id/messages`| Gửi tin nhắn Text | Có | `message.controller.js` |
| POST | `/api/messages/share-song`| Chia sẻ nhạc | Có | `message.controller.js` |
| POST | `/api/messages/conversations/:id/listen-session/start`| Bắt đầu nghe chung | Có | `message.controller.js` |
| POST | `/api/messages/:messageId/reactions`| Thả Emoji | Có | `message.controller.js` |

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `conversations` | Khởi tạo phòng chat | Đọc/Ghi |
| `messages` | Lưu tin nhắn, Reaction | Đọc/Ghi |

## 11. Realtime / Socket.IO / Redis nếu có
Xương sống của tính năng này.
- Events: `chat:new_message`, `chat:conversation_updated`, `chat:message_read`, `chat:reaction_updated`.
- Rooms: `user:{id}`, `conversation:{id}`.

## 12. Quyền truy cập và bảo mật
- Middleware Auth chặn tất cả.
- Hàm lấy tin nhắn/gửi tin luôn check xem User có phải là thành viên (`participant`) của `conversation` đó không (Bảo mật chiều ngang IDOR).

## 13. Dữ liệu đầu vào và đầu ra
- Gửi tin: `{ "body": "Nghe bài này đi bạn", "replyToMessageId": null }`.
- Share nhạc: `{ "recipientUserId": 12, "songId": 105, "body": "..." }`.

## 14. Loading / Empty / Error state trên giao diện
- Khung Chat có giao diện "Đang gõ..." (Typing indicator) nếu có triển khai ở frontend.
- Cảnh báo lỗi nếu gửi tin nhắn thất bại.

## 15. Điểm đã làm tốt
- Quá toàn diện so với một ứng dụng nghe nhạc thông thường. Tính năng Share Song trực tiếp vào Chat thay vì copy Link giúp tăng độ bám dính (retention) của User.
- Listen Together (MVP) là một tính năng đột phá, đòi hỏi kỹ thuật đồng bộ Socket phức tạp.

## 16. Hạn chế hiện tại
- Lưu log Chat trực tiếp vào MySQL nếu scale lên hàng triệu tin nhắn mỗi ngày sẽ gây nghẽn cổ chai (Bottleneck) lớn cho DB Quan hệ.

## 17. Đề xuất hoàn thiện
- Chuyển cấu trúc lưu trữ Messages sang NoSQL (MongoDB) hoặc lưu Cache trên Redis rồi Flush định kỳ để đảm bảo Performance.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra kỹ `message.routes.js` và `message.controller.js` (Hàm `shareEntityToUser`, `toggleReaction`, `startListenSession`).
