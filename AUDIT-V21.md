# TRAINR V21 – Audit und Umsetzungsplan

Stand: 9. Oktober 2026 · Phase 1 (Analyse). Am bestehenden Produkt wurde nichts verändert. Neu angelegt: `INVENTAR-V20.md`, `AUDIT-V21.md`, `IDEEN-V21.md`.
Der Abschlussbericht wird am Ende dieser Datei ergänzt.

---

## 1. Ist-Zustand

TRAINR V20 ist funktional reich (≈ 90 Nutzerfunktionen, siehe `INVENTAR-V20.md`), aber technisch eine Schichtung aus 19 Skripten und 12 Stylesheets, die sich gegenseitig per Monkey-Patching erweitern.

### 1.1 Technische Probleme

| # | Problem | Folge |
|---|---|---|
| T-01 | `render`, `renderCards`, `renderDetail`, `view`, `add`, `validate` werden 5–12-fach umhüllt; viele Schichten rufen `render()` beim Laden erneut auf. | Schwer wartbar, Reihenfolge-abhängig, unnötige Re-Renders, jede Änderung riskiert Seiteneffekte. |
| T-02 | Gesamtes UI wird per `innerHTML` neu gerendert; Karten werden nach dem Rendern per DOM nachbearbeitet oder wieder entfernt (Favoriten-/Materialfilter löschen Karten nachträglich). | Langsam bei 100+ Karten, Fokusverlust, Animationen werden neu gestartet. |
| T-03 | **Datenverlust-Risiko:** Ungültige gespeicherte Daten führen zu `initial()`; der nächste `save()` überschreibt die Rohdaten. | Eine einzige fehlerhafte Validierung kann alle Pläne löschen. |
| T-04 | Drei Speicher (`trainr-v2`, `trainr-ui-v4`, `trainr-adapt-v1`); Backup enthält Favoriten/Einstellungen nicht; Import schreibt `variants` zusätzlich in `trainr-v2`. | Uneinheitliche Datensicherung. |
| T-05 | Versionen inkonsistent: `package.json` 0.19.0, Footer „Stufe 7“, Badge „V20“. Manifest-Beschreibung englisch. | Verwirrend, nicht durchgängig deutsch. |
| T-06 | Tote/versteckte UI (`data-tab`-Buttons, alte Quick-Row, Ticket in Details versteckt, doppelte Wege zum gleichen Ziel). | Bedienwege unklar. |
| T-07 | Eigene Übungen lassen sich nicht löschen. Undo existiert nur punktuell (eine Stufe, nur manche Aktionen). | Funktionslücken. |
| T-08 | Planassistent deterministisch (immer alphabetisch erste Übung), eine Strategie, keine Alternativen. | Immer gleiche Vorschläge. |
| T-09 | Material-Checkliste nicht persistent; Varianten skalieren Material nicht. | Kleine Ungenauigkeit. |
| T-10 | Timer: kein Auto-Weiter, kein Wake-Lock, kein Vorwarnton, keine Gesamtzeit-Anzeige. | Auf dem Platz unpraktisch. |
| T-11 | Druck = reine Textfassung; PDF ist gerastert (nicht durchsuchbar, groß). | Exportqualität ausbaufähig. |
| T-12 | Animationen: ≈ 10 Effektsysteme parallel (Halo, Tilt, Float, Iris, Kinetic Type, Count-up, Reveal …), teils mit MutationObservern auf `main`. Alle respektieren `reduced()`, aber es gibt keine Abstufung. | Leistung auf schwachen Geräten, kein „reduziert“-Modus. |
| T-13 | Kein Dunkelmodus, keine Schriftgröße, keine Vereinsfarben, keine kontextbezogene Hilfe. | Wunschfunktionen fehlen. |
| T-14 | Ein Profil = eine Mannschaft. Kein Kalender/Datum für Einheiten. | Wunschfunktionen fehlen. |
| T-15 | Tests: Linux-Pfade, keine Konfiguration, kein gemeinsamer Runner, Migrationstests benötigen Git-History; der Ordner ist **kein Git-Repo**; `node_modules` fehlt. | Lokal nicht ausführbar. |
| T-16 | Service Worker cached `./` und `index.html` ohne Version; Navigation network-first. Funktioniert, aber das Update-Verhalten hängt von zwei Mechanismen (SW-State und `version.json`) ab. | Komplex; wird vereinfacht und getestet. |

### 1.2 Übungsqualität (Ist)

