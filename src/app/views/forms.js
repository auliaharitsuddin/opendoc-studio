import { el } from '../components/dom.js';
import { renderPdfPageToCanvas } from '../components/pdf-canvas.js';
import { downloadResult, suggestOutputName } from '../../core/pipeline.js';

const DEFAULT_SIZE = {
  text: [160, 20],
  checkbox: [16, 16],
  radio: [16, 16],
  dropdown: [160, 20]
};

export function renderFormsDesigner() {
  const root = el('div', { class: 'workspace' });
  let file = null;
  let pageCtx = null;
  const fields = []; // { type, name, x, y, width, height, options?, defaultValue? }

  const fileInput = el('input', { type: 'file', accept: '.pdf', class: 'file-input' });
  const dropzone = el('div', { class: 'dropzone' }, [
    el('div', { class: 'dropzone-icon' }, '📝'),
    el('div', {}, 'Pilih PDF untuk ditambahkan field formulir'),
    fileInput
  ]);
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const typeSelect = el('select', { class: 'field-input' }, [
    el('option', { value: 'text' }, 'Kotak Teks'),
    el('option', { value: 'checkbox' }, 'Checkbox'),
    el('option', { value: 'radio' }, 'Radio Button'),
    el('option', { value: 'dropdown' }, 'Dropdown')
  ]);
  const nameInput = el('input', { type: 'text', class: 'field-input', value: 'field1' });
  const optionsInput = el('input', { type: 'text', class: 'field-input hidden', placeholder: 'Pilihan (pisahkan koma), mis: A,B,C' });
  typeSelect.addEventListener('change', () => {
    optionsInput.classList.toggle('hidden', !['radio', 'dropdown'].includes(typeSelect.value));
  });

  const canvasWrap = el('div', { class: 'measure-canvas-wrap' });
  const statusLine = el('div', { class: 'progress-label' }, 'Muat PDF, atur jenis & nama field, lalu klik posisi pada halaman.');
  const fieldList = el('ul', { class: 'file-list' });
  const applyBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: applyAndDownload }, 'Terapkan & Unduh PDF');
  const resultArea = el('div', { class: 'result-area hidden' });

  async function loadFile(f) {
    if (!f) return;
    file = f;
    pageCtx?.destroy?.();
    pageCtx = await renderPdfPageToCanvas(f, { pageIndex: 0, scale: 1.4 });
    canvasWrap.innerHTML = '';
    canvasWrap.appendChild(pageCtx.canvas);
    pageCtx.canvas.addEventListener('click', onCanvasClick);
    fields.length = 0;
    renderFieldList();
    statusLine.textContent = 'Klik pada halaman untuk menempatkan field.';
  }

  function onCanvasClick(e) {
    if (!pageCtx) return;
    const rect = pageCtx.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const [pdfX, pdfY] = pageCtx.canvasToPdfPoint(canvasX, canvasY);
    const [w, h] = DEFAULT_SIZE[typeSelect.value];

    const type = typeSelect.value;
    const name = nameInput.value.trim() || `field${fields.length + 1}`;
    const options = optionsInput.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (type === 'radio') {
      const optionLabel = prompt('Label pilihan radio ini:', options[0] || `Pilihan${fields.length + 1}`);
      if (!optionLabel) return;
      fields.push({ type, name, pageIndex: 0, x: pdfX, y: pdfY - h, width: w, height: h, options: [optionLabel] });
    } else if (type === 'dropdown') {
      fields.push({ type, name, pageIndex: 0, x: pdfX, y: pdfY - h, width: w, height: h, options: options.length ? options : ['Opsi 1', 'Opsi 2'] });
    } else {
      fields.push({ type, name, pageIndex: 0, x: pdfX, y: pdfY - h, width: w, height: h });
    }

    drawBox(canvasX, canvasY - h * 1.4, w, h);
    renderFieldList();
  }

  function drawBox(x, y, w, h) {
    const ctx = pageCtx.canvas.getContext('2d');
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  function renderFieldList() {
    fieldList.innerHTML = '';
    fields.forEach((f, i) => {
      fieldList.appendChild(
        el('li', {}, [
          `${i + 1}. [${f.type}] ${f.name}${f.options ? ` (${f.options.join(', ')})` : ''}  `,
          el('button', { class: 'btn-icon', onclick: () => removeField(i) }, '✕')
        ])
      );
    });
    applyBtn.disabled = fields.length === 0;
  }

  function removeField(i) {
    fields.splice(i, 1);
    renderFieldList();
  }

  async function applyAndDownload() {
    applyBtn.disabled = true;
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const { addFormFields } = await import('../../engines/pdf/forms.js');
      const buf = new Uint8Array(await file.arrayBuffer());
      const result = await addFormFields(buf, fields);
      const blob = new Blob([result], { type: 'application/pdf' });
      const filename = suggestOutputName(file.name, 'formulir.pdf');
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
      resultArea.append(el('div', { class: 'alert alert-success' }, '✅ Field formulir berhasil ditambahkan.'), downloadBtn);
    } catch (err) {
      resultArea.classList.remove('hidden');
      resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal: ${err.message}`));
    } finally {
      applyBtn.disabled = false;
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, 'Perancang Formulir'),
      el('p', { class: 'workspace-desc' }, 'Field yang dibuat adalah AcroForm asli (bukan overlay) — bisa diisi di Adobe Reader atau PDF viewer manapun. Untuk radio button, klik beberapa kali dengan nama field yang sama untuk membuat beberapa pilihan.'),
      el('div', { class: 'privacy-badge' }, '🔒 Diproses 100% lokal di browser Anda.')
    ]),
    dropzone,
    el('div', { class: 'options-form' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Jenis field'), typeSelect]),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Nama field'), nameInput]),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Pilihan (radio/dropdown)'), optionsInput])
    ]),
    statusLine,
    canvasWrap,
    el('h3', {}, 'Field yang Ditambahkan'),
    fieldList,
    el('div', { class: 'actions' }, [applyBtn]),
    resultArea
  );

  return root;
}
