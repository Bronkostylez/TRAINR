// Heute: nächste Einheit, Ein-Tipp-Erstellung, Start und Schnellaktionen.
import { openWeek, prepareEvent } from './week.js';
import * as store from '../core/store.js';
import { currentPlan, activeTeam, exercise, squadLabel, blockLayout, layoutText, totalMinutes, timeline, slotOf, slotMinutes, planAge, planType, check, foci, planFocus } from '../core/planning.js';
import { focusChips, areaBar } from '../ui/focus.js';
import { openAssistant } from './assistant.js';
import { DAYS, LABELS, esc, time, fmtTime, plural } from '../core/util.js';
import { icon, $, on } from '../ui/dom.js';
import { stagger } from '../ui/motion.js';
import { go } from '../ui/router.js';
import { ensurePlan } from '../ui/actions.js';
import { toast } from '../ui/feedback.js';
import { openBlockEditor, swapBlock, openAddSheet } from './blocks.js';
import { LIMITS } from '../core/schema.js';
import { upcoming, needsReview, weekday, duration, fmtDate, startOf, endOf, title as evTitle, stats, neglected, addDays, todayIso, mondayOf } from '../core/calendar.js';
import { eventCard, openEvent, reviewEvent, seriesSheet } from './calendar.js';
import { openSquadSheet } from './squad.js';
import { suggestWeek } from '../core/season.js';
import { suggestionHtml } from '../ui/season.js';
import { acceptSuggestion } from './week.js';

/** Nächster Trainingstermin der Mannschaft ab jetzt. */
export function nextSession(team, now = new Date()) {
  if (!team?.slots.length) return null;
  const today = (now.getDay() + 6) % 7, mins = now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const s of team.slots) {
    let diff = (s.day - today + 7) % 7;
    if (diff === 0 && time(s.end) <= mins) diff = 7;
    if (!best || diff < best.diff || (diff === best.diff && time(s.start) < time(best.slot.start))) best = { slot: s, diff };
  }
  const when = best.diff === 0 ? (time(best.slot.start) <= mins ? 'läuft gerade' : 'heute') : best.diff === 1 ? 'morgen' : `in ${best.diff} Tagen`;
  return { ...best, when };
}

