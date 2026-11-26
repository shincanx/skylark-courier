// Skylark Courier — the island. One pure height function drives both the
// terrain mesh and the flight model's ground collisions, so what you see is
// what you can hit. Kestrel Island: a harbour town and a runway on the flat
// south shelf, a lake and pine forest in the middle, a rocky ridge to the
// north-west, and the sea all around.
import { WORLD, RUNWAY, LANDMARKS, RING_RUN, DROP_ZONE, COLOURS } from './config.js';
import { makeNoise, mulberry32 } from './random.js';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(dx, dz, radius) {
  const d2 = dx * dx + dz * dz;
  return Math.exp(-d2 / (radius * radius));
}

// The island's height at (x, z), in metres above sea level.
export function makeHeightAt(seed) {
  const noise = makeNoise(seed);
  return function heightAt(x, z) {
    const r = Math.hypot(x, z);
    // The island fades into the sea floor past its shore.
    const shore = 1 - smoothstep(950, WORLD.islandRadius, r);
    if (shore <= 0) return -8;
    // Rolling hills from the noise field.
    let h = (noise(x, z) - 0.5) * 2 * WORLD.maxHill * 0.55;
    h += (noise(x * 0.31 + 500, z * 0.31 - 300) - 0.5) * 2 * WORLD.maxHill * 0.45;
    // The ridge rises to the north-west.
    h += LANDMARKS.ridge.height * gauss(x - LANDMARKS.ridge.x, z - LANDMARKS.ridge.z, 420);
    // The lake is a bowl sunk below the waterline.
    h -= 26 * gauss(x - LANDMARKS.lake.x, z - LANDMARKS.lake.z, LANDMARKS.lake.radius);
    h = h * shore - 8 * (1 - shore);
    // The runway shelf is flat ground, blended in near the strip.
    const nearStrip = (1 - smoothstep(120, 420, Math.abs(z))) * (1 - smoothstep(380, 620, Math.abs(x)));
    h = h * (1 - nearStrip) + WORLD.runwayElevation * nearStrip;
    // The approach funnel: flat ground on the extended centreline west of
    // the strip (and a little east, for overshoots), so a final approach
    // comes in over level ground, never over a hillside.
    const funnelX = smoothstep(-1600, -1300, x) * (1 - smoothstep(200, 500, x));
    const funnelZ = 1 - smoothstep(80, 160, Math.abs(z));
    const funnel = funnelX * funnelZ;
    h = h * (1 - funnel) + WORLD.runwayElevation * funnel;
    // The town shelf is gently levelled too.
    const nearTown = gauss(x - LANDMARKS.town.x, z - LANDMARKS.town.z, LANDMARKS.town.radius);
    h = h * (1 - nearTown * 0.7) + 8 * nearTown * 0.7;
    return h;
  };
}

// The runway's painted surface, drawn once on a canvas: asphalt, edge lines,
// centreline dashes, threshold bars and the big 09.
function runwayTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3c4148';
  g.fillRect(0, 0, 128, 1024);
  // Wear: faint tyre streaks down the middle.
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(52, 0, 10, 1024);
  g.fillRect(66, 0, 10, 1024);
  // Edge lines.
  g.fillStyle = '#e8e8e0';
  g.fillRect(6, 0, 5, 1024);
  g.fillRect(117, 0, 5, 1024);
  // Centreline dashes.
  for (let y = 30; y < 1024; y += 64) g.fillRect(60, y, 8, 34);
  // Threshold bars at both ends.
  for (let y of [18, 986]) {
    for (let x = 14; x < 118; x += 16) g.fillRect(x, y, 9, 26);
  }
  // The 09, upright for a pilot on final from the west.
  g.fillStyle = '#e8e8e0';
  g.font = 'bold 92px sans-serif';
  g.textAlign = 'center';
  g.save();
  g.translate(64, 210);
  g.rotate(Math.PI);
  g.fillText('09', 0, 0);
  g.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function houseColours(rand) {
  const walls = [0xe8dcc0, 0xd9c9a8, 0xc9b18a, 0xe0cfae, 0xb8c4c9];
  const roofs = [0xa34a2e, 0x7a3b2e, 0x5d6b7a, 0x8a5a34, 0x4a5d3a];
  return {
    wall: walls[Math.floor(rand() * walls.length)],
    roof: roofs[Math.floor(rand() * roofs.length)],
  };
}

