# Master Prompt — Build "OpenDoc Studio"

This document is a self-contained prompt: hand it to an AI coding agent (or
use it as a project brief for a human team) and the result should be this
application, end to end. It captures the goal, constraints, full feature
list, architectural conventions, and quality bar this codebase actually
follows — reverse-engineered from the finished project so it can be rebuilt
or re-derived faithfully.

---

## 1. The brief

Build **OpenDoc Studio**: a free, open-source (MIT) Chrome/Edge browser
extension (Manifest V3) that replicates the core feature set of Adobe
Acrobat Pro — PDF editing, organizing, converting, securing, signing,
annotating, OCR, forms, measurement, comparison, and batch automation — plus
Word/Excel/PowerPoint/SPSS/archive conversions, **entirely client-side**.

Non-negotiable constraint: **no server, no API calls, no file ever leaves
the user's browser.** This shapes every technical decision below — every
library must run fully in-browser (WASM/pure-JS), and the extension's own
manifest must make outbound network calls technically impossible, not just
policy-forbidden.

Target audience: everyday users (legal, admin, students, office workers) who
currently pay for or pirate Acrobat Pro for occasional PDF tasks, plus
privacy-conscious users who don't want to upload sensitive documents to
web-based "free PDF tool" sites that monetize by scanning/reselling
uploaded content.

## 2. Tech stack & hard constraints

- **Build tool**: Vite, targeting `es2022`, output to `dist/` as an unpacked
  MV3 extension. Disable `build.modulePreload` — Vite's default dynamic
  `import()` wrapper touches `document`, which doesn't exist inside a Web
  Worker and silently breaks every worker-routed tool.
- **No UI framework.** Plain JS + a tiny `el(tag, attrs, children)` DOM
  helper (hyperscript-style, ~15 lines) reused everywhere. No React/Vue/
  Svelte — keeps the bundle small and avoids framework-specific worker
  quirks.
- **Manifest V3**, hash-based routing (`#/tool/:id`), **no
  `host_permissions`**, CSP with `connect-src 'self'` (blocks all outbound
  network requests at the platform level, not just by convention).
- **Core libraries** (all must work fully offline/client-side):
  `pdf-lib` (PDF creation/editing), `pdfjs-dist` (PDF rendering/text
  extraction), `tesseract.js` + bundled `.traineddata` files (OCR, no CDN
  fetch), `docx` + `mammoth` (Word), `pptxgenjs` (PowerPoint), `xlsx`
  (Excel), `jszip` (archives), `libarchive.js` (RAR/7z/TAR/GZIP/BZIP2/ISO
  extraction), `node-forge` (crypto for digital signatures),
  `@pdfsmaller/pdf-encrypt` + `@pdfsmaller/pdf-decrypt` (password
  protection), `html2canvas` (HTML→PDF).
- **Testing**: `vitest` for pure engine logic (Node environment, no DOM) —
  every engine function should be unit-testable in isolation. Additionally,
  a **Playwright end-to-end smoke test** that loads the actual built
  extension into real Chromium and drives every tool through its real UI —
  this is not optional. A generic-import unit test runner can miss systemic
  bugs that only appear in a real Web Worker/browser environment (this
  project shipped one: `modulePreload` broke every worker-routed tool, and
  `vitest` never caught it because it runs engine modules directly in Node).

## 3. Architecture

```
src/
  engines/          Pure logic per feature — no DOM, no UI imports, unit-testable.
    pdf/             organize, edit-text, annotations, watermark, page-numbers,
                      metadata, compress, protect, redact, sanitize, ocr,
                      digital-sign, fill-sign, forms, accessibility, measure,
                      compare, portfolio
    convert/          pdf<->docx, pdf<->pptx, pdf<->xlsx, pdf<->image,
                       pdf<->html, pdf<->text, pdf->pdfa, xlsx<->csv
    excel-sav/        SPSS .sav read/write
    archive/          archive -> zip
  workers/
    engine.worker.js  One generic Web Worker that dynamically imports the
                       requested engine module by name and runs one exported
                       function, so the UI thread never blocks on big files.
                       Features needing real DOM (html2canvas, libarchive.js,
                       tesseract.js, canvas-click interactivity) run on the
                       main thread instead — document per engine file why.
  core/
    pipeline.js       downloadResult() (blob -> chrome.downloads -> revoke
                       object URL), wipeSession() (zero out buffers, clear
                       object URLs, delete scratch IndexedDB records).
    file-store.js      IndexedDB scratch storage for multi-step batch jobs,
                        auto-purged via chrome.alarms after 15 minutes.
    worker-bridge.js   Thin promise+progress wrapper over postMessage
                        ({id, type, payload} in / {id, kind: progress|done|
                        error, ...} out).
    page-range.js      Parses "1,3,5-7" style page-range strings.
    pdfjs-setup.js     Configures pdfjs-dist's worker/font URLs to bundled
                        extension assets (no CDN).
  app/
    tool-registry.js   Single declarative array of every tool: {id, category,
                        title, description, status, accept, multiple,
                        previewPdf, options[], outExt, mainThread, customView,
                        run({files, options, onProgress})}. This is the one
                        file that defines "what tools exist" — adding a tool
                        is (usually) one entry here plus one engine function.
    router.js          Hash parsing: home / category/:id / tool/:id / settings.
    sidebar.js, app.js Layout shell + CUSTOM_VIEWS registry mapping
                        tool.customView strings to bespoke view render fns.
    components/
      dom.js            el() helper + renderOptionField() (generic option
                         inputs: text/number/password/checkbox/select, where
                         select choices can be plain strings or
                         {value,label} pairs).
      tool-workspace.js Generic per-tool UI: file-picker -> options form ->
                         Proses button -> progress bar -> result/download,
                         used by every tool that doesn't need a bespoke view.
      file-picker.js    Stateful, reusable file-intake widget (see §4).
      pdf-canvas.js      renderPdfPageToCanvas() / renderAllPagesToCanvases():
                          render PDF page(s) to real <canvas> elements with a
                          canvas<->PDF-point coordinate converter, for every
                          click-to-place interactive tool.
    views/             Bespoke views for tools that need more than the
                       generic workspace: home, settings, automation,
                       digital-sign, measure, forms, markup, edit-text,
                       fill-sign.
```

