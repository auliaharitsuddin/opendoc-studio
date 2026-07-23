import { el } from '../components/dom.js';
import { renderAllPagesToCanvases } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';

const THUMB_SCALE = 0.35;

// Shared shell for "click page thumbnails to pick a set of pages" tools —
// used by both Ekstrak Halaman (keep the selected pages) and Hapus Halaman
// (remove the selected pages). The only difference between the two is the
// wording and which engine call `buildAndRun` makes; the click-to-select
// grid, drag-select, and download flow are identical.
function renderPageSelector({ headerTitle, headerDesc, icon, hint, buildAndRun }) {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pageCount = 0;
  const selected = new Set(); // 0-based indices

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [el('div', { class: 'dropzone-icon' }, icon), el('div', {}, hint), fileInput]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const statusLine = el('div', { class: 'progress-label' }, 'Pilih PDF untuk menampilkan halaman.');
  const grid = el('div', { class: 'page-picker-grid' });
  const selectAllBtn = el('button', { class: 'btn btn-secondary', disabled: '', onclick: selectAll }, 'Pilih Semua');
  const selectNoneBtn = el('button', { class: 'btn btn-secondary', disabled: '', onclick: selectNone }, 'Kosongkan Pilihan');
  const runBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: runAction }, 'Proses');
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    selected.clear();
    statusLine.textContent = 'Merender halaman...';
    grid.innerHTML = '';
    runBtn.disabled = true;
    selectAllBtn.disabled = true;
    selectNoneBtn.disabled = true;

    const { canvases } = await renderAllPagesToCanvases(f, { scale: THUMB_SCALE });
    pageCount = canvases.length;

    canvases.forEach((canvas, idx) => {
      const thumb = el('div', { class: 'page-picker-thumb' }, [canvas, el('div', { class: 'page-picker-label' }, `Hal. ${idx + 1}`)]);
      thumb.addEventListener('click', () => toggle(idx, thumb));
      grid.appendChild(thumb);
    });

    selectAllBtn.disabled = pageCount === 0;
    selectNoneBtn.disabled = pageCount === 0;
    updateStatus();
  }

  function toggle(idx, thumbEl) {
    if (selected.has(idx)) selected.delete(idx);
    else selected.add(idx);
    thumbEl.classList.toggle('page-picker-thumb-selected', selected.has(idx));
    updateStatus();
  }

  function selectAll() {
    selected.clear();
    grid.querySelectorAll('.page-picker-thumb').forEach((t, idx) => {
      selected.add(idx);
      t.classList.add('page-picker-thumb-selected');
    });
    updateStatus();
  }

  function selectNone() {
    selected.clear();
    grid.querySelectorAll('.page-picker-thumb').forEach((t) => t.classList.remove('page-picker-thumb-selected'));
    updateStatus();
  }

  function updateStatus() {
    runBtn.disabled = selected.size === 0;
    statusLine.textContent = pageCount
      ? `${selected.size} dari ${pageCount} halaman dipilih.`
      : 'Pilih PDF untuk menampilkan halaman.';
  }

  async function runAction() {
    runBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const indices = [...selected].sort((a, b) => a - b);
      const buf = new Uint8Array(await file.arrayBuffer());
      const { blob, filename } = await buildAndRun(buf, indices, file.name);
      resultArea.classList.remove('hidden');
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
      resultArea.append(el('div', { class: 'alert alert-success' }, '✅ Berhasil diproses.'), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal: ${err.message}`));
    } finally {
      runBtn.disabled = selected.size === 0;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, headerTitle),
      el('p', { class: 'workspace-desc' }, headerDesc),
      el('div', { class: 'privacy-badge' }, '🔒 Diproses 100% lokal di browser Anda.')
    ]),
    dropzone,
    statusLine,
    el('div', { class: 'actions' }, [selectAllBtn, selectNoneBtn]),
    grid,
    el('div', { class: 'actions' }, [runBtn]),
    resultArea
  );

  return root;
}

export function renderExtractPages() {
  return renderPageSelector({
    headerTitle: 'Ekstrak Halaman',
    headerDesc: 'Klik halaman yang ingin diambil (bisa lebih dari satu), lalu unduh sebagai dokumen baru berisi hanya halaman terpilih.',
    icon: '📑',
    hint: 'Pilih PDF untuk memilih halaman yang diambil',
    async buildAndRun(buf, indices, name) {
      if (indices.length === 0) throw new Error('Pilih minimal satu halaman.');
      const { extractPages } = await import('../../engines/pdf/organize.js');
      const result = await extractPages(buf, indices);
      return { blob: new Blob([result], { type: 'application/pdf' }), filename: suggestOutputName(name, 'halaman-terpilih.pdf') };
    }
  });
}

export function renderDeletePages() {
  return renderPageSelector({
    headerTitle: 'Hapus Halaman',
    headerDesc: 'Klik halaman yang ingin dihapus (bisa lebih dari satu), lalu unduh dokumen tanpa halaman tersebut.',
    icon: '🗑️',
    hint: 'Pilih PDF untuk memilih halaman yang dihapus',
    async buildAndRun(buf, indices, name) {
      if (indices.length === 0) throw new Error('Pilih minimal satu halaman.');
      const { deletePages } = await import('../../engines/pdf/organize.js');
      const result = await deletePages(buf, indices);
      return { blob: new Blob([result], { type: 'application/pdf' }), filename: suggestOutputName(name, 'halaman-dihapus.pdf') };
    }
  });
}
