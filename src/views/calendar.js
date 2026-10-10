// Kalender: Termine planen (Monat/Liste), Serien aus Trainingszeiten, Erinnerungen, Nachbereitung, Ausfälle, Rückblick, ICS-Export.
import * as store from '../core/store.js';
import { activeTeam, plansOfTeam, templates, totalMinutes, exercise, foci, planFocus } from '../core/planning.js';
import {
  KIND, STATUS, REMIND, REASONS, DEFAULT_REMIND, iso, addDays, todayIso, weekday, monthKey, shiftMonth, monthLabel, monthGrid, isoWeek, mondayOf,
  fmtDate, startOf, duration, isPast, title, eventsOfTeam, eventsOn, upcoming, past, needsReview, blankEvent, series, range, snapshot,
  remindLabel, stats, seasonStart, toICS, eventFocus, autoFill, autoOn, autoSeriesId, AUTO_WEEKS,
} from '../core/calendar.js';
import { LIMITS, EVENT_KINDS } from '../core/schema.js';
import { esc, uid, plural, time, clamp, DAYS_SHORT, fileDate } from '../core/util.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { go } from '../ui/router.js';
import { toast, haptic } from '../ui/feedback.js';
import { stagger } from '../ui/motion.js';
import { undoToast, blankPlan, duplicatePlan } from '../ui/actions.js';
import { permission, requestPermission } from '../ui/reminders.js';
import { openDetail } from './detail.js';
import { areaBar, focusBars, focusChips, focusSummary } from '../ui/focus.js';

const MODES = [['monat', 'Monat'], ['liste', 'Liste'], ['rueckblick', 'Rückblick']];
const RANGES = [['woche', 'Woche'], ['monat', 'Monat'], ['saison', 'Saison'], ['alle', 'Alles']];
const ui = { mode: 'monat', month: monthKey(todayIso()), day: todayIso(), range: 'woche', offset: 0, showPast: false };

/** Zeitraum des Rückblicks: Kalenderwoche oder -monat (mit Blättern über `ui.offset`), Saisonhälfte oder alles. */
function period(now) {
  const today = todayIso(now);
  if (ui.range === 'woche') {
    const week = off => { const from = addDays(mondayOf(today), 7 * off); return { from, to: addDays(from, 6) }; }, cur = week(ui.offset);
    return { ...cur, step: 'Eine Woche', prev: week(ui.offset - 1), prevLabel: 'der Vorwoche',
      label: `${ui.offset === 0 ? 'Diese Woche' : ui.offset === -1 ? 'Letzte Woche' : `KW ${isoWeek(cur.from)}`} · ${fmtDate(cur.from)} – ${fmtDate(cur.to)}` };
  }
  if (ui.range === 'monat') {
    const month = off => { const key = shiftMonth(monthKey(today), off); return { key, from: `${key}-01`, to: addDays(`${shiftMonth(key, 1)}-01`, -1) }; }, cur = month(ui.offset);
    return { from: cur.from, to: cur.to, step: 'Ein Monat', prev: month(ui.offset - 1), prevLabel: 'dem Vormonat', label: monthLabel(cur.key) };
  }
  if (ui.range === 'saison') { const from = seasonStart(now); return { from, to: null, label: `Saison ab ${fmtDate(from, { long: true })}` }; }
  return { from: null, to: null, label: 'Alle Termine' };
}

