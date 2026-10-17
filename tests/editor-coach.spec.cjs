// Ersteller: Trainer in eigenen Skizzen platzierbar (21.34.0). Der Trainer zaehlt
// nicht als Spieler (Gruppenlogik rechnet schon immer "ohne Trainer"), bewegt sich
// wie ein Spieler zwischen Schritten und erscheint in Detail, Animation und Druck.
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
  await page.locator('[name=name]').fill('Trainer-Handlung');
  await tab(page, 'sketch');
}

test('Trainer setzen, speichern – zaehlt nicht als Spieler', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.mouse.click(...await at(page, .5, .5)); // ein Spieler
  await page.click('[data-tool="t"]');
  await page.mouse.click(...await at(page, .25, .25)); // Trainer dazu
  await expect(page.locator('#ed-pitch .pitch-player.coach')).toHaveCount(1);
  await expect(page.locator('#ed-pitch .pitch-player.coach text')).toHaveText('T');
  // Gruppenstaerke bleibt bei einem Spieler (Trainer wird nicht mitgezaehlt)
  await expect(page.locator('[name=min]')).toHaveValue('1');
  await tab(page, 'details');
  await page.click('.mat[data-mat="Bälle"] .mat-toggle');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Trainer-Handlung');
  const c = (await state(page)).custom[0];
  expect(c.animation.items).toEqual([{ k: 'a' }, { k: 't' }]);
  expect(c.min).toBe(1);
  expect(errors).toEqual([]);
});

test('Trainer bewegt sich zwischen Schritten, Weg wird gezeigt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditor(page);
  await page.click('[data-tool="t"]');
  await page.mouse.click(...await at(page, .3, .5));
  await page.click('#ed-fadd'); // Schritt 2
  const tok = page.locator('#ed-pitch .sk-token[data-i="0"]');
  await tok.hover();
  await page.mouse.down();
  await page.mouse.move(...await at(page, .55, .5), { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#ed-pitch path.sketch-trail')).toHaveCount(1); // Trainer ist nicht statisch
  await page.click('#ed-undo');
  expect(errors).toEqual([]);
});

test('Trainer erscheint in Detailansicht und Druck, Animation laeuft', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.update('Übung', d => {
    d.custom.push({
      id: 'custom-trainertest', name: 'Trainertest', type: 'field', tag: 'Passspiel', ages: ['E-Jugend'], min: 2, max: 4, minutes: 8,
      description: 'Aufbau. Dann weiter.', coaching: 'Selbst pruefen.', equipment: [['Bälle', 1]], url: '', custom: true,
      animation: {
        version: 2, camera: 'off',
        items: [{ k: 'a' }, { k: 'a' }, { k: 'ball' }, { k: 't' }],
        frames: [
          { seconds: 2, caption: 'Aufbau', points: [[70, 95], [250, 95], [86, 95], [160, 140]] },
          { seconds: 2, caption: 'Trainer gibt nach aussen', points: [[70, 95], [250, 95], [234, 95], [240, 140]] },
        ],
      },
    });
  }));
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('custom-trainertest'));
  const coach = page.locator('dialog[open] #d-scene .pitch-player.coach');
  await expect(coach).toHaveCount(1);
  await expect(coach.locator('text')).toHaveText('T');
  await page.click('#d-play');
  await expect(page.locator('#d-play[aria-pressed="true"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  const html = await page.evaluate(async () => {
    window.__trainr.store.update('Plan', d => { d.plans.find(p => p.id === d.selectedPlanId).blocks.push({ id: 'tb1', exerciseId: 'custom-trainertest', minutes: 8 }); });
    const m = await import('/src/exports/sheet.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get();
    return m.printHtml(s, P.currentPlan(s), 'cardset', 'brand');
  });
  expect(html).toContain('pitch-player coach');
  expect(html).toContain('Trainertest');
  expect(errors).toEqual([]);
});
