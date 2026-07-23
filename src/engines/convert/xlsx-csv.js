import * as XLSX from 'xlsx';

export async function xlsxToCsv(xlsxArrayBuffer, { sheetName } = {}) {
  const workbook = XLSX.read(xlsxArrayBuffer, { type: 'array' });
  const name = sheetName ?? workbook.SheetNames[0];
  const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
  return new TextEncoder().encode(csv);
}

export async function csvToXlsx(csvText) {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
