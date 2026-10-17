// TRAINR Service Worker. Precache der App-Hülle; neue Versionen warten, bis der Nutzer aktualisiert.
const VERSION = '21.30.2';
const CACHE = 'trainr-v' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable.png',
  './src/core/assistant.js','./src/core/calendar.js','./src/core/storage.js','./src/core/persist.js','./src/core/planning.js','./src/core/schema.js','./src/core/season.js','./src/core/store.js','./src/core/timer.js','./src/core/util.js','./src/data/drill-meta.js','./src/data/drills.js','./src/data/focus.js','./src/data/flow.js','./src/data/variants.js','./src/data/coach-roles.js','./src/i18n/catalog-en-1.js','./src/i18n/catalog-en-2.js','./src/i18n/catalog-en-3.js','./src/i18n/catalog-en-4.js','./src/i18n/catalog-en-5.js','./src/i18n/catalog-en-6.js','./src/i18n/catalog-en-tags.js','./src/i18n/catalog-en.js','./src/i18n/catalog.js','./src/i18n/en-calendar.js','./src/i18n/en-core.js','./src/i18n/en-detail.js','./src/i18n/en-export.js','./src/i18n/en-help.js','./src/i18n/en-library.js','./src/i18n/en-matchday.js','./src/i18n/en-flow.js','./src/i18n/en-misc.js','./src/i18n/en-more.js','./src/i18n/en-onboarding.js','./src/i18n/en-plan.js','./src/i18n/en-scenes.js','./src/i18n/en-season.js','./src/i18n/en-today.js','./src/i18n/en-goalie.js','./src/i18n/en.js','./src/i18n/index.js','./src/exports/images.js','./src/exports/doc.js','./src/exports/pdf.js','./src/exports/share.js','./src/exports/sheet.js','./src/main.js','./src/scene/motion.js','./src/scene/pitch.js','./src/scene/player.js','./src/scene/scripts.js','./src/ui/actions.js','./src/ui/dom.js','./src/ui/feedback.js','./src/ui/focus.js','./src/ui/help.js','./src/ui/material.js','./src/ui/motion.js','./src/ui/reminders.js','./src/ui/router.js','./src/ui/season.js','./src/ui/sheet.js','./src/ui/speech.js','./src/ui/sortable.js','./src/ui/update.js','./src/views/week.js','./src/views/assistant.js','./src/views/blocks.js','./src/views/calendar.js','./src/views/detail.js','./src/views/editor.js','./src/views/library.js','./src/views/matchday.js','./src/views/squad.js','./src/views/more.js','./src/views/onboarding.js','./src/views/plan.js','./src/views/tactics.js','./src/views/today.js','./src/views/training.js','./styles/app.css','./styles/print.css','./styles/tokens.css','./styles/fonts/archivo.woff2'];

self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('keeperboard-') || k.startsWith('trainr-')) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.endsWith('/version.json')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
      try { return await fetch(req); } catch { return Response.error(); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch { return Response.error(); }
  })());
});

// Erinnerung angetippt: vorhandenes TRAINR-Fenster nach vorne holen und den Termin öffnen.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './#kalender', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.startsWith(self.registration.scope));
    if (win) { win.postMessage({ type: 'open-event', id: url.split('/termin/')[1] || null }); return win.focus(); }
    return self.clients.openWindow(url);
  }));
});
