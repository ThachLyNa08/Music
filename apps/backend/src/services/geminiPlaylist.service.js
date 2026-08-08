const { GoogleGenAI, Type } = require('@google/genai');

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const DEFAULT_GEMINI_TIMEOUT_MS = 6000;
const DEPRECATED_GEMINI_MODELS = new Set([
    'gemini-2.5-flash-lite',
    'models/gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'models/gemini-2.5-flash'
]);

function getGeminiApiKey() {
    const key = String(process.env.GEMINI_API_KEY || '').trim();
    if (!key || key === 'your_gemini_api_key_here') return null;
    return key;
}

function isConfigured() {
    return Boolean(getGeminiApiKey());
}

function resolveTimeoutMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GEMINI_TIMEOUT_MS;
    return Math.min(parsed, 30000);
}

function resolveGeminiModel() {
    const configured = String(process.env.GEMINI_MODEL || '').trim();
    if (!configured || DEPRECATED_GEMINI_MODELS.has(configured)) {
        if (configured && configured !== DEFAULT_GEMINI_MODEL) {
            console.warn('[Gemini Intent Parser] deprecated_model_fallback:', {
                configuredModel: configured,
                fallbackModel: DEFAULT_GEMINI_MODEL
            });
        }
        return DEFAULT_GEMINI_MODEL;
    }
    return configured;
}

function getSafeGeminiErrorCode(error) {
    return error?.code || error?.name || 'GEMINI_INTENT_FAILED';
}

function getSafeGeminiErrorInfo(error) {
    return {
        name: error?.name || null,
        message: error?.message ? String(error.message).slice(0, 240) : null,
        status: error?.status || error?.statusCode || null,
        code: error?.code || null
    };
}

function shouldRetryWithoutSchema(error) {
    const status = Number(error?.status || error?.statusCode || 0);
    return status === 400 || status === 422;
}

