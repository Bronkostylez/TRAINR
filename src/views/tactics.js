// Taktikboard: frei bewegliche Spieler, lila Torwartmarker, Ball, Hütchen, Lauf-/Pass-/Dribbelpfeile, Formationen.
import * as store from '../core/store.js';
import { esc, uid, clamp, fileDate, slug } from '../core/util.js';
import { LIMITS } from '../core/schema.js';
import { icon, on, $, $$ } from '../ui/dom.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { undoToast } from '../ui/actions.js';
import { toast, haptic } from '../ui/feedback.js';
import { shareFiles, downloadBlob } from '../exports/share.js';

const VB = { w: 100, h: 64 };
const KINDS = {
  a: { name: 'Team A', fill: '#ffd400', ink: '#14130e', r: 2.6 },
  b: { name: 'Team B', fill: '#f6f3ea', ink: '#2b2b2b', r: 2.6 },
  k: { name: 'Keeper A', fill: '#9154d9', ink: '#ffffff', r: 2.8 },
  kb: { name: 'Keeper B', fill: '#9154d9', ink: '#ffffff', r: 2.8, ring: true },
  ball: { name: 'Ball', fill: '#ffffff', ink: '#14130e', r: 1.4 },
  cone: { name: 'Hütchen', fill: '#ff7a1a', ink: '#6b2e05', r: 1.6 },
};
const ARROWS = { run: ['Lauf', '6 0', '#ffffff'], pass: ['Pass', '1.6 1.2', '#ffe58a'], dribble: ['Dribbling', '0.6 0.8', '#ffd400'] };
const FORMATIONS = {
  '5er (1-2-2)': [[20, 28], [20, 44], [36, 20], [36, 44]], '7er (2-3-1)': [[22, 22], [22, 42], [34, 14], [34, 32], [34, 50], [44, 32]],
  '9er (3-3-2)': [[20, 16], [20, 32], [20, 48], [32, 14], [32, 32], [32, 50], [44, 24], [44, 40]],
  '11er (4-4-2)': [[18, 10], [18, 25], [18, 39], [18, 54], [32, 10], [32, 25], [32, 39], [32, 54], [44, 26], [44, 38]],
  '11er (4-3-3)': [[18, 10], [18, 25], [18, 39], [18, 54], [30, 18], [30, 32], [30, 46], [44, 12], [45, 32], [44, 52]],
};
let tool = 'move', boardId = null;

const newBoard = (name = 'Neues Board') => ({ id: uid(), name, pitch: 'full', items: [], arrows: [], note: '' });