const findEvent = id => store.get().events.find(ev => ev.id === id) || null;
const planOf = (s, ev) => s.plans.find(p => p.id === ev.planId) || null;
const updateEvent = (label, id, fn, opts) => store.update(label, d => { const ev = d.events.find(x => x.id === id); if (ev) fn(ev, d); }, opts);
const kindTag = ev => `<span class="tag ev-tag k-${ev.kind}">${esc(KIND[ev.kind])}</span>`;
const statusTag = ev => (ev.status === 'geplant' ? '' : `<span class="tag ${ev.status === 'erledigt' ? 'ok' : 'warn'}">${esc(STATUS[ev.status])}</span>`);
const stars = n => `<span class="stars-inline" aria-label="${n} von 5 Sternen">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

/** Kompakte Terminkarte (auch auf „Heute“). */
export function eventCard(s, ev, { showDate = false } = {}) {
  const p = planOf(s, ev), open = ev.kind === 'training' && ev.status === 'geplant';
  const sub = ev.status === 'ausgefallen' ? `Ausgefallen${ev.reason ? ` · ${ev.reason}` : ''}`
    : ev.status === 'erledigt' ? [ev.done?.name || p?.name, ev.attendance !== undefined ? `${ev.attendance} Spieler` : '', ev.rating ? '★'.repeat(ev.rating) : ''].filter(Boolean).join(' · ') || 'Gehalten'
      : p ? `${p.name} · ${totalMinutes(p, s)} Min` : open ? 'Noch keine Einheit geplant' : ev.place || '';
  const fm = ev.kind === 'training' && ev.status !== 'ausgefallen' ? eventFocus(s, ev) : null, fl = fm?.list.slice(0, 3).map(o => o.key) || [];
  return `<button class="ev-card k-${ev.kind} s-${ev.status}" type="button" data-ev="${esc(ev.id)}">
    <span class="ev-time">${showDate ? `<small>${esc(fmtDate(ev.date, { relative: true }))}</small>` : ''}<strong>${esc(ev.start)}</strong><small>${esc(ev.end)}</small></span>
    <span class="grow"><strong>${esc(title(ev))}${ev.place && (p || ev.status !== 'geplant') ? ` <span class="tiny">· ${esc(ev.place)}</span>` : ''}</strong><small class="${open && !p ? 'block-warn' : ''}">${open && !p ? '⚠ ' : ''}${esc(sub)}</small>${fl.length ? `<small class="ev-foci">${icon('target')} ${esc(fl.join(' · '))}</small>` : ''}</span>
    <span class="ev-meta">${statusTag(ev)}${ev.status === 'geplant' && ev.remind !== null ? `<span class="ev-bell" title="Erinnerung ${esc(remindLabel(ev.remind))}" aria-label="Erinnerung ${esc(remindLabel(ev.remind))}">${icon('bell')}</span>` : ''}</span>
  </button>`;
}

export const calendarView = {
  id: 'kalender', title: 'Kalender', tab: 'planen',
  render(root, params) {
    this.root = root;
    const [a, b] = params;
    if (MODES.some(m => m[0] === a)) ui.mode = a;
    if (a === 'monat' && /^\d{4}-\d\d$/.test(b || '')) ui.month = b;
    this.paint();
    stagger(root.querySelectorAll('.ev-card, .stat'), { max: 10 });
    if (a === 'termin' && b) {
      const ev = findEvent(b);
      history.replaceState(history.state, '', '#kalender');
      if (ev) { ui.mode = 'monat'; ui.month = monthKey(ev.date); ui.day = ev.date; this.paint(); openEvent(ev.id); }
    } else if (a === 'neu') { history.replaceState(history.state, '', '#kalender'); editEvent(null, /^\d{4}-\d\d-\d\d$/.test(b || '') ? b : ui.day); }
  },
  refresh() { const y = scrollY; this.paint(); scrollTo({ top: y, behavior: 'instant' }); },

  paint() {
    const s = store.get(), team = activeTeam(s); if (!team) return;
    const next = upcoming(s, { limit: 1 })[0], review = needsReview(s);
    this.root.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">${esc(team.name)} · Kalender</p><h1 id="h-kalender">Kalender</h1>
        <p class="muted">${next ? `Nächster Termin: ${esc(fmtDate(next.date, { relative: true }))}, ${esc(next.start)} · ${esc(title(next))}` : 'Noch keine kommenden Termine.'}</p></div>
        <div class="row" style="gap:2px"><button class="btn sm" type="button" id="cal-series">${icon('repeat')} Serie</button><button class="icon-btn" type="button" id="cal-more" aria-label="Weitere Kalenderaktionen">${icon('more')}</button></div></div>
      ${review.length ? `<div class="notice warn" style="margin-bottom:12px">${icon('check')}<span class="grow">${plural(review.length, 'Training wartet', 'Trainings warten')} auf die Nachbereitung.</span><button class="btn sm" type="button" data-ev="${esc(review[0].id)}">Nachbereiten</button></div>` : ''}
      <div class="row between" style="margin-bottom:12px"><div class="seg cal-modes" role="tablist" aria-label="Kalenderansicht">${MODES.map(([k, t]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${ui.mode === k}" aria-pressed="${ui.mode === k}">${t}</button>`).join('')}</div>
        <button class="btn primary sm" type="button" id="cal-add">${icon('plus')} Termin</button></div>
      <div id="cal-body"></div>`;
    const body = $('#cal-body', this.root);
    if (ui.mode === 'monat') this.month(s, body);
    else if (ui.mode === 'liste') this.list(s, body);
    else this.review(s, body);
    const r = this.root;
    on(r, 'click', '[data-mode]', (_, b) => { ui.mode = b.dataset.mode; history.replaceState(history.state, '', `#kalender/${ui.mode}`); this.paint(); });
    on(r, 'click', '[data-ev]', (_, b) => { if (!findEvent(b.dataset.ev)) return; if (b.closest('.notice')) reviewEvent(b.dataset.ev); else openEvent(b.dataset.ev); });
    $('#cal-add', r).onclick = () => editEvent(null, ui.mode === 'monat' ? ui.day : todayIso());
    $('#cal-series', r).onclick = seriesSheet;
    $('#cal-more', r).onclick = moreSheet;
  },

  month(s, body) {
    const days = monthGrid(ui.month), today = todayIso(), evs = eventsOfTeam(s), byDay = new Map();
    for (const ev of evs) { if (!byDay.has(ev.date)) byDay.set(ev.date, []); byDay.get(ev.date).push(ev); }
    if (monthKey(ui.day) !== ui.month) ui.day = monthKey(today) === ui.month ? today : `${ui.month}-01`;
    const sel = byDay.get(ui.day) || [];
    body.innerHTML = `
      <div class="card cal-card">
        <div class="cal-head"><button class="icon-btn" type="button" data-month="-1" aria-label="Vorheriger Monat">${icon('back')}</button>
          <h2 aria-live="polite">${esc(monthLabel(ui.month))}</h2>
          <button class="icon-btn" type="button" data-month="1" aria-label="Nächster Monat">${icon('chevron')}</button></div>
        <div class="cal-grid" role="grid" aria-label="${esc(monthLabel(ui.month))}">
          <div class="cal-row" role="row">${DAYS_SHORT.map(d => `<span class="cal-wd" role="columnheader">${d}</span>`).join('')}</div>
          ${[0, 1, 2, 3, 4, 5].map(w => `<div class="cal-row" role="row">${days.slice(w * 7, w * 7 + 7).map(d => { const list = byDay.get(d) || []; return `
            <button type="button" role="gridcell" class="cal-day ${monthKey(d) !== ui.month ? 'out' : ''} ${d === today ? 'today' : ''}" data-day="${d}" aria-selected="${d === ui.day}" tabindex="${d === ui.day ? 0 : -1}"
              aria-label="${esc(fmtDate(d, { long: true }))}${list.length ? `: ${list.map(ev => `${title(ev)}${ev.status !== 'geplant' ? ` (${STATUS[ev.status]})` : ''}`).join(', ')}` : ''}">
              <span class="n">${Number(d.slice(8))}</span><span class="dots" aria-hidden="true">${list.slice(0, 3).map(ev => `<i class="k-${ev.kind} s-${ev.status}${ev.kind === 'training' && ev.status === 'geplant' && !ev.planId ? ' noplan' : ''}"></i>`).join('')}</span></button>`; }).join('')}</div>`).join('')}
        </div>
        <div class="row between cal-legend"><span class="tiny"><i class="lg k-training"></i>Training <i class="lg k-spiel"></i>Spiel/Turnier <i class="lg noplan"></i>ohne Einheit</span><button class="btn ghost sm" type="button" id="cal-today">Heute</button></div>
      </div>
      <div class="section"><h2>${esc(fmtDate(ui.day, { long: true }))}</h2><span class="tiny">KW ${isoWeek(ui.day)}</span></div>
      <div class="stack" id="cal-daylist">${sel.length ? sel.map(ev => eventCard(s, ev)).join('') : `<div class="empty" style="padding:20px"><p>Kein Termin an diesem Tag.</p></div>`}</div>
      <div class="row" style="margin-top:12px"><button class="btn" type="button" data-new="training">${icon('plus')} Training</button><button class="btn" type="button" data-new="spiel">${icon('plus')} Spiel</button><button class="btn ghost" type="button" data-new="termin">${icon('plus')} Sonstiger Termin</button></div>`;
    const grid = $('.cal-grid', body);
    on(body, 'click', '[data-day]', (_, b) => { ui.day = b.dataset.day; if (monthKey(ui.day) !== ui.month) ui.month = monthKey(ui.day); this.paint(); $(`[data-day="${ui.day}"]`, this.root)?.focus({ preventScroll: true }); haptic('tap'); });
    on(body, 'click', '[data-month]', (_, b) => { ui.month = shiftMonth(ui.month, Number(b.dataset.month)); history.replaceState(history.state, '', `#kalender/monat/${ui.month}`); this.paint(); });
    on(body, 'click', '[data-new]', (_, b) => editEvent(null, ui.day, b.dataset.new));
    $('#cal-today', body).onclick = () => { ui.day = todayIso(); ui.month = monthKey(ui.day); this.paint(); };
    grid.addEventListener('keydown', ev => {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key] ?? (ev.key === 'PageUp' ? 'prev' : ev.key === 'PageDown' ? 'next' : null);
      if (step === null) { if (ev.key === 'Enter' && ev.target.dataset.day && (byDay.get(ev.target.dataset.day) || []).length === 1) { ev.preventDefault(); openEvent(byDay.get(ev.target.dataset.day)[0].id); } return; }
      ev.preventDefault();
      ui.day = typeof step === 'number' ? addDays(ui.day, step) : `${shiftMonth(ui.month, step === 'prev' ? -1 : 1)}-01`;
      ui.month = monthKey(ui.day); this.paint(); $(`[data-day="${ui.day}"]`, this.root)?.focus({ preventScroll: true });
    });
    // Wischen über den Monat blättert (die Tab-Gesten sind hier gesperrt).
    let sx = null;
    grid.addEventListener('touchstart', ev => { sx = ev.touches.length === 1 ? [ev.touches[0].clientX, ev.touches[0].clientY] : null; }, { passive: true });
    grid.addEventListener('touchend', ev => { if (!sx) return; const dx = ev.changedTouches[0].clientX - sx[0], dy = ev.changedTouches[0].clientY - sx[1]; sx = null; if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * .6) { ui.month = shiftMonth(ui.month, dx < 0 ? 1 : -1); this.paint(); } }, { passive: true });
  },

  list(s, body) {
    const now = new Date(), next = upcoming(s, { now, status: ['geplant', 'ausgefallen', 'erledigt'] }), weeks = new Map();
    for (const ev of next) { const k = mondayOf(ev.date); if (!weeks.has(k)) weeks.set(k, []); weeks.get(k).push(ev); }
    const old = ui.showPast ? past(s, { now }).slice(0, 60) : [];
    const noPlan = next.filter(ev => ev.kind === 'training' && ev.status === 'geplant' && !ev.planId && startOf(ev) - now < 14 * 864e5);
    body.innerHTML = `
      ${noPlan.length ? `<div class="notice" style="margin-bottom:12px">${icon('warn')}<span class="grow">${plural(noPlan.length, 'Training', 'Trainings')} in den nächsten 14 Tagen ohne Einheit.</span><button class="btn sm" type="button" data-plan-ev="${esc(noPlan[0].id)}">Jetzt planen</button></div>` : ''}
      ${weeks.size ? [...weeks].map(([mon, list]) => `<div class="section"><h2>KW ${isoWeek(mon)}</h2><span class="tiny">${esc(fmtDate(mon))} – ${esc(fmtDate(addDays(mon, 6)))}</span></div>
        <div class="stack">${list.map(ev => eventCard(s, ev, { showDate: true })).join('')}</div>`).join('')
        : `<div class="empty"><h3>Keine kommenden Termine</h3><p>Lege eine Serie aus deinen Trainingszeiten an oder trage einzelne Termine ein.</p><button class="btn primary" type="button" id="cal-empty-series">${icon('repeat')} Serie anlegen</button></div>`}
      <div class="row" style="margin-top:16px"><button class="btn ghost sm" type="button" id="cal-past" aria-expanded="${ui.showPast}">${ui.showPast ? 'Vergangene ausblenden' : 'Vergangene Termine anzeigen'}</button></div>
      ${old.length ? `<div class="stack" style="margin-top:8px">${old.map(ev => eventCard(s, ev, { showDate: true })).join('')}</div>` : ui.showPast ? '<p class="tiny">Noch keine vergangenen Termine.</p>' : ''}`;
    $('#cal-past', body).onclick = () => { ui.showPast = !ui.showPast; this.paint(); };
    $('#cal-empty-series', body)?.addEventListener('click', seriesSheet);
    on(body, 'click', '[data-plan-ev]', (_, b) => assignPlan(b.dataset.planEv));
  },

  review(s, body) {
    const now = new Date(), per = period(now), st = stats(s, { from: per.from, to: per.to, now });
    const list = past(s, { now, from: per.from, to: per.to }).slice(0, 40);
    const prev = per.prev ? stats(s, { from: per.prev.from, to: per.prev.to, now }) : null;
    const h = Math.floor(st.minutes / 60), m = st.minutes % 60, tr = st.trained;
    // Vergleich zum Vorzeitraum (Woche/Monat): neu dazugekommene und weggefallene Schwerpunkte.
    const keys = o => new Set(o.trained.list.map(x => x.key)), both = prev?.trained.total && tr.total;
    const added = both ? [...keys(st)].filter(k => !keys(prev).has(k)) : [], dropped = both ? [...keys(prev)].filter(k => !keys(st).has(k)) : [];
    body.innerHTML = `
      <div class="seg" role="radiogroup" aria-label="Zeitraum" style="margin-bottom:8px">${RANGES.map(([k, t]) => `<button type="button" role="radio" data-range="${k}" aria-checked="${ui.range === k}">${t}</button>`).join('')}</div>
      <div class="row between rv-nav">${per.step ? `<button class="icon-btn" type="button" data-shift="-1" aria-label="${esc(per.step)} zurück">${icon('back')}</button>` : '<span></span>'}
        <strong class="rv-label" aria-live="polite">${esc(per.label)}</strong>
        ${per.step ? `<button class="icon-btn" type="button" data-shift="1" aria-label="${esc(per.step)} weiter" ${ui.offset >= 0 ? 'disabled' : ''}>${icon('chevron')}</button>` : '<span></span>'}</div>
      <div class="stat-grid">
        <div class="stat"><strong>${st.held}</strong><small>Trainings gehalten</small></div>
        <div class="stat"><strong>${st.cancelled}</strong><small>ausgefallen</small></div>
        <div class="stat"><strong>${st.rate === null ? '–' : st.rate + ' %'}</strong><small>stattgefunden</small></div>
        <div class="stat"><strong>${st.attendance ?? '–'}</strong><small>Ø Spieler</small></div>
        <div class="stat"><strong>${st.minutes ? `${h ? `${h} h ` : ''}${m ? `${m} Min` : ''}` : '–'}</strong><small>Trainingszeit</small></div>
        <div class="stat"><strong>${st.rating ?? '–'}${st.rating ? ' ★' : ''}</strong><small>Ø Stimmung</small></div>
      </div>
      ${st.open ? `<p class="notice" style="margin-top:12px">${icon('info')}<span>${plural(st.open, 'vergangenes Training ist', 'vergangene Trainings sind')} noch nicht nachbereitet und fehlen in der Auswertung.</span></p>` : ''}
      <div class="card rv-foci" style="margin-top:12px"><h2 class="card-h">Trainierte Schwerpunkte</h2>
        ${tr.total ? `${areaBar(tr)}<div style="margin-top:12px">${focusBars(tr, { limit: 12, sessions: true })}</div>
          ${added.length || dropped.length ? `<p class="small" style="margin:12px 0 0">Gegenüber ${esc(per.prevLabel)}: ${added.length ? `neu ${added.map(k => `<strong>${esc(k)}</strong>`).join(', ')}` : ''}${added.length && dropped.length ? ' · ' : ''}${dropped.length ? `nicht mehr dabei ${dropped.map(k => esc(k)).join(', ')}` : ''}</p>` : ''}
          ${st.missing.length ? `<div style="margin-top:12px"><span class="tiny">Nicht dabei – antippen für passende Übungen</span>${focusChips(st.missing, { max: 8, link: true, label: 'Nicht trainiert' })}</div>` : ''}
          ${st.focus.length ? `<p class="tiny" style="margin:12px 0 0">Gewählter Schwerpunkt der Einheiten: ${st.focus.map(([f, n]) => `${esc(f)} ${n}×`).join(' · ')}</p>` : ''}
          <p class="tiny" style="margin:8px 0 0">Minuten aus gehaltenen, nachbereiteten Trainings mit Einheit. Eine Übung zählt für jeden ihrer Schwerpunkte. Abwechslung über die Wochen hilft – keine Norm.</p>`
          : `<p class="small muted" style="margin:0">${st.held ? 'Die gehaltenen Trainings haben keine Einheit hinterlegt. Beim Nachbereiten die gehaltene Einheit wählen – dann siehst du hier, was trainiert wurde.' : 'Noch keine nachbereiteten Trainings in diesem Zeitraum. Nach dem Training: Termin antippen → „Nachbereiten“.'}</p>`}</div>
      ${st.topExercises.length ? `<div class="card" style="margin-top:12px"><h2 class="card-h">Am häufigsten trainiert</h2><div class="list" style="border:0">${st.topExercises.map(({ e, n }) => `<button class="list-item" type="button" data-ex="${esc(e.id)}"><span class="grow"><strong>${esc(e.name)}</strong><small>${esc(foci(e).slice(0, 3).join(' · ') || e.tag)}</small></span><span class="badge">${n}×</span></button>`).join('')}</div></div>` : ''}
      ${st.reasons.length ? `<div class="card" style="margin-top:12px"><h2 class="card-h">Ausfallgründe</h2><div class="row">${st.reasons.map(([r, n]) => `<span class="tag warn">${esc(r)} · ${n}</span>`).join('')}</div></div>` : ''}
      <div class="section"><h2>Verlauf</h2><span class="tiny">${plural(list.length, 'Termin', 'Termine')}</span></div>
      ${list.length ? `<div class="stack">${list.map(ev => `${eventCard(s, ev, { showDate: true })}${ev.note && ev.status !== 'geplant' ? `<p class="ev-note small muted">${esc(ev.note.slice(0, 220))}${ev.note.length > 220 ? ' …' : ''}</p>` : ''}`).join('')}</div>`
        : '<div class="empty"><h3>Noch nichts zum Zurückblicken</h3><p>Nach dem Training: Termin antippen → „Nachbereiten“. Teilnehmerzahl, Stimmung und Notizen landen hier.</p></div>'}`;
    on(body, 'click', '[data-range]', (_, b) => { ui.range = b.dataset.range; ui.offset = 0; this.paint(); });
    on(body, 'click', '[data-shift]', (_, b) => { ui.offset = Math.min(0, ui.offset + Number(b.dataset.shift)); haptic('tap'); this.paint(); });
    on(body, 'click', '[data-ex]', (_, b) => openDetail(b.dataset.ex));
  },
};

