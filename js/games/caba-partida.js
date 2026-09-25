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
//   reflejos    lo que la dificultad le pide al pulgar: lo que tarda en ver un
//               ataque y pulsar su respuesta. Cada ataque tiene que dejar AL
//               MENOS esto desde que empieza su aviso (lo mide el arnes)
//   corazones   los de ella
//   paradaVent  cuanto dura la ventana de la PARADA (normal: 0.18 s)
//   ogroHp      la vida del ogro
//   ritmoCarga  lo rapido que AVISA el ogro (>1, menos aviso). Solo el aviso:
//               el golpe dura siempre lo mismo (ver makeOgro)
//   ritmoBosque lo mismo para el lobo y la kitsune de la aventura: un lobo
//               muere en tres tajos y no hace falta tanto aviso como el ogro
//               (con el del ogro, en PASEO pasaba el bosque hasta el que no se
//               defendia nunca)
//   ritmoCarrera el de los ataques de CARRERA (la embestida, la acometida del
//               lobo): se contestan atravesandolos cuando vienen, asi que un
//               aviso mas largo no ayuda: quien reacciona rapido salta antes de
//               que arranquen y cae delante (ver ritmoDe en ogro-cuerpo.js)
//   pausa       lo que descansa entre ataques (>1, mas)
//   mult        por cuanto se multiplican los puntos
//
// POR QUE ESTOS NUMEROS (24-09-2026, "muy dificil incluso en el modo facil").
// Hasta la v1.0.24 el ritmo era 0.8 / 1.0 / 1.2, medido con un arnes que
// reaccionaba en 0.25 s. Una persona tarda mas en VER el ataque, elegir entre
// cuatro botones y pulsar: 0.35 s quien juega mucho, 0.45 una persona normal,
// 0.55-0.65 quien juega poco. Con 1.0 el garrotazo daba 0.32 s para levantar la
// guardia: en NORMAL una persona normal no ganaba NINGUNA pelea (0 de 40 con el
// piloto de tools/prueba-peleas.mjs), en FURIA nadie, y en PASEO ganaba mas el
// que machacaba ATACAR sin defenderse que el que se defendia. Ahora:
//   PASEO   reflejos 0.60: 40 de 40 perdiendo 1.3 corazones; el que no se
//           defiende gana 18 de 40 (con el ogro de 24 de vida: con 18, 40)
//   NORMAL  reflejos 0.45: 36 de 40; con 0.55, la mitad
//   FURIA   reflejos 0.35: 25 de 40; con 0.45, casi nunca
// En el bosque (24 partidas cada uno): PASEO con 0.60 llega siempre perdiendo
// 1.5 de 6 corazones, NORMAL con 0.45 y FURIA con 0.35 tambien; el que no se
// defiende no llega en ninguna.
export const DIFICULTADES = {
  paseo:  { nombre: 'PASEO',  lema: 'EL OGRO AVISA CON CALMA', reflejos: 0.60, corazones: 6,
            paradaVent: 0.26, ogroHp: 24, ritmoCarga: 0.5, ritmoBosque: 0.7, ritmoCarrera: 0.8, pausa: 1.6, mult: 0.6 },
  normal: { nombre: 'NORMAL', lema: 'LA PELEA DE VERDAD',      reflejos: 0.45, corazones: 4,
            paradaVent: 0.18, ogroHp: 24, ritmoCarga: 0.65, ritmoBosque: 0.9, ritmoCarrera: 1.0, pausa: 1.0, mult: 1.0 },
  furia:  { nombre: 'FURIA',  lema: 'EL OGRO NO DA TREGUA',    reflejos: 0.35, corazones: 3,
            paradaVent: 0.15, ogroHp: 30, ritmoCarga: 0.8, ritmoBosque: 1.1, ritmoCarrera: 1.2, pausa: 0.6, mult: 1.6 },
};
export const ORDEN = ['paseo', 'normal', 'furia'];

