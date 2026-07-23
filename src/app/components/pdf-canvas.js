import * as pdfjsLib from 'pdfjs-dist';
import '../../core/pdfjs-setup.js';

// Renders one page of a PDF File onto a live <canvas> for click-based tools
// (Measure, Forms designer). Returns a converter from canvas pixel
// coordinates to PDF page-point coordinates (bottom-left origin), since
// that's the space every pdf-lib drawing call expects.
export async function renderPdfPageToCanvas(file, { pageIndex = 0, scale = 1.4 } = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.className = 'pdf-canvas';
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  function canvasToPdfPoint(canvasX, canvasY) {
    return [canvasX / scale, viewport.height / scale - canvasY / scale];
  }

  return { canvas, pageCount: pdf.numPages, pageWidth: viewport.width / scale, pageHeight: viewport.height / scale, canvasToPdfPoint, destroy: () => pdf.destroy() };
}

// Renders every page of a PDF File to its own <canvas> — for read-only
// multi-page previews (e.g. hovering a file in a picker) where the whole
// document needs to be scrollable, not just page 1. Opens the pdf.js
// document once and destroys it immediately after rendering, since callers
// only need the resulting bitmaps, not a live document handle.
export async function renderAllPagesToCanvases(file, { scale = 1 } = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const canvases = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'pdf-canvas';
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();
  return { canvases, pageCount };
}
