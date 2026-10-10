// Spieltag: alles, was zu einem Spiel oder Turnier gehört – Anpfiff/Treffpunkt, Aufwärmen, Formation, Taktik, Spielplan, Ergebnis.
// Kein Training: keine Übungsblöcke, keine Nachbereitung mit Schwerpunkten. Das Aufwärmen ist eine normale Einheit (`ev.planId`).
import * as store from '../core/store.js';
import { activeTeam, plansOfTeam, totalMinutes, SEED } from '../core/planning.js';
import { esc, uid, time } from '../core/util.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { undoToast } from '../ui/actions.js';
import { toast } from '../ui/feedback.js';
import { go } from '../ui/router.js';

export const isGame = ev => ev?.kind === 'spiel' || ev?.kind === 'turnier';
export const FORMATION_NAMES = ['1-2-2', '2-3-1', '3-2-1', '3-3-2', '3-2-3', '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'];
const TACTICS = [['attack', 'Angriff', 'z. B. Über außen spielen, früh flanken'], ['defence', 'Verteidigung', 'z. B. Früh anlaufen, Mitte zumachen'], ['standards', 'Standards', 'z. B. Ecken kurz, Einwurf zum Mitspieler']];

/** Ergebnis als Text („3 : 1“) oder ''. */
export const scoreText = r => (r ? `${r.own} : ${r.opp}` : '');
/** Sieg / Unentschieden / Niederlage aus Sicht der eigenen Mannschaft; null ohne Ergebnis. */
export const outcome = r => (r ? (r.own > r.opp ? 'S' : r.own < r.opp ? 'N' : 'U') : null);
const OUT_LABEL = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

/** Alle gespielten Ergebnisse eines Termins (Einzelspiel oder Turnierspiele). */
export function results(ev) {
  const g = ev.game; if (!g) return [];
  return [g.result, ...(g.matches || []).map(m => m.result)].filter(Boolean);
}
/** Bilanz über mehrere Termine: { s, u, n, goals, against }. */
export function record(events) {
  const r = { s: 0, u: 0, n: 0, goals: 0, against: 0 };
  for (const ev of events) for (const x of results(ev)) { r[outcome(x).toLowerCase()]++; r.goals += x.own; r.against += x.opp; }
  return r;
}

/** Titelzeile eines Spiels: „vs. FC Beispiel“ / „bei FC Beispiel“. */
export function opponentLine(ev) {
  const g = ev.game; if (!g?.opponent) return '';
  return `${g.home === false ? 'Auswärts bei' : 'Heim gegen'} ${g.opponent}`;
}

/** Kurzhinweis für Terminkarten: Gegner · Ergebnis. */
export function gameSub(ev) {
  const g = ev.game;
  return [opponentLine(ev), scoreText(g?.result), ev.kind === 'turnier' && g?.matches?.length ? `${g.matches.length} Spiele` : ''].filter(Boolean).join(' · ');
}

// ---------- Ansicht im Termin-Sheet ----------

const section = (ic, head, inner) => `<div class="plan-card" style="cursor:default"><span class="row between"><strong>${icon(ic)} ${head}</strong></span>${inner}</div>`;

