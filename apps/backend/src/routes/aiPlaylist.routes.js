const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const aiPlaylistController = require('../controllers/aiPlaylist.controller');
const { authenticate } = require('../middleware/auth.middleware');

const validate = (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

router.get('/suggestions', aiPlaylistController.getSuggestions);

router.get('/quota', authenticate, aiPlaylistController.getQuota);

router.get('/history',
    authenticate,
    aiPlaylistController.getHistory
);

router.get('/history/:id',
    authenticate,
    aiPlaylistController.getHistoryDetail
);

router.post('/history/:id/save',
    authenticate,
    aiPlaylistController.saveHistory
);

router.post('/intent/preview',
    authenticate,
    body('prompt').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Prompt không hợp lệ'),
    body('targetCount').optional().isInt({ min: 5, max: 50 }).withMessage('Số lượng bài hát không hợp lệ'),
    body('useLLM').optional().isBoolean().withMessage('useLLM phải là boolean'),
    validate,
    aiPlaylistController.previewIntent
);

router.post('/preview',
    authenticate,
    body('prompt').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Prompt không hợp lệ'),
    body('targetCount').optional().isInt({ min: 5, max: 50 }).withMessage('Số lượng bài hát không hợp lệ'),
    body('useLLM').optional().isBoolean().withMessage('useLLM phải là boolean'),
    body('previousSongIds').optional().isArray().withMessage('previousSongIds phải là mảng'),
    validate,
    aiPlaylistController.previewPlaylist
);

router.post('/refine',
    authenticate,
    body('refinePrompt').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Refine prompt không hợp lệ'),
    body('originalPrompt').optional().isString().isLength({ max: 1000 }),
    body('previousIntent').optional().isObject().withMessage('previousIntent phải là object'),
    body('previousSongIds').optional().isArray().withMessage('previousSongIds phải là mảng'),
    body('targetCount').optional().isInt({ min: 5, max: 50 }).withMessage('Số lượng bài hát không hợp lệ'),
    body('useLLM').optional().isBoolean().withMessage('useLLM phải là boolean'),
    validate,
    aiPlaylistController.refinePlaylist
);

router.post('/save',
    authenticate,
    body('name').isString().trim().isLength({ min: 1, max: 120 }).withMessage('Tên playlist không hợp lệ'),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('sourcePrompt').optional().isString().isLength({ max: 1000 }),
    body('prompt').optional().isString().isLength({ max: 1000 }),
    body('intent').optional().isObject(),
    body('songIds').isArray({ min: 1 }).withMessage('Danh sách bài hát trống'),
    body('visibility').optional().isIn(['private', 'public']).withMessage('visibility không hợp lệ'),
    validate,
    aiPlaylistController.savePlaylist
);

module.exports = router;
