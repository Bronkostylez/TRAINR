// Saison-Autopilot: einmalige Zielfrage (Chips) und Vorschlags-Bausteine. Kein eigener Bereich - sitzt im Wochenplaner und auf Heute.
import * as store from '../core/store.js';
import { esc } from '../core/util.js';
import { goalOptions, seasonGoals, hasSeason } from '../core/season.js';
import { haptic } from './feedback.js';
import { on } from './dom.js';
import { todayIso } from '../core/calendar.js';

let editing = false;
const MAX_GOALS = 3;

/** Karte: Frage beim ersten Mal, danach eine ruhige Zeile mit „ändern“. */
export function seasonCardHtml(team) {
  if (!team) return '';
  if (hasSeason(team) && !editing) {
    const g = seasonGoals(team);
    return `<p class="season-line small"><span>Saisonziel: <strong>${g.length ? g.map(esc).join(' · ') : 'offen'}</strong></span> <button class="btn ghost sm" type="button" data-season-edit>ändern</button></p>`;
  }
  const sel = new Set(seasonGoals(team));
  return `<article class="card season-card"><p class="eyebrow">Einmal pro Saison</p><h3>Was ist dein Saisonziel?</h3><p class="small muted">Bis zu ${MAX_GOALS} antippen. Danach schlägt die App jede Woche den Fokus vor.</p>
    <div class="chips" role="group" aria-label="Saisonziel">${goalOptions(team).map(k => `<button type="button" class="chip fchip-pick" data-season-goal="${esc(k)}" aria-pressed="${sel.has(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary grow" type="button" data-season-save>Fertig</button><button class="btn ghost" type="button" data-season-skip>Ohne Ziel starten</button></div></article>`;
}

function save(goals) {
  const id = store.get().activeTeamId;
  store.update('Saisonziel gespeichert', d => { const t = d.teams.find(x => x.id === id); if (t) t.season = { goals, start: todayIso() }; }, { undo: false });
  editing = false;
}

/** Bindet die Karte; `repaint` zeichnet die umgebende Ansicht neu. */
export function bindSeason(root, repaint) {
  on(root, 'click', '[data-season-edit]', () => { editing = true; haptic('tap'); repaint(); });
  on(root, 'click', '[data-season-goal]', (_, b) => {
    const on_ = b.getAttribute('aria-pressed') === 'true';
    if (!on_ && root.querySelectorAll('[data-season-goal][aria-pressed="true"]').length >= MAX_GOALS) return;
    b.setAttribute('aria-pressed', String(!on_)); haptic('tap');
  });
  on(root, 'click', '[data-season-save]', () => { save([...root.querySelectorAll('[data-season-goal][aria-pressed="true"]')].map(b => b.dataset.seasonGoal)); repaint(); });
  on(root, 'click', '[data-season-skip]', () => { save([]); repaint(); });
}

/** Vorgeschlagene Fokus-Chips (gestrichelt) mit Begründung. */
export function suggestionHtml(sg) {
  return `<div class="season-suggest"><p class="tiny"><strong>Vorschlag aus deinem Saisonplan</strong> · ${esc(sg.why)}</p><div class="chips week-foci">${sg.foci.map(k => `<span class="chip chip-suggest">${esc(k)}</span>`).join('')}</div></div>`;
}