## 4. UX conventions to reproduce exactly

These aren't incidental — they're the difference between "technically has
the feature" and "pleasant to actually use":

- **File picker** (`file-picker.js`, shared by nearly every tool): picking
  or dropping files **accumulates** into the existing selection (never
  silently replaces it), supports per-file removal, and — when multiple
  files are allowed — drag-and-drop **and** ↑/↓ button reordering (both, so
  it's keyboard-accessible too), because output order (e.g. merge order)
  must be user-controllable, not dependent on OS file-dialog click order.
  Rejects files that don't match the accepted extension with a visible
  message instead of silently passing bad input downstream. Dropzone is
  keyboard-operable (`role="button"`, `tabindex`, Enter/Space) and locks
  during processing.
- **Page preview panel**: for tools where file order/content matters
  (organize category), hovering/clicking/focusing a file renders **every
  page** of that PDF into a scrollable side panel (not just page 1), so
  users can see what they're reordering without leaving the page. Panel is
  a full-height sibling of the file list (starts at the same top edge), not
  squeezed below it.
- **Click-to-place canvas pattern**: any tool that places something at a
  position (signatures, form fields, highlights, ink strokes, sticky notes,
  measurements, text edits) renders the PDF page to a real `<canvas>` and
  lets the user click/drag directly on it, converting canvas pixel
  coordinates to PDF point coordinates via a shared converter — never make
  the user type X/Y numbers when a canvas click will do.
- **Batch-apply engine convention**: when a tool can place multiple items
  before committing (form fields, annotations, signatures, text edits),
  the engine takes an **array of items** and applies all of them in one
  `PDFDocument.load()`/`.save()` pass, not one round-trip per item.
- **Progress + wipe-on-download**: every long-running tool reports
  `onProgress(percent, message)`; every result view shows a download button
  that, once clicked, downloads via `chrome.downloads`, revokes the blob's
  object URL, and visibly confirms "file dihapus dari memori" (wiped from
  memory) — privacy isn't just true, it's *shown* to be true.
- **Native `prompt()` for rare one-off inputs** (calibration distance, a
  radio option's label) is fine; for a tool's **primary** interaction
  (editing text in place), use an inline positioned `<input>` overlay
  instead — a modal dialog for the main interaction feels wrong.
- **Status is `'ready'` or `'beta'`**, never silently broken. Beta means
  "works, but the interaction is cruder than it should be" (e.g. numeric
  coordinates instead of click-to-place) — and it's a temporary state to
  eliminate, not a permanent label for "good enough."

## 5. Full feature list (47 tools, 13 categories)

Build every one of these as a `tool-registry.js` entry + engine function
(or a bespoke view for the ones marked *custom UI*):

**Atur Halaman (Organize)** — Gabungkan PDF (merge, ordered), Pisahkan PDF
(split by page ranges), Ekstrak Halaman, Hapus Halaman, Putar Halaman
(90/180/270°), Penomoran Bates. All with the multi-page preview panel.

**Edit PDF** — Watermark Teks (diagonal, opacity), Nomor Halaman
(format + position), Header & Footer, Edit Metadata (title/author/
subject/keywords), Kompres PDF (image re-encode), **Edit Teks Halaman**
*(custom UI)* — click any existing text run on any page, edit inline; engine
covers the original run with a background-color sampled from the page
itself and draws the replacement in the closest standard font family
(serif/sans-serif/monospace, detected from pdf.js's font metadata).

**Konversi (Convert)** — PDF↔Word (text/paragraph reconstruction, not pixel
clone), PDF↔PowerPoint (image-per-slide), PDF↔Excel (position-heuristic
table extraction), PDF↔Image (PNG/JPEG, zipped if multi-page), PDF↔HTML
(reflowable), PDF↔Text, PDF→PDF/A (metadata-level conformance),
Excel↔CSV, Excel↔SPSS .sav, Archive→ZIP (RAR/7z/TAR/GZIP/BZIP2/ISO).

**Keamanan (Security)** — Kunci dengan Kata Sandi (AES-256 + print/copy
permission flags), Buka Kata Sandi, Redaksi Kata Kunci (find text via
pdf.js glyph positions, cover + optional rasterize/flatten for genuine
permanence), Bersihkan Dokumen (strip metadata/JS/attachments).

**Kenali Teks (OCR)** — PDF Scan→PDF Bisa Dicari (invisible text layer at
each word's real bounding box), Ekstrak Teks dari Scan. Both: Indonesian,
English, or combined `ind+eng` recognition; preprocessing pipeline
(grayscale → Otsu auto-threshold binarization) and ~300-DPI-equivalent
render scale before recognition, for real accuracy on actual scans (not
just clean synthetic PDFs).

**Tanda Tangan (Sign)** — Isi & Tanda Tangan *(custom UI)*: click-to-place
typed-text or uploaded-image signatures. Tanda Tangan Digital Bersertifikat
*(custom UI)*: PAdES-style/PKCS#7-detached signing with a self-signed
throwaway cert or user's own `.p12`/`.pfx`, clearly labeled unverified for
self-signed. Verifikasi Tanda Tangan: checks validity + tamper detection.

**Komentar & Markup** *(custom UI, one tool three modes)* — Sorot
(highlight, drag a rectangle), Coret Tangan (ink, freehand drag), Catatan
Tempel (sticky note, click + prompt) — all real PDF annotation objects
(`/Annot /Highlight`, `/Ink`, `/Text`), visible in any standard PDF viewer.

**Formulir (Forms)** — Perancang Formulir *(custom UI)*: click-to-place real
AcroForm fields (text/checkbox/radio/dropdown). Ekspor Data Formulir: read
filled values, export CSV/FDF/XFDF.

**Aksesibilitas** — Pemeriksa Aksesibilitas: heuristic checker (title,
language, tag presence, font embedding) + downloadable HTML report.

**Ukur (Measure)** *(custom UI)* — Calibrate scale against one known
real-world distance, then measure distances/areas by clicking on a
technical drawing/floor plan; export an annotated PDF.

**Bandingkan (Compare)** — Two-file pixel diff (per page, rendered) + word-
level text diff, HTML report.

**Portofolio** — Bundle arbitrary files as PDF attachments + an index page
in one PDF Portfolio (`/Collection`), recognized by Acrobat/Reader.

**Otomasi (Automation)** *(custom UI)* — Chain multiple single-file PDF-in/
PDF-out tools into one pipeline, run against many files as a batch, download
a ZIP of results.

## 6. Quality bar

- Every deliberate scope limit or fidelity tradeoff (there will be many —
  PDF is a huge spec) gets **written down honestly** in a `ROADMAP.md`, not
  silently shipped as an undocumented gap. Distinguish "not built yet" from
  "built this way on purpose because X" — both are fine, silence isn't.
- Every engine function should be callable and testable with zero DOM
  (pure `Uint8Array`/`ArrayBuffer` in, bytes out), so `vitest` can exercise
  the actual logic, not just "did it throw."
  synthetic in-memory fixtures (a few-page PDF built with `pdf-lib`, a
  minimal `.docx`/`.xlsx`/`.sav`, etc.) — no binary test fixtures checked
  into the repo.
- The Playwright e2e suite must exercise **every** `status: 'ready'` tool
  through its real UI, including interactive canvas-click tools (mouse
  drag for highlight/ink, click for sticky notes/signatures/text edits,
  `dialog` event handling for any remaining `prompt()`/`confirm()` calls).
- README must let a non-technical recipient go from "received this folder"
  to "extension running in my browser" with zero ambiguity, covering both
  "I have a pre-built `dist/`" and "I need to build it from source" paths.

---

## Token-size estimate

Rough sizing for this prompt document and for what an AI agent following it
end-to-end would need to produce, using the common ~3.5–4 characters-per-
token approximation for English/code text (not an exact tokenizer count —
that depends on the specific model's tokenizer):

| | Characters | Estimated tokens |
|---|---:|---:|
| **This prompt file** (input, if handed to an agent) | ~15,500 | **~3,900 – 4,400** |
| **Resulting application source** (`src/` + `test/` + manifest — the realistic output) | ~279,000 | **~70,000 – 80,000** |

The output figure is for the final artifacts only (source + tests as they
exist today) — an actual agent session building this from scratch would
consume more total output tokens than that in practice, since it involves
iteration, tool calls, intermediate exploration, and revisions, not a single
clean pass of file-writing.
