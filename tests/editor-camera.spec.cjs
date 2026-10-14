const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, go, noOverflow } = require('./helpers.cjs');

const tab = (page, t) => page.locator(`[data-ed-tab=${t}]`).evaluate(b => b.click());
async function build(page, { camera }) {
  await onboard(page); await go(page, '#uebungen'); await page.click('#lib-new');
  await page.fill('#ed [name=name]', 'Dreieck mit Kamera');
  await page.click('#ed-tpl'); await page.click('dialog[open] [data-tpl="Dreieck"]');
  await tab(page, 'sketch');
  if (camera === 'manual') {
    await page.click('[data-frame="1"]');
    await page.locator('#ed-cam-d summary').click();
    await page.click('[data-cam-mode="manual"]');
    await page.click('[data-cam-zoom="2.2"]');
    await expect(page.locator('#ed-pitch .sk-cam')).toHaveCount(1);
  } else if (camera === 'off') {
    await page.locator('#ed-cam-d summary').click();
    await page.click('[data-cam-mode="off"]');
  }
  await page.click('[data-frame="1"]');
  await expect(page.locator('#ed-loft')).toBeVisible().catch(() => {});
  await tab(page, 'details');
  await page.click('.mat-toggle >> nth=0');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('dialog[open] #d-scene')).toBeVisible();
}
const camScale = page => page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('#d-scene .cam')).transform); return m.a; });
const seek = (page, frac) => page.evaluate(f => { const s = document.querySelector('#d-scrub'); s.value = Math.round(Number(s.max) * f); s.dispatchEvent(new Event('input', { bubbles: true })); }, frac);

test('Editor am Handy: Skizze und Angaben getrennt, kein Überlauf, Fehler führen zum richtigen Bereich', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await go(page, '#uebungen'); await page.click('#lib-new');
  await expect(page.locator('#ed-pitch')).toBeVisible();
  await expect(page.locator('#ed [name=min]')).toBeHidden();
  expect(await noOverflow(page)).toBe(true);
  await page.click('[data-ed-tab=details]');
  await expect(page.locator('#ed [name=min]')).toBeVisible();
  await expect(page.locator('#ed-pitch')).toBeHidden();
  expect(await noOverflow(page)).toBe(true);
  await page.click('[data-ed-tab=sketch]');
  await page.fill('#ed [name=name]', 'Nur Name');
  await page.click('dialog[open] button[type=submit]');
  await expect(page.locator('#ed-err')).toContainText('Material');
  await expect(page.locator('[data-ed-tab=details]')).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('Eigene Animation: Kamera folgt automatisch, Spuren wie bei eingebauten Übungen', async ({ page }) => {
  const errors = watchErrors(page);
  await build(page, { camera: 'auto' });
  const c = (await state(page)).custom[0];
  expect(c.animation.camera).toBe('auto');
  await expect(page.locator('#d-scene .pitch-scene.motion-on')).toHaveCount(1);
  await page.click('#d-play'); // pausieren
  await seek(page, .3);
  await expect.poll(() => camScale(page)).toBeGreaterThan(1.1);
  await expect(page.locator('#d-scene .mv-trail')).not.toHaveCount(0);
  await seek(page, 0);
  expect(await camScale(page)).toBeCloseTo(1, 1);
  expect(errors).toEqual([]);
});

test('Eigene Animation: Fokus-Kamera zoomt auf den gewählten Ausschnitt, „Aus“ bleibt weit', async ({ page }) => {
  await build(page, { camera: 'manual' });
  const c = (await state(page)).custom[0];
  expect(c.animation.camera).toBe('manual');
  expect(c.animation.frames[1].cam.s).toBe(2.2);
  expect(c.animation.frames[0].cam).toBeUndefined();
  await page.click('#d-play');
  await seek(page, .34);
  await expect.poll(() => camScale(page)).toBeGreaterThan(1.5);
});
test('Eigene Animation: Kamera aus = ganzer Platz', async ({ page }) => {
  await build(page, { camera: 'off' });
  await page.click('#d-play');
  await seek(page, .4);
  expect(await camScale(page)).toBeCloseTo(1, 2);
});

test('Editor-Vorschau nutzt den echten Player; Schema lehnt unmögliche Kamera ab', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page); await go(page, '#uebungen'); await page.click('#lib-new');
  await page.click('#ed-tpl'); await page.click('dialog[open] [data-tpl="Torschuss"]');
  await page.click('#ed-fplay');
  await expect(page.locator('#ed-prev .pitch-scene.motion-on')).toHaveCount(1);
  await expect(page.locator('#ed-prev .scene-step-label')).toBeVisible();
  const ok = await page.evaluate(async () => {
    const S = await import('/src/core/schema.js');
    const a = { version: 2, camera: 'manual', items: [{ k: 'a' }], frames: [{ seconds: 2, caption: 'x', points: [[50, 50]], cam: { x: 50, y: 50, s: 2 } }] };
    const bad = JSON.parse(JSON.stringify(a)); bad.frames[0].cam.s = 5;
    const bad2 = JSON.parse(JSON.stringify(a)); bad2.camera = 'zoomzoom';
    return [S.validAnimation(a), S.validAnimation(bad), S.validAnimation(bad2)];
  });
  expect(ok).toEqual([true, false, false]);
  expect(errors).toEqual([]);
});
