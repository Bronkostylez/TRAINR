// Fachlogik ohne DOM: Katalog, Gruppen, Material, Zeitbudget, Einheitencheck, Ranking.
import { SEED, AGES, TAGS } from '../data/drills.js';
import { META } from '../data/drill-meta.js';
import { FOCUS, FOCUS_KEYS, DRILL_FOCUS } from '../data/focus.js';
import { flowOf } from '../data/flow.js';
import { coachRole } from '../data/coach-roles.js';
export { coachRole } from '../data/coach-roles.js';
import { localizeExercise } from '../i18n/catalog.js';
import { buildVariant, isVariantId } from '../data/variants.js';
import { time, fmtTime, sum, DAYS } from './util.js';

export { AGES, TAGS, SEED };
export { FLOWS, FLOW_LABEL, FLOW_HELP, flowOf } from '../data/flow.js';
export { FOCI, FOCUS, FOCUS_KEYS, AREAS, RELEVANT, MAX_FOCI } from '../data/focus.js';

// Katalog einmal zusammensetzen: Grunddaten + Redaktion (Ziel, Coaching-Punkte, Quellen, Archiv-Status) + Schwerpunkte.
const seedById = new Map(SEED.map(e => [e.id, { ...e, ...META[e.id], flow: flowOf(e), focus: DRILL_FOCUS[e.id] || (FOCUS[e.tag] ? [e.tag] : []) }]));

/** Übung inkl. redaktioneller Ergänzungen und Schwerpunkte. */
export function exercise(s, id) {
  const seed = seedById.get(id);
  if (seed) return localizeExercise(seed);
  if (isVariantId(id)) { const b = seedById.get(id.split('~')[0]); return b ? buildVariant(id, localizeExercise(b)) : null; }
  return s.custom.find(e => e.id === id) || null;
}

// ---------- Schwerpunkte ----------
/** Schwerpunkte einer Übung, Hauptschwerpunkt zuerst. Ältere eigene Übungen ohne Auswahl erben ihre Kategorie, falls diese ein Schwerpunkt ist. */
export const foci = e => (e?.focus?.length ? e.focus : FOCUS[e?.tag] ? [e.tag] : []);
/** Trainiert die Übung diesen Schwerpunkt? Alte Einheiten-Schwerpunkte wie „Spielform“ treffen weiter die Kategorie. */
export const hasFocus = (e, key) => !!e && (e.tag === key || foci(e).includes(key));

/**
 * Schwerpunkt-Minuten aus [Übung, Minuten]-Paaren. Jede Übung zählt voll für jeden ihrer Schwerpunkte
 * („in 34 von 75 Min ging es um Passspiel“); `main` = Minuten als Hauptschwerpunkt. Bereiche nach Hauptschwerpunkt (Summe = total).
 */
export function focusMinutes(pairs) {
  const by = {}, areas = {}; let total = 0;
  for (const [e, min] of pairs) {
    if (!e || !(min > 0)) continue;
    total += min;
    const f = foci(e);
    f.forEach((k, i) => { const o = (by[k] ||= { key: k, minutes: 0, main: 0, n: 0 }); o.minutes += min; o.n++; if (!i) o.main += min; });
    const a = FOCUS[f[0]]?.area || 'none'; areas[a] = (areas[a] || 0) + min;
  }
  const list = Object.values(by).map(o => ({ ...o, minutes: Math.round(o.minutes), main: Math.round(o.main) }))
    .sort((a, b) => b.minutes - a.minutes || b.main - a.main || FOCUS_KEYS.indexOf(a.key) - FOCUS_KEYS.indexOf(b.key));
  return { total: Math.round(total), list, areas };
}
export const planFocus = (s, p) => focusMinutes((p?.blocks || []).map(b => [exercise(s, b.exerciseId), b.minutes]));
/** Liste mit `key` an erster Stelle (sofern enthalten) – für Zusammenfassungen, in denen der gewählte Schwerpunkt nicht fehlen darf. */
export const keyFirst = (list, key) => { const i = list.findIndex(o => o.key === key); return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list; };

