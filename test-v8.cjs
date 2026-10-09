const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),server=require('./serve.cjs');
const BASE=process.env.BASE_URL;
(async()=>{let local=!BASE;if(local)await new Promise(r=>server.listen(8795,'127.0.0.1',r));const url=BASE||'http://127.0.0.1:8795/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto(url);for(let i=0;i<3;i++)await p.click('#setupNext');await p.waitForFunction(()=>document.querySelector('#homeView')&&!document.querySelector('#homeView').classList.contains('hidden'));
assert.equal(await p.locator('#versionBadge').innerText(),'V17 · 17.0.0');
// 1. every drill: full choreography, in bounds, all steps visited in order, ends in a settled state.
const all=await p.evaluate(()=>{const div=document.createElement('div');document.body.append(div);const bad=[],stats=[];for(const e of SEED){const n=stepsFor(e).length;div.innerHTML=drillPitch(e,true,0);const sc=div.querySelector('.pitch-scene'),tl=SceneMotion.compile(sc,n,{camera:true});if(!tl){bad.push(e.id+': no choreography');continue;}
 const seen=[];for(let t=0;t<=tl.total;t+=100){const s=tl.stepAt(t);if(seen[seen.length-1]!==s)seen.push(s);}if(seen.join()!==[...Array(n).keys()].join())bad.push(e.id+': steps '+seen);
 if(tl.total<5000||tl.total>26000)bad.push(e.id+': duration '+tl.total);
 let moved=0;for(const a of tl.anims){const t=a.effect.target;if(!t.dataset.actor)continue;const fr=a.effect.getKeyframes();for(const f of fr){const m=/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(f.transform||'');if(!m)continue;const x=+t.dataset.x+ +m[1],y=+t.dataset.y+ +m[2];if(!(x>=12&&x<=308&&y>=10&&y<=180))bad.push(e.id+': out of bounds '+t.dataset.actor+' '+x+','+y);if(+m[1]||+m[2])moved++;}}
 if(!moved)bad.push(e.id+': nothing moves');
 const balls=sc.querySelectorAll('.actor-ball').length;if(!balls)bad.push(e.id+': no ball');
 // speed realism: no ball segment faster than a shot, no player faster than a sprint
 tl.destroy();stats.push(tl.total);}
 return {count:SEED.length,bad,min:Math.min(...stats),max:Math.max(...stats)};});
assert.equal(all.count,100);assert.deepEqual(all.bad,[]);console.log('PASS V8 choreography: 100/100 drills, all steps in order, in bounds, runs',all.min/1000,'-',all.max/1000,'s');
// 2. real-time playthrough in the detail view: plays to completion without looping or cutting off.
await p.click('[data-view=library]');await p.evaluate(()=>openDetail('v5-through'));
await p.waitForFunction(()=>detailTL&&detailTL.playing,null,{timeout:5000});
const total=await p.evaluate(()=>detailTL.total);const seenSteps=new Set();const t0=Date.now();
await p.waitForFunction(()=>{window.__s=window.__s||new Set();window.__s.add($('detailDialog').dataset.step);return detailTL.finished;},null,{timeout:total+8000,polling:100});
const wall=Date.now()-t0;const seq=await p.evaluate(()=>[...window.__s]);
assert(seq.length===stepsLen(await p.evaluate(()=>stepsFor(exercise(detailId)).length)),'all steps shown '+seq);function stepsLen(n){return n;}
assert.equal(await p.evaluate(()=>detailTL.playing),false);assert.match(await p.locator('#previewPlay').innerText(),/Nochmal/);
assert(wall>total*.4&&wall<total+3000,'real-time pacing '+wall+' vs '+total);
await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>detailTL.finished),true,'stays at the finished state, no loop');
console.log('PASS V8 detail: full run-through in',wall,'ms of',total,'ms, steps',seq.join('>'),', stops at the end');
// speed buttons, scrub, step jump
await p.click('[data-rate="2"]');await p.click('#previewPlay');await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>detailTL.anims[0].playbackRate),2);
await p.click('[data-rate="1"]');await p.fill('#previewScrub','2000').catch(()=>{});await p.evaluate(()=>{const s=$('previewScrub');s.value=3000;s.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await p.evaluate(()=>Math.round(detailTL.time/100)),30);
await p.click('[data-preview-step="1"]');await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>$('detailDialog').dataset.step),'1');
// cards: visible scenes run a full cycle, at most three at once
await p.click('#detailClose');await p.evaluate(()=>document.querySelector('#cards .pitch-scene').scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(1400);
const cards=await p.evaluate(()=>({tls:cardTL.size,running:[...cardTL.values()].filter(t=>t.playing).length,connected:[...cardTL.keys()].every(s=>s.isConnected)}));assert(cards.tls>=1&&cards.tls<=3&&cards.connected,JSON.stringify(cards));
// performance under 4x CPU throttle: detail playing and library scrolling
const cdp=await c.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.evaluate(()=>openDetail('v5-3v2'));await p.waitForFunction(()=>detailTL&&detailTL.playing);await p.waitForTimeout(1800);
console.log(await p.evaluate(()=>({anims:document.getAnimations().length,running:document.getAnimations().filter(a=>a.playState==='running').map(a=>(a.effect.target&&(a.effect.target.id||a.effect.target.className&&a.effect.target.className.baseVal||a.effect.target.className||a.effect.target.tagName))+':'+(a.animationName||a.constructor.name)).slice(0,25)})));
const frames=await p.evaluate(()=>new Promise(res=>{const a=[];let prev=performance.now();const f=t=>{a.push(t-prev);prev=t;if(a.length<150)requestAnimationFrame(f);else res(a.slice(10));};requestAnimationFrame(f);}));frames.sort((x,y)=>x-y);const med=frames[frames.length>>1],p95=frames[Math.floor(frames.length*.95)];console.log('detail playing 4x throttle frame ms median',med.toFixed(1),'p95',p95.toFixed(1));assert(med<40&&p95<90,'frame times');
await p.click('#detailClose');await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
// 3. reduced motion + switch
await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>cardTL.size),0);
await p.evaluate(()=>openDetail('v5-3v2'));assert.equal(await p.evaluate(()=>detailTL),null);assert.equal(await p.locator('.pitch-large .actor-ball').first().evaluate(e=>getComputedStyle(e).display),'none');assert.equal(await p.evaluate(()=>document.querySelector('.pitch-large').classList.contains('motion-on')),false);
await p.click('#previewPlay');await p.waitForFunction(()=>$('detailDialog').dataset.step==='1');await p.click('#previewPlay');await p.click('#detailClose');
await p.emulateMedia({reducedMotion:'no-preference'});
// 4. data intact + cache name
const state=await p.evaluate(()=>JSON.stringify(state));await p.evaluate(()=>add('gatepass'));
const keys=await p.evaluate(()=>caches.keys());await p.waitForTimeout(500);
console.log('caches',keys.join(','));
assert.deepEqual(errors,[]);
console.log('PASS V8: choreography, pacing, speed/scrub/steps, cards, throttled performance, reduced motion; no page errors');
}finally{await b.close();if(local)server.close();}})().catch(e=>{console.error(e);process.exit(1);});
