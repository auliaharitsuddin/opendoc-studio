import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { writeSav } from '../../src/engines/excel-sav/sav-format.js';
import { addFormFields } from '../../src/engines/pdf/forms.js';
import { signPdf, generateSelfSignedCertificate } from '../../src/engines/pdf/digital-sign.js';
import { protectPdf } from '../../src/engines/pdf/protect.js';

// A minimal valid 4x4 red PNG (hand-crafted, avoids needing a canvas lib in Node).
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR4nGP8z8DwHw' +
  '8YGBgAmpsGCyLtiJ4AAAAASUVORK5CYII=';

export async function buildAllFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const f = (name) => path.join(dir, name);

  // --- Multi-page PDF ---
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < 3; i += 1) {
    const p = pdfDoc.addPage([300, 300]);
    p.drawText(`Halaman ${i + 1} teks uji coba`, { x: 40, y: 150, size: 16 });
  }
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(f('doc.pdf'), pdfBytes);

  // --- DOCX ---
  const docxDoc = new Document({ sections: [{ children: [new Paragraph('Paragraf uji word-to-pdf.')] }] });
  fs.writeFileSync(f('doc.docx'), Buffer.from(await Packer.toBuffer(docxDoc)));

  // --- PPTX ---
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText('Slide uji ppt-to-pdf', { x: 1, y: 1, w: 6, h: 1, fontSize: 24 });
  const pptxBuf = await pptx.write({ outputType: 'nodebuffer' });
  fs.writeFileSync(f('doc.pptx'), pptxBuf);

  // --- XLSX ---
  const sheet = XLSX.utils.aoa_to_sheet([['nama', 'usia'], ['Budi', 25], ['Ani', 30]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Data');
  fs.writeFileSync(f('doc.xlsx'), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  // --- CSV ---
  fs.writeFileSync(f('doc.csv'), 'nama,usia\nBudi,25\nAni,30');

  // --- PNG image ---
  fs.writeFileSync(f('doc.png'), Buffer.from(PNG_BASE64, 'base64'));

  // --- HTML ---
  fs.writeFileSync(f('doc.html'), '<html><body><h1>Judul</h1><p>Paragraf uji html-to-pdf.</p></body></html>');

  // --- TXT ---
  fs.writeFileSync(f('doc.txt'), 'Baris pertama.\nBaris kedua yang agak panjang untuk menguji word-wrap otomatis.');

  // --- SAV ---
  const savBytes = writeSav({ columns: [{ name: 'nama' }, { name: 'usia' }], rows: [['Budi', 25], ['Ani', 30]] });
  fs.writeFileSync(f('doc.sav'), savBytes);

  // --- ZIP (input for archive-to-zip) ---
  const zip = new JSZip();
  zip.file('readme.txt', 'isi arsip uji');
  zip.file('folder/data.csv', 'a,b\n1,2');
  fs.writeFileSync(f('doc-archive.zip'), await zip.generateAsync({ type: 'nodebuffer' }));

  // --- Password-protected PDF (for remove-password) ---
  const protectedBytes = await protectPdf(pdfBytes, { userPassword: 'rahasia123' });
  fs.writeFileSync(f('protected.pdf'), protectedBytes);

  // --- PDF with a real form field (for export-form-data) ---
  const withField = await addFormFields(pdfBytes, [
    { type: 'text', name: 'nama', pageIndex: 0, x: 40, y: 100, width: 150, height: 20, defaultValue: 'Contoh' }
  ]);
  fs.writeFileSync(f('with-form.pdf'), withField);

  // --- Signed PDF (for verify-signature) ---
  const { cert, privateKey, certChain } = generateSelfSignedCertificate({ commonName: 'Fixture Signer' });
  const signed = await signPdf(pdfBytes, { cert, privateKey, certChain });
  fs.writeFileSync(f('signed.pdf'), signed);

  // --- PDF with an email address (for pattern-based redaction) ---
  const emailDoc = await PDFDocument.create();
  emailDoc.addPage([300, 300]).drawText('Hubungi kami di uji.pola@contoh.com untuk bantuan.', { x: 20, y: 150, size: 12 });
  fs.writeFileSync(f('email.pdf'), await emailDoc.save());

  return {
    pdf: f('doc.pdf'),
    docx: f('doc.docx'),
    pptx: f('doc.pptx'),
    xlsx: f('doc.xlsx'),
    csv: f('doc.csv'),
    png: f('doc.png'),
    html: f('doc.html'),
    txt: f('doc.txt'),
    sav: f('doc.sav'),
    archive: f('doc-archive.zip'),
    protectedPdf: f('protected.pdf'),
    withFormPdf: f('with-form.pdf'),
    signedPdf: f('signed.pdf'),
    emailPdf: f('email.pdf')
  };
}
