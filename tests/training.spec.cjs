const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, plan, createSession, go } = require('./helpers.cjs');

test('Trainingsmodus: Timer, Pause, Blockwechsel, Vorschau, Blockende', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install();
  await onboard(page);
  await createSession(page);
  const p = await plan(page);
  await page.click('#t-start');
  await expect(page.locator('section[data-view=training]')).toBeVisible();
  await expect(page.locator('#lv-toggle')).toHaveAttribute('aria-pressed', 'true');
  const mm = String(p.blocks[0].minutes).padStart(2, '0');
  await page.clock.runFor(5000);
  await expect(page.locator('#lv-clock')).toHaveText(`${String(p.blocks[0].minutes - 1).padStart(2, '0')}:55`);
  // Pause hält die Zeit an
  await page.click('#lv-toggle');
  await page.clock.runFor(10_000);
  await expect(page.locator('#lv-clock')).toHaveText(`${String(p.blocks[0].minutes - 1).padStart(2, '0')}:55`);
  // Ansichtswechsel stoppt den Timer nicht
  await page.click('#lv-toggle');
  await go(page, '#uebungen');
  await page.clock.runFor(10_000);
  await go(page, '#training');
  await expect(page.locator('#lv-clock')).toHaveText(`${String(p.blocks[0].minutes - 1).padStart(2, '0')}:45`);
  await expect(page.locator('.tab-live-dot')).toHaveCount(1);
  // Vorschau „Als Nächstes“
  const next = await page.evaluate(async id => { const P = await import('/src/core/planning.js'); return P.exercise(window.__trainr.store.get(), id).name; }, p.blocks[1].exerciseId);
  await expect(page.locator('.next-up')).toContainText(next);
  // Nächster Block
  await page.click('#lv-next');
  await expect(page.locator('.clock-card .eyebrow')).toContainText(`Block 2 / ${p.blocks.length}`);
  await expect(page.locator('#lv-clock')).toHaveText(`${String(p.blocks[1].minutes).padStart(2, '0')}:00`.replace(/^(\d\d):00$/, (m) => m));
  // Blockende: Zeit ablaufen lassen
  await page.clock.fastForward(p.blocks[1].minutes * 60_000 + 1000); await page.clock.runFor(500);
  await expect(page.locator('#lv-sub')).toHaveText('Block fertig');
  await expect(page.locator('.toast')).toContainText('Block fertig');
  // Zurücksetzen, Segment-Sprung
  await page.click('#lv-reset');
  await expect(page.locator('#lv-clock')).toHaveText(`${String(p.blocks[1].minutes).padStart(2, '0')}:00`);
  await page.locator('[data-jump="0"]').click();
  await expect(page.locator('#lv-clock')).toHaveText(`${mm}:00`);
  expect(errors).toEqual([]);
});

test('Trainingsmodus: Auto-Weiter und Vorwarnung', async ({ page }) => {
  await page.clock.install();
  await onboard(page);
  await createSession(page);
  await page.evaluate(() => { window.__trainr.store.setting('autoAdvance', true); window.__trainr.store.setting('warnSeconds', 30); });
  const p = await plan(page);
  await page.click('#t-start');
  await expect(page.locator('#lv-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(p.blocks[0].minutes * 60_000 - 29_000); await page.clock.runFor(500);
  await expect(page.locator('.toast')).toContainText('Noch 30 Sekunden');
  await expect(page.locator('#lv-ring')).toHaveClass(/warn/);
  await page.clock.fastForward(32_000); await page.clock.runFor(500);
  await page.clock.runFor(3000);
  await expect(page.locator('.clock-card .eyebrow')).toContainText('Block 2');
  expect(await page.evaluate(() => window.__trainr.timer.running())).toBe(true);
});

test('Trainingsmodus: leerer Plan zeigt Hinweis', async ({ page }) => {
  await onboard(page);
  await go(page, '#training');
  await expect(page.locator('section[data-view=training] .empty')).toContainText('noch leer');
});
