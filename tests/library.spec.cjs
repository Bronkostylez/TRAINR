const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go } = require('./helpers.cjs');

test('Bibliothek: Suche, Filter, Merkliste, Detail, Bewertung, Notiz, Variante, Zufall', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  const cards = page.locator('#lib-grid .drill');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(30);
  // Alle Altersklassen + alle Trainerarten = gesamter aktiver Katalog
  await page.click('#lib-filter');
  await page.click('dialog[open] [data-k=type][data-v=all]');
  await page.selectOption('dialog[open] [data-sel=age]', 'all');
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(105);
  // Archivierte einblenden
  await page.click('#lib-filter');
  await page.locator('dialog[open] [data-chk=archived]').check({ force: true });
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(107);
  // Kategorie Falltechnik: 2 Übungen, keine für Bambini
  await page.click('[data-tagf="Falltechnik"]');
  await expect(cards).toHaveCount(2);
  await page.click('#lib-filter');
  await page.selectOption('dialog[open] [data-sel=age]', 'Bambini');
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(0);
  await page.locator('[data-reset]').first().click();
  // Suche
  await page.fill('#lib-q', 'xxxxx');
  await expect(cards).toHaveCount(0);
  await page.fill('#lib-q', 'Hütchen');
  expect(await cards.count()).toBeGreaterThan(5);
  await page.fill('#lib-q', '');
  // Merkliste
  const firstId = await cards.first().getAttribute('data-id');
  await cards.first().locator('[data-fav]').click();
  await page.click('[data-scope=fav]');
  await expect(cards).toHaveCount(1);
  await page.click('[data-scope=all]');
  // Detail
  await cards.first().locator('h3').click();
  const dlg = page.locator('dialog[open]');
  await expect(dlg).toContainText('Ziel');
  await expect(dlg).toContainText('Quellen');
  await expect(dlg.locator('a.source').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(dlg.locator('a.source').first()).toHaveAttribute('rel', /noopener/);
  await dlg.locator('[data-rate-star="5"]').click();
  await dlg.locator('#d-note').fill('Hat super geklappt');
  await dlg.locator('#d-note').blur();
  await dlg.locator('summary', { hasText: 'Deine Variante' }).click();
  await dlg.locator('#v-min').fill('2'); await dlg.locator('#v-max').fill('8'); await dlg.locator('#v-min2').fill('9');
  await dlg.locator('#v-save').click();
  const title = await page.locator('dialog[open] .sheet-head h2').textContent();
  // Blättern per Pfeiltaste
  await page.locator('dialog[open] .sheet-head h2').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('dialog[open] .sheet-head h2')).not.toHaveText(title);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const s = await state(page);
  const rated = Object.entries(s.exerciseMeta).find(([, m]) => m.rating === 5);
  expect(rated[1]).toMatchObject({ note: 'Hat super geklappt', variant: { min: 2, max: 8, minutes: 9 } });
  expect(s.exerciseMeta[firstId].favorite).toBe(true);
  // Zufall öffnet Detail; Hinzufügen landet im Plan
  await page.click('#lib-random');
  await expect(page.locator('dialog[open] #d-add')).toBeVisible();
  await page.click('dialog[open] #d-add');
  await page.keyboard.press('Escape');
  expect((await state(page)).plans[0].blocks.length).toBe(1);
  await page.reload();
  expect((await state(page)).exerciseMeta[firstId].favorite).toBe(true);
  expect(errors).toEqual([]);
});

test('Jede Übung hat Ziel, Coaching-Punkte und https-Quelle; keine Kopfbälle; Falltechnik nur ab D-Jugend', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const P = await import('/src/core/planning.js'), D = await import('/src/data/drills.js');
    const s = window.__trainr.store.get();
    const all = D.SEED.map(e => P.exercise(s, e.id));
    return {
      n: all.length, ids: new Set(all.map(e => e.id)).size,
      incomplete: all.filter(e => !e.goal || !(e.points?.length >= 2) || !e.sources?.length || e.sources.some(x => !x.url.startsWith('https://'))).map(e => e.id),
      heading: all.filter(e => /kopfball/i.test(e.name + e.description + e.coaching + (e.points || []).join(' '))).map(e => e.id),
      fall: all.filter(e => e.tag === 'Falltechnik').map(e => e.ages[0]),
      bambiniKeeper: all.filter(e => e.type === 'keeper' && e.ages.includes('Bambini')).map(e => e.id),
    };
  });
  expect(r.n).toBe(107);
  expect(r.ids).toBe(107);
  expect(r.incomplete).toEqual([]);
  expect(r.heading).toEqual([]);
  expect(r.fall.every(a => a === 'D-Jugend')).toBe(true);
  expect(r.bambiniKeeper).toEqual([]);
});
