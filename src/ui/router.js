// Hash-Router mit Bottom-Tabs. Jede Ansicht ist ein Modul { id, title, tab, render(root, params), refresh?(), leave?() }.
import { $, $$ } from './dom.js';
import { closeAll } from './sheet.js';

const views = new Map();
let current = null, currentRoot = null, guard = null;
export const TAB_ORDER = ['heute', 'uebungen', 'planen', 'training', 'mehr'];
// Alte V20-Adressen (Manifest-Shortcuts, Lesezeichen) bleiben gültig.
const ALIASES = { plan: 'planen', profil: 'mehr', '': 'heute' };

export function register(view) { views.set(view.id, view); }
export const currentView = () => current;
/** Ein Wächter kann Navigation umleiten (z. B. Onboarding ohne Mannschaft). */
export function setGuard(fn) { guard = fn; }

export function parse(hash = location.hash) {
  const [name, ...rest] = decodeURIComponent(hash.replace(/^#\/?/, '')).split('/');
  const id = ALIASES[name] ?? name;
  return { id: views.has(id) ? id : 'heute', params: rest };
}

export function go(id, ...params) {
  const hash = '#' + [id, ...params].map(encodeURIComponent).join('/');
  // Offene Sheets haben einen eigenen History-Eintrag; der wird durch die neue Adresse ersetzt.
  const hadSheets = closeAll() > 0;
  if (location.hash === hash) { show(parse(hash)); return; }
  if (hadSheets) { history.replaceState(null, '', hash); show(parse(hash)); } else location.hash = hash;
}

export function show({ id, params }) {
  if (guard) { const redirect = guard(id); if (redirect && redirect !== id) { id = redirect; params = []; history.replaceState(history.state, '', '#' + id); } }
  const view = views.get(id);
  const prev = current;
  if (prev && prev.leave) prev.leave();
  closeAll();
  const main = $('#main');
  const dir = prev && TAB_ORDER.indexOf(view.tab) < TAB_ORDER.indexOf(prev.tab) ? 'back' : 'fwd';
  const root = document.createElement('section');
  root.className = 'view'; root.dataset.view = id; root.dataset.dir = dir;
  root.setAttribute('aria-labelledby', `h-${id}`);
  main.replaceChildren(root);
  current = view; currentRoot = root;
  document.body.dataset.view = id;
  view.render(root, params);
  document.title = `${view.title} · TRAINR`;
  $('#appbar-title').textContent = view.title;
  syncTabs(view.tab);
  if (prev && prev !== view) scrollTo({ top: 0, behavior: 'instant' });
  const h = root.querySelector('h1');
  if (prev && h) { h.id ||= `h-${id}`; h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

/** Aktuelle Ansicht nach Datenänderung aktualisieren (ohne Navigation). */
export function refresh(reason) {
  if (!current) return;
  if (current.refresh) current.refresh(reason);
  else { const y = scrollY; current.render(currentRoot, parse().params); scrollTo({ top: y, behavior: 'instant' }); }
}

function syncTabs(tab) {
  const i = TAB_ORDER.indexOf(tab);
  $$('.tab').forEach(t => t.dataset.tab === tab ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current'));
  $('.tabbar')?.style.setProperty('--tab', Math.max(0, i));
  $('.tabbar').hidden = tab === null;
}

export function start() {
  addEventListener('hashchange', () => show(parse()));
  show(parse());
}
