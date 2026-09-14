// AHORCADO - la fisica del muneco colgado de un ramo de globos.
//
// NO IMPORTA NADA: ni del DOM ni de core.js (core.js toca document y
// localStorage al cargar). Asi tools/prueba-ahorcado.mjs lo importa por file://
// y corre las mismas pruebas que decidieron cada constante de aqui. Si se toca
// un numero, se vuelve a correr; los umbrales estan en ese archivo.
//
// EL MODELO. 17 puntos Verlet (posicion y posicion anterior; la velocidad es la
// diferencia): el NUDO donde el puño agarra las cuerdas, diez puntos de cuerpo y
// seis globos. Las restricciones de distancia se resuelven por Gauss-Seidel, 8
// iteraciones por paso, con reparto por inverso de masa. Es el mismo esquema que
// los tentaculos de SYMBIOTE (sym-flow.js), solo que aqui hay una figura.
//
// EL NUDO NO ES UN PUNTO LIBRE durante la ronda. Probado primero como punto
// Verlet con los globos empujando hacia arriba: se hundia, porque el empuje de
// seis globos ligeros nunca cuadra exacto con el peso de diez puntos de cuerpo,
// y cualquier desajuste se acumula. Ahora es un muelle amortiguado 2D integrado
// aparte hacia un objetivo (270, 236 + 40 por globo reventado), y su posicion
// se copia al punto 0 en cada iteracion. Lo que lo hace CEDER como un ramo y no
// como un clavo son dos realimentaciones horizontales: el centro de masa del
// cuerpo tira del nudo (0.6 s^-2) y la media de los globos vivos tambien
// (2.0 s^-2). Con eso el balanceo de reposo con viento es de 54 px en los pies
// (medido; con el viento suave del primer diseno eran 24, una lampara).
//
// LO QUE HACE CADA FALLO: se revienta el globo vivo mas alejado del nudo (el
// ramo queda equilibrado), el objetivo del nudo baja 40 px, el nudo recibe un
// tiron hacia abajo (perdio empuje) y el cuerpo un respingo hacia arriba (el
// susto). Medido: baja 40.0, se pasa 7.3 y se asienta en 1.3 s. Con un solo
// globo los pies llegan a y=640, justo el agua: rozan en cada vaiven.

export const DT = 1 / 60;
export const ITERS = 8;
export const GRAV = 1400;          // px/s^2 sobre el cuerpo (la escala de FURIA y SYMBIOTE)
export const LIFT = 700;           // px/s^2 hacia arriba sobre cada globo vivo
export const AIR = 0.998;          // amortiguacion por paso en el aire: decae al 89% por segundo
export const WATER_DAMP = 0.88;    // bajo el agua
export const WATER = 640;          // superficie del estanque
export const FLOOR = 692;          // fondo: ningun punto baja de aqui
export const CEIL = 125;           // centro de globo, y minimo (borde 96; la pausa acaba en 74)
export const BODY_CEIL = 116;      // ningun punto de cuerpo sube de aqui (cabeza r34 -> borde 82)
export const HEAD_R = 34;
export const BALLOON_RX = 24, BALLOON_RY = 29;
export const KNOT_HOME_Y = 236, SINK = 40;
export const KNOT_HOME_X = 270;
// Empuje bajo el agua, PROPORCIONAL a la profundidad hasta 24 px: un empuje
// fijo que se enciende al cruzar la superficie hacia tiritar a los puntos en la
// linea del agua y el muneco no se quedaba quieto nunca. Continuo, el cuerpo
// queda 14.6 px bajo la superficie y la cabeza casi a flor de agua (5.6): con
// la cabeza a 11.6 (empuje 2900) la cara quedaba bajo el velo del agua y la
// expresion de empapado, que es el remate de la derrota, no se leia.
const BUOY = 2300, BUOY_HEAD = 6000, BUOY_D = 24;
const KV = 15.4, ZV = 0.6;         // muelle vertical del nudo: periodo 1.6 s, sin apenas rebote
const KH = 2.5, ZH = 0.5;          // horizontal: blando, es lo que deja columpiarse
const FB_BODY = 0.6, FB_BAL = 2.0; // realimentaciones (s^-2); con 4.0 el ramo barre 240 px de ancho
// Viento, solo sobre los globos. Dos senos con periodos que no se dividen: el
// balanceo nunca se repite igual. 140/90 dan 54 px de vaiven; 40/25 daban 24.
const WIND_A = 140, WIND_B = 90;
const POP_IMP = 160, STARTLE = 120;
const XMIN = 90, XMAX = 450;
// Tope FIJO del nudo hacia arriba, no relativo al objetivo: con un tope de
// +-60 alrededor del objetivo, atar tres globos (objetivo -120 de golpe)
// teletransportaba el nudo 60 px en un frame y daba 30% de error de
// restriccion. Con tope fijo sube de 356 a 236 en 1.5 s con 3.2%.
const KNOT_YMIN = KNOT_HOME_Y - 60, KNOT_YMAX = WATER - 20;
export const CORDS = [78, 84, 90, 96, 102, 88];   // largos distintos para que apilen en ramo
const SEP = 52;                                    // separacion minima entre globos
// El dedo: muelle sobre el punto agarrado, y el pivote recibe el 5% de esa
// fuerza (el ramo entero se va un poco detras del dedo).
const GRAB_K = 400, GRAB_Z = 0.9, GRAB_PIVOT = 0.05;
export const GRAB_XMIN = 60, GRAB_XMAX = 480, GRAB_YMIN = 150, GRAB_YMAX = 620;
// Rampa de las restricciones de postura: activarlas en seco daba 139% de
// error en un frame; con 120 px/s, 7.3% transitorio y 3.2% despues.
const POSE_RAMP = 120;

