const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, state, createSession } = require('./helpers.cjs');

const lang = page => page.evaluate(() => document.documentElement.lang);
const planText = page => page.evaluate(async () => {
  const [doc, P] = [await import('/src/exports/doc.js'), await import('/src/core/planning.js')], s = window.__trainr.store.get();
  return doc.planText(s, P.currentPlan(s));
});

test.describe('Gerätesprache Deutsch', () => {
  test.use({ locale: 'de-DE' });
  test('Deutsch bleibt Deutsch; Sprache wählbar und gemerkt', async ({ page }) => {
    const errors = watchErrors(page);
    await onboard(page);
    expect(await lang(page)).toBe('de');
    await expect(page.locator('.tab[data-tab=heute]')).toContainText('Heute');
    // Einstellungen: Auto ist vorgewählt
    await page.evaluate(() => { location.hash = '#mehr'; });
    await expect(page.locator('[data-lang=auto]')).toHaveAttribute('aria-checked', 'true');
    // Englisch wählen → Neustart der Ansicht, Einstellung gespeichert, Daten unverändert
    const before = await state(page);
    await Promise.all([page.waitForNavigation(), page.click('[data-lang=en]')]);
    expect(await lang(page)).toBe('en');
    await expect(page.locator('.tab[data-tab=heute]')).toContainText('Today');
    const after = await state(page);
    expect(after.settings.lang).toBe('en');
    expect(after.teams).toEqual(before.teams);
    expect(after.plans).toEqual(before.plans);
    // zurück auf Deutsch
    await page.evaluate(() => { location.hash = '#mehr'; });
    await Promise.all([page.waitForNavigation(), page.click('[data-lang=de]')]);
    expect(await lang(page)).toBe('de');
    await expect(page.locator('.tab[data-tab=heute]')).toContainText('Heute');
    expect(errors).toEqual([]);
  });
});

test.describe('Gerätesprache Englisch', () => {
  test.use({ locale: 'en-US' });
  test('Englisch wird erkannt: Oberfläche, Katalog, Export und Datum', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    expect(await lang(page)).toBe('en');
    await expect(page.locator('h1')).toContainText('Welcome');
    await onboard(page);
    await expect(page.locator('.tab[data-tab=heute]')).toContainText('Today');
    await expect(page.locator('.tab[data-tab=uebungen]')).toContainText('Exercises');
    await createSession(page);
    // Übungsnamen im Plan sind englisch; gespeicherte Daten bleiben deutsch (Schwerpunkt-Schlüssel, IDs)
    const names = await page.locator('.tl-item strong').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n).not.toMatch(/[äöüß]|\b(und|gegen|mit)\b/);
    const s = await state(page);
    expect(s.settings.lang === undefined || s.settings.lang === 'auto').toBe(true);
    expect(s.teams[0].age).toBe('E-Jugend');
    // Export-Text auf Englisch
    const text = await planText(page);
    expect(text).toContain('Equipment per group:');
    expect(text).toMatch(/[0-9]+ players · 1 coach/);
    expect(text).not.toContain('Material je Gruppe');
    // Kalender: Datum nach englischem Format
    await page.evaluate(() => { location.hash = '#kalender'; });
    await expect(page.locator('section[data-view=kalender] h1, section[data-view=kalender] h2').first()).toBeVisible();
    const body = await page.locator('#main').innerText();
    expect(body).not.toMatch(/\b(Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember)\b/);
    // Einstellungen: Auto folgt dem Gerät, Deutsch wählbar
    await page.evaluate(() => { location.hash = '#mehr'; });
    await expect(page.locator('[data-lang=auto]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#main')).toContainText('Language');
    await Promise.all([page.waitForNavigation(), page.click('[data-lang=de]')]);
    expect(await lang(page)).toBe('de');
    await expect(page.locator('.tab[data-tab=heute]')).toContainText('Heute');
    expect(errors).toEqual([]);
  });

  test('Eigene Inhalte werden nie übersetzt', async ({ page }) => {
    await onboard(page, { name: 'Heute' });
    await expect(page.locator('#team-chip')).toContainText('Heute'); // Mannschaftsname bleibt, wie getippt
    await page.evaluate(() => { location.hash = '#mehr'; });
    await expect(page.locator('.team-card').first()).toContainText('Heute');
  });
});

test.describe('Nicht unterstützte Gerätesprache', () => {
  test.use({ locale: 'fr-FR' });
  test('Fällt auf Englisch zurück', async ({ page }) => {
    await page.goto('/');
    expect(await lang(page)).toBe('en');
    await expect(page.locator('h1')).toContainText('Welcome');
  });
});
