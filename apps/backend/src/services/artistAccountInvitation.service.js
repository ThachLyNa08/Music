const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { sendArtistInvitationEmail } = require('./artistInvitationEmail.service');

const DEFAULT_EXPIRES_HOURS = 24;

class ArtistInvitationError extends Error {
  constructor(message, statusCode = 400, code = 'artist_invitation_error') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertValidEmail(email) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ArtistInvitationError('Email khong hop le', 400, 'invalid_email');
  }
  return normalized;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getExpiresAt() {
  const hours = Number(process.env.ARTIST_INVITATION_EXPIRES_HOURS || DEFAULT_EXPIRES_HOURS);
  return new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
}

function buildActivationUrl(rawToken) {
  return `${getFrontendUrl()}/artist/activate?token=${encodeURIComponent(rawToken)}`;
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email;
  const visible = name.length <= 2 ? name[0] : `${name[0]}${name[name.length - 1]}`;
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

function toInvitationDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    artistId: row.artist_id,
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    activatedAt: row.activated_at,
    revokedAt: row.revoked_at,
    deliveryMethod: row.delivery_method,
    deliveryStatus: row.delivery_status,
  };
}

async function revokePendingForArtist(conn, artistId) {
  await conn.query(
    `UPDATE artist_account_invitations
     SET status = 'revoked', revoked_at = NOW()
     WHERE artist_id = ? AND status = 'pending'`,
    [artistId]
  );
}