// Indices fijos. NUDO es el puño derecho sobre las cuerdas.
export const NUDO = 0, HR = 1, HL = 2, CR = 3, CL = 4, CAB = 5, MANO = 6,
             RR = 7, PR = 8, RL = 9, PL = 10, B0 = 11;
export const N = 17;
// Pose de reposo respecto al nudo. La cabeza va a la IZQUIERDA del brazo
// alzado, que pasa por x=+2..+6 a su altura: se dibuja el brazo antes que la
// cabeza y queda detras de la oreja.
export const POSE = [[0, 0], [6, 50], [-22, 52], [4, 114], [-20, 114], [-30, 22],
                     [-26, 108], [6, 156], [8, 198], [-22, 156], [-24, 198]];

export function makeMono(kx = KNOT_HOME_X, ky = KNOT_HOME_Y, seed = 0) {
  const S = {
    x: new Float32Array(N), y: new Float32Array(N), ox: new Float32Array(N), oy: new Float32Array(N),
    w: new Float32Array(N), alive: new Uint8Array(6),
    // Impulsos pendientes (px/s), que se aplican al integrar el paso
    // siguiente. NO se tocan ox/oy directamente: el dibujo interpola ox->x con
    // el alpha del bucle, y mover ox a mano hacia atras pintaba el punto un
    // frame en sentido CONTRARIO al impulso antes de dispararlo.
    ivx: new Float32Array(N), ivy: new Float32Array(N),
    cons: [],                         // [a, b, largo, rigidez]
    knot: { x: kx, y: ky, vx: 0, vy: 0, tx: kx, ty: ky, on: true },
    popped: 0, falling: false,
    grab: -1, gx: 0, gy: 0,
    t: 0, windPhase: (seed % 1000) / 1000 * 6.28,
    // Posturas: cada una guarda su largo actual, que va por rampa al objetivo.
    twoHands: false, handL: 0,        // manoL-nudo 60: se agarra con las dos manos
    knees: false, kneeL: 0,           // cadera-pie <= 64: encoge las rodillas
    eyes: false, eyesL: 0,            // manoL-cabeza 20: se tapa los ojos
    maxErr: 0,
    // Contacto de los pies con el agua en el ultimo paso (para el chapoteo).
    splashV: 0,
  };
  for (let i = 0; i < 11; i++) { S.x[i] = kx + POSE[i][0]; S.y[i] = ky + POSE[i][1]; S.w[i] = 1; }
  S.w[NUDO] = 0; S.w[CAB] = 0.8;
  for (let b = 0; b < 6; b++) {
    const i = B0 + b;
    S.alive[b] = 1;
    S.x[i] = kx + (b - 2.5) * 22; S.y[i] = ky - CORDS[b] + 10; S.w[i] = 2.5;
  }
  for (let i = 0; i < N; i++) { S.ox[i] = S.x[i]; S.oy[i] = S.y[i]; }
  // Los largos salen de la pose, nunca a mano: asi no puede haber una
  // restriccion inconsistente con otra.
  const L = (a, b) => Math.hypot(S.x[a] - S.x[b], S.y[a] - S.y[b]);
  const con = (a, b, k = 1) => S.cons.push([a, b, L(a, b), k]);
  // Torso rigido (6): los dos lados y las dos diagonales.
  con(HR, HL); con(CR, CL); con(HR, CR); con(HL, CL); con(HR, CL); con(HL, CR);
  // Cuello triangulado (2): puede cabecear con el torso, no rodar.
  con(CAB, HL); con(CAB, HR);
  // Brazo derecho sin codo (manguera estirada), brazo izquierdo que cuelga.
  con(NUDO, HR); con(HL, MANO);
  // Piernas (4).
  con(CR, RR); con(RR, PR); con(CL, RL); con(RL, PL);
  return S;
}

