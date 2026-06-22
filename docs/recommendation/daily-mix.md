# Daily Mix 01–06 (Auto-generated Playlists)

Daily Mix của MusicFlow là 6 playlist hệ thống (`dailymix_01`..`dailymix_06`) được
sinh tự động cho **từng user**, dựa trên **hành vi nghe nhạc của 1 ngày cụ thể
trong tuần** (hoặc cả Thứ Bảy + Chủ Nhật đối với `dailymix_06`). Mỗi user có
đúng 6 playlist Daily Mix hiển thị trong section **"Dành cho bạn"** của Home
page MusicFlow.

## 1. Concept

> **Daily Mix = anchor songs (25-35%) + discovery songs (65-75%) dựa trên
> hành vi nghe nhạc của ngày D (hoặc cả weekend đối với dailymix_06).**

Daily Mix **KHÔNG phải**:

- Recently Played thứ hai — anchor chỉ là một phần nhỏ và đã được chọn lọc.
- Top genre buckets (đã bỏ logic 6-bucket thematic split ở version cũ).
- Tập hợp các bài top của user trong tuần (đó là vai trò của Weekly Mix).

### 1.1 Anchor songs

Là các bài user đã nghe nổi bật trong **target date** (1 ngày hoặc cả
Sat+Sun đối với `dailymix_06`). Tiêu chí chọn anchor (theo thứ tự ưu tiên):

1. `completion_rate` trung bình cao (≥ 0.7 tốt).
2. Không bị skip nhiều lần.
3. Nghe lặp nhiều lần trong target range.
4. Đã được like trong vòng 30 ngày gần target.
5. Có audio public, `is_active=1`, `release_status='public'`.

Số lượng anchor mặc định: `floor(perMix * 0.30)` (với `perMix=25` thì ~8 bài).
Nếu target range có quá ít dữ liệu (`historyCount < 8`) thì giảm anchor
ratio xuống `0.18`.

Anchor cũng phải tuân thủ **artist cap**: không quá `MAX_PER_ARTIST=2` bài
cùng artist. Nếu anchor đã dùng hết 2 bài của artist X, các bài khác cùng
artist sẽ bị bỏ qua (dù vẫn được tính trong candidates).

### 1.2 Discovery songs

Là các bài **mở rộng** từ profile ngắn hạn của user (top genres, top
artists, top markets trong target range). Discovery được chọn theo 2 phase:

- **Phase 1 (ưu tiên cao)**: chỉ chọn bài **chưa được nghe trong target
  range**. Mục đích: playlist cuối không bị lẫn vào Recently Played.
- **Phase 2 (nếu thiếu)**: cho phép tối đa `softAnchorCap = ceil(discoveryTarget / 3)`
  bài **đã nghe trong target range** để giữ cảm giác quen thuộc.
- **Phase 3 (nếu vẫn thiếu)**: bổ sung từ `play_count DESC` (popular pool).

Mỗi discovery bài cũng phải tuân thủ **artist cap** dùng chung với anchor
(`ARTIST_CAP_HARD=3`).

### 1.3 Interleave

Sau khi chọn anchor + discovery, danh sách cuối được trộn bằng pattern
`A D D D A D D D ...` (1 anchor mỗi 3 discovery). Mục đích: cảm giác quen
thuộc (anchor) không bị dồn cục ở đầu playlist.

## 2. Mapping weekday → system_key

| target date (ICT)   | weekday | system_key   | target range                                    |
| ------------------- | ------- | ------------ | ----------------------------------------------- |
| Thứ Hai (Mon)       | T2      | `dailymix_01` | `[Mon 00:00, Tue 00:00)`                        |
| Thứ Ba (Tue)        | T3      | `dailymix_02` | `[Tue 00:00, Wed 00:00)`                        |
| Thứ Tư (Wed)        | T4      | `dailymix_03` | `[Wed 00:00, Thu 00:00)`                        |
| Thứ Năm (Thu)       | T5      | `dailymix_04` | `[Thu 00:00, Fri 00:00)`                        |
| Thứ Sáu (Fri)       | T6      | `dailymix_05` | `[Fri 00:00, Sat 00:00)`                        |
| Thứ Bảy (Sat)       | T7      | `dailymix_06` | `[Sat 00:00, Mon 00:00)` (weekend range)        |
| Chủ Nhật (Sun)      | CN      | `dailymix_06` | `[Sat 00:00, Mon 00:00)` (cùng weekend range)   |

Quan trọng:

- `dailymix_06` chỉ map duy nhất 1 playlist, dù target date là Sat hay Sun.
  Scheduler chỉ chạy 00:10 Thứ Hai (1 lần) để analyze cả weekend range.
- **Không** có cron Daily Mix nào chạy 00:10 Chủ Nhật.

## 3. Idempotency & Read-only

- Khi chạy nhiều lần với cùng `(user_id, system_key)`, playlist id được
  giữ nguyên, chỉ `playlist_songs` được refresh.
