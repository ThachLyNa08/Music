const SYNONYM_RULES = [
    {
        id: 'sad',
        phrases: ['buon', 'buon buon', 'tam trang', 'tram', 'nang long', 'co don', 'mot minh'],
        apply: {
            mood: ['sad'],
            context: ['lonely'],
            energy: 'low',
            tempo: 'slow'
        }
    },
    {
        id: 'heartbreak',
        phrases: ['suy', 'luy', 'that tinh', 'chia tay', 'sau chia tay', 'dau long', 'nho nguoi cu', 'tan vo', 'that vong tinh yeu', 'bi luy'],
        apply: {
            mood: ['heartbreak'],
            context: ['breakup', 'lonely'],
            energy: 'low',
            tempo: 'slow',
            mood_intensity: 'deep'
        }
    },
    {
        id: 'healing',
        phrases: ['healing', 'chua lanh', 'chua lanh sau chia tay', 'tu chua lanh', 'vuot qua chia tay'],
        apply: {
            mood: ['calm', 'heartbreak'],
            context: ['breakup'],
            energy: 'low',
            tempo: 'slow',
            mood_intensity: 'medium'
        }
    },
    {
        id: 'chill_calm',
        phrases: ['chill', 'nhe nhang', 'em', 'thu gian', 'de nghe', 'nhe dau', 'khong gat', 'khong on', 'diu', 'binh yen', 'buoi toi', 'toi', 'cham', 'lofi'],
        apply: {
            mood: ['chill', 'calm'],
            energy: 'low',
            tempo: 'slow'
        }
    },
    {
        id: 'focus',
        phrases: ['hoc bai', 'lam viec', 'coding', 'lap trinh', 'deadline', 'chay deadline', 'tap trung', 'khong bi phan tam', 'study', 'focus', 'work', 'reading'],
        apply: {
            mood: ['focus'],
            energy: 'medium',
            tempo: 'medium'
        }
    },
    {
        id: 'energetic_party',
        phrases: ['nang luong', 'day nang luong', 'high energy', 'energetic', 'workout', 'dance', 'chay bo', 'that chay', 'quay', 'boc', 'sung', 'soi dong', 'nao nhiet', 'tap gym', 'van dong', 'mau lua'],
        apply: {
            mood: ['energetic', 'party'],
            energy: 'high',
            tempo: 'fast'
        }
    },
    {
        id: 'romantic',
        phrases: ['ngon tinh', 'tinh cam', 'yeu doi', 'ngot', 'ngot ngao', 'lang man', 'yeu', 'de thuong'],
        apply: {
            mood: ['romantic'],
            context: ['love'],
            energy: 'medium',
            tempo: 'medium'
        }
    },
    {
        id: 'happy',
        phrases: ['vui', 'vui ve', 'yeu doi', 'tich cuc', 'doi vui'],
        apply: {
            mood: ['happy'],
            energy: 'medium',
            tempo: 'medium'
        }
    },
    {
        id: 'nostalgic',
        phrases: ['hoai niem', 'xua', 'cu', 'ky niem', 'tuoi tho', 'ngay xua', 'sau lang', 'co chieu sau', 'lang dong'],
        apply: {
            mood: ['nostalgic', 'calm'],
            context: ['nostalgia'],
            energy: 'low',
            tempo: 'slow'
        }
    },
    {
        id: 'motivational',
        phrases: ['dong luc', 'truyen cam hung', 'co gang', 'vuot qua', 'len tinh than'],
        apply: {
            mood: ['motivational'],
            energy: 'high',
            tempo: 'fast'
        }
    }
];

const MARKET_RULES = [
    { market: 'VPOP', language: 'vi', phrases: ['vpop', 'v-pop', 'nhac viet', 'nhac viet nam', 'viet nam', 'rap viet', 'pop viet', 'vietnamese'] },
    { market: 'KPOP', language: 'ko', phrases: ['kpop', 'k-pop', 'nhac han', 'han quoc', 'korean'] },
    { market: 'USUK', language: 'en', phrases: ['usuk', 'us-uk', 'us uk', 'au my', 'nhac au my', 'nhac my', 'nhac anh', 'english'] }
];

const GENRE_RULES = [
    { genre: 'pop', phrases: ['pop', 'nhac tre', 'tre tre'] },
    { genre: 'ballad', phrases: ['ballad', 'tinh ca'] },
    { genre: 'rap_hiphop', phrases: ['rap', 'hiphop', 'hip hop', 'rap viet'] },
    { genre: 'rnb', phrases: ['r&b', 'rnb', 'r n b'] },
    { genre: 'edm', phrases: ['edm', 'remix', 'vinahouse'] },
    { genre: 'rock_indie', phrases: ['rock', 'indie', 'indie rock'] },
    { genre: 'bolero_folk', phrases: ['bolero', 'tru tinh', 'dan ca', 'que huong'] },
    { genre: 'acoustic', phrases: ['acoustic', 'moc'] },
    { genre: 'lofi', phrases: ['lofi', 'lo-fi'] },
    { genre: 'dance', phrases: ['dance', 'nhay'] }
];

