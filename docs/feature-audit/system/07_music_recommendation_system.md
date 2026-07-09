# Hệ thống Gợi ý Âm nhạc (Music Recommendation System)

## 1. Mục đích chức năng
Mang lại trải nghiệm cá nhân hóa tối đa cho người dùng thông qua việc phân tích hành vi nghe nhạc (Listening History), nghệ sĩ yêu thích (Follows) và sở thích (Genre Preferences). Hệ thống tự động tạo ra các Playlist như Weekly Mix, Daily Mix, Morning/Night Vibes và gợi ý bài hát liên tục.

## 2. Đối tượng sử dụng
- User: Người dùng cuối tận hưởng các playlist "Dành cho bạn".
- System/Backend Job: Tự động chạy thuật toán (Collaborative Filtering / Contextual) để generate playlist.

## 3. Trạng thái triển khai hiện tại
- Đang hoạt động bằng backend recommendation serving từ model artifact đã huấn luyện, kết hợp Database Query Rules (Heuristics & Rule-based) để fallback và lọc kết quả.
- Giải thích: Mô hình được huấn luyện định kỳ bằng offline cronjob/script, sau đó hệ thống sử dụng model artifact để phục vụ đề xuất trong thời gian thực. Endpoint retrain API hiện chỉ trả thông báo `offline_training`, chưa chạy job huấn luyện tự động.

## 4. Luồng xử lý tổng quát
1. **Home Page Load (`GET /api/recommendation/home`):**
   - Lấy danh sách ID nghệ sĩ user đã Follow (`artist_follows`) và Preferences (`user_artist_preferences`).
   - Lấy danh sách Thể loại (Genres) yêu thích.
   - Chạy 6 câu SQL riêng biệt cho 6 Playlist Daily Mix (phân loại theo Genre cụ thể) & Weekly Mix. Ưu tiên điểm `is_followed_bonus`.
   - Lưu hoặc Cập nhật bảng `playlists` (với `type = 'system'`, `system_key = 'dailymix_01'`, v.v.).
   - Trả về JSON chứa `quickAccess`, `madeForYouPlaylists`, `recommendedToday` sắp xếp thông minh theo múi giờ (Morning/Afternoon/Night).

2. **Gợi ý Contextual (`GET /api/recommendation/contextual-mood`):**
   - Dựa vào `timeSlot` (sáng, chiều, tối, đêm), query các bài hát thuộc genre tương ứng (Ví dụ Đêm: Lofi, Jazz).

3. **Gợi ý AI Deep Learning (`GET /api/recommendation/home-songs`):**
   - Lấy giới hạn bài hát từ Recommendation Service, kèm theo giải thích chiến lược (Strategy Reason).

## 5. Luồng xử lý chi tiết
- **Trường hợp Tạo System Playlist (Upsert):** Hàm `getOrCreateSystemPlaylist` kiểm tra trong DB xem user đã có playlist `system_key` này chưa. Nếu chưa -> `INSERT` -> Lấy danh sách bài hát qua `RAND()` -> `INSERT IGNORE INTO playlist_songs`. Nếu có rồi -> kiểm tra xem có rỗng không, nếu rỗng thì fill nhạc.
- **Trường hợp Động hóa Description:** Description của Daily Mix được tạo động dựa trên 3 nghệ sĩ đầu tiên xuất hiện trong list (Ví dụ: "Sơn Tùng M-TP, Bích Phương và nhiều hơn nữa..."). Không lưu DB mà tính toán Real-time trước khi trả response.
- **Trường hợp Phân bổ Múi giờ (Smart Ordering):** Cùng 1 danh sách Playlist nhưng nếu user mở app lúc 8h sáng, `morning_vibes` xếp đầu. Nếu mở lúc 22h, `night_vibes` xếp đầu.

## 6. Vị trí code frontend
```txt
apps/frontend/src/views/home/HomeView.vue
apps/frontend/src/views/recommendation/ForYouRecommendationView.vue
```
- Frontend nhận payload khổng lồ từ `home` API và chia thành các Grid/Carousel (QuickAccess, Made For You, Recommended Today).

