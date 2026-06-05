<template>
  <div class="spotify-callback">
    <div class="spinner"></div>
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { spotifyApi } from '@/api/spotify'

const router = useRouter()
const route = useRoute()
const message = ref('Dang ket noi voi Spotify...')

onMounted(async () => {
  const code = route.query.code
  const state = route.query.state
  const error = route.query.error

  if (error) {
    message.value = 'Ban da huy ket noi Spotify.'
    setTimeout(() => router.push('/profile'), 1200)
    return
  }

  if (!code || !state) {
    message.value = 'Spotify callback thieu du lieu.'
    setTimeout(() => router.push('/profile'), 1200)
    return
  }

  try {
    await spotifyApi.completeCallback({ code, state })
    message.value = 'Da ket noi Spotify thanh cong.'
  } catch (err) {
    console.error('Spotify callback failed:', err)
    message.value = err.response?.data?.message || 'Khong the ket noi Spotify.'
  } finally {
    setTimeout(() => router.push('/profile'), 1200)
  }
})
</script>

<style scoped>
.spotify-callback {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #f4f7f6;
  font-family: 'Be Vietnam Pro', sans-serif;
  color: #2d3436;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(29, 185, 84, 0.2);
  border-top-color: #1db954;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
