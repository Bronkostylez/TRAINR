const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, createSession, go, noOverflow } = require('./helpers.cjs');

// Montag, 12.10.2026, 10:00 Ortszeit. Trainingstag aus dem Onboarding: Dienstag 17:00–18:30.
const MONDAY = new Date('2026-10-12T10:00:00');

test('Kalender: Serie, Einheit zuordnen, Erinnerung, Nachbereitung, Ausfall, Rückblick', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await createSession(page);
  const p = await plan(page);

  await go(page, '#kalender');
  await expect(page.locator('#h-kalender')).toHaveText('Kalender');
  await expect.poll(() => noOverflow(page)).toBe(true);

  // Automatische Serie nach dem Onboarding: 8 Wochen ab heute → 8 Dienstage
  const s0 = await state(page), evs = s0.events;
  expect(evs).toHaveLength(8);
  expect(evs.every(e => new Date(e.date + 'T12:00').getDay() === 2 && e.start === '17:00' && e.remind === 60 && e.status === 'geplant' && e.seriesId === `auto-${s0.activeTeamId}`)).toBe(true);
  expect(s0.teams[0].seriesUntil).toBe('2026-12-06');
  // Manuelle Serie im selben Zeitraum überspringt belegte Tage
  await page.click('#cal-series');
  await expect(page.locator('#se-preview')).toContainText('schon belegt');
  await expect(page.locator('#se-go')).toBeDisabled();
  await page.keyboard.press('Escape');

  // Liste: Hinweis auf Trainings ohne Einheit → zuordnen
  await page.click('[data-mode=liste]');
  await expect(page.locator('#cal-body .ev-card')).toHaveCount(8);
  await page.click('[data-plan-ev]');
  await page.click(`dialog[open] [data-pick="${p.id}"]`);
  await expect.poll(async () => (await state(page)).events.find(e => e.date === '2026-10-13').planId).toBe(p.id);

  // Planer zeigt den Termin, Heute zeigt ihn als nächsten Termin
  await go(page, '#planen');
  await expect(page.locator('#pl-date')).toContainText('Morgen');
  await go(page, '#heute');
  await expect(page.locator('#h-heute')).toHaveText('Dienstag, 17:00');
  await expect(page.locator('#t-events .ev-card')).toHaveCount(3);

  // Erinnerung 60 Min vorher: Di 16:00
  await page.clock.fastForward('29:30:00'); // → Di 15:30
  await page.clock.runFor(31_000);
  await expect(page.locator('.toast')).not.toContainText('⏰');
  await page.clock.fastForward('00:35:00'); // → Di 16:05
  await page.clock.runFor(31_000);
  await expect(page.locator('.toast')).toContainText('⏰ Training · Heute, 17:00 Uhr');
  await expect(page.locator('.toast')).toContainText(p.name);

  // Nach dem Training: Nachbereitung
  await page.clock.fastForward('03:00:00'); // → Di 19:05
  await go(page, '#kalender');
  await expect(page.locator('.notice', { hasText: 'Nachbereitung' })).toBeVisible();
  await page.locator('.notice [data-ev]').click();
  await page.fill('#rv-att', '11');
  await page.click('dialog[open] [data-star="4"]');
  await page.fill('#rv-note', 'Passspiel klappte, Abschluss üben.');
  await page.click('#rv-save');
  let ev = (await state(page)).events.find(e => e.date === '2026-10-13');
  expect(ev).toMatchObject({ status: 'erledigt', attendance: 11, rating: 4, planId: p.id, note: 'Passspiel klappte, Abschluss üben.' });
  expect(ev.done).toMatchObject({ name: p.name, minutes: 90, exercises: p.blocks.map(b => b.exerciseId) });

  // Ausfall mit Grund, dann Rückgängig
  await page.click('[data-mode=liste]');
  await page.locator('#cal-body .ev-card').first().click();
  await page.click('dialog[open] [data-a=cancel]');
  await page.click('dialog[open] [data-reason="Wetter"]');
  await page.click('#cx-save');
  await expect.poll(async () => (await state(page)).events.find(e => e.date === '2026-10-20').status).toBe('ausgefallen');
  expect((await state(page)).events.find(e => e.date === '2026-10-20').reason).toBe('Wetter');
  await page.locator('.toast button', { hasText: 'Rückgängig' }).click();
  await expect.poll(async () => (await state(page)).events.find(e => e.date === '2026-10-20').status).toBe('geplant');

  // Rückblick
  await page.click('[data-mode=rueckblick]');
  await expect(page.locator('.stat').nth(0)).toContainText('1');
  await expect(page.locator('.stat').nth(3)).toContainText('11');
  await expect(page.locator('.stat').nth(4)).toContainText('1 h 30 Min');
  await expect(page.locator('#cal-body')).toContainText('Passspiel klappte');

  // Neu laden: alles gespeichert
  await page.reload();
  expect((await state(page)).events.find(e => e.date === '2026-10-13').status).toBe('erledigt');
  expect(errors).toEqual([]);
});

