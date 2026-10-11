// Kontextbezogene Hilfe je Ansicht und eine kurze Einführung nach dem Onboarding.
import * as store from '../core/store.js';
import { openSheet } from './sheet.js';
import { icon } from './dom.js';
import { esc } from '../core/util.js';

const HELP = {
  heute: ['Heute', [
    ['Einheit in einem Schritt', 'Tippe auf „Einheit erstellen“. Der Planassistent baut aus Schwerpunkt, Minuten und Spielerzahl eine neue Einheit. Bestehende Einheiten bleiben unverändert.'],
    ['Training starten', '„Training starten“ öffnet den Trainingsmodus und startet den Timer des ersten Blocks.'],
    ['Ablauf', 'Tippe einen Block an, um Minuten und Spielerzahl zu ändern. Mit ↻ tauschst du eine Übung gegen eine passende Alternative.'],
  ]],
  uebungen: ['Übungen', [
    ['Suchen und filtern', 'Suche nach Name, Beschreibung oder Material. Filterchips grenzen Kategorie, Alter, Trainerart, Material und Schwierigkeit ein. „Passend zuerst“ sortiert nach Gruppengröße, Schwerpunkt und Restzeit – mit Begründung auf jeder Karte.'],
    ['Schwerpunkte', 'Jede Übung trainiert mehrere Schwerpunkte aus Technik, Spielverständnis, Bewegung und Torwart – der erste ist der Hauptschwerpunkt. Ein Schwerpunkt-Chip zeigt per Antippen alle passenden Übungen. Eigene Übungen bekommen bis zu vier Schwerpunkte.'],
    ['Merkliste, Bewertung, Notizen', 'Das Herz merkt eine Übung. In der Detailansicht kannst du Sterne vergeben und eigene Notizen festhalten. Gut bewertete Übungen schlägt der Assistent häufiger vor.'],
    ['Eigene Übungen', 'Mit „Eigene“ legst du Übungen an – inklusive Material, Spielerzahlen und einer eigenen animierten Platzskizze.'],
    ['Zufall & Ähnliche', 'Der Würfel öffnet eine zufällige passende Übung. Im Detail findest du ähnliche Übungen.'],
  ]],
  planen: ['Planen', [
    ['Blöcke ordnen', 'Ziehe Blöcke am Griff (⋮⋮) an eine neue Position oder nutze ↑ ↓. Auf dem Desktop ziehst du Übungen direkt aus der Bibliothek in den Plan.'],
    ['Zeit und Spieler', 'Minuten mit − / + ändern. Tippe auf den Titel eines Blocks, um die Spielerzahl nur für diesen Block anzupassen.'],
    ['Pausen', 'Tippe oben auf „Pausen planen“: keine, automatisch (je nach Altersklasse etwa alle 12–30 Min) oder eine feste Anzahl – dazu die Dauer je Pause. TRAINR verteilt sie gleichmäßig, bevorzugt nach Spielformen und zwischen zwei Runden, und rechnet sie in die Gesamtzeit ein. Mit ↑ ↓ an einer Pause legst du sie selbst fest. Passt die Einheit nicht mehr in die Trainingszeit, kann TRAINR die Übungen verhältnisgleich kürzen.'],
    ['Assistent', 'Wähle eine Strategie (Klassisch, Spielintensiv, Technik, Kurz). Jede Wahl wird begründet; für jeden Block gibt es Alternativen.'],
    ['Check & Material', '„Check“ prüft Gruppen, Alter, Zeit und Sicherheit. „Packliste“ zeigt den Materialbedarf: höchster Bedarf pro Block, parallele Gruppen eingerechnet.'],
    ['Rückgängig', 'Jede Änderung lässt sich mit ↶ oben rechts oder Strg+Z zurücknehmen.'],
  ]],
  training: ['Training', [
    ['Timer', 'Der Timer läuft über eine Zielzeit und bleibt auch beim Wechsel der Ansicht korrekt. Bei gesperrtem Bildschirm kann der Ton ausbleiben.'],
    ['Blockwechsel', 'Mit ⏭ zum nächsten Block. In den Einstellungen kannst du automatisches Weiterschalten und eine Vorwarnung aktivieren.'],
    ['Pausen im Training', 'Eingeplante Pausen laufen als eigener Countdown zwischen den Blöcken – mit Hinweis, was als Nächstes kommt und welches Material dafür bereitliegen sollte.'],
    ['Vollbild', 'Der Fokusmodus blendet Navigation aus. Tippe auf die Segmente, um direkt zu einem Block zu springen.'],
  ]],
  mehr: ['Mehr', [
    ['Mannschaften', 'Lege mehrere Mannschaften an. Jede hat eigene Altersklasse, Trainingszeiten und Einheiten. Gewechselt wird oben über den Mannschafts-Chip.'],
    ['Daten sichern', 'Alles liegt nur in diesem Browser. Lade regelmäßig ein Backup herunter. Ein Backup aus TRAINR V21 kann direkt importiert werden.'],
    ['Darstellung', 'Hell/Dunkel, Vereinsfarbe, Schriftgröße und Animationsstufe. Die Systemeinstellung „weniger Bewegung“ hat immer Vorrang. Torwart-Elemente bleiben lila.'],
  ]],
  kalender: ['Kalender', [
    ['Termine planen', 'Deine Trainingstage stehen automatisch als Serie im Kalender – immer 8 Wochen im Voraus, passend zu den Trainingszeiten der Mannschaft. Geänderte Trainingszeiten werden übernommen; gelöschte Einzeltermine kommen nicht wieder. Ausschalten unter ⋯. Spiele und sonstige Termine legst du über einen Tag an; „Serie“ trägt längere Zeiträume ein und lässt Ferien aus.'],
    ['Einheit zuordnen', 'Jedem Training lässt sich eine Einheit aus „Planen“ zuordnen – oder direkt eine neue anlegen. Trainings ohne Einheit sind markiert. Im Planer findest du „Im Kalender eintragen“ unter ⋯.'],
    ['Erinnerungen', 'Pro Termin wählbar. TRAINR erinnert, solange die App geöffnet ist oder im Hintergrund läuft, und beim nächsten Öffnen. Für Erinnerungen bei geschlossener App: Termine als .ics in den Handy-Kalender exportieren.'],
    ['Nachbereiten & Rückblick', 'Nach dem Training Teilnehmerzahl (ohne Namen), Stimmung und Notizen festhalten. „Rückblick“ zeigt gehaltene und ausgefallene Trainings, Trainingszeit, Schwerpunkte und die häufigsten Übungen. Woche und Monat lassen sich durchblättern: Du siehst je Schwerpunkt die Minuten, was gegenüber dem Vorzeitraum neu ist und was länger nicht dabei war.'],
    ['Ausfälle', 'Einzelne Termine als ausgefallen markieren oder über ⋯ → „Pause oder Ferien“ einen ganzen Zeitraum absagen. Alles ist rückgängig machbar.'],
  ]],
  taktik: ['Taktikboard', [
    ['Spieler bewegen', 'Ziehe Spieler, Keeper (lila), Ball und Hütchen frei über den Platz. Doppeltippen entfernt ein Element.'],
    ['Pfeile', 'Wähle „Lauf“, „Pass“ oder „Dribbling“ und ziehe auf dem Platz. Formationen setzen eine Grundaufstellung.'],
    ['Speichern & teilen', 'Boards werden automatisch gespeichert und lassen sich als Bild exportieren.'],
  ]],
};

