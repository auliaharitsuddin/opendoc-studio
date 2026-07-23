import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import { buildPortfolio } from '../src/engines/pdf/portfolio.js';

describe('portfolio builder', () => {
  it('embeds attachments and marks the catalog as a Collection', async () => {
    const files = [
      { name: 'catatan.txt', bytes: new TextEncoder().encode('halo dunia') },
      { name: 'data.csv', bytes: new TextEncoder().encode('a,b\n1,2') }
    ];
    const bytes = await buildPortfolio(files, { title: 'Uji Portofolio' });
    const doc = await PDFDocument.load(bytes);

    expect(doc.getPageCount()).toBe(1);
    expect(doc.catalog.has(PDFName.of('Collection'))).toBe(true);

    const names = doc.catalog.get(PDFName.of('Names'));
    expect(names).toBeDefined();
  });
});
