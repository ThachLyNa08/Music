require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { scanAndFetchMissingSongCovers } = require('../../src/services/songImage.service');

async function run() {
  console.log('--- Bắt đầu script tải cover bài hát ---');
  try {
    const stats = await scanAndFetchMissingSongCovers(50);
    console.log('Thống kê:', stats);
  } catch (error) {
    console.error('Lỗi khi chạy script:', error);
  } finally {
    process.exit(0);
  }
}

run();
