const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go } = require('./helpers.cjs');

test('Bibliothek: Suche, Filter, Merkliste, Detail, Bewertung, Notiz, Variante, Zufall', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  const cards = page.locator('#lib-grid .drill');
  await expect(cards.first()).toBeVisible();
  await expect.poll(() => cards.count()).toBeGreaterThan(30);
  // Alle Altersklassen + alle Trainerarten = gesamter aktiver Katalog
  await page.click('#lib-filter');
  await page.click('dialog[open] [data-k=type][data-v=all]');
  await page.selectOption('dialog[open] [data-sel=age]', 'all');
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(146);
  // Archivierte einblenden
  await page.click('#lib-filter');
  await page.locator('dialog[open] [data-chk=archived]').check({ force: true });
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(148);
  // Kategorie Falltechnik: 2 Übungen, keine für Bambini
  await page.click('#lib-filter');
  await page.click('[data-tagf="Falltechnik"]');
  await page.click('dialog[open] [data-fapply]');
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
  await page.click('#lib-filter');
  await page.click('[data-scope=fav]');
  await page.click('dialog[open] [data-fapply]');
  await expect(cards).toHaveCount(1);
  await page.click('#lib-filter');
  await page.click('[data-scope=all]');
  await page.click('dialog[open] [data-fapply]');
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
  await page.click('#lib-more');
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
  expect(r.n).toBe(148);
  expect(r.ids).toBe(148);
  expect(r.incomplete).toEqual([]);
  expect(r.heading).toEqual([]);
  expect(r.fall.every(a => a === 'D-Jugend')).toBe(true);
  expect(r.bambiniKeeper).toEqual([]);
});

test('Spielzug-Skripte: jedes Skript gültig, Schritte passen zum Ablauf, Animation mit Spuren und Schrittwechsel', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const P = await import('/src/core/planning.js'), S = await import('/src/scene/scripts.js'), Pi = await import('/src/scene/pitch.js'), M = await import('/src/scene/motion.js');
    const s = window.__trainr.store.get(), bad = [];
    M.setResolver(id => P.exercise(s, id));
    const host = document.createElement('div'); host.style.width = '320px'; document.body.appendChild(host);
    let trails = 0, stepsSeen = 0;
    for (const [id, sc] of Object.entries(S.SCRIPTS)) {
      const e = P.exercise(s, id);
      if (!e) { bad.push(id + ': keine Übung'); continue; }
      const steps = Pi.stepsFor(e), maxStep = Math.max(...sc.ph.map(x => x[0]));
      if (maxStep >= steps.length) bad.push(`${id}: Schritt ${maxStep} > ${steps.length - 1}`);
      if (sc.pl.some(([x, y]) => x < 15 || x > 305 || y < 12 || y > 178)) bad.push(id + ': Spieler außerhalb');
      host.innerHTML = Pi.drillPitch(e, true, 0);
      const tl = M.compile(host.querySelector('.pitch-scene'), steps.length, { camera: true });
      if (!tl) { bad.push(id + ': keine Zeitleiste'); continue; }
      trails += host.querySelectorAll('.mv-trail').length;
      const seen = new Set(); for (let t = 0; t <= tl.total; t += 100) seen.add(tl.stepAt(t));
      if (seen.size < 2) bad.push(id + ': kein Schrittwechsel');
      stepsSeen += seen.size;
      if (tl.stepStart(1) <= 0 || tl.stepAt(tl.stepStart(maxStep)) !== maxStep) bad.push(id + ': stepStart passt nicht');
      tl.destroy();
      if (host.querySelector('.mv-trails')) bad.push(id + ': Spuren nicht aufgeräumt');
    }
    host.remove();
    const newOnes = P.allExercises(s).filter(e => e.id.startsWith('v22-'));
    return { bad, trails, stepsSeen, n: Object.keys(S.SCRIPTS).length, newOnes: newOnes.length, newScripted: newOnes.every(e => S.SCRIPTS[e.id]), variants: newOnes.every(e => e.variants?.length === 2) };
  });
  expect(r.bad).toEqual([]);
  expect(r.n).toBeGreaterThanOrEqual(26);
  expect(r.trails).toBeGreaterThan(100);
  expect(r.newOnes).toBe(41);
  expect(r.newScripted).toBe(true);
  expect(r.variants).toBe(true);
  expect(errors).toEqual([]);
});

test('Bibliothek: Neu-Bereich, kompakte Liste, nach Kategorie gruppiert, Lernweg im Detail', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page, { age: 'D-Jugend' });
  await go(page, '#uebungen');
  await page.click('#lib-filter');
  await page.click('dialog[open] [data-k=type][data-v=all]');
  await page.click('dialog[open] [data-k=sort][data-v=tag]');
  await page.click('dialog[open] [data-fapply]');
  await page.click('#lib-filter');
  await expect(page.locator('#lib-tags [data-tagf="Aufwärmen"] .count')).not.toHaveText('0');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#lib-grid .lib-group').first()).toContainText('Aufwärmen');
  await page.click('#lib-more');
  await page.click('[data-libview=compact]');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('#lib-grid .drill-row').first()).toBeVisible();
  await expect(page.locator('#lib-grid .drill:not(.drill-row)')).toHaveCount(0);
  await page.click('#lib-filter');
  await page.click('[data-scope=new]');
  await page.click('dialog[open] [data-fapply]');
  // Katalog lädt gestaffelt nach: warten, bis jede sichtbare Karte „Neu“ ist und alle Karten da sind
  await expect.poll(async () => { const n = await page.locator('#lib-grid .drill').count(); return n > 8 && n === await page.locator('#lib-grid .drill .tag.new').count(); }).toBe(true);
  // Plan-Knopf in der kompakten Zeile
  await page.locator('#lib-grid .drill-row [data-add]').first().click();
  expect((await state(page)).plans.some(p => p.blocks.length === 1)).toBe(true);
  // Ansicht bleibt nach Neuladen erhalten
  await page.reload();
  await go(page, '#uebungen');
  await page.click('#lib-more');
  await expect(page.locator('[data-libview=compact]')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.click('#lib-more');
  await page.click('[data-libview=cards]');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.fill('#lib-q', 'Drei gegen zwei mit Konter');
  await page.locator('.drill h3').first().click();
  await expect(page.locator('dialog[open] .tag.new')).toBeVisible();
  await expect(page.locator('dialog[open]')).toContainText('Lernweg');
  await expect(page.locator('dialog[open]')).toContainText('Leichter:');
  expect(errors).toEqual([]);
});
