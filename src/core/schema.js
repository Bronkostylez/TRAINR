// Validierung der aktuellen TRAINR-Daten (Schema V3 unter `trainr-v21`).
// Validierung verändert Eingaben nicht, außer offensichtliche Zeiger (selected) zu reparieren.
import { AGES, TAGS, SEED } from '../data/drills.js';
import { FOCUS_KEYS, MAX_FOCI } from '../data/focus.js';
import { FLOWS } from '../data/flow.js';
import { parseVariantId, variantId } from '../data/variants.js';
import { LANG_CODES } from '../i18n/index.js';
import { LABELS, integer, text, optText, safeURL, time } from './util.js';

export const LIMITS = { events: 1500, plans: 300, blocks: 100, custom: 500, teams: 20, boards: 100, backupBytes: 5_000_000, notes: 2000 };
const SEED_IDS = new Set(SEED.map(e => e.id));
/** Super-Übung: bekannte Grundübung mit gültigen Einstellungen (nur die kanonische Schreibweise). */
export const validVariantId = id => { const h = parseVariantId(id); return !!h && variantId(h.fam, h.p) === id; };
/** Schwerpunkt einer Einheit: keiner, ein Schwerpunkt oder (aus älteren Ständen) eine Kategorie. */
export const PLAN_FOCUS = new Set(['Alle', ...TAGS, ...FOCUS_KEYS]);
const validFoci = f => Array.isArray(f) && f.length >= 1 && f.length <= MAX_FOCI && new Set(f).size === f.length && f.every(k => FOCUS_KEYS.includes(k));
const fail = msg => { throw new Error(msg); };

// Platzskizze eigener Übungen. V1 (bis 21.0): genau Spieler 1, Spieler 2, Keeper, Ball und mindestens 2 Schritte.
// V2: frei wählbare Elemente (`items`), 1 Schritt = stehende Aufbauskizze, ab 2 Schritten Animation.
export const SKETCH_KINDS = ['a', 'b', 'k', 'ball', 'cone', 'mini', 'goal'];
export const SKETCH_BOX = { x0: 10, x1: 310, y0: 10, y1: 180 };
const V1_ITEMS = [{ k: 'a' }, { k: 'a' }, { k: 'k' }, { k: 'ball' }];
const frameOk = (f, n, [x0, x1, y0, y1]) => integer(f?.seconds, 1, 15) && text(f.caption, 180) && Array.isArray(f.points) && f.points.length === n &&
  f.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1);

// Kamera (21.27): `camera` = 'auto' (folgt dem Ball wie bei den eingebauten Übungen), 'manual' (Fokus je Schritt in `cam`) oder 'off'.
// Je Schritt optional: `cam` { x, y, s } = Fokuspunkt und Zoom 1–2,5; `loft` = Ball fliegt (Flugball) auf dem Weg in diesen Schritt.
export const CAMERA_MODES = ['auto', 'manual', 'off'];
export const ZOOM_MAX = 2.5;
const camOk = c => c === undefined || (!!c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.s) && c.x >= 0 && c.x <= 320 && c.y >= 0 && c.y <= 190 && c.s >= 1 && c.s <= ZOOM_MAX);
const extraOk = f => camOk(f.cam) && (f.loft === undefined || typeof f.loft === 'boolean');
export function validAnimation(a) {
  if (!a || !Array.isArray(a.frames) || a.frames.length > 20) return false;
  if (a.version === 1) return a.frames.length >= 2 && a.frames.every(f => frameOk(f, 4, [25, 295, 25, 165]));
  const B = SKETCH_BOX;
  return a.version === 2 && (a.camera === undefined || CAMERA_MODES.includes(a.camera)) && a.frames.length >= 1 && Array.isArray(a.items) && a.items.length >= 1 && a.items.length <= 30 &&
    a.items.every(it => SKETCH_KINDS.includes(it?.k)) && a.frames.every(f => frameOk(f, a.items.length, [B.x0, B.x1, B.y0, B.y1]) && extraOk(f));
}
/** Liefert jede gültige Skizze im V2-Format (V1 wird umgedeutet, nicht gespeichert), sonst null. */
export function normAnimation(a) {
  if (!validAnimation(a)) return null;
  return a.version === 2 ? a : { version: 2, items: V1_ITEMS.map(x => ({ ...x })), frames: a.frames.map(f => ({ seconds: f.seconds, caption: f.caption, points: f.points.map(p => [...p]) })) };
}
function validSlots(slots) {
  if (!Array.isArray(slots) || !slots.length || slots.length > 7) return false;
  const days = new Set();
  for (const s of slots) {
    if (!s || !integer(s.day, 0, 6) || days.has(s.day) || time(s.start) < 0 || time(s.end) < 0 || time(s.end) <= time(s.start)) return false;
    days.add(s.day);
  }
  return true;
}

