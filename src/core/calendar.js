// Kalender-Fachlogik ohne DOM: Datumsrechnung, Serien aus Trainingszeiten, Erinnerungen, Rückblick, ICS-Export.
// Datumswerte sind lokale Kalendertage als 'YYYY-MM-DD'; Uhrzeiten 'HH:MM' in Ortszeit.
import { uid, time, sum, DAYS, DAYS_SHORT, APP_VERSION } from './util.js';
import { exercise, totalMinutes, focusMinutes, planFocus, keyFirst, RELEVANT, FOCUS_KEYS } from './planning.js';
import { LIMITS } from './schema.js';

export const KIND = { training: 'Training', spiel: 'Spiel', turnier: 'Turnier', termin: 'Termin' };
export const STATUS = { geplant: 'Geplant', erledigt: 'Gehalten', ausgefallen: 'Ausgefallen' };
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const REMIND = [[null, 'Keine'], [15, '15 Min vorher'], [30, '30 Min vorher'], [60, '1 Std vorher'], [120, '2 Std vorher'], [1440, '1 Tag vorher'], [2880, '2 Tage vorher']];
export const REASONS = ['Wetter', 'Platz gesperrt', 'Ferien', 'Zu wenige Spieler', 'Trainer verhindert'];
export const DEFAULT_REMIND = 60;

const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 'YYYY-MM-DD' → Date (lokale Mitternacht). */
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const todayIso = (now = new Date()) => iso(now);
/** Wochentag 0 = Montag … 6 = Sonntag (wie `slot.day`). */
export const weekday = s => (parse(s).getDay() + 6) % 7;
export const mondayOf = s => addDays(s, -weekday(s));
export const monthKey = s => s.slice(0, 7);
export const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return iso(d).slice(0, 7); };
export const monthLabel = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

