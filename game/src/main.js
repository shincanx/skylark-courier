// Skylark Courier — boot, cameras, screens and the game loop. The game is
// three canvases and a menu: the WebGL scene, the 2D instrument overlay,
// and the DOM menus for title, briefing, pause and debrief. The flight model
// owns the flying; this file only aims the cameras and answers the screens.
import { WORLD, COLOURS, SORTIES } from './config.js';
import { createWorld } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createFlight, stepFlight } from './physics.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMissions } from './missions.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const SEED = 20261126;
const WIND = { x: -2.5, y: 0, z: 1.5 };
const STEP = 1 / 60;

const sceneCanvas = document.getElementById('scene');
const hudCanvas = document.getElementById('hud');
const menuEl = document.getElementById('menu');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOURS.sky);
scene.fog = new THREE.Fog(COLOURS.fog, 900, 5200);

const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
camera.position.set(-320, 40, 60);

const world = createWorld(THREE, SEED);
scene.add(world.group);
const aircraft = createAircraft(THREE);
scene.add(aircraft.group);

const hud = createHud(hudCanvas);
const input = createInput();
const audio = createAudio();
const missions = createMissions();

let flight = createFlight(missions.startState(0));
let screen = 'title'; // 'title' | 'briefing' | 'play' | 'pause' | 'debrief'
let cameraMode = 'chase'; // 'chase' | 'cockpit' | 'tower'
let briefingIndex = 0;
let sessionBest = 0;
let elapsed = 0;
let warn = null;
let warnUntil = 0;
let shotMode = null;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hud.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

function toast(text, seconds = 3) {
  hud.toast(text, seconds);
}

function placeAircraft() {
  const f = flight;
  const cp = Math.cos(f.pitch);
  const fwd = new THREE.Vector3(Math.sin(f.heading) * cp, Math.sin(f.pitch), -Math.cos(f.heading) * cp);
  const up0 = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(fwd, up0).normalize();
  const up = up0.clone().multiplyScalar(Math.cos(f.bank)).add(right.clone().multiplyScalar(Math.sin(f.bank))).normalize();
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), fwd, up);
  aircraft.group.quaternion.setFromRotationMatrix(m);
  aircraft.group.position.set(f.x, f.y, f.z);
  aircraft.setGear(f.gearDown);
  return { fwd, right, up };
}

function updateCamera(dt, basis) {
  const f = flight;
  const { fwd, right, up } = basis;
  if (cameraMode === 'cockpit') {
    // The pilot's eye: just behind the canopy and above it, looking forward
    // over the nose. The prop sweeps the lower centre of the frame, as it
    // should from the seat — but from three metres away, not pressed
    // against the lens.
    const eye = new THREE.Vector3(f.x, f.y, f.z).addScaledVector(fwd, -0.2).addScaledVector(up, 1.55);
    camera.position.lerp(eye, 1 - Math.exp(-14 * dt));
    camera.lookAt(new THREE.Vector3(f.x, f.y, f.z).addScaledVector(fwd, 100).addScaledVector(up, -6));
    camera.fov = 66;
  } else if (cameraMode === 'tower') {
    camera.position.set(40, 40, 90);
    camera.lookAt(f.x, f.y, f.z);
    camera.fov = 55;
  } else {
    // Chase: the camera sits behind the plane but keeps the horizon level,
    // so a bank reads as the plane rolling against a steady world.
    const worldUp = new THREE.Vector3(0, 1, 0);
    const desired = new THREE.Vector3(f.x, f.y, f.z)
      .addScaledVector(fwd, -17)
      .addScaledVector(worldUp, 4.6);
    camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    camera.lookAt(new THREE.Vector3(f.x, f.y, f.z).addScaledVector(fwd, 22).addScaledVector(worldUp, 1));
    camera.fov = 60 + (f.speed / 80) * 10;
  }
  camera.updateProjectionMatrix();
}

// --- Screens (DOM menus). ---
function showMenu(html) {
  menuEl.innerHTML = html;
  menuEl.hidden = false;
}

function hideMenu() {
  menuEl.innerHTML = '';
  menuEl.hidden = true;
}

