# TRAINR – Inventar V20 (Ist-Stand)

Stand: 9. Oktober 2026 · Grundlage: tatsächlich gelesener Code im lokalen Ordner `C:\Users\Tyler\Documents\TRAINR` (nicht die README-Beschreibung).
Version laut Code: `version.json` 20.0.0, `ui-v6.js` `APP_VERSION='20.0.0'`, Service-Worker-Cache `keeperboard-v20.0.0`. **Abweichend:** `package.json` 0.19.0, Footer „Stufe 7“.

Jeder Eintrag hat eine ID (`F-xx`). Diese IDs werden später in `INVENTAR-V21.md` für den Abgleich **Alte Funktion → neue Stelle → Testnachweis → Status** verwendet.

---

## 1. Dateien und Ladereihenfolge

| Datei | Rolle |
|---|---|
| `index.html` | Shell, Inline-CSS, alle statischen Views (Heute, Onboarding, Bibliothek, Planer, Training, Profil), zwei Dialoge |
| `drills.js` | `AGES` (8), `TAGS` (11), `SEED` (100 Übungen) |
| `app.js` | Zustand, Validierung, Speichern, Onboarding, Filter/Ranking, Planer, Timer, Text/CSV/Druck, Backup |
| `app-ui.js` | Views/Navigation, Heute-Ansicht, Live-Coaching, Fortschrittsbalken |
| `scene-motion.js` | Choreografie-Engine (`SceneMotion.plan/compile`) für schematische Übungsanimationen |
| `drill-scenes.js` | SVG-Platzskizzen (`drillPitch`) je Aufbau-Art (≈40 Arten) |
| `ui-v4.js` | Favoriten, Detailansicht mit Paging/Swipe/Tastatur, Undo beim Entfernen, Animations-/Haptik-Schalter, Online-Badge |
| `ui-v5.js` | Planassistent (Vorschlag → Übernahme), PNG-/PDF-Export mit Vorschau |
| `ui-v6.js` | Versionsbadge, Update-Leiste, Klick-Halo, View-Übergänge, Feedback in Dialogen |
| `ui-v7.js` | Scroll-Reveal, schwebende Karten, Tilt, Hintergrund-Atmosphäre |
| `ui-v8.js` | Kartenanimationen (max. 3 gleichzeitig), Detail-Player mit Tempo/Zeitleiste, Shared-Element-Übergang, Kinetic Type, Count-up, Iris-Übergang |
| `ui-next.js` | Übungsvarianten (lokal), Materialkategorien + Filter, Schnellpfad, Filter-Reset, Material-Checkliste, Katalog-Hinweis |
| `editor.js` | Animationseditor für eigene Übungen, Bearbeiten eigener Übungen, strukturierte Materialliste, Backup inkl. Varianten |
| `ui-v16.js` | Tab-Leiste mit Icons/Glider, Bar-Titel, Hash-Routing/Zurück-Taste, Bottom-Sheets mit Drag-to-dismiss, Swipe zwischen Tabs |
| `coach-tools.js` | Einheit duplizieren, Coaching-Notizen, Einheitencheck, Nummern-Gruppen, Einfacher/Anspruchsvoller-Tipps |
| `ui-v18.js` | „Einheit in einem Schritt“ auf Heute, Blocktausch, ±Minuten, Undo, Schnell-Hinzufügen-Sheet |
| `ui-v19.js` | Übungsanimation neben dem Timer im Trainingsmodus |
| `ui-v20.js` | Block-Bearbeiten-Sheet (Minuten + Spieler je Block) |
| `*.css` (12 Dateien) | Schichtweise Styles; Torwart-Lila `#9154d9` in `ui-next.css` |
| `sw.js` | Offline-Cache, Update-Mechanismus |
| `manifest.webmanifest` | PWA-Metadaten, eingebettete PNG-Icons (Base64), 4 Shortcuts |
| `serve.cjs` | Lokaler Server `http://localhost:8765` (Pfad-Traversal-Schutz) |
| `test*.cjs` (19) | Playwright-Skripte (Linux-Pfade, teilweise Git-History-abhängig) |
| `AUDIT-V15/17/18/19.md`, `SOURCES.md`, `README.md` | Dokumentation |

