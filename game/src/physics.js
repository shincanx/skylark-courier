// Skylark Courier — the flight model. An arcade model with real discipline
// in it: speed buys lift, banking turns the nose, a slow wing stalls and
// drops, and the ground only forgives a landing that is slow, level, lined
// up and on its gear. Pure numbers in, pure numbers out — no Three.js here,
// so the screenshot autopilot can drive the same code headlessly.
import { PLANE, RUNWAY, WORLD } from './config.js';

const DEG = Math.PI / 180;
const GEAR_HEIGHT = 1.2; // how high the fuselage sits on its wheels

export function createFlight(start) {
  return {
    // Position in metres; heading in radians (0 = +X, runway 09's way).
    x: start.x,
    y: start.y,
    z: start.z,
    heading: (start.headingDeg ?? 90) * DEG,
    pitch: 0,
    bank: 0,
    speed: start.speed ?? 0,
    throttle: start.throttle ?? 0,
    fuel: 100,
    damage: 0,
    gearDown: start.gearDown ?? true,
    mode: start.mode ?? 'ground', // 'ground' | 'air' | 'landed' | 'crashed'
    verticalSpeed: 0,
    time: 0,
    airborne: false,
  };
}

function onRunway(x, z) {
  return Math.abs(x) <= RUNWAY.length / 2 + 10 && Math.abs(z) <= RUNWAY.width / 2 + 4;
}

// One fixed step. `input` is { pitch, roll, throttleDelta, brake } with
// pitch/roll in -1..1. Returns events: { type, ... } for the game to answer.
export function stepFlight(state, input, dt, heightAt, wind) {
  const events = [];
  state.time += dt;

  // --- Controls: bank and pitch ease toward what the pilot asks. ---
  const targetBank = input.roll * PLANE.maxBankDeg * DEG;
  state.bank += (targetBank - state.bank) * Math.min(1, 2.2 * dt);
  if (Math.abs(input.roll) < 0.05) state.bank *= Math.max(0, 1 - 0.5 * dt);
  const targetPitch = input.pitch * PLANE.maxPitchDeg * DEG;
  state.pitch += (targetPitch - state.pitch) * Math.min(1, 2.6 * dt);

  // --- Throttle and fuel. ---
  state.throttle = Math.max(0, Math.min(1, state.throttle + (input.throttleDelta ?? 0) * dt));
  const burning = state.throttle > 0 && state.fuel > 0;
  if (burning) {
    state.fuel = Math.max(0, state.fuel - dt * (0.12 + 0.88 * state.throttle) * (100 / (PLANE.tankMinutes * 60)));
  }
  const power = state.fuel > 0 ? state.throttle : 0;
  if (state.fuel <= 0 && state.throttle > 0 && !state._fuelWarned) {
    state._fuelWarned = true;
    events.push({ type: 'fuel-empty' });
  }

  // --- Speed: power pulls toward its target, drag and brakes pull back. ---
  const targetSpeed = power * PLANE.maxSpeed;
  const accel = PLANE.throttleAccel * (targetSpeed - state.speed) / PLANE.maxSpeed;
  state.speed += accel * dt;
  state.speed -= state.speed * PLANE.drag * 0.08 * dt;
  if (input.brake) state.speed = Math.max(0, state.speed - 22 * dt);
  if (state.mode === 'ground') state.speed = Math.max(0, state.speed - 1.2 * dt);
  state.speed = Math.max(0, Math.min(PLANE.maxSpeed * 1.15, state.speed));

  // --- Turning: bank turns the nose, faster when the wing is loaded. ---
  const turnRate = (PLANE.gravity * Math.tan(state.bank)) / Math.max(26, state.speed);
  state.heading += turnRate * dt;

  // --- Lift and the stall: below min speed the wing quits and the nose drops. ---
  const stalled = state.speed < PLANE.minSpeed && state.mode === 'air';
  if (stalled) {
    state.pitch += (-14 * DEG - state.pitch) * Math.min(1, 1.5 * dt);
    if (!state._stallWarned) {
      state._stallWarned = true;
      events.push({ type: 'stall' });
    }
  } else {
    state._stallWarned = false;
  }

  // --- Takeoff roll: fast enough and pulling up leaves the ground. ---
  if (state.mode === 'ground' && state.speed > PLANE.minSpeed + 4 && state.pitch > 6 * DEG) {
    state.mode = 'air';
    state.airborne = true;
    events.push({ type: 'takeoff' });
  }

  // --- Move along the flight path, plus the wind's drift. Heading is
  // aviation-style: 0 = north (-Z), 90 = east (+X), 180 = south, 270 = west.
  const cp = Math.cos(state.pitch);
  const vx = Math.sin(state.heading) * cp * state.speed + wind.x;
  const vy = Math.sin(state.pitch) * state.speed - (stalled ? 6 : 0) + wind.y;
  const vz = -Math.cos(state.heading) * cp * state.speed + wind.z;
  const prevY = state.y;
  state.x += vx * dt;
  state.y += vy * dt;
  state.z += vz * dt;
  state.verticalSpeed = (state.y - prevY) / dt;

  // --- The ground: the island, or the sea when beyond the shore. ---
  const ground = Math.max(heightAt(state.x, state.z), WORLD.seaLevel + 0.4);
  if (state.y <= ground + GEAR_HEIGHT) {
    state.y = ground + GEAR_HEIGHT;
    const vs = -state.verticalSpeed;
    const gentle = vs < PLANE.hardLandingVerticalSpeed;
    const level = Math.abs(state.bank) < 22 * DEG && Math.abs(state.pitch) < 14 * DEG;
    const slow = state.speed < 52;
    if (state.mode === 'air') {
      if (state.gearDown && gentle && level && slow) {
        state.mode = 'ground';
        const strip = onRunway(state.x, state.z);
        events.push({
          type: 'landed',
          onRunway: strip,
          verticalSpeed: vs,
          centreline: Math.abs(state.z),
          speed: state.speed,
        });
        if (!strip || vs > 2.5) {
          state.damage = Math.min(100, state.damage + (strip ? 0 : 12) + Math.max(0, vs - 2.5) * 6);
        }
      } else {
        state.mode = 'crashed';
        state.damage = 100;
        events.push({ type: 'crashed', verticalSpeed: vs, speed: state.speed });
      }
    } else if (state.mode === 'ground') {
      // Rolling: the nose stays level and the wing stops flying.
      state.pitch *= Math.max(0, 1 - 4 * dt);
      state.bank *= Math.max(0, 1 - 4 * dt);
    }
  }

  // The sea is not a runway: ditching ends the sortie.
  if (state.mode === 'air' && heightAt(state.x, state.z) < WORLD.seaLevel && state.y <= WORLD.seaLevel + GEAR_HEIGHT + 0.4) {
    state.mode = 'crashed';
    state.damage = 100;
    events.push({ type: 'ditched' });
  }

  return events;
}

