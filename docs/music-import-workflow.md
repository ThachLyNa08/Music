# Quy trình thêm nhạc mới vào MusicFlow

Tài liệu này mô tả thứ tự chạy lệnh để thêm nhạc mới vào MusicFlow: lấy metadata, tải file audio, cập nhật CSV, import database, lấy cover, lấy lyrics, phân tích audio features và kiểm tra trên giao diện.

Nguyên tắc khi chạy:

- Không xóa dữ liệu cũ.
- Không đổi schema database.
- Không di chuyển `apps/backend/uploads`.
- Không chạy `--force` hàng loạt nếu không cần.
- Luôn kiểm tra CSV và file audio thật trước khi import DB.

## 0. Chuẩn bị môi trường

Mở terminal tại project root:

```powershell
cd D:\CaNhan\Luan_Van
```

Khi chạy script Python trong `apps/ai-service`, kích hoạt `.venv` nếu script cần thư viện như `yt-dlp`, `pandas`, `demucs`, `librosa`:

```powershell
cd D:\CaNhan\Luan_Van\apps\ai-service
.\.venv\Scripts\Activate.ps1
```

Khi chạy script Node backend:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
```

Kiểm tra các thành phần cần thiết:

```powershell
ffmpeg -version
node -v
py --version
```

MySQL phải đang chạy khi dùng các script backend có truy cập DB. Cấu hình DB nằm trong:

```text
apps/backend/.env
apps/backend/src/config/database.js
```

Backend chỉ bắt buộc phải chạy khi muốn test phát file qua URL `/uploads/...` hoặc test giao diện:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
npm run dev
```

AI service cần chạy khi phân tích audio features hoặc dùng tính năng xử lý audio qua FastAPI:

