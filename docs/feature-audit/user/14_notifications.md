# Hệ thống Thông báo (Notifications)

## 1. Mục đích chức năng
Giữ chân người dùng và thông tin kịp thời về các sự kiện quan trọng trên nền tảng: Có bài hát mới từ nghệ sĩ đang theo dõi, Giao dịch thanh toán Premium thành công, Tách Stem (Karaoke) hoàn tất, v.v.

## 2. Đối tượng sử dụng
- User: Nhận và đọc thông báo.
- Admin / System: Sinh ra thông báo qua API nội bộ.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện tính năng chuông thông báo (Bell Icon) ở thanh điều hướng TopBar. 
- Giải thích: Có đếm số lượng thông báo chưa đọc (Unread Badge). Bấm vào sẽ sổ ra danh sách Dropdown. Hỗ trợ Realtime Push qua Socket.IO. 

## 4. Luồng xử lý tổng quát
1. **Tạo thông báo (Trigger):** Ví dụ khi hệ thống xử lý Webhook thanh toán xong, hoặc khi Admin upload bài hát mới của Sơn Tùng, Backend gọi `notificationService.createNotification(...)`.
2. **Lưu Database:** Lưu vào bảng `notifications` (title, message, type, link).
3. **Đẩy Realtime:** Nếu user đang online, Socket.IO emit event `notification:new` tới kênh riêng của user đó.
4. **Nhận và hiển thị:** Frontend bắt event Socket, tự động tăng số đếm Unread Badge lên +1.
5. **Đọc:** User bấm vào nút Chuông, Frontend gọi API `GET /api/notifications` để lấy danh sách. Khi bấm vào từng cái hoặc bấm "Đánh dấu đã đọc", gọi API `PATCH /api/notifications/:id/read`.

## 5. Luồng xử lý chi tiết
- **Trường hợp Notification Global:** Khi Admin muốn thông báo toàn hệ thống (VD: Bảo trì), không lưu 100,000 dòng vào DB, mà sử dụng cơ chế broadcast hoặc thông báo hệ thống chung (hiện tại `createGlobalNotification` đang loop tạo cho những user active, hoặc có bảng riêng, cần thiết kế lại nếu số lượng user lớn).
- **Trường hợp Chuyển Hướng (Deep Link):** Cột `link` trong DB quy định khi user bấm vào thông báo sẽ bay đến route nào (Ví dụ `/song/123`, hoặc `/premium`).

## 6. Vị trí code frontend
```txt
apps/frontend/src/components/common/TopBar.vue (Nút chuông)
apps/frontend/src/components/notifications/NotificationDropdown.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/notification.routes.js
apps/backend/src/controllers/notification.controller.js
apps/backend/src/services/notification.service.js
```

## 8. Vị trí code AI service nếu có
AI Service tách xong Stem sẽ chọc về Backend Callback, từ đó Backend sinh thông báo.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/notifications`| Lấy DS thông báo | Có | `notification.controller.js`|
| GET | `/api/notifications/unread-count`| Lấy số chưa đọc | Có | `notification.controller.js`|
| PATCH | `/api/notifications/:id/read`| Đánh dấu đã đọc 1 cái | Có | `notification.controller.js`|
| PATCH | `/api/notifications/read-all`| Đánh dấu đọc tất cả | Có | `notification.controller.js`|

## 10. Database liên quan
| Bảng | Vai trò trong chức năng | Đọc/Ghi |
| ---- | ----------------------- | ------- |
| `notifications` | Lưu dữ liệu | Đọc/Ghi |

## 11. Realtime / Socket.IO / Redis nếu có
- Dùng `getIo().to(userId).emit('notification:new', ...)` mạnh mẽ trong `notification.service.js`.

## 12. Quyền truy cập và bảo mật
- User chỉ đọc được thông báo của riêng mình (`user_id`).

## 13. Dữ liệu đầu vào và đầu ra
- Output JSON list: `[ { id, type: "new_song", title, message, is_read, created_at } ]`.

## 14. Loading / Empty / Error state trên giao diện
- Dropdown hiển thị "Không có thông báo nào" kèm Icon minh họa nếu mảng rỗng.

## 15. Điểm đã làm tốt
- Xây dựng service rất gọn gàng, có thể được gọi từ bất kỳ controller nào (Payment, Song, Admin). 
- Tích hợp chuẩn Socket.IO, cập nhật UI tức thời không cần F5.

## 16. Hạn chế hiện tại
- Nếu có 1 triệu User Follow Sơn Tùng, khi Admin upload 1 bài hát, vòng lặp `Promise.allSettled` trong `uploadSong` sinh 1 triệu thông báo cùng lúc sẽ gây Crash Server Node.js (Out of memory).

## 17. Đề xuất hoàn thiện
- Chuyển logic gửi thông báo hàng loạt sang Background Job Queue (Redis BullMQ).
- Nhóm thông báo (Group): Thay vì 10 thông báo "Có người share bài hát", gộp thành "A, B và 8 người khác đã share...".

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra `notification.controller.js` và `song.controller.js` (gọi notification).
