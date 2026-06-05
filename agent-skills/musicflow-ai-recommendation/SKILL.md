---

name: musicflow-ai-recommendation
description: Build, review, and optimize MusicFlow's recommendation engine and automatic playlist generation. Use this skill when implementing listening behavior tracking, implicit rating, cold start, content-based filtering, collaborative filtering, SVD, Redis caching, recommendation APIs, Weekly Mix, Daily Mix, Mood Mix, Genre Deep Dive, and evaluation metrics. This skill keeps the thesis-critical recommendation feature real-data driven and not hardcoded.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow AI Recommendation

This skill guides development of MusicFlow's **recommendation engine** and **automatic playlist generation**.

This is a thesis-critical feature. MusicFlow's topic is:

```text
Hệ thống phát nhạc trực tuyến tích hợp thuật toán gợi ý và tự động tạo danh sách phát dựa trên hành vi người dùng
```

Therefore, recommendation and automatic playlist generation must be implemented carefully with real user behavior data.

## Purpose

Use this skill for:

* Listening behavior tracking
* Listening history API
* Implicit rating calculation
* Cold start recommendation
* Content-based filtering
* Collaborative filtering
* SVD recommendation model
* Hybrid recommendation strategy
* Redis recommendation caching
* Similar songs
* Weekly Mix
* Daily Mix
* Morning Mix
* Night Mix
* Mood Mix
* Genre Deep Dive
* Trending integration
* Recommendation explanations
* Recommendation evaluation
* AI service recommendation endpoints
* Scheduler/cron jobs for recommendation and playlist generation

## Project Context

Current MusicFlow structure:

```text
Luan_Van/
├─ apps/
│  ├─ backend/
│  ├─ frontend/
│  └─ ai-service/
├─ database/
├─ datasets/
├─ docs/
├─ storage/
├─ agent-skills/
├─ AGENTS.md
└─ README.md
```

Main backend:

```text
apps/backend
```

Main AI service:

```text
apps/ai-service
```

Main frontend:

```text
apps/frontend
```

Runtime media:

```text
apps/backend/uploads
```

Do not move, rename, delete, or reorganize `apps/backend/uploads`.

Frontend/backend public media URLs such as:

```text
/uploads/...
```

are runtime URLs served by the backend and must remain compatible.

## Important Distinction

This skill is for **recommendation based on user behavior, metadata, and algorithms**.

It is different from:

```text
musicflow-ai-playlist-claude
musicflow-ai-playlist-gemini
```

Claude/Gemini skills are for **LLM-based natural-language playlist prompt parsing**.

This recommendation skill focuses on:

```text
behavior tracking
implicit feedback
cold start
content-based filtering
collaborative filtering
hybrid recommendation
automatic playlist generation
recommendation evaluation
```

The two systems may work together, but they should not be confused.

## Core Principle

Recommendation must use real data.

Useful behavior signals:

```text
- song played
- listened duration
- song duration
- completion rate
- skip behavior
- like behavior
- repeat behavior
- playlist add
- artist follow
- selected genres during registration
- selected artists during registration
- time of day
- recently played songs
- search/click source if available
```

Do not hardcode recommendation lists.

Do not describe simple SQL genre filtering as a complete ML recommendation engine unless clearly labeled as a fallback.

## Expected Data Sources

Use actual schema names from the project. Possible tables include:

```text
users
songs
artists
albums
genres
song_likes
artist_follows
listening_history
playlists
playlist_songs
user_genre_preferences
user_artist_preferences
```

If some tables do not exist yet, do not invent them silently. Either:

* use the existing schema, or
* add a migration if the task explicitly requires it.

## Listening Behavior Tracking

Listening history should capture enough data for personalization.

Possible fields:

```text
user_id
song_id
listened_duration
song_duration
completion_rate
skipped
source
played_at
implicit_rating
```

Rules:

