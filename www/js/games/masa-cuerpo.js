// LA MASA - el cuerpo de la masa: nucleo, piel y organos. Sin DOM: el arnes
// de Node (tools/prueba-masa.mjs) corre exactamente esto, y cada constante de
// aqui sale de ahi.
//
// TRES CAPAS, cada una con la fisica que le corresponde y ninguna con solver
// donde no hace falta:
//
//  1. El NUCLEO es cinematico: un punto con la maquina de estados del charger
//     de NEON FIST (acecha -> aviso 480 ms -> embiste -> aturdida si choca).
//     No es un punto Verlet libre: probado asi, cada tajo la desplazaba y la
//     masa entera se iba de paseo en vez de abollarse.
//  2. La PIEL son 12 muelles radiales, los de makeBlob de SYMBIOTE, con un
//     radio de reposo POR SECTOR. Los sectores estan fijos al mundo por
//     construccion (el sector i es siempre el angulo i*30 grados): asi la
//     placa que crece "donde ella pega" se queda ahi. Un anillo Verlet con
//     radios rigidos, que fue la primera idea, no se abollaba (0.0 px medido)
//     y encima giraba 78 grados tras treinta tajos del mismo lado, o sea la
//     placa se iba a otro sector sola.
//  3. Solo los ORGANOS son Verlet: cadenas de 4-6 puntos ancladas al borde de
//     la piel, con la punta en rieles cuando golpean (una cuerda blanda no se
//     puede empujar, se pliega; hay que llevar la punta y soltarla con la
//     velocidad heredada para que latiguee sola).
//
// REGLA QUE NO SE NEGOCIA: nada hiere sin un aviso de al menos 0.35 s que se
// vea. Lo aprendido cambia CUANDO y HACIA DONDE ataca, nunca cuanto avisa.

import { herir, empujar, espadaActiva, espadaCaja, AX0, AX1, AY0, AY1 } from './masa-caballera.js';

export const NR = 12;                       // sectores de piel, de 30 grados
export const R0 = 22;                       // radio de reposo de la ronda 1
export const NORG = 4;                      // cadenas a la vez
export const NP = 7;                        // puntos por cadena (tope)
export const ITERS = 8;
export const HP0 = 12;                      // tajos que aguanta en la ronda 1
export const HP_RONDA = 0.08;               // +8% por ronda: la dificultad sube por lo que aprende, no por la vida
export const ULT_RONDA = 7;                 // la septima muda es la ultima: matarla es ganar

// Tipos de cadena
export const LATIGO = 1, GARRA = 2, HOJA = 3;
// Estados del nucleo
export const RUMIA = 0, ACECHA = 1, AVISO = 2, EMBISTE = 3, ATURDIDA = 4, RECUPERA = 5, MUDANDO = 6, ORGANO = 7;
// Estados de una cadena
export const REPOSO = 0, C_AVISO = 1, C_GOLPE = 2, C_SIGUE = 3, C_RECUPERA = 4;

// Avisos (s). Los tres son >= 0.35 y ninguno se acorta nunca.
export const T_AVISO = 0.48, T_AVISO_LATIGO = 0.40, T_AVISO_GARRA = 0.40, T_AVISO_HOJA = 0.35;
const T_EMBISTE = 0.45, T_ATURDIDA = 0.9, T_RECUPERA = 0.35;
const V_EMBISTE = 225;                      // px/s; las patas lo suben
const V_ACECHA = 39;
const DIST_ATAQUE = 105;                    // desde aqui decide atacar (la del charger)
const RIEL_LATIGO = 0.14, SIGUE_LATIGO = 0.12, REC_LATIGO = 0.5;
// ONDULACION del latigo en reposo. Medido: sin esto la curva maxima de la
// cadena era 0.8 px sobre 50 de cuerda (2%): un palo tieso. Es el mismo fallo
// que tuvieron los tentaculos de SYMBIOTE y se arregla igual -- un seno
// perpendicular con envolvente (cero en la base, maximo en el medio) mas un
// 10% de holgura en el largo de reposo, que es el material que necesita para
// curvarse. Solo el latigo: la garra y la hoja son rigidas a proposito.
const ONDA_A = 34, ONDA_V = 4.6, HOLGURA = 1.10;
const RIEL_GARRA = 0.10, SIGUE_GARRA = 0.08, REC_GARRA = 0.4;
const RIEL_HOJA = 0.18, SIGUE_HOJA = 0.06, REC_HOJA = 0.3;
export const T_PARADA = 0.35, T_EXPUESTA = 0.45, CD_PARADA = 2.0;
export const T_HERIDA = 3.0;
const CRECE_RAMPA = 1 / 0.6;                // una cadena nueva sale de la carne en 0.6 s
const CORTE_GOLPES = 3;                     // tajos que cercenan una cadena

// Eventos que el cuerpo deja para el juego (sonido, particulas) y el arnes.
export const EV = {
  AVISO: 1, EMBISTE: 2, PARED: 3, CAD_AVISO: 4, CAD_GOLPE: 5, CLANG: 6, TAJO: 7,
  TAJO_ORG: 8, CORTE: 9, PARADA: 10, PARADA_OK: 11, EXPUESTA: 12, DANO: 13,
  MUERE: 14, HERIDA_CIERRA: 15, CRECE: 16,
};

