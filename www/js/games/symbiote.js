// SYMBIOTE - escapa del laboratorio. Estilo CARRION.
//
// Arrastra el dedo: la criatura FLUYE hacia ahi. Doce tentaculos se agarran
// solos de paredes, techos y tuberias y tiran del cuerpo sin parar. Boton
// derecho para agarrar y despedazar cientificos.
//
// La primera version era un gancho de un tentaculo tipo Spider-Man y el usuario
// la probo en el celular: no se podia mover con fluidez. Esto es el rediseno.
//
// Pegamento: la locomocion vive en sym-flow.js, el arte en sym-art.js, el nivel
// y los enemigos en sym-world.js, la sangre en sym-gore.js.

import { makeRng, clamp, cam, VW, VH } from '../core.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, sfx } from '../audio.js';
import { Button, vibrate } from '../input.js';
import * as F from './sym-flow.js';
import * as W from './sym-world.js';
import * as G from './sym-gore.js';
import * as A from './sym-art.js';

const BASE_W = 540, BASE_H = 1200;
// Oscuridad base. Con #2a3038 el 70% inferior de la pantalla quedaba negro
// puro y en un celular al sol no se veia nada. Esto mantiene la atmosfera
// oscura pero deja leer la geometria del laboratorio.
const AMBIENT = '#5a6470';

