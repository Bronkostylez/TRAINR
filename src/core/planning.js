// Fachlogik ohne DOM: Katalog, Gruppen, Material, Zeitbudget, Einheitencheck, Ranking.
import { SEED, AGES, TAGS } from '../data/drills.js';
import { META } from '../data/drill-meta.js';
import { time, fmtTime, sum, DAYS } from './util.js';

export { AGES, TAGS, SEED };

const seedById = new Map(SEED.map(e => [e.id, e]));

/** Übung inkl. redaktioneller Ergänzungen (Ziel, Coaching-Punkte, Quellen, Archiv-Status). */
export function exercise(s, id) {
  const base = seedById.get(id);
  if (base) return META[id] ? { ...base, ...META[id] } : base;
  return s.custom.find(e => e.id === id) || null;
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
export const totalMinutes = p => sum(p?.blocks || [], b => b.minutes);

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

/** Zeitstrahl: Start/Ende je Block, ausgehend vom Trainingsbeginn. */
export function timeline(s, p) {
  const slot = slotOf(s, p);
  let t = slot ? time(slot.start) : 0;
  return p.blocks.map(b => { const start = t; t += b.minutes; return { block: b, start, end: t, label: slot ? `${fmtTime(start)}–${fmtTime(t)}` : '' }; });
}

/** Einheitencheck: Liste von {level:'ok'|'warn'|'info', text}. */
export function check(s, p) {
  const out = [], age = planAge(s, p), slot = slotOf(s, p), total = totalMinutes(p);
  if (!p.blocks.length) return [{ level: 'info', text: 'Noch keine Übungen in der Einheit.' }];
  const bad = p.blocks.filter(b => { const e = exercise(s, b.exerciseId); return e && !fit(s, e, blockPeople(p, b)); });
  out.push(bad.length ? { level: 'warn', text: `${bad.length} ${bad.length === 1 ? 'Block passt' : 'Blöcke passen'} nicht zur Spielerzahl. Gruppen oder Spieler anpassen.` } : { level: 'ok', text: 'Gruppengrößen passen in allen Blöcken.' });
  const ages = p.blocks.filter(b => { const e = exercise(s, b.exerciseId); return e && age && !e.ages.includes(age); });
  if (ages.length) out.push({ level: 'warn', text: `${ages.length} ${ages.length === 1 ? 'Übung ist' : 'Übungen sind'} nicht für ${age} vorgesehen.` });
  if (slot) {
    const target = slotMinutes(slot);
    out.push(total > target ? { level: 'warn', text: `${total - target} Min länger als die Trainingszeit (${target} Min).` } : { level: 'ok', text: `${target - total} Min Puffer für Wechsel, Trinken und Erklären.` });
  }
  const tags = p.blocks.map(b => exercise(s, b.exerciseId)?.tag);
  const games = tags.filter(t => t === 'Spielform' || t === 'Umschalten').length;
  if (p.blocks.length >= 3 && planType(s, p) !== 'keeper' && !games) out.push({ level: 'info', text: 'Keine Spielform enthalten. Ein freies Spiel am Ende erhöht die Spielzeit.' });
  if (tags[0] && tags[0] !== 'Aufwärmen' && p.blocks.length >= 3) out.push({ level: 'info', text: 'Die Einheit beginnt nicht mit einer Aufwärmübung.' });
  if (p.blocks.some(b => exercise(s, b.exerciseId)?.tag === 'Falltechnik')) out.push({ level: 'warn', text: 'Falltechnik nur auf weichem, ebenem Boden und mit geschulter Anleitung.' });
  const long = p.blocks.filter(b => b.minutes > 20);
  if (long.length) out.push({ level: 'info', text: 'Lange Blöcke in kurze Runden mit Trinkpausen teilen.' });
  if (age === 'Bambini' && p.blocks.some(b => exercise(s, b.exerciseId)?.type === 'keeper')) out.push({ level: 'warn', text: 'Bambini nicht auf die Torwartposition festlegen. Besser allgemeine Ballspiele.' });
  return out;
}

/** Rangliste für die Bibliothek mit nachvollziehbarer Begründung. */
export function score(s, p, e) {
  const n = p?.people || 12, reasons = [];
  let pts = 0;
  const g = fit(s, e, n);
  if (g) { pts += 100; reasons.push(`${g} ${g > 1 ? 'Gruppen' : 'Gruppe'} für ${n} Spieler`); } else reasons.push('Spielerzahl passt nicht');
  if (p && p.focus === e.tag) { pts += 40; reasons.push('dein Schwerpunkt'); }
  const slot = p ? slotOf(s, p) : null, left = slot ? slotMinutes(slot) - totalMinutes(p) : 90;
  if (effective(s, e).minutes <= Math.max(0, left)) { pts += 20; reasons.push('passt in die Restzeit'); } else reasons.push('länger als die Restzeit');
  if (p?.blocks.some(b => b.exerciseId === e.id)) { pts -= 30; reasons.push('schon im Plan'); }
  const m = meta(s, e.id);
  if (m.rating) { pts += (m.rating - 3) * 6; if (m.rating >= 4) reasons.push(`von dir mit ${m.rating}★ bewertet`); }
  if (m.favorite) pts += 8;
  return { pts, reasons };
}

/** Ähnliche Übungen: gleiche Kategorie/Trainerart, ähnliche Gruppengröße, gleiches Alter. */
export function similar(s, e, limit = 4) {
  return allExercises(s).filter(x => x.id !== e.id && x.tag !== 'Falltechnik')
    .map(x => ({ x, d: (x.tag === e.tag ? 0 : 6) + (x.type === e.type ? 0 : 3) + Math.abs(x.min - e.min) + Math.abs(x.max - e.max) * 0.5 + Math.abs(AGES.indexOf(x.ages[0]) - AGES.indexOf(e.ages[0])) + ((x.setupKind || '') === (e.setupKind || '') ? -1 : 0) }))
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
