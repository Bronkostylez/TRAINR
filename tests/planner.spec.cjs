const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, planTotal, createSession, go } = require('./helpers.cjs');

test('Planer: Einheit erstellen, Minuten, Reihenfolge, Teilnehmer, Undo/Redo, Entfernen', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  const p0 = await plan(page);
  expect(p0.blocks.length).toBeGreaterThanOrEqual(3);
  const total = await planTotal(page); // Übungen + automatisch eingeplante Pausen
  expect(total).toBe(90); // Trainingszeit 17:00–18:30
  await go(page, '#planen');
  const blocks = page.locator('#pl-blocks > li.block');
  await expect(blocks).toHaveCount(p0.blocks.length);
  // Minute +1
  await blocks.first().locator('[data-min][data-d="1"]').click();
  await expect.poll(async () => (await plan(page)).blocks[0].minutes).toBe(p0.blocks[0].minutes + 1);
  // Reihenfolge ↓
  await blocks.first().locator('[data-move][data-d="1"]').click();
  await expect.poll(async () => (await plan(page)).blocks[1].id).toBe(p0.blocks[0].id);
  // Undo über Kopfzeile → Reihenfolge zurück, Redo → wieder getauscht
  await page.click('#btn-undo');
  await expect.poll(async () => (await plan(page)).blocks[0].id).toBe(p0.blocks[0].id);
  await page.keyboard.press('Control+y');
  await expect.poll(async () => (await plan(page)).blocks[1].id).toBe(p0.blocks[0].id);
  await page.keyboard.press('Control+z');
  // Spielerzahl der Einheit
  await page.click('#pl-pminus');
  await expect.poll(async () => (await plan(page)).people).toBe(11);
  await expect(page.locator('#pl-blocks')).toContainText('passen nicht');
  await page.click('#pl-pplus');
  // Teilnehmer nur für einen Block
  await blocks.first().locator('[data-edit]').click();
  await page.fill('dialog[open] [name=people]', '7');
  await expect(page.locator('#be-hint')).toContainText('Spieler pro Gruppe');
  await page.fill('dialog[open] [name=minutes]', '13');
  await page.click('dialog[open] button[type=submit]');
  let p = await plan(page);
  expect(p.blocks[0]).toMatchObject({ people: 7, minutes: 13 });
  expect(p.people).toBe(12);
  await expect(blocks.first()).toContainText('7 Spieler (nur hier)');
  // Ungültige Eingabe abgelehnt
  await blocks.first().locator('[data-edit]').click();
  await page.fill('dialog[open] [name=people]', '0');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#be-err')).toContainText('1–100');
  await page.click('#be-same');
  await page.click('dialog[open] button[type=submit]');
  expect((await plan(page)).blocks[0].people).toBeUndefined();
  // Entfernen + Rückgängig im Toast
  const n = (await plan(page)).blocks.length;
  await blocks.last().locator('[data-del]').click();
  await expect.poll(async () => (await plan(page)).blocks.length).toBe(n - 1);
  await page.locator('.toast button', { hasText: 'Rückgängig' }).click();
  await expect.poll(async () => (await plan(page)).blocks.length).toBe(n);
  // Tauschen behält Minuten
  const before = (await plan(page)).blocks[1];
  await blocks.nth(1).locator('[data-swap]').click();
  const after = (await plan(page)).blocks[1];
  expect(after.exerciseId).not.toBe(before.exerciseId);
  expect(after.minutes).toBe(before.minutes);
  // Reload: alles gespeichert
  await page.reload();
  expect((await plan(page)).blocks.length).toBe(n);
  expect(errors).toEqual([]);
});

test('Planer: Zeiger-Sortierung am Griff und Tastatur', async ({ page }) => {
  await onboard(page);
  await createSession(page);
  await go(page, '#planen');
  const ids = (await plan(page)).blocks.map(b => b.id);
  const h0 = page.locator('#pl-blocks > li.block').nth(0).locator('[data-handle]');
  const h2 = page.locator('#pl-blocks > li.block').nth(2);
  const a = await h0.boundingBox(), b = await h2.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y + 30, { steps: 5 });
  await page.mouse.move(a.x + a.width / 2, b.y + b.height - 5, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => (await plan(page)).blocks.map(x => x.id).indexOf(ids[0])).toBe(2);
  // Tastatur: Griff fokussieren, Pfeil hoch
  await page.locator('#pl-blocks > li.block').nth(2).locator('[data-handle]').focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await plan(page)).blocks.map(x => x.id).indexOf(ids[0])).toBe(1);
});

