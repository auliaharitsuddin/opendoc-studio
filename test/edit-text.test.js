import { describe, it, expect } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPageTextItems, getAllPagesTextItems, applyTextEdits } from '../src/engines/pdf/edit-text.js';

async function makePdfWithText(text) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawText(text, { x: 40, y: 150, size: 16 });
  return doc.save();
}

describe('edit-text engine', () => {
  it('finds the drawn text run with a sane bounding box', async () => {
    const pdf = await makePdfWithText('Halo Dunia');
    const { items, pageWidth, pageHeight } = await getPageTextItems(pdf, 0);

    expect(pageWidth).toBe(300);
    expect(pageHeight).toBe(300);
    expect(items).toHaveLength(1);
    expect(items[0].str).toBe('Halo Dunia');
    expect(items[0].x).toBeCloseTo(40, 0);
    expect(items[0].width).toBeGreaterThan(0);
    expect(items[0].fontSize).toBeGreaterThan(0);
  });

  it('replaces the run by covering it and drawing the new text, without changing page count', async () => {
    const pdf = await makePdfWithText('Halo Dunia');
    const { items } = await getPageTextItems(pdf, 0);
    const result = await applyTextEdits(pdf, [
      { pageIndex: 0, x: items[0].x, y: items[0].y, width: items[0].width, height: items[0].height, fontSize: items[0].fontSize, newText: 'Sudah Diedit' }
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);

    const { items: afterItems } = await getPageTextItems(result, 0);
    expect(afterItems.some((i) => i.str.includes('Sudah Diedit'))).toBe(true);
  });

  it('getAllPagesTextItems finds text across every page in one pass', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]).drawText('Halaman satu', { x: 40, y: 150, size: 16 });
    doc.addPage([300, 300]).drawText('Halaman dua', { x: 40, y: 150, size: 16 });
    const pdf = await doc.save();

    const pages = await getAllPagesTextItems(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].items[0].str).toBe('Halaman satu');
    expect(pages[1].pageIndex).toBe(1);
    expect(pages[1].items[0].str).toBe('Halaman dua');
  });

  it('applies an edit on a non-white page without throwing (background-sample fallback)', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawRectangle({ x: 0, y: 0, width: 300, height: 300, color: rgb(0.85, 0.9, 1) });
    page.drawText('Teks di atas latar biru', { x: 40, y: 150, size: 16 });
    const pdf = await doc.save();

    const { items } = await getPageTextItems(pdf, 0);
    const result = await applyTextEdits(pdf, [
      {
        pageIndex: 0,
        x: items[0].x,
        y: items[0].y,
        width: items[0].width,
        height: items[0].height,
        fontSize: items[0].fontSize,
        fontFamily: items[0].fontFamily,
        newText: 'Diganti'
      }
    ]);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
