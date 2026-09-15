// ROMINA - sus fotogramas. Cada uno es una POSE: veinte numeros que describen
// donde esta cada parte del cuerpo. El dibujo entero se compone y se hornea
// UNA vez al entrar al juego.
//
// Son dibujos distintos, no el mismo estirado: en el fotograma 2 de correr la
// falda vuela 14 px hacia atras, la pierna derecha esta adelantada 20 y el
// torso inclinado; en el 4 es al reves. Eso es animar de verdad.

import { pose, horneaPose } from './romi-pose.js';
import { EJE } from './romi-art.js';

// --- La tela ---
// Genera los siete gajos de la falda como una ONDA QUE VIAJA. `fase` es donde
// esta la onda, `amp` cuanto se mueve la tela y `retardo` cuanto tarda un gajo
// en seguir al de al lado.
//
// El retardo es lo que hace que parezca tela: si los siete gajos se movieran a
// la vez, la falda seria un cono rigido balanceandose. Con retardo, cuando ella
// arranca el gajo de delante sale primero y el de atras llega tarde, igual que
// una falda de verdad.
function tela(fase, amp, retardo = 0.55) {
  const g = [];
  for (let i = 0; i < 7; i++) {
    // i=0 es el gajo de atras, i=6 el de delante. El de delante va por delante
    // en la fase (de ahi el signo), y los de atras arrastran.
    g.push(Math.sin(fase - (6 - i) * retardo) * amp);
  }
  return g;
}
// El bajo de la falda: la misma onda desfasada un cuarto, porque el borde
// llega siempre despues que el cuerpo del gajo (es lo que mas cuelga).
function borde(fase, amp, retardo = 0.55) {
  return tela(fase - 1.2, amp, retardo);
}

