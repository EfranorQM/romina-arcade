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
import { pose, carga, mkCorpse, updateCorpse, posarCorpse } from './surv-anim.js';
import { drawPicker, cardAt } from './surv-cards.js';
import {
  drawControles, mkRastro, pasoRastro, BOMB_X, BOMB_Y, BOMB_R,
} from './surv-controles.js';
import { poseRoma, brilloRoma, alphaRoma, mkEstadoRoma, updateRoma } from './surv-roma.js';
import { bloom, bloomLibre } from '../bloom.js';

// Cuanta luz suma la pasada de neon. Medido comparando capturas de la MISMA
// escena a la resolucion del telefono (2400x1080), con el glow que sobresale
// del cuerpo y el contraste WCAG contra el fondo:
//
//   fuerza   glow fuera del cuerpo   HUECO     GRIETA    fondo vacio
//    0.45          +13 px          1.99->2.20  ->2.57      +1.09
//    0.70          +25 px          1.99->2.30  ->2.78      +1.16
//    1.00          +32 px          1.99->2.44  ->3.04      +1.49
//
// El fondo apenas se entera en ninguno de los tres (+1.1 niveles de luz sobre
// 255): el umbral hace su trabajo y el violeta oscuro no pasa.
//
// PERO la tabla de arriba solo mira el contraste CONTRA EL FONDO, y por eso se
// quedaba corta: lo que rompe el efecto es lo que le pasa al CUERPO. Medido en
// el centro de la DUDA y en sus ojos, capturando la misma escena con el mismo
// seed y variando solo la fuerza:
//
//   fuerza   centro del cuerpo    ojo           que se ve
//    0      (203,181,237)      (217,194,255)   sin neon
//    0.25   (227,200,255)      (242,219,255)   lila, con neon
//    0.40   (238,211,255)      (251,228,255)   lila, con neon   <- el limite
//    0.55   (247,223,255)      (255,237,255)   el ojo se satura
//    0.70   (255,233,255)      (255,243,255)   cuerpo y ojos BLANCOS
//
// A 0.70 la DUDA deja de ser lila y se queda sin cara: los ojos, que son lo que
// hace que se lea como criatura y no como mancha, se funden con la frente. Se
// gana neon y se pierde el personaje, que es justo lo contrario de lo que se
// buscaba. A 0.40 el resplandor se ve igual de bien y la cara sigue ahi.
const BRILLO = 0.4;

// ---------- Los controles tactiles ----------
// En apaisado los pulgares caen en las esquinas de abajo, asi que ahi van los
// controles: la mitad izquierda mueve y la derecha dispara. El area de cada uno
// es MUCHO mas grande que su dibujo, porque un pulgar no apunta fino.
// El DIBUJO de los controles vive en surv-controles.js, con sus medidas.
//
// Aqui no queda ninguna constante de tacto para mover y disparar, y no es un
// olvido: el reparto es por MITADES DE PANTALLA (ver onInput). Toda la mitad
// izquierda mueve y toda la derecha dispara, caiga el pulgar donde caiga, que
// es lo que hace que no haya que mirar los controles para usarlos. Lo unico que
// tiene un area propia es la bomba, porque esa si es un boton concreto dentro
// de la mitad derecha, y sus medidas las manda el modulo del dibujo para que el
// circulo que se ve y el que responde no puedan separarse nunca.

