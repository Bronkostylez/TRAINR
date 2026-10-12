// Ein gemeinsames Dokumentmodell für PDF, PNG und Druck. Layouts: detailed | compact | cards | coach.
import { exercise, effective, blockLayout, layoutText, layoutAdvice, squadLabel, blockPeople, timeline, slotOf, slotLabel, planAge, planType, teamOf, totalMinutes, exerciseMinutes, pauses, requirements, check, foci, planFocus, keyFirst } from '../core/planning.js';
import { LABELS, BRAND } from '../core/util.js';
import { stepsFor } from '../scene/pitch.js';
import { t, locale } from '../i18n/index.js';

export const LAYOUTS = {
  detailed: ['Ausführlich', 'Alle Infos je Übung: Ziel, Ablauf, Coaching, Material, Quelle'],
  compact: ['Kompakt', 'Eine Übersicht – ideal zum Mitnehmen'],
  cards: ['Übungskarten', 'Eine Karte pro Übung mit Skizze (Druck)'],
  coach: ['Trainerkarte', 'Großer Text für den Platz'],
};
export const STYLES = { brand: 'Farbig', ink: 'Druckerfreundlich' };

const SAFETY = 'Spieler, Torwart und Trainer sind getrennt gezählt. Minuten enthalten Erklären, Trinken und Wechsel. Materialmengen: Höchstbedarf pro Block, Gruppen und Schlangen eingerechnet; bei unpassender Besetzung vorläufig. Altersgrenzen, Maße und Mengen sind Vorschläge, keine Normen. Tore sichern, freie Schusswege; Falltechnik nur auf weichem Boden mit geschulter Anleitung.';

/** Block-Daten für alle Layouts. */
export function blocksData(s, p) {
  return timeline(s, p).map(({ block: b, label, pause }, i) => {
    const e = exercise(s, b.exerciseId), n = blockPeople(p, b), L = blockLayout(s, p, b), g = L.level === 'no' ? 0 : L.groups, x = effective(s, e), age = planAge(s, p);
    const src = Array.isArray(e.sources) && e.sources.length ? e.sources.map(z => `${z.title}: ${z.url}`).join(' · ') : e.url || 'Eigene Übung';
    return {
      i, b, e, n, g, label, num: String(i + 1).padStart(2, '0'), keeper: e.type === 'keeper',
      pause: pause ? { minutes: pause.minutes, label: pause.label, text: `Trinkpause · ${pause.minutes} Min${pause.label ? ` (${pause.label})` : ''}` } : null,
      foci: foci(e).join(', '), kind: foci(e).slice(0, 3).join(' · ') || e.tag,
      groups: L.level === 'no' ? (L.why === 'nocoach' ? 'ACHTUNG: Trainer fehlt' : L.why === 'nokeeper' ? 'ACHTUNG: Torwart fehlt' : `ACHTUNG: ${n} Spieler passen nicht in Gruppen von ${x.min}–${x.max}`) : layoutText(L) + (L.level === 'tight' && layoutAdvice(L) ? ` – ${layoutAdvice(L)}` : ''),
      matLabel: L.mode === 'queue' ? 'Material je Schlange' : L.mode === 'open' ? 'Material insgesamt' : 'Material je Gruppe',
      material: e.equipment.map(([m, c]) => `${c} ${m}`).join(', '), points: Array.isArray(e.points) && e.points.length ? e.points : [e.coaching],
      steps: stepsFor(e), source: src, ageWarn: age && !e.ages.includes(age) ? `ACHTUNG: nicht für ${age} vorgesehen.` : '',
    };
  });
}

