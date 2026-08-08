const assert = require('assert');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { previewAiPlaylist } = require('../../src/services/aiPlaylist.service');
const { pool } = require('../../src/config/database');

const prompts = [
    'Nhạc Việt buồn nhẹ nghe buổi tối.',
    'Nhạc buồn nhưng đừng quá thảm.',
    'Trẻ trẻ nhưng không quá ồn.',
    'Tạo playlist Kpop nhẹ nhàng, đừng quá dance.',
    'USUK sâu lắng trời mưa.',
    'Nhạc thư giãn để làm việc.',
    'Nhạc tập trung chạy deadline.',
    'Nhạc lofi học bài ít lời.',
    'Nhạc tập gym thật cháy.',
    'Nhạc chill uống cà phê.',
    'Nhạc hoài niệm có chiều sâu.',
    'Nhạc tình yêu ngọt ngào.',
    'Nhạc thất tình nhưng không quá bi lụy.',
    'Nhạc vui nhưng không quá náo nhiệt.',
    'Nhạc lái xe cuối tuần.',
    'Nhạc giống Sơn Tùng nhưng nhẹ hơn.',
    'Nhạc Kpop sôi động nhưng đừng quá ồn.',
    'Nhạc Việt nhẹ đầu dễ nghe.',
    'Nhạc Âu Mỹ R&B đêm khuya.',
    'Cho tôi vài bài mới lạ nhưng vẫn dễ nghe.',
    'Kpop nhẹ nhàng để học bài của BlackPink'
];

function assertNoDuplicates(songs, prompt) {
    const ids = songs.map((song) => song.id);
    assert.strictEqual(new Set(ids).size, ids.length, `${prompt}: duplicate song ids`);
}

function assertAvailable(songs, prompt) {
    for (const song of songs) {
        if (song.effective_release_status) {
            assert.strictEqual(song.effective_release_status, 'published', `${prompt}: song ${song.id} is not published`);
        }
        assert(song.audio_url || song.audioUrl || song.stream_url, `${prompt}: song ${song.id} missing audio url`);
    }
}

function assertMarketHonored(result, prompt) {
    const market = result.intent.hardConstraints.market;
    if (!['VPOP', 'KPOP', 'USUK'].includes(market) || result.songs.length === 0) return;

    const languageMap = { VPOP: 'vi', KPOP: 'ko', USUK: 'en' };
    const mismatches = result.songs.filter((song) => {
        const songMarket = String(song.market || '').toUpperCase();
        const songLanguage = String(song.language || '').toLowerCase();
        return songMarket !== market && songLanguage !== languageMap[market];
    });

    assert.strictEqual(mismatches.length, 0, `${prompt}: market mismatch for ${market}`);
}

function assertArtistHonored(result, prompt) {
    const hardArtists = result.intent.hardConstraints.include_artists || [];
    if (!hardArtists.length || result.songs.length === 0) return;

    const normalizedHardArtists = hardArtists.map(a => String(a).toLowerCase());
    
    for (const song of result.songs) {
        const artistName = String(song.artist || song.artist_name || '').toLowerCase();
        // Check if the artist matches the hard constraint
        const matched = normalizedHardArtists.some(ha => artistName.includes(ha) || ha.includes(artistName));
        assert(matched, `${prompt}: artist mismatch. Expected one of ${hardArtists.join(', ')} but got ${artistName}`);
    }
}

function assertNegativeNoise(result, prompt) {
    const hasNoiseNegative = result.intent.negativeConstraints.energy.includes('high')
        || result.intent.negativeConstraints.mood.includes('party');
    if (!hasNoiseNegative || result.songs.length === 0) return;

    const highEnergyCount = result.songs.filter((song) => {
        const breakdown = song.scoreBreakdown || {};
        return breakdown.penalty >= 0.2 && breakdown.audioFeature >= 0.7;
    }).length;

    assert(highEnergyCount < result.songs.length, `${prompt}: all songs look high-energy/noisy`);
}

function assertStrictCalmGuard(result, prompt) {
    if (!result.meta?.rankingMeta?.strictCalmEnergyGuard) return;

    let seenHighEnergy = false;
    for (const song of result.songs) {
        const energy = Number(song.energyScore);
        const highEnergy = Number.isFinite(energy) && energy >= 0.65;
        if (highEnergy) {
            seenHighEnergy = true;
        } else {
            assert(!seenHighEnergy, `${prompt}: non-high-energy song appeared after high-energy fallback`);
        }
    }
}

async function main() {
    const outputs = [];

    try {
        await pool.query('SELECT 1');
    } catch (error) {
        console.warn(`AI Playlist ranking test skipped: database unavailable (${error.message})`);
        return;
    }

    for (const [index, prompt] of prompts.entries()) {
        const result = await previewAiPlaylist({
            prompt,
            targetCount: index % 2 === 0 ? 10 : 12,
            userId: null,
            useLLM: false,
            req: null
        });

        assert(result.success, `${prompt}: success=false`);
        assert(result.intent, `${prompt}: missing normalized intent`);
        assert(result.meta, `${prompt}: missing meta`);
        assert(result.meta.candidateMeta, `${prompt}: missing candidate meta`);
        assert(result.songs.length <= result.meta.targetCount, `${prompt}: returned too many songs`);

        if (result.meta.candidateMeta.totalCandidates > 0) {
            assert(result.songs.length > 0, `${prompt}: candidates exist but no songs returned`);
        }
        if (result.meta.candidateMeta.totalCandidates >= result.meta.targetCount) {
            assert.strictEqual(result.songs.length, result.meta.targetCount, `${prompt}: did not return requested target count`);
        }

        assertNoDuplicates(result.songs, prompt);
        assertAvailable(result.songs, prompt);
        assertMarketHonored(result, prompt);
        assertNegativeNoise(result, prompt);
        assertStrictCalmGuard(result, prompt);
        assertArtistHonored(result, prompt);

        outputs.push({
            prompt,
            returned: result.songs.length,
            candidateStrategy: result.meta.candidateStrategy,
            rankingStrategy: result.meta.strategy,
            first: result.songs[0]
                ? {
                    id: result.songs[0].id,
                    title: result.songs[0].title,
                    artist: result.songs[0].artist,
                    aiScore: result.songs[0].aiScore,
                    reason: result.songs[0].reason
                }
                : null
        });
    }

    console.log(`AI Playlist ranking tests passed: ${prompts.length}/${prompts.length}`);
    console.log(JSON.stringify(outputs.slice(0, 5), null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
