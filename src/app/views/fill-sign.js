import { el } from '../components/dom.js';
import { renderPdfPageToCanvas } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';
import { t } from '../i18n.js';

const DEFAULT_IMAGE_SIZE = [160, 50];

export function renderFillSign() {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pageCtx = null;
  let mode = 'text'; // 'text' | 'image'
  let signatureImageBytes = null;
  let signatureImageName = '';
  const items = []; // { pageIndex, x, y, kind, value, fontSize?, width?, height? }

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone-icon' }, '✍️'),
    el('div', {}, t('Pilih PDF untuk ditandatangani (halaman 1)')),
    fileInput
  ]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const modeSelect = el('select', { class: 'field-input' }, [
    el('option', { value: 'text' }, t('Teks (ketik tanda tangan)')),
    el('option', { value: 'image' }, t('Gambar (unggah tanda tangan)'))
  ]);
  const textValueInput = el('input', { type: 'text', class: 'field-input', value: 'Disetujui' });
  const fontSizeInput = el('input', { type: 'number', class: 'field-input', value: 18 });
  const textSection = el('div', { class: 'options-form' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, t('Teks yang ditempel')), textValueInput]),
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, t('Ukuran font')), fontSizeInput])
  ]);

  const imageFileInput = el('input', { type: 'file', accept: '.png,.jpg,.jpeg', class: 'field-input' });
  const imageSection = el('div', { class: 'options-form hidden' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field-label' }, t('Gambar tanda tangan (PNG/JPG)')), imageFileInput])
  ]);
  imageFileInput.addEventListener('change', async () => {
    const f = imageFileInput.files[0];
    if (!f) return;
    signatureImageBytes = new Uint8Array(await f.arrayBuffer());
    signatureImageName = f.name;
    statusLine.textContent = `${t('Gambar')} "${f.name}" ${t('siap — klik pada halaman untuk menempatkannya.')}`;
  });

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value;
    textSection.classList.toggle('hidden', mode !== 'text');
    imageSection.classList.toggle('hidden', mode !== 'image');
    statusLine.textContent =
      mode === 'image' && !signatureImageBytes
        ? t('Unggah gambar tanda tangan dulu, lalu klik pada halaman.')
        : t('Klik pada halaman untuk menempatkan tanda tangan.');
  });

  const canvasWrap = el('div', { class: 'measure-canvas-wrap' });
  const statusLine = el('div', { class: 'progress-label' }, t('Pilih PDF untuk mulai menempatkan tanda tangan.'));
  const itemList = el('ul', { class: 'file-list' });
  const applyBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: applyAndDownload }, t('Terapkan & Unduh PDF'));
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    pageCtx?.destroy?.();
    pageCtx = await renderPdfPageToCanvas(f, { pageIndex: 0, scale: 1.4 });
    canvasWrap.innerHTML = '';
    canvasWrap.appendChild(pageCtx.canvas);
    pageCtx.canvas.addEventListener('click', onCanvasClick);
    items.length = 0;
    renderItemList();
    statusLine.textContent =
      mode === 'image' && !signatureImageBytes
        ? t('Unggah gambar tanda tangan dulu, lalu klik pada halaman.')
        : t('Klik pada halaman untuk menempatkan tanda tangan.');
  }

  function onCanvasClick(e) {
    if (!pageCtx) return;
    const rect = pageCtx.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const [pdfX, pdfY] = pageCtx.canvasToPdfPoint(canvasX, canvasY);

    if (mode === 'text') {
      const value = textValueInput.value.trim();
      if (!value) {
        statusLine.textContent = t('Isi teks tanda tangan terlebih dahulu.');
        return;
      }
      const fontSize = Number(fontSizeInput.value) || 18;
      items.push({ pageIndex: 0, x: pdfX, y: pdfY, kind: 'text', value, fontSize });
    } else {
      if (!signatureImageBytes) {
        statusLine.textContent = t('Unggah gambar tanda tangan dulu, lalu klik pada halaman.');
        return;
      }
      const [w, h] = DEFAULT_IMAGE_SIZE;
      items.push({ pageIndex: 0, x: pdfX, y: pdfY - h, width: w, height: h, kind: 'image', value: signatureImageBytes });
    }
    drawMarker(canvasX, canvasY);
    renderItemList();
  }

  function drawMarker(x, y) {
    const ctx = pageCtx.canvas.getContext('2d');
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderItemList() {
    itemList.innerHTML = '';
    items.forEach((item, i) => {
      const label = item.kind === 'text' ? `${t('Teks')}: "${item.value}"` : `${t('Gambar')}: ${signatureImageName}`;
      itemList.appendChild(
        el('li', {}, [`${i + 1}. ${label}  `, el('button', { class: 'btn-icon', onclick: () => removeItem(i) }, '✕')])
      );
    });
    applyBtn.disabled = items.length === 0;
  }

  function removeItem(i) {
    items.splice(i, 1);
    renderItemList();
  }

  async function applyAndDownload() {
    applyBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const { applyFillSign } = await import('../../engines/pdf/fill-sign.js');
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await applyFillSign(buf, items);
      const blob = new Blob([result], { type: 'application/pdf' });
      const filename = suggestOutputName(file.name, 'ditandatangani.pdf');
      resultArea.classList.remove('hidden');
      const downloadBtn = el(
        'button',
        {
          class: 'btn btn-primary',
          onclick: async () => {
            downloadBtn.disabled = true;
            await downloadResult(blob, filename);
            downloadBtn.textContent = t('✓ Diunduh & dihapus dari memori');
          }
        },
        `${t('Unduh')} ${filename}`
      );
      resultArea.append(el('div', { class: 'alert alert-success' }, t('✅ Tanda tangan berhasil ditempelkan.')), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `${t('Gagal')}: ${err.message}`));
    } finally {
      applyBtn.disabled = false;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, t('Isi & Tanda Tangan')),
      el(
        'p',
        { class: 'workspace-desc' },
        t('Klik langsung pada halaman 1 untuk menempelkan teks atau gambar tanda tangan — tidak perlu lagi menghitung koordinat manual.')
      ),
      el('div', { class: 'privacy-badge' }, t('🔒 Diproses 100% lokal di browser Anda.'))
    ]),
    dropzone,
    el('div', { class: 'options-form' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, t('Jenis tanda tangan')), modeSelect])
    ]),
    textSection,
    imageSection,
    statusLine,
    canvasWrap,
    el('h3', {}, t('Item Ditempatkan')),
    itemList,
    el('div', { class: 'actions' }, [applyBtn]),
    resultArea
  );

  return root;
}
