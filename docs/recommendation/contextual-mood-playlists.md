# Contextual Mood Playlists

## Contextual Mood Playlist la gi

Contextual Mood Playlist la cach dong goi ket qua tu `contextualMood.service` thanh system playlist read-only. Thay vi hien mot carousel bai hat rieng tren Home, MusicFlow hien cac goi y theo buoi trong ngay nhu playlist card trong section "Goi y hom nay".

## Vi sao chon playlist card

Home da co section "Goi y hom nay" cho cac playlist he thong nhu Morning Vibes, Mood Mix, Favorite Songs, Trending Now, Recently Played va Night Vibes. Dua Contextual Mood vao cung section nay giup UI gon hon, tranh trung y nghia voi section bai hat rieng, va giu dung hanh vi quen thuoc: click card vao `/playlist/:id`, play playlist, xem playlist detail read-only.

## System keys

| Time slot | System key | Playlist name |
|---|---|---|
| morning | `morning_vibes` | Morning Vibes |
| afternoon | `afternoon_vibes` | Afternoon Vibes |
| evening | `evening_vibes` | Evening Vibes |
| night | `night_vibes` | Night Vibes |

`morning_vibes` va `night_vibes` reuse key cu. `afternoon_vibes` va `evening_vibes` la key bo sung cho cung nhom Contextual Mood.

## Mood mapping theo buoi

| Time slot | Expected moods/vibes | Energy range |
|---|---|---|
| morning | chill, happy, acoustic, focus, light | 0.25-0.70 |
| afternoon | energetic, happy, pop, dance, focus | 0.40-0.90 |
| evening | chill, romantic, happy, rnb, acoustic | 0.25-0.70 |
| night | chill, sad, romantic, acoustic, calm | 0.10-0.55 |

Noi dung playlist duoc generate bang `apps/backend/src/services/contextualMood.service.js`. Service nay lay candidate recommendation, doc `song_audio_features`, sau do rerank theo mood/vibe/energy cua tung time slot.

## Home integration

Home khong goi `/api/recommend/contextual-mood` khi load. Home chi goi API trang chu hien co va nhan cac playlist system da duoc generate san trong bang `playlists` va `playlist_songs`.

Section "Goi y hom nay" uu tien hien:

1. Morning Vibes
2. Afternoon Vibes
3. Evening Vibes
4. Night Vibes
5. Mood Mix
6. Favorite Songs
7. Trending Now
8. Recently Played
9. Top Tracks

Playlist chi duoc tra ve Home khi co it nhat mot bai hat.

## CLI

Dry-run cho mot user:

```bash
node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11 --dry-run
```

Generate 4 playlist cho mot user:

```bash
node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11
```

Generate mot slot:

```bash
node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11 --timeSlot=morning
```

Generate cho tat ca active non-admin users:

```bash
node scripts/recommendation/generateContextualMoodPlaylists.js --all
```

Tuy chon:

```bash
node scripts/recommendation/generateContextualMoodPlaylists.js --user-id=11 --limit=25
node scripts/recommendation/generateContextualMoodPlaylists.js --help
```

## Cach test UI

1. Chay CLI generate cho user dang test.
2. Dang nhap user do.
3. Mo Home va kiem tra section "Goi y hom nay" co Morning Vibes, Afternoon Vibes, Evening Vibes, Night Vibes.
4. Click tung card de mo `/playlist/:id`.
5. Kiem tra playlist detail khong hien nut sua, xoa, them bai, reorder.
6. Bam play va xac nhan phat nhu playlist binh thuong.
7. Network khi load Home khong co request `/api/recommend/contextual-mood`.

## Read-only

Bon playlist mood co `type='system'`, `is_system=1`, `is_public=0`, va `system_key`. Cac mutation endpoint hien co se reject playlist system/manual-mutation vi playlist co `is_system` hoac `system_key`.

## Scheduler

Task nay khong them cron moi de tranh gay roi lich Daily Mix / Weekly Mix. Playlist duoc generate bang CLI. Scheduler cap nhat dinh ky co the them sau, sau khi thong nhat cadence va env toggle rieng.

## Han che

- Mood mapping hien rule-based.
- Chat luong phu thuoc `song_audio_features`.
- Playlist chi xuat hien tren Home sau khi duoc generate bang CLI hoac scheduler tuong lai.
- Neu chua co cover rieng cho Afternoon/Evening, UI se dung `effective_cover_url` tu bai dau playlist.