const SEC = Math.PI * 2 / NR;
export function sectorDe(ang) { let s = Math.round(ang / SEC) % NR; if (s < 0) s += NR; return s; }
export function angDe(s) { return s * SEC; }
const wrap = s => ((s % NR) + NR) % NR;
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);

// Como es cada tipo de cadena: puntos, largo por tramo, rigidez. len*n es el
// alcance real, y el tope de ~60 px (mas el radio) es para que siempre se
// pueda entrar al nucleo de un paso: la espada llega a 19 + 13 = 32 px.
const DEF = {
  [LATIGO]: { n: 6, len: 10, stiff: 0.22, aviso: T_AVISO_LATIGO, riel: RIEL_LATIGO, sigue: SIGUE_LATIGO, rec: REC_LATIGO },
  [GARRA]:  { n: 4, len: 8,  stiff: 0.90, aviso: T_AVISO_GARRA,  riel: RIEL_GARRA,  sigue: SIGUE_GARRA,  rec: REC_GARRA },
  [HOJA]:   { n: 6, len: 9,  stiff: 0.85, aviso: T_AVISO_HOJA,   riel: RIEL_HOJA,   sigue: SIGUE_HOJA,   rec: REC_HOJA },
};

function makeOrg() {
  return { tipo: 0, sec: 0, n: 0, len: 0, stiff: 0, st: REPOSO, t: 0, grow: 0,
           util: 0, sinUtil: 0, golpes: 0, tx: 0, ty: 0, sx: 0, sy: 0, pego: 0,
           barridos: 0, aim: 0, sway: 0, nacida: 0 };
}

export function makeMasa(x, y) {
  const M = {
    x, y, st: RUMIA, t: 0, cd: 1.2, ronda: 1, hp: HP0, hpMax: HP0, viva: true,
    lx: 0, ly: 1,                        // direccion de la ultima embestida
    rad: new Float32Array(NR), vel: new Float32Array(NR), rest: new Float32Array(NR),
    placa: new Uint8Array(NR),           // nivel de coraza por sector, 0..3
    hits: new Uint16Array(NR),           // tajos recibidos por sector en esta ronda (con CLANG)
    crec: 0,                             // crecimiento generico del radio
    frozen: -1, frozenT: 0, expuesta: 0, herida: -1, heridaT: 0,
    patas: 0, parada: 0, paradaCd: 0,
    org: new Array(NORG),
    px: new Float32Array(NORG * NP), py: new Float32Array(NORG * NP),
    pox: new Float32Array(NORG * NP), poy: new Float32Array(NORG * NP),
    swingId: -1, tiempo: 0, convT: 0, ultDmg: 1,
    aimX: 0, aimY: 0, aimOn: 0,          // la linea amarilla del aviso
    hojaSeq: 0, hojaG: 1, hojaD: 0, tempo: 0.8,
    evN: 0, evT: new Uint8Array(32), evX: new Float32Array(32), evY: new Float32Array(32), evA: new Float32Array(32),
    maxErr: 0,
  };
  for (let i = 0; i < NR; i++) { M.rad[i] = R0; M.rest[i] = R0; }
  for (let o = 0; o < NORG; o++) M.org[o] = makeOrg();
  return M;
}

function ev(M, t, x, y, a) {
  const n = M.evN; if (n >= 32) return;
  M.evT[n] = t; M.evX[n] = x; M.evY[n] = y; M.evA[n] = a || 0; M.evN = n + 1;
}

// ---------- Piel ----------

function restDe(M, i) { return R0 + M.crec + (M.placa[i] === 0 ? 0 : 1 + M.placa[i] * 3); }

function stepPiel(M, dt, rnd) {
  M.tiempo += dt;
  const conv = M.st === MUDANDO && M.convT > 0;
  for (let i = 0; i < NR; i++) {
    M.rest[i] = restDe(M, i);
    if (M.frozen >= 0 && (i === M.frozen || i === wrap(M.frozen + 1) || i === wrap(M.frozen - 1))) {
      M.vel[i] = 0; continue;              // petrificada: se queda como esta
    }
    // Una placa respira menos y su muelle es mas duro: el tajo apenas la hunde.
    const dura = M.placa[i] > 0;
    const amp = dura ? 0.03 : 0.09;
    const k = dura ? 140 : 40;
    const target = M.rest[i] * (1 + amp * Math.sin(M.tiempo * 3.1 + i * 1.7) + 0.04 * Math.sin(M.tiempo * 5.7 + i * 0.9));
    M.vel[i] += (target - M.rad[i]) * k * dt;
    if (conv) M.vel[i] += (rnd() - 0.5) * 900 * dt;   // convulsion de la muda
    M.vel[i] *= 0.86;
    M.rad[i] += M.vel[i] * dt;
    if (M.rad[i] < 6) M.rad[i] = 6;
  }
}

