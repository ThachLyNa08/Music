# MusicFlow Recommendation V4 Report

## 1. Metrics Summary

| Metric | Most Popular | Content-Based | BPR-MF Hybrid | LightGCN Hybrid |
|---|---|---|---|---|
| Precision@10 | 0.0096 | 0.0202 | 0.0457 | 0.0453 |
| Recall@10 | 0.0014 | 0.0027 | 0.0042 | 0.0039 |
| NDCG@10 | 0.0109 | 0.0203 | 0.0465 | 0.0455 |
| HitRate@10 | 0.0835 | 0.1534 | 0.1979 | 0.1916 |
| Coverage@20 | 0.0101 | 0.3262 | 0.8983 | 0.9661 |
| ArtistDiversity@20 | 0.6356 | 0.1025 | 0.6845 | 0.6995 |
| GenreDiversity@20 | 0.3946 | 0.0820 | 0.2458 | 0.2690 |
| Novelty@20 | 0.3829 | 0.7251 | 0.9025 | 0.9196 |

## 2. Charts

### 2.1. Metrics Overview
![Metrics Overview](../../../storage/recommendation/evaluation/v4/charts/metrics_overview_v4.png)

### 2.2. HitRate@10 Comparison
![HitRate Comparison](../../../storage/recommendation/evaluation/v4/charts/hitrate_comparison_v4.png)

### 2.3. Coverage@20 Comparison
![Coverage Comparison](../../../storage/recommendation/evaluation/v4/charts/coverage_comparison_v4.png)

### 2.4. Diversity Comparison
![Diversity Comparison](../../../storage/recommendation/evaluation/v4/charts/diversity_comparison_v4.png)

### 2.5. Novelty@20 Comparison
![Novelty Comparison](../../../storage/recommendation/evaluation/v4/charts/novelty_comparison_v4.png)

### 2.6. LightGCN vs BPR-MF
![LightGCN vs BPR](../../../storage/recommendation/evaluation/v4/charts/lightgcn_vs_bpr_v4.png)

### 2.7. Training Loss
![LightGCN Loss](../../../storage/recommendation/evaluation/v4/charts/training_loss_lightgcn_v4.png)

![BPR Loss](../../../storage/recommendation/evaluation/v4/charts/training_loss_bpr_mf_v4.png)

### 2.8. Original Charts
![Precision Recall Comparison](../../../storage/recommendation/evaluation/v4/charts/precision_recall_comparison_v4.png)

![Coverage Diversity Novelty](../../../storage/recommendation/evaluation/v4/charts/coverage_diversity_novelty_v4.png)

![NDCG Comparison](../../../storage/recommendation/evaluation/v4/charts/ndcg_comparison_v4.png)
