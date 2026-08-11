// src/server.js
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const http   = require('http');
const { Server } = require('socket.io');

const app                    = require('./app');
const { testConnection, pool }     = require('./config/database');
const { connectRedis }       = require('./config/redis');
const { registerSocketEvents } = require('./services/socket.service');
const { initializeLyricsSemanticIndex } = require('./services/lyricsSemanticSearch.service');

const PORT   = process.env.PORT || 3000;

async function bootstrap() {
  // 1. Kiểm tra kết nối DB & Cache
  await testConnection();

  // Inject index creation
  try {
    console.log('Ensuring DB indexes...');
    const queries = [
      'CREATE INDEX idx_listening_history_created_at ON listening_history(created_at)',
      'CREATE INDEX idx_listening_history_song_id ON listening_history(song_id)',
      'CREATE INDEX idx_listening_history_created_at_song_id ON listening_history(created_at, song_id)',
      'CREATE INDEX idx_listening_history_source_created_at ON listening_history(source, created_at)',
      'CREATE INDEX idx_songs_artist_id ON songs(artist_id)'
    ];
    for (const query of queries) {
      try {
        await pool.query(query);
      } catch (err) {
        if (err.code !== 'ER_DUP_KEYNAME') {
          console.error(`Index creation failed for: ${query}`, err.message);
        }
      }
    }
    console.log('DB indexes check complete.');
  } catch (e) {
    console.error('Error in index check:', e.message);
  }

  await connectRedis();

  await initializeLyricsSemanticIndex();

  const { ensureLogTableExists, ensureGenerationRunsTableExists, recoverStaleSystemPlaylistRuns } = require('./services/systemPlaylistRunLog.service');
  await ensureLogTableExists();
  await ensureGenerationRunsTableExists();
  const recoveredPlaylistRuns = await recoverStaleSystemPlaylistRuns();
  console.log(`[SystemPlaylistRecovery] startup check complete. Recovered ${recoveredPlaylistRuns} stale regenerate run(s).`);

  try {
    const stemService = require('./services/stem.service');
    await stemService.ensureStemSchema();
    const recovered = await stemService.recoverStaleStemJobs();
    console.log(`[StemRecovery] startup check complete. Recovered ${recovered.length} stale stem job(s).`);
  } catch (err) {
    console.error('[StemRecovery] startup check failed:', err.message);
  }

  // 2. Tạo HTTP server
  const server = http.createServer(app);

  // 3. Gắn Socket.IO
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });
  // Truyền io vào app để dùng ở các controller
  app.set('io', io);
  registerSocketEvents(io);

  // 4. Khởi chạy scheduled jobs (cron)
  require('./services/scheduler.service');

  const { startSystemPlaylistScheduler } = require('./schedulers/systemPlaylistScheduler');
  startSystemPlaylistScheduler();

  // Khởi chạy pending poller cho SePay
  const { startSepayPendingPoller } = require('./services/sepayPoller.service');
  startSepayPendingPoller(io);

  // 5. Lắng nghe
  server.listen(PORT, () => {
    console.log(`\n🚀 MusicFlow backend running on http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   AI Service  : ${process.env.AI_SERVICE_URL}\n`);
    try {
      const { startSystemPlaylistCron } = require('./schedulers/systemPlaylistCron.scheduler');
      startSystemPlaylistCron();
    } catch (error) {
      console.error('[SystemPlaylistCron] failed to start', error);
    }
    try {
      const { startSongReleaseCron } = require('./schedulers/songReleaseCron.scheduler');
      startSongReleaseCron();
    } catch (error) {
      console.error('[SongReleaseCron] failed to start', error);
    }
  });
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
