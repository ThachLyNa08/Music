<template>
  <section class="min-h-[calc(100vh-176px)] bg-[#070a12] text-slate-100">
    <div v-if="loading" class="flex min-h-[420px] items-center justify-center">
      <div class="h-11 w-11 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></div>
    </div>

    <div v-else-if="error" class="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <MfIcon name="error" size="42" className="text-rose-400" />
      <p class="mt-4 text-sm font-semibold text-slate-400">{{ error }}</p>
    </div>

    <template v-else-if="profile">
      <header class="relative overflow-hidden border-b border-white/10 bg-[#090d18] px-6 py-8 md:px-10">
        <img
          v-if="profile.avatar_url"
          :src="avatarUrl"
          alt=""
          class="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl"
          @error="event => event.target.style.display = 'none'"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#090d18] via-[#090d18]/90 to-violet-500/10"></div>

        <div class="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div class="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-500/20 text-5xl font-black text-white shadow-2xl md:h-40 md:w-40">
            <img v-if="avatarUrl" :src="avatarUrl" alt="" class="h-full w-full object-cover" @error="avatarLoadFailed = true" />
            <span v-else>{{ profileInitial }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">Ho so cong khai</div>
            <h1 class="mt-2 truncate text-4xl font-black text-white md:text-6xl">{{ profile.name }}</h1>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
              <span v-if="profile.username">@{{ profile.username }}</span>
              <span v-if="profile.username" class="h-1 w-1 rounded-full bg-slate-600"></span>
              <span>Tham gia {{ joinedDate }}</span>
            </div>
            <p v-if="profile.bio" class="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">{{ profile.bio }}</p>
          </div>

          <button
            v-if="!isSelf"
            class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-extrabold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            :disabled="startingMessage"
            @click="startMessage"
          >
            <MfIcon name="chat" size="18" />
            Nhắn tin
          </button>
        </div>
      </header>

      <main class="px-6 py-8 md:px-10">
        <section>
          <div class="mb-5 flex items-center justify-between">
            <h2 class="m-0 text-2xl font-extrabold text-white">Playlist công khai</h2>
          </div>

          <div v-if="profile.public_playlists?.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <button
              v-for="playlist in profile.public_playlists"
              :key="playlist.id"
              class="group rounded-lg border border-white/10 bg-white/[0.05] p-3 text-left transition hover:bg-white/[0.08]"
              type="button"
              @click="router.push(`/playlist/${playlist.id}`)"
            >
              <div class="aspect-square overflow-hidden rounded-md bg-white/10 shadow-lg">
                <img
                  :src="playlistCover(playlist.cover_url)"
                  alt=""
                  class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  @error="event => event.target.src = '/images/default-cover.svg'"
                />
              </div>
              <div class="mt-3 truncate text-sm font-bold text-white">{{ playlist.name }}</div>
              <div class="mt-1 truncate text-xs font-semibold text-slate-500">{{ playlist.song_count || 0 }} bài hát</div>
            </button>
          </div>

          <div v-else class="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
            <MfIcon name="playlist" size="38" className="mx-auto text-slate-700" />
            <p class="mt-3 text-sm font-semibold text-slate-500">Người dùng này chưa có playlist công khai.</p>
          </div>
        </section>

        <section class="mt-10">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="m-0 text-2xl font-extrabold text-white">Nghệ sĩ đang theo dõi</h2>
            <span v-if="profile.followed_artists_count" class="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {{ profile.followed_artists_count }} nghệ sĩ
            </span>
          </div>

          <div v-if="profile.followed_artists?.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <button
              v-for="artist in profile.followed_artists"
              :key="artist.id"
              class="group rounded-lg border border-white/10 bg-white/[0.05] p-4 text-center transition hover:bg-white/[0.08]"
              type="button"
              @click="router.push(`/artist/${artist.id}`)"
            >
              <div class="mx-auto aspect-square w-full max-w-[150px] overflow-hidden rounded-full bg-white/10 shadow-lg">
                <img
                  :src="artistAvatar(artist)"
                  alt=""
                  class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  @error="event => event.target.src = '/default-artist.png'"
                />
              </div>
              <div class="mt-3 truncate text-sm font-bold text-white">{{ artist.name }}</div>
              <div class="mt-1 truncate text-xs font-semibold text-slate-500">
                {{ artistMeta(artist) }}
              </div>
            </button>
          </div>

          <div v-else class="rounded-lg border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
            <MfIcon name="artist" size="38" className="mx-auto text-slate-700" />
            <p class="mt-3 text-sm font-semibold text-slate-500">Người dùng này chưa theo dõi nghệ sĩ nào.</p>
          </div>
        </section>
      </main>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { userApi } from '@/api/user'
import { messagesApi } from '@/api/messages'
import { useAuthStore } from '@/stores/auth'
import { normalizeImageUrl, normalizeCoverUrl } from '@/utils/imageUrl'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const profile = ref(null)
const loading = ref(false)
const error = ref('')
const startingMessage = ref(false)
const avatarLoadFailed = ref(false)

const profileId = computed(() => Number(route.params.id))
const isSelf = computed(() => Number(auth.user?.id) === profileId.value)
const profileInitial = computed(() => (profile.value?.name || 'U').charAt(0).toUpperCase())
const avatarUrl = computed(() => {
  if (avatarLoadFailed.value) return ''
  return profile.value?.avatar_url ? normalizeImageUrl(profile.value.avatar_url) : ''
})
const joinedDate = computed(() => {
  if (!profile.value?.created_at) return ''
  return new Date(profile.value.created_at).toLocaleDateString('vi-VN')
})

function playlistCover(url) {
  return normalizeCoverUrl(url) || '/images/default-cover.svg'
}

function artistAvatar(artist) {
  return normalizeImageUrl(artist.avatar_url || artist.cover_url || '')
}

function artistMeta(artist) {
  if (artist.followers_count) return `${artist.followers_count} người theo dõi`
  if (artist.song_count) return `${artist.song_count} bài hát`
  return 'Nghệ sĩ'
}

async function loadProfile() {
  if (!Number.isInteger(profileId.value) || profileId.value <= 0) {
    error.value = 'Không tìm thấy người dùng'
    return
  }

  loading.value = true
  error.value = ''
  avatarLoadFailed.value = false
  try {
    const { data } = await userApi.getPublicProfile(profileId.value)
    profile.value = data.data
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải hồ sơ người dùng'
  } finally {
    loading.value = false
  }
}

async function startMessage() {
  if (!profile.value || startingMessage.value) return
  startingMessage.value = true
  try {
    const { data } = await messagesApi.createDirectConversation(profile.value.id)
    const conversationId = data.data?.conversation_id
    router.push({
      path: '/messages',
      query: conversationId ? { conversationId } : {},
    })
  } finally {
    startingMessage.value = false
  }
}

onMounted(loadProfile)
watch(() => route.params.id, loadProfile)
</script>
