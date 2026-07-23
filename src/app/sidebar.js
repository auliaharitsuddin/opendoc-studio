import { CATEGORIES } from './tool-registry.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

export function renderSidebar(activeCategory) {
  const nav = el('nav', { class: 'sidebar' });
  nav.appendChild(el('a', { class: 'sidebar-brand', href: '#/' }, '📄 OpenDoc Studio'));

  const home = el('a', { class: `sidebar-link${!activeCategory ? ' active' : ''}`, href: '#/' }, 'Beranda');
  nav.appendChild(home);

  for (const cat of CATEGORIES) {
    const link = el(
      'a',
      { class: `sidebar-link${activeCategory === cat.id ? ' active' : ''}`, href: `#/category/${cat.id}` },
      cat.label
    );
    nav.appendChild(link);
  }

  nav.appendChild(el('a', { class: 'sidebar-link sidebar-settings', href: '#/settings' }, '⚙ Pengaturan'));
  return nav;
}
