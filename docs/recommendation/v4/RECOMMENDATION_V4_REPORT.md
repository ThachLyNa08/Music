# MusicFlow Recommendation V4

## Kết quả đánh giá

| Metric | Most Popular | Content-Based | BPR-MF Hybrid | LightGCN Hybrid |
|---|---:|---:|---:|---:|
| Precision@10 | 0.0096 | 0.0202 | 0.0457 | 0.0453 |
| Recall@10 | 0.0014 | 0.0027 | 0.0042 | 0.0039 |
| NDCG@10 | 0.0109 | 0.0203 | 0.0465 | 0.0455 |
| HitRate@10 | 0.0835 | 0.1534 | 0.1979 | 0.1916 |
| Coverage@20 | 0.0101 | 0.3262 | 0.8983 | **0.9661** |
| ArtistDiversity@20 | 0.6356 | 0.1025 | 0.6845 | **0.6995** |
| GenreDiversity@20 | 0.3946 | 0.0820 | 0.2458 | **0.2690** |
| Novelty@20 | 0.3829 | 0.7251 | 0.9025 | **0.9196** |

## Lựa chọn mô hình

BPR-MF Hybrid và LightGCN Hybrid cho kết quả độ chính xác khá gần nhau. MusicFlow ưu tiên **LightGCN Hybrid** cho pipeline hiện tại vì Coverage, Artist Diversity, Genre Diversity và Novelty tốt hơn, phù hợp mục tiêu vừa cá nhân hóa vừa mở rộng khả năng khám phá bài hát.

LightGCN sinh tập ứng viên từ phản hồi ngầm của người dùng. Sau đó backend áp dụng các lớp lọc và re-ranking để kiểm soát tính hợp lệ, mức độ phù hợp, đa dạng và ngữ cảnh.

## Thành phần bổ sung

- **Cold start:** onboarding + Content-Based + fallback.
- **Hybrid re-ranking:** kết hợp tín hiệu cá nhân hóa, metadata và các ràng buộc nghiệp vụ.
- **Tempo-aware:** dùng BPM, năng lượng, danceability và các đặc trưng âm thanh khi yêu cầu có ngữ cảnh phù hợp.
- **System playlists:** Daily Mix, Weekly Mix và playlist theo thời điểm được tạo từ các ứng viên đã được xếp hạng.

## Sơ đồ

- `recommendation_v4_architecture.mmd`: kiến trúc tổng thể.
- `recommendation_v4_flow.mmd`: luồng xử lý.

Các biểu đồ sinh tự động và báo cáo đánh giá trung gian không được lưu trong `docs/` để repository gọn hơn. Khi cần tái tạo kết quả, sử dụng các script recommendation trong project và dữ liệu/model artifact tương ứng của môi trường nghiên cứu.
