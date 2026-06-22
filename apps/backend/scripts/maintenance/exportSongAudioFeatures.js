const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../../src/config/database');

function getArg(name, defaultValue = null) {
    const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
    if (!arg) return defaultValue;
    return arg.split('=').slice(1).join('=');
}

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function main() {
    const market = getArg('market');
    const outputArg = getArg('output');

    const exportDir = path.resolve(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName =
        outputArg ||
        `song_audio_features_${market || 'ALL'}_${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;

    const outputPath = path.resolve(exportDir, fileName);

    const params = [];
    let where = '';

    if (market) {
        const validMarkets = ['KPOP', 'VPOP', 'USUK', 'OTHER'];
        const upperMarket = market.toUpperCase();
        if (!validMarkets.includes(upperMarket)) {
            console.error(`Lỗi: Market '${market}' không hợp lệ. Vui lòng chọn một trong: ${validMarkets.join(', ')}`);
            process.exit(1);
        }
        where = 'WHERE s.market = ?';
        params.push(upperMarket);
    }

    const [rows] = await pool.query(
        `
    SELECT 
      s.id AS song_id,
      s.title,
      s.market,
      g.name AS genre_name,
      a.name AS artist_name,
      s.audio_url,
      saf.bpm,
      saf.tempo_level,
      saf.energy_score,
      saf.energy,
      saf.danceability,
      saf.acoustic_score,
      saf.brightness,
      saf.mood,
      saf.vibe,
      saf.analyzed_at
    FROM song_audio_features saf
    JOIN songs s ON s.id = saf.song_id
    LEFT JOIN genres g ON g.id = s.genre_id
    LEFT JOIN artists a ON a.id = s.artist_id
    ${where}
    ORDER BY s.market, g.name, s.id
    `,
        params
    );

    const headers = [
        'song_id',
        'title',
        'market',
        'genre_name',
        'artist_name',
        'audio_url',
        'bpm',
        'tempo_level',
        'energy_score',
        'energy',
        'danceability',
        'acoustic_score',
        'brightness',
        'mood',
        'vibe',
        'analyzed_at',
    ];

    const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
    ].join('\n');

    try {
        fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf8');
    } catch (err) {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
            console.log(`LỖI: Không thể ghi đè file ${fileName}. Vui lòng đóng file CSV đang mở trong Excel hoặc chương trình khác rồi chạy lại lệnh!`);
        } else {
            console.log(`LỖI khi lưu file: ${err.message}`);
        }
        pool.end();
        process.exit(1);
    }

    console.log('Xuất file thành công!');
    console.log(`Số dòng: ${rows.length}`);
    if (rows.length === 0) {
        console.log('Lưu ý: Không có dữ liệu nào khớp với điều kiện lọc.');
    }
    console.log(`File: ${outputPath}`);

    pool.end();
    process.exit(0);
}

main().catch((error) => {
    console.error('Export song_audio_features failed:', error);
    process.exit(1);
});