const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, planTotal, setPauses, createSession, go } = require('./helpers.cjs');

const pausesOf = page => page.evaluate(async () => { const P = await import('/src/core/planning.js'), s = window.__trainr.store.get(); return P.pauses(s, P.currentPlan(s)).map(x => ({ index: x.index, minutes: x.minutes, afterId: x.afterId })); });

test('Pausen: Assistent plant automatisch ein, Summe bleibt Trainingszeit, Anzeige in Planer, Heute und Check', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  const p = await plan(page);
  expect(p.pauses.count === 'auto' || Number.isInteger(p.pauses.count)).toBe(true);
  const ps = await pausesOf(page);
  expect(ps.length).toBeGreaterThan(0);
  expect(await planTotal(page)).toBe(90); // 17:00–18:30, Pausen eingerechnet
  // Heute: Pausenzeilen im Ablauf
  await expect(page.locator('#t-list .pause-item')).toHaveCount(ps.length);
  // Planer: Kopfzeile, Pausenzeilen zwischen den Blöcken
  await go(page, '#planen');
  await expect(page.locator('#pl-pause')).toContainText(`${ps.length} ${ps.length === 1 ? 'Pause' : 'Pausen'}`);
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(ps.length);
  const order = await page.locator('#pl-blocks > li').evaluateAll(els => els.map(e => (e.classList.contains('pause-row') ? 'P' : 'B')).join(''));
  expect(order).not.toMatch(/^P|PP|P$/); // nie am Anfang, Ende oder doppelt
  await page.click('[data-ptab=check]');
  await expect(page.locator('.check-list')).toContainText('automatisch verteilt');
  await expect(page.locator('.timeline .pause-item')).toHaveCount(ps.length);
  expect(errors).toEqual([]);
});

test('Pausen-Sheet: Anzahl, Dauer, Vorschau, Kürzen auf Trainingszeit, Keine', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await setPauses(page, { count: 0, minutes: 2 });
  await go(page, '#planen');
  await expect(page.locator('#pl-pause')).toContainText('Pausen planen');
  const n = (await plan(page)).blocks.length;
  await page.locator('#pl-options').evaluate(e => e.open = true);
  await page.click('#pl-pause');
  await page.click('dialog[open] [data-pm=fix]');
  await page.fill('#pz-cn', '2'); await page.locator('#pz-cn').dispatchEvent('change');
  await page.fill('#pz-mn', '6'); await page.locator('#pz-mn').dispatchEvent('change');
  await expect(page.locator('#pz-preview .pause-item')).toHaveCount(Math.min(2, n - 1));
  // 84 Min Übungen (Assistent) + 12 Min Pausen > 90: anbieten, Übungen zu kürzen
  await expect(page.locator('#pz-time')).toContainText('96 von 90 Min');
  await page.check('#pz-fit');
  await page.click('#pz-ok');
  await expect.poll(() => planTotal(page)).toBe(90);
  const p = await plan(page);
  expect(p.pauses).toEqual({ count: 2, minutes: 6 });
  expect(p.blocks.every(b => b.minutes >= 2)).toBe(true);
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(2);
  await expect(page.locator('#pl-blocks > li.pause-row').first()).toContainText('Trinkpause · 6 Min');
  // Mehr Pausen als Übergänge: auf Übergänge begrenzt
  await setPauses(page, { count: 8, minutes: 1 });
  expect((await pausesOf(page)).length).toBe(n - 1);
  // Keine
  await page.locator('#pl-options').evaluate(e => e.open = true);
  await page.click('#pl-pause');
  await page.click('dialog[open] [data-pm=off]');
  await expect(page.locator('#pz-preview')).toContainText('Keine Pausen');
  await page.click('#pz-ok');
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(0);
  expect((await plan(page)).pauses.count).toBe(0);
  // Undo stellt den vorherigen Stand her
  await page.click('#pl-undo');
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(n - 1);
  expect(errors).toEqual([]);
});

test('Pausen verschieben und entfernen: feste Stellen, folgen dem Block beim Umsortieren', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await setPauses(page, { count: 1, minutes: 2 });
  await go(page, '#planen');
  const before = (await pausesOf(page))[0];
  const blocks = (await plan(page)).blocks;
  const d = before.index === 0 ? 1 : -1;
  await page.locator(`[data-pmove="${before.afterId}"][data-d="${d}"]`).click();
  await expect.poll(async () => (await pausesOf(page))[0].index).toBe(before.index + d);
  const moved = await plan(page);
  expect(moved.pauses.after).toEqual([blocks[before.index + d].id]);
  await expect(page.locator('.pause-row')).not.toContainText('automatisch');
  // Block mit fester Pause nach oben: Pause bleibt hinter „ihrem“ Block
  const owner = moved.pauses.after[0], i = moved.blocks.findIndex(b => b.id === owner);
  if (i > 0) {
    await page.locator(`#pl-blocks > li.block[data-key="${owner}"] [data-move][data-d="-1"]`).click();
    await expect.poll(async () => (await pausesOf(page))[0].afterId).toBe(owner);
  }
  // Block mit fester Pause entfernen: Pause rückt zum vorherigen Block
  const now = await plan(page), j = now.blocks.findIndex(b => b.id === owner);
  await page.locator(`#pl-blocks > li.block[data-key="${owner}"] [data-del]`).click();
  const after = await plan(page);
  if (j > 0) expect(after.pauses.after).toEqual([now.blocks[j - 1].id]); else expect(after.pauses.after).toEqual([]);
  // Pause entfernen
  await setPauses(page, { count: 'auto', minutes: 2 });
  const auto = await pausesOf(page);
  await page.locator(`[data-pdel="${auto[0].afterId}"]`).click();
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(auto.length - 1);
  expect(errors).toEqual([]);
});

