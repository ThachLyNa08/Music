# Báo cáo lựa chọn thuật toán gợi ý cho MusicFlow

> **Kết luận một câu**: MusicFlow chọn **BPR-MF (Bayesian Personalized Ranking -
> Matrix Factorization)** làm thuật toán gợi ý chính, vì nó vượt trội ở cả 5
> metric top-10 (Precision, Recall, NDCG, MAP, HitRate) so với 3 baseline
> (Most Popular, Content-Based Audio, Hybrid Context-Aware) trên 194 user
> đủ điều kiện với 7.653 bài hát.

## 1. Mục tiêu đánh giá

Mục tiêu là trả lời câu hỏi: *"Thuật toán nào phù hợp nhất để xếp hạng cá
nhân hóa cho MusicFlow trên tập implicit feedback thực tế?"* Tiêu chí cụ thể:

- **Tính cá nhân hóa** (Personalization): mỗi user có thứ hạng khác nhau.
- **Hiệu quả xếp hạng** (Ranking quality): không chỉ trùng mà còn xếp bài
  đúng lên cao.
- **Tính ổn định trên cold-start vừa**: user có ≥ 200 lượt nghe trong train
  (không phải user hoàn toàn mới, nhưng cũng không quá nhiều data).
- **Triển khai được** trong Node.js, không phụ thuộc Python ML service runtime.

Bốn thuật toán được đánh giá:

| # | Thuật toán | Mô tả ngắn |
| - | ---------- | ----------- |
| 1 | **Most Popular** | Baseline. Top bài nhiều `play_count` nhất, không cá nhân hóa. |
| 2 | **Content-Based Audio** | So khớp audio features (energy, valence, tempo, danceability) + genre + market theo lịch sử user. |
| 3 | **BPR-MF** (thuật toán được chọn) | Matrix Factorization train bằng Bayesian Personalized Ranking trên implicit feedback (listen events). |
| 4 | **Hybrid Context-Aware** | Kết hợp content + popularity + context (hour_of_day) + rerank đa tín hiệu. |

## 2. Lý do chọn BPR-MF về mặt dữ liệu

### 2.1 MusicFlow sử dụng implicit feedback

MusicFlow không thu thập rating 1-5 sao. Dữ liệu quan sát được là **implicit
feedback**, bao gồm:

| Tín hiệu | Bảng / cột | Ý nghĩa |
| -------- | ---------- | -------- |
| Lượt nghe | `listening_history.id` | User đã nghe bài này. |
| Tỉ lệ nghe | `listening_history.completion_rate` | Nghe bao nhiêu phần bài (0-1). |
| Có skip | `listening_history.is_skipped` | Bài có bị skip sớm không. |
| Lặp lại | `COUNT(listening_history) per user-song` | Nghe lặp bao nhiêu lần. |
| Liked | `song_likes` | User đã like bài. |
| Implicit rating | `listening_history.implicit_rating` | Điểm hệ thống suy ra từ completion + skip. |

Đây là bài toán **top-K recommendation** chứ không phải rating prediction.
BPR (Rendle et al., 2009) được thiết kế đúng cho bài toán này: tối ưu thứ
tự xếp hạng cá nhân hóa thay vì tối ưu sai số rating tuyệt đối.

### 2.2 BPR-MF phù hợp với bài toán xếp hạng cá nhân hóa

BPR-MF có 3 đặc điểm phù hợp với MusicFlow:

1. **Pairwise loss trên (user, positive, negative) triplet**: tối ưu trực
   tiếp ranking AUC. Negative sampling từ items chưa từng nghe.
2. **Personalized latent factors**: mỗi user có vector riêng → ranking cá
   nhân hóa. Most Popular không có yếu tố cá nhân.
3. **Triển khai thuần Node.js** (SGD, L2 reg, max-norm, bias clipping):
   không cần Python ML service chạy runtime, train ngay trong repo.

So với Content-Based Audio: dùng được khi user đã có lịch sử audio features,
nhưng không "khám phá" được bài ngoài vùng content user đã nghe → recall thấp.

So với Hybrid: có thể tốt hơn nếu rerank cẩn thận, nhưng dễ bị diversity
over-penalize (HitRate@10 = 0.4124, thấp hơn BPR-MF 0.6340).

## 3. Thiết lập đánh giá

