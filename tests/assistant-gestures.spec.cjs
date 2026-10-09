const { test, expect } = require('@playwright/test');
const { onboard } = require('./helpers.cjs');

test('Planassistent-Matrix: Altersklasse × Trainerart × Spieler × Minuten × Strategie', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const A = await import('/src/core/assistant.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get(), out = { ok: 0, rejected: 0, bugs: [] };
    for (const age of P.AGES) for (const type of ['field', 'keeper', 'both']) for (const people of [1, 2, 3, 4, 6, 7, 9, 12, 16, 20, 25]) for (const minutes of [30, 45, 60, 75, 90, 120]) for (const strategy of Object.keys(A.STRATEGIES)) {
      let pr;
      try { pr = A.propose(s, { age, people, minutes, focus: 'Alle', type, strategy, seed: people * minutes }); } catch { out.rejected++; continue; }
      out.ok++;
      if (pr.blocks.reduce((a, b) => a + b.minutes, 0) !== minutes) out.bugs.push(`Summe ${age} ${type} ${people} ${minutes}`);
      if (new Set(pr.blocks.map(b => b.exerciseId)).size !== pr.blocks.length) out.bugs.push(`Doppelt ${age} ${type}`);
      for (const b of pr.blocks) {
        const e = P.exercise(s, b.exerciseId);
        if (e.tag === 'Falltechnik') out.bugs.push(`Falltechnik ${age}`);
        if (!e.ages.includes(age)) out.bugs.push(`Alter ${e.id} ${age}`);
        if (!P.groupsFor(e, people)) out.bugs.push(`Gruppen ${e.id} ${people}`);
        if (P.AGES.indexOf(age) <= 1 && e.type === 'keeper') out.bugs.push(`Keeper-Spezialisierung ${age}`);
        if (e.archived) out.bugs.push(`archiviert ${e.id}`);
        if (b.minutes < 3) out.bugs.push(`zu kurz ${e.id}`);
      }
    }
    return out;
  });
  console.log(`Assistent: ${r.ok} gültige Vorschläge, ${r.rejected} begründet abgelehnt`);
  expect(r.bugs).toEqual([]);
  expect(r.ok).toBeGreaterThan(2000);
});

test('Wischen zwischen Tabs (Touch)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await onboard(page);
  const swipe = async (fromX, toX) => {
    await page.evaluate(([a, b]) => {
      const t = (x) => new Touch({ identifier: 1, target: document.querySelector('#main h1'), clientX: x, clientY: 300 });
      const el = document.querySelector('#main h1');
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], changedTouches: [t(a)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(b)], bubbles: true }));
    }, [fromX, toX]);
  };
  await swipe(320, 80);
  await expect(page.locator('section[data-view=uebungen]')).toBeVisible();
  await swipe(80, 320);
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  await ctx.close();
});

test('Alte V20-Adressen (#plan, #profil) und Zurück-Taste schließt zuerst das Sheet', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => { location.hash = '#plan'; });
  await expect(page.locator('section[data-view=planen]')).toBeVisible();
  await page.evaluate(() => { location.hash = '#profil'; });
  await expect(page.locator('section[data-view=mehr]')).toBeVisible();
  await page.evaluate(() => { location.hash = '#uebungen'; });
  await page.locator('#lib-grid .drill h3').first().click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('section[data-view=uebungen]')).toBeVisible();
});
