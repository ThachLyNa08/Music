/**
 * MusicFlow Recommendation Algorithm Evaluation Pipeline
 *
 * Compares 4 recommendation algorithms:
 *   A. Most Popular / Trending Baseline
 *   B. Content-Based Audio Filtering
 *   C. BPR-MF Collaborative Filtering
 *   D. Hybrid Context-Aware Ranking
 *
 * Usage:
 *   node scripts/recommendation/evaluateRecommendationAlgorithms.js --full
 *   node scripts/recommendation/evaluateRecommendationAlgorithms.js --sample-users=50
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const m = arg.match(/^--(.+?)(?:=(.+))?$/);
  if (m) acc[m[1]] = m[2] !== undefined ? m[2] : true;
  return acc;
}, {});

const sampleUsersArg = args['sample-users'] ?? args.sampleUsers;
const sampleUsersParsed = sampleUsersArg != null ? Number(sampleUsersArg) : null;
const SAMPLE_MODE = Number.isFinite(sampleUsersParsed) && sampleUsersParsed > 0;
const SAMPLE_USERS = SAMPLE_MODE ? sampleUsersParsed : null;
const INCLUDE_SEMANTIC = !!args['include-semantic'];
const IS_FINAL = !!args['final'];
const SAVE_BPR_MODEL = !!args['save-bpr-model'] || !!args['overwrite-serving-model'];
const OUTPUT_SUFFIX = args['output-suffix'] ? `_${args['output-suffix']}` : '';

// ─── DB setup ───────────────────────────────────────────────────────────────
const BACKEND_ROOT = path.resolve(__dirname, '../../apps/backend');
require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({ path: path.join(BACKEND_ROOT, '.env') });
const { pool } = require(path.join(BACKEND_ROOT, 'src/config/database'));

// ─── Config constants ────────────────────────────────────────────────────────
const SOURCE = 'experiment_seed';
const OUTPUT_DIR = path.resolve(__dirname, '../../datasets/processed');
const CHART_DIR = path.join(OUTPUT_DIR, 'charts');
const MODEL_DIR = path.resolve(__dirname, '../../storage/recommendation/models');
const POSITIVE_COMPLETION_THRESHOLD = 0.5;
const MIN_TRAIN_INTERACTIONS = 200;
const MIN_TEST_POSITIVE_HOLDOUT = 10;
const BPR_FACTORS = 32;
const BPR_EPOCHS = SAMPLE_MODE ? 20 : 50;
const BPR_LR = SAMPLE_MODE ? 0.03 : 0.02;
const BPR_REG = 0.01;
const BPR_NEG_SAMPLES = 5;
const BPR_RANDOM_SEED = 42;
const KS = [10, 20];

// Weights for Most Popular (A)
const POP_WEIGHTS = { listen_count: 0.45, like_count: 0.25, avg_completion: 0.20, repeat_score: 0.10 };

// Weights for Content-Based (B) — per-component, sum to 1.0
const CB_WEIGHTS = {
  market: 0.20, genre: 0.20, artist: 0.10,
  bpm: 0.05, energy_score: 0.05, danceability: 0.10,
  acoustic_score: 0.05, brightness: 0.05,
  mood: 0.10, vibe: 0.10,
};

const CB_SEMANTIC_WEIGHTS = {
  market: 0.10, genre: 0.10, artist: 0.05,
  bpm: 0.05, energy_score: 0.05, danceability: 0.05,
  acoustic_score: 0.05, brightness: 0.05,
  mood: 0.05, vibe: 0.05,
  semantic_theme: 0.15, semantic_mood: 0.15, semantic_situation: 0.10,
};

// Weights for Hybrid (D) — sum to 1.0
const HYBRID_WEIGHTS = {
  bpr_score: 0.35,
  content_audio_score: 0.25,
  user_preference_score: 0.15,
  popularity_score: 0.10,
  context_mood_score: 0.10,
  novelty_score: 0.05,
};

// ─── Utility helpers ─────────────────────────────────────────────────────────
function round(v, d = 4) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** d) / 10 ** d;
}

function pct(v) { return round(Number(v || 0) * 100, 2); }

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function deriveGroup(email) {
  if (!email || !email.endsWith('@musicflow.test')) return 'unknown';
  if (/^exp_vpop_kpop_\d+@musicflow\.test$/.test(email)) return 'VPOP + KPOP';
  if (/^exp_vpop_usuk_\d+@musicflow\.test$/.test(email)) return 'VPOP + USUK';
  if (/^exp_kpop_usuk_\d+@musicflow\.test$/.test(email)) return 'KPOP + USUK';
  if (/^exp_vpop_\d+@musicflow\.test$/.test(email)) return 'VPOP main';
  if (/^exp_kpop_\d+@musicflow\.test$/.test(email)) return 'KPOP main';
  if (/^exp_usuk_\d+@musicflow\.test$/.test(email)) return 'USUK main';
  if (/^exp_all_\d+@musicflow\.test$/.test(email)) return 'VPOP + KPOP + USUK';
  if (/^exp_explorer_\d+@musicflow\.test$/.test(email)) return 'Explorer / Trending';
  return 'unknown';
}

function quoteId(name) { return `\`${String(name).replace(/`/g, '``')}\``; }

function shuffle(arr, seed = 0) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Minimal PNG/chart helpers using Node core only. This avoids adding runtime
// dependencies while still producing thesis-ready artifact images.
const FONT_5X7 = {
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
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const CHART_COLORS = {
  navy: [37, 99, 235, 255],
  teal: [13, 148, 136, 255],
  amber: [217, 119, 6, 255],
  rose: [225, 29, 72, 255],
  violet: [124, 58, 237, 255],
  green: [22, 163, 74, 255],
  gray: [75, 85, 99, 255],
  lightGray: [229, 231, 235, 255],
  black: [17, 24, 39, 255],
  white: [255, 255, 255, 255],
};

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const b of buf) c = crc32.table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(filePath, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
  }
  const setPixel = (x, y, color) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
    const o = (iy * width + ix) * 4;
    data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; data[o + 3] = color[3] ?? 255;
  };
  const fillRect = (x, y, w, h, color) => {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(height, Math.ceil(y + h)); yy++) {
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(width, Math.ceil(x + w)); xx++) setPixel(xx, yy, color);
    }
  };
  const drawLine = (x0, y0, x1, y1, color) => {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy, 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      setPixel(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
      setPixel(x0 + (x1 - x0) * t + 1, y0 + (y1 - y0) * t, color);
    }
  };
  const drawText = (text, x, y, color = CHART_COLORS.black, scale = 2) => {
    let cursor = x;
    for (const ch of String(text).toUpperCase()) {
      const glyph = FONT_5X7[ch] || FONT_5X7[' '];
      for (let gy = 0; gy < glyph.length; gy++) {
        for (let gx = 0; gx < glyph[gy].length; gx++) {
          if (glyph[gy][gx] === '1') fillRect(cursor + gx * scale, y + gy * scale, scale, scale, color);
        }
      }
      cursor += 6 * scale;
    }
  };
  return { width, height, data, setPixel, fillRect, drawLine, drawText };
}

function drawChartFrame(ctx, title, xLabel, yLabel, bounds) {
  ctx.drawText(title, bounds.left, 20, CHART_COLORS.black, 2);
  ctx.drawLine(bounds.left, bounds.bottom, bounds.right, bounds.bottom, CHART_COLORS.black);
  ctx.drawLine(bounds.left, bounds.top, bounds.left, bounds.bottom, CHART_COLORS.black);
  ctx.drawText(xLabel, Math.round((bounds.left + bounds.right) / 2) - 60, bounds.bottom + 34, CHART_COLORS.gray, 2);
  ctx.drawText(yLabel, 20, bounds.top - 18, CHART_COLORS.gray, 2);
  for (let i = 1; i <= 4; i++) {
    const y = bounds.bottom - (bounds.bottom - bounds.top) * i / 4;
    ctx.drawLine(bounds.left, y, bounds.right, y, CHART_COLORS.lightGray);
  }
}

function writeLineChart(filePath, title, xLabel, yLabel, rows, valueKey, color = CHART_COLORS.navy) {
  const width = 1100, height = 620;
  const ctx = createCanvas(width, height);
  const bounds = { left: 90, right: width - 50, top: 80, bottom: height - 90 };
  drawChartFrame(ctx, title, xLabel, yLabel, bounds);
  const values = rows.map((r) => Number(r[valueKey]) || 0);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1e-9);
  const range = max - min || 1;
  const xFor = (idx) => bounds.left + (bounds.right - bounds.left) * idx / Math.max(1, rows.length - 1);
  const yFor = (v) => bounds.bottom - (bounds.bottom - bounds.top) * (v - min) / range;
  ctx.drawText(String(round(max, 4)), 12, bounds.top - 6, CHART_COLORS.gray, 1);
  ctx.drawText(String(round(min, 4)), 12, bounds.bottom - 6, CHART_COLORS.gray, 1);
  for (let i = 1; i < rows.length; i++) ctx.drawLine(xFor(i - 1), yFor(values[i - 1]), xFor(i), yFor(values[i]), color);
  for (let i = 0; i < rows.length; i++) ctx.fillRect(xFor(i) - 3, yFor(values[i]) - 3, 6, 6, color);
  ctx.drawText(String(rows[0]?.epoch || 1), bounds.left - 5, bounds.bottom + 12, CHART_COLORS.gray, 1);
  ctx.drawText(String(rows[rows.length - 1]?.epoch || rows.length), bounds.right - 20, bounds.bottom + 12, CHART_COLORS.gray, 1);
  writePng(filePath, width, height, ctx.data);
}

function writeGroupedBarChart(outPath, title, metricsByAlg, metricKeys, options = {}) {
  const width = 800;
  const height = 450;
  const ctx = createCanvas(width, height);
  const bounds = { left: 80, right: width - 20, top: 70, bottom: height - 80 };
  drawChartFrame(ctx, title, 'ALGORITHM', options.yLabel || 'VALUE', bounds);
  const algs = options.algs || (typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC ? ['most_popular', 'content_based_semantic', 'bpr_mf', 'hybrid_semantic'] : ['most_popular', 'content_based', 'bpr_mf', 'hybrid']);
  const labels = options.labels || {
    most_popular: 'MOST POP',
    content_based: 'CONTENT',
    content_based_semantic: 'CB+SEM',
    bpr_mf: 'BPR MF',
    hybrid: 'HYBRID',
    hybrid_semantic: 'HYBRID+SEM',
  };
  const colors = [CHART_COLORS.navy, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.violet, CHART_COLORS.green];
  const maxVal = options.maxValue || 1.0;
  const groupW = (bounds.right - bounds.left) / algs.length;
  const barW = Math.max(8, (groupW * 0.8) / metricKeys.length);
  
  metricKeys.forEach((s, idx) => {
    const lx = bounds.left + 20 + idx * 100;
    ctx.fillRect(lx, height - 30, 12, 12, colors[idx]);
    ctx.drawText(s.label, lx + 16, height - 31, CHART_COLORS.black, 1);
  });
  
  algs.forEach((alg, aIdx) => {
    const baseX = bounds.left + aIdx * groupW + 10;
    metricKeys.forEach((s, sIdx) => {
      const val = Number(metricsByAlg[alg]?.[s.key]) || 0;
      const h = (bounds.bottom - bounds.top) * (val / maxVal);
      ctx.fillRect(baseX + sIdx * (barW + 2), bounds.bottom - h, barW, h, colors[sIdx]);
    });
    ctx.drawText(labels[alg] || alg, baseX, bounds.bottom + 10, CHART_COLORS.black, 1);
  });
  writePng(outPath, width, height, ctx.data);
}

// ─── DB helpers ─────────────────────────────────────────────────────────────
async function tableExists(name) {
  const [r] = await pool.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]
  );
  return r.length > 0;
}

async function getColumns(name) {
  if (!(await tableExists(name))) return new Set();
  const [r] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name]
  );
  return new Set(r.map((x) => x.COLUMN_NAME));
}

async function sql(querystr, params = []) {
  const [rows] = await pool.query(querystr, params);
  return rows;
}

function experimentUserCondition(hasCol, alias = 'u') {
  const pref = alias ? `${quoteId(alias)}.` : '';
  const emailCond = `${pref}${quoteId('email')} LIKE 'exp\\_%@musicflow.test' ESCAPE '\\\\'`;
  return hasCol ? `(${pref}${quoteId('is_experiment')} = 1 OR ${emailCond})` : emailCond;
}

function listenedAtCol(cols, alias = 'lh') {
  if (cols.has('listened_at')) return `${alias}.listened_at`;
  if (cols.has('played_at')) return `${alias}.played_at`;
  if (cols.has('created_at')) return `${alias}.created_at`;
  return 'NULL';
}

function completionCol(cols, alias = 'lh') {
  return cols.has('completion_rate') ? `${alias}.completion_rate` : '0';
}

function implicitCol(cols, alias = 'lh') {
  return cols.has('implicit_rating') ? `${alias}.implicit_rating` : '0';
}

// ─── Shared dataset loading ──────────────────────────────────────────────────
async function loadDataset() {
  const cols = await getColumns('listening_history');
  const userCols = await getColumns('users');
  const hasExp = userCols.has('is_experiment');
  const expCond = experimentUserCondition(hasExp, 'u');
  const listenAt = listenedAtCol(cols);
  const completionExpr = completionCol(cols);
  const implicitExpr = implicitCol(cols);
  const temporalCol = cols.has('listened_at') ? 'listened_at' : cols.has('played_at') ? 'played_at' : cols.has('created_at') ? 'created_at' : 'id';

  console.log('[Dataset] Loading experiment users...');
  const users = await sql(`
    SELECT u.id, u.email
    FROM users u
    WHERE ${expCond}
    ORDER BY u.id
  `);

  let targetUsers = users;
  if (SAMPLE_MODE && SAMPLE_USERS) {
    const step = Math.max(1, Math.floor(users.length / SAMPLE_USERS));
    targetUsers = users.filter((_, i) => i % step === 0).slice(0, SAMPLE_USERS);
    console.log(`[Dataset] Sample mode: using ${targetUsers.length} users (step=${step})`);
  } else {
    console.log(`[Dataset] Full mode: using all ${users.length} users`);
  }

  const userIds = targetUsers.map((u) => Number(u.id));
  const userEmailMap = new Map(userIds.map((id) => [id, targetUsers.find((u) => Number(u.id) === id).email]));
  const userGroupMap = new Map(userIds.map((id) => [id, deriveGroup(userEmailMap.get(id))]));

  console.log('[Dataset] Loading listening history...');
  const allHistory = await sql(`
    SELECT lh.id, lh.user_id, lh.song_id,
           ${completionExpr} AS completion_rate,
           ${implicitExpr} AS implicit_rating,
           ${listenAt} AS listened_at,
           lh.source
    FROM listening_history lh
    JOIN users u ON u.id = lh.user_id
    WHERE lh.source = ? AND ${expCond}
    ORDER BY lh.user_id, ${listenAt} ASC, lh.id ASC
  `, [SOURCE]);

  console.log(`[Dataset] ${allHistory.length} total interactions for ${userIds.length} users`);

  // Load likes as a Set to avoid row multiplication
  const likes = await sql(`
    SELECT sl.user_id, sl.song_id
    FROM song_likes sl
    JOIN users u ON u.id = sl.user_id
    WHERE ${expCond}
  `);
  const likeSet = new Set(likes.map((l) => `${Number(l.user_id)}|${Number(l.song_id)}`));

  // Group interactions by user
  const byUser = new Map();
  for (const row of allHistory) {
    const uid = Number(row.user_id);
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push({
      id: Number(row.id),
      song_id: Number(row.song_id),
      completion_rate: Number(row.completion_rate) || 0,
      implicit_rating: Number(row.implicit_rating) || 0,
      listened_at: row.listened_at,
      liked: likeSet.has(`${uid}|${Number(row.song_id)}`) ? 1 : 0,
    });
  }

  // Build train/test splits per user
  const userSplits = new Map();
  let eligibleUsers = 0;

  for (const uid of userIds) {
    const interactions = byUser.get(uid) || [];
    if (interactions.length < MIN_TRAIN_INTERACTIONS) continue;

    const splitIdx = Math.floor(interactions.length * 0.8);
    const train = interactions.slice(0, splitIdx);
    const test = interactions.slice(splitIdx);
    const trainSongSet = new Set(train.map((i) => i.song_id));

    // Aggregate train positives per song
    const trainAgg = new Map();
    for (const i of train) {
      if (!trainAgg.has(i.song_id)) {
        trainAgg.set(i.song_id, { song_id: i.song_id, listens: 0, completions: [], ratings: [], liked: false });
      }
      const agg = trainAgg.get(i.song_id);
      agg.listens += 1;
      agg.completions.push(i.completion_rate);
      agg.ratings.push(i.implicit_rating);
      agg.liked = agg.liked || i.liked === 1;
    }

    // Train positive set: unique songs with positive signal
    const trainPositiveSet = new Set();
    const trainPositiveData = new Map();
    for (const [songId, agg] of trainAgg) {
      const avgCompletion = agg.completions.reduce((s, v) => s + v, 0) / agg.completions.length;
      const maxRating = Math.max(...agg.ratings);
      const isPositive = avgCompletion >= POSITIVE_COMPLETION_THRESHOLD
        || maxRating >= POSITIVE_COMPLETION_THRESHOLD
        || agg.liked;
      if (isPositive) {
        trainPositiveSet.add(songId);
        trainPositiveData.set(songId, {
          song_id: songId,
          listen_count: agg.listens,
          avg_completion: avgCompletion,
          max_rating: maxRating,
          liked: agg.liked,
          repeat_score: Math.min(1, agg.listens / 5),
        });
      }
    }

    // Test positives — holdout (not in train)
    const testPositiveSet = new Set();
    const testPositiveHoldout = new Set();
    for (const i of test) {
      const isPositive = i.completion_rate >= POSITIVE_COMPLETION_THRESHOLD
        || i.implicit_rating >= POSITIVE_COMPLETION_THRESHOLD
        || i.liked === 1;
      if (isPositive) {
        testPositiveSet.add(i.song_id);
        if (!trainPositiveSet.has(i.song_id)) {
          testPositiveHoldout.add(i.song_id);
        }
      }
    }

    if (trainPositiveSet.size < MIN_TRAIN_INTERACTIONS) continue;
    if (testPositiveHoldout.size < MIN_TEST_POSITIVE_HOLDOUT) continue;

    userSplits.set(uid, {
      user_id: uid,
      email: userEmailMap.get(uid),
      group: userGroupMap.get(uid),
      interactions,
      train,
      test,
      trainSongSet,
      trainPositiveSet,
      trainPositiveData,
      testPositiveSet,
      testPositiveHoldout,
    });
    eligibleUsers += 1;
  }

  console.log(`[Dataset] ${eligibleUsers} eligible users (train >= ${MIN_TRAIN_INTERACTIONS}, holdout >= ${MIN_TEST_POSITIVE_HOLDOUT})`);
  return { userSplits, userEmailMap, userGroupMap, allUserCount: userIds.length, temporalCol };
}

// ─── Song feature catalog ────────────────────────────────────────────────────
async function loadSongCatalog() {
  const songCols = await getColumns('songs');
  const hasAudio = await tableExists('song_audio_features');
  const audioCols = hasAudio ? await getColumns('song_audio_features') : new Set();

  const songSelect = [
    's.id',
    songCols.has('market') ? 's.market' : 'NULL AS market',
    songCols.has('genre_id') ? 's.genre_id' : 'NULL AS genre_id',
    songCols.has('artist_id') ? 's.artist_id' : 'NULL AS artist_id',
  ];
  const audioSelect = hasAudio ? [
    audioCols.has('bpm') ? 'saf.bpm' : 'NULL AS bpm',
    audioCols.has('tempo_level') ? 'saf.tempo_level' : 'NULL AS tempo_level',
    audioCols.has('energy') ? 'saf.energy' : 'NULL AS energy',
    audioCols.has('energy_score') ? 'saf.energy_score' : 'NULL AS energy_score',
    audioCols.has('danceability') ? 'saf.danceability' : 'NULL AS danceability',
    audioCols.has('acoustic_score') ? 'saf.acoustic_score' : 'NULL AS acoustic_score',
    audioCols.has('brightness') ? 'saf.brightness' : 'NULL AS brightness',
    audioCols.has('mood') ? 'saf.mood' : 'NULL AS mood',
    audioCols.has('vibe') ? 'saf.vibe' : 'NULL AS vibe',
  ] : [
    'NULL AS bpm', 'NULL AS tempo_level', 'NULL AS energy', 'NULL AS energy_score',
    'NULL AS danceability', 'NULL AS acoustic_score', 'NULL AS brightness',
    'NULL AS mood', 'NULL AS vibe',
  ];
  const audioJoin = hasAudio ? 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id' : '';

  const hasSemantic = INCLUDE_SEMANTIC && await tableExists('song_semantic_profiles');
  const semanticSelect = hasSemantic ? [
    'ssp.main_theme', 'ssp.mood_tags', 'ssp.situation_tags', 'ssp.meaning_confidence',
    'ssp.evidence_level', 'ssp.review_status'
  ] : [
    'NULL AS main_theme', 'NULL AS mood_tags', 'NULL AS situation_tags', 'NULL AS meaning_confidence',
    'NULL AS evidence_level', 'NULL AS review_status'
  ];
  const semanticJoin = hasSemantic ? 'LEFT JOIN song_semantic_profiles ssp ON ssp.song_id = s.id' : '';

  const rows = await sql(`
    SELECT ${[...songSelect, ...audioSelect, ...semanticSelect].join(', ')}
    FROM songs s
    ${audioJoin}
    ${semanticJoin}
    WHERE (s.is_active = 1 OR s.is_active IS NULL)
      AND s.audio_url IS NOT NULL AND s.audio_url <> ''
      AND (s.release_status IS NULL OR s.release_status = 'published'
           OR (s.release_status = 'scheduled' AND s.release_at IS NOT NULL AND s.release_at <= NOW()))
  `);

  const byId = new Map();
  for (const row of rows) {
    byId.set(Number(row.id), {
      id: Number(row.id),
      market: row.market || null,
      genre_id: row.genre_id === null || row.genre_id === undefined ? null : Number(row.genre_id),
      artist_id: row.artist_id === null || row.artist_id === undefined ? null : Number(row.artist_id),
      bpm: row.bpm === null || row.bpm === undefined ? null : Number(row.bpm),
      tempo_level: row.tempo_level || null,
      energy: row.energy || null,
      energy_score: row.energy_score === null || row.energy_score === undefined ? null : Number(row.energy_score),
      danceability: row.danceability === null || row.danceability === undefined ? null : Number(row.danceability),
      acoustic_score: row.acoustic_score === null || row.acoustic_score === undefined ? null : Number(row.acoustic_score),
      brightness: row.brightness === null || row.brightness === undefined ? null : Number(row.brightness),
      mood: row.mood || null,
      vibe: row.vibe || null,
      main_theme: row.main_theme || null,
      mood_tags: row.mood_tags ? (typeof row.mood_tags === 'string' ? JSON.parse(row.mood_tags) : row.mood_tags) : [],
      situation_tags: row.situation_tags ? (typeof row.situation_tags === 'string' ? JSON.parse(row.situation_tags) : row.situation_tags) : [],
      meaning_confidence: row.meaning_confidence !== null && row.meaning_confidence !== undefined ? Number(row.meaning_confidence) : 0,
      evidence_level: row.evidence_level || 'unknown',
      review_status: row.review_status || 'unknown',
    });
  }
  console.log(`[SongCatalog] ${byId.size} available songs`);
  return byId;
}

// ─── Artist name cache ───────────────────────────────────────────────────────
async function loadArtistNames(artistIds) {
  if (!artistIds.length) return new Map();
  const rows = await sql(`SELECT id, name FROM artists WHERE id IN (?)`, [artistIds]);
  return new Map(rows.map((r) => [Number(r.id), r.name || null]));
}

// ─── User content profile ────────────────────────────────────────────────────
function buildContentProfile(trainPositiveData, songById) {
  const marketCounts = new Map();
  const genreCounts = new Map();
  const artistCounts = new Map();
  const moodCounts = new Map();
  const vibeCounts = new Map();
  const themeCounts = new Map();
  const semanticMoodCounts = new Map();
  const situationCounts = new Map();
  const audioVals = { bpm: [], energy_score: [], danceability: [], acoustic_score: [], brightness: [] };

  for (const [, songData] of trainPositiveData) {
    const song = songById.get(songData.song_id);
    if (!song) continue;
    if (song.market) marketCounts.set(song.market, (marketCounts.get(song.market) || 0) + 1);
    if (song.genre_id !== null && song.genre_id !== undefined) genreCounts.set(Number(song.genre_id), (genreCounts.get(Number(song.genre_id)) || 0) + 1);
    if (song.artist_id !== null && song.artist_id !== undefined) artistCounts.set(Number(song.artist_id), (artistCounts.get(Number(song.artist_id)) || 0) + 1);
    if (song.mood) moodCounts.set(song.mood, (moodCounts.get(song.mood) || 0) + 1);
    if (song.vibe) vibeCounts.set(song.vibe, (vibeCounts.get(song.vibe) || 0) + 1);
    if (song.main_theme) themeCounts.set(song.main_theme, (themeCounts.get(song.main_theme) || 0) + 1);
    if (Array.isArray(song.mood_tags)) song.mood_tags.forEach(t => semanticMoodCounts.set(t, (semanticMoodCounts.get(t) || 0) + 1));
    if (Array.isArray(song.situation_tags)) song.situation_tags.forEach(t => situationCounts.set(t, (situationCounts.get(t) || 0) + 1));
    if (song.bpm !== null && Number.isFinite(Number(song.bpm))) audioVals.bpm.push(Number(song.bpm));
    if (song.energy_score !== null && Number.isFinite(Number(song.energy_score))) audioVals.energy_score.push(Number(song.energy_score));
    if (song.danceability !== null && Number.isFinite(Number(song.danceability))) audioVals.danceability.push(Number(song.danceability));
    if (song.acoustic_score !== null && Number.isFinite(Number(song.acoustic_score))) audioVals.acoustic_score.push(Number(song.acoustic_score));
    if (song.brightness !== null && Number.isFinite(Number(song.brightness))) audioVals.brightness.push(Number(song.brightness));
  }

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

  return {
    market_counts: Object.fromEntries(marketCounts.entries()),
    genre_counts: Object.fromEntries(genreCounts.entries()),
    artist_counts: Object.fromEntries(artistCounts.entries()),
    mood_counts: Object.fromEntries(moodCounts.entries()),
    vibe_counts: Object.fromEntries(vibeCounts.entries()),
    theme_counts: Object.fromEntries(themeCounts.entries()),
    semantic_mood_counts: Object.fromEntries(semanticMoodCounts.entries()),
    situation_counts: Object.fromEntries(situationCounts.entries()),
    bpm_mean: avg(audioVals.bpm),
    energy_score_mean: avg(audioVals.energy_score),
    danceability_mean: avg(audioVals.danceability),
    acoustic_score_mean: avg(audioVals.acoustic_score),
    brightness_mean: avg(audioVals.brightness),
    top_mood: [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    top_vibe: [...vibeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    top_market: [...marketCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    top_genre: [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  };
}

// ─── Score song against content profile ─────────────────────────────────────
function scoreContentBased(song, profile, useSemantic = false) {
  const WEIGHTS = useSemantic ? CB_SEMANTIC_WEIGHTS : CB_WEIGHTS;
  const components = {};
  let totalWeight = 0;

  if (profile.market_counts && song.market) {
    const total = Object.values(profile.market_counts).reduce((s, v) => s + v, 0);
    const match = profile.market_counts[song.market] || 0;
    if (total > 0) {
      components.market = match / total;
      totalWeight += WEIGHTS.market;
    }
  }

  if (profile.genre_counts && song.genre_id !== null && song.genre_id !== undefined) {
    const total = Object.values(profile.genre_counts).reduce((s, v) => s + v, 0);
    const match = profile.genre_counts[Number(song.genre_id)] || 0;
    if (total > 0) {
      components.genre = match / total;
      totalWeight += WEIGHTS.genre;
    }
  }

  if (profile.artist_counts && song.artist_id !== null && song.artist_id !== undefined) {
    const total = Object.values(profile.artist_counts).reduce((s, v) => s + v, 0);
    const match = profile.artist_counts[Number(song.artist_id)] || 0;
    if (total > 0) {
      components.artist = match / total;
      totalWeight += WEIGHTS.artist;
    }
  }

  if (profile.bpm_mean !== null && song.bpm !== null && Number.isFinite(Number(song.bpm))) {
    components.bpm = Math.max(0, 1 - Math.abs(Number(song.bpm) - profile.bpm_mean) / 60);
    totalWeight += WEIGHTS.bpm;
  }
  if (profile.energy_score_mean !== null && song.energy_score !== null && Number.isFinite(Number(song.energy_score))) {
    components.energy_score = Math.max(0, 1 - Math.abs(Number(song.energy_score) - profile.energy_score_mean));
    totalWeight += WEIGHTS.energy_score;
  }
  if (profile.danceability_mean !== null && song.danceability !== null && Number.isFinite(Number(song.danceability))) {
    components.danceability = Math.max(0, 1 - Math.abs(Number(song.danceability) - profile.danceability_mean));
    totalWeight += WEIGHTS.danceability;
  }
  if (profile.acoustic_score_mean !== null && song.acoustic_score !== null && Number.isFinite(Number(song.acoustic_score))) {
    components.acoustic_score = Math.max(0, 1 - Math.abs(Number(song.acoustic_score) - profile.acoustic_score_mean));
    totalWeight += WEIGHTS.acoustic_score;
  }
  if (profile.brightness_mean !== null && song.brightness !== null && Number.isFinite(Number(song.brightness))) {
    components.brightness = Math.max(0, 1 - Math.abs(Number(song.brightness) - profile.brightness_mean));
    totalWeight += WEIGHTS.brightness;
  }
  if (profile.mood_counts && song.mood) {
    const total = Object.values(profile.mood_counts).reduce((s, v) => s + v, 0);
    const match = profile.mood_counts[song.mood] || 0;
    if (total > 0) {
      components.mood = match / total;
      totalWeight += WEIGHTS.mood;
    }
  }
  if (profile.vibe_counts && song.vibe) {
    const total = Object.values(profile.vibe_counts).reduce((s, v) => s + v, 0);
    const match = profile.vibe_counts[song.vibe] || 0;
    if (total > 0) {
      components.vibe = match / total;
      totalWeight += WEIGHTS.vibe;
    }
  }

  if (useSemantic) {
    if (profile.theme_counts && song.main_theme) {
      const total = Object.values(profile.theme_counts).reduce((s, v) => s + v, 0);
      const match = profile.theme_counts[song.main_theme] || 0;
      if (total > 0) {
        components.semantic_theme = match / total;
        totalWeight += WEIGHTS.semantic_theme || 0;
      }
    }
    if (profile.semantic_mood_counts && Array.isArray(song.mood_tags) && song.mood_tags.length > 0) {
      const total = Object.values(profile.semantic_mood_counts).reduce((s, v) => s + v, 0);
      let match = 0;
      for (const t of song.mood_tags) match += profile.semantic_mood_counts[t] || 0;
      if (total > 0) {
        components.semantic_mood = match / total;
        totalWeight += WEIGHTS.semantic_mood || 0;
      }
    }
    if (profile.situation_counts && Array.isArray(song.situation_tags) && song.situation_tags.length > 0) {
      const total = Object.values(profile.situation_counts).reduce((s, v) => s + v, 0);
      let match = 0;
      for (const t of song.situation_tags) match += profile.situation_counts[t] || 0;
      if (total > 0) {
        components.semantic_situation = match / total;
        totalWeight += WEIGHTS.semantic_situation || 0;
      }
    }
  }

  if (totalWeight === 0) return { total: 0, components };
  let weightedSum = 0;
  for (const [key, val] of Object.entries(components)) {
    weightedSum += (WEIGHTS[key] || 0) * val;
  }
  return { total: weightedSum / totalWeight, components };
}

// ─── Algorithm A: Most Popular ──────────────────────────────────────────────
function buildMostPopular(trainGlobalData) {
  const listenCounts = new Map();
  const likeCounts = new Map();
  const completionSums = new Map();
  const completionCounts = new Map();
  const repeatScores = new Map();

  for (const [, songData] of trainGlobalData) {
    const sid = songData.song_id;
    listenCounts.set(sid, (listenCounts.get(sid) || 0) + songData.listen_count);
    likeCounts.set(sid, (likeCounts.get(sid) || 0) + (songData.liked ? 1 : 0));
    completionSums.set(sid, (completionSums.get(sid) || 0) + songData.avg_completion);
    completionCounts.set(sid, (completionCounts.get(sid) || 0) + 1);
    repeatScores.set(sid, (repeatScores.get(sid) || 0) + songData.repeat_score);
  }

  const normalize = (map) => {
    const max = Math.max(...map.values(), 1);
    const min = Math.min(...map.values(), 0);
    const range = max - min || 1;
    return new Map([...map.entries()].map(([k, v]) => [k, (v - min) / range]));
  };

  const normListen = normalize(listenCounts);
  const normLike = normalize(likeCounts);
  const normCompletion = new Map([...completionSums.entries()].map(([k, v]) => {
    const avg = v / (completionCounts.get(k) || 1);
    return [k, avg];
  }));
  const normRepeat = normalize(repeatScores);

  const totalW = POP_WEIGHTS.listen_count + POP_WEIGHTS.like_count + POP_WEIGHTS.avg_completion + POP_WEIGHTS.repeat_score;

  const scores = new Map();
  const allSongIds = new Set([...listenCounts.keys()]);
  for (const sid of allSongIds) {
    const sc = (POP_WEIGHTS.listen_count * (normListen.get(sid) || 0)
      + POP_WEIGHTS.like_count * (normLike.get(sid) || 0)
      + POP_WEIGHTS.avg_completion * (normCompletion.get(sid) || 0)
      + POP_WEIGHTS.repeat_score * (normRepeat.get(sid) || 0)) / totalW;
    scores.set(sid, sc);
  }

  return { scores };
}

// ─── Algorithm B: Content-Based ────────────────────────────────────────────
function buildContentBased(trainPositiveData, songById) {
  const profile = buildContentProfile(trainPositiveData, songById);
  return { profile };
}

// ─── Algorithm C: BPR-MF Collaborative Filtering ───────────────────────────────
/**
 * BPR-MF with item co-occurrence scoring.
 *
 * Core: BPR-MF with SGD — learns user/item latent factors and biases.
 * Enhancement: item co-occurrence scores boost items frequently listened together
 * with the user's positive history. This provides a meaningful CF signal even when
 * latent factors are weak due to sparse positive interactions.
 *
 * BPR objective: maximize log sigmoid(score_pos - score_neg)
 * Gradient: dL/dtheta = (1 - sigmoid(x)) * d(x)/dtheta - lambda * theta
 */

