import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray } from 'pdf-lib';
import forge from 'node-forge';

// Certificate-based PDF signing (PAdES-style, ISO 32000-1 §12.8), implemented
// from the spec directly rather than via @signpdf/signpdf: that package (and
// its companions) call `Buffer.from()`/`instanceof Buffer` internally, which
// don't exist in a browser/worker without polyfilling — an unverifiable risk
// in an environment with no real browser to test against. node-forge, by
// contrast, is written to be browser-native (its own byte-buffer type), so
// everything below only touches Uint8Array/forge types, never Node's Buffer.
//
// How it works: reserve an oversized placeholder in the /Contents hex string
// and generous placeholder numbers in /ByteRange, save the PDF once, locate
// those exact placeholders in the resulting bytes via text search, hash
// everything EXCEPT the placeholder hex digits, build a detached PKCS#7
// SignedData over that hash with node-forge, and patch the real ByteRange +
// signature hex back into the same byte positions (so nothing else shifts).
//
// Scope limits (see ROADMAP.md): produces one signature per document via a
// full resave, not an incremental update — adding a second signature to an
// already-signed PDF isn't supported. No timestamp-authority (RFC 3161)
// counter-signature.

const CONTENTS_PLACEHOLDER_BYTES = 8192;
const BYTE_RANGE_PLACEHOLDER = 9999999999; // 10 digits — wide enough for any realistic file size

function pdfDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}Z`;
}

function latin1Decode(bytes) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return out;
}

function patchAscii(bytes, offset, text) {
  for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
}

export function parseP12(p12Bytes, password) {
  const der = forge.util.createBuffer(new Uint8Array(p12Bytes).buffer);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
    [];

  if (certBags.length === 0 || keyBags.length === 0) {
    throw new Error('File .p12/.pfx tidak berisi sertifikat atau kunci privat yang valid.');
  }

  const cert = certBags[0].cert;
  const privateKey = keyBags[0].key;
  const certChain = certBags.map((b) => b.cert);
  return { cert, privateKey, certChain };
}

// Generates a throwaway self-signed certificate for testing/internal use.
// Clearly not a trust-chain-verified identity — labeled as such in the UI.
export function generateSelfSignedCertificate({ commonName = 'OpenDoc Studio Test', days = 365 } = {}) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + days);
  const attrs = [{ name: 'commonName', value: commonName }, { name: 'organizationName', value: 'OpenDoc Studio (self-signed)' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', critical: true, digitalSignature: true, nonRepudiation: true }
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, privateKey: keys.privateKey, certChain: [cert] };
}

async function preparePlaceholderPdf(pdfBytes, { pageIndex, name, reason, contactInfo }) {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const page = pages[Math.min(pageIndex ?? pages.length - 1, pages.length - 1)];

  const sigDict = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER, BYTE_RANGE_PLACEHOLDER],
    Contents: PDFHexString.of('00'.repeat(CONTENTS_PLACEHOLDER_BYTES)),
    M: PDFString.of(pdfDate(new Date())),
    Name: PDFString.of(name || ''),
    Reason: PDFString.of(reason || ''),
    ContactInfo: PDFString.of(contactInfo || '')
  });
  const sigRef = doc.context.register(sigDict);

  const widget = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [0, 0, 0, 0],
    V: sigRef,
    F: 132, // Print (bit 3) + Locked (bit 8) — invisible, non-interactive
    P: page.ref
  });
  const widgetRef = doc.context.register(widget);

  const existingAnnots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (existingAnnots) {
    existingAnnots.push(widgetRef);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([widgetRef]));
  }

  const acroForm = doc.context.obj({
    Fields: [widgetRef],
    SigFlags: 3
  });
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(acroForm));

  const bytes = await doc.save({ useObjectStreams: false });
  return bytes;
}

function locatePlaceholders(bytes) {
  const text = latin1Decode(bytes);
  const contentsMarker = `/Contents <${'0'.repeat(CONTENTS_PLACEHOLDER_BYTES * 2)}>`;
  const contentsMarkerIndex = text.indexOf(contentsMarker);
  if (contentsMarkerIndex === -1) {
    throw new Error('Tidak dapat menemukan placeholder tanda tangan pada PDF (internal).');
  }
  const contentsHexStart = contentsMarkerIndex + '/Contents <'.length;
  const contentsHexEnd = contentsHexStart + CONTENTS_PLACEHOLDER_BYTES * 2;

  // pdf-lib serializes arrays as "[ a b c ]" (single spaces around brackets
  // and between elements) — confirmed empirically against this exact build,
  // not assumed, since silently getting this wrong would corrupt every file.
  const byteRangeFieldsText = `${BYTE_RANGE_PLACEHOLDER} ${BYTE_RANGE_PLACEHOLDER} ${BYTE_RANGE_PLACEHOLDER}`;
  const byteRangeMarker = `/ByteRange [ 0 ${byteRangeFieldsText} ]`;
  const byteRangeIndex = text.indexOf(byteRangeMarker);
  if (byteRangeIndex === -1) {
    throw new Error('Tidak dapat menemukan placeholder ByteRange pada PDF (internal).');
  }

  return {
    contentsAngleOpen: contentsHexStart - 1, // index of '<'
    contentsHexStart,
    contentsHexEnd,
    contentsAngleClose: contentsHexEnd, // index of '>'
    byteRangeFieldsStart: byteRangeIndex + '/ByteRange [ 0 '.length,
    byteRangeFieldsWidth: byteRangeFieldsText.length
  };
}

function buildSignedHex(signedBytesRangeConcat, { cert, privateKey, certChain }) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(signedBytesRangeConcat);
  (certChain && certChain.length ? certChain : [cert]).forEach((c) => p7.addCertificate(c));
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() }
    ]
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  let hex = '';
  for (let i = 0; i < der.length; i += 1) {
    hex += der.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export async function signPdf(
  pdfBytes,
  { cert, privateKey, certChain, pageIndex, name = '', reason = '', contactInfo = '' }
) {
  const prepared = await preparePlaceholderPdf(pdfBytes, { pageIndex, name, reason, contactInfo });
  const { contentsAngleOpen, contentsHexStart, contentsAngleClose, byteRangeFieldsStart, byteRangeFieldsWidth } =
    locatePlaceholders(prepared);

  const range1End = contentsAngleOpen + 1; // include '<'
  const range2Start = contentsAngleClose; // include '>'
  const totalLength = prepared.length;

  // The /ByteRange numbers live INSIDE range1 (before /Contents), so they must
  // be patched to their real, final values BEFORE hashing — otherwise the
  // bytes that get signed (with placeholder numbers) would differ from the
  // bytes a verifier re-hashes later (with real numbers), invalidating every
  // signature. Only the /Contents hex digits themselves are excluded from
  // what gets signed, and they're patched last, after signing.
  const out = new Uint8Array(prepared);
  const paddedByteRange = `${range1End} ${range2Start} ${totalLength - range2Start}`.padEnd(byteRangeFieldsWidth, ' ');
  if (paddedByteRange.length > byteRangeFieldsWidth) {
    throw new Error('Dokumen terlalu besar untuk placeholder ByteRange yang dialokasikan (internal).');
  }
  patchAscii(out, byteRangeFieldsStart, paddedByteRange);

  const signedConcat = new Uint8Array(range1End + (totalLength - range2Start));
  signedConcat.set(out.subarray(0, range1End), 0);
  signedConcat.set(out.subarray(range2Start), range1End);

  const hex = buildSignedHex(signedConcat, { cert, privateKey, certChain });
  if (hex.length > CONTENTS_PLACEHOLDER_BYTES * 2) {
    throw new Error('Sertifikat/rantai sertifikat terlalu besar untuk placeholder tanda tangan yang dialokasikan.');
  }

  patchAscii(out, contentsHexStart, hex);

  return out;
}

// Independently re-parses a signed PDF and verifies the PKCS#7 signature
// against the ByteRange-covered bytes — used both as a "Verifikasi" tool and
// as this feature's automated correctness test (see test/digital-sign.test.js).
export function verifySignedPdf(bytes) {
  const text = latin1Decode(bytes);
  const byteRangeMatch = text.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  const contentsMatch = text.match(/\/Contents\s*<([0-9a-fA-F]+?)0*>/);
  if (!byteRangeMatch || !contentsMatch) {
    return { valid: false, reason: 'Tidak ditemukan tanda tangan digital pada dokumen ini.' };
  }

  const [, r1s, r1l, r2s, r2l] = byteRangeMatch.map(Number);
  const signedBytes = new Uint8Array(r1l + r2l);
  signedBytes.set(bytes.subarray(r1s, r1s + r1l), 0);
  signedBytes.set(bytes.subarray(r2s, r2s + r2l), r1l);

  const hex = contentsMatch[1];
  const der = hex
    .match(/.{1,2}/g)
    .map((h) => String.fromCharCode(parseInt(h, 16)))
    .join('');

  try {
    const asn1 = forge.asn1.fromDer(der);
    const p7 = forge.pkcs7.messageFromAsn1(asn1);
    const cert = p7.certificates[0];
    const rc = p7.rawCapture;
    const cn = cert?.subject?.getField('CN')?.value ?? 'Tidak diketahui';

    // node-forge has no built-in pkcs7.verify(); this reconstructs the exact
    // check by hand (validated against a tamper-detection control in
    // test/digital-sign.test.js):
    //   1. hash the ByteRange-covered document bytes
    //   2. compare that hash to the signed messageDigest attribute
    //   3. re-DER-encode the authenticatedAttributes as an explicit SET
    //      (CMS signs that form, not the raw [0] IMPLICIT bytes) and verify
    //      the RSA signature over it with the certificate's public key
    const contentDigest = forge.md.sha256
      .create()
      .update(forge.util.createBuffer(signedBytes).bytes())
      .digest()
      .getBytes();

    let messageDigestAttr = null;
    let signingTime = null;
    for (const attrSeq of rc.authenticatedAttributes) {
      const oid = forge.asn1.derToOid(attrSeq.value[0].value);
      if (oid === forge.pki.oids.messageDigest) {
        messageDigestAttr = attrSeq.value[1].value[0].value;
      } else if (oid === forge.pki.oids.signingTime) {
        signingTime = attrSeq.value[1].value[0].value;
      }
    }

    const digestMatches = messageDigestAttr === contentDigest;

    const setAsn1 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, rc.authenticatedAttributes);
    const attrsDigest = forge.md.sha256.create().update(forge.asn1.toDer(setAsn1).getBytes()).digest().getBytes();
    const signatureValid = cert.publicKey.verify(attrsDigest, rc.signature);

    return {
      valid: digestMatches && signatureValid,
      signerCommonName: cn,
      signingTime,
      digestMatches,
      signatureValid,
      reason: !digestMatches
        ? 'Isi dokumen berubah setelah ditandatangani (hash tidak cocok).'
        : !signatureValid
          ? 'Tanda tangan kriptografis tidak valid.'
          : undefined
    };
  } catch (err) {
    return { valid: false, reason: `Gagal memverifikasi: ${err.message}` };
  }
}
