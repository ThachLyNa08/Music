---
name: musicflow-ai-recommendation
description: Build, review, and optimize MusicFlow's recommendation engine, algorithm comparison, experimental listening dataset, and automatic playlist generation. Use this skill when implementing behavior tracking, 200 experimental users, implicit feedback, content-based audio filtering, BPR-MF collaborative filtering, Hybrid Context-Aware ranking, recommendation evaluation, Redis/cache APIs, Weekly Mix, Daily Mix, Morning/Night Mix, Song Radio, Genre Deep Dive, Discover New, and thesis-ready metrics. This skill keeps the thesis-critical recommendation feature real-data driven, measurable, and prevents Codex from creating duplicate or unrelated files.
license: Complete terms in LICENSE.txt
---

# MusicFlow AI Recommendation

This skill guides development of MusicFlow's **recommendation engine** and **automatic playlist generation**.

MusicFlow thesis topic:

```text
Hệ thống phát nhạc trực tuyến tích hợp thuật toán gợi ý và tự động tạo danh sách phát dựa trên hành vi người dùng
```

Recommendation and automatic playlist generation are thesis-critical. All implementation must be behavior-based, measurable, explainable, and safe for the existing MusicFlow codebase.

---

## 0. Locked Direction For Current Thesis Phase

The current implementation direction is locked as follows:

```text
MusicFlow Recommendation Engine =
  Behavior Tracking
  + Controlled Experimental Dataset
  + Algorithm Comparison
  + Hybrid Context-Aware Ranking
  + Multi-stream Playlist Generation
```

Implement and compare these models:

1. **Most Popular / Trending baseline**
   - No ML training.
   - Uses real listen counts, likes, recent plays, and trending window.
   - Used only as a baseline for comparison.

2. **Content-Based Filtering**
   - Uses song metadata and audio features.
   - Inputs: market, genre/subgenre, artist, album, BPM, tempo_level, energy, danceability, acoustic_score, brightness, mood, vibe.
   - Uses cosine similarity or weighted feature similarity.
   - Strong for cold start, similar songs, song radio, mood playlists, and AI Playlist matching.

3. **BPR-MF Collaborative Filtering**
   - Uses implicit feedback from user listening behavior.
   - Inputs: user_id, song_id, completion_rate, skipped, liked, repeat, playlist add, artist follow, recency.
   - Trained offline/batch in AI service or scripts.
   - Strong for users with enough behavior history.

4. **Hybrid Context-Aware Recommendation**
   - Final selected production strategy if evaluation confirms it is balanced.
   - Blends Content-Based + BPR-MF + user preference + popularity/trending + context mood + novelty.
   - Applies penalties for same artist repetition, recently played tracks, duplicates, and overly similar songs.

Do not replace this direction with a single SQL genre query, a pure LLM playlist picker, or a purely UI-only implementation.

---

## 1. Project Context

Current MusicFlow structure:

```text
Luan_Van/
├─ apps/
│  ├─ backend/
│  ├─ frontend/
│  └─ ai-service/
├─ database/
├─ datasets/
│  ├─ raw/
│  └─ processed/
├─ docs/
├─ storage/
├─ scripts/
├─ agent-skills/
├─ AGENTS.md
└─ README.md
```

Main paths:

```text
apps/backend
apps/frontend
apps/ai-service
database/migrations
scripts/recommendation
datasets/processed
```

Runtime media path:

```text
apps/backend/uploads
```

Never move, rename, delete, or reorganize `apps/backend/uploads`.

Public runtime media URLs such as:

```text
/uploads/...
```

must remain compatible.

---

## 2. Important Distinctions

This skill is for recommendation based on:

```text
behavior tracking
implicit feedback
metadata
audio features
content-based filtering
collaborative filtering
BPR-MF
hybrid ranking
context-aware ranking
automatic playlist generation
evaluation metrics
```

It is different from:

```text
musicflow-ai-playlist-claude
musicflow-ai-playlist-gemini
```

Claude/Gemini are only for **natural-language prompt parsing** in AI Playlist. They must not invent final song lists. Final songs must come from MusicFlow database and pass through the recommender/matcher.

---

## 3. Core Safety Rules For Codex

Before creating or editing code:

1. Inspect existing files first.
2. Reuse existing routes, controllers, services, stores, scripts, and database patterns.
3. Do not create duplicate files with the same purpose.
4. Do not create new architecture if an equivalent module already exists.
5. Do not rewrite unrelated modules.
6. Do not rename existing APIs unless explicitly requested.
7. Do not change frontend UI while implementing recommendation logic unless the user asks.
8. Do not move `apps/backend/uploads`.
9. Do not change `/uploads/...` URL behavior.
10. Do not hardcode recommendation songs.
11. Do not use fake database rows that do not exist.
12. Do not train heavy models inside normal API requests.
13. Do not make generated/system playlists manually editable.
14. Do not push Git unless explicitly requested.
15. Do not run destructive database scripts without explicit confirmation.

When a new file is necessary, first confirm there is no existing equivalent.

Recommended file creation policy:

```text
Use existing file if present:
- apps/backend/src/routes/recommend.routes.js
- apps/backend/src/controllers/recommend.controller.js
- apps/backend/src/services/recommendation*.js
- apps/ai-service/app/services/recommendation*.py
- scripts/recommendation/*.js or *.py

Create new file only if no existing file matches the purpose.
```

---

## 4. Data Sources

Use actual schema names from the project. Common tables may include:

```text
users
songs
artists
albums
genres
song_genres
song_likes
artist_follows
listening_history
playlists
playlist_songs
user_genre_preferences
user_artist_preferences
song_audio_features
recommendation_cache
```

Do not invent schema silently. If a required column/table is missing:

1. Prefer adapting to the current schema.
2. If required, add an idempotent migration.
3. Report the migration clearly.

Recommended experiment columns:

```text
users.is_experiment TINYINT(1) DEFAULT 0
listening_history.source = 'experiment_seed'
```

If `is_experiment` is not present, add a safe migration only when the task explicitly involves experimental users.

---

## 5. Listening Behavior Tracking

Listening history must capture meaningful behavior, not every second.

Recommended fields:

```text
user_id
song_id
play_session_id
listened_duration
song_duration
completion_rate
skipped
source
started_at
ended_at
played_at
hour_of_day
day_of_week
implicit_rating
```

Rules:

- Track only valid song IDs.
- Do not spam duplicate records every second.
- Record meaningful play sessions.
- Completion rate = listened_duration / song_duration.
- Skip is true only when user leaves early.
- Tracking failure must not stop playback.
- Backend is the durable source of truth.
- Redis/cache must not be the only storage for behavior.

Recommended interpretation:

```text
positive_listen:
- listened >= 30 seconds
- or completion_rate >= 0.5

strong_positive:
- completion_rate >= 0.8
- or liked = 1
- or repeated listens

negative_signal:
- listened < 30 seconds
- or completion_rate < 0.25 and user changed song
```

---

## 6. Implicit Rating

Implicit rating converts behavior into a score for recommendation.

Recommended formula:

```text
implicit_rating =
  0.45 * completion_rate
+ 0.25 * liked
+ 0.15 * repeated
+ 0.10 * playlist_added
+ 0.05 * artist_followed
- 0.25 * skipped_early
```

Rules:

- Keep score range consistent, usually 0 to 1.
- Like and playlist add should be stronger than short listens.
- Skip penalty applies only when skipped early.
- Do not penalize non-skipped songs by accident.
- Document the formula in code comments or docs.
- If the model only supports positive interactions, convert strong positives to interaction weight and keep negative signals for filtering/ranking.

---

## 7. Experimental Dataset: 200 Users

