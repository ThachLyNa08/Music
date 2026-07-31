const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');
const { resolveArtistAvatar } = require('../utils/imageUrl.util');
const {
  detectTempoIntent,
  computeTempoMatchScore,
  computeEnergyMatchScore,
  computeDanceabilityMatchScore,
  computeBrightnessMatchScore,
  buildTempoReason,
} = require('../utils/tempoFeature.util');
const recommendationService = require('./recommendation.service');

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PLAY_WORDS = ['mo', 'phat', 'nghe', 'bat', 'play', 'cho nghe'];
const LIST_WORDS = ['tim', 'goi y', 'de xuat', 'danh sach', 'playlist', 'list'];

const MARKET_RULES = [
  { terms: ['kpop', 'k-pop', 'k pop', 'nhac han', 'nhac han quoc'], market: 'KPOP' },
  { terms: ['vpop', 'v-pop', 'v pop', 'nhac viet', 'nhac viet nam'], market: 'VPOP' },
  { terms: ['usuk', 'us-uk', 'us uk', 'au my', 'nhac au my', 'nhac my', 'nhac anh'], market: 'USUK' }
];

const ENERGY_RULES = [
  { terms: ['nang luong', 'soi dong', 'boc', 'chay', 'manh', 'tap gym', 'workout', 'chay bo', 'upbeat'], energy: 'high', keywords: ['energetic', 'workout', 'party', 'dance', 'edm'] },
  { terms: ['cham', 'nhe', 'nhe nhang', 'chill', 'thu gian', 'buoi toi', 'toi', 'ngu', 'sau lang', 'buon', 'suy', 'diu', 'binh yen', 'lofi'], energy: 'low', keywords: ['chill', 'acoustic', 'ballad', 'indie', 'lofi'] },
  { terms: ['vua phai', 'tap trung', 'hoc bai', 'lam viec', 'coding', 'doc sach'], energy: 'medium', keywords: ['indie', 'pop', 'acoustic'] }
];

const KEYWORD_RULES = [
  { terms: ['buon', 'tam trang', 'sad', 'suy'], keywords: ['buon', 'ballad', 'chill', 'sad'] },
  { terms: ['nhe', 'nhe nhang', 'chill', 'thu gian', 'buoi toi', 'toi', 'cham', 'ngu', 'sau lang', 'diu', 'binh yen', 'lofi'], keywords: ['chill', 'acoustic', 'ballad', 'indie', 'lofi'] },
  { terms: ['rap', 'hip hop', 'hiphop'], keywords: ['rap', 'hip hop', 'hiphop'] },
  { terms: ['rnb', 'r&b'], keywords: ['rnb', 'r&b'] },
  { terms: ['rock', 'indie'], keywords: ['rock', 'indie'] },
];