async function createInvitation({ artistId, email, adminId }) {
  const normalizedEmail = assertValidEmail(email);
  const conn = await pool.getConnection();
  let insertedId;
  let rawToken;
  let activationUrl;
  let artistName;
  let expiresAt;

  try {
    await conn.beginTransaction();

    const [artists] = await conn.query('SELECT id, name, user_id FROM artists WHERE id = ? FOR UPDATE', [artistId]);
    if (!artists.length) {
      throw new ArtistInvitationError('Nghe si khong ton tai', 404, 'artist_not_found');
    }
    if (artists[0].user_id) {
      throw new ArtistInvitationError('Nghe si nay da co tai khoan', 409, 'artist_already_linked');
    }
    artistName = artists[0].name;

    const [users] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (users.length) {
      throw new ArtistInvitationError('Email da duoc su dung boi tai khoan khac', 409, 'email_exists');
    }

    await revokePendingForArtist(conn, artistId);

    rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    expiresAt = getExpiresAt();
    activationUrl = buildActivationUrl(rawToken);

    const [result] = await conn.query(
      `INSERT INTO artist_account_invitations
       (artist_id, email, token_hash, status, expires_at, created_by_admin_id, delivery_method, delivery_status)
       VALUES (?, ?, ?, 'pending', ?, ?, 'email', 'pending')`,
      [artistId, normalizedEmail, tokenHash, expiresAt, adminId || null]
    );
    insertedId = result.insertId;

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const delivery = await sendArtistInvitationEmail({
    artistName,
    email: normalizedEmail,
    activationUrl,
    expiresAt,
  });

  const deliveryMethod = delivery.deliveryMode;
  const deliveryStatus = delivery.deliveryStatus;
  const deliveryError = delivery.deliveryReason;

  await pool.query(
    `UPDATE artist_account_invitations
     SET delivery_method = ?, delivery_status = ?, delivery_error = ?, sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
     WHERE id = ?`,
    [deliveryMethod, deliveryStatus, deliveryError, deliveryStatus, insertedId]
  );

  const [rows] = await pool.query('SELECT * FROM artist_account_invitations WHERE id = ?', [insertedId]);
  return {
    deliveryMode: deliveryMethod,
    deliveryReason: deliveryError,
    activationUrl: deliveryMethod === 'manual' ? activationUrl : undefined,
    invitation: toInvitationDto(rows[0]),
  };
}

async function verifyInvitation(rawToken) {
  if (!rawToken) {
    throw new ArtistInvitationError('Token kich hoat khong hop le', 400, 'invalid_token');
  }
  const tokenHash = hashToken(rawToken);
  const [rows] = await pool.query(
    `SELECT i.*, a.name AS artist_name
     FROM artist_account_invitations i
     JOIN artists a ON a.id = i.artist_id
     WHERE i.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) {
    throw new ArtistInvitationError('Lien ket kich hoat khong hop le', 404, 'invalid_token');
  }

  const invitation = rows[0];
  if (invitation.status === 'pending' && new Date(invitation.expires_at) <= new Date()) {
    await pool.query(
      "UPDATE artist_account_invitations SET status = 'expired' WHERE id = ? AND status = 'pending'",
      [invitation.id]
    );
    invitation.status = 'expired';
  }

  if (invitation.status !== 'pending') {
    throw new ArtistInvitationError(
      invitation.status === 'expired'
        ? 'Lien ket kich hoat da het han'
        : invitation.status === 'revoked'
          ? 'Lien ket kich hoat da bi thu hoi'
          : 'Lien ket kich hoat da duoc su dung',
      410,
      `invitation_${invitation.status}`
    );
  }

  return {
    artistName: invitation.artist_name,
    email: invitation.email,
    maskedEmail: maskEmail(invitation.email),
    expiresAt: invitation.expires_at,
  };
}

async function activateInvitation({ token, password, confirmPassword }) {
  if (!password || String(password).length < 6) {
    throw new ArtistInvitationError('Mat khau toi thieu 6 ky tu', 400, 'weak_password');
  }
  if (password !== confirmPassword) {
    throw new ArtistInvitationError('Mat khau xac nhan khong khop', 400, 'password_mismatch');
  }

  const tokenHash = hashToken(token || '');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT i.*, a.name AS artist_name, a.user_id
       FROM artist_account_invitations i
       JOIN artists a ON a.id = i.artist_id
       WHERE i.token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );
    if (!rows.length) {
      throw new ArtistInvitationError('Lien ket kich hoat khong hop le', 404, 'invalid_token');
    }

    const invitation = rows[0];
    if (invitation.status !== 'pending') {
      throw new ArtistInvitationError('Lien ket kich hoat khong con hieu luc', 410, `invitation_${invitation.status}`);
    }
    if (new Date(invitation.expires_at) <= new Date()) {
      await conn.query("UPDATE artist_account_invitations SET status = 'expired' WHERE id = ?", [invitation.id]);
      throw new ArtistInvitationError('Lien ket kich hoat da het han', 410, 'invitation_expired');
    }
    if (invitation.user_id) {
      throw new ArtistInvitationError('Nghe si nay da co tai khoan', 409, 'artist_already_linked');
    }

    const [users] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE', [invitation.email]);
    if (users.length) {
      throw new ArtistInvitationError('Email da duoc su dung boi tai khoan khac', 409, 'email_exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [userResult] = await conn.query(
      `INSERT INTO users (email, password_hash, display_name, role, status)
       VALUES (?, ?, ?, 'artist', 'active')`,
      [invitation.email, passwordHash, invitation.artist_name]
    );

    await conn.query('UPDATE artists SET user_id = ? WHERE id = ? AND user_id IS NULL', [userResult.insertId, invitation.artist_id]);
    await conn.query(
      `UPDATE artist_account_invitations
       SET status = 'activated', activated_at = NOW()
       WHERE id = ?`,
      [invitation.id]
    );

    await conn.commit();
    return { redirectTo: '/artist/login' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function resendInvitation({ artistId, adminId }) {
  const [rows] = await pool.query(
    `SELECT email FROM artist_account_invitations
     WHERE artist_id = ? AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [artistId]
  );
  if (!rows.length) {
    throw new ArtistInvitationError('Khong co loi moi dang cho kich hoat de gui lai', 404, 'pending_invitation_not_found');
  }
  return createInvitation({ artistId, email: rows[0].email, adminId });
}

async function revokeInvitation({ artistId }) {
  const [result] = await pool.query(
    `UPDATE artist_account_invitations
     SET status = 'revoked', revoked_at = NOW()
     WHERE artist_id = ? AND status = 'pending'`,
    [artistId]
  );
  if (result.affectedRows === 0) {
    throw new ArtistInvitationError('Khong co loi moi dang cho kich hoat de thu hoi', 404, 'pending_invitation_not_found');
  }
  return { revoked: true };
}

async function getAccountStatus(artistId) {
  const [artists] = await pool.query(
    `SELECT a.id, a.name, a.user_id, u.status AS user_status
     FROM artists a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.id = ?`,
    [artistId]
  );
  if (!artists.length) {
    throw new ArtistInvitationError('Nghe si khong ton tai', 404, 'artist_not_found');
  }
  if (artists[0].user_id) {
    return {
      accountStatus: artists[0].user_status === 'locked' ? 'locked' : 'active',
      artistId: artists[0].id,
      artistName: artists[0].name,
      userId: artists[0].user_id,
    };
  }

  const [invitations] = await pool.query(
    `SELECT *
     FROM artist_account_invitations
     WHERE artist_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [artistId]
  );
  if (!invitations.length) {
    return { accountStatus: 'not_issued', artistId: artists[0].id, artistName: artists[0].name };
  }

  const invitation = invitations[0];
  let status = invitation.status;
  if (status === 'pending' && new Date(invitation.expires_at) <= new Date()) {
    await pool.query("UPDATE artist_account_invitations SET status = 'expired' WHERE id = ? AND status = 'pending'", [invitation.id]);
    status = 'expired';
  }

  const map = {
    pending: 'pending_activation',
    activated: 'active',
    revoked: 'revoked',
    expired: 'expired',
  };
  return {
    accountStatus: map[status] || 'not_issued',
    artistId: artists[0].id,
    artistName: artists[0].name,
    invitation: toInvitationDto({ ...invitation, status }),
  };
}

module.exports = {
  ArtistInvitationError,
  createInvitation,
  verifyInvitation,
  activateInvitation,
  resendInvitation,
  revokeInvitation,
  getAccountStatus,
};
