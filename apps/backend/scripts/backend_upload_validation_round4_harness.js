const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadMiddleware = require('../src/middleware/upload.middleware');
const uploadTest = uploadMiddleware.__test;

console.log('UPLOAD VALIDATION ROUND 4 HARNESS - NO DB DATA CREATED');

const backendRoot = path.join(__dirname, '..');
const uploadRoot = path.join(backendRoot, 'uploads');
const audioDir = path.join(uploadRoot, 'audio');
const imageDir = path.join(uploadRoot, 'images');

function makeBuffer(parts) {
  return Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part, 'ascii')));
}

const fixtures = {
  mp3Id3: makeBuffer(['ID3', Buffer.alloc(32)]),
  mp3Frame: Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]),
  wav: makeBuffer(['RIFF', Buffer.alloc(4), 'WAVEfmt ', Buffer.alloc(16)]),
  flac: makeBuffer(['fLaC', Buffer.alloc(32)]),
  aac: Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f, 0xfc]),
  ogg: makeBuffer(['OggS', Buffer.alloc(32), 'OpusHead']),
  m4a: makeBuffer([Buffer.from([0x00, 0x00, 0x00, 0x20]), 'ftypM4A ', Buffer.alloc(24)]),
  webm: makeBuffer([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32), 'webm']),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  gif87a: makeBuffer(['GIF87a', Buffer.alloc(16)]),
  gif89a: makeBuffer(['GIF89a', Buffer.alloc(16)]),
  webp: makeBuffer(['RIFF', Buffer.alloc(4), 'WEBPVP8 ', Buffer.alloc(16)]),
  text: Buffer.from('THIS IS NOT AUDIO OR IMAGE\n', 'utf8'),
};