- Inhaltlich solide Basis (V15 hat alle 100 überarbeitet): Aufbau-Maße, klare Abläufe, keine Kopfbälle, Falltechnik nur 2 Übungen ab D-Jugend, keine Keeper-Übungen für Bambini/F-Jugend.
- **Schwächen:**
  - Nur 4 Quell-URLs für 100 Übungen; 62 verweisen auf denselben Artikel. Die Quelle belegt das Prinzip, nicht die einzelne Übung → schwer überprüfbar.
  - Kein eigenes Feld „Ziel“; das Ziel steckt implizit in Name/Kategorie.
  - Coaching-Texte vielfach identisch (14× derselbe Baustein) → wenig übungsspezifisch.
  - Einige Übungen sind Varianten mit fast gleichem Aufbau (z. B. 13 „game“-Aufbauten 2v2/3v3/4v4).
- Plan: jede Übung erhält `goal` (1 Satz), übungsspezifische Coaching-Punkte (2–4 kurze), `sources` (Liste mit Titel + URL + was die Quelle belegt). Schwache Dubletten werden **archiviert** (bleiben über ihre ID auflösbar, erscheinen aber nicht mehr in der Bibliothek). Neue Übungen nur mit nachprüfbarer Quelle. Ziel: Qualität vor Menge, voraussichtlich 100–130 aktive Übungen.

---

## 2. Geplante Architektur

**Grundsatz:** kein Build-Schritt, keine Laufzeit-Abhängigkeiten, native ES-Module, Vanilla JS. Startweg bleibt `node serve.cjs`. Einzige Dev-Abhängigkeit: `@playwright/test`.

```
index.html               Shell (App-Rahmen, Tabbar, Sheet-/Toast-Container), lädt src/main.js als Modul
src/
  main.js                Bootstrapping, Router, Service-Worker-Registrierung
  core/
    store.js             Zustand, Events (subscribe), Persistenz, Undo/Redo-Stack
    schema.js            Validierung V3 (+ V2-Validierung für Import)
    migrate.js           trainr-v2 / trainr-ui-v4 / trainr-adapt-v1 → V3 (nur lesend)
    planning.js          fit(), Material, Zeitbudget, Einheitencheck, Ranking
    assistant.js         Planassistent: Strategien, Begründungen, Alternativen, Seeds
    timer.js             Deadline-Timer, Auto-Weiter, Vorwarnung, Wake-Lock, Ton
    exports/             text, csv, print (HTML-Layouts), pdf (Vektortext), png, ics, share
  data/
    drills.js            Katalog im bisherigen Format (stabile IDs) + neue Felder
    sources.js           Quellenverzeichnis
  scene/
    pitch.js             SVG-Skizzen (aus drill-scenes.js übernommen und bereinigt)
    motion.js            Choreografie (aus scene-motion.js übernommen)
  ui/
    dom.js               h()-Helfer, Escaping, Event-Delegation
    sheet.js toast.js dialog.js tabs.js gestures.js haptics.js motion.js help.js
  views/
    today.js library.js detail.js plan.js training.js calendar.js tactics.js
    editor.js onboarding.js settings.js teams.js
styles/
  tokens.css base.css components.css views.css print.css
sw.js  manifest.webmanifest  version.json  serve.cjs
tests/ (Playwright)  playwright.config.cjs
```

- **Rendering:** kleine View-Funktionen, die nur ihren Bereich neu zeichnen; Listen mit Schlüsselabgleich (Karten werden wiederverwendet), Event-Delegation. Kein Framework.
- **Ein Store:** alle Änderungen über `store.update(label, fn)` → automatisch Undo-Eintrag, Speichern (gebündelt), Re-Render der betroffenen Views.
- **Eine Motion-Schicht:** Stufen `aus / reduziert / voll`. `prefers-reduced-motion` erzwingt höchstens „reduziert“ ohne Bewegungseffekte (nur Opazität), „aus“ erzwingt keine Animation. Alle Animationen laufen über einen Helfer `animate()`, der die Stufe prüft; CSS nutzt `[data-motion]`-Attribut am `<html>`.
- **Alte Dateien** (`ui-v*.js/css`, `app-ui.*`, `ui-next.*`, `coach-tools.js`, `editor.js`, `drill-scenes.js`, `scene-motion.js`, `app.js`) werden nach erfolgreicher Migration aus dem App-Pfad entfernt. Der V20-Stand bleibt über Git-Tag `v20-final` (und eine Zip-Sicherung) erhalten.

### 2.1 Informationsarchitektur (Bottom-Tabs)

