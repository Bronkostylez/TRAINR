const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go } = require('./helpers.cjs');

test('Onboarding mit Fehlerfällen, Mannschaft und erster Einheit', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Willkommen');
  await page.fill('#wiz [name=name]', 'D1 Jungs');
  await page.locator('#wiz [name=type][value=keeper]').check({ force: true });
  await page.click('#wiz-next');
  await page.locator('#wiz [name=age][value="D-Jugend"]').check({ force: true });
  await page.click('#wiz-next');
  // kein Tag → Fehler
  await page.locator('#wiz [name=day][value="1"]').setChecked(false, { force: true });
  await page.click('#wiz-next');
  await expect(page.locator('#wiz-error')).toContainText('Mindestens einen Trainingstag');
  await page.locator('#wiz [name=day][value="1"]').check({ force: true });
  await page.locator('#wiz [name=day][value="3"]').check({ force: true });
  await page.click('#wiz-next');
  // Endzeit vor Beginn → Fehler
  await page.fill('[data-end="3"]', '16:00');
  await page.click('#wiz-next');
  await expect(page.locator('#wiz-error')).toContainText('Endzeit');
  await page.fill('[data-end="3"]', '18:15');
  await page.click('#wiz-next');
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  await expect(page.locator('dialog[open]')).toContainText('Kurze Einführung');
  await page.click('dialog[open] [data-skip]');
  const s = await state(page);
  expect(s.teams).toHaveLength(1);
  expect(s.teams[0]).toMatchObject({ name: 'D1 Jungs', type: 'keeper', age: 'D-Jugend' });
  expect(s.teams[0].slots.map(x => x.day)).toEqual([1, 3]);
  expect(s.teams[0].slots[1]).toMatchObject({ start: '17:00', end: '18:15' });
  expect(s.plans).toHaveLength(1);
  await expect.poll(async () => (await state(page)).help.tour).toBe(true);
  // Profil später ändern
  await go(page, '#mehr');
  await page.locator('[data-edit-team]').first().click();
  await page.click('dialog[open] #wiz-next');
  await page.locator('dialog[open] [name=age][value="C-Jugend"]').check({ force: true });
  await page.click('dialog[open] #wiz-next');
  await page.click('dialog[open] #wiz-next');
  await page.click('dialog[open] #wiz-next');
  await expect.poll(async () => (await state(page)).teams[0].age).toBe('C-Jugend');
  // Neu laden: Daten bleiben
  await page.reload();
  await expect(page.locator('section[data-view=mehr]')).toBeVisible();
  expect((await state(page)).teams[0].name).toBe('D1 Jungs');
  expect(errors).toEqual([]);
});

test('Bambini + Torwart: keine Torwart-Spezialisierung im Vorschlag', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page, { type: 'keeper', age: 'Bambini' });
  await page.click('#c-go');
  await expect(page.locator('.tl-item').first()).toBeVisible();
  const s = await state(page);
  const p = s.plans.find(x => x.id === s.selectedPlanId);
  const types = await page.evaluate(async ids => { const P = await import('/src/core/planning.js'); const st = window.__trainr.store.get(); return ids.map(id => P.exercise(st, id).type); }, p.blocks.map(b => b.exerciseId));
  expect(types.every(t => t === 'field')).toBe(true);
  expect(p.notes).toContain('Keine feste Torwartrolle');
  expect(errors).toEqual([]);
});
