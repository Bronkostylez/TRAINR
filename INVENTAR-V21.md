# TRAINR – Inventar-Abgleich V20 → V21

Stand: 9. Oktober 2026 · Grundlage: `INVENTAR-V20.md` (IDs F-xx, S-xx, D-xx) und die Playwright-Suite in `tests/`.

**Status:**
- ✅ umgesetzt und durch einen automatischen Test geprüft
- 🟡 umgesetzt, aber nur teilweise automatisch geprüft oder nur per Screenshot gesichtet (Grund steht in der Zeile)
- 🔁 bewusst anders gelöst (Ersatz steht in der Zeile)
- ❌ entfallen

**Testnachweise** (Dateien in `tests/`): ON = onboarding · LIB = library · PL = planner · TR = training · EX = exports · CTB = custom-teams-board · MIG = migration · MO = motion-offline · UPD = update · LAY = layout · PERF = performance · AG = assistant-gestures.

Letzter Lauf: **37 von 37 Tests bestanden** (`npx playwright test`, Chrome 154, Windows 11, zweimal hintereinander ohne Fehler).

## Onboarding & Profil

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-01 | Onboarding: Trainerart, Altersklasse, Tage, Zeiten | Willkommens-Assistent in 4 Schritten (Name & Trainerart · Altersklasse · Tage · Zeiten) | ON „Onboarding mit Fehlerfällen…“ | ✅ |
| F-02 | Fehler bei fehlendem Tag und bei Ende vor Beginn | Gleiche Prüfungen mit Fehlermeldung und Haptik | ON | ✅ |
| F-03 | Profil später ändern, Pläne mit wegfallendem Tag umstellen | Mehr → Mannschaften → Bearbeiten | ON (Altersklasse geändert) | 🟡 Umstellung der Pläne bei wegfallendem Tag ist umgesetzt (`more.js`), aber nicht eigens getestet |
| F-04 | Profilzusammenfassung | Mannschafts-Chip oben, Zeile über der Überschrift auf „Heute“, Mehr | CTB (Chip), LAY | ✅ |
| F-05 | Hinweis bei Bambini + Torwart | Assistent ersetzt Torwarttraining durch Ballspiele mit Hinweis; Einheitencheck warnt | ON „Bambini + Torwart…“, AG-Matrix | ✅ |

## Navigation & Shell

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-10 | 4 Bottom-Tabs mit Icons und gleitender Markierung | 5 Bottom-Tabs (Heute · Übungen · Planen · Training · Mehr), gleitende Markierung; ab 1024 px Seitenleiste | alle E2E-Tests, LAY | ✅ |
| F-11 | Hash-Routing; Zurück-Taste schließt zuerst Sheets | Router mit `#heute/#uebungen/#planen/#training/#mehr/#taktik`; die alten Adressen `#plan` und `#profil` funktionieren weiter | AG „Alte V20-Adressen…“ | ✅ |
| F-12 | Wischen zwischen Tabs, Titel in der Leiste beim Scrollen | Wischen auf Touch-Geräten unter 1024 px; Titel blendet beim Scrollen ein | AG „Wischen zwischen Tabs“ | ✅ |
| F-13 | Desktop: Bibliothek und Planer nebeneinander | Planen ab 1100 px mit Bibliotheksspalte | PL „Desktop: Drag & Drop…“ | ✅ |
| F-14 | Bottom-Sheets mit Griff und Wischen zum Schließen | Alle Dialoge als Sheets (Griff, Wischen, Esc, Hintergrund, Zurück-Taste) | AG (Zurück-Taste), alle Tests (Esc) | 🟡 Wischen zum Schließen ist für Touch umgesetzt, aber nicht automatisch getestet |
| F-15 | Online/Offline-Badge | Toast beim Wechsel online/offline; Offline-Hinweis im Update-Flow | MO (Offline-Betrieb) | 🔁 Statt eines dauerhaften Badges gibt es einen Toast beim Wechsel. Der Toast selbst ist nicht getestet |
| F-16 | Statusmeldungen | Toasts (`role=status`) mit Aktion „Rückgängig“ oder „Weiter“ | PL, CTB | ✅ |
| F-17 | Manifest-Shortcuts | 4 Shortcuts, eigene PNG-Icons | MO (Manifest und Icons im Cache) | 🟡 Shortcuts nicht auf einem Gerät gestartet |

