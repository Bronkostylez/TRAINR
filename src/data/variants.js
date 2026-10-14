// Super-Übungen: Eine Grundübung mit Stellschrauben. Aus den Einstellungen entsteht je Kombination eine stimmige Variante
// (Aufbau, Spielzug-Animation, Ablauf, Material, Spielerzahl). Nichts davon wird gespeichert: Die Kennung `grundübung~f5.b2`
// beschreibt die Variante, sie wird bei jedem Öffnen neu berechnet. Varianten sind TRAINR-Anpassungen der Grundübung.
import { getLang } from '../i18n/index.js';

const T = (de, en) => (getLang() === 'en' ? en : de);
const SEP = '~';
const pt = (c, p, f) => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f];
const r0 = v => Math.round(v);
const LETTERS = 'ABCDEF';

// ---------------------------------------------------------------- Pass-Formen (Grundübung: Pass-Quadrat mit Nachlaufen)
const PASS = {
  base: 'v22-quadrat',
  title: ['Pass und Nachlaufen', 'Pass and follow'],
  params: [
    { k: 'f', label: ['Form', 'Shape'], def: 4, opts: [[3, 'Dreieck', 'Triangle'], [4, 'Viereck', 'Square'], [5, 'Fünfeck', 'Pentagon'], [6, 'Sechseck', 'Hexagon']] },
    { k: 'b', label: ['Bälle', 'Balls'], def: 1, opts: [[1, '1 Ball', '1 ball'], [2, '2 Bälle', '2 balls']] },
    { k: 'r', label: ['Regel', 'Rule'], def: 0, opts: [[0, 'Pass und Platz tauschen', 'Pass and swap places'], [1, 'Direktspiel', 'One touch'], [2, 'Richtungswechsel auf Zuruf', 'Switch direction on call'], [3, 'Übernächster Mitspieler', 'Skip one player']] },
    { k: 's', label: ['Abstand', 'Distance'], def: 2, opts: [[1, 'klein', 'short'], [2, 'mittel', 'medium'], [3, 'groß', 'long']] },
  ],
  presets: [
    { de: 'Dreieck', en: 'Triangle', p: { f: 3 } },
    { de: 'Fünfeck', en: 'Pentagon', p: { f: 5 } },
    { de: 'Zwei Bälle', en: 'Two balls', p: { b: 2 } },
    { de: 'Direktspiel', en: 'One touch', p: { r: 1 } },
    { de: 'Wechsel auf Zuruf', en: 'Switch on call', p: { r: 2 } },
    { de: 'Fünfeck, 2 Bälle', en: 'Pentagon, 2 balls', p: { f: 5, b: 2, r: 3 } },
  ],
  norm(p) { if (p.f < 4) p.b = 1; if (p.f === 3 && p.r === 3) p.r = 0; return p; },
  build(p, base) {
    const n = p.f, rx = [72, 92, 112][p.s - 1], ry = [44, 55, 66][p.s - 1], C = [160, 95];
    const a0 = n === 4 ? -135 : -90;
    const cor = Array.from({ length: n }, (_, k) => { const a = (a0 + 360 / n * k) * Math.PI / 180; return [r0(C[0] + rx * Math.cos(a)), r0(C[1] + ry * Math.sin(a))]; });
    const spot = k => pt(C, cor[k], .86).map(r0);
    // Simulation: jeder Spieler steht an einer Ecke; der Passgeber läuft zur Ecke des Empfängers.
    const at = Array.from({ length: n }, (_, i) => i), holders = p.b === 2 ? [0, Math.floor(n / 2)] : [0];
    const total = Math.min(n * 2, 8), phases = [];
    let dir = 1;
    for (let t = 0; t < total; t++) {
      if (p.r === 2 && t === Math.ceil(total / 2)) dir = -1;
      const k = p.r === 3 ? 2 : 1, used = new Set(holders), mv = [];
      const next = [];
      for (const h of holders) {
        let tgt = -1;
        for (let o = k; o < k + n && tgt < 0; o++) {
          const c = ((at[h] + dir * o) % n + n) % n;
          if (c === at[h]) continue;
          const q = at.findIndex((cc, i) => cc === c && !used.has(i));
          if (q >= 0) tgt = q;
        }
        if (tgt < 0) continue;
        used.add(tgt); mv.push([h, tgt, at[tgt]]); next.push(tgt);
      }
      const hold = p.r === 1 ? 0 : .12;
            const src = mv.map(([h, q]) => `p${h}>${q}${p.r === 1 ? ' pass' : ''}`).concat(mv.map(([h, , c]) => { const s = spot(c); return `r${h} ${s[0]} ${s[1]}${p.r === 1 ? ' sprint' : ''}`; })).join('; ');
      phases.push([phaseStep(p, t, total), hold, src]);
      for (const [h, , c] of mv) at[h] = c;
      holders.splice(0, holders.length, ...next);
    }
    const script = {
      name: base.name,
      obj: cor.map(c => ['cone', c[0], c[1]]),
      pl: cor.map((c, i) => [c[0], c[1], LETTERS[i]]),
      balls: p.b === 2 ? [0, Math.floor(n / 2)] : [0],
      ph: phases,
    };
    const shape = [null, null, null, ['Dreieck', 'triangle'], ['Quadrat', 'square'], ['Fünfeck', 'pentagon'], ['Sechseck', 'hexagon']][n];
    const steps = [
      T(`Aufbau: ${shape[0]} aus ${n} Hütchen mit ${['kleinem', 'mittlerem', 'großem'][p.s - 1]} Abstand, ein Kind je Hütchen, ${p.b === 2 ? 'zwei Bälle bei Kindern, die möglichst weit auseinander stehen' : 'ein Ball bei einem Kind'}.`,
        `Setup: ${shape[1]} of ${n} cones, ${['short', 'medium', 'long'][p.s - 1]} distances, one player per cone, ${p.b === 2 ? 'two balls with players as far apart as possible' : 'one ball with one player'}.`),
      p.r === 3
        ? T('Der Passgeber spielt zum übernächsten Mitspieler und läuft zu dessen Hütchen. Der Empfänger spielt gleich weiter.', 'The passer plays to the second player along and runs to that cone. The receiver plays on straight away.')
        : T('Der Passgeber spielt zum nächsten Mitspieler im Kreis und läuft zu dessen Hütchen. Der Empfänger spielt gleich weiter.', 'The passer plays to the next player in the circle and runs to that cone. The receiver plays on straight away.'),
      p.r === 1 ? T('Regel: Annehmen und Passen in einem Kontakt, wenn die Passqualität stimmt; sonst zwei Kontakte (in der Animation nicht sichtbar, sie zeigt nur den Passweg).', 'Rule: pass first time when the quality is right, otherwise two touches (not visible in the animation, which shows the pass path only).')
        : p.r === 2 ? T('Auf Zuruf des Trainers wechselt die Passrichtung.', 'On the coach’s call the passing direction changes.')
        : p.r === 3 ? T('Immer den Ball und den freien Platz im Blick behalten, die Pässe werden länger.', 'Keep watching the ball and the free space; the passes get longer.')
        : T('Passen und Laufen im gleichen Rhythmus: erst sicher, dann schneller.', 'Pass and run in the same rhythm: secure first, then faster.'),
      p.b === 2 ? T('Zwei Bälle laufen gleichzeitig: Vor jedem Pass prüfen, wo der zweite Ball ist.', 'Two balls move at once: check where the other ball is before every pass.')
        : T('Ab der zweiten Runde Tempo erhöhen, wenn die Pässe sauber ankommen.', 'From the second round raise the tempo if the passes arrive cleanly.'),
    ];
    const hard = p.b === 2 || p.r === 3 || p.r === 1;
    return {
      script, steps, nameParts: [shape[0] === 'Quadrat' ? null : [shape[0], shape[1]], p.b === 2 ? ['2 Bälle', '2 balls'] : null, ['Direkt', 'One touch'], ['Wechsel', 'Switch'], ['Übernächster', 'Skip one']].filter((x, i) => i < 2 || (i === 2 && p.r === 1) || (i === 3 && p.r === 2) || (i === 4 && p.r === 3)).filter(Boolean),
      min: n, max: n, minutes: base.minutes + (hard ? 2 : 0),
      equipment: [['Bälle', p.b + 1], ['Hütchen', n]],
      ages: base.ages,
      extraCoaching: [p.b === 2 ? T('Zweiten Ball erst nach sicheren Pässen einführen.', 'Add the second ball only after the passes are secure.') : '', hard ? T('Anspruchsvoller als die Grundübung (TRAINR-Einschätzung): bei Unsicherheit mit weniger Bällen, einem Kontakt mehr oder mehr Platz beginnen.', 'More demanding than the base drill (TRAINR estimate): if players struggle, start with fewer balls, an extra touch or more space.') : ''].filter(Boolean).join(' '),
    };
  },
};
function phaseStep(p, t, total) { return t === 0 ? 1 : t < total / 2 ? 1 : p.b === 2 && t >= total - 2 ? 3 : 2; }

