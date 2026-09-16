# OpenDoc Studio

A privacy-first document editor, converter, and security toolkit (PDF, Word,
Excel, PowerPoint, SPSS, compressed archives) that runs **100% inside your
browser** — no server, no API, no file is ever uploaded anywhere. Ships as a
browser extension for Chrome, Edge, and other Chromium-based browsers.
MIT-licensed, free and open for anyone to use. **47 ready-to-use tools**
across 13 categories — none of them still in Beta.

## Why it's private by design

- The extension requests **no `host_permissions`**, and its Content-Security-Policy
  blocks every outbound network connection (`connect-src 'self'`). It is
  technically impossible for this extension to send your files anywhere.
- Every tool processes files entirely in browser memory. As soon as you
  download the result, every in-memory copy (input and output) is discarded.
- OCR (text recognition) uses language data bundled directly inside the
  extension (`public/tessdata/`), never fetched from a CDN at runtime.
- The **Batch Automation** feature and other operations that need temporary
  storage use IndexedDB only to persist intermediate results between steps;
  that storage is automatically cleared on completion or after 15 minutes via
  `chrome.alarms`.

## Functions

OpenDoc Studio lets you edit, convert, secure, sign, annotate, and organize
documents entirely offline, without ever trusting a third-party server with
your files — solving the "I don't want to upload a sensitive PDF/contract/ID
scan to some random website" problem that most online PDF tools force on you.

## All features

Every tool listed below is **Ready** (fully functional). Intentional
limitations for specific features (not bugs) — e.g. the substitute font used
in "Edit Page Text" is not identical to the original font, or the Measure
Tool only measures page 1 — are documented honestly in
[ROADMAP.md](./ROADMAP.md).

**Language toggle** — the sidebar, home screen, and settings page switch
between Indonesian and English (`src/app/i18n.js`), persisted in
`localStorage`. Individual tool screens (Automation, Digital Sign, Edit Text,
Fill & Sign, Forms, Markup, Measure, Page Select) don't read from the toggle
yet and still show their original-language labels regardless of the setting.

