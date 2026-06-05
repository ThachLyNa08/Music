---

name: musicflow-theme-factory
description: Define and maintain the MusicFlow visual design system, Tailwind theme tokens, colors, typography, spacing, radius, shadows, dark surfaces, player/queue styling, admin dashboard styling, premium payment styling, and reusable UI classes. Use this skill when improving MusicFlow's visual identity in the established Spotify-inspired dark music app style with Apple Music-inspired polish.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow Theme Factory

This skill defines the visual design language for **MusicFlow**, a graduation thesis project: **an online music streaming system integrating recommendation algorithms and automatic playlist generation based on user behavior**.

Use this skill when creating or updating the MusicFlow theme, design tokens, Tailwind configuration, global CSS, reusable style classes, and visual consistency across the real Vue 3 frontend.

## Primary Goal

MusicFlow must look and feel like a real premium music streaming product.

The established MusicFlow style is:

```text
Spotify dark app density
+
Apple Music clarity and polish
+
MusicFlow personalized AI identity
```

This means:

* Dark immersive music interface
* Clean, premium, modern visual language
* Album art and artist images as the main color source
* Compact but readable layout
* Smooth but lightweight interactions
* No generic AI-looking UI
* No random bright/pastel theme
* No messy gradients everywhere
* No inconsistent card sizes

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

Frontend source:

```text
apps/frontend/
```

Main styling locations may include:

```text
apps/frontend/src/style.css
apps/frontend/src/assets/
apps/frontend/tailwind.config.js
apps/frontend/src/components/
apps/frontend/src/layouts/
apps/frontend/src/views/
```

Runtime media path:

```text
apps/backend/uploads/
```

Do not move, rename, delete, or reorganize `apps/backend/uploads`.

Frontend media URLs such as:

```text
/uploads/...
```

are public runtime URLs served by the backend. They are not obsolete root paths and must remain compatible.

## When To Use This Skill

Use this skill when working on:

* Tailwind theme values
* Global CSS
* Shared CSS variables
* Dark theme cleanup
* Sidebar theme
* Topbar theme
* Bottom PlayerBar theme
* QueuePanel theme
* Home section style
* Song card / row style
* Playlist card style
* Artist card style
* Album card style
* Profile page style
* Search page style
* Premium payment page style
* Admin dashboard style
* Modal/menu/toast style
* Responsive layout polish
* Shared classes such as `home-panel`, `home-card`, `home-card-hover`, `home-section-title`

## MusicFlow Visual Direction

MusicFlow user-facing pages should feel like:

* Spotify-inspired dark app
* Apple Music-inspired spacing and polish
* Smooth, premium, and focused on listening
* Content-first, not decoration-first
* Practical for daily music use

MusicFlow should **not** feel like:

* A generic SaaS dashboard
* A bright pastel landing page
* A random purple-gradient AI template
* A glassmorphism demo with no product identity
* A page full of oversized empty sections
* A design where UI effects compete with album art

## Core Theme Palette

Use these tokens as the main visual foundation:

```css
:root {
  --mf-bg: #0b0b0f;
  --mf-bg-soft: #101014;

  --mf-surface: #121212;
  --mf-surface-2: #181818;
  --mf-surface-3: #1f1f1f;

  --mf-card: #252525;
  --mf-card-hover: #2a2a2a;
  --mf-card-active: #303030;

  --mf-border: rgba(255, 255, 255, 0.08);
  --mf-border-strong: rgba(255, 255, 255, 0.14);

  --mf-text: #ffffff;
  --mf-text-secondary: #b3b3b3;
  --mf-text-muted: #7a7a7a;
  --mf-text-disabled: #555555;

  --mf-green: #1ed760;
  --mf-green-hover: #1fdf64;

  --mf-blue: #4f8cff;
  --mf-purple: #8b5cf6;
  --mf-pink: #ec4899;

  --mf-danger: #ef4444;
  --mf-warning: #f59e0b;
  --mf-success: #22c55e;
  --mf-info: #38bdf8;
}
```

## Color Rules

### Do

* Use near-black backgrounds for user music pages.
* Use surface shade differences to create depth.
* Let album covers, playlist covers, and artist images provide emotional color.
* Use green/blue/purple accents functionally.
* Keep text contrast high.
* Use muted text for metadata.
* Use danger/warning/success colors only for semantic states.

