# Xử lý Lỗi & Dự phòng (Error Handling & Fallbacks)

## 1. Mục đích chức năng
Đảm bảo ứng dụng "không bao giờ chết" hoặc hiện màn hình trắng (White Screen of Death) dù cho có xảy ra lỗi từ người dùng, lỗi Database, hay chết Server API bên thứ 3 (AI, Payment). Cung cấp trải nghiệm trơn tru nhất cho người dùng qua cơ chế Fallback (Dự phòng).

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Đã được triển khai trên cả Backend và Frontend.
- Giải thích: Tại Backend có Global Error Handler bắt mọi lỗi Try/Catch. Ở Frontend có các Placeholder/Skeleton thay thế.

## 4. Luồng xử lý tổng quát
1. **Global Error Handler (Backend):** Mọi Exception quăng ra (Throuws) chưa được xử lý sẽ rơi vào Middleware cuối cùng của Express. Trả về JSON `{ success: false, message: "Lỗi hệ thống" }`. Không làm Crash Node.js.
2. **Fallback Hỉnh ảnh (Frontend):** Nếu API trả về `cover_url` bị 404 (Ảnh lỗi), thẻ `<img>` sử dụng event `@error` (Vue) để chuyển sang hiển thị một Ảnh mặc định (Default Cover/Avatar) có trong assets cục bộ. 
3. **Fallback Âm thanh (Frontend):** Nếu Audio lỗi mạng, Trình phát tự nhảy qua bài tiếp theo (Auto-skip) sau 3 giây hoặc báo "Lỗi nạp bài hát".
4. **Fallback AI Recommendation:** Nếu Mô hình AI (Python) sập mạng, Hệ thống tự rớt hạng (Degrade) xuống dùng tính năng "Lấy nhạc ngẫu nhiên" (Random/Popular) của MySQL.

## 5. Luồng xử lý chi tiết
- **Trường hợp Fallback Active Payment:** (Đã làm ở tài liệu 10). Nếu SePay không đẩy Webhook về, Cronjob sẽ chủ động đi hỏi SePay (Pull thay vì Push).
- **Trường hợp Fallback AI Playlist:** (Đã làm ở tài liệu 12). `useLLM = false`.

## 6. Vị trí code frontend
```txt
apps/frontend/src/api/index.js (Axios global interceptor bắt lỗi chung)
apps/frontend/src/components/common/ImageFallback.vue (Ví dụ)
```

## 7. Vị trí code backend
```txt
apps/backend/src/app.js (Dòng `app.use((err, req, res, next) => {...})`)
```

## 8. Vị trí code AI service nếu có
Cơ chế Retry/Fallback.

## 9. API liên quan
Không áp dụng.

## 10. Database liên quan
Không áp dụng.

## 11. Realtime / Socket.IO / Redis nếu có
Reconnection logic của Socket.IO là một dạng Error Recovery xuất sắc.

## 12. Quyền truy cập và bảo mật
- Khi Backend báo lỗi 500, tuyệt đối không gửi chuỗi báo lỗi của MySQL (Stacktrace) về Frontend vì hacker có thể đoán được cấu trúc Table (Information Disclosure). Đã được giấu kỹ trong Production.

## 13. Dữ liệu đầu vào và đầu ra
Output Error Format: JSON.

## 14. Loading / Empty / Error state trên giao diện
Toast Notifications (Đỏ), Empty States (Màn hình rỗng có icon).

## 15. Điểm đã làm tốt
- Việc có Fallback cho mọi tính năng AI đảm bảo hệ thống Core Music Streaming lúc nào cũng hoạt động độc lập không phụ thuộc AI. Tính Modular rất cao.

## 16. Hạn chế hiện tại
- Chưa có hệ thống Log Monitor (Ghi log lỗi ra File/Server tập trung như Sentry). Lỗi in ra Console rồi bay màu khi restart Server.

## 17. Đề xuất hoàn thiện
- Cài đặt `Winston` và kết nối với Sentry/Datadog để Admin nhận Email khi Server có lỗi 500.

## 18. Bằng chứng mã nguồn đã kiểm tra
Toàn bộ tư duy Catch Exception trong Controller đã chứng minh điều này.