## Heute

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-20 | Begrüßung mit Kontext | Nächster Trainingstermin („heute“, „morgen“, „in x Tagen“) | LAY | ✅ |
| F-21 | Einheit in einem Schritt | „Neue Einheit in einem Schritt“ mit Schwerpunkt, Minuten, Spielern und **Strategie** | ON, PL, TR (über `createSession`) | ✅ |
| F-22 | Ablaufliste mit ±Minute, Tauschen, Antippen zum Bearbeiten | Zeitstrahl mit Uhrzeiten, ↻ Tauschen, Antippen öffnet den Block-Editor. ±Minute liegt im Block-Editor und in Planen | PL (Tauschen, Minuten) | ✅ |
| F-23 | Letzte Änderung zurück (1 Stufe) | **Globales Rückgängig/Wiederholen** (40 Stufen, Strg+Z/Strg+Y, Knopf oben, Toast-Aktion) | PL | ✅ |
| F-24 | Training starten (Timer startet) | „Training starten“ im Kopfbereich der Einheit | TR | ✅ |
| F-25 | Schnell-Hinzufügen mit 6 Vorschlägen | Sheet mit 12 begründeten Vorschlägen und Suche | PL „Schnell-Hinzufügen…“ | ✅ |
| F-26 | Gespeicherte Einheiten & Plan-Ticket | Kopfbereich der Einheit auf „Heute“; Einheiten-Liste unter Planen | PL | ✅ |
| F-27 | Hinweis „V15 Katalog überarbeitet“ | Migrations-Toast und Hinweis unter Mehr; Quellen und Prüfung in `SOURCES.md` | MIG (Toast) | 🔁 |
| F-28 | Links zu manueller Planung, Assistent, Notizen | Schnellzugriffe: Übung hinzufügen, Bibliothek, Packliste, Taktikboard | LAY | ✅ |

## Übungsbibliothek

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-30 | Karten mit Skizze, Minuten, Gruppen, Alter, Material, Begründung | Karten mit Skizze, Ziel, Schwierigkeit, Bewertung und Begründung; auf dem Handy kompakt | LIB, LAY | ✅ |
| F-31 | Volltextsuche | Suche über Name, Kategorie, Beschreibung, Ziel, Material und eigene Notiz | LIB | ✅ |
| F-32 | Filter: Schwerpunkt, Trainerart, Alter, Material | Kategorie-Chips (mehrfach wählbar) und Filter-Sheet (Trainerart, Alter, Material, **Schwierigkeit, Dauer**, Archiv) | LIB | 🟡 Material- und Dauerfilter nicht eigens getestet |
| F-33 | „Passende Vorschläge zuerst“ mit Begründung | Sortierung „Passend zuerst“ (Gruppen, Schwerpunkt, Restzeit, schon im Plan, **Bewertung, Merkliste**) mit Begründung; weitere Sortierungen | LIB, LAY | 🟡 Begründung sichtbar; die Punktwerte sind nicht einzeln getestet |
| F-34 | Merkliste | ♥ auf jeder Karte, Bereich „Merkliste“ | LIB (inkl. Neuladen) | ✅ |
| F-35 | Aktive Filter, Zurücksetzen, Zähler, Leerzustände | Gleiches, plus Badge am Filterknopf | LIB | ✅ |
| F-36 | Drag & Drop Karte → Plan, „+ In den Plan“ | Desktop-Ziehen in Planen; „Plan“-Knopf auf jeder Karte | PL Desktop, LIB | ✅ |
| F-37 | Animierte Kartenskizzen (max. 3 gleichzeitig) | Unverändertes Prinzip; pausieren bei offenem Sheet und verstecktem Tab | MO | ✅ |

## Übungsdetail

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-40 | Detail mit Skizze, Ablauf, Material, Coaching, Quelle | Detail-Sheet mit **Ziel, Coaching-Punkten, mehreren Quellen (mit „Belegt:“)**, ähnlichen Übungen | LIB | ✅ |
| F-41 | Player: Abspielen, Tempo, Zeitleiste, Schritte, Autoplay, Kamera | Gleicher Funktionsumfang (`scene/player.js`) | MO (läuft bzw. stoppt), Skizzen-Kompiliertest während der Entwicklung | 🟡 Tempo und Zeitleiste nicht automatisch getestet |
| F-42 | Schrittweise Darstellung ohne Animation | „Nächster Schritt“-Bedienung | MO | ✅ |
| F-43 | Blättern: Knöpfe, Pfeiltasten, Wischen | Gleiches | LIB (Pfeiltaste) | 🟡 Wischen im Detail nicht getestet |
| F-44 | Deine Variante (Spieler, Minuten) | Ausklappbereich „Deine Variante“ | LIB | ✅ |
| F-45 | Einfacher/anspruchsvoller je Kategorie | „Leichter / schwerer“ | LAY (sichtbar) | 🟡 |
| F-46 | In den Plan, eigene Übung bearbeiten | Gleiches, plus „Als eigene Übung anpassen“ für Katalogübungen | LIB, CTB | ✅ |
| F-47 | Übergang Karte → Detail (Shared Element) | Sheet-Einblendung | – | 🔁 Bewusst vereinfacht, weil der Übergang Leistung kostete und mit dem Sheet-Modell kollidiert |

