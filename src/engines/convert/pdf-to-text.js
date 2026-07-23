import * as pdfjsLib from 'pdfjs-dist';

export async function pdfToText(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = [];
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.join(''));
        line = [];
      }
      line.push(item.str);
      if (item.hasEOL) {
        lines.push(line.join(''));
        line = [];
      }
      lastY = y;
    }
    if (line.length) lines.push(line.join(''));
    pages.push(`--- Halaman ${i} ---\n${lines.join('\n')}`);
  }
  await pdf.destroy();
  return pages.join('\n\n');
}
