const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');

// ==========================================
// 1. CẤU HÌNH KẾT NỐI DATABASE MYSQL
// ==========================================
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '261999',
    database: 'musicflow'
};

const CSV_FILE_PATH = './uploads/music/music_database_usuk.csv';

// ==========================================
// 2. CÁC HÀM XỬ LÝ DATABASE TỰ ĐỘNG
// ==========================================

async function getOrInsertGenre(connection, genreString) {
    if (!genreString) return null;
    const slug = genreString.toLowerCase().replace(/ /g, '-');
    const name = genreString.toUpperCase();

    const [rows] = await connection.execute('SELECT id FROM genres WHERE slug = ?', [slug]);
    if (rows.length > 0) return rows[0].id;

    const [result] = await connection.execute('INSERT INTO genres (name, slug) VALUES (?, ?)', [name, slug]);
    return result.insertId;
}

async function getOrInsertArtist(connection, artistName) {
    if (!artistName) artistName = 'Unknown Artist';

    const [rows] = await connection.execute('SELECT id FROM artists WHERE name = ?', [artistName]);
    if (rows.length > 0) return rows[0].id;

    const [result] = await connection.execute('INSERT INTO artists (name) VALUES (?)', [artistName]);
    return result.insertId;
}

async function getOrInsertAlbum(connection, albumTitle, artistId, genreId) {
    if (!albumTitle) albumTitle = 'Single';

    const [rows] = await connection.execute(
        'SELECT id FROM albums WHERE title = ? AND artist_id = ?',
        [albumTitle, artistId]
    );
    if (rows.length > 0) return rows[0].id;

    const [result] = await connection.execute(
        'INSERT INTO albums (artist_id, genre_id, title) VALUES (?, ?, ?)',
        [artistId, genreId, albumTitle]
    );
    return result.insertId;
}

// 💡 HÀM LÀM SẠCH TÊN BÀI HÁT TỪ CSV (Gọt sạch rác trước khi lưu)
function cleanRawTitle(title, mainArtist) {
    if (!title) return '';
    let cleaned = title;

    // 1. Xóa sạch mọi rác trong ngoặc có sẵn từ CSV (bay màu JYP, SMTOWN, Official Video...)
    cleaned = cleaned.replace(/\(.*?\)/g, '');
    cleaned = cleaned.replace(/\[.*?\]/g, '');

    // 2. Quét sạch tên ca sĩ bị dính ở đầu bài (VD: "TWICE What is Love" -> "What is Love")
    // Dùng Regex linh hoạt để xóa bất chấp có dấu gạch ngang hay không
    if (mainArtist && mainArtist !== 'Unknown Artist') {
        const artistRegex = new RegExp(`^${mainArtist}\\s*-?\\s*`, 'i');
        cleaned = cleaned.replace(artistRegex, '');
    }

    // 3. Dọn dẹp các ký tự đặc biệt thừa thãi ở hai đầu
    cleaned = cleaned.replace(/^[\-\_\,\'\/]+|[\-\_\,\'\/]+$/g, '');

    return cleaned.trim();
}

// ==========================================
// 3. HÀM CHÍNH: CHẠY LUỒNG IMPORT DỮ LIỆU
// ==========================================
async function importData() {
    console.log('🚀 Bắt đầu kết nối Database...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Đã kết nối MySQL: musicflow');
    } catch (err) {
        console.error('❌ Lỗi kết nối Database. Hãy kiểm tra lại MySQL!', err.message);
        return;
    }

    const results = [];

    console.log(`📂 Đang đọc file CSV: ${CSV_FILE_PATH}`);
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`📊 Đã đọc xong ${results.length} bài hát từ file CSV.`);
            console.log(`🚀 BẮT ĐẦU BƠM FULL: Đang nạp ${results.length} bài hát vào Database...`);

            let successCount = 0;

            for (const row of results) {
                try {
                    const rawTitle = row['Title'];
                    const mainArtist = row['Main_Artist'] ? row['Main_Artist'].trim() : 'Unknown Artist';
                    const originalArtist = row['Original_Artist'] ? row['Original_Artist'].trim() : '';

                    // 💡 BƯỚC QUAN TRỌNG: Làm sạch tên bài hát trước
                    const cleanTitle = cleanRawTitle(rawTitle, mainArtist);

                    // 💡 TIẾP THEO: Ghép tên ca sĩ Collab vào (nếu có và khác ca sĩ chính)
                    let finalTitle = cleanTitle;
                    if (originalArtist && originalArtist !== mainArtist && originalArtist.toLowerCase() !== 'unknown') {
                        finalTitle = `${cleanTitle} (ft. ${originalArtist})`;
                    }

                    const albumTitle = row['Album'];
                    const genreString = row['Genre'];
                    const coverUrl = row['Cover_URL'];
                    const filePath = row['File_Path'];

                    if (!cleanTitle || !filePath) continue;

                    const genreId = await getOrInsertGenre(connection, genreString);
                    const artistId = await getOrInsertArtist(connection, mainArtist);
                    const albumId = await getOrInsertAlbum(connection, albumTitle, artistId, genreId);

                    await connection.execute(
                        `INSERT INTO songs 
                        (album_id, artist_id, genre_id, title, audio_url, cover_url) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [albumId, artistId, genreId, finalTitle, filePath, coverUrl]
                    );

                    successCount++;
                    process.stdout.write(`\r🔄 Đang import sạch sẽ... ${successCount}/${results.length}`);

                } catch (error) {
                    console.error(`\n❌ Lỗi khi import bài hát: ${row['Title']} - ${error.message}`);
                }
            }

            console.log('\n🎉 HOÀN TẤT BƠM FULL DATA SẠCH!');
            console.log(`✅ Đã chèn thành công: ${successCount} bài hát. Chúc mừng nha!`);
            await connection.end();
            process.exit();
        });
}

importData();