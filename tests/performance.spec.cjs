// Leistung unter Drosselung (CDP, nur Chromium). Ergebnisse in test-results/perf.json; großzügige Grenzwerte.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const { onboard, createSession, go } = require('./helpers.cjs');

test('Gedrosselt (CPU 4×, Slow 4G): Start, Ansichtswechsel, Scrollen der Bibliothek', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = {};
  let t0 = Date.now();
  await page.goto('/');
  await page.locator('#wiz').waitFor();
  r.firstVisitInteractiveMs = Date.now() - t0;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await onboard(page);
  await createSession(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  t0 = Date.now();
  await page.reload();
  await page.locator('section[data-view=heute] .hero').waitFor();
  r.repeatVisitInteractiveMs = Date.now() - t0;
  const nav = await page.evaluate(() => { const e = performance.getEntriesByType('navigation')[0]; return { domContentLoaded: Math.round(e.domContentLoadedEventEnd), load: Math.round(e.loadEventEnd), transfer: e.transferSize }; });
  r.repeatNavigation = nav;
  for (const v of ['uebungen', 'planen', 'training', 'heute']) {
    t0 = Date.now();
    await go(page, '#' + v);
    await page.locator(`section[data-view=${v}]`).waitFor();
    r[`switch_${v}_ms`] = Date.now() - t0;
  }
  await go(page, '#uebungen');
  await page.locator('#lib-grid .drill').first().waitFor();
  r.libraryCards = await page.locator('#lib-grid .drill').count();
  const frames = await page.evaluate(async () => {
    const d = []; let last = performance.now(), run = true;
    const loop = t => { d.push(t - last); last = t; if (run) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    for (let i = 0; i < 40; i++) { scrollBy(0, 120); await new Promise(r => setTimeout(r, 50)); }
    run = false; d.sort((a, b) => a - b);
    return { frames: d.length, medianMs: Math.round(d[Math.floor(d.length / 2)] * 10) / 10, p95Ms: Math.round(d[Math.floor(d.length * .95)] * 10) / 10 };
  });
  r.libraryScrollThrottled = frames;
  t0 = Date.now();
  await page.locator('#lib-grid .drill h3').first().click();
  await page.locator('dialog[open] #d-scene svg').waitFor();
  r.openDetailMs = Date.now() - t0;
  fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'test-results', 'perf.json'), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 2));
  expect(r.repeatVisitInteractiveMs).toBeLessThan(6000);
  expect(r.firstVisitInteractiveMs).toBeLessThan(15000);
  expect(frames.medianMs).toBeLessThan(60);
});
