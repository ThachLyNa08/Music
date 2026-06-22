# Cây thư mục MusicFlow

Tài liệu này mô tả cấu trúc thư mục chính của project `D:\CaNhan\Luan_Van` và chức năng của từng nhóm file. Các thư mục sinh tự động như `node_modules`, `.venv`, `dist`, `__pycache__` được ghi chú nhưng không bung chi tiết vì không nên chỉnh tay.

## Tổng quan root project

```text
D:\CaNhan\Luan_Van/
├─ apps/                         # Toàn bộ source ứng dụng chính
│  ├─ backend/                    # Express API, DB, Socket.IO, upload runtime, script backend
│  ├─ frontend/                   # Vue/Vite frontend MusicFlow
│  └─ ai-service/                 # FastAPI service, xử lý AI/audio/karaoke, script tải nhạc
├─ database/                      # Schema, migration, seed SQL và tài liệu DB
├─ datasets/                      # Dữ liệu raw/processed phục vụ import, lyrics, training, kiểm tra
├─ docs/                          # Tài liệu kỹ thuật, workflow, báo cáo, hướng dẫn vận hành
├─ storage/                       # Lưu trữ thủ công ngoài runtime upload
├─ uploads/                       # Upload cấp root nếu có; runtime chính đang dùng apps/backend/uploads
├─ agent-skills/                  # Skill nội bộ cho agent/codex theo từng mảng MusicFlow
├─ AGENTS.md                      # Ghi chú layout project và quy tắc agent
├─ docker-compose.yml             # Cấu hình dịch vụ hạ tầng nếu chạy bằng Docker
├─ README.md                      # Tài liệu tổng quan project
└─ .gitignore                     # Quy tắc bỏ qua file khi commit
```

## `apps/`

```text
apps/
├─ backend/                       # API server chính
├─ frontend/                      # Web client
└─ ai-service/                    # Dịch vụ AI/audio phụ trợ
```

`apps` là nơi chứa ba ứng dụng chạy chính. Khi thêm nhạc mới, thường dùng cả `ai-service` và `backend`: `ai-service` để lấy metadata/tải file, `backend` để cập nhật CSV, import DB, lấy cover, lyrics và phân tích audio features.

## `apps/backend/`

```text
apps/backend/
├─ src/                           # Source Express API
│  ├─ config/                     # Cấu hình DB, Redis, OAuth, biến môi trường
│  ├─ controllers/                # Xử lý request HTTP theo route
│  ├─ middleware/                 # Auth, upload, validate, error handling
│  ├─ models/                     # Model/helper dữ liệu nếu có
│  ├─ routes/                     # Định nghĩa endpoint API
│  ├─ services/                   # Business logic: Spotify, cover, lyrics, audio feature, recommendation
│  ├─ utils/                      # Helper chung: normalize URL, format, xử lý ảnh
│  ├─ app.js                      # Tạo Express app, gắn middleware/routes/static uploads
│  └─ server.js                   # Entry point chạy backend
├─ scripts/                       # Script vận hành, maintenance, import, audit
├─ uploads/                       # Runtime uploads dùng bởi app, không di chuyển nếu chưa audit DB
├─ exports/                       # File CSV/report do script backend xuất ra
├─ migrations/                    # Migration riêng trong backend nếu có
├─ data/                          # Dữ liệu phụ trợ backend
├─ node_modules/                  # Dependency Node, sinh tự động
├─ .env                           # Biến môi trường local backend
├─ .env.example                   # Mẫu env
├─ package.json                   # Script npm và dependency backend
└─ package-lock.json              # Lock dependency
```

### `apps/backend/src/`

