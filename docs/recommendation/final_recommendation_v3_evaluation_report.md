# Báo cáo Đánh giá Hệ thống Gợi ý (Phiên bản V3)

## 1. Nguồn dữ liệu thực nghiệm
- **Số user thực nghiệm:** 200
- **Số user hợp lệ (Có tương tác):** 194
- **Catalog size:** 7653 bài hát
- **Temporal split:** 80% (Train/Test)
- **Semantic source:** `datasets/processed/semantic/profiles/song_semantic_profiles.csv` (7661 rows, 21 columns, 100% attached rate).

## 2. Danh sách Thuật toán So sánh
1. **Most Popular** (Baseline)
2. **Content-Based + Semantic**
3. **BPR-MF** (Latent Factor Model)
4. **Hybrid + Semantic**

## 3. Kết quả đánh giá Top-K (K=10)
| Thuật toán | Precision@10 | Recall@10 | NDCG@10 | MAP@10 | Hitrate@10 | Coverage@20 | Diversity | Novelty |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Most Popular** | 0.0273 | 0.0128 | 0.0284 | 0.0094 | 0.2371 | 0.009669 | 11.73 | 0.0071 |
| **Content-Based + Semantic** | 0.0314 | 0.0139 | 0.0325 | 0.0107 | 0.2680 | 0.037110 | 9.21 | 0.5428 |
| **BPR-MF** | **0.0985** | **0.0435** | **0.0978** | **0.0365** | **0.6340** | **0.083627** | 8.61 | 0.1104 |
| **Hybrid + Semantic** | 0.0644 | 0.0277 | 0.0712 | 0.0284 | 0.4381 | 0.035672 | 10.61 | 0.2878 |

## 4. Phân tích Thuật toán Tốt nhất (BPR-MF)
BPR-MF vượt trội hoàn toàn so với các thuật toán còn lại (NDCG 0.0978 so với 0.0284 của Most Popular). Điểm mạnh của BPR-MF nằm ở khả năng học trực tiếp biểu diễn ưu tiên (preference) từ Implicit Feedback (Lịch sử nghe). Hitrate đạt 63.4%, nghĩa là cơ hội gợi ý trúng ít nhất 1 bài hát yêu thích trong Top 10 là cực kỳ cao.

## 5. Vai trò của Semantic Profiles
| Thuật toán | Mood Match Rate | Avg Semantic Confidence |
|---|---:|---:|
| Most Popular | 0.5111 | 0.6649 |
| Content-Based + Semantic | 0.8879 | 0.6800 |
| BPR-MF | 0.5018 | 0.6672 |
| Hybrid + Semantic | 0.7523 | 0.6843 |

BPR-MF có mức khớp mood thấp hơn (0.5018), do học dựa trên hành vi tổng quát thay vì nội dung. Hybrid là sự cân bằng tuyệt vời khi kéo NDCG lên mức chấp nhận được (0.0712) và vẫn giữ độ khớp mood cao (0.7523).

## 6. Hạn chế
- Tập User Seed 200 người là giả lập, chênh lệch sparsity chưa phản ánh 100% thực tế của hệ thống triệu users.
- Retrain pipeline hiện vẫn chạy qua script offline, cần đẩy mạnh tự động hóa serving trên FastAPI.
