# Recommendation Scheduler (Daily Mix + Weekly Mix)

Scheduler của MusicFlow chạy các cron job tự động tạo/cập nhật các playlist
gợi ý (Daily Mix 01-06, Weekly Mix). Scheduler được implement trong
`apps/backend/src/services/scheduler.service.js` (đã có sẵn cho AI retrain,
avatar, cover, album). File này mô tả phần recommendation scheduler được
bổ sung/thay thế trong task này.

## 1. Bật / tắt (AN TOÀN: mặc định TẮT)

Scheduler recommendation **MẶC ĐỊNH TẮT** để đảm bảo an toàn. Chỉ bật khi
env được set **rõ ràng** với giá trị chuỗi `'true'`. Mọi giá trị khác (thiếu,
`'false'`, `'0'`, `'1'`, `''`, ...) đều được coi là TẮT.

| Env                                          | Mặc định | Ý nghĩa                                                                                    |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `ENABLE_RECOMMENDATION_SCHEDULER`            | **TẮT** (env không có) | Chỉ `'true'` mới bật. So sánh nghiêm ngặt `=== 'true'`. Khi bất kỳ giá trị nào khác (kể cả `'1'`, `'yes'`, `'on'`), scheduler tắt. |
| `RECOMMENDATION_SCHEDULER_TEST_MODE`         | **TẮT** | Test mode. Khi `'true'`, các cron recommendation chạy mỗi `*/2 * * * *` thay vì lịch thật. CHỈ có hiệu lực khi `ENABLE_RECOMMENDATION_SCHEDULER=true`. CHỈ dùng cho local dev. TẮT NGAY khi test xong. |

Cấu hình trong `apps/backend/.env`:

```bash
# Bật toàn bộ cron recommendation. Mặc định: TẮT.
# CHỈ đặt 'true' khi muốn chạy auto Daily/Weekly Mix.
# ENABLE_RECOMMENDATION_SCHEDULER=true

# Test mode (chỉ dành cho local dev). Mặc định: TẮT.
# Chỉ có tác dụng khi ENABLE_RECOMMENDATION_SCHEDULER=true.
# RECOMMENDATION_SCHEDULER_TEST_MODE=false
```

Khi scheduler tắt (mọi case env missing hoặc env != 'true'):

```
[CRON] Recommendation scheduler disabled (ENABLE_RECOMMENDATION_SCHEDULER is not set). Set ENABLE_RECOMMENDATION_SCHEDULER=true to enable.
```

Khi scheduler bật:

```
[CRON] Recommendation scheduler ENABLED (ENABLE_RECOMMENDATION_SCHEDULER=true)
```

Khi test mode (chỉ khi enabled):

```
[CRON-TEST] RECOMMENDATION_SCHEDULER_TEST_MODE=true - cron sẽ chạy mỗi 2 phút. TẮT NGAY khi test xong!
```

### Lý do chuyển từ `!== 'false'` sang `=== 'true'`

Trước đây scheduler dùng `process.env.ENABLE_RECOMMENDATION_SCHEDULER !== 'false'`,
nghĩa là scheduler **TỰ BẬT** trừ khi env bằng `'false'`. Đây là lỗi an toàn
vì:

- Env missing → scheduler tự bật → chạy auto trong production nếu deploy
  thiếu file `.env`.
- Env=`'0'` hoặc env=`''` (typo) → scheduler vẫn bật vì `!== 'false'`.

Cách fix an toàn: `=== 'true'`. Env missing hoặc sai giá trị → TẮT. Phải
chủ động bật.

## 2. Lịch cron (production)

### 2.1 Daily Mix

Daily Mix 01-06 mỗi ngày 00:10 ICT (giờ server local = ICT). Mỗi cron sẽ
analyze 1 target date và update playlist `dailymix_0N` cho **tất cả user
active**.

