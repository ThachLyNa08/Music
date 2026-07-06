<template>
  <div class="-mt-6">
    <header class="sticky -top-6 z-40 bg-white/95 backdrop-blur dark:bg-bg-card/95 border-b border-gray-200 dark:border-bg-border -mx-6 px-6 pt-4 pb-3 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Quản lý Premium</h1>
        <p class="text-gray-500 dark:text-text-secondary mt-1 text-xs font-medium">Theo dõi và phân quyền Premium cho các thành viên hệ thống</p>
      </div>
      <div class="mt-4 md:mt-0 flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
        <AdminExportButton :loading="exportLoading" @click="handleExport" />
      </div>
    </header>

    <div class="space-y-4 pb-8">
      <!-- Overview Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <AdminKpiCard 
        title="Người dùng Premium" 
        :value="summary?.totalPremiumUsers ?? 0" 
        icon="workspace_premium" 
        tone="indigo" 
        :loading="isSummaryLoading"
        iconPosition="left"
        compact
      >
        <template #subtext v-if="!isSummaryLoading">
          <span v-if="(summary?.usersAddedThisMonth ?? 0) - (summary?.usersAddedLastMonth ?? 0) >= 0" class="text-emerald-600 font-medium">
            &uarr; +{{ (summary?.usersAddedThisMonth ?? 0) - (summary?.usersAddedLastMonth ?? 0) }} so với tháng trước
          </span>
          <span v-else class="text-rose-600 font-medium">
            &darr; {{ (summary?.usersAddedThisMonth ?? 0) - (summary?.usersAddedLastMonth ?? 0) }} so với tháng trước
          </span>
        </template>
      </AdminKpiCard>
      
      <AdminKpiCard 
        title="Sắp hết hạn (7 ngày)" 
        :value="summary?.expiringSoonUsers ?? 0" 
        icon="history" 
        tone="amber" 
        :loading="isSummaryLoading"
        iconPosition="left"
        compact
      >
        <template #subtext v-if="!isSummaryLoading">
          <span v-if="(summary?.expiringSoonUsers ?? 0) === 0" class="text-emerald-600 font-medium">
            &check; An toàn
          </span>
          <span v-else class="text-rose-600 font-medium">
            &darr; Cần chú ý
          </span>
        </template>
      </AdminKpiCard>
      
      <AdminKpiCard 
        title="Doanh thu tháng này" 
        :value="formatCurrency(summary?.monthlyPremiumRevenue)" 
        icon="payments" 
        tone="blue" 
        :loading="isSummaryLoading"
        iconPosition="left"
        compact
      >
        <template #subtext v-if="!isSummaryLoading">
          <span v-if="(summary?.monthlyPremiumRevenue ?? 0) > (summary?.lastMonthPremiumRevenue ?? 0)" class="text-emerald-600 font-medium">
            &uarr; Tăng so với tháng trước
          </span>
          <span v-else-if="(summary?.monthlyPremiumRevenue ?? 0) === 0" class="text-rose-600 font-medium">
            &darr; Chưa có giao dịch mới
          </span>
          <span v-else-if="(summary?.monthlyPremiumRevenue ?? 0) < (summary?.lastMonthPremiumRevenue ?? 0)" class="text-rose-600 font-medium">
            &darr; Giảm so với tháng trước
          </span>
          <span v-else class="text-emerald-600 font-medium">
            &check; Ổn định
          </span>
        </template>
      </AdminKpiCard>
      
      <AdminKpiCard 
        title="Giao dịch đang chờ" 
        :value="summary?.pendingPremiumTransactions ?? 0" 
        icon="history" 
        tone="slate" 
        :loading="isSummaryLoading"
        iconPosition="left"
        compact
      >
        <template #subtext v-if="!isSummaryLoading">
          <span v-if="(summary?.pendingPremiumTransactions ?? 0) === 0" class="text-emerald-600 font-medium">
            &check; Tất cả đã xử lý
          </span>
          <span v-else class="text-rose-600 font-medium">
            &darr; Cần xử lý ngay
          </span>
        </template>
      </AdminKpiCard>
    </div>

    <!-- NEW DISTRIBUTION AND TIMELINE SECTIONS -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
      <!-- Plan Distribution -->
      <div class="bg-white dark:bg-bg-card rounded-2xl border border-gray-200 dark:border-bg-border p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-1">
          <MfIcon name="category" size="18" class="text-indigo-500" />
          <h3 class="font-bold text-sm text-gray-900 dark:text-white">Phân bổ gói Premium</h3>
        </div>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-5">{{ summary?.activePremiumUsers || 0 }} người dùng đang đăng ký</p>
        
        <div v-if="isSummaryLoading" class="animate-pulse space-y-4">
          <div v-for="i in 3" :key="i">
            <div class="flex justify-between mb-2">
              <div class="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        </div>
        <div v-else-if="summary?.planDistribution?.length" class="space-y-4">
          <div v-for="(plan, index) in summary.planDistribution" :key="plan.id">
            <div class="flex justify-between items-center mb-1">
              <div class="flex items-center">
                <span class="text-xs font-semibold text-gray-800 dark:text-gray-200">{{ plan.name }}</span>
              </div>
              <div class="text-[11px] font-medium">
                <span class="text-gray-900 dark:text-white font-bold">{{ plan.user_count }}</span>
                <span class="text-gray-400 ml-1">({{ summary.activePremiumUsers ? Math.round((plan.user_count / summary.activePremiumUsers) * 100) : 0 }}%)</span>
              </div>
            </div>
            <div class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div class="h-2 rounded-full" :class="getPlanColorClass(index, 'bg')" :style="{ width: `${summary.activePremiumUsers ? Math.round((plan.user_count / summary.activePremiumUsers) * 100) : 0}%` }"></div>
            </div>
            <div class="text-[10px] text-gray-400 mt-1.5">
              {{ formatCurrency(plan.price) }} / {{ plan.duration_days >= 30 ? Math.round(plan.duration_days / 30) + ' tháng' : plan.duration_days + ' ngày' }} 
              <span v-if="plan.price > 0 && plan.user_count > 0">&middot; Tổng thu ước tính: {{ formatCurrency(plan.price * plan.user_count) }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-6 text-sm text-gray-400">Không có dữ liệu phân bổ gói.</div>
      </div>

      <!-- Timeline -->
      <div class="bg-white dark:bg-bg-card rounded-2xl border border-gray-200 dark:border-bg-border p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-1">
          <MfIcon name="clock" size="18" class="text-indigo-500" />
          <h3 class="font-bold text-sm text-gray-900 dark:text-white">Timeline hết hạn Premium</h3>
        </div>
        <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-5">Dự kiến gia hạn trong 90 ngày tới</p>
        
        <div v-if="isSummaryLoading" class="animate-pulse space-y-4">
          <div v-for="i in 4" :key="i" class="flex gap-3 items-start">
            <div class="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700 mt-1"></div>
            <div class="flex-1 flex justify-between">
              <div>
                <div class="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div class="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div class="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
        <div v-else-if="summary?.expiringTimeline?.length">
          <div class="space-y-3 max-h-[260px] overflow-y-auto no-scrollbar pr-2">
            <template v-for="(user, index) in summary.expiringTimeline" :key="user.id">
              <!-- Thẻ nhắc nhở (Dưới 7 ngày) -->
              <div v-if="getDaysRemaining(user.premium_expires_at) <= 7" class="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl p-3">
                <div class="flex items-center justify-between mb-2.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {{ user.display_name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-gray-900 dark:text-rose-100 truncate">{{ user.display_name }}</p>
                      <p class="text-[11px] text-gray-500 dark:text-rose-200/70 truncate">{{ user.email }}</p>
                    </div>
                  </div>
                  <div class="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold shrink-0">
                    {{ getDaysRemainingText(user.premium_expires_at) }}
                  </div>
                </div>
                
                <div class="w-full bg-rose-200 dark:bg-rose-800/50 rounded-full h-1 mb-2">
                  <div class="bg-rose-500 h-1 rounded-full" :style="{ width: getProgressWidth(user.premium_expires_at) }"></div>
                </div>
                
                <div class="flex justify-between items-center text-[11px]">
                  <span class="text-gray-500 dark:text-rose-200/70">Hết hạn: {{ new Date(user.premium_expires_at).toLocaleDateString('vi-VN') }}</span>
                  <button class="text-rose-600 dark:text-rose-400 font-medium hover:underline flex items-center gap-0.5">
                    Nhắc nhở &rarr;
                  </button>
                </div>
              </div>
              
              <!-- Timeline bình thường (Trên 7 ngày) -->
              <div v-else class="flex items-start gap-3 relative mt-2 pl-1">
                <!-- Vertical line -->
                <div v-if="index !== summary.expiringTimeline.length - 1 && getDaysRemaining(summary.expiringTimeline[index+1]?.premium_expires_at) > 7" class="absolute left-[9px] top-4 bottom-[-16px] w-[2px] bg-gray-100 dark:bg-gray-800"></div>
                
                <div class="w-3 h-3 rounded-full mt-1 ring-[3px] ring-white dark:ring-bg-card shrink-0 z-10" :class="getTimelineColorClass(user.premium_expires_at)"></div>
                <div class="flex-1 min-w-0 pb-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">{{ user.display_name }}</p>
                      <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate">{{ user.plan_name || 'Premium' }}</p>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                      <p class="text-xs font-bold" :class="getTimelineTextColorClass(user.premium_expires_at)">{{ new Date(user.premium_expires_at).toLocaleDateString('vi-VN') }}</p>
                      <p class="text-[10px] font-medium" :class="getTimelineTextColorClass(user.premium_expires_at)">{{ getDaysRemainingText(user.premium_expires_at) }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="text-center py-6 text-sm text-gray-400">Không có người dùng nào sắp hết hạn.</div>
      </div>
    </div>

    <!-- Filters & Search -->
    <AdminFilterBar class="relative z-30">
      <div class="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
        <div class="relative min-w-[280px] flex-1">
          <MfIcon name="search" size="16" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            ref="searchInputRef"
            v-model="filterForm.q" 
            @input="onSearchInput"
            @keyup.enter="handleEnterSearch"
            @focus="showHistory = true"
            type="text" 
            placeholder="Tìm theo tên, email hoặc ID..." 
            class="admin-input !py-2 !pl-8 !pr-8 !text-xs !rounded-lg w-full" 
            :disabled="isInitialLoading"
          />
          <button v-if="filterForm.q" @click="clearSearch" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <MfIcon name="close" size="16" />
          </button>
          
          <!-- Search History Dropdown -->
          <div v-if="showHistory && searchHistory.length > 0" class="search-history-dropdown absolute top-full left-0 right-0 mt-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-lg shadow-lg z-50 overflow-hidden py-1">
            <ul class="max-h-60 overflow-y-auto">
              <li v-for="item in searchHistory" :key="item" class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-bg-surface cursor-pointer group" @click="selectHistory(item)">
                <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 truncate">
                  <MfIcon name="history" size="14" class="text-gray-400 shrink-0" />
                  <span class="truncate">{{ item }}</span>
                </div>
                <button @click.stop="removeSearchHistory(item)" class="text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                  <MfIcon name="close" size="14" />
                </button>
              </li>
            </ul>
          </div>
        </div>
        <select v-model="filterForm.plan" @change="handleFilterChange" class="admin-input !py-2 !px-3 !text-xs !rounded-lg w-full xl:w-44 xl:shrink-0 cursor-pointer" :disabled="isPlansLoading">
          <option value="Tất cả">{{ isPlansLoading ? 'Đang tải gói...' : 'Tất cả gói' }}</option>
          <option v-for="plan in plans" :key="plan.id" :value="plan.name">{{ plan.name }}</option>
        </select>
        <select v-model="filterForm.status" @change="handleFilterChange" class="admin-input !py-2 !px-3 !text-xs !rounded-lg w-full xl:w-44 xl:shrink-0 cursor-pointer" :disabled="isInitialLoading">
          <option value="Tất cả Premium">Tất cả Premium</option>
          <option value="Đang hoạt động">Đang hoạt động</option>
          <option value="Sắp hết hạn">Sắp hết hạn</option>
          <option value="Đã hết hạn">Đã hết hạn</option>
          <option value="Chưa Premium">Chưa Premium</option>
        </select>
        <select v-model="filterForm.sort" @change="handleFilterChange" class="admin-input !py-2 !px-3 !text-xs !rounded-lg w-full xl:w-48 xl:shrink-0 cursor-pointer" :disabled="isInitialLoading">
          <option value="">Sắp xếp mặc định</option>
          <option value="Hết hạn gần nhất">Hết hạn gần nhất</option>
          <option value="Mới nâng cấp gần đây">Mới nâng cấp gần đây</option>
          <option value="Chi tiêu cao nhất">Chi tiêu cao nhất</option>
          <option value="Tên A-Z">Tên A-Z</option>
        </select>
        <AdminResetButton :disabled="isInitialLoading || isTableLoading" @click="resetFilters" class="xl:shrink-0 !h-[34px] !w-[34px] !rounded-lg" />
      </div>
    </AdminFilterBar>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col mb-8">
      <AdminTableShell 
        :loading="isInitialLoading || isTableLoading" 
        :empty="!(isInitialLoading || isTableLoading) && users.length === 0" 
        emptyTitle="Không tìm thấy người dùng" 
        emptySubtitle="Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm."
        maxHeight="432px"
      >
        <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr class="bg-gray-50 dark:bg-bg-card sticky top-0 z-30 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#334155]">
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300 min-w-[250px] max-w-[250px] sticky left-0 top-0 z-30 bg-gray-50 dark:bg-bg-card">Người dùng</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300">Trạng thái</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300">Gói hiện tại</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300">Ngày hết hạn</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300">Tổng chi</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300">Lần cuối thanh toán</th>
              <th class="py-2 px-3 font-bold text-black dark:text-gray-300 text-right sticky right-0 top-0 z-30 bg-gray-50 dark:bg-bg-card w-24">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
            <tr v-for="(u, index) in users" :key="u.user_id" class="hover:bg-gray-50 dark:hover:bg-bg-card transition-colors group cursor-pointer" @click="goToDetail(u.user_id)">
              <td class="py-2 px-3 sticky left-0 z-10 bg-white dark:bg-bg-surface group-hover:bg-gray-50 dark:group-hover:bg-bg-card transition-colors max-w-[250px]">
                <div class="flex items-center gap-3">
                  <img v-if="u.avatar_url" :src="normalizeImageUrl(u.avatar_url, 'user')" class="w-10 h-10 rounded-full object-cover" :alt="u.name" />
                  <div v-else class="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">
                    {{ u.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-gray-900 dark:text-white truncate">{{ u.name }}</span>
                    <span class="text-xs text-gray-500 truncate">{{ u.email }}</span>
                  </div>
                </div>
              </td>
              <td class="py-2 px-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" :class="u.premium_status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : (u.premium_status === 'expiring_soon' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : (u.premium_status === 'expired' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'))">
                  {{ formatPremiumStatus(u.premium_status) }}
                </span>
              </td>
              <td class="py-2 px-3">
                <span class="inline-flex px-2 py-0.5 rounded text-[11px] font-bold tracking-wider" :class="u.plan_id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'">
                  {{ (u.plan_name && u.plan_name !== '-') ? u.plan_name : 'Free' }}
                </span>
              </td>
              <td class="py-2 px-3">
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold" :class="{'text-rose-500': u.premium_status === 'expired' || u.premium_status === 'expiring_soon', 'text-gray-900 dark:text-white': u.premium_status === 'active'}">
                    {{ u.premium_expires_at ? new Date(u.premium_expires_at).toLocaleDateString('vi-VN') : '—' }}
                  </span>
                  <span v-if="u.days_remaining !== null" class="text-[10px] font-bold" :class="{'text-rose-500': u.days_remaining <= 7, 'text-gray-500': u.days_remaining > 7, 'text-gray-400': u.days_remaining < 0}">
                    ({{ formatDaysRemaining(u.days_remaining) }})
                  </span>
                </div>
              </td>
              <td class="py-2 px-3">
                <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(u.total_spent) }}</span>
              </td>
              <td class="py-2 px-3">
                <div v-if="u.last_paid_at" class="flex flex-col gap-0.5">
                  <span class="text-xs font-bold text-gray-700 dark:text-gray-300">{{ new Date(u.last_paid_at).toLocaleDateString('vi-VN') }}</span>
                  <span v-if="u.last_transaction_code" class="text-[10px] text-gray-500 font-mono">#{{ u.last_transaction_code }}</span>
                </div>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="py-2 px-3 text-right sticky right-0 bg-white dark:bg-bg-surface group-hover:bg-gray-50 dark:group-hover:bg-bg-card transition-colors" @click.stop>
                <div class="flex justify-end">
                  <AdminActionMenu :actions="getPremiumActions(u)" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <div v-if="totalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/30 mt-auto">
        <span class="text-sm text-gray-500 dark:text-gray-400 font-medium hidden md:inline">Trang {{ currentPage }} / {{ totalPages }}</span>
        <AdminPagination v-model:currentPage="currentPage" :totalPages="totalPages" />
      </div>
    </div>
    </div>

    <!-- Modals -->
    <PremiumManageModal 
      :isOpen="showPremiumModal"
      :user="selectedUser"
      :plans="plans"
      :actionType="premiumActionType"
      @close="showPremiumModal = false"
      @refresh="fetchData"
    />

    <PremiumDetailModal
      :isOpen="showDetailModal"
      :user="selectedUser"
      @close="showDetailModal = false"
      @action="handleDetailAction"
    />

    <ConfirmDialog 
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirmText="confirmState.confirmText"
      :type="confirmState.type"
      :loading="confirmState.loading"
      @confirm="handleConfirm"
      @cancel="confirmState.open = false"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import api from '@/api/axios'
import { normalizeImageUrl } from '@/utils/imageUrl'
import MfIcon from '@/components/common/MfIcon.vue'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'
import AdminExportButton from '@/components/admin/AdminExportButton.vue'
import { downloadBlob, getFilenameFromDisposition } from '@/utils/downloadBlob'
import PremiumManageModal from '@/components/admin/PremiumManageModal.vue'
import PremiumDetailModal from '@/components/admin/PremiumDetailModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminActionMenu from '@/components/admin/AdminActionMenu.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'

const router = useRouter()
const toast = useToastStore()

// Search History
const searchHistory = ref([])
const showHistory = ref(false)
const searchInputRef = ref(null)
let searchTimeout = null

function loadSearchHistory() {
  try {
    const saved = localStorage.getItem('admin_premium_search_history')
    if (saved) searchHistory.value = JSON.parse(saved)
  } catch (e) {
    console.error(e)
  }
}

function saveSearchHistory(query) {
  if (!query) return
  const index = searchHistory.value.indexOf(query)
  if (index !== -1) searchHistory.value.splice(index, 1)
  searchHistory.value.unshift(query)
  if (searchHistory.value.length > 5) searchHistory.value.pop()
  localStorage.setItem('admin_premium_search_history', JSON.stringify(searchHistory.value))
}

function removeSearchHistory(query) {
  searchHistory.value = searchHistory.value.filter(q => q !== query)
  localStorage.setItem('admin_premium_search_history', JSON.stringify(searchHistory.value))
}

function clearAllHistory() {
  searchHistory.value = []
  localStorage.removeItem('admin_premium_search_history')
}

function selectHistory(query) {
  filterForm.value.q = query
  showHistory.value = false
  if (query.trim()) {
    saveSearchHistory(query.trim())
  }
  handleFilterChange()
}

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    handleFilterChange()
  }, 500)
}

