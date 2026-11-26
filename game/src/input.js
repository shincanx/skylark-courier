// Skylark Courier — keyboard and mouse. The keyboard flies the plane; the
// mouse works the menus, drags to steer, and rolls the throttle with the
// wheel. Edge-triggered keys (gear, camera, pause...) are consumed once per
// frame so a held key never double-fires.
export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const drag = { active: false, x: 0, y: 0, dx: 0, dy: 0 };
  let wheelDelta = 0;

  const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
  ]);

  function onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onBlur() {
    held.clear();
    drag.active = false;
  }

  function onPointerDown(event) {
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.dx = 0;
    drag.dy = 0;
  }
  function onPointerMove(event) {
    if (!drag.active) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
  }
  function onPointerUp() {
    drag.active = false;
    drag.dx = 0;
    drag.dy = 0;
  }
  function onWheel(event) {
    event.preventDefault();
    wheelDelta -= Math.sign(event.deltaY);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  // Drag steering lives on the game canvas only, so menu clicks stay clicks.
  const canvas = document.getElementById('scene');
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // The frame's control input, -1..1 for pitch and roll.
  function read() {
    let pitch = 0;
    let roll = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) pitch += 1;
    if (held.has('KeyS') || held.has('ArrowDown')) pitch -= 1;
    if (held.has('KeyA') || held.has('ArrowLeft')) roll -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) roll += 1;
    // A mouse drag steers too: right drag banks right, up drag climbs.
    if (drag.active) {
      roll += Math.max(-1, Math.min(1, drag.dx / 140));
      pitch += Math.max(-1, Math.min(1, -drag.dy / 140));
    }
    let throttleDelta = 0;
    if (held.has('ShiftLeft') || held.has('ShiftRight')) throttleDelta += 1;
    if (held.has('ControlLeft') || held.has('ControlRight')) throttleDelta -= 1;
    throttleDelta += wheelDelta * 0.25;
    wheelDelta = 0;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleDelta,
      brake: held.has('Space'),
    };
  }

  // True once for the frame the key went down; consumed by the caller.
  function wasPressed(code) {
    if (pressed.has(code)) {
      pressed.delete(code);
      return true;
    }
    return false;
  }

  function endFrame() {
    pressed.clear();
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  return { read, wasPressed, endFrame, destroy, held };
}
