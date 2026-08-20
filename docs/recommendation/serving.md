# MusicFlow Recommendation Serving

Tài liệu này mô tả cách backend MusicFlow phục vụ recommendation hiện tại. Mô hình lõi đang dùng là **LightGCN Hybrid V4**. BPR-MF Hybrid chỉ còn là mô hình so sánh trong đánh giá V4, không phải model serving chính.

## 1. Model artifacts

`apps/backend/src/services/recommendationModel.service.js` đọc artifact V4 tại:

```text
storage/recommendation/evaluation/v4/
```

Các artifact được loader khai báo:

| Key | File | Vai trò |
|---|---|---|
| `serving` | `lightgcn_hybrid_serving_recs_v4.json` | Serving artifact ưu tiên cho user ID thật trong MySQL. |
| `lightgcn` | `lightgcn_hybrid_recs_v4.json` | LightGCN Hybrid V4 recommendations dùng khi serving artifact không có entry hợp lệ. |
| `bpr` | `bpr_hybrid_recs_v4.json` | Artifact so sánh/evaluation V4, không phải đường serving chính. |
| `cb` | `content_based_recs_v4.json` | Artifact Content-Based V4 cho đánh giá/tái tạo pipeline. |
| `popular` | `most_popular_recs_v4.json` | Artifact Most Popular V4 cho đánh giá/tái tạo pipeline. |

Loader cache JSON trong memory. `tryLoadArtifact(key)` trả `{ ok: false }` khi thiếu hoặc lỗi JSON để service có thể đi tiếp bằng fallback. Metadata public trả `algorithm: LightGCN Hybrid V4`, `dataset_source: v4_serving`, `fallback_policy` nếu artifact có metadata.

Không còn dùng `storage/recommendation/models/v3/bpr_mf_v3.json` làm artifact serving chính, và không còn env override `BPR_MF_MODEL_PATH` trong loader hiện tại.

## 2. Serving strategy

Luồng chính nằm trong `apps/backend/src/services/recommendation.service.js`:

```text
User request
  -> kiểm tra feedback status
  -> nếu có implicit feedback:
       1. đọc serving artifact LightGCN V4
       2. nếu không đủ bài hợp lệ, đọc LightGCN V4 artifact
       3. nếu vẫn không đủ, build Content-Based runtime
  -> nếu cold-start hoặc các bước trên không đủ:
       4. chạy cold-start multi-tier
       5. fallback cuối cùng là Most Popular / bài public active
  -> xác thực song_id trong MySQL
  -> Tempo-aware layer khi áp dụng
  -> response API
```

Fallback thực tế:

```text
LightGCN Hybrid V4
  -> Content-Based V4 / cold-start
  -> Most Popular V4
```

Chi tiết theo code:

- User có implicit feedback là user có `listenCount >= 5`, hoặc có like, hoặc có bài trong manual playlist.
- Backend ưu tiên `lightgcn_hybrid_serving_recs_v4.json` qua `tryLoadArtifact('serving')`.
- Nếu serving artifact thiếu user, thiếu recommendation, hoặc sau khi validate còn ít hơn `min(5, limit)` bài hợp lệ, backend thử `lightgcn_hybrid_recs_v4.json`.
- Nếu LightGCN artifact vẫn không đủ, backend build Content-Based runtime từ `listening_history`, `market`, `genre_id`, `artist_id`, popularity và semantic profile nếu có.
- Với user cold-start hoặc không đủ candidate, backend chạy cold-start multi-tier: onboarding artists, onboarding genres, system playlists theo thời điểm, trending/popular songs, diverse discovery và default active songs.

## 3. Ranking và personalization runtime

Hybrid ranking của artifact V4 đã được tạo trong pipeline offline. Runtime serving không huấn luyện lại model; backend đọc recommendation đã chuẩn bị, xác thực `song_id` trong MySQL, rồi áp dụng các lớp runtime khi cần.

Phân tách theo code hiện tại:

- LightGCN V4 artifact: dùng điểm đã có trong `lightgcn_hybrid_serving_recs_v4.json` hoặc `lightgcn_hybrid_recs_v4.json`.
- Runtime LightGCN: sau khi xác thực bài hát hợp lệ trong MySQL, có thể áp dụng Tempo-aware layer.
- Content-Based fallback: build scoring/ranking runtime riêng từ `listening_history` join với metadata bài hát.
- Cold-start/onboarding: dùng `user_genre_preferences` và `user_artist_preferences`, system playlists theo thời điểm, trending/popular và default active songs.

Nguồn dữ liệu personalization trong runtime:

- `listening_history` là nguồn chính để build market/genre/artist preference cho Content-Based runtime qua `buildUserPreferenceMap(...)` và `buildUserTasteProfile(...)`.
- `song_likes` tham gia semantic preference trong `songSemanticProfile.service.buildUserSemanticPreference(...)`, không phải nguồn trực tiếp cho market/genre/artist scoring của Content-Based runtime.
- Manual playlist songs được dùng trong `getUserFeedbackStatus(...)` để xác định user có implicit feedback hay không; không phải nguồn trực tiếp cho Content-Based scoring.
- `user_genre_preferences` và `user_artist_preferences` phục vụ onboarding/cold-start.

Trong Content-Based runtime, service lấy các bài user đã nghe để loại khỏi candidate. Sau đó ranking kết hợp các tín hiệu như market, genre, artist preference, semantic score, dominant-market guard và artist diversity:

- tối đa 2 bài cùng artist trong top 10
- tối đa 4 bài cùng artist trong top 20
- ưu tiên dominant market khi user có gu thị trường đủ mạnh

