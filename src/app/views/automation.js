import { el, renderOptionField } from '../components/dom.js';
import { createFilePicker } from '../components/file-picker.js';
import { TOOLS } from '../tool-registry.js';
import { downloadResult } from '../../core/pipeline.js';
import { t } from '../i18n.js';

// Only PDF-in / PDF-out, single-file tools can be safely chained: each step's
// output becomes the next step's input. Multi-file tools (merge, Bates) and
// tools that change format (conversions, image/archive output) can't feed
// into a generic next step, so they're excluded from the chain builder.
const CHAINABLE_TOOLS = TOOLS.filter(
  (t) => t.status === 'ready' && t.accept === '.pdf' && t.outExt === 'pdf' && !t.multiple
);

export function renderAutomation() {
  const root = el('div', { class: 'workspace' });
  const steps = []; // { tool, optionValues }
  let files = [];

  const stepsList = el('div', { class: 'automation-steps' });
  const addStepSelect = el(
    'select',
    { class: 'field-input' },
    CHAINABLE_TOOLS.map((tool) => el('option', { value: tool.id }, tool.title))
  );
  const addStepBtn = el('button', { class: 'btn btn-secondary', onclick: addStep }, `+ ${t('Tambah Langkah')}`);

  function renderSteps() {
    stepsList.innerHTML = '';
    steps.forEach((step, idx) => {
      const optionsForm = el(
        'div',
        { class: 'options-form' },
        (step.tool.options ?? []).map((opt) => renderOptionField(opt, step.optionValues))
      );
      const card = el('div', { class: 'automation-step-card' }, [
        el('div', { class: 'automation-step-header' }, [
          el('strong', {}, `${idx + 1}. ${step.tool.title}`),
          el('div', { class: 'automation-step-actions' }, [
            el('button', { class: 'btn-icon', onclick: () => moveStep(idx, -1), title: t('Naik') }, '↑'),
            el('button', { class: 'btn-icon', onclick: () => moveStep(idx, 1), title: t('Turun') }, '↓'),
            el('button', { class: 'btn-icon', onclick: () => removeStep(idx), title: t('Hapus') }, '✕')
          ])
        ]),
        optionsForm
      ]);
      stepsList.appendChild(card);
    });
    runBtn.disabled = steps.length === 0 || files.length === 0;
  }

  function addStep() {
    const tool = CHAINABLE_TOOLS.find((t) => t.id === addStepSelect.value);
    if (!tool) return;
    const optionValues = Object.fromEntries((tool.options ?? []).map((o) => [o.key, o.default]));
    steps.push({ tool, optionValues });
    renderSteps();
  }

  function moveStep(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    renderSteps();
  }

  function removeStep(idx) {
    steps.splice(idx, 1);
    renderSteps();
  }

  const filePicker = createFilePicker({
    accept: '.pdf',
    multiple: true,
    icon: '📁',
    label: t('Seret satu atau lebih PDF untuk diproses batch'),
    onChange: (picked) => {
      files = picked;
      runBtn.disabled = steps.length === 0 || files.length === 0;
    }
  });

  const progressLabel = el('div', { class: 'progress-label' });
  const resultArea = el('div', { class: 'result-area hidden' });

  const runBtn = el('button', { class: 'btn btn-primary', disabled: '', onclick: runBatch }, t('Jalankan Batch'));

  async function runBatch() {
    runBtn.disabled = true;
    filePicker.lock();
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let fi = 0; fi < files.length; fi += 1) {
        let currentFile = files[fi];
        progressLabel.textContent = `${t('File')} ${fi + 1}/${files.length}: ${currentFile.name}`;
        for (let si = 0; si < steps.length; si += 1) {
          const step = steps[si];
          progressLabel.textContent = `${t('File')} ${fi + 1}/${files.length} — ${t('Langkah')} ${si + 1}/${steps.length}: ${step.tool.title}`;
          try {
            const { blob } = await step.tool.run({ files: [currentFile], options: step.optionValues, onProgress: () => {} });
            currentFile = new File([blob], currentFile.name, { type: 'application/pdf' });
          } catch (err) {
            resultArea.classList.remove('hidden');
            resultArea.appendChild(
              el('div', { class: 'alert alert-error' }, `${t('Gagal pada')} "${currentFile.name}" ${t('di langkah')} "${step.tool.title}": ${err.message}`)
            );
            return;
          }
        }
        zip.file(currentFile.name, await currentFile.arrayBuffer());
      }

      progressLabel.textContent = t('Menyusun ZIP hasil batch...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      resultArea.classList.remove('hidden');
      const downloadBtn = el(
        'button',
        {
          class: 'btn btn-primary',
          onclick: async () => {
            downloadBtn.disabled = true;
            await downloadResult(zipBlob, 'hasil-batch.zip');
            downloadBtn.textContent = t('✓ Diunduh & dihapus dari memori');
          }
        },
        `${t('Unduh')} hasil-batch.zip (${(zipBlob.size / 1024).toFixed(1)} KB)`
      );
      resultArea.appendChild(el('div', { class: 'alert alert-success' }, `✅ ${t('Selesai memproses')} ${files.length} ${t('file')}.`));
      resultArea.appendChild(downloadBtn);
      progressLabel.textContent = '';
    } finally {
      runBtn.disabled = false;
      filePicker.unlock();
    }
  }

  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, t('Wizard Otomasi (Batch)')),
      el('p', { class: 'workspace-desc' }, t('Rangkai beberapa alat PDF menjadi satu urutan, lalu jalankan otomatis ke banyak file sekaligus.')),
      el('div', { class: 'privacy-badge' }, t('🔒 Diproses 100% lokal di browser Anda.'))
    ]),
    el('div', { class: 'automation-add-row' }, [addStepSelect, addStepBtn]),
    stepsList,
    filePicker.root,
    el('div', { class: 'actions' }, [runBtn]),
    progressLabel,
    resultArea
  );

  return root;
}