test('Planer Desktop: Drag & Drop aus der Bibliothek in den Ablauf', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await onboard(page);
  await go(page, '#planen');
  await expect(page.locator('#plan-side .drill').first()).toBeVisible();
  const id = await page.locator('#plan-side .drill').first().getAttribute('data-id');
  await page.locator('#plan-side .drill').first().dragTo(page.locator('#pl-drop'));
  await expect.poll(async () => (await plan(page)).blocks.map(b => b.exerciseId)).toContain(id);
  const id2 = await page.locator('#plan-side .drill').nth(1).getAttribute('data-id');
  await page.locator('#plan-side .drill').nth(1).dragTo(page.locator('#pl-blocks > li.block').first(), { targetPosition: { x: 40, y: 5 } });
  await expect.poll(async () => (await plan(page)).blocks[0].exerciseId).toBe(id2);
});

test('Planassistent, Check, Packliste, Notizen, Kopieren, Vorlagen, Löschen', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#planen');
  await page.click('#pl-assist');
  await expect(page.locator('dialog[open] .proposal-item').first()).toBeVisible();
  await page.click('dialog[open] [data-st=technique]');
  await expect(page.locator('dialog[open] .proposal-item')).toHaveCount(4);
  await expect(page.locator('dialog[open] .why').first()).not.toBeEmpty();
  // Alternative wählen
  const altName = await page.locator('dialog[open] [data-alt]').first().textContent();
  await page.locator('dialog[open] [data-alt]').first().click();
  await expect(page.locator('dialog[open] .proposal-item strong').first()).toHaveText(altName.trim());
  await page.click('dialog[open] [data-apply=new]');
  let s = await state(page);
  expect(s.plans.length).toBe(2);
  const p = s.plans.find(x => x.id === s.selectedPlanId);
  expect(await planTotal(page)).toBe(90);
  // Check
  await page.click('[data-ptab=check]');
  await expect(page.locator('.check-list')).toContainText('Gruppengrößen');
  await page.click('#gr-go');
  await expect(page.locator('#gr-out .notice')).toHaveCount(3);
  // Packliste
  await page.click('[data-ptab=packliste]');
  const boxes = page.locator('[data-pack]');
  expect(await boxes.count()).toBeGreaterThan(5);
  await boxes.first().check();
  await expect(page.locator('.pack input:checked')).toHaveCount(1);
  // Notizen
  await page.click('[data-ptab=notizen]');
  await page.fill('#pl-goal', 'Mit Tempo ins 1 gegen 1');
  await page.locator('#pl-goal').blur();
  await page.fill('#pl-notes', 'Feld B war zu klein.');
  await page.locator('#pl-notes').blur();
  await expect.poll(async () => (await plan(page)).goal).toBe('Mit Tempo ins 1 gegen 1');
  expect((await plan(page)).notes).toBe('Feld B war zu klein.');
  // Duplizieren
  await page.click('#pl-more');
  await page.click('dialog[open] [data-a=copy]');
  await expect.poll(async () => (await state(page)).plans.length).toBe(3);
  expect((await plan(page)).name).toContain('Kopie');
  // Als Vorlage, aus Vorlage
  await page.click('#pl-more');
  await page.click('dialog[open] [data-a=tpl]');
  await expect.poll(async () => (await state(page)).plans.filter(x => x.template).length).toBe(1);
  await page.click('[data-ptab=ablauf]');
  await page.click('#pl-templates');
  await page.click('dialog[open] [data-use]');
  await expect.poll(async () => (await state(page)).plans.filter(x => !x.template).length).toBe(4);
  // Einheiten wechseln
  await page.click('#pl-switch');
  await expect(page.locator('dialog[open] [data-pick]')).toHaveCount(4);
  await page.locator('dialog[open] [data-pick]').first().click();
  // Löschen mit Bestätigung, dann Rückgängig
  await page.click('#pl-more');
  await page.click('dialog[open] [data-a=del]');
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).plans.filter(x => !x.template).length).toBe(3);
  await page.locator('.toast button', { hasText: 'Rückgängig' }).click();
  await expect.poll(async () => (await state(page)).plans.filter(x => !x.template).length).toBe(4);
  expect(errors).toEqual([]);
});

test('Schnell-Hinzufügen-Sheet und Hinzufügen bei laufendem Timer', async ({ page }) => {
  await onboard(page);
  await createSession(page);
  await go(page, '#training');
  await page.click('#lv-toggle');
  expect(await page.evaluate(() => window.__trainr.timer.running())).toBe(true);
  await go(page, '#heute');
  await page.click('#q-add');
  const n = (await plan(page)).blocks.length;
  await page.locator('dialog[open] [data-add]').first().click();
  await expect.poll(async () => (await plan(page)).blocks.length).toBe(n + 1);
  expect(await page.evaluate(() => window.__trainr.timer.running())).toBe(true);
});
