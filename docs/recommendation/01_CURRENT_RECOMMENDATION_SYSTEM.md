# Hệ thống gợi ý MusicFlow - Phiên bản hiện tại (V3)

## 1. Mục tiêu
Xây dựng một hệ thống gợi ý kết hợp (Hybrid) tận dụng phản hồi ngầm (Implicit feedback) của người dùng để sinh ra các playlist cá nhân hóa, đồng thời sử dụng Semantic Profile như một lớp bổ trợ giải thích.

## 2. Dữ liệu đầu vào
- Số liệu thực nghiệm: 200 users (194 users hợp lệ).
- Danh mục (Catalog): 7653 bài hát.
- Hành vi (Implicit feedback): `listening_history` (Completion rate, play count), `song_likes`, `artist_follows`.

## 3. Các thành phần chính
- **Core Model:** BPR-MF (Bayesian Personalized Ranking - Matrix Factorization). File artifact: `storage/recommendation/models/v3/bpr_mf_v3.json`.
- **Supporting Layer:** Content-Based + Semantic Profile (cung cấp độ tin cậy, ghép mood, hybrid fallback).
- **Fallback Layer:** Rule-based/SQL queries (khi user mới bị Cold-start hoặc model chưa train xong).

## 4. Thuật toán/chiến lược hiện tại
Thuật toán ưu tiên cao nhất là BPR-MF nhờ đạt NDCG@10 tốt nhất (0.0978). Chiến lược kết hợp là Hybrid + Semantic (NDCG@10 = 0.0712) cho các kịch bản cần độ đa dạng hoặc mood match.

## 5. Quy trình huấn luyện
- Mô hình được huấn luyện định kỳ bằng offline cronjob/script, sau đó hệ thống sử dụng model artifact để phục vụ đề xuất trong thời gian thực. Điểm kết nối API nội bộ `/api/recommend/retrain` hiện chỉ trả thông báo `offline_training`, chưa kích hoạt retrain tự động qua API.

## 6. Quy trình đánh giá
Sử dụng Split 80% Temporal. Đánh giá Top-K (K=10, 20). Xem bảng kết quả ở file report V3.

## 7. Quy trình serving recommendation
- Gọi từ Node.js Backend API.
- Vẫn kết hợp chặt chẽ với SQL/Rule-based (Heuristics) để lọc và hiển thị Realtime, thay vì phụ thuộc 100% vào artifact tĩnh.

## 8. Daily Mix / Weekly Mix / Auto Playlist
- Dựa trên kết hợp score của BPR-MF và SQL rules, hệ thống tạo System Playlists trong cơ sở dữ liệu (`type = 'system'`).
- Không hoàn toàn dựa 100% vào AI Deep Learning, có cơ chế SQL fallback mạnh.

## 9. Fallback strategy
- Nếu model không sẵn sàng hoặc User bị Cold-start: Lấy Popular Artists, Trending Songs. Hoặc dùng Semantic Metadata similarity.

## 10. Trạng thái triển khai
- Hệ thống V3 đã hoàn thành Data Pipeline, Training Script (Offline), Evaluation và sinh model JSON. Quá trình Serving Model lên Production API Realtime chưa được tích hợp hoàn toàn (Còn sử dụng fallback SQL nhiều).

## 11. Kết quả đánh giá hiện tại (V3)
- Thuật toán tốt nhất: BPR-MF.
- NDCG@10: 0.0978.
- Precision@10: 0.0985.
- Recall@10: 0.0435.
- Hitrate@10: 0.634.

## 12. Hạn chế
- Model retrain vẫn phụ thuộc offline script/cronjob, chưa có background job retraining tự động từ API.

## 13. Nội dung nên đưa vào luận văn
- Quá trình chuyển dịch từ Content-based (V2) lên Collaborative Filtering (BPR-MF V3). So sánh lợi ích của Implicit Feedback đối với hệ thống Music Streaming.

## 14. Nội dung không nên khẳng định quá mức
- Không khẳng định hệ thống đang Tự động Retrain Realtime.
- Không khẳng định Daily Mix được tạo ra 100% bằng Deep Learning End-to-end (Thực tế là Hybrid Heuristics + Model).

## 15. File code/artifact đã kiểm tra
- `storage/recommendation/evaluation/v3/metrics/recommendation_final_semantic_v3_summary.json`
- `storage/recommendation/models/v3/bpr_mf_v3.json`
