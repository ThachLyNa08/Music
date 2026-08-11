// apps/backend/src/services/contextualMood.service.js
// Context-aware mood recommendation theo buổi trong ngày.
// Lớp nhẹ trên top của recommendation.service (BPR-MF / fallback), không train model.
//
// Concept:
//   1. Xác định time slot theo giờ ICT (Asia/Ho_Chi_Minh).
//   2. Lấy candidate từ getRecommendationsForUser (cá nhân hóa).
//   3. Join với song_audio_features để lấy mood/vibe/energy_score.
//   4. Rerank theo mood_profile của slot, kết hợp recommendation_score.
//   5. Fallback nếu thiếu audio_features: dùng genre/market/popularity filter.
//
// Không ghi DB. Không touch Daily Mix / Weekly Mix. Read-only playlist queries.

const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { normalizeCoverUrl } = require('../utils/imageUrl.util');
const recommendationService = require('./recommendation.service');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 150; // Increased to allow diversity quotas to work
const CANDIDATE_PULL = 80; // Pull optimized candidate pool size
const ARTIST_CAP_TOP10 = 2;
const ARTIST_CAP_TOP20 = 4;
// Nới lỏng cap nếu chưa đủ candidate
const ARTIST_CAP_HARD = 10;

// ---------------------------------------------------------------------------
// Time slot mapping (giờ Việt Nam / Asia/Ho_Chi_Minh = ICT, +07).
// Server đang chạy ở ICT nên new Date() đã đúng. Nếu server chuyển timezone,
// có thể inject `now` qua options để test.
// ---------------------------------------------------------------------------

const TIME_SLOT_DEFS = {
  morning:   { from: 5,  to: 11, label: 'Khoi dong ngay moi',
                subtitle: 'Goi y dua tren gu nghe va mood buoi sang',
                vibes: ['chill', 'fresh', 'acoustic'],
                energyMin: 0.35, energyMax: 0.70,
                brightnessMin: 0.45,
                energySweet: 0.50, energyTolerance: 0.25 },
  afternoon: { from: 11, to: 17, label: 'Nhac cho buoi chieu',
                subtitle: 'Nang luong vua du cho buoi chieu',
                vibes: ['energetic', 'focus', 'pop', 'dance'],
                energyMin: 0.50, energyMax: 0.90,
                danceabilityMin: 0.45,
                energySweet: 0.70, energyTolerance: 0.25 },
  evening:   { from: 17, to: 22, label: 'Thu gian buoi toi',
                subtitle: 'Nhe nhang hon cho khoang thoi gian cuoi ngay',
                vibes: ['relaxed', 'romantic', 'mellow'],
                energyMin: 0.30, energyMax: 0.70,
                energySweet: 0.50, energyTolerance: 0.25 },
  night:     { from: 22, to: 29, label: 'Dem nay nghe gi',
                subtitle: 'Nhung bai hat phu hop de nghe ve dem',
                vibes: ['chill', 'sad', 'rnb', 'acoustic'],
                energyMin: 0.15, energyMax: 0.55,
                acousticMin: 0.35,
                energySweet: 0.35, energyTolerance: 0.20 },
};

