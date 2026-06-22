# MusicFlow Recommendation Algorithm Evaluation

> Ghi chú: Kết quả trong tài liệu này dùng controlled experimental dataset của MusicFlow. Bộ dữ liệu được seed từ bài hát thật trong database, không phải hành vi người dùng thật.

## 1. Phạm Vi

Tài liệu này tổng hợp full evaluation mới nhất cho 4 thuật toán recommendation:

1. Most Popular baseline
2. Content-Based Audio
3. BPR-MF
4. Hybrid Context-Aware

Không có thay đổi backend API, frontend UI, scheduler, hay playlist generation trong đợt review này.

## 2. Dataset Và Evaluation Setup

| Thông số | Giá trị mới nhất |
|---|---:|
| Generated at | 2026-06-18T12:09:01.140Z |
| Mode | full |
| Evaluation duration | 1,170.425s |
| Experimental users | 200 |
| Eligible users evaluated | 194 |
| Catalog size | 7,653 songs |
| Source | `experiment_seed` |
| Train split | 80% temporal |
| Test positive definition | `completion_rate >= 0.5 OR implicit_rating >= 0.5 OR liked = 1` |
| Test metric set | `test_holdout_positive_set` |

Eligible user không ghi là 200 vì output full evaluation mới nhất chỉ có 194 users thỏa điều kiện `train interactions >= 200` và `test holdout positive unique >= 10`.

## 3. Algorithm Configs

| Algorithm | Config chính |
|---|---|
| Most Popular | Popularity từ train interactions, loại bài trong train của user |
| Content-Based Audio | Audio features + metadata similarity, loại bài trong train của user |
| BPR-MF | factors = 32, epochs = 50, learning_rate = 0.02, regularization = 0.01, negative_samples = 5, random_seed = 42 |
| Hybrid Context-Aware | Blend content/collaborative/context/popularity, loại bài trong train của user |

## 4. Metric Definitions

| Metric | Ý nghĩa |
|---|---|
| Precision@K | Tỷ lệ bài trong top-K nằm trong holdout positives |
| Recall@K | Tỷ lệ holdout positives được hit trong top-K |
| NDCG@K | Đo chất lượng ranking có tính vị trí hit |
| MAP@K | Mean Average Precision trên các vị trí hit |
| HitRate@K | Tỷ lệ users có ít nhất 1 hit trong top-K |
| per_user_list_coverage_at_20 | Với từng user: `top20_unique_song_count / catalog_size`; gần như bằng nhau giữa thuật toán vì mỗi list có 20 bài unique trên catalog 7,653 |
| global_catalog_coverage_at_20 | Union tất cả `song_id` được recommend trong top-20 của một thuật toán trên toàn bộ evaluated users, chia cho `catalog_size`; đây là coverage chính để báo cáo |
| unique_recommended_songs_global_at_20 | Số bài unique trong union top-20 trên toàn bộ evaluated users |
| duplicate_song_rate | Tỷ lệ trùng lặp song_id trong top-20; kỳ vọng = 0 |
| artist_repeat_rate | Mức lặp nghệ sĩ trong top-20; không phải duplicate song |
| train_leak_rate | Tỷ lệ bài recommend nằm trong train set của user; kỳ vọng = 0 |

Coverage cũ từng bị nhầm với Recall@20. Output mới đã tách riêng per-user list coverage và global catalog coverage; coverage chính trong luận văn nên dùng `global_catalog_coverage_at_20`.

Candidate pool hiện loại toàn bộ `trainSongSet` của user, tức tất cả bài đã xuất hiện trong train interactions, không chỉ train positives. `train_leak_rate` cũng được tính theo `trainSongSet`, nên metric này phản ánh đúng tỷ lệ bài top-20 bị rò rỉ từ train set.

## 5. Overall Metrics

