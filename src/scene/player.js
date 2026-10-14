// Abspielsteuerung für Platzskizzen (Detail, Trainingsmodus) und sparsame Kartenanimationen.
import { drillPitch, stepsFor } from './pitch.js';
import { compile } from './motion.js';
import { full, onChange } from '../ui/motion.js';

/**
 * Setzt die Skizze von `e` in `host` und liefert einen Player.
 * opts: { camera, loop, onStep(i), onState(state) }  state: 'run' | 'pause' | 'done' | 'static'
 */
export function mountPlayer(host, e, opts = {}) {
  const steps = stepsFor(e);
  let tl = null, step = 0, raf = 0, rate = 1, destroyed = false;
  const paintStatic = i => { host.innerHTML = drillPitch(e, true, i); };
  const emitStep = i => { if (i !== step) { step = i; const l = host.querySelector('.scene-step-label'); if (l) l.textContent = 'SCHRITT ' + (i + 1); opts.onStep?.(i); } };
  const loopFrame = () => {
    raf = 0; if (!tl || destroyed) return;
    emitStep(tl.stepAt(tl.time));
    opts.onTime?.(tl.time, tl.total);
    if (tl.playing) raf = requestAnimationFrame(loopFrame);
    else { if (tl.finished && opts.loop) { tl.seek(0); tl.play(rate); raf = requestAnimationFrame(loopFrame); return; } opts.onState?.(api.state); }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loopFrame); };
  function build() {
    tl?.destroy(); tl = null;
    host.innerHTML = drillPitch(e, true, 0);
    if (full()) tl = compile(host.querySelector('.pitch-scene'), steps.length, { camera: !!opts.camera, exercise: e });
    if (!tl) paintStatic(step);
    opts.onState?.(api.state);
  }
  const api = {
    steps,
    get state() { return !tl ? 'static' : tl.playing ? 'run' : tl.finished ? 'done' : 'pause'; },
    get animated() { return !!tl; },
    get total() { return tl?.total || 0; },
    get step() { return step; },
    play() { if (!tl) return; if (tl.finished) tl.seek(0); tl.play(rate); kick(); opts.onState?.(api.state); },
    pause() { if (!tl) return; tl.pause(); opts.onState?.(api.state); },
    toggle() { api.state === 'run' ? api.pause() : api.play(); },
    rate(r) { rate = r; tl?.rate(r); },
    seek(ms) { if (!tl) return; tl.seek(ms); emitStep(tl.stepAt(ms)); opts.onTime?.(ms, tl.total); },
    goStep(i) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (tl) { tl.seek(tl.stepStart(i)); emitStep(i); opts.onTime?.(tl.time, tl.total); }
      else { step = i; paintStatic(i); opts.onStep?.(i); }
    },
    destroy() { destroyed = true; cancelAnimationFrame(raf); tl?.destroy(); off(); },
  };
  const off = onChange(() => { if (destroyed) return; const was = api.state === 'run'; build(); if (was && tl) api.play(); });
  build();
  return api;
}

/** Kartenanimationen: nur sichtbare Karten, höchstens drei gleichzeitig, nur bei voller Motion. */
export function cardAnimator(root, resolve) {
  const running = new Map(), visible = new Set(), MAX = 3;
  const stop = sc => { const r = running.get(sc); if (r) { clearTimeout(r.t); r.tl.destroy(); running.delete(sc); } };
  const pump = () => {
    const blocked = !full() || document.hidden || !!document.querySelector('dialog[open]');
    for (const sc of [...running.keys()]) if (blocked || !visible.has(sc) || !sc.isConnected) stop(sc);
    if (blocked) return;
    for (const sc of visible) {
      if (running.size >= MAX) break;
      if (running.has(sc) || !sc.isConnected) continue;
      const e = resolve(sc.dataset.exercise); if (!e) continue;
      const tl = compile(sc, stepsFor(e).length, { camera: false }); if (!tl) continue;
      const r = { tl, t: 0 }; running.set(sc, r);
      const run = () => { if (!running.has(sc)) return; tl.seek(0); tl.play(1); tl.anims[0].onfinish = () => { r.t = setTimeout(run, 1600); }; };
      run();
    }
  };
  const io = new IntersectionObserver(entries => {
    for (const en of entries) { if (en.isIntersecting && en.intersectionRatio >= .6) visible.add(en.target); else visible.delete(en.target); }
    pump();
  }, { threshold: [0, .6] });
  const off = onChange(pump);
  const vis = () => pump();
  document.addEventListener('visibilitychange', vis);
  document.addEventListener('trainr:sheet', vis);
  return {
    observe() { io.disconnect(); visible.clear(); for (const sc of [...running.keys()]) stop(sc); root.querySelectorAll('.pitch-scene').forEach(sc => io.observe(sc)); },
    pause() { for (const sc of [...running.keys()]) stop(sc); },
    resume: pump,
    destroy() { io.disconnect(); for (const sc of [...running.keys()]) stop(sc); off(); document.removeEventListener('visibilitychange', vis); document.removeEventListener('trainr:sheet', vis); },
  };
}