/** Gemeinsame Schwerpunkte zweier Übungen, gleicher Hauptschwerpunkt zählt doppelt. */
export function focusOverlap(a, b) {
  const fa = foci(a), fb = foci(b);
  return fa.filter(k => fb.includes(k)).length + (fa[0] && fa[0] === fb[0] ? 1 : 0);
}
export function allExercises(s, { archived = false } = {}) {
  const list = SEED.map(e => exercise(s, e.id)).filter(e => archived || !e.archived);
  return [...list, ...s.custom];
}
export const meta = (s, id) => s.exerciseMeta[id] || {};

/** Übung mit lokal gespeicherter Variante (Spieler pro Gruppe, Minuten). Material bleibt Original. */
export function effective(s, e) {
  const v = meta(s, e.id).variant;
  return v ? { ...e, min: v.min, max: v.max, minutes: v.minutes } : e;
}

/** Kleinste Gruppenzahl g, sodass g·min ≤ n ≤ g·max. 0 = passt nicht. */
export function groupsFor(e, n) {
  for (let g = 1; g <= n; g++) if (n >= g * e.min && n <= g * e.max) return g;
  return 0;
}
export const fit = (s, e, n) => groupsFor(effective(s, e), n);

// ---------- Besetzung und Ablauf ----------
// Wer ist da: Spieler (Feld), Torwart, Trainer. Spieler und Torwart üben; Trainer übernehmen ausschließlich ausdrücklich geprüfte nicht-spielerische Rollen.
// Ob daraus Gruppen entstehen, entscheidet die Übung (Ablaufart): feste Gruppen, eine Schlange oder alle gemeinsam.
export const DEFAULT_SQUAD = Object.freeze({ players: 12, keepers: 0, coaches: 1 });
export const STATION_MAX = 6;
/** Besetzung einer Einheit (oder eines Blocks: dort überschreibt `people` die Spielerzahl). In Torwart-Mannschaften üben alle als Torwart. */
export function squadOf(s, p, b) {
  if (!p) return { ...DEFAULT_SQUAD };
  const n = b ? blockPeople(p, b) : p.people, k = p.keepers || 0, coaches = p.coaches ?? 1;
  return planType(s, p) === 'keeper' ? { players: 0, keepers: n + k, coaches } : { players: n, keepers: k, coaches };
}
/** Kurzform: „12 Spieler · 2 Torwart · 1 Trainer“ (Rollen ohne Personen entfallen, Spieler stehen immer da). */
export function squadLabel(p, type = p?.sessionType) {
  const k = p?.keepers || 0, c = p?.coaches ?? 1;
  return [`${p?.people ?? 0} ${type === 'keeper' ? 'Torwarte' : 'Spieler'}`, k ? `${k} Torwart` : '', c ? `${c} Trainer` : ''].filter(Boolean).join(' · ');
}

/**
 * Wie läuft eine Übung mit dieser Besetzung?
 * { mode, level: 'ok'|'tight'|'no', why, groups, active, waiting, sets, size: [von, bis], keepersMissing, coachFill, stationsHint }
 * `groups` = parallele Gruppen bzw. Schlangen, `active` = gleichzeitig aktiv, `waiting` = Schlange / Wechselspieler / Unbeteiligte,
 * `sets` = wie oft Material und Feld gebraucht werden. Gruppen entstehen nur bei „group“ – und dort so wenige wie möglich.
 */