function handleEnterSearch() {
  if (filterForm.value.q.trim()) {
    saveSearchHistory(filterForm.value.q.trim())
  }
  if (searchTimeout) clearTimeout(searchTimeout)
  handleFilterChange()
  showHistory.value = false
}

function clearSearch() {
  filterForm.value.q = ''
  if (searchTimeout) clearTimeout(searchTimeout)
  handleFilterChange()
  searchInputRef.value?.focus()
}

function handleClickOutside(e) {
  if (searchInputRef.value && !searchInputRef.value.contains(e.target) && !e.target.closest('.search-history-dropdown')) {
    showHistory.value = false
  }
}

// Loading states
const isInitialLoading = ref(true)
const isSummaryLoading = ref(true)
const isTableLoading = ref(true)
const isPlansLoading = ref(true)

const summary = ref(null)
const users = ref([])
const plans = ref([])

const filterForm = ref({
  q: '',
  status: 'Tất cả Premium',
  plan: 'Tất cả',
  sort: ''
})

const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(1)

const activeDropdown = ref(null)

const showPremiumModal = ref(false)
const showDetailModal = ref(false)
const selectedUser = ref(null)
const premiumActionType = ref('extend')

const confirmState = ref({
  open: false,
  title: '',
  message: '',
  confirmText: 'Xác nhận',
  type: 'default',
  loading: false,
  action: null
})

