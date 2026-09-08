// LAST WAVE - supervivencia por oleadas vista desde arriba.
// Un pulgar mueve a Romina; su arma dispara sola al enemigo mas cercano.
// Entre oleada y oleada se eligen mejoras: 3 tarjetas, un toque, se sigue jugando.
// Coordenadas escaladas 1.5x desde el diseno original de 180x400 -> 270x600.
import { VW, VH, Pool, makeRng, clamp, cam, circle } from '../core.js';
import { bake, bakeFlash, bakeFlip, spr, burst } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, vibrate } from '../input.js';

const P = {
  out:'#07030f', bg:'#140a26', dk:'#25123f', pur:'#3d1a5c', pur2:'#6a1f7a',
  mag:'#e0249a', pink:'#ff5cc8', blue:'#1d47a0', blue2:'#2a8ce0', cy:'#4de0f0',
  gdk:'#0f5c4a', gr:'#1fd18a', ye:'#f2f24a', skin:'#ffcd75', ice:'#59c2e8', wh:'#ffffff',
};

// Rampas de color para particulas (nunca se desvanecen por alpha: cambian de color).
const RAMP_FIRE = [P.wh, P.ye, P.mag, P.pur];
const RAMP_COOL = [P.wh, P.cy, P.blue2, P.blue];
const RAMP_HEAL = [P.wh, P.gr, P.gdk, P.out];

// --- Zona jugable (HUD ocupa los 51px de arriba) ---
const PF_X0 = 9, PF_X1 = 261, PF_Y0 = 51, PF_Y1 = 591;
const TAU = Math.PI * 2;

// Segmento (ax,ay)-(bx,by) contra circulo (cx,cy,r). Sin reservar memoria.
// Proyecta el centro sobre el segmento y mide la distancia al punto mas cercano.
function segHitsCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((cx - ax) * dx + (cy - ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const px = ax + dx * t - cx, py = ay + dy * t - cy;
  return px * px + py * py < r * r;
}

// ---------------------------------------------------------------------------
// SPRITES. Todos son arrays de strings, horneados una sola vez en init().
// ---------------------------------------------------------------------------
// Romina 8x8: D=contorno, H=pelo, S=piel, J=chaqueta, B=sombra, G=arma.
const ROM_D0 = ['..DDDD..','.DHHHHD.','.DHSSHD.','..DSSD..','.DJJJJD.','.DJBBJG.','..DJJD..','..D..D..'];
const ROM_D1 = ['..DDDD..','.DHHHHD.','.DHSSHD.','..DSSD..','.DJJJJD.','.DJBBJG.','..DJJD..','...DD...'];
const ROM_U0 = ['..DDDD..','.DHHHHD.','.DHHHHD.','..DHHD..','.DJJJJD.','.GJBBJD.','..DJJD..','..D..D..'];
const ROM_U1 = ['..DDDD..','.DHHHHD.','.DHHHHD.','..DHHD..','.DJJJJD.','.GJBBJD.','..DJJD..','...DD...'];
const ROM_L0 = ['..DDDD..','.DHHHHD.','.DHSSD..','..DSSD..','.DJJJD..','GDJBBD..','..DJJD..','..D.D...'];
const ROM_L1 = ['..DDDD..','.DHHHHD.','.DHSSD..','..DSSD..','.DJJJD..','GDJBBD..','..DJJD..','...DD...'];
const ROM_MAP = { D:P.out, H:P.mag, S:P.skin, J:P.blue2, B:P.blue, G:P.cy };
// Variante "rota" para la muerte: mismo cuerpo con huecos fijos.
const ROM_DEAD = ['..D.DD..','.D.HH.D.','.DH..HD.','....SD..','.D.JJ.D.','..JB.JG.','..D..D..','....D...'];

// Grunt 6x6
const GRU_0 = ['.DDD..','.DEED.','DEMMED','DEMMED','.DMMD.','.D..D.'];
const GRU_1 = ['.DDD..','.DEED.','DEMMED','DEMMED','.DMMD.','..DD..'];
const GRU_MAP = { D:P.out, E:P.mag, M:P.pur2 };

// Runner 6x6 (amarillo = "este es rapido")
const RUN_0 = ['..DD..','.DYYD.','DYRRYD','.DRRD.','.D..D.','.D..D.'];
const RUN_1 = ['..DD..','.DYYD.','DYRRYD','.DRRD.','.D..D.','..DD..'];
const RUN_C = ['......','W.DD.W','.DYYD.','DYRRYD','.DRRD.','.DDDD.'];
const RUN_MAP = { D:P.out, Y:P.ye, R:P.mag, W:P.wh };

// Tank 10x10
const TNK_0 = ['..DDDDDD..','.DAAAAAAD.','DAAGGGGAAD','DAGGWWGGAD','DAGWWWWGAD','DAGGWWGGAD','DAAGGGGAAD','.DAAAAAAD.','..D....D..','..DD..DD..'];
const TNK_1 = ['..DDDDDD..','.DAAAAAAD.','DAAGGGGAAD','DAGGWWGGAD','DAGWWWWGAD','DAGGWWGGAD','DAAGGGGAAD','.DAAAAAAD.','..D....D..','..D....DD.'];
const TNK_MAP = { D:P.out, A:P.pur, G:P.pur2, W:P.mag };

// Spitter 8x8
const SPI_0 = ['..DDDD..','.DGGGGD.','DGCCCCGD','DGCNNCGD','DGCCCCGD','.DGGGGD.','..D..D..','..D..D..'];
const SPI_1 = ['..DDDD..','.DGGGGD.','DGCCCCGD','DGCNNCGD','DGCCCCGD','.DGGGGD.','..D..D..','...DD...'];
const SPI_C = ['..DDDD..','.DGGGGD.','DGCCCCGD','DGCWWCGD','DGCCCCGD','.DGGGGD.','..DCCD..','..DCCD..'];
const SPI_MAP = { D:P.out, G:P.gdk, C:P.gr, N:P.out, W:P.wh };
const SPIT = ['.C.','CWC','.C.'];
const SPIT_MAP = { C:P.gr, W:P.wh };

// Swarmling 4x4
const SWA_0 = ['.DD.','DWWD','DWWD','.DD.'];
const SWA_1 = ['.DD.','DFFD','DFFD','.DD.'];
const SWA_MAP = { D:P.out, W:P.ice, F:P.wh };

// Bala 3x3 + halo 5x5
const BUL = ['.C.','CWC','.C.'];
const BUL_MAP = { C:P.cy, W:P.wh };
const BUL_G = ['.BBB.','BCWCB','BWWWB','BCWCB','.BBB.'];
const BULG_MAP = { B:P.blue, C:P.cy, W:P.wh };

// Fragmento de XP 4x4 (diamante), 3 valores de color
const SHARD = ['.G..','GWG.','.G..','....'];

// Corazon de curacion 7x7
const HEART = ['.DD.DD.','DHHDHHD','DHWHHHD','DHHHHHD','.DHHHD.','..DHD..','...D...'];
const HEART_MAP = { D:P.out, H:P.gr, W:P.wh };

// Corazones de HUD 5x5
const HP_FULL = ['.D.D.','DHDHD','DHHHD','.DHD.','..D..'];
const HP_EMPT = ['.D.D.','D.D.D','D...D','.D.D.','..D..'];
const HPF_MAP = { D:P.mag, H:P.pink };
const HPE_MAP = { D:P.pur };

// Orbital 4x4: anillo hueco amarillo con un pixel blanco.
const ORB = ['WYYY','Y..Y','Y..Y','YYYY'];
const ORB_MAP = { Y:P.ye, W:P.wh };

// Marca de aviso de spawn: anillo hueco con esquinas blancas, 3 tamanos.
function warnRows(n) {
  const rows = [];
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < n; x++) {
      const edge = (x === 0 || y === 0 || x === n - 1 || y === n - 1);
      const corner = (x === 0 || x === n - 1) && (y === 0 || y === n - 1);
      r += corner ? 'W' : edge ? 'M' : '.';
    }
    rows.push(r);
  }
  return rows;
}
const WARN_MAP = { M:P.mag, W:P.wh };

