const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, createSession, go, noOverflow } = require('./helpers.cjs');

// Montag, 12.10.2026, 10:00 Ortszeit. Trainingstag aus dem Onboarding: Dienstag.
const MONDAY = new Date('2026-10-12T10:00:00');

test('Schwerpunkte: Detail, Chips führen in die gefilterte Bibliothek, Filter-Sheet', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.fill('#lib-q', 'Schulterblick vor Ballannahme');
  await expect(page.locator('.drill')).toHaveCount(1);
  await expect(page.locator('.drill .fchip')).toHaveText(['Wahrnehmung', 'Ballannahme']);
  await page.locator('.drill h3').click();
  const sec = page.locator('dialog[open] .detail-foci');
  await sec.locator('summary').click(); // seit 21.26 eingeklappt
  await expect(sec).toContainText('Hauptschwerpunkt');
  await expect(sec.locator('li')).toHaveCount(2);
  // Chip antippen: Sheet zu, Bibliothek nach Schwerpunkt gefiltert
  await sec.locator('[data-focus-link="Wahrnehmung"]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#lib-foci')).toContainText('Wahrnehmung ✕');
  await expect(page.locator('#lib-q')).toHaveValue('');
  const texts = await page.locator('.drill').allTextContents();
  expect(texts.length).toBeGreaterThan(5);
  expect(texts.every(t => t.includes('Wahrnehmung'))).toBe(true);
  // Filter entfernen, dann über das Filter-Sheet Torschuss wählen
  await page.click('[data-focus-off="Wahrnehmung"]');
  await page.click('#lib-filter');
  await page.click('dialog[open] [data-fk="Torschuss"]');
  await page.click('dialog[open] [data-fapply]');
  await expect(page.locator('#lib-foci')).toContainText('Torschuss');
  const shots = await page.locator('.drill').allTextContents();
  expect(shots.length).toBeGreaterThan(3);
  expect(shots.every(t => t.includes('Torschuss'))).toBe(true);
  expect(await noOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('Schwerpunkte in Einheit: Übersicht, Auswahl, Check, Assistent, Heute, Training, Export', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  // Heute: „Im Fokus“ im Einheiten-Kasten
  await expect(page.locator('.hero-foci .fchip').first()).toBeVisible();
  await go(page, '#planen');
  await page.locator('.focus-strip summary').first().click(); await expect(page.locator('.focus-strip .abar i').first()).toBeVisible();
  await expect(page.locator('.block-sub').first()).not.toBeEmpty();
  // Schwerpunkt der Einheit aus dem gruppierten Sheet wählen
  await page.locator('#pl-options').evaluate(e => e.open = true);
  await page.click('#pl-focus');
  await expect(page.locator('dialog[open] .fpick-h')).toHaveCount(4);
  await page.click('dialog[open] [data-v="Wahrnehmung"]');
  await expect.poll(async () => (await plan(page)).focus).toBe('Wahrnehmung');
  await expect(page.locator('#pl-focus')).toContainText('Wahrnehmung');
  // Check: Abdeckung des Schwerpunkts + Minutenbalken
  await page.click('[data-ptab=check]');
  await expect(page.locator('.check-list')).toContainText('Schwerpunkt „Wahrnehmung“');
  expect(await page.locator('.fbar').count()).toBeGreaterThan(2);
  // Assistent mit neuem Schwerpunkt: der Schwerpunkt-Block trainiert ihn
  await page.click('[data-ptab=ablauf]');
  await page.click('#pl-assist');
  await page.click('dialog[open] [data-af="Wahrnehmung"]'); // Vorauswahl abwählen, damit genau ein Schwerpunkt aktiv ist
  await page.click('dialog[open] [data-af="Ballannahme"]');
  await expect(page.locator('.proposal-item', { hasText: 'dein Schwerpunkt' }).first()).toBeVisible();
  await page.locator('.proposal-item', { hasText: 'dein Schwerpunkt' }).first().locator('summary').click(); // Begründung ist seit 21.16 eingeklappt
  await expect(page.locator('.proposal-item .fchip.mark', { hasText: 'Ballannahme' }).first()).toBeVisible();
  await page.click('dialog[open] [data-apply=replace]');
  await expect.poll(async () => (await plan(page)).focus).toBe('Ballannahme');
  // Training: Schwerpunkte des aktuellen Blocks im Timer
  await go(page, '#training');
  await expect(page.locator('.clock-foci .fchip').first()).toBeVisible();
  // Export: Kopfzeile mit Schwerpunkten
  const txt = await page.evaluate(async () => { const m = await import('./src/exports/doc.js'); const s = window.__trainr.store.get(); return m.planText(s, s.plans.find(p => p.id === s.selectedPlanId)); });
  expect(txt).toMatch(/Schwerpunkte: .*Ballannahme \(\d+ Min\)/);
  expect(errors).toEqual([]);
});

