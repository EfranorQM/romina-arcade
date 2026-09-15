// LA MASA - la mente: lo que la masa cuenta de ella y lo que le crece por eso.
// Sin DOM, y sin nada por frame: son unos cincuenta contadores que se tocan
// unas treinta veces por ronda.
//
// No hay red neuronal ni busqueda: es lo que hacen los juegos de pelea de
// verdad (los ghosts de Tekken, el Shadow de Killer Instinct, la venganza de
// Metal Gear V). Se cuenta POR DONDE pega, HACIA DONDE esquiva, A QUE
// DISTANCIA se queda y QUE combo repite, y en cada muda el habito que domina
// se convierte en un organo que lo contrarresta. Lo que no rinde se reabsorbe
// y lo que ella deja de hacer se olvida: la forma es un espejo de como la
// pelea, y si ella cambia, la masa cambia detras.
//
// Lo emergente de verdad: que organos, en que sector, en que orden, de que
// tamano, y cuales se caen. Lo que pone el disenador: el vocabulario (cinco
// organos) y los umbrales. Se dice sin humo.

import { NR, LATIGO, GARRA, HOJA, ULT_RONDA, sectorDe, crecerPlaca, crecerCadena, quitarCadena,
         tieneCadena, radioEn, NORG } from './masa-cuerpo.js';

export const OLVIDO = 0.85;                 // lo que sobrevive de cada contador por muda
export const MIN_TAJOS = 6, MIN_ESQ = 4, MIN_ACTOS = 6;
// Umbral de dominancia. La ventana de 3 sectores (90 grados) sobre 12 tiene
// un 25% esperado si pega uniforme; el de esquiva (un cajon y medio vecino
// sobre 8) un 25% tambien. Los valores salen de tools/prueba-masa.mjs: el bot
// con manias (ruido de 25 grados) tiene que crecer algo en casi todas las
// mudas, y el uniforme casi nunca.
export const TH_TAJO = 0.55, TH_ESQ = 0.55, TH_DIST = 0.55, TH_COMBO = 0.82;
export const TH_PRIMERA = 0.50;             // la primera muda es mas facil: a los 30 s pasa algo
// Bandas de distancia, medidas desde el BORDE de la piel: cualquiera que use
// la espada esta a ~20 px del borde, eso es lo normal. Pegada es tocarla;
// lejos es quedarse fuera del alcance esperando.
const DIST_PEGADA = 13, DIST_LEJOS = 48;

export function makeMente() {
  return {
    tajo: new Float32Array(NR),       // tajos al cuerpo por sector del mundo (con CLANG)
    esq: new Float32Array(8),         // esquivas por direccion relativa a la masa
    dist: new Float32Array(3),        // segundos en cada banda: pegada / media / lejos
    gram: new Float32Array(8),        // bigramas: contexto (GG GD DG DD) x siguiente (G D)
    tri: new Float32Array(8),         // trigramas de actos, para la HOJA
    tempo: 0.8, tempoN: 0,            // intervalo medio entre dos tajos seguidos (para la HOJA)
    tempoCtx: new Float32Array([0.8, 1.0]), tempoCtxN: new Uint8Array(2),   // hasta el tajo, segun venga de tajo (0) o de dash (1)
    a1: -1, a2: -1, tActo: -1e9,      // ultimos dos actos (0 = G, 1 = D) y cuando fue el ultimo
    distT: 0,
    esqBin: -1,                       // su esquiva dominante (0..7), o -1 si no la conoce
    nTajo: 0, nEsq: 0, nActo: 0,      // muestras de esta ronda
    lecciones: [],                    // lo ultimo que aprendio (para el letrero)
    habitos: [],                      // todo lo que le aprendio (para TU MONSTRUO)
    olvidos: 0, generico: 0,
    paradas: 0, paradasOk: 0, latigoAim: 0, latigoAimOk: 0,
  };
}

// ---------- Observaciones ----------

export function verTajo(mn, s) { mn.tajo[s] += 1; mn.nTajo++; }

// Un dash. La direccion se guarda RELATIVA a la masa (0 = hacia ella, 4 =
// alejandose, 2 = a la derecha de ella mirandola, 6 = a la izquierda): asi
// "siempre esquiva a su derecha" es un habito aunque la masa este en cualquier
// lado, y el latigo puede apuntar a donde va a aterrizar.
export function verEsquiva(mn, K, M, dvx, dvy) {
  const at = Math.atan2(M.y - K.y, M.x - K.x);
  const ad = Math.atan2(dvy, dvx);
  let rel = ad - at;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  let b = Math.round(rel / (Math.PI / 4)) % 8; if (b < 0) b += 8;
  mn.esq[b] += 1; mn.nEsq++;
  verActo(mn, 1, K, M);
}

