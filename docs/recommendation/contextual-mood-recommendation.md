> [!WARNING]
> **LEGACY V2:** Tài liệu này thuộc hướng contextual mood V2 cũ. Trong phiên bản hiện tại (V3), thành phần này đóng vai trò phụ trợ thay vì cốt lõi. Hãy tham khảo `01_CURRENT_RECOMMENDATION_SYSTEM.md` để biết kiến trúc V3 mới nhất.

# Contextual Mood Recommendation (Gợi ý theo buổi trong ngày)

> **Mục tiêu**: thêm một section nhẹ trên Home với các bài hát được cá nhân
> hóa + điều chỉnh theo **mood của buổi trong ngày** (morning / afternoon /
> evening / night). Lớp này hoạt động trên top của BPR-MF, **không train
> model mới**, không touch Daily Mix / Weekly Mix / scheduler / uploads.

## 1. Vai trò trong kiến trúc MusicFlow

```
┌─────────────────────────────────────────────────┐
│                 MusicFlow Home                   │
└─────────────────────────────────────────────────┘
                       │
   ┌───────────────────┼────────────────────────┐
   │                   │                        │
[Daily Mix]      [Weekly Mix]         [Contextual Mood]
   │                   │                        │
   │  Anchor+Discovery │  Long-term user prefs  │  Realtime BPR-MF
   │  per target day   │                        │  + mood rerank
   │                   │                        │  theo time slot
   ▼                   ▼                        ▼
playlist_songs      playlist_songs        (no DB write,
  (DB write)          (DB write)            chỉ response API)
```

**BPR-MF tạo nền cá nhân hóa**, contextual mood rerank điều chỉnh theo
thời điểm trong ngày. Hai lớp này bổ sung cho nhau:

- BPR-MF (chạy nền) → cung cấp top candidate cá nhân hóa.
- Contextual Mood (realtime API) → đọc candidates + rerank theo mood.

## 2. Mapping time slot (giờ ICT, Asia/Ho_Chi_Minh)

Server backend chạy ở ICT nên dùng trực tiếp `new Date().getHours()`.
Frontend không cần tính — backend tự suy ra từ `Date`.

| Slot        | Giờ       | Title UI                    | Subtitle UI                                       |
| ----------- | --------- | --------------------------- | ------------------------------------------------- |
| `morning`   | 05–10:59  | Khởi động ngày mới          | Gợi ý dựa trên gu nghe và mood buổi sáng         |
| `afternoon` | 11–16:59  | Nhạc cho buổi chiều         | Năng lượng vừa đủ cho buổi chiều                  |
| `evening`   | 17–21:59  | Thư giãn buổi tối           | Nhẹ nhàng hơn cho khoảng thời gian cuối ngày      |
| `night`     | 22–04:59  | Đêm nay nghe gì             | Những bài hát phù hợp để nghe về đêm              |

Frontend có thể gọi `?timeSlot=morning|afternoon|evening|night|auto`
để test thủ công từng slot.

## 3. Mood / vibe theo buổi

Mỗi slot có một tập `vibes` ưu tiên (điểm 1.0 nếu trùng) và khoảng
`energy_score` mong muốn:

| Slot        | Vibes ưu tiên                                | Energy min | Energy max | Energy sweet |
| ----------- | -------------------------------------------- | ---------- | ---------- | ------------ |
| morning     | chill, happy, acoustic, focus, light         | 0.25       | 0.70       | 0.50         |
| afternoon   | energetic, happy, pop, dance, focus          | 0.45       | 0.90       | 0.65         |
| evening     | chill, romantic, happy, rnb, acoustic        | 0.20       | 0.65       | 0.45         |
| night       | chill, sad, romantic, acoustic, calm         | 0.10       | 0.55       | 0.30         |

`mood_match_score`:

- `1.0` nếu `mood` hoặc `vibe` của bài nằm trong danh sách slot.
- `0.75` nếu chỉ trùng một phần (substring match).
- `0.3` nếu thiếu `audio_features` (fallback trung bình).
- `0.2` nếu có `audio_features` nhưng không khớp slot (vẫn dùng được).

`energy_match_score = max(0, 1 - |energy_score - sweet| / tolerance)`.
- Ngoài tolerance → `0.1`.
- Thiếu `energy_score` → `0.3`.

## 4. Scoring / rerank

`final_score` cho mỗi candidate:

```
final_score =
    0.55 * recommendation_score (đã chuẩn hoá theo max-min trong pool)
  + 0.25 * mood_match_score
  + 0.10 * energy_match_score
  + 0.05 * popularity_score (chuẩn hoá theo play_count)
  + 0.05 * novelty_score (1 - id/maxId, bài mới hơn được ưu tiên nhẹ)
```

Sau khi tính `final_score`, danh sách được **sort giảm dần** rồi áp
**artist cap**:

- Top 10: tối đa 2 bài/artist.
- Top 20: tối đa 4 bài/artist.
- Nếu chưa đủ `limit`, nới cap lên **8 bài/artist** (pass 2) để đảm bảo
  luôn đủ số lượng trong trường hợp user có lịch sử nghe quá tập trung
  vào 1-2 artist.

**Deduplication**: `song_id` được set trùng sẽ bị bỏ qua.

## 5. Pipeline lấy candidate

1. **`recommendationService.getRecommendationsForUser(uid, { limit: 120 })`**:
   - BPR-MF nếu user có trong artifact (194 user trained).
   - Content-Based fallback nếu BPR-MF không có user.
   - Popular fallback nếu cả hai trên không đủ.
2. **Merge popular với audio_features** (top 120 theo `play_count`) để tăng
   diversity. Warm user có thể chỉ nghe 3-5 artist, pool BPR-MF dễ dominant
   bởi 1-2 artist → cần bổ sung popular để rerank đạt đủ `limit`.
3. **Join `song_audio_features`** để lấy `mood, vibe, energy_score,
   danceability, acoustic_score, brightness, bpm, tempo_level` cho từng
   candidate.
4. **Rerank** theo công thức ở mục 4.
5. **Bài thiếu audio_features**: xếp sau cùng với `final_score =
   0.6 * recommendation_score` (chỉ dùng để lấp đầy nếu pool có audio
   không đủ `limit`).

## 6. Fallback chain

| Tình huống                              | Hành vi                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| User có BPR-MF embedding                | BPR-MF candidates + popular_with_audio                          |
| User không có BPR-MF, có lịch sử        | Content-Based candidates + popular_with_audio                   |
| User không có lịch sử (cold-start)      | Popular candidates + popular_with_audio                         |
| Bài không có `song_audio_features`      | Xếp sau bằng `0.6 * recommendation_score`                       |
| Bài không có `mood`/`vibe`              | `mood_match_score = 0.3` (trung bình)                           |
| Bài không có `energy_score`             | `energy_match_score = 0.3` (trung bình)                         |
| Bảng `song_audio_features` không tồn tại| `console.warn`, fallback popular thuần, không crash              |

## 7. Endpoint

### `GET /api/recommend/contextual-mood`

**Auth**: required (Bearer token qua middleware `authenticate`).

**Query params**:

| Param      | Type   | Default | Mô tả                                              |
| ---------- | ------ | ------- | -------------------------------------------------- |
| `limit`    | int    | `20`    | Số item trả về. Tối đa 40.                        |
| `timeSlot` | string | `auto`  | `auto` \| `morning` \| `afternoon` \| `evening` \| `night` |
| `now`      | ISO    | (now)   | Override thời điểm hiện tại (dùng để test).       |

**Response shape**:

```json
{
  "success": true,
  "strategy": "contextual_mood",
  "strategy_reason": "content_based_fallback+popular_fallback",
  "timeSlot": "morning",
  "timeSlotLabel": "Khoi dong ngay moi",
  "timeSlotSubtitle": "Gợi ý dựa trên gu nghe và mood buổi sáng",
  "moodProfile": {
    "vibes": ["chill", "happy", "acoustic", "focus", "light"],
    "energyMin": 0.25,
    "energyMax": 0.7,
    "energySweet": 0.5
  },
  "generatedAt": "2026-06-19T08:00:00.000Z",
  "candidateCount": 120,
  "withAudioFeaturesCount": 119,
  "withoutAudioFeaturesCount": 1,
  "items": [
    {
      "id": 7662,
      "title": "The Happiest Girl",
      "artist_id": 85,
      "artist_name": "BLACKPINK",
      "album_id": 152,
      "album_title": "...",
      "genre_id": 10,
      "genre_name": "K-Pop",
      "market": "KPOP",
      "duration": 192,
      "cover_url": "/uploads/audio/...jpg",
      "audio_url": "/uploads/audio/...mp3",
      "play_count": 12345,
      "recommendation_score": 0.816,
      "mood_reason": "Phù hợp buổi sáng: chill, focus, coffee",
      "_debug": { "moodScore": 1, "energyScore": 0.8 }
    }
  ]
}
```

## 8. Frontend (Home)

Trong `apps/frontend/src/views/home/HomeView.vue`, thêm 1 section sau
**"Đề xuất từ gu nghe của bạn"** và trước **"Nghe gần đây"**:

- Title và subtitle động theo `timeSlot` trả về từ backend (4 slot khác
  nhau).
- Dùng `RecentSongCard` giống các section khác (carousel ngang).
- Section tự ẩn nếu `items` rỗng (`v-if="contextualMoodSongs.length > 0"`).
- Click play → `playContextualMoodSong` set queue là `contextualMoodSongs`
  và gọi `player.setSong(target, queue)`, `playbackSource = 'contextual_mood'`.
