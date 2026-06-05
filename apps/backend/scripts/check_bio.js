const { pool } = require('./src/config/database');

async function test() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'bio'");
    if (columns.length === 0) {
      console.log('bio column is missing');
    } else {
      console.log('bio column exists');
    }
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
test();
