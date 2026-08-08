const crypto = require('crypto');
const fs = require('fs');

/**
 * Calculate SHA-256 hash of a file using read stream
 * @param {string} filePath
 * @returns {Promise<string>} 64-character hex string
 */
function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || typeof filePath !== 'string') {
      return reject(new Error('Đường dẫn file không hợp lệ.'));
    }
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File không tồn tại: ${filePath}`));
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(new Error(`Không thể đọc file để tính hash: ${err.message}`)));
  });
}

module.exports = {
  computeFileSha256,
  calculateFileSha256: computeFileSha256,
};
