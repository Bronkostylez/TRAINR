'use strict';
// V8: exercise scenes play a full schematic run-through; cinematic motion on top of V7.
// Presentation only. No plan, storage or training logic changes. Reduced motion and the animation switch win.
const v8Ok=()=>!reduced()&&!document.hidden&&typeof SceneMotion!=='undefined';
const v8Fmt=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
// ---- Cards: play each visible scene once through, rest, repeat. At most three at the same time.
const cardTL=new Map(),cardVisible=new Set();
function cardStop(scene){const tl=cardTL.get(scene);if(tl){clearTimeout(tl.restart);tl.destroy();cardTL.delete(scene);}}
function cardPump(){if($('detailDialog').open){for(const tl of cardTL.values())tl.pause();return;}for(const tl of cardTL.values())if(!tl.playing&&!tl.finished&&tl.time>0)tl.play(1);for(const scene of [...cardVisible]){if(!scene.isConnected){cardVisible.delete(scene);cardStop(scene);continue;}}
 if(!v8Ok())return;
 for(const scene of cardVisible){if(cardTL.size>=3)break;if(cardTL.has(scene))continue;const tl=SceneMotion.compile(scene,1,{camera:false});if(!tl)continue;cardTL.set(scene,tl);
  const run=()=>{if(!cardTL.has(scene)||!v8Ok())return;tl.seek(0);tl.play(1);tl.anims[0].onfinish=()=>{tl.restart=setTimeout(run,1800);};};run();}}
const cardObserver=new IntersectionObserver(entries=>{for(const en of entries){const s=en.target;if(en.isIntersecting&&en.intersectionRatio>=.5)cardVisible.add(s);else{cardVisible.delete(s);cardStop(s);}}cardPump();},{threshold:[0,.5]});
const cardSeen=new WeakSet();
const cardObserved=new Set();
function cardScan(){for(const s of cardObserved)if(!s.isConnected){cardObserver.unobserve(s);cardObserved.delete(s);cardVisible.delete(s);cardStop(s);}document.querySelectorAll('#cards .pitch-scene').forEach(s=>{if(cardSeen.has(s))return;cardSeen.add(s);cardObserved.add(s);cardObserver.observe(s);});}
new MutationObserver(cardScan).observe($('cards'),{childList:true});cardScan();
function cardsOff(){for(const s of [...cardTL.keys()])cardStop(s);}
// ---- Detail: full run-through with timeline, speed and step jumps.
let detailTL=null,detailFrame=0,detailShownStep=-1;
const v8Update=updateStep;
function playerStop(){cancelAnimationFrame(detailFrame);detailFrame=0;if(detailTL){clearTimeout(detailTL.autoplay);detailTL.destroy();detailTL=null;}}
function paintStep(i){const e=exercise(detailId),steps=stepsFor(e);if(!steps[i]||i===detailShownStep)return;detailShownStep=i;detailStep=i;$('previewCaption').textContent=`${i+1}. ${steps[i]}`;document.querySelectorAll('[data-preview-step]').forEach(b=>{const on=Number(b.dataset.previewStep)===i;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});$('detailDialog').dataset.step=String(i);$('detailDialog').querySelectorAll('.coaching-steps li').forEach((li,k)=>li.classList.toggle('current-step',k===i));const label=$('detailContent').querySelector('.scene-step-label');if(label)label.textContent='SCHRITT '+(i+1);const sc=$('detailContent').querySelector('.pitch-large');if(sc)sc.dataset.sceneStep=String(i);}
updateStep=function(){if(!detailTL)return v8Update();paintStep(detailStep);};
let frameClock=0,movingKey='';
function playerFrame(force){detailFrame=0;const tl=detailTL;if(!tl)return;const t=tl.time;paintStep(tl.stepAt(t));const now=performance.now();
 if(force===true||now-frameClock>120){frameClock=now;const scrub=$('previewScrub');if(scrub&&document.activeElement!==scrub)scrub.value=t;const label=$('previewTime');if(label)label.textContent=v8Fmt(t)+' / '+v8Fmt(tl.total);}
 const ids=tl.moving(t),key=ids.join();if(key!==movingKey){movingKey=key;const active=new Set(ids);$('detailContent').querySelectorAll('.pitch-large [data-actor^=p]').forEach(g=>g.classList.toggle('is-moving',active.has(g.dataset.actor)));}
 const state=tl.playing?'run':tl.finished?'done':'pause';if(state!==tl.lastState||force===true){tl.lastState=state;const play=$('previewPlay');if(play){play.textContent=state==='run'?'Ⅱ Pause':state==='done'?'↻ Nochmal':'▶ Weiter';play.setAttribute('aria-pressed',String(state==='run'));}$('detailDialog').classList.toggle('scene-playing',state==='run');}
 if(tl.playing)detailFrame=requestAnimationFrame(playerFrame);}
