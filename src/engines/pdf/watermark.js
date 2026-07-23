import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

export async function addTextWatermark(
  buf,
  { text, opacity = 0.3, rotationDeg = 45, fontSize = 48, color = { r: 0.6, g: 0.6, b: 0.6 } }
) {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotationDeg)
    });
  });
  return doc.save();
}

export async function addImageWatermark(buf, imageBuf, { opacity = 0.3, scale = 0.5 } = {}) {
  const doc = await PDFDocument.load(buf);
  const isPng = imageBuf[0] === 0x89;
  const image = isPng ? await doc.embedPng(imageBuf) : await doc.embedJpg(imageBuf);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const dims = image.scale(scale);
    page.drawImage(image, {
      x: width / 2 - dims.width / 2,
      y: height / 2 - dims.height / 2,
      width: dims.width,
      height: dims.height,
      opacity
    });
  });
  return doc.save();
}

export async function addHeaderFooter(
  buf,
  { headerText = '', footerText = '', fontSize = 10, margin = 28 }
) {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    if (headerText) {
      page.drawText(headerText, { x: margin, y: height - margin, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    }
    if (footerText) {
      page.drawText(footerText, { x: margin, y: margin - fontSize, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    }
  });
  return doc.save();
}
