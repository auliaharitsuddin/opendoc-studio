import { PDFDocument, PDFName, PDFArray, PDFString } from 'pdf-lib';

function annotsArrayFor(page, ctx) {
  const existing = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existing) return existing;
  const created = ctx.obj([]);
  page.node.set(PDFName.of('Annots'), created);
  return created;
}

function pushAnnot(page, ctx, dict) {
  const ref = ctx.register(ctx.obj(dict));
  annotsArrayFor(page, ctx).push(ref);
}

function stickyDict({ x, y, text, author = '' }) {
  return {
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [x, y, x + 24, y + 24],
    Contents: PDFString.of(text),
    T: PDFString.of(author),
    Open: false,
    Name: 'Comment'
  };
}

function highlightDict({ x, y, width, height, color = { r: 1, g: 1, b: 0 } }) {
  const quadPoints = [x, y + height, x + width, y + height, x, y, x + width, y];
  return {
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: [x, y, x + width, y + height],
    QuadPoints: quadPoints,
    C: [color.r, color.g, color.b]
  };
}

function inkDict({ points, color = { r: 1, g: 0, b: 0 }, width = 2 }) {
  const flat = points.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    Type: 'Annot',
    Subtype: 'Ink',
    Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    InkList: [flat],
    C: [color.r, color.g, color.b],
    BS: { W: width }
  };
}

export async function addStickyNote(buf, { pageIndex, x, y, text, author = '' }) {
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[pageIndex];
  pushAnnot(page, doc.context, stickyDict({ x, y, text, author }));
  return doc.save();
}

export async function addHighlight(buf, { pageIndex, x, y, width, height, color }) {
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[pageIndex];
  pushAnnot(page, doc.context, highlightDict({ x, y, width, height, color }));
  return doc.save();
}

export async function addFreehandInk(buf, { pageIndex, points, color, width }) {
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[pageIndex];
  pushAnnot(page, doc.context, inkDict({ points, color, width }));
  return doc.save();
}

// Applies any mix of sticky notes, highlights, and ink strokes in one
// load/save pass — the same batch-apply convention applyFillSign()
// (fill-sign.js) and addFormFields() (forms.js) use for interactive
// multi-item tools, instead of one PDFDocument round-trip per annotation.
// items: [{ type: 'sticky'|'highlight'|'ink', pageIndex, ... }]
export async function applyAnnotations(buf, items) {
  const doc = await PDFDocument.load(buf);
  const pages = doc.getPages();
  for (const item of items) {
    const page = pages[item.pageIndex];
    if (item.type === 'sticky') pushAnnot(page, doc.context, stickyDict(item));
    else if (item.type === 'highlight') pushAnnot(page, doc.context, highlightDict(item));
    else if (item.type === 'ink') pushAnnot(page, doc.context, inkDict(item));
  }
  return doc.save();
}
