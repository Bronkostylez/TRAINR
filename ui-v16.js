'use strict';
// V16: native app shell - tab bar with sliding indicator, compact bar title,
// bottom sheets with drag-to-dismiss, swipe tab navigation, hash history.
// Presentation and navigation only: no plan, storage or training logic changes.
// reduced() (animation switch + system reduced motion) gates every motion here.
const V16_TABS=['home','library','planner','live'];
const V16_HASH={home:'heute',library:'uebungen',planner:'plan',live:'training',info:'profil'};
const v16Shell=()=>matchMedia('(max-width: 899px)').matches;
const v16Move=()=>v16Shell()&&!reduced()&&!!state.profile&&!document.body.classList.contains('setting-up');
const v16Buzz=ms=>{try{if(uiPrefs.haptics&&navigator.vibrate)navigator.vibrate(ms);}catch{}};
const v16Root=name=>$((name==='library'||name==='planner')?'board':{home:'homeView',live:'liveView',info:'info'}[name]||'homeView');

// ---- Tab bar: real icons and a sliding selection pill.
const V16_ICONS={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M10.5 20v-5h3v5"/></svg>',
 library:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
 planner:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/><path d="M8.5 3v4M15.5 3v4"/><path d="M8 14.5h4M8 17h6.5"/></svg>',
 live:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none"/></svg>'};
const navButtons=[...document.querySelectorAll('#mainNav [data-view]')];
for(const b of navButtons){const icon=b.querySelector('.nav-icon');if(icon&&V16_ICONS[b.dataset.view])icon.innerHTML=V16_ICONS[b.dataset.view];}
const glider=document.createElement('div');glider.className='tab-glider';glider.setAttribute('aria-hidden','true');$('mainNav').prepend(glider);
let v16Tab=0;function v16SyncTabs(){const i=V16_TABS.indexOf(currentView);if(i>=0)v16Tab=i;glider.style.setProperty('--tab',v16Tab);}

// ---- Compact bar title fades in when the view heading scrolls away.
const barTitle=document.createElement('span');barTitle.className='bar-title';barTitle.setAttribute('aria-hidden','true');document.querySelector('header').append(barTitle);
function v16SyncTitle(){barTitle.textContent=viewNames[currentView]||'TRAINR';}
let v16ScrollFrame=0;
window.addEventListener('scroll',()=>{if(v16ScrollFrame)return;v16ScrollFrame=requestAnimationFrame(()=>{v16ScrollFrame=0;document.body.classList.toggle('scrolled',scrollY>26);});},{passive:true});

// ---- View changes: directional slide on phones, tab pill sync, hash history.
const v16View=view;
view=function(name,opts){const from=currentView;v16View(name,opts);v16SyncTabs();v16SyncTitle();
 if(state.profile){const want='#'+V16_HASH[name];if(location.hash!==want){try{history.pushState({view:name},'',want);}catch{}}}
 if(!v16Move()||name===from||opts?.scroll===false)return;
 const root=v16Root(name);if(!root||!root.animate)return;
 root.getAnimations().filter(a=>a.id==='v8-view').forEach(a=>a.cancel());
 const dir=V16_TABS.indexOf(name)>=V16_TABS.indexOf(from)?1:-1;
 root.animate([{transform:`translateX(${dir*26}px)`,opacity:.5},{transform:'translateX(0)',opacity:1}],{duration:300,easing:'cubic-bezier(.25,.9,.25,1)'});};

// ---- Hash + back button: sheets close first, then tabs follow the hash.
window.addEventListener('popstate',()=>{const open=document.querySelector('dialog[open]');if(open){open.close();return;}
 if(!state.profile)return;const hit=Object.entries(V16_HASH).find(([,h])=>'#'+h===location.hash);if(hit&&hit[0]!==currentView)view(hit[0]);});
if(state.profile&&location.hash){const hit=Object.entries(V16_HASH).find(([,h])=>'#'+h===location.hash);if(hit&&hit[0]!=='home')view(hit[0],{scroll:false});}

// ---- Bottom sheets: grab handle, drag-to-dismiss, closing animation.
function v16Sheetify(dlg){if(!dlg||dlg.dataset.sheetReady)return;dlg.dataset.sheetReady='1';
 const grab=document.createElement('div');grab.className='sheet-grab';grab.setAttribute('aria-hidden','true');
 new MutationObserver(()=>{if(!dlg.open)return;if(!grab.isConnected)dlg.prepend(grab);if(state.profile){try{history.pushState({sheet:dlg.id},'',location.href);}catch{}}}).observe(dlg,{attributes:true,attributeFilter:['open']});
 let drag=null;
 dlg.addEventListener('touchstart',ev=>{if(!v16Shell()||!dlg.open)return;if(ev.target.closest('input,textarea,select,[contenteditable]'))return;
  drag={y:ev.touches[0].clientY,dy:0,grab:!!ev.target.closest('.sheet-grab'),scroll:dlg.scrollTop,t:ev.timeStamp,vy:0,last:ev.touches[0].clientY,lt:ev.timeStamp,on:false};},{passive:true});
 dlg.addEventListener('touchmove',ev=>{if(!drag)return;const y=ev.touches[0].clientY,dy=y-drag.y;
  const eligible=(drag.grab||drag.scroll<=0)&&dy>0;
  if(!drag.on){if(!eligible)return;drag.on=true;dlg.classList.add('sheet-drag');}
  ev.preventDefault();drag.dy=dy;
  drag.vy=(y-drag.last)/Math.max(1,ev.timeStamp-drag.lt);drag.last=y;drag.lt=ev.timeStamp;
  dlg.style.transform=`translateY(${Math.min(dy,460)}px)`;},{passive:false});
 const finish=()=>{if(!drag)return;const d=drag;drag=null;if(!d.on)return;
  dlg.classList.remove('sheet-drag');
  if(d.dy>120||d.vy>.55){v16Buzz(8);
   if(reduced()){dlg.style.transform='';dlg.close();return;}
   dlg.classList.add('sheet-closing');dlg.style.transform='';
   dlg.addEventListener('animationend',()=>{dlg.classList.remove('sheet-closing');if(dlg.open)dlg.close();},{once:true});return;}
  dlg.style.transition='transform .3s cubic-bezier(.2,.9,.3,1)';dlg.style.transform='';
  dlg.addEventListener('transitionend',()=>{dlg.style.transition='';},{once:true});};
 dlg.addEventListener('touchend',finish,{passive:true});dlg.addEventListener('touchcancel',finish,{passive:true});
 dlg.addEventListener('close',()=>{drag=null;dlg.classList.remove('sheet-drag','sheet-closing');dlg.style.transform='';dlg.style.transition='';});}
v16Sheetify($('detailDialog'));v16Sheetify($('exerciseDialog'));

// ---- Horizontal swipe between the four tabs.
let pan=null;
document.addEventListener('touchstart',ev=>{if(!v16Shell()||!state.profile||document.body.classList.contains('setting-up'))return;
 if(document.querySelector('dialog[open]'))return;if(!V16_TABS.includes(currentView))return;
 if(ev.touches.length!==1)return;
 const t=ev.target;if(!(t instanceof Element))return;
 if(t.closest('input,textarea,select,[draggable=true],.editor-pitch,dialog,.sheet-grab'))return;
 pan={x:ev.touches[0].clientX,y:ev.touches[0].clientY,dx:0,on:false,vx:0,last:ev.touches[0].clientX,lt:ev.timeStamp};},{passive:true});
document.addEventListener('touchmove',ev=>{if(!pan)return;const x=ev.touches[0].clientX,y=ev.touches[0].clientY,dx=x-pan.x,dy=y-pan.y;
 if(!pan.on){if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.5){const i=V16_TABS.indexOf(currentView);if((dx<0&&i>=V16_TABS.length-1)||(dx>0&&i<=0)){pan=null;return;}pan.on=true;const r=v16Root(currentView);r.classList.add('swipe-pan');}else if(Math.abs(dy)>12){pan=null;}return;}
 ev.preventDefault();pan.dx=dx;
 pan.vx=(x-pan.last)/Math.max(1,ev.timeStamp-pan.lt);pan.last=x;pan.lt=ev.timeStamp;
 v16Root(currentView).style.transform=`translateX(${Math.max(-160,Math.min(160,dx*.55))}px)`;},{passive:false});
document.addEventListener('touchend',ev=>{if(!pan)return;const p=pan;pan=null;const root=v16Root(currentView);root.classList.remove('swipe-pan');
 if(!p.on)return;const i=V16_TABS.indexOf(currentView);
 const go=p.dx<-70||p.vx<-.45?1:p.dx>70||p.vx>.45?-1:0;
 const next=V16_TABS[i+go];
 if(go&&next){v16Buzz(10);root.style.transform='';view(next);return;}
 if(reduced()){root.style.transform='';return;}
 root.style.transition='transform .3s cubic-bezier(.2,.9,.3,1)';root.style.transform='';
 root.addEventListener('transitionend',()=>{root.style.transition='';},{once:true});},{passive:true});
document.addEventListener('touchcancel',()=>{if(!pan)return;pan=null;const r=v16Root(currentView);r.classList.remove('swipe-pan');r.style.transform='';},{passive:true});

// ---- Native-feel taps: light haptic on tab and sheet actions.
$('mainNav').addEventListener('click',()=>v16Buzz(8));

v16SyncTabs();v16SyncTitle();
