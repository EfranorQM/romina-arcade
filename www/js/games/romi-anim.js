// ROMINA - sus fotogramas. Cada uno es una POSE: veinte numeros que describen
// donde esta cada parte del cuerpo. El dibujo entero se compone y se hornea
// UNA vez al entrar al juego.
//
// Son dibujos distintos, no el mismo estirado: en el fotograma 2 de correr la
// falda vuela 14 px hacia atras, la pierna derecha esta adelantada 20 y el
// torso inclinado; en el 4 es al reves. Eso es animar de verdad.

import { pose, horneaPose } from './romi-pose.js';
import { EJE } from './romi-art.js';

// Las poses, agrupadas por accion.
export const POSES = {
  // QUIETA: respira. El torso sube 2 px y la falda ondea despacio.
  idle: [
    pose({}),
    pose({ torY: -33, cabY: -27, falOnda: 0.5, manD: [21, 43], manI: [-21, 43] }),
    pose({ torY: -32, cabY: -27, falOnda: 1.0, manD: [21, 42], manI: [-21, 42] }),
    pose({ torY: -33, cabY: -27, falOnda: 1.5, manD: [21, 43], manI: [-21, 43] }),
  ],

  // CORRER: cuatro fotogramas. Lo que se mueve es el VESTIDO, no las piernas:
  // la pierna empuja la tela desde dentro y por debajo del borde asoma la bota.
  // Antes se pintaban dos tiras de piel que rajaban la falda por el medio y
  // parecian zancos -- era lo mas feo de toda la animacion.
  //
  // El ciclo tambien SUBE Y BAJA (cadY 112-116): un ciclo de carrera sin ese
  // rebote se lee como si patinara. Los apoyos (1 y 3) van abajo; los vuelos
  // (2 y 4), arriba.
  // SEIS fotogramas, no cuatro. Medido: un ciclo de zancada dura 0.53 s, y con
  // cuatro dibujos eso son 7.5 por segundo -- por debajo de los 12 a los que la
  // animacion 2D clasica va "a dos", y se notaba a saltos. Con seis van a 11.3.
  // El ciclo es: contacto -> peso encima -> empuje/vuelo, y otra vez con la
  // otra pierna.
  run: [
    // 1. CONTACTO derecho. El pie de delante toca, la cadera baja.
    pose({ incl: 0.20, cadY: 116, torY: -33, falVuelo: 18, falOnda: 0, falAncho: 47,
           piernaD: 22, piernaI: -10,
           codD: [15, 16], manD: [26, 30], codI: [-16, 18], manI: [-18, 38],
           espAng: 0.9, cabGiro: 0.3 }),
    // 2. PESO ENCIMA. La cadera en su punto mas bajo, las piernas bajo ella.
    pose({ incl: 0.23, cadY: 118, torY: -32, falVuelo: 14, falOnda: 0.6, falAncho: 45,
           piernaD: 14, piernaI: -18,
           codD: [16, 15], manD: [28, 28], codI: [-15, 19], manI: [-20, 39],
           espAng: 0.8, cabGiro: 0.3 }),
    // 3. EMPUJE y vuelo. Sube, la falda en su maximo hacia atras.
    pose({ incl: 0.26, cadY: 111, torY: -36, falVuelo: 26, falOnda: 1.2, falAncho: 50,
           piernaD: 6, piernaI: -22,
           codD: [17, 14], manD: [30, 26], codI: [-14, 20], manI: [-22, 40],
           espAng: 0.7, cabGiro: 0.3 }),
    // 4. CONTACTO izquierdo.
    pose({ incl: 0.20, cadY: 116, torY: -33, falVuelo: 18, falOnda: 2.4, falAncho: 47,
           piernaD: -10, piernaI: 22,
           codD: [15, 18], manD: [24, 34], codI: [-16, 16], manI: [-16, 34],
           espAng: 0.9, cabGiro: 0.3 }),
    // 5. PESO ENCIMA.
    pose({ incl: 0.23, cadY: 118, torY: -32, falVuelo: 14, falOnda: 3.0, falAncho: 45,
           piernaD: -18, piernaI: 14,
           codD: [14, 19], manD: [22, 36], codI: [-16, 15], manI: [-18, 32],
           espAng: 1.0, cabGiro: 0.3 }),
    // 6. EMPUJE y vuelo.
    pose({ incl: 0.26, cadY: 111, torY: -36, falVuelo: 26, falOnda: 3.6, falAncho: 50,
           piernaD: -22, piernaI: 6,
           codD: [13, 20], manD: [20, 38], codI: [-17, 14], manI: [-24, 30],
           espAng: 1.1, cabGiro: 0.3 }),
  ],

  // SALTAR: impulso (agachada), aire (piernas recogidas, falda y pelo arriba),
  // caida (piernas buscando el suelo).
  // SEIS fotogramas, no tres. Era la peor de todas: el vuelo dura 0.52 s y con
  // tres dibujos son 5.8 por segundo, la mitad de lo que pide una accion fluida
  // -- por eso al saltar se veia a tirones. Ahora van a 11.5.
  //
  // Se mapean por la VELOCIDAD vertical, no por un reloj: asi el fotograma
  // corresponde siempre a lo que el cuerpo esta haciendo de verdad.
  jump: [
    // 1. IMPULSO. Se agacha, la falda se aplasta contra las piernas.
    pose({ cadY: 122, torY: -28, incl: 0.16, falVuelo: 4, falAlto: 54, falAncho: 50,
           piernaD: 10, piernaI: -8,
           codD: [14, 12], manD: [24, 24], codI: [-14, 12], manI: [-24, 24],
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. DESPEGUE. Se estira del todo, la falda todavia arrastra abajo.
    pose({ cadY: 112, torY: -35, incl: 0.02, falVuelo: 16, falAlto: 58, falAncho: 47,
           falOnda: 0.8, piernaD: 18, piernaI: -12,
           codD: [17, 8], manD: [28, 14], codI: [-17, 8], manI: [-28, 14],
           espAng: -0.2, escAng: -0.2, escY: 8, ojos: 'esfuerzo', boca: 'abierta' }),
    // 3. SUBIENDO. Brazos arriba, la falda y el pelo ya subiendo con ella.
    pose({ cadY: 108, torY: -37, incl: -0.12, falVuelo: 28, falAlto: 50, falAncho: 44,
           falOnda: 2, piernaD: 16, piernaI: -14,
           codD: [18, 4], manD: [30, 6], codI: [-18, 4], manI: [-30, 6],
           espAng: -0.7, escAng: -0.35, escY: 4, ojos: 'esfuerzo', boca: 'abierta' }),
    // 4. CUMBRE. El instante en que se para arriba: se recoge y flota.
    pose({ cadY: 110, torY: -36, incl: -0.04, falVuelo: 22, falAlto: 46, falAncho: 42,
           falOnda: 3, piernaD: 12, piernaI: -10,
           codD: [16, 6], manD: [26, 10], codI: [-16, 6], manI: [-26, 10],
           espAng: -0.3, escAng: -0.25, escY: 6, ojos: 'normal', boca: 'abierta' }),
    // 5. CAYENDO. La falda se le viene arriba por el aire que sube.
    pose({ cadY: 111, torY: -34, incl: 0.04, falVuelo: 20, falAlto: 62, falAncho: 50,
           falOnda: 3.6, piernaD: 14, piernaI: 10,
           codD: [15, 12], manD: [26, 22], codI: [-15, 12], manI: [-26, 22],
           espAng: 0.8 }),
    // 6. BUSCA EL SUELO. Las piernas se adelantan para recibir el golpe.
    pose({ cadY: 113, torY: -32, incl: 0.10, falVuelo: 16, falAlto: 68, falAncho: 52,
           falOnda: 4, piernaD: 12, piernaI: 18,
           codD: [14, 18], manD: [24, 34], codI: [-14, 18], manI: [-24, 34],
           espAng: 1.4 }),
    // 7. ATERRIZA. Amortigua: la cadera baja de golpe, la falda se aplasta
    // contra el suelo y rebota. Sin esto, caer de un salto entero se veia
    // como aparecer de pie -- la caida no tenia consecuencia.
    pose({ cadY: 126, torY: -26, incl: 0.20, falVuelo: -4, falAlto: 50, falAncho: 54,
           falOnda: 5, piernaD: 14, piernaI: -12,
           codD: [12, 16], manD: [20, 30], codI: [-12, 16], manI: [-20, 30],
           espAng: 1.5, ojos: 'esfuerzo', boca: 'apretada' }),
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

  // TAJO: cinco fotogramas. Antes eran cuatro y solo cambiaba el angulo del
  // brazo: por eso se veia floja. Un espadazo se lee por TRES cosas, y ahora
  // estan las tres -- la CARGA (se echa atras, se agacha, amenaza), el
  // BARRIDO con estela de arriba abajo, y el PESO despues (se pasa de largo,
  // le cuesta frenar la espada). El cuerpo entero gira: la inclinacion va de
  // -0.30 a +0.38, la falda de -16 a +26, y la cabeza sigue al filo.
  atk: [
    // 1. CARGA. Se agacha, el hombro atras, la espada arriba y detras.
    pose({ incl: -0.30, cabGiro: 0.45, cadY: 116, torY: -31, falVuelo: -16, falOnda: 0.6,
           falAncho: 44, piernaD: -10, piernaI: 12,
           codD: [2, -14], manD: [-4, -30], espAng: -2.35,
           codI: [-17, 12], manI: [-28, 26],
           escX: -34, escY: 8, escAng: 0.5, ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. BARRIDO. El instante del impacto: brazo extendido del todo, la hoja
    // horizontal, y la estela cubriendo TODO el arco que acaba de recorrer.
    pose({ incl: 0.38, cabGiro: 0.55, cadY: 110, torY: -35, falVuelo: 26, falOnda: 2.2,
           falAncho: 50, piernaD: 22, piernaI: -14,
           codD: [24, 2], manD: [44, 4], espAng: -0.15, estela: [-2.15, -0.05],
           codI: [-10, 20], manI: [-14, 38],
           escX: -26, escY: 18, escAng: -0.35, ojos: 'esfuerzo', boca: 'abierta' }),
    // 3. PASADA. La espada se pasa de largo por el peso, ella sigue girada.
    pose({ incl: 0.30, cabGiro: 0.5, cadY: 113, torY: -34, falVuelo: 18, falOnda: 3.4,
           falAncho: 48, piernaD: 14, piernaI: -8,
           codD: [22, 14], manD: [38, 24], espAng: 0.85, estela: [-0.05, 0.73],
           codI: [-12, 20], manI: [-18, 40],
           escX: -30, escY: 16, escAng: -0.1, ojos: 'esfuerzo', boca: 'abierta' }),
    // 4. FRENA. Le cuesta pararla: la punta baja del todo y el torso vuelve.
    pose({ incl: 0.14, cadY: 114, torY: -33, falVuelo: 8, falOnda: 4.6, falAncho: 47,
           piernaD: 6, piernaI: -4,
           codD: [17, 22], manD: [28, 40], espAng: 1.45,
           codI: [-14, 20], manI: [-22, 42], escX: -33, escY: 16, boca: 'apretada' }),
    // 5. GUARDIA. Vuelve a la suya, aun con la respiracion alta.
    pose({ incl: 0.04, torY: -33, falVuelo: 2, falOnda: 5.6,
           codD: [14, 22], manD: [22, 44], espAng: 1.3 }),
  ],

  // BLOQUEAR: cuatro fotogramas.
  //
  // PARECIA QUE SE DABA LA VUELTA. Y la fisica estaba bien (dir=1 medido): era
  // el DIBUJO. Tenia incl de -0.16 a -0.42 y cabGiro de -0.25 a -0.55, todo
  // negativo, o sea el torso echado atras y la cara girada atras; y el escudo
  // en escX negativo, al lado contrario del que mira. Lo pense como "retrocede
  // por el impacto", pero andando hacia la derecha eso se lee como que gira.
  //
  // Un bloqueo se ENCARA a la amenaza: el cuerpo se agacha y se cierra, pero
  // la cara y el escudo van HACIA DELANTE. El retroceso es de la cadera (cadY
  // y un piernaI que planta el pie de atras), nunca del torso ni de la cara.
  block: [
    // 1. LEVANTA. El escudo sube cruzando el cuerpo, la cara ya al frente.
    pose({ incl: 0.10, cabGiro: 0.15, cadY: 116, torY: -31, falOnda: 0.4,
           falAncho: 47, falAlto: 62, piernaD: 6, piernaI: -10,
           codD: [8, 22], manD: [10, 38], espAng: 2.5,
           codI: [-4, 14], manI: [4, 22],
           escX: 8, escY: 0, escAng: 0.05, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. PLANTADA. Postura estable: peso atras, escudo al frente, mirando.
    pose({ incl: 0.16, cabGiro: 0.25, cadY: 119, torY: -29, cabY: -26, falOnda: 1.2,
           falAncho: 49, falAlto: 59, piernaD: 10, piernaI: -16,
           codD: [6, 24], manD: [6, 40], espAng: 2.7,
           codI: [-2, 16], manI: [10, 24],
           escX: 14, escY: 2, escAng: 0, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 3. IMPACTO. El golpe la empuja: la CADERA cede y el pie de atras patina,
    // pero el escudo y la cara siguen al frente -- aguanta, no se voltea.
    pose({ incl: 0.06, cabGiro: 0.18, cadY: 124, torY: -26, cabY: -23,
           falOnda: 2.6, falAncho: 51, falAlto: 56, falVuelo: -12,
           piernaD: 4, piernaI: -24,
           codD: [4, 26], manD: [2, 42], espAng: 2.95,
           codI: [0, 18], manI: [16, 26],
           escX: 19, escY: 4, escAng: -0.12, escZ: 1,
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 4. SE REHACE. Vuelve a plantarse tras aguantar el golpe.
    pose({ incl: 0.14, cabGiro: 0.22, cadY: 120, torY: -28, cabY: -25,
           falOnda: 3.8, falAncho: 49, falAlto: 58, piernaD: 8, piernaI: -14,
           codD: [6, 24], manD: [6, 40], espAng: 2.75,
           codI: [-2, 16], manI: [11, 24],
           escX: 15, escY: 2, escAng: 0.04, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada' }),
  ],

  // DOLOR: tres fotogramas, no uno. Dura 0.28 s y con un solo dibujo el golpe
  // no tenia reaccion: se congelaba. Ahora encaja, se arquea y se recompone.
  // Aqui SI van incl y cabGiro negativos: un golpe te echa atras de verdad,
  // al reves que bloquear, donde encararse es lo correcto.
  hurt: [
    // 1. ENCAJA. El impacto la dobla: cabeza atras, brazos sueltos.
    pose({ incl: -0.35, cabGiro: -0.6, cabY: -30, torY: -32, falVuelo: -14, falOnda: 3,
           codD: [10, 6], manD: [14, 12], espAng: 2.6,
           codI: [-18, 10], manI: [-30, 18], escX: -38, escY: 4, escAng: 0.8,
           ojos: 'dolor', boca: 'abierta' }),
    // 2. ARQUEADA. Lo peor del dolor: se dobla sobre si misma y retrocede.
    pose({ incl: -0.48, cabGiro: -0.7, cabY: -26, torY: -28, cadY: 118,
           falVuelo: -22, falOnda: 4.4, falAncho: 44, piernaD: -18, piernaI: 10,
           codD: [6, 10], manD: [8, 18], espAng: 2.9,
           codI: [-20, 8], manI: [-34, 14], escX: -42, escY: 8, escAng: 1.0,
           ojos: 'dolor', boca: 'abierta' }),
    // 3. SE RECOMPONE. Vuelve a levantar la guardia, aun dolorida.
    pose({ incl: -0.16, cabGiro: -0.3, cabY: -28, torY: -32, cadY: 114,
           falVuelo: -6, falOnda: 5.4, piernaD: -8, piernaI: 4,
           codD: [12, 14], manD: [18, 26], espAng: 2.0,
           codI: [-16, 14], manI: [-26, 26], escX: -36, escY: 8, escAng: 0.5,
           ojos: 'dolor', boca: 'apretada' }),
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
  // El lienzo es MAS ANCHO que ella (192 para un cuerpo de 128) porque la
  // espada extendida se salia. Asi que NO se centra por el ancho del lienzo:
  // se ancla al EJE del cuerpo, que esta en x=64. Al mirar a la izquierda el
  // lienzo va espejado, asi que el eje cae en W-EJE.
  const eje = dir >= 0 ? EJE : cv.width - EJE;
  // Los pies estan en y=176 de 180.
  g.drawImage(cv, Math.round(x - eje), Math.round(y - 176));
}
