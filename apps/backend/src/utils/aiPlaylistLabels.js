const AI_PLAYLIST_LABELS = Object.freeze({
    market: ['VPOP', 'KPOP', 'USUK', 'ANY'],
    language: ['vi', 'ko', 'en', 'any'],
    genre_family: [
        'pop',
        'ballad',
        'rap_hiphop',
        'rnb',
        'edm',
        'rock_indie',
        'bolero_folk',
        'acoustic',
        'lofi',
        'dance',
        'any'
    ],
    mood: [
        'sad',
        'heartbreak',
        'chill',
        'calm',
        'romantic',
        'happy',
        'energetic',
        'party',
        'focus',
        'nostalgic',
        'motivational'
    ],
    mood_intensity: ['light', 'medium', 'deep'],
    tempo: ['slow', 'medium', 'fast'],
    energy: ['low', 'medium', 'high'],
    activity: ['study', 'coding', 'work', 'gym', 'relax', 'sleep', 'party', 'travel', 'coffee', 'driving', 'healing'],
    context: [
        'morning',
        'afternoon',
        'night',
        'late_night',
        'rain',
        'deadline',
        'breakup',
        'lonely',
        'love',
        'nostalgia',
        'weekend'
    ],
    vocal_preference: ['vocal', 'less_vocal', 'instrumental_like', 'any'],
    familiarity: ['familiar', 'discover', 'balanced'],
    popularity: ['trending', 'popular', 'hidden_gems', 'balanced'],
    diversity: ['same_vibe', 'diverse_artist', 'diverse_genre', 'balanced'],
    seed_type: ['artist_seed', 'song_seed', 'genre_seed', 'mood_seed', 'none'],
    playlist_goal: ['create_playlist', 'quick_mix', 'explore', 'replay_favorites']
});

const LABEL_SETS = Object.freeze(
    Object.fromEntries(Object.entries(AI_PLAYLIST_LABELS).map(([key, values]) => [key, new Set(values)]))
);

function isValidLabel(group, value) {
    return LABEL_SETS[group]?.has(value) || false;
}

function filterValidLabels(group, values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value) => isValidLabel(group, value)))];
}

module.exports = {
    AI_PLAYLIST_LABELS,
    LABEL_SETS,
    isValidLabel,
    filterValidLabels
};
