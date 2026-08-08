# MusicFlow

MusicFlow is a music streaming and recommendation project with a Vue frontend, an Express backend, and a FastAPI AI service.

## Project Structure

```text
Luan_Van/
+-- apps/
|   +-- backend/       # Express API, Socket.IO, backend scripts, runtime uploads
|   +-- frontend/      # Vue/Vite frontend
|   +-- ai-service/    # FastAPI AI service and helper scripts
+-- database/
|   +-- schema/
|   +-- migrations/
|   +-- seeds/
+-- datasets/
|   +-- raw/
|   +-- processed/
+-- docs/
|   +-- thesis/
|   +-- design/
|   +-- reports/
+-- storage/
|   +-- images/
+-- agent-skills/
+-- AGENTS.md
+-- docker-compose.yml
+-- README.md
```

## Run Backend

```powershell
cd apps/backend
npm run dev
```

## Run Frontend

```powershell
cd apps/frontend
npm run dev
```

## Run AI Service

For demo or stem/karaoke separation, run Uvicorn without `--reload` so the Demucs process is not interrupted by the file watcher:

```powershell
cd apps/ai-service
.\.venv\Scripts\Activate.ps1    
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level debug
```

When developing API code and reload is needed, restrict the watcher to the app source folder. Do not watch output/cache/stems/uploads/exports while separating stems:

```powershell
cd apps/ai-service
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app --log-level debug
```

## Git Notes

Do not commit `.env`, `node_modules`, `dist`, runtime uploads, `storage`, generated logs, or music/audio files. Runtime media is currently kept under `apps/backend/uploads/` so existing app and database paths continue to work.


## Crash

netstat -ano | findstr :3000
taskkill /PID [PID] /F

## Bật scheduler thật

Trong .env backend:

ENABLE_RECOMMENDATION_SCHEDULER=true
RECOMMENDATION_SCHEDULER_TEST_MODE=false

Hoặc bỏ hẳn dòng test mode.

Test nhanh scheduler

Chỉ dùng khi test:

ENABLE_RECOMMENDATION_SCHEDULER=true
RECOMMENDATION_SCHEDULER_TEST_MODE=true

Test xong phải tắt lại:

RECOMMENDATION_SCHEDULER_TEST_MODE=false


## Song Semantic Profiles Pipeline

### 1. Mục đích

`song_semantic_profiles` là lớp dữ liệu ngữ nghĩa cho từng bài hát trong MusicFlow. Bảng này dùng để bổ sung thông tin về:

* Chủ đề chính của bài hát (`main_theme`)
* Cảm xúc / mood (`mood_tags`)
* Ngữ cảnh nghe phù hợp (`situation_tags`)
* Từ khóa lời bài hát (`lyrical_keywords`)
* Mức độ cảm xúc (`emotion_intensity`)
* Độ tin cậy của phân tích (`meaning_confidence`)
* Trạng thái cần kiểm tra lại (`review_status`)
* Mức bằng chứng phân tích (`evidence_level`)

Dữ liệu này phục vụ cho:

* Content-Based Filtering
* AI Playlist Generator
* Tìm kiếm / gợi ý theo mood, chủ đề, hoàn cảnh nghe
* Giảm phụ thuộc vào popularity-only recommendation

Pipeline hiện tại chạy offline/local, không gọi Gemini/API mặc định.

---

### 2. Bảng dữ liệu

Migration:

```txt
database/migrations/add_song_semantic_profiles.sql
```

Bảng được tạo:

```txt
song_semantic_profiles
```

Các cột chính:

```txt
id
song_id
summary_vi
main_theme
sub_themes
mood_tags
situation_tags
lyrical_keywords
emotion_intensity
meaning_confidence
semantic_text
source
generated_by
evidence_level
review_status
external_refs
created_at
updated_at
```

Lưu ý quan trọng:

```txt
songs.id = int unsigned
song_semantic_profiles.song_id = int unsigned
```

Nếu `song_id` dùng `BIGINT` sẽ bị lỗi foreign key:

```txt
ERROR 3780: Referencing column 'song_id' and referenced column 'id' are incompatible.
```

---

### 3. Apply migration

Từ root project:

```powershell
cd D:\CaNhan\Luan_Van
cmd /c "mysql -u root -p musicflow < database\migrations\add_song_semantic_profiles.sql"
```

Nếu thấy warning này thì bỏ qua được:

```txt
mysql: Unknown OS character set 'cp1258'.
mysql: Switching to the default character set 'utf8mb4'.
```

Nếu chạy lại migration và gặp lỗi:

```txt
Duplicate key name 'idx_song_semantic_profiles_theme'
```

thì nghĩa là bảng/index đã được tạo rồi. Không cần chạy lại migration nữa.

---

### 4. Kiểm tra bảng sau migration

```powershell
mysql -u root -p musicflow -e "SHOW TABLES LIKE 'song_semantic_profiles';"
```

```powershell
mysql -u root -p musicflow -e "SHOW FULL COLUMNS FROM song_semantic_profiles;"
```

```powershell
mysql -u root -p musicflow -e "SHOW INDEX FROM song_semantic_profiles;"
```

Cần có đủ các cột quan trọng:

```txt
song_id
summary_vi
main_theme
mood_tags
situation_tags
lyrical_keywords
meaning_confidence
semantic_text
source
generated_by
evidence_level
review_status
```

---

### 5. Generate semantic profiles

Script Python:

```txt
apps/ai-service/scripts/recommendation/generate_song_semantic_profiles.py
```

