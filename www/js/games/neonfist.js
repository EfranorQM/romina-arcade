// NEON FIST - brawler de arena. Romina sola en una jaula de neon.
// Cada golpe alimenta un combo que empieza a morir apenas dejas de pegar.
// El dash atraviesa y hace dano: esquivar TAMBIEN es atacar.
// Coordenadas escaladas 1.5x desde el diseno original de 180x400 -> 270x600.
import { VW, VH, Pool, makeRng, clamp, cam, aabb, circle, Save } from '../core.js';
import { bake, bakeFlash, spr, burst } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';

const P = {
  out:'#07030f', bg:'#140a26', dk:'#25123f', dk2:'#3d1a5c',
  pur:'#6a1f7a', vio:'#a3218f', mag:'#e0249a', pink:'#ff5cc8',
  nvy:'#1d47a0', blue:'#2a8ce0', cy:'#4de0f0',
  ye:'#f2f24a', gold:'#ffcd75', grey:'#d9dce6', wh:'#ffffff',
};

// --- Arena (diseno 8..172 / 30..260 escalado 1.5x) ---
const AX0 = 12, AX1 = 258, AY0 = 45, AY1 = 390;
const AW = AX1 - AX0, AH = AY1 - AY0;

// --- Sprites: arrays de strings, horneados UNA vez en init() ---
// Romina de frente. 1=contorno 2=chaqueta 3=brillo hombro 4=piel 5=pelo 6=botas 7=puno
const ROM_D = [
  '..5555..',
  '.155551.',
  '.144441.',
  '.141141.',
  '.123321.',
  '7122221.',
  '7122221.',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const ROM_U = [
  '..5555..',
  '.155551.',
  '.155551.',
  '.132231.',
  '.123321.',
  '7122221.',
  '7122221.',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const ROM_R = [
  '..5551..',
  '.155541.',
  '.144441.',
  '.141141.',
  '.123321.',
  '.1233217',
  '.1232217',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const RMAP = { '1':P.out, '2':P.mag, '3':P.pink, '4':P.gold, '5':P.vio, '6':P.dk, '7':P.cy };
const RMAP_OD = { '1':P.out, '2':P.mag, '3':P.pink, '4':P.gold, '5':P.vio, '6':P.dk, '7':P.wh };

// Grunt 8x8: cuerpo violeta, ojos rojos (lo unico saturado)
const GRUNT = [
  '..1111..',
  '.122221.',
  '12222221',
  '13232321',
  '12222221',
  '12222221',
  '.122221.',
  '.1.11.1.',
];
const GMAP = { '1':P.out, '2':P.dk2, '3':P.mag };

// Charger 10x10: mas corpulento, cuerno en el frente
const CHG = [
  '..444444..',
  '.14444441.',
  '1122222211',
  '1233333321',
  '1233333321',
  '1233333321',
  '1233333321',
  '.123333210',
  '.12222210.',
  '.11.11.11.',
];
const CMAP  = { '1':P.out, '2':P.vio, '3':P.vio, '4':P.pink, '0':P.out };
const CMAP_T = { '1':P.out, '2':P.vio, '3':P.vio, '4':P.ye,   '0':P.out };
const CMAP_S = { '1':P.out, '2':P.dk2, '3':P.pur, '4':P.dk2,  '0':P.out };

// Ranged 8x10: azul, el unico de familia fria
const RNG = [
  '..1111..',
  '.122221.',
  '12233221',
  '12433221',
  '12222221',
  '15522221',
  '15522221',
  '12222221',
  '.122221.',
  '.11..11.',
];
const NMAP  = { '1':P.out, '2':P.nvy, '3':P.blue, '4':P.ye, '5':P.cy };
const NMAP_W = { '1':P.out, '2':P.nvy, '3':P.blue, '4':P.ye, '5':P.wh };

// Shielded 10x12: la losa gris es la unica pieza metalica del juego
const SHD = [
  '.11111111.',
  '.14444441.',
  '.13333331.',
  '.13333331.',
  '1122222211',
  '1222522221',
  '1222222221',
  '1222222221',
  '1222222221',
  '.12222221.',
  '.12222221.',
  '.11....11.',
];
const DMAP = { '1':P.out, '2':P.pur, '3':P.grey, '4':P.wh, '5':P.ye };

// Exploder 9x9: el unico cuerpo amarillo
const EXP = [
  '...141...',
  '..11311..',
  '.1222221.',
  '122222221',
  '122222221',
  '122222221',
  '155222551',
  '.1555551.',
  '..11111..',
];
const EMAP = { '1':P.out, '2':P.ye, '3':P.out, '4':P.wh, '5':P.mag };

// Power-ups 7x7
const PU_HP = [
  '.11111.',
  '1233321',
  '1233321',
  '1223221',
  '.12221.',
  '..121..',
  '...1...',
];
const HMAP = { '1':P.out, '2':P.mag, '3':P.pink };
const PU_OD = [
  '...11..',
  '..131..',
  '.1331..',
  '1333331',
  '..1331.',
  '..131..',
  '..11...',
];
const OMAP = { '1':P.out, '3':P.cy };
const PU_SW = [
  '..111..',
  '.13331.',
  '1311131',
  '1313131',
  '1311131',
  '.13331.',
  '..111..',
];
const SMAP = { '1':P.out, '3':P.ye };

// Glifos de los botones (dibujados una vez, no por frame)
const FIST = [
  '..111111..',
  '.13333331.',
  '1322222231',
  '1322222231',
  '1322222231',
  '1322222231',
  '1322222231',
  '1322222231',
  '.13333331.',
  '..111111..',
];
const FMAP = { '1':P.out, '2':P.cy, '3':P.wh };
const CHEV = [
  '..1..1..',
  '.11.11..',
  '111111..',
  '.11.11..',
  '..1..1..',
];
const VMAP = { '1':P.ye };

const T_GRUNT = 0, T_CHARGER = 1, T_RANGED = 2, T_EXPLODER = 3, T_SHIELDED = 4;
// Estadisticas por tipo, escaladas 1.5x. Indices alineados con T_*.
const E_HP    = [1, 2, 1, 1, 3];
const E_SPD   = [39, 51, 45, 60, 30];
const E_HW    = [12, 15, 12, 15, 15];   // ancho de hitbox
const E_HH    = [12, 15, 15, 14, 18];   // alto de hitbox
const E_SCORE = [10, 25, 30, 20, 50];

// Direcciones cardinales: 0=abajo 1=arriba 2=izq 3=der
const DIRX = [0, 0, -1, 1];
const DIRY = [1, -1, 0, 0];
const TURN = [3, 2, 0, 1];   // giro de un cuarto: el escudo nunca re-encara de golpe

export default {
  meta: { id:'neonfist', title:'NEON FIST', tag:'GOLPEA Y ESQUIVA', colors:['#ff5c9d','#ffe14d'] },

  init(ctx, args) {
    const rnd = this.rnd = makeRng(args.seed >>> 0);

    // --- Horneado de sprites (una sola vez) ---
    // Romina: [dir][frame] donde frame 0/1 = caminar, 2 = punetazo
    const rrows = [ROM_D, ROM_U, ROM_R, ROM_R];
    this.sRom = new Array(4);
    this.sRomOD = new Array(4);
    for (let d = 0; d < 4; d++) {
      const rows = rrows[d];
      const flip = d === 2;
      this.sRom[d] = [bake(rows, RMAP, 3), bakeWalk(rows, RMAP, flip), bake(rows, RMAP, 3)];
      this.sRomOD[d] = [bake(rows, RMAP_OD, 3), bakeWalk(rows, RMAP_OD, flip), bake(rows, RMAP_OD, 3)];
      if (flip) { this.sRom[d][0] = mirror(this.sRom[d][0]); this.sRom[d][2] = mirror(this.sRom[d][2]);
                  this.sRomOD[d][0] = mirror(this.sRomOD[d][0]); this.sRomOD[d][2] = mirror(this.sRomOD[d][2]); }
    }
    this.sRomW = bakeFlash(ROM_D, 3);

    this.sGrunt = bake(GRUNT, GMAP, 3);
    this.sGruntW = bakeFlash(GRUNT, 3);
    this.sChg = [bake(CHG, CMAP, 3), bake(CHG, CMAP_T, 3), bake(CHG, CMAP_S, 3)];
    this.sChgW = bakeFlash(CHG, 3);
    this.sRng = [bake(RNG, NMAP, 3), bake(RNG, NMAP_W, 3)];
    this.sRngW = bakeFlash(RNG, 3);
    this.sShd = bake(SHD, DMAP, 3);
    this.sShdW = bakeFlash(SHD, 3);
    this.sExp = bake(EXP, EMAP, 3);
    this.sExpW = bakeFlash(EXP, 3);

    this.sPu = [bake(PU_HP, HMAP, 3), bake(PU_OD, OMAP, 3), bake(PU_SW, SMAP, 3)];
    this.sFist = bake(FIST, FMAP, 4);
    this.sChev = bake(CHEV, VMAP, 4);

    this.floor = bakeFloor();

    // --- Pools (SIEMPRE aqui, nunca a nivel de modulo) ---
    this.foes = new Pool(32, () => ({
      x:0, y:0, type:0, hp:0, dir:0, flash:0, born:0, dead:false,
      st:0, t:0, vx:0, vy:0, face:0, faceT:0, hitBy:-1, kb:0, kbx:0, kby:0,
      cool:0, strafe:1, strafeT:0, fuse:0, blip:0, stag:0, swingId:-1, shockId:-1, _i:0,
    }), null);
    this.bul = new Pool(48, () => ({ x:0, y:0, px:0, py:0, vx:0, vy:0, life:0, _i:0 }), null);
    this.pups = new Pool(8, () => ({ x:0, y:0, kind:0, life:0, ph:0, emit:0, _i:0 }), null);

    // --- Controles ---
    this.stick = new Stick(45, 8);
    // Subidos ~30px: en y=548 el boton caia sobre la barra de gestos de MIUI,
    // donde un toque puede sacarla de la app en vez de pegar.
    this.bPunch = new Button(206, 462, 39, 12);
    this.bDash  = new Button(126, 516, 28, 12);

    // --- Estado de Romina ---
    this.x = AX0 + AW / 2; this.y = AY0 + AH / 2;
    this.hp = 3; this.face = 0;
    this.pT = 0; this.pPhase = 0; this.pFist = 0;   // ciclo de punetazo
    this.dT = 0; this.dCd = 0; this.dvx = 0; this.dvy = 0;
    this.iframe = 0; this.hurtT = 0; this.kbx = 0; this.kby = 0; this.kbT = 0;
    this.walkT = 0; this.walkF = 0;
    this.dashId = 0; this.swingId = 0; this.shockId = 0;   // ids para no repetir un mismo golpe
    this.trailX = new Float32Array(8); this.trailY = new Float32Array(8);
    this.trailN = 0;

    // --- Estado de la partida ---
    this.t = 0; this.score = 0; this.combo = 0; this.topCombo = 0; this.comboT = 0;
    this.pop = 0; this.milestone = 0;
    this.kills = 0;
    this.spawnT = 1.0;
    this.hitstop = 0; this.flashT = 0; this.flashCol = P.wh; this.flashMax = 0;
    this.dead = false; this.deadT = 0;
    this.overdrive = 0;
    this.shock = -1; this.shockR = 0;
    this.beat = 0;
    this.lastEdge = -1; this.edgeRun = 0;
    this.banner = 0; this.bannerDone = false;
    this.best = Save.best('neonfist');   // solo lectura: el guardado lo hace ctx.gameOver
    this.msg = ''; this.msgT = 0;
  },

  // ---------- Utilidades de partida ----------

  comboWindow() { return Math.max(1.1, 1.9 - this.combo * 0.022); },

  mult() { return Math.min(6, 1 + Math.floor(this.combo / 5) * 0.5); },

  // Un golpe que conecta: sube combo, resetea ventana, suena el escalon de tono.
  addCombo() {
    const tierBefore = Math.floor(this.combo / 5);
    this.combo++;
    if (this.combo > this.topCombo) this.topCombo = this.combo;
    this.comboT = this.comboWindow();
    this.pop = 5 / 60;
    if (Math.floor(this.combo / 5) > tierBefore) SFX.blip();
    if (this.combo % 10 === 0) {
      this.milestone = 10 / 60;
      burst(38, 92, 6, { rnd:this.rnd, colors:[P.ye, P.wh], speed:90, life:0.4, size:2, grav:-60 });
    }
  },

  award(base) {
    this.score += Math.round(base * this.mult());
    if (!this.bannerDone && this.best > 0 && this.score > this.best) {
      this.bannerDone = true; this.banner = 0.9; SFX.wave();
    }
  },

  fullFlash(col, frames) {
    this.flashCol = col; this.flashMax = frames / 60; this.flashT = this.flashMax;
  },

  // ---------- Enemigos ----------

  spawnFoe() {
    const t = this.t;
    // Pesos por tipo: cada uno se presenta SOLO, asi el juego se ensena sin tutorial.
    const w0 = Math.max(30, 100 - t * 0.8);
    const w1 = t < 8 ? 0 : Math.min(70, (t - 8) * 3.0);
    const w2 = t < 20 ? 0 : Math.min(55, (t - 20) * 2.6);
    const w3 = t < 34 ? 0 : Math.min(40, (t - 34) * 2.2);
    const w4 = t < 48 ? 0 : Math.min(45, (t - 48) * 2.0);
    const tot = w0 + w1 + w2 + w3 + w4;
    let r = this.rnd() * tot, type = T_GRUNT;
    if (r < w0) type = T_GRUNT;
    else if ((r -= w0) < w1) type = T_CHARGER;
    else if ((r -= w1) < w2) type = T_RANGED;
    else if ((r -= w2) < w3) type = T_EXPLODER;
    else type = T_SHIELDED;

    // Borde: no mas del 40% seguido del mismo lado, y nunca a menos de 67px de Romina.
    let ex = 0, ey = 0, edge = 0;
    for (let tries = 0; tries < 6; tries++) {
      edge = this.rnd.int(0, 3);
      if (edge === this.lastEdge && this.edgeRun >= 2 && tries < 4) continue;
      if (edge === 0)      { ex = AX0 + this.rnd() * AW; ey = AY0 - 15; }
      else if (edge === 1) { ex = AX0 + this.rnd() * AW; ey = AY1 + 15; }
      else if (edge === 2) { ex = AX0 - 15; ey = AY0 + this.rnd() * AH; }
      else                 { ex = AX1 + 15; ey = AY0 + this.rnd() * AH; }
      const dx = ex - this.x, dy = ey - this.y;
      if (dx * dx + dy * dy > 67 * 67) break;
    }
    if (edge === this.lastEdge) this.edgeRun++; else { this.lastEdge = edge; this.edgeRun = 0; }

    const e = this.foes.spawn();
    if (!e) return;
    e.x = ex; e.y = ey; e.type = type; e.hp = E_HP[type];
    e.st = 0; e.t = 0; e.vx = 0; e.vy = 0; e.dir = 0; e.face = 0; e.faceT = 0;
    e.flash = 0; e.born = 0.5; e.dead = false;
    e.hitBy = -1; e.swingId = -1; e.shockId = -1;
    e.kb = 0; e.kbx = 0; e.kby = 0;
    e.cool = type === T_RANGED ? 0.4 : 0; e.strafe = this.rnd.chance(0.5) ? 1 : -1;
    e.strafeT = 1.4; e.fuse = 0; e.blip = 0; e.stag = 0;
  },

  // Devuelve true si el golpe conecto (para combo). from: 0=punch 1=dash 2=shock 3=blast
  damageFoe(e, dmg, from, sx, sy) {
    if (e.born > 0) return false;
    // El escudo anula todo el dano en su arco frontal de 180 grados.
    if (e.type === T_SHIELDED && (from === 0 || from === 1)) {
      const fx = DIRX[e.face], fy = DIRY[e.face];
      const dx = sx - e.x, dy = sy - e.y;
      if (dx * fx + dy * fy > 0) {
        burst(e.x + fx * 12, e.y + fy * 12, 3,
          { rnd:this.rnd, colors:[P.wh, P.grey], speed:120, life:0.2, size:2 });
        this.hitstop = Math.max(this.hitstop, 0.06);
        SFX.brick();
        return false;   // ni combo ni refresco: machacar el escudo cuesta la partida
      }
      e.kb = 0.25; e.kbx = -fx * 60; e.kby = -fy * 60; e.stag = 0.25;
    }
    if (e.type === T_CHARGER && e.st === 3) dmg *= 2;   // aturdido = dano doble
    e.hp -= dmg; e.flash = 4 / 60;
    if (e.hp <= 0) this.killFoe(e, from);
    return true;
  },

  killFoe(e, from) {
    // El exploder cebado (st===1) siempre estalla: ya se comprometio.
    // Pero matarlo ANTES de que se cebe lo desactiva limpiamente, si ella esta
    // fuera del radio. Que muera igual estando lejos se sentia tramposo:
    // castigaba justo la respuesta correcta, que es matarlo a distancia.
    if (e.type === T_EXPLODER && e.st !== 1) {
      const far = Math.hypot(e.x - this.x, e.y - this.y) > 58;
      if (!far) { e.st = 1; e.t = 0; e.hp = 1; e.blip = 0; return; }
    }
    e.dead = true;
    this.kills++;
    this.award(E_SCORE[e.type]);
    this.comboT = Math.min(this.comboWindow(), this.comboT + 0.25);   // matar compra aire
    burst(e.x, e.y, 12, { rnd:this.rnd, colors:[P.wh, P.pink, P.mag, P.dk2], speed:130, life:0.32, size:3 });
    burst(e.x, e.y, 3, { rnd:this.rnd, colors:[P.mag, P.dk2], speed:70, life:0.5, size:3, grav:200 });
    cam.shake(3, 0.14);
    this.hitstop = Math.max(this.hitstop, from === 3 ? 0 : 7 / 60);
    SFX.explode(); vibrate(18);
    // Los drops caen en cuenta determinista: la jugadora aprende el ritmo sin saberlo.
    if (this.kills % 30 === 0) this.dropPup(e.x, e.y, 2);
    else if (this.kills % 20 === 0) this.dropPup(e.x, e.y, 1);
    else if (this.kills % 12 === 0) this.dropPup(e.x, e.y, 0);
    this.foes.free(e);
  },

  dropPup(x, y, kind) {
    const p = this.pups.spawn();
    if (!p) return;
    p.x = clamp(x, AX0 + 8, AX1 - 8); p.y = clamp(y, AY0 + 8, AY1 - 8);
    p.kind = kind; p.life = 8; p.ph = 0; p.emit = 0;
  },

  detonate(e) {
    const R = 39;
    this.fullFlash(P.ye, 4);
    cam.shake(5, 0.26);
    this.hitstop = Math.max(this.hitstop, 10 / 60);
    SFX.explode(); vibrate(25);
    burst(e.x, e.y, 22, { rnd:this.rnd, colors:[P.wh, P.ye, P.pink, P.mag], speed:220, life:0.45, size:3 });
    let chained = 0;
    for (let i = this.foes.n - 1; i >= 0; i--) {
      const o = this.foes.items[i];
      if (o === e || o.dead) continue;
      if (circle(o.x, o.y, E_HW[o.type] * 0.5, e.x, e.y, R)) {
        if (this.damageFoe(o, 2, 3, e.x, e.y)) chained++;
      }
    }
    if (chained > 0) this.award(15 * chained);
    if (this.iframe <= 0 && circle(this.x, this.y, 5, e.x, e.y, R)) this.hurt(e.x, e.y);
    e.dead = true;
    this.foes.free(e);
  },

  hurt(sx, sy) {
    if (this.iframe > 0 || this.dead) return;
    this.hp--;
    this.iframe = 0.9;
    const dx = this.x - sx, dy = this.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    this.kbx = dx / d * 60; this.kby = dy / d * 60; this.kbT = 0.2;
    this.fullFlash(P.wh, 5);
    cam.shake(6, 0.3);
    SFX.hurt(); vibrate(30);
    this.combo = 0; this.comboT = 0;
    if (this.hp <= 0) {
      this.dead = true; this.deadT = 0;
      this.hitstop = 13 / 60;
      cam.shake(8, 0.4);
      this.fullFlash(P.wh, 8);
      burst(this.x, this.y, 26, { rnd:this.rnd, colors:[P.wh, P.pink, P.mag], speed:200, life:0.6, size:3, grav:260 });
      SFX.explode();   // el jingle de fin lo pone la capa compartida
    }
  },

  // ---------- Acciones ----------

  tryPunch() {
    if (this.dead || this.pT > 0) return;    // el punetazo no se cancela con otro punetazo
    this.pT = this.overdrive > 0 ? 0.15 : 0.26;
    this.pPhase = 0; this.pFist ^= 1; this.swingId++;
    SFX.punch();
  },

  tryDash() {
    if (this.dead || this.dCd > 0 || this.hurtT > 0) return;
    let dx = this.stick.dx, dy = this.stick.dy;
    if (dx * dx + dy * dy < 0.04) { dx = DIRX[this.face]; dy = DIRY[this.face]; }
    const d = Math.hypot(dx, dy) || 1;
    this.dvx = dx / d * 285; this.dvy = dy / d * 285;
    this.dT = 0.18; this.iframe = Math.max(this.iframe, 0.24);
    this.dCd = this.overdrive > 0 ? 0.38 : 0.62;
    this.dashId++;
    this.pT = 0;                              // dash-cancel: techo de habilidad gratis
    this.trailN = 0;
    SFX.dash(); vibrate(8);
  },

  fireShock() {
    this.shock = 0; this.shockR = 0; this.shockId++;
    this.fullFlash(P.cy, 5);
    cam.shake(4, 0.2);
    SFX.wave(); vibrate(20);
  },

  // ---------- Bucle ----------

  update(dt, ctx) {
    // Hitstop: congela TODA la simulacion pero el render sigue. Es el efecto de mayor valor.
    if (this.hitstop > 0) { this.hitstop -= dt; if (this.flashT > 0) this.flashT -= dt; return; }

    if (this.flashT > 0) this.flashT -= dt;
    if (this.banner > 0) this.banner -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.pop > 0) this.pop -= dt;
    if (this.milestone > 0) this.milestone -= dt;
    this.beat += dt;

    if (this.dead) {
      this.deadT += dt;
      // Camara lenta 0.25x mientras la arena se congela, luego el marcador.
      if (this.deadT > 0.55) ctx.gameOver(this.score);
      return;
    }

    this.t += dt;
    const speedScalar = Math.min(1.35, 1 + this.t * 0.0035);

    if (this.iframe > 0) this.iframe -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.dCd > 0) this.dCd -= dt;
    if (this.overdrive > 0) this.overdrive -= dt;

    // --- Combo: la ventana se aprieta con el propio exito de la jugadora ---
    if (this.combo > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 0; this.comboT = 0; SFX.blip(); }
    }

    // --- Movimiento de Romina ---
    const sdx = this.stick.dx, sdy = this.stick.dy;
    const mag = Math.hypot(sdx, sdy);
    if (this.dT > 0) {
      this.dT -= dt;
      this.x += this.dvx * dt; this.y += this.dvy * dt;
      // Rastro: 4 posiciones pasadas dibujadas en silueta blanca
      this.trailX[this.trailN & 7] = this.x; this.trailY[this.trailN & 7] = this.y;
      this.trailN++;
    } else {
      if (mag > 0.001) {
        const nx = sdx / mag, ny = sdy / mag;
        const m = Math.min(1, mag);
        this.x += nx * 78 * m * dt; this.y += ny * 78 * m * dt;
        this.face = Math.abs(sdx) > Math.abs(sdy) ? (sdx < 0 ? 2 : 3) : (sdy < 0 ? 1 : 0);
        this.walkT += dt;
        if (this.walkT > 0.133) { this.walkT = 0; this.walkF ^= 1; }
      } else { this.walkF = 0; }
    }
    if (this.kbT > 0) {
      this.kbT -= dt;
      this.x += this.kbx * dt; this.y += this.kby * dt;
      this.kbx *= 0.88; this.kby *= 0.88;
    }
    this.x = clamp(this.x, AX0 + 6, AX1 - 6);
    this.y = clamp(this.y, AY0 + 6, AY1 - 6);

    // --- Ciclo de punetazo: 70ms arranque / 80ms activo / 110ms recuperacion ---
    let punchActive = false;
    if (this.pT > 0) {
      const total = this.overdrive > 0 ? 0.15 : 0.26;
      const el = total - this.pT;
      const a0 = total * 0.269, a1 = total * 0.577;
      punchActive = el >= a0 && el < a1;
      this.pT -= dt;
      if (this.pT <= 0) this.pT = 0;
    }

    // --- Caja de golpe del punetazo: un swing alcanza a TODOS los que toca ---
    if (punchActive) {
      const reach = this.overdrive > 0 ? 25 : 19;
      const dmg = this.overdrive > 0 ? 2 : 1;
      const fx = DIRX[this.face], fy = DIRY[this.face];
      const hx = this.x + fx * reach, hy = this.y + fy * reach;
      const bw = fx !== 0 ? 21 : 27, bh = fx !== 0 ? 27 : 21;
      const bx = hx - bw / 2, by = hy - bh / 2;
      let connected = false;
      for (let i = this.foes.n - 1; i >= 0; i--) {
        const e = this.foes.items[i];
        if (e.swingId === this.swingId) continue;   // un solo impacto por enemigo y por swing
        if (!aabb(bx, by, bw, bh,
                  e.x - E_HW[e.type] / 2, e.y - E_HH[e.type] / 2, E_HW[e.type], E_HH[e.type])) continue;
        e.swingId = this.swingId;
        if (this.damageFoe(e, dmg, 0, this.x, this.y)) { this.addCombo(); connected = true; }
      }
      // Balas: un punetazo bien puesto las desvia (+5 y +1 combo, premio escondido)
      for (let i = this.bul.n - 1; i >= 0; i--) {
        const b = this.bul.items[i];
        if (!aabb(bx, by, bw, bh, b.x - 3, b.y - 3, 6, 6)) continue;
        burst(b.x, b.y, 5, { rnd:this.rnd, colors:[P.wh, P.cy], speed:110, life:0.2, size:2 });
        this.award(5); this.addCombo(); SFX.brick();
        this.bul.free(b);
      }
      if (connected) {
        burst(hx, hy, 7, { rnd:this.rnd, colors:[P.wh, P.ye, P.pink, P.vio], speed:130, life:0.2, size:3 });
        this.hitstop = Math.max(this.hitstop, 4 / 60);
        cam.shake(2, 0.1);
        SFX.hit(); vibrate(14);
      }
    }

    // --- Onda expansiva en curso: cada muerte suya alimenta el combo por separado ---
    if (this.shock >= 0) {
      this.shock += dt;
      this.shockR = this.shock * 390;
      for (let i = this.foes.n - 1; i >= 0; i--) {
        const e = this.foes.items[i];
        if (e.shockId === this.shockId) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (Math.abs(d - this.shockR) < 18) {
          e.shockId = this.shockId;
          const dd = d || 1;
          e.kb = 0.2; e.kbx = (e.x - this.x) / dd * 150; e.kby = (e.y - this.y) / dd * 150;
          if (this.damageFoe(e, 2, 2, this.x, this.y)) this.addCombo();
        }
      }
      if (this.shockR > 105) { this.shock = -1; this.shockR = 0; }
    }

    // --- Enemigos ---
    for (let i = this.foes.n - 1; i >= 0; i--) {
      const e = this.foes.items[i];
      if (e.flash > 0) e.flash -= dt;
      if (e.born > 0) { e.born -= dt; }
      e.t += dt;
      const sp = E_SPD[e.type] * speedScalar;
      const dx = this.x - e.x, dy = this.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (e.kb > 0) {
        e.kb -= dt;
        e.x += e.kbx * dt; e.y += e.kby * dt;
        e.kbx *= 0.85; e.kby *= 0.85;
      }

      if (e.type === T_GRUNT) {
        // Recalcula rumbo cada 500ms: se bambolea en vez de perseguir perfecto (legible).
        if (e.t >= 0.5) { e.t = 0; e.vx = dx / dist; e.vy = dy / dist; }
        e.x += e.vx * sp * dt; e.y += e.vy * sp * dt;

      } else if (e.type === T_CHARGER) {
        if (e.st === 0) {                                 // STALK
          e.x += dx / dist * sp * dt; e.y += dy / dist * sp * dt;
          if (dist < 105 && e.born <= 0) {
            e.st = 1; e.t = 0;
            e.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
            SFX.alarm();
          }
        } else if (e.st === 1) {                          // TELEGRAPH: 480ms clavado
          if (e.t >= 0.48) { e.st = 2; e.t = 0; SFX.dash(); }
        } else if (e.st === 2) {                          // LUNGE: linea recta, sin seguimiento
          const lx = DIRX[e.face] * 225 * speedScalar, ly = DIRY[e.face] * 225 * speedScalar;
          e.x += lx * dt; e.y += ly * dt;
          const hitWall = e.x <= AX0 + 8 || e.x >= AX1 - 8 || e.y <= AY0 + 8 || e.y >= AY1 - 8;
          if (hitWall) {
            e.st = 3; e.t = 0;
            cam.shake(4, 0.18); SFX.punch();
            burst(e.x, e.y, 8, { rnd:this.rnd, colors:[P.ye, P.wh], speed:130, life:0.3, size:2 });
          } else if (e.t >= 0.45) { e.st = 4; e.t = 0; }
        } else if (e.st === 3) {                          // STUN: castigar una carga esquivada
          if (e.t >= 0.9) { e.st = 0; e.t = 0; }
        } else {                                          // recuperacion post-lunge
          if (e.t >= 0.35) { e.st = 0; e.t = 0; }
        }

      } else if (e.type === T_RANGED) {
        // Mantiene banda de 112-142px: castiga quedarse quieta.
        if (dist < 112) { e.x -= dx / dist * sp * dt; e.y -= dy / dist * sp * dt; }
        else if (dist > 142) { e.x += dx / dist * sp * dt; e.y += dy / dist * sp * dt; }
        else {
          e.strafeT -= dt;
          if (e.strafeT <= 0) { e.strafeT = 1.4; e.strafe = -e.strafe; }
          e.x += -dy / dist * 33 * speedScalar * e.strafe * dt;
          e.y += dx / dist * 33 * speedScalar * e.strafe * dt;
        }
        e.cool -= dt;
        if (e.st === 0 && e.cool <= 0 && e.born <= 0) { e.st = 1; e.t = 0; }
        if (e.st === 1 && e.t >= 0.3) {                   // 300ms de carga, luego dispara
          e.st = 0; e.cool = 1.8;
          const b = this.bul.spawn();
          if (b) {
            b.x = e.x; b.y = e.y; b.px = e.x; b.py = e.y;
            b.vx = dx / dist * 102; b.vy = dy / dist * 102; b.life = 5;
          }
          SFX.shoot();
        }

      } else if (e.type === T_EXPLODER) {
        if (e.st === 0) {
          e.x += dx / dist * sp * dt; e.y += dy / dist * sp * dt;
          if (dist < 33 && e.born <= 0) { e.st = 1; e.t = 0; e.blip = 0; }
        } else {
          // Cadencia de parpadeo acelerando: la urgencia se ve sin leer un numero.
          e.fuse = e.t;
          e.blip -= dt;
          if (e.blip <= 0) { e.blip = 0.2 - (e.t / 0.75) * 0.17; SFX.blip(); }
          if (e.t >= 0.75) { this.detonate(e); continue; }
        }

      } else {                                            // SHIELDED
        e.faceT -= dt;
        if (e.faceT <= 0) {
          // Solo gira 90 grados cada 400ms: no puede re-encarar a quien la flanquea.
          e.faceT = 0.4;
          const want = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
          if (want !== e.face) {
            e.face = (want === TURN[e.face]) ? want : TURN[e.face];
          }
        }
        if (e.stag > 0) e.stag -= dt;
        else if (e.t >= 0.25) { e.t = 0; e.vx = dx / dist; e.vy = dy / dist; }
        if (e.stag <= 0) { e.x += e.vx * sp * dt; e.y += e.vy * sp * dt; }
      }

      // Los enemigos quedan dentro (con margen de entrada) salvo el charger en lunge
      if (e.born <= 0) {
        e.x = clamp(e.x, AX0 + 4, AX1 - 4);
        e.y = clamp(e.y, AY0 + 4, AY1 - 4);
      }

      // Dash de Romina: es a la vez esquive y ataque
      if (this.dT > 0 && e.hitBy !== this.dashId && e.born <= 0) {
        if (aabb(this.x - 7, this.y - 7, 15, 15,
                 e.x - E_HW[e.type] / 2, e.y - E_HH[e.type] / 2, E_HW[e.type], E_HH[e.type])) {
          e.hitBy = this.dashId;
          if (this.damageFoe(e, 1, 1, this.x - this.dvx * 0.05, this.y - this.dvy * 0.05)) {
            this.addCombo();
            this.hitstop = Math.max(this.hitstop, 4 / 60);
            cam.shake(2, 0.1);
            burst(e.x, e.y, 6, { rnd:this.rnd, colors:[P.wh, P.cy], speed:120, life:0.2, size:2 });
            SFX.hit(); vibrate(14);
          }
          continue;
        }
      }

      // Contacto: cuerpo, o embestida del charger. El exploder solo dana al estallar.
      if (this.iframe <= 0 && e.born <= 0 && e.type !== T_EXPLODER) {
        if (aabb(this.x - 4, this.y - 4, 9, 9,
                 e.x - E_HW[e.type] / 2, e.y - E_HH[e.type] / 2, E_HW[e.type], E_HH[e.type])) {
          this.hurt(e.x, e.y);
        }
      }
    }

    if (this.dead) return;

    // --- Balas ---
    for (let i = this.bul.n - 1; i >= 0; i--) {
      const b = this.bul.items[i];
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < AX0 - 8 || b.x > AX1 + 8 || b.y < AY0 - 8 || b.y > AY1 + 8) {
        this.bul.free(b); continue;
      }
      if (this.iframe <= 0 && aabb(this.x - 4, this.y - 4, 9, 9, b.x - 3, b.y - 3, 6, 6)) {
        this.hurt(b.x, b.y);
        this.bul.free(b);
        if (this.dead) return;
      }
    }

    // --- Power-ups: se recogen caminando encima, sin boton ---
    for (let i = this.pups.n - 1; i >= 0; i--) {
      const p = this.pups.items[i];
      p.life -= dt; p.ph += dt;
      p.emit -= dt;
      if (p.emit <= 0) {
        p.emit = 0.2;
        burst(p.x, p.y, 1, { rnd:this.rnd, colors:[P.pink], speed:24, life:0.4, size:2 });
      }
      if (p.life <= 0) { this.pups.free(p); continue; }
      if (circle(this.x, this.y, 6, p.x, p.y, 15)) {
        if (p.kind === 0) {
          if (this.hp < 3) { this.hp++; this.msg = 'VIDA'; }
          else { this.award(400); this.combo += 8; this.comboT = this.comboWindow(); this.msg = 'BONUS'; }
          SFX.coin();
        } else if (p.kind === 1) {
          this.overdrive = 6; this.msg = 'OVERDRIVE'; SFX.powerup();
        } else {
          this.fireShock(); this.msg = 'ONDA';
        }
        this.msgT = 0.9;
        burst(p.x, p.y, 14, { rnd:this.rnd, colors:[P.wh, P.ye, P.cy], speed:150, life:0.4, size:2 });
        this.pups.free(p);
      }
    }

    // --- Aparicion: intervalo y tope simultaneo crecen con el tiempo ---
    const maxAlive = Math.min(14, 3 + Math.floor(this.t / 12));
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.42, 1.6 - this.t * 0.011);
      if (this.foes.n < maxAlive) {
        this.spawnFoe();
        if (this.t > 70 && this.foes.n < maxAlive) this.spawnFoe();
      }
    }
  },

  onInput(ev, ctx) {
    if (this.dead) return;
    if (ev.type === 'down') {
      // Arbitraje fijo: primero el boton mas chico, luego el grande, luego el stick.
      if (this.bDash.down(ev)) { this.tryDash(); return; }
      if (this.bPunch.down(ev)) { this.tryPunch(); return; }
      // El stick nace donde caiga el pulgar en la mitad izquierda de la banda baja
      if (ev.x < 130 && ev.y > 400) { this.stick.down(ev); return; }
      // Un toque suelto sobre la arena tambien pega: nunca se siente muerto
      if (ev.y <= AY1 + 10) this.tryPunch();
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev);
      this.bPunch.up(ev);
      this.bDash.up(ev);
    }
  },

  draw(g, ctx) {
    g.fillStyle = P.out; g.fillRect(0, 0, VW, VH);
    // Piso horneado: un solo drawImage por frame
    g.drawImage(this.floor, AX0 - 6, AY0 - 6);

    // Tubos de neon pulsando al ritmo (swap de 2 colores, coste cero)
    const beatOn = ((this.beat * 2.4) | 0) & 1;
    g.fillStyle = beatOn ? P.pink : P.mag;
    g.fillRect(AX0 + AW / 2 - 14, AY0 - 3, 28, 3);
    g.fillRect(AX0 + AW / 2 - 14, AY1, 28, 3);
    g.fillRect(AX0 - 3, AY0 + AH / 2 - 14, 3, 28);
    g.fillRect(AX1, AY0 + AH / 2 - 14, 3, 28);

    // --- Carriles de aviso del charger, DEBAJO de todo ---
    for (let i = 0; i < this.foes.n; i++) {
      const e = this.foes.items[i];
      if (e.type !== T_CHARGER || e.st !== 1) continue;
      g.fillStyle = P.ye;
      const fx = DIRX[e.face], fy = DIRY[e.face];
      const march = (this.t * 90) % 10;
      for (let d = 12; d < 160; d += 10) {
        const px = e.x + fx * (d + march), py = e.y + fy * (d + march);
        if (px < AX0 || px > AX1 || py < AY0 || py > AY1) break;
        g.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4);
      }
    }

    // --- Anillo de peligro del exploder ---
    for (let i = 0; i < this.foes.n; i++) {
      const e = this.foes.items[i];
      if (e.type !== T_EXPLODER || e.st !== 1) continue;
      g.fillStyle = (0.75 - e.t) < 0.15 ? P.wh : P.ye;
      for (let k = 0; k < 20; k++) {
        const a = k * 0.31416;
        g.fillRect(Math.round(e.x + Math.cos(a) * 39) - 1, Math.round(e.y + Math.sin(a) * 39) - 1, 2, 2);
      }
    }

    // --- Power-ups ---
    for (let i = 0; i < this.pups.n; i++) {
      const p = this.pups.items[i];
      if (p.life < 2 && (((p.life * 15) | 0) & 1)) continue;   // parpadeo final
      spr(g, this.sPu[p.kind], p.x, p.y + Math.sin(p.ph * 4) * 2);
    }

    // --- Balas: estela de 1 frame + nucleo ---
    for (let i = 0; i < this.bul.n; i++) {
      const b = this.bul.items[i];
      g.fillStyle = P.nvy; g.fillRect(Math.round(b.px) - 2, Math.round(b.py) - 2, 4, 4);
      g.fillStyle = P.blue; g.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
      g.fillStyle = P.cy;  g.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
    }

    // --- Enemigos ---
    for (let i = 0; i < this.foes.n; i++) {
      const e = this.foes.items[i];
      if (e.born > 0) g.globalAlpha = 0.5;
      const flashing = e.flash > 0;
      if (e.type === T_GRUNT) {
        const bob = (((this.t * 6) | 0) & 1) ? -1 : 0;
        spr(g, flashing ? this.sGruntW : this.sGrunt, e.x, e.y + bob);
      } else if (e.type === T_CHARGER) {
        let s = this.sChg[0];
        if (e.st === 1) s = (((e.t * 10) | 0) & 1) ? this.sChgW : this.sChg[1];
        else if (e.st === 3) s = this.sChg[2];
        spr(g, flashing ? this.sChgW : s, e.x, e.y + (e.st === 3 ? 2 : 0));
        if (e.st === 3) {
          g.fillStyle = P.ye;
          for (let k = 0; k < 3; k++) {
            const a = this.t * 7 + k * 2.094;
            g.fillRect(Math.round(e.x + Math.cos(a) * 14) - 1, Math.round(e.y - 14 + Math.sin(a) * 5) - 1, 3, 3);
          }
        }
      } else if (e.type === T_RANGED) {
        spr(g, flashing ? this.sRngW : this.sRng[e.st === 1 ? 1 : 0], e.x, e.y);
      } else if (e.type === T_EXPLODER) {
        const fusing = e.st === 1 && (((e.t * (6 + e.t * 30)) | 0) & 1);
        spr(g, (flashing || fusing) ? this.sExpW : this.sExp, e.x, e.y);
      } else {
        spr(g, flashing ? this.sShdW : this.sShd, e.x, e.y + (e.stag > 0 ? 1 : 0));
        // La losa gris marca el lado duro: unica pieza metalica del juego, se lee sin palabras
        const fx = DIRX[e.face], fy = DIRY[e.face];
        const sx = Math.round(e.x + fx * 14) - (fx ? 2 : 15);
        const sy = Math.round(e.y + fy * 14) - (fy ? 2 : 15);
        const sw = fx ? 4 : 30, sh = fy ? 4 : 30;
        g.fillStyle = P.grey; g.fillRect(sx, sy, sw, sh);
        g.fillStyle = P.wh;   g.fillRect(sx, sy, fx ? 1 : sw, fy ? 1 : sh);
      }
      g.globalAlpha = 1;
    }

    // --- Rastro del dash: silueta blanca, 4 imagenes ---
    if (this.dT > 0 && this.trailN > 1) {
      for (let k = 3; k >= 0; k--) {
        const idx = this.trailN - 1 - k * 2;
        if (idx < 0) continue;
        g.globalAlpha = 0.15 + (3 - k) * 0.1;
        spr(g, this.sRomW, this.trailX[idx & 7], this.trailY[idx & 7]);
      }
      g.globalAlpha = 1;
    }

    // --- Romina ---
    const frame = this.pT > 0 ? 2 : (this.walkF ? 1 : 0);
    const set = this.overdrive > 0 ? this.sRomOD : this.sRom;
    const blink = this.iframe > 0 && (((this.iframe * 15) | 0) & 1);
    spr(g, blink ? this.sRomW : set[this.face][frame], this.x, this.y);
    // El puno cyan es lo mas brillante de la pantalla: dice de donde sale el dano
    if (this.pT > 0) {
      const reach = this.overdrive > 0 ? 25 : 19;
      g.fillStyle = this.overdrive > 0 ? P.wh : P.cy;
      g.fillRect(Math.round(this.x + DIRX[this.face] * reach) - 4,
                 Math.round(this.y + DIRY[this.face] * reach) - 4, 8, 8);
    }

    // --- Onda expansiva: 24 cuadros en la circunferencia, sin arcos ---
    if (this.shock >= 0) {
      g.fillStyle = this.shock < 0.09 ? P.wh : this.shock < 0.18 ? P.ye : P.mag;
      for (let k = 0; k < 24; k++) {
        const a = k * 0.2618;
        g.fillRect(Math.round(this.x + Math.cos(a) * this.shockR) - 1,
                   Math.round(this.y + Math.sin(a) * this.shockR) - 1, 3, 3);
      }
    }

    // --- Destello de pantalla completa (nunca se apilan) ---
    if (this.flashT > 0) {
      g.globalAlpha = (this.flashT / this.flashMax) * 0.5;
      g.fillStyle = this.flashCol; g.fillRect(0, 0, VW, VH);
      g.globalAlpha = 1;
    }

    this.drawHud(g);
    this.drawControls(g);
  },

  drawHud(g) {
    // Franja de HUD: fondo opaco para que nada del arena se cuele detras del texto
    g.fillStyle = P.out; g.fillRect(0, 0, VW, AY0 - 6);

    // Vidas: 3 punos arriba a la izquierda
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < this.hp ? P.mag : P.dk;
      g.fillRect(6 + i * 12, 4, 9, 9);
      if (i < this.hp) { g.fillStyle = P.pink; g.fillRect(6 + i * 12, 4, 9, 3); }
    }
    text(g, 'ROMINA', 6, 17, '#8a7ab8', 2);

    // Barra de overdrive bajo los punos: avisa su propio final parpadeando
    if (this.overdrive > 0) {
      const w = Math.round(54 * (this.overdrive / 6));
      const warn = this.overdrive < 1.5 && (((this.overdrive * 10) | 0) & 1);
      g.fillStyle = P.dk; g.fillRect(6, 33, 54, 4);
      g.fillStyle = warn ? P.wh : P.cy; g.fillRect(6, 33, w, 4);
    }

    // Marcador a la derecha
    const s = String(Math.floor(this.score));
    text(g, s, VW - 6 - measure(s, 3), 3, P.wh, 3);

    // Combo: la cifra da un salto de escala en cada golpe y destella en los multiplos de 10
    if (this.combo > 0) {
      const cs = this.pop > 0 ? 3 : 2;
      const col = this.milestone > 0 ? P.ye : P.wh;
      const cstr = this.combo + 'x';
      text(g, cstr, VW - 6 - measure(cstr, cs), 26, col, cs);
      // Barra de tiempo de combo: la fecha limite se siente sin leer un numero
      const f = clamp(this.comboT / this.comboWindow(), 0, 1);
      const bc = f < 0.2 ? P.mag : f < 0.4 ? P.ye : P.cy;
      const puls = f < 0.2 && (((this.comboT * 12) | 0) & 1);
      g.fillStyle = P.dk; g.fillRect(VW - 96, 20, 90, 3);
      if (!puls) { g.fillStyle = bc; g.fillRect(VW - 96, 20, Math.round(90 * f), 3); }
    }

    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, AY1 + 10, P.ye, 3);
    if (this.banner > 0) textCenter(g, 'ROMINA! NUEVO RECORD!', VW / 2, AY1 + 34, P.ye, 2);
  },

  drawControls(g) {
    // Joystick flotante: solo se dibuja cuando el pulgar lo despierta
    if (this.stick.active) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy);
      g.globalAlpha = 0.3;
      g.fillStyle = P.cy;
      g.fillRect(ox - 34, oy - 34, 68, 3); g.fillRect(ox - 34, oy + 31, 68, 3);
      g.fillRect(ox - 34, oy - 34, 3, 68); g.fillRect(ox + 31, oy - 34, 3, 68);
      g.globalAlpha = 1;
      g.fillStyle = P.wh;
      g.fillRect(Math.round(ox + this.stick.dx * 34) - 5, Math.round(oy + this.stick.dy * 34) - 5, 11, 11);
    } else {
      // Pista discreta de donde vive el stick
      g.globalAlpha = 0.16;
      g.fillStyle = P.cy;
      g.fillRect(46, 498, 40, 3); g.fillRect(64, 480, 3, 40);
      g.globalAlpha = 1;
    }

    // Boton de dash (mas chico, se comprueba primero)
    g.globalAlpha = this.bDash.pressed ? 0.95 : (this.dCd > 0 ? 0.3 : 0.7);
    g.fillStyle = P.dk2;
    g.fillRect(this.bDash.x - 28, this.bDash.y - 28, 56, 56);
    g.globalAlpha = 1;
    spr(g, this.sChev, this.bDash.x, this.bDash.y);

    // Boton de punetazo (primario, el mas grande)
    g.globalAlpha = this.bPunch.pressed ? 0.95 : 0.75;
    g.fillStyle = P.vio;
    g.fillRect(this.bPunch.x - 38, this.bPunch.y - 38, 76, 76);
    g.globalAlpha = 1;
    spr(g, this.sFist, this.bPunch.x, this.bPunch.y);
  },

  destroy() { this.foes = this.bul = this.pups = null; this.floor = null; },
};

