// Bottom-Sheets auf Basis von <dialog>: Fokusfalle und Esc vom Browser, Griff + Wischen zum Schließen,
// Zurück-Taste schließt zuerst das oberste Sheet.
import { esc } from '../core/util.js';
import { icon } from './dom.js';
import { full, level } from './motion.js';
import { haptic } from './feedback.js';

const stack = [];
const closing = []; // Sheets in der Schließ-Animation: ein neues Sheet beendet sie sofort, damit sich keine Dialoge stapeln.
let ignorePop = 0;

addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = stack.at(-1);
  if (top) top.close({ fromHistory: true });
});
export const anyOpen = () => stack.length > 0;
/** Schließt alle Sheets ohne History-Schritt (für Navigation). Gibt die Anzahl zurück. */
export function closeAll() { const n = stack.length; while (stack.length) stack.at(-1).close({ fromHistory: true }); return n; }

/**
 * openSheet({title, body, foot, wide, label, onMount(sheet), onClose()})
 * body/foot sind HTML-Strings. Rückgabe: { dialog, body, foot, close(), setBody(html), setFoot(html) }
 */
export function openSheet({ title = '', body = '', foot = '', wide = false, label, onMount, onClose, className = '' } = {}) {
  while (closing.length) closing.pop()();
  const d = document.createElement('dialog');
  d.className = `sheet ${wide ? 'wide' : ''} ${className}`;
  d.setAttribute('aria-label', label || title);
  d.innerHTML = `<div class="sheet-grab" aria-hidden="true"></div><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Schließen">${icon('close')}</button></div><div class="sheet-body">${body}</div><div class="sheet-foot"${foot ? '' : ' hidden'}>${foot}</div>`;
  document.body.append(d);
  let closed = false;
  const api = {
    dialog: d, body: d.querySelector('.sheet-body'), foot: d.querySelector('.sheet-foot'),
    setBody(html) { api.body.innerHTML = html; },
    setFoot(html) { api.foot.innerHTML = html; api.foot.hidden = !html; },
    setTitle(t) { d.querySelector('.sheet-head h2').textContent = t; },
    close({ fromHistory = false } = {}) {
      if (closed) return; closed = true;
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      if (!fromHistory) { ignorePop++; history.back(); }
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        const ci = closing.indexOf(finish); if (ci >= 0) closing.splice(ci, 1);
        if (d.open) d.close(); d.remove(); onClose?.();
        document.dispatchEvent(new CustomEvent('trainr:sheet', { detail: { open: stack.length > 0 } }));
      };
      if (full()) { d.classList.add('closing'); closing.push(finish); setTimeout(finish, 200); } else finish();
    },
  };
  d.addEventListener('cancel', ev => { ev.preventDefault(); api.close(); });
  d.addEventListener('click', ev => {
    if (ev.target.closest('[data-close]')) { api.close(); return; }
    if (ev.target === d) { // Klick auf den Hintergrund (außerhalb des Inhalts)
      const r = d.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) api.close();
    }
  });
  dragToDismiss(d, api);
  stack.push(api);
  history.pushState({ ...(history.state || {}), sheet: stack.length }, '');
  d.showModal();
  document.dispatchEvent(new CustomEvent('trainr:sheet', { detail: { open: true } }));
  // Fokus auf den Inhalt, nicht automatisch auf den Schließen-Knopf
  const first = d.querySelector('.sheet-body [autofocus]') || d.querySelector('.sheet-body');
  first?.setAttribute('tabindex', first.getAttribute('tabindex') ?? '-1');
  first?.focus({ preventScroll: true });
  onMount?.(api);
  return api;
}

function dragToDismiss(d, api) {
  let drag = null;
  d.addEventListener('pointerdown', ev => {
    if (innerWidth >= 760 || ev.button > 0) return;
    const grab = ev.target.closest('.sheet-grab, .sheet-head');
    const bodyTop = api.body.scrollTop <= 0 && ev.target.closest('.sheet-body') && !ev.target.closest('input,textarea,select,button,a,[data-nodrag],.editor-pitch,.board-wrap,input[type=range]');
    if (!grab && !bodyTop) return;
    if (ev.target.closest('[data-close]')) return;
    drag = { y: ev.clientY, dy: 0, t: performance.now(), id: ev.pointerId, active: !!grab, grab: !!grab };
  });
  d.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    drag.dy = ev.clientY - drag.y;
    if (!drag.active) { if (drag.dy > 10) drag.active = true; else if (drag.dy < -4) { drag = null; return; } else return; }
    if (drag.dy < 0) drag.dy = 0;
    d.classList.add('dragging');
    d.style.transform = `translateY(${drag.dy}px)`;
    if (!drag.captured) { try { d.setPointerCapture(ev.pointerId); drag.captured = true; } catch { /* egal */ } }
  });
  const end = () => {
    if (!drag) return;
    const { dy, t, active } = drag; drag = null;
    d.classList.remove('dragging');
    if (!active) return;
    const v = dy / Math.max(1, performance.now() - t);
    if (dy > 120 || v > .6) {
      haptic('tap');
      if (level() === 'off') { d.style.transform = ''; api.close(); return; }
      d.style.transition = 'transform .2s ease-in'; d.style.transform = 'translateY(100%)';
      setTimeout(() => { d.style.transition = ''; d.style.transform = ''; api.close(); }, 190);
    } else {
      d.style.transition = 'transform .25s cubic-bezier(.16,1,.3,1)'; d.style.transform = '';
      setTimeout(() => { d.style.transition = ''; }, 260);
    }
  };
  d.addEventListener('pointerup', end);
  d.addEventListener('pointercancel', end);
}

/** Bestätigungsdialog als Sheet. Liefert Promise<boolean>. */
export function confirmSheet({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise(resolve => {
    let result = false;
    openSheet({
      title, body: `<p>${esc(text)}</p>`,
      foot: `<button class="btn" type="button" data-close>${esc(cancel)}</button><button class="btn ${danger ? 'danger solid' : 'primary'}" type="button" data-ok>${esc(ok)}</button>`,
      onMount: s => { s.foot.querySelector('[data-ok]').onclick = () => { result = true; s.close(); }; s.foot.querySelector('[data-ok]').focus(); },
      onClose: () => resolve(result),
    });
  });
}
