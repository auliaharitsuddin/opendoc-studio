import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { signPdf, verifySignedPdf, generateSelfSignedCertificate } from '../src/engines/pdf/digital-sign.js';

async function makePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawText('Dokumen uji tanda tangan', { x: 20, y: 150 });
  return doc.save();
}

describe('digital signature (PAdES-style)', () => {
  it('produces a signature that cryptographically verifies', async () => {
    const pdfBytes = await makePdf();
    const { cert, privateKey, certChain } = generateSelfSignedCertificate({ commonName: 'Test Signer' });
    const signed = await signPdf(pdfBytes, { cert, privateKey, certChain, reason: 'Unit test' });

    const result = verifySignedPdf(signed);
    expect(result.valid).toBe(true);
    expect(result.digestMatches).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.signerCommonName).toBe('Test Signer');
  });

  it('still opens as a well-formed PDF after signing', async () => {
    const pdfBytes = await makePdf();
    const { cert, privateKey, certChain } = generateSelfSignedCertificate();
    const signed = await signPdf(pdfBytes, { cert, privateKey, certChain });

    const reloaded = await PDFDocument.load(signed);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('detects tampering after signing (negative control)', async () => {
    const pdfBytes = await makePdf();
    const { cert, privateKey, certChain } = generateSelfSignedCertificate();
    const signed = await signPdf(pdfBytes, { cert, privateKey, certChain });

    const tampered = new Uint8Array(signed);
    // Flip a byte inside the signed (ByteRange-covered) content, well before
    // the /Contents placeholder, without touching PDF structural syntax.
    tampered[50] = tampered[50] ^ 0xff;

    const result = verifySignedPdf(tampered);
    expect(result.valid).toBe(false);
    expect(result.digestMatches).toBe(false);
  });

  it('reports no signature found on an unsigned PDF', async () => {
    const pdfBytes = await makePdf();
    const result = verifySignedPdf(pdfBytes);
    expect(result.valid).toBe(false);
  });
});
