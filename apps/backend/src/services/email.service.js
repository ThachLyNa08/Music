function getSmtpConfig() {
  return {
    host: String(process.env.SMTP_HOST || '').trim(),
    port: Number(process.env.SMTP_PORT || 0),
    secure:
      String(process.env.SMTP_SECURE || 'false')
        .trim()
        .toLowerCase() === 'true',
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || '')
      .replace(/\s+/g, ''),
    fromName: String(
      process.env.SMTP_FROM_NAME || 'MusicFlow'
    ).trim(),
    fromEmail: String(
      process.env.SMTP_FROM_EMAIL || ''
    ).trim()
  }
}

function isSmtpConfigured() {
  const config = getSmtpConfig()

  return Boolean(
    config.host &&
    Number.isInteger(config.port) &&
    config.port > 0 &&
    config.user &&
    config.pass &&
    config.fromEmail
  )
}

function createTransporter() {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      const err = new Error('nodemailer_not_installed');
      err.code = 'NODEMAILER_NOT_INSTALLED';
      throw err;
    }
    throw error;
  }

  const config = getSmtpConfig()

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  })
}

async function sendMail({ to, subject, html, text }) {
  if (!isSmtpConfigured()) {
    return {
      deliveryMode: 'manual',
      deliveryStatus: 'manual_required',
      deliveryReason: 'not_configured'
    }
  }

  try {
    const config = getSmtpConfig()
    const transporter = createTransporter()

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
      text
    })

    return {
      deliveryMode: 'email',
      deliveryStatus: 'sent',
      deliveryReason: null,
      sentAt: new Date(),
      messageId: info.messageId
    }
  } catch (error) {
    if (error.code !== 'NODEMAILER_NOT_INSTALLED') {
      console.error('[SMTP SEND FAILED]', {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        message: error.message
      })
    }

    return {
      deliveryMode: 'manual',
      deliveryStatus: error.code === 'NODEMAILER_NOT_INSTALLED' ? 'manual_required' : 'failed',
      deliveryReason: error.code === 'NODEMAILER_NOT_INSTALLED' ? 'not_configured' : 'send_failed'
    }
  }
}

module.exports = {
  getSmtpConfig,
  isSmtpConfigured,
  createTransporter,
  sendMail
}
