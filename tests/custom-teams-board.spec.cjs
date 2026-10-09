const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, go } = require('./helpers.cjs');

test('Eigene Übung mit Material und Animation anlegen, bearbeiten, verwenden, löschen', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.click('#lib-new');
  const f = page.locator('#ed');
  // Pflichtfelder
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('Namen');
  await f.locator('[name=name]').fill('Dreieckspass mit Abschluss');
  await f.locator('[name=goal]').fill('Schnell kombinieren');
  await f.locator('[name=description]').fill('Im Dreieck passen. Dritter Pass in den Lauf. Abschluss aufs Minitor.');
  await f.locator('[name=min]').fill('3'); await f.locator('[name=max]').fill('4');
  await page.click('#ed-eq-add');
  const rows = page.locator('[data-eqrow]');
  await rows.last().locator('input').nth(0).fill('1');
  await rows.last().locator('input').nth(1).fill('Minitor');
  await f.locator('[name=url]').fill('http://unsicher.example');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('https');
  await f.locator('[name=url]').fill('');
  // Animation: Keeper lila setzen, Schritt hinzufügen
  await page.click('#ed-anim summary');
  const pitch = page.locator('#ed-pitch');
  await page.click('[data-actor="2"]');
  const box = await pitch.boundingBox();
  await page.mouse.click(box.x + box.width * .8, box.y + box.height * .5);
  await page.click('#ed-fadd');
  await page.fill('#ed-cap', 'Ball zum Keeper');
  await page.click('[data-actor="3"]');
  await page.mouse.click(box.x + box.width * .75, box.y + box.height * .5);
  await expect(pitch.locator('circle[fill="#9154d9"]')).toHaveCount(1);
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Dreieckspass mit Abschluss');
  let s = await state(page);
  const c = s.custom[0];
  expect(c).toMatchObject({ name: 'Dreieckspass mit Abschluss', goal: 'Schnell kombinieren', min: 3, max: 4, custom: true });
  expect(c.equipment).toContainEqual(['Minitor', 1]);
  expect(c.animation.frames.length).toBe(3);
  expect(c.animation.frames[1].caption).toBe('Ball zum Keeper');
  // Detail zeigt eigene Animation mit lila Keeper
  await expect(page.locator('dialog[open] #d-scene .goalkeeper')).toHaveCount(1);
  await page.click('dialog[open] #d-add');
  await page.click('dialog[open] #d-edit');
  await page.locator('#ed [name=minutes]').fill('11');
  await page.click('dialog[open] button[type=submit]');
  await expect.poll(async () => (await state(page)).custom[0].minutes).toBe(11);
  expect((await plan(page)).blocks[0].exerciseId).toBe(c.id);
  // Löschen entfernt auch Blöcke
  await page.keyboard.press('Escape');
  await page.click('[data-scope=own]');
  await page.locator('#lib-grid .drill h3').first().click();
  await page.click('dialog[open] #d-del');
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).custom.length).toBe(0);
  expect((await plan(page)).blocks.length).toBe(0);
  await page.locator('.toast button').click();
  await expect.poll(async () => (await state(page)).custom.length).toBe(1);
  expect(errors).toEqual([]);
});

test('Mehrere Mannschaften: anlegen, wechseln, Einheiten getrennt, Kopie für andere Mannschaft', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page, { name: 'E2' });
  await page.click('#c-go');
  await go(page, '#mehr');
  await page.click('#m-newteam');
  await page.fill('dialog[open] [name=name]', 'Torwartgruppe');
  await page.locator('dialog[open] [name=type][value=keeper]').check({ force: true });
  await page.click('dialog[open] #wiz-next');
  await page.locator('dialog[open] [name=age][value="C-Jugend"]').check({ force: true });
  await page.click('dialog[open] #wiz-next');
  await page.click('dialog[open] #wiz-next');
  await page.click('dialog[open] #wiz-next');
  await expect.poll(async () => (await state(page)).teams.length).toBe(2);
  let s = await state(page);
  const tw = s.teams.find(t => t.name === 'Torwartgruppe');
  expect(s.activeTeamId).toBe(tw.id);
  await expect(page.locator('#team-chip')).toContainText('Torwartgruppe');
  // Planen zeigt nur Einheiten dieser Mannschaft
  await go(page, '#planen');
  await expect(page.locator('#pl-switch')).toContainText('1 Einheit');
  // Bibliothek filtert auf Torwart
  await go(page, '#uebungen');
  const types = await page.locator('#lib-grid .drill .tag.keeper').count();
  expect(types).toBe(await page.locator('#lib-grid .drill').count());
  // Wechsel per Chip
  await page.click('#team-chip');
  await page.locator('dialog[open] [data-team]').filter({ hasText: 'E2' }).click();
  await expect(page.locator('#team-chip')).toContainText('E2');
  s = await state(page);
  const e2Plan = s.plans.find(p => p.id === s.selectedPlanId);
  expect(s.teams.find(t => t.id === e2Plan.teamId).name).toBe('E2');
  // Kopie für die andere Mannschaft
  await go(page, '#planen');
  await page.click('#pl-more');
  await page.locator('dialog[open] [data-a=team]').click();
  await expect.poll(async () => (await state(page)).plans.filter(p => p.teamId === tw.id).length).toBe(2);
  expect(errors).toEqual([]);
});

test('Taktikboard: Spieler setzen, ziehen, Pfeil zeichnen, Formation, lila Keeper, Bild-Export', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#taktik');
  const wrap = page.locator('#tb-wrap');
  await expect(wrap.locator('svg')).toBeVisible();
  await page.waitForTimeout(450); // Einblendanimation der Ansicht abwarten
  const box = await wrap.boundingBox();
  await page.click('[data-tool=a]');
  await page.mouse.click(box.x + box.width * .3, box.y + box.height * .5);
  await page.click('[data-tool=k]');
  await page.mouse.click(box.x + box.width * .05, box.y + box.height * .5);
  let b = (await state(page)).boards[0];
  expect(b.items.map(i => i.kind)).toEqual(['a', 'k']);
  await expect(wrap.locator('circle[fill="#9154d9"]')).toHaveCount(1);
  // Ziehen
  await page.click('[data-tool=move]');
  const tok = await wrap.locator('[data-i="0"]').boundingBox();
  await page.mouse.move(tok.x + tok.width / 2, tok.y + tok.height / 2);
  await page.mouse.down();
  await page.mouse.move(tok.x + 80, tok.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).boards[0].items[0].x).toBeGreaterThan(b.items[0].x + 5);
  // Pfeil
  await page.click('[data-tool=pass]');
  await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 220, box.y + 140, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => (await state(page)).boards[0].arrows.length).toBe(1);
  // Formation mit beiden Teams
  await page.click('#tb-form');
  await page.click('dialog[open] [data-form="7er (2-3-1)"]');
  b = (await state(page)).boards[0];
  expect(b.items.filter(i => i.kind === 'a').length).toBe(6);
  expect(b.items.filter(i => i.kind === 'kb').length).toBe(1);
  await expect(wrap.locator('circle[fill="#9154d9"]')).toHaveCount(2);
  // Rückgängig
  await page.click('#tb-undo');
  await expect.poll(async () => (await state(page)).boards[0].items.length).toBe(2);
  // Bild-Export
  await page.evaluate(() => { navigator.canShare = undefined; });
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('#tb-export')]);
  expect(d.suggestedFilename()).toMatch(/^taktik-.*\.png$/);
  expect(errors).toEqual([]);
});