// A steering helper for the screenshot autopilot: given a target point,
// what pitch/roll should the pilot ask for? Limited rates keep it smooth.
// With a height function it also keeps a floor over the terrain ahead, so
// a direct line between two rings never flies the plane into a hillside.
// With an approach direction it flies the pattern: close to the target but
// badly lined up, it flies out to a standoff point behind the target along
// the approach and comes back straight, instead of tightening its turn
// into an orbit around the hoop.
export function steerToward(state, target, dt, heightAt, approachDir) {
  const normAngle = (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  // Where to aim in the horizontal plane: the target itself, unless the
  // plane is close and badly lined up. Then, high up, it flies out to a
  // standoff point behind the target along the approach and comes back
  // straight, instead of tightening its turn into an orbit around the
  // hoop. Low down, there is no going around: it holds the centreline and
  // lands straight ahead, wings level.
  let aimX = target.x;
  let aimZ = target.z;
  const dist0 = Math.hypot(target.x - state.x, target.z - state.z);
  const dh0 = normAngle(Math.atan2(target.x - state.x, -(target.z - state.z)) - state.heading);
  if (approachDir && dist0 < 320 && Math.abs(dh0) > 0.45) {
    if (state.y < 40) {
      aimX = state.x + Math.sin(state.heading) * 300;
      aimZ = state.z - Math.cos(state.heading) * 300;
    } else {
      aimX = target.x - approachDir.x * 300;
      aimZ = target.z - approachDir.z * 300;
    }
  }
  const dx = aimX - state.x;
  const dz = aimZ - state.z;
  const dist = Math.hypot(dx, dz);
  const dh = normAngle(Math.atan2(dx, -dz) - state.heading);
  const wantBank = Math.max(-1, Math.min(1, dh * 1.1));
  // The altitude to aim for: the target, unless the terrain ahead is
  // higher than the plane — then aim steeply at the floor point 160 m
  // ahead, not gently at the far target, or the ground rises faster than
  // the climb. The floor only ever pushes the plane UP: a floor below the
  // plane never drags it down into a dive. Its margin shrinks as the
  // target nears, so a landing target lets the plane all the way down to
  // the strip instead of holding it above the ground it is landing on.
  let aimY = target.y;
  let aimDist = dist;
  if (heightAt && !(target.y < 30 && dist < 600)) {
    // Close to a landing target the approach funnel is flat ground, so
    // the floor stands down and lets the plane descend to the strip; any
    // further out, or for a target in the air, it still guards the hills.
    const aheadX = state.x + Math.sin(state.heading) * 160;
    const aheadZ = state.z - Math.cos(state.heading) * 160;
    const margin = 55 * Math.min(1, dist / 400);
    const floor = heightAt(aheadX, aheadZ) + margin;
    if (floor > state.y - 10) {
      aimY = floor;
      aimDist = 160;
    }
  }
  const dy = aimY - state.y;
  const wantPitch = Math.max(-1, Math.min(1, (Math.atan2(dy, Math.max(40, aimDist)) / (PLANE.maxPitchDeg * DEG)) * 1.2));
  // Near the target, slow down: a slow wing turns tighter and the
  // hoop is a bigger target. Out on the leg, hold the cruise band.
  const nearTarget = dist < 260;
  const wantThrottle = state.speed < (nearTarget ? 44 : 50) ? 1 : state.speed > (nearTarget ? 52 : 60) ? -1 : 0;
  return { pitch: wantPitch, roll: wantBank, throttleDelta: wantThrottle, brake: false };
}

export { DEG };
