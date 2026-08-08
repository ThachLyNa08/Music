function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function emailShell({ title, intro, badge = 'Thông báo từ hệ thống', subtitle = '', bodyHtml = '', cta = null, footer = null }) {
  const buttonHtml = cta
    ? `
      <tr>
        <td align="center" style="padding:0 40px 32px 40px;">
          <a href="${escapeHtml(cta.href)}"
             style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:16px 40px;border-radius:12px;box-shadow:0 10px 25px rgba(16,185,129,.35);">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>`
    : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background:#eef2ff;font-family:Inter,'Segoe UI',Arial,'Helvetica Neue',Helvetica,sans-serif;color:#1f2937;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.18);">
            <tr>
              <td align="center" style="padding:40px 40px 56px 40px;background:#10b981;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#ffffff;">
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 24px auto;">
                  <tr>
                    <td style="width:44px;height:44px;border-radius:12px;background:#ffffff;color:#059669;text-align:center;font-size:18px;font-weight:900;line-height:44px;box-shadow:0 4px 12px rgba(0,0,0,.15);">MF</td>
                    <td style="padding-left:10px;font-size:22px;line-height:1;font-weight:900;color:#ffffff;">MusicFlow</td>
                  </tr>
                </table>
                <div style="display:inline-block;margin-bottom:16px;padding:8px 20px;border-radius:999px;background:rgba(255,255,255,.20);border:1px solid rgba(255,255,255,.30);color:#ffffff;font-size:13px;font-weight:700;">
                  ${escapeHtml(badge)}
                </div>
                <div style="font-size:32px;line-height:1.15;font-weight:900;color:#ffffff;letter-spacing:-.5px;">${escapeHtml(title)}</div>
                ${subtitle ? `<div style="margin-top:10px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.88);">${escapeHtml(subtitle)}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:40px 40px 8px 40px;">
                <p style="margin:0 0 28px 0;font-size:15px;line-height:1.75;color:#4b5563;">${nl2br(intro)}</p>
                ${bodyHtml}
              </td>
            </tr>
            ${buttonHtml}
            <tr>
              <td style="padding:0 40px 32px 40px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:12px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0;font-size:14px;line-height:1.65;color:#92400e;">${nl2br(footer || 'Trân trọng,\nĐội ngũ MusicFlow')}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 34px 40px;">
                <p style="margin:0;padding-top:24px;border-top:1px solid #e5e7eb;font-size:14px;line-height:1.65;color:#6b7280;">
                  Trân trọng,<br>
                  <strong style="color:#1f2937;">Đội ngũ MusicFlow</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">MusicFlow — Email này được gửi tự động từ hệ thống. Vui lòng không phản hồi trực tiếp email này.</p>
                <p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
                  Trung tâm hỗ trợ &nbsp;•&nbsp; Chính sách bảo mật &nbsp;•&nbsp; MusicFlow
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function infoBox(rows) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 28px 0;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:16px;">
      <tr>
        <td colspan="2" style="padding:24px 28px 10px 28px;font-size:16px;font-weight:800;color:#065f46;">Thông tin chi tiết</td>
      </tr>
      ${rows.map(row => `
        <tr>
          <td style="padding:12px 28px;border-bottom:1px dashed #d1fae5;font-size:14px;font-weight:600;color:#6b7280;width:165px;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td style="padding:12px 28px;border-bottom:1px dashed #d1fae5;font-size:14px;line-height:1.6;color:#1f2937;font-weight:700;text-align:right;vertical-align:top;">${nl2br(row.value)}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function welcomeEmail({ name }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow xác nhận tài khoản của bạn đã được tạo thành công. Từ thời điểm này, bạn có thể đăng nhập để sử dụng các tính năng nghe nhạc, tạo playlist, lưu bài hát yêu thích và khám phá các gợi ý được cá nhân hóa.';
  const footer = 'Cảm ơn bạn đã lựa chọn MusicFlow. Chúng tôi rất vui được đồng hành cùng bạn trong hành trình trải nghiệm âm nhạc.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Chào mừng bạn đến với MusicFlow',
    text: `${intro}\n\n${footer}`,
    html: emailShell({
      title: 'Chào mừng đến MusicFlow',
      badge: 'Đăng ký thành công',
      subtitle: 'Tài khoản của bạn đã sẵn sàng để bắt đầu trải nghiệm âm nhạc',
      intro,
      footer,
    }),
  };
}

