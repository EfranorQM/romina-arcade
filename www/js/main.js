// ROMINA'S ARCADE — arranque, bucle de tiempo fijo, gestor de escenas y menu.
import { VW, VH, BASE_VW, BASE_VH, setVirtual, setRotatable, initCanvas, view, makeRng, Save, cam } from './core.js';
import { initInput } from './input.js';
import { initAudio, unlockAudio, SFX, toggleMute, suspendAudio, resumeAudio, playMusic, stopMusic, SONGS } from './audio.js';
import { text, textCenter, measure } from './font.js';
import { particles, updateParticles, drawParticles } from './gfx.js';
import { GAMES } from './games.js';

let g = null;
const rnd = makeRng(0x1234abcd);

// ---------- Gestor de escenas con cambio diferido ----------
const sm = {
  cur: null, next: null, nextArgs: null,
  go(scene, args) { this.next = scene; this.nextArgs = args || {}; },
  flush() {
    if (!this.next) return;
    if (this.cur && this.cur.destroy) this.cur.destroy();
    particles.clear(); cam.reset();
    this.cur = this.next; this.next = null;
    // La resolucion se fija ANTES de init(): los juegos hornean sprites y
    // calculan posiciones contra VW/VH, asi que deben leer ya el valor nuevo.
    const m = this.cur.meta;
    setVirtual(m.vw || BASE_VW, m.vh || BASE_VH);
    // Solo los juegos que lo declaran giran; el resto queda fijo en vertical.
    setRotatable(!!m.rotates, () => { if (this.cur && this.cur.onResize) this.cur.onResize(); });
    if (this.cur.init) this.cur.init(ctx, this.nextArgs);
    // La musica vive en la capa compartida: cada juego solo declara su cancion.
    const song = SONGS[this.cur.meta.id];
    if (song) playMusic(song); else stopMusic();
  },
};

// Contexto compartido que recibe cada juego.
const ctx = {
  // Getters, no copias: con resolucion variable un valor copiado al arrancar
  // se quedaria en 270x600 aunque el juego activo pida 540x1200.
  get VW() { return VW; },
  get VH() { return VH; },
  rnd,
  gameOver(score) {
    const id = sm.cur.meta.id;
    const isRecord = Save.submit(id, Math.floor(score));
    sm.go(GameOver, { id, score: Math.floor(score), isRecord, title: sm.cur.meta.title });
  },
  toMenu() { sm.go(Menu, {}); },
};

// ---------- Escena: MENU ----------
const Menu = {
  meta: { id: '_menu', title: 'MENU' },
  init() { this.sel = 0; this.t = 0; this.cardY = []; },
  update(dt) { this.t += dt; },
  draw(g) {
    g.fillStyle = '#12082a'; g.fillRect(0, 0, VW, VH);
    // Titulo
    const pulse = 1 + Math.sin(this.t * 2) * 0.04;
    textCenter(g, "ROMINA'S", VW / 2, 40, '#ff5c9d', 4);
    textCenter(g, 'ARCADE', VW / 2, 78, '#5cffd8', 4);
    textCenter(g, 'TOCA UN JUEGO', VW / 2, 116, '#8a7ab8', 2);

    // Tarjetas de juego: reparten el alto disponible entre el titulo y el pie.
    const top = 150, bottom = VH - 56, gap = 10;
    const hgt = Math.floor((bottom - top - gap * (GAMES.length - 1)) / GAMES.length);
    this.cardY.length = 0;
    for (let i = 0; i < GAMES.length; i++) {
      const G = GAMES[i], y = top + i * (hgt + gap);
      this.cardY.push(y);
      const on = this.sel === i;
      g.fillStyle = on ? '#2a1a54' : '#1c0f3d';
      g.fillRect(14, y, VW - 28, hgt);
      g.fillStyle = G.meta.colors[0];
      g.fillRect(14, y, 4, hgt);
      // Tres lineas separadas para que nada se solape.
      text(g, G.meta.title, 28, y + 14, G.meta.colors[0], 3);
      text(g, G.meta.tag || '', 28, y + 40, '#7a6aa8', 2);
      const bs = 'MEJOR ' + Save.best(G.meta.id);
      text(g, bs, 28, y + 60, '#c8b8ff', 2);
      // Flecha a la derecha: indica "tocar para jugar" sin texto.
      g.fillStyle = G.meta.colors[1] || G.meta.colors[0];
      const ax = VW - 34, ay = Math.round(y + hgt / 2);
      for (let k = 0; k < 6; k++) {
        g.fillRect(ax + k, ay - 6 + k, 2, 2);
        g.fillRect(ax + k, ay + 6 - k, 2, 2);
      }
    }
    // Pie
    textCenter(g, Save.muted ? 'SONIDO OFF' : 'SONIDO ON', VW / 2, VH - 26, '#5a4a88', 2);
  },
  onInput(ev) {
    if (ev.type !== 'down') return;
    // Toggle de sonido abajo
    if (ev.y > VH - 40) { toggleMute(); SFX.blip(); return; }
    // Misma geometria que draw(): si cambia alli, cambia aqui.
    const top = 150, bottom = VH - 56, gap = 10;
    const hgt = Math.floor((bottom - top - gap * (GAMES.length - 1)) / GAMES.length);
    for (let i = 0; i < GAMES.length; i++) {
      const y = top + i * (hgt + gap);
      if (ev.y >= y && ev.y <= y + hgt) {
        SFX.select();
        sm.go(GAMES[i], { seed: (Math.random() * 0xffffffff) >>> 0 });
        return;
      }
    }
  },
};

