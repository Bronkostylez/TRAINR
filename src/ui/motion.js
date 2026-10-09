// Eine zentrale Motion-Schicht. Stufen: full | reduced | off.
// Systemeinstellung „weniger Bewegung“ begrenzt immer auf höchstens „reduced“ (nur kurze Überblendungen).
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
let userLevel = 'full';
const listeners = new Set();

export function level() {
  if (userLevel === 'off') return 'off';
  if (mq.matches || userLevel === 'reduced') return 'reduced';
  return 'full';
}
export const full = () => level() === 'full';
export const reduced = () => level() !== 'full';

export function setLevel(l) {
  userLevel = l;
  apply();
}
function apply() {
  document.documentElement.dataset.motion = level();
  if (level() !== 'full') for (const a of document.getAnimations?.() || []) if (a.id !== 'keep') a.finish?.();
  for (const fn of listeners) fn(level());
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
mq.addEventListener?.('change', apply);

/** Web-Animation, nur bei voller Motion. Gibt die Animation oder null zurück. */
export function animate(node, frames, opts) {
  if (!node?.animate || !full()) return null;
  try { return node.animate(frames, opts); } catch { return null; }
}
/** Kurze Rückmeldung, auch im reduzierten Modus (nur Opazität). */
export function pulse(node) {
  if (!node?.animate || level() === 'off') return;
  if (full()) node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  else node.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 140 });
}
/** Gestaffeltes Einblenden von Listen-Elementen. */
export function stagger(nodes, { y = 14, step = 35, max = 10 } = {}) {
  if (!full()) return;
  [...nodes].slice(0, max).forEach((n, i) => n.animate?.([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * step, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
}
/** FLIP-Animation für Umsortierung. */
export function flip(container, mutate) {
  const kids = [...container.children], first = new Map(kids.map(k => [k.dataset.key, k.getBoundingClientRect()]));
  mutate();
  if (!full()) return;
  for (const k of container.children) {
    const a = first.get(k.dataset.key); if (!a) continue;
    const b = k.getBoundingClientRect(), dy = a.top - b.top;
    if (Math.abs(dy) > 1) k.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
}
