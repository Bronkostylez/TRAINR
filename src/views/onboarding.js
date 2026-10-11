// Onboarding und Mannschafts-Assistent: Name & Trainerart → Altersklasse → Trainingstage → Zeiten.
import * as store from '../core/store.js';
import { AGES } from '../core/planning.js';
import { DAYS, DAYS_SHORT, LABELS, esc, time, uid, deepClone } from '../core/util.js';
import { validProfile } from '../core/schema.js';
import { icon, $, $$ } from '../ui/dom.js';
import { stagger } from '../ui/motion.js';
import { haptic } from '../ui/feedback.js';
import { autoFill } from '../core/calendar.js';

const TYPE_INFO = {
  field: ['⚽', 'Feldspieler', 'Technik, Spielformen, Torschuss'],
  keeper: ['🧤', 'Torwart', 'Torwarttraining, Fangen, Spieleröffnung'],
  both: ['⚽🧤', 'Gemischt', 'Feldspieler und Keeper gemeinsam'],
};
const AGE_INFO = {
  Bambini: 'U6/U7 · spielerisch, viele Ballkontakte, keine festen Positionen', 'F-Jugend': 'U8/U9 · kleine Spiele, Freude am Dribbeln', 'E-Jugend': 'U10/U11 · Technik im Spiel, 1 gegen 1',
  'D-Jugend': 'U12/U13 · Zusammenspiel, Torwartausbildung beginnt', 'C-Jugend': 'U14/U15', 'B-Jugend': 'U16/U17', 'A-Jugend': 'U18/U19', Männer: 'Erwachsene',
};
export const TEAM_COLORS = ['#133e33', '#1f5fa8', '#b3261e', '#e0a100', '#5a2d82', '#0f7b6c', '#222222', '#d0541f'];

/**
 * Rendert den Assistenten in `root`.
 * opts: { initial?: team, title, submitLabel, onDone(team), onCancel?, showRestore? }
 */
