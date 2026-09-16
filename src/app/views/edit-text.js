import { el } from '../components/dom.js';
import { renderAllPagesToCanvases } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';
import { t } from '../i18n.js';

const RENDER_SCALE = 1.4;
const HIT_PADDING = 3; // pt, PDF space — makes thin lines easier to click without changing the drawn cover box

export function renderEditText() {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pagesData = []; // [{ pageIndex, items, pageWidth, pageHeight, canvas }]
  let activeInput = null; // the currently-open inline edit <input>, if any
  const edits = new Map(); // "pageIndex:itemIndex" -> { pageIndex, x, y, width, height, fontSize, fontFamily, newText }

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone-icon' }, '✎'),
    el('div', {}, t('Pilih PDF untuk diedit teksnya')),
    fileInput
  ]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const canvasWrap = el('div', { class: 'measure-canvas-wrap edit-text-wrap' });
  const statusLine = el('div', { class: 'progress-label' }, t('Pilih PDF untuk mulai mengedit teks.'));
  const editList = el('ul', { class: 'file-list' });
  const applyBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: applyAndDownload }, t('Terapkan & Unduh PDF'));
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    closeActiveInput(false);
    statusLine.textContent = t('Membaca dokumen...');
    canvasWrap.innerHTML = '';
    edits.clear();
    renderEditList();

    const buf = new Uint8Array(await f.arrayBuffer());
    const { getAllPagesTextItems } = await import('../../engines/pdf/edit-text.js');
    const [textPages, { canvases }] = await Promise.all([
      getAllPagesTextItems(buf),
      renderAllPagesToCanvases(f, { scale: RENDER_SCALE })
    ]);
    pagesData = textPages.map((p, i) => ({ ...p, canvas: canvases[i] }));

    pagesData.forEach((p) => {
      const pageWrap = el('div', { class: 'edit-text-page' }, [el('div', { class: 'file-preview-page-label' }, `${t('Halaman')} ${p.pageIndex + 1}`)]);
      pageWrap.appendChild(p.canvas);
      pageWrap.addEventListener('click', (e) => onCanvasClick(e, p, pageWrap));
      canvasWrap.appendChild(pageWrap);
    });

    const totalTextRuns = pagesData.reduce((sum, p) => sum + p.items.length, 0);
    statusLine.textContent = totalTextRuns
      ? `${t('Ditemukan')} ${totalTextRuns} ${t('baris teks di')} ${pagesData.length} ${t('halaman. Klik teks pada halaman mana pun untuk menggantinya.')}`
      : t('Tidak ada teks terdeteksi di dokumen ini (mungkin hasil scan — gunakan alat OCR dulu).');
  }

  function pdfToCanvasRect(item, pageHeight) {
    return {
      x: item.x * RENDER_SCALE,
      y: (pageHeight - item.y - item.height) * RENDER_SCALE,
      width: item.width * RENDER_SCALE,
      height: item.height * RENDER_SCALE
    };
  }

  function onCanvasClick(e, pageData, pageWrap) {
    if (e.target !== pageData.canvas) return; // ignore clicks on the label or an open input
    closeActiveInput(true);

    const rect = pageData.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const pdfX = canvasX / RENDER_SCALE;
    const pdfY = pageData.pageHeight - canvasY / RENDER_SCALE;

    const idx = pageData.items.findIndex(
      (item) =>
        pdfX >= item.x - HIT_PADDING &&
        pdfX <= item.x + item.width + HIT_PADDING &&
        pdfY >= item.y - HIT_PADDING &&
        pdfY <= item.y + item.height + HIT_PADDING
    );
    if (idx === -1) {
      statusLine.textContent = t('Tidak ada teks terdeteksi di posisi itu — coba klik lebih tepat di atas teks.');
      return;
    }

    openInlineEditor(pageData, idx, pageWrap);
  }

  // Edits in place with a floating <input> positioned exactly over the
  // clicked run, instead of a native prompt() dialog — the primary
  // interaction of this tool, so it's worth the extra positioning code
  // (unlike the occasional one-off prompt() used for calibration/labels
  // elsewhere in the app).
  function openInlineEditor(pageData, idx, pageWrap) {
    const item = pageData.items[idx];
    const key = `${pageData.pageIndex}:${idx}`;
    const current = edits.get(key)?.newText ?? item.str;
    const box = pdfToCanvasRect(item, pageData.pageHeight);

    const input = el('input', { type: 'text', class: 'edit-text-inline-input', value: current });
    input.style.left = `${box.x}px`;
    input.style.top = `${box.y}px`;
    input.style.width = `${Math.max(box.width, 60)}px`;
    input.style.height = `${box.height + 6}px`;
    input.style.fontSize = `${Math.max(item.fontSize * RENDER_SCALE * 0.85, 10)}px`;

    let settled = false;
    function commit() {
      if (settled) return;
      settled = true;
      const value = input.value;
      if (value && value !== item.str) {
        edits.set(key, {
          pageIndex: pageData.pageIndex,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          fontSize: item.fontSize,
          fontFamily: item.fontFamily,
          newText: value
        });
        drawEditedBox(pageData, box, value);
        renderEditList();
      }
      cleanup();
    }
    function cancel() {
      settled = true;
      cleanup();
    }
    function cleanup() {
      input.remove();
      if (activeInput === input) activeInput = null;
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener('blur', () => commit());

    pageWrap.appendChild(input);
    activeInput = input;
    input.focus();
    input.select();
  }

  function closeActiveInput(shouldCommit) {
    if (!activeInput) return;
    if (shouldCommit) activeInput.blur();
    else {
      activeInput.remove();
      activeInput = null;
    }
  }

  // Gives an on-canvas preview matching what applyTextEdits will actually
  // produce: samples the already-rendered page's own pixels just above the
  // box (the canvas is already painted, so no extra PDF re-render is needed
  // here — unlike the engine's version of this, which samples from a fresh
  // pdf.js render since it doesn't have a live canvas to read from) and
  // paints over the old text with it before writing the replacement.
  function drawEditedBox(pageData, box, newText) {
    const ctx = pageData.canvas.getContext('2d');
    const sampleX = Math.max(0, Math.min(pageData.canvas.width - 1, Math.round(box.x + 2)));
    const sampleY = Math.max(0, Math.round(box.y - 4));
    const { data } = ctx.getImageData(sampleX, sampleY, 1, 1);
    const bg = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;

    ctx.fillStyle = bg;
    ctx.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(box.height * 0.8, 10)}px sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(newText, box.x, box.y + box.height);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
  }

  function removeEdit(key) {
    edits.delete(key);
    renderEditList();
  }

  function renderEditList() {
    editList.innerHTML = '';
    for (const [key, e] of edits) {
      const pageLabel = Number(key.split(':')[0]) + 1;
      editList.appendChild(
        el('li', {}, [`${t('Hal.')} ${pageLabel}: "${e.newText}"  `, el('button', { class: 'btn-icon', onclick: () => removeEdit(key) }, '✕')])
      );
    }
    applyBtn.disabled = edits.size === 0;
  }

  async function applyAndDownload() {
    applyBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const { applyTextEdits } = await import('../../engines/pdf/edit-text.js');
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await applyTextEdits(buf, [...edits.values()]);
      const blob = new Blob([result], { type: 'application/pdf' });
      const filename = suggestOutputName(file.name, 'diedit.pdf');
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
      resultArea.append(el('div', { class: 'alert alert-success' }, t('✅ Teks berhasil diganti.')), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `${t('Gagal')}: ${err.message}`));
    } finally {
      applyBtn.disabled = false;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, t('Edit Teks Halaman')),
      el(
        'p',
        { class: 'workspace-desc' },
        t(
          'Klik teks yang sudah ada di halaman berapa pun untuk menggantinya langsung di tempat. Teks lama ditutup dengan warna latar yang disesuaikan otomatis ke halaman, lalu teks baru ditulis di posisi yang sama menggunakan font standar terdekat (serif/sans-serif/monospace) — cocok untuk koreksi singkat/typo, bukan penggantian paragraf panjang, dan font pengganti mungkin tidak identik dengan font asli dokumen.'
        )
      ),
      el('div', { class: 'privacy-badge' }, t('🔒 Diproses 100% lokal di browser Anda.'))
    ]),
    dropzone,
    statusLine,
    canvasWrap,
    el('h3', {}, t('Perubahan Tertunda')),
    editList,
    el('div', { class: 'actions' }, [applyBtn]),
    resultArea
  );

  return root;
}
