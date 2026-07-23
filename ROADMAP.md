# Roadmap

OpenDoc Studio's goal is full, client-side-only feature parity with Adobe
Acrobat Pro. This file tracks what's built, what's simplified on purpose, and
what's still genuinely open — so contributions can target real gaps instead
of guessing. Contributions welcome; open a PR against any item below.

All 24 Acrobat Pro categories from the original plan now have a working
implementation, and every one of the 47 tools is status **Ready** — none are
Beta anymore. What follows is what's still rough around the edges, plus the
deliberate scope limits every feature below documents about itself.

## Still open (smaller polish items, not full features)

- **Visual page picker** — Ekstrak Halaman and Hapus Halaman now show a
  click-to-select thumbnail grid of every page (`views/page-select.js`)
  instead of a text range. Pisahkan PDF and Putar Halaman still use a text
  range ("1,3,5-7") — they're a less direct fit for the same click-to-toggle
  grid (split needs to define multiple output groups, not one selection;
  rotate needs a per-page degree, not just a yes/no) and are left as a
  follow-up. (File-level drag-and-drop reordering — the order files are
  merged/numbered in — was already solved earlier via the shared file
  picker's drag handles and ↑/↓ buttons with a scrollable per-page preview;
  this item is specifically about in-document page selection/ordering.)
- **Forms designer field resize/drag** — fields are placed at a fixed default
  size per type; there's no drag-to-resize or drag-to-reposition after
  placement (delete and re-place is the current workaround).
- **RFC 3161 timestamp authority** — digital signatures embed a local
  `signingTime` attribute but don't counter-sign against a trusted timestamp
  server (which would also require a network call, conflicting with this
  project's no-network guarantee — a future option could let users opt into
  providing their own TSA response).
- **Incremental re-signing** — `signPdf()` does one full resave; adding a
  second signature to an already-signed PDF (true incremental update,
  preserving the first signature) isn't supported yet.

## Deliberate scope limits (documented in code, not bugs)

- **Edit Teks Halaman** approximates in-place text editing: a PDF content
  stream bakes each text run into positioned glyph-draw operators (often in
  a subsetted/embedded font this app can't re-create), so there's no general
  way to mutate just the glyphs of one run. Instead, each edit paints a
  background-color-matched cover over the original run's box (color sampled
  from the rendered page itself) and draws the replacement in the closest
  standard font family (serif/sans-serif/monospace) pdf-lib ships. Good for
  short fixes/typos; long replacements may overflow the original box, and
  the replacement font won't be pixel-identical to custom/embedded fonts.
- **Digital signatures (PAdES-style)** are self-signed or use a user-supplied
  `.p12`/`.pfx` — there's no CA trust chain validation UI, and self-signed
  certs are clearly labeled as unverified. The byte-range/PKCS#7 placeholder
  logic is hand-verified with cryptographic round-trip tests (see
  `test/digital-sign.test.js`) including a tamper-detection negative control,
  since a subtly-wrong signature implementation would be worse than none.
- **Accessibility checker** is a heuristic checker (title/language/tag
  presence/font embedding), not an auto-tagger. Building a real
  `/StructTreeRoot` requires reconstructing reading order and semantic roles
  for every content run — a substantially larger effort that risks producing
  incorrect tags if rushed.
- **Measure tool** requires the user to calibrate against one page per
  session (single-page PDFs/plans); it operates on page 1 only today.
- **Compare Files** pixel-diffs at a fixed render scale and does a word-level
  text diff; it does not do semantic PDF structure comparison (e.g. "this
  paragraph moved from page 2 to page 3" is reported as a text-diff pattern,
  not a "moved" annotation).
- **Portfolio builder** embeds files via pdf-lib's standard attachment API and
  sets `/Collection /View /D`, but doesn't implement Acrobat's rich
  Collection schema (custom columns, thumbnails, sort order) — Reader/Acrobat
  will recognize and browse it, just without the fancier column layout.
- **Automation wizard** can only chain single-file, PDF-in/PDF-out tools
  (organize/edit/security). Tools that change format (conversions) or take
  multiple files (merge, Bates) can't be steps in a chain, since a step's
  output must be valid input for the next step.