// Helper Functions
const planColors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500']

function getPlanColorClass(index, prefix = 'bg') {
  const colorClass = planColors[index % planColors.length]
  return prefix === 'bg' ? colorClass : colorClass.replace('bg-', 'text-')
}

function getDaysRemaining(dateString) {
  if (!dateString) return 0
  const now = new Date()
  const expiry = new Date(dateString)
  now.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  const diffTime = expiry - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getDaysRemainingText(dateString) {
  const days = getDaysRemaining(dateString)
  if (days < 0) return 'Đã hết hạn'
  if (days === 0) return 'Hết hạn hôm nay'
  return `Còn ${days} ngày`
}

function getTimelineColorClass(dateString) {
  const days = getDaysRemaining(dateString)
  if (days <= 14) return 'bg-rose-500'
  if (days <= 30) return 'bg-amber-500'
  if (days <= 60) return 'bg-blue-500'
  return 'bg-emerald-500'
}

function getTimelineTextColorClass(dateString) {
  const days = getDaysRemaining(dateString)
  if (days <= 14) return 'text-rose-600 dark:text-rose-400'
  if (days <= 30) return 'text-amber-600 dark:text-amber-400'
  if (days <= 60) return 'text-blue-600 dark:text-blue-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function getProgressWidth(dateString) {
  const days = getDaysRemaining(dateString)
  if (days <= 0) return '100%'
  if (days >= 7) return '5%'
  return `${100 - (days / 7) * 100}%`
}

function getPremiumActions(u) {
  const actions = [
    {
      label: 'Xem chi tiết gói',
      icon: 'visibility',
      onClick: () => openDetailModal(u)
    },
    {
      label: u.plan_id ? 'Gia hạn thêm' : 'Kích hoạt Premium',
      icon: 'add',
      onClick: () => openPremiumModal(u, u.plan_id ? 'extend' : 'activate')
    },
    {
      label: 'Mở hồ sơ',
      icon: 'open_in_new',
      onClick: () => goToDetail(u.user_id)
    }
  ]
  
  if (u.premium_status === 'active' || u.premium_status === 'expiring_soon') {
    actions.push({
      label: 'Hủy Premium',
      icon: 'cancel',
      danger: true,
      onClick: () => cancelPremium(u)
    })
  }
  
  return actions
}

async function fetchSummary() {
  isSummaryLoading.value = true
  try {
    const res = await api.get('/admin/premium/summary')
    summary.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải summary:', err)
  } finally {
    isSummaryLoading.value = false
  }
}

async function fetchPlans() {
  isPlansLoading.value = true
  try {
    const res = await api.get('/admin/premium/plans')
    plans.value = res.data.data
  } catch (err) {
    console.error('Lỗi khi tải plans:', err)
  } finally {
    isPlansLoading.value = false
  }
}

async function fetchUsers() {
  isTableLoading.value = true
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
      q: filterForm.value.q,
      status: filterForm.value.status,
      plan: filterForm.value.plan,
      sort: filterForm.value.sort
    }
    const res = await api.get('/admin/premium/users', { params })
    users.value = res.data.data.items
    totalPages.value = res.data.data.pagination.totalPages
  } catch (err) {
    console.error('Lỗi khi tải danh sách người dùng:', err)
    toast.showToast('Không thể tải danh sách người dùng', 'error')
    if (isInitialLoading.value) users.value = []
  } finally {
    isTableLoading.value = false
  }
}