// ---------------------------------------------------------------- Rondo (Grundübung: Drei gegen eins, Passfenster)
const RONDO = {
  base: 'v5-rondo',
  title: ['Rondo', 'Rondo'],
  params: [
    { k: 'o', label: ['Außenspieler', 'Outside players'], def: 3, opts: [[3, '3', '3'], [4, '4', '4'], [5, '5', '5']] },
    { k: 'v', label: ['Verteidiger', 'Defenders'], def: 1, opts: [[1, '1', '1'], [2, '2', '2']] },
    { k: 's', label: ['Feld', 'Area'], def: 2, opts: [[1, 'klein', 'small'], [2, 'mittel', 'medium'], [3, 'groß', 'large']] },
    { k: 'r', label: ['Regel', 'Rule'], def: 0, opts: [[0, 'Freie Kontakte', 'Free touches'], [1, 'Zwei Kontakte', 'Two touches'], [2, 'Verteidiger gehend', 'Defenders walking'], [3, 'Pass durch die Mitte zählt', 'Pass through the middle scores']] },
  ],
  presets: [
    { de: '4 gegen 1', en: '4 v 1', p: { o: 4 } },
    { de: '4 gegen 2', en: '4 v 2', p: { o: 4, v: 2 } },
    { de: '5 gegen 2', en: '5 v 2', p: { o: 5, v: 2, s: 3 } },
    { de: 'Einsteiger: Verteidiger gehend', en: 'Starter: defenders walking', p: { r: 2, s: 3 } },
    { de: 'Mitte zählt', en: 'Middle scores', p: { o: 4, r: 3 } },
  ],
  norm(p) { if (p.v === 2 && p.o === 3) p.o = 4; return p; },
  build(p, base) {
    const [w, h] = [[150, 104], [196, 124], [236, 144]][p.s - 1], C = [160, 95], x0 = C[0] - w / 2, x1 = C[0] + w / 2, y0 = C[1] - h / 2, y1 = C[1] + h / 2, m = 9;
    const yy = a => [a[0], Math.max(a[1], 40)];
    const spots = { 3: [[x0 + m, y0 + m], [x1 - m, y0 + m], [C[0], y1 - m]], 4: [[x0 + m, y0 + m], [x1 - m, y0 + m], [x1 - m, y1 - m], [x0 + m, y1 - m]], 5: [[x0 + m, y0 + m], [x1 - m, y0 + m], [x1 - m, y1 - m], [C[0], y1 - m], [x0 + m, y1 - m]] }[p.o].map(yy).map(a => a.map(r0));
    const dp = p.v === 1 ? [[C[0], C[1]]] : [[C[0] - 18, C[1] - 8], [C[0] + 18, C[1] + 8]];
    const pl = [...spots.map((c, i) => [c[0], c[1], String(i + 1)]), ...dp.map(d => [d[0], d[1], 'V', 1])];
    // Passfolge: meist zum Nachbarn, ab und zu quer (bei Regel „Mitte zählt“ immer wieder quer).
    const seq = []; let cur = 0; const o = p.o;
    for (let t = 0; t < 6; t++) {
      const cross = p.r === 3 && t % 2 === 1 && o >= 4;
      const tgt = cross ? (cur + Math.floor(o / 2)) % o : (cur + 1 + (t === 3 && o >= 4 ? 1 : 0)) % o;
      seq.push([cur, tgt, cross]); cur = tgt;
    }
    const walk = p.r === 2 ? ' walk' : '';
    const ph = seq.map(([a, b, cross], t) => {
      const target = spots[b], from = spots[a];
      const moves = dp.map((d, i) => {
        const aim = pt(C, i === 0 ? target : from, cross ? .15 : .5 + .1 * i);
        const x = aim[0] + (i ? 14 : -4), y = aim[1] + (i ? -4 : 6);
        return `r${o + i} ${r0(x)} ${r0(y)}${i === 0 && !walk ? ' sprint' : walk}`;
      });
      return [cross ? 3 : 1, p.r === 1 ? .05 : .25, `p${a}>${b}${cross ? ' chip' : ''}; ${moves.join('; ')}`];
    });
    const script = { name: base.name, obj: [['box', r0(x0), r0(y0), w, h]], pl, balls: [0], ph };
    const label = `${o} ${T('gegen', 'v')} ${p.v}`;
    const steps = [
      T(`Aufbau: ${['Kleines', 'Mittleres', 'Großes'][p.s - 1]} Feld, ${o} Außenspieler an den Seiten, ${p.v} ${p.v === 1 ? 'Verteidiger' : 'Verteidiger'} innen. ${label}.`, `Setup: ${['small', 'medium', 'large'][p.s - 1]} area, ${o} outside players on the edges, ${p.v} ${p.v === 1 ? 'defender' : 'defenders'} inside. ${label}.`),
      T('Die Außenspieler halten den Ball in den eigenen Reihen und spielen Passwege frei.', 'The outside players keep the ball and open passing lanes.'),
      p.r === 1 ? T('Regel: höchstens zwei Kontakte je Spieler (in der Animation nicht sichtbar, sie zeigt nur den Passweg).', 'Rule: two touches at most per player (not visible in the animation, which shows the pass path only).')
        : p.r === 2 ? T('Einstieg: Die Verteidiger gehen, bis der Ball sicher läuft.', 'Starter: defenders walk until the ball moves securely.')
        : p.r === 3 ? T('Ein Pass durch die Mitte zwischen den Verteidigern zählt einen Punkt' + (o >= 4 ? '.' : ' (bei 3 Außenspielern ist die Mitte nicht eigens eingezeichnet).'), 'A pass through the middle between the defenders scores one point' + (o >= 4 ? '.' : ' (with 3 outside players the middle pass is not drawn separately).'))
        : T('Freie Kontakte, kein Kontaktzwang.', 'Free touches, no touch limit.'),
      T('Bei Ballgewinn oder Ausball wechseln die Verteidiger, spätestens nach 45 bis 60 Sekunden.', 'On a won ball or when the ball goes out the defenders change, after 45 to 60 seconds at most.'),
    ];
    return {
      script, steps, nameParts: [[`${o} gegen ${p.v}`, `${o} v ${p.v}`], p.s !== 2 ? [['Feld klein', 'Small area'], null, ['Feld groß', 'Large area']][p.s - 1] : null, p.r ? [null, ['2 Kontakte', '2 touches'], ['Einstieg', 'Starter'], ['Mitte zählt', 'Middle scores']][p.r] : null].filter(Boolean),
      min: o + p.v, max: o + p.v, minutes: base.minutes,
      equipment: [['Bälle', 2], ['Hütchen', 4], ['Leibchen', p.v]],
      ages: base.ages,
      extraCoaching: [p.s === 1 ? T('Kleines Feld ist schwerer für die Außenspieler: bei vielen Ballverlusten vergrößern.', 'A small area is harder for the outside players: enlarge it after many losses.') : '', (p.v === 2 || o >= 5) ? T('Anspruchsvoller als die Grundübung (TRAINR-Einschätzung): bei vielen Ballverlusten Feld vergrößern oder Verteidiger gehen lassen.', 'More demanding than the base drill (TRAINR estimate): enlarge the area or let defenders walk after many losses.') : ''].filter(Boolean).join(' '),
    };
  },
};

