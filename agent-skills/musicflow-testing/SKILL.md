---

name: musicflow-testing
description: Toolkit for interacting with and testing the local MusicFlow web application using Playwright. Use this skill when verifying MusicFlow frontend functionality, debugging UI behavior, checking responsive layout, capturing browser screenshots, viewing console logs, testing player/queue behavior, and validating user/admin flows after code changes.
license: Complete terms in LICENSE.txt
--------------------------------------

# MusicFlow Web Application Testing

This skill guides testing for **MusicFlow**, a graduation thesis project: an online music streaming system integrating recommendation algorithms and automatic playlist generation based on user behavior.

Use this skill to test the local MusicFlow web application with Playwright. It supports verifying frontend functionality, debugging UI behavior, capturing screenshots, inspecting rendered DOM, checking browser console logs, and validating important user/admin flows.

MusicFlow uses:

* Frontend: Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS
* Backend: Node.js + Express + MySQL + Redis + Socket.IO
* AI Service: Python + FastAPI
* Runtime media: `apps/backend/uploads`

## Project Paths

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

Main local services:

```bash
cd apps/backend
npm run dev
```

```bash
cd apps/frontend
npm run dev
```

```bash
cd apps/ai-service
uvicorn app.main:app --reload
```

Common ports:

```text
Backend: 3000
Frontend: 5173
AI Service: 8000
```

If the project uses different ports, inspect the actual `.env`, `vite.config.js`, backend startup log, or README before testing.

## Helper Scripts Available

Use the helper scripts from this skill as black-box tools whenever possible:

* `scripts/with_server.py` - manages server lifecycle and supports multiple servers.
* `examples/element_discovery.py` - discovers buttons, links, and inputs on a page.
* `examples/console_logging.py` - captures browser console logs during automation.
* `examples/static_html_automation.py` - automates local static HTML via `file://`.

Always run helper scripts with `--help` first to see usage.

Do not read helper source code unless:

1. Running `--help` is not enough.
2. A customized solution is absolutely necessary.
3. The script behavior is unclear after trying it as a black box.

These scripts can be large and should normally be invoked directly rather than ingested into context.

## Decision Tree: Choosing Your Approach

```text
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic webapp
    │
    └─ No, it is MusicFlow dynamic webapp
        ├─ Are backend/frontend servers already running?
        │   ├─ No → Run helper:
        │   │        python scripts/with_server.py --help
        │   │        Then use helper + a simplified Playwright script
        │   │
        │   └─ Yes → Reconnaissance-then-action:
        │            1. Navigate to local frontend
        │            2. Wait for networkidle
        │            3. Capture screenshot or inspect DOM
        │            4. Identify selectors from rendered state
        │            5. Execute actions with discovered selectors
        │            6. Capture screenshot/logs/results
```

## Example: Using with_server.py for MusicFlow

Always run:

```bash
python scripts/with_server.py --help
```

Then start backend and frontend together:

```bash
python scripts/with_server.py \
  --server "cd apps/backend && npm run dev" --port 3000 \
  --server "cd apps/frontend && npm run dev" --port 5173 \
  -- python test_musicflow.py
```

If testing AI features too:

```bash
python scripts/with_server.py \
  --server "cd apps/backend && npm run dev" --port 3000 \
  --server "cd apps/frontend && npm run dev" --port 5173 \
  --server "cd apps/ai-service && uvicorn app.main:app --reload" --port 8000 \
  -- python test_musicflow_ai.py
```

To create an automation script, include only Playwright logic because servers are managed automatically:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    # Test actions here

    browser.close()