- **PDF/A conversion** writes PDF/A-1B-conformant XMP metadata + an
  OutputIntent, but does not rewrite embedded fonts/color spaces or run
  veraPDF-grade validation. Good enough for many archival workflows; not a
  guarantee of strict conformance.
- **.sav (SPSS) writer** always emits *uncompressed* `$FL2` files — valid and
  universally readable, just larger than SPSS's own compressed output.
- **.sav reader** supports `$FL2` (uncompressed and "simple bytecode"
  compressed) but not `$FL3` (ZLIB-compressed, the SPSS 21+ default). Files
  saved from modern SPSS with default settings may need re-saving in a
  compatible format first. String variables are supported up to SPSS's
  classic 255-byte limit; the "very long string" extension isn't implemented.
  Custom missing-value ranges and multiple-response sets are parsed (to keep
  byte offsets correct) but not preserved in the output.
- **PDF → Word/HTML/Excel** are text-reconstruction conversions (grouped by
  position/vertical gaps), not pixel-perfect layout clones. Complex multi-
  column layouts, merged table cells, and embedded charts are not reliably
  reconstructed. This matches the fidelity tradeoff every non-ML PDF
  converter makes. PDF→Word specifically: grid-like blocks are detected and
  rendered as real Word tables, headings get real Word heading styles by
  font-size tier, and bullet-marker lines (including the literal `&bull;`
  text some PDF generators leave behind instead of a real glyph) become real
  Word bulleted paragraphs — but **inline bold within body text is not
  detected**, since pdf.js's text extraction doesn't reliably expose
  per-run font weight (only a generic serif/sans-serif/monospace hint);
  reliably detecting it would need lower-level PDF font-descriptor
  inspection, a separate and substantially larger effort.
- **PDF ↔ PowerPoint** is image-based: each slide/page becomes a single
  raster image, not editable shapes/text boxes.
- **Redaction** supports both literal keyword search and built-in
  sensitive-data patterns (email, Indonesian phone numbers, 16-digit NIK,
  credit-card-shaped numbers). Pattern matches are found per pdf.js text run
  (the same granularity keyword search uses), so a pattern split across two
  separate text runs by the PDF's own internal layout won't be caught — an
  inherent limit of run-level matching, not a specific pattern's regex being
  wrong. It's genuinely permanent only when "Flatten halaman" is left
  enabled (the default), which rasterizes the page after covering matched
  text. Without flattening, only the visual box is guaranteed — some viewers
  could theoretically still extract underlying text depending on how the
  original PDF encoded it.
- **PDF compression** re-encodes JPEG/Flate image XObjects via
  `OffscreenCanvas`; unsupported/corrupt image streams are left untouched
  rather than risking corruption.
- **OCR** preprocesses scans (grayscale + Otsu binarization, ~300 DPI-
  equivalent render scale) and supports Indonesian, English, or a combined
  `ind+eng` model, but is still bounded by Tesseract's own accuracy on very
  low-quality scans, unusual fonts, or heavily skewed pages (no deskew step
  yet).

## Contributing

Pick any item above, open an issue describing your approach if it's
non-trivial, and send a PR. Engine code lives in `src/engines/` and is
independent of the UI, so most features can be built and unit-tested (see
`test/`) before wiring up a view. When touching `pdf-lib`'s low-level
`PDFDict`/`PDFContext` API, prefer `lookupMaybe()` over `lookup()` with a type
argument — the latter throws (instead of returning `undefined`) when the key
is absent, which has caused real bugs in this codebase before (see git
history for `annotations.js` and `sanitize.js`).

**Before changing `vite.config.js`**, know why `build.modulePreload` is set to
`false`: Vite normally wraps every dynamic `import()` with a helper that
touches `document` to manage `<link rel="modulepreload">`. That helper works
fine on the main thread but throws `ReferenceError: document is not defined`
for every dynamic import inside `engine.worker.js` (a real Web Worker has no
`document`) — which once broke nearly every tool in the app simultaneously,
undetected by `vitest` (which never loads the actual bundled worker). If you
re-enable `modulePreload`, re-run `npm run test:e2e` and confirm every tool
still succeeds before shipping.