Architekturmuster: 19 Skripte überschreiben nacheinander globale Funktionen (`render`, `renderCards`, `renderDetail`, `view`, `add`, `validate`, `summaryText`, …) per „Monkey-Patching“. `render` ist ca. 12-fach umhüllt.

---

## 2. Datenmodell und Speicher

### 2.1 localStorage-Schlüssel

| Schlüssel | Inhalt | Im Backup? |
|---|---|---|
| `trainr-v2` | Hauptzustand (siehe 2.2) | ja |
| `trainr-ui-v4` | `{favorites:[ids], motion:bool, haptics:bool}` | **nein** |
| `trainr-adapt-v1` | Übungsvarianten `{[exerciseId]:{min,max,minutes}}` | ja (als `variants`) |
| `keeperboard-v1` | Stufe-1-Altdaten – **nie gelesen, nie verändert** | – |

Caches: `keeperboard-v20.0.0` (ältere `keeperboard-*` werden bei Aktivierung gelöscht).

### 2.2 Schema `trainr-v2` (version: 2)

```
{ version:2,
  profile: null | { type:'field'|'keeper'|'both', age:<AGES>, slots:[{day:0-6, start:'HH:MM', end:'HH:MM'}] (1-7, Tage eindeutig) },
  custom: [ { id:'custom-<uuid>', name, type, tag, ages:[…], min, max, minutes, description, coaching,
              equipment:[[name,menge]], url (https oder ''), custom:true, animation?:{version:1, frames:[{seconds,caption,points:[[x,y]×4]}]} } ] (≤500),
  plans: [ { id, name(≤80), people(1-100), slot:0-6|null, focus:'Alle'|TAG, age?:AGE, coachNotes?:string(≤800),
             blocks:[{id, exerciseId, minutes(1-120), people?(1-100)}] (≤100) } ] (1-100),
  selected: planId,
  variants?: {…}   // gelangt nach Backup-Import mit in trainr-v2
}
```

### 2.3 Datenflüsse

- **D-01 Laden:** `trainr-v2` lesen → `validate()` → bei Fehler `initial()` + `storageOK=false` + Warnhinweis. ⚠ Beim nächsten `save()` würden die ungültigen Rohdaten überschrieben (Datenverlust-Risiko).
- **D-02 Speichern:** jede Änderung → `save()` → kompletter Zustand als JSON; Fehler → Toast „Speichern nicht möglich“.
- **D-03 UI-Prefs** getrennt (`saveUI`), **Varianten** getrennt (`trainr-adapt-v1`).
- **D-04 Backup-Export:** `trainr-backup.json` = Zustand + `variants`.
- **D-05 Import:** max. 2 MB → `validate()` (inkl. Animation, Notizen, Varianten) → Bestätigungsdialog → ersetzt Zustand und Varianten vollständig. Stufe-1-Backups (version≠2) werden abgelehnt.
- **D-06 Übungsauflösung:** `exercise(id)` sucht in `SEED` + `custom`; Pläne referenzieren nur IDs → Katalogänderungen wirken auf alte Pläne.
- **D-07 Varianten:** `effective(e)` überlagert min/max/minutes; `fit()` nutzt Variante; Material bleibt Original.

---

## 3. Nutzerfunktionen

### 3.1 Onboarding und Profil
- **F-01** 3-Schritt-Onboarding: (1) Trainerart Feld/Torwart/Gemischt + Altersklasse Bambini…Männer, (2) Trainingstage (min. 1), (3) Start/Ende je Tag.
- **F-02** Validierung: kein Tag → Fehler; Ende ≤ Beginn → Fehler; Standard 17:00–18:30.
- **F-03** Profil später ändern (Profil → „Ändern“); Pläne mit nicht mehr vorhandenem Tag werden auf ersten Tag umgestellt.
- **F-04** Profilzusammenfassung in Bibliothek, Profilansicht.
- **F-05** Bambini+Torwart-Hinweis („besser allgemeine Ballspiele“).

