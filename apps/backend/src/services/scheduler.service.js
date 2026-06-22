const cron = require('node-cron');
const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Env toggle (xem docs/recommendation/scheduler.md)
//
// An toàn: scheduler recommendation MẶC ĐỊNH TẮT. Chỉ bật khi
// ENABLE_RECOMMENDATION_SCHEDULER=true rõ ràng. Mọi giá trị khác (thiếu,
// 'false', '0', '1', ...) đều coi như tắt.
//
//   ENABLE_RECOMMENDATION_SCHEDULER = 'true' (mặc định: KHÔNG bật)
//       Bật toàn bộ cron recommendation (Daily Mix + Weekly Mix).
//   RECOMMENDATION_SCHEDULER_TEST_MODE = 'true' (mặc định: KHÔNG bật)
//       Khi bật, cron chạy mỗi 2 phút để test nhanh. CHỈ dùng cho local dev.
//       Chỉ có hiệu lực khi ENABLE_RECOMMENDATION_SCHEDULER=true.
// ---------------------------------------------------------------------------

const RECOMMENDATION_ENABLED = process.env.ENABLE_RECOMMENDATION_SCHEDULER === 'true';
const RECOMMENDATION_TEST_MODE = process.env.RECOMMENDATION_SCHEDULER_TEST_MODE === 'true';

if (RECOMMENDATION_ENABLED) {
  console.log('[CRON] Recommendation scheduler ENABLED (ENABLE_RECOMMENDATION_SCHEDULER=true)');
  console.log('[CRON] Registered jobs:');
  console.log('  - Daily Mix (Tue-Sat 00:10, Mon 00:10)');
  console.log('  - Weekly Mix (Sun 07:00)');
  console.log('  - Mood Mix (Daily 01:00)');
  console.log('  - Trending Now (Daily 00:30)');
  console.log('  - Contextual Vibes (Daily 01:15)');
  if (RECOMMENDATION_TEST_MODE) {
    console.warn('[CRON-TEST] RECOMMENDATION_SCHEDULER_TEST_MODE=true - cron sẽ chạy mỗi 2 phút. TẮT NGAY khi test xong!');
  }
} else {
  // Env missing hoặc khác 'true' (kể cả 'false', '0', '1', ...) -> mặc định tắt.
  // Log rõ để dev/ops biết scheduler đang ở trạng thái nào.
  console.log(`[CRON] Recommendation scheduler disabled`);
}

// ---------------------------------------------------------------------------
// AI retrain (giữ nguyên như cũ, không liên quan Daily/Weekly Mix)
// ---------------------------------------------------------------------------

if (process.env.AI_RETRAIN_ENABLED === 'true') {
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting recommendation model retrain...');
    try {
      await axios.post(`${AI_URL}/api/recommend/retrain`, {}, { timeout: 15000 });
      console.log('[CRON] Recommendation model retrain completed');
    } catch (err) {
      console.warn('[CRON] Recommendation model retrain skipped:', err.message);
    }
  });
} else {
  console.log('[CRON] AI retrain disabled. Set AI_RETRAIN_ENABLED=true to enable it.');
}

// ---------------------------------------------------------------------------
// Recommendation scheduler (Daily Mix + Weekly Mix)
//
// Daily Mix mapping (weekday của target date -> system_key):
//   Mon -> dailymix_01, Tue -> dailymix_02, Wed -> dailymix_03,
//   Thu -> dailymix_04, Fri -> dailymix_05, Sat|Sun -> dailymix_06.
//
// Lịch cron (giờ local server, server đang chạy ICT):
//   00:10 Tue  -> analyze Mon  -> dailymix_01
//   00:10 Wed  -> analyze Tue  -> dailymix_02
//   00:10 Thu  -> analyze Wed  -> dailymix_03
//   00:10 Fri  -> analyze Thu  -> dailymix_04
//   00:10 Sat  -> analyze Fri  -> dailymix_05
//   00:10 Mon  -> analyze Sat+Sun (weekend range) -> dailymix_06
//   00:10 Sun  -> không có job (Daily Mix 06 chỉ chạy 00:10 Mon).
//
// Weekly Mix: Sun 07:00 -> cập nhật tất cả user.
// ---------------------------------------------------------------------------