export function gameBody(s, ev) {
  const g = ev.game || {}, plan = s.plans.find(p => p.id === ev.planId), board = s.boards.find(b => b.id === g.boardId);
  const out = [];
  const meta = [g.meet ? `Treffpunkt ${g.meet} Uhr` : '', `Anpfiff ${ev.start} Uhr`, opponentLine(ev)].filter(Boolean);
  out.push(`<p class="small muted">${meta.map(esc).join(' · ')}</p>`);
  if (g.result) out.push(`<div class="notice ${outcome(g.result) === 'N' ? 'warn' : 'ok'}">${icon('check')}<span class="grow"><strong>${esc(scoreText(g.result))}</strong> · ${OUT_LABEL[outcome(g.result)]}</span></div>`);

  out.push(section('start', 'Aufwärmen', plan
    ? `<span class="small">${esc(plan.name)} · ${totalMinutes(plan, s)} Min</span><span class="row"><button class="btn sm accent" type="button" data-a="train">${icon('start')} Aufwärmen starten</button><button class="btn sm" type="button" data-a="openplan">${icon('edit')} Bearbeiten</button><button class="btn sm ghost" type="button" data-a="assign">${icon('swap')} Andere</button></span>`
    : `<span class="small muted">Noch kein Aufwärmprogramm.</span><span class="row"><button class="btn sm primary" type="button" data-a="warmup">${icon('plus')} Vorschlag erstellen</button><button class="btn sm" type="button" data-a="assign">${icon('plan')} Einheit wählen</button></span>`));

  out.push(section('users', 'Aufstellung', g.formation || board
    ? `<span class="small">${g.formation ? `Formation ${esc(g.formation)}` : ''}${board ? `${g.formation ? ' · ' : ''}Board „${esc(board.name)}“` : ''}</span>${board ? `<span class="row"><button class="btn sm" type="button" data-a="board">${icon('layers')} Taktikboard öffnen</button></span>` : ''}`
    : '<span class="small muted">Noch keine Formation gewählt.</span>'));

  const tac = TACTICS.filter(([k]) => g.tactics?.[k]);
  out.push(section('target', 'Taktik', tac.length
    ? tac.map(([k, t]) => `<span class="small"><strong>${t}:</strong> ${esc(g.tactics[k])}</span>`).join('')
    : '<span class="small muted">Noch keine Hinweise.</span>'));

  if (ev.kind === 'turnier') {
    const m = g.matches || [];
    out.push(section('calendar', 'Spielplan', m.length
      ? `<div class="list">${m.map(x => `<div class="list-item" style="cursor:default"><span class="ev-time"><strong>${esc(x.time || '–')}</strong></span><span class="grow"><strong>${esc(x.opponent || 'Gegner offen')}</strong><small>${esc(x.pitch || '')}</small></span><span class="tag ${x.result ? (outcome(x.result) === 'N' ? 'warn' : 'ok') : ''}">${esc(scoreText(x.result) || '–')}</span></div>`).join('')}</div>`
      : '<span class="small muted">Noch keine Spiele eingetragen.</span>'));
  }
  return out.join('');
}

/** Aktionen, die nur der Spieltag kennt. Gibt true zurück, wenn behandelt. */
export function gameAction(a, ev, sh) {
  if (a === 'warmup') { createWarmup(ev.id); return true; }
  if (a === 'board') { sh.close(); go('taktik'); return true; }
  return false;
}

// ---------- Aufwärmen vorschlagen ----------

/** Legt eine kurze Einheit aus 2 passenden Aufwärmübungen an und verknüpft sie mit dem Spiel. */
function createWarmup(evId) {
  const s = store.get(), team = activeTeam(s), ev = s.events.find(x => x.id === evId);
  if (!ev || !team) return;
  const pick = SEED.filter(e => e.tag === 'Aufwärmen' && e.type !== (team.type === 'field' ? 'keeper' : 'field') && e.ages.includes(team.age) && e.min <= 12 && e.max >= 12 && !e.archived).slice(0, 2);
  if (!pick.length) { toast('Kein passendes Aufwärmen gefunden. Bitte eine Einheit wählen.'); return; }
  const plan = { id: uid(), teamId: team.id, name: `Aufwärmen ${ev.game?.opponent || 'Spiel'}`.slice(0, 80), people: 12, slot: team.slots[0]?.day ?? null, focus: 'Alle', notes: '', goal: '', blocks: pick.map(e => ({ id: uid(), exerciseId: e.id, minutes: e.minutes })), date: null };
  store.update('Aufwärmen für Spiel', d => { d.plans.push(plan); const x = d.events.find(y => y.id === evId); if (x) x.planId = plan.id; });
  undoToast('Aufwärmprogramm erstellt. Du kannst es in der Planung anpassen.');
}

