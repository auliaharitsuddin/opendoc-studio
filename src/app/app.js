import './styles/theme.css';
import { onRouteChange } from './router.js';
import { renderSidebar } from './sidebar.js';
import { renderHome } from './views/home.js';
import { renderSettings } from './views/settings.js';
import { renderToolWorkspace, renderComingSoon } from './components/tool-workspace.js';
import { getTool } from './tool-registry.js';
import { renderAutomation } from './views/automation.js';
import { renderDigitalSign } from './views/digital-sign.js';
import { renderMeasure } from './views/measure.js';
import { renderFormsDesigner } from './views/forms.js';
import { renderMarkup } from './views/markup.js';
import { renderEditText } from './views/edit-text.js';
import { renderFillSign } from './views/fill-sign.js';
import { renderExtractPages, renderDeletePages } from './views/page-select.js';

const CUSTOM_VIEWS = {
  automation: renderAutomation,
  'digital-sign': renderDigitalSign,
  measure: renderMeasure,
  forms: renderFormsDesigner,
  markup: renderMarkup,
  'edit-text': renderEditText,
  'fill-sign': renderFillSign,
  'extract-pages': renderExtractPages,
  'delete-pages': renderDeletePages
};

const THEME_KEY = 'opendoc-theme';

function applyTheme(theme) {
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

async function getStoredTheme() {
  const { [THEME_KEY]: theme } = await chrome.storage.local.get(THEME_KEY);
  return theme || 'system';
}

async function setStoredTheme(theme) {
  await chrome.storage.local.set({ [THEME_KEY]: theme });
  applyTheme(theme);
}

async function main() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'app-layout';
  const sidebarSlot = document.createElement('div');
  const contentSlot = document.createElement('main');
  contentSlot.className = 'app-content';
  layout.append(sidebarSlot, contentSlot);
  app.appendChild(layout);

  const theme = await getStoredTheme();
  applyTheme(theme);

  function renderContent(route) {
    contentSlot.innerHTML = '';
    if (route.name === 'home') {
      sidebarSlot.replaceChildren(renderSidebar(null));
      contentSlot.appendChild(renderHome({}));
    } else if (route.name === 'category') {
      sidebarSlot.replaceChildren(renderSidebar(route.id));
      contentSlot.appendChild(renderHome({ categoryFilter: route.id }));
    } else if (route.name === 'tool') {
      const tool = getTool(route.id);
      sidebarSlot.replaceChildren(renderSidebar(tool?.category ?? null));
      if (!tool) {
        contentSlot.appendChild(renderHome({}));
      } else if (tool.status === 'soon') {
        contentSlot.appendChild(renderComingSoon(tool));
      } else if (tool.customView && CUSTOM_VIEWS[tool.customView]) {
        contentSlot.appendChild(CUSTOM_VIEWS[tool.customView]());
      } else {
        contentSlot.appendChild(renderToolWorkspace(tool));
      }
    } else if (route.name === 'settings') {
      sidebarSlot.replaceChildren(renderSidebar(null));
      contentSlot.appendChild(
        renderSettings({
          theme,
          onThemeChange: setStoredTheme
        })
      );
    }
  }

  onRouteChange(renderContent);
}

main();
