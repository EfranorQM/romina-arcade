// FURIA - moto de montana con niveles y meta, en 2.5D.
//
// Se juega de costado, como siempre, pero se ve en 3D: la fisica sigue siendo
// la de moto-world.js (un plano, en px, medida con tools/prueba-furia.mjs) y
// moto-3d.js pone ese plano en un mundo con volumen, luz y sombras. Ver el
// porque de cada pieza en docs/FURIA-CANON.md.
//
// APAISADO desde el 25-09-2026. De pie solo se veian 367 px por delante de la
// moto: a partir del nivel 6 la roca entraba en pantalla cuando ya no daba
// tiempo a saltar (medido). Acostado se ven 500-650 y la moto sale mas grande.
//
// Controles: las dos mitades de la pantalla.
//   Derecha  = acelerar. En el aire, rota hacia adelante.
//   Izquierda = SALTAR al tocar y frenar si se mantiene. En el aire rota
//               hacia atras, que es como se acomoda el aterrizaje.
// El toque de salto se guarda un momento (moto-world.js, pideSalto): tocar
// justo antes de aterrizar tambien salta.

import { VW, VH, clamp, supersample } from '../core.js';
import { text as textoFuente, measure } from '../font.js';
import { SFX } from '../audio.js';
import { vibrate } from '../input.js';
import * as W from './moto-world.js';
import * as A from './moto-art.js';

// El 3D (three.js, ~580 KB) se carga al entrar al juego y no al abrir la app:
// asi el menu arranca igual de rapido que antes. Una vez cargado se queda.
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
// ello), asi que se le pide ya multiplicado, como hace salon.js.
// Con sombra: el HUD va encima de un cielo que a veces es casi blanco (el
// halo del sol se comia el puntaje).
const text = (g, s, x, y, c, e = 1) => {
  const sm = Math.max(1, Math.round(e * 0.5));
  textoFuente(g, s, x + sm, y + sm, 'rgba(0,0,0,0.45)', e * supersample());
  textoFuente(g, s, x, y, c, e * supersample());
};
const textC = (g, s, cx, y, c, e = 1) => text(g, s, Math.round(cx - measure(String(s), e) / 2), y, c, e);

