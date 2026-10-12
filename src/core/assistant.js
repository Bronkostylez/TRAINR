// Regelbasierter Planassistent – keine KI, keine Datenübertragung. Jede Wahl wird begründet.
import { allExercises, layout, layoutText, effective, meta, foci, hasFocus, pauseCount, AGES, FOCUS_KEYS, MAX_FOCI } from './planning.js';
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
// Kinder halten kürzere Blöcke durch: Empfehlung für die Rundenlänge je Altersklasse (Vorschlag, keine Norm).
const BLOCK_CAP = { Bambini: 8, 'F-Jugend': 10, 'E-Jugend': 12, 'D-Jugend': 16 };

/** Gewählte Schwerpunkte aus dem Rahmen: `foci` (neu, mehrere) oder `focus` (alt, einer). Max. MAX_FOCI, nie Falltechnik. */
export function selectedFoci(f) {
  const list = (Array.isArray(f.foci) ? f.foci : []).filter(k => FOCUS_KEYS.includes(k) && k !== 'Falltechnik');
  if (!list.length && f.focus && f.focus !== 'Alle' && f.focus !== 'Falltechnik') list.push(f.focus);
  return [...new Set(list)].slice(0, MAX_FOCI);
}

/**
 * Erstellt einen Vorschlag.
 * @param {object} s Zustand
 * @param {{age:string, people:number, minutes:number, focus?:string, foci?:string[], type:string, strategy?:string, seed?:number, avoidRecent?:boolean, pauses?:{count:'auto'|number, minutes:number}}} f Rahmen
 * `minutes` ist die Gesamtzeit: eingeplante Pausen werden vorher abgezogen, die Übungen füllen den Rest.
 * Mehrere Schwerpunkte (`foci`) werden auf die Schwerpunkt-Phasen verteilt; Übungen, die mehrere davon treffen, steigen auf.
 */
export function propose(s, f) {
  const { age, people, minutes, type } = f, keepers = f.keepers ?? 0, coaches = f.coaches ?? 1;
  const strategy = STRATEGIES[f.strategy] ? f.strategy : 'classic', strat = STRATEGIES[strategy];
  if (!AGES.includes(age) || !integer(people, 1, 60) || !integer(keepers, 0, 20) || !integer(coaches, 0, 10) || !integer(minutes, 20, 150)) throw new Error('20–150 Minuten und 1–60 Spieler wählen.');
  const notes = [], sq = type === 'keeper' ? { players: 0, keepers: people + keepers, coaches } : { players: people, keepers, coaches };
  let useType = type;
  // Bambini und F-Jugend nicht früh auf die Torwartposition festlegen.
  if (type === 'keeper' && AGES.indexOf(age) <= 1) { useType = 'field'; notes.push(`${age}: Statt Torwarttraining allgemeine Ballspiele für alle Kinder. Keine feste Torwartrolle.`); }
  if (AGES.indexOf(age) <= 1) notes.push(`${age}: Erklärungen unter einer Minute halten, eher spielen als lange üben.`);
  const picked = selectedFoci(f);
  const focusList = picked.length ? picked : [DEFAULT_FOCUS[useType]];
  const pool = allExercises(s).filter(e => e.ages.includes(age) && (useType === 'both' || e.type === useType) && e.tag !== 'Falltechnik' && (!f.sourceOnly || useType !== 'keeper' || e.sourceVerified === true) && layout(s, e, sq).level !== 'no');
  if (!pool.length) throw new Error('Für diese Spielerzahl und Altersklasse gibt es keine passende Übung. Spielerzahl ändern oder manuell planen.');
  const random = rng(f.seed ?? 1), now = Date.now();
  const phases = (useType === 'keeper' ? strat.keeper : strat.field);
  const used = new Set(), blocks = [];
  let focusPhase = 0; // Schwerpunkt-Phasen rotieren durch die gewählten Schwerpunkte
  for (const [phase, wants, weight] of phases) {
    const phaseFocus = focusList[focusList.length > 1 ? focusPhase % focusList.length : 0];
    if (wants.includes('FOCUS')) focusPhase++;
    // Phasen-Kategorien treffen die Übungsart; der Schwerpunkt der Phase trifft jede Übung, die ihn trainiert (auch als Nebenschwerpunkt).
    const match = e => wants.findIndex(t => (t === 'FOCUS' ? hasFocus(e, phaseFocus) : e.tag === t));
    const rank = e => {
      let r = 0; const why = [];
      const ti = match(e);
      if (ti === 0) { r += 50; why.push(wants[0] === 'FOCUS' ? (focusList.length > 1 ? `Schwerpunkt „${phaseFocus}“` : 'dein Schwerpunkt') : e.tag); } else if (ti > 0) { r += 35 - ti * 5; why.push(wants[ti] === 'FOCUS' ? `Schwerpunkt „${phaseFocus}“` : e.tag); }
      const L = layout(s, e, sq); // Gruppen nur, wo die Übung sie braucht; Schlangen nicht zu lang, Wartende und Wechsler kosten Punkte
      r += L.mode === 'open' ? 9 : L.mode === 'queue' ? (L.waiting <= L.active ? 8 : 0) : L.groups === 1 ? 6 : L.groups <= 3 ? 10 : 4;
      if (L.level === 'tight') r -= 6;
      const m = meta(s, e.id);
      if (m.rating) { r += (m.rating - 3) * 5; if (m.rating >= 4) why.push(`${m.rating}★ von dir`); }
      if (m.favorite) { r += 4; why.push('auf deiner Merkliste'); }
      if (f.avoidRecent !== false && m.lastUsed && now - m.lastUsed < 10 * 864e5) { r -= 12; why.push('kürzlich genutzt'); }
      if (wants.includes('FOCUS') && foci(e)[0] === phaseFocus) r += 6; // Hauptschwerpunkt vor Nebenschwerpunkt
      // Roter Faden: Übungen, die mehrere gewählte Schwerpunkte gleichzeitig trainieren, steigen auf.
      const overlap = focusList.filter(k => hasFocus(e, k) && k !== phaseFocus);
      if (overlap.length) { r += 5 * overlap.length; why.push(overlap.length === 1 ? `passt zu „${overlap[0]}“` : `trainiert auch ${overlap.map(k => `„${k}“`).join(' und ')}`); }
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
    const L = layout(s, choice.e, sq);
    blocks.push({ exerciseId: choice.e.id, phase, weight, groups: L.groups, flow: L.mode, alternatives: alts,
      why: [fallback ? `${wants.map(t => (t === 'FOCUS' ? phaseFocus : t))[0]} nicht verfügbar – Alternative ${choice.e.tag}` : `${phase}: ${choice.why[0] || choice.e.tag}`, layoutText(L), ...choice.why.slice(1)].join(' · ') });
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
  const cap = BLOCK_CAP[age] || 0;
  blocks.forEach(b => {
    const e = effective(s, allExercises(s).find(x => x.id === b.exerciseId));
    const round = cap ? Math.min(e.minutes, cap) : e.minutes;
    if (b.minutes > round * 2.2 || (cap && b.minutes > cap)) b.why += ` · in ${Math.ceil(b.minutes / round)} Runden à ${round} Min teilen${cap && cap < e.minutes ? ` (kurze Blöcke für ${age})` : ''}`;
  });
  return { age, people, keepers, coaches, minutes, focus: picked.length ? picked[0] : 'Alle', foci: picked, type, useType, strategy, seed: f.seed ?? 1, notes, blocks, pauses: pz, pauseCount: pn };
}
