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
    /^tim kiem bai hat co loi\b/,
    /^tim kiem bai co loi\b/,
    /^tim kiem loi bai hat\b/,
    /^tim kiem loi bai\b/,
    /^tim kiem loi\b/,
    /^tim kiem lyrics\b/,
    /^tim kiem lyric\b/,
    /^tim bai hat bang loi\b/,
    /^tim bai bang loi\b/,
    /^bai nao co loi\b/,
    /^bai hat nao co loi\b/,
    /^bai gi co loi\b/,
    /^bai hat gi co loi\b/,
    /^bai hat co loi\b/,
    /^bai co loi\b/,
    /^tim bai co loi\b/,
    /^tim bai hat co loi\b/,
    /^tim bai nao co loi\b/,
    /^tim bai hat nao co loi\b/,
    /^tim bai gi co loi\b/,
    /^tim bai hat gi co loi\b/,
    /^co bai nao co loi\b/,
    /^co bai hat nao co loi\b/,
    /^co bai gi co loi\b/,
    /^co bai hat gi co loi\b/,
    /^nhac nao co loi\b/,
    /^nhac gi co loi\b/,
    /^nhac co loi\b/,
    /^ten bai co loi\b/,
    /^ten bai hat co loi\b/,
    /^bai nao co cau hat\b/,
    /^bai hat nao co cau hat\b/,
    /^bai gi co cau hat\b/,
    /^bai hat gi co cau hat\b/,
    /^bai nao co cau\b/,
    /^bai hat nao co cau\b/,
    /^bai gi co cau\b/,
    /^bai hat gi co cau\b/,
    /^bai co cau hat\b/,
    /^bai hat co cau hat\b/,
    /^bai co cau\b/,
    /^bai hat co cau\b/,
    /^tim bai co cau\b/,
    /^tim bai hat co cau\b/,
    /^tim bai nao co cau\b/,
    /^tim bai hat nao co cau\b/,
    /^tim bai gi co cau\b/,
    /^tim bai hat gi co cau\b/,
    /^co bai nao co cau\b/,
    /^co bai hat nao co cau\b/,
    /^co bai gi co cau\b/,
    /^co bai hat gi co cau\b/,
    /^nhac nao co cau\b/,
    /^nhac gi co cau\b/,
    /^nhac co cau\b/,
    /^ten bai co cau\b/,
    /^ten bai hat co cau\b/,
    /^bai nao co doan loi\b/,
    /^bai hat nao co doan loi\b/,
    /^bai gi co doan loi\b/,
    /^bai hat gi co doan loi\b/,
    /^bai nao co doan hat\b/,
    /^bai hat nao co doan hat\b/,
    /^bai gi co doan hat\b/,
    /^bai hat gi co doan hat\b/,
    /^bai nao co doan\b/,
    /^bai hat nao co doan\b/,
    /^bai gi co doan\b/,
    /^bai hat gi co doan\b/,
    /^bai co doan loi\b/,
    /^bai hat co doan loi\b/,
    /^bai co doan hat\b/,
    /^bai hat co doan hat\b/,
    /^tim bai co doan\b/,
    /^tim bai hat co doan\b/,
    /^tim bai nao co doan\b/,
    /^tim bai hat nao co doan\b/,
    /^tim bai gi co doan\b/,
    /^tim bai hat gi co doan\b/,
    /^bai hat co doan\b/,
    /^bai co doan\b/,
    /^bai nao hat cau\b/,
    /^bai hat nao hat cau\b/,
    /^bai gi hat cau\b/,
    /^bai hat gi hat cau\b/,
    /^bai nao hat\b/,
    /^bai hat nao hat\b/,
    /^bai gi hat\b/,
    /^bai hat gi hat\b/,
    /^tim bai nao hat\b/,
    /^tim bai hat nao hat\b/,
    /^tim bai gi hat\b/,
    /^tim bai hat gi hat\b/,
    /^co bai nao hat\b/,
    /^co bai hat nao hat\b/,
    /^co bai gi hat\b/,
    /^co bai hat gi hat\b/,
    /^nghe cau\b/,
    /^nghe doan\b/,
    /^nho cau\b/,
    /^nho doan\b/,
    /^nho loi\b/,
    /^nho loi bai hat\b/,
    /^toi nho cau\b/,
    /^toi nho doan\b/,
    /^toi nho loi\b/,
    /^minh nho cau\b/,
    /^minh nho doan\b/,
    /^minh nho loi\b/,
    /^loi bai nay la\b/,
    /^loi bai hat nay la\b/,
    /^loi doan nay la\b/,
    /^loi cau nay la\b/,
    /^loi cua bai\b/,
    /^loi trong bai\b/,
    /^loi bai hat\b/,
    /^loi bai\b/,
    /^tim loi bai hat\b/,
    /^tim loi bai\b/,
    /^tim loi\b/,
    /^tim lyrics\b/,
    /^tim lyric\b/,
    /^cau hat trong bai\b/,
    /^doan hat trong bai\b/,
    /^doan loi trong bai\b/,
    /^cau loi\b/,
    /^cau hat\b/,
    /^doan hat\b/,
    /^doan loi\b/,
    /^lyrics cua bai\b/,
    /^lyric cua bai\b/,
    /^lyrics\b/,
    /^lyric\b/,
    /^loi\b/,
  ];
  const genericLyricsIntentPrefixes = [
    // "Bai gi/nao ma co cau/doan/loi ..."
    /^bai(?: hat)? (?:gi|nao)(?: ma)? co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^co bai(?: hat)? (?:gi|nao)(?: ma)? co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^nhac(?: gi| nao)?(?: ma)? co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^ten bai(?: hat)?(?: nao| gi)?(?: ma)? co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,

    // "Bai nao/bai hat nao chua cau...", "tim bai chua cau..."
    /^bai(?: hat)? (?:gi|nao)(?: ma)? chua (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^bai(?: hat)? chua (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^tim bai(?: hat)?(?: nao| gi)? chua (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,

    // "Tim bai tu cau/loi...", "tim bai dua vao loi..."
    /^tim bai(?: hat)?(?: nao| gi)? tu (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^tim bai(?: hat)?(?: nao| gi)? dua vao (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^tim bai(?: hat)?(?: nao| gi)? bang (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,

    // "Day la loi bai gi...", "cau nay la bai gi..."
    /^day la (?:loi|cau|doan) bai(?: hat)? (?:gi|nao)\b/,
    /^(?:cau|doan|loi) nay la bai(?: hat)? (?:gi|nao)\b/,
    /^(?:cau|doan|loi) nay (?:nam trong|thuoc|o trong|co trong) bai(?: hat)? (?:gi|nao)\b/,

    // "Minh/toi nho mang mang cau...", "toi nho la cau..."
    /^(?:minh|toi) nho mang mang (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^(?:minh|toi) nho la (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^(?:minh|toi) nho (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,

    // Soft memories: "hinh nhu co cau...", "co cau hat..."
    /^hinh nhu co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
    /^co (?:cau hat|cau|doan loi|doan hat|doan|loi)\b/,
  ];
  const intentSuffixes = [
    /\btrong bai hat gi$/,
    /\btrong bai hat nao$/,
    /\btrong bai gi$/,
    /\btrong bai nao$/,
    /\bcua bai hat gi$/,
    /\bcua bai hat nao$/,
    /\bcua bai gi$/,
    /\bcua bai nao$/,
    /\bla loi bai hat gi$/,
    /\bla loi bai hat nao$/,
    /\bla loi bai gi$/,
    /\bla loi bai nao$/,
    /\bla bai hat gi$/,
    /\bla bai hat nao$/,
    /\bla bai gi$/,
    /\bla bai nao$/,
    /\bten bai hat gi$/,
    /\bten bai hat nao$/,
    /\bten bai gi$/,
    /\bten bai nao$/,
    /\bbai hat gi$/,
    /\bbai hat nao$/,
    /\bbai gi$/,
    /\bbai nao$/,
  ];
  const genericLyricsIntentSuffixes = [
    /\bnam trong bai hat nao$/,
    /\bnam trong bai nao$/,
    /\bthuoc bai hat nao$/,
    /\bthuoc bai nao$/,
    /\bla cua bai hat nao$/,
    /\bla cua bai nao$/,
    /\btrong bai hat nao$/,
    /\btrong bai nao$/,
    /\bla bai hat gi$/,
    /\bla bai hat nao$/,
    /\bla bai gi$/,
    /\bla bai nao$/,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of [...intentPrefixes, ...genericLyricsIntentPrefixes]) {
      const next = normalized.replace(pattern, '').trim();
      if (next !== normalized) {
        normalized = next;
        changed = true;
      }
    }
  }

  for (const pattern of [...genericLyricsIntentSuffixes, ...intentSuffixes]) {
    normalized = normalized.replace(pattern, '').trim();
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
