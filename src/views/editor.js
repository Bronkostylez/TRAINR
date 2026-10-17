// Eigene Übungen anlegen und bearbeiten. Pflicht sind nur Name, Spieler pro Gruppe und Material;
// im Mittelpunkt steht die Platzskizze: antippen setzt, ziehen bewegt, weitere Schritte ergeben die Animation.
import * as store from '../core/store.js';
import { AGES, TAGS, MAX_FOCI, exercise, flowOf, FLOWS, FLOW_LABEL, FLOW_HELP } from '../core/planning.js';
import { validAnimation, normAnimation, validCustom, LIMITS, SKETCH_BOX, ZOOM_MAX } from '../core/schema.js';
import { SEED } from '../data/drills.js';
import { esc, uid, integer, safeURL, deepClone, clamp } from '../core/util.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { undoToast } from '../ui/actions.js';
import { toast, haptic } from '../ui/feedback.js';
import { reduced, full } from '../ui/motion.js';
import { mountPlayer } from '../scene/player.js';
import { materialType } from '../ui/material.js';
import { focusPicker } from '../ui/focus.js';
import { SKETCH_ITEMS, STATIC_KINDS, SKETCH_DEFS, SKETCH_FIELD, sketchItem, sketchLabels, sketchTrails } from '../scene/pitch.js';

const DEFAULT_COACHING = 'Eigene Übung. Altersklasse, Aufbau und Belastung selbst prüfen.';
const TOOLS = [['a', '<i style="background:var(--player)"></i>'], ['b', '<i style="background:var(--opponent)"></i>'], ['k', '<i style="background:var(--keeper)"></i>'], ['ball', '<i style="background:#fff;width:14px;height:14px"></i>'],
  ['zone', '<i style="border:2px dashed currentColor;width:16px;height:12px;background:transparent"></i>'], ['cone', '<i style="background:var(--cone);border-radius:3px;width:14px;height:14px;transform:rotate(45deg)"></i>'], ['mini', '<i style="border-radius:3px;width:12px;height:20px;background:transparent;border:2px solid currentColor"></i>'], ['goal', '<i style="border-radius:3px;width:14px;height:24px;background:transparent;border:3px solid currentColor"></i>']];
// Vorlagen: [Art, x, y] und optional Bewegungen für Schritt 2 ({ Index: [x, y] }).
const TEMPLATES = {
  'Passen zu zweit': { items: [['a', 70, 95], ['a', 250, 95], ['ball', 86, 95], ['cone', 160, 78], ['cone', 160, 112]], moves: [{ 2: [234, 95] }, { 2: [86, 95] }], captions: ['Aufstellen, 1 hat den Ball.', 'Pass durch das Hütchentor zu 2.', '2 spielt zurück.'] },
  'Dreieck': { items: [['a', 80, 145], ['a', 160, 45], ['a', 240, 145], ['ball', 96, 145], ['cone', 80, 162], ['cone', 160, 28], ['cone', 240, 162]], moves: [{ 3: [160, 60] }, { 3: [226, 145], 0: [150, 100] }], captions: ['Drei Spieler im Dreieck.', 'Pass zu 2.', 'Weiter zu 3, 1 läuft nach.'] },
  '1 gegen 1': { items: [['a', 70, 95], ['b', 190, 95], ['ball', 86, 95], ['mini', 300, 95], ['mini', 20, 95]] },
  '2 gegen 2': { items: [['a', 100, 65], ['a', 100, 125], ['b', 220, 65], ['b', 220, 125], ['ball', 160, 95], ['mini', 300, 95], ['mini', 20, 95]] },
  'Torschuss': { items: [['a', 90, 135], ['ball', 106, 135], ['cone', 175, 110], ['goal', 302, 95], ['k', 286, 95]], moves: [{ 0: [160, 115], 1: [175, 118] }, { 1: [290, 85] }], captions: ['Mit Ball starten.', 'Zum Hütchen dribbeln.', 'Abschluss aufs Tor.'] },
  'Rondo 3 gegen 1': { items: [['a', 75, 45], ['a', 245, 45], ['a', 160, 150], ['b', 160, 90], ['ball', 91, 45], ['cone', 55, 28], ['cone', 265, 28], ['cone', 55, 165], ['cone', 265, 165]] },
};
const MATERIALS = [['Bälle', 2], ['Hütchen', 4], ['Markierungsteller', 8], ['Minitore', 2], ['Tore', 1], ['Leibchen', 4], ['Stangen', 4], ['Reifen', 4], ['Koordinationsleiter', 1], ['Weiche Matte', 1]];
// Was in der Skizze steht, wird als Material mindestens so oft vorgeschlagen.
const SYNC = [['ball', 'Bälle', /ball|bäll/i], ['cone', 'Hütchen', /hütchen|kegel/i], ['mini', 'Minitore', /minitor/i], ['goal', 'Tore', /^(groß)?tor(e)?$/i], ['b', 'Leibchen', /leibchen/i]];
const TEMPO = [[3, 'Langsam'], [2, 'Normal'], [1, 'Schnell']];
const ZOOMS = [[1, 'Weit'], [1.6, 'Mittel'], [2.2, 'Nah']], CAM_MODES = [['auto', 'Auto'], ['manual', 'Fokus'], ['off', 'Aus']];
const B = { x0: SKETCH_BOX.x0 + 4, x1: SKETCH_BOX.x1 - 4, y0: SKETCH_BOX.y0 + 4, y1: SKETCH_BOX.y1 - 4 };

