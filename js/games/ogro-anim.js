// EL OGRO - sus fotogramas. Cada uno es una POSE, igual que los de ella.
//
// Son MENOS que los de ella (26 contra 51) y a proposito: el ogro es lento y
// pesado, y su lenguaje son poses que AGUANTAN. Un jefe que se mueve mucho
// se lee peor, no mejor -- lo que hace falta es que cada fase de cada ataque
// tenga una silueta inconfundible y se quede ahi el tiempo suficiente para
// leerla.

import { pose, horneaPose } from './ogro-pose.js';
import { EJE, PIES } from './ogro-art.js';

export const POSES = {
  // ESPERA: respira. El garrote descansa, la maza apoyada junto al pie.
  espera: [
    pose({}),
    pose({ torY: -50, cabY: -45, garAng: 0.47, jorobaY: -6 }),
    pose({ torY: -48, cabY: -44, garAng: 0.49, jorobaY: -5, manD: [82, 28] }),
    pose({ torY: -50, cabY: -45, garAng: 0.47, jorobaY: -6 }),
  ],

  // ANDA: pasos pesados. La cadera sube y baja MUCHO (6 px) porque un bicho
  // de 232 px que camina suave no pesa.
  anda: [
    pose({ cadY: PIES - 74, piernaSep: 34, incl: 0.10, garAng: 0.5 }),
    pose({ cadY: PIES - 80, piernaSep: 22, incl: 0.13, garAng: 0.42, jorobaY: -12 }),
    pose({ cadY: PIES - 74, piernaSep: 34, incl: 0.10, garAng: 0.5 }),
    pose({ cadY: PIES - 80, piernaSep: 22, incl: 0.13, garAng: 0.55, jorobaY: -12 }),
  ],

  // GARROTE: carga arriba-atras, barre, y se queda pasado de largo.
  // La CARGA es el fotograma que importa: es lo que ella tiene que leer para
  // decidir si para el golpe. Por eso se encoge y se echa atras -- cuanto
  // mas distinta sea del resto, mejor se lee.
  garrote: [
    pose({ garAng: -1.45, codD: [40, -20], manD: [56, -44], incl: -0.22,
           cabY: -50, ojos: 'furia', jorobaY: -16 }),
    pose({ garAng: -1.15, codD: [46, -26], manD: [66, -52], incl: -0.28,
           cabY: -52, ojos: 'furia', bocaAb: 0.3, jorobaY: -18 }),
    pose({ garAng: 0.55, codD: [60, 16], manD: [92, 34], incl: 0.32,
           cabY: -40, ojos: 'furia', bocaAb: 0.8,
           estela: [-1.15, 0.55], jorobaY: -2 }),
    pose({ garAng: 0.95, codD: [56, 24], manD: [86, 46], incl: 0.26,
           cabY: -42, ojos: 'furia', bocaAb: 0.3 }),
    pose({ garAng: 0.7, codD: [54, 16], manD: [84, 32], incl: 0.12, cabY: -44 }),
  ],

  // PISOTON: se alza TODO lo que puede y se deja caer. El contraste entre el
  // fotograma 1 (estirado, alto) y el 3 (aplastado, bajo) es lo que hace que
  // el golpe se sienta -- 30 px de cadera entre uno y otro.
  pisoton: [
    pose({ cadY: PIES - 86, garAng: -1.5, codD: [40, -26], manD: [58, -54],
           incl: -0.18, cabY: -54, ojos: 'furia', flexion: 0, jorobaY: -20 }),
    pose({ cadY: PIES - 96, garAng: -1.6, codD: [36, -34], manD: [50, -66],
           incl: -0.10, cabY: -58, ojos: 'furia', bocaAb: 0.6, jorobaY: -24 }),
    pose({ cadY: PIES - 56, garAng: 1.1, codD: [50, 30], manD: [74, 60],
           incl: 0.30, cabY: -34, ojos: 'furia', bocaAb: 1, flexion: 1,
           piernaSep: 40, jorobaY: 2 }),
    pose({ cadY: PIES - 62, garAng: 1.0, codD: [50, 26], manD: [74, 54],
           incl: 0.24, cabY: -38, ojos: 'furia', bocaAb: 0.5, flexion: 0.8,
           piernaSep: 38 }),
    pose({ cadY: PIES - 70, garAng: 0.8, incl: 0.14, cabY: -42, flexion: 0.3 }),
  ],

  // BARRIDO: el garrote pasa BAJO, a ras. Por eso se agacha: la postura dice
  // "esto va por abajo" antes de que salga, que es lo que la deja rodarlo.
  barrido: [
    pose({ garAng: -0.35, codD: [20, -8], manD: [10, -14], incl: 0.26,
           cadY: PIES - 64, flexion: 0.7, cabY: -38, ojos: 'furia' }),
    pose({ garAng: -0.15, codD: [10, -4], manD: [-14, -8], incl: 0.34,
           cadY: PIES - 60, flexion: 0.9, cabY: -36, ojos: 'furia', bocaAb: 0.4 }),
    pose({ garAng: 0.22, codD: [56, 22], manD: [96, 40], incl: 0.30,
           cadY: PIES - 62, flexion: 0.8, cabY: -36, ojos: 'furia', bocaAb: 0.7,
           estela: [-0.15, 0.22] }),
    pose({ garAng: 0.4, codD: [52, 24], manD: [90, 44], incl: 0.20,
           cadY: PIES - 68, flexion: 0.4, cabY: -40 }),
  ],

  // EMBESTIDA: se agacha, mete el hombro y CORRE. El garrote va atras, casi
  // fuera de juego: en la embestida el arma no es lo que pega, es el cuerpo.
  embestida: [
    pose({ incl: -0.30, cadY: PIES - 66, flexion: 0.8, garAng: -0.5,
           codD: [24, 6], manD: [18, 20], cabY: -40, ojos: 'furia', jorobaY: -14 }),
    pose({ incl: 0.42, cadY: PIES - 70, flexion: 0.4, garAng: 1.9,
           codD: [20, 30], manD: [4, 58], cabY: -32, ojos: 'furia',
           bocaAb: 0.9, hombAncho: 66, jorobaY: 4 }),
    pose({ incl: 0.48, cadY: PIES - 72, flexion: 0.2, garAng: 2.1,
           codD: [16, 32], manD: [-4, 62], cabY: -30, ojos: 'furia',
           bocaAb: 1, hombAncho: 68, jorobaY: 6, piernaSep: 24 }),
  ],

  // ABIERTO: la ventana de castigo. Tiene que LEERSE que esta abierto o ella
  // no sabra cuando pegar. Se dobla hacia delante, baja la guardia y el
  // garrote cuelga muerto: lo contrario de todas las poses de ataque.
  abierto: [
    pose({ incl: 0.40, cadY: PIES - 62, flexion: 0.9, garAng: 1.5,
           codD: [30, 40], manD: [30, 78], codI: [-30, 44], manI: [-26, 88],
           cabY: -24, ojos: 'dolor', bocaAb: 0.5, jorobaY: 6, hombAncho: 56 }),
    pose({ incl: 0.44, cadY: PIES - 58, flexion: 1, garAng: 1.6,
           codD: [28, 42], manD: [26, 82], codI: [-28, 46], manI: [-22, 92],
           cabY: -22, ojos: 'dolor', bocaAb: 0.7, jorobaY: 8, hombAncho: 54 }),
  ],

  // DOLOR: encaja el golpe y se echa atras.
  dolor: [
    pose({ incl: -0.34, cabY: -50, ojos: 'dolor', bocaAb: 0.8, garAng: 1.7,
           codD: [34, 34], manD: [40, 66], jorobaY: -14 }),
    pose({ incl: -0.20, cabY: -48, ojos: 'dolor', bocaAb: 0.4, garAng: 1.4,
           codD: [42, 28], manD: [56, 54] }),
  ],

  // RUGE: el cambio de fase. Los dos brazos arriba, la boca abierta del todo
  // y la cabeza echada atras. Es la pose mas ancha de todas a proposito: si
  // el cambio de fase no se VE, no existe.
  ruge: [
    pose({ incl: -0.26, cabY: -56, ojos: 'furia', bocaAb: 1,
           garAng: -1.5, codD: [48, -24], manD: [66, -52],
           codI: [-48, -20], manI: [-70, -46], hombAncho: 68, jorobaY: -20 }),
    pose({ incl: -0.34, cabY: -60, ojos: 'furia', bocaAb: 1,
           garAng: -1.7, codD: [54, -32], manD: [76, -64],
           codI: [-54, -28], manI: [-80, -58], hombAncho: 72, jorobaY: -24,
           sangra: 0.5 }),
  ],

  // MUERTO: se derrumba. El ultimo fotograma se queda.
  muerto: [
    pose({ incl: 0.30, cadY: PIES - 50, flexion: 1, cabY: -20, ojos: 'cerrados',
           garAng: 1.9, codD: [26, 44], manD: [22, 84], sangra: 1, hombAncho: 56 }),
    pose({ incl: 0.55, cadY: PIES - 32, flexion: 1, cabY: -8, ojos: 'cerrados',
           garAng: 2.2, codD: [18, 50], manD: [8, 92], sangra: 1, hombAncho: 50,
           piernaSep: 42 }),
    pose({ incl: 0.72, cadY: PIES - 18, flexion: 1, cabY: 4, ojos: 'cerrados',
           garAng: 2.5, codD: [10, 52], manD: [-6, 96], sangra: 1, hombAncho: 44,
           piernaSep: 50, jorobaY: 14 }),
  ],
};