test('Eigene Übung: mehrere Schwerpunkte wählen, Reihenfolge = Gewicht, höchstens vier', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.click('#lib-new');
  await page.fill('#ed [name=name]', 'Sprint zum Abschluss');
  await page.locator('[data-ed-tab=details]').evaluate(b => b.click());
  await page.click('.mat[data-mat="Bälle"] .mat-toggle');
  for (const k of ['Torschuss', 'Schnelligkeit', 'Wahrnehmung', 'Koordination']) await page.click(`[data-efocus="${k}"]`);
  await expect(page.locator('[data-efocus="Torschuss"]')).toContainText('★');
  await page.click('[data-efocus="Dribbling"]'); // fünfter: abgelehnt
  await expect(page.locator('[data-efocus="Dribbling"]')).toHaveAttribute('aria-pressed', 'false');
  await page.click('[data-efocus="Koordination"]'); // wieder abwählen
  await page.click('dialog[open] button[type=submit]');
  await expect.poll(async () => (await state(page)).custom[0]?.focus).toEqual(['Torschuss', 'Schnelligkeit', 'Wahrnehmung']);
  await expect(page.locator('dialog[open] .detail-foci li').first()).toContainText('Torschuss');
  // Kopie einer Katalog-Übung übernimmt deren Schwerpunkte
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.fill('#lib-q', 'Doppelpass mit Laufweg');
  await expect(page.locator('.drill')).toHaveCount(1);
  await page.locator('.drill h3').first().click();
  await expect(page.locator('dialog[open] .sheet-head h2')).toHaveText('Doppelpass mit Laufweg');
  await page.click('#d-copy');
  await expect(page.locator('#ed [name=name]')).toHaveValue('Doppelpass mit Laufweg (eigene)');
  await expect(page.locator('[data-efocus="Zusammenspiel"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('dialog[open] button[type=submit]');
  await expect.poll(async () => (await state(page)).custom[1]?.focus).toEqual(['Zusammenspiel', 'Passspiel', 'Freilaufen']);
  expect(errors).toEqual([]);
});

test('Rückblick: Woche und Monat mit Schwerpunkt-Minuten, Blättern, Vergleich, ältere Momentaufnahmen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await page.evaluate(() => {
    const ev = (id, date, done) => ({ id, teamId: null, date, start: '08:00', end: '09:00', kind: 'training', title: '', place: '', planId: null, status: 'erledigt', remind: null, note: '', attendance: 10, done });
    window.__trainr.store.update('Testdaten', d => {
      const t = d.activeTeamId;
      d.events.push(
        { ...ev('w0', '2026-10-12', { name: 'Heute früh', minutes: 20, focus: 'Alle', exercises: ['v5-wall'], blocks: [['v5-wall', 20]] }), teamId: t },
        { ...ev('w1', '2026-10-06', { name: 'Letzte Woche', minutes: 60, focus: 'Torschuss', exercises: ['v5-scan', 'finish'], blocks: [['v5-scan', 25], ['finish', 35]] }), teamId: t },
        // Momentaufnahme aus 21.1 ohne Blockminuten: Zeit wird gleichmäßig verteilt
        { ...ev('w2', '2026-09-29', { name: 'Alt', minutes: 40, focus: 'Alle', exercises: ['v5-rondo', 'gatepass'] }), teamId: t },
      );
    });
  });
  await go(page, '#kalender/rueckblick');
  await expect(page.locator('.rv-label')).toContainText('Diese Woche');
  await expect(page.locator('[data-shift="1"]')).toBeDisabled();
  await expect(page.locator('.rv-foci .fbar').first()).toContainText('Zusammenspiel');
  await expect(page.locator('.rv-foci .fbar').first()).toContainText('20 Min');
  // Eine Woche zurück
  await page.click('[data-shift="-1"]');
  await expect(page.locator('.rv-label')).toContainText('Letzte Woche');
  const rows = page.locator('.rv-foci .fbar');
  await expect(rows.filter({ hasText: 'Torschuss' })).toContainText('35 Min · 1×');
  await expect(rows.filter({ hasText: 'Wahrnehmung' })).toContainText('25 Min');
  await expect(page.locator('.rv-foci')).toContainText('Gegenüber der Vorwoche');
  await expect(page.locator('.rv-foci')).toContainText('Gewählter Schwerpunkt der Einheiten: Torschuss 1×');
  await expect(page.locator('.rv-foci .abar i')).not.toHaveCount(0);
  // Monat: Oktober enthält beide Trainings, September die alte Momentaufnahme
  await page.click('[data-range=monat]');
  await expect(page.locator('.rv-label')).toHaveText('Oktober 2026');
  await expect(page.locator('.stat').first()).toContainText('2');
  await page.click('[data-shift="-1"]');
  await expect(page.locator('.rv-label')).toHaveText('September 2026');
  await expect(rows.filter({ hasText: 'Ballbesitz' })).toContainText('20 Min');
  await expect(rows.filter({ hasText: 'Passspiel' })).toContainText('40 Min · 1×');
  expect(await noOverflow(page)).toBe(true);
  // Termin im Verlauf zeigt die Schwerpunkte
  await expect(page.locator('.ev-card .ev-foci').first()).toContainText('Ballbesitz');
  // Zeile antippen → passende Übungen
  await rows.filter({ hasText: 'Ballbesitz' }).click();
  await expect(page.locator('#lib-foci')).toContainText('Ballbesitz');
  // Heute: Zusammenfassung der letzten 14 Tage und „lange nicht trainiert“
  await go(page, '#heute');
  await expect(page.locator('.focus-recap')).toContainText('3 Trainings');
  await expect(page.locator('.focus-recap')).toContainText('Seit 4 Wochen nicht dabei');
  const d = page.locator('#t-create');
  if (!(await d.evaluate(x => x.open))) await d.locator('summary').click();
  const gap = await page.locator('[data-gap]').first().getAttribute('data-gap');
  await page.locator('[data-gap]').first().click();
  const sheet = page.locator('dialog[open].sheet');
  await expect(sheet.locator('.proposal-item').first()).toBeVisible();
  await expect(sheet.locator(`[data-af="${gap}"]`)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('Ältere Stände: Kategorie als Einheiten-Schwerpunkt und eigene Übung ohne Schwerpunkte bleiben gültig', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await page.evaluate(() => window.__trainr.store.update('Alt', d => {
    const p = d.plans.find(x => x.id === d.selectedPlanId); p.focus = 'Spielform';
    d.custom.push({ id: 'custom-alt', name: 'Alte Übung', type: 'field', tag: 'Torschuss', ages: ['E-Jugend'], min: 2, max: 4, minutes: 8, description: 'Ablauf.', coaching: 'Hinweis.', equipment: [['Bälle', 2]], url: '', custom: true });
  }));
  await page.reload();
  expect((await plan(page)).focus).toBe('Spielform');
  await go(page, '#planen');
  await expect(page.locator('#pl-focus')).toContainText('Spielform');
  await page.locator('#pl-options').evaluate(e => e.open = true);
  await page.click('#pl-focus');
  await expect(page.locator('dialog[open]')).toContainText('Kategorie aus einer älteren Version');
  await page.keyboard.press('Escape');
  // Escape animiert das Sheet noch 200 ms aus. Erst danach navigieren,
  // sonst kann der ausstehende History-Schritt die neue Ansicht neu zeichnen.
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  // Eigene Übung ohne Auswahl erbt die Kategorie als Schwerpunkt
  await go(page, '#uebungen');
  await page.fill('#lib-q', 'Alte Übung');
  await expect(page.locator('.drill .fchip')).toHaveText(['Torschuss']);
  // Ungültige Schwerpunkte werden abgelehnt
  const rejected = await page.evaluate(() => { try { window.__trainr.store.update('x', d => { d.custom[0].focus = ['Gibtsnicht']; }); return false; } catch { return true; } });
  expect(rejected).toBe(true);
  expect(errors).toEqual([]);
});