/** 6 × 7 Tage ab dem Montag vor dem Monatsersten. */
export function monthGrid(key) {
  const start = mondayOf(`${key}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(s) {
  const d = parse(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/** 'Di, 14.10.' / lang: 'Dienstag, 14. Oktober 2026' / relativ: 'Heute', 'Morgen', 'Gestern' wo sinnvoll. */
export function fmtDate(s, { long = false, relative = false, now = new Date() } = {}) {
  if (relative) {
    const diff = Math.round((parse(s) - parse(iso(now))) / 864e5);
    if (diff === 0) return 'Heute'; if (diff === 1) return 'Morgen'; if (diff === -1) return 'Gestern';
  }
  const d = parse(s);
  return long ? `${DAYS[weekday(s)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : `${DAYS_SHORT[weekday(s)]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

export const startOf = ev => { const d = parse(ev.date), t = time(ev.start); d.setHours(Math.floor(t / 60), t % 60, 0, 0); return d; };
export const endOf = ev => { const d = parse(ev.date), t = time(ev.end); d.setHours(Math.floor(t / 60), t % 60, 0, 0); return d; };
export const duration = ev => time(ev.end) - time(ev.start);
export const isPast = (ev, now = new Date()) => endOf(ev) <= now;
export const title = ev => ev.title || KIND[ev.kind];
const byStart = (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start);

export const eventsOfTeam = (s, teamId = s.activeTeamId) => s.events.filter(ev => ev.teamId === teamId).sort(byStart);
export const eventsOn = (s, date, teamId = s.activeTeamId) => eventsOfTeam(s, teamId).filter(ev => ev.date === date);

/** Kommende Termine (inkl. gerade laufender), aufsteigend. */
export function upcoming(s, { teamId = s.activeTeamId, now = new Date(), limit = Infinity, status = ['geplant'] } = {}) {
  return eventsOfTeam(s, teamId).filter(ev => status.includes(ev.status) && endOf(ev) > now).slice(0, limit);
}
/** Vergangene Termine, neueste zuerst. `from`/`to` begrenzen auf Kalendertage (einschließlich). */
export function past(s, { teamId = s.activeTeamId, now = new Date(), from = null, to = null } = {}) {
  return eventsOfTeam(s, teamId).filter(ev => endOf(ev) <= now && (!from || ev.date >= from) && (!to || ev.date <= to)).reverse();
}
/** Vergangene, noch nicht nachbereitete Trainings. */
export const needsReview = (s, opts) => past(s, opts).filter(ev => ev.kind === 'training' && ev.status === 'geplant');

/** Leerer Termin für eine Mannschaft an einem Tag – Uhrzeit aus der passenden Trainingszeit. */
export function blankEvent(team, date, kind = 'training') {
  const slot = team.slots.find(x => x.day === weekday(date)) || team.slots[0];
  return { id: uid(), teamId: team.id, date, start: slot?.start || '17:00', end: slot?.end || '18:30', kind, title: '', place: '', planId: null, status: 'geplant', remind: kind === 'training' ? DEFAULT_REMIND : null, note: '' };
}

/**
 * Trainingsserie aus den Trainingszeiten der Mannschaft: von `from` bis einschließlich `until`.
 * Tage, an denen schon ein Training der Mannschaft liegt, und `skip`-Tage (Ferien) werden ausgelassen.
 */
export function series(s, team, { from, until, remind = DEFAULT_REMIND, skip = [] }) {
  const taken = new Set(s.events.filter(ev => ev.teamId === team.id && ev.kind === 'training').map(ev => ev.date));
  const skipSet = new Set(skip), seriesId = uid(), out = [];
  for (let d = from; d <= until && out.length < 400; d = addDays(d, 1)) {
    const slot = team.slots.find(x => x.day === weekday(d));
    if (!slot || taken.has(d) || skipSet.has(d)) continue;
    out.push({ ...blankEvent(team, d), start: slot.start, end: slot.end, remind, seriesId });
  }
  return out;
}

// ---------- Automatische Serie je Mannschaft ----------
// Trainings aus den Trainingszeiten stehen immer AUTO_WEEKS Wochen im Voraus im Kalender.
// `team.seriesUntil` merkt sich, bis wohin schon eingetragen wurde – gelöschte Einzeltermine kommen so nicht zurück.
export const AUTO_WEEKS = 8;
export const autoSeriesId = team => `auto-${team.id}`;
export const autoOn = team => team.autoSeries !== false;

/** Füllt die automatischen Serien im Entwurf auf. Gibt die Zahl neuer Termine zurück. */
export function autoFill(d, now = new Date()) {
  const today = iso(now), horizon = addDays(today, AUTO_WEEKS * 7 - 1);
  let added = 0;
  for (const team of d.teams) {
    if (!autoOn(team) || (team.seriesUntil && team.seriesUntil >= horizon)) continue;
    const from = team.seriesUntil && team.seriesUntil >= today ? addDays(team.seriesUntil, 1) : today;
    const room = LIMITS.events - d.events.length; if (room <= 0) break;
    const list = series(d, team, { from, until: horizon }).slice(0, room).map(ev => ({ ...ev, seriesId: autoSeriesId(team) }));
    d.events.push(...list); added += list.length;
    team.seriesUntil = horizon;
  }
  return added;
}

/**
 * Nach geänderten Trainingszeiten: unberührte künftige Serientermine anpassen (neue Uhrzeit) oder entfernen (Tag gestrichen),
 * dann neu auffüllen. Termine mit Einheit, Notiz, Titel oder Ort bleiben unangetastet.
 */
export function resyncAuto(d, oldTeam, team, now = new Date()) {
  team.seriesUntil = oldTeam?.seriesUntil; if (oldTeam?.autoSeries === false) team.autoSeries = false;
  if (oldTeam && JSON.stringify(oldTeam.slots) !== JSON.stringify(team.slots)) {
    const today = iso(now), sid = autoSeriesId(team);
    const touched = ev => ev.planId || ev.note || ev.title || ev.place;
    d.events = d.events.filter(ev => {
      if (ev.seriesId !== sid || ev.status !== 'geplant' || ev.date < today || touched(ev)) return true;
      const was = oldTeam.slots.find(x => x.day === weekday(ev.date)), slot = team.slots.find(x => x.day === weekday(ev.date));
      if (!slot) return false;
      if (was && ev.start === was.start && ev.end === was.end) { ev.start = slot.start; ev.end = slot.end; }
      return true;
    });
    delete team.seriesUntil; // neue Trainingstage ab heute ergänzen; vorhandene Tage werden übersprungen
  }
  if (team.seriesUntil === undefined) delete team.seriesUntil;
  autoFill(d, now);
}

/** Alle Tage zwischen zwei Daten (für Ferien/Pausen). */
export function range(from, to) { const out = []; for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d); return out; }

/** Momentaufnahme einer Einheit für den Rückblick (bleibt, auch wenn die Einheit später geändert oder gelöscht wird). */
export function snapshot(plan, s) {
  return { name: plan.name, minutes: totalMinutes(plan, s), focus: plan.focus, exercises: plan.blocks.map(b => b.exerciseId), blocks: plan.blocks.map(b => [b.exerciseId, b.minutes]) };
}

/** [Übung, Minuten] einer gehaltenen Einheit. Ältere Momentaufnahmen ohne Blockminuten: Zeit gleichmäßig verteilt. */
export function doneBlocks(s, done) {
  if (!done) return [];
  if (done.blocks) return done.blocks.map(([id, min]) => [exercise(s, id), min]);
  const each = done.exercises.length ? done.minutes / done.exercises.length : 0;
  return done.exercises.map(id => [exercise(s, id), each]);
}
/** Schwerpunkte eines Termins: gehalten → Momentaufnahme, sonst die zugeordnete Einheit. */
export function eventFocus(s, ev) {
  if (ev.done) return focusMinutes(doneBlocks(s, ev.done));
  const plan = s.plans.find(p => p.id === ev.planId);
  return plan ? planFocus(s, plan) : null;
}

/** Zeitpunkt der Erinnerung oder null. */
export function remindAt(ev) {
  if (ev.remind === null || ev.status !== 'geplant') return null;
  return new Date(startOf(ev).getTime() - ev.remind * 60_000);
}
/** Fällige Erinnerungen: Zeitpunkt erreicht, Termin noch nicht vorbei, noch nicht gemeldet. */
export function dueReminders(s, now = new Date(), seen = new Set()) {
  return s.events.filter(ev => { const at = remindAt(ev); return at && at <= now && endOf(ev) > now && !seen.has(reminderKey(ev)); }).sort(byStart);
}
/** Schlüssel ändert sich, wenn Datum, Zeit oder Vorlauf geändert werden – dann wird neu erinnert. */
export const reminderKey = ev => `${ev.id}|${ev.date}|${ev.start}|${ev.remind}`;
export const remindLabel = m => REMIND.find(([v]) => v === m)?.[1] || (m >= 1440 ? `${Math.round(m / 1440)} Tage vorher` : `${m} Min vorher`);

/** Rückblick über einen Zeitraum (nur vergangene Termine). */
export function stats(s, { teamId = s.activeTeamId, from = null, to = null, now = new Date() } = {}) {
  const list = past(s, { teamId, now, from, to }), trainings = list.filter(ev => ev.kind === 'training');
  const held = trainings.filter(ev => ev.status === 'erledigt'), cancelled = trainings.filter(ev => ev.status === 'ausgefallen');
  const att = held.filter(ev => ev.attendance !== undefined), rated = held.filter(ev => ev.rating !== undefined);
  const focus = {}, ex = {}, reasons = {}, pairs = [];
  for (const ev of held) {
    if (ev.done) {
      if (ev.done.focus !== 'Alle') focus[ev.done.focus] = (focus[ev.done.focus] || 0) + 1;
      for (const id of new Set(ev.done.exercises)) ex[id] = (ex[id] || 0) + 1;
      pairs.push(...doneBlocks(s, ev.done));
    }
  }
  // Wie oft ein Schwerpunkt in gehaltenen Trainings vorkam (Trainings, nicht Blöcke).
  const sessions = {};
  for (const ev of held) for (const f of new Set(focusMinutes(doneBlocks(s, ev.done)).list.map(o => o.key))) sessions[f] = (sessions[f] || 0) + 1;
  const trained = focusMinutes(pairs);
  trained.list.forEach(o => { o.sessions = sessions[o.key] || 0; });
  const team = s.teams.find(t => t.id === teamId);
  const missing = trained.total ? (RELEVANT[team?.type] || RELEVANT.field).filter(k => !sessions[k]) : [];
  for (const ev of cancelled) { const r = ev.reason || 'Ohne Grund'; reasons[r] = (reasons[r] || 0) + 1; }
  const topExercises = Object.entries(ex).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ e: exercise(s, id), n })).filter(x => x.e);
  return {
    trainings: trainings.length, held: held.length, cancelled: cancelled.length, open: trainings.length - held.length - cancelled.length,
    games: list.filter(ev => ev.kind === 'spiel' || ev.kind === 'turnier').length,
    minutes: sum(held, ev => ev.done?.minutes || duration(ev)),
    attendance: att.length ? Math.round(sum(att, ev => ev.attendance) / att.length * 10) / 10 : null,
    rating: rated.length ? Math.round(sum(rated, ev => ev.rating) / rated.length * 10) / 10 : null,
    rate: held.length + cancelled.length ? Math.round(held.length / (held.length + cancelled.length) * 100) : null,
    focus: Object.entries(focus).sort((a, b) => b[1] - a[1]), trained, missing, planned: held.filter(ev => ev.done).length, reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]), topExercises,
  };
}

/**
 * Schwerpunkte, die in den letzten `days` Tagen in keinem gehaltenen Training vorkamen – nur wenn es genug Daten gibt
 * (mindestens zwei nachbereitete Trainings mit Einheit). Reihenfolge: Katalogreihenfolge (Technik zuerst).
 */
export function neglected(s, { teamId = s.activeTeamId, days = 28, now = new Date() } = {}) {
  const team = s.teams.find(t => t.id === teamId); if (!team) return [];
  const held = past(s, { teamId, now, from: addDays(iso(now), -days) }).filter(ev => ev.kind === 'training' && ev.status === 'erledigt' && ev.done?.exercises.length);
  if (held.length < 2) return [];
  const seen = new Set(held.flatMap(ev => focusMinutes(doneBlocks(s, ev.done)).list.map(o => o.key)));
  return (RELEVANT[team.type] || RELEVANT.field).filter(k => !seen.has(k) && k !== 'Falltechnik').sort((a, b) => FOCUS_KEYS.indexOf(a) - FOCUS_KEYS.indexOf(b));
}

/** Beginn der laufenden Saisonhälfte: 1. Juli bzw. 1. Januar. */
export function seasonStart(now = new Date()) { return `${now.getFullYear()}-${now.getMonth() >= 6 ? '07' : '01'}-01`; }

// ---------- ICS (RFC 5545) ----------
const icsText = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
const icsLocal = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const icsUtc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Zeilen auf 75 Zeichen falten (Fortsetzung mit Leerzeichen). */
function fold(line) { const out = []; let l = line; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); }

/** Termine als iCalendar-Datei. Ortszeit ohne Zeitzone („floating“) – passt für Kalender auf demselben Gerät/in derselben Zone. */
export function toICS(s, events, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//TRAINR//${APP_VERSION}//DE`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:TRAINR'];
  for (const ev of events) {
    const team = s.teams.find(t => t.id === ev.teamId), plan = s.plans.find(p => p.id === ev.planId);
    const desc = [team?.name, plan ? `Einheit: ${plan.name} (${totalMinutes(plan, s)} Min)` : '', plan?.goal ? `Ziel: ${plan.goal}` : '', plan?.blocks.length ? `Schwerpunkte: ${keyFirst(planFocus(s, plan).list, plan.focus).slice(0, 4).map(o => o.key).join(', ')}` : '',
      plan ? plan.blocks.map((b, i) => `${i + 1}. ${exercise(s, b.exerciseId)?.name || ''} – ${b.minutes} Min`).join('\n') : '', ev.note || ''].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@trainr.local`, `DTSTAMP:${icsUtc(now)}`, `DTSTART:${icsLocal(ev.date, ev.start)}`, `DTEND:${icsLocal(ev.date, ev.end)}`,
      `SUMMARY:${icsText(`${title(ev)}${team ? ' · ' + team.name : ''}`)}`);
    if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`);
    if (ev.place) lines.push(`LOCATION:${icsText(ev.place)}`);
    if (ev.status === 'ausgefallen') lines.push('STATUS:CANCELLED');
    if (ev.remind !== null && ev.status === 'geplant') lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title(ev))}`, `TRIGGER:-PT${ev.remind}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
