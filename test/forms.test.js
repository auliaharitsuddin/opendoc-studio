import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addFormFields, readFormFieldValues, exportFieldsAsCsv, exportFieldsAsFdf, exportFieldsAsXfdf } from '../src/engines/pdf/forms.js';

async function makePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([400, 400]);
  return doc.save();
}

describe('forms engine', () => {
  it('creates real AcroForm fields readable back by pdf-lib', async () => {
    const pdf = await makePdf();
    const withFields = await addFormFields(pdf, [
      { type: 'text', name: 'nama', pageIndex: 0, x: 50, y: 300, width: 200, height: 20, defaultValue: 'Budi' },
      { type: 'checkbox', name: 'setuju', pageIndex: 0, x: 50, y: 260, width: 16, height: 16, defaultValue: true },
      { type: 'dropdown', name: 'kota', pageIndex: 0, x: 50, y: 220, width: 150, height: 20, options: ['Jakarta', 'Bandung'], defaultValue: 'Bandung' }
    ]);

    const values = await readFormFieldValues(withFields);
    const byName = Object.fromEntries(values.map((v) => [v.name, v]));
    expect(byName.nama.value).toBe('Budi');
    expect(byName.setuju.value).toBe('Yes');
    expect(byName.kota.value).toBe('Bandung');
  });

  it('exports field values as CSV, FDF, and XFDF', () => {
    const fields = [{ name: 'nama', type: 'text', value: 'Budi "B" Santoso' }];
    expect(exportFieldsAsCsv(fields)).toContain('name,type,value');
    expect(exportFieldsAsCsv(fields)).toContain('Budi ""B"" Santoso');
    expect(exportFieldsAsFdf(fields)).toContain('/T (nama)');
    expect(exportFieldsAsXfdf(fields)).toContain('<field name="nama">');
  });
});
