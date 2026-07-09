# Theo dõi Sức khỏe Hệ thống (Admin System Health)

## 1. Mục đích chức năng
Theo dõi trạng thái sống sót (Uptime) và khả năng phản hồi của các thành phần kiến trúc cốt lõi bao gồm: Backend Node.js, AI Service FastAPI, MySQL Database, và Redis Cache (nếu có). 

## 2. Đối tượng sử dụng
- Admin (Role System Admin).

## 3. Trạng thái triển khai hiện tại
- Đã được tích hợp một phần trong Admin Dashboard dưới dạng các Endpoint Ping / Status.
- Giải thích: Có API `/api/admin/ai-status` để kiểm tra kết nối tới máy chủ AI Python. 

## 4. Luồng xử lý tổng quát
1. **Kiểm tra AI Service (`GET /api/admin/ai-status`):** Backend gửi HTTP GET request (Timeout 5s) đến `http://localhost:8000/health` (hoặc URL của FastAPI). Nếu thành công, trả về trạng thái "Online", ngược lại "Offline".
2. **Kiểm tra Database:** (Thường tích hợp tự động). Nếu MySQL sập, toàn bộ Backend sẽ quăng Error 500, khó có thể hiện thị trên UI Admin (Ngoại trừ việc Frontend tự bắt lỗi 500 Network Error).
3. **Giám sát Tiến trình ngầm (Stem Jobs):** Admin có chức năng theo dõi Queue của Stem Separator (`GET /api/admin/stem-jobs`). Nếu Job bị treo (Stuck at Processing > 30 phút), Admin biết hệ thống hàng đợi đang có vấn đề.

## 5. Luồng xử lý chi tiết
- **Trường hợp Timeout AI Service:** Nếu mô hình AI tách Stem đang quá tải CPU 100%, request Ping có thể bị Timeout. Backend Node.js được thiết kế không block (Non-blocking) để tránh sập lây (Cascading Failure).

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/DashboardView.vue (Widget AI Status)
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js (dòng 49)
apps/backend/src/controllers/admin.controller.js (Hàm getAiStatus)
```

## 8. Vị trí code AI service nếu có
Phụ thuộc vào `/health` endpoint của `apps/ai-service/main.py`.

## 9. API liên quan
| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/ai-status`| Ping AI Server | Admin | `admin.controller.js`|
| GET | `/api/admin/stem-jobs/summary`| KPI Tiến trình | Admin | `admin_stem_jobs.controller.js`|

## 10. Database liên quan
- Bảng `stem_separation_jobs` (Theo dõi trạng thái hệ thống ngầm).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng cho ping.

## 12. Quyền truy cập và bảo mật
- Admin Only.

## 13. Dữ liệu đầu vào và đầu ra
- Output Ping: `{ "status": "online", "latency": "45ms" }`.

## 14. Loading / Empty / Error state trên giao diện
- Hiển thị Chấm xanh (Green Dot) nếu Online, Chấm Đỏ (Red Dot) nếu Offline.

## 15. Điểm đã làm tốt
- Thiết kế module độc lập (Microservice pattern), tách biệt Node.js và Python, và dùng API để kiểm tra chéo (Health Check) rất chuẩn kỹ thuật phần mềm.

## 16. Hạn chế hiện tại
- Chưa có đồ thị theo dõi lượng RAM/CPU tiêu thụ của máy chủ.

## 17. Đề xuất hoàn thiện
- Tích hợp thêm Prometheus & Grafana nếu dự án scale lớn để có biểu đồ System Health chuyên nghiệp.

## 18. Bằng chứng mã nguồn đã kiểm tra
Khai báo route `ai-status` trong `admin.routes.js`. Khai báo `stem-jobs` tại dòng 60.