export function alive(S) { let n = 0; for (let b = 0; b < 6; b++) n += S.alive[b]; return n; }

function solve(S, a, b, len, k, minOnly, maxOnly) {
  let dx = S.x[b] - S.x[a], dy = S.y[b] - S.y[a];
  let d = Math.hypot(dx, dy); if (d < 1e-6) d = 1e-6;
  if (minOnly && d >= len) return 0;
  if (maxOnly && d <= len) return 0;
  const ws = S.w[a] + S.w[b]; if (ws === 0) return 0;
  const diff = (d - len) / d * k;
  S.x[a] += dx * diff * (S.w[a] / ws); S.y[a] += dy * diff * (S.w[a] / ws);
  S.x[b] -= dx * diff * (S.w[b] / ws); S.y[b] -= dy * diff * (S.w[b] / ws);
  return Math.abs(d - len) / len;
}

// Un paso de 1/60. `wind` se apaga en las pruebas de pendulo puro.
export function step(S, wind = true) {
  S.t += DT;
  const t = S.t + S.windPhase;
  const windAx = wind ? WIND_A * Math.sin(0.6 * t) + WIND_B * Math.sin(1.7 * t + 1) : 0;
  const K = S.knot;
  if (K.on) {
    // La posicion anterior del nudo se guarda aunque no lo integre el Verlet:
    // el dibujado interpola ox->x con el alpha del bucle, y un nudo sin
    // 'anterior' se dibujaria a saltos a 90 Hz. SOLO mientras manda el muelle:
    // en la caida el nudo es un punto Verlet mas, y borrarle el 'anterior'
    // cada paso le borraba la velocidad -- caia a camara lenta.
    S.ox[NUDO] = S.x[NUDO]; S.oy[NUDO] = S.y[NUDO];
    let cx = 0, bx = 0, nbal = 0;
    for (let i = 1; i <= 10; i++) cx += S.x[i];
    cx /= 10;
    for (let b = 0; b < 6; b++) if (S.alive[b]) { bx += S.x[B0 + b]; nbal++; }
    bx = nbal ? bx / nbal : K.x;
    const ax = KH * (K.tx - K.x) - 2 * ZH * Math.sqrt(KH) * K.vx + FB_BODY * (cx - K.x) + FB_BAL * (bx - K.x);
    const ay = KV * (K.ty - K.y) - 2 * ZV * Math.sqrt(KV) * K.vy;
    K.vx += ax * DT; K.vy += ay * DT;
    K.x += K.vx * DT; K.y += K.vy * DT;
    if (K.x < XMIN) { K.x = XMIN; K.vx = 0; } if (K.x > XMAX) { K.x = XMAX; K.vx = 0; }
    if (K.y < KNOT_YMIN) { K.y = KNOT_YMIN; K.vy = 0; } if (K.y > KNOT_YMAX) { K.y = KNOT_YMAX; K.vy = 0; }
    S.x[NUDO] = K.x; S.y[NUDO] = K.y;
  }
  // ---- Integracion ----
  S.splashV = 0;
  for (let i = 0; i < N; i++) {
    if (S.w[i] === 0) continue;
    if (i >= B0 && !S.alive[i - B0]) continue;
    const inWater = S.y[i] > WATER;
    const damp = inWater ? WATER_DAMP : AIR;
    let ax = 0, ay;
    if (i >= B0) { ay = -LIFT; ax = windAx; }
    else ay = GRAV - (inWater ? (i === CAB ? BUOY_HEAD : BUOY) * Math.min(1, (S.y[i] - WATER) / BUOY_D) : 0);
    if (S.grab === i) {
      const vx = (S.x[i] - S.ox[i]) / DT, vy = (S.y[i] - S.oy[i]) / DT;
      const fx = GRAB_K * (S.gx - S.x[i]) - 2 * GRAB_Z * 20 * vx;
      const fy = GRAB_K * (S.gy - S.y[i]) - 2 * GRAB_Z * 20 * vy;
      ax += fx; ay += fy;
      if (K.on) { K.vx += fx * GRAB_PIVOT * DT; K.vy += fy * GRAB_PIVOT * DT; }
    }
    const vx = (S.x[i] - S.ox[i]) * damp + S.ivx[i] * DT, vy = (S.y[i] - S.oy[i]) * damp + S.ivy[i] * DT;
    S.ivx[i] = 0; S.ivy[i] = 0;
    // No hay regla de "reposo en el agua": se probo congelar los puntos lentos
    // bajo la superficie y se quedaban clavados en el punto de retorno de la
    // caida, a 30 px de fondo, y el muneco no flotaba nunca. Con el empuje
    // proporcional a la profundidad el equilibrio es continuo y no tirita.
    const nx = S.x[i] + vx + ax * DT * DT;
    const ny = S.y[i] + vy + ay * DT * DT;
    // Un pie que entra al agua rapido salpica: se apunta la velocidad mayor.
    if ((i === PR || i === PL) && !inWater && ny > WATER) S.splashV = Math.max(S.splashV, vy / DT);
    S.ox[i] = S.x[i]; S.oy[i] = S.y[i]; S.x[i] = nx; S.y[i] = ny;
  }
  // ---- Restricciones ----
  const ramp = POSE_RAMP * DT / ITERS;
  for (let it = 0; it < ITERS; it++) {
    for (const c of S.cons) solve(S, c[0], c[1], c[2], c[3], false, false);
    if (S.twoHands) { S.handL = Math.max(60, S.handL - ramp); solve(S, MANO, NUDO, S.handL, 1, false, false); }
    if (S.knees) { S.kneeL = Math.max(64, S.kneeL - ramp); solve(S, CR, PR, S.kneeL, 1, false, true); solve(S, CL, PL, S.kneeL, 1, false, true); }
    if (S.eyes) { S.eyesL = Math.max(20, S.eyesL - ramp); solve(S, MANO, CAB, S.eyesL, 1, false, false); }
    for (let b = 0; b < 6; b++) {
      if (!S.alive[b]) continue;
      solve(S, NUDO, B0 + b, CORDS[b], 1, false, false);
      for (let c = b + 1; c < 6; c++) if (S.alive[c]) solve(S, B0 + b, B0 + c, SEP, 0.5, true, false);
      if (S.y[B0 + b] < CEIL) S.y[B0 + b] = CEIL;
    }
    if (K.on) { S.x[NUDO] = K.x; S.y[NUDO] = K.y; }
    for (let i = 0; i < N; i++) {
      if (S.y[i] > FLOOR) S.y[i] = FLOOR;
      if (i < B0 && i !== NUDO && S.y[i] < BODY_CEIL) S.y[i] = BODY_CEIL;
    }
  }
  // Guarda: un punto que se fue de la pantalla (no deberia, pero un NaN o un
  // tiron absurdo lo mandarian) vuelve a su sitio de la pose, sin velocidad.
  for (let i = 1; i < B0; i++) {
    if (!(S.x[i] > -200 && S.x[i] < 740 && S.y[i] > -200 && S.y[i] < 1400)) {
      S.x[i] = S.x[NUDO] + POSE[i][0]; S.y[i] = S.y[NUDO] + POSE[i][1];
      S.ox[i] = S.x[i]; S.oy[i] = S.y[i];
    }
  }
  // Error maximo de restriccion, para las pruebas.
  let err = 0;
  for (const c of S.cons) { const d = Math.hypot(S.x[c[0]] - S.x[c[1]], S.y[c[0]] - S.y[c[1]]); err = Math.max(err, Math.abs(d - c[2]) / c[2]); }
  for (let b = 0; b < 6; b++) if (S.alive[b]) { const d = Math.hypot(S.x[NUDO] - S.x[B0 + b], S.y[NUDO] - S.y[B0 + b]); err = Math.max(err, Math.abs(d - CORDS[b]) / CORDS[b]); }
  S.maxErr = Math.max(S.maxErr, err);
  return err;
}

