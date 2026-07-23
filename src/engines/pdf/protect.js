import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';

export async function protectPdf(
  buf,
  { userPassword, ownerPassword, algorithm = 'AES-256', permissions = {} }
) {
  return encryptPDF(buf, userPassword, { ownerPassword, algorithm, ...permissions });
}

export async function removeProtection(buf, password) {
  return decryptPDF(buf, password);
}

export async function checkEncryption(buf) {
  return isEncrypted(buf);
}
