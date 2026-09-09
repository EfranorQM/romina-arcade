// SYMBIOTE - escapa del laboratorio. Un simbionte con tentaculos elasticos.
// Joystick izquierdo mueve; boton derecho lanza el tentaculo. MANTENIENDO el
// boton te quedas colgada y el joystick te columpia: eso es el corazon del juego.
//
// Este archivo es el pegamento. La fisica vive en sym-rope.js, el nivel y los
// enemigos en sym-world.js, y la sangre en sym-gore.js.
// Unidades canonicas: 540x1200 virtual, TS=24 (docs/SYMBIOTE-CANON.md).

import { Pool, makeRng, clamp, cam, Save } from '../core.js';
import { bake, spr, burst } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, sfx } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';
import * as R from './sym-rope.js';
import * as W from './sym-world.js';
import * as G from './sym-gore.js';

const VW = 540, VH = 1200;

const P = {
  body:'#4a2668', bodyLit:'#6b3a94', edge:'#140a1e', eye:'#ff2d55',
  eyeGlow:'#ff7a99', hud:'#c8b8ff', dim:'#5a4a88', warn:'#ffb020',
};

// El cuerpo se hornea en 4 niveles de sangre: cada muerte lo mancha mas y se
// va limpiando solo, para que la siguiente muerte vuelva a notarse.
const BODY_TIERS = [
  { '1':P.edge, '2':P.body,    '3':P.bodyLit, '4':P.eye },
  { '1':P.edge, '2':'#4d2352', '3':'#7a3a72', '4':P.eye },
  { '1':P.edge, '2':'#5c1f38', '3':'#8e2f45', '4':P.eye },
  { '1':P.edge, '2':'#5c0a14', '3':'#8e0f1c', '4':P.eye },
];

const BLOB = [
  '..1111..',
  '.122221.',
  '12333321',
  '12344321',
  '12333321',
  '12222221',
  '.122221.',
  '..1111..',
];

const MAX_RANGE = 240;

