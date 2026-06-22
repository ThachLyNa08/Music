require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');
const audioFeatureService = require('../../src/services/audioFeature.service');

const args = process.argv.slice(2);
let limit = 20;
let force = false;
let specificSongId = null;
let market = null;

args.forEach(arg => {
    if (arg.startsWith('--limit=')) {
        limit = parseInt(arg.split('=')[1]) || 20;
    }
    if (arg === '--force') {
        force = true;
    }
    if (arg.startsWith('--songId=')) {
        specificSongId = parseInt(arg.split('=')[1]);
    }
    if (arg.startsWith('--market=')) {
        market = arg.split('=')[1].toUpperCase();
    }
});

async function run() {
    let connection;
    try {
        connection = await pool.getConnection();

        let query = `
            SELECT s.id, s.title, s.audio_url 
            FROM songs s
            LEFT JOIN song_audio_features saf ON saf.song_id = s.id
            WHERE s.is_active = 1 AND s.audio_url IS NOT NULL
        `;

        const params = [];

        if (market) {
            query += ` AND s.market = ?`;
            params.push(market);
        }

        if (specificSongId) {
            query += ` AND s.id = ?`;
            params.push(specificSongId);
        } else if (!force) {
            query += ` AND saf.id IS NULL`;
        }

        query += ` ORDER BY s.id DESC LIMIT ?`;
        params.push(limit);

        const [songs] = await connection.query(query, params);
        
        console.log(`--- TÙY CHỌN ---`);
        console.log(`Limit: ${limit}`);
        console.log(`Force mode: ${force ? 'Yes' : 'No'}`);
        if (market) console.log(`Market filter: ${market}`);
        if (specificSongId) console.log(`SongId filter: ${specificSongId}`);
        console.log(`----------------`);
        console.log(`Bắt đầu phân tích audio features cho ${songs.length} bài hát...`);

        let success = 0;
        let failed = 0;

        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            console.log(`[${i+1}/${songs.length}] Đang xử lý: ${song.title} (ID: ${song.id})`);
            
            try {
                const result = await audioFeatureService.analyzeAndSave(song.id, song.audio_url);
                const f = result.features;
                console.log(`  => OK. BPM: ${f.bpm}, Tempo: ${f.tempo_level}, Raw RMS: ${f.raw_rms}, Energy Score: ${f.energy_score}, Energy: ${f.energy}, Dance: ${f.danceability}, Acoustic: ${f.acoustic_score}, Brightness: ${f.brightness}, Mood: ${f.mood}, Vibe: ${f.vibe}`);
                success++;
            } catch (error) {
                console.error(`  => LỖI bài ${song.id}:`, error.message);
                failed++;
            }
        }

        console.log('-----------------------------------');
        console.log(`TỔNG KẾT: Thành công: ${success}, Thất bại: ${failed}, Bỏ qua: ${limit - songs.length > 0 && !specificSongId ? limit - songs.length : 0}`);

    } catch (error) {
        console.error('Lỗi khi chạy batch script:', error);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

run();
