const OpenAI = require('openai');
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_TIMEOUT_MS = 10000;
const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const SYSTEM_PROMPT = `
Ban la bo phan tich intent cho he thong nghe nhac MusicFlow.
Nhiem vu: chuyen yeu cau tieng Viet cua nguoi dung thanh JSON intent.
Chi tra ve JSON hop le, khong giai thich.

Khong tu tao ten bai hat.
Khong tu tao song_id.
Khong tu bia nghe si.
Khong chon bai hat cuoi cung.

Tra JSON dang:
{
  "action": "search|create_playlist|play",
  "mode": "direct_song|direct_artist|direct_album|lyrics_search|mood_context|genre_market|similar_to_song|similar_to_artist|beat_rhythm|karaoke_instrumental|hybrid_seed|unknown",
  "market": "VPOP|KPOP|USUK|null",
  "genres": [],
  "artists": [],
  "includeArtists": [],
  "excludeArtists": [],
  "mood": [],
  "context": [],
  "activity": null,
  "tempo": "slow|medium|fast|slow_or_medium|null",
  "energy": "low|medium|high|low_or_medium|null",
  "avoidEnergy": null,
  "excludeGenres": [],
  "seed": {
    "seed_type": "song|artist|genre|none",
    "song_title": null,
    "artist": null,
    "genre": null
  },
  "softPreferences": {
    "rhythm": {
      "beatStrength": null,
      "bassIntensity": null,
      "rhythmDensity": null,
      "groove": null
    }
  },
  "playlist": {
    "target_count": 20,
    "include_seed_song": true,
    "allow_expanded_results": false
  },
  "confidence": 0.0
}

NHAN DIEN SO LUONG BAI:
- "10 bai", "10 songs", "10 tracks", "playlist ngan", "it bai", "vai bai" => playlist.target_count 10.
- "20 bai", "20 songs", "20 tracks", "playlist vua", "vua du nghe" => playlist.target_count 20.
- "30 bai", "30 songs", "30 tracks", "playlist dai", "nhieu bai" => playlist.target_count 30.
- Neu nguoi dung nhap so khac: <= 10 => 10, 11 den 20 => 20, > 20 => 30.
- Gioi han playlist.target_count chi duoc la 10, 20, hoac 30.
- Neu nguoi dung khong noi so bai, giu playlist.target_count theo Target count duoc truyen vao hoac mac dinh 20.

KHONG HO TRO TAO PLAYLIST THEO THOI LUONG:
- Neu prompt co "30 phut", "45 phut", "1 tieng", "1 gio", "nghe khoang 1 tieng", "playlist 45 phut" thi bo qua thong tin thoi luong.
- Khong tra field thoi luong.
- Khong dung thoi luong de quyet dinh tong playlist.

Quy tac:
- "chill", "nhe nhang", "thu gian", "hoc bai", "tap trung" => energy low_or_medium, avoidEnergy high, activity study/focus.
- "buoi toi", "ngu", "em", "diu" => tempo slow_or_medium, energy low_or_medium.
- "gym", "tap luyen", "chay bo", "soi dong", "chay" => tempo fast, energy high.
- "buon", "sad", "co don", "tam trang" => mood sad/relax, energy low_or_medium.
- "khong lay", "loai tru", "tru", "dung co" => dua vao excludeGenres/excludeArtists/negative constraints.
- Neu tu bi loai tru la genre nhu "ballad", "rap", "R&B", "EDM", "lofi", "acoustic", "dance" thi bat buoc dua vao excludeGenres, khong dua vao excludeArtists.
- Prompt tao playlist => action create_playlist.
- Prompt mo/tim nhac => action search hoac play.
- "KPOP", "VPOP", "USUK" la market, khong phai artist. Khong dung mode direct_artist neu prompt chi noi KPOP/VPOP/USUK ma khong co ten nghe si cu the.

BEAT = NHIP DIEU / BASS / GROOVE:
- "beat manh", "beat cang", "beat day", "bass manh", "bass day", "nhip manh", "nhip nhanh", "nhip don dap", "trong ro", "dance beat", "beat de quay", "beat de gym", "beat de chay bo" => mode beat_rhythm, energy high, tempo fast, rhythm beatStrength/bassIntensity/rhythmDensity high.
- "beat cham", "nhip cham", "beat chill", "beat nhe" => mode beat_rhythm, tempo slow_or_medium, energy low_or_medium, avoidEnergy high, beatStrength low_or_medium.
- "beat bat tai", "groove ro" => mode beat_rhythm, rhythm groove high, danceability/groove medium_or_high.

BEAT = KARAOKE / INSTRUMENTAL:
- "beat karaoke", "beat khong loi", "nhac nen khong loi", "instrumental", "karaoke", "tach vocal", "lay beat", "ban beat cua bai" => mode karaoke_instrumental.
- Khong parse cac prompt nay thanh beat_rhythm.

BEAT GIONG BAI CU THE:
- "beat giong bai X", "nhip giong bai X", "bass giong bai X", "tao playlist beat giong bai X", "nhac co beat kieu bai X" => mode similar_to_song, seed.seed_type song, seed.song_title X, rhythm fields similar.
- Khong tra song_id.
`;

