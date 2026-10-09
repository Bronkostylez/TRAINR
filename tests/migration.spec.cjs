const { test, expect } = require('@playwright/test');
const { watchErrors, state, go } = require('./helpers.cjs');

const V2 = {
  version: 2,
  profile: { type: 'both', age: 'E-Jugend', slots: [{ day: 1, start: '17:00', end: '18:30' }, { day: 3, start: '16:30', end: '18:00' }] },
  custom: [{ id: 'custom-abc', name: 'Alte eigene Übung', type: 'field', ages: ['E-Jugend', 'D-Jugend', 'C-Jugend', 'B-Jugend', 'A-Jugend', 'Männer'], tag: 'Passspiel', description: 'Pass und Lauf.', equipment: [['Hütchen', 4], ['Bälle', 2]], min: 2, max: 4, minutes: 7, url: '', coaching: 'Eigene Übung.', custom: true,
    animation: { version: 1, frames: [{ seconds: 3, caption: 'Start', points: [[65, 95], [245, 95], [160, 50], [80, 95]] }, { seconds: 2, caption: 'Pass', points: [[65, 95], [245, 95], [160, 50], [230, 95]] }] } }],
  plans: [
    { id: 'p-1', name: 'Dienstagstraining', blocks: [{ id: 'b-1', exerciseId: 'gatepass', minutes: 8 }, { id: 'b-2', exerciseId: 'custom-abc', minutes: 7, people: 6 }, { id: 'b-3', exerciseId: 'left-right', minutes: 6 }], people: 12, slot: 1, focus: 'Passspiel', coachNotes: 'Mehr loben.' },
    { id: 'p-2', name: 'Torwart', blocks: [{ id: 'b-4', exerciseId: 'catch', minutes: 6 }], people: 4, slot: 3, focus: 'Fangen', age: 'D-Jugend' },
  ],
  selected: 'p-2',
};
const UI = { favorites: ['3v3', 'catch'], motion: false, haptics: true };
const ADAPT = { gatepass: { min: 2, max: 4, minutes: 9 } };
const K1 = '{"stage1":"bleibt unverändert","players":[1,2,3]}';

async function seed(page, items) {
  await page.goto('/version.json');
  await page.evaluate(o => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, items);
  await page.goto('/');
}
const raw = page => page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));

test('Migration V20 → V21: alles übernommen, alte Schlüssel byte-genau unverändert', async ({ page }) => {
  const errors = watchErrors(page);
  const items = { 'trainr-v2': JSON.stringify(V2), 'trainr-ui-v4': JSON.stringify(UI), 'trainr-adapt-v1': JSON.stringify(ADAPT), 'keeperboard-v1': K1 };
  await seed(page, items);
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  await expect(page.locator('.toast')).toContainText('V20');
  const s = await state(page);
  expect(s.version).toBe(3);
  expect(s.teams).toHaveLength(1);
  expect(s.teams[0]).toMatchObject({ type: 'both', age: 'E-Jugend', slots: V2.profile.slots });
  expect(s.plans.map(p => p.id)).toEqual(['p-1', 'p-2']);
  expect(s.plans[0]).toMatchObject({ name: 'Dienstagstraining', notes: 'Mehr loben.', focus: 'Passspiel', slot: 1 });
  expect(s.plans[0].blocks).toEqual([{ id: 'b-1', exerciseId: 'gatepass', minutes: 8 }, { id: 'b-2', exerciseId: 'custom-abc', minutes: 7, people: 6 }, { id: 'b-3', exerciseId: 'left-right', minutes: 6 }]);
  expect(s.plans[1].age).toBe('D-Jugend');
  expect(s.selectedPlanId).toBe('p-2');
  expect(s.custom[0]).toEqual(V2.custom[0]);
  expect(s.exerciseMeta['3v3'].favorite).toBe(true);
  expect(s.exerciseMeta.catch.favorite).toBe(true);
  expect(s.exerciseMeta.gatepass.variant).toEqual(ADAPT.gatepass);
  expect(s.settings.motion).toBe('off');
  expect(s.settings.haptics).toBe(true);
  // archivierte Übung bleibt im alten Plan auflösbar
  await page.evaluate(() => window.__trainr.store.update('w', d => { d.selectedPlanId = 'p-1'; }, { undo: false }));
  await go(page, '#planen');
  await expect(page.locator('#pl-blocks')).toContainText('Links-rechts-Paartore');
  await expect(page.locator('#pl-blocks')).toContainText('Alte eigene Übung');
  // alte Schlüssel byte-genau, keeperboard-v1 unberührt
  await page.reload();
  const after = await raw(page);
  for (const k of Object.keys(items)) expect(after[k]).toBe(items[k]);
  expect(after['trainr-v21']).toBeTruthy();
  // Zweiter Start liest trainr-v21, nicht erneut trainr-v2
  await page.evaluate(() => window.__trainr.store.update('x', d => { d.plans[0].name = 'Neu in V21'; }));
  await page.waitForTimeout(300);
  await page.reload();
  expect((await state(page)).plans[0].name).toBe('Neu in V21');
  expect((await raw(page))['trainr-v2']).toBe(items['trainr-v2']);
  expect(errors).toEqual([]);
});

test('Ungültige gespeicherte Daten werden gesichert, nie überschrieben', async ({ page }) => {
  const broken = '{"version":2,"plans":"kaputt"}';
  await seed(page, { 'trainr-v2': broken, 'keeperboard-v1': K1 });
  await expect(page.locator('h1')).toContainText('Willkommen');
  const r = await raw(page);
  expect(r['trainr-v2']).toBe(broken);
  expect(r['keeperboard-v1']).toBe(K1);
  expect(Object.entries(r).some(([k, v]) => k.startsWith('trainr-v21-recovery-') && v === broken)).toBe(true);
  // kaputtes V21 ebenso
  await seed(page, { 'trainr-v21': '{"version":3,"teams":7}' });
  const r2 = await raw(page);
  expect(Object.entries(r2).some(([k, v]) => k.startsWith('trainr-v21-recovery-') && v === '{"version":3,"teams":7}')).toBe(true);
});

test('Nur UI-Daten aus V20 (ohne Pläne): Merkliste und Animationsschalter übernommen', async ({ page }) => {
  await seed(page, { 'trainr-ui-v4': JSON.stringify(UI) });
  const s = await state(page);
  expect(s.exerciseMeta['3v3'].favorite).toBe(true);
  expect(s.settings.motion).toBe('off');
});
