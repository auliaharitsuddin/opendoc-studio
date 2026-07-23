import { createWorker, PSM } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import '../../core/pdfjs-setup.js';

// Runs on the MAIN THREAD: tesseract.js's createWorker() already manages its
// own dedicated Web Worker + WASM core internally, so nesting it inside our
// own worker would add an extra hop for no benefit.
//
// Every asset (worker script, WASM core, and eng/ind trained data) is bundled
// inside the extension itself (public/tesseract/, public/tessdata/) — OCR
// never reaches out to a CDN, keeping the "no server calls" guarantee intact.
async function makeWorker(language, onProgress) {
  const worker = await createWorker(language, 1, {
    workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
    corePath: chrome.runtime.getURL('tesseract/'),
    langPath: chrome.runtime.getURL('tessdata/'),
    cacheMethod: 'none',
    // tesseract.js defaults to wrapping the worker script in a Blob that does
    // importScripts(workerPath) — a workaround for loading a worker script
    // cross-origin (e.g. from a CDN). Our workerPath is already same-origin
    // (packaged inside the extension), and the Blob indirection actually
    // fails under MV3 with "NetworkError: failed to execute importScripts",
    // so it's disabled here in favor of a plain same-origin `new Worker()`.
    workerBlobURL: false,
    logger: (m) => onProgress?.(m.status, m.progress)
  });
  // Full-page auto segmentation (works for both dense text and mixed layouts)
  // and preserved spacing so extracted text doesn't collapse word gaps —
  // tesseract.js's own defaults leave these unset.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1'
  });
  return worker;
}

async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport };
}

function canvasToPngBlob(canvas) {
  return canvas.convertToBlob({ type: 'image/png' });
}

// Otsu's method: picks the gray-level threshold that minimizes intra-class
// variance between "ink" and "paper" pixels, so it adapts per page instead of
// a fixed guess (which fails on darker/lighter/unevenly-lit scans).
function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * histogram[t];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t += 1) {
    weightB += histogram[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

// Binarizes a rendered page in place (grayscale + Otsu threshold) — the
// standard scan-cleanup step that meaningfully improves Tesseract accuracy on
// real-world scans (uneven lighting, gray backgrounds, low contrast). Mutates
// `canvas`, so callers that also need the pristine visual image must read it
// out (e.g. to a blob) *before* calling this.
function preprocessForOcr(canvas) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const pixelCount = width * height;
  const gray = new Uint8ClampedArray(pixelCount);
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * 4;
    const g = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
    gray[i] = g;
    histogram[g] += 1;
  }

  const threshold = otsuThreshold(histogram, pixelCount);

  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * 4;
    const v = gray[i] >= threshold ? 255 : 0;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

// Extracts plain text from a scanned PDF (or image) via OCR.
// scale=3 renders at roughly the ~300 DPI-equivalent Tesseract is tuned for
// (2 undershoots it, hurting small-font accuracy).
export async function ocrToText(buf, { language = 'eng', scale = 3, onProgress } = {}) {
  const worker = await makeWorker(language, onProgress);
  try {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const { canvas } = await renderPageToCanvas(page, scale);
      preprocessForOcr(canvas);
      const ocrBlob = await canvasToPngBlob(canvas);
      const { data } = await worker.recognize(ocrBlob);
      pages.push(`--- Halaman ${i} ---\n${data.text}`);
    }
    await pdf.destroy();
    return pages.join('\n\n');
  } finally {
    await worker.terminate();
  }
}

// Produces a searchable PDF: the original page rendered as an image, with an
// invisible (opacity 0) text layer placed at each recognized word's exact
// bounding box — the standard "OCR layer" technique, so viewers can select
// and search the text while the visual appearance is unchanged. Recognition
// runs against a binarized copy of the page; the embedded visual image is
// read out before that preprocessing so it stays an unmodified scan.
export async function ocrToSearchablePdf(buf, { language = 'eng', scale = 3, onProgress } = {}) {
  const worker = await makeWorker(language, onProgress);
  try {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const out = await PDFDocument.create();
    const font = await out.embedFont('Helvetica');

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const { canvas, viewport } = await renderPageToCanvas(page, scale);

      const visualBlob = await canvasToPngBlob(canvas);
      const imgBytes = new Uint8Array(await visualBlob.arrayBuffer());
      const img = await out.embedPng(imgBytes);

      const pdfPage = out.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });

      preprocessForOcr(canvas);
      const ocrBlob = await canvasToPngBlob(canvas);
      const { data } = await worker.recognize(ocrBlob);
      for (const word of data.words ?? []) {
        if (!word.text.trim()) continue;
        const wordHeight = word.bbox.y1 - word.bbox.y0;
        const fontSize = Math.max(4, wordHeight * 0.85);
        pdfPage.drawText(word.text, {
          x: word.bbox.x0,
          y: viewport.height - word.bbox.y1,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0
        });
      }
    }
    await pdf.destroy();
    return out.save();
  } finally {
    await worker.terminate();
  }
}
