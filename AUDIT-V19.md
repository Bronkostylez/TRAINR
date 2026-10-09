# TRAINR V19: exercise schematic with the training timer

Prepared locally from public main a0269d017c211d7a6c5682e752113b478b294922. No public publication yet.

- Existing animated exercise choreography appears in the live timer view, loops while the block runs, and follows the current exercise.
- Clock and diagram are stacked on small screens and paired on larger screens. Clock paints do not recreate the scene.
- Timer pause, reset, block end and next block control the visual correctly. An independent animation pause does not stop the timer.
- Leaving the live view, opening a dialog or hiding the document pauses the visual only. Timer remains deadline-based.
- System reduced motion and the app animation switch have priority. Manual steps remain available.
- Own keyframe animations use the same renderer; drills without choreography show their setup and steps without pretending to have a video.
- Existing safety disclaimer, coaching, materials and source access remain. No external clips, embeds, accounts or player information.
- Storage keys and records remain unchanged. README unchanged.

## Checks

Chrome/Playwright phone simulations at 360 and 390 px, tablet 768 px and desktop 1280 px. Pixels inspected for the 390 px field drill, 360 px keeper drill and 1280 px paired layout. Fixed the old fullscreen clock overflowing its desktop column during inspection. No horizontal overflow after the fix. Small screens can scroll to the animation controls and coaching notes.

PASS: V19 stable timeline, loop, independent visual pause, timer pause/resume/reset/completion, next block, view/dialog pause, system/app reduced motion, manual steps, own-animation and static fallback, keeper markers, empty plan and no page errors.

PASS: real V18 -> V19 service-worker update from the public V18 commit; byte-identical local plans, custom drills, favorites and variants, offline reload, and offline animation/timer startup.

PASS: V18 quick flow, V17 coach regression, V15 full 100-entry scene/catalog regression, data/backup, editor, material filters and flexible variants.

The V15 test's expected version was updated from 18.0.0 to 19.0.0. Its assertions are otherwise unchanged.

No physical phone, iOS/Safari, or on-pitch coaching test. Screen locking may suppress sound, as before. Animation is an existing schematic, not a real video or technique demonstration.
