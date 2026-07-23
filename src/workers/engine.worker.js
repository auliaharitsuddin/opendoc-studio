import '../core/pdfjs-setup.js';

// Single generic worker shared by every engine that doesn't need direct DOM
// access (html2canvas-based conversions, libarchive.js, and tesseract.js run on
// the main thread instead — see their own engine files for why). Keeping one
// worker file avoids ~20 near-identical worker boilerplate files; each engine
// module is still its own small, focused, independently testable file.
const modules = {
  'pdf/organize': () => import('../engines/pdf/organize.js'),
  'pdf/watermark': () => import('../engines/pdf/watermark.js'),
  'pdf/page-numbers': () => import('../engines/pdf/page-numbers.js'),
  'pdf/metadata': () => import('../engines/pdf/metadata.js'),
  'pdf/compress': () => import('../engines/pdf/compress.js'),
  'pdf/protect': () => import('../engines/pdf/protect.js'),
  'pdf/redact': () => import('../engines/pdf/redact.js'),
  'pdf/sanitize': () => import('../engines/pdf/sanitize.js'),
  'pdf/fill-sign': () => import('../engines/pdf/fill-sign.js'),
  'pdf/annotations': () => import('../engines/pdf/annotations.js'),
  'pdf/compare': () => import('../engines/pdf/compare.js'),
  'pdf/portfolio': () => import('../engines/pdf/portfolio.js'),
  'pdf/accessibility': () => import('../engines/pdf/accessibility.js'),
  'pdf/forms': () => import('../engines/pdf/forms.js'),
  'pdf/measure': () => import('../engines/pdf/measure.js'),
  'convert/pdf-to-image': () => import('../engines/convert/pdf-to-image.js'),
  'convert/image-to-pdf': () => import('../engines/convert/image-to-pdf.js'),
  'convert/pdf-to-text': () => import('../engines/convert/pdf-to-text.js'),
  'convert/text-to-pdf': () => import('../engines/convert/text-to-pdf.js'),
  'convert/pdf-to-html': () => import('../engines/convert/pdf-to-html.js'),
  'convert/pdf-to-docx': () => import('../engines/convert/pdf-to-docx.js'),
  'convert/pdf-to-pptx': () => import('../engines/convert/pdf-to-pptx.js'),
  'convert/pdf-to-xlsx': () => import('../engines/convert/pdf-to-xlsx.js'),
  'convert/xlsx-to-pdf': () => import('../engines/convert/xlsx-to-pdf.js'),
  'convert/pdf-to-pdfa': () => import('../engines/convert/pdf-to-pdfa.js'),
  'convert/xlsx-csv': () => import('../engines/convert/xlsx-csv.js'),
  'excel-sav/xlsx-to-sav': () => import('../engines/excel-sav/xlsx-to-sav.js'),
  'excel-sav/sav-to-xlsx': () => import('../engines/excel-sav/sav-to-xlsx.js')
};

const loadedModules = new Map();

async function resolveFn(moduleKey, fnName) {
  let mod = loadedModules.get(moduleKey);
  if (!mod) {
    const loader = modules[moduleKey];
    if (!loader) throw new Error(`Modul tidak dikenal: ${moduleKey}`);
    mod = await loader();
    loadedModules.set(moduleKey, mod);
  }
  const fn = mod[fnName];
  if (typeof fn !== 'function') throw new Error(`Fungsi tidak dikenal: ${fnName} pada ${moduleKey}`);
  return fn;
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    const [moduleKey, fnName] = type.split('#');
    const fn = await resolveFn(moduleKey, fnName);
    const result = await fn(...(payload?.args ?? []));
    self.postMessage({ id, kind: 'done', result });
  } catch (err) {
    console.error('[OpenDoc Studio] engine.worker job failed:', err);
    self.postMessage({ id, kind: 'error', message: err?.message || String(err) });
  }
};