```powershell
cd D:\CaNhan\Luan_Van\apps\ai-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

## Rà soát nhanh script hiện có

| Script | Vai trò | Chạy ở thư mục | Ghi DB | Ghi file/CSV | Ghi chú |
| ------ | ------- | -------------- | ------ | ------------ | ------- |
| `apps/ai-service/scripts/download/metadata/1_get_metadata.py` | Lấy metadata từ NhacCuaTui/Nuxt page ra CSV | `apps/ai-service` | Không | Có | Hiện đang ghi `nct_metadata_pending1.csv`; pipeline chuẩn bên dưới dùng `nct_metadata_pending.csv`, cần kiểm tra trước khi chạy. |
| `apps/ai-service/scripts/download/metadata/ytb_download_from_metadata.py` | Wrapper gọi `2_download_from_csv.py` | `apps/ai-service` | Không | Có | Luồng tải audio từ CSV metadata. |
| `apps/ai-service/scripts/download/metadata/2_download_from_csv.py` | Tải audio từ `Source_URL` hoặc `YouTube_URL`, cập nhật status CSV nếu ghi được | `apps/ai-service` | Không | Có | Đọc mặc định `apps/backend/uploads/music/nct_metadata_pending.csv`. |
| `apps/ai-service/scripts/download/metadata/download_unified.py` | Script metadata/download cũ dạng unified | `apps/ai-service` | Không | Có | Không nên dùng làm luồng chính nếu đang dùng CSV metadata mới. |
| `apps/ai-service/scripts/download/youtube/ytb_dl_kpop.py` | Tải KPOP trực tiếp bằng yt-dlp | `apps/ai-service` | Không | Có | Cần cookie/browser nếu YouTube chặn bot. |
| `apps/ai-service/scripts/download/youtube/youtube_downloader_kpop.py` | Script YouTube KPOP cũ | `apps/ai-service` | Không | Có | Legacy-ish, giữ tham khảo. |
| `apps/ai-service/scripts/download/youtube/youtube_downloader_vpop.py` | Script YouTube VPOP cũ | `apps/ai-service` | Không | Có | Legacy-ish, giữ tham khảo. |
| `apps/ai-service/scripts/download/youtube/youtube_downloader_usuk.py` | Script YouTube USUK cũ | `apps/ai-service` | Không | Có | Legacy-ish, giữ tham khảo. |
| `apps/ai-service/scripts/download/legacy/auto_download.py` | Script tải thử từ CSV Spotify | `apps/ai-service` | Không | Có | Legacy, không dùng chính. |
| `apps/ai-service/scripts/download/legacy/download_music.py` | Script tải nhạc cũ bằng subprocess `yt-dlp` | `apps/ai-service` | Không | Có | Legacy; `CSV_FILE` trỏ thư mục, cần kiểm tra thủ công nếu dùng lại. |
| `apps/backend/scripts/maintenance/updateMetadataDownloadStatus.js` | Kiểm tra file audio thật và cập nhật `Download_Status` | `apps/backend` | Không | Có | Dùng trước khi import DB. |
| `apps/backend/scripts/maintenance/importSongsFromMetadataCsv.js` | Import CSV vào `genres`, `artists`, `albums`, `songs` | `apps/backend` | Có | Không | Chỉ import dòng `Download_Status=downloaded`. |
| `apps/backend/scripts/fetch/fetch_album_covers.js` | Quét album thiếu cover và fetch từ Spotify service | `apps/backend` | Có | Có | Quét theo batch, không lọc theo artist. |
| `apps/backend/scripts/fetch/fetch_song_covers.js` | Quét song thiếu cover và fetch từ Spotify service | `apps/backend` | Có | Có | Quét theo batch. |
| `apps/backend/scripts/fetch/fetch_selected_album_covers.js` | Tải local cover cho album chọn lọc từ `cover_url` hiện có | `apps/backend` | Có | Có | Hữu ích sau import CSV có `Cover_URL`. |
| `apps/backend/scripts/lyrics/crawlKpopLyricsFromLrclib.js` | Crawl lyrics KPOP từ LRCLIB ra raw JSON | `apps/backend` | Không | Có | `--resetCursor=true` chỉ reset rồi thoát; chạy crawl bằng lệnh riêng. |
| `apps/backend/scripts/lyrics/crawlLyricsFromLrclib.js` | Crawler lyrics tổng quát, hỗ trợ `--file` | `apps/backend` | Không | Có | Có fallback NhacCuaTui lyrics. |
| `apps/backend/scripts/lyrics/normalizeLyrics.js` | Normalize raw lyrics JSON | `apps/backend` | Không | Có | Chạy sau crawl. |
| `apps/backend/scripts/lyrics/importLyricsToDb.js` | Import lyrics vào bảng `songs` | `apps/backend` | Có | Không | Ghi `lyrics`, `synced_lyrics`, provider fields. |
| `apps/backend/scripts/maintenance/analyzeSongAudioFeatures.js` | Gọi AI service phân tích audio features | `apps/backend` | Có | Không | Cần AI service ở `AI_SERVICE_URL`, mặc định `http://localhost:8000`. |
| `apps/backend/scripts/maintenance/exportSongAudioFeatures.js` | Export audio features ra CSV | `apps/backend` | Không | Có | Ghi vào `apps/backend/exports`. |

## 1. Bước 1 - Lấy metadata từ link

Script chính:

```powershell
cd D:\CaNhan\Luan_Van\apps\ai-service
.\.venv\Scripts\Activate.ps1
py scripts/download/metadata/1_get_metadata.py
```

Kết quả mong muốn của pipeline chuẩn:

```text
apps/backend/uploads/music/nct_metadata_pending.csv
```

Lưu ý audit hiện tại: `1_get_metadata.py` đang ghi:

```text
apps/backend/uploads/music/nct_metadata_pending1.csv
```

Trong khi bước tải và import đang dùng:

```text
apps/backend/uploads/music/nct_metadata_pending.csv
```

Trước khi chạy bước 2, cần đảm bảo CSV bạn muốn xử lý nằm đúng tên `nct_metadata_pending.csv`, hoặc chỉnh biến `CSV_FILE` trong `1_get_metadata.py` cho thống nhất.

