# MusicFlow Project Agents

This file records the current project layout and the local agent skill folders.

## Source Applications

- `apps/backend/`: Express API, Socket.IO, MySQL/Redis integration, backend scripts, and runtime uploads.
- `apps/frontend/`: Vue/Vite frontend application.
- `apps/ai-service/`: FastAPI service and supporting AI/download scripts.

## Project Data And Documents

- `database/`: schema, migration, and seed files.
- `datasets/`: raw and processed import datasets.
- `docs/`: thesis materials, design notes, and review reports.
- `storage/`: manually organized non-runtime storage.
- `apps/backend/uploads/`: runtime audio/image/upload files used by the app. Do not move this folder until media paths are audited against the database.

## Agent Skills

- `agent-skills/musicflow-developer/`
- `agent-skills/musicflow-frontend-design/`
- `agent-skills/musicflow-web-components/`
- `agent-skills/musicflow-theme-factory/`
- `agent-skills/musicflow-testing/`
- `agent-skills/musicflow-thesis-report/`

The `SKILL.md` files are intentionally left for a later phase.