## 7. Vị trí code backend
```txt
apps/backend/src/routes/recommendation.routes.js
apps/backend/src/controllers/recommendation.controller.js
apps/backend/src/services/recommendation.service.js
apps/backend/src/services/contextualMood.service.js
```
- Khối lượng logic lớn nhất nằm ở `recommendation.controller.js` với các câu query UNION/CASE WHEN.

## 8. Vị trí code AI service
```txt
apps/ai-service/app/main.py
```
- Server Python (FastAPI). Hiện cung cấp API `/api/recommend/retrain` ở chế độ thông báo `offline_training`; model artifact BPR-MF được tạo bởi offline script/cronjob.

## 9. API liên quan

| Phương thức | Endpoint | Mục đích | Yêu cầu đăng nhập | File xử lý |
| ----------- | -------- | -------- | ----------------- | ---------- |
| GET | `/api/recommendation/home` | Gợi ý Trang chủ (Daily Mix...) | Có | `recommendation.controller.js` |
| GET | `/api/recommendation/home-songs` | Gợi ý list bài hát rời rạc | Có | `recommendation.controller.js` |
| GET | `/api/recommendation/contextual-mood` | Gợi ý theo ngữ cảnh (thời gian)| Có | `recommendation.controller.js` |
| POST| `http://ai-service/api/recommend/retrain`| Thông báo chế độ offline training, chưa chạy retrain tự động | Internal | `main.py` |

## 10. Database liên quan

| Bảng | Vai trò trong chức năng | Đọc/Ghi | Ghi chú |
| ---- | ----------------------- | ------- | ------- |
| `listening_history` | Phân tích thói quen nghe | Đọc | Nguồn dữ liệu cốt lõi |
| `artist_follows` | Ưu tiên ca sĩ | Đọc | `is_followed_bonus = 1` |
| `user_genre_preferences`| Phân loại Daily Mix | Đọc | |
| `playlists` | Nơi lưu trữ System Playlists | Đọc/Ghi | `is_system = 1` |

## 11. Realtime / Socket.IO / Redis nếu có
Chưa áp dụng Cache. Mọi request reload lại trang chủ đều chạy lại tập hợp query khá nặng.

## 12. Quyền truy cập và bảo mật
- APIs yêu cầu xác thực (`authenticate`).
- Admin Users (`role = 'admin'`) được sử dụng làm người tạo (creator) cho một số Global System Playlists (như Trending Now).

## 13. Dữ liệu đầu vào và đầu ra
- Output Trang chủ: JSON cực lớn gồm: `quickAccess` (3 list), `madeForYouPlaylists` (N list), `recommendedToday` (N list), `artistsForYou` (8 nghệ sĩ).

## 14. Loading / Empty / Error state trên giao diện
- Khung xương (Skeleton Loading) hiển thị trên màn hình Home do dữ liệu trả về cần thời gian tính toán.
- Nếu User mới (chưa nghe, chưa follow), hệ thống fallback về Popular Artists và Trending Songs.

## 15. Điểm đã làm tốt
- Chia Daily Mix thành 6 loại rõ ràng, bao quát các thể loại.
- Smart Ordering sắp xếp tự động các Mix theo thời gian thực tế của User.
- Logic Code ở Backend phân rã rõ ràng giữa Heuristics (Controller JS) và Deep Learning (Python).

## 16. Hạn chế hiện tại
- Truy vấn `ORDER BY RAND()` trong SQL khi bảng `songs` lớn sẽ gây chậm hệ thống đáng kể (Full Table Scan).
- Backend chưa có cơ chế Background Job để làm mới (refresh) Daily Mix vào lúc 0:00 mỗi ngày, hiện đang refresh dựa trên truy vấn động nếu playlist bị rỗng.
- Tính năng AI Model Retrain trên Python chưa chạy thực tế.

## 17. Đề xuất hoàn thiện
- Chuyển logic `ORDER BY RAND()` sang lấy mẫu (Sampling) theo ID hoặc Cache danh sách ID vào Redis để tăng tốc.
- Hoàn thiện AI Service (ALS Model với Implicit Feedback) và kết nối với Backend Express qua gRPC hoặc REST.
- Setup cronjob ban đêm để tính toán và cache trước toàn bộ System Playlists cho user active.

## 18. Bằng chứng mã nguồn đã kiểm tra
Đã kiểm tra:
- `apps/backend/src/controllers/recommendation.controller.js`
- `apps/ai-service/app/main.py`
