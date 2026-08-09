const cron = require('node-cron');
const axios = require('axios');
const premiumReminderService = require('./premiumReminder.service');
const { getAllSystemPlaylistScheduleRules } = require('../utils/systemPlaylistSchedule.util');

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
const RECOMMENDATION_SHARED_RUNNER_ENABLED = RECOMMENDATION_ENABLED && process.env.RECOMMENDATION_SCHEDULER_SHARED_RUNNER !== 'false';
let recommendationSystemPlaylistRunActive = false;
const RECOMMENDATION_TEST_MODE = process.env.RECOMMENDATION_SCHEDULER_TEST_MODE === 'true';

if (RECOMMENDATION_ENABLED) {
  console.log('[RecommendationScheduler] ENABLE_RECOMMENDATION_SCHEDULER=true');
  console.log('[RecommendationScheduler] System playlist jobs use shared 00:00 schedule rules');
  for (const rule of getAllSystemPlaylistScheduleRules()) {
    console.log(`  - ${rule.groupLabel} (${rule.label})`);
  }
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
// Premium Expiry Reminder
// ---------------------------------------------------------------------------
cron.schedule('0 8 * * *', () => {
  console.log('[CRON] Running premium auto reminder job...');
  premiumReminderService.runAutoReminderJob();
});

// ---------------------------------------------------------------------------
// Recommendation scheduler (Daily Mix + Weekly Mix)
//
// Daily Mix mapping (weekday của target date -> system_key):
//   Mon -> dailymix_01, Tue -> dailymix_02, Wed -> dailymix_03,
//   Thu -> dailymix_04, Fri -> dailymix_05, Sat|Sun -> dailymix_06.
//
// Lịch cron (giờ local server, server đang chạy ICT):
//   00:00 Mon  -> dailymix_01
//   00:00 Tue  -> dailymix_02
//   00:00 Wed  -> dailymix_03
//   00:00 Thu  -> dailymix_04
//   00:00 Fri  -> dailymix_05
//   00:00 Sat  -> dailymix_06
//   Sunday is reserved for Weekly Mix at 00:00.
//
// Weekly Mix: Sun 00:00 -> update all users.
// ---------------------------------------------------------------------------

if (RECOMMENDATION_SHARED_RUNNER_ENABLED) {
  const schedule = RECOMMENDATION_TEST_MODE ? '*/2 * * * *' : '0 0 * * *';
  cron.schedule(schedule, async () => {
    if (recommendationSystemPlaylistRunActive) {
      console.log('[RecommendationScheduler] System playlist shared runner skipped because in-process run is active');
      return;
    }
    recommendationSystemPlaylistRunActive = true;
    let lock = null;
    console.log('[RecommendationScheduler] System playlist shared runner starting...');
    try {
      const {
        acquireSchedulerLock,
        releaseSchedulerLock,
        getLockTtlMinutes
      } = require('./systemPlaylistSchedulerLock.service');
      lock = await acquireSchedulerLock('system_playlist_scheduler', getLockTtlMinutes());
      if (!lock.acquired) {
        console.log('[RecommendationScheduler] System playlist shared runner skipped because active lock detected');
        return;
      }
      const { runSystemPlaylistSchedulerOnce } = require('./systemPlaylistSchedulerRunner.service');
      const results = await runSystemPlaylistSchedulerOnce({
        allDue: true,
        force: RECOMMENDATION_TEST_MODE,
        dryRun: false,
        limitTargets: null,
        triggerSource: 'scheduler',
        mode: RECOMMENDATION_TEST_MODE ? 'scheduler_test' : 'scheduler'
      });
      console.log(`[RecommendationScheduler] System playlist shared runner done: ${results.map((r) => `${r.schedulerName}:${r.status}`).join(', ')}`);
    } catch (e) {
      console.error('[RecommendationScheduler] System playlist shared runner failed:', e.message);
    } finally {
      if (lock?.acquired) {
        try {
          const { releaseSchedulerLock } = require('./systemPlaylistSchedulerLock.service');
          await releaseSchedulerLock('system_playlist_scheduler', lock.owner);
        } catch (releaseError) {
          console.error('[RecommendationScheduler] System playlist shared runner failed to release lock:', releaseError.message);
        }
      }
      recommendationSystemPlaylistRunActive = false;
    }
  }, { timezone: 'Asia/Ho_Chi_Minh' });
}

if (RECOMMENDATION_ENABLED && process.env.RECOMMENDATION_SCHEDULER_LEGACY_JOBS === 'true' && RECOMMENDATION_SHARED_RUNNER_ENABLED) {
  console.warn('[RecommendationScheduler] Legacy jobs disabled because shared runner is enabled. Set RECOMMENDATION_SCHEDULER_SHARED_RUNNER=false to run legacy jobs explicitly.');
}

if (RECOMMENDATION_ENABLED && process.env.RECOMMENDATION_SCHEDULER_LEGACY_JOBS === 'true' && !RECOMMENDATION_SHARED_RUNNER_ENABLED) {
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
   * 00:00 Sat -> target = previous closed day.
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
   * 00:00 -> target = the closed day before scheduler run.
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
    // 00:00 Mon -> dailymix_01
    cron.schedule('0 0 * * 1', () => {
      const t = new Date();
      const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(mon);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // 00:00 Tue -> dailymix_02
    cron.schedule('0 0 * * 2', () => {
      const t = new Date();
      const tue = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(tue);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // 00:00 Wed -> dailymix_03
    cron.schedule('0 0 * * 3', () => {
      const t = new Date();
      const wed = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(wed);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // 00:00 Thu -> dailymix_04
    cron.schedule('0 0 * * 4', () => {
      const t = new Date();
      const thu = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(thu);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // 00:00 Fri -> dailymix_05
    cron.schedule('0 0 * * 5', () => {
      const t = new Date();
      const fri = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
      runDailyMixForAllUsers(fri);
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // 00:00 Sat -> dailymix_06
    cron.schedule('0 0 * * 6', () => {
      runDailyMixForAllUsers(lastSunday());
    }, { timezone: 'Asia/Ho_Chi_Minh' });
    // Sunday is reserved for Weekly Mix at 00:00.
  }

  // ---- Weekly Mix cron job ------------------------------------------------
  if (RECOMMENDATION_TEST_MODE) {
    cron.schedule('*/2 * * * *', async () => {
      console.log('[CRON-TEST] Weekly Mix run starting...');
      try {
        const { runSystemPlaylistSchedulerOnce } = require('./systemPlaylistSchedulerRunner.service');
        const results = await runSystemPlaylistSchedulerOnce({
          scheduler: 'weekly_mix',
          force: true,
          dryRun: false,
          limitTargets: null,
          triggerSource: 'scheduler',
          mode: 'scheduler_test'
        });
        const stats = results[0] || {};
        console.log(`[CRON-TEST] Weekly Mix done: status=${stats.status || 'unknown'} total=${stats.total || 0}`);
      } catch (e) {
        console.error('[CRON-TEST] Weekly Mix failed:', e.message);
      }
    });
  } else {
    // Sun 00:00 -> update Weekly Mix for all users
    cron.schedule('0 0 * * 0', async () => {
      console.log('[CRON] Weekly Mix run starting...');
      try {
        const { runSystemPlaylistSchedulerOnce } = require('./systemPlaylistSchedulerRunner.service');
        const results = await runSystemPlaylistSchedulerOnce({
          scheduler: 'weekly_mix',
          force: false,
          dryRun: false,
          limitTargets: null,
          triggerSource: 'scheduler',
          mode: 'scheduler'
        });
        const stats = results[0] || {};
        console.log(
          `[CRON] Weekly Mix done: scheduler=${stats.schedulerName || 'weekly_mix'} ` +
          `status=${stats.status || 'unknown'} total=${stats.total || 0}`,
        );
      } catch (e) {
        console.error('[CRON] Weekly Mix failed:', e.message);
      }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
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
    // Everyday at 00:00 -> refresh Mood Mix for all users
    cron.schedule('0 0 * * *', async () => {
      console.log('[CRON] Mood Mix run starting...');
      try {
        const count = await moodMixService.generateMoodMixForAllUsers({});
        console.log(`[CRON] Mood Mix done: users=${count}`);
      } catch (e) {
        console.error('[CRON] Mood Mix failed:', e.message);
      }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
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
    // Everyday at 00:00 -> refresh Contextual Mood for all users
    cron.schedule('0 0 * * *', async () => {
      console.log('[CRON] Contextual Mood run starting...');
      try {
        const summary = await contextualMoodPlaylistService.generateContextualMoodPlaylistsForAllUsers({});
        console.log(`[CRON] Contextual Mood done: users=${summary.usersProcessed}`);
      } catch (e) {
        console.error('[CRON] Contextual Mood failed:', e.message);
      }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
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
    // Everyday at 00:00 -> refresh Trending Now globally
    cron.schedule('0 0 * * *', async () => {
      console.log('[CRON] Trending Now run starting...');
      try {
        const result = await trendingPlaylistService.generateTrendingPlaylist({});
        console.log(`[CRON] Trending Now done: songs=${result.insertedSongs}`);
      } catch (e) {
        console.error('[CRON] Trending Now failed:', e.message);
      }
    }, { timezone: 'Asia/Ho_Chi_Minh' });
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
