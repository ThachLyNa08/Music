<template>
  <article
    class="artist-card home-card"
    :class="[
      `artist-card--${size}`,
      {
        'artist-card--clickable': clickable,
        'artist-card--no-stats': !showStats
      }
    ]"
    @click="handleClick"
  >
    <div class="artist-card__image-wrap">
      <img
        :src="artistImage"
        :alt="artist?.name || 'Artist'"
        class="artist-card__image"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="handleImageError"
      />
    </div>

    <div class="artist-card__body">
      <h3 class="artist-card__name">
        {{ artist?.name || 'Nghệ sĩ' }}
      </h3>

      <p v-if="showStats && artistMeta" class="artist-card__meta">
        {{ artistMeta }}
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { normalizeImageUrl } from '@/utils/imageUrl'

const props = defineProps({
  artist: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'md'
  },
  showStats: {
    type: Boolean,
    default: true
  },
  meta: {
    type: String,
    default: ''
  },
  clickable: {
    type: Boolean,
    default: true
  }
})

const router = useRouter()

const fallbackImage = '/default-artist.png'

const artistImage = computed(() => {
  const raw =
    props.artist?.image_url ||
    props.artist?.avatar_url ||
    props.artist?.cover_url ||
    props.artist?.image

  return raw ? normalizeImageUrl(raw) : fallbackImage
})

const artistMeta = computed(() => {
  if (props.meta) return props.meta

  const count =
    props.artist?.songs_count ??
    props.artist?.total_songs ??
    props.artist?.song_count

  const numericCount = Number(count)
  if (Number.isFinite(numericCount) && numericCount > 0) {
    return `${new Intl.NumberFormat('vi-VN').format(numericCount)} bài hát`
  }

  const followers = props.artist?.followers_count ?? props.artist?.follower_count
  const numericFollowers = Number(followers)
  if (Number.isFinite(numericFollowers) && numericFollowers > 0) {
    return `${new Intl.NumberFormat('vi-VN').format(numericFollowers)} người theo dõi`
  }

  return ''
})

function handleClick() {
  if (!props.clickable) return

  const id = props.artist?.id || props.artist?.artist_id
  if (!id) return

  router.push({ name: 'ArtistProfile', params: { id } })
}

function handleImageError(event) {
  event.target.src = fallbackImage
}
</script>

<style scoped>
.artist-card {
  height: 216px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  transition:
    background-color 180ms ease,
    transform 180ms ease;
}

.artist-card--clickable {
  cursor: pointer;
}

.artist-card--clickable:hover {
  background: rgba(255, 255, 255, 0.09);
  box-shadow: 0 14px 32px rgba(0,0,0,0.28);
  transform: translateY(-2px);
}

.artist-card__image-wrap {
  width: 124px;
  height: 124px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.artist-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-card__body {
  width: 100%;
  margin-top: 14px;
  text-align: center;
  min-width: 0;
}

.artist-card__name {
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-card__meta {
  margin: 5px 0 0;
  color: #b3b3b3;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-card--sm {
  height: 184px;
  padding: 12px;
}

.artist-card--sm .artist-card__image-wrap {
  width: 100px;
  height: 100px;
}

.artist-card--sm .artist-card__body {
  margin-top: 12px;
}

.artist-card--no-stats {
  height: 188px;
  justify-content: center;
}

.artist-card--no-stats .artist-card__body {
  margin-top: 12px;
}

.artist-card--compact {
  max-width: 168px;
  height: 188px;
  padding: 12px;
  justify-content: center;
  margin: 0 auto;
}

.artist-card--compact .artist-card__image-wrap {
  width: 116px;
  height: 116px;
}

.artist-card--compact .artist-card__body {
  margin-top: 12px;
}

.artist-card--compact .artist-card__meta {
  display: none;
}

@media (max-width: 640px) {
  .artist-card {
    height: 188px;
    padding: 12px;
  }

  .artist-card__image-wrap {
    width: 104px;
    height: 104px;
  }

  .artist-card--compact {
    height: 170px;
    max-width: none;
  }

  .artist-card--compact .artist-card__image-wrap {
    width: 96px;
    height: 96px;
  }
}
</style>