// ---------------------------------------------------------------- Slalom (Grundübung: Slalom-Kreisel ohne Wartezeit)
const SLALOM = {
  base: 'v22-slalom',
  title: ['Slalom und Pass', 'Slalom and pass'],
  params: [
    { k: 'n', label: ['Hütchen je Strecke', 'Cones per course'], def: 5, opts: [[3, '3', '3'], [5, '5', '5'], [7, '7', '7']] },
    { k: 'a', label: ['Abstand', 'Spacing'], def: 2, opts: [[1, 'eng', 'tight'], [2, 'mittel', 'medium'], [3, 'weit', 'wide']] },
    { k: 'm', label: ['Ablauf', 'Flow'], def: 0, opts: [[0, 'Einmal durch, dann Seitenwechsel', 'One pass through, then switch sides'], [1, 'Hin und zurück', 'Out and back']] },
    { k: 'r', label: ['Aufgabe', 'Task'], def: 0, opts: [[0, 'Frei', 'Free'], [1, 'Nur Außenseite', 'Outside of the foot only'], [2, 'Nur Innenseite', 'Inside of the foot only'], [3, 'Schwacher Fuß', 'Weaker foot']] },
  ],
  presets: [
    { de: 'Kurz: 3 Hütchen', en: 'Short: 3 cones', p: { n: 3 } },
    { de: 'Lang: 7 Hütchen', en: 'Long: 7 cones', p: { n: 7, a: 1 } },
    { de: 'Hin und zurück', en: 'Out and back', p: { m: 1 } },
    { de: 'Schwacher Fuß', en: 'Weaker foot', p: { r: 3 } },
    { de: 'Enge Hütchen', en: 'Tight cones', p: { a: 1 } },
  ],
  norm: p => p,
  build(p, base) {
    const n = p.n, s = Math.min([10, 15, 20][p.a - 1], Math.floor(96 / (n - 1))), L = (n - 1) * s;
    const l1 = Array.from({ length: n }, (_, j) => 50 + j * s), l2 = Array.from({ length: n }, (_, j) => 270 - L + j * s);
    const obj = [...l1, ...l2].map(x => ['cone', x, 95]);
    const zig1 = l1.map((x, j) => `d0 ${x - 4} ${j % 2 ? 106 : 80}`);
    const zig2 = [...l2].reverse().map((x, j) => `d1 ${x + 4} ${j % 2 ? 106 : 80}`);
    const end1 = 50 + L + 12, end2 = 270 - L - 12;
    const ph = [];
    const addZig = (list, tail, step) => list.forEach((z, j) => ph.push([step, j === list.length - 1 && !tail ? .1 : 0, z]));
    if (p.m === 0) {
      addZig(zig1, false, 1); ph.push([1, .1, `d0 ${end1} 92`]);
      ph.push([2, .1, 'p0>1; r0 150 60 sprint']);
      addZig(zig2, true, 3); ph.push([3, .2, `d1 ${end2} 92; r0 290 95 walk`]);
      ph.push([4, .6, 'p1>0']);
    } else {
      const back1 = [...l1].reverse().map((x, j) => `d0 ${x + 4} ${j % 2 ? 80 : 106}`), back2 = l2.map((x, j) => `d1 ${x - 4} ${j % 2 ? 80 : 106}`);
      addZig(zig1, true, 1); ph.push([1, .1, `d0 ${end1} 92`]); addZig(back1, true, 1); ph.push([1, .1, 'd0 36 95 walk']);
      ph.push([2, .1, 'p0>1']);
      addZig(zig2, true, 3); ph.push([3, .1, `d1 ${end2} 92`]); addZig(back2, true, 3); ph.push([3, .1, 'd1 284 95 walk']);
      ph.push([4, .6, 'p1>0']);
    }
    const NS = [' (Animation zeigt die Strecke, nicht den Fuß)', ' (animation shows the course, not the foot)'], ns = getLang() === 'en' ? NS[1] : NS[0];
    const task = [null, T('Nur mit der Außenseite des Fußes führen.', 'Dribble with the outside of the foot only.') + ns, T('Nur mit der Innenseite des Fußes führen.', 'Dribble with the inside of the foot only.') + ns, T('Nur mit dem schwächeren Fuß führen, nach vier Durchgängen wechseln.', 'Dribble with the weaker foot only, switch after four runs.') + ns][p.r];
    const sp = ['engem', 'mittlerem', 'weitem'][p.a - 1], spEn = ['tight', 'medium', 'wide'][p.a - 1];
    const steps = [
      T(`Aufbau: Zwei Slalomstrecken mit je ${n} Hütchen in ${sp} Abstand, die Strecken liegen gegenüber, je ein Kind am äußeren Ende.`, `Setup: two slalom courses of ${n} cones with ${spEn} spacing, facing each other, one player at each outer end.`),
      p.m === 0 ? T('A dribbelt durch den ersten Slalom.', 'A dribbles through the first course.') : T('A dribbelt durch die Strecke und auf dem Rückweg wieder zurück.', 'A dribbles through the course and back again.'),
      p.m === 0 ? T('Am Ende passt A zu B und läuft außen zur anderen Seite.', 'At the end A passes to B and runs around the outside to the other side.') : T('Am Startpunkt passt A zu B.', 'Back at the start A passes to B.'),
      p.m === 0 ? T('B dribbelt durch den zweiten Slalom.', 'B dribbles through the second course.') : T('B dribbelt hin und zurück.', 'B dribbles out and back.'),
      T('B passt zurück und der Ablauf beginnt von vorn.' + (task ? ' ' + task : ' Nach vier Durchgängen den Fuß wechseln.'), 'B passes back and the sequence starts again.' + (task ? ' ' + task : ' After four runs switch feet.')),
    ];
    const stepsUsed = p.m === 0 ? steps : [steps[0], steps[1], steps[2], steps[3], steps[4]];
    return {
      script: { name: base.name, obj, pl: [[30, 95, 'A'], [290, 95, 'B']], balls: [0], ph }, steps: stepsUsed,
      nameParts: [n !== 5 ? [`${n} Hütchen`, `${n} cones`] : null, p.a !== 2 ? [['Eng', null, 'Weit'][p.a - 1], ['Tight', null, 'Wide'][p.a - 1]] : null, p.m ? ['Hin und zurück', 'Out and back'] : null, p.r ? [null, 'Außenseite', 'Innenseite', 'Schwacher Fuß'][p.r] && [[null, 'Außenseite', 'Innenseite', 'Schwacher Fuß'][p.r], [null, 'Outside foot', 'Inside foot', 'Weaker foot'][p.r]] : null].filter(Boolean),
      min: 2, max: 2, minutes: base.minutes + (p.m ? 2 : 0) + (n === 7 ? 1 : 0),
      equipment: [['Bälle', 2], ['Hütchen', n * 2]], ages: base.ages,
      extraCoaching: task || '',
    };
  },
};