test('Kalender: Einzeltermin, Monatsansicht, Validierung, ICS, Serie löschen, Mannschaft löschen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await go(page, '#kalender');

  // Spiel am Samstag anlegen, zuerst mit ungültiger Uhrzeit
  await page.click('#cal-add');
  await page.click('dialog[open] [data-kind=spiel]');
  await page.fill('dialog[open] [name=title]', 'Pokal gegen SV');
  await page.fill('dialog[open] [name=date]', '2026-10-17');
  await page.fill('dialog[open] [name=start]', '10:00');
  await page.fill('dialog[open] [name=end]', '09:00');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ev-err')).toContainText('Ende');
  await page.fill('dialog[open] [name=end]', '11:30');
  await page.fill('dialog[open] [name=place]', 'Sportpark');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const s1 = await state(page);
  expect(s1.events).toHaveLength(9); // 8 automatische Trainings + Spiel
  expect(s1.events.find(e => e.kind === 'spiel')).toMatchObject({ kind: 'spiel', title: 'Pokal gegen SV', date: '2026-10-17', start: '10:00', end: '11:30', place: 'Sportpark', remind: null, planId: null });

  // Monatsansicht: Punkt am Samstag, Tagesliste, Tastatur, Blättern
  const day = page.locator('[data-day="2026-10-17"]');
  await expect(day.locator('.dots i.k-spiel')).toHaveCount(1);
  await expect(page.locator('#cal-daylist')).toContainText('Pokal gegen SV');
  await day.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-day="2026-10-18"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#cal-daylist')).toContainText('Kein Termin');
  await page.click('[data-month="1"]');
  await expect(page.locator('.cal-head h2')).toHaveText('November 2026');
  await page.click('#cal-today');
  await expect(page.locator('.cal-head h2')).toHaveText('Oktober 2026');
  await expect.poll(() => noOverflow(page)).toBe(true);

  // ICS-Export eines Termins
  await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  await page.click('[data-day="2026-10-17"]');
  await page.locator('#cal-daylist .ev-card').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] [data-a=ics]')]);
  expect(dl.suggestedFilename()).toBe('trainr-2026-10-17.ics');
  const ics = require('fs').readFileSync(await dl.path(), 'utf8');
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('DTSTART:20261017T100000');
  expect(ics).toContain('SUMMARY:Pokal gegen SV · E2');
  expect(ics).toContain('LOCATION:Sportpark');
  expect(ics).not.toContain('VALARM');
  await page.keyboard.press('Escape');

  // Automatische Serie ab dem zweiten Training löschen → Serie endet, nichts wird nachgefüllt
  await page.click('[data-mode=liste]');
  await page.locator('#cal-body .ev-card', { hasText: 'Training' }).nth(1).click();
  await page.click('dialog[open] [data-a=del]');
  await page.click('dialog[open] [data-rest]');
  await expect.poll(async () => (await state(page)).events.filter(e => e.kind === 'training').length).toBe(1);
  expect((await state(page)).teams[0].autoSeries).toBe(false);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect((await state(page)).events.filter(e => e.kind === 'training')).toHaveLength(1);

  // Zweite Mannschaft mit eigenem Termin; Löschen nimmt ihre Termine mit
  await page.evaluate(() => {
    const { store } = window.__trainr;
    store.update('Test', d => {
      d.teams.push({ id: 't2', name: 'D1', type: 'field', age: 'D-Jugend', slots: [{ day: 3, start: '18:00', end: '19:30' }], color: null });
      d.events.push({ id: 'e-t2', teamId: 't2', date: '2026-10-14', start: '18:00', end: '19:30', kind: 'training', title: '', place: '', planId: null, status: 'geplant', remind: null, note: '' });
    });
  });
  await go(page, '#mehr');
  await page.click('[data-del-team="t2"]');
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).events.some(e => e.teamId === 't2')).toBe(false);
  expect(errors).toEqual([]);
});

