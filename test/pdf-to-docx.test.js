import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { pdfToDocx } from '../src/engines/convert/pdf-to-docx.js';

// Mirrors the shape of the real-world report that motivated this rewrite:
// a heading, a flowing paragraph, a simple grid-like table, and a couple of
// list items using the literal "&bull;" artifact some PDF generators leave
// behind instead of a real bullet glyph.
async function makeMixedContentPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);

  page.drawText('Judul Laporan Uji', { x: 40, y: 460, size: 20 });
  page.drawText('Ini paragraf biasa untuk menguji konversi teks flowing.', { x: 40, y: 420, size: 11 });

  page.drawText('Kolom A', { x: 40, y: 380, size: 11 });
  page.drawText('Kolom B', { x: 220, y: 380, size: 11 });
  page.drawText('Data Satu', { x: 40, y: 365, size: 11 });
  page.drawText('Data Dua', { x: 220, y: 365, size: 11 });
  page.drawText('Data Tiga', { x: 40, y: 350, size: 11 });
  page.drawText('Data Empat', { x: 220, y: 350, size: 11 });

  page.drawText('&bull;Item pertama daftar', { x: 40, y: 310, size: 11 });
  page.drawText('&bull;Item kedua daftar', { x: 40, y: 296, size: 11 });

  return doc.save();
}

async function documentXmlOf(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

describe('pdf-to-docx engine', () => {
  it('renders a grid-like block as a real Word table', async () => {
    const pdf = await makeMixedContentPdf();
    const xml = await documentXmlOf(await pdfToDocx(pdf));

    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('Kolom A');
    expect(xml).toContain('Data Satu');
    expect(xml).toContain('Data Empat');
  });

  it('applies a heading style to the large-font line', async () => {
    const pdf = await makeMixedContentPdf();
    const xml = await documentXmlOf(await pdfToDocx(pdf));

    expect(xml).toContain('Judul Laporan Uji');
    expect(xml).toContain('Heading1');
  });

  it('strips the "&bull;" artifact and renders real bulleted paragraphs', async () => {
    const pdf = await makeMixedContentPdf();
    const xml = await documentXmlOf(await pdfToDocx(pdf));

    expect(xml).not.toContain('&bull;');
    expect(xml).toContain('Item pertama daftar');
    expect(xml).toContain('Item kedua daftar');
    expect(xml).toContain('w:numPr');
  });
});
