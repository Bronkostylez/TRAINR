// Hilfe: die Uebungs-Hilfe beschreibt den Ersteller mit allen Elementen (21.35.0):
// Trainer, Zonen und freie Pfeile kamen nachts dazu und fehlten im Hilfetext.
const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, go } = require('./helpers.cjs');

test('Hilfe zu Uebungen nennt Trainer, Zonen und Pfeile im Ersteller', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#uebungen');
  await page.click('#btn-help');
  const sheet = page.locator('dialog[open]');
  await expect(sheet).toContainText('Hilfe · Übungen');
  await expect(sheet).toContainText('Trainer, Ball und Material');
  await expect(sheet).toContainText('Pfeile für Lauf, Pass und Dribbling');
  expect(errors).toEqual([]);
});

test('Englisch: Hilfetext zum Ersteller ist übersetzt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.evaluate(() => window.__trainr.store.update('Sprache', d => { d.settings.lang = 'en'; }));
  await page.reload();
  await go(page, '#uebungen');
  await page.click('#btn-help');
  const sheet = page.locator('dialog[open]');
  await expect(sheet).toContainText('a coach, ball and equipment');
  await expect(sheet).toContainText('runs, passes and dribbling');
  expect(errors).toEqual([]);
});
