import * as pdfjsLib from 'pdfjs-dist';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Produces reflowed HTML (paragraphs grouped by vertical gaps), not a pixel-exact
// clone of the PDF layout — documented as a reading-friendly export, matching
// what most PDF-to-HTML converters actually do for non-trivial layouts.
export async function pdfToHtml(buf, { title = 'Dokumen' } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const sections = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const paragraphs = [];
    let current = [];
    let lastY = null;

    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > (item.height || 10) * 1.5) {
        if (current.length) paragraphs.push(current.join(' '));
        current = [];
      }
      if (item.str.trim()) current.push(item.str);
      lastY = y;
    }
    if (current.length) paragraphs.push(current.join(' '));

    const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
    sections.push(`<section class="pdf-page" data-page="${i}">\n${body}\n</section>`);
  }
  await pdf.destroy();

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 760px; margin: 2rem auto; line-height: 1.6; color: #1a1a1a; }
  .pdf-page { margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid #ddd; }
  p { margin: 0 0 0.8em; }
</style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`;
}
