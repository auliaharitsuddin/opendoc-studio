import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { checkAccessibility } from '../src/engines/pdf/accessibility.js';

describe('accessibility checker', () => {
  it('flags a document with no title, no language, and no tags', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 300]);
    const bytes = await doc.save();

    const report = await checkAccessibility(bytes);
    expect(report.hasTitle).toBe(false);
    expect(report.hasLang).toBe(false);
    expect(report.isTagged).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
  });

  it('scores a document with a title higher than one without', async () => {
    const withTitle = await PDFDocument.create();
    withTitle.addPage([300, 300]);
    withTitle.setTitle('Judul yang bermakna');
    const withTitleReport = await checkAccessibility(await withTitle.save());

    const withoutTitle = await PDFDocument.create();
    withoutTitle.addPage([300, 300]);
    const withoutTitleReport = await checkAccessibility(await withoutTitle.save());

    expect(withTitleReport.score).toBeGreaterThan(withoutTitleReport.score);
  });
});