### 3.2 Navigation und Shell
- **F-10** Bottom-Tabs Heute/Übungen/Plan/Training mit SVG-Icons und gleitendem Indikator; Profil über Avatar-Button.
- **F-11** Hash-Routing `#heute/#uebungen/#plan/#training/#profil`, Zurück-Taste schließt zuerst offene Sheets.
- **F-12** Swipe zwischen Tabs (Mobil < 900 px), Bar-Titel beim Scrollen.
- **F-13** Desktop ≥ 1000 px: Bibliothek und Planer nebeneinander (für Drag & Drop).
- **F-14** Bottom-Sheets mit Griff und Drag-to-dismiss (Detail, eigene Übung, Hinzufügen, Block bearbeiten).
- **F-15** Online/Offline-Badge mit Toasts.
- **F-16** Toast-Statusmeldungen (`#status`, role=status), in Dialogen zusätzlich inline.
- **F-17** Manifest-Shortcuts zu den 4 Tabs.

### 3.3 Heute
- **F-20** Begrüßung mit Kontext (Alter · Trainerart).
- **F-21** „Neue Einheit planen“ (Schwerpunkt, Minuten 20–120, Spieler 1–40, Altersklasse) → **„Einheit erstellen“** erzeugt sofort eine neue Einheit (nie Überschreiben).
- **F-22** Ablauf-Liste der aktuellen Einheit mit ±1-Minute-Stepper, „↻ Tauschen“ (gleiche Kategorie, passend zu Alter/Trainerart/Gruppe, keine Falltechnik), Antippen → Block-Bearbeiten.
- **F-23** „Letzte Änderung zurück“ (Undo für Tausch/Minuten/Hinzufügen/Block-Edit).
- **F-24** „Training starten“ → Trainingsmodus + Timer startet sofort.
- **F-25** „＋ Übung ergänzen“ → Sheet mit 6 passenden Vorschlägen (Schwerpunkt zuerst) + Link zur Bibliothek.
- **F-26** Einklappbar: gespeicherte Einheiten/Plan-Ticket (Minuten, Übungen, Spieler, Mini-Pitch).
- **F-27** Katalog-Hinweis V15 (einklappbar).
- **F-28** Links „Manuell planen“, „Ausführlichen Vorschlag prüfen“, „Notizen, Gruppen & Export“.

### 3.4 Übungsbibliothek
- **F-30** 100 Katalogübungen + eigene Übungen als Karten (Kategorie, Name, animierte Skizze, Minuten, Spieler/Gruppe, „ab“-Alter, Material-Chips, Begründung).
- **F-31** Volltextsuche (Name, Beschreibung, Material).
- **F-32** Filter: Schwerpunkt (11 Tags), Trainerart (Profil/Alle/Feld/Torwart/Gemischt), Altersklasse (Mein Alter/Alle/8 Stufen), Material (Bälle/Hütchen/Tore/Leibchen/Weicher Boden/Weiteres).
- **F-33** „Passende Vorschläge zuerst“: Score Gruppenpassung +100, Schwerpunkt +40, passt in Restzeit +20, schon im Plan −30; Begründungstext je Karte.
- **F-34** Merkliste/Favoriten (♡), Filter „Merkliste“, persistent in `trainr-ui-v4`.
- **F-35** Aktive-Filter-Anzeige, „Filter zurücksetzen“, Zähler „x sichtbar“, Leerzustände.
- **F-36** Drag & Drop Karte → Plan (Desktop) bzw. „+ In den Plan“.
- **F-37** Animierte Kartenskizzen (max. 3 gleichzeitig, nur sichtbare).

