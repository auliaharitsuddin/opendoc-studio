import mammoth from 'mammoth';
import { htmlToPdf } from './html-to-pdf.js';

// Runs on the MAIN THREAD (delegates to html-to-pdf.js, which needs html2canvas).
// mammoth converts DOCX -> HTML preserving headings/lists/basic formatting and
// inline images; the HTML is then rasterized/paginated into a PDF.
export async function docxToPdf(docxArrayBuffer) {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: docxArrayBuffer });
  const styled = `<div style="font-family: Calibri, Arial, sans-serif; font-size: 14px; padding: 32px; line-height: 1.5;">${html}</div>`;
  return htmlToPdf(styled);
}
