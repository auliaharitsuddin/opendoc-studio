import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Runs on the MAIN THREAD (tool-registry.js calls this directly, not through
// engine.worker.js): DOMParser is not available inside a Chromium Web
// Worker, confirmed by a real "DOMParser is not defined" failure when this
// was routed through the worker.
const EMU_PER_POINT = 12700;

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function slideTextRuns(slideXml) {
  const doc = parseXml(slideXml);
  const nodes = [...doc.getElementsByTagNameNS('*', 't')];
  return nodes.map((n) => n.textContent).filter(Boolean);
}

async function slideImages(zip, slideName) {
  const relsPath = `ppt/slides/_rels/${slideName}.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return [];
  const relsXml = parseXml(await relsFile.async('text'));
  const rels = [...relsXml.getElementsByTagName('Relationship')].filter((r) =>
    (r.getAttribute('Type') || '').includes('/image')
  );
  const images = [];
  for (const rel of rels) {
    const target = rel.getAttribute('Target').replace('../', 'ppt/');
    const file = zip.file(target);
    if (file) images.push(await file.async('uint8array'));
  }
  return images;
}

// Best-effort structural reconstruction: PPTX is a zip of DrawingML XML, so this
// extracts each slide's text runs (in document order) and embedded images and
// lays them out on one PDF page per slide. Original shape positions, animations,
// and SmartArt/charts are NOT reproduced — documented limitation (see ROADMAP.md).
export async function pptxToPdf(pptxArrayBuffer, { pageWidthPt = 720, pageHeightPt = 540 } = {}) {
  const zip = await JSZip.loadAsync(pptxArrayBuffer);

  const presentationXml = await zip.file('ppt/presentation.xml')?.async('text');
  let pw = pageWidthPt;
  let ph = pageHeightPt;
  if (presentationXml) {
    const doc = parseXml(presentationXml);
    const sldSz = doc.getElementsByTagName('p:sldSz')[0];
    if (sldSz) {
      pw = Number(sldSz.getAttribute('cx')) / EMU_PER_POINT;
      ph = Number(sldSz.getAttribute('cy')) / EMU_PER_POINT;
    }
  }

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const margin = 32;

  for (const path of slideNames) {
    const slideXml = await zip.file(path).async('text');
    const baseName = path.split('/').pop().replace('.xml', '');
    const texts = slideTextRuns(slideXml);
    const images = await slideImages(zip, baseName);

    const page = out.addPage([pw, ph]);
    let y = ph - margin;

    for (const bytes of images) {
      try {
        const isPng = bytes[0] === 0x89;
        const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const maxW = pw - margin * 2;
        const maxH = ph * 0.5;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: y - h, width: w, height: h });
        y -= h + 12;
      } catch {
        // unsupported image format in this slide — skip it, keep the text
      }
    }

    for (const text of texts) {
      if (y < margin) break;
      const fontSize = 14;
      const maxWidth = pw - margin * 2;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const attempt = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(attempt, fontSize) > maxWidth && line) {
          page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= fontSize * 1.4;
          line = word;
        } else {
          line = attempt;
        }
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= fontSize * 1.4;
      }
      y -= 6;
    }
  }

  return out.save();
}
