// FURIA - moto de montaña con niveles y meta, en 2.5D.
//
// Se juega de costado, como siempre, pero se ve en 3D: la fisica sigue siendo
// la de moto-world.js (un plano, en px, medida con tools/prueba-furia.mjs) y
// moto-3d.js pone ese plano en un mundo con volumen, luz y sombras. Ver el
// porque de cada pieza en docs/FURIA-CANON.md.
//
// APAISADO desde el 25-09-2026. De pie solo se veian 367 px por delante de la
// moto: a partir del nivel 6 la roca entraba en pantalla cuando ya no daba
// tiempo a saltar (medido).
//
// Mandos (moto-botones.js): SALTO y TRUCO al pulgar izquierdo, GAS y FRENO al
// derecho. En el aire, GAS baja el morro y FRENO lo sube (asi se dan vueltas y
// se acomoda el aterrizaje), y TRUCO hace trucos (moto-trucos.js).

import { VW, VH, clamp, supersample } from '../core.js';
import { text as textoFuente, measure } from '../font.js';
import { SFX, Motor } from '../audio.js';
import { vibrate } from '../input.js';
import * as W from './moto-world.js';
import * as A from './moto-art.js';
import * as TR from './moto-trucos.js';
import * as BT from './moto-botones.js';

// El 3D (three.js, ~580 KB, y los modelos, ~170) se carga al entrar al juego
// y no al abrir la app: asi el menu arranca igual de rapido que antes.
let M3 = null, carga = null, sin3D = false;
function carga3D() {
  if (!carga) {
    carga = import('./moto-3d.js')
      .then(m => { M3 = m; })
      .catch(e => { sin3D = true; console.warn('FURIA sin 3D:', e); });
  }
  return carga;
}

// Texto con el sobremuestreo: font.js lo divide entre ss (SURVIVAL cuenta con
// ello), asi que se le pide ya multiplicado, como hace salon.js. Con sombra:
// el HUD va encima de un cielo que a veces es casi blanco.
const text = (g, s, x, y, c, e = 1) => {
  const sm = Math.max(1, Math.round(e * 0.5));
  textoFuente(g, s, x + sm, y + sm, 'rgba(0,0,0,0.45)', e * supersample());
  textoFuente(g, s, x, y, c, e * supersample());
};
const textC = (g, s, cx, y, c, e = 1) => text(g, s, Math.round(cx - measure(String(s), e) / 2), y, c, e);

const PALS = [A.SKY.dusk, A.SKY.night, A.SKY.dawn];
const GANA_T = 3.6;                       // s de la tarjeta de nivel completado