* Track only valid song IDs.
* Do not spam duplicate listen records every second.
* Prefer recording meaningful play sessions.
* Completion rate should be based on listened duration / song duration.
* Skip should be detected only when the user leaves the song early enough.
* Tracking failure must not stop music playback.
* Tracking should happen through backend APIs.
* Frontend should send listen events from player store/playback lifecycle.

Suggested endpoint if project-compatible:

```text
POST /api/songs/:id/listen
```

or use the existing endpoint if already implemented.

## Implicit Rating

Implicit rating converts user behavior into a score for recommendation.

Possible positive signals:

```text
- completed most of the song
- liked the song
- replayed the song
- added to playlist
- followed artist
- listened during repeated sessions
```

Possible negative signals:

```text
- skipped early
- removed from playlist
- disliked if implemented
```

Example conceptual formula:

```text
implicit_rating =
  base_listen_score
  + completion_bonus
  + like_bonus
  + playlist_add_bonus
  + repeat_bonus
  + followed_artist_bonus
  - skip_penalty
```

Rules:

* Document the formula.
* Keep the score range consistent.
* Do not overvalue accidental short plays.
* Like and playlist add should be stronger than a short listen.
* Skip should only be negative when the listened duration is low enough.
* Avoid creating negative scores that break model training unless the model supports it.

## Cold Start Recommendation

For new users or users with little listening history, use cold start logic.

Use:

```text
- selected genres during registration
- selected artists during registration
- popular songs
- trending songs
- diverse sampling across preferred genres
```

Rules:

* Do not return empty recommendations for new users.
* Do not recommend only one genre endlessly.
* Blend preferred genres with trending songs.
* Use registration preferences before enough behavior exists.
* If no preferences exist, use trending/popular/newest songs as fallback.
* Make cold start status clear in API metadata when useful.

## Content-Based Filtering

Use song metadata:

```text
genre
subgenre
artist
album
language
mood if available
tempo if available
tags if available
```

Possible methods:

```text
TF-IDF vectorization
cosine similarity
weighted metadata similarity
```

Use content-based filtering for:

* New users
* Low-history users
* Similar songs
* Song-based recommendations
* Playlist seed expansion
* Fallback when collaborative filtering is unavailable

Rules:

* Do not rely only on `genre_id` if richer metadata exists.
* If only genre/artist metadata is available, document the limitation.
* Avoid returning too many songs from the same artist unless user requested it.
* Exclude unavailable/deleted songs.
* Avoid duplicates.

## Collaborative Filtering

Use collaborative filtering when enough behavior data exists.

Preferred approach:

```text
Build user-item interaction matrix
Use implicit_rating as interaction score
Train SVD or similar matrix factorization model
Generate top-K recommendations
Filter unavailable songs
Remove duplicates and overplayed songs
Cache result
```

Rules:

* Use only real behavior data.
* Do not train inside a normal user request if training is expensive.
* Prefer scheduled/batch computation in AI service.
* Save/cache recommendations for fast backend response.
* Return fallback if model is unavailable.
* Do not claim SVD is implemented if it is not connected end-to-end.

## Hybrid Strategy

Recommended decision logic:

```text
if user_listen_count >= 10:
    use collaborative filtering with content-based fallback
else:
    use cold start + content-based + trending
```

Recommendation API should expose strategy metadata when possible:

```json
{
  "strategy": "collaborative|content_based|hybrid|cold_start|trending_fallback",
  "generatedAt": "2026-...",
  "cache": true,
  "items": []
}
```

## Redis Cache

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

* Do not use Redis as the only permanent storage for user behavior.
* MySQL should remain the durable source of truth.
* Use cache TTL.
* Invalidate cache after important behavior changes when needed.
* If Redis is unavailable, backend should fall back gracefully.

## Recommendation API Rules

Recommendation APIs should return real songs from the database.

Suggested response shape:

```json
{
  "items": [],
  "strategy": "hybrid",
  "generatedAt": "2026-...",
  "cache": true,
  "reason": "Based on your listening history and favorite genres"
}
```

Optional per-song reason:

