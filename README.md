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

```powershell
cd apps/ai-service
uvicorn app.main:app --reload
```

## Git Notes

Do not commit `.env`, `node_modules`, `dist`, runtime uploads, `storage`, generated logs, or music/audio files. Runtime media is currently kept under `apps/backend/uploads/` so existing app and database paths continue to work.
