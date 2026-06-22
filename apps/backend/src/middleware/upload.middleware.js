const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const audioDir = path.join(uploadDir, 'audio');
const imageDir = path.join(uploadDir, 'images');
const genreDir = path.join(uploadDir, 'genres');

[uploadDir, audioDir, imageDir, genreDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      cb(null, audioDir);
    } else if (file.fieldname === 'cover' || file.fieldname === 'avatar') {
      cb(null, imageDir);
    } else if (file.fieldname === 'genre_cover') {
      cb(null, genreDir);
    } else {
      cb(new Error('Invalid field name'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    
    // Sanitize original filename (remove extension first)
    let baseName = path.basename(file.originalname, ext);
    
    // Loại bỏ ký tự tiếng Việt, ký tự nguy hiểm và khoảng trắng
    baseName = String(baseName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/[^a-zA-Z0-9\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
      
    if (!baseName) baseName = file.fieldname;

    cb(null, baseName + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file âm thanh (MP3, WAV, v.v.)'), false);
  } else if (file.fieldname === 'cover' || file.fieldname === 'avatar' || file.fieldname === 'genre_cover') {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Chỉ chấp nhận file hình ảnh (JPG, PNG, v.v.)'), false);
  } else {
    cb(new Error('Unexpected field'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

module.exports = upload;