// `night` slot wrap around midnight: 22-29 means hour >= 22 OR hour < 5.
function resolveTimeSlotFromHour(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function resolveTimeSlot(input, now) {
  if (!input || input === 'auto') {
    const d = now instanceof Date ? now : new Date();
    return resolveTimeSlotFromHour(d.getHours());
  }
  if (typeof input === 'string' && TIME_SLOT_DEFS[input]) return input;
  return 'morning';
}

// ---------------------------------------------------------------------------
// Mood scoring (heuristic, không train).
//   mood_match_score: 1 nếu song.mood ∈ slot.vibes, 0.5 nếu trùng 1 phần (substring),
//                     0.3 nếu không khớp nhưng không bị exclude.
//   energy_match_score: 1 - |energy_score - sweet| / tolerance, clamp 0..1.
// ---------------------------------------------------------------------------

function moodMatchScore(songMood, songVibe, slot) {
  if (!slot || !slot.vibes) return 0.3;
  const mood = (songMood || '').toLowerCase().trim();
  const vibe = (songVibe || '').toLowerCase().trim();
  if (!mood && !vibe) return 0.3; // thiếu audio_features
  for (const v of slot.vibes) {
    if (mood === v || vibe === v) return 1.0;
  }
  for (const v of slot.vibes) {
    if ((mood && mood.includes(v)) || (vibe && vibe.includes(v))) return 0.75;
  }
  // Vibe/mood có giá trị nhưng không khớp slot -> 0.2 (vẫn dùng được nhưng xếp thấp)
  return 0.2;
}

function energyMatchScore(energyScore, slot) {
  if (energyScore === null || energyScore === undefined) return 0.3; // thiếu -> trung bình
  const e = Number(energyScore);
  if (!Number.isFinite(e)) return 0.3;
  const diff = Math.abs(e - slot.energySweet);
  if (diff > slot.energyTolerance) return 0.1;
  return Math.max(0, 1 - diff / slot.energyTolerance);
}

// ---------------------------------------------------------------------------
// Fetch audio features cho 1 tập song_id.
// Trả về Map<song_id, { mood, vibe, energy_score, danceability, acoustic_score, brightness }>.
// Nếu song không có row thì vẫn có key với giá trị null (để biết thiếu data).
// ---------------------------------------------------------------------------

async function fetchAudioFeaturesForSongs(songIds) {
  const out = new Map();
  if (!songIds || !songIds.length) return out;
  const placeholders = songIds.map(() => '?').join(',');
  let rows;
  try {
    [rows] = await pool.query(
      `SELECT song_id, mood, vibe, energy_score, danceability, acoustic_score, brightness, bpm, tempo_level
       FROM song_audio_features
       WHERE song_id IN (${placeholders})`,
      songIds,
    );
  } catch (err) {
    // Bảng có thể không tồn tại hoặc cột khác -> trả empty map để caller fallback.
    console.warn('[contextualMood] fetchAudioFeaturesForSongs failed:', err.message);
    for (const id of songIds) out.set(Number(id), null);
    return out;
  }
  for (const id of songIds) out.set(Number(id), null);
  for (const r of rows) {
    out.set(Number(r.song_id), {
      mood: r.mood,
      vibe: r.vibe,
      energy_score: r.energy_score,
      danceability: r.danceability,
      acoustic_score: r.acoustic_score,
      brightness: r.brightness,
      bpm: r.bpm,
      tempo_level: r.tempo_level,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lấy candidate. 3 chiến lược (thử tuần tự):
//   1. getRecommendationsForUser(userId, { limit: CANDIDATE_PULL }) -> BPR-MF.
//   2. Nếu < 5 items: fetch từ popular pool có audio_features.
//   3. Vẫn ít: popular thuần (không filter audio_features).
// ---------------------------------------------------------------------------

const candidatesCache = new Map();
const candidatesInFlight = new Map();

function normalizeListeningWindow(options = {}) {
  const window = options.analysisWindow || options.listeningWindow;
  const startAt = window?.analysisStart || window?.startAt;
  const endAt = window?.analysisEnd || window?.endAt;
  return startAt && endAt ? { startAt, endAt } : null;
}

async function fetchCandidatesFromService(userId, options = {}) {
  const listeningWindow = normalizeListeningWindow(options);
  const cacheKey = listeningWindow
    ? `${userId}:${listeningWindow.startAt}:${listeningWindow.endAt}`
    : String(userId);
  if (candidatesCache.has(cacheKey)) {
    const cached = candidatesCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 mins TTL
      return cached.data;
    }
  }

  if (candidatesInFlight.has(cacheKey)) {
    return await candidatesInFlight.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await recommendationService.getRecommendationsForUser(userId, {
        limit: CANDIDATE_PULL,
        context: 'vibes',
        listeningWindow: listeningWindow || undefined
      });
      if (res && Array.isArray(res.items) && res.items.length) {
        const data = { items: res.items, strategy: res.strategy };
        candidatesCache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      }
    } catch (err) {
      console.warn('[contextualMood] getRecommendationsForUser failed:', err.message);
    }
    return { items: [], strategy: 'empty' };
  })();

  candidatesInFlight.set(cacheKey, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    candidatesInFlight.delete(cacheKey);
  }
}

async function fetchPopularCandidatesWithAudio(limit) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
              s.cover_url, s.audio_url, s.play_count, s.created_at,
              a.name AS artist_name, al.title AS album_title, g.name AS genre_name
       FROM songs s
       LEFT JOIN artists a ON a.id = s.artist_id
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       INNER JOIN song_audio_features af ON af.song_id = s.id
       WHERE ${publicSongCondition('s')}
         AND s.audio_url IS NOT NULL
         AND s.audio_url <> ''
       ORDER BY s.play_count DESC, s.id DESC
       LIMIT ?`,
      [limit],
    );
    return rows;
  } catch (err) {
    // Có thể bảng không tồn tại -> fallback
    console.warn('[contextualMood] fetchPopularCandidatesWithAudio failed:', err.message);
    return [];
  }
}

async function fetchPopularCandidatesNoAudio(limit) {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.title, s.artist_id, s.album_id, s.genre_id, s.market, s.duration_sec,
              s.cover_url, s.audio_url, s.play_count, s.created_at,
              a.name AS artist_name, al.title AS album_title, g.name AS genre_name
       FROM songs s
       LEFT JOIN artists a ON a.id = s.artist_id
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       WHERE ${publicSongCondition('s')}
         AND s.audio_url IS NOT NULL
         AND s.audio_url <> ''
       ORDER BY s.play_count DESC, s.id DESC
       LIMIT ?`,
      [limit],
    );
    return rows;
  } catch (err) {
    console.warn('[contextualMood] fetchPopularCandidatesNoAudio failed:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Normalize sang shape chung.
//   shapeFromServiceItem: items từ getRecommendationsForUser (đã có đầy đủ).
//   shapeFromRow: row từ query DB (cần ép kiểu).
// ---------------------------------------------------------------------------

function shapeFromServiceItem(it) {
  return {
    id: Number(it.id),
    title: it.title,
    artist_id: it.artist_id !== null && it.artist_id !== undefined ? Number(it.artist_id) : null,
    artist_name: it.artist_name || null,
    album_id: it.album_id !== null && it.album_id !== undefined ? Number(it.album_id) : null,
    album_title: it.album_title || null,
    genre_id: it.genre_id !== null && it.genre_id !== undefined ? Number(it.genre_id) : null,
    genre_name: it.genre_name || null,
    market: it.market || null,
    duration: it.duration || it.duration_sec || null,
    cover_url: it.cover_url || null,
    audio_url: it.audio_url || null,
    play_count: Number(it.play_count || 0),
    recommendation_score: Number(it.recommendation_score || 0),
  };
}

function shapeFromRow(r) {
  return {
    id: Number(r.id),
    title: r.title,
    artist_id: r.artist_id !== null && r.artist_id !== undefined ? Number(r.artist_id) : null,
    artist_name: r.artist_name || null,
    album_id: r.album_id !== null && r.album_id !== undefined ? Number(r.album_id) : null,
    album_title: r.album_title || null,
    genre_id: r.genre_id !== null && r.genre_id !== undefined ? Number(r.genre_id) : null,
    genre_name: r.genre_name || null,
    market: r.market || null,
    duration: r.duration_sec || null,
    cover_url: r.cover_url || null,
    audio_url: r.audio_url || null,
    play_count: Number(r.play_count || 0),
    recommendation_score: 0,
  };
}

// ---------------------------------------------------------------------------
// Scoring & rerank.
// final_score =
//   0.55 * recommendation_score (đã chuẩn hoá)
// + 0.25 * mood_match_score
// + 0.10 * energy_match_score
// + 0.05 * popularity_score (chuẩn hoá theo play_count)
// + 0.05 * novelty_score (1 - id/maxId)
// - artist_repeat_penalty (nếu artist xuất hiện >= 3 lần trong top K tạm thời)
// ---------------------------------------------------------------------------

const SCORING_WEIGHTS = {
  recommendation: 0.55,
  mood: 0.25,
  energy: 0.10,
  popularity: 0.05,
  novelty: 0.05,
};

function safeNorm(arr) {
  if (!arr || !arr.length) return [];
  let max = -Infinity;
  let min = Infinity;
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n > max) max = n;
    if (n < min) min = n;
  }
  const range = max - min || 1;
  return arr.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return (n - min) / range;
  });
}