export function validProfile(p) {
  return !!p && !!LABELS[p.type] && AGES.includes(p.age) && validSlots(p.slots);
}

export function validCustom(e, ids) {
  if (!text(e?.id, 100) || ids.has(e.id) || !text(e.name, 80) || !TAGS.includes(e.tag) || !LABELS[e.type] ||
    !Array.isArray(e.ages) || !e.ages.length || e.ages.some(a => !AGES.includes(a)) ||
    !integer(e.min, 1, 100) || !integer(e.max, e.min, 100) || !integer(e.minutes, 1, 120) ||
    !text(e.description, 1000) || !text(e.coaching, 1000) ||
    !Array.isArray(e.equipment) || e.equipment.length > 20 ||
    e.equipment.some(a => !Array.isArray(a) || !text(a[0], 100) || !integer(a[1], 1, 100)) ||
    typeof e.url !== 'string' || e.url.length > 500 || !safeURL(e.url)) return false;
  if (e.animation !== undefined && !validAnimation(e.animation)) return false;
  if (!optText(e.goal, 300)) return false;
  if (e.focus !== undefined && !validFoci(e.focus)) return false;
  if (e.flow !== undefined && !FLOWS.includes(e.flow)) return false;
  return true;
}

/** Pausen einer Einheit (ab 21.3): Anzahl („auto“ oder 0–8), Dauer 1–15 Min, optional feste Positionen (Block-IDs). */
export function validPauses(x) {
  return !!x && typeof x === 'object' && (x.count === 'auto' || integer(x.count, 0, 8)) && integer(x.minutes, 1, 15) &&
    (x.after === undefined || (Array.isArray(x.after) && x.after.length <= 8 && x.after.every(id => text(id, 100))));
}

function validVariant(a) { return !!a && integer(a.min, 1, 100) && integer(a.max, a.min, 100) && integer(a.minutes, 1, 120); }

const THEMES = ['system', 'light', 'dark'], MOTION = ['full', 'reduced', 'off'], LAYOUTS = ['detailed', 'compact', 'cards', 'coach'];
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system', motion: 'full', haptics: false, sound: true, fontScale: 100, clubColor: null,
  autoAdvance: false, speech: false, warnSeconds: 30, wakeLock: true, exportLayout: 'detailed', exportStyle: 'brand', lang: 'auto',
});

