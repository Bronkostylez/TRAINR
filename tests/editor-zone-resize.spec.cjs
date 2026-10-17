// Ersteller: Zonengroesse per Griff an der Ecke aendern (21.36.0). Vorher konnte eine
// Zone nur neu gezeichnet werden; der Griff sitzt unten rechts an der gewaehlten Zone.
const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go } = require('./helpers.cjs');

const tab = (page, t) => page.locator(`[data-ed-tab=${t}]`).evaluate(b => b.click());
async function at(page, fx, fy) {
  const pitch = page.locator('#ed-pitch');
  await pitch.scrollIntoViewIfNeeded();
  const r = await pitch.boundingBox();
  return [r.x + r.width * fx, r.y + r.height * fy];
}
async function newEditorWithZone(page) {
  await go(page, '#uebungen');
  await page.click('#lib-new');
  await page.locator('[name=name]').fill('Zonen-Groesse');
  await tab(page, 'sketch');
  await page.click('[data-tool="zone"]');
  await page.mouse.move(...await at(page, .25, .3));
  await page.mouse.down();
  await page.mouse.move(...await at(page, .55, .7), { steps: 4 });
  await page.mouse.up();
}

test('Griff an der Ecke aendert die Zonengroesse, Speichern behaelt sie', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditorWithZone(page);
  const handle = page.locator('#ed-pitch .sk-resize');
  await expect(handle).toHaveCount(1); // Zone ist nach dem Zeichnen gewaehlt
  const before = await page.locator('#ed-pitch .sk-token .setup-zone rect').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  // Griff fassen und nach aussen ziehen
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(...await at(page, .75, .9), { steps: 5 });
  await page.mouse.up();
  const after = await page.locator('#ed-pitch .sk-token .setup-zone rect').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  expect(after.w).toBeGreaterThan(before.w + 30);
  expect(after.h).toBeGreaterThan(before.h + 20);
  // Speichern behaelt die neue Groesse
  await tab(page, 'details');
  await page.click('.mat[data-mat="Bälle"] .mat-toggle');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Zonen-Groesse');
  const c = (await state(page)).custom[0];
  expect(c.animation.items[0]).toEqual({ k: 'zone', w: after.w, h: after.h });
  expect(errors).toEqual([]);
});

test('Griff laesst Mindestgroesse zu, Rueckgaengig stellt alte Groesse wieder her', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await newEditorWithZone(page);
  const before = await page.locator('#ed-pitch .sk-token .setup-zone rect').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  const handle = page.locator('#ed-pitch .sk-resize');
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(...await at(page, .41, .51), { steps: 4 }); // fast auf die Mitte
  await page.mouse.up();
  const small = await page.locator('#ed-pitch .sk-token .setup-zone rect').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  expect(small.w).toBe(12);
  expect(small.h).toBe(12);
  await page.click('#ed-undo');
  const back = await page.locator('#ed-pitch .sk-token .setup-zone rect').evaluate(r => ({ w: +r.getAttribute('width'), h: +r.getAttribute('height') }));
  expect(back).toEqual(before);
  expect(errors).toEqual([]);
});
