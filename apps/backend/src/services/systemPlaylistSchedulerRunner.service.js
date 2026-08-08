const runLogService = require('./systemPlaylistRunLog.service');
const {
  getDueSystemPlaylistScheduleRules,
  getSystemPlaylistScheduleRule,
  getScheduledForDateTime
} = require('../utils/systemPlaylistSchedule.util');
const {
  _systemPlaylistMaintenance: maintenance
} = require('../controllers/admin.controller');

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_CONCURRENCY = 2;

function normalizeSchedulerOptions(options = {}) {
  return {
    allDue: options.allDue === true,
    scheduler: options.scheduler || null,
    force: options.force === true,
    dryRun: options.dryRun === true,
    limitTargets: Number.isInteger(options.limitTargets) && options.limitTargets >= 0 ? options.limitTargets : null,
    batchSize: Number.isInteger(options.batchSize) && options.batchSize > 0 ? options.batchSize : DEFAULT_BATCH_SIZE,
    concurrency: Number.isInteger(options.concurrency) && options.concurrency > 0 ? options.concurrency : DEFAULT_CONCURRENCY
  };
}

function getRulesToRun(options) {
  if (options.scheduler) {
    const rule = getSystemPlaylistScheduleRule(options.scheduler);
    if (!rule) throw new Error(`Unknown scheduler: ${options.scheduler}`);
    return [rule];
  }
  if (options.allDue) return getDueSystemPlaylistScheduleRules(new Date());
  throw new Error('Use allDue=true or scheduler=<name>');
}

async function finishSkippedSchedulerRun(rule, scheduledFor, uniqueUsers, targets) {
  const runId = await runLogService.startGenerationRun({
    operationType: maintenance.SYSTEM_PLAYLIST_REGENERATE_OPERATION,
    triggerSource: 'scheduler',
    schedulerName: rule.schedulerName,
    scheduledFor,
    mode: 'scheduler',
    totalUsers: uniqueUsers.size,
    totalPlaylists: targets.length,
    metadata: {
      source: 'system_playlist_scheduler_once',
      schedulerName: rule.schedulerName,
      systemKeys: rule.systemKeys,
      scheduledFor,
      reason: 'NO_RUNNABLE_TARGETS'
    }
  });

  await runLogService.finishGenerationRun(runId, {
    status: 'skipped',
    totalUsers: uniqueUsers.size,
    totalPlaylists: targets.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errorMessage: 'NO_RUNNABLE_TARGETS',
    metadata: {
      source: 'system_playlist_scheduler_once',
      schedulerName: rule.schedulerName,
      systemKeys: rule.systemKeys,
      scheduledFor,
      reason: 'NO_RUNNABLE_TARGETS',
      message: 'Khong co playlist can xu ly'
    }
  });
}