```

## Reconnaissance-Then-Action Pattern

Use this pattern for MusicFlow because it is a dynamic Vue application.

### 1. Navigate and wait

```python
page.goto("http://localhost:5173")
page.wait_for_load_state("networkidle")
```

Never inspect DOM before waiting for `networkidle`.

### 2. Capture screenshot

```python
page.screenshot(path="/tmp/musicflow-home.png", full_page=True)
```

### 3. Inspect rendered DOM

```python
content = page.content()
buttons = page.locator("button").all()
links = page.locator("a[href]").all()
inputs = page.locator("input, textarea, select").all()
```

### 4. Identify selectors

Prefer stable selectors:

```text
role selectors
text selectors
aria-label
data-testid if available
CSS class only when stable
```

Avoid brittle selectors based on deeply nested layout unless necessary.

### 5. Execute actions

```python
page.click("text=Đăng nhập")
page.fill("input[type='email']", "user@example.com")
page.fill("input[type='password']", "password")
page.click("button[type='submit']")
page.wait_for_load_state("networkidle")
```

### 6. Capture logs and final screenshot

```python
page.screenshot(path="/tmp/musicflow-after-action.png", full_page=True)
```

## Common Pitfall

Do not inspect the DOM before waiting for Vue to render.

Bad:

```python
page.goto("http://localhost:5173")
buttons = page.locator("button").all()
```

Good:

```python
page.goto("http://localhost:5173")
page.wait_for_load_state("networkidle")
buttons = page.locator("button").all()
```

## MusicFlow Critical Test Areas

### 1. App Startup

Verify:

* Backend starts without crashing.
* Frontend starts without compile errors.
* AI service starts if the tested feature needs it.
* No repeated API 500 errors.
* No Vite overlay error.
* Redis/MySQL connection logs are acceptable.

### 2. Authentication

Test:

* Register page loads.
* Login page loads.
* User can log in with valid account.
* Invalid login shows error.
* Logout works.
* Admin-only route blocks normal user.
* Admin can access admin dashboard.

### 3. Home Page

Test:

* Home loads after login.
* Sections render with real data.
* Images load.
* No layout overflow.
* "Xem tất cả" links work where implemented.
* Cards do not collapse when QueuePanel opens.

### 4. PlayerBar

Test:

* PlayerBar is visible on user pages.
* Play button starts a song.
* Pause works.
* Next works.
* Previous works.
* Volume works.
* Seek bar works if implemented.
* Current song remains while navigating pages.
* No duplicate audio playback.

### 5. QueuePanel

Test:

* Queue opens.
* Queue closes.
* Opening queue does not freeze UI.
* Main content adapts.
* Home rows do not wrap ugly.
* Queue item click plays selected song.
* Removing queue items works if implemented.

### 6. Search

Test:

* Search by song name.
* Search by artist name.
* Search by album name.
* Empty search state.
* No results state.
* Clicking result routes correctly.

### 7. Playlist

Test:

* Create manual playlist.
* Open playlist detail.
* Add song to playlist.
* Remove song from manual playlist.
* Manual playlist edit actions visible to owner.
* System playlist edit actions hidden.
* AI/system playlist remains read-only unless clone flow exists.
* Cover fallback works.
* Empty playlist state is clean.

### 8. Artist / Album / Song Detail

Test:

* Artist detail loads.
* Follow/unfollow works if implemented.
* Popular songs render.
* Discography does not overwhelm layout.
* Album detail loads.
* Song detail loads by clicking song title.
* Like state persists after reload.

### 9. Profile

Test:

* Profile page loads.
* Edit profile modal opens.
* Avatar/name update flow works if implemented.
* Top songs this month section loads.
* Top artists this month section loads.
* "Xem tất cả" routes work.

### 10. Premium Payment

Test:

* Premium page loads.
* Plans load from backend if implemented.
* Checkout modal opens.
* QR/payment UI displays.
* Socket.IO payment status updates if implemented.
* No fake success unless explicitly marked demo.

### 11. Admin

Test:

* Admin dashboard loads.
* Manage songs loads.
* Manage artists loads.
* Manage users loads.
* Manage transactions loads.
* Upload song page loads.
* Tables support pagination/search/filter where implemented.
* Non-admin cannot access admin pages.

### 12. Recommendation / AI Features

Test:

* Recommendation sections do not use obvious hardcoded fake data.
* Cold start user gets reasonable data.
* User with listening history gets personalized data if implemented.
* AI playlist prompt flow does not return fake static tracks unless marked demo.
* Stem separation routes do not block UI if processing is heavy.

### 13. Runtime Media

Do not delete or move:

```text
apps/backend/uploads
```

Check:

* `/uploads/...` images load.
* Song audio loads.
* Playlist covers load.
* Artist images load.
* Album images load.

`/uploads/...` is a public runtime URL and should not be treated as an obsolete root folder path.

## Console Logging Pattern

Use browser console capture when debugging UI issues:

```python
from playwright.sync_api import sync_playwright

console_logs = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    def handle_console_message(msg):
        console_logs.append(f"[{msg.type}] {msg.text}")
        print(f"Console: [{msg.type}] {msg.text}")

    page.on("console", handle_console_message)

    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    # interactions here

    browser.close()

print("\n".join(console_logs))
```

Look for:

* Vue warnings
* Failed network requests
* 401/403 auth issues
* 404 image/audio
* 500 API errors
* Uncaught exceptions
* Duplicate key warnings
* Missing route errors

## Screenshot Guidance

Use screenshots for:

* Layout verification
* Responsive issues
* Queue open/closed comparison
* Admin dashboard visual bugs
* PlayerBar overlap
* Empty states
* Payment checkout
* Profile modal

Recommended viewport sizes:

```text
Mobile: 390x844
Tablet: 768x1024
Desktop: 1440x900
Large desktop: 1920x1080
```

Example:

```python
page.set_viewport_size({"width": 390, "height": 844})
page.screenshot(path="/tmp/musicflow-mobile.png", full_page=True)
```

## Best Practices

* Use bundled helper scripts as black boxes.
* Use `sync_playwright()` for synchronous scripts.
* Always close the browser.
* Wait for `networkidle` before inspection.
* Prefer role/text selectors where stable.
* Add waits for async UI:

  * `page.wait_for_selector()`
  * `page.wait_for_load_state("networkidle")`
  * `page.wait_for_timeout()` only when necessary
* Capture screenshots before and after actions.
* Capture console logs for UI bugs.
* Separate frontend bug from backend/API bug.

## Safety Rules

Do not:

* Delete files.
* Move `apps/backend/uploads`.
* Clean runtime media.
* Run destructive database scripts.
* Reset the database.
* Run migrations unless explicitly requested.
* Push Git unless explicitly requested.
* Commit `.env`, logs, uploads, storage, node_modules, dist, or media files.

## Bug Report Format

When reporting a bug, use:

```text
Bug title:
Page:
Environment:
Viewport:
Steps to reproduce:
1.
2.
3.

Actual result:
Expected result:
Console error:
Network error:
Screenshot:
Suspected files:
Severity:
Suggested fix:
```

## Regression Checklist

After major UI or logic changes, verify:

```text
- Backend starts
- Frontend starts
- Login works
- Home loads
- Images load
- Play song works
- PlayerBar stays visible
- Queue opens and closes
- Playlist detail opens
- Artist detail opens
- Album detail opens
- Search works
- Admin dashboard opens
- No major console errors
- No repeated API 500 errors
- No audio/image 404 from /uploads
```

## Output Format

When testing is complete, report:

```text
Testing summary:
- ...

Environment:
- Backend:
- Frontend:
- AI service:

Passed:
- ...

Failed:
- ...

Console / network issues:
- ...

Screenshots:
- ...

Recommended next steps:
- ...
```
