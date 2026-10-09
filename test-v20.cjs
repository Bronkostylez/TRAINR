const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),server=require('./serve.cjs');
(async()=>{await new Promise(r=>server.listen(8892,r));const br=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});try{
 const c=await br.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.BASE_URL||'http://localhost:8892');for(let i=0;i<3;i++)await p.click('#setupNext');await p.click('#easyCreate');
 const b0=await p.evaluate(()=>structuredClone(plan().blocks[0])),sessionPeople=await p.evaluate(()=>plan().people);
 // tap exercise on Heute -> edit sheet
 await p.locator('[data-edit-block]').first().click();assert(await p.evaluate(()=>$('blockEditDialog').open));
 assert.equal(await p.inputValue('#blockEditPeople'),String(sessionPeople));assert.equal(await p.inputValue('#blockEditMinutes'),String(b0.minutes));
 await p.fill('#blockEditPeople','7');await p.fill('#blockEditMinutes','13');await p.waitForTimeout(100);
 const hint=await p.textContent('#blockEditHint');assert(/Spieler pro Gruppe/.test(hint),hint);await p.screenshot({path:'/downloads/trainr-v20-edit-390.png'});
 await p.click('#blockEditSave');assert.equal(await p.evaluate(()=>$('blockEditDialog').open),false);
 let b=await p.evaluate(()=>plan().blocks[0]);assert.equal(b.people,7);assert.equal(b.minutes,13);assert.equal(await p.evaluate(()=>plan().people),sessionPeople);
 assert(await p.evaluate(()=>/7 Spieler/.test($('homeTimeline').textContent)));
 // other blocks untouched
 assert.equal(await p.evaluate(()=>plan().blocks.slice(1).every(x=>x.people===undefined)),true);
 // undo restores the block, then persist check
 await p.click('#easyUndo');b=await p.evaluate(()=>plan().blocks[0]);assert.equal(b.people,undefined);assert.equal(b.minutes,b0.minutes);
 await p.locator('[data-edit-block]').first().click();await p.fill('#blockEditPeople','7');await p.click('#blockEditSave');await p.reload();assert.equal(await p.evaluate(()=>plan().blocks[0].people),7);
 // invalid input rejected
 await p.locator('[data-edit-block]').first().click();await p.fill('#blockEditPeople','0');await p.click('#blockEditSave');assert(await p.evaluate(()=>$('blockEditDialog').open));assert(/1-100/.test(await p.textContent('#blockEditError')));
 // same-as-session removes override
 await p.fill('#blockEditPeople','9');await p.click('#blockEditSame');assert.equal(await p.inputValue('#blockEditPeople'),String(sessionPeople));await p.click('#blockEditSave');assert.equal(await p.evaluate(()=>plan().blocks[0].people),undefined);
 // planner list
 await p.evaluate(()=>view('planner'));await p.locator('#blocks [data-edit-block]').first().click();await p.fill('#blockEditPeople','5');await p.click('#blockEditSave');
 assert.equal(await p.evaluate(()=>plan().blocks[0].people),5);assert(await p.evaluate(()=>/5 Spieler/.test($('blocks').textContent)));
 await p.screenshot({path:'/downloads/trainr-v20-planner-390.png'});
 // export and material use block players; details button
 assert(await p.evaluate(()=>/5 Spieler ·/.test(summaryText())));
 await p.locator('#blocks [data-edit-block]').first().click();await p.click('#blockEditDetail');assert(await p.evaluate(()=>$('detailDialog').open&&!$('blockEditDialog').open));await p.evaluate(()=>$('detailDialog').close());
 // timer still works with override
 await p.evaluate(()=>view('home'));await p.click('#homeStart');assert.equal(await p.evaluate(()=>currentView),'live');
 // widths
 for(const w of[360,768,1280]){await p.setViewportSize({width:w,height:900});await p.evaluate(()=>{resetTimer();view('home')});await p.locator('[data-edit-block]').first().click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+w);if(w===1280||w===360)await p.screenshot({path:`/downloads/trainr-v20-edit-${w}.png`});await p.click('#blockEditClose');}
 assert.deepEqual(errors,[]);console.log('V20 OK');
}finally{await br.close();server.close();}})().catch(e=>{console.error(e);process.exit(1)});