// --- Helpers de horneado (fuera del bucle, se usan solo en init) ---

// Segundo frame de caminata: el sprite entero baja 1px (las piernas alternan).
function bakeWalk(rows, map, flip) {
  const out = new Array(rows.length);
  const blank = rows[0].replace(/./g, '.');
  out[0] = blank;
  for (let i = 1; i < rows.length; i++) out[i] = rows[i - 1];
  const c = bake(out, map, 3);
  return flip ? mirror(c) : c;
}

function mirror(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(src.width, 0); c.scale(-1, 1);
  c.drawImage(src, 0, 0);
  return cv;
}

// Piso de la arena: rejilla + marco + esquinas, horneado una sola vez.
function bakeFloor() {
  const w = AX1 - AX0 + 12, h = AY1 - AY0 + 12;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = P.bg; c.fillRect(0, 0, w, h);
  c.fillStyle = P.dk;
  for (let x = 6; x < w - 6; x += 24) c.fillRect(x, 6, 1, h - 12);
  for (let y = 6; y < h - 6; y += 24) c.fillRect(6, y, w - 12, 1);
  c.fillStyle = P.dk2;
  c.fillRect(3, 3, w - 6, 3); c.fillRect(3, h - 6, w - 6, 3);
  c.fillRect(3, 3, 3, h - 6); c.fillRect(w - 6, 3, 3, h - 6);
  c.fillStyle = P.pur;
  const B = 12;
  c.fillRect(3, 3, B, 3); c.fillRect(3, 3, 3, B);
  c.fillRect(w - 3 - B, 3, B, 3); c.fillRect(w - 6, 3, 3, B);
  c.fillRect(3, h - 6, B, 3); c.fillRect(3, h - 3 - B, 3, B);
  c.fillRect(w - 3 - B, h - 6, B, 3); c.fillRect(w - 6, h - 3 - B, 3, B);
  return cv;
}
