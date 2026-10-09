# TRAINR – Ideen für später (V21+)

Größere Ideen, die in V21 nicht oder nur in einer Grundform umgesetzt werden. Aufwand: S (< 1 Tag) · M (1–3 Tage) · L (1–2 Wochen) · XL (> 2 Wochen bzw. Infrastruktur nötig).

| Idee | Nutzen | Aufwand | Anmerkung |
|---|---|---|---|
| Kalender mit Wochen- und Saisonansicht, Serien (z. B. „jeden Dienstag“), ICS-Export | Einheiten mit Datum planen, Saisonüberblick | L | In der Rückfrage für V21 bewusst zurückgestellt. Das V21-Datenmodell lässt ein optionales Datum je Einheit zu, damit das später ohne Migration ergänzt werden kann. |
| Geräteübergreifende Synchronisierung (Ende-zu-Ende-verschlüsselt) | Pläne auf Handy und Laptop gleich | XL | Braucht Server/Konto – widerspricht aktuell „lokal, ohne Konto“. |
| Teilen per Link/QR ohne Server (Plan komprimiert in URL-Fragment) | Co-Trainer bekommt Plan ohne Datei | M | Datenmenge begrenzt; eigene Übungen mit Animation werden lang. Kandidat für V21.x. |
| Sprachansagen im Trainingsmodus (`speechSynthesis`) | Blockwechsel ohne Blick aufs Handy | S–M | Offline-Stimmen je Gerät unterschiedlich; Qualität schwer testbar. |
| Belastungssteuerung über die Saison (Intensität je Block, Wochenkurve) | Bessere Periodisierung | L | Fachlich heikel für Kinder; nur als Orientierung, keine Normen. |
| Anwesenheit/Gruppenstärke je Termin (nur Zahlen, keine Namen) | Realistische Planung der Teilnehmerzahl | M | Ohne personenbezogene Daten machbar. |
| Druckbare Übungskarten (A6) als Kartenset | Laminierte Karten für den Platz | M | Baut auf dem neuen Druck-Layoutsystem auf. |
| Taktikboard mit Aufnahme mehrerer Phasen als Animation + Export als Video/GIF | Spielzüge erklären | L | Video-Encoding im Browser aufwändig; Bildfolgen-Export einfacher. |
| Import von Übungen aus geteilten TRAINR-Dateien (Übungspakete) | Austausch unter Trainern im Verein | M | Validierung + Konfliktbehandlung der IDs nötig. |
| Vereinsmodus mit gemeinsamer Übungssammlung | Einheitliche Ausbildungslinie | XL | Braucht Server oder Datei-Austausch-Workflow. |
| Mehrsprachigkeit | Mehr Nutzer | M | Aktuell bewusst nur Deutsch. |
| Native Hüllen (TWA/Capacitor) für App Stores | Sichtbarkeit, Push | L | Veröffentlichung entscheidet der Nutzer. |
| Hintergrund-Alarm über Notifications/Push | Ton auch bei gesperrtem Bildschirm | L | Ohne Server nur eingeschränkt möglich (Notification Triggers sind nicht standardisiert). |
| Smartwatch-Begleiter | Timer am Handgelenk | XL | Plattformspezifisch. |
| Lernpfade/Curriculum je Altersklasse (z. B. 8-Wochen-Block) | Rote Linie über Wochen | L | Inhalte bräuchten fachliche Prüfung durch qualifizierte Trainer. |
| Statistiken (meistgenutzte Übungen, Kategorien-Verteilung je Monat) | Selbstreflexion | M | Lokal berechenbar; Grundform „zuletzt benutzt“ kommt in V21. |
