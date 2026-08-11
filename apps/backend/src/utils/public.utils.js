function publicSongCondition(alias = 's') {
  return `
  ${alias}.is_active = TRUE
  AND ${alias}.review_status = 'approved'
  AND (${alias}.release_at IS NULL OR ${alias}.release_at <= NOW())
  AND (
    ${alias}.release_status = 'published'
    OR (
      ${alias}.release_status = 'scheduled'
      AND ${alias}.release_at IS NOT NULL
      AND ${alias}.release_at <= NOW()
    )
  )
`;
}

function publicAlbumCondition(alias = 'al') {
  return `
  ${alias}.review_status = 'approved'
  AND (${alias}.release_at IS NULL OR ${alias}.release_at <= NOW())
  AND (
    ${alias}.release_status = 'published'
    OR (
      ${alias}.release_status = 'scheduled'
      AND ${alias}.release_at IS NOT NULL
      AND ${alias}.release_at <= NOW()
    )
  )
`;
}

function effectiveReleaseStatusExpression(alias = 's') {
  return `
    CASE
      WHEN ${alias}.release_at IS NOT NULL
        AND ${alias}.release_at > NOW()
      THEN 'scheduled'
      WHEN ${alias}.release_status = 'scheduled'
        AND ${alias}.release_at IS NOT NULL
        AND ${alias}.release_at <= NOW()
      THEN 'published'
      ELSE ${alias}.release_status
    END
  `;
}

const VALID_RELEASE_STATUSES = new Set(['draft', 'scheduled', 'published', 'hidden']);

function normalizeReleaseStatus(value, fallback = 'draft') {
  const status = String(value || '').trim().toLowerCase();
  return VALID_RELEASE_STATUSES.has(status) ? status : fallback;
}

function normalizeDateTimeInput(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeReleasePayload(body = {}, options = {}) {
  const fallback = options.defaultStatus || 'draft';
  const nowSql = options.nowSql || 'NOW()';
  const isCreate = options.isCreate !== false;
  const rawStatus = body.release_status ?? body.releaseStatus;
  const releaseStatus = normalizeReleaseStatus(rawStatus, fallback);
  const releaseAt = normalizeDateTimeInput(body.release_at ?? body.releaseAt);

  if (releaseStatus === 'scheduled') {
    if (!releaseAt) {
      const err = new Error('release_at la bat buoc khi len lich phat hanh');
      err.statusCode = 400;
      throw err;
    }
    if (isCreate && new Date(releaseAt).getTime() <= Date.now()) {
      const err = new Error('release_at phai la thoi diem tuong lai khi len lich moi');
      err.statusCode = 400;
      throw err;
    }
    return {
      release_status: releaseStatus,
      release_at: releaseAt,
      published_at: null,
    };
  }

  if (releaseStatus === 'published') {
    return {
      release_status: releaseStatus,
      release_at: releaseAt || { raw: nowSql },
      published_at: { raw: isCreate ? nowSql : 'COALESCE(published_at, NOW())' },
    };
  }

  if (releaseStatus === 'draft') {
    return {
      release_status: releaseStatus,
      release_at: releaseAt,
      published_at: null,
    };
  }

  return {
    release_status: releaseStatus,
    release_at: releaseAt,
    published_at: undefined,
  };
}

function pushReleaseFields(fields, values, releasePayload, availableColumns) {
  if (!availableColumns || availableColumns.has('release_status')) {
    fields.push('release_status');
    values.push(releasePayload.release_status);
  }
  if (!availableColumns || availableColumns.has('release_at')) {
    fields.push('release_at');
    values.push(releasePayload.release_at && releasePayload.release_at.raw ? releasePayload.release_at : releasePayload.release_at);
  }
  if ((!availableColumns || availableColumns.has('published_at')) && releasePayload.published_at !== undefined) {
    fields.push('published_at');
    values.push(releasePayload.published_at);
  }
}

function buildSetClausesFromFields(fields, values) {
  const params = [];
  const clauses = fields.map((field, index) => {
    const value = values[index];
    if (value && typeof value === 'object' && value.raw) {
      return `\`${field}\` = ${value.raw}`;
    }
    params.push(value);
    return `\`${field}\` = ?`;
  });
  return { clauses, params };
}

function buildInsertParts(fields, values) {
  const params = [];
  const placeholders = values.map(value => {
    if (value && typeof value === 'object' && value.raw) return value.raw;
    params.push(value);
    return '?';
  });
  return {
    columnSql: fields.map(field => `\`${field}\``).join(', '),
    placeholderSql: placeholders.join(', '),
    params,
  };
}

module.exports = {
  publicSongCondition,
  publicAlbumCondition,
  effectiveReleaseStatusExpression,
  normalizeReleaseStatus,
  normalizeDateTimeInput,
  normalizeReleasePayload,
  pushReleaseFields,
  buildSetClausesFromFields,
  buildInsertParts,
};
