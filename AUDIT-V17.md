# TRAINR V17 audit

V17 keeps the same local plan format and all 100 exercise IDs. No accounts, payments, community or player names. README unchanged.

## Build loops

1. Reproduced the V16.1 baseline and old coordinate-touch test issue; fixed plan-age filtering, full-plan variant mutation, name length, next-block bounds, import cancellation/stale variants and the home action overlap.
2. Added coaching notes (including text/print/PDF/PNG exports), copy-plan, balanced numbered groups, timing/group/age checks, and kept material ticks during plan renders. Added easier/harder coaching options per exercise category without imposing fixed rules.
3. Reviewed exercise organization and animations. Clarified paired ball exchange, shadow dribbling and two-exit feints, with exact pair counts and equipment. Corrected shadow positioning in text and ball-shielding animation; removed duplicated safety sentences and stray spaces in 13 entries. Changed the field-player proposal to activation, playing, focused technique, playing, with two thirds of the suggested budget in games. No claim of external trainer approval.

## Performance and UI

Disconnected card scenes are now unobserved and their timelines destroyed instead of accumulating observer targets. Versioned static files use the already installed service-worker cache, avoiding redundant network reads. Animation limits and reduced motion remain. Home catalog warning is expandable; its full text remains. Detail add action is reachable in the bottom sheet. Compact header title is hidden on narrow phones to avoid overlap with status controls. No functions removed.

## Sources checked for this round

- https://www.dfb-akademie.de/beste-trainingseinheit/-/id-11011533
- https://training-service.fussball.de/trainer/e-juniorin/artikel/techniktraining-in-kleinen-und-mittleren-spielformen-3575/
- https://training-service.fussball.de/trainer/e-juniorin/training-online/trainingseinheiten-detail/kreative-loesungen-im-1-gegen-1-suchen-630/

These support small games, many ball actions, simple rules and room for decisions. Dimensions, duration allocations, grouping and category variants are editorial choices, not official standards. Existing keeper safety caveats remain. The diagrams show organization, never safe catching or landing technique.

## Verification

Chrome/Playwright checks: original core suite, V5 proposal matrix and exports, V6 drill identity/update guard, V7 coordinate-touch/motion tests, V8 scene pacing/performance tests, V15 catalog/timelines, V16 shell/navigation/offline, custom editor, structured equipment/edit/restore, material filters, flexible variants, and V17 coach features. Tests corrected where they depended on stale version strings or too-short drag/drop viewport after added content.

A real service-worker update from V16.1 to V17 was tested with plans, custom drill, favorites and local variants byte-identical online and offline. No real phone, iOS install flow or on-pitch coaching test. No claim that this is a full professional review of all exercises.
