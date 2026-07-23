import { createWorkerClient } from '../core/worker-bridge.js';
import { parsePageRange } from '../core/page-range.js';
import { getPageCount } from '../engines/pdf/organize.js';

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  sav: 'application/octet-stream',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  html: 'text/html',
  txt: 'text/plain'
};

function toBlob(result, ext) {
  if (result instanceof Blob) return result;
  return new Blob([result], { type: MIME[ext] || 'application/octet-stream' });
}

// Every worker-eligible engine is called through a fresh worker instance that
// is terminated as soon as the job finishes, so no engine ever accumulates
// state across tool runs.
async function runInWorker(moduleKey, fnName, args, onProgress) {
  const client = createWorkerClient(chrome.runtime.getURL('engine.worker.js'));
  try {
    return await client.run(`${moduleKey}#${fnName}`, { args }, { onProgress });
  } finally {
    client.terminate();
  }
}

async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export const CATEGORIES = [
  { id: 'organize', label: 'Atur Halaman' },
  { id: 'edit', label: 'Edit PDF' },
  { id: 'convert', label: 'Konversi' },
  { id: 'security', label: 'Keamanan' },
  { id: 'ocr', label: 'Kenali Teks (OCR)' },
  { id: 'sign', label: 'Tanda Tangan' },
  { id: 'comments', label: 'Komentar & Markup' },
  { id: 'forms', label: 'Formulir' },
  { id: 'accessibility', label: 'Aksesibilitas' },
  { id: 'measure', label: 'Ukur' },
  { id: 'compare', label: 'Bandingkan' },
  { id: 'portfolio', label: 'Portofolio' },
  { id: 'automation', label: 'Otomasi' }
];

