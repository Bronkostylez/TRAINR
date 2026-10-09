'use strict';
// Editorial setup schematics, not a technique demo or an official drill diagram.
// Each exercise chooses its setup explicitly. The current instruction is shown beside it.
const SCENE_GROUPS={
 islands:['islands','v5-islandpair','v5-outside'],signal:['traffic','v5-weather','v5-body','v5-pace','v5-stopgo','activation'],transport:['treasure'],gates:['gates','v5-turn','freegates','v5-foot'],lanes:['v5-paths','v5-crossroads'],corners:['v5-colors'],pairdribble:['v5-mirror','v5-partner','v5-shadow','v5-shield'],choice:['v5-choice'],pairgate:['gatepass','left-right','v5-widegate','v5-kdistance'],pairgoal:['threepasses'],receive:['v5-receive','v5-scan','v5-kcolor','v5-kopen'],triangle:['pass','v5-triangle','v5-bounce'],square:['v5-square','v5-pairswitch'],wall:['v5-wall'],linepass:['v5-through'],rondo:['v5-rondo','v5-rondo42'],targets:['v5-targets'],finish:['finish','v5-carryfinish','v5-anglefinish','v5-choosefinish'],passfinish:['v5-rollfinish','v5-gatefinish','v5-returnfinish'],game:['2v2','3v3','4v4','switch','v5-2v2','v5-2v2four','v5-3v3wide','v5-3v3narrow','v5-4v4four','v5-2v2recover','v5-3v3restart','v5-3v3switch','v5-2v2free','v5-3v3free'],zones:['endzone','v5-3v3zone','v5-4v4zone'],lines:['midline','defend','v5-escape','v5-twoends','v5-3v3line','v5-4v4line','v5-2v1','v5-1v1line','v5-2v2defend'],neutral:['deep','v5-3v3neutral','v5-4v4neutral'],overload:['v5-3v2'],fullgame:['1to4','2to4','8seconds','forward','oneback','line4'],keeperball:['warm','v5-kball'],keepermove:['ready','react','v5-kready'],keepercatch:['catch','chest','high','v5-kroll','v5-ksoft'],keeperfloor:['floor','stand'],keeperroll:['roll'],keeperangle:['angle','v5-kfollow'],keeperpair:['feet']
};
const SETUP_KIND=Object.fromEntries(Object.entries(SCENE_GROUPS).flatMap(([kind,ids])=>ids.map(id=>[id,kind])));
function drillPitch(e,large=false,step=0){
 const kind=e.custom?'custom':e.setupKind||SETUP_KIND[e.id]||'custom';
 const player=(x,y,n,op=false)=>`<g class="pitch-player ${n==='K'?'goalkeeper':op?'opponent':''}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y+3}">${n}</text></g>`;
 const cone=(x,y)=>`<path class="setup-cone" d="M${x-4} ${y+4}l4-9 4 9z"/>`;
 const gate=(x,y)=>cone(x,y-12)+cone(x,y+12);
 const goal=(x,y)=>`<rect class="setup-goal" x="${x}" y="${y}" width="10" height="25" rx="2"/>`;
 const zone=(x,y,w,h,label)=>`<g class="setup-zone"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/><text x="${x+w/2}" y="${y+h/2+3}">${label}</text></g>`;
 let objects='',route='',ball=[65,100],name='Aufbau';let ps=[];
 const pair=()=>{ps=[[65,95,'1'],[250,95,'2']];ball=[80,95];route='M80 95 L235 95';};
 const match=(count=e.min,goals=true)=>{const each=Math.min(5,Math.floor(count/2));for(let i=0;i<each;i++){ps.push([75+(i%2)*30,48+i*23,String(i+1)]);ps.push([215+(i%2)*30,48+i*23,String(i+1),true]);}ball=[115,95];route='M115 95 L165 65 L205 110';if(goals){const four=e.equipment.some(([n,c])=>/tor/i.test(n)&&c===4);objects+=goal(24,four?45:82)+goal(286,four?45:82);if(four)objects+=goal(24,123)+goal(286,123);}};
 switch(kind){
 case 'islands':objects=zone(90,35,42,35,'A')+zone(205,65,42,35,'B')+zone(125,120,42,35,'C');ps=[[60,110,'1'],[245,135,'2']];route='M65 110 Q65 48 105 52 L145 138';name='Freie Inseln';break;
 case 'signal':objects=zone(225,28,64,35,'SIGNAL');ps=[[65,65,'1'],[155,100,'2'],[240,140,'3']];route='M65 65 Q100 145 175 110 T245 145';name=e.id==='traffic'?'Grün · Gelb · Rot':'Bewegen · Signal · Stopp';break;
 case 'transport':objects=zone(30,35,65,120,'START')+zone(220,35,68,45,'ZIEL A')+zone(220,112,68,45,'ZIEL B');ps=[[65,85,'1'],[65,125,'2']];route='M65 85 L245 57';name='Start- und Zielzonen';break;
 case 'gates':objects=gate(90,60)+gate(180,130)+gate(255,60);ps=[[50,130,'1'],[215,95,'2']];route='M50 130 Q60 60 110 60 L180 130';name='Freie Hütchentore';break;
 case 'lanes':objects=zone(55,48,210,32,'GASSE')+(e.id==='v5-crossroads'?zone(140,27,32,130,''):zone(55,115,210,32,'GASSE'));ps=[[45,65,'1'],[275,135,'2']];route='M45 65 L275 65';name='Breite Wege';break;
 case 'corners':objects=zone(30,28,50,30,'A')+zone(240,28,50,30,'B')+zone(30,132,50,30,'C')+zone(240,132,50,30,'D');ps=[[140,90,'1'],[180,110,'2']];route='M140 90 L55 42';name='Vier bezeichnete Ecken';break;
 case 'duel':if(e.id==='v5-shield'){ps=[[150,95,'1'],[175,105,'V',true]];objects=zone(85,40,150,110,'SCHÜTZEN');name='Ball abschirmen · Partnerdruck';route='M150 95 L125 75';break;}ps=[[65,95,'1'],[205,95,'V',true]];objects=e.id==='v5-twoends'?gate(280,55)+gate(280,140):'<path class="setup-line" d="M35 25v140 M285 25v140"/>';route='M65 95 L160 70 L280 70';name='Angriff & Verteidigung';break;
 case 'pairdribble':ps=[[90,70,'1'],[65,120,'2']];route='M90 70 Q160 40 245 100';name='Zwei Spieler · Abstand';break;
 case 'choice':objects=gate(265,55)+gate(265,140);ps=[[65,95,'1']];route='M65 95 L265 55';name='Zwei freie Ausgänge';break;
 case 'pairgate':pair();if(e.type==='keeper')ps[0][2]='K';objects=gate(160,95);if(e.id==='left-right')objects+=gate(160,45);name='Paar & Hütchentor';break;
 case 'pairgoal':pair();objects=goal(285,82);route='M80 95 L235 95 L80 95 L235 95 L285 95';name='Pässe vor dem Abschluss';break;
 case 'receive':pair();if(e.id==='v5-scan')ps.push([285,95,'S']);if(e.type==='keeper')ps[1][2]='K';objects=gate(260,50)+gate(260,140);route='M80 95 L230 95 L260 50';name='Annehmen & Ziel wählen';break;
 case 'triangle':ps=[[65,140,e.type==='keeper'?'K':'A'],[155,45,'B'],[255,140,'C']];ball=[80,135];route='M80 135 L155 60 L240 135 L80 135';name='Dreieck';break;
 case 'square':ps=[[65,45,'1'],[255,45,'2'],[255,145,'3'],[65,145,'4']];ball=[80,45];route='M80 45 L240 45 L255 130 L80 145 Z';name='Viereck · Platzwechsel';break;
 case 'wall':ps=[[65,135,'1'],[170,65,'2']];ball=[80,125];route='M80 125 L160 70 L245 85';name='Pass · Lauf · Rückpass';break;
 case 'linepass':ps=[[50,95,'A'],[160,95,'B'],[275,95,'C']];ball=[65,95];route='M65 95 L160 105 L260 95';name='Drei Spieler verbinden';break;
 case 'rondo':ps=[[55,45,'1'],[270,45,'2'],[160,150,'3'],[155,95,'V',true]];if(e.id==='v5-rondo42')ps.push([55,150,'4'],[205,100,'V',true]);ball=[70,45];route='M70 45 L255 45 L160 140';name='Ballhalten mit Gegnern';break;
 case 'targets':pair();objects=zone(30,40,45,110,'A')+zone(245,40,45,110,'B');name='Breite Zielzonen';break;
 case 'finish':ps=[[65,130,'1']];if(e.id==='v5-choosefinish')ps.push([155,45,'S']);objects=goal(285,82);if(e.id==='finish'||e.id==='v5-choosefinish')objects+=goal(285,135);route='M65 130 Q140 100 190 95 L285 95';name='Dribbelweg & Abschluss';break;
 case 'passfinish':ps=[[65,140,'1'],[150,45,'2']];objects=goal(285,82);if(e.id==='v5-gatefinish')objects+=gate(160,110);ball=[150,60];route='M150 60 L110 130 L285 95';name='Zuspiel & Abschluss';break;
 case 'game':match();name='Teams & Minitore';break;
 case 'zones':match(e.min,false);objects=zone(25,25,50,140,'ZONE')+zone(245,25,50,140,'ZONE');name='Zwei Endzonen';break;
 case 'lines':match(e.min,false);objects='<path class="setup-line" d="M35 25v140 M285 25v140"/>';name='Linien als Ziel';break;
 case 'neutral':match(e.id==='deep'?6:e.min-1,true);if(e.id==='deep'){ps.push([280,95,'W'],[40,95,'W',true]);}else ps.push([160,95,'N']);name=e.id==='deep'?'Zwei eigene Wandspieler':'Neutraler Joker';break;
 case 'overload':ps=e.min===3?[[65,65,'1'],[65,135,'2'],[210,95,'V',true]]:[[60,50,'1'],[65,95,'2'],[60,140,'3'],[210,65,'V',true],[210,130,'V',true]];objects=goal(285,45)+goal(285,125);ball=[80,95];route='M80 95 L150 140 L285 140';name=e.min===3?'Zwei gegen eins':'Drei gegen zwei';break;
 case 'fullgame':match(8,false);ps.push([40,95,'K'],[280,95,'K',true]);objects=goal(22,82)+goal(288,82);name='Feldspieler & Keeper';break;
 case 'keeperball':ps=[[85,95,'K'],[235,95,'K']];route='M100 95 Q150 45 205 95';name='Ballgefühl · keine Technikdemo';break;
 case 'keepermove':ps=[[65,95,'H'],[250,95,'K']];objects=cone(235,50)+cone(235,140);route='M80 95 L235 95';name='Seitlich · bereit · Ball';break;
 case 'keepercatch':ps=[[65,95,'H'],[250,95,'K']];objects=zone(220,55,60,80,e.tag==='Fangen'?'FANGEN':'BEREIT');route='M80 95 L235 95';name='Sanftes Zuspiel · schematisch';break;
 case 'keeperfloor':ps=[[160,95,'K']];ball=[200,100];objects=zone(75,45,175,110,'WEICHER BODEN');name='Nur Aufbau · keine Falltechnik';break;
 case 'keeperroll':ps=[[70,95,'K'],[255,55,'H']];objects=gate(255,55)+gate(255,135);route='M85 95 L255 55';name='Aufnehmen · Ziel · Abrollen';break;
 case 'keeperangle':ps=[[260,95,'K'],[70,55,'H']];objects=goal(288,82);route='M70 55 L70 135';name='Ball · Keeper · Tormitte';break;
 case 'keeperpair':pair();ps[0][2]='K';ps[1][2]='K';name='Zwei Keeper · Fußpässe';break;
 default:name='Eigene Übung · Text beachten';objects=zone(60,45,200,105,'DEIN AUFBAU');
 }
 if(ps.length)ball=kind==='keeperfloor'?ball:[ps[0][0]+15,ps[0][1]];
 const instruction=stepsFor(e)[step]||e.description;
 if(step&&ps.length>1){const active=ps[step%ps.length];ball=[active[0]+15,active[1]];}
 // Named alternatives share a basic setup, but the title and current instruction never share identity.
 name=e.name+' · '+name;
 const pl=typeof SceneMotion!=='undefined'?SceneMotion.plan(kind,e,ps):null;
 const balls=pl?pl.balls.map(([id,x,y])=>`<circle class="actor-ball" data-actor="${id}" data-x="${x}" data-y="${y}" cx="${x}" cy="${y}" r="5"/>`).join(''):'';
 return `<div class="pitch-scene scene-${sceneFor(e)} ${large?'pitch-large':''}" data-exercise="${esc(e.id)}" data-setup="${kind}" data-scene-step="${step}"><svg viewBox="0 0 320 190" role="img" aria-label="${esc(e.name)}: ${esc(name)}"><g class="cam"><rect class="pitch-turf" x="1" y="1" width="318" height="188" rx="18"/><rect class="setup-boundary" x="20" y="18" width="280" height="154" rx="3"/>${objects}${route?`<path class="pitch-route" d="${route}"/>`:''}${ps.map((p,i)=>`<g class="${i===step%ps.length?'scene-active-player':''}" data-actor="p${i}" data-x="${p[0]}" data-y="${p[1]}" data-label="${esc(p[2])}" data-op="${p[3]?1:0}">${player(...p)}</g>`).join('')}<circle class="pitch-ball-static" cx="${ball[0]}" cy="${ball[1]}" r="5"/>${balls}</g><text class="scene-step-label" x="28" y="31">${large?'SCHRITT '+(step+1):'AUFBAU'}</text></svg><span class="scene-label">${esc(name)}</span></div>`;
}
