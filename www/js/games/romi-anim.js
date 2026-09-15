// ROMINA - sus fotogramas. Cada uno es una POSE: veinte numeros que describen
// donde esta cada parte del cuerpo. El dibujo entero se compone y se hornea
// UNA vez al entrar al juego.
//
// Son dibujos distintos, no el mismo estirado: en el fotograma 2 de correr la
// falda vuela 14 px hacia atras, la pierna derecha esta adelantada 20 y el
// torso inclinado; en el 4 es al reves. Eso es animar de verdad.

import { pose, horneaPose } from './romi-pose.js';

// Las poses, agrupadas por accion.
export const POSES = {
  // QUIETA: respira. El torso sube 2 px y la falda ondea despacio.
  idle: [
    pose({}),
    pose({ torY: -33, cabY: -27, falOnda: 0.5, manD: [21, 43], manI: [-21, 43] }),
    pose({ torY: -32, cabY: -27, falOnda: 1.0, manD: [21, 42], manI: [-21, 42] }),
    pose({ torY: -33, cabY: -27, falOnda: 1.5, manD: [21, 43], manI: [-21, 43] }),
  ],

  // CORRER: cuatro fotogramas. La falda vuela hacia atras, el torso se
  // inclina hacia delante y las piernas alternan. El pelo tambien se va atras.
  run: [
    pose({ incl: 0.18, torY: -33, falVuelo: 16, falOnda: 0, piernaD: 20, piernaI: -8,
           codD: [15, 16], manD: [26, 30], codI: [-16, 18], manI: [-18, 38], espAng: 0.9, cabGiro: 0.3 }),
    pose({ incl: 0.22, torY: -36, falVuelo: 22, falOnda: 1.2, piernaD: 6, piernaI: -18,
           codD: [17, 14], manD: [30, 26], codI: [-14, 20], manI: [-22, 40], espAng: 0.7, cabGiro: 0.3 }),
    pose({ incl: 0.18, torY: -33, falVuelo: 16, falOnda: 2.4, piernaD: -8, piernaI: 20,
           codD: [15, 18], manD: [24, 34], codI: [-16, 16], manI: [-16, 34], espAng: 0.9, cabGiro: 0.3 }),
    pose({ incl: 0.22, torY: -36, falVuelo: 22, falOnda: 3.6, piernaD: -18, piernaI: 6,
           codD: [13, 20], manD: [20, 38], codI: [-17, 14], manI: [-24, 30], espAng: 1.1, cabGiro: 0.3 }),
  ],

  // SALTAR: impulso (agachada), aire (piernas recogidas, falda y pelo arriba),
  // caida (piernas buscando el suelo).
  jump: [
    pose({ cadY: 118, torY: -30, incl: 0.12, falVuelo: 6, falAlto: 58, piernaD: 8, piernaI: -6,
           codD: [14, 12], manD: [24, 24], codI: [-14, 12], manI: [-24, 24] }),
    pose({ cadY: 110, torY: -36, incl: -0.10, falVuelo: 26, falAlto: 52, falOnda: 2,
           piernaD: 14, piernaI: -12, codD: [18, 6], manD: [30, 10], codI: [-18, 6], manI: [-30, 10],
           espAng: -0.5, escAng: -0.3, ojos: 'esfuerzo' }),
    pose({ cadY: 114, torY: -33, incl: 0.06, falVuelo: 14, falAlto: 66, falOnda: 4,
           piernaD: 10, piernaI: 16, codD: [14, 18], manD: [24, 34], codI: [-14, 18], manI: [-24, 34],
           espAng: 1.4 }),
  ],

  // RODAR: se agacha, se hace bola con el escudo por delante y se levanta.
  // La falda la envuelve. No es una voltereta de gimnasta: es una princesa
  // tirandose de lado con el escudo, que es lo que haria con vestido.
  roll: [
    pose({ cadY: 126, torY: -24, incl: 0.5, cabY: -22, falAlto: 48, falAncho: 40, falVuelo: 14,
           codD: [10, 10], manD: [16, 20], codI: [-12, 8], manI: [-22, 16],
           escX: -26, escY: -2, escAng: -0.5, espAng: 2.2, ojos: 'esfuerzo', boca: 'apretada' }),
    pose({ cadY: 138, torY: -14, incl: 1.1, cabY: -16, cabGiro: -0.5, falAlto: 34, falAncho: 36,
           falVuelo: 22, falOnda: 2, codD: [6, 6], manD: [10, 14], codI: [-8, 4], manI: [-16, 8],
           escX: -18, escY: 4, escAng: -1.1, espAng: 2.8, ojos: 'cerrados', boca: 'apretada' }),
    pose({ cadY: 140, torY: -12, incl: 1.5, cabY: -12, cabGiro: -0.8, falAlto: 30, falAncho: 38,
           falVuelo: 18, falOnda: 4, codD: [4, 8], manD: [6, 16], codI: [-6, 6], manI: [-12, 12],
           escX: -12, escY: 8, escAng: -1.5, espAng: 3.2, ojos: 'cerrados', boca: 'apretada' }),
    pose({ cadY: 128, torY: -22, incl: 0.7, cabY: -20, cabGiro: -0.3, falAlto: 46, falAncho: 42,
           falVuelo: 12, falOnda: 5.5, codD: [10, 14], manD: [18, 26], codI: [-12, 10], manI: [-24, 20],
           escX: -24, escY: 2, escAng: -0.7, espAng: 2.0, ojos: 'esfuerzo' }),
  ],

  // TAJO: arranque (espada atras y arriba), activo (brazo extendido, la falda
  // acompaña el giro), y dos de recuperacion.
  atk: [
    pose({ incl: -0.14, cabGiro: 0.3, falVuelo: -10, falOnda: 0.6,
           codD: [6, -12], manD: [4, -26], espAng: -1.9, codI: [-16, 14], manI: [-26, 30],
           escX: -32, escY: 10, escAng: 0.3, ojos: 'esfuerzo', boca: 'apretada' }),
    pose({ incl: 0.30, cabGiro: 0.5, falVuelo: 20, falOnda: 2.2, torY: -33,
           codD: [22, 6], manD: [40, 8], espAng: 0.05, codI: [-12, 18], manI: [-18, 36],
           escX: -28, escY: 16, escAng: -0.2, ojos: 'esfuerzo', boca: 'abierta' }),
    pose({ incl: 0.22, cabGiro: 0.4, falVuelo: 12, falOnda: 3.4, torY: -34,
           codD: [20, 16], manD: [32, 28], espAng: 0.7, codI: [-13, 20], manI: [-20, 40],
           escX: -32, escY: 14, escAng: 0, boca: 'apretada' }),
    pose({ incl: 0.08, falVuelo: 4, falOnda: 4.6, codD: [15, 20], manD: [24, 40], espAng: 1.1 }),
  ],

  // BLOQUEAR con el escudo: se planta de lado, el escudo por delante y la
  // espada recogida. Es el verbo propio de ella.
  block: [
    pose({ incl: -0.10, cabGiro: -0.2, torY: -33, falOnda: 0.4, falAncho: 44,
           codD: [10, 20], manD: [14, 36], espAng: 2.4,
           codI: [-6, 4], manI: [-12, 10], escX: -20, escY: -14, escAng: 0.1,
           ojos: 'esfuerzo', boca: 'apretada' }),
    // El instante del impacto: retrocede un poco y el escudo tiembla
    pose({ incl: -0.18, cabGiro: -0.3, torY: -31, falOnda: 1.4, falAncho: 45, falVuelo: -8,
           codD: [9, 22], manD: [12, 38], espAng: 2.6,
           codI: [-4, 6], manI: [-9, 12], escX: -16, escY: -12, escAng: 0.25,
           ojos: 'esfuerzo', boca: 'apretada' }),
  ],

  // DOLOR: la cabeza atras, el cuerpo arqueado, el escudo y la espada caidos.
  hurt: [
    pose({ incl: -0.35, cabGiro: -0.6, cabY: -30, torY: -32, falVuelo: -14, falOnda: 3,
           codD: [10, 6], manD: [14, 12], espAng: 2.6,
           codI: [-18, 10], manI: [-30, 18], escX: -38, escY: 4, escAng: 0.8,
           ojos: 'dolor', boca: 'abierta' }),
  ],
};

// Hornea todas las poses. Devuelve { der: {...}, izq: {...} }.
export function bakeRomina() {
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

// Dibuja a Romina con los pies en (x, y).
export function drawRomina(g, S, x, y, dir, pose_, frame) {
  const set = dir >= 0 ? S.der : S.izq;
  const arr = set[pose_] || set.idle;
  const cv = arr[Math.min(frame, arr.length - 1)];
  // El lienzo de la pose tiene los pies en y=176 de 180: se ancla ahi.
  g.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - 176));
}