export const TOOLS = [
  // ---------------- ORGANIZE ----------------
  {
    id: 'merge-pdf',
    category: 'organize',
    title: 'Gabungkan PDF',
    description: 'Gabungkan beberapa file PDF menjadi satu dokumen, sesuai urutan file yang dipilih.',
    status: 'ready',
    accept: '.pdf',
    multiple: true,
    previewPdf: true,
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const buffers = await Promise.all(files.map(fileBytes));
      const result = await runInWorker('pdf/organize', 'mergePdfs', [buffers], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'gabungan.pdf' };
    }
  },
  {
    id: 'split-pdf',
    category: 'organize',
    title: 'Pisahkan PDF',
    description: 'Pecah PDF menjadi beberapa file berdasarkan rentang halaman (mis. 1-3,4-6).',
    status: 'ready',
    accept: '.pdf',
    previewPdf: true,
    options: [{ key: 'ranges', label: 'Rentang halaman (pisahkan dengan titik koma)', type: 'text', default: '1-1' }],
    outExt: 'zip',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const pageCount = await runInWorker('pdf/organize', 'getPageCount', [buf]);
      const ranges = options.ranges.split(';').map((part) => {
        const idx = parsePageRange(part, pageCount);
        return [idx[0] ?? 0, idx[idx.length - 1] ?? 0];
      });
      const results = await runInWorker('pdf/organize', 'splitPdf', [buf, ranges], onProgress);
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      results.forEach((bytes, i) => zip.file(`bagian-${i + 1}.pdf`, bytes));
      const blob = await zip.generateAsync({ type: 'blob' });
      return { blob, filename: 'hasil-split.zip' };
    }
  },
  {
    id: 'extract-pages',
    category: 'organize',
    title: 'Ekstrak Halaman',
    description: 'Klik langsung pada thumbnail halaman untuk memilih yang ingin diambil menjadi dokumen baru — tidak perlu lagi menghitung nomor halaman manual.',
    status: 'ready',
    customView: 'extract-pages'
  },
  {
    id: 'delete-pages',
    category: 'organize',
    title: 'Hapus Halaman',
    description: 'Klik langsung pada thumbnail halaman untuk memilih yang ingin dihapus — tidak perlu lagi menghitung nomor halaman manual.',
    status: 'ready',
    customView: 'delete-pages'
  },
  {
    id: 'rotate-pages',
    category: 'organize',
    title: 'Putar Halaman',
    description: 'Putar seluruh atau sebagian halaman PDF sebesar 90/180/270 derajat.',
    status: 'ready',
    accept: '.pdf',
    previewPdf: true,
    options: [
      { key: 'pages', label: 'Halaman (kosongkan = semua)', type: 'text', default: '' },
      { key: 'degrees', label: 'Derajat putar', type: 'select', default: '90', choices: ['90', '180', '270'] }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const pageCount = await getPageCount(buf);
      const indices = options.pages.trim() ? parsePageRange(options.pages, pageCount) : null;
      const result = await runInWorker(
        'pdf/organize',
        'rotatePages',
        [buf, indices, Number(options.degrees)],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'halaman-diputar.pdf' };
    }
  },
  {
    id: 'bates-numbering',
    category: 'organize',
    title: 'Penomoran Bates',
    description: 'Beri nomor Bates berurutan (umum untuk dokumen legal) ke satu atau lebih PDF.',
    status: 'ready',
    accept: '.pdf',
    multiple: true,
    previewPdf: true,
    options: [
      { key: 'prefix', label: 'Awalan', type: 'text', default: 'DOC' },
      { key: 'digits', label: 'Jumlah digit angka', type: 'number', default: 6 },
      { key: 'startAt', label: 'Mulai dari nomor', type: 'number', default: 1 }
    ],
    outExt: 'zip',
    async run({ files, options, onProgress }) {
      const documents = await Promise.all(
        files.map(async (f) => ({ name: f.name, buf: await fileBytes(f) }))
      );
      const results = await runInWorker(
        'pdf/page-numbers',
        'addBatesNumbers',
        [documents, { prefix: options.prefix, digits: Number(options.digits), startAt: Number(options.startAt) }],
        onProgress
      );
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      results.forEach(({ name, bytes }) => zip.file(name.replace(/\.pdf$/i, '') + '-bates.pdf', bytes));
      const blob = await zip.generateAsync({ type: 'blob' });
      return { blob, filename: 'bates-numbering.zip' };
    }
  },

  // ---------------- EDIT ----------------
  {
    id: 'add-watermark-text',
    category: 'edit',
    title: 'Watermark Teks',
    description: 'Tambahkan watermark teks diagonal ke setiap halaman PDF.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'text', label: 'Teks watermark', type: 'text', default: 'RAHASIA' },
      { key: 'opacity', label: 'Transparansi (0-1)', type: 'number', default: 0.3 }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker(
        'pdf/watermark',
        'addTextWatermark',
        [buf, { text: options.text, opacity: Number(options.opacity) }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'watermark.pdf' };
    }
  },
  {
    id: 'add-page-numbers',
    category: 'edit',
    title: 'Nomor Halaman',
    description: 'Tambahkan nomor halaman ke seluruh dokumen dengan format dan posisi pilihan.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'format', label: 'Format', type: 'text', default: 'Halaman {n} dari {total}' },
      {
        key: 'position',
        label: 'Posisi',
        type: 'select',
        default: 'bottom-center',
        choices: ['bottom-center', 'bottom-left', 'bottom-right', 'top-center', 'top-left', 'top-right']
      }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker(
        'pdf/page-numbers',
        'addPageNumbers',
        [buf, { format: options.format, position: options.position }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'bernomor.pdf' };
    }
  },
  {
    id: 'header-footer',
    category: 'edit',
    title: 'Header & Footer',
    description: 'Tambahkan teks header (atas) dan footer (bawah) ke setiap halaman.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'headerText', label: 'Teks header', type: 'text', default: '' },
      { key: 'footerText', label: 'Teks footer', type: 'text', default: '' }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker(
        'pdf/watermark',
        'addHeaderFooter',
        [buf, { headerText: options.headerText, footerText: options.footerText }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'header-footer.pdf' };
    }
  },
  {
    id: 'edit-metadata',
    category: 'edit',
    title: 'Edit Metadata',
    description: 'Ubah judul, penulis, subjek, dan kata kunci dokumen PDF.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'title', label: 'Judul', type: 'text', default: '' },
      { key: 'author', label: 'Penulis', type: 'text', default: '' },
      { key: 'subject', label: 'Subjek', type: 'text', default: '' },
      { key: 'keywords', label: 'Kata kunci (pisahkan koma)', type: 'text', default: '' }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('pdf/metadata', 'writeMetadata', [buf, options], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'metadata-diedit.pdf' };
    }
  },
  {
    id: 'compress-pdf',
    category: 'edit',
    title: 'Kompres PDF',
    description: 'Perkecil ukuran file dengan mengurangi kualitas/resolusi gambar di dalam PDF.',
    status: 'ready',
    accept: '.pdf',
    options: [{ key: 'imageQuality', label: 'Kualitas gambar (0.1-1)', type: 'number', default: 0.6 }],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker(
        'pdf/compress',
        'compressPdf',
        [buf, { imageQuality: Number(options.imageQuality) }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'terkompresi.pdf' };
    }
  },
  {
    id: 'edit-page-text',
    category: 'edit',
    title: 'Edit Teks Halaman',
    description: 'Klik teks yang sudah ada di halaman berapa pun untuk menggantinya langsung di tempat. Teks lama ditutup dengan warna latar yang menyesuaikan otomatis, teks baru ditulis dengan font standar terdekat (serif/sans-serif/monospace) — cocok untuk koreksi singkat/typo, bukan penggantian paragraf panjang.',
    status: 'ready',
    customView: 'edit-text'
  },

  // ---------------- CONVERT (bidirectional) ----------------
  {
    id: 'pdf-to-word',
    category: 'convert',
    title: 'PDF ke Word',
    description: 'Ekstrak teks & struktur paragraf PDF menjadi dokumen Word (.docx). Rekonstruksi berbasis teks, bukan klon tata letak piksel.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'docx',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-docx', 'pdfToDocx', [buf], onProgress);
      return { blob: toBlob(result, 'docx'), filename: 'dokumen.docx' };
    }
  },
  {
    id: 'word-to-pdf',
    category: 'convert',
    title: 'Word ke PDF',
    description: 'Konversi dokumen Word (.docx) menjadi PDF, mempertahankan heading/list/format dasar.',
    status: 'ready',
    accept: '.docx',
    outExt: 'pdf',
    mainThread: true,
    async run({ files }) {
      const { docxToPdf } = await import('../engines/convert/docx-to-pdf.js');
      const buf = await files[0].arrayBuffer();
      const result = await docxToPdf(buf);
      return { blob: toBlob(result, 'pdf'), filename: 'dokumen.pdf' };
    }
  },
  {
    id: 'pdf-to-ppt',
    category: 'convert',
    title: 'PDF ke PowerPoint',
    description: 'Ubah setiap halaman PDF menjadi satu slide gambar dalam file .pptx.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'pptx',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-pptx', 'pdfToPptx', [buf], onProgress);
      return { blob: toBlob(result, 'pptx'), filename: 'presentasi.pptx' };
    }
  },
  {
    id: 'ppt-to-pdf',
    category: 'convert',
    title: 'PowerPoint ke PDF',
    description: 'Rekonstruksi teks & gambar dari setiap slide .pptx menjadi satu halaman PDF per slide.',
    status: 'ready',
    accept: '.pptx',
    outExt: 'pdf',
    mainThread: true,
    async run({ files }) {
      // Runs on the main thread: parses PPTX XML via DOMParser, which
      // (unlike in most other browsers/contexts) is not available inside a
      // Chromium Web Worker — confirmed by a real "DOMParser is not defined"
      // failure when this ran through engine.worker.js.
      const { pptxToPdf } = await import('../engines/convert/pptx-to-pdf.js');
      const buf = await files[0].arrayBuffer();
      const result = await pptxToPdf(buf);
      return { blob: toBlob(result, 'pdf'), filename: 'presentasi.pdf' };
    }
  },
  {
    id: 'pdf-to-excel',
    category: 'convert',
    title: 'PDF ke Excel',
    description: 'Ekstrak tabel dari PDF ke lembar kerja Excel (.xlsx) menggunakan heuristik posisi teks.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'xlsx',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-xlsx', 'pdfToXlsx', [buf], onProgress);
      return { blob: toBlob(result, 'xlsx'), filename: 'data.xlsx' };
    }
  },
  {
    id: 'excel-to-pdf',
    category: 'convert',
    title: 'Excel ke PDF',
    description: 'Cetak setiap sheet Excel (.xlsx) sebagai tabel teks yang bisa dicari di dalam PDF.',
    status: 'ready',
    accept: '.xlsx',
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const buf = await files[0].arrayBuffer();
      const result = await runInWorker('convert/xlsx-to-pdf', 'xlsxToPdf', [buf], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'excel.pdf' };
    }
  },
  {
    id: 'pdf-to-image',
    category: 'convert',
    title: 'PDF ke Gambar',
    description: 'Render setiap halaman PDF menjadi PNG/JPG (file tunggal, atau .zip bila multi-halaman).',
    status: 'ready',
    accept: '.pdf',
    options: [{ key: 'format', label: 'Format', type: 'select', default: 'png', choices: ['png', 'jpeg'] }],
    outExt: 'zip',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-image', 'pdfToImages', [buf, { format: options.format }], onProgress);
      return { blob: result.blob, filename: `halaman.${result.ext}` };
    }
  },
  {
    id: 'image-to-pdf',
    category: 'convert',
    title: 'Gambar ke PDF',
    description: 'Gabungkan satu atau lebih gambar (JPG/PNG) menjadi satu file PDF, satu gambar per halaman.',
    status: 'ready',
    accept: '.jpg,.jpeg,.png',
    multiple: true,
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const images = await Promise.all(files.map(fileBytes));
      const result = await runInWorker('convert/image-to-pdf', 'imagesToPdf', [images], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'gambar.pdf' };
    }
  },
  {
    id: 'pdf-to-html',
    category: 'convert',
    title: 'PDF ke HTML',
    description: 'Ekspor PDF sebagai halaman HTML yang mengalir (reflow), nyaman dibaca di browser.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'html',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-html', 'pdfToHtml', [buf, {}], onProgress);
      return { blob: toBlob(result, 'html'), filename: 'dokumen.html' };
    }
  },
  {
    id: 'html-to-pdf',
    category: 'convert',
    title: 'HTML ke PDF',
    description: 'Konversi file HTML menjadi PDF (dirender & dipaginasi sebagai gambar halaman).',
    status: 'ready',
    accept: '.html,.htm',
    outExt: 'pdf',
    mainThread: true,
    async run({ files }) {
      const { htmlToPdf } = await import('../engines/convert/html-to-pdf.js');
      const text = await files[0].text();
      const result = await htmlToPdf(text);
      return { blob: toBlob(result, 'pdf'), filename: 'dari-html.pdf' };
    }
  },
  {
    id: 'pdf-to-text',
    category: 'convert',
    title: 'PDF ke Teks',
    description: 'Ekstrak seluruh teks PDF menjadi file .txt polos.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'txt',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-text', 'pdfToText', [buf], onProgress);
      return { blob: toBlob(result, 'txt'), filename: 'teks.txt' };
    }
  },
  {
    id: 'text-to-pdf',
    category: 'convert',
    title: 'Teks ke PDF',
    description: 'Ubah file .txt menjadi PDF dengan penataan otomatis (word-wrap & penomoran halaman).',
    status: 'ready',
    accept: '.txt',
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const text = await files[0].text();
      const result = await runInWorker('convert/text-to-pdf', 'textToPdf', [text, {}], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'dari-teks.pdf' };
    }
  },
  {
    id: 'pdf-to-pdfa',
    category: 'convert',
    title: 'PDF ke PDF/A',
    description: 'Tandai dokumen dengan metadata kesesuaian PDF/A-1B untuk kebutuhan arsip (upaya terbaik, bukan validasi penuh veraPDF).',
    status: 'ready',
    accept: '.pdf',
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('convert/pdf-to-pdfa', 'pdfToPdfA', [buf, {}], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'arsip-pdfa.pdf' };
    }
  },
  {
    id: 'excel-to-csv',
    category: 'convert',
    title: 'Excel ke CSV',
    description: 'Ekspor sheet pertama file Excel menjadi CSV.',
    status: 'ready',
    accept: '.xlsx',
    outExt: 'csv',
    async run({ files, onProgress }) {
      const buf = await files[0].arrayBuffer();
      const result = await runInWorker('convert/xlsx-csv', 'xlsxToCsv', [buf, {}], onProgress);
      return { blob: toBlob(result, 'csv'), filename: 'data.csv' };
    }
  },
  {
    id: 'csv-to-excel',
    category: 'convert',
    title: 'CSV ke Excel',
    description: 'Impor file CSV menjadi workbook Excel (.xlsx).',
    status: 'ready',
    accept: '.csv',
    outExt: 'xlsx',
    async run({ files, onProgress }) {
      const text = await files[0].text();
      const result = await runInWorker('convert/xlsx-csv', 'csvToXlsx', [text], onProgress);
      return { blob: toBlob(result, 'xlsx'), filename: 'data.xlsx' };
    }
  },
  {
    id: 'excel-to-sav',
    category: 'convert',
    title: 'Excel ke SPSS (.sav)',
    description: 'Konversi sheet pertama Excel menjadi file data SPSS (.sav) tanpa kompresi, kompatibel luas. Tipe kolom (angka/teks) dideteksi otomatis.',
    status: 'ready',
    accept: '.xlsx',
    outExt: 'sav',
    async run({ files, onProgress }) {
      const buf = await files[0].arrayBuffer();
      const result = await runInWorker('excel-sav/xlsx-to-sav', 'xlsxToSav', [buf, {}], onProgress);
      return { blob: toBlob(result, 'sav'), filename: 'data.sav' };
    }
  },
  {
    id: 'sav-to-excel',
    category: 'convert',
    title: 'SPSS (.sav) ke Excel',
    description: 'Baca file data SPSS (.sav, termasuk yang terkompresi bytecode) menjadi workbook Excel.',
    status: 'ready',
    accept: '.sav',
    outExt: 'xlsx',
    async run({ files, onProgress }) {
      const buf = await files[0].arrayBuffer();
      const result = await runInWorker('excel-sav/sav-to-xlsx', 'savToXlsx', [new Uint8Array(buf)], onProgress);
      return { blob: toBlob(result, 'xlsx'), filename: 'data-spss.xlsx' };
    }
  },
  {
    id: 'archive-to-zip',
    category: 'convert',
    title: 'Arsip ke ZIP',
    description: 'Ekstrak RAR/7z/TAR/GZIP/BZIP2/ISO dan kemas ulang isinya menjadi satu file .zip standar.',
    status: 'ready',
    accept: '.rar,.7z,.tar,.gz,.bz2,.tgz,.iso,.zip',
    outExt: 'zip',
    mainThread: true,
    async run({ files, onProgress }) {
      const { archiveToZip } = await import('../engines/archive/to-zip.js');
      const blob = await archiveToZip(files[0], { onProgress });
      return { blob, filename: files[0].name.replace(/\.[^.]+$/, '') + '.zip' };
    }
  },

  // ---------------- SECURITY ----------------
  {
    id: 'protect-pdf',
    category: 'security',
    title: 'Kunci dengan Kata Sandi',
    description: 'Enkripsi PDF dengan kata sandi pembuka (AES-256) dan batasan izin cetak/salin/edit.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'userPassword', label: 'Kata sandi pembuka', type: 'password', default: '' },
      { key: 'allowPrinting', label: 'Izinkan cetak', type: 'checkbox', default: true },
      { key: 'allowCopying', label: 'Izinkan salin teks', type: 'checkbox', default: false }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker(
        'pdf/protect',
        'protectPdf',
        [buf, { userPassword: options.userPassword, permissions: { allowPrinting: options.allowPrinting, allowCopying: options.allowCopying } }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'terkunci.pdf' };
    }
  },
  {
    id: 'remove-password',
    category: 'security',
    title: 'Buka Kata Sandi',
    description: 'Hapus enkripsi/kata sandi dari PDF yang terkunci (perlu tahu kata sandinya).',
    status: 'ready',
    accept: '.pdf',
    options: [{ key: 'password', label: 'Kata sandi', type: 'password', default: '' }],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('pdf/protect', 'removeProtection', [buf, options.password], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'tanpa-sandi.pdf' };
    }
  },
  {
    id: 'redact-pdf',
    category: 'security',
    title: 'Redaksi Kata Kunci & Pola Data',
    description: 'Cari & hapus permanen teks yang cocok dengan kata kunci, dan/atau deteksi otomatis pola data sensitif (email, telepon, NIK, kartu kredit). Opsi flatten (disarankan) me-rasterize halaman agar teks benar-benar tidak bisa dipulihkan.',
    status: 'ready',
    accept: '.pdf',
    options: [
      { key: 'keyword', label: 'Kata/frasa yang diredaksi (opsional)', type: 'text', default: '' },
      { key: 'patternEmail', label: 'Deteksi & redaksi alamat email', type: 'checkbox', default: false },
      { key: 'patternPhone', label: 'Deteksi & redaksi nomor telepon', type: 'checkbox', default: false },
      { key: 'patternNik', label: 'Deteksi & redaksi NIK/KTP (16 digit)', type: 'checkbox', default: false },
      { key: 'patternCard', label: 'Deteksi & redaksi nomor kartu kredit', type: 'checkbox', default: false },
      { key: 'flatten', label: 'Flatten halaman (rekomendasi, hasil jadi gambar)', type: 'checkbox', default: true }
    ],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const buf = await fileBytes(files[0]);
      const patternKeys = [
        options.patternEmail && 'email',
        options.patternPhone && 'phone',
        options.patternNik && 'nik',
        options.patternCard && 'creditcard'
      ].filter(Boolean);

      const keywordMatches = options.keyword
        ? await runInWorker('pdf/redact', 'findTextMatches', [buf, options.keyword, {}], onProgress)
        : [];
      const patternMatches = patternKeys.length
        ? await runInWorker('pdf/redact', 'findPatternMatches', [buf, patternKeys], onProgress)
        : [];
      const allMatches = [...keywordMatches, ...patternMatches];
      if (allMatches.length === 0) {
        throw new Error('Isi kata kunci atau pilih minimal satu pola data, dan pastikan ada kecocokan di dokumen.');
      }

      const result = await runInWorker(
        'pdf/redact',
        'applyRedaction',
        [buf, allMatches, { flatten: options.flatten }],
        onProgress
      );
      return { blob: toBlob(result, 'pdf'), filename: 'redaksi.pdf' };
    }
  },
  {
    id: 'sanitize-pdf',
    category: 'security',
    title: 'Bersihkan Dokumen',
    description: 'Hapus metadata, JavaScript tersembunyi, dan lampiran tersemat dari PDF sebelum dibagikan.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'pdf',
    async run({ files, onProgress }) {
      const buf = await fileBytes(files[0]);
      const result = await runInWorker('pdf/sanitize', 'sanitizePdf', [buf, {}], onProgress);
      return { blob: toBlob(result, 'pdf'), filename: 'bersih.pdf' };
    }
  },

  // ---------------- OCR ----------------
  {
    id: 'ocr-searchable-pdf',
    category: 'ocr',
    title: 'PDF Scan ke PDF Bisa Dicari',
    description: 'Kenali teks pada PDF hasil scan dan sisipkan lapisan teks tak terlihat agar bisa dicari/disalin.',
    status: 'ready',
    accept: '.pdf',
    options: [
      {
        key: 'language',
        label: 'Bahasa',
        type: 'select',
        default: 'ind',
        choices: ['ind', 'eng', { value: 'ind+eng', label: 'Indonesia + Inggris (campuran)' }]
      }
    ],
    outExt: 'pdf',
    mainThread: true,
    async run({ files, options, onProgress }) {
      const { ocrToSearchablePdf } = await import('../engines/pdf/ocr.js');
      const buf = await fileBytes(files[0]);
      const result = await ocrToSearchablePdf(buf, {
        language: options.language,
        onProgress: (status, p) => onProgress?.(Math.round((p || 0) * 100), status)
      });
      return { blob: toBlob(result, 'pdf'), filename: 'hasil-ocr.pdf' };
    }
  },
  {
    id: 'ocr-extract-text',
    category: 'ocr',
    title: 'Ekstrak Teks dari Scan',
    description: 'Kenali teks pada PDF/gambar hasil scan dan ekspor sebagai file .txt.',
    status: 'ready',
    accept: '.pdf',
    options: [
      {
        key: 'language',
        label: 'Bahasa',
        type: 'select',
        default: 'ind',
        choices: ['ind', 'eng', { value: 'ind+eng', label: 'Indonesia + Inggris (campuran)' }]
      }
    ],
    outExt: 'txt',
    mainThread: true,
    async run({ files, options, onProgress }) {
      const { ocrToText } = await import('../engines/pdf/ocr.js');
      const buf = await fileBytes(files[0]);
      const result = await ocrToText(buf, {
        language: options.language,
        onProgress: (status, p) => onProgress?.(Math.round((p || 0) * 100), status)
      });
      return { blob: toBlob(result, 'txt'), filename: 'teks-ocr.txt' };
    }
  },

  // ---------------- SIGN ----------------
  {
    id: 'fill-sign',
    category: 'sign',
    title: 'Isi & Tanda Tangan',
    description: 'Klik langsung pada halaman 1 untuk menempelkan teks atau gambar tanda tangan — tidak perlu lagi menghitung koordinat manual.',
    status: 'ready',
    customView: 'fill-sign'
  },

  // ---------------- COMMENTS ----------------
  {
    id: 'markup-highlight-ink',
    category: 'comments',
    title: 'Komentar & Markup',
    description: 'Sorot (highlight) teks, buat coretan tangan (ink), dan tambahkan catatan tempel — semua dengan klik langsung di atas pratinjau halaman 1. Anotasi PDF asli, terlihat di Adobe Reader/PDF viewer manapun.',
    status: 'ready',
    customView: 'markup'
  },

  // ---------------- FORMS, SIGN, ACCESSIBILITY, MEASURE, COMPARE, PORTFOLIO, AUTOMATION ----------------
  {
    id: 'forms-designer',
    category: 'forms',
    title: 'Perancang Formulir',
    status: 'ready',
    description: 'Tempatkan field AcroForm (teks, checkbox, radio, dropdown) secara visual di halaman PDF — field asli, bisa diisi di Adobe Reader/PDF viewer manapun.',
    customView: 'forms'
  },
  {
    id: 'export-form-data',
    category: 'forms',
    title: 'Ekspor Data Formulir',
    description: 'Baca nilai field dari PDF berformulir dan ekspor sebagai CSV, FDF, atau XFDF.',
    status: 'ready',
    accept: '.pdf',
    options: [{ key: 'format', label: 'Format ekspor', type: 'select', default: 'csv', choices: ['csv', 'fdf', 'xfdf'] }],
    outExt: 'csv',
    async run({ files, options }) {
      const { readFormFieldValues, exportFieldsAsCsv, exportFieldsAsFdf, exportFieldsAsXfdf } = await import(
        '../engines/pdf/forms.js'
      );
      const buf = await fileBytes(files[0]);
      const values = await readFormFieldValues(buf);
      if (values.length === 0) throw new Error('PDF ini tidak memiliki field formulir.');
      const byFormat = { csv: exportFieldsAsCsv, fdf: exportFieldsAsFdf, xfdf: exportFieldsAsXfdf };
      const text = byFormat[options.format](values);
      const ext = options.format;
      return { blob: new Blob([text], { type: 'text/plain' }), filename: `data-formulir.${ext}` };
    }
  },
  {
    id: 'digital-signature',
    category: 'sign',
    title: 'Tanda Tangan Digital Bersertifikat',
    status: 'ready',
    description: 'Tanda tangani PDF secara kriptografis (PAdES-style, PKCS#7 detached) dengan sertifikat .p12/.pfx Anda, atau buat sertifikat uji sekali pakai.',
    customView: 'digital-sign'
  },
  {
    id: 'verify-signature',
    category: 'sign',
    title: 'Verifikasi Tanda Tangan',
    description: 'Periksa apakah tanda tangan digital pada PDF valid dan dokumen belum diubah sejak ditandatangani.',
    status: 'ready',
    accept: '.pdf',
    outExt: 'txt',
    async run({ files }) {
      const { verifySignedPdf } = await import('../engines/pdf/digital-sign.js');
      const buf = await fileBytes(files[0]);
      const result = verifySignedPdf(buf);
      const report = [
        `Valid: ${result.valid ? 'YA' : 'TIDAK'}`,
        result.signerCommonName ? `Penanda tangan: ${result.signerCommonName}` : null,
        result.signingTime ? `Waktu tanda tangan: ${result.signingTime}` : null,
        result.reason ? `Keterangan: ${result.reason}` : null
      ]
        .filter(Boolean)
        .join('\n');
      return { blob: new Blob([report], { type: 'text/plain' }), filename: 'hasil-verifikasi.txt' };
    }
  },
  {
    id: 'accessibility-checker',
    category: 'accessibility',
    title: 'Pemeriksa Aksesibilitas',
    status: 'ready',
    description: 'Pemeriksaan heuristik: judul dokumen, bahasa, struktur tag (Tagged PDF), dan font tersemat. Laporan diunduh sebagai HTML. (Bukan auto-tagging penuh — lihat ROADMAP.md.)',
    accept: '.pdf',
    outExt: 'html',
    async run({ files }) {
      const { checkAccessibility, buildAccessibilityReportHtml } = await import('../engines/pdf/accessibility.js');
      const buf = await fileBytes(files[0]);
      const report = await checkAccessibility(buf);
      const html = buildAccessibilityReportHtml(report, { fileName: files[0].name });
      return { blob: toBlob(html, 'html'), filename: 'laporan-aksesibilitas.html' };
    }
  },
  {
    id: 'measure-tool',
    category: 'measure',
    title: 'Alat Ukur',
    status: 'ready',
    description: 'Kalibrasi skala pada gambar teknik/denah, lalu ukur jarak dan luas. Ekspor hasil sebagai PDF beranotasi.',
    customView: 'measure'
  },
  {
    id: 'compare-pdf',
    category: 'compare',
    title: 'Bandingkan Dokumen',
    status: 'ready',
    description: 'Diff visual (piksel, per halaman) dan diff teks antar dua versi PDF. Pilih 2 file: yang pertama dianggap Dokumen A (asli), kedua Dokumen B (revisi). Hasil diunduh sebagai laporan HTML.',
    accept: '.pdf',
    multiple: true,
    outExt: 'html',
    async run({ files, onProgress }) {
      if (files.length < 2) throw new Error('Pilih 2 file PDF: dokumen asli dan dokumen revisi.');
      const { buildCompareReportHtml } = await import('../engines/pdf/compare.js');
      const [bufA, bufB] = await Promise.all([fileBytes(files[0]), fileBytes(files[1])]);
      onProgress?.(10, 'Merender & membandingkan halaman...');
      const pages = await runInWorker('pdf/compare', 'comparePdfs', [bufA, bufB, {}], onProgress);
      const html = buildCompareReportHtml(pages, { nameA: files[0].name, nameB: files[1].name });
      return { blob: toBlob(html, 'html'), filename: 'perbandingan.html' };
    }
  },
  {
    id: 'portfolio-builder',
    category: 'portfolio',
    title: 'Pembuat Portofolio PDF',
    status: 'ready',
    description: 'Gabungkan banyak file (PDF, gambar, Office, dll.) sebagai lampiran + halaman indeks dalam satu PDF Portfolio yang dikenali Acrobat/Reader.',
    accept: '',
    multiple: true,
    options: [{ key: 'title', label: 'Judul portofolio', type: 'text', default: 'Portofolio' }],
    outExt: 'pdf',
    async run({ files, options, onProgress }) {
      const { buildPortfolio } = await import('../engines/pdf/portfolio.js');
      const attachments = await Promise.all(
        files.map(async (f) => ({ name: f.name, bytes: await fileBytes(f) }))
      );
      onProgress?.(50, 'Menyusun portofolio...');
      const result = await buildPortfolio(attachments, { title: options.title });
      return { blob: toBlob(result, 'pdf'), filename: `${options.title || 'portofolio'}.pdf` };
    }
  },
  {
    id: 'automation-wizard',
    category: 'automation',
    title: 'Wizard Otomasi (Batch)',
    status: 'ready',
    description: 'Rangkai beberapa alat PDF menjadi satu urutan, lalu jalankan otomatis ke banyak file sekaligus.',
    customView: 'automation'
  }
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id);
}
