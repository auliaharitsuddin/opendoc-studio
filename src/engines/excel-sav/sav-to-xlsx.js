import * as XLSX from 'xlsx';
import { readSav } from './sav-format.js';

export async function savToXlsx(savBytes) {
  const { columns, rows } = readSav(savBytes);
  const grid = [columns.map((c) => c.name), ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
