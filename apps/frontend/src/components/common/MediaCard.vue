<template>
  <article
    class="media-card user-card"
    :class="{ 'media-card--clickable': clickable }"
    @click="handleClick"
  >
    <div class="media-card__cover-wrap">
      <CoverImage
        v-if="mediaCover"
        :src="mediaCover"
        :alt="mediaTitle"
      />
      <div v-else class="media-card__cover-placeholder">
        <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
      </div>
    </div>

    <h3 class="media-card__title">{{ mediaTitle }}</h3>

    <p v-if="showMeta && mediaMeta" class="media-card__meta">
      {{ mediaMeta }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import CoverImage from '@/components/common/CoverImage.vue'
import { normalizeImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  type: {
    type: String,
    default: ''
  },
  clickable: {
    type: Boolean,
    default: true
  },
  showMeta: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])
const router = useRouter()

// Helper lấy cover từ nhiều field
const mediaCover = computed(() => {
  const raw =
    props.item?.cover_url ||
    props.item?.coverUrl ||
    props.item?.image_url ||
    props.item?.imageUrl ||
    props.item?.cover_image ||
    props.item?.album_cover ||
    props.item?.thumbnail ||
    props.item?.thumbnail_url ||
    props.item?.artwork_url ||
    props.item?.first_song_cover ||
    props.item?.song_cover ||
    props.item?.cover ||
    props.item?.image ||
    props.item?.album?.cover_url ||
    props.item?.album?.image_url ||
    props.item?.album?.cover_image ||
    null

  if (!raw) return null

  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null

  return normalizeImageUrl(trimmed)
})

// Helper lấy title
const mediaTitle = computed(() => {
  return (
    props.item?.name ||
    props.item?.title ||
    props.item?.album_name ||
    'Không có tiêu đề'
  )
})

// Helper lấy meta (artist + count)
const mediaMeta = computed(() => {
  const artist =
    props.item?.artist_name ||
    props.item?.artist?.name ||
    props.item?.artists?.[0]?.name ||
    null

  const count =
    props.item?.songs_count ||
    props.item?.song_count ||
    props.item?.total_songs ||
    props.item?.track_count ||
    null

  if (artist && count) return `${artist} · ${count} bài`
  if (artist) return artist
  if (count) return `${count} bài`
  return ''
})

// Xác định type album/single
function getMediaType() {
  const raw = String(
    props.type ||
    props.item?.item_type ||
    props.item?.album_type ||
    props.item?.type ||
    ''
  ).toLowerCase()

  if (raw === 'single') return 'single'
  return 'album'
}

// Click handler
function handleClick() {
  if (!props.clickable) return

  const id = props.item?.id || props.item?.album_id || props.item?.single_id
  if (!id) return

  const mediaType = getMediaType()

  emit('click', { item: props.item, type: mediaType })

  // Navigate to album detail (single cũng dùng chung album detail)
  router.push(`/album/${id}`)
}
</script>

<style scoped>
.media-card {
  padding: 16px;
  border-radius: 16px;
  transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.media-card--clickable {
  cursor: pointer;
}

.media-card--clickable:hover {
  background: rgba(255, 255, 255, 0.09);
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
}

.media-card__cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  background: rgba(255,255,255,0.06);
}

.media-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e293b, #334155);
  color: #7C3AED;
}

.media-card__cover-placeholder svg {
  width: 48px;
  height: 48px;
  fill: currentColor;
}

.media-card__title {
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-card--clickable:hover .media-card__title {
  text-decoration: underline;
}

.media-card__meta {
  margin: 0;
  font-size: 13px;
  color: #b3b3b3;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 480px) {
  .media-card {
    padding: 10px;
  }
  .media-card__title {
    font-size: 12px;
    margin: 8px 0 4px;
  }
  .media-card__meta {
    font-size: 11px;
  }
}
</style>
