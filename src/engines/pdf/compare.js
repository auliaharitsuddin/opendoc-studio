import * as pdfjsLib from 'pdfjs-dist';
import { diffWords } from 'diff';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function renderPage(pdf, pageNum, scale) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { ctx, width: canvas.width, height: canvas.height };
}

async function pageText(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items.map((i) => i.str).join(' ');
}

// Pixel-level diff: pixels that differ beyond a small tolerance turn red;
// content only present in A (shorter page in B) turns blue, only in B turns
// green. This is a visual "what changed" tool, not a semantic PDF diff.
async function diffPageImages(pdfA, pdfB, pageNum, scale) {
  const ra = await renderPage(pdfA, pageNum, scale);
  const rb = await renderPage(pdfB, pageNum, scale);
  const w = Math.max(ra.width, rb.width);
  const h = Math.max(ra.height, rb.height);
  const imgA = ra.ctx.getImageData(0, 0, ra.width, ra.height);
  const imgB = rb.ctx.getImageData(0, 0, rb.width, rb.height);

  const outCanvas = new OffscreenCanvas(w, h);
  const outCtx = outCanvas.getContext('2d');
  const out = outCtx.createImageData(w, h);
  let diffCount = 0;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      const inA = x < ra.width && y < ra.height;
      const inB = x < rb.width && y < rb.height;
      let r = 255;
      let g = 255;
      let b = 255;
      if (inA && inB) {
        const idxA = (y * ra.width + x) * 4;
        const idxB = (y * rb.width + x) * 4;
        const delta =
          Math.abs(imgA.data[idxA] - imgB.data[idxB]) +
          Math.abs(imgA.data[idxA + 1] - imgB.data[idxB + 1]) +
          Math.abs(imgA.data[idxA + 2] - imgB.data[idxB + 2]);
        if (delta > 30) {
          r = 255;
          g = 0;
          b = 0;
          diffCount += 1;
        } else {
          r = imgA.data[idxA];
          g = imgA.data[idxA + 1];
          b = imgA.data[idxA + 2];
        }
      } else if (inA) {
        r = 60;
        g = 60;
        b = 255;
        diffCount += 1;
      } else if (inB) {
        r = 0;
        g = 180;
        b = 60;
        diffCount += 1;
      }
      out.data[idx] = r;
      out.data[idx + 1] = g;
      out.data[idx + 2] = b;
      out.data[idx + 3] = 255;
    }
  }
  outCtx.putImageData(out, 0, 0);
  const blob = await outCanvas.convertToBlob({ type: 'image/png' });
  return { dataUrl: await blobToDataUrl(blob), diffPercent: (diffCount / (w * h)) * 100 };
}

export async function comparePdfs(bufA, bufB, { scale = 1.3 } = {}) {
  const pdfA = await pdfjsLib.getDocument({ data: bufA }).promise;
  const pdfB = await pdfjsLib.getDocument({ data: bufB }).promise;
  const pageCount = Math.max(pdfA.numPages, pdfB.numPages);
  const pages = [];

  for (let i = 1; i <= pageCount; i += 1) {
    const hasA = i <= pdfA.numPages;
    const hasB = i <= pdfB.numPages;
    const image = hasA && hasB ? await diffPageImages(pdfA, pdfB, i, scale) : null;
    const textA = hasA ? await pageText(pdfA, i) : '';
    const textB = hasB ? await pageText(pdfB, i) : '';
    const wordDiff = diffWords(textA, textB);
    pages.push({
      pageNum: i,
      hasA,
      hasB,
      diffImageDataUrl: image?.dataUrl ?? null,
      diffPercent: image?.diffPercent ?? (hasA !== hasB ? 100 : 0),
      wordDiff
    });
  }

  await pdfA.destroy();
  await pdfB.destroy();
  return pages;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildCompareReportHtml(pages, { nameA = 'Dokumen A', nameB = 'Dokumen B' } = {}) {
  const sections = pages
    .map((p) => {
      const wordDiffHtml = p.wordDiff
        .map((part) => {
          const cls = part.added ? 'add' : part.removed ? 'del' : 'same';
          return `<span class="${cls}">${escapeHtml(part.value)}</span>`;
        })
        .join('');
      const img = p.diffImageDataUrl
        ? `<img src="${p.diffImageDataUrl}" alt="Diff halaman ${p.pageNum}" />`
        : `<p class="missing">${!p.hasA ? nameA : nameB} tidak memiliki halaman ini.</p>`;
      return `<section class="page">
        <h2>Halaman ${p.pageNum} — ${p.diffPercent.toFixed(1)}% berbeda</h2>
        <div class="visual">${img}</div>
        <div class="text-diff">${wordDiffHtml}</div>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Perbandingan: ${escapeHtml(nameA)} vs ${escapeHtml(nameB)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; color: #1a1a1a; }
  h1 { font-size: 1.4rem; }
  .page { margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 1px solid #ddd; }
  .visual img { max-width: 100%; border: 1px solid #ccc; }
  .legend span { display: inline-block; padding: 2px 8px; border-radius: 4px; margin-right: 8px; font-size: 0.85rem; }
  .text-diff { margin-top: 1rem; line-height: 1.7; background: #fafafa; padding: 12px; border-radius: 8px; }
  .add { background: #d1fae5; color: #065f46; }
  .del { background: #fee2e2; color: #991b1b; text-decoration: line-through; }
  .missing { color: #b91c1c; }
</style>
</head>
<body>
<h1>Perbandingan Dokumen</h1>
<p><strong>A:</strong> ${escapeHtml(nameA)} &nbsp; <strong>B:</strong> ${escapeHtml(nameB)}</p>
<p class="legend">
  <span style="background:#fee2e2">Piksel berbeda = merah</span>
  <span style="background:#dbeafe">Hanya ada di A = biru</span>
  <span style="background:#d1fae5">Hanya ada di B = hijau</span>
</p>
${sections}
</body>
</html>`;
}
