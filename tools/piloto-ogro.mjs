// EL PILOTO de la pelea contra el ogro: la juega como una PERSONA, con los
// modulos reales (caba-cuerpo, ogro-cuerpo, caba-arena). Lo usa
// tools/prueba-peleas.mjs.
//
// Hasta el 24-09-2026 nadie jugaba la pelea ENTERA: los arneses median cada
// ataque suelto con reflejos de 0.25 s. Jugada entera con reflejos de persona
// salio que en NORMAL no se ganaba nunca (ver caba-partida.js).
//
// LO QUE LO HACE PERSONA Y NO MAQUINA (cada punto salio de un fallo suyo):
//   - Sus reflejos VARIAN: cada ataque lo contesta tras un tiempo sacado de una
//     normal (media `reac`, desviacion 0.08 s), nunca en el mismo frame.
//   - Los saltos se CRONOMETRAN, con error (+-0.07 s): la onda cuando le va a
//     llegar, y el pisoton de cerca justo antes de que baje el pie.
//   - La embestida de lejos la ESPERA: esquivar en cuanto la ve es caer
//     delante del ogro antes de que arranque (el primer piloto lo hacia y
//     parecia que la embestida era injusta).
//   - Pega siempre que el ogro no ataca, no solo cuando se queda abierto (el
//     primero solo pegaba abierto, alargaba la pelea y recibia mas golpes).
//   - Se aparta de la sombra de los cascotes tambien durante el pisoton (el
//     primero no miraba el techo mientras esperaba la onda).
// Se sabe la respuesta de cada ataque: la que enseña el maestro.
// `machacon`: ataca sin parar y no se defiende nunca; es el control de que
// defenderse vale la pena.
import * as C from '../www/js/games/caba-cuerpo.js';
import * as O from '../www/js/games/ogro-cuerpo.js';
import * as AR from '../www/js/games/caba-arena.js';
import * as P from '../www/js/games/caba-partida.js';

const DT = 1 / 60;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };

// Una normal por Box-Muller con el rnd que se le pase.
export function normal(rnd, mu, sd) {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function piloto(K, Og, m, rnd, reac, A, machacon = false) {
  const inp = { ...NADA };
  const d = Og.x - K.x, ad = Math.abs(d), hacia = Math.sign(d) || 1;
  m.t = (m.t || 0) + DT;
  // Un ataque nuevo: cuando empezo y cuanto va a tardar en contestarlo.
  if (Og.st === O.ATACA && (m.atkVisto !== Og.atk || !m.enAtaque)) {
    m.enAtaque = true; m.atkVisto = Og.atk; m.desde = m.t;
    m.reac = Math.max(0.2, normal(rnd, reac, 0.08)); m.hecho = false; m.saltoEn = null; m.cerca = undefined;
  }
  if (Og.st !== O.ATACA) m.enAtaque = false;
  const visto = m.enAtaque && m.t - m.desde >= m.reac;

  // LAS ONDAS: salta cuando la que viene le va a llegar en ~0.16 s.
  if (!machacon) for (const w of Og.ondas) {
    if (!w.vivo || w.saltada || Math.sign(K.x - w.x) !== w.dir) continue;
    const llega = (Math.abs(K.x - w.x) - 30) / O.ONDA_V;
    if (w.objetivo === undefined) w.objetivo = 0.16 + normal(rnd, 0, 0.07);
    if (llega <= w.objetivo && K.enSuelo) { inp.salta = true; w.saltada = true; return inp; }
  }

  if (visto && !machacon) {
    const atk = Og.atk;
    if (atk === O.GARROTE) {
      if (K.dir !== hacia) { inp.dx = hacia * 0.5; return inp; }
      inp.bloquea = true; return inp;
    }
    // El barrido: lo que dice el consejo, esquivar HACIA EL (lo atraviesa).
    if (atk === O.BARRIDO && !m.hecho && K.enSuelo) { m.hecho = true; inp.esquiva = true; inp.dx = hacia; return inp; }
    // La embestida: de cerca en cuanto la ve; de lejos espera a que venga.
    if (atk === O.EMBESTIDA && !m.hecho && K.enSuelo) {
      if (m.cerca === undefined) m.cerca = 200 + normal(rnd, 0, 25);
      if (ad < m.cerca) { m.hecho = true; inp.esquiva = true; inp.dx = hacia; return inp; }
    }
    // El pisoton de cerca: saltar justo antes de que baje el pie. De lejos,
    // la onda (arriba). Despues del pie, lo de siempre.
    if (atk === O.PISOTON && !Og.golpeo && ad < 200 && !m.hecho && K.enSuelo) {
      const pisa = O.ATAQUES[O.PISOTON][1] / O.ritmoDe(Og, O.PISOTON);
      if (m.saltoEn === null) m.saltoEn = pisa - 0.17 + normal(rnd, 0, 0.07);
      if (m.t - m.desde >= m.saltoEn) { m.hecho = true; inp.salta = true; }
      return inp;
    }
  }
  // LOS CASCOTES: su sombra avisa; tras verla (sus reflejos), se aparta.
  if (A && !machacon) for (const p of A.piedras) {
    m.vistas = m.vistas || {};
    if (m.vistas[p.id] === undefined) m.vistas[p.id] = m.t + Math.max(0.2, normal(rnd, reac, 0.08));
    if (m.t >= m.vistas[p.id] && Math.abs(K.x - p.x) < 70) { inp.dx = Math.sign(K.x - p.x) || 1; return inp; }
  }
  // Pega siempre que el ogro no este atacando (ni rugiendo, invulnerable).
  const pegar = (Og.st !== O.ATACA && Og.st !== O.RUGE) || machacon;
  if (pegar && ad < 175) {
    if (K.dir !== hacia) { inp.dx = hacia; return inp; }
    if (m.ultimoTajo === undefined || m.t - m.ultimoTajo >= 0.27) { inp.golpea = true; m.ultimoTajo = m.t; }
    return inp;
  }
  // Si no, a distancia de combo.
  if (ad > 150) inp.dx = hacia;
  else if (ad < 95) inp.dx = -hacia * 0.5;
  else if (K.dir !== hacia) inp.dx = hacia * 0.3;
  return inp;
}

// Una pelea entera, con la regla de la escena (caballero.js): sin el maestro
// (con todo aprendido el ogro usa los cuatro ataques) y sin el ogro que
// aprende. Devuelve { gano, t, hp, que: {tipo de golpe: corazones} }.
export function pelea(dif, reac, sem, opciones = {}) {
  let s = sem >>> 0 || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const K = C.makeCaballero(170, P.opcionesElla(dif));
  const Og = O.makeOgro(880, { ...P.opcionesOgro(dif, null), aprende: false });
  Og.esperaT = 0.8 * Og.pausa;
  const A = AR.makeArena();
  const m = {}, que = {};
  let t = 0;
  for (let n = 0; n < 60 * 240; n++) {
    t += DT;
    const hp = K.hp;
    C.stepCaballero(K, piloto(K, Og, m, rnd, reac, A, opciones.machacon), DT, AR.mundo(A));
    const ondas = Og.ondas.length;
    O.stepOgro(Og, K, DT, rnd);
    if (Og.ondas.length > ondas) AR.sueltaPiedras(A, Og, K, rnd, Og.fase >= 3 ? 3 : 2);
    O.empujaCuerpo(Og, K);
    if (C.espadaActiva(K) && Og.vivo && !K.golpeo) {
      const [px] = C.puntaEspada(K);
      if (O.espadaTocaOgro(Og, px, K.x) && O.hiereOgro(Og, C.danoTajo(K), K.dir)) K.golpeo = 1;
    }
    let tipo = null;
    const g = Og.vivo && K.vivo ? O.golpeaA(Og, K) : null;
    if (g) {
      if (C.herir(K, g.x, g.tipo, g.dano) === 'parada') O.abrePorParada(Og, C.PARADA_PREMIO);
      tipo = g.tipo;
    }
    for (const e of AR.stepArena(A, K, Og, DT, null)) if (e.tipo === 'golpea') tipo = 'cascote';
    if (K.hp < hp) que[tipo || '?'] = (que[tipo || '?'] || 0) + (hp - K.hp);
    if (!Og.vivo) return { gano: true, t, hp: K.hp, que };
    if (!K.vivo) return { gano: false, t, hp: 0, que };
  }
  return { gano: false, t, hp: K.hp, que };
}