/** 'heute', 'morgen', 'in 3 Tagen', 'läuft gerade' für einen Kalendertermin. */
function eventWhen(ev, now = new Date()) {
  if (startOf(ev) <= now && endOf(ev) > now) return 'läuft gerade';
  const diff = Math.round((new Date(ev.date + 'T00:00') - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  return diff === 0 ? 'heute' : diff === 1 ? 'morgen' : `in ${diff} Tagen`;
}

export const todayView = {
  id: 'heute', title: 'Heute', tab: 'heute',
  render(root) {
    ensurePlan();
    root.innerHTML = `<div id="today"></div>`;
    this.root = root;
    this.refresh();
    stagger(root.querySelectorAll('.hero, .card, .tl-item'));
  },
  refresh() {
    const s = store.get(), team = activeTeam(s), p = currentPlan(s);
    if (!team || !p) return;
    const next = nextSession(team), slot = slotOf(s, p), total = totalMinutes(p, s), avail = slotMinutes(slot), empty = !p.blocks.length;
    const tl = timeline(s, p), warns = check(s, p).filter(c => c.level === 'warn');
    const backupAge = s.help.lastBackup ? Math.floor((Date.now() - s.help.lastBackup) / 864e5) : null;
    const hasData = s.plans.some(x => x.blocks.length) || s.custom.length;
    // Kalendertermine haben Vorrang vor dem Wochenrhythmus der Trainingszeiten.
    const fm = planFocus(s, p), gaps = neglected(s), recent = stats(s, { from: addDays(todayIso(), -13) });
    const events = upcoming(s, { limit: 3 }), nextEv = events[0], review = needsReview(s), nextPlan = nextEv && s.plans.find(x => x.id === nextEv.planId);
    // Höchstens ein Hinweis oben: Nachbereitung vor „anderer Plan für den nächsten Termin“.
    const notice = review.length ? `<div class="notice">${icon('check')}<span class="grow">${esc(evTitle(review[0]))} vom ${esc(fmtDate(review[0].date))} nachbereiten?${review.length > 1 ? ` (${review.length} offen)` : ''}</span><button class="btn sm" type="button" id="t-review" data-id="${esc(review[0].id)}">Nachbereiten</button></div>`
      : nextPlan && nextPlan.id !== p.id ? `<div class="notice">${icon('calendar')}<span class="grow">Für ${esc(fmtDate(nextEv.date, { relative: true }))} ist „${esc(nextPlan.name)}“ geplant.</span><button class="btn sm" type="button" id="t-useplan" data-id="${esc(nextPlan.id)}">Öffnen</button></div>` : '';
    const sg = nextEv?.kind === 'training' && !nextEv.foci?.length && !nextPlan ? suggestWeek(s, team, mondayOf(nextEv.date))[nextEv.id] : null;
    $('#today', this.root).innerHTML = `<div class="today-main">
      <div class="page-head"><div>
        <p class="eyebrow"><span translate="no">${esc(team.name)}</span> · ${esc(planAge(s, p))} · ${esc(LABELS[planType(s, p)])}</p>
        ${nextEv ? `<h1 id="h-heute">${esc(DAYS[weekday(nextEv.date)])}, ${esc(nextEv.start)}</h1>
        <p class="muted">${esc(evTitle(nextEv))} ${esc(eventWhen(nextEv))} · ${duration(nextEv)} Min${nextEv.place ? ` · ${esc(nextEv.place)}` : ''}</p>`
        : `<h1 id="h-heute">${next ? `${esc(DAYS[next.slot.day])}, ${esc(next.slot.start)}` : 'Dein Training'}</h1>
        <p class="muted">${next ? `Nächstes Training ${esc(next.when)} · ${slotMinutes(next.slot)} Min` : ''}</p>`}
      </div></div>
      ${notice ? `<div class="today-notice">${notice}</div>` : ''}
      ${sg ? `<article class="card week-today">${suggestionHtml(sg)}<div class="row"><button class="btn primary grow" type="button" id="t-accept" data-id="${esc(nextEv.id)}">${icon('check')} Übernehmen</button><button class="btn" type="button" id="t-week2">Ändern</button></div></article>` : ''}
      ${nextEv?.kind === 'training' && nextEv.foci?.length && !nextPlan ? `<article class="card week-today"><p class="eyebrow">Fokus fürs nächste Training</p><div class="chips">${nextEv.foci.map(k => `<span class="chip">${esc(k)}</span>`).join('')}</div><button class="btn primary block" id="t-prepare" data-id="${esc(nextEv.id)}">${icon('sparkles')} Einheit vorbereiten</button><p class="tiny muted">Besetzung am Trainingstag prüfen</p></article>` : ''}
      <article class="hero ${empty ? 'hero-empty' : ''}" aria-labelledby="hero-name">
        ${empty ? `<p class="eyebrow">Noch nichts geplant</p>
        <h2 id="hero-name">Was trainiert ihr?</h2>
        <p class="muted hero-lead">Schwerpunkte antippen – der Assistent stellt eine passende Einheit zusammen, mit Begründung und Plan B je Übung.</p>
        <div class="hero-actions">
          <button class="btn accent lg grow" type="button" id="c-go">${icon('sparkles')} Einheit erstellen</button>
          <button class="btn lg" type="button" id="t-add0">${icon('plus')} Selbst wählen</button>
        </div>` : `<p class="eyebrow">Deine Einheit</p>
        <h2 id="hero-name">${esc(p.name)}</h2>
        ${p.goal ? `<p class="muted">Ziel: ${esc(p.goal)}</p>` : ''}
        <div class="hero-stats">
          <div><strong>${total}</strong><small>von ${avail || '–'} Min</small></div>
          <div><strong>${p.blocks.length}</strong><small>${p.blocks.length === 1 ? 'Übung' : 'Übungen'}</small></div>
          <button type="button" id="t-squad" aria-haspopup="dialog" aria-label="Wer ist da: ${esc(squadLabel(p, planType(s, p)))}"><strong>${p.people}</strong><small>Spieler ${icon('edit')}</small></button>
        </div>
        <div class="hero-bar" aria-hidden="true">${p.blocks.map(b => `<i style="width:${(b.minutes / Math.max(total, avail || total)) * 100}%"></i>`).join('')}</div>
        ${fm.list.length ? `<div class="hero-foci">${focusChips(fm.list.map(o => ({ key: o.key, minutes: o.minutes })), { max: 3, link: true, mark: p.focus })}</div>` : ''}
        ${warns.length ? `<p class="small hero-warn">${icon('warn')} ${esc(warns[0].text)}</p>` : ''}
        <div class="hero-actions">
          <button class="btn accent lg grow" type="button" id="t-start">${icon('start')} Training starten</button>
          <button class="btn lg" type="button" id="t-edit" aria-label="Einheit bearbeiten">${icon('edit')}<span class="hide-xs" aria-hidden="true">Bearbeiten</span></button>
        </div>`}
      </article>
      <div class="today-actions">
        ${empty ? '' : `<button class="btn" type="button" id="c-go">${icon('sparkles')} Neue Einheit</button>`}
        <button class="btn" type="button" id="t-week">${icon('calendar')} Woche planen</button>
      </div></div><div class="today-side">

      ${empty ? '' : `<div class="section"><h2>Ablauf</h2><span class="tiny">${total} Min${slot ? ` · ${esc(slot.start)}–${fmtTime(time(slot.start) + total)}` : ''}</span></div>
      <div class="timeline" id="t-list">${tl.map(({ block: b, label, pause }, i) => { const e = exercise(s, b.exerciseId); return `
        <div class="tl-item" data-block="${b.id}" role="group" aria-label="Block ${i + 1}: ${esc(e.name)}">
          <span class="tl-time">${label || `#${i + 1}`}</span>
          <button type="button" class="tl-main" data-edit="${b.id}"><strong>${e.type === 'keeper' ? '<span class="keeper-dot" aria-label="Torwart"></span> ' : ''}${esc(e.name)}</strong><small>${esc(foci(e).slice(0, 2).join(' · ') || e.tag)}${(() => { const L = blockLayout(s, p, b); return L && L.mode !== 'group' && L.level !== 'no' ? ` · ${esc(layoutText(L))}` : ''; })()}${b.people ? ` · ${b.people} Spieler` : ''}${b.note ? ` · ${esc(b.note)}` : ''}</small></button>
          <span class="row" style="flex-wrap:nowrap;gap:2px"><span class="min">${b.minutes}′</span><button class="icon-btn" type="button" data-swap="${b.id}" aria-label="${esc(e.name)} tauschen">${icon('swap')}</button></span>
        </div>${pause ? `<div class="tl-item pause-item" style="cursor:default"><span class="tl-time">${pause.label || ''}</span><span><strong title="${esc(pause.why)}">${icon('pause')} Trinkpause</strong></span><span class="min">${pause.minutes}′</span></div>` : ''}`; }).join('')}</div>
      <div class="row today-links"><button class="btn ghost sm" type="button" id="t-pack">${icon('cone')} Packliste</button><button class="btn ghost sm" type="button" id="t-board">${icon('board')} Taktikboard</button></div>`}

      <div class="section"><h2>Termine</h2><button class="btn ghost sm" type="button" id="t-cal">${icon('calendar')} Kalender</button></div>
      ${events.length ? `<div class="stack" id="t-events">${events.map(ev => eventCard(s, ev, { showDate: true })).join('')}</div>`
        : `<div class="notice">${icon('calendar')}<span class="grow">Noch keine Termine. Trage deine Trainingstage als Serie ein – mit Erinnerung.</span><button class="btn sm" type="button" id="t-series">Serie anlegen</button></div>`}

      ${recent.trained.total || gaps.length ? `<details class="disclosure focus-recap" id="t-recap" style="margin-top:16px"><summary><span class="grow">Zuletzt trainiert${recent.trained.total ? ` <span class="tiny">· ${recent.held} ${recent.held === 1 ? 'Training' : 'Trainings'} · ${recent.trained.total} Min</span>` : ''}</span></summary>
      <div class="body">${recent.trained.total ? `<p class="tiny" style="margin:0 0 6px">Letzte 14 Tage</p>${areaBar(recent.trained)}
        <div style="margin-top:8px">${focusChips(recent.trained.list.map(o => ({ key: o.key, minutes: o.minutes })), { max: 6, link: true })}</div>` : ''}
        ${gaps.length ? `<p class="small muted" style="margin:10px 0 4px">Seit 4 Wochen nicht dabei – antippen für eine passende Einheit:</p><div class="row">${gaps.slice(0, 4).map(k => `<button class="chip sm-chip" type="button" data-gap="${esc(k)}">${icon('sparkles')} ${esc(k)}</button>`).join('')}</div>` : ''}
        <button class="btn ghost sm" type="button" id="t-rueck" style="margin-top:8px">${icon('chart')} Rückblick</button></div></details>` : ''}

      ${hasData && !notice && (backupAge === null || backupAge > 14) ? `<div class="notice" style="margin-top:16px">${icon('data')}<span class="grow">${backupAge === null ? 'Noch kein Backup erstellt.' : `Letztes Backup vor ${plural(backupAge, 'Tag', 'Tagen')}.`} Deine Daten liegen nur in diesem Browser.</span><button class="btn sm" type="button" id="t-backup">Sichern</button></div>` : ''}</div>`;
    this.bind();
  },
  bind() {
    const r = this.root;
    $('#t-start', r)?.addEventListener('click', () => go('training', 'start'));
    $('#t-edit', r)?.addEventListener('click', () => go('planen'));
    $('#t-squad', r)?.addEventListener('click', () => openSquadSheet());
    $('#t-add0', r)?.addEventListener('click', openAddSheet);
    $('#t-pack', r)?.addEventListener('click', () => go('planen', 'packliste'));
    $('#t-board', r)?.addEventListener('click', () => go('taktik'));
    $('#t-cal', r).onclick = () => go('kalender');
    $('#t-rueck', r)?.addEventListener('click', () => go('kalender', 'rueckblick'));
    $('#t-series', r)?.addEventListener('click', seriesSheet);
    $('#t-review', r)?.addEventListener('click', ev => reviewEvent(ev.currentTarget.dataset.id));
    $('#t-useplan', r)?.addEventListener('click', ev => { const id = ev.currentTarget.dataset.id; store.update('Einheit gewechselt', d => { d.selectedPlanId = id; }, { undo: false }); toast('Einheit für den nächsten Termin geöffnet.'); });
    on(r, 'click', '[data-ev]', (_, b) => openEvent(b.dataset.ev));
    $('#t-backup', r)?.addEventListener('click', () => import('./more.js').then(m => m.downloadBackup()));
    on(r, 'click', '[data-gap]', (_, b) => openAssistant({ preset: { foci: [b.dataset.gap] } }));
    $('#t-week', r).onclick = openWeek;
    $('#t-week2', r)?.addEventListener('click', openWeek);
    $('#t-accept', r)?.addEventListener('click', ev => { acceptSuggestion(ev.currentTarget.dataset.id); });
    $('#t-prepare', r)?.addEventListener('click', ev => prepareEvent(ev.currentTarget.dataset.id));
    $('#c-go', r).onclick = () => openAssistant();
    on(r, 'click', '[data-edit]', (_, b) => openBlockEditor(b.dataset.edit));
    on(r, 'click', '[data-swap]', (_, b) => swapBlock(b.dataset.swap));
  },
};