export function validSettings(s) {
  return !!s && THEMES.includes(s.theme) && MOTION.includes(s.motion) && typeof s.haptics === 'boolean' && typeof s.sound === 'boolean' &&
    integer(s.fontScale, 85, 130) && (s.clubColor === null || /^#[0-9a-f]{6}$/i.test(s.clubColor)) && typeof s.autoAdvance === 'boolean' && (s.speech === undefined || typeof s.speech === 'boolean') &&
    integer(s.warnSeconds, 0, 120) && typeof s.wakeLock === 'boolean' && LAYOUTS.includes(s.exportLayout) && ['brand', 'ink'].includes(s.exportStyle) &&
    (s.lang === undefined || s.lang === 'auto' || LANG_CODES.includes(s.lang));
}

function validBoard(b) {
  if (!text(b?.id, 100) || !text(b.name, 80) || !Array.isArray(b.items) || b.items.length > 40) return false;
  if (!['full', 'half', 'small'].includes(b.pitch)) return false;
  for (const it of b.items) {
    if (!it || !['a', 'b', 'k', 'kb', 'ball', 'cone'].includes(it.kind) || !Number.isFinite(it.x) || !Number.isFinite(it.y) || it.x < 0 || it.x > 100 || it.y < 0 || it.y > 100) return false;
    if (it.label !== undefined && !optText(it.label, 3)) return false;
  }
  if (!Array.isArray(b.arrows) || b.arrows.length > 40 || b.arrows.some(a => !Array.isArray(a.p) || a.p.length !== 4 || a.p.some(v => !Number.isFinite(v) || v < 0 || v > 100) || !['run', 'pass', 'dribble'].includes(a.kind))) return false;
  return optText(b.note, 600);
}

export const EVENT_KINDS = ['training', 'spiel', 'turnier', 'termin'];
export const EVENT_STATUS = ['geplant', 'erledigt', 'ausgefallen'];

/** Spieltag-Daten eines Spiels/Turniers (ab 21.6): Gegner, Treffpunkt, Formation, Taktik, Spielplan, Ergebnis. Keine Spielernamen. */
export function validGame(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return false;
  if (!optText(g.opponent, 60) || !optText(g.formation, 40) || !(g.home === undefined || typeof g.home === 'boolean')) return false;
  if (!(g.meet === undefined || g.meet === '' || time(g.meet) >= 0)) return false;
  if (!(g.boardId === undefined || g.boardId === null || text(g.boardId, 100))) return false;
  if (g.tactics !== undefined && (!g.tactics || ['attack', 'defence', 'standards'].some(k => !optText(g.tactics[k], 600)))) return false;
  const score = r => r === undefined || (!!r && integer(r.own, 0, 99) && integer(r.opp, 0, 99));
  if (!score(g.result)) return false;
  if (g.matches !== undefined && (!Array.isArray(g.matches) || g.matches.length > 20 ||
    g.matches.some(m => !m || !(m.time === '' || time(m.time) >= 0) || !optText(m.opponent, 60) || !optText(m.pitch, 30) || !score(m.result)))) return false;
  return true;
}

/** Kalendertermin. Anwesenheit nur als Zahlen (Spieler, ab 21.7 getrennt Torwart und Trainer) – keine Namen. `done` = Momentaufnahme der gehaltenen Einheit. */
function validEvent(ev, tids) {
  if (!text(ev?.id, 100) || !tids.has(ev.teamId) || !/^\d{4}-\d\d-\d\d$/.test(ev.date) || Number.isNaN(Date.parse(ev.date))) return false;
  if (time(ev.start) < 0 || time(ev.end) < 0 || time(ev.end) <= time(ev.start)) return false;
  if (!EVENT_KINDS.includes(ev.kind) || !EVENT_STATUS.includes(ev.status)) return false;
  if (!(ev.planId === null || text(ev.planId, 100)) || !(ev.remind === null || integer(ev.remind, 0, 10080))) return false;
  if (!optText(ev.title, 80) || !optText(ev.place, 80) || !optText(ev.note, LIMITS.notes) || !optText(ev.reason, 120)) return false;
  if (ev.foci !== undefined && (ev.kind !== 'training' || !validFoci(ev.foci))) return false;
  if (ev.seriesId !== undefined && !text(ev.seriesId, 100)) return false;
  if (ev.game !== undefined && (!validGame(ev.game) || (ev.kind !== 'spiel' && ev.kind !== 'turnier'))) return false;
  if (ev.attendance !== undefined && !integer(ev.attendance, 0, 100)) return false;
  if ((ev.keepers !== undefined && !integer(ev.keepers, 0, 20)) || (ev.coaches !== undefined && !integer(ev.coaches, 0, 10))) return false;
  if (ev.rating !== undefined && !integer(ev.rating, 1, 5)) return false;
  if (ev.done !== undefined) {
    const d = ev.done;
    if (!d || !text(d.name, 80) || !integer(d.minutes, 0, 1000) || !PLAN_FOCUS.has(d.focus) ||
      !Array.isArray(d.exercises) || d.exercises.length > LIMITS.blocks || d.exercises.some(id => !text(id, 100))) return false;
    // Ab 21.2: Minuten je Block für den Schwerpunkt-Rückblick.
    if (d.blocks !== undefined && (!Array.isArray(d.blocks) || d.blocks.length > LIMITS.blocks || d.blocks.some(b => !Array.isArray(b) || b.length !== 2 || !text(b[0], 100) || !integer(b[1], 1, 120)))) return false;
  }
  return true;
}

/** Prüft einen V3-Zustand (TRAINR V21). Wirft bei Fehlern. */
export function validateV3(x) {
  if (!x || x.version !== 3) fail('Unbekanntes Datenformat.');
  if (!Array.isArray(x.teams) || x.teams.length > LIMITS.teams) fail('Ungültige Mannschaften.');
  const tids = new Set();
  for (const t of x.teams) {
    if (!text(t.id, 100) || tids.has(t.id) || !text(t.name, 60) || !validProfile(t) || !(t.color === undefined || t.color === null || /^#[0-9a-f]{6}$/i.test(t.color)) ||
      !(t.seriesUntil === undefined || /^\d{4}-\d\d-\d\d$/.test(t.seriesUntil)) || !(t.autoSeries === undefined || typeof t.autoSeries === 'boolean') ||
      !(t.season === undefined || (t.season && Array.isArray(t.season.goals) && t.season.goals.length <= 3 && t.season.goals.every(g => typeof g === 'string' && g.length < 40) && /^\d{4}-\d\d-\d\d$/.test(t.season.start)))) fail('Ungültige Mannschaft.');
    tids.add(t.id);
  }
  if (x.activeTeamId !== null && !tids.has(x.activeTeamId)) fail('Ungültige aktive Mannschaft.');
  if (!Array.isArray(x.custom) || x.custom.length > LIMITS.custom) fail('Ungültige eigene Übungen.');
  const ids = new Set(SEED_IDS);
  for (const e of x.custom) { if (!validCustom(e, ids)) fail('Ungültige eigene Übung.'); ids.add(e.id); }
  if (!Array.isArray(x.plans) || x.plans.length > LIMITS.plans) fail('Ungültige Einheiten.');
  const pids = new Set(), bids = new Set();
  for (const p of x.plans) {
    if (!text(p.id, 100) || pids.has(p.id) || !text(p.name, 80) || !integer(p.people, 1, 100) || !PLAN_FOCUS.has(p.focus) ||
      !(p.slot === null || integer(p.slot, 0, 6)) || !Array.isArray(p.blocks) || p.blocks.length > LIMITS.blocks ||
      !(p.teamId === null || tids.has(p.teamId)) || !optText(p.notes, LIMITS.notes) || !optText(p.goal, 200) ||
      (p.sessionType !== undefined && !['field', 'keeper', 'both'].includes(p.sessionType)) ||
      (p.targetMinutes !== undefined && !integer(p.targetMinutes, 20, 150)) ||
      (p.age !== undefined && !AGES.includes(p.age)) || (p.template !== undefined && typeof p.template !== 'boolean') ||
      (p.date !== undefined && p.date !== null && !/^\d{4}-\d\d-\d\d$/.test(p.date)) || (p.pauses !== undefined && !validPauses(p.pauses)) ||
      (p.keepers !== undefined && !integer(p.keepers, 0, 20)) || (p.coaches !== undefined && !integer(p.coaches, 0, 10)) ||
      (p.foci !== undefined && !validFoci(p.foci))) fail('Ungültige Einheit.');
    pids.add(p.id);
    for (const b of p.blocks) {
      if (!text(b.id, 100) || bids.has(b.id) || !(ids.has(b.exerciseId) || validVariantId(b.exerciseId)) || !integer(b.minutes, 1, 120) ||
        (b.coachSupport !== undefined && typeof b.coachSupport !== 'boolean') || (b.people !== undefined && !integer(b.people, 1, 100)) || !optText(b.note, 300) ||
        (b.groupLabel !== undefined && !optText(b.groupLabel, 40)) || (b.stations !== undefined && !integer(b.stations, 1, 6)) ||
        (b.why !== undefined && !optText(b.why, 300)) ||
        (b.alternatives !== undefined && (!Array.isArray(b.alternatives) || b.alternatives.length > 6 || b.alternatives.some(id => !text(id, 100))))) fail('Ungültiger Block.');
      bids.add(b.id);
    }
  }
  if (x.selectedPlanId !== null && !pids.has(x.selectedPlanId)) x.selectedPlanId = x.plans.find(p => !p.template)?.id ?? null;
  if (!x.exerciseMeta || typeof x.exerciseMeta !== 'object' || Array.isArray(x.exerciseMeta)) fail('Ungültige Übungsdaten.');
  for (const [id, m] of Object.entries(x.exerciseMeta)) {
    if (!text(id, 100) || !m || typeof m !== 'object') fail('Ungültige Übungsdaten.');
    if (m.favorite !== undefined && typeof m.favorite !== 'boolean') fail('Ungültige Merkliste.');
    if (m.rating !== undefined && !integer(m.rating, 1, 5)) fail('Ungültige Bewertung.');
    if (!optText(m.note, 1000)) fail('Ungültige Übungsnotiz.');
    if (m.variant !== undefined && !validVariant(m.variant)) fail('Ungültige Variante.');
    if (m.lastUsed !== undefined && !Number.isFinite(m.lastUsed)) fail('Ungültiges Nutzungsdatum.');
    if (m.uses !== undefined && !integer(m.uses, 0, 1e6)) fail('Ungültige Nutzungszahl.');
  }
  if (!Array.isArray(x.boards) || x.boards.length > LIMITS.boards || x.boards.some(b => !validBoard(b))) fail('Ungültiges Taktikboard.');
  // Kalender (ab 21.1): fehlt in älteren V21-Ständen und wird dann leer ergänzt.
  if (x.events === undefined) x.events = [];
  if (!Array.isArray(x.events) || x.events.length > LIMITS.events) fail('Ungültiger Kalender.');
  const eids = new Set();
  for (const ev of x.events) {
    if (!validEvent(ev, tids) || eids.has(ev.id)) fail('Ungültiger Termin.');
    eids.add(ev.id);
    if (ev.planId !== null && !pids.has(ev.planId)) ev.planId = null; // Einheit gelöscht: Termin bleibt, Rückblick steht in `done`
  }
  if (!validSettings(x.settings)) fail('Ungültige Einstellungen.');
  if (!x.help || typeof x.help !== 'object') fail('Ungültige Hilfe-Daten.');
  return x;
}

export function emptyV3() {
  return {
    version: 3, teams: [], activeTeamId: null, custom: [], plans: [], selectedPlanId: null,
    exerciseMeta: {}, boards: [], events: [], settings: { ...DEFAULT_SETTINGS }, help: { tour: false },
  };
}
