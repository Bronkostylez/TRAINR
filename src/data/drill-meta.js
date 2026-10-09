// Redaktionelle Ergänzungen je Übungs-ID: Ziel, Coaching-Punkte, Quellen, Schwierigkeit, Archiv.
// Wird in der Katalogprüfung befüllt (siehe AUDIT-V21.md, Abschnitt Übungsqualität).
export const META = {};

/** Einfacher/anspruchsvoller je Kategorie (aus V17 übernommen). Redaktionelle Optionen, keine festen Regeln. */
export const TAG_VARIANTS = {
  Aufwärmen: ['Jedes Kind hat möglichst einen Ball. Kurze Aufgaben und freie Wege, keine Ausscheidung.', 'Richtungswechsel erst auf ein sichtbares Signal. Tempo an die Ballkontrolle anpassen.'],
  Dribbling: ['Mehr Platz oder breitere Dribbeltore geben. Erst ohne Zeitdruck lösen.', 'Einen aktiv verteidigenden Partner ergänzen, wenn der Aufbau dafür geeignet ist. Tore so stellen, dass mehrere Lösungen offen bleiben.'],
  Passspiel: ['Abstand kürzer wählen und mehr Kontakte erlauben. Nach dem Pass eine neue Anspielposition suchen.', 'Bei geeigneten Spielformen einen Verteidiger ergänzen. Nicht pauschal auf einen Kontakt begrenzen.'],
  Torschuss: ['Näher am Tor beginnen. Erst kontrolliert annehmen und dann schießen.', 'Zuspielwinkel wechseln. Nur schießen, wenn der Schussweg frei und das Tor sicher befestigt ist. Keine kreuzenden Rückwege.'],
  Spielform: ['Mit kleinen Teams und mehreren Feldern spielen. Wenn Tore fehlen, Dribbellinien verwenden.', 'Eine einzige Regel passend zum Lernziel ergänzen und nach einer kurzen Runde prüfen. Freies Spiel zum Vergleich.'],
  Umschalten: ['Nach Ballgewinn zunächst Zeit zum Orientieren geben. Ersatzball bereithalten.', 'Nach Ballverlust sofort zwischen Rückeroberung und Absichern entscheiden lassen. Nicht jede Aktion stoppen.'],
  Verteidigen: ['Kleineres Angriffsziel oder mehr Abstand für den Verteidiger. Zweikämpfe kontrolliert und ohne Grätschen.', 'Startpositionen wechseln und nach Ballgewinn ein Konterziel anbieten. Rollen regelmäßig tauschen.'],
  Grundhaltung: ['Langsame Bewegung und kurzer Zuspielweg. Erst bereit stehen, dann den Ball spielen.', 'Richtung des letzten Schritts variieren. Balltempo erst erhöhen, wenn die Grundstellung stabil ist.'],
  Fangen: ['Langsam und nah zuspielen, sichere Höhe wählen. Keine harten Schüsse auf unvorbereitete Kinder.', 'Zuspielrichtung ändern. Fangtechnik nur nach geschulter Anleitung und ohne Gegnerkontakt steigern.'],
  Falltechnik: ['Nur unter geschulter Anleitung auf weichem, geprüftem Boden. Bei Schmerz oder Unsicherheit abbrechen.', 'Keine Steigerung allein durch Tempo oder Höhe. Erst die sichere Bewegung vor Ort prüfen; die Animation zeigt keine korrekte Landetechnik.'],
  Spieleröffnung: ['Kürzere Passwege und klare Anspieloptionen. Alle Kinder sollen Feldspieleraufgaben kennenlernen.', 'Schulterblick und Entscheidung zwischen zwei freien Mitspielern. Gegnerdruck erst hinzufügen, wenn der Aufbau das erlaubt.'],
};

/** Quellenverzeichnis. Jede Übung verweist per Schlüssel; die Quelle belegt das Prinzip, nicht exakte Maße. */
export const SOURCES = {};