// ---------- Sheets ----------

/** Termin ansehen: Einheit, Status, Aktionen. */
export function openEvent(id) {
  const paint = sh => {
    const s = store.get(), ev = findEvent(id); if (!ev) { sh.close(); return; }
    const p = planOf(s, ev), team = s.teams.find(t => t.id === ev.teamId), past = isPast(ev), isTraining = ev.kind === 'training';
    sh.setTitle(title(ev));
    sh.setBody(`
      <div class="row" style="margin-bottom:8px">${kindTag(ev)}${statusTag(ev)}${ev.seriesId ? '<span class="tag">Serie</span>' : ''}</div>
      <p><strong>${esc(fmtDate(ev.date, { long: true }))}</strong><br>${esc(ev.start)}–${esc(ev.end)} Uhr · ${duration(ev)} Min${ev.place ? ` · ${esc(ev.place)}` : ''}</p>
      <p class="small muted">${esc(team?.name || '')}${ev.status === 'geplant' ? ` · ${ev.remind === null ? 'Keine Erinnerung' : `Erinnerung ${esc(remindLabel(ev.remind))}`}` : ''}</p>
      ${ev.status === 'ausgefallen' ? `<p class="notice warn">${icon('warn')}<span>Ausgefallen${ev.reason ? `: ${esc(ev.reason)}` : ''}</span></p>` : ''}
      ${ev.status === 'erledigt' ? `<div class="notice ok">${icon('check')}<span class="grow">Gehalten${ev.done ? `: ${esc(ev.done.name)} (${ev.done.minutes} Min)` : ''}${ev.attendance !== undefined ? ` · ${ev.attendance} Spieler` : ''}${ev.rating ? ` · ${stars(ev.rating)}` : ''}</span></div>` : ''}
      ${ev.done ? (() => { const fm = eventFocus(s, ev); return fm?.list.length ? `<div class="focus-strip"><strong class="small">Trainiert</strong>${focusSummary(fm, { max: 6 })}</div>` : ''; })() : ''}
      ${ev.note ? `<p class="small" style="white-space:pre-line">${esc(ev.note)}</p>` : ''}
      ${isTraining || p ? `<h3 style="margin-top:16px">Einheit</h3>${p ? `<div class="plan-card" style="cursor:default"><span class="row between"><strong>${esc(p.name)}</strong><span class="tiny">${totalMinutes(p, s)} von ${duration(ev)} Min · ${plural(p.blocks.length, 'Block', 'Blöcke')}</span></span>
          ${p.goal ? `<span class="small muted">Ziel: ${esc(p.goal)}</span>` : ''}
          ${!ev.done && p.blocks.length ? focusChips(planFocus(s, p).list.map(o => ({ key: o.key, minutes: o.minutes })), { max: 4, link: true, mark: p.focus }) : ''}
          ${p.blocks.length ? `<span class="hero-bar" aria-hidden="true">${p.blocks.map(b => `<i style="width:${b.minutes / Math.max(1, totalMinutes(p, s), duration(ev)) * 100}%"></i>`).join('')}</span><span class="tiny">${p.blocks.slice(0, 6).map(b => esc(exercise(s, b.exerciseId)?.name || '')).join(' · ')}${p.blocks.length > 6 ? ' …' : ''}</span>` : '<span class="tiny">Noch leer</span>'}
          ${totalMinutes(p, s) > duration(ev) ? `<span class="small block-warn">⚠ ${totalMinutes(p, s) - duration(ev)} Min länger als der Termin</span>` : ''}
          <span class="row"><button class="btn sm" type="button" data-a="openplan">${icon('edit')} Bearbeiten</button>${ev.status === 'geplant' && p.blocks.length ? `<button class="btn sm accent" type="button" data-a="train">${icon('start')} Training starten</button>` : ''}<button class="btn sm ghost" type="button" data-a="assign">${icon('swap')} Andere</button></span></div>`
        : `<div class="empty" style="padding:16px"><p>Noch keine Einheit für diesen Termin.</p><div class="row" style="justify-content:center"><button class="btn sm primary" type="button" data-a="assign">${icon('plan')} Einheit wählen</button><button class="btn sm" type="button" data-a="newplan">${icon('plus')} Neue Einheit</button></div></div>`}` : ''}
      <div class="list" style="margin-top:16px">
        ${isTraining && ev.status !== 'ausgefallen' && (past || ev.date <= todayIso()) ? `<button class="list-item" type="button" data-a="review">${icon('check')}<span class="grow"><strong>${ev.status === 'erledigt' ? 'Nachbereitung ändern' : 'Nachbereiten'}</strong><small>Teilnehmer, Stimmung, was lief gut</small></span></button>` : ''}
        ${ev.status === 'geplant' ? `<button class="list-item" type="button" data-a="cancel">${icon('close')}<span class="grow"><strong>Als ausgefallen markieren</strong><small>Mit Grund, bleibt im Rückblick</small></span></button>` : `<button class="list-item" type="button" data-a="reopen">${icon('reset')}<span class="grow"><strong>Wieder auf „geplant“ setzen</strong></span></button>`}
        <button class="list-item" type="button" data-a="copy">${icon('copy')}<span class="grow"><strong>Eine Woche später wiederholen</strong><small>${esc(fmtDate(addDays(ev.date, 7)))} · gleiche Einheit</small></span></button>
        <button class="list-item" type="button" data-a="ics">${icon('download')}<span class="grow"><strong>In Handy-Kalender (.ics)</strong><small>Mit Erinnerung, auch wenn TRAINR geschlossen ist</small></span></button>
        <button class="list-item" type="button" data-a="del" style="color:var(--danger)">${icon('trash')}<span class="grow"><strong>Termin löschen</strong></span></button></div>`);
    sh.setFoot(`<button class="btn" type="button" data-a="edit">${icon('edit')} Bearbeiten</button>${ev.status === 'geplant' && isTraining && (past || ev.date === todayIso()) ? `<button class="btn primary" type="button" data-a="review">${icon('check')} Nachbereiten</button>` : ''}`);
  };
  const act = async (a, sh) => {
    const ev = findEvent(id); if (!ev) return;
    const s = store.get(), p = planOf(s, ev);
    if (a === 'edit') { sh.close(); setTimeout(() => editEvent(id), 220); }
    if (a === 'review') { sh.close(); setTimeout(() => reviewEvent(id), 220); }
    if (a === 'cancel') { sh.close(); setTimeout(() => cancelEvent(id), 220); }
    if (a === 'assign') { sh.close(); setTimeout(() => assignPlan(id), 220); }
    if (a === 'newplan') newPlanFor(id); // navigiert; go() schließt das Sheet
    if (a === 'reopen') { updateEvent('Termin wieder geplant', id, x => { x.status = 'geplant'; delete x.reason; delete x.done; delete x.attendance; delete x.rating; }); undoToast('Termin wieder geplant.'); }
    if (a === 'openplan' || a === 'train') {
      store.update('Einheit gewechselt', d => { d.selectedPlanId = p.id; }, { undo: false });
      go(a === 'train' ? 'training' : 'planen', ...(a === 'train' ? ['start'] : []));
    }
    if (a === 'copy') {
      if (s.events.length >= LIMITS.events) return toast(`Maximal ${LIMITS.events} Termine.`);
      const c = { ...structuredClone(ev), id: uid(), date: addDays(ev.date, 7), status: 'geplant', note: '' };
      for (const k of ['done', 'attendance', 'rating', 'reason', 'seriesId']) delete c[k];
      store.update('Termin wiederholt', d => { d.events.push(c); });
      undoToast(`Termin am ${fmtDate(c.date)} angelegt.`);
    }
    if (a === 'ics') exportICS([ev], `trainr-${ev.date}`);
    if (a === 'del') {
      const same = ev.seriesId ? s.events.filter(x => x.seriesId === ev.seriesId && x.date >= ev.date && x.status === 'geplant') : [];
      sh.close();
      if (same.length > 1) {
        openSheet({
          title: 'Termin löschen?', body: `<p>Dieser Termin gehört zu einer Serie.${ev.seriesId === autoSeriesId({ id: ev.teamId }) ? ' „Diesen und folgende“ beendet die automatische Serie – es kommen keine neuen Wochen mehr dazu.' : ''}</p>`,
          foot: `<button class="btn" type="button" data-one>Nur diesen</button><button class="btn danger solid" type="button" data-rest>Diesen und ${same.length - 1} folgende</button>`,
          onMount: c => {
            c.foot.querySelector('[data-one]').onclick = () => { c.close(); deleteEvents([id]); };
            c.foot.querySelector('[data-rest]').onclick = () => { c.close(); deleteEvents(same.map(x => x.id), ev.seriesId === autoSeriesId({ id: ev.teamId }) ? ev.teamId : null); };
          },
        });
      } else if (await confirmSheet({ title: 'Termin löschen?', text: `${title(ev)} am ${fmtDate(ev.date, { long: true })}. Die Einheit bleibt erhalten. Rückgängig ist direkt danach möglich.`, ok: 'Löschen', danger: true })) deleteEvents([id]);
    }
  };
  let unsub = null;
  openSheet({ title: 'Termin', onMount: sh => { paint(sh); on(sh.dialog, 'click', '[data-a]', (_, b) => act(b.dataset.a, sh)); unsub = store.subscribe(() => paint(sh)); }, onClose: () => unsub?.() });
}