export function showHelp(viewId) {
  const [title, items] = HELP[viewId] || HELP.heute;
  openSheet({
    title: `Hilfe · ${title}`,
    body: `${items.map(([h, t]) => `<section style="margin:0 0 16px"><h3>${esc(h)}</h3><p class="muted">${esc(t)}</p></section>`).join('')}
      <button class="btn ghost" type="button" data-tour>${icon('sparkles')} Kurze Einführung ansehen</button>`,
    onMount: s => { s.body.querySelector('[data-tour]').onclick = () => { s.close(); setTimeout(tour, 250); }; },
  });
}

const SLIDES = [
  ['sparkles', 'Einheit in Sekunden', 'Auf „Heute“ erstellst du mit einem Tipp eine komplette Einheit – passend zu Alter, Spielerzahl und Zeit.'],
  ['grid', 'Über 100 Übungen', 'Mit Platzskizze, Ziel, Coaching-Punkten, Material und Quelle. Merken, bewerten, eigene ergänzen.'],
  ['plan', 'Planen wie du willst', 'Ziehen, tauschen, Minuten anpassen, Assistent fragen, Vorlagen nutzen. Alles rückgängig machbar.'],
  ['calendar', 'Im Voraus planen', 'Der Kalender trägt deine Trainingstage als Serie ein, erinnert an Termine und zeigt im Rückblick, was gelaufen ist.'],
  ['play', 'Auf dem Platz', 'Großer Timer, Blockwechsel, Vorschau auf den nächsten Block und die Übungsanimation.'],
  ['data', 'Deine Daten bleiben hier', 'Kein Konto, keine Cloud. Sichere regelmäßig ein Backup unter „Mehr“.'],
];
export function tour() {
  let i = 0;
  const paint = s => {
    const [ic, h, t] = SLIDES[i];
    s.setBody(`<div class="tour-slide"><div class="art">${icon(ic)}</div><h2>${esc(h)}</h2><p class="muted">${esc(t)}</p><div class="tour-dots" aria-hidden="true">${SLIDES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><p class="sr-only">Schritt ${i + 1} von ${SLIDES.length}</p></div>`);
    s.setFoot(`<button class="btn" type="button" data-skip>${i ? 'Zurück' : 'Überspringen'}</button><button class="btn primary" type="button" data-next>${i === SLIDES.length - 1 ? 'Los geht’s' : 'Weiter'}</button>`);
    s.foot.querySelector('[data-next]').onclick = () => { if (i === SLIDES.length - 1) s.close(); else { i++; paint(s); } };
    s.foot.querySelector('[data-skip]').onclick = () => { if (i) { i--; paint(s); } else s.close(); };
  };
  openSheet({ title: 'Kurze Einführung', onMount: paint, onClose: () => store.update('Einführung', d => { d.help.tour = true; }, { undo: false }) });
}