export default {
  meta: {
    id: 'survival', title: 'SURVIVAL', tag: 'DEFIENDE LA LINEA',
    colors: ['#ff3ec9', '#6bf0ff'],
    vw: VW, vh: VH, wide: true, smooth: true, ss: 2,
    // El boton de pausa va centrado arriba (pausa.js), y ahi se apilan tres
    // cosas de este juego: el combo (y 12..19), el nombre del jefe (y 14..21) y
    // su barra de vida (y 25..33), todas en _drawHUD(). Se baja el boton por
    // debajo de las tres.
    pausaY: 34,
  },

  init(ctx, args) {
    const rnd = this.rnd = makeRng((args && args.seed) >>> 0 || 1);

    // `px` es donde estaba Roma en el paso anterior: la mitad del trabajo de
    // la interpolacion. Nace ya puesta, o el primer frame la dibujaria
    // viniendo de la coordenada 0 (el borde izquierdo).
    this.roma = { x: VW / 2, px: VW / 2, inv: 0, lastShot: 0, hurt: 0 };
    // La vida de Roma: fase del latido y ladeo suavizado. Vive aqui y se mueve
    // en update(), nunca en draw(): lo que se actualiza al dibujar corre al
    // ritmo de la PANTALLA, y en un telefono de 120 Hz iria al doble.
    this.rst = mkEstadoRoma();
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
    this.corpses = [];        // los que acaban de morir, cayendo
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
    // El latido del boton de fuego (lo dibuja surv-controles.js). `latF` es la
    // fase 0..1 del ciclo del corazon; `fireKick` es el golpe que acusa cada
    // bala y que decae solo.
    this.latF = 0; this.fireKick = 0;
    // Las posiciones por las que ha pasado el cometa de la cruceta. Vive aqui,
    // y NO en el modulo del dibujo, porque es estado de ESTA partida.
    this.rastro = mkRastro();

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
    // Camara lenta: segundos que quedan de tiempo ralentizado. Solo la usa la
    // muerte de un jefe, y por eso se siente como un final y no como un tic.
    this.slow = 0;
    this.destroyed = false;
  },

  // ---------- Bucle ----------
  // ---------- LA FOTO DEL PASO ANTERIOR ----------
  // Antes de mover nada, cada cosa que se mueve guarda donde estaba. El
  // dibujado la usa para ensenarla A MEDIO CAMINO entre los dos ultimos pasos
  // de simulacion (ver draw y el alpha que manda main.js).
  //
  // Se hace AQUI, en un solo sitio, y no en cada _update*: asi no hay forma de
  // que una entidad nueva se quede sin foto por haberse olvidado un sitio. Las
  // que nacen DENTRO del paso se fotografian ellas mismas al nacer (mkBullet,
  // mkEBullet, _spawn y el drop), porque este bucle ya paso.
  //
  // Coste medido en la app real con 30 enemigos, 40 balas de Roma, 30 enemigas
  // y 6 drops (107 entidades): 0.0007 ms por paso. Son dos asignaciones por
  // entidad y nada mas. Con la interpolacion del dibujado incluida, el enfoque
  // entero cuesta 0.00012 ms por frame de los 16.67 disponibles: 0.0007%.
  _foto() {
    const r = this.roma;
    r.px = r.x;
    for (const e of this.enemies) { e.px = e.x; e.py = e.y; }
    for (const b of this.bullets) { b.px = b.x; b.py = b.y; }
    for (const b of this.ebullets) { b.px = b.x; b.py = b.y; }
    for (const d of this.drops) { d.px = d.x; d.py = d.y; }
    for (const c of this.corpses) { c.px = c.x; c.py = c.y; }
  },

  update(dt, ctx) {
    this._foto();
    // Camara lenta tras matar a un jefe: el golpe se ve entero. Baja el tiempo
    // a un tercio y vuelve sola.
    const dtReal = dt;
    if (this.slow > 0) {
      this.slow -= dt;
      dt *= 0.34;
    }
    this.t += dt;
    // El corazon del boton late mas rapido mientras ella dispara. Va con el dt
    // del JUEGO, asi que la camara lenta de un jefe tambien le frena el pulso,
    // igual que al corazon de Roma.
    this.latF = (this.latF + dt * (this.firing ? 1.9 : 1.0)) % 1;
    if (this.fireKick > 0) this.fireKick = Math.max(0, this.fireKick - dt * 6);
    // El rastro de la cruceta se apunta AQUI y no al dibujar: si corriese al
    // ritmo de la pantalla duraria la mitad en un telefono de 120 Hz.
    pasoRastro(this.rastro, this.padDX);
    if (this.shake > 0) this.shake -= dt;
    if (this.tutorial > 0) this.tutorial -= dt;

    // El destello de la bomba y de la muerte del jefe. Baja en tiempo REAL, no
    // en el ralentizado: salta justo al morir un jefe, o sea en plena camara
    // lenta, y con el dt frenado duraria 1.2 s en vez de los 0.4 medidos. Y va
    // ANTES del early return del picker, que se abre en ese mismo instante:
    // si no, el destello se quedaria congelado tapando las cartas.
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dtReal);

    if (this.over) {
      this.overT += dt;
      this._updateFloats(dt);
      if (this.overT > 1.6) ctx.gameOver(this.score);
      return;
    }

    // Eligiendo recompensa: el juego se queda quieto detras. Sin cuenta atras a
    // proposito, que pueda leer las tres cartas con calma.
    // La pantalla de recompensa va a tiempo REAL: se abre justo al morir el
    // jefe, o sea en plena camara lenta, y las cartas entrarian arrastrandose.
    if (this.picker) { this._updatePicker(dtReal); return; }

    this._updateRoma(dt);
    this._updatePowers(dt);
    this._updateWave(dt);
    this._updateEnemies(dt, ctx);
    this._updateBullets(dt);
    this._updateEBullets(dt, ctx);
    this._updateDrops(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      if (!updateCorpse(this.corpses[i], dt)) this.corpses.splice(i, 1);
    }
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
    // El latido, el ladeo y la cadencia. Con el dt del JUEGO, asi que la camara
    // lenta al matar un jefe tambien le frena el corazon, que es lo que toca.
    updateRoma(this, this.rst, dt);

    // Disparo. El SILENCIO duplica el tiempo entre tiros si estas en su aura.
    if (this.firing) {
      const cd = this._cadencia();
      if (this.t - r.lastShot >= cd) {
        r.lastShot = this.t;
        this._fire();
      }
    }
  },

  // Cada cuanto puede disparar Roma ahora mismo, en segundos. Vive en un solo
  // sitio porque lo consultan el disparo Y la animacion: el retroceso del
  // corazon tiene que durar menos que el intervalo entre tiros, o con TURBO y
  // REFLEJO 3 (30 tiros por segundo) se solaparia y ella se quedaria encogida.
  _cadencia() {
    let cd = this.power.turbo > 0 ? RULES.turboCooldown : RULES.shotCooldown;
    // REFLEJO: dispara mas seguido. Se aplica tambien sobre el TURBO, que ya
    // es rapido de por si: las dos cosas juntas son una build valida.
    const rf = this._lvl('reflejo');
    if (rf) cd /= SKILLS.reflejo.rate(rf);
    if (this.silenced) cd *= 2;
    return cd;
  },

  // COMBO ARDIENTE: si la racha actual ya enciende las balas. Lo consultan el
  // disparo Y el dibujo, asi que vive en un solo sitio.
  _ardiendo() {
    const ar = this._lvl('ardiente');
    return ar > 0 && this.combo >= SKILLS.ardiente.at(ar);
  },

  _fire() {
    const r = this.roma;
    // El corazon del boton acusa la bala: es lo que se siente bajo el pulgar.
    this.fireKick = 1;
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
    // Cada bioma suena distinto. Solo se cambia si de verdad cambio el tramo y
    // no hay un jefe en la arena: en plena pelea manda el tema del jefe.
    if (this.bioma !== antes && !this.enemies.some(e => e.boss)) {
      playMusic(SONGS[this.bioma.song] || SONGS.survival);
    }
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
    // La tropa endurece aparte de los jefes: mas tarde y mucho mas despacio.
    const tScale = 1 + Math.max(0, this.wave - RULES.troopHpFromWave) * RULES.troopHpPerWave;
    const e = {
      id, def,
      x: x !== undefined ? x : 24 + this.rnd() * (VW - 48),
      y: y !== undefined ? y : -20,
      hp: Math.ceil(def.hp * (def.boss ? scale : tScale)),
      maxHp: Math.ceil(def.hp * (def.boss ? scale : tScale)),
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
    // La foto del paso anterior, ya puesta al nacer. Un enemigo creado A MITAD
    // del paso (los que invoca el MIEDO, los dos trozos del DIVISOR, el clon
    // del EGO) no paso por _foto este paso: sin esto el dibujo lo interpolaria
    // desde `undefined` y saldria en NaN, o desde (0,0) y entraria cruzando la
    // pantalla en diagonal.
    e.px = e.x; e.py = e.y;
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

      // La velocidad lateral REAL del frame, ya con el kamikaze y el clamp
      // aplicados: calcularla dentro de _move se perdia el desvio del kamikaze,
      // y justo los que embisten son los que mas se tienen que ver ladear.
      // Media movil porque el valor crudo salta y el ladeo temblaria.
      const vxr = dt > 0 ? (e.x - e._x0) / dt : 0;
      e.vx = (e.vx || 0) * 0.8 + vxr * 0.2;

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
    // De donde venia, para saber a que velocidad se desplaza de lado. La
    // animacion lo usa para ladearlo hacia donde va, y sale bien para CUALQUIER
    // movimiento (incluido el kamikaze y el del TRACKER) sin conocer los casos.
    const x0 = e.x;
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
    e._x0 = x0;              // lo consume el bucle, tras el kamikaze y el clamp
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
          // La foto se muda a la pared. Sin esto, la bala que rebota tiene su
          // posicion anterior AL OTRO LADO del punto de rebote, y el dibujo
          // interpolado la ensena cruzando la pared por dentro: durante un
          // frame la bala esta fuera de la arena. Al fijar px/py en el punto ya
          // corregido, el frame intermedio sale entre la pared y la posicion
          // nueva, que es por donde de verdad va.
          b.px = b.x; b.py = b.y;
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
    // Deja un cuerpo que sale despedido y se aplasta: desaparecer de golpe no
    // se siente como matar algo. Dura medio segundo (el doble en un jefe).
    if (e.spawnT <= 0) this.corpses.push(mkCorpse(e, this.rnd));

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
      cam.shake(9, 0.8); SFX.explode();
      // La muerte de un jefe no es un burst y ya: el tiempo se frena, la
      // pantalla destella y la explosion llega en tres oleadas. Es el momento
      // que ella va a recordar de cada pelea, asi que se le da su medio segundo.
      this.slow = 0.5;
      this.flash = 0.4;
      for (const [espera, n, vel, col] of [
        [120, 22, 190, ['#ffffff', '#ffe14d']],
        [260, 26, 130, ['#ff5c9d', '#ffe14d']],
        [430, 18, 90,  ['#ff3ec9', '#ffffff']],
      ]) {
        setTimeout(() => {
          if (this.destroyed) return;
          burst(e.x, e.y, n, {
            rnd: this.rnd, speed: vel, life: 0.7, size: 2, grav: 40, colors: col,
          });
          cam.shake(4, 0.3);
        }, espera);
      }
      // Se acabo la pelea: vuelve el tema de las olas. Si el EGO dejo un clon
      // vivo la pelea sigue, asi que solo se cambia cuando no queda ningun jefe.
      if (!this.enemies.some(o => o.boss && !o.dead)) {
        // Vuelve el tema DEL BIOMA en el que esta, no el de la primera ola.
        playMusic(SONGS[(this.bioma && this.bioma.song) || 'survival'] || SONGS.survival);
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
      const dx0 = clamp(e.x + off, 14, VW - 14);
      this.drops.push({
        x: dx0, y: e.y, px: dx0, py: e.y,
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
        // se apoyo. Con menos de 4 px no se considera apuntado (un pulgar
        // apretando nunca esta del todo quieto y el disparo bailaria solo).
        //
        // La zona muerta mide el arrastre LATERAL, no la distancia total. Antes
        // miraba la hipotenusa, y por eso bajar el pulgar en recto (que no
        // cambia el angulo ni un grado) ya encendia la mira de "apuntando".
        const dx = ev.x - this.fireX;
        if (Math.abs(dx) < 4) { this.aiming = false; this.aim = -Math.PI / 2; return; }
        this.aiming = true;
        // Solo se apunta hacia ARRIBA: disparar hacia abajo no sirve de nada
        // (los enemigos vienen de arriba) y con el pulgar es facil hacerlo sin
        // querer. Pero el limite tiene que dejar llegar al PEOR CASO REAL, que
        // es un enemigo en el borde contrario justo encima de la linea:
        //
        //   Roma esta limitada a x 16..584 y dispara desde y=242; la linea que
        //   defiende esta en y=226. Roma en un borde, enemigo en el otro:
        //     dx = 568, dy = 16  ->  atan2(568,16) = 88.4 grados de la vertical
        //
        // Con el limite viejo de 75 grados ese tiro era IMPOSIBLE: la bala sube
        // 54 px en los primeros 200 px de recorrido y 107 px en 400, o sea que
        // pasaba muy por encima del enemigo y se iba por el techo. Es justo lo
        // que se notaba jugando: de lejos, contra alguien pegado al borde, no
        // habia manera de acertar.
        //
        // A 89 grados la bala cruza los 520 px de ancho subiendo solo 9 px y
        // llega a la altura de la linea, que es donde esta el enemigo. Los 89
        // (y no 90) dejan un grado de margen para que nunca salga horizontal
        // pura ni pueda cruzar hacia abajo.
        const LIM = Math.PI * 89 / 180;
        // El angulo NO sale ya del arrastre crudo. Un pulgar apoyado en el
        // boton tiene sitio para arrastrar unos 44 px antes de salirse del
        // lienzo, y para pedir 88 grados con el gesto crudo habria que
        // arrastrar casi en horizontal muchisimo mas de lo que cabe: por eso
        // los angulos rasantes no se alcanzaban ni subiendo el limite.
        //
        // Se amplifica el gesto: todo el abanico se reparte en un arrastre
        // lateral de +-38 px, que si cabe bajo el pulgar.
        //
        // La curva es CUBICA a proposito, y eso la hace mas precisa que el
        // gesto viejo donde mas se usa. Grados de apuntado segun el arrastre:
        //
        //   arrastre     5px    10px    20px    32px    38px
        //   viejo        14      27      45      ~70     75 (tope)
        //   nuevo         3       7      20       59     89
        //
        // O sea: en los tiros normales (casi verticales, que son casi todos) el
        // nuevo se mueve la mitad por px y se apunta mas fino, y solo cuando de
        // verdad estiras el pulgar al final del recorrido se abre hasta lo
        // rasante. Antes era al reves: sensible donde estorba y topado donde
        // hacia falta.
        const R = 38;
        const t = clamp(dx / R, -1, 1);
        const m = Math.abs(t);
        const off = Math.sign(t) * (m * m * m * 0.75 + m * 0.25) * LIM;
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
  // `alpha` = cuanto de un paso de simulacion ha pasado ya (0 a 1). Lo manda
  // main.js como tercer argumento. Con el, cada frame de pantalla ensena las
  // cosas A MEDIO CAMINO entre los dos ultimos pasos, en vez de repetir el
  // ultimo: a 120 Hz eso son la mitad de los frames que dejan de ser copias.
  //
  // La guarda no es cosmetica. Esta misma draw la llaman tools/ (ver.js, las
  // paginas de prueba) con un solo argumento, y SURVIVAL es el unico de los
  // seis juegos cuya draw no recibia ctx: si alpha llegase `undefined`,
  // px + (x-px)*undefined es NaN y no se dibujaria absolutamente nada.
  draw(g, ctx, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    // Con el juego parado no hay nada que interpolar, y ademas hay estados en
    // los que la simulacion NO avanza aunque el bucle siga llamando a draw: la
    // pantalla de cartas y el fin de partida. Ahi el alpha del acumulador
    // seguiria subiendo y bajando y todo vibraria en el sitio.
    this._a = (this.picker || this.over) ? 1 : a;
    this._drawBg(g);
    this._drawDrops(g);
    this._drawCorpses(g);        // los muertos, por debajo de los vivos
    this._drawEnemies(g);
    this._drawBullets(g);
    this._drawAim(g);
    this._drawRoma(g);

    // EL NEON. Aqui, y no antes ni despues, por dos motivos medidos:
    //
    //  - Va DESPUES del mundo (fondo, criaturas, balas, Roma) para que todo lo
    //    que brilla ya este dibujado: el resplandor se saca del frame entero de
    //    una sola pasada, no criatura a criatura.
    //  - Va ANTES del HUD, los controles, los carteles y el picker de cartas.
    //    Esos son interfaz y tienen que leerse nitidos; un texto que florece se
    //    vuelve ilegible, y la barra de vida del jefe dejaria de medirse bien.
    //
    // Los numeritos flotantes (_drawFloats) tambien se quedan fuera: son texto.
    bloom(g, BRILLO);

    this._drawFloats(g);
    this._drawHUD(g);
    this._drawControls(g);
    if (this.banner) this._drawBanner(g);
    if (this.tutorial > 0 && this.wave <= 1 && !this.banner) this._drawTutorial(g);
    if (this.estrena > 0) this._drawBioma(g);
    if (this.picker) drawPicker(g, this.picker, VW, VH, this.t);
    if (this.over) this._drawOver(g);

    // Destello de la bomba, por encima de todo. SOLO SE DIBUJA aqui: el
    // contador baja en update(), que es donde vive el tiempo.
    //
    // Antes bajaba aqui mismo, restando 1/60 por FRAME DIBUJADO. Eso ya estaba
    // mal y no se habia visto: en un telefono de 120 Hz se dibujan 120 frames
    // por segundo, asi que el destello de matar a un jefe -- el momento mas
    // vistoso del juego -- se apagaba al DOBLE de velocidad, en 0.2 s en vez de
    // los 0.4 medidos. Y en la pantalla de cartas, donde update() vuelve antes
    // de tiempo pero draw() se sigue llamando, se apagaba igual.
    if (this.flash > 0) {
      g.fillStyle = 'rgba(255,245,251,' + Math.max(0, this.flash * 2).toFixed(2) + ')';
      g.fillRect(0, 0, VW, VH);
    }
  },

  _drawBg(g) {
    const b = this.bioma;
    // El cielo lo pone el bioma: es lo que hace que cambie la ARENA entera y no
    // solo el fondo animado de encima. El violeta original es el de LA DUDA.
    const sky = (b && b.sky) || ['#16082e', '#0d0620', '#1a0a26'];
    const bg = g.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, sky[0]);
    bg.addColorStop(0.6, sky[1]);
    bg.addColorStop(1, sky[2]);
    g.fillStyle = bg;
    g.fillRect(0, 0, VW, VH);

    // El fondo propio del bioma va aqui: sobre el degradado y bajo la rejilla,
    // para que la rejilla siga leyendose como el suelo de la arena.
    if (b) drawBioma(g, b, VW, VH, this.t);

    // Rejilla en fuga: da profundidad sin costar casi nada. Se tiñe del bioma.
    g.strokeStyle = 'rgba(' + ((b && b.grid) || '120,60,180') + ',0.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= VW; x += 40) { g.moveTo(x, 0); g.lineTo(x, LINE_Y); }
    for (let y = 0; y <= LINE_Y; y += 34) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();

    // La linea que Roma defiende: late despacio. Se queda ROSA en los cinco
    // biomas a proposito — es lo suyo, lo unico que no cambia de sitio a sitio,
    // y teñirla de cada bioma le quitaria justo eso.
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

  _drawCorpses(g) {
    const a = this._a;
    for (const c of this.corpses) {
      const p = posarCorpse(c);
      const cs = A.sprite(c.sprite);
      const w = c.r * 2.4 * A.factor(cs);
      g.save();
      g.globalAlpha = p.alpha;
      // Los cadaveres salen despedidos a 60 px/s de lado y caen con gravedad:
      // van igual de rapido que la tropa y se interpolan igual. `px` lo pone
      // _foto(); mkCorpse los crea con el mismo x/y del enemigo que murio.
      g.translate(c.px + (c.x - c.px) * a, c.py + (c.y - c.py) * a);
      g.rotate(p.rot);
      g.scale(p.sx, p.sy);
      g.drawImage(cs, -w / 2, -w / 2, w, w);
      g.restore();
    }
  },

  _drawEnemies(g) {
    const a = this._a;
    for (const e of this.enemies) {
      // LA POSICION DIBUJADA, calculada UNA sola vez por enemigo.
      //
      // Esto es lo que mas facil era hacer mal. Cada criatura usa su posicion
      // en CINCO sitios distintos de este bucle: el cuerpo, el anillo de carga
      // del jefe, el escudo del MURO, el aura del SILENCIO y la barra de vida.
      // Si el cuerpo se interpolase y los adornos no, el escudo y la barra se
      // quedarian clavados donde el enemigo estuvo el ultimo paso simulado y
      // se DESPEGARIAN del cuerpo hasta 3 px virtuales (12 px fisicos en el
      // telefono). Por eso ex/ey se calculan aqui arriba y a partir de este
      // punto nadie vuelve a leer e.x ni e.y para dibujar.
      const ex = e.px + (e.x - e.px) * a, ey = e.py + (e.y - e.py) * a;
      const s = A.sprite(e.id);
      // Al aparecer crecen desde pequenito, para que no salgan de golpe.
      let k = 1;
      if (e.spawnT > 0) k = 0.35 + (1 - e.spawnT / 0.35) * 0.65;
      // LAMINA corrige que la lamina horneada ahora sea mas grande que la
      // figura: sin ese factor el CUERPO encogeria, porque `w` mide la lamina
      // entera y no la criatura. Con el, el cuerpo mide exactamente lo mismo
      // que antes (medido: 10.7 px de radio en la DUDA, igual que con la
      // lamina de 64) y lo que crece es solo el sitio del glow.
      const w = e.r * 2.4 * A.factor(s) * k, h = w;

      // Como toca dibujarla AHORA: respira, se ladea hacia donde va, se estira
      // al embestir y se aplasta al recibir. Todo son transformaciones sobre la
      // misma lamina horneada; ver surv-anim.js.
      const po = pose(e);

      g.save();
      g.translate(ex, ey);
      if (po.rot) g.rotate(po.rot);
      g.scale(po.sx, po.sy);

      if (e.invisible) g.globalAlpha = 0.16;          // la MENTIRA, casi borrada
      if (e.hit > 0) {
        // Destello blanco al recibir un golpe.
        g.drawImage(s, -w / 2, -h / 2, w, h);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.75;
        g.drawImage(s, -w / 2, -h / 2, w, h);
      } else {
        g.drawImage(s, -w / 2, -h / 2, w, h);
      }
      g.restore();

      // Los jefes AVISAN antes de soltar su habilidad: un anillo que se cierra
      // a su alrededor mientras se hinchan. Sin esto un jefe es una bolsa de
      // vida que dispara cuando quiere; con esto se puede aprender a leer.
      if (e.boss) {
        const c = carga(e);
        if (c > 0) {
          g.save();
          g.globalAlpha = 0.25 + c * 0.5;
          g.strokeStyle = e.phase2 ? '#ff4d4d' : '#ffe14d';
          g.lineWidth = 1 + c * 2;
          g.beginPath();
          g.arc(ex, ey, e.r + 16 - c * 12, 0, 7);
          g.stroke();
          g.restore();
        }
      }

      // El escudo del MURO, dibujado aparte del cuerpo: se va apagando segun
      // recibe golpes, y asi se entiende sin leer nada que se puede romper.
      if (e.def.shielded && e.shield > 0) {
        const f = e.shield / (e.def.shieldHp || 4);
        g.strokeStyle = 'rgba(107,240,255,' + (0.35 + f * 0.5).toFixed(2) + ')';
        g.lineWidth = 1 + f * 2;
        g.beginPath();
        g.arc(ex, ey + 4, e.r + 6, Math.PI * 1.12, Math.PI * 1.88);
        g.stroke();
      }

      // El aura del SILENCIO, para que se vea donde no puedes disparar bien.
      if (e.def.ability === 'silenceAura') {
        g.strokeStyle = 'rgba(154,134,216,' + (0.25 + Math.sin(this.t * 3) * 0.1).toFixed(2) + ')';
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(ex, ey, e.def.aura, 0, 7); g.stroke();
      }

      // Barra de vida de la tropa. La del jefe NO va aqui: va fija en el HUD,
      // porque un jefe patrulla pegado al techo y encima de el no queda sitio
      // ni para la barra ni para su nombre.
      if (e.maxHp > 1 && !e.boss && !e.invisible) {
        const bw = 26, bh = 2.5, by = ey - e.r - 8;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(ex - bw / 2, by, bw, bh);
        g.fillStyle = '#7de0d0';
        g.fillRect(ex - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      }
    }
  },

  _drawBullets(g) {
    const a = this._a;
    // Las de Roma. Son lo que MAS gana con la interpolacion: a 330 px/s cada
    // paso las adelanta 5.5 px virtuales, que en el telefono son 21.45 fisicos
    // de golpe. Es el salto mas grande de toda la pantalla.
    for (const b of this.bullets) {
      const bx = b.px + (b.x - b.px) * a, by = b.py + (b.y - b.py) * a;
      const col = b.hostile ? '#ff4444' : (b.mega ? '#ffe66d' : '#ff8ad4');
      g.fillStyle = col;
      if (b.mega) {
        g.beginPath(); g.arc(bx, by, 4.5, 0, 7); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(bx, by, 2, 0, 7); g.fill();
      } else {
        // Una bala que ya reboto va girada en su direccion: asi se ve que
        // ahora viaja en diagonal y puede pillar a un MURO por el costado.
        const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        g.save();
        g.translate(bx, by);
        g.rotate(ang);
        g.fillRect(-1.5, -6, 3, 9);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(-0.7, -5, 1.4, 5);
        g.restore();
      }
    }
    // Las enemigas: rombos, para no confundirlas con las de Roma.
    for (const b of this.ebullets) {
      const bx = b.px + (b.x - b.px) * a, by = b.py + (b.y - b.py) * a;
      // Halo: una bala enemiga tiene que verse venir sobre la rejilla del
      // fondo. Sin el, a 4 px se perdian entre las lineas. Va en la MISMA
      // posicion interpolada que el rombo, o el rombo se saldria del halo.
      g.fillStyle = 'rgba(255,60,60,0.22)';
      g.beginPath(); g.arc(bx, by, 7, 0, 7); g.fill();
      g.save();
      g.translate(bx, by);
      g.rotate(b.t * 6);
      g.fillStyle = '#ff3b3b';
      g.fillRect(-4, -4, 8, 8);
      g.fillStyle = '#ffd0d0';
      g.fillRect(-1.8, -1.8, 3.6, 3.6);
      g.restore();
    }
  },

  _drawDrops(g) {
    const a = this._a;
    for (const d of this.drops) {
      const bob = Math.sin(d.t * 6) * 2;
      g.save();
      // El IMAN los tira hacia Roma a 210 px/s, mas rapido que la propia Roma:
      // sin interpolar, el tramo final del poder volando hacia ella era un
      // tiron a saltos.
      g.translate(d.px + (d.x - d.px) * a, d.py + (d.y - d.py) * a + bob);
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
    // La mira sale de Roma, asi que tiene que salir de la MISMA Roma que se
    // dibuja. Si la mira partiese de r.x crudo y el cuerpo de la interpolada,
    // la linea de puntos se despegaria del personaje hasta 3.2 px virtuales
    // moviendose a tope: 12.35 px fisicos en el telefono, mas de un tercio del
    // ancho de Roma. Es el fallo que mas se veria de los siete.
    const rx = this._romaX();
    const cx = Math.cos(this.aim), cy = Math.sin(this.aim);
    const col = this.aiming ? 'rgba(255,138,212,0.85)' : 'rgba(255,138,212,0.35)';
    g.fillStyle = col;

    // HASTA DONDE LLEGA LA MIRA. Quieta se queda corta a proposito (no estorba
    // la vista), pero APUNTANDO sigue la bala hasta donde vaya a morir: contra
    // el techo o contra el borde lateral, lo que pase antes.
    //
    // Antes moria siempre a 96 px y ese era el fallo que se sentia jugando. En
    // un tiro rasante (que ahora llega a 89 grados) el enemigo puede estar a
    // 568 px de distancia, o sea que la mira se paraba a la sexta parte del
    // camino: por ahi no habia forma de saber si ibas a acertar o a pasarle por
    // encima, que es justo lo que el describio como "no puedo dispararle de
    // forma precisa". La bala viaja recta y sin gravedad, asi que la mira puede
    // decir la verdad entera sin simular nada.
    let largo = 96;
    if (this.aiming) {
      // Cuanto falta para el techo y para el borde hacia el que va. El +-3 es
      // el mismo margen con el que mueren las balas (ver _updateBullets).
      const tTecho = cy < -0.001 ? (ROMA_Y - 3) / -cy : 1e9;
      const tLado = cx > 0.001 ? (VW - 3 - rx) / cx
                  : cx < -0.001 ? (rx - 3) / -cx : 1e9;
      largo = Math.min(tTecho, tLado);
    }

    // Los puntos se separan mas segun se alejan: asi una mira de 600 px no
    // cuesta 60 rectangulos ni se lee como una linea continua que tape el
    // campo. Van de 20 en adelante y se apagan con la distancia.
    for (let d = 20, paso = 9; d < largo; d += paso, paso += 0.55) {
      g.globalAlpha = Math.max(0.12, 1 - d / (largo + 40));
      g.fillRect(rx + cx * d - 1.2, ROMA_Y + cy * d - 1.2, 2.4, 2.4);
    }
    g.globalAlpha = 1;
    // Punta de la mira, mas marcada cuando se esta apuntando de verdad. Va
    // donde de verdad acaba el recorrido, no a 96 px fijos.
    if (this.aiming) {
      g.strokeStyle = 'rgba(255,138,212,0.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(rx + cx * largo, ROMA_Y + cy * largo, 4.5, 0, 7);
      g.stroke();
    }
  },

  // Donde se dibuja Roma este frame. Vive aparte porque la usan el cuerpo Y la
  // mira, y las dos tienen que partir del mismo sitio (ver _drawAim). Roma solo
  // se mueve de lado: ROMA_Y es constante y no hay nada que interpolar en Y.
  _romaX() {
    const r = this.roma;
    return r.px + (r.x - r.px) * this._a;
  },

  _drawRoma(g) {
    const r = this.roma;
    const rx = this._romaX();
    // Ya NO se salta el dibujado cuando es invulnerable. Antes hacia
    // `if (r.inv > 0 && Math.sin(this.t*30) < 0) return;`, o sea que la borraba
    // 7 veces en el segundo y medio de gracia: 0.75 s sin su personaje en
    // pantalla justo despues de que la golpearan, que es cuando mas falta le
    // hace verse. Ahora se vuelve translucida (ver alphaRoma) y no desaparece.

    let mode = 'normal';
    // `ardiendo` cuenta igual que el poder MEGA: si las balas estan potenciadas
    // hay que VERLO. Antes solo se miraba power.mega y COMBO ARDIENTE no
    // encendia nada: las balas triplicaban y en pantalla no cambiaba nada.
    if (this.power.mega > 0 || this._ardiendo()) mode = 'mega';
    else if (this.power.turbo > 0) mode = 'turbo';
    else if (this.power.shield > 0) mode = 'shield';
    else if (this.power.double > 0) mode = 'double';

    const s = A.roma(mode);
    const w = 30 * A.factor(s);
    const po = poseRoma(this, this.rst);

    // EL RESPLANDOR, debajo del cuerpo. No lleva shadowBlur ni un gradiente por
    // frame: es la propia lamina de Roma, agrandada y sumada con 'lighter'. El
    // bloom que ya pasa el motor (bloom.js) la convierte en neon gratis.
    //
    // Es lo que la marca como la protagonista: hasta ahora era el unico objeto
    // del juego que no emitia nada, un corazon parado mientras 28 criaturas
    // respiraban a su alrededor.
    const br = brilloRoma(this, this.rst);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = br * 0.30;
    const gw = w * (1.35 + br * 0.30);
    g.drawImage(s, rx - gw / 2, ROMA_Y - gw / 2, gw, gw);
    g.restore();

    // El cuerpo, con su pose. Igual que las criaturas: save/translate/rotate/
    // scale, pero con el corazon centrado en su sitio.
    g.save();
    g.globalAlpha = alphaRoma(this);
    g.translate(rx, ROMA_Y);
    if (po.rot) g.rotate(po.rot);
    g.scale(po.sx, po.sy);
    g.drawImage(s, -w / 2, -w / 2, w, w);
    g.restore();

    // La burbuja del escudo y el nombre van pegados al cuerpo: misma rx, o se
    // arrastrarian detras de ella al correr, igual que los adornos de los
    // enemigos.
    if (this.power.shield > 0) {
      g.strokeStyle = 'rgba(107,240,255,' + (0.5 + Math.sin(this.t * 8) * 0.25).toFixed(2) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.arc(rx, ROMA_Y, 20, 0, 7); g.stroke();
    }
    // Su nombre debajo, como en el original.
    textCenter(g, 'ROMA', rx, ROMA_Y + 13, 'rgba(255,62,201,0.75)', 1);
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
  // El arte vive en surv-controles.js: ahi se ve entero y se puede revisar sin
  // arrancar una partida (tools/ver-controles.html lo dibuja en todos sus
  // estados). Aqui solo se le pasa el estado que necesita.
  _drawControls(g) {
    drawControles(g, {
      t: this.t,
      padId: this.padId, padDX: this.padDX,
      firing: this.firing, aiming: this.aiming, aim: this.aim,
      latF: this.latF, fireKick: this.fireKick, rastro: this.rastro,
      // Donde esta Roma ahora mismo: el rastro se aparta si ella se acerca.
      romaX: this._romaX(),
      bomb: this.bomb, bombCd: this._bombCd(),
    }, drawStar);
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
    // Las oleadas de la explosion del jefe van por setTimeout: si se sale del
    // juego en ese medio segundo, no deben dibujar sobre otra escena.
    this.destroyed = true;
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.ebullets.length = 0;
    this.drops.length = 0;
    this.corpses.length = 0;
    this.floats.length = 0;
    // Los buffers del neon son de modulo, compartidos: se sueltan al salir para
    // no dejar 300x135 de pixeles ocupados mientras ella navega el menu.
    bloomLibre();
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
  // px/py nacen en el mismo sitio que x/y: una bala recien salida no viene de
  // ningun lado, y su primer frame tiene que dibujarse en la boca del canon.
  return { x, y, px: x, py: y, vx, vy, dmg, mega, life: 3, hostile: false, bounces: mega ? 3 : 1, pierce };
}

function mkEBullet(x, y, vx, vy) {
  return { x, y, px: x, py: y, vx, vy, t: 0 };
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
