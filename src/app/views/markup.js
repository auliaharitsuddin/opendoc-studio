import { el } from '../components/dom.js';
import { renderPdfPageToCanvas } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';

const HIGHLIGHT_COLOR = { r: 1, g: 1, b: 0 };
const INK_COLOR = { r: 0.86, g: 0.15, b: 0.15 };

export function renderMarkup() {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pageCtx = null;
  let mode = 'highlight'; // 'highlight' | 'ink' | 'sticky'
  let dragStart = null; // canvas-space [x, y]
  let inkPoints = null; // canvas-space [x, y] points while drawing
  let overlay = null;
  let overlayCtx = null;
  const items = []; // { type, pageIndex, ...engine fields, _canvas: canvas-space points for redraw }

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone-icon' }, '🖍️'),
    el('div', {}, 'Pilih PDF untuk disorot / dicoret'),
    fileInput
  ]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const highlightBtn = el('button', { class: 'btn btn-primary', onclick: () => setMode('highlight') }, '🖊️ Sorot (Highlight)');
  const inkBtn = el('button', { class: 'btn btn-secondary', onclick: () => setMode('ink') }, '✏️ Coret Tangan (Ink)');
  const stickyBtn = el('button', { class: 'btn btn-secondary', onclick: () => setMode('sticky') }, '📌 Catatan Tempel');

  const canvasStack = el('div', { class: 'canvas-stack' });
  const statusLine = el('div', { class: 'progress-label' }, 'Pilih PDF untuk mulai menandai.');
  const itemList = el('ul', { class: 'file-list' });
  const applyBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: applyAndDownload }, 'Terapkan & Unduh PDF');
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    pageCtx?.destroy?.();
    pageCtx = await renderPdfPageToCanvas(f, { pageIndex: 0, scale: 1.4 });

    canvasStack.innerHTML = '';
    canvasStack.appendChild(pageCtx.canvas);
    overlay = document.createElement('canvas');
    overlay.width = pageCtx.canvas.width;
    overlay.height = pageCtx.canvas.height;
    overlay.className = 'pdf-canvas-overlay';
    canvasStack.appendChild(overlay);
    overlayCtx = overlay.getContext('2d');

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    overlay.addEventListener('mouseleave', onMouseUp);
    overlay.addEventListener('click', onOverlayClick);

    items.length = 0;
    renderItemList();
    updateStatus();
  }

  function updateStatus() {
    statusLine.textContent =
      mode === 'sticky' ? 'Klik pada halaman untuk menambahkan catatan tempel.' : 'Klik & seret pada halaman untuk menyorot atau mencoret.';
  }

  function setMode(next) {
    mode = next;
    highlightBtn.classList.toggle('btn-primary', mode === 'highlight');
    highlightBtn.classList.toggle('btn-secondary', mode !== 'highlight');
    inkBtn.classList.toggle('btn-primary', mode === 'ink');
    inkBtn.classList.toggle('btn-secondary', mode !== 'ink');
    stickyBtn.classList.toggle('btn-primary', mode === 'sticky');
    stickyBtn.classList.toggle('btn-secondary', mode !== 'sticky');
    updateStatus();
  }

  function overlayPoint(e) {
    const rect = overlay.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onMouseDown(e) {
    if (!pageCtx) return;
    const p = overlayPoint(e);
    if (mode === 'highlight') dragStart = p;
    else inkPoints = [p];
  }

  function onMouseMove(e) {
    if (!pageCtx) return;
    if (mode === 'highlight' && dragStart) {
      const p = overlayPoint(e);
      redrawOverlay({ previewRect: [dragStart, p] });
    } else if (mode === 'ink' && inkPoints) {
      inkPoints.push(overlayPoint(e));
      redrawOverlay({ previewInk: inkPoints });
    }
  }

  function onMouseUp(e) {
    if (mode === 'highlight' && dragStart) {
      commitHighlight(dragStart, overlayPoint(e));
      dragStart = null;
    } else if (mode === 'ink' && inkPoints) {
      if (inkPoints.length > 1) commitInk(inkPoints);
      inkPoints = null;
    }
    redrawOverlay({});
  }

  function onOverlayClick(e) {
    if (mode !== 'sticky' || !pageCtx) return;
    commitSticky(overlayPoint(e));
  }

  // Canvas y grows downward, PDF y grows upward — canvasToPdfPoint (from
  // pdf-canvas.js) already accounts for the flip per point, so the PDF-space
  // bottom-left corner of a drag comes from pairing min canvasX with max
  // canvasY (the visually-lower edge maps to the smaller PDF y).
  function commitHighlight(a, b) {
    const [x1, y1] = pageCtx.canvasToPdfPoint(Math.min(a[0], b[0]), Math.max(a[1], b[1]));
    const [x2, y2] = pageCtx.canvasToPdfPoint(Math.max(a[0], b[0]), Math.min(a[1], b[1]));
    const width = x2 - x1;
    const height = y2 - y1;
    if (width < 2 || height < 2) return; // ignore accidental clicks
    items.push({ type: 'highlight', pageIndex: 0, x: x1, y: y1, width, height, color: HIGHLIGHT_COLOR, _canvas: [a, b] });
    renderItemList();
  }

  function commitInk(points) {
    const pdfPoints = points.map(([x, y]) => pageCtx.canvasToPdfPoint(x, y));
    items.push({ type: 'ink', pageIndex: 0, points: pdfPoints, color: INK_COLOR, width: 2, _canvas: points });
    renderItemList();
  }

  function commitSticky(p) {
    const text = prompt('Isi catatan tempel:', '');
    if (!text) return;
    const author = prompt('Nama penulis (opsional):', '') || '';
    const [x, y] = pageCtx.canvasToPdfPoint(p[0], p[1]);
    items.push({ type: 'sticky', pageIndex: 0, x, y, text, author, _canvas: p });
    renderItemList();
    redrawOverlay({});
  }

  function redrawOverlay({ previewRect, previewInk } = {}) {
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    for (const item of items) {
      if (item.type === 'highlight') {
        const [a, b] = item._canvas;
        overlayCtx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        overlayCtx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      } else if (item.type === 'ink') {
        drawStroke(item._canvas, '#dc2626');
      } else if (item.type === 'sticky') {
        drawStickyMarker(item._canvas);
      }
    }
    if (previewRect) {
      const [[x1, y1], [x2, y2]] = previewRect;
      overlayCtx.fillStyle = 'rgba(250, 204, 21, 0.3)';
      overlayCtx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    }
    if (previewInk) drawStroke(previewInk, '#dc2626');
  }

  function drawStickyMarker([x, y]) {
    overlayCtx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    overlayCtx.strokeStyle = '#92400e';
    overlayCtx.lineWidth = 1.5;
    overlayCtx.beginPath();
    overlayCtx.arc(x, y, 7, 0, Math.PI * 2);
    overlayCtx.fill();
    overlayCtx.stroke();
  }

  function drawStroke(points, color) {
    if (points.length < 2) return;
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = 2;
    overlayCtx.lineJoin = 'round';
    overlayCtx.lineCap = 'round';
    overlayCtx.beginPath();
    overlayCtx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) overlayCtx.lineTo(x, y);
    overlayCtx.stroke();
  }

  function renderItemList() {
    itemList.innerHTML = '';
    items.forEach((item, i) => {
      const label = item.type === 'highlight' ? 'Sorotan' : item.type === 'ink' ? 'Coretan' : `Catatan: "${item.text}"`;
      itemList.appendChild(
        el('li', {}, [`${i + 1}. ${label}  `, el('button', { class: 'btn-icon', onclick: () => removeItem(i) }, '✕')])
      );
    });
    applyBtn.disabled = items.length === 0;
  }

  function removeItem(i) {
    items.splice(i, 1);
    renderItemList();
    redrawOverlay({});
  }

  async function applyAndDownload() {
    applyBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const { applyAnnotations } = await import('../../engines/pdf/annotations.js');
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await applyAnnotations(
        buf,
        items.map(({ _canvas, ...rest }) => rest)
      );
      const blob = new Blob([result], { type: 'application/pdf' });
      const filename = suggestOutputName(file.name, 'markup.pdf');
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
      resultArea.append(el('div', { class: 'alert alert-success' }, '✅ Anotasi berhasil diterapkan.'), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal: ${err.message}`));
    } finally {
      applyBtn.disabled = false;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, 'Komentar & Markup'),
      el(
        'p',
        { class: 'workspace-desc' },
        'Sorot (highlight) teks, buat coretan tangan (ink), dan tambahkan catatan tempel — semua dengan klik langsung di atas pratinjau halaman 1. Anotasi PDF asli, terlihat di Adobe Reader/PDF viewer manapun.'
      ),
      el('div', { class: 'privacy-badge' }, '🔒 Diproses 100% lokal di browser Anda.')
    ]),
    dropzone,
    el('div', { class: 'actions' }, [highlightBtn, inkBtn, stickyBtn]),
    statusLine,
    canvasStack,
    el('h3', {}, 'Anotasi Ditambahkan'),
    itemList,
    el('div', { class: 'actions' }, [applyBtn]),
    resultArea
  );

  return root;
}
