# Weekly Mix (Auto-generated Playlist)

Weekly Mix là playlist hệ thống được tạo/cập nhật tự động cho từng user dựa trên
`recommendation.service` (BPR-MF artifact). Đây là phần trình bày hệ thống gợi ý
và tự động tạo danh sách phát dựa trên hành vi người dùng trong luận văn.

## 1. Vì sao Weekly Mix tồn tại

- Mục tiêu luận văn: hệ thống gợi ý **và** tự động tạo danh sách phát cá nhân hóa.
- Frontend Home đã có section **"Đề xuất từ gu nghe của bạn"** (gọi
  `GET /api/recommend/home-songs?limit=20`) hiển thị top 20 bài.
- Weekly Mix biến kết quả recommendation thành một **playlist persistable**, có thể
  mở từ trang playlist, nghe tuần tự, lưu vào thư viện, và tự động refresh.

## 2. Cách Weekly Mix được tạo

### 2.1 Service

File: `apps/backend/src/services/weeklyMix.service.js`

- Gọi `recommendationService.getRecommendationsForUser(userId, { limit })`
  (mặc định 25, trần 30).
- `recommendation.service` đã lo:
  - chọn strategy (`bpr_mf_rerank` / `content_based_fallback` / `popular_fallback`),
  - loại trừ bài user đã nghe gần đây + toàn bộ lịch sử,
  - cap số bài/artist,
  - chỉ trả về bài `is_active=TRUE` + `release_status='published'` (hoặc đến hẹn).
- Service **không tự dedup lại**; nó dedup theo `song_id` rồi lọc lại qua
  `publicSongCondition('songs')` (audio_url not null) trước khi ghi vào DB, để
  không bao giờ chèn bài private / thiếu audio.

### 2.2 Schema sử dụng

Bảng: `playlists`, `playlist_songs`.

| Cột                | Giá trị Weekly Mix                                |
| ------------------ | ------------------------------------------------- |
| `user_id`          | user cần generate                                 |
| `name`             | `Weekly Mix của bạn`                              |
| `description`      | Cố định (xem service)                             |
| `type`             | `system`                                          |
| `is_system`        | `1`                                               |
| `system_key`       | `weekly_mix` (UNIQUE theo `(user_id, system_key)`) |
| `is_public`        | `0` (chỉ chủ nhân xem)                            |
| `cover_url`        | resolve qua `utils/playlistCover` theo system_key |
| `playlist_songs`   | `position` 0..N-1 theo score giảm dần từ service  |

### 2.3 Idempotency

- Mỗi `(user_id, system_key='weekly_mix')` chỉ có **đúng 1** playlist.
- Lần đầu: `INSERT` playlist + `INSERT` songs.
- Lần sau: cập nhật `name/description/cover_url/updated_at` của playlist hiện có,
  xóa toàn bộ `playlist_songs` của playlist đó rồi chèn lại.
- Không đụng vào playlist khác của user (manual, ai, các system_key khác như
  `weeklymix`, `dailymix_*`, `morning_vibes`, ...).

### 2.4 Read-only / an toàn

`apps/backend/src/controllers/playlist.controller.js` đã có sẵn các guard chặn
sửa playlist hệ thống:

- `addSongToPlaylist` → reject nếu `is_system=1` hoặc có `system_key`.
- `removeSongFromPlaylist` → reject tương tự.
- `reorderPlaylistSongs` → chỉ cho phép `manual` editable.
- `updatePlaylist` → reject system playlist.
- `deletePlaylist` → reject system playlist.

Weekly Mix kế thừa đầy đủ các guard này (cùng `is_system=1` + `type='system'` +
có `system_key`), nên người dùng cuối không thể sửa trực tiếp.

## 3. Cách chạy

### 3.1 Dry-run cho một user

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218 --dry-run
```

Kỳ vọng: in `strategy`, `candidateCount`, `dedupedCount`, `topSongIds`. Không ghi DB.

### 3.2 Generate cho một user

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218
```

Kỳ vọng: in `playlistId`, `created` (true/false), `insertedSongs`. Cùng user chạy
lại → `created=false`, `playlistId` giữ nguyên.

### 3.3 Generate cho toàn bộ user

```bash
node scripts/recommendation/generateWeeklyMix.js --all
```

