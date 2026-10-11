const { test, expect } = require('@playwright/test');
const { onboard: baseOnboard, go, watchErrors, noOverflow } = require('./helpers.cjs');
// Die Fälle legen heute um 17:00 ein Training an. Vorher prüfen, unabhängig von der echten Uhrzeit.
test.beforeEach(async ({ page }) => {
  const morning = new Date(); morning.setHours(9, 0, 0, 0);
  await page.clock.setFixedTime(morning);
});
async function onboard(page, opts = {}) {
  await baseOnboard(page, { ...opts, skipTour: false });
  await expect(page.locator('dialog[open] [data-skip]')).toBeVisible();
  await page.locator('dialog[open] [data-skip]').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}
async function seed(page) {
  return page.evaluate(async () => {
    const C = await import('/src/core/calendar.js');
    const store = window.__trainr.store, s = store.get(), team = s.teams.find(t => t.id === s.activeTeamId);
    const date = C.todayIso(), ev = { ...C.blankEvent(team, date), start: '17:00', end: '18:00' };
    store.update('Test', d => { d.events = [ev]; });
    return ev.id;
  });
}
for (const width of [360, 390, 430, 768, 1280]) {
  test(`Wochenfokus + Tagesassistent ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); const errors = watchErrors(page);
    await onboard(page); const id = await seed(page);
    await page.click('#t-week'); await expect(page.locator('.week-hero')).toBeVisible();
    const card = page.locator('.week-event').first();
    await card.locator('[data-week-focus]').click();
    const sh = page.locator('dialog[open]').last();
    expect(await sh.locator('.fpick-group .chips').first().evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    for (const f of ['Passspiel', 'Torschuss', 'Dribbling', 'Wahrnehmung']) await sh.locator(`[data-af="${f}"]`).click();
    await sh.locator('[data-af="Freilaufen"]').click();
    await expect(sh.locator('#wf-count')).toHaveText('4 von 4 gewählt');
    await sh.locator('[data-af="Dribbling"]').click(); await sh.locator('[data-af="Wahrnehmung"]').click();
    await sh.locator('#wf-save').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
    const before = await page.evaluate(id => { const s=window.__trainr.store.get();return { ev:s.events.find(e=>e.id===id), plans:s.plans.length }; }, id);
    expect(before.ev.foci).toEqual(['Passspiel', 'Torschuss']); expect(before.ev.planId).toBeNull();
    await page.reload(); await expect(page.locator('.week-foci').first()).toContainText('Passspiel');
    await expect(page.locator('.week-progress strong')).toHaveText('1 / 1');
    if (width === 390) { await page.waitForTimeout(600); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: '/downloads/trainr-week-top-390.png' }); await page.locator('.week-day.is-today').scrollIntoViewIfNeeded(); await page.screenshot({ path: '/downloads/trainr-week-390.png' }); }
    await page.locator('[data-week-focus]').first().click();
    if (width === 390) { await page.waitForTimeout(600); await page.screenshot({ path: '/downloads/trainr-focus-390.png' }); }
    await page.locator('dialog[open] [data-close]').first().click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
    await go(page, '#heute'); await page.click('#t-prepare');
    const as = page.locator('dialog[open]').last();
    await expect(as.locator('[data-af="Passspiel"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(as.locator('[data-af="Torschuss"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(as.locator('#as-min')).toHaveValue('60');
    await expect(as.locator('.assistant-context')).not.toContainText('${');
    await expect(as.locator('[data-apply="replace"]')).toHaveCount(0);
    await as.locator('#as-people').fill('10'); await as.locator('#as-people').dispatchEvent('change');
    await as.locator('#as-keepers').fill('2'); await as.locator('#as-keepers').dispatchEvent('change');
    if (width === 390) { await page.waitForTimeout(600); await page.screenshot({ path: '/downloads/trainr-day-390.png' }); }
    await as.locator('[data-apply="new"]').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
    const after = await page.evaluate(async id => { const s=window.__trainr.store.get(), ev=s.events.find(e=>e.id===id), p=s.plans.find(p=>p.id===ev.planId); (await import('/src/core/schema.js')).validateV3(JSON.parse(JSON.stringify(s)));return { ev,p,n:s.plans.length }; }, id);
    expect(after.n).toBe(before.plans+1); expect(after.p.people).toBe(10); expect(after.p.keepers).toBe(2); expect(after.p.date).toBe(after.ev.date);
    expect(after.p.foci).toEqual(['Passspiel', 'Torschuss']); expect(after.p.blocks.length).toBeGreaterThan(1);
    await page.click('#t-week'); await page.locator('[data-week-prepare]').first().click();
    await expect(page.locator('#pl-name')).toBeVisible(); await expect(page.locator('dialog[open]')).toHaveCount(0);
    expect(await noOverflow(page)).toBe(true); expect(errors).toEqual([]);
  });
}

test('Wochenplaner Englisch, Navigation, Undo und Team-Isolation', async ({ page }) => {
  const errors=watchErrors(page); await onboard(page); const id=await seed(page);
  await page.evaluate(()=>window.__trainr.store.setting('lang','en')); await page.reload();
  await page.click('#t-week'); await expect(page.locator('.week-hero h2')).toContainText('Focus first.');
  await page.locator('[data-week-focus]').first().click(); const sh=page.locator('dialog[open]').last();
  await expect(sh.locator('h3')).toHaveText('What should stick?'); await sh.locator('[data-af="Passspiel"]').click();
  await expect(sh.locator('#wf-count')).toHaveText('1 of 4 selected');
  await page.waitForTimeout(600); await page.screenshot({path:'/downloads/trainr-focus-en-390.png'}); await sh.locator('#wf-save').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.waitForTimeout(600); await page.locator('.week-day.is-today').scrollIntoViewIfNeeded(); await page.waitForTimeout(9500); await page.screenshot({path:'/downloads/trainr-week-en-390.png'});
  await page.evaluate(()=>window.__trainr.store.undo()); await expect(page.locator('.week-foci')).toHaveCount(0);
  await page.evaluate(()=>window.__trainr.store.redo()); await expect(page.locator('.week-foci')).toContainText('Passing');
  await page.locator('[data-week-shift="1"]').click(); await expect(page.locator('.week-event')).toHaveCount(0);
  await page.click('#w-current'); await expect(page.locator('.week-event')).toHaveCount(1);
  await page.locator('[data-week-prepare]').click(); await expect(page.locator('.assistant-context')).toContainText('Prepare training day');
  await page.waitForTimeout(600); await page.screenshot({path:'/downloads/trainr-day-en-390.png'});
  await page.locator('dialog[open] [data-close]').first().click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.evaluate(()=>{ const st=window.__trainr.store;st.update('Other team',d=>{ const t={...structuredClone(d.teams[0]),id:'other',name:'Other'};d.teams.push(t);d.activeTeamId=t.id; }); });
  await expect(page.locator('.week-event')).toHaveCount(0); expect(errors).toEqual([]);
});

test('Abgesagte Termine, Fokus löschen, Datum und Backups', async ({ page }) => {
  await onboard(page); const id=await seed(page); await page.click('#t-week');
  await page.locator('[data-week-focus]').click(); await page.locator('dialog[open] [data-af="Passspiel"]').click(); await page.click('#wf-save'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('[data-week-focus]').click(); await page.locator('dialog[open] [data-af="Passspiel"]').click(); await page.click('#wf-save'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await page.evaluate(id=>window.__trainr.store.get().events.find(e=>e.id===id).foci,id)).toBeUndefined();
  await page.evaluate(id=>window.__trainr.store.update('Cancelled',d=>{d.events.find(e=>e.id===id).status='ausgefallen';}),id);
  await expect(page.locator('[data-week-prepare]')).toHaveCount(0); await expect(page.locator('[data-week-focus]')).toHaveCount(0);
  const check=await page.evaluate(async ()=>{const {validateV3}=await import('/src/core/schema.js');const s=JSON.parse(JSON.stringify(window.__trainr.store.get()));s.events[0].foci=['made-up'];try {validateV3(s);return false;}catch{return true;}}); expect(check).toBe(true);
  await page.locator('#w-date').fill('2026-12-31'); await page.locator('#w-date').dispatchEvent('change');
  await expect(page.locator('#w-date')).toHaveValue('2026-12-28');
});

test('Wochenfokus offline und Torwart-Schwerpunkte', async ({ page, context }) => {
  const errors=watchErrors(page); await onboard(page, {type:'keeper'}); await seed(page);
  await page.evaluate(()=>navigator.serviceWorker.ready); await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.click('#t-week'); await page.locator('[data-week-focus]').click();
  await expect(page.locator('dialog[open] [data-af="Falltechnik"]')).toHaveCount(0);
  await page.locator('dialog[open] [data-af="Fangen"]').click(); await page.click('#wf-save'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.week-foci')).toContainText('Fangen');
  await page.locator('[data-week-prepare]').click(); await expect(page.locator('#as-keepers')).toHaveCount(0);
  await expect(page.locator('.proposal-item').first()).toBeVisible();
  await page.locator('dialog[open] [data-apply="new"]').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  const event=await page.evaluate(()=>window.__trainr.store.get().events[0]); expect(event.planId).toBeTruthy();
  await context.setOffline(false); expect(errors).toEqual([]);
});

test('Training hinzufügen, verschieben und Art ändern lässt keine ungültigen Fokusse zurück', async ({ page }) => {
  const errors=watchErrors(page); await onboard(page); const id=await seed(page); await page.click('#t-week');
  await page.locator('[data-week-focus]').click(); await page.locator('dialog[open] [data-af="Passspiel"]').click(); await page.click('#wf-save'); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('[data-week-event]').click(); await page.locator('dialog[open] [data-a="edit"]').click();
  await expect(page.locator('#ev-form')).toBeVisible(); await page.locator('#ev-form [data-kind="termin"]').click();
  await page.locator('dialog[open] button[type=submit]').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  const event=await page.evaluate(id=>window.__trainr.store.get().events.find(e=>e.id===id),id);expect(event.kind).toBe('termin');expect(event.foci).toBeUndefined();
  await page.locator('.week-day.is-today [data-week-add]').click(); await expect(page.locator('#ev-form')).toBeVisible();
  await page.locator('dialog[open] button[type=submit]').click(); await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-week-focus]')).toHaveCount(1); expect(errors).toEqual([]);
});

test('Terminänderung während Vorschau verhindert falsche Verknüpfung', async ({ page }) => {
  await onboard(page); const id=await seed(page); await page.click('#t-week'); await page.locator('[data-week-prepare]').click();
  const count=await page.evaluate(()=>window.__trainr.store.get().plans.length);
  await page.evaluate(id=>window.__trainr.store.update('Verschoben',d=>{d.events.find(e=>e.id===id).start='17:15';}),id);
  await page.locator('dialog[open] [data-apply="new"]').click();
  const after=await page.evaluate(id=>({n:window.__trainr.store.get().plans.length,pid:window.__trainr.store.get().events.find(e=>e.id===id).planId}),id);
  expect(after.n).toBe(count); expect(after.pid).toBeNull(); await expect(page.locator('.toast')).toContainText('Termin nicht mehr verfügbar.');
});
