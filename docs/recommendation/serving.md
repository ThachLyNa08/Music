# MusicFlow Recommendation Serving

Bản ghi chép về cách tích hợp mô hình BPR-MF đã huấn luyện vào backend phục vụ API recommendation cho frontend.

---

## 1. Model Artifact

Đường dẫn mặc định:

```text
storage/recommendation/models/v3/bpr_mf_v3.json
```

Artifact hiện tại:

| Field | Value |
|---|---|
| `algorithm` | `BPR-MF` |
| `generated_at` | `2026-07-06T03:53:08.412Z` |
| `trained_users` | 194 |
| `trained_items` | 2700 |
| `train_positive_pairs` | 70319 |
| `factors` | 32 |
| `hyperparameters` | factors=32, epochs=50, lr=0.02, reg=0.01, neg=5, seed=42 |
| `dataset_source` | experiment seed (controlled dataset) |

Artifact chứa:

- `user_index_map` — map `user_id (string)` → `idx (int)`.
- `song_index_map` — map `song_id (string)` → `idx (int)`.
- `user_factors` — mảng 2D shape `[194][32]`.
- `item_factors` — mảng 2D shape `[7653][32]`.
- `user_biases`, `item_biases` — vector cùng số dòng tương ứng.

Có thể override path bằng env `BPR_MF_MODEL_PATH` (relative hoặc absolute).

---

## 2. Serving Strategy

Phân tầng fallback rõ ràng trong `recommendation.service.js`:

```text
1. BPR-MF + rerank     (user nằm trong model + >= 5 candidates)
2. Content-Based       (user có listening_history nhưng không trong model, hoặc BPR trả quá ít)
3. Most Popular        (fallback cuối cùng)
```

**BPR-MF serving score** (sau khi re-rank):

```text
final_score =
  0.70 * normalized_bpr_score
+ 0.15 * (content_preference + artist_boost)
+ 0.10 * normalized_popularity
+ 0.05 * normalized_novelty
- 0.05 * recent_artist_penalty
- 0.04 * recent_song_penalty
```

BPR raw score:

```text
bpr_score = dot(user_factors[u], item_factors[i]) + user_bias[u] + item_bias[i]
```

Sau khi sort theo `final_score`, áp dụng giới hạn mềm:

- Max 2 bài cùng artist trong top 10
- Max 4 bài cùng artist trong top 20

**Exclusion rules:**

- Bài user đã nghe trong 30 ngày gần đây bị loại khỏi candidate.
- Nếu candidate pool < 5 sau khi loại, fallback content-based.
- Không bao giờ trùng `song_id` (greedy rerank đảm bảo).

**Không phụ thuộc audio features** ở serving layer — chỉ dùng `market`, `genre_id`, `artist_id`, `play_count`. Nếu dữ liệu content thiếu, component `content_preference` đơn giản về 0, các thành phần khác vẫn hoạt động.

---

## 3. API Endpoint

### `GET /api/recommend/home-songs`

Auth: required (Bearer token).

Query params:

| Param | Type | Default | Mô tả |
|---|---|---|---|
| `limit` | int | 20 | Số bài trả về, max 50 |

Response shape:

```json
{
  "success": true,
  "strategy": "bpr_mf_rerank",
  "strategy_reason": "ok",
  "generatedAt": "2026-06-18T...",
  "model": {
    "algorithm": "BPR-MF",
    "generatedAt": "2026-07-06T03:53:08.412Z",
    "trainedUsers": 194,
    "trainedItems": 2700,
    "trainPositivePairs": 70319,
    "factors": 32,
    "datasetSource": "experiment_seed",
    "limitations": [...]
  },
  "model_load": {
    "ok": true,
    "error": null,
    "loaded_at": "..."
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
      "reason": "Dựa trên hành vi nghe nhạc tương tự của bạn (BPR-MF)"
    }
  ]
}
```

Các giá trị `strategy` có thể gặp:

