const aiAssistantService = require('../services/aiAssistant.service');

const PROMPT_MAX_LENGTH = 1000;
const ALLOWED_SOURCES = new Set(['search_bar']);

function normalizeStrictPositiveId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 0) return value;
    const err = new Error(`${field} is invalid`);
    err.statusCode = 400;
    throw err;
  }
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    const err = new Error(`${field} is invalid`);
    err.statusCode = 400;
    throw err;
  }
  return Number(text);
}

function normalizeStrictBoolean(value, field, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const err = new Error(`${field} is invalid`);
  err.statusCode = 400;
  throw err;
}

function normalizeSource(value) {
  const source = String(value || 'search_bar').trim();
  if (!ALLOWED_SOURCES.has(source)) {
    const err = new Error('source is invalid');
    err.statusCode = 400;
    throw err;
  }
  return source;
}

exports.musicAssistant = async (req, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required',
      });
    }
    if (prompt.length > PROMPT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Prompt must not exceed ${PROMPT_MAX_LENGTH} characters`,
      });
    }

    const currentSongId = normalizeStrictPositiveId(req.body?.currentSongId, 'currentSongId');
    const autoPlay = normalizeStrictBoolean(req.body?.autoPlay, 'autoPlay', false);
    const source = normalizeSource(req.body?.source);

    const data = await aiAssistantService.getMusicAssistantResult({
      prompt,
      autoPlay,
      source,
      currentSongId,
      userId: req.user?.id || null,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.__test = {
  PROMPT_MAX_LENGTH,
  normalizeStrictPositiveId,
  normalizeStrictBoolean,
  normalizeSource,
};