Một số hàm hoặc trường nội bộ còn tên legacy như `bprScore`/`bprRaw`; đây là di sản đặt tên trong source, không phải bằng chứng rằng BPR-MF V3 là đường serving chính.

## 4. Tempo-aware layer

`applyTempoAwareLayer` chỉ re-rank khi strategy là `lightgcn_hybrid_v4`. Layer này:

- build user tempo profile qua `userTempoProfile.service`
- yêu cầu confidence `>= 0.2` và có preferred tempo bucket
- đọc audio features của các bài candidate
- kết hợp LightGCN score với tempo affinity, energy, danceability và diversity
- trả thêm `tempoAware`, `tempoProfile`, `audioFeatureCoverage` và các trường BPM/tempo reason khi có feature

Nếu không phải LightGCN V4, không đủ tempo profile, hoặc không có audio features, service giữ thứ tự hiện có và đánh dấu `tempoAware: false`.

## 5. MySQL validation

Backend không trả trực tiếp `song_id` từ artifact nếu bài không còn hợp lệ trong database. Hàm `fetchValidSongs(songIds)` query MySQL và chỉ giữ bài:

- thỏa `publicSongCondition('s')`
- có `audio_url IS NOT NULL`
- `audio_url <> ''`
- `s.id IN (...)`

Kết quả query join thêm artists, albums và genres để response có metadata đầy đủ. Nếu số bài hợp lệ còn ít hơn `min(5, limit)`, service coi artifact đó không đủ và chuyển sang fallback tiếp theo.

## 6. API endpoint

### `GET /api/recommend/home-songs`

Auth: required.

Query params:

| Param | Type | Default | Ghi chú |
|---|---|---|---|
| `limit` | int | 20 | `recommendation.service` clamp trong khoảng `1..200`. |

Response có các trường chính:

```json
{
  "success": true,
  "strategy": "model_personalized",
  "strategyLabel": "Gợi ý cá nhân hóa",
  "servingVersion": "v4",
  "coreModel": "LightGCN Hybrid V4",
  "fallbackUsed": false,
  "fallbackReason": null,
  "legacyV3Used": false,
  "tempoAware": true,
  "serving": {
    "strategy": "lightgcn_hybrid_v4",
    "strategyLabel": "LightGCN Hybrid V4",
    "servingVersion": "v4",
    "coreModel": "LightGCN Hybrid V4",
    "fallbackUsed": false,
    "legacyV3Used": false,
    "tempoAware": true
  },
  "fallbackChain": [],
  "model": {
    "algorithm": "LightGCN Hybrid V4",
    "datasetSource": "v4_serving"
  },
  "items": [
    {
      "id": 3693,
      "title": "Hoa Cỏ Mùa Xuân",
      "artist_id": 14,
      "artist_name": "Bảo Anh",
      "album_id": 200,
      "album_title": "...",
      "genre_id": 4,
      "genre_name": "Pop",
      "market": "VPOP",
      "duration": 240,
      "cover_url": "http://host:port/uploads/...",
      "audio_url": "http://host:port/uploads/...",
      "play_count": 12345,
      "recommendation_score": 0.8132,
      "bpm": 120,
      "tempoBucket": "medium",
      "reason": "Dựa trên hành vi nghe nhạc tương tự của bạn"
    }
  ]
}
```

Các strategy nội bộ thường gặp:

| Strategy | Ý nghĩa |
|---|---|
| `lightgcn_hybrid_v4` | LightGCN Hybrid V4 đủ candidate hợp lệ. |
| `content_based_v4` | Fallback Content-Based runtime cho user có tín hiệu nghe/sở thích. |
| `content_based_v4_runtime` | Biến thể runtime được chuẩn hóa về Content-Based V4 trong metadata. |
| `cold_start_preferences` | Cold-start dựa trên onboarding artists/genres và các tier fallback. |
| `most_popular_v4` | Fallback popular/trending khi không đủ tín hiệu cá nhân hóa. |

Controller có thể gom strategy public thành `model_personalized`, `content_based_onboarding` hoặc `most_popular_fallback`, nhưng trường `serving.strategy` vẫn giữ strategy nội bộ V4.

## 7. Tái tạo V4

Các script V4 hiện còn trong repository nằm tại:

```text
scripts/recommendation/v4/
```

Các entry point liên quan:

- `run_v4_pipeline.py`
- `run_v4_all_users_pipeline.bat`
- `train_lightgcn_v4.py`
- `train_bpr_mf_v4.py`
- `generate_content_based_v4.py`
- `generate_most_popular_v4.py`
- `hybrid_rerank_v4.py`
- `evaluate_v4_models.py`
- `evaluate_tempo_aware.py`
- `generate_serving_recs_v4.js`
- `generate_serving_recs_v4_all.js`
- `generate_v4_report.py`
- `import_v4_to_db.py`

Chỉ dùng script thực sự còn trong `scripts/recommendation/v4/` khi cần tái tạo artifact. Tài liệu này không dùng các script V3 đã bị loại khỏi repository.

## 8. Ghi chú vận hành

- Backend không train online trong request; recommendation serve từ artifact JSON V4 và fallback runtime.
- Nếu thiếu `serving` hoặc `lightgcn` artifact, code không mặc định crash ở `home-songs`; `tryLoadArtifact` trả lỗi và service tiếp tục thử Content-Based/cold-start/Most Popular.
- `modelService.load()` vẫn yêu cầu đủ 5 artifact nếu gọi trực tiếp. Đường recommendation chính dùng `tryLoadArtifact` để fallback mềm theo từng artifact.
- `legacyV3Used` luôn là `false` trong metadata serving hiện tại.
