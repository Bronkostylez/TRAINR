const { test, expect } = require('@playwright/test');
const { onboard, state, watchErrors, createSession } = require('./helpers.cjs');
const path = require('node:path');
for (const lang of ['de', 'en']) test.describe(lang, () => {
  test.use({ locale: lang === 'de' ? 'de-DE' : 'en-US' });
  test('Aktuelles Backup: Übersetzung, Wiederherstellen, Rückgängig und alte Datei ablehnen', async ({ page }) => {
    const errors = watchErrors(page);
    await onboard(page, { name: 'E2' });
    await createSession(page);
    await page.evaluate(() => { location.hash = '#mehr'; });
    const group = page.locator('.settings-group').filter({ has: page.locator('#m-backup') });
    await group.locator('summary').last().click();
    await expect(group).not.toContainText('V20');
    await expect(page.locator('#m-backup')).toContainText(lang === 'en' ? 'Download backup' : 'Backup herunterladen');
    await expect(group).toContainText(lang === 'en' ? 'Download a backup first.' : 'Lade vorher ein Backup herunter.');
    await group.screenshot({ path: path.join(__dirname, '..', 'screenshots', `backup-current-${lang}-390.png`) });
    const before = await state(page);
    const upload = async obj => {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#m-restore')]);
      await chooser.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
    };
    await upload({ version: 2, profile: { type: 'keeper', age: 'D-Jugend', slots: [{ day: 2, start: '18:00', end: '19:30' }] }, custom: [], plans: [{ id: 'old', name: 'Alt', people: 4, focus: 'Fangen', blocks: [] }], selected: 'old' });
    await expect(page.locator('.toast')).toContainText(lang === 'en' ? 'Import rejected' : 'Import abgelehnt');
    expect(await state(page)).toEqual(before);
    const next = JSON.parse(JSON.stringify(before)); next.teams[0].name = 'Aus Backup';
    await upload(next);
    await expect(page.locator('dialog[open]')).toContainText(lang === 'en' ? 'Your current data will be replaced' : 'Deine aktuellen Daten werden ersetzt');
    await expect(page.locator('dialog[open]')).not.toContainText('V20');
    await page.click('dialog[open] [data-ok]');
    await expect.poll(async () => (await state(page)).teams[0].name).toBe('Aus Backup');
    await page.evaluate(() => window.__trainr.store.undo());
    expect(await state(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
});
