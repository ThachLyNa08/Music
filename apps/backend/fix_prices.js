const { pool } = require('./src/config/database');

async function fixPrices() {
  try {
    console.log("Updating prices...");
    await pool.query("UPDATE premium_plans SET price = 1000 WHERE duration_days = 30");
    await pool.query("UPDATE premium_plans SET price = 2000 WHERE duration_days = 90");
    await pool.query("UPDATE premium_plans SET price = 9000 WHERE duration_days = 365");
    
    const [rows] = await pool.query("SELECT id, name, duration_days, price FROM premium_plans");
    console.log("Updated plans:", rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixPrices();