| Value | Nghĩa |
|---|---|
| `bpr_mf_rerank` | BPR-MF chính + rerank nội bộ |
| `content_based_fallback` | User không trong model hoặc BPR trả quá ít, dùng market/genre/artist |
| `popular_fallback` | Không đủ signal, dùng top play_count |

---

## 4. Files

| File | Vai trò |
|---|---|
| `apps/backend/src/services/recommendationModel.service.js` | Loader + cache BPR-MF model |
| `apps/backend/src/services/recommendation.service.js` | Scoring + rerank + fallback |
| `apps/backend/src/controllers/recommendation.controller.js` | Thêm method `getHomeSongRecommendations` |
| `apps/backend/src/routes/recommendation.routes.js` | Route `GET /home-songs` |
| `scripts/recommendation/testRecommendationServing.js` | Smoke test e2e (không phải unit test) |

Các file hiện có được giữ nguyên:

- `recommendation.controller.js` — chỉ thêm method, không sửa `getHomeRecommendations`.
- `recommendation.routes.js` — chỉ thêm 1 route, không đổi route cũ.
- Không tạo file trùng kiểu `recommendationService2.js`.

---

## 5. Test

Chạy smoke test (cần backend `.env` + DB sẵn sàng):

```bash
# Từ project root
NODE_PATH=apps/backend/node_modules node scripts/recommendation/testRecommendationServing.js
```

Test cases tự động chạy:

1. **`exp_vpop` user** (trong model): strategy `bpr_mf_rerank`, top đúng market VPOP.
2. **`exp_kpop` user** (trong model): strategy `bpr_mf_rerank`, top đúng market KPOP.
3. **`exp_usuk` user** (trong model): strategy `bpr_mf_rerank`, top đúng market USUK.
4. **Real user** (không trong model, listening_history có dữ liệu): strategy `popular_fallback` hoặc `content_based_fallback` tuỳ signal.
5. **Model missing** (file tạm rename): strategy `content_based_fallback`, không crash.

Mỗi case in ra:

- `strategy` / `strategy_reason`
- `items returned` (count)
- `duplicate song count` (phải = 0)
- `recent-listened leak count` (phải = 0)
- `elapsed` (ms)
- `top 5` (id, artist, market, title, score)
- URL sanity cho `cover_url` + `audio_url`

---

## 6. Limitations (Honest)

1. **Experimental data only.** Mô hình train từ 200 user mô phỏng + bài hát thật trong DB. Không phản ánh hành vi thật của người dùng MusicFlow.
2. **User not in model:** index lookup trả `-1`, fallback content-based. Real users mới phải qua fallback cho đến khi BPR-MF được cập nhật bằng offline training script.
3. **Cold start:** user chưa nghe gì cũng đi vào fallback path vì `buildContentBasedRecommendations` cần ít nhất 1 preference count.
4. **No streaming recompute.** BPR-MF serve từ artifact JSON, không train real-time. Cần cập nhật artifact định kỳ bằng offline script `scripts/recommendation/evaluateRecommendationAlgorithms.js` (kèm `--write-bpr-model`) khi có batch listening_history mới.
5. **Item factors dimension:** 7653 (đủ bài cho 194 user, 2700 trained items). User mới ngoài model sẽ không có vector nên chỉ nhận fallback.
6. **No audio features in serving score.** Energy, danceability, mood chỉ phục vụ evaluation. Có thể bổ sung khi cần `context_mood_score` cho production.
7. **Không cache kết quả.** Mỗi request đều chạy lại pipeline. Có thể thêm Redis cache TTL ~5 phút cho user in-model nếu traffic tăng.

---

## 7. Cách cập nhật model artifact bằng offline script

```bash
node scripts/recommendation/evaluateRecommendationAlgorithms.js --full --write-bpr-model
```

Sau khi offline script hoàn tất, artifact mới sẽ ghi đè `bpr_mf_v3.json`. Backend sẽ tự reload artifact trong request tiếp theo (cache check theo mtime).

---

## 8. Khi nào cần Restart Backend?

Không cần. Service `recommendationModel.service.js` cache theo `mtimeMs` của file. Sau khi file model được thay, request tiếp theo tự load version mới (không cần restart Node process).
