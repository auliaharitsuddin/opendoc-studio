import { PDFDocument } from 'pdf-lib';

export async function readMetadata(buf) {
  const doc = await PDFDocument.load(buf);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() ?? '').toString(),
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
    pageCount: doc.getPageCount()
  };
}

export async function writeMetadata(buf, meta) {
  const doc = await PDFDocument.load(buf);
  if (meta.title !== undefined) doc.setTitle(meta.title);
  if (meta.author !== undefined) doc.setAuthor(meta.author);
  if (meta.subject !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) {
    doc.setKeywords(
      meta.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    );
  }
  if (meta.creator !== undefined) doc.setCreator(meta.creator);
  doc.setModificationDate(new Date());
  return doc.save();
}