// El radio de la piel en un angulo cualquiera (interpolado entre sectores).
export function radioEn(M, ang) {
  let f = ang / SEC; f = ((f % NR) + NR) % NR;
  const i0 = f | 0, i1 = (i0 + 1) % NR, t = f - i0;
  return M.rad[i0] * (1 - t) + M.rad[i1] * t;
}

// Abolladura de un tajo: el sector se hunde 5-8 px y rebota solo. Con -350
// (lo primero que se probo) se hundia el radio entero.
function abollar(M, s, v) {
  M.vel[s] -= v; M.vel[wrap(s + 1)] -= v * 0.55; M.vel[wrap(s - 1)] -= v * 0.55;
}

// ---------- Cadenas ----------

function orgBase(M, o, k) {   // k = 0 -> x, 1 -> y
  const a = angDe(o.sec);
  const r = M.rad[o.sec] - 3;
  return k === 0 ? M.x + Math.cos(a) * r : M.y + Math.sin(a) * r;
}

function alcance(o) { return o.n * o.len * o.grow; }

// Hace crecer una cadena nueva en el sector s. Si no hay ranura, reemplaza la
// que menos rindio. Devuelve el indice o -1.
export function crecerCadena(M, tipo, s) {
  let idx = -1, peor = -1, pu = 1e9;
  for (let o = 0; o < NORG; o++) {
    const g = M.org[o];
    if (g.tipo === 0) { idx = o; break; }
    if (g.util < pu) { pu = g.util; peor = o; }
  }
  if (idx < 0) idx = peor;
  if (idx < 0) return -1;
  const g = M.org[idx], d = DEF[tipo];
  g.tipo = tipo; g.sec = wrap(s); g.n = d.n; g.len = d.len; g.stiff = d.stiff;
  g.st = REPOSO; g.t = 0; g.grow = 0; g.util = 0; g.sinUtil = 0; g.golpes = 0; g.pego = 0;
  g.barridos = 0; g.aim = 0; g.sway = 0; g.nacida = M.ronda;
  const b = idx * NP;
  const bx = orgBase(M, g, 0), by = orgBase(M, g, 1);
  for (let k = 0; k < NP; k++) { M.px[b + k] = M.pox[b + k] = bx; M.py[b + k] = M.poy[b + k] = by; }
  ev(M, EV.CRECE, bx, by, tipo);
  return idx;
}

export function quitarCadena(M, idx) {
  const g = M.org[idx];
  g.tipo = 0; g.st = REPOSO;
}

export function tieneCadena(M, tipo) {
  for (let o = 0; o < NORG; o++) if (M.org[o].tipo === tipo) return o;
  return -1;
}

// Objetivo de un golpe, recortado al alcance real de la cadena.
function apuntar(M, g, idx, tx, ty) {
  const bx = orgBase(M, g, 0), by = orgBase(M, g, 1);
  let dx = tx - bx, dy = ty - by;
  const d = Math.hypot(dx, dy) || 1, mx = alcance(g) * 0.97;
  if (d > mx) { dx = dx / d * mx; dy = dy / d * mx; }
  g.tx = bx + dx; g.ty = by + dy;
  const tip = idx * NP + g.n - 1;
  g.sx = M.px[tip]; g.sy = M.py[tip];
}

// Arranca el ataque de una cadena hacia (tx,ty). El aviso dura lo que diga su
// tipo y la linea amarilla se enciende desde ya.
function atacarCadena(M, idx, tx, ty) {
  const g = M.org[idx];
  // El blanco se recorta AQUI, al arrancar el aviso, a la arena y al alcance
  // real de la cadena: el anillo amarillo tiene que estar exactamente donde va
  // a caer la punta. Antes se recortaba al disparar (apuntar()) y el aviso
  // prometia un sitio al que el latigo no llegaba.
  tx = tx < AX0 + 6 ? AX0 + 6 : tx > AX1 - 6 ? AX1 - 6 : tx;
  ty = ty < AY0 + 6 ? AY0 + 6 : ty > AY1 - 6 ? AY1 - 6 : ty;
  const bx0 = orgBase(M, g, 0), by0 = orgBase(M, g, 1);
  const ddx = tx - bx0, ddy = ty - by0;
  const dd = Math.hypot(ddx, ddy) || 1, mx = g.n * g.len * g.grow * 0.97;
  if (dd > mx) { tx = bx0 + ddx / dd * mx; ty = by0 + ddy / dd * mx; }
  g.st = C_AVISO; g.t = 0; g.pego = 0; g.tx = tx; g.ty = ty; g.aim = 1;
  M.aimX = tx; M.aimY = ty; M.aimOn = 1;
  ev(M, EV.CAD_AVISO, tx, ty, g.tipo);
}

