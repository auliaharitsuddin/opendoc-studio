import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Draws each sheet as a structured text grid directly (not a rasterized image),
// so the output stays text-selectable/searchable.
export async function xlsxToPdf(xlsxArrayBuffer, { fontSize = 8, pageWidthPt = 841.89, pageHeightPt = 595.28 } = {}) {
  const workbook = XLSX.read(xlsxArrayBuffer, { type: 'array' });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const margin = 24;
  const rowHeight = fontSize * 1.8;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    if (rows.length === 0) continue;

    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidth = Math.max(50, (pageWidthPt - margin * 2) / Math.max(colCount, 1));

    let page = out.addPage([pageWidthPt, pageHeightPt]);
    let y = pageHeightPt - margin;
    page.drawText(sheetName, { x: margin, y, size: fontSize + 2, font, color: rgb(0, 0, 0) });
    y -= rowHeight * 1.5;

    for (const row of rows) {
      if (y < margin) {
        page = out.addPage([pageWidthPt, pageHeightPt]);
        y = pageHeightPt - margin;
      }
      row.forEach((cell, colIdx) => {
        const text = String(cell ?? '').slice(0, 40);
        page.drawText(text, {
          x: margin + colIdx * colWidth,
          y,
          size: fontSize,
          font,
          color: rgb(0.1, 0.1, 0.1)
        });
      });
      y -= rowHeight;
    }
  }

  return out.save();
}
