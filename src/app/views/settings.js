import { purgeAllScratch } from '../../core/file-store.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function renderSettings({ theme, onThemeChange }) {
  const root = el('div', { class: 'workspace' });

  const themeSelect = el(
    'select',
    { class: 'field-input' },
    ['system', 'light', 'dark'].map((v) => el('option', { value: v, selected: v === theme ? '' : undefined }, v))
  );
  themeSelect.addEventListener('change', () => onThemeChange(themeSelect.value));

  const purgeButton = el(
    'button',
    {
      class: 'btn btn-secondary',
      onclick: async () => {
        purgeButton.disabled = true;
        purgeButton.textContent = 'Menghapus...';
        await purgeAllScratch();
        purgeButton.textContent = '✓ Data lokal sudah dihapus';
      }
    },
    'Hapus semua data sekarang'
  );

  root.append(
    el('div', { class: 'workspace-header' }, [el('h1', {}, 'Pengaturan')]),
    el('div', { class: 'settings-section' }, [
      el('h2', {}, 'Tampilan'),
      el('label', { class: 'field' }, [el('span', { class: 'field-label' }, 'Tema'), themeSelect])
    ]),
    el('div', { class: 'settings-section' }, [
      el('h2', {}, 'Privasi & Penyimpanan'),
      el(
        'p',
        {},
        'OpenDoc Studio tidak mengunggah file Anda ke server manapun. Sebagian besar alat memproses file sepenuhnya di memori dan tidak pernah menyentuh penyimpanan permanen. Hanya fitur batch/otomasi (jika aktif) menggunakan penyimpanan sementara di browser, yang otomatis dibersihkan.'
      ),
      purgeButton
    ]),
    el('div', { class: 'settings-section' }, [
      el('h2', {}, 'Tentang'),
      el('p', {}, 'OpenDoc Studio v0.1.0 — perangkat lunak bebas & terbuka (MIT). Lihat README.md dan ROADMAP.md di repositori untuk detail.')
    ])
  );
  return root;
}