function stepCadenas(M, K, dt) {
  const d0 = dt * dt;
  for (let o = 0; o < NORG; o++) {
    const g = M.org[o];
    if (g.tipo === 0) continue;
    const b = o * NP, n = g.n, def = DEF[g.tipo];
    if (g.grow < 1 && !(M.st === MUDANDO && M.convT > 0)) g.grow = Math.min(1, g.grow + CRECE_RAMPA * dt);
    g.t += dt;
    g.sway += dt;

    // --- Maquina del golpe ---
    if (g.st === C_AVISO) {
      // La linea amarilla sigue al objetivo mientras avisa: apunta A DONDE VA
      // a pegar, no a donde estaba ella cuando empezo el aviso.
      M.aimX = g.tx; M.aimY = g.ty;
      if (g.t >= def.aviso) {
        apuntar(M, g, o, g.tx, g.ty);
        g.st = C_GOLPE; g.t = 0; M.aimOn = 0;
        ev(M, EV.CAD_GOLPE, g.tx, g.ty, g.tipo);
      }
    } else if (g.st === C_GOLPE) {
      if (g.t >= def.riel) { g.st = C_SIGUE; g.t = 0; }
    } else if (g.st === C_SIGUE) {
      if (g.t >= def.sigue) {
        g.st = C_RECUPERA; g.t = 0;
        // PATRON ROTO: apunto a donde ella SUELE esquivar y no estaba. Se
        // queda descolocada, dano doble un instante: romper tu habito paga.
        if (!g.pego && g.aim === 2 && M.st !== MUDANDO) { M.expuesta = T_EXPUESTA; ev(M, EV.EXPUESTA, M.x, M.y, 1); }
        g.aim = 0;
      }
    } else if (g.st === C_RECUPERA) {
      // Con barridos pendientes la HOJA se queda en C_RECUPERA esperando a que
      // el nucleo (estado ORGANO) le mande el siguiente: si pasaba a REPOSO,
      // el nucleo la daba por terminada y el segundo barrido no salia nunca.
      if (g.t >= def.rec && !(g.tipo === HOJA && g.barridos > 1 && M.st === ORGANO)) { g.st = REPOSO; g.t = 0; }
    }

    // --- Integracion Verlet de los puntos 1..n-1 ---
    const bx = orgBase(M, g, 0), by = orgBase(M, g, 1);
    M.px[b] = M.pox[b] = bx; M.py[b] = M.poy[b] = by;
    const a0 = angDe(g.sec);
    // Angulo de la pose: en reposo ondula un poco; avisando se recoge hacia
    // atras (el latigo se tensa, la garra se encoge); recuperando vuelve.
    let pa = a0 + 0.35 * Math.sin(g.sway * 1.9 + o * 2.1) * (g.tipo === LATIGO ? 1 : 0.4);
    let pl = g.len * g.grow;
    let gain = g.stiff * 0.25;
    if (g.st === C_AVISO) {
      const dx = g.tx - bx, dy = g.ty - by;
      const at = Math.atan2(dy, dx);
      // Se recoge al lado contrario del objetivo, 100 grados: se lee como
      // "toma impulso", que es el aviso.
      let lado = Math.sin(at - a0) >= 0 ? -1 : 1;
      pa = a0 + lado * 1.75;
      pl *= 0.6; gain = 0.3;
    } else if (g.st === C_GOLPE || g.st === C_SIGUE) {
      gain = 0;                             // libre: la punta manda
    }
    const onda = g.tipo === LATIGO && (g.st === REPOSO || g.st === C_RECUPERA);
    for (let k = 1; k < n; k++) {
      const p = b + k;
      const x = M.px[p], y = M.py[p];
      let vx = (x - M.pox[p]) * 0.94, vy = (y - M.poy[p]) * 0.94;
      M.pox[p] = x; M.poy[p] = y;
      let nx = x + vx, ny = y + vy;
      if (onda) {
        // Perpendicular al eje de la cadena, con fase propia por organo.
        const f = k / (n - 1), env = Math.sin(f * Math.PI);
        const w = Math.sin(g.sway * ONDA_V + o * 2.1 - f * 4.2) * env * ONDA_A * dt;
        nx += -Math.sin(pa) * w; ny += Math.cos(pa) * w;
      }
      if (gain > 0) {
        const tx = bx + Math.cos(pa) * pl * k, ty = by + Math.sin(pa) * pl * k;
        const w = gain * (1 - k / (n + 1));
        let jx = (tx - nx) * w, jy = (ty - ny) * w;
        // Tope del tiron por frame: un tercio del tramo. Sin el, la hoja
        // volvia de un latigazo con 17% de error de restriccion (un punto
        // saltaba 10 px en un frame); con el, vuelve en 0.3 s y el error
        // queda bajo el 3%.
        const jm = Math.hypot(jx, jy), jmax = pl * 0.33;
        if (jm > jmax) { jx *= jmax / jm; jy *= jmax / jm; }
        nx += jx; ny += jy;
      }
      M.px[p] = nx; M.py[p] = ny;
    }
    // La punta en rieles durante el golpe: se lleva a mano y hereda la
    // velocidad al soltarla (pox queda en la posicion del frame anterior).
    const tip = b + n - 1;
    if (g.st === C_GOLPE) {
      const u = smooth(g.t / def.riel);
      M.pox[tip] = M.px[tip]; M.poy[tip] = M.py[tip];
      M.px[tip] = g.sx + (g.tx - g.sx) * u; M.py[tip] = g.sy + (g.ty - g.sy) * u;
    }
    // Restricciones de la cadena. El latigo lleva holgura: con el largo justo
    // la cuerda queda tensa por construccion, o sea recta, y la onda no se ve.
    const rl = g.len * g.grow * (onda ? HOLGURA : 1);
    for (let it = 0; it < ITERS; it++) {
      for (let k = 0; k < n - 1; k++) {
        const p = b + k, q = p + 1;
        const dx = M.px[q] - M.px[p], dy = M.py[q] - M.py[p];
        const dd = dx * dx + dy * dy;
        if (dd < 1e-9) continue;
        const dist = Math.sqrt(dd);
        const diff = (dist - rl) / dist * 0.5;
        const wx = dx * diff, wy = dy * diff;
        const pinP = k === 0, pinQ = (q === tip && g.st === C_GOLPE);
        if (!pinP && !pinQ) { M.px[p] += wx; M.py[p] += wy; M.px[q] -= wx; M.py[q] -= wy; }
        else if (pinP && !pinQ) { M.px[q] -= wx * 2; M.py[q] -= wy * 2; }
        else if (!pinP && pinQ) { M.px[p] += wx * 2; M.py[p] += wy * 2; }
      }
    }
    // Error de restriccion (para el arnes), solo en reposo y en el aviso: en
    // el riel la cadena se estira a proposito (eso es el latigazo) y al
    // soltarla vuelve con inercia durante unos frames.
    if ((g.st === REPOSO || g.st === C_AVISO) && rl > 0 && M.st !== EMBISTE && M.st !== ATURDIDA && M.st !== MUDANDO && g.grow >= 1) {
      for (let k = 0; k < n - 1; k++) {
        const p = b + k, q = p + 1;
        const e = Math.abs(Math.hypot(M.px[q] - M.px[p], M.py[q] - M.py[p]) - rl) / rl;
        if (e > M.maxErr) M.maxErr = e;
      }
    }
    // Dano a la caballera: los tres ultimos puntos, solo en el golpe y su
    // seguimiento, y una sola vez por ataque.
    if ((g.st === C_GOLPE || g.st === C_SIGUE) && !g.pego && K.iframe <= 0) {
      for (let k = Math.max(1, n - 3); k < n; k++) {
        const p = b + k;
        const dx = M.px[p] - K.x, dy = M.py[p] - K.y;
        if (dx * dx + dy * dy < 9 * 9) {
          if (herir(K, M.px[p], M.py[p])) { g.pego = 1; g.util++; ev(M, EV.DANO, K.x, K.y, g.tipo); }
          break;
        }
      }
    }
  }
}