Because the real system currently has limited real users, create a controlled experimental dataset for training and evaluation.

This dataset is allowed for thesis experiments, but it must be labeled clearly as **experimental/simulated behavior based on real songs**.

### Required user count

```text
Total experimental users: 200
```

### Required group distribution

```text
VPOP main: 35
KPOP main: 35
USUK main: 35
VPOP + KPOP: 20
VPOP + USUK: 20
KPOP + USUK: 20
VPOP + KPOP + USUK: 25
Explorer / Trending: 10
```

### User email convention

```text
exp_vpop_001@musicflow.test
exp_kpop_001@musicflow.test
exp_usuk_001@musicflow.test
exp_vpop_kpop_001@musicflow.test
exp_vpop_usuk_001@musicflow.test
exp_kpop_usuk_001@musicflow.test
exp_all_001@musicflow.test
exp_explorer_001@musicflow.test
```

### Listening count

Each experimental user should have natural variation:

```text
low activity: 40-70 listens
medium activity: 80-120 listens
high activity: 130-200 listens
```

Expected total:

```text
20,000 - 24,000 listening_history rows
```

### Behavior generation

Use real songs from the database. Do not hardcode fixed song IDs.

For matching songs:

```text
completion_rate: 0.75-1.0
skipped: false
liked probability: high
repeat probability: moderate
```

For partially matching songs:

```text
completion_rate: 0.35-0.7
skipped probability: medium
liked probability: low
```

For mismatching songs:

```text
completion_rate: 0.05-0.3
skipped: usually true
liked probability: near zero
```

Add overlap between groups so collaborative filtering can learn shared taste. Users must not be isolated by market only.

### Required seed script

Preferred path:

```text
scripts/recommendation/seedExperimentalUsersAndListening.js
```

Script requirements:

```text
--count=200
--reset
--export
```

Rules:

- Idempotent.
- `--reset` deletes only experimental users/data.
- Never delete real users.
- Use `users.is_experiment = 1` when available.
- Also detect experiment users by email `exp_%@musicflow.test`.
- Set `listening_history.source = 'experiment_seed'`.
- Print summary after running.

Summary must include:

```text
experimental users created
listening_history rows created
likes created
artist_follows created
playlist add signals created if applicable
distribution by user group
distribution by market
distribution by genre/profile
```

---

## 8. Export Users CSV

Create or reuse an export script for all users.

Preferred path:

```text
scripts/recommendation/exportUsersCsv.js
```

Output path:

```text
datasets/processed/musicflow_users_export.csv
```

Required CSV columns if data exists:

```text
user_id
username/name/display_name
email
role
is_experiment
created_at
total_listens
total_liked_songs
total_followed_artists
top_market
top_genre
last_listened_at
user_group/profile for experimental users
```

Rules:

- Export all users, real and experimental.
- Do not expose passwords, password hashes, refresh tokens, reset tokens, secrets, or private credentials.
- If a column is unavailable, leave blank or use null.
- Print the output path.
- Make export runnable independently.

---

## 9. Content-Based Filtering

Use metadata and audio features.

Inputs may include:

```text
market
genre
subgenre
artist
album
language
bpm
tempo_level
energy_score
energy
danceability
acoustic_score
brightness
mood
vibe
```

Methods:

```text
cosine similarity
weighted metadata similarity
feature vector similarity
```

Use for:

```text
cold start
similar songs
song radio
artist radio fallback
AI Playlist matching
Morning/Night Mix
Genre Deep Dive
fallback when BPR-MF is unavailable
```

Rules:

- Do not rely only on `genre_id` if audio features exist.
- Exclude unavailable/deleted songs.
- Avoid duplicates.
- Avoid too many songs from the same artist unless requested.
- Do not depend on Spotify API for audio features if local Librosa features already exist.

---

## 10. Collaborative Filtering: BPR-MF

Use BPR-MF as the main collaborative filtering model for implicit feedback.