| Tab | Inhalt |
|---|---|
| **Heute** | Nächste Einheit (aus Kalender/Mannschaft), Ein-Tipp-Erstellen, Start, Schnellaktionen, Hinweise |
| **Übungen** | Bibliothek: Suche, Filterchips, Sortierung, Merkliste, Zuletzt benutzt, Zufall, eigene Übungen, Detail-Sheet |
| **Planen** | Einheiten-Liste/Kalender (Woche/Saison), Planer-Arbeitsfläche (Blöcke, Zeitstrahl, Material, Check, Notizen), Assistent, Vorlagen, Export |
| **Training** | Vollbild-Timer, Blockwechsel, Animation, Coaching, Vorschau „als Nächstes“, Gesamtfortschritt |
| **Mehr** | Mannschaften, Taktikboard, Einstellungen (Darstellung, Motion, Haptik, Ton), Daten (Backup/Import), Hilfe, Über/Version |

Desktop ≥ 1024 px: Navigationsleiste links, Bibliothek + Planer nebeneinander (Drag & Drop bleibt).

### 2.2 Designsystem

- **Tokens:** Farben (Rasen-Dunkelgrün `#133e33` und Lime `#d4f26b` als Markenkern, neutrale Flächen, Status), **Torwart-Lila `--keeper:#9154d9` fest, unabhängig von Vereinsfarbe und Theme**; Abstände 4-er Raster; Radien; Schatten; Typo-Skala mit `--font-scale` (90–130 %).
- **Themes:** Hell, Dunkel, System; optionale Vereinsfarbe als Akzent (Kontrastprüfung, nie für Torwart-Elemente).
- **Komponenten:** App-Bar, Tabbar mit Indikator, Bottom-Sheet (Snap-Punkte, Drag-to-dismiss, Fokusfalle), Toast mit Aktion (Rückgängig), Chips, Segmented Control, Stepper, Karten, Listenzeilen mit Swipe-Aktionen, FAB, Leerzustände, Skeletons.
- **Touch:** Mindestgröße 44×44 px, primäre Aktionen in Daumenreichweite, Long-Press für Kontextmenü, Swipe in Listen.
- **Barrierefreiheit:** semantische Landmarken, sichtbarer Fokus, ARIA für Tabs/Sheets/Timer, Live-Regionen, Kontrast ≥ 4,5:1 in beiden Themes, Tastaturbedienung inkl. Drag-&-Drop-Alternative.

---

## 3. Datenmigration und Rückwärtskompatibilität

- **Neuer Schlüssel `trainr-v21`** (Schema `version: 3`). Beim ersten Start ohne `trainr-v21`: `trainr-v2`, `trainr-ui-v4`, `trainr-adapt-v1` **nur lesen** und nach V3 überführen. Die alten Schlüssel werden **nicht verändert und nicht gelöscht** → V20 bleibt bei Rückkehr lauffähig (mit dem Stand zum Migrationszeitpunkt).
- `keeperboard-v1` wird weder gelesen noch geschrieben (Test sichert das byte-genau ab).
- **Abbildung V2 → V3:**
  - `profile` → erste Mannschaft `teams[0]` (Name „Meine Mannschaft“, Typ, Alter, Slots).
  - `plans[]` → `plans[]` mit `teamId`, unveränderten IDs, Blöcken (`id`, `exerciseId`, `minutes`, `people?`), `focus`, `age?`, `coachNotes` → `notes`, `slot` bleibt.
  - `custom[]` unverändert übernommen (inkl. `animation`).
  - `trainr-adapt-v1` → `exerciseMeta[id].variant`; Favoriten → `exerciseMeta[id].favorite`; `motion` → `settings.motion` (`voll`/`aus`), `haptics` → `settings.haptics`.
  - `selected` → `ui.selectedPlanId`.
- **Fehlerfall:** Ist ein gespeicherter Stand ungültig, wird er nie überschrieben: Rohdaten werden unter `trainr-v21-recovery-<Zeitstempel>` kopiert, die App startet im Hinweis-Modus mit Export-Möglichkeit der Rohdaten.
- **Import:** akzeptiert V20-Backups (`version: 2`, inkl. `variants`) und V21-Backups (`version: 3`); Stufe-1-Backups werden weiterhin abgelehnt. Vor dem Ersetzen: Bestätigung + automatisches Sicherungs-Backup des aktuellen Stands im Speicher (eine Stufe Rückgängig).
- **Export:** V21-Backup enthält alles (inkl. Favoriten, Bewertungen, Notizen, Einstellungen, Kalender, Taktikboards). Zusätzlich optional „Backup im V20-Format“ für Rückweg.
- **Übungs-IDs:** alle 100 IDs bleiben auflösbar; archivierte Übungen erscheinen in alten Plänen weiterhin mit Hinweis.
- **Service Worker:** Cache-Name wechselt auf `trainr-v21.0.0`; Aufräumen löscht alte `keeperboard-*`- und `trainr-*`-Caches (nur Caches, keine Nutzerdaten).