### Don't

* Do not make the main user music app fully light mode unless explicitly requested.
* Do not use random purple gradients on white backgrounds.
* Do not use pastel background blocks for the main app.
* Do not use unreadable gray text on dark surfaces.
* Do not use too many accent colors in the same component.
* Do not use decorative glow everywhere.
* Do not make every page a different theme.

## Typography

Recommended font stack:

```css
font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

MusicFlow should use compact, readable product typography.

Recommended scale:

```text
Display: 40px–56px, 700–800
Page title: 28px–36px, 700
Hero title: 36px–56px, 700–800
Section title: 20px–24px, 700
Card title: 15px–17px, 600–700
Body: 14px–16px, 400
Metadata: 12px–14px, 400–500
Micro: 10px–12px, 400
```

Rules:

* Use bold section headings.
* Use muted metadata.
* Use `truncate`, `line-clamp`, `min-w-0`, and `overflow-hidden` for long music text.
* Avoid giant headings in normal app sections.
* Hero/profile/artist/playlist headers may use larger typography.
* Keep song rows compact.

## Radius System

Recommended tokens:

```css
:root {
  --mf-radius-xs: 4px;
  --mf-radius-sm: 8px;
  --mf-radius-md: 12px;
  --mf-radius-lg: 16px;
  --mf-radius-xl: 24px;
  --mf-radius-2xl: 32px;
  --mf-radius-pill: 9999px;
}
```

Usage:

```text
Buttons: pill
Play buttons: circle
Song rows: 8px–12px
Cards: 12px–20px
Modals: 20px–28px
Album covers: 8px–16px
Playlist covers: 12px–20px
Artist avatars: circle or rounded card depending context
PlayerBar: 0px top-level fixed bar, inner controls rounded
QueuePanel: 16px–24px when overlay, 0px when fixed edge panel
```

## Shadow System

Recommended tokens:

```css
:root {
  --mf-shadow-card: 0 8px 24px rgba(0, 0, 0, 0.25);
  --mf-shadow-card-soft: 0 8px 20px rgba(0, 0, 0, 0.18);
  --mf-shadow-menu: 0 16px 40px rgba(0, 0, 0, 0.45);
  --mf-shadow-modal: 0 24px 70px rgba(0, 0, 0, 0.55);
  --mf-shadow-player: 0 -12px 32px rgba(0, 0, 0, 0.45);
  --mf-shadow-queue: -16px 0 40px rgba(0, 0, 0, 0.38);
}
```

Rules:

* Use stronger shadows for menus, modals, queue panel, and player.
* Use subtle shadows for cards.
* Prefer surface shade changes over heavy shadows for normal sections.
* Avoid colorful glowing shadows unless explicitly requested.

## Layout Tokens

Recommended layout values:

```text
Sidebar width: 240px–280px
Collapsed sidebar width: 72px–88px
Topbar height: 64px–76px
PlayerBar height: 80px–96px
QueuePanel width: 340px–420px

Desktop page padding: 24px–32px
Tablet page padding: 18px–24px
Mobile page padding: 12px–16px