function renderTitle() {
  const cards = SORTIES.map((s, i) => `
    <button class="card" data-action="briefing" data-index="${i}">
      <span class="card-tag">${s.tag}</span>
      <span class="card-name">${s.name}</span>
      <span class="card-brief">${s.brief}</span>
      <span class="card-par">Par ${missions.formatClock(s.parSeconds)}</span>
    </button>`).join('');
  showMenu(`
    <div class="panel title-panel">
      <p class="eyebrow">KESTREL ISLAND · AIR MAIL SERVICE</p>
      <h1>Skylark Courier</h1>
      <p class="lede">Fly the mail across the island. Three sorties, one little plane,
        and a runway that is always waiting for you.</p>
      <div class="cards">${cards}</div>
      <p class="controls"><b>Fly:</b> W/S pitch · A/D bank · Shift/Ctrl throttle · Space brakes ·
        G gear · C camera · drag mouse to steer · wheel throttle</p>
      <p class="best">${sessionBest > 0 ? `Session best: ${sessionBest} points` : 'No network. No account. Just you and the wind.'}</p>
    </div>`);
}

function renderBriefing(index) {
  const s = SORTIES[index];
  showMenu(`
    <div class="panel">
      <p class="eyebrow">${s.tag}</p>
      <h1>${s.name}</h1>
      <p class="lede">${s.brief}</p>
      <p class="controls"><b>Fly:</b> W/S pitch · A/D bank · Shift/Ctrl throttle · Space brakes ·
        G gear · C camera · E drop the mail · P pause</p>
      <div class="row">
        <button class="btn primary" data-action="start" data-index="${index}">Take off</button>
        <button class="btn" data-action="title">Back</button>
      </div>
    </div>`);
}

function renderPause() {
  showMenu(`
    <div class="panel">
      <p class="eyebrow">PAUSED</p>
      <h1>${missions.currentSortie().name}</h1>
      <p class="lede">Score ${missions.getScore()} · ${missions.hudState(flight).clock} flown.</p>
      <div class="row">
        <button class="btn primary" data-action="resume">Resume</button>
        <button class="btn" data-action="restart">Restart sortie</button>
        <button class="btn" data-action="title">Main menu</button>
      </div>
    </div>`);
}

function renderDebrief() {
  const r = missions.getResult();
  sessionBest = Math.max(sessionBest, r.score);
  const lines = r.lines.map((line) => `<li>${line}</li>`).join('');
  const next = SORTIES.findIndex((s) => s === missions.currentSortie()) + 1;
  showMenu(`
    <div class="panel">
      <p class="eyebrow">${r.reason.toUpperCase()}</p>
      <h1>${r.title}</h1>
      <p class="score-big">${r.score} <span>points</span></p>
      <ul class="debrief">${lines}</ul>
      <div class="row">
        ${next < SORTIES.length ? `<button class="btn primary" data-action="briefing" data-index="${next}">Next sortie</button>` : ''}
        <button class="btn" data-action="restart">Fly again</button>
        <button class="btn" data-action="title">Main menu</button>
      </div>
    </div>`);
}

menuEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  audio.ensure();
  const action = button.dataset.action;
  const index = Number(button.dataset.index ?? briefingIndex);
  if (action === 'briefing') {
    briefingIndex = index;
    screen = 'briefing';
    renderBriefing(index);
  } else if (action === 'start') {
    startSortie(index);
  } else if (action === 'resume') {
    screen = 'play';
    hideMenu();
  } else if (action === 'restart') {
    startSortie(briefingIndex);
  } else if (action === 'title') {
    screen = 'title';
    flight = createFlight(missions.startState(0));
    world.resetRings();
    world.dropBeacon.visible = false;
    placeAircraft();
    renderTitle();
  }
});

function startSortie(index) {
  briefingIndex = index;
  missions.startSortie(index);
  flight = createFlight(missions.startState(index));
  world.resetRings();
  world.dropBeacon.visible = SORTIES[index].id === 'mail-drop';
  cameraMode = 'chase';
  screen = 'play';
  hideMenu();
  // Put the camera behind the plane at once so the first frame is framed.
  const basis = placeAircraft();
  const f = flight;
  camera.position.set(
    f.x - Math.sin(f.heading) * 17,
    f.y + 4.6,
    f.z + Math.cos(f.heading) * 17,
  );
  camera.lookAt(f.x + Math.sin(f.heading) * 22, f.y + 1, f.z - Math.cos(f.heading) * 22);
  toast(`${SORTIES[index].name} — ${SORTIES[index].id === 'landing' ? 'on final, gear down' : 'throttle up to take off'}`);
  statusEl.textContent = `${SORTIES[index].name} started.`;
}

// The fixed-step driver the screenshot scenes use: same code, no wall clock.
function simulate(seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const inputFrame = pilot(flight, world);
    const events = stepFlight(flight, inputFrame, STEP, world.heightAt, WIND);
    missions.update(STEP, flight, world, events, toast);
    world.update(STEP, elapsed);
    elapsed += STEP;
    if (flight.mode === 'crashed') break;
    if (missions.getPhase() === 'debrief') break;
  }
  placeAircraft();
}

