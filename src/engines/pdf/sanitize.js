import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

export async function sanitizePdf(
  buf,
  {
    removeMetadata = true,
    removeJavaScript = true,
    removeAttachments = true,
    removeAnnotationsComments = false
  } = {}
) {
  const doc = await PDFDocument.load(buf);

  if (removeMetadata) {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.setProducer('');
  }

  const catalog = doc.catalog;

  if (removeJavaScript) {
    catalog.delete(PDFName.of('OpenAction'));
    const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    names?.delete(PDFName.of('JavaScript'));
  }

  if (removeAttachments) {
    const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    names?.delete(PDFName.of('EmbeddedFiles'));
  }

  if (removeAnnotationsComments) {
    doc.getPages().forEach((page) => {
      page.node.delete(PDFName.of('Annots'));
    });
  }

  return doc.save();
}
