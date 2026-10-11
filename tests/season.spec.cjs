const { test, expect } = require('@playwright/test');
const { onboard, go, watchErrors, noOverflow } = require('./helpers.cjs');
async function seed(page, n = 2) {
  return page.evaluate(async n => {
    const C = await import('/src/core/calendar.js'), store = window.__trainr.store, s = store.get(), team = s.teams.find(t => t.id === s.activeTeamId);
    const evs = Array.from({ length: n }, (_, i) => ({ ...C.blankEvent(team, C.todayIso()), start: `1${7 + i}:00`, end: `1${8 + i}:00` }));
    store.update('Test', d => { d.events = evs; });
    return evs.map(e => e.id);
  }, n);
}
for (const [width, lang] of [[360, 'de'], [390, 'de'], [768, 'de'], [1280, 'de'], [390, 'en']]) {
  test.describe(`${lang}`, () => { test.use({ locale: lang === 'en' ? 'en-GB' : 'de-DE' });
  test(`Saison-Autopilot ${width}px ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); const errors = watchErrors(page);
    await onboard(page); const ids = await seed(page);
    await page.click('#t-week'); await expect(page.locator('.season-card')).toBeVisible();
    // ohne Saisonziel kein Vorschlag
    await expect(page.locator('.season-suggest')).toHaveCount(0);
    await page.locator('[data-season-goal]').nth(0).click(); await page.locator('[data-season-goal]').nth(2).click();
    if (width === 390) await page.screenshot({ path: `/downloads/trainr-season-question-${lang}-390.png` });
    expect(await page.locator('.season-card .chips').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await page.click('[data-season-save]');
    await expect(page.locator('.season-line')).toBeVisible();
    await expect(page.locator('.season-suggest')).toHaveCount(2);
    const first = await page.locator('.season-suggest').nth(0).innerText(), second = await page.locator('.season-suggest').nth(1).innerText();
    expect(first).not.toEqual(second);
    expect(await noOverflow(page)).toBeTruthy();
    if (width === 390) { await page.locator('.season-suggest').first().scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, -120)); await page.waitForTimeout(500); await page.screenshot({ path: `/downloads/trainr-season-week-${lang}-390.png` }); }
    await expect(page.locator('[data-season-goal]')).toHaveCount(0);
    await page.locator('[data-week-accept]').first().click();
    const ev = await page.evaluate(id => window.__trainr.store.get().events.find(e => e.id === id), ids[0]);
    expect(ev.foci.length).toBeGreaterThan(0);
    await page.reload(); await go(page, '#heute');
    expect(errors).toEqual([]);
    if (lang === 'en') await expect(page.locator('body')).not.toContainText('Saisonziel');
  });
  });
}
test('Bewertungen steuern den Vorschlag', async ({ page }) => {
  await onboard(page);
  const r = await page.evaluate(async () => {
    const S = await import('/src/core/season.js'), C = await import('/src/core/calendar.js'), store = window.__trainr.store;
    const s0 = store.get(), team = { ...s0.teams.find(t => t.id === s0.activeTeamId), season: { goals: ['Passspiel'], start: '2026-09-01' } };
    const base = S.suggest(s0, team);
    const day = C.addDays(C.todayIso(), -3);
    const ev = rating => ({ ...C.blankEvent(team, day), status: 'erledigt', rating, done: { name: 'x', minutes: 30, focus: 'Dribbling', exercises: ['islands'], blocks: [['islands', 30]] } });
    const bad = { ...s0, teams: [team], events: [ev(1)] }, good = { ...s0, teams: [team], events: [ev(5)] };
    return { base: base.foci, bad: S.scoreFoci(bad, team).find(x => x.key === 'Dribbling').score, good: S.scoreFoci(good, team).find(x => x.key === 'Dribbling').score };
  });
  expect(r.base).toContain('Passspiel'); expect(r.bad).toBeGreaterThan(r.good);
});