// ---------- Ataques ----------

function rumia(M) {
  // Cuanto rumia entre ataque y ataque: baja con la ronda y con las patas. La
  // dificultad escala por FRECUENCIA, no por dano (Left 4 Dead): un golpe
  // siempre es un corazon.
  // Medido: con -0.12 por ronda la ronda 7 se alargaba a 64 s, porque las
  // ventanas para pegar se acortaban mas de lo que subia la vida.
  return Math.max(0.8, 1.6 - 0.06 * (M.ronda - 1) - 0.15 * M.patas);
}

function empezarEmbestida(M, K) {
  const dx = K.x - M.x, dy = K.y - M.y, d = Math.hypot(dx, dy) || 1;
  M.lx = dx / d; M.ly = dy / d;
  M.st = AVISO; M.t = 0;
  M.aimX = M.x + M.lx * 160; M.aimY = M.y + M.ly * 160; M.aimOn = 1;
  ev(M, EV.AVISO, M.lx, M.ly, 0);
}

// Elige el ataque cuando le toca. `mn` es la mente (puede ser null en las
// pruebas de cuerpo): le pregunta a donde suele esquivar ella para apuntar el
// latigo, y su tempo para la hoja.
function elegirAtaque(M, K, rnd, mn) {
  const dx = K.x - M.x, dy = K.y - M.y, d = Math.hypot(dx, dy);
  const ig = tieneCadena(M, GARRA), il = tieneCadena(M, LATIGO), ih = tieneCadena(M, HOJA);
  if (ih >= 0 && M.org[ih].grow >= 1 && d < 80 && rnd() < 0.35) {
    // La HOJA pega como ella: tantos barridos como golpes tiene su combo
    // favorito (tope dos), a su tempo, y si el combo lleva esquive, una
    // embestida detras. Nunca mas de tres avisos seguidos: con un solo dash
    // (0.62 s de enfriamiento) el cuarto no se puede esquivar, medido con el
    // piloto bueno. Y no es cada ataque: si lo fuera, la ronda 7 se iba a
    // 69 s porque ella no tenia cuando pegar. Con 0.45 la ronda 7 se llevaba
    // 2.3 de los 5 corazones (la jugadora buena ganaba 54 de 100); con 0.35,
    // 60 de 100 y sigue siendo la ronda mas dura de largo.
    const g = M.org[ih];
    g.barridos = Math.min(2, M.hojaG); M.hojaSeq = M.hojaD ? 1 : 0;
    atacarCadena(M, ih, K.x, K.y);
    M.st = ORGANO; M.t = 0; return;
  }
  if (ig >= 0 && M.org[ig].grow >= 1 && d < 54 && rnd() < 0.75) {
    atacarCadena(M, ig, K.x, K.y);
    M.st = ORGANO; M.t = 0; return;
  }
  if (il >= 0 && M.org[il].grow >= 1 && d > 34 && d < 95 && rnd() < 0.7) {
    // Pre-apuntado a donde ella SUELE esquivar: si su habito es conocido, el
    // latigo cae donde va a aterrizar el dash. La linea amarilla lo dice.
    let tx = K.x, ty = K.y;
    const porHabito = mn && mn.esqBin >= 0;
    if (porHabito) {
      const ang = Math.atan2(M.y - K.y, M.x - K.x) + mn.esqBin * (Math.PI / 4);
      tx += Math.cos(ang) * 46; ty += Math.sin(ang) * 46;
    }
    atacarCadena(M, il, tx, ty);
    // DESPUES de arrancar: atacarCadena pone aim = 1, asi que marcarlo antes
    // lo borraba y el PATRON ROTO del latigo no existia.
    if (porHabito) M.org[il].aim = 2;       // 2 = apuntado por habito
    M.st = ORGANO; M.t = 0; return;
  }
  empezarEmbestida(M, K);
}