function pitchSvg(kind) {
  const line = 'stroke="#ffffffb0" stroke-width=".35" fill="none"';
  if (kind === 'half') return `<rect x="2" y="2" width="96" height="60" ${line}/><path d="M2 62h96" ${line}/><circle cx="50" cy="62" r="9" ${line}/><rect x="30" y="2" width="40" height="15" ${line}/><rect x="40" y="2" width="20" height="5.5" ${line}/><rect x="45" y="0.6" width="10" height="1.4" ${line}/><circle cx="50" cy="12" r=".5" fill="#fff"/>`;
  if (kind === 'small') return `<rect x="6" y="6" width="88" height="52" ${line}/><path d="M50 6v52" ${line}/><circle cx="50" cy="32" r="6" ${line}/><rect x="4" y="27" width="2" height="10" ${line}/><rect x="94" y="27" width="2" height="10" ${line}/>`;
  return `<rect x="2" y="2" width="96" height="60" ${line}/><path d="M50 2v60" ${line}/><circle cx="50" cy="32" r="8.5" ${line}/><circle cx="50" cy="32" r=".5" fill="#fff"/><rect x="2" y="18" width="14" height="28" ${line}/><rect x="2" y="25" width="5" height="14" ${line}/><rect x="84" y="18" width="14" height="28" ${line}/><rect x="93" y="25" width="5" height="14" ${line}/><rect x=".6" y="28" width="1.4" height="8" ${line}/><rect x="98" y="28" width="1.4" height="8" ${line}/>`;
}
function token(it, i, sel) {
  const k = KINDS[it.kind], x = it.x, y = it.y * VB.h / 100;
  const shape = it.kind === 'cone' ? `<path d="M${x - 1.6} ${y + 1.4}l1.6-3.2 1.6 3.2z" fill="${k.fill}" stroke="${k.ink}" stroke-width=".25"/>` : `<circle cx="${x}" cy="${y}" r="${k.r}" fill="${k.fill}" stroke="${k.ring ? '#ffffff' : '#14130e'}" stroke-width="${k.ring ? .6 : .35}" ${k.ring ? 'stroke-dasharray=".9 .5"' : ''}/>`;
  const label = it.label ?? (it.kind === 'k' || it.kind === 'kb' ? 'K' : '');
  return `<g class="board-token ${sel === i ? 'selected' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(k.name)}${label ? ' ' + esc(label) : ''}, ziehen zum Bewegen, Entf zum Löschen">${shape}${label ? `<text x="${x}" y="${y + .15}" fill="${k.ink}" font-family="Arial, sans-serif" font-weight="800" font-size="2.6" text-anchor="middle" dominant-baseline="central">${esc(label)}</text>` : ''}</g>`;
}
function arrowSvg(a, i) {
  const [x1, y1, x2, y2] = a.p, [, dash, col] = ARROWS[a.kind], Y1 = y1 * VB.h / 100, Y2 = y2 * VB.h / 100;
  return `<g data-arrow="${i}"><line x1="${x1}" y1="${Y1}" x2="${x2}" y2="${Y2}" stroke="${col}" stroke-width=".6" stroke-dasharray="${dash}" marker-end="url(#ah-${a.kind})" stroke-linecap="round"/><line x1="${x1}" y1="${Y1}" x2="${x2}" y2="${Y2}" stroke="transparent" stroke-width="3"/></g>`;
}
export function boardSvg(b, sel = -1, { forExport = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}" ${forExport ? 'width="1600" height="1024"' : ''} role="img" aria-label="Taktikboard ${esc(b.name)}">
    <defs>${Object.entries(ARROWS).map(([k, [, , c]]) => `<marker id="ah-${k}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L6 3 0 6z" fill="${c}"/></marker>`).join('')}</defs>
    <rect width="100" height="64" fill="#2f6a3e"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${2 + i * 16}" y="2" width="8" height="60" fill="#ffffff08"/>`).join('')}
    ${pitchSvg(b.pitch)}<g id="bd-arrows">${b.arrows.map(arrowSvg).join('')}</g><g id="bd-items">${b.items.map((it, i) => token(it, i, sel)).join('')}</g><line id="bd-draft" stroke="#fff" stroke-width=".5" stroke-dasharray="1 1" visibility="hidden"/>
    ${forExport ? `<text x="2.5" y="63.2" font-size="1.6" fill="#ffffffb0" font-family="Arial">TRAINR · ${esc(b.name)}</text>` : ''}</svg>`;
}

export const tacticsView = {
  id: 'taktik', title: 'Taktikboard', tab: 'mehr',
  render(root) {
    this.root = root; this.sel = -1;
    const s = store.get();
    if (!s.boards.length) store.update('Taktikboard angelegt', d => { d.boards.push(newBoard('Mein Board')); }, { undo: false });
    if (!store.get().boards.some(b => b.id === boardId)) boardId = store.get().boards[0].id;
    this.paint();
  },
  refresh(reason) { if (reason === 'board') return; if (!store.get().boards.some(b => b.id === boardId)) boardId = store.get().boards[0]?.id; if (!boardId) { this.render(this.root); return; } this.paint(); },
  board() { return store.get().boards.find(b => b.id === boardId); },
  save(label, fn, opts) { store.update(label, d => { const b = d.boards.find(x => x.id === boardId); if (b) fn(b, d); }, { reason: 'board', ...opts }); this.paintBoard(); },
  paint() {
    const b = this.board(), s = store.get();
    this.root.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Werkzeug</p><h1 id="h-taktik">Taktikboard</h1></div>
        <div class="row"><button class="btn sm" type="button" id="tb-boards">${icon('layers')} ${s.boards.length} ${s.boards.length === 1 ? 'Board' : 'Boards'}</button><button class="btn sm" type="button" id="tb-export">${icon('share')} Bild</button></div></div>
      <div class="stack" style="margin-bottom:8px;gap:8px"><input class="input" id="tb-name" maxlength="80" value="${esc(b.name)}" aria-label="Name des Boards" style="font-weight:800">
        <div class="seg" role="radiogroup" aria-label="Platz">${[['full', 'Ganzer Platz'], ['half', 'Halber'], ['small', 'Kleinfeld']].map(([k, t]) => `<button type="button" role="radio" data-pitch="${k}" aria-checked="${b.pitch === k}">${t}</button>`).join('')}</div></div>
      <div class="board-tools" role="toolbar" aria-label="Werkzeuge">
        ${[['move', 'Bewegen', icon('drag')], ['a', 'Team A', '<i style="background:#ffd400"></i>'], ['b', 'Team B', '<i style="background:#f6f3ea"></i>'], ['k', 'Keeper A', '<i style="background:#9154d9"></i>'], ['kb', 'Keeper B', '<i style="background:#9154d9;border:2px dashed #fff"></i>'], ['ball', 'Ball', '<i style="background:#fff;width:14px;height:14px"></i>'], ['cone', 'Hütchen', '<i style="background:#ff7a1a;border-radius:3px;width:14px;height:14px;transform:rotate(45deg)"></i>'],
          ['run', 'Lauf', icon('arrow')], ['pass', 'Pass', icon('arrow')], ['dribble', 'Dribbling', icon('arrow')], ['erase', 'Löschen', icon('trash')]]
          .map(([k, t, ic]) => `<button class="tool" type="button" data-tool="${k}" aria-pressed="${tool === k}">${ic}<span>${t}</span></button>`).join('')}
      </div>
      <div class="board-wrap" id="tb-wrap" style="margin-top:10px"></div>
      <div class="row" style="margin-top:10px"><button class="btn sm" type="button" id="tb-form">${icon('users')} Formation</button><button class="btn sm" type="button" id="tb-undo" ${store.canUndo() ? '' : 'disabled'}>${icon('undo')} Rückgängig</button><button class="btn sm" type="button" id="tb-clear">${icon('reset')} Leeren</button></div>
      <p class="tiny" id="tb-hint" aria-live="polite"></p>
      <label class="field"><span>Notiz zum Board</span><textarea class="input" id="tb-note" maxlength="600" rows="2" placeholder="z. B. Anlaufen nach Rückpass">${esc(b.note || '')}</textarea></label>`;
    this.paintBoard(); this.bind();
  },
  paintBoard() {
    const b = this.board(); if (!b) return;
    $('#tb-wrap', this.root).innerHTML = boardSvg(b, this.sel);
    $('#tb-hint', this.root).textContent = { move: 'Ziehen bewegt Spieler, Ball und Hütchen. Doppeltippen löscht.', erase: 'Element oder Pfeil antippen, um es zu löschen.', run: 'Auf dem Platz ziehen, um einen Laufweg zu zeichnen.', pass: 'Auf dem Platz ziehen, um einen Pass zu zeichnen.', dribble: 'Auf dem Platz ziehen, um ein Dribbling zu zeichnen.' }[tool] || `Auf den Platz tippen, um ${KINDS[tool].name} zu setzen.`;
    const u = $('#tb-undo', this.root); if (u) u.disabled = !store.canUndo();
  },
  bind() {
    const r = this.root, wrap = $('#tb-wrap', r);
    on(r, 'click', '[data-tool]', (_, x) => { tool = x.dataset.tool; $$('[data-tool]', r).forEach(y => y.setAttribute('aria-pressed', String(y === x))); haptic('tap'); this.paintBoard(); });
    on(r, 'click', '[data-pitch]', (_, x) => { this.save('Platz geändert', b => { b.pitch = x.dataset.pitch; }); $$('[data-pitch]', r).forEach(y => y.setAttribute('aria-checked', String(y === x))); });
    $('#tb-name', r).onchange = ev => this.save('Board umbenannt', b => { b.name = ev.target.value.trim().slice(0, 80) || 'Board'; });
    $('#tb-note', r).onchange = ev => this.save('Notiz', b => { b.note = ev.target.value.slice(0, 600); });
    $('#tb-undo', r).onclick = () => { store.undo(); this.paint(); };
    $('#tb-clear', r).onclick = async () => { if (await confirmSheet({ title: 'Board leeren?', text: 'Alle Spieler und Pfeile werden entfernt. Rückgängig möglich.', ok: 'Leeren', danger: true })) { this.save('Board geleert', b => { b.items = []; b.arrows = []; }); undoToast('Board geleert.'); } };
    $('#tb-form', r).onclick = () => this.formations();
    $('#tb-boards', r).onclick = () => this.boardsSheet();
    $('#tb-export', r).onclick = () => this.exportPng();

    const pt = ev => { const svg = wrap.querySelector('svg'), m = svg.getScreenCTM().inverse(), p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m); return [clamp(p.x, 0, 100), clamp(p.y / VB.h * 100, 0, 100)]; };
    let drag = null, lastTap = { i: -1, t: 0 };
    wrap.addEventListener('pointerdown', ev => {
      const b = this.board(), g = ev.target.closest('[data-i]'), arrow = ev.target.closest('[data-arrow]'), [x, y] = pt(ev);
      if (tool === 'erase') {
        if (g) this.save('Element gelöscht', bb => { bb.items.splice(Number(g.dataset.i), 1); });
        else if (arrow) this.save('Pfeil gelöscht', bb => { bb.arrows.splice(Number(arrow.dataset.arrow), 1); });
        haptic('tap'); return;
      }
      if (ARROWS[tool]) { drag = { arrow: true, x, y }; wrap.setPointerCapture(ev.pointerId); return; }
      if (g && (tool === 'move' || KINDS[tool])) {
        const i = Number(g.dataset.i), now = performance.now();
        if (lastTap.i === i && now - lastTap.t < 350) { this.save('Element gelöscht', bb => { bb.items.splice(i, 1); }); lastTap = { i: -1, t: 0 }; haptic('heavy'); return; }
        lastTap = { i, t: now };
        drag = { i, x0: x, y0: y, ox: b.items[i].x, oy: b.items[i].y, el: g, moved: false };
        this.sel = i; wrap.setPointerCapture(ev.pointerId); return;
      }
      if (KINDS[tool]) {
        if (b.items.length >= 40) { toast('Maximal 40 Elemente.'); return; }
        const n = b.items.filter(it => it.kind === tool).length + 1;
        const it = { kind: tool, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        if (tool === 'a' || tool === 'b') it.label = String(n).slice(0, 3);
        this.save(`${KINDS[tool].name} gesetzt`, bb => { bb.items.push(it); });
        haptic('tap');
      }
    });
    wrap.addEventListener('pointermove', ev => {
      if (!drag) return;
      const [x, y] = pt(ev);
      if (drag.arrow) { const l = wrap.querySelector('#bd-draft'); l.setAttribute('x1', drag.x); l.setAttribute('y1', drag.y * VB.h / 100); l.setAttribute('x2', x); l.setAttribute('y2', y * VB.h / 100); l.setAttribute('visibility', 'visible'); return; }
      drag.moved = true;
      drag.nx = clamp(drag.ox + x - drag.x0, 1, 99); drag.ny = clamp(drag.oy + y - drag.y0, 1, 99);
      drag.el.setAttribute('transform', `translate(${drag.nx - drag.ox} ${(drag.ny - drag.oy) * VB.h / 100})`);
    });
    const end = ev => {
      if (!drag) return; const d = drag; drag = null;
      if (d.arrow) {
        const [x, y] = pt(ev);
        if (Math.hypot(x - d.x, (y - d.y) * .64) > 3) { if (this.board().arrows.length >= 40) return toast('Maximal 40 Pfeile.'); this.save(`${ARROWS[tool][0]} gezeichnet`, b => { b.arrows.push({ kind: tool, p: [d.x, d.y, x, y].map(v => Math.round(v * 10) / 10) }); }); haptic('tap'); }
        else this.paintBoard();
        return;
      }
      if (d.moved) this.save('Element bewegt', b => { b.items[d.i].x = Math.round(d.nx * 10) / 10; b.items[d.i].y = Math.round(d.ny * 10) / 10; });
      else this.paintBoard();
    };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('keydown', ev => {
      const g = ev.target.closest('[data-i]'); if (!g) return; const i = Number(g.dataset.i);
      const d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }[ev.key];
      if (d) { ev.preventDefault(); this.sel = i; this.save('Element bewegt', b => { b.items[i].x = clamp(b.items[i].x + d[0], 1, 99); b.items[i].y = clamp(b.items[i].y + d[1], 1, 99); }); $(`[data-i="${i}"]`, wrap)?.focus(); }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); this.save('Element gelöscht', b => { b.items.splice(i, 1); }); }
    });
  },
  formations() {
    openSheet({
      title: 'Formation setzen', body: `<p class="small muted">Setzt Team A (links) mit Keeper. Optional auch Team B gespiegelt. Vorhandene Spieler werden ersetzt – Rückgängig möglich.</p>
        <label class="switch-row"><span>Auch Team B setzen<small>Gespiegelt auf der rechten Seite</small></span><input class="switch" type="checkbox" id="fm-b" checked></label>
        <div class="list" style="margin-top:8px">${Object.keys(FORMATIONS).map(k => `<button class="list-item" type="button" data-form="${esc(k)}"><span class="grow"><strong>${esc(k)}</strong></span>${icon('chevron')}</button>`).join('')}</div>`,
      onMount: sh => on(sh.body, 'click', '[data-form]', (_, x) => {
        const both = $('#fm-b', sh.body).checked, pos = FORMATIONS[x.dataset.form];
        this.save('Formation gesetzt', b => {
          const keep = b.items.filter(it => it.kind === 'ball' || it.kind === 'cone');
          const items = [{ kind: 'k', x: 5, y: 50 }, ...pos.map(([px, py], i) => ({ kind: 'a', x: px, y: py / 64 * 100, label: String(i + 2) }))];
          if (both) items.push({ kind: 'kb', x: 95, y: 50 }, ...pos.map(([px, py], i) => ({ kind: 'b', x: 100 - px, y: py / 64 * 100, label: String(i + 2) })));
          b.items = [...items, ...keep].slice(0, 40).map(it => ({ ...it, x: Math.round(it.x * 10) / 10, y: Math.round(it.y * 10) / 10 }));
          if (!b.items.some(it => it.kind === 'ball')) b.items.push({ kind: 'ball', x: 50, y: 50 });
        });
        sh.close(); undoToast(`${x.dataset.form} gesetzt.`);
      }),
    });
  },
  boardsSheet() {
    const paint = sh => { const s = store.get(); sh.setBody(`<div class="list">${s.boards.map(b => `<div class="list-item" style="cursor:default"><button class="btn ghost grow" type="button" data-open="${b.id}" style="justify-content:flex-start"><strong>${esc(b.name)}</strong><small class="tiny" style="margin-left:8px">${b.items.length} Elemente</small></button><button class="icon-btn" type="button" data-dup="${b.id}" aria-label="${esc(b.name)} duplizieren">${icon('copy')}</button>${s.boards.length > 1 ? `<button class="icon-btn" type="button" data-del="${b.id}" aria-label="${esc(b.name)} löschen">${icon('trash')}</button>` : ''}</div>`).join('')}</div>`); };
    openSheet({
      title: 'Taktikboards', foot: `<button class="btn primary" type="button" id="bs-new">${icon('plus')} Neues Board</button>`,
      onMount: sh => {
        paint(sh);
        on(sh.body, 'click', '[data-open]', (_, x) => { boardId = x.dataset.open; this.sel = -1; sh.close(); this.paint(); });
        on(sh.body, 'click', '[data-dup]', (_, x) => { if (store.get().boards.length >= LIMITS.boards) return toast('Maximal 100 Boards.'); const src = store.get().boards.find(b => b.id === x.dataset.dup), c = { ...structuredClone(src), id: uid(), name: `${src.name} · Kopie`.slice(0, 80) }; store.update('Board kopiert', d => { d.boards.push(c); }); boardId = c.id; paint(sh); this.paint(); });
        on(sh.body, 'click', '[data-del]', (_, x) => { store.update('Board gelöscht', d => { d.boards = d.boards.filter(b => b.id !== x.dataset.del); }); if (boardId === x.dataset.del) boardId = store.get().boards[0].id; paint(sh); this.paint(); undoToast('Board gelöscht.'); });
        sh.foot.querySelector('#bs-new').onclick = () => { if (store.get().boards.length >= LIMITS.boards) return toast('Maximal 100 Boards.'); const n = newBoard(); store.update('Board angelegt', d => { d.boards.push(n); }); boardId = n.id; sh.close(); this.paint(); };
      },
    });
  },
  async exportPng() {
    const b = this.board(), svg = boardSvg(b, -1, { forExport: true }).replace(/ class="[^"]*"/g, '');
    const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const c = document.createElement('canvas'); c.width = 1600; c.height = 1024; c.getContext('2d').drawImage(img, 0, 0, 1600, 1024);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], `taktik-${slug(b.name)}-${fileDate()}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await shareFiles([file], { title: b.name }); else { downloadBlob(file.name, blob, 'image/png'); toast('Bild heruntergeladen.'); }
    } catch { toast('Bild konnte nicht erstellt werden.'); } finally { URL.revokeObjectURL(url); }
  },
};
