const fs = require('fs');
const path = require('path');

const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');

function isInsideUploads(candidatePath) {
  const relative = path.relative(uploadsRoot, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveUploadUrl(uploadUrl) {
  if (typeof uploadUrl !== 'string') {
    return {
      ok: false,
      isUploadsUrl: false,
      reason: 'invalid_url',
      absolutePath: null,
    };
  }

  const cleanUrl = uploadUrl.trim();
  if (!cleanUrl.startsWith('/uploads/')) {
    return {
      ok: false,
      isUploadsUrl: false,
      reason: 'not_uploads_url',
      absolutePath: null,
    };
  }

  let decodedPath = cleanUrl;
  try {
    decodedPath = decodeURIComponent(cleanUrl);
  } catch {
    return {
      ok: false,
      isUploadsUrl: true,
      reason: 'invalid_encoding',
      absolutePath: null,
    };
  }

  const relativePath = decodedPath.replace(/^\/uploads\//, '');
  const normalizedRelative = path.normalize(relativePath).replace(/^([/\\])+/, '');
  const absolutePath = path.resolve(uploadsRoot, normalizedRelative);

  if (!isInsideUploads(absolutePath)) {
    return {
      ok: false,
      isUploadsUrl: true,
      reason: 'path_traversal',
      absolutePath: null,
    };
  }

  return {
    ok: true,
    isUploadsUrl: true,
    reason: null,
    absolutePath,
  };
}

function uploadUrlExists(uploadUrl) {
  const resolved = resolveUploadUrl(uploadUrl);
  if (!resolved.ok) {
    return {
      ...resolved,
      exists: false,
      isFile: false,
    };
  }

  try {
    const stat = fs.statSync(resolved.absolutePath);
    return {
      ...resolved,
      exists: true,
      isFile: stat.isFile(),
    };
  } catch {
    return {
      ...resolved,
      exists: false,
      isFile: false,
    };
  }
}

module.exports = {
  uploadsRoot,
  resolveUploadUrl,
  uploadUrlExists,
};
