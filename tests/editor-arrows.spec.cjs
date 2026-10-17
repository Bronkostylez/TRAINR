// Ersteller: freie Pfeile (Lauf/Pass/Dribbling) je Schritt zeichnen (21.33.0).
// Pfeile gehören zum Schritt, erscheinen in Detail, Animation und Druck; antippen entfernt sie.
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
  await page.locator('[name=name]').fill('Pfeil-Rondo');
  await tab(page, 'sketch');
  await page.mouse.click(...await at(page, .3, .5)); // ein Spieler, damit die Skizze nicht leer ist
}

test('Pfeile ziehen, Art wählen, speichern – je Schritt im Bestand', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.click('[data-tool="arrow"]');
  await expect(page.locator('[data-arrow-kind="run"]')).toHaveAttribute('aria-checked', 'true');
  // Lauf-Pfeil AB DEM SPIELER ziehen – darf den Spieler nicht verschieben
  await page.mouse.move(...await at(page, .3, .5));
  await page.mouse.down();
  await page.mouse.move(...await at(page, .5, .4), { steps: 4 });
  await page.mouse.move(...await at(page, .62, .32), { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#ed-pitch [data-free-arrow]')).toHaveCount(1);
  // Art wechseln, zweiten Pfeil ziehen
  await page.click('[data-arrow-kind="dribble"]');
  await page.mouse.move(...await at(page, .2, .8));
  await page.mouse.down();
  await page.mouse.move(...await at(page, .45, .75), { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#ed-pitch [data-free-arrow]')).toHaveCount(2);
  await expect(page.locator('#ed-pitch .sketch-trail.free.dribble')).toHaveCount(1);
  // Speichern: Name + Material reichen
  await tab(page, 'details');
  await page.click('.mat[data-mat="Bälle"] .mat-toggle');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Pfeil-Rondo');
  const c = (await state(page)).custom[0];
  const arrows = c.animation.frames[0].arrows;
  expect(arrows.map(a => a.k)).toEqual(['run', 'dribble']);
  arrows.forEach(a => expect(a.p.every(v => Number.isFinite(v))).toBe(true));
  expect(c.animation.frames[0].points[0]).toEqual([96, 95]); // Spieler blieb stehen
  expect(errors).toEqual([]);
});

test('Pfeil antippen entfernt ihn, Rückgängig bringt ihn zurück', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.click('[data-tool="arrow"]');
  await page.mouse.move(...await at(page, .3, .3));
  await page.mouse.down();
  await page.mouse.move(...await at(page, .6, .6), { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#ed-pitch [data-free-arrow]')).toHaveCount(1);
  await page.mouse.click(...await at(page, .45, .45)); // Mitte des Pfeils
  await expect(page.locator('#ed-pitch [data-free-arrow]')).toHaveCount(0);
  await page.click('#ed-undo');
  await expect(page.locator('#ed-pitch [data-free-arrow]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Pfeile erscheinen in Detailansicht und Druck, Animation läuft', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.update('Übung', d => {
    d.custom.push({
      id: 'custom-pfeiltest', name: 'Pfeiltest', type: 'field', tag: 'Passspiel', ages: ['E-Jugend'], min: 2, max: 4, minutes: 8,
      description: 'Aufbau. Dann weiter.', coaching: 'Selbst prüfen.', equipment: [['Bälle', 1]], url: '', custom: true,
      animation: {
        version: 2, camera: 'off',
        items: [{ k: 'a' }, { k: 'a' }, { k: 'ball' }],
        frames: [
          { seconds: 2, caption: 'Aufbau', points: [[70, 95], [250, 95], [86, 95]], arrows: [{ k: 'run', p: [70, 85, 150, 60] }, { k: 'pass', p: [86, 95, 230, 95] }] },
          { seconds: 2, caption: 'Weiter', points: [[150, 60], [250, 95], [234, 95]], arrows: [{ k: 'dribble', p: [150, 60, 200, 120] }] },
        ],
      },
    });
  }));
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('custom-pfeiltest'));
  await expect(page.locator('dialog[open] #d-scene [data-free-arrow]')).toHaveCount(2);
  await expect(page.locator('dialog[open] #d-scene .sketch-trail.free.pass')).toHaveCount(1); // waagrechte Linie hat Höhe 0 → nicht „sichtbar“ für Playwright
  await page.click('#d-play');
  await expect(page.locator('#d-play[aria-pressed="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  const html = await page.evaluate(async () => {
    window.__trainr.store.update('Plan', d => { d.plans.find(p => p.id === d.selectedPlanId).blocks.push({ id: 'pb1', exerciseId: 'custom-pfeiltest', minutes: 8 }); });
    const m = await import('/src/exports/sheet.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get();
    return m.printHtml(s, P.currentPlan(s), 'cardset', 'brand');
  });
  expect(html).toContain('sketch-trail free pass'); // Kartenset zeigt den Aufbau (Schritt 0)
  expect(html).toContain('Pfeiltest');
  expect(errors).toEqual([]);
});
