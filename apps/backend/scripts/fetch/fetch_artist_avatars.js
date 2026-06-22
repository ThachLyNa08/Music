const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "..", "..", ".env"),
});

const { scanAndFetchMissingAvatars } = require("../../src/services/artistImage.service");
const { pool } = require("../../src/config/database");

async function main() {
    try {
        console.log("=== BẮT ĐẦU QUÉT AVATAR NGHỆ SĨ ===");

        await scanAndFetchMissingAvatars();

        console.log("=== HOÀN TẤT QUÉT AVATAR NGHỆ SĨ ===");
    } catch (error) {
        console.error("Lỗi chạy script:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
