// Zielzeit-basierter Trainings-Timer. Läuft unabhängig von der Ansicht weiter; Zustand übersteht ein Neuladen (sessionStorage).
import * as store from './store.js';
import { currentPlan, sessionSteps } from './planning.js';

const KEY = 'trainr-timer';
let t = { planId: null, blockId: null, remaining: 0, deadline: null, warned: false, ended: false, extra: 0 };
let tickId = null, wake = null, lastIndex = 0;
const listeners = new Set();
const hooks = { onWarn() {}, onEnd() {}, onAuto() {} };

export const setHooks = h => Object.assign(hooks, h);
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => { persist(); for (const fn of listeners) fn(snapshot()); };
function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* egal */ } }

function plan() { return currentPlan(store.get()); }
/** Ablauf inkl. eingeplanter Pausen – Pausen laufen wie Blöcke mit eigenem Countdown. */
function blocks() { const s = store.get(), p = currentPlan(s); return p ? sessionSteps(s, p) : []; }
export function index() { const i = blocks().findIndex(b => b.id === t.blockId); return i < 0 ? 0 : i; }
const block = () => blocks()[index()] || null;
export const running = () => !!t.deadline;

export function snapshot() {
  const b = block();
  return { running: running(), index: index(), count: blocks().length, block: b, remaining: currentRemaining(), duration: b ? b.minutes * 60 + t.extra : 0, ended: t.ended, extra: t.extra };
}
function currentRemaining() { return t.deadline ? Math.max(0, Math.ceil((t.deadline - Date.now()) / 1000)) : t.remaining; }

/** Mit aktuellem Plan abgleichen (nach Planänderungen, Laden). */
export function sync() {
  const p = plan();
  if (!p || !p.blocks.length) { stopTick(); t = { planId: p?.id ?? null, blockId: null, remaining: 0, deadline: null, warned: false, ended: false, extra: 0 }; emit(); return; }
  if (t.planId !== p.id) { stopTick(); t = { planId: p.id, blockId: p.blocks[0].id, remaining: p.blocks[0].minutes * 60, lastFull: p.blocks[0].minutes * 60, deadline: null, warned: false, ended: false, extra: 0 }; lastIndex = 0; emit(); return; }
  const bs = blocks(), b = bs.find(x => x.id === t.blockId);
  if (!b) { // aktueller Block wurde entfernt
    stopTick(); t.blockId = bs[Math.min(bs.length - 1, Math.max(0, lastIndex))].id; t.remaining = block().minutes * 60; t.lastFull = t.remaining; t.extra = 0; t.warned = t.ended = false; emit(); return;
  }
  // Blockdauer im Plan geändert und Timer steht am Anfang: neue Dauer übernehmen
  if (!running() && !t.ended && t.remaining === t.lastFull) t.remaining = b.minutes * 60 + t.extra;
  t.lastFull = b.minutes * 60 + t.extra;
  lastIndex = index();
  emit();
}

export function start() {
  const b = block(); if (!b) return;
  if (t.ended || t.remaining <= 0) { t.remaining = b.minutes * 60; t.extra = 0; t.ended = false; t.warned = false; }
  t.deadline = Date.now() + t.remaining * 1000;
  startTick(); requestWake(); emit();
}
export function pause() { if (!running()) return; t.remaining = currentRemaining(); t.deadline = null; stopTick(); releaseWake(); emit(); }
export const toggle = () => (running() ? pause() : start());
export function reset() { const b = block(); stopTick(); releaseWake(); t.deadline = null; t.extra = 0; t.remaining = b ? b.minutes * 60 : 0; t.lastFull = t.remaining; t.warned = t.ended = false; emit(); }
export function jump(i, { autostart = false } = {}) {
  const bs = blocks(); if (!bs[i]) return;
  const was = running();
  stopTick(); t.deadline = null; t.blockId = bs[i].id; t.extra = 0; t.remaining = bs[i].minutes * 60; t.lastFull = t.remaining; t.warned = t.ended = false; lastIndex = i;
  if (was || autostart) start(); else { releaseWake(); emit(); }
}
export const next = opts => jump(index() + 1, opts);
export const prev = () => jump(Math.max(0, index() - 1));
/** Aktuellen Block um Sekunden verlängern, ohne den Plan zu ändern. */
export function extend(sec) {
  if (running()) t.deadline += sec * 1000; else { t.remaining = Math.max(0, t.remaining) + sec; t.ended = false; }
  t.extra += sec; t.warned = false; emit();
}

function startTick() { stopTick(); tickId = setInterval(tick, 250); }
function stopTick() { clearInterval(tickId); tickId = null; }
function tick() {
  if (!running()) return;
  const r = currentRemaining(), warnAt = store.get().settings.warnSeconds;
  if (!t.warned && warnAt && r <= warnAt && r > 0 && t.remaining > warnAt) { t.warned = true; hooks.onWarn(snapshot()); }
  if (r <= 0) {
    t.remaining = 0; t.deadline = null; t.ended = true; stopTick();
    const hasNext = index() < blocks().length - 1;
    hooks.onEnd({ ...snapshot(), hasNext });
    if (hasNext && store.get().settings.autoAdvance) { setTimeout(() => { if (t.ended) { next({ autostart: true }); hooks.onAuto(snapshot()); } }, 2500); }
    else releaseWake();
  }
  for (const fn of listeners) fn(snapshot());
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (running()) tick(); if (running()) requestWake(); } });

async function requestWake() {
  if (!store.get().settings.wakeLock || !('wakeLock' in navigator) || wake) return;
  try { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } catch { wake = null; }
}
function releaseWake() { try { wake?.release(); } catch { /* egal */ } wake = null; }

/** Beim Start: Zustand aus der Sitzung wiederherstellen. */
export function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && saved.planId === plan()?.id && blocks().some(b => b.id === saved.blockId)) {
      t = { ...t, ...saved };
      if (t.deadline) { if (t.deadline <= Date.now()) { t.deadline = null; t.remaining = 0; t.ended = true; } else startTick(); }
    }
  } catch { /* egal */ }
  sync();
}
