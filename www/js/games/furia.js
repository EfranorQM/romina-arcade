// FURIA - moto de montana con niveles y meta.
//
// El unico juego del arcade que NO es pixel art: corre a 1080x2400 con el
// filtrado suave activo (meta.smooth) y se dibuja entero con curvas y
// degradados. Ver moto-art.js para el porque.
//
// Controles: dos zonas fijas en la mitad inferior.
//   Derecha  = acelerar. En el aire, rota hacia adelante.
//   Izquierda = SALTAR al tocar (en el suelo) y frenar si se mantiene. En el
//               aire rota hacia atras, que es como se acomoda el aterrizaje.
// El salto es un toque, no un mantener: medido, esquivar una roca solo
// inclinandose daba un margen de 1px y dependia de tener un bache justo antes.

import { VW, VH, clamp, cam, Save } from '../core.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { vibrate } from '../input.js';
import * as W from './moto-world.js';
import * as A from './moto-art.js';

const OB = { ROCK: W.OB_ROCK, RAMP: W.OB_RAMP, LOG: W.OB_LOG, PIT: W.OB_PIT };

// Largo de pista por nivel. Crece, pero se estabiliza: una pista de 3 minutos
// cansa mas de lo que emociona.
function levelLen(n) { return 7200 + Math.min(n, 6) * 900; }

const PALS = [A.SKY.dusk, A.SKY.night, A.SKY.dawn];

