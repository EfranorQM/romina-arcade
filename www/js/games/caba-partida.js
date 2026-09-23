// LA PARTIDA de ROMINA: lo que rodea a la pelea. SIN DOM, como los cuerpos:
// tools/prueba-caba-partida.mjs lo mide en Node.
//
//   DIFICULTADES   paseo, normal y furia
//   puntua()       los puntos y la nota (S A B C) al acabar
//   el MAESTRO     la primera pelea enseña: el ogro suelta sus ataques de uno
//                  en uno, segun ella aprende a contestar cada uno
//
// POR QUE EXISTE: hasta aqui la pelea empezaba de golpe y, al ganar o perder,
// se reiniciaba sola a los 3 s. No tenia principio, ni final, ni motivo para
// volver, y era el unico juego del arcade que no guardaba record.

import { GARROTE, PISOTON, BARRIDO, EMBESTIDA } from './ogro-cuerpo.js';

// ---------- Las dificultades ----------
//   corazones   los de ella
//   paradaVent  cuanto dura la ventana de la PARADA (normal: 0.18 s)
//   ogroHp      la vida del ogro
//   ritmoCarga  lo rapido que AVISA el ogro (>1, menos aviso). Solo el aviso:
//               el golpe dura siempre lo mismo (ver makeOgro)
//   pausa       lo que descansa entre ataques (>1, mas)
//   mult        por cuanto se multiplican los puntos
// Los tiempos de aviso con ritmoCarga 1.2 (furia) siguen pasando el minimo de
// la reaccion en movil (0.30 s): el mas corto, el barrido, queda en 0.33. Lo
// vigila el arnes.
export const DIFICULTADES = {
  paseo:  { nombre: 'PASEO',  lema: 'EL OGRO AVISA CON CALMA', corazones: 6,
            paradaVent: 0.26, ogroHp: 18, ritmoCarga: 0.8, pausa: 1.6, mult: 0.6 },
  normal: { nombre: 'NORMAL', lema: 'LA PELEA DE VERDAD',      corazones: 4,
            paradaVent: 0.18, ogroHp: 24, ritmoCarga: 1.0, pausa: 1.0, mult: 1.0 },
  furia:  { nombre: 'FURIA',  lema: 'EL OGRO NO DA TREGUA',    corazones: 3,
            paradaVent: 0.15, ogroHp: 30, ritmoCarga: 1.2, pausa: 0.6, mult: 1.6 },
};
export const ORDEN = ['paseo', 'normal', 'furia'];

// Lo que cada cuerpo recibe al nacer (makeCaballero / makeOgro).
export function opcionesElla(dif) {
  const D = DIFICULTADES[dif];
  return { hp: D.corazones, paradaVent: D.paradaVent };
}
export function opcionesOgro(dif, permitidos) {
  const D = DIFICULTADES[dif];
  return { hp: D.ogroHp, ritmoCarga: D.ritmoCarga, pausa: D.pausa, permitidos };
}

// ---------- Los puntos y la nota ----------
// `r` = lo que dejo la pelea: { gano, t (s de pelea), vida, vidaMax, paradas,
// contras, dano (quitado al ogro), ogroHp }.
//
// GANAR vale 5000 y encima se suma lo bien que se gano: la vida que le queda
// (hasta 3000), cada parada y cada contraataque (250, hasta seis de cada) y el
// reloj (20 por segundo por debajo de 150 s). PERDER vale lo que se le quito al
// ogro, hasta 4000: siempre menos que ganar en la misma dificultad.
//
// La NOTA sale de los puntos ANTES de la dificultad, para que una S sea igual
// de dificil de sacar en paseo que en furia (la dificultad ya la premian los
// puntos). Una S pide no perder casi vida, parar y contraatacar, y no tardar.
export const NOTAS = [['S', 10500], ['A', 9000], ['B', 7500], ['C', 0]];

export function puntua(r, dif) {
  const D = DIFICULTADES[dif];
  if (!r.gano) {
    const base = Math.round(4000 * Math.min(1, r.dano / r.ogroHp));
    return { puntos: Math.round(base * D.mult), base, nota: null };
  }
  const base = Math.round(5000 + 3000 * r.vida / r.vidaMax
    + 250 * Math.min(6, r.paradas) + 250 * Math.min(6, r.contras)
    + 20 * Math.max(0, 150 - r.t));
  return { puntos: Math.round(base * D.mult), base, nota: notaDe(base) };
}
export function notaDe(base) {
  for (const [n, umbral] of NOTAS) if (base >= umbral) return n;
  return 'C';
}

