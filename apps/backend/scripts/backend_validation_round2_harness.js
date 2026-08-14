const fs = require('fs');
const os = require('os');
const path = require('path');

const database = require('../src/config/database');
const notificationService = require('../src/services/notification.service');

notificationService.createNotification = async () => ({});
notificationService.createGlobalNotification = async () => ({});
notificationService.notifyAdminsNewArtistSubmission = async () => ({});
notificationService.notifyArtistSubmissionReceived = async () => ({});

const originalPoolQuery = database.pool.query;
const originalGetConnection = database.pool.getConnection;
const originalConsoleError = console.error;

console.error = (...args) => {
  if (args[0] === 'updateSong Error:') return;
  originalConsoleError(...args);
};

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set() {
      return this;
    },
  };
}

async function invoke(handler, req) {
  const res = makeRes();
  let nextError = null;
  await handler(req, res, (err) => {
    nextError = err;
  });
  return { res, nextError };
}

function tableColumns(table) {
  const columns = {
    songs: ['id', 'album_id', 'artist_id', 'genre_id', 'title', 'duration_sec', 'audio_url', 'cover_url', 'is_active', 'release_status', 'release_at', 'published_at', 'review_status'],
    albums: ['id', 'artist_id', 'genre_id', 'title', 'cover_url', 'description', 'release_date', 'release_at', 'submission_note', 'review_status', 'submitted_by_artist_id', 'submitted_by_user_id', 'submitted_at'],
    artists: ['id', 'name'],
    genres: ['id', 'name', 'slug'],
  };
  return [columns[table].map((Field) => ({ Field }))];
}

function installDefaultPool() {
  database.pool.query = async (sql, params = []) => {
    const text = String(sql);
    if (text.includes('SHOW COLUMNS FROM `songs`') || text.includes('SHOW COLUMNS FROM songs')) return tableColumns('songs');
    if (text.includes('SHOW COLUMNS FROM `albums`') || text.includes('SHOW COLUMNS FROM albums')) return tableColumns('albums');
    if (text.includes('SHOW COLUMNS FROM `artists`') || text.includes('SHOW COLUMNS FROM artists')) return tableColumns('artists');
    if (text.includes('SHOW COLUMNS FROM `genres`') || text.includes('SHOW COLUMNS FROM genres')) return tableColumns('genres');
    if (text.includes('FROM songs s') && text.includes('song_lyrics')) {
      const publicOnly = text.includes("review_status = 'approved'");
      if (params[0] === 1) {
        return [[{
          song_id: 1,
          lyrics: 'hello world',
          synced_lyrics: null,
          lyrics_sync_type: 'PLAIN_TEXT',
          lyrics_provider: 'local',
          lyrics_provider_id: null,
        }]];
      }
      if (params[0] === 2 && !publicOnly) {
        return [[{
          song_id: 2,
          lyrics: 'draft lyric',
          synced_lyrics: null,
          lyrics_sync_type: 'PLAIN_TEXT',
          lyrics_provider: 'local',
          lyrics_provider_id: null,
        }]];
      }
      return [[]];
    }
    if (text.includes('FROM artists a')) return [[{ id: params[0], name: 'Artist' }]];
    if (text.includes('FROM songs') && text.includes('GROUP BY')) return [[]];
    return [[]];
  };
}

