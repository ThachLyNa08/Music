const crypto = require('crypto');
const path = require('path');
const { pool } = require('../config/database');
const { sendSystemEmail } = require('../services/email.service');
const { ensureSystemEmailAppealSchema } = require('../services/systemEmailAppealSchema.service');
const { appealReceivedEmail } = require('../services/systemEmailTemplates.service');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function uploadedFileUrl(file) {
  if (!file?.path) return null;
  const relativePath = path.relative(path.join(__dirname, '..', '..', 'uploads'), file.path);
  return '/uploads/' + relativePath.split(path.sep).join('/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

    const [users] = await conn.query(
      `SELECT id, email, display_name, status, lock_appeal_allowed, lock_appeal_token_expires_at
       FROM users
       WHERE lock_appeal_token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [hashToken(token)]
    );

    if (!users.length) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'INVALID_APPEAL_TOKEN',
        message: 'Liên kết khiếu nại không hợp lệ hoặc đã hết hạn.',
      });
    }

    const user = users[0];
    const expiresAt = user.lock_appeal_token_expires_at ? new Date(user.lock_appeal_token_expires_at) : null;
    if (user.status !== 'locked' || Number(user.lock_appeal_allowed) !== 1 || !expiresAt || expiresAt <= new Date()) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        code: 'INVALID_APPEAL_TOKEN',
        message: 'Liên kết khiếu nại không hợp lệ hoặc đã hết hạn.',
      });
    }

    const [pending] = await conn.query(
      `SELECT id
       FROM account_lock_appeals
       WHERE user_id = ? AND status IN ('pending', 'reviewing')
       LIMIT 1`,
      [user.id]
    );
    if (pending.length) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        code: 'APPEAL_ALREADY_PENDING',
        message: 'Khiếu nại của bạn đang chờ xử lý.',
      });
    }

    const [result] = await conn.query(
      `INSERT INTO account_lock_appeals (user_id, email, reason, evidence_image_url, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user.id, user.email, reason, evidenceImageUrl]
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