export default {
  meta: {
    id:'symbiote', title:'SYMBIOTE', tag:'ESCAPA DEL LAB',
    colors:['#c9203a','#8e1224'],
    vw: BASE_W, vh: BASE_H,
  },

  init(ctx, args) {
    const rnd = this.rnd = makeRng(args.seed >>> 0);
    W.bakeTiles();
    G.bakeGore(rnd);
    A.bakeLights();

    this.enemies = W.makeEnemyPool();
    this.bullets = W.makeBulletPool();
    this.spray = G.makeSprayPool();
    this.debris = G.makeDebrisPool();
    this.drips = G.makeDripPool();

    this.btn = new Button(0, 0, 58, 20);
    this.blob = A.makeBlob(F.BODY_VR);   // radio VISUAL: la colision usa BODY_R, mas chico

    this.level = 0;
    this.score = 0;
    this.totalKills = 0;
    this.hpMax = 100;
    this.hp = 100;
    this.layout();
    this.startLevel();
  },

  // Recoloca lo que depende de la orientacion. El motor lo llama al girar.
  layout() {
    A.ensureLightBuffer(VW, VH);
    if (this.btn) {
      this.btn.x = VW - 84;
      this.btn.y = VH - 110;
    }
  },
  onResize() { this.layout(); },

  startLevel() {
    this.level++;
    const L = this.L = W.genLevel(this.rnd, this.level);
    this.solid = (tx, ty) => W.solidTile(L, tx, ty);
    this.solidPx = (x, y) => W.solidAt(L, x, y);

    this.gore = G.makeGoreLayer(L.pxW, L.pxH);
    this.gore.poolGrid = new Int8Array(L.w * L.h);

    this.C = F.makeCreature(L.spawnX, L.spawnY);
    this.wcam = new W.WorldCam();
    this.wcam.snap(L, this.C.x, this.C.y);

    this.enemies.clear(); this.bullets.clear();
    this.spray.clear(); this.debris.clear(); this.drips.clear();
    W.spawnEnemies(L, this.enemies, this.rnd, this.level);

    // Entrada tactil
    this.dragId = -1; this.dragX = 0; this.dragY = 0; this.pulling = false;
    this.aimX = 0; this.aimY = 1; this.aimDist = -1;
    this.grabT = 0; this.grabbed = -1;

    this.freeze = 0; this.slowT = 0; this.slowScale = 1;
    this.iframe = 0; this.dead = false; this.deadT = 0;
    this.won = false; this.wonT = 0;
    this.alarm = 0; this.grow = 0.2;
    this.msg = ''; this.msgT = 0;
    this.t = 0; this.comboT = 0; this.comboN = 0;
    this.pulse2 = 0; this.pulse3 = 0;

    this.world = {
      px: this.C.x, py: this.C.y, alive: true, alert: false,
      rnd: this.rnd, bulletPool: this.bullets, wcam: this.wcam,
      // Radio de IMPACTO: entre el de colision (12) y el visual (26). Con el de
      // colision las balas atravesaban carne visible sin tocarla; con el visual
      // entero la criatura recibia tiros que se ven lejos del cuerpo.
      playerRadius: F.HIT_R, playerInPipe: false, mercy: 0,
      onShoot: () => SFX.shoot(),
      onAlarm: () => { SFX.alarm(); this.alarm = 1; this.flash('ALARMA'); },
      onEnemyDeath: (e, dx, dy, hard) => this.onKill(e, dx, dy, hard),
      onEnemyHurt: () => SFX.hit(),
    };
  },

  flash(m) { this.msg = m; this.msgT = 1.2; },

  onKill(e, dx, dy, hard) {
    const rnd = this.rnd;
    this.totalKills++;
    this.score += e.type === W.E_SCIENTIST ? 25 : 120;
    this.comboT = 0.4; this.comboN++;
    const big = hard || this.comboN >= 2;

    const pieces = big ? 6 : (hard ? 4 : 2);
    G.spawnDebris(this.debris, e.x, e.y, pieces, dx, dy, rnd);
    G.sprayPulse(this.spray, e.x, e.y, dx, dy, 8, rnd);
    this.pulse2 = 0.06; this.pulse3 = 0.12;
    this.pulseX = e.x; this.pulseY = e.y; this.pulseDX = dx; this.pulseDY = dy;
    G.stampPool(this.gore, e.x, e.y,
      Math.floor(e.x / W.TS), Math.floor(e.y / W.TS), this.L.w, rnd);

    // Comer hace crecer a la criatura: mas cuerpo, mas alcance visual.
    this.grow = Math.min(1, this.grow + 0.06);
    this.hp = Math.min(this.hpMax, this.hp + (e.type === W.E_SCIENTIST ? 6 : 2));

    if (big) { this.freeze = 0.183; cam.shake(8, 0.34); this.slowT = 0.34; this.slowScale = 0.28; vibrate([0,50,40,90]); }
    else if (hard) { this.freeze = 0.133; cam.shake(5.5, 0.24); this.slowT = 0.22; this.slowScale = 0.35; vibrate([0,40,30,60]); }
    else { this.freeze = 0.083; cam.shake(3.5, 0.16); vibrate(28); }
    sfx({ type:'noise', f0: big ? 900 : 1400, f1: 120, dur: big ? 0.28 : 0.16, vol: 0.42 });
  },

  hurt(n) {
    if (this.iframe > 0 || this.dead) return;
    this.hp -= n;
    this.iframe = 0.8;
    this.freeze = 0.1;
    cam.shake(6, 0.2); SFX.hurt(); vibrate(70);
    if (this.hp <= 0) {
      this.dead = true; this.deadT = 0;
      G.sprayPulse(this.spray, this.C.x, this.C.y, 0, -1, 20, this.rnd);
      cam.shake(9, 0.4);
    }
  },

  // SNATCH: un tentaculo sale disparado, agarra a la presa mas cercana y la
  // arrastra hacia la masa. Es el unico verbo ofensivo y ocupa un solo boton.
  snatch() {
    if (this.grabT > 0 || this.dead) return;
    let best = null, bd = 1e9;
    for (let i = 0; i < this.enemies.n; i++) {
      const e = this.enemies.items[i];
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.C.x, e.y - this.C.y);
      if (d < F.REACH && d < bd) { bd = d; best = e; }
    }
    this.grabT = 0.34;
    if (!best) { sfx({ type:'noise', f0: 600, f1: 200, dur: 0.1, vol: 0.18 }); return; }
    this.grabbed = best.uid !== undefined ? best.uid : -1;
    const dx = (best.x - this.C.x) / (bd || 1), dy = (best.y - this.C.y) / (bd || 1);
    W.damageEnemy(best, 999, true);
    if (best.hp <= 0 && !best.dead) {
      best.dead = true;
      this.onKill(best, dx, dy, true);
      this.enemies.free(best);
    }
    sfx({ type:'noise', f0: 1600, f1: 300, dur: 0.14, vol: 0.34 });
    vibrate(22);
  },

  update(dt, ctx) {
    this.t += dt;

    // Hitstop DENTRO de update: el bucle del motor no se detiene por devolver.
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.msgT > 0) this.msgT -= dt;
      return;
    }

    if (this.dead) {
      this.deadT += dt;
      G.updateSpray(this.spray, dt, this.gore, this.solidPx, this.rnd, null);
      G.updateDebris(this.debris, dt, this.gore, this.solidPx, this.rnd);
      if (this.deadT > 1.15) ctx.gameOver(this.score);
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

    let sdt = dt;
    if (this.slowT > 0) { this.slowT -= dt; sdt = dt * this.slowScale; }

    if (this.iframe > 0) this.iframe -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.grabT > 0) this.grabT -= dt;
    if (this.alarm > 0) this.alarm = Math.max(0, this.alarm - dt * 0.15);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }

    G.resetStamps(this.gore);
    if (this.pulse2 > 0) { this.pulse2 -= dt; if (this.pulse2 <= 0) G.sprayPulse(this.spray, this.pulseX, this.pulseY, this.pulseDX, this.pulseDY, 6, this.rnd); }
    if (this.pulse3 > 0) { this.pulse3 -= dt; if (this.pulse3 <= 0) G.sprayPulse(this.spray, this.pulseX, this.pulseY, this.pulseDX, this.pulseDY, 5, this.rnd); }

    // Direccion hacia el dedo, en coordenadas de mundo
    if (this.pulling) {
      const wx = this.dragX + this.wcam.x, wy = this.dragY + this.wcam.y;
      let ax = wx - this.C.x, ay = wy - this.C.y;
      const m = Math.hypot(ax, ay);
      this.aimDist = m;
      if (m > 6) { this.aimX = ax / m; this.aimY = ay / m; }
    } else this.aimDist = -1;

    F.step(this.C, sdt, this.aimX, this.aimY, this.pulling, this.solid, this.aimDist);

    // Deformacion: se aplasta si el hueco es estrecho
    // Se sondea con el radio VISUAL: la masa que se ve es la que debe
    // aplastarse al entrar en un hueco angosto, aunque la colision use uno
    // menor. Ese aplastamiento es lo que vende que la criatura es blanda.
    const probe = F.BODY_VR;
    const tightX = this.solidPx(this.C.x - probe, this.C.y) || this.solidPx(this.C.x + probe, this.C.y);
    const tightY = this.solidPx(this.C.x, this.C.y - probe) || this.solidPx(this.C.x, this.C.y + probe);
    A.blobUpdate(this.blob, dt,
      tightX ? 0.5 : 1, tightY ? 0.5 : 1, this.grow);

    this.world.px = this.C.x; this.world.py = this.C.y;
    W.updateEnemies(this.enemies, this.L, sdt, this.world);
    W.updateBullets(this.bullets, this.L, sdt, this.world);

    // Balas
    for (let i = this.bullets.n - 1; i >= 0; i--) {
      const b = this.bullets.items[i];
      if (b.friendly) continue;
      if (Math.hypot(b.x - this.C.x, b.y - this.C.y) < F.HIT_R) {
        this.bullets.free(b);
        this.hurt(b.dmg || 20);
      }
    }

    // Las puntas de los tentaculos hieren a lo que toquen
    for (let i = 0; i < F.NT; i++) {
      if (this.C.st[i] !== F.GRIP) continue;
      const tip = i * F.SEG + F.SEG - 1;
      const tx = this.C.px[tip], ty = this.C.py[tip];
      for (let k = this.enemies.n - 1; k >= 0; k--) {
        const e = this.enemies.items[k];
        if (e.dead) continue;
        if (Math.hypot(e.x - tx, e.y - ty) > (e.r || 12) + 5) continue;
        W.damageEnemy(e, 25, true);
        if (e.hp <= 0 && !e.dead) {
          e.dead = true;
          const d = Math.hypot(tx - this.C.x, ty - this.C.y) || 1;
          this.onKill(e, (tx - this.C.x) / d, (ty - this.C.y) / d, false);
          this.enemies.free(e);
        }
      }
    }

    G.updateSpray(this.spray, sdt, this.gore, this.solidPx, this.rnd,
      (x, y) => { if (this.rnd() < 0.35) G.spawnDrip(this.drips, x, y, this.rnd); });
    G.updateDebris(this.debris, sdt, this.gore, this.solidPx, this.rnd);
    G.updateDrips(this.drips, sdt, this.gore);

    const sp = F.speedOf(this.C, dt);
    this.wcam.follow(this.L, this.C.x, this.C.y,
      (this.C.x - this.C.ox) * 60, (this.C.y - this.C.oy) * 60, dt);

    if (W.tileAt(this.L, this.C.x, this.C.y) === W.T_EXIT) {
      this.won = true; this.wonT = 0;
      this.score += 500 + Math.max(0, 300 - Math.floor(this.t * 5));
      SFX.powerup(); this.flash('NIVEL ' + this.level + ' LISTO');
    }
  },

  onInput(ev, ctx) {
    if (this.dead || this.won) return;

    if (ev.type === 'down') {
      // El boton gana si el toque cae en su area; si no, es arrastre.
      if (this.btn.down(ev)) { this.snatch(); return; }
      if (this.dragId === -1) {
        this.dragId = ev.id;
        this.dragX = ev.x; this.dragY = ev.y;
        this.pulling = true;
        // Respuesta en el MISMO frame: la direccion se fija ya, sin esperar
        // al primer move, o el primer toque se siente muerto.
        const wx = ev.x + this.wcam.x, wy = ev.y + this.wcam.y;
        const ax = wx - this.C.x, ay = wy - this.C.y;
        const m = Math.hypot(ax, ay);
        this.aimDist = m;
        if (m > 6) { this.aimX = ax / m; this.aimY = ay / m; }
      }
      return;
    }
    if (ev.type === 'move') {
      if (ev.id === this.dragId) { this.dragX = ev.x; this.dragY = ev.y; }
      return;
    }
    if (ev.type === 'up' || ev.type === 'cancel') {
      this.btn.up(ev);
      if (ev.id === this.dragId) { this.dragId = -1; this.pulling = false; }
    }
  },

  draw(g, ctx) {
    const c = this.wcam;

    // 1. Escena
    W.drawLevel(g, this.L, c);
    G.drawGore(g, this.gore, c.x, c.y, VW, VH);
    G.drawDebris(g, this.debris, c.x, c.y, [A.PAL.flesh, A.PAL.fleshDark, A.PAL.bone, A.PAL.fleshMid]);
    W.drawEnemies(g, this.enemies, c, this.t);
    W.drawBullets(g, this.bullets, c);

    // 2. Tentaculos, luego el cuerpo encima
    for (let i = 0; i < F.NT; i++) {
      if (this.C.st[i] === F.SEEK) continue;
      A.drawTentacle(g, this.C, i, F.SEG, c.x, c.y, this.C.st[i] === F.GRIP);
    }
    A.drawBlob(g, this.blob, this.C.x - c.x, this.C.y - c.y, this.iframe > 0.6);

    G.drawSpray(g, this.spray, c.x, c.y);

    // 3. Luz: oscuridad ambiente + focos, compuesta en un solo multiply.
    A.lightBegin(AMBIENT, this.alarm);
    // La criatura lleva su propia luz tenue: garantiza que siempre se vea.
    A.addLight(this.C.x - c.x, this.C.y - c.y, 420, 'red', 0.85);
    // Lamparas del laboratorio, ancladas al mundo
    const step = W.TS * 8;
    const x0 = Math.floor(c.x / step) * step, y0 = Math.floor(c.y / step) * step;
    for (let wy = y0; wy < c.y + VH + step; wy += step) {
      for (let wx = x0; wx < c.x + VW + step; wx += step) {
        const h = ((wx * 374761393 + wy * 668265263) >>> 13) & 7;
        if (h > 4) continue;
        if (W.solidAt(this.L, wx, wy)) continue;
        const kind = h === 0 ? 'cold' : h === 1 ? 'warm' : 'green';
        const fl = 0.75 + 0.25 * Math.sin(this.t * (3 + h) + wx * 0.01);
        A.addLight(wx - c.x, wy - c.y, 300, kind, fl);
      }
    }
    A.lightApply(g, VW, VH);

    // 4. HUD por encima de la luz, siempre legible
    W.drawExitArrow(g, this.L, c, this.C.x, this.C.y);
    this.drawHud(g);
  },

  drawHud(g) {
    const hp = Math.max(0, this.hp);
    const bw = Math.min(200, VW * 0.38);
    g.fillStyle = '#12080c'; g.fillRect(14, 14, bw, 14);
    g.fillStyle = hp > 35 ? A.PAL.fleshLit : A.PAL.warm;
    g.fillRect(14, 14, Math.round(bw * hp / this.hpMax), 14);
    text(g, 'ROMINA', 14, 34, '#6b7a88', 2);

    const lv = 'NIVEL ' + this.level;
    text(g, lv, VW - 14 - measure(lv, 2), 14, '#8e9aa8', 2);
    const s = String(Math.floor(this.score));
    text(g, s, VW - 14 - measure(s, 3), 34, '#e8eef4', 3);

    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, VH * 0.18, A.PAL.alarm, 3);

    // Hilo hacia el dedo: unico indicador de a donde va, sin ocupar HUD.
    if (this.pulling) {
      g.fillStyle = 'rgba(201,32,58,0.45)';
      const sx = this.C.x - this.wcam.x, sy = this.C.y - this.wcam.y;
      const dx = this.dragX - sx, dy = this.dragY - sy;
      const n = Math.min(14, Math.hypot(dx, dy) / 12) | 0;
      for (let i = 1; i <= n; i++) {
        const f = i / (n + 1);
        g.fillRect(Math.round(sx + dx * f) - 1, Math.round(sy + dy * f) - 1, 2, 2);
      }
    }

    // Boton de agarre
    const b = this.btn;
    g.fillStyle = this.grabT > 0 ? 'rgba(201,32,58,0.75)' : 'rgba(142,18,36,0.45)';
    g.fillRect(b.x - 34, b.y - 34, 68, 68);
    g.fillStyle = A.PAL.fleshHi;
    g.fillRect(b.x - 16, b.y - 3, 32, 6);
    g.fillRect(b.x - 3, b.y - 16, 6, 32);

    if (this.won) textCenter(g, 'SALIDA', VW / 2, VH / 2, A.PAL.bone, 5);
  },

  destroy() {
    this.enemies = null; this.bullets = null; this.spray = null;
    this.debris = null; this.drips = null; this.gore = null;
    this.L = null; this.C = null; this.blob = null;
  },
};