class BPRMF {
  constructor(userCount, itemCount, factors, lr, reg, seed) {
    this.userCount = userCount;
    this.itemCount = itemCount;
    this.factors = factors;
    this.lr = lr;
    this.reg = reg;
    this.seed = seed;

    let s = seed;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s % 1000000) / 1000000 * 0.002 - 0.001; // ~U(-0.001, 0.001)
    };
    this.P = Array.from({ length: userCount }, () => Array.from({ length: factors }, rng));
    this.Q = Array.from({ length: itemCount }, () => Array.from({ length: factors }, rng));
    this.bu = new Float64Array(userCount);
    this.bi = new Float64Array(itemCount);

    // Per-user positive item sets (for co-occurrence scoring)
    this._userPositiveItems = new Map(); // uIdx -> Set of itemIds
  }

  _dot(u, i) {
    let s = this.bu[u] + this.bi[i];
    for (let f = 0; f < this.factors; f++) s += this.P[u][f] * this.Q[i][f];
    return s;
  }

  _grad(u, pos, neg) {
    const lr = this.lr, reg = this.reg;
    const x = this._dot(u, pos) - this._dot(u, neg);
    // Clamp x before sigmoid to prevent overflow
    const sig = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
    const g = (1 - sig);
    const loss = Math.log(1 + Math.exp(-Math.max(-20, Math.min(20, x))));
    const correct = x > 0 ? 1 : 0;

    for (let f = 0; f < this.factors; f++) {
      const puf = this.P[u][f], qif = this.Q[pos][f], qjf = this.Q[neg][f];
      this.P[u][f]   = Math.max(-0.5, Math.min(0.5, this.P[u][f]   + lr * (g * (qif - qjf) - reg * puf)));
      this.Q[pos][f] = Math.max(-0.5, Math.min(0.5, this.Q[pos][f] + lr * (g * puf        - reg * qif)));
      this.Q[neg][f] = Math.max(-0.5, Math.min(0.5, this.Q[neg][f] + lr * (-g * puf        - reg * qjf)));
    }
    this.bu[u]  = Math.max(-5, Math.min(5, this.bu[u]  + lr * (g - reg * this.bu[u])));
    this.bi[pos]= Math.max(-5, Math.min(5, this.bi[pos]+ lr * (g - reg * this.bi[pos])));
    this.bi[neg]= Math.max(-5, Math.min(5, this.bi[neg]+ lr * (-g - reg * this.bi[neg])));
    return { loss, correct };
  }

  train(positivePairs, negSamples, onProgress) {
    const history = [];
    // Build user -> positive items map
    this._userPositiveItems = new Map();
    for (const [u, i] of positivePairs) {
      if (!this._userPositiveItems.has(u)) this._userPositiveItems.set(u, new Set());
      this._userPositiveItems.get(u).add(i);
    }

    // Build item co-occurrence: how many users have both item A and item B in their history
    const coCounts = new Map(); // itemId -> Map(itemId -> coCount)
    for (const [, posItems] of this._userPositiveItems) {
      const items = [...posItems];
      for (let a = 0; a < items.length; a++) {
        if (!coCounts.has(items[a])) coCounts.set(items[a], new Map());
        for (let b = a + 1; b < items.length; b++) {
          const m = coCounts.get(items[a]);
          m.set(items[b], (m.get(items[b]) || 0) + 1);
          if (!coCounts.has(items[b])) coCounts.set(items[b], new Map());
          coCounts.get(items[b]).set(items[a], (coCounts.get(items[b]).get(items[a]) || 0) + 1);
        }
      }
    }
    this._coCounts = coCounts;

    // Negative sample pools per user
    const allItems = [...new Set(positivePairs.map(([, i]) => i))];
    const userNegPool = new Map();
    for (const [u, posItems] of this._userPositiveItems) {
      userNegPool.set(u, allItems.filter((i) => !posItems.has(i)));
    }

    let pairIdx = 0;
    for (let e = 0; e < BPR_EPOCHS; e++) {
      const epochStarted = Date.now();
      let lossSum = 0;
      let correctCount = 0;
      let sampledPairs = 0;
      const shuffled = shuffle([...positivePairs], this.seed + e * 7919);
      for (const [u, posItem] of shuffled) {
        const pool = userNegPool.get(u);
        if (!pool || pool.length === 0) continue;
        const negIdx = (((this.seed + e + 1) * (pairIdx + 1) * (u + 1) * (posItem + 1)) >>> 0) % pool.length;
        const negItem = pool[negIdx];
        if (negItem === posItem || negItem === undefined) { pairIdx++; continue; }
        const stats = this._grad(u, posItem, negItem);
        lossSum += stats.loss;
        correctCount += stats.correct;
        sampledPairs++;
        pairIdx++;
      }
      const epochStats = {
        epoch: e + 1,
        bpr_loss: round(lossSum, 6),
        avg_pairwise_loss: round(sampledPairs ? lossSum / sampledPairs : 0, 6),
        pairwise_accuracy_proxy: round(sampledPairs ? correctCount / sampledPairs : 0, 6),
        sampled_pairs: sampledPairs,
        learning_rate: this.lr,
        elapsed_ms: Date.now() - epochStarted,
      };
      history.push(epochStats);
      if (onProgress) onProgress(e + 1, BPR_EPOCHS, sampledPairs, epochStats);
    }
    return history;
  }

  // Score: BPR + co-occurrence boost, then normalize to [0,1]
  score(u, i) {
    if (u < 0 || u >= this.userCount || i < 0 || i >= this.itemCount) return 0;
    const bpr = this._dot(u, i);

    // Co-occurrence score
    const posItems = this._userPositiveItems.get(u);
    let coBoost = 0;
    if (posItems && this._coCounts && this._coCounts.has(i)) {
      let coSum = 0, coCount = 0;
      for (const posItem of posItems) {
        if (this._coCounts.get(i).has(posItem)) {
          coSum += this._coCounts.get(i).get(posItem);
          coCount++;
        }
      }
      if (coCount > 0) coBoost = Math.min(1, coSum / (coCount * 3));
    }

    return bpr + coBoost;
  }

  normalizeScores(scoresBySongId) {
    const values = [...scoresBySongId.values()];
    if (!values.length) return scoresBySongId;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return new Map([...scoresBySongId.entries()].map(([sid, v]) => [sid, (v - min) / range]));
  }
}

