// Wochenfokus lebt am Kalendertermin. Übungen und Besetzung bleiben bis zur Vorbereitung offen.
import * as store from '../core/store.js';
import { activeTeam, MAX_FOCI } from '../core/planning.js';
import { mondayOf, addDays, todayIso, eventsOfTeam, fmtDate, duration, title } from '../core/calendar.js';
import { esc } from '../core/util.js';
import { icon, on, $ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { toast, haptic } from '../ui/feedback.js';
import { undoToast } from '../ui/actions.js';
import { stagger } from '../ui/motion.js';
import { go } from '../ui/router.js';
import { pickerHtml, openAssistant } from './assistant.js';
import { openEvent, editEvent } from './calendar.js';
import { suggest, suggestWeek } from '../core/season.js';
import { seasonCardHtml, bindSeason, suggestionHtml } from '../ui/season.js';

let week = mondayOf(todayIso());
export const openWeek = () => go('kalender', 'woche');

export function prepareEvent(id) {
  const s = store.get(), ev = s.events.find(x => x.id === id);
  if (!ev || ev.teamId !== s.activeTeamId || ev.kind !== 'training' || ev.status !== 'geplant') return;
  const p = s.plans.find(x => x.id === ev.planId && x.teamId === ev.teamId && !x.template);
  if (p) { store.update('Einheit gewechselt', d => { d.selectedPlanId = p.id; }, { undo: false }); go('planen'); return; }
  openAssistant({ eventId: id, preset: { foci: ev.foci?.length ? ev.foci : (suggest(s, activeTeam(s))?.foci || []), minutes: duration(ev) } });
}

export function editWeekFocus(id) {
  const s = store.get(), ev = s.events.find(x => x.id === id), team = activeTeam(s);
  if (!ev || ev.teamId !== team?.id || ev.kind !== 'training' || ev.status !== 'geplant') return;
  const sg = !ev.foci?.length ? suggest(s, team) : null, f = { foci: [...(ev.foci || sg?.foci || [])] };
  openSheet({
    title: 'Fokus für diesen Tag', className: 'week-focus-sheet', wide: true,
    body: `<div class="week-intro"><p class="eyebrow">${esc(fmtDate(ev.date))} · ${esc(ev.start)}</p><h3>Was soll hängen bleiben?</h3>${sg ? `<p class="small"><strong>Vorschlag aus deinem Saisonplan</strong> · ${esc(sg.why)}. Schon vorausgewählt - ändern oder speichern.</p>` : ''}<p class="small muted">Bis zu 4 Bereiche wählen. Spielerzahl und Übungen kommen erst am Trainingstag.</p></div><p class="week-count" id="wf-count" aria-live="polite"></p>${pickerHtml(f, [], team.type)}${ev.planId ? '<p class="notice">Der Fokus ändert keine bereits verknüpfte Einheit.</p>' : ''}`,
    foot: '<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="button" id="wf-save">Fokus speichern</button>',
    onMount: sh => {
      const count = () => { $('#wf-count', sh.body).textContent = `${f.foci.length} von ${MAX_FOCI} gewählt`; };
      count();
      on(sh.body, 'click', '[data-af]', (_, b) => {
        const k = b.dataset.af;
        if (f.foci.includes(k)) f.foci = f.foci.filter(x => x !== k);
        else if (f.foci.length < MAX_FOCI) f.foci.push(k);
        else return toast('Bis zu 4 Bereiche wählen.');
        b.setAttribute('aria-pressed', String(f.foci.includes(k))); count(); haptic('tap');
      });
      $('#wf-save', sh.foot).onclick = () => {
        const current = store.get().events.find(x => x.id === id);
        if (!current || current.status !== 'geplant' || current.teamId !== store.get().activeTeamId) { sh.close(); return toast('Termin nicht mehr verfügbar.'); }
        store.update('Wochenfokus gespeichert', d => { const e = d.events.find(x => x.id === id); if (f.foci.length) e.foci = [...f.foci]; else delete e.foci; });
        sh.close(); undoToast('Wochenfokus gespeichert.');
      };
    },
  });
}

/** Ein Tipp: den Vorschlag aus dem Saisonplan als Wochenfokus übernehmen. */
export function acceptSuggestion(id) {
  const s = store.get(), ev = s.events.find(x => x.id === id), team = activeTeam(s);
  if (!ev || ev.teamId !== team?.id || ev.kind !== 'training' || ev.status !== 'geplant' || ev.foci?.length) return;
  const sg = suggestWeek(s, team, mondayOf(ev.date))[id]; if (!sg) return;
  store.update('Wochenfokus übernommen', d => { d.events.find(x => x.id === id).foci = [...sg.foci]; });
  haptic('tap'); undoToast('Fokus übernommen.');
}

export function paintWeek(s, root) {
  const team = activeTeam(s), end = addDays(week, 6), today = todayIso();
  const events = eventsOfTeam(s).filter(e => e.date >= week && e.date <= end);
  const training = events.filter(e => e.kind === 'training' && e.status === 'geplant');
  const sugg = suggestWeek(s, team, week), ready = training.filter(e => e.foci?.length).length;
  root.innerHTML = `<div class="week-hero"><p class="eyebrow">Wochenplaner</p><h2>Erst der Fokus.<br>Dann das Training.</h2><p>Du setzt den roten Faden. Am Trainingstag macht der Assistent daraus eine Einheit für die Gruppe vor Ort.</p><div class="week-progress"><strong>${ready} / ${training.length}</strong><span>Trainingstage mit Fokus</span></div></div>
    <div class="week-nav"><button class="icon-btn" type="button" data-week-shift="-1" aria-label="Vorherige Woche">${icon('back')}</button><div><strong>${esc(fmtDate(week))} - ${esc(fmtDate(end))}</strong><button class="btn sm ghost" type="button" id="w-current">Aktuelle Woche</button></div><button class="icon-btn" type="button" data-week-shift="1" aria-label="Nächste Woche">${icon('chevron')}</button></div>
    ${seasonCardHtml(team)}<label class="week-date field"><span>Woche wählen</span><input class="input" type="date" id="w-date" value="${week}"></label>
    <div class="week-days">${Array.from({ length: 7 }, (_, i) => {
      const date = addDays(week, i), dayEvents = events.filter(e => e.date === date);
      return `<article class="week-day ${date === today ? 'is-today' : ''}"><div class="week-day-head"><h3>${esc(fmtDate(date))}</h3>${date === today ? '<span class="tag">Heute</span>' : ''}<button class="icon-btn" type="button" data-week-add="${date}" aria-label="Training hinzufügen: ${esc(fmtDate(date))}">${icon('plus')}</button></div>${dayEvents.length ? dayEvents.map(ev => {
        const p = s.plans.find(p => p.id === ev.planId && p.teamId === ev.teamId && !p.template), editable = ev.kind === 'training' && ev.status === 'geplant';
        return `<div class="week-event ${ev.status === 'ausgefallen' ? 'is-cancelled' : ''}"><button class="week-event-title" type="button" data-week-event="${esc(ev.id)}"><strong>${esc(title(ev))}</strong><span>${esc(ev.start)} - ${esc(ev.end)} · ${duration(ev)} Min</span></button>${ev.status !== 'geplant' ? `<span class="tag">${ev.status === 'erledigt' ? 'Gehalten' : 'Ausgefallen'}</span>` : ''}${ev.foci?.length ? `<div class="chips week-foci">${ev.foci.map(k => `<span class="chip">${esc(k)}</span>`).join('')}</div>` : editable ? (sugg[ev.id] ? suggestionHtml(sugg[ev.id]) : '<p class="small muted">Noch kein Fokus gesetzt</p>') : ''}${editable ? `<div class="week-actions">${sugg[ev.id] ? `<button class="btn primary" type="button" data-week-accept="${esc(ev.id)}">${icon('check')} Übernehmen</button>` : ''}<button class="btn" type="button" data-week-focus="${esc(ev.id)}">${icon('target')} ${ev.foci?.length ? 'Fokus ändern' : sugg[ev.id] ? 'Ändern' : 'Fokus wählen'}</button><button class="btn ${p || sugg[ev.id] ? '' : 'primary'}" type="button" data-week-prepare="${esc(ev.id)}">${icon(p ? 'edit' : 'sparkles')} ${p ? 'Einheit öffnen' : 'Einheit vorbereiten'}</button></div><p class="tiny muted">${p ? 'Einheit verknüpft' : 'Besetzung am Trainingstag prüfen'}</p>` : ''}</div>`;
      }).join('') : '<p class="week-rest small muted">Kein Termin. Platz zum Durchatmen.</p>'}</article>`;
    }).join('')}</div>`;
  on(root, 'click', '[data-week-shift]', (_, b) => { week = addDays(week, Number(b.dataset.weekShift) * 7); paintWeek(store.get(), root); haptic('tap'); });
  $('#w-current', root).onclick = () => { week = mondayOf(todayIso()); paintWeek(store.get(), root); };
  $('#w-date', root).onchange = ev => { if (/^\d{4}-\d\d-\d\d$/.test(ev.target.value)) { week = mondayOf(ev.target.value); paintWeek(store.get(), root); } };
  bindSeason(root, () => paintWeek(store.get(), root));
  on(root, 'click', '[data-week-accept]', (_, b) => acceptSuggestion(b.dataset.weekAccept));
  on(root, 'click', '[data-week-focus]', (_, b) => editWeekFocus(b.dataset.weekFocus));
  on(root, 'click', '[data-week-prepare]', (_, b) => prepareEvent(b.dataset.weekPrepare));
  on(root, 'click', '[data-week-event]', (_, b) => openEvent(b.dataset.weekEvent));
  on(root, 'click', '[data-week-add]', (_, b) => editEvent(null, b.dataset.weekAdd));
  stagger(root.querySelectorAll('.week-day'), { max: 7 });
}
