// Materialkategorien als sichtbarer, filterbarer Katalog – keine Inventarprüfung.
import { esc } from '../core/util.js';

export const MATERIALS = [
  ['ball', '⚽', 'Bälle', /ball|bäll/i], ['cone', '▲', 'Hütchen', /hütchen|kegel|markier/i], ['goal', '▣', 'Tore', /tor/i],
  ['bib', '▰', 'Leibchen', /leibchen/i], ['ground', '▤', 'Weicher Boden', /boden|matte/i], ['other', '◇', 'Weiteres', /.*/],
];
export const materialType = name => MATERIALS.find(m => m[0] !== 'other' && m[3].test(name)) || MATERIALS.at(-1);
export const materialChips = items => items.map(([n, c]) => `<span class="chip" style="min-height:32px;cursor:default;margin:0 4px 4px 0"><span aria-hidden="true">${materialType(n)[1]}</span>${c} ${esc(n)}</span>`).join('');