```text
Because you liked similar VPOP ballads.
Because you often listen to this artist at night.
Popular in your favorite genre.
Similar to songs you recently completed.
```

Rules:

* Do not return hardcoded demo songs.
* Include enough song data for frontend cards/rows.
* Keep cover URLs compatible with `/uploads/...`.
* Avoid duplicate songs.
* Return empty state message only when no fallback exists.

## Automatic Playlist Generation

Automatic playlists are central to the thesis. They should be based on behavior and/or recommendation output.

Generated playlists must follow playlist permission rules:

```text
Generated playlist = read-only by default
User may clone generated playlist if manual editing is needed
```

### Weekly Mix

Purpose:

```text
Personalized weekly playlist generated from recent recommendation results.
```

Rules:

* Generated per user.
* Updated weekly.
* Read-only.
* Uses recent listening history and recommendation output.
* Avoid duplicates.
* Use stable cover fallback.

### Daily Mix

Purpose:

```text
Personalized mixes based on dominant genres, artists, or listening clusters.
```

Rules:

* Group by genre/artist/mood clusters if possible.
* Avoid all mixes looking identical.
* Keep mix identity stable enough for user recognition.
* Avoid duplicate tracks across mixes where possible.

Suggested existing MusicFlow behavior:

```text
Daily Mix 01–06
Weekly Mix
Morning Mix
Night Mix
Mood Mix
Genre Deep Dive
```

### Morning Mix / Night Mix / Mood Mix

Use time-of-day behavior:

```text
morning listening pattern
night listening pattern
relax/chill/focus behavior
```

If mood tags do not exist:

* Infer gently from genres/subgenres and listening time.
* Document limitation.
* Avoid pretending there is real emotion analysis if metadata is not available.

### Genre Deep Dive

Use recent genre spike:

```text
if a genre is listened to more than usual in recent days:
    create genre-focused playlist
```

Rules:

* Use recent behavior.
* Avoid creating empty playlists.
* Keep playlist read-only.
* Use enough songs from the detected genre.
* Add diversity if possible.

### Recently Played / Favorite Songs / Trending

If these are implemented as system playlists:

* Recently Played should reflect real listening history.
* Favorite Songs should reflect real likes.
* Trending should use real listen counts/period logic.
* Do not make them manually editable system playlists.

## Playlist Permission Rules

Generated playlists should use the existing schema, for example:

```text
type = system or ai
is_system = true when applicable
system_key = daily_mix_01 / weekly_mix / mood_mix / etc.
```

Use actual project columns.

Rules:

* Do not show edit/search-add controls for generated playlists.
* Do not allow direct manual modification.
* Allow clone-to-edit if feature exists.
* Correctly display owner/system attribution.
* Keep covers stable.

## Backend / AI Service Architecture

Recommended architecture:

```text
Frontend player sends behavior
  -> Backend stores listening_history
  -> AI service computes recommendations periodically
  -> Redis caches recommendation results
  -> Backend serves recommendations to frontend
  -> Scheduler creates/updates automatic playlists
```

Rules:

* Do not block frontend playback on recommendation processing.
* Do not run heavy training inside request/response cycle.
* Backend should handle auth, DB write/read, playlist permissions.
* AI service should handle model computation when ML becomes heavy.
* Scheduler/cron should be safe and idempotent.

## Frontend Rules

Frontend recommendation sections should:

* Use real API results.
* Show loading state.
* Show empty state.
* Show error state.
* Show "Xem tất cả" where useful.
* Avoid duplicate songs/cards.
* Display explanation if backend provides it.
* Keep responsive behavior with QueuePanel open.
* Avoid hardcoded "AI demo" tracks in production path.

Recommended UI sections:

```text
Dành cho bạn
Gợi ý hôm nay
Daily Mix
Weekly Mix
Morning Mix
Night Mix
Mood Mix
Genre Deep Dive
Bài hát tương tự
Nghệ sĩ bạn có thể thích
```

## Error Handling