// Las poses, agrupadas por accion.
export const POSES = {
  // QUIETA: respira, y la falda ondea sola. SEIS fotogramas: con cuatro el
  // ciclo de respiracion se notaba repetirse. La tela se mueve poquito
  // (amplitud 0.22) pero NUNCA se queda congelada, que es lo que distingue un
  // personaje vivo de una estatua.
  idle: [
    pose({ falGajos: tela(0.0, 0.22), falBorde: borde(0.0, 0.3) }),
    pose({ torY: -33, cabY: -27, falOnda: 0.5, manD: [21, 43], manI: [-21, 43],
           falGajos: tela(1.05, 0.22), falBorde: borde(1.05, 0.3) }),
    pose({ torY: -32, cabY: -27, falOnda: 1.0, manD: [21, 42], manI: [-21, 42],
           falGajos: tela(2.1, 0.22), falBorde: borde(2.1, 0.3) }),
    pose({ torY: -32, cabY: -27, falOnda: 1.5, manD: [21, 42], manI: [-21, 42],
           falGajos: tela(3.15, 0.22), falBorde: borde(3.15, 0.3) }),
    pose({ torY: -33, cabY: -27, falOnda: 2.0, manD: [21, 43], manI: [-21, 43],
           falGajos: tela(4.2, 0.22), falBorde: borde(4.2, 0.3) }),
    pose({ falOnda: 2.5, falGajos: tela(5.25, 0.22), falBorde: borde(5.25, 0.3) }),
  ],

  // CORRER: OCHO fotogramas, y ninguno tiene piernas.
  //
  // El ciclo ya no es "pie derecho / pie izquierdo": es el REBOTE del cuerpo
  // (la cadera sube y baja dos veces por ciclo, que es lo que hace leer la
  // zancada aunque no se vean los pies) mas la ONDA de la tela recorriendo los
  // siete gajos. La onda da una vuelta entera en los ocho fotogramas, asi que
  // el bucle cierra sin salto.
  //
  // Con ocho dibujos en los 0.53 s del ciclo van a 15 por segundo: por encima
  // de los 12 de la animacion clasica. La tela tiene sitio de sobra para
  // moverse, que es justo lo que faltaba.
  run: [
    // 1. Abajo del rebote. La tela empieza a lanzarse hacia atras.
    pose({ incl: 0.20, cadY: 116, torY: -33, falVuelo: 18, falOnda: 0, falAncho: 47,
           falGajos: tela(0.0, 0.85), falBorde: borde(0.0, 0.9),
           codD: [15, 16], manD: [26, 30], codI: [-16, 18], manI: [-18, 38],
           espAng: 0.9, cabGiro: 0.3 }),
    // 2. Subiendo.
    pose({ incl: 0.23, cadY: 113, torY: -35, falVuelo: 23, falOnda: 0.6, falAncho: 49,
           falGajos: tela(0.79, 0.9), falBorde: borde(0.79, 0.95),
           codD: [16, 15], manD: [29, 27], codI: [-15, 19], manI: [-21, 39],
           espAng: 0.8, cabGiro: 0.3 }),
    // 3. Arriba del rebote. La falda en su maximo hacia atras.
    pose({ incl: 0.26, cadY: 111, torY: -36, falVuelo: 27, falOnda: 1.2, falAncho: 50,
           falGajos: tela(1.57, 0.95), falBorde: borde(1.57, 1.0),
           codD: [17, 14], manD: [30, 26], codI: [-14, 20], manI: [-22, 40],
           espAng: 0.7, cabGiro: 0.3 }),
    // 4. Cayendo. La tela empieza a volver.
    pose({ incl: 0.23, cadY: 114, torY: -34, falVuelo: 21, falOnda: 1.8, falAncho: 48,
           falGajos: tela(2.36, 0.9), falBorde: borde(2.36, 0.95),
           codD: [16, 16], manD: [27, 30], codI: [-15, 18], manI: [-19, 37],
           espAng: 0.85, cabGiro: 0.3 }),
    // 5. Abajo del rebote, la otra mitad del ciclo.
    pose({ incl: 0.20, cadY: 116, torY: -33, falVuelo: 18, falOnda: 2.4, falAncho: 47,
           falGajos: tela(3.14, 0.85), falBorde: borde(3.14, 0.9),
           codD: [15, 18], manD: [24, 34], codI: [-16, 16], manI: [-16, 34],
           espAng: 0.9, cabGiro: 0.3 }),
    // 6. Subiendo.
    pose({ incl: 0.23, cadY: 113, torY: -35, falVuelo: 23, falOnda: 3.0, falAncho: 49,
           falGajos: tela(3.93, 0.9), falBorde: borde(3.93, 0.95),
           codD: [14, 19], manD: [22, 36], codI: [-16, 15], manI: [-18, 32],
           espAng: 1.0, cabGiro: 0.3 }),
    // 7. Arriba del rebote.
    pose({ incl: 0.26, cadY: 111, torY: -36, falVuelo: 27, falOnda: 3.6, falAncho: 50,
           falGajos: tela(4.71, 0.95), falBorde: borde(4.71, 1.0),
           codD: [13, 20], manD: [20, 38], codI: [-17, 14], manI: [-24, 30],
           espAng: 1.1, cabGiro: 0.3 }),
    // 8. Cayendo, y enlaza con el 1.
    pose({ incl: 0.23, cadY: 114, torY: -34, falVuelo: 21, falOnda: 4.2, falAncho: 48,
           falGajos: tela(5.50, 0.9), falBorde: borde(5.50, 0.95),
           codD: [14, 18], manD: [23, 33], codI: [-16, 17], manI: [-18, 36],
           espAng: 1.0, cabGiro: 0.3 }),
  ],

  // SEIS fotogramas, no tres. Era la peor de todas: el vuelo dura 0.52 s y con
  // tres dibujos son 5.8 por segundo, la mitad de lo que pide una accion fluida
  // -- por eso al saltar se veia a tirones. Ahora van a 11.5.
  //
  // Se mapean por la VELOCIDAD vertical, no por un reloj: asi el fotograma
  // corresponde siempre a lo que el cuerpo esta haciendo de verdad.
  jump: [
    // 1. IMPULSO. Se agacha, la falda se aplasta contra las piernas.
    pose({ cadY: 122, torY: -28, incl: 0.16, falVuelo: 4, falAlto: 54, falAncho: 50,
           codD: [14, 12], manD: [24, 24], codI: [-14, 12], manI: [-24, 24],
           ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(0.0, 0.5), falBorde: borde(0.0, 0.55) }),
    // 2. DESPEGUE. Se estira del todo, la falda todavia arrastra abajo.
    pose({ cadY: 112, torY: -35, incl: 0.02, falVuelo: 16, falAlto: 58, falAncho: 47,
           falOnda: 0.8,
           codD: [17, 8], manD: [28, 14], codI: [-17, 8], manI: [-28, 14],
           espAng: -0.2, escAng: -0.2, escY: 8, ojos: 'esfuerzo', boca: 'abierta',
           falGajos: tela(1.1, 0.8), falBorde: borde(1.1, 0.88) }),
    // 3. SUBIENDO. Brazos arriba, la falda y el pelo ya subiendo con ella.
    pose({ cadY: 108, torY: -37, incl: -0.12, falVuelo: 28, falAlto: 50, falAncho: 44,
           falOnda: 2,
           codD: [18, 4], manD: [30, 6], codI: [-18, 4], manI: [-30, 6],
           espAng: -0.7, escAng: -0.35, escY: 4, ojos: 'esfuerzo', boca: 'abierta',
           falGajos: tela(2.0, 1.15), falBorde: borde(2.0, 1.26) }),
    // 4. CUMBRE. El instante en que se para arriba: se recoge y flota.
    pose({ cadY: 110, torY: -36, incl: -0.04, falVuelo: 22, falAlto: 46, falAncho: 42,
           falOnda: 3,
           codD: [16, 6], manD: [26, 10], codI: [-16, 6], manI: [-26, 10],
           espAng: -0.3, escAng: -0.25, escY: 6, ojos: 'normal', boca: 'abierta',
           falGajos: tela(2.9, 0.75), falBorde: borde(2.9, 0.83) }),
    // 5. CAYENDO. La falda se le viene arriba por el aire que sube.
    pose({ cadY: 111, torY: -34, incl: 0.04, falVuelo: 20, falAlto: 62, falAncho: 50,
           falOnda: 3.6,
           codD: [15, 12], manD: [26, 22], codI: [-15, 12], manI: [-26, 22],
           espAng: 0.8,
           falGajos: tela(3.8, 0.95), falBorde: borde(3.8, 1.04) }),
    // 6. BUSCA EL SUELO. Las piernas se adelantan para recibir el golpe.
    pose({ cadY: 113, torY: -32, incl: 0.10, falVuelo: 16, falAlto: 68, falAncho: 52,
           falOnda: 4,
           codD: [14, 18], manD: [24, 34], codI: [-14, 18], manI: [-24, 34],
           espAng: 1.4,
           falGajos: tela(4.6, 1.1), falBorde: borde(4.6, 1.21) }),
    // 7. ATERRIZA. Amortigua: la cadera baja de golpe, la falda se aplasta
    // contra el suelo y rebota. Sin esto, caer de un salto entero se veia
    // como aparecer de pie -- la caida no tenia consecuencia.
    pose({ cadY: 126, torY: -26, incl: 0.20, falVuelo: -4, falAlto: 50, falAncho: 54,
           falOnda: 5,
           codD: [12, 16], manD: [20, 30], codI: [-12, 16], manI: [-20, 30],
           espAng: 1.5, ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(5.4, 0.55), falBorde: borde(5.4, 0.61) }),
  ],

  // RODAR: se agacha, se hace bola con el escudo por delante y se levanta.
  // La falda la envuelve. No es una voltereta de gimnasta: es una princesa
  // tirandose de lado con el escudo, que es lo que haria con vestido.
  roll: [
    pose({ cadY: 126, torY: -24, incl: 0.5, cabY: -22, falAlto: 48, falAncho: 40, falVuelo: 14,
           codD: [10, 10], manD: [16, 20], codI: [-12, 8], manI: [-22, 16],
           escX: -26, escY: -2, escAng: -0.5, espAng: 2.2, ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(0.4, 1.0), falBorde: borde(0.4, 1.10) }),
    pose({ cadY: 138, torY: -14, incl: 1.1, cabY: -16, cabGiro: -0.5, falAlto: 34, falAncho: 36,
           falVuelo: 22, falOnda: 2, codD: [6, 6], manD: [10, 14], codI: [-8, 4], manI: [-16, 8],
           escX: -18, escY: 4, escAng: -1.1, espAng: 2.8, ojos: 'cerrados', boca: 'apretada',
           falGajos: tela(1.9, 1.25), falBorde: borde(1.9, 1.38) }),
    pose({ cadY: 140, torY: -12, incl: 1.5, cabY: -12, cabGiro: -0.8, falAlto: 30, falAncho: 38,
           falVuelo: 18, falOnda: 4, codD: [4, 8], manD: [6, 16], codI: [-6, 6], manI: [-12, 12],
           escX: -12, escY: 8, escAng: -1.5, espAng: 3.2, ojos: 'cerrados', boca: 'apretada',
           falGajos: tela(3.4, 1.2), falBorde: borde(3.4, 1.32) }),
    pose({ cadY: 128, torY: -22, incl: 0.7, cabY: -20, cabGiro: -0.3, falAlto: 46, falAncho: 42,
           falVuelo: 12, falOnda: 5.5, codD: [10, 14], manD: [18, 26], codI: [-12, 10], manI: [-24, 20],
           escX: -24, escY: 2, escAng: -0.7, espAng: 2.0, ojos: 'esfuerzo',
           falGajos: tela(4.9, 0.9), falBorde: borde(4.9, 0.99) }),
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
           falAncho: 44,
           codD: [2, -14], manD: [-4, -30], espAng: -2.35,
           codI: [-17, 12], manI: [-28, 26],
           escX: -34, escY: 8, escAng: 0.5, ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(5.6, 0.7), falBorde: borde(5.6, 0.77) }),
    // 2. BARRIDO. El instante del impacto: brazo extendido del todo, la hoja
    // horizontal, y la estela cubriendo TODO el arco que acaba de recorrer.
    pose({ incl: 0.38, cabGiro: 0.55, cadY: 110, torY: -35, falVuelo: 26, falOnda: 2.2,
           falAncho: 50,
           codD: [24, 2], manD: [44, 4], espAng: -0.15, estela: [-2.15, -0.05],
           codI: [-10, 20], manI: [-14, 38],
           escX: -26, escY: 18, escAng: -0.35, ojos: 'esfuerzo', boca: 'abierta',
           falGajos: tela(1.2, 1.2), falBorde: borde(1.2, 1.32) }),
    // 3. PASADA. La espada se pasa de largo por el peso, ella sigue girada.
    pose({ incl: 0.30, cabGiro: 0.5, cadY: 113, torY: -34, falVuelo: 18, falOnda: 3.4,
           falAncho: 48,
           codD: [22, 14], manD: [38, 24], espAng: 0.85, estela: [-0.05, 0.73],
           codI: [-12, 20], manI: [-18, 40],
           escX: -30, escY: 16, escAng: -0.1, ojos: 'esfuerzo', boca: 'abierta',
           falGajos: tela(2.2, 1.0), falBorde: borde(2.2, 1.10) }),
    // 4. FRENA. Le cuesta pararla: la punta baja del todo y el torso vuelve.
    pose({ incl: 0.14, cadY: 114, torY: -33, falVuelo: 8, falOnda: 4.6, falAncho: 47,
           codD: [17, 22], manD: [28, 40], espAng: 1.45,
           codI: [-14, 20], manI: [-22, 42], escX: -33, escY: 16, boca: 'apretada',
           falGajos: tela(3.1, 0.7), falBorde: borde(3.1, 0.77) }),
    // 5. GUARDIA. Vuelve a la suya, aun con la respiracion alta.
    pose({ incl: 0.04, torY: -33, falVuelo: 2, falOnda: 5.6,
           codD: [14, 22], manD: [22, 44], espAng: 1.3,
           falGajos: tela(4.0, 0.45), falBorde: borde(4.0, 0.50) }),
  ],

  // TAJO 2 - EL DERECHO. El segundo del combo: viene del otro lado, de abajo
  // hacia arriba. Tiene que verse DISTINTO al primero o el combo no se nota;
  // por eso este barre al reves (de +1.5 a -0.6) y ella se abre en vez de
  // cerrarse.
  atk2: [
    // 1. RECOGE. La espada baja al costado, el peso al pie de atras.
    pose({ incl: 0.22, cabGiro: 0.35, cadY: 114, torY: -32, falVuelo: 10, falOnda: 1.2,
           falAncho: 46, codD: [16, 22], manD: [26, 42], espAng: 1.75,
           codI: [-12, 18], manI: [-20, 36], escX: -30, escY: 14,
           falGajos: tela(0.5, 0.6), falBorde: borde(0.5, 0.66),
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. BARRE de abajo a arriba, cruzando. Aqui hace daño.
    pose({ incl: -0.16, cabGiro: 0.5, cadY: 108, torY: -37, falVuelo: 22, falOnda: 2.6,
           falAncho: 49, codD: [24, 6], manD: [42, -6], espAng: -0.55,
           estela: [1.45, -0.55],
           codI: [-14, 14], manI: [-24, 28], escX: -30, escY: 6, escAng: 0.4,
           falGajos: tela(1.9, 1.05), falBorde: borde(1.9, 1.15),
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 3. ARRIBA. La espada acaba en alto, ella estirada.
    pose({ incl: -0.28, cabGiro: 0.45, cadY: 106, torY: -38, falVuelo: 16, falOnda: 3.8,
           falAncho: 47, codD: [20, -6], manD: [34, -22], espAng: -1.35,
           estela: [0.2, -1.35],
           codI: [-16, 12], manI: [-28, 24], escX: -32, escY: 4, escAng: 0.5,
           falGajos: tela(2.9, 0.85), falBorde: borde(2.9, 0.94),
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 4. BAJA. La deja caer por el peso.
    pose({ incl: -0.10, cadY: 111, torY: -35, falVuelo: 8, falOnda: 4.8, falAncho: 46,
           codD: [17, 8], manD: [28, 12], espAng: -0.4,
           codI: [-14, 16], manI: [-24, 32], escX: -33, escY: 10,
           falGajos: tela(3.8, 0.6), falBorde: borde(3.8, 0.66),
           boca: 'apretada' }),
    // 5. GUARDIA.
    pose({ incl: 0.02, torY: -33, falVuelo: 2, falOnda: 5.8,
           codD: [15, 20], manD: [24, 38], espAng: 0.9,
           falGajos: tela(4.6, 0.4), falBorde: borde(4.6, 0.44) }),
  ],

  // TAJO 3 - EL GIRO. El remate del combo: da una vuelta ENTERA sobre si
  // misma con la espada extendida. Seis fotogramas porque dura 0.46 s (casi el
  // doble que los otros) y porque una vuelta necesita verse girar, no
  // teletransportarse.
  //
  // La falda es la protagonista aqui: en un giro es lo que mas vuela, asi que
  // va a amplitud maxima y el vuelo sube hasta 34.
  atk3: [
    // 1. CARGA. Se agacha y se enrosca al maximo, espada muy atras.
    pose({ incl: -0.42, cabGiro: 0.6, cadY: 120, torY: -29, falVuelo: -20, falOnda: 0.4,
           falAncho: 42, codD: [0, -10], manD: [-10, -24], espAng: -2.6,
           codI: [-18, 10], manI: [-30, 22], escX: -36, escY: 6, escAng: 0.6,
           falGajos: tela(0.0, 0.8), falBorde: borde(0.0, 0.88),
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. ARRANCA el giro. El cuerpo empieza a rotar, la falda se despega.
    pose({ incl: 0.12, cabGiro: 0.2, cadY: 114, torY: -34, falVuelo: 12, falOnda: 1.4,
           falAncho: 48, codD: [12, -14], manD: [18, -26], espAng: -2.0,
           codI: [-16, 16], manI: [-26, 30], escX: -30, escY: 12, escAng: 0.2,
           falGajos: tela(1.1, 1.1), falBorde: borde(1.1, 1.21),
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 3. LA VUELTA, primera mitad. Brazo extendido del todo, falda volando.
    pose({ incl: 0.40, cabGiro: 0.6, cadY: 109, torY: -36, falVuelo: 34, falOnda: 2.8,
           falAncho: 54, codD: [26, -2], manD: [46, -4], espAng: -0.6,
           estela: [-2.5, -0.6],
           codI: [-8, 20], manI: [-10, 40], escX: -22, escY: 20, escAng: -0.5,
           falGajos: tela(2.2, 1.35), falBorde: borde(2.2, 1.48),
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 4. LA VUELTA, segunda mitad. Sigue girando, la espada cruza abajo.
    pose({ incl: 0.34, cabGiro: 0.55, cadY: 110, torY: -35, falVuelo: 32, falOnda: 4.0,
           falAncho: 53, codD: [24, 12], manD: [42, 14], espAng: 0.5,
           estela: [-0.6, 0.5],
           codI: [-10, 20], manI: [-14, 40], escX: -26, escY: 18, escAng: -0.3,
           falGajos: tela(3.3, 1.3), falBorde: borde(3.3, 1.43),
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 5. FRENA. Le cuesta parar la vuelta: se pasa de largo.
    pose({ incl: 0.20, cabGiro: 0.3, cadY: 113, torY: -34, falVuelo: 20, falOnda: 5.2,
           falAncho: 50, codD: [19, 20], manD: [32, 34], espAng: 1.2,
           codI: [-13, 19], manI: [-21, 39], escX: -31, escY: 15,
           falGajos: tela(4.4, 0.9), falBorde: borde(4.4, 0.99),
           boca: 'apretada' }),
    // 6. RECUPERA. Vuelve a plantarse; el combo ha terminado.
    pose({ incl: 0.06, cadY: 112, torY: -33, falVuelo: 6, falOnda: 6.2, falAncho: 47,
           codD: [15, 22], manD: [24, 42], espAng: 1.3,
           falGajos: tela(5.4, 0.55), falBorde: borde(5.4, 0.60) }),
  ],

  // EMPUJON DE ESCUDO. El tercer verbo del escudo: no hace daño, pero empuja
  // y rompe la guardia. Tres fotogramas -- se echa atras, embiste, vuelve.
  // El escudo va siempre POR DELANTE (escZ), que es lo que lo hace legible.
  bash: [
    // 1. CARGA. Recoge el hombro para embestir.
    pose({ incl: -0.14, cabGiro: 0.1, cadY: 116, torY: -31, falVuelo: -8, falOnda: 0.6,
           falAncho: 46, codD: [8, 22], manD: [10, 38], espAng: 2.6,
           codI: [-8, 10], manI: [-2, 18], escX: 2, escY: -8, escAng: 0.12, escZ: 1,
           falGajos: tela(0.2, 0.5), falBorde: borde(0.2, 0.55),
           ojos: 'esfuerzo', boca: 'apretada' }),
    // 2. EMBISTE. Todo el cuerpo detras del escudo, hacia delante.
    pose({ incl: 0.30, cabGiro: 0.3, cadY: 112, torY: -34, falVuelo: 20, falOnda: 2.0,
           falAncho: 50, codD: [10, 20], manD: [14, 36], espAng: 2.4,
           codI: [2, 16], manI: [22, 22], escX: 20, escY: -4, escAng: -0.08, escZ: 1,
           falGajos: tela(1.6, 1.15), falBorde: borde(1.6, 1.27),
           ojos: 'esfuerzo', boca: 'abierta' }),
    // 3. VUELVE. Recoge el escudo a la guardia.
    pose({ incl: 0.10, cabGiro: 0.2, cadY: 115, torY: -32, falVuelo: 8, falOnda: 3.4,
           falAncho: 48, codD: [9, 21], manD: [12, 37], espAng: 2.5,
           codI: [-4, 14], manI: [8, 20], escX: 10, escY: -6, escAng: 0.06, escZ: 1,
           falGajos: tela(2.7, 0.7), falBorde: borde(2.7, 0.77),
           ojos: 'esfuerzo', boca: 'apretada' }),
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
  // LOS BRAZOS, MEDIDOS. La version anterior los tenia cruzados los dos
  // hacia el mismo lado. Los hombros estan en -15 y +15 del eje (x=64), asi
  // que manI:[10,24] ponia la mano izquierda en x=59 -- pasada el eje, en
  // mitad del pecho -- y manD:[6,40] dejaba la derecha en x=85 colgando al
  // aire. Renderizado a x2.2 se veia un amasijo de piel entre la barbilla y
  // el escudo: parecia que se abrazaba a si misma, no que se parapetaba.
  //
  // Ahora cada brazo hace UNA cosa y se nota cual:
  //   IZQUIERDO  SOSTIENE el escudo, y eso hay que medirlo: el escudo se
  //              dibuja centrado en (escX,escY) respecto al TORSO, y la mano
  //              en (hombI+manI) respecto al mismo torso, con hombI=-15. Si
  //              no se hace la cuenta quedan separados -- en la version
  //              anterior la mano caia a 31-37 px del centro del escudo, o
  //              sea FUERA de el (mide 17 de medio ancho), y el escudo se
  //              veia flotando solo delante del cuerpo. Ahora manI sale de
  //              escX + 15, asi que el puño cae siempre en el centro del
  //              escudo, tapado por el (escZ = 1), como se agarra de verdad.
  //   DERECHO    recoge la espada al costado, con la punta al SUELO. El
  //              angulo tambien hay que medirlo: la hoja mide 66 px desde el
  //              puño, asi que con espAng de 2.5-2.95 (lo que habia) la punta
  //              caia en x=37..45 -- pasado el eje del cuerpo (64), o sea la
  //              espada cruzaba la falda entera por delante y era lo primero
  //              que se veia del fotograma. Con 1.80-1.88 la punta cae en
  //              x=80..84, fuera de la silueta y bajando al suelo: el arma
  //              queda apartada, que es lo que se hace al cubrirse.
  block: [
    // 1. LEVANTA. El escudo sube al frente, la cara ya encarada.
    pose({ incl: 0.10, cabGiro: 0.15, cadY: 116, torY: -31, falOnda: 0.4,
           falAncho: 47, falAlto: 62,
           codD: [13, 20], manD: [19, 36], espAng: 1.88,
           codI: [-4, 14], manI: [21, 8],
           escX: 8, escY: 0, escAng: 0.05, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(0.2, 0.35), falBorde: borde(0.2, 0.39) }),
    // 2. PLANTADA. Postura estable: peso atras, escudo al frente, mirando.
    pose({ incl: 0.16, cabGiro: 0.25, cadY: 119, torY: -29, cabY: -26, falOnda: 1.2,
           falAncho: 49, falAlto: 59,
           codD: [14, 22], manD: [21, 38], espAng: 1.85,
           codI: [-2, 16], manI: [27, 10],
           escX: 14, escY: 2, escAng: 0, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(0.9, 0.28), falBorde: borde(0.9, 0.31) }),
    // 3. IMPACTO. El golpe la empuja: la CADERA cede y el pie de atras patina,
    // pero el escudo y la cara siguen al frente -- aguanta, no se voltea.
    // El codo izquierdo se cierra todavia mas contra el costado: es lo que
    // hace de puntal cuando el golpe llega.
    pose({ incl: 0.06, cabGiro: 0.18, cadY: 124, torY: -26, cabY: -23,
           falOnda: 2.6, falAncho: 51, falAlto: 56, falVuelo: -12,
           codD: [15, 24], manD: [23, 40], espAng: 1.80,
           codI: [0, 18], manI: [32, 12],
           escX: 19, escY: 4, escAng: -0.12, escZ: 1,
           ojos: 'esfuerzo', boca: 'abierta',
           falGajos: tela(2.4, 0.85), falBorde: borde(2.4, 0.94) }),
    // 4. SE REHACE. Vuelve a plantarse tras aguantar el golpe.
    pose({ incl: 0.14, cabGiro: 0.22, cadY: 120, torY: -28, cabY: -25,
           falOnda: 3.8, falAncho: 49, falAlto: 58,
           codD: [14, 22], manD: [21, 38], espAng: 1.86,
           codI: [-2, 16], manI: [28, 10],
           escX: 15, escY: 2, escAng: 0.04, escZ: 1,
           ojos: 'esfuerzo', boca: 'apretada',
           falGajos: tela(3.6, 0.4), falBorde: borde(3.6, 0.44) }),
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
           ojos: 'dolor', boca: 'abierta',
           falGajos: tela(3.0, 0.9), falBorde: borde(3.0, 0.99) }),
    // 2. ARQUEADA. Lo peor del dolor: se dobla sobre si misma y retrocede.
    pose({ incl: -0.48, cabGiro: -0.7, cabY: -26, torY: -28, cadY: 118,
           falVuelo: -22, falOnda: 4.4, falAncho: 44,
           codD: [6, 10], manD: [8, 18], espAng: 2.9,
           codI: [-20, 8], manI: [-34, 14], escX: -42, escY: 8, escAng: 1.0,
           ojos: 'dolor', boca: 'abierta',
           falGajos: tela(4.2, 1.15), falBorde: borde(4.2, 1.26) }),
    // 3. SE RECOMPONE. Vuelve a levantar la guardia, aun dolorida.
    pose({ incl: -0.16, cabGiro: -0.3, cabY: -28, torY: -32, cadY: 114,
           falVuelo: -6, falOnda: 5.4,
           codD: [12, 14], manD: [18, 26], espAng: 2.0,
           codI: [-16, 14], manI: [-26, 26], escX: -36, escY: 8, escAng: 0.5,
           ojos: 'dolor', boca: 'apretada',
           falGajos: tela(5.3, 0.6), falBorde: borde(5.3, 0.66) }),
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