```text
src/
├─ config/
│  └─ database.js                 # MySQL pool, dùng bởi API và scripts
├─ controllers/
│  ├─ album.controller.js         # API chi tiết album, lưu album vào thư viện
│  ├─ artist.controller.js        # API artist, discography, albums/singles, popular songs
│  ├─ song.controller.js          # API songs, search, upload/admin song, detail
│  ├─ lyrics.controller.js        # API lyrics theo song
│  ├─ chart.controller.js         # API bảng xếp hạng
│  ├─ user.controller.js          # API user/profile/history/library
│  ├─ admin.controller.js         # API dashboard/admin
│  └─ ...                         # Các controller khác theo domain
├─ routes/
│  ├─ album.routes.js             # Route /api/albums
│  ├─ artist.routes.js            # Route /api/artists
│  ├─ song.routes.js              # Route /api/songs
│  ├─ lyrics.routes.js            # Route /api/lyrics/song/:songId
│  └─ ...                         # Các route khác
├─ services/
│  ├─ audioFeature.service.js     # Gọi AI service để phân tích BPM, mood, vibe, energy
│  ├─ songImage.service.js        # Fetch cover bài hát/album, tải ảnh về uploads/img
│  ├─ lyrics.service.js           # Parse LRC, trả lyrics cho frontend
│  ├─ spotify.service.js          # Tương tác Spotify API
│  ├─ nhaccuatuiLyrics.service.js # Fallback lấy lyrics từ NhacCuaTui nếu có
│  ├─ scheduler.service.js        # Cron/background task
│  └─ ...                         # Các service khác
├─ middleware/
│  └─ ...                         # Auth, upload, validate, xử lý lỗi
├─ utils/
│  └─ imageUrl.util.js            # Chuẩn hóa URL ảnh/cover/avatar
├─ app.js                         # Gắn routes, static uploads, CORS
└─ server.js                      # Chạy HTTP server
```

### `apps/backend/scripts/`

```text
scripts/
├─ maintenance/                   # Script vận hành chính sau khi có metadata/audio
│  ├─ updateMetadataDownloadStatus.js
│  │                                # Đọc CSV metadata, kiểm tra file audio thật,
│  │                                # chuẩn hóa Audio_URL, set Download_Status
│  ├─ importSongsFromMetadataCsv.js
│  │                                # Import CSV vào genres/artists/albums/songs,
│  │                                # chống trùng và sync total_tracks album
│  ├─ analyzeSongAudioFeatures.js  # Gọi AI service phân tích audio features
│  └─ exportSongAudioFeatures.js   # Xuất song_audio_features ra CSV
├─ fetch/                         # Script lấy ảnh/metadata bổ sung
│  ├─ fetch_album_covers.js        # Quét album thiếu cover, tìm/tải cover
│  ├─ fetch_song_covers.js         # Quét song thiếu cover, tìm/tải cover
│  ├─ fetch_selected_album_covers.js
│  │                                # Tải cover local cho album chọn lọc từ cover_url hiện có
│  ├─ fetch_all_song_album_covers.js
│  │                                # Quét cả song và album theo batch
│  └─ fetch_artist_avatars.js      # Lấy avatar nghệ sĩ
├─ lyrics/                        # Pipeline lyrics hiện có
│  ├─ crawlKpopLyricsFromLrclib.js # Crawl lyrics KPOP từ LRCLIB ra raw JSON
│  ├─ crawlLyricsFromLrclib.js     # Crawler tổng quát, có --file và fallback NCT
│  ├─ normalizeLyrics.js           # Normalize raw lyrics thành processed JSON
│  └─ importLyricsToDb.js          # Ghi lyrics/synced_lyrics vào bảng songs
├─ migrations/                    # Script migration schema backend
├─ import/                        # Script import dữ liệu cũ/ngoài workflow mới
├─ repair/                        # Script sửa dữ liệu cũ: audio path, album type, backup repair
├─ audit/                         # Script kiểm tra chất lượng dữ liệu
├─ playlist/                      # Seed/cleanup playlist hệ thống
├─ admin/                         # Script admin như đổi password
├─ health/                        # Test DB/health check
├─ reports/                       # Output report dạng text
└─ README.md                      # Ghi chú scripts backend
```

### `apps/backend/uploads/`

