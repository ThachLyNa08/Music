/**
 * Helper để lấy subquery tính tổng lượt nghe của một nghệ sĩ
 * Dùng subquery để có thể dễ dàng SELECT cùng với các query khác mà không bị ảnh hưởng bởi GROUP BY
 * @param {string} artistTableAlias - Tên alias của bảng artists trong query chính (mặc định 'a')
 * @returns {string} SQL Subquery
 */
exports.getArtistTotalPlaysQuery = (artistTableAlias = 'a') => {
  return `(
    SELECT COUNT(lh.id)
    FROM listening_history lh
    JOIN songs s ON s.id = lh.song_id
    WHERE s.artist_id = ${artistTableAlias}.id AND s.is_active = TRUE
  )`;
};