### 3.5 Übungsdetail
- **F-40** Detail-Sheet: Kategorie, Fakten, große Skizze, Ablaufschritte (aus Sätzen der Beschreibung), Material, Gruppenpassung, Helferhinweis bei Keeper-Übungen mit ≤2 Spielern, Coaching & Sicherheit, Einordnung, Quellenlink (https, `noopener`).
- **F-41** Animations-Player: Abspielen/Pause/Nochmal, Tempo ½×/1×/2×, Zeitleiste (Scrub), Schritt-Sprung, Autoplay nach 760 ms, aktive Spieler hervorgehoben, Kamerafahrt.
- **F-42** Fallback ohne Animation: Schrittweise Vorschau (3,2 s je Schritt).
- **F-43** Blättern ←/→ (Buttons, Pfeiltasten, horizontaler Swipe) in der gefilterten Reihenfolge.
- **F-44** „Deine Variante“: Spieler von/bis + Minuten je Übung speichern / „Original“.
- **F-45** „Einfacher / anspruchsvoller“-Tipps je Kategorie.
- **F-46** „＋ In den Plan“ im Detail; bei eigenen Übungen „Eigene Übung bearbeiten“.
- **F-47** Shared-Element-Übergang Karte → Detail.

### 3.6 Eigene Übungen
- **F-50** Formular: Name, Schwerpunkt, Trainerart, geeignet ab (Alter → alle folgenden), Beschreibung, Material (einfach), Spieler von/bis, Minuten, Quelle (https, optional).
- **F-51** Strukturierte Materialliste („4 Hütchen“ je Zeile, max. 20).
- **F-52** Animationseditor: 3 Spieler (Spieler 1, 2, Keeper K lila) + Ball, Antippen platziert, Pfeiltasten 5er-Schritte, 2–20 Schritte mit Text und 1–15 s, Schritt hinzufügen/löschen, Vorschau.
- **F-53** Eigene Übung bearbeiten (gleiche ID, Plan-Referenzen bleiben).
- **F-54** Validierung inkl. Animation; Hinweis „keine Namen“.
- ⚠ Eigene Übungen können **nicht gelöscht** werden (kein UI dafür gefunden).

### 3.7 Planer
- **F-60** Mehrere Einheiten (≤100): Auswahl, Name, neu, löschen (Bestätigung; letzte → neue leere), duplizieren.
- **F-61** Einheit-Einstellungen: Trainingstag/Zeit (aus Profil-Slots), Spieler gesamt (ohne Trainer, 1–100), Schwerpunkt.
- **F-62** Zusammenfassung: Alter · Spieler · verfügbare Minuten · „x Min zu lang / noch frei“.
- **F-63** Blöcke: Minuten direkt editieren (1–120), ↑/↓, Entfernen (+ Undo im Toast), Drag & Drop Reihenfolge, Gruppen-Warnung („passen nicht in Gruppen von a–b“), Altersklassen-Warnung.
- **F-64** Block bearbeiten (Sheet): Minuten, **Spieler je Block** (Override), „Wie in der Einheit“, „Aufbau & Animation“, Fehleranzeige.
- **F-65** Gruppenberechnung `fit()`: kleinste Gruppenzahl g mit g·min ≤ n ≤ g·max.
- **F-66** Materialbedarf: Höchstbedarf je Material über alle Blöcke (Menge × parallele Gruppen), Material-Chips, Material-Checkliste zum Abhaken (Zustand nur in Sitzung).
- **F-67** Coaching-Ziel/Notizen (≤800, in Exporten).
- **F-68** Einheitencheck: leere Einheit, Gruppen, Alter, Zeitbudget, Zeitstrahl „17:00–17:06 …“, Sicherheits-Erinnerung.
- **F-69** Gruppen ohne Namen: Nummern 1…n zufällig auf 1–20 Gruppen verteilen.
- **F-70** Planassistent (ausführlich): Schwerpunkt (ohne Falltechnik), Minuten 20–120, Spieler 1–40, Alter; Phasen Feld = Aufwärmen/Spielen/Schwerpunkt/Abschlussspiel (17/33/17/33 %), Torwart = Aufwärmen/Technik/Anwenden (20/40/40 %); Begründung je Block; Vorschau → „Als neue Einheit übernehmen“; nie Falltechnik; Fehlermeldung bei unpassender Kombination. Deterministisch (immer alphabetisch erste passende Übung).
- **F-71** Hinzufügen während laufendem Timer stoppt den Timer nicht.