## Eigene Übungen

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-50 | Formular | Editor-Sheet, ergänzt um **Ziel** | CTB | ✅ |
| F-51 | Strukturierte Materialliste | Zeilen mit Menge und Name | CTB | ✅ |
| F-52 | Animationseditor: Antippen, Pfeiltasten, 2–20 Schritte, Vorschau, Keeper lila | Gleiches, plus **Ziehen** und Geisterpositionen des vorigen Schritts | CTB (Antippen, Schritte, lila Keeper) | 🟡 Pfeiltasten-Bedienung nicht getestet |
| F-53 | Eigene Übung bearbeiten (gleiche ID) | Gleiches | CTB | ✅ |
| F-54 | Validierung | Gleiches (nur https-Quellen) | CTB | ✅ |
| neu | – | **Eigene Übung löschen** (entfernt sie auch aus Plänen; Rückgängig möglich) | CTB | ✅ |

## Planer

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-60 | Mehrere Einheiten: wählen, umbenennen, neu, löschen, duplizieren | Einheiten-Sheet, Titel direkt bearbeitbar, Menü ⋯ | PL | 🟡 Umbenennen nicht eigens getestet |
| F-61 | Trainingstag, Spieler gesamt, Schwerpunkt | Fakten-Chips mit Stepper bzw. Auswahl-Sheet; zusätzlich **Altersklasse je Einheit** | PL (Spieler) | 🟡 Tag- und Schwerpunktwahl nicht eigens getestet |
| F-62 | Zusammenfassung „x Min frei / zu lang“ | Zeitbudget-Balken mit Text | LAY | 🟡 |
| F-63 | Blöcke: Minuten, ↑↓, Entfernen mit Undo, D&D, Warnungen | Gleiches plus **Ziehen am Griff (Touch, Maus, Tastatur)** und Uhrzeit je Block | PL (alle Teile) | ✅ |
| F-64 | Block bearbeiten (Minuten, Spieler je Block) | Block-Sheet, plus **Blocknotiz, Duplizieren, Tauschen-Vorschläge** | PL | ✅ |
| F-65 | Gruppenberechnung | `planning.js groupsFor/fit` | PL, AG | ✅ |
| F-66 | Materialbedarf und Checkliste | Reiter „Packliste“ (Material und feste Ausrüstungspunkte, gilt für die Sitzung, teilbar) | PL | ✅ |
| F-67 | Coaching-Notizen | Reiter „Notizen“ (bis 2000 Zeichen) und **Trainingsziel** | PL | ✅ |
| F-68 | Einheitencheck mit Zeitstrahl | Reiter „Check“ mit Warnungs-Badge und Zeitplan | PL | ✅ |
| F-69 | Nummerngruppen ohne Namen | Reiter „Check“ → Gruppen ohne Namen | PL | ✅ |
| F-70 | Planassistent (deterministisch, eine Strategie) | **4 Strategien, Begründungen, Alternativen je Block, Neu würfeln, Übernahme als neue Einheit oder in die aktuelle** | PL, AG (5244 Kombinationen) | ✅ |
| F-71 | Hinzufügen stoppt den laufenden Timer nicht | Gleiches | PL | ✅ |
| neu | – | **Vorlagen** (speichern, verwenden, löschen) | PL | ✅ |

