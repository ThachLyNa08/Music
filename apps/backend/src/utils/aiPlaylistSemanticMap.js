/**
 * aiPlaylistSemanticMap.js
 * 
 * Chuẩn hóa ngữ nghĩa tiếng Việt (từ lóng, ẩn dụ, từ đồng nghĩa) 
 * sang các thẻ (tags) chuẩn cho AI Playlist Song Matcher.
 */

function removeAccents(str) {
    if (!str) return '';
    return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

// Từ điển ngữ nghĩa
const SEMANTIC_DICTIONARY = [
    {
        names: ['ngon tinh', 'ngôn tình', 'lang man', 'lãng mạn', 'yeu duong', 'yêu đương', 'tinh yeu', 'tình yêu', 'dang yeu', 'đang yêu', 'moi yeu', 'mới yêu', 'crush', 'tha thinh', 'thả thính', 'ngot ngao', 'ngọt ngào', 'de thuong', 'dễ thương', 'mong mo', 'mộng mơ', 'hen ho', 'hẹn hò', 'yeu xa', 'yêu xa', 'couple', 'tinh cam', 'tình cảm', 'soft love', 'romantic', 'love song'],
        apply: { mood: 'romantic', context: 'love', energy: 'medium', tempo: 'medium' }
    },
    {
        names: ['buon', 'buồn', 'suy', 'nhac suy', 'nhạc suy', 'that tinh', 'thất tình', 'chia tay', 'luy', 'lụy', 'luy tinh', 'lụy tình', 'luy nguoi yeu cu', 'lụy người yêu cũ', 'nho nguoi yeu cu', 'nhớ người yêu cũ', 'co don', 'cô đơn', 'mot minh', 'một mình', 'dau long', 'đau lòng', 'day dut', 'day dứt', 'ton thuong', 'tổn thương', 'khoc', 'khóc', 'muon khoc', 'muốn khóc', 'tam trang', 'tâm trạng', 'dem buon', 'đêm buồn', 'ngay mua', 'ngày mưa', 'mua buon', 'mưa buồn', 'healing sau chia tay', 'sad', 'heartbreak', 'broken heart', 'lonely', 'emotional'],
        apply: { mood: 'sad', context: 'breakup', energy: 'low', tempo: 'slow' }
    },
    {
        names: ['chill', 'thu gian', 'thư giãn', 'nhe nhang', 'nhẹ nhàng', 'em', 'êm', 'diu', 'dịu', 'healing', 'chua lanh', 'chữa lành', 'binh yen', 'bình yên', 'yen tinh', 'yên tĩnh', 'cafe', 'cà phê', 'doc sach', 'đọc sách', 'nghi ngoi', 'nghỉ ngơi', 'buoi sang nhe nhang', 'buổi sáng nhẹ nhàng', 'acoustic nhe', 'acoustic nhẹ', 'cham', 'chậm', 'lofi', 'calm', 'peaceful', 'relaxing', 'soft'],
        apply: { mood: 'chill', context: 'relax', energy: 'low', tempo: 'slow' }
    },
    {
        names: ['hoc bai', 'học bài', 'hoc tap', 'học tập', 'lam viec', 'làm việc', 'lap trinh', 'lập trình', 'coding', 'code', 'chay deadline', 'chạy deadline', 'deadline', 'tap trung', 'tập trung', 'deep work', 'lam do an', 'làm đồ án', 'on thi', 'ôn thi', 'viet bao cao', 'viết báo cáo', 'lam luan van', 'làm luận văn', 'study', 'work', 'focus', 'productivity', 'concentration'],
        apply: { mood: 'focus', activity: 'study', energy: 'medium', tempo: 'medium' }
    },
    {
        names: ['tap gym', 'tập gym', 'gym', 'workout', 'the duc', 'thể dục', 'chay bo', 'chạy bộ', 'cardio', 'chay', 'cháy', 'boc', 'bốc', 'sung', 'mau lua', 'máu lửa', 'quay', 'quẩy', 'bung xoa', 'bung xõa', 'nhac chien', 'nhạc chiến', 'len mood', 'lên mood', 'tang dong luc', 'tăng động lực', 'energetic', 'hype', 'powerful', 'dance', 'edm'],
        apply: { mood: 'energetic', activity: 'workout', energy: 'high', tempo: 'fast' }
    },
    {
        names: ['tiec', 'tiệc', 'party', 'bar', 'club', 'nhay', 'nhảy', 'dance', 'remix', 'vinahouse', 'edm', 'quay', 'quẩy', 'bay', 'soi dong', 'sôi động', 'festival'],
        apply: { mood: 'party', energy: 'high', tempo: 'fast' }
    },
    {
        names: ['ngu', 'ngủ', 'de ngu', 'dễ ngủ', 'ru ngu', 'ru ngủ', 'khuya', 'dem khuya', 'đêm khuya', 'ban dem', 'ban đêm', 'buoi toi', 'buổi tối', 'toi', 'tối', 'truoc khi ngu', 'trước khi ngủ', 'nam nghe', 'nằm nghe', 'insomnia', 'sleep', 'sleepy', 'midnight', 'late night', 'evening'],
        apply: { mood: 'calm', context: 'night', energy: 'low', tempo: 'slow' }
    },
    {
        names: ['hoai niem', 'hoài niệm', 'ky niem', 'kỷ niệm', 'tuoi tho', 'tuổi thơ', 'ngay xua', 'ngày xưa', 'xua', 'xưa', 'cu', 'cũ', 'hoi do', 'hồi đó', 'thanh xuan', 'thanh xuân', 'ky uc', 'ký ức', 'nho lai', 'nhớ lại', 'nostalgia', 'throwback', 'old memories'],
        apply: { mood: 'nostalgic', context: 'memories', era: 'old' }
    }
];

// Từ điển Genre Aliases
const GENRE_ALIASES = [
    { names: ['vpop', 'viet', 'việt', 'nhac viet', 'nhạc việt', 'viet nam', 'việt nam', 'vietnamese'], genre: 'vpop', lang: 'vi' },
    { names: ['bolero', 'tru tinh', 'trữ tình', 'que huong', 'quê hương', 'dan ca', 'dân ca'], genre: 'bolero', lang: 'vi' },
    { names: ['rap viet', 'rap việt', 'hiphop viet', 'hiphop việt', 'rap', 'hip hop'], genre: 'rap', lang: 'vi' },
    { names: ['indie viet', 'indie việt', 'indie', 'chill indie'], genre: 'indie', lang: 'vi' },
    { names: ['kpop', 'han', 'hàn', 'han quoc', 'hàn quốc', 'korean', 'idol', 'girlgroup', 'boygroup'], genre: 'kpop', lang: 'ko' },
    { names: ['usuk', 'au my', 'âu mỹ', 'nhac my', 'nhạc mỹ', 'nhac anh', 'nhạc anh', 'english songs', 'us-uk', 'us uk'], genre: 'usuk', lang: 'en' },
    { names: ['r&b', 'rnb', 'usuk rnb', 'us-uk rnb', 'r n b'], genre: 'rnb', lang: 'any' },
    { names: ['pop au my', 'pop âu mỹ', 'pop'], genre: 'pop', lang: 'en' },
    { names: ['rap au my', 'rap âu mỹ', 'rap'], genre: 'rap', lang: 'en' },
    { names: ['rock', 'indie rock'], genre: 'rock', lang: 'any' }
];

exports.normalizeMarketFromPrompt = (prompt) => {
    if (!prompt) return null;
    const p = removeAccents(prompt.toLowerCase());
    
    // Ưu tiên check USUK trước
    const usukRegex = /\b(usuk|us-uk|us uk|au my|nhac au my|english|nhac my|nhac anh)\b/;
    if (usukRegex.test(p)) return 'USUK';
    
    // Check VPOP
    const vpopRegex = /\b(vpop|viet|nhac viet|nhac viet nam|vietnamese|viet nam)\b/;
    if (vpopRegex.test(p)) return 'VPOP';
    
    // Check KPOP (tránh bị dính chữ 'han' trong 'nhe nhang')
    const kpopRegex = /\b(kpop|k-pop|han|nhac han|korean|han quoc)\b/;
    if (kpopRegex.test(p)) return 'KPOP';
    
    return null;
};

function uniqueArray(arr) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter(item => item && typeof item === 'string').map(s => s.toLowerCase().trim()))];
}

