// Planassistent-Sheet (V22): mehrere Schwerpunkte als Chips, Rahmen in wenigen Taps,
// animierter Vorschlag mit Begründung, Quelle und Plan B je Block. Wird von „Heute“ und „Planen“ genutzt.
import * as store from '../core/store.js';
import {
  activeTeam, currentPlan, planAge, slotOf, slotMinutes, exercise, foci, focusMinutes,
  squadLabel, AGES, FOCI, AREAS, RELEVANT, MAX_FOCI,
} from '../core/planning.js';
import { propose, STRATEGIES } from '../core/assistant.js';
import { neglected } from '../core/calendar.js';
import { esc, uid, clamp, TYPE_SHORT } from '../core/util.js';
import { LIMITS } from '../core/schema.js';
import { icon, on, $ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { stagger } from '../ui/motion.js';
import { haptic, toast } from '../ui/feedback.js';
import { undoToast, updatePlan, blankPlan, markUsed } from '../ui/actions.js';
import { focusChips, focusSummary } from '../ui/focus.js';
import { openDetail } from './detail.js';

const MINUTE_PRESETS = [45, 60, 75, 90, 120];

/** Schwerpunkt-Chips nach Bereich, gefiltert auf die Trainerart; „lange nicht trainiert“ bekommt einen Punkt. */
export function pickerHtml(f, gaps, type) {
  const relevant = new Set(RELEVANT[type] || RELEVANT.field);
  return Object.entries(AREAS).map(([a, info]) => {
    const items = FOCI.filter(x => x.area === a && relevant.has(x.key) && x.key !== 'Falltechnik');
    if (!items.length) return '';
    return `<div class="fpick-group"><span class="tiny">${esc(info.label)}</span><div class="chips" role="group" aria-label="${esc(info.label)}">${items
      .map(x => `<button type="button" class="chip fchip-pick a-${a}" data-af="${esc(x.key)}" aria-pressed="${f.foci.includes(x.key)}" title="${esc(x.hint)}">${esc(x.key)}${gaps.includes(x.key) ? ' <span class="dot-gap" title="Lange nicht trainiert" aria-label="Lange nicht trainiert"></span>' : ''}</button>`).join('')}</div></div>`;
  }).join('');
}

/** Vorschlag als animierte Liste: Phase, Begründung, Quelle, Plan B zum Antippen. */
function proposalHtml(s, pr) {
  return `<div class="proposal" style="margin-top:12px">
    <div class="row between"><strong>${pr.minutes} Min${pr.pauseCount ? ` (inkl. ${pr.pauseCount} ${pr.pauseCount === 1 ? 'Pause' : 'Pausen'})` : ''} · ${esc(pr.age)} · ${esc(squadLabel(pr))}</strong><span class="tiny">${STRATEGIES[pr.strategy].name}</span></div>
    ${pr.notes.map(n => `<p class="notice">${esc(n)}</p>`).join('')}
    ${(() => { const fm = focusMinutes(pr.blocks.map(b => [exercise(s, b.exerciseId), b.minutes])); return fm.list.length ? `<div class="focus-strip" style="margin:8px 0"><details class="disclosure"><summary>Schwerpunkte im Vorschlag</summary><div class="body">${focusSummary(fm, { mark: pr.foci[0] || null, max: 5, link: false })}</div></details></div>` : ''; })()}
    ${pr.blocks.map((b, i) => { const e = exercise(s, b.exerciseId); return `<div class="proposal-item">
      <div class="row between"><span class="tag">${esc(b.phase)}</span><span class="tiny">${b.minutes} Min</span></div>
      <strong>${esc(e.name)}</strong><details class="disclosure proposal-details"><summary>Warum diese Übung? · Plan B</summary><div class="body">${focusChips(foci(e), { max: 3, mark: pr.foci.find(k => foci(e).includes(k)) || null })}<span class="why">${esc(b.why)}</span>
      <div class="alt-row"><button class="btn sm ghost" type="button" data-view-ex="${esc(e.id)}">${icon('info')} Ansehen</button>${e.url ? `<a class="btn sm ghost" href="${esc(e.url)}" target="_blank" rel="noopener" title="Quelle zur Übung öffnen">${icon('arrow')} Quelle</a>` : ''}${b.alternatives.map(a => { const ae = exercise(s, a); return ae ? `<button class="chip" type="button" data-alt="${esc(a)}" data-i="${i}" title="Plan B: Alternative wählen">${icon('swap')} ${esc(ae.name)}</button>` : ''; }).join('')}</div></div></details>
    </div>`; }).join('')}
    <p class="tiny">Ein Vorschlag, keine Belastungsvorgabe. Gruppen, Können, Helfer und Material vor Ort prüfen. ${pr.pauseCount ? 'Eingeplante Pausen verteilt TRAINR im Ablauf; Wechsel und Erklären stecken in den Übungsminuten.' : 'Trink- und Wechselpausen sind in den Minuten enthalten.'}</p></div>`;
}

/**
 * Öffnet den Planassistenten. `preset.foci` wählt Schwerpunkte vor (z. B. „lange nicht trainiert“).
 * `onApplied(planId, mode)` nach dem Übernehmen ('new' | 'replace').
 */
export function openAssistant({ preset = {}, onApplied, eventId = null } = {}) {
  const s0 = store.get(), team = activeTeam(s0), p = currentPlan(s0), slot = slotOf(s0, p);
  if (!team || !p) return;
  const event = eventId ? s0.events.find(e => e.id === eventId && e.teamId === team.id && e.kind === 'training' && e.status === 'geplant') : null;
  if (eventId && !event) return;
  if (event && s0.plans.some(p => p.id === event.planId)) return toast('Für diesen Termin ist bereits eine Einheit verknüpft.');
  const gaps = neglected(s0);
  const start = event ? (event.foci || []) : preset.foci?.length ? preset.foci : p.foci?.length ? p.foci : p.focus && p.focus !== 'Alle' ? [p.focus] : gaps.slice(0, 1);
  const f = {
    foci: [...new Set(start)].slice(0, MAX_FOCI),
    strategy: 'classic',
    minutes: clamp(preset.minutes || slotMinutes(slot) || 60, 20, 150),
    people: Math.min(60, p.people),
    keepers: Math.min(20, p.keepers || 0),
    coaches: p.coaches ?? 1,
    age: planAge(s0, p) || team.age,
    type: team.type,
    seed: Date.now() % 100000,
    pauses: { count: p.pauses?.after ? p.pauses.after.length : p.pauses?.count ?? 'auto', minutes: p.pauses?.minutes || 2 },
  };
  let pr = null;
  const run = sh => {
    const out = $('#as-out', sh.body);
    try {
      pr = propose(store.get(), f);
      out.innerHTML = proposalHtml(store.get(), pr);
      sh.foot.querySelectorAll('button').forEach(b => { b.disabled = false; });
      stagger(out.querySelectorAll('.proposal-item'));
    } catch (err) {
      pr = null;
      out.innerHTML = `<p class="notice warn" role="alert">${esc(err.message)}</p>`;
      sh.foot.querySelectorAll('[data-apply]').forEach(b => { b.disabled = true; });
    }
  };
  const planName = () => `${f.foci.length ? f.foci.join(' + ') : 'Abwechslungsreich'} · ${STRATEGIES[f.strategy].name}`.slice(0, 80);
  openSheet({
    title: 'Planassistent', wide: true, className: 'assistant-sheet',
    body: `${event ? `<div class="assistant-context"><strong>Trainingstag vorbereiten</strong><p class="tiny">${esc(event.date)} · ${esc(event.start)} - ${esc(event.end)}</p><p class="small">Fokus aus deinem Wochenplan. Wer ist heute da? Besetzung und Material vor Ort prüfen.</p>${preset.minutes < 20 || preset.minutes > 150 ? '<p class="notice">Der Assistent plant 20 bis 150 Minuten. Dauer für diesen Termin prüfen.</p>' : ''}</div>` : ''}<p class="small muted">Regelbasiert und nachvollziehbar – keine KI, keine Datenübertragung. ${esc(TYPE_SHORT[team.type])} · nie Falltechnik automatisch.</p>
      <div class="field"><span>Schwerpunkte <small class="tiny">bis zu ${MAX_FOCI} – verteilt auf die Phasen</small>${gaps.length ? ' <small class="tiny">· <span class="dot-gap" aria-hidden="true"></span> lange nicht trainiert</small>' : ''}</span>${pickerHtml(f, gaps, team.type)}</div>
      <div class="field"><span>Dauer <small class="tiny">inkl. Pausen</small></span><div class="chips" role="radiogroup" aria-label="Dauer">${MINUTE_PRESETS.map(m => `<button type="button" class="chip" role="radio" data-min="${m}" aria-checked="${f.minutes === m}">${m} Min</button>`).join('')}</div>
        <div class="stepper" style="max-width:220px"><button type="button" data-step-min="-5" aria-label="5 Minuten weniger">−</button><input id="as-min" type="number" min="20" max="150" value="${f.minutes}" aria-label="Minuten"><button type="button" data-step-min="5" aria-label="5 Minuten mehr">+</button></div></div>
      <div class="grid-2">
        <div class="field"><span>${team.type === 'keeper' ? 'Torwarte' : 'Spieler'}</span><div class="stepper"><button type="button" data-step="people" data-d="-1" aria-label="Weniger">−</button><input id="as-people" type="number" min="1" max="60" value="${f.people}" aria-label="${team.type === 'keeper' ? 'Torwarte' : 'Spieler'}"><button type="button" data-step="people" data-d="1" aria-label="Mehr">+</button></div></div>
        ${team.type === 'keeper' ? '' : `<div class="field"><span>Torwarte</span><div class="stepper"><button type="button" data-step="keepers" data-d="-1" aria-label="Weniger">−</button><input id="as-keepers" type="number" min="0" max="20" value="${f.keepers}" aria-label="Torwarte"><button type="button" data-step="keepers" data-d="1" aria-label="Mehr">+</button></div></div>`}
      </div>
      <details class="disclosure assistant-options"><summary>Rahmen anpassen</summary><div class="body">      <div class="field"><span>Altersklasse</span><div class="chips" role="radiogroup" aria-label="Altersklasse">${AGES.map(a => `<button type="button" class="chip" role="radio" data-age="${esc(a)}" aria-checked="${f.age === a}">${esc(a)}</button>`).join('')}</div></div>
      <div class="field"><span>Strategie</span><div class="seg" role="radiogroup" aria-label="Strategie">${Object.entries(STRATEGIES).map(([k, v]) => `<button type="button" role="radio" data-st="${k}" aria-checked="${f.strategy === k}">${v.name}</button>`).join('')}</div><small class="tiny" id="as-why">${esc(STRATEGIES[f.strategy].short)} · ${esc(STRATEGIES[f.strategy].why)}</small></div>
</div></details>
      <details class="disclosure"><summary><span class="grow">Feintuning: Pausen${team.type === 'keeper' ? '' : ', Trainer'}</span></summary><div class="body"><div class="grid-2">
        <label class="field"><span>Pausen</span><select class="input" id="as-pz">${[['0', 'Keine'], ['auto', 'Automatisch'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']].map(([v, t]) => `<option value="${v}" ${String(f.pauses.count) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field"><span>Minuten je Pause</span><input class="input" id="as-pzm" type="number" min="1" max="15" value="${f.pauses.minutes}"></label>
        ${team.type === 'keeper' ? '' : `<label class="field"><span>Trainer</span><input class="input" id="as-coaches" type="number" min="0" max="10" value="${f.coaches}"></label>`}
      </div></div></details>
      <div id="as-out" aria-live="polite"></div>`,
    foot: `<button class="btn" type="button" id="as-reroll">${icon('dice')} Neu würfeln</button>${event ? '' : '<button class="btn" type="button" data-apply="replace">Ablauf ersetzen</button>'}<button class="btn primary" type="button" data-apply="new">${icon('sparkles')} ${event ? 'Einheit für Termin' : 'Als neue Einheit'}</button>`,
    onMount: sh => {
      const b = sh.body;
      if (event) { const squad = b.querySelector('.grid-2'); b.querySelector('.assistant-context').after(squad); }
      on(b, 'click', '[data-af]', (_, x) => {
        const k = x.dataset.af;
        if (f.foci.includes(k)) f.foci = f.foci.filter(y => y !== k);
        else if (f.foci.length >= MAX_FOCI) { toast(`Höchstens ${MAX_FOCI} Schwerpunkte – sonst wird die Einheit beliebig.`); return; }
        else f.foci = [...f.foci, k];
        x.setAttribute('aria-pressed', String(f.foci.includes(k)));
        haptic('tap'); run(sh);
      });
      on(b, 'click', '[data-age]', (_, x) => { f.age = x.dataset.age; b.querySelectorAll('[data-age]').forEach(y => y.setAttribute('aria-checked', String(y === x))); run(sh); });
      on(b, 'click', '[data-min]', (_, x) => { f.minutes = Number(x.dataset.min); $('#as-min', b).value = f.minutes; b.querySelectorAll('[data-min]').forEach(y => y.setAttribute('aria-checked', String(Number(y.dataset.min) === f.minutes))); run(sh); });
      on(b, 'click', '[data-step-min]', (_, x) => { f.minutes = clamp(f.minutes + Number(x.dataset.stepMin), 20, 150); $('#as-min', b).value = f.minutes; b.querySelectorAll('[data-min]').forEach(y => y.setAttribute('aria-checked', String(Number(y.dataset.min) === f.minutes))); run(sh); });
      $('#as-min', b).onchange = ev => { f.minutes = clamp(Number(ev.target.value) || 60, 20, 150); ev.target.value = f.minutes; b.querySelectorAll('[data-min]').forEach(y => y.setAttribute('aria-checked', String(Number(y.dataset.min) === f.minutes))); run(sh); };
      on(b, 'click', '[data-step]', (_, x) => {
        const k = x.dataset.step, [lo, hi] = k === 'people' ? [1, 60] : [0, 20];
        f[k] = clamp(f[k] + Number(x.dataset.d), lo, hi);
        $(k === 'people' ? '#as-people' : '#as-keepers', b).value = f[k]; run(sh);
      });
      $('#as-people', b).onchange = ev => { f.people = clamp(Number(ev.target.value) || 12, 1, 60); ev.target.value = f.people; run(sh); };
      if ($('#as-keepers', b)) $('#as-keepers', b).onchange = ev => { f.keepers = clamp(Math.round(Number(ev.target.value)) || 0, 0, 20); ev.target.value = f.keepers; run(sh); };
      if ($('#as-coaches', b)) $('#as-coaches', b).onchange = ev => { f.coaches = clamp(Math.round(Number(ev.target.value)) || 0, 0, 10); ev.target.value = f.coaches; run(sh); };
      on(b, 'click', '[data-st]', (_, x) => { f.strategy = x.dataset.st; b.querySelectorAll('[data-st]').forEach(y => y.setAttribute('aria-checked', String(y === x))); $('#as-why', b).textContent = `${STRATEGIES[f.strategy].short} · ${STRATEGIES[f.strategy].why}`; run(sh); });
      $('#as-pz', b).onchange = ev => { f.pauses.count = ev.target.value === 'auto' ? 'auto' : Number(ev.target.value); run(sh); };
      $('#as-pzm', b).onchange = ev => { f.pauses.minutes = clamp(Number(ev.target.value) || 2, 1, 15); ev.target.value = f.pauses.minutes; run(sh); };
      $('#as-reroll', sh.foot).onclick = () => { f.seed = Math.floor(Math.random() * 1e6); run(sh); haptic('tap'); };
      on(b, 'click', '[data-alt]', (_, x) => { const i = Number(x.dataset.i), blk = pr.blocks[i], old = blk.exerciseId; blk.exerciseId = x.dataset.alt; blk.alternatives = blk.alternatives.map(a => (a === x.dataset.alt ? old : a)); blk.why = `${blk.phase}: von dir gewählte Alternative`; $('#as-out', b).innerHTML = proposalHtml(store.get(), pr); haptic('tap'); });
      on(b, 'click', '[data-view-ex]', (_, x) => openDetail(x.dataset.viewEx));
      on(sh.foot, 'click', '[data-apply]', (_, x) => {
        if (!pr) return;
        const liveEvent = eventId && store.get().events.find(e => e.id === eventId);
        if (eventId && (!liveEvent || liveEvent.status !== 'geplant' || liveEvent.teamId !== store.get().activeTeamId || liveEvent.teamId !== team.id || liveEvent.date !== event.date || liveEvent.start !== event.start || liveEvent.end !== event.end || store.get().plans.some(p => p.id === liveEvent.planId))) return toast('Termin nicht mehr verfügbar.');
        const blocks = pr.blocks.map(bb => ({ id: uid(), exerciseId: bb.exerciseId, minutes: bb.minutes, why: bb.why.slice(0, 300), alternatives: bb.alternatives.slice(0, 3) }));
        if (x.dataset.apply === 'new') {
          if (store.get().plans.length >= LIMITS.plans) return toast(`Maximal ${LIMITS.plans} Einheiten.`);
          const n = { ...blankPlan(store.get(), planName()), people: f.people, ...(f.keepers && team.type !== 'keeper' ? { keepers: f.keepers } : {}), ...(f.coaches !== 1 ? { coaches: f.coaches } : {}), focus: pr.focus, blocks, notes: pr.notes.join(' '), pauses: pr.pauses || { count: 0, minutes: f.pauses.minutes } };
          if (event) { n.date = event.date; n.slot = (new Date(event.date + 'T12:00').getDay() + 6) % 7; }
          if (f.foci.length > 1) n.foci = f.foci;
          if (f.age !== team.age) n.age = f.age;
          store.update('Vorschlag als neue Einheit', d => { d.plans.push(n); d.selectedPlanId = n.id; if (eventId) d.events.find(e => e.id === eventId).planId = n.id; blocks.forEach(bb => markUsed(d, bb.exerciseId)); });
          undoToast(`„${n.name}“ erstellt. Bestehende Einheiten bleiben erhalten.`);
          if (pr.notes.length) toast(pr.notes[0]);
        } else {
          updatePlan('Vorschlag übernommen', (x2, d) => { x2.blocks = blocks; x2.people = f.people; if (f.keepers && team.type !== 'keeper') x2.keepers = f.keepers; else delete x2.keepers; if (f.coaches !== 1) x2.coaches = f.coaches; else delete x2.coaches; x2.focus = pr.focus; if (f.foci.length > 1) x2.foci = f.foci; else delete x2.foci; x2.pauses = pr.pauses || { count: 0, minutes: f.pauses.minutes }; if (f.age !== team.age) x2.age = f.age; else delete x2.age; blocks.forEach(bb => markUsed(d, bb.exerciseId)); });
          undoToast('Vorschlag übernommen. Rückgängig stellt den alten Ablauf wieder her.');
        }
        haptic('ok');
        onApplied?.(x.dataset.apply);
        sh.close();
      });
      run(sh);
    },
  });
}
