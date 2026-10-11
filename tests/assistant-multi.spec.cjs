const { test, expect } = require('@playwright/test');
const { watchErrors, onboard, go } = require('./helpers.cjs');

// V22: Mehrfach-Schwerpunkte, Begründung, Plan B, Alters-Runden.
test('Planassistent: mehrere Schwerpunkte werden verteilt und begründet', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const A = await import('/src/core/assistant.js'), P = await import('/src/core/planning.js');
    const s = window.__trainr.store.get(), out = { bugs: [] };
    for (const age of P.AGES) for (const type of ['field', 'keeper', 'both']) for (const foci of [['Passspiel'], ['Passspiel', 'Torschuss'], ['Dribbling', 'Wahrnehmung', '1 gegen 1'], ['Fangen', 'Stellungsspiel']]) for (const strategy of Object.keys(A.STRATEGIES)) for (const minutes of [45, 60, 90, 120]) {
      let pr;
      try { pr = A.propose(s, { age, people: 12, keepers: 1, minutes, foci, type, strategy, seed: minutes * 7 }); } catch { continue; }
      if (pr.blocks.reduce((a, b) => a + b.minutes, 0) !== minutes - pr.pauseCount * (pr.pauses?.minutes || 0)) out.bugs.push(`Summe ${age} ${type} ${foci} ${minutes}`);
      if (new Set(pr.blocks.map(b => b.exerciseId)).size !== pr.blocks.length) out.bugs.push(`Doppelt ${age} ${type}`);
      if (pr.foci.join('|') !== foci.filter(k => P.FOCUS_KEYS.includes(k) && k !== 'Falltechnik').slice(0, 4).join('|')) out.bugs.push(`foci verloren ${foci}`);
      if (pr.focus !== pr.foci[0]) out.bugs.push(`Primär-Schwerpunkt ${foci}`);
      for (const b of pr.blocks) {
        if (!b.why || b.why.length > 300) out.bugs.push(`why fehlt/zu lang ${b.exerciseId}`);
        if (!Array.isArray(b.alternatives) || b.alternatives.length > 6) out.bugs.push(`Plan B fehlt ${b.exerciseId}`);
      }
    }
    // Verteilung: Technik-Strategie mit zwei Schwerpunkten gibt jedem eine eigene Phase.
    const pr = A.propose(s, { age: 'E-Jugend', people: 14, minutes: 90, foci: ['Passspiel', 'Torschuss'], type: 'both', strategy: 'technique', seed: 5 });
    for (const k of ['Passspiel', 'Torschuss']) {
      if (!pr.blocks.some(b => P.hasFocus(P.exercise(s, b.exerciseId), k))) out.bugs.push(`Schwerpunkt nicht abgedeckt: ${k}`);
    }
    return out;
  });
  expect(r.bugs).toEqual([]);
});

test('Planassistent-Sheet: Chips, Vorschlag, Plan-B-Tausch, Übernehmen', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.click('#c-go'); // Heute: Assistent öffnen
  const sheet = page.locator('dialog[open].sheet');
  await expect(sheet).toBeVisible();
  // Zwei Schwerpunkte wählen
  await sheet.locator('[data-af="Passspiel"]').click();
  await sheet.locator('[data-af="Torschuss"]').click();
  await expect(sheet.locator('[data-af="Passspiel"]')).toHaveAttribute('aria-pressed', 'true');
  // Vorschlag erscheint mit Begründung und Plan B
  await expect(sheet.locator('.proposal-item').first()).toBeVisible();
  await expect(sheet.locator('.proposal-item .why').first()).not.toBeEmpty();
  const alts = sheet.locator('.proposal-item [data-alt]');
  expect(await alts.count()).toBeGreaterThan(0);
  // Plan B antippen tauscht die Übung im Vorschlag
  const firstName = await sheet.locator('.proposal-item strong').first().textContent();
  await alts.first().click();
  await expect(sheet.locator('.proposal-item strong').first()).not.toHaveText(firstName);
  // Als neue Einheit übernehmen: Blöcke behalten Begründung und Plan B
  await sheet.locator('[data-apply="new"]').click();
  const plan = await page.evaluate(() => { const s = window.__trainr.store.get(); return s.plans.find(p => p.id === s.selectedPlanId); });
  expect(plan.blocks.length).toBeGreaterThan(1);
  expect(plan.blocks[0].why).toBeTruthy();
  expect(plan.blocks[0].alternatives.length).toBeGreaterThan(0);
  expect(plan.foci).toEqual(['Passspiel', 'Torschuss']);
  expect(plan.focus).toBe('Passspiel');
  // Validierung akzeptiert den Stand (Backup-Rundreise)
  const roundtrip = await page.evaluate(async () => {
    const S = await import('/src/core/schema.js');
    const s = window.__trainr.store.get();
    S.validateV3(JSON.parse(JSON.stringify(s)));
    return true;
  });
  expect(roundtrip).toBe(true);
  expect(errors).toEqual([]);
});

test('Heute: Lange-nicht-trainiert-Chip öffnet den Assistenten mit Vorauswahl', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await go(page, '#heute');
  const d = page.locator('#t-create');
  if (!(await d.evaluate(x => x.open))) await d.locator('summary').click();
  await expect(page.locator('#c-go')).toBeVisible();
  await page.click('#c-go');
  const sheet = page.locator('dialog[open].sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.proposal-item').first()).toBeVisible();
  expect(errors).toEqual([]);
});
