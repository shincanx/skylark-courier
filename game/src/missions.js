// Skylark Courier — the sorties. Three flights with three different goals,
// one shared score: rings and drops pay as they happen, the landing pays on
// how gently and how squarely the Skylark comes home, and the clock and the
// fuel gauge pay a bonus for flying like a professional. This module owns
// the score; the flight model owns the flying.
import { SORTIES, RING_RUN, DROP_ZONE, LANDING_START, SCORING, RUNWAY } from './config.js';

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createMissions() {
  let sortie = null;
  let phase = 'menu'; // 'menu' | 'flying' | 'debrief'
  let score = 0;
  let ringsDone = 0;
  let dropped = false;
  let elapsed = 0;
  let landingScore = 0;
  let result = null;
  let objective = '';
  let arrow = null;

  function startSortie(index) {
    sortie = SORTIES[index];
    phase = 'flying';
    score = 0;
    ringsDone = 0;
    dropped = false;
    elapsed = 0;
    landingScore = 0;
    result = null;
    objective = sortie.id === 'landing'
      ? 'Land on runway 09 inside the touchdown zone'
      : sortie.id === 'mail-drop'
        ? 'Take off, then fly to the pink beacon over the far town'
        : 'Fly through ring 1 of 6';
    arrow = null;
    return sortie;
  }

  function currentSortie() {
    return sortie;
  }

  function getPhase() {
    return phase;
  }

  function getScore() {
    return score;
  }

  function getResult() {
    return result;
  }

  // Where the flight should begin for this sortie.
  function startState(index) {
    if (SORTIES[index].id === 'landing') {
      return {
        x: LANDING_START.x,
        y: LANDING_START.y,
        z: LANDING_START.z,
        headingDeg: LANDING_START.headingDeg,
        speed: LANDING_START.speed,
        throttle: 0.45,
        gearDown: true,
        mode: 'air',
      };
    }
    return {
      x: -RUNWAY.length / 2 + 40,
      y: 6 + 1.2,
      z: 0,
      headingDeg: 90,
      speed: 0,
      throttle: 0,
      gearDown: true,
      mode: 'ground',
    };
  }

  function gradeLanding(event) {
    const vs = event.verticalSpeed;
    const centre = event.centreline;
    const inZone = event.onRunway && event.x >= -300 && event.x <= -100;
    let points = 0;
    let grade = 'ROUGH';
    if (event.onRunway && vs < 2 && centre < 5 && inZone) {
      points = SCORING.landingPerfect;
      grade = 'PERFECT';
    } else if (event.onRunway && vs < 3.5 && centre < 10) {
      points = SCORING.landingGood;
      grade = 'GOOD';
    } else if (event.onRunway) {
      points = SCORING.landingRough;
      grade = 'ROUGH';
    }
    return { points, grade, inZone };
  }

  function finish(reason, title, lines) {
    phase = 'debrief';
    // The clock only pays when the sortie ends in a landing: a crash or a
    // timeout earns no time bonus, whatever the stopwatch says.
    const timeBonus = reason === 'landed'
      ? Math.max(0, Math.round((sortie.parSeconds - elapsed) * SCORING.timeBonusPerSecond))
      : 0;
    const fuelBonus = Math.round(0); // fuel bonus is added at landing time below
    result = { reason, title, lines: lines.concat([`Time bonus  +${timeBonus}`]), score, timeBonus, fuelBonus };
    score += timeBonus;
    result.score = score;
    return result;
  }

  // The drop: only counts inside the beacon's column, below 160 m.
  function tryDrop(flight) {
    if (phase !== 'flying' || sortie.id !== 'mail-drop' || dropped) return null;
    const dx = flight.x - DROP_ZONE.x;
    const dz = flight.z - DROP_ZONE.z;
    const inside = Math.hypot(dx, dz) < DROP_ZONE.radius && flight.y < 170;
    if (inside) {
      dropped = true;
      score += SCORING.drop;
      objective = 'Mail delivered! Now land back on runway 09';
      return { ok: true, points: SCORING.drop };
    }
    return { ok: false };
  }

  // Called every frame while flying. `events` are the flight model's own
  // (takeoff, landed, crashed...). Returns toasts for the HUD to show.
  function update(dt, flight, world, events, toast) {
    if (phase !== 'flying') return;
    elapsed += dt;

    // --- Rings: a pass is the plane coming within the hoop. ---
    if (sortie.id === 'ring-run' && ringsDone < RING_RUN.length) {
      const [rx, ry, rz, radius] = RING_RUN[ringsDone];
      const d = Math.hypot(flight.x - rx, flight.y - ry, flight.z - rz);
      if (d < radius) {
        ringsDone += 1;
        score += SCORING.ring;
        world.setRingPassed(ringsDone - 1);
        world.setNextRing(ringsDone);
        toast(`RING ${ringsDone}/${RING_RUN.length}  +${SCORING.ring}`);
        if (ringsDone === RING_RUN.length) {
          objective = 'All rings flown! Land on runway 09 to finish';
        } else {
          objective = `Fly through ring ${ringsDone + 1} of ${RING_RUN.length}`;
        }
      }
    }

    // --- Mail drop guidance. ---
    if (sortie.id === 'mail-drop' && !dropped) {
      const d = Math.hypot(flight.x - DROP_ZONE.x, flight.z - DROP_ZONE.z);
      if (d < DROP_ZONE.radius * 1.6 && flight.y < 200) {
        objective = 'Over the beacon — press E to drop the mail!';
      }
    }

    // --- The steering arrow: bearing and distance to the next goal. ---
    let target = null;
    let label = '';
    if (sortie.id === 'ring-run' && ringsDone < RING_RUN.length) {
      const [x, y, z] = RING_RUN[ringsDone];
      target = { x, y, z };
      label = `RING ${ringsDone + 1}`;
    } else if (sortie.id === 'mail-drop' && !dropped) {
      target = { x: DROP_ZONE.x, y: DROP_ZONE.y, z: DROP_ZONE.z };
      label = 'BEACON';
    } else {
      target = { x: 0, y: 40, z: 0 };
      label = 'RUNWAY 09';
    }
    if (target) {
      const dx = target.x - flight.x;
      const dz = target.z - flight.z;
      const bearing = Math.atan2(dx, -dz);
      let rel = bearing - flight.heading;
      while (rel > Math.PI) rel -= 2 * Math.PI;
      while (rel < -Math.PI) rel += 2 * Math.PI;
      arrow = {
        // The arrow is drawn pointing up for straight ahead.
        angle: rel,
        distance: Math.round(Math.hypot(dx, dz, target.y - flight.y)),
        label,
      };
    }

    // --- Flight events: landing ends the sortie, crashing ends it badly. ---
    for (const event of events) {
      if (event.type === 'takeoff') {
        toast('AIRBORNE — gear up when ready (G)');
      } else if (event.type === 'stall') {
        toast('STALL! Push the nose down and add power');
      } else if (event.type === 'fuel-empty') {
        toast('FUEL EMPTY — glide her home!');
      } else if (event.type === 'landed') {
        const graded = gradeLanding({ ...event, x: flight.x });
        landingScore = graded.points;
        score += graded.points;
        const fuelBonus = Math.round(flight.fuel * SCORING.fuelBonusPerPercent * 0.1);
        score += fuelBonus;
        const allDone =
          (sortie.id === 'ring-run' && ringsDone === RING_RUN.length) ||
          (sortie.id === 'mail-drop' && dropped) ||
          sortie.id === 'landing';
        const title = allDone ? 'SORTIE COMPLETE' : 'LANDED EARLY';
        const lines = [
          `Landing: ${graded.grade}  +${graded.points}`,
          `Touchdown ${event.verticalSpeed.toFixed(1)} m/s · centreline ${event.centreline.toFixed(0)} m ${event.onRunway ? 'on runway 09' : 'OFF RUNWAY'}`,
          `Fuel left ${Math.round(flight.fuel)}%  +${fuelBonus}`,
          `Damage ${Math.round(flight.damage)}%`,
        ];
        if (!allDone) {
          lines.unshift(sortie.id === 'ring-run' ? `Rings flown: ${ringsDone}/${RING_RUN.length}` : 'Mail not delivered');
        }
        finish('landed', title, lines);
        toast(`${graded.grade} LANDING  +${graded.points}`);
      } else if (event.type === 'crashed' || event.type === 'ditched') {
        const penalty = Math.round(flight.damage * 0.1);
        finish(
          'crashed',
          event.type === 'ditched' ? 'DITCHED IN THE SEA' : 'CRASHED',
          [
            'The Skylark is a write-off — the island workshop will rebuild her.',
            `Rings flown: ${ringsDone}/${RING_RUN.length}`,
            `Damage penalty  −${penalty}`,
          ],
        );
        score = Math.max(0, score - penalty);
        result.score = score;
      }
    }

    // --- Out of time or out of fuel with no landing: the sortie ends. ---
    if (phase === 'flying' && elapsed > sortie.parSeconds * 2.5) {
      finish('time', 'OUT OF TIME', [
        'The mail was due an hour ago — the sortie is over.',
        `Rings flown: ${ringsDone}/${RING_RUN.length}`,
      ]);
    }
  }

  function hudState(flight) {
    return {
      name: sortie ? sortie.name : 'Skylark Courier',
      score,
      clock: formatClock(elapsed),
      objective,
      arrow,
    };
  }

  return {
    startSortie,
    currentSortie,
    getPhase,
    getScore,
    getResult,
    startState,
    tryDrop,
    update,
    hudState,
    formatClock,
  };
}