function applyMoodRerank(candidates, audioMap, slot) {
  if (!candidates.length) return [];
  const normRec = safeNorm(candidates.map((c) => c.recommendation_score));
  const normPop = safeNorm(candidates.map((c) => c.play_count));
  const maxId = Math.max(...candidates.map((c) => Number(c.id)), 1);
  const novelty = candidates.map((c) => 1 - Number(c.id) / maxId);

  const scored = candidates.map((c, i) => {
    const af = audioMap.get(Number(c.id));
    const mood = af?.mood ?? null;
    const vibe = af?.vibe ?? null;
    const energy = af?.energy_score ?? null;
    const mScore = moodMatchScore(mood, vibe, slot);
    const eScore = energyMatchScore(energy, slot);
    const raw = SCORING_WEIGHTS.recommendation * normRec[i]
              + SCORING_WEIGHTS.mood * mScore
              + SCORING_WEIGHTS.energy * eScore
              + SCORING_WEIGHTS.popularity * normPop[i]
              + SCORING_WEIGHTS.novelty * novelty[i];
    return {
      ...c,
      audioFeatures: af || null,
      moodScore: Number(mScore.toFixed(4)),
      energyScore: Number(eScore.toFixed(4)),
      rawScore: raw,
    };
  });

  scored.sort((a, b) => b.rawScore - a.rawScore || Number(a.id) - Number(b.id));

  // Deduplicate + artist cap. Áp dụng 2-pass:
  //   Pass 1: cap top10=2, top20=4 (ưu tiên diversity).
  //   Pass 2: nếu chưa đủ `limit` và pool vẫn còn, nới cap lên ARTIST_CAP_HARD.
  const seen = new Set();
  const artistCount = new Map();
  const accepted = [];

  function tryAccept(s, caps) {
    if (seen.has(Number(s.id))) return false;
    const aid = s.artist_id !== null && s.artist_id !== undefined ? Number(s.artist_id) : null;
    const cnt = aid !== null ? (artistCount.get(aid) || 0) : 0;
    if (aid !== null && cnt >= caps.hard) return false;
    if (aid !== null && accepted.length < 10 && cnt >= caps.top10) return false;
    if (aid !== null && accepted.length < 20 && cnt >= caps.top20) return false;
    seen.add(Number(s.id));
    accepted.push(s);
    if (aid !== null) artistCount.set(aid, cnt + 1);
    return true;
  }

  // Pass 1
  for (const s of scored) {
    if (accepted.length >= MAX_LIMIT) break;
    tryAccept(s, { top10: ARTIST_CAP_TOP10, top20: ARTIST_CAP_TOP20, hard: ARTIST_CAP_HARD });
  }
  // Pass 2: nếu chưa đủ và pool còn bài, nới hard cap lên 8 để đảm bảo đủ limit
  // (vẫn giữ diversity, không spam 1 artist).
  if (accepted.length < MAX_LIMIT) {
    for (const s of scored) {
      if (accepted.length >= MAX_LIMIT) break;
      tryAccept(s, { top10: ARTIST_CAP_TOP10, top20: ARTIST_CAP_TOP20, hard: 8 });
    }
  }
  return accepted;
}

