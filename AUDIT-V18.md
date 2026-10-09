# V18: one session workspace

Main path: choose focus, minutes and player count on Today, create a new session, adjust its blocks in place, start the running timer with one action. Profile age/type/slot supply defaults. Existing sessions are never replaced by creation.

- Same-category one-tap replacement uses age, trainer type and group fit; keeps block minutes. Fall technique is not selected automatically.
- +/- minute controls, last-change undo and a short add sheet. Full library and custom editor remain available.
- Advanced proposal preview, saved sessions, notes, groups, exports, materials, manual ordering and exercise variants remain available. No storage schema change, accounts, community or README change.
- Motion and the existing purple keeper illustrations remain intact. Reduced-motion mode respected.

## Measured walkthrough

After onboarding, with default values, excluding scrolls and typing:

V17: Home plan -> suggest -> accept -> live view -> timer start = 5 taps.
V18: Create session -> start training (timer runs) = 2 taps.
A V18 block swap or +/- minute change takes one tap. Suggested quick add takes two taps. Changing the focus requires opening/selecting its dropdown; changing time or player count requires editing a field, so these are not included in the default-path comparison.

## Tests

V18 flow, original session preservation, swap/time/undo/add, running timer, advanced preview, notes and full library; 360/390/768/1280px layouts; no page errors. V17 regression adapted only to expanded advanced notes drawer. Data/editor/material/variant and V15 catalog regression.
Actual V17 (a076aebd0a2f1d3a49af3b1352faba7dd0272b14) to V18 service-worker update: byte-identical plans, custom exercises, favorites and local variants, online and offline reload. No real device or Safari test. Training content still needs coach judgement in practice.