function setScreen(name) {
  screen = name;
  if (name === 'title') renderTitle();
}

function setCamera(mode) {
  cameraMode = mode;
}

// --- The frame. ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  // In shot mode the scene was staged by simulate(); the frame stays frozen.
  if (screen === 'play' && !shotMode) {
    const inputFrame = input.read();
    const events = stepFlight(flight, inputFrame, dt, world.heightAt, WIND);
    missions.update(dt, flight, world, events, toast);

    if (input.wasPressed('KeyG')) {
      flight.gearDown = !flight.gearDown;
      toast(flight.gearDown ? 'GEAR DOWN' : 'GEAR UP');
      audio.beep();
    }
    if (input.wasPressed('KeyC')) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : cameraMode === 'cockpit' ? 'tower' : 'chase';
      toast(`CAMERA: ${cameraMode.toUpperCase()}`);
    }
    if (input.wasPressed('KeyM')) {
      const muted = audio.toggleMute();
      toast(muted ? 'SOUND OFF' : 'SOUND ON');
    }
    if (input.wasPressed('KeyE')) {
      const drop = missions.tryDrop(flight);
      if (drop && drop.ok) {
        toast(`MAIL DELIVERED  +${drop.points}`);
        audio.chime();
      } else if (drop) {
        toast('Not over the beacon yet — get low over the pink column');
      }
    }
    if (input.wasPressed('KeyR')) startSortie(briefingIndex);
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      screen = 'pause';
      renderPause();
    }

    for (const event of events) {
      if (event.type === 'landed') audio.thud();
      if (event.type === 'crashed' || event.type === 'ditched') audio.crash();
    }
    if (missions.getPhase() === 'debrief') {
      screen = 'debrief';
      renderDebrief();
    }
    audio.update(flight.throttle, flight.speed / 80, flight.mode === 'air');
  }
  input.endFrame();

  // Warnings, from the flight state.
  warn = null;
  if (screen === 'play') {
    if (flight.mode === 'air' && flight.speed < 24) warn = 'STALL — NOSE DOWN, ADD POWER';
    else if (flight.fuel <= 0 && flight.mode === 'air') warn = 'FUEL EMPTY';
    else if (flight.mode === 'air' && flight.y < 40 && !flight.gearDown) warn = 'GEAR UP — LOW';
    else if (flight.damage > 60) warn = 'HEAVY DAMAGE';
  }

  const basis = placeAircraft();
  // In shot mode the prop stays parked where the staging put it, so the
  // frozen frame is the staged one.
  aircraft.update(shotMode ? 0 : dt, flight.throttle, elapsed);
  world.update(dt, elapsed);
  updateCamera(shotMode ? 1 : dt, basis);
  renderer.render(scene, camera);

  hud.draw(window.innerWidth, window.innerHeight, {
    flight,
    mission: missions.hudState(flight),
    screen,
    warn,
    t: elapsed,
  });

  if (shotMode) {
    // Frozen frame: the shot was staged by simulate(), just keep painting it.
    if (!window.__shotReady) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// Debug handle for the local play-test rig (not part of the game itself).
window.__game = {
  get flight() { return flight; },
  get screen() { return screen; },
  get cameraMode() { return cameraMode; },
  get propRotation() { return aircraft.prop.rotation.z; },
  aircraft,
  missions,
  world,
};

// --- Boot: a ?shot= scene stages itself, otherwise the title screen. ---
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  shotMode = shot;
  const api = {
    startSortie,
    simulate,
    setCamera,
    setScreen,
    get flight() { return flight; },
    world,
    missions,
  };
  stageShot(shot, api);
  // A few frames so the canvas, the HUD and the ring pulse all settle.
  for (let i = 0; i < 5; i += 1) {
    const basis = placeAircraft();
    aircraft.update(0.016, flight.throttle, elapsed);
    world.update(0.016, elapsed);
    updateCamera(1, basis);
    renderer.render(scene, camera);
    hud.draw(window.innerWidth, window.innerHeight, {
      flight,
      mission: missions.hudState(flight),
      screen,
      warn: null,
      t: elapsed,
    });
  }
  // Park the prop blades horizontal, so a frozen cockpit frame never
  // catches a blade across the ring it is aiming at.
  aircraft.prop.rotation.z = Math.PI / 2;
  window.__shotReady = true;
} else {
  placeAircraft();
  renderTitle();
}
requestAnimationFrame(frame);
