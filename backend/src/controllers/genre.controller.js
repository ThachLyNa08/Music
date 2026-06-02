const { pool } = require('../config/database');

exports.getAllGenres = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT g.id, g.name, g.slug, COUNT(s.id) as song_count
      FROM genres g
      LEFT JOIN songs s ON g.id = s.genre_id AND s.is_active = TRUE
      GROUP BY g.id
      ORDER BY song_count DESC
    `);
    
    return res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};
