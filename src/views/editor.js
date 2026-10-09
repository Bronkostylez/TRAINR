// Eigene Übungen anlegen und bearbeiten – mit strukturierter Materialliste und Keyframe-Animation.
import * as store from '../core/store.js';
import { AGES, TAGS, exercise } from '../core/planning.js';
import { validAnimation, validCustom, LIMITS } from '../core/schema.js';
import { SEED } from '../data/drills.js';
import { esc, uid, integer, safeURL, deepClone, clamp } from '../core/util.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { undoToast } from '../ui/actions.js';
import { toast, haptic } from '../ui/feedback.js';
import { reduced } from '../ui/motion.js';

const ACTORS = [['Spieler 1', '#d2ef79'], ['Spieler 2', '#d2ef79'], ['Keeper K', '#9154d9'], ['Ball', '#ffffff']];
const baseAnim = () => ({ version: 1, frames: [{ seconds: 3, caption: 'Start: kurzer Pass.', points: [[65, 95], [245, 95], [160, 50], [80, 95]] }, { seconds: 3, caption: 'Ball annehmen.', points: [[65, 95], [245, 95], [160, 50], [230, 95]] }] });

export function openEditor(id = null, prefill = null) {
  const s = store.get(), old = id ? s.custom.find(e => e.id === id) : null;
  if (!old && s.custom.length >= LIMITS.custom) { toast(`Maximal ${LIMITS.custom} eigene Übungen.`); return; }
  const e = deepClone(old || prefill || { id: 'custom-' + uid(), name: '', type: s.teams.find(t => t.id === s.activeTeamId)?.type === 'keeper' ? 'keeper' : 'field', tag: 'Passspiel', ages: AGES.slice(2), min: 2, max: 4, minutes: 8, description: '', coaching: '', equipment: [['Bälle', 2], ['Hütchen', 4]], url: '', custom: true });
  let anim = e.animation ? deepClone(e.animation) : null, frame = 0, actor = 0, preview = [];
  const sheet = openSheet({
    title: old ? 'Eigene Übung bearbeiten' : 'Eigene Übung', wide: true,
    body: `<form id="ed" novalidate>
      <p class="small muted">Keine Namen oder personenbezogenen Notizen eintragen. Eigene Übungen bleiben auf diesem Gerät und im Backup.</p>
      <label class="field"><span>Name *</span><input class="input" name="name" required maxlength="80" value="${esc(e.name)}"></label>
      <label class="field"><span>Ziel (ein Satz)</span><input class="input" name="goal" maxlength="300" value="${esc(e.goal || '')}" placeholder="Was sollen die Spieler lernen?"></label>
      <div class="grid-2">
        <label class="field"><span>Schwerpunkt</span><select class="input" name="tag">${TAGS.map(t => `<option ${e.tag === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Trainerart</span><select class="input" name="type"><option value="field" ${e.type === 'field' ? 'selected' : ''}>Feldspieler</option><option value="keeper" ${e.type === 'keeper' ? 'selected' : ''}>Torwart</option><option value="both" ${e.type === 'both' ? 'selected' : ''}>Gemischt</option></select></label>
        <label class="field"><span>Geeignet ab</span><select class="input" name="age">${AGES.map(a => `<option ${e.ages[0] === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="field"><span>Vorgeschlagene Minuten</span><input class="input" name="minutes" type="number" min="1" max="120" value="${e.minutes}"></label>
        <label class="field"><span>Spieler pro Gruppe von (ohne Trainer)</span><input class="input" name="min" type="number" min="1" max="100" value="${e.min}"></label>
        <label class="field"><span>bis</span><input class="input" name="max" type="number" min="1" max="100" value="${e.max}"></label>
      </div>
      <label class="field"><span>Ablauf / Beschreibung * <small class="tiny">Jeder Satz wird ein Schritt.</small></span><textarea class="input" name="description" required maxlength="1000" rows="4">${esc(e.description)}</textarea></label>
      <label class="field"><span>Coaching-Hinweise</span><textarea class="input" name="coaching" maxlength="1000" rows="3" placeholder="Worauf achtest du?">${esc(e.coaching === 'Eigene Übung. Altersklasse, Aufbau und Belastung selbst prüfen.' ? '' : e.coaching)}</textarea></label>
      <div class="field"><span>Material je Gruppe</span><div id="ed-eq" class="stack"></div><button class="btn sm" type="button" id="ed-eq-add" style="justify-self:start">${icon('plus')} Material</button></div>
      <label class="field"><span>Quellenlink (optional, https://)</span><input class="input" name="url" type="url" maxlength="500" value="${esc(e.url)}" inputmode="url"></label>
      <details class="disclosure" id="ed-anim" ${anim ? 'open' : ''}><summary>${icon('play')} <span class="grow">Animierte Platzskizze (optional)</span></summary><div class="body">
        <p class="small muted">1. Spieler oder Ball wählen. 2. Auf das Feld tippen oder ziehen (Pfeiltasten: 5er-Schritte). 3. Nächsten Schritt anlegen. Die Animation verbindet die Positionen. Keeper ist lila.</p>
        <div class="actor-picker" id="ed-actors">${ACTORS.map(([n, c], i) => `<button type="button" data-actor="${i}" aria-pressed="${i === 0}"><i style="background:${c};border:1px solid #0003"></i>${n}</button>`).join('')}</div>
        <svg id="ed-pitch" class="editor-pitch" viewBox="0 0 320 190" tabindex="0" role="application" aria-label="Platz: gewählten Spieler oder Ball durch Antippen platzieren" style="margin-top:8px" data-nodrag></svg>
        <div class="row between" style="margin-top:8px"><button class="btn sm" type="button" id="ed-fprev">${icon('back')} Schritt</button><strong id="ed-flabel"></strong><button class="btn sm" type="button" id="ed-fnext">Schritt ${icon('chevron')}</button></div>
        <div class="grid-2"><label class="field"><span>Schritt erklären</span><input class="input" id="ed-cap" maxlength="180"></label><label class="field"><span>Dauer (Sekunden)</span><input class="input" id="ed-sec" type="number" min="1" max="15"></label></div>
        <div class="row"><button class="btn sm" type="button" id="ed-fadd">${icon('plus')} Schritt</button><button class="btn sm" type="button" id="ed-fdel">${icon('trash')} Schritt löschen</button><button class="btn sm" type="button" id="ed-fplay">${icon('start')} Vorschau</button><button class="btn sm ghost" type="button" id="ed-aoff">Animation entfernen</button></div>
        <p class="tiny">2–20 Schritte, je 1–15 Sekunden. Positionen schematisch, keine Technikdemo.</p></div></details>
      <p class="error" id="ed-err" role="alert"></p></form>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="ed">${icon('check')} Speichern</button>`,
    onClose: () => preview.forEach(a => a.cancel()),
  });
  const b = sheet.body, f = $('#ed', b), err = $('#ed-err', b);

  // ---- Material
  const eqRow = ([n, c]) => `<div class="row" style="flex-wrap:nowrap" data-eqrow><input class="input" type="number" min="1" max="100" value="${c}" aria-label="Menge" style="width:84px;flex:none"><input class="input grow" maxlength="100" value="${esc(n)}" aria-label="Material" placeholder="z. B. Hütchen"><button class="icon-btn" type="button" data-eqdel aria-label="Material entfernen">${icon('close')}</button></div>`;
  $('#ed-eq', b).innerHTML = e.equipment.map(eqRow).join('');
  $('#ed-eq-add', b).onclick = () => { if ($$('[data-eqrow]', b).length >= 20) return toast('Maximal 20 Materialien.'); $('#ed-eq', b).insertAdjacentHTML('beforeend', eqRow(['', 1])); $$('[data-eqrow] input:nth-child(2)', b).at(-1).focus(); };
  on(b, 'click', '[data-eqdel]', (_, x) => x.closest('[data-eqrow]').remove());

  // ---- Animation
  const details = $('#ed-anim', b), svg = $('#ed-pitch', b);
  details.addEventListener('toggle', () => { if (details.open && !anim) { anim = baseAnim(); frame = 0; } paint(); });
  function read() { if (!anim) return; const fr = anim.frames[frame]; fr.caption = $('#ed-cap', b).value.trim() || `Schritt ${frame + 1}`; fr.seconds = clamp(Number($('#ed-sec', b).value) || 3, 1, 15); }
  function paint() {
    if (!anim) return;
    const fr = anim.frames[frame];
    $('#ed-cap', b).value = fr.caption; $('#ed-sec', b).value = fr.seconds;
    $('#ed-flabel', b).textContent = `${frame + 1} / ${anim.frames.length}`;
    $('#ed-fprev', b).disabled = frame === 0; $('#ed-fnext', b).disabled = frame === anim.frames.length - 1; $('#ed-fdel', b).disabled = anim.frames.length <= 2;
    const prevPts = frame > 0 ? anim.frames[frame - 1].points : null;
    svg.innerHTML = `<rect x="20" y="18" width="280" height="154" fill="none" stroke="#91bca5"/><path d="M160 18v154" stroke="#91bca544"/>` +
      (prevPts ? prevPts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 3 ? 4 : 9}" fill="none" stroke="#ffffff55" stroke-dasharray="3 3"/>`).join('') : '') +
      fr.points.map(([x, y], i) => `<g data-p="${i}"><circle cx="${x}" cy="${y}" r="${i === 3 ? 5 : 11}" fill="${ACTORS[i][1]}" stroke="${i === actor ? '#fff' : '#103b2e'}" stroke-width="${i === actor ? 3 : 2}"/><text x="${x}" y="${y + 4}" ${i < 2 ? 'style="fill:#173f33"' : ''}>${i === 3 ? '' : i === 2 ? 'K' : i + 1}</text></g>`).join('');
    $$('[data-actor]', b).forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.actor) === actor)));
  }
  const place = ev => {
    const r = svg.getBoundingClientRect();
    anim.frames[frame].points[actor] = [Math.round(clamp((ev.clientX - r.left) / r.width * 320, 25, 295)), Math.round(clamp((ev.clientY - r.top) / r.height * 190, 25, 165))];
    paint();
  };
  let dragging = false;
  svg.addEventListener('pointerdown', ev => { if (!anim) return; read(); dragging = true; svg.setPointerCapture(ev.pointerId); const g = ev.target.closest('[data-p]'); if (g) actor = Number(g.dataset.p); place(ev); haptic('tap'); });
  svg.addEventListener('pointermove', ev => { if (dragging) place(ev); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('keydown', ev => { const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[ev.key]; if (!d || !anim) return; ev.preventDefault(); read(); const p = anim.frames[frame].points[actor]; p[0] = clamp(p[0] + d[0], 25, 295); p[1] = clamp(p[1] + d[1], 25, 165); paint(); });
  on(b, 'click', '[data-actor]', (_, x) => { actor = Number(x.dataset.actor); paint(); });
  $('#ed-fprev', b).onclick = () => { read(); frame--; paint(); };
  $('#ed-fnext', b).onclick = () => { read(); frame++; paint(); };
  $('#ed-fadd', b).onclick = () => { read(); if (anim.frames.length >= 20) return toast('Maximal 20 Schritte.'); anim.frames.splice(frame + 1, 0, deepClone(anim.frames[frame])); anim.frames[frame + 1].caption = `Schritt ${frame + 2}`; frame++; paint(); };
  $('#ed-fdel', b).onclick = () => { if (anim.frames.length <= 2) return; anim.frames.splice(frame, 1); frame = Math.min(frame, anim.frames.length - 1); paint(); };
  $('#ed-aoff', b).onclick = () => { anim = null; details.open = false; svg.innerHTML = ''; toast('Animation entfernt.'); };
  $('#ed-fplay', b).onclick = () => {
    read();
    if (!validAnimation(anim)) return toast('Jeden Schritt mit 1–15 Sekunden und kurzer Erklärung ausfüllen.');
    if (reduced()) return toast('Animationen sind reduziert. Schritte einzeln ansehen.');
    frame = 0; paint(); preview.forEach(a => a.cancel());
    const fr = anim.frames, total = fr.reduce((a, x) => a + x.seconds, 0);
    preview = $$('[data-p]', svg).map((g, i) => { const st = fr[0].points[i]; let t = 0; const kf = fr.map(x => { const k = { offset: t / total, transform: `translate(${x.points[i][0] - st[0]}px,${x.points[i][1] - st[1]}px)` }; t += x.seconds; return k; }); kf.push({ ...kf.at(-1), offset: 1 }); return g.animate(kf, { duration: total * 1000, easing: 'ease-in-out' }); });
  };
  paint();

  // ---- Speichern
  f.onsubmit = ev => {
    ev.preventDefault(); read(); err.textContent = '';
    const eq = $$('[data-eqrow]', b).map(r => { const [c, n] = $$('input', r); return [n.value.trim(), Number(c.value)]; }).filter(([n]) => n);
    const next = {
      ...e, name: f.name.value.trim(), tag: f.tag.value, type: f.type.value, ages: AGES.slice(AGES.indexOf(f.age.value)), min: Number(f.min.value), max: Number(f.max.value), minutes: Number(f.minutes.value),
      description: f.description.value.trim(), coaching: f.coaching.value.trim() || 'Eigene Übung. Altersklasse, Aufbau und Belastung selbst prüfen.', equipment: eq.length ? eq : [['Bälle', 1]], url: f.url.value.trim(), custom: true,
    };
    const goal = f.goal.value.trim(); if (goal) next.goal = goal; else delete next.goal;
    if (anim && details.open) next.animation = anim; else delete next.animation;
    const problem = !next.name ? 'Bitte einen Namen eingeben.' : !next.description ? 'Bitte den Ablauf beschreiben.' : !integer(next.min, 1, 100) || !integer(next.max, next.min, 100) ? 'Spieler: Von 1–100, Bis mindestens Von.' : !integer(next.minutes, 1, 120) ? 'Minuten: 1–120.' : eq.some(([n, c]) => !integer(c, 1, 100) || n.length > 100) ? 'Material: Menge 1–100 und Name.' : !safeURL(next.url) ? 'Quelle muss mit https:// beginnen.' : next.animation && !validAnimation(next.animation) ? 'Animation prüfen: 2–20 Schritte, je 1–15 Sekunden.' : '';
    const ids = new Set([...SEED.map(x => x.id), ...store.get().custom.filter(x => x.id !== next.id).map(x => x.id)]);
    if (problem || !validCustom(next, ids)) { err.textContent = problem || 'Bitte Angaben prüfen.'; haptic('warn'); return; }
    store.update(old ? 'Eigene Übung geändert' : 'Eigene Übung angelegt', d => { const i = d.custom.findIndex(x => x.id === next.id); if (i >= 0) d.custom[i] = next; else d.custom.push(next); });
    sheet.close();
    undoToast(old ? 'Eigene Übung aktualisiert. Bestehende Blöcke bleiben erhalten.' : `„${next.name}“ gespeichert.`);
    if (!old) setTimeout(() => import('./detail.js').then(m => m.openDetail(next.id)), 250);
  };
  if (!exercise(store.get(), e.id) && !old) f.name.focus();
}
