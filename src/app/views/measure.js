import { el } from '../components/dom.js';
import { renderPdfPageToCanvas } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';

const UNIT_LABELS = { cm: 'cm', m: 'm', in: 'inci', ft: 'kaki' };

export function renderMeasure() {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pageCtx = null; // { canvas, canvasToPdfPoint, pageWidth, pageHeight }
  let scalePxPerUnit = null;
  let unit = 'cm';
  let mode = 'calibrate'; // 'calibrate' | 'distance' | 'area'
  let pendingClicks = [];
  const measurements = []; // { points: [[pdfX,pdfY],...], label, type }

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone-icon' }, '📐'),
    el('div', {}, 'Pilih PDF (gambar teknik/denah) untuk diukur'),
    fileInput
  ]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const canvasWrap = el('div', { class: 'measure-canvas-wrap' });
  const statusLine = el('div', { class: 'progress-label' }, 'Muat PDF untuk mulai kalibrasi.');
  const calibrateBtn = el('button', { class: 'btn btn-secondary', onclick: () => setMode('calibrate') }, '1. Kalibrasi Skala');
  const distanceBtn = el('button', { class: 'btn btn-secondary', disabled: '', onclick: () => setMode('distance') }, 'Ukur Jarak');
  const areaBtn = el('button', { class: 'btn btn-secondary', disabled: '', onclick: () => setMode('area') }, 'Ukur Luas');
  const finishPolygonBtn = el('button', { class: 'btn btn-secondary hidden', onclick: finishPolygon }, 'Selesai Poligon');
  const measurementList = el('ul', { class: 'file-list' });
  const exportBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: exportPdf }, 'Ekspor PDF Beranotasi');
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    pageCtx?.destroy?.();
    statusLine.textContent = 'Merender halaman...';
    pageCtx = await renderPdfPageToCanvas(f, { pageIndex: 0, scale: 1.4 });
    canvasWrap.innerHTML = '';
    canvasWrap.appendChild(pageCtx.canvas);
    pageCtx.canvas.addEventListener('click', onCanvasClick);
    scalePxPerUnit = null;
    measurements.length = 0;
    renderMeasurementList();
    setMode('calibrate');
    statusLine.textContent = 'Klik dua titik pada gambar untuk kalibrasi skala.';
  }

  function setMode(next) {
    mode = next;
    pendingClicks = [];
    finishPolygonBtn.classList.toggle('hidden', mode !== 'area');
    if (mode === 'calibrate') statusLine.textContent = 'Klik dua titik yang jaraknya Anda ketahui di dunia nyata.';
    if (mode === 'distance') statusLine.textContent = 'Klik dua titik untuk mengukur jarak.';
    if (mode === 'area') statusLine.textContent = 'Klik setiap sudut poligon, lalu tekan "Selesai Poligon".';
  }

  function onCanvasClick(e) {
    if (!pageCtx) return;
    const rect = pageCtx.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const pdfPoint = pageCtx.canvasToPdfPoint(canvasX, canvasY);
    drawDot(canvasX, canvasY);
    pendingClicks.push(pdfPoint);

    if (mode === 'calibrate' && pendingClicks.length === 2) {
      const pixelDist = Math.hypot(pendingClicks[1][0] - pendingClicks[0][0], pendingClicks[1][1] - pendingClicks[0][1]);
      const realDistanceStr = prompt('Berapa jarak sebenarnya antara dua titik ini?', '100');
      const realDistance = parseFloat(realDistanceStr);
      if (realDistance > 0) {
        scalePxPerUnit = pixelDist / realDistance;
        statusLine.textContent = `Kalibrasi selesai: 1 ${UNIT_LABELS[unit]} ≈ ${scalePxPerUnit.toFixed(2)} pt PDF.`;
        distanceBtn.disabled = false;
        areaBtn.disabled = false;
      } else {
        statusLine.textContent = 'Kalibrasi dibatalkan (jarak tidak valid).';
      }
      pendingClicks = [];
    } else if (mode === 'distance' && pendingClicks.length === 2) {
      const pixelDist = Math.hypot(pendingClicks[1][0] - pendingClicks[0][0], pendingClicks[1][1] - pendingClicks[0][1]);
      const realDist = scalePxPerUnit ? pixelDist / scalePxPerUnit : pixelDist;
      const label = `${realDist.toFixed(2)} ${UNIT_LABELS[unit]}`;
      measurements.push({ points: [...pendingClicks], label, type: 'distance' });
      renderMeasurementList();
      pendingClicks = [];
    }
  }

  function finishPolygon() {
    if (pendingClicks.length < 3) {
      statusLine.textContent = 'Butuh minimal 3 titik untuk poligon.';
      return;
    }
    const pixelArea = shoelace(pendingClicks);
    const realArea = scalePxPerUnit ? pixelArea / (scalePxPerUnit * scalePxPerUnit) : pixelArea;
    const label = `${realArea.toFixed(2)} ${UNIT_LABELS[unit]}²`;
    measurements.push({ points: [...pendingClicks], label, type: 'area' });
    renderMeasurementList();
    pendingClicks = [];
  }

  function shoelace(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }

  function drawDot(x, y) {
    const ctx = pageCtx.canvas.getContext('2d');
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderMeasurementList() {
    measurementList.innerHTML = '';
    measurements.forEach((m, i) => {
      measurementList.appendChild(el('li', {}, `${i + 1}. [${m.type === 'area' ? 'Luas' : 'Jarak'}] ${m.label}`));
    });
    exportBtn.disabled = measurements.length === 0;
  }

  async function exportPdf() {
    exportBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const { stampMeasurements } = await import('../../engines/pdf/measure.js');
      const buf = new Uint8Array(await file.arrayBuffer());
      const stamped = await stampMeasurements(
        buf,
        measurements.map((m) => ({ pageIndex: 0, points: m.points, label: m.label, type: m.type }))
      );
      const blob = new Blob([stamped], { type: 'application/pdf' });
      const filename = suggestOutputName(file.name, 'terukur.pdf');
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
      resultArea.append(el('div', { class: 'alert alert-success' }, '✅ Anotasi pengukuran siap diunduh.'), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal: ${err.message}`));
    } finally {
      exportBtn.disabled = false;
    }
  }

  const unitSelect = el(
    'select',
    { class: 'field-input' },
    Object.entries(UNIT_LABELS).map(([value, label]) => el('option', { value }, label))
  );
  unitSelect.addEventListener('change', () => {
    unit = unitSelect.value;
  });

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, 'Alat Ukur'),
      el('p', { class: 'workspace-desc' }, 'Kalibrasi skala gambar berdasarkan satu jarak yang Anda ketahui, lalu ukur jarak/luas lainnya. Hasil bisa diekspor sebagai PDF beranotasi.'),
      el('div', { class: 'privacy-badge' }, '🔒 Diproses 100% lokal di browser Anda.')
    ]),
    dropzone,
    el('div', { class: 'options-form' }, [el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Satuan'), unitSelect])]),
    el('div', { class: 'actions' }, [calibrateBtn, distanceBtn, areaBtn, finishPolygonBtn]),
    statusLine,
    canvasWrap,
    el('h3', {}, 'Daftar Pengukuran'),
    measurementList,
    el('div', { class: 'actions' }, [exportBtn]),
    resultArea
  );

  return root;
}
