// Übungsbibliothek: Suche, Filterchips, Sortierung, Merkliste, Zuletzt, Zufall, eigene Übungen, Drag & Drop.
import * as store from '../core/store.js';
import { allExercises, exercise, effective, layout, layoutText, squadOf, flowOf, FLOW_LABEL, currentPlan, score, meta, recent, level, LEVEL_LABEL, planAge, planType, foci, hasFocus, AGES, TAGS, FOCUS } from '../core/planning.js';
import { esc, TYPE_SHORT, plural } from '../core/util.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { drillPitch } from '../scene/pitch.js';
import { cardAnimator } from '../scene/player.js';
import { openSheet } from '../ui/sheet.js';
import { addExercise, ensurePlan } from '../ui/actions.js';
import { haptic, toast } from '../ui/feedback.js';
import { pulse, stagger } from '../ui/motion.js';
import { MATERIALS, materialType } from '../ui/material.js';
import { openDetail } from './detail.js';
import { focusChips, focusPicker } from '../ui/focus.js';
import { go } from '../ui/router.js';

const DEFAULT = () => ({ q: '', scope: 'all', tags: [], foci: [], type: 'team', age: 'team', material: 'all', level: 0, maxMin: 0, sort: 'fit', archived: false });
let F = DEFAULT();
let animator = null;
/** Neu im Katalog seit V21.5 (eigene Spielzug-Animationen). */
export const isNew = e => !e.custom && e.id.startsWith('v22-');
// Kartenansicht nur auf diesem Gerät merken (reine Bequemlichkeit).
const VIEW_KEY = 'trainr-lib-view';
let view = (() => { try { return localStorage.getItem(VIEW_KEY) === 'compact' ? 'compact' : 'cards'; } catch { return 'cards'; } })();
const setView = v => { view = v; try { localStorage.setItem(VIEW_KEY, v); } catch { /* egal */ } };
const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 120 }) : setTimeout(fn, 16));
const cancelIdle = id => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));

function ageFilter(s, p) { return F.age === 'team' ? planAge(s, p) : F.age === 'all' ? null : F.age; }
function typeFilter(s, p) { const t = F.type === 'team' ? planType(s, p) : F.type; return F.type === 'team' && t === 'both' ? null : t === 'all' ? null : t; }

