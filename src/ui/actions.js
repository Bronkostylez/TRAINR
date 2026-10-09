// Gemeinsame Aktionen mehrerer Ansichten. Jede Änderung ist rückgängig machbar.
import * as store from '../core/store.js';
import { uid, deepClone } from '../core/util.js';
import { exercise, effective, currentPlan, activeTeam } from '../core/planning.js';
import { LIMITS } from '../core/schema.js';
import { toast, haptic } from './feedback.js';

/** Nach einer Änderung: Toast mit „Rückgängig“. */
export function undoToast(msg) {
  haptic('tap');
  toast(msg, { action: 'Rückgängig', onAction: () => { const l = store.undo(); if (l) toast(`„${l}“ rückgängig gemacht.`); } });
}

/** Leere Einheit für die aktive Mannschaft (ohne Speichern). */
export function blankPlan(s, name = 'Neue Einheit') {
  const team = activeTeam(s), from = currentPlan(s);
  return { id: uid(), teamId: team?.id ?? null, name, people: from?.teamId === team?.id ? from.people : 12, slot: team?.slots[0]?.day ?? null, focus: 'Alle', notes: '', goal: '', blocks: [], date: null };
}

/** Sorgt dafür, dass eine Einheit der aktiven Mannschaft ausgewählt ist. */
export function ensurePlan() {
  const s = store.get(), p = currentPlan(s);
  if (p && !p.template && (p.teamId === s.activeTeamId || p.teamId === null)) return p;
  const own = s.plans.find(x => !x.template && x.teamId === s.activeTeamId);
  store.update('Einheit wählen', d => {
    if (own) d.selectedPlanId = own.id;
    else { const n = blankPlan(d, 'Meine Einheit'); d.plans.push(n); d.selectedPlanId = n.id; }
  }, { undo: false });
  return currentPlan(store.get());
}

export function markUsed(d, id) {
  const m = (d.exerciseMeta[id] ||= {});
  m.lastUsed = Date.now(); m.uses = (m.uses || 0) + 1;
}

/** Übung in die aktuelle Einheit (optional an Position). */
export function addExercise(id, { at = null, quiet = false } = {}) {
  const p = ensurePlan(), s = store.get(), e = exercise(s, id);
  if (!e) return false;
  if (p.blocks.length >= LIMITS.blocks) { toast(`Maximal ${LIMITS.blocks} Blöcke je Einheit.`); return false; }
  store.update(`„${e.name}“ hinzugefügt`, d => {
    const plan = d.plans.find(x => x.id === p.id);
    const b = { id: uid(), exerciseId: id, minutes: effective(d, e).minutes };
    if (at === null || at > plan.blocks.length) plan.blocks.push(b); else plan.blocks.splice(Math.max(0, at), 0, b);
    markUsed(d, id);
  });
  if (!quiet) undoToast(`„${e.name}“ ist in „${p.name}“.`);
  return true;
}

export function updatePlan(label, fn, opts) {
  const id = store.get().selectedPlanId;
  return store.update(label, d => { const p = d.plans.find(x => x.id === id); if (p) fn(p, d); }, opts);
}

export function duplicatePlan(id, { asTemplate = false, fromTemplate = false } = {}) {
  const s = store.get(), src = s.plans.find(p => p.id === id);
  if (!src) return null;
  if (s.plans.length >= LIMITS.plans) { toast(`Maximal ${LIMITS.plans} Einheiten.`); return null; }
  const copy = deepClone(src);
  copy.id = uid();
  copy.blocks.forEach(b => { b.id = uid(); });
  copy.template = asTemplate || undefined;
  if (copy.template === undefined) delete copy.template;
  if (fromTemplate) { copy.teamId = s.activeTeamId; copy.slot = activeTeam(s)?.slots[0]?.day ?? null; }
  copy.name = (asTemplate ? src.name : fromTemplate ? src.name : `${src.name} · Kopie`).slice(0, 80);
  copy.date = null;
  store.update(asTemplate ? 'Als Vorlage gespeichert' : 'Einheit kopiert', d => { d.plans.push(copy); if (!asTemplate) d.selectedPlanId = copy.id; });
  return copy;
}
