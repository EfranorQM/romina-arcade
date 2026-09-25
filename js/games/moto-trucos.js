// FURIA - los trucos en el aire. Sin DOM: el arnes (tools/prueba-furia.mjs)
// mide con este mismo modulo cuanto aire hace falta para cada uno.
//
// Se hacen con el boton TRUCO en el aire. Cada toque lanza el siguiente de la
// lista (si hay uno en marcha, se pone a la cola: uno). Varios en el mismo
// salto hacen COMBO: el segundo vale el doble, el tercero el triple.
//
// Aterrizar en mitad de un truco no mata (esto lo juega Romina, no un
// profesional): el truco se pierde y sale TARDE. Asi el riesgo es de puntos,
// no de partida.
//
// La duracion manda: un salto normal (0.47 s de vuelo) da para SIN MANOS si se
// toca enseguida; una rampa, para uno o dos; el salto gigante, para el combo
// entero. El orden de la lista va de corto a largo por eso.

// Duraciones medidas contra el aire que hay (tools/prueba-furia.mjs, los
// trucos): salto normal ~0.43 s, rampa pequeña ~0.55, salto gigante ~1 s y
// saltando en su labio ~1.25.
export const TRUCOS = [
  { id: 'sinmanos', nombre: 'SIN MANOS', dur: 0.32, pts: 150 },
  { id: 'superman', nombre: 'SUPERMAN', dur: 0.4, pts: 200 },
  { id: 'talones', nombre: 'TALONES', dur: 0.4, pts: 200 },
  { id: 'cancan', nombre: 'CAN-CAN', dur: 0.45, pts: 250 },
  { id: 'nada', nombre: 'NADA', dur: 0.55, pts: 400 },
];

export function creaTrucos() {
  return { actual: null, t: 0, cola: 0, siguiente: 0, hechos: [], tarde: false };
}

// Un toque de TRUCO. Devuelve true si empezo (o se puso en cola).
export function pide(S, enAire) {
  if (!enAire) return false;
  if (S.actual) { S.cola = 1; return true; }
  S.actual = TRUCOS[S.siguiente % TRUCOS.length];
  S.siguiente++;
  S.t = 0;
  return true;
}

// Avanza el reloj. Devuelve el truco que se acaba de COMPLETAR, o null.
export function avanza(S, dt) {
  if (!S.actual) return null;
  S.t += dt;
  if (S.t < S.actual.dur) return null;
  const hecho = S.actual;
  S.hechos.push(hecho);
  S.actual = null;
  if (S.cola) { S.cola = 0; pide(S, true); }
  return hecho;
}

// Al tocar suelo. Devuelve { puntos, nombres, tarde }: los trucos completos de
// este salto con su combo, y si se aterrizo en mitad de uno.
export function aterriza(S) {
  let puntos = 0;
  S.hechos.forEach((t, i) => { puntos += t.pts * (i + 1); });
  const r = { puntos, nombres: S.hechos.map(t => t.nombre), tarde: !!S.actual };
  S.actual = null; S.cola = 0; S.hechos = []; S.siguiente = 0; S.t = 0;
  return r;
}

// Para la pose: que truco y cuanto de el (0 nada, 1 del todo), con entrada y
// salida suaves (un tercio de la duracion cada una).
export function pose(S) {
  if (!S.actual) return { id: null, k: 0 };
  const u = S.t / S.actual.dur;
  const c = Math.max(0, Math.min(1, u < 0.33 ? u / 0.33 : u > 0.67 ? (1 - u) / 0.33 : 1));
  return { id: S.actual.id, k: c * c * (3 - 2 * c) };
}
