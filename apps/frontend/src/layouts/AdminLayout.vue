<template>
  <div class="admin-shell">
    <div v-if="isMobileSidebarOpen" class="sidebar-backdrop" @click="closeMobileSidebar"></div>
    <aside class="admin-sidebar" :class="{ 'collapsed': isSidebarCollapsed, 'mobile-open': isMobileSidebarOpen }">
      <div class="brand">
        <div class="brand-left" v-if="!isSidebarCollapsed">
          <span class="brand-icon">
            <MfIcon name="album" filled size="28" />
          </span>
          <div class="brand-text">
            <div class="brand-name">MusicFlow</div>
            <div class="brand-sub">Admin Panel</div>
          </div>
        </div>
        <div class="brand-left collapsed" v-else>
          <span class="brand-icon">
            <MfIcon name="album" filled size="28" />
          </span>
        </div>

        <!-- Toggle button is now absolute -->
        <button class="sidebar-toggle" @click="toggleSidebar" :title="isSidebarCollapsed ? 'Mở rộng' : 'Thu nhỏ'">
          <MfIcon :name="isSidebarCollapsed ? 'chevron_right' : 'chevron_left'" size="20" />
        </button>
      </div>

      <nav class="nav-menu" aria-label="Admin navigation">
        <section v-for="group in visibleMenu" :key="group.key" class="nav-group">
          <button
            type="button"
            class="nav-group-button"
            :class="{ active: isGroupActive(group), open: isGroupOpen(group.key) }"
            @click="toggleGroup(group.key)"
            :title="isSidebarCollapsed ? group.label : ''"
          >
            <span class="nav-group-title">
              <MfIcon :name="group.icon" size="20" />
              <span class="text-label" v-show="!isSidebarCollapsed">{{ group.label }}</span>
            </span>
            <span v-if="groupBadge(group) > 0 && !isSidebarCollapsed" class="nav-badge">{{ groupBadge(group) }}</span>
            <MfIcon v-show="!isSidebarCollapsed" name="expand_more" size="20" className="chevron" />
          </button>

          <div v-show="isGroupOpen(group.key)" class="nav-children">
            <RouterLink
              v-for="item in group.children"
              :key="item.key"
              :to="item.route"
              class="nav-item"
              :class="{ active: isItemActive(item) }"
              :title="isSidebarCollapsed ? item.label : ''"
              @click="closeMobileSidebar"
            >
              <MfIcon v-show="isSidebarCollapsed" :name="item.icon" size="18" />
              <span class="text-label" v-show="!isSidebarCollapsed">{{ item.label }}</span>
              <span v-if="itemBadge(item) > 0 && !isSidebarCollapsed" class="nav-badge small">{{ itemBadge(item) }}</span>
            </RouterLink>
          </div>
        </section>
      </nav>

      <div class="spacer"></div>
    </aside>

    <main class="admin-main min-w-0 overflow-x-hidden">
      <header class="admin-topbar">
        <div class="topbar-left">
          <button class="mobile-menu-btn" @click="isMobileSidebarOpen = true">
            <MfIcon name="menu" size="24" />
          </button>
          <div class="page-title">{{ routeName }}</div>
        </div>

        <div class="topbar-actions">
          <div class="notification-wrapper" ref="notifRef">
            <button class="bell-btn" @click.stop="toggleNotifDropdown">
              <MfIcon name="notifications" size="22" />
              <span v-if="notifStore.pendingReviewCount > 0" class="bell-badge">{{ notifStore.pendingReviewCount }}</span>
            </button>
            <div v-if="isNotifOpen" class="notif-dropdown">
              <div class="notif-header">
                <h4>Thông báo</h4>
              </div>
              <div class="notif-body">
                <template v-if="notifStore.pendingReviewCount > 0">
                  <RouterLink
                    v-for="item in notifStore.latestPendingItems"
                    :key="item.type + '_' + item.id"
                    :to="{ name: 'AdminArtistSongReviews', query: { status: 'pending_review' } }"
                    class="notif-item"
                    @click="isNotifOpen = false"
                  >
                    <img :src="normalizeImageUrl(item.coverUrl) || 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=100&q=80'" class="notif-cover" />
                    <div class="notif-info">
                      <div class="notif-title"><span class="text-[10px] font-bold uppercase mr-1" :class="item.type === 'album' ? 'text-purple-500' : 'text-blue-500'">[{{ item.type === 'album' ? 'Album' : 'Bài hát' }}]</span>{{ item.title }}</div>
                      <div class="notif-artist">{{ item.artistName }}</div>
                      <div class="notif-time">{{ new Date(item.submittedAt).toLocaleString('vi-VN') }}</div>
                    </div>
                  </RouterLink>
                </template>
                <div v-else class="notif-empty">
                  Không có nội dung chờ duyệt.
                </div>
              </div>
              <div class="notif-footer" v-if="notifStore.pendingReviewCount > 0">
                <RouterLink :to="{ name: 'AdminArtistSongReviews', query: { status: 'pending_review' } }" @click="isNotifOpen = false">Xem tất cả nội dung chờ duyệt</RouterLink>
              </div>
            </div>
          </div>

          <div class="user-menu" ref="userMenuRef">
            <div class="admin-badge">Admin</div>
          <button class="user-avatar" type="button" @click.stop="toggleDropdown">
            {{ userInitial }}
          </button>

          <div v-if="isDropdownOpen" class="user-dropdown">
            <button class="dropdown-item logout" type="button" @click="handleLogout">Đăng xuất</button>
          </div>
        </div>
        </div>
      </header>

      <div class="content-scroll" ref="contentScrollRef">
        <router-view v-slot="{ Component, route: currentRoute }">
          <transition name="page-slide" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useAdminNotificationStore } from '@/stores/adminNotification'