export const FAMILIES = [PASS, RONDO, SLALOM];
const byBase = new Map(FAMILIES.map(f => [f.base, f]));
export const familyOf = id => byBase.get(String(id).split(SEP)[0]) || null;
export const isVariantId = id => typeof id === 'string' && id.includes(SEP);
export const defaults = fam => Object.fromEntries(fam.params.map(q => [q.k, q.def]));

/** Kennung → { fam, p } oder null (unbekannte Grundübung, Schlüssel oder Werte). */
export function parseVariantId(id) {
  if (!isVariantId(id)) return null;
  const [base, rest, ...more] = id.split(SEP), fam = byBase.get(base);
  if (!fam || more.length || !/^([a-z]\d)(\.[a-z]\d)*$/.test(rest || '')) return null;
  const p = defaults(fam), seen = new Set();
  for (const part of rest.split('.')) {
    const k = part[0], v = Number(part.slice(1)), q = fam.params.find(x => x.k === k);
    if (!q || seen.has(k) || !q.opts.some(o => o[0] === v)) return null;
    seen.add(k); p[k] = v;
  }
  return { fam, p };
}
/** Einstellungen → Kennung (Standardwerte entfallen; alles auf Standard = Grundübung). */
export function variantId(fam, p0) {
  const p = fam.norm({ ...defaults(fam), ...p0 });
  const parts = fam.params.filter(q => p[q.k] !== q.def).map(q => q.k + p[q.k]);
  return parts.length ? fam.base + SEP + parts.join('.') : fam.base;
}
export const variantParams = id => { const f = familyOf(id); if (!f) return null; return parseVariantId(id)?.p || defaults(f); };

