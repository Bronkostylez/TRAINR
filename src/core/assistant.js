// Regelbasierter Planassistent – keine KI, keine Datenübertragung. Jede Wahl wird begründet.
import { allExercises, fit, effective, meta, foci, hasFocus, pauseCount, AGES } from './planning.js';
import { rng, integer } from './util.js';

export const STRATEGIES = {
  classic: {
    name: 'Klassisch', short: 'Aufwärmen, Spielen, Schwerpunkt, Abschlussspiel',
    why: 'Aufbau nach der DFB-„Besten Trainingseinheit“: aktivieren, spielen, gezielt üben, wieder spielen.',
    field: [['Aufwärmen', ['Aufwärmen'], .17], ['Spielen', ['Spielform', 'Umschalten'], .28], ['Schwerpunkt', ['FOCUS'], .22], ['Abschlussspiel', ['Spielform', 'Umschalten', 'Verteidigen'], .33]],
    keeper: [['Aufwärmen', ['Aufwärmen'], .2], ['Technik', ['FOCUS', 'Fangen', 'Grundhaltung'], .4], ['Anwenden', ['Spieleröffnung', 'Grundhaltung'], .4]],
  },
  games: {
    name: 'Spielintensiv', short: 'Viel Spielzeit, kurze Technikphase',
    why: 'Möglichst viel Nettospielzeit in kleinen Spielformen; Technik steckt im Spiel.',
    field: [['Aufwärmen', ['Aufwärmen', 'Dribbling'], .15], ['Spiel 1', ['Spielform'], .3], ['Spiel 2', ['FOCUS', 'Umschalten', 'Verteidigen', 'Spielform'], .25], ['Abschlussspiel', ['Spielform', 'Umschalten'], .3]],
    keeper: [['Aufwärmen', ['Aufwärmen'], .2], ['Anwenden', ['Spieleröffnung'], .4], ['Spielnah', ['FOCUS', 'Grundhaltung', 'Spieleröffnung'], .4]],
  },
  technique: {
    name: 'Technik', short: 'Zwei Blöcke zum Schwerpunkt, dann Spiel',
    why: 'Schwerpunkt in zwei Stufen wiederholen (leichter → schwerer) und im Spiel anwenden.',
    field: [['Aufwärmen', ['Aufwärmen'], .18], ['Schwerpunkt 1', ['FOCUS'], .26], ['Schwerpunkt 2', ['FOCUS'], .26], ['Anwenden im Spiel', ['Spielform', 'Umschalten'], .3]],
    keeper: [['Aufwärmen', ['Aufwärmen'], .2], ['Technik 1', ['FOCUS', 'Fangen'], .3], ['Technik 2', ['FOCUS', 'Grundhaltung', 'Fangen'], .25], ['Anwenden', ['Spieleröffnung'], .25]],
  },
  short: {
    name: 'Kurz & knackig', short: 'Drei Blöcke für wenig Zeit',
    why: 'Für 30–45 Minuten: ein Einstieg, ein Schwerpunkt, ein Spiel.',
    field: [['Einstieg', ['Aufwärmen', 'Dribbling'], .25], ['Schwerpunkt', ['FOCUS'], .3], ['Spiel', ['Spielform', 'Umschalten'], .45]],
    keeper: [['Einstieg', ['Aufwärmen'], .3], ['Schwerpunkt', ['FOCUS', 'Fangen'], .7]],
  },
};
const DEFAULT_FOCUS = { field: 'Dribbling', keeper: 'Fangen', both: 'Passspiel' };

/**
 * Erstellt einen Vorschlag.
 * @param {object} s Zustand
 * @param {{age:string, people:number, minutes:number, focus:string, type:string, strategy?:string, seed?:number, avoidRecent?:boolean, pauses?:{count:'auto'|number, minutes:number}}} f Rahmen
 * `minutes` ist die Gesamtzeit: eingeplante Pausen werden vorher abgezogen, die Übungen füllen den Rest.
 */
