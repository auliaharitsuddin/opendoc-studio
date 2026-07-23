import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';

// Heuristic accessibility CHECKER — deliberately not an auto-tagger. Building
// a real /StructTreeRoot (tagged PDF) requires reconstructing reading order
// and semantic roles for every content run, which is a much larger effort
// than a first pass can responsibly claim to do correctly; see ROADMAP.md.
// This inspects what's mechanically verifiable: metadata, language tag,
// presence of a structure tree, and font embedding.
export async function checkAccessibility(buf) {
  const doc = await PDFDocument.load(buf);
  const title = doc.getTitle() ?? '';
  const lang = doc.catalog.get(PDFName.of('Lang'))?.toString().replace(/[()]/g, '') ?? '';
  const isTagged = doc.catalog.has(PDFName.of('StructTreeRoot'));
  const pageCount = doc.getPageCount();

  let imageCount = 0;
  let fontsTotal = 0;
  let fontsEmbedded = 0;
  const fontNames = new Set();

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (subtype?.toString() === '/Image') imageCount += 1;
    }
    if (obj instanceof PDFDict) {
      const type = obj.get(PDFName.of('Type'));
      if (type?.toString() === '/Font') {
        const baseFont = obj.get(PDFName.of('BaseFont'))?.toString() ?? `Font${fontsTotal}`;
        if (fontNames.has(baseFont)) continue;
        fontNames.add(baseFont);
        fontsTotal += 1;
        const descriptor = obj.get(PDFName.of('FontDescriptor'));
        const descDict = descriptor ? doc.context.lookupMaybe(descriptor, PDFDict) : undefined;
        const embedded =
          !!descDict &&
          (descDict.has(PDFName.of('FontFile')) ||
            descDict.has(PDFName.of('FontFile2')) ||
            descDict.has(PDFName.of('FontFile3')));
        if (embedded) fontsEmbedded += 1;
      }
    }
  }

  const issues = [];
  if (!title.trim()) {
    issues.push({
      severity: 'error',
      message: 'Dokumen tidak memiliki judul (Title) pada metadata — pembaca layar mengumumkan nama file, bukan judul yang bermakna.'
    });
  }
  if (!lang) {
    issues.push({
      severity: 'error',
      message: 'Bahasa dokumen (/Lang) tidak diset — pembaca layar tidak tahu aturan pelafalan/tata bahasa yang harus dipakai.'
    });
  }
  if (!isTagged) {
    issues.push({
      severity: 'error',
      message: 'Dokumen tidak memiliki struktur tag (Tagged PDF) — pembaca layar tidak dapat menentukan urutan baca atau membedakan judul/paragraf/tabel/gambar.'
    });
  }
  if (imageCount > 0 && !isTagged) {
    issues.push({
      severity: 'warning',
      message: `Ditemukan ${imageCount} gambar. Tanpa struktur tag, gambar tidak bisa memiliki teks alternatif (alt text) yang valid.`
    });
  }
  if (fontsTotal > 0 && fontsEmbedded < fontsTotal) {
    issues.push({
      severity: 'warning',
      message: `${fontsTotal - fontsEmbedded} dari ${fontsTotal} font tidak disematkan (embedded) — tampilan teks bisa berubah di perangkat pembaca.`
    });
  }

  return {
    title,
    hasTitle: !!title.trim(),
    lang,
    hasLang: !!lang,
    isTagged,
    pageCount,
    imageCount,
    fontsTotal,
    fontsEmbedded,
    issues,
    score: Math.max(0, 100 - issues.filter((i) => i.severity === 'error').length * 25 - issues.filter((i) => i.severity === 'warning').length * 10)
  };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildAccessibilityReportHtml(report, { fileName = 'dokumen.pdf' } = {}) {
  const issueRows = report.issues
    .map(
      (i) =>
        `<li class="${i.severity}"><strong>${i.severity === 'error' ? 'Masalah' : 'Peringatan'}:</strong> ${escapeHtml(i.message)}</li>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Laporan Aksesibilitas — ${escapeHtml(fileName)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 2rem auto; color: #1a1a1a; }
  .score { font-size: 2.2rem; font-weight: 700; }
  .meta { color: #555; margin-bottom: 1.5rem; }
  ul { padding-left: 1.2rem; line-height: 1.8; }
  li.error { color: #991b1b; }
  li.warning { color: #92400e; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  td, th { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>Laporan Aksesibilitas</h1>
<p class="meta">${escapeHtml(fileName)}</p>
<div class="score">${report.score}/100</div>
<table>
  <tr><th>Judul dokumen</th><td>${report.hasTitle ? escapeHtml(report.title) : '(tidak ada)'}</td></tr>
  <tr><th>Bahasa</th><td>${report.hasLang ? escapeHtml(report.lang) : '(tidak diset)'}</td></tr>
  <tr><th>Tagged PDF</th><td>${report.isTagged ? 'Ya' : 'Tidak'}</td></tr>
  <tr><th>Jumlah halaman</th><td>${report.pageCount}</td></tr>
  <tr><th>Jumlah gambar</th><td>${report.imageCount}</td></tr>
  <tr><th>Font disematkan</th><td>${report.fontsEmbedded} / ${report.fontsTotal}</td></tr>
</table>
<h2>Temuan</h2>
${report.issues.length ? `<ul>${issueRows}</ul>` : '<p>Tidak ada masalah yang terdeteksi oleh pemeriksa heuristik ini.</p>'}
<p style="color:#888;font-size:0.85rem;margin-top:2rem;">Ini adalah pemeriksa heuristik, bukan validator PDF/UA penuh. Lihat ROADMAP.md untuk rencana auto-tagging.</p>
</body>
</html>`;
}
