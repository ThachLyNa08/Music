const { pool } = require('../config/database');
const { tableExists, columnExists } = require('../utils/dbIntrospection');
const { uploadUrlExists } = require('../utils/uploadPathResolver');

const ISSUE_TYPES = {
  missing_audio: 'Thieu audio',
  broken_audio_url: 'Loi audio URL',
  missing_cover: 'Thieu cover',
  missing_lyrics: 'Thieu lyrics',
  missing_synced_lyrics: 'Thieu synced lyrics',
  missing_features: 'Thieu audio features',
  album_track_mismatch: 'Lech so track album',
  artist_without_song: 'Artist chua co bai hat',
  genre_without_song: 'Genre chua co bai hat',
  market_other: 'Market OTHER hoac trong',
};

const ALLOWED_MARKETS = new Set(['KPOP', 'VPOP', 'USUK', 'OTHER']);

function normalizeQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const type = String(query.type || 'missing_audio').trim();
  const market = String(query.market || '').trim().toUpperCase();
  const search = String(query.search || '').trim();

  return {
    type,
    page,
    limit,
    offset: (page - 1) * limit,
    market: ALLOWED_MARKETS.has(market) ? market : '',
    search,
  };
}

function assertIssueType(type) {
  if (!Object.prototype.hasOwnProperty.call(ISSUE_TYPES, type)) {
    const error = new Error('Loai issue khong hop le');
    error.statusCode = 400;
    throw error;
  }
}

async function safeQuery(warnings, label, sql, params = [], fallback = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    warnings.push(`${label}: ${error.message}`);
    return fallback;
  }
}

async function getSongSchema() {
  const hasSongs = await tableExists('songs');
  if (!hasSongs) return { hasSongs: false };

  const [
    hasArtists,
    hasAlbums,
    hasGenres,
    hasMarket,
    hasUpdatedAt,
    hasLyrics,
    hasSyncedLyrics,
  ] = await Promise.all([
    tableExists('artists'),
    tableExists('albums'),
    tableExists('genres'),
    columnExists('songs', 'market'),
    columnExists('songs', 'updated_at'),
    columnExists('songs', 'lyrics'),
    columnExists('songs', 'synced_lyrics'),
  ]);

  return {
    hasSongs,
    hasArtists,
    hasAlbums,
    hasGenres,
    hasMarket,
    hasUpdatedAt,
    hasLyrics,
    hasSyncedLyrics,
  };
}

function buildSongBase(schema) {
  const joins = [];
  if (schema.hasArtists) joins.push('LEFT JOIN artists a ON a.id = s.artist_id');
  if (schema.hasAlbums) joins.push('LEFT JOIN albums al ON al.id = s.album_id');
  if (schema.hasGenres) joins.push('LEFT JOIN genres g ON g.id = s.genre_id');

  return {
    joins: joins.join('\n'),
    select: [
      's.id AS song_id',
      's.title',
      's.audio_url',
      's.cover_url',
      schema.hasLyrics ? 's.lyrics' : 'NULL AS lyrics',
      schema.hasSyncedLyrics ? 's.synced_lyrics' : 'NULL AS synced_lyrics',
      schema.hasMarket ? 's.market' : 'NULL AS market',
      schema.hasUpdatedAt ? 's.updated_at' : 's.created_at AS updated_at',
      schema.hasArtists ? 'a.name AS artist' : 'NULL AS artist',
      schema.hasAlbums ? 'al.title AS album' : 'NULL AS album',
      schema.hasGenres ? 'g.name AS genre' : 'NULL AS genre',
    ].join(', '),
    orderColumn: schema.hasUpdatedAt ? 's.updated_at' : 's.created_at',
  };
}

function appendSongFilters(where, params, schema, filters) {
  if (filters.market && schema.hasMarket) {
    where.push('COALESCE(NULLIF(s.market, ""), "OTHER") = ?');
    params.push(filters.market);
  }

  if (filters.search) {
    const searchParts = ['s.title LIKE ?'];
    params.push(`%${filters.search}%`);
    if (schema.hasArtists) {
      searchParts.push('a.name LIKE ?');
      params.push(`%${filters.search}%`);
    }
    if (schema.hasAlbums) {
      searchParts.push('al.title LIKE ?');
      params.push(`%${filters.search}%`);
    }
    where.push(`(${searchParts.join(' OR ')})`);
  }
}

