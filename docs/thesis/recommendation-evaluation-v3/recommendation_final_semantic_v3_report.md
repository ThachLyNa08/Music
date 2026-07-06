# MusicFlow - B?o c?o ??nh gi? h? th?ng g?i ? V3 ch?nh th?c

## 1. Ngu?n d? li?u
- S? user th?c nghi?m: 200
- S? user h?p l?: 194
- Catalog size: 7653
- Temporal split: 80% temporal
- Semantic canonical file: datasets/processed/semantic/profiles/song_semantic_profiles.csv
- S? d?ng semantic: 7661
- Attached rate: 1

## 2. C?c thu?t to?n so s?nh
- Most Popular
- Content-Based + Semantic
- BPR-MF
- Hybrid + Semantic

## 3. K?t qu? ch?nh
| algorithm | precision_at_10 | recall_at_10 | ndcg_at_10 | map_at_10 | hitrate_at_10 | coverage_at_20 | diversity | novelty | train_leak_rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Most Popular | 0.0273 | 0.0128 | 0.0284 | 0.0094 | 0.2371 | 0.009669 | 11.73 | 0.0071 | 0 |
| Content-Based + Semantic | 0.0314 | 0.0139 | 0.0325 | 0.0107 | 0.268 | 0.03711 | 9.21 | 0.5428 | 0 |
| BPR-MF | 0.0985 | 0.0435 | 0.0978 | 0.0365 | 0.634 | 0.083627 | 8.61 | 0.1104 | 0 |
| Hybrid + Semantic | 0.0644 | 0.0277 | 0.0712 | 0.0284 | 0.4381 | 0.035672 | 10.61 | 0.2878 | 0 |

Thu?t to?n t?t nh?t theo NDCG@10 l? **BPR-MF**. BPR-MF ti?p t?c n?i b?t v? h?c tr?c ti?p latent preference t? l?ch s? nghe implicit, n?n b?t ???c quan h? user-item t?t h?n c?c baseline d?a tr?n ?? ph? bi?n ho?c ??c tr?ng n?i dung ??n l?.

## 4. Vai tr? Semantic Profiles
| algorithm | attached_rate | lyrics_based_rate | metadata_only_rate | needs_review_rate | mood_match_rate | average_semantic_confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Most Popular | 1 | 0.7072 | 0.2928 | 0 | 0.5111 | 0.6649 |
| Content-Based + Semantic | 1 | 0.782 | 0.218 | 0 | 0.8879 | 0.68 |
| BPR-MF | 1 | 0.7858 | 0.2142 | 0 | 0.5018 | 0.6672 |
| Hybrid + Semantic | 1 | 0.8601 | 0.1399 | 0 | 0.7523 | 0.6843 |

Semantic Profiles gi?p t?ng kh? n?ng di?n gi?i mood/context, ??c bi?t ? Content-Based + Semantic v? Hybrid + Semantic. D? li?u n?y c?ng l? t?ng tham kh?o cho AI Playlist, Mood Mix, Morning/Night Vibes v? reranking c? ng? ngh?a.

## 5. So s?nh V2 v? V3
| algorithm | metric | v2_value | v3_value | delta | delta_percent |
| --- | --- | --- | --- | --- | --- |
| Most Popular | precision_at_10 | 0.0273 | 0.0273 | 0 | 0 |
| Most Popular | ndcg_at_10 | 0.0284 | 0.0284 | 0 | 0 |
| Most Popular | hitrate_at_10 | 0.2371 | 0.2371 | 0 | 0 |
| Most Popular | global_catalog_coverage_at_20 | 0.009669 | 0.009669 | 0 | 0 |
| Content-Based + Semantic | precision_at_10 | 0.0314 | 0.0314 | 0 | 0 |
| Content-Based + Semantic | ndcg_at_10 | 0.0325 | 0.0325 | 0 | 0 |
| Content-Based + Semantic | hitrate_at_10 | 0.268 | 0.268 | 0 | 0 |
| Content-Based + Semantic | global_catalog_coverage_at_20 | 0.03711 | 0.03711 | 0 | 0 |
| BPR-MF | precision_at_10 | 0.0985 | 0.0985 | 0 | 0 |
| BPR-MF | ndcg_at_10 | 0.0978 | 0.0978 | 0 | 0 |
| BPR-MF | hitrate_at_10 | 0.634 | 0.634 | 0 | 0 |
| BPR-MF | global_catalog_coverage_at_20 | 0.083627 | 0.083627 | 0 | 0 |
| Hybrid + Semantic | precision_at_10 | 0.0644 | 0.0644 | 0 | 0 |
| Hybrid + Semantic | ndcg_at_10 | 0.0712 | 0.0712 | 0 | 0 |
| Hybrid + Semantic | hitrate_at_10 | 0.4381 | 0.4381 | 0 | 0 |
| Hybrid + Semantic | global_catalog_coverage_at_20 | 0.035672 | 0.035672 | 0 | 0 |

K?t qu? V3 g?n nh? gi? nguy?n V2 v? setup ??nh gi?, split, random seed v? candidate generation ???c gi? nguy?n; thay ??i ch?nh l? semantic source ???c tr? v? canonical CSV ?? chu?n h?a.

## 6. K?t lu?n cho lu?n v?n
- M? h?nh l?i ???c ch?n: **BPR-MF**.
- Vai tr? semantic: t?ng b? tr? ?? gi?i th?ch mood/context, ph?c v? content-based retrieval v? reranking.
- H?n ch?: d? li?u th?c nghi?m l? d? li?u m? ph?ng/seed, s? positive holdout th?c s? m?i c?n h?n ch?, ch?a ph?n ?nh ??y ?? h?nh vi ng??i d?ng th?t.
- H??ng ph?t tri?n: c?p nh?t semantic b?ng LLM ch?t l??ng cao h?n, m? r?ng online feedback v? A/B testing th?c t?.
