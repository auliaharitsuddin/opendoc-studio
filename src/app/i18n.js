const LANG_KEY = 'opendoc-lang';

let lang = 'id';
const listeners = new Set();

// English translations, keyed by the exact Indonesian string used at each
// call site. Indonesian is the source language (matches the shipped UI), so
// only the EN half needs to be maintained here — t() falls back to the
// Indonesian text itself when a key has no translation yet.
const EN = {
  Beranda: 'Home',
  Pengaturan: 'Settings',
  'Cari alat… (mis. gabung, kompres, sav, ocr)': 'Search tools… (e.g. merge, compress, sav, ocr)',
  'Editor, konverter, dan pengaman dokumen — 100% berjalan di browser Anda.':
    'Editor, converter, and document protection — 100% runs in your browser.',
  'Tidak ada alat yang cocok.': 'No matching tools.',
  'Segera Hadir': 'Coming Soon',
  Beta: 'Beta',
  Tampilan: 'Appearance',
  Tema: 'Theme',
  'Hapus semua data sekarang': 'Delete all data now',
  'Menghapus...': 'Deleting...',
  '✓ Data lokal sudah dihapus': '✓ Local data deleted',
  'Privasi & Penyimpanan': 'Privacy & Storage',
  'OpenDoc Studio tidak mengunggah file Anda ke server manapun. Sebagian besar alat memproses file sepenuhnya di memori dan tidak pernah menyentuh penyimpanan permanen. Hanya fitur batch/otomasi (jika aktif) menggunakan penyimpanan sementara di browser, yang otomatis dibersihkan.':
    'OpenDoc Studio never uploads your files to any server. Most tools process files entirely in memory and never touch permanent storage. Only the batch/automation feature (when used) relies on temporary browser storage, which is cleaned up automatically.',
  Tentang: 'About',
  'OpenDoc Studio v0.1.0 — perangkat lunak bebas & terbuka (MIT). Lihat README.md dan ROADMAP.md di repositori untuk detail.':
    'OpenDoc Studio v0.1.0 — free & open-source software (MIT). See README.md and ROADMAP.md in the repository for details.',
  '🔒 Diproses 100% lokal di browser Anda — tidak ada file yang diunggah.':
    '🔒 Processed 100% locally in your browser — no file is uploaded.',
  Proses: 'Run',
  'Mulai Baru': 'Start Over',
  'Memproses...': 'Processing...',
  Selesai: 'Done',
  'Mengunduh...': 'Downloading...',
  '✓ Diunduh & dihapus dari memori': '✓ Downloaded & cleared from memory',
  '✅ Berhasil diproses.': '✅ Processed successfully.',
  'File akan dihapus dari memori browser segera setelah diunduh.':
    'The file will be cleared from browser memory right after downloading.',
  'Fitur ini ada di roadmap OpenDoc Studio dan belum aktif pada versi ini. Lihat ROADMAP.md di repositori untuk detail rencana dan cara berkontribusi.':
    'This feature is on the OpenDoc Studio roadmap and is not active in this version yet. See ROADMAP.md in the repository for plans and how to contribute.',
  'Seret file ke sini atau klik untuk memilih': 'Drag a file here or click to choose',
  'Arahkan kursor atau klik salah satu file untuk pratinjau seluruh halamannya.':
    'Hover or click a file to preview all of its pages.',
  'Memuat pratinjau...': 'Loading preview...',
  'Gagal memuat pratinjau (file bukan PDF yang valid?).': 'Failed to load preview (not a valid PDF?).',
  'Seret untuk mengurutkan': 'Drag to reorder',
  Naik: 'Up',
  Turun: 'Down',
  Hapus: 'Remove'
};

const CATEGORY_EN = {
  organize: 'Organize Pages',
  edit: 'Edit PDF',
  convert: 'Convert',
  security: 'Security',
  ocr: 'Recognize Text (OCR)',
  sign: 'Signature',
  comments: 'Comments & Markup',
  forms: 'Forms',
  accessibility: 'Accessibility',
  measure: 'Measure',
  compare: 'Compare',
  portfolio: 'Portfolio',
  automation: 'Automation'
};

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (next !== 'id' && next !== 'en') return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // localStorage unavailable (e.g. private mode) — language just won't persist.
  }
  document.documentElement.setAttribute('lang', next);
  listeners.forEach((cb) => cb(next));
}

export function initLang() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANG_KEY);
  } catch {
    // ignore
  }
  lang = stored === 'en' ? 'en' : 'id';
  document.documentElement.setAttribute('lang', lang);
  return lang;
}

export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Translate a UI string. `idText` is the Indonesian source text that already
// lives at the call site; when lang is 'en' and a translation exists it is
// returned instead, otherwise the Indonesian original is used as-is.
export function t(idText) {
  if (lang === 'en' && Object.prototype.hasOwnProperty.call(EN, idText)) return EN[idText];
  return idText;
}

// Tool titles/descriptions and category labels are translated by id, since
// the same Indonesian text can otherwise repeat across unrelated tools.
export function categoryLabel(cat) {
  return lang === 'en' && CATEGORY_EN[cat.id] ? CATEGORY_EN[cat.id] : cat.label;
}

export function toolTitle(tool, EN_TOOLS) {
  return lang === 'en' && EN_TOOLS[tool.id]?.title ? EN_TOOLS[tool.id].title : tool.title;
}

export function toolDescription(tool, EN_TOOLS) {
  return lang === 'en' && EN_TOOLS[tool.id]?.description ? EN_TOOLS[tool.id].description : tool.description;
}
