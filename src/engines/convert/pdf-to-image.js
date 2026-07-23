import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// format: 'png' | 'jpeg'. Returns a single image Blob if the PDF has one page,
// otherwise a .zip Blob containing one image per page.
export async function pdfToImages(buf, { format = 'png', scale = 2, quality = 0.92 } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvas.convertToBlob({ type: mime, quality });
    pages.push({ index: i, blob, ext });
  }
  await pdf.destroy();

  if (pages.length === 1) {
    return { blob: pages[0].blob, ext, multi: false };
  }

  const zip = new JSZip();
  for (const p of pages) {
    zip.file(`page-${String(p.index).padStart(3, '0')}.${p.ext}`, p.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { blob: zipBlob, ext: 'zip', multi: true };
}