---

## 4. Umsetzungsschritte

1. **Sicherung:** Zip-Kopie des V20-Ordners (außerhalb des App-Pfads, z. B. `..\TRAINR-V20-Sicherung-2026-10-09.zip`). `git init`, Commit des V20-Stands, Tag `v20-final`, Branch `v21-rebuild`. Kein Remote, kein Push. *(abhängig von Rückfrage 1)*
2. **Fundament:** Ordnerstruktur, Tokens/Basis-CSS, `dom.js`, Store, Schema, Migration (+ Tests zuerst), Service Worker, Manifest, Version 21.0.0 überall.
3. **Kern:** Shell + Tabs + Router, Onboarding, Bibliothek + Detail, Planer (Blöcke, D&D, Undo/Redo, Teilnehmer, Gruppen, Material, Check, Notizen, Kopieren), Trainingsmodus, Exporte/Druck/Backup/Import, eigene Übungen + Editor.
4. **Erweiterungen:** Mannschaften, Kalender (Woche/Saison, Serien, Vorlagen), Assistent mit Strategien/Alternativen, Bewertungen/Notizen/Zuletzt/Zufall/Ähnliche, Packliste, Taktikboard, Exportlayouts, Teilen, Einstellungen (Theme, Vereinsfarbe, Schrift, Haptik, Ton, Motion-Stufen), Hilfe + Kurz-Einführung.
5. **Katalogpflege:** Ziel/Coaching/Quellen je Übung, Archivierung schwacher Dubletten, neue Übungen mit Quelle.
6. **Feinschliff:** Animationen, Gesten, Barrierefreiheit, Leistung.
7. **Tests & Abnahme:** vollständige Suite, Screenshots 360/390/768/1280, gedrosselter Lauf, Fehler beheben, `INVENTAR-V21.md`, Abschlussbericht.

---

## 5. Teststrategie

- `@playwright/test` mit `playwright.config.cjs`, Webserver = `serve.cjs`, Browser = lokal vorhandenes Playwright-Chromium (oder Chrome per `CHROME_PATH`). Ausgaben nach `test-results/` und `screenshots/` im Projekt (bereits in `.gitignore` bzw. wird ergänzt).
- **Unit-nahe Tests** (im Browser-Kontext): Schema, Migration, `fit()`, Material, Zeitbudget, Assistent (Matrix Alter × Trainerart × Spieler × Minuten; nie Falltechnik, Bambini nie Torwart-Spezialisierung).
- **E2E (Pflicht):** Onboarding inkl. Fehlerfälle; Bibliothek/Suche/Filter/Merkliste; Planer inkl. D&D, Reihenfolge, Teilnehmer je Einheit/Block, Undo/Redo; Trainingsmodus + Timer (mit Uhr-Mock), Blockwechsel, Vorschau; alle Exporte (Text, CSV, Druck-HTML, PDF, PNG, ICS, Teilen-Fallback) mit Download-Prüfung; Backup/Import (V20- und V21-Format, Ablehnung); eigene Übungen + Animation; Animationsschalter + `prefers-reduced-motion` (keine laufenden Animationen); Offline-Reload; Service-Worker-Update V20 → V21 (alter Stand aus Git-Tag `v20-final` ausgeliefert); Migration mit echten V20-Daten byte-genau erhalten; `keeperboard-v1` unverändert.
- **Layout:** Screenshots je Hauptansicht bei 360/390/768/1280 px in hell/dunkel; automatische Prüfung auf horizontalen Overflow, Konsolen-/Seitenfehler, Mindestgröße der Touch-Ziele. Screenshots werden von mir tatsächlich angesehen.
- **Leistung:** CPU-Drosselung (CDP 4×) + Netzwerk „Slow 4G“: Startzeit, Zeit bis interaktiv, Bibliothek-Scroll; Ergebnisse dokumentiert.
- **Nicht real testbar (wird dokumentiert):** physisches Handy, iOS/Safari-Installation, Ton bei gesperrtem Bildschirm, echte Vibration, Praxistest auf dem Platz.

---

## 6. Risiken und bewusste Annahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Großer Neubau verliert Funktionen | Inventar-IDs F-xx, Abgleichtabelle, Tests je Pflichtfunktion |
| Datenverlust bei Migration | Alte Schlüssel nur lesen, Recovery-Kopie, byte-genaue Migrationstests, Backup-Rückweg |
| ES-Module + Service Worker | Alle Module im Precache, Offline-Test inkl. erstem Start nach Update |
| Animationen kosten Leistung | Eine Motion-Schicht, Budget (sichtbare Elemente), Drosselungstest |
| Übungsinhalte ohne externe Trainerabnahme | Ehrliche Kennzeichnung als redaktionelle Vorschläge; Quellen belegen Prinzipien |
| Quellen nicht online prüfbar | Nur prüfen, wenn Netzwerkzugriff erlaubt (Rückfrage 2); sonst als „nicht geprüft“ markiert |

