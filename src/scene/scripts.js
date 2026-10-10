// Spielzug-Skripte (V21.5): eigene Choreografie je Übung statt der allgemeinen Abläufe je Aufbau-Art.
// Platz 320 x 190, Spielfeld 20–300 x 18–172. Schematisch, nicht maßstabsgetreu.
//
// Skript: { name, obj, pl, balls, ph }
//   obj   [['cone',x,y] | ['gate',x,y] | ['gateh',x,y] | ['mini',x,y] | ['goal',x,y] | ['zone',x,y,w,h,text] | ['line',x1,y1,x2,y2] | ['box',x,y,w,h]]
//   pl    [[x, y, label, gegner?]] – Label „K“ = Keeper
//   balls Einträge: Spielerindex (führt den Ball) oder [x, y] (freier Ball). Ball i heißt b<i>.
//   ph    [[schritt, pause, 'zug; zug; …']] – schritt = Index im Ablauf, der während dieser Phase hervorgehoben wird
// Züge:  d3 x y [tempo]  dribbeln (mit eigenem Ball)     r3 x y [tempo]  laufen ohne Ball
//        p3>5 [tempo]    passen zu Spieler 5             s3 x y [tempo]  schießen/spielen auf einen Punkt (Ball wird frei)
//        k3 x y          vorlegen und nachlaufen          b2 x y [tempo]  freien Ball 2 bewegen
//        g3 2            Spieler 3 übernimmt Ball 2 (ohne Bewegung)
// Tempo: walk shuffle jog dribble sprint roll toss chip pass shot
const OFF = [11, 3];

/** Übersetzt ein Skript in das Ablaufformat von motion.js ({ balls, events }). */
export function scriptPlan(sc) {
  const owner = {}, balls = [];
  sc.balls.forEach((b, i) => {
    const id = 'b' + i;
    if (Array.isArray(b)) balls.push([id, b[0], b[1]]);
    else { const p = sc.pl[b]; balls.push([id, p[0] + OFF[0], p[1] + OFF[1]]); owner[b] = id; }
  });
  const events = sc.ph.map(([s, hold, src]) => {
    const m = [];
    for (const raw of src.split(';').map(x => x.trim()).filter(Boolean)) {
      const [head, ...rest] = raw.split(/\s+/), op = head[0];
      if (op === 'p') {
        const [from, to] = head.slice(1).split('>').map(Number), b = owner[from];
        if (!b) throw new Error(`Skript: Spieler ${from} hat keinen Ball (${raw})`);
        m.push({ a: b, to: 'p' + to, sp: rest[0] || 'pass' }); delete owner[from]; owner[to] = b;
        continue;
      }
      const i = Number(head.slice(1)), [x, y] = rest.map(Number), sp = rest[2];
      if (op === 'd') { const b = owner[i]; if (!b) throw new Error(`Skript: Spieler ${i} hat keinen Ball (${raw})`); m.push({ a: 'p' + i, x, y, sp: sp || 'dribble', carry: b }); }
      else if (op === 'r') m.push({ a: 'p' + i, x, y, sp: sp || 'jog' });
      else if (op === 's') { const b = owner[i]; if (!b) throw new Error(`Skript: Spieler ${i} hat keinen Ball (${raw})`); m.push({ a: b, x, y, sp: sp || 'shot', abs: true }); delete owner[i]; }
      else if (op === 'k') { const b = owner[i]; m.push({ a: b, x, y, sp: 'pass', abs: true }, { a: 'p' + i, x: x - OFF[0], y: y - OFF[1], sp: 'sprint' }); }
      else if (op === 'b') m.push({ a: 'b' + i, x, y, sp: sp || 'roll', abs: true });
      else if (op === 'g') { for (const k in owner) if (owner[k] === 'b' + rest[0]) delete owner[k]; owner[i] = 'b' + rest[0]; }
      else throw new Error(`Skript: unbekannter Zug ${raw}`);
    }
    return { m, hold, s };
  });
  return { balls, extras: [], events };
}

