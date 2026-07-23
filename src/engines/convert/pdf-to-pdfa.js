import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

// Best-effort PDF/A-1B conformance: declares XMP metadata + an OutputIntent
// naming sRGB, which is what most PDF/A "converters" that don't do a full font
// re-embed / color-space rewrite actually provide. This is NOT a substitute for
// veraPDF/PDF/A validation — documented honestly in ROADMAP.md as reduced-scope.
export async function pdfToPdfA(buf, { title = '', conformance = '1B' } = {}) {
  const doc = await PDFDocument.load(buf);
  const now = new Date().toISOString();

  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <pdfaid:part>1</pdfaid:part>
      <pdfaid:conformance>${conformance}</pdfaid:conformance>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const metadataStream = doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' });
  const metadataRef = doc.context.register(metadataStream);
  doc.catalog.set(PDFName.of('Metadata'), metadataRef);

  const outputIntent = doc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1')
  });
  const outputIntentRef = doc.context.register(outputIntent);
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntentRef]));

  if (title) doc.setTitle(title);

  return doc.save();
}