Kỳ vọng: in summary gồm `usersProcessed`, `playlistsCreated`, `playlistsUpdated`,
`songsInserted`, `skipped`, `errors`.

### 3.4 Override limit

```bash
node scripts/recommendation/generateWeeklyMix.js --user-id=218 --limit=30
```

Limit được clamp về `[1, 30]`; mặc định 25.

## 4. Strategy và Fallback

`recommendation.service` tự quyết định strategy dựa trên:

1. Model BPR-MF có load được không? (`recommendationModel.service.tryLoad()`)
2. User có trong model không?
3. Sau khi BPR-MF chạy, có đủ `>= min(5, limit)` candidates không?

Mapping:

| Điều kiện                                            | `strategy`              | Subtitle UI khuyến nghị                              |
| ---------------------------------------------------- | ----------------------- | --------------------------------------------------- |
| Model loaded + user in model + đủ candidates        | `bpr_mf_rerank`         | "Dựa trên thói quen nghe của bạn"                  |
| Model loaded + user in model + thiếu candidates      | `content_based_fallback`| "Dựa trên gu âm nhạc của bạn"                      |
| Model loaded + user NOT in model + có preferences    | `content_based_fallback`| "Dựa trên gu âm nhạc của bạn"                      |
| Model loaded + không đủ content candidates           | `popular_fallback`      | "Đang thịnh hành trên MusicFlow"                    |
| Model không load được                                | `content_based_fallback` hoặc `popular_fallback` | như trên                              |

## 5. UI Integration

Weekly Mix hiện trong Home page của MusicFlow, cụ thể là section **"Dành cho bạn"**
(danh sách playlist cards nằm ngang).

### 5.1 Vị trí hiển thị

- Section: **"Dành cho bạn"** (madeForYouPlaylists trong API).
- Sort order (trong `MADE_FOR_YOU_ORDER`): Weekly Mix đứng **đầu**, trước các
  Daily Mix. Order cũ:
  ```
  weekly_mix, dailymix_01, dailymix_02, ..., dailymix_06, weeklymix
  ```
- Cả backend (`apps/backend/src/services/systemPlaylist.service.js`) và
  frontend (`apps/frontend/src/views/home/HomeView.vue`) đều dùng chung
  `MADE_FOR_YOU_ORDER`.

### 5.2 Cơ chế backend

- Endpoint: `GET /api/recommend/home` (đã có, đã thêm `weekly_mix` vào filter).
- Logic: controller Home query `playlists WHERE is_system=1 AND user_id=?` đã
  lấy luôn playlist `weekly_mix` của user hiện tại (vì `is_system=1`). Filter ở
  `finalMadeForYou` chỉ giữ các `system_key` có trong `MADE_FOR_YOU_ORDER`.
- **Home KHÔNG tự generate**: nếu user chưa có playlist `weekly_mix` thì đơn
  giản filter loại nó ra → response trả về không có slot Weekly Mix. Không tạo
  playlist, không ghi DB, không crash.
- **Cover fallback**: vì `apps/backend/src/utils/playlistCover.js` chưa map
  `weekly_mix` sang file ảnh bìa riêng, `cover_url` trả về `null`. Trường
  `effective_cover_url` được tính bằng `cover_url` của bài hát đầu tiên trong
  playlist (fallback SQL trong controller). Frontend `getPlaylistCover` ưu tiên
  `cover_url` rồi đến `effective_cover_url` nên UI luôn có ảnh.

### 5.3 Cơ chế frontend

- `HomeView.vue` đã có sẵn computed `displayMadeForYou` filter theo
  `MADE_FOR_YOU_ORDER`. Sau khi thêm `'weekly_mix'` ở đầu, Weekly Mix sẽ tự
  xuất hiện ở vị trí đầu tiên.
- Mỗi card dùng component `PlaylistCard` có sẵn, click → `router.push('/playlist/' + id)`.
- Click play trên card → `playPlaylist(item)` → gọi `/api/playlists/:id` lấy
  danh sách bài, set queue = toàn bộ playlist songs.

### 5.4 Read-only UI guard

`apps/frontend/src/views/library/PlaylistDetailView.vue` đã có sẵn các computed
phát hiện system playlist:

- `isSystemPlaylist`: `type === 'system' || is_system truthy || !!system_key`
- `canEditPlaylist`: `isManualPlaylist && isOwner` → `false` cho system
- `canReorderSongs`: `if (is_system || system_key) return false`

