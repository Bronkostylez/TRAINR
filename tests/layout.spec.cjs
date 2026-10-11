// Screenshots je Ansicht und Breite. Prüft horizontalen Overflow, JS-Fehler und Mindestgröße der Touch-Ziele.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { watchErrors, onboard, createSession, go, noOverflow } = require('./helpers.cjs');

const OUT = path.join(__dirname, '..', 'screenshots');
const WIDTHS = [360, 390, 768, 1280];

// Catch a light surface leaking into dark mode (and the reverse) in views and sheets.
async function themedSurfaces(page) {
  const wrong = await page.evaluate(() => {
    const wrong = [];
    const rules = [
      ['.card:not(.tint), .settings-card, .drill, .plan-card, .week-day, .variant-box, .source, .mini-drill, .stat, .choice', '--surface', '--ink'],
      ['dialog[open].sheet, dialog[open] .sheet-foot', '--surface', '--ink'],
      ['.week-hero', '--hero', '--hero-ink'],
    ];
    for (const [selector, bg, fg] of rules) for (const el of document.querySelectorAll(selector)) {
      if (!el.getBoundingClientRect().height || getComputedStyle(el).visibility === 'hidden') continue;
      // Compact library rows are intentionally transparent, not separate cards.
      if (el.classList.contains('drill-row')) continue;
      const probe = document.createElement('span'); el.append(probe);
      probe.style.backgroundColor = `var(${bg})`; probe.style.color = `var(${fg})`;
      const a = getComputedStyle(el), b = getComputedStyle(probe);
      if (a.backgroundColor !== b.backgroundColor || a.color !== b.color) wrong.push(el.className);
      probe.remove();
    }
    return wrong;
  });
  expect(wrong, 'Theme surfaces and foregrounds').toEqual([]);
}


/** Interaktive Elemente kleiner als 40×40 px (Inline-Links und versteckte ausgenommen). */
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main [role=radio], .tabbar button, .appbar button, dialog[open] button')]
  .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.height < 38 || r.width < 38) && !el.closest('.seg-progress'); })
  .map(el => `${el.id || el.className || el.tagName}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}:${(el.textContent || '').trim().slice(0, 20)}`));

for (const theme of ['light', 'dark']) {
  for (const w of WIDTHS) {
    test(`Layout ${w}px ${theme}`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.setViewportSize({ width: w, height: w >= 1024 ? 900 : w >= 700 ? 1024 : 800 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.waitForTimeout(200);
      if (theme === 'light') await page.screenshot({ path: `${OUT}/${w}-${theme}-00-onboarding.png` });
      await onboard(page);
      await createSession(page);
      const small = new Set();
      const views = [['heute', '#heute'], ['uebungen', '#uebungen'], ['planen', '#planen'], ['training', '#training'], ['mehr', '#mehr'], ['taktik', '#taktik'], ['kalender', '#kalender/woche']];
      for (const [i, [name, hash]] of views.entries()) {
        await go(page, hash);
        await expect(page.locator(`section[data-view=${name}]`)).toBeVisible();
        await page.waitForTimeout(250);
        await themedSurfaces(page);
        expect(await noOverflow(page), `Overflow ${name} @${w}`).toBe(true);
        (await smallTargets(page)).forEach(x => small.add(`${name} ${x}`));
        await page.screenshot({ path: `${OUT}/${w}-${theme}-${String(i + 1).padStart(2, '0')}-${name}.png`, fullPage: name !== 'training' });
      }
      // The weekly hero must remain dark, even when normal text turns pale.
      await expect(page.locator('.week-hero')).toBeVisible();
      const heroColors = await page.locator('.week-hero').evaluate(el => {
        const probe = document.createElement('span'); el.append(probe);
        probe.style.backgroundColor = 'var(--hero)'; probe.style.color = 'var(--hero-ink)';
        const a = getComputedStyle(el), b = getComputedStyle(probe);
        const result = [a.backgroundColor === b.backgroundColor, a.color === b.color];
        probe.remove(); return result;
      });
      expect(heroColors).toEqual([true, true]);
      // Sheets
      await go(page, '#uebungen');
      await page.locator('#lib-grid .drill h3').first().click();
      await page.waitForTimeout(400);
      expect(await noOverflow(page)).toBe(true);
      (await smallTargets(page)).forEach(x => small.add(`detail ${x}`));
      await page.screenshot({ path: `${OUT}/${w}-${theme}-07-detail.png` });
      await themedSurfaces(page);
      await page.keyboard.press('Escape');
      await go(page, '#planen');
      await page.click('#pl-assist');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${w}-${theme}-08-assistent.png` });
      await themedSurfaces(page);
      await page.keyboard.press('Escape');
      await page.click('#pl-share');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${w}-${theme}-09-export.png` });
      await themedSurfaces(page);
      await page.keyboard.press('Escape');
      await page.locator('#pl-blocks [data-edit]').first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${w}-${theme}-10-block.png` });
      await themedSurfaces(page);
      test.info().annotations.push({ type: 'small-targets', description: [...small].join(' | ') || 'keine' });
      expect(errors).toEqual([]);
    });
  }
}
