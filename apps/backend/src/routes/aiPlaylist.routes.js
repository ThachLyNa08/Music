const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
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

const isStrictPositiveInteger = (value) => {
    if (typeof value === 'number') return Number.isInteger(value) && value > 0;
    return /^[1-9]\d*$/.test(String(value ?? '').trim());
};

const validateIdArray = (field) => body(field).optional().custom((value) => {
    if (!Array.isArray(value)) {
        throw new Error(`${field} must be an array`);
    }
    for (const item of value) {
        if (!isStrictPositiveInteger(item)) {
            throw new Error(`${field} must contain only positive integer IDs`);
        }
    }
    return true;
});

const validateAiPlaylistIdInputs = (req, res, next) => {
    for (const field of ['previousSongIds', 'songIds']) {
        if (req.body?.[field] === undefined) continue;
        if (!Array.isArray(req.body[field])) {
            return res.status(400).json({ success: false, message: `${field} must be an array` });
        }
        const invalid = req.body[field].find((item) => !isStrictPositiveInteger(item));
        if (invalid !== undefined) {
            return res.status(400).json({ success: false, message: `${field} must contain only positive integer IDs` });
        }
    }
    next();
};

router.get('/suggestions', aiPlaylistController.getSuggestions);

router.get('/quota', authenticate, aiPlaylistController.getQuota);

router.use(validateAiPlaylistIdInputs);

router.get('/history',
    authenticate,
    aiPlaylistController.getHistory
);

router.get('/history/:id',
    authenticate,
    param('id').custom(isStrictPositiveInteger).withMessage('historyId invalid'),
    validate,
    aiPlaylistController.getHistoryDetail
);

router.post('/history/:id/save',
    authenticate,
    param('id').custom(isStrictPositiveInteger).withMessage('historyId invalid'),
    validate,
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