export function createWorld(THREE, seed) {
  const group = new THREE.Group();
  const heightAt = makeHeightAt(seed);
  const rand = mulberry32(seed * 7 + 13);

  // Sky, light and haze.
  const scene = group;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b7c5a, 0.85);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(900, 1100, 500);
  // A dim fill from the west so the tail of the Skylark — and the shadow
  // side of the hills — never falls to black on camera.
  const fill = new THREE.DirectionalLight(0xd8e8ff, 0.4);
  fill.position.set(-800, 400, -600);
  scene.add(hemi);
  scene.add(sun);
  scene.add(fill);

  // --- Terrain mesh, vertex-coloured by height and cover. ---
  const size = 3600;
  const segments = 170;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(COLOURS.sand);
  const cGrass = new THREE.Color(COLOURS.grass);
  const cForest = new THREE.Color(COLOURS.forest);
  const cRock = new THREE.Color(COLOURS.rock);
  const cSnow = new THREE.Color(COLOURS.snow);
  const forestNoise = makeNoise(seed + 99);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    if (h < 2.2) tmp.copy(cSand);
    else if (h < 95) tmp.copy(cGrass).lerp(cForest, forestNoise(x, z) > 0.62 ? 0.85 : 0.25);
    else if (h < 150) tmp.copy(cRock).lerp(cGrass, 0.3);
    else tmp.copy(cRock).lerp(cSnow, smoothstep(150, 185, h));
    // A dirt road snakes from the runway to the town.
    const roadD = Math.abs(z - (120 + 0.55 * (x + 300)));
    if (h > 2.2 && h < 95 && roadD < 9 && x > -300 && x < 430) tmp.lerp(new THREE.Color(0x9a8a72), 0.75);
    colours[i * 3] = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  group.add(terrain);

  // --- Sea: one big calm plane at y = 0. ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshLambertMaterial({ color: COLOURS.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.4;
  group.add(sea);

  // --- Runway: painted strip, edge lights, windsock, tower, hangar. ---
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshLambertMaterial({ map: runwayTexture(THREE) }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = Math.PI / 2;
  strip.position.set(0, WORLD.runwayElevation + 0.15, 0);
  group.add(strip);

  const lightGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const edgeLights = new THREE.InstancedMesh(lightGeo, lightMat, 44);
  const matrix = new THREE.Matrix4();
  let li = 0;
  for (let x = -290; x <= 290; x += 27) {
    for (const z of [-RUNWAY.width / 2 - 2, RUNWAY.width / 2 + 2]) {
      matrix.setPosition(x, WORLD.runwayElevation + 0.6, z);
      edgeLights.setMatrixAt(li, matrix);
      li += 1;
    }
  }
  group.add(edgeLights);

  // Tower: a white shaft with a glass cab, south of the strip.
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(10, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
  );
  shaft.position.y = 13;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 14),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50, emissive: 0x8fb8d8, emissiveIntensity: 0.7 }),
  );
  cab.position.y = 29;
  tower.add(shaft, cab);
  tower.position.set(RUNWAY.tower.x, WORLD.runwayElevation, RUNWAY.tower.z);
  group.add(tower);

  // Hangar: a low arched shed.
  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 14, 30, 16, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x7a8a99 }),
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(RUNWAY.hangar.x, WORLD.runwayElevation, RUNWAY.hangar.z);
  group.add(hangar);

  // Windsock on a pole by the threshold.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  sockPole.position.set(-280, WORLD.runwayElevation + 4.5, 26);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xff6b35, emissive: 0x903000, emissiveIntensity: 0.4 }),
  );
  sock.rotation.z = Math.PI / 2 - 0.25;
  sock.position.set(-277, WORLD.runwayElevation + 8.6, 26);
  group.add(sockPole, sock);

  // --- The harbour town: jittered houses with pitched roofs. ---
  const town = new THREE.Group();
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.ConeGeometry(1, 1, 4);
  for (let gx = -4; gx <= 4; gx += 1) {
    for (let gz = -3; gz <= 3; gz += 1) {
      if (Math.abs(gx) + Math.abs(gz) > 6) continue;
      if (rand() < 0.22) continue;
      const x = LANDMARKS.town.x + gx * 34 + (rand() - 0.5) * 14;
      const z = LANDMARKS.town.z + gz * 34 + (rand() - 0.5) * 14;
      const w = 12 + rand() * 10;
      const h = 7 + rand() * 6;
      const { wall, roof } = houseColours(rand);
      const house = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: wall }));
      house.scale.set(w, h, w * (0.8 + rand() * 0.4));
      house.position.set(x, heightAt(x, z) + h / 2, z);
      house.rotation.y = rand() * Math.PI;
      const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: roof }));
      roofMesh.scale.set(w * 0.78, 5 + rand() * 3, w * 0.62);
      roofMesh.position.set(x, heightAt(x, z) + h + 2.5, z);
      roofMesh.rotation.y = Math.PI / 4 + house.rotation.y;
      town.add(house, roofMesh);
    }
  }
  // The church tower marks the town from the air.
  const church = new THREE.Mesh(
    new THREE.BoxGeometry(9, 30, 9),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
  );
  church.position.set(LANDMARKS.town.x - 20, heightAt(LANDMARKS.town.x - 20, LANDMARKS.town.z + 10) + 15, LANDMARKS.town.z + 10);
  town.add(church);
  group.add(town);

  // --- Pine forest: instanced trunks and cones on the green slopes. ---
  const treeCount = 420;
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const coneGeo = new THREE.ConeGeometry(3.2, 11, 7);
  const coneMat = new THREE.MeshLambertMaterial({ color: COLOURS.forest });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeCount);
  let placed = 0;
  let guard = 0;
  while (placed < treeCount && guard < treeCount * 40) {
    guard += 1;
    const x = (rand() - 0.5) * 2200;
    const z = (rand() - 0.5) * 2200;
    const h = heightAt(x, z);
    if (h < 6 || h > 110) continue;
    if (Math.hypot(x, z) < 420) continue; // keep the airfield clear
    if (Math.hypot(x - LANDMARKS.town.x, z - LANDMARKS.town.z) < LANDMARKS.town.radius) continue;
    const s = 0.8 + rand() * 0.9;
    matrix.makeScale(s, s, s);
    matrix.setPosition(x, h + 2 * s, z);
    trunks.setMatrixAt(placed, matrix);
    matrix.setPosition(x, h + (4 + 5.5) * s, z);
    cones.setMatrixAt(placed, matrix);
    placed += 1;
  }
  trunks.count = placed;
  cones.count = placed;
  group.add(trunks, cones);

  // --- Lighthouse on the eastern point, and three boats in the bay. ---
  const light = new THREE.Group();
  const lightTower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  lightTower.position.y = 13;
  const lightTop = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lightTop.position.y = 28;
  light.add(lightTower, lightTop);
  light.position.set(LANDMARKS.lighthouse.x, 2, LANDMARKS.lighthouse.z);
  group.add(light);

  const boatMat = new THREE.MeshLambertMaterial({ color: 0xd8d3c8 });
  for (let i = 0; i < 3; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 5), boatMat);
    hull.position.y = 1;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), new THREE.MeshLambertMaterial({ color: 0x7a3b2e }));
    cabin.position.set(-2, 4, 0);
    boat.add(hull, cabin);
    boat.position.set(300 + i * 260, 0.4, -560 - i * 60);
    boat.rotation.y = rand() * Math.PI;
    group.add(boat);
  }

  // --- Rings: glowing torus gates, plus a light beam over the next one. ---
  const rings = RING_RUN.map(([x, y, z, radius]) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 1.6, 12, 42),
      new THREE.MeshStandardMaterial({
        color: COLOURS.ring,
        emissive: COLOURS.ring,
        emissiveIntensity: 0.9,
        metalness: 0.2,
        roughness: 0.4,
      }),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return { mesh, pos: new THREE.Vector3(x, y, z), radius, passed: false };
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 320, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: COLOURS.ringNext,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 160;
  group.add(beam);

  // --- The mail-drop beacon: a pulsing column over the market square. ---
  const dropBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 260, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff5d8f,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  dropBeacon.position.set(DROP_ZONE.x, 130, DROP_ZONE.z);
  dropBeacon.visible = false;
  group.add(dropBeacon);

  // --- Clouds: soft white puffs drifting with the wind. ---
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = 14 + rand() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
      puff.position.set((rand() - 0.5) * 60, (rand() - 0.5) * 8, (rand() - 0.5) * 30);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 4200, 260 + rand() * 160, (rand() - 0.5) * 4200);
    clouds.push(cloud);
    group.add(cloud);
  }

  // Ring states: the next ring glows teal, passed rings go green and dim.
  function setNextRing(index) {
    rings.forEach((ring, i) => {
      if (ring.passed) {
        ring.mesh.material.color.setHex(0x2e9e5b);
        ring.mesh.material.emissive.setHex(0x2e9e5b);
        ring.mesh.material.emissiveIntensity = 0.25;
      } else if (i === index) {
        ring.mesh.material.color.setHex(COLOURS.ringNext);
        ring.mesh.material.emissive.setHex(COLOURS.ringNext);
        ring.mesh.material.emissiveIntensity = 1.4;
      } else {
        ring.mesh.material.color.setHex(COLOURS.ring);
        ring.mesh.material.emissive.setHex(COLOURS.ring);
        ring.mesh.material.emissiveIntensity = 0.9;
      }
    });
    if (index >= 0 && index < rings.length) {
      beam.visible = true;
      beam.position.set(rings[index].pos.x, 160, rings[index].pos.z);
    } else {
      beam.visible = false;
    }
  }

  function setRingPassed(index) {
    if (rings[index]) rings[index].passed = true;
  }

  function resetRings() {
    rings.forEach((ring) => { ring.passed = false; });
    setNextRing(0);
  }

  function update(dt, t) {
    // Clouds ride the wind, east to west, and wrap around the island.
    for (const cloud of clouds) {
      cloud.position.x -= dt * 6;
      if (cloud.position.x < -2400) cloud.position.x = 2400;
    }
    // The next ring breathes; the windsock streams with the wind.
    const next = rings.find((ring) => !ring.passed);
    if (next) {
      const pulse = 1 + Math.sin(t * 3.2) * 0.05;
      next.mesh.scale.set(pulse, pulse, pulse);
      next.mesh.rotation.z = t * 0.15;
    }
    sock.rotation.z = Math.PI / 2 - 0.25 + Math.sin(t * 1.7) * 0.06;
    // The lighthouse lamp sweeps the bay.
    lightTop.material.color.setHex(Math.sin(t * 2) > 0 ? 0xfff2b0 : 0xd8c98a);
  }

  setNextRing(0);
  return {
    group,
    heightAt,
    rings,
    dropBeacon,
    setNextRing,
    setRingPassed,
    resetRings,
    update,
  };
}
