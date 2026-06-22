const assert = require('assert');
const { normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service');

const cases = [
    {
        prompt: 'Tạo playlist nhạc Việt buồn nhẹ nghe buổi tối.',
        expected: { market: 'VPOP', mood: ['sad'], energy: 'low', context: ['night'] }
    },
    {
        prompt: 'Cho tôi vài bài trẻ trẻ nhưng không quá ồn.',
        expected: { genre_family: ['pop'], energy: 'medium', negativeEnergy: ['high'], negativeMood: ['party'] }
    },
    {
        prompt: 'Tìm nhạc có giai điệu thư giãn để làm việc.',
        expected: { mood: ['chill'], activity: 'work' }
    },
    {
        prompt: 'Tạo list nhạc Kpop nhẹ nhàng, đừng quá dance.',
        expected: { market: 'KPOP', mood: ['chill'], energy: 'low', negativeGenre: ['dance'] }
    },
    {
        prompt: 'Nhạc USUK kiểu sâu lắng, nghe lúc trời mưa.',
        expected: { market: 'USUK', mood: ['nostalgic'], context: ['rain'] }
    },
    {
        prompt: 'Cho tôi nhạc vui nhưng không quá náo nhiệt.',
        expected: { mood: ['happy'], energy: 'medium', negativeEnergy: ['high'], negativeMood: ['party'] }
    },
    {
        prompt: 'Nhạc tình cảm Việt Nam, giai điệu chậm.',
        expected: { market: 'VPOP', mood: ['romantic'], tempo: 'slow', context: ['love'] }
    },
    {
        prompt: 'Tôi muốn nghe nhạc giúp tập trung chạy deadline.',
        expected: { mood: ['focus'], energy: 'medium', activity: 'work', context: ['deadline'] }
    },
    {
        prompt: 'Nhạc giống vibe của Sơn Tùng nhưng nhẹ hơn.',
        expected: { seedType: 'artist_seed', seedArtistIncludes: 'Sơn Tùng', energy: 'low' }
    },
    {
        prompt: 'Nhạc buồn nhưng đừng quá thảm.',
        expected: { mood: ['sad'], moodIntensity: 'light', negativeMood: ['heartbreak'] }
    },
    {
        prompt: 'Tạo playlist tập gym thật cháy.',
        expected: { mood: ['energetic'], energy: 'high', tempo: 'fast', activity: 'gym' }
    },
    {
        prompt: 'Cho tôi nhạc chill để uống cà phê.',
        expected: { mood: ['chill'], energy: 'low', activity: 'coffee' }
    },
    {
        prompt: 'Nhạc hoài niệm, có chiều sâu một chút.',
        expected: { mood: ['nostalgic'], context: ['nostalgia'] }
    },
    {
        prompt: 'Nhạc Kpop sôi động nhưng đừng quá ồn.',
        expected: { market: 'KPOP', mood: ['energetic'], energy: 'medium', negativeEnergy: ['high'] }
    },
    {
        prompt: 'Nhạc Việt nhẹ đầu, dễ nghe.',
        expected: { market: 'VPOP', mood: ['chill'], energy: 'low' }
    },
    {
        prompt: 'Nhạc Âu Mỹ R&B đêm khuya.',
        expected: { market: 'USUK', genre_family: ['rnb'], context: ['late_night'] }
    },
    {
        prompt: 'Tạo playlist để lái xe cuối tuần.',
        expected: { activity: 'driving', context: ['weekend'] }
    },
    {
        prompt: 'Nhạc lofi học bài ít lời.',
        expected: { genre_family: ['lofi'], activity: 'study', vocalPreference: 'less_vocal' }
    },
    {
        prompt: 'Nhạc tình yêu ngọt ngào.',
        expected: { mood: ['romantic'], context: ['love'] }
    },
    {
        prompt: 'Nhạc thất tình nhưng không quá bi lụy.',
        expected: { mood: [], moodIntensity: 'light', negativeMood: ['heartbreak'], context: ['breakup'] }
    },
    {
        prompt: 'Nhạc Hàn quẩy cuối tuần.',
        expected: { market: 'KPOP', mood: ['party'], energy: 'high', context: ['weekend'] }
    },
    {
        prompt: 'Nhạc Việt acoustic nhẹ nhàng buổi sáng.',
        expected: { market: 'VPOP', genre_family: ['acoustic'], mood: ['chill'], context: ['morning'] }
    },
    {
        prompt: 'USUK pop đang hot cho buổi chiều.',
        expected: { market: 'USUK', genre_family: ['pop'], popularity: 'trending', context: ['afternoon'] }
    },
    {
        prompt: 'Cho tôi vài bài hidden gem lạ lạ.',
        expected: { familiarity: 'discover', popularity: 'hidden_gems' }
    },
    {
        prompt: 'Bài quen quen đúng gu của tôi.',
        expected: { familiarity: 'familiar', goal: 'replay_favorites' }
    },
    {
        prompt: 'Đừng toàn một ca sĩ, tôi muốn nhiều nghệ sĩ.',
        expected: { diversity: 'diverse_artist' }
    },
    {
        prompt: 'Nhiều thể loại, đổi vibe một chút.',
        expected: { diversity: 'diverse_genre' }
    },
    {
        prompt: 'Tạo mix cùng vibe, cùng kiểu.',
        expected: { diversity: 'same_vibe' }
    },
    {
        prompt: 'Nhạc bolero trữ tình ngày mưa.',
        expected: { genre_family: ['bolero_folk'], context: ['rain'] }
    },
    {
        prompt: 'Rap Việt năng lượng vừa thôi, không quá ồn.',
        expected: { market: 'VPOP', genre_family: ['rap_hiphop'], energy: 'medium', negativeEnergy: ['high'] }
    },
    {
        prompt: 'Nhạc EDM thật bốc để party.',
        expected: { genre_family: ['edm'], mood: ['party'], energy: 'high', activity: 'party' }
    },
    {
        prompt: 'Rock indie hoài niệm.',
        expected: { genre_family: ['rock_indie'], mood: ['nostalgic'] }
    },
    {
        prompt: 'Nhạc ngủ dịu, không lời càng tốt.',
        expected: { activity: 'sleep', mood: ['calm'], vocalPreference: 'less_vocal' }
    },
    {
        prompt: 'Nhạc healing sau chia tay.',
        expected: { activity: 'healing', mood: ['heartbreak'], context: ['breakup'] }
    },
    {
        prompt: 'Nhạc để coding, không bị phân tâm.',
        expected: { activity: 'coding', mood: ['focus'], vocalPreference: 'less_vocal' }
    },
    {
        prompt: 'Nhạc làm luận văn sâu lắng lúc khuya.',
        expected: { mood: ['nostalgic'], context: ['late_night'] }
    },
    {
        prompt: 'Playlist sáng vui vẻ, yêu đời.',
        expected: { mood: ['happy', 'romantic'], context: ['morning'] }
    },
    {
        prompt: 'Nhạc đi du lịch cuối tuần thật sung.',
        expected: { activity: 'travel', mood: ['energetic'], context: ['weekend'] }
    },
    {
        prompt: 'Nhạc lái xe đêm mưa.',
        expected: { activity: 'driving', context: ['night', 'rain'] }
    },
    {
        prompt: 'Tạo playlist BLACKPINK.',
        expected: { seedType: 'artist_seed', seedArtistIncludes: 'BLACKPINK' }
    },
    {
        prompt: 'Ưu tiên bài của Taylor Swift.',
        expected: { includeArtistIncludes: 'Taylor Swift', seedType: 'artist_seed' }
    },
    {
        prompt: 'Nhạc giống Taylor Swift nhưng buồn hơn.',
        expected: { seedType: 'artist_seed', seedArtistIncludes: 'Taylor Swift', mood: ['sad'] }
    },
    {
        prompt: 'Nhạc pop nhưng không rap.',
        expected: { genre_family: ['pop'], negativeGenre: ['rap_hiphop'] }
    },
    {
        prompt: 'Nhạc khám phá ít người biết.',
        expected: { familiarity: 'discover', popularity: 'hidden_gems', goal: 'explore' }
    },
    {
        prompt: 'Nhạc viral thịnh hành để chạy bộ.',
        expected: { popularity: 'trending', energy: 'high' }
    },
    {
        prompt: 'Nhạc R&B nhẹ nhàng ban đêm.',
        expected: { genre_family: ['rnb'], mood: ['chill'], context: ['night'] }
    },
    {
        prompt: 'Nhạc dance nhưng không quá náo nhiệt.',
        expected: { negativeMood: ['party'], negativeEnergy: ['high'], energy: 'medium' }
    },
    {
        prompt: 'Nhạc xưa cũ tuổi thơ.',
        expected: { mood: ['nostalgic'], context: ['nostalgia'] }
    },
    {
        prompt: 'Nhạc thư giãn trước khi ngủ.',
        expected: { mood: ['chill'], activity: 'sleep' }
    },
    {
        prompt: 'Tạo quick mix USUK chill.',
        expected: { market: 'USUK', mood: ['chill'], goal: 'quick_mix' }
    },
    {
        prompt: 'Kpop nhẹ nhàng để học bài của BlackPink',
        expected: { market: 'KPOP', mood: ['chill'], activity: 'study', includeArtistIncludes: 'BlackPink' }
    },
    {
        prompt: 'Nhạc của Sơn Tùng buồn nhẹ',
        expected: { mood: ['sad'], energy: 'low', includeArtistIncludes: 'Sơn Tùng' }
    },
    {
        prompt: 'Nhạc giống BlackPink nhưng nhẹ hơn',
        expected: { seedType: 'artist_seed', seedArtistIncludes: 'BlackPink', energy: 'low' }
    },
    {
        prompt: 'Toàn bài BLACKPINK để tập gym',
        expected: { includeArtistIncludes: 'BLACKPINK', activity: 'gym', energy: 'high' }
    }
];

function includesAll(actual, expected, message) {
    for (const value of expected || []) {
        assert(actual.includes(value), `${message}: expected ${JSON.stringify(actual)} to include ${value}`);
    }
}

function assertExpected(intent, expected, prompt) {
    if (expected.market) assert.strictEqual(intent.hardConstraints.market, expected.market, prompt);
    if (expected.language) assert.strictEqual(intent.hardConstraints.language, expected.language, prompt);
    if (expected.genre_family) includesAll(intent.hardConstraints.genre_family, expected.genre_family, `${prompt} genre_family`);
    if (expected.mood) includesAll(intent.softPreferences.mood, expected.mood, `${prompt} mood`);
    if (expected.moodIntensity) assert.strictEqual(intent.softPreferences.mood_intensity, expected.moodIntensity, prompt);
    if (expected.tempo) assert.strictEqual(intent.softPreferences.tempo, expected.tempo, prompt);
    if (expected.energy) assert.strictEqual(intent.softPreferences.energy, expected.energy, prompt);
    if (expected.activity) assert.strictEqual(intent.softPreferences.activity, expected.activity, prompt);
    if (expected.context) includesAll(intent.softPreferences.context, expected.context, `${prompt} context`);
    if (expected.vocalPreference) assert.strictEqual(intent.softPreferences.vocal_preference, expected.vocalPreference, prompt);
    if (expected.familiarity) assert.strictEqual(intent.softPreferences.familiarity, expected.familiarity, prompt);
    if (expected.popularity) assert.strictEqual(intent.softPreferences.popularity, expected.popularity, prompt);
    if (expected.diversity) assert.strictEqual(intent.softPreferences.diversity, expected.diversity, prompt);
    if (expected.seedType) assert.strictEqual(intent.seed.seed_type, expected.seedType, prompt);
    if (expected.seedArtistIncludes) assert(intent.seed.artist?.includes(expected.seedArtistIncludes), `${prompt} seed artist`);
    if (expected.includeArtistIncludes) {
        assert(
            intent.hardConstraints.include_artists.some((artist) => artist.includes(expected.includeArtistIncludes)),
            `${prompt} include artist`
        );
    }
    if (expected.negativeMood) includesAll(intent.negativeConstraints.mood, expected.negativeMood, `${prompt} negative mood`);
    if (expected.negativeGenre) includesAll(intent.negativeConstraints.genre_family, expected.negativeGenre, `${prompt} negative genre`);
    if (expected.negativeEnergy) includesAll(intent.negativeConstraints.energy, expected.negativeEnergy, `${prompt} negative energy`);
    if (expected.goal) assert.strictEqual(intent.playlist.goal, expected.goal, prompt);

    assert(intent.playlist.target_count >= 5 && intent.playlist.target_count <= 50, `${prompt} target_count range`);
    assert(intent.confidence >= 0 && intent.confidence <= 1, `${prompt} confidence range`);
}

async function main() {
    const sampleOutputs = [];

    for (const [index, testCase] of cases.entries()) {
        const intent = await normalizeAiPlaylistIntent({
            prompt: testCase.prompt,
            targetCount: index % 2 === 0 ? 20 : 12,
            useLLM: false
        });

        assertExpected(intent, testCase.expected, testCase.prompt);
        if (sampleOutputs.length < 5) {
            sampleOutputs.push({
                prompt: testCase.prompt,
                intent
            });
        }
    }

    console.log(`AI Playlist Intent tests passed: ${cases.length}/${cases.length}`);
    console.log(JSON.stringify(sampleOutputs, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
