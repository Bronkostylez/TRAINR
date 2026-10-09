// Validierung der gespeicherten Daten. V2 = TRAINR V2–V20 (`trainr-v2`), V3 = TRAINR V21 (`trainr-v21`).
// Validierung verändert Eingaben nicht, außer offensichtliche Zeiger (selected) zu reparieren.
import { AGES, TAGS, SEED } from '../data/drills.js';
import { LABELS, integer, text, optText, safeURL, time } from './util.js';

export const LIMITS = { plans: 300, blocks: 100, custom: 500, teams: 20, boards: 100, backupBytes: 5_000_000, notes: 2000 };
const SEED_IDS = new Set(SEED.map(e => e.id));
const fail = msg => { throw new Error(msg); };

export function validAnimation(a) {
  return !!a && a.version === 1 && Array.isArray(a.frames) && a.frames.length >= 2 && a.frames.length <= 20 &&
    a.frames.every(f => integer(f.seconds, 1, 15) && text(f.caption, 180) && Array.isArray(f.points) && f.points.length === 4 &&
      f.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 25 && p[0] <= 295 && p[1] >= 25 && p[1] <= 165));
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
  return true;
}

function validVariant(a) { return !!a && integer(a.min, 1, 100) && integer(a.max, a.min, 100) && integer(a.minutes, 1, 120); }

/** Prüft einen V2-Zustand (localStorage `trainr-v2` oder V20-Backup). Wirft bei Fehlern. */
export function validateV2(x) {
  if (!x || x.version !== 2 || !Array.isArray(x.custom) || x.custom.length > 500 || !Array.isArray(x.plans) || !x.plans.length || x.plans.length > 100)
    fail('Ungültiges Backup aus TRAINR V2–V20.');
  if (x.profile && !validProfile(x.profile)) fail('Ungültiges Trainerprofil.');
  const ids = new Set(SEED_IDS);
  for (const e of x.custom) { if (!validCustom(e, ids)) fail('Ungültige eigene Übung.'); ids.add(e.id); }
  const pids = new Set(), bids = new Set();
  for (const p of x.plans) {
    if (!text(p.id, 100) || pids.has(p.id) || !text(p.name, 80) || !integer(p.people, 1, 100) || !['Alle', ...TAGS].includes(p.focus) ||
      !(p.slot === null || p.slot === undefined || integer(p.slot, 0, 6)) || !Array.isArray(p.blocks) || p.blocks.length > 100) fail('Ungültiger Plan.');
    if (p.age !== undefined && !AGES.includes(p.age)) fail('Ungültige Plan-Altersklasse.');
    if (p.coachNotes !== undefined && (typeof p.coachNotes !== 'string' || p.coachNotes.length > 800)) fail('Ungültige Coaching-Notizen.');
    pids.add(p.id);
    for (const b of p.blocks) {
      if (!text(b.id, 100) || bids.has(b.id) || !ids.has(b.exerciseId) || !integer(b.minutes, 1, 120) || (b.people !== undefined && !integer(b.people, 1, 100))) fail('Ungültiger Block.');
      bids.add(b.id);
    }
  }
  if (x.variants !== undefined) {
    if (!x.variants || typeof x.variants !== 'object' || Array.isArray(x.variants) || Object.keys(x.variants).length > 600) fail('Ungültige Varianten.');
    for (const [id, a] of Object.entries(x.variants)) if (!text(id, 100) || !validVariant(a)) fail('Ungültige Variante.');
  }
  return x;
}

const THEMES = ['system', 'light', 'dark'], MOTION = ['full', 'reduced', 'off'], LAYOUTS = ['detailed', 'compact', 'cards', 'coach'];
export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system', motion: 'full', haptics: false, sound: true, fontScale: 100, clubColor: null,
  autoAdvance: false, warnSeconds: 30, wakeLock: true, exportLayout: 'detailed', exportStyle: 'brand',
});

export function validSettings(s) {
  return !!s && THEMES.includes(s.theme) && MOTION.includes(s.motion) && typeof s.haptics === 'boolean' && typeof s.sound === 'boolean' &&
    integer(s.fontScale, 85, 130) && (s.clubColor === null || /^#[0-9a-f]{6}$/i.test(s.clubColor)) && typeof s.autoAdvance === 'boolean' &&
    integer(s.warnSeconds, 0, 120) && typeof s.wakeLock === 'boolean' && LAYOUTS.includes(s.exportLayout) && ['brand', 'ink'].includes(s.exportStyle);
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

/** Prüft einen V3-Zustand (TRAINR V21). Wirft bei Fehlern. */
export function validateV3(x) {
  if (!x || x.version !== 3) fail('Unbekanntes Datenformat.');
  if (!Array.isArray(x.teams) || x.teams.length > LIMITS.teams) fail('Ungültige Mannschaften.');
  const tids = new Set();
  for (const t of x.teams) {
    if (!text(t.id, 100) || tids.has(t.id) || !text(t.name, 60) || !validProfile(t) || !(t.color === undefined || t.color === null || /^#[0-9a-f]{6}$/i.test(t.color))) fail('Ungültige Mannschaft.');
    tids.add(t.id);
  }
  if (x.activeTeamId !== null && !tids.has(x.activeTeamId)) fail('Ungültige aktive Mannschaft.');
  if (!Array.isArray(x.custom) || x.custom.length > LIMITS.custom) fail('Ungültige eigene Übungen.');
  const ids = new Set(SEED_IDS);
  for (const e of x.custom) { if (!validCustom(e, ids)) fail('Ungültige eigene Übung.'); ids.add(e.id); }
  if (!Array.isArray(x.plans) || x.plans.length > LIMITS.plans) fail('Ungültige Einheiten.');
  const pids = new Set(), bids = new Set();
  for (const p of x.plans) {
    if (!text(p.id, 100) || pids.has(p.id) || !text(p.name, 80) || !integer(p.people, 1, 100) || !['Alle', ...TAGS].includes(p.focus) ||
      !(p.slot === null || integer(p.slot, 0, 6)) || !Array.isArray(p.blocks) || p.blocks.length > LIMITS.blocks ||
      !(p.teamId === null || tids.has(p.teamId)) || !optText(p.notes, LIMITS.notes) || !optText(p.goal, 200) ||
      (p.age !== undefined && !AGES.includes(p.age)) || (p.template !== undefined && typeof p.template !== 'boolean') ||
      (p.date !== undefined && p.date !== null && !/^\d{4}-\d\d-\d\d$/.test(p.date))) fail('Ungültige Einheit.');
    pids.add(p.id);
    for (const b of p.blocks) {
      if (!text(b.id, 100) || bids.has(b.id) || !ids.has(b.exerciseId) || !integer(b.minutes, 1, 120) ||
        (b.people !== undefined && !integer(b.people, 1, 100)) || !optText(b.note, 300) ||
        (b.groupLabel !== undefined && !optText(b.groupLabel, 40))) fail('Ungültiger Block.');
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
  if (!validSettings(x.settings)) fail('Ungültige Einstellungen.');
  if (!x.help || typeof x.help !== 'object') fail('Ungültige Hilfe-Daten.');
  return x;
}

export function emptyV3() {
  return {
    version: 3, teams: [], activeTeamId: null, custom: [], plans: [], selectedPlanId: null,
    exerciseMeta: {}, boards: [], settings: { ...DEFAULT_SETTINGS }, help: { tour: false }, migratedFrom: null,
  };
}
