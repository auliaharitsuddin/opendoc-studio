import * as XLSX from 'xlsx';
import { writeSav } from './sav-format.js';

export async function xlsxToSav(xlsxArrayBuffer, { sheetName } = {}) {
  const workbook = XLSX.read(xlsxArrayBuffer, { type: 'array' });
  const name = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  if (grid.length === 0) throw new Error('Sheet kosong, tidak ada data untuk dikonversi.');

  const header = grid[0].map((h, i) => String(h ?? `KOLOM${i + 1}`).trim() || `KOLOM${i + 1}`);
  const rows = grid.slice(1);

  return writeSav({ columns: header.map((name) => ({ name })), rows });
}
