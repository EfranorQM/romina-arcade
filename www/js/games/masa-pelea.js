// LA MASA - el director de la pelea. Sin DOM.
//
// Junta a la caballera, el cuerpo y la mente en UNA sola funcion de paso, y
// esa funcion es la que llama el juego (masa.js) con el pulgar y la que llama
// el arnes (tools/prueba-masa.mjs) con un piloto. Asi lo que se mide en Node
// es exactamente lo que se juega: rondas, mudas, puntaje y todo.
//
// EL ARCO: siete rondas. Cada vez que ella mata a la masa, la masa MUDA
// (2.6 s de ceremonia) y vuelve con mas vida y con lo que le aprendio. La
// septima muerte es la victoria. "Aguanta hasta que evolucione demasiado" no
// es una pelea; esto si tiene final.

import { makeCaballera, stepCaballera, HP0 as HP_CAB } from './masa-caballera.js';
import { makeMasa, step as stepMasa, renacer, armarParada, radioEn, EV, ULT_RONDA, RUMIA, ACECHA } from './masa-cuerpo.js';
import { makeMente, verTajo, verEsquiva, verActo, verTiempo, prediceTajo, faltaParaActo, muda } from './masa-mente.js';

export const T_MUDA = 2.6;                  // la ceremonia entera
export const T_CONVULSION = 0.8;            // lo primero, a camara lenta
export const LENTO = 0.3;                   // la camara lenta de la convulsion
export const REPLAY_N = 600;                // 10 s de sus posiciones, para la silueta
export const P_PARADA = 0.80;               // confianza minima para apostar una parada

// Eventos de pelea (encima de los del cuerpo): para letreros y sonidos.
export const PE = { MUDA: 1, RONDA: 2, PATRON_ROTO: 3, GANA: 4, PIERDE: 5, OLVIDO: 6, PARADA: 7 };

export function makePelea(rnd) {
  const P = {
    rnd,
    M: makeMasa(135, 150),
    K: makeCaballera(135, 300),
    mn: makeMente(),
    t: 0, rondaT: 0, estado: 'pelea', mudaT: 0,
    lineas: [],                            // el letrero de la ultima muda
    score: 0, gano: false, over: false,
    swingVisto: 0, dashVisto: 0,
    tajosDados: 0, tajosConectados: 0, clangs: 0, paradasArmadas: 0,
    rx: new Int16Array(REPLAY_N), ry: new Int16Array(REPLAY_N), rf: new Uint8Array(REPLAY_N), rn: 0,
    evN: 0, evT: new Uint8Array(8), evA: new Float32Array(8),
    porRonda: [],                          // segundos que duro cada ronda (para el arnes)
  };
  return P;
}

function evP(P, t, a) { if (P.evN < 8) { P.evT[P.evN] = t; P.evA[P.evN] = a || 0; P.evN++; } }