// Opciones reutilizadas para la estela de las balas: es lo unico que se emite
// por frame y por bala, asi que el objeto se crea una vez y nunca mas.
const TRAIL_OPT = { rnd:null, colors:RAMP_COOL, speed:1, life:0.14, size:1 };

// ---------------------------------------------------------------------------
// TIPOS DE ENEMIGO. Indices fijos: 0 grunt, 1 runner, 2 tank, 3 spitter, 4 swarm.
// Radios y velocidades ya escalados 1.5x.
// ---------------------------------------------------------------------------
const E_GRUNT = 0, E_RUNNER = 1, E_TANK = 2, E_SPITTER = 3, E_SWARM = 4;
const E_HP    = [20, 12, 90, 30, 6];
const E_R     = [3.6, 3.3, 6.3, 4.5, 2.7];
const E_DMG   = [1, 1, 2, 1, 1];
const E_XP    = [1, 1, 4, 2, 1];
const E_SCORE = [10, 15, 60, 40, 8];
const E_WARN  = [0, 0, 2, 1, 0];   // indice de sprite de aviso (6/8/10 px)

// Pesos de aparicion por tramo de oleada.
function mixWeight(type, W) {
  if (W <= 2) return type === E_GRUNT ? 100 : 0;
  if (W <= 4) return type === E_GRUNT ? 100 : type === E_RUNNER ? 45 : 0;
  if (W <= 6) return type === E_GRUNT ? 100 : type === E_RUNNER ? 45 : type === E_TANK ? 20 : 0;
  if (W <= 8) return type === E_GRUNT ? 100 : type === E_RUNNER ? 45 : type === E_TANK ? 20 : type === E_SPITTER ? 30 : 0;
  if (W <= 11) return type === E_GRUNT ? 100 : type === E_RUNNER ? 70 : type === E_TANK ? 20 : type === E_SPITTER ? 30 : 55;
  return type === E_GRUNT ? 90 : type === E_RUNNER ? 70 : type === E_TANK ? 32 : type === E_SPITTER ? 42 : 55;
}

// ---------------------------------------------------------------------------
// MEJORAS. Nombres cortos en mayusculas para que entren en 270px de ancho.
// ---------------------------------------------------------------------------
const UPG = [
  { k:'damage',    name:'PODER',  max:99, col:P.mag },
  { k:'firerate',  name:'RAPIDO', max:99, col:P.cy },
  { k:'pierce',    name:'PERFORA',max:5,  col:P.wh },
  { k:'orbital',   name:'ORBITA', max:6,  col:P.ye },
  { k:'lifesteal', name:'DRENAJE',max:5,  col:P.gr },
  { k:'explosive', name:'BOOM',   max:4,  col:P.ye },
  { k:'multishot', name:'ABANICO',max:3,  col:P.cy },
  { k:'speed',     name:'BOTAS',  max:4,  col:P.blue2 },
  { k:'magnet',    name:'IMAN',   max:3,  col:P.ye },
  { k:'vitality',  name:'VIDA',   max:5,  col:P.gr },
];

// Estados del juego.
const S_PLAY = 0, S_VACUUM = 1, S_CARDS = 2, S_OUT = 3, S_BEAT = 4, S_DEAD = 5;

