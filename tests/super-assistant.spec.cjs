const { test, expect } = require('@playwright/test');

// Super-Übungen: Der Assistent wählt eine Variante nur, wenn sie besser zur Gruppe passt, und begründet das.
test('Assistent wählt passende Varianten und plant sie gültig', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const A = await import('/src/core/assistant.js'), P = await import('/src/core/planning.js'), V = await import('/src/data/variants.js');
    const s = window.__trainr.store.get(), out = { bugs: [], picked: [] };
    for (const people of [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20]) for (const age of P.AGES) for (const strategy of Object.keys(A.STRATEGIES)) for (const foci of [['Passspiel'], ['Wahrnehmung'], ['Dribbling']]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let pr; try { pr = A.propose(s, { age, people, keepers: 0, coaches: 1, minutes: 75, foci, type: 'field', strategy, seed }); } catch { continue; }
      for (const b of pr.blocks) {
        if (!V.isVariantId(b.exerciseId)) continue;
        const e = P.exercise(s, b.exerciseId);
        if (!e) { out.bugs.push('unbekannt ' + b.exerciseId); continue; }
        if (!e.ages.includes(age)) out.bugs.push('Alter ' + b.exerciseId);
        if (P.layout(s, e, { players: people, keepers: 0, coaches: 1 }).level === 'no') out.bugs.push('passt nicht ' + b.exerciseId + ' ' + people);
        if (!b.why.includes('Variante')) out.bugs.push('ohne Begründung ' + b.exerciseId);
        out.picked.push(b.exerciseId + '@' + people);
      }
    }
    const q = A.bestVariant(s, P.exercise(s, 'v5-rondo'), { players: 5, keepers: 0, coaches: 1 }), n = A.bestVariant(s, P.exercise(s, 'v22-quadrat'), { players: 6, keepers: 0, coaches: 1 });
    out.rondo5 = q && q.v.min <= 5 && q.v.max >= 5; out.quadratOk = n === null;
    return out;
  });
  expect(r.rondo5).toBe(true);
  expect(r.quadratOk).toBe(true);
  expect(r.bugs).toEqual([]);
  console.log('Varianten gewählt:', r.picked.length, [...new Set(r.picked)].slice(0, 6).join(', '));
});