function playerKick(){if(!detailFrame)detailFrame=requestAnimationFrame(playerFrame);}
function stepwiseFallback(){const b=$('previewPlay');if(!b)return;const n=stepsFor(exercise(detailId)).length;b.onclick=()=>{if(detailPlaying){stopPreview();return;}if(v8Ok()&&!detailTL){renderDetail();if(detailTL){clearTimeout(detailTL.autoplay);detailTL.seek(0);detailTL.play(1);playerKick();return;}}detailPlaying=true;detailStep=0;updateStep();b.textContent='Ⅱ Pause';b.setAttribute('aria-pressed','true');detailLoop=setInterval(()=>{if(detailStep>=n-1){stopPreview();return;}detailStep++;updateStep();},3200);};}
const v8Detail=renderDetail;
renderDetail=function(){playerStop();detailShownStep=-1;v8Detail();const e=exercise(detailId),n=stepsFor(e).length,scene=$('detailContent').querySelector('.pitch-large'),box=$('detailContent').querySelector('.preview-controls');
 if(!scene||!box||!v8Ok()){stepwiseFallback();return;}
 const tl=SceneMotion.compile(scene,n,{camera:true});if(!tl){const note=box.querySelector('span');if(note)note.textContent='Eigene Übung · Text beachten';stepwiseFallback();return;}
 detailTL=tl;let rate=1;
 box.classList.add('player-controls');box.innerHTML=`<button id="previewPlay" aria-pressed="false">▶ Abspielen</button><span class="rate-group" role="group" aria-label="Tempo">${[[.5,'½×'],[1,'1×'],[2,'2×']].map(([v,t])=>`<button type="button" data-rate="${v}" aria-pressed="${v===1}" aria-label="Tempo ${t}">${t}</button>`).join('')}</span><input id="previewScrub" type="range" min="0" max="${tl.total}" value="0" step="10" aria-label="Zeitleiste der Übung"><span id="previewTime" class="preview-time">0:00 / ${v8Fmt(tl.total)}</span>`;
 const dis=$('detailContent').querySelector('.sketch-disclaimer');if(dis)dis.textContent=`Schematischer Durchgang in etwa ${v8Fmt(tl.total)} Min: Tempo grob wie im Training, keine maßstabsgetreuen Positionen oder exakten Laufwege. Die echte Übung läuft ${e.minutes} Min mit Wiederholungen. Bei Torwartübungen keine Fang- oder Falltechnik-Demonstration.`;
 $('previewPlay').onclick=()=>{if(tl.playing){tl.pause();}else{if(tl.finished)tl.seek(0);tl.play(rate);}playerKick();playerFrame(true);};
 box.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{rate=Number(b.dataset.rate);tl.rate(rate);box.querySelectorAll('[data-rate]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 $('previewScrub').oninput=ev=>{tl.pause();tl.seek(Number(ev.target.value));detailShownStep=-1;playerKick();playerFrame(true);};
 document.querySelectorAll('[data-preview-step]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.previewStep);tl.seek(tl.stepStart(i));detailShownStep=-1;tl.play(rate);playerKick();playerFrame(true);});
 playerFrame(true);
 tl.autoplay=setTimeout(()=>{if(detailTL===tl&&$('detailDialog').open&&tl.time<50&&v8Ok()){tl.play(rate);playerKick();}},760);};
$('detailDialog').addEventListener('close',()=>{playerStop();cardPump();});
// ---- Shared element: the card scene grows into the detail scene.
let lastCard=null;
$('cards').addEventListener('click',ev=>{const c=ev.target.closest('.dynamic-card'),s=c?.querySelector('.pitch-scene');lastCard=s?{id:c.dataset.drag,rect:s.getBoundingClientRect()}:null;},true);
const v8Open=openDetail;
openDetail=function(id){const src=lastCard&&lastCard.id===id?lastCard.rect:null;lastCard=null;const was=$('detailDialog').open;v8Open(id);cardPump();if(!src||was||!v8Ok())return;const dlg=$('detailDialog');dlg.getAnimations().forEach(a=>a.finish());const scene=dlg.querySelector('.pitch-large');if(!scene)return;const r=scene.getBoundingClientRect();if(!r.width)return;scene.style.transformOrigin='0 0';scene.style.position='relative';scene.style.zIndex='3';const a=scene.animate([{transform:`translate(${src.left-r.left}px,${src.top-r.top}px) scale(${src.width/r.width},${src.height/r.height})`,borderRadius:'12px'},{transform:'none',borderRadius:'18px'}],{duration:640,easing:'cubic-bezier(.2,.9,.2,1)'});a.finished.catch(()=>{}).finally(()=>{scene.style.zIndex='';});};
// ---- Kinetic type: words rise out of a mask in sequence.
function kinetic(el,delay=0){if(!el||!v8Ok()||el.dataset.kineticText===el.textContent&&el.querySelector('.kw'))return;const text=el.textContent;el.dataset.kineticText=text;const nodes=[];[...el.childNodes].forEach(n=>nodes.push(n));el.textContent='';let i=0;
 const walk=(node,parent)=>{if(node.nodeType===3){node.nodeValue.split(/(\s+)/).forEach(tok=>{if(!tok)return;if(/^\s+$/.test(tok)){parent.append(tok);return;}const w=document.createElement('span');w.className='kw';const inner=document.createElement('span');inner.textContent=tok;inner.style.setProperty('--kw',i++);w.append(inner);parent.append(w);});}else if(node.nodeType===1){const c=node.cloneNode(false);parent.append(c);node.childNodes.forEach(n=>walk(n,c));}};
 nodes.forEach(n=>walk(n,el));el.querySelectorAll('.kw>span').forEach((s,k)=>s.animate([{transform:'translateY(108%) rotate(5deg)',opacity:0,filter:'blur(4px)'},{transform:'translateY(0) rotate(0)',opacity:1,filter:'blur(0)'}],{duration:760,delay:delay+k*85,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));}
function kineticView(name){const id={home:'homeView',library:'library',planner:'planner',live:'liveView',info:'info'}[name];const root=id&&$(id);if(!root)return;root.querySelectorAll('h1,.library-intro h2,.section-heading h2').forEach((h,i)=>kinetic(h,80+i*120));}
// ---- Numbers count up when they appear.
const countSeen=new WeakMap();
function countUp(el){if(!el||!v8Ok())return;const nodes=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);while(walker.nextNode())if(/\d/.test(walker.currentNode.nodeValue))nodes.push(walker.currentNode);if(!nodes.length)return;const key=nodes.map(n=>n.nodeValue).join('|');if(countSeen.get(el)===key)return;countSeen.set(el,key);const finals=nodes.map(n=>n.nodeValue);const t0=performance.now(),dur=760;
 const tick=now=>{const p=Math.min(1,(now-t0)/dur),k=1-Math.pow(1-p,3);nodes.forEach((n,i)=>{if(!n.isConnected)return;n.nodeValue=p>=1?finals[i]:finals[i].replace(/\d+/g,m=>Math.round(Number(m)*k));});if(p<1&&v8Ok())requestAnimationFrame(tick);else nodes.forEach((n,i)=>{if(n.isConnected)n.nodeValue=finals[i];});};requestAnimationFrame(tick);}
const countTargets='#homeStats,.ticket-stats,#drillCount,#homeCount,#total,.detail-facts';
function countScan(){document.querySelectorAll(countTargets).forEach(el=>{if(el.getClientRects().length)countUp(el);});}
// ---- Camera-like view change: the new view opens as an iris from the tapped control and pushes in from the side.
const VT_ORDER=['home','library','planner','live','info'];let tapPoint=null;
document.addEventListener('click',ev=>{if(ev.target.closest('#mainNav button,#homeStart,#homeExplore,#homePlan,#profileButton')&&ev.clientX){tapPoint={x:ev.clientX,y:ev.clientY};setTimeout(()=>{tapPoint=null;},0);}},true);
const v8View=view;
view=function(name,opts){const from=currentView,point=tapPoint;tapPoint=null;v8View(name,opts);kineticView(name);requestAnimationFrame(countScan);
 if(!v8Ok()||!state.profile||name===from||opts?.scroll===false)return;const id={home:'homeView',library:'library',planner:'planner',live:'liveView',info:'info'}[name],root=id&&$(id);if(!root||!root.animate)return;
 const dir=VT_ORDER.indexOf(name)>=VT_ORDER.indexOf(from)?1:-1,r=root.getBoundingClientRect(),x=point?point.x-r.left:r.width/2,y=point?Math.max(0,point.y-r.top):80,big=Math.max(innerWidth,innerHeight)*2.4;
 root.getAnimations().filter(a=>a.id==='v8-view').forEach(a=>a.cancel());
 const a=root.animate([{clipPath:`circle(0px at ${x}px ${y}px)`,transform:`translateX(${dir*5}%) scale(1.04)`,opacity:.4},{clipPath:`circle(${big}px at ${x}px ${y}px)`,transform:'none',opacity:1}],{duration:760,easing:'cubic-bezier(.16,1,.3,1)'});a.id='v8-view';a.finished.catch(()=>{}).finally(()=>{root.style.clipPath='';});};
// ---- Detail entrance: title, facts, steps and material arrive in sequence.
const v8DetailBase=renderDetail;
renderDetail=function(){v8DetailBase();if(!v8Ok())return;kinetic($('detailTitle'),120);countUp($('detailContent').querySelector('.detail-facts'));
 $('detailContent').querySelectorAll('.coaching-steps li').forEach((li,i)=>li.animate([{opacity:0,transform:'translateX(-18px)'},{opacity:1,transform:'translateX(0)'}],{duration:520,delay:420+i*110,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
 $('detailContent').querySelectorAll('.equipment-pills>span').forEach((s,i)=>s.animate([{opacity:0,transform:'scale(.7) translateY(8px)'},{opacity:1,transform:'scale(1) translateY(0)'}],{duration:480,delay:520+i*70,easing:'cubic-bezier(.2,1.4,.4,1)',fill:'backwards'}));};
new MutationObserver(()=>{if(v8Ok()){const t=$('stepTitle');if(t&&t.getClientRects().length)kinetic(t);}}).observe($('stepTitle'),{childList:true,characterData:true});
new MutationObserver(()=>requestAnimationFrame(countScan)).observe(document.querySelector('main'),{childList:true,subtree:true});
function v8Sync(){if(!v8Ok()){cardsOff();if(detailTL){detailTL.pause();}}else cardPump();}
$('motionSetting').addEventListener('change',v8Sync);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',v8Sync);document.addEventListener('visibilitychange',v8Sync);
document.addEventListener('dragstart',cardsOff,true);document.addEventListener('dragend',()=>cardPump(),true);
if(typeof state!=='undefined'&&state.profile)kineticView(currentView||'home');