CSV nên có các cột:

```text
Title,
Main_Artist,
Original_Artist,
Album,
Genre,
Market,
Duration_Sec,
Source,
Source_ID,
Source_URL hoặc YouTube_URL,
Cover_URL,
File_Path,
Audio_URL,
Download_Status
```

`Download_Status` ban đầu có thể là `pending`.

## 2. Bước 2 - Tải file nhạc từ metadata CSV

Script chính:

```powershell
cd D:\CaNhan\Luan_Van\apps\ai-service
.\.venv\Scripts\Activate.ps1
py scripts/download/metadata/ytb_download_from_metadata.py
```

Script này gọi:

```text
scripts/download/metadata/2_download_from_csv.py
```

File audio phải nằm theo cấu trúc:

```text
apps/backend/uploads/music/final_songs/<MarketFolder>/<Artist>/<Album>/<Title>.mp3
```

Ví dụ:

```text
apps/backend/uploads/music/final_songs/Kpop/BLACKPINK/THE ALBUM/How You Like That.mp3
```

Yêu cầu vận hành:

- Nếu file đã tồn tại, script phải skip và không tải lại.
- Nếu nguồn chặn hoặc lỗi mạng, không được xem là thành công giả.
- Với YouTube Music, có thể cần cookie hoặc browser login.
- Với NhacCuaTui, script hiện có logic lấy stream từ metadata page thay vì dùng yt-dlp trực tiếp.

## 3. Bước 3 - Cập nhật Download_Status trong CSV

Chạy từ backend:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/maintenance/updateMetadataDownloadStatus.js --file=uploads/music/nct_metadata_pending.csv
```

Ý nghĩa:

- File audio tồn tại thật trên ổ cứng: `Download_Status=downloaded`.
- File thiếu: `Download_Status=missing_file`.
- Nếu `Audio_URL` lệch với `File_Path`, script sẽ chuẩn hóa lại theo `File_Path`.
- Import DB chỉ nên nhận dòng `downloaded`.

## 4. Bước 4 - Import bài hát vào database

Chạy:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/maintenance/importSongsFromMetadataCsv.js --file=uploads/music/nct_metadata_pending.csv
```

Script import vào:

- `genres`
- `artists`
- `albums`
- `songs`

Script chống trùng bằng:

- `songs.audio_url`
- hoặc `title + artist_id + album_id`

Kiểm tra sau import theo artist:

```sql
SELECT
s.id,
s.title,
a.name AS artist,
g.name AS genre,
s.market,
s.audio_url,
s.created_at
FROM songs s
JOIN artists a ON a.id = s.artist_id
LEFT JOIN genres g ON g.id = s.genre_id
WHERE a.name LIKE '%BLACKPINK%'
ORDER BY s.created_at DESC
LIMIT 50;
```

Kiểm tra bài mới theo thời gian:

```sql
SELECT
s.id,
s.title,
a.name AS artist,
g.name AS genre,
s.market,
s.audio_url,
s.created_at
FROM songs s
JOIN artists a ON a.id = s.artist_id
LEFT JOIN genres g ON g.id = s.genre_id
WHERE s.created_at >= NOW() - INTERVAL 30 MINUTE
ORDER BY s.created_at DESC;
```

## 5. Bước 5 - Kiểm tra audio_url phát được

Ví dụ URL:

```text
http://localhost:3000/uploads/music/final_songs/Kpop/BLACKPINK/THE ALBUM/How You Like That.mp3
```

Điều kiện:

- Backend phải đang chạy.
- Express static `/uploads` phải hoạt động.
- `audio_url` trong DB phải bắt đầu bằng `/uploads/...`.
- File vật lý phải tồn tại trong `apps/backend/uploads`.

## 6. Bước 6 - Lấy bìa album/bài hát

Các script cover hiện có nằm trong:

```text
apps/backend/scripts/fetch
```

