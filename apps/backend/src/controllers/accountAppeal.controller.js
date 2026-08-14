const crypto = require('crypto');
const path = require('path');
const { pool } = require('../config/database');
const { sendSystemEmail } = require('../services/email.service');
const { ensureSystemEmailAppealSchema } = require('../services/systemEmailAppealSchema.service');
const { appealReceivedEmail } = require('../services/systemEmailTemplates.service');

const INVALID_APPEAL_RESPONSE = {
  success: false,
  code: 'INVALID_APPEAL_TOKEN',
  message: 'Liên kết khiếu nại không hợp lệ hoặc đã hết hạn.',
};

const ALREADY_APPEALED_RESPONSE = {
  success: false,
  code: 'APPEAL_ALREADY_SUBMITTED',
  message: 'Bạn đã gửi khiếu nại cho lần khóa tài khoản này. Vui lòng chờ quản trị viên xử lý.',
};

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function uploadedFileUrl(file) {
  if (!file?.path) return null;
  const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), file.path);
  return '/uploads/' + relativePath.split(path.sep).join('/');
}

async function findUserByAppealToken(conn, token, lockForUpdate = false) {
  const [users] = await conn.query(
    `SELECT id, email, display_name, status, locked_at, lock_appeal_allowed, lock_appeal_token_expires_at
     FROM users
     WHERE lock_appeal_token_hash = ?
     LIMIT 1
     ${lockForUpdate ? 'FOR UPDATE' : ''}`,
    [hashToken(token)]
  );

  return users[0] || null;
}

function isAppealTokenUsable(user) {
  const expiresAt = user?.lock_appeal_token_expires_at ? new Date(user.lock_appeal_token_expires_at) : null;
  return Boolean(
    user &&
    user.status === 'locked' &&
    Number(user.lock_appeal_allowed) === 1 &&
    expiresAt &&
    expiresAt > new Date()
  );
}

async function findCurrentLockAppeal(conn, userId, lockedAt) {
  const [appeals] = await conn.query(
    `SELECT id, status, created_at
     FROM account_lock_appeals
     WHERE user_id = ?
       AND (? IS NULL OR created_at >= ?)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, lockedAt || null, lockedAt || null]
  );

  return appeals[0] || null;
}

exports.getLockAppealStatus = async (req, res, next) => {
  try {
    await ensureSystemEmailAppealSchema();
    const token = String(req.query?.token || '').trim();

    if (!token) {
      return res.status(400).json(INVALID_APPEAL_RESPONSE);
    }

    const user = await findUserByAppealToken(pool, token);
    if (!user) {
      return res.status(400).json(INVALID_APPEAL_RESPONSE);
    }

    const existingAppeal = await findCurrentLockAppeal(pool, user.id, user.locked_at);
    if (existingAppeal) {
      return res.status(409).json({
        ...ALREADY_APPEALED_RESPONSE,
        data: {
          appeal_status: existingAppeal.status,
          appeal_created_at: existingAppeal.created_at,
        },
      });
    }

    if (!isAppealTokenUsable(user)) {
      return res.status(400).json(INVALID_APPEAL_RESPONSE);
    }

    return res.json({
      success: true,
      data: {
        email: user.email,
        display_name: user.display_name,
        locked_at: user.locked_at,
        appeal_token_expires_at: user.lock_appeal_token_expires_at,
      },
    });
  } catch (error) {
    console.error('getLockAppealStatus Error:', error);
    next(error);
  }
};

exports.submitLockAppeal = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureSystemEmailAppealSchema();
    const token = String(req.body?.token || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const evidenceImageUrl = uploadedFileUrl(req.file);

    if (!token || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin khiếu nại.',
      });
    }

    if (reason.length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Lý do khiếu nại cần có ít nhất 20 ký tự.',
      });
    }

    await conn.beginTransaction();

    const user = await findUserByAppealToken(conn, token, true);
    if (!user) {
      await conn.rollback();
      return res.status(400).json(INVALID_APPEAL_RESPONSE);
    }

    const existingAppeal = await findCurrentLockAppeal(conn, user.id, user.locked_at);
    if (existingAppeal) {
      await conn.rollback();
      return res.status(409).json(ALREADY_APPEALED_RESPONSE);
    }

    if (!isAppealTokenUsable(user)) {
      await conn.rollback();
      return res.status(400).json(INVALID_APPEAL_RESPONSE);
    }

    const [result] = await conn.query(
      `INSERT INTO account_lock_appeals (user_id, email, reason, evidence_image_url, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user.id, user.email, reason, evidenceImageUrl]
    );

    await conn.query(
      `UPDATE users
       SET lock_appeal_allowed = 0
       WHERE id = ?`,
      [user.id]
    );

    await conn.commit();

    if (user.email) {
      const email = appealReceivedEmail({ name: user.display_name || user.email });
      await sendSystemEmail({
        to: user.email,
        subject: email.subject,
        type: 'appeal_received',
        userId: user.id,
        metadata: { appeal_id: result.insertId, has_evidence: Boolean(evidenceImageUrl) },
        text: email.text,
        html: email.html,
      });
    }

    res.json({
      success: true,
      message: 'Khiếu nại của bạn đã được gửi. MusicFlow sẽ xem xét trong thời gian sớm nhất.',
    });
  } catch (error) {
    try { await conn.rollback(); } catch {}
    console.error('submitLockAppeal Error:', error);
    next(error);
  } finally {
    conn.release();
  }
};
