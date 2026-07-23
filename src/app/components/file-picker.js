import { el } from './dom.js';
import { renderAllPagesToCanvases } from './pdf-canvas.js';

const PREVIEW_SCALE = 1.1;

// Stateful file-intake widget shared by every tool that needs to pick files:
// accumulates files across multiple picks/drops (instead of replacing the
// selection each time), supports per-file removal, and — when `multiple` is
// set — drag-and-drop + keyboard (↑/↓) reordering of the picked files, since
// output order (e.g. merge order) otherwise depends entirely on the OS file
// dialog's multi-select order with no way to fix a mistake.
//
// previewPdf: true adds a side panel that renders page 1 of whichever file is
// hovered/focused/clicked, so reordering (e.g. for merge) doesn't require
// guessing which filename corresponds to which document.
export function createFilePicker({
  accept = '',
  multiple = false,
  hint = '',
  icon = '📄',
  label = 'Seret file ke sini atau klik untuk memilih',
  previewPdf = false,
  onChange
} = {}) {
  let files = [];
  let locked = false;
  let dragFromIndex = null;
  const previewCache = new WeakMap(); // File -> { canvases, pageCount, error }
  let previewToken = 0;

  const fileInput = el('input', {
    type: 'file',
    accept,
    multiple: multiple ? '' : undefined,
    class: 'file-input'
  });

  const dropzone = el(
    'div',
    { class: 'dropzone', role: 'button', tabindex: '0', 'aria-label': label },
    [
      el('div', { class: 'dropzone-icon' }, icon),
      el('div', {}, label),
      el('div', { class: 'dropzone-hint' }, hint),
      fileInput
    ]
  );

  const rejectMsg = el('div', { class: 'alert alert-error hidden' });
  const fileList = el('ul', { class: 'file-list' });
  const summary = el('div', { class: 'file-summary hidden' });

  const previewPlaceholder = el(
    'div',
    { class: 'file-preview-placeholder' },
    'Arahkan kursor atau klik salah satu file untuk pratinjau seluruh halamannya.'
  );
  const previewThumb = el('div', { class: 'file-preview-thumb hidden' });
  const previewName = el('div', { class: 'file-preview-name hidden' });
  const previewMeta = el('div', { class: 'file-preview-meta hidden' });
  const previewPanel = el('div', { class: 'file-preview-panel' }, [previewPlaceholder, previewThumb, previewName, previewMeta]);

  dropzone.addEventListener('click', (e) => {
    if (locked || e.target === fileInput) return;
    fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (locked) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  ['dragover', 'dragenter'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (!locked) dropzone.classList.add('dropzone-active');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dropzone-active');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    if (locked) return;
    addFiles([...(e.dataTransfer?.files ?? [])]);
  });
  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });

  function extMatches(name) {
    const exts = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (exts.length === 0) return true;
    const lower = name.toLowerCase();
    return exts.some((ext) => lower.endsWith(ext));
  }

  function addFiles(picked) {
    const accepted = [];
    const rejected = [];
    for (const f of picked) {
      (extMatches(f.name) ? accepted : rejected).push(f);
    }
    if (rejected.length) {
      rejectMsg.textContent = `Ditolak (tipe file tidak sesuai — perlu ${accept}): ${rejected.map((f) => f.name).join(', ')}`;
      rejectMsg.classList.remove('hidden');
    } else {
      rejectMsg.classList.add('hidden');
    }

    // No dedup: picking/dropping the same file twice on purpose is valid
    // (e.g. merging or comparing a document against itself), so every
    // accepted file is appended as-is.
    if (!multiple) {
      files = accepted.slice(0, 1);
    } else {
      files.push(...accepted);
    }
    notify();
  }

  function removeAt(idx) {
    files.splice(idx, 1);
    notify();
  }

  function moveAt(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= files.length) return;
    [files[idx], files[target]] = [files[target], files[idx]];
    notify();
  }

  function notify() {
    render();
    onChange?.(files.slice());
  }

  async function showPreview(file, row) {
    fileList.querySelectorAll('.file-row-previewing').forEach((r) => r.classList.remove('file-row-previewing'));
    row.classList.add('file-row-previewing');

    const token = ++previewToken;
    previewPlaceholder.classList.add('hidden');
    previewName.textContent = file.name;
    previewMeta.textContent = 'Memuat pratinjau...';
    previewThumb.replaceChildren();
    previewName.classList.remove('hidden');
    previewMeta.classList.remove('hidden');
    previewThumb.classList.remove('hidden');

    let entry = previewCache.get(file);
    if (!entry) {
      try {
        const { canvases, pageCount } = await renderAllPagesToCanvases(file, { scale: PREVIEW_SCALE });
        entry = { canvases, pageCount, error: null };
      } catch {
        entry = { canvases: [], pageCount: 0, error: 'Gagal memuat pratinjau (file bukan PDF yang valid?).' };
      }
      previewCache.set(file, entry);
    }

    if (token !== previewToken) return; // a newer hover/click already superseded this one
    previewThumb.replaceChildren();
    if (entry.error) {
      previewMeta.textContent = entry.error;
    } else {
      entry.canvases.forEach((canvas, i) => {
        previewThumb.appendChild(el('div', { class: 'file-preview-page-label' }, `Halaman ${i + 1}`));
        previewThumb.appendChild(canvas);
      });
      previewMeta.textContent = `${entry.pageCount} halaman`;
    }
  }

  function render() {
    fileList.innerHTML = '';
    const canReorder = multiple && files.length > 1;

    files.forEach((f, idx) => {
      const row = el('li', { class: 'file-row', draggable: !locked && canReorder ? 'true' : undefined, tabindex: previewPdf ? '0' : undefined });

      if (previewPdf) {
        row.addEventListener('mouseenter', () => showPreview(f, row));
        row.addEventListener('focus', () => showPreview(f, row));
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          showPreview(f, row);
        });
      }

      if (canReorder) {
        row.addEventListener('dragstart', (e) => {
          if (locked) return;
          dragFromIndex = idx;
          e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragover', (e) => {
          if (locked) return;
          e.preventDefault();
          row.classList.add('file-row-dragover');
        });
        row.addEventListener('dragleave', () => row.classList.remove('file-row-dragover'));
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('file-row-dragover');
          if (locked || dragFromIndex === null || dragFromIndex === idx) return;
          const [moved] = files.splice(dragFromIndex, 1);
          files.splice(idx, 0, moved);
          dragFromIndex = null;
          notify();
        });
        row.addEventListener('dragend', () => {
          dragFromIndex = null;
        });
      }

      if (canReorder) {
        row.append(el('span', { class: 'file-drag-handle', title: 'Seret untuk mengurutkan' }, '⠿'));
      }
      row.append(el('span', { class: 'file-row-name' }, `${f.name} (${(f.size / 1024).toFixed(1)} KB)`));

      const actions = el('span', { class: 'file-row-actions' });
      if (canReorder) {
        actions.append(
          el(
            'button',
            { class: 'btn-icon', title: 'Naik', disabled: locked || idx === 0 ? '' : undefined, onclick: () => moveAt(idx, -1) },
            '↑'
          ),
          el(
            'button',
            {
              class: 'btn-icon',
              title: 'Turun',
              disabled: locked || idx === files.length - 1 ? '' : undefined,
              onclick: () => moveAt(idx, 1)
            },
            '↓'
          )
        );
      }
      actions.append(
        el('button', { class: 'btn-icon', title: 'Hapus', disabled: locked ? '' : undefined, onclick: () => removeAt(idx) }, '✕')
      );
      row.append(actions);

      fileList.appendChild(row);
    });

    if (files.length > 0) {
      const totalKb = (files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1);
      summary.textContent = multiple ? `${files.length} file dipilih • ${totalKb} KB total` : `${totalKb} KB`;
      summary.classList.remove('hidden');
    } else {
      summary.classList.add('hidden');
    }
  }

  function lock() {
    locked = true;
    fileInput.disabled = true;
    dropzone.classList.add('dropzone-locked');
    render();
  }

  function unlock() {
    locked = false;
    fileInput.disabled = false;
    dropzone.classList.remove('dropzone-locked');
    render();
  }

  function reset() {
    files = [];
    notify();
  }

  // With a preview panel, the dropzone moves into the left column too, so the
  // panel becomes a full-height sibling starting at the same top edge as the
  // dropzone (a plain vertical stack would otherwise push it below a
  // potentially tall file list, wasting the whole right side of the page).
  const root = previewPdf
    ? el('div', { class: 'file-picker' }, [
        el('div', { class: 'file-picker-body' }, [
          el('div', { class: 'file-list-column' }, [dropzone, rejectMsg, fileList, summary]),
          previewPanel
        ])
      ])
    : el('div', { class: 'file-picker' }, [dropzone, rejectMsg, fileList, summary]);

  return {
    root,
    getFiles: () => files.slice(),
    lock,
    unlock,
    reset
  };
}
