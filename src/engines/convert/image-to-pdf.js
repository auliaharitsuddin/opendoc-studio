import { PDFDocument } from 'pdf-lib';

// images: array of Uint8Array (jpg/png bytes), one PDF page per image, image
// scaled to fit an A4-proportioned page while preserving aspect ratio.
export async function imagesToPdf(images, { pageWidth = 595.28, pageHeight = 841.89, margin = 24 } = {}) {
  const doc = await PDFDocument.create();
  for (const bytes of images) {
    const isPng = bytes[0] === 0x89;
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawImage(img, {
      x: (pageWidth - w) / 2,
      y: (pageHeight - h) / 2,
      width: w,
      height: h
    });
  }
  return doc.save();
}
