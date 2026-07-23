import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  mergePdfs,
  extractPages,
  deletePages,
  rotatePages,
  splitPdf,
  getPageCount
} from '../src/engines/pdf/organize.js';

async function makePdf(pageCount) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) doc.addPage([200, 300]);
  return doc.save();
}

describe('pdf organize engine', () => {
  it('reports the correct page count', async () => {
    const pdf = await makePdf(4);
    expect(await getPageCount(pdf)).toBe(4);
  });

  it('merges two PDFs into one with combined page count', async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const merged = await mergePdfs([a, b]);
    expect(await getPageCount(merged)).toBe(5);
  });

  it('extracts only the requested pages', async () => {
    const pdf = await makePdf(5);
    const extracted = await extractPages(pdf, [0, 2, 4]);
    expect(await getPageCount(extracted)).toBe(3);
  });

  it('deletes the requested pages', async () => {
    const pdf = await makePdf(5);
    const result = await deletePages(pdf, [1, 3]);
    expect(await getPageCount(result)).toBe(3);
  });

  it('rotates pages without changing page count', async () => {
    const pdf = await makePdf(2);
    const rotated = await rotatePages(pdf, [0], 90);
    const doc = await PDFDocument.load(rotated);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it('splits a PDF into the requested page ranges', async () => {
    const pdf = await makePdf(6);
    const parts = await splitPdf(pdf, [
      [0, 1],
      [2, 5]
    ]);
    expect(parts).toHaveLength(2);
    expect(await getPageCount(parts[0])).toBe(2);
    expect(await getPageCount(parts[1])).toBe(4);
  });
});
