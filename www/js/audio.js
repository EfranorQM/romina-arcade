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
// Al minimizar hay que parar TAMBIEN el temporizador del secuenciador: si solo
// se suspende el contexto, el reloj sigue y al volver se disparan de golpe todas
// las notas acumuladas.
export function suspendAudio() {
  if (seqTimer) { clearTimeout(seqTimer); seqTimer = 0; }
  if (ac && ac.state === 'running') ac.suspend();
}

export function resumeAudio() {
  if (ac && ac.state === 'suspended') ac.resume();
  // Resincroniza el acumulador con el reloj actual antes de reanudar.
  if (seq && ac && !seqTimer) { seq.next = ac.currentTime + 0.08; seqTick(); }
}

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

// ---------- Musica: secuenciador con lookahead ----------
// setTimeout solo derivaria: se programan notas por adelantado con tiempos
// ABSOLUTOS del AudioContext. 0.15s de anticipacion aguanta el throttling de MIUI.
const NOTE = {
  C:130.81, D:146.83, E:164.81, F:174.61, G:196.00, A:220.00, B:246.94,
  c:261.63, d:293.66, e:329.63, f:349.23, g:392.00, a:440.00, b:493.88,
  x:523.25, y:587.33, z:659.25,
};
const LOOKAHEAD = 25, AHEAD = 0.15;
let seq = null, seqTimer = 0;