// Un acto: 0 = tajo, 1 = dash. Alimenta bigramas, trigramas y el tempo.
export function verActo(mn, a, K, M, t) {
  const ahora = t === undefined ? mn.reloj || 0 : t;
  if (mn.a1 >= 0 && mn.a2 >= 0) {
    mn.gram[(mn.a1 * 2 + mn.a2) * 2 + a] += 1;
    mn.tri[mn.a1 * 4 + mn.a2 * 2 + a] += 1;
  }
  if (a === 0 && mn.a2 >= 0) {
    const dt = ahora - mn.tActo;
    if (dt > 0.1 && dt < 2.5) {
      // Media movil del intervalo hasta el tajo, SEGUN DE DONDE VENGA: tras
      // un tajo llega en medio segundo; tras un dash tiene que volver
      // caminando y tarda el doble. Con un solo reloj la parada se abria
      // antes de tiempo despues de cada esquive. Pesa poco cada muestra para
      // que un descanso no lo rompa.
      const c = mn.a2;
      mn.tempoCtx[c] += (dt - mn.tempoCtx[c]) * (mn.tempoCtxN[c] < 4 ? 0.5 : 0.2);
      if (mn.tempoCtxN[c] < 250) mn.tempoCtxN[c]++;
      if (c === 0) { mn.tempo = mn.tempoCtx[0]; mn.tempoN++; }
    }
  }
  mn.a1 = mn.a2; mn.a2 = a; mn.tActo = ahora; mn.nActo++;
}

// Cada frame: reloj y muestreo de distancia (cada 0.25 s).
export function verTiempo(mn, K, M, dt) {
  mn.reloj = (mn.reloj || 0) + dt;
  mn.distT += dt;
  if (mn.distT < 0.25) return;
  mn.distT -= 0.25;
  const d = Math.hypot(K.x - M.x, K.y - M.y) - radioEn(M, Math.atan2(K.y - M.y, K.x - M.x));
  mn.dist[d < DIST_PEGADA ? 0 : d > DIST_LEJOS ? 2 : 1] += 0.25;
}

// ---------- Prediccion ----------

// Probabilidad de que su proximo acto sea un tajo, dado lo que acaba de hacer.
// Devuelve -1 si no tiene datos suficientes: una masa que se niega a adivinar
// es una masa que no parece tramposa.
export function prediceTajo(mn) {
  if (mn.a1 < 0 || mn.a2 < 0) return -1;
  const c = (mn.a1 * 2 + mn.a2) * 2;
  const n = mn.gram[c] + mn.gram[c + 1];
  if (n < 5) return -1;
  return mn.gram[c] / n;
}

// Cuanto falta, segun su tempo, para el tajo siguiente.
export function faltaParaActo(mn) { return mn.tempoCtx[mn.a2 === 1 ? 1 : 0] - ((mn.reloj || 0) - mn.tActo); }

// ---------- La muda ----------

// Ninguna linea del letrero puede pasar de 22 letras: a escala 2 en un lienzo
// de 270 px, 22 letras son 262 px y 23 son 274 (se sale). 'ESQUIVAS A TU
// IZQUIERDA' eran 23 y salia cortada por los dos lados, medido en captura.
// El prefijo mas largo es 'MAS PLACA ' (10), asi que la palabra de sector no
// puede pasar de 12 letras.
const PALABRA_SECTOR = ['LA DERECHA', 'ABAJO-DER', 'ABAJO-DER', 'ABAJO', 'ABAJO-IZQ', 'ABAJO-IZQ',
                        'LA IZQUIERDA', 'ARRIBA-IZQ', 'ARRIBA-IZQ', 'ARRIBA', 'ARRIBA-DER', 'ARRIBA-DER'];
const PALABRA_ESQ = ['HACIA MI', 'A TU DER', 'A TU DER', 'A TU DER', 'HACIA ATRAS',
                     'A TU IZQ', 'A TU IZQ', 'A TU IZQ'];
const CTX = ['TAJO TAJO', 'TAJO DASH', 'DASH TAJO', 'DASH DASH'];

function ventana3(arr, c) { return arr[(c + NR - 1) % NR] + arr[c] + arr[(c + 1) % NR]; }

