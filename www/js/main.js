// ROMINA'S ARCADE — arranque, bucle de tiempo fijo, gestor de escenas y menu.
import { VW, VH, BASE_VW, BASE_VH, MENU_VW, MENU_VH, setVirtual, setSmooth, setSupersample, baseTransform, requestOrientation, isLandscape, initCanvas, view, makeRng, Save, cam } from './core.js';
import { initInput } from './input.js';
import { initAudio, unlockAudio, SFX, toggleMute, suspendAudio, resumeAudio, playMusic, stopMusic, SONGS, currentSong } from './audio.js';
import { text, textCenter, measure } from './font.js';
import { particles, updateParticles, drawParticles } from './gfx.js';
import { GAMES } from './games.js';
import { Menu } from './menu.js';

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
    // El filtrado se elige ANTES de setVirtual: asignar canvas.width resetea el
    // contexto, y setVirtual reaplica el modo que se haya dejado puesto aqui.
    setSmooth(!!m.smooth);
    // Cuantas veces mas grande es el lienzo real que el virtual. Va con el
    // filtrado, y por el mismo motivo: setVirtual reaplica lo que se deje puesto
    // aqui. Solo lo piden los juegos de arte suave; el pixel art no lo necesita
    // (su dibujo YA es de rejilla) y le costaria el cuadruple de relleno.
    setSupersample(m.smooth ? (m.ss || 1) : 1);
    // meta.wide = escena apaisada (el menu y el fin de partida). Sin el, es un
    // juego y va vertical. Se le pide el giro al telefono ANTES de fijar la
    // resolucion, para que el navegador ya este girando cuando el juego mida.
    const wide = !!m.wide;
    requestOrientation(wide);
    setVirtual(m.vw || (wide ? MENU_VW : BASE_VW), m.vh || (wide ? MENU_VH : BASE_VH));
    if (this.cur.init) this.cur.init(ctx, this.nextArgs);
    // Los juegos que sabian recolocarse al girar lo siguen haciendo una vez, al
    // entrar: ahora su lienzo ya no cambia de forma en toda la partida.
    if (this.cur.onResize) this.cur.onResize();
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
// Vive en menu.js (la estanteria de caratulas). Aqui solo se le dice a donde
// ir cuando el usuario elige un juego: el menu no conoce el gestor de escenas.
Menu.onLaunch = G => sm.go(G, { seed: (Math.random() * 0xffffffff) >>> 0 });

