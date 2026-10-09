// Sortieren per Zeiger (Maus, Touch, Stift) am Griff, plus Pfeiltasten am fokussierten Griff.
import { full } from './motion.js';
import { haptic } from './feedback.js';

/** sortable(listEl, { handle: '[data-handle]', onMove(fromIndex, toIndex) }) */
export function sortable(list, { handle = '[data-handle]', onMove }) {
  let drag = null;
  const items = () => [...list.children].filter(c => c.matches('[data-key]'));

  list.addEventListener('pointerdown', ev => {
    const h = ev.target.closest(handle); if (!h || ev.button > 0) return;
    const item = h.closest('[data-key]'); if (!item) return;
    ev.preventDefault();
    const all = items();
    drag = { item, start: ev.clientY, from: all.indexOf(item), to: all.indexOf(item), id: ev.pointerId, rects: all.map(x => x.getBoundingClientRect()), moved: false };
    h.setPointerCapture?.(ev.pointerId);
  });
  list.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dy = ev.clientY - drag.start;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.item.classList.add('lifted'); haptic('tap'); }
    drag.item.style.transform = `translateY(${dy}px) scale(${full() ? 1.02 : 1})`;
    const mid = drag.rects[drag.from].top + drag.rects[drag.from].height / 2 + dy;
    let to = drag.from;
    drag.rects.forEach((r, i) => { if (i < drag.from && mid < r.top + r.height / 2) to = Math.min(to, i); if (i > drag.from && mid > r.top + r.height / 2) to = Math.max(to, i); });
    if (to !== drag.to) {
      drag.to = to;
      const h = drag.rects[drag.from].height + 10;
      items().forEach((x, i) => {
        if (x === drag.item) return;
        const shift = drag.from < to && i > drag.from && i <= to ? -h : drag.from > to && i < drag.from && i >= to ? h : 0;
        x.style.transition = 'transform .18s'; x.style.transform = shift ? `translateY(${shift}px)` : '';
      });
      haptic('tap');
    }
    // am Rand automatisch scrollen
    if (ev.clientY < 90) scrollBy(0, -8); else if (ev.clientY > innerHeight - 110) scrollBy(0, 8);
  });
  const end = ev => {
    if (!drag || (ev && ev.pointerId !== drag.id)) return;
    const { from, to, moved } = drag; drag = null;
    items().forEach(x => { x.style.transform = ''; x.style.transition = ''; x.classList.remove('lifted'); });
    if (moved && from !== to) onMove(from, to);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('keydown', ev => {
    const h = ev.target.closest(handle); if (!h) return;
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    const all = items(), i = all.indexOf(h.closest('[data-key]')), j = i + (ev.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= all.length) return;
    onMove(i, j);
    requestAnimationFrame(() => items()[j]?.querySelector(handle)?.focus());
  });
}
