// Darstellung der Schwerpunkte: Chips, Bereichsbalken, Minutenbalken, Auswahl. Reine HTML-Bausteine + ein globaler Link-Handler.
import { FOCI, FOCUS, AREAS } from '../core/planning.js';
import { esc } from '../core/util.js';
import { openSheet } from './sheet.js';
import { on } from './dom.js';
import { haptic } from './feedback.js';

export const areaOf = k => FOCUS[k]?.area || 'none';
export const areaLabel = a => AREAS[a]?.label || 'Ohne Schwerpunkt';
const AREA_ORDER = [...Object.keys(AREAS), 'none'];
const pct = (n, total) => Math.round(n / Math.max(1, total) * 100);

/**
 * Schwerpunkt-Chips. `items`: Schlüssel oder {key, minutes}. `link` = Antippen öffnet passende Übungen.
 * `mark` hebt einen Schlüssel hervor (z. B. den Schwerpunkt der Einheit).
 */
export function focusChips(items, { max = 4, link = false, mark = null, label = 'Schwerpunkte' } = {}) {
  // Der hervorgehobene Schwerpunkt (z. B. der der Einheit) steht immer vorn, auch wenn er wenige Minuten hat.
  const all = items.map(x => (typeof x === 'string' ? { key: x } : x)), mi = all.findIndex(x => x.key === mark);
  if (mi > 0) all.unshift(...all.splice(mi, 1));
  const list = all.slice(0, max);
  if (!list.length) return '';
  const rest = items.length - list.length;
  return `<span class="fchips" role="list" aria-label="${esc(label)}">${list.map(({ key, minutes }) => {
    const cls = `fchip a-${areaOf(key)}${key === mark ? ' mark' : ''}`, inner = `${esc(key)}${minutes ? ` <small>${minutes} Min</small>` : ''}`;
    return link
      ? `<button type="button" role="listitem" class="${cls}" data-focus-link="${esc(key)}" title="${esc(FOCUS[key]?.hint || '')} – passende Übungen zeigen">${inner}</button>`
      : `<span role="listitem" class="${cls}" title="${esc(FOCUS[key]?.hint || '')}">${inner}</span>`;
  }).join('')}${rest > 0 ? `<span class="fchip more">+${rest}</span>` : ''}</span>`;
}

/** Gestapelter Balken nach Bereichen (Technik, Spielverständnis …) mit Legende. `fm` aus focusMinutes(). */
export function areaBar(fm) {
  const parts = AREA_ORDER.filter(a => fm.areas[a]).map(a => [a, fm.areas[a]]);
  if (!parts.length) return '';
  const text = parts.map(([a, m]) => `${areaLabel(a)} ${pct(m, fm.total)} %`).join(', ');
  return `<div class="abar" role="img" aria-label="Verteilung nach Bereichen: ${esc(text)}">${parts.map(([a, m]) => `<i class="a-${a}" style="width:${m / fm.total * 100}%"></i>`).join('')}</div>
    <div class="alegend">${parts.map(([a, m]) => `<span><b class="dot a-${a}" aria-hidden="true"></b>${esc(areaLabel(a))} ${pct(m, fm.total)} %</span>`).join('')}</div>`;
}

/** Balken je Schwerpunkt (Minuten, optional Anzahl Trainings). Zeilen öffnen passende Übungen. */
export function focusBars(fm, { limit = 8, sessions = false } = {}) {
  const max = Math.max(1, ...fm.list.map(o => o.minutes));
  return `<div class="bars">${fm.list.slice(0, limit).map(o => `<button type="button" class="bar-row fbar" data-focus-link="${esc(o.key)}" aria-label="${esc(o.key)}: ${o.minutes} Minuten${sessions ? ` in ${o.sessions} ${o.sessions === 1 ? 'Training' : 'Trainings'}` : ''} – passende Übungen zeigen">
    <span>${esc(o.key)}</span><span class="bar"><i class="a-${areaOf(o.key)}" style="width:${o.minutes / max * 100}%"></i></span><span class="tiny">${o.minutes} Min${sessions ? ` · ${o.sessions}×` : ''}</span></button>`).join('')}</div>`;
}

