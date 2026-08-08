<template>
  <div class="fixed inset-0 z-[10000] flex items-center justify-center bg-[#020807]/85 px-4 py-6 backdrop-blur-md">
    <section class="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-300/20 bg-[#07110d] shadow-2xl shadow-black/50">
      <div class="border-b border-white/10 bg-gradient-to-r from-[#092315] via-[#0b2c1c] to-[#081821] px-6 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-lg font-black text-slate-950">
            !
          </div>
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">MusicFlow</p>
            <h2 class="mt-1 text-xl font-black text-white">Tài khoản đã bị khóa</h2>
          </div>
        </div>
      </div>

      <div class="space-y-4 px-6 py-5 text-sm leading-6 text-slate-200">
        <p>
          Tài khoản của bạn đã bị quản trị viên khóa. Các thao tác nghe nhạc và sử dụng hệ thống sẽ tạm dừng cho đến khi tài khoản được mở lại.
        </p>

        <div v-if="lockedReason" class="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
          <p class="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Lý do khóa</p>
          <p class="mt-2 whitespace-pre-wrap font-semibold text-white">{{ lockedReason }}</p>
        </div>

        <div v-if="canAppeal" class="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
          <p class="font-semibold text-emerald-100">
            Nếu bạn cho rằng đây là nhầm lẫn, hãy gửi khiếu nại kèm nội dung giải thích và ảnh minh chứng nếu có.
          </p>
        </div>

        <div v-else class="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-rose-100">
          Tài khoản này hiện không được phép gửi khiếu nại qua hệ thống.
        </div>
      </div>

      <footer class="flex flex-col gap-3 border-t border-white/10 bg-black/20 px-6 py-5 sm:flex-row sm:justify-end">
        <button
          v-if="canAppeal"
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:brightness-110"
          @click="goToAppeal"
        >
          Gửi khiếu nại
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
          @click="$emit('logout')"
        >
          Đăng xuất
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  account: {
    type: Object,
    required: true,
  },
})

defineEmits(['logout'])

const router = useRouter()
const lockedReason = computed(() => props.account?.locked_reason || 'Không có lý do cụ thể.')
const canAppeal = computed(() => Boolean(props.account?.allow_appeal && props.account?.appeal_token))

function goToAppeal() {
  router.push({
    path: '/account/appeal',
    query: { token: props.account.appeal_token },
  })
}
</script>
