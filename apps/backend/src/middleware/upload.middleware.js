const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
const audioDir = path.join(uploadDir, 'audio');
const imageDir = path.join(uploadDir, 'images');
const genreDir = path.join(uploadDir, 'genres');
const SIGNATURE_BYTES_TO_READ = 4096;

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
]);
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const FIELD_SIZE_LIMITS = {
  audio: 100 * 1024 * 1024,
  cover: 8 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
  genre_cover: 8 * 1024 * 1024,
  evidence: 8 * 1024 * 1024,
  appeal_evidence: 8 * 1024 * 1024,
};

const IMAGE_FIELDS = new Set(['cover', 'avatar', 'genre_cover', 'evidence', 'appeal_evidence']);
const AUDIO_TYPES = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm']);
const IMAGE_TYPES = new Set(['jpeg', 'png', 'webp', 'gif']);
const EXTENSION_TYPES = {
  '.mp3': 'mp3',
  '.wav': 'wav',
  '.m4a': 'm4a',
  '.aac': 'aac',
  '.ogg': 'ogg',
  '.flac': 'flac',
  '.webm': 'webm',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
  '.gif': 'gif',
};
const TYPE_MIME_TYPES = {
  mp3: new Set(['audio/mpeg', 'audio/mp3']),
  wav: new Set(['audio/wav', 'audio/x-wav']),
  m4a: new Set(['audio/mp4', 'audio/x-m4a']),
  aac: new Set(['audio/aac']),
  ogg: new Set(['audio/ogg']),
  flac: new Set(['audio/flac']),
  webm: new Set(['audio/webm']),
  jpeg: new Set(['image/jpeg']),
  png: new Set(['image/png']),
  webp: new Set(['image/webp']),
  gif: new Set(['image/gif']),
};

[uploadDir, audioDir, imageDir, genreDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      cb(null, audioDir);
    } else if (file.fieldname === 'genre_cover') {
      cb(null, genreDir);
    } else if (IMAGE_FIELDS.has(file.fieldname)) {
      cb(null, imageDir);
    } else {
      cb(createUploadValidationError('Invalid field name', 'UPLOAD_INVALID_FIELD'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname || '').toLowerCase();
    let baseName = path.basename(file.originalname || file.fieldname, ext);

    baseName = String(baseName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    if (!baseName) baseName = file.fieldname;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'audio') {
    if (AUDIO_MIME_TYPES.has(file.mimetype) && AUDIO_EXTENSIONS.has(ext)) return cb(null, true);
    return cb(createUploadValidationError('Chi chap nhan file am thanh hop le', 'UPLOAD_INVALID_AUDIO_TYPE'), false);
  }

  if (IMAGE_FIELDS.has(file.fieldname)) {
    if (IMAGE_MIME_TYPES.has(file.mimetype) && IMAGE_EXTENSIONS.has(ext)) return cb(null, true);
    return cb(createUploadValidationError('Chi chap nhan file hinh anh hop le', 'UPLOAD_INVALID_IMAGE_TYPE'), false);
  }

  return cb(createUploadValidationError('Unexpected field', 'LIMIT_UNEXPECTED_FILE'), false);
};

const baseUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 5 },
});

function createUploadValidationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  if (code) error.code = code;
  return error;
}

function normalizeUploadError(error) {
  if (!error) return error;
  if (error.statusCode) return error;
  if (error instanceof multer.MulterError) {
    return createUploadValidationError(error.message, error.code);
  }
  if (
    ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_PART_COUNT', 'LIMIT_FIELD_KEY', 'LIMIT_FIELD_VALUE', 'LIMIT_FIELD_COUNT'].includes(error.code)
  ) {
    return createUploadValidationError(error.message, error.code);
  }
  return error;
}

function collectRequestFiles(req) {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else {
    Object.values(req.files || {}).forEach(value => {
      if (Array.isArray(value)) files.push(...value);
      else if (value) files.push(value);
    });
  }
  return files.filter(Boolean);
}

function isPathInside(parentDir, filePath) {
  const parent = path.resolve(parentDir);
  const target = path.resolve(filePath);
  return target === parent || target.startsWith(parent + path.sep);
}

async function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    if (!file?.path) continue;
    if (!isPathInside(uploadDir, file.path)) continue;
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to cleanup uploaded file:', error.message);
      }
    }
  }
}

function hasBytes(buffer, bytes, offset = 0) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer, text, offset = 0) {
  return buffer.length >= offset + text.length && buffer.subarray(offset, offset + text.length).toString('ascii') === text;
}

function isMpegFrameSync(buffer) {
  if (buffer.length < 2) return false;
  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0;
}

function detectActualFileTypeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) return null;

  if (hasAscii(buffer, 'ID3', 0) || isMpegFrameSync(buffer)) return 'mp3';
  if (hasAscii(buffer, 'RIFF', 0) && hasAscii(buffer, 'WAVE', 8)) return 'wav';
  if (hasAscii(buffer, 'fLaC', 0)) return 'flac';
  if (hasAscii(buffer, 'OggS', 0)) return 'ogg';
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0) return 'aac';
  if (hasBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3], 0)) return 'webm';
  if (buffer.length >= 12 && hasAscii(buffer, 'ftyp', 4)) {
    const major = buffer.subarray(8, 12).toString('ascii').trim();
    const brands = buffer.subarray(8, Math.min(buffer.length, 64)).toString('ascii');
    if (
      ['M4A', 'M4B', 'mp42', 'isom', 'iso2', 'iso5', 'MSNV', '3gp4', 'qt'].some(brand => major.includes(brand) || brands.includes(brand))
    ) {
      return 'm4a';
    }
  }

  if (hasBytes(buffer, [0xff, 0xd8, 0xff], 0)) return 'jpeg';
  if (hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)) return 'png';
  if (hasAscii(buffer, 'GIF87a', 0) || hasAscii(buffer, 'GIF89a', 0)) return 'gif';
  if (hasAscii(buffer, 'RIFF', 0) && hasAscii(buffer, 'WEBP', 8)) return 'webp';

  return null;
}

async function readFileHeader(filePath, bytesToRead = SIGNATURE_BYTES_TO_READ) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function detectActualFileType(filePath) {
  return detectActualFileTypeFromBuffer(await readFileHeader(filePath));
}

function expectedKindForField(fieldname) {
  if (fieldname === 'audio') return 'audio';
  if (IMAGE_FIELDS.has(fieldname)) return 'image';
  return null;
}

function validateFileSignature(file, detectedType) {
  const fieldKind = expectedKindForField(file.fieldname);
  if (!fieldKind) throw createUploadValidationError('Truong upload khong hop le', 'UPLOAD_INVALID_FIELD');
  if (!detectedType) throw createUploadValidationError('Noi dung file khong dung dinh dang ho tro', 'UPLOAD_INVALID_SIGNATURE');
  if (fieldKind === 'audio' && !AUDIO_TYPES.has(detectedType)) {
    throw createUploadValidationError('Field audio chi chap nhan file am thanh', 'UPLOAD_FIELD_TYPE_MISMATCH');
  }
  if (fieldKind === 'image' && !IMAGE_TYPES.has(detectedType)) {
    throw createUploadValidationError('Field hinh anh chi chap nhan file hinh anh', 'UPLOAD_FIELD_TYPE_MISMATCH');
  }
  return true;
}

function validateFileExtensionAgainstDetectedType(file, detectedType) {
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  const expectedType = EXTENSION_TYPES[ext];
  if (!expectedType || expectedType !== detectedType) {
    throw createUploadValidationError('Extension file khong khop noi dung that', 'UPLOAD_EXTENSION_SIGNATURE_MISMATCH');
  }
  return true;
}

function validateFileMimeAgainstDetectedType(file, detectedType) {
  const allowed = TYPE_MIME_TYPES[detectedType];
  if (!allowed || !allowed.has(file.mimetype)) {
    throw createUploadValidationError('MIME file khong khop dinh dang that', 'UPLOAD_MIME_SIGNATURE_MISMATCH');
  }
  return true;
}

async function validateUploadedFileContent(file) {
  const detectedType = await detectActualFileType(file.path);
  validateFileSignature(file, detectedType);
  validateFileExtensionAgainstDetectedType(file, detectedType);
  validateFileMimeAgainstDetectedType(file, detectedType);
  file.detectedType = detectedType;
  return detectedType;
}

function wrapUploadMiddleware(middleware) {
  return (req, res, next) => {
    middleware(req, res, (error) => {
      next(normalizeUploadError(error));
    });
  };
}

async function validateUploadedFiles(req, res, next) {
  const files = collectRequestFiles(req);

  try {
    for (const file of files) {
      const maxSize = FIELD_SIZE_LIMITS[file.fieldname];
      if (!maxSize) {
        throw createUploadValidationError('Truong upload khong hop le', 'UPLOAD_INVALID_FIELD');
      }
      if (!file.size || file.size > maxSize) {
        throw createUploadValidationError('Dung luong file khong hop le hoac vuot gioi han', 'UPLOAD_INVALID_SIZE');
      }
      await validateUploadedFileContent(file);
    }

    next();
  } catch (error) {
    await cleanupUploadedFiles(files);
    next(normalizeUploadError(error));
  }
}

module.exports = {
  single(fieldName) {
    return [
      wrapUploadMiddleware(baseUpload.single(fieldName)),
      validateUploadedFiles,
    ];
  },
  fields(fields) {
    return [
      wrapUploadMiddleware(baseUpload.fields(fields)),
      validateUploadedFiles,
    ];
  },
  none() {
    return wrapUploadMiddleware(baseUpload.none());
  },
  __test: {
    AUDIO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    AUDIO_MIME_TYPES,
    IMAGE_MIME_TYPES,
    FIELD_SIZE_LIMITS,
    createUploadValidationError,
    normalizeUploadError,
    fileFilter,
    collectRequestFiles,
    cleanupUploadedFiles,
    detectActualFileType,
    detectActualFileTypeFromBuffer,
    validateFileSignature,
    validateFileExtensionAgainstDetectedType,
    validateFileMimeAgainstDetectedType,
    validateUploadedFileContent,
    validateUploadedFiles,
  },
};
