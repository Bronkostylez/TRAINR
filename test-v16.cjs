const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),server=require('./serve.cjs');
(async()=>{const base=process.env.BASE_URL;if(!base)await new Promise(r=>server.listen(8877,'127.0.0.1',r));const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});try{
// ---- Reduced-motion phone context: shell structure, gestures, sheets, history, persistence, offline.
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base||'http://127.0.0.1:8877');
for(let i=0;i<3;i++)await p.click('#setupNext');
assert.equal(await p.evaluate(()=>APP_VERSION),'17.0.0');
// App shell: fixed top bar, attached bottom tab bar with icons and glider.
const header=await p.locator('header').boundingBox();assert.equal(header.y,0,'header pinned to top');
const nav=await p.locator('#mainNav').boundingBox();assert(Math.abs(nav.y+nav.height-844)<2,'tab bar attached to bottom edge');
assert.equal(await p.locator('#mainNav .nav-icon svg').count(),4,'four SVG tab icons');
assert.equal(await p.locator('.tab-glider').count(),1,'glider exists');
assert.equal(await p.locator('header .bar-title').count(),1,'bar title exists');
// Tabs + hash routing.
await p.click('[data-view=library]');assert.equal(await p.evaluate(()=>location.hash),'#uebungen');
assert.equal(await p.evaluate(()=>document.querySelector('.tab-glider').style.getPropertyValue('--tab')),'1');
await p.click('[data-view=planner]');assert.equal(await p.evaluate(()=>location.hash),'#plan');
// Swipe navigation between tabs (synthetic touch).
const swipe=(x0,x1,y=420)=>p.evaluate(([x0,x1,y])=>{const t=a=>new Touch({identifier:1,target:document.body,clientX:a,clientY:y});const fire=(type,x)=>document.body.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t(x)],changedTouches:[t(x)],bubbles:true,cancelable:true}));fire('touchstart',x0);for(let i=1;i<=8;i++)fire('touchmove',x0+(x1-x0)*i/8);fire('touchend',x1);},[x0,x1]);
await swipe(320,60);await p.waitForFunction(()=>document.body.dataset.screen==='live');assert.equal(await p.evaluate(()=>location.hash),'#training');
await swipe(60,320);await p.waitForFunction(()=>document.body.dataset.screen==='planner');
// Bottom sheet: detail dialog docks to the bottom edge, grab handle, drag-to-dismiss.
await p.click('[data-view=library]');await p.locator('#cards .card [data-detail]').first().click();
assert(await p.locator('#detailDialog[open]').count(),'sheet open');
assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#detailDialog')).position),'fixed');
const sheet=await p.locator('#detailDialog').boundingBox();assert(Math.abs(sheet.y+sheet.height-844)<2,'sheet docks to bottom edge');
assert(await p.locator('#detailDialog .sheet-grab').count(),'grab handle');
await p.evaluate(()=>{const d=document.querySelector('#detailDialog');const t=y=>new Touch({identifier:2,target:d,clientX:200,clientY:y});const fire=(type,y)=>d.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t(y)],changedTouches:[t(y)],bubbles:true,cancelable:true}));d.scrollTop=0;fire('touchstart',300);for(let i=1;i<=6;i++)fire('touchmove',300+i*35);fire('touchend',510);});
await p.waitForFunction(()=>!document.querySelector('#detailDialog').open);assert(true,'drag-to-dismiss closes the sheet');
// Back button closes an open sheet before navigating.
await p.locator('#cards .card [data-detail]').first().click();await p.goBack();
await p.waitForFunction(()=>!document.querySelector('#detailDialog').open);
// Persistence: plan edits survive reload byte-identically.
await p.locator('#cards .card [data-add]').first().click();
const before=await p.evaluate(()=>localStorage.getItem('trainr-v2'));
await p.reload();await p.waitForSelector('#mainNav');
assert.equal(await p.evaluate(()=>localStorage.getItem('trainr-v2')),before,'saved data intact after reload');
assert.equal(await p.evaluate(()=>plan().blocks.length),1);
// PWA polish.
const manifest=await p.evaluate(async()=>(await fetch('./manifest.webmanifest')).json());
assert.equal(manifest.id,'./');assert(manifest.display_override.includes('standalone'));assert.equal(manifest.shortcuts.length,4);assert(manifest.icons.some(i=>i.purpose==='maskable'));
const css=await p.evaluate(()=>[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules].map(r=>r.cssText);}catch{return[];}}).join('\n'));
assert(css.includes('safe-area-inset-bottom'),'safe-area handling present');
assert(css.includes('sheet-in'),'sheet animation present');
// Offline: new cache serves the app and data.
await p.waitForFunction(()=>navigator.serviceWorker.controller);
await p.waitForFunction(async()=>(await caches.keys()).includes('keeperboard-v17.0.0'));
await c.setOffline(true);await p.reload();await p.waitForSelector('#mainNav');
assert.equal(await p.evaluate(()=>APP_VERSION),'17.0.0');
assert.equal(await p.evaluate(()=>localStorage.getItem('trainr-v2')),before,'saved data intact offline');
await c.setOffline(false);
assert.deepEqual(errs,[],'no page errors: '+errs.join(' | '));
await c.close();
// ---- Motion-on context: sheet animates in, swipe animates, glider slides.
const c2=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p2=await c2.newPage(),errs2=[];p2.on('pageerror',e=>errs2.push(e.message));
await p2.goto(base||'http://127.0.0.1:8877');
for(let i=0;i<3;i++)await p2.click('#setupNext');
await p2.click('[data-view=library]');await p2.evaluate(()=>document.querySelector('#cards .card [data-detail]').click());
assert.equal(await p2.evaluate(()=>getComputedStyle(document.querySelector('#detailDialog')).animationName),'sheet-in','sheet slides up with motion on');
await p2.click('#detailClose');
await p2.evaluate(()=>{const t=a=>new Touch({identifier:1,target:document.body,clientX:a,clientY:420});const fire=(type,x)=>document.body.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t(x)],changedTouches:[t(x)],bubbles:true,cancelable:true}));fire('touchstart',320);for(let i=1;i<=8;i++)fire('touchmove',320-32.5*i);fire('touchend',60);});
await p2.waitForFunction(()=>document.body.dataset.screen==='planner');
assert.deepEqual(errs2,[],'no page errors with motion on: '+errs2.join(' | '));
await c2.close();
console.log('PASS V16: app shell (fixed top bar, attached tab bar with SVG icons and glider), hash routing, swipe tab navigation, bottom sheets with grab handle and drag-to-dismiss, back button closes sheets, byte-identical saved data across reload and offline, PWA manifest polish, safe-area CSS, motion honored both ways.');}finally{await b.close();if(!process.env.BASE_URL)server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
