// SKYLINE - runner infinito sobre azoteas neon.
// Un toque: saltar. Mantener: saltar mas alto. Toque en el aire: doble salto o dash.
// El dash atraviesa drones y los destruye: unico acto ofensivo del juego.
// Coordenadas escaladas 1.5x desde el diseno original de 180x400 -> 270x600.
import { VW, VH, Pool, makeRng, clamp, cam, aabb } from '../core.js';
import { bake, spr, burst, makeStars, drawStars } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { vibrate } from '../input.js';

const P = { out:'#07030f', bg:'#140a26', dk:'#25123f', blue:'#2a8ce0', cy:'#4de0f0',
            ye:'#f2f24a', wh:'#ffffff', mag:'#e0249a', pink:'#ff5cc8', pur:'#a3218f' };

// --- Sprites como arrays de strings, horneados una sola vez al iniciar ---
const R_BODY = [
  '..111..',
  '.14441.',
  '.13331.',
  '12222.1',
  '12222.1',
  '.1222.1',
  '.15551.',
  '.1551..',
  '.155...',
  '.15.6..',
  '.6...6.',
  '.66..6.',
];
const RMAP = { '1':P.out, '2':P.mag, '3':P.cy, '4':P.ye, '5':P.dk, '6':P.pink };

// Los pinchos NO pueden ser cian: es el color del borde de la azotea sobre la
// que se apoyan, y un peligro del mismo tono que su superficie es invisible.
// Rojo-naranja: no aparece en ningun otro elemento del juego.
const SPIKE = ['..1..1..','.11..11.','111..111','11111111','22222222','32222223'];
const SMAP  = { '1':'#ff3355', '2':'#c81030', '3':P.out };
const SMAP2 = { '1':'#ffdd44', '2':'#ff3355', '3':P.out };

const DRONE = [
  '...1111.....',
  '..122221111.',
  '.1233332221.',
  '112444422221',
  '.13333333331',
  '..1111111111',
  '....1....1..',
  '....5....5..',
];
const DMAP  = { '1':P.out, '2':P.pur, '3':P.mag, '4':P.pink, '5':P.cy };
const DMAP2 = { '1':P.out, '2':P.pur, '3':P.mag, '4':P.ye,   '5':P.cy };

const BIT = [
  ['.11.','1221','1221','.11.'],
  ['..11..','..21..','..21..','..11..'],
  ['.1.','.2.','.2.','.1.'],
  ['..11..','..21..','..21..','..11..'],
];
const BMAP = { '1':P.out, '2':P.ye };

const BEACON = [
  '..1111..','.122221.','12333321','12344321','12344321','12333321','.122221.','..1111..',
];
const BEMAP_A = { '1':P.out, '2':P.pur, '3':P.ye, '4':P.wh };
const BEMAP_B = { '1':P.out, '2':P.pur, '3':P.cy, '4':P.wh };

// Bandas de altura de azotea. Repartidas por el centro-bajo de la pantalla para
// que se vea lo que viene: con el rango 348-546 la accion quedaba pegada abajo
// y el 70% superior desperdiciado.
const BANDS = [316, 351, 386, 421, 456, 491, 526];

