import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip'
};

function mimeFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

// Builds a single PDF that bundles multiple files as attachments plus a
// cover/index page, and marks the catalog's /Collection dictionary so
// Acrobat/Reader present it as a navigable "PDF Portfolio" rather than a
// plain PDF with hidden attachments.
export async function buildPortfolio(files, { title = 'Portofolio' } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  page.drawText(title, { x: margin, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 32;
  page.drawText('Berkas yang dilampirkan dalam dokumen ini:', { x: margin, y, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 24;

  for (const file of files) {
    if (y < margin) break;
    const sizeKb = (file.bytes.byteLength / 1024).toFixed(1);
    page.drawText(`•  ${file.name}`, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
    page.drawText(`${sizeKb} KB`, { x: width - margin - 60, y, size: 10, font, color: rgb(0.5, 0.5, 0.5) });
    y -= 20;

    await doc.attach(file.bytes, file.name, {
      mimeType: mimeFor(file.name),
      description: file.name,
      creationDate: new Date(),
      modificationDate: new Date()
    });
  }

  // /Collection marks this as a PDF Portfolio (ISO 32000-1 §12.3.5). /View /D
  // asks the viewer to show attachment details by default.
  const collection = doc.context.obj({ Type: 'Collection', View: 'D' });
  doc.catalog.set(PDFName.of('Collection'), doc.context.register(collection));

  return doc.save();
}