export default {
  meta: {
    id:'symbiote', title:'SYMBIOTE', tag:'ESCAPA DEL LAB',
    colors:['#ff2d55','#6b3a94'],
    vw: VW, vh: VH,          // este juego corre al doble de resolucion
    rotates: true,           // unico juego que se adapta al giro del telefono
  },

  init(ctx, args) {
    const rnd = this.rnd = makeRng(args.seed >>> 0);

    W.bakeTiles();
    G.bakeGore(rnd);
    this.sBody = BODY_TIERS.map(m => bake(BLOB, m, 3));

    this.rope = R.makeRope();
    this.enemies = W.makeEnemyPool();
    this.bullets = W.makeBulletPool();
    this.spray = G.makeSprayPool();
    this.debris = G.makeDebrisPool();
    this.drips = G.makeDripPool();

    this.stick = new Stick(34, 5);
    this.btn = new Button(VW - 96, VH - 150, 56, 18);

    this.level = 0;
    this.score = 0;
    this.totalKills = 0;
    this.startLevel();
  },

  startLevel() {
    this.level++;
    const L = this.L = W.genLevel(this.rnd, this.level);
    this.solidFn = (tx, ty) => W.solidTile(L, tx, ty);
    this.solidPx = (x, y) => W.solidAt(L, x, y);

    this.gore = G.makeGoreLayer(L.pxW, L.pxH);
    this.gore.poolGrid = new Int8Array(L.w * L.h);

    this.B = R.makeBody(L.spawnX, L.spawnY);
    this.B.hp = this.B.hp || 100;
    this.wcam = new W.WorldCam();
    this.wcam.snap(L, this.B.x, this.B.y);

    for (let i = 0; i < R.TENT_MAX; i++) this.rope.state[i] = R.T_FREE;
    this.enemies.clear(); this.bullets.clear();
    this.spray.clear(); this.debris.clear(); this.drips.clear();
    W.spawnEnemies(L, this.enemies, this.rnd, this.level);

    this.aimX = 0; this.aimY = -1;
    this.freeze = 0; this.slowT = 0; this.slowScale = 1;
    this.iframe = 0; this.dead = false; this.deadT = 0;
    this.won = false; this.wonT = 0;
    this.inPipe = -1; this.pipePos = 0; this.pipeDir = 1;
    this.msg = ''; this.msgT = 0;
    this.t = 0;
    this.comboT = 0; this.comboN = 0;

    this.world = {
      px: this.B.x, py: this.B.y, alive: true, alert: false,
      rnd: this.rnd, bulletPool: this.bullets, wcam: this.wcam,
      playerRadius: R.BODY_R, playerInPipe: false, mercy: 0,
      onShoot: () => SFX.shoot(),
      onAlarm: () => { SFX.alarm(); this.flash('ALARMA'); },
      onEnemyDeath: (e, dx, dy, hard) => this.onKill(e, dx, dy, hard),
      onEnemyHurt: () => SFX.hit(),
    };
  },

  flash(m) { this.msg = m; this.msgT = 1.1; },

  // ---------- Muerte de un enemigo: aqui vive toda la sensacion ----------
  onKill(e, dx, dy, hard) {
    const rnd = this.rnd;
    this.totalKills++;
    this.score += e.type === W.E_SCIENTIST ? 25 : 120;

    // Cadena de muertes: dos en menos de 0.4s cuenta como grande.
    this.comboT = 0.4; this.comboN++;
    const big = hard || this.comboN >= 2;

    const nPieces = big ? 6 : (hard ? 4 : 2);
    G.spawnDebris(this.debris, e.x, e.y, nPieces, dx, dy, rnd);

    // Tres pulsos separados: el ritmo es lo que lo hace leer como arteria
    // en vez de como nube de particulas.
    G.sprayPulse(this.spray, e.x, e.y, dx, dy, 8, rnd);
    this.pulse2 = 0.06; this.pulse3 = 0.12;
    this.pulseX = e.x; this.pulseY = e.y; this.pulseDX = dx; this.pulseDY = dy;

    G.stampPool(this.gore, e.x, e.y,
      Math.floor(e.x / W.TS), Math.floor(e.y / W.TS), this.L.w, rnd);

    this.B.bloodiness = Math.min(1, this.B.bloodiness + 0.16 + nPieces * 0.02);

    // Hitstop: nunca pasar de 11 frames o lee como tiron, no como impacto.
    if (big) { this.freeze = 0.183; cam.shake(8, 0.34); this.slowT = 0.34; this.slowScale = 0.28; vibrate([0,50,40,90]); }
    else if (hard) { this.freeze = 0.133; cam.shake(5.5, 0.24); this.slowT = 0.22; this.slowScale = 0.35; vibrate([0,40,30,60]); }
    else { this.freeze = 0.083; cam.shake(3.5, 0.16); vibrate(28); }

    sfx({ type:'noise', f0: big ? 900 : 1400, f1: 120, dur: big ? 0.28 : 0.16, vol: 0.42 });
    if (e.type === W.E_SCIENTIST) this.B.hp = Math.min(100, this.B.hp + 6);
  },

  hurt(n) {
    if (this.iframe > 0 || this.dead) return;
    this.B.hp -= n;
    this.iframe = 0.8;
    this.freeze = 0.1;
    cam.shake(6, 0.2); SFX.hurt(); vibrate(70);
    if (this.B.hp <= 0) {
      this.dead = true; this.deadT = 0;
      G.sprayPulse(this.spray, this.B.x, this.B.y, 0, -1, 20, this.rnd);
      cam.shake(9, 0.4);
    }
  },

  update(dt, ctx) {
    this.t += dt;

    // Hitstop DENTRO de update: devolver temprano no detiene el reloj del motor,
    // asi que la congelacion tiene que ser estado interno.
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.msgT > 0) this.msgT -= dt;
      return;
    }

    if (this.dead) {
      this.deadT += dt;
      G.updateSpray(this.spray, dt, this.gore, this.solidPx, this.rnd, null);
      G.updateDebris(this.debris, dt, this.gore, this.solidPx, this.rnd);
      if (this.deadT > 1.2) ctx.gameOver(this.score);
      return;
    }

    if (this.won) {
      this.wonT += dt;
      if (this.wonT > 1.0) {
        if (this.level >= 8) { ctx.gameOver(this.score); return; }
        this.startLevel();
      }
      return;
    }

    // Camara lenta: el motor sigue a 60Hz, asi que la latencia de entrada no
    // cambia; solo se escala el dt que ve la fisica.
    let sdt = dt;
    if (this.slowT > 0) { this.slowT -= dt; sdt = dt * this.slowScale; }

    if (this.iframe > 0) this.iframe -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }
    if (this.B.bloodiness > 0) this.B.bloodiness = Math.max(0, this.B.bloodiness - 0.02 * dt);

    G.resetStamps(this.gore);

    // Pulsos 2 y 3 del spray arterial (latido).
    if (this.pulse2 > 0) { this.pulse2 -= dt; if (this.pulse2 <= 0) G.sprayPulse(this.spray, this.pulseX, this.pulseY, this.pulseDX, this.pulseDY, 6, this.rnd); }
    if (this.pulse3 > 0) { this.pulse3 -= dt; if (this.pulse3 <= 0) G.sprayPulse(this.spray, this.pulseX, this.pulseY, this.pulseDX, this.pulseDY, 5, this.rnd); }

    // ---- Tuberia ----
    if (this.inPipe >= 0) {
      this.B.hp -= W.PIPE_DRAIN * dt;      // no es un refugio: drena vida
      this.pipePos = W.pipeAdvance(this.L, this.inPipe, this.pipePos, this.pipeDir, sdt);
      const done = W.pipeAtEnd(this.L, this.inPipe, this.pipePos);
      if (done) {
        const m = W.pipeMouthEnd();
        this.B.x = m.x; this.B.y = m.y;
        this.B.ox = m.x; this.B.oy = m.y;
        this.inPipe = -1;
      }
      if (this.B.hp <= 0) this.hurt(0);
    } else {
      // ---- Fisica ----
      const sx = this.stick.active ? this.stick.dx : 0;
      const sy = this.stick.active ? this.stick.dy : 0;
      R.step(this.rope, this.B, sdt, sx, sy, this.solidFn, W.TS);

      // Entrar a una tuberia: se toma la boca mas cercana al pasar por ella.
      const pm = W.pipeMouthNear(this.L, this.B.x, this.B.y, 20);
      if (pm && pm.index >= 0) {
        this.inPipe = pm.index; this.pipePos = pm.pos; this.pipeDir = pm.dir;
        SFX.dash();
      }
    }

    this.world.px = this.B.x; this.world.py = this.B.y;
    this.world.playerInPipe = this.inPipe >= 0;

    W.updateEnemies(this.enemies, this.L, sdt, this.world);
    W.updateBullets(this.bullets, this.L, sdt, this.world);

    // Balas contra la jugadora
    if (this.inPipe < 0) {
      for (let i = this.bullets.n - 1; i >= 0; i--) {
        const b = this.bullets.items[i];
        if (b.friendly) continue;
        const d = Math.hypot(b.x - this.B.x, b.y - this.B.y);
        if (d < R.BODY_R + 3) {
          this.bullets.free(b);
          this.hurt(b.dmg || 22);
        }
      }
    }

    // La punta del tentaculo hiere a lo que toque, a velocidad
    this.tentacleHits(sdt);

    G.updateSpray(this.spray, sdt, this.gore, this.solidPx, this.rnd,
      (x, y) => { if (this.rnd() < 0.35) G.spawnDrip(this.drips, x, y, this.rnd); });
    G.updateDebris(this.debris, sdt, this.gore, this.solidPx, this.rnd);
    G.updateDrips(this.drips, sdt, this.gore);

    this.wcam.follow(this.L, this.B.x, this.B.y,
      (this.B.x - this.B.ox) * 60, (this.B.y - this.B.oy) * 60, dt);

    // Salida
    if (W.tileAt(this.L, this.B.x, this.B.y) === W.T_EXIT) {
      this.won = true; this.wonT = 0;
      this.score += 500 + Math.max(0, 300 - Math.floor(this.t * 5));
      SFX.powerup(); this.flash('NIVEL ' + this.level + ' LISTO');
    }
  },

  // La punta de un tentaculo anclado o volando desgarra lo que atraviesa.
  tentacleHits(dt) {
    for (let i = 0; i < R.TENT_MAX; i++) {
      const st = this.rope.state[i];
      if (st === R.T_FREE) continue;
      const tip = i * R.SEG + R.SEG - 1;
      const tx = this.rope.px[tip], ty = this.rope.py[tip];
      const vx = (tx - this.rope.ox[tip]) / dt, vy = (ty - this.rope.oy[tip]) / dt;
      const spd = Math.hypot(vx, vy);
      if (spd < 200) continue;
      for (let k = this.enemies.n - 1; k >= 0; k--) {
        const e = this.enemies.items[k];
        if (e.dead) continue;
        if (Math.hypot(e.x - tx, e.y - ty) > (e.r || 12) + 6) continue;
        const hard = spd >= 520;
        W.damageEnemy(e, hard ? 999 : 40, true);
        if (e.hp <= 0 && !e.dead) {
          e.dead = true;
          this.onKill(e, vx / spd, vy / spd, hard);
          this.enemies.free(e);
        }
        this.rope.wet[i] = 1.2;
      }
    }
  },

  onInput(ev, ctx) {
    if (this.dead || this.won) return;

    if (ev.type === 'down') {
      // Mitad derecha: tentaculo. Mitad izquierda: joystick.
      if (ev.x > VW * 0.52) {
        this.btn.down(ev);
        this.fireTentacle();
      } else {
        this.stick.down(ev);
      }
      return;
    }
    if (ev.type === 'move') {
      if (this.stick.move(ev)) {
        // El joystick tambien apunta: no hace falta un tercer dedo.
        const m = Math.hypot(this.stick.dx, this.stick.dy);
        if (m > 0.25) { this.aimX = this.stick.dx / m; this.aimY = this.stick.dy / m; }
      }
      return;
    }
    if (ev.type === 'up' || ev.type === 'cancel') {
      if (this.btn.up(ev)) {
        // Soltar el boton suelta el tentaculo y conserva la inercia.
        if (this.B.attached >= 0) R.release(this.rope, this.B, this.B.attached);
      }
      this.stick.up(ev);
    }
  },

  fireTentacle() {
    if (this.inPipe >= 0) return;
    let ax = this.aimX, ay = this.aimY;
    if (this.stick.active) {
      const m = Math.hypot(this.stick.dx, this.stick.dy);
      if (m > 0.25) { ax = this.stick.dx / m; ay = this.stick.dy / m; }
    }
    const t = R.fire(this.rope, this.B, ax, ay, this.solidFn, W.TS, MAX_RANGE);
    if (t >= 0) sfx({ type:'pulse', duty:0.25, f0:700, f1:260, dur:0.09, vol:0.2 });
  },

  draw(g, ctx) {
    const c = this.wcam;
    W.drawLevel(g, this.L, c);
    G.drawGore(g, this.gore, c.x, c.y, VW, VH);
    W.drawPipeHints(g, this.L, c, this.B.x, this.B.y, this.t);

    G.drawDebris(g, this.debris, c.x, c.y, [P.body, '#8e0f1c', '#e8ecf0', '#b81322']);
    W.drawEnemies(g, this.enemies, c, this.t);
    W.drawBullets(g, this.bullets, c);

    // Tentaculos: se pintan de rojo un rato despues de atravesar sangre.
    for (let i = 0; i < R.TENT_MAX; i++) {
      const wet = this.rope.wet[i] > 0;
      R.drawTentacle(g, this.rope, i, c.x, c.y,
        wet ? G.BLOOD_MID : P.body, wet ? G.BLOOD_DEEP : P.edge);
    }

    // Cuerpo
    if (this.inPipe < 0) {
      const tier = (this.B.bloodiness * 3.99) | 0;
      const blink = this.iframe > 0 && ((this.iframe * 20) | 0) % 2 === 0;
      if (!blink) spr(g, this.sBody[tier], this.B.x - c.x, this.B.y - c.y);
    }

    G.drawSpray(g, this.spray, c.x, c.y);
    W.drawExitArrow(g, this.L, c, this.B.x, this.B.y);

    this.drawHud(g);
  },

  drawHud(g) {
    // Vida
    const hp = Math.max(0, this.B.hp);
    g.fillStyle = '#2a1030'; g.fillRect(16, 16, 200, 16);
    g.fillStyle = hp > 35 ? '#ff2d55' : '#ffb020';
    g.fillRect(16, 16, Math.round(200 * hp / 100), 16);
    g.fillStyle = P.edge; g.fillRect(16, 16, 200, 2);
    text(g, 'ROMINA', 16, 40, P.dim, 2);

    text(g, 'NIVEL ' + this.level, VW - 16 - measure('NIVEL ' + this.level, 2), 16, P.hud, 2);
    const s = String(Math.floor(this.score));
    text(g, s, VW - 16 - measure(s, 3), 38, '#ffffff', 3);

    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, 120, P.warn, 3);
    if (this.inPipe >= 0) textCenter(g, 'EN TUBERIA', VW / 2, VH - 200, '#5cffd8', 2);

    // Joystick y boton
    if (this.stick.active) {
      g.fillStyle = '#ffffff22';
      g.fillRect(Math.round(this.stick.ox - 34), Math.round(this.stick.oy - 34), 68, 68);
      g.fillStyle = P.hud;
      g.fillRect(Math.round(this.stick.ox + this.stick.dx * 30 - 6),
                 Math.round(this.stick.oy + this.stick.dy * 30 - 6), 12, 12);
    }
    g.fillStyle = this.btn.pressed ? '#ff2d5599' : '#ff2d5555';
    g.fillRect(this.btn.x - 40, this.btn.y - 40, 80, 80);
    g.fillStyle = P.hud;
    g.fillRect(this.btn.x - 20, this.btn.y - 4, 40, 8);

    if (this.won) textCenter(g, 'SALIDA', VW / 2, VH / 2, '#5cffd8', 5);
  },

  destroy() {
    this.rope = null; this.enemies = null; this.bullets = null;
    this.spray = null; this.debris = null; this.drips = null;
    this.gore = null; this.L = null; this.sBody = null;
  },
};
