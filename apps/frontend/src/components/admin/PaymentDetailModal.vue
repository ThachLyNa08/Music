<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <h3>Chi tiết giao dịch</h3>
            <button class="close-btn" @click="closeModal">
              <MfIcon name="close" size="24" />
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body" v-if="loading">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Đang tải chi tiết giao dịch...</p>
            </div>
          </div>
          <div class="modal-body" v-else-if="payment">
            <!-- Thông tin giao dịch -->
            <div class="detail-section">
              <h4 class="section-title">Thông tin giao dịch</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Mã giao dịch</span>
                  <span class="detail-value font-mono">{{ payment.payment_code }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Trạng thái</span>
                  <span class="status-badge" :class="payment.status">
                    {{ formatStatus(payment.status) }}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Số tiền</span>
                  <span class="detail-value text-emerald-600 font-bold">{{ formatCurrency(payment.amount) }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Cổng thanh toán</span>
                  <span class="provider-badge" :class="payment.provider">{{ payment.provider || '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Gói Premium</span>
                  <span class="detail-value">{{ payment.plan_name || '—' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Thời hạn gói</span>
                  <span class="detail-value">{{ payment.duration_days ? payment.duration_days + ' ngày' : '—' }}</span>
                </div>
              </div>
            </div>

            <hr class="divider" />

            <!-- Khách hàng -->
            <div class="detail-section">
              <h4 class="section-title">Khách hàng</h4>
              <div class="customer-info">
                <img v-if="payment.avatar_url" :src="normalizeImageUrl(payment.avatar_url, 'user')" class="avatar" />
                <div v-else class="avatar-placeholder">{{ (payment.user_name || '').charAt(0).toUpperCase() }}</div>
                <div class="customer-details">
                  <div class="customer-name">{{ payment.user_name }}</div>
                  <div class="customer-email">{{ payment.user_email }}</div>
                  <div class="customer-id">User ID: {{ payment.user_id }}</div>
                </div>
                <button class="btn-outline-primary ml-auto" @click="goToUser(payment.user_id)">
                  <MfIcon name="open_in_new" size="16" /> Mở hồ sơ
                </button>
              </div>
            </div>

            <hr class="divider" />

            <!-- Mốc thời gian -->
            <div class="detail-section">
              <h4 class="section-title">Mốc thời gian</h4>
              <div class="timeline-list">
                <div class="timeline-item">
                  <MfIcon name="clock" size="18" class="timeline-icon text-slate-400" />
                  <div class="timeline-content">
                    <span class="timeline-label">Tạo lúc:</span>
                    <span class="timeline-time">{{ formatDateTime(payment.created_at) }}</span>
                  </div>
                </div>
                <div class="timeline-item" v-if="payment.paid_at">
                  <MfIcon name="check_circle" size="18" class="timeline-icon text-emerald-500" />
                  <div class="timeline-content">
                    <span class="timeline-label">Thanh toán lúc:</span>
                    <span class="timeline-time">{{ formatDateTime(payment.paid_at) }}</span>
                  </div>
                </div>
                <div class="timeline-item" v-if="payment.expires_at">
                  <MfIcon name="clock" size="18" class="timeline-icon text-amber-500" />
                  <div class="timeline-content">
                    <span class="timeline-label">Hết hạn lúc:</span>
                    <span class="timeline-time">{{ formatDateTime(payment.expires_at) }}</span>
                  </div>
                </div>
                <div class="timeline-item" v-if="payment.cancelled_at">
                  <MfIcon name="cancel" size="18" class="timeline-icon text-rose-500" />
                  <div class="timeline-content">
                    <span class="timeline-label">Hủy lúc:</span>
                    <span class="timeline-time">{{ formatDateTime(payment.cancelled_at) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <hr class="divider" v-if="payment.qr_content" />

            <!-- Dữ liệu kỹ thuật -->
            <div class="detail-section" v-if="payment.qr_content">
              <div class="collapsible-header" @click="toggleTechnical">
                <h4 class="section-title mb-0">Dữ liệu kỹ thuật</h4>
                <MfIcon :name="showTechnical ? 'expand_less' : 'expand_more'" size="20" />
              </div>
              <div class="collapsible-body" v-if="showTechnical">
                <div class="tech-item">
                  <span class="tech-label">Nội dung chuyển khoản (QR):</span>
                  <div class="tech-value font-mono bg-slate-50 p-2 rounded">{{ payment.qr_content }}</div>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-body" v-else>
            <div class="empty-state">
              <p>Không tìm thấy dữ liệu giao dịch.</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-secondary" @click="closeModal">Đóng</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import MfIcon from '@/components/common/MfIcon.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  isOpen: Boolean,
  paymentId: [Number, String]
})

const emit = defineEmits(['update:isOpen'])
const router = useRouter()

const loading = ref(false)
const payment = ref(null)
const showTechnical = ref(false)

watch(() => props.isOpen, (newVal) => {
  if (newVal && props.paymentId) {
    showTechnical.value = false
    fetchPaymentDetail()
  } else {
    payment.value = null
  }
})

async function fetchPaymentDetail() {
  loading.value = true
  try {
    const res = await api.get(`/admin/payments/${props.paymentId}`)
    if (res.data?.success) {
      payment.value = res.data.data
    }
  } catch (err) {
    console.error('Lỗi khi tải chi tiết giao dịch:', err)
  } finally {
    loading.value = false
  }
}

function closeModal() {
  emit('update:isOpen', false)
}

function goToUser(userId) {
  closeModal()
  router.push(`/admin/users/${userId}`)
}

function toggleTechnical() {
  showTechnical.value = !showTechnical.value
}

function formatCurrency(val) {
  if (!val) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function formatStatus(status) {
  switch (status) {
    case 'paid': return 'Đã thanh toán'
    case 'pending': return 'Đang chờ'
    case 'expired': return 'Hết hạn'
    case 'cancelled': return 'Đã hủy'
    default: return status
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
  background: #f8fafc;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
}

.btn-secondary {
  padding: 8px 16px;
  border-radius: 8px;
  background: white;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.btn-outline-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: white;
  border: 1px solid #c7d2fe;
  color: #4f46e5;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline-primary:hover {
  background: #e0e7ff;
}

/* Detail Section */
.detail-section {
  margin-bottom: 24px;
}
.detail-section:last-child {
  margin-bottom: 0;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 16px;
  margin-top: 0;
}
.mb-0 {
  margin-bottom: 0 !important;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}
.detail-value {
  font-size: 14px;
  color: #0f172a;
  font-weight: 600;
}
.font-mono {
  font-family: monospace;
}
.text-emerald-600 { color: #059669; }

/* Status Badge */
.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}
.status-badge.paid { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.status-badge.pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.status-badge.expired { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.status-badge.cancelled { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }

.provider-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
  text-transform: uppercase;
  background: #f8fafc;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.provider-badge.sepay { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.provider-badge.momo { background: #fdf2f8; color: #be185d; border-color: #fbcfe8; }
.provider-badge.vnpay { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }

.divider {
  border: none;
  border-top: 1px dashed #e2e8f0;
  margin: 0 0 24px 0;
}

/* Customer Info */
.customer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 20px;
}
.customer-details {
  display: flex;
  flex-direction: column;
}
.customer-name {
  font-weight: 700;
  color: #0f172a;
  font-size: 15px;
}
.customer-email {
  font-size: 13px;
  color: #64748b;
}
.customer-id {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
  margin-top: 2px;
}

/* Timeline */
.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.timeline-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.timeline-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.timeline-label {
  color: #64748b;
  width: 120px;
}
.timeline-time {
  color: #0f172a;
  font-weight: 600;
}
.text-slate-400 { color: #94a3b8; }
.text-emerald-500 { color: #10b981; }
.text-amber-500 { color: #f59e0b; }
.text-rose-500 { color: #f43f5e; }

/* Collapsible */
.collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  transition: background 0.2s;
}
.collapsible-header:hover {
  background: #f1f5f9;
}
.collapsible-body {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
}
.tech-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tech-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.tech-value {
  font-size: 12px;
  color: #334155;
  word-break: break-all;
}

/* Loading state */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #64748b;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f1f5f9;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  transition: transform 0.2s ease;
}
.modal-fade-enter-from .modal-content,
.modal-fade-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
