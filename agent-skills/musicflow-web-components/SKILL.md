---

name: musicflow-web-components
description: Build, refactor, and standardize real MusicFlow Vue 3 + Tailwind CSS components. Use this skill when working on MusicFlow UI components such as SongRow, PlaylistCard, ArtistCard, AlbumCard, PlayerBar, QueuePanel, modals, admin tables, premium payment components, and reusable layout sections. This skill is optimized for the actual MusicFlow project and must not introduce React/shadcn into the Vue app unless explicitly requested for a standalone prototype.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow Web Components

This skill guides the creation, refactoring, and standardization of **real Vue 3 + Tailwind CSS components** inside the MusicFlow project.

MusicFlow is a graduation thesis project: **an online music streaming system integrating recommendation algorithms and automatic playlist generation based on user behavior**.

The real MusicFlow frontend is not a React artifact project. It is a Vue application.

## Primary Goal

Create production-ready, reusable, consistent, responsive MusicFlow components in:

```text
apps/frontend/
```

Use:

```text
Vue 3
Vite
Pinia
Vue Router
Tailwind CSS
Axios
Socket.IO client when needed
```

Do **not** add React, shadcn/ui, Radix React, or artifact-only dependencies to the real MusicFlow app unless the user explicitly asks for a standalone prototype outside the app.

## Project Context

Current MusicFlow structure:

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

Real frontend source:

```text
apps/frontend/src/
```

Common frontend areas:

```text
apps/frontend/src/api/
apps/frontend/src/components/
apps/frontend/src/components/common/
apps/frontend/src/components/home/
apps/frontend/src/components/player/
apps/frontend/src/components/playlist/
apps/frontend/src/components/premium/
apps/frontend/src/components/profile/
apps/frontend/src/components/admin/
apps/frontend/src/layouts/
apps/frontend/src/router/
apps/frontend/src/stores/
apps/frontend/src/utils/
apps/frontend/src/views/
```

Runtime media path:

```text
apps/backend/uploads/
```

Never move, rename, or refactor `apps/backend/uploads`. Frontend URLs beginning with `/uploads/...` are public runtime media URLs served by the backend. They must stay compatible.

## When To Use This Skill

Use this skill when the user asks to:

* Create a new Vue component
* Standardize duplicated components
* Refactor existing UI components safely
* Fix inconsistent card layouts
* Improve responsive behavior
* Improve component props/emits
* Build or update:

  * SongRow
  * SongCard
  * PlaylistCard
  * ArtistCard
  * AlbumCard
  * PlayerBar
  * QueuePanel
  * LikeButton
  * SongActionMenu
  * AddToPlaylistModal
  * CreatePlaylistModal
  * SectionHeader
  * ResponsiveGrid
  * CoverImage
  * AdminDataTable
  * AdminStatCard
  * PremiumPlanCard
  * PaymentQrCard
  * PaymentCheckoutModal
  * Profile/EditProfileModal

## Important Difference From Artifact Builder

The original web-artifacts-builder pattern is useful for standalone artifact prototypes with React, TypeScript, Vite, Tailwind, and shadcn/ui.

For MusicFlow:

```text
Default mode = real Vue 3 + Tailwind implementation.
Prototype mode = only when the user explicitly asks for a standalone artifact/mockup.
```

### Default: Real MusicFlow Vue Mode

Use this when editing project files.

Rules:

* Work inside `apps/frontend`.
* Use Vue 3 components.
* Use Tailwind CSS.
* Reuse existing Pinia stores.
* Reuse existing API modules.
* Reuse existing router paths.
* Reuse existing components when possible.
* Do not install React/shadcn dependencies.
* Do not create a separate artifact project.
* Do not hardcode music data if API/store exists.

### Optional: Standalone Prototype Mode

Use only when the user explicitly asks for:

* a standalone artifact
* an HTML prototype
* a React prototype
* a shadcn/ui mockup
* a design demo outside the real app

In this mode, the original artifact workflow may be used:

```bash
bash scripts/init-artifact.sh <project-name>
bash scripts/bundle-artifact.sh
```

But the output is only a design reference unless later converted manually into Vue 3 + Tailwind.

## Component Design Direction

MusicFlow components should feel like:

```text
Spotify dark app density
+
Apple Music clarity
+
MusicFlow personalized AI identity
```

Visual style:

* Dark immersive music UI
* Premium but practical
* Album art as main color source
* Compact and responsive
* Smooth interactions
* No generic AI-looking UI
* No random purple gradient dashboards
* No excessive glassmorphism
* No fake data in production paths

Suggested palette:

```text
Background: #0b0b0f
Base Surface: #121212
Elevated Surface: #181818
Card Surface: #1f1f1f
Soft Card: #252525
Border: rgba(255,255,255,0.08)

Primary Text: #ffffff
Secondary Text: #b3b3b3
Muted Text: #7a7a7a

Accent Green: #1ed760
Accent Blue: #4f8cff
Accent Purple: #8b5cf6
Danger: #ef4444
Warning: #f59e0b
Success: #22c55e
```

## Core Component Rules

1. Inspect existing components before creating new ones.
2. Prefer standardizing existing components over duplicating.
3. Keep components reusable.
4. Use props for data.
5. Use emits for events.
6. Do not mutate props directly.
7. Keep API calls in `src/api`, views, or Pinia stores unless the existing project pattern says otherwise.
8. Keep large logic out of visual components.
9. Use Tailwind CSS consistently.
10. Add loading, empty, and error states when component displays async data.
11. Keep mobile behavior usable.
12. Keep keyboard and click behavior predictable.
13. Preserve player, queue, sidebar, routing, and real data behavior.

## Vue 3 Standard

Prefer:

```vue
<script setup>
const props = defineProps({
  song: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['play', 'like', 'open-detail'])
</script>

<template>
  <!-- component markup -->
</template>
```

Rules:

* Use `computed` for derived display values.
* Use `watch` only when necessary.
* Do not store duplicated source-of-truth state locally.
* Use Pinia store for shared player/auth/library state.
* Use composables for reusable UI behavior.
* Use `v-if`, `v-show`, and `computed` intentionally.
* Use `:key` correctly in lists to avoid Vue duplicate key warnings.

## Tailwind Rules

* Prefer Tailwind utilities over inline styles.
* Avoid scattering random hex values.
* Use shared CSS classes or theme tokens where already available.
* Keep class lists readable.
* Use `truncate`, `line-clamp`, `min-w-0`, and `overflow-hidden` for music metadata.
* Use `transition`, `duration-200`, `ease-out` for smooth but light interactions.
* Avoid huge animated effects that slow queue/player.

## Standard Component Contracts

### SongRow

Use for track lists across Home, album, playlist, artist, search, liked songs, recently played, profile.

Expected props:

```text
song
index
isPlaying
isLiked
showIndex
showCover
showArtist
showAlbum
showDuration
showMenu
compact
disabled
```

Expected emits:

```text
play
pause
like
open-detail
open-artist
open-album
open-menu
add-to-playlist
```

Rules:

* Song title should navigate to song detail when route exists.
* Artist name should navigate to artist detail when route exists.
* Like state must reflect real backend/store state.
* Duration must use shared formatter.
* Long title/artist/album must truncate.
* Play button must be visible and easy to click.
* More menu must not overflow viewport.
* Do not show unauthorized actions.

### SongCard

Use for grid/row recommendations where visual cover is important.

Rules:

* Use stable cover fallback.
* Show hover play action on desktop.
* Keep important actions accessible on mobile.
* Avoid huge card height.
* Use real song data.
* Do not duplicate SongRow behavior unless card layout requires it.

### PlaylistCard

Expected props:

```text
playlist
isPlaying
compact
showOwner
showBadge
showMenu
```

Expected emits:

```text
open
play
clone
edit
delete
open-menu
```

Rules:

* Manual playlist owned by user can show edit actions.
* System playlist must be read-only.
* AI playlist must be read-only unless explicit edit/regenerate flow exists.
* User can clone system/AI playlists if feature exists.
* Cover fallback order:

  1. uploaded/custom playlist cover
  2. first song cover
  3. system/default cover
* Empty user playlist should still have clean visual fallback.
* Do not show edit/search-add controls for system playlists.

### ArtistCard

Expected props:

```text
artist
isFollowing
compact
showFollow
showMenu
```

Expected emits:

```text
open
follow
unfollow
play
open-menu
```

Rules:

* Use stable avatar fallback.
* Avoid unnecessary track count unless page needs it.
* Follow state must persist.
* Keep shape consistent across pages.
* Artist image should not flicker.

### AlbumCard

Expected props:

```text
album
compact
showArtist
showType
showLibraryAction
```

Expected emits:

```text
open
play
add-to-library
remove-from-library
open-menu
```

Rules:

* Cover must be stable and not flicker.
* Album/single classification must come from real data.
* Remove external service buttons unless explicitly requested.
* If album cover missing, use song cover fallback when appropriate.

### LikeButton

Expected props:

```text
isLiked
disabled
size
variant
```

Expected emits:

```text
toggle
```

Rules:

* Outline state must be visible on dark UI.
* Filled state must be obvious.
* Must not lose state after reload.
* Must debounce or prevent double-click spam if API is involved.
* Must show disabled/loading state if action is in progress.

### SongActionMenu / MoreMenu

Rules:

* Open from three-dot button.
* Close on outside click.
* Close after action.
* Do not overflow viewport.
* Show only permission-allowed actions.
* Do not show edit/delete for system playlists.
* Include add-to-playlist when valid.
* Keep keyboard accessibility in mind.

### PlayerBar

Rules:

* Fixed at bottom.
* Must not disappear on normal user pages.
* Must use player Pinia store as source of truth.
* Must show current track cover/title/artist.
* Must support play/pause/next/previous.
* Must support volume/seek/repeat/shuffle if implemented.
* Must preserve current track across route navigation.
* Must not block main content.
* Must not cause duplicate audio playback.

### QueuePanel

Rules:

* Right-side panel on desktop.
* Overlay or full-screen panel on mobile.
* Smooth open/close.
* Must use real queue from player store.
* Must not lag when opened.
* Main content should adapt when queue opens.
* Home sections should reduce visible cards instead of wrapping badly.
* Do not render excessively large queue lists without considering performance.

### CoverImage

Use for stable image rendering.

Rules:

* Accept src, alt, fallback.
* Avoid repeated fallback loops.
* Prevent flicker.
* Handle `/uploads/...` URLs correctly.
* Support lazy loading where appropriate.
* Do not convert runtime URL to filesystem path.

### ResponsiveGrid

Use when multiple pages need consistent card layout.

Rules:

* Desktop: show 5–7 items when enough space.
* Queue open: reduce visible items/columns.
* Tablet: reduce columns cleanly.
* Mobile: one or two columns depending component type.
* Avoid horizontal overflow.
* Avoid inconsistent card heights.

### AdminDataTable

Rules:

* Use real data.
* Support pagination.
* Support loading/empty/error states.
* Support search/filter where required.
* Keep actions permission-safe.
* Avoid unreadable contrast.
* Do not load thousands of rows at once.

### Payment Components

Rules:

* Do not fake successful payment.
* Payment status must come from backend when implemented.
* QR and countdown must be clear.
* Socket.IO realtime updates should be reflected if available.
* Use trustworthy, clean UI.

## Data Rules

Never hardcode production data for:

```text
songs
artists
albums
playlists
users
transactions
recommendations
payment status
admin dashboard stats
```

Mock data is allowed only when:

```text
the user explicitly asks for a prototype
or the file is clearly a demo
or the feature has no backend yet and is clearly labeled as placeholder
```

When API exists, use API/store data.

## Permission Rules

Always preserve:

* Admin-only access for admin actions.
* User ownership for manual playlists.
* Read-only system playlists.
* Read-only AI/system generated playlists.
* Premium-only feature restrictions where implemented.

Do not expose UI actions that backend would reject.

## Responsive Rules

### Desktop

* Full sidebar.
* Fixed PlayerBar.
* QueuePanel can open right.
* Content adapts to queue width.
* Cards remain aligned.

### Tablet

* Reduce columns.
* Keep text readable.
* Avoid crowded QueuePanel.
* Avoid horizontal overflow.

### Mobile

* Single-column or compact two-column layout.
* Player remains usable.
* Queue becomes overlay/full-screen if needed.
* Important actions must not rely only on hover.
* Menus/modals must fit viewport.

## Performance Rules

* Avoid heavy re-renders when queue opens.
* Avoid expensive computed logic inside large lists.
* Avoid loading high-resolution images unnecessarily.
* Use lazy images when useful.
* Use stable keys.
* Keep animations lightweight.
* Do not cause layout thrashing through repeated DOM measurements.

## Safety Rules

Do not:

* Move `apps/backend/uploads`.
* Change `/uploads/...` URL behavior.
* Add React/shadcn dependencies to `apps/frontend`.
* Replace Pinia stores with local component state.
* Break Vue Router links.
* Break PlayerBar or QueuePanel.
* Replace real API data with mock data.
* Delete files.
* Run destructive migrations.
* Push Git unless explicitly requested.

## Workflow

When asked to work on MusicFlow components:

1. Identify component/page affected.
2. Inspect existing component(s).
3. Check if a reusable component already exists.
4. Determine props and emits needed.
5. Preserve real data flow.
6. Implement minimal Vue 3 + Tailwind changes.
7. Check desktop/tablet/mobile behavior.
8. Check PlayerBar/QueuePanel impact.
9. Report files changed and manual tests.

## Do

* Build real Vue components.
* Reuse existing components.
* Keep UI consistent.
* Keep dark music-app style.
* Handle loading/empty/error states.
* Use real data.
* Use permission-aware actions.
* Keep components responsive.
* Keep player and queue safe.

## Don't

* Do not create React artifacts for real app implementation.
* Do not install shadcn/ui into Vue app.
* Do not duplicate existing components without reason.
* Do not make broad unrelated refactors.
* Do not use mock data when API exists.
* Do not break runtime media URLs.
* Do not hide important actions on mobile.
* Do not make card sizes inconsistent.
* Do not show edit actions for system playlists.

## Optional Artifact Reference

If the user explicitly asks for a standalone prototype, the original artifact workflow may be used:

```bash
bash scripts/init-artifact.sh musicflow-ui-prototype
cd musicflow-ui-prototype
bash scripts/bundle-artifact.sh
```

This creates a React/Tailwind/shadcn-style `bundle.html`.

However:

```text
React artifact output is only a prototype.
It must be manually translated into Vue 3 + Tailwind before entering apps/frontend.
```

## Test Checklist

After component work, verify:

```text
- Frontend starts
- Backend starts if data is needed
- Page loads
- Images load
- No /uploads 404
- PlayerBar still works
- QueuePanel still opens/closes
- Like/follow state persists if touched
- Menus do not overflow
- Mobile layout has no horizontal scroll
- Console has no major Vue warnings/errors
```

## Output Format

When completing work, report:

```text
Component summary:
- ...

Files changed:
- ...

Components reused:
- ...

Props/emits:
- ...

Data behavior:
- Real data preserved: yes/no
- Mock data added: yes/no

Safety check:
- PlayerBar affected: yes/no
- QueuePanel affected: yes/no
- /uploads runtime URL affected: yes/no
- React/shadcn added: yes/no
- API contract changed: yes/no

Manual test:
- ...
```

## Reminder

For MusicFlow, this skill is primarily a **Vue 3 + Tailwind component implementation skill**. Artifact builder and shadcn ideas are only references for prototyping, not dependencies to bring into the real application by default.