Từ đó UI tự ẩn:

- nút **Sửa / Xóa** (chỉ hiện khi `canEditMetadata`)
- khu vực **"Thêm bài hát" / search** (chỉ hiện khi `canEditSongs`)
- **drag handle** (chỉ hiện khi `canReorderSongs`)

Khi user mở playlist Weekly Mix, UI chỉ cho phép:

- Phát nhạc (play, queue, like từng bài)
- Lưu / bỏ lưu playlist vào thư viện cá nhân (nút save hiện cho system playlist)

### 5.5 Cách test UI thủ công

1. **User đã generate Weekly Mix** (vd. user 218):
   - `GET /api/recommend/home` với token của user → `madeForYouPlaylists` phải
     chứa playlist có `system_key='weekly_mix'`, `name='Weekly Mix của bạn'`,
     `total_songs=25` (hoặc bằng `limit` đã generate).
   - Mở trang Home → section "Dành cho bạn" phải có card Weekly Mix ở đầu.
   - Click card → mở `/playlist/:id` → trang detail hiển thị đủ 25 bài.
   - Bấm play được, like từng bài được, queue next hoạt động.
   - Không có nút Sửa / Xóa / Thêm bài / kéo-thả reorder.

2. **User chưa generate Weekly Mix** (vd. user 219, 220, 221):
   - `GET /api/recommend/home` → status 200, `madeForYouPlaylists` không chứa
     entry `weekly_mix` (chỉ có dailymix_01..06 + weeklymix).
   - Home page render bình thường, không crash.
   - Section "Dành cho bạn" hiển thị 7 card (không có Weekly Mix).

3. **Read-only API** (vd. PATCH/DELETE trên playlist Weekly Mix):
   - Tất cả endpoint mutating trả về `403` với message
     "Không thể chỉnh sửa playlist do hệ thống tạo".

### 5.6 Rà soát an toàn

- Không thêm endpoint mới, không thêm route mới, không thêm component mới.
- Home chỉ **đọc** playlist đã generate sẵn; không trigger generate từ Home.
- Không thay đổi schema, không tạo bảng/cột mới.
- Không hardcode playlist_id (luôn lookup theo `user_id + system_key`).

## 6. Cách kiểm tra SQL

Sau khi generate, kiểm tra trạng thái DB:

```sql
-- Số playlist Weekly Mix đã tạo cho user X
SELECT id, name, description, type, is_system, system_key, updated_at
FROM playlists
WHERE user_id = 218 AND system_key = 'weekly_mix';

-- Số bài + kiểm tra duplicate
SELECT song_id, COUNT(*) AS c
FROM playlist_songs
WHERE playlist_id = <id ở trên>
GROUP BY song_id HAVING c > 1;
-- Kỳ vọng: 0 dòng

-- Tổng quan
SELECT COUNT(*) FROM playlists WHERE system_key = 'weekly_mix';
```

## 7. Hạn chế & hướng phát triển

- **Scheduler**: hiện chưa có cron / queue tự chạy theo tuần. Cần bước sau để bật
  `node scripts/recommendation/generateWeeklyMix.js --all` định kỳ (ví dụ qua
  `scheduler.service.js` hoặc cron bên ngoài).
- **Phạm vi model**: BPR-MF hiện train trên experimental users
  (`exp_*@musicflow.test`) — user thật mặc định dùng fallback.
- **Cold-start**: user chưa nghe bài nào / chưa có genre preference sẽ rơi vào
  `popular_fallback`. Có thể bổ sung content-based seed dựa trên `user_genre_preferences`
  / followed artists trong tương lai.
- **Recommendation logic**: weekly mix không sửa đổi logic của `recommendation.service`
  hay evaluation. Chỉ thêm một lớp persist playlist phía trên.
- **Daily Mix / Morning Mix / Night Mix**: chưa triển khai trong task này. Có
  thể tái sử dụng `weeklyMix.service` với system_key khác nếu cần.
- **Frontend auto-display**: Weekly Mix mới (`weekly_mix`) chưa tự xuất hiện trong
  Home (chỉ có `weeklymix` cũ nằm trong `MADE_FOR_YOU_ORDER`). Có thể bổ sung ở
  bước UI sau nếu muốn show cả hai.
