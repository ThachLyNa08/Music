const assert = require('assert');
const { normalizeAiPlaylistIntent } = require('../../src/services/aiPlaylistIntent.service');

async function parse(prompt, targetCount) {
    return normalizeAiPlaylistIntent({
        prompt,
        targetCount,
        useLLM: false
    });
}

(async () => {
    const durationPrompt = await parse('Tạo playlist USUK R&B đêm khuya khoảng 45 phút');
    assert.strictEqual(durationPrompt.hardConstraints.market, 'USUK');
    assert(durationPrompt.hardConstraints.genre_family.includes('rnb'));
    assert(durationPrompt.softPreferences.context.includes('night') || durationPrompt.softPreferences.context.includes('late_night'));
    assert.strictEqual(durationPrompt.playlist.target_count, 20);
    assert(!Object.prototype.hasOwnProperty.call(durationPrompt.playlist, 'duration_minutes'));

    const shortPlaylist = await parse('Playlist 10 bài để ngủ');
    assert.strictEqual(shortPlaylist.playlist.target_count, 10);
    assert(!Object.prototype.hasOwnProperty.call(shortPlaylist.playlist, 'duration_minutes'));

    const longPlaylist = await parse('Playlist 30 bài quẩy cuối tuần');
    assert.strictEqual(longPlaylist.playlist.target_count, 30);
    assert(!Object.prototype.hasOwnProperty.call(longPlaylist.playlist, 'duration_minutes'));

    const roundedPlaylist = await parse('Tạo playlist KPOP chill 15 bài');
    assert.strictEqual(roundedPlaylist.hardConstraints.market, 'KPOP');
    assert.strictEqual(roundedPlaylist.playlist.target_count, 20);
    assert(!Object.prototype.hasOwnProperty.call(roundedPlaylist.playlist, 'duration_minutes'));

    const strongBeat = await parse('Tao playlist KPOP beat manh de tap gym');
    assert.strictEqual(strongBeat.mode, 'beat_rhythm');
    assert.strictEqual(strongBeat.hardConstraints.market, 'KPOP');
    assert.strictEqual(strongBeat.softPreferences.energy, 'high');
    assert.strictEqual(strongBeat.softPreferences.tempo, 'fast');
    assert.strictEqual(strongBeat.softPreferences.activity, 'gym');
    assert.strictEqual(strongBeat.softPreferences.rhythm.beatStrength, 'high');

    const chillBeat = await parse('Tao playlist beat cham chill 20 bai');
    assert.strictEqual(chillBeat.mode, 'beat_rhythm');
    assert.strictEqual(chillBeat.playlist.target_count, 20);
    assert.strictEqual(chillBeat.softPreferences.energy, 'low');
    assert(chillBeat.negativeConstraints.energy.includes('high'));
    assert.strictEqual(chillBeat.softPreferences.rhythm.beatStrength, 'low_or_medium');

    const beatSimilar = await parse('Tao playlist co beat giong bai Duong toi cho em ve');
    assert.strictEqual(beatSimilar.mode, 'similar_to_song');
    assert.strictEqual(beatSimilar.seed.seed_type, 'song_seed');
    assert.strictEqual(beatSimilar.seed.song, 'Duong toi cho em ve');
    assert.strictEqual(beatSimilar.softPreferences.rhythm.groove, 'similar');

    const karaokeBeat = await parse('Tim beat karaoke cua bai Duong toi cho em ve');
    assert.strictEqual(karaokeBeat.mode, 'karaoke_instrumental');
    assert.strictEqual(karaokeBeat.seed.seed_type, 'song_seed');
    assert.strictEqual(karaokeBeat.seed.song, 'Duong toi cho em ve');
    assert.notStrictEqual(karaokeBeat.mode, 'beat_rhythm');

    const noBalladBeat = await parse('KPOP beat don dap khong lay ballad');
    assert.strictEqual(noBalladBeat.mode, 'beat_rhythm');
    assert.strictEqual(noBalladBeat.hardConstraints.market, 'KPOP');
    assert.strictEqual(noBalladBeat.softPreferences.energy, 'high');
    assert(noBalladBeat.negativeConstraints.genre_family.includes('ballad'));

    console.log('[AI Intent Router Cases] OK');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
