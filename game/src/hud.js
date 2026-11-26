// Skylark Courier — the lit instruments. A 2D overlay canvas draws the
// glowing dashboard the pilot actually flies by: attitude, airspeed,
// altimeter, heading, fuel and throttle, plus the digital HUD (altitude,
// speed, heading) and the next objective's steering arrow. Everything is
// drawn, nothing is an image, so the instruments always match the flight.
const CYAN = '#7fe7ff';
const AMBER = '#ffb347';
const GREEN = '#7dffa8';
const RED = '#ff5d5d';
const PANEL = 'rgba(10, 16, 24, 0.88)';
const DIAL = '#0d1b26';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function dialFace(g, cx, cy, r, label) {
  g.save();
  g.fillStyle = DIAL;
  g.strokeStyle = 'rgba(127,231,255,0.55)';
  g.lineWidth = 2;
  g.shadowColor = CYAN;
  g.shadowBlur = 12;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = CYAN;
  g.font = `600 ${Math.max(10, r * 0.22)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.fillText(label, cx, cy + r + 14);
  g.restore();
}

function needle(g, cx, cy, r, angle, colour, width = 3) {
  g.save();
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.shadowColor = colour;
  g.shadowBlur = 8;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(angle) * r * 0.82, cy + Math.sin(angle) * r * 0.82);
  g.stroke();
  g.fillStyle = colour;
  g.beginPath();
  g.arc(cx, cy, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function ticks(g, cx, cy, r, count, startDeg, spanDeg, labels) {
  g.save();
  g.fillStyle = 'rgba(230,245,255,0.85)';
  g.font = `600 ${Math.max(9, r * 0.2)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i <= count; i += 1) {
    const a = ((startDeg + (spanDeg * i) / count - 90) * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * r * 0.92;
    const y1 = cy + Math.sin(a) * r * 0.92;
    const x2 = cx + Math.cos(a) * r * 0.78;
    const y2 = cy + Math.sin(a) * r * 0.78;
    g.strokeStyle = 'rgba(230,245,255,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    if (labels && labels[i] !== undefined) {
      g.fillText(labels[i], cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
    }
  }
  g.restore();
}

export function createHud(canvas) {
  const g = canvas.getContext('2d');
  const messages = [];

  function toast(text, seconds = 3) {
    messages.push({ text, until: performance.now() / 1000 + seconds });
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  // state: { flight, mission, screen, warn, t }
  function draw(w, h, state) {
    const { flight, mission } = state;
    g.clearRect(0, 0, w, h);
    if (state.screen !== 'play') return;
    const now = performance.now() / 1000;
    const kmh = Math.round(flight.speed * 3.6);
    const headingDeg = ((Math.round((flight.heading * 180) / Math.PI) % 360) + 360) % 360;
    const alt = Math.max(0, Math.round(flight.y));

    // --- Top HUD bar: ALT / SPD / HDG, big and readable at a glance. ---
    const barH = 54;
    g.save();
    g.fillStyle = 'rgba(8, 14, 20, 0.72)';
    g.fillRect(0, 0, w, barH);
    g.fillStyle = CYAN;
    g.shadowColor = CYAN;
    g.shadowBlur = 10;
    g.font = '700 15px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('ALT', 18, 22);
    g.fillText('SPD', 168, 22);
    g.fillText('HDG', 318, 22);
    g.font = '700 24px system-ui, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(`${alt} m`, 18, 46);
    g.fillText(`${kmh} km/h`, 168, 46);
    g.fillText(`${String(headingDeg).padStart(3, '0')}°`, 318, 46);
    // Score, clock and fuel on the right.
    g.textAlign = 'right';
    g.font = '700 15px system-ui, sans-serif';
    g.fillStyle = CYAN;
    g.fillText(mission.name.toUpperCase(), w - 18, 22);
    g.font = '700 20px system-ui, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(`SCORE ${mission.score}   ⏱ ${mission.clock}`, w - 18, 46);
    g.restore();

    // --- Objective line under the bar. ---
    g.save();
    g.font = '600 15px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 4;
    g.fillText(mission.objective, 18, barH + 26);
    g.restore();

    // --- Steering arrow to the next objective, around the centre. ---
    if (mission.arrow) {
      const { angle, distance, label } = mission.arrow;
      const cx = w / 2;
      const cy = h / 2 - 60;
      g.save();
      g.translate(cx, cy);
      g.rotate(angle);
      g.fillStyle = AMBER;
      g.shadowColor = AMBER;
      g.shadowBlur = 14;
      g.beginPath();
      g.moveTo(0, -46);
      g.lineTo(16, 6);
      g.lineTo(6, 2);
      g.lineTo(6, 26);
      g.lineTo(-6, 26);
      g.lineTo(-6, 2);
      g.lineTo(-16, 6);
      g.closePath();
      g.fill();
      g.restore();
      g.save();
      g.font = '700 16px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.7)';
      g.shadowBlur = 4;
      g.fillText(`${label} · ${distance} m`, cx, cy + 56);
      g.restore();
    }

    // --- Toasts, stacked under the objective. ---
    g.save();
    g.font = '700 17px system-ui, sans-serif';
    g.textAlign = 'center';
    let ty = barH + 56;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].until < now) {
        messages.splice(i, 1);
        continue;
      }
      g.fillStyle = '#ffe9a8';
      g.shadowColor = 'rgba(0,0,0,0.7)';
      g.shadowBlur = 6;
      g.fillText(messages[i].text, w / 2, ty);
      ty += 26;
    }
    g.restore();

    // --- Warnings: stall, gear, fuel — flashing, impossible to miss. ---
    if (state.warn && Math.floor(now * 3) % 2 === 0) {
      g.save();
      g.font = '800 26px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = RED;
      g.shadowColor = RED;
      g.shadowBlur = 18;
      g.fillText(state.warn, w / 2, h - 210);
      g.restore();
    }

    // --- Dashboard: the lit panel along the bottom. ---
    const panelH = 148;
    const panelY = h - panelH;
    g.save();
    g.fillStyle = PANEL;
    g.strokeStyle = 'rgba(127,231,255,0.35)';
    g.lineWidth = 1.5;
    roundRect(g, 12, panelY + 8, w - 24, panelH - 16, 16);
    g.fill();
    g.stroke();
    g.restore();

    const cy = panelY + panelH / 2 + 2;
    const r = 52;
    const gap = Math.min(150, (w - 260) / 4);
    let cx = 92;

    // 1. Attitude indicator: the horizon rolls and pitches with the plane.
    g.save();
    dialFace(g, cx, cy, r, 'ATTITUDE');
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 4, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-flight.bank);
    const pitchPx = Math.max(-r, Math.min(r, flight.pitch * r * 1.4));
    g.fillStyle = '#3d7ab8';
    g.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    g.fillStyle = '#8a6a42';
    g.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-r, -pitchPx);
    g.lineTo(r, -pitchPx);
    g.stroke();
    g.restore();
    // Fixed aircraft symbol over the horizon.
    g.strokeStyle = AMBER;
    g.lineWidth = 3;
    g.shadowColor = AMBER;
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(cx - 16, cy);
    g.lineTo(cx - 4, cy);
    g.moveTo(cx + 4, cy);
    g.lineTo(cx + 16, cy);
    g.moveTo(cx, cy);
    g.lineTo(cx, cy + 5);
    g.stroke();
    g.restore();
    cx += gap;

    // 2. Airspeed.
    dialFace(g, cx, cy, r, 'AIRSPEED');
    ticks(g, cx, cy, r, 8, 225, 270, ['0', '', '80', '', '160', '', '240', '', '320']);
    needle(g, cx, cy, r, ((225 + (kmh / 320) * 270 - 90) * Math.PI) / 180, GREEN);
    g.save();
    g.fillStyle = '#ffffff';
    g.font = '700 15px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${kmh}`, cx, cy + 22);
    g.restore();
    cx += gap;

    // 3. Altimeter (0–1000 m per turn; the digital readout sits inside,
    // so the dial keeps no inner numerals to collide with it).
    dialFace(g, cx, cy, r, 'ALTITUDE');
    ticks(g, cx, cy, r, 10, 0, 360, null);
    needle(g, cx, cy, r, (((alt % 1000) / 1000) * 360 - 90) * Math.PI / 180, CYAN);
    g.save();
    g.fillStyle = '#ffffff';
    g.font = '700 15px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${alt} m`, cx, cy + 22);
    g.restore();
    cx += gap;

    // 4. Heading compass: a rotating strip with N/E/S/W.
    dialFace(g, cx, cy, r, 'HEADING');
    g.save();
    g.beginPath();
    g.arc(cx, cy, r - 4, 0, Math.PI * 2);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-flight.heading);
    g.fillStyle = '#eaf6ff';
    g.font = '700 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const points = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']];
    for (const [deg, label] of points) {
      const a = (deg * Math.PI) / 180;
      g.fillText(label, Math.sin(a) * (r - 16), -Math.cos(a) * (r - 16));
    }
    for (let deg = 0; deg < 360; deg += 30) {
      const a = (deg * Math.PI) / 180;
      g.strokeStyle = 'rgba(234,246,255,0.8)';
      g.lineWidth = deg % 90 === 0 ? 2.5 : 1;
      g.beginPath();
      g.moveTo(Math.sin(a) * (r - 6), -Math.cos(a) * (r - 6));
      g.lineTo(Math.sin(a) * (r - 14), -Math.cos(a) * (r - 14));
      g.stroke();
    }
    g.restore();
    // Fixed lubber line at the top of the compass.
    g.save();
    g.fillStyle = AMBER;
    g.shadowColor = AMBER;
    g.shadowBlur = 6;
    g.beginPath();
    g.moveTo(cx - 6, cy - r + 4);
    g.lineTo(cx + 6, cy - r + 4);
    g.lineTo(cx, cy - r + 14);
    g.closePath();
    g.fill();
    g.restore();
    cx += gap;

    // 5. Fuel + RPM + throttle lever + gear lamp.
    const fx = cx - 10;
    g.save();
    g.fillStyle = '#eaf6ff';
    g.font = '600 11px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('FUEL', fx, cy - 44);
    g.fillText('RPM', fx, cy - 6);
    g.fillText('THR', fx + 92, cy - 44);
    // Fuel bar.
    g.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(g, fx, cy - 38, 70, 14, 4);
    g.fill();
    g.fillStyle = flight.fuel < 20 ? RED : GREEN;
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 8;
    roundRect(g, fx, cy - 38, 70 * (flight.fuel / 100), 14, 4);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.font = '700 12px system-ui, sans-serif';
    g.fillText(`${Math.round(flight.fuel)}%`, fx + 76, cy - 26);
    // RPM bar.
    const rpm = flight.fuel > 0 ? flight.throttle : 0;
    g.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(g, fx, cy, 70, 14, 4);
    g.fill();
    g.fillStyle = AMBER;
    g.shadowColor = AMBER;
    g.shadowBlur = 8;
    roundRect(g, fx, cy, 70 * rpm, 14, 4);
    g.fill();
    g.shadowBlur = 0;
    // Damage bar.
    g.fillStyle = '#eaf6ff';
    g.font = '600 11px system-ui, sans-serif';
    g.fillText('DMG', fx, cy + 32);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(g, fx, cy + 38, 70, 14, 4);
    g.fill();
    g.fillStyle = flight.damage > 60 ? RED : AMBER;
    roundRect(g, fx, cy + 38, 70 * (flight.damage / 100), 14, 4);
    g.fill();
    // Throttle lever slot.
    const lx = fx + 92;
    g.strokeStyle = 'rgba(127,231,255,0.6)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(lx + 12, cy - 38);
    g.lineTo(lx + 12, cy + 52);
    g.stroke();
    const leverY = cy + 52 - (cy + 52 - (cy - 38)) * flight.throttle;
    g.fillStyle = AMBER;
    g.shadowColor = AMBER;
    g.shadowBlur = 10;
    roundRect(g, lx, leverY - 7, 24, 14, 4);
    g.fill();
    g.shadowBlur = 0;
    // Gear lamp.
    g.fillStyle = flight.gearDown ? GREEN : RED;
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 10;
    g.beginPath();
    g.arc(lx + 48, cy - 30, 8, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#eaf6ff';
    g.font = '600 11px system-ui, sans-serif';
    g.fillText(flight.gearDown ? 'GEAR DOWN' : 'GEAR UP', lx + 60, cy - 26);
    g.fillText(`V/S ${flight.verticalSpeed >= 0 ? '+' : ''}${flight.verticalSpeed.toFixed(1)} m/s`, lx + 48, cy + 8);
    g.restore();
  }

  return { draw, toast, resize };
}
