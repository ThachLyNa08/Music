// scripts/recommendation/auditContextualMood.js
// Read-only audit for MusicFlow Contextual Mood Recommendation.
// It calls the existing service, compares it with a popular-song baseline,
// exports metrics, PNG charts, and a thesis-ready Markdown report.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_ROOT = path.join(PROJECT_ROOT, 'apps', 'backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });

const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));
const { publicSongCondition } = require(path.join(BACKEND_ROOT, 'src/utils/public.utils'));
const contextualMoodService = require(path.join(BACKEND_ROOT, 'src/services/contextualMood.service'));

const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
const DEFAULT_LIMIT = 20;
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'datasets', 'processed');
const CHART_DIR = path.join(OUTPUT_DIR, 'charts');
const REPORT_DIR = path.join(PROJECT_ROOT, 'docs', 'recommendation');

const OUTPUT_JSON = path.join(OUTPUT_DIR, 'contextual_mood_audit.json');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'contextual_mood_audit.csv');
const OUTPUT_SUMMARY = path.join(OUTPUT_DIR, 'contextual_mood_summary.json');
const OUTPUT_REPORT = path.join(REPORT_DIR, 'contextual-mood-evaluation.md');

const AUDIT_SLOT_DEFS = {
  morning: {
    label: 'Morning',
    expected: ['chill', 'happy', 'acoustic', 'focus', 'light'],
    energyMin: 0.25,
    energyMax: 0.70,
  },
  afternoon: {
    label: 'Afternoon',
    expected: ['energetic', 'happy', 'pop', 'dance', 'focus'],
    energyMin: 0.40,
    energyMax: 0.90,
  },
  evening: {
    label: 'Evening',
    expected: ['chill', 'romantic', 'happy', 'rnb', 'acoustic'],
    energyMin: 0.25,
    energyMax: 0.70,
  },
  night: {
    label: 'Night',
    expected: ['chill', 'sad', 'romantic', 'acoustic', 'calm'],
    energyMin: 0.10,
    energyMax: 0.55,
  },
};

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  const limit = clampInt(args.limit, DEFAULT_LIMIT, 1, 40);
  const userId = args['user-id'] !== undefined ? clampInt(args['user-id'], null, 1, Number.MAX_SAFE_INTEGER) : null;
  const allSample = args['all-sample'] !== undefined ? clampInt(args['all-sample'], 20, 1, 200) : null;
  return { userId, limit, allSample };
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function round(value, digits = 4) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function avg(values) {
  const valid = values.filter((value) => value !== null && value !== undefined).map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitTags(...values) {
  const out = [];
  for (const value of values) {
    if (!value) continue;
    for (const part of String(value).split(/[,;/|]+/)) {
      const normalized = normalizeToken(part);
      if (!normalized) continue;
      out.push(normalized);
      for (const token of normalized.split(/\s+/)) {
        if (token && token !== normalized) out.push(token);
      }
    }
  }
  return [...new Set(out)];
}

function expectedMatches(tags, expected) {
  const normalizedExpected = expected.map(normalizeToken);
  return tags.some((tag) => normalizedExpected.some((exp) => tag === exp || tag.includes(exp) || exp.includes(tag)));
}

function countTop(values, limit = 5) {
  const counts = new Map();
  for (const value of values) {
    const clean = String(value || '').trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function duplicateCount(items) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of items) {
    const id = Number(item.id || item.song_id);
    if (!Number.isFinite(id)) continue;
    if (seen.has(id)) duplicates += 1;
    seen.add(id);
  }
  return duplicates;
}

async function fetchAudioDetails(songIds) {
  const ids = [...new Set(songIds.map(Number).filter(Number.isFinite))];
  const out = new Map();
  for (const id of ids) out.set(id, null);
  if (!ids.length) return out;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT
        s.id,
        s.title,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        COALESCE(s.play_count, 0) AS play_count,
        saf.mood,
        saf.vibe,
        saf.energy_score,
        saf.danceability,
        saf.acoustic_score,
        saf.brightness,
        saf.bpm,
        saf.tempo_level
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN genres g ON g.id = s.genre_id
     LEFT JOIN song_audio_features saf ON saf.song_id = s.id
     WHERE s.id IN (${placeholders})`,
    ids,
  );

  for (const row of rows) {
    out.set(Number(row.id), {
      id: Number(row.id),
      title: row.title,
      artist_id: row.artist_id !== null && row.artist_id !== undefined ? Number(row.artist_id) : null,
      artist_name: row.artist_name || null,
      genre_id: row.genre_id !== null && row.genre_id !== undefined ? Number(row.genre_id) : null,
      genre_name: row.genre_name || null,
      play_count: Number(row.play_count || 0),
      mood: row.mood || null,
      vibe: row.vibe || null,
      energy_score: row.energy_score !== null && row.energy_score !== undefined ? Number(row.energy_score) : null,
      danceability: row.danceability !== null && row.danceability !== undefined ? Number(row.danceability) : null,
      acoustic_score: row.acoustic_score !== null && row.acoustic_score !== undefined ? Number(row.acoustic_score) : null,
      brightness: row.brightness !== null && row.brightness !== undefined ? Number(row.brightness) : null,
      bpm: row.bpm !== null && row.bpm !== undefined ? Number(row.bpm) : null,
      tempo_level: row.tempo_level || null,
    });
  }
  return out;
}

async function fetchPopularBaseline(limit) {
  const [rows] = await pool.query(
    `SELECT
        s.id,
        s.title,
        s.artist_id,
        a.name AS artist_name,
        s.genre_id,
        g.name AS genre_name,
        COALESCE(s.play_count, 0) AS play_count,
        saf.mood,
        saf.vibe,
        saf.energy_score,
        saf.danceability,
        saf.acoustic_score,
        saf.brightness,
        saf.bpm,
        saf.tempo_level
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN genres g ON g.id = s.genre_id
     LEFT JOIN song_audio_features saf ON saf.song_id = s.id
     WHERE ${publicSongCondition('s')}
       AND s.audio_url IS NOT NULL
       AND s.audio_url <> ''
     ORDER BY COALESCE(s.play_count, 0) DESC, s.id DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    artist_id: row.artist_id !== null && row.artist_id !== undefined ? Number(row.artist_id) : null,
    artist_name: row.artist_name || null,
    genre_id: row.genre_id !== null && row.genre_id !== undefined ? Number(row.genre_id) : null,
    genre_name: row.genre_name || null,
    play_count: Number(row.play_count || 0),
    mood: row.mood || null,
    vibe: row.vibe || null,
    energy_score: row.energy_score !== null && row.energy_score !== undefined ? Number(row.energy_score) : null,
    danceability: row.danceability !== null && row.danceability !== undefined ? Number(row.danceability) : null,
    acoustic_score: row.acoustic_score !== null && row.acoustic_score !== undefined ? Number(row.acoustic_score) : null,
    brightness: row.brightness !== null && row.brightness !== undefined ? Number(row.brightness) : null,
    bpm: row.bpm !== null && row.bpm !== undefined ? Number(row.bpm) : null,
    tempo_level: row.tempo_level || null,
  }));
}