Fetch album thiếu cover hàng loạt:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/fetch/fetch_album_covers.js
```

Fetch song thiếu cover hàng loạt:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/fetch/fetch_song_covers.js
```

Fetch cover cho album chọn lọc, dùng `cover_url` hiện có trong DB và tải về local:

```powershell
node scripts/fetch/fetch_selected_album_covers.js --artist=BLACKPINK --albums="THE ALBUM,DEADLINE,BORN PINK"
```

Ghi chú:

- `fetch_album_covers.js` và `fetch_song_covers.js` dùng `songImage.service.js`, có thể gọi Spotify API để tìm cover.
- `fetch_selected_album_covers.js` phù hợp khi CSV đã có `Cover_URL` remote và chỉ muốn local hóa một số album.
- Không overwrite cover local đã có nếu script thấy `cover_url` bắt đầu bằng `/uploads/img/albums/`.

SQL kiểm tra:

```sql
SELECT
s.id,
s.title,
s.cover_url,
al.cover_url AS album_cover
FROM songs s
LEFT JOIN albums al ON al.id = s.album_id
ORDER BY s.created_at DESC
LIMIT 20;
```

## 7. Bước 7 - Lấy lời bài hát

Hiện project chưa có script đơn:

```text
apps/backend/scripts/maintenance/fetchSongLyrics.js
```

Luồng lyrics hiện có là pipeline 3 bước trong:

```text
apps/backend/scripts/lyrics
```

Với KPOP:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/lyrics/crawlKpopLyricsFromLrclib.js --resetCursor=true
node scripts/lyrics/crawlKpopLyricsFromLrclib.js --limit=30 --force=true
node scripts/lyrics/normalizeLyrics.js --group=kpop --force=true
node scripts/lyrics/importLyricsToDb.js --group=kpop --force=true
```

Lưu ý: `--resetCursor=true` chỉ reset cursor rồi thoát, không crawl lyrics. Phải chạy lệnh crawl riêng sau đó.

Với crawler tổng quát có thể truyền file CSV:

```powershell
node scripts/lyrics/crawlLyricsFromLrclib.js --file=apps/backend/uploads/music/nct_metadata_pending.csv --group=kpop --limit=30 --force=true
node scripts/lyrics/normalizeLyrics.js --group=kpop --force=true
node scripts/lyrics/importLyricsToDb.js --group=kpop --force=true
```

Các cột lyrics trong `songs`:

- `lyrics`
- `synced_lyrics`
- `lyrics_sync_type`
- `lyrics_provider`
- `lyrics_provider_id`
- `lyrics_updated_at`

SQL kiểm tra:

```sql
SELECT
s.id,
s.title,
a.name AS artist,
s.lyrics_sync_type,
s.lyrics_provider,
s.lyrics_provider_id,
s.lyrics_updated_at,
LENGTH(s.lyrics) AS lyrics_len,
LENGTH(s.synced_lyrics) AS synced_len
FROM songs s
JOIN artists a ON a.id = s.artist_id
WHERE s.lyrics IS NOT NULL OR s.synced_lyrics IS NOT NULL
ORDER BY s.lyrics_updated_at DESC
LIMIT 20;
```

Cần bổ sung nếu muốn đơn giản hóa: tạo script `scripts/maintenance/fetchSongLyrics.js` nhận `--market`, `--limit`, `--songId`, `--force` và ghi trực tiếp vào `songs`.

## 8. Bước 8 - Phân tích audio features cho AI Playlist

Chạy AI service trước:

```powershell
cd D:\CaNhan\Luan_Van\apps\ai-service
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Sau đó chạy backend script:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/maintenance/analyzeSongAudioFeatures.js --market=KPOP --limit=50
```

Nếu muốn phân tích lại:

```powershell
node scripts/maintenance/analyzeSongAudioFeatures.js --market=KPOP --limit=50 --force
```

Lưu ý:

- Script gọi `AI_SERVICE_URL`, mặc định `http://localhost:8000`.
- Không dùng `--force` hàng loạt nếu không cần.
- File `audio_url` phải trỏ tới file thật trong `apps/backend/uploads`.

