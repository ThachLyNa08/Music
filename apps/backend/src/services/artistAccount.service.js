const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

class ArtistAccountError extends Error {
  constructor(message, statusCode = 400, code = 'artist_account_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getTempPassword() {
  const password = process.env.ARTIST_DEFAULT_TEMP_PASSWORD;
  if (!password) {
    throw new ArtistAccountError('Chua cau hinh ARTIST_DEFAULT_TEMP_PASSWORD', 500, 'missing_temp_password_config');
  }
  if (String(password).length < 6) {
    throw new ArtistAccountError('ARTIST_DEFAULT_TEMP_PASSWORD phai co it nhat 6 ky tu', 500, 'weak_temp_password_config');
  }
  return password;
}

function getAccountDomain() {
  return String(process.env.ARTIST_ACCOUNT_DOMAIN || 'artist.musicflow.local').trim().toLowerCase();
}

async function ensureArtistAccountSchema(conn) {
  const [rows] = await conn.query('SHOW COLUMNS FROM users');
  const columns = new Set(rows.map(row => row.Field));
  if (!columns.has('must_change_password') || !columns.has('account_source')) {
    throw new ArtistAccountError(
      'Chua chay migration artist_direct_accounts: thieu users.must_change_password hoac users.account_source',
      500,
      'artist_account_schema_missing'
    );
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ArtistAccountError('Email khong hop le', 400, 'invalid_email');
  }
  return normalized;
}

function stripVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function slugifyArtistName(name) {
  const slug = stripVietnamese(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'artist';
}

function generatedEmailForArtist(name, suffix = null) {
  const base = slugifyArtistName(name);
  const local = suffix ? `${base}-${suffix}` : base;
  return `${local}@${getAccountDomain()}`;
}

async function emailExists(conn, email) {
  const [rows] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  return rows.length > 0;
}

async function resolveGeneratedEmail(conn, artistName) {
  let suffix = null;
  let email = generatedEmailForArtist(artistName, suffix);
  let index = 2;
  while (await emailExists(conn, email)) {
    suffix = index;
    email = generatedEmailForArtist(artistName, suffix);
    index += 1;
  }
  return email;
}

function accountDto({ artist, userId, email, status = 'active' }) {
  return {
    artistId: artist.id,
    artistName: artist.name,
    userId,
    email,
    mustChangePassword: true,
    status,
  };
}

async function insertArtistUser(conn, artist, email) {
  await ensureArtistAccountSchema(conn);
  const passwordHash = await bcrypt.hash(getTempPassword(), 12);
  const [result] = await conn.query(
    `INSERT INTO users (email, password_hash, display_name, role, status, must_change_password, account_source)
     VALUES (?, ?, ?, 'artist', 'active', 1, 'admin_created')`,
    [email, passwordHash, artist.name]
  );
  await conn.query('UPDATE artists SET user_id = ? WHERE id = ? AND user_id IS NULL', [result.insertId, artist.id]);
  return result.insertId;
}

async function createArtistAccount({ artistId, email }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [artists] = await conn.query('SELECT id, name, user_id FROM artists WHERE id = ? FOR UPDATE', [artistId]);
    if (!artists.length) throw new ArtistAccountError('Nghe si khong ton tai', 404, 'artist_not_found');
    const artist = artists[0];
    if (artist.user_id) throw new ArtistAccountError('Nghe si da co tai khoan Artist Studio.', 409, 'artist_account_exists');

    const manualEmail = Boolean(String(email || '').trim());
    const finalEmail = manualEmail ? assertValidEmail(email) : await resolveGeneratedEmail(conn, artist.name);
    if (manualEmail && await emailExists(conn, finalEmail)) {
      throw new ArtistAccountError('Email da duoc su dung boi tai khoan khac', 409, 'email_exists');
    }

    const userId = await insertArtistUser(conn, artist, finalEmail);
    await conn.commit();
    return accountDto({ artist, userId, email: finalEmail });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function bulkCreateArtistAccounts({ artistIds, createFor }) {
  let targetRows = [];
  if (createFor === 'all_missing') {
    const [rows] = await pool.query('SELECT id, name, user_id FROM artists WHERE user_id IS NULL ORDER BY id ASC');
    targetRows = rows;
  } else if (Array.isArray(artistIds) && artistIds.length > 0) {
    const ids = [...new Set(artistIds.map(Number).filter(Boolean))];
    if (!ids.length) throw new ArtistAccountError('artistIds khong hop le', 400, 'invalid_artist_ids');
    const [rows] = await pool.query('SELECT id, name, user_id FROM artists WHERE id IN (?) ORDER BY id ASC', [ids]);
    const found = new Map(rows.map(row => [Number(row.id), row]));
    targetRows = ids.map(id => found.get(id)).filter(Boolean);
  } else {
    throw new ArtistAccountError('Can truyen artistIds hoac createFor=all_missing', 400, 'invalid_bulk_request');
  }

  const items = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const artist of targetRows) {
    if (artist.user_id) {
      skipped += 1;
      items.push({ artistId: artist.id, artistName: artist.name, status: 'skipped', reason: 'already_has_account' });
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [lockedRows] = await conn.query('SELECT id, name, user_id FROM artists WHERE id = ? FOR UPDATE', [artist.id]);
      const lockedArtist = lockedRows[0];
      if (!lockedArtist || lockedArtist.user_id) {
        skipped += 1;
        await conn.rollback();
        items.push({ artistId: artist.id, artistName: artist.name, status: 'skipped', reason: 'already_has_account' });
        continue;
      }
      const email = await resolveGeneratedEmail(conn, lockedArtist.name);
      const userId = await insertArtistUser(conn, lockedArtist, email);
      await conn.commit();
      created += 1;
      items.push({ artistId: lockedArtist.id, artistName: lockedArtist.name, userId, email, status: 'created' });
    } catch (error) {
      await conn.rollback();
      failed += 1;
      items.push({ artistId: artist.id, artistName: artist.name, status: 'failed', reason: error.message });
    } finally {
      conn.release();
    }
  }

  return { created, skipped, failed, items };
}

async function resetTempPassword({ artistId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensureArtistAccountSchema(conn);
    const [artists] = await conn.query(
      `SELECT a.id, a.name, a.user_id, u.email
       FROM artists a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = ? AND u.role = 'artist'
       FOR UPDATE`,
      [artistId]
    );
    if (!artists.length) throw new ArtistAccountError('Nghe si chua co tai khoan Artist Studio', 404, 'artist_account_not_found');
    const passwordHash = await bcrypt.hash(getTempPassword(), 12);
    await conn.query(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
      [passwordHash, artists[0].user_id]
    );
    await conn.commit();
    return accountDto({ artist: artists[0], userId: artists[0].user_id, email: artists[0].email });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateArtistAccountStatus({ artistId, status }) {
  if (!['active', 'locked'].includes(status)) {
    throw new ArtistAccountError('Trang thai tai khoan khong hop le', 400, 'invalid_status');
  }
  const [artists] = await pool.query(
    `SELECT a.id, a.name, a.user_id, u.email
     FROM artists a
     JOIN users u ON u.id = a.user_id
     WHERE a.id = ? AND u.role = 'artist'
     LIMIT 1`,
    [artistId]
  );
  if (!artists.length) throw new ArtistAccountError('Nghe si chua co tai khoan Artist Studio', 404, 'artist_account_not_found');
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, artists[0].user_id]);
  return { artistId: artists[0].id, artistName: artists[0].name, userId: artists[0].user_id, email: artists[0].email, status };
}

async function getAccountStatus(artistId) {
  const [userColumnRows] = await pool.query('SHOW COLUMNS FROM users');
  const userColumns = new Set(userColumnRows.map(row => row.Field));
  const hasMustChangePassword = userColumns.has('must_change_password');
  const [rows] = await pool.query(
    `SELECT a.id, a.name, a.user_id, u.email, u.status,
            ${hasMustChangePassword ? 'u.must_change_password' : '0 AS must_change_password'}
     FROM artists a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.id = ?
     LIMIT 1`,
    [artistId]
  );
  if (!rows.length) throw new ArtistAccountError('Nghe si khong ton tai', 404, 'artist_not_found');
  const row = rows[0];
  let accountStatus = 'not_issued';
  if (row.user_id) {
    if (row.status === 'locked') accountStatus = 'locked';
    else if (Number(row.must_change_password) === 1) accountStatus = 'temp_password';
    else accountStatus = 'active';
  }
  return {
    artistId: row.id,
    artistName: row.name,
    userId: row.user_id,
    email: row.email,
    accountStatus,
    mustChangePassword: Number(row.must_change_password || 0) === 1,
    status: row.status || null,
  };
}

module.exports = {
  ArtistAccountError,
  generatedEmailForArtist,
  createArtistAccount,
  bulkCreateArtistAccounts,
  resetTempPassword,
  updateArtistAccountStatus,
  getAccountStatus,
};