function safeParseJson(text) {
    if (!text) return null;

    const raw = String(text).trim();

    try {
        return JSON.parse(raw);
    } catch (_) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function resolveTimeoutMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_GROQ_TIMEOUT_MS;
    return Math.min(parsed, 30000);
}

function getGroqModel() {
    return String(process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
}

function getSafeErrorInfo(error) {
    return {
        name: error?.name || null,
        status: error?.status || error?.statusCode || null,
        code: error?.code || null,
        message: error?.message ? String(error.message).slice(0, 220) : null
    };
}

function classifyGroqError(error) {
    const status = Number(error?.status || error?.statusCode || 0);
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') return 'GROQ_TIMEOUT';
    if (status === 408) return 'GROQ_TIMEOUT';
    if (status === 429) return 'GROQ_RATE_LIMIT';
    if (status >= 500 && status <= 599) return `GROQ_${status}`;
    if (status === 404) return 'GROQ_MODEL_NOT_FOUND';
    return error?.code || error?.name || 'GROQ_API_ERROR';
}

function shouldRetryGroq(error) {
    const status = Number(error?.status || error?.statusCode || 0);
    return error?.name === 'AbortError'
        || error?.code === 'ABORT_ERR'
        || RETRIABLE_STATUSES.has(status)
        || ['APIConnectionError', 'FetchError', 'TimeoutError'].includes(error?.name);
}

async function createCompletionWithTimeout(client, request, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await client.chat.completions.create(request, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function parseIntentWithGroq(prompt, options = {}) {
    if (process.env.LLM_ENABLED !== 'true') {
        return { ok: false, provider: 'groq', reason: 'LLM_DISABLED' };
    }

    if (!process.env.GROQ_API_KEY) {
        return { ok: false, provider: 'groq', reason: 'MISSING_GROQ_API_KEY' };
    }

    const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
    });

    const model = getGroqModel();
    const timeoutMs = resolveTimeoutMs(options.timeoutMs || process.env.GROQ_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
        console.log(`[LLM] provider=groq model=${model}`);
        const userPrompt = `
Prompt nguoi dung: ${prompt}

Mode: ${options.mode || 'unknown'}
Target count: ${options.targetCount || null}

Chi tra JSON hop le.
`;

        const request = {
                model,
                temperature: 0.1,
                max_tokens: 700,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ]
            };

        let response;
        try {
            response = await createCompletionWithTimeout(client, request, timeoutMs);
        } catch (firstError) {
            if (!shouldRetryGroq(firstError)) throw firstError;
            console.warn('[LLM] groq retry reason=', classifyGroqError(firstError));
            response = await createCompletionWithTimeout(client, request, Math.min(timeoutMs, 5000));
        }

        const content = response?.choices?.[0]?.message?.content;
        if (!content || !String(content).trim()) {
            return {
                ok: false,
                provider: 'groq',
                reason: 'EMPTY_RESPONSE'
            };
        }

        const parsed = safeParseJson(content);

        if (!parsed || typeof parsed !== 'object') {
            return {
                ok: false,
                provider: 'groq',
                reason: 'INVALID_JSON'
            };
        }

        return {
            ok: true,
            provider: 'groq',
            intent: parsed,
            model,
            latencyMs: Date.now() - startedAt
        };
    } catch (error) {
        console.warn('[Groq Intent Parser] fallback:', getSafeErrorInfo(error));

        return {
            ok: false,
            provider: 'groq',
            reason: classifyGroqError(error),
            model,
            latencyMs: Date.now() - startedAt
        };
    }
}

module.exports = {
    parseIntentWithGroq,
    safeParseJson
};
