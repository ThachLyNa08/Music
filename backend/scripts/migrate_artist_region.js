const mysql = require('mysql2/promise');

async function migrate() {
    console.log('Connecting to database...');
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '261999',
        database: 'musicflow'
    });

    try {
        console.log('Adding region column to artists table...');
        await conn.query(`
            ALTER TABLE artists 
            ADD COLUMN region VARCHAR(50) DEFAULT 'Khác'
        `);
        console.log('Column added successfully!');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists!');
        } else {
            console.error('Error adding column:', err);
        }
    } finally {
        await conn.end();
        process.exit();
    }
}

migrate();