function premiumSuccessEmail({ name, planName, amount, orderCode, premiumExpiresAt }) {
  const expiry = premiumExpiresAt ? new Date(premiumExpiresAt).toLocaleString('vi-VN') : 'Chưa xác định';
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow xác nhận giao dịch thanh toán Premium của bạn đã được xử lý thành công. Quyền lợi Premium đã được cập nhật cho tài khoản của bạn theo thông tin bên dưới.';
  const footer = 'Bạn hiện có thể sử dụng các quyền lợi Premium trên MusicFlow. Nếu phát hiện thông tin giao dịch chưa chính xác, vui lòng liên hệ bộ phận hỗ trợ để được kiểm tra.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Thanh toán Premium thành công',
    text:
      `${intro}\n\n` +
      `Gói: ${planName}\n` +
      `Số tiền: ${amount}\n` +
      `Mã giao dịch: ${orderCode}\n` +
      `Hiệu lực đến: ${expiry}\n\n` +
      footer,
    html: emailShell({
      title: 'Premium đã được kích hoạt',
      badge: 'Thanh toán thành công',
      subtitle: 'Tài khoản của bạn đã sẵn sàng trải nghiệm âm nhạc không giới hạn',
      intro,
      bodyHtml: infoBox([
        { label: 'Gói Premium', value: planName },
        { label: 'Số tiền', value: amount },
        { label: 'Mã giao dịch', value: orderCode },
        { label: 'Hiệu lực đến', value: expiry },
      ]),
      cta: { href: process.env.APP_FRONTEND_URL || 'http://127.0.0.1:5173', label: 'Khám phá ngay' },
      footer,
    }),
  };
}

function accountLockedEmail({ name, reason, appealLink }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow thông báo tài khoản của bạn đã bị tạm khóa bởi quản trị viên sau quá trình kiểm tra hệ thống. Trong thời gian bị khóa, bạn sẽ không thể đăng nhập hoặc sử dụng các tính năng chính của MusicFlow.';
  const footer = appealLink
    ? 'Nếu bạn cho rằng quyết định này chưa chính xác, vui lòng nhấn nút KHIẾU NẠI để gửi yêu cầu xem xét. MusicFlow sẽ tiếp nhận, kiểm tra thông tin và phản hồi trong thời gian sớm nhất.\n\nTrân trọng,\nĐội ngũ MusicFlow'
    : 'Nếu cần thêm thông tin, vui lòng liên hệ bộ phận hỗ trợ của MusicFlow để được hướng dẫn.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Thông báo khóa tài khoản MusicFlow',
    text:
      `${intro}\n\n` +
      `Lý do khóa tài khoản:\n${reason}\n\n` +
      (appealLink ? `Gửi khiếu nại tại liên kết sau:\n${appealLink}\n\n` : '') +
      footer,
    html: emailShell({
      title: 'Thông báo khóa tài khoản',
      badge: 'Tài khoản tạm khóa',
      subtitle: 'Vui lòng xem thông tin chi tiết và gửi khiếu nại nếu cần',
      intro,
      bodyHtml: infoBox([{ label: 'Lý do khóa', value: reason }]),
      cta: appealLink ? { href: appealLink, label: 'KHIẾU NẠI' } : null,
      footer,
    }),
  };
}

function appealReceivedEmail({ name }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow xác nhận đã nhận được khiếu nại liên quan đến việc khóa tài khoản của bạn. Yêu cầu đã được ghi nhận và chuyển đến quản trị viên để xem xét.';
  const footer = 'Trong thời gian chờ xử lý, vui lòng không gửi nhiều yêu cầu trùng lặp để hệ thống có thể theo dõi hồ sơ khiếu nại chính xác.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'MusicFlow đã nhận khiếu nại của bạn',
    text: `${intro}\n\nTrạng thái hiện tại: Đang chờ xử lý.\n\n${footer}`,
    html: emailShell({
      title: 'Đã nhận khiếu nại',
      badge: 'Khiếu nại đã được ghi nhận',
      subtitle: 'Yêu cầu của bạn đang chờ quản trị viên xem xét',
      intro,
      bodyHtml: infoBox([{ label: 'Trạng thái', value: 'Đang chờ xử lý' }]),
      footer,
    }),
  };
}

