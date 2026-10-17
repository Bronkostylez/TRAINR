// Toasts müssen über offenen Sheets sichtbar und klickbar bleiben (21.30.2):
// <dialog>-Sheets liegen in der Top-Layer-Ebene über z-index, der Toast-Container
// wird deshalb in das oberste offene Sheet umgehängt.
const { test, expect } = require('@playwright/test');
const { onboard, watchErrors } = require('./helpers.cjs');

async function fireToast(page) {
  await page.evaluate(async () => {
    const { toast } = await import('/src/ui/feedback.js');
    toast('Zum Plan hinzugefügt', { action: 'Rückgängig', onAction: () => { window.__undone = true; } });
  });
}

test('Toast über offenem Sheet: sichtbar und Aktion klickbar', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('pass'));
  await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toBeVisible();
  await fireToast(page);
  // Der Container hängt jetzt im Sheet, der Toast liegt im Hit-Test ganz oben.
  await expect(page.locator('dialog[open] > .toasts .toast')).toBeVisible();
  await page.waitForTimeout(500); // Einblend-Animation abwarten
  const top = await page.evaluate(() => {
    const t = document.querySelector('.toast'), r = t.getBoundingClientRect();
    return t.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(top).toBe(true);
  await page.locator('.toast button').click();
  expect(await page.evaluate(() => window.__undone)).toBe(true);
  expect(errors).toEqual([]);
});

test('Toast kehrt nach dem Schließen des Sheets an den Body zurück', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(async () => (await import('/src/views/detail.js')).openDetail('pass'));
  await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toBeVisible();
  await fireToast(page);
  await expect(page.locator('dialog[open] > .toasts .toast')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.sheet')).toHaveCount(0);
  await expect(page.locator('body > .toasts .toast')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Toast ohne Sheet bleibt wie gehabt über der Navigation', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await fireToast(page);
  await expect(page.locator('body > .toasts .toast')).toBeVisible();
  const y = await page.evaluate(() => document.querySelector('.toast').getBoundingClientRect().y);
  expect(y).toBeGreaterThan(600); // über der Tab-Leiste, nicht mitten im Inhalt
  expect(errors).toEqual([]);
});