// ---------- Escena: GAME OVER ----------
const GameOver = {
  meta: { id: '_over', title: 'FIN' },
  init(c, a) {
    this.score = a.score; this.isRecord = a.isRecord; this.gameId = a.id; this.title = a.title;
    this.t = 0; this.canTap = false;
    if (a.isRecord) SFX.record(); else SFX.gameover();
    this.msg = a.isRecord ? RECORD_MSGS[(Math.random() * RECORD_MSGS.length) | 0] : null;
  },
  update(dt) { this.t += dt; if (this.t > 0.55) this.canTap = true; },
  draw(g) {
    g.fillStyle = '#0d0620'; g.fillRect(0, 0, VW, VH);
    textCenter(g, this.title, VW / 2, 120, '#5a4a88', 2);
    if (this.isRecord) {
      const f = Math.sin(this.t * 8) > 0 ? '#ffe14d' : '#ff5c9d';
      textCenter(g, 'RECORD NUEVO!', VW / 2, 150, f, 3);
    } else {
      textCenter(g, 'FIN DEL JUEGO', VW / 2, 150, '#ff5c9d', 3);
    }
    textCenter(g, String(this.score), VW / 2, 200, '#ffffff', 5);
    textCenter(g, 'MEJOR ' + Save.best(this.gameId), VW / 2, 250, '#8a7ab8', 2);
    if (this.msg) {
      // Mensaje carinoso, solo al romper record.
      textCenter(g, this.msg[0], VW / 2, 300, '#5cffd8', 2);
      if (this.msg[1]) textCenter(g, this.msg[1], VW / 2, 318, '#5cffd8', 2);
    }
    if (this.canTap && Math.sin(this.t * 4) > -0.3) {
      textCenter(g, 'TOCA PARA JUGAR', VW / 2, VH - 120, '#ffffff', 2);
      textCenter(g, 'MANTEN PARA MENU', VW / 2, VH - 96, '#5a4a88', 2);
    }
  },
  onInput(ev) {
    if (!this.canTap) return;
    if (ev.type === 'down') { this.holdT = 0; this.holding = true; }
    if (ev.type === 'up' && this.holding) {
      this.holding = false;
      const G = GAMES.find(x => x.meta.id === this.gameId);
      if (this.holdT > 0.45) { SFX.blip(); sm.go(Menu, {}); }
      else { SFX.select(); sm.go(G, { seed: (Math.random() * 0xffffffff) >>> 0 }); }
    }
  },
};

// Mensajitos al romper record. Cortos: nunca interrumpen la accion.
const RECORD_MSGS = [
  ['ERES INCREIBLE', 'ROMINA'],
  ['NADIE COMO TU'],
  ['TE AMO', 'CAMPEONA'],
  ['IMPARABLE'],
  ['ESA ES MI CHICA'],
  ['BRUTAL ROMINA'],
];

// Los juegos necesitan medir el hold en game over.
const _goUpdate = GameOver.update;
GameOver.update = function (dt) { _goUpdate.call(this, dt); if (this.holding) this.holdT = (this.holdT || 0) + dt; };

// ---------- Bucle de tiempo fijo ----------
const STEP = 1000 / 60, MAX_STEPS = 5, MAX_FRAME = 250;
let acc = 0, prev = 0, raf = 0;

function frame(now) {
  raf = requestAnimationFrame(frame);      // primero: el bucle sobrevive a una excepcion
  let dt = now - prev; prev = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;      // absorbe pausas (background, GC, MIUI)
  acc += dt;
  let n = 0;
  const s = STEP / 1000;
  while (acc >= STEP && n < MAX_STEPS) {
    sm.flush();
    if (sm.cur && sm.cur.update) sm.cur.update(s, ctx);
    updateParticles(s);
    cam.update(s, rnd);
    acc -= STEP; n++;
  }
  if (n === MAX_STEPS && acc > STEP) acc = 0;   // corta la espiral de la muerte

  g.save();
  if (cam.x || cam.y) g.translate(cam.x, cam.y);
  if (sm.cur && sm.cur.draw) sm.cur.draw(g, ctx);
  drawParticles(g);
  g.restore();
}

// ---------- Arranque ----------
function boot() {
  const el = document.getElementById('c');
  g = initCanvas(el);
  initAudio();
  initInput(el, ev => {
    if (ev.type === 'down') unlockAudio();   // desbloqueo de audio en el primer toque
    if (sm.cur && sm.cur.onInput) sm.cur.onInput(ev, ctx);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); suspendAudio(); }
    else { prev = performance.now(); acc = 0; resumeAudio(); raf = requestAnimationFrame(frame); }
  });
  sm.go(Menu, {});
  prev = performance.now();
  raf = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