export const SCRIPTS = {
  // ================= Neue Übungen V21.5 =================
  'v22-zauberer': {
    name: 'Zauberer jagen · Steine erlösen',
    obj: [['cone', 30, 28], ['cone', 290, 28], ['cone', 30, 162], ['cone', 290, 162]],
    pl: [[70, 60, '1'], [120, 130, '2'], [230, 60, '3'], [240, 140, '4'], [160, 95, 'Z', 1]],
    balls: [0, 1, 2, 3],
    ph: [
      [1, .1, 'd0 110 45; d1 150 145; d2 255 95; d3 200 150; r4 125 68 sprint'],
      [2, .7, 'd0 92 50 walk; r4 104 58 sprint; d1 190 140; d2 245 122; d3 170 128'],
      [3, .1, 'd2 140 68; r4 215 120; d1 215 108; d3 140 145; d0 92 50 walk'],
      [3, .4, 'k2 72 50; d1 240 80; d3 120 120'],
      [4, .6, 'd0 140 112; d2 60 115; d1 255 60; d3 230 150; r4 170 92 walk'],
    ],
  },
  'v22-bruecke': {
    name: 'Brücke · ein Wächter',
    obj: [['zone', 135, 18, 50, 154, 'BRÜCKE']],
    pl: [[50, 50, '1'], [50, 95, '2'], [50, 140, '3'], [160, 95, 'W', 1]],
    balls: [0, 1, 2],
    ph: [
      [1, .1, 'd0 120 55; d1 120 95; d2 120 135; r3 160 100 walk'],
      [2, .2, 'd0 200 45; d1 152 98; d2 205 140; r3 160 102 sprint'],
      [3, .1, 's1 128 160 pass; d0 270 50; d2 270 140'],
      [3, .2, 'r1 117 157 sprint; r3 160 95 walk'],
      [4, .6, 'g1 1; d1 50 95; d0 270 95; d2 250 150'],
    ],
  },
  'v22-farbstart': {
    name: 'Farbsignal · Sprint · Duell',
    obj: [['mini', 288, 95], ['mini', 32, 95], ['cone', 110, 45], ['cone', 210, 45], ['cone', 110, 145], ['cone', 210, 145]],
    pl: [[150, 165, '1'], [170, 165, '2', 1]],
    balls: [[160, 95]],
    ph: [
      [1, .0, 'r0 104 52 sprint; r1 216 52 sprint'],
      [1, .0, 'r0 135 80 sprint; r1 190 80 sprint'],
      [2, .0, 'r0 149 92 sprint; r1 176 91 sprint'],
      [2, .1, 'g0 0; d0 225 80; r1 212 92 sprint'],
      [2, .1, 'd0 258 100; r1 244 108 sprint'],
      [2, .8, 's0 291 95'],
    ],
  },
  'v22-slalom': {
    name: 'Slalom · Pass · Seitenwechsel',
    obj: [['cone', 50, 95], ['cone', 65, 95], ['cone', 80, 95], ['cone', 95, 95], ['cone', 110, 95], ['cone', 210, 95], ['cone', 225, 95], ['cone', 240, 95], ['cone', 255, 95], ['cone', 270, 95]],
    pl: [[30, 95, 'A'], [290, 95, 'B']],
    balls: [0],
    ph: [
      [1, 0, 'd0 46 80'], [1, 0, 'd0 61 106'], [1, 0, 'd0 76 80'], [1, 0, 'd0 91 106'], [1, .1, 'd0 120 92'],
      [2, .1, 'p0>1; r0 150 60 sprint'],
      [3, 0, 'd1 263 80; r0 230 55 sprint'], [3, 0, 'd1 248 106; r0 285 70 sprint'], [3, 0, 'd1 233 80'], [3, 0, 'd1 218 106'], [3, .2, 'd1 192 92; r0 290 95 walk'],
      [4, .6, 'p1>0'],
    ],
  },
  'v22-1v1keeper': {
    name: 'Angreifer · Verteidiger · Keeper',
    obj: [['goal', 293, 95], ['box', 235, 45, 65, 100]],
    pl: [[60, 70, '1'], [60, 125, 'V', 1], [282, 95, 'K', 1]],
    balls: [1],
    ph: [
      [1, .1, 'p1>0; r1 95 112 sprint'],
      [2, .0, 'd0 150 80; r1 140 102 sprint; r2 276 94 shuffle'],
      [2, .1, 'd0 198 72; r1 184 88 sprint; r2 268 91 shuffle'],
      [3, .2, 'd0 232 82; r1 220 94 sprint; r2 260 92 shuffle'],
      [3, .9, 's0 297 106; r2 262 99 sprint'],
    ],
  },
  'v22-flanke': {
    name: 'Flügel · Flanke · zwei Pfosten',
    obj: [['goal', 293, 95], ['box', 235, 45, 65, 100], ['cone', 120, 20], ['cone', 260, 20]],
    pl: [[150, 95, '1'], [150, 125, '2'], [120, 32, '3'], [282, 95, 'K', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>2; r0 200 92; r1 200 120'],
      [2, .0, 'd2 195 32; r0 222 90; r1 220 118'],
      [2, .1, 'd2 252 32; r0 238 86; r1 236 114'],
      [3, .1, 'p2>0 chip; r0 256 80 sprint; r1 262 112 sprint; r3 280 86 shuffle'],
      [3, .9, 's0 297 103'],
    ],
  },
  'v22-verlagern': {
    name: 'Zwei Felder · Verlagerung',
    obj: [['zone', 30, 35, 100, 120, 'FELD A'], ['zone', 190, 35, 100, 120, 'FELD B']],
    pl: [[42, 50, '1'], [118, 95, '2'], [42, 140, '3'], [202, 50, '4'], [278, 95, '5'], [202, 140, '6'], [75, 85, 'V', 1], [95, 115, 'V', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r6 100 80; r7 95 108'],
      [1, .1, 'p1>2; r6 92 108; r7 70 128'],
      [2, .1, 'p2>0; r6 66 88; r7 58 72'],
      [2, .2, 'p0>3 chip; r6 160 80 sprint; r7 160 110 sprint'],
      [3, .1, 'p3>4; r6 222 76 sprint; r7 232 116 sprint'],
      [4, .6, 'p4>5; r6 238 112; r7 252 86'],
    ],
  },
  'v22-3v2konter': {
    name: 'Drei gegen zwei · Konter zwei gegen eins',
    obj: [['mini', 288, 95], ['mini', 32, 95]],
    pl: [[70, 50, '1'], [60, 95, '2'], [70, 140, '3'], [230, 75, 'V', 1], [230, 115, 'V', 1]],
    balls: [1],
    ph: [
      [1, .0, 'd1 120 95; r0 130 48; r2 130 142; r3 210 86; r4 214 110'],
      [1, .1, 'p1>2; r0 180 55; r1 165 95; r3 198 100 sprint; r4 222 128 sprint'],
      [1, .1, 'p2>0; r2 200 135; r3 220 76 sprint'],
      [1, .1, 'd0 236 70; r3 246 84 sprint'],
      [1, .3, 's0 291 92'],
      [2, .1, 'b0 270 118; r4 259 115 sprint'],
      [2, .1, 'g4 0; d4 200 122; r3 205 84 sprint; r0 232 100 sprint'],
      [3, .1, 'p4>3; r0 175 92 sprint; r4 130 125'],
      [3, .1, 'd3 80 90; r0 102 96 sprint'],
      [3, .8, 's3 29 95'],
    ],
  },
  'v22-jagd': {
    name: 'Ballverlust · fünf Sekunden jagen',
    obj: [['zone', 24, 25, 34, 140, 'ZONE'], ['zone', 262, 25, 34, 140, 'ZONE']],
    pl: [[110, 60, '1'], [160, 48, '2'], [205, 95, '3'], [130, 132, '4'], [150, 92, '1', 1], [180, 130, '2', 1], [100, 100, '3', 1], [222, 55, '4', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r4 140 70; r6 118 78'],
      [1, .1, 'p1>2; r4 176 82; r7 200 70'],
      [2, .0, 'p2>5; r5 178 126'],
      [2, .1, 'd5 215 146; r2 205 130 sprint; r3 190 152 sprint; r1 198 112 sprint; r0 168 100 sprint'],
      [3, .1, 'd5 236 150; r2 228 142 sprint; r3 222 160 sprint; r1 220 128 sprint'],
      [3, .6, 'g2 0; d2 200 118; r5 232 142 walk; r6 160 90; r7 196 70'],
    ],
  },
  'v22-aufbau32': {
    name: 'Keeper + drei gegen zwei · Dribbeltore',
    obj: [['goal', 27, 95], ['gate', 287, 55], ['gate', 287, 135], ['line', 230, 22, 230, 168]],
    pl: [[40, 95, 'K'], [90, 45, '1'], [85, 145, '2'], [130, 95, '3'], [170, 70, 'A', 1], [170, 120, 'A', 1]],
    balls: [0],
    ph: [
      [1, .2, 'p0>1; r1 84 40; r4 124 56 sprint; r5 150 108'],
      [2, .1, 'p1>3; r3 135 90; r4 140 76 sprint; r5 165 100'],
      [2, .1, 'p3>2; r2 118 150; r4 150 108; r5 148 136 sprint'],
      [2, .1, 'p2>3; r3 176 96; r5 136 142'],
      [3, .7, 'd3 276 132; r4 222 124 sprint; r1 170 50'],
    ],
  },
  'v22-kanal': {
    name: 'Kanal · lenken · zwei Dribbeltore',
    obj: [['box', 50, 50, 230, 90], ['gate', 285, 85], ['gate', 285, 125]],
    pl: [[70, 95, '1'], [240, 95, 'V', 1]],
    balls: [1],
    ph: [
      [1, .1, 'p1>0; r1 172 95 sprint'],
      [2, .2, 'd0 110 98; r1 142 96 walk'],
      [2, .1, 'd0 140 116; r1 156 106 shuffle'],
      [3, .1, 'd0 205 126; r1 212 114 shuffle'],
      [3, .7, 'd0 280 125; r1 255 116'],
    ],
  },
  'v22-ypass': {
    name: 'Y-Form · dritter Mann',
    obj: [['cone', 50, 108], ['cone', 150, 108], ['cone', 250, 58], ['cone', 250, 158]],
    pl: [[50, 95, 'A'], [150, 95, 'B'], [250, 45, 'C'], [250, 145, 'D']],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r1 135 95'],
      [2, .1, 'p1>0; r0 84 95'],
      [3, .1, 'p0>2; r2 220 60 sprint; r1 165 80'],
      [3, .2, 'd2 130 42; r1 238 50'],
      [4, .6, 'd2 60 70; r0 140 95'],
    ],
  },
  'v22-kwinkel': {
    name: 'Dribbler · Keeper verkürzt',
    obj: [['goal', 293, 95], ['cone', 130, 45], ['cone', 130, 95], ['cone', 130, 145]],
    pl: [[115, 45, 'H'], [282, 95, 'K']],
    balls: [0],
    ph: [
      [1, .1, 'd0 160 60 walk; r1 279 88 shuffle'],
      [2, .1, 'd0 195 75 walk; r1 268 88 shuffle'],
      [3, .4, 'd0 214 82 walk; r1 261 90 walk'],
      [3, .8, 'p0>1 roll'],
      [4, .4, 'p1>0 roll; r1 282 95 walk'],
    ],
  },
  'v22-kabwurf': {
    name: 'Keeper · Abrollen & Abwurf in Zonen',
    obj: [['goal', 27, 95], ['zone', 170, 22, 90, 50, 'ZONE A'], ['zone', 170, 118, 90, 50, 'ZONE B']],
    pl: [[45, 95, 'K'], [205, 45, '1'], [205, 145, '2']],
    balls: [1],
    ph: [
      [1, .4, 'p1>0'],
      [2, .5, 'r0 56 95 walk'],
      [3, .2, 'p0>2 chip; r2 214 140'],
      [3, .3, 'p2>0'],
      [3, .2, 'p0>1 roll; r1 212 52'],
      [4, .5, 'r0 45 95 walk'],
    ],
  },
  'v22-kwechsel': {
    name: 'Hütchen tippen · Grundstellung · Korb',
    obj: [['goal', 293, 95], ['cone', 268, 55], ['cone', 268, 135]],
    pl: [[180, 95, 'H'], [272, 95, 'K']],
    balls: [0],
    ph: [
      [1, .1, 'r1 268 64 shuffle'], [2, .2, 'r1 268 95 shuffle'], [3, .5, 'p0>1 toss'], [3, .3, 'p1>0 roll'],
      [1, .1, 'r1 268 126 shuffle'], [2, .2, 'r1 268 95 shuffle'], [3, .5, 'p0>1 toss'], [4, .4, 'p1>0 roll'],
    ],
  },
  'v22-torejagd': {
    name: 'Vier Minitore · Tore sammeln',
    obj: [['mini', 92, 52], ['mini', 232, 52], ['mini', 92, 142], ['mini', 232, 142]],
    pl: [[45, 95, '1'], [160, 95, '2'], [275, 95, '3']],
    balls: [0, 1, 2],
    ph: [
      [1, .1, 'd0 55 62; d1 172 66; d2 262 128'],
      [1, .4, 's0 90 52 pass; s1 230 52 pass; s2 234 142 pass'],
      [2, .1, 'r0 79 49; r1 219 49; r2 223 139'],
      [2, .1, 'g0 0; g1 1; g2 2; d0 60 118; d1 178 122; d2 160 62'],
      [3, .7, 's0 90 142 pass; s1 230 142 pass; s2 92 52 pass'],
    ],
  },

  // ================= Überarbeitete Choreografien bestehender Übungen =================
  'v5-shield': {
    name: 'Ball abschirmen · Partnerdruck',
    obj: [['box', 90, 40, 140, 110]],
    pl: [[150, 95, '1'], [178, 102, 'V', 1]],
    balls: [0],
    ph: [
      [1, .2, 'd0 140 88 walk; r1 160 100 walk'],
      [1, .1, 'd0 128 72 walk; r1 146 90 shuffle'],
      [1, .1, 'd0 150 64 walk; r1 140 76 shuffle'],
      [1, .2, 'd0 176 80 walk; r1 160 64 shuffle'],
      [1, .4, 'd0 160 108 walk; r1 182 88 shuffle'],
    ],
  },
  '2v2': {
    name: 'Zwei gegen zwei · zwei Minitore',
    obj: [['mini', 288, 95], ['mini', 32, 95]],
    pl: [[80, 65, '1'], [80, 125, '2'], [230, 70, '1', 1], [230, 120, '2', 1]],
    balls: [0],
    ph: [
      [1, .0, 'd0 130 70; r1 125 135; r2 190 76; r3 205 120'],
      [1, .1, 'd0 160 82; r2 180 84 sprint; r1 170 138'],
      [1, .1, 'p0>1; r3 214 128 sprint; r0 200 70'],
      [1, .1, 'p1>0; r2 230 80 sprint; r3 220 118'],
      [1, .8, 'd0 250 88; r2 248 96 sprint'],
      [1, .7, 's0 291 95'],
    ],
  },
  '3v3': {
    name: 'Drei gegen drei · vier Minitore',
    obj: [['mini', 288, 50], ['mini', 288, 140], ['mini', 32, 50], ['mini', 32, 140]],
    pl: [[80, 50, '1'], [70, 95, '2'], [80, 140, '3'], [225, 55, '1', 1], [215, 95, '2', 1], [225, 135, '3', 1]],
    balls: [1],
    ph: [
      [1, .0, 'd1 120 95; r0 130 45; r2 135 140; r3 205 60; r4 180 92; r5 210 130'],
      [1, .1, 'p1>0; r3 190 52 sprint; r4 200 70'],
      [2, .1, 'd0 170 50; r3 196 60 sprint; r5 225 118'],
      [2, .1, 'p0>2; r2 200 140; r5 238 128 sprint; r4 220 110'],
      [2, .1, 'd2 250 145; r5 252 132 sprint'],
      [2, .8, 's2 290 140'],
    ],
  },
  'v5-rondo': {
    name: 'Drei gegen eins · Passfenster',
    obj: [['box', 55, 30, 210, 130]],
    pl: [[60, 40, '1'], [260, 40, '2'], [160, 152, '3'], [155, 92, 'V', 1]],
    balls: [0],
    ph: [
      [1, .2, 'p0>1; r3 200 70; r2 120 152'],
      [1, .2, 'p1>2; r3 175 110 sprint; r0 60 100'],
      [1, .2, 'p2>0; r3 120 110; r1 260 120'],
      [1, .2, 'p0>1; r3 175 80 sprint; r2 175 152'],
      [1, .4, 'p1>2; r3 205 120'],
    ],
  },
  'v5-rondo42': {
    name: 'Vier gegen zwei · gemeinsam zustellen',
    obj: [['box', 45, 30, 230, 130]],
    pl: [[50, 40, '1'], [270, 40, '2'], [270, 150, '3'], [50, 150, '4'], [140, 85, 'V', 1], [185, 110, 'V', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r4 205 60 sprint; r5 210 100'],
      [1, .1, 'p1>2; r4 240 95 sprint; r5 195 140'],
      [1, .1, 'p2>3; r4 190 120; r5 120 150 sprint'],
      [1, .1, 'p3>0; r5 80 110 sprint; r4 130 70'],
      [1, .4, 'p0>2; r4 210 120 sprint; r5 160 130'],
    ],
  },
  'v21-zehnvier': {
    name: 'Zehn gegen vier · durch die Mitte',
    obj: [['box', 40, 25, 240, 140], ['zone', 120, 60, 80, 70, 'MITTE']],
    pl: [[50, 40, '1'], [160, 30, '2'], [270, 40, '3'], [275, 95, '4'], [270, 150, '5'], [160, 160, '6'], [50, 150, '7'], [45, 95, '8'], [135, 95, '9'], [190, 82, '10'], [110, 60, 'V', 1], [210, 60, 'V', 1], [110, 130, 'V', 1], [210, 130, 'V', 1]],
    balls: [7],
    ph: [
      [1, .1, 'p7>0; r10 90 55; r12 80 110'],
      [1, .1, 'p0>1; r10 140 45; r11 180 45'],
      [2, .2, 'p1>8; r10 130 75 sprint; r12 120 115'],
      [2, .2, 'p8>5; r12 140 140; r13 190 140'],
      [3, .5, 'p5>3; r13 245 120 sprint; r11 240 75'],
    ],
  },
  'v21-firsttouch': {
    name: 'Pass · erster Kontakt · Duell',
    obj: [['mini', 288, 95], ['mini', 32, 95], ['box', 40, 40, 240, 110]],
    pl: [[90, 95, 'B'], [230, 95, 'A', 1]],
    balls: [1],
    ph: [
      [1, .0, 'p1>0; r1 180 95 sprint'],
      [2, .0, 'd0 128 72; r1 160 84 sprint'],
      [2, .1, 'd0 190 64; r1 186 78 sprint'],
      [2, .2, 'd0 238 80; r1 225 90 sprint'],
      [2, .5, 's0 291 95'],
      [4, .5, 'r1 230 95 walk; r0 90 95 walk'],
    ],
  },
  'v5-1v1line': {
    name: 'Angriff · seitlich stellen · Konter',
    obj: [['line', 40, 30, 40, 160], ['line', 280, 30, 280, 160]],
    pl: [[70, 95, '1'], [200, 95, 'V', 1]],
    balls: [0],
    ph: [
      [1, .1, 'd0 130 100; r1 168 98 walk'],
      [2, .1, 'd0 150 72; r1 162 82 shuffle'],
      [2, .1, 'd0 166 62; r1 162 66 sprint'],
      [2, .1, 'g1 0; d1 120 80; r0 150 70 sprint'],
      [2, .7, 'd1 32 92; r0 70 90 sprint'],
    ],
  },
  'v5-wall': {
    name: 'Pass · Lauf · Rückpass',
    obj: [['cone', 160, 95], ['box', 40, 45, 240, 100]],
    pl: [[70, 112, '1'], [205, 82, '2']],
    balls: [0],
    ph: [
      [1, .1, 'p0>1'],
      [1, .1, 'r0 150 128 sprint'],
      [1, .1, 'p1>0; r0 180 125 sprint'],
      [1, .3, 'd0 255 110; r1 205 70 walk'],
      [1, .6, 'd0 268 90'],
    ],
  },
  traffic: {
    name: 'Grün · Gelb · Rot',
    obj: [['zone', 230, 26, 62, 34, 'SIGNAL'], ['cone', 30, 28], ['cone', 30, 162], ['cone', 290, 162]],
    pl: [[65, 65, '1'], [150, 120, '2'], [225, 140, '3']],
    balls: [0, 1, 2],
    ph: [
      [1, .1, 'd0 120 52; d1 200 110; d2 150 150'],
      [2, .1, 'd0 180 70; d1 245 92; d2 90 140'],
      [2, .3, 'd0 200 90 walk; d1 250 120 walk; d2 70 120 walk'],
      [2, .9, 'd0 204 94 walk; d1 252 124 walk; d2 66 116 walk'],
      [3, .5, 'd0 120 120; d1 190 60; d2 80 60'],
    ],
  },
};
export const SCRIPT_IDS = new Set(Object.keys(SCRIPTS));
