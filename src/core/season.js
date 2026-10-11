// Saison-Autopilot (21.13): regelbasierter, lokaler Saisonbogen. Kein Server, keine KI.
// Eingabe: Saisonziele der Mannschaft (einmal gewählt), Altersklasse, gehaltene Trainings samt Stimmung (1-5) und Fokus-Historie.
// Ausgabe: Vorschlag für den Wochenfokus (1-2 Schwerpunkte) mit kurzer Begründung.
import { RELEVANT, FOCUS_KEYS } from '../data/focus.js';
import { past, addDays, todayIso, doneBlocks, eventsOfTeam, mondayOf } from './calendar.js';
import { focusMinutes } from './planning.js';

/** Kern-Schwerpunkte je Altersklasse = der Bogen: vorne steht, was in dem Alter zuerst zählt. */
export const AGE_ARC = {
  Bambini: ['Dribbling', 'Koordination', 'Beidfüßigkeit', 'Torschuss'],
  'F-Jugend': ['Dribbling', 'Koordination', '1 gegen 1', 'Torschuss', 'Ballannahme'],
  'E-Jugend': ['Dribbling', 'Ballannahme', 'Passspiel', '1 gegen 1', 'Torschuss', 'Wahrnehmung', 'Beidfüßigkeit'],
  'D-Jugend': ['Passspiel', 'Ballannahme', 'Freilaufen', 'Zusammenspiel', '1 gegen 1', 'Wahrnehmung', 'Beidfüßigkeit'],
  'C-Jugend': ['Zusammenspiel', 'Spieleröffnung', 'Umschalten', 'Verteidigen', 'Ballbesitz', 'Freilaufen', 'Schnelligkeit'],
  'B-Jugend': ['Umschalten', 'Verteidigen', 'Spieleröffnung', 'Ballbesitz', 'Zusammenspiel', 'Schnelligkeit'],
  'A-Jugend': ['Umschalten', 'Verteidigen', 'Spieleröffnung', 'Ballbesitz', 'Zusammenspiel', 'Schnelligkeit'],
  'Männer': ['Umschalten', 'Verteidigen', 'Spieleröffnung', 'Ballbesitz', 'Zusammenspiel', 'Schnelligkeit'],
};
const KEEPER_ARC = ['Grundhaltung', 'Stellungsspiel', 'Fangen', 'Spieleröffnung', 'Ballannahme', 'Passspiel'];

/** Auswahl für die einmalige Frage „Was ist dein Saisonziel?“ (6 Chips, passend zur Mannschaft). */
export function goalOptions(team) {
  const rel = new Set(RELEVANT[team?.type] || RELEVANT.field);
  const base = team?.type === 'keeper' ? KEEPER_ARC : (AGE_ARC[team?.age] || AGE_ARC['E-Jugend']);
  return base.filter(k => rel.has(k)).slice(0, 6);
}
export const arcOf = team => (team?.type === 'keeper' ? KEEPER_ARC : (AGE_ARC[team?.age] || AGE_ARC['E-Jugend']));
export const hasSeason = team => !!team?.season;
export const seasonGoals = team => team?.season?.goals || [];

/** Pro Schwerpunkt: wie oft zuletzt trainiert, mittlere Stimmung der Trainings damit, Tage seit dem letzten Mal. */
export function history(s, team, now = new Date()) {
  const held = past(s, { teamId: team.id, now }).filter(ev => ev.kind === 'training' && ev.status === 'erledigt' && ev.done?.exercises?.length);
  const out = {};
  for (const ev of held) {
    for (const o of focusMinutes(doneBlocks(s, ev.done)).list) {
      const h = (out[o.key] ||= { sessions: 0, ratings: [], last: '' });
      h.sessions++; if (ev.rating) h.ratings.push(ev.rating); if (ev.date > h.last) h.last = ev.date;
    }
  }
  const today = todayIso(now);
  for (const h of Object.values(out)) {
    h.avg = h.ratings.length ? h.ratings.reduce((a, b) => a + b, 0) / h.ratings.length : null;
    h.days = Math.round((new Date(today) - new Date(h.last)) / 864e5);
  }
  return out;
}

/** Bewertet jeden relevanten Schwerpunkt. `planned` = bereits für diese/nahe Termine vorgesehene Schwerpunkte (Zahl der Vorkommen). */
export function scoreFoci(s, team, { planned = {}, now = new Date(), hist = history(s, team, now) } = {}) {
  const goals = new Set(seasonGoals(team)), arc = arcOf(team), rel = RELEVANT[team.type] || RELEVANT.field;
  const list = rel.filter(k => k !== 'Falltechnik');
  return list.map(key => {
    const h = hist[key], ai = arc.indexOf(key);
    let score = ai >= 0 ? 2 - ai * 0.2 : 0, why = ai >= 0 ? 'passt zur Altersklasse' : '';
    if (goals.has(key)) { score += 3; why = 'Saisonziel'; }
    if (!h) { score += 1.5; if (!goals.has(key) && ai >= 0) why = 'noch nicht dran gewesen'; }
    else {
      if (h.days >= 21 && (goals.has(key) || ai >= 0)) { score += 1.5; if (!goals.has(key)) why = 'lange nicht trainiert'; }
      if (h.avg !== null && h.sessions >= 1) {
        if (h.avg <= 2.5) { score += 2.5; why = 'lief zuletzt holprig - nochmal'; }
        else if (h.avg >= 4 && h.days < 14) { score -= 1.5; if (!goals.has(key)) why = ''; }
        else if (h.avg >= 4 && goals.has(key)) why = 'gut gelaufen - weiter im Bogen';
      }
      if (h.days < 5) score -= 1;
    }
    score -= (planned[key] || 0) * 4;
    return { key, score, why };
  }).sort((a, b) => b.score - a.score || FOCUS_KEYS.indexOf(a.key) - FOCUS_KEYS.indexOf(b.key));
}

/** Vorschlag für einen Tag: 2 Schwerpunkte (der zweite nur, wenn er fast so gut ist). */
export function suggest(s, team, opts = {}) {
  if (!hasSeason(team)) return null;
  const ranked = scoreFoci(s, team, opts), top = ranked[0];
  if (!top) return null;
  const picks = [top], second = ranked[1];
  if (second && second.score >= top.score - 1.2) picks.push(second);
  return { foci: picks.map(p => p.key), why: picks.map(p => p.why).filter(Boolean)[0] || 'Saisonbogen', details: picks };
}

/** Vorschläge für alle noch offenen Trainingstermine einer Woche, nacheinander: was früher in der Woche dran ist, kommt später nicht doppelt. */
export function suggestWeek(s, team, weekMonday, now = new Date()) {
  const out = {}; if (!hasSeason(team)) return out;
  const end = addDays(weekMonday, 6), hist = history(s, team, now), planned = {};
  const evs = eventsOfTeam(s).filter(e => e.date >= weekMonday && e.date <= end && e.kind === 'training' && e.status === 'geplant').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  for (const e of evs) for (const k of e.foci || []) planned[k] = (planned[k] || 0) + 1;
  for (const e of evs) {
    if (e.foci?.length) continue;
    const sg = suggest(s, team, { planned, now, hist });
    if (!sg) continue;
    out[e.id] = sg; for (const k of sg.foci) planned[k] = (planned[k] || 0) + 1;
  }
  return out;
}
export { mondayOf };
