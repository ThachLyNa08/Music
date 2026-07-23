const { pool } = require('../config/database');
const { publicSongCondition } = require('../utils/public.utils');

/**
 * Track user listening history & update song play_count
 * POST /api/listening-history/track
 * POST /api/songs/:id/listen
 */
exports.trackListening = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    let songId = req.body.songId || req.body.song_id || req.params.id;

    if (!songId || isNaN(songId)) {
      return res.status(400).json({ success: false, message: 'ID bài hát không hợp lệ' });
    }
    songId = Number(songId);

    // Validate song exists, is approved and active
    const [songs] = await pool.query(
      `SELECT id, play_count, duration_sec FROM songs WHERE id = ? AND ${publicSongCondition('songs')}`,
      [songId]
    );

    if (songs.length === 0) {
      return res.status(404).json({ success: false, message: 'Bài hát không tồn tại hoặc chưa được duyệt' });
    }

    const songRecord = songs[0];
    const rawPlayedSec = req.body.playedSeconds ?? req.body.listen_duration ?? req.body.listenDuration ?? 0;
    const rawDurationSec = req.body.durationSeconds ?? req.body.song_duration ?? req.body.songDuration ?? songRecord.duration_sec ?? 0;

    const listenDuration = Math.max(0, Math.floor(Number(rawPlayedSec) || 0));
    const songDuration = Math.max(0, Math.floor(Number(rawDurationSec) || 0));

    let completionRate = req.body.completion_rate ?? req.body.completionRate;
    if (completionRate === undefined || completionRate === null) {
      completionRate = songDuration > 0 ? (listenDuration / songDuration) : 0;
    } else {
      completionRate = Number(completionRate) || 0;
    }
    completionRate = Math.min(1, Math.max(0, completionRate));

    let isCompleted = req.body.completed ?? req.body.is_completed ?? req.body.isCompleted;
    if (isCompleted === undefined || isCompleted === null) {
      isCompleted = completionRate >= 0.8;
    } else {
      isCompleted = Boolean(isCompleted);
    }

    let isSkipped = req.body.skipped ?? req.body.is_skipped ?? req.body.isSkipped;
    if (isSkipped === undefined || isSkipped === null) {
      isSkipped = !isCompleted && listenDuration < 30 && completionRate < 0.3;
    } else {
      isSkipped = Boolean(isSkipped);
    }

    const source = String(req.body.source || 'player').trim();
    const historyId = req.body.history_id || req.body.historyId || null;

    // Check eligibility for 1 play count increment
    const isEligibleForCount = isCompleted === true || listenDuration >= 30 || completionRate >= 0.5;

    let shouldIncrementPlayCount = false;
    let finalHistoryId = historyId;

    let alreadyCountedIn30Min = false;

    if (userId) {
      if (isEligibleForCount) {
        const [recentCounted] = await pool.query(`
          SELECT id FROM listening_history
          WHERE user_id = ?
            AND song_id = ?
            AND listened_at >= NOW() - INTERVAL 30 MINUTE
            AND (is_completed = 1 OR listen_duration >= 30 OR completion_rate >= 0.5)
            AND (? IS NULL OR id != ?)
          LIMIT 1
        `, [userId, songId, historyId, historyId]);

        alreadyCountedIn30Min = recentCounted.length > 0;
      }

      if (historyId) {
        // Check if old history record was already counted
        const [oldHistory] = await pool.query(
          'SELECT listen_duration, completion_rate, is_completed FROM listening_history WHERE id = ? AND user_id = ?',
          [historyId, userId]
        );

        if (oldHistory.length > 0) {
          const oldDur = oldHistory[0].listen_duration || 0;
          const oldComp = oldHistory[0].completion_rate || 0;
          const oldCompState = oldHistory[0].is_completed === 1;
          const oldWasCounted = oldCompState || oldDur >= 30 || oldComp >= 0.5;

          if (!oldWasCounted && isEligibleForCount && !alreadyCountedIn30Min) {
            shouldIncrementPlayCount = true;
          }

          await pool.query(`
            UPDATE listening_history
            SET listen_duration = ?, completion_rate = ?, is_completed = ?, is_skipped = ?, listened_at = NOW()
            WHERE id = ? AND user_id = ?
          `, [listenDuration, completionRate, isCompleted ? 1 : 0, isSkipped ? 1 : 0, historyId, userId]);
        }
      } else {
        const [insertRes] = await pool.query(`
          INSERT INTO listening_history (
            user_id, song_id, listen_duration, song_duration, completion_rate,
            is_completed, is_skipped, source, listened_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          userId,
          songId,
          listenDuration,
          songDuration,
          completionRate,
          isCompleted ? 1 : 0,
          isSkipped ? 1 : 0,
          source
        ]);

        finalHistoryId = insertRes.insertId;

        if (isEligibleForCount && !alreadyCountedIn30Min) {
          shouldIncrementPlayCount = true;
        }
      }
    } else {
      // Guest user tracking (no listening_history row saved)
      if (isEligibleForCount) {
        shouldIncrementPlayCount = true;
      }
    }

    let updatedPlayCount = Number(songRecord.play_count || 0);

    if (shouldIncrementPlayCount) {
      await pool.query('UPDATE songs SET play_count = COALESCE(play_count, 0) + 1 WHERE id = ?', [songId]);
      const [[updatedSong]] = await pool.query('SELECT play_count FROM songs WHERE id = ?', [songId]);
      updatedPlayCount = Number(updatedSong?.play_count || (updatedPlayCount + 1));
    }

    const alreadyCounted = alreadyCountedIn30Min || (!shouldIncrementPlayCount && isEligibleForCount);

    return res.json({
      success: true,
      counted: shouldIncrementPlayCount,
      alreadyCounted: alreadyCounted,
      playCount: updatedPlayCount,
      data: {
        history_id: finalHistoryId,
        play_count: updatedPlayCount,
        counted: shouldIncrementPlayCount,
        alreadyCounted: alreadyCounted
      }
    });
  } catch (error) {
    next(error);
  }
};
