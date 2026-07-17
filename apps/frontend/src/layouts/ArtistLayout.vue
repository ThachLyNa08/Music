<template>
  <div class="artist-shell">
    <aside class="artist-sidebar">
      <div class="logo-area">
        <div class="logo-box">MF</div>
        <div class="logo-text">
          <span class="title">Artist Studio</span>
          <span class="subtitle">MusicFlow</span>
        </div>
      </div>

      <nav class="nav-section">
        <div class="nav-label">Menu</div>

        <RouterLink to="/artist/dashboard" class="nav-item" active-class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          Tổng quan
        </RouterLink>

        <RouterLink to="/artist/profile" class="nav-item" active-class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          Hồ sơ nghệ sĩ
        </RouterLink>

        <RouterLink to="/artist/songs" class="nav-item" active-class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          Bài hát
        </RouterLink>

        <RouterLink to="/artist/albums" class="nav-item" active-class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Album
        </RouterLink>


      </nav>

      <div class="logout-area">
        <button type="button" class="logout-btn" @click="handleLogout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Đăng xuất
        </button>
      </div>
    </aside>

    <main class="artist-main" ref="artistMainRef">
      <router-view v-slot="{ Component, route: currentRoute }">
        <transition name="page-slide-up" mode="out-in">
          <component :is="Component" :key="currentRoute.path" />
        </transition>
      </router-view>
    </main>

    <ConfirmDialog
      v-model:open="showLogoutConfirm"
      title="Xác nhận đăng xuất"
      message="Bạn có chắc chắn muốn đăng xuất khỏi Artist Studio?"
      confirmText="Đăng xuất"
      cancelText="Hủy"
      type="danger"
      theme="dark"
      @confirm="performLogout"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const auth = useAuthStore()
const showLogoutConfirm = ref(false)
const route = useRoute()
const artistMainRef = ref(null)

watch(() => route.path, () => {
  if (artistMainRef.value) {
    artistMainRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

const handleLogout = () => {
  showLogoutConfirm.value = true
}

const performLogout = () => {
  auth.logout()
}
</script>

<style scoped>
.artist-shell {
  height: 100vh;
  overflow: hidden;
  display: flex;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.artist-sidebar {
  width: 220px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 28px 0;
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 100;
}

/* Logo Area */
.logo-area {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 24px;
  margin-bottom: 36px;
}
.logo-box {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, var(--accent), #00b894);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
  color: white;
  letter-spacing: -0.5px;
  box-shadow: 0 4px 12px rgba(0, 212, 170, 0.25);
}
.logo-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.logo-text .title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.logo-text .subtitle {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

/* Navigation */
.nav-section {
  flex: 1;
  padding: 0 16px;
}
.nav-label {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 0 12px;
  margin-bottom: 10px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  position: relative;
  transition: all 0.2s;
}
.nav-item:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.03);
}
.nav-item.active {
  color: var(--text-primary);
  background: var(--bg-card);
}
.nav-item.active::before {
  content: "";
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent);
  border-radius: 0 3px 3px 0;
}
.nav-item svg {
  width: 18px;
  height: 18px;
  stroke-width: 2;
  flex-shrink: 0;
}



/* Logout */
.logout-area {
  padding: 0 16px;
  margin-top: auto;
  padding-top: 20px;
}
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px;
  background: transparent;
  border: 1px solid rgba(255, 71, 87, 0.2);
  border-radius: 8px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.logout-btn:hover {
  background: rgba(255, 71, 87, 0.1);
  border-color: rgba(255, 71, 87, 0.3);
}
.logout-btn svg {
  width: 16px;
  height: 16px;
}

.artist-main {
  flex: 1;
  padding: var(--main-py) var(--main-px);
  margin-left: 220px;
  height: 100vh;
  overflow-y: auto;
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

/* Page Transition */
.page-slide-up-enter-active,
.page-slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-up-enter-from {
  opacity: 0;
  transform: translateY(15px);
}

.page-slide-up-leave-to {
  opacity: 0;
  transform: translateY(-15px);
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
