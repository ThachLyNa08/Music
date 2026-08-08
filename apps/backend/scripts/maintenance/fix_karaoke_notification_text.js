require('dotenv').config();

const { pool } = require('../../src/config/database');

async function main() {
  const [ready] = await pool.query(
    `UPDATE notifications
     SET title = ?,
         message = REPLACE(REPLACE(message, ?, ?), ?, ?)
     WHERE type = 'karaoke_ready'
       AND (title = ? OR message LIKE ?)`,
    [
      'Karaoke đã sẵn sàng',
      'Bai hat ',
      'Bài hát ',
      ' da tach vocal xong va co the hat Karaoke.',
      ' đã tách vocal xong và có thể hát Karaoke.',
      'Karaoke da san sang',
      'Bai hat %',
    ]
  );

  const [failed] = await pool.query(
    `UPDATE notifications
     SET title = ?,
         message = REPLACE(REPLACE(message, ?, ?), ?, ?)
     WHERE type = 'karaoke_failed'
       AND (title = ? OR message LIKE ?)`,
    [
      'Tách Karaoke thất bại',
      'Khong the tach vocal cho bai hat ',
      'Không thể tách vocal cho bài hát ',
      '. Vui long thu lai sau.',
      '. Vui lòng thử lại sau.',
      'Tach Karaoke that bai',
      'Khong the %',
    ]
  );

  console.log(JSON.stringify({
    karaoke_ready_updated: ready.affectedRows,
    karaoke_failed_updated: failed.affectedRows,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
