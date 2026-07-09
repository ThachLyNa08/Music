# Quản lý Mô hình AI & Gợi ý (Admin Recommendation Model)

## 1. Mục đích chức năng
Cho phép Admin giám sát trạng thái của mô hình Machine Learning (AI Recommendation Engine) đang chạy ngầm phục vụ gợi ý bài hát cho User. Theo dõi các chỉ số đánh giá (Metrics như NDCG, Precision, Recall) để đảm bảo thuật toán gợi ý chính xác.

## 2. Đối tượng sử dụng
- Admin (Role Data Scientist / Technical Admin): Xem báo cáo hiệu năng của mô hình Gợi ý AI.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thành một phần lớn việc hiển thị thông số. 
- Giải thích: Hiện tại chức năng này KHÔNG trực tiếp training mô hình. Mô hình được huấn luyện định kỳ bằng offline cronjob/script, sau đó hệ thống sử dụng model artifact để phục vụ đề xuất trong thời gian thực. Backend Node.js đọc file JSON cấu hình mô hình hiện hành (`current_model.json`, `recommendation_final_semantic_v3_metrics.json`) để trích xuất các chỉ số `Precision@10`, `Recall@10`, `NDCG@10` và hiển thị trực quan lên UI Admin. Có tính năng Preview thử danh sách gợi ý của một User bất kỳ.

## 4. Luồng xử lý tổng quát
1. **Lấy Thông tin Mô hình (`GET /api/admin/recommendation/summary`):** Backend truy xuất file `storage/recommendation/models/current_model.json`. Đọc đường dẫn `model_path` và `metrics_path` xem đang chạy version mấy (V2 hay V3).
2. **Hiển thị Metric (`GET /api/admin/recommendation/metrics`):** Đọc nội dung file JSON Evaluation (như `recommendation_metrics_report.json`), trích xuất điểm số của BPR-MF, Content-Based, và Hybrid Model.
3. **Xem trước (Preview) (`GET /api/admin/recommendation/users/:id/preview`):** Admin nhập ID của 1 user bất kỳ (ví dụ User ID = 5). Backend gọi `recommendationService.getRecommendationsForUser(5, {limit: 10})` để chạy thử logic gợi ý thật. Sau đó trả về danh sách bài hát kèm theo lý do vì sao bài này được gợi ý (`strategy`, `reason`, `score`).
4. **Xuất báo cáo (`GET /api/admin/recommendation/export`):** Tải file JSON báo cáo gốc về máy.

## 5. Luồng xử lý chi tiết
- **Trường hợp Backward Compatibility (Tương thích ngược):** Do mô hình AI có thể thay đổi cấu trúc lưu trữ (từ V2 sang V3), code backend (`resolveMetricsFile()`) được viết rất cẩn thận bằng cách thử tìm ở nhiều thư mục khác nhau (`candidateDirs`), hỗ trợ fallback đọc file `metrics.json` gần nhất nếu file `current_model` bị lỗi.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/RecommendationModelView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin_recommendation.controller.js
apps/backend/src/services/recommendationModel.service.js
```

## 8. Vị trí code AI service nếu có
Dữ liệu được render ở tính năng này hoàn toàn lấy từ thư mục `datasets/processed/recommendation/` và `storage/recommendation/`, nơi mà các tiến trình Training AI Python (ví dụ: mô hình implicit ALS, BPR-MF) ghi dữ liệu ra.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/recommendation/summary`| Lấy trạng thái Model| Admin | `admin_recommendation.controller.js`|
| GET | `/api/admin/recommendation/metrics`| Lấy thông số (Precision) | Admin | `admin_recommendation.controller.js`|
| GET | `/api/admin/recommendation/users/:id/preview`| Xem trước list gợi ý | Admin | `admin_recommendation.controller.js`|
| GET | `/api/admin/recommendation/export`| Tải báo cáo AI JSON | Admin | `admin_recommendation.controller.js`|

## 10. Database liên quan
Tính năng này chủ yếu đọc file tĩnh (`.json`, `.pkl` model path) nên không Query Database, ngoại trừ hàm Preview gọi qua bảng `songs` và `listening_history` để suy luận.

## 11. Realtime / Socket.IO / Redis nếu có
Không có.

## 12. Quyền truy cập và bảo mật
- Chặn ở `requireAdmin`. Chỉ có Admin được xem hệ thống chạy AI ra sao. Đặc biệt hàm Preview (xem người khác được gợi ý bài gì) cần bảo mật.

## 13. Dữ liệu đầu vào và đầu ra
- Output Metric: `{ "precisionAt10": 0.15, "ndcgAt10": 0.22, "coverageAt20": 0.45 }`.

## 14. Loading / Empty / Error state trên giao diện
- Frontend báo lỗi "Không tìm thấy dữ liệu Model" nếu chưa có bất kỳ mô hình AI nào được đào tạo (Folder trống).

## 15. Điểm đã làm tốt
- Tính năng "Preview Recommendation": Rất hữu ích khi Admin muốn giải quyết khiếu nại (Troubleshoot) nếu User phản ánh "Sao hệ thống cứ gợi ý toàn nhạc KPOP mặc dù tôi không nghe?". Admin chỉ cần nhập ID User đó vào và xem thuật toán đánh giá (score) thế nào.

## 16. Hạn chế hiện tại
- Nút retrain trên giao diện chỉ hiển thị chế độ offline script/disabled, chưa gọi job retraining thật. Admin vẫn phải cập nhật model artifact thông qua offline script/cronjob.

## 17. Đề xuất hoàn thiện
- TODO: Có thể bổ sung background job retraining trong phase sau để Admin kích hoạt an toàn qua UI.
- Biểu diễn History của Model Metric qua biểu đồ đường (Line chart) để so sánh xem mô hình V3 có thực sự tốt hơn V2 không.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/controllers/admin_recommendation.controller.js` (Hàm `getSummaryData`, `resolveMetricsFile`, `previewRecommendations`)
