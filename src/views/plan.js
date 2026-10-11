// Planen: Einheit bearbeiten (Ablauf, Check, Packliste, Notizen), Einheiten verwalten, Assistent, Vorlagen.
import { openWeek } from './week.js';
import * as store from '../core/store.js';
import {
  currentPlan, activeTeam, exercise, effective, blockLayout, layoutText, layoutAdvice, totalMinutes, timeline, slotOf, slotMinutes, slotLabel, planAge, planType,
  check, packList, plansOfTeam, templates, blockPeople, foci, planFocus, pauses, remapPauses, AGES,
} from '../core/planning.js';
import { focusSummary, focusBars, focusChips, openFocusPick, areaBar } from '../ui/focus.js';
import { openAssistant } from './assistant.js';
import { esc, uid, plural, clamp, integer, TYPE_SHORT } from '../core/util.js';
import { LIMITS } from '../core/schema.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { sortable } from '../ui/sortable.js';
import { go } from '../ui/router.js';
import { flip, stagger, pulse } from '../ui/motion.js';
import { toast, haptic } from '../ui/feedback.js';
import { undoToast, updatePlan, ensurePlan, duplicatePlan, blankPlan, addExercise, markUsed } from '../ui/actions.js';
import { openBlockEditor, swapBlock, openAddSheet, changeMinutes, moveBlock, removeBlock, openPauseSheet, pauseLabel, movePause, removePause } from './blocks.js';
import { materialType } from '../ui/material.js';
import { openDetail } from './detail.js';
import { card, filtered } from './library.js';
import { cardAnimator } from '../scene/player.js';
import { scheduleSheet, openEvent } from './calendar.js';
import { openSquadSheet } from './squad.js';
import { upcoming, fmtDate, neglected } from '../core/calendar.js';

const TABS = [['ablauf', 'Ablauf'], ['check', 'Check'], ['packliste', 'Packliste'], ['notizen', 'Notizen']];
const packed = new Map(); // Packliste: abgehakt je Einheit (nur für diese Sitzung)
try { for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem('trainr-pack') || '{}'))) packed.set(k, new Set(v)); } catch { /* egal */ }
const savePacked = () => { try { sessionStorage.setItem('trainr-pack', JSON.stringify(Object.fromEntries([...packed].map(([k, v]) => [k, [...v]])))); } catch { /* egal */ } };
let sideAnimator = null;

/** Nummern gleichmäßig und zufällig auf Gruppen verteilen (ohne Namen). */
export function balancedGroups(n, g, random = Math.random) {
  if (!integer(n, 1, 100) || !integer(g, 1, Math.min(n, 20))) throw new Error('Gruppenzahl: 1 bis Spielerzahl, höchstens 20.');
  const nums = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  const groups = Array.from({ length: g }, () => []);
  nums.forEach((v, i) => groups[i % g].push(v));
  return groups;
}