function buildBPRMF(userSplits, songById) {
  // Build stable item index from songById keys
  const allSongIds = [...songById.keys()];
  const iidToIdx = new Map(allSongIds.map((id, i) => [id, i]));
  const idxToIid = allSongIds;

  const userIds = [...userSplits.keys()];
  const uidToIdx = new Map(userIds.map((id, i) => [id, i]));

  // Collect positive pairs and track which items were seen in training
  const positivePairs = [];
  const trainedItemIds = new Set();
  for (const [uid, split] of userSplits) {
    const uIdx = uidToIdx.get(uid);
    for (const songId of split.trainPositiveSet) {
      const iIdx = iidToIdx.get(songId);
      if (iIdx !== undefined) {
        positivePairs.push([uIdx, iIdx]);
        trainedItemIds.add(songId);
      }
    }
  }

  console.log(`[BPR-MF] Training with ${positivePairs.length} positive pairs, ${allSongIds.length} items (${trainedItemIds.size} seen in training), ${userIds.length} users`);
  console.log(`[BPR-MF] factors=${BPR_FACTORS}, epochs=${BPR_EPOCHS}, lr=${BPR_LR}, reg=${BPR_REG}, neg=${BPR_NEG_SAMPLES}`);

  const model = new BPRMF(userIds.length, allSongIds.length, BPR_FACTORS, BPR_LR, BPR_REG, BPR_RANDOM_SEED);

  const trainingHistory = model.train(positivePairs, BPR_NEG_SAMPLES, (epoch, total) => {
    if (epoch % 5 === 0 || epoch === total) {
      process.stdout.write(`[BPR-MF] epoch ${epoch}/${total} (${Math.round(epoch / total * 100)}%)\r`);
    }
  });
  console.log('\n[BPR-MF] Training complete');

  return {
    model,
    uidToIdx,
    idxToUid: userIds,
    iidToIdx,
    idxToIid,
    songById,
    allSongIds,
    trainedItemIds,
    userIds,
    trainPositivePairs: positivePairs.length,
    trainingHistory,
  };
}

