---

name: musicflow-developer
description: Work safely on the MusicFlow graduation thesis project across backend, frontend, database, AI service, player, queue, playlist, recommendation, payment, and admin features. Use this skill whenever modifying real MusicFlow source code or planning full-stack changes. It keeps Codex scoped, prevents destructive edits, and preserves working music playback and runtime media.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow Developer

This skill guides development work for **MusicFlow**, a graduation thesis project: **an online music streaming system integrating recommendation algorithms and automatic playlist generation based on user behavior**.

Use this skill whenever working on real MusicFlow source code.

## Project Context

Current project structure:

```text
Luan_Van/
├─ apps/
│  ├─ backend/
│  ├─ frontend/
│  └─ ai-service/
├─ database/
├─ datasets/
├─ docs/
├─ storage/
├─ agent-skills/
├─ AGENTS.md
└─ README.md
```

Main source paths:

```text
apps/backend
apps/frontend
apps/ai-service
```

Runtime media path:

```text
apps/backend/uploads
```

Do not move, rename, delete, or reorganize `apps/backend/uploads`. This folder contains real runtime audio/images/covers used by the working app.

Frontend public URLs such as:

```text
/uploads/...
```

are runtime URLs served by Express. They are not obsolete paths and must remain compatible.

## Technology Stack

Frontend:

```text
Vue 3
Vite
Pinia
Vue Router
Tailwind CSS
Axios
Socket.IO client
```

Backend:

```text
Node.js
Express
MySQL
Redis
Socket.IO
JWT authentication
```

AI Service:

```text
Python
FastAPI
Recommendation processing
Stem separation / background AI tasks
```

Database:

```text
MySQL
database/schema
database/migrations
database/seeds
```

## Main System Features

MusicFlow includes:

* User registration/login/logout
* User profile management
* Music playback
* PlayerBar and QueuePanel
* Song, artist, album, playlist pages
* Like song
* Follow artist
* Manual playlists
* System playlists
* AI/generated playlists
* Personalized recommendation
* Automatic playlist generation based on listening behavior
* AI Playlist Generator using natural language
* Stem separation / karaoke AI
* Premium payment
* Admin dashboard and management pages

## When To Use

Use this skill when:

* Fixing backend bugs
* Adding backend APIs
* Updating frontend views/components
* Editing Pinia stores
* Fixing player/queue logic
* Updating playlist permissions
* Implementing recommendation or AI playlist logic
* Adding database migrations
* Updating admin pages
* Debugging payment or Socket.IO
* Refactoring real project code
* Making project-wide changes

## Core Safety Rules

1. Inspect existing files before editing.
2. Keep changes scoped to the user request.
3. Do not rewrite unrelated modules.
4. Do not delete files unless explicitly requested.
5. Do not move `apps/backend/uploads`.
6. Do not change `/uploads/...` runtime URL behavior.
7. Do not replace real data with mock data.
8. Do not hardcode songs, artists, albums, playlists, users, transactions, or recommendation results.
9. Do not silently change API response shape.
10. Do not change database schema without a migration.
11. Do not run destructive database scripts unless explicitly requested.
12. Do not push Git unless explicitly requested.
13. Preserve working playback.
14. Preserve working image/cover loading.
15. Preserve authentication and admin permissions.

## Backend Rules

Backend lives in:

```text
apps/backend
```

Expected structure:

```text
apps/backend/src/
├─ config/
├─ controllers/
├─ middleware/
├─ routes/
├─ services/
├─ sockets/
├─ jobs/
├─ utils/
├─ app.js
└─ server.js
```

Rules:

* Routes define endpoints and middleware only.
* Controllers handle request/response logic.
* Services handle reusable business logic.
* Middleware handles auth, upload, validation, and permissions.
* Use parameterized SQL.
* Never concatenate untrusted input into SQL.
* Use transactions for multi-step writes.
* Validate user ownership before updating/deleting user-owned resources.
* Protect admin routes with admin middleware.
* Handle errors with clear user-safe responses.
* Do not expose secrets in logs or responses.

## Frontend Rules

Frontend lives in:

```text
apps/frontend
```

Expected structure:

```text
apps/frontend/src/
├─ api/
├─ components/
├─ layouts/
├─ router/
├─ stores/
├─ utils/
└─ views/
```

Rules:

* Use Vue 3 Composition API where practical.
* Use Pinia as source of truth for shared state.
* Keep API calls in `src/api`, stores, or existing project patterns.
* Reuse existing components before creating new ones.
* Keep PlayerBar and QueuePanel stable.
* Preserve router paths unless explicitly requested.
* Handle loading, empty, and error states.
* Keep desktop/tablet/mobile behavior usable.
* Do not introduce React/shadcn into the Vue app.

## AI Service Rules

AI service lives in:

```text
apps/ai-service
```

Rules:

* Use FastAPI routes for AI endpoints.
* Keep heavy AI tasks out of synchronous request paths.
* Prefer background jobs/queues for expensive processing.
* Recommendation should use real behavior data.
* Stem separation should be asynchronous when implemented.
* Do not claim AI/ML is complete if logic is still SQL/mock only.

## Database Rules

Database files live in:

```text
database/
├─ schema/
├─ migrations/
└─ seeds/
```

Rules:

* Add migrations for structural changes.
* Keep schema, seed, and migration files separate.
* Preserve foreign keys and constraints.
* Use transactions for critical writes.
* Do not drop/truncate tables without explicit confirmation.
* Do not change playlist type/permission logic casually.

## Playlist Rules

Manual playlist:

```text
editable by owner
```

System playlist:

```text
read-only
```

AI/generated playlist:

```text
read-only unless explicit regenerate/edit flow exists
```

Rules:

* System/AI playlists must not show edit/search-add controls.
* Users may clone system/AI playlists if clone feature exists.
* Playlist cover fallback:

  1. uploaded/custom cover
  2. first song cover
  3. system/default cover
* Empty user playlist should still have a clean default cover.

## Player and Queue Rules

Do not break:

* current track
* play/pause
* next/previous
* seek
* volume
* shuffle/repeat
* queue
* route navigation while playing
* reload persistence if implemented

QueuePanel rules:

* Smooth open/close
* Desktop right panel
* Mobile overlay/full panel if implemented
* Main layout adapts
* Home rows should not wrap badly when queue opens

## Recommendation Rules

Recommendation is thesis-critical.

Use real user behavior when possible:

```text
listening history
completion rate
skip behavior
likes
playlist adds
artist follows
genre preferences
recently played
```

Do not replace recommendation with simple hardcoded lists.

Do not claim ML is implemented if only basic SQL exists.

## Payment Rules

* Do not fake successful payment in production path.
* Payment status must come from backend/provider callback when implemented.
* Socket.IO realtime update should reflect real backend state.
* Do not expose payment secrets to frontend.

## Workflow

When receiving a task:

1. Identify scope:

   * frontend
   * backend
   * ai-service
   * database
   * docs
   * full-stack
2. Inspect existing implementation.
3. Identify affected files.
4. Reuse existing patterns.
5. Make minimal safe changes.
6. Preserve real data flow.
7. Test affected flow.
8. Report files changed and test steps.

## Do

* Keep code aligned with existing architecture.
* Use real data.
* Make small, traceable changes.
* Preserve working playback and images.
* Add clear error handling.
* Add migration when schema changes.
* Report risks honestly.

## Don't

* Do not move `apps/backend/uploads`.
* Do not break `/uploads/...`.
* Do not create duplicate components/services/stores without checking existing ones.
* Do not hardcode fake data.
* Do not rewrite unrelated files.
* Do not silently remove existing features.
* Do not make broad refactors during bug fixes.
* Do not push Git unless asked.

## Output Format

When work is complete, report:

```text
Summary:
- ...

Files changed:
- path: reason

Data behavior:
- Real data preserved: yes/no
- Mock data added: yes/no

Safety check:
- Runtime media touched: yes/no
- /uploads URL changed: yes/no
- API contract changed: yes/no
- Database changed: yes/no
- Player/queue affected: yes/no

Manual test:
- ...
```
