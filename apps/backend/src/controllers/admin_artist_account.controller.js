const artistAccountService = require('../services/artistAccount.service');

function handleError(res, error) {
  const status = error.statusCode || 500;
  console.error('[admin_artist_account]', error.code || 'unhandled_error', error.message);
  return res.status(status).json({
    success: false,
    message: error.message || 'Khong the xu ly tai khoan nghe si',
    code: error.code,
  });
}

// Legacy invitation flow is intentionally not used by the direct Artist Account mode.

exports.createAccount = async (req, res) => {
  try {
    const account = await artistAccountService.createArtistAccount({
      artistId: req.params.artistId,
      email: req.body?.email,
    });
    return res.status(201).json({
      success: true,
      message: 'Da tao tai khoan Artist Studio.',
      account,
      temporaryPasswordPolicy: {
        type: 'shared_temp_password',
        mustChangeOnFirstLogin: true,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.bulkCreateAccounts = async (req, res) => {
  try {
    const result = await artistAccountService.bulkCreateArtistAccounts({
      artistIds: req.body?.artistIds,
      createFor: req.body?.createFor,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.resetTempPassword = async (req, res) => {
  try {
    const account = await artistAccountService.resetTempPassword({ artistId: req.params.artistId });
    return res.json({
      success: true,
      message: 'Da dat lai mat khau tam thoi cho tai khoan nghe si.',
      account,
      temporaryPasswordPolicy: {
        type: 'shared_temp_password',
        mustChangeOnFirstLogin: true,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const account = await artistAccountService.updateArtistAccountStatus({
      artistId: req.params.artistId,
      status: req.body?.status,
    });
    return res.json({ success: true, message: 'Da cap nhat trang thai tai khoan nghe si.', account });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAccountStatus = async (req, res) => {
  try {
    const status = await artistAccountService.getAccountStatus(req.params.artistId);
    return res.json({ success: true, data: status });
  } catch (error) {
    return handleError(res, error);
  }
};
