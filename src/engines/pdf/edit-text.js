import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

function extractItems(content) {
  return content.items
    .filter((item) => item.str.trim())
    .map((item) => {
      const [a, b, , , e, f] = item.transform;
      const fontSize = Math.hypot(a, b) || item.height || 10;
      const style = content.styles?.[item.fontName];
      return {
        str: item.str,
        x: e,
        y: f,
        width: item.width,
        height: item.height || fontSize,
        fontSize,
        // Generic CSS-style family (serif/sans-serif/monospace) pdf.js
        // reports per font resource — enough to pick a closer-matching
        // standard replacement font than always defaulting to Helvetica.
        fontFamily: style?.fontFamily || 'sans-serif'
      };
    });
}

// Every text run on one page, with its page-space bounding box, approximate
// font size, and font-family hint — the same glyph-transform position
// extraction redact.js#findTextMatches already does for keyword matches, but
// returned for every run so a UI can let a user click any line to edit it.
export async function getPageTextItems(buf, pageIndex) {
  // pdfjs can take ownership of (neuter) the buffer it's handed, so callers
  // that also pass the same bytes to pdf-lib afterward (as applyTextEdits
  // callers do) need their copy left intact — hand pdfjs a defensive copy.
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = extractItems(content);
  await pdf.destroy();
  return { items, pageWidth: viewport.width, pageHeight: viewport.height };
}

// Same as getPageTextItems, but for every page in the document — opens the
// pdf.js document once instead of once per page, for tools that let a user
// browse/edit text across the whole file rather than page 1 only.
export async function getAllPagesTextItems(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      pageIndex: i - 1,
      items: extractItems(content),
      pageWidth: viewport.width,
      pageHeight: viewport.height
    });
  }
  await pdf.destroy();
  return pages;
}

const FONT_BY_GROUP = {
  sans: StandardFonts.Helvetica,
  serif: StandardFonts.TimesRoman,
  mono: StandardFonts.Courier
};

function fontGroupFor(fontFamily) {
  const f = (fontFamily || '').toLowerCase();
  if (f.includes('monospace')) return 'mono';
  if (f.includes('serif') && !f.includes('sans')) return 'serif';
  return 'sans';
}

async function getRenderedPage(pdf, pageIndex, cache, scale = 2) {
  if (cache.has(pageIndex)) return cache.get(pageIndex);
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const entry = { ctx, viewport, scale };
  cache.set(pageIndex, entry);
  return entry;
}

// Samples the page's background a few points above/below a text box (away
// from its own glyphs) so the cover rectangle blends in on non-white pages
// instead of always drawing a flat white box.
function sampleBackgroundColor(rendered, box) {
  const { ctx, viewport, scale } = rendered;
  const toCanvas = (pdfX, pdfY) => [pdfX * scale, viewport.height - pdfY * scale];
  const points = [
    toCanvas(box.x, box.y + box.height + 3),
    toCanvas(box.x + box.width, box.y + box.height + 3),
    toCanvas(box.x, box.y - 3),
    toCanvas(box.x + box.width, box.y - 3)
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [cx, cy] of points) {
    const x = Math.round(Math.min(Math.max(cx, 0), viewport.width - 1));
    const y = Math.round(Math.min(Math.max(cy, 0), viewport.height - 1));
    const { data } = ctx.getImageData(x, y, 1, 1);
    r += data[0];
    g += data[1];
    b += data[2];
    n += 1;
  }
  return n ? { r: r / n / 255, g: g / n / 255, b: b / n / 255 } : { r: 1, g: 1, b: 1 };
}

// Approximates "editing" existing PDF text: a content stream bakes each run
// into positioned glyph-draw operators (often in a subsetted/embedded font
// this app can't re-create), so there's no general way to mutate just the
// glyphs of one run in place. Instead, each edit paints a cover over the
// original run's bounding box — the same technique redact.js#applyRedaction
// uses to hide matched text, but color-matched to the surrounding page
// instead of a flat white box — then draws the replacement in the closest
// standard font family (serif/sans-serif/monospace) pdf-lib ships, at the
// same position/size. Good for short fixes/typos; long replacements may
// overflow the original box, and the replacement font won't be pixel-
// identical to custom/embedded fonts.
export async function applyTextEdits(buf, edits) {
  const doc = await PDFDocument.load(buf);
  const fontCache = {};
  for (const group of Object.keys(FONT_BY_GROUP)) {
    fontCache[group] = await doc.embedFont(FONT_BY_GROUP[group]);
  }

  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const renderCache = new Map();
  const pages = doc.getPages();

  for (const e of edits) {
    const page = pages[e.pageIndex];
    // OffscreenCanvas is a browser-only API — unavailable under vitest's Node
    // test environment, so auto-sampling degrades to plain white there
    // instead of throwing (real usage always runs inside the extension).
    let cover = e.coverColor;
    if (!cover) {
      cover =
        typeof OffscreenCanvas !== 'undefined'
          ? sampleBackgroundColor(await getRenderedPage(pdf, e.pageIndex, renderCache), e)
          : { r: 1, g: 1, b: 1 };
    }

    page.drawRectangle({
      x: e.x - 1,
      y: e.y - 1,
      width: e.width + 2,
      height: e.height + 2,
      color: rgb(cover.r, cover.g, cover.b)
    });
    page.drawText(e.newText, {
      x: e.x,
      y: e.y,
      size: e.fontSize,
      font: fontCache[fontGroupFor(e.fontFamily)],
      color: rgb(0, 0, 0)
    });
  }

  await pdf.destroy();
  return doc.save();
}