if (RECOMMENDATION_ENABLED) {
  const dailyMixService = require('./dailyMix.service');
  const weeklyMixService = require('./weeklyMix.service');
  const { pool } = require('../config/database');

  /**
   * Hàm helper: chạy generate cho 1 target date với tất cả user active.
   * Trả về stats object. Không throw ra ngoài để cron không bị treo.
   */
  async function runDailyMixForAllUsers(targetDate) {
    const t0 = Date.now();
    console.log(`[CRON] Daily Mix run for target=${targetDate.toISOString().slice(0, 10)} starting...`);
    try {
      const [users] = await pool.query(
        `SELECT id FROM users WHERE status = 'active' AND role = 'user' ORDER BY id`
      );
      let ok = 0;
      let err = 0;
      let created = 0;
      let updated = 0;
      let songs = 0;
      for (const u of users) {
        try {
          const r = await dailyMixService.generateDailyMixForDate(u.id, targetDate, {});
          if (r.created) created += 1;
          else updated += 1;
          songs += r.insertedSongs || 0;
          ok += 1;
        } catch (e) {
          err += 1;
          console.warn(`[CRON] user=${u.id} failed: ${e.message}`);
        }
      }
      console.log(
        `[CRON] Daily Mix target=${targetDate.toISOString().slice(0, 10)} done: ` +
        `users=${users.length} ok=${ok} err=${err} created=${created} updated=${updated} ` +
        `songsInserted=${songs} elapsedMs=${Date.now() - t0}`,
      );
    } catch (e) {
      console.error(`[CRON] Daily Mix target=${targetDate.toISOString().slice(0, 10)} failed:`, e.message);
    }
  }

  /**
   * Tính target date cho dailymix_06 (cả Sat + Sun range).
   * 00:10 Mon -> target = Sun của tuần trước.
   * computeTargetRange sẽ tự mở rộng thành [Sat 00:00, Mon 00:00).
   */
  function lastSunday() {
    const now = new Date();
    const day = now.getDay(); // 1=Mon
    // back up (day - 1) ngày để về Mon tuần này, rồi lùi thêm 1 ngày -> Sun tuần trước
    const offset = day === 0 ? 1 : day; // an toàn, không thực tế chạy Sun
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
    return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 1);
  }

  /**
   * Tính target date cho dailymix_01..05.
   * 00:10 Tue -> target = Mon vừa rồi
   * 00:10 Wed -> target = Tue vừa rồi
   * ...
   */
  function yesterday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  // ---- Daily Mix cron jobs ------------------------------------------------

  if (RECOMMENDATION_TEST_MODE) {
    // Test mode: cron */2 phút, chỉ chạy 1 job analyze "yesterday" (mọi
    // weekday) để dễ test. KHÔNG chạy riêng 6 job.
    cron.schedule('*/2 * * * *', () => {
      runDailyMixForAllUsers(yesterday());
    });
  } else {
    // Production: 6 cron jobs
    // 00:10 Tue -> dailymix_01 (analyze Mon)
    cron.schedule('10 0 * * 2', () => {
      const t = new Date();
      const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(mon);
    });
    // 00:10 Wed -> dailymix_02 (analyze Tue)
    cron.schedule('10 0 * * 3', () => {
      const t = new Date();
      const tue = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(tue);
    });
    // 00:10 Thu -> dailymix_03 (analyze Wed)
    cron.schedule('10 0 * * 4', () => {
      const t = new Date();
      const wed = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(wed);
    });
    // 00:10 Fri -> dailymix_04 (analyze Thu)
    cron.schedule('10 0 * * 5', () => {
      const t = new Date();
      const thu = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(thu);
    });
    // 00:10 Sat -> dailymix_05 (analyze Fri)
    cron.schedule('10 0 * * 6', () => {
      const t = new Date();
      const fri = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(fri);
    });
    // 00:10 Mon -> dailymix_06 (analyze weekend Sat+Sun)
    cron.schedule('10 0 * * 1', () => {
      runDailyMixForAllUsers(lastSunday());
    });
    // 00:10 Sun -> KHÔNG có job Daily Mix.
  }

  // ---- Weekly Mix cron job ------------------------------------------------
  if (RECOMMENDATION_TEST_MODE) {
    cron.schedule('*/2 * * * *', async () => {
      console.log('[CRON-TEST] Weekly Mix run starting...');
      try {
        const stats = await weeklyMixService.generateWeeklyMixForAllUsers({});
        console.log(`[CRON-TEST] Weekly Mix done: users=${stats.usersProcessed} err=${stats.errors}`);
      } catch (e) {
        console.error('[CRON-TEST] Weekly Mix failed:', e.message);
      }
    });
  } else {
    // Sun 07:00 -> cập nhật Weekly Mix cho tất cả user
    cron.schedule('0 7 * * 0', async () => {
      console.log('[CRON] Weekly Mix run starting...');
      try {
        const stats = await weeklyMixService.generateWeeklyMixForAllUsers({});
        console.log(
          `[CRON] Weekly Mix done: users=${stats.usersProcessed} ` +
          `created=${stats.playlistsCreated} updated=${stats.playlistsUpdated} ` +
          `songs=${stats.songsInserted} err=${stats.errors}`,
        );
      } catch (e) {
        console.error('[CRON] Weekly Mix failed:', e.message);
      }
    });
  }

  // ---- Mood Mix cron job --------------------------------------------------
  const moodMixService = require('./moodMix.service');
  if (RECOMMENDATION_TEST_MODE) {
    cron.schedule('*/2 * * * *', async () => {
      console.log('[CRON-TEST] Mood Mix run starting...');
      try {
        const count = await moodMixService.generateMoodMixForAllUsers({});
        console.log(`[CRON-TEST] Mood Mix done: users=${count}`);
      } catch (e) {
        console.error('[CRON-TEST] Mood Mix failed:', e.message);
      }
    });
  } else {
    // Everyday at 01:00 -> refresh Mood Mix for all users
    cron.schedule('0 1 * * *', async () => {
      console.log('[CRON] Mood Mix run starting...');
      try {
        const count = await moodMixService.generateMoodMixForAllUsers({});
        console.log(`[CRON] Mood Mix done: users=${count}`);
      } catch (e) {
        console.error('[CRON] Mood Mix failed:', e.message);
      }
    });
  }

  // ---- Contextual Mood cron job ---------------------------------------------
  const contextualMoodPlaylistService = require('./contextualMoodPlaylist.service');
  if (RECOMMENDATION_TEST_MODE) {
    cron.schedule('*/2 * * * *', async () => {
      console.log('[CRON-TEST] Contextual Mood run starting...');
      try {
        const summary = await contextualMoodPlaylistService.generateContextualMoodPlaylistsForAllUsers({});
        console.log(`[CRON-TEST] Contextual Mood done: users=${summary.usersProcessed}`);
      } catch (e) {
        console.error('[CRON-TEST] Contextual Mood failed:', e.message);
      }
    });
  } else {
    // Everyday at 01:15 -> refresh Contextual Mood for all users
    cron.schedule('15 1 * * *', async () => {
      console.log('[CRON] Contextual Mood run starting...');
      try {
        const summary = await contextualMoodPlaylistService.generateContextualMoodPlaylistsForAllUsers({});
        console.log(`[CRON] Contextual Mood done: users=${summary.usersProcessed}`);
      } catch (e) {
        console.error('[CRON] Contextual Mood failed:', e.message);
      }
    });
  }

  // ---- Trending Now cron job ------------------------------------------------
  const trendingPlaylistService = require('./trendingPlaylist.service');
  if (RECOMMENDATION_TEST_MODE) {
    cron.schedule('*/2 * * * *', async () => {
      console.log('[CRON-TEST] Trending Now run starting...');
      try {
        const result = await trendingPlaylistService.generateTrendingPlaylist({});
        console.log(`[CRON-TEST] Trending Now done: songs=${result.insertedSongs}`);
      } catch (e) {
        console.error('[CRON-TEST] Trending Now failed:', e.message);
      }
    });
  } else {
    // Everyday at 00:30 -> refresh Trending Now globally
    cron.schedule('30 0 * * *', async () => {
      console.log('[CRON] Trending Now run starting...');
      try {
        const result = await trendingPlaylistService.generateTrendingPlaylist({});
        console.log(`[CRON] Trending Now done: songs=${result.insertedSongs}`);
      } catch (e) {
        console.error('[CRON] Trending Now failed:', e.message);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Các job khác (avatar / cover / album) - giữ nguyên không liên quan Daily Mix
// ---------------------------------------------------------------------------

cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Scanning missing artist avatars...');
  try {
    const { scanAndFetchMissingAvatars } = require('./artistImage.service');
    await scanAndFetchMissingAvatars();
    console.log('[CRON] Artist avatar scan completed');
  } catch (err) {
    console.error('[CRON] Artist avatar scan failed:', err.message);
  }
});

cron.schedule('30 3 * * *', async () => {
  console.log('[CRON] Scanning missing song covers...');
  try {
    const { scanAndFetchMissingSongCovers } = require('./songImage.service');
    await scanAndFetchMissingSongCovers(50);
    console.log('[CRON] Song cover scan completed');
  } catch (err) {
    console.error('[CRON] Song cover scan failed:', err.message);
  }
});

cron.schedule('0 4 * * *', async () => {
  console.log('[CRON] Scanning missing album covers...');
  try {
    const { scanAndFetchMissingAlbumCovers } = require('./songImage.service');
    await scanAndFetchMissingAlbumCovers(50);
    console.log('[CRON] Album cover scan completed');
  } catch (err) {
    console.error('[CRON] Album cover scan failed:', err.message);
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const { pool } = require('../config/database');
    const [res] = await pool.query(`UPDATE payment_transactions SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()`);
    if (res.affectedRows > 0) {
      console.log(`[CRON] Expired ${res.affectedRows} pending payment transactions`);
    }
  } catch (err) {
    console.error('[CRON] Expire QR failed:', err.message);
  }
});

cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Scanning for expiring premium users...');
  try {
    const { pool } = require('../config/database');
    const { createNotification } = require('./notification.service');
    
    const [users] = await pool.query(
      `SELECT id, premium_expires_at FROM users 
       WHERE premium_expires_at >= DATE_ADD(NOW(), INTERVAL 2 DAY)
         AND premium_expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)`
    );
    
    for (const u of users) {
      const [notifs] = await pool.query(
        `SELECT id FROM notifications 
         WHERE user_id = ? AND type = 'premium_expiring' 
           AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [u.id]
      );
      
      if (notifs.length === 0) {
        await createNotification({
          userId: u.id,
          title: 'Gói Premium sắp hết hạn',
          message: 'Gói Premium của bạn sắp hết hạn trong 3 ngày tới. Gia hạn ngay để tiếp tục sử dụng các quyền lợi độc quyền.',
          type: 'premium_expiring'
        });
        console.log(`[CRON] Sent premium_expiring notification to user ${u.id}`);
      }
    }
  } catch (err) {
    console.error('[CRON] Premium expiring notification failed:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

console.log('[CRON] Scheduler registered');
