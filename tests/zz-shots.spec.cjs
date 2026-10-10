const { test } = require('@playwright/test');
const { onboard, go } = require('./helpers.cjs');
const OUT = process.env.SHOTS;
for (const w of [390, 1280]) test('shots '+w, async ({ page }) => {
  await page.setViewportSize({ width: w, height: w > 500 ? 860 : 844 });
  await onboard(page);
  await go(page, '#uebungen'); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/lib-' + w + '.png' });
  await page.screenshot({ path: OUT + '/lib-full-' + w + '.png', fullPage: true });
  await page.locator('.drill').nth(4).click(); await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/detail-' + w + '.png' });
});