Chạy thử giới hạn 500 bài:

```powershell
cd D:\CaNhan\Luan_Van
python apps\ai-service\scripts\recommendation\generate_song_semantic_profiles.py --limit=500 --dry-run
```

Chạy full catalog:

```powershell
cd D:\CaNhan\Luan_Van
python apps\ai-service\scripts\recommendation\generate_song_semantic_profiles.py --limit=10000 --dry-run
```

Output chính:

```txt
datasets/processed/semantic/previews/song_semantic_profiles_python_preview.csv
datasets/processed/semantic/embeddings/song_semantic_embeddings.npy
datasets/processed/semantic/embeddings/song_semantic_embeddings_meta.csv
datasets/processed/semantic/reports/song_semantic_profiles_python_summary.json
```

Lưu ý: nếu không truyền `--limit`, script có thể mặc định chỉ chạy `20` bài. Không import file preview nếu lỡ bị ghi đè còn 20 dòng.

---

### 6. Evaluate semantic profiles

```powershell
cd D:\CaNhan\Luan_Van

python apps\ai-service\scripts\recommendation\evaluate_song_semantic_profiles.py --input datasets\processed\semantic\previews\song_semantic_profiles_python_preview.csv
```

Các chỉ số cần xem:

```txt
empty_mood_count
empty_situation_count
other_theme_rate
average_confidence
life_reflection_rate
generic_summary_rate
source_distribution
evidence_distribution
low_confidence_count
```

---

### 7. Import semantic profiles vào MySQL

Script import:

```txt
apps/backend/scripts/maintenance/importSongSemanticProfiles.js
```

Dry-run trước, không ghi DB:

```powershell
cd D:\CaNhan\Luan_Van\apps\backend

node scripts\maintenance\importSongSemanticProfiles.js --input=..\..\datasets\processed\semantic\previews\song_semantic_profiles_python_preview.csv --dry-run
```

Nếu cần test nhỏ:

```powershell
node scripts\maintenance\importSongSemanticProfiles.js --input=..\..\datasets\processed\semantic\previews\song_semantic_profiles_python_preview.csv --limit=20 --dry-run
```

Import thật:

```powershell
node scripts\maintenance\importSongSemanticProfiles.js --input=..\..\datasets\processed\semantic\previews\song_semantic_profiles_python_preview.csv --apply
```

Script import có cơ chế:

```txt
- convert tags string sang JSON array
- validate required fields
- upsert theo song_id
- tự tính review_status
- mặc định dry-run nếu không có --apply
```

---

### 8. Kết quả import hiện tại

Đã import full catalog thành công:

```txt
Total rows in song_semantic_profiles: 7661
```

Phân bố `review_status`:

```txt
auto: 6922
needs_review: 739
```

Phân bố `evidence_level`:

```txt
lyrics_based: 5153
metadata_only: 2508
```

Phân bố `main_theme`:

```txt
healing: 3208
love: 2466
heartbreak: 717
self_confidence: 431
party: 346
life_reflection: 161
friendship: 148
nostalgia: 138
conflict: 46
```

Các lệnh kiểm tra:

```powershell
mysql -u root -p musicflow -e "SELECT COUNT(*) AS total FROM song_semantic_profiles;"
```

```powershell
mysql -u root -p musicflow -e "SELECT review_status, COUNT(*) AS total FROM song_semantic_profiles GROUP BY review_status;"
```

```powershell
mysql -u root -p musicflow -e "SELECT evidence_level, COUNT(*) AS total FROM song_semantic_profiles GROUP BY evidence_level;"
```

```powershell
mysql -u root -p musicflow -e "SELECT main_theme, COUNT(*) AS total FROM song_semantic_profiles GROUP BY main_theme ORDER BY total DESC;"
```

---

### 9. Ý nghĩa các trường chất lượng

`evidence_level`:

```txt
lyrics_based    : Có lyrics hoặc text đủ mạnh để phân tích
metadata_only   : Chủ yếu dựa trên title/artist/genre/audio features
```

`review_status`:

```txt
auto            : Có thể dùng bình thường
needs_review    : Nên giảm trọng số hoặc kiểm tra lại
approved        : Đã được duyệt thủ công
```

Khi tích hợp recommendation, nên xử lý:

```txt
lyrics_based + auto       => dùng trọng số đầy đủ
metadata_only + auto      => dùng trọng số vừa phải
needs_review              => giảm trọng số
```

---

### 10. Ghi chú tích hợp tiếp theo

Bước tiếp theo không cần sửa frontend ngay. Nên tích hợp backend trước:

```txt
1. Tạo service đọc song_semantic_profiles
2. Join semantic profile vào candidate songs
3. Content-Based Filtering cộng điểm theo:
   - main_theme
   - mood_tags
   - situation_tags
   - semantic_text
4. AI Playlist Generator dùng semantic profile để match prompt tốt hơn
5. Giảm trọng số các bài metadata_only hoặc needs_review
```

Ví dụ logic scoring:

```txt
same main_theme        + cao
overlap mood_tags      + vừa
overlap situation_tags + vừa
semantic_text match    + vừa
metadata_only          x 0.75
needs_review           x 0.50
```

Không nên xóa hoặc ghi đè bảng `song_semantic_profiles` khi chưa backup hoặc chưa chạy dry-run.

### Ngày 26/06/2026: Promote model recommendation_bpr_model_final_semantic_v2.json sang storage/recommendation/models/bpr_mf_latest.json sau khi evaluation full 194 users.