/** Kompakte Zusammenfassung einer Einheit: Bereichsbalken + wichtigste Schwerpunkte mit Minuten. */
export function focusSummary(fm, { mark = null, max = 5, link = true } = {}) {
  if (!fm?.list.length) return '';
  return `${areaBar(fm)}<div style="margin-top:8px">${focusChips(fm.list.map(o => ({ key: o.key, minutes: o.minutes })), { max, link, mark })}</div>`;
}

/** Auswahl mehrerer Schwerpunkte nach Bereich (Formular-Chips mit aria-pressed). */
export function focusPicker(selected, { name = 'focus', star = false } = {}) {
  return Object.entries(AREAS).map(([a, info]) => `<div class="fpick-group"><span class="tiny">${esc(info.label)}</span><div class="chips" role="group" aria-label="${esc(info.label)}">${FOCI.filter(f => f.area === a)
    .map(f => `<button type="button" class="chip fchip-pick a-${a}" data-${name}="${esc(f.key)}" aria-pressed="${selected.includes(f.key)}" title="${esc(f.hint)}">${star && selected[0] === f.key ? '<span aria-label="Hauptschwerpunkt">★</span> ' : ''}${esc(f.key)}</button>`).join('')}</div></div>`).join('');
}

/** <option>-Liste für den Schwerpunkt einer Einheit, gruppiert nach Bereich. Ältere Kategorie-Werte bleiben wählbar. */
export function focusOptions(value, { exclude = [] } = {}) {
  const legacy = value !== 'Alle' && !FOCUS[value] ? `<option value="${esc(value)}" selected>${esc(value)} (Kategorie)</option>` : '';
  return `<option value="Alle" ${value === 'Alle' ? 'selected' : ''}>Kein Schwerpunkt</option>${legacy}${Object.entries(AREAS).map(([a, info]) => `<optgroup label="${esc(info.label)}">${FOCI.filter(f => f.area === a && !exclude.includes(f.key))
    .map(f => `<option value="${esc(f.key)}" ${value === f.key ? 'selected' : ''}>${esc(f.key)}</option>`).join('')}</optgroup>`).join('')}`;
}

/** Ein Klick auf [data-focus-link] irgendwo in der App zeigt passende Übungen in der Bibliothek. */
export function initFocusLinks() {
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-focus-link]');
    if (!b || b.closest('[data-no-focus-link]')) return;
    ev.preventDefault(); ev.stopPropagation();
    import('../views/library.js').then(m => m.showFocus(b.dataset.focusLink));
  }, true); // Capture: vor Karten-/Zeilen-Handlern, damit der Chip nicht zusätzlich die Karte öffnet
}

/**
 * Auswahl-Sheet für den Schwerpunkt einer Einheit, gruppiert nach Bereich, mit Kurzbeschreibung.
 * `hint`: Schlüssel, die als „lange nicht trainiert“ markiert werden.
 */
export function openFocusPick({ title = 'Schwerpunkt der Einheit', current = 'Alle', hint = [], exclude = [], onPick }) {
  const item = (v, label, sub, cls = '') => `<button class="list-item ${cls}" type="button" data-v="${esc(v)}" aria-current="${v === current}"><span class="grow"><strong>${esc(label)}${hint.includes(v) ? ' <span class="tag warn">lange nicht trainiert</span>' : ''}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${v === current ? '✓' : ''}</button>`;
  const legacy = current !== 'Alle' && !FOCUS[current] ? item(current, current, 'Kategorie aus einer älteren Version') : '';
  openSheet({
    title,
    body: `<p class="small muted">Der Schwerpunkt steuert Vorschläge, Sortierung und den Check. Jede Übung trainiert mehrere Schwerpunkte – die Einheit zeigt dir, welche.</p>
      <div class="list">${item('Alle', 'Kein Schwerpunkt', 'Abwechslungsreich')}${legacy}</div>
      ${Object.entries(AREAS).map(([a, info]) => `<h3 class="eyebrow fpick-h"><b class="dot a-${a}" aria-hidden="true"></b>${esc(info.label)}</h3><div class="list">${FOCI.filter(f => f.area === a && !exclude.includes(f.key)).map(f => item(f.key, f.key, f.hint)).join('')}</div>`).join('')}`,
    onMount: sh => on(sh.body, 'click', '[data-v]', (_, b) => { sh.close(); onPick(b.dataset.v); haptic('tap'); }),
  });
}