- `created=false` trong summary nếu playlist đã tồn tại.
- `is_system=1`, `type='system'`, `system_key='dailymix_0N'` để frontend
  nhận diện và không cho phép edit tên/songs từ UI user.
- Description tự động cập nhật theo `PLAYLIST_DESCRIPTIONS` (xem service).
- DB unique constraint check đã verify: 0 duplicate `(user, system_key)`
  sau khi backfill 7 ngày.

## 4. Timezone

- MySQL `@@global.time_zone = 'SYSTEM'` = server local (ICT, +07).
- `listening_history.listened_at` lưu **ICT local datetimes** (do INSERT
  dùng `NOW()`).
- `mysql2` driver trả về Date object thêm `Z` (UTC) nhưng phần literal
  giữ nguyên, nên `Date#getDay()` trong JS sẽ lệch nếu cộng/trừ 7h.
- **Quyết định**: dùng SQL `DATE(listened_at)` cho date filter (vì MySQL
  so sánh literal date với literal date trong cột ICT). Node-side dùng
  `new Date('YYYY-MM-DD')` để parse local ICT midnight, tránh Date UTC.
- Cú pháp: `new Date(2026, 5, 17)` (= `2026-06-17` local) → `getDay() = 3`
  (Wed) → `dailymix_03`. Đã verify bằng `_checkTz.js`.

## 5. Cấu trúc service

File: `apps/backend/src/services/dailyMix.service.js`

### 5.1 Hàm chính

```js
generateDailyMixForDate(userId, date, { perMix, dryRun })
//   userId: number
//   date:   Date | 'YYYY-MM-DD'
//   options.perMix: số bài mỗi mix (default 25, max 30)
//   options.dryRun: bool
//   return: summary object (xem phần Dry-run output)
```

### 5.2 Backward-compat wrappers

```js
generateDailyMixesForUser(userId, { perMix, dryRun })
// Generate cả 6 mix cho 1 user theo 6 ngày gần nhất (Mon..Sun tuần trước).
// Dedupe theo system_key: Sat+Sun cùng map dailymix_06 nên chỉ chạy 1 lần.

generateDailyMixesForAllUsers({ perMix, dryRun })
// Generate cho tất cả user active.
```

### 5.3 Helper nội bộ

- `weekdayToSystemKey(date)` — map `getDay()` → system_key.
- `computeTargetRange(dateObj)` — tính `[start, end)` cho target date.
- `fetchListeningRowsInRange(conn, userId, start, end)` — lấy rows theo
  SQL `DATE(listened_at)`, join với songs public.
- `fetchListeningRowsInRangeFallback(conn, userId, targetStart, days)` —
  mở rộng N ngày trước target range (mặc định 3 ngày) khi target range rỗng.
- `buildDailyProfile(rows)` — gom genre/artist/market counts + song stats.
- `selectAnchorSongs(profile, likedSet, anchorTarget)` — chọn anchor
  theo score có weighted `completion_rate + listen_count + like_bonus - skip_penalty`.
- `fetchDiscoveryCandidates(conn, profile, excludeSet, limit)` — SQL query
  lấy candidates dựa trên top genres/artist/market.
- `fetchPopularCandidates(conn, excludeSet, limit)` — fallback popular.
- `interleaveAnchorDiscovery(anchorIds, discoveryIds)` — trộn thứ tự.

## 6. CLI

File: `scripts/recommendation/generateDailyMixes.js`

```bash
# Tạo/cập nhật Daily Mix cho 1 ngày cụ thể (mapping theo weekday)
node scripts/recommendation/generateDailyMixes.js --user-id=11 --date=2026-06-17
node scripts/recommendation/generateDailyMixes.js --user-id=11 --date=2026-06-17 --dry-run

# Tạo/cập nhật Daily Mix cho ngày hôm qua (scheduler mode)
node scripts/recommendation/generateDailyMixes.js --user-id=11 --yesterday
node scripts/recommendation/generateDailyMixes.js --all --yesterday

# Backfill N ngày gần nhất (1-14)
#   Lưu ý: --backfill-days=6 chỉ cover ~5 mix (vì Sat+Sun cùng 1 mix).
#   Dùng --backfill-days=7 để cover đủ 6 mix (Thu tuần trước → Wed tuần này).
node scripts/recommendation/generateDailyMixes.js --user-id=11 --backfill-days=7

# Tuỳ chọn khác
node scripts/recommendation/generateDailyMixes.js --user-id=11 --date=2026-06-16 --limit-per-mix=30
node scripts/recommendation/generateDailyMixes.js --help
```

### 6.1 Dry-run output format