Handle:

* No listening history
* No preferred genres
* No matching songs
* Model unavailable
* Redis unavailable
* AI service unavailable
* User not authenticated
* Duplicate filtering removes too many songs
* Generated playlist has too few songs

Fallback hierarchy:

```text
personalized recommendation
-> content-based recommendation
-> cold start preferences
-> trending songs
-> popular songs
-> newest songs
```

## Evaluation Metrics

Recommended metrics for thesis/reporting:

```text
Precision@K
Recall@K
NDCG@K
coverage
diversity
duplicate rate
cold-start success rate
listen-through rate
skip rate
click-through rate
```

For thesis documentation, record:

* Dataset used
* Behavior signals used
* Train/test split if applicable
* Recommendation strategy
* Evaluation method
* Result limitations

## Testing Checklist

### Behavior Tracking

```text
- Play event is recorded.
- Completion rate is calculated.
- Skip is detected correctly.
- Like affects preference.
- Playlist add affects preference if implemented.
- Artist follow affects preference if implemented.
- Tracking failure does not stop playback.
```

### Cold Start

```text
- New user gets recommendations.
- Selected genres affect results.
- Selected artists affect results if available.
- Empty preference fallback works.
```

### Recommendation

```text
- User with history gets personalized results.
- Strategy metadata is returned.
- No hardcoded songs are returned.
- No duplicate songs.
- Cache works if Redis is enabled.
- Fallback works when model is unavailable.
- Cover/audio URLs remain valid.
```

### Automatic Playlists

```text
- Weekly Mix is generated.
- Daily Mix playlists are generated.
- Morning/Night/Mood Mix uses behavior/time logic.
- Genre Deep Dive uses recent genre behavior.
- Generated playlists are read-only.
- Clone/edit behavior works if implemented.
- Cover fallback works.
```

### Frontend

```text
- Home recommendation sections load.
- Playlist cards show stable covers.
- Song cards/rows play correctly.
- QueuePanel still works.
- Like state persists.
- No major console errors.
```

## Safety Rules

Do not:

* Move `apps/backend/uploads`.
* Change `/uploads/...` URL behavior.
* Hardcode recommendation songs.
* Replace real behavior tracking with fake data.
* Claim ML is complete if model is not implemented.
* Run heavy model training inside normal API requests.
* Break PlayerBar.
* Break QueuePanel.
* Allow system playlists to be manually edited.
* Run destructive migrations without explicit confirmation.
* Push Git unless explicitly requested.

## Do

* Use real listening history.
* Track behavior carefully.
* Keep recommendation explainable.
* Use cache for performance.
* Handle cold start.
* Avoid duplicates.
* Keep generated playlists read-only.
* Document limitations honestly.
* Add test cases for thesis evidence.
* Preserve playback and runtime media.

## Don't

* Do not use only a simple `genre_id` query and call it a full ML recommendation engine.
* Do not hardcode recommendation results.
* Do not generate playlists without checking real available songs.
* Do not ignore new users.
* Do not overfit to one artist/genre.
* Do not create empty system playlists silently.
* Do not expose backend/AI errors directly to users.
* Do not change unrelated UI while working on recommendation logic.

## Output Format

When recommendation work is complete, report:

```text
Recommendation summary:
- ...

Files changed:
- ...

Data used:
- ...

Strategy:
- cold_start/content_based/collaborative/hybrid/fallback

Generated playlists:
- ...

Cache behavior:
- ...

Data behavior:
- Real listening history used: yes/no
- Mock data added: yes/no

Safety check:
- PlayerBar affected: yes/no
- QueuePanel affected: yes/no
- /uploads runtime URL affected: yes/no
- Database changed: yes/no
- API contract changed: yes/no

Limitations:
- ...

Manual test:
- ...
```

## Reminder

This skill protects the most important part of the MusicFlow thesis. Recommendation and automatic playlist generation must be real-data driven, behavior-based, explainable, testable, and honest about current implementation limits.