function buildMoodReason(slot, audio) {
  if (!audio) return `Phù hợp ${slot.label.toLowerCase()} (gợi ý phổ biến)`;
  // mood/vibe trong DB có thể lưu nhiều tag phân cách bằng dấu phẩy, ví dụ
  // "chill, focus" và "chill,coffee" -> join thành "chill, focus, chill, coffee".
  // Dedup theo tag normalized (lowercase + trim) để reason gọn.
  const rawTags = [audio.mood, audio.vibe].filter(Boolean).join(',');
  const tagSet = new Set();
  for (const t of rawTags.split(',')) {
    const norm = t.trim().toLowerCase();
    if (norm) tagSet.add(norm);
  }
  const tags = [...tagSet];
  const tagStr = tags.length ? tags.join(', ') : 'energy phù hợp';
  switch (slot.label) {
    case 'Khoi dong ngay moi':
      return `Phù hợp buổi sáng: ${tagStr}`;
    case 'Nhac cho buoi chieu':
      return `Dựa trên gu nghe của bạn và mood buổi chiều (${tagStr})`;
    case 'Thu gian buoi toi':
      return `Gợi ý thư giãn cuối ngày: ${tagStr}`;
    case 'Dem nay nghe gi':
      return `Gợi ý thư giãn cho ban đêm (${tagStr})`;
    default:
      return `Phù hợp ${slot.label}: ${tagStr}`;
  }
}

