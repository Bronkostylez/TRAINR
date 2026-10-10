// Download, Web-Share und teilbare Plan-Dateien (.trainr.json). Kein Server, keine Links nach außen.
import * as store from '../core/store.js';
import { exercise, activeTeam, remapPauses } from '../core/planning.js';
import { validCustom, validPauses } from '../core/schema.js';
import { SEED } from '../data/drills.js';
import { uid, slug, fileDate, deepClone, APP_VERSION, text as isText } from '../core/util.js';
import { toast } from '../ui/feedback.js';
import { undoToast } from '../ui/actions.js';

export function downloadBlob(name, body, type) {
  const blob = body instanceof Blob ? body : new Blob([body], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Teilt Dateien über das System-Teilen-Menü; sonst Download. Gibt 'shared' | 'downloaded' | 'cancelled' zurück. */
export async function shareFiles(files, { title, text } = {}) {
  try {
    if (navigator.canShare?.({ files })) { await navigator.share({ files, title, text }); return 'shared'; }
  } catch (err) { if (err?.name === 'AbortError') return 'cancelled'; }
  for (const f of files) downloadBlob(f.name, f, f.type);
  toast(files.length > 1 ? 'Teilen nicht verfügbar – Dateien heruntergeladen.' : 'Teilen nicht verfügbar – Datei heruntergeladen.');
  return 'downloaded';
}

export async function shareText(title, body) {
  try { if (navigator.share) { await navigator.share({ title, text: body }); return; } } catch (err) { if (err?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(body); toast('In die Zwischenablage kopiert.'); }
  catch { downloadBlob(`${slug(title)}.txt`, body, 'text/plain;charset=utf-8'); toast('Als Textdatei heruntergeladen.'); }
}

/** Einheit als Datei, inkl. der darin verwendeten eigenen Übungen. */
export function planFile(planId) {
  const s = store.get(), p = s.plans.find(x => x.id === planId);
  const ids = new Set(p.blocks.map(b => b.exerciseId));
  const custom = s.custom.filter(e => ids.has(e.id)).map(deepClone);
  const plan = deepClone(p); delete plan.teamId; delete plan.template;
  return { kind: 'trainr-plan', version: 1, app: 'TRAINR', appVersion: APP_VERSION, exportedAt: new Date().toISOString(), plan, custom };
}

export async function sharePlanFile(planId) {
  const data = planFile(planId), name = `${slug(data.plan.name)}-${fileDate()}.trainr.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
  const r = await shareFiles([file], { title: `TRAINR · ${data.plan.name}` });
  if (r !== 'cancelled') toast('Andere können die Datei unter „Mehr → Backup / Datei importieren“ öffnen.');
}

/** Geteilte Einheit importieren – ergänzt, ersetzt nie bestehende Daten. */
export function importSharedPlan(obj) {
  if (obj.kind !== 'trainr-plan' || obj.version !== 1 || !obj.plan || !Array.isArray(obj.plan.blocks) || !Array.isArray(obj.custom)) throw new Error('Keine gültige TRAINR-Einheit.');
  if (obj.custom.length > 100 || obj.plan.blocks.length > 100) throw new Error('Datei zu groß.');
  const s = store.get(), team = activeTeam(s);
  if (!team) throw new Error('Zuerst eine Mannschaft anlegen.');
  const seedIds = new Set(SEED.map(e => e.id)), remap = new Map(), addCustom = [];
  const known = new Set([...seedIds, ...s.custom.map(e => e.id)]);
  for (const c of obj.custom) {
    const mine = s.custom.find(e => e.id === c.id);
    if (mine && JSON.stringify(mine) === JSON.stringify(c)) { remap.set(c.id, c.id); continue; }
    const copy = deepClone(c); copy.id = 'custom-' + uid(); copy.custom = true;
    if (!validCustom(copy, known)) throw new Error('Eine eigene Übung in der Datei ist ungültig.');
    known.add(copy.id); remap.set(c.id, copy.id); addCustom.push(copy);
  }
  const p = obj.plan, ids = new Map();
  const plan = {
    id: uid(), teamId: team.id, name: isText(p.name, 80) ? p.name : 'Geteilte Einheit', people: Number.isInteger(p.people) ? p.people : 12,
    slot: team.slots[0].day, focus: p.focus || 'Alle', notes: typeof p.notes === 'string' ? p.notes.slice(0, 2000) : '', goal: typeof p.goal === 'string' ? p.goal.slice(0, 200) : '', date: null,
    blocks: p.blocks.map(b => { const n = { id: uid(), exerciseId: remap.get(b.exerciseId) || b.exerciseId, minutes: b.minutes }; ids.set(b.id, n.id); if (b.people !== undefined) n.people = b.people; if (Number.isInteger(b.stations) && b.stations >= 1 && b.stations <= 6) n.stations = b.stations; if (typeof b.note === 'string' && b.note) n.note = b.note.slice(0, 300); return n; }),
  };
  if (p.age) plan.age = p.age;
  if (Number.isInteger(p.keepers) && p.keepers >= 1 && p.keepers <= 20) plan.keepers = p.keepers;
  if (Number.isInteger(p.coaches) && p.coaches >= 0 && p.coaches <= 10 && p.coaches !== 1) plan.coaches = p.coaches;
  if (p.pauses !== undefined && validPauses(p.pauses)) plan.pauses = remapPauses(p.pauses, ids);
  for (const b of plan.blocks) if (!exercise({ ...s, custom: [...s.custom, ...addCustom] }, b.exerciseId)) throw new Error('Die Einheit enthält eine unbekannte Übung.');
  store.update('Einheit importiert', d => { d.custom.push(...addCustom); d.plans.push(plan); d.selectedPlanId = plan.id; });
  undoToast(`„${plan.name}“ importiert${addCustom.length ? ` (mit ${addCustom.length} eigenen Übungen)` : ''}.`);
  import('../ui/router.js').then(r => r.go('planen'));
}