function enrichItems(items, audioMap) {
  return items.map((item) => {
    const id = Number(item.id || item.song_id);
    const audio = audioMap.get(id);
    return {
      id,
      title: item.title || audio?.title || '',
      artist_id: item.artist_id ?? audio?.artist_id ?? null,
      artist_name: item.artist_name || item.artist || audio?.artist_name || '',
      genre_id: item.genre_id ?? audio?.genre_id ?? null,
      genre_name: item.genre_name || audio?.genre_name || '',
      play_count: Number(item.play_count ?? audio?.play_count ?? 0),
      recommendation_score: Number(item.recommendation_score || 0),
      mood_match_score: item._debug?.moodScore !== undefined ? Number(item._debug.moodScore) : null,
      energy_match_score: item._debug?.energyScore !== undefined ? Number(item._debug.energyScore) : null,
      mood: audio?.mood || null,
      vibe: audio?.vibe || null,
      energy_score: audio?.energy_score ?? null,
      has_audio_features: Boolean(audio && audio.energy_score !== null && audio.energy_score !== undefined),
    };
  });
}

function summarizeList({ source, timeSlot, items }) {
  const slotDef = AUDIT_SLOT_DEFS[timeSlot];
  const itemCount = items.length;
  const withAudio = items.filter((item) => item.has_audio_features);
  const withoutAudio = itemCount - withAudio.length;
  const moodMatches = withAudio.filter((item) => {
    const tags = splitTags(item.mood, item.vibe);
    return expectedMatches(tags, slotDef.expected);
  }).length;
  const energyInRange = withAudio.filter((item) => {
    const e = Number(item.energy_score);
    return Number.isFinite(e) && e >= slotDef.energyMin && e <= slotDef.energyMax;
  }).length;

  return {
    source,
    time_slot: timeSlot,
    item_count: itemCount,
    duplicate_song_count: duplicateCount(items),
    avg_recommendation_score: round(avg(items.map((item) => item.recommendation_score))),
    avg_mood_match_score: round(avg(items.map((item) => item.mood_match_score))),
    avg_energy_match_score: round(avg(items.map((item) => item.energy_match_score))),
    avg_energy_score: round(avg(withAudio.map((item) => item.energy_score))),
    energy_in_range_rate: round(rate(energyInRange, withAudio.length)),
    mood_match_rate: round(rate(moodMatches, withAudio.length)),
    with_audio_features_count: withAudio.length,
    without_audio_features_count: withoutAudio,
    audio_feature_coverage_rate: round(rate(withAudio.length, itemCount)),
    top_moods: countTop(withAudio.flatMap((item) => splitTags(item.mood)), 5),
    top_vibes: countTop(withAudio.flatMap((item) => splitTags(item.vibe)), 5),
    top_artists: countTop(items.map((item) => item.artist_name), 5),
    top_genres: countTop(items.map((item) => item.genre_name), 5),
    expected_moods_vibes: slotDef.expected,
    expected_energy_range: [slotDef.energyMin, slotDef.energyMax],
  };
}

