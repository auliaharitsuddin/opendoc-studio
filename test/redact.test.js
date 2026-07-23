import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { findPatternMatches, listRedactionPatterns, applyRedaction, findTextMatches } from '../src/engines/pdf/redact.js';

async function makePdfWithText(lines) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  let y = 250;
  for (const text of lines) {
    page.drawText(text, { x: 40, y, size: 12 });
    y -= 30;
  }
  return doc.save();
}

describe('redact engine — pattern-based sensitive-data detection', () => {
  it('lists the built-in pattern keys with labels', () => {
    const patterns = listRedactionPatterns();
    const keys = patterns.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['email', 'phone', 'nik', 'creditcard']));
    expect(patterns.every((p) => typeof p.label === 'string' && p.label.length > 0)).toBe(true);
  });

  it('finds an email address match', async () => {
    const pdf = await makePdfWithText(['Hubungi kami di test.user@example.com untuk info.']);
    const matches = await findPatternMatches(pdf, ['email']);
    expect(matches).toHaveLength(1);
    expect(matches[0].pageIndex).toBe(0);
    expect(matches[0].width).toBeGreaterThan(0);
  });

  it('finds an Indonesian phone number match', async () => {
    const pdf = await makePdfWithText(['Nomor WA: 081234567890 siap dihubungi.']);
    const matches = await findPatternMatches(pdf, ['phone']);
    expect(matches).toHaveLength(1);
  });

  it('finds a 16-digit NIK match', async () => {
    const pdf = await makePdfWithText(['NIK: 3201012345678901']);
    const matches = await findPatternMatches(pdf, ['nik']);
    expect(matches).toHaveLength(1);
  });

  it('finds a credit-card-shaped number match', async () => {
    const pdf = await makePdfWithText(['Kartu: 4111 1111 1111 1111']);
    const matches = await findPatternMatches(pdf, ['creditcard']);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('only searches the selected pattern keys, not every built-in pattern', async () => {
    const pdf = await makePdfWithText(['Email test.user@example.com dan telp 081234567890.']);
    const emailOnly = await findPatternMatches(pdf, ['email']);
    expect(emailOnly).toHaveLength(1);
    const none = await findPatternMatches(pdf, []);
    expect(none).toHaveLength(0);
  });

  it('combines keyword and pattern matches and redacts (unflattened) without throwing', async () => {
    const pdf = await makePdfWithText(['Rahasia: test.user@example.com', 'Kata sandi diblokir di sini.']);
    const keywordMatches = await findTextMatches(pdf, 'Rahasia');
    const patternMatches = await findPatternMatches(pdf, ['email']);
    const result = await applyRedaction(pdf, [...keywordMatches, ...patternMatches], { flatten: false });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
