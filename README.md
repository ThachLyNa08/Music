# MusicFlow

MusicFlow là hệ thống nghe nhạc trực tuyến tích hợp cá nhân hóa, gợi ý bài hát, tạo playlist tự động, AI Playlist, AI Search, Karaoke tách vocal/instrumental và các chức năng quản trị.

## Công nghệ chính

- **Frontend:** Vue 3, Vite, Tailwind CSS, Pinia, Socket.IO Client
- **Backend:** Node.js, Express, MySQL, Redis, Socket.IO
- **AI Service:** FastAPI, Demucs, Librosa, scikit-learn
- **Recommendation:** LightGCN Hybrid, Content-Based, Hybrid Re-ranking, Tempo-aware
- **AI Playlist:** LLM intent parsing + Semantic RAG + DB validation + re-ranking

## Cấu trúc repository

```text
Music/
├─ apps/
│  ├─ backend/       # REST API, Socket.IO, scheduler, recommendation services
│  ├─ frontend/      # Vue 3 + Vite
│  └─ ai-service/    # FastAPI + Demucs
├─ database/
│  ├─ schema/        # Schema khởi tạo MySQL
│  ├─ migrations/    # Migration bổ sung
│  └─ seeds/         # Dữ liệu seed mẫu
├─ scripts/          # Script bảo trì / recommendation / audio features
├─ docs/             # Tài liệu kỹ thuật hiện hành
└─ README.md
```

## 1. Yêu cầu môi trường

Cài sẵn:

- Node.js và npm
- Python 3 + `venv`
- MySQL 8.0+
- Redis
- Git

Để sử dụng chức năng Karaoke, môi trường Python phải cài được Demucs và các dependency audio trong `apps/ai-service/requirements.txt`.

## 2. Clone project

```bash
git clone https://github.com/ThachLyNa08/Music.git
cd Music
```

## 3. Khởi tạo MySQL

File schema chính đã tự tạo database `musicflow` nếu chưa tồn tại.

### Windows PowerShell / CMD

```powershell
cmd /c "mysql -u root -p < database\schema\musicflow_schema.sql"
```

Sau khi cấu hình `.env` backend, chạy migration hiện hành:

```powershell
cd apps\backend
npm ci
Copy-Item .env.example .env
npm run migrate
cd ..\..
```

Nếu dùng tên database khác `musicflow`, sửa `DB_NAME` trong `.env` và tạo database tương ứng trước khi chạy migration.

## 4. Cấu hình Backend

```powershell
cd apps\backend
Copy-Item .env.example .env
```

Các biến tối thiểu cần kiểm tra trong `.env`:

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
DB_PASSWORD=

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

FRONTEND_URL=http://127.0.0.1:5173
APP_FRONTEND_URL=http://127.0.0.1:5173
APP_BACKEND_URL=http://127.0.0.1:3000
AI_SERVICE_URL=http://127.0.0.1:8000
```

Các API key như Groq, Gemini, Spotify, Last.fm, mail và SePay là cấu hình tùy theo chức năng. Không commit file `.env` lên GitHub.

Cài package nếu chưa thực hiện ở bước database:

```powershell
npm ci
```

Chạy backend:

```powershell
npm run dev
```

Backend mặc định sử dụng địa chỉ:

```text
http://127.0.0.1:3000
```

## 5. Chạy Redis

Redis cần hoạt động trước khi kiểm tra đầy đủ auth/refresh lock và các chức năng dùng cache/lock.

Kiểm tra nhanh:

```bash
redis-cli ping
```

Kết quả mong đợi:

```text
PONG
```

## 6. Cấu hình và chạy AI Service

Mở terminal mới:

```powershell
cd apps\ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Chạy FastAPI:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Kiểm tra:

```text
http://127.0.0.1:8000/health
```

Khi chạy Demucs/Karaoke, không nên dùng Uvicorn `--reload` vì file watcher có thể làm gián đoạn tiến trình tách stem.

## 7. Cấu hình và chạy Frontend

Mở terminal mới:

```powershell
cd apps\frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Frontend mặc định:

```text
http://127.0.0.1:5173
```

File `.env.example` frontend đã trỏ API và Socket.IO về backend local ở cổng `3000`.

## 8. Thứ tự chạy khuyến nghị

```text
1. MySQL
2. Redis
3. Backend       :3000
4. AI Service    :8000
5. Frontend      :5173
```

Sau đó mở `http://127.0.0.1:5173`.

## 9. Recommendation và AI Playlist

Tài liệu hiện hành nằm tại:

- `docs/recommendation/README.md`
- `docs/recommendation/v4/RECOMMENDATION_V4_REPORT.md`
- `docs/recommendation/TEMPO_AWARE_RECOMMENDATION.md`
- `docs/recommendation/ai_playlist_rag_notes.md`

Các file V2/V3, audit nội bộ và thesis notes cũ không còn được giữ trong cây source hiện hành để tránh nhầm với pipeline V4.

## 10. Scheduler

Các scheduler mặc định nên để tắt trong môi trường cài mới. Chỉ bật sau khi database và dữ liệu đã sẵn sàng.

Tài liệu:

- `docs/recommendation/scheduler.md`
- `docs/deployment/system-playlist-node-cron.md`

Không bật `RECOMMENDATION_SCHEDULER_TEST_MODE=true` ngoài lúc test local.

## 11. Kiểm tra nhanh khi không chạy được

Kiểm tra cổng backend:

```powershell
netstat -ano | findstr :3000
```

Kiểm tra AI Service:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Kiểm tra Redis:

```powershell
redis-cli ping
```

Nếu frontend gọi API lỗi, kiểm tra lại `apps/frontend/.env` và `apps/backend/.env`, sau đó restart Vite/backend.

## Tài liệu

`docs/` chỉ giữ tài liệu kỹ thuật còn liên quan đến phiên bản hiện tại. Các báo cáo thử nghiệm, file audit, tài liệu thiết kế tham khảo và ghi chú luận văn cũ có thể xem lại trong Git history nếu cần.
