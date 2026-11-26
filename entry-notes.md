# Skylark Courier — entry notes

## Entry
- **Title:** Skylark Courier — Island Air Mail
- **Bounty:** best-flight-game-20261126-0057 — "Make the best flight game" ($500, top 50 share)
- **Repo:** https://github.com/shincanx/skylark-courier
- **License:** MIT (SPDX-License-Identifier: MIT in LICENSE)

## The game
You are a bush pilot flying the mail across **Kestrel Island** — a procedural
island with a harbour town, a lake, pine forest, a mountain ridge with snow
peaks, and a single airstrip, runway 09. Three sorties, one little plane:

1. **Ring Run** — thread six glowing rings over the bay and the ridge, then land on runway 09. Rings pay 250 points each.
2. **Mail Drop** — fly the mailbag to the pink beacon over the far town, press E to drop it inside the zone (+500), then land back home.
3. **Landing Challenge** — on final at 380 m, 2.4 km out. Land inside the touchdown zone, on the centreline, gear down and gentle. Graded to the metre (Perfect +600 / Good +350 / Rough +150).

Fuel drains with throttle (14 minutes at full power), damage accrues on hard
arrivals, and the clock and the fuel gauge pay bonuses for flying like a
professional. The flight model has real discipline in it: speed buys lift,
banking turns the nose, a slow wing stalls and drops, and the ground only
forgives a landing that is slow, level, lined up and on its gear.

## Controls
- **W/S or ↑/↓** pitch · **A/D or ←/→** bank · **Shift/Ctrl** throttle up/down
- **Space** air brakes · **G** landing gear · **C** camera (chase / cockpit / tower)
- **E** drop the mail · **P/Esc** pause · **R** restart sortie · **M** mute
- **Mouse:** click menu buttons and sortie cards; hold and drag to steer; mouse wheel adjusts throttle.
- Sound is synthesised with WebAudio (engine drone, wind, ring chimes, touchdown thuds) — no audio files, no network requests.

## What the screenshots show
1. `1-start.jpg` — title screen over the parked Skylark on runway 09.
2. `2-play.jpg` — chase view mid-flight: the Skylark level at 61 m, ring 1 ahead at 231 m, lit instruments and HUD (ALT 61 m, SPD 207 km/h, HDG 075°).
3. `3-approach.jpg` — on final for the Landing Challenge: gear down, runway 09 arrow 1535 m ahead, the whole island in frame.
4. `4-cockpit.jpg` — over-the-nose cockpit view: the canopy and nose in frame, ring 1 ahead, instruments lit.

All four are real renders of the game's own code, staged deterministically
with `?shot=start|play|approach|cockpit` (see `game/src/shots.js`).

## Files
```
main.ts            hands game/ + screenshots/ to /output with a dossier
serve.ts           tiny static server for local play-testing
vendor/            makefun-game.ts (kit copy, unchanged)
game/
  index.html       page shell (Three.js r149 vendored, no network)
  vendor/three.min.js   vendored Three.js r149 (MIT)
  src/
    config.js      tuning constants (island, runway, rings, flight, scoring)
    random.js      seeded RNG + value noise
    terrain.js     island, sea, town, runway, rings, clouds, sky
    aircraft.js    the Skylark model (built from primitives)
    physics.js     arcade flight model + screenshot autopilot steering
    input.js       keyboard + mouse
    hud.js         lit instruments + HUD overlay
    audio.js       WebAudio engine/wind/chime synth
    missions.js    sorties, scoring, debrief
    shots.js       deterministic screenshot scenes
    main.js        boot, cameras, screens, game loop
screenshots/       4 real renders, 1280×800 JPEG, each under 256 KiB
shots.json         the four shot definitions
prompt.txt         the handed-off build prompt, verbatim
```

## Testing performed
- **Smoke test** (Playwright + headless Chromium, SwiftShader WebGL):
  title loads, three sortie cards render, briefing opens, sortie starts,
  throttle-up + pitch-up takes the plane airborne, HUD canvas sized,
  pause/resume works — all 10 checks PASS, no page errors.
- **Full Ring Run, headless sim** (same physics + missions code, autopilot):
  takeoff, all 6 rings, traffic pattern home, GOOD landing on runway 09
  (touchdown 2.1 m/s, centreline 10 m), debrief, final score 2264.
- **Landing Challenge, headless sim:** GOOD landing (+350), touchdown
  0.9 m/s, centreline 8 m, score 781.
- **Screenshots:** 4 shots taken with the rig in `shot/shoot.mjs`, each
  1280×800 JPEG under 256 KiB, no page errors; visually inspected.
- **Dossier:** `MAKEFUN_OUTPUT_DIR=out node main.ts` builds
  `out/dossier.json` (554,840 bytes, under the 1.5 MiB cap) with game/ and
  screenshots/ copied.
- **Known limits:** headless SwiftShader renders at ~1 fps, so the
  keyboard smoke test waits on sim state, not wall time; on a real desktop
  GPU the game runs at full frame rate. The game makes no network requests
  (only the browser's own favicon request, silenced with a `data:` icon).