// ---------- Escena: GAME OVER ----------
const GameOver = {
  // Apaisada como el menu: el puntaje es lo unico que importa aqui y en
  // horizontal cabe mucho mas grande.
  meta: { id: '_over', title: 'FIN', wide: true, vw: 600, vh: 270 },
  init(c, a) {
    this.score = a.score; this.isRecord = a.isRecord; this.gameId = a.id; this.title = a.title;
    this.t = 0; this.canTap = false;
    if (a.isRecord) SFX.record(); else SFX.gameover();
    this.msg = a.isRecord ? RECORD_MSGS[(Math.random() * RECORD_MSGS.length) | 0] : null;
  },
  update(dt) { this.t += dt; if (this.t > 0.55) this.canTap = true; },
  draw(g) {
    g.fillStyle = '#0d0620'; g.fillRect(0, 0, VW, VH);
    const cx = VW / 2;
    textCenter(g, this.title, cx, 26, '#5a4a88', 2);
    if (this.isRecord) {
      const f = Math.sin(this.t * 8) > 0 ? '#ffe14d' : '#ff5c9d';
      textCenter(g, 'RECORD NUEVO!', cx, 50, f, 3);
    } else {
      textCenter(g, 'FIN DEL JUEGO', cx, 50, '#ff5c9d', 3);
    }
    // El puntaje, enorme: es lo que ella mira.
    textCenter(g, String(this.score), cx, 84, '#ffffff', 7);
    textCenter(g, 'MEJOR ' + Save.best(this.gameId), cx, 150, '#8a7ab8', 2);
    if (this.msg) {
      // Mensaje carinoso, solo al romper record.
      textCenter(g, this.msg[0], cx, 178, '#5cffd8', 2);
      if (this.msg[1]) textCenter(g, this.msg[1], cx, 196, '#5cffd8', 2);
    }
    if (this.canTap && Math.sin(this.t * 4) > -0.3) {
      textCenter(g, 'TOCA PARA JUGAR', cx, VH - 44, '#ffffff', 2);
      textCenter(g, 'MANTEN PARA MENU', cx, VH - 24, '#5a4a88', 2);
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
let acc = 0, prev = 0, raf = 0, frameNo = 0;

function frame(now) {
  raf = requestAnimationFrame(frame);      // primero: el bucle sobrevive a una excepcion
  frameNo++;
  let dt = now - prev; prev = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;      // absorbe pausas (background, GC, MIUI)
  acc += dt;
  let n = 0;
  const s = STEP / 1000;
  // Con el telefono en la orientacion equivocada el JUEGO se pausa: si siguiera
  // corriendo, ella perderia la partida mientras gira el aparato.
  //
  // Las pantallas de interfaz (menu y fin de partida) NO se pausan nunca. Si se
  // pausaran y el bloqueo de orientacion fallara -- MIUI lo rechaza a veces, y
  // basta con que ella tenga el giro bloqueado en ajustes -- el fin de partida
  // se quedaria congelado para siempre: su 'toca para jugar' se activa desde
  // update(), asi que ni jugar ni volver al menu funcionarian. La app quedaria
  // muerta sin forma de salir.
  const girando = orientationMismatch();
  const pausa = girando && !(sm.cur && sm.cur.meta.wide);
  while (acc >= STEP && n < MAX_STEPS) {
    sm.flush();
    if (!pausa) {
      if (sm.cur && sm.cur.update) sm.cur.update(s, ctx);
      updateParticles(s);
      cam.update(s, rnd);
    }
    acc -= STEP; n++;
  }
  if (n === MAX_STEPS && acc > STEP) acc = 0;   // corta la espiral de la muerte

  // El transform base se reaplica cada frame: lleva el sobremuestreo, y la
  // camara hace translate() ENCIMA de el. Sin esto, el temblor se acumularia.
  baseTransform();
  g.save();
  if (cam.x || cam.y) g.translate(cam.x, cam.y);
  if (sm.cur && sm.cur.draw) sm.cur.draw(g, ctx);
  drawParticles(g);
  g.restore();

  drawRotateHint(g);
}

// ---------- Aviso de girar el telefono ----------
// La app pide el giro por software, pero screen.orientation.lock() puede
// rechazarse (MIUI fuera de pantalla completa, o el giro bloqueado en ajustes).
// Cuando eso pasa, la escena se ve de lado y sin este aviso no hay ninguna
// pista de que hacer. Aparece solo si la orientacion real no coincide con la
// que la escena necesita, y tras medio segundo: un giro real tarda un momento
// y sin la espera parpadearia en cada cambio de escena.
let mismatchT = 0;

// True cuando la orientacion real no es la que la escena necesita, y ya lleva
// asi el medio segundo de gracia. La cuenta se lleva aqui, no en el dibujo,
// para que la pausa y el aviso entren y salgan exactamente a la vez.
//
// Se evalua UNA vez por frame y se cachea: la llaman el bucle (para pausar) y
// el dibujo (para el aviso), y si cada llamada sumara al contador, el medio
// segundo se cumpliria al doble de velocidad.
let mmFrame = -1, mmVal = false, mmPrev = 0;

function orientationMismatch() {
  if (mmFrame === frameNo) return mmVal;
  mmFrame = frameNo;
  const m = sm.cur && sm.cur.meta;
  if (!m) { mmVal = false; return false; }
  if (!!m.wide === isLandscape()) {
    mismatchT = 0; mmPrev = 0; mmVal = false; return false;
  }
  // Se cuenta en segundos REALES, no en pasos de 1/60: el Note 10 puede ir a
  // 90 Hz, y sumando un sesentavo por frame el medio segundo de gracia se
  // cumpliria en un tercio de segundo, que es justo el parpadeo que la espera
  // existe para evitar.
  const ahora = performance.now();
  mismatchT += Math.min(0.25, (ahora - (mmPrev || ahora)) / 1000);
  mmPrev = ahora;
  mmVal = mismatchT >= 0.5;
  return mmVal;
}

function drawRotateHint(gg) {
  if (!orientationMismatch()) return;
  const quiere = !!sm.cur.meta.wide;              // true = apaisada
  gg.save();

  // El canvas esta girado respecto al telefono, asi que el aviso se dibuja
  // sobre el lienzo tal cual: es lo unico que se ve derecho al girarlo.
  gg.fillStyle = 'rgba(6,3,16,0.86)';
  gg.fillRect(0, 0, VW, VH);
  const cx = VW / 2, cy = VH / 2;
  textCenter(gg, 'GIRA EL', cx, cy - 34, '#ffffff', 3);
  textCenter(gg, 'TELEFONO', cx, cy - 6, '#ffffff', 3);
  textCenter(gg, quiere ? 'DE LADO' : 'DE PIE', cx, cy + 28, '#5cffd8', 2);
  // Flecha curva insinuando el giro.
  const t = performance.now() / 1000;
  const k = 0.5 + Math.sin(t * 3) * 0.5;
  gg.strokeStyle = 'rgba(255,92,157,' + (0.35 + k * 0.5).toFixed(2) + ')';
  gg.lineWidth = 2;
  gg.beginPath();
  gg.arc(cx, cy + 62, 18, Math.PI * 0.85, Math.PI * 2.05);
  gg.stroke();
  gg.restore();
}

// ---------- Arranque ----------
function boot() {
  const el = document.getElementById('c');
  g = initCanvas(el);
  initAudio();
  initInput(el, ev => {
    if (ev.type === 'down') unlockAudio();   // desbloqueo de audio en el primer toque
    // Con el aviso de girar puesto sobre un juego pausado se descartan los
    // toques nuevos: si se dejaran pasar, la escena acumularia pulsaciones que
    // update() no consume y se aplicarian todas de golpe al reanudar.
    //
    // Pero el 'up' SIEMPRE pasa. Un dedo apoyado en el boton de disparo cuando
    // entra la pausa tiene que poder soltarse; si se le come el 'up', el juego
    // se queda creyendo que sigue pulsado y el boton no vuelve a responder.
    if (ev.type !== 'up' && orientationMismatch()
        && !(sm.cur && sm.cur.meta.wide)) return;
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

// Gancho para las herramientas de tools/: permite llevar la app a una escena
// concreta sin jugar hasta ella. No lo usa nada del juego.
// `cancion` devuelve el NOMBRE del tema que suena: es la unica forma de
// comprobar desde fuera que SURVIVAL cambia de musica al entrar el jefe.
window.__arcade = {
  sm, ctx, Menu, GameOver, GAMES, view,
  get cancion() {
    const s = currentSong();
    return s ? (Object.keys(SONGS).find(k => SONGS[k] === s) || '?') : null;
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