function deleteEvents(ids, stopTeam = null) {
  const set = new Set(ids);
  store.update(ids.length > 1 ? 'Termine gelöscht' : 'Termin gelöscht', d => {
    d.events = d.events.filter(x => !set.has(x.id));
    const t = stopTeam && d.teams.find(x => x.id === stopTeam); if (t) t.autoSeries = false; // automatische Serie beenden
  });
  undoToast(ids.length > 1 ? `${ids.length} Termine gelöscht.${stopTeam ? ' Automatische Serie beendet.' : ''}` : 'Termin gelöscht.');
}

/** Termin anlegen oder bearbeiten. */
export function editEvent(id, date = todayIso(), kind = 'training', { planId = null } = {}) {
  const s = store.get(), team = activeTeam(s), old = id ? findEvent(id) : null;
  if (!old && s.events.length >= LIMITS.events) { toast(`Maximal ${LIMITS.events} Termine. Alte im Rückblick löschen.`); return; }
  const ev = old ? structuredClone(old) : { ...blankEvent(team, date, kind), planId };
  const plans = plansOfTeam(s);
  const sh = openSheet({
    title: old ? 'Termin bearbeiten' : 'Neuer Termin',
    body: `<form id="ev-form" novalidate>
      <div class="field"><span>Art</span><div class="seg" role="radiogroup" aria-label="Art des Termins">${EVENT_KINDS.map(k => `<button type="button" role="radio" data-kind="${k}" aria-checked="${ev.kind === k}">${KIND[k]}</button>`).join('')}</div></div>
      <label class="field"><span>Titel (optional)</span><input class="input" name="title" maxlength="80" value="${esc(ev.title)}" placeholder="${esc(KIND[ev.kind])}" autocomplete="off"></label>
      <div class="grid-3">
        <label class="field"><span>Datum</span><input class="input" type="date" name="date" value="${ev.date}" required></label>
        <label class="field"><span>Beginn</span><input class="input" type="time" name="start" value="${ev.start}" required></label>
        <label class="field"><span>Ende</span><input class="input" type="time" name="end" value="${ev.end}" required></label>
      </div>
      <label class="field"><span>Ort (optional)</span><input class="input" name="place" maxlength="80" value="${esc(ev.place)}" placeholder="z. B. Kunstrasen, Platz 2" autocomplete="off"></label>
      <label class="field"><span>Einheit</span><select class="input" name="plan"><option value="">— keine —</option>${plans.map(p => `<option value="${esc(p.id)}" ${p.id === ev.planId ? 'selected' : ''}>${esc(p.name)} · ${totalMinutes(p, s)} Min</option>`).join('')}</select></label>
      <label class="field"><span>Erinnerung</span><select class="input" name="remind">${REMIND.map(([v, t]) => `<option value="${v ?? ''}" ${v === ev.remind ? 'selected' : ''}>${t}</option>`).join('')}${ev.remind !== null && !REMIND.some(([v]) => v === ev.remind) ? `<option value="${ev.remind}" selected>${esc(remindLabel(ev.remind))}</option>` : ''}</select>
        <small class="tiny" id="ev-perm"></small></label>
      <label class="field"><span>Notiz (keine Kindernamen)</span><textarea class="input" name="note" rows="3" maxlength="2000" placeholder="z. B. Treffpunkt 15 Min vorher, Leibchen mitbringen">${esc(ev.note)}</textarea></label>
      <p class="error" id="ev-err" role="alert"></p></form>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="ev-form">${old ? 'Speichern' : 'Termin anlegen'}</button>`,
    onMount: sh => {
      const f = $('#ev-form', sh.body);
      const perm = () => { const el = $('#ev-perm', sh.body), v = f.remind.value; el.innerHTML = !v ? '' : permission() === 'granted' ? 'Benachrichtigung, solange TRAINR geöffnet ist oder im Hintergrund läuft.' : permission() === 'unsupported' ? 'Erinnerung erscheint in TRAINR. Für geschlossene App: als .ics in den Handy-Kalender.' : `Erinnerung erscheint in TRAINR. <button class="btn ghost sm" type="button" id="ev-allow">Benachrichtigungen erlauben</button>`; $('#ev-allow', sh.body)?.addEventListener('click', async () => { await requestPermission(); perm(); }); };
      perm();
      f.remind.onchange = perm;
      on(sh.body, 'click', '[data-kind]', (_, b) => {
        const was = ev.kind; ev.kind = b.dataset.kind;
        $$('[data-kind]', sh.body).forEach(x => x.setAttribute('aria-checked', String(x === b)));
        f.title.placeholder = KIND[ev.kind];
        if (!old && was === 'training' && ev.kind !== 'training' && f.remind.value === String(DEFAULT_REMIND)) f.remind.value = '';
      });
      f.date.onchange = () => { // Uhrzeit an Trainingszeit des Wochentags anpassen, solange nicht selbst geändert
        const slot = team.slots.find(x => x.day === weekday(f.date.value));
        if (!old && slot && ev.kind === 'training' && !f.start.dataset.touched) { f.start.value = slot.start; f.end.value = slot.end; }
      };
      f.start.oninput = f.end.oninput = ev2 => { ev2.target.dataset.touched = '1'; };
      f.onsubmit = e => {
        e.preventDefault();
        const err = $('#ev-err', sh.body), date = f.date.value, start = f.start.value, end = f.end.value;
        if (!/^\d{4}-\d\d-\d\d$/.test(date)) { err.textContent = 'Bitte ein Datum wählen.'; f.date.focus(); return; }
        if (time(start) < 0 || time(end) < 0) { err.textContent = 'Bitte Beginn und Ende eintragen.'; return; }
        if (time(end) <= time(start)) { err.textContent = 'Das Ende muss nach dem Beginn liegen.'; f.end.focus(); return; }
        const next = { ...ev, date, start, end, title: f.title.value.trim().slice(0, 80), place: f.place.value.trim().slice(0, 80), planId: f.plan.value || null, remind: f.remind.value === '' ? null : Number(f.remind.value), note: f.note.value.slice(0, 2000) };
        const prev = { day: ui.day, month: ui.month };
        ui.day = date; ui.month = monthKey(date);
        try {
          store.update(old ? 'Termin geändert' : 'Termin angelegt', d => { const i = d.events.findIndex(x => x.id === next.id); if (i >= 0) d.events[i] = next; else d.events.push(next); });
        } catch (x) { Object.assign(ui, prev); err.textContent = `Nicht gespeichert: ${x.message}`; return; }
        sh.close();
        undoToast(old ? 'Termin gespeichert.' : `${title(next)} am ${fmtDate(date)} angelegt.`);
      };
    },
  });
  return sh;
}

