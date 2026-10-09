// Trainingsmodus: großer Timer mit Ring, Blockwechsel, Vorschau, Animation und Coaching.
import * as store from '../core/store.js';
import * as timer from '../core/timer.js';
import { currentPlan, exercise, effective, fit, blockPeople, planAge, totalMinutes } from '../core/planning.js';
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
  refresh() { timer.sync(); this.paint(); },
  leave() { unsub?.(); unsub = null; player?.destroy(); player = null; playerKey = ''; setFocus(false); },

  paint() {
    const s = store.get(), p = currentPlan(s), snap = timer.snapshot(), r = this.root;
    if (!p || !p.blocks.length) {
      player?.destroy(); player = null; playerKey = '';
      r.innerHTML = `<div class="page-head"><div><p class="eyebrow">Trainingsmodus</p><h1 id="h-training">Bereit, wenn du es bist.</h1></div></div><div class="empty"><h3>Dein Plan ist noch leer</h3><p>Erstelle auf „Heute“ eine Einheit oder füge Übungen hinzu.</p><div class="row" style="justify-content:center"><button class="btn primary" type="button" data-go="heute">${icon('sparkles')} Einheit erstellen</button><button class="btn" type="button" data-go="uebungen">${icon('grid')} Übungen</button></div></div>`;
      on(r, 'click', '[data-go]', (_, b) => go(b.dataset.go));
      return;
    }
    const b = snap.block, e = exercise(s, b.exerciseId), n = blockPeople(p, b), g = fit(s, e, n), age = planAge(s, p);
    const nextB = p.blocks[snap.index + 1], nextE = nextB && exercise(s, nextB.exerciseId);
    r.innerHTML = `
      <div class="live ${e.type === 'keeper' ? 'keeper' : ''}">
        <div>
          <div class="row between" style="margin-bottom:8px"><div><p class="eyebrow">${esc(p.name)}</p><h1 id="h-training" class="sr-only">Training: ${esc(e.name)}</h1></div>
            <button class="btn sm" type="button" id="lv-focus" aria-pressed="${focus}">${icon('expand')} ${focus ? 'Fokus beenden' : 'Fokus'}</button></div>
          <section class="clock-card" aria-label="Timer">
            <p class="eyebrow">Block ${snap.index + 1} / ${snap.count}${e.type === 'keeper' ? ' · <span class="keeper-dot"></span> Torwart' : ''}</p>
            <h2 class="clock-title" style="color:#fff">${esc(e.name)}</h2>
            <div class="clock-ring" id="lv-ring">
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="prog" id="lv-prog" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
              <div class="clock-center"><div><div class="clock" id="lv-clock" role="timer" aria-live="off">${fmtClock(snap.remaining)}</div><div class="clock-sub" id="lv-sub"></div></div></div>
            </div>
            <div class="live-controls">
              <button class="btn" type="button" id="lv-prev" aria-label="Vorheriger Block" ${snap.index === 0 ? 'disabled' : ''}>${icon('prev')}</button>
              <button class="btn accent" type="button" id="lv-toggle" aria-pressed="${snap.running}"></button>
              <button class="btn" type="button" id="lv-next" aria-label="Nächster Block" ${snap.index >= snap.count - 1 ? 'disabled' : ''}>${icon('next')}</button>
            </div>
            <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" type="button" id="lv-reset" style="background:transparent;color:#cfe0d6;border-color:rgba(255,255,255,.18)">${icon('reset')} Zurücksetzen</button><button class="btn sm" type="button" id="lv-plus" style="background:transparent;color:#cfe0d6;border-color:rgba(255,255,255,.18)">+1 Min</button></div>
            <div class="seg-progress" role="group" aria-label="Blöcke">${p.blocks.map((x, i) => `<button type="button" data-jump="${i}" class="${i < snap.index ? 'done' : i === snap.index ? 'current' : ''}" style="flex:${x.minutes}" aria-label="Zu Block ${i + 1}: ${esc(exercise(s, x.exerciseId).name)}" ${i === snap.index ? 'aria-current="step"' : ''}></button>`).join('')}</div>
            <div class="totals" style="margin-top:8px"><span id="lv-elapsed"></span><span id="lv-left"></span></div>
            ${nextE ? `<div class="next-up">${icon('chevron')}<span class="grow"><small>Als Nächstes · ${nextB.minutes} Min</small><strong>${esc(nextE.name)}</strong></span></div>` : '<div class="next-up"><span class="grow"><small>Letzter Block</small><strong>Danach: Auslaufen, kurz besprechen, Material einsammeln.</strong></span></div>'}
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
            <h3 style="margin-top:12px">Vorbereiten</h3><div>${materialChips(e.equipment)}</div><p class="small ${g ? 'muted' : 'block-warn'}">${g ? `${g} ${g > 1 ? 'parallele Gruppen' : 'Gruppe'} für ${n} Spieler` : '⚠ Gruppengröße im Plan anpassen'}${age && !e.ages.includes(age) ? ' · ⚠ Altersklasse prüfen' : ''}</p>
            ${b.note ? `<p class="notice">${esc(b.note)}</p>` : ''}
            ${p.goal ? `<p class="small muted">Ziel der Einheit: ${esc(p.goal)}</p>` : ''}
            <button class="btn sm" type="button" id="lv-detail">${icon('info')} Alles zur Übung</button>
          </section>
        </div>
      </div>`;
    this.bind(e);
    this.mountScene(e, b);
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
    $('#lv-detail', r).onclick = () => openDetail(e.id);
    on(r, 'click', '[data-jump]', (_, b) => { timer.jump(Number(b.dataset.jump)); haptic('tap'); this.paint(); });
  },

  mountScene(e, b) {
    const key = `${b.id}|${e.id}|${JSON.stringify(e.animation || null)}`;
    const host = $('#lv-scene', this.root), cap = $('#lv-caption', this.root);
    player?.destroy();
    let manual = this.manual && playerKey === key;
    playerKey = key;
    player = mountPlayer(host, e, { loop: true, onStep: i => { cap.textContent = `${i + 1}. ${player?.steps[i] || ''}`; } });
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
    const frac = snap.duration ? 1 - snap.remaining / snap.duration : 0;
    $('#lv-clock', r).textContent = fmtClock(snap.remaining);
    $('#lv-prog', r).setAttribute('stroke-dashoffset', String(C * frac));
    const ring = $('#lv-ring', r), warnAt = store.get().settings.warnSeconds;
    ring.classList.toggle('warn', snap.remaining > 0 && warnAt > 0 && snap.remaining <= warnAt);
    ring.classList.toggle('done', snap.ended);
    $('#lv-sub', r).textContent = snap.ended ? 'Block fertig' : snap.running ? `von ${fmtClock(snap.duration)}` : snap.remaining === snap.duration ? 'Bereit' : 'Pausiert';
    const tg = $('#lv-toggle', r);
    tg.innerHTML = snap.running ? `${icon('pause')} Pause` : snap.ended ? `${icon('reset')} Nochmal` : `${icon('start')} ${snap.remaining === snap.duration ? 'Start' : 'Weiter'}`;
    tg.setAttribute('aria-pressed', String(snap.running));
    const before = sum(p.blocks.slice(0, snap.index), b => b.minutes) * 60, elapsed = before + (snap.duration - snap.remaining);
    $('#lv-elapsed', r).textContent = `${fmtClock(elapsed)} vergangen`;
    $('#lv-left', r).textContent = `${fmtClock(Math.max(0, totalMinutes(p) * 60 + snap.extra - elapsed))} übrig`;
    this.syncScene?.();
  },
};

function setFocus(v) { focus = v; document.body.classList.toggle('live-focus', v); }