// Hornea todas las poses. Devuelve { der: {...}, izq: {...} }.
export function bakeOgro() {
  const der = {}, izq = {};
  for (const k in POSES) {
    der[k] = POSES[k].map(horneaPose);
    izq[k] = der[k].map(espejo);
  }
  return { der, izq };
}

function espejo(cv) {
  const o = document.createElement('canvas');
  o.width = cv.width; o.height = cv.height;
  const c = o.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(cv.width, 0); c.scale(-1, 1);
  c.drawImage(cv, 0, 0);
  return o;
}

// Que pose toca, segun el estado del ogro. Igual que pose() en caba-cuerpo.js:
// el estado manda, no un reloj aparte.
export function poseOgro(O, ATAQUES) {
  if (O.st === 6) {   // MUERTO
    const i = Math.min(2, Math.floor(O.t / 0.18));
    return ['muerto', i];
  }
  if (O.st === 5) return ['ruge', ((O.t * 7) | 0) & 1];         // RUGE
  if (O.st === 4) return ['dolor', O.t < 0.12 ? 0 : 1];          // DOLOR
  if (O.st === 3) return ['abierto', ((O.t * 5) | 0) & 1];       // ABIERTO
  if (O.st === 2 && O.atk >= 0) {                                // ATACA
    const a = ATAQUES[O.atk];
    const nom = ['garrote', 'pisoton', 'barrido', 'embestida'][O.atk];
    const arr = POSES[nom];
    // El reparto: la CARGA ocupa hasta activa0, el golpe la parte activa, y
    // el resto la recuperacion. Asi la pose sigue al ataque de verdad.
    const u = O.atkT / a[0];
    const uCarga = a[1] / a[0], uAct = a[2] / a[0];
    let i;
    if (u < uCarga) i = Math.min(1, Math.floor(u / uCarga * 2));
    else if (u < uAct) i = 2;
    else i = Math.min(arr.length - 1, 3 + Math.floor((u - uAct) / Math.max(0.001, 1 - uAct) * (arr.length - 3)));
    return [nom, Math.min(arr.length - 1, Math.max(0, i))];
  }
  if (O.st === 1) return ['anda', ((O.animT * 5) | 0) % 4];      // ANDA
  return ['espera', ((O.animT * 3) | 0) % 4];                    // ESPERA
}

// Dibuja al ogro con los pies en (x, y).
export function drawOgro(g, S, x, y, dir, nom, frame) {
  const set = dir >= 0 ? S.der : S.izq;
  const arr = set[nom] || set.espera;
  const cv = arr[Math.min(frame, arr.length - 1)];
  // El lienzo esta DESCENTRADO (el eje en 100 de 430) porque se dimensiono
  // por el garrote extendido. Al mirar a la izquierda va espejado, asi que el
  // eje cae en W-EJE.
  const eje = dir >= 0 ? EJE : cv.width - EJE;
  g.drawImage(cv, Math.round(x - eje), Math.round(y - PIES));
}