const exportLoading = ref(false)

async function handleExport() {
  exportLoading.value = true
  try {
    const response = await api.get('/admin/premium/export', {
      params: {
        q: filterForm.value.q,
        status: filterForm.value.status,
        plan: filterForm.value.plan,
        sort: filterForm.value.sort
      },
      responseType: 'blob'
    })
    
    const filename = getFilenameFromDisposition(
      response.headers?.['content-disposition'],
      'musicflow-premium.csv'
    )
    downloadBlob(response.data, filename)
  } catch (error) {
    toast.showToast('Không thể xuất báo cáo. Vui lòng thử lại.', 'error')
  } finally {
    exportLoading.value = false
  }
}

async function fetchData() {
  await Promise.allSettled([
    fetchSummary(),
    fetchUsers()
  ])
}

function handleFilterChange() {
  if (currentPage.value !== 1) {
    currentPage.value = 1
  } else {
    fetchUsers()
  }
}

watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal && !isInitialLoading.value) {
    fetchUsers()
  }
})

function resetFilters() {
  filterForm.value = {
    q: '',
    status: 'Tất cả Premium',
    plan: 'Tất cả',
    sort: ''
  }
  currentPage.value = 1
  fetchUsers()
}

function formatCurrency(val) {
  if (val == null) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function formatPremiumStatus(status) {
  switch (status) {
    case 'active': return 'Đang hoạt động'
    case 'expiring_soon': return 'Sắp hết hạn'
    case 'expired': return 'Đã hết hạn'
    case 'none': return 'Chưa Premium'
    default: return status
  }
}

function formatDaysRemaining(days) {
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days === 0) return 'Hết hạn hôm nay'
  return `Còn ${days} ngày`
}

