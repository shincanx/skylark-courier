# Skylark Courier — Island Air Mail

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/shincanx/skylark-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/shincanx/skylark-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete original flight game built for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

You are a bush pilot flying the mail across **Kestrel Island** — a hand-built
procedural island with a harbour town, a lake, pine forests and a mountain
ridge. Fly three sorties from the island's single airstrip: thread glowing
rings over the bay, drop the mail over the far town, and bring the little
Skylark home for a graded landing. Fuel, damage, wind and a ticking clock turn
every sortie into decisions.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with any static
server, e.g. `node serve.ts` → http://localhost:8080). No network request, no
build step. Everything the game loads lives under `game/`; Three.js r149 is
vendored at `game/vendor/three.min.js`.

**Keyboard**

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | Pitch down / up |
| A / D or ← / → | Bank left / right |
| Shift | Throttle up |
| Ctrl | Throttle down |
| Space | Air brakes |
| G | Landing gear up / down |
| C | Camera: chase / cockpit / tower |
| M | Mute |
| P / Esc | Pause |
| R | Restart sortie |
| Enter | Start / confirm |

**Mouse:** click the menu buttons and sortie cards; hold the left button and
drag to steer; the on-screen throttle lever is draggable.

## The game

- **Chase and cockpit cameras** over recognisable terrain: harbour town,
  lake, pine forest, mountain ridge, and the home runway with lights.
- **Aircraft in frame** — the Skylark, a single-prop mail plane built from
  primitives, with spinning prop, nav lights and landing gear.
- **Lit instruments** — a glowing dashboard: attitude indicator, airspeed,
  altimeter, heading compass, fuel and RPM, plus a digital HUD with altitude,
  speed and heading.
- **Runway and target rings ahead** — every sortie ends on runway 09, and the
  rings glow in sequence so you always know where to fly next.
- **Three sorties** with different goals: Ring Run, Mail Drop, and the
  Landing Challenge — scored on time, rings, touchdown quality, fuel left and
  damage taken.
- **Synthesised sound** — engine drone, wind, ring chimes and touchdown
  thuds, all generated with WebAudio; no audio files.

## Layout

```
main.ts            hands game/ + screenshots/ to /output with a dossier
serve.ts           tiny static server for local play-testing
vendor/            makefun-game.ts (kit copy, unchanged)
game/
  index.html       page shell
  vendor/three.min.js   vendored Three.js r149 (MIT)
  src/
    config.js      tuning constants
    random.js      seeded RNG + value noise
    terrain.js     island, sea, town, runway, rings, clouds, sky
    aircraft.js    the Skylark model
    physics.js     arcade flight model (lift, stall, wind, ground)
    input.js       keyboard + mouse
    hud.js         lit instruments + HUD overlay
    audio.js       WebAudio engine/wind/chime synth
    missions.js    sorties, scoring, debrief
    shots.js       deterministic screenshot scenes (?shot=…)
    main.js        boot, game loop, cameras, screens
screenshots/       real renders of the game's own code
```

## Entry

- Bounty: [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
- License: MIT (see `LICENSE`)
