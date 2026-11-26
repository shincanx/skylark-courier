// Skylark Courier — tuning constants. One place for every number the rest of
// the game shares: the island, the runway, the rings, the flight model and
// the sorties. Units are metres, metres per second and degrees.
export const WORLD = {
  // The island is a disc of land about 2.4 km across in a 6 km sea.
  islandRadius: 1250,
  seaLevel: 0,
  // A flattened shelf around the runway so the strip sits on level ground.
  runwayElevation: 6,
  // Where the value-noise hills may rise.
  maxHill: 190,
};

export const RUNWAY = {
  // Runway 09: along +X, centred on the origin, 600 m long, 30 m wide.
  length: 600,
  width: 30,
  headingDeg: 90,
  // Touchdown zone: the first third of the strip.
  touchdownStart: -300,
  touchdownEnd: -100,
  // Tower and hangar sit south of the strip.
  tower: { x: 40, z: 90 },
  hangar: { x: -140, z: 80 },
};

// The town, lake and ridge give the terrain its recognisable landmarks.
export const LANDMARKS = {
  town: { x: 430, z: 330, radius: 190 },
  lake: { x: -720, z: -420, radius: 170 },
  ridge: { x: -820, z: -720, height: 210 },
  lighthouse: { x: 1080, z: -260 },
};

// Rings are torus gates the pilot flies through, in order. Each entry is
// [x, y, z, radius]. They ring the bay and the ridge so a sortie tours the
// whole island.
export const RING_RUN = [
  [420, 90, -160, 34],
  [760, 130, -420, 34],
  [620, 170, -820, 34],
  [-40, 200, -860, 34],
  [-720, 160, -480, 34],
  [-620, 140, 60, 34],
];

// The mail-drop beacon floats over the far town's market square.
export const DROP_ZONE = { x: 430, z: 330, y: 110, radius: 70 };

// The landing challenge starts the pilot on final, 2.4 km out at 380 m.
export const LANDING_START = {
  x: -2700,
  y: 380,
  z: 0,
  headingDeg: 90,
  speed: 62,
};

export const PLANE = {
  // Flight envelope of the little Skylark mail plane.
  minSpeed: 20, // below this the wing stops flying
  cruiseSpeed: 55,
  maxSpeed: 80,
  // How fast the controls answer (per second).
  pitchRate: 0.9,
  rollRate: 1.9,
  maxPitchDeg: 38,
  maxBankDeg: 62,
  // Throttle 0..1 maps to this target speed with full power.
  throttleAccel: 14,
  drag: 0.55,
  // Gravity pulls the nose down and the aircraft with it when slow.
  gravity: 9.81,
  // Fuel: minutes of full-throttle flight a full tank buys.
  tankMinutes: 14,
  // Damage: a hard arrival hurts; 100 ends the sortie.
  crashVerticalSpeed: 7,
  hardLandingVerticalSpeed: 4.5,
};

export const SCORING = {
  ring: 250,
  drop: 500,
  landingPerfect: 600,
  landingGood: 350,
  landingRough: 150,
  timeBonusPerSecond: 4,
  fuelBonusPerPercent: 6,
  damagePenaltyPerPoint: 5,
};

export const SORTIES = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tag: 'Sortie 1 · Bay Tour',
    brief:
      'Thread all six rings over the bay and the ridge, then bring the Skylark home and land on runway 09. Rings pay 250 points each — smooth flying pays best.',
    parSeconds: 240,
  },
  {
    id: 'mail-drop',
    name: 'Mail Drop',
    tag: 'Sortie 2 · Far Town',
    brief:
      'Take the mailbag to the far town. Fly low over the market beacon and press E to drop the bag inside the zone, then land back on runway 09. Mind your fuel.',
    parSeconds: 300,
  },
  {
    id: 'landing',
    name: 'Landing Challenge',
    tag: 'Sortie 3 · Graded Final',
    brief:
      'You are on final at 380 metres, 2.4 kilometres out. Put the Skylark down inside the touchdown zone, on the centreline, gear down and gentle. One chance, graded to the metre.',
    parSeconds: 150,
  },
];

export const COLOURS = {
  sky: 0x8ec8ee,
  fog: 0xa8c8e0,
  sea: 0x2e6f9e,
  sand: 0xd9c28a,
  grass: 0x5d8a48,
  forest: 0x3a6b32,
  rock: 0x8a7f74,
  snow: 0xe8eef2,
  runway: 0x3c4148,
  ring: 0xff9f1c,
  ringNext: 0x2ec4b6,
  planeCream: 0xf2e3c6,
  planeRed: 0xc0392b,
  planeTeal: 0x1f6f6b,
};
