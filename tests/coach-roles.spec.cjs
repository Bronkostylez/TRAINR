const {test,expect}=require('@playwright/test');
const {onboard,go,plan,noOverflow,watchErrors}=require('./helpers.cjs');
const lay=(page,id,sq,use=true)=>page.evaluate(async([id,sq,use])=>{const P=await import('/src/core/planning.js');const s=window.__trainr.store.get(),L=P.layout(s,P.exercise(s,id),sq,1,use);return {...L,text:P.layoutText(L)}},[id,sq,use]);
async function sample(page){await onboard(page);await go(page,'#planen');await page.evaluate(()=>window.__trainr.store.update('Sample',s=>{const p=s.plans.find(x=>x.id===s.selectedPlanId);p.sessionType='keeper';p.people=2;p.coaches=1;p.pauses={count:0,minutes:1};p.blocks=[{id:'strike',exerciseId:'gk-strike',minutes:5},{id:'steps',exerciseId:'gk-steps',minutes:5}]}));}
test('Trainer: Einzelkeeper, keine Phantomspieler, keine Spielrolle',async({page})=>{
 await onboard(page);let L=await lay(page,'gk-strike',{players:0,keepers:1,coaches:1});expect(L).toMatchObject({level:'ok',active:1,waiting:0,coachFill:1,groups:1});
 expect((await lay(page,'gk-strike',{players:0,keepers:1,coaches:0})).level).toBe('no');
 expect((await lay(page,'gk-strike',{players:0,keepers:1,coaches:1},false)).level).toBe('no');
 expect((await lay(page,'gk-strike',{players:1,keepers:0,coaches:1})).why).toBe('nokeeper');
 L=await lay(page,'gk-strike',{players:0,keepers:2,coaches:1});expect(L.active+L.waiting).toBe(2);expect(L).toMatchObject({groups:1,coachFill:1,waiting:1});
 L=await lay(page,'gk-steps',{players:0,keepers:2,coaches:1});expect(L).toMatchObject({active:1,waiting:1,coachesUsed:1});
 expect((await lay(page,'gk-steps',{players:0,keepers:2,coaches:0})).why).toBe('nocoach');
 const capped=await page.evaluate(async()=>{const P=await import('/src/core/planning.js'),s=window.__trainr.store.get();return P.layout(s,P.exercise(s,'gk-steps'),{players:0,keepers:2,coaches:1},2)});expect(capped.groups).toBe(1);
 for(const id of ['3v3','v5-rondo','v5-3v3neutral','v22-nachschuss','v22-kette']){L=await lay(page,id,{players:1,keepers:1,coaches:10});expect(L.coachFill).toBe(0);expect(L.coachRole).toBe('');}
 L=await lay(page,'gatepass',{players:12,keepers:0,coaches:1});expect(L).toMatchObject({groups:6,active:12,waiting:0,coachFill:0});
 L=await lay(page,'v5-scan',{players:2,keepers:0,coaches:1});expect(L).toMatchObject({level:'ok',active:2,coachFill:1});
});
for(const theme of ['dark','light'])for(const width of [360,390,768,1280])test(`Trainer Rolle UI ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});const errors=watchErrors(page);await sample(page);
 await expect(page.locator('[data-key=strike]')).toContainText('1 Trainer: Zuspiel / Zuwurf');expect(await noOverflow(page)).toBe(true);
 await page.locator('[data-key=strike] [data-edit]').click();await expect(page.locator('[name=coachSupport]')).toBeChecked();await expect(page.locator('#be-hint')).toContainText('1 Trainer: Zuspiel / Zuwurf');
 if(width===390){await page.waitForTimeout(400);await page.screenshot({path:`/downloads/coach-editor-${theme}-390.png`});}
 await page.locator('[name=coachSupport]').uncheck();await expect(page.locator('#be-hint')).not.toContainText('1 Trainer:');await page.click('dialog[open] button[type=submit]');expect((await plan(page)).blocks[0].coachSupport).toBe(false);
 await page.reload();await expect(page.locator('[data-key=strike]')).not.toContainText('1 Trainer:');
 await page.locator('[data-key=strike] [data-more]').click();await page.click('#be-detail');await expect(page.locator('.coach-role')).toContainText('nicht Torwart, Gegner oder Spieler im Wettkampf');expect(await noOverflow(page)).toBe(true);
 if(width===390){await page.locator('.coach-role').scrollIntoViewIfNeeded();await page.waitForTimeout(400);await page.screenshot({path:`/downloads/coach-detail-${theme}-390.png`});}
 expect(errors).toEqual([]);
});
test('Trainer: Backup, Teilen, Export, Undo, EN und Offline',async({page,context})=>{
 await sample(page);await page.locator('[data-key=strike] [data-edit]').click();await page.locator('[name=coachSupport]').uncheck();await page.click('dialog[open] button[type=submit]');
 await page.evaluate(()=>{window.__trainr.store.update('Undo role',s=>{s.plans.find(p=>p.id===s.selectedPlanId).blocks[0].coachSupport=true});window.__trainr.store.undo()});expect((await plan(page)).blocks[0].coachSupport).toBe(false);
 const r=await page.evaluate(async()=>{const S=await import('/src/core/schema.js'),P=await import('/src/core/planning.js'),SH=await import('/src/exports/share.js'),D=await import('/src/exports/doc.js');const s=window.__trainr.store.get(),p=P.currentPlan(s);S.validateV3(JSON.parse(JSON.stringify(s)));const obj=SH.planFile(p.id);SH.importSharedPlan(obj);return {saved:obj.plan.blocks[0].coachSupport,imported:P.currentPlan(window.__trainr.store.get()).blocks[0].coachSupport,groups:D.blocksData(s,{...p,blocks:[{...p.blocks[0],coachSupport:true}]})[0].groups}});
 expect(r).toMatchObject({saved:false,imported:false});expect(r.groups).toContain('1 Trainer: Zuspiel / Zuwurf');
 await page.evaluate(()=>{window.__trainr.store.update('Language',s=>s.settings.lang='en')});await page.reload();await page.evaluate(async()=>(await import('/src/views/detail.js')).openDetail('gk-strike'));await expect(page.locator('.coach-role')).toContainText('Coach role');await expect(page.locator('.coach-role')).not.toContainText('Trainer');
 await page.keyboard.press('Escape');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);const before=await page.evaluate(()=>JSON.stringify(window.__trainr.store.get()));await context.setOffline(true);await page.reload();await expect(page.locator('#pl-name')).toBeVisible();expect(await page.evaluate(()=>JSON.stringify(window.__trainr.store.get()))).toBe(before);
 await page.locator('#pl-blocks [data-edit]').first().click();await expect(page.locator('[name=coachSupport]')).not.toBeChecked();await expect(page.locator('dialog[open]')).toContainText('Coach takes a support role');
});
