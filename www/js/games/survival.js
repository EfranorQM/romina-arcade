// SURVIVAL — Roma defiende la linea contra todo lo que amenaza una relacion.
//
// Es el port del juego que ya existia en HTML (Romina-main/): mismos enemigos,
// mismos diez jefes con sus habilidades, mismos poderes y combos. Lo que cambia
// es como corre: alli cada enemigo era un <div> animado con GSAP; aqui todo se
// dibuja en canvas, sin dependencias, como el resto de la app.
//
// Se juega APAISADO, que es como estaba pensado el original y como se agarra el
// telefono con las dos manos: pulgar izquierdo mueve, pulgar derecho dispara.
//
// Reparto de archivos: las definiciones en surv-defs.js, el arte en
// surv-art.js, y aqui el juego.

import { Pool, clamp, cam, makeRng } from '../core.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, sfx, playMusic, stopMusic, SONGS } from '../audio.js';
import { burst, particles } from '../gfx.js';
import { vibrate } from '../input.js';
import * as A from './surv-art.js';
import {
  VW, VH, LINE_Y, ROMA_Y, ENEMIES, BOSSES, BOSS_IDS, POWERUPS, RULES,
  WAVE_PHRASES, GAMEOVER_MSGS, comboMult, poolForWave,
} from './surv-defs.js';
import { SKILLS, offerCards } from './surv-skills.js';
import { biomaFor, bossFor, entraBioma, drawBioma } from './surv-biomas.js';
import { drawPicker, cardAt } from './surv-cards.js';

// ---------- Los controles tactiles ----------
// En apaisado los pulgares caen en las esquinas de abajo, asi que ahi van los
// controles: la mitad izquierda mueve y la derecha dispara. El area de cada uno
// es MUCHO mas grande que su dibujo, porque un pulgar no apunta fino.
const PAD_X = 52, PAD_Y = VH - 48, PAD_R = 30;      // cruceta virtual
const FIRE_X = VW - 48, FIRE_Y = VH - 44, FIRE_R = 26;
const BOMB_X = VW - 104, BOMB_Y = VH - 32, BOMB_R = 18;

