// V21.7: Ablaufarten (Gruppen / Schlange / alle gemeinsam) und Besetzung (Spieler, Torwart, Trainer).
const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, createSession, go } = require('./helpers.cjs');

/** Verteilung einer Übung für eine Besetzung berechnen. */
const lay = (page, id, sq, stations) => page.evaluate(async ([id, sq, stations]) => {
  const P = await import('/src/core/planning.js'), s = window.__trainr.store.get();
  const L = P.layout(s, P.exercise(s, id), sq, stations);
  return { ...L, text: P.layoutText(L), advice: P.layoutAdvice(L) };
}, [id, sq, stations]);

test('Verteilung: Gruppen nur, wo nötig – Schlange und „alle gemeinsam“ bleiben planbar', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  // Alle gemeinsam: 20 Spieler, keine Gruppen, nur größeres Feld und mehr Material
  let L = await lay(page, 'islands', { players: 20, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ mode: 'open', level: 'ok', groups: 1, sets: 4, active: 20, waiting: 0 });
  // Schlange: 12 Spieler an einer Station → lange Schlange, zwei Schlangen lösen das
  L = await lay(page, 'finish', { players: 12, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ mode: 'queue', level: 'tight', why: 'longqueue', groups: 1, active: 4, waiting: 8, stationsHint: 2 });
  L = await lay(page, 'finish', { players: 12, keepers: 0, coaches: 1 }, 2);
  expect(L).toMatchObject({ mode: 'queue', level: 'ok', groups: 2, active: 8, waiting: 4 });
  // Feste Gruppen: so wenige wie möglich; Rest wechselt ein, Trainer kann auffüllen
  L = await lay(page, '3v3', { players: 13, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ mode: 'group', groups: 2, active: 12, waiting: 1, level: 'ok' });
  L = await lay(page, 'gatepass', { players: 11, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ groups: 5, waiting: 1, coachFill: 1, level: 'ok' });
  L = await lay(page, 'gatepass', { players: 11, keepers: 0, coaches: 0 });
  expect(L.coachFill).toBe(0);
  // Zu wenige Spieler
  L = await lay(page, '3v3', { players: 4, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ level: 'no', why: 'few' });
  // Torwart-Übung: ohne Torwart nicht möglich, mit zwei Torwarten höchstens zwei Gruppen, Feldspieler unbeteiligt
  L = await lay(page, 'catch', { players: 10, keepers: 0, coaches: 1 });
  expect(L).toMatchObject({ level: 'no', why: 'nokeeper' });
  L = await lay(page, 'catch', { players: 10, keepers: 2, coaches: 1 });
  expect(L).toMatchObject({ level: 'tight', why: 'idle', groups: 2 });
  // Übung für Feldspieler und Torwart: nicht für jede Gruppe ein Torwart
  L = await lay(page, '1to4', { players: 20, keepers: 1, coaches: 1 });
  expect(L).toMatchObject({ mode: 'group', groups: 2, keepersMissing: 1, level: 'tight' });
  expect(L.advice).toContain('Torwart');
  expect(errors).toEqual([]);
});