export default {
  meta: {
    id: 'furia', title: 'FURIA', tag: 'MOTO Y SALTOS',
    colors: ['#ff5c7a', '#f0b45a'],
    // Resolucion alta + filtrado suave: es lo que separa a este juego del
    // resto. A 270x600 con nearest-neighbour las curvas se ven escalonadas.
    vw: 540, vh: 1200, smooth: true,
  },

  init(ctx, args) {
    this.ctx = ctx;
    this.rnd = ctx.rnd;
    // Estado de los dedos: vive por encima del nivel, ver startLevel().
    this.leftDown = false; this.rightDown = false;
    this.leftId = -1; this.rightId = -1;
    this.level = 0;
    this.score = 0;
    this.total = 0;
    A.resetGradients();
    this.startLevel();
  },

  startLevel() {
    this.level++;
    const len = levelLen(this.level);
    this.T = W.makeTerrain(this.rnd, this.level, len);
    this.obs = W.placeObstacles(this.T, this.rnd, this.level);
    this.pal = PALS[(this.level - 1) % PALS.length];
    A.resetGradients();

    this.B = W.makeBike(120, W.groundY(this.T, 120) - 40);
    this.camX = 0; this.camY = 0;
    this.dirt = [];
    for (let i = 0; i < 90; i++) this.dirt.push({ x:0, y:0, vx:0, vy:0, r:2, life:0, max:1, c:'#8a6a44' });
    this.dirtI = 0;

    this.dead = false; this.won = false;
    this.deadT = 0; this.wonT = 0;
    this.t = 0;
    this.msg = ''; this.msgT = 0;
    this.airMax = 0; this.lastFlips = 0;

    // Controles: dos mitades de la parte baja de la pantalla.
    // OJO: NO se resetean al cambiar de nivel. Si la jugadora tiene el dedo
    // apoyado en el acelerador cuando cruza la meta, ese dedo sigue apoyado en
    // el nivel siguiente y no habra un nuevo evento 'down' que lo reactive:
    // borrarlos aqui dejaba la moto parada en la linea de salida para siempre.
    if (this.leftId === undefined) {
      this.leftDown = false; this.rightDown = false;
      this.leftId = -1; this.rightId = -1;
    }
    this.wantJump = false;
  },

  destroy() { A.resetGradients(); },
  onResize() { A.resetGradients(); },

  flash(m) { this.msg = m; this.msgT = 1.4; },

  update(dt, ctx) {
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;

    if (this.dead) {
      this.deadT += dt;
      // La moto sigue cayendo tras el golpe: cortar el movimiento de golpe se
      // lee como un cuelgue, no como un choque.
      this.B.vy += W.GRAV * dt;
      this.B.y += this.B.vy * dt;
      this.B.ang += this.B.av * dt;
      const gy = W.groundY(this.T, this.B.x);
      if (this.B.y > gy - 6) { this.B.y = gy - 6; this.B.vy = 0; this.B.av *= 0.8; }
      this.followCam(dt);
      if (this.deadT > 1.6) ctx.gameOver(this.total + this.score);
      return;
    }

    if (this.won) {
      this.wonT += dt;
      // Rueda sola hasta frenar
      W.stepBike(this.B, this.T, dt, 0, 0);
      this.followCam(dt);
      if (this.wonT > 2.0) {
        this.total += this.score + 800;
        this.score = 0;
        if (this.level >= 8) { ctx.gameOver(this.total); return; }
        this.startLevel();
      }
      return;
    }

    // --- Control ---
    // Derecha acelera; izquierda frena. En el aire, inclinan.
    const throttle = this.rightDown ? 1 : 0;
    const brake = this.leftDown ? 1 : 0;
    this.B.brake = brake;
    let lean = 0;
    if (this.rightDown) lean = 1;        // morro abajo
    if (this.leftDown) lean = -1;        // morro arriba (wheelie / rotar atras)
    if (this.rightDown && this.leftDown) lean = 0;

    // Salto pendiente de un toque en la zona izquierda
    if (this.wantJump) {
      this.wantJump = false;
      if (W.bikeJump(this.B)) {
        SFX.jump();
        this.burstDirt(6, '#8a6a44');
      }
    }

    const wasAir = !this.B.onGround;
    W.stepBike(this.B, this.T, dt, throttle, lean);

    // Altura de vuelo, para puntuar y para el aviso de aterrizaje
    if (!this.B.onGround) {
      const alt = W.groundY(this.T, this.B.x) - this.B.y;
      if (alt > this.airMax) this.airMax = alt;
    } else if (wasAir) {
      // Acaba de aterrizar
      if (this.airMax > 60) {
        const pts = Math.floor(this.airMax * 0.4);
        this.score += pts;
        SFX.blip();
        this.burstDirt(10, '#8a6a44');
        cam.shake(Math.min(7, this.airMax * 0.03), 0.18);
      }
      if (this.B.flips > this.lastFlips) {
        const n = this.B.flips - this.lastFlips;
        this.lastFlips = this.B.flips;
        this.score += 500 * n;
        this.flash(n > 1 ? n + ' GIROS!' : 'GIRO!');
        SFX.powerup();
        vibrate([0, 40, 30, 60]);
      }
      this.airMax = 0;
    }

    // Tierra de la rueda trasera al acelerar en el suelo
    if (this.B.onGround && throttle > 0 && this.B.vx > 40 && this.rnd() < 0.6) {
      this.burstDirt(1, '#8a6a44');
    }

    // --- Colision con obstaculos ---
    this.checkObstacles();

    // --- Vuelco ---
    if (W.wipeoutUpdate(this.B, this.T, dt)) this.crash('VOLCASTE');

    // --- Caida fuera del mundo ---
    if (this.B.y > W.groundY(this.T, this.B.x) + 400) this.crash('AL VACIO');

    // --- Meta ---
    if (this.B.x >= this.T.len - 200 && !this.won) {
      this.won = true; this.wonT = 0;
      this.score += Math.max(0, 900 - Math.floor(this.t * 8));
      SFX.record(); this.flash('NIVEL ' + this.level);
      vibrate([0, 60, 40, 100]);
    }

    this.followCam(dt);
    this.updateDirt(dt);
  },

  crash(why) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0;
    this.B.av = (this.rnd() - 0.5) * 9;
    this.B.vy = -260;
    SFX.explode(); SFX.hurt();
    cam.shake(11, 0.5);
    vibrate([0, 90, 50, 140]);
    this.flash(why);
    this.burstDirt(22, '#a8683c');
  },

  checkObstacles() {
    const B = this.B;
    for (let i = 0; i < this.obs.length; i++) {
      const ob = this.obs[i];
      if (ob.hit) continue;
      const dx = B.x - ob.x;
      if (dx < -ob.w || dx > ob.w) continue;
      const gy = W.groundY(this.T, ob.x);

      if (ob.kind === OB.PIT) {
        // El pozo mata solo si la moto esta baja al cruzarlo.
        if (Math.abs(dx) < ob.w * 0.5 && B.y > gy - 24) {
          ob.hit = 1; this.crash('AL POZO');
        }
        continue;
      }
      if (ob.kind === OB.RAMP) {
        // La rampa impulsa: no es un peligro, es una oportunidad.
        if (Math.abs(dx) < ob.w * 0.5 && B.y > gy - ob.h * 2.2 && B.onGround) {
          ob.hit = 1;
          B.vy -= 320 + B.vx * 0.55;
          B.av -= 1.2;
          SFX.jump();
          this.burstDirt(8, '#f0b45a');
        }
        continue;
      }
      // Roca y tronco: golpean si la moto esta a su altura.
      const top = gy - ob.h * (ob.kind === OB.LOG ? 1.0 : 1.6);
      if (Math.abs(dx) < ob.w * 0.55 && B.y + W.WHEEL_R > top) {
        ob.hit = 1;
        if (ob.kind === OB.LOG && B.vx > 380) {
          // Rompe el tronco a alta velocidad: premia ir rapido.
          this.score += 120;
          B.vx *= 0.88;
          SFX.hit(); cam.shake(5, 0.2);
          this.burstDirt(12, '#6b4423');
          this.flash('ROMPISTE!');
        } else {
          this.crash('CHOCASTE');
        }
      }
    }
  },

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

  // Camara: la moto va adelantada a la izquierda para ver lo que viene, y el
  // eje vertical sigue con retraso para que los saltos se sientan.
  followCam(dt) {
    const tx = this.B.x - VW * 0.32;
    const ty = this.B.y - VH * 0.56;
    const k = Math.min(1, 8 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * Math.min(1, 4.5 * dt);
    if (this.camX < 0) this.camX = 0;
  },

  draw(g, ctx) {
    const w = VW, h = VH;
    const pal = this.pal;

    // --- Cielo y sol ---
    A.drawSky(g, w, h, pal, this.camX, w * 0.74, h * 0.17);

    // --- Cerros de fondo, tres capas ---
    A.drawHills(g, w, h, this.camX, 0.0, h * 0.50, h * 0.045, pal.top, 1.7);
    A.drawHills(g, w, h, this.camX, 0.35, h * 0.57, h * 0.038, pal.mid, 4.1);
    A.drawHills(g, w, h, this.camX, 0.7, h * 0.63, h * 0.030, pal.ground2, 8.3);

    // --- Terreno ---
    A.drawTerrain(g, this.T, W.groundY, w, h, this.camX, this.camY, pal);

    // --- Obstaculos visibles ---
    for (let i = 0; i < this.obs.length; i++) {
      const ob = this.obs[i];
      const sx = ob.x - this.camX;
      if (sx < -120 || sx > w + 120) continue;
      if (ob.kind === OB.PIT) continue;              // el pozo es un hueco, se ve por el terreno
      if (ob.hit && (ob.kind === OB.LOG)) continue;  // el tronco roto desaparece
      A.drawObstacle(g, ob, sx, W.groundY(this.T, ob.x) - this.camY, OB);
    }

    // --- Tierra ---
    A.drawDirt(g, this.dirt, this.camX, this.camY);

    // --- Moto ---
    A.drawBike(g, this.B, this.B.x - this.camX, this.B.y - this.camY,
               W.WHEELBASE, W.WHEEL_R, 16);

    // --- HUD ---
    this.drawHud(g, w, h);
  },

  drawHud(g, w, h) {
    // Barra de progreso de la pista: dice cuanto falta sin numeros.
    const pad = 16, barW = w - pad * 2, barH = 7;
    g.fillStyle = 'rgba(0,0,0,0.34)';
    g.fillRect(pad, 14, barW, barH);
    const prog = clamp(this.B.x / this.T.len, 0, 1);
    g.fillStyle = '#ffd98a';
    g.fillRect(pad, 14, barW * prog, barH);
    // Marca de la meta
    g.fillStyle = '#ffffff';
    g.fillRect(pad + barW - 2, 11, 3, barH + 6);

    text(g, 'NIVEL ' + this.level, pad, 30, '#ffe8c0', 2);
    const s = String(this.total + this.score);
    text(g, s, w - pad - measure(s, 3), 28, '#ffffff', 3);

    // Velocidad como barra, no como numero: se lee de reojo.
    const spd = clamp(this.B.vx / 520, 0, 1);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(pad, h - 30, 120, 6);
    g.fillStyle = spd > 0.85 ? '#ff5c7a' : '#8affc8';
    g.fillRect(pad, h - 30, 120 * spd, 6);

    if (this.msgT > 0) {
      textCenter(g, this.msg, w / 2, h * 0.22, '#ffe8a8', 4);
    }

    // Guias de control, se desvanecen tras los primeros segundos del nivel 1.
    if (this.level === 1 && this.t < 5) {
      const a = Math.min(1, (5 - this.t) / 1.5);
      g.globalAlpha = a * 0.75;
      textCenter(g, 'SALTO', w * 0.25, h - 96, '#ffffff', 2);
      textCenter(g, 'GAS', w * 0.75, h - 96, '#ffffff', 2);
      g.globalAlpha = a * 0.16;
      g.fillStyle = '#ffffff';
      g.fillRect(0, h * 0.62, w * 0.5 - 2, h * 0.38);
      g.fillRect(w * 0.5 + 2, h * 0.62, w * 0.5 - 2, h * 0.38);
      g.globalAlpha = 1;
    }
  },

  onInput(ev) {
    if (this.dead || this.won) return;
    const isLeft = ev.x < VW * 0.5;
    if (ev.type === 'down') {
      if (ev.y < VH * 0.5) return;          // la mitad de arriba no controla
      if (isLeft) {
        this.leftDown = true; this.leftId = ev.id;
        // El toque pide salto; update() decide si se puede (suelo + cooldown).
        this.wantJump = true;
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
