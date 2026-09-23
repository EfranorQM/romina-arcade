// LA ARENA - lo que hay en el salon ademas de ella y el ogro. SIN DOM, como
// caba-cuerpo.js y ogro-cuerpo.js: el juego y el arnes (tools/prueba-arena.mjs)
// mueven exactamente esto.
//
// Anderson pidio "mejor diseño del mapa, mas obstaculos". Una arena plana y
// vacia solo tiene una decision: hacia donde correr. Estos tres elementos
// añaden decisiones que se cruzan con los ataques del ogro, sin que ninguno
// sea un refugio gratis:
//
//   REPISAS   dos balcones de piedra a 88 px. Arriba no llegan las ondas del
//             pisoton (van a ras de suelo), pero el garrote, la estocada y la
//             embestida si: el ogro mide 232 y le da igual.
//   CASCOTES  el pisoton hace temblar la boveda y caen piedras. Avisan con su
//             sombra en el suelo y tardan 1.2 s en llegar; una cae donde esta
//             ella, para obligarla a moverse. Si le dan, duelen -- y si el ogro
//             se mete debajo, tambien le duelen a el.
//   ESCOMBROS lo que queda de cada cascote. Cortan el paso (hay que saltarlos
//             o subirse), paran las ondas, y el ogro los revienta al pasar. La
//             espada tambien los rompe.

import { SUELO, AX0, AX1, CUERPO_K, herir } from './caba-cuerpo.js';
import * as OG from './ogro-cuerpo.js';

// --- Las repisas ---
// y = donde apoyan los pies. 452 - 364 = 88 px: el salto completo sube 116, asi
// que se llega con margen; el salto CORTADO (43 px) no llega, y eso esta bien:
// subir es una decision, no un accidente.
export const REPISAS = [
  { x0: 250, x1: 406, y: 364 },
  { x0: 800, x1: 956, y: 364 },
];

// --- Los cascotes ---
// Tres tamaños, los de arena-atlas.js a x2. La caja de choque es algo menor que
// el dibujo (el contorno y las puntas no cuentan): mejor que ella pase rozando
// una piedra dibujada que chocar con aire.
export const TIPOS = [
  { ancho: 56, alto: 40 },
  { ancho: 50, alto: 36 },
  { ancho: 60, alto: 42 },
];
export const AVISO_T = 0.7;          // la sombra en el suelo antes de que caiga
export const CAE_Y0 = -60;           // de donde sale: por encima del borde de arriba
export const CAE_V0 = 300, CAE_G = 3000;
export const MAX_ESCOMBROS = 3;
export const VIDA_ESCOMBRO = 14;     // luego se desmorona solo
export const DANO_OGRO = 1;

export function makeArena() {
  return { piedras: [], escombros: [], id: 0 };
}

// Lo que la fisica de ella necesita saber (ver stepCaballero).
export function mundo(A) {
  return {
    repisas: REPISAS,
    bloques: A.escombros.map(e => ({ x0: e.x - e.ancho / 2, x1: e.x + e.ancho / 2, top: SUELO - e.alto })),
  };
}

// ¿Esta x esta libre para que caiga una piedra? Ni bajo una repisa (la piedra
// se quedaria encima, o peor, dentro), ni encima de otro escombro o piedra.
function libre(A, x, ancho) {
  if (x - ancho / 2 < AX0 + 10 || x + ancho / 2 > AX1 - 10) return false;
  for (const r of REPISAS) if (x + ancho / 2 > r.x0 - 20 && x - ancho / 2 < r.x1 + 20) return false;
  for (const e of A.escombros) if (Math.abs(e.x - x) < (e.ancho + ancho) / 2 + 20) return false;
  for (const p of A.piedras) if (Math.abs(p.x - x) < 90) return false;
  return true;
}

// Busca la x libre mas cercana a la deseada, a pasos de 12 px hacia los lados.
function cerca(A, x, ancho) {
  for (let d = 0; d < 1100; d += 12) {
    if (libre(A, x + d, ancho)) return x + d;
    if (libre(A, x - d, ancho)) return x - d;
  }
  return null;
}

