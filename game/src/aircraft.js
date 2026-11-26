// Skylark Courier — the Skylark mail plane, built from primitives: a cream
// high-wing monoplane with a red cheatline, teal wingtips, a glass canopy and
// a two-blade prop. The model faces -Z (its nose), so the flight code can
// aim it with a look-at matrix. Nothing here is copied from any real
// aircraft: the Skylark is the island's own little mail plane.
export function createAircraft(THREE) {
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e3c6, roughness: 0.55, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.2 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f6f6b, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6a8aa8, roughness: 0.25, metalness: 0.6, emissive: 0x2a4a66, emissiveIntensity: 0.35,
  });

  // Fuselage: a tube along Z with a tapered tail and a rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 5.6, 14), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), cream);
  nose.scale.set(1, 1, 1.15);
  nose.position.z = -2.4;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.12, 2.6, 12), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.4;
  group.add(tailCone);

  // The red cheatline down each flank.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 5.2), red);
    stripe.position.set(side * 1.02, 0.1, 0.2);
    group.add(stripe);
  }

  // Glass canopy over the cockpit, ahead of the wing — low and sleek so it
  // never swallows the view from the pilot's seat.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), glass);
  canopy.scale.set(0.85, 0.45, 1.15);
  canopy.position.set(0, 0.75, -0.9);
  group.add(canopy);

  // High wing with teal tips, and a little dihedral so it reads from below.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.32, 2.1), cream);
  wing.position.set(0, 0.95, 0.1);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 2.1), teal);
    tip.position.set(side * 4.9, 0.98, 0.1);
    group.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), dark);
    strut.position.set(side * 1.9, -0.1, 0.35);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // Tail: stabiliser and fin, both red-tipped.
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.3), cream);
  stabiliser.position.set(0, 0.35, 5.2);
  group.add(stabiliser);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.3, 1.8), red);
  fin.position.set(0, 1.2, 5.1);
  fin.rotation.x = -0.15;
  group.add(fin);

  // Propeller: a hub and two dark blades that spin around Z.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), dark);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.12), dark);
    blade.rotation.z = angle;
    blade.position.z = -0.15;
    prop.add(blade);
  }
  prop.position.z = -3.35;
  group.add(prop);

  // Landing gear: two mains and a tail wheel, lowered or tucked away.
  const gear = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), dark);
    leg.position.set(side * 1.1, -1.3, -0.4);
    leg.rotation.z = side * 0.25;
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(side * 1.35, -2.0, -0.4);
    gear.add(leg, wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), dark);
  tailWheel.position.set(0, -0.9, 4.6);
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red port, green starboard, white tail.
  const navLights = {};
  const lightDefs = [
    ['port', -5.6, 0.98, 0.1, 0xff2a2a],
    ['starboard', 5.6, 0.98, 0.1, 0x2aff66],
    ['tail', 0, 0.6, 5.8, 0xffffff],
  ];
  for (const [name, x, y, z, colour] of lightDefs) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: colour }),
    );
    lamp.position.set(x, y, z);
    group.add(lamp);
    navLights[name] = lamp;
  }

  // A warm glow from the cockpit at dusk: the instruments, lit.
  const panelGlow = new THREE.PointLight(0xffc46b, 0.7, 4);
  panelGlow.position.set(0, 0.7, -0.9);
  group.add(panelGlow);

  function setGear(down) {
    gear.visible = down;
  }

  // dt in seconds, rpm01 the engine's 0..1, t the clock for the blink.
  function update(dt, rpm01, t) {
    prop.rotation.z -= dt * (4 + rpm01 * 55);
    const blink = Math.sin(t * 4) > 0;
    navLights.port.visible = blink;
    navLights.starboard.visible = blink;
    navLights.tail.visible = Math.sin(t * 2.4) > -0.2;
    panelGlow.intensity = 0.55 + Math.sin(t * 7) * 0.05;
  }

  return { group, prop, setGear, update };
}