**Entscheidungen aus den Rückfragen (9. Oktober 2026):**
1. Git: lokal `git init`, Commit des V20-Stands, Tag `v20-final`, Branch `v21-rebuild`, kein Remote; zusätzlich Zip-Sicherung neben dem Ordner.
2. Netzwerk nur lesend erlaubt: `npm install` für `@playwright/test` und Abruf der DFB-/fussball.de-Quellseiten zur Quellenprüfung.
3. Falltechnik bleibt **ab D-Jugend** (wie bisher). Wird weiterhin nie automatisch vorgeschlagen.
4. Umfang V21: **Mehrere Mannschaften**, **Taktikboard**, **Exportlayouts & Teilen**. Kalender/Saisonplanung/Serien → `IDEEN-V21.md`. Vorlagen (Einheit als Vorlage speichern und daraus erstellen) werden als kleine Planer-Funktion trotzdem umgesetzt, weil sie ohne Kalender auskommen.

**Annahmen (sofern nicht anders beantwortet):**
- Kein Framework, kein Build-Schritt; Zielbrowser: aktuelle Chrome/Edge/Safari/Firefox.
- Neue Speicherstruktur unter `trainr-v21`, alte Schlüssel bleiben unangetastet.
- Keine Spielernamen, keine Konten, keine Cloud, keine Analyse – wie bisher.
- „Teilen“ = Web-Share-API mit Datei bzw. Download; keine Server-Links.
- Der Link auf die öffentliche GitHub-Pages-App in der Info-Seite bleibt als reiner Text/Link erhalten (keine Veröffentlichung).
- `README.md` bleibt unverändert, auch wenn es danach veraltet ist.

---

# Abschlussbericht V21 (9. Oktober 2026)

## 1. Ergebnis in Kürze

TRAINR 21.0.0 ist lokal auf dem Branch `v21-rebuild` fertig gebaut und getestet. Nichts wurde hochgeladen, gepusht oder veröffentlicht. `main` und der Tag `v20-final` zeigen unverändert auf V20. Zusätzlich liegt eine Zip-Sicherung unter `C:\Users\Tyler\Documents\TRAINR-V20-Sicherung-2026-10-09.zip`.

- **37 von 37 Playwright-Tests bestanden.** Die Suite lief zweimal hintereinander ohne Fehler (Chrome 154, Windows 11).
- Alle V20-Funktionen sind enthalten oder bewusst ersetzt. Der vollständige Abgleich steht in `INVENTAR-V21.md`. Keine Fähigkeit ist ersatzlos entfallen.
- Datenmigration geprüft: Ein echtes Service-Worker-Update von V20 (aus dem Git-Tag ausgeliefert) auf V21 übernimmt Pläne, Merkliste und Varianten. `trainr-v2`, `trainr-ui-v4`, `trainr-adapt-v1` und `keeperboard-v1` bleiben byte-genau unverändert.

Starten: `node serve.cjs`, dann http://localhost:8765 öffnen. Testen: `npm test` (alles), `npm run test:perf` (Leistungsmessung allein).

## 2. Architekturentscheidungen

| Entscheidung | Begründung |
|---|---|
| Native ES-Module ohne Build-Schritt und ohne Laufzeit-Abhängigkeiten | Der Startweg `node serve.cjs` bleibt; nichts muss kompiliert werden; offline einfach |
| Ein Store (`src/core/store.js`), alle Änderungen über `update(label, fn)` | Automatisches Rückgängig/Wiederholen (40 Stufen), Validierung vor jedem Speichern, gebündeltes Speichern (120 ms, Flush bei `pagehide`) |
| Schema V3 unter neuem Schlüssel `trainr-v21`; alte Schlüssel nur lesen | Rückweg zu V20 bleibt möglich; kein Datenverlust durch Migration |
| Ungültige Daten werden unter `trainr-v21-recovery-<Zeit>` gesichert | Behebt das V20-Risiko, dass fehlerhafte Daten beim nächsten Speichern überschrieben wurden |
| Ansichten als kleine Module (`src/views/*`) mit Router, Event-Delegation ohne doppelte Listener | Ersetzt 19 sich gegenseitig überschreibende Skripte |
| Eine Motion-Schicht (`src/ui/motion.js`) mit 3 Stufen; CSS über `html[data-motion]` | `prefers-reduced-motion` und der Schalter greifen überall gleich |
| Ein Dokumentmodell für PDF, PNG und Druck (`src/exports/doc.js`) | Gleicher Inhalt in allen Formaten; PDF mit echtem Text statt gerasterter Bilder |
| Platzskizzen und Choreografie aus V20 als Module übernommen | Bewährte 40 Aufbau-Arten; nur bereinigt |

