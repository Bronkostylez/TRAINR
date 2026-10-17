// Kartenset-Layout: vier handliche Karten pro A4-Seite, nur Druck (21.31.0).
const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, createSession, plan, go, setPauses } = require('./helpers.cjs');

async function html(page, style = 'brand') {
  return page.evaluate(async st => {
    const m = await import('/src/exports/sheet.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get();
    return m.printHtml(s, P.currentPlan(s), 'cardset', st);
  }, style);
}

test('Kartenset-Druck: Karten, Seiten zu je vier, Pausenkarte, Keeper-Markierung', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  const p = await plan(page);
  await setPauses(page, { count: 1, minutes: 3 });
  await page.evaluate(() => window.__trainr.store.update('Keeper-Block', d => {
    const P = d.plans.find(x => x.id === d.selectedPlanId);
    P.blocks.push({ id: 'kb1', exerciseId: 'gk-steps', minutes: 8 });
  }));
  const out = await html(page);
  expect(out).toContain('layout-cardset');
  expect(out).toContain('pitch-scene');
  for (const b of p.blocks.slice(0, 3)) {
    const name = await page.evaluate(async id => { const P = await import('/src/core/planning.js'); return P.exercise(window.__trainr.store.get(), id).name; }, b.exerciseId);
    expect(out).toContain(name.replace(/&/g, '&amp;'));
  }
  // Pausenkarte und Keeper-Markierung
  expect(out).toMatch(/a6card pause/);
  expect(out).toMatch(/a6card keeper/);
  // Höchstens vier Karten pro Seite, keine leere Seite
  const pages = out.split('<section class="a6page">').slice(1);
  expect(pages.length).toBeGreaterThan(0);
  for (const part of pages) {
    const cards = (part.split('</section>')[0].match(/class="a6card[ "]/g) || []).length;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThanOrEqual(4);
  }
  expect(errors).toEqual([]);
});

test('Export-Sheet: Kartenset deaktiviert PDF/PNG, Drucken bleibt, Hinweis sichtbar', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await go(page, '#planen');
  await page.click('#pl-share');
  await expect(page.locator('#ex-prev canvas').first()).toBeVisible();
  await page.click('dialog[open] [data-layout=cardset]');
  await expect(page.locator('dialog[open] [data-do=pdf]')).toBeDisabled();
  await expect(page.locator('dialog[open] [data-do=png]')).toBeDisabled();
  await expect(page.locator('dialog[open] [data-do=share]')).toBeDisabled();
  await expect(page.locator('dialog[open] [data-do=print]')).toBeEnabled();
  await expect(page.locator('#ex-prev')).toContainText('Druck');
  expect(await page.evaluate(() => window.__trainr.store.get().settings.exportLayout)).toBe('cardset');
  // Zurückwechseln aktiviert wieder
  await page.click('dialog[open] [data-layout=detailed]');
  await expect(page.locator('dialog[open] [data-do=pdf]')).toBeEnabled();
  await expect(page.locator('#ex-prev canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Kartenset: Einstellung übersteht Schema-Prüfung und Neustart', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.setting('exportLayout', 'cardset'));
  await page.reload();
  await expect.poll(async () => page.evaluate(() => window.__trainr?.store.get().settings.exportLayout)).toBe('cardset');
  expect(errors).toEqual([]);
});

test('Kartenset: englische Oberfläche übersetzt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  await page.evaluate(() => window.__trainr.store.setting('lang', 'en'));
  await page.reload(); // Sprachwechsel wirkt wie in der App über Neustart
  await go(page, '#planen');
  await page.click('#pl-share');
  const btn = page.locator('dialog[open] [data-layout=cardset]');
  await expect(btn).toHaveText('Card set');
  await btn.click();
  await expect(page.locator('#ex-printonly')).toContainText('printing only');
  expect(errors).toEqual([]);
});