SQL kiểm tra:

```sql
SELECT
s.title,
s.market,
saf.bpm,
saf.energy,
saf.tempo_level,
saf.mood,
saf.vibe,
saf.analyzed_at
FROM song_audio_features saf
JOIN songs s ON s.id = saf.song_id
ORDER BY saf.analyzed_at DESC
LIMIT 20;
```

## 9. Bước 9 - Xuất file kiểm tra audio features

```powershell
cd D:\CaNhan\Luan_Van\apps\backend
node scripts/maintenance/exportSongAudioFeatures.js
node scripts/maintenance/exportSongAudioFeatures.js --market=KPOP
node scripts/maintenance/exportSongAudioFeatures.js --market=VPOP
node scripts/maintenance/exportSongAudioFeatures.js --market=USUK
```

File xuất ra:

```text
apps/backend/exports/song_audio_features_<MARKET>_<YYYY-MM-DD>.csv
```

## 10. Bước 10 - Test trên giao diện

Checklist:

- Search tên bài mới.
- Mở trang artist mới.
- Mở album mới.
- Bấm phát bài mới.
- Kiểm tra cover bài hát và album.
- Kiểm tra lyrics/karaoke nếu có.
- Test AI Playlist prompt:
  - `Kpop nhẹ nhàng`
  - `nhạc cháy để tập gym`
  - `nhạc suy lúc 2 giờ sáng`

## Bảng tóm tắt lệnh chạy

| Mục đích | Chạy ở thư mục | Lệnh | Kết quả |
| -------- | -------------- | ---- | ------- |
| Lấy metadata | `apps/ai-service` | `py scripts/download/metadata/1_get_metadata.py` | Tạo CSV metadata trong `apps/backend/uploads/music`; kiểm tra tên file `nct_metadata_pending.csv` vs `nct_metadata_pending1.csv`. |
| Tải từ metadata | `apps/ai-service` | `py scripts/download/metadata/ytb_download_from_metadata.py` | Tải `.mp3` vào `apps/backend/uploads/music/final_songs/<MarketFolder>/...`. |
| Cập nhật status CSV | `apps/backend` | `node scripts/maintenance/updateMetadataDownloadStatus.js --file=uploads/music/nct_metadata_pending.csv` | Set `downloaded` hoặc `missing_file`, chuẩn hóa `Audio_URL`. |
| Import DB | `apps/backend` | `node scripts/maintenance/importSongsFromMetadataCsv.js --file=uploads/music/nct_metadata_pending.csv` | Insert/update nhẹ `genres`, `artists`, `albums`, `songs`. |
| Lấy cover | `apps/backend` | `node scripts/fetch/fetch_selected_album_covers.js --artist=BLACKPINK --albums="THE ALBUM,DEADLINE,BORN PINK"` | Tải cover album chọn lọc về `uploads/img/albums` và cập nhật DB. |
| Lấy cover hàng loạt | `apps/backend` | `node scripts/fetch/fetch_album_covers.js` hoặc `node scripts/fetch/fetch_song_covers.js` | Fetch album/song thiếu cover. |
| Lấy lyrics KPOP | `apps/backend` | `node scripts/lyrics/crawlKpopLyricsFromLrclib.js --limit=30 --force=true` | Tạo raw lyrics JSON. |
| Normalize lyrics | `apps/backend` | `node scripts/lyrics/normalizeLyrics.js --group=kpop --force=true` | Tạo processed lyrics JSON. |
| Import lyrics | `apps/backend` | `node scripts/lyrics/importLyricsToDb.js --group=kpop --force=true` | Ghi lyrics vào bảng `songs`. |
| Phân tích audio features | `apps/backend` | `node scripts/maintenance/analyzeSongAudioFeatures.js --market=KPOP --limit=50` | Ghi `song_audio_features`; cần AI service. |
| Export audio features | `apps/backend` | `node scripts/maintenance/exportSongAudioFeatures.js --market=KPOP` | Tạo CSV trong `apps/backend/exports`. |
| Kiểm tra DB | MySQL client | Chạy các SQL ở các mục trên | Xác nhận bài, cover, lyrics, audio features. |

