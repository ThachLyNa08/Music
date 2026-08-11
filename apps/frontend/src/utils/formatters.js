import { toBackendAssetUrl } from '@/config/runtime';

export function formatImageUrl(url) {
  if (!url) return '/default-cover.png';
  return toBackendAssetUrl(url);
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatTotalDuration(seconds) {
  if (!seconds) return '0 phút';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút`;
}
