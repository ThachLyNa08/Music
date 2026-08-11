const OpenAI = require('openai');

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

    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const userPrompt = `
Prompt nguoi dung: ${prompt}

Mode: ${options.mode || 'unknown'}
Target count: ${options.targetCount || null}

Chi tra JSON hop le.
`;

        const response = await client.chat.completions.create(
            {
                model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                temperature: 0.1,
                max_tokens: 700,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ]
            },
            { signal: controller.signal }
        );

        const content = response?.choices?.[0]?.message?.content;
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
            intent: parsed
        };
    } catch (error) {
        console.warn('[Groq Intent Parser] fallback:', {
            name: error?.name,
            status: error?.status,
            code: error?.code,
            message: error?.message
        });

        if (error?.status === 429) {
            return { ok: false, provider: 'groq', reason: 'GROQ_RATE_LIMIT' };
        }

        if (error?.name === 'AbortError') {
            return { ok: false, provider: 'groq', reason: 'GROQ_TIMEOUT' };
        }

        return {
            ok: false,
            provider: 'groq',
            reason: error?.code || error?.name || 'GROQ_API_ERROR'
        };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    parseIntentWithGroq
};