- Like state sync qua `library.applyLikedStateToSongs` giống các section khác.

## 9. Files thay đổi

| File                                                                                       | Trạng thái | Mô tả                                                                  |
| ------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| `apps/backend/src/services/contextualMood.service.js`                                      | **Mới**    | Service mới, không touch file khác.                                    |
| `apps/backend/src/controllers/recommendation.controller.js`                                | Thêm       | Thêm `require` + hàm `getContextualMoodRecommendations`.               |
| `apps/backend/src/routes/recommendation.routes.js`                                         | Thêm       | Thêm route `GET /contextual-mood`.                                     |
| `apps/frontend/src/api/recommend.js`                                                       | Thêm       | Thêm `recommendApi.getContextualMoodRecommendations`.                  |
| `apps/frontend/src/views/home/HomeView.vue`                                                | Thêm       | Section mới + state + computed + `playContextualMoodSong`.             |
| `docs/recommendation/contextual-mood-recommendation.md`                                    | **Mới**    | File này.                                                               |

## 10. Hạn chế

- **Time slot rule-based, không học từ feedback**: mapping giờ→slot là cố
  định. Chưa tự điều chỉnh theo hành vi nghe thực tế của user theo giờ.
- **Mood phụ thuộc chất lượng `song_audio_features`**: bài thiếu features
  được đẩy xuống cuối. Có thể bổ sung bằng cách chạy batch analyze cho các
  bài còn thiếu (xem `apps/backend/src/services/audioFeature.service.js`).
- **Không tinh chỉnh realtime**: khi user skip 1 bài trong slot, hệ thống
  chưa cập nhật mood profile. Có thể mở rộng bằng cách log feedback về
  bảng `listening_history` và rerank theo slot history của user.
- **Cùng 1 playlist cho cả user**: section chỉ trả về realtime, không ghi
  DB. Nếu muốn cá nhân hóa sâu hơn, có thể kết hợp với hệ thống Daily
  Mix trong tương lai.
- **Time slot wrap-around**: 22:00-04:59 được tính là `night` (server ICT).
  Nếu server chuyển timezone, cần inject `now` qua query để test.

## 11. Test guide

### Backend

```bash
# Warm user (có lịch sử nghe)
curl 'http://localhost:3000/api/recommend/contextual-mood?timeSlot=morning&limit=20' \
  -H "Authorization: Bearer <token>"

# Cold-start user (chưa nghe bài nào) - vẫn trả 200 + items
curl 'http://localhost:3000/api/recommend/contextual-mood?timeSlot=afternoon&limit=20' \
  -H "Authorization: Bearer <token>"

# Test với now override
curl 'http://localhost:3000/api/recommend/contextual-mood?timeSlot=auto&now=2026-06-19T03:00:00%2B07:00&limit=20' \
  -H "Authorization: Bearer <token>"
# Mong đợi: timeSlot=night (3 giờ sáng ICT)
```

Kỳ vọng:

| Endpoint                                      | Status | timeSlot | items | duplicate |
| --------------------------------------------- | ------ | -------- | ----- | --------- |
| `?timeSlot=morning&limit=20`                  | 200    | morning  | 20    | 0         |
| `?timeSlot=afternoon&limit=20`                | 200    | afternoon| 20    | 0         |
| `?timeSlot=evening&limit=20`                  | 200    | evening  | 20    | 0         |
| `?timeSlot=night&limit=20`                    | 200    | night    | 20    | 0         |
| `?timeSlot=auto&limit=20` (user cold-start)   | 200    | (auto)   | 20    | 0         |

### Frontend

- Home hiện section với title/subtitle đổi theo giờ hiện tại.
- Bấm play → `playbackSource = 'contextual_mood'`, queue là 20 bài của
  section này. Next/Prev hoạt động đúng trong queue.
- Like state sync (tim đỏ khi đã like, viền khi chưa).
- Reload page vẫn giữ like state nhờ `library.applyLikedStateToSongs`.
- Console không có lỗi đỏ (chỉ `console.warn` khi API lỗi).

## 12. Cross-reference

- `apps/backend/src/services/recommendation.service.js` — BPR-MF serving.
- `apps/backend/src/services/recommendationModel.service.js` — model load.
- `apps/backend/src/services/dailyMix.service.js` — Daily Mix (riêng biệt).
- `apps/backend/src/services/weeklyMix.service.js` — Weekly Mix (riêng biệt).
- `docs/recommendation/serving.md` — BPR-MF serving layer.
- `docs/recommendation/bpr-selection-report.md` — báo cáo lựa chọn thuật toán.
- `docs/recommendation/scheduler.md` — recommendation scheduler.
