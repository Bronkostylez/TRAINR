// Sheets: Schließ-Animation + sofortiges Wiederöffnen dürfen keine zwei Dialoge stapeln (21.30.1).
const { test, expect } = require('@playwright/test');
const { onboard, watchErrors } = require('./helpers.cjs');

test('Schneller Sheet-Wechsel stapelt keine Dialoge', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('pass'));
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape'); // Schließ-Animation (~200 ms) läuft noch
  const stacked = await page.evaluate(async () => {
    (await import('/src/views/detail.js')).openDetail('2v2');
    return document.querySelectorAll('dialog[open]').length; // synchron, direkt nach dem Öffnen
  });
  expect(stacked).toBe(1);
  await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toHaveAttribute('data-exercise', '2v2');
  await expect(page.locator('dialog[open] h2')).toHaveText('Zwei gegen zwei');
  expect(errors).toEqual([]);
});
