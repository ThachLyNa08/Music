# Recommendation Evaluation V3

V3 là bản đánh giá chính thức của hệ thống gợi ý MusicFlow để đưa vào luận văn.

## Semantic Source

`datasets/processed/semantic/profiles/song_semantic_profiles.csv`

- Semantic attached rate: `1.0000`
- Semantic Profiles dùng làm tầng bổ trợ cho reranking, context matching, Mood Mix, Morning/Night Vibes và AI-assisted music discovery.

## Recommendation Decision

BPR-MF là mô hình lõi được chọn cho hệ thống recommendation vì đạt kết quả tốt nhất trên các chỉ số chính như Precision@10, NDCG@10 và HitRate@10.

Semantic Profiles không thay thế mô hình lõi. Chúng đóng vai trò bổ trợ ngữ nghĩa để cải thiện khả năng diễn giải mood/context và hỗ trợ các lớp gợi ý/reranking.

## V2 vs V3

V3 matches V2 metrics exactly vì setup đánh giá và semantic content không đổi. Điểm khác biệt là artifact V3 đã được chuẩn hóa, đóng gói theo cấu trúc riêng và trỏ về canonical semantic profile.

## Included Artifacts

- `recommendation_final_semantic_v3_report.md`
- `recommendation_final_semantic_v3_thesis_notes.md`
- `v3_main_results_table.csv`
- `v3_semantic_quality_table.csv`
- `charts/`
