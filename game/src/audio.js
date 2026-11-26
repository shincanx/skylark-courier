// Skylark Courier — sound with no sound files. The engine is two detuned
// oscillators whose pitch follows the throttle, the wind is filtered noise
// that rises with speed, and the chimes, thuds and beeps are short synth
// blips. Everything starts on the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      // Engine: a sawtooth plus a sub sine, through a low-pass.
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sine';
      engineOsc2.frequency.value = 35;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped white noise through a band-pass.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noise.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function update(throttle, speed01, airborne) {
    if (!started || !ctx) return;
    const t = ctx.currentTime;
    const rpm = 0.25 + throttle * 0.75;
    engineOsc.frequency.setTargetAtTime(55 + rpm * 95, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(28 + rpm * 46, t, 0.08);
    engineGain.gain.setTargetAtTime(airborne || throttle > 0.05 ? 0.05 + throttle * 0.075 : 0.02, t, 0.1);
    windGain.gain.setTargetAtTime(speed01 * speed01 * 0.16, t, 0.15);
    windFilter.frequency.setTargetAtTime(500 + speed01 * 900, t, 0.15);
  }

  function blip(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!started || !ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function chime() {
    blip(660, 0.35, 'sine', 0.28);
    blip(880, 0.4, 'sine', 0.24, 0.09);
    blip(1320, 0.5, 'sine', 0.18, 0.18);
  }

  function thud() {
    blip(70, 0.3, 'sine', 0.5);
    blip(45, 0.4, 'triangle', 0.4, 0.02);
  }

  function crash() {
    blip(55, 0.7, 'sawtooth', 0.4);
    blip(38, 0.9, 'triangle', 0.5, 0.05);
  }

  function beep() {
    blip(880, 0.14, 'square', 0.12);
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    return muted;
  }

  return { ensure, update, chime, thud, crash, beep, toggleMute };
}
