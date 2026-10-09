'use strict';
// V8 scene choreography. Each exercise setup plays one schematic run-through from start to finish.
// Speeds are in pitch units per second. Roughly 10 units are 1 m, so the pace is close to a real
// drill (walk 2 m/s, jog 4 m/s, dribble 3 m/s, pass 12 m/s). Distances and routes are NOT to scale.
const SceneMotion=(()=>{
const SP={walk:20,shuffle:26,jog:42,dribble:30,sprint:62,roll:80,toss:72,pass:125,shot:175};
const ease={run:'cubic-bezier(.35,0,.35,1)',ball:'cubic-bezier(.15,.55,.35,1)',snap:'cubic-bezier(.4,0,.2,1)'};
const OFF=[11,3];
const D=(i,x,y,sp='dribble',b='b'+i)=>({a:'p'+i,x,y,sp,carry:b});
const R=(a,x,y,sp='jog')=>({a:typeof a==='number'?'p'+a:a,x,y,sp});
const P=(b,to,sp='pass')=>({a:b,to:'p'+to,sp});
const S=(b,x,y,sp='shot')=>({a:b,x,y,sp,abs:true});
const ev=(m,hold=.3)=>({m,hold});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function plan(kind,e,ps){
 if(!ps.length)return null;
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
function compile(scene,steps,{camera=false}={}){
 const kind=scene.dataset.setup,e=typeof exercise==='function'?exercise(scene.dataset.exercise):null;if(!e||kind==='custom')return null;
 const actors={};scene.querySelectorAll('[data-actor]').forEach(el=>{actors[el.dataset.actor]={el,x:+el.dataset.x,y:+el.dataset.y,k:[]};});
 const ps=[];for(let i=0;actors['p'+i];i++)ps.push([actors['p'+i].x,actors['p'+i].y,actors['p'+i].el.dataset.label,actors['p'+i].el.dataset.op==='1']);
 const pl=plan(kind,e,ps);if(!pl)return null;
 const pos={};for(const id in actors)pos[id]=[actors[id].x,actors[id].y];
 const T=[],INTRO=camera?.9:.45,OUTRO=camera?1.3:1;let t=INTRO;
 for(const id in actors)actors[id].k.push({t:0,x:pos[id][0],y:pos[id][1],e:'linear'},{t:INTRO,x:pos[id][0],y:pos[id][1],e:'linear'});
 const cam=[{t:0,x:160,y:95,s:1,e:ease.snap},{t:INTRO,x:160,y:95,s:1,e:ease.snap}];
 const blend=id=>{const b=pos.b0||[160,95];return[b[0]*.6+160*.4,b[1]*.6+95*.4];};
 const evs=[];
 for(const event of pl.events){
  const moves=[];
  for(const m of event.m){if(m.to){const target=event.m.find(x=>x.a===m.to&&x.x!=null);const base=target?[target.x,target.y]:pos[m.to];moves.push({id:m.a,x:base[0]+OFF[0],y:base[1]+OFF[1],sp:m.sp,kind:'ball'});}
   else if(m.carry){moves.push({id:m.a,x:m.x,y:m.y,sp:m.sp,kind:'run'});moves.push({id:m.carry,x:m.x+OFF[0],y:m.y+OFF[1],sp:m.sp,kind:'run',follow:m.a});}
   else moves.push({id:m.a,x:m.x,y:m.y,sp:m.sp,kind:m.abs?'ball':(m.a[0]==='b'?'ball':'run')});}
  let dur=.35;for(const m of moves){const p=pos[m.id];if(!p)continue;m.d=Math.hypot(m.x-p[0],m.y-p[1])/SP[m.sp];dur=Math.max(dur,m.d);}
  const t0=t,t1=t+dur;
  for(const m of moves){const p=pos[m.id];if(!p)continue;const a=actors[m.id];const fl=m.follow?moves.find(x=>x.id===m.follow):null;const d=fl?fl.d:m.d;const end=t0+Math.max(.2,Math.min(dur,d));
   a.k.push({t:t0,x:p[0],y:p[1],e:m.kind==='ball'?ease.ball:ease.run},{t:end,x:m.x,y:m.y,e:'linear'});pos[m.id]=[m.x,m.y];}
  evs.push({t0,t1,hold:event.hold,ids:moves.map(m=>m.id).filter(id=>id[0]==='p')});
  const b=blend();cam.push({t:t0+(t1-t0)*.15,x:b[0],y:b[1],s:1.17,e:ease.snap});
  t=t1+event.hold;for(const id in actors){const k=actors[id].k;const last=k[k.length-1];if(last.t<t)k.push({t,x:pos[id][0],y:pos[id][1],e:'linear'});}
  cam.push({t:t-.05,x:blend()[0],y:blend()[1],s:1.17,e:ease.snap});
 }
 const total=t+OUTRO;
 for(const id in actors){actors[id].k.push({t:total,x:pos[id][0],y:pos[id][1],e:'linear'});}
 cam.push({t:total,x:160,y:95,s:1,e:ease.snap});
 const anims=[];const mk=(el,list,fn)=>{const frames=[];let lastT=-1;for(const k of list){if(k.t<=lastT)k.t=lastT+.0001;lastT=k.t;frames.push({offset:Math.min(1,k.t/total),transform:fn(k),easing:k.e});}frames[frames.length-1].offset=1;frames[0].offset=0;const a=el.animate(frames,{duration:total*1000,fill:'both',easing:'linear'});a.pause();anims.push(a);};
 for(const id in actors){const a=actors[id];const k0=a.k.slice();mk(a.el,k0,k=>`translate(${(k.x-a.x).toFixed(2)}px,${(k.y-a.y).toFixed(2)}px)`);}
 const camEl=scene.querySelector('.cam');
 if(camera&&camEl){const lim=s=>[clamp,s];mk(camEl,cam,k=>{const s=k.s,cx=clamp(k.x,160/s,320-160/s),cy=clamp(k.y,95/s,190-95/s);return `translate(160px,95px) scale(${s}) translate(${-cx.toFixed(2)}px,${-cy.toFixed(2)}px)`;});}
 // Step n covers an equal share of the run, so every written step is shown before the end.
 const n=Math.max(1,steps),body=total-INTRO-OUTRO;
 const stepAt=ms=>{const s=ms/1000;if(s<=INTRO)return 0;if(s>=total-OUTRO)return n-1;return Math.min(n-1,Math.floor((s-INTRO)/body*n));};
 const stepStart=i=>Math.round((INTRO+body*i/n)*1000+(i?30:0));
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
  destroy(){anims.forEach(a=>a.cancel());scene.classList.remove('motion-on');}};
}
return {plan,compile,SP};
})();
