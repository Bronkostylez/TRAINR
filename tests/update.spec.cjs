// Echte Service-Worker-Updates: V20 (aus Git-Tag v20-final) → V21, und V21 → V21.x.
const { test, expect } = require('@playwright/test');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' };
function server(mode) {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    try {
      let data;
      if (mode.v === 'v20') data = cp.execFileSync('git', ['show', `v20-final:${rel}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] });
      else {
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT)) throw new Error();
        data = fs.readFileSync(file);
        if (mode.v === 'next' && rel === 'sw.js') data = Buffer.concat([data, Buffer.from('\n// 21.0.1-test\n')]);
        if (mode.v === 'next' && rel === 'version.json') data = Buffer.from('{"version":"21.0.1"}');
      }
      res.setHeader('Content-Type', TYPES[path.extname(rel)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  return s;
}
const listen = (s, port) => new Promise(r => s.listen(port, '127.0.0.1', r));

test('Echtes Update V20 → V21: Daten migriert, alte Schlüssel unverändert, alter Cache entfernt, offline lauffähig', async ({ browser }) => {
  const mode = { v: 'v20' }, srv = server(mode); await listen(srv, 8791);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8791/');
    // V20 bedienen: Onboarding, Übung hinzufügen, Merkliste, Variante, eigene Übung
    for (let i = 0; i < 3; i++) await page.click('#setupNext');
    await page.evaluate(() => { add('gatepass'); add('oneback'); });
    await page.evaluate(() => { uiPrefs.favorites.push('oneback'); saveUI(); localStorage.setItem('trainr-adapt-v1', JSON.stringify({ gatepass: { min: 2, max: 4, minutes: 9 } })); localStorage.setItem('keeperboard-v1', '{"stage1":true}'); });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    expect(await page.evaluate(() => caches.keys())).toContain('keeperboard-v20.0.0');
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    expect(before['trainr-v2']).toBeTruthy();
    // Server liefert jetzt V21
    mode.v = 'v21';
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting, null, { timeout: 30000 });
    // V20-Oberfläche zeigt ihre Update-Leiste; Nutzer bestätigt
    await expect(page.locator('#updateBar')).toBeVisible();
    await page.click('#applyUpdate');
    await page.waitForFunction(() => window.__trainr?.version === '21.0.0', null, { timeout: 30000 });
    await expect(page.locator('section[data-view=heute]')).toBeVisible();
    const s = await page.evaluate(() => window.__trainr.store.get());
    expect(s.teams).toHaveLength(1);
    const p = s.plans.find(x => x.id === s.selectedPlanId);
    expect(p.blocks.map(b => b.exerciseId)).toEqual(['gatepass', 'oneback']);
    expect(s.exerciseMeta.oneback.favorite).toBe(true);
    expect(s.exerciseMeta.gatepass.variant.minutes).toBe(9);
    const after = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    for (const k of ['trainr-v2', 'trainr-ui-v4', 'trainr-adapt-v1', 'keeperboard-v1']) expect(after[k]).toBe(before[k]);
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['trainr-v21.0.0']);
    // Offline neu laden
    await ctx.setOffline(true);
    await page.reload();
    await expect(page.locator('section[data-view=heute]')).toBeVisible();
    expect(await page.evaluate(() => window.__trainr.version)).toBe('21.0.0');
  } finally { await ctx.close(); srv.close(); }
});

test('Update-Mechanismus V21 → V21.x: Hinweis, Schutz bei laufendem Timer, Daten bleiben', async ({ browser }) => {
  const mode = { v: 'v21' }, srv = server(mode); await listen(srv, 8792);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8792/');
    await page.fill('#wiz [name=name]', 'Upd');
    for (let i = 0; i < 4; i++) await page.click('#wiz-next');
    await page.click('dialog[open] [data-skip]');
    await page.click('#c-go');
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.waitForTimeout(400); // Speichern ist um 120 ms gebündelt
    const before = await page.evaluate(() => localStorage.getItem('trainr-v21'));
    mode.v = 'next';
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await expect(page.locator('#update-bar')).toBeVisible({ timeout: 30000 });
    // Manuelle Prüfung meldet die neue Version
    await page.evaluate(() => import('/src/ui/update.js').then(m => m.checkNow(true)));
    await expect(page.locator('#update-bar')).toBeVisible();
    // Laufendes Training blockiert das Update
    await page.click('#t-start');
    await expect(page.locator('#lv-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#upd-apply');
    await expect(page.locator('.toast')).toContainText('pausieren');
    await page.click('#lv-toggle');
    await page.click('#upd-apply');
    await page.waitForEvent('load', { timeout: 30000 });
    await expect(page.locator('section[data-view]')).toBeVisible();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('trainr-v21'))).plans).toEqual(JSON.parse(before).plans);
    const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { waiting: !!r.waiting, active: !!r.active }; });
    expect(reg).toEqual({ waiting: false, active: true });
  } finally { await ctx.close(); srv.close(); }
});
