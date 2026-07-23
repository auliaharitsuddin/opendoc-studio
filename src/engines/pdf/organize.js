import { PDFDocument, degrees } from 'pdf-lib';

export async function mergePdfs(fileBuffers) {
  const merged = await PDFDocument.create();
  for (const buf of fileBuffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

export async function extractPages(buf, pageIndices) {
  const src = await PDFDocument.load(buf);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, pageIndices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function deletePages(buf, pageIndicesToDelete) {
  const src = await PDFDocument.load(buf);
  const toDelete = new Set(pageIndicesToDelete);
  const keep = src.getPageIndices().filter((i) => !toDelete.has(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function rotatePages(buf, pageIndices, degreesAmount) {
  const doc = await PDFDocument.load(buf);
  const indices = pageIndices ?? doc.getPageIndices();
  const pages = doc.getPages();
  indices.forEach((i) => {
    const page = pages[i];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + degreesAmount + 360) % 360));
  });
  return doc.save();
}

export async function reorderPages(buf, newOrder) {
  const src = await PDFDocument.load(buf);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, newOrder);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

// ranges: array of [startIndex, endIndexInclusive] (0-based). Returns one Uint8Array per range.
export async function splitPdf(buf, ranges) {
  const src = await PDFDocument.load(buf);
  const outputs = [];
  for (const [start, end] of ranges) {
    const out = await PDFDocument.create();
    const indices = [];
    for (let i = start; i <= end; i += 1) indices.push(i);
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    outputs.push(await out.save());
  }
  return outputs;
}

export async function cropPages(buf, pageIndices, box) {
  const doc = await PDFDocument.load(buf);
  const indices = pageIndices ?? doc.getPageIndices();
  const pages = doc.getPages();
  indices.forEach((i) => {
    pages[i].setCropBox(box.x, box.y, box.width, box.height);
  });
  return doc.save();
}

export async function getPageCount(buf) {
  const doc = await PDFDocument.load(buf);
  return doc.getPageCount();
}
