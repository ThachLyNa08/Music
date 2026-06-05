<template>
  <div class="admin-shell">
    <!-- ADMIN SIDEBAR -->
    <aside class="admin-sidebar">
      <div class="brand">
        <span class="brand-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
        </span>
        <div class="brand-text">
          <div class="brand-name">MusicFlow</div>
          <div class="brand-sub">Admin Panel</div>
        </div>
      </div>

      <nav class="nav-menu">
        <RouterLink to="/admin" class="nav-item" :class="{ active: $route.path === '/admin' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Dashboard
        </RouterLink>
        <router-link to="/admin/songs" class="nav-item group" active-class="nav-item-active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 group-hover:scale-110 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" d="m9 14.25 6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
          <span class="font-semibold">Quản lý Bài hát</span>
        </router-link>

        <router-link to="/admin/artists" class="nav-item group" active-class="nav-item-active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 group-hover:scale-110 transition-transform"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
          <span class="font-semibold">Quản lý Nghệ sĩ</span>
        </router-link>

        <RouterLink to="/admin/users" class="nav-item" :class="{ active: $route.path === '/admin/users' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.35v1.35m0 0a2.25 2.25 0 011.66 1.66m0 0H15.75M12 4.35a2.25 2.25 0 00-1.66 1.66m0 0H8.25m0 0v1.35m0 0A2.25 2.25 0 009.91 9.91m0 0H12m0 0a2.25 2.25 0 011.66 1.66M12 12v3.75m0 0a2.25 2.25 0 01-1.66 1.66m0 0H8.25m0 0v1.35m0 0a2.25 2.25 0 001.66 1.66m0 0H12m0 0a2.25 2.25 0 011.66-1.66M12 19.5v-3.75m0 0a2.25 2.25 0 00-1.66-1.66m0 0H8.25" /></svg>
          Quản lý Thành viên
        </RouterLink>
        <RouterLink to="/admin/transactions" class="nav-item" :class="{ active: $route.path === '/admin/transactions' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1M3 12h18" /></svg>
          Lịch sử Giao dịch
        </RouterLink>
      </nav>

      <div class="spacer"></div>
    </aside>

    <!-- ADMIN MAIN -->
    <main class="admin-main">
      <!-- TOPBAR -->
      <header class="admin-topbar">
        <div class="page-title">{{ routeName }}</div>
        
        <div class="user-menu" ref="userMenuRef">
          <div class="admin-badge">Admin</div>
          <button class="user-avatar" @click.stop="toggleDropdown">
            {{ userInitial }}
          </button>
          
          <div v-if="isDropdownOpen" class="user-dropdown">
            <button class="dropdown-item logout" @click="handleLogout">Đăng xuất</button>
          </div>
        </div>
      </header>

      <!-- CONTENT AREA -->
      <div class="content-scroll">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const auth = useAuthStore()
const theme = useThemeStore()
const router = useRouter()
const route = useRoute()

const isDropdownOpen = ref(false)
const userMenuRef = ref(null)

const userInitial = computed(() => auth.user?.display_name?.charAt(0).toUpperCase() || 'A')

const routeName = computed(() => {
  if (route.path === '/admin') return 'Thống kê Tổng quan'
  if (route.path === '/admin/songs') return 'Quản lý Bài hát'
  if (route.path === '/admin/upload') return 'Thêm Bài hát mới'
  if (route.path === '/admin/artists') return 'Quản lý Nghệ sĩ'
  if (route.path === '/admin/users') return 'Quản lý Thành viên'
  if (route.path === '/admin/transactions') return 'Quản lý Giao dịch'
  return 'Quản trị hệ thống'
})

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
}

onMounted(() => {
  document.documentElement.classList.remove('dark')
  document.body.classList.remove('dark')
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
  theme.applyTheme() // Restore dark mode when leaving admin
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');

* { box-sizing: border-box; }

.admin-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  background: #f0f2f5;
  font-family: 'Be Vietnam Pro', sans-serif;
  overflow: hidden;
}

/* SIDEBAR */
.admin-sidebar {
  width: 230px;
  background: #ffffff;
  border-right: 1px solid #e4e6eb;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.brand {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #f0f2f5;
}
.brand-icon { color: #a29bfe; display: flex; }
.brand-name { font-size: 20px; font-weight: 800; color: #2d3436; line-height: 1.1; }
.brand-sub { font-size: 12px; color: #636e72; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

.nav-menu { padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; }
.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; border-radius: 12px;
  font-size: 14px; font-weight: 600; color: #636e72;
  text-decoration: none; border: none; background: transparent; cursor: pointer;
  transition: all 0.2s; text-align: left;
}
.nav-item:hover { background: #f4f7f6; color: #2d3436; }
.nav-item.active,
.nav-item-active { background: rgba(162,155,254,0.1); color: #6c5ce7; }

.spacer { flex: 1; }
.return-btn { color: #b2bec3; }
.return-btn:hover { background: #ffeaa7; color: #d63031; }

/* MAIN AREA */
.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  min-width: 0;
}

/* TOPBAR */
.admin-topbar {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e4e6eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 5;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: #2d3436;
}

.user-menu { display: flex; align-items: center; gap: 12px; position: relative; }
.admin-badge { background: #fd79a8; color: white; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
.user-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; border: none; cursor: pointer;
}

.user-dropdown {
  position: absolute; top: 100%; right: 0; margin-top: 8px;
  width: 180px; background: white; border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  padding: 8px; border: 1px solid #f0f2f5;
  display: flex; flex-direction: column;
}
.dropdown-item {
  padding: 10px 14px; border-radius: 8px; font-family: inherit; font-size: 14px; font-weight: 600;
  background: none; border: none; text-align: left; cursor: pointer;
}
.dropdown-item.logout { color: #d63031; }
.dropdown-item.logout:hover { background: rgba(214,48,49,0.1); }

/* CONTENT */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  min-width: 0;
  max-width: 100%;
}

:global(.dark) .admin-shell {
  background: #0b0f19;
}

:global(.dark) .admin-sidebar,
:global(.dark) .admin-topbar {
  background: rgba(17, 24, 39, 0.94);
  border-color: rgba(148, 163, 184, 0.14);
}

:global(.dark) .brand {
  border-color: rgba(148, 163, 184, 0.14);
}

:global(.dark) .brand-name,
:global(.dark) .page-title {
  color: #f8fafc;
}

:global(.dark) .brand-sub {
  color: #94a3b8;
}

:global(.dark) .nav-item {
  color: #cbd5e1;
}

:global(.dark) .nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

:global(.dark) .nav-item.active,
:global(.dark) .nav-item-active {
  background: rgba(124, 58, 237, 0.18);
  color: #ffffff;
}

:global(.dark) .user-dropdown {
  background: #111827;
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
}

:global(.dark) .dropdown-item.logout:hover {
  background: rgba(239, 68, 68, 0.14);
}
</style>