export default {
  meta: {
    id: 'furia', title: 'FURIA', tag: 'MOTO Y SALTOS',
    colors: ['#ff5c7a', '#f0b45a'],
    // Apaisado, suave y con sobremuestreo x2: el lienzo real es el de la
    // pantalla del Redmi (2400x1080) y el HUD sale nitido. El 3D se pinta a
    // una fraccion y se estira (ver moto-3d.js, calidad).
    vw: 1200, vh: 540, wide: true, smooth: true, ss: 2,
  },

  init(ctx) {
    this.ctx = ctx;
    this.rnd = ctx.rnd;
    // Los dedos: id -> boton. Viven por encima del nivel (ver startLevel).
    this.dedos = new Map();
    this.level = 0;
    this.score = 0;
    this.total = 0;
    this.fundido = 1;
    this.popups = [];
    this.pistas = { aire: false, truco: false };
    A.resetGradients();
    this.cargando = !M3 && !sin3D;
    this.listo3D = false;
    this.tVis = 0;
    this.startLevel();
    // Si ella sale del juego antes de que acabe la carga, la promesa llega a
    // una partida que ya no existe: la marca lo detecta y no monta nada.
    const marca = this.marca = {};
    if (this.cargando) {
      carga3D().then(() => {
        if (this.marca !== marca) return;
        this.cargando = false;
        if (M3) this.prepara3D();
      });
    } else if (M3) this.prepara3D();
  },

  prepara3D() {
    try {
      M3.inicia(VW * supersample(), VH * supersample());
      M3.nivel(this.T, this.obs, this.estrellas, this.level);
      this.listo3D = true;
    } catch (e) {
      // Sin WebGL (o sin memoria para el contexto) se juega con el dibujo 2D
      // de siempre: el juego es el mismo, solo plano.
      console.warn('FURIA sin 3D:', e);
      sin3D = true; M3 = null;
    }
  },

  startLevel() {
    this.level++;
    const lv = W.makeLevel(this.rnd, this.level);
    this.T = lv.T; this.obs = lv.obs; this.estrellas = lv.estrellas;
    this.pal = PALS[(this.level - 1) % PALS.length];
    A.resetGradients();

    this.B = W.makeBike(120, W.groundY(this.T, 120) - 40);
    this.prev = { x: this.B.x, y: this.B.y, ang: 0 };
    this.saltosVistos = 0;
    this.camX = 0; this.camY = 0;
    this.dirt = [];
    for (let i = 0; i < 90; i++) this.dirt.push({ x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, max: 1, c: '#8a6a44' });
    this.dirtI = 0;

    this.dead = false; this.won = false;
    this.deadT = 0; this.wonT = 0;
    this.t = 0;
    this.msg = ''; this.msgT = 0; this.msgCol = '#ffe8a8';
    this.airMax = 0; this.lastFlips = 0;
    this.tierraT = 0;
    this.nombreT = 2.4;                 // el cartel de NIVEL al empezar
    this.trucos = TR.creaTrucos();
    this.nTrucos = 0; this.cogidas = 0;
    this.pulso = { salto: 0, truco: 0 };
    this.celebra = 0;
    this.resumen = null;
    // Los dedos NO se resetean: si ella tiene el pulgar en el GAS al cruzar la
    // meta, ese dedo sigue ahi en el nivel siguiente y no llegara otro 'down'
    // que lo reactive. Borrarlos dejaba la moto parada en la salida.
    if (M3 && this.listo3D) M3.nivel(this.T, this.obs, this.estrellas, this.level);
  },

  destroy() { this.marca = null; Motor.calla(); A.resetGradients(); if (M3) M3.sal(); },
  onResize() { A.resetGradients(); },

  flash(m, dur = 1.4, col = '#ffe8a8') { this.msg = m; this.msgT = dur; this.msgCol = col; },

  // Texto que sale de la moto y sube: se ve de donde vienen los puntos. Los
  // de los trucos la SIGUEN (sigue): en pleno vuelo, uno quieto en el sitio
  // del despegue se quedaba atras, en la esquina de la pantalla.
  popup(txt, color, esc = 3, sigue = false) {
    this.popups.push({ txt, color, esc, sigue, dy: -60 - this.popups.length * 14, x: this.B.x, y: this.B.y - 60 - this.popups.length * 14, t: 0 });
    if (this.popups.length > 6) this.popups.shift();
  },

  boton(id) { for (const b of this.dedos.values()) if (b === id) return true; return false; },

  update(dt, ctx) {
    if (this.cargando) return;
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.nombreT > 0) this.nombreT -= dt;
    this.pulso.salto = Math.max(0, this.pulso.salto - dt);
    this.pulso.truco = Math.max(0, this.pulso.truco - dt);
    this.fundido = Math.max(0, this.fundido - dt * 2.5);
    for (const p of this.popups) { p.t += dt; if (p.sigue) { p.x = this.B.x; p.y = this.B.y + p.dy; } }
    this.popups = this.popups.filter(p => p.t < 1.2);
    const B = this.B;
    this.prev.x = B.x; this.prev.y = B.y; this.prev.ang = B.ang;

    if (this.dead) {
      this.deadT += dt;
      Motor.calla();
      // La moto sigue cayendo tras el golpe: cortar el movimiento de golpe se
      // lee como un cuelgue, no como un choque. Y cae DENTRO del pozo.
      B.vy += W.GRAV * dt;
      B.x += B.vx * dt;
      B.vx *= 1 - 2.2 * dt;
      B.y += B.vy * dt;
      B.ang += B.av * dt;
      const gy = W.sueloVisible(this.T, this.obs, B.x);
      if (B.y > gy - 8) { B.y = gy - 8; B.vy = B.vy > 300 ? -B.vy * 0.3 : 0; B.av *= 0.7; B.vx *= 0.6; }
      this.followCam(dt);
      if (this.deadT > 2.0) ctx.gameOver(this.total + this.score);
      return;
    }

    if (this.won) {
      this.wonT += dt;
      // Rueda sola hasta frenar, y ella celebra con el brazo en alto.
      W.stepBike(B, this.T, dt, 0, 0);
      B.vx *= 1 - 1.5 * dt;
      Motor.pon(B.vx / 520 * 0.5, 0);
      this.celebra = Math.min(1, this.wonT * 2);
      this.followCam(dt);
      if (this.wonT > GANA_T - 0.4) this.fundido = Math.min(1, (this.wonT - (GANA_T - 0.4)) * 3.3);
      if (this.wonT > GANA_T) {
        this.total += this.score;
        this.score = 0;
        if (this.level >= 8) { Motor.calla(); ctx.gameOver(this.total); return; }
        this.startLevel();
        this.fundido = 1;
      }
      return;
    }

    // --- Mandos ---
    const gas = this.boton('gas'), freno = this.boton('freno');
    const throttle = gas ? 1 : 0;
    B.brake = freno ? 1 : 0;
    // En el aire, un boton que ya venia apretado desde el suelo no gira la
    // moto (moto-world.js, giro): ella va siempre con el pulgar en el GAS.
    const lean = W.giro(B, gas, freno, this.mando || (this.mando = {}));
    this.lean = lean;

    const wasAir = !B.onGround;
    W.stepBike(B, this.T, dt, throttle, lean);
    Motor.pon(Math.min(1.35, B.vx / 520) * (B.onGround ? 1 : 0.85) + (B.onGround ? 0 : throttle * 0.25), throttle);

    // El salto lo decide la fisica (pideSalto guarda el toque); aqui solo se
    // entera de que salio, para el sonido y la tierra.
    if (B.saltos !== this.saltosVistos) {
      this.saltosVistos = B.saltos;
      SFX.jump();
      if (M3) { M3.tierra(B.x - 30, W.groundY(this.T, B.x - 30), 8, this.colTierra(), 1); M3.humo(B.x - 20, W.groundY(this.T, B.x), 3, 0.8); }
      else this.burstDirt(6, '#8a6a44');
    }

    // Trucos: el reloj de cada uno.
    const hecho = TR.avanza(this.trucos, dt);
    if (hecho) { SFX.truco(); this.popup(hecho.nombre, '#ffd76a', 3, true); }

    // Pista del primer nivel, una vez: lo que no se adivina.
    if (this.level === 1 && !B.onGround && B.air > 0.25 && !this.pistas.aire) {
      this.pistas.aire = true;
      this.flash('TOCA GAS O FRENO PARA GIRAR', 2.4, '#bfe6ff');
    }

    // Altura de vuelo, para puntuar y para el aviso de aterrizaje
    if (!B.onGround) {
      const alt = W.groundY(this.T, B.x) - B.y;
      if (alt > this.airMax) this.airMax = alt;
    } else if (wasAir) {
      this.aterriza();
    }

    // Tierra de la rueda trasera al acelerar en el suelo (barro en el barro)
    this.tierraT -= dt;
    if (B.onGround && throttle > 0 && B.vx > 40 && this.tierraT <= 0) {
      this.tierraT = B.enBarro ? 0.03 : 0.05;
      const rx = B.x - Math.cos(B.ang) * W.WHEELBASE * 0.5;
      if (M3) M3.tierra(rx, W.groundY(this.T, rx), B.enBarro ? 3 : 1, B.enBarro ? this.mundo().bioma.colBarro : this.colTierra(), (0.6 + B.vx / 700) * (B.enBarro ? 1.3 : 1));
      else this.burstDirt(1, '#8a6a44');
    }

    // Estrellas
    const n = W.recogeEstrellas(B, this.estrellas);
    if (n) {
      this.cogidas += n;
      this.score += 50 * n;
      SFX.estrella();
      if (M3) for (const e of this.estrellas) if (e.got && !e.avisada) { e.avisada = true; M3.cogeEstrella(e); }
    }

    // --- Obstaculos (la regla vive en moto-world.js, la misma del arnes) ---
    const ev = W.choques(B, this.T, this.obs);
    if (ev) this.suceso(ev);

    // --- Vuelco ---
    if (!this.dead && W.wipeoutUpdate(B, this.T, dt)) this.crash('VOLCASTE');

    // --- Caida fuera del mundo ---
    if (!this.dead && B.y > W.groundY(this.T, B.x) + 400) this.crash('AL VACIO');

    // --- Meta ---
    if (!this.dead && B.x >= this.T.len - 200 && !this.won) this.gana();

    this.followCam(dt);
    this.updateDirt(dt);
  },

  // Al tocar suelo tras un vuelo: puntos por altura, vueltas, trucos y, si
  // cae paralela a la cuesta, PERFECTO (y un empujon).
  aterriza() {
    const B = this.B;
    let pts = 0;
    const partes = [];
    if (this.airMax > 60) {
      pts += Math.floor(this.airMax * 0.4);
      SFX.blip();
      const fuerza = Math.min(1.6, this.airMax / 90);
      if (M3) {
        M3.humo(B.x, W.groundY(this.T, B.x), 4, fuerza);
        M3.tierra(B.x, W.groundY(this.T, B.x), 10, this.colTierra(), fuerza, 0.5);
        M3.sacude(Math.min(7, this.airMax * 0.035), 0.22);
      } else this.burstDirt(10, '#8a6a44');
    }
    if (B.flips > this.lastFlips) {
      const n = B.flips - this.lastFlips;
      this.lastFlips = B.flips;
      pts += 500 * n;
      partes.push(n > 1 ? n + ' VUELTAS' : 'VUELTA');
      SFX.powerup();
      vibrate([0, 40, 30, 60]);
    }
    const tr = TR.aterriza(this.trucos);
    if (tr.puntos) {
      pts += tr.puntos;
      this.nTrucos += tr.nombres.length;
      partes.push(tr.nombres.length > 1 ? 'COMBO X' + tr.nombres.length : tr.nombres[0]);
    }
    if (tr.tarde) this.popup('TARDE!', '#ff9a9a', 2);
    // Perfecto: tras un vuelo de verdad, paralela a la cuesta.
    let d = B.ang - W.groundAngle(this.T, B.x);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (this.airMax > 70 && Math.abs(d) < 0.14) {
      pts += 100;
      B.vx = Math.min(B.vx + 50, 560);
      partes.push('PERFECTO');
      SFX.perfecto();
    }
    if (pts) {
      this.score += pts;
      this.popup('+' + pts, partes.length ? '#ffd76a' : '#ffe8a8');
      if (partes.length) this.flash(partes.join(' + ') + '!', 1.3, '#ffd76a');
    }
    this.airMax = 0;
  },

  suceso(ev) {
    const B = this.B;
    if (ev.k === 'pozo') this.crash('AL POZO', ev.ob);
    else if (ev.k === 'choca') this.crash('CHOCASTE');
    else if (ev.k === 'rampa') {
      SFX.jump();
      if (M3) M3.tierra(B.x, W.groundY(this.T, B.x), 8, '#c8955a', 1);
      else this.burstDirt(8, '#f0b45a');
      if (ev.ob.kind === W.OB_RAMPA_G) {
        this.flash('SALTO GIGANTE!', 1.2, '#ff9fb8');
        if (M3) M3.sacude(4, 0.2);
      }
      if (!this.pistas.truco) { this.pistas.truco = true; this.popup('TOCA TRUCO!', '#ffd76a', 2); }
    } else if (ev.k === 'rompe') {
      this.score += 120;
      this.popup('+120', '#ffd08a');
      SFX.hit();
      if (M3) { M3.rompe(ev.ob); M3.sacude(5, 0.2); } else this.burstDirt(12, '#6b4423');
      this.flash('ROMPISTE!');
    } else if (ev.k === 'turbo') {
      SFX.turbo();
      this.flash('TURBO!', 1, '#5ff0ff');
      vibrate(40);
    } else if (ev.k === 'barro') {
      SFX.barro();
      const bio = this.mundo().bioma;
      this.popup(bio.barro + '!', '#e8d0b0', 2);
      if (M3) M3.tierra(B.x, W.groundY(this.T, B.x), 12, bio.colBarro, 1.2, 0.3);
    }
  },

  gana() {
    const B = this.B;
    this.won = true; this.wonT = 0;
    const tiempo = Math.max(0, 900 - Math.floor(this.t * 8));
    const todas = this.cogidas === this.estrellas.length && this.estrellas.length > 0;
    this.score += 800 + tiempo + (todas ? 500 : 0);
    this.resumen = {
      nivel: this.level, t: this.t, cogidas: this.cogidas, estrellas: this.estrellas.length,
      trucos: this.nTrucos, puntos: this.score, todas,
    };
    SFX.record();
    setTimeout(() => SFX.confeti(), 250);
    if (M3) M3.confeti(B.x + 120, B.y - 80);
    vibrate([0, 60, 40, 100]);
  },

  mundo() { return M3 ? M3.mundo(this.level) : { bioma: { barro: 'BARRO', colBarro: '#5a3a22', tierra: '#b5895a', tierra2: '#96693f' }, nombre: '' }; },
  colTierra() { return this.mundo().bioma.tierra2; },

  crash(why, pozo) {
    if (this.dead) return;
    const B = this.B;
    this.dead = true; this.deadT = 0;
    Motor.calla();
    if (pozo) {
      // Al pozo se cae DENTRO: sin el rebote del choque y casi sin inercia.
      B.vx = Math.min(B.vx, 60);
      B.vy = 120;
      B.av = (this.rnd() - 0.5) * 3;
      if (M3) M3.choque(40, 50);
    } else {
      if (M3) M3.choque(B.vx, B.vy);
      B.av = (this.rnd() - 0.5) * 9;
      B.vy = -260;
    }
    SFX.explode(); SFX.hurt();
    if (M3) { M3.sacude(12, 0.5); M3.tierra(B.x, B.y + 20, 20, this.colTierra(), 1.4, -0.3); M3.humo(B.x, B.y + 10, 5, 1.4); }
    vibrate([0, 90, 50, 140]);
    this.flash(why, 2, '#ffb0b0');
    if (!M3) this.burstDirt(22, '#a8683c');
  },

  // ---------- Respaldo 2D (sin WebGL) ----------
  burstDirt(n, color) {
    const B = this.B;
    const c = Math.cos(B.ang), s = Math.sin(B.ang);
    const rx = B.x - c * W.WHEELBASE * 0.5, ry = B.y - s * W.WHEELBASE * 0.5 + W.WHEEL_R;
    for (let k = 0; k < n; k++) {
      const p = this.dirt[this.dirtI];
      this.dirtI = (this.dirtI + 1) % this.dirt.length;
      p.x = rx; p.y = ry;
      p.vx = -B.vx * 0.25 - this.rnd() * 90;
      p.vy = -60 - this.rnd() * 190;
      p.r = 1.6 + this.rnd() * 3.4;
      p.max = 0.35 + this.rnd() * 0.5;
      p.life = p.max;
      p.c = color;
    }
  },

  updateDirt(dt) {
    if (M3) return;
    for (let i = 0; i < this.dirt.length; i++) {
      const p = this.dirt[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const gy = W.groundY(this.T, p.x);
      if (p.y > gy) { p.y = gy; p.vy *= -0.28; p.vx *= 0.6; }
    }
  },

  // Camara del respaldo 2D. El 3D lleva la suya (moto-3d.js, colocaCamara).
  followCam(dt) {
    const tx = this.B.x - VW * 0.28;
    const ty = this.B.y - VH * 0.6;
    this.camX += (tx - this.camX) * Math.min(1, 8 * dt);
    this.camY += (ty - this.camY) * Math.min(1, 4.5 * dt);
    if (this.camX < 0) this.camX = 0;
  },

  draw(g, ctx, alpha = 1) {
    const w = VW, h = VH;
    // El temblor de main.js movia la imagen entera y dejaba ver los bordes:
    // FURIA sacude la camara 3D por dentro y aqui se pinta sin desplazar.
    g.save();
    const ss = supersample();
    g.setTransform(ss, 0, 0, ss, 0, 0);

    if (this.cargando) {
      g.fillStyle = '#0d0620'; g.fillRect(0, 0, w, h);
      textC(g, 'FURIA', w / 2, h * 0.4, '#ff5c7a', 5);
      const pts = '.'.repeat(1 + ((performance.now() / 300) | 0) % 3);
      textC(g, 'CARGANDO' + pts, w / 2, h * 0.58, '#8a7ab8', 2);
      g.restore();
      return;
    }

    const B = this.B, P = this.prev;
    const ix = P.x + (B.x - P.x) * alpha, iy = P.y + (B.y - P.y) * alpha;
    let da = B.ang - P.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const ia = P.ang + da * alpha;

    // El 3D avanza con el tiempo de JUEGO mas la fraccion de paso (alpha): a
    // 120 Hz sale suave, y en pausa se queda quieto (el tiempo no corre).
    const tv = this.t + alpha / 60;
    const dtv = Math.min(0.05, Math.max(0, tv - this.tVis));
    this.tVis = tv;
    // En pausa (el tiempo no avanza) el motor se calla.
    if (dtv === 0) Motor.calla();
    let lienzo = null;
    if (M3 && this.listo3D) {
      try {
        lienzo = M3.frame({ x: ix, y: iy, ang: ia, B, dt: dtv, muerto: this.dead, lean: this.lean || 0,
                            tiempo: tv, truco: TR.pose(this.trucos), celebra: this.celebra });
      } catch (e) { console.warn('FURIA 3D fallo:', e); sin3D = true; M3 = null; }
    }
    if (lienzo) {
      g.imageSmoothingEnabled = true;
      g.drawImage(lienzo, 0, 0, w, h);
    } else {
      this.draw2D(g, w, h);
    }

    this.drawHud(g, w, h);
    if (this.fundido > 0) {
      g.globalAlpha = this.fundido;
      g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    g.restore();
  },

  draw2D(g, w, h) {
    const pal = this.pal;
    A.drawSky(g, w, h, pal, this.camX, w * 0.74, h * 0.2);
    A.drawHills(g, w, h, this.camX, 0.0, h * 0.50, h * 0.045, pal.top, 1.7);
    A.drawHills(g, w, h, this.camX, 0.35, h * 0.57, h * 0.038, pal.mid, 4.1);
    A.drawHills(g, w, h, this.camX, 0.7, h * 0.63, h * 0.030, pal.ground2, 8.3);
    A.drawTerrain(g, this.T, W.groundY, w, h, this.camX, this.camY, pal);
    for (const ob of this.obs) {
      const sx = ob.x - this.camX;
      if (sx < -120 || sx > w + 120) continue;
      if (ob.hit && (ob.kind === W.OB_LOG || ob.kind === W.OB_CAJA)) continue;
      const gy = W.groundY(this.T, ob.x) - this.camY;
      if (ob.kind === W.OB_PIT) {
        g.fillStyle = '#050308';
        g.fillRect(sx - ob.w / 2, gy - 1, ob.w, h - gy + 1);
      } else if (ob.kind === W.OB_ROCK || ob.kind === W.OB_LOG) {
        A.drawObstacle(g, ob, sx, gy, { ROCK: W.OB_ROCK, RAMP: -1, LOG: W.OB_LOG, PIT: W.OB_PIT });
      } else if (ob.kind === W.OB_CAJA) {
        g.fillStyle = '#c08a4e'; g.fillRect(sx - ob.w / 2, gy - ob.h, ob.w, ob.h);
      } else if (ob.kind === W.OB_TURBO) {
        g.fillStyle = '#5ff0ff'; g.fillRect(sx - ob.w / 2, gy - 3, ob.w, 3);
      }
    }
    for (const e of this.estrellas) if (!e.got) { g.fillStyle = '#ffd23a'; g.fillRect(e.x - this.camX - 5, e.y - this.camY - 5, 10, 10); }
    A.drawDirt(g, this.dirt, this.camX, this.camY);
    A.drawBike(g, this.B, this.B.x - this.camX, this.B.y - this.camY, W.WHEELBASE, W.WHEEL_R, 16);
  },

  drawHud(g, w, h) {
    const pad = 24;
    // Nivel y, debajo, la pista: cuanto falta sin numeros.
    text(g, 'NIVEL ' + this.level, pad, 16, '#ffffff', 3);
    const bx = pad, by = 44, bw = 330, bh = 8;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    const prog = clamp(this.B.x / (this.T.len - 200), 0, 1);
    g.fillStyle = '#ffd98a';
    g.fillRect(bx, by, bw * prog, bh);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
      g.fillRect(bx + bw + 6 + i * 5, by - 3 + j * 5, 5, 5);
    }
    // Puntos arriba a la derecha y, debajo, las estrellas.
    const s = String(this.total + this.score);
    text(g, s, w - pad - measure(s, 4), 16, '#ffffff', 4);
    const es = this.cogidas + '/' + this.estrellas.length;
    const ex = w - pad - measure(es, 2);
    text(g, es, ex, 52, '#ffd76a', 2);
    estrella(g, ex - 14, 58, 9);

    // Textos que suben desde la moto.
    for (const p of this.popups) {
      let sx, sy;
      if (M3) { const f = M3.aPantalla(p.x, p.y); sx = f[0] * w; sy = f[1] * h; } else { sx = p.x - this.camX; sy = p.y - this.camY; }
      g.globalAlpha = Math.min(1, (1.2 - p.t) * 3);
      textC(g, p.txt, sx, sy - p.t * 60, p.color, p.esc);
    }
    g.globalAlpha = 1;

    // La tarjeta al ganar; si no, los avisos, y si no hay ninguno, el cartel
    // del nivel al empezar (al reves, un choque en los dos primeros segundos
    // no decia por que).
    if (this.resumen && this.wonT > 0.6) this.drawResumen(g, w, h);
    else if (this.msgT > 0) {
      g.globalAlpha = Math.min(1, this.msgT * 3);
      textC(g, this.msg, w / 2, h * 0.22, this.msgCol, this.msg.length > 16 ? 4 : 6);
      g.globalAlpha = 1;
    } else if (this.nombreT > 0 && !this.won) {
      const a = Math.min(1, this.nombreT * 2, (2.4 - this.nombreT) * 4);
      g.globalAlpha = a;
      textC(g, 'NIVEL ' + this.level, w / 2, h * 0.2, '#ffffff', 6);
      if (M3) textC(g, M3.mundo(this.level).nombre, w / 2, h * 0.2 + 56, '#ffe0a8', 3);
      g.globalAlpha = 1;
    }

    // Los cuatro mandos. TRUCO brilla cuando se puede (en el aire) y SALTO
    // cuando hay un salto guardado esperando al suelo.
    const B = this.B;
    const est = {
      gas: this.boton('gas') ? 1 : 0,
      freno: this.boton('freno') ? 1 : 0,
      salto: this.pulso.salto > 0 ? 1 : (B.jumpBuf > 0 ? 2 : 0),
      truco: this.pulso.truco > 0 ? 1 : (!B.onGround && !this.dead && B.air > 0.08 ? 2 : 0),
    };
    const guia = this.level === 1 && this.t < 5 ? Math.min(1, (5 - this.t) / 1.5) : 0;
    BT.pinta(g, est, supersample(), this.won || this.dead ? 0.4 : 0.85 + guia * 0.15);
  },

  // La tarjeta de nivel completado, en la mitad derecha: en el centro tapaba
  // a la piloto justo cuando celebra.
  drawResumen(g, w, h) {
    const r = this.resumen;
    const a = Math.min(1, (this.wonT - 0.6) * 4) * (this.fundido > 0 ? 1 - this.fundido : 1);
    g.globalAlpha = a * 0.78;
    g.fillStyle = '#140a24';
    const cw = 500, ch = 250, cx = w - cw - 60, cy = 80;
    g.fillRect(cx, cy, cw, ch);
    g.globalAlpha = a;
    g.strokeStyle = '#ff2e63'; g.lineWidth = 4; g.strokeRect(cx, cy, cw, ch);
    textC(g, 'NIVEL ' + r.nivel + ' COMPLETADO!', cx + cw / 2, cy + 22, '#ffffff', 4);
    const fila = (et, val, y, col) => { text(g, et, cx + 50, y, '#bba8e8', 3); text(g, val, cx + cw - 50 - measure(val, 3), y, col, 3); };
    const mm = Math.floor(r.t / 60), ss = String(Math.floor(r.t % 60)).padStart(2, '0');
    fila('ESTRELLAS', r.cogidas + '/' + r.estrellas + (r.todas ? ' TODAS!' : ''), cy + 80, '#ffd76a');
    fila('TRUCOS', String(r.trucos), cy + 118, '#ffffff');
    fila('TIEMPO', mm + ':' + ss, cy + 156, '#ffffff');
    fila('PUNTOS', '+' + r.puntos, cy + 194, '#7dff8a');
    g.globalAlpha = 1;
  },

  onInput(ev) {
    if (this.dead || this.won || this.cargando) return;
    if (ev.type === 'down') {
      const b = BT.aQuien(ev.x, ev.y, VW);
      if (!b) return;
      this.dedos.set(ev.id, b);
      if (b === 'salto' || b === 'truco') {
        this.pulso[b] = 0.15;
        // TRUCO en el aire hace un truco; en el suelo, o SALTO, salta (la
        // fisica guarda el toque un momento: moto-world.js, pideSalto).
        if (b === 'truco' && !this.B.onGround && this.B.air > 0.05) {
          if (TR.pide(this.trucos, true)) SFX.blip();
        } else W.pideSalto(this.B);
      }
    } else if (ev.type === 'up' || ev.type === 'cancel') {
      this.dedos.delete(ev.id);
    } else if (ev.type === 'move') {
      // Deslizar el pulgar derecho entre GAS y FRENO cambia sin levantarlo;
      // el izquierdo no dispara nada al deslizar (sus botones son toques).
      const antes = this.dedos.get(ev.id);
      if (antes === 'gas' || antes === 'freno') {
        const b = BT.aQuien(ev.x, Math.max(ev.y, BT.FRANJA_ARRIBA), VW);
        if (b === 'gas' || b === 'freno') this.dedos.set(ev.id, b);
      }
    }
  },
};

// Una estrella de cinco puntas (para el contador).
function estrella(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = '#ffd23a'; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = '#7a4a00'; g.stroke();
}
