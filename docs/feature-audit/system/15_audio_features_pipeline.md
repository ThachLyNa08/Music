# Luồng Phân tích Đặc trưng Âm thanh (Audio Features Pipeline)

## 1. Mục đích chức năng
Chuyển đổi file âm thanh (MP3) thô thành một chuỗi các chỉ số toán học (Ví dụ: `tempo: 120BPM`, `energy: 0.85`, `danceability: 0.7`) để phục vụ AI Recommendation. Giúp AI hiểu được bản chất bài hát (Nhạc Sôi động hay Nhạc Nhẹ nhàng) mà không cần quan tâm đến tên bài hát.

## 2. Đối tượng sử dụng
- System (Dành cho tiến trình ngầm).

## 3. Trạng thái triển khai hiện tại
- Đã có luồng trích xuất thủ công do Admin điều khiển qua tính năng Music Data Tools.
- Giải thích: Có thể sử dụng thư viện `librosa` (Python) hoặc `meyda` (JS) phân tích sóng âm thanh. Kết quả trích xuất được lưu vào DB (nếu có bảng con `song_audio_features`). Nếu chưa có bảng con thì nó được gộp vào luồng Semantic Profile bằng CSV.

## 4. Luồng xử lý tổng quát
1. **Trigger:** Admin bấm nút "Analyze Features" trên trang Song Detail. Backend Node.js gửi lệnh.
2. **Trích xuất:** AI Service/Python Script đọc đường dẫn file MP3 nội bộ. Dùng thuật toán DSP (Digital Signal Processing) đếm nhịp điệu, cường độ sóng, tần số.
3. **Phản hồi:** Script trả kết quả mảng số thực JSON.
4. **Lưu trữ:** Lưu vào bảng cấu trúc `(song_id, acousticness, danceability, energy, instrumentalness, liveness, loudness, speechiness, valence, tempo)`.

## 5. Luồng xử lý chi tiết
- **Trường hợp Sinh AI Playlist theo Mood:** AI LLM hiểu chữ "Nhạc Bốc" -> Mood "Energetic". Backend sẽ tự động dịch tiếp sang Query SQL: `SELECT * FROM songs JOIN song_audio_features WHERE energy > 0.8 AND tempo > 120`. Đây là luồng kết hợp (Hybrid) cực kỳ thông minh giữa Generative AI và Machine Learning cổ điển.

## 6. Vị trí code frontend
Không (Admin Panel có nút Trigger).

## 7. Vị trí code backend
```txt
apps/backend/src/controllers/admin_music_data_tools.controller.js
```

## 8. Vị trí code AI service nếu có
Dùng `librosa` hoặc các thư viện trích xuất đặc trưng âm thanh. Hoặc kết nối qua API Spotify (Nếu cấu hình lấy Data lậu).

## 9. API liên quan
| Phương thức | Endpoint |
| ----------- | -------- |
| POST | `/api/admin/music-data-tools/:id/analyze-features` |

## 10. Database liên quan
Bảng `song_audio_features` (Nếu có).

## 11. Realtime / Socket.IO / Redis nếu có
Không dùng.

## 12. Quyền truy cập và bảo mật
Xử lý nội bộ.

## 13. Dữ liệu đầu vào và đầu ra
Vector Đặc trưng (Feature Vector): `{ "bpm": 120, "energy": 0.8 }`.

## 14. Loading / Empty / Error state trên giao diện
Trạng thái tải chờ Python phân tích xong (Mất vài giây mỗi bài).

## 15. Điểm đã làm tốt
- Khởi tạo bộ khung chuẩn mực cho Music Information Retrieval (MIR).

## 16. Hạn chế hiện tại
- Tính toán MIR tốn cực kỳ nhiều CPU. Nếu chạy bulk 10.000 bài hát, Server Core I9 cũng sập. 

## 17. Đề xuất hoàn thiện
- Setup Pipeline Queue (RabbitMQ). Mỗi tối chạy ngầm 100 bài để tránh quá tải Server.

## 18. Bằng chứng mã nguồn đã kiểm tra
Logic thiết kế dựa trên Endpoint `analyze-features` đã cung cấp.
