// Block-Werkzeuge, die Heute und Planen gemeinsam nutzen: bearbeiten, tauschen, schnell hinzufügen.
import * as store from '../core/store.js';
import {
  exercise, effective, layout, layoutText, layoutAdvice, squadOf, squadLabel, flowOf, FLOW_LABEL, STATION_MAX, currentPlan, allExercises, suits, score, blockPeople, planAge, foci, focusOverlap,
  pauses, pauseEvery, timeline, slotOf, slotMinutes, totalMinutes, exerciseMinutes, fitBlocks, PAUSE_MAX, PAUSE_MINUTES,
} from '../core/planning.js';
import { focusChips } from '../ui/focus.js';
import { esc, integer, uid, sum } from '../core/util.js';
import { openSheet } from '../ui/sheet.js';
import { icon, on } from '../ui/dom.js';
import { undoToast, addExercise, updatePlan, markUsed } from '../ui/actions.js';
import { toast } from '../ui/feedback.js';
import { drillPitch } from '../scene/pitch.js';

/** Erklärung zur Verteilung eines Blocks bei `n` Spielern (Feld) und `stations` Schlangen. */
const groupText = (s, p, e, n, stations = 1) => {
  const x = effective(s, e), L = layout(s, e, squadOf(s, p, { people: n }), stations), flow = flowOf(e), range = x.min === x.max ? x.min : `${x.min}–${x.max}`;
  const lead = flow === 'queue' ? `Je Station ${range} Spieler aktiv` : flow === 'open' ? `Ab ${x.min} Spielern` : `${range} Spieler pro Gruppe`, adv = layoutAdvice(L);
  return `${lead} · ${L.level === 'no' ? `passt nicht: ${layoutText(L)}` : layoutText(L)}${adv && L.level !== 'no' ? ` · ${adv}` : ''}`;
};

/** Passende Alternativen für einen Block (gleiche Kategorie zuerst). */
export function alternatives(s, p, b, limit = 6) {
  const e = exercise(s, b.exerciseId), used = new Set(p.blocks.map(x => x.exerciseId)), sq = squadOf(s, p, b);
  return allExercises(s).filter(x => !used.has(x.id) && suits(s, p, x) && layout(s, x, sq).level !== 'no')
    .map(x => ({ x, d: (x.tag === e.tag ? 0 : 8) - focusOverlap(x, e) * 3 + (x.type === e.type ? 0 : 3) + Math.abs(effective(s, x).minutes - b.minutes) * .2 }))
    .sort((a, b2) => a.d - b2.d || a.x.name.localeCompare(b2.x.name)).slice(0, limit).map(o => o.x);
}

export function swapBlock(blockId, toId) {
  const s = store.get(), p = currentPlan(s), b = p?.blocks.find(x => x.id === blockId);
  if (!b) return;
  const next = toId ? exercise(s, toId) : alternatives(s, p, b, 1)[0];
  if (!next) { toast('Keine weitere passende Übung. Über „Hinzufügen“ manuell wählen.'); return; }
  updatePlan('Übung getauscht', (plan, d) => { const x = plan.blocks.find(y => y.id === blockId); x.exerciseId = next.id; delete x.stations; markUsed(d, next.id); });
  undoToast(`Getauscht gegen „${next.name}“. Blockzeit bleibt gleich.`);
}