```text
uploads/
├─ music/
│  ├─ final_songs/
│  │  ├─ Kpop/
│  │  │  ├─ BLACKPINK/
│  │  │  │  ├─ THE ALBUM/
│  │  │  │  ├─ BORN PINK/
│  │  │  │  └─ DEADLINE/
│  │  │  ├─ BTS/
│  │  │  ├─ TWICE/
│  │  │  └─ ...                   # Artist folder KPOP khác
│  │  ├─ Vpop/                    # Artist/album VPOP
│  │  └─ USUK/                    # Artist/album USUK
│  ├─ nct_metadata_pending.csv    # CSV metadata chính cho pipeline mới
│  ├─ nct_metadata_pending1.csv   # CSV metadata phụ; cần thống nhất nếu dùng
│  ├─ music_database_kpop*.csv    # CSV cũ/KPOP
│  ├─ music_database_vpop.csv     # CSV cũ/VPOP
│  └─ music_database_usuk.csv     # CSV cũ/USUK
├─ img/
│  ├─ albums/                     # Cover album local, dùng /uploads/img/albums/...
│  └─ ...                         # Ảnh local khác
├─ images/                        # Upload ảnh khác
├─ audio/                         # Upload audio khác nếu có
├─ songs/                         # Output cũ của script legacy
├─ stems/                         # Stem/karaoke output
└─ playlist_cover/                # Cover playlist
```

`apps/backend/uploads` là thư mục runtime quan trọng nhất cho media. Không đổi đường dẫn hoặc di chuyển thư mục này nếu chưa audit toàn bộ `audio_url`, `cover_url` trong database.

## `apps/ai-service/`

```text
apps/ai-service/
├─ app/                           # FastAPI service
│  ├─ api/                         # API routers, ví dụ /api/audio/analyze
│  ├─ core/                        # Cấu hình lõi nếu có
│  ├─ models/                      # Pydantic model/schema nếu có
│  ├─ services/                    # Xử lý audio feature, AI, karaoke
│  └─ main.py                      # Entry point FastAPI
├─ scripts/                        # Script Python hỗ trợ tải nhạc/karaoke
├─ exports/                        # Output CSV/report từ ai-service
├─ .venv/                          # Virtualenv Python, sinh tự động
├─ .env                            # Env local cho ai-service
└─ requirements.txt                # Dependency Python
```

### `apps/ai-service/app/`

```text
app/
├─ main.py                         # Tạo FastAPI app, gắn router audio analysis
├─ api/
│  └─ audio_features.py            # Endpoint /api/audio/analyze nhận file_path
├─ services/
│  └─ audio_feature_extractor.py   # Dùng librosa/logic audio để trích BPM, mood, energy
├─ models/                         # Schema nếu có
└─ core/                           # Cấu hình/lõi nếu có
```

Backend `audioFeature.service.js` gọi endpoint:

```text
http://localhost:8000/api/audio/analyze
```

Vì vậy phải bật ai-service trước khi chạy `analyzeSongAudioFeatures.js`.

### `apps/ai-service/scripts/`

```text
scripts/
├─ README.md                       # Hướng dẫn nhóm script ai-service
├─ download/
│  ├─ metadata/
│  │  ├─ 1_get_metadata.py         # Lấy metadata từ link nguồn ra CSV
│  │  ├─ 2_download_from_csv.py    # Tải audio dựa trên CSV metadata
│  │  ├─ ytb_download_from_metadata.py
│  │  │                            # Wrapper gọi 2_download_from_csv.py
│  │  └─ download_unified.py       # Script unified cũ, không phải luồng chính
│  ├─ youtube/
│  │  ├─ ytb_dl_kpop.py            # Tải KPOP trực tiếp bằng yt-dlp
│  │  ├─ youtube_downloader_kpop.py
│  │  ├─ youtube_downloader_vpop.py
│  │  ├─ youtube_downloader_usuk.py
│  │  └─ youtube_auto_api.py       # Tìm playlist qua YouTube Music API
│  └─ legacy/
│     ├─ auto_download.py          # Script cũ tải từ CSV Spotify
│     └─ download_music.py         # Script cũ subprocess yt-dlp
└─ karaoke/
   ├─ batch_preprocess_karaoke.py  # Batch tách stem/karaoke cho bài đủ điều kiện
   └─ export_karaoke_completed.py  # Export danh sách bài karaoke đã xử lý
```