test('Kalender: Einheit löschen löst die Zuordnung, Zustand ohne Kalender wird ergänzt', async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await createSession(page);
  const p = await plan(page);
  await page.evaluate(id => {
    const { store } = window.__trainr, s = store.get();
    store.update('Test', d => { d.events.push({ id: 'e1', teamId: s.activeTeamId, date: '2026-10-13', start: '17:00', end: '18:30', kind: 'training', title: '', place: '', planId: id, status: 'geplant', remind: 60, note: '' }); });
  }, p.id);
  await go(page, '#planen');
  await page.click('#pl-more');
  await page.click('dialog[open] [data-a=del]');
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).events[0].planId).toBeNull();

  // Gespeicherter V21.0-Stand ohne `events` lädt weiter (Daten setzen, während die App nicht geöffnet ist)
  await page.evaluate(() => window.__trainr.store.flush());
  const old = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('trainr-v21')); delete s.events; delete s.teams[0].seriesUntil; return JSON.stringify(s); });
  await page.goto('/version.json');
  await page.evaluate(v => localStorage.setItem('trainr-v21', v), old);
  await page.goto('/');
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  expect((await state(page)).events).toHaveLength(8); // automatische Serie wird ergänzt
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => k.includes('recovery')))).toBe(false);
});

test('Kalender: automatische Serie rollt weiter, folgt geänderten Trainingszeiten, lässt gelöschte Termine weg', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  const tid = (await state(page)).activeTeamId, trainings = async () => (await state(page)).events.filter(e => e.kind === 'training').map(e => e.date + ' ' + e.start);

  // Einzelnen Termin löschen: kommt nicht wieder
  await go(page, '#kalender');
  await page.click('[data-mode=liste]');
  await page.locator('#cal-body .ev-card').nth(2).click(); // Di 27.10.
  await page.click('dialog[open] [data-a=del]');
  await page.click('dialog[open] [data-one]');
  await expect.poll(async () => (await trainings()).length).toBe(7);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await trainings()).not.toContain('2026-10-27 17:00');

  // Eine Woche später: Horizont wandert mit, eine neue Woche kommt dazu
  await page.clock.fastForward(7 * 864e5);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(async () => (await state(page)).teams[0].seriesUntil).toBe('2026-12-13');
  expect(await trainings()).toContain('2026-12-08 17:00');
  expect(await trainings()).not.toContain('2026-10-27 17:00');

  // Trainingszeiten ändern: Di 17:30–19:00, neu Do 16:00–17:30. Termin mit Einheit bleibt unverändert.
  const firstFuture = (await state(page)).events.find(e => e.date === '2026-10-20');
  await page.evaluate(([id, pid]) => window.__trainr.store.update('Test', d => { d.events.find(e => e.id === id).planId = pid; }), [firstFuture.id, (await state(page)).selectedPlanId]);
  await page.evaluate(async () => {
    const { store } = window.__trainr, m = await import('/src/core/calendar.js'), old = store.get().teams[0];
    store.update('Mannschaft geändert', d => { const t = { ...structuredClone(old), slots: [{ day: 1, start: '17:30', end: '19:00' }, { day: 3, start: '16:00', end: '17:30' }] }; delete t.seriesUntil; d.teams[0] = t; m.resyncAuto(d, old, t); });
  });
  const after = await trainings();
  expect(after).toContain('2026-10-20 17:00'); // mit Einheit: unverändert
  expect(after).toContain('2026-11-03 17:30');
  expect(after).toContain('2026-10-22 16:00');
  expect(after.filter(x => x.endsWith('17:00'))).toEqual(['2026-10-13 17:00', '2026-10-20 17:00']); // Vergangenes bleibt
  // Ausschalten im Kalendermenü und wieder einschalten
  await go(page, '#kalender');
  await page.click('#cal-more');
  await page.locator('dialog[open] label:has(#cal-auto)').click();
  await expect.poll(async () => (await state(page)).teams[0].autoSeries).toBe(false);
  await page.locator('dialog[open] label:has(#cal-auto)').click();
  await expect.poll(async () => (await state(page)).teams[0].autoSeries).toBeUndefined();
  expect((await state(page)).events.every(e => e.teamId === tid)).toBe(true);
  expect(errors).toEqual([]);
});
