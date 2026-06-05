const { pool } = require('../config/database');

const SYNC_TYPES = {
  LINE_SYNCED: 'LINE_SYNCED',
  PLAIN_TEXT: 'PLAIN_TEXT',
  INSTRUMENTAL: 'INSTRUMENTAL',
  NONE: 'NONE',
};

function parseTimestampToMs(timestamp) {
  const match = String(timestamp || '').match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = (match[3] || '0').padEnd(3, '0').slice(0, 3);

  return (minutes * 60 * 1000) + (seconds * 1000) + Number(fraction);
}

function parseLrcToLines(syncedLyrics) {
  if (!syncedLyrics || typeof syncedLyrics !== 'string') return [];

  const parsed = [];
  const lrcLinePattern = /\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\s*(.*)/g;

  for (const rawLine of syncedLyrics.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(lrcLinePattern)];
    if (matches.length === 0) continue;

    for (const match of matches) {
      const startTimeMs = parseTimestampToMs(match[1]);
      if (startTimeMs === null) continue;

      parsed.push({
        startTimeMs,
        endTimeMs: null,
        words: (match[2] || '').trim(),
      });
    }
  }

  parsed.sort((a, b) => a.startTimeMs - b.startTimeMs);

  return parsed.map((line, index) => ({
    ...line,
    endTimeMs: parsed[index + 1]?.startTimeMs ?? null,
  }));
}

function getRawValue(raw, camelKey, snakeKey) {
  return raw?.[camelKey] ?? raw?.[snakeKey] ?? null;
}

function normalizeLrclibResponse(raw) {
  const providerLyricId = getRawValue(raw, 'id', 'id');
  const plainLyrics = getRawValue(raw, 'plainLyrics', 'plain_lyrics');
  const syncedLyrics = getRawValue(raw, 'syncedLyrics', 'synced_lyrics');
  const instrumental = Boolean(getRawValue(raw, 'instrumental', 'instrumental'));

  let syncType = SYNC_TYPES.NONE;
  if (instrumental) {
    syncType = SYNC_TYPES.INSTRUMENTAL;
  } else if (syncedLyrics) {
    syncType = SYNC_TYPES.LINE_SYNCED;
  } else if (plainLyrics) {
    syncType = SYNC_TYPES.PLAIN_TEXT;
  }

  const lines = syncType === SYNC_TYPES.LINE_SYNCED
    ? parseLrcToLines(syncedLyrics)
    : [];

  return {
    provider: 'lrclib',
    providerLyricId: providerLyricId ? String(providerLyricId) : null,
    syncType,
    plainLyrics: plainLyrics || null,
    syncedLyrics: syncedLyrics || null,
    lyricsJson: {
      provider: 'lrclib',
      raw,
      lines,
      instrumental,
    },
    confidenceScore: syncType === SYNC_TYPES.NONE ? 0 : 100,
    sourceUrl: providerLyricId ? `https://lrclib.net/api/get/${providerLyricId}` : 'https://lrclib.net',
  };
}

function plainLyricsToLines(plainLyrics) {
  if (!plainLyrics || typeof plainLyrics !== 'string') return [];

  return plainLyrics
    .split(/\r?\n/)
    .map((words) => words.trim())
    .filter(Boolean)
    .map((words) => ({ startTimeMs: null, endTimeMs: null, words }));
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getLyricsBySongId(songId) {
  const numericSongId = Number(songId);
  if (!Number.isInteger(numericSongId) || numericSongId <= 0) {
    return {
      error: true,
      songId,
      syncType: SYNC_TYPES.NONE,
      message: 'ID bai hat khong hop le',
    };
  }

  const [rows] = await pool.query(
    `SELECT song_id, provider, sync_type, plain_lyrics, synced_lyrics, lyrics_json
     FROM song_lyrics
     WHERE song_id = ?
     LIMIT 1`,
    [numericSongId]
  );

  if (rows.length === 0) {
    return {
      error: true,
      songId: numericSongId,
      syncType: SYNC_TYPES.NONE,
      message: 'Chưa có lời bài hát cho bài này',
    };
  }

  const lyric = rows[0];
  const lyricsJson = safeParseJson(lyric.lyrics_json);
  let lines = [];

  if (lyric.sync_type === SYNC_TYPES.LINE_SYNCED) {
    lines = Array.isArray(lyricsJson?.lines) && lyricsJson.lines.length > 0
      ? lyricsJson.lines
      : parseLrcToLines(lyric.synced_lyrics);
  } else if (lyric.sync_type === SYNC_TYPES.PLAIN_TEXT) {
    lines = plainLyricsToLines(lyric.plain_lyrics);
  }

  return {
    error: false,
    songId: numericSongId,
    provider: lyric.provider || 'lrclib',
    syncType: lyric.sync_type || SYNC_TYPES.NONE,
    lines,
  };
}

async function saveLyrics(songId, normalizedLyrics) {
  const numericSongId = Number(songId);
  if (!Number.isInteger(numericSongId) || numericSongId <= 0) {
    throw new Error('songId khong hop le');
  }

  const payload = normalizedLyrics || {};
  const lyricsJson = payload.lyricsJson
    ? JSON.stringify(payload.lyricsJson)
    : null;

  await pool.query(
    `INSERT INTO song_lyrics (
       song_id, provider, provider_lyric_id, sync_type, plain_lyrics, synced_lyrics,
       lyrics_json, source_url, confidence_score, fetched_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       provider = VALUES(provider),
       provider_lyric_id = VALUES(provider_lyric_id),
       sync_type = VALUES(sync_type),
       plain_lyrics = VALUES(plain_lyrics),
       synced_lyrics = VALUES(synced_lyrics),
       lyrics_json = VALUES(lyrics_json),
       source_url = VALUES(source_url),
       confidence_score = VALUES(confidence_score)`,
    [
      numericSongId,
      payload.provider || 'lrclib',
      payload.providerLyricId || null,
      payload.syncType || SYNC_TYPES.NONE,
      payload.plainLyrics || null,
      payload.syncedLyrics || null,
      lyricsJson,
      payload.sourceUrl || null,
      Number(payload.confidenceScore) || 0,
    ]
  );

  return { songId: numericSongId, imported: true };
}

module.exports = {
  SYNC_TYPES,
  parseLrcToLines,
  normalizeLrclibResponse,
  getLyricsBySongId,
  saveLyrics,
};