// Revienta un globo. Devuelve su indice (0..5) o -1 si no quedaba ninguno.
export function pop(S) {
  let best = -1, bd = -1;
  for (let b = 0; b < 6; b++) if (S.alive[b]) { const d = Math.abs(S.x[B0 + b] - S.x[NUDO]); if (d > bd) { bd = d; best = b; } }
  if (best < 0) return -1;
  S.alive[best] = 0; S.popped++;
  const K = S.knot;
  K.ty = KNOT_HOME_Y + SINK * S.popped;
  K.vy += POP_IMP;
  for (let i = 1; i <= 10; i++) S.ivy[i] -= STARTLE;   // respingo: el cuerpo sube un instante
  if (S.popped === 6) fall(S);
  return best;
}

// El sexto: el muelle se apaga y el nudo pasa a ser un punto mas, SIN
// velocidad heredada (medido: 0.0 px/s). Cae con el puño todavia arriba.
export function fall(S) {
  S.falling = true; S.twoHands = false; S.knees = false; S.eyes = false;
  S.knot.on = false;
  S.w[NUDO] = 1; S.ox[NUDO] = S.x[NUDO]; S.oy[NUDO] = S.y[NUDO];
}

// Ata el globo b en la posicion (x,y) donde llego subiendo. Si no se da, se
// coloca ya tenso bajo el nudo (lo usan las pruebas).
export function tie(S, b, x, y) {
  // Un globo no se ata a un muneco que ya cae: lo sacaria del agua.
  if (S.alive[b] || S.falling) return;
  S.alive[b] = 1; S.popped = Math.max(0, S.popped - 1);
  S.knot.ty = KNOT_HOME_Y + SINK * S.popped;
  const i = B0 + b;
  if (x === undefined) {
    const dx = (b - 2.5) * 12;
    x = S.x[NUDO] + dx; y = S.y[NUDO] - Math.sqrt(CORDS[b] * CORDS[b] - dx * dx);
  }
  S.x[i] = x; S.y[i] = y; S.ox[i] = x; S.oy[i] = y;
}