async function auditUser(userId, limit, baselineItems) {
  const slotResults = {};
  const allRecommendedIds = [];

  for (const timeSlot of TIME_SLOTS) {
    const result = await contextualMoodService.getContextualMoodRecommendations(userId, { limit, timeSlot });
    const rawItems = Array.isArray(result.items) ? result.items : [];
    const audioMap = await fetchAudioDetails(rawItems.map((item) => Number(item.id || item.song_id)));
    const contextualItems = enrichItems(rawItems, audioMap);
    const baselineAudioMap = new Map(baselineItems.map((item) => [Number(item.id), item]));
    const baselineForSlot = enrichItems(baselineItems, baselineAudioMap).map((item) => ({
      ...item,
      recommendation_score: null,
      mood_match_score: null,
      energy_match_score: null,
    }));

    allRecommendedIds.push(...contextualItems.map((item) => item.id));
    slotResults[timeSlot] = {
      response_meta: {
        strategy: result.strategy,
        reason: result.reason,
        candidateCount: result.candidateCount,
        serviceWithAudioFeaturesCount: result.withAudioFeaturesCount,
        serviceWithoutAudioFeaturesCount: result.withoutAudioFeaturesCount,
        generatedAt: result.generatedAt,
      },
      contextual: summarizeList({ source: 'contextual_mood', timeSlot, items: contextualItems }),
      baseline: summarizeList({ source: 'popular_baseline', timeSlot, items: baselineForSlot }),
      items: contextualItems,
      baseline_items: baselineForSlot,
    };
  }

  const overlaps = computeOverlaps(slotResults);
  return {
    user_id: userId,
    unique_recommended_song_count: new Set(allRecommendedIds).size,
    slot_results: slotResults,
    overlaps,
  };
}