| Metric | Most Popular | Content-Based Audio | BPR-MF | Hybrid Context-Aware |
|---|---:|---:|---:|---:|
| Precision@10 | 0.0273 | 0.0428 | **0.0985** | 0.0649 |
| Recall@10 | 0.0128 | 0.0186 | **0.0435** | 0.0291 |
| NDCG@10 | 0.0284 | 0.0470 | **0.0978** | 0.0687 |
| MAP@10 | 0.0094 | 0.0180 | **0.0365** | 0.0279 |
| HitRate@10 | 0.2371 | 0.3144 | **0.6340** | 0.4124 |
| Precision@20 | 0.0289 | 0.0459 | **0.1026** | 0.0371 |
| Recall@20 | 0.0264 | 0.0404 | **0.0892** | 0.0333 |
| NDCG@20 | 0.0300 | 0.0490 | **0.1032** | 0.0495 |
| MAP@20 | 0.0065 | 0.0128 | **0.0298** | 0.0152 |
| HitRate@20 | 0.4021 | 0.5206 | **0.8402** | 0.4639 |
| per_user_list_coverage_at_20 | 0.002613 | 0.002613 | 0.002613 | 0.002613 |
| unique_recommended_songs_global_at_20 | 74 | 332 | **640** | 248 |
| global_catalog_coverage_at_20 | 0.009669 | 0.043382 | **0.083627** | 0.032406 |
| duplicate_song_rate | 0 | 0 | 0 | 0 |
| artist_repeat_rate | 0.4134 | 0.5856 | 0.5693 | **0.4559** |
| avg_unique_artists_at_20 | **11.73** | 8.29 | 8.61 | 10.88 |
| train_leak_rate | 0 | 0 | 0 | 0 |

## 6. Coverage Review

| Algorithm | per_user_list_coverage_at_20 | unique_recommended_songs_global_at_20 | global_catalog_coverage_at_20 |
|---|---:|---:|---:|
| Most Popular | 0.002613 | 74 | 0.009669 |
| Content-Based Audio | 0.002613 | 332 | 0.043382 |
| BPR-MF | 0.002613 | 640 | 0.083627 |
| Hybrid Context-Aware | 0.002613 | 248 | 0.032406 |

`per_user_list_coverage_at_20` gần như cố định vì mỗi user nhận 20 bài không trùng trong catalog 7,653. `global_catalog_coverage_at_20` mới phản ánh mức phủ catalog của một thuật toán trên toàn bộ users được đánh giá. Theo output mới nhất, BPR-MF phủ catalog rộng nhất trong nhóm thuật toán học, đồng thời tăng mạnh relevance sau khi BPR training có history và negative sampling hợp lệ.

## 7. Metrics By User Group

Bảng dưới chọn thuật toán tốt nhất theo NDCG@10 trong output JSON mới nhất.

| Group | Users evaluated | Best by NDCG@10 | P@10 | NDCG@10 | HR@10 | Artist Repeat |
|---|---:|---|---:|---:|---:|---:|
| VPOP main | 32 | BPR-MF | 0.1406 | 0.1427 | 0.7188 | 0.6297 |
| KPOP main | 35 | BPR-MF | 0.1229 | 0.1183 | 0.7143 | 0.6143 |
| USUK main | 33 | BPR-MF | 0.1000 | 0.1003 | 0.6061 | 0.6742 |
| VPOP + KPOP | 20 | BPR-MF | 0.1050 | 0.1012 | 0.7000 | 0.4425 |
| VPOP + USUK | 19 | Hybrid Context-Aware | 0.0895 | 0.0901 | 0.5263 | 0.3553 |
| KPOP + USUK | 20 | BPR-MF | 0.0750 | 0.0882 | 0.6000 | 0.4950 |
| VPOP + KPOP + USUK | 25 | Most Popular | 0.0680 | 0.0755 | 0.4800 | 0.3820 |
| Explorer / Trending | 10 | BPR-MF | 0.1000 | 0.1065 | 0.7000 | 0.4700 |

## 8. Kết Luận Chính

Trong full evaluation mới nhất, BPR-MF dẫn đầu nhóm metric relevance top-10 và top-20: Precision@10 = 0.0985, Recall@10 = 0.0435, NDCG@10 = 0.0978, MAP@10 = 0.0365 và HitRate@10 = 0.6340. Điều này cho thấy tín hiệu collaborative filtering học được overlap giữa các user thực nghiệm sau khi BPR-MF được train đúng positive-negative pairs.