export function headerData(s, p) {
  const team = teamOf(s, p), slot = slotOf(s, p);
  return {
    title: p.name, team: team?.name || '', type: LABELS[planType(s, p)] || '', age: planAge(s, p) || '', slot: slot ? slotLabel(slot) : '',
    people: p.people, squad: squadLabel(p, planType(s, p)), total: totalMinutes(p, s), goal: p.goal || '', notes: p.notes || '',
    pauses: (() => { const ps = pauses(s, p); return ps.length ? `${exerciseMinutes(p)} Min Übungen + ${ps.length} ${ps.length === 1 ? 'Pause' : 'Pausen'} à ${ps[0].minutes} Min` : ''; })(),
    focus: p.focus && p.focus !== 'Alle' ? p.focus : '', foci: keyFirst(planFocus(s, p).list, p.focus).slice(0, 5).map(o => `${o.key} (${o.minutes} Min)`).join(', '),
    material: Object.entries(requirements(s, p)).map(([n, c]) => `${c} ${n}`), checks: check(s, p).filter(c => c.level === 'warn').map(c => c.text),
  };
}

/**
 * Baut eine Liste von Elementen, die der Seitenumbruch-Algorithmus in layoutPages() platziert.
 * Element: { k: 'title'|'meta'|'h'|'p'|'li'|'rule'|'gap'|'card'|'break', text, size, bold, color, keep }
 */
export function buildDoc(s, p, layout = 'detailed') {
  const h = headerData(s, p), B = blocksData(s, p), out = [];
  // Alle Texte laufen durch die Übersetzung: Das Dokument entsteht nicht im DOM und wird deshalb hier übersetzt.
  const push = (k, text = '', o = {}) => out.push({ k, text: t(text), ...o, ...(o.minutes ? { minutes: t(o.minutes) } : {}), ...(o.cols ? { cols: o.cols.map(c => t(String(c))) } : {}) });
  push('title', h.title);
  push('meta', [h.team, h.age, h.type].filter(Boolean).join(' · '));
  push('meta', [h.slot, h.squad, `${h.total} Min`, h.pauses].filter(Boolean).join(' · '));
  if (h.goal) push('p', `Ziel: ${h.goal}`, { bold: true });
  if (h.foci) push('p', `Schwerpunkte: ${h.focus ? `${h.focus} · ` : ''}${h.foci}`, { size: 9.5 });
  if (layout === 'compact') {
    push('gap', '', { h: 8 });
    for (const d of B) {
      push('row', '', { cols: [d.label || d.num, `${d.keeper ? '◆ ' : ''}${d.e.name}`, `${d.b.minutes} Min`], keeper: d.keeper });
      push('p', `${d.kind} · ${d.groups}${d.b.people ? ` · ${d.n} Spieler` : ''} · ${d.material}${d.b.note ? ` · ${d.b.note}` : ''}`, { size: 9, color: 'muted', indent: 62 });
      if (d.ageWarn) push('p', d.ageWarn, { size: 9, color: 'warn', indent: 62 });
      if (d.pause) push('row', '', { cols: [d.pause.label || '', '— Trinkpause —', `${d.pause.minutes} Min`], pause: true });
    }
  } else if (layout === 'coach') {
    for (const d of B) {
      push('h', `${d.num}  ${d.e.name}`, { size: 22, minutes: `${d.b.minutes} Min`, keeper: d.keeper, keep: 140 });
      push('p', `${d.groups}${d.b.note ? ` · ${d.b.note}` : ''}`, { size: 13, color: 'muted' });
      for (const t of d.points.slice(0, 3)) push('li', t, { size: 15 });
      if (d.pause) push('p', `— ${d.pause.text} —`, { size: 13, bold: true, color: 'muted' });
      push('gap', '', { h: 10 });
    }
  } else {
    for (const d of B) {
      if (layout === 'cards') push('cardstart', '', { keeper: d.keeper, keep: 300 });
      push('h', `${d.num} · ${d.e.name}`, { minutes: `${d.label ? d.label + ' · ' : ''}${d.b.minutes} Min`, keeper: d.keeper, keep: 160 });
      push('p', `${d.kind} · ${d.groups}${d.b.people ? ` · ${d.n} Spieler bei dieser Übung` : ''}`, { size: 9.5, bold: true, color: 'accent' });
      if (d.e.goal) push('p', `Ziel: ${d.e.goal}`, { size: 10 });
      d.steps.forEach((t, k) => push('li', `${k + 1}. ${t}`, { size: 10, bullet: false }));
      push('p', 'Coaching', { size: 9.5, bold: true });
      for (const t of d.points) push('li', t, { size: 10 });
      push('p', `${d.matLabel}: ${d.material}`, { size: 9.5 });
      if (d.b.note) push('p', `Notiz: ${d.b.note}`, { size: 9.5 });
      if (d.ageWarn) push('p', d.ageWarn, { size: 9.5, bold: true, color: 'warn' });
      push('p', `Quelle: ${d.source}`, { size: 8, color: 'muted' });
      if (layout === 'cards') push('cardend'); else push('gap', '', { h: 10 });
      if (d.pause) { push('p', `— ${d.pause.text} —`, { size: 10, bold: true, color: 'muted' }); push('gap', '', { h: 6 }); }
    }
  }
  push('gap', '', { h: 6 });
  push('h2', 'Materialübersicht', { keep: 60 });
  push('p', h.material.join(' · ') || 'Keine Übungen.', { size: 10 });
  if (h.checks.length) { push('h2', 'Hinweise', { keep: 40 }); for (const c of h.checks) push('li', c, { size: 9.5, color: 'warn' }); }
  if (h.notes) { push('h2', 'Coaching-Notizen', { keep: 40 }); push('p', h.notes, { size: 10 }); }
  push('gap', '', { h: 6 });
  push('p', SAFETY, { size: 8, color: 'muted' });
  return out;
}

