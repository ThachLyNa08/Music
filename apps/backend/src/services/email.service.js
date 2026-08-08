const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const { ensureSystemEmailAppealSchema } = require('./systemEmailAppealSchema.service');

const SYSTEM_EMAIL_TYPES = new Set([
  'welcome',
  'premium_success',
  'account_locked',
  'appeal_received',
  'appeal_resolved',
]);

function envValue(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function normalizeBool(value) {
  return String(value || 'false').trim().toLowerCase() === 'true';
}

function getSmtpConfig() {
  const user = envValue('MAIL_USER', process.env.SMTP_USER || '');
  return {
    host: envValue('MAIL_HOST', process.env.SMTP_HOST || ''),
    port: Number(envValue('MAIL_PORT', process.env.SMTP_PORT || 587)),
    secure: normalizeBool(envValue('MAIL_SECURE', process.env.SMTP_SECURE || 'false')),
    user,
    pass: String(process.env.MAIL_PASS ?? process.env.SMTP_PASS ?? '').replace(/\s+/g, ''),
    fromName: envValue('MAIL_FROM_NAME', process.env.SMTP_FROM_NAME || 'MusicFlow'),
    fromEmail: envValue('MAIL_FROM_EMAIL', process.env.SMTP_FROM_EMAIL || user),
  };
}

function isMailEnabled() {
  return normalizeBool(process.env.MAIL_ENABLED ?? process.env.SMTP_ENABLED);
}

function isSmtpConfigured() {
  const config = getSmtpConfig();
  return Boolean(
    config.host &&
    Number.isInteger(config.port) &&
    config.port > 0 &&
    config.user &&
    config.pass &&
    config.fromEmail
  );
}

function createTransporter() {
  const config = getSmtpConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

function safeJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

async function logSystemEmail({ to, subject, type, userId = null, metadata = null, status, errorMessage = null }) {
  try {
    await ensureSystemEmailAppealSchema();
    await pool.query(
      `INSERT INTO email_logs (user_id, recipient_email, email_type, subject, status, error_message, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, to, type, subject, status, errorMessage, safeJson(metadata)]
    );
  } catch (error) {
    console.error('[EMAIL_LOG_FAILED]', {
      type,
      status,
      message: error.message,
    });
  }
}

async function hasSystemEmailLog({ type, metadataKey, metadataValue, status = 'sent' }) {
  if (!type || !metadataKey || metadataValue == null) return false;

  try {
    await ensureSystemEmailAppealSchema();
    const path = `$.${metadataKey}`;
    const [rows] = await pool.query(
      `SELECT id
       FROM email_logs
       WHERE email_type = ?
         AND status = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, ?)) = ?
       LIMIT 1`,
      [type, status, path, String(metadataValue)]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('[EMAIL_DUPLICATE_CHECK_FAILED]', {
      type,
      metadataKey,
      message: error.message,
    });
    return false;
  }
}

async function sendSystemEmail({ to, subject, html, text, type, userId = null, metadata = null }) {
  const emailType = SYSTEM_EMAIL_TYPES.has(type) ? type : 'system';
  const recipient = String(to || '').trim();
  const safeSubject = String(subject || '').trim();

  if (!recipient || !safeSubject) {
    await logSystemEmail({
      to: recipient || 'unknown',
      subject: safeSubject || '(no subject)',
      type: emailType,
      userId,
      metadata,
      status: 'failed',
      errorMessage: 'missing_recipient_or_subject',
    });
    return { success: false, status: 'failed', reason: 'missing_recipient_or_subject' };
  }

  if (!isMailEnabled()) {
    console.log('[EMAIL_SKIPPED]', {
      to: recipient,
      subject: safeSubject,
      type: emailType,
      userId,
      metadata,
      text,
    });
    await logSystemEmail({
      to: recipient,
      subject: safeSubject,
      type: emailType,
      userId,
      metadata,
      status: 'skipped',
    });
    return { success: true, status: 'skipped', reason: 'mail_disabled' };
  }

  if (!isSmtpConfigured()) {
    await logSystemEmail({
      to: recipient,
      subject: safeSubject,
      type: emailType,
      userId,
      metadata,
      status: 'failed',
      errorMessage: 'smtp_not_configured',
    });
    return { success: false, status: 'failed', reason: 'smtp_not_configured' };
  }

  try {
    const config = getSmtpConfig();
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipient,
      subject: safeSubject,
      html: html ? '<!doctype html><html><head><meta charset="UTF-8"></head><body>' + html + '</body></html>' : undefined,
      text,
      headers: {
        'Content-Language': 'vi',
      },
    });

    await logSystemEmail({
      to: recipient,
      subject: safeSubject,
      type: emailType,
      userId,
      metadata: { ...(metadata || {}), messageId: info.messageId },
      status: 'sent',
    });

    return { success: true, status: 'sent', messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL_SEND_FAILED]', {
      type: emailType,
      to: recipient,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });

    await logSystemEmail({
      to: recipient,
      subject: safeSubject,
      type: emailType,
      userId,
      metadata,
      status: 'failed',
      errorMessage: error.message,
    });

    return { success: false, status: 'failed', reason: 'send_failed' };
  }
}

async function sendMail({ to, subject, html, text }) {
  const result = await sendSystemEmail({
    to,
    subject,
    html,
    text,
    type: 'system',
    metadata: { source: 'legacy_sendMail' },
  });

  return {
    deliveryMode: result.status === 'sent' ? 'email' : 'manual',
    deliveryStatus: result.status === 'sent' ? 'sent' : result.status === 'failed' ? 'failed' : 'manual_required',
    deliveryReason: result.reason || null,
    sentAt: result.status === 'sent' ? new Date() : undefined,
    messageId: result.messageId,
  };
}

module.exports = {
  getSmtpConfig,
  isMailEnabled,
  isSmtpConfigured,
  createTransporter,
  sendMail,
  sendSystemEmail,
  hasSystemEmailLog,
};
