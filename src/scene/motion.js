// Choreografie der schematischen Übungsdurchläufe (aus V20 übernommen, als Modul bereinigt).
// Geschwindigkeiten in Platzeinheiten pro Sekunde (≈10 Einheiten = 1 m). Wege sind NICHT maßstabsgetreu.
import { normAnimation } from '../core/schema.js';
import { SCRIPTS, scriptPlan } from './scripts.js';
let resolveExercise = () => null;
/** Muss einmal gesetzt werden, damit compile() Übungen über die ID findet. */
export function setResolver(fn) { resolveExercise = fn; }
const SP={walk:20,shuffle:26,jog:42,dribble:30,sprint:62,roll:80,toss:72,chip:95,pass:125,shot:175};
const ease={run:'cubic-bezier(.35,0,.35,1)',ball:'cubic-bezier(.15,.55,.35,1)',snap:'cubic-bezier(.4,0,.2,1)'};
const OFF=[11,3];
const D=(i,x,y,sp='dribble',b='b'+i)=>({a:'p'+i,x,y,sp,carry:b});
const R=(a,x,y,sp='jog')=>({a:typeof a==='number'?'p'+a:a,x,y,sp});
const P=(b,to,sp='pass')=>({a:b,to:'p'+to,sp});
const S=(b,x,y,sp='shot')=>({a:b,x,y,sp,abs:true});
const ev=(m,hold=.3)=>({m,hold});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function plan(kind,e,ps){
 if(!ps.length)return null;
 if(kind==='script')return SCRIPTS[e.id]?scriptPlan(SCRIPTS[e.id]):null;
 const A=ps.map((p,i)=>({i,x:p[0],y:p[1],l:p[2],op:!!p[3]})),mine=A.filter(p=>!p.op&&p.l!=='N'&&p.l!=='K'),opp=A.filter(p=>p.op&&p.l!=='K'),own=ps.map(p=>[p[0]+OFF[0],p[1]+OFF[1]]);
 const balls=[['b0',...own[0]]];let events=[];const ball1=()=>balls.push(['b1',...own[1]]);
 const pairSet=()=>{};
 switch(kind){
 case 'islands':if(e.id==='v5-islandpair'){events=[ev([D(0,108,55),R(1,160,70)],.4),ev([P('b0',1)],.4),ev([D(1,225,85,'dribble','b0'),R(0,200,125)],.5)];break;}ball1();events=[ev([D(0,108,55),D(1,226,85)],.7),ev([D(0,146,136),D(1,160,62)],.7),ev([D(0,224,84),D(1,105,52)],.6)];break;
 case 'signal':ball1();balls.push(['b2',...own[2]]);events=[ev([D(0,120,118),D(1,200,70),D(2,190,150)],.2),ev([D(0,150,100,'walk'),D(1,240,100,'walk'),D(2,150,140,'walk')],1),ev([D(0,92,62),D(1,170,122),D(2,252,112)],.5)];break;
 case 'transport':balls.push(['b1',...own[1]]);events=[ev([D(0,250,55),D(1,252,135)],.7),ev([R(0,150,48),R(1,150,148)],.3),ev([R(0,65,92),R(1,65,122)],.4)];break;
 case 'gates':ball1();events=[ev([D(0,62,60),D(1,215,130)],.3),ev([D(0,125,60),D(1,148,130)],.5),ev([D(0,150,131),D(1,225,62)],.3),ev([D(0,212,131),D(1,288,60)],.5)];break;
 case 'lanes':ball1();events=[ev([D(0,255,64),D(1,65,131)],.6),ev([D(0,160,64),D(1,160,131)],.4),ev([D(0,160,125),D(1,160,70)],.6)];break;
 case 'corners':ball1();events=[ev([D(0,55,44),D(1,265,146)],.6),ev([D(0,265,44),D(1,55,146)],.6),ev([D(0,55,146),D(1,265,44)],.6)];break;
 case 'pairdribble':if(e.id==='v5-shadow'){events=[ev([D(0,170,60),R(1,130,102)],.4),ev([D(0,245,95),R(1,205,90)],.6)];break;}if(e.id==='v5-partner'){ball1();events=[ev([P('b0',1),P('b1',0)],.6),ev([D(0,160,50,'dribble','b1'),D(1,230,140,'dribble','b0')],.8)];break;}if(e.id==='v5-shield'){events=[ev([D(0,170,55),R(1,158,70)],.5),ev([D(0,125,95),R(1,135,110)],.5)];break;}ball1();events=[ev([D(0,170,55),D(1,130,102)],.3),ev([D(0,250,100),D(1,205,82)],.6),ev([D(1,150,142),D(0,205,125)],.3),ev([D(1,70,125),D(0,125,138)],.5)];break;
 case 'choice':events=[ev([D(0,150,95)],.6),ev([D(0,235,55)],.2),ev([D(0,290,55)],.6),ev([D(0,150,95)],.2),ev([D(0,235,140)],.2),ev([D(0,290,140)],.5)];break;
 case 'pairgate':if(e.id==='v5-kdistance'){events=[ev([P('b0',1,'roll')],.6),ev([P('b0',0,'roll')],.6)];break;}events=[ev([P('b0',1)],.5),ev([P('b0',0),R(1,243,100,'walk')],.4),ev([D(0,70,50),R(1,250,50)],.3),ev([P('b0',1)],.5),ev([P('b0',0)],.5)];break;
 case 'pairgoal':events=[ev([P('b0',1)],.4),ev([P('b0',0)],.4),ev([P('b0',1)],.4),ev([D(1,252,95,'dribble','b0')],.25),ev([S('b0',293,95)],.8)];break;
 case 'receive':events=[ev([P('b0',1)],.4),ev([D(1,228,95,'dribble','b0')],.5),ev([D(1,226,50,'dribble','b0')],.2),ev([D(1,290,50,'dribble','b0')],.6)];break;
 case 'triangle':events=[ev([P('b0',1),R(0,80,128)],.3),ev([P('b0',2),R(1,148,60)],.3),ev([P('b0',0),R(2,240,150)],.3),ev([P('b0',1),R(0,70,140)],.3),ev([P('b0',2)],.5)];break;
 case 'square':if(e.id==='v5-pairswitch'){ball1();events=[ev([P('b0',1),P('b1',3)],.6),ev([R(0,255,45),R(1,255,145),R(2,65,145),R(3,65,45)],.7)];break;}events=[ev([P('b0',1),R(0,230,52)],.3),ev([P('b0',2),R(1,250,120)],.3),ev([P('b0',3),R(2,90,145)],.3),ev([P('b0',0),R(3,90,60)],.5)];break;
 case 'wall':events=[ev([P('b0',1)],.3),ev([R(0,130,100)],.2),ev([P('b0',0)],.2),ev([D(0,245,85,'dribble','b0')],.6)];break;
 case 'linepass':events=[ev([P('b0',1)],.3),ev([P('b0',2)],.3),ev([P('b0',1),R(0,70,95)],.3),ev([P('b0',0)],.5)];break;
 case 'rondo':{const ids=mine.map(p=>p.i);let at=0;events=[];for(let n=0;n<6;n++){const to=ids[(at+1+(n%2))%ids.length];const bx=ps[to][0],by=ps[to][1];events.push(ev([P('b0',to),...opp.map((o,k)=>R(o.i,clamp(o.x+(bx-o.x)*.55,45,285),clamp(o.y+(by-o.y)*.55,35,160),'jog'))],.35));at=ids.indexOf(to);}break;}
 case 'targets':events=[ev([P('b0',1)],.4),ev([R(1,265,62,'walk')],.1),ev([P('b0',0)],.4),ev([R(0,55,130,'walk'),P('b0',1)],.5)];break;
 case 'finish':{const two=ps.length&&(e.id==='finish'||e.id==='v5-choosefinish');events=[ev([D(0,140,112)],.2),ev([D(0,192,100)],.2),ev([S('b0',293,two?97:95)],.8),ev([R(0,280,98)],.2),ev([D(0,70,two?150:140,'dribble','b0')],.5)];balls[0]=['b0',...own[0]];break;}
 case 'passfinish':{if(e.id==='v5-returnfinish'){events=[ev([P('b0',1)],.3),ev([R(0,135,105)],.2),ev([P('b0',0)],.3),ev([D(0,205,95,'dribble','b0')],.2),ev([S('b0',293,95)],.8)];break;}balls[0]=['b0',ps[1][0]+OFF[0],ps[1][1]+OFF[1]];events=[ev([P('b0',0),R(0,110,125)],.2),ev([D(0,190,105,'dribble','b0')],.2),ev([S('b0',293,95)],.8)];break;}
 case 'duel':if(e.id==='v5-shield'){events=[ev([D(0,135,75),R(1,160,85)],.5),ev([D(0,150,120),R(1,170,110)],.5),ev([D(0,130,90),R(1,155,95)],.5)];break;}events=[ev([D(0,140,95),R(1,175,95)],.3),ev([D(0,175,55),R(1,195,70)],.2),ev([D(0,285,55),R(1,248,66)],.8)];break;
 case 'game':case 'zones':case 'lines':case 'neutral':case 'fullgame':{
   if(e.id==='deep'){events=[ev([P('b0',6)],.4),ev([R(1,230,65)],.3),ev([P('b0',1)],.4),ev([S('b0',293,55)],.8)];break;}const a=mine,o=opp,kA=A.find(p=>p.l==='K'&&!p.op),kB=A.find(p=>p.l==='K'&&p.op),N=A.find(p=>p.l==='N');
   const a0=a[0],a1=a[1]||a[0],o0=o[0],o1=o[1]||o[0];if(!a0)break;balls[0]=['b0',a0.x+OFF[0],a0.y+OFF[1]];
   const E=[];E.push(ev([D(a0.i,150,95,'dribble','b0'),...(o0?[R(o0.i,190,88)]:[])],.2));
   if(N&&kind==='neutral'){E.push(ev([P('b0',N.i),...(o0?[R(o0.i,205,100)]:[])],.3));E.push(ev([P('b0',a1.i),R(a1.i,210,76)],.3));}
   else E.push(ev([P('b0',a1.i),R(a1.i,210,76),...(o1?[R(o1.i,222,82)]:[])],.3));
   E.push(ev([D(a1.i,kind==='zones'?272:kind==='lines'?282:248,95,'dribble','b0'),R(a0.i,220,112)],kind==='zones'||kind==='lines'?.8:.25));
   if(kind==='zones'||kind==='lines'){events=E;break;}
   if(kB){E.push(ev([S('b0',kB.x-14,kB.y+5),R(kB.i,kB.x-4,kB.y+8,'sprint')],.7));E.push(ev([P('b0',o0?o0.i:kB.i)],.4));}
   else E.push(ev([S('b0',293,95)],.8));
   events=E;break;}
 case 'overload':{if(e.min===3){events=[ev([D(0,140,75,'dribble','b0'),R(1,160,135),R(2,180,90)],.3),ev([P('b0',1)],.3),ev([S('b0',293,138)],.8)];break;}balls[0]=['b0',...own[1]];events=[ev([D(1,140,95,'dribble','b0'),R(0,150,55),R(3,182,82),R(4,182,118)],.2),ev([P('b0',2),R(2,200,138)],.25),ev([R(0,215,52)],.1),ev([S('b0',293,138)],.8)];break;}
 case 'keeperball':events=[ev([D(0,125,95,'walk')],.5),ev([P('b0',1,'toss')],.5),ev([R(1,222,95,'walk'),P('b0',0)],.4),ev([P('b0',1)],.5)];break;
 case 'keepermove':if(e.id==='v5-kready'){events=[ev([R(1,225,95,'walk')],.6),ev([P('b0',1,'toss')],.9),ev([P('b0',0,'roll')],.6)];break;}balls[0]=['b0',...own[0]];events=[ev([R(1,250,70,'shuffle')],.3),ev([R(1,250,120,'shuffle')],.3),ev([R(1,250,95,'shuffle')],.6),ev([P('b0',1,'toss')],.9)];break;
 case 'keepercatch':{if(e.id==='v5-ksoft'){balls[0]=['b0',...own[1]];events=[ev([P('b0',0,'pass')],.7),ev([P('b0',1,'toss')],.9),ev([P('b0',0,'roll')],.5)];break;}const mode=['catch','v5-kroll'].includes(e.id)?'roll':'toss';events=[ev([R(1,246,84,'shuffle')],.3),ev([P('b0',1,mode),R(1,250,95,'shuffle')],.9),ev([P('b0',0,'roll')],.6)];break;}
 case 'keeperfloor':balls[0]=['b0',200,100];events=[ev([R(0,186,99,'walk')],.5),ev([R('b0',178,104,'walk')],.9)];break;
 case 'keeperroll':balls[0]=['b0',108,97];events=[ev([R(0,98,96,'walk')],.4),ev([R('b0',78,99,'walk')],.8),ev([S('b0',255,55,'roll')],.6),ev([R(0,76,96,'walk')],.5)];break;
 case 'keeperangle':balls[0]=['b0',...own[1]];events=[ev([D(1,70,135,'walk','b0'),R(0,262,109,'shuffle')],.4),ev([D(1,70,55,'walk','b0'),R(0,262,81,'shuffle')],.4),ev([D(1,70,95,'walk','b0'),R(0,262,95,'shuffle')],.4),ev([P('b0',0,'toss')],.8)];break;
 case 'keeperpair':events=[ev([P('b0',1)],.5),ev([P('b0',0),R(1,243,99,'walk')],.4),ev([P('b0',1),R(0,72,92,'walk')],.5),ev([P('b0',0)],.5)];break;
 default:return null;}
 return events.length?{balls,extras:[],events}:null;
}
const NS='http://www.w3.org/2000/svg';
const LOFT=new Set(['toss','chip']);
const TRAIL_OP={pass:.95,dribble:.7,run:.42};
function compileSeed(scene,steps,{camera=false}={}){
 const kind=scene.dataset.setup,e=resolveExercise(scene.dataset.exercise);if(!e||kind==='custom')return null;
 const actors={};scene.querySelectorAll('[data-actor]').forEach(el=>{actors[el.dataset.actor]={el,x:+el.dataset.x,y:+el.dataset.y,k:[]};});
 const ps=[];for(let i=0;actors['p'+i];i++)ps.push([actors['p'+i].x,actors['p'+i].y,actors['p'+i].el.dataset.label,actors['p'+i].el.dataset.op==='1']);
 const pl=plan(kind,e,ps);if(!pl)return null;
 const marked=pl.events.some(x=>x.s!=null);
 const pos={};for(const id in actors)pos[id]=[actors[id].x,actors[id].y];
 const INTRO=marked?1.1:camera?.9:.45,OUTRO=camera?1.3:1;let t=INTRO;
 for(const id in actors)actors[id].k.push({t:0,x:pos[id][0],y:pos[id][1],e:'linear'},{t:INTRO,x:pos[id][0],y:pos[id][1],e:'linear'});
 const cam=[{t:0,x:160,y:95,s:1,e:ease.snap},{t:INTRO,x:160,y:95,s:1,e:ease.snap}];
 const blend=()=>{const b=pos.b0||[160,95];return[b[0]*.6+160*.4,b[1]*.6+95*.4];};
 const evs=[],trails=[];
 for(const event of pl.events){
  const moves=[];
  for(const m of event.m){if(m.to){const target=event.m.find(x=>x.a===m.to&&x.x!=null);const base=target?[target.x,target.y]:pos[m.to];moves.push({id:m.a,x:base[0]+OFF[0],y:base[1]+OFF[1],sp:m.sp,kind:'ball'});}
   else if(m.carry){moves.push({id:m.a,x:m.x,y:m.y,sp:m.sp,kind:'run',carry:true});moves.push({id:m.carry,x:m.x+OFF[0],y:m.y+OFF[1],sp:m.sp,kind:'run',follow:m.a});}
   else moves.push({id:m.a,x:m.x,y:m.y,sp:m.sp,kind:m.abs?'ball':(m.a[0]==='b'?'ball':'run')});}
  let dur=.35;for(const m of moves){const p=pos[m.id];if(!p)continue;m.d=Math.hypot(m.x-p[0],m.y-p[1])/SP[m.sp];dur=Math.max(dur,m.d);}
  const t0=t,t1=t+dur;
  for(const m of moves){const p=pos[m.id];if(!p)continue;const a=actors[m.id];const fl=m.follow?moves.find(x=>x.id===m.follow):null;const d=fl?fl.d:m.d;const end=t0+Math.max(.2,Math.min(dur,d));
   const len=Math.hypot(m.x-p[0],m.y-p[1]),loft=m.kind==='ball'&&LOFT.has(m.sp)&&len>20,lift=loft?Math.min(26,len*.18):0;
   if(loft){const mt=(t0+end)/2;a.k.push({t:t0,x:p[0],y:p[1],s:1,e:'cubic-bezier(.3,.6,.5,1)'},{t:mt,x:(p[0]+m.x)/2,y:(p[1]+m.y)/2-lift,s:1.5,e:'cubic-bezier(.5,0,.7,.4)'},{t:end,x:m.x,y:m.y,s:1,e:'linear'});}
   else a.k.push({t:t0,x:p[0],y:p[1],e:m.kind==='ball'?ease.ball:ease.run},{t:end,x:m.x,y:m.y,e:'linear'});
   // Spuren: Ballwege (Pass/Schuss), Dribbelwege und längere Laufwege
   const type=m.follow?null:m.kind==='ball'?'pass':m.carry?'dribble':len>24?'run':null;
   if(type&&len>8)trails.push({type,x1:p[0],y1:p[1],x2:m.x,y2:m.y,lift,t0,t1:end});
   pos[m.id]=[m.x,m.y];}
  evs.push({t0,t1,hold:event.hold,s:event.s,ids:moves.map(m=>m.id).filter(id=>id[0]==='p')});
  const b=blend();cam.push({t:t0+(t1-t0)*.15,x:b[0],y:b[1],s:1.17,e:ease.snap});
  t=t1+event.hold;for(const id in actors){const k=actors[id].k;const last=k[k.length-1];if(last.t<t)k.push({t,x:pos[id][0],y:pos[id][1],e:'linear'});}
  for(const tr of trails)if(tr.fade==null)tr.fade=t+.6;
  cam.push({t:t-.05,x:blend()[0],y:blend()[1],s:1.17,e:ease.snap});
 }
 const total=t+OUTRO;
 for(const id in actors){actors[id].k.push({t:total,x:pos[id][0],y:pos[id][1],e:'linear'});}
 cam.push({t:total,x:160,y:95,s:1,e:ease.snap});
 const anims=[];const mk=(el,list,fn)=>{const frames=[];let lastT=-1;for(const k of list){if(k.t<=lastT)k.t=lastT+.0001;lastT=k.t;frames.push({offset:Math.min(1,k.t/total),transform:fn(k),easing:k.e});}frames[frames.length-1].offset=1;frames[0].offset=0;const a=el.animate(frames,{duration:total*1000,fill:'both',easing:'linear'});a.pause();anims.push(a);};
 for(const id in actors){const a=actors[id],ball=id[0]==='b';mk(a.el,a.k.slice(),k=>`translate(${(k.x-a.x).toFixed(2)}px,${(k.y-a.y).toFixed(2)}px)${ball?` scale(${k.s||1})`:''}`);}
 // Spuren unter die Spieler legen; sie zeichnen sich mit Ball bzw. Läufer und verblassen nach der Phase.
 const host=scene.querySelector('.cam'),trailG=document.createElementNS(NS,'g');trailG.setAttribute('class','mv-trails');
 if(host)host.insertBefore(trailG,host.querySelector('[data-actor]'));
 const at=x=>clamp(x/total,0,1);
 for(const tr of trails){
  const path=document.createElementNS(NS,'path'),mx=(tr.x1+tr.x2)/2,my=(tr.y1+tr.y2)/2-tr.lift*2;
  path.setAttribute('d',tr.lift?`M${tr.x1} ${tr.y1}Q${mx.toFixed(1)} ${my.toFixed(1)} ${tr.x2} ${tr.y2}`:`M${tr.x1} ${tr.y1}L${tr.x2} ${tr.y2}`);
  path.setAttribute('class','mv-trail '+tr.type);trailG.appendChild(path);
  const op=TRAIL_OP[tr.type],draw=tr.type==='pass';
  if(draw){path.setAttribute('pathLength','1');path.style.strokeDasharray='1 1';}
  const fade=tr.fade??tr.t1+.6,o0=at(tr.t0),o1=Math.max(o0+.0005,at(tr.t1)),o2=Math.max(o1+.0005,at(fade)),o3=Math.min(1,Math.max(o2+.0005,at(fade+.5)));
  // Ballwege zeichnen sich mit dem Ball, Lauf- und Dribbelwege blenden während der Bewegung ein; danach verblassen beide.
  const fr=draw?[{offset:0,opacity:0,strokeDashoffset:1},{offset:o0,opacity:0,strokeDashoffset:1},{offset:Math.min(o1,o0+.0004),opacity:op,strokeDashoffset:1},{offset:o1,opacity:op,strokeDashoffset:0},{offset:o2,opacity:op,strokeDashoffset:0},{offset:o3,opacity:0,strokeDashoffset:0},{offset:1,opacity:0,strokeDashoffset:0}]
   :[{offset:0,opacity:0},{offset:o0,opacity:0},{offset:o1,opacity:op},{offset:o2,opacity:op},{offset:o3,opacity:0},{offset:1,opacity:0}];
  const an=path.animate(fr,{duration:total*1000,fill:'both',easing:'linear'});an.pause();anims.push(an);
 }
 const camEl=scene.querySelector('.cam');
 if(camera&&camEl){mk(camEl,cam,k=>{const s=k.s,cx=clamp(k.x,160/s,320-160/s),cy=clamp(k.y,95/s,190-95/s);return `translate(160px,95px) scale(${s}) translate(${-cx.toFixed(2)}px,${-cy.toFixed(2)}px)`;});}
 const n=Math.max(1,steps),body=total-INTRO-OUTRO;
 // Skripte markieren je Phase den passenden Ablaufschritt; sonst bekommt jeder Schritt einen gleich großen Anteil.
 const marks=marked?evs.map(x=>[x.t0,Math.min(n-1,x.s??0)]):null;
 const stepAt=ms=>{const s=ms/1000;if(marks){let cur=0;for(const [t0,i] of marks)if(s>=t0-.02)cur=i;return cur;}if(s<=INTRO)return 0;if(s>=total-OUTRO)return n-1;return Math.min(n-1,Math.floor((s-INTRO)/body*n));};
 const stepStart=i=>{if(marks){if(!i)return 0;const m=marks.find(([,k])=>k>=i);return Math.round((m?m[0]:total-OUTRO)*1000)+30;}return Math.round((INTRO+body*i/n)*1000+(i?30:0));};
 scene.classList.add('motion-on');
 const first=anims[0];
 return {total:Math.round(total*1000),anims,evs,stepAt,stepStart,intro:INTRO,
  get time(){return first.currentTime||0;},
  play(rate=1){anims.forEach(a=>{a.playbackRate=rate;a.play();});},
  pause(){anims.forEach(a=>a.pause());},
  seek(ms){anims.forEach(a=>{a.currentTime=Math.max(0,Math.min(this.total,ms));});},
  rate(r){anims.forEach(a=>{a.updatePlaybackRate(r);});},
  get playing(){return first.playState==='running';},
  get finished(){return (first.currentTime||0)>=this.total-1;},
  moving(ms){const s=ms/1000;return evs.find(x=>s>=x.t0&&s<=x.t1)?.ids||[];},
  destroy(){anims.forEach(a=>a.cancel());trailG.remove();scene.classList.remove('motion-on');}};
}
export function compile(scene, steps, opts = {}) {
  if (scene?.dataset.setup === 'customAnimation') return compileCustom(scene, opts);
  return compileSeed(scene, steps, opts);
}
/** Eigene Skizze (Editor) als Zeitleiste: gleiche Laufkurven, Spuren, Flugbälle und Kamera wie die eingebauten Übungen. */
function compileCustom(scene, opts = {}) {
  const e = opts.exercise || resolveExercise(scene.dataset.exercise), a = normAnimation(e?.animation);
  if (!a || a.frames.length < 2) return null; // Ein Schritt = stehende Skizze
  const f = a.frames, n = f.length, INTRO = .6, OUTRO = opts.camera ? 1.2 : .8, mode = a.camera || 'auto', useCam = !!opts.camera && mode !== 'off';
  const starts = []; let tt = INTRO; f.forEach(x => { starts.push(tt); tt += x.seconds; });
  const total = tt + OUTRO, STATIC = ['cone', 'mini', 'goal'], isStatic = i => STATIC.includes(a.items[i].k), isBall = i => a.items[i].k === 'ball';
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const trails = [], keys = {}, camKeys = [];
  const live = a.items.map((_, i) => i).filter(i => !isStatic(i));
  const actorEl = {}; scene.querySelectorAll('[data-actor]').forEach(g => { actorEl[+g.dataset.actor.slice(1)] = g; });
  for (const i of live) { const p = f[0].points[i]; keys[i] = [{ t: 0, x: p[0], y: p[1], e: 'linear' }, { t: INTRO, x: p[0], y: p[1], e: 'linear' }]; }
  camKeys.push({ t: 0, x: 160, y: 95, s: 1, e: ease.snap });
  if (useCam && mode === 'manual') { const c = f[0].cam || { x: 160, y: 95, s: 1 }; camKeys[0] = { t: 0, ...c, e: ease.snap }; camKeys.push({ t: INTRO, ...c, e: ease.snap }); }
  else camKeys.push({ t: INTRO, x: 160, y: 95, s: 1, e: ease.snap });
  for (let k = 0; k < n - 1; k++) {
    const seg = f[k].seconds, t0 = starts[k] + Math.min(.15, seg * .12), t1 = starts[k + 1] - Math.min(.12, seg * .1);
    const moved = live.filter(i => dist(f[k].points[i], f[k + 1].points[i]) > .5);
    const carrier = {};
    for (const b of moved.filter(isBall)) {
      const d = [f[k + 1].points[b][0] - f[k].points[b][0], f[k + 1].points[b][1] - f[k].points[b][1]];
      const c = moved.find(j => !isBall(j) && dist(f[k].points[j], f[k].points[b]) < 28 && Math.hypot(f[k + 1].points[j][0] - f[k].points[j][0] - d[0], f[k + 1].points[j][1] - f[k].points[j][1] - d[1]) < 7);
      if (c !== undefined) carrier[b] = c;
    }
    for (const i of live) {
      const p = f[k].points[i], q = f[k + 1].points[i], ks = keys[i], len = dist(p, q), ball = isBall(i);
      if (len <= .5) { ks.push({ t: starts[k + 1], x: q[0], y: q[1], e: 'linear' }); continue; }
      const loft = ball && carrier[i] === undefined && !!f[k + 1].loft && len > 20, lift = loft ? Math.min(26, len * .18) : 0;
      if (loft) { const mt = (t0 + t1) / 2; ks.push({ t: t0, x: p[0], y: p[1], s: 1, e: 'cubic-bezier(.3,.6,.5,1)' }, { t: mt, x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2 - lift, s: 1.5, e: 'cubic-bezier(.5,0,.7,.4)' }, { t: t1, x: q[0], y: q[1], s: 1, e: 'linear' }); }
      else ks.push({ t: t0, x: p[0], y: p[1], e: ball && carrier[i] === undefined ? ease.ball : ease.run }, { t: t1, x: q[0], y: q[1], e: 'linear' });
      const carries = Object.values(carrier).includes(i);
      const type = carrier[i] !== undefined ? null : ball ? 'pass' : carries ? 'dribble' : len > 24 ? 'run' : null;
      if (type && len > 8) trails.push({ type, x1: p[0], y1: p[1], x2: q[0], y2: q[1], lift, t0, t1 });
    }
    if (useCam && mode === 'auto' && moved.length) {
      const ball = live.find(isBall), ref = ball !== undefined && moved.includes(ball) ? f[k + 1].points[ball] : [moved.reduce((s2, i) => s2 + f[k + 1].points[i][0], 0) / moved.length, moved.reduce((s2, i) => s2 + f[k + 1].points[i][1], 0) / moved.length];
      const bx = ref[0] * .6 + 160 * .4, by = ref[1] * .6 + 95 * .4;
      camKeys.push({ t: t0 + (t1 - t0) * .15, x: bx, y: by, s: 1.3, e: ease.snap }, { t: starts[k + 1] - .05, x: bx, y: by, s: 1.3, e: ease.snap });
    } else if (useCam && mode === 'manual') {
      const c = f[k + 1].cam || { x: 160, y: 95, s: 1 };
      camKeys.push({ t: starts[k + 1], ...c, e: ease.snap });
    }
  }
  for (const i of live) { const q = f[n - 1].points[i]; keys[i].push({ t: total, x: q[0], y: q[1], e: 'linear' }); }
  camKeys.push({ t: total, x: 160, y: 95, s: 1, e: ease.snap });
  const anims = [];
  const mk = (el, list, fn) => {
    const frames = []; let last = -1;
    for (const k of list) { if (k.t <= last) k.t = last + .0001; last = k.t; frames.push({ offset: Math.min(1, k.t / total), transform: fn(k), easing: k.e }); }
    frames[frames.length - 1].offset = 1; frames[0].offset = 0;
    const an = el.animate(frames, { duration: total * 1000, fill: 'both', easing: 'linear' }); an.pause(); anims.push(an);
  };
  for (const i of live) { const g = actorEl[i]; if (!g) continue; const x0 = +g.dataset.x, y0 = +g.dataset.y, ball = isBall(i); mk(g, keys[i], k => `translate(${(k.x - x0).toFixed(2)}px,${(k.y - y0).toFixed(2)}px)${ball ? ` scale(${k.s || 1})` : ''}`); }
  // Spuren: Ballwege zeichnen sich mit dem Ball, Lauf- und Dribbelwege blenden ein und verblassen danach.
  const host = scene.querySelector('.cam'), trailG = document.createElementNS(NS, 'g'); trailG.setAttribute('class', 'mv-trails');
  if (host) host.insertBefore(trailG, host.querySelector('[data-actor]'));
  const at = x => clamp(x / total, 0, 1);
  for (const tr of trails) {
    const path = document.createElementNS(NS, 'path'), mx = (tr.x1 + tr.x2) / 2, my = (tr.y1 + tr.y2) / 2 - tr.lift * 2;
    path.setAttribute('d', tr.lift ? `M${tr.x1} ${tr.y1}Q${mx.toFixed(1)} ${my.toFixed(1)} ${tr.x2} ${tr.y2}` : `M${tr.x1} ${tr.y1}L${tr.x2} ${tr.y2}`);
    path.setAttribute('class', 'mv-trail ' + tr.type); trailG.appendChild(path);
    const op = TRAIL_OP[tr.type], draw = tr.type === 'pass', fade = tr.t1 + .6;
    if (draw) { path.setAttribute('pathLength', '1'); path.style.strokeDasharray = '1 1'; }
    const o0 = at(tr.t0), o1 = Math.max(o0 + .0005, at(tr.t1)), o2 = Math.max(o1 + .0005, at(fade)), o3 = Math.min(1, Math.max(o2 + .0005, at(fade + .5)));
    const fr = draw ? [{ offset: 0, opacity: 0, strokeDashoffset: 1 }, { offset: o0, opacity: 0, strokeDashoffset: 1 }, { offset: Math.min(o1, o0 + .0004), opacity: op, strokeDashoffset: 1 }, { offset: o1, opacity: op, strokeDashoffset: 0 }, { offset: o2, opacity: op, strokeDashoffset: 0 }, { offset: o3, opacity: 0, strokeDashoffset: 0 }, { offset: 1, opacity: 0, strokeDashoffset: 0 }]
      : [{ offset: 0, opacity: 0 }, { offset: o0, opacity: 0 }, { offset: o1, opacity: op }, { offset: o2, opacity: op }, { offset: o3, opacity: 0 }, { offset: 1, opacity: 0 }];
    const an = path.animate(fr, { duration: total * 1000, fill: 'both', easing: 'linear' }); an.pause(); anims.push(an);
  }
  if (useCam && host) mk(host, camKeys, k => { const s2 = k.s, cx = clamp(k.x, 160 / s2, 320 - 160 / s2), cy = clamp(k.y, 95 / s2, 190 - 95 / s2); return `translate(160px,95px) scale(${s2}) translate(${-cx.toFixed(2)}px,${-cy.toFixed(2)}px)`; });
  scene.classList.add('motion-on');
  const first = anims[0], ms = Math.round(total * 1000);
  return {
    total: ms, anims, intro: INTRO,
    stepAt: m => { const s2 = m / 1000 + .02; let c = 0; starts.forEach((v, i) => { if (s2 >= v) c = i; }); return c; },
    stepStart: i => i ? Math.round(starts[Math.min(i, n - 1)] * 1000) + 30 : 0,
    get time() { return first.currentTime || 0; }, get playing() { return first.playState === 'running'; }, get finished() { return (first.currentTime || 0) >= ms - 1; },
    play: (r = 1) => anims.forEach(x => { x.playbackRate = r; x.play(); }), pause: () => anims.forEach(x => x.pause()),
    seek: v => anims.forEach(x => { x.currentTime = Math.max(0, Math.min(ms, v)); }), rate: r => anims.forEach(x => x.updatePlaybackRate(r)),
    moving: () => [], destroy: () => { anims.forEach(x => x.cancel()); trailG.remove(); scene.classList.remove('motion-on'); },
  };
}
