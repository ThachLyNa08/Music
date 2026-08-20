# Recommendation Scheduler

Scheduler recommendation của MusicFlow tạo/cập nhật các system playlists như Daily Mix, Weekly Mix, Mood Mix, Vibes và Trending Now. Code hiện tại nằm chủ yếu ở:

```text
apps/backend/src/services/scheduler.service.js
apps/backend/src/services/systemPlaylistSchedulerRunner.service.js
apps/backend/src/utils/systemPlaylistSchedule.util.js
```

## 1. Bật/tắt

Scheduler recommendation mặc định tắt. Chỉ bật khi env bằng đúng chuỗi `'true'`:

```text
ENABLE_RECOMMENDATION_SCHEDULER=true
```

Mọi giá trị khác như thiếu env, `false`, `0`, `1`, rỗng hoặc typo đều được xem là tắt.

Test mode:

```text
RECOMMENDATION_SCHEDULER_TEST_MODE=true
```

Test mode chỉ có tác dụng khi `ENABLE_RECOMMENDATION_SCHEDULER=true`.

## 2. Shared runner hiện tại

Khi scheduler được bật, code mặc định dùng shared runner nếu không set:

```text
RECOMMENDATION_SCHEDULER_SHARED_RUNNER=false
```

Shared runner đăng ký một cron:

| Mode | Cron | Timezone | Ghi chú |
|---|---|---|---|
| Production | `0 0 * * *` | `Asia/Ho_Chi_Minh` | Chạy mỗi ngày 00:00, xử lý các schedule rule đến hạn. |
| Test mode | `*/2 * * * *` | `Asia/Ho_Chi_Minh` | Chạy nhanh mỗi 2 phút, truyền `force: true`. |

Shared runner gọi:

```js
runSystemPlaylistSchedulerOnce({
  allDue: true,
  force: RECOMMENDATION_TEST_MODE,
  dryRun: false,
  limitTargets: null,
  triggerSource: 'scheduler',
  mode: RECOMMENDATION_TEST_MODE ? 'scheduler_test' : 'scheduler'
})
```

Để tránh chạy chồng, runner dùng lock `system_playlist_scheduler` qua `systemPlaylistSchedulerLock.service`.

## 3. Schedule rules

Các rule hiện tại được khai báo trong `systemPlaylistSchedule.util.js`:

| System key / group | Frequency | Day | Time |
|---|---|---|---|
| `dailymix_01` | weekly | Thứ Hai | 00:00 |
| `dailymix_02` | weekly | Thứ Ba | 00:00 |
| `dailymix_03` | weekly | Thứ Tư | 00:00 |
| `dailymix_04` | weekly | Thứ Năm | 00:00 |
| `dailymix_05` | weekly | Thứ Sáu | 00:00 |
| `dailymix_06` | weekly | Thứ Bảy | 00:00 |
| `weekly_mix` | weekly | Chủ nhật | 00:00 |
| `moodmix` | daily | hằng ngày | 00:00 |
| `vibes` (`morning_vibes`, `afternoon_vibes`, `evening_vibes`, `night_vibes`) | daily | hằng ngày | 00:00 |
| `trending_now` | daily | hằng ngày | 00:00 |

Timezone chuẩn của schedule util là:

```text
Asia/Ho_Chi_Minh
```

Weekly Mix hiện có lịch Chủ nhật 00:00 Asia/Ho_Chi_Minh.

## 4. Analysis window

`getClosedAnalysisWindow(scheduleKey, runAt)` tạo window dữ liệu đóng:

- `weekly_mix`: 7 ngày trước thời điểm schedule.
- Các schedule khác: 1 ngày trước thời điểm schedule.

Ví dụ Weekly Mix chạy Chủ nhật 00:00 thì analysis window là 7 ngày trước Chủ nhật 00:00.

## 5. Legacy jobs

Legacy cron jobs chỉ chạy khi bật rõ:

```text
ENABLE_RECOMMENDATION_SCHEDULER=true
RECOMMENDATION_SCHEDULER_LEGACY_JOBS=true
RECOMMENDATION_SCHEDULER_SHARED_RUNNER=false
```

Nếu `RECOMMENDATION_SCHEDULER_LEGACY_JOBS=true` nhưng shared runner vẫn bật, code log warning và không chạy legacy jobs.

Legacy mode vẫn có các cron riêng cho Daily Mix, Weekly Mix, Mood Mix, Contextual Mood và Trending Now. Đây là đường tương thích; tài liệu vận hành hiện tại nên ưu tiên shared runner.

## 6. Các job không thuộc recommendation scheduler

Các cron sau vẫn được đăng ký độc lập với `ENABLE_RECOMMENDATION_SCHEDULER`:

- AI retrain nếu `AI_RETRAIN_ENABLED=true`: `0 2 * * *`
- Premium reminder: `0 8 * * *`
- Artist avatar scan: `0 3 * * *`
- Song cover scan: `30 3 * * *`
- Album cover scan: `0 4 * * *`
- Expire pending payment transactions: `* * * * *`
- Premium expiring notification: `0 9 * * *` với timezone `Asia/Ho_Chi_Minh`

## 7. Files liên quan

- `apps/backend/src/services/scheduler.service.js` — đăng ký cron và shared runner.
- `apps/backend/src/services/systemPlaylistSchedulerRunner.service.js` — chạy các schedule rule đến hạn.
- `apps/backend/src/utils/systemPlaylistSchedule.util.js` — khai báo rule, timezone và analysis window.
- `apps/backend/src/services/dailyMix.service.js` — Daily Mix logic.
- `apps/backend/src/services/weeklyMix.service.js` — Weekly Mix logic.
- `apps/backend/src/services/recommendation.service.js` — LightGCN Hybrid V4 serving và fallback.
- `apps/backend/src/services/recommendationModel.service.js` — model/artifact loader.
- `docs/recommendation/daily-mix.md` — chi tiết Daily Mix.
- `docs/recommendation/weekly-mix.md` — chi tiết Weekly Mix.
- `docs/recommendation/serving.md` — Recommendation V4 serving layer.
