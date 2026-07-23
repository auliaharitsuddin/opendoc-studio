export function parseRoute(hash) {
  const path = (hash || '#/').replace(/^#/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'category' && parts[1]) return { name: 'category', id: parts[1] };
  if (parts[0] === 'tool' && parts[1]) return { name: 'tool', id: parts[1] };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function onRouteChange(callback) {
  window.addEventListener('hashchange', () => callback(parseRoute(location.hash)));
  callback(parseRoute(location.hash));
}
