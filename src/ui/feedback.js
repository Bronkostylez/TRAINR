// Unmittelbare Rückmeldung: Toasts (mit optionaler Aktion), Haptik, Töne.
import { esc } from '../core/util.js';
import * as store from '../core/store.js';

let root;
/** Toasts gehören über das oberste offene Sheet: ein <dialog> liegt in der Top-Layer-Ebene
 *  über jedem z-index. Der Toast-Container wird deshalb in das oberste offene Sheet
 *  umgehängt (position:fixed bleibt viewport- relativ, solange das Sheet keinen
 *  Transform trägt) und landet zurück am <body>, wenn kein Sheet offen ist. */
function park() {
  if (!root) return;
  const sheets = [...document.querySelectorAll('dialog.sheet[open]:not(.closing)')];
  const host = sheets.at(-1) || document.body;
  if (root.parentElement !== host) host.append(root);
}
document.addEventListener('trainr:sheet', park);
function container() {
  if (!root) { root = document.createElement('div'); root.className = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.append(root); }
  park();
  return root;
}

/** toast('Text', {action:'Rückgängig', onAction, ms}) */
export function toast(msg, { action, onAction, ms = 4200 } = {}) {
  const c = container();
  while (c.children.length >= 1) c.firstElementChild.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="grow">${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  let timer;
  const close = () => { clearTimeout(timer); t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  if (action) t.querySelector('button').onclick = () => { close(); onAction?.(); };
  c.append(t);
  timer = setTimeout(close, action ? Math.max(ms, 6000) : ms);
  t.addEventListener('pointerenter', () => clearTimeout(timer));
  t.addEventListener('pointerleave', () => { timer = setTimeout(close, 2500); });
  return close;
}

const PATTERN = { tap: 8, ok: [10, 40, 18], warn: [30, 60, 30], heavy: 22, end: [60, 80, 60, 80, 120] };
export function haptic(kind = 'tap') {
  try { if (store.get()?.settings.haptics && navigator.vibrate) navigator.vibrate(PATTERN[kind] ?? 8); } catch { /* nicht unterstützt */ }
}

let audio;
/** Kurzer Signalton. kind: 'warn' (Vorwarnung), 'end' (Blockende), 'start'. */
export function beep(kind = 'end') {
  if (!store.get()?.settings.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    const seq = kind === 'warn' ? [[880, 0, .12]] : kind === 'start' ? [[660, 0, .1], [990, .12, .12]] : [[660, 0, .22], [660, .3, .22], [990, .6, .45]];
    for (const [f, at, len] of seq) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      const t0 = audio.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.start(t0); o.stop(t0 + len + .05);
    }
  } catch { /* Audio nicht verfügbar */ }
}
/** Audio muss durch eine Nutzeraktion freigeschaltet werden (iOS/Chrome). */
export function unlockAudio() { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* egal */ } }
