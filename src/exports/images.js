// Export-only snapshots of the actual exercise diagrams. No remote image requests.
import { t } from '../i18n/index.js';
const cache = new Map();
const css = ink => `
svg{font-family:Arial,Helvetica,sans-serif}.pitch-turf{fill:${ink ? '#f6f6f6' : '#2f6a3e'}}
.pitch-stripes{fill:${ink ? '#eeeeee' : '#397647'}}.setup-boundary{fill:none;stroke:${ink ? '#777' : '#a9c7b0'}}
.pitch-player circle{fill:${ink ? '#ddd' : '#ffd400'};stroke:#14130e;stroke-width:2}
.pitch-player text{font:bold 9px Arial;text-anchor:middle;fill:#14130e}
.pitch-player.opponent circle{fill:white}.pitch-player.goalkeeper circle{fill:${ink ? '#777' : '#9154d9'};stroke:${ink ? '#111' : '#faf4ff'}}
.pitch-player.goalkeeper text{fill:white}.setup-cone{fill:${ink ? '#888' : '#ff7a1a'};stroke:${ink ? '#333' : '#cf5700'};stroke-width:.6}
.setup-goal{fill:none;stroke:${ink ? '#111' : '#fff'};stroke-width:2}
.setup-zone rect{fill:${ink ? '#ddd' : '#46794a'};stroke:${ink ? '#555' : '#ffd400'};stroke-dasharray:4 3}
.setup-zone text,.scene-step-label{font:bold 8px Arial;fill:${ink ? '#111' : '#fff'};text-anchor:middle}
.pitch-route,.sketch-trail{fill:none;stroke:${ink ? '#333' : '#fff'};stroke-width:2;stroke-dasharray:5 5}
.sketch-trail.ball{stroke:${ink ? '#555' : '#ffe58a'};stroke-dasharray:2 3}
.pitch-ball-static,.sketch-ball{fill:white;stroke:#14130e;stroke-width:2}.actor-ball{display:none}
marker path{fill:${ink ? '#555' : '#fff'}}
.setup-line,.setup-box{fill:none;stroke:${ink ? '#555' : '#fff'};stroke-width:2}
`;
async function snapshot(html, style) {
  const box = document.createElement('div'); box.innerHTML = html;
  const svg = box.querySelector('svg');
  if (!svg) throw new Error('Aufbauskizze fehlt.');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '960'); svg.setAttribute('height', '570');
  svg.querySelectorAll('text').forEach(node => { node.textContent = t(node.textContent); });
  const rules = document.createElementNS('http://www.w3.org/2000/svg', 'style'); rules.textContent = css(style === 'ink'); svg.prepend(rules);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 570;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,960,570); ctx.drawImage(img,0,0,960,570);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
    return { canvas, bytes: new Uint8Array(await blob.arrayBuffer()), width:960, height:570 };
  } finally { URL.revokeObjectURL(url); }
}
export async function prepareImages(pages) {
  await Promise.all(pages.flatMap(page => page.ops.filter(op => op.t === 'image').map(async op => {
    const key = `${document.documentElement.lang}|${op.style}|${op.svg}`;
    if (!cache.has(key)) { if (cache.size >= 64) cache.clear(); cache.set(key, snapshot(op.svg, op.style)); }
    try { op.image = await cache.get(key); } catch (err) { cache.delete(key); throw err; }
  })));
  return pages;
}