| Cron          | Ngày chạy  | Target date         | system_key     | Phân tích                                    |
| ------------- | ---------- | ------------------- | -------------- | -------------------------------------------- |
| `10 0 * * 1`  | Thứ Hai    | CN (Sun) tuần trước | `dailymix_06`  | Weekend range `[Sat 00:00, Mon 00:00)`       |
| `10 0 * * 2`  | Thứ Ba     | T2 (Mon) tuần trước | `dailymix_01`  | `[Mon 00:00, Tue 00:00)`                     |
| `10 0 * * 3`  | Thứ Tư    | T3 (Tue) tuần trước | `dailymix_02`  | `[Tue 00:00, Wed 00:00)`                     |
| `10 0 * * 4`  | Thứ Năm   | T4 (Wed) tuần trước | `dailymix_03`  | `[Wed 00:00, Thu 00:00)`                     |
| `10 0 * * 5`  | Thứ Sáu   | T5 (Thu) tuần trước | `dailymix_04`  | `[Thu 00:00, Fri 00:00)`                     |
| `10 0 * * 6`  | Thứ Bảy   | T6 (Fri) tuần trước | `dailymix_05`  | `[Fri 00:00, Sat 00:00)`                     |
| (không có)    | Chủ Nhật   | -                   | -              | -                                            |

Quan trọng:

- **Không** có cron Daily Mix nào chạy 00:10 Chủ Nhật. `dailymix_06` chỉ
  được update vào 00:10 Thứ Hai với cả weekend range.
- Cron Thứ Hai (`10 0 * * 1`) chỉ chạy Daily Mix 06, không chạy Daily
  Mix 01 (Mon đó sẽ được analyze bởi cron Thứ Ba ngày hôm sau).
- Mỗi cron duyệt tất cả `users WHERE status='active' AND role='user'`,
  generate cho từng user, log kết quả tổng hợp.

### 2.2 Weekly Mix

| Cron          | Ngày chạy  | Tác vụ                                                |
| ------------- | ---------- | ----------------------------------------------------- |
| `30 3 * * 1`  | Thứ Hai 03:30 ICT | Chạy `weeklyMixService.generateWeeklyMixForAllUsers` cho toàn bộ user active. |

## 3. Lịch cron (test mode)

Khi `RECOMMENDATION_SCHEDULER_TEST_MODE=true`:

- **Daily Mix**: 1 cron `*/2 * * * *` (mỗi 2 phút) gọi
  `generateDailyMixForDate` cho `yesterday` (mọi user). Hợp nhất 6 cron
  production thành 1 cron test vì chạy mỗi 2 phút là đủ để test idempotency.
- **Weekly Mix**: 1 cron `*/2 * * * *` (mỗi 2 phút) chạy
  `generateWeeklyMixForAllUsers`.

3 cron cho avatar/cover/album + AI retrain (nếu `AI_RETRAIN_ENABLED=true`)
**không** bị ảnh hưởng bởi test mode.

## 4. Cron đã thay đổi

So với version scheduler trước:

| Cron cũ (đã gỡ)                                | Lý do gỡ                                                |
| ---------------------------------------------- | -------------------------------------------------------- |
| `10 2 * * 1` gọi `playlistGenerator.generateDailyMix(1)`  | Logic 6-bucket cũ bị thay bằng anchor + discovery. |
| `10 2 * * 2` gọi `playlistGenerator.generateDailyMix(2)`  | Tương tự. |
| `10 2 * * 3` gọi `playlistGenerator.generateDailyMix(3)`  | Tương tự. |
| `10 2 * * 4` gọi `playlistGenerator.generateDailyMix(4)`  | Tương tự. |
| `10 2 * * 5` gọi `playlistGenerator.generateDailyMix(5)`  | Tương tự. |
| `10 2 * * 6` gọi `playlistGenerator.generateDailyMix(6)`  | Tương tự. |
| `0 2 * * 0` gọi `playlistGenerator.generateWeeklyMix`     | Thay bằng cron Weekly Mix mới `30 3 * * 1` gọi `weeklyMixService`. |

Cron giữ nguyên (không liên quan):

- AI retrain `0 2 * * *` (chỉ chạy nếu `AI_RETRAIN_ENABLED=true`).
- Avatar scan `0 3 * * *`.
- Song cover scan `30 3 * * *`.
- Album cover scan `0 4 * * *`.

## 5. Cách verify

### 5.1 Verify cron đã đăng ký đúng

Production mode (chạy trong Node REPL hoặc file test tạm):

