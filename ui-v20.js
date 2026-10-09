'use strict';
// V20: tap an exercise in the plan to edit its minutes and its player count.
const editSheet=document.createElement('dialog');editSheet.id='blockEditDialog';
editSheet.innerHTML='<h2 id="blockEditTitle">Übung bearbeiten</h2><p id="blockEditTag" class="subtle"></p><form id="blockEditForm" method="dialog" novalidate><label>Minuten<input id="blockEditMinutes" type="number" min="1" max="120" inputmode="numeric"></label><label>Spieler bei dieser Übung<input id="blockEditPeople" type="number" min="1" max="100" inputmode="numeric"></label><p id="blockEditHint" class="subtle" aria-live="polite"></p><p id="blockEditError" role="alert"></p><div class="row"><button type="button" id="blockEditSame">Wie in der Einheit</button><button type="button" id="blockEditDetail">Aufbau & Animation</button></div><div class="row"><button type="submit" class="primary" id="blockEditSave">Speichern</button><button type="button" id="blockEditClose">Abbrechen</button></div></form>';
document.body.append(editSheet);if(typeof v16Sheetify==='function')v16Sheetify(editSheet);
let editBlockId=null;
const editBlock=()=>plan().blocks.find(b=>b.id===editBlockId);
function editHint(){const b=editBlock();if(!b)return;const e=exercise(b.exerciseId),n=Number($('blockEditPeople').value),ok=Number.isInteger(n)&&n>=1&&n<=100;
 $('blockEditHint').textContent=ok?`${e.min===e.max?e.min:e.min+'-'+e.max} Spieler pro Gruppe · ${fit(e,n)?fit(e,n)+' parallele Gruppe(n)':'passt nicht in Gruppen, bitte Zahl ändern'}${n===plan().people?' · wie in der Einheit':''}`:'1-100 Spieler eintragen.';}
function openBlockEdit(id){const b=plan().blocks.find(x=>x.id===id);if(!b)return;editBlockId=id;const e=exercise(b.exerciseId);$('blockEditTitle').textContent=e.name;$('blockEditTag').textContent=`${e.tag} · Einheit hat ${plan().people} Spieler`;$('blockEditMinutes').value=b.minutes;$('blockEditPeople').value=b.people||plan().people;$('blockEditError').textContent='';editHint();editSheet.showModal();}
$('blockEditPeople').oninput=editHint;
$('blockEditSame').onclick=()=>{$('blockEditPeople').value=plan().people;editHint();};
$('blockEditClose').onclick=()=>editSheet.close();
$('blockEditDetail').onclick=()=>{const b=editBlock();editSheet.close();if(b)openDetail(b.exerciseId);};
$('blockEditForm').onsubmit=ev=>{ev.preventDefault();const b=editBlock();if(!b)return editSheet.close();const m=Number($('blockEditMinutes').value),n=Number($('blockEditPeople').value);
 if(!Number.isInteger(m)||m<1||m>120)return void($('blockEditError').textContent='Minuten: 1-120.');
 if(!Number.isInteger(n)||n<1||n>100)return void($('blockEditError').textContent='Spieler: 1-100.');
 if(typeof rememberEasy==='function')rememberEasy();
 b.minutes=m;if(n===plan().people)delete b.people;else b.people=n;
 editSheet.close();resetTimer();save();render();notify('Übung angepasst.');};
document.addEventListener('click',ev=>{const t=ev.target.closest('[data-edit-block]');if(t&&!ev.defaultPrevented){ev.preventDefault();openBlockEdit(t.dataset.editBlock);}});
