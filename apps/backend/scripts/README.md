# Backend Scripts

Thu muc nay gom cac script van hanh/bao tri backend theo nhom chuc nang. Nen chay tu thu muc `apps/backend` de cac duong dan tuong doi va file `.env` duoc nap dung.

## Quy tac an toan

- Khong chay import, migration, repair, crawl/fetch hang loat neu chua kiem tra tham so va moi truong database.
- Cac script co the ghi database hoac ghi file bao cao/backup; doc file script truoc khi them co `--apply`, `--force`, `--resetCursor`.
- Khong thay doi runtime URL `/uploads`; cac script van tao URL dang `/uploads/...` khi can.
- Thu muc runtime `apps/backend/uploads/` khong nam trong cay scripts va khong nen di chuyen.

## Nhom script

- `audit/`: script kiem tra du lieu va file, vi du audit audio, audit discography, test query profile.
- `import/`: script import/dong bo du lieu nhac va discography.
- `fetch/`: script fetch avatar artist, cover album, cover song.
- `lyrics/`: script crawl, normalize, va import lyrics.
- `migrations/`: script migration schema/database. Cac npm scripts migration trong `package.json` da tro vao day.
- `repair/`: script sua/phan loai lai du lieu va cac file backup lien quan.
- `playlist/`: script seed va cleanup system playlists.
- `health/`: script kiem tra nhanh tinh trang schema/tinh nang.
- `reports/`: file bao cao text sinh ra hoac dung de doi chieu.

## Cach chay

Tu `apps/backend`:

```bash
npm run migrate
npm run migrate-region
npm run migrate-premium
node scripts/audit/auditSongAudioFiles.js
node scripts/fetch/fetch_song_covers.js
node scripts/lyrics/normalizeLyrics.js --limit=10
```

Voi script repair, uu tien dry-run neu script ho tro. Vi du:

```bash
node scripts/repair/repairSongAudioPaths.js
node scripts/repair/repairSongAudioPaths.js --apply
```

Chi dung `--apply` sau khi da doc output dry-run va chac chan DB/file path dung.
