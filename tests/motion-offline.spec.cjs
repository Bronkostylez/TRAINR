const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, plan, createSession, go } = require('./helpers.cjs');

const running = page => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);

test('Animationsschalter: Voll → Animationen laufen; Aus → keine laufenden Animationen', async ({ page }) => {
  await onboard(page);
  await go(page, '#uebungen');
  await expect(page.locator('#lib-grid .drill').first()).toBeVisible();
  await expect.poll(() => running(page), { timeout: 5000 }).toBeGreaterThan(0); // Kartenanimationen
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('full');
  await go(page, '#mehr');
  await page.click('[data-set=motion][data-v=off]');
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('off');
  await go(page, '#uebungen');
  await page.waitForTimeout(800);
  expect(await running(page)).toBe(0);
  await page.locator('#lib-grid .drill h3').first().click();
  await page.waitForTimeout(800);
  expect(await running(page)).toBe(0);
  await expect(page.locator('dialog[open] #d-play')).toContainText('Nächster Schritt');
  // Reduziert: kurze Überblendungen erlaubt, aber keine Dauer-Animationen
  await page.keyboard.press('Escape');
  await go(page, '#mehr');
  await page.click('[data-set=motion][data-v=reduced]');
  await go(page, '#uebungen');
  await page.waitForTimeout(800);
  expect(await running(page)).toBe(0);
  expect((await state(page)).settings.motion).toBe('reduced');
});

test('prefers-reduced-motion hat Vorrang vor „Voll“', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await onboard(page);
  expect((await state(page)).settings.motion).toBe('full');
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
  await createSession(page);
  await go(page, '#uebungen');
  await page.waitForTimeout(1000);
  expect(await running(page)).toBe(0);
  await go(page, '#training');
  await page.click('#lv-toggle');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().duration > 400).length)).toBe(0);
  // Wechsel zur Laufzeit beendet Animationen
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await go(page, '#uebungen');
  await expect.poll(() => running(page), { timeout: 5000 }).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => running(page), { timeout: 3000 }).toBe(0);
});

test('Offline: Service Worker cached die App; Neustart und Planen ohne Netz', async ({ page, context }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toEqual(['trainr-v21.14.1']);
  const cached = await page.evaluate(async () => (await (await caches.open('trainr-v21.14.1')).keys()).length);
  expect(cached).toBeGreaterThan(40);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  await createSession(page);
  await go(page, '#uebungen');
  await page.locator('#lib-grid .drill h3').first().click();
  await expect(page.locator('dialog[open] #d-scene svg')).toBeVisible();
  await page.keyboard.press('Escape');
  await go(page, '#planen');
  await page.click('#pl-share');
  const [d] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] [data-do=pdf]')]);
  expect(d.suggestedFilename()).toMatch(/\.pdf$/);
  await page.keyboard.press('Escape');
  await go(page, '#taktik');
  await expect(page.locator('#tb-wrap svg')).toBeVisible();
  await page.goto('/#training'); // Neuer Seitenaufruf offline
  await expect(page.locator('section[data-view=training]')).toBeVisible();
  expect((await plan(page)).blocks.length).toBeGreaterThan(0);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
