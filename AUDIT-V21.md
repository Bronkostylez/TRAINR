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