### 3.8 Trainingsmodus
- **F-80** Großer Timer (Deadline-basiert, robust gegen Tab-Wechsel), Start/Pause/Nochmal, Zurücksetzen, Nächster Block, Fortschrittsbalken, Block x/y.
- **F-81** Ton (660 Hz, 0,4 s) und Toast am Blockende; kein Auto-Weiter.
- **F-82** Live-Coaching: Ablauf, Darauf achten, Vorbereiten (Material), Gruppen, Alters-Warnung, „Coaching & Quelle“.
- **F-83** Übungsanimation neben dem Timer: läuft nur bei laufendem Timer, eigene Pause, Schritt ←/→, pausiert bei Dialog/Tab-Wechsel/Ansicht-Wechsel.
- **F-84** Einstieg in beliebigen Block über Heute-Ablaufliste (V12-Pfad).
- **F-85** Update wird blockiert, solange Timer läuft.

### 3.9 Exporte, Druck, Backup
- **F-90** Plan als Text (`trainr-plan.txt`) inkl. Coaching, Material, Quelle, Warnungen, Notizen.
- **F-91** Plan als CSV (`;`, BOM, Formel-Injection-Schutz `'`).
- **F-92** Drucken / „als PDF sichern“ über `window.print()` (Druckbereich = Textfassung).
- **F-93** PNG-Export (A4-Seiten 1240×1754, je Seite eine Datei) mit Vorschau-Dialog.
- **F-94** PDF-Export (eigener PDF-Writer, JPEG-Seiten, nicht durchsuchbar) mit Vorschau.
- **F-95** Backup herunterladen / wiederherstellen (siehe D-04/D-05).
- **F-96** Hinweise: Speicher-Warnung, Backup enthält keine Merkliste/Anzeigeeinstellungen.

### 3.10 Einstellungen, Motion, Feedback
- **F-100** Animationsschalter („Animationen“), `prefers-reduced-motion` hat Vorrang (`reduced()`), Live-Wechsel bricht laufende Animationen ab.
- **F-101** Vibration bei Aktionen (opt-in, `navigator.vibrate`).
- **F-102** Effekte: Klick-Halo, Press-Scale, View-Übergänge (Iris/Slide), Scroll-Reveal, schwebende Karten (max. 10), Maus-Tilt, Kinetic Type, Count-up-Zahlen, Hintergrund-Drift.
- **F-103** Animationen pausieren bei Drag, verstecktem Tab.

### 3.11 PWA, Offline, Update
- **F-110** Service Worker: Pre-Cache aller versionierten Assets; versionierte Requests cache-first, sonst network-first mit Cache-Fallback, Navigation → `index.html`; `version.json` nie gecacht.
- **F-111** Update: `updatefound`/`waiting` → Update-Leiste „Neue Version bereit“ (Jetzt/Später), `SKIP_WAITING`, Reload nach `controllerchange`; Versionsbadge = manuelle Prüfung via `version.json`; Prüfung bei `online` und Sichtbarkeit.
- **F-112** Installierbar (Manifest, `beforeinstallprompt` → „App installieren“-Button in Profil).
- **F-113** iOS-Meta-Tags, Safe-Area-Insets.
- **F-114** Hinweis bei `file://` (kein Offline).

### 3.12 Inhalte/Sicherheit
- **F-120** Profil-/Info-Seite: Datenschutz-Text, Installationsanleitung, öffentlicher GitHub-Pages-Link, Sicherheitshinweise Falltechnik.
- **F-121** Branding über `BRAND`.
- **F-122** Hinweise „keine Spielernamen“ in Freitextfeldern.

---

## 4. Sonderfälle und Regeln im Code