export default {
  meta: { id:'skyline', title:'SKYLINE', tag:'CORRE Y SALTA', colors:['#4de0f0','#e0249a'] },

  init(ctx, args) {
    const rnd = this.rnd = makeRng(args.seed >>> 0);

    const whiteMap = {};
    for (const k in RMAP) whiteMap[k] = P.wh;
    this.sRom    = bake(R_BODY, RMAP, 2);
    this.sRomW   = bake(R_BODY, whiteMap, 2);
    this.sSpike  = [bake(SPIKE, SMAP, 2), bake(SPIKE, SMAP2, 2)];
    this.sDrone  = [bake(DRONE, DMAP, 2), bake(DRONE, DMAP2, 2)];
    this.sBit    = BIT.map(f => bake(f, BMAP, 2));
    this.sBeacon = [bake(BEACON, BEMAP_A, 2), bake(BEACON, BEMAP_B, 2)];

    // Columnas de ventanas horneadas: 4 variantes (0 = pared lisa, sin blit).
    // Se hornean una vez; en pantalla son 1 drawImage por columna en vez de ~20.
    this.sWin = [null, null, null, null];
    for (let v = 1; v < 4; v++) {
      const cv = document.createElement('canvas');
      cv.width = 14; cv.height = VH;
      const c = cv.getContext('2d');
      for (let wy = 0; wy < VH; wy += 20) {
        const lit = ((v * 2654435761 + wy * 40503) >>> 11) & 3;
        c.fillStyle = lit === 0 ? '#1c1030' : lit === 1 ? '#f2f24a' : lit === 2 ? '#4de0f0' : '#1c1030';
        c.fillRect(0, wy, 4, 6);
        c.fillRect(7, wy + 10, 4, 6);
      }
      this.sWin[v] = cv;
    }

    this.stars = makeStars(rnd, VW, 340, [
      { n:26, speed:0, col:'#2a1a54', size:2 },
      { n:16, speed:0, col:'#3d2a6e', size:2 },
    ]);

    this.roofs   = new Pool(24, () => ({ x:0, y:0, w:0, spike:-1, _i:0 }), null);
    this.drones  = new Pool(12, () => ({ x:0, y:0, by:0, ph:0, diver:false, t:0, dv:0, _i:0 }), null);
    this.bits    = new Pool(48, () => ({ x:0, y:0, _i:0 }), null);
    this.beacons = new Pool(4,  () => ({ x:0, y:0, ph:0, kind:0, _i:0 }), null);

    // Estado de Romina
    this.x = 78; this.y = BANDS[3] - 24; this.vy = 0;
    this.grounded = true; this.coyote = 0; this.buffer = 0;
    this.holding = false; this.holdT = 0; this.airUsed = false;
    this.dashT = 0; this.dashX = 0; this.iframe = 0;
    this.squash = 0; this.dead = false; this.deadT = 0;
    this.runFrame = 0; this.runT = 0;

    this.speed = 87;
    this.t = 0; this.score = 0; this.combo = 1; this.comboT = 0;
    this.nextX = 0; this.lastBand = 3;
    this.spikeBlink = 0; this.bitFrame = 0; this.bitT = 0;
    this.beaconT = 18; this.droneT = 20;
    this.msg = ''; this.msgT = 0;
    this.overdrive = 0; this.phase = 0;

    // Piso inicial generoso para que arranque corriendo sin riesgo
    const r0 = this.roofs.spawn();
    r0.x = 0; r0.y = BANDS[3]; r0.w = 200; r0.spike = -1;
    this.lastRoof = r0;
    this.nextX = 200;
    for (let i = 0; i < 6; i++) this.genRoof();
  },

  genRoof() {
    const rnd = this.rnd;
    const sp = this.speed;
    // El hueco se deriva del ALCANCE REAL del salto, no de una constante suelta.
    // Alcance = velocidad * airtime. Airtime medido: 0.58s con toque corto, 0.82s manteniendo.
    // Se limita al 62% del alcance maximo para que siempre sobre margen de reaccion.
    const reachHold = sp * 0.82;
    const reachTap  = sp * 0.58;
    const gapMin = Math.min(24, reachTap * 0.30);
    const gapMax = reachHold * 0.50;
    // Rampa de entrada: los primeros 8s los huecos son mansos
    const ease = clamp(this.t / 8, 0.45, 1);
    const gap = this.roofs.n <= 1 ? 0 : (gapMin + rnd() * (gapMax - gapMin)) * ease;
    // En BANDS, indice MENOR = mas alto en pantalla.
    // Subir consume alcance horizontal, asi que el presupuesto se reparte:
    // cuanto mas ancho es el hueco, menos se puede subir. Bajar siempre es gratis.
    // Presupuesto: el salto sube 96px (2.9 bandas) pero necesita margen de aterrizaje.
    const budget = 1 - gap / Math.max(1, reachHold);
    const maxUp = budget > 0.55 ? 2 : budget > 0.30 ? 1 : 0;
    let band = clamp(this.lastBand + rnd.int(-maxUp, 2), 0, BANDS.length - 1);
    this.lastBand = band;
    const w = 51 + Math.round(rnd() * 31) * 3;

    const r = this.roofs.spawn();
    // Si el pool esta lleno igual avanzamos nextX, o el generador se atasca
    // y deja de producir suelo por delante (caida garantizada).
    if (!r) { this.nextX += gap + w; return; }
    r.x = this.nextX + gap; r.y = BANDS[band]; r.w = w; r.spike = -1;
    this.lastRoof = r;

    const spikeP = clamp(0.22 + (this.t - 40) * 0.002, 0.22, 0.46);
    if (w >= 69 && gap < 60 && this.t > 12 && rnd() < spikeP) {
      r.spike = 21 + rnd() * (w - 42);
    }

    // Arco de monedas trazando la parabola del salto: ensena sin tutorial
    if (gap > 51 && rnd() < 0.65) this.arc(this.nextX, r.y, r.x, r.y);
    else if (w >= 96 && rnd() < 0.40) {
      for (let i = 0; i < 3; i++) {
        const b = this.bits.spawn();
        if (b) { b.x = r.x + w / 2 - 16 + i * 16; b.y = r.y - 14; }
      }
    }
    this.nextX = r.x + w;
  },

  arc(fromX, fromY, toX, toY) {
    const n = 3 + this.rnd.int(0, 3);
    const dx = toX - fromX;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      const b = this.bits.spawn();
      if (!b) return;
      b.x = fromX + dx * t;
      b.y = Math.min(fromY, toY) - 30 - Math.sin(t * Math.PI) * 34;
    }
  },

  get holdMax() { return this.airUsed ? 0.16 : 0.22; },

  jump() {
    this.vy = -322; this.holding = true; this.holdT = 0;
    this.grounded = false; this.coyote = 0;
    SFX.jump();
  },

  die() {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.vy = -240;
    burst(this.x + 7, this.y + 12, 20,
      { rnd:this.rnd, colors:[P.mag, P.pink, P.wh], speed:170, life:0.6, size:2, grav:400 });
    cam.shake(7, 0.3); SFX.hurt(); vibrate([30, 40, 60]);
  },

  update(dt, ctx) {
    this.t += dt;

    if (this.dead) {
      this.deadT += dt;
      this.vy += 1470 * dt; this.y += this.vy * dt; this.x -= 60 * dt;
      if (this.deadT > 1.0) ctx.gameOver(this.score);
      return;
    }

    // Acelera rapido al principio y se aplana: sube 87->170 en 60s, tope 205.
    this.speed = 87 + Math.min(Math.sqrt(this.t) * 11, 118) + (this.overdrive > 0 ? 40 : 0);
    const sp = this.speed;

    if (this.overdrive > 0) this.overdrive -= dt;
    if (this.phase > 0) this.phase -= dt;
    if (this.iframe > 0) this.iframe -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }

    this.score += sp * dt * 0.12;

    // --- Fisica ---
    const prevY = this.y;   // se usa abajo para detectar el cruce con la azotea
    if (this.dashT > 0) {
      this.dashT -= dt; this.vy = 0;
      this.dashX = Math.min(39, this.dashX + 220 * dt);
    } else if (this.dashX > 0) {
      this.dashX = Math.max(0, this.dashX - 260 * dt);
    }

    if (this.dashT <= 0) {
      // Gravedad asimetrica: sube lento, cae rapido. Es lo que da el arco "snappy".
      let grav = this.vy < 0 ? 1140 : 1470;
      if (this.holding && this.vy < 0 && this.holdT < this.holdMax) grav -= 930;
      this.vy += grav * dt;
      if (this.vy > 780) this.vy = 780;
      this.y += this.vy * dt;
    }
    if (this.holding) this.holdT += dt;

    if (this.buffer > 0) this.buffer -= dt;
    if (!this.grounded && this.coyote > 0) this.coyote -= dt;

    // --- Contacto con el suelo (sonda de pies de 8px, perdona el borde) ---
    // Deteccion por CRUCE: compara el pie del frame anterior con el actual.
    // Sin esto, cayendo a 780px/s (13px por frame) atraviesa la azotea sin detectarla.
    const wasGrounded = this.grounded;
    this.grounded = false;
    const footL = this.x + 3, footR = this.x + 11;
    const botY = this.y + 24, prevBot = prevY + 24;
    for (let i = 0; i < this.roofs.n; i++) {
      const r = this.roofs.items[i];
      // Aterriza si el pie cruza el techo entre el frame anterior y este.
      // El margen de 14px cubre el caso de venir ya apoyada (prevBot == r.y).
      if (this.vy >= 0 && footR > r.x && footL < r.x + r.w &&
          botY >= r.y && prevBot <= r.y + 14) {
        this.y = r.y - 24; this.vy = 0; this.grounded = true;
        if (!wasGrounded) { this.squash = 0.11; this.airUsed = false; }
        break;
      }
    }
    if (this.grounded) { this.coyote = 0.10; this.airUsed = false; }
    if (this.squash > 0) this.squash -= dt;

    // Salto guardado en buffer se dispara al aterrizar
    if (this.grounded && this.buffer > 0) { this.jump(); this.buffer = 0; }

    if (this.y > VH + 20) { this.die(); return; }

    // --- Scroll del mundo ---
    for (let i = this.roofs.n - 1; i >= 0; i--) {
      const r = this.roofs.items[i];
      r.x -= sp * dt;
      if (r.x + r.w < -12) this.roofs.free(r);
    }
    this.nextX -= sp * dt;
    let guard = 0;
    while (this.nextX < VW + 160 && guard++ < 30) this.genRoof();

    // Pinchos
    if (this.phase <= 0) {
      for (let i = 0; i < this.roofs.n; i++) {
        const r = this.roofs.items[i];
        if (r.spike < 0) continue;
        if (aabb(this.x + this.dashX, this.y, 15, 24, r.x + r.spike, r.y - 12, 16, 12)) {
          this.die(); return;
        }
      }
    }

    // Drones
    this.droneT -= dt;
    if (this.t > 20 && this.droneT <= 0 && this.drones.n < 3) {
      const fast = this.t > 55;
      this.droneT = fast ? 3.5 + this.rnd() * 2.5 : 5.5 + this.rnd() * 3.5;
      const d = this.drones.spawn();
      if (d) {
        d.x = VW + 20;
        d.by = BANDS[this.rnd.int(0, 6)] - (this.rnd.chance(0.5) ? 30 : 60);
        d.y = d.by; d.ph = this.rnd() * 6.28; d.t = 0; d.dv = 0;
        d.diver = this.t > 45 && this.rnd.chance(0.5);
      }
    }
    for (let i = this.drones.n - 1; i >= 0; i--) {
      const d = this.drones.items[i];
      d.x -= (sp + 33) * dt; d.ph += dt * 4.4; d.t += dt;
      if (d.diver) {
        const c = d.t % 2.2;
        d.dv = (c > 0.9 && c < 1.5) ? 135 : 0;
        d.by += d.dv * dt;
      }
      d.y = d.by + Math.sin(d.ph) * 7;
      if (d.x < -20) { this.drones.free(d); continue; }
      if (aabb(this.x + this.dashX, this.y, 15, 24, d.x + 2, d.y + 2, 20, 12)) {
        if (this.iframe > 0) {
          burst(d.x + 12, d.y + 8, 12,
            { rnd:this.rnd, colors:[P.pink, P.cy, P.wh], speed:130, life:0.4, size:2 });
          this.drones.free(d);
          this.score += 50; cam.shake(3, 0.12); SFX.hit(); vibrate(14);
        } else if (this.phase <= 0) { this.die(); return; }
      }
    }

    // Bits
    this.bitT += dt;
    if (this.bitT > 0.09) { this.bitT = 0; this.bitFrame = (this.bitFrame + 1) & 3; }
    for (let i = this.bits.n - 1; i >= 0; i--) {
      const b = this.bits.items[i];
      b.x -= sp * dt;
      if (b.x < -12) { this.bits.free(b); continue; }
      if (aabb(this.x + this.dashX, this.y, 15, 24, b.x, b.y, 12, 12)) {
        this.score += 10 * this.combo;
        this.combo = Math.min(this.combo + 1, 9); this.comboT = 2.0;
        burst(b.x + 6, b.y + 6, 4,
          { rnd:this.rnd, colors:[P.ye, P.wh], speed:70, life:0.25, size:2 });
        SFX.coin(); this.bits.free(b);
      }
    }

    // Beacons (power-ups)
    this.beaconT -= dt;
    if (this.beaconT <= 0 && this.roofs.n > 2) {
      this.beaconT = 22 + this.rnd() * 8;
      // El pool NO conserva orden (swap-remove), asi que items[n-1] no es la
      // ultima azotea. Se usa la referencia que guarda genRoof.
      const r = this.lastRoof;
      if (r && r.spike < 0 && r.x > VW) {
        const b = this.beacons.spawn();
        if (b) { b.x = r.x + r.w / 2; b.y = r.y - 40; b.ph = 0; b.kind = this.rnd.int(0, 1); }
      }
    }
    for (let i = this.beacons.n - 1; i >= 0; i--) {
      const b = this.beacons.items[i];
      b.x -= sp * dt; b.ph += dt * 5;
      if (b.x < -20) { this.beacons.free(b); continue; }
      if (aabb(this.x + this.dashX, this.y, 15, 24, b.x - 8, b.y - 8, 16, 16)) {
        // ESCUDO reemplaza a FASE: invulnerable un rato, legible de un vistazo
        // (ella parpadea) y no permite atrincherarse porque dura poco.
        if (b.kind === 0) { this.overdrive = 6; this.msg = 'TURBO'; }
        else { this.phase = 6; this.msg = 'ESCUDO'; }
        this.msgT = 0.9;
        burst(b.x, b.y, 16,
          { rnd:this.rnd, colors:[P.ye, P.cy, P.wh], speed:150, life:0.5, size:2 });
        cam.shake(4, 0.15); SFX.powerup(); vibrate(20);
        this.beacons.free(b);
      }
    }

    // Ciclo de carrera: sus piernas aceleran junto con el juego
    this.runT += dt;
    const ft = clamp(0.110 - (sp - 87) * 0.00035, 0.055, 0.110);
    if (this.runT > ft) { this.runT = 0; this.runFrame = (this.runFrame + 1) & 3; }
    this.spikeBlink += dt;
  },

  onInput(ev, ctx) {
    if (this.dead) return;
    if (ev.type === 'down') {
      if (this.grounded || this.coyote > 0) {
        this.jump();
      } else if (!this.airUsed) {
        // Siempre doble salto: un solo boton con dos resultados opuestos segun
        // la velocidad vertical era un cambio de modo invisible que ella no puede
        // predecir. El dash ahora sale del power-up, no de adivinar el momento.
        this.airUsed = true;
        this.vy = -270; this.holding = true; this.holdT = 0;
        SFX.jump();
      } else {
        this.buffer = 0.12;   // se dispara solo al aterrizar
      }
    } else if (ev.type === 'up' || ev.type === 'cancel') {
      this.holding = false;
    }
  },

  draw(g, ctx) {
    // Cielo en bandas
    g.fillStyle = '#1a0d33'; g.fillRect(0, 0, VW, VH);
    const bands = ['#2d1152','#3a1660','#4a1d70','#5c2a80'];
    for (let i = 0; i < 4; i++) { g.fillStyle = bands[i]; g.fillRect(0, i * 40, VW, 40); }
    drawStars(g, this.stars);

    // Azoteas y edificios
    for (let i = 0; i < this.roofs.n; i++) {
      const r = this.roofs.items[i];
      const x = Math.round(r.x), y = Math.round(r.y);
      g.fillStyle = P.bg; g.fillRect(x, y + 3, r.w, VH - y);
      g.fillStyle = P.dk; g.fillRect(x, y + 3, 2, VH - y);
      // Ventanas: columna COMPLETA horneada al arrancar (14 x VH), un solo blit
      // por columna. Antes eran dos bucles anidados: 1893 draw calls en el pico.
      for (let wx = x + 6; wx < x + r.w - 6; wx += 14) {
        const col = this.sWin[((wx * 2654435761) >>> 13) & 3];
        if (col) g.drawImage(col, 0, 0, 14, VH - y - 24, wx, y + 14, 14, VH - y - 24);
      }
      g.fillStyle = P.blue; g.fillRect(x, y, r.w, 3);
      g.fillStyle = P.cy;   g.fillRect(x, y, r.w, 1);
      // Bordes brillantes: dicen de un vistazo donde termina la cornisa
      g.fillStyle = P.wh;
      g.fillRect(x, y, 4, 2); g.fillRect(x + r.w - 4, y, 4, 2);
      if (r.spike >= 0) {
        spr(g, this.sSpike[((this.spikeBlink * 4) | 0) & 1], x + r.spike + 8, y - 6);
      }
    }

    for (let i = 0; i < this.bits.n; i++) {
      const b = this.bits.items[i];
      spr(g, this.sBit[this.bitFrame], b.x + 6, b.y + 6);
    }
    for (let i = 0; i < this.beacons.n; i++) {
      const b = this.beacons.items[i];
      spr(g, this.sBeacon[b.kind], b.x, b.y + Math.sin(b.ph) * 4);
    }
    for (let i = 0; i < this.drones.n; i++) {
      const d = this.drones.items[i];
      spr(g, this.sDrone[d.diver ? 1 : 0], d.x + 12, d.y + 8);
    }

    // Romina
    const rx = this.x + this.dashX + 7, ry = this.y + 12;
    if (this.dashT > 0) {
      g.fillStyle = P.cy;
      g.fillRect(Math.round(rx - 22), Math.round(ry - 2), 18, 3);
    }
    if (this.phase > 0 && ((this.phase * 10) | 0) % 2 === 0) spr(g, this.sRomW, rx, ry);
    else spr(g, this.sRom, rx, ry);

    // HUD
    text(g, 'ROMINA', 8, 8, '#8a7ab8', 2);
    text(g, String(Math.floor(this.score)), 8, 24, P.wh, 3);
    if (this.combo > 1) text(g, this.combo + 'x', 8, 48, P.ye, 2);
    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, 70, P.ye, 3);
    if (this.overdrive > 0) text(g, 'TURBO', VW - 8 - measure('TURBO', 2), 8, P.ye, 2);
    if (this.phase > 0) text(g, 'ESCUDO', VW - 8 - measure('ESCUDO', 2), 8, P.cy, 2);
  },

  destroy() { this.roofs = this.drones = this.bits = this.beacons = null; },
};
