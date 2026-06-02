<template>
  <div class="mt-24 max-w-3xl mx-auto pb-12">
    <h2 class="text-2xl sm:text-3xl font-bold text-center text-white mb-10">Câu hỏi thường gặp</h2>
    
    <div class="space-y-4">
      <div v-for="(item, index) in faqs" :key="index" class="bg-surface rounded-2xl overflow-hidden transition-all duration-300 border border-white/10">
        <button 
          @click="toggle(index)"
          class="w-full flex justify-between items-center p-5 sm:p-6 text-left focus:outline-none hover:bg-white/5 transition-colors"
        >
          <span class="text-base sm:text-lg font-semibold text-white">{{ item.question }}</span>
          <svg 
            class="w-5 h-5 text-text-secondary transition-transform duration-300"
            :class="{ 'rotate-180': openIndex === index }"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div 
          class="px-5 sm:px-6 overflow-hidden transition-all duration-300 ease-in-out"
          :class="openIndex === index ? 'max-h-48 py-4 opacity-100' : 'max-h-0 py-0 opacity-0'"
        >
          <p class="text-text-secondary text-sm sm:text-base leading-relaxed">{{ item.answer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const faqs = [
  {
    question: 'Thanh toán hoạt động như thế nào?',
    answer: 'Khi bạn chọn gói, hệ thống sẽ tạo một mã QR. Bạn chỉ cần mở ứng dụng ngân hàng và quét mã QR đó (hoặc sao chép nội dung chuyển khoản). Hệ thống sử dụng SePay VietQR để tự động nhận diện giao dịch.'
  },
  {
    question: 'Khi nào tài khoản được nâng cấp Premium?',
    answer: 'Tài khoản của bạn sẽ được nâng cấp Premium tự động và ngay lập tức sau khi bạn chuyển khoản thành công đúng số tiền và nội dung.'
  },
  {
    question: 'Tôi có nhận được email xác nhận không?',
    answer: 'Có. Sau khi thanh toán thành công, hệ thống sẽ gửi một email xác nhận đến địa chỉ email đăng ký tài khoản của bạn.'
  },
  {
    question: 'Nếu tôi chuyển khoản sai nội dung thì sao?',
    answer: 'Nếu bạn vô tình chuyển khoản sai nội dung, hệ thống sẽ không thể tự động xác nhận. Vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi kèm theo ảnh chụp màn hình giao dịch để được hỗ trợ thủ công.'
  },
  {
    question: 'Điều gì xảy ra khi Premium hết hạn?',
    answer: 'Khi hết hạn, tài khoản của bạn sẽ tự động trở về gói Free. Các bài hát, playlist của bạn vẫn được giữ nguyên nhưng bạn sẽ không còn sử dụng được các tính năng Premium.'
  },
  {
    question: 'Tôi có thể gia hạn trước khi hết hạn không?',
    answer: 'Có, bạn có thể mua thêm gói Premium bất cứ lúc nào. Thời gian sử dụng sẽ được cộng dồn vào thời hạn Premium hiện tại của bạn.'
  }
]

const openIndex = ref(null)

const toggle = (index) => {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<style scoped>
.bg-surface {
  background: linear-gradient(135deg, rgba(76,29,149,0.12), rgba(15,23,42,0.78));
  backdrop-filter: blur(16px);
}
.text-text-secondary {
  color: #b3b3b3;
}
</style>