test('Besetzung: Spieler, Torwart, Trainer in Einheit, Block, Material und Check', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await go(page, '#planen');
  await expect(page.locator('#pl-squad')).toContainText('1 Trainer');
  await page.click('#pl-squad');
  await expect(page.locator('dialog[open]')).toContainText('Wer ist da?');
  await page.click('dialog[open] [data-sq=keepers][data-d="1"]');
  await page.click('dialog[open] [data-sq=keepers][data-d="1"]');
  await page.click('dialog[open] [data-sq=coaches][data-d="1"]');
  await expect(page.locator('dialog[open] #sq-total')).toContainText('14 auf dem Platz');
  await page.click('#sq-ok');
  let p = await plan(page);
  expect(p).toMatchObject({ people: 12, keepers: 2, coaches: 2 });
  await expect(page.locator('#pl-squad')).toContainText('2 Torwart');
  // Standardwerte werden nicht gespeichert
  await page.click('#pl-squad');
  await page.fill('dialog[open] #sq-keepers', '0');
  await page.press('dialog[open] #sq-keepers', 'Tab');
  await page.fill('dialog[open] #sq-coaches', '1');
  await page.press('dialog[open] #sq-coaches', 'Tab');
  await page.click('#sq-ok');
  p = await plan(page);
  expect(p.keepers).toBeUndefined();
  expect(p.coaches).toBeUndefined();
  // Block mit Schlange: Stationen einstellen
  const id = await page.evaluate(async () => {
    const P = await import('/src/core/planning.js'), st = window.__trainr.store.get(), pl = P.currentPlan(st);
    window.__trainr.store.update('Schlange', d => { d.plans.find(x => x.id === pl.id).blocks.push({ id: 'q1', exerciseId: 'finish', minutes: 8 }); });
    return 'q1';
  });
  await expect(page.locator('#pl-blocks')).toContainText('Schlange · 4 aktiv, 8 in der Reihe');
  await page.locator(`[data-key=${id}] [data-edit]`).click();
  await expect(page.locator('dialog[open] [name=stations]')).toHaveValue('1');
  await page.click('dialog[open] [data-step=s][data-d="1"]');
  await expect(page.locator('#be-hint')).toContainText('2 Schlangen · 8 aktiv, 4 in der Reihe');
  await page.click('dialog[open] button[type=submit]');
  expect((await plan(page)).blocks.at(-1).stations).toBe(2);
  await expect(page.locator(`[data-key=${id}]`)).toContainText('2 Schlangen');
  // Ungültige Stationen werden vom Schema abgelehnt
  const bad = await page.evaluate(async () => { const S = await import('/src/core/schema.js'); const x = JSON.parse(JSON.stringify(window.__trainr.store.get())); x.plans.find(p => p.id === x.selectedPlanId).blocks.at(-1).stations = 9; try { S.validateV3(x); return false; } catch { return true; } });
  expect(bad).toBe(true);
  // Material wächst mit Schlangen, nicht mit Gruppen
  const mat = await page.evaluate(async () => { const P = await import('/src/core/planning.js'), s = window.__trainr.store.get(), pl = P.currentPlan(s); return P.requirements(s, { ...pl, blocks: pl.blocks.filter(b => b.id === 'q1') }); });
  expect(mat['Minitore']).toBe(4); // 2 Minitore je Station × 2 Schlangen
  // Check: Torwart-Übung ohne Torwart wird gemeldet
  await page.evaluate(() => window.__trainr.store.update('Keeper', d => { d.plans.find(x => x.id === d.selectedPlanId).blocks.push({ id: 'k1', exerciseId: 'catch', minutes: 6 }); }));
  const checks = await page.evaluate(async () => { const P = await import('/src/core/planning.js'), s = window.__trainr.store.get(); return P.check(s, P.currentPlan(s)).map(c => c.text); });
  expect(checks.join('\n')).toContain('Diese Übung braucht einen Torwart');
  expect(errors).toEqual([]);
});

test('Nachbereitung: Spieler, Torwart und Trainer getrennt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  const ev = await page.evaluate(async () => {
    const s = window.__trainr.store.get(), t = s.teams[0];
    const e = { id: 'ev-1', teamId: t.id, kind: 'training', status: 'geplant', date: '2026-01-06', start: '17:00', end: '18:30', planId: s.selectedPlanId, title: '', place: '', note: '', reason: '', remind: null };
    window.__trainr.store.update('Termin', d => { d.events.push(e); });
    const m = await import('/src/views/calendar.js'); m.reviewEvent('ev-1');
    return e.id;
  });
  await page.fill('dialog[open] #rv-att', '11');
  await page.click('dialog[open] [data-role=keepers][data-d="1"]');
  await page.click('dialog[open] [data-role=coaches][data-d="1"]');
  await page.click('#rv-save');
  const saved = (await state(page)).events.find(x => x.id === ev);
  expect(saved).toMatchObject({ status: 'erledigt', attendance: 11, keepers: 1, coaches: 2 });
  expect(errors).toEqual([]);
});

test.describe('Englisch', () => {
  test.use({ locale: 'en-US' });
  test('Besetzung und Ablaufarten sind vollständig übersetzt', async ({ page }) => {
    const errors = watchErrors(page);
    await onboard(page);
    await createSession(page);
    await go(page, '#planen');
    await page.evaluate(() => window.__trainr.store.update('Schlange', d => { const p = d.plans.find(x => x.id === d.selectedPlanId); p.keepers = 1; p.blocks.push({ id: 'q1', exerciseId: 'finish', minutes: 8 }, { id: 'k1', exerciseId: 'v22-kwinkel', minutes: 6 }); }));
    await page.click('#pl-squad');
    await expect(page.locator('dialog[open]')).toContainText('Who is here?');
    const sheet = await page.locator('dialog[open]').innerText();
    require('fs').writeFileSync(process.env.TEMP + '/sheet.txt', sheet);
    expect(sheet).toContain('Queue');
    expect(sheet).not.toMatch(/\b(Wer|Spieler|Torwart|Trainer|Gruppe|Schlange|Block)\b/);
    await page.click('#sq-ok');
    await page.locator('[data-key=q1] [data-edit]').click();
    const be = await page.locator('dialog[open]').innerText();
    require('fs').writeFileSync(process.env.TEMP + '/be.txt', be);
    expect(be.toLowerCase()).toContain('queues (stations)');
    expect(be).not.toMatch(/\b(Schlange|Schlangen|Spieler|aktiv|Reihe|Einheit)\b/);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Check' }).click().catch(() => {});
    const body = await page.locator('#main').innerText();
    expect(body).not.toMatch(/\b(Schlange|Torwart|Wartenden|wechseln|Gruppen oder)\b/);
    expect(errors).toEqual([]);
  });
});