// ---------- Seitenlayout (Einheiten in Punkt, A4) ----------
export const PAGE = { w: 595.28, h: 841.89, m: 44 };
let measureCtx;
/** Textbreite in pt (Arial ≈ Helvetica, daher für PDF-Standardschrift geeignet). */
export function measure(text, size, bold) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${bold ? 'bold ' : ''}100px Arial, Helvetica, sans-serif`;
  return measureCtx.measureText(text).width * size / 100;
}
export function wrap(text, size, bold, width) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const tryLine = line ? `${line} ${word}` : word;
      if (measure(tryLine, size, bold) <= width) { line = tryLine; continue; }
      if (line) lines.push(line);
      if (measure(word, size, bold) > width) { // sehr lange Wörter (URLs) hart umbrechen
        let chunk = '';
        for (const ch of word) { if (measure(chunk + ch, size, bold) > width) { lines.push(chunk); chunk = ''; } chunk += ch; }
        line = chunk;
      } else line = word;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Platziert die Elemente auf Seiten. Ergebnis: pages = [{ ops: [...] }]
 * op: { t:'text', x, y, s, bold, color, text } | { t:'rect', x, y, w, h, fill } | { t:'line', x1, y1, x2, y2, color, lw }
 */
export function layoutPages(doc, style = 'brand') {
  const W = PAGE.w, H = PAGE.h, M = PAGE.m, CW = W - 2 * M, pages = [];
  const C = style === 'ink'
    ? { ink: '#000000', muted: '#444444', accent: '#000000', warn: '#000000', bar: '#000000', barText: '#ffffff', keeper: '#5a2a99', soft: '#f2f2f2' }
    : { ink: '#14130e', muted: '#5a574d', accent: '#14130e', warn: '#9a3412', bar: '#14130e', barText: '#ffd400', keeper: '#9154d9', soft: '#f1ede3' };
  let page, y;
  const newPage = () => {
    page = { ops: [] }; pages.push(page);
    page.ops.push({ t: 'rect', x: 0, y: 0, w: W, h: 30, fill: C.bar });
    page.ops.push({ t: 'text', x: M, y: 19.5, s: 9, bold: true, color: C.barText, text: `${BRAND} / ${t('TRAININGSPLAN')}` });
    y = 58;
  };
  const room = need => { if (y + need > H - 48) newPage(); };
  const text = (str, { s = 10.5, bold = false, color = 'ink', indent = 0, lh = 1.38 } = {}) => {
    for (const ln of wrap(str, s, bold, CW - indent)) { room(s * lh); y += s; page.ops.push({ t: 'text', x: M + indent, y, s, bold, color: C[color] || color, text: ln }); y += s * (lh - 1); }
  };
  newPage();
  let cardTop = null, cardPage = null, cardKeeper = false;
  for (const el of doc) {
    if (el.keep) room(Math.min(el.keep, H - 120));
    switch (el.k) {
      case 'title': text(el.text, { s: 22, bold: true, lh: 1.2 }); y += 4; break;
      case 'meta': text(el.text, { s: 10.5, color: 'muted' }); break;
      case 'h2': y += 6; text(el.text, { s: 13, bold: true }); y += 2; break;
      case 'h': {
        const s = el.size || 13.5; room(s * 2.2); y += 8;
        if (el.keeper) page.ops.push({ t: 'rect', x: M - 10, y: y - 2, w: 4, h: s + 6, fill: C.keeper });
        const mw = el.minutes ? measure(el.minutes, s * .75, true) + 8 : 0;
        const lines = wrap(el.text, s, true, CW - mw);
        lines.forEach((ln, i) => { y += s; page.ops.push({ t: 'text', x: M, y, s, bold: true, color: C.ink, text: ln }); if (i === 0 && el.minutes) page.ops.push({ t: 'text', x: W - M - mw + 8, y, s: s * .75, bold: true, color: C.accent, text: el.minutes }); y += s * .3; });
        y += 3; break;
      }
      case 'p': text(el.text, { s: el.size || 10.5, bold: el.bold, color: el.color || 'ink', indent: el.indent || 0 }); y += 2; break;
      case 'li': {
        const s = el.size || 10.5; const lines = wrap(el.text, s, false, CW - 14);
        lines.forEach((ln, i) => { room(s * 1.38); y += s; if (i === 0 && el.bullet !== false) page.ops.push({ t: 'text', x: M + 2, y, s, color: C.accent, text: '•' }); page.ops.push({ t: 'text', x: M + 12, y, s, color: C[el.color] || C.ink, text: ln }); y += s * .38; });
        break;
      }
      case 'row': {
        room(18); y += 12;
        const [a, b, c] = el.cols;
        if (el.keeper) page.ops.push({ t: 'rect', x: M - 10, y: y - 10, w: 4, h: 14, fill: C.keeper });
        page.ops.push({ t: 'text', x: M, y, s: 9.5, bold: true, color: C.muted, text: a });
        const nameLines = wrap(b, 11.5, true, CW - 62 - 60);
        page.ops.push({ t: 'text', x: M + 62, y, s: 11.5, bold: true, color: el.pause ? C.muted : C.ink, text: nameLines[0] });
        page.ops.push({ t: 'text', x: W - M - measure(c, 10.5, true), y, s: 10.5, bold: true, color: C.accent, text: c });
        for (const ln of nameLines.slice(1)) { y += 14; page.ops.push({ t: 'text', x: M + 62, y, s: 11.5, bold: true, color: C.ink, text: ln }); }
        y += 4; break;
      }
      case 'gap': y += el.h || 8; break;
      case 'rule': room(8); y += 4; page.ops.push({ t: 'line', x1: M, y1: y, x2: W - M, y2: y, color: C.muted, lw: .4 }); y += 4; break;
      case 'cardstart': room(240); y += 6; cardTop = y; cardPage = page; cardKeeper = el.keeper; y += 4; break;
      case 'cardend':
        if (cardPage === page) {
          page.ops.unshift({ t: 'rect', x: M - 14, y: cardTop, w: CW + 28, h: y - cardTop + 10, fill: C.soft });
          if (cardKeeper) page.ops.splice(1, 0, { t: 'rect', x: M - 14, y: cardTop, w: 5, h: y - cardTop + 10, fill: C.keeper });
        }
        y += 18; break;
      default: break;
    }
  }
  pages.forEach((pg, i) => pg.ops.push({ t: 'text', x: M, y: H - 22, s: 8, color: C.muted, text: `${t('Lokal erstellt mit')} ${BRAND} · ${new Date().toLocaleDateString(locale())} · ${t('Seite')} ${i + 1} / ${pages.length}` }));
  return pages;
}

// ---------- Text & CSV (wie V20, ergänzt um Ziel und Notizen) ----------
export function planText(s, p) {
  const h = headerData(s, p), B = blocksData(s, p);
  return translateLines(`${BRAND} · ${h.title}\n${[h.team, h.age, h.type].filter(Boolean).join(' · ')}\n${h.slot}\n${h.squad}\n${h.total} Minuten${h.pauses ? ` (${h.pauses})` : ''}\n${h.goal ? `Ziel: ${h.goal}\n` : ''}${h.foci ? `Schwerpunkte: ${h.foci}\n` : ''}\n` +
    B.map(d => `${d.i + 1}. ${d.e.name} · ${d.b.minutes} Minuten${d.label ? ` (${d.label})` : ''}\n${d.b.people ? `${d.n} Spieler · ` : ''}${d.groups}\n${d.e.goal ? `Ziel: ${d.e.goal}\n` : ''}${d.e.description}\nCoaching: ${d.points.join(' ')}\nMaterial je Gruppe: ${d.material}\n${d.b.note ? `Notiz: ${d.b.note}\n` : ''}Quelle: ${d.source}\n${d.ageWarn ? d.ageWarn + '\n' : ''}${d.pause ? `\n– ${d.pause.text} –\n` : ''}`).join('\n') +
    `\nMaterialübersicht (Höchstbedarf, Gruppen und Schlangen eingerechnet):\n${h.material.join('\n') || '–'}\n${h.notes ? `\nCoaching-Ziel / Notizen:\n${h.notes}\n` : ''}\n${SAFETY}`);
}
/** Zeilenweise übersetzen (Text-Export; das Dokument entsteht nicht im DOM). */
const translateLines = str => str.split('\n').map(l => t(l)).join('\n');

export function planCsv(s, p) {
  const h = headerData(s, p), B = blocksData(s, p);
  const cell = v => { let x = t(String(v ?? '')); if (/^[=+@-]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; };
  const rows = [['Plan', h.title], ['Mannschaft', h.team], ['Altersklasse', h.age], ['Trainingstag', h.slot], ['Spieler ohne Trainer', h.people], ['Torwart', p.keepers || 0], ['Trainer', p.coaches ?? 1], ['Ziel', h.goal], ['Schwerpunkte', h.foci],
    ['Block', 'Zeit', 'Übung', 'Kategorie', 'Schwerpunkte', 'Minuten', 'Spieler', 'Gruppen', 'Material je Gruppe', 'Beschreibung', 'Notiz', 'Quelle'],
    ...B.flatMap(d => [[d.i + 1, d.label, d.e.name, d.e.tag, d.foci, d.b.minutes, d.n, d.g || 'Anpassen', d.material, d.e.description, d.b.note || '', d.source], ...(d.pause ? [['Pause', d.pause.label || '', 'Trinkpause', '', '', d.pause.minutes, '', '', '', '', '', '']] : [])]),
    ['Material', 'Höchstbedarf'], ...Object.entries(requirements(s, p)),
    ['Hinweis', 'Keeper-Partner: zuspielendes Kind zählt mit, erwachsene Trainer zusätzlich; Mengen bei unpassender Gruppe vorläufig.']];
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
