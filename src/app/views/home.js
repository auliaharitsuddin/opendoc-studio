import { TOOLS, CATEGORIES } from '../tool-registry.js';

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

function toolCard(tool) {
  const card = el('a', { class: `tool-card${tool.status === 'soon' ? ' tool-card-soon' : ''}`, href: `#/tool/${tool.id}` }, [
    el('div', { class: 'tool-card-title' }, [
      tool.title,
      tool.status === 'soon' ? el('span', { class: 'badge badge-soon' }, 'Segera Hadir') : null,
      tool.status === 'beta' ? el('span', { class: 'badge badge-beta' }, 'Beta') : null
    ]),
    el('div', { class: 'tool-card-desc' }, tool.description)
  ]);
  return card;
}

export function renderHome({ categoryFilter } = {}) {
  const root = el('div', { class: 'home' });
  const search = el('input', { type: 'search', class: 'search-input', placeholder: 'Cari alat… (mis. gabung, kompres, sav, ocr)' });
  const grid = el('div', { class: 'tool-grid' });

  function renderGrid() {
    grid.innerHTML = '';
    const query = search.value.trim().toLowerCase();
    const groups = categoryFilter ? CATEGORIES.filter((c) => c.id === categoryFilter) : CATEGORIES;

    for (const cat of groups) {
      const tools = TOOLS.filter((t) => t.category === cat.id).filter(
        (t) => !query || t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
      );
      if (tools.length === 0) continue;
      grid.appendChild(el('h2', { class: 'category-heading' }, cat.label));
      const row = el('div', { class: 'tool-row' }, tools.map(toolCard));
      grid.appendChild(row);
    }
    if (!grid.children.length) {
      grid.appendChild(el('p', { class: 'empty-state' }, 'Tidak ada alat yang cocok.'));
    }
  }

  search.addEventListener('input', renderGrid);
  renderGrid();

  root.append(
    el('div', { class: 'home-header' }, [
      el('h1', {}, 'OpenDoc Studio'),
      el('p', { class: 'home-tagline' }, 'Editor, konverter, dan pengaman dokumen — 100% berjalan di browser Anda.')
    ]),
    search,
    grid
  );
  return root;
}