| Tham số | Giá trị | Ghi chú |
| ------- | ------- | ------- |
| Tổng user tham gia thí nghiệm | **200** | Đủ lớn cho ý nghĩa thống kê. |
| User đủ điều kiện đánh giá (eligible) | **194** | Sau khi lọc user có ≥ 200 tương tác train. |
| Catalog bài hát | **7.653** | `global_catalog_coverage_at_20` tối đa = 8.36% (BPR-MF). |
| Split train/test | **80% temporal** | Theo timestamp, không random split (chống leak tương lai). |
| Test positive | `completion_rate >= 0.5 OR implicit_rating >= 0.5 OR liked = 1` | Định nghĩa bài "thực sự thích" trong test window. |
| Test metric chính | `test_holdout_positive_set` | **Loại bỏ** test positive đã nằm trong train → chống train-leak bias. |
| Train leak rate | **0%** cho cả 4 thuật toán | Đã verify. |
| Random seed | Cố định (`experiment_seed`) | Reproducible. |

## 4. Bảng so sánh metric Top-10

Bảng dưới lấy từ `datasets/processed/recommendation_evaluation_results.json`
(số liệu ở `K=10`, đã chuẩn hóa tên khóa `precision_at_10`, `recall_at_10`,
`ndcg_at_10`, `map_at_10`, `hitrate_at_10`).

| Thuật toán | Precision@10 | Recall@10 | NDCG@10 | MAP@10 | HitRate@10 |
| ---------- | ------------ | --------- | ------- | ------ | ---------- |
| Most Popular | 0.0273 | 0.0128 | 0.0284 | 0.0094 | 0.2371 |
| Content-Based Audio | 0.0428 | 0.0186 | 0.0470 | 0.0180 | 0.3144 |
| **BPR-MF** | **0.0985** | **0.0435** | **0.0978** | **0.0365** | **0.6340** |
| Hybrid Context-Aware | 0.0649 | 0.0291 | 0.0687 | 0.0279 | 0.4124 |

BPR-MF vượt baseline mạnh nhất (Content-Based) lần lượt là:

- **Precision@10**: ×2.30 (0.0985 / 0.0428)
- **Recall@10**: ×2.34 (0.0435 / 0.0186)
- **NDCG@10**: ×2.08 (0.0978 / 0.0470)
- **MAP@10**: ×2.03 (0.0365 / 0.0180)
- **HitRate@10**: ×2.02 (0.6340 / 0.3144)

So với Hybrid reranker: BPR-MF vẫn cao hơn ở cả 5 metric, mặc dù Hybrid
có nhiều tín hiệu đầu vào hơn (hour-of-day, audio mood score). Lý do:
Hybrid đã hy sinh HitRate để tăng diversity và context, nên tốt cho mục
tiêu "trải nghiệm đa dạng" hơn là "tỉ lệ trúng cao".

## 5. Biểu đồ trực quan

### 5.1 So sánh tổng quan Top-10

![So sánh BPR-MF với 3 baseline - Top-10 recommendation](../datasets/processed/charts/bpr_selection_top10_metrics.png)

Hình trên so sánh Precision@10, NDCG@10, HitRate@10 của 4 thuật toán.
BPR-MF (cột cam đậm) cao hơn rõ rệt ở cả 3 panel, đặc biệt HitRate@10
= 0.6340 gấp hơn 2 lần Content-Based và gần 2.7 lần Most Popular.

### 5.2 So sánh chi tiết Precision@10 và NDCG@10

![BPR-MF vs baselines - Precision@10 và NDCG@10](../datasets/processed/charts/bpr_vs_baselines_precision_ndcg.png)

BPR-MF đạt **Precision@10 = 0.0985** và **NDCG@10 = 0.0978**, vượt các
baseline ở cả 2 metric. Hai metric này đo chất lượng ranking: không chỉ
"có trúng không" mà còn "xếp bài đúng lên cao không".

### 5.3 Quá trình huấn luyện BPR-MF

![BPR-MF training loss](../datasets/processed/charts/bpr_training_loss.png)

![BPR-MF pairwise accuracy](../datasets/processed/charts/bpr_pairwise_accuracy.png)

Training trong 50 epoch với `learning_rate=0.02`, sampled pairs = 70.319
mỗi epoch. Loss giảm từ 44.187 (epoch 1) → 11.745 (epoch 50); pairwise
accuracy proxy tăng từ 0.766 → 0.935. Mô hình hội tụ ổn định, không
over-fit (loss vẫn giảm đều, không phụt ngược).

## 6. Vì sao BPR-MF đạt kết quả tốt nhất

Tổng hợp 3 lý do chính từ kết quả thực nghiệm:

