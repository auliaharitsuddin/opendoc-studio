import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { xlsxToCsv, csvToXlsx } from '../src/engines/convert/xlsx-csv.js';

function makeWorkbookArrayBuffer(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

describe('xlsx <-> csv conversion', () => {
  it('converts an xlsx workbook to CSV text', async () => {
    const buf = makeWorkbookArrayBuffer([
      ['nama', 'usia'],
      ['Budi', 25],
      ['Ani', 30]
    ]);
    const csvBytes = await xlsxToCsv(buf);
    const csvText = new TextDecoder().decode(csvBytes);
    expect(csvText).toContain('nama,usia');
    expect(csvText).toContain('Budi,25');
  });

  it('round-trips CSV back into a readable xlsx workbook', async () => {
    const csvText = 'nama,usia\nBudi,25\nAni,30';
    const xlsxBytes = await csvToXlsx(csvText);
    const workbook = XLSX.read(xlsxBytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows[0]).toEqual(['nama', 'usia']);
    expect(rows[1]).toEqual(['Budi', 25]);
  });
});