function goToDetail(userId) {
  router.push(`/admin/users/${userId}`)
}

function openDetailModal(user) {
  selectedUser.value = user
  showDetailModal.value = true
}

function handleDetailAction(actionType, user) {
  if (actionType === 'cancel') {
    cancelPremium(user)
  } else {
    openPremiumModal(user, actionType)
  }
}

function openPremiumModal(user, type) {
  selectedUser.value = user
  premiumActionType.value = type
  showPremiumModal.value = true
}

function openConfirm(options) {
  confirmState.value = { ...confirmState.value, ...options, open: true, loading: false }
}

async function handleConfirm() {
  if (!confirmState.value.action) return
  confirmState.value.loading = true
  try {
    await confirmState.value.action()
  } finally {
    confirmState.value.open = false
    confirmState.value.loading = false
  }
}

function cancelPremium(user) {
  openConfirm({
    title: 'Hủy gói Premium?',
    message: `Bạn có chắc muốn hủy gói Premium của người dùng "${user.name}"? Người dùng sẽ trở về tài khoản thường ngay lập tức.`,
    confirmText: 'Hủy Premium',
    type: 'danger',
    action: async () => {
      try {
        await api.post(`/admin/premium/users/${user.user_id}/cancel`, { note: 'Admin cancelled' })
        toast.showToast('Đã hủy Premium thành công', 'success')
        fetchData()
      } catch (err) {
        console.error('Lỗi khi hủy premium:', err)
        toast.showToast(err.response?.data?.message || 'Không thể hủy gói Premium', 'error')
      }
    }
  })
}