export function openEditor(id = null, prefill = null, notice = '') {
  const s = store.get(), old = id ? s.custom.find(e => e.id === id) : null;
  if (!old && s.custom.length >= LIMITS.custom) { toast(`Maximal ${LIMITS.custom} eigene Übungen.`); return; }
  const fresh = !old && !prefill;
  const e = deepClone(old || prefill || { id: 'custom-' + uid(), name: '', type: s.teams.find(t => t.id === s.activeTeamId)?.type === 'keeper' ? 'keeper' : 'field', tag: 'Passspiel', ages: AGES.slice(2), min: 2, max: 4, minutes: 8, description: '', coaching: '', equipment: [], url: '', custom: true });
  const autoText = fresh ? '' : e.description; // erzeugter Ablauf wird beim Speichern neu gebildet

  // ---- Zustand
  const emptySk = () => ({ version: 2, camera: 'auto', items: [], frames: [{ seconds: 2, caption: '', points: [] }] });
  let sk = deepClone(normAnimation(e.animation)) || emptySk();
  let frame = 0, tool = 'a', sel = -1, past = [], drag = null, peopleTouched = !fresh, camPick = false, camOpen = !!(sk.camera && sk.camera !== 'auto');
  const camMode = () => sk.camera || 'auto';
  const mat = new Map(e.equipment.map(([n, c]) => [n, c]));
  const presets = MATERIALS.map(([n]) => [...mat.keys()].find(k => k.toLowerCase() === n.toLowerCase()) || n);
  const matNames = [...presets, ...[...mat.keys()].filter(k => !presets.includes(k))];

  const stepper = (name, v, label) => `<div class="field" style="margin:0"><span>${label}</span><div class="stepper"><button type="button" data-step="${name}" data-d="-1" aria-label="${label} verringern">−</button><input class="input" name="${name}" type="number" inputmode="numeric" min="1" max="100" value="${v}" aria-label="${label}"><button type="button" data-step="${name}" data-d="1" aria-label="${label} erhöhen">+</button></div></div>`;
  const sheet = openSheet({
    title: old ? 'Eigene Übung bearbeiten' : 'Eigene Übung', wide: true,
    body: `<form id="ed" novalidate data-tab="sketch">
      <label class="field"><span>Name *</span><input class="input" name="name" required maxlength="80" value="${esc(e.name)}" placeholder="z. B. Dreieckspass mit Abschluss" autocomplete="off"></label>

      <div class="ed-tabbar"><div class="seg ed-tabs" role="tablist" aria-label="Bereich"><button type="button" role="tab" data-ed-tab="sketch" aria-selected="true">${icon('layers')} Skizze</button><button type="button" role="tab" data-ed-tab="details" aria-selected="false">${icon('check')} Angaben</button></div></div>
      <div class="ed-layout">
      <section class="ed-section ed-sketch" aria-labelledby="ed-sk-h">
        <div class="row between"><h3 id="ed-sk-h" class="ed-h">Platzskizze <small class="tiny">optional</small></h3><button class="btn sm ghost" type="button" id="ed-tpl">${icon('layers')} Vorlage</button></div>${notice ? `<p class="small ed-copy-notice" role="note">${esc(notice)}</p>` : ''}
        <div class="board-tools ed-tools" role="toolbar" aria-label="Was setzen?">${TOOLS.map(([k, ic]) => `<button class="tool" type="button" data-tool="${k}" aria-pressed="${tool === k}">${ic}<span>${SKETCH_ITEMS[k]}</span></button>`).join('')}</div>
        <svg id="ed-pitch" class="editor-pitch" viewBox="0 0 320 190" role="application" aria-label="Platz: antippen setzt das gewählte Element, ziehen bewegt" data-nodrag></svg>
        <div class="ed-selbar" id="ed-selbar" aria-live="polite"></div>
        <div class="ed-steps" id="ed-steps" role="tablist" aria-label="Schritte"></div>
        <div class="ed-step-edit" id="ed-step-edit"></div>
        <div id="ed-cam"></div>
      </section>

      <div class="ed-side">
      <section class="ed-section" aria-labelledby="ed-pp-h">
        <h3 id="ed-pp-h" class="ed-h"><span id="ed-pp-title">Spieler pro Gruppe</span> * <small class="tiny">ohne Trainer</small></h3>
        <label class="field"><span>Ablauf</span><select class="input" name="flow">${FLOWS.map(k => `<option value="${k}" ${flowOf(e) === k ? 'selected' : ''}>${FLOW_LABEL[k]}</option>`).join('')}</select><small class="tiny" id="ed-flow-help"></small></label>
        <div class="row ed-people">${stepper('min', e.min, 'von')}${stepper('max', e.max, 'bis')}</div>
        <p class="tiny" id="ed-pp-hint"></p>
      </section>

      <section class="ed-section" aria-labelledby="ed-fo-h">
        <h3 id="ed-fo-h" class="ed-h">Schwerpunkte <small class="tiny">bis zu ${MAX_FOCI} · der erste ★ ist der Hauptschwerpunkt</small></h3>
        <div id="ed-foci"></div>
        <p class="tiny" id="ed-foci-hint" style="margin:6px 0 0"></p>
      </section>

      <section class="ed-section" aria-labelledby="ed-mat-h">
        <h3 id="ed-mat-h" class="ed-h">Material je Gruppe * <small class="tiny">antippen zum Auswählen</small></h3>
        <div class="mat-grid" id="ed-mat"></div>
        <div class="row" style="flex-wrap:nowrap;margin-top:8px"><input class="input grow" id="ed-mat-new" maxlength="100" placeholder="Anderes Material, z. B. Kegel" aria-label="Anderes Material"><button class="btn sm" type="button" id="ed-mat-add">${icon('plus')} Hinzufügen</button></div>
      </section>

      <details class="disclosure" id="ed-more" style="margin-top:16px"><summary><span class="grow">Weitere Angaben <small class="tiny">optional · Ziel, Ablauf, Alter, Dauer …</small></span></summary><div class="body">
        <label class="field"><span>Ziel (ein Satz)</span><input class="input" name="goal" maxlength="300" value="${esc(e.goal || '')}" placeholder="Was sollen die Spieler lernen?"></label>
        <label class="field"><span>Ablauf <small class="tiny">Jeder Satz wird ein Schritt. Leer = aus der Skizze.</small></span><textarea class="input" name="description" maxlength="1000" rows="3">${esc(autoText)}</textarea></label>
        <label class="field"><span>Coaching-Hinweise</span><textarea class="input" name="coaching" maxlength="1000" rows="2" placeholder="Worauf achtest du?">${esc(e.coaching === DEFAULT_COACHING ? '' : e.coaching)}</textarea></label>
        <div class="grid-2">
          <label class="field"><span>Kategorie <small class="tiny">Art der Übung</small></span><select class="input" name="tag">${TAGS.map(t => `<option ${e.tag === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="field"><span>Trainerart</span><select class="input" name="type"><option value="field" ${e.type === 'field' ? 'selected' : ''}>Feldspieler</option><option value="keeper" ${e.type === 'keeper' ? 'selected' : ''}>Torwart</option><option value="both" ${e.type === 'both' ? 'selected' : ''}>Gemischt</option></select></label>
          <label class="field"><span>Geeignet ab</span><select class="input" name="age">${AGES.map(a => `<option ${e.ages[0] === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
          <label class="field"><span>Vorgeschlagene Minuten</span><input class="input" name="minutes" type="number" min="1" max="120" value="${e.minutes}"></label>
        </div>
        <label class="field"><span>Quellenlink (https://)</span><input class="input" name="url" type="url" maxlength="500" value="${esc(e.url)}" inputmode="url"></label>
      </div></details>
      </div></div>
      <p class="tiny muted" style="margin-top:12px">Keine Namen oder personenbezogenen Notizen eintragen. Eigene Übungen bleiben auf diesem Gerät und im Backup.</p>
      <p class="error" id="ed-err" role="alert"></p></form>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="ed">${icon('check')} Speichern</button>`,
    
  });
  const b = sheet.body, f = $('#ed', b), err = $('#ed-err', b), svg = $('#ed-pitch', b);

  // ---- Platzskizze: Bearbeiten
  const counts = () => sk.items.reduce((m, { k }) => (m[k] = (m[k] || 0) + 1, m), {});
  const players = () => { const c = counts(); return (c.a || 0) + (c.b || 0) + (c.k || 0); };
  const snapshot = () => { past.push(deepClone({ sk, frame })); if (past.length > 60) past.shift(); };
  function undoSketch() { const p = past.pop(); if (!p) return; sk = p.sk; frame = Math.min(p.frame, sk.frames.length - 1); sel = -1; changed(); }
  function changed() { syncFromSketch(); paint(); }
  function addItem(k, x, y, dims = null) {
    if (sk.items.length >= 30) { toast('Maximal 30 Elemente.'); return -1; }
    snapshot(); sk.items.push(k === 'zone' ? { k, w: dims?.w || 60, h: dims?.h || 40 } : { k }); sk.frames.forEach(fr => fr.points.push([x, y])); haptic('tap');
    return sk.items.length - 1;
  }
  function moveItem(i, x, y) {
    x = Math.round(clamp(x, B.x0, B.x1)); y = Math.round(clamp(y, B.y0, B.y1));
    const [ox, oy] = sk.frames[frame].points[i];
    // Hütchen und Tore stehen in jedem Schritt gleich. Spieler/Ball ziehen spätere, noch unveränderte Schritte mit.
    sk.frames.forEach((fr, k) => {
      if (k === frame || STATIC_KINDS.has(sk.items[i].k) || (k > frame && fr.points[i][0] === ox && fr.points[i][1] === oy)) fr.points[i] = [x, y];
    });
  }
  function removeItem(i) { snapshot(); sk.items.splice(i, 1); sk.frames.forEach(fr => fr.points.splice(i, 1)); sel = -1; haptic('tap'); changed(); }
  function applyTemplate(name) {
    const t = TEMPLATES[name]; snapshot();
    const pts = t.items.map(([, x, y]) => [x, y]), frames = [{ seconds: 2, caption: t.captions?.[0] || '', points: pts }];
    (t.moves || []).forEach((mv, k) => { const p = frames.at(-1).points.map(q => [...q]); Object.entries(mv).forEach(([i, q]) => { p[i] = [...q]; }); frames.push({ seconds: 2, caption: t.captions?.[k + 1] || '', points: p }); });
    sk = { version: 2, camera: camMode(), items: t.items.map(([k]) => ({ k })), frames }; frame = 0; sel = -1; changed();
    toast(`Vorlage „${name}“ gesetzt.`, { action: 'Rückgängig', onAction: undoSketch });
  }
  const pt = ev => { const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };

  // ---- Platzskizze: Zeichnen
  function paint() {
    const fr = sk.frames[frame], prev = sk.frames[frame - 1], labels = sketchLabels(sk.items), many = sk.frames.length > 1;
    const order = sk.items.map((_, i) => i).sort((x, y) => STATIC_KINDS.has(sk.items[y].k) - STATIC_KINDS.has(sk.items[x].k));
    const ghosts = prev ? sk.items.map(({ k }, i) => { const [x, y] = prev.points[i], [cx, cy] = fr.points[i]; return STATIC_KINDS.has(k) || (x === cx && y === cy) ? '' : `<circle class="sk-ghost" cx="${x}" cy="${y}" r="${k === 'ball' ? 5 : 10}"/>`; }).join('') : '';
    svg.innerHTML = SKETCH_DEFS + SKETCH_FIELD + ghosts + sketchTrails(sk.items, prev?.points, fr.points) +
      order.map(i => { const { k } = sk.items[i], [x, y] = fr.points[i]; return `<g class="sk-token ${i === sel ? 'selected' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${SKETCH_ITEMS[k]} ${labels[i]}, Pfeiltasten bewegen, Entf entfernt"><circle class="sk-hit" cx="${x}" cy="${y}" r="17"/>${i === sel ? `<circle class="sk-sel" cx="${x}" cy="${y}" r="${k === 'goal' ? 20 : 15}"/>` : ''}${sketchItem(k, x, y, labels[i], sk.items[i])}</g>`; }).join('') +
      (drag?.zone ? `<rect class="sk-draft" x="${Math.min(drag.x0, drag.x1)}" y="${Math.min(drag.y0, drag.y1)}" width="${Math.abs(drag.x1 - drag.x0)}" height="${Math.abs(drag.y1 - drag.y0)}" rx="4"/>` : '') +
      camOverlay(fr) + (sk.items.length ? '' : `<text class="sk-empty" x="160" y="99">${tool === 'zone' ? 'Ziehe auf dem Platz, um eine Zone zu markieren' : `Tippe auf den Platz, um ${SKETCH_ITEMS[tool]} zu setzen`}</text>`);
    // Auswahl- bzw. Hinweiszeile
    const it = sk.items[sel];
    $('#ed-selbar', b).innerHTML = it
      ? `<span class="grow"><strong>${SKETCH_ITEMS[it.k]} ${labels[sel]}</strong> · ziehen zum Bewegen</span><button class="btn sm ghost" type="button" id="ed-dup">${icon('plus')} Kopie</button><button class="btn sm ghost" type="button" id="ed-del">${icon('trash')} Entfernen</button>`
      : `<span class="grow">${!sk.items.length ? 'Element oben wählen und auf den Platz tippen – oder mit einer Vorlage starten.' : frame ? `<strong>Schritt ${frame + 1}:</strong> Spieler und Ball an ihre neue Position ziehen. Pfeile zeigen den Weg.` : many ? 'Aufbau. Änderungen hier gelten auch für die folgenden Schritte.' : 'Fertig für ein Aufbaubild. Für Bewegung: <strong>+ Schritt</strong>.'}</span>`;
    // Schritte
    $('#ed-steps', b).innerHTML = sk.frames.map((x, i) => `<button type="button" role="tab" class="ed-stepbtn" data-frame="${i}" aria-selected="${i === frame}">${i === 0 ? 'Aufbau' : `Schritt ${i + 1}`}</button>`).join('') +
      `<button type="button" class="ed-stepbtn add" id="ed-fadd" ${sk.items.length ? '' : 'disabled'}>${icon('plus')} Schritt</button>`;
    const tempo = sk.frames.every(x => x.seconds === sk.frames[0].seconds) ? sk.frames[0].seconds : 0;
    $('#ed-step-edit', b).innerHTML = !sk.items.length ? '' : `
      <div class="row" style="flex-wrap:nowrap"><input class="input grow" id="ed-cap" maxlength="180" value="${esc(fr.caption)}" placeholder="${frame ? 'Was passiert? z. B. Pass zu 2' : 'Aufbau beschreiben'} (optional)" aria-label="Erklärung zu ${frame ? `Schritt ${frame + 1}` : 'Aufbau'}">${frame ? `<button class="icon-btn" type="button" id="ed-fdel" aria-label="Schritt ${frame + 1} löschen">${icon('trash')}</button>` : ''}</div>
      <div class="row" style="margin-top:8px">
        ${many ? `<button class="btn sm" type="button" id="ed-fplay">${icon('start')} Abspielen</button><div class="seg" role="radiogroup" aria-label="Tempo">${TEMPO.map(([v, t]) => `<button type="button" role="radio" data-tempo="${v}" aria-checked="${tempo === v}">${t}</button>`).join('')}</div>` : ''}
        <span class="grow"></span><button class="btn sm ghost" type="button" id="ed-undo" ${past.length ? '' : 'disabled'}>${icon('undo')} Rückgängig</button><button class="btn sm ghost" type="button" id="ed-clear">${icon('reset')} Leeren</button>
      </div>`;
    $$('[data-tool]', b).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tool === tool && !camPick)));
    paintCam();
  }

  // ---- Kamera: Auto folgt dem Ball, Fokus legt je Schritt Ausschnitt und Zoom fest
  function camOverlay(fr) {
    if (camMode() !== 'manual' || !fr.cam) return '';
    const { x, y, s: z } = fr.cam, w = 320 / z, h = 190 / z, x0 = clamp(x - w / 2, 0, 320 - w), y0 = clamp(y - h / 2, 0, 190 - h);
    return `<path class="sk-cam-dim" fill-rule="evenodd" d="M0 0H320V190H0Z M${x0.toFixed(1)} ${y0.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}Z"/><rect class="sk-cam" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/><text class="sk-cam-label" x="${(x0 + 6).toFixed(1)}" y="${(y0 + 13).toFixed(1)}" style="text-anchor:start">Kamera</text>`;
  }
  function focusGuess() {
    const fr = sk.frames[frame], ball = sk.items.findIndex(it => it.k === 'ball');
    if (ball >= 0) return fr.points[ball];
    const live = sk.items.map((it, i) => i).filter(i => !STATIC_KINDS.has(sk.items[i].k));
    return live.length ? [live.reduce((a, i) => a + fr.points[i][0], 0) / live.length, live.reduce((a, i) => a + fr.points[i][1], 0) / live.length] : [160, 95];
  }
  function setCamCenter(x, y) {
    const fr = sk.frames[frame], z = fr.cam?.s || ZOOMS[1][0];
    fr.cam = { x: Math.round(clamp(x, 0, 320)), y: Math.round(clamp(y, 0, 190)), s: z };
  }
  function paintCam() {
    const host = $('#ed-cam', b), many = sk.frames.length > 1, fr = sk.frames[frame], m = camMode();
    if (!sk.items.length) { host.innerHTML = ''; return; }
    const z = fr.cam?.s || 1;
    host.innerHTML = `<details class="disclosure ed-camera" id="ed-cam-d" ${camOpen ? 'open' : ''}><summary><span class="grow">Kamera &amp; Effekte <small class="tiny">${m === 'auto' ? 'Auto-Zoom auf den Ball' : m === 'manual' ? 'Fokus je Schritt' : 'ohne Zoom'}</small></span></summary><div class="body">
      <div class="field" style="margin:0"><span>Kamera in der Animation</span><div class="seg" role="radiogroup" aria-label="Kamera">${CAM_MODES.map(([v, t]) => `<button type="button" role="radio" data-cam-mode="${v}" aria-checked="${m === v}">${t}</button>`).join('')}</div></div>
      <p class="tiny" style="margin:8px 0 0">${m === 'auto' ? 'Die Kamera zoomt automatisch auf Ball und Aktion, wie bei den eingebauten Übungen.' : m === 'manual' ? 'Du bestimmst den Ausschnitt für den gewählten Schritt. Der Zoom gleitet von Schritt zu Schritt.' : 'Der ganze Platz bleibt die ganze Zeit im Bild.'}</p>
      ${m === 'manual' ? `<div class="row" style="margin-top:8px"><div class="seg" role="radiogroup" aria-label="Zoom">${ZOOMS.map(([v, t]) => `<button type="button" role="radio" data-cam-zoom="${v}" aria-checked="${v === 1 ? !fr.cam : fr.cam?.s === v}">${t}</button>`).join('')}</div>${fr.cam ? `<button class="btn sm ${camPick ? 'primary' : ''}" type="button" id="ed-cam-pick" aria-pressed="${camPick}">${camPick ? 'Antippen auf dem Platz …' : 'Fokus verschieben'}</button>` : ''}</div>` : ''}
      ${many && frame ? `<label class="coach-toggle" style="margin-top:10px"><input type="checkbox" id="ed-loft" ${fr.loft ? 'checked' : ''}><span>Flugball <small class="tiny">Der Ball fliegt in diesem Schritt im Bogen.</small></span></label>` : ''}
    </div></details>`;
  }
  b.addEventListener('toggle', ev => { if (ev.target.id === 'ed-cam-d') camOpen = ev.target.open; }, true);
  on(b, 'click', '[data-cam-mode]', (_, x) => { snapshot(); sk.camera = x.dataset.camMode; camPick = false; haptic('tap'); paint(); });
  on(b, 'click', '[data-cam-zoom]', (_, x) => {
    const v = Number(x.dataset.camZoom), fr = sk.frames[frame]; snapshot(); haptic('tap');
    if (v === 1) { delete fr.cam; camPick = false; }
    else { const c = fr.cam || { x: Math.round(focusGuess()[0]), y: Math.round(focusGuess()[1]) }; fr.cam = { x: c.x, y: c.y, s: Math.min(v, ZOOM_MAX) }; }
    paint(); svg.scrollIntoView({ block: 'nearest' });
  });
  on(b, 'click', '#ed-cam-pick', () => { camPick = !camPick; paint(); if (camPick) svg.scrollIntoView({ block: 'nearest' }); });
  on(b, 'change', '#ed-loft', (_, x) => { snapshot(); if (x.checked) sk.frames[frame].loft = true; else delete sk.frames[frame].loft; });

  // ---- Vorschau mit dem echten Player (gleiche Kamera und Spuren wie in der Übungsansicht)
  function openPreview() {
    const anim = deepClone(sk); anim.frames.forEach((fr, i) => { fr.caption = fr.caption.trim() || (i ? `Schritt ${i + 1}` : 'Aufbau'); });
    if (!validAnimation(anim) || anim.frames.length < 2) return toast('Für die Vorschau mindestens zwei Schritte anlegen.');
    const ex = { id: 'preview-' + e.id, name: f.name.value.trim() || 'Vorschau', custom: true, type: 'field', tag: 'Passspiel', description: 'Vorschau', animation: anim, equipment: [], ages: [], min: 1, max: 1, minutes: 1 };
    let player = null;
    const sh = openSheet({
      title: 'Vorschau', className: 'ed-preview-sheet',
      body: `<div id="ed-prev" class="detail-scene"></div><ol class="steps ed-prev-steps" id="ed-prev-steps"></ol>`,
      foot: `<button class="btn" type="button" data-close>Schließen</button><button class="btn primary" type="button" id="ed-prev-play">${icon('start')} Abspielen</button>`,
      onClose: () => player?.destroy(),
    });
    const btn = $('#ed-prev-play', sh.dialog), list = $('#ed-prev-steps', sh.body);
    const fill = () => { list.innerHTML = player.steps.map((t, i) => `<li class="${i === player.step ? 'current' : ''}">${esc(t)}</li>`).join(''); };
    player = mountPlayer($('#ed-prev', sh.body), ex, { camera: true, loop: true, onStep: fill, onState: st => { btn.innerHTML = st === 'run' ? `${icon('pause')} Pause` : st === 'static' ? `${icon('next')} Nächster Schritt` : `${icon('start')} Abspielen`; } });
    fill();
    btn.onclick = () => { if (player.animated) player.toggle(); else player.goStep((player.step + 1) % player.steps.length); };
    if (player.animated) setTimeout(() => { if (sh.dialog.isConnected && player.state === 'pause') player.play(); }, 350);
  }

  // ---- Tabs (Handy): Skizze und Angaben getrennt, Desktop zeigt beides
  const showTab = t => { f.dataset.tab = t; $$('[data-ed-tab]', b).forEach(x => x.setAttribute('aria-selected', String(x.dataset.edTab === t))); };
  on(b, 'click', '[data-ed-tab]', (_, x) => { showTab(x.dataset.edTab); haptic('tap'); b.scrollTo?.({ top: 0 }); });

  svg.addEventListener('pointerdown', ev => {
    if (ev.button > 0) return;
    const g = ev.target.closest('[data-i]'), [x, y] = pt(ev);
    if (camPick) { snapshot(); setCamCenter(x, y); drag = { cam: true, saved: true }; svg.setPointerCapture(ev.pointerId); paint(); return; }
    let i = g ? Number(g.dataset.i) : -1, added = false;
    if (i < 0 && tool === 'zone') { drag = { zone: true, x0: x, y0: y, x1: x, y1: y }; svg.setPointerCapture(ev.pointerId); paint(); return; }
    if (i < 0) { i = addItem(tool, Math.round(clamp(x, B.x0, B.x1)), Math.round(clamp(y, B.y0, B.y1))); added = true; if (i < 0) return; }
    const [px, py] = sk.frames[frame].points[i];
    sel = i; drag = { i, dx: px - x, dy: py - y, saved: added };
    svg.setPointerCapture(ev.pointerId);
    added ? changed() : paint();
  });
  svg.addEventListener('pointermove', ev => {
    if (!drag) return;
    const [x, y] = pt(ev);
    if (drag.zone) { drag.x1 = clamp(x, B.x0, B.x1); drag.y1 = clamp(y, B.y0, B.y1); paint(); return; }
    if (drag.cam) { setCamCenter(x, y); paint(); return; }
    if (!drag.saved) { snapshot(); drag.saved = true; }
    moveItem(drag.i, x + drag.dx, y + drag.dy); paint();
  });
  const endDrag = ev => {
    if (!drag) return;
    if (drag.zone) {
      const w = Math.round(Math.abs(drag.x1 - drag.x0)), h = Math.round(Math.abs(drag.y1 - drag.y0));
      const cx = Math.round(clamp((drag.x0 + drag.x1) / 2, B.x0, B.x1)), cy = Math.round(clamp((drag.y0 + drag.y1) / 2, B.y0, B.y1));
      drag = null;
      if (w >= 12 && h >= 12) { const i = addItem('zone', cx, cy, { w, h }); if (i >= 0) sel = i; }
      else { const i = addItem('zone', cx, cy); if (i >= 0) sel = i; } // Tippen setzt eine Standard-Zone
      changed(); return;
    }
    drag = null; paint();
  };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('keydown', ev => {
    const g = ev.target.closest('[data-i]'); if (!g) return;
    const i = Number(g.dataset.i), d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[ev.key];
    if (d) { ev.preventDefault(); snapshot(); const [x, y] = sk.frames[frame].points[i]; moveItem(i, x + d[0], y + d[1]); sel = i; paint(); $(`[data-i="${i}"]`, svg)?.focus(); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeItem(i); svg.focus(); }
  });
  on(b, 'click', '[data-tool]', (_, x) => { tool = x.dataset.tool; sel = -1; camPick = false; haptic('tap'); paint(); });
  on(b, 'click', '#ed-del', () => { if (sel >= 0) removeItem(sel); });
  on(b, 'click', '#ed-dup', () => {
    if (sel < 0) return; const src = sk.items[sel], [x, y] = sk.frames[frame].points[sel];
    const i = addItem(src.k, Math.round(clamp(x + 16, B.x0, B.x1)), Math.round(clamp(y + 12, B.y0, B.y1)), src); if (i < 0) return; sel = i; changed();
  });
  on(b, 'click', '[data-frame]', (_, x) => { frame = Number(x.dataset.frame); sel = -1; paint(); });
  on(b, 'click', '#ed-fadd', () => {
    if (sk.frames.length >= 20) return toast('Maximal 20 Schritte.');
    snapshot(); sk.frames.splice(frame + 1, 0, { ...deepClone(sk.frames[frame]), caption: '' }); frame++; sel = -1; haptic('tap'); paint();
    $('#ed-cap', b)?.focus({ preventScroll: true });
  });
  on(b, 'click', '#ed-fdel', () => { if (!frame) return; snapshot(); sk.frames.splice(frame, 1); frame = Math.min(frame, sk.frames.length - 1); paint(); });
  on(b, 'click', '[data-tempo]', (_, x) => { sk.frames.forEach(fr => { fr.seconds = Number(x.dataset.tempo); }); paint(); });
  on(b, 'click', '#ed-undo', undoSketch);
  on(b, 'click', '#ed-clear', () => { snapshot(); sk = emptySk(); frame = 0; sel = -1; changed(); toast('Skizze geleert.', { action: 'Rückgängig', onAction: undoSketch }); });
  on(b, 'input', '#ed-cap', (_, x) => { sk.frames[frame].caption = x.value; });
  on(b, 'click', '#ed-fplay', () => openPreview());
  $('#ed-tpl', b).onclick = () => openSheet({
    title: 'Vorlage wählen',
    body: `<p class="small muted">Setzt einen fertigen Aufbau. Danach frei anpassen. Rückgängig möglich.</p><div class="tpl-grid">${Object.keys(TEMPLATES).map(n => {
      const t = TEMPLATES[n], items = t.items.map(([k]) => ({ k })), labels = sketchLabels(items);
      return `<button class="tpl" type="button" data-tpl="${esc(n)}"><svg viewBox="0 0 320 190" aria-hidden="true">${SKETCH_FIELD}${t.items.map(([k, x, y], i) => sketchItem(k, x, y, labels[i])).join('')}</svg><strong>${esc(n)}</strong>${t.moves ? '<small class="tiny">mit Bewegung</small>' : ''}</button>`;
    }).join('')}</div>`,
    onMount: sh => on(sh.body, 'click', '[data-tpl]', (_, x) => { sh.close(); applyTemplate(x.dataset.tpl); }),
  });

  // ---- Spieler pro Gruppe
  const num = n => Number(f[n].value);
  on(b, 'click', '[data-step]', (_, x) => { const n = x.dataset.step, v = clamp((num(n) || 0) + Number(x.dataset.d), 1, 100); f[n].value = v; peopleTouched = true; fixPeople(n); haptic('tap'); });
  const flowUi = () => { $('#ed-flow-help', b).textContent = FLOW_HELP[f.flow.value]; $('#ed-pp-title', b).textContent = { group: 'Spieler pro Gruppe', queue: 'Spieler aktiv je Station', open: 'Spieler: mindestens bis Platz für' }[f.flow.value]; };
  f.flow.addEventListener('change', flowUi); flowUi();
  ['min', 'max'].forEach(n => f[n].addEventListener('input', () => { peopleTouched = true; }));
  ['min', 'max'].forEach(n => f[n].addEventListener('change', () => fixPeople(n)));
  function fixPeople(changedField) {
    const lo = num('min'), hi = num('max');
    if (integer(lo, 1, 100) && integer(hi, 1, 100) && hi < lo) f[changedField === 'min' ? 'max' : 'min'].value = changedField === 'min' ? lo : hi;
    paintPeopleHint();
  }
  function paintPeopleHint() {
    const n = players();
    $('#ed-pp-hint', b).textContent = !n ? '' : peopleTouched ? (n > num('max') ? `Hinweis: In der Skizze stehen ${n} Spieler.` : '') : `Aus der Skizze übernommen (${n} Spieler). Mit − / + anpassen.`;
  }

  // ---- Material
  function paintMat() {
    $('#ed-mat', b).innerHTML = matNames.map(n => {
      const c = mat.get(n) || 0;
      return `<div class="mat ${c ? 'on' : ''}" data-mat="${esc(n)}"><button type="button" class="mat-toggle" aria-pressed="${!!c}"><span aria-hidden="true">${materialType(n)[1]}</span><span class="grow">${esc(n)}</span>${c ? `<b>${c}</b>` : ''}</button>${c ? `<span class="mat-count"><button type="button" data-mat-d="-1" aria-label="${esc(n)} weniger">−</button><button type="button" data-mat-d="1" aria-label="${esc(n)} mehr">+</button></span>` : ''}</div>`;
    }).join('');
  }
  const matDefault = n => MATERIALS.find(m => m[0] === n)?.[1] || 1;
  on(b, 'click', '.mat-toggle', (_, x) => { const n = x.closest('[data-mat]').dataset.mat; mat.get(n) ? mat.delete(n) : mat.set(n, matDefault(n)); haptic('tap'); paintMat(); });
  on(b, 'click', '[data-mat-d]', (_, x) => { const n = x.closest('[data-mat]').dataset.mat, v = (mat.get(n) || 0) + Number(x.dataset.matD); v > 0 ? mat.set(n, Math.min(v, 100)) : mat.delete(n); paintMat(); });
  const addMat = () => {
    const inp = $('#ed-mat-new', b), n = inp.value.trim(); if (!n) return;
    const known = matNames.find(k => k.toLowerCase() === n.toLowerCase());
    if (!known && matNames.length >= 30) return toast('Maximal 30 Materialien.');
    if (!known) matNames.push(n);
    mat.set(known || n, mat.get(known || n) || 1); inp.value = ''; paintMat();
  };
  $('#ed-mat-add', b).onclick = addMat;
  $('#ed-mat-new', b).addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); addMat(); } });

  function syncFromSketch() {
    const c = counts();
    for (const [k, name, re] of SYNC) {
      if (!c[k]) continue;
      const n = matNames.find(x => re.test(x) && mat.get(x)) || matNames.find(x => re.test(x)) || name;
      if (!matNames.includes(n)) matNames.push(n);
      if ((mat.get(n) || 0) < c[k]) mat.set(n, c[k]);
    }
    const p = players();
    if (!peopleTouched && p) { f.min.value = p; f.max.value = Math.max(p, num('max') || p); }
    paintMat(); paintPeopleHint();
  }

  // ---- Schwerpunkte (Reihenfolge der Auswahl = Gewicht)
  const fsel = Array.isArray(e.focus) ? [...e.focus] : [];
  const paintFoci = () => {
    $('#ed-foci', b).innerHTML = focusPicker(fsel, { name: 'efocus', star: true });
    $('#ed-foci-hint', b).textContent = fsel.length ? `Gewählt: ${fsel.join(', ')}` : 'Noch keiner gewählt – dann zählt die Kategorie, sofern sie ein Schwerpunkt ist.';
  };
  on(b, 'click', '[data-efocus]', (_, btn) => {
    const k = btn.dataset.efocus, i = fsel.indexOf(k);
    if (i >= 0) fsel.splice(i, 1);
    else if (fsel.length >= MAX_FOCI) { toast(`Höchstens ${MAX_FOCI} Schwerpunkte – erst einen abwählen.`); haptic('warn'); return; }
    else fsel.push(k);
    haptic('tap'); paintFoci();
    $(`[data-efocus="${CSS.escape(k)}"]`, b)?.focus({ preventScroll: true });
  });

  // ---- Speichern
  f.onsubmit = ev => {
    ev.preventDefault(); err.textContent = '';
    const more = $('#ed-more', b), fail = (msg, field, open = false) => { err.textContent = msg; haptic('warn'); if (open) more.open = true; if (field && field !== f.name) showTab('details'); else if (!field && !open) showTab('sketch'); field?.focus?.(); err.scrollIntoView?.({ block: 'nearest' }); };
    const name = f.name.value.trim(), min = num('min'), max = num('max'), minutes = Number(f.minutes.value), url = f.url.value.trim();
    const eq = [...mat].filter(([, c]) => c > 0);
    if (!name) return fail('Bitte einen Namen eingeben.', f.name);
    if (!integer(min, 1, 100) || !integer(max, min, 100)) return fail('Spieler pro Gruppe: von 1–100, „bis“ mindestens „von“.', f.min);
    if (!eq.length) return fail('Bitte mindestens ein Material auswählen.', $('.mat-toggle', b));
    if (eq.length > 20 || eq.some(([n, c]) => !n || n.length > 100 || !integer(c, 1, 100))) return fail('Material: höchstens 20 Arten, je 1–100 Stück.');
    if (!integer(minutes, 1, 120)) return fail('Minuten: 1–120.', f.minutes, true);
    if (!safeURL(url)) return fail('Quelle muss mit https:// beginnen.', f.url, true);
    let animation;
    if (sk.items.length) {
      animation = deepClone(sk); animation.camera = sk.camera || 'auto';
      animation.frames.forEach((fr, i) => { fr.caption = fr.caption.trim() || (i ? `Schritt ${i + 1}` : 'Aufbau'); });
      if (!validAnimation(animation)) return fail('Platzskizze prüfen: höchstens 30 Elemente und 20 Schritte.');
    }
    const written = (animation?.frames || []).map(x => x.caption).filter(c => !/^(Aufbau|Schritt \d+)$/.test(c)).map(c => /[.!?]$/.test(c) ? c : c + '.');
    const description = (f.description.value.trim() || written.join(' ') || 'Aufbau und Ablauf siehe Platzskizze.').slice(0, 1000);
    const next = {
      ...e, name, tag: f.tag.value, type: f.type.value, flow: f.flow.value, ages: AGES.slice(AGES.indexOf(f.age.value)), min, max, minutes,
      description, coaching: f.coaching.value.trim() || DEFAULT_COACHING, equipment: eq, url, custom: true,
    };
    const goal = f.goal.value.trim(); if (goal) next.goal = goal; else delete next.goal;
    if (fsel.length) next.focus = [...fsel]; else delete next.focus;
    if (animation) next.animation = animation; else delete next.animation;
    const ids = new Set([...SEED.map(x => x.id), ...store.get().custom.filter(x => x.id !== next.id).map(x => x.id)]);
    if (!validCustom(next, ids)) return fail('Bitte Angaben prüfen.', null, true);
    store.update(old ? 'Eigene Übung geändert' : 'Eigene Übung angelegt', d => { const i = d.custom.findIndex(x => x.id === next.id); if (i >= 0) d.custom[i] = next; else d.custom.push(next); });
    sheet.close();
    undoToast(old ? 'Eigene Übung aktualisiert. Bestehende Blöcke bleiben erhalten.' : `„${next.name}“ gespeichert.`);
    if (!old) setTimeout(() => import('./detail.js').then(m => m.openDetail(next.id)), 250);
  };

  paintMat(); paint(); paintPeopleHint(); paintFoci();
  if (!exercise(store.get(), e.id) && !old && !matchMedia('(pointer: coarse)').matches) f.name.focus();
}