```
--- user_id=11 system_key=dailymix_02 ---
target date   : 2026-06-16 (T3 (Thứ Ba))
target range  : [2026-06-16 00:00 ICT, 2026-06-17 00:00 ICT)
rec strategy  : content_based_fallback (reason=ok, recItems=50)
historyCount  : 47 (target range goc) | distinctListened=45 | distinctTargetRange=45
top genres    : [16, 14, 21, 26, 17]
top artists   : [15, 41, 121, 81, 39]
top markets   : [KPOP, VPOP, USUK]
perMix        : 25 | anchorRatio target: 8/25 = 0.32
anchorSelected: 8
discovery     : 17 (target=17, popularAdded=4)
finalSongCount: 25
duplicateCount: 0
listenedFromTargetDateCount: 9 (36% of final)
top 10 songs  : [7245, 7651, 228, 5249, 1208, 5253, 3859, 3872, 1214, 3875]
mode          : dry-run (no DB write)
```

Các trường quan trọng:

- `historyCount`: số rows trong target range gốc (không mở rộng).
- `profileCount`: số rows thực tế dùng để build profile (= `historyCount`
  nếu target range có data, hoặc lớn hơn nếu fallback lookback được dùng).
- `distinctTargetRangeSongCount`: số distinct bài đã nghe trong target range.
- `anchorSelected` / `discoverySelected`: số bài thực sự được chọn.
- `listenedFromTargetDateCount`: số bài trong playlist cuối mà user đã
  nghe trong target range. Tỉ lệ này nên nằm trong khoảng **25-35%** với
  data dày, có thể thấp hơn (0-20%) với ngày ít data.
- `recentlyPlayedWarning`: nếu tỉ lệ `listenedFromTargetDateCount /
  finalSongCount > 0.5` thì log WARN (anchor ratio quá cao, playlist
  giống Recently Played).
- `popularAdded`: số bài bổ sung từ popular pool (xảy ra khi discovery
  pool không đủ sau khi loại trừ listened trong target range).
- `duplicateCount`: số bài trùng trong playlist (luôn bằng 0).
- `topSongIds`: 10 ID bài đầu tiên trong playlist cuối.

## 7. Scheduler

Xem chi tiết: `docs/recommendation/scheduler.md`.

Tóm tắt: scheduler recommendation **mặc định TẮT** (an toàn), chỉ bật
khi `ENABLE_RECOMMENDATION_SCHEDULER=true` rõ ràng. Khi bật:
- 6 cron Daily Mix chạy 00:10 ICT mỗi ngày (trừ Chủ Nhật).
- 1 cron Weekly Mix chạy 03:30 Thứ Hai.
- Nếu thêm `RECOMMENDATION_SCHEDULER_TEST_MODE=true` thì gộp thành 2 cron
  test `*/2 * * * *` (CHỈ dùng cho local dev).

## 8. Verification

Đã chạy thành công các test sau (xem thêm ở `scheduler.md`):

| Test                                                          | Kết quả |
| ------------------------------------------------------------- | ------- |
| `--date=2026-06-17` (Wed, target dailymix_03, 0 rows)         | ✓ fallback lookback 3d, 8 anchor + 17 discovery, 0 listened from target |
| `--date=2026-06-16` (Tue, target dailymix_02, 47 rows)        | ✓ 8 anchor + 17 discovery, listened=36% (trong target 25-35%) |
| `--date=2026-06-13` (Sat) vs `2026-06-14` (Sun)               | ✓ cùng map `dailymix_06`, cùng range, kết quả identical |
| Real generate `--date=2026-06-16`                              | ✓ chỉ update 1 playlist (dailymix_02), 5 mix khác không đổi |
| Backfill 7 days cho user 11                                   | ✓ cả 6 mix updated, 0 duplicate `(user, system_key)` |
| `--all --yesterday` real                                      | ✓ 206 users, 5150 songs inserted, 0 errors, 0 created (idempotent) |
| Test mode `RECOMMENDATION_SCHEDULER_TEST_MODE=true`           | ✓ cron `*/2 * * * *` đăng ký, 6 daily cron gộp thành 1 cron test |
| `ENABLE_RECOMMENDATION_SCHEDULER=false`                       | ✓ 0 cron recommendation đăng ký, avatar/cover/album vẫn chạy |

## 9. Đã thay đổi gì so với version trước

| File                                               | Thay đổi                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/backend/src/services/dailyMix.service.js`    | Bỏ logic 6-bucket thematic split. Thêm `generateDailyMixForDate` (anchor + discovery).   |
| `apps/backend/src/services/scheduler.service.js`   | Bỏ 6 cron cũ (gọi `playlistGenerator.service.generateDailyMix`). Thêm 6 cron mới + 1 cron Weekly Mix. |
| `apps/backend/.env.example`                        | Thêm `ENABLE_RECOMMENDATION_SCHEDULER` + `RECOMMENDATION_SCHEDULER_TEST_MODE`.            |
| `scripts/recommendation/generateDailyMixes.js`     | Hỗ trợ `--date`, `--yesterday`, `--backfill-days`. Dry-run log đầy đủ anchor/discovery.   |

Không có hardcode user id, không tạo playlist trùng, không xóa các cron
khác (avatar/cover/album/AI retrain).