const ACTIVITY_RULES = [
    { activity: 'study', phrases: ['hoc bai', 'hoc tap', 'on thi', 'study'] },
    { activity: 'coding', phrases: ['coding', 'code', 'lap trinh'] },
    { activity: 'work', phrases: ['lam viec', 'deadline', 'chay deadline', 'tap trung', 'focus', 'work', 'reading'] },
    { activity: 'gym', phrases: ['tap gym', 'gym', 'workout', 'the duc', 'van dong', 'dance'] },
    { activity: 'relax', phrases: ['thu gian', 'nghi ngoi', 'relax', 'buoi toi', 'toi', 'chill'] },
    { activity: 'sleep', phrases: ['ngu', 'de ngu', 'ru ngu'] },
    { activity: 'party', phrases: ['party', 'tiec', 'quay', 'club', 'bar'] },
    { activity: 'travel', phrases: ['du lich', 'di choi', 'di xa'] },
    { activity: 'coffee', phrases: ['ca phe', 'cafe', 'coffee'] },
    { activity: 'driving', phrases: ['lai xe', 'di xe', 'driving'] },
    { activity: 'healing', phrases: ['healing', 'chua lanh'] }
];

const CONTEXT_RULES = [
    { context: 'morning', phrases: ['sang', 'buoi sang'] },
    { context: 'afternoon', phrases: ['chieu', 'buoi chieu'] },
    { context: 'night', phrases: ['buoi toi', 'toi nay', 'ban dem', 'dem', 'toi'] },
    { context: 'late_night', phrases: ['khuya', 'dem muon', 'dem khuya'] },
    { context: 'rain', phrases: ['mua', 'troi mua', 'ngay mua'] },
    { context: 'deadline', phrases: ['deadline', 'chay deadline'] },
    { context: 'breakup', phrases: ['chia tay', 'that tinh', 'tan vo'] },
    { context: 'lonely', phrases: ['co don', 'mot minh'] },
    { context: 'love', phrases: ['tinh yeu', 'yeu', 'lang man'] },
    { context: 'nostalgia', phrases: ['hoai niem', 'ky niem', 'ngay xua', 'tuoi tho'] },
    { context: 'weekend', phrases: ['cuoi tuan'] }
];

const FAMILIARITY_RULES = [
    { familiarity: 'familiar', phrases: ['quen quen', 'bai quen', 'bai hay nghe', 'gu cua toi'] },
    { familiarity: 'discover', phrases: ['bai moi', 'kham pha', 'it nguoi biet', 'la la'] }
];

const POPULARITY_RULES = [
    { popularity: 'hidden_gems', phrases: ['hidden gem', 'hidden gems', 'it noi', 'it nguoi biet'] },
    { popularity: 'trending', phrases: ['dang hot', 'thinh hanh', 'viral', 'trend'] },
    { popularity: 'popular', phrases: ['noi tieng', 'pho bien', 'hit'] }
];

const DIVERSITY_RULES = [
    { diversity: 'diverse_artist', phrases: ['dung toan mot ca si', 'nhieu nghe si', 'da dang ca si', 'nhieu ca si'] },
    { diversity: 'diverse_genre', phrases: ['nhieu the loai', 'doi vibe mot chut', 'da dang the loai'] },
    { diversity: 'same_vibe', phrases: ['cung vibe', 'cung kieu', 'giong vibe'] }
];

const NEGATIVE_RULES = [
    {
        id: 'avoid_heartbreak',
        phrases: ['dung qua tham', 'khong qua tham', 'dung qua bi luy', 'khong qua bi luy', 'dung qua luy', 'khong qua luy'],
        apply: { mood: ['heartbreak'], keywords: ['qua tham', 'bi luy'], mood_intensity: 'light' }
    },
    {
        id: 'avoid_noise',
        phrases: ['khong qua on', 'dung qua on', 'khong on', 'khong gat', 'dung qua nao nhiet', 'khong qua nao nhiet'],
        apply: { mood: ['party'], energy: ['high'], keywords: ['on ao', 'nao nhiet'], energyValue: 'medium' }
    },
    {
        id: 'avoid_dance',
        phrases: ['dung qua dance', 'khong qua dance', 'tranh dance'],
        apply: { genre_family: ['dance'], mood: ['party'], energy: ['high'], keywords: ['dance'] }
    },
    {
        id: 'avoid_sad',
        phrases: ['khong buon', 'dung buon', 'tranh nhac buon'],
        apply: { mood: ['sad', 'heartbreak'], keywords: ['buon'] }
    },
    {
        id: 'avoid_rap',
        phrases: ['khong rap', 'dung rap', 'tranh rap'],
        apply: { genre_family: ['rap_hiphop'], keywords: ['rap'] }
    },
    {
        id: 'avoid_ballad',
        phrases: ['khong ballad', 'khong lay ballad', 'dung ballad', 'dung co ballad', 'loai tru ballad', 'tru ballad', 'tranh ballad'],
        apply: { genre_family: ['ballad'], keywords: ['ballad'] }
    },
    {
        id: 'less_vocal',
        phrases: ['it loi', 'khong loi', 'khong bi phan tam', 'instrumental', 'nhac nen'],
        apply: { vocal_preference: 'less_vocal', keywords: ['it loi'] }
    }
];

module.exports = {
    SYNONYM_RULES,
    MARKET_RULES,
    GENRE_RULES,
    ACTIVITY_RULES,
    CONTEXT_RULES,
    FAMILIARITY_RULES,
    POPULARITY_RULES,
    DIVERSITY_RULES,
    NEGATIVE_RULES
};
