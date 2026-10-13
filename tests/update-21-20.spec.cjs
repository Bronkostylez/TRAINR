// 21.20–21.24: Skizzen mit mehr als fünf Spielern, Torwart-Handball.
const { test, expect } = require('@playwright/test');
const { onboard, watchErrors, createSession, setPauses } = require('./helpers.cjs');

test('Skizze zeigt 6 pro Team bei 6 gegen 6 und bleibt im Spielfeld', async ({ page }) => {
  const errors = watchErrors(page); await onboard(page);
  const r = await page.evaluate(async () => {
    const P = await import('/src/scene/pitch.js'), L = await import('/src/core/planning.js');
    const s = window.__trainr.store.get(), e = L.exercise(s, 'v21-dribbel6v6');
    const svg = Object.values(P).filter(f => typeof f === 'function').map(f => { try { return f(e); } catch { return ''; } }).find(x => typeof x === 'string' && x.includes('<svg')) || '';
    return { svg: svg.length, labels: [...svg.matchAll(/>(\d)<\/text>/g)].map(m => m[1]) };
  });
  expect(errors).toEqual([]);
  expect(r.svg).toBeGreaterThan(100);
  expect(r.labels.filter(x => x === '6').length).toBe(2);
});

test('Torwart-Handball: Quelle, Trainer als Zuspieler, Skript läuft', async ({ page }) => {
  const errors = watchErrors(page); await onboard(page);
  const r = await page.evaluate(async () => {
    const P = await import('/src/core/planning.js'), S = await import('/src/scene/scripts.js'), C = await import('/src/data/coach-roles.js');
    const s = window.__trainr.store.get(), e = P.exercise(s, 'gk-handball');
    const plan = S.scriptPlan(S.SCRIPTS['gk-handball']);
    return { name: e.name, url: e.url, src: e.sources.length, role: C.coachRole(e).role, ok: P.layout(s, e, { players: 0, keepers: 2, coaches: 1 }).level, none: P.layout(s, e, { players: 0, keepers: 2, coaches: 0 }).level, events: plan.events.length };
  });
  expect(r).toMatchObject({ name: 'Torwart-Handball', src: 1, ok: 'ok', none: 'no', events: 5 });
  expect(r.url).toContain('soccerdrills.de'); expect(r.role).toContain('Zuspiel');
  expect(errors).toEqual([]);
});

test('Sprachansagen: Schalter, Ansage bei Blockstart, Vorwarnung, Ende; aus = still', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.__said = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: u => window.__said.push(u.text + '|' + u.lang), cancel() {} }, configurable: true });
  });
  await onboard(page);
  const say = () => page.evaluate(() => window.__said.splice(0));
  await createSession(page); await setPauses(page, { count: 0, minutes: 2 });
  await page.goto('/#mehr'); await page.reload();
  const sw = page.locator('[data-toggle=speech]');
  await page.locator('details[data-more-group=controls] summary').click();
  await expect(sw).not.toBeChecked(); await sw.check({ force: true });
  expect((await say()).join()).toContain('de-DE');
  const calls = await page.evaluate(async () => {
    const T = await import('/src/core/timer.js'); window.__said.length = 0;
    const out = {}; T.sync();
    const snap = T.snapshot(); out.block = !!snap.block;
    if (snap.block) { T.start(); out.started = window.__said.splice(0); T.pause(); T.reset(); }
    window.__trainr.store.setting('speech', false);
    if (snap.block) { T.start(); out.off = window.__said.splice(0); T.pause(); }
    return out;
  });
  expect(calls.block).toBe(true);
  expect(calls.started.length).toBe(1); expect(calls.started[0]).toMatch(/^Los: .+\. \d+ Minuten\./);
  expect(calls.off).toEqual([]);
  expect(errors).toEqual([]);
});

test('Speicherschutz-Hinweis und Sicherheitsnetz bei Fehlern', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { value: { persisted: async () => false, persist: async () => true }, configurable: true });
  });
  await onboard(page);
  await page.goto('/#mehr');
  await expect(page.locator('#m-persist')).toContainText('geschützt', { timeout: 8000 });
  await page.evaluate(() => { setTimeout(() => { throw new Error('Testfehler'); }, 0); });
  await expect(page.locator('.toast, [role=status]').filter({ hasText: 'schiefgelaufen' }).first()).toBeVisible();
});

test('Ansage nennt die Trainerrolle bei Torwart-Handball', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.__said = [];
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', { value: { speak: u => window.__said.push(u.text), cancel() {} }, configurable: true });
  });
  await onboard(page, { type: 'keeper' });
  const said = await page.evaluate(async () => {
    const P = await import('/src/core/planning.js'), T = await import('/src/core/timer.js'), S = window.__trainr.store;
    S.setting('speech', true);
    S.update('T', s => { const p = P.currentPlan(s); p.sessionType = 'keeper'; p.people = 2; p.keepers = 0; p.coaches = 1; p.blocks = [{ id: 'bh', exerciseId: 'gk-handball', minutes: 6 }]; }, { undo: false });
    T.sync(); window.__said.length = 0; T.start(); T.pause();
    return window.__said.splice(0);
  });
  expect(said.join(' ')).toMatch(/Torwart-Handball.*Trainer: Flaches Zuspiel aus der Mitte/);
  expect(errors).toEqual([]);
});