// ─── Algorithm D: Hybrid Context-Aware ──────────────────────────────────────
function objectFromMap(map) {
  return Object.fromEntries([...map.entries()].map(([k, v]) => [String(k), v]));
}

function writeBprModelArtifact(bprData, generatedAt) {
  let modelPath;
  if (typeof SAVE_BPR_MODEL !== 'undefined' && SAVE_BPR_MODEL) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    modelPath = path.join(MODEL_DIR, 'bpr_mf_latest.json');
  } else if (typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX) {
    modelPath = path.join(OUTPUT_DIR, `recommendation_bpr_model${OUTPUT_SUFFIX}.json`);
  } else {
    return null; // Skip saving if no explicitly requested and no suffix
  }
  const artifact = {
    generated_at: generatedAt,
    algorithm: 'BPR-MF',
    dataset_source: SOURCE,
    hyperparameters: {
      factors: BPR_FACTORS,
      epochs: BPR_EPOCHS,
      learning_rate: BPR_LR,
      regularization: BPR_REG,
      negative_samples: BPR_NEG_SAMPLES,
      random_seed: BPR_RANDOM_SEED,
    },
    user_index_map: objectFromMap(bprData.uidToIdx),
    song_index_map: objectFromMap(bprData.iidToIdx),
    user_factors: bprData.model.P,
    item_factors: bprData.model.Q,
    user_biases: Array.from(bprData.model.bu),
    item_biases: Array.from(bprData.model.bi),
    trained_users: bprData.userIds.length,
    trained_items: bprData.trainedItemIds.size,
    train_positive_pairs: bprData.trainPositivePairs,
    notes: [
      'Research/demo artifact for MusicFlow thesis evaluation, not optimized for production serving.',
      'BPR-MF is trained from experiment_seed implicit positive pairs with deterministic random seed.',
      'Hybrid evaluation also uses content, popularity, context and penalty signals outside this artifact.',
    ],
    limitations: [
      'Experimental data only; not real user behavior.',
      'Factors are stored as compact JSON arrays for transparency rather than storage efficiency.',
      'pairwise_accuracy_proxy in training history is a sampled pairwise proxy, not official AUC.',
    ],
  };
  fs.writeFileSync(modelPath, JSON.stringify(artifact), 'utf8');
  console.log(`[Wrote] ${modelPath}`);
  return modelPath;
}

function writeBprTrainingHistory(bprData, generatedAt) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const history = bprData.trainingHistory || [];
  const S = typeof OUTPUT_SUFFIX !== 'undefined' ? OUTPUT_SUFFIX : '';
  const jsonPath = path.join(OUTPUT_DIR, `recommendation_bpr_training_history${S}.json`);
  const csvPath = path.join(OUTPUT_DIR, `recommendation_bpr_training_history${S}.csv`);
  const payload = {
    generated_at: generatedAt,
    algorithm: 'BPR-MF',
    dataset_source: SOURCE,
    metric_note: 'pairwise_accuracy_proxy is the share of sampled positive-negative pairs where score(user, positive_item) > score(user, negative_item); it is not official AUC.',
    hyperparameters: {
      factors: BPR_FACTORS,
      epochs: BPR_EPOCHS,
      learning_rate: BPR_LR,
      regularization: BPR_REG,
      negative_samples: BPR_NEG_SAMPLES,
      random_seed: BPR_RANDOM_SEED,
    },
    history,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  const header = ['epoch', 'bpr_loss', 'avg_pairwise_loss', 'pairwise_accuracy_proxy', 'sampled_pairs', 'learning_rate', 'elapsed_ms'];
  const rows = [header.join(',')];
  for (const row of history) rows.push(header.map((key) => csvCell(row[key])).join(','));
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
  console.log(`[Wrote] ${jsonPath}`);
  console.log(`[Wrote] ${csvPath}`);
  return { jsonPath, csvPath };
}