export function layout(s, e, sq, stations = 1, useCoach = true) {
  const x = effective(s, e), mode = flowOf(e), bodies = sq.players + sq.keepers, K = sq.keepers;
  const role = coachRole(e), available = Math.max(0, sq.coaches - (e.requiredCoaches || 0)), support = useCoach && role?.slots ? available : 0;
  const L = { coachRole: role?.role || '', coachesUsed: e.requiredCoaches || 0, mode, bodies, level: 'ok', why: '', groups: 1, active: bodies, waiting: 0, sets: 1, size: [x.min, x.max], keepersMissing: 0, coachFill: 0, stationsHint: 0 };
  if (e.requiredCoaches && sq.coaches < e.requiredCoaches) return { ...L, level: 'no', why: 'nocoach', active: 0 };
  if (bodies < Math.max(1, x.min - Math.min(support, 1))) return { ...L, level: 'no', why: 'few', active: 0, waiting: bodies };
  if (e.type === 'keeper' && K < 1) return { ...L, level: 'no', why: 'nokeeper', active: 0 };
  if (mode === 'open') return { ...L, sets: Math.ceil(bodies / x.max) };
  if (mode === 'queue') {
    const st = Math.max(1, Math.min(STATION_MAX, Math.floor(stations) || 1, e.requiredCoaches ? Math.floor(sq.coaches / e.requiredCoaches) : STATION_MAX, Math.floor(bodies / x.min))), active = Math.min(bodies, st * x.max), waiting = bodies - active;
    const out = { ...L, groups: st, sets: st, active, waiting, coachesUsed: st * (e.requiredCoaches || 0) };
    if (waiting > active) { out.level = 'tight'; out.why = 'longqueue'; out.stationsHint = Math.min(STATION_MAX, Math.ceil(bodies / (2 * x.max))); }
    return out;
  }
  // Try actual child + support-role allocations. A coach is never counted as a child.
  const cap = e.type === 'keeper' ? K : bodies;
  const candidates = [];
  for (let groups = 1; groups <= cap; groups++) {
    const options = e.type === 'keeper' ? [Math.min(support, groups)] : [...new Set([Math.min(support, groups), 0])];
    for (const used of options) {
      const min = Math.max(groups, groups * x.min - used), capacity = groups * x.max - used;
      if (bodies < min || capacity < groups) continue;
      const active = Math.min(bodies, capacity), waiting = bodies - active;
      candidates.push({ ...L, groups, sets: groups, active, waiting, coachFill: used, coachesUsed: used + (e.requiredCoaches || 0) });
    }
  }
  candidates.sort((a, b) => a.waiting - b.waiting || b.coachFill - a.coachFill || a.groups - b.groups);
  const out = candidates[0] || { ...L, level: 'no', why: 'few', active: 0, waiting: bodies };
  const { groups, waiting } = out;
  if (waiting) {
    out.why = e.type === 'keeper' ? (out.coachFill ? 'rotation' : 'idle') : 'spare';
    if (waiting > 2 || (e.type === 'keeper' && !out.coachFill)) out.level = 'tight';
  }
  if (e.type === 'both' && groups > K) { out.keepersMissing = groups - K; out.level = 'tight'; out.why = out.why || 'keeperfill'; }
  return out;
}

/** Kurztext zur Verteilung, z. B. „3 Gruppen à 4–5“ oder „Schlange · 4 aktiv, 6 in der Reihe“. */
function distributionText(L) {
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  if (L.level === 'no') return L.why === 'nocoach' ? 'Trainer fehlt' : L.why === 'nokeeper' ? 'Torwart fehlt' : `zu wenige Spieler, mind. ${L.size[0]}`;
  if (L.mode === 'open') return L.sets > 1 ? `Alle gemeinsam · Feld und Material ×${L.sets}` : 'Alle gemeinsam';
  if (L.mode === 'queue') return `${L.groups === 1 ? 'Schlange' : `${L.groups} Schlangen`} · ${L.active} aktiv${L.waiting ? `, ${L.waiting} in der Reihe` : ''}`;
  const base = Math.floor(L.active / L.groups), rest = L.active % L.groups;
  return `${n(L.groups, 'Gruppe', 'Gruppen')} à ${rest ? `${base}–${base + 1}` : base}${L.waiting ? ` · ${L.waiting} ${L.why === 'idle' ? 'unbeteiligt' : L.waiting === 1 ? 'wechselt ein' : 'wechseln ein'}` : ''}`;
}
/** Distribution plus the coach's concrete role, shared by planner, assistant and exports. */
export function layoutText(L) {
  const base = distributionText(L);
  return base + (L.level !== 'no' && L.coachesUsed && L.coachRole ? ` · ${L.coachesUsed} Trainer: ${L.coachRole}` : '');
}
/** Hinweis zur Verteilung für den Trainer; leer, wenn alles passt. */
export function layoutAdvice(L) {
  const keeper = L.keepersMissing && L.why !== 'keeperfill' ? ' Nicht für jede Gruppe ein Torwart da. Ein Feldspieler geht ins Tor.' : '';
  return (advice(L) + keeper).trim();
}
function advice(L) {
  switch (L.why) {
    case 'few': return `Zu wenige Spieler: mindestens ${L.size[0]} nötig.`;
    case 'nocoach': return 'Diese Übung braucht einen Trainer zum Zuspielen. Besetzung prüfen oder andere Übung wählen.';
    case 'nokeeper': return 'Diese Übung braucht einen Torwart. Torwart eintragen oder andere Übung wählen.';
    case 'longqueue': return `In der Schlange warten ${L.waiting} Spieler. ${L.stationsHint > L.groups ? `Mit ${L.stationsHint} Schlangen ist mehr los.` : 'Ball holen oder Passgeber sein lässt die Wartenden mitarbeiten.'}`;
    case 'spare': return `${L.waiting === 1 ? 'Ein Spieler wechselt ein.' : `Es wechseln ${L.waiting} Spieler ein.`}${''}`;
    case 'rotation': return 'Torwarte wechseln nach kurzen Serien. Trainer bleibt Zuspieler; Wartende stehen außerhalb der Zuspielbahn.';
    case 'idle': return `Bei dieser Übung sind ${L.waiting} Spieler nicht beteiligt. Zweite Aufgabe für sie vorsehen.`;
    case 'keeperfill': return 'Nicht für jede Gruppe ein Torwart da. Ein Feldspieler geht ins Tor.';
    default: return '';
  }
}
/** Verteilung eines Blocks in der Einheit. */
export const blockLayout = (s, p, b) => { const e = exercise(s, b.exerciseId); return e ? layout(s, e, squadOf(s, p, b), b.stations, b.coachSupport !== false) : null; };