/** Einheit für einen Termin auswählen (oder neu anlegen). */
export function assignPlan(id) {
  const s = store.get(), ev = findEvent(id); if (!ev) return;
  const list = plansOfTeam(s), tpls = templates(s);
  openSheet({
    title: `Einheit für ${fmtDate(ev.date)}`,
    body: `<p class="small muted">${esc(title(ev))} · ${ev.start}–${ev.end} (${duration(ev)} Min)</p>
      <div class="stack">${list.map(p => `<button class="plan-card" type="button" data-pick="${esc(p.id)}" aria-current="${p.id === ev.planId}"><span class="row between"><strong>${esc(p.name)}</strong><span class="tiny">${totalMinutes(p, s)} Min · ${plural(p.blocks.length, 'Block', 'Blöcke')}</span></span>${usedOn(s, p.id, ev.id)}</button>`).join('')}</div>
      ${tpls.length ? `<h3 style="margin-top:16px">Aus Vorlage</h3><div class="list">${tpls.map(t => `<button class="list-item" type="button" data-tpl="${esc(t.id)}">${icon('template')}<span class="grow"><strong>${esc(t.name)}</strong><small>${totalMinutes(t, s)} Min · wird als neue Einheit kopiert</small></span></button>`).join('')}</div>` : ''}`,
    foot: `${ev.planId ? '<button class="btn" type="button" data-none>Keine Einheit</button>' : ''}<button class="btn primary" type="button" data-newplan>${icon('plus')} Neue Einheit</button>`,
    onMount: sh => {
      on(sh.body, 'click', '[data-pick]', (_, b) => { updateEvent('Einheit zugeordnet', id, x => { x.planId = b.dataset.pick; }); sh.close(); undoToast('Einheit zugeordnet.'); });
      on(sh.body, 'click', '[data-tpl]', (_, b) => {
        const c = duplicatePlan(b.dataset.tpl, { fromTemplate: true }); if (!c) return;
        updateEvent('Einheit zugeordnet', id, x => { x.planId = c.id; }, { undo: false });
        sh.close(); undoToast(`„${c.name}“ aus Vorlage für ${fmtDate(ev.date)} erstellt.`);
      });
      sh.foot.querySelector('[data-none]')?.addEventListener('click', () => { updateEvent('Einheit entfernt', id, x => { x.planId = null; }); sh.close(); });
      sh.foot.querySelector('[data-newplan]').onclick = () => newPlanFor(id);
    },
  });
}
function usedOn(s, planId, exceptId) {
  const n = s.events.filter(x => x.planId === planId && x.id !== exceptId && x.status === 'geplant' && !isPast(x)).length;
  return n ? `<span class="tiny">Schon für ${plural(n, 'weiteren Termin', 'weitere Termine')} vorgesehen</span>` : '';
}
/** Leere Einheit für einen Termin anlegen, zuordnen und im Planer öffnen. */
function newPlanFor(id) {
  const s = store.get(), ev = findEvent(id);
  if (s.plans.length >= LIMITS.plans) { toast(`Maximal ${LIMITS.plans} Einheiten.`); return; }
  const n = { ...blankPlan(s, `${title(ev)} ${fmtDate(ev.date)}`.slice(0, 80)), slot: weekday(ev.date) };
  if (!activeTeam(s).slots.some(x => x.day === n.slot)) n.slot = activeTeam(s).slots[0].day;
  store.update('Einheit für Termin', d => { d.plans.push(n); d.selectedPlanId = n.id; const x = d.events.find(y => y.id === id); if (x) x.planId = n.id; });
  undoToast(`Neue Einheit für ${fmtDate(ev.date)} – jetzt Übungen hinzufügen.`);
  go('planen');
}