```js
process.env.RECOMMENDATION_SCHEDULER_TEST_MODE = 'false';
process.env.ENABLE_RECOMMENDATION_SCHEDULER = 'true';
require('./apps/backend/src/services/scheduler.service');
// output: 6 cron "10 0 * * N" + 1 cron "30 3 * * 1" + 3 cron avatar/cover/album
```

Kết quả đã verify (xem test trong task):

```
production mode CRON schedules:
  10 0 * * 2     x 1   (Tue 00:10 -> dailymix_01)
  10 0 * * 3     x 1   (Wed 00:10 -> dailymix_02)
  10 0 * * 4     x 1   (Thu 00:10 -> dailymix_03)
  10 0 * * 5     x 1   (Fri 00:10 -> dailymix_04)
  10 0 * * 6     x 1   (Sat 00:10 -> dailymix_05)
  10 0 * * 1     x 1   (Mon 00:10 -> dailymix_06)
  30 3 * * 1     x 1   (Mon 03:30 -> weekly_mix)
  0 3 * * *      x 1   (avatar scan)
  30 3 * * *     x 1   (song cover scan)
  0 4 * * *      x 1   (album cover scan)
```

Test mode (`RECOMMENDATION_SCHEDULER_TEST_MODE=true`):

```
test mode CRON schedules:
  */2 * * * *    x 1   (Daily Mix yesterday, all users)
  */2 * * * *    x 1   (Weekly Mix, all users)
  0 3 * * *      x 1   (avatar scan)
  30 3 * * *     x 1   (song cover scan)
  0 4 * * *      x 1   (album cover scan)
```

Disabled mode (mọi case `ENABLE_RECOMMENDATION_SCHEDULER` không phải `'true'`):

```
recommendation cron jobs registered: 0
  0 3 * * *      x 1   (avatar scan - still runs)
  30 3 * * *     x 1   (song cover scan - still runs)
  0 4 * * *      x 1   (album cover scan - still runs)
```

Đã verify bằng test matrix:

| `ENABLE_RECOMMENDATION_SCHEDULER` | `RECOMMENDATION_SCHEDULER_TEST_MODE` | Recommendation cron | Log                                                              |
| --------------------------------- | ------------------------------------ | ------------------ | ---------------------------------------------------------------- |
| không set                         | không set                            | 0                  | `disabled (ENABLE_RECOMMENDATION_SCHEDULER is not set)`          |
| `''`                              | không set                            | 0                  | `disabled (ENABLE_RECOMMENDATION_SCHEDULER= (not 'true'))`       |
| `'false'`                         | không set                            | 0                  | `disabled (ENABLE_RECOMMENDATION_SCHEDULER=false (not 'true'))`  |
| `'0'`                             | không set                            | 0                  | `disabled (ENABLE_RECOMMENDATION_SCHEDULER=0 (not 'true'))`      |
| `'1'`                             | không set                            | 0                  | `disabled (ENABLE_RECOMMENDATION_SCHEDULER=1 (not 'true'))`      |
| `'true'`                          | không set                            | 7                  | `ENABLED (ENABLE_RECOMMENDATION_SCHEDULER=true)`                 |
| `'true'`                          | `'true'`                             | 2 (test mode)      | `ENABLED` + `[CRON-TEST]` WARN                                   |
| `'true'`                          | `'false'`                            | 7 (prod)           | `ENABLED` (không có test warning)                                |

### 5.2 Verify playlist updated và idempotent

```sql
-- Kiểm tra updated_at tăng sau khi chạy
SELECT id, user_id, system_key, name, updated_at,
       (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) AS song_count
FROM playlists p
WHERE user_id = 11 AND system_key IN ('dailymix_01','dailymix_02','dailymix_03',
       'dailymix_04','dailymix_05','dailymix_06','weekly_mix')
ORDER BY system_key;
```

Kết quả mong đợi: mỗi playlist có đúng 25 bài, `updated_at` cập nhật khi
scheduler chạy. Khi chạy lại với cùng target date, playlist id giữ nguyên
(idempotent), `updated_at` thay đổi.

### 5.3 Verify không có duplicate