async function querySongIssues(warnings, issueWhere, issueParams, filters, options = {}) {
  const schema = await getSongSchema();
  if (!schema.hasSongs) {
    warnings.push('Missing table: songs');
    return { total: 0, items: [] };
  }

  const base = buildSongBase(schema);
  const where = [...issueWhere];
  const params = [...issueParams];
  appendSongFilters(where, params, schema, filters);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const extraJoin = options.extraJoin || '';
  const countRows = await safeQuery(warnings, options.label || 'Song issue count', `
    SELECT COUNT(*) AS total
    FROM songs s
    ${base.joins}
    ${extraJoin}
    ${whereSql}
  `, params);

  const itemRows = await safeQuery(warnings, options.label || 'Song issue rows', `
    SELECT ${base.select}
    FROM songs s
    ${base.joins}
    ${extraJoin}
    ${whereSql}
    ORDER BY ${base.orderColumn} DESC
    LIMIT ? OFFSET ?
  `, [...params, filters.limit, filters.offset]);

  return {
    total: Number(countRows?.[0]?.total || 0),
    items: itemRows || [],
  };
}

async function getAllUploadAudioRows(warnings, filters) {
  const schema = await getSongSchema();
  if (!schema.hasSongs) {
    warnings.push('Missing table: songs');
    return [];
  }

  const base = buildSongBase(schema);
  const where = ['s.audio_url IS NOT NULL', 'TRIM(s.audio_url) <> ""', 's.audio_url LIKE "/uploads/%"'];
  const params = [];
  appendSongFilters(where, params, schema, filters);

  return safeQuery(warnings, 'Broken audio scan', `
    SELECT ${base.select}
    FROM songs s
    ${base.joins}
    WHERE ${where.join(' AND ')}
    ORDER BY ${base.orderColumn} DESC
  `, params);
}

async function getBrokenAudioIssues(warnings, filters) {
  const rows = await getAllUploadAudioRows(warnings, filters);
  const brokenRows = rows.filter(row => {
    const check = uploadUrlExists(row.audio_url);
    return check.isUploadsUrl && (!check.exists || !check.isFile);
  });

  return {
    total: brokenRows.length,
    items: brokenRows.slice(filters.offset, filters.offset + filters.limit),
  };
}