// Los mensajitos del final. Los de record son los del arcade (main.js); estos
// son los de la pelea: uno por nota, y los de perder, que animan.
export const FRASES = {
  S: [['PERFECTA', 'ROMINA'], ['NI UN RASGUÑO'], ['LA REINA DEL CASTILLO']],
  A: [['QUE BARBARIDAD'], ['ESA ESPADA ES TUYA']],
  B: [['BIEN PELEADO'], ['EL OGRO NO SABE', 'CON QUIEN SE METIO']],
  C: [['GANASTE', 'Y ESO CUENTA'], ['VICTORIA ES VICTORIA']],
  pierde: [['CASI, CAMPEONA'], ['LA PROXIMA ES TUYA'], ['ESE OGRO TIENE', 'LOS DIAS CONTADOS']],
};

// ---------- EL MAESTRO: la primera pelea enseña ----------
// Los ataques en el orden en que se aprenden, con el boton que los contesta y
// el consejo. La primera vez que sale cada uno el mundo va a camara lenta
// durante el aviso, el consejo aparece arriba y su boton brilla.
export const LECCIONES = [
  { atk: GARROTE,   boton: 'guardia',  texto: ['EL GARROTAZO SE PARA', 'PULSA GUARDIA JUSTO ANTES DEL GOLPE'] },
  { atk: PISOTON,   boton: 'saltar',   texto: ['EL PISOTON SUELTA ONDAS', 'SALTALAS'] },
  { atk: BARRIDO,   boton: 'esquivar', texto: ['EL BARRIDO NO SE PARA', 'ESQUIVALO'] },
  { atk: EMBESTIDA, boton: 'esquivar', texto: ['LA EMBESTIDA', 'ESQUIVA HACIA EL Y LO ATRAVIESAS'] },
];
// Si en tres intentos no aprende uno, se suelta el siguiente igual: la pelea
// no puede quedarse atascada en garrotazos para siempre. El consejo sigue
// saliendo mientras no lo aprenda.
export const INTENTOS = 3;

// `guardado` es lo que se guardo la vez anterior (Save.dato): { aprendidas,
// pasadas }, listas de ataques.
export function makeMaestro(guardado) {
  return {
    aprendidas: new Set((guardado && guardado.aprendidas) || []),
    pasadas: new Set((guardado && guardado.pasadas) || []),
    vistas: {},           // cuantas veces ha salido cada ataque en ESTA pelea
    actual: null,         // el ataque en curso y lo que ella ha hecho en el
    cambios: false,       // hay algo nuevo que guardar
  };
}
export function paraGuardar(M) { return { aprendidas: [...M.aprendidas], pasadas: [...M.pasadas] }; }
export function lecciona(M) { return LECCIONES.find(L => !M.aprendidas.has(L.atk)) || null; }

// Que ataques puede elegir el ogro ahora: los aprendidos (o pasados), y el
// primero que falte. null = todos, ya no hay nada que enseñar.
export function permitidos(M) {
  const p = [];
  for (const L of LECCIONES) {
    p.push(L.atk);
    if (!M.aprendidas.has(L.atk) && !M.pasadas.has(L.atk)) return p;
  }
  return null;
}

// Empieza un ataque del ogro. Devuelve la leccion que toca (o null) y si va a
// camara lenta: solo la primera vez que sale en esta pelea, y solo mientras no
// se haya soltado por intentos. (Sin eso, el piloto de la app se pasaba 16 s
// de cada 90 a camara lenta: un ataque que no se aprende la frenaba en TODAS
// las peleas. Ya soltado, el consejo sale igual, pero sin parar el juego.)
export function empieza(M, atk) {
  M.vistas[atk] = (M.vistas[atk] || 0) + 1;
  M.actual = { atk, para: false, salta: false, esquiva: false, golpe: false };
  if (M.aprendidas.has(atk)) return null;
  const L = LECCIONES.find(l => l.atk === atk);
  return L ? { leccion: L, lento: M.vistas[atk] === 1 && !M.pasadas.has(atk) } : null;
}

// Lo que ella hace mientras dura: 'para' (la guardia lo detiene), 'salta' (una
// onda le pasa por debajo), 'esquiva' y 'golpe' (le entra).
export function anota(M, que) { if (M.actual) M.actual[que] = true; }

// El ataque ha terminado (y sus ondas se han ido). Devuelve la leccion si la
// acaba de aprender. Cada ataque se aprende contestandolo BIEN y sin comerse
// el golpe: el garrotazo parandolo, el pisoton saltando la onda, y el barrido
// y la embestida esquivando.
export function acaba(M) {
  const a = M.actual;
  M.actual = null;
  if (!a) return null;
  const bien = !a.golpe && (a.atk === GARROTE ? a.para : a.atk === PISOTON ? a.salta : a.esquiva);
  if (bien && !M.aprendidas.has(a.atk)) {
    M.aprendidas.add(a.atk); M.cambios = true;
    return LECCIONES.find(l => l.atk === a.atk) || null;
  }
  if (!M.aprendidas.has(a.atk) && !M.pasadas.has(a.atk) && M.vistas[a.atk] >= INTENTOS) {
    M.pasadas.add(a.atk); M.cambios = true;
  }
  return null;
}
