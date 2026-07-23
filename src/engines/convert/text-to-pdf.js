import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function wrapLine(text, font, fontSize, maxWidth) {
  const words = text.split(' ');
  const wrapped = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, fontSize) > maxWidth && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

export async function textToPdf(text, { fontSize = 11, margin = 48, pageWidth = 595.28, pageHeight = 841.89 } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lineHeight = fontSize * 1.4;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    const wrapped = raw.length ? wrapLine(raw, font, fontSize, maxWidth) : [''];
    for (const line of wrapped) {
      if (y < margin) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
  }

  return doc.save();
}