async function runSchedulerRule(rule, options) {
  const scheduledFor = getScheduledForDateTime(rule, new Date());
  let targets = await maintenance.getSystemPlaylistRegenerateTargets({
    mode: 'regenerate_scope',
    systemKeys: rule.systemKeys,
    force: options.force
  });
  if (options.limitTargets !== null) {
    targets = targets.slice(0, options.limitTargets);
  }
  const uniqueUsers = new Set(targets.map((target) => target.userId).filter(Boolean));

  if (options.dryRun) {
    console.log(`[${rule.schedulerName}] dry-run targets=${targets.length} force=${options.force ? 'yes' : 'no'} limit=${options.limitTargets ?? 'none'}`);
    return { schedulerName: rule.schedulerName, status: 'dry_run', total: targets.length };
  }

  if (!targets.length) {
    await finishSkippedSchedulerRun(rule, scheduledFor, uniqueUsers, targets);
    console.log(`[${rule.schedulerName}] no runnable targets`);
    return { schedulerName: rule.schedulerName, status: 'skipped', total: 0 };
  }

  const runId = await runLogService.startGenerationRun({
    operationType: maintenance.SYSTEM_PLAYLIST_REGENERATE_OPERATION,
    triggerSource: 'scheduler',
    schedulerName: rule.schedulerName,
    scheduledFor,
    mode: 'scheduler',
    totalUsers: uniqueUsers.size,
    totalPlaylists: targets.length,
    metadata: {
      source: 'system_playlist_scheduler_once',
      schedulerName: rule.schedulerName,
      systemKeys: rule.systemKeys,
      scheduledFor
    }
  });

  const progress = {
    schedulerName: rule.schedulerName,
    totalUsers: uniqueUsers.size,
    totalPlaylists: targets.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failedItems: [],
    skippedItems: []
  };
  const startedAt = Date.now();
  let finalStatus = 'success';
  let finalError = null;

  async function updateProgress(errorMessage = null) {
    await runLogService.updateGenerationRunProgress(runId, {
      totalUsers: progress.totalUsers,
      totalPlaylists: progress.totalPlaylists,
      processedCount: progress.processedCount,
      successCount: progress.successCount,
      failedCount: progress.failedCount,
      skippedCount: progress.skippedCount,
      errorMessage,
      metadata: {
        ...progress,
        durationMs: Date.now() - startedAt
      }
    });
  }

  try {
    for (let offset = 0; offset < targets.length; offset += options.batchSize) {
      const latestRun = await runLogService.getGenerationRun(runId);
      if (!latestRun || latestRun.cancelRequested || !['queued', 'running'].includes(latestRun.status)) {
        const err = new Error(`Scheduler run ${runId} cancelled`);
        err.code = 'RUN_CANCELLED';
        throw err;
      }

      const batch = targets.slice(offset, offset + options.batchSize);
      await maintenance.runWithConcurrency(batch, options.concurrency, async (target) => {
        try {
          const result = await maintenance.regenerateOneSystemPlaylistTarget(target);
          const stats = maintenance.extractSystemPlaylistGenerationStats(result, target.systemKey);
          await maintenance.syncSystemPlaylistGenerationMetadata(target, stats);
          if (stats.status === 'skipped' || result?.canApply === false) {
            progress.skippedCount += 1;
            progress.skippedItems.push({ playlistId: target.playlistId, systemKey: target.systemKey, reason: result?.message || 'skipped' });
            await runLogService.logSystemPlaylistRun({
              system_key: stats.systemKey,
              playlist_id: target.playlistId,
              user_id: target.userId,
              run_type: 'scheduled',
              scheduled_for: scheduledFor,
              status: 'skipped',
              playlist_count: 1,
              song_count: stats.songCount,
              message: JSON.stringify({ schedulerName: rule.schedulerName, target, result })
            });
          } else {
            progress.successCount += 1;
            await runLogService.logSystemPlaylistRun({
              system_key: stats.systemKey,
              playlist_id: target.playlistId,
              user_id: target.userId,
              run_type: 'scheduled',
              scheduled_for: scheduledFor,
              status: 'success',
              playlist_count: 1,
              song_count: stats.songCount,
              songs_added: stats.addedSongs,
              songs_removed: stats.removedSongs,
              total_songs: stats.songCount,
              overlap_ratio: stats.overlapRatio,
              message: JSON.stringify({ schedulerName: rule.schedulerName, target, result })
            });
          }
        } catch (error) {
          progress.failedCount += 1;
          progress.failedItems.push({ playlistId: target.playlistId, systemKey: target.systemKey, error: error.message });
          await runLogService.logSystemPlaylistRun({
            system_key: target.systemKey,
            playlist_id: target.playlistId,
            user_id: target.userId,
            run_type: 'scheduled',
            scheduled_for: scheduledFor,
            status: 'failed',
            playlist_count: 1,
            error_message: error.message
          });
        } finally {
          progress.processedCount += 1;
        }
      });

      await updateProgress(progress.failedItems.slice(0, 5).map((item) => item.error).join('; ') || null);
    }

    finalStatus = progress.failedCount > 0
      ? (progress.successCount > 0 || progress.skippedCount > 0 ? 'partial_success' : 'failed')
      : (progress.successCount > 0 ? 'success' : 'skipped');
  } catch (error) {
    finalStatus = error.code === 'RUN_CANCELLED' ? 'cancelled' : 'failed';
    finalError = error.message;
  } finally {
    await runLogService.finishGenerationRun(runId, {
      status: finalStatus,
      totalUsers: progress.totalUsers,
      totalPlaylists: progress.totalPlaylists,
      processedCount: progress.processedCount,
      successCount: progress.successCount,
      failedCount: progress.failedCount,
      skippedCount: progress.skippedCount,
      errorMessage: finalError,
      metadata: {
        ...progress,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      }
    });
  }

  console.log(`[${rule.schedulerName}] ${finalStatus} ${progress.processedCount}/${progress.totalPlaylists}`);
  return { schedulerName: rule.schedulerName, status: finalStatus, total: progress.totalPlaylists };
}

async function runSystemPlaylistSchedulerOnce(rawOptions = {}) {
  const options = normalizeSchedulerOptions(rawOptions);
  const rules = getRulesToRun(options);
  const results = [];
  console.log('System Playlist Scheduler Once');
  for (const rule of rules) {
    results.push(await runSchedulerRule(rule, options));
  }
  return results;
}

module.exports = {
  runSystemPlaylistSchedulerOnce,
  normalizeSchedulerOptions,
  getRulesToRun,
  runSchedulerRule
};
