# Dashboard Tổng Quan (Admin Dashboard)

## 1. Mục đích chức năng
Cung cấp cái nhìn bao quát về tình hình hoạt động của toàn bộ nền tảng MusicFlow. Hỗ trợ Admin theo dõi các chỉ số quan trọng (KPIs) như số lượng người dùng, doanh thu, lượt nghe và tình trạng sức khỏe dữ liệu để đưa ra các quyết định vận hành.

## 2. Đối tượng sử dụng
- Admin: Giám sát hàng ngày.

## 3. Trạng thái triển khai hiện tại
- Đã hoàn thiện với nhiều nhóm biểu đồ, phân tích xu hướng (Trends), và báo cáo chi tiết.
- Giải thích: Dashboard không chỉ hiện vài con số đơn giản mà còn tổng hợp rất nhiều dữ liệu phức tạp (như Analytics, Hệ thống AI, Sức khỏe Dữ liệu).

## 4. Luồng xử lý tổng quát
1. **Truy cập Dashboard:** Admin vào trang `/admin` (hoặc `/admin/dashboard`).
2. **Tải Dữ liệu Tổng quan (`GET /api/admin/dashboard/summary`):** Backend query nhanh vào các bảng để trả về 4 con số KPI chính (Tổng User, Tổng Bài hát, Tổng Lượt nghe, Doanh thu).
3. **Tải Biểu đồ Xu hướng (`GET /api/admin/listening-trends`):** Query group by ngày/tháng để lấy số lượng play của người dùng trong khoảng thời gian nhất định (7 ngày, 30 ngày).
4. **Tải Phân tích Dữ liệu (`GET /api/admin/data-quality/summary`):** Báo cáo số lượng bài hát thiếu cover, thiếu lyric, thiếu file audio.
5. **Hiển thị:** Frontend Vue sử dụng thư viện Chart (như Chart.js hoặc ECharts) để render các đồ thị trực quan.

## 5. Luồng xử lý chi tiết
- **Trường hợp Tính toán Nặng:** Các query báo cáo tháng (Monthly Revenue, Monthly Plays) thường gom nhóm trên hàng triệu dòng log (`listening_history`). Để không làm đơ hệ thống, backend có thể sử dụng SQL Views (như `v_user_stats`) hoặc tính toán trước bằng Cronjob.
- **Trường hợp Insights AI:** Có API `/api/admin/dashboard/insights/analyze`, sử dụng AI để tự động sinh ra bình luận nhận xét về tình hình hệ thống (Ví dụ: "Doanh thu tuần này tăng 20%, có thể do ra mắt gói mới").

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/admin/DashboardView.vue
apps/frontend/src/views/admin/AnalyticsView.vue
```

## 7. Vị trí code backend
```txt
apps/backend/src/routes/admin.routes.js
apps/backend/src/controllers/admin.controller.js
```
- Các hàm như `getDashboardStats`, `getDashboardSummary`, `getListeningTrends`, `getTopArtistTrends`.

## 8. Vị trí code AI service nếu có
API `/api/admin/dashboard/insights/analyze` gọi sang AI Prompt/Service để sinh văn bản nhận xét.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/admin/dashboard/summary`| KPI cơ bản | Admin | `admin.controller.js` |
| GET | `/api/admin/listening-trends`| Biểu đồ lượt nghe | Admin | `admin.controller.js` |
| GET | `/api/admin/data-quality/summary`| Sức khỏe dữ liệu | Admin | `admin.controller.js` |
| GET | `/api/admin/ai-status`| Tình trạng API tách Stem| Admin | `admin.controller.js` |
| POST| `/api/admin/dashboard/insights/analyze`| Sinh nhận xét AI | Admin | `admin.controller.js` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| Toàn bộ Database | Tổng hợp | Đọc | Lấy count/sum từ Users, Songs, Payments, History |

## 11. Realtime / Socket.IO / Redis nếu có
Không áp dụng. Dữ liệu trên Dashboard là ảnh chụp (Snapshot) ở thời điểm User bấm F5, hoặc fetch định kỳ 5 phút.

## 12. Quyền truy cập và bảo mật
- Middleware `requireAdmin` chặn toàn bộ.

## 13. Dữ liệu đầu vào và đầu ra
- API Summary Output JSON: `{ "totalUsers": 1500, "totalSongs": 5000, "totalPlays": 1200000, "revenue": 15000000 }`.

## 14. Loading / Empty / Error state trên giao diện
- Trang Dashboard chia thành nhiều card. Mỗi card (Component) có Skeleton/Spinner riêng để tối ưu tốc độ load (Card nào xong trước hiện trước).

## 15. Điểm đã làm tốt
- Rất đa dạng các loại báo cáo, không dừng lại ở CRUD cơ bản. Thậm chí tích hợp cả "AI Insights" để tổng hợp tự động.
- Chia nhỏ các API lấy số liệu thay vì gom tất cả vào 1 API khổng lồ gây nghẽn kết nối.

## 16. Hạn chế hiện tại
- Nếu database phình to lên mức triệu bản ghi, các câu lệnh `COUNT(*)` và `SUM()` trực tiếp sẽ mất nhiều giây để chạy, gây quá tải DB.

## 17. Đề xuất hoàn thiện
- Thêm cơ chế Caching (Redis) cho API Dashboard: Lưu kết quả báo cáo 1 giờ/lần thay vì tính realtime mỗi khi Admin vào trang.
- Xây dựng bảng Summary Table ngầm (Materialized View hoặc Aggregation table chạy bằng event trigger).

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/routes/admin.routes.js`
- `apps/backend/src/controllers/admin.controller.js`
