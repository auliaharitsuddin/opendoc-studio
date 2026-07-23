import { downloadResult, suggestOutputName } from '../../core/pipeline.js';
import { el, renderOptionField } from './dom.js';
import { createFilePicker } from './file-picker.js';

export function renderToolWorkspace(tool) {
  const root = el('div', { class: 'workspace' });
  const optionValues = Object.fromEntries((tool.options ?? []).map((o) => [o.key, o.default]));
  let selectedFiles = [];
  const session = { objectUrls: [] };

  const header = el('div', { class: 'workspace-header' }, [
    el('h1', {}, tool.title),
    el('p', { class: 'workspace-desc' }, tool.description),
    el('div', { class: 'privacy-badge' }, '🔒 Diproses 100% lokal di browser Anda — tidak ada file yang diunggah.')
  ]);

  const filePicker = createFilePicker({
    accept: tool.accept || '',
    multiple: !!tool.multiple,
    hint: tool.accept ? `Tipe file: ${tool.accept}` : '',
    previewPdf: !!tool.previewPdf,
    onChange: (files) => {
      selectedFiles = files;
      runButton.disabled = selectedFiles.length === 0;
    }
  });

  const optionsForm = el(
    'div',
    { class: 'options-form' },
    (tool.options ?? []).map((opt) => renderOptionField(opt, optionValues))
  );

  const progressBar = el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill' })]);
  const progressLabel = el('div', { class: 'progress-label' });
  const progressWrap = el('div', { class: 'progress-wrap hidden' }, [progressLabel, progressBar]);

  const resultArea = el('div', { class: 'result-area hidden' });

  const runButton = el(
    'button',
    {
      class: 'btn btn-primary',
      disabled: '',
      onclick: () => handleRun()
    },
    'Proses'
  );
  const resetButton = el('button', { class: 'btn btn-secondary', onclick: () => location.reload() }, 'Mulai Baru');

  async function handleRun() {
    if (selectedFiles.length === 0) return;
    runButton.disabled = true;
    filePicker.lock();
    progressWrap.classList.remove('hidden');
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';
    setProgress(0, 'Memproses...');

    try {
      const { blob, filename } = await tool.run({
        files: selectedFiles,
        options: optionValues,
        onProgress: (percent, message) => setProgress(percent ?? 0, message || 'Memproses...')
      });
      setProgress(100, 'Selesai');
      showResult(blob, filename ?? suggestOutputName(selectedFiles[0].name, tool.outExt || 'bin'));
    } catch (err) {
      showError(err);
    } finally {
      runButton.disabled = false;
      filePicker.unlock();
    }
  }

  function setProgress(percent, message) {
    progressBar.querySelector('.progress-fill').style.width = `${Math.max(0, Math.min(100, percent))}%`;
    progressLabel.textContent = message;
  }

  function showError(err) {
    console.error('[OpenDoc Studio] tool run failed:', err);
    resultArea.classList.remove('hidden');
    resultArea.appendChild(el('div', { class: 'alert alert-error' }, `Gagal: ${err.message || err}`));
  }

  function showResult(blob, filename) {
    resultArea.classList.remove('hidden');
    const url = URL.createObjectURL(blob);
    session.objectUrls.push(url);
    const sizeKb = (blob.size / 1024).toFixed(1);

    const downloadBtn = el(
      'button',
      {
        class: 'btn btn-primary',
        onclick: async () => {
          downloadBtn.disabled = true;
          downloadBtn.textContent = 'Mengunduh...';
          await downloadResult(blob, filename);
          downloadBtn.textContent = '✓ Diunduh & dihapus dari memori';
          filePicker.reset();
          session.objectUrls.forEach((u) => URL.revokeObjectURL(u));
          session.objectUrls = [];
        }
      },
      `Unduh ${filename} (${sizeKb} KB)`
    );

    resultArea.appendChild(el('div', { class: 'alert alert-success' }, '✅ Berhasil diproses.'));
    resultArea.appendChild(downloadBtn);
    resultArea.appendChild(el('div', { class: 'wipe-note' }, 'File akan dihapus dari memori browser segera setelah diunduh.'));
  }

  root.append(
    header,
    filePicker.root,
    optionsForm,
    el('div', { class: 'actions' }, [runButton, resetButton]),
    progressWrap,
    resultArea
  );

  return root;
}

export function renderComingSoon(tool) {
  const root = el('div', { class: 'workspace' });
  root.append(
    el('div', { class: 'workspace-header' }, [
      el('h1', {}, tool.title),
      el('span', { class: 'badge badge-soon' }, 'Segera Hadir')
    ]),
    el('p', { class: 'workspace-desc' }, tool.description),
    el('p', { class: 'coming-soon-note' }, 'Fitur ini ada di roadmap OpenDoc Studio dan belum aktif pada versi ini. Lihat ROADMAP.md di repositori untuk detail rencana dan cara berkontribusi.')
  );
  return root;
}
