const CONFUSABLE_CHAR_MAP = new Map(Object.entries({
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043e': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0443': 'y',
  '\u0445': 'x',
  '\u0456': 'i',
  '\u0458': 'j',
  '\u0455': 's',
}));

function replaceConfusables(value = '') {
  return Array.from(String(value || ''), ch => CONFUSABLE_CHAR_MAP.get(ch) || ch).join('');
}

function normalizeVietnamese(value = '') {
  return replaceConfusables(String(value || '').normalize('NFKC'))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLyricsQueryIntent(query = '') {
  let normalized = normalizeVietnamese(query);
  const intentPrefixes = [
    /^bai nao co loi\b/,
    /^bai hat nao co loi\b/,
    /^bai co loi\b/,
    /^tim bai co cau\b/,
    /^tim bai hat co cau\b/,
    /^tim bai co doan\b/,
    /^tim bai hat co doan\b/,
    /^bai hat co doan\b/,
    /^bai co doan\b/,
    /^loi bai hat\b/,
    /^cau hat\b/,
    /^lyrics\b/,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of intentPrefixes) {
      const next = normalized.replace(pattern, '').trim();
      if (next !== normalized) {
        normalized = next;
        changed = true;
      }
    }
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  normalizeVietnamese,
  normalizeLyricsQueryIntent,
  escapeHtml,
};
