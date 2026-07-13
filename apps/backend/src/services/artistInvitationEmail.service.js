const { sendMail } = require('./email.service');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildArtistInvitationEmail({ artistName, email, activationUrl, expiresAt }) {
  const safeName = escapeHtml(artistName);
  const safeEmail = escapeHtml(email);
  const expiresText = new Date(expiresAt).toLocaleString('vi-VN');

  const subject = 'Kich hoat tai khoan MusicFlow Artist Studio';
  const text = [
    `Xin chao ${artistName},`,
    '',
    'Ban da duoc cap quyen truy cap MusicFlow Artist Studio.',
    `Email dang nhap: ${email}`,
    `Lien ket kich hoat: ${activationUrl}`,
    `Lien ket het han luc: ${expiresText}`,
    '',
    'Neu ban khong phai nguoi nhan, vui long bo qua email nay.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>MusicFlow Artist Studio</h2>
      <p>Xin chao <strong>${safeName}</strong>,</p>
      <p>Ban da duoc cap quyen truy cap Artist Studio.</p>
      <p>Email dang nhap: <strong>${safeEmail}</strong></p>
      <p>
        <a href="${escapeHtml(activationUrl)}"
           style="display:inline-block;background:#16a34a;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
          Kich hoat tai khoan
        </a>
      </p>
      <p>Lien ket het han luc: <strong>${escapeHtml(expiresText)}</strong></p>
      <p style="color:#6b7280;font-size:13px">Neu ban khong phai nguoi nhan, vui long bo qua email nay.</p>
    </div>
  `;

  return { subject, text, html };
}

async function sendArtistInvitationEmail(payload) {
  const mail = buildArtistInvitationEmail(payload);
  return sendMail({
    to: payload.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

module.exports = { sendArtistInvitationEmail, buildArtistInvitationEmail };