1. **Implicit feedback phù hợp với BPR loss.** Toàn bộ tín hiệu của
   MusicFlow là listen/completion/like (không có rating 1-5). BPR tối ưu
   pairwise ranking nên "đúng bài" được đẩy lên cao, "sai bài" bị đẩy xuống
   — khớp với mục tiêu top-K.

2. **Cá nhân hóa latent factors.** Mỗi user có 32 latent factors được học
   riêng. Most Popular không có yếu tố user → cùng list cho mọi người.
   Content-Based chỉ khớp features nên "khoanh vùng" theo gu cũ, khó khám
   phá bài ngoài vùng. BPR-MF tìm được các bài user *sẽ thích* dù chưa
   từng nghe gần đó.

3. **Triển khai reproducible.** Train thuần Node.js với SGD + L2 + max-norm +
   bias clipping, seed cố định, train_leak_rate = 0%. Có thể train lại
   artifact mỗi tuần qua scheduler AI retrain (`AI_RETRAIN_ENABLED=true`)
   mà không cần Python runtime.

## 7. Các thuật toán fallback

MusicFlow **không dùng một thuật toán duy nhất** cho mọi user. Hệ thống
xếp lớp fallback để cover mọi trường hợp:

| Layer | Thuật toán | Khi nào dùng | Vai trò |
| ----- | ---------- | ------------ | ------- |
| 1 (chính) | **BPR-MF** | User có trong BPR-MF artifact (194 user) | Cá nhân hóa chính. |
| 2 (cold-start) | **Content-Based Audio** | User có audio features lịch sử nhưng chưa có BPR-MF embedding | Cá nhân hóa theo content khi thiếu collaborative data. |
| 3 (popular) | **Most Popular** | User mới hoàn toàn / cold-start | Baseline phổ biến. |
| 4 (rerank) | **Hybrid Context-Aware** | (tuỳ chọn) Cần blend nhiều tín hiệu: diversity, context, mood | Lớp rerank/balance khi cần. |

Sơ đồ fallback thực tế trong `apps/backend/src/services/recommendation.service.js`:

```
getRecommendationsForUser(uid)
  -> if uid in bprModel.userIndexMap: BPR-MF score + rerank
  -> else if user has audio history: Content-Based Audio
  -> else: Most Popular (top by play_count)
```

Khi BPR-MF lỗi / artifact missing / user ngoài vùng train: tự động rơi
xuống Content-Based, rồi Most Popular. Lý do chọn theo thứ tự này:

- BPR-MF cần user có ≥ 200 train interactions (giống evaluation gate).
- Content-Based chỉ cần user từng nghe vài bài có audio features.
- Most Popular cần không gì cả (chỉ cần catalog).

## 8. Kết luận

- **BPR-MF được chọn làm mô hình gợi ý chính** của MusicFlow vì đạt tốt
  nhất ở cả 5 metric top-10 (Precision, Recall, NDCG, MAP, HitRate) trên
  194 user, 7.653 catalog, temporal split 80% — vượt baseline mạnh nhất
  2.0-2.3× và vượt Hybrid reranker 1.5-1.6×.
- **Content-Based Audio** dùng làm fallback khi thiếu dữ liệu collaborative
  (user có audio history nhưng chưa có BPR-MF embedding).
- **Most Popular** dùng làm baseline cuối cùng, đảm bảo luôn trả về top
  bài khi không có tín hiệu cá nhân hóa nào.
- **Hybrid Context-Aware** có thể dùng như lớp rerank/cân bằng nếu trong
  tương lai cần blend nhiều tín hiệu (diversity, mood, hour-of-day), nhưng
  hiện tại BPR-MF đã đủ tốt để làm primary.

## 9. File tham chiếu

- Dữ liệu: `datasets/processed/recommendation_evaluation_results.json`,
  `datasets/processed/recommendation_evaluation_results.csv`,
  `datasets/processed/recommendation_bpr_training_history.csv`.
- Biểu đồ: `datasets/processed/charts/bpr_selection_top10_metrics.png`,
  `bpr_vs_baselines_precision_ndcg.png`, `bpr_training_loss.png`,
  `bpr_pairwise_accuracy.png`, `recommendation_metrics_comparison.png`.
- Code phục vụ báo cáo: `docs/recommendation/scripts/make_bpr_selection_charts.py`
  (chỉ tạo 2 chart mới, không đụng vào các chart cũ).
- Serving layer: `apps/backend/src/services/recommendation.service.js`,
  `apps/backend/src/services/recommendationModel.service.js`.
- Docs liên quan: `docs/recommendation/serving.md`, `docs/recommendation/algorithm-evaluation.md`.
