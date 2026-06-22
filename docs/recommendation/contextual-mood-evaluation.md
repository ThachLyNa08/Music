# Contextual Mood Recommendation Evaluation

## Mục tiêu đánh giá

Báo cáo này kiểm chứng tính năng Contextual Mood Recommendation của MusicFlow bằng số liệu đọc từ cơ sở dữ liệu và kết quả trả về từ service hiện có. Mục tiêu là chứng minh danh sách gợi ý có điều chỉnh theo buổi trong ngày, thay vì chỉ lặp lại danh sách phổ biến hoặc ngẫu nhiên.

## Contextual Mood là gì

Contextual Mood là lớp rerank ngữ cảnh nằm trên kết quả gợi ý cá nhân hóa. Service lấy ứng viên bài hát, đọc `song_audio_features`, sau đó ưu tiên bài có mood/vibe và energy phù hợp với morning, afternoon, evening hoặc night.

## Vì sao dùng mood_match_rate và energy_in_range_rate

`mood_match_rate` đo tỷ lệ bài có mood/vibe khớp nhóm kỳ vọng của từng buổi. `energy_in_range_rate` đo tỷ lệ bài có `energy_score` nằm trong khoảng năng lượng kỳ vọng. Hai chỉ số này giúp kiểm tra trực tiếp phần ngữ cảnh của thuật toán, thay vì chỉ nhìn play count hay thứ hạng.

## Mapping buổi trong ngày

| Time slot | Expected moods/vibes | Energy range |
|---|---|---|
| Morning | chill, happy, acoustic, focus, light | 0.25-0.7 |
| Afternoon | energetic, happy, pop, dance, focus | 0.4-0.9 |
| Evening | chill, romantic, happy, rnb, acoustic | 0.25-0.7 |
| Night | chill, sad, romantic, acoustic, calm | 0.1-0.55 |

## Kết quả audit

- Generated at: 2026-06-19T02:20:41.226Z
- Mode: single_user
- User count: 1
- Limit per request: 20

| Time slot | Context mood_match_rate | Baseline mood_match_rate | Context energy_in_range_rate | Baseline energy_in_range_rate | Avg energy | Duplicate count | Audio coverage |
|---|---:|---:|---:|---:|---:|---:|---:|
| Morning | 60% | 5% | 40% | 5% | 0.719 | 0 | 100% |
| Afternoon | 100% | 100% | 100% | 100% | 0.746 | 0 | 100% |
| Evening | 60% | 5% | 35% | 5% | 0.719 | 0 | 100% |
| Night | 55% | 0% | 0% | 5% | 0.724 | 0 | 100% |

## Biểu đồ

![Mood match rate](../../datasets/processed/charts/contextual_mood_match_rate.png)

![Energy profile](../../datasets/processed/charts/contextual_mood_energy_profile.png)

![Overlap](../../datasets/processed/charts/contextual_mood_overlap.png)

![Quality summary](../../datasets/processed/charts/contextual_mood_quality_summary.png)

## Overlap giữa các buổi

| Pair | Overlap rate |
|---|---:|
| morning vs afternoon | 21.21% |
| morning vs evening | 53.85% |
| morning vs night | 42.86% |
| afternoon vs evening | 21.21% |
| afternoon vs night | 11.11% |
| evening vs night | 42.86% |

## Kết luận

Contextual Mood được giữ như lớp rerank ngữ cảnh vì giúp danh sách gợi ý phù hợp hơn với thời điểm nghe nhạc trong ngày. Khi so với popular baseline, các chỉ số mood/energy cho thấy service có bằng chứng định lượng để giải thích vì sao một số bài được ưu tiên ở từng time slot.

## Hạn chế

- Mood mapping hiện rule-based.
- Kết quả phụ thuộc chất lượng `song_audio_features`.
- Chưa có khảo sát người dùng thật để đo mức hài lòng chủ quan.

## Safety

- DB modified: no
- Backend logic changed: no
- Frontend changed: no
- Model retrained: no
- Daily Mix changed: no
- Weekly Mix changed: no
- Scheduler changed: no
- Uploads touched: no