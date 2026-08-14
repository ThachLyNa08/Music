const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('CONTROLLER/SERVICE HARNESS - NOT FULL HTTP INTEGRATION TEST');

const database = require('../src/config/database');
const artistStudio = require('../src/controllers/artistStudio.controller');
const playlistController = require('../src/controllers/playlist.controller');
const aiAssistantController = require('../src/controllers/aiAssistant.controller');
const aiPlaylistService = require('../src/services/aiPlaylist.service');
const authController = require('../src/controllers/auth.controller');
const paymentsController = require('../src/controllers/payments.controller');
const adminController = require('../src/controllers/admin.controller');
const messageService = require('../src/services/message.service');
const albumController = require('../src/controllers/album.controller');

const originalPoolQuery = database.pool.query;

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(headers) {
      this.headers = { ...this.headers, ...headers };
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

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrowsStatus(fn, statusCode = 400) {
  try {
    fn();
  } catch (error) {
    expect(error.statusCode === statusCode, `expected ${statusCode}, got ${error.statusCode || error.message}`);
    return error;
  }
  throw new Error(`expected throw ${statusCode}`);
}

async function expectRejectsStatus(fn, statusCode = 400) {
  try {
    await fn();
  } catch (error) {
    expect(error.statusCode === statusCode, `expected ${statusCode}, got ${error.statusCode || error.message}`);
    return error;
  }
  throw new Error(`expected reject ${statusCode}`);
}

function tempUploadFile(name) {
  const filePath = path.join(os.tmpdir(), `musicflow-round3-${process.pid}-${Date.now()}-${name}`);
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
  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  };

  const ast = artistStudio.__test;
  const ai = aiAssistantController.__test;
  const auth = authController.__test;
  const pay = paymentsController.__test;
  const playlist = playlistController.__test;
  const admin = adminController.__test;
  const album = albumController.__test;

  await test('MEDIUM-02 song title spaces -> 400', () => {
    expectThrowsStatus(() => ast.normalizeRequiredTextInput('   ', ast.SONG_TITLE_MAX_LENGTH, 'title'));
  });
  await test('MEDIUM-02 song title over max -> 400', () => {
    expectThrowsStatus(() => ast.normalizeRequiredTextInput('a'.repeat(ast.SONG_TITLE_MAX_LENGTH + 1), ast.SONG_TITLE_MAX_LENGTH, 'title'));
  });
  await test('MEDIUM-02 song title max boundary -> pass', () => {
    expect(ast.normalizeRequiredTextInput('a'.repeat(ast.SONG_TITLE_MAX_LENGTH), ast.SONG_TITLE_MAX_LENGTH, 'title').length === ast.SONG_TITLE_MAX_LENGTH, 'boundary rejected');
  });
  await test('MEDIUM-02 submissionNote over max -> 400', () => {
    expectThrowsStatus(() => ast.normalizeOptionalTextInput('a'.repeat(ast.TEXT_COLUMN_MAX_LENGTH + 1), ast.TEXT_COLUMN_MAX_LENGTH, 'submissionNote'));
  });
  await test('MEDIUM-02 valid partial update without title -> validation helper allows absent', () => {
    expect(ast.normalizeOptionalTextInput(undefined, ast.TEXT_COLUMN_MAX_LENGTH, 'submissionNote') === undefined, 'undefined optional field rejected');
  });
  await test('MEDIUM-02 file upload + invalid title cleans new file', async () => {
    const file = tempUploadFile('bad.mp3');
    const { res, nextError } = await invoke(artistStudio.uploadSong, {
      artist: { id: 1 },
      user: { id: 2 },
      body: { title: '   ' },
      files: { audio: [file], cover: [] },
    });
    expect(!nextError, nextError?.message || 'unexpected next error');
    expect(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
    expect(!fs.existsSync(file.path), 'uploaded file was not cleaned');
  });

  await test('MEDIUM-03 album title spaces -> 400', () => {
    expectThrowsStatus(() => ast.normalizeRequiredTextInput('   ', ast.ALBUM_TITLE_MAX_LENGTH, 'title'));
  });
  await test('MEDIUM-03 album title over max -> 400', () => {
    expectThrowsStatus(() => ast.normalizeRequiredTextInput('a'.repeat(ast.ALBUM_TITLE_MAX_LENGTH + 1), ast.ALBUM_TITLE_MAX_LENGTH, 'title'));
  });
  await test('MEDIUM-03 album description over max -> 400', () => {
    expectThrowsStatus(() => ast.normalizeOptionalTextInput('a'.repeat(ast.TEXT_COLUMN_MAX_LENGTH + 1), ast.TEXT_COLUMN_MAX_LENGTH, 'description'));
  });
  await test('MEDIUM-03 clean valid album payload validation -> pass', () => {
    expect(ast.normalizeRequiredTextInput('Album', ast.ALBUM_TITLE_MAX_LENGTH, 'title') === 'Album', 'title failed');
    expect(ast.normalizeOptionalTextInput(' Desc ', ast.TEXT_COLUMN_MAX_LENGTH, 'description') === 'Desc', 'description failed');
  });

  await test('MEDIUM-05 playlist song_id=1.5 -> 400 helper', () => {
    expect(playlist.normalizeStrictPositiveId(1.5) === null, 'decimal accepted');
  });
  await test('MEDIUM-05 playlist song_id="1abc" -> 400 helper', () => {
    expect(playlist.normalizeStrictPositiveId('1abc') === null, 'dirty string accepted');
  });
  await test('MEDIUM-05 valid local song ID -> expected path', async () => {
    const calls = [];
    database.pool.query = async (sql) => {
      calls.push(String(sql));
      if (String(sql).includes('FROM playlists')) return [[{ user_id: 7, type: 'manual', is_system: 0, system_key: null }]];
      if (String(sql).includes('FROM songs s WHERE id = ?')) return [[{ id: 3 }]];
      return [{ affectedRows: 1 }];
    };
    const { res, nextError } = await invoke(playlistController.addSongToPlaylist, {
      user: { id: 7 },
      params: { id: 9 },
      body: { song_id: 3 },
    });
    expect(!nextError, nextError?.message || 'unexpected next error');
    expect(res.statusCode === 200 && res.body?.success, 'valid local add rejected');
    expect(calls.some((sql) => sql.includes('INSERT IGNORE INTO playlist_songs')), 'insert path not reached');
  });

  await test('MEDIUM-06 AI prompt spaces -> 400', async () => {
    const { res } = await invoke(aiAssistantController.musicAssistant, { body: { prompt: '   ' }, user: null });
    expect(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
  });
  await test('MEDIUM-06 AI prompt over max -> 400', async () => {
    const { res } = await invoke(aiAssistantController.musicAssistant, { body: { prompt: 'a'.repeat(ai.PROMPT_MAX_LENGTH + 1) }, user: null });
    expect(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
  });
  await test('MEDIUM-06 currentSongId="abc" -> 400', () => {
    expectThrowsStatus(() => ai.normalizeStrictPositiveId('abc', 'currentSongId'));
  });
  await test('MEDIUM-06 currentSongId=1.5 -> 400', () => {
    expectThrowsStatus(() => ai.normalizeStrictPositiveId(1.5, 'currentSongId'));
  });
  await test('MEDIUM-06 autoPlay invalid -> 400', () => {
    expectThrowsStatus(() => ai.normalizeStrictBoolean('abc', 'autoPlay'));
  });
  await test('MEDIUM-06 source invalid -> 400', () => {
    expectThrowsStatus(() => ai.normalizeSource('unknown'));
  });

  await test('MEDIUM-07 previousSongIds=["1abc",2] -> 400', () => {
    expectThrowsStatus(() => aiPlaylistService.normalizeSongIds(['1abc', 2]));
  });
  await test('MEDIUM-07 previousSongIds=[-1,2] -> 400', () => {
    expectThrowsStatus(() => aiPlaylistService.normalizeSongIds([-1, 2]));
  });
  await test('MEDIUM-07 previousSongIds=[1.5,2] -> 400', () => {
    expectThrowsStatus(() => aiPlaylistService.normalizeSongIds([1.5, 2]));
  });
  await test('MEDIUM-07 songIds=[1,"bad",2] -> 400', () => {
    expectThrowsStatus(() => aiPlaylistService.normalizeSongIds([1, 'bad', 2]));
  });
  await test('MEDIUM-07 clean array -> pass', () => {
    const ids = aiPlaylistService.normalizeSongIds([1, '2', 2]);
    expect(JSON.stringify(ids) === JSON.stringify([1, 2]), 'clean IDs not normalized/deduped');
  });

  await test('MEDIUM-08 onboarding max -> valid', () => {
    expect(auth.normalizeStrictIdList(Array.from({ length: auth.ONBOARDING_MAX_SELECTIONS }, (_, i) => i + 1), 'genre_ids').length === auth.ONBOARDING_MAX_SELECTIONS, 'max rejected');
  });
  await test('MEDIUM-08 onboarding max+1 -> 400', () => {
    expectThrowsStatus(() => auth.normalizeStrictIdList(Array.from({ length: auth.ONBOARDING_MAX_SELECTIONS + 1 }, (_, i) => i + 1), 'genre_ids'));
  });
  await test('MEDIUM-08 onboarding 1000 IDs -> 400', () => {
    expectThrowsStatus(() => auth.normalizeStrictIdList(Array.from({ length: 1000 }, (_, i) => i + 1), 'artist_ids'));
  });
  await test('MEDIUM-08 onboarding dirty item -> 400', () => {
    expectThrowsStatus(() => auth.normalizeStrictIdList([1, 'bad'], 'genre_ids'));
  });

  await test('MEDIUM-09 plan_id="1abc" -> 400', () => {
    expectThrowsStatus(() => pay.normalizeStrictPositiveId('1abc', 'plan_id'));
  });
  await test('MEDIUM-09 plan_id=1.5 -> 400', () => {
    expectThrowsStatus(() => pay.normalizeStrictPositiveId(1.5, 'plan_id'));
  });
  await test('MEDIUM-09 plan_id=-1 -> 400', () => {
    expectThrowsStatus(() => pay.normalizeStrictPositiveId(-1, 'plan_id'));
  });
  await test('MEDIUM-09 invalid payment code -> 400', () => {
    expectThrowsStatus(() => pay.normalizePaymentCode('MF123 bad'));
  });
  await test('MEDIUM-09 overlong payment code -> 400', () => {
    expectThrowsStatus(() => pay.normalizePaymentCode(`MF${'A'.repeat(70)}`));
  });
  await test('MEDIUM-09 valid payment code format -> pass', () => {
    expect(pay.normalizePaymentCode('MF1234567890ABCDEF') === 'MF1234567890ABCDEF', 'valid code rejected');
  });

  await test('MEDIUM-10 admin album [1,"bad",2] -> 400', () => {
    expectThrowsStatus(() => admin.parseSongIds([1, 'bad', 2]));
  });
  await test('MEDIUM-10 admin album clean IDs -> pass', () => {
    expect(JSON.stringify(admin.parseSongIds([1, '2', 2])) === JSON.stringify([1, 2]), 'clean IDs rejected');
  });

  await test('LOW-01 padded uppercase check-email normalized', async () => {
    let emailParam = null;
    database.pool.query = async (_sql, params) => {
      emailParam = params[0];
      return [[{ id: 1 }]];
    };
    const { res } = await invoke(authController.checkEmail, { query: { email: ' USER@EXAMPLE.COM ' } });
    expect(res.statusCode === 200 && res.body?.exists === true, 'valid email lookup failed');
    expect(emailParam === 'user@example.com', `email not normalized: ${emailParam}`);
  });
  await test('LOW-01 invalid email -> 400', () => {
    expectThrowsStatus(() => auth.normalizeEmailInput('not-an-email'));
  });
  await test('LOW-01 overlong email -> 400', () => {
    expectThrowsStatus(() => auth.normalizeEmailInput(`${'a'.repeat(250)}@example.com`));
  });

  await test('LOW-02 message search over max -> 400', async () => {
    await expectRejectsStatus(() => messageService.searchUsers(1, 'a'.repeat(messageService.MAX_USER_SEARCH_QUERY_LENGTH + 1)));
  });
  await test('LOW-03 replyToMessageId="abc" -> 400', () => {
    expectThrowsStatus(() => messageService.normalizeOptionalPositiveId('abc', 'replyToMessageId'));
  });
  await test('LOW-03 replyToMessageId=-1 -> 400', () => {
    expectThrowsStatus(() => messageService.normalizeOptionalPositiveId(-1, 'replyToMessageId'));
  });
  await test('LOW-03 replyToMessageId=1.5 -> 400', () => {
    expectThrowsStatus(() => messageService.normalizeOptionalPositiveId(1.5, 'replyToMessageId'));
  });
  await test('LOW-03 missing reply ID -> normal null', () => {
    expect(messageService.normalizeOptionalPositiveId(undefined, 'replyToMessageId') === null, 'missing reply rejected');
  });
  await test('LOW-04 DELETE album abc/library -> 400 helper', () => {
    expect(album.normalizeStrictPositiveId('abc') === null, 'abc accepted');
    expect(album.normalizeStrictPositiveId(0) === null, '0 accepted');
    expect(album.normalizeStrictPositiveId(-1) === null, '-1 accepted');
    expect(album.normalizeStrictPositiveId(1.5) === null, 'decimal accepted');
  });

  await test('Regression payment debug routes still absent', () => {
    const routes = require('../src/routes/payments.routes').stack.map((layer) => layer.route?.path).filter(Boolean);
    expect(!routes.includes('/fix-prices'), 'fix-prices route mounted');
    expect(!routes.includes('/simulate/:paymentCode'), 'simulate route mounted');
  });
  await test('Regression public lyrics still filtered', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/services/lyrics.service.js'), 'utf8');
    expect(source.includes('publicSongCondition') && source.includes('publicOnly'), 'public lyrics filter not found');
  });
  await test('Regression listening completion_rate strict', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/controllers/listeningHistory.controller.js'), 'utf8');
    expect(source.includes('completion_rate') && source.includes('Number.isFinite'), 'completion_rate strict validation not found');
  });
  await test('Regression Admin Genre strict', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/controllers/admin_genre.controller.js'), 'utf8');
    expect(source.includes('normalizePositiveId') && source.includes('normalizePositiveIdList'), 'admin genre strict helpers not found');
  });
  await test('Regression release_status strict', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/utils/public.utils.js'), 'utf8');
    expect(source.includes('release_status khong hop le') && source.includes('provided'), 'release_status strict validation not found');
  });

  database.pool.query = originalPoolQuery;

  const failed = results.filter((item) => !item.pass);
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.pass ? '' : ` - ${result.error}`}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  if (failed.length) process.exitCode = 1;
}

run().finally(() => {
  database.pool.query = originalPoolQuery;
});