export const planView = {
  id: 'planen', title: 'Planen', tab: 'planen',
  render(root, params) {
    ensurePlan();
    this.root = root;
    this.sub = TABS.some(t => t[0] === params[0]) ? params[0] : 'ablauf';
    const wide = matchMedia('(min-width: 1100px)').matches;
    root.innerHTML = `<div class="plan-layout ${wide ? 'with-lib' : ''}"><div id="plan-main"></div>${wide ? '<aside class="plan-side" id="plan-side" aria-label="Bibliothek zum Hineinziehen"></aside>' : ''}</div>`;
    this.paint();
    if (wide) this.paintSide();
  },
  refresh(reason) {
    if (reason === 'meta') return;
    const a = document.activeElement, keep = a?.id && this.root.contains(a) ? a.id : null;
    this.paint(reason);
    if (keep) document.getElementById(keep)?.focus({ preventScroll: true });
    if (reason !== 'minutes' && reason !== 'order') this.paintSide();
  },
  leave() { sideAnimator?.destroy(); sideAnimator = null; },

  paint(reason) {
    const s = store.get(), p = currentPlan(s), team = activeTeam(s);
    if (!p || !team) return;
    const slot = slotOf(s, p), total = totalMinutes(p, s), avail = slotMinutes(slot), over = avail && total > avail, ps = new Map(pauses(s, p).map(x => [x.afterId, x]));
    const dates = upcoming(s).filter(ev => ev.planId === p.id), linked = dates[0], more = dates.length;
    const main = $('#plan-main', this.root);
    main.innerHTML = `
      <div class="plan-header">
        <div class="row between"><button class="btn sm" type="button" id="pl-switch" aria-haspopup="dialog">${icon('list')} ${plural(plansOfTeam(s).length, 'Einheit', 'Einheiten')}</button>
          <div class="row" style="gap:2px"><button class="icon-btn" type="button" id="pl-undo" aria-label="Rückgängig" ${store.canUndo() ? '' : 'disabled'} title="${esc(store.undoLabel())}">${icon('undo')}</button><button class="icon-btn" type="button" id="pl-redo" aria-label="Wiederholen" ${store.canRedo() ? '' : 'disabled'}>${icon('redo')}</button><button class="icon-btn" type="button" id="pl-cal" aria-label="Kalender öffnen" title="Kalender">${icon('calendar')}</button><button class="icon-btn" type="button" id="pl-share" aria-label="Exportieren und teilen">${icon('share')}</button><button class="icon-btn" type="button" id="pl-more" aria-label="Weitere Aktionen">${icon('more')}</button></div></div>
        <label class="sr-only" for="pl-name">Name der Einheit</label>
        <h1 id="h-planen" class="sr-only">Planen: ${esc(p.name)}</h1>
        <input class="plan-title" id="pl-name" maxlength="80" value="${esc(p.name)}" autocomplete="off">
        <div class="plan-facts">
          <button class="fact" type="button" id="pl-slot">${icon('clock')} ${slot ? esc(slotLabel(slot)) : 'Kein Termin'}</button>
          <span class="fact" style="padding:0 4px;cursor:default">${icon('users')}<span class="stepper" style="border:0"><button type="button" id="pl-pminus" aria-label="Ein Spieler weniger">−</button><input id="pl-people" type="number" min="1" max="100" value="${p.people}" aria-label="Spieler insgesamt ohne Trainer"><button type="button" id="pl-pplus" aria-label="Ein Spieler mehr">+</button></span></span>
          <button class="fact" type="button" id="pl-squad" aria-haspopup="dialog" title="Wer ist da: Spieler, Torwart, Trainer">${p.keepers ? `${p.keepers} Torwart · ` : ''}${(p.coaches ?? 1) === 1 ? '1 Trainer' : `${p.coaches} Trainer`}</button>
          <button class="fact" type="button" id="pl-focus">${icon('target')} ${esc(p.focus === 'Alle' ? 'Kein Schwerpunkt' : p.focus)}</button>
          <button class="fact" type="button" id="pl-date" data-ev="${esc(linked?.id || '')}">${icon('calendar')} ${linked ? esc(fmtDate(linked.date, { relative: true })) + (more > 1 ? ` +${more - 1}` : '') : 'Im Kalender eintragen'}</button>
          <button class="fact" type="button" id="pl-pause">${icon('pause')} ${esc(pauseLabel(s, p))}</button>
          <button class="fact" type="button" id="pl-age">${esc(planAge(s, p))}${p.age ? ' (nur diese Einheit)' : ''}</button>
        </div>
        <div class="budget" aria-label="Zeitbudget">
          <div class="budget-bar" aria-hidden="true">${p.blocks.map(b => `<i style="width:${(b.minutes / Math.max(total, avail || 1)) * 100}%" class="${over ? 'over' : ''}"></i>${ps.has(b.id) ? `<i class="pause" style="width:${(ps.get(b.id).minutes / Math.max(total, avail || 1)) * 100}%"></i>` : ''}`).join('')}</div>
          <div class="budget-label"><span>${total} Min geplant</span><span class="${over ? 'block-warn' : ''}">${avail ? (over ? `${total - avail} Min zu lang` : `${avail - total} Min frei von ${avail}`) : 'Kein Zeitrahmen'}</span></div>
        </div>
      </div>
      <button class="btn block week-entry" id="pl-week" type="button">${icon('calendar')} Wochenplaner <span class="grow"></span>${icon('chevron')}</button>
      <div class="plan-tabs"><div class="seg" role="tablist" aria-label="Bereiche der Einheit">${TABS.map(([k, t]) => `<button type="button" role="tab" data-ptab="${k}" aria-selected="${this.sub === k}" aria-pressed="${this.sub === k}">${t}${k === 'check' ? checkBadge(s, p) : ''}</button>`).join('')}</div></div>
      <div id="pl-body"></div>`;
    this.paintTab(reason);
    this.bindHeader();
  },

  paintTab(reason) {
    const s = store.get(), p = currentPlan(s), body = $('#pl-body', this.root);
    if (this.sub === 'ablauf') {
      const tl = timeline(s, p);
      const fm = planFocus(s, p);
      body.innerHTML = `
        ${p.blocks.length ? `<ol class="blocks" id="pl-blocks" aria-label="Ablauf der Einheit">${tl.map(({ block: b, label, pause }, i) => blockHtml(s, p, b, i, label) + (pause ? pauseHtml(p, pause) : '')).join('')}</ol>` : ''}
        ${fm.list.length ? `<div class="focus-strip" style="margin:10px 0 0" aria-label="Schwerpunkte dieser Einheit"><div class="row between"><strong class="small">Das trainiert ihr</strong><button class="btn ghost sm" type="button" data-ptab="check">Details</button></div>${focusSummary(fm, { mark: p.focus, max: 5 })}</div>` : ''}
        <div class="drop-zone" id="pl-drop" style="margin-top:10px">${p.blocks.length ? 'Übungen hierher ziehen' : '<strong>Noch leer.</strong> Übungen hinzufügen, hierher ziehen oder den Assistenten fragen.'}</div>
        <div class="grid-2" style="margin-top:12px">
          <button class="btn primary lg" type="button" id="pl-add">${icon('plus')} Übung hinzufügen</button>
          <button class="btn lg" type="button" id="pl-assist">${icon('sparkles')} Assistent</button>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn" type="button" id="pl-train" ${p.blocks.length ? '' : 'disabled'}>${icon('start')} Training starten</button><button class="btn" type="button" id="pl-templates">${icon('template')} Vorlagen</button><button class="btn" type="button" id="pl-board">${icon('board')} Taktikboard</button></div>`;
      const list = $('#pl-blocks', body);
      if (list) {
        sortable(list, { onMove: (from, to) => { flip(list, () => {}); updatePlan('Reihenfolge geändert', plan => { const [b] = plan.blocks.splice(from, 1); plan.blocks.splice(to, 0, b); }, { reason: 'order' }); toast('Reihenfolge aktualisiert.'); } });
        if (reason !== 'minutes' && reason !== 'order' && reason !== 'data') stagger(list.children, { max: 8 });
      }
      this.bindDrop(body);
      on(body, 'click', '[data-edit]', (_, b) => openBlockEditor(b.dataset.edit));
      on(body, 'click', '[data-swap]', (_, b) => swapBlock(b.dataset.swap));
      on(body, 'click', '[data-min]', (_, b) => { changeMinutes(b.dataset.min, Number(b.dataset.d)); haptic('tap'); });
      on(body, 'click', '[data-move]', (_, b) => { const l = $('#pl-blocks', body); flip(l, () => {}); moveBlock(b.dataset.move, Number(b.dataset.d)); });
      on(body, 'click', '[data-del]', (_, b) => removeBlock(b.dataset.del));
      on(body, 'click', '[data-show]', (_, b) => openDetail(b.dataset.show));
      on(body, 'click', '[data-pmove]', (_, b) => { movePause(b.dataset.pmove, Number(b.dataset.d)); haptic('tap'); });
      on(body, 'click', '[data-pdel]', (_, b) => removePause(b.dataset.pdel));
      on(body, 'click', '[data-pedit]', () => openPauseSheet());
      $('#pl-add', body).onclick = openAddSheet;
      $('#pl-assist', body).onclick = () => this.assistant();
      $('#pl-train', body).onclick = () => go('training', 'start');
      $('#pl-templates', body).onclick = () => this.templatesSheet();
      $('#pl-board', body).onclick = () => go('taktik');
    } else if (this.sub === 'check') {
      const items = check(s, p), tl = timeline(s, p);
      body.innerHTML = `
        <div class="card"><h2 style="font-size:1.1rem;margin-bottom:10px">Einheitencheck</h2><ul class="check-list">${items.map(c => `<li class="${c.level}">${esc(c.text)}</li>`).join('')}<li class="info">Tore sichern, Wege freihalten, Trinkpausen und Material prüfen.</li></ul></div>
        ${p.blocks.length ? (() => { const fm = planFocus(s, p); return fm.list.length ? `<div class="card" style="margin-top:12px"><h2 style="font-size:1.1rem;margin-bottom:4px">Schwerpunkte</h2><p class="tiny" style="margin-top:0">Minuten je Schwerpunkt – eine Übung zählt für alle ihre Schwerpunkte. Bereiche nach Hauptschwerpunkt.</p>${areaBar(fm)}<div style="margin-top:10px">${focusBars(fm, { limit: 10 })}</div></div>` : ''; })() : ''}
        ${p.blocks.length ? `<div class="card" style="margin-top:12px"><h2 style="font-size:1.1rem;margin-bottom:10px">Zeitplan</h2><div class="timeline">${tl.map(({ block: b, label, pause }) => { const e = exercise(s, b.exerciseId), L = blockLayout(s, p, b); return `<div class="tl-item" style="cursor:default"><span class="tl-time">${label || '–'}</span><span><strong>${esc(e.name)}</strong><small>${L.level !== 'no' ? esc(layoutText(L)) : `⚠ ${esc(layoutText(L))}`} · ${blockPeople(p, b)} Spieler</small></span><span class="min">${b.minutes}′</span></div>${pause ? `<div class="tl-item pause-item" style="cursor:default"><span class="tl-time">${pause.label || '–'}</span><span><strong>Pause</strong><small>${esc(pause.why)}</small></span><span class="min">${pause.minutes}′</span></div>` : ''}`; }).join('')}</div></div>` : ''}
        <div class="card" style="margin-top:12px"><h2 style="font-size:1.1rem">Gruppen ohne Namen</h2><p class="small muted">Vergib Nummern an die Spieler. Keeper und Können vor Ort fair verteilen. Keine Rangfolge.</p>
          <div class="row"><label class="field grow" style="margin:0"><span>Gruppen</span><input class="input" id="gr-n" type="number" min="1" max="20" value="${Math.min(3, p.people)}"></label><button class="btn" type="button" id="gr-go" style="align-self:end">${icon('dice')} Mischen</button></div>
          <div id="gr-out" aria-live="polite" class="stack" style="margin-top:10px"></div></div>`;
      $('#gr-go', body).onclick = () => { try { const g = balancedGroups(p.people, Number($('#gr-n', body).value)); $('#gr-out', body).innerHTML = g.map((x, i) => `<div class="notice"><strong>Gruppe ${i + 1}</strong><span>${x.join(', ')}</span></div>`).join(''); haptic('ok'); } catch (err) { toast(err.message); } };
    } else if (this.sub === 'packliste') {
      const list = packList(s, p), set = packed.get(p.id) || new Set(), groups = [...new Set(list.map(x => x.group))];
      body.innerHTML = `<div class="card"><div class="row between"><h2 style="font-size:1.1rem">Packliste</h2><span class="tiny">${set.size ? `${[...set].filter(id => list.some(x => x.id === id)).length} / ${list.length} gepackt` : `${list.length} Punkte`}</span></div>
        ${groups.map(g => `<h3 class="eyebrow" style="margin:14px 0 4px">${esc(g)}</h3><div class="pack">${list.filter(x => x.group === g).map(x => `<label><input type="checkbox" data-pack="${esc(x.id)}" ${set.has(x.id) ? 'checked' : ''}><span>${x.group === 'Material' ? `<span aria-hidden="true">${materialType(x.label.replace(/^\d+\s/, ''))[1]}</span> ` : ''}${esc(x.label)}</span></label>`).join('')}</div>`).join('')}
        ${!p.blocks.length ? '<p class="muted">Material erscheint, sobald Übungen im Plan sind.</p>' : ''}
        <p class="tiny" style="margin-top:12px">Höchstbedarf pro Block, nicht Summe aller Blöcke. Parallele Gruppen sind eingerechnet; bei ⚠ Gruppengröße sind Mengen vorläufig. Helfer und vorhandenes Material werden nicht geprüft. Abhaken gilt nur für diese Sitzung.</p>
        <div class="row"><button class="btn sm" type="button" id="pk-reset">Alle abwählen</button><button class="btn sm" type="button" id="pk-share">${icon('share')} Packliste teilen</button></div></div>`;
      on(body, 'change', '[data-pack]', (_, c) => { const st = packed.get(p.id) || new Set(); c.checked ? st.add(c.dataset.pack) : st.delete(c.dataset.pack); packed.set(p.id, st); savePacked(); haptic('tap'); this.paintTab('pack'); });
      $('#pk-reset', body).onclick = () => { packed.delete(p.id); savePacked(); this.paintTab(); };
      $('#pk-share', body).onclick = () => import('../exports/share.js').then(m => m.shareText(`Packliste · ${p.name}`, list.map(x => `☐ ${x.label}`).join('\n')));
    } else {
      body.innerHTML = `<div class="card">
        <label class="field"><span>Trainingsziel (ein Satz)</span><input class="input" id="pl-goal" maxlength="200" value="${esc(p.goal || '')}" placeholder="z. B. Mit Tempo ins 1 gegen 1 gehen"></label>
        <label class="field"><span>Coaching-Notizen (keine Kindernamen)</span><textarea class="input" id="pl-notes" maxlength="2000" rows="7" placeholder="Ein klarer Coaching-Punkt, was funktioniert hat, was nächstes Mal anders wird.">${esc(p.notes || '')}</textarea></label>
        <p class="tiny">Ziel und Notizen erscheinen in Exporten und im Trainingsmodus. Speichern beim Verlassen des Feldes.</p></div>`;
      $('#pl-goal', body).onchange = ev => { updatePlan('Ziel geändert', x => { x.goal = ev.target.value.trim().slice(0, 200); }); toast('Ziel gespeichert.'); };
      $('#pl-notes', body).onchange = ev => { updatePlan('Notizen geändert', x => { x.notes = ev.target.value.slice(0, 2000); }); toast('Notizen gespeichert.'); };
    }
  },

  bindHeader() {
    const r = this.root, s = store.get(), p = currentPlan(s);
    $('#pl-name', r).onchange = ev => { const v = ev.target.value.trim().slice(0, 80) || 'Meine Einheit'; updatePlan('Name geändert', x => { x.name = v; }); };
    $('#pl-name', r).onkeydown = ev => { if (ev.key === 'Enter') ev.target.blur(); };
    const setPeople = n => { if (!integer(n, 1, 100)) { toast('1–100 Spieler eintragen.'); this.paint(); return; } updatePlan('Spielerzahl geändert', x => { x.people = n; for (const b of x.blocks) if (b.people === n) delete b.people; }, { reason: 'minutes' }); };
    $('#pl-people', r).onchange = ev => setPeople(Number(ev.target.value));
    $('#pl-pminus', r).onclick = () => setPeople(p.people - 1);
    $('#pl-pplus', r).onclick = () => setPeople(p.people + 1);
    $('#pl-squad', r).onclick = () => openSquadSheet();
    $('#pl-undo', r).onclick = () => { const l = store.undo(); if (l) toast(`„${l}“ rückgängig.`); };
    $('#pl-redo', r).onclick = () => { const l = store.redo(); if (l) toast(`„${l}“ wiederhergestellt.`); };
    $('#pl-switch', r).onclick = () => this.plansSheet();
    $('#pl-week', r).onclick = openWeek;
    $('#pl-cal', r).onclick = () => go('kalender');
    $('#pl-share', r).onclick = () => import('../exports/sheet.js').then(m => m.openExport());
    $('#pl-more', r).onclick = () => this.moreSheet();
    $('#pl-date', r).onclick = ev => (ev.currentTarget.dataset.ev ? openEvent(ev.currentTarget.dataset.ev) : scheduleSheet(p.id));
    $('#pl-slot', r).onclick = () => pick('Trainingstag', activeTeam(s).slots.map(x => [String(x.day), slotLabel(x)]), String(p.slot), v => updatePlan('Termin geändert', x => { x.slot = Number(v); }));
    $('#pl-focus', r).onclick = () => openFocusPick({ current: p.focus, hint: neglected(s), onPick: v => updatePlan('Schwerpunkt geändert', x => { x.focus = v; }) });
    $('#pl-pause', r).onclick = () => openPauseSheet();
    $('#pl-age', r).onclick = () => pick('Altersklasse dieser Einheit', [['', `Wie Mannschaft (${activeTeam(s).age})`], ...AGES.map(a => [a, a])], p.age || '', v => updatePlan('Altersklasse geändert', x => { if (v) x.age = v; else delete x.age; }));
    on(r, 'click', '[data-ptab]', (_, b) => { this.sub = b.dataset.ptab; history.replaceState(history.state, '', `#planen/${this.sub}`); $$('[data-ptab]', r).forEach(x => { x.setAttribute('aria-selected', String(x === b)); x.setAttribute('aria-pressed', String(x === b)); }); this.paintTab(); });
  },

  bindDrop(body) {
    const targets = [$('#pl-drop', body), $('#pl-blocks', body)].filter(Boolean);
    for (const t of targets) {
      t.addEventListener('dragover', ev => { if (![...ev.dataTransfer.types].includes('text/x-trainr-exercise')) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; t.classList.add(t.id === 'pl-drop' ? 'active' : 'drop-active'); });
      t.addEventListener('dragleave', () => t.classList.remove('active', 'drop-active'));
      t.addEventListener('drop', ev => {
        ev.preventDefault(); t.classList.remove('active', 'drop-active');
        const id = ev.dataTransfer.getData('text/x-trainr-exercise'); if (!id) return;
        const li = ev.target.closest('[data-key]');
        let at = null;
        if (li) { const all = $$('#pl-blocks > [data-key]', body), i = all.indexOf(li), r = li.getBoundingClientRect(); at = ev.clientY > r.top + r.height / 2 ? i + 1 : i; }
        addExercise(id, { at });
      });
    }
  },

  paintSide() {
    const side = $('#plan-side', this.root); if (!side) return;
    const s = store.get(), p = currentPlan(s), list = filtered(s).slice(0, 40);
    side.innerHTML = `<div class="row between" style="margin-bottom:8px"><h2 style="font-size:1.05rem">Bibliothek</h2><button class="btn ghost sm" type="button" data-golib>Alle Filter ${icon('chevron')}</button></div><p class="tiny">Karten in den Ablauf ziehen oder „Plan“ tippen. Filter wie in „Übungen“.</p><div class="stack" id="side-list">${list.map(e => card(s, p, e)).join('')}</div>`;
    side.querySelector('[data-golib]').onclick = () => go('uebungen');
    on(side, 'click', '[data-add]', (ev, b) => { ev.stopPropagation(); addExercise(b.dataset.add); pulse(b); });
    on(side, 'click', '.drill', (ev, c) => { if (ev.target.closest('[data-add],[data-fav]')) return; openDetail(c.dataset.id, list.map(e => e.id)); });
    on(side, 'click', '[data-fav]', (ev, b) => { ev.stopPropagation(); const id = b.dataset.fav, v = !store.get().exerciseMeta[id]?.favorite; store.update('Merkliste', d => { const m = (d.exerciseMeta[id] ||= {}); if (v) m.favorite = true; else delete m.favorite; }, { reason: 'meta' }); b.setAttribute('aria-pressed', String(v)); });
    on(side, 'dragstart', '.drill', (ev, c) => { ev.dataTransfer.setData('text/x-trainr-exercise', c.dataset.id); ev.dataTransfer.setData('text/plain', c.dataset.id); ev.dataTransfer.effectAllowed = 'copy'; });
    sideAnimator?.destroy(); sideAnimator = cardAnimator(side, id => exercise(store.get(), id)); sideAnimator.observe();
  },

  plansSheet() {
    const paint = sh => {
      const s = store.get(), team = activeTeam(s), list = plansOfTeam(s);
      sh.setBody(`<p class="small muted"><span translate="no">${esc(team.name)}</span> · ${plural(list.length, 'Einheit', 'Einheiten')}</p><div class="stack">${list.map(p => { const t = totalMinutes(p, s); return `
        <button class="plan-card" type="button" data-pick="${p.id}" aria-current="${p.id === s.selectedPlanId}">
          <span class="row between"><strong>${esc(p.name)}</strong><span class="tiny">${t} Min · ${plural(p.blocks.length, 'Block', 'Blöcke')}</span></span>
          ${p.blocks.length ? `<span class="hero-bar" aria-hidden="true">${p.blocks.map(b => `<i style="width:${b.minutes / Math.max(1, t) * 100}%"></i>`).join('')}</span>` : '<span class="tiny">leer</span>'}
          <span class="tiny">${p.blocks.slice(0, 4).map(b => esc(exercise(s, b.exerciseId)?.name || '')).join(' · ')}${p.blocks.length > 4 ? ' …' : ''}</span>
        </button>`; }).join('')}</div>`);
    };
    const sheet = openSheet({
      title: 'Einheiten', onMount: sh => {
        paint(sh);
        on(sh.body, 'click', '[data-pick]', (_, b) => { store.update('Einheit gewechselt', d => { d.selectedPlanId = b.dataset.pick; }, { undo: false }); sh.close(); haptic('tap'); });
      },
      foot: `<button class="btn" type="button" id="ps-tpl">${icon('template')} Aus Vorlage</button><button class="btn primary" type="button" id="ps-new">${icon('plus')} Neue Einheit</button>`,
    });
    sheet.foot.querySelector('#ps-new').onclick = () => { const s = store.get(); if (s.plans.length >= LIMITS.plans) return toast(`Maximal ${LIMITS.plans} Einheiten.`); const n = blankPlan(s); store.update('Neue Einheit', d => { d.plans.push(n); d.selectedPlanId = n.id; }); sheet.close(); undoToast('Neue Einheit angelegt.'); };
    sheet.foot.querySelector('#ps-tpl').onclick = () => { sheet.close(); setTimeout(() => this.templatesSheet(), 220); };
  },

  templatesSheet() {
    const paint = sh => {
      const s = store.get(), list = templates(s), p = currentPlan(s);
      sh.setBody(`<p class="small muted">Vorlagen sind wiederverwendbare Einheiten – unabhängig von Mannschaft und Termin. Aus einer Vorlage entsteht immer eine neue Einheit.</p>
        ${list.length ? `<div class="stack">${list.map(t => `<div class="plan-card" style="cursor:default"><span class="row between"><strong>${esc(t.name)}</strong><span class="tiny">${totalMinutes(t, s)} Min · ${plural(t.blocks.length, 'Block', 'Blöcke')}</span></span><span class="row"><button class="btn sm primary" type="button" data-use="${t.id}">Verwenden</button><button class="btn sm danger" type="button" data-deltpl="${t.id}">${icon('trash')}<span class="sr-only">Vorlage löschen</span></button></span></div>`).join('')}</div>` : '<div class="empty"><h3>Noch keine Vorlage</h3><p>Speichere eine gelungene Einheit als Vorlage.</p></div>'}`);
      sh.setFoot(p.blocks.length ? `<button class="btn primary" type="button" id="tp-save">${icon('template')} „${esc(p.name.slice(0, 30))}“ als Vorlage speichern</button>` : '');
      sh.foot.querySelector('#tp-save')?.addEventListener('click', () => { duplicatePlan(p.id, { asTemplate: true }); undoToast('Als Vorlage gespeichert.'); paint(sh); });
    };
    openSheet({
      title: 'Vorlagen', onMount: sh => {
        paint(sh);
        on(sh.body, 'click', '[data-use]', (_, b) => { const c = duplicatePlan(b.dataset.use, { fromTemplate: true }); if (c) { sh.close(); undoToast(`„${c.name}“ aus Vorlage erstellt.`); } });
        on(sh.body, 'click', '[data-deltpl]', async (_, b) => { if (!(await confirmSheet({ title: 'Vorlage löschen?', text: 'Einheiten, die daraus entstanden sind, bleiben erhalten.', ok: 'Löschen', danger: true }))) return; store.update('Vorlage gelöscht', d => { d.plans = d.plans.filter(x => x.id !== b.dataset.deltpl); }); undoToast('Vorlage gelöscht.'); paint(sh); });
      },
    });
  },

  moreSheet() {
    const s = store.get(), p = currentPlan(s), others = s.teams.filter(t => t.id !== s.activeTeamId);
    openSheet({
      title: 'Einheit', body: `<div class="list">
        <button class="list-item" type="button" data-a="copy">${icon('copy')}<span class="grow"><strong>Duplizieren</strong><small>Kopie dieser Einheit</small></span></button>
        <button class="list-item" type="button" data-a="cal">${icon('calendar')}<span class="grow"><strong>Im Kalender eintragen</strong><small>Einem Trainingstermin zuordnen</small></span></button>
        <button class="list-item" type="button" data-a="tpl">${icon('template')}<span class="grow"><strong>Als Vorlage speichern</strong><small>Wiederverwenden für jede Mannschaft</small></span></button>
        ${others.map(t => `<button class="list-item" type="button" data-a="team" data-team="${t.id}">${icon('team')}<span class="grow"><strong>Kopie für „${esc(t.name)}“</strong><small>${esc(t.age)} · ${esc(TYPE_SHORT[t.type])}</small></span></button>`).join('')}
        <button class="list-item" type="button" data-a="sharefile">${icon('share')}<span class="grow"><strong>Als Datei teilen</strong><small>Andere TRAINR-Nutzer können sie importieren</small></span></button>
        <button class="list-item" type="button" data-a="clear" ${p.blocks.length ? '' : 'disabled'}>${icon('reset')}<span class="grow"><strong>Alle Blöcke entfernen</strong><small>Rückgängig möglich</small></span></button>
        <button class="list-item" type="button" data-a="del" style="color:var(--danger)">${icon('trash')}<span class="grow"><strong>Einheit löschen</strong></span></button></div>`,
      onMount: sh => on(sh.body, 'click', '[data-a]', async (_, b) => {
        const a = b.dataset.a; sh.close();
        if (a === 'copy') { if (duplicatePlan(p.id)) undoToast('Kopie erstellt. Original bleibt erhalten.'); }
        if (a === 'cal') setTimeout(() => scheduleSheet(p.id), 220);
        if (a === 'tpl') { if (duplicatePlan(p.id, { asTemplate: true })) undoToast('Als Vorlage gespeichert.'); }
        if (a === 'team') { const t = s.teams.find(x => x.id === b.dataset.team); const ids = new Map(p.blocks.map(x => [x.id, uid()])); const c = { ...structuredClone(p), id: uid(), teamId: t.id, slot: t.slots[0].day, name: p.name, blocks: p.blocks.map(x => ({ ...x, id: ids.get(x.id) })) }; delete c.age; if (c.pauses) c.pauses = remapPauses(c.pauses, ids); store.update('Kopie für andere Mannschaft', d => { d.plans.push(c); }); undoToast(`Kopie liegt bei „${t.name}“.`); }
        if (a === 'sharefile') import('../exports/share.js').then(m => m.sharePlanFile(p.id));
        if (a === 'clear') { updatePlan('Blöcke entfernt', x => { x.blocks = []; }); undoToast('Alle Blöcke entfernt.'); }
        if (a === 'del') {
          if (!(await confirmSheet({ title: 'Einheit löschen?', text: `„${p.name}“ wird gelöscht. Rückgängig ist direkt danach möglich.`, ok: 'Löschen', danger: true }))) return;
          store.update('Einheit gelöscht', d => {
            d.plans = d.plans.filter(x => x.id !== p.id);
            const next = d.plans.find(x => !x.template && x.teamId === d.activeTeamId);
            if (next) d.selectedPlanId = next.id; else { const n = blankPlan(d, 'Meine Einheit'); d.plans.push(n); d.selectedPlanId = n.id; }
          });
          undoToast(`„${p.name}“ gelöscht.`);
        }
      }),
    });
  },

  assistant() { openAssistant(); }
};

