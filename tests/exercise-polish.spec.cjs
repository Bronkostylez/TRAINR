const {test,expect}=require('@playwright/test');
const {onboard,go,watchErrors}=require('./helpers.cjs');
for(const theme of ['light','dark'])for(const width of [360,390,768,1280])test(`Exercise polish ${theme} ${width}`,async({page})=>{
 const errors=watchErrors(page);await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await onboard(page);await go(page,'#uebungen');
 const title=page.locator('.drill-title').first();await expect(title).toBeVisible();await title.focus();await page.keyboard.press('Enter');
 const d=page.locator('dialog.detail-sheet[open]');await expect(d).toBeVisible();await expect(d.locator('#d-add')).toBeInViewport();await expect(d.locator('#d-feedback')).not.toHaveAttribute('open','');
 await expect(d.locator('.detail-content > section h3')).toHaveText(['Ziel','Aufbau & Material je Gruppe','Ablauf','Coaching']);
 expect(await d.locator('.sheet-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await d.locator('#d-feedback summary').click();await d.locator('[data-rate-star="4"]').click();await d.locator('#d-note').fill('Probe');await d.locator('#d-note').blur();
 await d.locator('summary',{hasText:'Quellen & Hinweise'}).click();await expect(d.locator('a.source').first()).toBeVisible();
 await d.locator('summary',{hasText:'Deine Variante'}).click();await d.locator('#v-min2').fill('13');await d.locator('#v-save').click();await expect(d.locator('.facts')).toContainText('13 Min');
 await d.locator('#d-add').click();await expect(d.locator('#d-add')).toContainText('Hinzugefügt');
 await d.locator('#d-next').click();await expect(d.locator('#d-note')).toHaveValue('');await d.locator('#d-prev').click();await expect(d.locator('#d-note')).toHaveValue('Probe');
 expect(await d.locator('.sheet-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.keyboard.press('Escape');await expect(d).toHaveCount(0);expect(errors).toEqual([]);
});
test('Exercise detail English and static controls',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'languages',{get:()=>['en-US']}));await page.emulateMedia({reducedMotion:'reduce'});await onboard(page);
 await page.evaluate(()=>window.__trainr.store.update('static',s=>s.settings.motion='off'));await go(page,'#uebungen');await page.locator('.drill-title').first().click();const d=page.locator('dialog[open]');
 await expect(d.locator('#d-feedback summary')).toHaveText('Your rating & note');await expect(d.locator('summary',{hasText:'Sources & notes'})).toBeVisible();
 await expect(d.locator('#d-rates')).toBeHidden();await expect(d.locator('#d-scrub')).toBeHidden();await d.locator('#d-play').click();await expect(d.locator('#d-steps .current')).toHaveAttribute('data-step','1');
});