/** Nachbereitung: Teilnehmerzahl (ohne Namen), Stimmung, Notizen. Speichert eine Momentaufnahme der Einheit. */
export function reviewEvent(id) {
  const s = store.get(), ev = findEvent(id); if (!ev) return;
  const plans = plansOfTeam(s), p0 = planOf(s, ev);
  const f = { attendance: ev.attendance ?? p0?.people ?? 12, rating: ev.rating || 0, planId: ev.planId || '' };
  openSheet({
    title: 'Nachbereitung',
    body: `<p class="small muted">${esc(title(ev))} · ${esc(fmtDate(ev.date, { long: true }))}, ${ev.start}</p>
      <div class="field"><span>Wie viele Spieler waren da? (ohne Trainer, keine Namen)</span><div class="stepper"><button type="button" data-att="-1" aria-label="Ein Spieler weniger">−</button><input id="rv-att" type="number" min="0" max="100" value="${f.attendance}" aria-label="Anzahl Spieler"><button type="button" data-att="1" aria-label="Ein Spieler mehr">+</button></div></div>
      <div class="field"><span>Wie lief's?</span><div class="stars" role="group" aria-label="Stimmung">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" aria-pressed="${n <= f.rating}" aria-label="${n} von 5 Sternen">★</button>`).join('')}</div></div>
      <label class="field"><span>Gehaltene Einheit</span><select class="input" id="rv-plan"><option value="">— keine / frei —</option>${plans.map(p => `<option value="${esc(p.id)}" ${p.id === f.planId ? 'selected' : ''}>${esc(p.name)} · ${totalMinutes(p, s)} Min</option>`).join('')}</select></label>
      <div id="rv-foci" class="focus-strip" aria-live="polite"></div>
      <label class="field"><span>Notizen (keine Kindernamen)</span><textarea class="input" id="rv-note" rows="5" maxlength="2000" placeholder="Was hat funktioniert? Was wird nächstes Mal anders? Ein Coaching-Punkt für die nächste Einheit.">${esc(ev.note)}</textarea></label>
      <p class="tiny">Die Einheit wird als Momentaufnahme gespeichert – spätere Änderungen am Plan verändern den Rückblick nicht.</p>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" id="rv-save">${icon('check')} Als gehalten speichern</button>`,
    onMount: sh => {
      const b = sh.body, att = $('#rv-att', b);
      const paintFoci = () => {
        const pl = store.get().plans.find(p => p.id === $('#rv-plan', b).value), fm = pl && planFocus(store.get(), pl), el = $('#rv-foci', b);
        el.hidden = !fm?.list.length; el.innerHTML = fm?.list.length ? `<strong class="small">Damit trainiert</strong>${focusSummary(fm, { max: 6, link: false })}` : '';
      };
      $('#rv-plan', b).onchange = paintFoci; paintFoci();
      on(b, 'click', '[data-att]', (_, x) => { att.value = clamp((Number(att.value) || 0) + Number(x.dataset.att), 0, 100); haptic('tap'); });
      on(b, 'click', '[data-star]', (_, x) => { f.rating = Number(x.dataset.star) === f.rating ? 0 : Number(x.dataset.star); $$('[data-star]', b).forEach(y => y.setAttribute('aria-pressed', String(Number(y.dataset.star) <= f.rating))); haptic('tap'); });
      $('#rv-save', sh.foot).onclick = () => {
        const n = Number(att.value);
        if (!Number.isInteger(n) || n < 0 || n > 100) { toast('0–100 Spieler eintragen.'); att.focus(); return; }
        const planId = $('#rv-plan', b).value || null, plan = store.get().plans.find(p => p.id === planId);
        updateEvent('Training nachbereitet', id, x => {
          x.status = 'erledigt'; x.attendance = n; x.note = $('#rv-note', b).value.slice(0, 2000); x.planId = planId; delete x.reason;
          if (f.rating) x.rating = f.rating; else delete x.rating;
          if (plan) x.done = snapshot(plan, store.get()); else delete x.done;
        });
        sh.close(); haptic('ok');
        undoToast('Nachbereitung gespeichert. Sie erscheint im Rückblick.');
      };
    },
  });
}

