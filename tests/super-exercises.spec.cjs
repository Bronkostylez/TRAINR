const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go, plan, noOverflow } = require('./helpers.cjs');

async function open(page, id) {
  await go(page, '#uebungen');
  await page.evaluate(async id => { const m = await import('/src/views/detail.js'); m.openDetail(id); }, id);
  await expect(page.locator('dialog[open] #d-scene')).toBeVisible();
}
const chip = (page, text) => page.locator('dialog[open] #d-super .chip', { hasText: text }).first();

test('Passformen: Fünfeck ändert Aufbau, Spielerzahl, Material und Animation; Variante landet im Plan', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await open(page, 'v22-quadrat');
  await expect(page.locator('dialog[open] #d-super')).toBeVisible();
  const cones = () => page.locator('dialog[open] #d-scene .setup-cone').count();
  const before = await cones();
  await chip(page, 'Fünfeck').click();
  await expect(page.locator('dialog[open] h2, dialog[open] .sheet-title').first()).toContainText('Fünfeck');
  expect(await cones()).toBeGreaterThan(before);
  await expect(page.locator('dialog[open] .facts')).toContainText('5');
  // Stellschraube: zwei Bälle
  await page.locator('dialog[open] #d-super summary').click();
  await page.locator('dialog[open] #d-super .seg button', { hasText: '2 Bälle' }).click();
  await expect(page.locator('dialog[open] #d-steps li').last()).toContainText('Zwei Bälle');
  // Animation läuft bis zum Ende ohne Fehler
  await page.click('dialog[open] #d-play');
  await page.waitForTimeout(900);
  expect(await noOverflow(page)).toBe(true);
  await page.click('dialog[open] #d-add');
  const p = await plan(page);
  expect(p.blocks.at(-1).exerciseId).toBe('v22-quadrat~f5.b2');
  expect(errors).toEqual([]);
  // nach Neuladen weiter gültig und mit eigenem Namen sichtbar
  await page.reload(); await go(page, '#planen');
  await expect(page.locator('body')).toContainText('Pass und Nachlaufen · Fünfeck · 2 Bälle');
  expect(errors).toEqual([]);
});

test('Alle Familien: jede Vorgabe und jede Stellschraube liefert eine abspielbare Variante', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  for (const id of ['v22-quadrat', 'v5-rondo', 'v22-slalom']) {
    await open(page, id);
    const n = await page.locator('dialog[open] #d-super .chip').count();
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) {
      await page.locator('dialog[open] #d-super .chip').nth(i).click();
      await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toBeVisible();
      await page.click('dialog[open] #d-play'); await page.waitForTimeout(250);
      expect(await noOverflow(page)).toBe(true);
    }
    // jede Stellschraube einzeln
    await page.locator('dialog[open] #d-super summary').click();
    const segs = await page.locator('dialog[open] #d-super .seg button').count();
    for (let i = 0; i < segs; i++) {
      await page.locator('dialog[open] #d-super .seg button').nth(i).click();
      await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toBeVisible();
      await page.click('dialog[open] #d-play'); await page.waitForTimeout(150);
    }
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close()));
  }
  expect(errors).toEqual([]);
});

test('Ungültige Varianten-Kennung wird nicht akzeptiert, Grundübung bleibt', async ({ page }) => {
  await onboard(page);
  const r = await page.evaluate(async () => {
    const S = await import('/src/core/schema.js'), P = await import('/src/core/planning.js'), s = window.__trainr.store.get();
    return { ok: S.validVariantId('v22-quadrat~f5.b2'), badVal: S.validVariantId('v22-quadrat~f9'), badKey: S.validVariantId('v22-quadrat~z1'), nonCanon: S.validVariantId('v22-quadrat~f4'), dreiBall: S.validVariantId('v22-quadrat~f3.b2'), unknownBase: S.validVariantId('gk-strike~f5'), ex: !!P.exercise(s, 'v22-quadrat~f5'), none: P.exercise(s, 'v22-quadrat~f9') };
  });
  expect(r).toEqual({ ok: true, badVal: false, badKey: false, nonCanon: false, dreiBall: false, unknownBase: false, ex: true, none: null });
});

test('Englisch: Varianten-Texte erscheinen auf Englisch', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.update('Sprache', d => { d.settings.lang = 'en'; }));
  await page.reload(); await open(page, 'v5-rondo');
  await expect(page.locator('dialog[open] #d-super')).toContainText('Super exercise');
  await chip(page, '4 v 2').click();
  await expect(page.locator('dialog[open] #d-steps')).toContainText('outside players');
  expect(errors).toEqual([]);
});

test('Variante im Plan: Training, Export, Backup und Zurückspielen funktionieren', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  const { createSession } = require('./helpers.cjs');
  await createSession(page);
  await page.evaluate(() => window.__trainr.store.update('Varianten', d => {
    const p = d.plans.find(x => x.id === d.selectedPlanId), ids = ['v22-quadrat~f6.b2.r2', 'v5-rondo~o4.v2.r3', 'v22-slalom~n3.m1'];
    p.blocks.slice(0, 3).forEach((b, i) => { b.exerciseId = ids[i]; });
  }));
  await go(page, '#planen');
  await expect(page.locator('body')).toContainText('Rondo · 4 gegen 2');
  await page.click('#pl-share');
  await expect(page.locator('#ex-prev canvas').first()).toBeVisible();
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] [data-do=pdf]')]);
  expect(d.suggestedFilename()).toMatch(/\.pdf$/);
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach(x => x.close()));
  await go(page, '#heute'); await page.click('#t-start');
  await expect(page.locator('section[data-view=training]')).toBeVisible();
  await expect(page.locator('section[data-view=training] .pitch-scene').first()).toBeVisible();
  await page.reload();
  await go(page, '#planen');
  await expect(page.locator('body')).toContainText('Sechseck');
  expect(errors).toEqual([]);
});

test('Als eigene Übung: generierte Animation wird in die Skizze übernommen und bleibt abspielbar', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await open(page, 'v5-rondo~o4.v2');
  await page.click('dialog[open] #d-copy');
  await expect(page.locator('#ed-pitch')).toBeVisible();
  await expect(page.locator('.ed-copy-notice')).toContainText('Nicht übernommen oder vereinfacht: Spielfeld-Rahmen');
  await page.waitForTimeout(500); await expect(page.locator('.ed-copy-notice')).toBeVisible();
  await page.locator('[data-ed-tab=details]').evaluate(b => b.click());
  await page.click('.mat-toggle >> nth=0').catch(() => {});
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] #d-scene')).toBeVisible();
  const c = (await state(page)).custom.at(-1);
  expect(c.animation.version).toBe(2);
  expect(c.animation.frames.length).toBeGreaterThan(3);
  expect(c.animation.items.filter(i => i.k === 'b').length).toBe(2);
  await page.click('dialog[open] #d-play'); await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
