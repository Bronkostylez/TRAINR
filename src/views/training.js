// Trainingsmodus: großer Timer mit Ring, Blockwechsel, Vorschau, Animation und Coaching.
import * as store from '../core/store.js';
import * as timer from '../core/timer.js';
import { meta, currentPlan, exercise, effective, blockLayout, layoutText, layoutAdvice, blockPeople, planAge, totalMinutes, foci, planFocus, keyFirst, sessionSteps } from '../core/planning.js';
import { focusChips } from '../ui/focus.js';
import { esc, fmtClock, sum } from '../core/util.js';
import { icon, $, on } from '../ui/dom.js';
import { mountPlayer } from '../scene/player.js';
import { materialChips } from '../ui/material.js';
import { haptic, unlockAudio, toast } from '../ui/feedback.js';
import { go } from '../ui/router.js';
import { pulse } from '../ui/motion.js';
import { openDetail } from './detail.js';

const R = 47, C = 2 * Math.PI * R;
let player = null, playerKey = '', unsub = null, focus = false;

export const trainingView = {
  id: 'training', title: 'Training', tab: 'training',
  render(root, params) {
    this.root = root;
    timer.sync();
    if (params[0] === 'start') { history.replaceState(history.state, '', '#training'); unlockAudio(); if (!timer.running() && timer.snapshot().block) timer.start(); }
    this.paint();
    unsub?.(); unsub = timer.subscribe(snap => this.tick(snap));
  },
  refresh(reason) { timer.sync(); if (reason === 'meta' && this.syncRate?.()) return; this.paint(); },
  leave() { this.flushNote?.(); unsub?.(); unsub = null; player?.destroy(); player = null; playerKey = ''; setFocus(false); },

  paint() {
    const s = store.get(), p = currentPlan(s), snap = timer.snapshot(), r = this.root;
    if (!p || !p.blocks.length) {
      player?.destroy(); player = null; playerKey = '';
      r.innerHTML = `<div class="page-head"><div><p class="eyebrow">Trainingsmodus</p><h1 id="h-training">Bereit, wenn du es bist.</h1></div></div><div class="empty"><h3>Dein Plan ist noch leer</h3><p>Erstelle auf „Heute“ eine Einheit oder füge Übungen hinzu.</p><div class="row" style="justify-content:center"><button class="btn primary" type="button" data-go="heute">${icon('sparkles')} Einheit erstellen</button><button class="btn" type="button" data-go="uebungen">${icon('grid')} Übungen</button></div></div>`;
      on(r, 'click', '[data-go]', (_, b) => go(b.dataset.go));
      return;
    }
    this.flushNote?.(); this.syncRate = null;
    const steps = sessionSteps(s, p), b = snap.block;
    // Übungsnummer ohne Pausen: „Block 3 / 6“ zählt nur Übungen.
    const num = steps.slice(0, snap.index + 1).filter(x => !x.pause).length;
    const nextB = steps[snap.index + 1], nextEx = steps.slice(snap.index + 1).find(x => !x.pause), nextE = nextEx && exercise(s, nextEx.exerciseId);
    if (b.pause) { this.paintPause(s, p, snap, steps, num, nextB, nextE); return; }
    const e = exercise(s, b.exerciseId), n = blockPeople(p, b), L = blockLayout(s, p, b), g = L.level !== 'no', age = planAge(s, p);
    r.innerHTML = `
      <div class="live ${e.type === 'keeper' ? 'keeper' : ''}">
        <div>
          <div class="row between" style="margin-bottom:8px"><div><p class="eyebrow">${esc(p.name)}</p><h1 id="h-training" class="sr-only">Training: ${esc(e.name)}</h1></div>
            <button class="btn sm" type="button" id="lv-focus" aria-pressed="${focus}">${icon('expand')} ${focus ? 'Fokus beenden' : 'Fokus'}</button></div>
          <section class="clock-card" aria-label="Timer">
            <p class="eyebrow">Block ${num} / ${p.blocks.length}${e.type === 'keeper' ? ' · <span class="keeper-dot"></span> Torwart' : ''}</p>
            <h2 class="clock-title">${esc(e.name)}</h2>
            ${foci(e).length ? `<div class="clock-foci">${focusChips(foci(e), { max: 3 })}</div>` : ''}
            <div class="clock-ring" id="lv-ring">
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="prog" id="lv-prog" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
              <div class="clock-center"><div><div class="clock" id="lv-clock" role="timer" aria-live="off">${fmtClock(snap.remaining)}</div><div class="clock-sub" id="lv-sub"></div></div></div>
            </div>
            ${controlsHtml(s, snap, steps)}
            ${nextB?.pause ? `<div class="next-up pause-next">${icon('pause')}<span class="grow"><small>Danach · Trinkpause ${nextB.minutes} Min</small><strong>Dann: ${esc(nextE?.name || '')}</strong></span></div>` : nextE ? `<div class="next-up">${icon('chevron')}<span class="grow"><small>Als Nächstes · ${nextB.minutes} Min</small><strong>${esc(nextE.name)}</strong></span></div>` : `<div class="next-up"><span class="grow"><small>Letzter Block</small><strong>Danach: Auslaufen, kurz besprechen, Material einsammeln.</strong>${(() => { const l = keyFirst(planFocus(s, p).list, p.focus).slice(0, 4).map(o => o.key); return l.length ? `<small>Zum Abschluss ansprechen – heute trainiert: ${esc(l.join(', '))}</small>` : ''; })()}</span></div>`}
          </section>
          <section class="card live-rate" id="lv-rate" aria-label="Bewertung und Notiz zur Übung">
            <div class="row between"><h2 style="font-size:1.05rem">Wie läuft die Übung?</h2><span class="tiny live-saved" id="lv-saved" role="status" aria-live="polite"></span></div>
            <div class="stars" role="group" aria-label="Bewertung">${[1, 2, 3, 4, 5].map(k => `<button type="button" data-live-star="${k}" aria-pressed="false" aria-label="${k} von 5 Sternen">★</button>`).join('')}</div>
            <label class="field"><span>Notiz zur Übung (keine Spielernamen)</span><textarea class="input" id="lv-note" maxlength="1000" rows="2" placeholder="Was klappt? Was ändern?"></textarea></label>
            <p class="tiny">Wird bei der Übung gespeichert: in den Übungsdetails und in der Bibliothek.</p>
          </section>
          <p class="tiny" style="margin-top:8px">Bei gesperrtem Bildschirm kann der Ton ausbleiben. ${'wakeLock' in navigator ? 'Der Bildschirm bleibt während des Timers an, wenn möglich.' : ''}</p>
        </div>
        <div class="stack">
          <section class="card"><div class="row between"><h2 style="font-size:1.05rem">Übung im Blick</h2><span class="tiny" id="lv-anim-state"></span></div>
            <div id="lv-scene" style="margin-top:8px"></div>
            <p class="small" id="lv-caption" style="min-height:2.6em;margin-top:8px"></p>
            <div class="row"><button class="btn sm" type="button" id="lv-sprev" aria-label="Vorheriger Ablaufschritt">${icon('back')} Schritt</button><button class="btn sm" type="button" id="lv-spause"></button><button class="btn sm" type="button" id="lv-snext" aria-label="Nächster Ablaufschritt">Schritt ${icon('chevron')}</button></div>
            <p class="tiny">Schematischer Ablauf, kein Video. Keine maßstabsgetreuen Laufwege oder Technik-Demonstration.</p></section>
          <section class="card">
            ${e.goal ? `<h3>Ziel</h3><p>${esc(e.goal)}</p>` : ''}
            <h3>Darauf achten</h3>${Array.isArray(e.points) && e.points.length ? `<ul class="points">${e.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(e.coaching)}</p>`}
            <h3 style="margin-top:12px">Vorbereiten</h3><div>${materialChips(e.equipment)}</div><p class="small ${g ? 'muted' : 'block-warn'}">${g ? `${layoutText(L)}${L.level === 'tight' && layoutAdvice(L) ? ` · ${layoutAdvice(L)}` : ''}` : `⚠ ${L.why === 'nokeeper' ? layoutAdvice(L) : 'Besetzung im Plan anpassen'}`}${age && !e.ages.includes(age) ? ' · ⚠ Altersklasse prüfen' : ''}</p>
            ${b.note ? `<p class="notice">${esc(b.note)}</p>` : ''}
            ${p.goal ? `<p class="small muted">Ziel der Einheit: ${esc(p.goal)}</p>` : ''}
            <button class="btn sm" type="button" id="lv-detail">${icon('info')} Alles zur Übung</button>
          </section>
        </div>
      </div>`;
    this.bind(e);
    this.bindRate(e);
    this.mountScene(e, b);
    this.tick(snap);
  },

  /** Pause im Trainingsmodus: großer Countdown, was als Nächstes kommt, Material dafür. */
  paintPause(s, p, snap, steps, num, nextB, nextE) {
    player?.destroy(); player = null; playerKey = `${snap.block.id}|`; this.syncScene = null;
    this.root.innerHTML = `
      <div class="live pause-live">
        <div>
          <div class="row between" style="margin-bottom:8px"><div><p class="eyebrow">${esc(p.name)}</p><h1 id="h-training" class="sr-only">Training: Pause</h1></div>
            <button class="btn sm" type="button" id="lv-focus" aria-pressed="${focus}">${icon('expand')} ${focus ? 'Fokus beenden' : 'Fokus'}</button></div>
          <section class="clock-card is-pause" aria-label="Timer">
            <p class="eyebrow">Pause nach Block ${num} / ${p.blocks.length}</p>
            <h2 class="clock-title">Trinkpause</h2>
            <div class="clock-ring" id="lv-ring">
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="prog" id="lv-prog" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
              <div class="clock-center"><div><div class="clock" id="lv-clock" role="timer" aria-live="off">${fmtClock(snap.remaining)}</div><div class="clock-sub" id="lv-sub"></div></div></div>
            </div>
            ${controlsHtml(s, snap, steps)}
            ${nextE ? `<div class="next-up">${icon('chevron')}<span class="grow"><small>Danach · ${nextB.minutes} Min</small><strong>${esc(nextE.name)}</strong></span></div>` : ''}
          </section>
        </div>
        <div class="stack">
          <section class="card"><h2 style="font-size:1.05rem">In der Pause</h2>
            <ul class="points"><li>Trinken, durchatmen, kurz loben.</li><li>Nächste Übung aufbauen und kurz erklären.</li><li>Gruppen und Leibchen für die nächste Übung verteilen.</li></ul>
            ${nextE ? `<h3 style="margin-top:12px">Vorbereiten: ${esc(nextE.name)}</h3><div>${materialChips(nextE.equipment)}</div>` : ''}
            <p class="tiny">${esc(snap.block.why || '')}</p>
          </section>
        </div>
      </div>`;
    this.bind(nextE);
    this.tick(snap);
  },

  bind(e) {
    const r = this.root;
    $('#lv-toggle', r).onclick = ev => { unlockAudio(); timer.toggle(); haptic(timer.running() ? 'ok' : 'tap'); pulse(ev.currentTarget); toast(timer.running() ? 'Training läuft.' : 'Timer pausiert.', { ms: 1500 }); };
    $('#lv-next', r).onclick = () => { timer.next(); haptic('tap'); this.paint(); };
    $('#lv-prev', r).onclick = () => { timer.prev(); haptic('tap'); this.paint(); };
    $('#lv-reset', r).onclick = () => { timer.reset(); toast('Timer zurückgesetzt.', { ms: 1500 }); };
    $('#lv-plus', r).onclick = () => { timer.extend(60); toast('+1 Minute für diesen Block.', { ms: 1500 }); };
    $('#lv-focus', r).onclick = () => { setFocus(!focus); this.paint(); };
    const det = $('#lv-detail', r); if (det && e) det.onclick = () => openDetail(e.id);
    on(r, 'click', '[data-jump]', (_, b) => { timer.jump(Number(b.dataset.jump)); haptic('tap'); this.paint(); });
  },

  /** Bewertung + Notiz zur laufenden Übung: gleiche Daten wie in den Übungsdetails (exerciseMeta). */
  bindRate(e) {
    const r = this.root, box = $('#lv-rate', r), ta = $('#lv-note', r), saved = $('#lv-saved', r);
    if (!box) return;
    let timerId = 0, dirty = false;
    const sync = () => {
      const m = meta(store.get(), e.id);
      box.querySelectorAll('[data-live-star]').forEach(x => x.setAttribute('aria-pressed', String((m.rating || 0) >= Number(x.dataset.liveStar))));
      if (document.activeElement !== ta) ta.value = m.note || '';
      return true;
    };
    const flash = () => { saved.textContent = 'Gespeichert ✓'; saved.classList.remove('on'); void saved.offsetWidth; saved.classList.add('on'); };
    const save = () => {
      clearTimeout(timerId); if (!dirty) return; dirty = false;
      const v = ta.value.trim().slice(0, 1000);
      store.update('Notiz', d => { const mm = (d.exerciseMeta[e.id] ||= {}); if (v) mm.note = v; else delete mm.note; if (!Object.keys(mm).length) delete d.exerciseMeta[e.id]; }, { reason: 'meta', undo: false });
      flash();
    };
    this.flushNote = save; this.syncRate = sync;
    sync();
    on(box, 'click', '[data-live-star]', (_, btn) => {
      const k = Number(btn.dataset.liveStar), cur = meta(store.get(), e.id).rating;
      store.update('Bewertung', d => { const mm = (d.exerciseMeta[e.id] ||= {}); if (cur === k) delete mm.rating; else mm.rating = k; if (!Object.keys(mm).length) delete d.exerciseMeta[e.id]; }, { reason: 'meta', undo: false });
      haptic('ok'); pulse(btn); flash();
    });
    ta.addEventListener('input', () => { dirty = true; saved.textContent = ''; clearTimeout(timerId); timerId = setTimeout(save, 700); });
    ta.addEventListener('blur', save);
  },

  mountScene(e, b) {
    const key = `${b.id}|${e.id}|${JSON.stringify(e.animation || null)}`;
    const host = $('#lv-scene', this.root), cap = $('#lv-caption', this.root);
    player?.destroy();
    let manual = this.manual && playerKey === key;
    playerKey = key;
    const s0 = store.get(), p0 = currentPlan(s0);
    const coachOn = s0.settings.coachScene !== false && !!(p0 && blockLayout(s0, p0, b)?.coachFill);
    player = mountPlayer(host, e, { loop: true, coach: coachOn, onStep: i => { cap.textContent = `${i + 1}. ${player?.steps[i] || ''}`; } });
    cap.textContent = `1. ${player.steps[0]}`;
    const btn = $('#lv-spause', this.root);
    const sync = () => {
      const want = timer.running() && !manual && player.animated && !document.querySelector('dialog[open]');
      if (want && player.state !== 'run') player.play(); else if (!want && player.state === 'run') player.pause();
      btn.hidden = !player.animated;
      btn.textContent = manual ? 'Animation fortsetzen' : 'Animation pausieren';
      $('#lv-anim-state', this.root).textContent = !player.animated ? 'Schritte' : manual ? 'Animation pausiert' : timer.running() ? 'läuft mit dem Timer' : 'wartet auf den Timer';
    };
    this.syncScene = sync;
    btn.onclick = () => { manual = !manual; this.manual = manual; sync(); };
    $('#lv-sprev', this.root).onclick = () => { manual = true; this.manual = true; player.pause(); player.goStep(player.step - 1); sync(); };
    $('#lv-snext', this.root).onclick = () => { manual = true; this.manual = true; player.pause(); player.goStep(player.step + 1); sync(); };
    sync();
  },

  tick(snap) {
    const r = this.root; if (!r?.isConnected || !snap.block) return;
    const p = currentPlan(store.get());
    if (snap.block.id !== playerKey.split('|')[0]) { this.paint(); return; }
    const steps = sessionSteps(store.get(), p);
    const frac = snap.duration ? 1 - snap.remaining / snap.duration : 0;
    $('#lv-clock', r).textContent = fmtClock(snap.remaining);
    $('#lv-prog', r).setAttribute('stroke-dashoffset', String(C * frac));
    const ring = $('#lv-ring', r), warnAt = store.get().settings.warnSeconds;
    ring.classList.toggle('warn', snap.remaining > 0 && warnAt > 0 && snap.remaining <= warnAt);
    ring.classList.toggle('done', snap.ended);
    $('#lv-sub', r).textContent = snap.ended ? (snap.block.pause ? 'Pause vorbei' : 'Block fertig') : snap.running ? `von ${fmtClock(snap.duration)}` : snap.remaining === snap.duration ? 'Bereit' : 'Pausiert';
    const tg = $('#lv-toggle', r);
    tg.innerHTML = snap.running ? `${icon('pause')} Pause` : snap.ended ? `${icon('reset')} Nochmal` : `${icon('start')} ${snap.remaining === snap.duration ? 'Start' : 'Weiter'}`;
    tg.setAttribute('aria-pressed', String(snap.running));
    const before = sum(steps.slice(0, snap.index), b => b.minutes) * 60, elapsed = before + (snap.duration - snap.remaining);
    $('#lv-elapsed', r).textContent = `${fmtClock(elapsed)} vergangen`;
    $('#lv-left', r).textContent = `${fmtClock(Math.max(0, sum(steps, b => b.minutes) * 60 + snap.extra - elapsed))} übrig`;
    this.syncScene?.();
  },
};

