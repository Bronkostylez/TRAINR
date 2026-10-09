# TRAINR

A local football training planner for outfield coaches, goalkeeper coaches and mixed sessions. Pick your age group and weekly slots, browse a sourced library, then build a session that fits your time and players. German interface, no account, backend, analytics or player records.

The repository still has its original KEEPERBOARD name. The app is TRAINR. This repository and its commit history are public. Open the live app at https://bronkostylez.github.io/KEEPERBOARD/. Your training data stays in your browser, not in the repository.

## Stage 5: library, plan assistant and exports

- Today screen with the selected session, one-tap planning and training. Four bottom navigation tabs: Today, Drills, Plan and Training. Large controls, short view transitions and reduced-motion support.
- Compact drill cards; advanced filters, session settings and exports open when needed. Desktop keeps the library and planner side by side for drag and drop.
- A separate training screen with a large timer, progress bar, setup and coaching notes. Switching views does not pause or reset the timer.
- Three-step onboarding: coach type, Bambini through adult men, training days and start/end times. Edit the profile later.
- 100 original short drill adaptations, with category, age bands, players per group, equipment quantities, coaching and source links. Field, goalkeeper and mixed games.
- Search plus category, coach-type and age filters. Add your own drills locally.
- Explainable recommendations, not an online AI model: filter by age and coach type, rank by player grouping (+100), focus (+40), remaining time (+20), and avoid repeats (-30). The rule-based plan assistant previews a full session from focus, time, age and player count. Accept it as a new session without overwriting old plans. No claim of an optimal or certified programme.
- Drag exercises into the plan and reorder blocks. On phones use the add and up/down buttons. Set block minutes, player count, focus and weekly slot; save multiple sessions.
- Show time remaining or overrun, group-size warnings and material requirements. Sequential blocks reuse equipment; simultaneous groups multiply quantities, and the session uses the maximum required per item.
- Export the session as PNG pages or a downloadable PDF, with an on-device preview. PDF text is rasterized, not searchable. Text, CSV and browser printing remain available. Exports include the player count and material overview. JSON backup/restore covers profile, plans and custom drills.
- Deadline-based pause/reset/next timer and offline app shell.
- Animated illustrative drill details, step playback, swiping, local favorites, undo and optional haptics. Reduced-motion settings take priority.
- Session budgets include breaks, explanation and changes. Split long blocks into short rounds. The assistant excludes fall-technique drills and rejects unsupported age/group combinations; it does not check helper availability or equipment inventory.

No Community Hub, accounts, player imports, player names or payments. No SpielerPlus integration.

## Run locally

Install Node.js, download this repository, extract it, and run in that folder:

```sh
node serve.cjs
```

Open **http://localhost:8765**. Stop with Ctrl+C. No runtime dependencies; Node only serves the app locally. Do not double-click the HTML file if you need offline/PWA behavior.

Open https://bronkostylez.github.io/KEEPERBOARD/ on your phone. On Android, use Chrome's Install app or Add to Home screen option; on iPhone, use Safari > Share > Add to Home Screen. Load once online before using offline. Browser support varies; there is no App Store build.

## Library standards

See [SOURCES.md](SOURCES.md) and each card's source. These are independently written summaries and variants, not copied articles, images or videos. Sources support the coaching principles; the exact age boundaries, durations, equipment quantities and grouping are editorial choices. The library is a starting collection, not 150 verified drills or an entire coaching curriculum.

A drill needs a clear goal, usable setup, short coaching, source provenance, sensible age suitability and safe progression. The 100 drills include variants from the same source, not 100 unrelated official DFB drills. Extend `drills.js` with stable IDs, `type`, `tag`, `ages`, `min/max` players, `minutes`, `description`, `coaching`, structured `equipment` and HTTPS `url`. Keep IDs stable for saved plans. This schema can grow to about 150 curated entries without changing the planner.

Players are counted **without the coach**. Keeper drills with one or two players need an extra helper per parallel group. Mixed games include the keepers in the total. If group sizes cannot fit all players, amounts are provisional and the plan warns instead of pretending the drill fits. Available helper count and equipment inventory are not checked automatically. For custom exercises, the material field is one named equipment bundle per group, not a parser for item quantities.

Bambini should have broad playful ball experiences, not fixed goalkeeper specialisation. Fall drills are limited to later age bands, safe soft level ground and experienced supervision. Stop for fear, pain or unsafe landings. No heading drills. All ages still need adaptation to actual ability, space, supervision and fatigue.

## Local data and limits

Data stays in localStorage on this browser and origin; clearing data, storage eviction or private browsing can erase it. Back up regularly. No sync or encryption promise. No personal names in free-text fields. Source websites open only when selected.

Stages 2 through 5 use the `trainr-v2` storage key. Stage 1 browser data is left untouched under `keeperboard-v1`; it is not migrated automatically and Stage 1 backups are rejected rather than silently converted with changed player-count meanings.

The service worker caches app assets only. Increase its version after an asset update. A timer may not sound while the screen is locked, browser suspended or app closed. It is not a background alarm; changing the system clock affects its deadline.

## Test

```sh
npm ci
npm test
node test-v5.cjs
```

The Playwright smoke suite uses Chrome at `/usr/bin/google-chrome`; set `CHROME_PATH` on another system. Screenshots/PDF go to `/downloads` in the build environment; change paths for your local machine.

Tested on Chrome/Linux: onboarding including invalid day/time input, all 100 drills, profile/category/age/search filters, ranking reasons, group and material counts, duration overrun, actual drag/drop add and reorder, button fallback, timer pause/next, own exercises, multiple plans, persistence, text/CSV/PDF output, validated backup/restore/rejection, offline reload and changes, and 390px mobile/1280px desktop views. No JavaScript page errors. Onboarding, Today, drill cards, mobile planner, training screen, desktop and PDF were visually inspected. Field animations are illustrative, not exact tactical paths or goalkeeper technique demonstrations. The V5 suite adds 864 age/type/group/time combinations (608 supported, 256 explicitly rejected), preview/accept/persistence, real PNG/PDF downloads and offline export. Stage 2 backups and stored sessions remain compatible.

The deployed HTTPS app was tested in a fresh mobile-size Chrome browser: onboarding, drills, planning, timer state, service worker and offline reload passed. Not tested on a physical phone, Safari installation, Windows or screen-locked sound.

## Structure

`index.html` owns the shell, `app-ui.css` the app styling, `app-ui.js` navigation and presentation, `app.js` state/planning/ranking/timer, `drills.js` the curated catalog, `ui-v4.js` / `ui-v4.css` drill detail and feedback, `ui-v5.js` / `ui-v5.css` the session assistant and local exports, `sw.js` the offline shell, and `manifest.webmanifest` the installation metadata. `BRAND` in `app.js` controls runtime branding. The document title and manifest provide the static startup/install labels. No build step is required.