const cache = new Map();
/** Fertige Übung (Kopie der Grundübung mit eigener Choreografie, Text und Material) oder null. */
export function buildVariant(id, baseEx) {
  const hit = parseVariantId(id); if (!hit || !baseEx) return null;
  const key = id + '|' + getLang() + '|' + baseEx.name;
  if (cache.has(key)) return cache.get(key);
  const { fam } = hit, p = fam.norm({ ...hit.p });
  if (variantId(fam, p) !== id) return null; // nicht kanonisch (z. B. 2 Bälle im Dreieck)
  const v = fam.build(p, baseEx);
  v.script.name = T(...fam.title);
  const parts = v.nameParts.map(x => (getLang() === 'en' ? x[1] : x[0])).filter(Boolean);
  const out = {
    ...baseEx, id, variantOf: fam.base, variantParams: p, name: [T(...fam.title), ...parts].join(' · ').slice(0, 80),
    script: v.script, steps: v.steps, description: v.steps.join(' '), min: v.min, max: v.max, minutes: v.minutes, equipment: v.equipment, ages: v.ages,
    coaching: [baseEx.coaching, v.extraCoaching].filter(Boolean).join(' '),
    safety: [baseEx.safety, T('Variante: TRAINR-Anpassung der Grundübung, Maße und Dauer sind Vorschläge.', 'Variant: TRAINR adaptation of the base exercise, sizes and duration are suggestions.')].filter(Boolean).join(' '),
  };
  delete out.variants;
  cache.set(key, out);
  return out;
}