## Trainingsmodus

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-80 | Timer mit Zielzeit: Start, Pause, Zurücksetzen, Weiter, Fortschritt | Timer mit Ring, Zurück und Weiter, Segmentleiste, **+1 Min**, Gesamtzeit, Zustand übersteht Neuladen | TR | ✅ |
| F-81 | Ton und Toast am Blockende | Signalfolge, Toast mit „Weiter“, Haptik; **Vorwarnung, Auto-Weiter** | TR (Toast, Vorwarnung, Auto-Weiter) | 🟡 Hörbarer Ton nicht geprüft |
| F-82 | Live-Coaching | Karte mit Ziel, Coaching-Punkten, Material, Gruppen und Blocknotiz | LAY | 🟡 |
| F-83 | Übungsanimation neben dem Timer | Läuft mit dem Timer, eigene Pause, Schritt ←/→ | MO (reduziert), LAY | 🟡 Synchronlauf nicht ausdrücklich geprüft |
| F-84 | Einstieg in einen beliebigen Block | Segmentleiste antippen | TR | ✅ |
| F-85 | Update gesperrt, solange der Timer läuft | Gleiches | UPD | ✅ |
| neu | – | **Fokusmodus** (blendet Navigation aus), Leertaste startet und pausiert, **Bildschirm bleibt an** (Wake Lock) | – | 🟡 Wake Lock headless nicht prüfbar |

## Exporte, Druck, Backup

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-90 | Text | Export-Sheet → Text | EX | ✅ |
| F-91 | CSV mit BOM, Formelschutz | Gleiches, mehr Spalten | EX | ✅ |
| F-92 | Drucken / als PDF sichern | Druck-HTML je Layout (Übungskarten mit Skizzen); Strg+P druckt die aktuelle Einheit | EX (Druck-HTML) | 🟡 Echter Druckdialog nicht automatisierbar |
| F-93 | PNG-Seiten | PNG je Seite aus demselben Seitenlayout | EX | ✅ |
| F-94 | PDF (gerastert) | **PDF mit echtem, durchsuchbarem Text**, 4 Layouts × 2 Stile, Vorschau | EX (alle 8 Kombinationen, xref geprüft) | ✅ |
| F-95 | Backup herunterladen und wiederherstellen | V21-Backup (alles inkl. Merkliste und Einstellungen), **V20-Backups importierbar**, **Backup im V20-Format** | EX | ✅ |
| F-96 | Hinweise zum Speicher | Mehr → Daten; Erinnerung auf „Heute“, wenn länger als 14 Tage kein Backup | LAY | ✅ |
| neu | – | **Teilen**: PDF über das System-Teilen-Menü, Einheit als `.trainr.json` (importierbar), Packliste als Text | EX (Datei und Import) | 🟡 Natives Teilen-Menü headless nicht prüfbar (Fallback Download getestet) |

## Einstellungen, Motion, Feedback

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-100 | Animationsschalter, Vorrang der Systemeinstellung „weniger Bewegung“ | **3 Stufen (Voll, Reduziert, Aus)**; System begrenzt auf „Reduziert“; Wechsel zur Laufzeit stoppt Animationen | MO (beide Tests) | ✅ |
| F-101 | Vibration | Schalter unter Mehr; Muster je Aktion | – | 🟡 Nur auf echten Geräten prüfbar |
| F-102 | Effekte: Halo, Tilt, Schweben, Kinetic Type, Count-up, Iris, Drift | Ansichtsübergänge, gestaffeltes Einblenden, Druck-Feedback, Sheet-Animation, FLIP beim Umsortieren, Puls, Tab-Markierung, Timer-Ring | MO | 🔁 Die rein dekorativen Effekte (Halo, Tilt, Schweben, Kinetic Type, Count-up, Iris, Drift) sind zugunsten von Leistung und Ruhe entfallen. Keine Nutzerfähigkeit hängt daran |
| F-103 | Animationen pausieren bei Drag und verstecktem Tab | Gleiches, zusätzlich bei offenen Sheets | MO | ✅ |
| neu | – | **Dunkelmodus, Vereinsfarbe (Torwart bleibt lila), Schriftgröße, Signaltöne, Auto-Weiter, Vorwarnung, Bildschirm an** | LAY (dunkel), TR | ✅ |

## PWA, Offline, Update

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-110 | Service Worker, Offline | Precache aller Module, Cache `trainr-v21.0.0` | MO „Offline…“ | ✅ |
| F-111 | Update-Leiste, SKIP_WAITING, manuelle Prüfung | Gleiches Prinzip (`ui/update.js`) | UPD (echt V20 → V21 und V21 → V21.x) | ✅ |
| F-112 | Installierbar | Manifest mit PNG-Icons; „App installieren“ unter Mehr, wenn der Browser es anbietet | – | 🟡 Installation nicht real durchgeführt |
| F-113 | iOS-Meta, Safe Area | Gleiches | – | 🟡 Kein iPhone verfügbar |
| F-114 | Hinweis bei `file://` | Toast | – | 🟡 |

