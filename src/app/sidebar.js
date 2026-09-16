import { CATEGORIES } from './tool-registry.js';
import { t, categoryLabel, getLang, setLang } from './i18n.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

export function renderSidebar(activeCategory) {
  const nav = el('nav', { class: 'sidebar' });
  nav.appendChild(el('a', { class: 'sidebar-brand', href: '#/' }, '📄 OpenDoc Studio'));

  const home = el('a', { class: `sidebar-link${!activeCategory ? ' active' : ''}`, href: '#/' }, t('Beranda'));
  nav.appendChild(home);

  for (const cat of CATEGORIES) {
    const link = el(
      'a',
      { class: `sidebar-link${activeCategory === cat.id ? ' active' : ''}`, href: `#/category/${cat.id}` },
      categoryLabel(cat)
    );
    nav.appendChild(link);
  }

  nav.appendChild(el('a', { class: 'sidebar-link sidebar-settings', href: '#/settings' }, `⚙ ${t('Pengaturan')}`));

  const lang = getLang();
  const langToggle = el('div', { class: 'lang-toggle', role: 'group', 'aria-label': 'Language / Bahasa' }, [
    el(
      'button',
      {
        class: `lang-btn${lang === 'id' ? ' active' : ''}`,
        'data-lang': 'id',
        'aria-pressed': lang === 'id' ? 'true' : 'false',
        onclick: () => setLang('id')
      },
      'ID'
    ),
    el(
      'button',
      {
        class: `lang-btn${lang === 'en' ? ' active' : ''}`,
        'data-lang': 'en',
        'aria-pressed': lang === 'en' ? 'true' : 'false',
        onclick: () => setLang('en')
      },
      'EN'
    )
  ]);
  nav.appendChild(langToggle);
  return nav;
}