const PALS = [A.SKY.dusk, A.SKY.night, A.SKY.dawn];

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
    // Estado de los dedos: vive por encima del nivel, ver startLevel().
    this.leftDown = false; this.rightDown = false;
    this.leftId = -1; this.rightId = -1;
    this.level = 0;
    this.score = 0;
    this.total = 0;
    this.fundido = 1;                   // negro que se abre al empezar
    this.popups = [];
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
      M3.nivel(this.T, this.obs, this.level);
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
    this.T = lv.T; this.obs = lv.obs;
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
    this.msg = ''; this.msgT = 0;
    this.airMax = 0; this.lastFlips = 0;
    this.tierraT = 0;
    this.nombreT = 2.2;                 // el cartel de NIVEL al empezar

    // Controles: dos mitades de la pantalla.
    // OJO: NO se resetean al cambiar de nivel. Si la jugadora tiene el dedo
    // apoyado en el acelerador cuando cruza la meta, ese dedo sigue apoyado en
    // el nivel siguiente y no habra un nuevo evento 'down' que lo reactive:
    // borrarlos aqui dejaba la moto parada en la linea de salida para siempre.
    if (M3 && this.listo3D) M3.nivel(this.T, this.obs, this.level);
  },

  destroy() { this.marca = null; A.resetGradients(); if (M3) M3.sal(); },
  onResize() { A.resetGradients(); },

  flash(m, dur = 1.4) { this.msg = m; this.msgT = dur; },

  // Puntos que salen de la moto y suben: se ve de donde vienen.
  popup(txt, color) {
    this.popups.push({ txt, color, x: this.B.x, y: this.B.y - 60, t: 0 });
    if (this.popups.length > 6) this.popups.shift();
  },

  update(dt, ctx) {
    if (this.cargando) return;
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.nombreT > 0) this.nombreT -= dt;
    this.fundido = Math.max(0, this.fundido - dt * 2.5);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 1.1);
    const B = this.B;
    this.prev.x = B.x; this.prev.y = B.y; this.prev.ang = B.ang;

    if (this.dead) {
      this.deadT += dt;
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
      // Rueda sola hasta frenar
      W.stepBike(B, this.T, dt, 0, 0);
      this.followCam(dt);
      if (this.wonT > 1.7) this.fundido = Math.min(1, (this.wonT - 1.7) * 3.3);
      if (this.wonT > 2.0) {
        this.total += this.score + 800;
        this.score = 0;
        if (this.level >= 8) { ctx.gameOver(this.total); return; }
        this.startLevel();
        this.fundido = 1;
      }
      return;
    }

    // --- Control ---
    // Derecha acelera; izquierda frena. En el aire, inclinan.
    const throttle = this.rightDown ? 1 : 0;
    B.brake = this.leftDown ? 1 : 0;
    let lean = 0;
    if (this.rightDown) lean = 1;        // morro abajo
    if (this.leftDown) lean = -1;        // morro arriba (wheelie / rotar atras)
    if (this.rightDown && this.leftDown) lean = 0;
    this.lean = lean;

    const wasAir = !B.onGround;
    W.stepBike(B, this.T, dt, throttle, lean);

    // El salto lo decide la fisica (pideSalto guarda el toque); aqui solo se
    // entera de que salio, para el sonido y la tierra.
    if (B.saltos !== this.saltosVistos) {
      this.saltosVistos = B.saltos;
      SFX.jump();
      if (M3) { M3.tierra(B.x - 30, W.groundY(this.T, B.x - 30), 8, this.colTierra(), 1); M3.humo(B.x - 20, W.groundY(this.T, B.x), 3, 0.8); }
      else this.burstDirt(6, '#8a6a44');
    }

    // Altura de vuelo, para puntuar y para el aviso de aterrizaje
    if (!B.onGround) {
      const alt = W.groundY(this.T, B.x) - B.y;
      if (alt > this.airMax) this.airMax = alt;
    } else if (wasAir) {
      // Acaba de aterrizar
      if (this.airMax > 60) {
        const pts = Math.floor(this.airMax * 0.4);
        this.score += pts;
        this.popup('+' + pts, '#ffe8a8');
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
        this.score += 500 * n;
        this.flash(n > 1 ? n + ' GIROS!' : 'GIRO!');
        this.popup('+' + 500 * n, '#ff9fb8');
        SFX.powerup();
        vibrate([0, 40, 30, 60]);
      }
      this.airMax = 0;
    }

    // Tierra de la rueda trasera al acelerar en el suelo
    this.tierraT -= dt;
    if (B.onGround && throttle > 0 && B.vx > 40 && this.tierraT <= 0) {
      this.tierraT = 0.05;
      const rx = B.x - Math.cos(B.ang) * W.WHEELBASE * 0.5;
      if (M3) M3.tierra(rx, W.groundY(this.T, rx), 1, this.colTierra(), 0.6 + B.vx / 700);
      else this.burstDirt(1, '#8a6a44');
    }

    // --- Obstaculos (la regla vive en moto-world.js, la misma del arnes) ---
    const ev = W.choques(B, this.T, this.obs);
    if (ev) {
      if (ev.k === 'pozo') this.crash('AL POZO', ev.ob);
      else if (ev.k === 'choca') this.crash('CHOCASTE');
      else if (ev.k === 'rampa') {
        SFX.jump();
        if (M3) M3.tierra(B.x, W.groundY(this.T, B.x), 8, '#c8955a', 1);
        else this.burstDirt(8, '#f0b45a');
      } else if (ev.k === 'rompe') {
        this.score += 120;
        this.popup('+120', '#ffd08a');
        SFX.hit();
        if (M3) { M3.rompeTronco(ev.ob); M3.sacude(5, 0.2); } else this.burstDirt(12, '#6b4423');
        this.flash('ROMPISTE!');
      }
    }

    // --- Vuelco ---
    if (!this.dead && W.wipeoutUpdate(B, this.T, dt)) this.crash('VOLCASTE');

    // --- Caida fuera del mundo ---
    if (!this.dead && B.y > W.groundY(this.T, B.x) + 400) this.crash('AL VACIO');

    // --- Meta ---
    if (!this.dead && B.x >= this.T.len - 200 && !this.won) {
      this.won = true; this.wonT = 0;
      const extra = Math.max(0, 900 - Math.floor(this.t * 8));
      this.score += extra;
      SFX.record(); this.flash('NIVEL ' + this.level + '!', 2);
      vibrate([0, 60, 40, 100]);
    }

    this.followCam(dt);
    this.updateDirt(dt);
  },

  colTierra() { return M3 ? M3.ambiente(this.level).tierra2 : '#8a6a44'; },

  crash(why, pozo) {
    if (this.dead) return;
    const B = this.B;
    this.dead = true; this.deadT = 0;
    if (pozo) {
      // Al pozo se cae DENTRO: sin el rebote del choque y casi sin inercia.
      // Con la de un choque normal la moto saltaba el agujero y quedaba
      // tumbada en el otro borde.
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
    this.flash(why, 2);
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
    let lienzo = null;
    if (M3 && this.listo3D) {
      try {
        lienzo = M3.frame({ x: ix, y: iy, ang: ia, B, dt: dtv,
                            muerto: this.dead, lean: this.lean || 0, tiempo: tv });
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
      if (ob.hit && ob.kind === W.OB_LOG) continue;
      if (ob.kind === W.OB_PIT) {
        // El pozo, al menos, se ve: un hueco negro en el suelo.
        const gy = W.groundY(this.T, ob.x) - this.camY;
        g.fillStyle = '#050308';
        g.fillRect(sx - ob.w / 2, gy - 1, ob.w, h - gy + 1);
        continue;
      }
      A.drawObstacle(g, ob, sx, W.groundY(this.T, ob.x) - this.camY, { ROCK: W.OB_ROCK, RAMP: W.OB_RAMP, LOG: W.OB_LOG, PIT: W.OB_PIT });
    }
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
    // Banderita de meta a cuadros
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
      g.fillRect(bx + bw + 6 + i * 5, by - 3 + j * 5, 5, 5);
    }
    // Puntos arriba a la derecha.
    const s = String(this.total + this.score);
    text(g, s, w - pad - measure(s, 4), 16, '#ffffff', 4);

    // Puntos que suben desde la moto.
    for (const p of this.popups) {
      let sx, sy;
      if (M3) { const f = M3.aPantalla(p.x, p.y); sx = f[0] * w; sy = f[1] * h; } else { sx = p.x - this.camX; sy = p.y - this.camY; }
      g.globalAlpha = Math.min(1, (1.1 - p.t) * 3);
      textC(g, p.txt, sx, sy - p.t * 60, p.color, 3);
    }
    g.globalAlpha = 1;

    // Los avisos, y si no hay ninguno, el cartel del nivel al empezar. Al
    // reves, un choque en los dos primeros segundos no decia por que.
    if (this.msgT > 0) {
      g.globalAlpha = Math.min(1, this.msgT * 3);
      textC(g, this.msg, w / 2, h * 0.24, '#ffe8a8', 6);
      g.globalAlpha = 1;
    } else if (this.nombreT > 0 && !this.won) {
      const a = Math.min(1, this.nombreT * 2, (2.2 - this.nombreT) * 4);
      g.globalAlpha = a;
      textC(g, 'NIVEL ' + this.level, w / 2, h * 0.24, '#ffffff', 6);
      if (M3) textC(g, M3.ambiente(this.level).nombre, w / 2, h * 0.24 + 56, '#ffe0a8', 3);
      g.globalAlpha = 1;
    }

    // Los dos mandos, siempre a la vista pero discretos: dicen DONDE poner
    // los pulgares, que es lo unico que no se adivina. Se encienden al
    // pulsarlos. El primer nivel los ensena grandes unos segundos.
    const guia = this.level === 1 && this.t < 5 ? Math.min(1, (5 - this.t) / 1.5) : 0;
    this.mando(g, 118, h - 104, this.leftDown, 'SALTO', guia, true);
    this.mando(g, w - 118, h - 104, this.rightDown, 'GAS', guia, false);
  },

  mando(g, cx, cy, activo, etiqueta, guia, salto) {
    const r = 54;
    g.globalAlpha = activo ? 0.55 : 0.22 + guia * 0.3;
    g.fillStyle = activo ? '#ffffff' : 'rgba(0,0,0,0.55)';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    // Icono: flecha arriba (salto) o triangulo de avance (gas).
    g.fillStyle = activo ? '#ff2e63' : '#ffffff';
    g.beginPath();
    if (salto) { g.moveTo(cx, cy - 26); g.lineTo(cx + 24, cy + 4); g.lineTo(cx + 9, cy + 4); g.lineTo(cx + 9, cy + 22); g.lineTo(cx - 9, cy + 22); g.lineTo(cx - 9, cy + 4); g.lineTo(cx - 24, cy + 4); }
    else { g.moveTo(cx - 16, cy - 24); g.lineTo(cx + 24, cy); g.lineTo(cx - 16, cy + 24); }
    g.closePath(); g.fill();
    g.globalAlpha = Math.max(activo ? 0.8 : 0.35, guia);
    textC(g, etiqueta, cx, cy + r + 10, '#ffffff', 2);
    g.globalAlpha = 1;
  },

  onInput(ev) {
    if (this.dead || this.won || this.cargando) return;
    const isLeft = ev.x < VW * 0.5;
    if (ev.type === 'down') {
      if (ev.y < 90) return;               // la franja de arriba es del HUD y la pausa
      if (isLeft) {
        this.leftDown = true; this.leftId = ev.id;
        // El toque pide salto; la fisica lo guarda un momento y salta en
        // cuanto hay apoyo (moto-world.js, pideSalto).
        W.pideSalto(this.B);
      }
      else { this.rightDown = true; this.rightId = ev.id; }
    } else if (ev.type === 'up' || ev.type === 'cancel') {
      if (ev.id === this.leftId) { this.leftDown = false; this.leftId = -1; }
      if (ev.id === this.rightId) { this.rightDown = false; this.rightId = -1; }
    } else if (ev.type === 'move') {
      // Deslizar de un lado al otro cambia de control sin levantar el dedo.
      if (ev.id === this.leftId && !isLeft) {
        this.leftDown = false; this.leftId = -1;
        this.rightDown = true; this.rightId = ev.id;
      } else if (ev.id === this.rightId && isLeft) {
        this.rightDown = false; this.rightId = -1;
        this.leftDown = true; this.leftId = ev.id;
      }
    }
  },
};