## Inhalte und Sicherheit

| V20 | Alte Funktion | Neue Stelle | Testnachweis | Status |
|---|---|---|---|---|
| F-120 | Info-Seite (Datenschutz, Installation, Sicherheit, öffentlicher Link) | Mehr → Daten, „Übungen & Sicherheit“, „Aufs Handy“ | LAY | ✅ |
| F-121 | Branding | `BRAND` in `core/util.js` | – | ✅ |
| F-122 | Hinweise „keine Spielernamen“ | In allen Freitextfeldern | – | ✅ |

## Sonderfälle und Datenflüsse

| V20 | Regel / Datenfluss | V21 | Testnachweis | Status |
|---|---|---|---|---|
| S-01 | Spielerzahlen ohne Trainer | Unverändert, in Texten und Exporten | EX (Text) | ✅ |
| S-02 | Gruppen passen nicht → Warnung | Block, Check, Exporte | PL | ✅ |
| S-03 | Falltechnik nie automatisch | Assistent, Tausch, Schnell-Hinzufügen, Zufall | AG, LIB | ✅ |
| S-04 | Keine Torwartübungen für Bambini | Katalog und Assistent (bis F-Jugend) | LIB, AG, ON | ✅ |
| S-05 | Grenzen des Assistenten | 20–150 Min, 1–60 Spieler | AG | ✅ |
| S-06 | Limits | 300 Einheiten, 100 Blöcke, 500 eigene Übungen, 20 Mannschaften, 100 Boards, 5 MB Backup | – | 🟡 Grenzen im Schema, nicht ausgereizt getestet |
| S-07 | Neue Einheiten ersetzen nie bestehende | Gleiches | PL | ✅ |
| S-08 | Spieler-Override entfällt, wenn gleich der Einheit | Gleiches | PL | ✅ |
| S-09 | Neue Blöcke übernehmen die Varianten-Minuten | Gleiches | – | 🟡 |
| S-10 | Plan-Alter vor Profil-Alter | Gleiches, jetzt einstellbar | MIG | ✅ |
| S-11 | Escaping, CSV-Schutz, nur https | Gleiches | EX, CTB | ✅ |
| S-12 | Timer läuft bei Ansichtswechsel weiter | Gleiches, plus Wiederherstellung nach Neuladen | TR | ✅ |
| S-13 | Keeper immer lila | Fest in den Tokens, unabhängig von Theme und Vereinsfarbe | CTB, LIB, Kompiliertest | ✅ |
| S-14 | Skizzen sind keine Technikdemonstration | Hinweis im Detail und im Trainingsmodus | – | ✅ |
| D-01 | Laden; ungültige Daten werden beim Speichern überschrieben (Risiko) | **Behoben:** Rohdaten werden unter `trainr-v21-recovery-*` gesichert | MIG | ✅ |
| D-02/03 | Drei Speicher | Ein Speicher `trainr-v21`; alte Schlüssel werden nur gelesen | MIG, UPD | ✅ |
| D-04/05 | Backup und Import | Vollständig, beide Formate | EX | ✅ |
| D-06 | Pläne referenzieren Übungs-IDs | Unverändert, archivierte IDs bleiben auflösbar | MIG | ✅ |
| D-07 | Varianten | `exerciseMeta[id].variant` | LIB, MIG | ✅ |
| – | `keeperboard-v1` nie verändern | Wird weder gelesen noch geschrieben | MIG, UPD (byte-genau) | ✅ |

## Neue Funktionen in V21 (zusätzlich)

Mehrere Mannschaften (CTB ✅) · Taktikboard mit Formationen, Pfeilen, mehreren Boards und Bild-Export (CTB ✅) · Bewertungen und eigene Notizen je Übung (LIB ✅) · Zuletzt benutzt, Zufall, ähnliche Übungen (LIB ✅, „Zuletzt“ 🟡) · Schwierigkeitsstufen (LIB 🟡) · Vorlagen (PL ✅) · Exportlayouts und Stile (EX ✅) · Teilen (EX 🟡) · Kontexthilfe und kurze Einführung (ON ✅) · 7 neue Übungen mit Quelle (LIB ✅).

**Offen:** Keine V20-Fähigkeit fehlt ersatzlos. Die mit 🟡 markierten Punkte sind umgesetzt, aber nicht vollständig automatisch geprüft.
