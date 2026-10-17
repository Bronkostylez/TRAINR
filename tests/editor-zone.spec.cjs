// Ersteller: freie Zonen per Ziehen markieren (21.32.0). Zonen sind statisch,
// bleiben in allen Schritten gleich und erscheinen in Detail, Animation und Druck.
const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go } = require('./helpers.cjs');

const tab = (page, t) => page.locator(`[data-ed-tab=${t}]`).evaluate(b => b.click());
async function at(page, fx, fy) {
  const pitch = page.locator('#ed-pitch');
  await pitch.scrollIntoViewIfNeeded();
  const r = await pitch.boundingBox();
  return [r.x + r.width * fx, r.y + r.height * fy];
}
async function newEditor(page) {
  await go(page, '#uebungen');
  await page.click('#lib-new');
  await page.locator('[name=name]').fill('Zonen-Rondo');
  await tab(page, 'sketch');
}

test('Zone per Ziehen zeichnen, speichern, Maße bleiben erhalten', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.click('[data-tool="zone"]');
  await page.mouse.move(...await at(page, .25, .3));
  await page.mouse.down();
  await page.mouse.move(...await at(page, .4, .5), { steps: 4 });
  await page.mouse.move(...await at(page, .55, .7), { steps: 4 });
  await page.mouse.up();
  // Entwurf wurde übernommen: eine Zone mit gezogenen Maßen, ausgewählt
  const zone = page.locator('#ed-pitch .sk-token .setup-zone rect');
  await expect(zone).toHaveCount(1);
  const dims = await zone.evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  expect(dims.w).toBeGreaterThan(70); expect(dims.w).toBeLessThan(120);
  expect(dims.h).toBeGreaterThan(50); expect(dims.h).toBeLessThan(100);
  await expect(page.locator('#ed-selbar')).toContainText('Zone');
  // Speichern: Name + Material reichen
  await tab(page, 'details');
  await page.click('.mat[data-mat="Bälle"] .mat-toggle');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Zonen-Rondo');
  const c = (await state(page)).custom[0];
  expect(c.animation.items).toEqual([{ k: 'zone', w: dims.w, h: dims.h }]);
  expect(errors).toEqual([]);
});

test('Tippen setzt eine Standard-Zone, Rückgängig entfernt sie', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.click('[data-tool="zone"]');
  await page.mouse.click(...await at(page, .5, .5));
  const zone = page.locator('#ed-pitch .sk-token .setup-zone rect');
  await expect(zone).toHaveCount(1);
  expect(await zone.evaluate(r => +r.getAttribute('width'))).toBe(60);
  await page.click('#ed-undo');
  await expect(page.locator('#ed-pitch .sk-token')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Zone erscheint in Detailansicht und Druck, Animation läuft', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  // Übung mit Zone, zwei Spielern, Ball und zwei Schritten direkt in den Bestand
  await page.evaluate(() => window.__trainr.store.update('Übung', d => {
    d.custom.push({
      id: 'custom-zonentest', name: 'Zonentest', type: 'field', tag: 'Passspiel', ages: ['E-Jugend', 'D-Jugend'], min: 2, max: 4, minutes: 8,
      description: 'Aufbau. Dann weiter.', coaching: 'Selbst prüfen.', equipment: [['Bälle', 1]], url: '', custom: true,
      animation: {
        version: 2, camera: 'off',
        items: [{ k: 'a' }, { k: 'a' }, { k: 'ball' }, { k: 'zone', w: 90, h: 60 }],
        frames: [
          { seconds: 2, caption: 'Aufbau', points: [[70, 95], [250, 95], [86, 95], [160, 95]] },
          { seconds: 2, caption: 'Pass in die Zone', points: [[70, 95], [250, 95], [234, 95], [160, 95]] },
        ],
      },
    });
  }));
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('custom-zonentest'));
  await expect(page.locator('dialog[open] #d-scene .setup-zone rect')).toBeVisible();
  // Abspielen läuft mit Zone fehlerfrei durch
  await page.click('#d-play');
  await expect(page.locator('#d-play[aria-pressed="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  // Druck (Kartenset) enthält die Zone
  const html = await page.evaluate(async () => {
    window.__trainr.store.update('Plan', d => { d.plans.find(p => p.id === d.selectedPlanId).blocks.push({ id: 'zb1', exerciseId: 'custom-zonentest', minutes: 8 }); });
    const m = await import('/src/exports/sheet.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get();
    return m.printHtml(s, P.currentPlan(s), 'cardset', 'brand');
  });
  expect(html).toContain('setup-zone');
  expect(html).toContain('Zonentest');
  expect(errors).toEqual([]);
});