function withTimeout(promise, timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Gemini request timed out after ${timeoutMs}ms`);
            err.code = 'GEMINI_TIMEOUT';
            reject(err);
        }, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Phân tích prompt của người dùng để trả về intent JSON
 * @param {string} prompt 
 * @returns {Promise<Object>}
 */
async function extractIntent(prompt, options = {}) {
    // Check if API Key is configured
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = resolveGeminiModel();
    const timeoutMs = resolveTimeoutMs(options.timeoutMs || process.env.GEMINI_TIMEOUT_MS);

    const systemInstruction = `
Bạn là một chuyên gia phân tích âm nhạc cho hệ thống MusicFlow.
Nhiệm vụ của bạn là phân tích yêu cầu tạo playlist của người dùng và trả về MỘT OBJECT JSON DUY NHẤT.
KHÔNG giải thích, KHÔNG thêm markdown \`\`\`json, KHÔNG bịa danh sách bài hát.

Quy tắc BẮT BUỘC về nghệ sĩ (Artist Rules):
1. Bạn PHẢI bóc tách đúng nguyên văn tên nghệ sĩ nếu người dùng nhắc đến (ví dụ: Blackpink, Diệu Kiên, Sơn Tùng M-TP). KHÔNG tự ý chuyển tên nghệ sĩ thành thể loại nhạc.
2. Nếu người dùng nhắc đích danh nghệ sĩ (ví dụ "Tạo playlist Blackpink", "Nhạc của Diệu Kiên"):
   - artistConstraintMode = "hard"
   - allowSimilarArtists = false
3. Nếu người dùng yêu cầu nhạc giống/tương tự/cùng vibe nghệ sĩ nào đó (ví dụ "Nhạc giống Blackpink", "cùng vibe Sơn Tùng"):
   - artistConstraintMode = "soft"
   - allowSimilarArtists = true
4. Nếu không có nghệ sĩ nào được nhắc đến:
   - artistConstraintMode = "none"
   - allowSimilarArtists = true
Quy tac so luong playlist:
- Chi ho tro tao playlist theo so luong bai: 10, 20, hoac 30.
- "playlist ngan", "it bai", "vai bai" => targetCount = 10.
- "playlist vua", "vua du nghe" => targetCount = 20.
- "playlist dai", "nhieu bai" => targetCount = 30.
- Neu nguoi dung nhap so khac: <= 10 => 10, 11 den 20 => 20, > 20 => 30.
- Khong ho tro tao playlist theo thoi luong. Neu prompt co "30 phut", "45 phut", "1 tieng", "1 gio", hay "playlist 45 phut" thi bo qua thong tin do va khong tra field thoi luong.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            playlistName: {
                type: Type.STRING,
                description: "Tên ngắn gọn, hấp dẫn cho playlist"
            },
            artists: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách tên nghệ sĩ được nhắc đến trong câu (nguyên văn)"
            },
            artistConstraintMode: {
                type: Type.STRING,
                description: "Chế độ: 'hard', 'soft', hoặc 'none' theo quy tắc Artist Rules"
            },
            allowSimilarArtists: {
                type: Type.BOOLEAN,
                description: "Cho phép lấy thêm nghệ sĩ tương tự hay không"
            },
            mood: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Các từ khóa chỉ tâm trạng (vd: chill, sad, romantic, energetic...)"
            },
            context: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Ngữ cảnh nghe nhạc (vd: night, rain, cafe, driving...)"
            },
            activity: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Hoạt động (vd: study, work, workout, party, sleep...)"
            },
            genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Thể loại nhạc (vd: pop, ballad, edm, lofi, r&b, rap...)"
            },
            languages: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Ngôn ngữ bài hát (vd: vi, en, ko, ja, any)"
            },
            tempo: {
                type: Type.STRING,
                description: "Tốc độ bài hát: slow, medium, fast, hoặc any"
            },
            energy: {
                type: Type.STRING,
                description: "Năng lượng: low, medium, high, hoặc any"
            },
            era: {
                type: Type.STRING,
                description: "Thời đại: old, new, hoặc any"
            },
            vibe: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Cảm giác tổng thể (vd: healing, nostalgia, hype...)"
            },
            explicitExclusions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Những thứ người dùng KHÔNG muốn nghe (vd: buồn, ồn ào...)"
            },
            keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Các từ khóa bổ sung khác từ prompt, CHÚ Ý giữ lại các từ lóng tiếng Việt (suy, ngôn tình, quẩy, cháy...)"
            },
            targetCount: {
                type: Type.INTEGER,
                description: "Số lượng bài hát yêu cầu (mặc định 20 nếu không nhắc đến)"
            }
        },
        required: ["playlistName", "artistConstraintMode", "allowSimilarArtists"]
    };

    try {
        const request = {
            model: model,
            contents: [
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.3
            }
        };
        let response;
        try {
            response = await withTimeout(ai.models.generateContent(request), timeoutMs);
        } catch (schemaError) {
            if (!shouldRetryWithoutSchema(schemaError)) throw schemaError;
            console.warn('[Gemini Intent Parser] retry_without_schema:', getSafeGeminiErrorInfo(schemaError));
            const relaxedRequest = {
                ...request,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    temperature: 0.2
                }
            };
            response = await withTimeout(ai.models.generateContent(relaxedRequest), timeoutMs);
        }

        const textResponse = response.text;
        if (!textResponse) {
            throw new Error('Empty response from Gemini');
        }

        // Parse JSON
        const intent = JSON.parse(textResponse);
        return intent;
    } catch (error) {
        console.warn('[Gemini Intent Parser] fallback:', getSafeGeminiErrorInfo(error));
        if (!error.code) error.code = getSafeGeminiErrorCode(error);
        throw error;
    }
}

async function parseIntentWithGemini(prompt, options = {}) {
    if (!isConfigured()) {
        return { ok: false, provider: 'gemini', reason: 'MISSING_GEMINI_API_KEY' };
    }

    try {
        const intent = await extractIntent(prompt, options);
        const marketByLanguage = { vi: 'VPOP', ko: 'KPOP', en: 'USUK' };
        const language = Array.isArray(intent?.languages) ? intent.languages[0] : null;
        const activity = Array.isArray(intent?.activity) ? intent.activity[0] : intent?.activity;

        return {
            ok: true,
            provider: 'gemini',
            intent: {
                action: options.mode === 'ai_playlist' ? 'create_playlist' : 'search',
                market: marketByLanguage[String(language || '').toLowerCase()] || null,
                genres: intent?.genres || [],
                artists: intent?.artists || [],
                includeArtists: intent?.artistConstraintMode === 'hard' ? (intent?.artists || []) : [],
                excludeArtists: [],
                mood: [...(intent?.mood || []), ...(intent?.vibe || [])],
                context: intent?.context || [],
                activity,
                tempo: intent?.tempo === 'any' ? null : intent?.tempo,
                energy: intent?.energy === 'any' ? null : intent?.energy,
                avoidEnergy: null,
                excludeGenres: [],
                targetCount: intent?.targetCount || options.targetCount || null,
                confidence: 0.75
            }
        };
    } catch (error) {
        return {
            ok: false,
            provider: 'gemini',
            reason: error?.code || error?.name || 'GEMINI_INTENT_FAILED'
        };
    }
}

module.exports = {
    extractIntent,
    parseIntentWithGemini,
    isConfigured
};