function noteAt(o, when) {
  if (!ac || Save.muted) return;
  const gain = ac.createGain();
  const vol = o.vol || 0.12;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(vol, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
  gain.connect(master);
  let src;
  if (o.wave === 'noise') {
    src = ac.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(o.f0 || 800, when);
    src.connect(f); f.connect(gain);
  } else {
    src = ac.createOscillator();
    if (o.wave === 'pulse') src.setPeriodicWave(pulseWave(o.duty || 0.5));
    else src.type = o.wave === 'tri' ? 'triangle' : 'square';
    src.frequency.setValueAtTime(o.f0, when);
    src.connect(gain);
  }
  src.onended = () => { try { src.disconnect(); gain.disconnect(); } catch (e) {} };
  src.start(when);
  src.stop(when + o.dur + 0.02);
}

function seqTick() {
  if (!seq || !ac) return;
  while (seq.next < ac.currentTime + AHEAD) {
    const t = seq.next;
    for (const tr of seq.song.tracks) {
      const c = tr.pattern[seq.step % tr.pattern.length];
      if (c && c !== '.') {
        if (tr.wave === 'noise') {
          noteAt({ wave:'noise', f0: c === 'H' ? 2400 : 700, dur: c === 'H' ? 0.04 : 0.09, vol: tr.vol }, t);
        } else if (NOTE[c]) {
          noteAt({ wave:tr.wave, duty:tr.duty, f0:NOTE[c], dur:seq.stepDur * (tr.gate || 0.8), vol:tr.vol }, t);
        }
      }
    }
    seq.next += seq.stepDur;
    seq.step++;
  }
  seqTimer = setTimeout(seqTick, LOOKAHEAD);
}

export function playMusic(song) {
  if (!ac) return;
  // Pedir la cancion que YA suena no la reinicia. SURVIVAL cambia de tema al
  // entrar y al morir cada jefe; sin esta guarda, cualquier llamada de mas
  // cortaria el compas por la mitad y se oiria el salto.
  if (seq && seq.song === song) return;
  stopMusic();
  seq = { song, step:0, stepDur: 60 / song.bpm / 4, next: ac.currentTime + 0.08 };
  seqTick();
}

// Que cancion suena ahora mismo, o null. La usa SURVIVAL para volver al tema de
// las olas solo si de verdad estaba en el del jefe.
export function currentSong() { return seq ? seq.song : null; }

export function stopMusic() {
  if (seqTimer) { clearTimeout(seqTimer); seqTimer = 0; }
  seq = null;
}

// Tres pistas: bajo, arpegio y percusion. 16 pasos por compas.
export const SONGS = {
  skyline: { bpm: 138, tracks: [
    { wave:'tri',   pattern:'C...C...G...G...F...F...G...G...', vol:0.16 },
    { wave:'pulse', duty:0.25, pattern:'c.e.g.e.c.e.g.e.b.d.f.d.g.b.d.b.', vol:0.07 },
    { wave:'noise', pattern:'H.h.H.h.H.h.H.hH', vol:0.05 },
  ]},
  neonfist: { bpm: 152, tracks: [
    { wave:'tri',   pattern:'A...A...E...E...F...F...G...G...', vol:0.17 },
    { wave:'pulse', duty:0.125, pattern:'a.a.e.e.a.a.b.b.f.f.c.c.g.g.b.b.', vol:0.07 },
    { wave:'noise', pattern:'H.hHH.h.H.hHH.h.', vol:0.06 },
  ]},
  lastwave: { bpm: 126, tracks: [
    { wave:'tri',   pattern:'D...D...B...B...G...G...A...A...', vol:0.16 },
    { wave:'pulse', duty:0.5, pattern:'d.f.a.f.d.f.a.f.b.d.g.d.a.c.e.c.', vol:0.06 },
    { wave:'noise', pattern:'H...h...H...h.h.', vol:0.05 },
  ]},
  // FURIA: la mas rapida del arcade. Bajo en corcheas constantes (motor que no
  // afloja) y percusion densa; el arpegio sube para dar sensacion de carrera.
  furia: { bpm: 166, tracks: [
    // 'saw' solo existe para efectos puntuales: playMusic solo entiende
    // tri/pulse/noise, asi que un 'saw' aqui sonaria como cuadrada sin avisar.
    { wave:'tri',   pattern:'E.E.E.E.E.E.E.E.C.C.C.C.G.G.G.G.', vol:0.16 },
    { wave:'pulse', duty:0.25, pattern:'e.g.b.g.e.g.b.g.c.e.g.e.g.b.d.b.', vol:0.07 },
    { wave:'noise', pattern:'H.hHH.hHH.hHH.hH', vol:0.06 },
  ]},

  // SURVIVAL: un juego de AGUANTAR, no de correr. La de las olas va en La menor
  // a tempo medio: tiene que sostener veinte minutos de partida sin cansar, asi
  // que el bajo pisa en redondas (no en corcheas como FURIA) y la percusion
  // deja huecos. El arpegio baja al final del compas, que es lo que le da el
  // aire de "esto viene hacia ti" en vez de marcha triunfal.
  survival: { bpm: 132, tracks: [
    { wave:'tri',   pattern:'A...A...F...F...C...C...G...G...', vol:0.16 },
    { wave:'pulse', duty:0.25, pattern:'a.c.e.c.a.c.e.c.f.a.c.a.e.g.b.g.', vol:0.065 },
    { wave:'noise', pattern:'H...h...H...h...', vol:0.05 },
  ]},
  // ---------- SURVIVAL: un tema por bioma ----------
  // El de arriba (`survival`) es el de LA DUDA y se queda como estaba: es el
  // que ella ya conoce. Los otros cuatro bajan de tonalidad y de tempo o suben,
  // segun lo que tenga que sentir el tramo. Todos comparten la misma estructura
  // (bajo en tri, arpegio en pulse, percusion en noise) para que suenen del
  // mismo juego y no de cinco juegos distintos.

  // EL VACIO: Re menor, mas lenta que ninguna. El bajo deja compases enteros en
  // silencio y la percusion casi desaparece: aqui no hay nada a lo que
  // agarrarse, y el hueco entre notas es lo que lo cuenta.
  bioVacio: { bpm: 116, tracks: [
    { wave:'tri',   pattern:'D.......A.......F.......C.......', vol:0.15 },
    { wave:'pulse', duty:0.5, pattern:'d...a...f...c...d...f...a...d...', vol:0.06 },
    { wave:'noise', pattern:'H.......h.......', vol:0.035 },
  ]},

  // LA MENTIRA: Mi menor con el arpegio a contratiempo del bajo. Suena
  // agradable pero nunca termina de cuadrar, que es de lo que va el bioma.
  bioMentira: { bpm: 144, tracks: [
    { wave:'tri',   pattern:'E...E...C...C...G...G...B...B...', vol:0.16 },
    { wave:'pulse', duty:0.125, pattern:'.e.g.b.e.g.b.e.g.c.e.g.c.b.d.g..', vol:0.07 },
    { wave:'noise', pattern:'H..hH..h.H..hH.h', vol:0.05 },
  ]},

  // EL SILENCIO: la mas vacia de las cinco. Solo bajo y un arpegio que aparece
  // de vez en cuando; la percusion es un golpe suelto por compas. Un bioma que
  // se llama silencio no puede sonar lleno.
  bioSilencio: { bpm: 104, tracks: [
    { wave:'tri',   pattern:'C.......G.......A.......E.......', vol:0.14 },
    { wave:'pulse', duty:0.5, pattern:'........c...e.......g...b.......', vol:0.055 },
    { wave:'noise', pattern:'h...............', vol:0.03 },
  ]},

  // EL ABANDONO: La menor otra vez, como el primer bioma, pero rapida y con el
  // bajo en corcheas sin descanso. Cierra el circulo: el mismo sitio, ya sin
  // nada. Es la mas dura de las cinco.
  bioAbandono: { bpm: 158, tracks: [
    { wave:'tri',   pattern:'A.A.A.A.G.G.G.G.F.F.F.F.E.E.E.E.', vol:0.17 },
    { wave:'pulse', duty:0.25, pattern:'a.c.e.a.g.b.d.g.f.a.c.f.e.g.b.e.', vol:0.07 },
    { wave:'noise', pattern:'H.hHH.hHH.hHH.hH', vol:0.055 },
  ]},

  // SURVIVAL, pelea de jefe. Misma tonalidad que las olas (La menor) para que
  // el cambio no suene a otro juego, pero 30 bpm mas rapida, el bajo en
  // corcheas y la percusion densa. El arpegio sube en vez de bajar: aqui la que
  // aprieta es ella.
  survivalBoss: { bpm: 162, tracks: [
    { wave:'tri',   pattern:'A.A.A.A.F.F.F.F.G.G.G.G.E.E.E.E.', vol:0.17 },
    { wave:'pulse', duty:0.125, pattern:'a.e.a.c.e.a.c.e.f.c.f.a.c.e.g.b.', vol:0.075 },
    { wave:'noise', pattern:'H.hHH.hHH.hHH.hH', vol:0.06 },
  ]},
};

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
