// Service Worker registrieren, neue Versionen erkennen und erst auf Wunsch aktivieren.
import { APP_VERSION, esc } from '../core/util.js';
import * as store from '../core/store.js';
import * as timer from '../core/timer.js';
import { toast } from './feedback.js';
import { icon } from './dom.js';

let reg = null, bar = null, reloading = false;

function showBar(version) {
  if (bar) return;
  bar = document.createElement('div');
  bar.className = 'update-bar'; bar.id = 'update-bar'; bar.setAttribute('role', 'status');
  bar.innerHTML = `${icon('sparkles')}<span class="grow"><strong>Neue Version bereit${version ? ` (${esc(version)})` : ''}.</strong><small>Deine Daten bleiben erhalten. Laufendes Training zuerst pausieren.</small></span><button class="btn sm primary" type="button" id="upd-apply">Aktualisieren</button><button class="icon-btn" type="button" id="upd-later" aria-label="Später">${icon('close')}</button>`;
  document.body.append(bar);
  bar.querySelector('#upd-later').onclick = () => { bar.remove(); bar = null; };
  bar.querySelector('#upd-apply').onclick = apply;
}

function apply() {
  if (timer.running()) { toast('Training zuerst pausieren, dann aktualisieren.'); return; }
  store.flush();
  reloading = true;
  if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

export async function checkNow(manual = false) {
  if (!navigator.onLine) { if (manual) toast('Offline. Updates brauchen eine Verbindung.'); return; }
  try {
    const r = await fetch('./version.json', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const { version } = await r.json();
    if (version !== APP_VERSION) showBar(version);
    else if (manual) toast(`TRAINR ${APP_VERSION} ist aktuell.`);
    await reg?.update();
  } catch { if (manual) toast('Update-Prüfung gerade nicht möglich. Deine Daten bleiben lokal.'); }
}

export function initUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    if (location.protocol === 'file:') toast('Offline-Modus braucht http://localhost oder https. Start: node serve.cjs');
    return;
  }
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => {
    reg = r;
    const watch = w => w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showBar(); });
    if (r.waiting && navigator.serviceWorker.controller) showBar();
    watch(r.installing);
    r.addEventListener('updatefound', () => watch(r.installing));
  }).catch(() => toast('Offline-Modus nicht verfügbar.'));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) { location.reload(); return; }
    if (hadController) showBar();
  });
  addEventListener('online', () => checkNow());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNow(); });
  setTimeout(() => checkNow(), 1500);
}
