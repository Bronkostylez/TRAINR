// Überführt TRAINR V2–V20-Daten in das V21-Format. Liest nur – alte Schlüssel bleiben unverändert.
// `keeperboard-v1` (Stufe 1) wird bewusst weder gelesen noch geschrieben.
import { validateV2, validateV3, emptyV3, DEFAULT_SETTINGS } from './schema.js';
import { uid, deepClone } from './util.js';

export const KEY_V3 = 'trainr-v21';
export const KEY_V2 = 'trainr-v2';
export const KEY_UI = 'trainr-ui-v4';
export const KEY_ADAPT = 'trainr-adapt-v1';

export function teamFromProfile(profile, name = 'Meine Mannschaft') {
  return { id: uid(), name, type: profile.type, age: profile.age, slots: deepClone(profile.slots), color: null };
}

function planFromV2(p, teamId) {
  const out = {
    id: p.id, teamId, name: p.name, people: p.people, slot: p.slot ?? null, focus: p.focus,
    notes: typeof p.coachNotes === 'string' ? p.coachNotes : '', goal: '',
    blocks: p.blocks.map(b => { const n = { id: b.id, exerciseId: b.exerciseId, minutes: b.minutes }; if (b.people !== undefined) n.people = b.people; return n; }),
    date: null,
  };
  if (p.age !== undefined) out.age = p.age;
  return out;
}

/**
 * V2-Zustand (+ optionale UI-Prefs und Varianten) → V3.
 * @param {object} v2 validierter V2-Zustand
 * @param {object|null} ui Inhalt von `trainr-ui-v4`
 * @param {object|null} adapt Inhalt von `trainr-adapt-v1`
 */
export function fromV2(v2, ui = null, adapt = null) {
  const s = emptyV3();
  if (v2.profile) {
    const team = teamFromProfile(v2.profile);
    s.teams.push(team);
    s.activeTeamId = team.id;
  }
  const teamId = s.activeTeamId;
  s.custom = deepClone(v2.custom);
  s.plans = v2.plans.map(p => planFromV2(p, teamId));
  s.selectedPlanId = s.plans.some(p => p.id === v2.selected) ? v2.selected : s.plans[0]?.id ?? null;
  const variants = { ...(adapt && typeof adapt === 'object' ? adapt : {}), ...(v2.variants || {}) };
  const known = new Set([...s.custom.map(e => e.id)]);
  for (const [id, a] of Object.entries(variants)) {
    if (a && Number.isInteger(a.min) && Number.isInteger(a.max) && Number.isInteger(a.minutes) && a.min >= 1 && a.max >= a.min && a.max <= 100 && a.minutes >= 1 && a.minutes <= 120)
      (s.exerciseMeta[id] ||= {}).variant = { min: a.min, max: a.max, minutes: a.minutes };
    known.add(id);
  }
  if (ui && Array.isArray(ui.favorites)) for (const id of ui.favorites) if (typeof id === 'string' && id.length <= 100) (s.exerciseMeta[id] ||= {}).favorite = true;
  s.settings = { ...DEFAULT_SETTINGS, motion: ui && ui.motion === false ? 'off' : 'full', haptics: ui?.haptics === true };
  s.migratedFrom = 'trainr-v2';
  return validateV3(s);
}

const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch { return undefined; } };

/**
 * Lädt den Zustand aus einem Storage-Objekt (localStorage-kompatibel).
 * Ergebnis: { state, source: 'v3'|'v2'|'new', problem?: string, raw?: string }
 * Bei ungültigen Daten wird nichts überschrieben; der Aufrufer sichert `raw` unter einem Recovery-Schlüssel.
 */
export function load(storage) {
  let raw3 = null;
  try { raw3 = storage.getItem(KEY_V3); } catch { return { state: emptyV3(), source: 'new', problem: 'storage' }; }
  if (raw3) {
    try { return { state: validateV3(JSON.parse(raw3)), source: 'v3' }; }
    catch (err) { return { state: emptyV3(), source: 'new', problem: 'invalid-v3', raw: raw3, error: err.message }; }
  }
  const raw2 = storage.getItem(KEY_V2);
  if (raw2) {
    try {
      const v2 = validateV2(JSON.parse(raw2));
      const ui = parse(storage.getItem(KEY_UI)) || null, adapt = parse(storage.getItem(KEY_ADAPT)) || null;
      return { state: fromV2(v2, ui, adapt), source: 'v2' };
    } catch (err) {
      return { state: emptyV3(), source: 'new', problem: 'invalid-v2', raw: raw2, error: err.message };
    }
  }
  // Ohne V2-Hauptdaten trotzdem Merkliste/Einstellungen aus V4-UI übernehmen.
  const ui = parse(storage.getItem(KEY_UI));
  const s = emptyV3();
  if (ui && typeof ui === 'object') {
    if (Array.isArray(ui.favorites)) for (const id of ui.favorites) if (typeof id === 'string') (s.exerciseMeta[id] ||= {}).favorite = true;
    if (ui.motion === false) s.settings.motion = 'off';
    if (ui.haptics === true) s.settings.haptics = true;
  }
  return { state: s, source: 'new' };
}

/** Backup-Datei (V2 oder V3) → V3. Wirft mit verständlicher Meldung. */
export function importBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Keine gültige TRAINR-Datei.');
  if (obj.version === 3) {
    const s = validateV3(deepClone(obj));
    for (const k of ['exportedAt', 'app', 'appVersion']) delete s[k];
    return s;
  }
  if (obj.version === 2) return fromV2(validateV2(deepClone(obj)), null, null);
  if (obj.version === 1 || obj.app === 'keeperboard') throw new Error('Stufe-1-Backups werden nicht übernommen, weil sich die Bedeutung der Spielerzahlen geändert hat.');
  throw new Error('Unbekanntes Backup-Format.');
}

/** V3 → V20-kompatibles Backup (Rückweg). Nur die aktive Mannschaft wird als Profil übernommen. */
export function toV2Backup(s) {
  const team = s.teams.find(t => t.id === s.activeTeamId) || s.teams[0] || null;
  const plans = s.plans.filter(p => !p.template).slice(0, 100).map(p => {
    const o = { id: p.id, name: p.name, blocks: p.blocks.map(b => { const n = { id: b.id, exerciseId: b.exerciseId, minutes: b.minutes }; if (b.people !== undefined) n.people = b.people; return n; }), people: p.people, slot: p.slot, focus: p.focus };
    if (p.age) o.age = p.age;
    if (p.notes) o.coachNotes = p.notes.slice(0, 800);
    return o;
  });
  if (!plans.length) plans.push({ id: uid(), name: 'Meine Einheit', blocks: [], people: 12, slot: team?.slots[0]?.day ?? null, focus: 'Alle' });
  const custom = s.custom.map(e => { const c = deepClone(e); delete c.goal; return c; });
  const variants = {};
  for (const [id, m] of Object.entries(s.exerciseMeta)) if (m.variant) variants[id] = m.variant;
  return { version: 2, profile: team ? { type: team.type, age: team.age, slots: deepClone(team.slots) } : null, custom, plans, selected: plans.some(p => p.id === s.selectedPlanId) ? s.selectedPlanId : plans[0].id, variants };
}
