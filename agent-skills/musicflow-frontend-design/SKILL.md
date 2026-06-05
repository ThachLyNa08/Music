---

name: musicflow-frontend-design
description: Create distinctive, production-grade frontend interfaces for the MusicFlow graduation thesis project. Use this skill when designing, improving, styling, or refactoring MusicFlow user pages, admin pages, Vue components, layouts, responsive behavior, player UI, queue panel, playlist pages, artist pages, album pages, profile pages, premium pages, and dashboard screens. The goal is to produce polished Spotify-inspired and Apple Music-inspired UI while preserving real data, existing logic, and the MusicFlow architecture.
license: Complete terms in LICENSE.txt
--------------------------------------

This skill guides creation and refinement of distinctive, production-grade frontend interfaces for **MusicFlow**.

MusicFlow is a graduation thesis project: **an online music streaming system integrating recommendation algorithms and automatic playlist generation based on user behavior**. The frontend is built with **Vue 3, Vite, Pinia, Vue Router, and Tailwind CSS**.

The purpose of this skill is to help the agent create beautiful, coherent, responsive, and maintainable frontend UI for MusicFlow while avoiding generic AI aesthetics, mock data, and unsafe edits that break existing player, queue, playlist, authentication, or admin logic.

The user may ask to build or improve pages, components, layouts, interactions, responsive behavior, or visual polish for MusicFlow. Common targets include:

* Home page
* Search page
* Library page
* Playlist detail page
* Artist detail page
* Album detail page
* Song detail page
* Profile page
* Premium payment page
* Admin dashboard
* Manage songs, artists, albums, users, transactions
* Bottom PlayerBar
* Queue panel
* SongRow, SongCard, PlaylistCard, ArtistCard, AlbumCard
* Modal, menu, toast, section header, responsive grid

## Project Context

MusicFlow source structure:

```text
Luan_Van/
├─ apps/
│  ├─ frontend/
│  ├─ backend/
│  └─ ai-service/
├─ database/
├─ datasets/
├─ docs/
├─ storage/
├─ agent-skills/
├─ AGENTS.md
└─ README.md
```

Frontend source:

```text
apps/frontend/
```

Important frontend technologies:

* Vue 3
* Vite
* Pinia
* Vue Router
* Tailwind CSS
* Axios
* Socket.IO client where needed

Important backend/runtime rule:

```text
apps/backend/uploads/
```

must not be moved or renamed. Frontend URLs beginning with `/uploads/...` are public runtime media URLs served by the backend and must remain compatible.

## Design Thinking

Before coding, understand the context and commit to a clear MusicFlow aesthetic direction.

Think through:

* **Purpose**: What problem does this interface solve for music listeners, admins, or premium users?
* **User Role**: Is this for guest, normal user, premium user, or admin?
* **Music Context**: Is the screen about listening, discovering, managing, paying, or analyzing?
* **Tone**: MusicFlow should feel premium, immersive, modern, clean, and music-first.
* **Constraints**: Vue 3, Tailwind CSS, existing stores, existing API contracts, existing responsive layout, player bar, queue panel, sidebar.
* **Differentiation**: What makes the screen memorable without becoming decorative noise?

## MusicFlow Aesthetic Direction

MusicFlow should mainly follow a **Spotify-inspired dark immersive music app style** with **Apple Music-inspired clarity and polish**.

The interface should feel:

* Dark
* Premium
* Clean
* Music-first
* Responsive
* Dense enough for a real music app
* Smooth but not heavy
* Elegant without looking generic
* Practical for long listening sessions

Recommended mood:

```text
Spotify dark app density
+
Apple Music spacing and polish
+
MusicFlow personalized AI identity
```

## Frontend Aesthetics Guidelines

Focus on:

### Typography

Use refined, readable typography. For MusicFlow, do not chase unusual fonts if they hurt product consistency. A safe production stack is acceptable:

```css
font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Rules:

* Use strong section titles.
* Use compact metadata.
* Use truncation for long song, artist, album, and playlist names.
* Avoid oversized text except for hero, artist header, playlist header, or profile header.
* Use font weight and spacing to create hierarchy.

### Color & Theme

Use a cohesive dark music palette. The UI should recede so album art, artist photos, and playlist covers become the main visual color source.

Recommended tokens:

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

Rules:

* Use dark mode for main user music pages.
* Let album covers and artist images create visual richness.
* Use accent colors functionally, not decoratively.
* Avoid random purple gradients on white backgrounds.
* Avoid unreadable gray-on-gray.
* Avoid too many bright colors at once.

### Motion

Use motion intentionally.

Good uses:

* Smooth queue panel slide
* Player button micro-interactions
* Hover play button reveal
* Soft card hover lift
* Modal fade/scale
* Toast transitions
* Section entrance only if performance remains good

Avoid:

* Heavy animations that cause lag
* Over-animated list items
* Motion that breaks player/queue responsiveness
* Large layout reflows when opening queue

### Spatial Composition

MusicFlow is an application, not a landing page. Favor useful density over excessive whitespace.

Rules:

* Keep section spacing clean but not huge.
* Avoid large blank space at page bottom.
* Use responsive grids.
* Keep Home rows controlled when QueuePanel is open.
* Avoid cards wrapping into ugly second rows when a horizontal row is intended.
* Keep PlayerBar fixed and usable.
* Keep Sidebar and Topbar stable.

### Backgrounds & Visual Details

Create atmosphere through:

* Near-black surfaces
* Subtle elevation
* Album-art color extraction where already implemented
* Soft gradients only when they support music mood
* Backdrop blur only when performance is acceptable
* Clean surface layering

Avoid:

* Decorative effects unrelated to music
* Random floating 3D objects unless explicitly requested
* Excessive glow
* Overused AI-looking mesh gradients
* Overly bright dashboard colors that reduce contrast

## MusicFlow UI Rules

### Global Layout

The user app should preserve:

* Left sidebar on desktop
* Main content area
* Bottom PlayerBar
* Optional right QueuePanel
* Topbar where implemented
* Correct scroll behavior
* No content hidden under PlayerBar
* No major blank space after final section

### PlayerBar

Never break the PlayerBar.

It should:

* Stay visible on user music pages
* Show current song, artist, cover
* Support play/pause/next/previous
* Support seek, volume, shuffle, repeat where implemented
* Keep current track when navigating routes
* Use player Pinia store as source of truth

### QueuePanel

QueuePanel should:

* Open smoothly
* Close smoothly
* Not cause visible lag
* Not destroy Home/section layout
* Reduce visible cards/items when needed
* Avoid forcing ugly wrapping
* Become overlay or full-screen style on mobile if needed

### SongRow

Standard song row should include:

* Play button
* Cover image
* Song title
* Artist
* Optional album
* Like button
* Duration
* More menu

Rules:

* Song title should route to detail page if supported.
* Like state must persist and reflect backend/store state.
* Menu must show permission-safe actions.
* Text must truncate cleanly.

### PlaylistCard

Rules:

* Use stable cover fallback.
* System and AI playlists must not show edit actions.
* Manual user playlists can show edit actions for owner.
* Empty user playlist may use default cover.
* Playlist with songs can use first song cover.
* System playlist should use system cover if defined.

### ArtistCard

Rules:

* Use consistent avatar shape.
* Do not show unnecessary metadata.
* Follow state must persist where implemented.
* Keep hover play/follow/menu behavior consistent.

### AlbumCard

Rules:

* Cover must not flicker.
* Album/single classification must come from real data.
* Remove unnecessary external links unless explicitly required.
* Use real image fallback.

### Admin UI

Admin pages should be:

* Clear
* Data-focused
* Professional
* Responsive
* High contrast
* Table and filter friendly

Admin Dashboard can use a lighter or dark dashboard style, but it must remain readable and consistent with MusicFlow.

## Data Rules

MusicFlow must use real data wherever APIs already exist.

Do not hardcode:

* songs
* artists
* albums
* playlists
* users
* transactions
* dashboard stats
* recommendation results

Mock data is allowed only when:

* The user explicitly requests a prototype.
* The data is clearly marked as mock/demo.
* It does not replace a real feature path.

## Technical Rules

When editing frontend:

1. Inspect existing components before creating new ones.
2. Reuse common components where possible.
3. Do not duplicate SongRow, PlaylistCard, ArtistCard, AlbumCard, PlayerBar, QueuePanel unnecessarily.
4. Keep API calls in `src/api` or Pinia stores when consistent with existing architecture.
5. Preserve Vue Router paths unless asked.
6. Preserve Pinia store behavior.
7. Use Tailwind CSS consistently.
8. Avoid broad refactors during visual fixes.
9. Do not change backend API contracts without explicit need.
10. Do not change runtime `/uploads/...` URL behavior.

## Responsive Rules

### Desktop

* Sidebar visible.
* PlayerBar fixed bottom.
* QueuePanel may open on the right.
* Main content adapts to queue width.
* Grids show as many items as fit cleanly.

### Tablet

* Reduce columns.
* Avoid text overflow.
* Sidebar may collapse if existing layout supports it.
* Queue should not squeeze content into unusable layout.

### Mobile

* Single-column layout.
* Player remains usable.
* Queue becomes overlay/full panel if needed.
* Avoid horizontal scroll.
* Important actions must not rely only on hover.

## Accessibility Rules

* Maintain readable contrast.
* Buttons and interactive icons need visible focus/hover states.
* Do not hide critical actions from keyboard users.
* Use semantic buttons for actions.
* Images need alt text where practical.
* Modals and menus should close predictably.

## Workflow

When the user asks for frontend design work:

1. Identify affected page/component.
2. Inspect existing files.
3. Determine if existing component can be reused.
4. Choose a clear MusicFlow design direction.
5. Make minimal scoped changes.
6. Preserve real data flow.
7. Preserve player, queue, sidebar, routing, and API behavior.
8. Check responsive behavior.
9. Report files changed and manual test steps.

## Do

* Use a clear MusicFlow-specific aesthetic.
* Use dark immersive music app surfaces.
* Keep UI polished and production-grade.
* Use real data.
* Keep cards consistent.
* Keep PlayerBar and QueuePanel safe.
* Handle loading, empty, and error states.
* Test desktop/tablet/mobile.
* Make hover and transitions smooth.
* Keep text readable.

## Don't

* Do not create generic AI-looking UI.
* Do not use random purple gradients on white surfaces.
* Do not use mock data if real data exists.
* Do not break existing player logic.
* Do not break queue layout.
* Do not move or rename `apps/backend/uploads`.
* Do not change `/uploads/...` URL behavior.
* Do not duplicate components unnecessarily.
* Do not make broad unrelated refactors.
* Do not hide critical mobile actions behind hover only.
* Do not make the user music app fully light mode unless explicitly requested.

## Output Format

When completing work, report:

```text
UI Summary:
- What changed
- Why it matches MusicFlow

Files changed:
- path: reason

Data behavior:
- Real data preserved: yes/no
- Mock data added: yes/no

Responsive behavior:
- Desktop:
- Tablet:
- Mobile:

Safety check:
- PlayerBar affected: yes/no
- QueuePanel affected: yes/no
- /uploads runtime URL affected: yes/no
- API contract changed: yes/no

Manual test:
- Steps to verify
```

## Reminder

The goal is not only to make the interface beautiful. The goal is to make MusicFlow feel like a real premium music streaming product while keeping the graduation thesis features safe, real-data driven, and maintainable.