export default {
  meta: {
    id: 'survival', title: 'SURVIVAL', tag: 'DEFIENDE LA LINEA',
    colors: ['#ff3ec9', '#6bf0ff'],
    vw: VW, vh: VH, wide: true, smooth: true,
  },

  init(ctx, args) {
    const rnd = this.rnd = makeRng((args && args.seed) >>> 0 || 1);

    this.roma = { x: VW / 2, inv: 0, lastShot: 0, hurt: 0 };
    this.lives = RULES.lives;
    this.score = 0;
    this.wave = 0;
    this.combo = 0;
    this.comboT = 0;
    this.t = 0;
    this.shake = 0;

    this.enemies = [];
    this.bullets = [];        // balas de Roma
    this.ebullets = [];       // balas enemigas
    this.drops = [];
    this.floats = [];         // textos que suben y se desvanecen

    this.power = { double: 0, mega: 0, shield: 0, turbo: 0 };
    this.bomb = { ready: true, cd: 0 };
    this.silenced = false;

    // ---------- Roguelike ----------
    // `skills` es {id: nivel}. Empieza vacio en CADA partida: las habilidades
    // no se guardan entre partidas, que es lo que hace que cada una sea
    // distinta. `picker` es la pantalla de eleccion mientras esta abierta.
    this.skills = {};
    this.picks = 0;              // cuantas elecciones lleva (sube la rareza)
    this.picker = null;
    this.bioma = biomaFor(1);    // en que tramo esta la partida
    this.estrena = 0;            // segundos de aviso al entrar en un bioma
    this.skinShield = 0;         // cargas de SEGUNDA PIEL que quedan esta ola
    this.lineBlocks = 0;         // cruces que aguanta LA LINEA RESISTE esta ola
    this.revived = false;        // si ya se gasto OTRA OPORTUNIDAD

    // Estado de la ola.
    this.waveActive = false;
    this.spawned = 0;
    this.toSpawn = 0;
    this.spawnT = 0;
    this.banner = null;
    this.nextWaveT = 0.8;

    // Jefes: se barajan para que no salgan siempre en el mismo orden, y no se
    // repite ninguno hasta haberlos visto todos.
    this.bossBag = [];
    this.lastBoss = null;

    // Controles: cada dedo se queda con UN control (por pointerId).
    this.padId = null; this.padX = 0; this.padDX = 0;
    // El pulgar derecho dispara Y apunta: nace donde se apoya, y arrastrarlo
    // desde ahi inclina el disparo, como el raton en el juego original.
    // `aim` es el angulo en radianes; -PI/2 es recto hacia arriba.
    this.fireId = null; this.firing = false;
    this.fireX = 0; this.fireY = 0;
    this.aim = -Math.PI / 2;
    this.aiming = false;

    this.over = false;
    this.overT = 0;
    this.tutorial = 3.2;

    // Estas tres se reinician a proposito: la escena es un objeto unico que se
    // reutiliza en cada partida. Si Roma muere en el segundo y medio que pasa
    // entre el aviso de un jefe y su entrada, bossPending se quedaba puesto y
    // la partida siguiente arrancaba con ese jefe suelto en la ola 1.
    this.bossPending = null;
    this.bossT = 0;
    this.flash = 0;
  },

  // ---------- Bucle ----------
  update(dt, ctx) {
    this.t += dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.tutorial > 0) this.tutorial -= dt;

    if (this.over) {
      this.overT += dt;
      this._updateFloats(dt);
      if (this.overT > 1.6) ctx.gameOver(this.score);
      return;
    }

    // Eligiendo recompensa: el juego se queda quieto detras. Sin cuenta atras a
    // proposito, que pueda leer las tres cartas con calma.
    if (this.picker) { this._updatePicker(dt); return; }

    this._updateRoma(dt);
    this._updatePowers(dt);
    this._updateWave(dt);
    this._updateEnemies(dt, ctx);
    this._updateBullets(dt);
    this._updateEBullets(dt, ctx);
    this._updateDrops(dt);
    this._updateFloats(dt);

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (!this.bomb.ready) {
      this.bomb.cd -= dt;
      if (this.bomb.cd <= 0) { this.bomb.ready = true; this._float('BOMBA LISTA', VW / 2, 60, '#ffe14d'); }
    }
  },

  // ---------- Roma ----------
  _updateRoma(dt) {
    const r = this.roma;
    r.x = clamp(r.x + this.padDX * RULES.romaSpeed * dt, 16, VW - 16);
    if (r.inv > 0) r.inv -= dt;
    if (r.hurt > 0) r.hurt -= dt;

    // Disparo. El SILENCIO duplica el tiempo entre tiros si estas en su aura.
    if (this.firing) {
      let cd = this.power.turbo > 0 ? RULES.turboCooldown : RULES.shotCooldown;
      // REFLEJO: dispara mas seguido. Se aplica tambien sobre el TURBO, que ya
      // es rapido de por si: las dos cosas juntas son una build valida.
      const rf = this._lvl('reflejo');
      if (rf) cd /= SKILLS.reflejo.rate(rf);
      if (this.silenced) cd *= 2;
      if (this.t - r.lastShot >= cd) {
        r.lastShot = this.t;
        this._fire();
      }
    }
  },

  // COMBO ARDIENTE: si la racha actual ya enciende las balas. Lo consultan el
  // disparo Y el dibujo, asi que vive en un solo sitio.
  _ardiendo() {
    const ar = this._lvl('ardiente');
    return ar > 0 && this.combo >= SKILLS.ardiente.at(ar);
  },

  _fire() {
    const r = this.roma;
    const ar = this._lvl('ardiente');
    const ardiendo = this._ardiendo();
    const mega = this.power.mega > 0 || ardiendo;
    const doble = this.power.double > 0 || (ardiendo && SKILLS.ardiente.dbl(ar));
    const dmg = mega ? 3 : 1;
    const sp = RULES.bulletSpeed;
    // Las balas salen hacia donde apunta el pulgar derecho.
    const vx = Math.cos(this.aim) * sp, vy = Math.sin(this.aim) * sp;
    // Perpendicular al disparo: es por donde se separan las dos balas del
    // poder DOBLE, para que salgan en paralelo sea cual sea el angulo.
    const px = -Math.sin(this.aim) * 7, py = Math.cos(this.aim) * 7;
    const ox = Math.cos(this.aim) * 12, oy = Math.sin(this.aim) * 12;
    // PERFORANTE: cuantos enemigos puede atravesar cada bala de este disparo.
    const pn = this._lvl('perforante');
    const pierce = pn ? SKILLS.perforante.pierce(pn) : 0;
    // REBOTE: cuantas veces vuelve a entrar una bala que se va por el techo.
    const rb = this._lvl('rebote');

    const mk = (bx, by) => {
      const b = mkBullet(bx, by, vx, vy, dmg, mega, pierce);
      if (rb) {
        b.bounces = Math.max(b.bounces, SKILLS.rebote.bounces(rb) + 1);
        b.reboteLvl = rb;
      }
      return b;
    };

    if (doble) {
      this.bullets.push(mk(r.x + ox - px, ROMA_Y + oy - py));
      this.bullets.push(mk(r.x + ox + px, ROMA_Y + oy + py));
    } else {
      this.bullets.push(mk(r.x + ox, ROMA_Y + oy));
    }
    SFX.shoot();
  },

  _hurtRoma(ctx) {
    const r = this.roma;
    if (r.inv > 0) return 'inv';
    if (this.power.shield > 0) {
      this.power.shield = 0;
      this._float('ESCUDO!', r.x, ROMA_Y - 30, '#6bf0ff');
      SFX.coin();
      return 'shield';
    }
    // SEGUNDA PIEL: su escudo aguanta hasta que te golpean, a diferencia del
    // poder ESCUDO que se cuenta en segundos. Por eso va en su propio contador.
    if (this.skinShield > 0) {
      this.skinShield--;
      r.inv = RULES.invulnerable;
      this._float('SEGUNDA PIEL', r.x, ROMA_Y - 30, '#6bf0ff');
      SFX.coin();
      cam.shake(3, 0.2);
      return 'shield';
    }
    this.lives--;
    r.inv = RULES.invulnerable;
    r.hurt = 0.5;
    this.combo = 0;
    this.shake = 0.4;
    cam.shake(5, 0.35);
    vibrate(60);
    SFX.hurt();
    burst(r.x, ROMA_Y, 18, {
      rnd: this.rnd, speed: 110, life: 0.5, size: 2, grav: 160,
      colors: ['#ff3ec9', '#ffffff', '#ff8ad4'],
    });
    if (this.lives <= 0) {
      // OTRA OPORTUNIDAD: una sola vez por partida, la caida no es el final.
      // Revive con una vida, limpia la pantalla y da un respiro largo, que si
      // reviviera en medio del mismo enjambre no serviria de nada.
      if (this._lvl('otra') && !this.revived) {
        this.revived = true;
        this.lives = 1;
        r.inv = 3;
        this.enemies.length = 0;
        this.ebullets.length = 0;
        this.flash = 0.5;
        cam.shake(10, 0.7);
        vibrate(140);
        SFX.record();
        this._float('OTRA OPORTUNIDAD', VW / 2, VH * 0.45, '#ffe14d');
        return 'revive';
      }
      this._gameOver();
      return 'dead';
    }
    return 'hit';
  },

  _gameOver() {
    this.over = true;
    this.overT = 0;
    this.msg = GAMEOVER_MSGS[(this.rnd() * GAMEOVER_MSGS.length) | 0];
    cam.shake(8, 0.6);
    // La musica calla para que el jingle de derrota se oiga limpio.
    stopMusic();
    SFX.gameover();
  },

  // ---------- Poderes ----------
  _updatePowers(dt) {
    for (const k in this.power) if (this.power[k] > 0) this.power[k] -= dt;
  },

  _grantPower(type) {
    const def = POWERUPS.find(p => p.type === type);
    this.power[type] = def.dur;
    this._float(def.label, this.roma.x, ROMA_Y - 34, def.color);
    SFX.powerup();
  },

  // ---------- Olas ----------
  _updateWave(dt) {
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.estrena > 0) this.estrena -= dt;

    // Entre olas: cuenta atras para la siguiente.
    if (!this.waveActive) {
      this.nextWaveT -= dt;
      if (this.nextWaveT <= 0) this._startWave();
      return;
    }

    // Soltando enemigos poco a poco.
    if (this.spawned < this.toSpawn) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this._spawnFromPool();
        this.spawned++;
        // Los enemigos salen mas juntos segun avanza la partida.
        const base = Math.max(0.32, 1.0 - this.wave * 0.05);
        this.spawnT = base + this.rnd() * 0.4;
      }
      return;
    }

    // Todos fuera y ninguno vivo: ola superada.
    if (this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = 50 * this.wave;
      this.score += bonus;
      this._float('+' + bonus, VW / 2, 76, '#5cffd8');
      this.nextWaveT = 1.5;
    }
  },

  _startWave() {
    this.wave++;
    this.waveActive = true;
    this.spawned = 0;
    this.spawnT = 0.3;

    // El bioma de esta ola. Si estrena tramo, el aviso lo anuncia a lo grande.
    const antes = this.bioma;
    this.bioma = biomaFor(this.wave);
    this.estrena = this.bioma !== antes && entraBioma(this.wave) ? 2.6 : 0;
    // El cartel del bioma SUSTITUYE al aviso de ola, no se suma: los dos a la
    // vez se pisaban en mitad de la pantalla y no se leia ninguno.

    // Lo que se recarga con cada ola. Va aqui y no al recibir el golpe para que
    // ella empiece la ola sabiendo con que cuenta.
    const pi = this._lvl('piel');
    if (pi) {
      this.skinShield = SKILLS.piel.charges(pi) * SKILLS.piel.hits(pi);
      this._float('SEGUNDA PIEL', VW / 2, 92, '#6bf0ff');
    }
    const li = this._lvl('linea');
    if (li) this.lineBlocks = SKILLS.linea.blocks(li);

    const isBoss = this.wave % 5 === 0;
    this.toSpawn = isBoss
      ? Math.floor(6 + this.wave * 0.25)
      : 4 + Math.floor(this.wave * 1.1);

    if (isBoss) {
      // El jefe lo dicta el BIOMA: cada uno tiene los suyos dos, el primero en
      // su quinta ola y el segundo en la decima. Antes salian barajados de una
      // bolsa comun y no habia forma de saber donde estabas.
      const id = bossFor(this.wave);
      this.lastBoss = id;
      this.banner = { t: 2, wave: this.wave, sub: BOSSES[id].announce, boss: true };
      // El jefe entra en cuanto acaba el aviso.
      this.bossPending = id;
      this.bossT = 1.6;
    } else if (!this.estrena) {
      this.banner = {
        t: 1.8, wave: this.wave,
        sub: WAVE_PHRASES[(this.rnd() * WAVE_PHRASES.length) | 0], boss: false,
      };
      this.bossPending = null;
    } else {
      this.banner = null;
      this.bossPending = null;
    }
    SFX.wave();
  },

  // Bolsa barajada: no repite jefe hasta que salieron todos.
  _pickBoss() {
    if (this.bossBag.length === 0) {
      this.bossBag = BOSS_IDS.slice();
      for (let i = this.bossBag.length - 1; i > 0; i--) {
        const j = (this.rnd() * (i + 1)) | 0;
        [this.bossBag[i], this.bossBag[j]] = [this.bossBag[j], this.bossBag[i]];
      }
    }
    return this.bossBag.pop();
  },

  _spawnFromPool() {
    // La mezcla = los comunes de siempre MAS los propios del bioma. El bioma
    // nunca quita enemigos, solo añade: si sustituyese la tropa, las olas
    // altas tendrian menos variedad que las bajas y el juego se volveria mas
    // facil segun avanza, justo al reves de lo que toca.
    //
    // Los propios van repetidos para que pesen mas que un comun cualquiera:
    // son los que tienen que dar color al tramo. Con una sola copia de cada
    // uno se perdian entre los siete comunes y el bioma no se notaba.
    const pool = poolForWave(this.wave).slice();
    const b = this.bioma;
    if (b) for (const id of b.own) { pool.push(id, id); }

    const id = pool[(this.rnd() * pool.length) | 0];
    this._spawn(id, ENEMIES[id]);
  },

  _spawn(id, def, x, y) {
    // Los jefes ganan vida con la ola; la tropa no (crece en numero, no en
    // dureza, que es como estaba equilibrado el juego original).
    const scale = 1 + Math.max(0, this.wave - 5) * RULES.bossHpPerWave;
    const e = {
      id, def,
      x: x !== undefined ? x : 24 + this.rnd() * (VW - 48),
      y: y !== undefined ? y : -20,
      hp: Math.ceil(def.hp * (def.boss ? scale : 1)),
      maxHp: Math.ceil(def.hp * (def.boss ? scale : 1)),
      speed: def.speed * (1 + (this.wave - 1) * 0.04),
      r: def.r,
      boss: !!def.boss,
      dead: false,
      t: this.rnd() * 6.28,
      baseX: 0,
      shootT: 1 + this.rnd() * 2,
      // Dash del RELAMPAGO.
      dashT: def.dash ? def.dash.every : 0,
      dashing: 0,
      // Estado de las habilidades de jefe.
      abT: def.cd || 0,
      invisible: false,
      invisT: def.visible || 0,
      phase2: false,
      summoned: {},
      hit: 0,
      // Golpes que aguanta el escudo del MURO antes de romperse.
      shield: def.shielded ? (def.shieldHp || 4) : 0,
      spawnT: 0.35,          // aparicion: crece desde pequenito
    };
    e.baseX = e.x;
    this.enemies.push(e);
    return e;
  },

  // ---------- Enemigos ----------
  _updateEnemies(dt, ctx) {
    // El aura del SILENCIO se recalcula cada frame; si no hay silencio activo
    // se apaga sola.
    this.silenced = false;

    // El jefe entra tras su aviso.
    if (this.bossPending) {
      this.bossT -= dt;
      if (this.bossT <= 0) {
        const id = this.bossPending;
        this.bossPending = null;
        // La vida del jefe la escala _spawn(); aqui solo se ajustan los puntos.
        // Antes se multiplicaba en los dos sitios y la RUTINA llegaba a 394 de
        // vida en la ola 50 en vez de 114: imposible de matar.
        const def = { ...BOSSES[id] };
        def.score = Math.floor(def.score * (1 + Math.max(0, this.wave - 5) * 0.04));
        this._spawn(id, def, VW / 2, -30);
        cam.shake(6, 0.5);
        // La musica sube de revoluciones en cuanto el jefe pisa la arena.
        playMusic(SONGS.survivalBoss);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.spawnT > 0) e.spawnT -= dt;
      if (e.hit > 0) e.hit -= dt;
      e.t += dt;

      if (e.boss) this._bossAbility(e, dt);

      // Movimiento.
      let mult = 1;
      if (e.def.dash) {
        if (e.dashing > 0) { e.dashing -= dt; mult = e.def.dash.mult; }
        else {
          e.dashT -= dt;
          if (e.dashT <= 0) { e.dashing = e.def.dash.dur; e.dashT = e.def.dash.every; }
        }
      }
      this._move(e, dt, mult);
      // Los jefes patrullan en una franja, sin bajar nunca a la linea: son un
      // duelo, no algo que se cuele. El techo son 62 px y no menos porque su
      // barra de vida vive arriba del todo y el dibujo (de hasta 62 px de lado)
      // se le montaba encima tapando el nombre.
      if (e.boss) {
        e.y = clamp(e.y, 62, 108);
        // Flotan despacio dentro de su franja, para que no queden clavados.
        e.y += Math.sin(e.t * 0.8) * 8 * dt;
      }

      // Kamikaze: cuando ya esta cerca de la linea, se lanza hacia Roma.
      if (e.def.kamikaze && e.y > VH * 0.45) {
        e.x += Math.sign(this.roma.x - e.x) * 26 * dt;
      }
      e.x = clamp(e.x, 14, VW - 14);

      // Disparo, con su aviso previo (el original lo llamaba telegraph).
      if (e.def.shoots && !e.invisible) {
        e.shootT -= dt;
        if (e.shootT <= 0) {
          this._enemyShoot(e);
          e.shootT = (1 / e.def.shoots) * (0.7 + this.rnd() * 0.8);
        }
      }

      // Cruzo la linea: Roma pierde una vida.
      if (e.y > LINE_Y) {
        // LA LINEA RESISTE: se come el cruce sin cobrar vida. El enemigo muere
        // igual (ya moria al cruzar); lo que cambia es que no duele.
        if (this.lineBlocks > 0) {
          this.lineBlocks--;
          this._killEnemy(e, i, this._lvl('linea') >= 3);
          this._float('LA LINEA AGUANTA', e.x, LINE_Y - 14, '#6bf0ff');
          cam.shake(3, 0.25);
          SFX.brick();
          continue;
        }
        this._killEnemy(e, i, false);
        const res = this._hurtRoma(ctx);
        this._float('-1', e.x, LINE_Y - 14, '#ff5c5c');
        // 'revive' vacia la lista de enemigos: hay que salir del bucle igual
        // que con 'dead', o se sigue recorriendo un array ya vaciado.
        if (res === 'dead' || res === 'revive') return;
        continue;
      }

      // Choco con Roma.
      if (Math.abs(e.x - this.roma.x) < e.r + 11 && Math.abs(e.y - ROMA_Y) < e.r + 11) {
        this._killEnemy(e, i, true);
        const res = this._hurtRoma(ctx);
        if (res === 'dead' || res === 'revive') return;
        continue;                 // `e` ya no esta en la lista: no seguir con el
      }
    }
  },

  _move(e, dt, mult) {
    const m = e.def.move;
    e.y += e.speed * mult * dt;
    if (m === 'zigzag') {
      e.x = e.baseX + Math.sin(e.t * 2.2) * 42;
    } else if (m === 'sine') {
      e.x = e.baseX + Math.sin(e.t * 1.5) * 60;
    }
    // El TRACKER se desliza hacia Roma sin prisa.
    if (e.def.tracks) {
      e.x += Math.sign(this.roma.x - e.x) * 22 * dt;
      e.baseX = e.x - Math.sin(e.t * 1.5) * 60;
    }
  },

  _enemyShoot(e) {
    const sp = RULES.enemyBulletSpeed;
    const n = e.def.burst || 1;
    for (let k = 0; k < n; k++) {
      let vx = 0, vy = sp;
      if (e.def.aims || e.boss) {
        const dx = this.roma.x - e.x, dy = ROMA_Y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        vx = dx / d * sp; vy = dy / d * sp;
      }
      // Una rafaga abre un poco el angulo de cada bala.
      if (n > 1) {
        const a = (k - (n - 1) / 2) * 0.26;
        const c = Math.cos(a), s = Math.sin(a);
        [vx, vy] = [vx * c - vy * s, vx * s + vy * c];
      }
      this.ebullets.push(mkEBullet(e.x, e.y + e.r * 0.6, vx, vy));
    }
    sfx({ type: 'saw', f0: 340, f1: 190, dur: 0.07, vol: 0.14 });
  },

  // ---------- Las diez habilidades de jefe ----------
  _bossAbility(e, dt) {
    switch (e.def.ability) {
      case 'fanShot':
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = e.def.cd;
          for (let i = -2; i <= 2; i++) this._angledShot(e, i * 0.26);
          this._float('RAFAGA', e.x, e.y - 26, '#ff4400');
        }
        break;

      case 'parallelLines':
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = e.def.cd;
          // Tres balas en fila, separadas en el tiempo.
          e.lineShots = 3; e.lineT = 0;
        }
        if (e.lineShots > 0) {
          e.lineT -= dt;
          if (e.lineT <= 0) {
            e.lineT = 0.25; e.lineShots--;
            for (const dx of [-26, 0, 26]) {
              this.ebullets.push(mkEBullet(e.x + dx, e.y, 0, RULES.enemyBulletSpeed));
            }
          }
        }
        break;

      case 'circleBurst':
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = e.def.cd;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const sp = RULES.enemyBulletSpeed;
            this.ebullets.push(mkEBullet(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp));
          }
          cam.shake(4, 0.3);
        }
        break;

      case 'summonDudas': {
        // Invoca dudas al bajar de cada umbral de vida.
        const pct = e.hp / e.maxHp;
        for (const th of [0.75, 0.5, 0.25]) {
          if (pct <= th && !e.summoned[th]) {
            e.summoned[th] = true;
            for (let i = 0; i < 3; i++) {
              this._spawn('duda', ENEMIES.duda, e.x + (i - 1) * 34, e.y + 16);
            }
            this._float('INVOCA DUDAS', e.x, e.y - 26, '#b98cff');
            cam.shake(3, 0.25);
            break;
          }
        }
        break;
      }

      case 'invisibility':
        e.invisT -= dt;
        if (e.invisT <= 0) {
          e.invisible = !e.invisible;
          e.invisT = e.invisible ? e.def.invisible : e.def.visible;
        }
        break;

      case 'silenceAura': {
        const d = Math.hypot(this.roma.x - e.x, ROMA_Y - e.y);
        if (d < e.def.aura) this.silenced = true;
        break;
      }

      case 'snakeMove':
        // Recorre la pantalla de lado a lado, como una serpiente.
        e.baseX = VW / 2 + Math.sin(e.t * 0.7) * (VW * 0.35);
        e.x += (e.baseX - e.x) * Math.min(1, 2.4 * dt);
        break;

      case 'rewindBullets':
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = e.def.cd;
          if (this.bullets.length > 0) {
            // Las balas de Roma se le vuelven en contra.
            for (const b of this.bullets) {
              b.vx = -b.vx; b.vy = -b.vy; b.hostile = true;
            }
            this._float('REWIND', e.x, e.y - 26, '#ff66ff');
            cam.shake(4, 0.3);
          }
        }
        break;

      case 'twoPhases':
        if (!e.phase2 && e.hp <= e.maxHp * 0.5) {
          e.phase2 = true;
          e.def = { ...e.def, shoots: e.def.shoots * 3 };
          e.speed *= 1.35;
          this._float('ENFURECIDO', e.x, e.y - 26, '#ff0044');
          cam.shake(6, 0.5);
        }
        break;

      case 'spawnClone':
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = e.def.cd;
          const clone = this._spawn('tracker', { ...ENEMIES.tracker, name: 'CLON', score: 100 },
                                    e.x, e.y + 18);
          clone.isClone = true;
          this._float('UN CLON', e.x, e.y - 26, '#ff8ad4');
        }
        break;
    }
  },

  _angledShot(e, ang) {
    const sp = RULES.enemyBulletSpeed;
    const dx = this.roma.x - e.x, dy = ROMA_Y - e.y;
    const base = Math.atan2(dy, dx) + ang;
    this.ebullets.push(mkEBullet(e.x, e.y, Math.cos(base) * sp, Math.sin(base) * sp));
  },

  // ---------- Balas de Roma ----------
  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;

      // Las balas REBOTAN en las paredes y el techo, como en el juego
      // original. No es un adorno: es lo unico que permite matar al MURO, que
      // para de frente todo lo que le sube. Un rebote lateral lo pilla por el
      // costado. Cada bala tiene un numero limitado de rebotes.
      if (!b.hostile && b.bounces > 0) {
        let rebota = false;
        if (b.x < 3) { b.x = 3; b.vx = Math.abs(b.vx); rebota = true; }
        else if (b.x > VW - 3) { b.x = VW - 3; b.vx = -Math.abs(b.vx); rebota = true; }
        if (b.y < 3) { b.y = 3; b.vy = Math.abs(b.vy); rebota = true; }
        if (rebota) {
          b.bounces--;
          // Al rebotar pierde algo de fuerza vertical y gana lateral: sin esto
          // una bala disparada recta rebotaria en el techo y volveria por el
          // mismo sitio, sin llegar nunca a los lados.
          if (Math.abs(b.vx) < 40) b.vx = (this.rnd() < 0.5 ? -1 : 1) * 90;
          // REBOTE N2: la bala rebotada pega mas fuerte, una sola vez. Asi el
          // tiro dificil (buscar la pared) es el que mas premia.
          if (b.reboteLvl >= 2 && !b.reforzada) { b.reforzada = true; b.dmg += 1; }
        }
      }

      if (b.y < -12 || b.y > VH + 12 || b.x < -12 || b.x > VW + 12 || b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Rewind del TIEMPO: la bala se volvio hostil y ahora puede herir a Roma.
      if (b.hostile) {
        if (Math.abs(b.x - this.roma.x) < 12 && Math.abs(b.y - ROMA_Y) < 12) {
          this.bullets.splice(i, 1);
          if (this._hurtRoma() === 'revive') return;   // revivir limpia la arena
          continue;
        }
        continue;                 // una bala revertida ya no daña enemigos
      }

      for (let k = this.enemies.length - 1; k >= 0; k--) {
        const e = this.enemies[k];
        if (e.dead || e.invisible) continue;      // la MENTIRA invisible no recibe daño
        if (Math.hypot(b.x - e.x, b.y - e.y) > e.r + 3) continue;

        // El escudo del MURO SE ROMPE a golpes: aguanta unos cuantos impactos
        // y despues cae, dejando al muro expuesto.
        //
        // Se probaron tres alternativas antes de esta y ninguna funcionaba,
        // porque Roma solo se mueve de lado y siempre queda DEBAJO del muro:
        // bloquear todo lo que sube lo hacia inmatable; dejar los costados al
        // aire no servia porque al apuntar se apunta al centro y la bala entra
        // igual por el centro; y con un solo rebote la bala nunca vuelve a
        // caerle encima. Romper el escudo si funciona y ademas se entiende
        // solo: se ve como se agrieta.
        if (e.shield > 0 && b.vy < 0) {
          e.shield--;
          e.hit = 0.12;
          this._float(e.shield > 0 ? 'BLOCK' : 'ESCUDO ROTO',
                      e.x, e.y - e.r - 6, e.shield > 0 ? '#6bf0ff' : '#ffe14d');
          if (e.shield === 0) {
            burst(e.x, e.y - e.r * 0.5, 10, {
              rnd: this.rnd, speed: 80, life: 0.4, size: 2, grav: 90,
              colors: ['#6bf0ff', '#ffffff'],
            });
            SFX.brick();
          }
          this.bullets.splice(i, 1);
          break;
        }
        // PERFORANTE: la bala sigue si MATA. Si el enemigo aguanta el disparo,
        // la bala se para igual: atravesar a un vivo la volveria un laser.
        const alive = this.enemies.length;
        this._damage(e, k, b.dmg);
        const murio = this.enemies.length < alive;

        if (murio && b.pierce > 0) {
          b.pierce--;
          // Sigue buscando a quien mas alcanzar en este mismo fotograma. El
          // bucle de enemigos va hacia atras, asi que al salir el muerto del
          // array los indices que quedan por mirar no se mueven.
          continue;
        }
        this.bullets.splice(i, 1);
        break;
      }
    }
  },

  _damage(e, idx, dmg) {
    e.hp -= dmg;
    e.hit = 0.12;
    // COMBO ARDIENTE: avisar en el fotograma EXACTO en que se encienden las
    // balas. Sin este aviso la habilidad se activaba en silencio y no habia
    // forma de saber que estaba funcionando.
    const ardiaAntes = this._ardiendo();
    this.combo++;
    this.comboT = 3;
    if (!ardiaAntes && this._ardiendo()) {
      this._float('EN LLAMAS', this.roma.x, ROMA_Y - 38, '#ffe14d');
      SFX.powerup();
      cam.shake(3, 0.2);
    }
    burst(e.x, e.y, 4, {
      rnd: this.rnd, speed: 60, life: 0.25, size: 2,
      colors: ['#ffffff', '#ff8ad4'],
    });
    SFX.hit();
    if (e.hp <= 0) this._killEnemy(e, idx, true);
  },

  _killEnemy(e, idx, scored) {
    if (e.dead) return;
    e.dead = true;
    this.enemies.splice(idx, 1);

    if (scored) {
      const mult = comboMult(this.combo);
      const pts = Math.floor(e.def.score * mult);
      this.score += pts;
      if (mult > 1) this._float('x' + mult, e.x, e.y - 18, '#ffe14d');
    }

    burst(e.x, e.y, e.boss ? 34 : 12, {
      rnd: this.rnd, speed: e.boss ? 150 : 90, life: 0.55, size: 2, grav: 60,
      colors: e.boss ? ['#ffe14d', '#ff5c9d', '#ffffff'] : ['#ff8ad4', '#ffffff'],
    });
    if (e.boss) {
      cam.shake(7, 0.6); SFX.explode();
      // Se acabo la pelea: vuelve el tema de las olas. Si el EGO dejo un clon
      // vivo la pelea sigue, asi que solo se cambia cuando no queda ningun jefe.
      if (!this.enemies.some(o => o.boss && !o.dead)) {
        playMusic(SONGS.survival);
        this._openPicker(e.def.name);
      }
    }
    else SFX.brick();

    // El DIVISOR se parte en dos al morir.
    if (e.def.splits && !e.isSplit) {
      for (let i = 0; i < e.def.splitCount; i++) {
        const c = this._spawn(e.def.splits, ENEMIES[e.def.splits],
                              e.x + (i ? 18 : -18), e.y);
        c.isSplit = true;
      }
    }

    // Suelta poderes. Un jefe suelta varios de golpe, repartidos en abanico:
    // es el premio de haber aguantado la pelea entera.
    const n = e.boss ? RULES.bossDropCount : (this.rnd() < RULES.dropChance ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const p = POWERUPS[(this.rnd() * POWERUPS.length) | 0];
      const off = n > 1 ? (i - (n - 1) / 2) * 26 : 0;
      this.drops.push({
        x: clamp(e.x + off, 14, VW - 14), y: e.y,
        vy: 58, type: p.type, color: p.color, t: 0,
      });
    }
  },

  // ---------- Balas enemigas ----------
  _updateEBullets(dt, ctx) {
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (b.y > VH + 12 || b.y < -12 || b.x < -12 || b.x > VW + 12) {
        this.ebullets.splice(i, 1);
        continue;
      }
      if (Math.abs(b.x - this.roma.x) < 11 && Math.abs(b.y - ROMA_Y) < 11) {
        this.ebullets.splice(i, 1);
        const res = this._hurtRoma(ctx);
        if (res === 'dead' || res === 'revive') return;
      }
    }
  },

  // ---------- Poderes que caen ----------
  _updateDrops(dt) {
    // IMAN: el radio se mira una vez por fotograma, no una por poder.
    const im = this._lvl('iman');
    const imR = im ? SKILLS.iman.range(im) : 0;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += d.vy * dt; d.t += dt;

      // Dentro del radio, el poder deja de caer y se va hacia Roma.
      if (im) {
        const dx = this.roma.x - d.x, dy = ROMA_Y - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < imR && dist > 0.5) {
          const pull = 210 * dt;
          d.x += (dx / dist) * pull;
          d.y += (dy / dist) * pull;
        }
      }

      if (d.y > VH + 14) { this.drops.splice(i, 1); continue; }
      // Se recogen con un area generosa: son un premio, no otro reto.
      if (Math.abs(d.x - this.roma.x) < 20 && Math.abs(d.y - ROMA_Y) < 20) {
        this.drops.splice(i, 1);
        this._grantPower(d.type);
      }
    }
  },

  // ---------- Roguelike: la pantalla de recompensa ----------
  _openPicker(bossName) {
    this.picks++;
    const cards = offerCards(this.picks, this.skills, this.rnd);
    // Si absolutamente todo esta al tope, no hay nada que ofrecer: la partida
    // sigue sin pantalla en vez de enseñar un panel vacio.
    if (cards.length === 0) return;
    this.picker = {
      cards, anim: 0, sel: -1, selT: 0,
      title: 'HAS VENCIDO A ' + bossName,
    };
    // Soltar los controles: si el dedo estaba disparando al morir el jefe, su
    // 'up' se lo traga la pantalla de eleccion y Roma se quedaria disparando
    // sola al volver al juego.
    this.fireId = null; this.firing = false; this.aiming = false;
    this.padId = null; this.padDX = 0;
    SFX.record();
  },

  _updatePicker(dt) {
    const p = this.picker;
    p.anim = Math.min(1.4, p.anim + dt * 1.6);
    // Ya elegida: el saltito de la carta y fuera.
    if (p.sel >= 0) {
      p.selT += dt * 3.2;
      if (p.selT >= 1) {
        this._takeSkill(p.cards[p.sel]);
        this.picker = null;
      }
    }
  },

  _takeSkill(card) {
    this.skills[card.id] = card.level;
    // El aviso sale a media altura y no donde estaban las cartas: ahi quedaria
    // flotando sobre un hueco vacio justo cuando la pantalla se cierra.
    this._float(card.skill.name + (card.level > 1 ? ' NIV ' + card.level : ''),
                VW / 2, VH * 0.52, card.rarity.color);
    SFX.powerup();
    vibrate(60);
  },

  // Nivel de una habilidad, o 0 si no se tiene. Es la puerta por la que pasan
  // TODOS los efectos: asi una habilidad que no se tiene no cuesta nada.
  _lvl(id) { return this.skills[id] || 0; },

  // MECHA CORTA acorta la recarga de la bomba.
  _bombCd() {
    const n = this._lvl('mecha');
    return n ? SKILLS.mecha.cooldown(n) : RULES.bombCooldown;
  },

  // ---------- Textos flotantes ----------
  _float(txt, x, y, col) {
    this.floats.push({ txt, x, y, col, t: 0.9 });
  },

  _updateFloats(dt) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t -= dt; f.y -= 18 * dt;
      if (f.t <= 0) this.floats.splice(i, 1);
    }
  },

  // ---------- La bomba ----------
  _useBomb() {
    if (!this.bomb.ready || this.over) return;
    this.bomb.ready = false;
    this.bomb.cd = this._bombCd();
    this.flash = 0.35;
    cam.shake(9, 0.5);
    vibrate(90);
    SFX.explode();
    // Mata todo lo que no sea jefe; a los jefes les hace un buen mordisco.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.boss) this._damage(e, i, 8);
      else this._killEnemy(e, i, true);
    }
    this.ebullets.length = 0;
  },

  // ---------- Controles ----------
  onInput(ev) {
    if (this.over) return;

    // Eligiendo recompensa: el toque elige carta y NO llega a los controles.
    // Si no, el mismo dedo que elige dispararia al soltar.
    if (this.picker) {
      if (ev.type === 'down' && this.picker.sel < 0) {
        const i = cardAt(ev.x, ev.y, VW);
        if (i >= 0 && i < this.picker.cards.length) {
          this.picker.sel = i;
          this.picker.selT = 0;
          SFX.select();
        }
      }
      return;
    }

    if (ev.type === 'down') {
      // Mitad derecha: disparar, o la bomba si cae en su boton.
      if (ev.x > VW * 0.5) {
        if (Math.hypot(ev.x - BOMB_X, ev.y - BOMB_Y) < BOMB_R + 14) {
          this._useBomb();
          return;
        }
        if (this.fireId === null) {
          this.fireId = ev.id;
          this.firing = true;
          // El apuntado nace donde cae el pulgar: desde ese punto se mide
          // hacia donde se arrastra. Empieza recto arriba.
          this.fireX = ev.x; this.fireY = ev.y;
          this.aim = -Math.PI / 2;
          this.aiming = false;
          // El primer toque dispara ya, sin esperar la cadencia.
          this.roma.lastShot = -99;
        }
        return;
      }
      // Mitad izquierda: la cruceta nace donde cae el pulgar.
      if (this.padId === null) {
        this.padId = ev.id;
        this.padX = ev.x;
        this.padDX = 0;
      }
      return;
    }

    if (ev.type === 'move') {
      if (ev.id === this.padId) {
        // Zona muerta de 4px para que un pulgar quieto no la arrastre sola.
        const d = ev.x - this.padX;
        this.padDX = Math.abs(d) < 4 ? 0 : clamp(d / 26, -1, 1);
        // El centro sigue al dedo si se aleja mucho: asi nunca topa.
        if (Math.abs(d) > 26) this.padX = ev.x - Math.sign(d) * 26;
        return;
      }
      if (ev.id === this.fireId) {
        // Apuntado: el angulo sale de cuanto se arrastro el pulgar desde donde
        // se apoyo. Con menos de 6 px no se considera apuntado (un pulgar
        // apretando nunca esta del todo quieto y el disparo bailaria solo).
        const dx = ev.x - this.fireX, dy = ev.y - this.fireY;
        const d = Math.hypot(dx, dy);
        if (d < 6) { this.aiming = false; this.aim = -Math.PI / 2; return; }
        this.aiming = true;
        // Solo se apunta hacia ARRIBA: disparar hacia abajo no sirve de nada
        // (los enemigos vienen de arriba) y con el pulgar es facil hacerlo sin
        // querer. El angulo se limita a +-75 grados de la vertical.
        let a = Math.atan2(dy, dx);
        const LIM = Math.PI * 75 / 180;
        const off = clamp(normalizar(a + Math.PI / 2), -LIM, LIM);
        this.aim = -Math.PI / 2 + off;
      }
      return;
    }

    if (ev.type === 'up') {
      if (ev.id === this.padId) { this.padId = null; this.padDX = 0; }
      if (ev.id === this.fireId) {
        this.fireId = null; this.firing = false; this.aiming = false;
        this.aim = -Math.PI / 2;
      }
    }
  },

  // ---------- Dibujado ----------
  draw(g) {
    this._drawBg(g);
    this._drawDrops(g);
    this._drawEnemies(g);
    this._drawBullets(g);
    this._drawAim(g);
    this._drawRoma(g);
    this._drawFloats(g);
    this._drawHUD(g);
    this._drawControls(g);
    if (this.banner) this._drawBanner(g);
    if (this.tutorial > 0 && this.wave <= 1 && !this.banner) this._drawTutorial(g);
    if (this.estrena > 0) this._drawBioma(g);
    if (this.picker) drawPicker(g, this.picker, VW, VH, this.t);
    if (this.over) this._drawOver(g);

    // Destello de la bomba, por encima de todo.
    if (this.flash > 0) {
      this.flash -= 1 / 60;
      g.fillStyle = 'rgba(255,245,251,' + Math.max(0, this.flash * 2).toFixed(2) + ')';
      g.fillRect(0, 0, VW, VH);
    }
  },

  _drawBg(g) {
    const bg = g.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#16082e');
    bg.addColorStop(0.6, '#0d0620');
    bg.addColorStop(1, '#1a0a26');
    g.fillStyle = bg;
    g.fillRect(0, 0, VW, VH);

    // El fondo propio del bioma va aqui: sobre el degradado y bajo la rejilla,
    // para que la rejilla siga leyendose como el suelo de la arena.
    if (this.bioma) drawBioma(g, this.bioma, VW, VH, this.t);

    // Rejilla en fuga: da profundidad sin costar casi nada.
    g.strokeStyle = 'rgba(120,60,180,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= VW; x += 40) { g.moveTo(x, 0); g.lineTo(x, LINE_Y); }
    for (let y = 0; y <= LINE_Y; y += 34) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();

    // La linea que Roma defiende: late despacio.
    const pulse = 0.55 + Math.sin(this.t * 2.4) * 0.2;
    g.strokeStyle = 'rgba(255,62,201,' + pulse.toFixed(2) + ')';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, LINE_Y); g.lineTo(VW, LINE_Y); g.stroke();
    const lg = g.createLinearGradient(0, LINE_Y, 0, VH);
    lg.addColorStop(0, 'rgba(255,62,201,0.18)');
    lg.addColorStop(1, 'rgba(255,62,201,0)');
    g.fillStyle = lg;
    g.fillRect(0, LINE_Y, VW, VH - LINE_Y);
  },

  _drawEnemies(g) {
    for (const e of this.enemies) {
      const s = A.sprite(e.id);
      // Al aparecer crecen desde pequenito, para que no salgan de golpe.
      let k = 1;
      if (e.spawnT > 0) k = 0.35 + (1 - e.spawnT / 0.35) * 0.65;
      const w = e.r * 2.4 * k, h = w;

      g.save();
      if (e.invisible) g.globalAlpha = 0.16;          // la MENTIRA, casi borrada
      if (e.hit > 0) {
        // Destello blanco al recibir un golpe.
        g.globalAlpha *= 1;
        g.drawImage(s, e.x - w / 2, e.y - h / 2, w, h);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.75;
        g.drawImage(s, e.x - w / 2, e.y - h / 2, w, h);
      } else {
        g.drawImage(s, e.x - w / 2, e.y - h / 2, w, h);
      }
      g.restore();

      // El escudo del MURO, dibujado aparte del cuerpo: se va apagando segun
      // recibe golpes, y asi se entiende sin leer nada que se puede romper.
      if (e.def.shielded && e.shield > 0) {
        const f = e.shield / (e.def.shieldHp || 4);
        g.strokeStyle = 'rgba(107,240,255,' + (0.35 + f * 0.5).toFixed(2) + ')';
        g.lineWidth = 1 + f * 2;
        g.beginPath();
        g.arc(e.x, e.y + 4, e.r + 6, Math.PI * 1.12, Math.PI * 1.88);
        g.stroke();
      }

      // El aura del SILENCIO, para que se vea donde no puedes disparar bien.
      if (e.def.ability === 'silenceAura') {
        g.strokeStyle = 'rgba(154,134,216,' + (0.25 + Math.sin(this.t * 3) * 0.1).toFixed(2) + ')';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(e.x, e.y, e.def.aura, 0, 7); g.stroke();
      }

      // Barra de vida de la tropa. La del jefe NO va aqui: va fija en el HUD,
      // porque un jefe patrulla pegado al techo y encima de el no queda sitio
      // ni para la barra ni para su nombre.
      if (e.maxHp > 1 && !e.boss && !e.invisible) {
        const bw = 26, bh = 2.5, by = e.y - e.r - 8;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(e.x - bw / 2, by, bw, bh);
        g.fillStyle = '#7de0d0';
        g.fillRect(e.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      }
    }
  },

  _drawBullets(g) {
    // Las de Roma.
    for (const b of this.bullets) {
      const col = b.hostile ? '#ff4444' : (b.mega ? '#ffe66d' : '#ff8ad4');
      g.fillStyle = col;
      if (b.mega) {
        g.beginPath(); g.arc(b.x, b.y, 4.5, 0, 7); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(b.x, b.y, 2, 0, 7); g.fill();
      } else {
        // Una bala que ya reboto va girada en su direccion: asi se ve que
        // ahora viaja en diagonal y puede pillar a un MURO por el costado.
        const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(ang);
        g.fillRect(-1.5, -6, 3, 9);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(-0.7, -5, 1.4, 5);
        g.restore();
      }
    }
    // Las enemigas: rombos, para no confundirlas con las de Roma.
    for (const b of this.ebullets) {
      // Halo: una bala enemiga tiene que verse venir sobre la rejilla del
      // fondo. Sin el, a 4 px se perdian entre las lineas.
      g.fillStyle = 'rgba(255,60,60,0.22)';
      g.beginPath(); g.arc(b.x, b.y, 7, 0, 7); g.fill();
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.t * 6);
      g.fillStyle = '#ff3b3b';
      g.fillRect(-4, -4, 8, 8);
      g.fillStyle = '#ffd0d0';
      g.fillRect(-1.8, -1.8, 3.6, 3.6);
      g.restore();
    }
  },

  _drawDrops(g) {
    for (const d of this.drops) {
      const bob = Math.sin(d.t * 6) * 2;
      g.save();
      g.translate(d.x, d.y + bob);
      // Halo del color del poder.
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
      gr.addColorStop(0, d.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.4;
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
      g.globalAlpha = 1;
      // Caja del poder.
      g.fillStyle = d.color;
      g.rotate(d.t * 1.6);
      g.fillRect(-6, -6, 12, 12);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(-3, -3, 6, 6);
      g.restore();
    }
  },

  // La linea de puntos que sale de Roma hacia donde apunta. Sin ella no hay
  // forma de saber por donde va a salir la bala hasta que sale.
  _drawAim(g) {
    if (!this.firing) return;
    const r = this.roma;
    const cx = Math.cos(this.aim), cy = Math.sin(this.aim);
    const col = this.aiming ? 'rgba(255,138,212,0.85)' : 'rgba(255,138,212,0.35)';
    g.fillStyle = col;
    for (let d = 20; d < 92; d += 9) {
      const k = 1 - d / 110;
      g.globalAlpha = k;
      g.fillRect(r.x + cx * d - 1.2, ROMA_Y + cy * d - 1.2, 2.4, 2.4);
    }
    g.globalAlpha = 1;
    // Punta de la mira, mas marcada cuando se esta apuntando de verdad.
    if (this.aiming) {
      g.strokeStyle = 'rgba(255,138,212,0.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(r.x + cx * 96, ROMA_Y + cy * 96, 4.5, 0, 7);
      g.stroke();
    }
  },

  _drawRoma(g) {
    const r = this.roma;
    // Parpadea mientras es invulnerable.
    if (r.inv > 0 && Math.sin(this.t * 30) < 0) return;

    let mode = 'normal';
    // `ardiendo` cuenta igual que el poder MEGA: si las balas estan potenciadas
    // hay que VERLO. Antes solo se miraba power.mega y COMBO ARDIENTE no
    // encendia nada: las balas triplicaban y en pantalla no cambiaba nada.
    if (this.power.mega > 0 || this._ardiendo()) mode = 'mega';
    else if (this.power.turbo > 0) mode = 'turbo';
    else if (this.power.shield > 0) mode = 'shield';
    else if (this.power.double > 0) mode = 'double';

    const s = A.roma(mode);
    const k = r.hurt > 0 ? 1.15 : 1;
    const w = 30 * k;
    g.drawImage(s, r.x - w / 2, ROMA_Y - w / 2, w, w);

    // Burbuja del escudo.
    if (this.power.shield > 0) {
      g.strokeStyle = 'rgba(107,240,255,' + (0.5 + Math.sin(this.t * 8) * 0.25).toFixed(2) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.arc(r.x, ROMA_Y, 20, 0, 7); g.stroke();
    }
    // Su nombre debajo, como en el original.
    textCenter(g, 'ROMA', r.x, ROMA_Y + 13, 'rgba(255,62,201,0.75)', 1);
  },

  _drawFloats(g) {
    for (const f of this.floats) {
      const a = Math.min(1, f.t / 0.4);
      g.globalAlpha = a;
      textCenter(g, f.txt, f.x, f.y, f.col, 1);
      g.globalAlpha = 1;
    }
  },

  // ---------- HUD ----------
  _drawHUD(g) {
    // Vidas: corazoncitos arriba a la izquierda.
    for (let i = 0; i < RULES.lives; i++) {
      const on = i < this.lives;
      drawMiniHeart(g, 12 + i * 13, 12, on ? '#ff3ec9' : 'rgba(90,74,136,0.5)');
    }
    // Ola y puntaje.
    text(g, 'OLA ' + Math.max(1, this.wave), 12, 24, '#6bf0ff', 1);
    const sc = String(this.score);
    text(g, sc, VW - measure(sc, 2) - 12, 10, '#ffffff', 2);

    // Combo, cuando esta vivo.
    if (this.combo >= 3) {
      const m = comboMult(this.combo);
      const txt = 'COMBO ' + this.combo + (m > 1 ? '  x' + m : '');
      // Con un jefe en pantalla el centro de arriba lo ocupan su nombre y su
      // barra, asi que el combo se va a la izquierda, bajo las vidas.
      if (this.enemies.some(e => e.boss)) {
        text(g, txt, 12, 38, m >= 3 ? '#ffe14d' : '#8a7ab8', 1);
      } else {
        textCenter(g, txt, VW / 2, 12, m >= 3 ? '#ffe14d' : '#8a7ab8', 1);
      }
    }

    // Poderes activos, en fila bajo el puntaje.
    let py = 26;
    for (const p of POWERUPS) {
      const left = this.power[p.type];
      if (left <= 0) continue;
      const w = measure(p.label, 1);
      text(g, p.label, VW - w - 12, py, p.color, 1);
      // Barrita que se vacia.
      const def = POWERUPS.find(q => q.type === p.type);
      g.fillStyle = p.color;
      g.globalAlpha = 0.5;
      g.fillRect(VW - w - 12, py + 9, w * (left / def.dur), 1.5);
      g.globalAlpha = 1;
      py += 14;
    }

    if (this.silenced) {
      textCenter(g, 'SILENCIADA', VW / 2, VH - 62, '#c9b6ff', 1);
    }

    // Barra del jefe: ancha, centrada arriba, con su nombre. Es la unica forma
    // de seguir cuanta vida le queda a algo que vive pegado al techo.
    const boss = this.enemies.find(e => e.boss);
    if (boss) {
      // Va ARRIBA, no abajo: abajo esta Roma con su nombre y la barra se le
      // montaba encima justo donde ella tiene que mirar para esquivar.
      const bw = 200, bx = VW / 2 - bw / 2, by = 26;
      textCenter(g, boss.def.name, VW / 2, by - 12,
                 boss.phase2 ? '#ff0044' : '#ffe14d', 1);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(bx - 1, by - 1, bw + 2, 7);
      const f = Math.max(0, boss.hp / boss.maxHp);
      const bg2 = g.createLinearGradient(bx, 0, bx + bw, 0);
      if (boss.phase2) { bg2.addColorStop(0, '#ff0044'); bg2.addColorStop(1, '#ff8a4d'); }
      else { bg2.addColorStop(0, '#ff3ec9'); bg2.addColorStop(1, '#ffe14d'); }
      g.fillStyle = bg2;
      g.fillRect(bx, by, bw * f, 5);
      g.strokeStyle = 'rgba(255,225,77,0.55)'; g.lineWidth = 1;
      g.strokeRect(bx - 0.5, by - 0.5, bw + 1, 6);
    }
  },

  // ---------- Los controles, dibujados ----------
  _drawControls(g) {
    g.save();
    g.globalAlpha = 0.5;

    // Cruceta: el aro base y, si hay dedo, el punto donde esta.
    g.strokeStyle = '#6bf0ff'; g.lineWidth = 2;
    g.beginPath(); g.arc(PAD_X, PAD_Y, PAD_R, 0, 7); g.stroke();
    // Flechitas a los lados del aro.
    g.fillStyle = '#6bf0ff';
    for (const s of [-1, 1]) {
      const ax = PAD_X + s * (PAD_R - 9);
      g.beginPath();
      g.moveTo(ax + s * 5, PAD_Y);
      g.lineTo(ax - s * 3, PAD_Y - 6);
      g.lineTo(ax - s * 3, PAD_Y + 6);
      g.fill();
    }
    if (this.padId !== null) {
      g.globalAlpha = 0.85;
      g.fillStyle = '#6bf0ff';
      g.beginPath();
      g.arc(PAD_X + this.padDX * (PAD_R - 8), PAD_Y, 10, 0, 7);
      g.fill();
      g.globalAlpha = 0.5;
    }

    // Boton de disparo.
    g.strokeStyle = '#ff3ec9'; g.lineWidth = 2;
    g.beginPath(); g.arc(FIRE_X, FIRE_Y, FIRE_R, 0, 7); g.stroke();
    if (this.firing) {
      g.globalAlpha = 0.5;
      g.fillStyle = '#ff3ec9';
      g.beginPath(); g.arc(FIRE_X, FIRE_Y, FIRE_R - 3, 0, 7); g.fill();
      // Aguja dentro del boton apuntando a donde saldra la bala: confirma el
      // gesto ahi donde esta el pulgar, sin tener que mirar a Roma.
      g.globalAlpha = 0.95;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(FIRE_X, FIRE_Y);
      g.lineTo(FIRE_X + Math.cos(this.aim) * (FIRE_R - 7),
               FIRE_Y + Math.sin(this.aim) * (FIRE_R - 7));
      g.stroke();
      g.globalAlpha = 0.5;
    }
    g.globalAlpha = 0.9;
    textCenter(g, 'FUEGO', FIRE_X, FIRE_Y - 3, '#ff8ad4', 1);
    g.globalAlpha = 0.5;

    // Boton de bomba: apagado mientras se recarga, con su cuenta atras.
    const ready = this.bomb.ready;
    g.strokeStyle = ready ? '#ffe14d' : 'rgba(120,110,90,0.8)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(BOMB_X, BOMB_Y, BOMB_R, 0, 7); g.stroke();
    if (!ready) {
      // Arco que se va cerrando segun se recarga.
      g.strokeStyle = 'rgba(255,225,77,0.55)';
      g.beginPath();
      g.arc(BOMB_X, BOMB_Y, BOMB_R, -Math.PI / 2,
            -Math.PI / 2 + (1 - this.bomb.cd / this._bombCd()) * Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.9;
    drawStar(g, BOMB_X, BOMB_Y, ready ? '#ffe14d' : 'rgba(140,130,100,0.8)');
    g.restore();
  },

  _drawBanner(g) {
    const b = this.banner;
    const a = Math.min(1, b.t / 0.4);
    g.globalAlpha = a;
    g.fillStyle = 'rgba(8,4,20,0.72)';
    g.fillRect(0, VH / 2 - 44, VW, 88);
    g.fillStyle = b.boss ? '#ff4400' : '#ff3ec9';
    g.fillRect(0, VH / 2 - 44, VW, 2);
    g.fillRect(0, VH / 2 + 42, VW, 2);
    textCenter(g, b.boss ? 'JEFE' : 'OLA ' + b.wave, VW / 2, VH / 2 - 32,
               b.boss ? '#ff4400' : '#ffe14d', 3);
    textCenter(g, b.sub, VW / 2, VH / 2 + 4, b.boss ? '#ffe14d' : '#5cffd8', 2);
    g.globalAlpha = 1;
  },

  // El cartel de entrada a un bioma. Es mas grande que el aviso de ola normal
  // porque marca un cambio de sitio, no una ola mas: nombre en grande y su
  // frase debajo, sobre dos barras del color del bioma.
  _drawBioma(g) {
    const b = this.bioma;
    // Entra y sale con un fundido; en medio se queda quieto para poder leerlo.
    const a = Math.min(1, Math.min(this.estrena, 2.6 - this.estrena) * 2.5);
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;

    const cy = VH * 0.38;
    g.fillStyle = 'rgba(6,3,16,0.78)';
    g.fillRect(0, cy - 30, VW, 62);
    // Dos filos del color del bioma, arriba y abajo del cartel.
    g.fillStyle = b.col[0];
    g.fillRect(0, cy - 30, VW, 2);
    g.fillStyle = b.col[1];
    g.fillRect(0, cy + 30, VW, 2);

    textCenter(g, b.name, VW / 2, cy - 20, b.col[0], 3);
    textCenter(g, b.sub, VW / 2, cy + 14, b.col[1], 1);
    g.restore();
  },

  _drawTutorial(g) {
    const a = Math.min(1, this.tutorial / 0.6);
    g.globalAlpha = a * 0.9;
    textCenter(g, 'PULGAR IZQUIERDO: MOVER', VW / 2, VH - 116, '#6bf0ff', 1);
    textCenter(g, 'PULGAR DERECHO: DISPARAR Y APUNTAR', VW / 2, VH - 102, '#ff8ad4', 1);
    textCenter(g, 'PROTEGE LA LINEA', VW / 2, VH - 86, '#ffe14d', 1);
    g.globalAlpha = 1;
  },

  _drawOver(g) {
    const a = Math.min(1, this.overT / 0.5);
    g.globalAlpha = a * 0.85;
    g.fillStyle = '#0d0620';
    g.fillRect(0, 0, VW, VH);
    g.globalAlpha = a;
    textCenter(g, this.msg[0], VW / 2, VH / 2 - 20, '#ff5c9d', 2);
    textCenter(g, this.msg[1], VW / 2, VH / 2 + 2, '#ff5c9d', 2);
    textCenter(g, 'OLA ' + this.wave + '   ' + this.score, VW / 2, VH / 2 + 32, '#8a7ab8', 2);
    g.globalAlpha = 1;
  },

  destroy() {
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.ebullets.length = 0;
    this.drops.length = 0;
    this.floats.length = 0;
  },
};

// ---------- Ayudas ----------
// Lleva un angulo al rango -PI..PI. Hace falta para medir cuanto se desvia el
// apuntado de la vertical sin que el salto de +PI a -PI lo mande al otro lado.
function normalizar(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function mkBullet(x, y, vx, vy, dmg, mega, pierce = 0) {
  // Una MEGA rebota mas veces: es el premio de haberla recogido.
  // `pierce` = cuantos enemigos MAS puede atravesar tras matar (PERFORANTE).
  return { x, y, vx, vy, dmg, mega, life: 3, hostile: false, bounces: mega ? 3 : 1, pierce };
}

function mkEBullet(x, y, vx, vy) {
  return { x, y, vx, vy, t: 0 };
}

// Un corazoncito para las vidas del HUD.
function drawMiniHeart(g, x, y, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x, y + 5);
  g.bezierCurveTo(x - 6, y - 1, x - 4.5, y - 6, x - 1.7, y - 6);
  g.bezierCurveTo(x - 0.6, y - 6, x, y - 4.5, x, y - 3.5);
  g.bezierCurveTo(x, y - 4.5, x + 0.6, y - 6, x + 1.7, y - 6);
  g.bezierCurveTo(x + 4.5, y - 6, x + 6, y - 1, x, y + 5);
  g.fill();
}

// La estrella del boton de bomba.
function drawStar(g, x, y, col) {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 4 : 9;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