/** Start/Pause, Vor/Zurück, Fortschritt über Blöcke und Pausen (Pausen schmal und gestreift). */
function controlsHtml(s, snap, steps) {
  const ghost = 'background:transparent;color:#d8d4c6;border-color:rgba(255,255,255,.18)';
  let n = 0;
  return `<div class="live-controls">
      <button class="btn" type="button" id="lv-prev" aria-label="Zurück" ${snap.index === 0 ? 'disabled' : ''}>${icon('prev')}</button>
      <button class="btn accent" type="button" id="lv-toggle" aria-pressed="${snap.running}"></button>
      <button class="btn" type="button" id="lv-next" aria-label="${steps[snap.index + 1]?.pause ? 'Zur Pause' : 'Nächster Block'}" ${snap.index >= snap.count - 1 ? 'disabled' : ''}>${icon('next')}</button>
    </div>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" type="button" id="lv-reset" style="${ghost}">${icon('reset')} Zurücksetzen</button><button class="btn sm" type="button" id="lv-plus" style="${ghost}">+1 Min</button></div>
    <div class="seg-progress" role="group" aria-label="Ablauf">${steps.map((x, i) => `<button type="button" data-jump="${i}" class="${x.pause ? 'pause ' : ''}${i < snap.index ? 'done' : i === snap.index ? 'current' : ''}" style="flex:${x.minutes}" aria-label="${x.pause ? `Zur Pause (${x.minutes} Min)` : `Zu Block ${++n}: ${esc(exercise(s, x.exerciseId).name)}`}" ${i === snap.index ? 'aria-current="step"' : ''}></button>`).join('')}</div>
    <div class="totals" style="margin-top:8px"><span id="lv-elapsed"></span><span id="lv-left"></span></div>`;
}

function setFocus(v) { focus = v; document.body.classList.toggle('live-focus', v); }