export const activeTeam = s => s.teams.find(t => t.id === s.activeTeamId) || null;
export const teamOf = (s, p) => s.teams.find(t => t.id === p?.teamId) || activeTeam(s);
export const currentPlan = s => s.plans.find(p => p.id === s.selectedPlanId) || null;
export const plansOfTeam = (s, teamId = s.activeTeamId) => s.plans.filter(p => !p.template && (p.teamId === teamId || p.teamId === null));
export const templates = s => s.plans.filter(p => p.template);
export const planAge = (s, p) => p?.age || teamOf(s, p)?.age || null;
export const planType = (s, p) => p?.sessionType || teamOf(s, p)?.type || 'field';
export const blockPeople = (p, b) => b.people || p.people;
/** Reine Übungszeit ohne eingeplante Pausen. */
export const exerciseMinutes = p => sum(p?.blocks || [], b => b.minutes);
/** Gesamtdauer der Einheit: Übungen plus eingeplante Pausen. Ohne Zustand `s` gilt für „Automatisch“ die Altersklasse der Einheit. */
export const totalMinutes = (p, s) => exerciseMinutes(p) + sum(pauses(s, p), x => x.minutes);

// ---------- Pausen ----------
// Pausen sind keine Blöcke: Die Einheit speichert nur Anzahl und Dauer (`p.pauses`), verteilt wird bei jeder Änderung neu.
// Optional `after` = vom Trainer festgelegte Positionen (Block-IDs, nach denen pausiert wird).
export const PAUSE_MAX = 8, PAUSE_MINUTES = [1, 15];
/** Abstand zwischen Trinkpausen je Altersklasse (Minuten Übungszeit) – Jüngere brauchen öfter eine kurze Pause. */
const PAUSE_EVERY = { Bambini: 12, 'F-Jugend': 15, 'E-Jugend': 18, 'D-Jugend': 20, 'C-Jugend': 25, 'B-Jugend': 30, 'A-Jugend': 30, 'Männer': 30 };
const INTENSE = new Set(['Spielform', 'Umschalten', 'Verteidigen']);
export const pauseSetting = p => (p?.pauses && p.pauses.count !== 0 ? p.pauses : null);
export const pauseEvery = age => PAUSE_EVERY[age] || 20;

/** Anzahl Pausen für eine Einheit – bei „Automatisch“ aus Übungszeit und Alter, nie mehr als Blockübergänge. */
export function pauseCount(cfg, { age, minutes, blocks }) {
  if (!cfg || blocks < 2) return 0;
  const want = cfg.after ? cfg.after.length : cfg.count === 'auto' ? Math.max(0, Math.ceil(minutes / pauseEvery(age)) - 1) : cfg.count;
  return Math.min(want, blocks - 1, PAUSE_MAX);
}

