'use strict';
// The current block's existing schematic runs beside the clock. No external video.
const liveDemo=document.createElement('section');
liveDemo.id='liveDemo';liveDemo.className='live-demo';liveDemo.setAttribute('aria-labelledby','liveDemoTitle');
liveDemo.innerHTML='<div class="live-demo-heading"><h2 id="liveDemoTitle">Übung im Blick</h2><span id="liveDemoStatus"></span></div><div id="liveDemoPitch"></div><p id="liveDemoCaption"></p><div class="live-demo-controls"><button id="liveDemoToggle" type="button" aria-pressed="false">Animation pausieren</button><button id="liveDemoPrev" type="button" aria-label="Vorheriger Ablaufschritt">← Schritt</button><button id="liveDemoNext" type="button" aria-label="Nächster Ablaufschritt">Schritt →</button></div><p class="live-demo-note">Schematischer Ablauf, kein echtes Video. Keine maßstabsgetreuen Laufwege oder Fang-/Falltechnik-Demo.</p>';
const liveWorkspace=document.createElement('div');liveWorkspace.className='live-workspace';
const timerBox=$('liveView').querySelector('.timer');timerBox.before(liveWorkspace);liveWorkspace.append(timerBox,liveDemo);
let liveDemoTL=null,liveDemoKey='',liveDemoStep=-1,liveDemoManualPause=false,liveDemoFrame=0;
function liveDemoAllowed(){return !!deadline&&currentView==='live'&&!document.hidden&&!reduced()&&!liveDemoManualPause&&!document.querySelector('dialog[open]');}
function liveDemoDispose(){cancelAnimationFrame(liveDemoFrame);liveDemoFrame=0;if(liveDemoTL){liveDemoTL.destroy();liveDemoTL=null;}}
function liveDemoPaint(i){const b=plan().blocks[timerIndex];if(!b)return;const e=exercise(b.exerciseId),steps=stepsFor(e);i=Math.max(0,Math.min(steps.length-1,i));if(liveDemoStep!==i){liveDemoStep=i;$('liveDemoCaption').textContent=`${i+1}. ${steps[i]||e.description}`;const scene=$('liveDemoPitch').querySelector('.pitch-scene');if(scene)scene.dataset.sceneStep=String(i);const label=scene?.querySelector('.scene-step-label');if(label)label.textContent='SCHRITT '+(i+1);}
 $('liveDemoPrev').disabled=i<=0;$('liveDemoNext').disabled=i>=steps.length-1;
}
function liveDemoAnimate(){liveDemoFrame=0;if(!liveDemoTL)return;liveDemoPaint(liveDemoTL.stepAt(liveDemoTL.time));if(liveDemoTL.playing&&liveDemoAllowed())liveDemoFrame=requestAnimationFrame(liveDemoAnimate);}
function liveDemoSync(){const b=plan().blocks[timerIndex],e=b?exercise(b.exerciseId):null;liveDemo.hidden=!e;
 if(!e){liveDemoDispose();liveDemoKey='';return;}
 const key=plan().id+'|'+b.id+'|'+e.id+'|'+JSON.stringify(e.animation||null);
 if(key!==liveDemoKey){liveDemoDispose();liveDemoKey=key;liveDemoStep=-1;liveDemoManualPause=false;$('liveDemoPitch').innerHTML=drillPitch(e,true);liveDemoPaint(0);}
 const quiet=reduced(),scene=$('liveDemoPitch').querySelector('.pitch-scene');
 if(quiet&&liveDemoTL){const i=liveDemoTL.stepAt(liveDemoTL.time);liveDemoDispose();$('liveDemoPitch').innerHTML=drillPitch(e,true,i);liveDemoStep=-1;liveDemoPaint(i);}
 if(!quiet&&!liveDemoTL&&currentView==='live'&&!document.hidden){liveDemoTL=SceneMotion.compile(scene,stepsFor(e).length,{camera:false});if(liveDemoTL){liveDemoTL.seek(liveDemoTL.stepStart(liveDemoStep));liveDemoTL.anims[0].onfinish=()=>{if(liveDemoTL&&liveDemoAllowed()){liveDemoTL.seek(0);liveDemoTL.play(1);liveDemoAnimate();}else liveDemoSync();};}}
 const active=!!liveDemoTL&&liveDemoAllowed();
 if(liveDemoTL){if(active&&!liveDemoTL.playing){if(liveDemoTL.finished)liveDemoTL.seek(0);liveDemoTL.play(1);}else if(!active)liveDemoTL.pause();}
 if(active&&!liveDemoFrame)liveDemoFrame=requestAnimationFrame(liveDemoAnimate);
 if(!active){cancelAnimationFrame(liveDemoFrame);liveDemoFrame=0;}
 $('liveDemoToggle').hidden=quiet||!liveDemoTL;$('liveDemoToggle').textContent=liveDemoManualPause?'Animation fortsetzen':'Animation pausieren';$('liveDemoToggle').setAttribute('aria-pressed',String(liveDemoManualPause));
 $('liveDemoStatus').textContent=quiet?'Weniger Bewegung':!liveDemoTL?'Aufbau & Schritte':active?'Läuft mit dem Timer':!deadline?'Timer pausiert':liveDemoManualPause?'Animation pausiert':'Animation wartet';
}
$('liveDemoToggle').onclick=()=>{liveDemoManualPause=!liveDemoManualPause;liveDemoSync();};
function liveDemoJump(delta){const b=plan().blocks[timerIndex];if(!b)return;const e=exercise(b.exerciseId),i=Math.max(0,Math.min(stepsFor(e).length-1,liveDemoStep+delta));liveDemoManualPause=true;if(liveDemoTL){liveDemoTL.pause();liveDemoTL.seek(liveDemoTL.stepStart(i));}else $('liveDemoPitch').innerHTML=drillPitch(e,true,i);liveDemoStep=-1;liveDemoPaint(i);liveDemoSync();}
$('liveDemoPrev').onclick=()=>liveDemoJump(-1);$('liveDemoNext').onclick=()=>liveDemoJump(1);
const v19Timer=renderTimer;renderTimer=function(){v19Timer();liveDemoSync();};
const v19Live=renderLive;renderLive=function(){v19Live();liveDemoSync();};
const v19View=view;view=function(name,opts){v19View(name,opts);liveDemoSync();};
const v19Stop=stopTimer;stopTimer=function(){v19Stop();liveDemoSync();};
const v19Reset=resetTimer;resetTimer=function(){v19Reset();if(liveDemoTL)liveDemoTL.seek(0);liveDemoManualPause=false;liveDemoStep=-1;liveDemoPaint(0);liveDemoSync();};
$('motionSetting').addEventListener('change',liveDemoSync);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',liveDemoSync);document.addEventListener('visibilitychange',liveDemoSync);
// Opening details pauses only the schematic, never the actual training clock.
new MutationObserver(liveDemoSync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
liveDemoSync();