exports.normalizeAiPlaylistIntent = (rawIntent, originalPrompt) => {
    const promptTokens = originalPrompt ? originalPrompt.toLowerCase().split(/[\s,.;&]+/) : [];
    const promptString = originalPrompt ? originalPrompt.toLowerCase() : '';
    const promptNoAccents = removeAccents(promptString);

    // Deep clone raw intent
    const normalized = JSON.parse(JSON.stringify(rawIntent));
    
    // Ensure arrays
    normalized.mood = uniqueArray(normalized.mood);
    normalized.context = uniqueArray(normalized.context);
    normalized.activity = uniqueArray(normalized.activity);
    normalized.genres = uniqueArray(normalized.genres);
    normalized.languages = uniqueArray(normalized.languages);
    normalized.vibe = uniqueArray(normalized.vibe);
    normalized.keywords = uniqueArray(normalized.keywords);
    
    // Scan prompt for semantic dictionary matches
    for (const dict of SEMANTIC_DICTIONARY) {
        let matched = false;
        for (const name of dict.names) {
            if (promptString.includes(name) || promptNoAccents.includes(name)) {
                matched = true;
                break;
            }
        }
        if (matched) {
            if (dict.apply.mood) normalized.mood.push(dict.apply.mood);
            if (dict.apply.context) normalized.context.push(dict.apply.context);
            if (dict.apply.activity) normalized.activity.push(dict.apply.activity);
            if (dict.apply.energy && !normalized.energy) normalized.energy = dict.apply.energy;
            if (dict.apply.tempo && !normalized.tempo) normalized.tempo = dict.apply.tempo;
            if (dict.apply.era && !normalized.era) normalized.era = dict.apply.era;
        }
    }

    // Scan for genre aliases
    for (const alias of GENRE_ALIASES) {
        let matched = false;
        for (const name of alias.names) {
            if (promptString.includes(name) || promptNoAccents.includes(name)) {
                matched = true;
                break;
            }
        }
        if (matched) {
            normalized.genres.push(alias.genre);
            if (alias.lang !== 'any') normalized.languages.push(alias.lang);
        }
    }

    // Also look at Gemini's keywords to map
    for (const kw of normalized.keywords) {
        const kwLower = kw.toLowerCase();
        const kwNoAccents = removeAccents(kwLower);

        for (const dict of SEMANTIC_DICTIONARY) {
            if (dict.names.includes(kwLower) || dict.names.includes(kwNoAccents)) {
                if (dict.apply.mood) normalized.mood.push(dict.apply.mood);
                if (dict.apply.context) normalized.context.push(dict.apply.context);
                if (dict.apply.activity) normalized.activity.push(dict.apply.activity);
                if (dict.apply.energy && !normalized.energy) normalized.energy = dict.apply.energy;
                if (dict.apply.tempo && !normalized.tempo) normalized.tempo = dict.apply.tempo;
                if (dict.apply.era && !normalized.era) normalized.era = dict.apply.era;
            }
        }
    }

    // Clean up arrays to unique
    normalized.mood = uniqueArray(normalized.mood);
    normalized.context = uniqueArray(normalized.context);
    normalized.activity = uniqueArray(normalized.activity);
    normalized.genres = uniqueArray(normalized.genres);
    normalized.languages = uniqueArray(normalized.languages);
    normalized.keywords = uniqueArray(normalized.keywords);

    // Force market if prompt indicates it
    const forcedMarket = exports.normalizeMarketFromPrompt(promptString);
    if (forcedMarket) {
        normalized.market = forcedMarket;
        
        // Remove contradictory tags
        if (forcedMarket === 'VPOP') {
            normalized.genres = normalized.genres.filter(g => g !== 'kpop' && g !== 'usuk');
            normalized.keywords = normalized.keywords.filter(k => !['kpop', 'k-pop', 'usuk', 'us-uk', 'korean', 'english'].includes(k.toLowerCase()));
        } else if (forcedMarket === 'KPOP') {
            normalized.genres = normalized.genres.filter(g => g !== 'vpop' && g !== 'usuk');
            normalized.keywords = normalized.keywords.filter(k => !['vpop', 'usuk', 'us-uk', 'vietnamese', 'english'].includes(k.toLowerCase()));
        } else if (forcedMarket === 'USUK') {
            normalized.genres = normalized.genres.filter(g => g !== 'vpop' && g !== 'kpop');
            normalized.keywords = normalized.keywords.filter(k => !['vpop', 'kpop', 'k-pop', 'vietnamese', 'korean'].includes(k.toLowerCase()));
        }
    }

    // Sinh title fallback nếu là Gợi ý từ MusicFlow
    if (normalized.playlistName === 'Gợi ý từ MusicFlow') {
        const titleParts = [];
        if (forcedMarket) {
            titleParts.push(forcedMarket === 'USUK' ? 'US-UK' : (forcedMarket === 'VPOP' ? 'V-POP' : (forcedMarket === 'KPOP' ? 'K-POP' : forcedMarket)));
        }
        
        const mainGenre = normalized.genres.find(g => !['vpop', 'kpop', 'usuk'].includes(g));
        if (mainGenre) {
            if (mainGenre === 'rnb') titleParts.push('R&B');
            else titleParts.push(mainGenre.toUpperCase());
        }
        
        const moodMap = {
            'chill': 'Chill', 'sad': 'Buồn', 'romantic': 'Ngôn Tình', 'energetic': 'Sôi Động', 
            'focus': 'Tập Trung', 'party': 'Quẩy', 'calm': 'Nhẹ Nhàng', 'nostalgic': 'Hoài Niệm'
        };
        const activityMap = { 'study': 'Học Tập', 'workout': 'Tập Gym' };
        const contextMap = { 'night': 'Buổi Tối', 'rain': 'Ngày Mưa', 'relax': 'Thư Giãn', 'breakup': 'Sau Chia Tay', 'love': 'Đang Yêu' };

        if (normalized.mood.length > 0) titleParts.push(moodMap[normalized.mood[0]] || normalized.mood[0]);
        else if (normalized.activity.length > 0) titleParts.push(activityMap[normalized.activity[0]] || normalized.activity[0]);
        else if (normalized.context.length > 0) titleParts.push(contextMap[normalized.context[0]] || normalized.context[0]);

        if (titleParts.length > 0) {
            normalized.playlistName = titleParts.join(' ');
        }
    }

    return { rawIntent, normalizedIntent: normalized };
};
