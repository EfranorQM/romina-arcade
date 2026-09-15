// LA MASA - la caballera. Romina con espada, sin DOM: el juego y el arnes de
// Node (tools/prueba-masa.mjs) mueven exactamente este modelo.
//
// Es la Romina de NEON FIST con los mismos numeros (78 px/s, dash de 285 x
// 0.18 s = 51 px, ciclo de golpe 0.26 s), porque esos ya estan probados en el
// pulgar. Lo que cambia es el arma: la espada tiene el alcance del puno pero
// es lo UNICO que hace dano. El dash aqui es esquive, no ataque: contra una
// masa de carne atravesarla no la corta, y separar las dos cosas es lo que
// deja que la masa aprenda cada una por separado.

export const AX0 = 12, AX1 = 258, AY0 = 45, AY1 = 390;   // la arena de NEON FIST
export const VEL = 78;
export const DASH_V = 285, DASH_T = 0.18, DASH_CD = 0.62;
export const TAJO_T = 0.30;               // ciclo entero del tajo: algo mas lento que el puno, la espada pesa
const TAJO_A0 = TAJO_T * 0.269, TAJO_A1 = TAJO_T * 0.577;   // ventana activa: 70..150 ms
export const ALCANCE = 19;                // centro de la caja de golpe, desde ella
export const HP0 = 5;
export const IFRAME = 0.9;

// Direcciones cardinales: 0=abajo 1=arriba 2=izq 3=der (las de NEON FIST)
export const DIRX = [0, 0, -1, 1];
export const DIRY = [1, -1, 0, 0];

export function makeCaballera(x, y) {
  return {
    x, y, face: 0, hp: HP0,
    pT: 0, swingId: 0,                    // ciclo de tajo; el id evita pegar dos veces con un swing
    dT: 0, dCd: 0, dvx: 0, dvy: 0, dashId: 0,
    iframe: 0, hurtT: 0, kbx: 0, kby: 0, kbT: 0,
    stag: 0,                              // descolocada por una parada: no puede actuar
    walkT: 0, walkF: 0,
    mueve: 0,                             // 1 si el pulgar la esta moviendo (para el piloto y el dibujo)
    dead: false,
  };
}

// Un paso. `inp` = { dx, dy, golpe, dash }: dx/dy es el stick (-1..1) y golpe/
// dash son flancos (true solo en el frame que se pulsa).
export function stepCaballera(K, inp, dt) {
  if (K.dead) return;
  if (K.iframe > 0) K.iframe -= dt;
  if (K.hurtT > 0) K.hurtT -= dt;
  if (K.dCd > 0) K.dCd -= dt;
  if (K.stag > 0) K.stag -= dt;

  // Acciones: el dash cancela el tajo (techo de habilidad gratis, como en
  // NEON FIST); descolocada no puede ni pegar ni esquivar.
  if (K.stag <= 0) {
    if (inp.dash && K.dCd <= 0 && K.hurtT <= 0) {
      let dx = inp.dx, dy = inp.dy;
      if (dx * dx + dy * dy < 0.04) { dx = DIRX[K.face]; dy = DIRY[K.face]; }
      const d = Math.hypot(dx, dy) || 1;
      K.dvx = dx / d * DASH_V; K.dvy = dy / d * DASH_V;
      K.dT = DASH_T; K.iframe = Math.max(K.iframe, 0.24);
      K.dCd = DASH_CD; K.dashId++;
      K.pT = 0;
    } else if (inp.golpe && K.pT <= 0) {
      K.pT = TAJO_T; K.swingId++;
    }
  }

  // Movimiento
  const mag = Math.hypot(inp.dx, inp.dy);
  K.mueve = 0;
  if (K.dT > 0) {
    K.dT -= dt;
    K.x += K.dvx * dt; K.y += K.dvy * dt;
  } else if (mag > 0.001 && K.stag <= 0) {
    const m = Math.min(1, mag);
    K.x += inp.dx / mag * VEL * m * dt; K.y += inp.dy / mag * VEL * m * dt;
    K.face = Math.abs(inp.dx) > Math.abs(inp.dy) ? (inp.dx < 0 ? 2 : 3) : (inp.dy < 0 ? 1 : 0);
    K.mueve = 1;
    K.walkT += dt;
    if (K.walkT > 0.133) { K.walkT = 0; K.walkF ^= 1; }
  } else K.walkF = 0;
  if (K.kbT > 0) {
    K.kbT -= dt;
    K.x += K.kbx * dt; K.y += K.kby * dt;
    K.kbx *= 0.88; K.kby *= 0.88;
  }
  if (K.x < AX0 + 6) K.x = AX0 + 6; else if (K.x > AX1 - 6) K.x = AX1 - 6;
  if (K.y < AY0 + 6) K.y = AY0 + 6; else if (K.y > AY1 - 6) K.y = AY1 - 6;

  if (K.pT > 0) { K.pT -= dt; if (K.pT < 0) K.pT = 0; }
}

// La espada esta cortando en este frame.
export function espadaActiva(K) {
  if (K.pT <= 0) return false;
  const el = TAJO_T - K.pT;
  return el >= TAJO_A0 && el < TAJO_A1;
}

// Caja de golpe: la del puno de NEON FIST (27x21, girada segun la cara).
// Rellena out = [x, y, w, h] y devuelve out, sin reservar memoria.
export function espadaCaja(K, out) {
  const fx = DIRX[K.face], fy = DIRY[K.face];
  const hx = K.x + fx * ALCANCE, hy = K.y + fy * ALCANCE;
  const bw = fx !== 0 ? 21 : 27, bh = fx !== 0 ? 27 : 21;
  out[0] = hx - bw / 2; out[1] = hy - bh / 2; out[2] = bw; out[3] = bh;
  return out;
}

// Un golpe desde (sx, sy). Devuelve true si entro (no estaba invulnerable).
export function herir(K, sx, sy) {
  if (K.iframe > 0 || K.dead) return false;
  K.hp--;
  K.iframe = IFRAME; K.hurtT = 0.2;
  const dx = K.x - sx, dy = K.y - sy;
  const d = Math.hypot(dx, dy) || 1;
  K.kbx = dx / d * 60; K.kby = dy / d * 60; K.kbT = 0.2;
  K.pT = 0; K.dT = 0;
  if (K.hp <= 0) K.dead = true;
  return true;
}

// Empujon sin dano (el CLANG de una placa o una parada).
export function empujar(K, sx, sy, fuerza) {
  const dx = K.x - sx, dy = K.y - sy;
  const d = Math.hypot(dx, dy) || 1;
  K.kbx = dx / d * fuerza; K.kby = dy / d * fuerza; K.kbT = 0.16;
}
