const assert = require('assert');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { previewAiPlaylist, saveAiPlaylist, refineAiPlaylist } = require('../../src/services/aiPlaylist.service');
const { pool } = require('../../src/config/database');

async function getTestUserId() {
    const [rows] = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    return rows[0]?.id || null;
}

async function cleanupPlaylist(playlistId) {
    if (!playlistId) return;
    await pool.query('DELETE FROM ai_playlists WHERE playlist_id = ?', [playlistId]);
    await pool.query('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
    await pool.query('DELETE FROM playlists WHERE id = ?', [playlistId]);
}

async function main() {
    try {
        await pool.query('SELECT 1');
    } catch (error) {
        console.warn(`AI Playlist save test skipped: database unavailable (${error.message})`);
        return;
    }

    const userId = await getTestUserId();
    if (!userId) {
        console.warn('AI Playlist save test skipped: no users in database');
        return;
    }

    let savedId = null;
    try {
        const preview = await previewAiPlaylist({
            prompt: 'Nhạc buồn nhưng đừng quá thảm',
            targetCount: 8,
            userId,
            useLLM: false
        });
        assert(preview.intent, 'preview should include intent');
        assert(preview.songs.length > 0, 'preview should return songs');
        assert(preview.songs.length <= preview.intent.playlist.target_count, 'preview should not exceed normalized target');

        const refined = await refineAiPlaylist({
            originalPrompt: 'Nhạc buồn nhưng đừng quá thảm',
            refinePrompt: 'nhẹ hơn',
            previousIntent: preview.intent,
            previousSongIds: preview.songs.map((song) => song.id),
            targetCount: 8,
            userId,
            useLLM: false
        });
        assert(refined.meta.refined, 'refine meta should mark refined');
        assert(refined.intent, 'refine should include intent');
        assert(refined.songs.length > 0, 'refine should return songs');

        const save = await saveAiPlaylist({
            userId,
            name: 'AI Playlist Save Test',
            description: 'Temporary test playlist',
            sourcePrompt: 'Nhạc buồn nhưng đừng quá thảm',
            intent: preview.intent,
            songIds: preview.songs.map((song) => song.id),
            visibility: 'private'
        });

        savedId = save.playlist.id;
        assert(save.success, 'save should succeed');
        assert.strictEqual(save.playlist.type, 'ai', 'playlist type should be ai');
        assert.strictEqual(save.playlist.song_count, preview.songs.length, 'song count should match');
        assert.strictEqual(save.redirectUrl, `/playlist/${savedId}`, 'redirect URL should match');

        const [[playlist]] = await pool.query('SELECT id, user_id, type, is_public FROM playlists WHERE id = ?', [savedId]);
        assert(playlist, 'playlist row should exist');
        assert.strictEqual(Number(playlist.user_id), Number(userId), 'playlist owner should match');
        assert.strictEqual(playlist.type, 'ai', 'playlist DB type should be ai');
        assert.strictEqual(Number(playlist.is_public), 0, 'playlist should be private by default');

        const [[songCount]] = await pool.query('SELECT COUNT(*) AS total FROM playlist_songs WHERE playlist_id = ?', [savedId]);
        assert.strictEqual(Number(songCount.total), preview.songs.length, 'playlist_songs count should match');

        const [[aiLog]] = await pool.query('SELECT COUNT(*) AS total FROM ai_playlists WHERE playlist_id = ?', [savedId]);
        assert.strictEqual(Number(aiLog.total), 1, 'ai_playlists log should exist');

        console.log(JSON.stringify({
            success: true,
            userId,
            savedId,
            previewReturned: preview.songs.length,
            refinedReturned: refined.songs.length,
            refinedAvoidedPreviousSongs: refined.meta.avoidedPreviousSongs
        }, null, 2));
    } finally {
        await cleanupPlaylist(savedId);
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
