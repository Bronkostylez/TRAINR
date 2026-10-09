// Gemeinsame Test-Helfer.
const { expect } = require('@playwright/test');

/** Sammelt Seiten- und Konsolenfehler. Am Testende expect(errors).toEqual([]). */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return errors;
}

/** Onboarding komplett durchlaufen. */
async function onboard(page, { name = 'E2', type = 'field', age = 'E-Jugend', days = [1], skipTour = true } = {}) {
  await page.goto('/');
  await page.fill('#wiz [name=name]', name);
  await page.locator(`#wiz [name=type][value=${type}]`).check({ force: true });
  await page.click('#wiz-next');
  await page.locator(`#wiz [name=age][value="${age}"]`).check({ force: true });
  await page.click('#wiz-next');
  for (let d = 0; d < 7; d++) {
    const box = page.locator(`#wiz [name=day][value="${d}"]`);
    if ((await box.isChecked()) !== days.includes(d)) await box.setChecked(days.includes(d), { force: true });
  }
  await page.click('#wiz-next');
  await page.click('#wiz-next');
  await expect(page.locator('section[data-view=heute]')).toBeVisible();
  if (skipTour) await closeTour(page);
}
async function closeTour(page) {
  const skip = page.locator('dialog[open] [data-skip]');
  if (await skip.count()) { await skip.click(); await expect(page.locator('dialog[open]')).toHaveCount(0); }
}
const state = page => page.evaluate(() => window.__trainr.store.get());
const plan = page => page.evaluate(() => { const s = window.__trainr.store.get(); return s.plans.find(p => p.id === s.selectedPlanId); });

/** Erstellt eine Einheit über „Heute“. */
async function createSession(page) {
  await page.evaluate(() => { location.hash = '#heute'; });
  const d = page.locator('#t-create');
  if (!(await d.evaluate(x => x.open))) await d.locator('summary').click();
  await page.click('#c-go');
  await expect(page.locator('.tl-item').first()).toBeVisible();
}
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
}
const go = (page, hash) => page.evaluate(h => { location.hash = h; }, hash);
module.exports = { watchErrors, onboard, closeTour, state, plan, createSession, noOverflow, go };
