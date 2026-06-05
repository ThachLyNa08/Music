<template>
  <div class="mt-20">
    <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-10">So sánh các tính năng</h2>
    
    <div class="overflow-x-auto pb-4">
      <table class="w-full min-w-[600px] text-left border-collapse">
        <thead>
          <tr class="border-b border-white/10">
            <th class="py-4 px-4 font-normal text-text-secondary w-1/3">Tính năng</th>
            <th class="py-4 px-4 font-bold text-white text-center w-1/3">Free</th>
            <th class="py-4 px-4 font-bold text-accent-green text-center w-1/3">Premium</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(feature, index) in features" :key="index" class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td class="py-4 px-4 text-sm sm:text-base text-white">{{ feature.name }}</td>
            <td class="py-4 px-4 text-center">
              <span v-if="feature.free" class="text-white">{{ feature.freeText || 'Có' }}</span>
              <span v-else class="text-text-secondary text-2xl leading-none">-</span>
            </td>
            <td class="py-4 px-4 text-center flex justify-center">
              <svg v-if="feature.premium" class="w-6 h-6 text-accent-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span v-else class="text-text-secondary text-2xl leading-none">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
const features = [
  { name: 'Nghe nhạc không quảng cáo', free: false, premium: true },
  { name: 'Chất lượng âm thanh', free: true, freeText: 'Tiêu chuẩn', premium: true, premiumText: 'Cao nhất (320kbps / Lossless)' },
  { name: 'Tải beat/nhạc nền karaoke', free: false, premium: true },
  { name: 'AI Playlist Generator', free: false, premium: true },
  { name: 'AI Stem Separation (Tách lời/nhạc)', free: false, premium: true },
  { name: 'Ưu tiên xử lý AI', free: false, premium: true },
  { name: 'Huy hiệu Premium trên hồ sơ', free: false, premium: true }
]
</script>

<style scoped>
.text-text-secondary {
  color: #b3b3b3;
}
.text-accent-green {
  color: #1ed760;
}
</style>
