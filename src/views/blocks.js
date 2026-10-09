// Block-Werkzeuge, die Heute und Planen gemeinsam nutzen: bearbeiten, tauschen, schnell hinzufügen.
import * as store from '../core/store.js';
import { exercise, effective, fit, currentPlan, allExercises, suits, score, blockPeople, planAge } from '../core/planning.js';
import { esc, integer, uid } from '../core/util.js';
import { openSheet } from '../ui/sheet.js';
import { icon, on } from '../ui/dom.js';
import { undoToast, addExercise, updatePlan, markUsed } from '../ui/actions.js';
import { toast } from '../ui/feedback.js';
import { drillPitch } from '../scene/pitch.js';

const groupText = (s, e, n) => { const g = fit(s, e, n), x = effective(s, e); return `${x.min === x.max ? x.min : `${x.min}–${x.max}`} Spieler pro Gruppe · ${g ? `${g} parallele ${g > 1 ? 'Gruppen' : 'Gruppe'}` : 'passt nicht in Gruppen – Zahl ändern'}`; };

/** Passende Alternativen für einen Block (gleiche Kategorie zuerst). */
export function alternatives(s, p, b, limit = 6) {
  const e = exercise(s, b.exerciseId), used = new Set(p.blocks.map(x => x.exerciseId)), n = blockPeople(p, b);
  return allExercises(s).filter(x => !used.has(x.id) && suits(s, p, x) && fit(s, x, n))
    .map(x => ({ x, d: (x.tag === e.tag ? 0 : 10) + (x.type === e.type ? 0 : 3) + Math.abs(effective(s, x).minutes - b.minutes) * .2 }))
    .sort((a, b2) => a.d - b2.d || a.x.name.localeCompare(b2.x.name)).slice(0, limit).map(o => o.x);
}

export function swapBlock(blockId, toId) {
  const s = store.get(), p = currentPlan(s), b = p?.blocks.find(x => x.id === blockId);
  if (!b) return;
  const next = toId ? exercise(s, toId) : alternatives(s, p, b, 1)[0];
  if (!next) { toast('Keine weitere passende Übung. Über „Hinzufügen“ manuell wählen.'); return; }
  updatePlan('Übung getauscht', (plan, d) => { const x = plan.blocks.find(y => y.id === blockId); x.exerciseId = next.id; markUsed(d, next.id); });
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
      <div class="row" style="margin-bottom:8px"><span class="tag ${e.type === 'keeper' ? 'keeper' : e.type === 'both' ? 'both' : ''}">${esc(e.tag)}</span><span class="tiny">Einheit: ${p.people} Spieler</span></div>
      <form id="be" novalidate>
        <div class="grid-2">
          <div class="field"><span>Minuten</span><div class="stepper"><button type="button" data-step="m" data-d="-1" aria-label="Eine Minute weniger">−</button><input name="minutes" type="number" inputmode="numeric" min="1" max="120" value="${b.minutes}" aria-label="Minuten"><button type="button" data-step="m" data-d="1" aria-label="Eine Minute mehr">+</button></div></div>
          <div class="field"><span>Spieler bei dieser Übung</span><div class="stepper"><button type="button" data-step="p" data-d="-1" aria-label="Ein Spieler weniger">−</button><input name="people" type="number" inputmode="numeric" min="1" max="100" value="${blockPeople(p, b)}" aria-label="Spieler"><button type="button" data-step="p" data-d="1" aria-label="Ein Spieler mehr">+</button></div></div>
        </div>
        <p class="small muted" id="be-hint" aria-live="polite"></p>
        <label class="field"><span>Notiz zu diesem Block (optional)</span><input class="input" name="note" maxlength="300" value="${esc(b.note || '')}" placeholder="z. B. Feld B, Leibchen rot"></label>
        <p class="error" id="be-err" role="alert"></p>
        <div class="row"><button class="btn sm" type="button" id="be-same">Wie in der Einheit (${p.people})</button><button class="btn sm" type="button" id="be-detail">${icon('info')} Übung ansehen</button></div>
      </form>
      ${alts.length ? `<h3 style="margin:20px 0 8px">Tauschen gegen</h3><div class="stack">${alts.map(x => `<button class="mini-drill" type="button" data-swap="${esc(x.id)}">${drillPitch(x)}<span><strong>${esc(x.name)}</strong><br><small>${esc(x.tag)} · ${effective(s, x).minutes} Min</small></span></button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:20px"><button class="btn sm" type="button" id="be-dup">${icon('copy')} Duplizieren</button><button class="btn sm danger" type="button" id="be-del">${icon('trash')} Entfernen</button></div>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="be">Speichern</button>`,
    onMount(sh) {
      const f = sh.body.querySelector('#be');
      const hint = () => { const n = Number(f.people.value); sh.body.querySelector('#be-hint').textContent = integer(n, 1, 100) ? groupText(store.get(), e, n) + (n === p.people ? ' · wie in der Einheit' : '') : '1–100 Spieler eintragen.'; };
      hint();
      f.people.addEventListener('input', hint);
      on(sh.body, 'click', '[data-step]', (_, btn) => { const inp = btn.dataset.step === 'm' ? f.minutes : f.people, max = btn.dataset.step === 'm' ? 120 : 100; inp.value = Math.min(max, Math.max(1, (Number(inp.value) || 0) + Number(btn.dataset.d))); hint(); });
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
  updatePlan('Übung entfernt', plan => { plan.blocks = plan.blocks.filter(x => x.id !== blockId); });
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

/** Kleines Sheet: passende Vorschläge + Suche, ohne in die Bibliothek zu wechseln. */
export function openAddSheet() {
  const s = store.get(), p = currentPlan(s);
  let q = '';
  const list = () => {
    const st = store.get(), plan = currentPlan(st), used = new Set(plan.blocks.map(b => b.exerciseId));
    const ql = q.toLowerCase();
    return allExercises(st).filter(e => !used.has(e.id) && (ql ? `${e.name} ${e.tag} ${e.description}`.toLowerCase().includes(ql) : suits(st, plan, e) && fit(st, e, plan.people)))
      .map(e => ({ e, sc: score(st, plan, e) })).sort((a, b) => b.sc.pts - a.sc.pts || a.e.name.localeCompare(b.e.name)).slice(0, 12);
  };
  const paint = sh => {
    const items = list();
    sh.body.querySelector('#add-list').innerHTML = items.length ? items.map(({ e, sc }) => `<button class="mini-drill" type="button" data-add="${esc(e.id)}">${drillPitch(e)}<span><strong>${esc(e.name)}</strong><br><small>${esc(e.tag)} · ${effective(store.get(), e).minutes} Min · ${esc(sc.reasons[0])}</small></span></button>`).join('') : '<p class="empty">Nichts gefunden. In der Bibliothek stehen alle Übungen.</p>';
  };
  openSheet({
    title: 'Übung hinzufügen',
    body: `<p class="small muted">Passend zu ${esc(planAge(s, p) || 'deiner Mannschaft')}, Trainerart und ${p.people} Spielern. Neue Blöcke kommen ans Ende.</p>
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
