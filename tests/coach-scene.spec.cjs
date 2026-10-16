// Trainer in der Animation: Helferposition wird als „T“ gezeichnet (21.29.0).
const { test, expect } = require('@playwright/test');
const { onboard, go, watchErrors, noOverflow } = require('./helpers.cjs');

async function openDetail(page, id) {
  await page.evaluate(async id => (await import('/src/views/detail.js')).openDetail(id), id);
  await expect(page.locator('dialog[open] #d-scene .pitch-scene')).toBeVisible();
}

test('Detail: Übungen mit Trainerrolle zeigen T, andere nie', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await openDetail(page, 'pass'); // Dreieck, Trainerrolle „Zuspiel / Zuwurf"
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(1);
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach text')).toHaveText('T');
  await expect(page.locator('.coach-role')).toContainText('Markierung T');
  await expect(page.locator('.coach-role')).not.toContainText('Originalablauf');
  // Der übende Torwart bleibt Keeper, der Trainer steht auf einer Feldposition.
  await expect(page.locator('dialog[open] #d-scene .pitch-player.goalkeeper')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await openDetail(page, '2v2'); // Spielform: nie eine Trainerrolle
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await openDetail(page, 'gk-steps'); // Pflicht-Zuwurf: Trainer gehört immer zur Übung
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(1);
  expect(await noOverflow(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('Einstellung „Trainer in der Animation“ schaltet die Markierung um', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await openDetail(page, 'pass');
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__trainr.store.setting('coachScene', false));
  await openDetail(page, 'pass');
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(0);
  await expect(page.locator('.coach-role')).toContainText('ausgeblendet');
  await page.keyboard.press('Escape');
  // Schalter unter Mehr → Bedienung & Training
  await go(page, '#mehr');
  await page.locator('[data-more-group=controls] summary').click();
  const sw = page.locator('[data-toggle=coachScene]');
  await expect(sw).not.toBeChecked();
  await sw.check({ force: true });
  expect(await page.evaluate(() => window.__trainr.store.get().settings.coachScene)).toBe(true);
  await openDetail(page, 'pass');
  await expect(page.locator('dialog[open] #d-scene .pitch-player.coach')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Trainingsmodus: T nur bei belegter Helferrolle im Block', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.update('Sample', s => {
    const p = s.plans.find(x => x.id === s.selectedPlanId);
    p.people = 2; p.coaches = 1; p.pauses = { count: 0, minutes: 1 };
    p.blocks = [{ id: 'b1', exerciseId: 'v5-scan', minutes: 5 }, { id: 'b2', exerciseId: '2v2', minutes: 5 }];
  }));
  await go(page, '#training');
  await expect(page.locator('#lv-scene .pitch-player.coach')).toHaveCount(1); // v5-scan: Trainer füllt die Helferrolle
  await page.evaluate(() => window.__trainr.store.update('Rolle abwählen', s => {
    s.plans.find(x => x.id === s.selectedPlanId).blocks[0].coachSupport = false;
  }));
  await expect(page.locator('#lv-scene .pitch-player.coach')).toHaveCount(0); // abgewählt: Originalbesetzung
  await page.evaluate(() => window.__trainr.store.update('Block wechseln', s => {
    const p = s.plans.find(x => x.id === s.selectedPlanId); p.blocks = [p.blocks[1]];
  }));
  await expect(page.locator('#lv-scene .pitch-player.coach')).toHaveCount(0); // 2v2: Spielform ohne Trainerrolle
  expect(errors).toEqual([]);
});
