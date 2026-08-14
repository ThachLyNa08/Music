const assert = require('assert');
const path = require('path');

const prompts = [
    'Nhạc buồn',
    'Tạo playlist KPOP năng lượng cao để tập gym khoảng 1 tiếng',
    'Tạo playlist có BLACKPINK và nhạc KPOP sôi động',
    'Nhạc VPOP chill buổi tối nhưng không có Sơn Tùng M-TP',
    'Nhạc tiết tấu nhanh để chạy bộ',
    'Tôi vừa chia tay, muốn nghe gì đó nhẹ nhàng nhưng đừng quá buồn',
    'Create a high-energy K-pop playlist for a 45-minute workout',
    'Cho tôi nghe gì đó hợp tối nay'
];

function servicePath(relativePath) {
    return path.resolve(__dirname, '../../src/services', relativePath);
}

function clearIntentModules() {
    [
        servicePath('llmIntent.service.js'),
        servicePath('aiPlaylistIntent.service.js'),
        servicePath('groqIntent.service.js'),
        servicePath('geminiPlaylist.service.js')
    ].forEach((modulePath) => {
        delete require.cache[modulePath];
    });
}

function mockProviders({ groqResult, geminiResult }) {
    const groqPath = servicePath('groqIntent.service.js');
    const geminiPath = servicePath('geminiPlaylist.service.js');

    require.cache[groqPath] = {
        id: groqPath,
        filename: groqPath,
        loaded: true,
        exports: {
            parseIntentWithGroq: async () => groqResult
        }
    };

    require.cache[geminiPath] = {
        id: geminiPath,
        filename: geminiPath,
        loaded: true,
        exports: {
            parseIntentWithGemini: async () => geminiResult,
            isConfigured: () => true
        }
    };
}

function assertPlaylistIntentShape(intent, prompt) {
    assert(intent && typeof intent === 'object', `${prompt}: missing intent`);
    assert(intent.hardConstraints && typeof intent.hardConstraints === 'object', `${prompt}: missing hardConstraints`);
    assert(intent.softPreferences && typeof intent.softPreferences === 'object', `${prompt}: missing softPreferences`);
    assert(intent.negativeConstraints && typeof intent.negativeConstraints === 'object', `${prompt}: missing negativeConstraints`);
    assert(intent.seed && typeof intent.seed === 'object', `${prompt}: missing seed`);
    assert(intent.playlist && typeof intent.playlist === 'object', `${prompt}: missing playlist`);
    assert([10, 20, 30].includes(intent.playlist.target_count), `${prompt}: invalid target_count`);
    assert(Number(intent.confidence) >= 0 && Number(intent.confidence) <= 1, `${prompt}: invalid confidence`);
}

async function testLocalPromptCoverage() {
    process.env.LLM_ENABLED = 'false';
    clearIntentModules();
    const { normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service');

    for (const prompt of prompts) {
        const intent = await normalizeAiPlaylistIntent({ prompt, targetCount: 20, useLLM: false });
        assertPlaylistIntentShape(intent, prompt);
    }

    const workout = await normalizeAiPlaylistIntent({
        prompt: 'Tạo playlist KPOP năng lượng cao để tập gym khoảng 1 tiếng',
        targetCount: 20,
        useLLM: false
    });
    assert.strictEqual(workout.hardConstraints.market, 'KPOP');
    assert.strictEqual(workout.softPreferences.activity, 'gym');
    assert.strictEqual(workout.softPreferences.energy, 'high');

    const exclude = await normalizeAiPlaylistIntent({
        prompt: 'Nhạc VPOP chill buổi tối nhưng không có Sơn Tùng M-TP',
        targetCount: 20,
        useLLM: false
    });
    assert.strictEqual(exclude.hardConstraints.market, 'VPOP');
    assert(exclude.hardConstraints.exclude_artists.some((artist) => artist.includes('Sơn Tùng') || artist.includes('Son Tung')));

    return true;
}

async function testFallbackRouter() {
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_PROVIDER = 'groq';
    process.env.LLM_FALLBACK_PROVIDER = 'gemini';

    clearIntentModules();
    mockProviders({
        groqResult: {
            ok: true,
            provider: 'groq',
            model: 'openai/gpt-oss-120b',
            latencyMs: 12,
            intent: {
                action: 'create_playlist',
                mode: 'genre_market',
                market: 'KPOP',
                mood: ['energetic'],
                activity: 'workout',
                tempo: 'fast',
                energy: 'high',
                confidence: 0.9
            }
        },
        geminiResult: {
            ok: true,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            intent: { action: 'create_playlist', mood: ['chill'], confidence: 0.7 }
        }
    });
    let { normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service');
    let intent = await normalizeAiPlaylistIntent({ prompt: 'Mock Groq success KPOP workout', targetCount: 20, useLLM: true });
    assert.strictEqual(intent.raw.provider, 'groq');
    assert.strictEqual(intent.hardConstraints.market, 'KPOP');

    clearIntentModules();
    mockProviders({
        groqResult: { ok: false, provider: 'groq', reason: 'GROQ_RATE_LIMIT', latencyMs: 8 },
        geminiResult: {
            ok: true,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            latencyMs: 15,
            intent: {
                action: 'create_playlist',
                mode: 'genre_market',
                market: 'VPOP',
                mood: ['chill'],
                energy: 'low',
                confidence: 0.8
            }
        }
    });
    ({ normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service'));
    intent = await normalizeAiPlaylistIntent({ prompt: 'Mock Groq fails Gemini works VPOP chill', targetCount: 20, useLLM: true });
    assert.strictEqual(intent.raw.provider, 'gemini');
    assert.strictEqual(intent.hardConstraints.market, 'VPOP');
    assert(intent.raw.matchedKeywords.includes('llm_fallback:GROQ_RATE_LIMIT'));

    clearIntentModules();
    mockProviders({
        groqResult: { ok: false, provider: 'groq', reason: 'GROQ_TIMEOUT', latencyMs: 10 },
        geminiResult: { ok: false, provider: 'gemini', reason: 'GEMINI_TIMEOUT', latencyMs: 12 }
    });
    ({ normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service'));
    intent = await normalizeAiPlaylistIntent({
        prompt: 'Tạo playlist KPOP năng lượng cao để tập gym khoảng 1 tiếng',
        targetCount: 20,
        useLLM: true
    });
    assert.strictEqual(intent.raw.provider, 'taxonomy');
    assert.strictEqual(intent.hardConstraints.market, 'KPOP');
    assert.strictEqual(intent.softPreferences.activity, 'gym');
    assert(intent.raw.matchedKeywords.some((keyword) => keyword.startsWith('llm_fallback:GROQ_TIMEOUT;GEMINI_TIMEOUT')));

    return true;
}

async function main() {
    const local = await testLocalPromptCoverage();
    const fallback = await testFallbackRouter();

    console.log(JSON.stringify({
        prompts: prompts.length,
        localTaxonomy: local ? 'PASS' : 'FAIL',
        fallbackRouter: fallback ? 'PASS' : 'FAIL',
        groqModel: 'openai/gpt-oss-120b',
        geminiModel: 'gemini-2.5-flash'
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