/**
 * Eingeplante Pausen: [{ afterId, index, minutes, why }]. `index` = Block, nach dem pausiert wird.
 * Automatisch: zeitlich möglichst gleichmäßig verteilt, bevorzugt nach intensiven Spielformen und zwischen Runden derselben Übung,
 * ungern direkt nach sehr kurzen Blöcken. Optimal per dynamischer Programmierung (wenige Pausen, max. 100 Übergänge).
 */
export function pauses(s, p) {
  const cfg = pauseSetting(p), bl = p?.blocks || [];
  if (!cfg || bl.length < 2) return [];
  const minutes = cfg.minutes;
  if (cfg.after) {
    const at = new Set(cfg.after);
    return bl.slice(0, -1).map((b, index) => ({ b, index })).filter(({ b }) => at.has(b.id)).slice(0, PAUSE_MAX)
      .map(({ b, index }) => ({ afterId: b.id, index, minutes, why: 'von dir festgelegt' }));
  }
  const age = s ? planAge(s, p) : p.age, T = exerciseMinutes(p);
  const n = pauseCount(cfg, { age, minutes: T, blocks: bl.length });
  if (!n) return [];
  const ex = s ? bl.map(b => exercise(s, b.exerciseId)) : bl.map(() => null);
  const gaps = []; let c = 0;
  bl.slice(0, -1).forEach((b, i) => {
    c += b.minutes;
    const next = bl[i + 1], intense = INTENSE.has(ex[i]?.tag), rounds = next.exerciseId === b.exerciseId;
    // Bonus in Minuten Zeitabweichung: so viel früher/später darf eine Pause liegen, um an einer besseren Stelle zu stehen.
    const bonus = (intense ? 4 : 0) + (rounds ? 3 : 0) - (b.minutes < 5 ? 3 : 0) - (next.minutes < 4 ? 2 : 0);
    gaps.push({ i, at: c, bonus, why: rounds ? 'zwischen zwei Runden' : intense ? `nach ${ex[i].tag === 'Spielform' ? 'der Spielform' : 'intensiver Phase'}` : '' });
  });
  const G = gaps.length, target = k => (T * (k + 1)) / (n + 1);
  const cost = (k, g) => Math.abs(gaps[g].at - target(k)) - gaps[g].bonus;
  // dp[k][g]: beste Summe, wenn Pause k an Übergang g liegt (Pausen streng aufsteigend).
  const dp = Array.from({ length: n }, () => new Array(G).fill(Infinity)), from = Array.from({ length: n }, () => new Array(G).fill(-1));
  for (let g = 0; g < G; g++) dp[0][g] = cost(0, g);
  for (let k = 1; k < n; k++) for (let g = k; g < G; g++) {
    let best = Infinity, arg = -1;
    for (let h = k - 1; h < g; h++) if (dp[k - 1][h] < best) { best = dp[k - 1][h]; arg = h; }
    dp[k][g] = best + cost(k, g); from[k][g] = arg;
  }
  let g = -1, best = Infinity;
  for (let x = n - 1; x < G; x++) if (dp[n - 1][x] < best) { best = dp[n - 1][x]; g = x; }
  const picked = [];
  for (let k = n - 1; k >= 0; k--) { picked.unshift(gaps[g]); g = from[k][g]; }
  return picked.map(x => ({ afterId: bl[x.i].id, index: x.i, minutes, why: x.why || `nach ${x.at} Min Übungszeit` }));
}

/** Ablauf für den Trainingsmodus: Blöcke und Pausen im Wechsel. Pausen-Schritte haben `pause: true` und die ID `pause:<Block>`. */
export function sessionSteps(s, p) {
  const after = new Map(pauses(s, p).map(x => [x.afterId, x])), out = [];
  for (const b of p?.blocks || []) {
    out.push(b);
    const x = after.get(b.id);
    if (x) out.push({ id: `pause:${b.id}`, pause: true, minutes: x.minutes, why: x.why });
  }
  return out;
}

