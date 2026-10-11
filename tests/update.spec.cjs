// Echte Service-Worker-Updates innerhalb von V21.
const { test, expect } = require('@playwright/test');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' };
function server(mode) {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    try {
      let data;
      {
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT)) throw new Error();
        data = fs.readFileSync(file);
        if (mode.v === 'next' && rel === 'sw.js') data = Buffer.concat([data, Buffer.from('\n// 21.3.1-test\n')]);
        if (mode.v === 'next' && rel === 'version.json') data = Buffer.from('{"version":"21.3.1"}');
      }
      res.setHeader('Content-Type', TYPES[path.extname(rel)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  return s;
}
const listen = (s, port) => new Promise(r => s.listen(port, '127.0.0.1', r));

test('Update-Mechanismus V21 → V21.x: Hinweis, Schutz bei laufendem Timer, Daten bleiben', async ({ browser }) => {
  const mode = { v: 'v21' }, srv = server(mode); await listen(srv, 8792);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:8792/');
    await page.fill('#wiz [name=name]', 'Upd');
    for (let i = 0; i < 4; i++) await page.click('#wiz-next');
    await page.click('dialog[open] [data-skip]');
    await page.click('#c-go');
    const sheet = page.locator('dialog[open].sheet');
    await sheet.locator('.proposal-item').first().waitFor();
    await sheet.locator('[data-apply="new"]').click();
    await page.locator('.tl-item').first().waitFor();
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
