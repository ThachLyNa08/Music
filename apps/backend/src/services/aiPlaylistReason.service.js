function hasAny(values, expected) {
    const set = new Set((values || []).map((value) => String(value).toLowerCase()));
    return expected.some((value) => set.has(String(value).toLowerCase()));
}

function buildAiPlaylistSongReason(song, intent, scoreBreakdown = {}) {
    const parts = [];
    const hard = intent?.hardConstraints || {};
    const soft = intent?.softPreferences || {};

    if (hard.market && hard.market !== 'ANY' && String(song.market || '').toUpperCase() === hard.market) {
        parts.push(`thuộc ${hard.market}`);
    }

    if (hard.genre_family?.length && song.genre_family && hard.genre_family.includes(song.genre_family)) {
        parts.push(`đúng nhóm ${song.genre_family}`);
    }

    if (soft.tempo === 'slow' && (song.tempo_level === 'slow' || Number(song.bpm || 0) < 90)) {
        parts.push('giai điệu chậm');
    } else if (soft.tempo === 'fast' && (song.tempo_level === 'fast' || Number(song.bpm || 0) >= 115)) {
        parts.push('tiết tấu nhanh');
    }

    if (soft.energy === 'low' && (song.energy === 'low' || Number(song.energy_score || 0) <= 0.45)) {
        parts.push('năng lượng nhẹ');
    } else if (soft.energy === 'high' && (song.energy === 'high' || Number(song.energy_score || 0) >= 0.65)) {
        parts.push('năng lượng cao');
    } else if (soft.energy === 'medium') {
        parts.push('năng lượng vừa phải');
    }

    if (hasAny(soft.mood, ['sad', 'heartbreak']) && hasAny([song.mood, song.vibe], ['sad', 'heartbreak', 'ballad'])) {
        parts.push('hợp không khí buồn');
    } else if (hasAny(soft.mood, ['chill', 'calm']) && hasAny([song.mood, song.vibe], ['chill', 'calm', 'acoustic'])) {
        parts.push('hợp vibe thư giãn');
    } else if (hasAny(soft.mood, ['energetic', 'party']) && (song.energy === 'high' || Number(song.danceability || 0) >= 0.65)) {
        parts.push('có độ sôi động tốt');
    } else if (hasAny(soft.mood, ['focus']) && soft.activity) {
        parts.push('phù hợp khi cần tập trung');
    }

    if (scoreBreakdown.bpr >= 0.55) {
        parts.push('gần với gu nghe gần đây của bạn');
    } else if (scoreBreakdown.userHistory >= 0.55) {
        parts.push('liên quan đến nghệ sĩ hoặc thể loại bạn từng nghe');
    }

    if (!parts.length && scoreBreakdown.intentMatch >= 0.55) {
        parts.push('khớp nhiều tín hiệu trong yêu cầu');
    }
    if (!parts.length && scoreBreakdown.popularity >= 0.55) {
        parts.push('được nghe nhiều trong hệ thống');
    }

    const detail = parts.slice(0, 3).join(', ');
    if (!detail) {
        return 'Được chọn như một gợi ý cân bằng khi chưa có đủ tín hiệu mạnh từ dữ liệu.';
    }

    return `Phù hợp vì ${detail}.`;
}

module.exports = {
    buildAiPlaylistSongReason
};