onMounted(async () => {
  loadSearchHistory()
  document.addEventListener('click', handleClickOutside)
  
  // Parallel fetch for initial load
  await Promise.allSettled([
    fetchSummary(),
    fetchPlans(),
    fetchUsers()
  ])
  
  isInitialLoading.value = false
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.manage-premium {
  padding: 8px 16px;
  font-family: 'Be Vietnam Pro', sans-serif;
}

.page-fade-in {
  animation: fadeIn 0.25s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-section {
  margin-bottom: 24px;
  min-height: 52px;
}
.page-title {
  font-size: 28px;
  font-weight: 800;
  color: #2d3436;
  margin: 0;
}
.page-subtitle {
  color: #636e72;
  margin: 6px 0 0 0;
  font-size: 14px;
  font-weight: 500;
}

/* Stats Cards Section */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
@media (min-width: 640px) {
  .stats-overview { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .stats-overview { grid-template-columns: repeat(4, 1fr); }
}

.summary-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: transform 0.2s;
  min-height: 112px;
}
.summary-card:hover {
  transform: translateY(-2px);
}
.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.card-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.card-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 4px;
  line-height: 1;
}
.card-subline {
  font-size: 12px;
  margin-top: 6px;
  font-weight: 500;
  white-space: nowrap;
}
.text-emerald-600 { color: #059669; }
.text-rose-500 { color: #f43f5e; }
.text-amber-600 { color: #d97706; }
.text-slate-400 { color: #94a3b8; }
.skeleton-subline { width: 140px; height: 12px; border-radius: 4px; }

/* Filter bar */
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  min-height: 48px;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 250px;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 16px;
  color: #b2bec3;
}
.search-field {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border-radius: 14px;
  border: 1px solid #e4e6eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  transition: all 0.2s;
}
.search-field:focus {
  border-color: #a29bfe;
  box-shadow: 0 4px 15px rgba(162, 155, 254, 0.15);
}
.search-field:disabled {
  background: #f8f9fa;
  color: #b2bec3;
}

.filter-select-wrapper {
  min-width: 160px;
}
.filter-select {
  width: 100%;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #e4e6eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  color: #2d3436;
  outline: none;
  box-shadow: 0 4px 10px rgba(0,0,0,0.02);
  cursor: pointer;
}
.filter-select:focus {
  border-color: #a29bfe;
}
.filter-select:disabled {
  background: #f8f9fa;
  color: #b2bec3;
  cursor: not-allowed;
}

/* Table Card */
.table-container {
  background: white;
  border-radius: 20px;
  overflow-x: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,0.02);
  border: 1px solid #f0f2f5;
  min-height: 520px; 
  position: relative;
}

.users-table {
  width: 100%;
  min-width: 1000px;
  border-collapse: collapse;
  text-align: left;
  table-layout: fixed;
}
.users-table th {
  padding: 16px 24px;
  background: #f8f9fa;
  border-bottom: 2px solid #f0f2f5;
  color: #000;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.users-table td {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f2f5;
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  vertical-align: middle;
}
.user-row {
  transition: background 0.2s;
  height: 72px; /* Fixed height for rows to prevent shifting */
}
.user-row:hover {
  background: #f8f9fa;
}

/* Overlays */
.table-loading-overlay {
  position: absolute;
  top: 52px; /* Below header */
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.6);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}
.spinner-small {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(162, 155, 254, 0.2);
  border-top-color: #a29bfe;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Cell Content */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
}
.user-avatar-placeholder, .user-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(162, 155, 254, 0.15);
  flex-shrink: 0;
}
.user-avatar-placeholder {
  background: linear-gradient(135deg, #a29bfe, #74b9ff);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 15px;
}
.user-avatar-img {
  object-fit: cover;
}
.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.user-name {
  font-weight: 700;
  color: #2d3436;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-email {
  font-size: 12px;
  color: #636e72;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.status-badge.active {
  background: rgba(85, 239, 196, 0.15);
  color: #00b894;
}
.status-badge.expiring_soon {
  background: rgba(253, 203, 110, 0.15);
  color: #e17055;
}
.status-badge.expired {
  background: rgba(255, 118, 117, 0.15);
  color: #d63031;
}
.status-badge.none {
  background: rgba(223, 228, 234, 0.5);
  color: #636e72;
}

.plan-badge {
  color: #636e72;
  font-weight: 700;
  background: #f1f2f6;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  display: inline-block;
  white-space: nowrap;
}
.plan-badge.active {
  background: rgba(162, 155, 254, 0.1);
  color: #6c5ce7;
}

.expiry-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.expiry-date {
  font-weight: 600;
  color: #2d3436;
}
.expiry-days {
  font-size: 12px;
  color: #636e72;
}
.text-red-500 {
  color: #d63031 !important;
}
.text-slate-400 {
  color: #b2bec3 !important;
}

.amount-val {
  font-weight: 800;
  color: #2d3436;
}

.last-paid-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.last-paid-date {
  color: #2d3436;
}
.last-paid-code {
  font-family: monospace;
  font-size: 11px;
  background: #f1f2f6;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  color: #636e72;
}
.text-secondary {
  color: #b2bec3;
}

/* Actions Menu */
.action-menu-wrapper {
  position: relative;
  display: inline-block;
}
.btn-action-more {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-action-more:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.action-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  width: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  padding: 4px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: dropdownFade 0.2s ease;
}
.dropdown-up {
  top: auto;
  bottom: 100%;
  margin-bottom: 4px;
  margin-top: 0;
}
@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-10px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #334155;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.dropdown-item:hover {
  background: #f8fafc;
  color: #0f172a;
}
.dropdown-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 4px 0;
}
.delete-action {
  color: #e11d48;
}
.delete-action:hover {
  background: #fff1f2;
  color: #be123c;
}

/* Skeleton Loading Styles */
.skeleton-box {
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.skeleton-box::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0,
    rgba(255, 255, 255, 0.4) 20%,
    rgba(255, 255, 255, 0.4) 60%,
    rgba(255, 255, 255, 0)
  );
  animation: shimmer 1.5s infinite;
  content: '';
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}

.skeleton-label { width: 120px; height: 12px; margin-bottom: 8px; }
.skeleton-value { width: 70px; height: 26px; border-radius: 6px; }
.skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
.skeleton-text { width: 120px; height: 14px; margin-bottom: 6px; }
.skeleton-text-short { width: 80px; height: 12px; }
.skeleton-badge { width: 90px; height: 24px; border-radius: 12px; }

/* Empty state */
.empty-state-cell {
  height: 400px;
  vertical-align: middle;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #636e72;
  text-align: center;
}
.empty-state svg {
  color: #dfe6e9;
  margin-bottom: 16px;
}
.empty-state h3 {
  font-size: 18px;
  font-weight: 700;
  color: #2d3436;
  margin: 0 0 8px 0;
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* Pagination Wrapper */
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 0 8px;
  min-height: 40px;
}
</style>