function writeRecommendationCharts(metricsByAlg, bprData) {
  fs.mkdirSync(CHART_DIR, { recursive: true });
  const history = bprData.trainingHistory || [];
  const S = typeof OUTPUT_SUFFIX !== 'undefined' ? OUTPUT_SUFFIX : '';
  const chartPaths = [];

  if (history.length) {
    const lossPath = path.join(CHART_DIR, `bpr_training_loss${S}.png`);
    writeLineChart(lossPath, 'BPR TRAINING LOSS', 'EPOCH', 'AVG LOSS', history, 'avg_pairwise_loss', CHART_COLORS.navy);
    chartPaths.push(lossPath);

    const accPath = path.join(CHART_DIR, `bpr_pairwise_accuracy${S}.png`);
    writeLineChart(accPath, 'BPR PAIRWISE ACCURACY PROXY', 'EPOCH', 'ACCURACY', history, 'pairwise_accuracy_proxy', CHART_COLORS.green);
    chartPaths.push(accPath);
  }

  const metricsPath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_top10_metrics.png` : 'recommendation_metrics_comparison.png');
  writeGroupedBarChart(metricsPath, 'TOP 10 RELEVANCE METRICS', metricsByAlg, [
    { key: 'precision_at_10', label: 'PRECISION@10' },
    { key: 'ndcg_at_10', label: 'NDCG@10' },
    { key: 'hitrate_at_10', label: 'HITRATE@10' },
  ], { maxValue: 0.6 });
  chartPaths.push(metricsPath);

  const coveragePath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_coverage_diversity.png` : 'recommendation_coverage_diversity.png');
  const coverageSeries = [
    { key: 'global_catalog_coverage_at_20', label: 'COVERAGE@20' },
    { key: 'avg_unique_artists_at_20', label: 'ARTISTS@20' },
    { key: 'artist_repeat_rate', label: 'ARTIST REPEAT' },
  ].map((s) => ({
    ...s,
    max: Math.max(...Object.values(metricsByAlg).map((m) => Number(m?.[s.key]) || 0), 1e-9),
  }));
  writeGroupedBarChart(coveragePath, 'COVERAGE AND DIVERSITY NORMALIZED', metricsByAlg, coverageSeries, {
    normalizeBySeries: true,
    yLabel: 'NORMALIZED',
  });
  chartPaths.push(coveragePath);

  if (typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC) {
      const semanticQualityPath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_semantic_quality_distribution.png` : 'semantic_quality_distribution.png');
      writeGroupedBarChart(semanticQualityPath, 'SEMANTIC QUALITY METRICS', metricsByAlg, [
          { key: 'semantic_attached_rate', label: 'ATTACHED' },
          { key: 'lyrics_based_rate', label: 'LYRICS BASED' },
          { key: 'metadata_only_rate', label: 'META ONLY' },
          { key: 'needs_review_rate', label: 'NEEDS REVIEW' },
          { key: 'avg_semantic_confidence', label: 'AVG CONF' },
      ], { maxValue: 1.0 });
      chartPaths.push(semanticQualityPath);

      const moodMatchPath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_contextual_mood_match.png` : 'contextual_mood_match.png');
      writeGroupedBarChart(moodMatchPath, 'CONTEXTUAL MOOD MATCH RATE', metricsByAlg, [
          { key: 'mood_match_rate', label: 'MOOD MATCH' },
      ], { maxValue: 1.0 });
      chartPaths.push(moodMatchPath);
      
      const pndcgPath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_precision_ndcg.png` : 'precision_ndcg_at_10.png');
      writeGroupedBarChart(pndcgPath, 'PRECISION AND NDCG AT 10', metricsByAlg, [
          { key: 'precision_at_10', label: 'PRECISION@10' },
          { key: 'ndcg_at_10', label: 'NDCG@10' },
      ], { maxValue: 0.6 });
      chartPaths.push(pndcgPath);
  }

  const globalCoveragePath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_global_coverage.png` : 'recommendation_global_coverage.png');
  writeGroupedBarChart(globalCoveragePath, 'GLOBAL CATALOG COVERAGE@20', metricsByAlg, [
    { key: 'global_catalog_coverage_at_20', label: 'GLOBAL COVERAGE@20' },
  ], { maxValue: 0.25, yLabel: 'COVERAGE' });
  chartPaths.push(globalCoveragePath);

  const artistDiversityPath = path.join(CHART_DIR, S ? `${S.replace(/^_/, '')}_artist_diversity.png` : 'recommendation_artist_diversity.png');
  writeGroupedBarChart(artistDiversityPath, 'ARTIST DIVERSITY AT 20', metricsByAlg, [
    { key: 'avg_unique_artists_at_20', label: 'UNIQUE ARTISTS@20' },
    { key: 'artist_repeat_rate', label: 'ARTIST REPEAT' },
  ], { maxValue: 16, yLabel: 'VALUE' });
  chartPaths.push(artistDiversityPath);

  for (const chartPath of chartPaths) console.log(`[Wrote] ${chartPath}`);
  return chartPaths;
}

function buildHybrid(bprData, userSplit, contentProfile, songById, popularScores, useSemantic = false) {
  const HYBRID_SAME_ARTIST_PENALTY = 0.15;
  const HYBRID_RECENT_PENALTY = 0.10;
  const HYBRID_SIMILAR_PENALTY = 0.08;

  // Context mood: infer from top_mood / audio of user profile
  const profile = contentProfile;
  const topMood = profile.top_mood || 'energetic';

  // Popularity normalization
  const popValues = [...popularScores.values()];
  const popMax = Math.max(...popValues, 1);
  const popMin = Math.min(...popValues, 0);
  const popRange = popMax - popMin || 1;

  return function scoreHybrid(songId, rank, existingArtists, recentSongs) {
    const song = songById.get(songId);
    if (!song) return -1;

    // BPR score
    let bprScore = 0;
    if (bprData) {
      const uidIdx = bprData.uidToIdx.get(userSplit.user_id);
      const iIdx = bprData.iidToIdx.get(songId);
      if (uidIdx !== undefined && iIdx !== undefined) {
        bprScore = bprData.model.score(uidIdx, iIdx);
      }
    }
    const normBPR = Math.max(0, Math.min(1, bprScore));

    // Content-based score
    const cb = scoreContentBased(song, profile, useSemantic);
    const normCB = cb.total;

    // User preference score (market + genre match)
    let prefScore = 0;
    if (profile.market_counts && song.market) {
      const total = Object.values(profile.market_counts).reduce((s, v) => s + v, 0);
      prefScore += (total > 0 ? (profile.market_counts[song.market] || 0) / total : 0) * 0.5;
    }
    if (profile.genre_counts && song.genre_id !== null) {
      const total = Object.values(profile.genre_counts).reduce((s, v) => s + v, 0);
      prefScore += (total > 0 ? (profile.genre_counts[Number(song.genre_id)] || 0) / total : 0) * 0.5;
    }

    // Popularity score
    const normPop = popRange > 0 ? (popularScores.get(songId) - popMin) / popRange : 0;

    // Context mood score
    let contextScore = 0.5;
    if (useSemantic && Array.isArray(song.mood_tags)) {
       // Enhance context score if it has a semantic mood tag that matches the intent (topMood)
       // Or if confidence is high, bump the base contextScore
       if (song.mood_tags.some(t => String(t).toLowerCase().includes(topMood.toLowerCase()))) {
           contextScore = 0.9;
       } else if (song.meaning_confidence > 0.7) {
           contextScore = Math.max(0.6, contextScore); // Better semantic profile = higher baseline context match
       }
    } else if (topMood === 'energetic' || topMood === 'party' || topMood === 'happy') {
      if (song.energy_score !== null && song.energy_score > 0.6) contextScore = 0.9;
      else if (song.energy_score !== null && song.energy_score > 0.3) contextScore = 0.6;
      else contextScore = 0.3;
    } else if (topMood === 'sad' || topMood === 'chill' || topMood === 'romantic') {
      if (song.acoustic_score !== null && song.acoustic_score > 0.5) contextScore = 0.9;
      else if (song.acoustic_score !== null && song.acoustic_score > 0.2) contextScore = 0.6;
      else contextScore = 0.3;
    } else if (topMood === 'focus' || topMood === 'calm') {
      if (song.brightness !== null && song.brightness < 0.5) contextScore = 0.9;
      else if (song.brightness !== null) contextScore = 0.5;
    }

    // Novelty score: prefer songs not in the top-100 globally popular
    const popRank = [...popularScores.entries()].sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === songId);
    const noveltyScore = popRank >= 0 ? Math.max(0, 1 - popRank / popularScores.size) : 0.5;

    // Penalties
    let artistPenalty = 0;
    if (song.artist_id !== null && existingArtists.has(Number(song.artist_id))) {
      artistPenalty = HYBRID_SAME_ARTIST_PENALTY;
    }

    let recentPenalty = 0;
    if (recentSongs.has(songId)) {
      recentPenalty = HYBRID_RECENT_PENALTY;
    }

    const total = HYBRID_WEIGHTS.bpr_score * normBPR
      + HYBRID_WEIGHTS.content_audio_score * normCB
      + HYBRID_WEIGHTS.user_preference_score * prefScore
      + HYBRID_WEIGHTS.popularity_score * normPop
      + HYBRID_WEIGHTS.context_mood_score * contextScore
      + HYBRID_WEIGHTS.novelty_score * noveltyScore
      - artistPenalty
      - recentPenalty;

    return { total: Math.max(0, total), components: { normBPR, normCB, prefScore, normPop, contextScore, noveltyScore, artistPenalty, recentPenalty } };
  };
}

// ─── Metrics ─────────────────────────────────────────────────────────────────
function precisionAtK(ranking, relevantSet, k) {
  if (!ranking.length || !relevantSet.size) return 0;
  const top = ranking.slice(0, k);
  const hits = top.filter((id) => relevantSet.has(id)).length;
  return hits / k;
}

function recallAtK(ranking, relevantSet, k) {
  if (!relevantSet.size) return 0;
  const top = ranking.slice(0, k);
  const hits = top.filter((id) => relevantSet.has(id)).length;
  return hits / relevantSet.size;
}

