// Einheit per Link teilen und empfangen (21.30.0). Ohne Server: Daten stecken im Adress-Fragment.
const { test, expect } = require('@playwright/test');
const { onboard, watchErrors } = require('./helpers.cjs');

async function seedPlan(page) {
  await page.evaluate(() => window.__trainr.store.update('Sample', s => {
    const p = s.plans.find(x => x.id === s.selectedPlanId);
    p.name = 'Link-Test'; p.people = 10; p.blocks = [{ id: 'a', exerciseId: 'gatepass', minutes: 10 }, { id: 'b', exerciseId: 'v5-scan', minutes: 10, coachSupport: false }, { id: 'c', exerciseId: '2v2', minutes: 15 }];
  }));
}
const makeLink = page => page.evaluate(async () => (await import('/src/exports/share.js')).planLink(window.__trainr.store.get().selectedPlanId));
// Gleiche Adresse mit anderem Fragment lädt nicht neu – über eine leere Seite erzwingen.
async function openFresh(page, url) { await page.goto('about:blank'); await page.goto(url); }

test('Link erzeugen, öffnen, bestätigen, Einheit landet im Empfänger', async ({ page, browser }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedPlan(page);
  const url = await makeLink(page);
  expect(url).toContain('#plan=');
  expect(url.length).toBeLessThan(6000);
  // Empfänger: eigener Kontext mit eigenem Speicherstand
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  const p2 = await ctx2.newPage(); const errors2 = watchErrors(p2);
  await p2.goto(url);
  await p2.fill('#wiz [name=name]', 'E1'); await p2.locator('#wiz [name=type][value=field]').check({ force: true });
  await p2.click('#wiz-next'); await p2.locator('#wiz [name=age][value="E-Jugend"]').check({ force: true });
  await p2.click('#wiz-next'); await p2.click('#wiz-next'); await p2.click('#wiz-next');
  for (let i = 0; i < 20; i++) {
    const top = p2.locator('dialog[open]').last(); // oberstes Sheet: Empfang oder Tour
    if (await top.count()) {
      if (((await top.textContent()) || '').includes('Einheit erhalten')) break;
      const skip = top.locator('[data-skip]');
      if (await skip.count()) { await skip.click(); await p2.waitForTimeout(200); continue; }
    }
    await p2.waitForTimeout(300);
  }
  const dlg = p2.locator('dialog[open]').last();
  await expect(dlg).toContainText('Einheit erhalten');
  await expect(dlg).toContainText('Link-Test');
  await expect(dlg).toContainText('3 Übungen');
  await dlg.locator('button', { hasText: 'Importieren' }).click();
  await expect.poll(() => p2.evaluate(() => window.__trainr.store.get().plans.some(p => p.name === 'Link-Test'))).toBe(true);
  const imported = await p2.evaluate(() => window.__trainr.store.get().plans.find(p => p.name === 'Link-Test'));
  expect(imported.blocks.map(b => b.exerciseId)).toEqual(['gatepass', 'v5-scan', '2v2']);
  expect(imported.blocks[1].coachSupport).toBe(false);
  expect(await p2.evaluate(() => window.__trainr.store.get().plans.length)).toBeGreaterThan(1);
  await ctx2.close();
  expect(errors).toEqual([]); expect(errors2).toEqual([]);
});

test('Abbrechen schreibt nichts; ungültiger Link gibt eine Meldung', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedPlan(page);
  const url = await makeLink(page);
  const before = await page.evaluate(() => window.__trainr.store.get().plans.length);
  await openFresh(page, url);
  await expect(page.locator('dialog[open]')).toContainText('Einheit erhalten');
  await page.locator('dialog[open] button', { hasText: 'Abbrechen' }).click();
  expect(await page.evaluate(() => window.__trainr.store.get().plans.length)).toBe(before);
  await openFresh(page, url.replace(/#plan=.*$/, '#plan=kaputt123'));
  await expect(page.locator('.toasts')).toContainText('ungültig');
  expect(errors).toEqual([]);
});

test('Empfangene Einheit ist auf Englisch übersetzt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedPlan(page);
  const url = await makeLink(page);
  await page.evaluate(() => { window.__trainr.store.setting('lang', 'en'); });
  await openFresh(page, url);
  await expect(page.locator('dialog[open]')).toContainText('Session received');
  await page.locator('dialog[open] button', { hasText: 'Import' }).click();
  await expect.poll(() => page.evaluate(() => window.__trainr.store.get().plans.some(p => p.name === 'Link-Test'))).toBe(true);
  expect(errors).toEqual([]);
});