/** Ausfall mit Grund. */
export function cancelEvent(id) {
  const ev = findEvent(id); if (!ev) return;
  openSheet({
    title: 'Termin fällt aus',
    body: `<p class="small muted">${esc(title(ev))} · ${esc(fmtDate(ev.date, { long: true }))}</p>
      <div class="chips" style="flex-wrap:wrap">${REASONS.map(r => `<button class="chip" type="button" data-reason="${esc(r)}" aria-pressed="${ev.reason === r}">${esc(r)}</button>`).join('')}</div>
      <label class="field"><span>Grund (optional)</span><input class="input" id="cx-reason" maxlength="120" value="${esc(ev.reason || '')}" autocomplete="off"></label>
      <p class="tiny">Die zugeordnete Einheit bleibt erhalten und kann für einen anderen Termin genutzt werden.</p>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn danger solid" type="button" id="cx-save">Ausfall speichern</button>`,
    onMount: sh => {
      const input = $('#cx-reason', sh.body);
      on(sh.body, 'click', '[data-reason]', (_, b) => { input.value = b.dataset.reason; $$('[data-reason]', sh.body).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      $('#cx-save', sh.foot).onclick = () => {
        const r = input.value.trim().slice(0, 120);
        updateEvent('Termin abgesagt', id, x => { x.status = 'ausgefallen'; if (r) x.reason = r; else delete x.reason; });
        sh.close(); undoToast('Als ausgefallen markiert.');
      };
    },
  });
}

/** Serie aus den Trainingszeiten der Mannschaft. */
export function seriesSheet() {
  const s = store.get(), team = activeTeam(s), from0 = todayIso();
  const f = { from: from0, until: addDays(from0, 8 * 7 - 1), days: new Set(team.slots.map(x => x.day)), remind: DEFAULT_REMIND, skipFrom: '', skipTo: '' };
  const build = () => series(store.get(), { ...team, slots: team.slots.filter(x => f.days.has(x.day)) }, { from: f.from, until: f.until, remind: f.remind, skip: f.skipFrom && f.skipTo ? range(f.skipFrom, f.skipTo) : [] });
  openSheet({
    title: 'Trainingsserie anlegen',
    body: `<p class="small muted">Legt für ${esc(team.name)} Trainings an allen gewählten Trainingstagen an. Tage mit vorhandenem Training werden übersprungen.</p>
      <div class="field"><span>Trainingstage</span><div class="chips" style="flex-wrap:wrap">${team.slots.map(x => `<button class="chip" type="button" data-sday="${x.day}" aria-pressed="true">${DAYS_SHORT[x.day]} ${x.start}–${x.end}</button>`).join('')}</div></div>
      <div class="grid-2"><label class="field"><span>Ab</span><input class="input" type="date" id="se-from" value="${f.from}"></label><label class="field"><span>Bis einschließlich</span><input class="input" type="date" id="se-until" value="${f.until}"></label></div>
      <div class="row">${[[4, '4 Wochen'], [8, '8 Wochen'], [12, '12 Wochen'], ['season', 'Saisonhälfte']].map(([w, t]) => `<button class="chip" type="button" data-weeks="${w}">${t}</button>`).join('')}</div>
      <details class="disclosure" style="margin-top:12px"><summary>Ferien oder Pause auslassen</summary><div class="body"><div class="grid-2"><label class="field"><span>Von</span><input class="input" type="date" id="se-sf"></label><label class="field"><span>Bis</span><input class="input" type="date" id="se-st"></label></div></div></details>
      <label class="field"><span>Erinnerung</span><select class="input" id="se-remind">${REMIND.map(([v, t]) => `<option value="${v ?? ''}" ${v === f.remind ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <p class="notice" id="se-preview" aria-live="polite"></p>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" id="se-go">${icon('repeat')} Serie anlegen</button>`,
    onMount: sh => {
      const b = sh.body;
      const preview = () => {
        const list = f.until >= f.from && f.days.size ? build() : [], room = LIMITS.events - store.get().events.length;
        $('#se-preview', b).textContent = !f.days.size ? 'Mindestens einen Trainingstag wählen.' : f.until < f.from ? 'Das Enddatum liegt vor dem Startdatum.'
          : list.length ? `${plural(list.length, 'Training', 'Trainings')} vom ${fmtDate(list[0].date)} bis ${fmtDate(list.at(-1).date)}.${list.length > room ? ` Nur ${room} passen noch in den Kalender.` : ''}` : 'Im Zeitraum sind alle Trainingstage schon belegt.';
        $('#se-go', sh.foot).disabled = !list.length || room <= 0;
      };
      preview();
      on(b, 'click', '[data-sday]', (_, x) => { const d = Number(x.dataset.sday); f.days.has(d) ? f.days.delete(d) : f.days.add(d); x.setAttribute('aria-pressed', String(f.days.has(d))); preview(); });
      on(b, 'click', '[data-weeks]', (_, x) => {
        const w = x.dataset.weeks;
        if (w === 'season') { const [y, m] = f.from.split('-').map(Number); f.until = m >= 7 ? `${y}-12-20` : `${y}-06-30`; }
        else f.until = addDays(f.from, Number(w) * 7 - 1);
        $('#se-until', b).value = f.until; preview();
      });
      $('#se-from', b).onchange = ev => { f.from = ev.target.value || from0; preview(); };
      $('#se-until', b).onchange = ev => { f.until = ev.target.value || f.from; preview(); };
      $('#se-sf', b).onchange = ev => { f.skipFrom = ev.target.value; preview(); };
      $('#se-st', b).onchange = ev => { f.skipTo = ev.target.value; preview(); };
      $('#se-remind', b).onchange = ev => { f.remind = ev.target.value === '' ? null : Number(ev.target.value); };
      $('#se-go', sh.foot).onclick = () => {
        const list = build().slice(0, LIMITS.events - store.get().events.length); if (!list.length) return;
        ui.mode = 'liste';
        store.update('Trainingsserie angelegt', d => { d.events.push(...list); });
        sh.close();
        undoToast(`${plural(list.length, 'Training', 'Trainings')} eingetragen.`);
      };
    },
  });
}

/** Trainings in einem Zeitraum absagen (Ferien, Hallenpause). */
function pauseSheet() {
  const f = { from: todayIso(), to: addDays(todayIso(), 13), reason: 'Ferien' };
  const hits = () => eventsOfTeam(store.get()).filter(ev => ev.kind === 'training' && ev.status === 'geplant' && ev.date >= f.from && ev.date <= f.to);
  openSheet({
    title: 'Pause oder Ferien',
    body: `<p class="small muted">Alle geplanten Trainings im Zeitraum werden als ausgefallen markiert. Rückgängig ist direkt danach möglich.</p>
      <div class="grid-2"><label class="field"><span>Von</span><input class="input" type="date" id="pa-from" value="${f.from}"></label><label class="field"><span>Bis</span><input class="input" type="date" id="pa-to" value="${f.to}"></label></div>
      <label class="field"><span>Grund</span><input class="input" id="pa-reason" maxlength="120" value="${f.reason}"></label><p class="notice" id="pa-prev" aria-live="polite"></p>`,
    foot: `<button class="btn" type="button" data-close>Abbrechen</button><button class="btn danger solid" type="button" id="pa-go">Trainings absagen</button>`,
    onMount: sh => {
      const prev = () => { const n = hits().length; $('#pa-prev', sh.body).textContent = n ? `${plural(n, 'geplantes Training', 'geplante Trainings')} betroffen.` : 'Keine geplanten Trainings im Zeitraum.'; $('#pa-go', sh.foot).disabled = !n; };
      prev();
      $('#pa-from', sh.body).onchange = ev => { f.from = ev.target.value; prev(); };
      $('#pa-to', sh.body).onchange = ev => { f.to = ev.target.value; prev(); };
      $('#pa-go', sh.foot).onclick = () => {
        const ids = new Set(hits().map(ev => ev.id)), r = $('#pa-reason', sh.body).value.trim().slice(0, 120);
        store.update('Pause eingetragen', d => { for (const ev of d.events) if (ids.has(ev.id)) { ev.status = 'ausgefallen'; if (r) ev.reason = r; } });
        sh.close(); undoToast(`${plural(ids.size, 'Training', 'Trainings')} abgesagt.`);
      };
    },
  });
}

function moreSheet() {
  const s = store.get(), next = upcoming(s), team = activeTeam(s);
  const p = permission();
  openSheet({
    title: 'Kalender',
    body: `<div class="list">
      <button class="list-item" type="button" data-a="ics" ${next.length ? '' : 'disabled'}>${icon('download')}<span class="grow"><strong>Kommende Termine exportieren (.ics)</strong><small>${plural(next.length, 'Termin', 'Termine')} · für Google, Apple oder Outlook Kalender, mit Erinnerungen</small></span></button>
      <button class="list-item" type="button" data-a="pause">${icon('pause')}<span class="grow"><strong>Pause oder Ferien eintragen</strong><small>Trainings im Zeitraum absagen</small></span></button>
      <label class="list-item switch-row" style="border-bottom:1px solid var(--line)">${icon('repeat')}<span class="grow"><strong>Trainings automatisch eintragen</strong><small>${team.slots.map(x => `${DAYS_SHORT[x.day]} ${x.start}`).join(', ')} · immer ${AUTO_WEEKS} Wochen im Voraus</small></span><input class="switch" type="checkbox" id="cal-auto" ${autoOn(team) ? 'checked' : ''}></label>
      <button class="list-item" type="button" data-a="series">${icon('plus')}<span class="grow"><strong>Längere Serie anlegen</strong><small>${team.slots.map(x => DAYS_SHORT[x.day]).join(', ')} aus den Trainingszeiten</small></span></button>
      <button class="list-item" type="button" data-a="perm" ${p === 'granted' || p === 'unsupported' ? 'disabled' : ''}>${icon('bell')}<span class="grow"><strong>Benachrichtigungen</strong><small>${p === 'granted' ? 'Erlaubt' : p === 'denied' ? 'Im Browser blockiert – in den Website-Einstellungen freigeben' : p === 'unsupported' ? 'Von diesem Browser nicht unterstützt' : 'Jetzt erlauben'}</small></span></button>
    </div>
    <p class="tiny" style="margin-top:12px">Erinnerungen kommen von TRAINR, solange die App geöffnet ist oder im Hintergrund läuft – ohne Server und ohne Konto. Wer sich auch bei geschlossener App erinnern lassen will, exportiert die Termine als .ics in den Kalender des Handys.</p>`,
    onMount: sh => {
      $('#cal-auto', sh.body).onchange = ev => {
        const on2 = ev.target.checked;
        store.update(on2 ? 'Automatische Serie an' : 'Automatische Serie aus', d => {
          const t = d.teams.find(x => x.id === team.id);
          if (on2) { delete t.autoSeries; delete t.seriesUntil; autoFill(d); } else t.autoSeries = false;
        });
        undoToast(on2 ? `Trainingstage stehen jetzt ${AUTO_WEEKS} Wochen im Voraus im Kalender.` : 'Keine neuen Wochen mehr. Eingetragene Termine bleiben.');
      };
      on(sh.body, 'click', '[data-a]', async (_, b) => {
      const a = b.dataset.a;
      if (a === 'perm') { const r = await requestPermission(); toast(r === 'granted' ? 'Benachrichtigungen erlaubt.' : 'Benachrichtigungen nicht erlaubt. Erinnerungen erscheinen in TRAINR.'); sh.close(); return; }
      sh.close();
      if (a === 'ics') exportICS(next, `trainr-kalender-${fileDate()}`);
      if (a === 'pause') setTimeout(pauseSheet, 220);
      if (a === 'series') setTimeout(seriesSheet, 220);
      });
    },
  });
}

async function exportICS(events, name) {
  const body = toICS(store.get(), events), { shareFiles } = await import('../exports/share.js');
  const file = new File([body], `${name}.ics`, { type: 'text/calendar' });
  const r = await shareFiles([file], { title: 'TRAINR Termine' });
  if (r === 'shared') toast('Termine geteilt.');
}

/** Für den Planer: Einheit einem Termin zuordnen – bestehender Termin ohne Einheit oder neuer Termin. */
export function scheduleSheet(planId) {
  const s = store.get(), p = s.plans.find(x => x.id === planId); if (!p) return;
  const free = upcoming(s).filter(ev => ev.kind === 'training' && !ev.planId).slice(0, 12), linked = upcoming(s).filter(ev => ev.planId === planId);
  openSheet({
    title: 'Im Kalender eintragen',
    body: `<p class="small muted">„${esc(p.name)}“ · ${totalMinutes(p, s)} Min</p>
      ${linked.length ? `<h3>Schon eingetragen</h3><div class="stack">${linked.map(ev => eventCard(s, ev, { showDate: true })).join('')}</div>` : ''}
      ${free.length ? `<h3 style="margin-top:12px">Trainings ohne Einheit</h3><div class="list">${free.map(ev => `<button class="list-item" type="button" data-free="${esc(ev.id)}">${icon('plan')}<span class="grow"><strong>${esc(fmtDate(ev.date, { relative: true }))}, ${ev.start}–${ev.end}</strong><small>${esc(title(ev))}${ev.place ? ` · ${esc(ev.place)}` : ''}</small></span>${icon('plus')}</button>`).join('')}</div>` : '<p class="tiny">Keine kommenden Trainings ohne Einheit. Lege einen neuen Termin an.</p>'}`,
    foot: `<button class="btn" type="button" data-cal>${icon('calendar')} Kalender</button><button class="btn primary" type="button" data-new>${icon('plus')} Neuer Termin</button>`,
    onMount: sh => {
      on(sh.body, 'click', '[data-free]', (_, b) => { updateEvent('Einheit zugeordnet', b.dataset.free, x => { x.planId = planId; }); const ev = findEvent(b.dataset.free); sh.close(); undoToast(`Für ${fmtDate(ev.date)} eingetragen.`); });
      on(sh.body, 'click', '[data-ev]', (_, b) => { sh.close(); setTimeout(() => openEvent(b.dataset.ev), 220); });
      sh.foot.querySelector('[data-cal]').onclick = () => go('kalender');
      sh.foot.querySelector('[data-new]').onclick = () => {
        sh.close();
        const t = activeTeam(store.get()), today = todayIso();
        let d = today; for (let i = 0; i < 7; i++) { const c = addDays(today, i); if (t.slots.some(x => x.day === weekday(c))) { d = c; break; } }
        setTimeout(() => editEvent(null, d, 'training', { planId }), 220);
      };
    },
  });
}

/** Heutiges Training der aktiven Mannschaft (für die Nachbereitung nach dem Timer). */
export function todaysTraining(s, planId = s.selectedPlanId, now = new Date()) {
  const list = eventsOn(s, iso(now)).filter(ev => ev.kind === 'training' && ev.status === 'geplant');
  return list.find(ev => ev.planId === planId) || list.find(ev => !ev.planId) || null;
}