// Posturas del cuerpo segun lo mal que lo esta pasando. Cada una entra por
// rampa desde su distancia actual (ver POSE_RAMP) y sale de golpe, que al
// soltar una restriccion no hay tiron.
export function setPostura(S, o) {
  if (o.twoHands !== undefined && o.twoHands !== S.twoHands) {
    S.twoHands = o.twoHands;
    if (S.twoHands) S.handL = Math.hypot(S.x[MANO] - S.x[NUDO], S.y[MANO] - S.y[NUDO]);
  }
  if (o.knees !== undefined && o.knees !== S.knees) {
    S.knees = o.knees;
    if (S.knees) S.kneeL = Math.max(Math.hypot(S.x[CR] - S.x[PR], S.y[CR] - S.y[PR]), Math.hypot(S.x[CL] - S.x[PL], S.y[CL] - S.y[PL]));
  }
  if (o.eyes !== undefined && o.eyes !== S.eyes) {
    S.eyes = o.eyes;
    if (S.eyes) S.eyesL = Math.hypot(S.x[MANO] - S.x[CAB], S.y[MANO] - S.y[CAB]);
  }
}

// Impulso instantaneo a un punto, en px/s.
export function impulse(S, i, vx, vy) {
  if (S.w[i] === 0) return;
  S.ivx[i] += vx; S.ivy[i] += vy;
}

// El punto mas cercano a (x,y) que se puede agarrar, o -1. La cabeza se
// resuelve contra su circulo (r 40), el resto del cuerpo a 46 px y los globos a
// 34: son los tamanos a los que se ven, con margen para el pulgar.
export function nearest(S, x, y) {
  let best = -1, bd = 1e9;
  for (let i = 1; i < N; i++) {
    if (i >= B0 && !S.alive[i - B0]) continue;
    const d = Math.hypot(S.x[i] - x, S.y[i] - y);
    const r = i === CAB ? 40 : i >= B0 ? 34 : 46;
    if (d <= r && d < bd) { bd = d; best = i; }
  }
  // La cabeza gana si el dedo cayo dentro de ella aunque un hombro este mas
  // cerca del centro: es lo que ella ve grande.
  if (Math.hypot(S.x[CAB] - x, S.y[CAB] - y) <= 40) return CAB;
  return best;
}

export function grab(S, i, x, y) { S.grab = i; moveGrab(S, x, y); }
export function moveGrab(S, x, y) {
  S.gx = x < GRAB_XMIN ? GRAB_XMIN : x > GRAB_XMAX ? GRAB_XMAX : x;
  S.gy = y < GRAB_YMIN ? GRAB_YMIN : y > GRAB_YMAX ? GRAB_YMAX : y;
}
export function release(S) { S.grab = -1; }

// Centro de los pies y de las caderas, para la sombra y la rana.
export function feet(S) { return [(S.x[PR] + S.x[PL]) / 2, (S.y[PR] + S.y[PL]) / 2]; }
export function lowestFoot(S) { return Math.max(S.y[PR], S.y[PL]); }