export default {
  meta: { id:'lastwave', title:'LAST WAVE', tag:'SOBREVIVE OLEADAS', colors:['#5cffd8','#ff5c9d'] },

  init(ctx, args) {
    const rnd = this.rnd = makeRng(args.seed >>> 0);

    // --- Horneado de sprites (una sola vez) ---
    // Romina: 4 orientaciones x 2 frames, normal y blanco. RIGHT es el espejo de LEFT.
    const rl0 = bake(ROM_L0, ROM_MAP, 2), rl1 = bake(ROM_L1, ROM_MAP, 2);
    const rl0w = bakeFlash(ROM_L0, 2), rl1w = bakeFlash(ROM_L1, 2);
    this.sRom = [
      [bake(ROM_D0, ROM_MAP, 2), bake(ROM_D1, ROM_MAP, 2)],  // 0 abajo
      [bake(ROM_U0, ROM_MAP, 2), bake(ROM_U1, ROM_MAP, 2)],  // 1 arriba
      [rl0, rl1],                                             // 2 izquierda
      [bakeFlip(rl0), bakeFlip(rl1)],                         // 3 derecha
    ];
    this.sRomW = [
      [bakeFlash(ROM_D0, 2), bakeFlash(ROM_D1, 2)],
      [bakeFlash(ROM_U0, 2), bakeFlash(ROM_U1, 2)],
      [rl0w, rl1w],
      [bakeFlip(rl0w), bakeFlip(rl1w)],
    ];
    this.sRomDead = bake(ROM_DEAD, ROM_MAP, 2);

    // Enemigos: [tipo][frame] normal y blanco. Frame 2 = pose especial (crouch/carga).
    this.sEnemy = [
      [bake(GRU_0, GRU_MAP, 2), bake(GRU_1, GRU_MAP, 2)],
      [bake(RUN_0, RUN_MAP, 2), bake(RUN_1, RUN_MAP, 2), bake(RUN_C, RUN_MAP, 2)],
      [bake(TNK_0, TNK_MAP, 2), bake(TNK_1, TNK_MAP, 2)],
      [bake(SPI_0, SPI_MAP, 2), bake(SPI_1, SPI_MAP, 2), bake(SPI_C, SPI_MAP, 2)],
      [bake(SWA_0, SWA_MAP, 2), bake(SWA_1, SWA_MAP, 2)],
    ];
    this.sEnemyW = [
      [bakeFlash(GRU_0, 2), bakeFlash(GRU_1, 2)],
      [bakeFlash(RUN_0, 2), bakeFlash(RUN_1, 2), bakeFlash(RUN_C, 2)],
      [bakeFlash(TNK_0, 2), bakeFlash(TNK_1, 2)],
      [bakeFlash(SPI_0, 2), bakeFlash(SPI_1, 2), bakeFlash(SPI_C, 2)],
      [bakeFlash(SWA_0, 2), bakeFlash(SWA_1, 2)],
    ];
    // Variante encogida del grunt para el estado "naciendo" tras partir un tank.
    this.sGruntSmall = bake(GRU_0, GRU_MAP, 1);

    this.sBullet = bake(BUL, BUL_MAP, 2);
    this.sBulletG = bake(BUL_G, BULG_MAP, 2);
    this.sSpit = bake(SPIT, SPIT_MAP, 2);
    this.sShard = [
      bake(SHARD, { G:P.gr, W:P.wh }, 2),
      bake(SHARD, { G:P.cy, W:P.wh }, 2),
      bake(SHARD, { G:P.ye, W:P.wh }, 2),
    ];
    this.sHeart = bake(HEART, HEART_MAP, 2);
    this.sHeartW = bakeFlash(HEART, 2);
    this.sHpFull = bake(HP_FULL, HPF_MAP, 2);
    this.sHpEmpty = bake(HP_EMPT, HPE_MAP, 2);
    this.sOrb = bake(ORB, ORB_MAP, 2);
    this.sWarn = [bake(warnRows(6), WARN_MAP, 2), bake(warnRows(8), WARN_MAP, 2), bake(warnRows(10), WARN_MAP, 2)];

    // --- Pools (SIEMPRE aqui, nunca a nivel de modulo) ---
    // uid: identidad estable del enemigo. NO se puede usar _i para esto porque el
    // pool reasigna indices al liberar (swap-remove) y una bala perforante creeria
    // haber golpeado ya a un cuerpo distinto que heredo la ranura.
    this.uidNext = 1;
    this.enemies = new Pool(64, () => ({
      uid:0, type:0, x:0, y:0, hp:0, maxHp:0, spd:0, r:0, frame:0, animT:0,
      hitT:0, kx:0, ky:0, kT:0, st:0, stT:0, phase:0, dirX:0, dirY:0,
      strafe:1, fireT:0, chargeT:0, bornT:0, lastOrb:0, t:0,
    }), null);
    this.bullets = new Pool(192, () => ({
      x:0, y:0, vx:0, vy:0, life:0, pierceLeft:0, hitCount:0,
      hits:new Int32Array(6), trail:0,
    }), null);
    this.spits = new Pool(48, () => ({ x:0, y:0, vx:0, vy:0, life:0 }), null);
    this.shards = new Pool(96, () => ({ x:0, y:0, vx:0, vy:0, val:0, life:0, ph:0, mag:false }), null);
    this.heals = new Pool(4, () => ({ x:0, y:0, t:0 }), null);
    this.warns = new Pool(32, () => ({ x:0, y:0, type:0, t:0, cluster:0 }), null);

    this.stick = new Stick(39, 7);   // maxRadius 26*1.5, deadzone 4.68*1.5

    // --- Estado de Romina ---
    this.px = VW / 2; this.py = 380;
    this.maxHp = 5; this.hp = 5;
    this.iFrames = 0; this.facing = 0; this.walkFrame = 0; this.walkT = 0;
    this.kbX = 0; this.kbY = 0; this.kbT = 0;

    // --- Arma / mejoras ---
    this.damage = 10; this.fireCd = 0.420; this.fireT = 0;
    this.bulletSpeed = 225; this.pierce = 0; this.projCount = 1;
    this.moveSpeed = 93;
    this.orbitalCount = 0; this.orbDmg = 8; this.orbSpeed = 2.6; this.orbAngle = 0;
    this.explosiveRadius = 0; this.explosiveDmg = 0; this.exploding = false;
    this.lifeSteal = 0; this.stealPool = 0;
    this.magnetRadius = 60;
    this.ranks = new Int32Array(UPG.length);

    // --- Estado de oleada ---
    this.wave = 0;
    this.budgetTotal = 0; this.budgetLeft = 0; this.spawnT = 0; this.spawnGap = 0;
    this.waveClean = true; this.wavesSinceHeal = 99; this.rage = 1;
    this.score = 0; this.heat = 0; this.combo = 0; this.comboT = 0;
    this.state = S_BEAT; this.stateT = 0;
    this.freeze = 0; this.flashCol = null; this.flashA = 0;
    this.cleanBonus = 0; this.cleanT = 0;
    this.cards = null; this.cardPick = -1; this.cardFlash = 0;
    this.t = 0; this.deadT = 0;
    this.hudScore = '0'; this.hudScoreVal = -1;

    this.startWave();
  },

  // -------------------------------------------------------------------------
  // OLEADAS
  // -------------------------------------------------------------------------
  startWave() {
    const W = ++this.wave;
    // Arranca en 6 y no en 4 (con 4 repartidos en 3.5s los primeros segundos
    // eran tiempo muerto), pero la curva sube mas suave: probado con 7 y
    // W*2.2 la mediana caia a la oleada 3, contra las 6-11 que busca el diseno.
    this.budgetTotal = Math.min(96, 6 + Math.floor(W * 1.8) + Math.floor(W * W / 15));
    this.budgetLeft = this.budgetTotal;
    const win = Math.min(9000, 3200 + W * 380) / 1000;
    this.spawnGap = win / this.budgetTotal;
    this.spawnT = 0.25;
    this.waveClean = true; this.rage = 1;
    this.state = S_PLAY; this.stateT = 0;
    this.wavesSinceHeal++;

    // Valvula de misericordia: solo si esta muy herida y hace rato que no cae una.
    if (this.hp <= 2 && this.wavesSinceHeal >= 2) {
      const h = this.heals.spawn();
      if (h) { h.x = VW / 2; h.y = 321; h.t = 0; }
    }
    // Oleadas 5/10/15/20: un tank garantizado antes que nada.
    if (W % 5 === 0) this.queueSpawn(E_TANK);
    SFX.wave();
  },

  // Elige un tipo segun los pesos de la oleada actual.
  pickType() {
    const W = this.wave;
    let total = 0;
    for (let i = 0; i < 5; i++) total += mixWeight(i, W);
    let r = this.rnd() * total;
    for (let i = 0; i < 5; i++) {
      r -= mixWeight(i, W);
      if (r <= 0) return i;
    }
    return E_GRUNT;
  },

  // Crea la marca de aviso en el perimetro; el enemigo real nace 350ms despues.
  queueSpawn(type) {
    const rnd = this.rnd;
    const edge = rnd.int(0, 3);
    let x, y;
    if (edge === 0) { x = rnd.range(PF_X0, PF_X1); y = PF_Y0 - 15; }
    else if (edge === 1) { x = rnd.range(PF_X0, PF_X1); y = PF_Y1 + 15; }
    else if (edge === 2) { x = PF_X0 - 15; y = rnd.range(PF_Y0, PF_Y1); }
    else { x = PF_X1 + 15; y = rnd.range(PF_Y0, PF_Y1); }
    const w = this.warns.spawn();
    if (!w) return;
    // La marca se dibuja siempre dentro de pantalla: nada aparece encima de ella.
    w.x = clamp(x, 6, VW - 6);
    w.y = clamp(y, PF_Y0 + 5, VH - 6);
    w.type = type; w.t = 0.35; w.cluster = 0;
    if (type === E_SWARM) w.cluster = 5;
  },

  spawnEnemy(type, x, y) {
    const e = this.enemies.spawn();
    if (!e) return null;
    const W = this.wave;
    const hpMul = Math.min(3.2, 1 + (W - 1) * 0.13);
    const spMul = Math.min(1.65, 1 + (W - 1) * 0.026);
    e.uid = this.uidNext++;
    e.type = type; e.x = x; e.y = y;
    e.maxHp = e.hp = Math.round(E_HP[type] * hpMul);
    e.r = E_R[type];
    e.frame = 0; e.animT = 0; e.hitT = 0;
    e.kx = 0; e.ky = 0; e.kT = 0;
    e.st = 0; e.stT = 0; e.fireT = 1.6; e.chargeT = 0; e.bornT = 0;
    e.lastOrb = 0; e.t = 0; e.strafe = this.rnd.chance(0.5) ? 1 : -1;
    e.phase = this.rnd() * TAU;
    e.dirX = 0; e.dirY = 0;
    if (type === E_GRUNT) e.spd = (26 + Math.min(18, (W - 1) * 1.6)) * 1.5 * spMul;
    else if (type === E_RUNNER) { e.spd = 60 * spMul; e.st = 0; e.stT = 0.9; }
    else if (type === E_TANK) e.spd = 27 * spMul;
    else if (type === E_SPITTER) e.spd = 33 * spMul;
    else e.spd = 51 * spMul;
    return e;
  },

  // -------------------------------------------------------------------------
  // ARMA
  // -------------------------------------------------------------------------
  fire() {
    // Enemigo mas cercano por distancia al cuadrado. Escaneo lineal, max 64.
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.enemies.n; i++) {
      const e = this.enemies.items[i];
      if (e.bornT > 0) continue;
      const dx = e.x - this.px, dy = e.y - this.py;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return false;
    const base = Math.atan2(best.y - this.py, best.x - this.px);
    const n = this.projCount;
    const step = 14 * Math.PI / 180;
    const start = -step * (n - 1) * 0.5;
    for (let i = 0; i < n; i++) {
      const b = this.bullets.spawn();
      if (!b) break;
      const a = base + start + step * i;
      const ca = Math.cos(a), sa = Math.sin(a);
      b.x = this.px + ca * 6; b.y = this.py + sa * 6;
      b.vx = ca * this.bulletSpeed; b.vy = sa * this.bulletSpeed;
      b.life = 2.2; b.pierceLeft = this.pierce; b.hitCount = 0; b.trail = 0;
    }
    SFX.shoot();
    return true;
  },

  // Dano a un enemigo desde cualquier fuente. Devuelve true si murio.
  hurtEnemy(e, dmg, fromX, fromY, knock) {
    if (e.type === E_TANK) dmg = Math.max(1, dmg - 3);
    e.hp -= dmg;
    e.hitT = 0.09;
    if (knock > 0 && e.type !== E_TANK) {
      const dx = e.x - fromX, dy = e.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      e.kx = dx / d * knock; e.ky = dy / d * knock; e.kT = 0.06;
    }
    if (e.hp > 0) { SFX.hit(); return false; }
    this.killEnemy(e);
    return true;
  },

  killEnemy(e) {
    const type = e.type, ex = e.x, ey = e.y;
    this.score += E_SCORE[type] * this.wave;
    this.heat += 1;

    if (type === E_TANK) {
      burst(ex, ey, 22, { rnd:this.rnd, colors:RAMP_FIRE, speed:180, life:0.5, size:3 });
      cam.shake(3.5, 0.22); SFX.explode();
      this.freeze = 2;
      this.dropShard(ex - 6, ey, 2);
      this.dropShard(ex + 6, ey, 2);
      this.enemies.free(e);
      // Se parte en dos grunts debiles que tardan 250ms en despertar.
      for (let s = -1; s <= 1; s += 2) {
        const gx = clamp(ex + s * 7.5, PF_X0, PF_X1);
        const ng = this.spawnEnemy(E_GRUNT, gx, ey);
        if (ng) { ng.hp = ng.maxHp = 12; ng.bornT = 0.25; }
      }
      return;
    }

    burst(ex, ey, 8, { rnd:this.rnd, colors:RAMP_FIRE, speed:120, life:0.3, size:2 });
    cam.shake(1.2, 0.09);
    SFX.hit();
    // Los swarmlings solo sueltan fragmento 1 de cada 3: evita la lluvia de pickups.
    if (type !== E_SWARM || this.rnd.chance(0.34)) this.dropShard(ex, ey, E_XP[type] === 4 ? 2 : E_XP[type]);
    this.enemies.free(e);

    if (this.lifeSteal > 0) {
      this.stealPool += this.lifeSteal;
      while (this.stealPool >= 1) {
        this.stealPool -= 1;
        if (this.hp < this.maxHp) {
          this.hp++;
          burst(this.px, this.py, 6, { rnd:this.rnd, colors:RAMP_HEAL, speed:80, life:0.35, size:2 });
        }
      }
    }
  },

  dropShard(x, y, val) {
    const s = this.shards.spawn();
    if (!s) return;
    const a = this.rnd() * TAU, sp = this.rnd.range(45, 90);
    s.x = x; s.y = y; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
    s.val = val; s.life = 12; s.ph = this.rnd() * TAU; s.mag = false;
  },

  // Detonacion de bala explosiva: nunca encadena.
  explode(x, y) {
    if (this.exploding) return;   // las explosiones NUNCA encadenan: tope de frame-time
    this.exploding = true;
    const r = this.explosiveRadius;
    // Se parte del conteo previo: los grunts que nazcan de un tank partido aqui
    // dentro no pueden ser alcanzados por esta misma detonacion.
    for (let i = Math.min(this.enemies.n, 64) - 1; i >= 0; i--) {
      if (i >= this.enemies.n) continue;
      const e = this.enemies.items[i];
      if (e.bornT > 0) continue;
      if (circle(x, y, r, e.x, e.y, e.r)) this.hurtEnemy(e, this.explosiveDmg, x, y, 0);
    }
    this.exploding = false;
    burst(x, y, 10, { rnd:this.rnd, colors:RAMP_FIRE, speed:200, life:0.22, size:2 });
    cam.shake(1.6, 0.1);
  },

  hurtRomina(dmg, fromX, fromY) {
    if (this.iFrames > 0 || this.state !== S_PLAY) return;
    this.hp -= dmg;
    this.iFrames = 0.8;
    this.waveClean = false;
    this.freeze = 3;
    this.flashCol = P.mag; this.flashA = 0.30;
    const dx = this.px - fromX, dy = this.py - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.kbX = dx / d * 13.5 / 0.12; this.kbY = dy / d * 13.5 / 0.12; this.kbT = 0.12;
    burst(this.px, this.py, 12, { rnd:this.rnd, colors:RAMP_FIRE, speed:150, life:0.35, size:2 });
    cam.shake(4.5, 0.26); SFX.hurt(); vibrate(14);
    if (this.hp <= 0) this.die();
  },

  die() {
    if (this.state === S_DEAD) return;
    this.hp = 0;
    this.state = S_DEAD; this.stateT = 0; this.deadT = 0;
    this.freeze = 6;
    this.flashCol = P.mag; this.flashA = 0.5;
    burst(this.px, this.py, 30, { rnd:this.rnd, colors:RAMP_FIRE, speed:220, life:0.6, size:3 });
    cam.shake(6, 0.4); SFX.explode(); vibrate([40, 60, 120]);
  },

  // -------------------------------------------------------------------------
  // MEJORAS
  // -------------------------------------------------------------------------
  // Devuelve true si la mejora todavia puede salir en el sorteo.
  canOffer(i) {
    const u = UPG[i], r = this.ranks[i];
    if (u.k === 'firerate') return this.fireCd > 0.111;
    if (u.k === 'orbital') return r < 6;
    return r < u.max;
  },

  upgradeValue(i) {
    const u = UPG[i], r = this.ranks[i];
    switch (u.k) {
      case 'damage':    return r === 0 ? '+6 DANO' : r === 1 ? '+6 DANO' : r === 2 ? '+7 DANO' : '+8 DANO';
      case 'firerate':  return '-14% ESPERA';
      case 'pierce':    return '+1 ATRAVIESA';
      case 'orbital':   return this.orbitalCount >= 4 ? '+DANO ORBE' : '+1 ORBE';
      case 'lifesteal': return '+VIDA X KILL';
      case 'explosive': return r === 0 ? 'BALAS EXPLOTAN' : '+RADIO';
      case 'multishot': return '+1 DISPARO';
      case 'speed':     return '+12 VELOCIDAD';
      case 'magnet':    return r === 0 ? '+ALCANCE +1 HP' : '+ALCANCE';
      case 'vitality':  return '+1 HP MAX';
    }
    return '';
  },

  applyUpgrade(i) {
    const u = UPG[i], r = this.ranks[i];
    this.ranks[i] = r + 1;
    switch (u.k) {
      case 'damage':
        this.damage += r === 0 ? 6 : r === 1 ? 6 : r === 2 ? 7 : 8;
        if (this.explosiveRadius > 0) this.explosiveDmg = Math.floor(this.damage * (this.ranks[5] >= 4 ? 0.8 : 0.6));
        break;
      case 'firerate':
        this.fireCd = Math.max(0.110, this.fireCd * 0.86);
        break;
      case 'pierce':
        this.pierce += 1;
        break;
      case 'orbital':
        if (this.orbitalCount < 4) this.orbitalCount += 1;
        else { this.orbDmg += 5; this.orbSpeed += 0.5; }
        break;
      case 'lifesteal':
        this.lifeSteal += r === 0 ? 0.055 : r === 1 ? 0.05 : 0.045;
        break;
      case 'explosive': {
        const rad = [21, 27, 33, 39][Math.min(3, r)];   // 14/18/22/26 * 1.5
        this.explosiveRadius = rad;
        this.explosiveDmg = Math.floor(this.damage * (r >= 3 ? 0.8 : 0.6));
        break;
      }
      case 'multishot':
        this.projCount = Math.min(4, this.projCount + 1);
        break;
      case 'speed':
        this.moveSpeed += 12;
        break;
      case 'magnet':
        this.magnetRadius += 24;
        if (r === 0) { this.maxHp += 1; this.hp += 1; }
        break;
      case 'vitality':
        this.maxHp += 1; this.hp += 1;
        break;
    }
  },

  // Se llama entre oleadas (no en el hot path), asi que asignar aqui esta bien.
  rollCards() {
    const bag = [];
    for (let i = 0; i < UPG.length; i++) if (this.canOffer(i)) bag.push(i);
    const out = [];
    for (let k = 0; k < 3 && bag.length > 0; k++) {
      const j = this.rnd.int(0, bag.length - 1);
      out.push(bag[j]);
      bag.splice(j, 1);
    }
    while (out.length < 3) out.push(9);   // VIDA nunca se agota del todo en la practica
    this.cards = out;
    this.cardPick = -1;
    SFX.blip();
  },

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------
  update(dt, ctx) {
    this.t += dt;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 3.4);
    if (this.heat > 0) this.heat = Math.max(0, this.heat - 6 * dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.cleanT > 0) this.cleanT -= dt;

    // Hitstop: la simulacion se congela pero particulas y shake siguen (los mueve el motor).
    if (this.freeze > 0) { this.freeze--; return; }

    if (this.state === S_DEAD) {
      this.deadT += dt;
      if (this.deadT > 0.55) ctx.gameOver(Math.floor(this.score));
      return;
    }

    if (this.state === S_CARDS || this.state === S_OUT || this.state === S_BEAT) {
      this.stateT += dt;
      this.updateShards(dt, true);
      if (this.state === S_OUT && this.stateT >= 0.12) { this.state = S_BEAT; this.stateT = 0; }
      else if (this.state === S_BEAT && this.stateT >= 0.4) this.startWave();
      if (this.cardFlash > 0) this.cardFlash -= dt;
      return;
    }

    if (this.state === S_VACUUM) {
      this.stateT += dt;
      this.updateShards(dt, true);
      this.updateBullets(dt, true);
      if (this.stateT >= 0.58) { this.state = S_CARDS; this.stateT = 0; this.rollCards(); }
      return;
    }

    // ---- S_PLAY ----
    // Anti-estancamiento: si el presupuesto ya se gasto y quedan pocos rezagados
    // dando vueltas, se van acelerando hasta alcanzarla. Una oleada SIEMPRE termina.
    this.rage = (this.budgetLeft <= 0 && this.warns.n === 0 && this.enemies.n <= 3)
      ? Math.min(2.5, this.rage + dt * 0.22) : 1;

    this.updateRomina(dt);
    this.updateWarns(dt);
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt, false);
    this.updateOrbitals(dt);
    this.updateSpits(dt);
    this.updateShards(dt, false);
    this.updateHeals(dt);

    // Fin de oleada: presupuesto agotado, sin avisos pendientes y sin enemigos vivos.
    if (this.budgetLeft <= 0 && this.warns.n === 0 && this.enemies.n === 0) {
      this.score += 250 * this.wave;
      if (this.waveClean) {
        this.cleanBonus = 400 * this.wave;
        this.score += this.cleanBonus;
        this.cleanT = 0.9;
      }
      // Las balas se congelan en el aire durante el vacio.
      for (let i = 0; i < this.bullets.n; i++) { this.bullets.items[i].vx = 0; this.bullets.items[i].vy = 0; }
      for (let i = this.heals.n - 1; i >= 0; i--) this.heals.free(this.heals.items[i]);
      this.state = S_VACUUM; this.stateT = 0;
      this.flashCol = P.wh; this.flashA = 0.18;
      cam.shake(2, 0.15); SFX.wave(); vibrate(18);
    }
  },

  updateRomina(dt) {
    const st = this.stick;
    if (this.iFrames > 0) this.iFrames -= dt;

    let mx = 0, my = 0;
    if (st.active) {
      const mag = Math.hypot(st.dx, st.dy);
      if (mag > 0.001) {
        // Magnitud reescalada desde la zona muerta: la velocidad arranca en 0.
        const e = clamp((mag - 0.18) / 0.82, 0, 1);
        mx = st.dx / mag * e; my = st.dy / mag * e;
      }
    }
    // Velocidad instantanea: la inercia se lee como falta de respuesta.
    this.px += mx * this.moveSpeed * dt;
    this.py += my * this.moveSpeed * dt;

    if (this.kbT > 0) {
      this.kbT -= dt;
      this.px += this.kbX * dt; this.py += this.kbY * dt;
    }
    this.px = clamp(this.px, PF_X0 + 4, PF_X1 - 4);
    this.py = clamp(this.py, PF_Y0 + 4, PF_Y1 - 4);

    const mag = Math.hypot(mx, my);
    if (mag > 0.15) {
      // 4 orientaciones fijas por eje dominante; con el stick suelto conserva la ultima.
      if (Math.abs(mx) >= Math.abs(my)) this.facing = mx < 0 ? 2 : 3;
      else this.facing = my < 0 ? 1 : 0;
      this.walkT += dt;
      if (this.walkT > 0.14) { this.walkT = 0; this.walkFrame ^= 1; }
    } else this.walkFrame = 0;

    // Auto-fuego: sin enemigos el temporizador no baja, asi el primer tiro es instantaneo.
    if (this.fireT > 0) this.fireT -= dt;
    if (this.fireT <= 0 && this.enemies.n > 0) {
      if (this.fire()) this.fireT = this.fireCd;
    }
  },

  updateWarns(dt) {
    for (let i = this.warns.n - 1; i >= 0; i--) {
      const w = this.warns.items[i];
      w.t -= dt;
      if (w.t > 0) continue;
      if (w.cluster > 0) {
        // Enjambre: 5 cuerpos escalonados desde el mismo punto de borde.
        for (let k = 0; k < 5; k++) {
          const a = (k - 2) * 0.18;
          this.spawnEnemy(E_SWARM, w.x + Math.cos(a) * 10, w.y + Math.sin(a) * 10);
        }
      } else {
        this.spawnEnemy(w.type, w.x, w.y);
      }
      this.warns.free(w);
    }
  },

  updateSpawner(dt) {
    if (this.budgetLeft <= 0) return;
    // Tope concurrente: garantia de frame-time. Se retiene el presupuesto.
    if (this.enemies.n >= 52) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const type = this.pickType();
    this.queueSpawn(type);
    this.budgetLeft--;
    this.spawnT = this.spawnGap * this.rnd.range(0.75, 1.25);
  },

  updateEnemies(dt) {
    const px = this.px, py = this.py;
    const rage = this.rage;
    for (let i = this.enemies.n - 1; i >= 0; i--) {
      const e = this.enemies.items[i];
      e.t += dt;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.lastOrb > 0) e.lastOrb -= dt;

      if (e.bornT > 0) { e.bornT -= dt; continue; }

      const dx = px - e.x, dy = py - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;

      if (e.type === E_GRUNT || e.type === E_TANK) {
        e.x += nx * e.spd * rage * dt; e.y += ny * e.spd * rage * dt;
        e.animT += dt;
        const per = e.type === E_TANK ? 0.26 : 0.16;
        if (e.animT > per) { e.animT = 0; e.frame ^= 1; }

      } else if (e.type === E_RUNNER) {
        e.stT -= dt;
        if (e.st === 0) {                 // camina
          e.x += nx * e.spd * rage * dt; e.y += ny * e.spd * rage * dt;
          e.animT += dt;
          if (e.animT > 0.14) { e.animT = 0; e.frame ^= 1; }
          if (e.stT <= 0) { e.st = 1; e.stT = 0.22; SFX.blip(); }
        } else if (e.st === 1) {           // aviso: se agacha y no se mueve
          if (e.stT <= 0) { e.st = 2; e.stT = 0.4; e.dirX = nx; e.dirY = ny; }
        } else {                           // embestida: direccion fija, esquivable
          e.x += e.dirX * 195 * dt; e.y += e.dirY * 195 * dt;
          if (e.stT <= 0 || e.x < PF_X0 - 18 || e.x > PF_X1 + 18 || e.y < PF_Y0 - 18 || e.y > PF_Y1 + 18) {
            e.st = 0; e.stT = 0.9;
            e.x = clamp(e.x, PF_X0, PF_X1); e.y = clamp(e.y, PF_Y0, PF_Y1);
          }
        }

      } else if (e.type === E_SPITTER) {
        const HOLD = 117, NEAR = 69;      // 78 y 46 escalados
        if (dist > HOLD) {
          e.x += nx * e.spd * rage * dt; e.y += ny * e.spd * rage * dt;
        } else if (dist < NEAR) {
          e.x -= nx * 45 * dt; e.y -= ny * 45 * dt;
        } else {
          if (e.t % 2.8 < 1.4) e.strafe = 1; else e.strafe = -1;
          e.x += -ny * 30 * e.strafe * dt; e.y += nx * 30 * e.strafe * dt;
          // Solo dispara desde el anillo de espera, con 380ms de telegrafia.
          e.fireT -= dt;
          if (e.chargeT > 0) {
            e.chargeT -= dt;
            if (e.chargeT <= 0) {
              const s = this.spits.spawn();
              if (s) {
                s.x = e.x; s.y = e.y;
                const a = Math.atan2(py - e.y, px - e.x);
                s.vx = Math.cos(a) * 102; s.vy = Math.sin(a) * 102; s.life = 4;
              }
              SFX.laser();
              e.fireT = 1.6;
            }
          } else if (e.fireT <= 0) { e.chargeT = 0.38; SFX.blip(); }
        }
        e.animT += dt;
        if (e.animT > 0.2) { e.animT = 0; e.frame ^= 1; }

      } else {                             // E_SWARM: homing con serpenteo
        const a = Math.atan2(ny, nx) + Math.sin(e.t * 5 + e.phase) * 0.55;
        e.x += Math.cos(a) * e.spd * rage * dt; e.y += Math.sin(a) * e.spd * rage * dt;
        e.animT += dt;
        if (e.animT > 0.1) { e.animT = 0; e.frame ^= 1; }
      }

      // Retroceso por impacto
      if (e.kT > 0) { e.kT -= dt; e.x += e.kx * dt * 16; e.y += e.ky * dt * 16; }

      // Se mantienen dentro de un margen amplio del campo
      e.x = clamp(e.x, PF_X0 - 24, PF_X1 + 24);
      e.y = clamp(e.y, PF_Y0 - 24, PF_Y1 + 24);

      // Contacto con Romina
      if (circle(px, py, 3.9, e.x, e.y, e.r)) {
        if (this.iFrames <= 0) this.hurtRomina(E_DMG[e.type], e.x, e.y);
        if (e.type !== E_TANK) {
          // Empujon al enemigo: puede salir a empujones de un amontonamiento.
          const k = e.type === E_RUNNER ? 30 : 21;
          const ddx = e.x - px, ddy = e.y - py, dd = Math.hypot(ddx, ddy) || 1;
          e.kx = ddx / dd * k; e.ky = ddy / dd * k; e.kT = 0.1;
        }
      }
    }
  },

  updateBullets(dt, frozen) {
    for (let i = this.bullets.n - 1; i >= 0; i--) {
      const b = this.bullets.items[i];
      b.life -= dt;
      if (b.life <= 0) { this.bullets.free(b); continue; }
      if (frozen) continue;

      const bx0 = b.x, by0 = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < PF_X0 - 12 || b.x > PF_X1 + 12 || b.y < PF_Y0 - 12 || b.y > PF_Y1 + 12) {
        this.bullets.free(b); continue;
      }
      b.trail ^= 1;
      if (b.trail === 0) { TRAIL_OPT.rnd = this.rnd; burst(b.x, b.y, 1, TRAIL_OPT); }

      // Colision O(n*m) acotada: <=192 balas x <=64 enemigos, con salida temprana
      // por bala en cuanto se agota su perforacion.
      let dead = false;
      for (let j = this.enemies.n - 1; j >= 0; j--) {
        if (j >= this.enemies.n) continue;   // el pool encogio bajo nuestros pies
        const e = this.enemies.items[j];
        if (e.bornT > 0) continue;
        // Barrido del segmento recorrido este frame, no solo el punto final:
        // a 225 px/s la bala avanza ~3.8px por frame y podria colarse por detras
        // de un cuerpo que cruza en perpendicular.
        if (!segHitsCircle(bx0, by0, b.x, b.y, e.x, e.y, e.r + 2.4)) continue;
        // Una bala nunca golpea dos veces al mismo cuerpo.
        let seen = false;
        for (let k = 0; k < b.hitCount; k++) if (b.hits[k] === e.uid) { seen = true; break; }
        if (seen) continue;
        if (b.hitCount < 6) { b.hits[b.hitCount++] = e.uid; }
        const bx = b.x, by = b.y;
        this.hurtEnemy(e, this.damage, bx - b.vx * 0.02, by - b.vy * 0.02, 4.5);
        cam.shake(0.5, 0.05);
        if (this.explosiveRadius > 0) this.explode(bx, by);
        b.pierceLeft--;
        if (b.pierceLeft < 0 || b.hitCount >= 6) { dead = true; break; }
      }
      if (dead) this.bullets.free(b);
    }
  },

  updateOrbitals(dt) {
    if (this.orbitalCount <= 0) return;
    this.orbAngle += this.orbSpeed * dt;
    const R = 33;   // 22 * 1.5
    for (let o = 0; o < this.orbitalCount; o++) {
      const a = this.orbAngle + o * TAU / this.orbitalCount;
      const ox = this.px + Math.cos(a) * R, oy = this.py + Math.sin(a) * R;
      for (let j = this.enemies.n - 1; j >= 0; j--) {
        if (j >= this.enemies.n) continue;
        const e = this.enemies.items[j];
        if (e.bornT > 0 || e.lastOrb > 0) continue;
        if (circle(ox, oy, 3, e.x, e.y, e.r)) {
          e.lastOrb = 0.4;   // enfriamiento POR ENEMIGO: 4 orbes no lo cuadruplican
          this.hurtEnemy(e, this.orbDmg, ox, oy, 3);
        }
      }
    }
  },

  updateSpits(dt) {
    for (let i = this.spits.n - 1; i >= 0; i--) {
      const s = this.spits.items[i];
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0 || s.x < PF_X0 - 12 || s.x > PF_X1 + 12 || s.y < PF_Y0 - 12 || s.y > PF_Y1 + 12) {
        this.spits.free(s); continue;
      }
      if (circle(this.px, this.py, 3.9, s.x, s.y, 3)) {
        this.hurtRomina(1, s.x, s.y);
        this.spits.free(s);
      }
    }
  },

  updateShards(dt, forceMagnet) {
    const px = this.px, py = this.py;
    for (let i = this.shards.n - 1; i >= 0; i--) {
      const s = this.shards.items[i];
      s.life -= dt;
      if (s.life <= 0) { this.shards.free(s); continue; }
      const dx = px - s.x, dy = py - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!s.mag && (forceMagnet || d < this.magnetRadius)) {
        s.mag = true;
        burst(s.x, s.y, 1, { rnd:this.rnd, colors:RAMP_COOL, speed:1, life:0.08, size:2 });
      }
      if (s.mag) {
        // Aceleracion sin tope: la deriva lenta se vuelve un tiron.
        s.vx += dx / d * 510 * dt; s.vy += dy / d * 510 * dt;
      } else {
        s.vx *= 0.90; s.vy *= 0.90;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (d < 7.5) {
        this.combo = Math.min(this.combo + 1, 11); this.comboT = 0.9;
        burst(s.x, s.y, 3, { rnd:this.rnd, colors:RAMP_COOL, speed:70, life:0.16, size:2 });
        SFX.coin();
        this.shards.free(s);
      }
    }
  },

  updateHeals(dt) {
    for (let i = this.heals.n - 1; i >= 0; i--) {
      const h = this.heals.items[i];
      h.t += dt;
      if (circle(this.px, this.py, 3.9, h.x, h.y, 9)) {
        this.hp = Math.min(this.hp + 2, this.maxHp);
        this.wavesSinceHeal = 0;
        burst(h.x, h.y, 14, { rnd:this.rnd, colors:RAMP_HEAL, speed:120, life:0.5, size:2, grav:-90 });
        this.flashCol = P.gr; this.flashA = 0.22;
        cam.shake(1, 0.1); SFX.powerup(); vibrate(25);
        this.heals.free(h);
      }
    }
  },

  // -------------------------------------------------------------------------
  // INPUT
  // -------------------------------------------------------------------------
  onInput(ev, ctx) {
    if (this.state === S_DEAD) return;

    if (this.state === S_CARDS) {
      if (ev.type !== 'down' || this.cardPick >= 0 || !this.cards) return;
      // Adopcion en pointerdown: la eleccion se resuelve en el mismo frame.
      for (let i = 0; i < 3; i++) {
        const y = 192 + i * 108;
        if (ev.y >= y - 12 && ev.y <= y + 105) {
          this.cardPick = i;
          this.cardFlash = 0.12;
          this.applyUpgrade(this.cards[i]);
          this.state = S_OUT; this.stateT = 0;
          SFX.select(); vibrate(25);
          return;
        }
      }
      return;
    }

    // El stick nace donde caiga el pulgar, en cualquier parte de la pantalla.
    if (ev.type === 'down') this.stick.down(ev);
    else if (ev.type === 'move') this.stick.move(ev);
    else this.stick.up(ev);
  },

  // -------------------------------------------------------------------------
  // DRAW
  // -------------------------------------------------------------------------
  draw(g, ctx) {
    // Fondo: rejilla tenue que da sensacion de arena y de movimiento propio.
    g.fillStyle = P.bg; g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#1b0e33';
    for (let x = PF_X0; x < PF_X1; x += 30) g.fillRect(x, PF_Y0, 1, PF_Y1 - PF_Y0);
    for (let y = PF_Y0; y < PF_Y1; y += 30) g.fillRect(PF_X0, y, PF_X1 - PF_X0, 1);
    g.fillStyle = P.dk;
    g.fillRect(PF_X0 - 2, PF_Y0 - 2, PF_X1 - PF_X0 + 4, 2);
    g.fillRect(PF_X0 - 2, PF_Y1, PF_X1 - PF_X0 + 4, 2);
    g.fillRect(PF_X0 - 2, PF_Y0, 2, PF_Y1 - PF_Y0);
    g.fillRect(PF_X1, PF_Y0, 2, PF_Y1 - PF_Y0);

    // Avisos de aparicion (debajo de los enemigos)
    for (let i = 0; i < this.warns.n; i++) {
      const w = this.warns.items[i];
      // Parpadeo 100ms visible / 60ms oculto sobre el tiempo ya transcurrido.
      const el = (0.35 - w.t) * 1000;
      if (el - Math.floor(el / 160) * 160 < 100) {
        g.globalAlpha = 0.6;
        spr(g, this.sWarn[E_WARN[w.type]], w.x, w.y);
        g.globalAlpha = 1;
      }
    }

    // Curaciones
    for (let i = 0; i < this.heals.n; i++) {
      const h = this.heals.items[i];
      const bob = Math.round(Math.sin(h.t * 3) * 1.5);
      spr(g, ((h.t * 5) | 0) & 1 ? this.sHeartW : this.sHeart, h.x, h.y + bob);
    }

    // Fragmentos de XP
    for (let i = 0; i < this.shards.n; i++) {
      const s = this.shards.items[i];
      if (s.life < 2 && ((s.life * 8) | 0) & 1) continue;   // parpadeo final
      const bob = Math.round(Math.sin(this.t * 4 + s.ph) * 1.5);
      spr(g, this.sShard[s.val >= 4 ? 2 : s.val >= 2 ? 1 : 0], s.x, s.y + bob);
    }

    // Enemigos
    for (let i = 0; i < this.enemies.n; i++) {
      const e = this.enemies.items[i];
      if (e.bornT > 0) {
        // Naciendo tras partir un tank: pequeno y quieto.
        spr(g, this.sGruntSmall, e.x, e.y);
        continue;
      }
      let f = e.frame;
      if (e.type === E_RUNNER && e.st === 1) f = 2;
      else if (e.type === E_SPITTER && e.chargeT > 0) f = 2;
      const set = e.hitT > 0 ? this.sEnemyW[e.type] : this.sEnemy[e.type];
      spr(g, set[f] || set[0], e.x, e.y);
    }

    // Escupitajos
    for (let i = 0; i < this.spits.n; i++) {
      const s = this.spits.items[i];
      spr(g, this.sSpit, s.x, s.y);
    }

    // Balas: halo grande los primeros 60ms, luego el nucleo.
    for (let i = 0; i < this.bullets.n; i++) {
      const b = this.bullets.items[i];
      spr(g, b.life > 2.14 ? this.sBulletG : this.sBullet, b.x, b.y);
    }

    // Orbitales
    if (this.orbitalCount > 0) {
      const R = 33;
      for (let o = 0; o < this.orbitalCount; o++) {
        const a = this.orbAngle + o * TAU / this.orbitalCount;
        spr(g, this.sOrb, this.px + Math.cos(a) * R, this.py + Math.sin(a) * R);
      }
    }

    // Romina
    if (this.state === S_DEAD) {
      spr(g, this.sRomDead, this.px, this.py);
    } else {
      // Durante los iFrames alterna 4 frames blanca / 4 normal.
      const flash = this.iFrames > 0 && (((this.iFrames * 1000 / 66) | 0) & 1) === 0;
      const set = flash ? this.sRomW[this.facing] : this.sRom[this.facing];
      spr(g, set[this.walkFrame], this.px, this.py);
    }

    // Stick flotante: solo mientras el dedo esta apoyado.
    if (this.stick.active && this.state === S_PLAY) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy), R = 39;
      g.globalAlpha = 0.35; g.fillStyle = P.pur;
      g.fillRect(ox - R, oy - R, R * 2, 3); g.fillRect(ox - R, oy + R - 3, R * 2, 3);
      g.fillRect(ox - R, oy - R, 3, R * 2); g.fillRect(ox + R - 3, oy - R, 3, R * 2);
      g.globalAlpha = 0.55; g.fillStyle = P.cy;
      g.fillRect(Math.round(this.stick.ox + this.stick.dx * R) - 4,
                 Math.round(this.stick.oy + this.stick.dy * R) - 4, 8, 8);
      g.globalAlpha = 1;
    }

    this.drawHud(g);

    // Numero de oleada gigante durante el vacio y el compas previo.
    if (this.state === S_VACUUM && this.stateT > 0.24) {
      const k = clamp((this.stateT - 0.24) * 7.5, 0, 1);
      const s = k < 1 ? 3 : 4;
      textCenter(g, 'OLEADA ' + this.wave, VW / 2, 260, P.wh, 2);
      textCenter(g, String(this.wave), VW / 2, 285, P.cy, s);
    }
    if (this.state === S_BEAT) {
      textCenter(g, 'OLEADA ' + (this.wave + 1), VW / 2, 285, P.cy, 3);
    }
    if (this.cleanT > 0) {
      textCenter(g, 'LIMPIA +' + this.cleanBonus, VW / 2, 220, P.ye, 2);
    }

    if (this.state === S_CARDS || this.state === S_OUT) this.drawCards(g);

    // Destello de pantalla: uno solo por frame, nunca acumulado.
    if (this.flashA > 0 && this.flashCol) {
      g.globalAlpha = this.flashA; g.fillStyle = this.flashCol;
      g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
    }
  },

  drawHud(g) {
    g.fillStyle = P.out; g.fillRect(0, 0, VW, PF_Y0 - 3);

    text(g, 'ROMINA', 9, 5, P.pink, 2);
    const sc = Math.floor(this.score);
    if (sc !== this.hudScoreVal) { this.hudScoreVal = sc; this.hudScore = String(sc); }
    text(g, this.hudScore, VW - 9 - measure(this.hudScore, 2), 5, P.wh, 2);

    // Corazones
    for (let i = 0; i < this.maxHp; i++) {
      spr(g, i < this.hp ? this.sHpFull : this.sHpEmpty, 14 + i * 11, 27);
    }
    const ws = 'W' + this.wave;
    text(g, ws, VW - 9 - measure(ws, 2), 21, P.cy, 2);

    // Barra de progreso de oleada: el unico tutorial del juego.
    const bw = PF_X1 - PF_X0;
    g.fillStyle = P.pur; g.fillRect(PF_X0, 38, bw, 6);
    g.fillStyle = P.out; g.fillRect(PF_X0 + 1, 39, bw - 2, 4);
    const done = this.budgetTotal - this.budgetLeft - this.enemies.n - this.warns.n;
    const f = clamp(done / this.budgetTotal, 0, 1);
    g.fillStyle = this.heat >= 24 ? P.mag : this.heat >= 12 ? P.ye : P.cy;
    g.fillRect(PF_X0 + 1, 39, Math.round((bw - 2) * f), 4);
  },

  drawCards(g) {
    // El fondo se atenua con UN rect, nunca con blur.
    g.globalAlpha = 0.45; g.fillStyle = P.out; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
    textCenter(g, 'ELIGE UNA MEJORA', VW / 2, 150, P.wh, 2);

    const slide = this.state === S_OUT
      ? clamp(this.stateT / 0.12, 0, 1) * 60
      : (1 - Math.sqrt(clamp(this.stateT / 0.18, 0, 1))) * 60;

    for (let i = 0; i < 3; i++) {
      const u = UPG[this.cards[i]];
      const stag = clamp((this.stateT - i * 0.04) / 0.18, 0, 1);
      const off = this.state === S_OUT ? slide : (1 - Math.sqrt(stag)) * 60;
      const y = Math.round(192 + i * 108 + off);
      const picked = this.cardPick === i;
      g.fillStyle = picked && this.cardFlash > 0 ? P.wh : P.dk;
      g.fillRect(PF_X0, y, PF_X1 - PF_X0, 93);
      g.fillStyle = P.pur; g.fillRect(PF_X0, y, PF_X1 - PF_X0, 2);
      g.fillRect(PF_X0, y + 91, PF_X1 - PF_X0, 2);
      g.fillRect(PF_X0, y, 2, 93); g.fillRect(PF_X1 - 2, y, 2, 93);
      g.fillStyle = u.col; g.fillRect(PF_X0, y, PF_X1 - PF_X0, 2);
      // Bloque de icono: cuadro de color con el rango actual encima.
      g.fillStyle = P.out; g.fillRect(PF_X0 + 10, y + 20, 52, 52);
      g.fillStyle = u.col; g.fillRect(PF_X0 + 14, y + 24, 44, 44);
      g.fillStyle = P.out; g.fillRect(PF_X0 + 22, y + 32, 28, 28);
      textCenter(g, String(this.ranks[this.cards[i]] + 1), PF_X0 + 36, y + 38, u.col, 3);

      text(g, u.name, PF_X0 + 72, y + 22, u.col, 3);
      text(g, this.upgradeValue(this.cards[i]), PF_X0 + 72, y + 52, P.wh, 2);
    }
  },

  destroy() {
    this.enemies = this.bullets = this.spits = this.shards = this.heals = this.warns = null;
    this.stick = null;
    this.sRom = this.sRomW = this.sEnemy = this.sEnemyW = this.sWarn = this.sShard = null;
  },
};
