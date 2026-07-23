import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  rgb
} from 'pdf-lib';

// fields: [{ type: 'text'|'checkbox'|'radio'|'dropdown', name, pageIndex,
//            x, y, width, height, options?: string[], defaultValue? }]
// Uses pdf-lib's real AcroForm API (not an overlay), so the result is a
// genuinely fillable PDF form readable by any PDF viewer.
export async function addFormFields(buf, fields) {
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();
  const pages = doc.getPages();
  const appearance = { borderWidth: 1, borderColor: rgb(0.4, 0.4, 0.4) };

  for (const f of fields) {
    const page = pages[f.pageIndex];
    const opts = { x: f.x, y: f.y, width: f.width, height: f.height, ...appearance };

    if (f.type === 'text') {
      const field = form.createTextField(f.name);
      if (f.defaultValue) field.setText(f.defaultValue);
      field.addToPage(page, opts);
    } else if (f.type === 'checkbox') {
      const field = form.createCheckBox(f.name);
      field.addToPage(page, opts);
      if (f.defaultValue) field.check();
    } else if (f.type === 'radio') {
      const field = form.createRadioGroup(f.name);
      (f.options ?? []).forEach((option, i) => {
        field.addOptionToPage(option, page, { ...opts, y: f.y - i * (f.height + 6) });
      });
      if (f.defaultValue) field.select(f.defaultValue);
    } else if (f.type === 'dropdown') {
      const field = form.createDropdown(f.name);
      field.setOptions(f.options ?? []);
      field.addToPage(page, opts);
      if (f.defaultValue) field.select(f.defaultValue);
    }
  }

  return doc.save();
}

export async function readFormFieldValues(buf) {
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();
  return form.getFields().map((field) => {
    const name = field.getName();
    if (field instanceof PDFTextField) return { name, type: 'text', value: field.getText() ?? '' };
    if (field instanceof PDFCheckBox) return { name, type: 'checkbox', value: field.isChecked() ? 'Yes' : 'Off' };
    if (field instanceof PDFRadioGroup) return { name, type: 'radio', value: field.getSelected() ?? '' };
    if (field instanceof PDFDropdown) return { name, type: 'dropdown', value: (field.getSelected() ?? []).join(', ') };
    return { name, type: 'unknown', value: '' };
  });
}

export function exportFieldsAsCsv(fields) {
  const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const header = 'name,type,value';
  const rows = fields.map((f) => [escape(f.name), escape(f.type), escape(f.value)].join(','));
  return [header, ...rows].join('\n');
}

export function exportFieldsAsFdf(fields) {
  const escape = (s) => String(s).replace(/[()\\]/g, (c) => `\\${c}`);
  const entries = fields.map((f) => `<< /T (${escape(f.name)}) /V (${escape(f.value)}) >>`).join('\n');
  return `%FDF-1.2\n1 0 obj\n<<\n/FDF\n<<\n/Fields [\n${entries}\n]\n>>\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF`;
}

export function exportFieldsAsXfdf(fields) {
  const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const entries = fields
    .map((f) => `  <field name="${escapeXml(f.name)}"><value>${escapeXml(f.value)}</value></field>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n<fields>\n${entries}\n</fields>\n</xfdf>`;
}
