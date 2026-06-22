require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { scanAndFetchMissingAlbumCovers } = require('../../src/services/songImage.service');

async function run() {
  console.log('--- Bắt đầu script tải cover album ---');
  try {
    const stats = await scanAndFetchMissingAlbumCovers(100);
    console.log('Thống kê:', stats);
  } catch (error) {
    console.error('Lỗi khi chạy script:', error);
  } finally {
    process.exit(0);
  }
}

run();