async function getMissingCoverIssues(warnings, filters) {
  const songResult = await querySongIssues(
    warnings,
    ['(s.cover_url IS NULL OR TRIM(s.cover_url) = "")'],
    [],
    { ...filters, limit: 100000, offset: 0 },
    { label: 'Missing song cover' }
  );

  let albumRows = [];
  if (await tableExists('albums')) {
    const hasUpdatedAt = await columnExists('albums', 'updated_at');
    const hasMarket = await columnExists('songs', 'market');
    const hasSongs = await tableExists('songs');
    const where = ['(al.cover_url IS NULL OR TRIM(al.cover_url) = "")'];
    const params = [];
    const joins = ['LEFT JOIN artists a ON a.id = al.artist_id'];

    if (hasSongs) {
      joins.push('LEFT JOIN songs s ON s.album_id = al.id');
      if (filters.market && hasMarket) {
        where.push('COALESCE(NULLIF(s.market, ""), "OTHER") = ?');
        params.push(filters.market);
      }
    }
    if (filters.search) {
      where.push('(al.title LIKE ? OR a.name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    albumRows = await safeQuery(warnings, 'Missing album cover', `
      SELECT DISTINCT
        NULL AS song_id,
        al.id AS album_id,
        al.title,
        NULL AS audio_url,
        al.cover_url,
        NULL AS lyrics,
        NULL AS synced_lyrics,
        ${hasSongs && hasMarket ? 's.market' : 'NULL'} AS market,
        ${hasUpdatedAt ? 'al.updated_at' : 'al.created_at'} AS updated_at,
        a.name AS artist,
        al.title AS album,
        NULL AS genre,
        'album' AS entity_type
      FROM albums al
      ${joins.join('\n')}
      WHERE ${where.join(' AND ')}
      ORDER BY ${hasUpdatedAt ? 'al.updated_at' : 'al.created_at'} DESC
    `, params);
  } else {
    warnings.push('Missing table: albums');
  }

  const songRows = songResult.items.map(item => ({ ...item, entity_type: 'song' }));
  const combined = [...songRows, ...albumRows].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  return {
    total: combined.length,
    items: combined.slice(filters.offset, filters.offset + filters.limit),
  };
}

async function getMissingLyricsIssues(warnings, filters, synced = false) {
  const schema = await getSongSchema();
  if (!schema.hasSongs) {
    warnings.push('Missing table: songs');
    return { total: 0, items: [] };
  }

  const hasLyricsTable = await tableExists('song_lyrics');
  const base = buildSongBase(schema);
  const where = [];
  const params = [];
  const column = synced ? 'synced_lyrics' : 'plain_lyrics';
  const songColumnExists = synced ? schema.hasSyncedLyrics : schema.hasLyrics;
  const songColumn = synced ? 's.synced_lyrics' : 's.lyrics';
  const extraJoin = hasLyricsTable ? 'LEFT JOIN song_lyrics sl ON sl.song_id = s.id' : '';

  if (hasLyricsTable && songColumnExists) {
    where.push(`((${songColumn} IS NULL OR TRIM(${songColumn}) = "") AND (sl.${column} IS NULL OR TRIM(sl.${column}) = ""))`);
  } else if (hasLyricsTable) {
    where.push(`(sl.${column} IS NULL OR TRIM(sl.${column}) = "")`);
  } else if (songColumnExists) {
    where.push(`(${songColumn} IS NULL OR TRIM(${songColumn}) = "")`);
  } else {
    warnings.push(`Missing lyrics source for ${synced ? 'synced' : 'plain'} lyrics`);
    return { total: 0, items: [] };
  }

  appendSongFilters(where, params, schema, filters);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRows = await safeQuery(warnings, synced ? 'Missing synced lyrics count' : 'Missing lyrics count', `
    SELECT COUNT(*) AS total
    FROM songs s
    ${base.joins}
    ${extraJoin}
    ${whereSql}
  `, params);

  const itemRows = await safeQuery(warnings, synced ? 'Missing synced lyrics rows' : 'Missing lyrics rows', `
    SELECT ${base.select}
    FROM songs s
    ${base.joins}
    ${extraJoin}
    ${whereSql}
    ORDER BY ${base.orderColumn} DESC
    LIMIT ? OFFSET ?
  `, [...params, filters.limit, filters.offset]);

  return {
    total: Number(countRows?.[0]?.total || 0),
    items: itemRows || [],
  };
}

async function getMissingFeaturesIssues(warnings, filters) {
  if (await tableExists('song_audio_features')) {
    return querySongIssues(
      warnings,
      [
        `(saf.song_id IS NULL
          OR saf.bpm IS NULL
          OR saf.energy IS NULL OR TRIM(saf.energy) = ''
          OR saf.danceability IS NULL
          OR saf.mood IS NULL OR TRIM(saf.mood) = ''
          OR saf.vibe IS NULL OR TRIM(saf.vibe) = '')`,
      ],
      [],
      filters,
      {
        label: 'Missing features',
        extraJoin: 'LEFT JOIN song_audio_features saf ON saf.song_id = s.id',
      }
    );
  }

  if (await columnExists('songs', 'tempo')) {
    warnings.push('Missing table: song_audio_features; fallback to songs.tempo only');
    return querySongIssues(warnings, ['s.tempo IS NULL'], [], filters, { label: 'Missing tempo fallback' });
  }

  warnings.push('Missing audio feature source: song_audio_features and songs.tempo');
  return { total: 0, items: [] };
}

async function getAlbumTrackMismatchIssues(warnings, filters) {
  if (!(await tableExists('albums'))) {
    warnings.push('Missing table: albums');
    return { total: 0, items: [] };
  }
  if (!(await tableExists('songs'))) {
    warnings.push('Missing table: songs');
    return { total: 0, items: [] };
  }
  if (!(await columnExists('albums', 'total_tracks'))) {
    warnings.push('Missing column: albums.total_tracks');
    return { total: 0, items: [] };
  }

  const hasUpdatedAt = await columnExists('albums', 'updated_at');
  const hasMarket = await columnExists('songs', 'market');
  const having = ['COALESCE(al.total_tracks, 0) <> COUNT(s.id)'];
  const where = [];
  const params = [];

  if (filters.market && hasMarket) {
    where.push('COALESCE(NULLIF(s.market, ""), "OTHER") = ?');
    params.push(filters.market);
  }
  if (filters.search) {
    where.push('(al.title LIKE ? OR a.name LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const baseSql = `
    FROM albums al
    LEFT JOIN artists a ON a.id = al.artist_id
    LEFT JOIN songs s ON s.album_id = al.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY al.id, al.title, al.cover_url, al.total_tracks, a.name, ${hasUpdatedAt ? 'al.updated_at' : 'al.created_at'}
    HAVING ${having.join(' AND ')}
  `;

  const countRows = await safeQuery(warnings, 'Album mismatch count', `SELECT COUNT(*) AS total FROM (SELECT al.id ${baseSql}) q`, params);
  const itemRows = await safeQuery(warnings, 'Album mismatch rows', `
    SELECT
      NULL AS song_id,
      al.id AS album_id,
      al.title,
      NULL AS audio_url,
      al.cover_url,
      NULL AS lyrics,
      NULL AS synced_lyrics,
      ${hasMarket ? 'MIN(COALESCE(NULLIF(s.market, ""), "OTHER"))' : 'NULL'} AS market,
      ${hasUpdatedAt ? 'al.updated_at' : 'al.created_at'} AS updated_at,
      a.name AS artist,
      al.title AS album,
      NULL AS genre,
      al.total_tracks,
      COUNT(s.id) AS actual_tracks
    ${baseSql}
    ORDER BY ${hasUpdatedAt ? 'al.updated_at' : 'al.created_at'} DESC
    LIMIT ? OFFSET ?
  `, [...params, filters.limit, filters.offset]);

  return {
    total: Number(countRows?.[0]?.total || 0),
    items: itemRows || [],
  };
}

async function getArtistWithoutSongIssues(warnings, filters) {
  if (!(await tableExists('artists'))) {
    warnings.push('Missing table: artists');
    return { total: 0, items: [] };
  }
  if (!(await tableExists('songs'))) {
    warnings.push('Missing table: songs');
    return { total: 0, items: [] };
  }

  const hasUpdatedAt = await columnExists('artists', 'updated_at');
  const where = [];
  const params = [];
  if (filters.search) {
    where.push('a.name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const baseSql = `
    FROM artists a
    LEFT JOIN songs s ON s.artist_id = a.id
    ${whereSql}
    GROUP BY a.id, a.name, a.avatar_url, ${hasUpdatedAt ? 'a.updated_at' : 'a.created_at'}
    HAVING COUNT(s.id) = 0
  `;

  const countRows = await safeQuery(warnings, 'Artist without song count', `SELECT COUNT(*) AS total FROM (SELECT a.id ${baseSql}) q`, params);
  const itemRows = await safeQuery(warnings, 'Artist without song rows', `
    SELECT
      NULL AS song_id,
      a.id AS artist_id,
      a.name AS title,
      NULL AS audio_url,
      a.avatar_url AS cover_url,
      NULL AS lyrics,
      NULL AS synced_lyrics,
      NULL AS market,
      ${hasUpdatedAt ? 'a.updated_at' : 'a.created_at'} AS updated_at,
      a.name AS artist,
      NULL AS album,
      NULL AS genre
    ${baseSql}
    ORDER BY ${hasUpdatedAt ? 'a.updated_at' : 'a.created_at'} DESC
    LIMIT ? OFFSET ?
  `, [...params, filters.limit, filters.offset]);

  return { total: Number(countRows?.[0]?.total || 0), items: itemRows || [] };
}

async function getGenreWithoutSongIssues(warnings, filters) {
  if (!(await tableExists('genres'))) {
    warnings.push('Missing table: genres');
    return { total: 0, items: [] };
  }
  if (!(await tableExists('songs'))) {
    warnings.push('Missing table: songs');
    return { total: 0, items: [] };
  }

  const hasUpdatedAt = await columnExists('genres', 'updated_at');
  const where = [];
  const params = [];
  if (filters.search) {
    where.push('g.name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const baseSql = `
    FROM genres g
    LEFT JOIN songs s ON s.genre_id = g.id
    ${whereSql}
    GROUP BY g.id, g.name${hasUpdatedAt ? ', g.updated_at' : ''}
    HAVING COUNT(s.id) = 0
  `;

  const countRows = await safeQuery(warnings, 'Genre without song count', `SELECT COUNT(*) AS total FROM (SELECT g.id ${baseSql}) q`, params);
  const itemRows = await safeQuery(warnings, 'Genre without song rows', `
    SELECT
      NULL AS song_id,
      g.id AS genre_id,
      g.name AS title,
      NULL AS audio_url,
      NULL AS cover_url,
      NULL AS lyrics,
      NULL AS synced_lyrics,
      NULL AS market,
      ${hasUpdatedAt ? 'g.updated_at' : 'NULL'} AS updated_at,
      NULL AS artist,
      NULL AS album,
      g.name AS genre
    ${baseSql}
    ORDER BY ${hasUpdatedAt ? 'g.updated_at DESC' : 'g.name ASC'}
    LIMIT ? OFFSET ?
  `, [...params, filters.limit, filters.offset]);

  return { total: Number(countRows?.[0]?.total || 0), items: itemRows || [] };
}

async function getIssueResult(type, filters, warnings) {
  switch (type) {
    case 'missing_audio':
      return querySongIssues(warnings, ['(s.audio_url IS NULL OR TRIM(s.audio_url) = "")'], [], filters, { label: 'Missing audio' });
    case 'broken_audio_url':
      return getBrokenAudioIssues(warnings, filters);
    case 'missing_cover':
      return getMissingCoverIssues(warnings, filters);
    case 'missing_lyrics':
      return getMissingLyricsIssues(warnings, filters, false);
    case 'missing_synced_lyrics':
      return getMissingLyricsIssues(warnings, filters, true);
    case 'missing_features':
      return getMissingFeaturesIssues(warnings, filters);
    case 'album_track_mismatch':
      return getAlbumTrackMismatchIssues(warnings, filters);
    case 'artist_without_song':
      return getArtistWithoutSongIssues(warnings, filters);
    case 'genre_without_song':
      return getGenreWithoutSongIssues(warnings, filters);
    case 'market_other':
      if (!(await columnExists('songs', 'market'))) {
        warnings.push('Missing column: songs.market');
        return { total: 0, items: [] };
      }
      return querySongIssues(warnings, ['(s.market IS NULL OR TRIM(s.market) = "" OR s.market = "OTHER")'], [], filters, { label: 'Market other' });
    default:
      return { total: 0, items: [] };
  }
}

async function getDataQualitySummary() {
  const warnings = [];
  const counts = {};
  const baseFilters = { page: 1, limit: 1, offset: 0, market: '', search: '' };

  for (const type of Object.keys(ISSUE_TYPES)) {
    const result = await getIssueResult(type, baseFilters, warnings);
    counts[type] = result.total;
  }

  return {
    issueTypes: Object.entries(ISSUE_TYPES).map(([type, label]) => ({
      type,
      label,
      count: counts[type] || 0,
    })),
    counts,
    warnings,
    songsMissingAudio: counts.missing_audio || 0,
    songsMissingCover: counts.missing_cover || 0,
    songsMissingLyrics: counts.missing_lyrics || 0,
    songsMissingFeatures: counts.missing_features || 0,
  };
}

async function getDataQualityIssues(query) {
  const filters = normalizeQuery(query);
  assertIssueType(filters.type);

  const warnings = [];
  const result = await getIssueResult(filters.type, filters, warnings);

  return {
    type: filters.type,
    label: ISSUE_TYPES[filters.type],
    page: filters.page,
    limit: filters.limit,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / filters.limit)),
    items: result.items,
    warnings,
  };
}

module.exports = {
  ISSUE_TYPES,
  getDataQualitySummary,
  getDataQualityIssues,
};
