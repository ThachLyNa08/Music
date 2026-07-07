// src/server.js
require('dotenv').config();
const http   = require('http');
const { Server } = require('socket.io');

const app                    = require('./app');
const { testConnection, pool }     = require('./config/database');
const { connectRedis }       = require('./config/redis');
const { registerSocketEvents } = require('./services/socket.service');

const PORT   = process.env.PORT || 3000;

async function bootstrap() {
  // 1. Kiểm tra kết nối DB & Cache
  await testConnection();

  await connectRedis();

  const { ensureLogTableExists } = require('./services/systemPlaylistRunLog.service');
  await ensureLogTableExists();
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
  });
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
