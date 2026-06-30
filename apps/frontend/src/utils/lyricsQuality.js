/**
 * Helper function to validate lyrics quality
 * @param {string} text - The lyrics text to evaluate
 * @param {string} title - The song title (optional)
 * @param {string} artist - The song artist (optional)
 * @returns {Object} { isLowQuality: boolean, reason: string, stats: Object }
 */
export function checkLyricsQuality(text, title = '', artist = '') {
  const result = {
    isLowQuality: false,
    reason: null,
    warnings: [],
    needsReview: false,
    stats: { plainLength: 0, lineCount: 0, uniqueLineRatio: 0, maxRepeatedLineRatio: 0 }
  };

  if (!text || typeof text !== 'string') {
    result.isLowQuality = true;
    result.reason = 'lyrics_empty';
    return result;
  }

  const cleanText = text.trim();
  const plainLength = cleanText.length;
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const lineCount = lines.length;

  result.stats.plainLength = plainLength;
  result.stats.lineCount = lineCount;

  if (plainLength < 30 && lineCount < 2) {
    result.isLowQuality = true;
    result.reason = 'lyrics_too_short';
    return result;
  }

  const lineOccurrences = {};
  let maxRepeatedLineCount = 0;
  
  lines.forEach(line => {
    const normLine = line.toLowerCase();
    lineOccurrences[normLine] = (lineOccurrences[normLine] || 0) + 1;
    if (lineOccurrences[normLine] > maxRepeatedLineCount) {
      maxRepeatedLineCount = lineOccurrences[normLine];
    }
  });

  const uniqueLineCount = Object.keys(lineOccurrences).length;
  const uniqueLineRatio = lineCount > 0 ? uniqueLineCount / lineCount : 0;
  const maxRepeatedLineRatio = lineCount > 0 ? maxRepeatedLineCount / lineCount : 0;

  result.stats.uniqueLineRatio = uniqueLineRatio;
  result.stats.maxRepeatedLineRatio = maxRepeatedLineRatio;

  if (maxRepeatedLineRatio > 0.5) {
    result.warnings.push('lyrics_repeated_lines');
    result.needsReview = true;
  } else if (uniqueLineRatio < 0.20 && lineCount >= 8) {
    result.warnings.push('lyrics_low_unique_ratio');
    result.needsReview = true;
  }

  // Check if lyrics is just the title/artist repeated
  const uniqueLinesArr = Object.keys(lineOccurrences);
  const safeTitle = (title || '').toLowerCase().trim();
  const safeArtist = (artist || '').toLowerCase().trim();
  
  if (safeTitle || safeArtist) {
    let allLinesAreJustMetadata = true;
    for (const line of uniqueLinesArr) {
      // Remove basic punctuation to check metadata
      const cleanLine = line.replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, '').trim();
      const matchTitle = safeTitle && (cleanLine === safeTitle || cleanLine.includes(safeTitle) || safeTitle.includes(cleanLine));
      const matchArtist = safeArtist && (cleanLine === safeArtist || cleanLine.includes(safeArtist) || safeArtist.includes(cleanLine));
      
      if (!matchTitle && !matchArtist) {
        allLinesAreJustMetadata = false;
        break;
      }
    }
    
    if (allLinesAreJustMetadata) {
      result.isLowQuality = true;
      result.reason = 'lyrics_artist_or_title_only';
    }
  }

  return result;
}