Nhóm script chính cho thêm nhạc mới là:

```text
download/metadata/1_get_metadata.py
download/metadata/ytb_download_from_metadata.py
```

Nhóm `download/youtube` dùng khi muốn tải trực tiếp từ YouTube Music theo playlist/artist, không qua metadata CSV chuẩn.

Nhóm `download/legacy` chỉ giữ tham khảo.

## `apps/frontend/`

```text
apps/frontend/
├─ src/
│  ├─ api/                         # Wrapper gọi backend API
│  ├─ assets/                      # Asset frontend
│  ├─ components/                  # Component Vue tái sử dụng
│  ├─ composables/                 # Logic Vue Composition API tái sử dụng
│  ├─ layouts/                     # Layout user/admin
│  ├─ router/                      # Vue Router
│  ├─ store/                       # Store cũ nếu có
│  ├─ stores/                      # Pinia/store hiện đại nếu có
│  ├─ utils/                       # Helper frontend
│  ├─ views/                       # Page-level views
│  ├─ App.vue                      # Root component
│  ├─ main.js                      # Entry point frontend
│  └─ style.css                    # CSS global
├─ public/                         # Static public assets
├─ dist/                           # Build output, sinh tự động
├─ node_modules/                   # Dependency Node, sinh tự động
├─ index.html                      # HTML entry Vite
├─ vite.config.js                  # Cấu hình Vite
├─ tailwind.config.js              # Cấu hình Tailwind
├─ postcss.config.js               # Cấu hình PostCSS
├─ package.json                    # Script npm frontend
└─ package-lock.json               # Lock dependency
```

### `apps/frontend/src/`

```text
src/
├─ api/
│  ├─ lyrics.js                    # Gọi API lyrics theo song
│  └─ ...                          # API client khác
├─ components/
│  ├─ player/                      # Player, lyrics panel, fullscreen player
│  ├─ common/                      # MediaCard, SongRow, ArtistCard...
│  ├─ home/                        # Component trang home
│  └─ ...                          # Component theo module
├─ views/
│  ├─ artist/                      # Artist page, discography
│  ├─ album/                       # Album detail
│  ├─ song/                        # Song detail, lyrics/karaoke display
│  ├─ library/                     # Library, liked songs, playlist detail
│  ├─ search/                      # Search page
│  ├─ admin/                       # Admin views
│  └─ ...                          # Các page khác
├─ router/                         # Route mapping
├─ stores/                         # State management
└─ utils/                          # Helper format URL, duration, image...
```

Frontend không tự import nhạc. Nó chỉ hiển thị dữ liệu đã có trong DB và media đã serve qua backend `/uploads/...`.

## `database/`

```text
database/
├─ migrations/                     # SQL migration/schema thay đổi DB
├─ seeds/                          # Dữ liệu seed nếu có
├─ schema*.sql                     # Schema hoặc snapshot schema
└─ ...                             # Tài liệu DB khác
```

Thư mục này dùng khi cần tạo hoặc cập nhật schema. Trong workflow thêm nhạc mới bình thường, không chỉnh schema.

## `datasets/`

```text
datasets/
├─ raw/
│  ├─ lyrics/                      # Raw lyrics crawl từ LRCLIB/NhacCuaTui
│  │  ├─ lrclib/
│  │  ├─ nhaccuatui/
│  │  ├─ failed/
│  │  └─ state/
│  └─ ...                          # Dataset thô khác
├─ processed/
│  ├─ lyrics/                      # Lyrics đã normalize, chờ import DB
│  └─ ...                          # Dataset đã xử lý
└─ ...                             # Dataset phục vụ luận văn/import/training
```

Lyrics pipeline hiện ghi raw/processed JSON vào `datasets`, sau đó mới import vào `songs`.

## `docs/`

```text
docs/
├─ music-import-workflow.md        # Quy trình thêm nhạc mới vào MusicFlow
├─ project-directory-tree.md       # Tài liệu cây thư mục này
└─ ...                             # Báo cáo, thiết kế, ghi chú luận văn
```

