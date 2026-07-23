import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Table-heuristic extraction: clusters text items into rows by Y-proximity, then
// into columns by X-gap size. Works well for simple, grid-like tables; merged
// cells or multi-column page layouts are not reliably detected (documented
// limitation — this is the same heuristic every non-ML PDF table extractor uses).
export async function pdfToXlsx(buf, { rowTolerance = 3, columnGapThreshold = 12 } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const workbook = XLSX.utils.book_new();

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const rows = [];
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = item.transform[5];
      const x = item.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) <= rowTolerance);
      if (!row) {
        row = { y, cells: [] };
        rows.push(row);
      }
      row.cells.push({ x, text: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    rows.forEach((r) => r.cells.sort((a, b) => a.x - b.x));

    const grid = rows.map((row) => {
      const cells = [];
      let current = null;
      for (const cell of row.cells) {
        if (current && cell.x - current.endX < columnGapThreshold) {
          current.text += cell.text;
        } else {
          if (current) cells.push(current.text);
          current = { text: cell.text, endX: 0 };
        }
        current.endX = cell.x + cell.text.length * 5;
      }
      if (current) cells.push(current.text);
      return cells;
    });

    const sheet = XLSX.utils.aoa_to_sheet(grid);
    const sheetName = `Halaman ${i}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }
  await pdf.destroy();

  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