// El pisoton acaba de caer: suelta `n` piedras. La primera apunta a ella (con
// algo de error: no es un francotirador); el resto, a cualquier sitio de la
// arena que no este pegado al ogro.
export function sueltaPiedras(A, O, K, rnd, n = 2) {
  for (let i = 0; i < n; i++) {
    const tipo = (rnd() * TIPOS.length) | 0;
    const ancho = TIPOS[tipo].ancho;
    let x = null;
    if (i === 0) x = cerca(A, K.x + (rnd() - 0.5) * 80, ancho);
    for (let intento = 0; x === null && intento < 20; intento++) {
      const c = AX0 + 60 + rnd() * (AX1 - AX0 - 120);
      if (Math.abs(c - O.x) > 140) x = cerca(A, c, ancho);
    }
    if (x !== null) A.piedras.push({ id: ++A.id, x, tipo, fase: 'aviso', t: 0, y: CAE_Y0, vy: 0 });
  }
}

// Un paso de la arena. Devuelve lo que ha pasado, para que la escena ponga el
// polvo, el temblor y el sonido: [{ tipo, x, y }].
//   impacto  una piedra toca el suelo y se queda como escombro
//   golpea   una piedra le cae encima a ella
//   ogro     una piedra le cae encima al ogro
//   rompe    un escombro revienta (el ogro, la espada, o se desmorona)
//   onda     una onda del pisoton choca con un escombro y se deshace
export function stepArena(A, K, O, dt, espada) {
  const ev = [];

  // --- Las piedras ---
  for (const p of A.piedras) {
    p.t += dt;
    if (p.fase === 'aviso') {
      if (p.t >= AVISO_T) { p.fase = 'cae'; p.vy = CAE_V0; }
      continue;
    }
    p.vy += CAE_G * dt;
    p.y += p.vy * dt;
    const T = TIPOS[p.tipo];
    // ¿Le cae encima a ella? Se mira en TODA la caida, no solo al llegar: si
    // salta justo debajo, la piedra la encuentra en el aire.
    if (!p.fuera && K.vivo && Math.abs(K.x - p.x) < T.ancho / 2 + CUERPO_K - 6 &&
        p.y > K.y - 170 && p.y - T.alto < K.y) {
      const r = herir(K, p.x, true);
      if (r === true) { ev.push({ tipo: 'golpea', x: p.x, y: p.y }); p.fuera = true; continue; }
      // invulnerable (rodando o recien golpeada): la piedra sigue su camino
    }
    // ¿Y al ogro? Si se ha metido debajo, le duele: es la forma de usar la
    // arena contra el.
    if (!p.fuera && O.vivo && O.st !== OG.MUERTO && Math.abs(O.x - p.x) < T.ancho / 2 + OG.CUERPO_R &&
        p.y > SUELO - OG.ALTO) {
      OG.hiereOgro(O, DANO_OGRO, 0);
      ev.push({ tipo: 'ogro', x: p.x, y: p.y }); p.fuera = true; continue;
    }
    if (p.y >= SUELO) {
      p.fuera = true;
      ev.push({ tipo: 'impacto', x: p.x, y: SUELO });
      A.escombros.push({ id: p.id, x: p.x, tipo: p.tipo, ancho: T.ancho, alto: T.alto, t: 0 });
      if (A.escombros.length > MAX_ESCOMBROS) {
        const viejo = A.escombros.shift();
        ev.push({ tipo: 'rompe', x: viejo.x, y: SUELO - viejo.alto / 2 });
      }
    }
  }
  A.piedras = A.piedras.filter(p => !p.fuera);

  // --- Los escombros ---
  for (const e of A.escombros) {
    e.t += dt;
    const x0 = e.x - e.ancho / 2, x1 = e.x + e.ancho / 2;
    let rompe = e.t >= VIDA_ESCOMBRO;
    // el ogro los revienta al pasar: 232 px de bicho no se para por una piedra
    if (O.vivo && Math.abs(O.x - e.x) < OG.CUERPO_R + e.ancho / 2) rompe = true;
    // la espada de ella tambien (el tramo del puño a la punta)
    if (espada && espada[1] >= x0 && espada[0] <= x1) rompe = true;
    // las ondas del pisoton se deshacen contra el escombro
    for (const w of O.ondas) {
      if (w.vivo && w.x >= x0 && w.x <= x1) { w.vivo = false; ev.push({ tipo: 'onda', x: w.x, y: SUELO }); }
    }
    if (rompe) { e.roto = true; ev.push({ tipo: 'rompe', x: e.x, y: SUELO - e.alto / 2 }); }
  }
  A.escombros = A.escombros.filter(e => !e.roto);
  return ev;
}
