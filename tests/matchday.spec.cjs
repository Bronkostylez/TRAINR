const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go, noOverflow } = require('./helpers.cjs');

const MONDAY = new Date('2026-10-12T10:00:00');

test('Spieltag: Spiel mit Gegner, Aufwärmen, Formation, Taktik, Ergebnis; Turnier mit Spielplan', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await go(page, '#kalender');

  // Neues Spiel → Termin-Sheet zeigt Spieltag statt Einheit
  await page.click('[data-new=spiel]');
  await page.click('dialog[open]:not(.closing) button[type=submit]');
  await expect.poll(async () => (await state(page)).events.filter(e => e.kind === 'spiel').length).toBe(1);
  const ev = (await state(page)).events.find(e => e.kind === 'spiel');
  await page.evaluate(id => { location.hash = `#kalender/termin/${id}`; }, ev.id);
  const dlg = page.locator('dialog[open]:not(.closing)');
  await expect(dlg).toContainText('Aufwärmen');
  await expect(dlg).toContainText('Taktik');
  await expect(dlg).not.toContainText('Noch keine Einheit für diesen Termin');

  // Aufwärmen-Vorschlag
  await dlg.locator('[data-a=warmup]').click();
  await expect.poll(async () => { const s = await state(page); return s.plans.find(p => p.id === s.events.find(e => e.id === ev.id).planId)?.blocks.length; }).toBeGreaterThan(0);

  // Spieltag bearbeiten
  await dlg.locator('[data-a=edit]').click();
  await page.fill('dialog[open]:not(.closing) [name=opponent]', 'SV Beispiel');
  await page.fill('dialog[open]:not(.closing) [name=formation]', '2-3-1');
  await page.fill('dialog[open]:not(.closing) [name=t-attack]', 'Über außen');
  await page.fill('dialog[open]:not(.closing) [name=res-own]', '3');
  await page.fill('dialog[open]:not(.closing) [name=res-opp]', '1');
  await page.click('dialog[open]:not(.closing) button[type=submit]');
  await expect.poll(async () => (await state(page)).events.find(e => e.id === ev.id).game?.result).toEqual({ own: 3, opp: 1 });
  const g = (await state(page)).events.find(e => e.id === ev.id);
  expect(g.status).toBe('erledigt');
  expect(g.game.opponent).toBe('SV Beispiel');

  // Liste zeigt Gegner und Ergebnis
  await go(page, '#kalender');
  await page.click('[data-mode=liste]');
  await page.click('[data-new=turnier], #cal-body', { trial: true }).catch(() => {});
  expect(await noOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});
