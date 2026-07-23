/**
 * Smart Content Moderation Service (Rule-based Scoring MVP)
 * Whitelisted Flags:
 * - missing_cover
 * - missing_lyrics
 * - new_artist
 * - duplicate_title
 * - duplicate_audio_pending
 * - resubmitted_multiple_times
 * - incomplete_metadata
 * - unusual_duration
 * - few_album_songs
 * - unapproved_album_song
 * - missing_description
 */

const ALLOWED_FLAGS = new Set([
  'missing_cover',
  'missing_lyrics',
  'new_artist',
  'duplicate_title',
  'duplicate_audio_pending',
  'resubmitted_multiple_times',
  'incomplete_metadata',
  'unusual_duration',
  'few_album_songs',
  'unapproved_album_song',
  'missing_description',
]);

function computeModerationLevel(riskScore) {
  if (riskScore <= 30) return 'low';
  if (riskScore <= 60) return 'medium';
  return 'high';
}

function filterFlags(flags) {
  return Array.from(new Set(flags.filter(f => ALLOWED_FLAGS.has(f))));
}

/**
 * Evaluate Song Submission / Resubmission
 */
function evaluateSongSubmission(songData = {}, artistData = {}) {
  const {
    title,
    coverUrl,
    audioUrl,
    lyrics,
    genreId,
    submissionNote,
    duration,
    resubmissionCount = 0,
  } = songData;

  const {
    approvedSongCount = 0,
    duplicateTitleCount = 0,
    duplicateAudioStatus = null,
  } = artistData;

  let metadataScore = 100;
  let riskScore = 0;
  const flags = [];

  // Metadata Score deductions
  if (!coverUrl) {
    metadataScore -= 15;
    flags.push('missing_cover');
  }
  if (!lyrics || !String(lyrics).trim()) {
    metadataScore -= 10;
    flags.push('missing_lyrics');
  }
  if (!title || String(title).trim().length < 3) {
    metadataScore -= 10;
  }
  if (!audioUrl) {
    metadataScore -= 40;
  }
  if (!genreId) {
    metadataScore -= 20;
  }
  if (!submissionNote || !String(submissionNote).trim()) {
    metadataScore -= 5;
  }

  // Duration check for unusual duration only if valid duration > 0 is provided
  const numDuration = Number(duration);
  if (numDuration > 0 && (numDuration < 30 || numDuration > 600)) {
    riskScore += 20;
    flags.push('unusual_duration');
  }

  metadataScore = Math.max(0, Math.min(100, metadataScore));

  if (metadataScore < 70) {
    flags.push('incomplete_metadata');
  }

  // Risk Score additions
  if (approvedSongCount < 3) {
    riskScore += 20;
    flags.push('new_artist');
  }
  if (resubmissionCount >= 1) {
    riskScore += 15;
  }
  if (resubmissionCount >= 2) {
    riskScore += 25;
    flags.push('resubmitted_multiple_times');
  }
  if (duplicateTitleCount > 0) {
    riskScore += 20;
    flags.push('duplicate_title');
  }
  if (!coverUrl) {
    riskScore += 15;
  }
  if (!lyrics || !String(lyrics).trim()) {
    riskScore += 10;
  }

  // Duplicate Audio status scoring
  let forceHighRisk = false;
  if (duplicateAudioStatus === 'pending_review') {
    riskScore += 50;
    flags.push('duplicate_audio_pending');
    forceHighRisk = true;
  }

  let moderationLevel = computeModerationLevel(riskScore);
  if (forceHighRisk) {
    moderationLevel = 'high';
  }

  const moderationFlags = filterFlags(flags);

  return {
    metadataScore,
    riskScore,
    moderationLevel,
    moderationFlags,
  };
}

/**
 * Evaluate Album Submission / Resubmission
 */
function evaluateAlbumSubmission(albumData = {}, songs = [], artistData = {}) {
  const {
    title,
    coverUrl,
    description,
    submissionNote,
    resubmissionCount = 0,
  } = albumData;

  const {
    approvedSongCount = 0,
    duplicateTitleCount = 0,
  } = artistData;

  let metadataScore = 100;
  let riskScore = 0;
  const flags = [];

  // Metadata Score deductions
  if (!coverUrl) {
    metadataScore -= 15;
    flags.push('missing_cover');
  }
  if (!description || !String(description).trim()) {
    metadataScore -= 10;
    flags.push('missing_description');
  }
  if (!Array.isArray(songs) || songs.length === 0) {
    metadataScore -= 40;
  }
  if (!title || String(title).trim().length < 2) {
    metadataScore -= 20;
  }
  if (!submissionNote || !String(submissionNote).trim()) {
    metadataScore -= 5;
  }

  metadataScore = Math.max(0, Math.min(100, metadataScore));

  if (metadataScore < 70) {
    flags.push('incomplete_metadata');
  }

  // Risk Score additions
  if (approvedSongCount < 3) {
    riskScore += 20;
    flags.push('new_artist');
  }
  if (resubmissionCount >= 1) {
    riskScore += 15;
  }
  if (resubmissionCount >= 2) {
    riskScore += 25;
    flags.push('resubmitted_multiple_times');
  }
  if (duplicateTitleCount > 0) {
    riskScore += 20;
    flags.push('duplicate_title');
  }
  if (!Array.isArray(songs) || songs.length < 2) {
    riskScore += 10;
    flags.push('few_album_songs');
  }

  const hasUnapprovedSong = Array.isArray(songs) && songs.some(s => s.review_status !== 'approved' && s.reviewStatus !== 'approved');
  if (hasUnapprovedSong) {
    riskScore += 30;
    flags.push('unapproved_album_song');
  }

  const moderationLevel = computeModerationLevel(riskScore);
  const moderationFlags = filterFlags(flags);

  return {
    metadataScore,
    riskScore,
    moderationLevel,
    moderationFlags,
  };
}

module.exports = {
  evaluateSongSubmission,
  evaluateAlbumSubmission,
  ALLOWED_FLAGS,
};
