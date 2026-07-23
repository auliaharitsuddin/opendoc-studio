import { el } from '../components/dom.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';

export function renderDigitalSign() {
  const root = el('div', { class: 'workspace' });
  let pdfFile = null;
  let p12File = null;

  const pdfInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const pdfDrop = el('div', { class: 'dropzone dropzone-compact' }, [
    el('div', {}, 'PDF yang akan ditandatangani'),
    pdfInput
  ]);
  const pdfLabel = el('div', { class: 'file-list' });
  pdfDrop.addEventListener('click', (e) => {
    if (e.target !== pdfInput) pdfInput.click();
  });
  pdfInput.addEventListener('change', () => {
    pdfFile = pdfInput.files[0] ?? null;
    pdfLabel.textContent = pdfFile ? pdfFile.name : '';
    updateButtons();
  });

  const modeSelect = el('select', { class: 'field-input' }, [
    el('option', { value: 'self-signed' }, 'Buat sertifikat uji (self-signed) — cepat, untuk dokumen internal/pengujian'),
    el('option', { value: 'p12' }, 'Unggah sertifikat saya (.p12 / .pfx)')
  ]);

  const p12Input = el('input', { type: 'file', accept: '.p12,.pfx', class: 'field-input' });
  const p12Password = el('input', { type: 'password', class: 'field-input', placeholder: 'Kata sandi sertifikat' });
  const p12Section = el('div', { class: 'options-form hidden' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'File sertifikat (.p12/.pfx)'), p12Input]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Kata sandi'), p12Password])
  ]);
  p12Input.addEventListener('change', () => {
    p12File = p12Input.files[0] ?? null;
    updateButtons();
  });

  const commonNameInput = el('input', { type: 'text', class: 'field-input', value: 'OpenDoc Studio Test' });
  const selfSignedSection = el('div', { class: 'options-form' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Nama penanda tangan (Common Name)'), commonNameInput])
  ]);

  modeSelect.addEventListener('change', () => {
    const isP12 = modeSelect.value === 'p12';
    p12Section.classList.toggle('hidden', !isP12);
    selfSignedSection.classList.toggle('hidden', isP12);
    updateButtons();
  });

  const reasonInput = el('input', { type: 'text', class: 'field-input', placeholder: 'mis. Persetujuan dokumen' });
  const nameInput = el('input', { type: 'text', class: 'field-input', placeholder: 'Nama yang tampil pada info tanda tangan' });
  const commonOptions = el('div', { class: 'options-form' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Alasan (opsional)'), reasonInput]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Nama (opsional)'), nameInput])
  ]);

  const warningBox = el(
    'div',
    { class: 'alert alert-warning' },
    '⚠️ Sertifikat self-signed TIDAK diverifikasi oleh otoritas sertifikasi manapun — cocok untuk dokumen internal/pengujian, bukan untuk keperluan hukum yang membutuhkan identitas terverifikasi.'
  );

  const signBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: doSign }, 'Tanda Tangani');
  const progressLabel = el('div', { class: 'progress-label' });
  const resultArea = el('div', { class: 'result-area hidden' });

  function updateButtons() {
    const certReady = modeSelect.value === 'self-signed' || (p12File && p12Password.value);
    signBtn.disabled = !pdfFile || !certReady;
  }
  p12Password.addEventListener('input', updateButtons);

  async function doSign() {
    signBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    progressLabel.textContent = 'Menyiapkan sertifikat...';

    try {
      const { signPdf, generateSelfSignedCertificate, parseP12 } = await import('../../engines/pdf/digital-sign.js');
      let certBundle;
      if (modeSelect.value === 'self-signed') {
        certBundle = generateSelfSignedCertificate({ commonName: commonNameInput.value || 'OpenDoc Studio Test' });
      } else {
        const p12Bytes = new Uint8Array(await p12File.arrayBuffer());
        certBundle = parseP12(p12Bytes, p12Password.value);
      }

      progressLabel.textContent = 'Menandatangani dokumen...';
      const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
      const signed = await signPdf(pdfBytes, {
        ...certBundle,
        reason: reasonInput.value,
        name: nameInput.value
      });

      progressLabel.textContent = '';
      resultArea.classList.remove('hidden');
      const blob = new Blob([signed], { type: 'application/pdf' });
      const filename = suggestOutputName(pdfFile.name, 'signed.pdf');
      const downloadBtn = el(
        'button',
        {
          class: 'btn btn-primary',
          onclick: async () => {
            downloadBtn.disabled = true;
            await downloadResult(blob, filename);
            downloadBtn.textContent = '✓ Diunduh & dihapus dari memori';
          }
        },
        `Unduh ${filename}`
      );
      resultArea.append(el('div', { class: 'alert alert-success' }, '✅ Dokumen berhasil ditandatangani.'), downloadBtn);
    } catch (err) {
      progressLabel.textContent = '';
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal menandatangani: ${err.message}`));
    } finally {
      signBtn.disabled = false;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, 'Tanda Tangan Digital Bersertifikat'),
      el('p', { class: 'workspace-desc' }, 'Penandatanganan PAdES-style (PKCS#7 detached) sesuai ISO 32000. Satu tanda tangan per dokumen; menambah tanda tangan kedua ke PDF yang sudah ditandatangani belum didukung.'),
      el('div', { class: 'privacy-badge' }, '🔒 Kunci privat & sertifikat tidak pernah meninggalkan browser Anda.')
    ]),
    pdfDrop,
    pdfLabel,
    el('div', { class: 'options-form' }, [el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Sumber sertifikat'), modeSelect])]),
    selfSignedSection,
    p12Section,
    warningBox,
    commonOptions,
    el('div', { class: 'actions' }, [signBtn]),
    progressLabel,
    resultArea
  );

  updateButtons();
  return root;
}
