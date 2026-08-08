<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">Chi tiáº¿t gĂ³i Premium</h2>
        <button class="close-btn" @click="closeModal">
          <MfIcon name="close" size="24" />
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body" v-if="user">
        <!-- A. ThĂ´ng tin ngÆ°á»i dĂ¹ng -->
        <div class="info-block user-profile">
          <img v-if="user.avatar_url" :src="normalizeImageUrl(user.avatar_url, 'user')" class="avatar" alt="Avatar" />
          <div v-else class="avatar-placeholder">
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
          <div class="user-meta">
            <h3 class="user-name">{{ user.name }}</h3>
            <div class="user-email">{{ user.email }}</div>
            <div class="user-id">User ID: {{ user.user_id }}</div>
            <button class="link-btn mt-2" @click="goToUserDetail">
              <MfIcon name="open_in_new" size="14" /> Má»Ÿ há»“ sÆ¡ ngÆ°á»i dĂ¹ng
            </button>
          </div>
        </div>

        <!-- B. Tráº¡ng thĂ¡i gĂ³i -->
        <div class="info-block package-status">
          <div class="block-header">Tráº¡ng thĂ¡i gĂ³i</div>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">GĂ³i hiá»‡n táº¡i</span>
              <span class="value font-bold">{{ user.plan_name && user.plan_name !== '-' ? user.plan_name : 'Free' }}</span>
            </div>
            <div class="status-item">
              <span class="label">Tráº¡ng thĂ¡i</span>
              <span class="status-badge" :class="user.premium_status">
                {{ formatPremiumStatus(user.premium_status) }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">NgĂ y báº¯t Ä‘áº§u</span>
              <span class="value">{{ formatDate(user.premium_started_at) }}</span>
            </div>
            <div class="status-item">
              <span class="label">NgĂ y háº¿t háº¡n</span>
              <span class="value" :class="{'text-rose-500': user.premium_status === 'expired'}">
                {{ formatDate(user.premium_expires_at) }}
              </span>
            </div>
            <div class="status-item full-width" v-if="user.days_remaining !== null">
              <span class="label">Thá»i gian cĂ²n láº¡i</span>
              <span class="value" :class="{'text-rose-500': user.days_remaining <= 7, 'text-slate-400': user.days_remaining < 0}">
                {{ formatDaysRemaining(user.days_remaining) }}
              </span>
            </div>
          </div>
        </div>

        <!-- C. Tá»•ng quan thanh toĂ¡n -->
        <div class="info-block payment-summary">
          <div class="block-header">Tá»•ng quan thanh toĂ¡n</div>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">Tá»•ng chi tiĂªu</span>
              <span class="value font-bold text-indigo-600">{{ formatCurrency(user.total_spent) }}</span>
            </div>
            <div class="status-item">
              <span class="label">Láº§n thanh toĂ¡n cuá»‘i</span>
              <span class="value">{{ formatDate(user.last_paid_at) }}</span>
            </div>
            <div class="status-item full-width">
              <span class="label">MĂ£ giao dá»‹ch gáº§n nháº¥t</span>
              <span class="value font-mono bg-slate-100 px-2 py-1 rounded text-sm">
                {{ user.last_transaction_code ? '#' + user.last_transaction_code : 'ChÆ°a cĂ³' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="link-btn mr-auto" @click="goToTransactions">
          <MfIcon name="receipt_long" size="16" /> Xem lá»‹ch sá»­ giao dá»‹ch
        </button>
        
        <div class="action-buttons">
          <button v-if="user?.premium_status === 'active' || user?.premium_status === 'expiring_soon'" 
                  class="btn-danger" @click="emitAction('cancel')">
            Há»§y Premium
          </button>
          <button class="btn-primary" @click="emitAction(user?.plan_id ? 'extend' : 'activate')">
            {{ user?.plan_id ? 'Gia háº¡n thĂªm' : 'KĂ­ch hoáº¡t Premium' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { normalizeImageUrl } from '@/utils/imageUrl'
import MfIcon from '@/components/common/MfIcon.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  user: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'action'])
const router = useRouter()

function handleKeydown(e) {
  if (e.key === 'Escape' && props.isOpen) {
    closeModal()
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    document.body.classList.add('overflow-hidden')
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.body.classList.remove('overflow-hidden')
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
  document.removeEventListener('keydown', handleKeydown)
})

function closeModal() {
  emit('close')
}

function emitAction(actionType) {
  closeModal()
  emit('action', actionType, props.user)
}

function goToUserDetail() {
  if (props.user) {
    closeModal()
    router.push(`/admin/users/${props.user.user_id}`)
  }
}

function goToTransactions() {
  if (props.user) {
    closeModal()
    // Using AdminUserDetailView with tab if possible, or fallback to payments filter
    router.push(`/admin/users/${props.user.user_id}`)
  }
}

function formatCurrency(val) {
  if (val == null) return '0 â‚«'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function formatDate(dateStr) {
  if (!dateStr) return 'â€”'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

function formatDaysRemaining(days) {
  if (days < 0) return `QuĂ¡ háº¡n ${Math.abs(days)} ngĂ y`
  if (days === 0) return 'Háº¿t háº¡n hĂ´m nay'
  return `CĂ²n ${days} ngĂ y`
}

function formatPremiumStatus(status) {
  switch (status) {
    case 'active': return 'Äang hoáº¡t Ä‘á»™ng'
    case 'expiring_soon': return 'Sáº¯p háº¿t háº¡n'
    case 'expired': return 'ÄĂ£ háº¿t háº¡n'
    case 'none': return 'ChÆ°a Premium'
    default: return status
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  width: 100%;
  max-width: 672px; /* max-w-2xl */
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: white;
  flex-shrink: 0;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
}
.close-btn:hover {
  background: #f1f5f9;
  color: #475569;
}

.modal-body {
  padding: 20px 24px 24px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-block {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 16px;
  padding: 16px;
}

.block-header {
  font-size: 14px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.user-profile {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.avatar, .avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  flex-shrink: 0;
}

.avatar {
  object-fit: cover;
}

.avatar-placeholder {
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: 700;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.user-email {
  color: #64748b;
  font-size: 14px;
}

.user-id {
  color: #94a3b8;
  font-size: 12px;
  font-family: monospace;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-item.full-width {
  grid-column: 1 / -1;
}

.label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: #0f172a;
  font-weight: 600;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}

.status-badge.active { background: #d1fae5; color: #059669; }
.status-badge.expiring_soon { background: #fef3c7; color: #d97706; }
.status-badge.expired { background: #ffe4e6; color: #e11d48; }
.status-badge.none { background: #f1f5f9; color: #64748b; }

.modal-footer {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #f1f5f9;
  gap: 12px;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.btn-primary {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #6366f1;
  color: white;
  border: none;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover { background: #4f46e5; }

.btn-secondary {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { background: #e2e8f0; }

.btn-danger {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: #ef4444;
  border: 1px solid #fecaca;
  padding: 0 15px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-danger:hover {
  background: #fef2f2;
}

.link-btn {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #6366f1;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  padding: 0 10px;
  margin-left: -8px;
  border-radius: 8px;
  transition: all 0.2s;
}
.link-btn:hover {
  background: #eef2ff;
}
</style>

