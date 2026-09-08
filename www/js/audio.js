// Audio chiptune 100% sintetizado. Sin archivos de sonido.
// El AudioContext DEBE desbloquearse con un gesto del usuario o el juego suena mudo en Android.
import { Save } from './core.js';

let ac = null, master = null, unlocked = false;
let voices = 0;
const MAX_VOICES = 12;   // tope duro: mas de esto cruje en un Snapdragon 678

export function initAudio() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = Save.muted ? 0 : 0.5;
  // Limitador suave para que varios disparos juntos no saturen.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 12; comp.attack.value = 0.003;
  master.connect(comp); comp.connect(ac.destination);
}

// Llamar desde el PRIMER toque real del usuario.
export function unlockAudio() {
  initAudio();
  if (!ac || unlocked) return;
  if (ac.state === 'suspended') ac.resume();
  // Un buffer mudo confirma el desbloqueo en WebView.
  const b = ac.createBuffer(1, 1, 22050);
  const s = ac.createBufferSource();
  s.buffer = b; s.connect(master); s.start(0);
  unlocked = true;
}

export function setMute(m) { if (master) master.gain.value = m ? 0 : 0.5; }
export function toggleMute() { const m = Save.toggleMute(); setMute(m); return m; }
export function suspendAudio() { if (ac && ac.state === 'running') ac.suspend(); }
export function resumeAudio() { if (ac && ac.state === 'suspended') ac.resume(); }

// Onda pulso con duty variable (voz clasica de NES). Los coeficientes van en real[].
const waveCache = new Map();
function pulseWave(duty) {
  const k = Math.round(duty * 100);
  if (waveCache.has(k)) return waveCache.get(k);
  const N = 32, real = new Float32Array(N), imag = new Float32Array(N);
  for (let n = 1; n < N; n++) real[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty);
  const w = ac.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(k, w);
  return w;
}

let noiseBuf = null;
function noiseBuffer() {
  if (noiseBuf) return noiseBuf;
  const len = ac.sampleRate * 0.5;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let reg = 0x7fff;   // LFSR de 15 bits, igual que el canal de ruido del NES
  for (let i = 0; i < len; i++) {
    const bit = ((reg ^ (reg >> 1)) & 1);
    reg = (reg >> 1) | (bit << 14);
    d[i] = (reg & 1) ? 0.6 : -0.6;
  }
  return noiseBuf;
}

// Disparo puntual. type: 'pulse'|'tri'|'saw'|'noise'
export function sfx(o) {
  if (!ac || Save.muted) return;
  if (ac.state === 'suspended') ac.resume();
  if (voices >= MAX_VOICES) return;
  const t = ac.currentTime;
  const dur = o.dur || 0.12;
  const gain = ac.createGain();
  const vol = (o.vol !== undefined ? o.vol : 0.4);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  gain.connect(master);

  let src;
  if (o.type === 'noise') {
    src = ac.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    if (o.filter !== false) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.f0 || 3000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), t + dur);
      src.connect(f); f.connect(gain);
    } else src.connect(gain);
  } else {
    src = ac.createOscillator();
    if (o.type === 'pulse') src.setPeriodicWave(pulseWave(o.duty || 0.5));
    else src.type = o.type === 'tri' ? 'triangle' : o.type === 'saw' ? 'sawtooth' : 'square';
    src.frequency.setValueAtTime(Math.max(20, o.f0 || 440), t);
    if (o.f1) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    src.connect(gain);
  }
  voices++;
  src.onended = () => { voices--; try { src.disconnect(); gain.disconnect(); } catch (e) {} };
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Presets listos.
export const SFX = {
  laser:    () => sfx({ type: 'pulse', duty: 0.25, f0: 880, f1: 180, dur: 0.10, vol: 0.22 }),
  shoot:    () => sfx({ type: 'pulse', duty: 0.5,  f0: 620, f1: 240, dur: 0.07, vol: 0.20 }),
  explode:  () => sfx({ type: 'noise', f0: 2400, f1: 90,  dur: 0.34, vol: 0.45 }),
  hit:      () => sfx({ type: 'noise', f0: 1800, f1: 400, dur: 0.09, vol: 0.30 }),
  punch:    () => sfx({ type: 'noise', f0: 900,  f1: 120, dur: 0.13, vol: 0.38 }),
  hurt:     () => sfx({ type: 'saw',   f0: 300, f1: 70,  dur: 0.26, vol: 0.38 }),
  jump:     () => sfx({ type: 'pulse', duty: 0.5, f0: 260, f1: 720, dur: 0.13, vol: 0.26 }),
  dash:     () => sfx({ type: 'noise', f0: 1200, f1: 2600, dur: 0.14, vol: 0.24 }),
  coin:     () => { sfx({ type: 'pulse', duty: 0.25, f0: 988, dur: 0.05, vol: 0.24 }); setTimeout(() => sfx({ type: 'pulse', duty: 0.25, f0: 1319, dur: 0.11, vol: 0.24 }), 55); },
  powerup:  () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx({ type: 'pulse', duty: 0.5, f0: f, dur: 0.09, vol: 0.26 }), i * 55)); },
  blip:     () => sfx({ type: 'pulse', duty: 0.5, f0: 720, dur: 0.045, vol: 0.20 }),
  select:   () => sfx({ type: 'pulse', duty: 0.25, f0: 520, f1: 1040, dur: 0.11, vol: 0.26 }),
  brick:    () => sfx({ type: 'pulse', duty: 0.125, f0: 1100, f1: 700, dur: 0.05, vol: 0.24 }),
  alarm:    () => { [0, 200].forEach(d => setTimeout(() => sfx({ type: 'saw', f0: 400, f1: 700, dur: 0.18, vol: 0.30 }), d)); },
  gameover: () => { [523, 440, 349, 262].forEach((f, i) => setTimeout(() => sfx({ type: 'tri', f0: f, dur: 0.3, vol: 0.34 }), i * 170)); },
  record:   () => { [659, 784, 988, 1319, 1568].forEach((f, i) => setTimeout(() => sfx({ type: 'pulse', duty: 0.5, f0: f, dur: 0.14, vol: 0.30 }), i * 90)); },
  wave:     () => { [392, 523, 659].forEach((f, i) => setTimeout(() => sfx({ type: 'pulse', duty: 0.5, f0: f, dur: 0.13, vol: 0.28 }), i * 80)); },
};
