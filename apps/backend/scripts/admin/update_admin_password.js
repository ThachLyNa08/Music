require('dotenv').config();
const { pool } = require('../../src/config/database');
const bcrypt = require('bcryptjs');

async function updateAdmin() {
  try {
    const password = 'admin'; // Mật khẩu mới
    const hash = await bcrypt.hash(password, 10);
    
    await pool.query(
      `UPDATE users SET password_hash = ? WHERE email = 'admin@musicflow.vn'`,
      [hash]
    );
    console.log('Cập nhật mật khẩu cho admin@musicflow.vn thành công!');
    console.log('Mật khẩu mới: ' + password);
    process.exit(0);
  } catch (error) {
    console.error('Lỗi:', error);
    process.exit(1);
  }
}

updateAdmin();