function makeConnection(options = {}) {
  const state = { updated: false, committed: false, rolledBack: false };
  return {
    state,
    beginTransaction: async () => {},
    commit: async () => {
      state.committed = true;
    },
    rollback: async () => {
      state.rolledBack = true;
    },
    release: () => {},
    query: async (sql, params = []) => {
      const text = String(sql);
      if (text.includes('SELECT release_status, release_at FROM songs')) return [[{ release_status: 'published', release_at: null }]];
      if (text.includes('SELECT id FROM artists WHERE id')) return options.missingArtist ? [[]] : [[{ id: params[0] }]];
      if (text.includes('SELECT id FROM albums WHERE id')) return options.missingAlbum ? [[]] : [[{ id: params[0] }]];
      if (text.includes('SELECT id FROM genres WHERE id')) return options.missingGenre ? [[]] : [[{ id: params[0] }]];
      if (text.includes('SELECT id FROM artists WHERE name')) return [[{ id: 10 }]];
      if (text.includes('SELECT id FROM albums WHERE title')) return [[]];
      if (text.includes('INSERT INTO artists')) return [{ insertId: 10 }];
      if (text.includes('INSERT INTO albums') && !text.includes('artist_content_review_logs')) return [{ insertId: 20 }];
      if (text.includes('INSERT INTO songs')) return options.songInsertFails ? Promise.reject(new Error('forced insert failure')) : [{ insertId: 30 }];
      if (text.includes('UPDATE songs SET')) {
        state.updated = true;
        return [{ affectedRows: 1 }];
      }
      if (text.includes('SELECT id FROM songs') && text.includes('WHERE id IN')) {
        const ids = params[0] || [];
        return options.invalidAlbumSongs ? [[]] : [ids.map((id) => ({ id }))];
      }
      if (text.includes('SELECT * FROM albums')) return [[{ id: params[0], cover_url: null, can_resubmit: 1, resubmission_count: 0 }]];
      if (text.includes('COUNT(*) as count')) return [[{ count: 0 }]];
      if (text.includes('artist_content_review_logs')) return [{ insertId: 1 }];
      return [[]];
    },
  };
}

function setConnection(options = {}) {
  const conn = makeConnection(options);
  database.pool.getConnection = async () => conn;
  return conn;
}

function tempUploadFile(name) {
  const filePath = path.join(os.tmpdir(), `musicflow-round2-${process.pid}-${Date.now()}-${name}`);
  fs.writeFileSync(filePath, 'temp');
  return {
    path: filePath,
    filename: name,
    originalname: name,
    mimetype: name.endsWith('.jpg') ? 'image/jpeg' : 'audio/mpeg',
    size: 4,
  };
}

