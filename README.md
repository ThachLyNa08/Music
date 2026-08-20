# MusicFlow

MusicFlow là hệ thống nghe nhạc trực tuyến tích hợp cá nhân hóa, hệ thống gợi ý, playlist tự động, AI Search, AI Playlist Generator, Karaoke tách vocal/instrumental và các chức năng dành cho nghệ sĩ/quản trị viên.

## Công nghệ chính

- **Frontend:** Vue 3, Vite, Tailwind CSS, Pinia, Socket.IO Client
- **Backend:** Node.js, Express, MySQL, Redis, Socket.IO
- **AI Service:** FastAPI, Demucs, Librosa, scikit-learn
- **Recommendation:** LightGCN Hybrid, Content-Based fallback, Hybrid Re-ranking, Tempo-aware
- **AI Playlist:** LLM intent parsing + Semantic RAG + MySQL validation + re-ranking

## Cấu trúc repository

```text
Music/
├─ apps/
│  ├─ backend/       # REST API, Socket.IO, scheduler, recommendation services
│  ├─ frontend/      # Vue 3 + Vite
│  └─ ai-service/    # FastAPI + Demucs
├─ database/         # Schema, migrations, seed tối thiểu
├─ scripts/
│  ├─ audio_features/
│  ├─ maintenance/
│  └─ recommendation/v4/   # Pipeline thực nghiệm Recommendation V4
├─ docs/
│  ├─ DEMO_DATA.md
│  └─ recommendation/
└─ README.md
```

# Chạy lại demo từ máy mới

Luồng khuyến nghị:

```text
git clone
   ↓
tải demo data
   ↓
import musicflow_demo.sql
   ↓
đặt semantic dataset / recommendation artifact / media đúng thư mục
   ↓
cấu hình .env
   ↓
MySQL + Redis
   ↓
Backend :3000
   ↓
AI Service :8000
   ↓
Frontend :5173
   ↓
đăng nhập tài khoản demo
   ↓
chạy checklist chức năng
```

## 1. Yêu cầu môi trường

Cài sẵn:

- Git
- Node.js 22.x và npm
- Python 3.10+
- MySQL 8.0+
- Redis
- Chrome hoặc Edge

Để chạy Karaoke tách stem mới, Python cần cài được Demucs và các dependency audio trong `apps/ai-service/requirements.txt`.

## 2. Clone mã nguồn

```powershell
git clone https://github.com/ThachLyNa08/Music.git
cd Music
```

Kiểm tra branch:

```powershell
git branch --show-current
```

Kết quả mong đợi: `main`.

## 3. Tải dữ liệu demo

Đọc trước:

- `docs/DEMO_DATA.md`

Thư mục Drive bàn giao dữ liệu lớn:

https://drive.google.com/drive/folders/1CB_ZKqI-5H6pEKiS0QVh3I8pVON5F5Bj

Bộ demo đầy đủ cần có:

- `musicflow_demo.sql`
- semantic dataset chứa `song_semantic_profiles.csv`
- recommendation/model artifacts
- `apps/backend/uploads/` gồm media cần cho demo
- `DEMO_ACCOUNTS.txt`

Ba CSV catalog nguồn đã có sẵn trong repository để đối chiếu metadata nhạc:
`docs/music_database_kpop.csv`, `docs/music_database_usuk.csv`,
`docs/music_database_vpop.csv`. Các file này không thay thế database dump,
semantic dataset hoặc recommendation artifacts.

Nếu dùng gói `MusicFlow-demo-data.zip` theo cấu trúc trong `docs/DEMO_DATA.md`, đặt ZIP tại root repository và chạy:

```powershell
Expand-Archive .\MusicFlow-demo-data.zip -DestinationPath . -Force
```

Kiểm tra nhanh:

```powershell
Test-Path .\demo-data\musicflow_demo.sql
Test-Path .\datasets\processed\semantic\profiles\song_semantic_profiles.csv
Test-Path .\storage
Test-Path .\apps\backend\uploads
```

Với gói demo đầy đủ, bốn lệnh trên phải trả `True`.

## 4. Import `musicflow_demo.sql`

Tạo database:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS musicflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Import dữ liệu:

```powershell
cmd /c "mysql -u root -p musicflow < demo-data\musicflow_demo.sql"
```

Nếu **không có database demo** và chỉ cần kiểm tra source khởi động, có thể dùng schema tối thiểu:

```powershell
cmd /c "mysql -u root -p < database\schema\musicflow_schema.sql"
```

Sau đó có thể chạy các seed trong `database/seeds/`, nhưng dữ liệu này không tái tạo đầy đủ demo luận văn.

## 5. Cấu hình Backend

```powershell
cd apps\backend
npm ci
Copy-Item .env.example .env
```

Mở `apps/backend/.env` và kiểm tra tối thiểu:

```env
PORT=3000
NODE_ENV=development

JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=change-this-refresh-secret
JWT_REFRESH_EXPIRES_IN=3d

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=musicflow
DB_USER=root
DB_PASSWORD=<MAT_KHAU_MYSQL>

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

FRONTEND_URL=http://127.0.0.1:5173
APP_FRONTEND_URL=http://127.0.0.1:5173
APP_BACKEND_URL=http://127.0.0.1:3000
AI_SERVICE_URL=http://127.0.0.1:8000
```

Các API key Groq, Gemini, Spotify, Last.fm, email hoặc SePay chỉ điền khi cần kiểm tra chức năng tương ứng. Không commit file `.env`.

Đồng bộ migration hiện hành:

```powershell
npm run migrate
```

Quay về root:

```powershell
cd ..\..
```

## 6. Chạy Redis

Redis phải hoạt động trước khi kiểm tra đầy đủ auth/refresh lock và các chức năng dùng cache/lock.

Nếu Redis chạy trong WSL/Ubuntu:

```powershell
wsl -d Ubuntu -- sudo service redis-server start
wsl -d Ubuntu -- redis-cli PING
```

Hoặc nếu `redis-cli` đã có trực tiếp trên máy:

```powershell
redis-cli PING
```

Kết quả mong đợi:

```text
PONG
```

## 7. Chạy Backend

Mở PowerShell mới:

```powershell
cd Music\apps\backend
npm run dev
```

Backend:

```text
http://127.0.0.1:3000
```

Giữ terminal này mở.

## 8. Chạy AI Service

Mở PowerShell mới:

```powershell
cd Music\apps\ai-service
python -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Tạo `.env` từ file mẫu:

```powershell
Copy-Item .env.example .env
```

Chạy FastAPI:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Kiểm tra:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Kết quả phải có `status = ok`.

Khi chạy Demucs/Karaoke, không nên bật Uvicorn `--reload` vì file watcher có thể làm gián đoạn tác vụ tách stem.

## 9. Chạy Frontend

Mở PowerShell mới:

```powershell
cd Music\apps\frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

Mở URL trên bằng Chrome hoặc Edge.

## 10. Tài khoản demo

Tài khoản demo và mật khẩu **không lưu trong GitHub public**. Dùng file `demo-data/DEMO_ACCOUNTS.txt` đi kèm gói dữ liệu.

Các vai trò nên có:

```text
User có lịch sử nghe
User Premium
Artist
Admin
User cold-start đã onboarding
```

Các tài khoản này phải tồn tại trong `musicflow_demo.sql`.

## 11. Checklist chạy lại demo

Sau khi cả MySQL, Redis, Backend, AI Service và Frontend đã chạy, kiểm tra theo thứ tự:

- [ ] Mở `http://127.0.0.1:5173` không lỗi trắng trang.
- [ ] Đăng nhập bằng tài khoản User.
- [ ] Phát được một bài hát; play/pause/seek hoạt động.
- [ ] Recently Played hoặc lịch sử nghe được ghi nhận.
- [ ] Home hiển thị gợi ý cá nhân hóa / playlist hệ thống.
- [ ] User cold-start vẫn có nội dung dựa trên onboarding/fallback.
- [ ] AI Search trả bài hát thật trong MusicFlow khi provider/dataset được cấu hình.
- [ ] AI Playlist trả **preview** trước khi lưu và không sinh bài hát ngoài catalog.
- [ ] Karaoke mở được bài đã có vocal/instrumental trong media demo.
- [ ] Đăng nhập Artist mở được Artist Studio.
- [ ] Đăng nhập Admin mở được khu vực quản trị.
- [ ] Trang Premium/Payment hiển thị dữ liệu demo; không cần phát sinh giao dịch thật.

## 12. Recommendation V4

Các script tái lập thực nghiệm hiện hành được giữ tại:

```text
scripts/recommendation/v4/
```

Trong đó có pipeline tạo dữ liệu, temporal split, huấn luyện BPR-MF/LightGCN, Hybrid Re-ranking và đánh giá. Các script V2/V3, patch/audit tạm và pre-defense harness đã được loại khỏi cây source nộp để tránh nhầm với pipeline hiện tại.

Tài liệu:

- `docs/recommendation/README.md`
- `docs/recommendation/v4/RECOMMENDATION_V4_REPORT.md`
- `docs/recommendation/TEMPO_AWARE_RECOMMENDATION.md`
- `docs/recommendation/ai_playlist_rag_notes.md`
- `docs/recommendation/serving.md`

## 13. Scheduler

Scheduler recommendation/system playlist nên để tắt khi cài mới. Chỉ bật sau khi database và dữ liệu demo đã sẵn sàng.

Tài liệu:

- `docs/recommendation/scheduler.md`
- `docs/deployment/system-playlist-node-cron.md`

Không bật test mode scheduler ngoài lúc kiểm thử local.

## 14. Xử lý lỗi nhanh

Backend không lên:

```powershell
Test-NetConnection 127.0.0.1 -Port 3000
```

AI Service không lên:

```powershell
Test-NetConnection 127.0.0.1 -Port 8000
Invoke-RestMethod http://127.0.0.1:8000/health
```

Redis:

```powershell
redis-cli PING
```

Frontend gọi API lỗi: kiểm tra `apps/frontend/.env`, `apps/backend/.env` rồi restart cả Vite và Backend.

AI Playlist không có semantic candidate: kiểm tra file:

```powershell
Test-Path .\datasets\processed\semantic\profiles\song_semantic_profiles.csv
```

Media/Karaoke lỗi: kiểm tra:

```powershell
Test-Path .\apps\backend\uploads
```

## 15. Trước khi nộp

```powershell
git status
git branch --show-current
git log -1 --oneline
```

Bộ bàn giao được xem là hoàn chỉnh khi:

- `main` chứa source mới nhất.
- README chạy từ đầu đến cuối không phụ thuộc file bí mật đã commit.
- `docs/DEMO_DATA.md` trỏ tới Drive có đủ database, dataset, artifacts và media.
- `DEMO_ACCOUNTS.txt` đi kèm gói dữ liệu nhưng không public mật khẩu trên GitHub.
- Đã thử clone sang một thư mục mới và chạy lại theo đúng README.