Dateistruktur: `index.html`, `styles/` (tokens, app, print), `src/core` (Logik), `src/data` (Katalog, Ergänzungen, Quellen), `src/scene` (Skizzen, Animation), `src/ui` (Shell-Bausteine), `src/views` (Ansichten), `src/exports`, `sw.js`, `manifest.webmanifest`, `tests/`. Die alten Dateien `app.js`, `app-ui.*`, `ui-v4…ui-v20.*`, `ui-next.*`, `coach-tools.js`, `editor.js`, `drill-scenes.js`, `scene-motion.js`, `drills.js` und `test*.cjs` wurden entfernt. Sie liegen weiter im Tag `v20-final` und in der Zip-Sicherung.

Version 21.0.0 steht einheitlich in `version.json`, `package.json`, `package-lock.json`, `sw.js`, `index.html`, `src/core/util.js` und `src/main.js`.

## 3. Neue Funktionen und Designentscheidungen

**Neu:**
- Mehrere Mannschaften, wechselbar über den Chip oben.
- Taktikboard: Spieler frei bewegen, lila Keeper für beide Teams, Ball, Hütchen, Lauf-, Pass- und Dribbelpfeile, 5 Formationen, mehrere Boards, Bild-Export.
- Planassistent mit 4 Strategien, Begründung je Block, Alternativen, Neu würfeln und Übernahme wahlweise neu oder in die aktuelle Einheit.
- Vorlagen.
- Globales Rückgängig/Wiederholen.
- Bewertungen, Notizen, Zuletzt, Zufall, ähnliche Übungen und Schwierigkeitsstufen für Übungen.
- Packliste.
- PDF mit echtem Text in 4 Layouts × 2 Stilen, Teilen per Systemmenü, Einheit als importierbare `.trainr.json`.
- Timer: Ring, Vorwarnung, Auto-Weiter, +1 Min, Fokusmodus, Wake Lock, Wiederherstellung nach Neuladen.
- Dunkelmodus, Vereinsfarbe, Schriftgröße, Signaltöne.
- Kontexthilfe (?) in jeder Ansicht und eine kurze Einführung.
- Eigene Übungen löschen; Katalogübung als eigene Übung anpassen.
- Backup im V20-Format als Rückweg.

**Design:**
- Rasengrün und Lime als Markenkern.
- Torwart-Lila `#9154d9` ist fest in den Tokens und wird von Theme und Vereinsfarbe nie überschrieben.
- Bottom-Tabs mit gleitender Markierung; ab 1024 px eine Seitenleiste.
- Bottom-Sheets mit Griff und Wischen zum Schließen; ab 760 px zentrierte Dialoge.
- Touch-Ziele in der Regel 44–58 px.
- Kompakte Übungskarten auf dem Handy (Skizze links).
- Rein dekorative V20-Effekte (Halo, Tilt, Schweben, Kinetic Type, Count-up, Iris) sind zugunsten von Ruhe und Leistung entfallen.

**Übungskatalog:**
- Alle 100 bisherigen Übungen haben jetzt ein Ziel, 2–3 übungsspezifische Coaching-Punkte, einen Sicherheitshinweis und 1–2 Quellen mit Angabe, was die Quelle belegt.
- 24 Aufbau-Beschreibungen mit vorher generischem Text (z. B. „passend zur Aufgabe“) wurden konkretisiert.
- 2 Dubletten sind archiviert und bleiben in alten Plänen erhalten.
- 7 neue Übungen sind direkt aus den geprüften Quellen abgeleitet und eigenständig formuliert: Pass-Feld, Pass-Feld mit Nummern, Pass-Feld zum Abschluss, Turnier 2 gegen 2, First-Touch-Duell, 6 gegen 6 auf Dribbeltore, Ballhalten 10 gegen 4.
- Ergebnis: 105 aktive Übungen, 107 IDs insgesamt.
- Alle 8 Quellseiten wurden am 9. Oktober 2026 abgerufen und gelesen (siehe `SOURCES.md`).

## 4. Inventar-Abgleich

