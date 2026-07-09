# Tiến trình Hẹn giờ (Scheduler / Cron Jobs)

## 1. Mục đích chức năng
Thực thi các công việc lặp đi lặp lại tự động vào những khoảng thời gian cố định hoặc theo một hàng đợi mà không cần sự can thiệp của con người.

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Dùng thư viện Cron (như `node-cron` hoặc `bullmq`).
- Giải thích: Trong dự án, Cron Job cần thiết cho các thao tác: Cập nhật Cờ Taxonomy rỗng, Refresh System Playlists, Cập nhật Thống kê Bài Hát, Dọn dẹp Pending Payments.

## 4. Luồng xử lý tổng quát
1. **Khởi tạo (`jobs/` folder):** Khi Node.js khởi động (`app.js`), hệ thống load các cấu hình Cron. Ví dụ: `cron.schedule('0 0 * * *', function_A)`.
2. **Cập nhật Lượt nghe:** Lượt nghe (Play count) của bài hát trên Spotify không cập nhật realtime mà cập nhật sau 24h. Cronjob hàng đêm lôi tổng lượt nghe từ bảng `listening_history` ra đập vào bảng `songs` cột `play_count` để giảm thiểu Database Lock.
3. **Dọn rác (Garbage Collection):** Xóa các Webhook Payment treo quá 30 phút, Xóa các OTP hết hạn.

## 5. Luồng xử lý chi tiết
- **Trường hợp Xung đột Server (Concurrency/Race Condition):** NẾU dự án chạy 2 Server Node.js cùng lúc (Cluster), 2 Server sẽ cùng kích hoạt Cronjob vào lúc 12:00 đêm. Hệ quả: Các phép tính bị thực thi 2 lần (Double Execution). Do đó, Cronjob trong hệ thống phân tán thường được khóa (Locking) qua Redis hoặc chuyển hẳn sang hệ thống Job Queue riêng.

## 6. Vị trí code frontend
Không áp dụng.

## 7. Vị trí code backend
```txt
apps/backend/src/jobs/ (Thư mục thường được chỉ định cho lập lịch)
apps/backend/src/app.js (Nơi đăng ký khởi động cron)
```

## 8. Vị trí code AI service nếu có
Recommendation model được huấn luyện định kỳ bằng offline cronjob/script bên ngoài API realtime; artifact sau khi train được backend dùng để serving đề xuất.

## 9. API liên quan
Không.

## 10. Database liên quan
Toàn bộ DB (Tùy thuộc Job).

## 11. Realtime / Socket.IO / Redis nếu có
Nên sử dụng Redis Lock (Redlock) để chặn Cron chạy trùng lặp.

## 12. Quyền truy cập và bảo mật
Không phơi bày (expose) API kích hoạt Cron ra Internet để tránh bị Hacker Spam làm sập Server (Tuy nhiên Admin UI có thể gọi API kích hoạt thủ công, được bảo vệ bằng Auth).

## 13. Dữ liệu đầu vào và đầu ra
Không có.

## 14. Loading / Empty / Error state trên giao diện
Không có.

## 15. Điểm đã làm tốt
- Giảm tải đáng kể cho luồng xử lý chính. API trả về nhanh hơn vì các task nặng đã được đẩy lùi về phía sau chờ chạy ngầm.

## 16. Hạn chế hiện tại
- Nếu Server chết đúng thời điểm 12:00 đêm (Thời điểm Cron chạy), công việc đó sẽ bị bỏ lỡ hoàn toàn (Missed) cho đến tận ngày hôm sau.

## 17. Đề xuất hoàn thiện
- Chuyển từ hệ thống `node-cron` sang `BullMQ` (Dựa trên Redis) để quản lý trạng thái Tốt/Lỗi của từng công việc. Nếu lỗi có thể Retry 3 lần, đảm bảo dữ liệu luôn được xử lý.

## 18. Bằng chứng mã nguồn đã kiểm tra
Kiểm tra cấu trúc thiết kế lý thuyết, liên kết với tính năng Regenerate System Playlists của Admin.