export function openBlockEditor(blockId) {
  const s = store.get(), p = currentPlan(s), b = p?.blocks.find(x => x.id === blockId);
  if (!b) return;
  const e = exercise(s, b.exerciseId);
  const alts = alternatives(s, p, b, 4);
  openSheet({
    title: e.name,
    body: `
      <div class="row" style="margin-bottom:8px"><span class="tag ${e.type === 'keeper' ? 'keeper' : e.type === 'both' ? 'both' : ''}">${esc(e.tag)}</span>${focusChips(foci(e), { max: 3 })}<span class="tag">${esc(FLOW_LABEL[flowOf(e)])}</span><span class="tiny">Einheit: ${esc(squadLabel(p))}</span></div>
      <form id="be" novalidate>
        <div class="grid-2">
          <div class="field"><span>Minuten</span><div class="stepper"><button type="button" data-step="m" data-d="-1" aria-label="Eine Minute weniger">−</button><input name="minutes" type="number" inputmode="numeric" min="1" max="120" value="${b.minutes}" aria-label="Minuten"><button type="button" data-step="m" data-d="1" aria-label="Eine Minute mehr">+</button></div></div>
          <div class="field"><span>Spieler bei dieser Übung</span><div class="stepper"><button type="button" data-step="p" data-d="-1" aria-label="Ein Spieler weniger">−</button><input name="people" type="number" inputmode="numeric" min="1" max="100" value="${blockPeople(p, b)}" aria-label="Spieler"><button type="button" data-step="p" data-d="1" aria-label="Ein Spieler mehr">+</button></div></div>
        </div>
        ${flowOf(e) === 'queue' ? `<div class="field"><span>Schlangen (Stationen)</span><div class="stepper"><button type="button" data-step="s" data-d="-1" aria-label="Eine Schlange weniger">−</button><input name="stations" type="number" inputmode="numeric" min="1" max="${STATION_MAX}" value="${b.stations || 1}" aria-label="Schlangen"><button type="button" data-step="s" data-d="1" aria-label="Eine Schlange mehr">+</button></div></div>` : ''}
        <p class="small muted" id="be-hint" aria-live="polite"></p>
        <label class="field"><span>Notiz zu diesem Block (optional)</span><input class="input" name="note" maxlength="300" value="${esc(b.note || '')}" placeholder="z. B. Feld B, Leibchen rot"></label>
        <p class="error" id="be-err" role="alert"></p>
        <div class="row"><button class="btn sm" type="button" id="be-same">Wie in der Einheit (${p.people})</button><button class="btn sm" type="button" id="be-detail">${icon('info')} Übung ansehen</button></div>
      </form>
      ${alts.length ? `<h3 style="margin:20px 0 8px">Tauschen gegen</h3><div class="stack">${alts.map(x => `<button class="mini-drill" type="button" data-swap="${esc(x.id)}">${drillPitch(x)}<span><strong>${esc(x.name)}</strong><br><small>${esc(foci(x).slice(0, 2).join(' · ') || x.tag)} · ${effective(s, x).minutes} Min</small></span></button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:20px"><button class="btn sm" type="button" id="be-dup">${icon('copy')} Duplizieren</button><button class="btn sm danger" type="button" id="be-del">${icon('trash')} Entfernen</button></div>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="be">Speichern</button>`,
    onMount(sh) {
      const f = sh.body.querySelector('#be');
      const stations = () => (f.stations ? Math.min(STATION_MAX, Math.max(1, Number(f.stations.value) || 1)) : 1);
      const hint = () => { const n = Number(f.people.value); sh.body.querySelector('#be-hint').textContent = integer(n, 1, 100) ? groupText(store.get(), p, e, n, stations()) + (n === p.people ? ' · wie in der Einheit' : '') : '1–100 Spieler eintragen.'; };
      hint();
      f.people.addEventListener('input', hint);
      f.stations?.addEventListener('input', hint);
      on(sh.body, 'click', '[data-step]', (_, btn) => { const k = btn.dataset.step, inp = k === 'm' ? f.minutes : k === 's' ? f.stations : f.people, max = k === 'm' ? 120 : k === 's' ? STATION_MAX : 100; inp.value = Math.min(max, Math.max(1, (Number(inp.value) || 0) + Number(btn.dataset.d))); hint(); });
      sh.body.querySelector('#be-same').onclick = () => { f.people.value = p.people; hint(); };
      sh.body.querySelector('#be-detail').onclick = () => { sh.close(); import('./detail.js').then(m => m.openDetail(e.id)); };
      on(sh.body, 'click', '[data-swap]', (_, btn) => { sh.close(); swapBlock(blockId, btn.dataset.swap); });
      sh.body.querySelector('#be-dup').onclick = () => { sh.close(); updatePlan('Block dupliziert', plan => { const i = plan.blocks.findIndex(x => x.id === blockId); if (i >= 0 && plan.blocks.length < 100) plan.blocks.splice(i + 1, 0, { ...plan.blocks[i], id: uid() }); }); undoToast('Block dupliziert.'); };
      sh.body.querySelector('#be-del').onclick = () => { sh.close(); removeBlock(blockId); };
      f.onsubmit = ev => {
        ev.preventDefault();
        const m = Number(f.minutes.value), n = Number(f.people.value), note = f.note.value.trim();
        const err = sh.body.querySelector('#be-err');
        if (!integer(m, 1, 120)) { err.textContent = 'Minuten: 1–120.'; f.minutes.setAttribute('aria-invalid', 'true'); return; }
        if (!integer(n, 1, 100)) { err.textContent = 'Spieler: 1–100.'; f.people.setAttribute('aria-invalid', 'true'); return; }
        updatePlan('Block angepasst', plan => {
          const x = plan.blocks.find(y => y.id === blockId); if (!x) return;
          x.minutes = m;
          if (n === plan.people) delete x.people; else x.people = n;
          if (stations() > 1) x.stations = stations(); else delete x.stations;
          if (note) x.note = note; else delete x.note;
        });
        sh.close();
        undoToast('Übung angepasst.');
      };
    },
  });
}

export function removeBlock(blockId) {
  const s = store.get(), p = currentPlan(s), b = p?.blocks.find(x => x.id === blockId);
  if (!b) return;
  updatePlan('Übung entfernt', plan => {
    const i = plan.blocks.findIndex(x => x.id === blockId), at = plan.pauses?.after;
    // Feste Pause nach diesem Block bleibt an derselben Stelle (nach dem vorherigen Block)
    if (at?.includes(blockId)) plan.pauses.after = [...new Set(at.map(id => (id === blockId ? plan.blocks[i - 1]?.id : id)).filter(Boolean))];
    plan.blocks = plan.blocks.filter(x => x.id !== blockId);
  });
  undoToast(`„${exercise(s, b.exerciseId).name}“ entfernt.`);
}

export function changeMinutes(blockId, delta) {
  updatePlan('Blockzeit geändert', plan => { const x = plan.blocks.find(y => y.id === blockId); if (x) x.minutes = Math.min(120, Math.max(1, x.minutes + delta)); }, { reason: 'minutes' });
}

export function moveBlock(blockId, delta) {
  updatePlan('Reihenfolge geändert', plan => {
    const i = plan.blocks.findIndex(x => x.id === blockId), j = i + delta;
    if (i < 0 || j < 0 || j >= plan.blocks.length) return;
    [plan.blocks[i], plan.blocks[j]] = [plan.blocks[j], plan.blocks[i]];
  }, { reason: 'order' });
}

// ---------- Pausen ----------
const pauseText = (n, m) => (n ? `${n} ${n === 1 ? 'Pause' : 'Pausen'} · ${n * m} Min` : 'Keine Pausen');
/** Kurztext für Kopfzeilen: „2 Pausen · 4 Min“ oder Einladung zum Einplanen. */
export const pauseLabel = (s, p) => { const ps = pauses(s, p); return ps.length ? pauseText(ps.length, ps[0].minutes) : 'Pausen planen'; };

/** Pause eine Stelle früher/später legen. Danach gelten feste Positionen (bis „automatisch verteilen“). */
export function movePause(afterId, d) {
  const s = store.get(), p = currentPlan(s), at = pauses(s, p).map(x => x.afterId);
  const i = p.blocks.findIndex(b => b.id === afterId), j = i + d, to = p.blocks[j];
  if (i < 0 || !to || j >= p.blocks.length - 1 || at.includes(to.id)) return;
  updatePlan('Pause verschoben', plan => { plan.pauses = { count: at.length, minutes: plan.pauses.minutes, after: at.map(id => (id === afterId ? to.id : id)) }; }, { reason: 'order' });
}
export function removePause(afterId) {
  const s = store.get(), p = currentPlan(s), at = pauses(s, p).map(x => x.afterId).filter(id => id !== afterId);
  updatePlan('Pause entfernt', plan => { plan.pauses = at.length ? { count: at.length, minutes: plan.pauses.minutes, after: at } : { count: 0, minutes: plan.pauses.minutes }; });
  undoToast('Pause entfernt.');
}

/** Pausen einstellen: keine / automatisch / feste Anzahl, Dauer – mit Vorschau, wo sie landen, und Zeitcheck. */
export function openPauseSheet() {
  const s = store.get(), p = currentPlan(s); if (!p) return;
  const cur = p.pauses || { count: 0, minutes: 2 };
  const age = planAge(s, p);
  const f = { mode: cur.count === 'auto' ? 'auto' : cur.after || cur.count > 0 ? 'fix' : 'off', count: cur.after ? cur.after.length : integer(cur.count, 1, PAUSE_MAX) ? cur.count : 2, minutes: cur.minutes, keep: !!cur.after };
  const draft = () => (f.mode === 'off' ? { count: 0, minutes: f.minutes } : { count: f.mode === 'auto' ? 'auto' : f.count, minutes: f.minutes, ...(f.keep && f.mode === 'fix' && cur.after?.length === f.count ? { after: cur.after } : {}) });
  const paint = sh => {
    const st = store.get(), plan = { ...currentPlan(st), pauses: draft() }, ps = pauses(st, plan), tl = timeline(st, plan);
    const slot = slotOf(st, plan), avail = slotMinutes(slot), total = totalMinutes(plan, st), over = avail && total > avail;
    sh.body.querySelectorAll('[data-pm]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.pm === f.mode)));
    sh.body.querySelector('#pz-count').hidden = f.mode !== 'fix';
    sh.body.querySelector('#pz-cn').value = f.count; sh.body.querySelector('#pz-mn').value = f.minutes;
    sh.body.querySelector('#pz-mode-hint').textContent = f.mode === 'auto' ? `Für ${age || 'deine Mannschaft'} etwa alle ${pauseEvery(age)} Min Übungszeit eine Pause – passt sich an, wenn sich die Einheit ändert.` : f.mode === 'fix' ? (f.keep && draft().after ? 'Feste Stellen, von dir verschoben.' : 'Feste Anzahl, die Stellen sucht TRAINR passend aus.') : 'Trinken und Wechsel stecken dann in den Übungsminuten.';
    sh.body.querySelector('#pz-preview').innerHTML = !plan.blocks.length ? '<p class="small muted">Pausen erscheinen, sobald mindestens zwei Übungen im Plan sind.</p>'
      : ps.length ? `<div class="timeline">${tl.filter(x => x.pause).map(x => `<div class="tl-item pause-item" style="cursor:default"><span class="tl-time">${x.pause.label || `nach #${x.pause.index + 1}`}</span><span><strong>Pause nach „${esc(exercise(st, x.block.exerciseId).name)}“</strong><small>${esc(x.pause.why)}</small></span><span class="min">${x.pause.minutes}′</span></div>`).join('')}</div>`
      : `<p class="small muted">${f.mode === 'off' ? 'Keine Pausen eingeplant.' : plan.blocks.length < 2 ? 'Pausen liegen zwischen Übungen – dafür braucht es mindestens zwei.' : 'Die Einheit ist so kurz, dass keine Pause nötig ist.'}</p>`;
    const fitTo = over ? fitBlocks(st, plan, avail) : null;
    sh.body.querySelector('#pz-time').innerHTML = `<div class="row between small"><span>${exerciseMinutes(plan)} Min Übungen + ${sum(ps, x => x.minutes)} Min Pausen</span><strong class="${over ? 'block-warn' : ''}">${total}${avail ? ` von ${avail}` : ''} Min</strong></div>
      ${over ? `<label class="check-row" style="margin-top:8px"><input type="checkbox" id="pz-fit" ${f.fit ? 'checked' : ''} ${fitTo ? '' : 'disabled'}><span>${fitTo ? `Übungen verhältnisgleich kürzen, damit alles in ${avail} Min passt` : 'Zu wenig Zeit, um die Übungen passend zu kürzen'}</span></label>` : ''}`;
    const fit = sh.body.querySelector('#pz-fit'); if (fit) fit.onchange = ev => { f.fit = ev.target.checked; };
  };
  openSheet({
    title: 'Pausen',
    body: `<p class="small muted">Trinkpausen zwischen den Übungen. TRAINR verteilt sie gleichmäßig über die Einheit und legt sie bevorzugt hinter intensive Spielformen oder zwischen zwei Runden.</p>
      <div class="field"><span>Pausen</span><div class="seg" role="radiogroup" aria-label="Pausen">${[['off', 'Keine'], ['auto', 'Automatisch'], ['fix', 'Anzahl festlegen']].map(([k, t]) => `<button type="button" role="radio" data-pm="${k}">${t}</button>`).join('')}</div><small class="tiny" id="pz-mode-hint"></small></div>
      <div class="grid-2">
        <div class="field" id="pz-count"><span>Anzahl</span><div class="stepper"><button type="button" data-pz="count" data-d="-1" aria-label="Eine Pause weniger">−</button><input id="pz-cn" type="number" min="1" max="${PAUSE_MAX}" aria-label="Anzahl Pausen"><button type="button" data-pz="count" data-d="1" aria-label="Eine Pause mehr">+</button></div></div>
        <div class="field"><span>Minuten je Pause</span><div class="stepper"><button type="button" data-pz="minutes" data-d="-1" aria-label="Eine Minute kürzer">−</button><input id="pz-mn" type="number" min="${PAUSE_MINUTES[0]}" max="${PAUSE_MINUTES[1]}" aria-label="Minuten je Pause"><button type="button" data-pz="minutes" data-d="1" aria-label="Eine Minute länger">+</button></div></div>
      </div>
      <h3 style="margin:14px 0 6px">So landen sie im Ablauf</h3>
      <div id="pz-preview" aria-live="polite"></div>
      <div id="pz-time" class="card" style="margin-top:12px;padding:10px 12px"></div>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" id="pz-ok">Übernehmen</button>`,
    onMount(sh) {
      const b = sh.body, lim = { count: [1, PAUSE_MAX], minutes: PAUSE_MINUTES };
      const set = (k, v) => { const [a, z] = lim[k]; f[k] = Math.min(z, Math.max(a, Number(v) || a)); if (k === 'count') f.keep = false; paint(sh); };
      on(b, 'click', '[data-pm]', (_, x) => { f.mode = x.dataset.pm; if (f.mode !== 'fix') f.keep = false; paint(sh); });
      on(b, 'click', '[data-pz]', (_, x) => set(x.dataset.pz, f[x.dataset.pz] + Number(x.dataset.d)));
      b.querySelector('#pz-cn').onchange = ev => set('count', ev.target.value);
      b.querySelector('#pz-mn').onchange = ev => set('minutes', ev.target.value);
      sh.foot.querySelector('#pz-ok').onclick = () => {
        const cfg = draft(), st = store.get();
        const mins = f.fit && f.mode !== 'off' ? fitBlocks(st, { ...currentPlan(st), pauses: cfg }, slotMinutes(slotOf(st, currentPlan(st)))) : null;
        updatePlan('Pausen geändert', plan => { plan.pauses = cfg; if (mins) plan.blocks.forEach((x, i) => { x.minutes = mins[i]; }); });
        sh.close();
        undoToast(f.mode === 'off' ? 'Keine Pausen eingeplant.' : `${pauseLabel(store.get(), currentPlan(store.get()))} eingeplant${mins ? ', Übungen gekürzt' : ''}.`);
      };
      paint(sh);
    },
  });
}

/** Kleines Sheet: passende Vorschläge + Suche, ohne in die Bibliothek zu wechseln. */
export function openAddSheet() {
  const s = store.get(), p = currentPlan(s);
  let q = '';
  const list = () => {
    const st = store.get(), plan = currentPlan(st), used = new Set(plan.blocks.map(b => b.exerciseId));
    const ql = q.toLowerCase();
    return allExercises(st).filter(e => !used.has(e.id) && (ql ? `${e.name} ${e.tag} ${foci(e).join(' ')} ${e.description}`.toLowerCase().includes(ql) : suits(st, plan, e) && layout(st, e, squadOf(st, plan)).level !== 'no'))
      .map(e => ({ e, sc: score(st, plan, e) })).sort((a, b) => b.sc.pts - a.sc.pts || a.e.name.localeCompare(b.e.name)).slice(0, 12);
  };
  const paint = sh => {
    const items = list();
    sh.body.querySelector('#add-list').innerHTML = items.length ? items.map(({ e, sc }) => `<button class="mini-drill" type="button" data-add="${esc(e.id)}">${drillPitch(e)}<span><strong>${esc(e.name)}</strong><br><small>${esc(foci(e).slice(0, 2).join(' · ') || e.tag)} · ${effective(store.get(), e).minutes} Min · ${esc(sc.reasons[0])}</small></span></button>`).join('') : '<p class="empty">Nichts gefunden. In der Bibliothek stehen alle Übungen.</p>';
  };
  openSheet({
    title: 'Übung hinzufügen',
    body: `<p class="small muted">Passend zu ${esc(planAge(s, p) || 'deiner Mannschaft')}, Trainerart und ${esc(squadLabel(p))}. Neue Blöcke kommen ans Ende.</p>
      <div class="search" style="margin:8px 0 12px">${icon('search')}<input class="input" type="search" id="add-q" placeholder="Suchen …" aria-label="Übungen suchen"></div>
      <div class="stack" id="add-list"></div>`,
    foot: `<button class="btn" type="button" id="add-lib">${icon('grid')} Ganze Bibliothek</button><button class="btn" type="button" id="add-own">${icon('plus')} Eigene Übung</button>`,
    onMount(sh) {
      paint(sh);
      sh.body.querySelector('#add-q').addEventListener('input', ev => { q = ev.target.value.trim(); paint(sh); });
      on(sh.body, 'click', '[data-add]', (_, btn) => { addExercise(btn.dataset.add); btn.disabled = true; btn.style.opacity = .4; });
      sh.foot.querySelector('#add-lib').onclick = () => import('../ui/router.js').then(r => r.go('uebungen'));
      sh.foot.querySelector('#add-own').onclick = () => { sh.close(); import('./editor.js').then(m => m.openEditor()); };
    },
  });
}