function formatItem(s, slot, req) {
  return {
    id: Number(s.id),
    title: s.title,
    artist_id: s.artist_id,
    artist_name: s.artist_name,
    album_id: s.album_id,
    album_title: s.album_title,
    genre_id: s.genre_id,
    genre_name: s.genre_name,
    market: s.market,
    duration: s.duration,
    cover_url: normalizeCoverUrl(s.cover_url || s.audio_url, req),
    audio_url: normalizeCoverUrl(s.audio_url, req),
    play_count: s.play_count,
    recommendation_score: Number((s.rawScore || 0).toFixed(4)),
    mood_reason: buildMoodReason(slot, s.audioFeatures),
    // Không expose internal scores ra ngoài để tránh rò rỉ chi tiết scoring,
    // nhưng giữ lại để debug nếu cần (có thể tắt sau).
    _debug: {
      moodScore: s.moodScore,
      energyScore: s.energyScore,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API: getContextualMoodRecommendations
// ---------------------------------------------------------------------------

async function getContextualMoodRecommendations(userId, options = {}) {
  const limit = clampLimit(options.limit);
  const req = options.req || null;
  const now = options.now instanceof Date
    ? options.now
    : (typeof options.now === 'string' ? new Date(options.now) : new Date());
  const timeSlot = resolveTimeSlot(options.timeSlot, now);
  const slot = TIME_SLOT_DEFS[timeSlot];

  // 1. Lấy candidate từ BPR-MF / fallback chain. (Tier 1)
  const fromService = await fetchCandidatesFromService(userId, options);
  let candidates = fromService.items.map(shapeFromServiceItem);
  let candidateSource = fromService.strategy;
  
  const candidateCountByTier = { tier1: candidates.length, tier2: 0, tier3: 0, tier4: 0 };
  let usedFallback = false;

  // 2. Bổ sung popular có audio_features vào pool (Tier 2)
  if (candidates.length < CANDIDATE_PULL) {
    try {
      const popular = await fetchPopularCandidatesWithAudio(CANDIDATE_PULL);
      if (popular.length) {
        const seen = new Set(candidates.map((c) => Number(c.id)));
        for (const row of popular) {
          if (candidates.length >= CANDIDATE_PULL) break;
          const id = Number(row.id);
          if (seen.has(id)) continue;
          seen.add(id);
          candidates.push(shapeFromRow(row));
          candidateCountByTier.tier2++;
        }
        usedFallback = true;
      }
    } catch (err) {
      console.warn('[contextualMood] merge popular pool failed:', err.message);
    }
  }

  // 3. Nếu vẫn ít -> popular thuần (không filter audio_features) (Tier 3)
  if (candidates.length < CANDIDATE_PULL) {
    const plainPopular = await fetchPopularCandidatesNoAudio(CANDIDATE_PULL);
    const seen = new Set(candidates.map((c) => Number(c.id)));
    for (const row of plainPopular) {
      if (candidates.length >= CANDIDATE_PULL) break;
      const id = Number(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push(shapeFromRow(row));
      candidateCountByTier.tier3++;
    }
    usedFallback = true;
  }

  if (!candidates.length) {
    return {
      strategy: 'contextual_mood',
      reason: 'no_candidates',
      timeSlot,
      timeSlotLabel: slot.label,
      timeSlotSubtitle: slot.subtitle,
      moodProfile: {
        vibes: slot.vibes,
        energyMin: slot.energyMin,
        energyMax: slot.energyMax,
        energySweet: slot.energySweet,
      },
      generatedAt: now.toISOString(),
      items: [],
    };
  }

  // 4. Join audio_features.
  const audioMap = await fetchAudioFeaturesForSongs(candidates.map((c) => Number(c.id)));
  const withAudio = candidates.filter((c) => audioMap.get(Number(c.id)) !== null);
  const withoutAudio = candidates.filter((c) => audioMap.get(Number(c.id)) === null);

  // 5. Rerank: ưu tiên bài có audio_features (scoring chính xác hơn).
  const rerankedWithAudio = applyMoodRerank(withAudio, audioMap, slot);
  // Bài thiếu audio_features: xếp sau theo recommendation_score thuần.
  const noAudioCandidates = withoutAudio
    .map((c) => ({ ...c, rawScore: c.recommendation_score * 0.6, audioFeatures: null, moodScore: 0.3, energyScore: 0.3 }))
    .sort((a, b) => b.rawScore - a.rawScore);

  // Ghép: audio trước, no-audio sau (chỉ lấp nếu thiếu).
  const merged = [...rerankedWithAudio];
  for (const c of noAudioCandidates) {
    // Only apply hard cap of MAX_LIMIT, do not restrict to options.limit for candidates!
    if (merged.length >= MAX_LIMIT) break;
    merged.push(c);
  }
  const finalReranked = merged;

  return {
    strategy: 'contextual_mood',
    reason: usedFallback ? `${candidateSource}+popular_fallback` : candidateSource,
    timeSlot,
    timeSlotLabel: slot.label,
    timeSlotSubtitle: slot.subtitle,
    moodProfile: {
      vibes: slot.vibes,
      energyMin: slot.energyMin,
      energyMax: slot.energyMax,
      energySweet: slot.energySweet,
    },
    generatedAt: now.toISOString(),
    candidateCount: candidates.length,
    candidateCountByTier,
    missingAudioFeatureRatio: candidates.length > 0 ? withoutAudio.length / candidates.length : 0,
    withAudioFeaturesCount: withAudio.length,
    withoutAudioFeaturesCount: withoutAudio.length,
    items: finalReranked.map((s) => formatItem(s, slot, req)),
  };
}

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

module.exports = {
  getContextualMoodRecommendations,
  resolveTimeSlot,
  resolveTimeSlotFromHour,
  TIME_SLOT_DEFS,
  clampLimit,
  SCORING_WEIGHTS,
};
