# TRAINR – Fachliche Quellen (V21)

Geprüft am 9. Oktober 2026: Alle acht Seiten waren erreichbar, ihr Inhalt wurde gelesen und mit der Zuordnung abgeglichen. Bei fussball.de erschien dabei ein Hinweis auf technische Probleme der Seite; die Artikel selbst luden vollständig.

Jede Übung verweist auf eine oder mehrere dieser Quellen (`src/data/drill-meta.js`). Die Übungen sind eigene Kurzfassungen und Varianten, keine kopierten Texte, Bilder oder Videos. **Die Quellen stützen die Trainingsprinzipien. Sie belegen nicht die hier vorgeschlagenen Feldmaße, Minuten, Materialmengen oder Altersgrenzen.** Diese Angaben sind redaktionelle Vorschläge und keine offiziellen Normen. Es gab keine externe Abnahme durch Trainer; ob eine Übung vor Ort passt, entscheidet der Trainer.

| Schlüssel | Quelle | Was sie belegt | Verwendet bei |
|---|---|---|---|
| `phil` | [DFB: Trainingsphilosophie Deutschland](https://www.dfb.de/mehr-fussball/dfb-akademie/trainingsphilosophie-deutschland) | Freude, Intensität und Wiederholung als Qualitätskriterien; viele Ballkontakte; keine Standzeiten; kleine Spielformen | 6 Übungen |
| `beste` | [DFB-Akademie: Die beste Trainingseinheit](https://www.dfb-akademie.de/beste-trainingseinheit/-/id-11011533) | Ablauf Aktivierung → Spielen → Technikblock → Spielen; jedes Kind mit Ball; kleine Spiele auf mehreren Feldern; Grundlage der Assistent-Strategie „Klassisch“ | 37 Übungen |
| `tech` | [fussball.de: Techniktraining in kleinen und mittleren Spielformen](https://training-service.fussball.de/trainer/e-juniorin/artikel/techniktraining-in-kleinen-und-mittleren-spielformen-3575/) | Wiederholungen; Form und Größe des Feldes sowie Regeln als Steuerung; beim Dribbelschwerpunkt Dribbellinien statt Minitore; Beispiele 6 gegen 6 auf Dribbeltore und 10 gegen 4 | 68 Übungen |
| `ev1` | [fussball.de: Kreative Lösungen im 1 gegen 1 suchen](https://training-service.fussball.de/trainer/e-juniorin/training-online/trainingseinheiten-detail/kreative-loesungen-im-1-gegen-1-suchen-630/) | Rollenwechsel und Konter im 1 gegen 1, Wahl zwischen zwei Toren, wenig unterbrechen, Kreativität loben | 15 Übungen |
| `passes` | [fussball.de: Viele Pässe und Schüsse](https://training-service.fussball.de/trainer/e-juniorin/training-online/trainingseinheiten-detail/viele-paesse-und-schuesse-1957/) | Pass-Feld 10 x 10 m, Orientierung vor der Ballannahme, Annahme mit der Innenseite und Abschluss, Turnier 2 gegen 2 mit Rollenwechsel | 24 Übungen |
| `kgrund` | [DFB-Akademie: Grundtechniken der Torhüter*innen](https://www.dfb-akademie.de/teil-4-grundtechniken-der-torhueterinnen/-/id-11011651) | Fangen hoher Bälle (Dreieck), Korbtechnik, Aufnehmen flacher Bälle, Abkippen und Abtauchen mit Schrittfolge, weiche Landung | 14 Übungen |
| `kanfang` | [fussball.de: Der Anfang der Torhüterausbildung](https://training-service.fussball.de/trainer/d-juniorin/artikel/der-anfang-der-torhueterausbildung-221/) | Systematische Torwartausbildung beginnt bei den D-Junioren; Grundstellung, Aufnehmen, Fangen ohne Gegnerdruck, Fallen nur bei flachen Bällen, Abrollen; Feldspielertechniken. Grundlage für „Falltechnik erst ab D-Jugend“ | 20 Übungen |
| `kbeginn` | [fussball.de: Technisch-taktisches Torhütertraining beginnen](https://training-service.fussball.de/trainer/d-juniorin/artikel/technisch-taktisches-torhuetertraining-beginnen-2298/) | Keine frühe Spezialisierung; spielerischer Charakter; Torhüter spielen weiter im Feld. Grundlage dafür, dass Bambini und F-Jugend kein Torwarttraining vorgeschlagen bekommen | 7 Übungen |

Die Zählung stammt aus `src/data/drill-meta.js` (107 Übungen, viele mit zwei Quellen).

## Feste Regeln im Katalog (durch Tests abgesichert)

- Spielerzahlen zählen ohne Trainer.
- Es gibt keine Kopfballübungen.
- Falltechnik gibt es nur ab D-Jugend. Der Assistent, der Tausch und das Schnell-Hinzufügen schlagen sie nie automatisch vor.
- Torwartübungen gibt es nicht für Bambini. Bei Bambini und F-Jugend ersetzt der Assistent das Torwartprofil durch allgemeine Ballspiele für alle Kinder.
- Die Übungs-IDs sind stabil. Zwei ersetzte Varianten sind archiviert: `activation` (ähnlich wie `traffic` und `gates`) und `left-right` (ähnlich wie `gatepass`). Sie bleiben in alten Plänen auflösbar.

Ältere Prüfprotokolle: [AUDIT-V15.md](AUDIT-V15.md) (Überarbeitung aller 100 Übungen in V15).