function extractSongTitleQuery(prompt = '') {
  const normalized = normalizeText(prompt);
  const rawMatch = String(prompt).trim().match(/^(?:mở|mo|phát|phat|nghe|bật|bat|play)\s+(?:bài\s+hát|bai\s+hat|bài|bai)\s+(.+)$/i);
  const normalizedMatch = normalized.match(/^(?:mo|phat|nghe|bat|play)\s+(?:bai\s+hat|bai)\s+(.+)$/);
  const rawDirectMatch = String(prompt).trim().match(/^(?:mở|mo|phát|phat|nghe|bật|bat|play)\s+(.+)$/i);
  const normalizedDirectMatch = normalized.match(/^(?:mo|phat|nghe|bat|play)\s+(.+)$/);
  let value = rawMatch?.[1] || normalizedMatch?.[1];

  if (!value) {
    const directValue = rawDirectMatch?.[1] || normalizedDirectMatch?.[1];
    const directNormalized = normalizeText(directValue || '');
    const isContextPrompt = /^(?:nhac|playlist|danh sach)\b/.test(directNormalized);
    if (directValue && !isContextPrompt) {
      value = directValue;
    }
  }

  if (!value) return null;

  return String(value)
    .replace(/\b(?:đi|di|nhé|nhe|nha|cho mình|cho minh|cho tôi|cho toi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArtistQuery(prompt = '') {
  const norm = normalizeText(prompt);
  const match = norm.match(/(?:bai|nhac|bai hat)?\s*(?:cua)\s+(.+)$/);
  if (match) return match[1].trim();

  const match2 = norm.match(/^(?:phat|nghe|bat|mo|tim)\s+(?:nhac)\s+(.+)$/);
  if (match2) {
    const val = match2[1].trim();
    const isMarket = MARKET_RULES.some(r => r.terms.some(t => val.includes(t)));
    const isEnergy = ENERGY_RULES.some(r => r.terms.some(t => val.includes(t)));
    const isKeyword = KEYWORD_RULES.some(r => r.terms.some(t => val.includes(t)));
    if (!isMarket && !isEnergy && !isKeyword) {
      return val;
    }
  }
  return null;
}

function parseIntent(prompt = '') {
  const normalized = normalizeText(prompt);

  let artistQuery = extractArtistQuery(prompt);
  let songTitleQuery = extractSongTitleQuery(prompt);

  if (artistQuery && songTitleQuery && normalizeText(songTitleQuery).includes(artistQuery)) {
    songTitleQuery = null;
  }

  const hasPlayWord = PLAY_WORDS.some((word) => normalized.includes(word));
  const hasListWord = LIST_WORDS.some((word) => normalized.includes(word));
  let action = hasPlayWord ? 'play' : 'search';
  if (normalized.includes('tim va phat')) action = 'play';

  const matchedKeywords = [];

  let market = [];
  for (const rule of MARKET_RULES) {
    if (rule.terms.some(term => normalized.includes(term))) {
      market.push(rule.market);
    }
  }

  let energy = null;
  for (const rule of ENERGY_RULES) {
    if (rule.terms.some(term => normalized.includes(term))) {
      energy = rule.energy;
      matchedKeywords.push(...rule.keywords);
    }
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      matchedKeywords.push(...rule.keywords);
    }
  }

  const filler = new Set([
    'mo', 'phat', 'nghe', 'bat', 'play', 'tim', 'goi', 'y', 'de', 'xuat',
    'danh', 'sach', 'nhac', 'bai', 'hat', 'cho', 'minh', 'toi', 'mot', 'vai',
    'di', 'nhe', 'nha', 'playlist', 'cua'
  ]);
  const promptTerms = normalized
    .split(' ')
    .filter((term) => term.length >= 2 && !filler.has(term));

  return {
    rawPrompt: prompt,
    normalizedPrompt: normalized,
    action,
    songTitleQuery,
    artistQuery,
    market: market.length > 0 ? market : undefined,
    energy,
    keywords: [...new Set([...matchedKeywords, ...promptTerms])].slice(0, 12),
  };
}

function buildLikeWhere(fields, values) {
  const clauses = [];
  const params = [];

  for (const value of values) {
    const term = `%${value}%`;
    for (const field of fields) {
      clauses.push(`${field} LIKE ?`);
      params.push(term);
    }
  }

  return { clauses, params };
}

function getBaseSongSelect(userId) {
  const userLikeSelect = userId
    ? ', (SELECT 1 FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ?) AS is_liked'
    : ', FALSE AS is_liked';

  return `
    SELECT
      s.id,
      s.title,
      s.duration_sec,
      s.audio_url,
      s.cover_url,
      s.play_count,
      s.artist_id,
      a.name AS artist_name,
      a.avatar_url AS artist_avatar_url,
      s.album_id,
      al.title AS album_title,
      al.cover_url AS album_cover_url,
      s.genre_id,
      g.name AS genre_name,
      g.slug AS genre_slug,
      (SELECT COUNT(*) FROM song_likes sl2 WHERE sl2.song_id = s.id) AS like_count
      ${userLikeSelect}
    FROM songs s
    JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    LEFT JOIN genres g ON s.genre_id = g.id
  `;
}

function getTokens(value = '') {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreTitleCandidate(row, titleQuery) {
  const normalizedTitle = normalizeText(row.title);
  const normalizedQuery = normalizeText(titleQuery);
  const titleTokens = new Set(getTokens(row.title));
  const queryTokens = getTokens(titleQuery);
  const matchedTokenCount = queryTokens.filter((token) => titleTokens.has(token) || normalizedTitle.includes(token)).length;

  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 80;
  } else if (queryTokens.length > 0 && matchedTokenCount === queryTokens.length) {
    score += 60;
  } else if (matchedTokenCount > 0) {
    score += 20 + (matchedTokenCount / queryTokens.length) * 20;
  }

  if (normalizeText(row.artist_name).includes(normalizedQuery)) {
    score += 15;
  }

  score += Math.min(Number(row.play_count) || 0, 1000000) / 100000;
  return score;
}

function isLowEnergyIntent(intent) {
  if (!intent) return false;
  if (intent.energy === 'low') return true;
  const kws = (intent.keywords || []).map(k => normalizeText(k));
  return kws.some(k => ['chill', 'acoustic', 'ballad', 'indie', 'lofi', 'buoi toi', 'toi', 'cham', 'thu gian', 'nhe nhang', 'buon', 'suy', 'diu', 'binh yen', 'ngu'].includes(k));
}

function scoreSemanticCandidate(row, intent) {
  let score = 0;

  if (intent.artistQuery) {
    const normArtist = normalizeText(row.artist_name);
    const normQuery = normalizeText(intent.artistQuery);

    if (normArtist === normQuery) {
      score += 120;
    } else if (normArtist.includes(normQuery)) {
      score += 100;
    } else {
      const queryTokens = getTokens(intent.artistQuery);
      const artistTokens = new Set(getTokens(row.artist_name));
      const matchCount = queryTokens.filter(t => artistTokens.has(t)).length;

      if (queryTokens.length > 0 && matchCount === queryTokens.length) {
        score += 80;
      } else if (matchCount > 0) {
        score += 10;
      } else {
        score -= 100;
      }
    }
  }

  let isMarketMatch = false;
  if (intent.market && intent.market.length > 0) {
    const m = intent.market[0];
    const genreSlug = String(row.genre_slug || '').toLowerCase();

    if (m === 'KPOP' && (genreSlug.includes('k-pop') || genreSlug.includes('kpop'))) isMarketMatch = true;
    else if (m === 'VPOP' && (genreSlug.includes('v-pop') || genreSlug.includes('vpop') || genreSlug.includes('viet'))) isMarketMatch = true;
    else if (m === 'USUK' && (genreSlug.includes('us-uk') || genreSlug.includes('usuk') || genreSlug.includes('au-my') || genreSlug.includes('pop') && !genreSlug.includes('k-pop') && !genreSlug.includes('v-pop'))) isMarketMatch = true;

    if (isMarketMatch) {
      score += 100;
    } else {
      score -= 100;
    }
  }

  const rowText = `${row.title} ${row.artist_name} ${row.genre_name} ${row.genre_slug}`.toLowerCase();
  for (const kw of intent.keywords) {
    if (rowText.includes(kw)) {
      score += 40;
    }
  }

  const isLow = isLowEnergyIntent(intent);
  if (intent.energy === 'high' && !isLow) {
    const genreSlug = String(row.genre_slug || '').toLowerCase();
    if (genreSlug.includes('dance') || genreSlug.includes('edm') || genreSlug.includes('rap') || genreSlug.includes('pop')) {
      score += 20;
    }
  } else if (isLow) {
    const genreSlug = String(row.genre_slug || '').toLowerCase();
    const textStr = `${row.title} ${row.artist_name} ${row.genre_name} ${genreSlug}`.toLowerCase();
    if (genreSlug.includes('ballad') || genreSlug.includes('indie') || genreSlug.includes('acoustic') || genreSlug.includes('lofi') || genreSlug.includes('chill') || textStr.includes('chill') || textStr.includes('lofi') || textStr.includes('acoustic')) {
      score += 60;
    }
    if (genreSlug.includes('dance') || genreSlug.includes('edm') || genreSlug.includes('remix') || genreSlug.includes('vinahouse') || textStr.includes('remix') || textStr.includes('vinahouse') || textStr.includes('dj') || textStr.includes('club') || textStr.includes('party')) {
      score -= 200;
    }
  }

  score += Math.min(Number(row.play_count) || 0, 1000000) / 100000 * 10;

  if (intent.artistQuery && score < 0) {
     const normTitle = normalizeText(row.title);
     if (normTitle.includes(normalizeText(intent.artistQuery))) {
       score += 30;
     }
  }

  return score;
}

function formatSong(row) {
  const song = {
    id: row.id,
    title: row.title,
    duration_sec: row.duration_sec,
    duration: row.duration_sec,
    audio_url: row.audio_url,
    cover_url: row.cover_url || row.album_cover_url,
    cover: row.cover_url || row.album_cover_url,
    play_count: row.play_count || 0,
    artist_id: row.artist_id,
    artist: row.artist_name,
    artist_name: row.artist_name,
    artist_avatar_url: resolveArtistAvatar({ id: row.artist_id, name: row.artist_name, avatar_url: row.artist_avatar_url }, null),
    album_id: row.album_id,
    album: row.album_title || 'Single',
    album_title: row.album_title,
    album_cover_url: row.album_cover_url,
    genre_id: row.genre_id,
    genre_name: row.genre_name,
    like_count: row.like_count || 0,
    is_liked: Boolean(row.is_liked),
  };
  if (row.audioFeature) {
    if (row.audioFeature.raw_bpm !== null && row.audioFeature.raw_bpm !== undefined) song.bpm = Number(row.audioFeature.raw_bpm);
    if (row.audioFeature.normalized_bpm !== null && row.audioFeature.normalized_bpm !== undefined) song.normalizedBpm = Number(row.audioFeature.normalized_bpm);
    if (row.audioFeature.tempo_bucket && row.audioFeature.tempo_bucket !== 'unknown') song.tempoBucket = row.audioFeature.tempo_bucket;
    if (row.audioFeature.energy_score !== null && row.audioFeature.energy_score !== undefined) song.energyScore = Number(row.audioFeature.energy_score);
    if (row.audioFeature.danceability_score !== null && row.audioFeature.danceability_score !== undefined) song.danceabilityScore = Number(row.audioFeature.danceability_score);
    if (row.audioFeature.brightness_score !== null && row.audioFeature.brightness_score !== undefined) song.brightnessScore = Number(row.audioFeature.brightness_score);
    if (row.tempoReason) song.tempoReason = row.tempoReason;
  }
  return song;
}

async function applyTempoSearchRerank(rows, tempoIntent, intent = null) {
  if (!tempoIntent || !Array.isArray(rows) || rows.length === 0) {
    return { rows, coverage: { covered: 0, total: rows?.length || 0, ratio: 0 } };
  }

  const featureMap = await recommendationService.fetchAudioFeaturesForSongs(rows.map((row) => row.id));
  const textScores = rows.map((row) => Number(row._score || 0));
  const min = Math.min(...textScores);
  const max = Math.max(...textScores);
  const range = max - min || 1;

  const isLowIntent =
    tempoIntent.energyTarget === 'low' ||
    tempoIntent.tempoBucket === 'slow' ||
    tempoIntent.activity === 'relax' ||
    isLowEnergyIntent(intent);

  const reranked = rows.map((row) => {
    const feature = featureMap.get(Number(row.id)) || null;
    const textSearchScore = (Number(row._score || 0) - min) / range;
    const semanticScore = row._score > 0 ? Math.min(row._score / 120, 1) : 0;
    const tempoMatchScore = computeTempoMatchScore(feature, tempoIntent);
    const energyMatchScore = computeEnergyMatchScore(feature, tempoIntent);
    const danceabilityMatchScore = computeDanceabilityMatchScore(feature, tempoIntent);
    const brightnessMatchScore = computeBrightnessMatchScore(feature, tempoIntent);
    let finalSearchScore = textSearchScore * 0.50
      + semanticScore * 0.15
      + tempoMatchScore * 0.15
      + energyMatchScore * 0.12
      + brightnessMatchScore * 0.05
      + danceabilityMatchScore * 0.03;

    if (isLowIntent) {
      const genreSlug = String(row.genre_slug || '').toLowerCase();
      const textStr = `${row.title} ${row.artist_name} ${row.genre_name} ${genreSlug}`.toLowerCase();
      if (genreSlug.includes('dance') || genreSlug.includes('edm') || genreSlug.includes('remix') || genreSlug.includes('vinahouse') || textStr.includes('remix') || textStr.includes('vinahouse') || textStr.includes('dj') || textStr.includes('club') || textStr.includes('party')) {
        finalSearchScore -= 5.0;
      }
      if (genreSlug.includes('ballad') || genreSlug.includes('indie') || genreSlug.includes('acoustic') || genreSlug.includes('lofi') || genreSlug.includes('chill') || textStr.includes('chill') || textStr.includes('lofi') || textStr.includes('acoustic')) {
        finalSearchScore += 0.3;
      }

      if (feature) {
        const eScore = Number(feature.energy_score !== null && feature.energy_score !== undefined ? feature.energy_score : (feature.energy === 'high' ? 0.85 : feature.energy === 'low' ? 0.25 : 0.5));
        const tBucket = feature.tempo_bucket || feature.tempoBucket || feature.tempo_level || feature.tempoLevel || '';
        if (eScore >= 0.65) {
          finalSearchScore -= 5.0;
        } else if (eScore >= 0.58) {
          finalSearchScore -= 2.0;
        }
        if (tBucket === 'fast') {
          finalSearchScore -= 4.0;
        }
        const bScore = Number(feature.brightness_score !== null && feature.brightness_score !== undefined ? feature.brightness_score : (feature.brightness === 'high' ? 0.85 : 0.5));
        if (bScore <= 0.6) {
          finalSearchScore += 0.15;
        }
      }
    }

    return {
      ...row,
      _score: finalSearchScore,
      audioFeature: feature,
      tempoReason: feature ? buildTempoReason(feature, tempoIntent) : null,
    };
  }).sort((a, b) => b._score - a._score || Number(a.id) - Number(b.id));

  return {
    rows: reranked,
    coverage: {
      covered: featureMap.size,
      total: rows.length,
      ratio: rows.length ? Number((featureMap.size / rows.length).toFixed(4)) : 0,
    },
  };
}

async function fetchTitleMatches({ titleQuery, currentSongId = null, userId = null, limit = 12 }) {
  const tokens = getTokens(titleQuery);
  if (!titleQuery || tokens.length === 0) return [];

  const titleClauses = ['LOWER(s.title) LIKE LOWER(?)'];
  const titleParams = [`%${titleQuery}%`];

  for (const token of tokens) {
    titleClauses.push('LOWER(s.title) LIKE LOWER(?)');
    titleParams.push(`%${token}%`);
  }

  const params = userId ? [userId] : [];
  params.push(...titleParams);
  if (currentSongId) params.push(Number(currentSongId) || 0);
  params.push(Math.max(limit * 12, 200));

  const [rows] = await pool.query(`
    ${getBaseSongSelect(userId)}
    WHERE ${publicSongCondition('s')}
      AND (${titleClauses.join(' OR ')})
      ${currentSongId ? 'AND s.id != ?' : ''}
    ORDER BY s.play_count DESC, s.created_at DESC
    LIMIT ?
  `, params);

  return rows
    .map((row) => ({ ...row, _score: scoreTitleCandidate(row, titleQuery) }))
    .filter((row) => row._score >= 20)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

async function fetchKeywordMatches({ intent, prompt, currentSongId = null, userId = null, limit = 15 }) {
  const searchValues = intent.keywords.length > 0 ? [...intent.keywords] : [intent.normalizedPrompt].filter(Boolean);
  if (intent.artistQuery) {
    searchValues.push(normalizeText(intent.artistQuery));
  }

  const fields = ['s.title', 'a.name', 'al.title', 'g.name', 'g.slug'];
  const { clauses, params: likeParams } = buildLikeWhere(fields, searchValues);

  let finalWhere = clauses.length > 0 ? `AND (${clauses.join(' OR ')})` : '';
  const queryParams = userId ? [userId] : [];
  let marketOrder = '';

  if (intent.market && intent.market.length > 0) {
    const m = intent.market[0];
    let marketCond = 'FALSE';
    if (m === 'KPOP') marketCond = "(g.slug LIKE '%k-pop%' OR g.slug LIKE '%kpop%')";
    if (m === 'VPOP') marketCond = "(g.slug LIKE '%v-pop%' OR g.slug LIKE '%vpop%' OR g.slug LIKE '%viet%')";
    if (m === 'USUK') marketCond = "(g.slug LIKE '%us-uk%' OR g.slug LIKE '%usuk%' OR g.slug LIKE '%au-my%')";

    marketOrder = `${marketCond} DESC,`;
    if (finalWhere) {
      finalWhere = `AND ( (${clauses.join(' OR ')}) OR ${marketCond} )`;
    } else {
      finalWhere = `AND ${marketCond}`;
    }
  }

  queryParams.push(...likeParams);
  if (currentSongId) queryParams.push(Number(currentSongId) || 0);

  const isLowEnergyTempo = intent.energy === 'low' || intent.keywords.some(k => ['chill', 'acoustic', 'ballad', 'indie', 'lofi', 'buoi toi', 'toi', 'cham', 'thu gian', 'nhe nhang', 'buon', 'suy', 'diu', 'binh yen', 'ngu'].includes(normalizeText(k)));
  const fetchLimit = intent.market || intent.artistQuery ? Math.max(limit * 5, 100) : (isLowEnergyTempo ? Math.max(limit * 10, 150) : limit * 2);
  queryParams.push(`%${prompt}%`, `%${prompt}%`, `%${prompt}%`, `%${prompt}%`, fetchLimit);

  const [rows] = await pool.query(`
    ${getBaseSongSelect(userId)}
    WHERE ${publicSongCondition('s')}
      ${finalWhere}
      ${currentSongId ? 'AND s.id != ?' : ''}
    ORDER BY
      ${marketOrder}
      CASE
        WHEN s.title LIKE ? THEN 0
        WHEN a.name LIKE ? THEN 1
        WHEN g.name LIKE ? OR g.slug LIKE ? THEN 2
        ELSE 3
      END,
      s.play_count DESC
    LIMIT ?
  `, queryParams);

  const scoredRows = rows.map(row => {
    return { ...row, _score: scoreSemanticCandidate(row, intent) };
  });

  const returnLimit = intent.energy || isLowEnergyTempo ? Math.max(limit * 6, 90) : limit;
  return scoredRows
    .sort((a, b) => b._score - a._score)
    .slice(0, returnLimit);
}

async function getMusicAssistantResult({ prompt, autoPlay = false, currentSongId = null, userId = null }) {
  const intent = parseIntent(prompt);
  const tempoIntent = detectTempoIntent(prompt);
  const limit = intent.action === 'play' ? 12 : 15;
  let rows = [];
  let strategy = intent.keywords.length > 0 ? 'rule_based_keyword_match' : 'popular_fallback';
  let titleMatchAttempted = false;

  if (intent.songTitleQuery) {
    titleMatchAttempted = true;
    rows = await fetchTitleMatches({
      titleQuery: intent.songTitleQuery,
      currentSongId,
      userId,
      limit,
    });

    if (rows.length > 0) {
      strategy = 'title_exact_or_near_match';
    }
  }

  if (rows.length === 0) {
    rows = await fetchKeywordMatches({
      intent,
      prompt,
      currentSongId,
      userId,
      limit,
    });

    if (intent.artistQuery) {
      strategy = 'artist_strict_semantic_match';
    } else if (intent.market) {
      strategy = 'market_strict_semantic_match';
    }
  }

  let tempoCoverage = { covered: 0, total: rows.length, ratio: 0 };
  const shouldRerankTempo = (tempoIntent || isLowEnergyIntent(intent)) && rows.length > 0 && !intent.artistQuery && !intent.songTitleQuery;
  if (shouldRerankTempo) {
    const effectiveTempoIntent = tempoIntent || {
      tempoBucket: 'slow',
      energyTarget: 'low',
      danceabilityTarget: 'low',
      brightnessTarget: 'low',
      activity: 'relax',
      label: 'Nhạc chậm · Năng lượng nhẹ · Thư giãn'
    };
    const rerank = await applyTempoSearchRerank(rows, effectiveTempoIntent, intent);
    const validRows = rerank.rows.filter(r => r._score > -2.0);
    rows = (validRows.length >= 3 ? validRows : rerank.rows).slice(0, limit);
    tempoCoverage = rerank.coverage;
    strategy = `${strategy}_tempo_aware`;
  } else if (rows.length > limit) {
    rows = rows.slice(0, limit);
  }

  const songs = rows.map(formatSong);
  const action = intent.action || 'search';
  const foundTitleMatch = strategy === 'title_exact_or_near_match';
  const canAutoPlay = Boolean(
    autoPlay &&
    action === 'play' &&
    songs.length > 0 &&
    (!titleMatchAttempted || foundTitleMatch || intent.artistQuery)
  );

  let message = '';
  if (songs.length > 0) {
    if (foundTitleMatch || (canAutoPlay && !intent.artistQuery)) {
      message = 'Đã tìm thấy bài phù hợp để phát.';
    } else if (intent.artistQuery) {
      if (rows[0]._score >= 80) {
         message = `Đã tìm thấy các bài hát của ${intent.artistQuery}.`;
      } else {
         message = 'Mình chưa tìm thấy nghệ sĩ này, nên gợi ý một số bài gần phù hợp.';
      }
    } else if (titleMatchAttempted) {
      message = 'Chưa tìm thấy chính xác bài này, mình gợi ý một số bài gần phù hợp.';
    } else {
      if (intent.market && rows.length > 0 && rows[0]._score < 0) {
        message = 'Mình chưa tìm đủ bài đúng thị trường yêu cầu, nên bổ sung thêm một số bài gần phù hợp.';
      } else {
        message = 'Đây là một vài bài phù hợp với yêu cầu của bạn.';
      }
    }
  } else {
    message = titleMatchAttempted
      ? 'Chưa tìm thấy chính xác bài này, mình gợi ý một số bài gần phù hợp.'
      : 'Chưa tìm thấy bài hát phù hợp trong thư viện.';
  }

  return {
    intent,
    aiSearchMode: true,
    tempoAware: Boolean(tempoIntent && rows.length > 0 && !intent.artistQuery && !intent.songTitleQuery),
    detectedIntent: tempoIntent,
    explanation: tempoIntent ? buildTempoReason(null, tempoIntent) : null,
    audioFeatureCoverage: tempoCoverage,
    action,
    songs,
    strategy,
    artistStrict: Boolean(intent.artistQuery),
    marketStrict: Boolean(intent.market),
    fallbackTier: ((intent.market || intent.artistQuery) && rows.length > 0 && rows[0]._score < 0) ? 4 : 1,
    message,
    canAutoPlay,
  };
}

module.exports = {
  getMusicAssistantResult,
};