/** Pauseneinstellung für Blöcke mit neuen IDs übernehmen (Kopie, Vorlage, Import); feste Positionen wandern mit. */
export function remapPauses(cfg, idMap) {
  if (!cfg) return undefined;
  const out = { count: cfg.count, minutes: cfg.minutes };
  if (cfg.after) out.after = cfg.after.map(id => idMap.get(id)).filter(Boolean);
  return out;
}

/** Übungszeit so kürzen, dass Übungen + Pausen in `target` Minuten passen (verhältnisgleich, mind. 2 Min je Block). */
export function fitBlocks(s, p, target) {
  const pm = sum(pauses(s, p), x => x.minutes), have = exerciseMinutes(p), room = target - pm;
  if (have <= room || room < p.blocks.length * 2) return null;
  const mins = p.blocks.map(b => Math.max(2, Math.floor((b.minutes * room) / have)));
  let left = room - sum(mins, x => x);
  // Restminuten an die größten Blöcke, damit die Summe exakt stimmt
  const order = p.blocks.map((b, i) => i).sort((a, b) => p.blocks[b].minutes - p.blocks[a].minutes);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) mins[order[k]]++;
  for (let k = 0; left < 0 && k < 1000; k = (k + 1) % order.length) if (mins[order[k]] > 2) { mins[order[k]]--; left++; }
  return mins;
}

export function slotOf(s, p) {
  const t = teamOf(s, p);
  if (!t) return null;
  return t.slots.find(x => x.day === p?.slot) || t.slots[0] || null;
}
export const slotMinutes = slot => (slot ? time(slot.end) - time(slot.start) : 0);
export const slotLabel = slot => (slot ? `${DAYS[slot.day]} · ${slot.start}–${slot.end}` : '');

/** Höchstbedarf je Material über alle Blöcke (Menge × parallele Gruppen). */
export function requirements(s, p) {
  const items = {};
  for (const b of p.blocks) {
    const e = exercise(s, b.exerciseId); if (!e) continue;
    const g = layout(s, e, squadOf(s, p, b), b.stations).sets;
    for (const [name, count] of e.equipment) items[name] = Math.max(items[name] || 0, count * g);
  }
  return items;
}

/** Packliste: Material + feste Punkte, die jede Einheit braucht. */
export function packList(s, p) {
  const eq = Object.entries(requirements(s, p)).map(([n, c]) => ({ id: 'm:' + n, label: `${c} ${n}`, group: 'Material' }));
  const extra = [
    ['Trinkflaschen / Wasser', 'Ausrüstung'], ['Erste-Hilfe-Set mit Kühlpack', 'Ausrüstung'], ['Ballpumpe', 'Ausrüstung'],
    ['Pfeife / Signal', 'Ausrüstung'], ['Plan ausgedruckt oder Handy geladen', 'Ausrüstung'],
  ];
  if (p.blocks.some(b => exercise(s, b.exerciseId)?.type !== 'field')) extra.push(['Torwarthandschuhe (Ersatzpaar)', 'Ausrüstung']);
  return [...eq, ...extra.map(([label, group]) => ({ id: 'x:' + label, label, group }))];
}

/** Zeitstrahl: Start/Ende je Block, ausgehend vom Trainingsbeginn. `pause` = eingeplante Pause nach dem Block (oder null). */
export function timeline(s, p) {
  const slot = slotOf(s, p), after = new Map(pauses(s, p).map(x => [x.afterId, x]));
  const label = (a, b) => (slot ? `${fmtTime(a)}–${fmtTime(b)}` : '');
  let t = slot ? time(slot.start) : 0;
  return p.blocks.map(b => {
    const start = t; t += b.minutes;
    const x = after.get(b.id), end = t;
    const pause = x ? { ...x, start: t, end: (t += x.minutes), label: label(end, t) } : null;
    return { block: b, start, end, label: label(start, end), pause };
  });
}