```sql
SELECT user_id, system_key, COUNT(*) AS total
FROM playlists
WHERE system_key IN ('dailymix_01','dailymix_02','dailymix_03',
                     'dailymix_04','dailymix_05','dailymix_06')
GROUP BY user_id, system_key HAVING total > 1;
-- Mong đợi: 0 rows
```

Đã verify sau backfill 7 ngày: `duplicate (user, system_key) rows: 0`.

### 5.4 Verify playlist_songs không có duplicate

```sql
SELECT playlist_id, song_id, COUNT(*) AS c
FROM playlist_songs
WHERE playlist_id IN (SELECT id FROM playlists WHERE system_key LIKE 'dailymix_%')
GROUP BY playlist_id, song_id HAVING c > 1;
-- Mong đợi: 0 rows
```

Mỗi playlist có tối đa 25 bài unique.

### 5.5 Verify weekly_mix không bị ảnh hưởng

Sau khi chạy Daily Mix nhiều lần, `weekly_mix` của user 11 phải giữ
nguyên `updated_at` (chỉ thay đổi khi Weekly Mix cron chạy Thứ Hai 03:30).

## 6. Test mode workflow

```bash
# 1. Bật test mode
export ENABLE_RECOMMENDATION_SCHEDULER=true
export RECOMMENDATION_SCHEDULER_TEST_MODE=true

# 2. Khởi động backend
cd apps/backend && node src/server.js

# 3. Quan sát log: mỗi 2 phút sẽ thấy
#    [CRON] Daily Mix run for target=YYYY-MM-DD starting...
#    [CRON] Daily Mix target=YYYY-MM-DD done: users=... ok=... err=...
#    [CRON-TEST] Weekly Mix run starting...
#    [CRON-TEST] Weekly Mix done: users=... err=...

# 4. Verify DB
mysql> SELECT user_id, system_key, updated_at FROM playlists
       WHERE user_id = 11 AND system_key IN ('dailymix_03','weekly_mix');

# 5. TẮT test mode NGAY khi xong
unset RECOMMENDATION_SCHEDULER_TEST_MODE
# Hoặc set false
export RECOMMENDATION_SCHEDULER_TEST_MODE=false

# 6. Restart backend
```

## 7. Tích hợp với backend startup

`apps/backend/src/server.js` đã có sẵn:

```js
require('./services/scheduler.service');
```

→ Scheduler tự động load khi server khởi động. Không cần thêm gì.

## 8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
| ----------- | ----------- | -------- |
| Cron không chạy | `ENABLE_RECOMMENDATION_SCHEDULER=false` | Set lại `true` hoặc unset. |
| Cron chạy mỗi 2 phút ngoài ý muốn | Quên unset `RECOMMENDATION_SCHEDULER_TEST_MODE` | Unset/test=false. |
| Daily Mix 06 trống dữ liệu | Target date Sat nhưng weekend range rỗng | Verify `listening_history` có rows trong `[Sat 00:00, Mon 00:00)`. |
| Test idempotency fails | MySQL transaction không rollback khi lỗi | Đã fix: `dailyMix.service` dùng `conn.beginTransaction()` + rollback khi `ensurePlaylist`/`replacePlaylistSongs` lỗi. |
| Anchor ratio > 50% | `listenedFromTargetDateCount` cao | Verify user có thật nhiều bài đã nghe trong target range. Có thể giảm `MAX_PER_ARTIST` xuống 1. |

## 9. Files liên quan

- `apps/backend/src/services/scheduler.service.js` — scheduler.
- `apps/backend/src/services/dailyMix.service.js` — Daily Mix logic.
- `apps/backend/src/services/weeklyMix.service.js` — Weekly Mix logic.
- `apps/backend/src/services/recommendation.service.js` — BPR-MF serving.
- `apps/backend/src/services/recommendationModel.service.js` — model load.
- `apps/backend/src/services/systemPlaylist.service.js` — config + cover.
- `scripts/recommendation/generateDailyMixes.js` — CLI Daily Mix.
- `scripts/recommendation/generateWeeklyMix.js` — CLI Weekly Mix.
- `docs/recommendation/daily-mix.md` — chi tiết Daily Mix.
- `docs/recommendation/weekly-mix.md` — chi tiết Weekly Mix.
- `docs/recommendation/serving.md` — BPR-MF serving layer.