function checkBadge(s, p) { const w = check(s, p).filter(c => c.level === 'warn').length; return w ? ` <span class="badge" style="background:var(--warn-soft);color:var(--warn)" aria-label="${w} Hinweise">${w}</span>` : ''; }

function blockHtml(s, p, b, i, label) {
  const e = exercise(s, b.exerciseId), n = blockPeople(p, b), L = blockLayout(s, p, b), age = planAge(s, p);
  const warn = L.level === 'no' ? `⚠ ${layoutText(L)}` : L.why === 'longqueue' ? `⚠ ${layoutAdvice(L)}` : age && !e.ages.includes(age) ? '⚠ Altersklasse prüfen' : '';
  return `<li class="block ${e.type === 'keeper' ? 'keeper-block' : ''}" data-key="${b.id}">
    <button class="block-handle" type="button" data-handle aria-label="Block ${i + 1} verschieben (Pfeiltasten)"><span class="num">${i + 1}</span>${icon('drag')}</button>
    <div class="block-main">
      <button class="title" type="button" data-edit="${b.id}" aria-label="${esc(e.name)} bearbeiten">${esc(e.name)}</button>
      <div class="block-sub"><span>${label || ''}</span><span title="Kategorie: ${esc(e.tag)}">${esc(foci(e).slice(0, 2).join(' · ') || e.tag)}</span><span>${n} Spieler${b.people ? ' (nur hier)' : ''}</span>${L.level !== 'no' ? `<span class="flow flow-${L.mode}">${esc(layoutText(L))}</span>` : ''}${b.note ? `<span>${esc(b.note)}</span>` : ''}</div>
      ${warn ? `<div class="block-sub block-warn">${esc(warn)}</div>` : ''}
    </div>
    <div class="block-actions">
      <span class="stepper"><button type="button" data-min="${b.id}" data-d="-1" aria-label="${esc(e.name)} eine Minute kürzer" ${b.minutes <= 1 ? 'disabled' : ''}>−</button><output aria-live="polite">${b.minutes} Min</output><button type="button" data-min="${b.id}" data-d="1" aria-label="${esc(e.name)} eine Minute länger" ${b.minutes >= 120 ? 'disabled' : ''}>+</button></span>
      <button class="icon-btn" type="button" data-move="${b.id}" data-d="-1" aria-label="Block ${i + 1} nach oben" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
      <button class="icon-btn" type="button" data-move="${b.id}" data-d="1" aria-label="Block ${i + 1} nach unten" ${i === p.blocks.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      <button class="icon-btn" type="button" data-swap="${b.id}" aria-label="${esc(e.name)} tauschen">${icon('swap')}</button>
      <button class="icon-btn" type="button" data-show="${esc(e.id)}" aria-label="${esc(e.name)} ansehen">${icon('info')}</button>
      <button class="icon-btn" type="button" data-del="${b.id}" aria-label="${esc(e.name)} entfernen">${icon('trash')}</button>
    </div>
  </li>`;
}