import { useNotificationStore } from '@/stores/notification'
import { normalizeImageUrl } from '@/utils/imageUrl'
import { adminMenu, findAdminMenuItemByRouteName } from '@/config/adminMenu'

const STORAGE_KEY = 'musicflow.admin.openGroups'
const SIDEBAR_STORAGE_KEY = 'musicflow_admin_sidebar_collapsed'

const auth = useAuthStore()
const theme = useThemeStore()
const notifStore = useAdminNotificationStore()
const globalNotifStore = useNotificationStore()
const router = useRouter()
const route = useRoute()

const isSidebarCollapsed = ref(false)
const isMobileSidebarOpen = ref(false)
const isDropdownOpen = ref(false)
const isNotifOpen = ref(false)
const userMenuRef = ref(null)
const notifRef = ref(null)
const contentScrollRef = ref(null)
const openGroups = ref(new Set())
const badges = ref({})

function closeMobileSidebar() {
  isMobileSidebarOpen.value = false
}

function readSidebarState() {
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
  if (stored !== null) {
    isSidebarCollapsed.value = stored === 'true'
  }
}

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed.value))
}

const visibleMenu = computed(() => {
  return adminMenu
    .filter(group => group.key !== 'data-quality' && (!group.role || group.role === 'admin') && !group.hidden)
    .map(group => ({
      ...group,
      children: (group.children || []).filter(child => !child.hidden)
    }))
    .filter(group => group.children.length > 0)
})
const userInitial = computed(() => auth.user?.display_name?.charAt(0).toUpperCase() || 'A')
const routeName = computed(() => {
  const found = findAdminMenuItemByRouteName(route.name)
  return found?.item?.label || found?.group?.label || 'Quản trị hệ thống'
})

function readOpenGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    openGroups.value = new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    openGroups.value = new Set()
  }
}

function persistOpenGroups() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...openGroups.value]))
}

function isGroupOpen(key) {
  return openGroups.value.has(key)
}