export function filtered(s) {
  const p = currentPlan(s), age = ageFilter(s, p), type = typeFilter(s, p), q = F.q.toLowerCase();
  let list = F.scope === 'recent' ? recent(s, 30) : allExercises(s, { archived: F.archived || F.scope === 'fav' });
  list = list.filter(e => {
    const m = meta(s, e.id);
    if (F.scope === 'fav' && !m.favorite) return false;
    if (F.scope === 'own' && !e.custom) return false;
    if (F.scope === 'new' && !isNew(e)) return false;
    if (F.scope === 'rated' && !m.rating) return false;
    if (F.tags.length && !F.tags.includes(e.tag)) return false;
    if (F.foci.length && !F.foci.some(k => hasFocus(e, k))) return false;
    if (age && !e.ages.includes(age)) return false;
    if (type && e.type !== type) return false;
    if (F.material !== 'all' && !e.equipment.some(([n]) => materialType(n)[0] === F.material)) return false;
    if (F.level && level(e) !== F.level) return false;
    if (F.maxMin && effective(s, e).minutes > F.maxMin) return false;
    if (q && !`${e.name} ${e.tag} ${foci(e).join(' ')} ${e.description} ${e.goal || ''} ${e.equipment.map(a => a[0]).join(' ')} ${m.note || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const memo = new Map(), pts = e => { if (!memo.has(e.id)) memo.set(e.id, score(s, p, e).pts); return memo.get(e.id); };
  const sorters = {
    fit: (a, b) => pts(b) - pts(a) || a.name.localeCompare(b.name),
    az: (a, b) => a.name.localeCompare(b.name),
    short: (a, b) => effective(s, a).minutes - effective(s, b).minutes || a.name.localeCompare(b.name),
    rating: (a, b) => (meta(s, b.id).rating || 0) - (meta(s, a.id).rating || 0) || a.name.localeCompare(b.name),
    tag: (a, b) => TAGS.indexOf(a.tag) - TAGS.indexOf(b.tag) || pts(b) - pts(a) || a.name.localeCompare(b.name),
    used: (a, b) => (meta(s, b.id).uses || 0) - (meta(s, a.id).uses || 0) || a.name.localeCompare(b.name),
  };
  if (F.scope !== 'recent') list.sort(sorters[F.sort] || sorters.fit);
  return list;
}

export function card(s, p, e) {
  const m = meta(s, e.id), x = effective(s, e), g = layout(s, e, squadOf(s, p)).level !== 'no', sc = score(s, p, e);
  const desktop = matchMedia('(min-width: 1100px)').matches;
  return `<article class="drill${e.archived ? ' archived' : ''}" data-id="${esc(e.id)}" data-key="${esc(e.id)}" ${desktop ? 'draggable="true"' : ''} aria-labelledby="dn-${esc(e.id)}">
    <button class="fav" type="button" data-fav="${esc(e.id)}" aria-pressed="${!!m.favorite}" aria-label="${esc(e.name)} ${m.favorite ? 'von der Merkliste entfernen' : 'merken'}">${icon('heart')}</button>
    ${drillPitch(e)}
    <div class="drill-body">
      <div class="row" style="gap:6px"><span class="tag">${esc(e.tag)}</span>${e.type !== 'field' ? `<span class="tag ${e.type === 'keeper' ? 'keeper' : 'both'}">${esc(TYPE_SHORT[e.type])}</span>` : ''}${e.custom ? '<span class="tag custom">Eigene</span>' : ''}${isNew(e) ? '<span class="tag new">Neu</span>' : ''}${m.rating ? `<span class="stars-inline" aria-label="${m.rating} Sterne">${'★'.repeat(m.rating)}</span>` : ''}</div>
      <h3 id="dn-${esc(e.id)}">${esc(e.name)}</h3>
      ${focusChips(foci(e), { max: 3, link: true, mark: F.foci.length === 1 ? F.foci[0] : p?.focus })}
      <div class="drill-meta"><span>${icon('clock')} ${x.minutes} Min</span><span>${icon('users')} ${x.min === x.max ? x.min : `${x.min}–${x.max}`} / Gruppe</span><span>ab ${esc(e.ages[0])}</span><span>${esc(LEVEL_LABEL[level(e)])}</span></div>
      <p class="drill-why ${g ? '' : 'bad'}">${esc(sc.reasons.slice(0, 3).join(' · '))}</p>
    </div>
    <div class="drill-foot"><button class="btn ghost sm" type="button" data-open="${esc(e.id)}">Ansehen</button><button class="btn primary sm" type="button" data-add="${esc(e.id)}" aria-label="${esc(e.name)} in den Plan">${icon('plus')} Plan</button></div>
  </article>`;
}

/** Kompakte Listenzeile: kleine Skizze, Name, Kerndaten, Plan-Knopf. */
export function row(s, p, e) {
  const m = meta(s, e.id), x = effective(s, e), L = layout(s, e, squadOf(s, p)), g = L.level !== 'no', flow = flowOf(e);
  return `<article class="drill drill-row${e.archived ? ' archived' : ''}" data-id="${esc(e.id)}" data-key="${esc(e.id)}" aria-labelledby="dn-${esc(e.id)}">
    ${drillPitch(e)}
    <div class="drill-body">
      <h3 id="dn-${esc(e.id)}">${esc(e.name)}${m.favorite ? ' <span class="row-fav" aria-label="gemerkt">♥</span>' : ''}</h3>
      <div class="drill-meta"><span class="row-tag">${esc(e.tag)}</span>${e.type !== 'field' ? `<span>${esc(TYPE_SHORT[e.type])}</span>` : ''}${isNew(e) ? '<span class="tag new">Neu</span>' : ''}<span>${icon('clock')} ${x.minutes} Min</span><span>${icon('users')} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}</span><span class="${g ? '' : 'warn'}">${g ? (flow === 'group' ? plural(L.groups, 'Gruppe', 'Gruppen') : esc(FLOW_LABEL[flow])) : 'passt nicht'}</span></div>
    </div>
    <button class="btn primary sm row-add" type="button" data-add="${esc(e.id)}" aria-label="${esc(e.name)} in den Plan">${icon('plus')}</button>
  </article>`;
}

export const libraryView = {
  id: 'uebungen', title: 'Übungen', tab: 'uebungen',
  render(root) {
    ensurePlan();
    this.root = root;
    const s = store.get();
    root.innerHTML = `
      <div class="page-head"><div><p class="eyebrow" id="lib-count"></p><h1 id="h-uebungen">Übungen</h1></div>
        <div class="row"><button class="btn" type="button" id="lib-random" aria-label="Zufällige passende Übung">${icon('dice')}<span>Zufall</span></button><button class="btn primary" type="button" id="lib-new">${icon('plus')} Eigene</button></div></div>
      <div class="lib-tools">
        <div class="row" style="flex-wrap:nowrap"><div class="search grow">${icon('search')}<input class="input" type="search" id="lib-q" placeholder="Übung, Ziel oder Material suchen" aria-label="Übungen suchen" value="${esc(F.q)}"></div>
          <span class="seg lib-view" role="radiogroup" aria-label="Ansicht"><button type="button" role="radio" data-libview="cards" aria-checked="${view === 'cards'}" aria-label="Karten">${icon('grid')}</button><button type="button" role="radio" data-libview="compact" aria-checked="${view === 'compact'}" aria-label="Kompakte Liste">${icon('list')}</button></span>
          <button class="btn" type="button" id="lib-filter" aria-label="Filter und Sortierung">${icon('layers')}<span class="badge" id="lib-fcount" hidden></span></button></div>
        <div class="chips" role="toolbar" aria-label="Bereich" style="margin-top:8px" id="lib-scope"></div>
        <div class="chips" role="toolbar" aria-label="Kategorie" id="lib-tags"></div>
        <div class="chips" role="toolbar" aria-label="Schwerpunkt-Filter" id="lib-foci" data-no-focus-link></div>
        <p class="tiny" id="lib-active" style="margin:0"></p>
      </div>
      <div class="lib-grid" id="lib-grid" aria-live="polite"></div>`;
    $('#lib-q', root).addEventListener('input', ev => { F.q = ev.target.value.trim(); this.paintList(); });
    $('#lib-filter', root).onclick = () => this.filterSheet();
    $('#lib-new', root).onclick = () => import('./editor.js').then(m => m.openEditor());
    $('#lib-random', root).onclick = () => this.random();
    on(root, 'click', '[data-libview]', (_, b) => { if (b.dataset.libview === view) return; setView(b.dataset.libview); haptic('tap'); root.querySelectorAll('[data-libview]').forEach(x => x.setAttribute('aria-checked', String(x === b))); this.paintList(); });
    on(root, 'click', '[data-scope]', (_, b) => { F.scope = b.dataset.scope; haptic('tap'); this.paintChips(); this.paintList(); });
    on(root, 'click', '[data-tagf]', (_, b) => { const t = b.dataset.tagf; F.tags = t === '' ? [] : F.tags.includes(t) ? F.tags.filter(x => x !== t) : [...F.tags, t]; haptic('tap'); this.paintChips(); this.paintList(); });
    on(root, 'click', '[data-focus-off]', (_, b) => { F.foci = F.foci.filter(k => k !== b.dataset.focusOff); haptic('tap'); this.paintChips(); this.paintList(); });
    on(root, 'click', '[data-focus-more]', () => this.filterSheet());
    on(root, 'click', '[data-reset]', () => { F = DEFAULT(); $('#lib-q', root).value = ''; this.paintChips(); this.paintList(); toast('Filter zurückgesetzt.'); });
    const grid = $('#lib-grid', root);
    on(grid, 'click', '[data-fav]', (ev, b) => {
      ev.stopPropagation();
      const id = b.dataset.fav, on2 = !meta(store.get(), id).favorite;
      store.update(on2 ? 'Gemerkt' : 'Nicht mehr gemerkt', d => { const mm = (d.exerciseMeta[id] ||= {}); if (on2) mm.favorite = true; else delete mm.favorite; }, { reason: 'meta' });
      b.setAttribute('aria-pressed', String(on2)); pulse(b); haptic('tap');
      toast(on2 ? 'Auf deiner Merkliste.' : 'Von der Merkliste entfernt.');
      if (F.scope === 'fav' && !on2) this.paintList();
    });
    on(grid, 'click', '[data-add]', (ev, b) => { ev.stopPropagation(); if (addExercise(b.dataset.add)) { pulse(b); b.innerHTML = `${icon('check')} Drin`; } });
    on(grid, 'click', '.drill', (ev, c) => { if (ev.target.closest('[data-fav],[data-add]')) return; openDetail(c.dataset.id, filtered(store.get()).map(e => e.id)); });
    on(grid, 'dragstart', '.drill', (ev, c) => { ev.dataTransfer.setData('text/x-trainr-exercise', c.dataset.id); ev.dataTransfer.setData('text/plain', c.dataset.id); ev.dataTransfer.effectAllowed = 'copy'; animator?.pause(); });
    grid.addEventListener('dragend', () => animator?.resume());
    animator?.destroy();
    animator = cardAnimator(grid, id => exercise(store.get(), id));
    this.paintChips();
    this.paintList(true);
  },
  refresh(reason) { if (reason === 'meta' || reason === 'minutes' || reason === 'order') return; this.paintChips(); this.paintList(); },
  leave() { animator?.destroy(); animator = null; },
  paintChips() {
    const r = this.root, s = store.get(), favs = Object.values(s.exerciseMeta).filter(m => m.favorite).length;
    const scopes = [['all', 'Alle'], ['new', 'Neu', allExercises(s).filter(isNew).length], ['fav', `♥ Merkliste`, favs], ['recent', 'Zuletzt'], ['rated', '★ Bewertet'], ['own', 'Eigene', s.custom.length]];
    $('#lib-scope', r).innerHTML = scopes.map(([k, t, c]) => `<button class="chip" type="button" data-scope="${k}" aria-pressed="${F.scope === k}">${t}${c ? ` <span class="count">${c}</span>` : ''}</button>`).join('');
    // Anzahl je Kategorie bei allen übrigen Filtern – leere Kategorien treten zurück.
    const keep = F.tags; F = { ...F, tags: [] }; const base = filtered(s); F = { ...F, tags: keep };
    const n0 = t => base.filter(e => e.tag === t).length;
    $('#lib-tags', r).innerHTML = `<button class="chip" type="button" data-tagf="" aria-pressed="${!F.tags.length}">Alle Kategorien</button>` + TAGS.map(t => { const c = n0(t); return `<button class="chip${c ? '' : ' empty-chip'}" type="button" data-tagf="${t}" aria-pressed="${F.tags.includes(t)}">${t} <span class="count">${c}</span></button>`; }).join('');
    $('#lib-foci', r).innerHTML = F.foci.length
      ? `<span class="tiny" style="align-self:center">Schwerpunkt:</span>${F.foci.map(k => `<button class="chip" type="button" data-focus-off="${esc(k)}" aria-pressed="true" aria-label="Filter ${esc(k)} entfernen">${esc(k)} ✕</button>`).join('')}`
      : `<button class="chip" type="button" data-focus-more>+ Schwerpunkt wählen</button>`;
    const p = currentPlan(s), n = [F.type !== 'team', F.age !== 'team', F.material !== 'all', !!F.level, !!F.maxMin, F.sort !== 'fit', F.archived].filter(Boolean).length;
    const badge = $('#lib-fcount', r); badge.hidden = !n; badge.textContent = n;
    const age = ageFilter(s, p), type = typeFilter(s, p);
    const parts = [age ? `Alter: ${age}` : 'alle Altersklassen', type ? `Trainerart: ${TYPE_SHORT[type]}` : 'alle Trainerarten'];
    if (F.material !== 'all') parts.push(MATERIALS.find(m => m[0] === F.material)[2]);
    if (F.level) parts.push(LEVEL_LABEL[F.level]);
    if (F.maxMin) parts.push(`≤ ${F.maxMin} Min`);
    const dirty = n || F.q || F.tags.length || F.foci.length || F.scope !== 'all';
    $('#lib-active', r).hidden = !dirty;
    $('#lib-active', r).innerHTML = !dirty ? '' : `${esc(parts.join(' · '))} · Sortierung: ${esc({ fit: 'passend zuerst', tag: 'nach Kategorie', az: 'A–Z', short: 'kürzeste', rating: 'Bewertung', used: 'oft genutzt' }[F.sort])}${n || F.q || F.tags.length || F.foci.length || F.scope !== 'all' ? ' · <button class="btn ghost sm" type="button" data-reset style="min-height:32px;padding:2px 8px">Zurücksetzen</button>' : ''}`;
  },
  paintList(first = false) {
    const s = store.get(), p = currentPlan(s), list = filtered(s), grid = $('#lib-grid', this.root);
    $('#lib-count', this.root).textContent = `${plural(list.length, 'Übung', 'Übungen')} · ${allExercises(s).length} gesamt`;
    grid.classList.toggle('compact', view === 'compact');
    grid.classList.toggle('grouped', F.sort === 'tag' && F.scope !== 'recent');
    cancelIdle(this.chunk);
    const one = view === 'compact' ? row : card, grouped = F.sort === 'tag' && F.scope !== 'recent';
    const counts = {}; if (grouped) for (const e of list) counts[e.tag] = (counts[e.tag] || 0) + 1;
    // Einträge vorbereiten: bei „Nach Kategorie“ eine Kopfzeile vor der ersten Übung jeder Kategorie.
    const items = []; let last = null;
    for (const e of list) {
      if (grouped && e.tag !== last) { last = e.tag; items.push(() => `<h2 class="lib-group"><span>${esc(e.tag)}</span><b>${counts[e.tag]}</b></h2>`); }
      items.push(() => one(s, p, e));
    }
    const FIRST = view === 'compact' ? 24 : 12;
    grid.innerHTML = list.length ? items.slice(0, FIRST).map(f => f()).join('') : `<div class="empty" style="grid-column:1/-1"><h3>${F.scope === 'fav' ? 'Noch nichts gemerkt' : F.scope === 'own' ? 'Noch keine eigene Übung' : F.scope === 'recent' ? 'Noch nichts genutzt' : 'Keine passende Übung'}</h3><p>${F.scope === 'fav' ? 'Tippe auf das Herz einer Übung.' : F.scope === 'own' ? 'Lege mit „Eigene“ deine erste Übung an.' : 'Filter lockern oder zurücksetzen. Bambini bekommen keine festen Torwartübungen.'}</p><button class="btn" type="button" data-reset>Filter zurücksetzen</button></div>`;
    animator?.observe();
    if (first) stagger(grid.querySelectorAll('.drill'), { max: 6 });
    // Restliche Einträge in Etappen nachzeichnen, damit die Ansicht sofort reagiert.
    let i = FIRST;
    const more = () => {
      if (!grid.isConnected || i >= items.length) return;
      grid.insertAdjacentHTML('beforeend', items.slice(i, i + 16).map(f => f()).join(''));
      i += 16; animator?.observe();
      this.chunk = idle(more);
    };
    this.chunk = idle(more);
  },
  random() {
    const s = store.get(), p = currentPlan(s), list = filtered(s).filter(e => e.tag !== 'Falltechnik' && layout(s, e, squadOf(s, p)).level !== 'no');
    const pool = list.length ? list : filtered(s);
    if (!pool.length) { toast('Keine Übung mit diesen Filtern.'); return; }
    const e = pool[Math.floor(Math.random() * pool.length)];
    haptic('ok');
    openDetail(e.id, pool.map(x => x.id));
  },
  filterSheet() {
    const draft = { ...F };
    const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" data-k="${key}" data-v="${v}" aria-checked="${String(draft[key]) === String(v)}">${t}</button>`).join('')}</div>`;
    const body = () => `
      <div class="field"><span>Schwerpunkte <small class="tiny">Übung trainiert mindestens einen davon</small></span>${focusPicker(draft.foci, { name: 'fk' })}</div>
      <div class="field"><span>Sortierung</span>${seg('sort', [['fit', 'Passend zuerst'], ['tag', 'Nach Kategorie'], ['az', 'A–Z'], ['short', 'Kürzeste'], ['rating', 'Bewertung'], ['used', 'Oft genutzt']])}</div>
      <div class="field"><span>Trainerart</span>${seg('type', [['team', 'Meine Mannschaft'], ['all', 'Alle'], ['field', 'Feld'], ['keeper', 'Torwart'], ['both', 'Gemischt']])}</div>
      <label class="field"><span>Altersklasse</span><select class="input" data-sel="age"><option value="team" ${draft.age === 'team' ? 'selected' : ''}>Meine Mannschaft</option><option value="all" ${draft.age === 'all' ? 'selected' : ''}>Alle Altersklassen</option>${AGES.map(a => `<option ${draft.age === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      <div class="field"><span>Material</span>${seg('material', [['all', 'Jedes'], ...MATERIALS.map(m => [m[0], `${m[1]} ${m[2]}`])])}</div>
      <div class="field"><span>Schwierigkeit</span>${seg('level', [[0, 'Alle'], [1, 'Einstieg'], [2, 'Mittel'], [3, 'Anspruchsvoll']])}</div>
      <div class="field"><span>Dauer</span>${seg('maxMin', [[0, 'Egal'], [6, '≤ 6 Min'], [8, '≤ 8 Min'], [10, '≤ 10 Min']])}</div>
      <label class="switch-row"><span>Archivierte Übungen zeigen<small>Ältere, ersetzte Varianten. Bleiben in alten Plänen erhalten.</small></span><input class="switch" type="checkbox" data-chk="archived" ${draft.archived ? 'checked' : ''}></label>`;
    openSheet({
      title: 'Filter & Sortierung', body: body(),
      foot: `<button class="btn" type="button" data-freset>Zurücksetzen</button><button class="btn primary" type="button" data-fapply>Anwenden</button>`,
      onMount: sh => {
        on(sh.body, 'click', '[data-fk]', (_, b) => { const k = b.dataset.fk; draft.foci = draft.foci.includes(k) ? draft.foci.filter(x => x !== k) : [...draft.foci, k]; b.setAttribute('aria-pressed', String(draft.foci.includes(k))); });
        on(sh.body, 'click', '[data-k]', (_, b) => { const k = b.dataset.k, v = b.dataset.v; draft[k] = ['level', 'maxMin'].includes(k) ? Number(v) : v; sh.body.querySelectorAll(`[data-k="${k}"]`).forEach(x => x.setAttribute('aria-checked', String(x === b))); });
        sh.body.querySelector('[data-sel=age]').onchange = ev => { draft.age = ev.target.value; };
        sh.body.querySelector('[data-chk=archived]').onchange = ev => { draft.archived = ev.target.checked; };
        sh.foot.querySelector('[data-freset]').onclick = () => { Object.assign(draft, DEFAULT(), { q: F.q, scope: F.scope, tags: F.tags, foci: [] }); sh.setBody(body()); sh.body.querySelector('[data-sel=age]').onchange = ev => { draft.age = ev.target.value; }; sh.body.querySelector('[data-chk=archived]').onchange = ev => { draft.archived = ev.target.checked; }; };
        sh.foot.querySelector('[data-fapply]').onclick = () => { F = draft; sh.close(); this.paintChips(); this.paintList(); };
      },
    });
  },
};
export { MATERIALS };

/** Bibliothek mit einem Schwerpunkt-Filter öffnen (aus Chips überall in der App). Alter/Trainerart bleiben bei der Mannschaft. */
export function showFocus(key) {
  if (!FOCUS[key] && !TAGS.includes(key)) return;
  F = { ...DEFAULT(), foci: [key] };
  go('uebungen');
}
