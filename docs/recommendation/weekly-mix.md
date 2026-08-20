# Weekly Mix (Auto-generated Playlist)

Weekly Mix là playlist hệ thống `weekly_mix` được tạo/cập nhật tự động cho từng user dựa trên `recommendation.service` hiện tại: LightGCN Hybrid V4, Content-Based fallback, cold-start/onboarding và Most Popular fallback.

## 1. Service

File chính:

```text
apps/backend/src/services/weeklyMix.service.js
```

Các hằng số hiện tại:

| Hằng số | Giá trị |
|---|---:|
| `SYSTEM_KEY` | `weekly_mix` |
| `DEFAULT_LIMIT` | 35 |
| `MAX_LIMIT` | 50 |

`clampLimit(value)` trả `DEFAULT_LIMIT = 35` nếu limit không hợp lệ, và clamp tối đa về `MAX_LIMIT = 50`.

Luồng tạo playlist cho một user:

1. Xác định weekly listening window: 7 ngày đóng trước Chủ nhật 00:00.
2. Gọi `recommendationService.getRecommendationsForUser(uid, { limit: limit * 5, listeningWindow, context: 'weekly_mix' })`.
3. Trừ điểm mạnh các bài đã xuất hiện gần đây trong cùng system playlist.
4. Chọn bài theo quota đa dạng artist/genre và kiểm soát overlap với playlist cũ.
5. Chỉ ghi DB nếu vượt các quality gate, hoặc khi `forceApply === true`.
6. Trước khi ghi, lọc lại song public/playable qua MySQL bằng `publicSongCondition('songs')` và `audio_url` hợp lệ.

Quality gate chính:

- `songIds.length >= limit`
- `candidateObjs.length >= 70`
- `overlapRatio < 0.9`
- `addedSongs >= 10`
- `finalMaxSameArtistRatio <= 0.3`
- `finalMaxSameGenreRatio <= 0.65`

## 2. Playlist persistence

Weekly Mix dùng bảng `playlists` và `playlist_songs`.

| Cột | Giá trị |
|---|---|
| `name` | `Weekly Mix của bạn` |
| `type` | `system` |
| `is_system` | `1` |
| `system_key` | `weekly_mix` |
| `is_public` | `0` |
| `cover_url` | `resolvePlaylistCoverUrl('weekly_mix')` |

Idempotency:

- Mỗi `(user_id, system_key='weekly_mix')` chỉ có một playlist hệ thống.
- Nếu playlist đã tồn tại, service giữ `id`, cập nhật metadata và refresh `playlist_songs`.
- Khi ghi thành công, service cập nhật `last_refreshed_at = NOW()` và `next_refresh_at = DATE_ADD(NOW(), INTERVAL 7 DAY)`.

## 3. Cách chạy thủ công

Dry-run cho một user:

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218 --dry-run
```

Generate cho một user:

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218
```

Generate cho toàn bộ user active:

```bash
node scripts/recommendation/generateWeeklyMix.js --all
```

Override limit, tối đa 50:

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218 --limit=50
```

## 4. Recommendation strategy

Weekly Mix không tự triển khai model recommendation riêng. Service lấy candidate từ `recommendation.service`, nơi đang xử lý:

- LightGCN V4 serving artifact
- LightGCN V4 artifact
- Content-Based runtime fallback
- cold-start/onboarding fallback
- Most Popular fallback
- MySQL validation cho bài public/playable
- Tempo-aware layer khi strategy là `lightgcn_hybrid_v4`

Các strategy nội bộ thường gặp:

| Strategy | Ý nghĩa |
|---|---|
| `lightgcn_hybrid_v4` | LightGCN V4 đủ candidate hợp lệ. |
| `content_based_v4` | Content-Based runtime fallback cho user có lịch sử/sở thích. |
| `cold_start_preferences` | Cold-start dựa trên onboarding và các tier fallback. |
| `most_popular_v4` | Fallback popular/trending khi không đủ tín hiệu cá nhân hóa. |

## 5. Scheduler

Scheduler nằm trong:

```text
apps/backend/src/services/scheduler.service.js
```

Recommendation scheduler mặc định tắt:

```text
ENABLE_RECOMMENDATION_SCHEDULER !== 'true' -> disabled
```

Khi bật `ENABLE_RECOMMENDATION_SCHEDULER=true`, code mặc định dùng shared runner nếu không set `RECOMMENDATION_SCHEDULER_SHARED_RUNNER=false`.

Shared runner:

- Production schedule: `0 0 * * *`
- Timezone: `Asia/Ho_Chi_Minh`
- Gọi `runSystemPlaylistSchedulerOnce({ allDue: true, force: false, mode: 'scheduler' })`
- Dùng lock `system_playlist_scheduler` để tránh chạy chồng.
- Weekly Mix được xử lý khi đến hạn theo schedule rule hệ thống; lịch hiện tại là Chủ nhật 00:00 Asia/Ho_Chi_Minh.

Test mode:

```text
ENABLE_RECOMMENDATION_SCHEDULER=true
RECOMMENDATION_SCHEDULER_TEST_MODE=true
```

Khi test mode bật, shared runner chạy `*/2 * * * *`, truyền `force: true` và `mode: 'scheduler_test'`.

Legacy jobs chỉ chạy khi:

```text
ENABLE_RECOMMENDATION_SCHEDULER=true
RECOMMENDATION_SCHEDULER_LEGACY_JOBS=true
RECOMMENDATION_SCHEDULER_SHARED_RUNNER=false
```

Trong legacy mode, Weekly Mix cũng có cron Chủ nhật 00:00 `Asia/Ho_Chi_Minh`.

## 6. Home/UI behavior

`GET /api/recommend/home` đọc các playlist hệ thống đã tồn tại trong DB. Weekly Mix `weekly_mix` nằm trong `MADE_FOR_YOU_ORDER`, nên nếu playlist tồn tại và thỏa filter hệ thống, Home có thể hiển thị trong nhóm made-for-you.

Home không đồng bộ generate Weekly Mix trong request. Nếu playlist chưa tồn tại hoặc chưa có bài, response vẫn render các phần còn lại mà không crash.

Playlist hệ thống được bảo vệ bởi backend/frontend guard hiện có:

- không cho edit metadata như playlist manual
- không cho thêm/xóa/reorder bài trực tiếp như playlist manual
- vẫn cho phát nhạc, like bài và lưu/bỏ lưu playlist theo quyền UI hiện tại

## 7. Kiểm tra SQL

Sau khi generate:

```sql
SELECT id, name, description, type, is_system, system_key,
       last_refreshed_at, next_refresh_at, updated_at
FROM playlists
WHERE user_id = 218 AND system_key = 'weekly_mix';
```

Kiểm tra duplicate bài:

```sql
SELECT song_id, COUNT(*) AS c
FROM playlist_songs
WHERE playlist_id = <playlist_id>
GROUP BY song_id
HAVING c > 1;
```

Kỳ vọng: 0 dòng.

## 8. Ghi chú

- Weekly Mix chỉ là lớp persist playlist phía trên recommendation service; không thay đổi logic model/evaluation.
- Nếu candidate không đủ chất lượng theo gate, service có thể trả `status='skipped'` và không ghi playlist mới.
- Comment đầu file `weeklyMix.service.js` còn nhắc BPR-MF/content-based/popular fallback theo tên cũ; runtime thực tế đi qua `recommendation.service` V4 như mô tả ở trên.
