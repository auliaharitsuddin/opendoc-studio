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

## Features (current status)

Every tool listed below is **Ready** (fully functional). Intentional
limitations for specific features (not bugs) — e.g. the substitute font used
in "Edit Page Text" is not identical to the original font, or the Measure
Tool only measures page 1 — are documented honestly in
[ROADMAP.md](./ROADMAP.md).

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

## Installation & Running

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

No login required, no internet connection needed once loaded, and no data is
ever sent out — everything is processed locally on your machine.

**Sharing with others**: simply copy the whole project folder (including
`dist/`), or zip it up. The recipient just extracts it and follows the "Load
into Chrome/Edge" steps above — no Node.js or `npm install` needed if
`dist/` is already included.

### Updating after changing the code

Whenever the source code (`src/`) changes, re-run `npm run build`, then click
the **refresh/reload** button on the extension card at
`chrome://extensions` to see the changes.

## Running tests

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
Playwright, then runs every "Ready" tool (both those routed through
`engine.worker.js`, which runs on a background thread, and interactive
canvas-click tools like Measure/Forms/Markup/Edit Page Text) and checks the
real output. This layer matters: a systemic bug once slipped past the entire
`vitest` suite because `vitest` runs engine modules directly in Node and
never actually loads `engine.worker.js` as a real Web Worker — which is
exactly where the bug was (see the note in `vite.config.js` about
`modulePreload: false`).

## Architecture overview

- `src/engines/` — pure per-feature logic (PDF, conversion, Excel↔SAV,
  archives), UI-independent and easy to unit test.
- `src/workers/engine.worker.js` — a single generic Web Worker that loads
  engine modules on demand, so the UI doesn't freeze while processing large
  files. Features that need direct DOM access (html2canvas, libarchive.js,
  tesseract.js, interactive canvas clicks) run on the main thread instead —
  see the comments in each engine file.
- `src/app/` — the interface: `tool-registry.js` (declarative list of all 47
  tools), `components/tool-workspace.js` + `components/file-picker.js`
  (generic UI: select/reorder files → preview → options → process →
  download), `components/pdf-canvas.js` (renders PDF pages to `<canvas>` for
  interactive tools), `views/` (Home, Settings, and tools with dedicated UIs
  such as Markup/Edit Text/Fill & Sign/Measure/Forms/Automation),
  hash-based routing.
- `src/core/` — cross-feature orchestration: file lifecycle (`pipeline.js`),
  batch temporary storage (`file-store.js`), worker bridge
  (`worker-bridge.js`).

Third-party licenses: see [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
Further development plans & intentional limitations: see
[ROADMAP.md](./ROADMAP.md).

## Tech stack

Vite, vanilla JavaScript, pdf-lib, pdfjs-dist, mammoth, xlsx, pptxgenjs,
tesseract.js, node-forge, libarchive.js, html2canvas. Tested with Vitest and
Playwright.

## License

MIT — see [LICENSE](./LICENSE).
