# OpenDoc Studio

Editor, konverter, dan pengaman dokumen (PDF, Word, Excel, PowerPoint, SPSS,
arsip terkompresi) yang berjalan **100% di browser Anda** — tidak ada server,
tidak ada API, tidak ada file yang pernah diunggah kemana pun. Ekstensi untuk
Chrome, Edge, dan browser berbasis Chromium lainnya. Lisensi MIT, gratis dan
terbuka untuk siapa saja. **47 alat siap pakai** ("Ready") di 13 kategori —
tidak ada satupun yang masih berstatus Beta.

## Mengapa ini aman secara privasi

- Ekstensi ini **tidak memiliki `host_permissions`** dan Content-Security-Policy-nya
  memblokir semua koneksi jaringan keluar (`connect-src 'self'`). Secara teknis
  mustahil bagi ekstensi ini mengirim file Anda kemana pun.
- Setiap alat memproses file sepenuhnya di memori peramban. Begitu Anda
  mengunduh hasilnya, seluruh salinan di memori (input maupun output) langsung
  dihapus.
- OCR (pengenalan teks) memakai data bahasa yang sudah dibundel di dalam
  ekstensi (`public/tessdata/`), bukan diunduh dari CDN saat dipakai.
- Fitur **Otomasi/Batch** dan operasi lain yang butuh penyimpanan sementara
  memakai IndexedDB hanya agar hasil antar-langkah bisa bertahan; itu pun
  otomatis dibersihkan setelah selesai atau setelah 15 menit oleh
  `chrome.alarms`.

## Fitur (status hari ini)

Semua alat di bawah berstatus **Ready** (berfungsi penuh). Batasan yang
disengaja (bukan bug) untuk fitur-fitur tertentu — mis. font pengganti pada
"Edit Teks Halaman" tidak identik dengan font asli, atau Measure Tool hanya
mengukur halaman 1 — didokumentasikan jujur di [ROADMAP.md](./ROADMAP.md).

