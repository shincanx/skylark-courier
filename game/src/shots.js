// Skylark Courier — the screenshot scenes behind ?shot=start|play|approach|
// cockpit. Each one plays the real rules forward from a fresh world for a
// fixed number of steps, steered by a simple autopilot (aim at the next ring
// or the runway threshold, keep the speed in the envelope), so the frame is
// what a short game really looks like — and the same seed always gives the
// same frame. No mock-ups: these are renders of the game's own code.
import { steerToward } from './physics.js';
import { RING_RUN } from './config.js';

const STEP = 1 / 60;

// The autopilot: full power until flying speed, then hold the cruise band;
// gear comes down for the approach and stays up on the ring tour.
function makePilot(game, mode) {
  return function pilot(flight, world) {
    let target;
    if (mode === 'approach') {
      // One steady glide slope straight at the threshold: no intermediate
      // waypoint to overshoot and orbit, gear down once the strip is near.
      target = { x: -150, y: 7, z: 0 };
      const dist = Math.hypot(flight.x + 100, flight.z);
      if (dist < 1200) flight.gearDown = true;
      const input = steerToward(flight, target, STEP, world.heightAt, { x: 1, z: 0 });
      if (flight.speed > 48) input.throttleDelta = -1;
      else if (flight.speed < 42) input.throttleDelta = 1;
      // Gentle banks only on final: a steep turn this low ends in the hill.
      input.roll = Math.max(-0.6, Math.min(0.6, input.roll));
      return input;
    }
    const next = world.rings.find((ring) => !ring.passed);
    target = next ? next.pos : { x: 0, y: 40, z: 0 };
    let approachDir = { x: 1, z: 0 };
    if (next) {
      const idx = world.rings.indexOf(next);
      const prev = idx > 0 ? world.rings[idx - 1].pos : { x: -260, y: 7, z: 0 };
      const len = Math.hypot(next.pos.x - prev.x, next.pos.z - prev.z) || 1;
      approachDir = { x: (next.pos.x - prev.x) / len, z: (next.pos.z - prev.z) / len };
    }
    if (flight.mode === 'air' && flight.y > 60) flight.gearDown = false;
    return steerToward(flight, target, STEP, world.heightAt, approachDir);
  };
}

// Simulate in one-second slices and freeze the moment the plane is in
// steady, nearly level flight with the next ring ahead and in view — or
// after `maxSeconds` if that moment never comes.
function freezeOnSteadyFlight(game, pilot, maxSeconds) {
  for (let s = 0; s < maxSeconds; s += 1) {
    game.simulate(1, pilot);
    const flight = game.flight;
    if (flight.mode === 'crashed' || game.missions.getPhase() === 'debrief') break;
    const next = game.world.rings.find((ring) => !ring.passed);
    if (!next || flight.mode !== 'air') continue;
    const dist = Math.hypot(next.pos.x - flight.x, next.pos.y - flight.y, next.pos.z - flight.z);
    const bankDeg = Math.abs((flight.bank * 180) / Math.PI);
    // Only once the takeoff is properly behind it: high, fast and level,
    // with the next ring ahead — not on the runway two seconds in.
    if (s >= 10 && flight.y > 60 && flight.speed > 40 && bankDeg < 22 && dist < 700 && dist > 120) break;
  }
}

// Is the plane on a photogenic final: lined up, descending, strip ahead?
function onFinal(flight) {
  const headingDeg = ((flight.heading * 180) / Math.PI + 360) % 360;
  const headingErr = Math.abs(headingDeg - 90);
  return (
    flight.x > -1700 && flight.x < -500 &&
    flight.y > 35 && flight.y < 180 &&
    Math.abs(flight.z) < 120 &&
    headingErr < 25 &&
    flight.mode === 'air'
  );
}

// Set `game` to the named scene and return the screen and camera to show.
export function stageShot(name, game) {
  if (name === 'approach') {
    game.startSortie(2); // the landing challenge, on final
    const pilot = makePilot(game, 'approach');
    // Simulate in one-second slices and freeze the moment the plane is on
    // a clean final — runway ahead, gear down — or after 55 seconds.
    for (let s = 0; s < 55; s += 1) {
      game.simulate(1, pilot);
      if (onFinal(game.flight)) break;
      if (game.flight.mode === 'crashed' || game.missions.getPhase() === 'debrief') break;
    }
    game.setCamera('chase');
    game.setScreen('play');
    return { screen: 'play', camera: 'chase' };
  }
  if (name === 'cockpit') {
    game.startSortie(0);
    const pilot = makePilot(game, 'play');
    freezeOnSteadyFlight(game, pilot, 30);
    game.setCamera('cockpit');
    game.setScreen('play');
    return { screen: 'play', camera: 'cockpit' };
  }
  if (name === 'play') {
    game.startSortie(0);
    const pilot = makePilot(game, 'play');
    freezeOnSteadyFlight(game, pilot, 45);
    game.setCamera('chase');
    game.setScreen('play');
    return { screen: 'play', camera: 'chase' };
  }
  // 'start' and anything else: the title screen over the parked Skylark.
  game.startSortie(0);
  game.setCamera('chase');
  game.setScreen('title');
  return { screen: 'title', camera: 'chase' };
}

export { RING_RUN };
