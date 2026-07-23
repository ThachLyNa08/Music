# Tempo-aware Recommendation & Contextual Audio Search

## 1. Mục tiêu
Module bổ sung khả năng hiểu nhịp độ, năng lượng và độ phù hợp ngữ cảnh nghe nhạc như tập luyện, tập trung hoặc thư giãn.

## 2. Mối liên hệ với LightGCN
LightGCN Hybrid V4 vẫn là core recommendation model. LightGCN sinh candidates dựa trên hành vi nghe; tempo-aware layer chỉ xếp hạng lại nhẹ theo audio features và ngữ cảnh.

## 3. Kiến trúc module
Luồng chính: LightGCN candidates -> audio feature lookup -> tempo-aware re-ranking -> response metadata. Cold-start vẫn đi qua Content-Based V4 rồi Most Popular V4.

## 4. Audio feature extraction
Script `scripts/audio_features/extract_song_audio_features.py` đọc file audio hiện có trong DB và lưu vào `song_audio_features`. Librosa được triển khai trong script hiện tại; Essentia là tùy chọn nâng cấp nếu môi trường cài được thư viện.

## 5. BPM normalization
Nếu BPM nhỏ hơn 70 thì nhân đôi, nếu lớn hơn 180 thì chia đôi. Bucket: slow < 90, medium 90-119, fast >= 120.

## 6. User tempo profile
Profile lấy listening history gần đây, join `song_audio_features`, dùng completion rate, skip signal, listen duration và recency để tính phân bố tempo.

## 7. Tempo-aware re-ranking
Runtime score: `0.70 * lightgcn + 0.15 * tempo + 0.07 * energy + 0.05 * danceability + 0.03 * diversity`. Nếu thiếu audio feature, score tempo dùng trung lập.

## 8. AI Search integration
AI Search dùng `detectTempoIntent` cho query như “nhạc nhanh để tập gym” và re-rank candidates bằng text score + semantic score + tempo/energy/danceability score.

## 9. AI Playlist integration
AI Playlist intent parser nhận diện tempo/activity và ranking cộng thêm tempo match, energy match, danceability match. Reason tiếng Việt được giữ trong preview/save.

## 10. Similar Songs integration
Similar songs vẫn giữ genre/artist/album similarity; nếu seed có audio features thì ưu tiên cùng tempo bucket và energy/danceability/brightness gần nhau.

## 11. Evaluation metrics
Kết quả hiện tại được xuất ra `storage/recommendation/evaluation/v4/tempo_aware_metrics.json`.

```json
{
  "AudioFeatureCoverage": {
    "extracted_songs": 7629,
    "total_songs": 7661,
    "coverage": 0.995823
  },
  "TempoProfileCoverage": {
    "users_with_min_3_featured_listens": 2204,
    "total_users": 2212,
    "coverage": 0.996383
  },
  "TempoMatch@10": 0.5066,
  "ContextFit@10": null,
  "RerankDelta": null,
  "AISearchTempoIntentAccuracy": {
    "rule_tests": 4,
    "passed": 4,
    "accuracy": 1.0,
    "note": "Rule-based intent detector smoke prompts only; not a labeled production benchmark."
  },
  "comparison": {
    "baseline": "LightGCN raw candidates",
    "treatment": "LightGCN + Tempo-aware Re-ranking"
  }
}
```

## 12. Hạn chế
- ContextFit@10 cần bộ nhãn ngữ cảnh nghe thật hoặc đánh giá thủ công, chưa fake số liệu.
- RerankDelta cần lưu song order trước/sau cho cùng user batch, chưa fake số liệu.

## 13. Hướng phát triển
Có thể bổ sung Essentia trong môi trường production, chạy batch extraction định kỳ, và đánh giá A/B trên hành vi nghe thật khi có đủ traffic.
## Tempo-aware System Playlists
Các playlist theo thời điểm sử dụng context audio rules để chọn và xếp hạng lại bài hát bằng audio features thật:

- Morning Vibes ưu tiên nhịp medium, năng lượng vừa và brightness cao để phù hợp buổi sáng.
- Afternoon Vibes ưu tiên medium/fast, năng lượng và brightness trung bình-cao cho buổi chiều.
- Evening Vibes ưu tiên medium/slow, năng lượng thấp-vừa cho không gian buổi tối.
- Night Vibes ưu tiên slow, năng lượng thấp và tránh fast/high energy quá nhiều.

Đây là phần mở rộng của tempo-aware layer, không thay thế LightGCN. Daily Mix vẫn ưu tiên gu người dùng và hành vi nghe; time-based playlists ưu tiên ngữ cảnh thời điểm. Nếu bài hát thiếu audio features thì hệ thống dùng điểm trung lập và không loại toàn bộ candidate.