Siehe `INVENTAR-V21.md`. Zusammenfassung: Von 80 V20-Nutzerfunktionen (F-01 bis F-122) und 21 Regeln bzw. Datenflüssen (14 × S, 7 × D) sind alle enthalten. 4 Punkte sind bewusst anders gelöst (🔁): Online-Badge → Toast, Katalog-Hinweis → Migrationshinweis, Shared-Element-Übergang → Sheet-Animation, dekorative Effekte → reduziertes Motion-Set. Die mit 🟡 markierten Punkte sind umgesetzt, aber nicht vollständig automatisch getestet.

## 5. Tatsächlich ausgeführte Tests

`npx playwright test` mit 37 Tests in 11 Dateien. Alle bestanden, zweimal hintereinander.

| Datei | Inhalt |
|---|---|
| onboarding | Onboarding inkl. Fehlerfällen, Profil ändern, Neuladen; Bambini + Torwart ohne Torwart-Spezialisierung |
| library | Suche, Filter, Archiv, Merkliste, Detail, Quellenlinks (https, noopener), Bewertung, Notiz, Variante, Blättern, Zufall; Katalogregeln: 107 IDs, Ziel, Coaching und Quelle überall, keine Kopfbälle, Falltechnik nur ab D-Jugend, kein Keeper für Bambini |
| planner | Minuten, ↑↓, Undo/Redo (Knopf und Tastatur), Spieler je Einheit und je Block, ungültige Eingaben, Entfernen mit Rückgängig, Tauschen; Sortieren mit Zeiger und Tastatur; Desktop-Drag-&-Drop aus der Bibliothek; Assistent mit Alternativen, Check, Gruppen, Packliste, Ziel, Notizen, Duplizieren, Vorlagen, Löschen; Hinzufügen bei laufendem Timer |
| training | Timer mit Uhr-Mock: Start, Pause, Weiterlaufen bei Ansichtswechsel, Vorschau, Nächster Block, Blockende, Zurücksetzen, Sprung; Vorwarnung und Auto-Weiter; leerer Plan |
| exports | PDF in allen 8 Layout- und Stil-Kombinationen (Header, Helvetica, echter Text, xref-Offsets geprüft), PNG, Text, CSV (BOM, Formelschutz), Druck-HTML, TRAINR-Datei und Import; Backup, Wiederherstellen, V20-Format, Import eines V20-Backups inkl. Varianten, 4 Ablehnungsfälle |
| custom-teams-board | Eigene Übung mit Material und Animation (lila Keeper), Bearbeiten, Verwenden, Löschen mit Rückgängig; mehrere Mannschaften; Taktikboard: Setzen, Ziehen, Pfeil, Formation, Rückgängig, Bild-Export |
| migration | V20-Daten → V21 vollständig; alte Schlüssel byte-genau; zweiter Start liest V21; ungültige V2- und V3-Daten werden gesichert; nur UI-Daten |
| motion-offline | Schalter Voll/Aus/Reduziert (keine laufenden Animationen); `prefers-reduced-motion` hat Vorrang, auch beim Wechsel zur Laufzeit; offline: Cache, Neuladen, Planen, Detail, PDF, Taktikboard, neuer Seitenaufruf |
| update | **Echtes V20 → V21-Update** über den Service Worker (V20 aus Git-Tag ausgeliefert, V20-Update-Leiste bedient): Daten migriert, alte Schlüssel unverändert, alter Cache entfernt, offline lauffähig; V21 → 21.0.1: Hinweis, manuelle Prüfung, Sperre bei laufendem Timer, Daten bleiben |
| layout | 360/390/768/1280 px, hell und dunkel: 6 Ansichten und 4 Sheets, kein horizontaler Overflow, keine JS-Fehler |
| assistant-gestures | Assistent-Matrix: 6336 Kombinationen, davon 5244 gültige Vorschläge und 1092 begründet abgelehnt; keine Falltechnik, Alter und Gruppen passen, kein Keeper für Bambini/F-Jugend, Minutensumme exakt; Tab-Wischen; alte Adressen; Zurück-Taste schließt Sheets |
| performance | siehe Abschnitt 6 |

Während der Arbeit gefundene und behobene Fehler:
- Doppelte Event-Listener nach Neuzeichnen (ein Tipp öffnete 3 Sheets).
- Planer-Feld kollidierte mit der Tab-Markierung.
- Icons ohne Größe erzeugten horizontalen Overflow bei 360 px.
- Desktop-Grid lief bei 1280 px über.
- Im Animationseditor ging eine getippte Schritt-Erklärung verloren.
- Planer-Unterreiter brachen bei 360 px um.
- Langsames Öffnen der Bibliothek (Punktwerte zwischengespeichert, Karten in Etappen gezeichnet).
- Kartenanimationen liefen hinter offenen Sheets weiter.