async function run() {
  installDefaultPool();
  const paymentsRoutes = require('../src/routes/payments.routes');
  const paymentsController = require('../src/controllers/payments.controller');
  const lyricsService = require('../src/services/lyrics.service');
  const artistStudio = require('../src/controllers/artistStudio.controller');
  const admin = require('../src/controllers/admin.controller');
  const song = require('../src/controllers/song.controller');

  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  };
  const expect = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  await test('PAYMENT fix-prices route is not mounted', async () => {
    const paths = paymentsRoutes.stack.map((layer) => layer.route?.path).filter(Boolean);
    expect(!paths.includes('/fix-prices'), 'fix-prices route is mounted');
    expect(!paymentsController.fixPrices, 'fixPrices handler is still exported');
  });

  await test('PAYMENT simulate route is not mounted', async () => {
    const paths = paymentsRoutes.stack.map((layer) => layer.route?.path).filter(Boolean);
    expect(!paths.includes('/simulate/:paymentCode'), 'simulate route is mounted');
    expect(!paymentsController.simulatePayment, 'simulatePayment handler is still exported');
  });

  await test('PAYMENT real webhook still rejects bad secret and accepts no-code trusted call', async () => {
    const previousSecret = process.env.SEPAY_WEBHOOK_SECRET;
    process.env.SEPAY_WEBHOOK_SECRET = 'test-secret';
    let out = await invoke(paymentsController.handleSepayWebhook, { headers: { authorization: 'Bearer wrong' }, body: {}, app: { get: () => null } });
    expect(out.res.statusCode === 401, 'bad secret did not return 401');
    out = await invoke(paymentsController.handleSepayWebhook, { headers: { authorization: 'Bearer test-secret' }, body: { content: 'no payment code' }, app: { get: () => null } });
    expect(out.res.statusCode === 200 && out.res.body.success === true, 'trusted webhook no-code flow failed');
    process.env.SEPAY_WEBHOOK_SECRET = previousSecret;
  });

  await test('LYRICS public song returns lyrics', async () => {
    const result = await lyricsService.getLyricsBySongId(1, { publicOnly: true });
    expect(result.error === false && result.lyrics === 'hello world', 'public lyrics not returned');
  });

  await test('LYRICS non-public song returns 404-equivalent error for public flow', async () => {
    const result = await lyricsService.getLyricsBySongId(2, { publicOnly: true });
    expect(result.error === true, 'non-public lyrics leaked');
  });

  await test('LYRICS internal flow can still read non-public song', async () => {
    const result = await lyricsService.getLyricsBySongId(2);
    expect(result.error === false && result.lyrics === 'draft lyric', 'internal lyrics flow failed');
  });

  await test('ARTIST ALBUM rejects ["1abc"]', async () => {
    setConnection();
    const out = await invoke(artistStudio.createAlbum, {
      artist: { id: 7 },
      user: { id: 8 },
      body: { title: 'Album', release_at: '2099-01-01 00:00:00', songIds: '["1abc"]' },
    });
    expect(out.res.statusCode === 400, 'dirty song id was accepted');
  });

  await test('ARTIST ALBUM rejects ["1.9"]', async () => {
    setConnection();
    const out = await invoke(artistStudio.resubmitAlbum, {
      params: { id: '9' },
      artist: { id: 7 },
      user: { id: 8 },
      body: { title: 'Album', release_at: '2099-01-01 00:00:00', songIds: '["1.9"]' },
    });
    expect(out.res.statusCode === 400, 'decimal song id was accepted');
  });

  await test('ARTIST ALBUM accepts valid clean song IDs', async () => {
    const conn = setConnection();
    const out = await invoke(artistStudio.createAlbum, {
      artist: { id: 7, name: 'Artist' },
      user: { id: 8 },
      body: { title: 'Album', release_at: '2099-01-01 00:00:00', songIds: '["1",2]' },
    });
    expect(out.res.statusCode === 200 && out.res.body.success === true && conn.state.committed, 'valid song IDs did not succeed');
  });

  await test('ARTIST ALBUM keeps ownership/status validation', async () => {
    setConnection({ invalidAlbumSongs: true });
    const out = await invoke(artistStudio.createAlbum, {
      artist: { id: 7, name: 'Artist' },
      user: { id: 8 },
      body: { title: 'Album', release_at: '2099-01-01 00:00:00', songIds: '[1,2]' },
    });
    expect(out.res.statusCode === 400, 'invalid ownership/status song set was accepted');
  });

  await test('ADMIN SONG rejects artist_id="1abc"', async () => {
    setConnection();
    const out = await invoke(admin.updateSong, { params: { id: '1' }, body: { artist_id: '1abc' }, files: {} });
    expect(out.nextError?.statusCode === 400, 'invalid artist_id was not rejected');
  });

  await test('ADMIN SONG rejects genre_id="abc"', async () => {
    setConnection();
    const out = await invoke(admin.updateSong, { params: { id: '1' }, body: { genre_id: 'abc' }, files: {} });
    expect(out.nextError?.statusCode === 400, 'invalid genre_id was not rejected');
  });

  await test('ADMIN SONG rejects invalid is_active', async () => {
    setConnection();
    const out = await invoke(admin.updateSong, { params: { id: '1' }, body: { is_active: 'abc' }, files: {} });
    expect(out.nextError?.statusCode === 400, 'invalid is_active was not rejected');
  });

  await test('ADMIN SONG rejects whitespace title', async () => {
    setConnection();
    const out = await invoke(admin.updateSong, { params: { id: '1' }, body: { title: '   ' }, files: {} });
    expect(out.nextError?.statusCode === 400, 'whitespace title was not rejected');
  });

  await test('ADMIN SONG accepts valid update and parses is_active="false"', async () => {
    const conn = setConnection();
    const out = await invoke(admin.updateSong, { params: { id: '1' }, body: { title: 'Clean', genre_id: '2', is_active: 'false' }, files: {} });
    expect(!out.nextError && out.res.statusCode === 200 && conn.state.updated, 'valid admin update failed');
  });

  await test('SONG UPLOAD rejects whitespace title and cleans file', async () => {
    const audio = tempUploadFile('bad-title.mp3');
    const out = await invoke(song.uploadSong, { body: { title: '   ', artist_name: 'Artist', genre_id: '1' }, files: { audio: [audio] } });
    expect(out.res.statusCode === 400, 'whitespace title was not rejected');
    expect(!fs.existsSync(audio.path), 'uploaded file was not cleaned');
  });

  await test('SONG UPLOAD rejects genre_id="abc"', async () => {
    const audio = tempUploadFile('bad-genre.mp3');
    const out = await invoke(song.uploadSong, { body: { title: 'Song', artist_name: 'Artist', genre_id: 'abc' }, files: { audio: [audio] } });
    expect(out.res.statusCode === 400, 'invalid genre_id was not rejected');
    expect(!fs.existsSync(audio.path), 'uploaded file was not cleaned');
  });

  await test('SONG UPLOAD rejects duration_sec=-5', async () => {
    const audio = tempUploadFile('bad-duration.mp3');
    const out = await invoke(song.uploadSong, { body: { title: 'Song', artist_name: 'Artist', genre_id: '1', duration_sec: '-5' }, files: { audio: [audio] } });
    expect(out.res.statusCode === 400, 'invalid duration was not rejected');
    expect(!fs.existsSync(audio.path), 'uploaded file was not cleaned');
  });

  await test('SONG UPLOAD rejects text over schema max', async () => {
    const audio = tempUploadFile('bad-long.mp3');
    const out = await invoke(song.uploadSong, { body: { title: 'S', artist_name: 'A'.repeat(256), genre_id: '1' }, files: { audio: [audio] } });
    expect(out.res.statusCode === 400, 'oversized text was not rejected');
    expect(!fs.existsSync(audio.path), 'uploaded file was not cleaned');
  });

  await test('SONG UPLOAD cleans file after DB failure', async () => {
    const audio = tempUploadFile('db-fail.mp3');
    setConnection({ songInsertFails: true });
    const out = await invoke(song.uploadSong, { body: { title: 'Song', artist_name: 'Artist', genre_id: '1' }, files: { audio: [audio] } });
    expect(out.nextError, 'DB failure did not reach next');
    expect(!fs.existsSync(audio.path), 'uploaded file was not cleaned after DB failure');
  });

  await test('SONG UPLOAD accepts valid upload', async () => {
    const audio = tempUploadFile('valid.mp3');
    const conn = setConnection();
    const out = await invoke(song.uploadSong, { body: { title: 'Song', artist_name: 'Artist', genre_id: '1', duration_sec: '123' }, files: { audio: [audio] } });
    expect(out.res.statusCode === 200 && out.res.body.success === true && conn.state.committed, 'valid upload failed');
    if (fs.existsSync(audio.path)) fs.unlinkSync(audio.path);
  });

  await test('RELEASE STATUS rejects nonsense', async () => {
    const { normalizeReleasePayload } = require('../src/utils/public.utils');
    let rejected = false;
    try {
      normalizeReleasePayload({ release_status: 'nonsense' }, { defaultStatus: 'published', isCreate: true });
    } catch (error) {
      rejected = error.statusCode === 400;
    }
    expect(rejected, 'invalid release status did not throw 400');
  });

  await test('RELEASE STATUS missing keeps default', async () => {
    const { normalizeReleasePayload } = require('../src/utils/public.utils');
    const payload = normalizeReleasePayload({}, { defaultStatus: 'published', isCreate: true });
    expect(payload.release_status === 'published', 'missing release status did not use default');
  });

  await test('RELEASE STATUS valid enum is preserved', async () => {
    const { normalizeReleasePayload } = require('../src/utils/public.utils');
    const payload = normalizeReleasePayload({ release_status: 'hidden' }, { defaultStatus: 'published', isCreate: true });
    expect(payload.release_status === 'hidden', 'valid release status changed');
  });

  results.forEach((result, index) => {
    const prefix = result.pass ? 'PASS' : 'FAIL';
    console.log(`${index + 1}. ${prefix} ${result.name}${result.error ? ` - ${result.error}` : ''}`);
  });

  const failed = results.filter((result) => !result.pass);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  await new Promise((resolve) => setImmediate(resolve));
  if (failed.length) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    database.pool.query = originalPoolQuery;
    database.pool.getConnection = originalGetConnection;
    console.error = originalConsoleError;
  });
