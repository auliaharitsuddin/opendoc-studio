import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import { addStickyNote, addHighlight, addFreehandInk, applyAnnotations } from '../src/engines/pdf/annotations.js';
import { sanitizePdf } from '../src/engines/pdf/sanitize.js';

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  return doc.save();
}

describe('annotations on a PDF with no existing /Annots dict', () => {
  it('adds a sticky note without throwing', async () => {
    const pdf = await makePdf();
    const result = await addStickyNote(pdf, { pageIndex: 0, x: 10, y: 10, text: 'Catatan' });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('adds a highlight without throwing', async () => {
    const pdf = await makePdf();
    const result = await addHighlight(pdf, { pageIndex: 0, x: 10, y: 10, width: 50, height: 12 });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('adds a freehand ink stroke without throwing', async () => {
    const pdf = await makePdf();
    const result = await addFreehandInk(pdf, {
      pageIndex: 0,
      points: [
        [10, 10],
        [20, 15],
        [30, 10]
      ]
    });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

describe('applyAnnotations (batch)', () => {
  it('applies a mix of sticky/highlight/ink in one pass', async () => {
    const pdf = await makePdf();
    const result = await applyAnnotations(pdf, [
      { type: 'sticky', pageIndex: 0, x: 10, y: 10, text: 'Catatan' },
      { type: 'highlight', pageIndex: 0, x: 10, y: 40, width: 50, height: 12 },
      {
        type: 'ink',
        pageIndex: 0,
        points: [
          [10, 80],
          [20, 90],
          [30, 80]
        ]
      }
    ]);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
    const annots = reloaded.getPages()[0].node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    expect(annots?.size()).toBe(3);
  });
});

describe('sanitize on a PDF with no /Names dict at all', () => {
  it('strips metadata without throwing', async () => {
    const pdf = await makePdf();
    const result = await sanitizePdf(pdf, {});
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getTitle() ?? '').toBe('');
  });
});
