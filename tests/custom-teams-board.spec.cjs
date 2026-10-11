const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, go } = require('./helpers.cjs');

test('Eigene Übung: Pflichtfelder, Skizze mit Animation, Material-Auswahl, bearbeiten, verwenden, löschen', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.click('#lib-new');
  const f = page.locator('#ed');
  // Pflicht: Name, dann Material
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('Namen');
  await f.locator('[name=name]').fill('Dreieckspass mit Abschluss');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('Material');
  // Skizze: Keeper und Ball setzen
  const pitch = page.locator('#ed-pitch');
  const at = async (fx, fy) => { await pitch.scrollIntoViewIfNeeded(); const r = await pitch.boundingBox(); return [r.x + r.width * fx, r.y + r.height * fy]; };
  await page.click('[data-tool="k"]');
  await page.mouse.click(...await at(.8, .5));
  await page.click('[data-tool="ball"]');
  await page.mouse.click(...await at(.3, .5));
  await expect(pitch.locator('.goalkeeper')).toHaveCount(1);
  // Material aus der Skizze übernommen, Spielerzahl vorgeschlagen
  await expect(page.locator('.mat.on[data-mat="Bälle"] b')).toHaveText('1');
  await expect(f.locator('[name=min]')).toHaveValue('1');
  // Schritt 2: Ball zum Keeper ziehen
  await page.click('#ed-fadd');
  await page.fill('#ed-cap', 'Ball zum Keeper');
  await page.mouse.move(...await at(.3, .5));
  await page.mouse.down();
  await page.mouse.move(...await at(.6, .5), { steps: 4 });
  await page.mouse.move(...await at(.74, .5), { steps: 4 });
  await page.mouse.up();
  await expect(pitch.locator('.sketch-trail.ball')).toHaveCount(1);
  // Material per Auswahl: Minitore an, eins mehr
  await page.click('.mat[data-mat="Minitore"] .mat-toggle');
  await page.click('.mat[data-mat="Minitore"] [data-mat-d="1"]');
  await page.fill('#ed-mat-new', 'Stoppuhr'); await page.keyboard.press('Enter');
  // Spieler pro Gruppe per Stepper
  await page.click('[data-step="min"][data-d="1"]'); await page.click('[data-step="min"][data-d="1"]');
  await page.click('[data-step="max"][data-d="-1"]');
  // Optionale Angaben
  await page.click('#ed-more summary');
  await f.locator('[name=goal]').fill('Schnell kombinieren');
  await f.locator('[name=url]').fill('http://unsicher.example');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('https');
  await f.locator('[name=url]').fill('');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Dreieckspass mit Abschluss');
  let s = await state(page);
  const c = s.custom[0];
  expect(c).toMatchObject({ name: 'Dreieckspass mit Abschluss', goal: 'Schnell kombinieren', min: 3, max: 3, custom: true, description: 'Ball zum Keeper.' });
  expect(c.equipment).toEqual([['Bälle', 1], ['Minitore', 3], ['Stoppuhr', 1]]);
  expect(c.animation).toMatchObject({ version: 2, items: [{ k: 'k' }, { k: 'ball' }] });
  expect(c.animation.frames.map(x => x.caption)).toEqual(['Aufbau', 'Ball zum Keeper']);
  expect(c.animation.frames[1].points[1][0]).toBeGreaterThan(c.animation.frames[0].points[1][0] + 100);
  expect(c.animation.frames[1].points[0]).toEqual(c.animation.frames[0].points[0]);
  // Detail zeigt eigene Animation mit lila Keeper
  await expect(page.locator('dialog[open] #d-scene .goalkeeper')).toHaveCount(1);
  await page.click('dialog[open] #d-add');
  await page.click('dialog[open] #d-edit');
  await expect(page.locator('#ed-pitch .goalkeeper')).toHaveCount(1);
  await page.click('#ed-more summary');
  await page.locator('#ed [name=minutes]').fill('11');
  await page.click('dialog[open] button[type=submit]');
  await expect.poll(async () => (await state(page)).custom[0].minutes).toBe(11);
  expect((await state(page)).custom[0].animation.frames.length).toBe(2);
  expect((await plan(page)).blocks[0].exerciseId).toBe(c.id);
  // Löschen entfernt auch Blöcke
  await page.keyboard.press('Escape');
  await page.click('#lib-filter');
  await page.click('[data-scope=own]');
  await page.click('dialog[open] [data-fapply]');
  await page.locator('#lib-grid .drill h3').first().click();
  await page.click('dialog[open] #d-del');
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).custom.length).toBe(0);
  expect((await plan(page)).blocks.length).toBe(0);
  await page.locator('.toast button').click();
  await expect.poll(async () => (await state(page)).custom.length).toBe(1);
  expect(errors).toEqual([]);
});

test('Skizzen-Editor: Vorlage, Entfernen, Rückgängig, stehende Skizze', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.click('#lib-new');
  await page.fill('#ed [name=name]', 'Rondo');
  await page.click('#ed-tpl');
  await page.click('dialog[open] [data-tpl="Rondo 3 gegen 1"]');
  const pitch = page.locator('#ed-pitch');
  await expect(pitch.locator('[data-i]')).toHaveCount(9);
  await expect(pitch.locator('.opponent')).toHaveCount(1);
  // Hütchen, Ball und Leibchen als Material übernommen, Spieler pro Gruppe = 4
  await expect(page.locator('.mat.on[data-mat="Hütchen"] b')).toHaveText('4');
  await expect(page.locator('.mat.on[data-mat="Leibchen"]')).toHaveCount(1);
  await expect(page.locator('#ed [name=min]')).toHaveValue('4');
  // Element auswählen und entfernen, dann rückgängig
  await pitch.locator('[data-i="3"]').click();
  await page.click('#ed-del');
  await expect(pitch.locator('.opponent')).toHaveCount(0);
  await page.click('#ed-undo');
  await expect(pitch.locator('.opponent')).toHaveCount(1);
  // Tastatur: Entf entfernt das fokussierte Element
  await pitch.locator('[data-i="4"]').focus();
  await page.keyboard.press('Delete');
  await expect(pitch.locator('.sketch-ball')).toHaveCount(0);
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Rondo');
  const c = (await state(page)).custom[0];
  expect(c.animation.frames.length).toBe(1);
  expect(c.animation.items.length).toBe(8);
  expect(c.description).toBe('Aufbau und Ablauf siehe Platzskizze.');
  // Stehende Skizze: keine Schrittanzeige, Hütchen sichtbar
  await expect(page.locator('dialog[open] #d-scene .setup-cone')).toHaveCount(4);
  await expect(page.locator('dialog[open] #d-scene .scene-step-label')).toHaveCount(0);
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
  // In einem Schritt prüfen: die Bibliothek zeichnet nach den ersten 12 Karten in Etappen nach.
  await expect(page.locator('#lib-grid .drill').first()).toBeVisible();
  expect(await page.locator('#lib-grid .drill').evaluateAll(els => els.every(e => e.querySelector('.tag.keeper')))).toBe(true);
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
