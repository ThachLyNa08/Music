# Sơ đồ Cơ sở Dữ liệu (Database Schema)

## 1. Mục đích chức năng
Thiết kế khung xương lưu trữ của toàn hệ thống MusicFlow bằng CSDL Quan hệ (MySQL). Đảm bảo tính toàn vẹn dữ liệu (Referential Integrity), hỗ trợ truy vấn siêu tốc và dễ dàng mở rộng.

## 2. Đối tượng sử dụng
- System (Database Engine), Backend Dev, AI Dev (Data Scientist lấy Data Train).

## 3. Trạng thái triển khai hiện tại
- Đã thiết lập hoàn chỉnh hệ thống bảng biểu.
- Giải thích: Không dùng ORM cồng kềnh (Sequelize/TypeORM), hệ thống dùng Raw Query (thư viện `mysql2` Pool) để tối ưu Performance tuyệt đối, dễ dàng viết các câu lệnh JOIN, GROUP BY phức tạp phục vụ AI. Schema chia thành nhiều nhóm.

## 4. Luồng xử lý tổng quát (Phân nhóm cấu trúc bảng)

### Nhóm 1: Xác thực & Hồ sơ (User & Auth)
- `users`: Lưu ID, email, password_hash, display_name, role, status, premium_expires_at, google_id.
- `password_resets`: Mã khôi phục mật khẩu.

### Nhóm 2: Siêu dữ liệu Âm nhạc (Music Core)
- `artists`: ID, name, avatar_url, bio.
- `albums`: ID, title, artist_id, cover_url, release_date.
- `genres`: ID, name, cover_url, is_recommendation_ready.
- `songs`: ID, title, artist_id, album_id, genre_id, duration_sec, audio_url, cover_url, lyrics, synced_lyrics, status.
- `song_artists`: (Tương lai/Nếu có) Bảng nối để 1 bài có nhiều ca sĩ (Feat). Hiện tại cấu trúc 1 bài - 1 nghệ sĩ chính đang phổ biến trong schema đồ án này.

### Nhóm 3: Danh sách phát (Playlists)
- `playlists`: ID, user_id, name, type (manual, system, ai_generated), is_public, system_key.
- `playlist_songs`: Bảng nối (playlist_id, song_id, track_order, added_at).

### Nhóm 4: Tương tác & Cá nhân hóa (Engagement)
- `song_likes`: Bảng nối (user_id, song_id). Đóng vai trò là "Liked Songs".
- `listening_history`: Lịch sử nghe real-time (user_id, song_id, listen_duration, completion_rate, is_skipped). Bảng quan trọng nhất để Train AI!
- `artist_follows` / `playlist_follows`: Tính năng theo dõi.

### Nhóm 5: Tính năng Nâng cao (Stem, Thanh toán, Chat)
- `stem_separation_jobs`: Quản lý tiến trình tách Beat (id, song_id, status, instrumental_url).
- `payment_transactions`: Lưu giao dịch (id, user_id, amount, status, sep_transaction_id).
- `conversations` & `messages`: Bảng phục vụ tính năng Chat và Nghe Chung.
- `notifications`: Cột thông báo.

## 5. Luồng xử lý chi tiết
- **Trường hợp Performance:** Bảng `listening_history` sẽ phình to rất nhanh (Hàng triệu dòng). Các Cột `(user_id, song_id)` cần được thiết lập Index. Có thể cần kỹ thuật Phân mảnh (Table Partitioning theo tháng) để tránh Full Table Scan khi Admin xem Dashboard.

## 6. Vị trí code frontend
Không áp dụng.

## 7. Vị trí code backend
```txt
database/schema/ (Nơi chứa file SQL init bảng)
database/seeds/ (Dữ liệu mẫu)
apps/backend/src/config/database.js (Cấu hình Pool kết nối)
```

## 8. Vị trí code AI service nếu có
Dùng `mysql-connector-python` hoặc `sqlalchemy` để Connect thẳng vào Database lấy bảng `listening_history` ra train.

## 9. API liên quan
Không áp dụng.

## 10. Database liên quan
(Như đã liệt kê).

## 11. Realtime / Socket.IO / Redis nếu có
Redis có thể đóng vai trò Secondary Schema lưu Trạng thái Online của User hoặc Caching.

## 12. Quyền truy cập và bảo mật
- Password của MySQL (Root/App User) tuyệt đối không push lên Github (Sử dụng `.env`).
- Có cấu hình User MySQL riêng chỉ có quyền Read để phục vụ AI Service.

## 13. Dữ liệu đầu vào và đầu ra
Không áp dụng.

## 14. Loading / Empty / Error state trên giao diện
Không áp dụng.

## 15. Điểm đã làm tốt
- Schema chuẩn hóa tốt (Normalization 3NF). Tránh dư thừa dữ liệu. 
- Giữ vững lập trường sử dụng Raw Query với Pool của Node.js là lựa chọn cực kỳ thông minh cho ứng dụng nghe nhạc/thống kê, nơi mà ORM thường sinh ra các câu query N+1 rất chậm.

## 16. Hạn chế hiện tại
- Bảng `songs` lưu khóa ngoại `artist_id`. Rất khó để hiển thị bài hát dạng "Sơn Tùng M-TP ft. Snoop Dogg".

## 17. Đề xuất hoàn thiện
- Thêm Bảng Nối (Junction Table) `song_artists` `(song_id, artist_id, role='main/featured')` để hỗ trợ hiển thị 1 bài hát nhiều ca sĩ.

## 18. Bằng chứng mã nguồn đã kiểm tra
Dựa theo cấu trúc các Controller (Song, User, Payment, Playlists) thì đây chính là thiết kế Schema thực tế đang chạy. Bảng `listening_history` và cờ `is_recommendation_ready` chứng minh sự tồn tại của hệ sinh thái AI.
