import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from 'pdf-lib';

// Re-encodes each embedded raster image XObject at a lower JPEG quality/resolution
// using an in-worker OffscreenCanvas, then re-saves with object streams enabled.
// If an image can't be decoded/re-encoded (unsupported color space, corrupt
// stream) it's left untouched — compression is best-effort, never destructive.
async function reencodeImage(bytes, quality, maxDimension) {
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  let { width, height } = bitmap;
  if (maxDimension && Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Uint8Array(await outBlob.arrayBuffer());
}

export async function compressPdf(buf, { imageQuality = 0.6, maxImageDimension = 1600 } = {}) {
  const doc = await PDFDocument.load(buf);
  const indirectObjects = doc.context.enumerateIndirectObjects();

  for (const [ref, obj] of indirectObjects) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    const subtype = dict.get(PDFName.of('Subtype'));
    if (!subtype || subtype.toString() !== '/Image') continue;
    const filter = dict.get(PDFName.of('Filter'));
    const filterName = filter ? filter.toString() : '';
    if (!filterName.includes('DCTDecode') && !filterName.includes('FlateDecode')) continue;

    try {
      const newBytes = await reencodeImage(obj.contents, imageQuality, maxImageDimension);
      if (newBytes.length >= obj.contents.length) continue;
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      dict.delete(PDFName.of('DecodeParms'));
      dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
      doc.context.assign(ref, PDFRawStream.of(dict, newBytes));
    } catch {
      // Unsupported/corrupt image stream — keep the original bytes.
    }
  }

  return doc.save({ useObjectStreams: true });
}