function appealAcceptedEmail({ name }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'Sau khi xem xét khiếu nại và các thông tin liên quan, MusicFlow xác nhận tài khoản của bạn đã được mở khóa. Bạn có thể đăng nhập lại và tiếp tục sử dụng hệ thống.';
  const footer = 'MusicFlow xin lỗi vì sự bất tiện đã ảnh hưởng đến trải nghiệm của bạn trong thời gian tài khoản bị khóa. Chúng tôi sẽ tiếp tục cải thiện quy trình kiểm tra để hạn chế các trường hợp tương tự.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Tài khoản MusicFlow của bạn đã được mở khóa',
    text: `${intro}\n\n${footer}`,
    html: emailShell({
      title: 'Tài khoản đã được mở khóa',
      badge: 'Khiếu nại được chấp nhận',
      subtitle: 'Bạn có thể đăng nhập lại và tiếp tục sử dụng MusicFlow',
      intro,
      bodyHtml: infoBox([{ label: 'Kết quả xử lý', value: 'Khiếu nại được chấp nhận. Tài khoản đã được mở khóa.' }]),
      footer,
    }),
  };
}

function appealRejectedEmail({ name, adminNote }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow thông báo khiếu nại khóa tài khoản của bạn đã được quản trị viên xem xét. Sau quá trình kiểm tra, tài khoản hiện vẫn được giữ ở trạng thái khóa.';
  const noteLabel = 'Ghi chú từ quản trị viên';
  const footer = 'Cảm ơn bạn đã cung cấp thông tin để MusicFlow xem xét. Nếu có thông tin mới hoặc cần được hỗ trợ thêm, vui lòng liên hệ bộ phận hỗ trợ theo kênh chính thức của MusicFlow.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Khiếu nại khóa tài khoản đã được xem xét',
    text: `${intro}${adminNote ? `\n\n${noteLabel}:\n${adminNote}` : ''}\n\n${footer}`,
    html: emailShell({
      title: 'Kết quả xem xét khiếu nại',
      badge: 'Khiếu nại đã được xử lý',
      subtitle: 'Tài khoản hiện vẫn được giữ ở trạng thái khóa',
      intro,
      bodyHtml: adminNote ? infoBox([
        { label: 'Kết quả xử lý', value: 'Khiếu nại bị từ chối. Tài khoản vẫn bị khóa.' },
        { label: noteLabel, value: adminNote },
      ]) : infoBox([{ label: 'Kết quả xử lý', value: 'Khiếu nại bị từ chối. Tài khoản vẫn bị khóa.' }]),
      footer,
    }),
  };
}

function adminPromotedEmail({ name }) {
  const intro =
    `Xin chào ${name},\n\n` +
    'MusicFlow thông báo tài khoản của bạn đã được cấp quyền quản trị viên. Từ thời điểm này, bạn có thể truy cập khu vực quản trị để hỗ trợ vận hành và quản lý hệ thống theo phạm vi quyền được phân công.';
  const footer = 'Vui lòng sử dụng quyền quản trị đúng mục đích, không chia sẻ tài khoản và luôn bảo mật thông tin đăng nhập. Nếu bạn không nhận diện được thay đổi này, vui lòng liên hệ ngay với bộ phận phụ trách hệ thống.\n\nTrân trọng,\nĐội ngũ MusicFlow';
  return {
    subject: 'Tài khoản MusicFlow của bạn đã được cấp quyền quản trị',
    text:
      `${intro}\n\n` +
      'Thông tin cập nhật:\n' +
      'Vai trò mới: Quản trị viên\n' +
      'Khu vực truy cập: Trang quản trị MusicFlow\n\n' +
      footer,
    html: emailShell({
      title: 'Bạn đã được cấp quyền quản trị',
      badge: 'Cập nhật vai trò tài khoản',
      subtitle: 'Quyền truy cập khu vực quản trị đã được kích hoạt cho tài khoản của bạn',
      intro,
      bodyHtml: infoBox([
        { label: 'Vai trò mới', value: 'Quản trị viên' },
        { label: 'Khu vực truy cập', value: 'Trang quản trị MusicFlow' },
      ]),
      cta: { href: `${String(process.env.APP_FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')}/admin/login`, label: 'Đăng nhập Admin' },
      footer,
    }),
  };
}

module.exports = {
  welcomeEmail,
  premiumSuccessEmail,
  accountLockedEmail,
  appealReceivedEmail,
  appealAcceptedEmail,
  appealRejectedEmail,
  adminPromotedEmail,
};
