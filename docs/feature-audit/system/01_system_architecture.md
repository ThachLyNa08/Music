# Kiến trúc Hệ thống Tổng thể (System Architecture)

## 1. Mục đích chức năng
Tài liệu hóa mô hình tổ chức kỹ thuật của dự án MusicFlow, đảm bảo khả năng mở rộng, dễ bảo trì và phân tách rõ ràng trách nhiệm giữa các thành phần phần mềm.

## 2. Đối tượng sử dụng
- Developer, System Administrator.

## 3. Trạng thái triển khai hiện tại
- Kiến trúc Microservice (hoặc Service-Oriented) tách biệt: Frontend (Vue.js), Backend (Node.js/Express) và AI Service (Python/FastAPI).

## 4. Luồng xử lý tổng quát (Sơ đồ thành phần)
1. **Frontend (Client):** 
   - Ứng dụng SPA (Single Page Application) bằng Vue 3 + Vite.
   - Quản lý trạng thái bằng Pinia.
   - Gọi RESTful API tới Backend. Kết nối WebSocket (Socket.IO) để nhận thông báo realtime.
2. **Backend (Core Server):**
   - Node.js (Express) xử lý nghiệp vụ chính (User, Playlist, Thanh toán, Upload).
   - Kiến trúc 3 lớp: `Router` -> `Controller` -> `Service`. (Model được thao tác trực tiếp bằng MySQL Query thông qua `pool`).
   - Cung cấp tính năng WebSocket (Server-side).
3. **AI Service (Worker Server):**
   - Python FastAPI đứng độc lập ở cổng khác.
   - Đảm nhiệm việc tải và phân tích File Audio (Demucs Tách Stem, Librosa Audio Features).
   - Chạy các tập lệnh Training Recommendation Model (Matrix Factorization).
4. **Database (Storage):**
   - RDBMS MySQL lưu trữ siêu dữ liệu (Metadata, Transactions, Users).
   - Local File System (`apps/backend/uploads/`) lưu trữ file vật lý (`.mp3`, `.png`).

## 5. Luồng xử lý chi tiết
- **Trường hợp Giao tiếp Giữa các Server (Inter-service Communication):**
  - Backend Node.js gọi FastAPI qua giao thức HTTP REST (Ví dụ: Bấm nút "Tách Beat" trên UI -> Node.js gọi HTTP sang Python -> Python đưa vào Queue).
  - FastAPI trả kết quả về Node.js qua cơ chế **Callback (Webhook)** (Ví dụ: Tách xong, Python gọi POST `/api/stem/callback` của Node.js kèm file đường dẫn). Node.js cập nhật DB và đẩy Socket.IO cho UI.
- **Trường hợp Database:** Dùng chung 1 DB MySQL. Backend xử lý CRUD thường xuyên, Python lấy DB để đọc dữ liệu hành vi (Train AI).

## 6. Vị trí code frontend
```txt
apps/frontend/src/api/ (Nơi cấu hình Axios baseURL kết nối tới Node.js)
```

## 7. Vị trí code backend
```txt
apps/backend/src/app.js (Tâm điểm khởi tạo các routes, middleware)
apps/backend/src/config/ (Chứa config DB, Redis)
```

## 8. Vị trí code AI service nếu có
```txt
apps/ai-service/main.py (Điểm khởi đầu FastAPI)
```

## 9. API liên quan
Toàn bộ hệ thống.

## 10. Database liên quan
MySQL, Local Disk (`/uploads`), Redis (Tùy chọn cho Session/Socket pubsub).

## 11. Realtime / Socket.IO / Redis nếu có
Kiến trúc Event-driven một phần: Dùng Socket.IO để biến Server từ thụ động (Chỉ đợi Request) thành chủ động (Push Event về Client).

## 12. Quyền truy cập và bảo mật
- CORS được cấu hình chặt ở `app.js` để frontend mới gọi được backend.
- Cổng của FastAPI (Vd 8000) có thể bị đóng mộc bằng Firewall (UFW), chỉ cho phép Node.js gọi sang (Localhost), ngăn không cho Hacker gọi trực tiếp từ Internet vào AI Service làm sập CPU.

## 13. Dữ liệu đầu vào và đầu ra
(Tổng quan)

## 14. Loading / Empty / Error state trên giao diện
(Không áp dụng)

## 15. Điểm đã làm tốt
- Tách riêng AI Service ra khỏi Node.js là một quyết định kiến trúc xuất sắc. Node.js chạy đơn luồng (Single Thread), rất giỏi I/O HTTP, nhưng cực tệ ở xử lý CPU Bound (Giải mã âm thanh, Tính toán Ma trận AI). Nếu gộp chung AI vào Node.js, khi có 1 người Tách Beat, 100 người dùng khác sẽ bị đơ trang Web. Python xử lý CPU chuyên dụng kết hợp FastAPI Async giải quyết hoàn toàn bài toán này.

## 16. Hạn chế hiện tại
- Lưu trữ File vật lý (MP3) trên cùng một ổ cứng với Backend (Local `/uploads`). Nếu scale ra 2 Server Node.js (Load Balancer), Server B sẽ không tìm thấy file mà Server A vừa nhận.

## 17. Đề xuất hoàn thiện
- Di dời thư mục `/uploads` sang giải pháp S3 Object Storage (AWS S3, MinIO, Cloudflare R2). Kiến trúc lúc này sẽ là Stateless 100%.

## 18. Bằng chứng mã nguồn đã kiểm tra
Cấu trúc cây thư mục (Workspace Tree): `apps/frontend`, `apps/backend`, `apps/ai-service`. Kiến trúc Service-oriented rất rõ ràng.
