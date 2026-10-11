const { test, expect } = require('@playwright/test');
const { watchErrors, state, onboard, createSession } = require('./helpers.cjs');

async function seed(page, items) {
  await page.goto('/version.json');
  await page.evaluate(o => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, items);
  await page.goto('/');
}
const raw = page => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const old = { 'trainr-v2': '{"version":2,"plans":"kaputt"}', 'trainr-ui-v4': '{"favorites":["3v3"],"motion":false,"haptics":true}', 'trainr-adapt-v1': '{"gatepass":{"min":2,"max":4,"minutes":9}}', 'keeperboard-v1': '{"stage1":true}' };

test('Alte Speicherschlüssel werden ignoriert und bleiben unverändert', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page, old);
  await expect(page.locator('#wiz')).toBeVisible();
  const s = await state(page);
  expect(s.teams).toEqual([]);
  expect(s.plans).toEqual([]);
  expect(s.exerciseMeta).toEqual({});
  expect(s.settings.motion).toBe('full');
  expect(s.settings.haptics).toBe(false);
  expect(await raw(page)).toEqual(old);
  expect(errors).toEqual([]);
});

test('Bestehende V21-Daten bleiben auch mit alten Browserdaten erhalten', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page, { name: 'Bestehende Mannschaft' });
  await createSession(page);
  await page.evaluate(items => {
    window.__trainr.store.update('Daten', s => { s.exerciseMeta.gatepass = { favorite: true, variant: { min: 2, max: 4, minutes: 9 } }; s.migratedFrom = 'trainr-v2'; });
    window.__trainr.store.flush();
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, old);
  const before = (await raw(page))['trainr-v21'];
  await page.reload();
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  expect(await state(page)).toEqual(JSON.parse(before));
  const after = await raw(page);
  expect(after['trainr-v21']).toBe(before);
  for (const [k, v] of Object.entries(old)) expect(after[k]).toBe(v);
  expect(errors).toEqual([]);
});

test('Ungültige V21-Daten werden gesichert, nie überschrieben', async ({ page }) => {
  const broken = '{"version":3,"teams":7}';
  await seed(page, { 'trainr-v21': broken });
  const r = await raw(page);
  expect(r['trainr-v21']).toBe(broken);
  expect(Object.entries(r).some(([k, v]) => k.startsWith('trainr-v21-recovery-') && v === broken)).toBe(true);
});

test('Laden fragt ausschließlich den aktuellen Speicherschlüssel ab', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { load } = await import('/src/core/storage.js');
    const keys = [];
    const result = load({ getItem: k => { keys.push(k); if (k !== 'trainr-v21') throw new Error('Altdaten gelesen'); return null; } });
    return { keys, source: result.source };
  });
  expect(result).toEqual({ keys: ['trainr-v21'], source: 'new' });
});