## 6. Leistung (gemessen, Chrome, CDP-Drosselung CPU 4× und ~1,6 Mbit/s bei 150 ms Latenz)

Isolierter Lauf (`npm run test:perf`), zwei Messungen:

| Messung | Werte |
|---|---|
| Erster Besuch bis bedienbar | 3,4 s / 3,7 s |
| Wiederholter Besuch (aus dem Cache) bis bedienbar | 0,34 s / 0,41 s |
| Wechsel zu „Übungen“ | 1,0 s / 1,1 s |
| Wechsel zu Planen, Training, Heute | 0,12–0,43 s |
| Scrollen der Bibliothek, Frame-Dauer | Median 13,9 ms, p95 27,8 ms |
| Detail öffnen | 1,1 s / 1,5 s (ohne Konkurrenz ca. 0,45 s) |

Im parallelen Volllauf (4 Browser gleichzeitig) maß derselbe Test bis zu 13,5 s für den Wechsel zu „Übungen“. Das ist Ressourcenkonkurrenz, keine Regression; der isolierte Wert bleibt maßgeblich. **Nicht real gemessen:** auf einem echten, schwachen Smartphone.

## 7. Screenshots

84 Screenshots liegen lokal in `screenshots/` (nicht in Git), Namensschema `<Breite>-<hell|dunkel>-<Nr>-<Ansicht>.png`:
- Onboarding, Heute, Übungen, Planen, Training, Mehr, Taktikboard,
- Detail-Sheet, Assistent, Export mit Vorschau, Block-Editor,
- jeweils bei 360, 390, 768 und 1280 px, hell und dunkel.

Selbst angesehen habe ich: 360 Heute und Planen, 360 dunkel Training, 768 dunkel Detail, 1280 Planen sowie während der Entwicklung 390 px aller Ansichten. Erneut erzeugen: `npx playwright test tests/layout.spec.cjs`.

## 8. Bekannte Fehler, Risiken, nicht getestete Bereiche

- **Nicht getestet:** physisches Handy, iOS/Safari, Firefox, echte Installation als App, Ton bei gesperrtem Bildschirm, Vibration, Wake Lock, natives Teilen-Menü, echter Druckdialog, Screenreader (NVDA/VoiceOver), Wischen zum Schließen der Sheets mit echtem Finger.
- **Skizzen:** Bei großen Spielformen (z. B. 6 gegen 6, 10 gegen 4) zeigt die Skizze höchstens 5 Spieler je Team. Sie bleibt ein schematischer Aufbau.
- **Fachlich:** Die Übungsinhalte sind redaktionell geprüft und mit Quellen belegt, aber nicht von einem externen Trainer abgenommen. Maße, Minuten und Altersgrenzen sind Vorschläge.
- **README.md** blieb wie verlangt unverändert und ist dadurch veraltet: Es beschreibt Stufe 5 und nennt `test-v5.cjs`, das es nicht mehr gibt.
- `serve.cjs` lauscht wie bisher nur auf 127.0.0.1. Ein Handy im WLAN erreicht den lokalen Server deshalb nicht.
- Zwischen einer Änderung und dem Speichern liegen 120 ms. Beim Schließen der Seite wird sofort gespeichert; bei einem harten Absturz innerhalb dieses Fensters könnte die letzte Änderung fehlen.
- Toasts mit „Rückgängig“ bleiben 6 s sichtbar und können auf kleinen Bildschirmen kurz Bedienelemente überdecken.
- Die Packliste wird nur für die laufende Sitzung abgehakt (wie in V20). Das ist bewusst so, aber eine mögliche Verwechslung.
- Wer nach V21 zu V20 zurückkehrt, sieht dort den V20-Stand vom Migrationszeitpunkt. Für den Rückweg mit späteren Änderungen gibt es das Backup im V20-Format.

## 9. Nächste sinnvolle Verbesserungen

1. Test auf echten Geräten (Android/Chrome, iPhone/Safari) inkl. Installation, Ton und Wake Lock.
2. Kalender- und Saisonplanung (`IDEEN-V21.md`). Das Datenmodell hat dafür schon ein Feld `date`.
3. Fachliche Durchsicht des Katalogs durch eine qualifizierte Trainerin oder einen qualifizierten Trainer, besonders Torwart und Falltechnik.
4. Skizzen für große Spielformen mit allen Spielern.
5. Barrierefreiheit mit Screenreader prüfen; Fokusführung in Sheets verfeinern.
6. Optional: Teilen per Link/QR ohne Server (`IDEEN-V21.md`).