/** Einheitencheck: Liste von {level:'ok'|'warn'|'info', text}. */
export function check(s, p) {
  const out = [], age = planAge(s, p), slot = slotOf(s, p), total = totalMinutes(p, s), ps = pauses(s, p);
  if (!p.blocks.length) return [{ level: 'info', text: 'Noch keine Übungen in der Einheit.' }];
  const rows = p.blocks.map(b => ({ b, e: exercise(s, b.exerciseId), L: blockLayout(s, p, b) })).filter(r => r.e && r.L);
  const no = rows.filter(r => r.L.level === 'no'), tight = rows.filter(r => r.L.level === 'tight');
  for (const r of no.slice(0, 3)) out.push({ level: 'warn', text: `„${r.e.name}“: ${layoutAdvice(r.L)}` });
  for (const r of tight.slice(0, 4)) out.push({ level: r.L.why === 'longqueue' || r.L.why === 'idle' ? 'warn' : 'info', text: `„${r.e.name}“: ${layoutAdvice(r.L)}` });
  if (no.length + tight.length > 7) out.push({ level: 'info', text: `${no.length + tight.length - 7} weitere Blöcke mit Wartenden oder Wechseln.` });
  if (!no.length && !tight.length) out.push({ level: 'ok', text: 'Gruppengrößen und Schlangen passen in allen Blöcken.' });
  const parallel = Math.max(0, ...rows.filter(r => r.L.level !== 'no' && r.L.mode !== 'open').map(r => r.L.groups)), coaches = p.coaches ?? 1;
  if (parallel >= 2 && parallel > coaches) out.push({ level: 'info', text: `Bis zu ${parallel} Gruppen oder Schlangen gleichzeitig, aber ${coaches === 0 ? 'kein Trainer' : coaches === 1 ? 'ein Trainer' : `${coaches} Trainer`}. Aufgaben vorab erklären und Gruppen selbstständig laufen lassen.` });
  const ages = p.blocks.filter(b => { const e = exercise(s, b.exerciseId); return e && age && !e.ages.includes(age); });
  if (ages.length) out.push({ level: 'warn', text: `${ages.length} ${ages.length === 1 ? 'Übung ist' : 'Übungen sind'} nicht für ${age} vorgesehen.` });
  if (slot) {
    const target = slotMinutes(slot);
    out.push(total > target ? { level: 'warn', text: `${total - target} Min länger als die Trainingszeit (${target} Min)${ps.length ? ', Pausen eingerechnet' : ''}.` } : { level: 'ok', text: `${target - total} Min Puffer für Wechsel, Trinken und Erklären.` });
  }
  if (ps.length) out.push({ level: 'ok', text: `${ps.length} ${ps.length === 1 ? 'Pause' : 'Pausen'} à ${ps[0].minutes} Min eingeplant${pauseSetting(p).after ? '' : ', automatisch verteilt'}.` });
  else if (p.blocks.length >= 2 && exerciseMinutes(p) > pauseEvery(age) * 1.5) out.push({ level: 'info', text: `Keine Pausen eingeplant. Für ${age || 'deine Mannschaft'} etwa alle ${pauseEvery(age)} Min eine kurze Trinkpause vorsehen.` });
  const tags = p.blocks.map(b => exercise(s, b.exerciseId)?.tag);
  const games = tags.filter(t => t === 'Spielform' || t === 'Umschalten').length;
  if (p.blocks.length >= 3 && planType(s, p) !== 'keeper' && !games) out.push({ level: 'info', text: 'Keine Spielform enthalten. Ein freies Spiel am Ende erhöht die Spielzeit.' });
  if (tags[0] && tags[0] !== 'Aufwärmen' && p.blocks.length >= 3) out.push({ level: 'info', text: 'Die Einheit beginnt nicht mit einer Aufwärmübung.' });
  if (p.blocks.some(b => exercise(s, b.exerciseId)?.tag === 'Falltechnik')) out.push({ level: 'warn', text: 'Falltechnik nur auf weichem, ebenem Boden und mit geschulter Anleitung.' });
  if (p.focus && p.focus !== 'Alle') {
    const n = sum(p.blocks.filter(b => hasFocus(exercise(s, b.exerciseId), p.focus)), b => b.minutes);
    out.push(n ? { level: 'ok', text: `${n} von ${exerciseMinutes(p)} Min zahlen auf deinen Schwerpunkt „${p.focus}“ ein.` } : { level: 'warn', text: `Kein Block trainiert deinen Schwerpunkt „${p.focus}“.` });
  }
  const long = p.blocks.filter(b => b.minutes > 20);
  if (long.length && !ps.length) out.push({ level: 'info', text: 'Lange Blöcke in kurze Runden mit Trinkpausen teilen.' });
  if (age === 'Bambini' && p.blocks.some(b => exercise(s, b.exerciseId)?.type === 'keeper')) out.push({ level: 'warn', text: 'Bambini nicht auf die Torwartposition festlegen. Besser allgemeine Ballspiele.' });
  return out;
}

