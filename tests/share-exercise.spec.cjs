// Einzelne eigene Uebung teilen und empfangen (21.37.0): Datei und Link, ohne Server.
// Spiegelt den Plan-Teilen-Fluss (21.30.0) auf Ebene einer Uebung.
const { test, expect } = require('@playwright/test');
const { onboard, watchErrors } = require('./helpers.cjs');

const EX = {
  id: 'custom-teilen', name: 'Teil-Rondo', type: 'field', tag: 'Passspiel', ages: ['E-Jugend'], min: 3, max: 6, minutes: 10,
  description: 'Aufbau. Dann weiter.', coaching: 'Selbst pruefen.', equipment: [['Bälle', 1], ['Hütchen', 4]], url: '', custom: true,
  animation: {
    version: 2, camera: 'off',
    items: [{ k: 'a' }, { k: 'a' }, { k: 'ball' }, { k: 't' }, { k: 'zone', w: 90, h: 60 }],
    frames: [
      { seconds: 2, caption: 'Aufbau', points: [[70, 95], [250, 95], [86, 95], [160, 140], [160, 95]], arrows: [{ k: 'run', p: [70, 85, 150, 60] }] },
      { seconds: 2, caption: 'Weiter', points: [[150, 60], [250, 95], [234, 95], [240, 140], [160, 95]], arrows: [{ k: 'pass', p: [234, 95, 165, 95] }] },
    ],
  },
};
async function seedExercise(page) {
  await page.evaluate(ex => window.__trainr.store.update('Uebung', d => { d.custom.push(ex); }), EX);
}
const makeLink = page => page.evaluate(async () => (await import('/src/exports/share.js')).exerciseLink('custom-teilen'));
async function openFresh(page, url) { await page.goto('about:blank'); await page.goto(url); }

test('Link erzeugen, oeffnen, bestaetigen, Uebung landet im Empfaenger', async ({ page, browser }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedExercise(page);
  const url = await makeLink(page);
  expect(url).toContain('#exercise=');
  expect(url.length).toBeLessThan(6000);
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  const p2 = await ctx2.newPage(); const errors2 = watchErrors(p2);
  await p2.goto(url);
  await p2.fill('#wiz [name=name]', 'E1'); await p2.locator('#wiz [name=type][value=field]').check({ force: true });
  await p2.click('#wiz-next'); await p2.locator('#wiz [name=age][value="E-Jugend"]').check({ force: true });
  await p2.click('#wiz-next'); await p2.click('#wiz-next'); await p2.click('#wiz-next');
  for (let i = 0; i < 20; i++) {
    const top = p2.locator('dialog[open]').last();
    if (await top.count()) {
      if (((await top.textContent()) || '').includes('Übung erhalten')) break;
      const skip = top.locator('[data-skip]');
      if (await skip.count()) { await skip.click(); await p2.waitForTimeout(200); continue; }
    }
    await p2.waitForTimeout(300);
  }
  const dlg = p2.locator('dialog[open]').last();
  await expect(dlg).toContainText('Übung erhalten');
  await expect(dlg).toContainText('Teil-Rondo');
  await dlg.locator('button', { hasText: 'Importieren' }).click();
  await expect.poll(() => p2.evaluate(() => window.__trainr.store.get().custom.some(c => c.name === 'Teil-Rondo'))).toBe(true);
  const got = await p2.evaluate(() => window.__trainr.store.get().custom.find(c => c.name === 'Teil-Rondo'));
  expect(got.id).not.toBe('custom-teilen'); // neue eigene ID
  expect(got.animation.items).toEqual(EX.animation.items); // Zone + Trainer bleiben
  expect(got.animation.frames[0].arrows).toEqual(EX.animation.frames[0].arrows); // Pfeile bleiben
  expect(got.equipment).toEqual(EX.equipment);
  await ctx2.close();
  expect(errors).toEqual([]); expect(errors2).toEqual([]);
});

test('Abbrechen schreibt nichts; ungueltiger Link gibt eine Meldung', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedExercise(page);
  const url = await makeLink(page);
  const before = await page.evaluate(() => window.__trainr.store.get().custom.length);
  await openFresh(page, url);
  await expect(page.locator('dialog[open]')).toContainText('Übung erhalten');
  await page.locator('dialog[open] button', { hasText: 'Abbrechen' }).click();
  expect(await page.evaluate(() => window.__trainr.store.get().custom.length)).toBe(before);
  await openFresh(page, url.replace(/#exercise=.*$/, '#exercise=kaputt123'));
  await expect(page.locator('.toasts')).toContainText('ungültig');
  expect(errors).toEqual([]);
});

test('Detailansicht bietet Datei- und Link-Teilen an', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await seedExercise(page);
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('custom-teilen'));
  await page.locator('dialog[open] #d-share').scrollIntoViewIfNeeded();
  await page.click('dialog[open] #d-share');
  const sheet = page.locator('dialog[open]').last();
  await expect(sheet).toContainText('Teil-Rondo');
  await expect(sheet).toContainText('Als Datei teilen');
  await expect(sheet).toContainText('Als Link teilen');
  expect(errors).toEqual([]);
});

test('Import per Funktion: ungueltige Datei wird abgelehnt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  const r = await page.evaluate(async () => {
    const m = await import('/src/exports/share.js');
    const out = {};
    try { m.importSharedExercise({ kind: 'trainr-exercise', version: 1, exercise: { name: '' } }); } catch (e) { out.empty = e.message; }
    try { m.importSharedExercise({ kind: 'trainr-plan', version: 1 }); } catch (e) { out.wrongKind = e.message; }
    m.importSharedExercise({ kind: 'trainr-exercise', version: 1, exercise: { name: 'Import-Test', type: 'field', tag: 'Passspiel', ages: ['E-Jugend'], min: 2, max: 4, minutes: 8, description: 'x', coaching: 'y', equipment: [], url: '' } });
    out.count = window.__trainr.store.get().custom.filter(c => c.name === 'Import-Test').length;
    return out;
  });
  expect(r.empty).toBeTruthy();
  expect(r.wrongKind).toContain('Keine gültige');
  expect(r.count).toBe(1);
  expect(errors).toEqual([]);
});
