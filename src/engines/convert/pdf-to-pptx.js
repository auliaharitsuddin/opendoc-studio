import * as pdfjsLib from 'pdfjs-dist';
import PptxGenJS from 'pptxgenjs';

// Renders each PDF page to a raster image and places one per slide — an
// image-based conversion (not editable text boxes). This is the same approach
// most free PDF-to-PowerPoint tools use, since faithfully reconstructing
// editable shapes/text-boxes from arbitrary PDF layouts isn't reliably possible.
export async function pdfToPptx(buf, { scale = 2 } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PDF_LAYOUT', width: 10, height: 7.5 });
  pptx.layout = 'PDF_LAYOUT';

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const dataUrl = await blobToDataUrl(blob);

    const slide = pptx.addSlide();
    const aspectRatio = viewport.width / viewport.height;
    const slideAspect = 10 / 7.5;
    let w = 10;
    let h = 7.5;
    if (aspectRatio > slideAspect) {
      h = 10 / aspectRatio;
    } else {
      w = 7.5 * aspectRatio;
    }
    slide.addImage({ data: dataUrl, x: (10 - w) / 2, y: (7.5 - h) / 2, w, h });
  }
  await pdf.destroy();

  return pptx.write({ outputType: 'blob' });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