Required behavior:

```text
Build user-item interaction matrix
Use positive interactions or implicit_rating
Train BPR-MF offline/batch
Generate top-K recommendations
Filter listened/unavailable songs
Cache or store results
```

Rules:

- Train in `apps/ai-service` or a batch script, not inside normal backend requests.
- Use experimental + real behavior data for training/evaluation.
- Use real user behavior when available.
- Fall back to content-based/cold-start/trending if user is unknown or has insufficient history.
- Save model artifacts in a safe path such as `storage/models` if the project uses it.
- Do not claim BPR-MF is complete unless it is connected end-to-end.

Minimum user threshold:

```text
if user_listen_count >= 10:
    BPR-MF can be used
else:
    use cold start + content-based + trending
```

---

## 11. Hybrid Context-Aware Ranking

Hybrid is the final serving strategy.

Recommended scoring for users with history:

```text
final_score =
  0.35 * bpr_score
+ 0.25 * content_audio_score
+ 0.15 * user_preference_score
+ 0.10 * popularity_trending_score
+ 0.10 * context_mood_score
+ 0.05 * novelty_score
- same_artist_penalty
- recently_played_penalty
- duplicate_penalty
- too_similar_penalty
```

Recommended scoring for cold-start users:

```text
final_score =
  0.35 * selected_genre_artist_score
+ 0.30 * content_audio_score
+ 0.15 * popularity_trending_score
+ 0.10 * context_mood_score
+ 0.10 * novelty_score
```

Rules:

- Normalize component scores before blending.
- Expose strategy metadata when useful.
- Keep the scoring function documented.
- Make weights easy to adjust.
- Do not hide fallback behavior.

---

## 12. Multi-Stream Recommendation

MusicFlow should not have only one recommendation list. Implement multiple streams inspired by real music platforms while staying feasible.

Recommended streams:

```text
Dành cho bạn
Weekly Mix
Daily Mix 01-06
Morning Mix
Night Mix
Song Radio
Artist Radio
Genre Deep Dive
Discover New
On Repeat
Trending Now
Favorite Songs
Recently Played
AI Playlist
```

### Weekly Mix

```text
Purpose: personalized weekly playlist from recent hybrid recommendations.
Update: weekly.
Must be read-only.
Use recent behavior from 7-30 days.
Add discovery/novelty boost.
Avoid duplicates.
```

### Daily Mix 01-06

```text
Purpose: split user taste into clusters by market/genre/artist/mood.
Update: daily or scheduled.
Keep mixes distinct.
Avoid identical playlists.
```

### Morning Mix / Night Mix

```text
Morning: happy, energetic, medium/high energy, pop/dance, work/study friendly.
Night: chill, sad, romantic, R&B/acoustic, slow/medium tempo.
Use hour_of_day and audio mood features.
```

### Song Radio

```text
Use content-based audio similarity from the current song.
Exclude the seed song.
Prefer same vibe with some market/artist diversity.
```

### Genre Deep Dive

```text
Detect recent genre spike over 3-7 days.
Create focused playlist with diversity.
```

### Discover New

```text
Use hybrid ranking + novelty boost.
Prefer unlistened songs and less repeated artists.
```

### On Repeat

```text
Use repeated listens, high completion rate, likes, and recent listening.
```

---

## 13. Recommendation Evaluation

Evaluation is required for thesis evidence.

Compare:

```text
Most Popular / Trending baseline
Content-Based Filtering
BPR-MF
Hybrid Context-Aware
```

Metrics:

```text
Precision@10
Recall@10
NDCG@10
MAP@10 if feasible
AUC
Coverage
Diversity
Novelty
Cold-start Precision@10
Duplicate rate
```

Dataset strategy:

```text
Use real + experimental listening_history.
Label experimental data clearly.
Use train/test split by user.
Prefer temporal split:
  older interactions = train
  newer interactions = test
Or leave-one-out if simpler.
```