export function propose(s, f) {
  const { age, people, minutes, type } = f;
  const strategy = STRATEGIES[f.strategy] ? f.strategy : 'classic', strat = STRATEGIES[strategy];
  if (!AGES.includes(age) || !integer(people, 1, 60) || !integer(minutes, 20, 150)) throw new Error('20–150 Minuten und 1–60 Spieler wählen.');
  const notes = [];
  let useType = type;
  // Bambini und F-Jugend nicht früh auf die Torwartposition festlegen.
  if (type === 'keeper' && AGES.indexOf(age) <= 1) { useType = 'field'; notes.push(`${age}: Statt Torwarttraining allgemeine Ballspiele für alle Kinder. Keine feste Torwartrolle.`); }
  const picked = f.focus !== 'Alle' && f.focus !== 'Falltechnik';
  const focus = picked ? f.focus : DEFAULT_FOCUS[useType];
  const pool = allExercises(s).filter(e => e.ages.includes(age) && (useType === 'both' || e.type === useType) && e.tag !== 'Falltechnik' && fit(s, e, people));
  if (!pool.length) throw new Error('Für diese Spielerzahl und Altersklasse gibt es keine passende Übung. Spielerzahl ändern oder manuell planen.');
  const random = rng(f.seed ?? 1), now = Date.now();
  const phases = (useType === 'keeper' ? strat.keeper : strat.field);
  const used = new Set(), blocks = [];
  for (const [phase, wants, weight] of phases) {
    const tags = wants.map(t => (t === 'FOCUS' ? focus : t));
    // Phasen-Kategorien treffen die Übungsart; der Schwerpunkt trifft jede Übung, die ihn trainiert (auch als Nebenschwerpunkt).
    const match = e => wants.findIndex(t => (t === 'FOCUS' ? hasFocus(e, focus) : e.tag === t));
    const rank = e => {
      let r = 0; const why = [];
      const ti = match(e);
      if (ti === 0) { r += 50; why.push(wants[0] === 'FOCUS' ? 'dein Schwerpunkt' : e.tag); } else if (ti > 0) { r += 35 - ti * 5; why.push(wants[ti] === 'FOCUS' ? 'dein Schwerpunkt' : e.tag); }
      const g = fit(s, e, people); r += g === 1 ? 6 : g <= 3 ? 10 : 4; // parallele Kleingruppen bevorzugt, aber nicht zu viele
      const m = meta(s, e.id);
      if (m.rating) { r += (m.rating - 3) * 5; if (m.rating >= 4) why.push(`${m.rating}★ von dir`); }
      if (m.favorite) { r += 4; why.push('auf deiner Merkliste'); }
      if (f.avoidRecent !== false && m.lastUsed && now - m.lastUsed < 10 * 864e5) { r -= 12; why.push('kürzlich genutzt'); }
      if (wants.includes('FOCUS') && foci(e)[0] === focus) r += 6; // Hauptschwerpunkt vor Nebenschwerpunkt
      else if (picked && !wants.includes('FOCUS') && hasFocus(e, focus)) { r += 5; why.push(`passt zu „${focus}“`); } // roter Faden durch die Einheit
      r += random() * 14; // Abwechslung, reproduzierbar über den Seed
      return { e, r, why };
    };
    const ranked = pool.filter(e => !used.has(e.id) && match(e) >= 0).map(rank).sort((a, b) => b.r - a.r);
    let choice = ranked[0], fallback = false;
    if (!choice) { // nichts aus den gewünschten Kategorien: nächstbeste, aber nie ein Aufwärmspiel als Hauptteil
      choice = pool.filter(e => !used.has(e.id) && (phase.startsWith('Aufwärmen') || phase === 'Einstieg' || e.tag !== 'Aufwärmen')).map(rank).sort((a, b) => b.r - a.r)[0];
      fallback = true;
    }
    if (!choice) throw new Error(`Für „${phase}“ fehlt eine passende Übung. Spielerzahl oder Trainerart ändern.`);
    used.add(choice.e.id);
    const alts = (ranked.length > 1 ? ranked.slice(1, 4) : pool.filter(e => !used.has(e.id) && e.tag === choice.e.tag).map(rank).slice(0, 3)).map(o => o.e.id);
    const g = fit(s, choice.e, people);
    blocks.push({ exerciseId: choice.e.id, phase, weight, groups: g, alternatives: alts,
      why: [fallback ? `${tags[0]} nicht verfügbar – Alternative ${choice.e.tag}` : `${phase}: ${choice.why[0] || choice.e.tag}`, `${g} ${g > 1 ? 'parallele Gruppen' : 'Gruppe'}`, ...choice.why.slice(1)].join(' · ') });
  }
  // Pausen zuerst abziehen (bei „Automatisch“ zählt die verbleibende Übungszeit), höchstens so viele, dass je Block 5 Min bleiben.
  const pz = f.pauses && f.pauses.count !== 0 ? { count: f.pauses.count, minutes: f.pauses.minutes } : null;
  let pn = 0;
  if (pz) {
    pn = pauseCount(pz, { age, minutes, blocks: blocks.length });
    if (pz.count === 'auto') pn = pauseCount(pz, { age, minutes: minutes - pn * pz.minutes, blocks: blocks.length });
    while (pn > 0 && minutes - pn * pz.minutes < blocks.length * 5) pn--;
    if (pn) notes.push(`${pn} ${pn === 1 ? 'Pause' : 'Pausen'} à ${pz.minutes} Min eingeplant – bleiben ${minutes - pn * pz.minutes} Min für Übungen.`);
    else if (pz.count !== 'auto') notes.push('Für Pausen ist die Einheit zu kurz.');
  }
  const play = minutes - pn * (pz?.minutes || 0);
  // „Automatisch“ nur behalten, wenn die Einheit selbst wieder genau so viele Pausen ergibt – sonst feste Anzahl, damit die Summe stimmt.
  if (pz?.count === 'auto' && pauseCount(pz, { age, minutes: play, blocks: blocks.length }) !== pn) pz.count = pn;
  // Minuten nach Gewichten; Rundung so, dass die Summe exakt stimmt.
  let left = play; const totalW = blocks.reduce((a, b) => a + b.weight, 0);
  blocks.forEach((b, i) => { b.minutes = i === blocks.length - 1 ? left : Math.max(3, Math.round(play * b.weight / totalW)); left -= b.minutes; });
  if (blocks.at(-1).minutes < 3) throw new Error('Zu wenig Zeit für diese Struktur. Mehr Minuten oder „Kurz & knackig“ wählen.');
  blocks.forEach(b => { const e = effective(s, allExercises(s).find(x => x.id === b.exerciseId)); if (b.minutes > e.minutes * 2.2) b.why += ` · in ${Math.ceil(b.minutes / e.minutes)} Runden à ${e.minutes} Min teilen`; });
  return { age, people, minutes, focus: f.focus, type, useType, strategy, seed: f.seed ?? 1, notes, blocks, pauses: pz, pauseCount: pn };
}