// ---------- Espada ----------

const _caja = new Float32Array(4);

function tajo(M, K) {
  espadaCaja(K, _caja);
  const bx = _caja[0], by = _caja[1], bw = _caja[2], bh = _caja[3];
  const hx = bx + bw / 2, hy = by + bh / 2;
  // Cuerpo: la caja contra el circulo del sector que mira a la caja.
  const ang = Math.atan2(hy - M.y, hx - M.x);
  const s = sectorDe(ang);
  const r = radioEn(M, ang);
  const cx = Math.max(bx, Math.min(M.x, bx + bw)), cy = Math.max(by, Math.min(M.y, by + bh));
  const ddx = cx - M.x, ddy = cy - M.y;
  if (ddx * ddx + ddy * ddy < r * r) {
    M.swingId = K.swingId;
    const px = M.x + Math.cos(ang) * r, py = M.y + Math.sin(ang) * r;
    const pf = M.frozen;
    if (pf >= 0 && (s === pf || s === wrap(pf + 1) || s === wrap(pf - 1))) {
      // PARADA acertada: el tajo rebota y ella queda descolocada un instante.
      M.frozen = -1; M.frozenT = 0; M.paradaCd = CD_PARADA;
      K.stag = 0.35; empujar(K, M.x, M.y, 110);
      // La parada YA es el castigo: no se encadena un ataque encima mientras
      // ella esta descolocada, que seria un golpe sin aviso util.
      if (M.st === RUMIA || M.st === ACECHA) { M.st = RUMIA; M.cd = Math.max(M.cd, 0.6); }
      M.hits[s]++;
      ev(M, EV.PARADA_OK, px, py, s);
      return;
    }
    if (M.placa[s] > 0) {
      // CLANG: por ahi ya no. Cuenta como tajo recibido, que es lo que
      // mantiene viva la placa; si deja de pegar ahi, se cae.
      M.hits[s]++;
      empujar(K, M.x, M.y, 70);
      ev(M, EV.CLANG, px, py, s);
      return;
    }
    let dmg = 1;
    if (M.st === ATURDIDA || M.expuesta > 0 || M.herida === s) dmg = 2;
    M.hp -= dmg; M.hits[s]++; M.ultDmg = dmg;
    abollar(M, s, 110);
    ev(M, EV.TAJO, px, py, s);
    if (M.hp <= 0) morir(M);
    return;
  }
  // Organos: cualquier punto (menos la base) dentro de la caja.
  for (let o = 0; o < NORG; o++) {
    const g = M.org[o];
    if (g.tipo === 0 || g.grow < 0.5) continue;
    const b = o * NP;
    for (let k = 1; k < g.n; k++) {
      const p = b + k, x = M.px[p], y = M.py[p];
      if (x < bx || x > bx + bw || y < by || y > by + bh) continue;
      M.swingId = K.swingId;
      g.golpes++;
      M.hp -= 0.5;
      // Empujon al punto: la cadena entera se sacude.
      const dx = x - K.x, dy = y - K.y, d = Math.hypot(dx, dy) || 1;
      M.px[p] += dx / d * 300 / 60; M.py[p] += dy / d * 300 / 60;
      ev(M, EV.TAJO_ORG, x, y, g.tipo);
      if (g.golpes >= CORTE_GOLPES) cortar(M, o);
      if (M.hp <= 0) morir(M);
      return;
    }
  }
}

// Cercenar una cadena de raiz abre una HERIDA en su sector: 3 s con el
// nucleo latiendo a la vista, dano doble por ahi. Luego cicatriza.
function cortar(M, o) {
  const g = M.org[o];
  ev(M, EV.CORTE, orgBase(M, g, 0), orgBase(M, g, 1), g.tipo);
  M.herida = g.sec; M.heridaT = T_HERIDA;
  if (g.st === C_AVISO) M.aimOn = 0;        // cortada avisando: la linea amarilla se va con ella
  quitarCadena(M, o);
}