Hybrid Context-Aware vẫn là phương án cân bằng hơn khi cần blend nhiều tín hiệu: collaborative, content, popularity, context và penalty. Hybrid có NDCG@10 = 0.0687, HitRate@10 = 0.4124, artist repeat rate thấp hơn BPR-MF và có thể phù hợp khi ưu tiên serving ổn định thay vì tối đa relevance trên dataset thực nghiệm.

Content-Based Audio cạnh tranh ở vai trò fallback/cold-start-like vì không phụ thuộc vào user-user overlap và vẫn đạt Precision@20 = 0.0459, Recall@20 = 0.0404.

Most Popular là baseline cần thiết và có thể tốt trên nhóm nghe cả 3 dòng nhạc, nhưng không nên là chiến lược serving chính.

## 9. Hạn Chế

1. Dataset là dữ liệu thực nghiệm có kiểm soát, không phải dữ liệu người dùng thật.
2. Evaluation chỉ gồm eligible users có đủ train và holdout positives, nên không đại diện cho cold-start users hoàn toàn.
3. BPR-MF hiện được đánh giá trên experimental data, chưa có real-world feedback loop.
4. `artist_repeat_rate` cao/thấp cần đọc như diversity theo artist, không phải lỗi duplicate song.
5. Train leak rate = 0 trên cả 4 thuật toán, phù hợp yêu cầu evaluation công bằng.
6. `pairwise_accuracy_proxy` trong training history là proxy từ sampled positive-negative pairs, không phải AUC chính thức.

## 10. Output Files

| File | Vai trò |
|---|---|
| `datasets/processed/recommendation_evaluation_results.json` | Nguồn số liệu chính |
| `datasets/processed/recommendation_evaluation_results.csv` | Bảng metric tổng hợp |
| `datasets/processed/recommendation_evaluation_by_user.csv` | Metric theo user và thuật toán |
| `datasets/processed/recommendation_sample_outputs.json` | Mẫu recommendation output |

## 11. Biểu Đồ Và Artifact Huấn Luyện

Pipeline evaluation hiện tự xuất thêm các artifact phục vụ luận văn:

| Artifact | Vai trò |
|---|---|
| `storage/recommendation/models/bpr_mf_latest.json` | Model artifact BPR-MF mới nhất sau huấn luyện |
| `datasets/processed/recommendation_bpr_training_history.json` | Training history theo epoch dạng JSON |
| `datasets/processed/recommendation_bpr_training_history.csv` | Training history theo epoch dạng CSV |
| `datasets/processed/charts/bpr_training_loss.png` | Biểu đồ loss BPR-MF theo epoch |
| `datasets/processed/charts/bpr_pairwise_accuracy.png` | Biểu đồ `pairwise_accuracy_proxy` theo epoch |
| `datasets/processed/charts/recommendation_metrics_comparison.png` | Biểu đồ so sánh Precision@10, NDCG@10, HitRate@10 của 4 thuật toán |
| `datasets/processed/charts/recommendation_coverage_diversity.png` | Biểu đồ coverage/diversity đã normalize để so sánh xu hướng |
| `datasets/processed/charts/recommendation_global_coverage.png` | Biểu đồ riêng cho `global_catalog_coverage_at_20` |
| `datasets/processed/charts/recommendation_artist_diversity.png` | Biểu đồ riêng cho `avg_unique_artists_at_20` và `artist_repeat_rate` |

Loss giảm từ 0.628377 xuống 0.167018 cho thấy quá trình train BPR-MF có học từ positive-negative pairs. `pairwise_accuracy_proxy` tăng từ 0.766379 lên 0.935010 cho thấy mô hình ngày càng xếp positive item cao hơn negative item trong các cặp sample; đây là proxy, không phải AUC chính thức.

Biểu đồ comparison cho thấy BPR-MF tốt nhất ở nhóm metric relevance top-10 trong full evaluation mới nhất. Biểu đồ coverage/diversity cho thấy BPR-MF phủ catalog rộng hơn Hybrid, còn Hybrid cân bằng hơn giữa nhiều tín hiệu recommendation.

## 12. Reproduce

```bash
# Smoke test only
node scripts/recommendation/evaluateRecommendationAlgorithms.js --sample-users=30

# Full evaluation, model artifact, training history, and charts
node scripts/recommendation/evaluateRecommendationAlgorithms.js --full
```
