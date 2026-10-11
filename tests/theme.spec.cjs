const { test, expect } = require('@playwright/test');
const { onboard, go, watchErrors, noOverflow } = require('./helpers.cjs');

// Resolve semantic tokens through the browser, rather than merely checking CSS text.
async function usesToken(locator, property, token) {
  await expect.poll(async () => { const colors = await locator.evaluate((el, { property, token }) => {
    const probe = document.createElement('span');
    el.append(probe); probe.style.setProperty(property, `var(${token})`);
    const expected = getComputedStyle(probe).getPropertyValue(property);
    const actual = getComputedStyle(el).getPropertyValue(property);
    probe.remove(); return { actual, expected };
  }, { property, token });
  return colors.actual === colors.expected; }, { message: `${property} ${token}` }).toBe(true);
}

for (const theme of ['light', 'dark']) {
  test(`Wochenplaner und Saison verwenden Theme-Farben: ${theme}`, async ({ page, context }) => {
    const errors = watchErrors(page);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await onboard(page);
    await go(page, '#uebungen');
    await usesToken(page.locator('.tag.new').first(), 'background-color', '--hero');
    await usesToken(page.locator('.tag.new').first(), 'color', '--signal');
    await page.locator('.tag.new').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/downloads/theme-new-${theme}-390.png` });
    await go(page, '#planen'); await page.click('#pl-week');
    await expect(page.locator('.week-hero')).toBeVisible();
    await usesToken(page.locator('.week-hero'), 'background-color', '--hero');
    await usesToken(page.locator('.week-hero'), 'color', '--hero-ink');
    await usesToken(page.locator('.season-card'), 'background-color', '--surface');
    await usesToken(page.locator('.season-card'), 'color', '--ink');
    for (const card of await page.locator('.week-day').all()) await usesToken(card, 'background-color', '--surface');
    expect(await noOverflow(page)).toBe(true);
    await page.locator('.week-hero').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/downloads/theme-week-${theme}-390.png` });
    await page.locator('.season-card').scrollIntoViewIfNeeded();
    await page.locator('.season-card').evaluate(el => scrollBy(0, el.getBoundingClientRect().top - 90));
    await page.locator('.season-card').screenshot({ path: `/downloads/theme-season-${theme}-390.png` });
    // Selecting and saving a season must still work; edit state uses the same colors.
    await page.locator('[data-season-goal]').first().click();
    await usesToken(page.locator('[data-season-goal]').first(), 'background-color', '--fill');
    await usesToken(page.locator('[data-season-goal]').first(), 'color', '--on-fill');
    await page.click('[data-season-save]'); await expect(page.locator('.season-line')).toBeVisible();
    await page.click('[data-season-edit]');
    await usesToken(page.locator('.season-card'), 'background-color', '--surface');
    // Explicit theme changes override the system, survive reload and cached offline restart.
    const other = theme === 'dark' ? 'light' : 'dark';
    await page.evaluate(t => window.__trainr.store.setting('theme', t), other);
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await usesToken(page.locator('.week-hero'), 'background-color', '--hero');
    await usesToken(page.locator('.season-card'), 'background-color', '--surface');
    await page.evaluate(t => window.__trainr.store.setting('theme', t), theme);
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await usesToken(page.locator('.week-hero'), 'background-color', '--hero');
    await context.setOffline(false); expect(errors).toEqual([]);
  });
}