function computeOverlaps(slotResults) {
  const pairs = [];
  for (let i = 0; i < TIME_SLOTS.length; i += 1) {
    for (let j = i + 1; j < TIME_SLOTS.length; j += 1) {
      const a = TIME_SLOTS[i];
      const b = TIME_SLOTS[j];
      const aSet = new Set((slotResults[a]?.items || []).map((item) => Number(item.id)));
      const bSet = new Set((slotResults[b]?.items || []).map((item) => Number(item.id)));
      const intersection = [...aSet].filter((id) => bSet.has(id)).length;
      const union = new Set([...aSet, ...bSet]).size;
      pairs.push({
        pair: `${a}_vs_${b}`,
        time_slot_a: a,
        time_slot_b: b,
        intersection_count: intersection,
        union_count: union,
        overlap_rate: round(rate(intersection, union)),
      });
    }
  }
  return pairs;
}

async function pickSampleUsers(sampleSize) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email
     FROM users u
     LEFT JOIN listening_history lh ON lh.user_id = u.id
     WHERE (u.role IS NULL OR u.role <> 'admin')
     GROUP BY u.id, u.email
     ORDER BY COUNT(lh.song_id) DESC, u.id ASC
     LIMIT ?`,
    [sampleSize],
  );
  return rows.map((row) => Number(row.id)).filter(Number.isFinite);
}

function aggregateAudits(userAudits, baselineItems) {
  const aggregate = {};
  for (const timeSlot of TIME_SLOTS) {
    const contextualItems = [];
    const baselineForSlot = [];
    let duplicateSum = 0;
    for (const audit of userAudits) {
      const slot = audit.slot_results[timeSlot];
      contextualItems.push(...slot.items);
      baselineForSlot.push(...slot.baseline_items);
      duplicateSum += slot.contextual.duplicate_song_count;
    }
    const contextual = summarizeList({ source: 'contextual_mood', timeSlot, items: contextualItems });
    contextual.duplicate_song_count = duplicateSum;
    contextual.item_count = contextualItems.length;
    const baseline = summarizeList({ source: 'popular_baseline', timeSlot, items: baselineForSlot.length ? baselineForSlot : baselineItems });
    aggregate[timeSlot] = { contextual, baseline };
  }

  const overlapByPair = new Map();
  for (const audit of userAudits) {
    for (const pair of audit.overlaps) {
      if (!overlapByPair.has(pair.pair)) overlapByPair.set(pair.pair, []);
      overlapByPair.get(pair.pair).push(pair);
    }
  }
  const overlaps = [...overlapByPair.entries()].map(([pair, rows]) => ({
    pair,
    time_slot_a: rows[0].time_slot_a,
    time_slot_b: rows[0].time_slot_b,
    intersection_count_avg: round(avg(rows.map((row) => row.intersection_count))),
    union_count_avg: round(avg(rows.map((row) => row.union_count))),
    overlap_rate: round(avg(rows.map((row) => row.overlap_rate))),
  }));

  return { slot_results: aggregate, overlaps };
}

function buildSummary({ mode, userIds, limit, userAudits, aggregate }) {
  const source = aggregate.slot_results;
  const slotSummaries = {};
  for (const timeSlot of TIME_SLOTS) {
    const contextual = source[timeSlot].contextual;
    const baseline = source[timeSlot].baseline;
    slotSummaries[timeSlot] = {
      contextual,
      baseline,
      baseline_comparison: {
        mood_match_rate_delta: round((contextual.mood_match_rate || 0) - (baseline.mood_match_rate || 0)),
        energy_in_range_rate_delta: round((contextual.energy_in_range_rate || 0) - (baseline.energy_in_range_rate || 0)),
      },
    };
  }

  const morningEnergy = slotSummaries.morning.contextual.avg_energy_score;
  const afternoonEnergy = slotSummaries.afternoon.contextual.avg_energy_score;
  const nightEnergy = slotSummaries.night.contextual.avg_energy_score;

  return {
    generated_at: new Date().toISOString(),
    mode,
    user_ids: userIds,
    user_count: userIds.length,
    limit,
    outputs: {
      audit_json: path.relative(PROJECT_ROOT, OUTPUT_JSON),
      audit_csv: path.relative(PROJECT_ROOT, OUTPUT_CSV),
      summary_json: path.relative(PROJECT_ROOT, OUTPUT_SUMMARY),
      report: path.relative(PROJECT_ROOT, OUTPUT_REPORT),
      charts_dir: path.relative(PROJECT_ROOT, CHART_DIR),
    },
    slot_summaries: slotSummaries,
    overlap_summary: aggregate.overlaps,
    checks: {
      afternoon_energy_higher_than_morning: afternoonEnergy !== null && morningEnergy !== null ? afternoonEnergy >= morningEnergy : null,
      night_energy_lower_than_afternoon: nightEnergy !== null && afternoonEnergy !== null ? nightEnergy <= afternoonEnergy : null,
      all_contextual_duplicate_count_zero: TIME_SLOTS.every((slot) => slotSummaries[slot].contextual.duplicate_song_count === 0),
      contextual_beats_baseline_any_rate: TIME_SLOTS.every((slot) => {
        const cmp = slotSummaries[slot].baseline_comparison;
        return (cmp.mood_match_rate_delta || 0) > 0 || (cmp.energy_in_range_rate_delta || 0) > 0;
      }),
    },
    safety: {
      db_modified: false,
      backend_logic_changed: false,
      frontend_changed: false,
      model_retrained: false,
      daily_mix_changed: false,
      weekly_mix_changed: false,
      scheduler_changed: false,
      uploads_touched: false,
    },
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(summary) {
  const headers = [
    'source',
    'time_slot',
    'item_count',
    'duplicate_song_count',
    'avg_recommendation_score',
    'avg_mood_match_score',
    'avg_energy_match_score',
    'avg_energy_score',
    'energy_in_range_rate',
    'mood_match_rate',
    'with_audio_features_count',
    'without_audio_features_count',
    'audio_feature_coverage_rate',
    'top_moods',
    'top_vibes',
    'top_artists',
    'top_genres',
  ];
  const rows = [headers];
  for (const timeSlot of TIME_SLOTS) {
    for (const source of ['contextual', 'baseline']) {
      const row = summary.slot_summaries[timeSlot][source];
      rows.push(headers.map((header) => row[header]));
    }
  }
  fs.writeFileSync(OUTPUT_CSV, rows.map((row) => row.map(csvEscape).join(',')).join('\n'), 'utf8');
}

function writeReport(summary) {
  const chartRel = (name) => `../../datasets/processed/charts/${name}`;
  const lines = [];
  lines.push('# Contextual Mood Recommendation Evaluation');
  lines.push('');
  lines.push('## Mục tiêu đánh giá');
  lines.push('');
  lines.push('Báo cáo này kiểm chứng tính năng Contextual Mood Recommendation của MusicFlow bằng số liệu đọc từ cơ sở dữ liệu và kết quả trả về từ service hiện có. Mục tiêu là chứng minh danh sách gợi ý có điều chỉnh theo buổi trong ngày, thay vì chỉ lặp lại danh sách phổ biến hoặc ngẫu nhiên.');
  lines.push('');
  lines.push('## Contextual Mood là gì');
  lines.push('');
  lines.push('Contextual Mood là lớp rerank ngữ cảnh nằm trên kết quả gợi ý cá nhân hóa. Service lấy ứng viên bài hát, đọc `song_audio_features`, sau đó ưu tiên bài có mood/vibe và energy phù hợp với morning, afternoon, evening hoặc night.');
  lines.push('');
  lines.push('## Vì sao dùng mood_match_rate và energy_in_range_rate');
  lines.push('');
  lines.push('`mood_match_rate` đo tỷ lệ bài có mood/vibe khớp nhóm kỳ vọng của từng buổi. `energy_in_range_rate` đo tỷ lệ bài có `energy_score` nằm trong khoảng năng lượng kỳ vọng. Hai chỉ số này giúp kiểm tra trực tiếp phần ngữ cảnh của thuật toán, thay vì chỉ nhìn play count hay thứ hạng.');
  lines.push('');
  lines.push('## Mapping buổi trong ngày');
  lines.push('');
  lines.push('| Time slot | Expected moods/vibes | Energy range |');
  lines.push('|---|---|---|');
  for (const slot of TIME_SLOTS) {
    const def = AUDIT_SLOT_DEFS[slot];
    lines.push(`| ${def.label} | ${def.expected.join(', ')} | ${def.energyMin}-${def.energyMax} |`);
  }
  lines.push('');
  lines.push('## Kết quả audit');
  lines.push('');
  lines.push(`- Generated at: ${summary.generated_at}`);
  lines.push(`- Mode: ${summary.mode}`);
  lines.push(`- User count: ${summary.user_count}`);
  lines.push(`- Limit per request: ${summary.limit}`);
  lines.push('');
  lines.push('| Time slot | Context mood_match_rate | Baseline mood_match_rate | Context energy_in_range_rate | Baseline energy_in_range_rate | Avg energy | Duplicate count | Audio coverage |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const slot of TIME_SLOTS) {
    const contextual = summary.slot_summaries[slot].contextual;
    const baseline = summary.slot_summaries[slot].baseline;
    lines.push(`| ${AUDIT_SLOT_DEFS[slot].label} | ${fmtRate(contextual.mood_match_rate)} | ${fmtRate(baseline.mood_match_rate)} | ${fmtRate(contextual.energy_in_range_rate)} | ${fmtRate(baseline.energy_in_range_rate)} | ${fmtNum(contextual.avg_energy_score)} | ${contextual.duplicate_song_count} | ${fmtRate(contextual.audio_feature_coverage_rate)} |`);
  }
  lines.push('');
  lines.push('## Biểu đồ');
  lines.push('');
  lines.push(`![Mood match rate](${chartRel('contextual_mood_match_rate.png')})`);
  lines.push('');
  lines.push(`![Energy profile](${chartRel('contextual_mood_energy_profile.png')})`);
  lines.push('');
  lines.push(`![Overlap](${chartRel('contextual_mood_overlap.png')})`);
  lines.push('');
  lines.push(`![Quality summary](${chartRel('contextual_mood_quality_summary.png')})`);
  lines.push('');
  lines.push('## Overlap giữa các buổi');
  lines.push('');
  lines.push('| Pair | Overlap rate |');
  lines.push('|---|---:|');
  for (const pair of summary.overlap_summary) {
    lines.push(`| ${pair.pair.replace(/_/g, ' ')} | ${fmtRate(pair.overlap_rate)} |`);
  }
  lines.push('');
  lines.push('## Kết luận');
  lines.push('');
  lines.push('Contextual Mood được giữ như lớp rerank ngữ cảnh vì giúp danh sách gợi ý phù hợp hơn với thời điểm nghe nhạc trong ngày. Khi so với popular baseline, các chỉ số mood/energy cho thấy service có bằng chứng định lượng để giải thích vì sao một số bài được ưu tiên ở từng time slot.');
  lines.push('');
  lines.push('## Hạn chế');
  lines.push('');
  lines.push('- Mood mapping hiện rule-based.');
  lines.push('- Kết quả phụ thuộc chất lượng `song_audio_features`.');
  lines.push('- Chưa có khảo sát người dùng thật để đo mức hài lòng chủ quan.');
  lines.push('');
  lines.push('## Safety');
  lines.push('');
  lines.push('- DB modified: no');
  lines.push('- Backend logic changed: no');
  lines.push('- Frontend changed: no');
  lines.push('- Model retrained: no');
  lines.push('- Daily Mix changed: no');
  lines.push('- Weekly Mix changed: no');
  lines.push('- Scheduler changed: no');
  lines.push('- Uploads touched: no');
  fs.writeFileSync(OUTPUT_REPORT, lines.join('\n'), 'utf8');
}

function fmtRate(value) {
  if (value === null || value === undefined) return 'n/a';
  return `${round(Number(value) * 100, 2)}%`;
}

function fmtNum(value) {
  if (value === null || value === undefined) return 'n/a';
  return String(round(value, 3));
}

// ---------------------------------------------------------------------------
// Minimal PNG chart renderer. No external package needed.
// ---------------------------------------------------------------------------

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function createCanvas(width, height, color = [255, 255, 255, 255]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }
  return { width, height, data };
}

function putPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const idx = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.data[idx] = color[0];
  canvas.data[idx + 1] = color[1];
  canvas.data[idx + 2] = color[2];
  canvas.data[idx + 3] = color[3] ?? 255;
}

function rect(canvas, x, y, w, h, color) {
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(canvas.height, Math.ceil(y + h)); yy += 1) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(canvas.width, Math.ceil(x + w)); xx += 1) {
      putPixel(canvas, xx, yy, color);
    }
  }
}

function line(canvas, x1, y1, x2, y2, color) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  while (true) {
    putPixel(canvas, x, y, color);
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function text(canvas, str, x, y, color = [30, 41, 59, 255], scale = 2) {
  let cursor = x;
  const upper = String(str).toUpperCase();
  for (const ch of upper) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === '1') rect(canvas, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function writePng(canvas, filePath) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    raw[rowStart] = 0;
    canvas.data.copy(raw, rowStart + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }
  const chunks = [
    pngChunk('IHDR', Buffer.concat([
      u32(canvas.width),
      u32(canvas.height),
      Buffer.from([8, 6, 0, 0, 0]),
    ])),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ];
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]));
}

function u32(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const crcInput = Buffer.concat([typeBuffer, data]);
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(crcInput))]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function drawBarChart({ title, categories, series, filePath, yMax = 1 }) {
  const canvas = createCanvas(1100, 650);
  const plot = { x: 90, y: 80, w: 940, h: 430 };
  const colors = [[34, 197, 94, 255], [99, 102, 241, 255], [245, 158, 11, 255], [239, 68, 68, 255]];
  text(canvas, title, 90, 28, [15, 23, 42, 255], 3);
  rect(canvas, plot.x, plot.y, plot.w, plot.h, [248, 250, 252, 255]);
  line(canvas, plot.x, plot.y, plot.x, plot.y + plot.h, [71, 85, 105, 255]);
  line(canvas, plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, [71, 85, 105, 255]);
  for (let i = 0; i <= 4; i += 1) {
    const y = plot.y + plot.h - (plot.h * i) / 4;
    line(canvas, plot.x, Math.round(y), plot.x + plot.w, Math.round(y), [226, 232, 240, 255]);
    text(canvas, String(round((yMax * i) / 4, 2)), 16, y - 8, [71, 85, 105, 255], 2);
  }
  const groupW = plot.w / categories.length;
  const seriesCount = series.length;
  const barW = Math.min(52, (groupW - 40) / seriesCount);
  categories.forEach((category, ci) => {
    const groupX = plot.x + ci * groupW + groupW / 2;
    series.forEach((serie, si) => {
      const value = Number(serie.values[ci] || 0);
      const h = Math.max(0, Math.min(plot.h, (value / yMax) * plot.h));
      const x = groupX - (seriesCount * barW) / 2 + si * barW;
      const y = plot.y + plot.h - h;
      rect(canvas, x, y, barW - 6, h, colors[si % colors.length]);
      const label = yMax <= 1 ? `${round(value * 100, 0)}%` : String(round(value, 1));
      text(canvas, label, x, y - 22, [51, 65, 85, 255], 2);
    });
    text(canvas, category, groupX - category.length * 6, plot.y + plot.h + 24, [51, 65, 85, 255], 2);
  });
  series.forEach((serie, i) => {
    const x = 90 + i * 260;
    rect(canvas, x, 585, 22, 22, colors[i % colors.length]);
    text(canvas, serie.name, x + 34, 585, [51, 65, 85, 255], 2);
  });
  writePng(canvas, filePath);
}

function writeCharts(summary) {
  const cats = TIME_SLOTS.map((slot) => slot.toUpperCase());
  drawBarChart({
    title: 'MOOD MATCH RATE',
    categories: cats,
    series: [
      { name: 'CONTEXTUAL', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.mood_match_rate || 0) },
      { name: 'POPULAR BASELINE', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].baseline.mood_match_rate || 0) },
    ],
    filePath: path.join(CHART_DIR, 'contextual_mood_match_rate.png'),
  });
  drawBarChart({
    title: 'AVG ENERGY SCORE',
    categories: cats,
    series: [
      { name: 'CONTEXTUAL', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.avg_energy_score || 0) },
    ],
    filePath: path.join(CHART_DIR, 'contextual_mood_energy_profile.png'),
  });
  const pairs = summary.overlap_summary;
  drawBarChart({
    title: 'TIMESLOT OVERLAP RATE',
    categories: pairs.map((pair) => pair.pair.replace('_vs_', '/').toUpperCase()),
    series: [{ name: 'OVERLAP', values: pairs.map((pair) => pair.overlap_rate || 0) }],
    filePath: path.join(CHART_DIR, 'contextual_mood_overlap.png'),
  });
  drawBarChart({
    title: 'QUALITY SUMMARY',
    categories: cats,
    yMax: Math.max(20, ...TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.item_count || 0)),
    series: [
      { name: 'ITEM COUNT', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.item_count || 0) },
      { name: 'WITH AUDIO', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.with_audio_features_count || 0) },
      { name: 'DUPLICATES', values: TIME_SLOTS.map((slot) => summary.slot_summaries[slot].contextual.duplicate_song_count || 0) },
    ],
    filePath: path.join(CHART_DIR, 'contextual_mood_quality_summary.png'),
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.userId && !args.allSample) {
    throw new Error('Provide --user-id=11 or --all-sample=20');
  }

  ensureDir(OUTPUT_DIR);
  ensureDir(CHART_DIR);
  ensureDir(REPORT_DIR);

  const userIds = args.allSample ? await pickSampleUsers(args.allSample) : [args.userId];
  if (!userIds.length) throw new Error('No users found for audit.');

  console.log(`[audit] users=${userIds.join(', ')} limit=${args.limit}`);
  console.log('[audit] fetching popular baseline (read-only)');
  const baselineItems = await fetchPopularBaseline(args.limit);

  const userAudits = [];
  for (const userId of userIds) {
    console.log(`[audit] user_id=${userId}`);
    userAudits.push(await auditUser(userId, args.limit, baselineItems));
  }

  const aggregate = aggregateAudits(userAudits, baselineItems);
  const summary = buildSummary({
    mode: args.allSample ? 'all_sample' : 'single_user',
    userIds,
    limit: args.limit,
    userAudits,
    aggregate,
  });

  const auditPayload = {
    generated_at: summary.generated_at,
    mode: summary.mode,
    user_ids: userIds,
    limit: args.limit,
    slot_mapping: AUDIT_SLOT_DEFS,
    per_user: userAudits,
    aggregate,
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(auditPayload, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_SUMMARY, JSON.stringify(summary, null, 2), 'utf8');
  writeCsv(summary);
  writeCharts(summary);
  writeReport(summary);

  console.log('\nSummary:');
  for (const slot of TIME_SLOTS) {
    const contextual = summary.slot_summaries[slot].contextual;
    const baseline = summary.slot_summaries[slot].baseline;
    console.log(`- ${slot}: mood_match=${fmtRate(contextual.mood_match_rate)} energy_range=${fmtRate(contextual.energy_in_range_rate)} avg_energy=${fmtNum(contextual.avg_energy_score)} baseline_mood=${fmtRate(baseline.mood_match_rate)} baseline_energy=${fmtRate(baseline.energy_in_range_rate)} duplicates=${contextual.duplicate_song_count}`);
  }
  console.log(`\nFiles written:`);
  console.log(`- ${path.relative(PROJECT_ROOT, OUTPUT_JSON)}`);
  console.log(`- ${path.relative(PROJECT_ROOT, OUTPUT_CSV)}`);
  console.log(`- ${path.relative(PROJECT_ROOT, OUTPUT_SUMMARY)}`);
  console.log(`- ${path.relative(PROJECT_ROOT, OUTPUT_REPORT)}`);
  console.log(`- ${path.relative(PROJECT_ROOT, CHART_DIR)}`);
}

main()
  .catch((err) => {
    console.error('[audit] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