/** Rangliste für die Bibliothek mit nachvollziehbarer Begründung. */
export function score(s, p, e) {
  const reasons = [], L = layout(s, e, squadOf(s, p));
  let pts = 0;
  if (L.level !== 'no') { pts += L.level === 'ok' ? 100 : 70; reasons.push(layoutText(L)); } else reasons.push(L.why === 'nocoach' ? 'Trainer fehlt' : L.why === 'nokeeper' ? 'Torwart fehlt' : 'Spielerzahl passt nicht');
  if (p && p.focus !== 'Alle' && hasFocus(e, p.focus)) { pts += foci(e)[0] === p.focus || e.tag === p.focus ? 40 : 28; reasons.push('dein Schwerpunkt'); }
  const slot = p ? slotOf(s, p) : null, left = slot ? slotMinutes(slot) - totalMinutes(p, s) : 90;
  if (effective(s, e).minutes <= Math.max(0, left)) { pts += 20; reasons.push('passt in die Restzeit'); } else reasons.push('länger als die Restzeit');
  if (p?.blocks.some(b => b.exerciseId === e.id)) { pts -= 30; reasons.push('schon im Plan'); }
  const m = meta(s, e.id);
  if (m.rating) { pts += (m.rating - 3) * 6; if (m.rating >= 4) reasons.push(`von dir mit ${m.rating}★ bewertet`); }
  if (m.favorite) pts += 8;
  return { pts, reasons };
}

/** Ähnliche Übungen: gleiche Schwerpunkte/Kategorie/Trainerart, ähnliche Gruppengröße, gleiches Alter. */
export function similar(s, e, limit = 4) {
  return allExercises(s).filter(x => x.id !== e.id && x.tag !== 'Falltechnik')
    .map(x => ({ x, d: (x.tag === e.tag ? 0 : 4) - focusOverlap(x, e) * 2 + (x.type === e.type ? 0 : 3) + Math.abs(x.min - e.min) + Math.abs(x.max - e.max) * 0.5 + Math.abs(AGES.indexOf(x.ages[0]) - AGES.indexOf(e.ages[0])) + ((x.setupKind || '') === (e.setupKind || '') ? -1 : 0) }))
    .sort((a, b) => a.d - b.d || a.x.name.localeCompare(b.x.name)).slice(0, limit).map(o => o.x);
}

/** Lernweg: die ähnlichste leichtere und die ähnlichste anspruchsvollere Übung (je null, wenn es keine gibt). */
export function progression(s, e) {
  const near = similar(s, e, 16).filter(x => x.type === e.type || x.type === 'both' || e.type === 'both'), l = level(e);
  return { easier: near.find(x => level(x) < l) || null, harder: near.find(x => level(x) > l) || null };
}

/** Filtert passend zu Mannschaft/Alter/Trainerart. */
export function suits(s, p, e, { allowFall = false } = {}) {
  const age = planAge(s, p), type = planType(s, p);
  return (!age || e.ages.includes(age)) && (type === 'both' || e.type === type) && (allowFall || e.tag !== 'Falltechnik');
}

export const recent = (s, limit = 8) => Object.entries(s.exerciseMeta).filter(([, m]) => m.lastUsed).sort((a, b) => b[1].lastUsed - a[1].lastUsed).slice(0, limit).map(([id]) => exercise(s, id)).filter(Boolean);

/** Schwierigkeitsstufe (1 leicht – 3 anspruchsvoll) aus Redaktion oder Heuristik. */
export function level(e) {
  if (e.level) return e.level;
  const i = AGES.indexOf(e.ages[0]);
  return i <= 1 ? 1 : i <= 3 ? 2 : 3;
}
export const LEVEL_LABEL = { 1: 'Einstieg', 2: 'Mittel', 3: 'Anspruchsvoll' };
