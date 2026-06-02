<template>
  <article class="recent-song-card home-card home-card-hover group" @click="goToSong">
    <div class="recent-song-card__cover-wrap">
      <img
        :src="coverUrl"
        :alt="songTitle"
        class="recent-song-card__cover"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="handleImageError"
      />
      <button
        type="button"
        class="recent-song-card__play home-play-btn"
        aria-label="Play song"
        @click.stop="$emit('play', song)"
      >
        <svg viewBox="0 0 24 24" class="recent-song-card__play-icon">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </button>
    </div>

    <h3 class="recent-song-card__title">{{ songTitle }}</h3>
    <p class="recent-song-card__artist" @click.stop="goToArtist">
      {{ artistName }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { normalizeImageUrl, DEFAULT_COVER } from '@/utils/imageUrl'

const props = defineProps({
  song: {
    type: Object,
    required: true
  }
})

defineEmits(['play'])

const router = useRouter()

const songId = computed(() => props.song?.song_id || props.song?.id)
const artistId = computed(() => props.song?.artist_id || props.song?.artist?.id)

const songTitle = computed(() => {
  return props.song?.title || props.song?.name || 'Bai hat'
})

const artistName = computed(() => {
  return props.song?.artist_name || props.song?.artist || props.song?.artist?.name || 'Nghe si'
})

const coverUrl = computed(() => {
  const raw =
    props.song?.cover_url ||
    props.song?.image_url ||
    props.song?.album_cover ||
    props.song?.thumbnail ||
    props.song?.album?.cover_url ||
    props.song?.cover ||
    props.song?.image

  return normalizeImageUrl(raw || DEFAULT_COVER)
})

function goToSong() {
  if (!songId.value) return
  router.push(`/song/${songId.value}`)
}

function goToArtist() {
  if (!artistId.value) return
  router.push(`/artist/${artistId.value}`)
}

function handleImageError(event) {
  event.target.src = DEFAULT_COVER
}
</script>

<style scoped>
.recent-song-card {
  min-width: 0;
  padding: 14px;
  cursor: pointer;
}

.recent-song-card__cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
}

.recent-song-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recent-song-card__play {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    background-color 180ms ease;
}

.recent-song-card:hover .recent-song-card__play {
  opacity: 1;
  transform: translateY(0);
}

.recent-song-card__play-icon {
  width: 22px;
  height: 22px;
  margin-left: 2px;
  fill: #ffffff;
}

.recent-song-card__title {
  margin: 0 0 5px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-song-card__artist {
  margin: 0;
  color: #b3b3b3;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 180ms ease;
}

.recent-song-card__artist:hover {
  color: #ffffff;
  text-decoration: underline;
}

@media (max-width: 640px) {
  .recent-song-card {
    padding: 12px;
  }

  .recent-song-card__play {
    width: 40px;
    height: 40px;
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