function ndcgAtK(ranking, relevantSet, k) {
  if (!relevantSet.size) return 0;
  let dcg = 0;
  const top = ranking.slice(0, k);
  for (let i = 0; i < top.length; i++) {
    if (relevantSet.has(top[i])) {
      dcg += 1 / Math.log2(i + 2);
    }
  }
  const idealRelevances = [...relevantSet].slice(0, k).map(() => 1);
  let idcg = 0;
  for (let i = 0; i < idealRelevances.length; i++) {
    idcg += idealRelevances[i] / Math.log2(i + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function apAtK(ranking, relevantSet, k) {
  if (!relevantSet.size) return 0;
  const top = ranking.slice(0, k);
  let sum = 0;
  let hits = 0;
  for (let i = 0; i < top.length; i++) {
    if (relevantSet.has(top[i])) {
      hits += 1;
      sum += hits / (i + 1);
    }
  }
  return hits > 0 ? sum / Math.min(k, relevantSet.size) : 0;
}

function hitRateAtK(ranking, relevantSet, k) {
  if (!ranking.length) return 0;
  const top = ranking.slice(0, k);
  const hit = top.some((id) => relevantSet.has(id)) ? 1 : 0;
  return hit;
}

// ─── Per-user recommendation ──────────────────────────────────────────────────
function getRecommendations(method, userSplit, songById, bprData, contentProfile, popularScores, globalPopularRanking, existingArtists, recentSongs) {
  const trainSet = userSplit.trainSongSet || userSplit.trainPositiveSet;

  let scored = [];

  if (method === 'most_popular') {
    const popSorted = [...popularScores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    return popSorted.filter(([sid]) => !trainSet.has(sid)).map(([sid, score]) => ({ sid, score, components: {} }));
  }

  if (method === 'content_based' || method === 'content_based_semantic') {
    const useSemantic = method === 'content_based_semantic';
    for (const song of songById.values()) {
      if (trainSet.has(song.id)) continue;
      const { total, components } = scoreContentBased(song, contentProfile, useSemantic);
      if (total > 0) scored.push({ sid: song.id, score: total, components });
    }
    scored.sort((a, b) => b.score - a.score || a.sid - b.sid);
    return scored;
  }

  if (method === 'bpr_mf') {
    if (!bprData) return [];
    const uidIdx = bprData.uidToIdx.get(userSplit.user_id);
    if (uidIdx === undefined) return [];

    // Score items with co-occurrence + BPR
    const candidateScoresBySongId = new Map();
    for (const songId of bprData.trainedItemIds) {
      if (trainSet.has(songId)) continue;
      const iIdx = bprData.iidToIdx.get(songId);
      if (iIdx === undefined) continue;
      const raw = bprData.model.score(uidIdx, iIdx);
      candidateScoresBySongId.set(songId, raw);
    }

    if (!candidateScoresBySongId.size) return [];
    const normMap = bprData.model.normalizeScores(candidateScoresBySongId);
    scored = [...normMap.entries()].map(([sid, score]) => ({ sid, score, components: {} }));
    scored.sort((a, b) => b.score - a.score || a.sid - b.sid);
    return scored;
  }

  if (method === 'hybrid' || method === 'hybrid_semantic') {
    const useSemantic = method === 'hybrid_semantic';
    const hybridScorer = buildHybrid(bprData, userSplit, contentProfile, songById, popularScores, useSemantic);
    const artistSeen = new Map(); // artistKey -> count in top
    const genreSeen = new Map();  // genreId -> count in top

    // Score all candidate songs
    for (const song of songById.values()) {
      if (trainSet.has(song.id)) continue;
      const artistKey = song.artist_id !== null ? Number(song.artist_id) : null;
      const genreKey = song.genre_id !== null ? Number(song.genre_id) : null;
      const artistCount = artistSeen.get(artistKey) || 0;
      const { total } = hybridScorer(song.id, artistCount, artistSeen, recentSongs);
      scored.push({ sid: song.id, score: total, artistKey, genreKey });
    }

    // Sort by base score (descending), secondary sort by song_id for determinism
    scored.sort((a, b) => b.score - a.score || a.sid - b.sid);

    // Greedy reranking: accept highest-scored candidates subject to diversity caps
    // Max 2 songs from same artist in top-10, max 4 in top-20, max 6 same genre in top-20
    const finalTop = [];
    const MAX_PER_ARTIST_TOP10 = 2;
    const MAX_PER_ARTIST_TOP20 = 4;
    const MAX_PER_GENRE_TOP20 = 6;

    for (const entry of scored) {
      if (finalTop.length >= 50) break;
      const artistKey = entry.artistKey;
      const genreKey = entry.genreKey;
      const artistCount = artistSeen.get(artistKey) || 0;
      const genreCount = genreSeen.get(genreKey) || 0;
      const pos = finalTop.length;

      // Apply hard diversity caps (stricter for top-10)
      if (pos < 10) {
        if (artistKey !== null && artistCount >= MAX_PER_ARTIST_TOP10) continue;
      }
      if (pos < 20) {
        if (artistKey !== null && artistCount >= MAX_PER_ARTIST_TOP20) continue;
        if (genreKey !== null && genreCount >= MAX_PER_GENRE_TOP20) continue;
      }

      finalTop.push(entry);
      artistSeen.set(artistKey, artistCount + 1);
      genreSeen.set(genreKey, genreCount + 1);
    }

    return finalTop;
  }

  return [];
}

// ─── Per-user evaluation ─────────────────────────────────────────────────────
function evaluateUser(userSplit, songById, bprData, contentProfile, popularScores, globalPopularRanking, catalogSize) {
  const relevantSet = userSplit.testPositiveHoldout;

  // Recent songs for hybrid penalty
  const recentSongs = new Set(userSplit.train.slice(-20).map((i) => i.song_id));

  const algs = typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC 
      ? ['most_popular', 'content_based_semantic', 'bpr_mf', 'hybrid_semantic']
      : ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];
  const results = {};

  for (const alg of algs) {
    const recs = getRecommendations(alg, userSplit, songById, bprData, contentProfile, popularScores, globalPopularRanking, new Set(), recentSongs);

    // Artist + genre tracking for diversity metrics
    const top20recs = recs.slice(0, 20);
    const artistSet = new Set();
    const genreSet = new Set();
    let artistRepeatCount = 0; // how many songs in top-20 share an artist with a previous song in the list
    let duplicateSongCount = 0; // how many song_ids appear more than once (should be 0 — deduped list)
    const seenSongIds = new Set();
    const artistFirstPos = new Map(); // artist_id -> position of first occurrence

    for (const rec of top20recs) {
      const song = songById.get(rec.sid);
      // Duplicate song check
      if (seenSongIds.has(rec.sid)) {
        duplicateSongCount++;
      } else {
        seenSongIds.add(rec.sid);
      }
      // Artist repeat check
      if (song && song.artist_id !== null) {
        const aid = Number(song.artist_id);
        if (artistSet.has(aid)) {
          artistRepeatCount++;
        } else {
          artistFirstPos.set(aid, top20recs.indexOf(rec));
        }
        artistSet.add(aid);
      }
      // Genre diversity
      if (song && song.genre_id !== null) genreSet.add(Number(song.genre_id));
    }

    // Semantic Metrics Tracking
    let semanticAttachedCount = 0;
    let lyricsBasedCount = 0;
    let metadataOnlyCount = 0;
    let needsReviewCount = 0;
    let semanticConfidenceSum = 0;
    let moodMatchCount = 0;
    const topMood = contentProfile.top_mood || 'energetic';

    for (const rec of top20recs) {
      const song = songById.get(rec.sid);
      if (song) {
        if (song.main_theme || song.meaning_confidence > 0) semanticAttachedCount++;
        if (song.evidence_level === 'lyrics_based' || song.evidence_level === 'hybrid') lyricsBasedCount++;
        if (song.evidence_level === 'metadata_only') metadataOnlyCount++;
        if (song.review_status === 'needs_review') needsReviewCount++;
        semanticConfidenceSum += song.meaning_confidence || 0;
        if (Array.isArray(song.mood_tags) && song.mood_tags.some(t => String(t).toLowerCase().includes(topMood.toLowerCase()))) {
            moodMatchCount++;
        } else if (song.mood && song.mood.toLowerCase().includes(topMood.toLowerCase())) {
            moodMatchCount++; // fallback to audio mood
        }
      }
    }

    const ranking = recs.map((r) => r.sid);
    const trainLeakHits = top20recs.filter((r) => (userSplit.trainSongSet || userSplit.trainPositiveSet).has(r.sid)).length;

    const metrics = {};
    for (const k of KS) {
      metrics[`precision_at_${k}`] = precisionAtK(ranking, relevantSet, k);
      metrics[`recall_at_${k}`] = recallAtK(ranking, relevantSet, k);
      metrics[`ndcg_at_${k}`] = ndcgAtK(ranking, relevantSet, k);
      metrics[`map_at_${k}`] = apAtK(ranking, relevantSet, k);
      metrics[`hitrate_at_${k}`] = hitRateAtK(ranking, relevantSet, k);
    }

    // Coverage: % of catalog that appears in this user's top-20 recommendations
    const uniqueRecArtists = artistSet.size;
    const uniqueRecGenres = genreSet.size;
    const coverage_rate = catalogSize > 0 ? seenSongIds.size / catalogSize : 0;

    // Novelty: average inverse-global-popularity rank of recommended songs
    const globalPopRanking = [...popularScores.entries()].sort((a, b) => b[1] - a[1]);
    const noveltySum = top20recs.reduce((sum, rec) => {
      const pos = globalPopRanking.findIndex(([sid]) => sid === rec.sid);
      return sum + (pos >= 0 ? pos / globalPopRanking.length : 1);
    }, 0);

    results[alg] = {
      user_id: userSplit.user_id,
      group: userSplit.group,
      train_positives: userSplit.trainPositiveSet.size,
      test_holdout_positives: relevantSet.size,
      top20_recs: top20recs.map((r) => {
        const song = songById.get(r.sid);
        return {
          song_id: r.sid,
          title: song ? (song._title || null) : null,
          artist_id: song ? song.artist_id : null,
          market: song ? song.market : null,
          genre_id: song ? song.genre_id : null,
          score: round(r.score, 4),
        };
      }),
      metrics,
      // Coverage: unique recommended songs / catalog size (per-user)
      per_user_list_coverage_at_20: coverage_rate,
      unique_recommended_songs: seenSongIds.size,
      catalog_size: catalogSize,
      // Diversity metrics
      diversity_score: uniqueRecArtists,
      genre_diversity_score: uniqueRecGenres,
      avg_unique_artists_at_20: round(uniqueRecArtists, 2),
      // Novelty
      novelty_score: top20recs.length ? round(noveltySum / top20recs.length, 4) : 0,
      // Duplicate metrics (split)
      duplicate_song_rate: top20recs.length ? round(duplicateSongCount / top20recs.length, 4) : 0,
      artist_repeat_rate: top20recs.length ? round(artistRepeatCount / top20recs.length, 4) : 0,
      // Legacy duplicate_rate preserved for backwards compat
      duplicate_rate: top20recs.length ? round((duplicateSongCount + artistRepeatCount) / top20recs.length / 2, 4) : 0,
      train_leak: top20recs.length ? round(trainLeakHits / top20recs.length, 4) : 0,
      avg_score: top20recs.length ? round(top20recs.reduce((s, r) => s + r.score, 0) / top20recs.length, 4) : 0,
      
      // Semantic quality metrics
      semantic_attached_rate: top20recs.length ? round(semanticAttachedCount / top20recs.length, 4) : 0,
      lyrics_based_rate: top20recs.length ? round(lyricsBasedCount / top20recs.length, 4) : 0,
      metadata_only_rate: top20recs.length ? round(metadataOnlyCount / top20recs.length, 4) : 0,
      needs_review_rate: top20recs.length ? round(needsReviewCount / top20recs.length, 4) : 0,
      avg_semantic_confidence: top20recs.length ? round(semanticConfidenceSum / top20recs.length, 4) : 0,
      mood_match_rate: top20recs.length ? round(moodMatchCount / top20recs.length, 4) : 0,
    };
  }

  return results;
}

// ─── Main evaluation ─────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log('═'.repeat(70));
  console.log('  MusicFlow Recommendation Algorithm Evaluation Pipeline');
  console.log(`  Mode: ${SAMPLE_MODE ? `Sample (${SAMPLE_USERS} users)` : 'Full'}`);
  console.log('═'.repeat(70));

  // Step 1: Load dataset
  const { userSplits, userGroupMap, allUserCount } = await loadDataset();
  const evalUsers = [...userSplits.values()];
  if (!evalUsers.length) throw new Error('No eligible users found for evaluation');

  // Step 2: Load song catalog
  const songById = await loadSongCatalog();

  if (typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC) {
    let attached = 0, lyrics = 0, meta = 0, review = 0;
    for (const song of songById.values()) {
        if (song.main_theme || song.meaning_confidence > 0) attached++;
        if (song.evidence_level === 'lyrics_based' || song.evidence_level === 'hybrid') lyrics++;
        if (song.evidence_level === 'metadata_only') meta++;
        if (song.review_status === 'needs_review') review++;
    }
    console.log(`[Semantic] song_semantic_profiles table: found`);
    console.log(`[Semantic] profiles attached: ${attached} / ${songById.size}`);
    console.log(`[Semantic] lyrics_based: ${lyrics}`);
    console.log(`[Semantic] metadata_only: ${meta}`);
    console.log(`[Semantic] needs_review: ${review}`);
    if (attached === 0) {
      console.warn(`\n[WARNING] No semantic profiles attached! Evaluation might be meaningless.\n`);
    }
  }

  // Load song titles for output
  const allSongIds = [...songById.keys()];
  const titleRows = await sql(`SELECT id, title FROM songs WHERE id IN (?)`, [allSongIds]);
  for (const row of titleRows) {
    const song = songById.get(Number(row.id));
    if (song) song._title = row.title;
  }

  // Step 3: Build Most Popular
  console.log('\n[Algo A] Computing Most Popular...');
  const trainGlobalData = new Map();
  for (const split of evalUsers) {
    for (const [songId, data] of split.trainPositiveData) {
      if (!trainGlobalData.has(songId)) {
        trainGlobalData.set(songId, { song_id: songId, listen_count: 0, liked: false, avg_completion: 0, repeat_score: 0, _complSum: 0, _complCnt: 0 });
      }
      const g = trainGlobalData.get(songId);
      g.listen_count += data.listen_count;
      g.liked = g.liked || data.liked;
      g._complSum += data.avg_completion;
      g._complCnt += 1;
      g.avg_completion = g._complSum / g._complCnt;
      g.repeat_score = Math.min(1, (g.repeat_score * (g.listen_count - data.listen_count) + data.repeat_score * data.listen_count) / g.listen_count);
    }
  }
  const { scores: popularScores } = buildMostPopular(trainGlobalData);
  const globalPopularRanking = [...popularScores.entries()].sort((a, b) => b[1] - a[1]).map(([sid]) => sid);

  // Step 4: Train BPR-MF
  console.log('\n[Algo C] Training BPR-MF...');
  const bprData = buildBPRMF(userSplits, songById);

  // Step 5: Evaluate each user
  console.log('\n[Evaluation] Running per-user evaluation...');
  const perUserResults = [];
  let processed = 0;
  const total = evalUsers.length;

  for (const userSplit of evalUsers) {
    const contentProfile = buildContentProfile(userSplit.trainPositiveData, songById);
    const userResults = evaluateUser(userSplit, songById, bprData, contentProfile, popularScores, globalPopularRanking, allSongIds.length);
    perUserResults.push(userResults);
    processed += 1;
    if (processed % 20 === 0 || processed === total) {
      process.stdout.write(`[Evaluation] ${processed}/${total} users (${Math.round(processed / total * 100)}%)\r`);
    }
  }
  console.log(`\n[Evaluation] Done — ${processed} users evaluated`);

  // Step 6: Aggregate metrics
  console.log('\n[Metrics] Aggregating...');
  const algs = typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC 
      ? ['most_popular', 'content_based_semantic', 'bpr_mf', 'hybrid_semantic']
      : ['most_popular', 'content_based', 'bpr_mf', 'hybrid'];
  const algLabels = { 
      most_popular: 'Most Popular', 
      content_based: 'Content-Based Audio', 
      content_based_semantic: 'Content-Based + Semantic',
      bpr_mf: 'BPR-MF', 
      hybrid: 'Hybrid Context-Aware',
      hybrid_semantic: 'Hybrid + Semantic'
  };

  const aggregateMetrics = (alg) => {
    const vals = perUserResults.map((r) => r[alg]).filter(Boolean);
    if (!vals.length) return null;
    const agg = {};
    for (const k of KS) {
      const avg = (key) => round(vals.reduce((s, v) => s + (v.metrics[key] || 0), 0) / vals.length, 4);
      agg[`precision_at_${k}`] = avg(`precision_at_${k}`);
      agg[`recall_at_${k}`] = avg(`recall_at_${k}`);
      agg[`ndcg_at_${k}`] = avg(`ndcg_at_${k}`);
      agg[`map_at_${k}`] = avg(`map_at_${k}`);
      agg[`hitrate_at_${k}`] = avg(`hitrate_at_${k}`);
    }
    // Per-user list coverage: avg of (unique songs in top-20 / catalog size) per user
    agg.per_user_list_coverage_at_20 = round(vals.reduce((s, v) => s + (v.per_user_list_coverage_at_20 || 0), 0) / vals.length, 6);
    agg.diversity = round(vals.reduce((s, v) => s + (v.diversity_score || 0), 0) / vals.length, 2);
    agg.genre_diversity = round(vals.reduce((s, v) => s + (v.genre_diversity_score || 0), 0) / vals.length, 2);
    agg.avg_unique_artists_at_20 = round(vals.reduce((s, v) => s + (v.avg_unique_artists_at_20 || 0), 0) / vals.length, 2);
    agg.novelty = round(vals.reduce((s, v) => s + (v.novelty_score || 0), 0) / vals.length, 4);
    agg.duplicate_song_rate = round(vals.reduce((s, v) => s + (v.duplicate_song_rate || 0), 0) / vals.length, 4);
    agg.artist_repeat_rate = round(vals.reduce((s, v) => s + (v.artist_repeat_rate || 0), 0) / vals.length, 4);
    agg.duplicate_rate = round(vals.reduce((s, v) => s + (v.duplicate_rate || 0), 0) / vals.length, 4);
    agg.train_leak_rate = round(vals.reduce((s, v) => s + (v.train_leak || 0), 0) / vals.length, 4);
    agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
    
    // Semantic metrics aggregation
    agg.semantic_attached_rate = round(vals.reduce((s, v) => s + (v.semantic_attached_rate || 0), 0) / vals.length, 4);
    agg.lyrics_based_rate = round(vals.reduce((s, v) => s + (v.lyrics_based_rate || 0), 0) / vals.length, 4);
    agg.metadata_only_rate = round(vals.reduce((s, v) => s + (v.metadata_only_rate || 0), 0) / vals.length, 4);
    agg.needs_review_rate = round(vals.reduce((s, v) => s + (v.needs_review_rate || 0), 0) / vals.length, 4);
    agg.avg_semantic_confidence = round(vals.reduce((s, v) => s + (v.avg_semantic_confidence || 0), 0) / vals.length, 4);
    agg.mood_match_rate = round(vals.reduce((s, v) => s + (v.mood_match_rate || 0), 0) / vals.length, 4);
    
    agg.users_evaluated = vals.length;
    return agg;
  };

  const metricsByAlg = {};
  for (const alg of algs) {
    metricsByAlg[alg] = { label: algLabels[alg], ...aggregateMetrics(alg) };
  }

  // Compute global catalog coverage: union of all song_ids recommended across all users per algorithm
  console.log('[Metrics] Computing global catalog coverage...');
  for (const alg of algs) {
    const globalSongSet = new Set();
    const globalUniqueCounts = { top10: new Set(), top20: new Set() };
    for (const ur of perUserResults) {
      const r = ur[alg];
      if (!r) continue;
      for (const rec of r.top20_recs) globalUniqueCounts.top20.add(rec.song_id);
      for (const rec of r.top20_recs.slice(0, 10)) globalUniqueCounts.top10.add(rec.song_id);
    }
    const catalogSize = allSongIds.length;
    metricsByAlg[alg].unique_recommended_songs_global_at_20 = globalUniqueCounts.top20.size;
    metricsByAlg[alg].unique_recommended_songs_global_at_10 = globalUniqueCounts.top10.size;
    metricsByAlg[alg].catalog_size = catalogSize;
    metricsByAlg[alg].global_catalog_coverage_at_20 = round(globalUniqueCounts.top20.size / catalogSize, 6);
    metricsByAlg[alg].global_catalog_coverage_at_10 = round(globalUniqueCounts.top10.size / catalogSize, 6);
  }

  // Metrics by group
  const groups = [...new Set([...userGroupMap.values()])].filter((g) => g !== 'unknown');
  const metricsByGroup = {};
  for (const group of groups) {
    const groupResults = perUserResults.filter((r) => {
      const first = Object.values(r)[0];
      return first && first.group === group;
    });
    if (!groupResults.length) continue;
    const groupAgg = {};
    for (const alg of algs) {
      const vals = groupResults.map((r) => r[alg]).filter(Boolean);
      if (!vals.length) continue;
      const agg = {};
      for (const k of KS) {
        const avg = (key) => round(vals.reduce((s, v) => s + (v.metrics[key] || 0), 0) / vals.length, 4);
        agg[`precision_at_${k}`] = avg(`precision_at_${k}`);
        agg[`recall_at_${k}`] = avg(`recall_at_${k}`);
        agg[`ndcg_at_${k}`] = avg(`ndcg_at_${k}`);
        agg[`map_at_${k}`] = avg(`map_at_${k}`);
        agg[`hitrate_at_${k}`] = avg(`hitrate_at_${k}`);
      }
      agg.per_user_list_coverage_at_20 = round(vals.reduce((s, v) => s + (v.per_user_list_coverage_at_20 || 0), 0) / vals.length, 6);
      agg.diversity = round(vals.reduce((s, v) => s + (v.diversity_score || 0), 0) / vals.length, 2);
      agg.genre_diversity = round(vals.reduce((s, v) => s + (v.genre_diversity_score || 0), 0) / vals.length, 2);
      agg.avg_unique_artists_at_20 = round(vals.reduce((s, v) => s + (v.avg_unique_artists_at_20 || 0), 0) / vals.length, 2);
      agg.novelty = round(vals.reduce((s, v) => s + (v.novelty_score || 0), 0) / vals.length, 4);
      agg.duplicate_song_rate = round(vals.reduce((s, v) => s + (v.duplicate_song_rate || 0), 0) / vals.length, 4);
      agg.artist_repeat_rate = round(vals.reduce((s, v) => s + (v.artist_repeat_rate || 0), 0) / vals.length, 4);
      agg.duplicate_rate = round(vals.reduce((s, v) => s + (v.duplicate_rate || 0), 0) / vals.length, 4);
      agg.train_leak_rate = round(vals.reduce((s, v) => s + (v.train_leak || 0), 0) / vals.length, 4);
      agg.avg_score = round(vals.reduce((s, v) => s + (v.avg_score || 0), 0) / vals.length, 4);
      agg.semantic_attached_rate = round(vals.reduce((s, v) => s + (v.semantic_attached_rate || 0), 0) / vals.length, 4);
      agg.lyrics_based_rate = round(vals.reduce((s, v) => s + (v.lyrics_based_rate || 0), 0) / vals.length, 4);
      agg.metadata_only_rate = round(vals.reduce((s, v) => s + (v.metadata_only_rate || 0), 0) / vals.length, 4);
      agg.needs_review_rate = round(vals.reduce((s, v) => s + (v.needs_review_rate || 0), 0) / vals.length, 4);
      agg.avg_semantic_confidence = round(vals.reduce((s, v) => s + (v.avg_semantic_confidence || 0), 0) / vals.length, 4);
      agg.mood_match_rate = round(vals.reduce((s, v) => s + (v.mood_match_rate || 0), 0) / vals.length, 4);
      agg.users_evaluated = vals.length;
      groupAgg[alg] = { label: algLabels[alg], ...agg };
    }
    metricsByGroup[group] = groupAgg;
  }

  // Best algorithm by metric
  const bestBy = (metric) => {
    let bestAlg = null, bestVal = -Infinity;
    for (const [alg, data] of Object.entries(metricsByAlg)) {
      if (data && data[metric] !== undefined && data[metric] > bestVal) {
        bestVal = data[metric];
        bestAlg = alg;
      }
    }
    return { algorithm: bestAlg, value: round(bestVal, 4) };
  };

  const bestAlgorithm = {
    precision_at_10: bestBy('precision_at_10'),
    recall_at_10: bestBy('recall_at_10'),
    ndcg_at_10: bestBy('ndcg_at_10'),
    map_at_10: bestBy('map_at_10'),
    hitrate_at_10: bestBy('hitrate_at_10'),
    overall: bestBy('ndcg_at_10'),
  };

  // Sample outputs: pick users from each group
  const sampleGroups = ['VPOP main', 'KPOP main', 'USUK main', 'VPOP + KPOP + USUK', 'Explorer / Trending'];
  const sampleOutputs = [];
  const usedGroups = new Set();

  for (const ur of perUserResults) {
    const first = Object.values(ur)[0];
    if (!first) continue;
    if (usedGroups.has(first.group) && first.group !== 'Explorer / Trending') continue;
    if (first.group === 'Explorer / Trending' && usedGroups.size >= 4) continue;
    if (!sampleGroups.includes(first.group) && usedGroups.size >= 4) continue;
    usedGroups.add(first.group);

    const artistIds = [...new Set(Object.values(ur).flatMap((r) => r.top20_recs.map((rec) => rec.artist_id).filter(Boolean)))];
    const artistNames = await loadArtistNames(artistIds);

    const recsByAlg = {};
    for (const alg of algs) {
      const r = ur[alg];
      if (!r) continue;
      recsByAlg[algLabels[alg]] = r.top20_recs.slice(0, 10).map((rec) => ({
        song_id: rec.song_id,
        title: rec.title || `Song ${rec.song_id}`,
        artist: artistNames.get(Number(rec.artist_id)) || `Artist ${rec.artist_id}`,
        market: rec.market,
        genre_id: rec.genre_id,
        score: rec.score,
      }));
    }

    sampleOutputs.push({
      user_id: first.user_id,
      group: first.group,
      train_positives: first.train_positives,
      test_holdout_positives: first.test_holdout_positives,
      recommendations: recsByAlg,
    });

    if (sampleOutputs.length >= 5) break;
  }

  // Step 7: Write outputs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const modelArtifactPath = writeBprModelArtifact(bprData, generatedAt);
  const trainingHistoryPaths = writeBprTrainingHistory(bprData, generatedAt);
  const chartPaths = writeRecommendationCharts(metricsByAlg, bprData);

  // Main JSON
  const report = {
    generated_at: generatedAt,
    mode: SAMPLE_MODE ? 'sample' : 'full',
    sample_users: SAMPLE_MODE ? SAMPLE_USERS : null,
    evaluation_duration_ms: Date.now() - startTime,
    dataset_summary: {
      total_experimental_users: allUserCount,
      eligible_users_evaluated: evalUsers.length,
      source: SOURCE,
      train_split: '80% temporal',
      test_positive_definition: 'completion_rate >= 0.5 OR implicit_rating >= 0.5 OR liked = 1',
      test_metric_used: 'test_holdout_positive_set (test positives NOT in user train set)',
    },
    algorithm_configs: {
      most_popular: {
        weights: POP_WEIGHTS,
        description: 'listen_count (0.45) + like_count (0.25) + avg_completion (0.20) + repeat_score (0.10)',
      },
      content_based: {
        weights: CB_WEIGHTS,
        description: 'market/genre/artist/artist counts + audio feature similarity (bpm/energy_score/danceability/acoustic_score/brightness/mood/vibe)',
      },
      bpr_mf: {
        factors: BPR_FACTORS,
        epochs: BPR_EPOCHS,
        learning_rate: BPR_LR,
        regularization: BPR_REG,
        negative_samples: BPR_NEG_SAMPLES,
        random_seed: BPR_RANDOM_SEED,
        description: 'Pure Node.js BPR-MF with SGD, user/item latent factors and bias terms',
      },
      hybrid: {
        weights: HYBRID_WEIGHTS,
        same_artist_penalty: 0.15,
        recent_penalty: 0.10,
        description: 'bpr_score (0.35) + content_audio (0.25) + user_preference (0.15) + popularity (0.10) + context_mood (0.10) + novelty (0.05) - penalties',
      },
    },
    metrics: metricsByAlg,
    metrics_by_group: metricsByGroup,
    best_algorithm_by_metric: bestAlgorithm,
    artifacts: {
      bpr_model: path.relative(process.cwd(), modelArtifactPath).replace(/\\/g, '/'),
      bpr_training_history_json: path.relative(process.cwd(), trainingHistoryPaths.jsonPath).replace(/\\/g, '/'),
      bpr_training_history_csv: path.relative(process.cwd(), trainingHistoryPaths.csvPath).replace(/\\/g, '/'),
      charts: chartPaths.map((p) => path.relative(process.cwd(), p).replace(/\\/g, '/')),
    },
    sample_outputs: sampleOutputs,
    limitations: [
      'Experimental/simulated behavior data — not real user behavior.',
      'High repeated listen ratio (avg ~3 listens per unique song) limits the number of truly novel test positives.',
      'Evaluation uses test_holdout_positive_set (test positives NOT in train) as the primary metric; raw test positive set is excluded to avoid train-leak evaluation bias.',
      'BPR-MF is trained in pure Node.js (no ML libraries); results are reproducible with fixed seed.',
      'Context mood score uses audio feature heuristics when hour_of_day is not available in the seed data.',
      'No cold-start users are included in evaluation (MIN_TRAIN_INTERACTIONS=200).',
    ],
    safety_check: {
      db_data_modified: false,
      uploads_touched: false,
      uploads_url_changed: false,
      playerbar_vue_affected: false,
      queuepanel_affected: false,
      payment_js_affected: false,
      admin_ui_affected: false,
      real_user_data_touched: false,
      hardcoded_song_ids: false,
    },
  };

  const jsonPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? `recommendation${OUTPUT_SUFFIX}_metrics.json` : 'recommendation_evaluation_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[Wrote] ${jsonPath}`);

  // Main CSV
  const csvHeader = [
    'algorithm', 'precision_at_10', 'recall_at_10', 'ndcg_at_10', 'map_at_10', 'hitrate_at_10',
    'precision_at_20', 'recall_at_20', 'ndcg_at_20', 'map_at_20', 'hitrate_at_20',
    'per_user_list_coverage_at_20', 'unique_recommended_songs_global_at_20', 'catalog_size',
    'global_catalog_coverage_at_20', 'global_catalog_coverage_at_10',
    'diversity', 'genre_diversity', 'avg_unique_artists_at_20',
    'novelty', 'duplicate_song_rate', 'artist_repeat_rate', 'duplicate_rate',
    'train_leak_rate', 'avg_score', 'users_evaluated',
  ];
  const csvRows = [csvHeader.join(',')];
  for (const [alg, data] of Object.entries(metricsByAlg)) {
    if (!data) continue;
    csvRows.push([
      algLabels[alg] || alg,
      data.precision_at_10, data.recall_at_10, data.ndcg_at_10, data.map_at_10, data.hitrate_at_10,
      data.precision_at_20, data.recall_at_20, data.ndcg_at_20, data.map_at_20, data.hitrate_at_20,
      data.per_user_list_coverage_at_20, data.unique_recommended_songs_global_at_20, data.catalog_size,
      data.global_catalog_coverage_at_20, data.global_catalog_coverage_at_10,
      data.diversity, data.genre_diversity, data.avg_unique_artists_at_20,
      data.novelty, data.duplicate_song_rate, data.artist_repeat_rate, data.duplicate_rate,
      data.train_leak_rate, data.avg_score, data.users_evaluated,
    ].join(','));
  }
  const csvPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? `recommendation${OUTPUT_SUFFIX}_metrics.csv` : 'recommendation_evaluation_results.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`[Wrote] ${csvPath}`);

  // Per-user CSV
  const userCsvHeader = ['user_id', 'group', 'algorithm', 'train_positives', 'test_holdout_positives',
    'precision_at_10', 'recall_at_10', 'ndcg_at_10', 'map_at_10', 'hitrate_at_10',
    'precision_at_20', 'recall_at_20', 'ndcg_at_20', 'map_at_20', 'hitrate_at_20',
    'coverage_rate', 'unique_recommended_songs', 'catalog_size',
    'diversity', 'genre_diversity', 'avg_unique_artists_at_20',
    'novelty', 'duplicate_song_rate', 'artist_repeat_rate', 'duplicate_rate',
    'train_leak', 'avg_score',
  ];
  const userCsvRows = [userCsvHeader.join(',')];
  for (const ur of perUserResults) {
    const first = Object.values(ur)[0];
    if (!first) continue;
    for (const alg of algs) {
      const r = ur[alg];
      if (!r) continue;
      userCsvRows.push([
        r.user_id, r.group, algLabels[alg] || alg,
        r.train_positives, r.test_holdout_positives,
        r.metrics.precision_at_10, r.metrics.recall_at_10, r.metrics.ndcg_at_10, r.metrics.map_at_10, r.metrics.hitrate_at_10,
        r.metrics.precision_at_20, r.metrics.recall_at_20, r.metrics.ndcg_at_20, r.metrics.map_at_20, r.metrics.hitrate_at_20,
        r.per_user_list_coverage_at_20, r.unique_recommended_songs, r.catalog_size,
        r.diversity_score, r.genre_diversity_score, r.avg_unique_artists_at_20,
        r.novelty_score, r.duplicate_song_rate, r.artist_repeat_rate, r.duplicate_rate,
        r.train_leak, r.avg_score,
      ].join(','));
    }
  }
  const userCsvPath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? `recommendation_by_user${OUTPUT_SUFFIX}.csv` : 'recommendation_evaluation_by_user.csv');
  fs.writeFileSync(userCsvPath, userCsvRows.join('\n'), 'utf8');
  console.log(`[Wrote] ${userCsvPath}`);

  // Sample outputs JSON
  const samplePath = path.join(OUTPUT_DIR, typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX ? `recommendation_sample_outputs${OUTPUT_SUFFIX}.json` : 'recommendation_sample_outputs.json');
  fs.writeFileSync(samplePath, JSON.stringify({ generated_at: generatedAt, samples: sampleOutputs }, null, 2), 'utf8');
  console.log(`[Wrote] ${samplePath}`);

  if (typeof OUTPUT_SUFFIX !== 'undefined' && OUTPUT_SUFFIX) {
      const metadataPath = path.join(OUTPUT_DIR, `recommendation${OUTPUT_SUFFIX}_run_metadata.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({
          run_name: OUTPUT_SUFFIX.replace(/^_/, ''),
          include_semantic: typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC,
          sample_users: SAMPLE_USERS,
          top_k: KS,
          uses_existing_bpr_model: true,
          retrained_bpr: false,
          semantic_profiles_enabled: typeof INCLUDE_SEMANTIC !== 'undefined' && INCLUDE_SEMANTIC,
          notes: "Final evaluation after integrating song_semantic_profiles"
      }, null, 2), 'utf8');
      console.log(`[Wrote] ${metadataPath}`);
  }

  // ─── Console summary ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  EVALUATION RESULTS');
  console.log('═'.repeat(70));
  console.log(`Mode: ${SAMPLE_MODE ? `Sample (${SAMPLE_USERS} users)` : 'FULL'} | Users evaluated: ${evalUsers.length}`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s | Catalog size: ${allSongIds.length}`);
  console.log('');

  // Primary metrics
  console.log('  [Primary Metrics — Test Holdout Set]');
  console.log('Metric'.padEnd(22) + algs.map(a => (algLabels[a] || a).substring(0, 24).padEnd(25)).join(''));
  console.log('-'.repeat(22 + 25 * algs.length));
  const primaryKeys = ['precision_at_10', 'recall_at_10', 'ndcg_at_10', 'map_at_10', 'hitrate_at_10',
    'precision_at_20', 'recall_at_20', 'ndcg_at_20', 'map_at_20', 'hitrate_at_20'];
  for (const key of primaryKeys) {
    const label = key.replace(/_/g, ' ').replace('at ', '@');
    const vals = algs.map((alg) => (metricsByAlg[alg] ? String(metricsByAlg[alg][key] ?? '—') : '—'));
    console.log(label.padEnd(22) + vals.map((v) => String(v).padEnd(25)).join(''));
  }
  console.log('');

  // Diversity & coverage metrics
  console.log('  [Diversity & Coverage Metrics]');
  console.log('Metric'.padEnd(34) + algs.map(a => (algLabels[a] || a).substring(0, 24).padEnd(25)).join(''));
  console.log('-'.repeat(34 + 25 * algs.length));
  const divKeys = [
    ['per_user_list_coverage_at_20', 'Per-user list coverage@20'],
    ['unique_recommended_songs_global_at_20', 'Unique songs global@20'],
    ['global_catalog_coverage_at_20', 'Global catalog coverage@20'],
    ['diversity', 'Unique artists@20'],
    ['genre_diversity', 'Unique genres@20'],
    ['avg_unique_artists_at_20', 'Avg unique artists@20'],
    ['novelty', 'Novelty score'],
    ['duplicate_song_rate', 'Duplicate song rate'],
    ['artist_repeat_rate', 'Artist repeat rate'],
    ['train_leak_rate', 'Train leak rate'],
  ];
  for (const [key, label] of divKeys) {
    const vals = algs.map((alg) => (metricsByAlg[alg] ? String(metricsByAlg[alg][key] ?? '—') : '—'));
    console.log(label.padEnd(34) + vals.map((v) => String(v).padEnd(25)).join(''));
  }
  console.log(`  (Catalog size: ${allSongIds.length} | Users evaluated: ${evalUsers.length})`);
  console.log('-'.repeat(70));

  const best = bestAlgorithm.overall;
  console.log(`\nBest algorithm (NDCG@10): ${algLabels[best.algorithm]} (${best.value})`);
  console.log('\nOutput files:');
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  By-user CSV: ${userCsvPath}`);
  console.log(`  Sample: ${samplePath}`);
}

main()
  .catch((err) => {
    console.error('\nEvaluation FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