`docs` là nơi nên đặt hướng dẫn vận hành để tránh quên thứ tự chạy script.

## `storage/`

```text
storage/
└─ ...                             # Lưu trữ thủ công, không phải runtime chính của app
```

Dùng cho file lưu tay, backup, dữ liệu ngoài runtime. Không thay thế cho `apps/backend/uploads` khi app cần phát audio/ảnh.

## `agent-skills/`

```text
agent-skills/
├─ musicflow-developer/
├─ musicflow-frontend-design/
├─ musicflow-web-components/
├─ musicflow-theme-factory/
├─ musicflow-testing/
└─ musicflow-thesis-report/
```

Nhóm kỹ năng nội bộ cho agent/codex theo từng vai trò. Các `SKILL.md` hiện được để dành cho giai đoạn sau.

## Cây workflow thêm nhạc mới

```text
1. Lấy metadata
   apps/ai-service/scripts/download/metadata/1_get_metadata.py
   └─ tạo CSV trong apps/backend/uploads/music/

2. Tải audio từ metadata CSV
   apps/ai-service/scripts/download/metadata/ytb_download_from_metadata.py
   └─ ghi .mp3 vào apps/backend/uploads/music/final_songs/<Market>/<Artist>/<Album>/

3. Cập nhật trạng thái CSV
   apps/backend/scripts/maintenance/updateMetadataDownloadStatus.js
   └─ set Download_Status = downloaded | missing_file

4. Import DB
   apps/backend/scripts/maintenance/importSongsFromMetadataCsv.js
   └─ ghi genres, artists, albums, songs

5. Lấy cover
   apps/backend/scripts/fetch/fetch_selected_album_covers.js
   apps/backend/scripts/fetch/fetch_album_covers.js
   apps/backend/scripts/fetch/fetch_song_covers.js
   └─ ghi cover_url và file ảnh local trong uploads/img

6. Lấy lyrics
   apps/backend/scripts/lyrics/crawlKpopLyricsFromLrclib.js
   apps/backend/scripts/lyrics/normalizeLyrics.js
   apps/backend/scripts/lyrics/importLyricsToDb.js
   └─ ghi lyrics, synced_lyrics vào songs

7. Phân tích audio features
   apps/backend/scripts/maintenance/analyzeSongAudioFeatures.js
   └─ gọi apps/ai-service API và ghi song_audio_features

8. Export kiểm tra
   apps/backend/scripts/maintenance/exportSongAudioFeatures.js
   └─ ghi CSV vào apps/backend/exports

9. Test frontend
   apps/frontend/src/views/search
   apps/frontend/src/views/artist
   apps/frontend/src/views/album
   apps/frontend/src/components/player
   └─ kiểm tra search, album, play audio, cover, lyrics, AI playlist
```

## Thư mục không nên chỉnh tay

```text
apps/backend/node_modules/
apps/frontend/node_modules/
apps/ai-service/.venv/
apps/frontend/dist/
**/__pycache__/
.git/
```

Các thư mục này sinh tự động từ dependency, build hoặc Python runtime. Nếu lỗi dependency, xử lý bằng lệnh cài đặt tương ứng thay vì sửa file bên trong.

## Ghi chú vận hành quan trọng

- `apps/backend/uploads` là runtime media chính. Không đổi đường dẫn nếu chưa audit DB.
- `apps/backend/uploads/music/final_songs` phải giữ cấu trúc `MarketFolder/Artist/Album/Title.mp3`.
- `audio_url` trong DB phải bắt đầu bằng `/uploads/...`.
- Metadata CSV đang có cả `nct_metadata_pending.csv` và `nct_metadata_pending1.csv`; cần thống nhất file trước khi chạy pipeline.
- Lyrics hiện chưa có script đơn trong `scripts/maintenance`; đang chạy pipeline trong `scripts/lyrics`.
- Audio features cần `apps/ai-service` đang chạy ở `AI_SERVICE_URL`, mặc định `http://localhost:8000`.
