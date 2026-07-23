import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';

// Runs on the MAIN THREAD only (html2canvas needs a live document), unlike every
// other conversion engine which runs inside a worker. Renders the HTML into an
// off-screen container at a fixed pixel width, captures one tall canvas, then
// slices it into page-height chunks — a simple, reliable pagination technique.
export async function htmlToPdf(html, { pageWidthPt = 595.28, pageHeightPt = 841.89, dpi = 96 } = {}) {
  const pxPerPt = dpi / 72;
  const pageWidthPx = Math.round(pageWidthPt * pxPerPt);
  const pageHeightPx = Math.round(pageHeightPt * pxPerPt);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${pageWidthPx}px`;
  container.innerHTML = html;
  document.body.appendChild(container);

  let canvas;
  try {
    canvas = await html2canvas(container, { width: pageWidthPx, windowWidth: pageWidthPx, scale: 1, useCORS: false });
  } finally {
    document.body.removeChild(container);
  }

  const doc = await PDFDocument.create();
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let i = 0; i < totalPages; i += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - i * pageHeightPx);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const ctx = sliceCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, i * pageHeightPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.9);
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const img = await doc.embedJpg(bytes);

    const page = doc.addPage([pageWidthPt, pageHeightPt]);
    const drawHeight = (sliceHeight / pageWidthPx) * pageWidthPt;
    page.drawImage(img, { x: 0, y: pageHeightPt - drawHeight, width: pageWidthPt, height: drawHeight });
  }

  return doc.save();
}
