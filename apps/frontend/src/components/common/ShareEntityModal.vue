<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" @click.self="close">
      <div class="w-full max-w-md overflow-hidden rounded-lg border border-white/10 bg-[#090d18] shadow-2xl">
        <div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 class="m-0 text-base font-extrabold text-white">Chia sẻ với bạn bè</h3>
          <button class="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" type="button" @click="close">
            <MfIcon name="close" size="18" />
          </button>
        </div>

        <div class="p-5">
          <div class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <img :src="entityCover" alt="" class="h-14 w-14 rounded-md object-cover" @error="event => event.target.src = '/default-cover.png'" />
            <div class="min-w-0">
              <div class="truncate text-sm font-extrabold text-white">{{ entityTitle }}</div>
              <div class="truncate text-xs font-semibold text-slate-500">{{ entitySubtitle }}</div>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <MfIcon name="search" size="18" className="text-slate-500" />
            <input v-model="searchQuery" class="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600" placeholder="Tìm người nhận" type="search" />
          </div>

          <div class="sidebar-scroll mt-3 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/10">
            <div v-if="loading" class="px-4 py-6 text-center text-sm text-slate-500">Đang tải...</div>

            <template v-else>
              <button
                v-for="item in visibleRecipients"
                :key="item.key"
                class="flex w-full items-center gap-3 border-0 border-b border-white/5 bg-transparent px-3 py-3 text-left transition hover:bg-white/[0.06]"
                type="button"
                :disabled="sending"
                @click="sendTo(item)"
              >
                <UserDot :user="item.user" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-bold text-white">{{ item.user.display_name }}</div>
                  <div class="truncate text-xs font-medium text-slate-500">{{ item.subtitle }}</div>
                </div>
                <MfIcon name="send" size="16" className="text-slate-500" />
              </button>

              <div v-if="visibleRecipients.length === 0" class="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                Không tìm thấy người nhận
              </div>
            </template>
          </div>

          <button v-if="sentConversationId" class="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-white transition hover:bg-white/[0.10]" type="button" @click="openConversation">
            <MfIcon name="chat" size="17" />
            Mở cuộc trò chuyện
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { messagesApi } from '@/api/messages'
import { normalizeImageUrl } from '@/utils/imageUrl'
import { useToastStore } from '@/stores/toast'

const props = defineProps({
  open: { type: Boolean, default: false },
  entity: { type: Object, default: null },
  entityType: { type: String, default: 'song' }, // song, playlist, album, artist
})

const emit = defineEmits(['update:open'])

const UserDot = {
  props: { user: { type: Object, required: true } },
  template: `
    <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet-500/20 text-sm font-extrabold text-white">
      <img v-if="avatarSrc" :src="avatarSrc" alt="" class="h-full w-full object-cover" @error="avatarSrc = ''" />
      <span v-else>{{ initial }}</span>
    </div>
  `,
  data() {
    return { avatarSrc: this.user.avatar_url ? normalizeImageUrl(this.user.avatar_url) : '' }
  },
  computed: {
    initial() {
      return (this.user.display_name || this.user.email || 'U').charAt(0).toUpperCase()
    },
  },
}

const router = useRouter()
const toast = useToastStore()
const conversations = ref([])
const searchResults = ref([])
const searchQuery = ref('')
const loading = ref(false)
const sending = ref(false)
const sentConversationId = ref(null)
let searchTimer = null

const entityTitle = computed(() => props.entity?.title || props.entity?.name || 'Nội dung chia sẻ')
const entitySubtitle = computed(() => props.entity?.artist_name || props.entity?.artist || props.entity?.subtitle || '')
const entityCover = computed(() => normalizeImageUrl(props.entity?.cover_url || props.entity?.cover || props.entity?.image_url || props.entity?.avatar_url || ''))
const entityId = computed(() => props.entity?.song_id || props.entity?.id)

const visibleRecipients = computed(() => {
  if (searchQuery.value.trim()) {
    return searchResults.value.map((user) => ({
      key: `user:${user.id}`,
      type: 'user',
      user,
      subtitle: user.email || 'Người dùng MusicFlow',
    }))
  }
  return conversations.value.map((conversation) => ({
    key: `conversation:${conversation.conversation_id}`,
    type: 'conversation',
    conversationId: conversation.conversation_id,
    user: conversation.other_user,
    subtitle: conversation.last_message ? previewLastMessage(conversation.last_message) : 'Cuộc trò chuyện gần đây',
  }))
})

function previewLastMessage(message) {
  if (message.message_type === 'song_share') return `Đã chia sẻ: ${message.shared_song?.title || 'bài hát'}`
  if (message.message_type === 'playlist_share') return `Đã chia sẻ: ${message.shared_playlist?.title || 'playlist'}`
  if (message.message_type === 'album_share') return `Đã chia sẻ: ${message.shared_album?.title || 'album'}`
  if (message.message_type === 'artist_share') return `Đã chia sẻ: ${message.shared_artist?.name || 'nghệ sĩ'}`
  return message.body || 'Tin nhắn mới'
}

function close() {
  emit('update:open', false)
}

async function loadConversations() {
  loading.value = true
  try {
    const { data } = await messagesApi.getConversations()
    conversations.value = data.data || []
  } finally {
    loading.value = false
  }
}

async function sendTo(item) {
  if (!entityId.value || sending.value) return
  sending.value = true
  try {
    let response
    if (item.type === 'conversation') {
      response = await messagesApi.shareEntityToConversation(item.conversationId, props.entityType, entityId.value)
      sentConversationId.value = item.conversationId
    } else {
      response = await messagesApi.shareEntityToUser(item.user.id, props.entityType, entityId.value)
      sentConversationId.value = response.data.data?.conversationId
    }
    toast.showToast(`Đã chia sẻ với ${item.user.display_name}`, 'success')
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error')
  } finally {
    sending.value = false
  }
}

function openConversation() {
  if (!sentConversationId.value) return
  close()
  router.push({ path: '/messages', query: { conversationId: sentConversationId.value } })
}

watch(() => props.open, (next) => {
  if (!next) return
  sentConversationId.value = null
  searchQuery.value = ''
  searchResults.value = []
  loadConversations()
})

watch(searchQuery, (value) => {
  clearTimeout(searchTimer)
  const q = value.trim()
  if (!q) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    loading.value = true
    try {
      const { data } = await messagesApi.searchUsers(q)
      searchResults.value = data.data || []
    } finally {
      loading.value = false
    }
  }, 250)
})
</script>