function pauseHtml(p, x) {
  const last = x.index >= p.blocks.length - 2, mine = !!p.pauses?.after;
  return `<li class="pause-row" data-pause="${x.afterId}">
    <span class="pause-ico" aria-hidden="true">${icon('pause')}</span>
    <button class="pause-main" type="button" data-pedit title="Pausen einstellen"><strong>Trinkpause · ${x.minutes} Min</strong><small>${x.label ? `${x.label} · ` : ''}${esc(x.why)}${mine ? '' : ' · automatisch'}</small></button>
    <span class="pause-actions"><button class="icon-btn" type="button" data-pmove="${x.afterId}" data-d="-1" aria-label="Pause früher" ${x.index === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="icon-btn" type="button" data-pmove="${x.afterId}" data-d="1" aria-label="Pause später" ${last ? 'disabled' : ''}>${icon('down')}</button><button class="icon-btn" type="button" data-pdel="${x.afterId}" aria-label="Pause entfernen">${icon('close')}</button></span>
  </li>`;
}

/** Kleines Auswahl-Sheet. */
function pick(title, options, current, onPick) {
  openSheet({
    title, body: `<div class="list">${options.map(([v, t]) => `<button class="list-item" type="button" data-v="${esc(v)}" aria-current="${v === current}"><span class="grow"><strong>${esc(t)}</strong></span>${v === current ? icon('check') : ''}</button>`).join('')}</div>`,
    onMount: sh => on(sh.body, 'click', '[data-v]', (_, b) => { sh.close(); onPick(b.dataset.v); haptic('tap'); }),
  });
}
export { pick };