## Lỗi thường gặp

### 1. YouTube/NCT chặn tải hoặc yêu cầu đăng nhập

Dấu hiệu: log có `Sign in to confirm you're not a bot`, `unsupported URL`, lỗi 403/429, hoặc không lấy được stream.

Cách xử lý:

- Với YouTube: dùng cookie/browser login nếu cần.
- Với NhacCuaTui: ưu tiên luồng metadata CSV và stream parser hiện có.
- Không xem dòng lỗi là tải thành công nếu file `.mp3` không tồn tại.

### 2. CSV còn `Download_Status=pending` nên import bị skip

Import script chỉ nhận dòng `downloaded`.

Chạy:

```powershell
node scripts/maintenance/updateMetadataDownloadStatus.js --file=uploads/music/nct_metadata_pending.csv
```

### 3. `File_Path` và `Audio_URL` lệch nhau

Ví dụ `File_Path` là:

```text
BLACKPINK/THE ALBUM/Bet You Wanna.mp3
```

nhưng `Audio_URL` bị thiếu khoảng trắng hoặc sai folder. Chạy update status để ưu tiên chuẩn hóa `Audio_URL` theo `File_Path`.

### 4. Path bị lặp `music/final_songs/Kpop/music/final_songs/Kpop`

Nguyên nhân: nối `BASE_DOWNLOAD_DIR + MarketFolder + File_Path` trong khi `File_Path` đã chứa `music/final_songs/Kpop`.

Script hiện tại đã có normalize path, nhưng vẫn cần kiểm tra CSV cũ trước khi import.

### 5. Import xong không thấy bài mới vì import nhầm CSV

Kiểm tra log dòng:

```text
Reading CSV: ...
```

Đặc biệt lưu ý mismatch hiện tại:

```text
1_get_metadata.py -> nct_metadata_pending1.csv
download/import -> nct_metadata_pending.csv
```

### 6. `audio_url` không phát được vì backend chưa serve uploads

Kiểm tra:

- Backend đang chạy ở `localhost:3000`.
- URL bắt đầu bằng `/uploads/...`.
- File thật nằm trong `apps/backend/uploads/...`.

### 7. Lyrics không tìm thấy do title bị dính `Official MV`

Crawler đã có bước clean title, nhưng nếu title quá nhiễu cần sửa metadata hoặc dùng `--force` crawl lại sau khi normalize title trong CSV.

### 8. Audio features không chạy vì AI service chưa bật

`analyzeSongAudioFeatures.js` gọi:

```text
http://localhost:8000/api/audio/analyze
```

Cần bật AI service trước khi chạy analyzer.

### 9. `market` bị `OTHER` nên filter KPOP/VPOP/USUK không ra

Kiểm tra DB:

```sql
SELECT market, COUNT(*) FROM songs GROUP BY market;
```

Nếu bài bị `OTHER`, kiểm tra cột `Market` trong CSV trước khi import.

## Những điểm cần kiểm tra thủ công

- Thống nhất tên CSV giữa `1_get_metadata.py` và các bước sau: `nct_metadata_pending1.csv` hay `nct_metadata_pending.csv`.
- Nếu dùng lại script legacy `download_music.py`, cần sửa `CSV_FILE` thành file CSV cụ thể thay vì thư mục.
- Chưa có script đơn `scripts/maintenance/fetchSongLyrics.js`; hiện lyrics phải chạy pipeline `crawl -> normalize -> import`.
- Các script YouTube trực tiếp có thể cần cookie hoặc đóng trình duyệt nếu dùng `cookiesfrombrowser`.