| Category | Tools |
|---|---|
| **Page Organization** | Merge PDF (drag-and-drop file reordering + preview of every page), Split, **Extract/Delete Pages** (click page thumbnails directly to select), Rotate Pages, Bates Numbering |
| **PDF Editing** | Text Watermark, Header/Footer, Page Numbers, Edit Metadata, Compress, **Edit Page Text** (click any text on any page to replace it in place, with automatic background-color and font matching, works across all pages) |
| **Conversion** | PDF ↔ Word (including automatic table, heading, and bullet-list detection), PDF ↔ PowerPoint, PDF ↔ Excel, PDF ↔ Image, PDF ↔ HTML, PDF ↔ Text, PDF → PDF/A, Excel ↔ CSV, Excel ↔ SPSS (.sav), Archive (RAR/7z/TAR/GZIP/BZIP2/ISO) → ZIP |
| **Security** | Password Lock/Unlock (AES-256), **Keyword & Pattern Redaction** (automatic detection of emails/phone numbers/national IDs/credit cards, plus manual keywords) with flattening, Sanitize Metadata/JS/Attachments |
| **Text Recognition (OCR)** | Scanned PDF → Searchable PDF, Extract Text from Scans — Indonesian, English, or mixed (ind+eng), fully offline, with image pre-processing (automatic grayscale + binarization) for better accuracy on real-world scans |
| **Signatures** | Fill & Sign (click directly on the page to place text/image signatures), Certified Digital Signature (PAdES-style, PKCS#7), Signature Verification |
| **Comments & Markup** | Highlight, Freehand Ink, and Sticky Notes — one tool, three modes, all click-directly-on-preview; produces native PDF annotations visible in Adobe Reader or any PDF viewer |
| **Forms** | Visual AcroForm field designer (text/checkbox/radio/dropdown), Form Data Export (CSV/FDF/XFDF) |
| **Accessibility** | Heuristic checker (title, language, structure tags, embedded fonts) + HTML report |
| **Measure** | Scale calibration + distance/area measurement on technical drawings/floor plans, annotated PDF export |
| **Compare** | Per-page pixel diff + text diff between two PDF versions, HTML report |
| **Portfolio** | Attach multiple files (PDF, images, Office, etc.) + index page into a single PDF Portfolio |
| **Automation** | Tool-chain wizard for batch-processing many PDF files at once |

### What makes it pleasant to use

- **Sane file selection**: select/drop files multiple times to add to the
  list (without overwriting your previous selection), remove a single file
  without starting over, and reorder via drag-and-drop or ↑/↓ buttons —
  important for controlling PDF merge order.
- **Page preview**: in page-organization tools, hover or click a file name to
  scroll through every page before deciding on the order/page range.
- **Click-directly-on-the-page**: Fill & Sign, Comments & Markup, Edit Page
  Text, the Measure tool, and the Form Designer can all be operated by
  clicking directly on the document preview — no manual X/Y coordinate math
  required.
- **Progress & data safety**: every operation shows progress, and once the
  result is downloaded, the app confirms that all in-browser memory copies
  have been cleared.

## Terminology

| Term | Meaning |
|---|---|
| Engine | A pure, UI-independent module in `src/engines/` implementing one feature's file-processing logic. |
| Web Worker (`engine.worker.js`) | A background thread that runs engine modules so large files don't freeze the UI. |
| PAdES | PDF Advanced Electronic Signatures — the digital-signature standard used for the Certified Digital Signature tool. |
| AcroForm | The classic interactive PDF form field format (text/checkbox/radio/dropdown) used by the Forms tool. |
| Redaction (flattening) | Permanently burning sensitive content into the page image/content stream so it can't be recovered, rather than just visually hiding it. |
| Bates Numbering | Sequential page-numbering scheme commonly used in legal document sets. |
| .sav | The SPSS binary data file format, supported for Excel ↔ SPSS conversion. |

## How to use

There are two ways to get it running, depending on whether you already have
a pre-built `dist/` folder or just the source code.

### Option 1 — You already have a `dist/` folder (easiest, nothing to install)

If you received this project already bundled with a `dist/` folder (e.g. via
a shared file/zip), skip straight to "Load into Chrome/Edge" below — no
build step needed.

### Option 2 — Build from source

Requires [Node.js](https://nodejs.org/) version 18 or later.

```bash
npm install
npm run build
```

This produces a `dist/` folder ready to be loaded as an extension.

### Load into Chrome/Edge

1. Open `chrome://extensions` (or `edge://extensions` for Microsoft Edge).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**, then select the `dist/` folder (not the parent
   project folder).
4. The "OpenDoc Studio" extension will appear in your extension list and in
   the browser toolbar.
5. Click its icon in the toolbar to open OpenDoc Studio in a new tab.

No login required, no internet connection needed once loaded, no environment
variables or API keys to configure, and no data is ever sent out —
everything is processed locally on your machine.

### Updating after changing the code

Whenever the source code (`src/`) changes, re-run `npm run build`, then click
the **refresh/reload** button on the extension card at
`chrome://extensions` to see the changes.

### Running tests

```bash
npm test
```

Automated tests (`vitest`) cover pure logic that doesn't require a DOM:
`.sav` format reading/writing, PDF organization operations, Excel/CSV
conversion, PDF annotations, page text editing, and digital signatures
(including real cryptographic verification + tamper-detection tests).

There is also a browser-based end-to-end test layer:

```bash
npm run build            # required before test:e2e — it tests the built dist/
npx playwright install chromium   # one-time setup
npm run test:e2e
```

`test/e2e/smoke.mjs` loads the actual built extension into Chromium via
Playwright, then runs every "Ready" tool and checks the real output.

### Architecture overview

- `src/engines/` — pure per-feature logic (PDF, conversion, Excel↔SAV,
  archives), UI-independent and easy to unit test.
- `src/workers/engine.worker.js` — a single generic Web Worker that loads
  engine modules on demand, so the UI doesn't freeze while processing large
  files. Features that need direct DOM access (html2canvas, libarchive.js,
  tesseract.js, interactive canvas clicks) run on the main thread instead.
- `src/app/` — the interface: `tool-registry.js` (declarative list of all 47
  tools), `components/tool-workspace.js` + `components/file-picker.js`
  (generic UI: select/reorder files → preview → options → process →
  download), `components/pdf-canvas.js` (renders PDF pages to `<canvas>` for
  interactive tools), `views/` (Home, Settings, and tools with dedicated UIs),
  hash-based routing.
- `src/core/` — cross-feature orchestration: file lifecycle (`pipeline.js`),
  batch temporary storage (`file-store.js`), worker bridge
  (`worker-bridge.js`).

Third-party licenses: see [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
Further development plans & intentional limitations: see
[ROADMAP.md](./ROADMAP.md).

### Tech stack

Vite, vanilla JavaScript, pdf-lib, pdfjs-dist, mammoth, xlsx, pptxgenjs,
tesseract.js, node-forge, libarchive.js, html2canvas. Tested with Vitest and
Playwright.

## License

MIT — see [LICENSE](./LICENSE).

---

## Bahasa Indonesia

Editor, konverter, dan toolkit keamanan dokumen (PDF, Word, Excel,
PowerPoint, SPSS, arsip terkompresi) yang mengutamakan privasi dan berjalan
**100% di dalam browser Anda** — tanpa server, tanpa API, tidak ada file
yang pernah diunggah ke mana pun. Dirilis sebagai ekstensi browser untuk
Chrome, Edge, dan browser berbasis Chromium lainnya. Berlisensi MIT, gratis
dan terbuka untuk siapa saja. **47 tool siap pakai** dalam 13 kategori —
tidak ada satu pun yang masih Beta.

## Mengapa privat secara desain

- Ekstensi ini **tidak meminta `host_permissions`**, dan Content-Security-Policy-nya
  memblokir semua koneksi jaringan keluar (`connect-src 'self'`). Secara
  teknis mustahil bagi ekstensi ini untuk mengirim file Anda ke mana pun.
- Setiap tool memproses file sepenuhnya di memori browser. Begitu Anda
  mengunduh hasilnya, semua salinan di memori (input maupun output)
  dihapus.
- OCR (pengenalan teks) menggunakan data bahasa yang sudah dibundel di
  dalam ekstensi (`public/tessdata/`), tidak pernah diambil dari CDN saat
  runtime.
- Fitur **Batch Automation** dan operasi lain yang butuh penyimpanan
  sementara menggunakan IndexedDB hanya untuk menyimpan hasil antara di
  antara langkah-langkah; penyimpanan itu otomatis dibersihkan setelah
  selesai atau setelah 15 menit lewat `chrome.alarms`.

## Fungsi

OpenDoc Studio memungkinkan Anda mengedit, mengonversi, mengamankan,
menandatangani, memberi anotasi, dan mengorganisir dokumen sepenuhnya
secara offline, tanpa harus mempercayakan file Anda ke server pihak
ketiga — menyelesaikan masalah "saya tidak mau mengunggah
PDF/kontrak/scan KTP sensitif ke situs online sembarangan" yang biasa
dipaksakan oleh kebanyakan tool PDF online.

## Semua fitur

Semua tool di bawah ini berstatus **Ready** (berfungsi penuh). Batasan
yang disengaja untuk fitur tertentu (bukan bug) — misalnya font pengganti
yang dipakai di "Edit Page Text" tidak identik dengan font asli, atau
Measure Tool hanya mengukur halaman 1 — didokumentasikan dengan jujur di
[ROADMAP.md](./ROADMAP.md).

**Toggle bahasa** — sidebar, layar home, dan halaman pengaturan bisa
berganti antara Indonesia dan Inggris (`src/app/i18n.js`), tersimpan di
`localStorage`. Layar tool individual (Automation, Digital Sign, Edit Text,
Fill & Sign, Forms, Markup, Measure, Page Select) belum membaca setting ini
dan masih menampilkan label dalam bahasa aslinya apa pun pilihan togglenya.

| Kategori | Tool |
|---|---|
| **Organisasi Halaman** | Merge PDF (urutan file via drag-and-drop + preview tiap halaman), Split, **Extract/Delete Pages** (klik thumbnail halaman langsung untuk memilih), Rotate Pages, Bates Numbering |
| **Edit PDF** | Text Watermark, Header/Footer, Page Numbers, Edit Metadata, Compress, **Edit Page Text** (klik teks mana pun di halaman mana pun untuk menggantinya langsung, dengan pencocokan warna latar dan font otomatis, berfungsi di semua halaman) |
| **Konversi** | PDF ↔ Word (termasuk deteksi otomatis tabel, heading, dan bullet-list), PDF ↔ PowerPoint, PDF ↔ Excel, PDF ↔ Image, PDF ↔ HTML, PDF ↔ Text, PDF → PDF/A, Excel ↔ CSV, Excel ↔ SPSS (.sav), Arsip (RAR/7z/TAR/GZIP/BZIP2/ISO) → ZIP |
| **Keamanan** | Password Lock/Unlock (AES-256), **Keyword & Pattern Redaction** (deteksi otomatis email/nomor telepon/NIK/nomor kartu kredit, plus keyword manual) dengan flattening, Sanitize Metadata/JS/Attachments |
| **Pengenalan Teks (OCR)** | Scanned PDF → Searchable PDF, Extract Text from Scans — Indonesia, Inggris, atau campuran (ind+eng), sepenuhnya offline, dengan pra-pemrosesan gambar (grayscale + binarisasi otomatis) untuk akurasi lebih baik pada scan dunia nyata |
| **Tanda Tangan** | Fill & Sign (klik langsung di halaman untuk menempatkan tanda tangan teks/gambar), Certified Digital Signature (gaya PAdES, PKCS#7), Signature Verification |
| **Komentar & Markup** | Highlight, Freehand Ink, dan Sticky Notes — satu tool, tiga mode, semuanya klik langsung di preview; menghasilkan anotasi PDF native yang terlihat di Adobe Reader atau pembaca PDF mana pun |
| **Form** | Perancang field AcroForm visual (text/checkbox/radio/dropdown), Form Data Export (CSV/FDF/XFDF) |
| **Aksesibilitas** | Pemeriksa heuristik (judul, bahasa, tag struktur, font terbenam) + laporan HTML |
| **Ukur (Measure)** | Kalibrasi skala + pengukuran jarak/luas pada gambar teknik/denah, ekspor PDF beranotasi |
| **Bandingkan (Compare)** | Perbandingan piksel per halaman + diff teks antara dua versi PDF, laporan HTML |
| **Portfolio** | Melampirkan banyak file (PDF, gambar, Office, dll) + halaman indeks ke dalam satu PDF Portfolio |
| **Otomasi** | Wizard rangkaian tool untuk memproses banyak file PDF sekaligus (batch) |

### Yang membuatnya nyaman digunakan

- **Pemilihan file yang masuk akal**: pilih/drop file berkali-kali untuk
  menambah ke daftar (tanpa menimpa pilihan sebelumnya), hapus satu file
  tanpa mengulang dari awal, dan urutkan ulang lewat drag-and-drop atau
  tombol ↑/↓ — penting untuk mengontrol urutan penggabungan PDF.
- **Preview halaman**: pada tool organisasi halaman, arahkan kursor atau
  klik nama file untuk menelusuri setiap halaman sebelum menentukan
  urutan/rentang halaman.
- **Klik langsung di halaman**: Fill & Sign, Comments & Markup, Edit Page
  Text, tool Measure, dan Form Designer semuanya bisa dioperasikan dengan
  klik langsung di preview dokumen — tanpa perlu menghitung koordinat
  X/Y manual.
- **Progres & keamanan data**: setiap operasi menampilkan progres, dan
  setelah hasil diunduh, aplikasi mengonfirmasi bahwa semua salinan di
  memori browser sudah dibersihkan.

## Istilah

| Istilah | Arti |
|---|---|
| Engine | Modul murni tanpa ketergantungan UI di `src/engines/` yang mengimplementasikan logika pemrosesan file satu fitur. |
| Web Worker (`engine.worker.js`) | Thread background yang menjalankan modul engine agar file besar tidak membekukan UI. |
| PAdES | PDF Advanced Electronic Signatures — standar tanda tangan digital yang dipakai tool Certified Digital Signature. |
| AcroForm | Format field form PDF interaktif klasik (text/checkbox/radio/dropdown) yang dipakai tool Forms. |
| Redaction (flattening) | Membakar konten sensitif secara permanen ke gambar/content stream halaman agar tidak bisa dipulihkan, bukan sekadar menyembunyikannya secara visual. |
| Bates Numbering | Skema penomoran halaman berurutan yang umum dipakai dalam kumpulan dokumen legal. |
| .sav | Format file data biner SPSS, didukung untuk konversi Excel ↔ SPSS. |

## Cara menggunakan

Ada dua cara menjalankan proyek ini, tergantung apakah Anda sudah punya
folder `dist/` hasil build atau hanya source code.

### Opsi 1 — Sudah punya folder `dist/` (paling mudah, tanpa instalasi)

Jika Anda menerima proyek ini sudah dilengkapi folder `dist/` (misalnya
lewat file/zip yang dibagikan), langsung lompat ke "Muat ke Chrome/Edge"
di bawah — tanpa perlu build.

### Opsi 2 — Build dari source

Membutuhkan [Node.js](https://nodejs.org/) versi 18 atau lebih baru.

```bash
npm install
npm run build
```

Ini menghasilkan folder `dist/` yang siap dimuat sebagai ekstensi.

### Muat ke Chrome/Edge

1. Buka `chrome://extensions` (atau `edge://extensions` untuk Microsoft Edge).
2. Aktifkan **Developer mode** (toggle di pojok kanan atas).
3. Klik **Load unpacked**, lalu pilih folder `dist/` (bukan folder proyek
   induknya).
4. Ekstensi "OpenDoc Studio" akan muncul di daftar ekstensi dan di toolbar
   browser.
5. Klik ikonnya di toolbar untuk membuka OpenDoc Studio di tab baru.

Tidak perlu login, tidak perlu koneksi internet setelah dimuat, tidak ada
environment variable atau API key yang perlu dikonfigurasi, dan tidak ada
data yang pernah dikirim keluar — semuanya diproses secara lokal di
komputer Anda.

### Memperbarui setelah mengubah kode

Setiap kali source code (`src/`) berubah, jalankan ulang `npm run build`,
lalu klik tombol **refresh/reload** pada kartu ekstensi di
`chrome://extensions` untuk melihat perubahannya.

### Menjalankan test

```bash
npm test
```

Test otomatis (`vitest`) mencakup logika murni yang tidak memerlukan DOM:
baca/tulis format `.sav`, operasi organisasi PDF, konversi Excel/CSV,
anotasi PDF, edit teks halaman, dan tanda tangan digital (termasuk
verifikasi kriptografi nyata + test deteksi tamper).

Ada juga lapisan test end-to-end berbasis browser:

```bash
npm run build            # wajib sebelum test:e2e — menguji dist/ hasil build
npx playwright install chromium   # setup sekali saja
npm run test:e2e
```

`test/e2e/smoke.mjs` memuat ekstensi hasil build sungguhan ke Chromium
lewat Playwright, lalu menjalankan setiap tool berstatus "Ready" dan
memeriksa output sungguhan.

### Gambaran arsitektur

- `src/engines/` — logika murni per-fitur (PDF, konversi, Excel↔SAV,
  arsip), tidak bergantung UI dan mudah diuji unit.
- `src/workers/engine.worker.js` — satu Web Worker generik yang memuat
  modul engine sesuai kebutuhan, agar UI tidak macet saat memproses file
  besar. Fitur yang butuh akses DOM langsung (html2canvas, libarchive.js,
  tesseract.js, klik canvas interaktif) berjalan di main thread.
- `src/app/` — antarmuka: `tool-registry.js` (daftar deklaratif 47 tool),
  `components/tool-workspace.js` + `components/file-picker.js` (UI
  generik: pilih/urutkan file → preview → opsi → proses → unduh),
  `components/pdf-canvas.js` (merender halaman PDF ke `<canvas>` untuk
  tool interaktif), `views/` (Home, Settings, dan tool dengan UI khusus),
  routing berbasis hash.
- `src/core/` — orkestrasi lintas-fitur: siklus hidup file
  (`pipeline.js`), penyimpanan sementara batch (`file-store.js`), jembatan
  worker (`worker-bridge.js`).

Lisensi pihak ketiga: lihat [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
Rencana pengembangan lanjutan & keterbatasan yang disengaja: lihat
[ROADMAP.md](./ROADMAP.md).

### Tumpukan teknologi

Vite, vanilla JavaScript, pdf-lib, pdfjs-dist, mammoth, xlsx, pptxgenjs,
tesseract.js, node-forge, libarchive.js, html2canvas. Diuji dengan Vitest
dan Playwright.

## Lisensi

MIT — lihat [LICENSE](./LICENSE).