| ID | Regel |
|---|---|
| S-01 | Spielerzahlen immer **ohne Trainer**; bei `both`-Übungen zählen Keeper mit; Keeper-Partnerübung: zuspielendes Kind zählt mit. |
| S-02 | Gruppen passen nicht → Warnung statt falscher Mengen; Material „vorläufig“. |
| S-03 | Falltechnik (`floor`, `stand`, ab D-Jugend) wird von Assistent, Tausch und Schnell-Hinzufügen nie automatisch gewählt. |
| S-04 | Bambini: keine Keeper-Übungen im Katalog (früheste Keeper-Übung ab E-Jugend); Hinweis bei Profil Bambini+Torwart. |
| S-05 | Assistent max. 40 Spieler, 20–120 Min; Planer 1–100 Spieler. |
| S-06 | Limits: 100 Pläne, 100 Blöcke, 500 eigene Übungen, 2 MB Backup, 80 Zeichen Name, 800 Notizen. |
| S-07 | Neue Einheiten (Assistent/„Erstellen“) ersetzen nie bestehende. |
| S-08 | Block-`people`-Override wird gelöscht, wenn gleich Einheit. |
| S-09 | Neue Blöcke übernehmen Varianten-Minuten. |
| S-10 | Plan-`age` (aus Assistent) hat Vorrang vor Profil-Alter für Filter/Warnungen. |
| S-11 | CSV-Formel-Injection-Schutz; HTML-Escaping überall; Quellen nur https. |
| S-12 | Timer läuft bei Ansichtswechsel/Detail/Hinzufügen weiter; Planänderungen (außer Hinzufügen) setzen ihn zurück. |
| S-13 | Keeper-Marker immer lila (`#9154d9`), Gegner abgesetzt. |
| S-14 | Animationsskizzen sind ausdrücklich keine Technik-/Falltechnik-Demonstration (Disclaimer). |

---

## 5. Übungskatalog (Ist)

- 100 Übungen, 100 eindeutige IDs/Namen. Schema einheitlich (14 Felder).
- Trainerart: Feld 74 · Torwart 20 · Gemischt 6.
- Kategorien: Passspiel 27 · Dribbling 17 · Aufwärmen 12 · Torschuss 8 · Spielform 8 · Spieleröffnung 8 · Fangen 6 · Umschalten 4 · Verteidigen 4 · Grundhaltung 4 · Falltechnik 2.
- Frühestes Alter: Bambini 6 · F 22 · E 39 · D 25 · C 8. Altersbänder lückenlos.
- Minuten 5–12; Gruppen meist fest (z. B. 2–2: 36×).
- **Quellen: nur 4 verschiedene URLs** (62× DFB-Artikel „Techniktraining in kleinen und mittleren Spielformen“, 18× DFB-Trainingsphilosophie, 12× DFB-Akademie Torhüter-Grundtechniken, 8× „Der Anfang der Torhüterausbildung“). Quellen stützen Prinzipien, nicht die konkrete Übung.
- Coaching-Texte stark dupliziert (ein Textbaustein 14×, einer 5×, einer 4×).
- Keine Kopfballübungen (nur „Kopf heben“, Fangen „bis Kopfhöhe“).
- Alle 100 haben eine Aufbauskizze; Choreografie für alle Aufbau-Arten außer `custom`.

---

## 6. Tests (Ist)

19 Playwright-Skripte (`test*.cjs`), kein Test-Runner (`node test-x.cjs`). Abgedeckt laut Assertions: Onboarding inkl. Fehler, Filter, 100 Karten, Ranking, Gruppen/Material, Drag & Drop, Timer, eigene Übungen/Editor, Mehrfachpläne, Persistenz, Text/CSV/PDF/PNG, Backup/Ablehnung, Offline, Responsiv 360–1280, Reduced Motion, Planassistent-Matrix (864 Kombinationen), Varianten, Block-Edit, Live-Animation, echte SW-Updates.

Lokal **nicht lauffähig** ohne Anpassung: `executablePath:'/usr/bin/google-chrome'`, Screenshots nach `/downloads`, `node_modules` fehlt, Migrationstests benötigen `git show <commit>` – der Ordner ist **kein Git-Repository**.

Lokal vorhanden: Node 24.14.1, Playwright-Browser `chromium-1228` unter `%LOCALAPPDATA%\ms-playwright`, Chrome 154, Edge 154.
