// Fachlogik ohne DOM: Katalog, Gruppen, Material, Zeitbudget, Einheitencheck, Ranking.
import { SEED, AGES, TAGS } from '../data/drills.js';
import { META } from '../data/drill-meta.js';
import { FOCUS, FOCUS_KEYS, DRILL_FOCUS } from '../data/focus.js';
import { time, fmtTime, sum, DAYS } from './util.js';

export { AGES, TAGS, SEED };
export { FOCI, FOCUS, FOCUS_KEYS, AREAS, RELEVANT, MAX_FOCI } from '../data/focus.js';

// Katalog einmal zusammensetzen: Grunddaten + Redaktion (Ziel, Coaching-Punkte, Quellen, Archiv-Status) + Schwerpunkte.
const seedById = new Map(SEED.map(e => [e.id, { ...e, ...META[e.id], focus: DRILL_FOCUS[e.id] || (FOCUS[e.tag] ? [e.tag] : []) }]));

/** Übung inkl. redaktioneller Ergänzungen und Schwerpunkte. */
export function exercise(s, id) {
  return seedById.get(id) || s.custom.find(e => e.id === id) || null;
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

export const activeTeam = s => s.teams.find(t => t.id === s.activeTeamId) || null;
export const teamOf = (s, p) => s.teams.find(t => t.id === p?.teamId) || activeTeam(s);
export const currentPlan = s => s.plans.find(p => p.id === s.selectedPlanId) || null;
export const plansOfTeam = (s, teamId = s.activeTeamId) => s.plans.filter(p => !p.template && (p.teamId === teamId || p.teamId === null));
export const templates = s => s.plans.filter(p => p.template);
export const planAge = (s, p) => p?.age || teamOf(s, p)?.age || null;
export const planType = (s, p) => teamOf(s, p)?.type || 'field';
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
    const g = fit(s, e, blockPeople(p, b)) || 1;
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
  const bad = p.blocks.filter(b => { const e = exercise(s, b.exerciseId); return e && !fit(s, e, blockPeople(p, b)); });
  out.push(bad.length ? { level: 'warn', text: `${bad.length} ${bad.length === 1 ? 'Block passt' : 'Blöcke passen'} nicht zur Spielerzahl. Gruppen oder Spieler anpassen.` } : { level: 'ok', text: 'Gruppengrößen passen in allen Blöcken.' });
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
  const n = p?.people || 12, reasons = [];
  let pts = 0;
  const g = fit(s, e, n);
  if (g) { pts += 100; reasons.push(`${g} ${g > 1 ? 'Gruppen' : 'Gruppe'} für ${n} Spieler`); } else reasons.push('Spielerzahl passt nicht');
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
