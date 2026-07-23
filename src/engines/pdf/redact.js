import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Built-in sensitive-data patterns, the same "search for a data shape, not
// just literal text" capability Acrobat Pro's own redaction tool offers
// alongside plain keyword search. Indonesian-specific patterns (NIK, phone)
// are included since that's this app's primary audience.
const BUILTIN_PATTERNS = {
  email: { label: 'Alamat Email', regex: /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g },
  phone: { label: 'Nomor Telepon (ID)', regex: /(?:\+62|62|0)8[1-9][0-9]{6,10}/g },
  nik: { label: 'NIK/KTP (16 digit)', regex: /\b\d{16}\b/g },
  creditcard: { label: 'Nomor Kartu Kredit', regex: /\b(?:\d[ -]?){13,18}\d\b/g }
};

export function listRedactionPatterns() {
  return Object.entries(BUILTIN_PATTERNS).map(([key, { label }]) => ({ key, label }));
}

// Finds every occurrence of the given built-in patterns (email/phone/NIK/
// credit card) across the document. Matching happens within each pdf.js
// text run individually (the same granularity findTextMatches uses for
// keyword search), and the matched substring's rectangle is estimated by
// treating characters as evenly spaced across the run's measured width —
// an approximation (real glyphs aren't uniform width), but a consistent one
// with how this codebase already treats run-level positions elsewhere.
export async function findPatternMatches(buf, patternKeys) {
  if (!patternKeys?.length) return [];
  const patterns = patternKeys.map((k) => BUILTIN_PATTERNS[k]).filter(Boolean);
  if (!patterns.length) return [];

  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const matches = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!item.str) continue;
      const charWidth = item.width / item.str.length;
      for (const { regex } of patterns) {
        regex.lastIndex = 0;
        let m = regex.exec(item.str);
        while (m) {
          const [, , , , e, f] = item.transform;
          matches.push({
            pageIndex: i - 1,
            x: e + m.index * charWidth,
            y: f,
            width: m[0].length * charWidth,
            height: item.height || 10,
            pageWidth: viewport.width,
            pageHeight: viewport.height
          });
          m = regex.exec(item.str);
        }
      }
    }
  }
  await pdf.destroy();
  return matches;
}

// Finds every text run matching `keyword` and returns its page-space rectangle,
// derived from pdf.js's real glyph transforms (not a guess).
export async function findTextMatches(buf, keyword, { caseSensitive = false } = {}) {
  if (!keyword) return [];
  // pdfjs can take ownership of (neuter) the buffer it's handed — a
  // defensive copy keeps this safe to call alongside findPatternMatches()
  // on the same underlying bytes (the redact-pdf tool does exactly that
  // when both keyword and pattern search are used together).
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const matches = [];
  const needle = caseSensitive ? keyword : keyword.toLowerCase();
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      const str = caseSensitive ? item.str : item.str.toLowerCase();
      if (!str.includes(needle)) continue;
      const [, , , , e, f] = item.transform;
      matches.push({
        pageIndex: i - 1,
        x: e,
        y: f,
        width: item.width,
        height: item.height || 10,
        pageWidth: viewport.width,
        pageHeight: viewport.height
      });
    }
  }
  await pdf.destroy();
  return matches;
}

// Draws opaque black boxes over every match. This alone only hides the text
// visually — some PDF viewers can still let a user select/copy "covered" text.
// Pass flatten:true (default, and the recommended setting) to rasterize every
// page afterward, which permanently removes the underlying text layer.
export async function applyRedaction(buf, matches, { flatten = true, rasterScale = 2 } = {}) {
  if (matches.length === 0) return buf;
  const doc = await PDFDocument.load(buf);
  const pages = doc.getPages();
  for (const m of matches) {
    const page = pages[m.pageIndex];
    page.drawRectangle({ x: m.x, y: m.y, width: m.width, height: m.height, color: rgb(0, 0, 0) });
  }
  const boxedBytes = await doc.save();
  if (!flatten) return boxedBytes;
  return flattenToImages(boxedBytes, rasterScale);
}

// Rasterizes every page to a JPEG and rebuilds the PDF from images only — the
// bulletproof way to guarantee no text (redacted or otherwise) survives.
export async function flattenToImages(buf, scale = 2) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await out.embedJpg(bytes);
    const pdfPage = out.addPage([viewport.width, viewport.height]);
    pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  }
  await pdf.destroy();
  return out.save();
}