// ---------- Bearbeiten ----------

const num = v => { const n = Number(v); return v !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null; };
const scoreInputs = (name, r) => `<span class="row" style="gap:6px;align-items:center"><input class="input" type="number" inputmode="numeric" min="0" max="99" name="${name}-own" value="${r?.own ?? ''}" aria-label="Eigene Tore" style="width:64px"><span>:</span><input class="input" type="number" inputmode="numeric" min="0" max="99" name="${name}-opp" value="${r?.opp ?? ''}" aria-label="Gegentore" style="width:64px"></span>`;
const readScore = (form, name) => {
  const own = num(form[`${name}-own`].value), opp = num(form[`${name}-opp`].value);
  return own !== null && opp !== null ? { own, opp } : null;
};
const matchRow = (m, i) => `<div class="match-row stack" data-m="${i}" style="gap:6px;padding:8px 0;border-top:1px solid var(--line, #8883)">
  <div class="grid-3"><label class="field"><span>Zeit</span><input class="input" type="time" name="m-time"  value="${esc(m.time || '')}"></label>
    <label class="field"><span>Gegner</span><input class="input" name="m-opp" maxlength="60" value="${esc(m.opponent || '')}" autocomplete="off"></label>
    <label class="field"><span>Platz</span><input class="input" name="m-pitch" maxlength="30" value="${esc(m.pitch || '')}" placeholder="z. B. Feld 2" autocomplete="off"></label></div>
  <div class="row between"><span class="row" style="align-items:center;gap:8px"><small>Ergebnis</small>${scoreInputs(`m${i}`, m.result)}</span><button class="icon-btn" type="button" data-rm="${i}" aria-label="Spiel entfernen">${icon('trash')}</button></div></div>`;