| Kategori | Alat |
|---|---|
| **Atur Halaman** | Gabung PDF (drag-drop urutkan file + pratinjau semua halaman), Pisah, **Ekstrak/Hapus Halaman** (klik langsung thumbnail halaman untuk memilih), Putar Halaman, Penomoran Bates |
| **Edit PDF** | Watermark teks, Header/Footer, Nomor Halaman, Edit Metadata, Kompres, **Edit Teks Halaman** (klik teks yang ada di halaman mana pun untuk menggantinya langsung di tempat, dengan penyesuaian warna latar & font otomatis, mendukung semua halaman) |
| **Konversi** | PDF ↔ Word (termasuk deteksi tabel, heading, dan bullet list otomatis), PDF ↔ PowerPoint, PDF ↔ Excel, PDF ↔ Gambar, PDF ↔ HTML, PDF ↔ Teks, PDF → PDF/A, Excel ↔ CSV, Excel ↔ SPSS (.sav), Arsip (RAR/7z/TAR/GZIP/BZIP2/ISO) → ZIP |
| **Keamanan** | Kunci/Buka Kata Sandi (AES-256), **Redaksi Kata Kunci & Pola Data** (deteksi otomatis email/telepon/NIK/kartu kredit selain kata kunci manual) + flatten, Bersihkan Metadata/JS/Lampiran |
| **Kenali Teks (OCR)** | PDF Scan → PDF Bisa Dicari, Ekstrak Teks dari Scan — Bahasa Indonesia, Inggris, atau campuran (ind+eng), offline sepenuhnya, dengan pra-pemrosesan gambar (grayscale + binarisasi otomatis) untuk akurasi lebih baik pada hasil scan nyata |
| **Tanda Tangan** | Isi & Tanda Tangan (klik langsung di halaman untuk menempel teks/gambar tanda tangan), Tanda Tangan Digital Bersertifikat (PAdES-style, PKCS#7), Verifikasi Tanda Tangan |
| **Komentar & Markup** | Sorot (highlight), Coret Tangan (ink), dan Catatan Tempel — satu alat, tiga mode, semua klik-langsung di atas pratinjau halaman; anotasi PDF asli, terlihat di Adobe Reader/PDF viewer manapun |
| **Formulir** | Perancang Field AcroForm visual (teks/checkbox/radio/dropdown), Ekspor Data Formulir (CSV/FDF/XFDF) |
| **Aksesibilitas** | Pemeriksa heuristik (judul, bahasa, tag struktur, font tersemat) + laporan HTML |
| **Ukur** | Kalibrasi skala + ukur jarak/luas pada gambar teknik/denah, ekspor PDF beranotasi |
| **Bandingkan** | Diff piksel per halaman + diff teks antar dua versi PDF, laporan HTML |
| **Portofolio** | Lampirkan banyak file (PDF, gambar, Office, dll.) + halaman indeks dalam satu PDF Portfolio |
| **Otomasi** | Wizard rantai-alat untuk memproses banyak file PDF sekaligus secara batch |

### Yang membuat pengalaman penggunaannya nyaman

- **Pemilihan file yang masuk akal**: pilih/seret file berkali-kali untuk
  menambah ke daftar (tidak menimpa pilihan sebelumnya), hapus satu file
  tanpa mengulang dari awal, dan urutkan ulang lewat drag-and-drop atau
  tombol ↑/↓ — penting untuk urutan penggabungan PDF.
- **Pratinjau halaman**: pada alat pengaturan halaman, arahkan kursor atau
  klik nama file untuk melihat seluruh halamannya (bisa di-scroll) sebelum
  memutuskan urutan/rentang halaman.
- **Klik-langsung-di-halaman**: Isi & Tanda Tangan, Komentar & Markup, Edit
  Teks Halaman, Alat Ukur, dan Perancang Formulir semuanya bisa dioperasikan
  dengan klik langsung pada pratinjau dokumen — tidak perlu menghitung
  koordinat X/Y manual.
- **Progres & keamanan data**: setiap proses menampilkan progres, dan begitu
  hasil diunduh, aplikasi menampilkan konfirmasi bahwa salinan di memori
  browser sudah dihapus.

## Instalasi & Menjalankan

Ada dua cara, tergantung apakah Anda menerima folder `dist/` yang sudah jadi
atau kode sumbernya.

### Cara 1 — Sudah punya folder `dist/` (paling mudah, tidak perlu install apapun)

Jika Anda menerima proyek ini lengkap dengan folder `dist/` di dalamnya
(misalnya lewat distribusi/berbagi file), langsung ke langkah "Muat ke
Chrome/Edge" di bawah — lewati bagian build.

### Cara 2 — Build dari kode sumber

Butuh [Node.js](https://nodejs.org/) versi 18 ke atas.

```bash
npm install
npm run build
```

Perintah ini menghasilkan folder `dist/` yang siap dimuat sebagai ekstensi.

### Muat ke Chrome/Edge

1. Buka `chrome://extensions` (atau `edge://extensions` untuk Microsoft Edge).
2. Aktifkan **Developer mode** (toggle di kanan atas).
3. Klik **Load unpacked**, lalu pilih folder `dist/` (bukan folder proyek
   induknya).
4. Ekstensi "OpenDoc Studio" akan muncul di daftar dan di toolbar browser.
5. Klik ikonnya di toolbar untuk membuka OpenDoc Studio di tab baru.

Tidak perlu login, tidak perlu koneksi internet setelah dimuat, dan tidak ada
data yang dikirim keluar — semua diproses lokal di komputer Anda.

**Membagikan ke orang lain**: cukup salin seluruh folder proyek (termasuk
`dist/`), atau kompres sebagai `.zip`. Penerima tinggal ekstrak dan ikuti
langkah "Muat ke Chrome/Edge" di atas — tidak perlu Node.js maupun `npm
install` jika `dist/` sudah disertakan.

### Memperbarui setelah mengubah kode

Setiap kali kode sumber (`src/`) berubah, jalankan ulang `npm run build`,
lalu klik tombol **refresh/reload** pada kartu ekstensi di
`chrome://extensions` agar perubahan terlihat.

## Menjalankan pengujian

```bash
npm test
```

Pengujian otomatis (`vitest`) mencakup logika murni yang tidak butuh DOM:
pembacaan/penulisan format `.sav`, operasi organisasi PDF, konversi
Excel/CSV, anotasi PDF, edit teks halaman, dan tanda tangan digital
(termasuk verifikasi kriptografis nyata + uji deteksi tampering).

Ada juga lapisan uji end-to-end di browser sungguhan:

```bash
npm run build            # wajib sebelum test:e2e — ia menguji dist/ yang sudah jadi
npx playwright install chromium   # sekali saja
npm run test:e2e
```

`test/e2e/smoke.mjs` memuat ekstensi yang benar-benar sudah di-build ke dalam
Chromium via Playwright, lalu menjalankan setiap alat "Ready" (baik yang
lewat `engine.worker.js`, yang berjalan di thread utama, maupun tool
interaktif berbasis klik-kanvas seperti Measure/Forms/Markup/Edit Teks
Halaman) dan memeriksa hasilnya sungguhan. Lapisan ini penting: sebuah bug
sistemik pernah lolos dari seluruh suite `vitest` karena `vitest` menjalankan
modul engine langsung di Node, tidak pernah benar-benar memuat
`engine.worker.js` sebagai Web Worker asli — padahal justru di situ letak
bug-nya (lihat catatan di `vite.config.js` soal `modulePreload: false`).

## Arsitektur singkat

- `src/engines/` — logika murni per fitur (PDF, konversi, Excel↔SAV, arsip),
  tidak bergantung pada UI, mudah diuji satuan.
- `src/workers/engine.worker.js` — satu Web Worker generik yang memuat modul
  engine sesuai permintaan, supaya UI tidak macet saat memproses file besar.
  Fitur yang butuh DOM langsung (html2canvas, libarchive.js, tesseract.js,
  klik-kanvas interaktif) berjalan di thread utama — lihat komentar di
  masing-masing file engine.
- `src/app/` — antarmuka: `tool-registry.js` (daftar deklaratif semua 47
  alat), `components/tool-workspace.js` + `components/file-picker.js` (UI
  generik: pilih/urutkan file → pratinjau → opsi → proses → unduh),
  `components/pdf-canvas.js` (render halaman PDF ke `<canvas>` untuk tool
  interaktif), `views/` (Beranda, Pengaturan, dan tool-tool dengan UI khusus
  seperti Markup/Edit Teks/Isi & Tanda Tangan/Ukur/Formulir/Otomasi), routing
  berbasis hash.
- `src/core/` — orkestrasi lintas fitur: siklus hidup file (`pipeline.js`),
  penyimpanan sementara batch (`file-store.js`), jembatan worker
  (`worker-bridge.js`).

Lisensi pihak ketiga: lihat [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
Rencana pengembangan lanjutan & batasan yang disengaja: lihat
[ROADMAP.md](./ROADMAP.md).