Export evaluation results to:

```text
datasets/processed/recommendation_evaluation_results.csv
datasets/processed/recommendation_evaluation_summary.json
```

Rules:

- Same dataset for all algorithms.
- Same K value for ranking metrics.
- Exclude already-listened songs when evaluating recommendation ranking where appropriate.
- Report limitations honestly.
- Do not invent metric values.

---

## 14. Redis / Cache

Use Redis for:

```text
recommendation result cache
home recommendation cache
system playlist cache
model status
temporary job status
scheduler locks
```

Rules:

- MySQL remains durable source of truth.
- Redis unavailable must not break the app.
- Use TTL where appropriate.
- Cache invalidation after important behavior changes is preferred but fallback refresh is acceptable.
- Do not store permanent behavior only in Redis.

---

## 15. API Rules

Recommendation APIs should return real songs from database.

Suggested response shape:

```json
{
  "items": [],
  "strategy": "hybrid_context_aware",
  "generatedAt": "2026-...",
  "cache": true,
  "source": "bpr_mf+content_audio+context",
  "reason": "Based on your listening history, audio features, and current context"
}
```

Optional per-song explanation:

```text
Because you often complete similar VPOP ballads.
Because this song matches your night listening pattern.
Because it is similar to songs you liked recently.
Because it adds discovery while staying close to your taste.
```

Rules:

- Do not return hardcoded demo songs.
- Include enough song data for frontend cards/rows.
- Keep cover/audio URLs compatible with `/uploads/...`.
- Avoid duplicates.
- Return fallback with strategy metadata when model/cache is unavailable.

---

## 16. Automatic Playlist Permission Rules

Generated playlists should be read-only by default.

Use actual project columns, for example:

```text
type = system or ai
is_system = true
system_key = weekly_mix / daily_mix_01 / morning_mix / night_mix / genre_deep_dive
```

Rules:

- System/AI playlists must not show edit/search-add controls.
- Users may clone generated playlists if clone feature exists.
- Covers should use:
  1. playlist custom/system cover
  2. first song cover
  3. default fallback cover
- Do not silently create empty playlists.
- Do not duplicate the same playlist generation logic in multiple files.

---

## 17. Backend / AI Service Architecture

Recommended architecture:

```text
Frontend PlayerBar sends behavior
  -> Backend stores listening_history in MySQL
  -> AI service or scripts compute:
       - content vectors
       - BPR-MF model
       - hybrid recommendations
       - evaluation metrics
  -> Backend serves recommendations to frontend
  -> Scheduler creates/updates automatic playlists
  -> Redis caches results when available
```

Rules:

- Backend handles auth, DB writes/reads, playlist permissions.
- AI service handles heavy ML/model computation.
- Scheduler must be idempotent.
- Do not block playback on recommendation logic.
- Do not make frontend responsible for recommendation scoring.

---

## 18. Frontend Rules

Frontend recommendation sections should:

```text
Use real API results
Show loading state
Show empty state
Show error state
Show "Xem tất cả" where useful
Avoid duplicate cards
Display explanations if provided
Work with QueuePanel open
```

Do not:

```text
Hardcode AI demo tracks
Create fake recommendation cards
Rewrite unrelated page layout
Break PlayerBar or QueuePanel
```

Recommended UI sections:

```text
Dành cho bạn
Gợi ý hôm nay
Daily Mix
Weekly Mix
Morning Mix
Night Mix
Genre Deep Dive
Bài hát tương tự
Nghệ sĩ bạn có thể thích
Discover New
On Repeat
```

---

## 19. Error Handling & Fallback

Handle:

```text
No listening history
No preferred genres
No matching songs
BPR-MF model unavailable
Redis unavailable
AI service unavailable
User not authenticated
Duplicate filtering removes too many songs
Generated playlist has too few songs
Experimental dataset not seeded
```

Fallback hierarchy:

```text
hybrid_context_aware
-> bpr_mf
-> content_based_audio
-> cold_start_preferences
-> trending
-> popular
-> newest
```

---

## 20. Testing Checklist

### Experimental data

```text
- 200 users created.
- is_experiment = 1 or exp_% email convention applied.
- source = experiment_seed applied to listening history.
- No real users deleted by reset.
- CSV export created.
- Market/group distribution is correct.
```

### Behavior tracking

```text
- Play event is recorded.
- Completion rate is calculated.
- Skip is detected correctly.
- Like affects implicit rating.
- Playlist add/follow affects score if implemented.
- Tracking failure does not stop playback.
```

### Algorithms

```text
- Most Popular baseline works.
- Content-Based recommendations work.
- BPR-MF trains from interactions.
- Hybrid blends scores and applies penalties.
- Cold-start fallback works.
- Unknown user fallback works.
```

### Evaluation

```text
- Same dataset used for all algorithms.
- Precision@10 / Recall@10 / NDCG@10 computed.
- AUC computed if feasible.
- Coverage and diversity computed.
- Results exported to CSV/JSON.
```

### Playlists

```text
- Weekly Mix generated.
- Daily Mix generated.
- Morning/Night Mix generated.
- Genre Deep Dive generated.
- Discover New and On Repeat generated if implemented.
- Generated playlists are read-only.
- Cover fallback works.
```

### Frontend

```text
- Home recommendation sections load.
- Song cards/rows play correctly.
- Like state persists.
- QueuePanel still works.
- No major console errors.
```

---

## 21. Required Output Format For Codex

When recommendation work is complete, report:

```text
Recommendation summary:
- ...

Files changed:
- path: reason

Files reused instead of duplicated:
- ...

Database changes:
- migration name or none

Scripts added/updated:
- seedExperimentalUsersAndListening.js
- exportUsersCsv.js
- evaluation script if added

Data generated:
- experimental users:
- listening_history rows:
- likes:
- follows:
- CSV exports:

Strategy:
- baseline/content_based/bpr_mf/hybrid_context_aware/fallback

Evaluation:
- metrics computed:
- output files:

Generated playlists:
- ...

Cache behavior:
- ...

Safety check:
- Real users touched: yes/no
- Runtime media touched: yes/no
- /uploads URL changed: yes/no
- PlayerBar affected: yes/no
- QueuePanel affected: yes/no
- API contract changed: yes/no
- Duplicate files created: yes/no

Limitations:
- ...

Manual test:
- ...
```

---

## 22. Thesis Honesty Rules

Use precise wording:

```text
experimental/simulated behavior data
controlled dataset
real songs from MusicFlow database
implicit feedback
batch training
algorithm comparison
hybrid recommendation
```

Do not claim:

```text
200 real users used the system
Spotify algorithm fully reproduced
BART implemented
LLM selected songs directly
full ML complete if model is not connected end-to-end
```

Recommended thesis wording:

```text
Do hệ thống mới triển khai nên số lượng người dùng thật còn hạn chế, đề tài xây dựng thêm bộ dữ liệu thực nghiệm có kiểm soát gồm 200 người dùng mô phỏng. Các hành vi được sinh dựa trên bài hát thật trong cơ sở dữ liệu, bao gồm số lần nghe, tỷ lệ hoàn thành bài hát, hành vi bỏ qua, lượt thích, theo dõi nghệ sĩ và thời điểm nghe. Bộ dữ liệu này được dùng để huấn luyện, kiểm thử và so sánh các thuật toán gợi ý.
```

---

## Reminder

This skill protects the most important part of the MusicFlow thesis. The recommendation system must be:

```text
real-data driven
behavior-based
algorithmically comparable
multi-stream
explainable
testable
safe for the existing app
honest about limitations
```

Codex must implement narrowly, reuse existing files, avoid duplicate modules, and preserve playback, queue, uploads, and API stability.
