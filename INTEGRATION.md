# Hướng dẫn tích hợp FullscreenPlayer.vue

## Tóm tắt

File `FullscreenPlayer.vue` là component Vue 3 hoàn chỉnh, thay thế giao diện fullscreen player cũ của MusicFlow. Không sửa backend, API, store logic, hay mini PlayerBar.

## File đã tạo

| File | Mô tả |
|------|-------|
| `FullscreenPlayer.vue` | Component fullscreen player mới |

## Cách tích hợp

### Bước 1: Copy file

Copy `FullscreenPlayer.vue` vào thư mục component player của project, ví dụ:
```
apps/frontend/src/components/player/FullscreenPlayer.vue
```

### Bước 2: Thay thế component cũ

Tìm nơi đang import component fullscreen player cũ (thường trong `App.vue`, `PlayerBar.vue`, hoặc `PlayerLayout.vue`), ví dụ:

```vue
<!-- Trước -->
<template>
  <div id="app">
    <router-view />
    <PlayerBar />
    <OldFullscreenPlayer v-if="showFullscreen" ... />
  </div>
</template>
```

Thay bằng:

```vue
<template>
  <div id="app">
    <router-view />
    <PlayerBar />
    <FullscreenPlayer
      :visible="showFullscreen"
      :currentTrack="currentTrack"
      :queue="queue"
      :queueIndex="queueIndex"
      :isPlaying="isPlaying"
      :isShuffle="isShuffle"
      :isRepeat="isRepeat"
      :isLiked="isLiked"
      :progress="progress"
      :duration="duration"
      :volume="volume"
      :sourceLabel="sourceLabel"
      @close="showFullscreen = false"
      @play="playerStore.play()"
      @pause="playerStore.pause()"
      @next="playerStore.next()"
      @prev="playerStore.prev()"
      @seek="(t) => playerStore.seek(t)"
      @volumeChange="(v) => playerStore.setVolume(v)"
      @shuffleToggle="playerStore.toggleShuffle()"
      @repeatToggle="playerStore.toggleRepeat()"
      @likeToggle="playerStore.toggleLike()"
      @karaoke="$router.push('/karaoke')"
      @queueToggle="showQueue = !showQueue"
      @menu="showMenu = true"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FullscreenPlayer from '@/components/player/FullscreenPlayer.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
// ... import store khác

const showFullscreen = ref(false)
const showQueue = ref(false)

// Lấy từ store hiện có — KHÔNG sửa store
const playerStore = usePlayerStore()
const currentTrack = computed(() => playerStore.currentTrack)
const queue = computed(() => playerStore.queue)
const queueIndex = computed(() => playerStore.currentIndex)
const isPlaying = computed(() => playerStore.isPlaying)
const isShuffle = computed(() => playerStore.isShuffle)
const isRepeat = computed(() => playerStore.isRepeat)
const isLiked = computed(() => playerStore.isLiked)
const progress = computed(() => playerStore.currentTime)
const duration = computed(() => playerStore.duration)
const volume = computed(() => playerStore.volume)
const sourceLabel = computed(() => {
  // Tùy chỉnh theo context hiện tại
  return playerStore.sourceType === 'album' ? 'ĐANG PHÁT TỪ ALBUM'
    : playerStore.sourceType === 'playlist' ? 'ĐANG PHÁT TỪ PLAYLIST'
    : 'ĐANG PHÁT TỪ SINGLE'
})
</script>
```

### Bước 3: Kiểm tra CSS xung đột

Component sử dụng `scoped` CSS, không ảnh hưởng global. Nếu project có CSS global mạnh (ví dụ `* { box-sizing }`), vẫn an toàn.

Nếu dùng Tailwind, component không dùng class Tailwind nên không xung đột.

### Bước 4: Test

1. Mở app, phát một bài hát
2. Bấm mở fullscreen player
3. Kiểm tra:
   - [ ] Nền blur từ cover bài hát
   - [ ] Carousel hiện current ở giữa, queue bên cạnh
   - [ ] Play/Pause hoạt động
   - [ ] Next/Previous hoạt động, UI cập nhật
   - [ ] Seek progress hoạt động (click + drag)
   - [ ] Volume hoạt động
   - [ ] Like hoạt động
   - [ ] Karaoke button hoạt động
   - [ ] Shuffle/Repeat đổi màu khi active
   - [ ] Đóng fullscreen quay lại app bình thường
   - [ ] Mobile (390px): không tràn ngang, dock không vỡ
   - [ ] Console không có lỗi

## Props API

| Prop | Type | Default | Mô tả |
|------|------|---------|-------|
| `visible` | Boolean | false | Hiển thị/ẩn fullscreen |
| `currentTrack` | Object | `{}` | Bài hát hiện tại (cần `id`, `title`, `artist`, `cover_url`) |
| `queue` | Array | `[]` | Danh sách phát |
| `queueIndex` | Number | 0 | Vị trí hiện tại trong queue |
| `isPlaying` | Boolean | false | Đang phát? |
| `isShuffle` | Boolean | false | Shuffle active? |
| `isRepeat` | Boolean | false | Repeat active? |
| `isLiked` | Boolean | false | Đã like? |
| `progress` | Number | 0 | Thời gian hiện tại (giây) |
| `duration` | Number | 0 | Tổng thời lượng (giây) |
| `volume` | Number | 1 | Âm lượng 0–1 |
| `sourceLabel` | String | `'ĐANG PHÁT TỪ PLAYLIST'` | Label nguồn phát trên top bar |

## Events

| Event | Payload | Mô tả |
|-------|---------|-------|
| `close` | — | Đóng fullscreen |
| `play` | — | Play |
| `pause` | — | Pause |
| `next` | — | Next track |
| `prev` | — | Previous track |
| `seek` | seconds (Number) | Tua đến vị trí (giây) |
| `volumeChange` | ratio (Number 0–1) | Thay đổi âm lượng |
| `shuffleToggle` | — | Bật/tắt shuffle |
| `repeatToggle` | — | Bật/tắt repeat |
| `likeToggle` | — | Like/unlike |
| `karaoke` | — | Mở karaoke |
| `queueToggle` | — | Bật/tắt queue panel |
| `menu` | — | Mở menu |

## Xác nhận an toàn

- ✅ Backend touched: **no**
- ✅ API changed: **no**
- ✅ `/uploads` touched: **no**
- ✅ Mini PlayerBar affected: **no**
- ✅ Queue/Karaoke logic affected: **no**
- ✅ Player store logic changed: **no** (chỉ emit event, store xử lý như cũ)
- ✅ No hardcoded demo data
- ✅ No external dependencies added
- ✅ `prefers-reduced-motion` supported