Section gap: 28px–48px
Card gap: 16px–24px
Song row height: 56px–72px
```

Rules:

* Avoid large empty space at the bottom of pages.
* Content must not hide behind PlayerBar.
* QueuePanel opening must not make Home cards wrap badly.
* Home/section rows should limit visible items based on available width.
* Keep layout dense enough for a music app.

## Tailwind Theme Guidance

Prefer extending Tailwind theme instead of scattering raw hex values everywhere.

Example:

```js
theme: {
  extend: {
    colors: {
      mf: {
        bg: '#0b0b0f',
        bgSoft: '#101014',
        surface: '#121212',
        surface2: '#181818',
        surface3: '#1f1f1f',
        card: '#252525',
        cardHover: '#2a2a2a',
        green: '#1ed760',
        blue: '#4f8cff',
        purple: '#8b5cf6',
        pink: '#ec4899'
      }
    },
    boxShadow: {
      'mf-card': '0 8px 24px rgba(0,0,0,0.25)',
      'mf-menu': '0 16px 40px rgba(0,0,0,0.45)',
      'mf-player': '0 -12px 32px rgba(0,0,0,0.45)',
      'mf-queue': '-16px 0 40px rgba(0,0,0,0.38)'
    }
  }
}
```

Use shared classes when the project already has them.

Suggested shared classes:

```css
.mf-page {}
.mf-panel {}
.mf-card {}
.mf-card-hover {}
.mf-section-title {}
.mf-muted {}
.mf-button-primary {}
.mf-button-secondary {}
.mf-icon-button {}
.mf-scrollbar {}
```

For MusicFlow Home specifically, preserve or standardize classes like:

```css
.home-panel {}
.home-card {}
.home-card-hover {}
.home-section-title {}
```

## Component Theme Rules

### Primary Button

```text
background: #1ed760
text: #000000
radius: pill
font-weight: 700
hover: slightly brighter green
```

Use for:

* Main play action
* Main save/generate action
* Premium CTA
* Confirm actions

### Secondary Button

```text
background: #1f1f1f
text: #ffffff
border: rgba(255,255,255,0.1)
radius: pill
```

Use for:

* Follow
* Cancel
* Add to library
* Secondary actions

### Ghost Button

```text
background: transparent
text: #b3b3b3
hover text: #ffffff
hover background: rgba(255,255,255,0.06)
```

Use for:

* Three-dot menu
* Icon actions
* Subtle controls

### Danger Button

```text
background: #ef4444
text: #ffffff
```

Use only for destructive actions.

## Music Component Rules

### SongRow

Theme:

```text
background: transparent
hover: rgba(255,255,255,0.06)
active/current: rgba(30,215,96,0.12)
text title: white
text metadata: muted
height: compact
radius: 8px–12px
```

Rules:

* Current song should be visually recognizable.
* Like button must be visible enough.
* Duration should align cleanly.
* Text must truncate.
* Row hover should not be too bright.

### SongCard / PlaylistCard / AlbumCard

Theme:

```text
background: #181818 or #1f1f1f
hover: #252525 or #2a2a2a
radius: 16px
image radius: 10px–14px
title: white, semibold
metadata: muted
```

Rules:

* Card sizes must be consistent.
* Cover image should be stable and not flicker.
* Hover play button should be circular.
* Album art should be the main color source.
* Avoid too much shadow on every card.

### ArtistCard

Theme:

```text
background: #181818 or transparent depending section
avatar: circle or rounded based on context
title: white
metadata: muted
```

Rules:

* Do not show unnecessary track count.
* Avatar should not flicker.
* Follow/menu actions should be subtle.

## Layout Component Rules

### Sidebar

Theme:

```text
background: #000000 or #0b0b0f
active: white/green
inactive: #b3b3b3
hover: white
```

Rules:

* Sidebar should feel stable and app-like.
* Do not make it overly colorful.
* Keep active route obvious.
* Icons and labels must align.

### Topbar

Theme:

```text
background: rgba(11,11,15,0.72) or solid dark
backdrop blur: only if performance is good
border-bottom: rgba(255,255,255,0.06)
```

Rules:

* Must not overlap content incorrectly.
* Search input must be readable.
* User avatar/menu must be visible.

### PlayerBar

Theme:

```text
background: rgba(12,12,16,0.96)
border-top: rgba(255,255,255,0.08)
shadow: var(--mf-shadow-player)
height: 80px–96px
```

Rules:

* PlayerBar must remain visible on normal user pages.
* Current song text must truncate.
* Controls must be high contrast.
* Progress and volume sliders must be easy to use.
* Do not add heavy blur if it causes lag.

### QueuePanel

Theme:

```text
background: #101014 or #121212
border-left: rgba(255,255,255,0.08)
shadow: var(--mf-shadow-queue)
width desktop: 340px–420px
```

Rules:

* Open/close animation should be smooth.
* Queue rows should be compact.
* Current song in queue should be highlighted.
* Opening queue should not break Home layout.
* On mobile, queue should become overlay/fullscreen if supported.

## Page Theme Rules

### Home Page

Rules:

* Sections should be compact and clear.
* Use "Xem tất cả" where useful.
* Keep cards in a single clean row where intended.
* When queue opens, reduce visible items instead of wrapping badly.
* Avoid repeated playlist sections.
* Avoid oversized section blocks.

### Search Page

Rules:

* Search input should be pill-shaped and high contrast.
* Genre cards should use cover images/artwork.
* Avoid text overlay if the cover already contains text.
* Results must be grouped clearly.

### Playlist Detail Page

Rules:

* Header should feel premium.
* Cover/title/owner/actions must align cleanly.
* Manual playlist actions can show if user owns it.
* System/AI playlist edit controls must be hidden.
* Song list should use standard SongRow.

### Artist Detail Page

Rules:

* Header can use artist image/color mood.
* Popular songs should be limited with "Xem tất cả".
* Discography should not overwhelm.
* Related artists should use standard ArtistCard.
* Keep action buttons clean.

### Album Detail Page

Rules:

* Header similar to playlist detail but album-focused.
* Song list compact.
* Remove unnecessary external service buttons unless requested.
* Cover should not flicker.

### Profile Page

Rules:

* Premium, clean, Spotify-inspired.
* Top songs/month and top artists/month should show limited items.
* "Xem tất cả" should be available where useful.
* Edit profile modal should be subtle and polished.

### Premium Page

Theme:

```text
dark luxury
clear pricing cards
trustworthy QR/payment area
high contrast
minimal clutter
```

Rules:

* Plan cards must be readable.
* Payment QR area should feel secure.
* Do not fake success state in real app.
* Countdown/status should be clear.

### Admin Dashboard

Admin can be dark or lighter dashboard style, but must be readable.

Rules:

* Stat cards should have clear hierarchy.
* Charts should fit card height.
* Tables should support density.
* Filters/search should be visible.
* Avoid unreadable colored text on colored backgrounds.
* Admin UI should feel professional, not playful.

## Responsive Rules

### Desktop

* Full sidebar.
* Full PlayerBar.
* QueuePanel may open on the right.
* Content adapts to queue width.
* Card rows remain aligned.

### Tablet

* Reduce columns.
* Keep PlayerBar usable.
* Avoid text overflow.
* Queue should not squeeze layout too much.

### Mobile

* Avoid horizontal overflow.
* Use compact cards.
* Important actions must not rely only on hover.
* PlayerBar must remain usable.
* Queue should become overlay/fullscreen if supported.
* Modals and menus must fit viewport.

## Motion Rules

Use:

```text
transition duration: 150ms–250ms
ease-out for hover/open
small scale on play buttons
opacity/translate for menus
```

Avoid:

* Heavy animations on large lists
* Overdone page transitions
* Repeated expensive blur
* Layout-shifting animations
* Motion that causes queue lag

## Accessibility Rules

* Keep contrast readable.
* Interactive icons need hover/focus states.
* Buttons must be actual buttons.
* Do not use color alone for important state.
* Text should not be too small.
* Keyboard focus should not be removed without replacement.

## Do

* Use dark immersive surfaces.
* Keep album art visually important.
* Use accent colors functionally.
* Standardize cards, buttons, panels.
* Keep Home responsive with queue open.
* Keep PlayerBar/QueuePanel visually stable.
* Keep admin pages readable.
* Use real data states: loading, empty, error.
* Test desktop/tablet/mobile.

## Don't

* Do not use random one-off colors.
* Do not create a different theme per page.
* Do not make user app bright/pastel without explicit request.
* Do not overuse glassmorphism.
* Do not overuse gradients.
* Do not add heavy motion that makes queue/player lag.
* Do not break PlayerBar.
* Do not break QueuePanel.
* Do not change `/uploads/...` media behavior.
* Do not introduce React/shadcn dependencies into the Vue app.
* Do not hide important mobile actions behind hover.

## Output Format

When theme work is complete, report:

```text
Theme update summary:
- ...

Files changed:
- ...

Tokens/classes changed:
- ...

Components/pages affected:
- ...

Responsive behavior:
- Desktop:
- Tablet:
- Mobile:

Safety check:
- PlayerBar affected: yes/no
- QueuePanel affected: yes/no
- /uploads runtime URL affected: yes/no
- API contract changed: yes/no
- React/shadcn added: yes/no

Manual test:
- ...
```

## Reminder

MusicFlow's current visual identity should stay close to a **dark premium music streaming app**. When improving UI, make it cleaner, more consistent, and more professional, but do not change the product into a generic light SaaS dashboard or a decorative AI template.