function tempFile(dir, name, buffer) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `round4-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function makeFile({ dir = audioDir, name, fieldname, mimetype, buffer }) {
  const filePath = tempFile(dir, name, buffer);
  return {
    path: filePath,
    filename: path.basename(filePath),
    originalname: name,
    fieldname,
    mimetype,
    size: buffer.length,
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invokeValidateUploadedFiles(req) {
  const res = makeRes();
  let nextError = null;
  await uploadTest.validateUploadedFiles(req, res, (error) => {
    nextError = error || null;
  });
  return { res, nextError };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectValidationFail(file) {
  try {
    await uploadTest.validateUploadedFileContent(file);
  } catch (error) {
    expect(error.statusCode === 400, `expected 400, got ${error.statusCode || error.message}`);
    return error;
  } finally {
    await uploadTest.cleanupUploadedFiles([file]);
  }
  throw new Error('expected validation failure');
}

async function expectValidationPass(file, expectedType) {
  try {
    const actual = await uploadTest.validateUploadedFileContent(file);
    expect(actual === expectedType, `expected ${expectedType}, got ${actual}`);
  } finally {
    await uploadTest.cleanupUploadedFiles([file]);
  }
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result;
}

async function findRealSample(exts, expectedType) {
  const files = walkFiles(uploadRoot).filter((file) => exts.includes(path.extname(file).toLowerCase()));
  for (const file of files) {
    try {
      const detected = await uploadTest.detectActualFileType(file);
      if (detected === expectedType) return file;
    } catch (_error) {}
  }
  return null;
}

async function run() {
  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  };

  await test('1 valid MP3 ID3 -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.mp3Id3 }), 'mp3');
  });
  await test('2 valid MP3 MPEG frame sync -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.mp3Frame }), 'mp3');
  });
  await test('3 fake MP3 plain text -> FAIL', async () => {
    await expectValidationFail(makeFile({ name: 'fake.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.text }));
  });
  await test('4 WAV RIFF/WAVE -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.wav', fieldname: 'audio', mimetype: 'audio/wav', buffer: fixtures.wav }), 'wav');
  });
  await test('5 FLAC fLaC -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.flac', fieldname: 'audio', mimetype: 'audio/flac', buffer: fixtures.flac }), 'flac');
  });
  await test('6 AAC ADTS -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.aac', fieldname: 'audio', mimetype: 'audio/aac', buffer: fixtures.aac }), 'aac');
  });
  await test('7 OGG OggS -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.ogg', fieldname: 'audio', mimetype: 'audio/ogg', buffer: fixtures.ogg }), 'ogg');
  });
  await test('8 M4A ftyp sample -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.m4a', fieldname: 'audio', mimetype: 'audio/mp4', buffer: fixtures.m4a }), 'm4a');
  });
  await test('9 WebM EBML -> PASS', async () => {
    await expectValidationPass(makeFile({ name: 'valid.webm', fieldname: 'audio', mimetype: 'audio/webm', buffer: fixtures.webm }), 'webm');
  });

  await test('10 JPEG -> PASS', async () => {
    await expectValidationPass(makeFile({ dir: imageDir, name: 'valid.jpg', fieldname: 'cover', mimetype: 'image/jpeg', buffer: fixtures.jpeg }), 'jpeg');
  });
  await test('11 PNG -> PASS', async () => {
    await expectValidationPass(makeFile({ dir: imageDir, name: 'valid.png', fieldname: 'cover', mimetype: 'image/png', buffer: fixtures.png }), 'png');
  });
  await test('12 GIF87a -> PASS', async () => {
    await expectValidationPass(makeFile({ dir: imageDir, name: 'valid.gif', fieldname: 'cover', mimetype: 'image/gif', buffer: fixtures.gif87a }), 'gif');
  });
  await test('13 GIF89a -> PASS', async () => {
    await expectValidationPass(makeFile({ dir: imageDir, name: 'valid.gif', fieldname: 'cover', mimetype: 'image/gif', buffer: fixtures.gif89a }), 'gif');
  });
  await test('14 WEBP -> PASS', async () => {
    await expectValidationPass(makeFile({ dir: imageDir, name: 'valid.webp', fieldname: 'cover', mimetype: 'image/webp', buffer: fixtures.webp }), 'webp');
  });

  await test('15 .mp3 + WAV content -> FAIL', async () => {
    await expectValidationFail(makeFile({ name: 'mismatch.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.wav }));
  });
  await test('16 .jpg + PNG content -> FAIL', async () => {
    await expectValidationFail(makeFile({ dir: imageDir, name: 'mismatch.jpg', fieldname: 'cover', mimetype: 'image/jpeg', buffer: fixtures.png }));
  });
  await test('17 audio field + JPEG -> FAIL', async () => {
    await expectValidationFail(makeFile({ name: 'wrong.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.jpeg }));
  });
  await test('18 cover field + MP3 -> FAIL', async () => {
    await expectValidationFail(makeFile({ dir: imageDir, name: 'wrong.jpg', fieldname: 'cover', mimetype: 'image/jpeg', buffer: fixtures.mp3Id3 }));
  });
  await test('19 fake .mp3 text + audio/mpeg -> FAIL', async () => {
    await expectValidationFail(makeFile({ name: 'fake.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.text }));
  });
  await test('20 fake .jpg text + image/jpeg -> FAIL', async () => {
    await expectValidationFail(makeFile({ dir: imageDir, name: 'fake.jpg', fieldname: 'cover', mimetype: 'image/jpeg', buffer: fixtures.text }));
  });
  await test('21 valid mp3 + invalid client MIME -> FAIL', async () => {
    await expectValidationFail(makeFile({ name: 'valid.mp3', fieldname: 'audio', mimetype: 'text/plain', buffer: fixtures.mp3Id3 }));
  });
  await test('22 valid jpeg + invalid client MIME -> FAIL', async () => {
    await expectValidationFail(makeFile({ dir: imageDir, name: 'valid.jpg', fieldname: 'cover', mimetype: 'text/plain', buffer: fixtures.jpeg }));
  });

  await test('23 post-upload invalid signature removes temp file', async () => {
    const file = makeFile({ name: 'fake.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.text });
    const { nextError } = await invokeValidateUploadedFiles({ file });
    expect(nextError?.statusCode === 400, 'expected 400 validation error');
    expect(!fs.existsSync(file.path), 'invalid file was not removed');
  });
  await test('24 multi-file request one invalid -> all request files cleanup', async () => {
    const valid = makeFile({ name: 'valid.mp3', fieldname: 'audio', mimetype: 'audio/mpeg', buffer: fixtures.mp3Id3 });
    const invalid = makeFile({ dir: imageDir, name: 'fake.jpg', fieldname: 'cover', mimetype: 'image/jpeg', buffer: fixtures.text });
    const { nextError } = await invokeValidateUploadedFiles({ files: { audio: [valid], cover: [invalid] } });
    expect(nextError?.statusCode === 400, 'expected 400 validation error');
    expect(!fs.existsSync(valid.path), 'valid request file was not removed after multi-file failure');
    expect(!fs.existsSync(invalid.path), 'invalid request file was not removed');
  });
  await test('25 upload validation error has HTTP/statusCode 400', () => {
    const error = uploadTest.createUploadValidationError('bad upload', 'UPLOAD_BAD');
    expect(error.statusCode === 400 && error.code === 'UPLOAD_BAD', 'upload validation error not 400');
  });
  await test('26 invalid extension/MIME is 400, not 500', () => {
    uploadTest.fileFilter({}, { fieldname: 'audio', originalname: 'fake.txt', mimetype: 'text/plain' }, (error) => {
      expect(error?.statusCode === 400, `expected 400, got ${error?.statusCode || error?.message}`);
    });
  });
  await test('27 Multer client limit errors normalize to 400', () => {
    const error = uploadTest.normalizeUploadError(new multer.MulterError('LIMIT_FILE_SIZE', 'audio'));
    expect(error.statusCode === 400 && error.code === 'LIMIT_FILE_SIZE', 'Multer limit did not normalize to 400');
  });

  let realMp3Sample = null;
  let realImageSample = null;
  await test('Real existing MP3 regression -> PASS', async () => {
    realMp3Sample = await findRealSample(['.mp3'], 'mp3');
    expect(Boolean(realMp3Sample), 'no existing MP3 sample detected as mp3');
  });
  await test('Real existing image regression -> PASS', async () => {
    realImageSample =
      await findRealSample(['.jpg', '.jpeg'], 'jpeg')
      || await findRealSample(['.png'], 'png')
      || await findRealSample(['.webp'], 'webp');
    expect(Boolean(realImageSample), 'no existing image sample detected');
  });

  const failed = results.filter((result) => !result.pass);
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.pass ? '' : ` - ${result.error}`}`);
  }
  console.log(`REAL_MP3_SAMPLE=${realMp3Sample || 'NONE'}`);
  console.log(`REAL_IMAGE_SAMPLE=${realImageSample || 'NONE'}`);
  console.log(`TOTAL ${results.length}`);
  console.log(`PASS ${results.length - failed.length}`);
  console.log(`FAIL ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
