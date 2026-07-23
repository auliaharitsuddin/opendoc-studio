import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const POSITIONS = {
  'bottom-center': (w, h, tw) => ({ x: w / 2 - tw / 2, y: 24 }),
  'bottom-right': (w, _h, tw) => ({ x: w - tw - 36, y: 24 }),
  'bottom-left': () => ({ x: 36, y: 24 }),
  'top-center': (w, h, tw) => ({ x: w / 2 - tw / 2, y: h - 36 }),
  'top-right': (w, h, tw) => ({ x: w - tw - 36, y: h - 36 }),
  'top-left': (_w, h) => ({ x: 36, y: h - 36 })
};

export async function addPageNumbers(
  buf,
  { format = 'Halaman {n} dari {total}', position = 'bottom-center', startAt = 1, fontSize = 10 }
) {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((page, idx) => {
    const n = startAt + idx;
    const text = format.replace('{n}', String(n)).replace('{total}', String(total + startAt - 1));
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, fontSize);
    const pos = POSITIONS[position](width, height, tw);
    page.drawText(text, { x: pos.x, y: pos.y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return doc.save();
}

// Bates numbering: a running, zero-padded sequence stamped across one or more
// documents in a single batch — the standard legal-discovery numbering scheme.
export async function addBatesNumbers(
  documents,
  { prefix = '', suffix = '', digits = 6, startAt = 1, position = 'bottom-right', fontSize = 9 }
) {
  let counter = startAt;
  const results = [];
  for (const { name, buf } of documents) {
    const doc = await PDFDocument.load(buf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const page of doc.getPages()) {
      const label = `${prefix}${String(counter).padStart(digits, '0')}${suffix}`;
      const { width } = page.getSize();
      const tw = font.widthOfTextAtSize(label, fontSize);
      const pos = POSITIONS[position](width, page.getSize().height, tw);
      page.drawText(label, { x: pos.x, y: pos.y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
      counter += 1;
    }
    results.push({ name, bytes: await doc.save() });
  }
  return results;
}