function toggleGroup(key) {
  const next = new Set(openGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openGroups.value = next
  persistOpenGroups()
}

function routeTarget(item) {
  return router.resolve(item.route)
}

function isItemActive(item) {
  const resolved = routeTarget(item)
  return route.name === item.route?.name || route.path === resolved.path || route.path.startsWith(`${resolved.path}/`)
}

function isGroupActive(group) {
  return group.children?.some(isItemActive)
}

function openActiveGroup() {
  const activeGroup = visibleMenu.value.find(group => isGroupActive(group))
  if (!activeGroup || openGroups.value.has(activeGroup.key)) return
  const next = new Set(openGroups.value)
  next.add(activeGroup.key)
  openGroups.value = next
  persistOpenGroups()
}

function itemBadge(item) {
  return Number(badges.value[item.badgeKey] || 0)
}

function groupBadge(group) {
  if (group.badgeKey && badges.value[group.badgeKey]) return Number(badges.value[group.badgeKey])
  return (group.children || []).reduce((sum, item) => sum + itemBadge(item), 0)
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function handleLogout() {
  isDropdownOpen.value = false
  auth.logout()
}

function closeDropdown(e) {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    isDropdownOpen.value = false
  }
  if (notifRef.value && !notifRef.value.contains(e.target)) {
    isNotifOpen.value = false
  }
}

function toggleNotifDropdown() {
  isNotifOpen.value = !isNotifOpen.value
  isDropdownOpen.value = false
}

const handleReviewUpdated = () => {
  notifStore.fetchSummary()
}

watch(() => notifStore.pendingReviewCount, (val) => {
  badges.value['pendingArtistSongs'] = val
}, { immediate: true })

watch(() => globalNotifStore.socket, (s) => {
  if (s) {
    s.off('admin:review_updated', handleReviewUpdated)
    s.on('admin:review_updated', handleReviewUpdated)
  }
}, { immediate: true })

watch(() => route.fullPath, openActiveGroup, { immediate: true })

watch(() => route.path, () => {
  if (contentScrollRef.value) {
    contentScrollRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

onMounted(() => {
  readSidebarState()
  readOpenGroups()
  openActiveGroup()
  document.documentElement.classList.remove('dark')
  document.body.classList.remove('dark')
  document.addEventListener('click', closeDropdown)
  notifStore.fetchSummary()
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
  if (globalNotifStore.socket) {
    globalNotifStore.socket.off('admin:review_updated', handleReviewUpdated)
  }
  theme.applyTheme()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');

* { box-sizing: border-box; }

.admin-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #f8fafc;
  font-family: 'Be Vietnam Pro', sans-serif;
  overflow: hidden;
}

.admin-sidebar {
  width: 260px;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  z-index: 60;
  transition: width 0.3s ease-in-out;
  flex-shrink: 0;
  position: relative;
}

.admin-sidebar.collapsed {
  width: 76px;
}

.brand {
  padding: 0 20px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eef2f7;
  height: 70px;
  transition: padding 0.3s ease-in-out;
}

.admin-sidebar.collapsed .brand {
  padding: 0;
  justify-content: center;
}

.brand-left { display: flex; align-items: center; gap: 10px; width: 100%; }
.admin-sidebar.collapsed .brand-left { justify-content: center; }

.sidebar-toggle {
  position: absolute;
  right: -14px;
  top: 21px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
  flex-shrink: 0;
  z-index: 20;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}
.sidebar-toggle:hover {
  background: #f8fafc;
  color: #0f172a;
  transform: scale(1.05);
}

.brand-icon { color: #7c3aed; display: flex; }
.brand-name { font-size: 20px; font-weight: 900; color: #111827; line-height: 1.1; }
.brand-sub { margin-top: 3px; font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }

.nav-menu {
  padding: 14px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-group-button,
.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  font-family: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-group-button {
  justify-content: space-between;
  gap: 8px;
  min-height: 42px;
  padding: 0 10px;
  background: transparent;
  color: #475569;
  font-size: 13px;
  font-weight: 900;
  transition: padding 0.3s ease;
}

.admin-sidebar.collapsed .nav-group-button {
  justify-content: center;
  padding: 0;
}

.nav-group-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.admin-sidebar.collapsed .nav-group-title {
  justify-content: center;
  gap: 0;
}

.text-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-group-button:hover,
.nav-group-button.active {
  background: #f1f5f9;
  color: #111827;
}

.chevron {
  transition: transform 0.18s ease;
}

.nav-group-button.open .chevron {
  transform: rotate(180deg);
}

.nav-children {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-left: 10px;
  transition: padding 0.3s ease;
}

.admin-sidebar.collapsed .nav-children {
  padding-left: 0;
}

.nav-item {
  gap: 9px;
  min-height: 36px;
  padding: 0 10px 0 40px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  transition: padding 0.3s ease;
}

.admin-sidebar.collapsed .nav-item {
  padding: 0;
  justify-content: center;
}

.nav-item:hover {
  background: #f8fafc;
  color: #334155;
}

.nav-item.active {
  background: rgba(124, 58, 237, 0.1);
  color: #6d28d9;
}

.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.22);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  transition: all 0.2s ease;
}

.nav-badge.small {
  margin-left: auto;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 9.5px;
  font-weight: 700;
}

.nav-group-btn:hover .nav-badge,
.nav-item:hover .nav-badge,
.nav-item.active .nav-badge {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}

.spacer { flex: 1; }

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  min-width: 0;
}

.admin-topbar {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  z-index: 50;
}

.page-title {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
}

.admin-badge {
  background: #7c3aed;
  color: white;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  border: none;
  cursor: pointer;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 180px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  padding: 8px;
  border: 1px solid #eef2f7;
  display: flex;
  flex-direction: column;
}

.dropdown-item {
  padding: 10px 14px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.dropdown-item.logout { color: #dc2626; }
.dropdown-item.logout:hover { background: #fef2f2; }

.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  min-width: 0;
  max-width: 100%;
}

.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.2s ease-out;
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 900px) {
  .admin-sidebar {
    width: 240px;
  }

  .admin-topbar {
    padding: 0 18px;
  }

  .content-scroll {
    padding: 18px;
  }
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notification-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.bell-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #475569;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.bell-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.bell-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  background: #ef4444;
  color: white;
  font-size: 9.5px;
  font-weight: 700;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
}

.notif-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 12px;
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}

.notif-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notif-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.notif-body {
  max-height: 360px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.2s ease;
}

.notif-item:hover {
  background: #f8fafc;
}

.notif-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #e2e8f0;
}

.notif-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-artist {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.notif-empty {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.notif-footer {
  padding: 10px 16px;
  background: #f8fafc;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.notif-footer a {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  text-decoration: none;
}

.notif-footer a:hover {
  text-decoration: underline;
}

/* Responsive Mobile & Tablet */
.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 55;
}

.mobile-menu-btn {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 12px;
  color: #475569;
}
.mobile-menu-btn:hover {
  color: #0f172a;
}

.topbar-left {
  display: flex;
  align-items: center;
}

@media (max-width: 1024px) {
  .sidebar-backdrop {
    display: block;
  }

  .admin-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    z-index: 60;
    box-shadow: 4px 0 24px rgba(0,0,0,0.1);
    height: 100vh;
  }

  .admin-sidebar.mobile-open {
    transform: translateX(0);
  }

  /* When on mobile, hide the desktop collapse toggle button */
  .sidebar-toggle {
    display: none !important;
  }

  /* Ensure sidebar is always fully expanded on mobile */
  .admin-sidebar.collapsed,
  .admin-sidebar.mobile-open,
  .admin-sidebar {
    width: 260px !important;
  }

  .admin-sidebar .brand {
    padding: 0 20px !important;
    justify-content: flex-start !important;
  }

  .admin-sidebar .brand-left {
    display: flex !important;
    justify-content: flex-start !important;
  }

  .admin-sidebar .text-label,
  .admin-sidebar .chevron,
  .admin-sidebar .nav-badge {
    display: inline-flex !important;
  }

  .admin-sidebar .nav-children {
    padding-left: 10px !important;
  }

  .admin-sidebar .nav-item {
    padding: 0 10px 0 40px !important;
    justify-content: flex-start !important;
  }

  .mobile-menu-btn {
    display: block;
  }

  .admin-topbar {
    padding: 0 16px;
  }
}
</style>