function morir(M) {
  M.hp = 0; M.viva = false; M.st = MUDANDO; M.t = 0; M.convT = 0.8;
  M.frozen = -1; M.frozenT = 0; M.expuesta = 0; M.aimOn = 0;
  for (let o = 0; o < NORG; o++) { const g = M.org[o]; g.st = REPOSO; g.t = 0; }
  ev(M, EV.MUERE, M.x, M.y, M.ronda);
}

// Al terminar la muda: la ronda siguiente, con mas vida. Las lecciones (que
// le crece) las decide la mente antes de llamar a esto.
export function renacer(M) {
  M.ronda++;
  M.hpMax = Math.round(HP0 * (1 + HP_RONDA * (M.ronda - 1)));
  M.hp = M.hpMax; M.viva = true;
  M.st = RUMIA; M.t = 0; M.cd = 1.4;
  M.herida = -1; M.heridaT = 0;
  for (let i = 0; i < NR; i++) M.hits[i] = 0;
  M.swingId = -1;
}

// PARADA: la mente la arma cuando predice el golpe. Petrifica el sector que
// mira a ella (y sus dos vecinos: 90 grados) durante T_PARADA.
export function armarParada(M, K) {
  if (M.parada <= 0 || M.paradaCd > 0 || M.frozen >= 0 || M.st === MUDANDO) return false;
  const s = sectorDe(Math.atan2(K.y - M.y, K.x - M.x));
  M.frozen = s; M.frozenT = T_PARADA; M.paradaCd = CD_PARADA;
  // Petrificada se queda QUIETA: si no, elegia un ataque encima y el CLANG de
  // la parada la encontraba avisando o embistiendo.
  M.st = RUMIA; M.t = 0; M.cd = Math.max(M.cd, T_PARADA + 0.05);
  ev(M, EV.PARADA, M.x + Math.cos(angDe(s)) * M.rad[s], M.y + Math.sin(angDe(s)) * M.rad[s], s);
  return true;
}

// ---------- El paso ----------

