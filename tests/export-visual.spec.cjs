const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {onboard,createSession,go,watchErrors}=require('./helpers.cjs');
for(const theme of ['dark','light']) test(`Export Bilder, Checkliste, PDF und PNG ${theme}`,async({page,context})=>{
 const errors=watchErrors(page);
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await onboard(page,{name:'E1 Haranni'});await createSession(page);await go(page,'#planen');
 await page.click('#pl-keeper');await page.click('dialog[open] [data-apply=replace]');
 await page.click('#pl-share');
 await expect(page.locator('#ex-prev[aria-busy=false] canvas').first()).toBeVisible();
 await page.locator('#ex-prev canvas').first().screenshot({path:`/downloads/export-materials-${theme}.png`});
 await page.locator('#ex-prev canvas').nth(1).screenshot({path:`/downloads/export-drill-${theme}.png`});
 await page.locator('#ex-prev canvas').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:`/downloads/export-mobile-${theme}.png`});
 for(const layout of ['detailed','cards','coach','compact'])for(const style of ['brand','ink']){
 const result=await page.evaluate(async({layout,style})=>{
  const P=await import('/src/core/planning.js'),D=await import('/src/exports/doc.js'),I=await import('/src/exports/images.js'),F=await import('/src/exports/pdf.js');
  const s=window.__trainr.store.get(),p=P.currentPlan(s),doc=D.buildDoc(s,p,layout),pages=await I.prepareImages(D.layoutPages(doc,style));
  const imgs=pages.flatMap(pg=>pg.ops.filter(o=>o.t==='image'));
  const bad=pages.flatMap(pg=>pg.ops.filter(o=>o.t==='text' && (o.y>800 && !o.text.includes("Lokal erstellt") || o.x<0)));
  return {count:imgs.length,blocks:p.blocks.length,bad:bad.length,materials:doc.find(e=>e.k==='materials').items,expected:Object.entries(P.requirements(s,p)),bytes:Array.from(F.pdfBytes(pages)),pages:pages.length};
 },{layout,style});
 expect(result.materials).toEqual(result.expected);expect(result.bad).toBe(0);
 expect(result.count).toBe(layout==='compact'?0:result.blocks);
 const pdf=Buffer.from(result.bytes);expect(pdf.toString('latin1').match(/\/Subtype \/Image/g)?.length||0).toBe(result.count);
 if(theme==='light' && style==='brand')fs.writeFileSync(`/downloads/trainr-export-${layout}.pdf`,pdf);
 if(theme==='light' && layout==='detailed' && style==='brand')fs.writeFileSync('/downloads/trainr-export-preview.pdf',pdf);
 }
 // Stale preview renders must never replace a more recent layout/style.
 await page.click('[data-layout=cards]');await page.click('[data-style=ink]');await page.click('[data-layout=compact]');
 await expect(page.locator('#ex-prev')).toHaveAttribute('aria-busy','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 // Offline image export uses only local code and generated snapshots.
 await context.setOffline(true);
 await page.click('[data-layout=detailed]');await expect(page.locator('#ex-prev[aria-busy=false] canvas').nth(1)).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('[data-do=pdf]')]);
 expect(fs.readFileSync(await download.path()).toString('latin1')).toContain('/Subtype /Image');
 expect(errors).toEqual([]);
});

test('Alle Bibliotheksbilder und EN',async({page})=>{
 await onboard(page);await createSession(page);
 const report=await page.evaluate(async()=>{
  const P=await import('/src/core/planning.js'),D=await import('/src/exports/doc.js'),I=await import('/src/exports/images.js'),Pitch=await import('/src/scene/pitch.js');
  const s=window.__trainr.store.get();const all=P.allExercises(s);let count=0;
  for(const e of all){await I.prepareImages([{ops:[{t:'image',svg:Pitch.drillPitch(e),style:'brand'}]}]);count++;}
  return {count};
 });expect(report.count).toBeGreaterThan(100);
 await page.evaluate(async()=>{const i=await import('/src/i18n/index.js');i.init('en');});
 const English=await page.evaluate(async()=>{
  const D=await import('/src/exports/doc.js'),P=await import('/src/core/planning.js');const s=window.__trainr.store.get();return D.buildDoc(s,P.currentPlan(s));
 });expect(English.some(e=>e.text==='Session overview')).toBe(true);
});

test('Eigene Skizze, lange Notizen, Druck und Druckerfreundlich',async({page})=>{
 await onboard(page);await createSession(page);
 await page.evaluate(async()=>{
  const P=await import('/src/core/planning.js');const s=window.__trainr.store.get(),p=P.currentPlan(s);
  window.__trainr.store.update('Exportprobe',s=>{
   const e={...P.exercise(s,p.blocks[0].exerciseId),id:'custom-export',custom:true,name:'Eigene Aufbauübung',animation:{version:2,items:[{k:'k'},{k:'ball'},{k:'cone'}],frames:[{seconds:2,caption:'Ball zum Torwart',points:[[250,95],[65,95],[160,65]]},{seconds:2,caption:'Ball sichern',points:[[250,95],[230,95],[160,65]]}]}};
   s.custom.push(e);const plan=P.currentPlan(s);plan.blocks=[{...plan.blocks[0],exerciseId:e.id,note:'Lange Notiz '.repeat(25)}];
  });
 });
 const data=await page.evaluate(async()=>{
  const P=await import('/src/core/planning.js'),D=await import('/src/exports/doc.js'),I=await import('/src/exports/images.js'),F=await import('/src/exports/pdf.js'),S=await import('/src/exports/sheet.js');
  const s=window.__trainr.store.get(),p=P.currentPlan(s),pages=await I.prepareImages(D.layoutPages(D.buildDoc(s,p),'ink'));
  const cv=F.renderCanvases(pages);document.getElementById('print-root').innerHTML=S.printHtml(s,p,'detailed','ink');
  return {bytes:Array.from(F.pdfBytes(pages)),bad:pages.flatMap(pg=>pg.ops.filter(o=>o.t==='text' && o.y>800&&!o.text.includes('Lokal erstellt'))).length};
 });expect(data.bad).toBe(0);fs.writeFileSync('/downloads/export-custom-ink.pdf',Buffer.from(data.bytes));
 await page.emulateMedia({media:'print'});await page.pdf({path:'/downloads/export-print.pdf',printBackground:true,preferCSSPageSize:true});
});
