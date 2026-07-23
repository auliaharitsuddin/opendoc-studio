import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// items: [{ pageIndex, x, y, width, height, kind: 'text' | 'image', value, fontSize, color }]
// 'text'/'image' placements represent typed/drawn signatures, initials, and
// checkmarks — the same overlay technique Acrobat's own "Fill & Sign" uses for
// documents that don't have real AcroForm fields.
export async function applyFillSign(buf, items) {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const item of items) {
    const page = pages[item.pageIndex];
    if (item.kind === 'image') {
      const isPng = item.value[0] === 0x89;
      const img = isPng ? await doc.embedPng(item.value) : await doc.embedJpg(item.value);
      page.drawImage(img, { x: item.x, y: item.y, width: item.width, height: item.height });
    } else {
      const color = item.color ?? { r: 0, g: 0, b: 0.6 };
      page.drawText(item.value, {
        x: item.x,
        y: item.y,
        size: item.fontSize ?? 14,
        font,
        color: rgb(color.r, color.g, color.b)
      });
    }
  }

  return doc.save();
}