// Que le crece esta vez. Modifica M y devuelve las lineas del letrero (la
// primera es lo principal). Maximo dos lecciones por muda; si no domina nada,
// crece generico y se dice tambien ("no me pillo nada" se tiene que leer).
export function muda(mn, M, K, rnd) {
  const primera = M.ronda === 1;
  // Como estaban las placas ANTES de esta muda: el olvido no puede tirar una
  // placa que acaba de crecer en esta misma muda (crecia y se caia sola).
  const placa0 = Uint8Array.from(M.placa);
  const th = primera ? TH_PRIMERA : TH_TAJO;
  const cands = [];

  // 1) Por donde pega: ventana de 90 grados sobre los 12 sectores.
  let tot = 0; for (let i = 0; i < NR; i++) tot += mn.tajo[i];
  if (tot >= MIN_TAJOS) {
    let bc = 0, bw = -1;
    // Empate entre ventanas: gana la del centro mas cargado. Pegando justo por
    // abajo, las tres ventanas que contienen ese sector empatan y salia la
    // primera, o sea la placa una posicion corrida.
    for (let c = 0; c < NR; c++) { const w = ventana3(mn.tajo, c); if (w > bw || (w === bw && mn.tajo[c] > mn.tajo[bc])) { bw = w; bc = c; } }
    const share = bw / tot;
    if (share >= th) { const ya = M.placa[bc] > 0; cands.push({ que: 'placa', sec: bc, fuerza: share - th - (ya ? 0.1 : 0), n: bw, texto: ya ? 'MAS PLACA ' + PALABRA_SECTOR[bc] : 'TAJO POR ' + PALABRA_SECTOR[bc] }); }
  }
  // 2) Hacia donde esquiva.
  let te = 0; for (let i = 0; i < 8; i++) te += mn.esq[i];
  if (te >= MIN_ESQ) {
    let bb = 0, bs = -1;
    for (let b = 0; b < 8; b++) { const w = mn.esq[b] + 0.5 * (mn.esq[(b + 7) % 8] + mn.esq[(b + 1) % 8]); if (w > bs) { bs = w; bb = b; } }
    const share = bs / te;
    const the = primera ? TH_ESQ - 0.08 : TH_ESQ;
    if (share >= the) { const ya = tieneCadena(M, LATIGO) >= 0 && mn.esqBin === bb; cands.push({ que: 'latigo', bin: bb, fuerza: share - the - (ya ? 0.15 : 0), n: bs, texto: ya ? 'CRECE EL LATIGO' : 'ESQUIVAS ' + PALABRA_ESQ[bb] }); }
  }
  // 3) A que distancia se queda.
  const td = mn.dist[0] + mn.dist[1] + mn.dist[2];
  if (td >= 8) {
    const lejos = mn.dist[2] / td, pegada = mn.dist[0] / td;
    if (lejos >= TH_DIST && M.patas < 2) cands.push({ que: 'patas', fuerza: lejos - TH_DIST - (M.patas ? 0.15 : 0), n: mn.dist[2], texto: M.patas ? 'CRECEN LAS PATAS' : 'TE QUEDAS LEJOS' });
    else if (pegada >= TH_DIST) { const ya = tieneCadena(M, GARRA) >= 0; cands.push({ que: 'garra', fuerza: pegada - TH_DIST - (ya ? 0.15 : 0), n: mn.dist[0], texto: ya ? 'CRECE LA GARRA' : 'TE PEGAS A MI' }); }
  }
  // 4) Su combo: algun contexto donde el siguiente acto es casi seguro.
  let bp = 0, bctx = -1, bn = 0;
  for (let c = 0; c < 4; c++) {
    const n = mn.gram[c * 2] + mn.gram[c * 2 + 1];
    if (n < 5) continue;
    const p = Math.max(mn.gram[c * 2], mn.gram[c * 2 + 1]) / n;
    if (p > bp) { bp = p; bctx = c; bn = n; }
  }
  if (bctx >= 0 && bp >= TH_COMBO && M.parada === 0) cands.push({ que: 'parada', fuerza: (bp - TH_COMBO) * 1.5, n: bn, texto: 'REPITES ' + CTX[bctx] });

  // Orden: primero lo mas LEGIBLE y menos cruel. La placa se lee sola (CLANG
  // donde ella pega) y no hiere; el latigo y la garra castigan; la parada es
  // lo mas dificil de entender. Con solo "fuerza" a la jugadora con tres
  // manias le salian el latigo y la parada y la placa nunca: se moria sin ver
  // el mecanismo mas claro del juego.
  const PRIO = { placa: 0.3, patas: 0.1, garra: 0.1, latigo: 0, parada: -0.1 };
  cands.sort((a, b) => (b.fuerza + PRIO[b.que]) - (a.fuerza + PRIO[a.que]));
  const lineas = [];
  let aplicadas = 0;
  for (const c of cands) {
    if (aplicadas >= 2) break;
    let ok = false;
    if (c.que === 'placa') ok = crecerPlaca(M, c.sec);
    else if (c.que === 'latigo') {
      mn.esqBin = c.bin;
      const il = tieneCadena(M, LATIGO);
      if (il >= 0) { const g = M.org[il]; g.len = Math.min(13, g.len + 1.5); ok = true; }
      else ok = crecerCadena(M, LATIGO, sectorDominante(mn, M, K)) >= 0;
    } else if (c.que === 'garra') {
      const ig = tieneCadena(M, GARRA);
      if (ig >= 0) { const g = M.org[ig]; g.len = Math.min(11, g.len + 1); ok = true; }
      else ok = crecerCadena(M, GARRA, sectorDominante(mn, M, K)) >= 0;
    } else if (c.que === 'patas') { if (M.patas < 2) { M.patas++; ok = true; } }
    else if (c.que === 'parada') { M.parada = 1; ok = true; }
    if (ok) {
      aplicadas++;
      // El letrero solo dice el habito cuando hay muestras de sobra: un
      // "APRENDIO TU ESQUIVE" falso rompe el bucle que vende el juego.
      lineas.push(c.n >= 8 ? c.texto : 'CRECIO');
      if (c.n >= 8 && !mn.habitos.includes(c.texto)) mn.habitos.push(c.texto);
    }
  }
  // La ultima muda: la HOJA, que pega como ella. Es guion, y se dice.
  if (M.ronda + 1 === ULT_RONDA && tieneCadena(M, HOJA) < 0) {
    let bt = -1, bv = -1;
    for (let i = 0; i < 8; i++) if (mn.tri[i] > bv) { bv = mn.tri[i]; bt = i; }
    let g = 1, d = 0;
    if (bt >= 0 && bv >= 3) {
      g = (bt & 4 ? 0 : 1) + (bt & 2 ? 0 : 1) + (bt & 1 ? 0 : 1);
      d = g < 3 ? 1 : 0;
      if (g === 0) { g = 1; }
    }
    M.hojaG = g; M.hojaD = d; M.tempo = mn.tempo;
    crecerCadena(M, HOJA, sectorDominante(mn, M, K));
    lineas.unshift('PEGA COMO TU');
    if (!mn.habitos.includes('PEGA COMO TU')) mn.habitos.push('PEGA COMO TU');
    aplicadas++;
  }
  if (aplicadas === 0) {
    M.crec = Math.min(8, M.crec + 2);
    mn.generico++;
    lineas.push(tot + te >= 6 ? 'NO ME PILLO NADA' : 'CRECIO');
  }

  // OLVIDO: la placa que no recibio tajos en toda la ronda pierde un nivel;
  // la cadena que no rindio dos rondas seguidas se reabsorbe. Lo que rindio,
  // se queda y crece un poco: es la seleccion, medida en la partida real.
  for (let s = 0; s < NR; s++) {
    if (placa0[s] > 0 && M.placa[s] > 0 && M.hits[s] === 0 && !primera) { M.placa[s]--; mn.olvidos++; if (lineas.length < 2) lineas.push('OLVIDO UNA PLACA'); }
  }
  for (let o = 0; o < NORG; o++) {
    const g = M.org[o];
    if (g.tipo === 0) continue;
    // La que acaba de nacer en esta muda no se juzga: ni se reabsorbe por no
    // haber rendido (no ha peleado aun) ni cobra el 6% de premio.
    if (g.nacida === M.ronda) { g.util = 0; g.golpes = 0; continue; }
    if (g.util === 0) { g.sinUtil++; if (g.sinUtil >= 2 && g.tipo !== HOJA) { quitarCadena(M, o); mn.olvidos++; } }
    else { g.sinUtil = 0; g.len = Math.min(g.len * 1.06, g.tipo === LATIGO ? 13 : 11); }
    g.util = 0; g.golpes = 0;
  }

  // Decaimiento: lo de hace tres mudas pesa la mitad.
  for (let i = 0; i < NR; i++) mn.tajo[i] *= OLVIDO;
  for (let i = 0; i < 8; i++) { mn.esq[i] *= OLVIDO; mn.gram[i] *= OLVIDO; mn.tri[i] *= OLVIDO; }
  for (let i = 0; i < 3; i++) mn.dist[i] *= OLVIDO;
  mn.nTajo = 0; mn.nEsq = 0; mn.nActo = 0;
  // Sin repetidos: dos lecciones sin nombre daban "CRECIO / CRECIO".
  const unicas = [];
  for (const l of lineas) if (!unicas.includes(l)) unicas.push(l);
  mn.lecciones = unicas;
  return unicas;
}

// Sector por el que ella suele venir (donde mas tajos hubo), o el que mira a
// ella ahora si no hay datos. Ahi nacen las cadenas: la garra sale por donde
// se pega, el latigo por donde la tiene cerca.
function sectorDominante(mn, M, K) {
  let bc = -1, bw = 0;
  for (let c = 0; c < NR; c++) { const w = ventana3(mn.tajo, c); if (w > bw || (w === bw && bc >= 0 && mn.tajo[c] > mn.tajo[bc])) { bw = w; bc = c; } }
  return bc >= 0 ? bc : sectorDe(Math.atan2(K.y - M.y, K.x - M.x));
}

// Para la pantalla final: sus tres habitos mas fuertes, en palabras.
export function resumen(mn) { return mn.habitos.slice(0, 3); }