// Un paso de 1/60 (o lo que dure el frame). `inp` = { dx, dy, golpe, dash }.
export function stepPelea(P, inp, dt) {
  const { M, K, mn } = P;
  P.evN = 0;
  if (P.estado === 'fin') { M.evN = 0; return; }

  // Camara lenta durante la convulsion de la muda: todo, ella tambien.
  let dts = dt;
  if (P.estado === 'muda' && P.mudaT < T_CONVULSION) dts = dt * LENTO;
  P.t += dts;

  // --- Ella ---
  stepCaballera(K, inp, dts);
  // Lo que ella hace mientras la masa muda NO cuenta: la masa esta muerta, y
  // los tajos al aire le inventaban habitos. El reloj de la mente si tiene que
  // seguir corriendo (verTiempo), porque si se congela 2,6 s la parada de la
  // ronda siguiente sale con el tempo corrido.
  const enPelea = P.estado === 'pelea';
  if (K.swingId !== P.swingVisto) { P.swingVisto = K.swingId; if (enPelea) { P.tajosDados++; verActo(mn, 0, K, M); } }
  if (K.dashId !== P.dashVisto) { P.dashVisto = K.dashId; if (enPelea) verEsquiva(mn, K, M, K.dvx, K.dvy); }
  verTiempo(mn, K, M, dts);
  // Sus ultimas posiciones, para la silueta de la ceremonia
  const ri = P.rn % REPLAY_N;
  P.rx[ri] = K.x; P.ry[ri] = K.y; P.rf[ri] = K.face; P.rn++;

  if (P.estado === 'muda') {
    P.mudaT += dt;
    stepMasa(M, K, dts, P.rnd, mn);
    if (P.mudaT >= T_MUDA) {
      renacer(M);
      P.estado = 'pelea'; P.rondaT = 0;
      if (K.hp < HP_CAB) K.hp++;           // la muda le devuelve un corazon: respiro
      evP(P, PE.RONDA, M.ronda);
    }
    return;
  }

  // --- La PARADA: apostar cuando su combo dice que viene un tajo ---
  // Se arma ANTES del paso del cuerpo (asi el tajo de este mismo frame ya la
  // encuentra petrificada), pero su aviso se emite DESPUES como evento de
  // pelea: stepMasa limpia M.evN al empezar, y el EV.PARADA nunca llegaba.
  let paradaArmada = false;
  if (M.parada > 0 && M.paradaCd <= 0 && M.frozen < 0 && (M.st === RUMIA || M.st === ACECHA)) {
    const p = prediceTajo(mn);
    if (p >= P_PARADA) {
      const falta = faltaParaActo(mn);
      const d = Math.hypot(K.x - M.x, K.y - M.y);
      if (falta > -0.05 && falta < 0.12 && d < radioEn(M, Math.atan2(K.y - M.y, K.x - M.x)) + 36) {
        if (armarParada(M, K)) { P.paradasArmadas++; mn.paradas++; paradaArmada = true; }
      }
    }
  }

  // --- La masa ---
  P.rondaT += dts;
  stepMasa(M, K, dts, P.rnd, mn);
  if (paradaArmada) evP(P, PE.PARADA, 0);

  // --- Lo que paso, contado ---
  for (let i = 0; i < M.evN; i++) {
    const t = M.evT[i], a = M.evA[i];
    if (t === EV.TAJO) { verTajo(mn, a | 0); P.tajosConectados++; P.score += 5 * M.ultDmg; }
    else if (t === EV.CLANG) { verTajo(mn, a | 0); P.clangs++; }
    else if (t === EV.PARADA_OK) { verTajo(mn, a | 0); mn.paradasOk++; }
    else if (t === EV.TAJO_ORG) { P.score += 3; }
    else if (t === EV.CORTE) { P.score += 40; }
    else if (t === EV.EXPUESTA) { evP(P, PE.PATRON_ROTO, a); }
    else if (t === EV.MUERE) {
      P.score += 100 * M.ronda + Math.max(0, Math.round((45 - P.rondaT) * 4));
      P.porRonda.push(P.rondaT);
      if (M.ronda >= ULT_RONDA) {
        P.estado = 'fin'; P.over = true; P.gano = true;
        P.score += 1000 + K.hp * 300;
        evP(P, PE.GANA, M.ronda);
      } else {
        P.estado = 'muda'; P.mudaT = 0;
        P.lineas = muda(mn, M, K, P.rnd);
        evP(P, PE.MUDA, M.ronda);
      }
    }
  }

  if (K.dead) {
    P.estado = 'fin'; P.over = true; P.gano = false;
    evP(P, PE.PIERDE, M.ronda);
  }
}

// Cuantos frames de replay hay (tope REPLAY_N) y como leerlos, para el dibujo.
export function replayLargo(P) { return Math.min(P.rn, REPLAY_N); }
export function replayIdx(P, k) { return (P.rn - replayLargo(P) + k) % REPLAY_N; }