/** Spieltag bearbeiten: Gegner, Treffpunkt, Formation, Taktik, Spielplan, Ergebnis. */
export function editGame(id) {
  const s = store.get(), ev = s.events.find(x => x.id === id); if (!ev || !isGame(ev)) return;
  const g = structuredClone(ev.game || {}), plans = plansOfTeam(s), tournament = ev.kind === 'turnier';
  let matches = (g.matches || []).map(m => ({ ...m }));
  openSheet({
    title: tournament ? 'Turnier-Tag' : 'Spieltag',
    body: `<form id="gm-form" novalidate>
      ${tournament ? '' : `<label class="field"><span>Gegner</span><input class="input" name="opponent" maxlength="60" value="${esc(g.opponent || '')}" placeholder="z. B. SV Beispiel" autocomplete="off"></label>
      <div class="field"><span>Heim / Auswärts</span><div class="seg" role="radiogroup" aria-label="Heim oder Auswärts">${[[true, 'Heim'], [false, 'Auswärts']].map(([v, t]) => `<button type="button" role="radio" data-home="${v}" aria-checked="${(g.home !== false) === v}">${t}</button>`).join('')}</div></div>`}
      <div class="grid-3"><label class="field"><span>Treffpunkt</span><input class="input" type="time" name="meet" value="${esc(g.meet || '')}"></label>
        <label class="field"><span>${tournament ? 'Start' : 'Anpfiff'}</span><input class="input" type="time" name="start" value="${esc(ev.start)}" required></label>
        <label class="field"><span>Ende</span><input class="input" type="time" name="end" value="${esc(ev.end)}" required></label></div>
      <label class="field"><span>Aufwärmen</span><select class="input" name="plan"><option value="">— keins —</option>${plans.map(p => `<option value="${esc(p.id)}" ${p.id === ev.planId ? 'selected' : ''}>${esc(p.name)} · ${totalMinutes(p, s)} Min</option>`).join('')}</select></label>
      <div class="grid-3"><label class="field"><span>Formation</span><input class="input" name="formation" list="gm-forms" maxlength="40" value="${esc(g.formation || '')}" placeholder="z. B. 2-3-1" autocomplete="off"><datalist id="gm-forms">${FORMATION_NAMES.map(f => `<option value="${f}">`).join('')}</datalist></label>
        <label class="field" style="grid-column:span 2"><span>Taktikboard</span><select class="input" name="board"><option value="">— keins —</option>${s.boards.map(b => `<option value="${esc(b.id)}" ${b.id === g.boardId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label></div>
      ${TACTICS.map(([k, t, ph]) => `<label class="field"><span>${t}</span><textarea class="input" name="t-${k}" rows="2" maxlength="600" placeholder="${esc(ph)}">${esc(g.tactics?.[k] || '')}</textarea></label>`).join('')}
      ${tournament ? `<h3 style="margin-top:12px">Spielplan</h3><div id="gm-matches"></div><button class="btn sm" type="button" id="gm-add">${icon('plus')} Spiel hinzufügen</button>`
        : `<div class="field"><span>Ergebnis (optional, nach dem Spiel)</span>${scoreInputs('res', g.result)}</div>`}
      <p class="error" id="gm-err" role="alert"></p></form>`,
    foot: '<button class="btn" type="button" data-close>Abbrechen</button><button class="btn primary" type="submit" form="gm-form">Speichern</button>',
    onMount: sh => {
      const f = $('#gm-form', sh.body); let home = g.home !== false;
      const paintMatches = () => { const el = $('#gm-matches', sh.body); if (el) el.innerHTML = matches.map(matchRow).join(''); };
      const pullMatches = () => $$('.match-row', sh.body).forEach((row, i) => {
        const q = n => row.querySelector(`[name="${n}"]`).value.trim();
        matches[i] = { time: q('m-time'), opponent: q('m-opp').slice(0, 60), pitch: q('m-pitch').slice(0, 30), result: readScore(f, `m${i}`) || undefined };
      });
      paintMatches();
      on(sh.body, 'click', '[data-home]', (_, b) => { home = b.dataset.home === 'true'; $$('[data-home]', sh.body).forEach(x => x.setAttribute('aria-checked', String(x === b))); });
      $('#gm-add', sh.body)?.addEventListener('click', () => {
        pullMatches(); if (matches.length >= 20) return toast('Maximal 20 Spiele.');
        matches.push({ time: '', opponent: '', pitch: '' }); paintMatches();
      });
      on(sh.body, 'click', '[data-rm]', (_, b) => { pullMatches(); matches.splice(Number(b.dataset.rm), 1); paintMatches(); });
      f.onsubmit = e => {
        e.preventDefault();
        const err = $('#gm-err', sh.body), start = f.start.value, end = f.end.value;
        if (time(start) < 0 || time(end) < 0 || time(end) <= time(start)) { err.textContent = 'Das Ende muss nach dem Beginn liegen.'; return; }
        if (tournament) pullMatches();
        const game = {
          home, meet: f.meet.value || '', formation: f.formation.value.trim().slice(0, 40), boardId: f.board.value || null,
          tactics: Object.fromEntries(TACTICS.map(([k]) => [k, f[`t-${k}`].value.slice(0, 600)])),
        };
        if (!tournament) { game.opponent = f.opponent.value.trim().slice(0, 60); const r = readScore(f, 'res'); if (r) game.result = r; }
        else game.matches = matches.filter(m => m.time || m.opponent || m.pitch || m.result);
        const planId = f.plan.value || null;
        try {
          store.update('Spieltag gespeichert', d => { const x = d.events.find(y => y.id === id); if (x) { x.game = game; x.start = start; x.end = end; x.planId = planId; if (game.result || game.matches?.some(m => m.result)) x.status = x.status === 'ausgefallen' ? x.status : 'erledigt'; } });
        } catch (x) { err.textContent = `Nicht gespeichert: ${x.message}`; return; }
        sh.close(); undoToast('Spieltag gespeichert.');
      };
    },
  });
}
