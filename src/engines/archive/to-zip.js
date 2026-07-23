import { Archive } from 'libarchive.js';
import JSZip from 'jszip';

let initialized = false;
function ensureInit() {
  if (initialized) return;
  // The worker-bundle + wasm binary are copied verbatim into public/ (see
  // vite.config.js publicDir behavior) so they ship as extension-root files
  // alongside app.html, resolvable with a plain relative path.
  Archive.init({ workerUrl: chrome.runtime.getURL('worker-bundle.js') });
  initialized = true;
}

async function collectFiles(node, basePath, out) {
  for (const [name, entry] of Object.entries(node)) {
    const path = basePath ? `${basePath}/${name}` : name;
    if (entry instanceof File) {
      out.push({ path, file: entry });
    } else {
      await collectFiles(entry, path, out);
    }
  }
}

// Extracts RAR/7z/TAR/GZIP/BZIP2/ISO/… (anything libarchive supports) and
// repacks every entry into a single, standard .zip — runs on the MAIN THREAD
// because libarchive.js manages its own dedicated Web Worker internally.
export async function archiveToZip(file, { onProgress } = {}) {
  ensureInit();
  const archive = await Archive.open(file);
  const tree = await archive.extractFiles((entry) => onProgress?.(entry.path));
  const flat = [];
  await collectFiles(tree, '', flat);

  const zip = new JSZip();
  for (const { path, file: entryFile } of flat) {
    zip.file(path, entryFile);
  }
  return zip.generateAsync({ type: 'blob' });
}
