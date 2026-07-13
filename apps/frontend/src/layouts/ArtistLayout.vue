<template>
  <div class="artist-shell">
    <aside class="artist-sidebar">
      <div class="brand">
        <div class="brand-mark">MF</div>
        <div>
          <div class="brand-title">Artist Studio</div>
          <div class="brand-subtitle">MusicFlow</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink to="/artist/dashboard" class="nav-link" active-class="active">
          Tổng quan
        </RouterLink>
        <RouterLink to="/artist/profile" class="nav-link" active-class="active">
          Hồ sơ nghệ sĩ
        </RouterLink>
        <RouterLink to="/artist/songs" class="nav-link" active-class="active">
          Bài hát
        </RouterLink>
        <RouterLink to="/artist/albums" class="nav-link" active-class="active">
          Album
        </RouterLink>
      </nav>

      <div class="nav-spacer" style="flex: 1;"></div>
      <button type="button" class="logout-btn" @click="auth.logout">
        Đăng xuất
      </button>
    </aside>

    <main class="artist-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<style scoped>
.artist-shell {
  min-height: 100vh;
  display: flex;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.artist-sidebar {
  width: 220px;
  min-height: 100vh;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  color: var(--text-primary);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 0 8px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent), #00b894);
  font-weight: 800;
  font-size: 14px;
  color: #ffffff;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
}

.brand-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.nav-link:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.nav-link.muted {
  color: var(--text-muted);
  cursor: not-allowed;
}

.logout-btn {
  margin-top: auto;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 14px;
  cursor: pointer;
  text-align: center;
  border: 1px solid rgba(255, 71, 87, 0.2);
  background: transparent;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(255, 71, 87, 0.1);
}

.artist-main {
  flex: 1;
  padding: var(--main-py) var(--main-px);
  margin-left: 220px;
  min-height: 100vh;
}

@media (max-width: 760px) {
  .artist-shell {
    flex-direction: column;
  }

  .artist-sidebar {
    width: 100%;
    position: static;
    height: auto;
    min-height: auto;
  }

  .artist-main {
    margin-left: 0;
    padding: var(--main-py) var(--main-px);
  }
}
</style>

<style>
/* ARTIST STUDIO SHARED THEME */
:root {
  --main-px: 32px;
  --main-py: 28px;
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-card: #16162a;
  --bg-card-hover: #1e1e3a;
  --accent: #00d4aa;
  --accent-soft: rgba(0, 212, 170, 0.15);
  --accent-glow: rgba(0, 212, 170, 0.3);
  --text-primary: #f0f0f5;
  --text-secondary: #a0a0b8;
  --text-muted: #6b6b8a;
  --border: rgba(255, 255, 255, 0.06);
  --danger: #ff4757;
  --warning: #ffa502;
  --success: #2ed573;
  --gold: #ffd700;
  --radius: 16px;
  --radius-sm: 10px;
  --shadow: 0 4px 24px rgba(0,0,0,0.3);
}

.artist-page {
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
}

.artist-page-content {
  display: flex;
  flex-direction: column;
}

.artist-hero {
  position: relative;
  background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a1a3e 100%);
  border-bottom: 1px solid var(--border);
  margin: calc(var(--main-py) * -1) calc(var(--main-px) * -1) 24px calc(var(--main-px) * -1);
  padding: calc(var(--main-py) + 10px) calc(var(--main-px) + 10px);
  display: flex;
  align-items: center;
  gap: 28px;
  overflow: hidden;
  min-height: auto;
}

.artist-hero::before {
  content: '';
  position: absolute;
  top: -50%; right: -10%;
  width: 300px; height: 300px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
}

.artist-hero.compact {
  padding: calc(var(--main-py) + 4px) calc(var(--main-px) + 10px);
  min-height: auto;
}

@media (max-width: 760px) {
  :root {
    --main-px: 18px;
    --main-py: 18px;
  }
}

.artist-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

@media (min-width: 1100px) {
  .artist-cards-grid.two-cols {
    grid-template-columns: 1.2fr 1fr;
  }
}

.artist-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}

.artist-card-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.artist-card-title::before {
  content: '';
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.artist-inner-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  color: var(--text-primary);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.artist-inner-card:hover:not(.disabled) {
  background: var(--bg-card-hover);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.artist-panel {
  padding: 40px;
  margin: 40px;
  text-align: center;
  background: var(--bg-card);
  border-radius: var(--radius);
  color: var(--text-secondary);
}

.artist-panel.error {
  color: var(--danger);
  background: rgba(255, 71, 87, 0.1);
  border: 1px solid rgba(255, 71, 87, 0.2);
}

.artist-stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.artist-stat-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.artist-stat-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}

.artist-stat-card:hover::after {
  opacity: 1;
}

.artist-stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.artist-stat-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}

.stat-sparkline {
  height: 24px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
}

.spark-bar {
  flex: 1;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  opacity: 0.6;
  transition: opacity 0.2s, height 0.3s ease;
}

.spark-bar:hover { opacity: 1; }

.stat-change {
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
}

.stat-change.up { color: var(--success); }
.stat-change.down { color: var(--danger); }


/* AI Insights Card */
.ai-card {
  background: linear-gradient(135deg, rgba(0,212,170,0.08), rgba(0,212,170,0.02));
  border: 1px solid rgba(0,212,170,0.2);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.ai-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.ai-content { flex: 1; }
.ai-title { font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
.ai-text { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.qa-btn {
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex; align-items: center; gap: 8px;
  font-family: inherit;
}
.qa-btn:hover:not(.disabled) {
  background: var(--bg-card-hover);
  color: var(--text-primary);
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-1px);
}
.qa-btn.primary:not(.disabled) {
  background: var(--accent);
  color: #0f0f1a;
  border-color: var(--accent);
}
.qa-btn.primary:hover:not(.disabled) { background: #00e6b8; }
.qa-btn.disabled { opacity: 0.5; cursor: not-allowed; }

/* Timeline Empty State */
.timeline {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 24px;
}
.timeline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  color: var(--text-muted);
  text-align: center;
}
.timeline-empty .empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}
</style>
