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
"gk-gateroll": {"name": "Zwei Keeper · Rollen durch Tore", "obj": [["gate", 160, 65], ["gate", 160, 135]], "pl": [[85, 65, "K"], [235, 65, "K"]], "balls": [0], "ph": [[0, .7, "p0>1 roll"], [1, .8, "r0 85 135 jog;r1 235 135 jog"], [1, .7, "p1>0 roll"], [1, .8, "r0 85 65 jog;r1 235 65 jog"]]},
"gk-gatepass": {"name": "Zwei Keeper · Passen durch Tore", "obj": [["gate", 160, 65], ["gate", 160, 135]], "pl": [[85, 65, "K"], [235, 65, "K"]], "balls": [0], "ph": [[0, .7, "p0>1 pass"], [1, .8, "r0 85 135 jog;d1 235 135 dribble"], [2, .7, "p1>0 pass"], [1, .8, "d0 85 65 dribble;r1 235 65 jog"]]},
"gk-rectangle": {"name": "Partner-Rechteck · Ball sichern", "obj": [["cone", 85, 50], ["cone", 235, 50], ["cone", 85, 145], ["cone", 235, 145]], "pl": [[85, 65, "K"], [235, 65, "K"]], "balls": [0], "ph": [[0, .7, "p0>1 roll"], [1, .8, "r0 85 130 jog;d1 235 130 walk"], [2, .7, "p1>0 roll"], [1, .8, "d0 85 65 walk;r1 235 65 jog"]]},
"gk-strike": {"name": "Zwei Keeper · Besonderen Ball erkennen", "obj": [["goal", 285, 95]], "pl": [[70, 95, "K"], [260, 95, "K"]], "balls": [0, [80, 45], [80, 65], [80, 125], [80, 145]], "ph": [[0, .7, "p0>1 roll"], [1, .9, "p1>0 roll"], [2, .7, "s0 295 95 roll"], [2, .9, "b0 81 98 roll;g0 0"]]},
"gk-steps": {"name": "Trainer · Keeper · Rollenwechsel", "obj": [["goal", 285, 95], ["gate", 220, 70], ["gate", 220, 120]], "pl": [[80, 95, "T"], [240, 70, "K"], [260, 155, "K"]], "balls": [0], "ph": [[0, .8, "r1 220 120 shuffle"], [0, .8, "r1 240 70 shuffle"], [1, .7, "p0>1 toss"], [2, .7, "p1>0 roll"]]},
"gk-handball": {"name": "Torwart-Handball · Trainer spielt zu", "obj": [["goal", 35, 95], ["goal", 285, 95]], "pl": [[160, 95, "T"], [60, 95, "K"], [260, 95, "K"]], "balls": [0, [150, 80], [150, 112]], "ph": [[0, .7, "p0>1 roll"], [1, .7, "s1 285 95 chip"], [0, .7, "g0 1"], [0, .7, "p0>2 roll"], [1, .7, "s2 35 95 chip"]]},
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

  // ================= Neue Übungen V21.6 =================
  'v22-leibchenjagd': {
    name: 'Leibchen ziehen · Ball behalten',
    obj: [['cone', 30, 28], ['cone', 290, 28], ['cone', 30, 162], ['cone', 290, 162]],
    pl: [[60, 60, '1'], [120, 130, '2'], [220, 60, '3'], [240, 135, '4']],
    balls: [0, 1, 2, 3],
    ph: [
      [1, .1, 'd0 100 72; d1 150 120; d2 200 82; d3 215 130'],
      [2, .1, 'd0 150 95; d1 165 106; d2 172 92; d3 188 118'],
      [3, .2, 'd0 125 62; d1 120 138; d2 235 62; d3 255 120'],
      [4, .5, 'd0 80 100 walk; d1 200 130 walk; d2 150 55 walk; d3 255 100 walk'],
    ],
  },
  'v22-tunnelwaechter': {
    name: 'Ball durch den Tunnel',
    obj: [['cone', 30, 28], ['cone', 290, 28], ['cone', 30, 162], ['cone', 290, 162]],
    pl: [[60, 60, '1'], [60, 130, '2'], [250, 70, '3'], [170, 60, 'W', 1], [170, 130, 'W', 1]],
    balls: [0, 1],
    ph: [
      [1, .1, 'd0 110 75; d1 110 125; r3 168 64 shuffle; r4 168 126 shuffle'],
      [2, .1, 's0 205 64 pass; r0 150 66'],
      [2, .1, 'r0 205 66 sprint'],
      [3, .1, 'g0 0; d0 255 70; s1 205 128 pass; r1 150 128'],
      [3, .1, 'r1 205 130 sprint'],
      [4, .6, 'g1 1; d1 255 150; r3 150 70 walk; r4 180 120 walk'],
    ],
  },
  'v22-huetchenraub': {
    name: 'Hütchen holen · Ball behalten',
    obj: [['zone', 24, 25, 50, 140, 'HEIM'], ['zone', 246, 25, 50, 140, 'HEIM']],
    pl: [[50, 60, '1'], [50, 130, '2'], [270, 60, '1', 1], [270, 130, '2', 1]],
    balls: [0, 1, 2, 3],
    ph: [
      [1, .1, 'd0 150 70; d1 150 120; d2 170 70; d3 170 120'],
      [2, .1, 'd0 255 62; d1 255 124; d2 70 64; d3 70 128'],
      [3, .1, 'd0 200 100; d1 195 90; d2 130 100; d3 125 135'],
      [4, .5, 'd0 70 80 walk; d1 70 125 walk; d2 262 80 walk; d3 262 125 walk'],
    ],
  },
  'v22-achter': {
    name: 'Acht um zwei Hütchen',
    obj: [['cone', 85, 55], ['cone', 235, 55], ['cone', 85, 135], ['cone', 235, 135]],
    pl: [[160, 55, '1'], [160, 135, '2']],
    balls: [0, 1],
    ph: [
      [1, 0, 'd0 205 40; d1 205 120'],
      [1, 0, 'd0 238 55; d1 238 135'],
      [1, 0, 'd0 205 72; d1 205 152'],
      [1, .1, 'd0 160 55; d1 160 135'],
      [2, 0, 'd0 115 40; d1 115 120'],
      [2, 0, 'd0 82 55; d1 82 135'],
      [2, 0, 'd0 115 72; d1 115 152'],
      [2, .1, 'd0 160 55; d1 160 135'],
      [3, 0, 'd0 205 72; d1 205 152'],
      [3, .1, 'd0 238 55; d1 238 135'],
      [4, .5, 'd0 205 38 sprint; d1 205 118 sprint'],
    ],
  },
  'v22-sohlenzug': {
    name: 'Sohlenzug · Drehung · weiter',
    obj: [['cone', 70, 95], ['cone', 115, 95], ['cone', 160, 95], ['cone', 205, 95], ['cone', 250, 95]],
    pl: [[35, 95, '1']],
    balls: [0],
    ph: [
      [1, 0, 'd0 66 82'],
      [1, .1, 'd0 55 100 walk'],
      [2, 0, 'd0 110 84'],
      [2, 0, 'd0 100 100 walk'],
      [2, 0, 'd0 155 84'],
      [2, .1, 'd0 145 100 walk'],
      [3, 0, 'd0 200 84'],
      [3, .1, 'd0 245 84'],
      [3, 0, 'd0 235 102 walk'],
      [3, .1, 'd0 190 98'],
      [4, .5, 'd0 40 95 sprint'],
    ],
  },
  'v22-hasefuchs': {
    name: 'Hase dribbelt · Fuchs jagt',
    obj: [['gate', 35, 40], ['gate', 285, 40], ['gate', 160, 150]],
    pl: [[80, 70, 'H'], [60, 70, 'F', 1], [230, 130, 'H'], [210, 130, 'F', 1]],
    balls: [0, 2],
    ph: [
      [1, .1, 'd0 130 75 jog; r1 110 74 jog; d2 190 120 jog; r3 170 122 jog'],
      [2, .1, 'd0 160 110 sprint; r1 140 100 sprint; d2 235 90 sprint; r3 215 100 sprint'],
      [3, .2, 'd0 120 135 jog; r1 128 120 sprint; d2 270 130 jog; r3 255 118 sprint'],
      [4, .5, 'p0>1 roll; p2>3 roll'],
    ],
  },
  'v22-quadrat': {
    name: 'Pass und Nachlaufen im Quadrat',
    obj: [['cone', 60, 50], ['cone', 200, 50], ['cone', 200, 140], ['cone', 60, 140]],
    pl: [[60, 50, 'A'], [200, 50, 'B'], [200, 140, 'C'], [60, 140, 'D']],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r0 185 50'],
      [2, .1, 'p1>2; r1 185 140'],
      [2, .1, 'p2>3; r2 78 140'],
      [2, .1, 'p3>0; r3 75 52'],
      [3, .3, 'p0>3; r0 90 128'],
      [4, .5, 'p3>2; r3 195 135'],
    ],
  },
  'v22-kurzlang': {
    name: 'Kurz · Ablage · langer Ball',
    obj: [['cone', 40, 108], ['cone', 110, 108], ['zone', 240, 65, 60, 60, 'ZONE']],
    pl: [[40, 95, 'A'], [110, 95, 'B'], [270, 95, 'C']],
    balls: [0],
    ph: [
      [1, .1, 'p0>1'],
      [2, .1, 'p1>0; r0 70 92'],
      [3, .2, 'p0>2 chip; r0 80 92'],
      [4, .1, 'd2 200 100'],
      [4, .5, 'd2 80 100; r0 40 95 walk; r1 80 95 walk'],
    ],
  },
  'v22-staffel': {
    name: 'Zwei Reihen · Pass und Lauf nach hinten',
    obj: [['cone', 40, 40], ['cone', 40, 150], ['cone', 110, 40], ['cone', 110, 150], ['cone', 200, 40], ['cone', 200, 150], ['cone', 270, 40], ['cone', 270, 150]],
    pl: [[40, 70, '1'], [40, 120, '2'], [110, 70, '3'], [110, 120, '4'], [200, 70, '1', 1], [200, 120, '2', 1], [270, 70, '3', 1], [270, 120, '4', 1]],
    balls: [0, 4],
    ph: [
      [1, .1, 'p0>2; r0 120 135; p4>6; r4 280 135'],
      [2, .1, 'p2>1; r2 40 135; p6>5; r6 190 135'],
      [2, .1, 'p1>3; r1 100 138; p5>7; r5 262 138'],
      [3, .3, 'r3 110 70; r7 270 70'],
      [4, .5, 'p3>0; p7>4'],
    ],
  },
  'v22-fuenfeck': {
    name: 'Fünf Positionen · zwei Bälle',
    obj: [['cone', 160, 33], ['cone', 219, 76], ['cone', 196, 145], ['cone', 124, 145], ['cone', 101, 76]],
    pl: [[160, 40, '1'], [212, 80, '2'], [192, 138, '3'], [128, 138, '4'], [108, 80, '5']],
    balls: [0, 2],
    ph: [
      [1, .1, 'p0>1; p2>3'],
      [1, .1, 'p1>2; p3>4'],
      [1, .1, 'p2>3; p4>0'],
      [2, .2, 'p3>2; p0>4'],
      [2, .1, 'p2>1; p4>3'],
      [3, .1, 'p3>0; p1>3'],
      [3, .1, 'p0>2; p3>1'],
      [4, .5, 'p2>4; p1>0'],
    ],
  },
  'v22-zielschuss': {
    name: 'Dribbeln · Marke · Ziel treffen',
    obj: [['mini', 288, 95], ['cone', 286, 82], ['cone', 286, 95], ['cone', 286, 108], ['cone', 210, 95]],
    pl: [[60, 95, '1'], [60, 145, '2']],
    balls: [0, 1],
    ph: [
      [1, .1, 'd0 140 95'],
      [1, .2, 'd0 205 95; r1 60 120 walk'],
      [2, .8, 's0 285 82 shot'],
      [3, .2, 'r0 200 95 jog'],
      [3, .1, 'd1 205 100'],
      [4, .8, 's1 285 108 shot; r0 60 95 walk'],
    ],
  },
  'v22-querpass': {
    name: 'Dribbeln · Querpass · Abschluss',
    obj: [['goal', 293, 95], ['box', 235, 45, 65, 100]],
    pl: [[150, 45, '1'], [170, 130, '2'], [282, 95, 'K', 1]],
    balls: [0],
    ph: [
      [1, .1, 'd0 210 52; r1 220 112; r2 276 90 shuffle'],
      [2, .1, 'd0 252 62; r1 245 94 sprint; r2 270 86 shuffle'],
      [3, 0, 'p0>1 pass; r2 268 78 shuffle'],
      [3, .9, 's1 297 112; r2 264 100 sprint'],
      [4, .4, 'r0 200 95 walk; r1 200 140 walk'],
    ],
  },
  'v22-nachschuss': {
    name: 'Schuss · Abpraller · Nachschuss',
    obj: [['goal', 293, 95], ['box', 235, 45, 65, 100]],
    pl: [[170, 80, '1'], [170, 115, '2'], [282, 95, 'K', 1]],
    balls: [0],
    ph: [
      [1, .1, 'd0 208 84; r1 200 112; r2 276 92 shuffle'],
      [1, .1, 's0 262 92 shot; r2 266 100 sprint'],
      [2, .2, 'b0 244 118 roll; r1 235 112 sprint; r2 262 108 shuffle'],
      [3, .1, 'g1 0; s1 297 90'],
      [4, .5, 'r0 170 80 walk; r1 170 115 walk; r2 282 95 walk'],
    ],
  },
  'v22-dreizonen': {
    name: 'Drei Zonen · vier gegen vier',
    obj: [['zone', 20, 25, 93, 140, 'ZONE 1'], ['zone', 113, 25, 94, 140, 'ZONE 2'], ['zone', 207, 25, 93, 140, 'ZONE 3'], ['mini', 288, 95], ['mini', 32, 95]],
    pl: [[50, 115, '1'], [140, 70, '2'], [140, 125, '3'], [245, 80, '4'], [75, 78, '1', 1], [175, 72, '2', 1], [175, 122, '3', 1], [270, 112, '4', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r5 160 78; r4 75 90 walk'],
      [2, .1, 'p1>2; r6 160 108 shuffle'],
      [3, .1, 'p2>3; r7 262 110 shuffle'],
      [4, .1, 'd3 262 90; r7 268 100 shuffle'],
      [4, .8, 's3 289 95'],
    ],
  },
  'v22-zweiball': {
    name: 'Zwei Bälle · vier Tore',
    obj: [['mini', 32, 70], ['mini', 32, 120], ['mini', 288, 70], ['mini', 288, 120]],
    pl: [[90, 70, '1'], [120, 125, '2'], [180, 95, '3'], [80, 100, '4'], [230, 70, '1', 1], [200, 120, '2', 1], [150, 100, '3', 1], [255, 100, '4', 1]],
    balls: [0, 5],
    ph: [
      [1, .1, 'p0>2; d5 165 118; r6 168 92 sprint; r4 215 78; r1 130 120'],
      [2, .1, 'd2 228 98; r6 220 96 sprint; p5>6'],
      [3, .1, 'd6 190 100; r7 245 108; r3 140 90'],
      [3, .1, 'p2>3 pass; r3 150 96'],
      [4, .8, 's6 33 120'],
    ],
  },
  'v22-alleball': {
    name: 'Alle vier am Ball · dann Tor',
    obj: [['mini', 32, 95], ['mini', 288, 95]],
    pl: [[70, 60, '1'], [110, 130, '2'], [160, 80, '3'], [200, 110, '4'], [140, 60, '1', 1], [130, 120, '2', 1], [200, 70, '3', 1], [230, 130, '4', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r4 100 68; r5 125 125'],
      [2, .1, 'p1>2; r1 135 120; r6 180 78 sprint'],
      [2, .1, 'p2>3; r2 185 75; r7 215 125'],
      [3, .1, 'p3>0; r0 150 62'],
      [4, .1, 'p0>2; r2 230 90'],
      [4, 0, 'd2 266 95'],
      [4, .8, 's2 289 95'],
    ],
  },
  'v22-pfiff': {
    name: 'Normal spielen · Pfiff · Tore tauschen',
    obj: [['mini', 288, 95], ['mini', 32, 95]],
    pl: [[90, 60, '1'], [100, 130, '2'], [150, 95, '3'], [60, 95, '4'], [200, 60, '1', 1], [210, 130, '2', 1], [240, 95, '3', 1], [170, 95, '4', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>2; r4 160 72; r7 140 100'],
      [2, .1, 'p2>1; r1 125 118'],
      [2, .1, 'd1 170 118; r7 160 105 sprint'],
      [3, .3, 'p1>2 pass; r2 120 95; r4 135 90 sprint; r5 175 115 sprint'],
      [4, .1, 'd2 70 95; r0 80 60; r5 100 110 sprint'],
      [4, .6, 's2 34 95'],
    ],
  },
  'v22-rueckspurt': {
    name: 'Ballverlust · Rückspurt · Konter',
    obj: [['line', 170, 18, 170, 172], ['mini', 288, 95], ['mini', 32, 95]],
    pl: [[90, 70, '1'], [110, 125, '2'], [150, 95, '3'], [70, 95, '4'], [210, 70, '1', 1], [230, 125, '2', 1], [190, 95, '3', 1], [260, 95, '4', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>2; r2 165 92; r4 190 78'],
      [2, .1, 'p2>6 pass; r6 175 96 sprint'],
      [2, .1, 'r2 150 95 sprint; r1 150 125 sprint; r3 120 95'],
      [3, .1, 'd6 130 90 ; r7 220 100 sprint; r4 150 70 sprint'],
      [3, .1, 'p6>4 pass; r4 100 95 sprint'],
      [4, 0, 'd4 70 95 sprint'],
      [4, .8, 's4 34 95'],
    ],
  },
  'v22-kette': {
    name: 'Verteidiger verschieben als Kette',
    obj: [['cone', 120, 22], ['cone', 120, 168], ['cone', 200, 22], ['cone', 200, 168]],
    pl: [[160, 40, '1'], [160, 75, '2'], [160, 110, '3'], [160, 145, '4'], [60, 55, 'A', 1], [60, 135, 'B', 1]],
    balls: [4],
    ph: [
      [1, .1, 'p4>5; r0 162 55; r1 162 90; r2 162 125; r3 162 158'],
      [2, .1, 'p5>4; r0 160 40; r1 160 75; r2 160 110; r3 160 145'],
      [2, .1, 'r0 150 45; r1 160 70; r2 162 105; r3 164 140'],
      [3, .1, 'd4 105 70; r0 140 55; r1 148 82; r2 150 112; r3 150 145'],
      [3, .1, 'r0 118 58; r1 125 85; r2 128 115; r3 130 145'],
      [4, .5, 'r0 160 40; r1 160 75; r2 160 110; r3 160 145'],
    ],
  },
  'v22-seitenlinie': {
    name: 'Mitte zu · Seite offen',
    obj: [['box', 50, 45, 245, 100], ['gate', 285, 95]],
    pl: [[70, 95, '1'], [200, 95, 'V', 1]],
    balls: [1],
    ph: [
      [1, .1, 'p1>0; r1 170 95 sprint'],
      [2, .2, 'd0 120 85; r1 148 90 shuffle'],
      [2, .1, 'd0 160 70; r1 170 80 shuffle'],
      [3, .1, 'd0 195 55; r1 205 70 shuffle'],
      [3, .5, 'd0 232 47 walk; r1 225 58 walk'],
      [4, .5, 'r0 70 95 walk; r1 200 95 walk'],
    ],
  },
  'v22-seitwaerts': {
    name: 'Seitwärts mitgehen · dann Antritt',
    obj: [['cone', 120, 60], ['cone', 200, 60], ['cone', 120, 140], ['cone', 200, 140]],
    pl: [[135, 140, 'A'], [135, 60, 'V', 1]],
    balls: [0],
    ph: [
      [1, .1, 'd0 155 140 walk; r1 155 62 shuffle'],
      [1, .1, 'd0 175 140 walk; r1 175 62 shuffle'],
      [2, .1, 'd0 160 118 sprint; r1 160 80 jog'],
      [3, .3, 'd0 160 95 sprint; r1 160 75 shuffle'],
      [4, .5, 'r0 135 140 walk; r1 135 60 walk'],
    ],
  },
  'v22-abstoss': {
    name: 'Abstoß · Anlaufen · Befreiung',
    obj: [['goal', 27, 95], ['line', 100, 18, 100, 172], ['line', 215, 22, 215, 168]],
    pl: [[45, 95, 'K'], [75, 45, '1'], [75, 145, '2'], [150, 95, '3'], [130, 70, 'A', 1], [130, 125, 'A', 1]],
    balls: [0],
    ph: [
      [1, .1, 'p0>1; r4 105 60 sprint; r5 110 115 sprint'],
      [2, .1, 'p1>0; r1 80 38; r4 80 52 sprint'],
      [2, .1, 'p0>2; r5 90 132 sprint; r4 92 85 sprint'],
      [3, .1, 'p2>3; r3 160 100; r4 120 90; r5 120 120'],
      [3, .5, 'd3 235 95; r4 160 95 sprint'],
      [4, .3, 'r1 100 50 walk; r2 100 140 walk'],
    ],
  },
  'v22-kherauslaufen': {
    name: 'Ball rollt · Keeper startet · aufnehmen',
    obj: [['goal', 293, 95], ['cone', 200, 95]],
    pl: [[150, 95, 'H'], [282, 95, 'K']],
    balls: [0],
    ph: [
      [1, .2, 'b0 218 100 roll; r1 275 95 shuffle'],
      [2, .1, 'r1 232 100 jog'],
      [2, .2, 'g1 0; d1 236 100 walk'],
      [3, .4, 'd1 268 95 walk'],
      [4, .5, 'p1>0 roll'],
    ],
  },
  'v22-kaufsetzer': {
    name: 'Aufsetzer · Korb · zurückrollen',
    obj: [['goal', 293, 95], ['cone', 215, 108], ['cone', 215, 82]],
    pl: [[215, 95, 'H'], [275, 95, 'K']],
    balls: [0],
    ph: [
      [1, .2, 's0 262 100 toss'],
      [2, .2, 'g1 0; d1 272 95 walk'],
      [3, .4, 'd1 270 95 walk'],
      [3, .3, 'p1>0 roll'],
      [4, .5, 'r1 275 95 walk'],
    ],
  },
  'v22-kkreuz': {
    name: 'Links, rechts · Keeper wechselt die Seite',
    obj: [['goal', 293, 95], ['cone', 215, 55], ['cone', 215, 135]],
    pl: [[215, 45, 'A'], [215, 145, 'B'], [282, 95, 'K']],
    balls: [0, 1],
    ph: [
      [1, .1, 'p0>2 roll; r2 276 78 shuffle'],
      [2, .1, 'p2>0 roll; r2 282 95 shuffle'],
      [3, .1, 'p1>2 roll; r2 276 112 shuffle'],
      [3, .1, 'p2>1 roll; r2 282 95 shuffle'],
      [4, .5, 'r0 215 145 walk; r1 215 45 walk'],
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

/** Weg von Ball 0 als statische Linie (Druck, Karten ohne Animation): Pässe, Schüsse und Dribblings in Reihenfolge. */
export function scriptRoute(sc) {
  let plan; try { plan = scriptPlan(sc); } catch { return ''; }
  const pos = {}; sc.pl.forEach((p, i) => { pos['p' + i] = [p[0], p[1]]; });
  plan.balls.forEach(([id, x, y]) => { pos[id] = [x, y]; });
  const pts = [pos.b0.slice()];
  for (const ev of plan.events) {
    for (const m of ev.m) {
      if (m.to) { const t = ev.m.find(x => x.a === m.to && x.x != null), b = t ? [t.x, t.y] : pos[m.to]; pos[m.a] = [b[0] + OFF[0], b[1] + OFF[1]]; }
      else if (m.carry) { pos[m.a] = [m.x, m.y]; pos[m.carry] = [m.x + OFF[0], m.y + OFF[1]]; }
      else pos[m.a] = [m.x, m.y];
    }
    const b = pos.b0, last = pts[pts.length - 1];
    if (Math.hypot(b[0] - last[0], b[1] - last[1]) > 6) pts.push(b.slice());
  }
  return pts.length > 1 ? 'M' + pts.map(p => p.map(v => v.toFixed(0)).join(' ')).join(' L') : '';}
