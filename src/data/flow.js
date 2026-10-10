// Ablaufart der Übungen (ab 21.7): Wie verteilt sich eine größere Spielerzahl?
//  group = feste Gruppen (Teams, Paare, Dreiecke): Mehr Spieler heißt mehr Gruppen – nur hier gibt es sie überhaupt.
//  queue = Schlange: eine Station, wenige sind aktiv, die anderen reihen sich ein und rotieren (Abschluss, Zuspiel-Reihe).
//  open  = alle gemeinsam: jeder macht gleichzeitig dasselbe, größere Gruppe = größeres Feld und mehr Material.
// Vorgabe ist „group“. Hier stehen nur die Ausnahmen; eigene Übungen tragen `flow` selbst.
export const FLOWS = ['group', 'queue', 'open'];

const queue = 'finish v5-rollfinish v5-gatefinish v5-choosefinish v5-carryfinish v5-returnfinish v5-anglefinish v21-passschuss v22-1v1keeper v22-flanke v22-querpass v22-nachschuss v22-zielschuss'.split(' ');
const open = `islands traffic treasure gates activation v5-mirror v5-weather v5-paths v5-colors v5-body v5-islandpair v5-pace v5-turn v5-foot v5-outside v5-stopgo v5-crossroads
  v22-zauberer v22-bruecke v22-leibchenjagd v22-tunnelwaechter v22-huetchenraub v22-achter v22-sohlenzug v22-hasefuchs v22-torejagd`.split(/\s+/);

export const FLOW = Object.fromEntries([...queue.map(id => [id, 'queue']), ...open.map(id => [id, 'open'])]);

/** Ablaufart einer Übung. */
export const flowOf = e => (FLOWS.includes(e?.flow) ? e.flow : FLOW[e?.id] || 'group');

export const FLOW_LABEL = { group: 'Gruppen', queue: 'Schlange', open: 'Alle gemeinsam' };
export const FLOW_HELP = {
  group: 'Feste Gruppen, zum Beispiel Teams oder Paare. Mehr Spieler ergeben mehr parallele Gruppen.',
  queue: 'Eine Station mit Schlange: Wenige sind aktiv, die anderen warten in der Reihe und rotieren durch.',
  open: 'Alle machen gleichzeitig dasselbe. Mehr Spieler brauchen ein größeres Feld und mehr Material, aber keine Gruppen.',
};
