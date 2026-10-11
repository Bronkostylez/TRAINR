const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { watchErrors, onboard, state, plan, createSession, go } = require('./helpers.cjs');

async function grab(page, clickSel) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.click(clickSel)]);
  const file = await d.path();
  return { name: d.suggestedFilename(), buf: fs.readFileSync(file) };
}

test('Alle Exporte: PDF (alle Layouts), PNG, Text, CSV, Druck, TRAINR-Datei', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await createSession(page);
  const p = await plan(page);
  const firstName = await page.evaluate(async id => { const P = await import('/src/core/planning.js'); return P.exercise(window.__trainr.store.get(), id).name; }, p.blocks[0].exerciseId);
  await go(page, '#planen');
  await page.click('#pl-share');
  await expect(page.locator('#ex-prev canvas').first()).toBeVisible();
  for (const layout of ['detailed', 'compact', 'cards', 'coach']) {
    await page.click(`dialog[open] [data-layout=${layout}]`);
    for (const style of ['brand', 'ink']) {
      await page.click(`dialog[open] [data-style=${style}]`);
      const pdf = await grab(page, 'dialog[open] [data-do=pdf]');
      expect(pdf.name).toMatch(/\.pdf$/);
      const txt = pdf.buf.toString('latin1');
      expect(txt.startsWith('%PDF-1.4')).toBe(true);
      expect(txt).toContain('%%EOF');
      expect(txt).toContain('/BaseFont /Helvetica');
      // Echter Text im PDF (Namen der ersten Übung, ASCII-Teil)
      const ascii = firstName.split(/[^A-Za-z ]/)[0].trim().split(' ')[0];
      expect(txt).toContain(ascii);
    }
  }
  // xref-Offsets stimmen
  const pdf = await grab(page, 'dialog[open] [data-do=pdf]');
  const t = pdf.buf.toString('latin1');
  const xref = Number(t.match(/startxref\n(\d+)/)[1]);
  expect(t.slice(xref, xref + 4)).toBe('xref');
  const offs = [...t.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
  offs.forEach((o, i) => expect(t.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  // PNG
  await page.click('dialog[open] [data-layout=compact]');
  const png = await grab(page, 'dialog[open] [data-do=png]');
  expect(png.buf.slice(1, 4).toString()).toBe('PNG');
  // Text
  const txt = await grab(page, 'dialog[open] [data-do=txt]');
  const text = txt.buf.toString('utf8');
  expect(text).toContain(p.name);
  expect(text).toContain(firstName);
  expect(text).toContain('Materialübersicht');
  expect(text).toMatch(/[0-9]+ Spieler · 1 Trainer/);
  // CSV mit BOM, Semikolon, Formelschutz
  const csv = await grab(page, 'dialog[open] [data-do=csv]');
  expect(csv.buf[0]).toBe(0xef);
  const c = csv.buf.toString('utf8');
  expect(c).toContain('"Block";"Zeit";"Übung"');
  expect(c).not.toMatch(/;"[=+@]/);
  // Druck-HTML
  const html = await page.evaluate(async () => { const m = await import('/src/exports/sheet.js'), P = await import('/src/core/planning.js'); const s = window.__trainr.store.get(); return m.printHtml(s, P.currentPlan(s), 'cards', 'brand'); });
  expect(html).toContain('pitch-scene');
  expect(html).toContain(firstName.replace(/&/g, '&amp;'));
  // Teilen als Datei (ohne Web-Share-API: Download)
  await page.evaluate(() => { navigator.canShare = undefined; navigator.share = undefined; });
  const share = await grab(page, 'dialog[open] [data-do=file]');
  expect(share.name).toMatch(/\.trainr\.json$/);
  const obj = JSON.parse(share.buf.toString('utf8'));
  expect(obj.kind).toBe('trainr-plan');
  expect(obj.plan.blocks.length).toBe(p.blocks.length);
  // Import der geteilten Datei ergänzt eine Einheit
  const before = (await state(page)).plans.length;
  await page.evaluate(async o => { const m = await import('/src/exports/share.js'); m.importSharedPlan(o); }, obj);
  await expect.poll(async () => (await state(page)).plans.length).toBe(before + 1);
  expect(errors).toEqual([]);
});

test('Backup herunterladen, wiederherstellen; alte und ungültige Dateien ohne Datenverlust abgelehnt', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page, { name: 'Original' });
  await createSession(page);
  await go(page, '#mehr');
  const b = await grab(page, '#m-backup');
  expect(b.name).toMatch(/^trainr-backup-\d{4}-\d\d-\d\d\.json$/);
  const backup = JSON.parse(b.buf.toString('utf8'));
  expect(backup.version).toBe(3);
  expect(backup.teams[0].name).toBe('Original');
  await expect(page.locator('#m-backup-v20')).toHaveCount(0);
  // Daten ändern, dann Backup wiederherstellen
  await page.evaluate(() => window.__trainr.store.update('x', d => { d.teams[0].name = 'Geändert'; }));
  const restore = async (obj, name = 'b.json') => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#m-restore')]);
    await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });
  };
  await restore(backup);
  await page.click('dialog[open] [data-ok]');
  await expect.poll(async () => (await state(page)).teams[0].name).toBe('Original');
  // Ablehnungen
  await go(page, '#mehr');
  for (const bad of ['{kaputt', JSON.stringify({ version: 1, plans: [] }), JSON.stringify({ version: 2, plans: [] }), JSON.stringify({ ...backup, plans: [{ id: 'x' }] })]) {
    await restore(bad);
    await expect(page.locator('.toast')).toContainText('Import abgelehnt');
  }
  const restored = { ...backup };
  for (const k of ['exportedAt', 'app', 'appVersion']) delete restored[k];
  expect(await state(page)).toEqual(restored);
  expect(errors.filter(e => !/JSON/.test(e))).toEqual([]);
});