test('Pausen im Trainingsmodus: eigener Countdown, Hinweis auf nächste Übung, Fortschritt', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install();
  await onboard(page);
  await createSession(page);
  await setPauses(page, { count: 1, minutes: 2 });
  const p = await plan(page), [ps] = await pausesOf(page);
  const nextName = await page.evaluate(async id => { const P = await import('/src/core/planning.js'); return P.exercise(window.__trainr.store.get(), id).name; }, p.blocks[ps.index + 1].exerciseId);
  await page.click('#t-start');
  await expect(page.locator('.seg-progress button.pause')).toHaveCount(1);
  for (let i = 0; i < ps.index; i++) await page.click('#lv-next');
  await expect(page.locator('.clock-card .eyebrow')).toContainText(`Block ${ps.index + 1} / ${p.blocks.length}`);
  await expect(page.locator('.next-up')).toContainText('Trinkpause 2 Min');
  await page.click('#lv-next');
  await expect(page.locator('.clock-card.is-pause')).toBeVisible();
  await expect(page.locator('.clock-card .eyebrow')).toContainText(`Pause nach Block ${ps.index + 1}`);
  await expect(page.locator('#lv-clock')).toHaveText('02:00');
  await expect(page.locator('.pause-live')).toContainText(nextName);
  // Pause läuft ab
  await page.clock.fastForward(121_000); await page.clock.runFor(500);
  await expect(page.locator('#lv-sub')).toHaveText('Pause vorbei');
  await expect(page.locator('.toast')).toContainText('Pause vorbei');
  await page.click('#lv-next');
  await expect(page.locator('.clock-card .eyebrow')).toContainText(`Block ${ps.index + 2} / ${p.blocks.length}`);
  expect(errors).toEqual([]);
});

test('Pausen in Exporten, Kopie, Vorlage und geteilter Datei; ältere Einheiten ohne Pausen bleiben gültig', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await setPauses(page, { count: 2, minutes: 3 });
  const text = await page.evaluate(async () => { const D = await import('/src/exports/doc.js'), P = await import('/src/core/planning.js'), s = window.__trainr.store.get(), p = P.currentPlan(s); return { txt: D.planText(s, p), csv: D.planCsv(s, p), doc: D.buildDoc(s, p, 'compact').filter(e => e.pause).length }; });
  expect(text.txt).toContain('Trinkpause · 3 Min');
  expect(text.txt).toContain('2 Pausen à 3 Min');
  expect(text.csv).toContain('"Trinkpause"');
  expect(text.doc).toBe(2);
  // Feste Stellen wandern bei Kopie und Datei mit
  const p = await plan(page);
  await page.evaluate(ids => window.__trainr.store.update('fest', d => { d.plans.find(x => x.id === d.selectedPlanId).pauses = { count: 1, minutes: 3, after: [ids[1]] }; }), p.blocks.map(b => b.id));
  await go(page, '#planen');
  await page.click('#pl-more'); await page.click('dialog[open] [data-a=copy]');
  const copy = await plan(page);
  expect(copy.id).not.toBe(p.id);
  expect(copy.pauses.after).toEqual([copy.blocks[1].id]);
  const file = await page.evaluate(async id => { const S = await import('/src/exports/share.js'); return S.planFile(id); }, copy.id);
  await page.evaluate(async f => { const S = await import('/src/exports/share.js'); S.importSharedPlan(f); }, file);
  const imported = await plan(page);
  expect(imported.id).not.toBe(copy.id);
  expect(imported.pauses.after).toEqual([imported.blocks[1].id]);
  // Ungültige Pausen werden abgelehnt, fehlende sind erlaubt
  const rejected = await page.evaluate(() => { try { window.__trainr.store.update('x', d => { d.plans[0].pauses = { count: 99, minutes: 2 }; }); return false; } catch { return true; } });
  expect(rejected).toBe(true);
  await page.evaluate(() => window.__trainr.store.update('alt', d => { delete d.plans.find(x => x.id === d.selectedPlanId).pauses; }));
  await page.reload();
  expect((await state(page)).plans.find(x => x.id === imported.id).pauses).toBeUndefined();
  await go(page, '#planen');
  await expect(page.locator('#pl-pause')).toContainText('Pausen planen');
  await expect(page.locator('#pl-blocks > li.pause-row')).toHaveCount(0);
  expect(errors).toEqual([]);
});
