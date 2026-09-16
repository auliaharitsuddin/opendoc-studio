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
  Hapus: 'Remove',

  // automation.js
  'Tambah Langkah': 'Add Step',
  'Seret satu atau lebih PDF untuk diproses batch': 'Drag one or more PDFs to process as a batch',
  'Jalankan Batch': 'Run Batch',
  File: 'File',
  Langkah: 'Step',
  'Gagal pada': 'Failed on',
  'di langkah': 'at step',
  'Menyusun ZIP hasil batch...': 'Building batch result ZIP...',
  'Selesai memproses': 'Finished processing',
  file: 'file(s)',
  'Wizard Otomasi (Batch)': 'Automation Wizard (Batch)',
  'Rangkai beberapa alat PDF menjadi satu urutan, lalu jalankan otomatis ke banyak file sekaligus.':
    'Chain multiple PDF tools into one sequence, then run it automatically across many files at once.',
  Unduh: 'Download',

  // digital-sign.js
  'PDF yang akan ditandatangani': 'PDF to be signed',
  'Buat sertifikat uji (self-signed) — cepat, untuk dokumen internal/pengujian':
    'Create a test certificate (self-signed) — fast, for internal/testing documents',
  'Unggah sertifikat saya (.p12 / .pfx)': 'Upload my certificate (.p12 / .pfx)',
  'Kata sandi sertifikat': 'Certificate password',
  'File sertifikat (.p12/.pfx)': 'Certificate file (.p12/.pfx)',
  'Kata sandi': 'Password',
  'Nama penanda tangan (Common Name)': 'Signer name (Common Name)',
  'mis. Persetujuan dokumen': 'e.g. Document approval',
  'Nama yang tampil pada info tanda tangan': 'Name shown in the signature info',
  'Alasan (opsional)': 'Reason (optional)',
  'Nama (opsional)': 'Name (optional)',
  '⚠️ Sertifikat self-signed TIDAK diverifikasi oleh otoritas sertifikasi manapun — cocok untuk dokumen internal/pengujian, bukan untuk keperluan hukum yang membutuhkan identitas terverifikasi.':
    '⚠️ Self-signed certificates are NOT verified by any certificate authority — suitable for internal/testing documents, not for legal purposes requiring verified identity.',
  'Tanda Tangani': 'Sign',
  'Menyiapkan sertifikat...': 'Preparing certificate...',
  'Menandatangani dokumen...': 'Signing document...',
  '✅ Dokumen berhasil ditandatangani.': '✅ Document signed successfully.',
  'Gagal menandatangani': 'Failed to sign',
  'Tanda Tangan Digital Bersertifikat': 'Certified Digital Signature',
  'Penandatanganan PAdES-style (PKCS#7 detached) sesuai ISO 32000. Satu tanda tangan per dokumen; menambah tanda tangan kedua ke PDF yang sudah ditandatangani belum didukung.':
    'PAdES-style signing (detached PKCS#7) per ISO 32000. One signature per document; adding a second signature to an already-signed PDF is not yet supported.',
  '🔒 Kunci privat & sertifikat tidak pernah meninggalkan browser Anda.': '🔒 Private keys & certificates never leave your browser.',
  'Sumber sertifikat': 'Certificate source',

  // edit-text.js
  'Pilih PDF untuk diedit teksnya': 'Choose a PDF to edit its text',
  'Pilih PDF untuk mulai mengedit teks.': 'Choose a PDF to start editing text.',
  'Terapkan & Unduh PDF': 'Apply & Download PDF',
  'Membaca dokumen...': 'Reading document...',
  Halaman: 'Page',
  Ditemukan: 'Found',
  'baris teks di': 'text lines across',
  'halaman. Klik teks pada halaman mana pun untuk menggantinya.': 'page(s). Click any text on any page to replace it.',
  'Tidak ada teks terdeteksi di dokumen ini (mungkin hasil scan — gunakan alat OCR dulu).':
    'No text detected in this document (it may be a scan — use the OCR tool first).',
  'Tidak ada teks terdeteksi di posisi itu — coba klik lebih tepat di atas teks.':
    'No text detected at that position — try clicking more precisely on the text.',
  'Hal.': 'p.',
  '✅ Teks berhasil diganti.': '✅ Text replaced successfully.',
  Gagal: 'Failed',
  'Edit Teks Halaman': 'Edit Page Text',
  'Klik teks yang sudah ada di halaman berapa pun untuk menggantinya langsung di tempat. Teks lama ditutup dengan warna latar yang disesuaikan otomatis ke halaman, lalu teks baru ditulis di posisi yang sama menggunakan font standar terdekat (serif/sans-serif/monospace) — cocok untuk koreksi singkat/typo, bukan penggantian paragraf panjang, dan font pengganti mungkin tidak identik dengan font asli dokumen.':
    'Click any existing text on any page to replace it in place. The old text is covered with a background color matched to the page automatically, then the new text is written in the same position using the closest standard font (serif/sans-serif/monospace) — suited to short corrections/typos, not long paragraph replacements, and the replacement font may not be identical to the document\'s original font.',
  'Perubahan Tertunda': 'Pending Changes',

  // fill-sign.js
  'Pilih PDF untuk ditandatangani (halaman 1)': 'Choose a PDF to sign (page 1)',
  'Teks (ketik tanda tangan)': 'Text (type a signature)',
  'Gambar (unggah tanda tangan)': 'Image (upload a signature)',
  'Teks yang ditempel': 'Text to place',
  'Ukuran font': 'Font size',
  'Gambar tanda tangan (PNG/JPG)': 'Signature image (PNG/JPG)',
  Gambar: 'Image',
  'siap — klik pada halaman untuk menempatkannya.': 'ready — click on the page to place it.',
  'Unggah gambar tanda tangan dulu, lalu klik pada halaman.': 'Upload a signature image first, then click on the page.',
  'Klik pada halaman untuk menempatkan tanda tangan.': 'Click on the page to place the signature.',
  'Pilih PDF untuk mulai menempatkan tanda tangan.': 'Choose a PDF to start placing a signature.',
  'Isi teks tanda tangan terlebih dahulu.': 'Fill in the signature text first.',
  Teks: 'Text',
  '✅ Tanda tangan berhasil ditempelkan.': '✅ Signature placed successfully.',
  'Isi & Tanda Tangan': 'Fill & Sign',
  'Klik langsung pada halaman 1 untuk menempelkan teks atau gambar tanda tangan — tidak perlu lagi menghitung koordinat manual.':
    'Click directly on page 1 to place text or an image signature — no more manual coordinate math.',
  'Jenis tanda tangan': 'Signature type',
  'Item Ditempatkan': 'Placed Items',

  // forms.js
  'Pilih PDF untuk ditambahkan field formulir': 'Choose a PDF to add form fields to',
  'Kotak Teks': 'Text Box',
  'Pilihan (pisahkan koma), mis: A,B,C': 'Options (comma-separated), e.g: A,B,C',
  'Muat PDF, atur jenis & nama field, lalu klik posisi pada halaman.':
    'Load a PDF, set the field type & name, then click a position on the page.',
  'Klik pada halaman untuk menempatkan field.': 'Click on the page to place the field.',
  'Label pilihan radio ini:': 'Label for this radio option:',
  Pilihan: 'Option',
  Opsi: 'Option',
  '✅ Field formulir berhasil ditambahkan.': '✅ Form field added successfully.',
  'Perancang Formulir': 'Form Designer',
  'Field yang dibuat adalah AcroForm asli (bukan overlay) — bisa diisi di Adobe Reader atau PDF viewer manapun. Untuk radio button, klik beberapa kali dengan nama field yang sama untuk membuat beberapa pilihan.':
    'Fields created are real AcroForm fields (not an overlay) — fillable in Adobe Reader or any PDF viewer. For radio buttons, click multiple times with the same field name to create multiple options.',
  'Jenis field': 'Field type',
  'Nama field': 'Field name',
  'Pilihan (radio/dropdown)': 'Options (radio/dropdown)',
  'Field yang Ditambahkan': 'Fields Added',

  // markup.js
  'Pilih PDF untuk disorot / dicoret': 'Choose a PDF to highlight / mark up',
  'Sorot (Highlight)': 'Highlight',
  'Coret Tangan (Ink)': 'Freehand Ink',
  'Catatan Tempel': 'Sticky Note',
  'Pilih PDF untuk mulai menandai.': 'Choose a PDF to start marking it up.',
  'Klik pada halaman untuk menambahkan catatan tempel.': 'Click on the page to add a sticky note.',
  'Klik & seret pada halaman untuk menyorot atau mencoret.': 'Click & drag on the page to highlight or draw.',
  'Isi catatan tempel:': 'Sticky note content:',
  'Nama penulis (opsional):': "Author's name (optional):",
  Sorotan: 'Highlight',
  Coretan: 'Ink stroke',
  Catatan: 'Note',
  '✅ Anotasi berhasil diterapkan.': '✅ Annotations applied successfully.',
  'Komentar & Markup': 'Comments & Markup',
  'Sorot (highlight) teks, buat coretan tangan (ink), dan tambahkan catatan tempel — semua dengan klik langsung di atas pratinjau halaman 1. Anotasi PDF asli, terlihat di Adobe Reader/PDF viewer manapun.':
    'Highlight text, draw freehand ink strokes, and add sticky notes — all by clicking directly on the page 1 preview. Real PDF annotations, visible in Adobe Reader/any PDF viewer.',
  'Anotasi Ditambahkan': 'Annotations Added',

  // measure.js
  inci: 'in',
  kaki: 'ft',
  'Pilih PDF (gambar teknik/denah) untuk diukur': 'Choose a PDF (technical drawing/floor plan) to measure',
  'Muat PDF untuk mulai kalibrasi.': 'Load a PDF to start calibration.',
  'Kalibrasi Skala': 'Calibrate Scale',
  'Ukur Jarak': 'Measure Distance',
  'Ukur Luas': 'Measure Area',
  'Selesai Poligon': 'Finish Polygon',
  'Ekspor PDF Beranotasi': 'Export Annotated PDF',
  'Merender halaman...': 'Rendering page...',
  'Klik dua titik pada gambar untuk kalibrasi skala.': 'Click two points on the image to calibrate the scale.',
  'Klik dua titik yang jaraknya Anda ketahui di dunia nyata.': 'Click two points whose real-world distance you know.',
  'Klik dua titik untuk mengukur jarak.': 'Click two points to measure distance.',
  'Klik setiap sudut poligon, lalu tekan "Selesai Poligon".': 'Click each corner of the polygon, then press "Finish Polygon".',
  'Berapa jarak sebenarnya antara dua titik ini?': 'What is the real distance between these two points?',
  'Kalibrasi selesai': 'Calibration complete',
  'Kalibrasi dibatalkan (jarak tidak valid).': 'Calibration canceled (invalid distance).',
  'Butuh minimal 3 titik untuk poligon.': 'Need at least 3 points for a polygon.',
  Luas: 'Area',
  Jarak: 'Distance',
  '✅ Anotasi pengukuran siap diunduh.': '✅ Measurement annotations ready to download.',
  'Alat Ukur': 'Measuring Tool',
  'Kalibrasi skala gambar berdasarkan satu jarak yang Anda ketahui, lalu ukur jarak/luas lainnya. Hasil bisa diekspor sebagai PDF beranotasi.':
    'Calibrate the drawing scale from one known distance, then measure other distances/areas. Results can be exported as an annotated PDF.',
  Satuan: 'Unit',
  'Daftar Pengukuran': 'Measurement List',

  // page-select.js
  'Pilih PDF untuk menampilkan halaman.': 'Choose a PDF to display its pages.',
  'Pilih Semua': 'Select All',
  'Kosongkan Pilihan': 'Clear Selection',
  dari: 'of',
  'halaman dipilih.': 'page(s) selected.',
  'Ekstrak Halaman': 'Extract Pages',
  'Klik halaman yang ingin diambil (bisa lebih dari satu), lalu unduh sebagai dokumen baru berisi hanya halaman terpilih.':
    'Click the pages you want to keep (more than one allowed), then download a new document containing only the selected pages.',
  'Pilih PDF untuk memilih halaman yang diambil': 'Choose a PDF to pick pages to extract',
  'Pilih minimal satu halaman.': 'Select at least one page.',
  'Hapus Halaman': 'Delete Pages',
  'Klik halaman yang ingin dihapus (bisa lebih dari satu), lalu unduh dokumen tanpa halaman tersebut.':
    'Click the pages you want to remove (more than one allowed), then download the document without those pages.',
  'Pilih PDF untuk memilih halaman yang dihapus': 'Choose a PDF to pick pages to delete'
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