export function step(M, K, dt, rnd, mn) {
  M.evN = 0;
  M.t += dt;
  if (M.st === MUDANDO) {
    if (M.convT > 0) M.convT -= dt;
    {
      // Mientras muda se desliza hacia el centro de la arena: asi cada ronda
      // arranca en el medio y la pelea no se queda a vivir en una esquina.
      // Durante TODA la muda (la convulsion incluida) y a 110 px/s: con 70 y
      // solo despues de la convulsion, desde una esquina no llegaba.
      const cx = (AX0 + AX1) / 2, cy = (AY0 + AY1) / 2;
      const dx = cx - M.x, dy = cy - M.y, d = Math.hypot(dx, dy);
      if (d > 2) { const v = Math.min(d, 110 * dt); M.x += dx / d * v; M.y += dy / d * v; }
    }
    stepPiel(M, dt, rnd);
    stepCadenas(M, K, dt);
    return;
  }
  if (M.paradaCd > 0) M.paradaCd -= dt;
  if (M.expuesta > 0) M.expuesta -= dt;
  if (M.heridaT > 0) { M.heridaT -= dt; if (M.heridaT <= 0) { ev(M, EV.HERIDA_CIERRA, 0, 0, M.herida); M.herida = -1; } }
  if (M.frozen >= 0) {
    M.frozenT -= dt;
    if (M.frozenT <= 0) {
      // Aposto y no llego el golpe: descolocada, dano doble un instante.
      M.frozen = -1; M.expuesta = T_EXPUESTA;
      ev(M, EV.EXPUESTA, M.x, M.y, 0);
    }
  }

  const dx = K.x - M.x, dy = K.y - M.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;

  if (M.st === RUMIA) {
    // Guarda ~55 px: si ella se acerca, cede; si se aleja, la sigue despacio.
    // Aqui es cuando ella pega.
    M.cd -= dt;
    if (dist < 36) { M.x -= ux * 18 * dt; M.y -= uy * 18 * dt; }
    else if (dist > 72) { M.x += ux * 30 * dt; M.y += uy * 30 * dt; }
    if (M.cd <= 0) { M.st = ACECHA; M.t = 0; }
  } else if (M.st === ACECHA) {
    const v = V_ACECHA + 8 * M.patas;
    M.x += ux * v * dt; M.y += uy * v * dt;
    if (M.frozen < 0 && (dist < DIST_ATAQUE || M.t > 2.5)) elegirAtaque(M, K, rnd, mn);
  } else if (M.st === AVISO) {
    if (M.t >= T_AVISO) { M.st = EMBISTE; M.t = 0; M.aimOn = 0; ev(M, EV.EMBISTE, M.lx, M.ly, 0); }
  } else if (M.st === EMBISTE) {
    const v = V_EMBISTE * (1 + 0.16 * M.patas);
    M.x += M.lx * v * dt; M.y += M.ly * v * dt;
    const r = R0 + M.crec;
    const pared = M.x <= AX0 + r || M.x >= AX1 - r || M.y <= AY0 + r || M.y >= AY1 - r;
    if (pared) {
      M.st = ATURDIDA; M.t = 0;
      ev(M, EV.PARED, M.x, M.y, 0);
      for (let i = 0; i < NR; i++) M.vel[i] += (rnd() - 0.5) * 300;
    } else if (K.iframe <= 0 && dist < radioEn(M, Math.atan2(dy, dx)) + 6) {
      if (herir(K, M.x, M.y)) { ev(M, EV.DANO, K.x, K.y, 0); M.st = RECUPERA; M.t = 0; }
    } else if (M.t >= T_EMBISTE) { M.st = RECUPERA; M.t = 0; }
  } else if (M.st === ATURDIDA) {
    if (M.t >= T_ATURDIDA) { M.st = RUMIA; M.t = 0; M.cd = rumia(M); }
  } else if (M.st === RECUPERA) {
    if (M.t >= T_RECUPERA) { M.st = RUMIA; M.t = 0; M.cd = rumia(M); }
  } else if (M.st === ORGANO) {
    // Espera a que la cadena termine; la HOJA encadena sus barridos y, si el
    // combo de ella lleva esquive, embiste al final.
    let activa = false;
    for (let o = 0; o < NORG; o++) {
      const g = M.org[o];
      if (g.tipo === 0 || g.st === REPOSO) continue;
      activa = true;
      if (g.tipo === HOJA && g.st === C_RECUPERA && g.barridos > 1 && g.t >= Math.min(0.5, M.tempo * 0.6)) {
        g.barridos--; atacarCadena(M, o, K.x, K.y);
      }
    }
    if (!activa) {
      if (M.hojaSeq) { M.hojaSeq = 0; empezarEmbestida(M, K); }
      else { M.st = RUMIA; M.t = 0; M.cd = rumia(M) + (tieneCadena(M, HOJA) >= 0 ? 0.6 : 0); }
    }
  }

  // Dentro de la arena (salvo embistiendo, que lo mide contra la pared)
  if (M.st !== EMBISTE) {
    const r = R0 + M.crec;
    if (M.x < AX0 + r) M.x = AX0 + r; else if (M.x > AX1 - r) M.x = AX1 - r;
    if (M.y < AY0 + r) M.y = AY0 + r; else if (M.y > AY1 - r) M.y = AY1 - r;
  }

  stepPiel(M, dt, rnd);
  stepCadenas(M, K, dt);

  // Ella no atraviesa la carne (salvo en dash): la masa es blanda pero es un
  // cuerpo. Se la empuja hacia fuera con suavidad.
  if (K.dT <= 0) {
    const a = Math.atan2(K.y - M.y, K.x - M.x);
    const r = radioEn(M, a) + 7;
    const d = Math.hypot(K.x - M.x, K.y - M.y);
    if (d < r) {
      const f = (r - d) * 0.5;
      K.x += Math.cos(a) * f; K.y += Math.sin(a) * f;
      // El empujon va DESPUES del clamp de stepCaballera: hay que repetirlo o
      // la masa la mete medio cuerpo en la pared.
      if (K.x < AX0 + 6) K.x = AX0 + 6; else if (K.x > AX1 - 6) K.x = AX1 - 6;
      if (K.y < AY0 + 6) K.y = AY0 + 6; else if (K.y > AY1 - 6) K.y = AY1 - 6;
    }
  }

  // La espada
  if (espadaActiva(K) && M.swingId !== K.swingId && M.viva) tajo(M, K);
}

// Cuantos sectores llevan placa (para el tope de 180 grados).
export function sectoresConPlaca(M) { let n = 0; for (let i = 0; i < NR; i++) if (M.placa[i] > 0) n++; return n; }

// Sube la placa del sector s un nivel; si ya esta al tope, la extiende a un
// vecino. Nunca mas de 6 sectores (180 grados): siempre queda por donde entrar.
export function crecerPlaca(M, s) {
  s = wrap(s);
  if (M.placa[s] < 3) {
    if (M.placa[s] === 0 && sectoresConPlaca(M) >= 6) return false;
    M.placa[s]++;
    ev(M, EV.CRECE, M.x + Math.cos(angDe(s)) * M.rad[s], M.y + Math.sin(angDe(s)) * M.rad[s], 0);
    return true;
  }
  const a = wrap(s + 1), b = wrap(s - 1);
  const t = M.placa[a] <= M.placa[b] ? a : b;
  if (M.placa[t] >= 3) return false;
  if (M.placa[t] === 0 && sectoresConPlaca(M) >= 6) return false;
  M.placa[t]++;
  ev(M, EV.CRECE, M.x + Math.cos(angDe(t)) * M.rad[t], M.y + Math.sin(angDe(t)) * M.rad[t], 0);
  return true;
}

// El centro de la placa mas grande (para el letrero y la pantalla final).
export function placaMayor(M) {
  let best = -1, bl = 0;
  for (let i = 0; i < NR; i++) if (M.placa[i] > bl) { bl = M.placa[i]; best = i; }
  return best;
}
