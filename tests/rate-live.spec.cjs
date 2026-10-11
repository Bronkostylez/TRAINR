const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, createSession, go, noOverflow } = require('./helpers.cjs');

for (const [w, h] of [[360, 740], [390, 844], [430, 932], [768, 1024], [1280, 800]]) {
  test(`Training: Bewertung und Notiz bei laufender Übung (${w}px)`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: w, height: h });
    await onboard(page); await createSession(page);
    await go(page, '#training/start');
    const box = page.locator('#lv-rate');
    await expect(box).toBeVisible();
    await box.locator('[data-live-star="4"]').click();
    await expect(box.locator('[data-live-star="4"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(box.locator('[data-live-star="5"]')).toHaveAttribute('aria-pressed', 'false');
    await page.fill('#lv-note', 'Gruppen kleiner machen');
    await expect(page.locator('#lv-saved')).toHaveText('Gespeichert ✓');
    // Fokus bleibt in der Notiz, kein Neuzeichnen beim Sternklick
    const id = await page.evaluate(() => { const s = window.__trainr.store.get(); const p = s.plans.find(x => x.id === s.selectedPlanId); return p.blocks[0].exerciseId; });
    let st = await state(page);
    expect(st.exerciseMeta[id]).toMatchObject({ rating: 4, note: 'Gruppen kleiner machen' });
    // gleicher Wert in den Übungsdetails
    await page.click('#lv-detail');
    await expect(page.locator('dialog[open] #d-note')).toHaveValue('Gruppen kleiner machen');
    await expect(page.locator('dialog[open] [data-rate-star="4"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    // Stern nochmal tippen entfernt die Bewertung
    await box.locator('[data-live-star="4"]').click();
    st = await state(page);
    expect(st.exerciseMeta[id].rating).toBeUndefined();
    // Notiz leeren, direkt zum nächsten Block: gespeichert
    await page.fill('#lv-note', 'noch eine Notiz');
    await box.scrollIntoViewIfNeeded(); await page.screenshot({ path: `/tmp/shots/rate-${w}.png`, fullPage: false }); await page.screenshot({ path: `/tmp/shots/rate-${w}-full.png`, fullPage: true });
    await page.click('#lv-next');
    st = await state(page);
    expect(st.exerciseMeta[id].note).toBe('noch eine Notiz');
    expect(await noOverflow(page)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test.describe('en', () => { test.use({ locale: 'en-US' });
test('Training: Englisch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page); await createSession(page);
  await go(page, '#training/start');
  await expect(page.locator('#lv-rate')).toContainText('How is the exercise going?');
  await expect(page.locator('#lv-note')).toHaveAttribute('placeholder', 'What works? What to change?');
  await page.locator('[data-live-star="5"]').click();
  await expect(page.locator('#lv-saved')).toHaveText('Saved ✓');
  await page.locator('#lv-rate').scrollIntoViewIfNeeded(); await page.screenshot({ path: '/tmp/shots/rate-en-390.png' });
  expect(errors).toEqual([]);
});
});

test.describe('en elapsed', () => { test.use({ locale: 'en-US' });
test('Training: Zeit "elapsed" auf Englisch', async ({ page }) => {
  await onboard(page); await createSession(page);
  await go(page, '#training/start');
  await expect(page.locator('#lv-elapsed')).toContainText('elapsed');
  await expect(page.locator('#lv-left')).toContainText('left');
});
});
