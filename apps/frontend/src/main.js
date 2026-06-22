import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
import MfIcon from '@/components/common/MfIcon.vue'
app.component('MfIcon', MfIcon)
import { formatImageUrl } from './utils/formatters'
app.config.globalProperties.$formatImageUrl = formatImageUrl

app.use(createPinia())
app.use(router)
app.mount('#app')