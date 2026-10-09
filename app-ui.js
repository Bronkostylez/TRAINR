'use strict';
let currentView='home';
const viewNames={home:'Heute',library:'Übungen',planner:'Plan',live:'Training',info:'Profil'};
function view(name,{scroll=true}={}){
 currentView=name;document.body.dataset.screen=name;
 const views={home:'homeView',library:'library',planner:'planner',live:'liveView',info:'info'};
 for(const [key,id] of Object.entries(views))$(id).classList.toggle('hidden',key!==name && !(name==='library'&&key==='planner'&&innerWidth>=1000));
 $('board').classList.toggle('hidden',!['library','planner'].includes(name));
 document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===name;b.classList.toggle('active',selected);selected?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');});
 if(name==='home')renderHome();if(name==='live')renderLive();
 if(scroll)window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 document.title=`TRAINR · ${viewNames[name]}`;
}
function renderHome(){
 const p=plan(),s=slot(),total=p.blocks.reduce((n,b)=>n+b.minutes,0);
 $('homeContext').textContent=state.profile?`${p.age||state.profile.age} · ${LABELS[state.profile.type]}`:'DEIN TRAINING';
 $('homeDay').textContent=s?DAYS[s.day]+' · '+s.start:'';$('homeName').textContent=p.name;
 $('homeStats').innerHTML=`<div><strong>${total}</strong><small>Minuten</small></div><div><strong>${p.blocks.length}</strong><small>Übungen</small></div><div><strong>${p.people}</strong><small>Spieler</small></div>`;
 $('homeCount').textContent=p.blocks.length?`${p.blocks.length} Blöcke`:'Noch offen';
 $('homeTimeline').innerHTML=p.blocks.length?p.blocks.map((b,i)=>`<button class="timeline-row" data-home-block="${i}"><span class="num">${i+1}</span><span class="timeline-title"><strong>${esc(exercise(b.exerciseId).name)}</strong><small>${esc(exercise(b.exerciseId).tag)}</small></span><span class="timeline-time">${b.minutes} Min ↗</span></button>`).join(''):'<button class="empty" id="firstDrill">＋ Die erste Übung aussuchen<br><small>Deine Einheit wächst mit jedem Block.</small></button>';
 if($('firstDrill'))$('firstDrill').onclick=()=>view('library');
 $('homeStart').disabled=!p.blocks.length;
 $('infoProfile').textContent=state.profile?`${LABELS[state.profile.type]} · ${state.profile.age} · ${state.profile.slots.map(x=>DAYS[x.day]+' '+x.start+'-'+x.end).join(' / ')}`:'';
}
function renderLive(){
 const b=plan().blocks[timerIndex],e=b?exercise(b.exerciseId):null;
 $('liveCoaching').innerHTML=e?`<span class="tag">BLOCK ${timerIndex+1} / ${plan().blocks.length}</span><h3>So läuft's</h3><p>${esc(e.description)}</p><h3>Darauf achten</h3><p>${esc(e.coaching)}</p><h3>Vorbereiten</h3><p>${e.equipment.map(a=>a[1]+' '+esc(a[0])).join(' · ')} je Gruppe</p><p>${fit(e)?fit(e)+' parallele Gruppe(n) für '+plan().people+' Spieler':'⚠ Gruppengröße im Plan anpassen'}${state.profile&&!e.ages.includes(plan().age||state.profile.age)?' · ⚠ Altersklasse prüfen':''}</p><button id="liveSource">Coaching & Quelle öffnen</button>`:'<div class="empty">Dein Plan ist noch leer.</div><button id="liveBuild" class="primary">Übungen aussuchen</button>';
 if($('liveSource'))$('liveSource').onclick=()=>showLiveDetail(e);
 if($('liveBuild'))$('liveBuild').onclick=()=>view('library');
 updateProgress();
}
function showLiveDetail(e){$('detailContent').innerHTML=`<h2>${esc(e.name)}</h2><p>${esc(e.description)}</p><h3>Coaching</h3><p>${esc(e.coaching)}</p><p>${e.equipment.map(a=>a[1]+' '+esc(a[0])).join(', ')} je Gruppe</p>${e.url?`<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Quelle öffnen ↗</a>`:'<p>Eigene Übung ohne Quelle.</p>'}<p class="subtle">Eigene Kurzfassung / Variante. Altersklasse, Aufbau und Belastung selbst prüfen.</p>`;$('detailDialog').showModal();}
const progress=document.createElement('div');progress.className='timer-progress';progress.setAttribute('aria-hidden','true');progress.innerHTML='<div id="timerProgress"></div>';$('clock').after(progress);
function updateProgress(){const duration=plan().blocks[timerIndex]?.minutes*60||1;$('timerProgress').style.width=Math.max(0,Math.min(100,100-remaining/duration*100))+'%';}
const originalRender=render;render=function(){originalRender();renderHome();if(currentView==='live')renderLive();};
const originalCards=renderCards;renderCards=function(){originalCards();document.querySelectorAll('.card').forEach((card,i)=>{const sketch=document.createElement('div');sketch.className='drill-sketch';sketch.setAttribute('aria-hidden','true');const a=30+(i%4)*12;sketch.innerHTML=`<svg viewBox="0 0 300 88"><path class="route" d="M ${a} 28 Q 140 5 240 56 M 240 56 Q 190 82 88 57"/><circle class="player" cx="${a}" cy="28" r="5"/><circle class="player" cx="240" cy="56" r="5"/><circle class="player" cx="88" cy="57" r="5"/><circle class="ball" cx="165" cy="37" r="4"/></svg>`;card.querySelector('h3').after(sketch);});};
const originalStep=showStep;showStep=function(){originalStep();document.body.classList.add('setting-up');for(const id of ['homeView','liveView'])$(id).classList.add('hidden');};
const originalSubmit=$('setupForm').onsubmit;$('setupForm').onsubmit=ev=>{originalSubmit(ev);if($('onboarding').classList.contains('hidden')){document.body.classList.remove('setting-up');view('home');}};
const originalTimerRender=renderTimer;renderTimer=function(){originalTimerRender();updateProgress();};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);
$('profileButton').onclick=()=>view('info');$('homePlan').onclick=()=>view('planner');$('homeExplore').onclick=()=>view('library');$('homeStart').onclick=()=>view('live');$('planAdd').onclick=()=>view('library');$('planPlay').onclick=()=>view('live');
$('homeTimeline').onclick=ev=>{const b=ev.target.closest('[data-home-block]');if(!b)return;timerIndex=Number(b.dataset.homeBlock);resetTimer();render();view('live');};
$('jumpPlan').onclick=()=>view('planner');
document.querySelector('[data-tab=board]').onclick=()=>view('library');document.querySelector('[data-tab=info]').onclick=()=>view('info');
const originalAdd=add;add=function(id){originalAdd(id);const b=document.querySelector('[data-view=planner]');if(typeof reduced!=='function'||!reduced())b.animate?.([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:250});};
// A view switch never resets a running timer or changes stored plans.
render();if(!state.profile){document.body.classList.add('setting-up');$('homeView').classList.add('hidden');$('liveView').classList.add('hidden');}else view('home',{scroll:false});

let previousWide=innerWidth>=1000;window.addEventListener('resize',()=>{const wide=innerWidth>=1000;if(wide!==previousWide){previousWide=wide;if(state.profile)view(currentView,{scroll:false});}});
