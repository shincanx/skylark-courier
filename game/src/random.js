// Skylark Courier — seeded random numbers and smooth value noise, so the
// island, the clouds and every screenshot scene are the same on every run
// for a given seed. No Math.random anywhere in the world builder.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small deterministic 2D value-noise field: a grid of random heights,
// smoothly interpolated, with a few octaves for hills inside hills.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const grids = [];
  for (let octave = 0; octave < 4; octave += 1) {
    const cells = size >> octave;
    const grid = new Float32Array((cells + 1) * (cells + 1));
    for (let i = 0; i < grid.length; i += 1) grid[i] = rand();
    grids.push({ cells, grid });
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    let value = 0;
    let amp = 1;
    let total = 0;
    for (let octave = 0; octave < grids.length; octave += 1) {
      const { cells, grid } = grids[octave];
      // Sample in a 0..cells tile space; the island is about 2.5 km across.
      const fx = (x / 2600 + 0.5) * cells;
      const fz = (z / 2600 + 0.5) * cells;
      const ix = Math.max(0, Math.min(cells - 1, Math.floor(fx)));
      const iz = Math.max(0, Math.min(cells - 1, Math.floor(fz)));
      const tx = smooth(Math.max(0, Math.min(1, fx - ix)));
      const tz = smooth(Math.max(0, Math.min(1, fz - iz)));
      const a = grid[iz * (cells + 1) + ix];
      const b = grid[iz * (cells + 1) + ix + 1];
      const c = grid[(iz + 1) * (cells + 1) + ix];
      const d = grid[(iz + 1) * (cells + 1) + ix + 1];
      const top = a + (b - a) * tx;
      const bottom = c + (d - c) * tx;
      value += (top + (bottom - top) * tz) * amp;
      total += amp;
      amp *= 0.5;
    }
    return value / total;
  };
}

// A deterministic shuffle for ring order, cloud placement and the like.
export function shuffle(array, rand) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
