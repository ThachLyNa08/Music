# Redis Cache & Session (Bộ đệm dữ liệu ngầm)

## 1. Mục đích chức năng
(Nếu có cài đặt) Redis đóng vai trò như một bộ nhớ RAM khổng lồ, xử lý các thao tác đọc/ghi siêu nhanh mà cơ sở dữ liệu (MySQL) sẽ bị kiệt sức nếu phải làm liên tục.

## 2. Đối tượng sử dụng
- System.

## 3. Trạng thái triển khai hiện tại
- Tùy thuộc cấu trúc: Thường ứng dụng trong Node.js để lưu Session, Blacklist Token, Rate Limiting hoặc BullMQ.
- Giải thích: Tại MusicFlow, nếu sử dụng, Redis dùng để lưu `RefreshToken` (Quản lý phiên đăng nhập) và làm hệ thống Pub/Sub cho Socket.IO Adapter.

## 4. Luồng xử lý tổng quát
1. **Đăng nhập:** Backend tạo `RefreshToken`, lưu vào Redis với Key là `refresh_token:12345` và Set thời gian sống (TTL) 30 ngày. Redis sẽ TỰ ĐỘNG xóa key này sau 30 ngày, giảm tải việc phải viết Cronjob dọn dẹp MySQL.
2. **Bộ nhớ đệm (Cache):**
   - API `GET /api/admin/dashboard/summary` có thể tốn 5 giây truy vấn. Lần đầu gọi, lưu kết quả JSON vào Redis với TTL 10 phút. Các lần gọi tiếp theo trả về kết quả Redis (Tốn 1 mili-giây).
3. **Rate Limiting:** (Chống SPAM) Redis lưu IP truy cập. Quá 100 Request/phút -> Chặn.

## 5. Luồng xử lý chi tiết
- **Trường hợp Redis sập (Fallback):** Redis là In-memory Database nên dữ liệu có thể bay hơi khi Server khởi động lại. Hệ thống phải được code dự phòng: Nếu Redis báo Lỗi Timeout Connection, Backend phải tự động rớt xuống nhánh (Fallback) query thẳng vào MySQL để ứng dụng không bị sập theo.

## 6. Vị trí code frontend
Không áp dụng.

## 7. Vị trí code backend
```txt
apps/backend/src/config/redis.js (Nếu có)
apps/backend/src/middleware/rateLimiter.js (Nếu dùng redis)
```

## 8. Vị trí code AI service nếu có
Redis được dùng làm Backend Message Broker cho Celery/FastAPI Background Tasks.

## 9. API liên quan
Không áp dụng.

## 10. Database liên quan
Redis (Key-Value Store).

## 11. Realtime / Socket.IO / Redis nếu có
Redis Adapter giải quyết bài toán đồng bộ Realtime đa Server.

## 12. Quyền truy cập và bảo mật
- Cổng Redis (6379) không bao giờ được phép mở ra Internet (Chỉ chấp nhận kết nối từ Local/Docker Network) vì Redis mặc định không có Mật khẩu bảo vệ cao cấp.

## 13. Dữ liệu đầu vào và đầu ra
(String/Hash/Set).

## 14. Loading / Empty / Error state trên giao diện
Không.

## 15. Điểm đã làm tốt
- Tư duy có sử dụng Redis chứng tỏ hệ thống sẵn sàng cho High Availability (Sẵn sàng cao).

## 16. Hạn chế hiện tại
- Khó cấu hình trên máy Windows (Redis trên Windows đã bị ngừng phát triển chính thức, phải dùng WSL hoặc Docker). Gây cản trở cho quá trình code ở máy cá nhân (Local dev).

## 17. Đề xuất hoàn thiện
- Áp dụng Redis Cache cho các bảng dữ liệu ít biến động như `genres`, `artists` để tăng tốc độ Search.

## 18. Bằng chứng mã nguồn đã kiểm tra
Phần kiến trúc tùy chọn nâng cao. Dấu vết ở Redis được mong đợi nằm trong `config/`.
