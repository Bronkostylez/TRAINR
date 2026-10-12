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

let formOpen = null, userToggled = false; // Offen-Zustand des Erstellen-Bereichs (am Anfang offen, solange die Einheit leer ist)

export const todayView = {
  id: 'heute', title: 'Heute', tab: 'heute',
  render(root) {
    ensurePlan();
    root.innerHTML = `<div id="today"></div>`;
    this.root = root;
    this.refresh();
    stagger(root.querySelectorAll('.hero, .card, .quick, .tl-item'));
  },
  refresh() {
    const s = store.get(), team = activeTeam(s), p = currentPlan(s);
    if (!team || !p) return;
    const next = nextSession(team), slot = slotOf(s, p), total = totalMinutes(p, s), avail = slotMinutes(slot);
    formOpen = userToggled ? formOpen : !p.blocks.length; // leer: Erstellen offen; mit Einheit: eingeklappt, bis du es selbst öffnest
    const tl = timeline(s, p), warns = check(s, p).filter(c => c.level === 'warn');
    const backupAge = s.help.lastBackup ? Math.floor((Date.now() - s.help.lastBackup) / 864e5) : null;
    const hasData = s.plans.some(x => x.blocks.length) || s.custom.length;
    // Kalendertermine haben Vorrang vor dem Wochenrhythmus der Trainingszeiten.
    const fm = planFocus(s, p), gaps = neglected(s), recent = stats(s, { from: addDays(todayIso(), -13) });
    const events = upcoming(s, { limit: 3 }), nextEv = events[0], review = needsReview(s), nextPlan = nextEv && s.plans.find(x => x.id === nextEv.planId);
    $('#today', this.root).innerHTML = `
      <div class="page-head"><div>
        <p class="eyebrow"><span translate="no">${esc(team.name)}</span> · ${esc(planAge(s, p))} · ${esc(LABELS[planType(s, p)])}</p>
        ${nextEv ? `<h1 id="h-heute">${esc(DAYS[weekday(nextEv.date)])}, ${esc(nextEv.start)}</h1>
        <p class="muted">${esc(evTitle(nextEv))} ${esc(eventWhen(nextEv))} · ${duration(nextEv)} Min${nextEv.place ? ` · ${esc(nextEv.place)}` : ''}</p>`
        : `<h1 id="h-heute">${next ? `${esc(DAYS[next.slot.day])}, ${esc(next.slot.start)}` : 'Dein Training'}</h1>
        <p class="muted">${next ? `Nächstes Training ${esc(next.when)} · ${slotMinutes(next.slot)} Min` : ''}</p>`}
      </div></div>
      ${review.length ? `<div class="notice" style="margin-bottom:12px">${icon('check')}<span class="grow">${esc(evTitle(review[0]))} vom ${esc(fmtDate(review[0].date))} nachbereiten?${review.length > 1 ? ` (${review.length} offen)` : ''}</span><button class="btn sm" type="button" id="t-review" data-id="${esc(review[0].id)}">Nachbereiten</button></div>` : ''}
      ${!review.length && nextPlan && nextPlan.id !== p.id ? `<div class="notice" style="margin-bottom:12px">${icon('calendar')}<span class="grow">Für ${esc(fmtDate(nextEv.date, { relative: true }))} ist „${esc(nextPlan.name)}“ geplant.</span><button class="btn sm" type="button" id="t-useplan" data-id="${esc(nextPlan.id)}">Öffnen</button></div>` : ''}

      <button class="btn block week-entry" id="t-week" type="button">${icon('calendar')} Wochenplaner <span class="grow"></span>${icon('chevron')}</button>${(() => { const sg = nextEv?.kind === 'training' && !nextEv.foci?.length && !nextPlan ? suggestWeek(s, team, mondayOf(nextEv.date))[nextEv.id] : null; return sg ? `<article class="card week-today">${suggestionHtml(sg)}<div class="row"><button class="btn primary grow" type="button" id="t-accept" data-id="${esc(nextEv.id)}">${icon('check')} Übernehmen</button><button class="btn" type="button" id="t-week2">Ändern</button></div></article>` : ''; })()}${nextEv?.kind === 'training' && nextEv.foci?.length && !nextPlan ? `<article class="card week-today"><p class="eyebrow">Fokus fürs nächste Training</p><div class="chips">${nextEv.foci.map(k => `<span class="chip">${esc(k)}</span>`).join('')}</div><button class="btn primary block" id="t-prepare" data-id="${esc(nextEv.id)}">${icon('sparkles')} Einheit vorbereiten</button><p class="tiny muted">Besetzung am Trainingstag prüfen</p></article>` : ''}
      <article class="hero" aria-labelledby="hero-name">
        <p class="eyebrow">Deine Einheit</p>
        <h2 id="hero-name">${esc(p.name)}</h2>
        ${p.goal ? `<p class="muted">Ziel: ${esc(p.goal)}</p>` : ''}
        <div class="hero-stats">
          <div><strong>${total}</strong><small>von ${avail || '–'} Min</small></div>
          <div><strong>${p.blocks.length}</strong><small>${p.blocks.length === 1 ? 'Übung' : 'Übungen'}</small></div>
          <div><strong>${p.people}</strong><small>Spieler</small></div>
        </div>
        <p class="tiny" style="margin:-6px 0 10px"><button class="chip sm-chip" type="button" id="t-squad" aria-haspopup="dialog" title="Wer ist da: Spieler, Torwart, Trainer">${esc(squadLabel(p, planType(s, p)))}</button></p>
        ${p.blocks.length ? `<div class="hero-bar" aria-hidden="true">${p.blocks.map(b => `<i style="width:${(b.minutes / Math.max(total, avail || total)) * 100}%"></i>`).join('')}</div>` : ''}
        ${fm.list.length ? `<div class="hero-foci"><span class="tiny">Im Fokus</span>${focusChips(fm.list.map(o => ({ key: o.key, minutes: o.minutes })), { max: 2, link: true, mark: p.focus })}</div>` : ''}
        ${warns.length ? `<p class="small hero-warn">${icon('warn')} ${esc(warns[0].text)}</p>` : ''}
        <div class="row" style="margin-top:16px">
          <button class="btn accent lg grow" type="button" id="t-start" ${p.blocks.length ? '' : 'disabled'}>${icon('start')} Training starten</button>
          <button class="btn lg" type="button" id="t-edit" aria-label="Einheit bearbeiten">${icon('edit')}</button>
        </div>
      </article>

      <details class="disclosure" id="t-create" style="margin-top:16px" ${formOpen ? 'open' : ''}>
        <summary>${icon('sparkles')} <span class="grow">Neue Einheit mit dem Assistenten</span></summary>
        <div class="body">
          <p class="small muted">Schwerpunkte antippen, Rahmen prüfen, Vorschlag bekommen – mit Begründung, Quelle und Plan B je Übung.</p>
          ${gaps.length ? `<p class="tiny" style="margin:-4px 0 10px">Lange nicht trainiert: ${gaps.slice(0, 4).map(k => `<button class="chip sm-chip" type="button" data-gap="${esc(k)}">${esc(k)}</button>`).join(' ')}</p>` : ''}
          <button class="btn primary block lg" type="button" id="c-go">${icon('sparkles')} Einheit erstellen</button>
        </div>
      </details>

      <div class="section"><h2>Ablauf</h2><span class="tiny">${p.blocks.length ? `${total} Min · ${slot ? `${esc(slot.start)}–${fmtTime(time(slot.start) + total)}` : ''}` : 'Noch leer'}</span></div>
      ${p.blocks.length ? `<div class="timeline" id="t-list">${tl.map(({ block: b, label, pause }, i) => { const e = exercise(s, b.exerciseId); return `
        <div class="tl-item" data-block="${b.id}" role="group" aria-label="Block ${i + 1}: ${esc(e.name)}">
          <span class="tl-time">${label || `#${i + 1}`}</span>
          <button type="button" class="btn ghost" style="all:unset;cursor:pointer;min-width:0" data-edit="${b.id}"><strong>${e.type === 'keeper' ? '<span class="keeper-dot" aria-label="Torwart"></span> ' : ''}${esc(e.name)}</strong><small>${esc(foci(e).slice(0, 2).join(' · ') || e.tag)}${(() => { const L = blockLayout(s, p, b); return L && L.mode !== 'group' && L.level !== 'no' ? ` · ${esc(layoutText(L))}` : ''; })()}${b.people ? ` · ${b.people} Spieler` : ''}${b.note ? ` · ${esc(b.note)}` : ''}</small></button>
          <span class="row" style="flex-wrap:nowrap;gap:2px"><span class="min">${b.minutes}′</span><button class="icon-btn" type="button" data-swap="${b.id}" aria-label="${esc(e.name)} tauschen">${icon('swap')}</button></span>
        </div>${pause ? `<div class="tl-item pause-item" style="cursor:default"><span class="tl-time">${pause.label || ''}</span><span><strong title="${esc(pause.why)}">${icon('pause')} Trinkpause</strong></span><span class="min">${pause.minutes}′</span></div>` : ''}`; }).join('')}</div>` : `<div class="empty"><h3>Noch keine Übungen</h3><p>Erstelle oben eine Einheit oder füge Übungen hinzu.</p><button class="btn primary" type="button" id="t-add0">${icon('plus')} Übung hinzufügen</button></div>`}

      <div class="section"><h2>Termine</h2><button class="btn ghost sm" type="button" id="t-cal">${icon('calendar')} Kalender</button></div>
      ${events.length ? `<details class="disclosure" id="t-events-box"><summary><span class="grow">${events.length === 1 ? 'Nächster Termin' : `Nächste ${events.length} Termine`}</span></summary><div class="body"><div class="stack" id="t-events">${events.map(ev => eventCard(s, ev, { showDate: true })).join('')}</div></div></details>`
        : `<div class="notice">${icon('calendar')}<span class="grow">Noch keine Termine. Trage deine Trainingstage als Serie ein – mit Erinnerung.</span><button class="btn sm" type="button" id="t-series">Serie anlegen</button></div>`}

      ${recent.trained.total ? `<details class="disclosure focus-recap" id="t-recap" style="margin-top:16px"><summary><span class="grow">Zuletzt trainiert <span class="tiny">· ${recent.held} ${recent.held === 1 ? 'Training' : 'Trainings'} · ${recent.trained.total} Min</span></span></summary>
      <div class="body"><p class="tiny" style="margin:0 0 6px">Letzte 14 Tage</p>${areaBar(recent.trained)}
        <div style="margin-top:8px">${focusChips(recent.trained.list.map(o => ({ key: o.key, minutes: o.minutes })), { max: 6, link: true })}</div>
        ${gaps.length ? `<p class="small muted" style="margin:8px 0 0">Seit 4 Wochen nicht dabei: ${focusChips(gaps, { max: 4, link: true, label: 'Lange nicht trainiert' })}</p>` : ''}
        <button class="btn ghost sm" type="button" id="t-rueck" style="margin-top:8px">${icon('chart')} Rückblick</button></div></details>` : ''}

      <nav class="quick-row" aria-label="Schnellzugriff">
        <button class="quick" type="button" id="q-add">${icon('plus')}<span>Übung</span></button>
        <button class="quick" type="button" id="q-lib">${icon('grid')}<span>Bibliothek</span></button>
        <button class="quick" type="button" id="q-pack">${icon('cone')}<span>Packliste</span></button>
        <button class="quick" type="button" id="q-board">${icon('board')}<span>Taktik</span></button>
      </nav>
      ${hasData && !review.length && !(nextPlan && nextPlan.id !== p.id) && (backupAge === null || backupAge > 14) ? `<div class="notice" style="margin-top:16px">${icon('data')}<span class="grow">${backupAge === null ? 'Noch kein Backup erstellt.' : `Letztes Backup vor ${plural(backupAge, 'Tag', 'Tagen')}.`} Deine Daten liegen nur in diesem Browser.</span><button class="btn sm" type="button" id="t-backup">Sichern</button></div>` : ''}`;
    this.bind();
  },
  bind() {
    const r = this.root;
    $('#t-start', r)?.addEventListener('click', () => go('training', 'start'));
    $('#t-edit', r).onclick = () => go('planen');
    $('#t-squad', r).onclick = () => openSquadSheet();
    $('#t-add0', r)?.addEventListener('click', openAddSheet);
    $('#q-add', r).onclick = openAddSheet;
    $('#q-lib', r).onclick = () => go('uebungen');
    $('#q-pack', r).onclick = () => go('planen', 'packliste');
    $('#q-board', r).onclick = () => go('taktik');
    $('#t-cal', r).onclick = () => go('kalender');
    $('#t-series', r)?.addEventListener('click', seriesSheet);
    $('#t-review', r)?.addEventListener('click', ev => reviewEvent(ev.currentTarget.dataset.id));
    $('#t-useplan', r)?.addEventListener('click', ev => { const id = ev.currentTarget.dataset.id; store.update('Einheit gewechselt', d => { d.selectedPlanId = id; }, { undo: false }); toast('Einheit für den nächsten Termin geöffnet.'); });
    on(r, 'click', '[data-ev]', (_, b) => openEvent(b.dataset.ev));
    $('#t-backup', r)?.addEventListener('click', () => import('./more.js').then(m => m.downloadBackup()));
    $('#t-create', r).addEventListener('toggle', ev => { if (ev.isTrusted) { userToggled = true; formOpen = ev.target.open; } });
    on(r, 'click', '[data-gap]', (_, b) => openAssistant({ preset: { foci: [b.dataset.gap] } }));
    $('#t-week', r).onclick = openWeek;
    $('#t-week2', r)?.addEventListener('click', openWeek);
    $('#t-accept', r)?.addEventListener('click', ev => { acceptSuggestion(ev.currentTarget.dataset.id); });
    $('#t-prepare', r)?.addEventListener('click', ev => prepareEvent(ev.currentTarget.dataset.id));
    $('#c-go', r).onclick = () => openAssistant({ onApplied: () => { userToggled = false; } });
    on(r, 'click', '[data-edit]', (_, b) => openBlockEditor(b.dataset.edit));
    on(r, 'click', '[data-swap]', (_, b) => swapBlock(b.dataset.swap));
  },
};