export function teamWizard(root, opts) {
  const draft = deepClone(opts.initial || { id: uid(), name: '', type: 'field', age: 'E-Jugend', slots: [{ day: 1, start: '17:00', end: '18:30' }], color: TEAM_COLORS[0] });
  let step = 0;
  const STEPS = ['Mannschaft', 'Altersklasse', 'Trainingstage', 'Trainingszeiten'];

  function paint() {
    root.innerHTML = `
      <div class="onboarding">
        <p class="eyebrow">${step + 1} / ${STEPS.length} · ${STEPS[step]}</p>
        <div class="ob-progress" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
        <form id="wiz" novalidate>
          ${body()}
          <p class="error" id="wiz-error" role="alert"></p>
          <div class="row" style="margin-top:16px">
            ${step > 0 ? `<button type="button" class="btn" id="wiz-back">${icon('back')} Zurück</button>` : opts.onCancel ? `<button type="button" class="btn" id="wiz-cancel">Abbrechen</button>` : ''}
            <button type="submit" class="btn primary grow lg" id="wiz-next">${step === STEPS.length - 1 ? esc(opts.submitLabel || 'Fertig') : 'Weiter'} ${icon('chevron')}</button>
          </div>
          ${step === 0 && opts.showRestore ? `<p class="small muted" style="margin-top:20px">Schon TRAINR genutzt? <button type="button" class="btn ghost sm" id="wiz-restore">${icon('upload')} Backup wiederherstellen</button></p>` : ''}
        </form>
      </div>`;
    stagger(root.querySelectorAll('.choice, .day-grid label, .slot-row'));
    const f = $('#wiz', root);
    f.onsubmit = ev => { ev.preventDefault(); next(); };
    $('#wiz-back', root)?.addEventListener('click', () => { read(); step--; paint(); });
    $('#wiz-cancel', root)?.addEventListener('click', () => opts.onCancel());
    $('#wiz-restore', root)?.addEventListener('click', () => opts.onRestore?.());
    $$('[name=day]', root).forEach(c => c.addEventListener('change', () => haptic('tap')));
    $('#copy-times', root)?.addEventListener('click', () => {
      const s = $('[data-start]', root).value, e = $('[data-end]', root).value;
      $$('[data-start]', root).forEach(x => { x.value = s; }); $$('[data-end]', root).forEach(x => { x.value = e; });
    });
    (root.querySelector('input:checked') || root.querySelector('input'))?.focus({ preventScroll: true });
  }

  function body() {
    if (step === 0) return `
      <h1 id="h-onboarding">${esc(opts.title || 'Willkommen bei TRAINR.')}</h1>
      <p class="muted">${opts.initial ? 'Passe deine Mannschaft an.' : 'In vier kurzen Schritten passen Vorschläge, Zeiten und Spielerzahlen zu deinem Training. Alles bleibt auf diesem Gerät.'}</p>
      <label class="field"><span>Name der Mannschaft (keine Spielernamen)</span><input class="input" name="name" maxlength="60" value="${esc(draft.name)}" placeholder="z. B. E2 oder Torwartgruppe"></label>
      <fieldset style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:8px">Du trainierst …</legend>
      <div class="choice-grid">${Object.entries(TYPE_INFO).map(([k, [ic, t, d]]) => `<label class="choice"><input type="radio" name="type" value="${k}" ${draft.type === k ? 'checked' : ''}><span class="choice-icon" aria-hidden="true">${ic}</span><strong>${t}</strong><small>${d}</small></label>`).join('')}</div></fieldset>
      <fieldset style="border:0;padding:0;margin:16px 0 0"><legend class="label" style="margin-bottom:4px">Farbe</legend><div class="color-row">${TEAM_COLORS.map(c => `<label><input type="radio" name="color" value="${c}" class="sr-only" ${draft.color === c ? 'checked' : ''}><span class="swatch" style="display:block;background:${c}" aria-label="Farbe ${c}" ${draft.color === c ? 'aria-pressed="true"' : ''}></span></label>`).join('')}</div></fieldset>`;
    if (step === 1) return `
      <h1 id="h-onboarding">Welche Altersklasse?</h1>
      <p class="muted">Übungen, Gruppengrößen und Warnungen richten sich danach. ${draft.type === 'keeper' ? 'Bambini und F-Jugend bekommen allgemeine Ballspiele statt fester Torwartrolle.' : ''}</p>
      <div class="choice-grid" role="radiogroup" aria-label="Altersklasse">${AGES.map(a => `<label class="choice"><input type="radio" name="age" value="${a}" ${draft.age === a ? 'checked' : ''}><strong>${a}</strong><small>${AGE_INFO[a]}</small></label>`).join('')}</div>`;
    if (step === 2) return `
      <h1 id="h-onboarding">Wann trainiert ihr?</h1>
      <p class="muted">Wähle alle Trainingstage. Zeiten folgen im nächsten Schritt.</p>
      <div class="day-grid" role="group" aria-label="Trainingstage">${DAYS.map((d, i) => `<label title="${d}"><input type="checkbox" name="day" value="${i}" ${draft.slots.some(s => s.day === i) ? 'checked' : ''} aria-label="${d}">${DAYS_SHORT[i]}</label>`).join('')}</div>`;
    return `
      <h1 id="h-onboarding">Von wann bis wann?</h1>
      <p class="muted">Beginn und Ende pro Tag. Die Endzeit muss nach dem Beginn liegen.</p>
      ${draft.slots.map(s => `<div class="slot-row"><strong>${DAYS[s.day]}</strong><label class="field"><span>Von</span><input class="input" type="time" data-start="${s.day}" value="${s.start}" required></label><label class="field"><span>Bis</span><input class="input" type="time" data-end="${s.day}" value="${s.end}" required></label></div>`).join('')}
      ${draft.slots.length > 1 ? `<button type="button" class="btn ghost sm" id="copy-times" style="margin-top:8px">${icon('copy')} Zeiten vom ersten Tag für alle übernehmen</button>` : ''}`;
  }

  function read() {
    const f = $('#wiz', root);
    if (step === 0) { draft.name = f.name.value.trim(); draft.type = f.type.value || draft.type; draft.color = f.color.value || draft.color; }
    if (step === 1) draft.age = f.age.value || draft.age;
    if (step === 2) {
      const days = $$('[name=day]:checked', root).map(x => Number(x.value));
      draft.slots = days.map(day => draft.slots.find(x => x.day === day) || { day, start: '17:00', end: '18:30' });
    }
    if (step === 3) for (const s of draft.slots) { s.start = $(`[data-start="${s.day}"]`, root).value; s.end = $(`[data-end="${s.day}"]`, root).value; }
  }

  function error(msg) { const e = $('#wiz-error', root); e.textContent = msg; haptic('warn'); }

  function next() {
    read();
    if (step === 0 && draft.name.length > 60) return error('Name höchstens 60 Zeichen.');
    if (step === 2 && !draft.slots.length) return error('Mindestens einen Trainingstag auswählen.');
    if (step === 3) {
      for (const s of draft.slots) if (time(s.start) < 0 || time(s.end) <= time(s.start)) {
        $(`[data-end="${s.day}"]`, root)?.setAttribute('aria-invalid', 'true');
        return error(`${DAYS[s.day]}: Die Endzeit muss nach dem Beginn liegen.`);
      }
      if (!draft.name) draft.name = `${draft.age} · ${LABELS[draft.type].replace('Nur ', '')}`.slice(0, 60);
      if (!validProfile(draft)) return error('Bitte Angaben prüfen.');
      haptic('ok');
      opts.onDone(draft);
      return;
    }
    step++;
    paint();
  }
  paint();
}

/** Ansicht für den allerersten Start. */
export const onboardingView = {
  id: 'onboarding', title: 'Willkommen', tab: null,
  render(root) {
    teamWizard(root, {
      showRestore: true, submitLabel: 'Los geht\'s',
      onRestore: () => import('./more.js').then(m => m.pickBackup()),
      onDone: team => {
        store.update('Mannschaft angelegt', d => {
          d.teams.push(team); d.activeTeamId = team.id;
          autoFill(d); // Trainingstage sofort als Serie im Kalender
          // Einheiten ohne Mannschaft gehören zur ersten Mannschaft.
          for (const p of d.plans) if (p.teamId === null) { p.teamId = team.id; if (!team.slots.some(s => s.day === p.slot)) p.slot = team.slots[0].day; }
          if (!d.plans.some(p => !p.template && p.teamId === team.id)) {
            const id = uid();
            d.plans.push({ id, teamId: team.id, name: 'Meine erste Einheit', people: 12, slot: team.slots[0].day, focus: 'Alle', notes: '', goal: '', blocks: [], date: null });
            d.selectedPlanId = id;
          }
          if (!d.selectedPlanId) d.selectedPlanId = d.plans.find(p => !p.template)?.id ?? null;
        }, { undo: false });
        location.hash = '#heute';
        if (!store.get().help.tour) import('../ui/help.js').then(m => m.tour());
      },
    });
  },
};