// Lo que cada cuerpo recibe al nacer (makeCaballero / makeOgro).
export function opcionesElla(dif) {
  const D = DIFICULTADES[dif];
  return { hp: D.corazones, paradaVent: D.paradaVent };
}
export function opcionesOgro(dif, permitidos) {
  const D = DIFICULTADES[dif];
  return { hp: D.ogroHp, ritmoCarga: D.ritmoCarga, ritmoCarrera: D.ritmoCarrera, pausa: D.pausa, permitidos };
}
// Y los enemigos de la AVENTURA (caba-enemigos.js): el ritmo acorta sus avisos
// y la pausa, lo que descansan.
export function opcionesBosque(dif) {
  const D = DIFICULTADES[dif] || DIFICULTADES.normal;
  return { ritmo: D.ritmoBosque, ritmoCarrera: D.ritmoCarrera, pausa: D.pausa };
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

// ---------- LAS MEDALLAS y EL ARMARIO ----------
// Motivos para volver: once medallas con nombre, cada una con un reto que no
// es solo ganar, y cada una desbloquea una prenda del ARMARIO (un color de
// capa, de falda o de la estela del tajo). El pelo no se toca: tiene que ser
// negro, como pidio Anderson.
//
// `r` = lo que dejo la pelea (ver cierra() en caballero.js): lo de puntua()
// mas paredes (veces que se estrello el ogro), usoGuardia, dif, nota, alumna
// (ya aprendio los cuatro ataques) y aprendio (el OGRO aprendio algo de ella).
export const MEDALLAS = [
  { id: 'victoria',   nombre: 'PRIMERA VICTORIA',   pide: 'GANAR UNA PELEA',                 premio: ['capa', 'rosa'],
    vale: r => r.gano },
  { id: 'alumna',     nombre: 'ALUMNA APLICADA',    pide: 'APRENDER LOS CUATRO ATAQUES',     premio: ['estela', 'rosa'],
    vale: r => r.alumna },
  { id: 'intacta',    nombre: 'SIN UN RASGUÑO',     pide: 'GANAR SIN PERDER VIDA',           premio: ['estela', 'dorada'],
    vale: r => r.gano && r.vida === r.vidaMax },
  { id: 'paradas',    nombre: 'CINCO PARADAS',      pide: '5 PARADAS EN UNA PELEA',          premio: ['falda', 'azul'],
    vale: r => r.paradas >= 5 },
  { id: 'contras',    nombre: 'TRES CONTRAATAQUES', pide: '3 CONTRAATAQUES EN UNA PELEA',    premio: ['falda', 'morada'],
    vale: r => r.contras >= 3 },
  { id: 'pared',      nombre: 'CONTRA LA PARED',    pide: 'ESTRELLARLO 2 VECES EN UNA PELEA', premio: ['capa', 'verde'],
    vale: r => r.paredes >= 2 },
  { id: 'singuardia', nombre: 'SIN GUARDIA',        pide: 'GANAR SIN LEVANTAR LA GUARDIA',   premio: ['estela', 'fuego'],
    vale: r => r.gano && !r.usoGuardia },
  { id: 'relampago',  nombre: 'RELAMPAGO',          pide: 'GANAR EN MENOS DE UN MINUTO',     premio: ['estela', 'azul'],
    vale: r => r.gano && r.t < 60 },
  { id: 'furia',      nombre: 'FURIA DOMADA',       pide: 'GANAR EN FURIA',                  premio: ['capa', 'negra'],
    vale: r => r.gano && r.dif === 'furia' },
  { id: 'notaS',      nombre: 'MATRICULA DE HONOR', pide: 'SACAR UNA S',                     premio: ['capa', 'dorada'],
    vale: r => r.nota === 'S' },
  { id: 'lista',      nombre: 'MAS LISTA QUE EL',   pide: 'GANARLE DESPUES DE QUE APRENDA',  premio: ['falda', 'negra'],
    vale: r => r.gano && r.aprendio },
];

// LO QUE EL OGRO APRENDE (ver HABITO_CONTRA en ogro-cuerpo.js), como se
// anuncia y que boton lo contesta: una contramedida que no se ve es trampa.
export const CONTRAS = {
  finta: { texto: ['EL OGRO TE HA LEIDO LA GUARDIA', 'AHORA FINGE: ESPERA AL GOLPE DE VERDAD'], boton: 'guardia' },
  doble: { texto: ['EL OGRO TE HA VISTO SALTAR', 'AHORA PISA DOS VECES: SALTA LAS DOS'], boton: 'saltar' },
  acoso: { texto: ['EL OGRO TE HA VISTO HUIR', 'SI TE ALEJAS TE EMBISTE: ATRAVIESALO'], boton: 'esquivar' },
  giro:  { texto: ['EL OGRO TE HA VISTO PASAR', 'SE DA LA VUELTA RAPIDO: PARA O ESQUIVA'], boton: 'guardia' },
};

// Las medallas que esta pelea gana (las tenga ya o no).
export function medallasDe(r) { return MEDALLAS.filter(m => m.vale(r)).map(m => m.id); }

// EL ARMARIO: cada prenda y sus tonos, de oscuro a claro, en el mismo orden
// que los colores que tiñen (TINTES en romi-atlas.js). La primera de cada
// lista es la de siempre y no hay que ganarla.
export const ARMARIO = {
  capa: [
    { id: 'azul',   nombre: 'AZUL',   tonos: ['#243c90', '#3060c0', '#4878d8'] },
    { id: 'rosa',   nombre: 'ROSA',   tonos: ['#8e1446', '#c8286a', '#ec5c98'] },
    { id: 'verde',  nombre: 'VERDE',  tonos: ['#16502e', '#26804a', '#48b070'] },
    { id: 'negra',  nombre: 'NEGRA',  tonos: ['#141019', '#282232', '#443c54'] },
    { id: 'dorada', nombre: 'DORADA', tonos: ['#8a5a10', '#c8901e', '#f0c048'] },
  ],
  falda: [
    { id: 'roja',   nombre: 'ROJA',   tonos: ['#84240c', '#9c3018', '#b43c24', '#d83018', '#f04830'],
      ribete: ['#d87830', '#f09048'] },
    { id: 'azul',   nombre: 'AZUL',   tonos: ['#101e52', '#18286a', '#203488', '#2a48ac', '#3a62d0'],
      ribete: ['#c8a040', '#f0d070'] },
    { id: 'morada', nombre: 'MORADA', tonos: ['#28104a', '#361662', '#46207c', '#5a2c9c', '#7440c0'],
      ribete: ['#c8a040', '#f0d070'] },
    { id: 'negra',  nombre: 'NEGRA',  tonos: ['#0e0c12', '#16121c', '#201a28', '#2c2436', '#3a3048'],
      ribete: ['#a8a0b8', '#d0c8dc'] },
  ],
  estela: [
    { id: 'blanca', nombre: 'BLANCA',   tonos: ['#eaeaea', '#f0f0f0', '#ffffff'] },
    { id: 'rosa',   nombre: 'ROSA',     tonos: ['#f070a8', '#ffa0c8', '#ffe0ee'] },
    { id: 'dorada', nombre: 'DORADA',   tonos: ['#f0c040', '#ffe070', '#fff4c0'] },
    { id: 'fuego',  nombre: 'DE FUEGO', tonos: ['#f05030', '#ffa040', '#fff0a0'] },
    { id: 'azul',   nombre: 'AZUL',     tonos: ['#6098f0', '#a0c8ff', '#e0f0ff'] },
  ],
};
export const TRAJE0 = { capa: 'azul', falda: 'roja', estela: 'blanca' };
export const PARTES = ['capa', 'falda', 'estela'];

// La medalla que desbloquea una prenda (null = la de siempre).
export function medallaDe(parte, id) {
  return MEDALLAS.find(m => m.premio[0] === parte && m.premio[1] === id) || null;
}
export function prenda(parte, id) { return ARMARIO[parte].find(p => p.id === id) || ARMARIO[parte][0]; }
export function disponible(parte, id, medallas) {
  const m = medallaDe(parte, id);
  return !m || medallas.includes(m.id);
}
// Un traje guardado, con lo que ya no valga (una prenda que no existe o que
// no se ha ganado) vuelto a lo de siempre.
export function trajeValido(t, medallas) {
  const out = { ...TRAJE0 };
  for (const parte of PARTES) {
    const id = t && t[parte];
    if (id && ARMARIO[parte].some(p => p.id === id) && disponible(parte, id, medallas)) out[parte] = id;
  }
  return out;
}
// Los tonos con que se tiñe la hoja para un traje (ver vestir() en
// romi-sprite.js).
export function tintesDe(t) {
  const f = prenda('falda', t.falda);
  return { capa: prenda('capa', t.capa).tonos, falda: f.tonos, ribete: f.ribete, estela: prenda('estela', t.estela).tonos };
}

// ---------- EL MAESTRO: la primera pelea enseña ----------
// Los ataques en el orden en que se aprenden, con el boton que los contesta y
// el consejo. La primera vez que sale cada uno el mundo va a camara lenta
// durante el aviso, el consejo aparece arriba y su boton brilla.
export const LECCIONES = [
  { atk: GARROTE,   boton: 'guardia',  texto: ['EL GARROTAZO SE PARA', 'PULSA GUARDIA JUSTO ANTES DEL GOLPE'] },
  { atk: PISOTON,   boton: 'saltar',   texto: ['EL PISOTON SUELTA ONDAS', 'SALTALAS'] },
  // (Hacia el: pegada al ogro, esquivar hacia atras solo salva en un tramo
  // corto -- ni antes ni despues --; atravesandolo, desde que empieza.)
  { atk: BARRIDO,   boton: 'esquivar', texto: ['EL BARRIDO NO SE PARA', 'ESQUIVA HACIA EL Y LO ATRAVIESAS'] },
  { atk: EMBESTIDA, boton: 'esquivar', texto: ['LA EMBESTIDA', 'ESQUIVA HACIA EL Y LO ATRAVIESAS'] },
];
// Si en tres intentos no aprende uno, se suelta el siguiente igual: la pelea
// no puede quedarse atascada en garrotazos para siempre. El consejo sigue
// saliendo mientras no lo aprenda. Los intentos se cuentan ENTRE PELEAS (y se
// guardan): contados por pelea, un ataque que sale menos de tres veces en
// cada una no se soltaba nunca y la camara lenta frenaba todas las partidas.
export const INTENTOS = 3;

// `guardado` es lo que se guardo la vez anterior (Save.dato): { aprendidas,
// pasadas }, listas de ataques.
export function makeMaestro(guardado) {
  return {
    aprendidas: new Set((guardado && guardado.aprendidas) || []),
    pasadas: new Set((guardado && guardado.pasadas) || []),
    intentos: { ...((guardado && guardado.intentos) || {}) },   // en todas las peleas
    vistas: {},           // cuantas veces ha salido cada ataque en ESTA pelea
    actual: null,         // el ataque en curso y lo que ella ha hecho en el
    cambios: false,       // hay algo nuevo que guardar
  };
}
export function paraGuardar(M) { return { aprendidas: [...M.aprendidas], pasadas: [...M.pasadas], intentos: { ...M.intentos } }; }
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
  if (!M.aprendidas.has(atk)) { M.intentos[atk] = (M.intentos[atk] || 0) + 1; M.cambios = true; }
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
  if (!M.aprendidas.has(a.atk) && !M.pasadas.has(a.atk) && M.intentos[a.atk] >= INTENTOS) {
    M.pasadas.add(a.atk); M.cambios = true;
  }
  return null;
}