/** Spielzug-Skript → eigene Skizze (Format V2 aus dem Editor), damit „Als eigene Übung“ die Animation behält.
 *  Zonen, Linien und Felder des Skripts gibt es im Editor nicht; sie entfallen. Zu lange Abläufe werden auf 20 Schritte gekürzt. */
export function scriptToAnimation(sc, steps = []) {
  const OFF = [11, 3], cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const items = [], pos = [];
  const add = (k, x, y) => { items.push({ k }); pos.push([x, y]); };
  for (const [k, ...a] of sc.obj) {
    if (k === 'cone' || k === 'mini' || k === 'goal') add(k, a[0], a[1]);
    else if (k === 'gate') { add('cone', a[0], a[1] - 12); add('cone', a[0], a[1] + 12); }
    else if (k === 'gateh') { add('cone', a[0] - 12, a[1]); add('cone', a[0] + 12, a[1]); }
  }
  const P0 = items.length;
  sc.pl.forEach(([x, y, l, op]) => add(l === 'K' ? 'k' : op ? 'b' : 'a', x, y));
  const owner = {}, B0 = items.length;
  sc.balls.forEach((b, i) => { if (Array.isArray(b)) add('ball', b[0], b[1]); else { add('ball', sc.pl[b][0] + OFF[0], sc.pl[b][1] + OFF[1]); owner[b] = B0 + i; } });
  if (items.length > 30) return null;
  const snap = () => pos.map(p => [cl(Math.round(p[0]), 10, 310), cl(Math.round(p[1]), 10, 180)]);
  const raw = [{ points: snap(), step: 0, kind: 'start' }];
  for (const [step, , src] of sc.ph) {
    const moves = src.split(';').map(x => x.trim()).filter(Boolean).map(m => { const [h, ...r] = m.split(/\s+/); return { op: h[0], h: h.slice(1), r }; });
    let kind = 'move';
    for (const m of moves) if (m.op === 'r' || m.op === 'd') { const i = P0 + Number(m.h); pos[i] = [Number(m.r[0]), Number(m.r[1])]; if (m.op === 'd' && owner[Number(m.h)] !== undefined) pos[owner[Number(m.h)]] = [pos[i][0] + OFF[0], pos[i][1] + OFF[1]]; if (m.op === 'd' && kind === 'move') kind = 'dribble'; }
    for (const m of moves) if (m.op === 'p') { const [f, t] = m.h.split('>').map(Number), b = owner[f]; if (b === undefined) continue; const q = pos[P0 + t]; pos[b] = [q[0] + OFF[0], q[1] + OFF[1]]; delete owner[f]; owner[t] = b; kind = 'pass'; }
    for (const m of moves) if (m.op === 'p') { const [, t] = m.h.split('>').map(Number); const b = owner[t]; if (b !== undefined) pos[b] = [pos[P0 + t][0] + OFF[0], pos[P0 + t][1] + OFF[1]]; }
    raw.push({ points: snap(), step, kind });
  }
  // Auf 20 Schritte kürzen: zuerst jeden zweiten reinen Dribbel-/Laufschritt streichen.
  let fr = raw;
  while (fr.length > 20) {
    const idx = fr.map((f, i) => (i > 0 && i < fr.length - 1 && f.kind !== 'pass' && fr[i + 1].kind === f.kind ? i : -1)).filter(i => i >= 0);
    const drop = idx.length ? idx.filter((_, j) => j % 2 === 0) : [fr.length - 2];
    fr = fr.filter((_, i) => !drop.includes(i));
  }
  const cap = s => String(s || '').slice(0, 180) || '-';
  return { version: 2, camera: 'auto', items, frames: fr.map((f, i) => ({ seconds: i === 0 ? 1 : f.kind === 'pass' ? 1 : 1, caption: cap(i === 0 ? steps[0] : steps[f.step]), points: f.points })) };
}
