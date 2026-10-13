const {test,expect}=require('@playwright/test');
const {onboard,go,state,plan,planTotal,noOverflow,watchErrors}=require('./helpers.cjs');
async function keeper(page){await onboard(page);await go(page,'#planen');await page.click('#pl-keeper');await expect(page.locator('dialog[open] .proposal-item').first()).toBeVisible();}
for(const theme of ['dark','light'])for(const width of [360,390,768,1280])test(`Torwart eigener Plan ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});const errors=watchErrors(page);await keeper(page);
 const sh=page.locator('dialog[open]');await expect(sh.locator('#as-min')).toHaveValue('20');await expect(sh.locator('#as-people')).toHaveValue('2');await expect(sh.locator('#as-keepers')).toHaveCount(0);await expect(sh.locator('[data-min="20"]')).toHaveAttribute('aria-checked','true');
 const before=await state(page);expect(before.teams[0].type).toBe('field');expect(before.plans[0].blocks).toEqual([]);
 if(width===390){await sh.locator('.proposal-item').first().scrollIntoViewIfNeeded();await page.screenshot({path:`/downloads/goalie-assistant-${theme}-390.png`});}
 await sh.locator('[data-apply=replace]').click();let p=await plan(page);expect(p.sessionType).toBe('keeper');expect(p.people).toBe(2);expect(p.blocks.length).toBe(3);expect(p.blocks.every(b=>b.exerciseId.startsWith('gk-'))).toBeTruthy();expect(await planTotal(page)).toBe(20);expect(await noOverflow(page)).toBeTruthy();
 if(width===390){await page.reload();await expect(page.locator("#pl-name")).toBeVisible();await page.locator('#pl-blocks').scrollIntoViewIfNeeded();await page.screenshot({path:`/downloads/goalie-plan-${theme}-390.png`});}
 await page.reload();await expect(page.locator('#pl-name')).toBeVisible();expect((await plan(page)).sessionType).toBe('keeper');expect(await planTotal(page)).toBe(20);
 await go(page,'#uebungen');await expect(page.locator('.drill').first()).toBeVisible();expect(await noOverflow(page)).toBeTruthy();
 await go(page,'#planen');await page.click('#pl-train');await expect(page.locator('section[data-view=training]')).toBeVisible();expect(errors).toEqual([]);
});
test('Torwart: Backup, Übersetzung, Quellen und Trainerbesetzung',async({page})=>{
 await keeper(page);await page.click('dialog[open] [data-apply=replace]');
 const result=await page.evaluate(async()=>{const P=await import('/src/core/planning.js'),S=await import('/src/core/schema.js'),A=await import('/src/core/assistant.js');let s=window.__trainr.store.get(),p=P.currentPlan(s);let saved=S.validateV3(JSON.parse(JSON.stringify(s)));let drills=P.allExercises(s).filter(e=>e.id.startsWith('gk-'));let f={age:'E-Jugend',people:2,keepers:0,coaches:0,minutes:20,type:'keeper',sourceOnly:true,seed:3};return {type:P.planType(saved,P.currentPlan(saved)), count:drills.length, urls:drills.every(e=>e.url.startsWith('https:')&&e.sources.length),plan:A.propose(s,f).blocks.map(b=>b.exerciseId)};});
 expect(result.type).toBe('keeper');expect(result.count).toBe(6);expect(result.urls).toBeTruthy();expect(result.plan).not.toContain('gk-steps');
 await page.evaluate(()=>window.__trainr.store.update('English',d=>{d.settings.lang='en'}));await page.reload();await go(page,'#planen');await expect(page.locator('#pl-keeper')).toContainText('Goalkeeper session');await page.click('#pl-assist');await expect(page.locator('dialog[open]')).toContainText('Goalkeepers');await expect(page.locator('dialog[open] .proposal-item').first()).not.toContainText('Partnerrollen');
});
test('Torwart: Offline-Neustart, Teilen/Import, Vorlagen, alle Animationen und Undo',async({page,context})=>{
 await keeper(page);await page.click('dialog[open] [data-apply=replace]');
 const verify=await page.evaluate(async()=>{const S=await import('/src/scene/scripts.js'),D=await import('/src/exports/doc.js'),P=await import('/src/core/planning.js'),SH=await import('/src/exports/share.js'),A=await import('/src/ui/actions.js');const s=window.__trainr.store.get(),p=P.currentPlan(s);for(const [id,sc]of Object.entries(S.SCRIPTS))if(id.startsWith('gk-'))S.scriptPlan(sc);const exported=SH.planFile(p.id);SH.importSharedPlan(exported);const imported=P.currentPlan(window.__trainr.store.get());const tpl=A.duplicatePlan(imported.id,{asTemplate:true});const copied=A.duplicatePlan(tpl.id,{fromTemplate:true});return {importType:imported.sessionType,time:imported.targetMinutes,copiedType:copied.sessionType,squad:P.squadLabel(imported,P.planType(s,imported))};});
 expect(verify.importType).toBe('keeper');expect(verify.time).toBe(20);expect(verify.copiedType).toBe('keeper');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);await context.setOffline(true);await page.reload();await go(page,'#planen');await expect(page.locator('#pl-name')).toBeVisible();expect(await planTotal(page)).toBe(20);await page.click('#pl-assist');await expect(page.locator('dialog[open] .proposal-item').first()).toBeVisible();
 await page.keyboard.press('Escape');await page.evaluate(()=>{window.__trainr.store.update('Undo test',d=>{d.plans.find(p=>p.id===d.selectedPlanId).people=3});window.__trainr.store.undo()});expect((await plan(page)).people).toBe(2);
});
