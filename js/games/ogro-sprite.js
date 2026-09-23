// EL OGRO - como se DIBUJA.
//
// Los fotogramas son de un pack PINTADO A MANO (CraftPix, ver
// tools/ogro-atlas.py). Este modulo no dibuja ni un pixel del ogro: decide
// QUE fotograma toca en cada instante y lo pone en su sitio.
//
// POR QUE SE CAMBIO EL OGRO DE CODIGO POR UNO DIBUJADO: el de antes era una
// pose de ~20 numeros sobre piezas rigidas. En la carga y en el garrotazo el
// cuerpo era EL MISMO y solo giraba el brazo, y por muchas rondas de ajuste
// seguia pareciendo un muñeco de carton. Un ataque de verdad redibuja el
// cuerpo entero -- se agacha, se retuerce, el garrote sube por encima de la
// cabeza --, y eso es trabajo de un animador.
//
// LA FISICA NO SE TOCA. Los tiempos de cada ataque siguen en ogro-cuerpo.js
// (carga, parte activa, ciclo) y estan medidos contra la parada y la rodada de
// ella. Los guiones de aqui se AJUSTAN a esos tiempos, no al reves: cada paso
// dice en que FASE acaba y en que fraccion de ella, asi que si un dia cambia
// la carga del garrote, los fotogramas se reparten solos.

import { FRAMES } from './ogro-atlas.js';
import * as OG from './ogro-cuerpo.js';

// ---------- La hoja ----------
// Se pide al importar el modulo, no al entrar en la pelea: para cuando ella
// llega al campo ya esta descodificada.
const HOJA = new Image();
HOJA.src = new URL('../../img/ogro.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
// Para las vistas previas de tools/, que dibujan una sola vez y no pueden
// esperar al siguiente fotograma como el juego. Espera al evento 'load' y NO a
// decode(): tools/ver.js corre con reloj virtual, que espera a las descargas
// pendientes pero no a una descodificacion en otro hilo, y con decode() la
// captura salia en blanco.
export function cargaOgro() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// ---------- Paleta ----------
// Para lo que la escena pinta del ogro sin ser el ogro: su barra de vida, las
// ondas del pisoton, la sangre. Sacada de la hoja (los verdes mas usados),
// para que todo sea del mismo bicho.
export const P = {
  pie1: '#304017',   // piel en sombra
  pie2: '#5c7337',   // piel
  pie3: '#84a64c',   // piel al sol
  pie4: '#b8dd78',   // el brillo de la piel
  mad:  '#6c450b',   // la madera del garrote
  ojo:  '#ffd24a',   // el rugido: chispas calidas
  dien: '#f2e8c4',
};

// ---------- Los guiones de los ataques ----------
// Cada paso: [animacion, fotograma, fase en la que ACABA, fraccion de la fase].
// Las fases salen de ATAQUES: CARGA hasta activa0, GOLPE hasta activa1,
// VUELTA hasta el ciclo.
const CARGA = 0, GOLPE = 1, VUELTA = 2;

const GUIONES = [];

// GARROTE -- el que se PARA. El aviso es el garrote subiendo por encima de la
// cabeza, y el fotograma que MAS se aguanta es el 3: el garrote atras del
// todo, el cuerpo enroscado. Cae justo en la ventana en que ella tiene que
// levantar la guardia (pulsar entre 0.15 y 0.30 s para que la parada llegue a
// los 0.42), asi que lo que se ve es lo que hay que leer.
GUIONES[OG.GARROTE] = [
  ['garrote', 0, CARGA, 0.12],
  ['garrote', 1, CARGA, 0.28],
  ['garrote', 2, CARGA, 0.48],
  ['garrote', 3, CARGA, 0.86],
  ['garrote', 4, CARGA, 1],
  ['garrote', 5, GOLPE, 0.5],      // EL IMPACTO: de en alto a delante en un fotograma
  ['garrote', 6, GOLPE, 1],
  ['garrote', 7, VUELTA, 0.3],
  ['garrote', 8, VUELTA, 0.65],
  ['garrote', 9, VUELTA, 1],
];

// PISOTON -- el que se SALTA. Es el salto del pack: se agacha, se levanta del
// suelo con el garrote en alto y ATERRIZA golpeando el suelo. El aterrizaje
// (fotograma 6) cae exactamente en activa0, que es cuando nacen las ondas:
// si cayera antes o despues, la onda saldria de un ogro que aun esta en el
// aire o que ya se esta levantando.
GUIONES[OG.PISOTON] = [
  ['salto', 0, CARGA, 0.1],
  ['salto', 1, CARGA, 0.42],       // agachado: el aviso de que va a saltar
  ['salto', 2, CARGA, 0.55],
  ['salto', 3, CARGA, 0.7],
  ['salto', 4, CARGA, 0.84],
  ['salto', 5, CARGA, 1],
  ['salto', 6, GOLPE, 1],          // cae y golpea: nacen las ondas
  ['salto', 7, VUELTA, 0.25],
  ['salto', 8, VUELTA, 0.6],
  ['salto', 9, VUELTA, 1],
];

// BARRIDO -- el que se ESQUIVA. Su aviso tiene que ser DISTINTO del garrote de
// un vistazo: alli el garrote sube; aqui APUNTA con el garrote en horizontal,
// a la altura del pecho, se echa atras y sale en ESTOCADA. Vertical contra
// horizontal es lo que se distingue antes, incluso con el rabillo del ojo. Y
// una estocada a la altura del pecho no se salta: se pasa por debajo rodando.
GUIONES[OG.BARRIDO] = [
  ['garrote', 0, CARGA, 0.12],
  ['dolor', 1, CARGA, 1],          // echado atras, garrote en horizontal
  ['garrote', 5, GOLPE, 0.5],
  ['garrote', 6, GOLPE, 1],
  ['garrote', 7, VUELTA, 0.35],
  ['garrote', 8, VUELTA, 0.7],
  ['garrote', 9, VUELTA, 1],
];

// EMBESTIDA: no va en tabla. Corre en el sitio mientras carga (escarba, como
// un toro) y luego corre de verdad: es un ciclo, no una secuencia.

// ---------- Velocidades de los ciclos ----------
// ANDAR: medido en la hoja, el pie apoyado retrocede ~13 px por fotograma.
// Para que no patine a 120 px/s el paso va a 120/13 = 9 fotogramas por
// segundo, y en furia sube en proporcion. Un pie que resbala sobre el suelo
// es lo primero que delata a un personaje pegado encima del fondo.
const PASO_PX = 13;
const ESPERA_FPS = 10;
const CORRE_FPS = 16;

// ---------- Que toca ahora ----------
// Devuelve la POSE: animacion, fotograma y los retoques que se hacen al
// dibujar (desplazamiento, aplastamiento, temblor, estela).
export function poseOgro(O) {
  const po = { a: 'espera', f: 0, dx: 0, dy: 0, sy: 1, estela: null, estrellas: 0 };

  if (O.st === OG.MUERTO) {
    // Se tambalea y cae de bruces: 1.05 s, y se queda en el suelo.
    po.a = 'muere';
    po.f = Math.min(FRAMES.muere.length - 1, Math.floor(O.t / 0.15));
    return po;
  }

  if (O.st === OG.RUGE) {
    // El rugido: abre los brazos con el garrote en alto y TIEMBLA. Es la pose
    // del salto con los brazos abiertos, pero con los pies en el suelo.
    po.a = 'salto';
    const dentro = O.t > 0.12 && O.t < OG.RUGE_T - 0.12;
    po.f = dentro ? 4 : 3;
    po.dy = alSuelo(FRAMES.salto[po.f]);
    if (dentro) po.dx = ((O.t * 30) | 0) & 1 ? 1 : -1;
    return po;
  }

  if (O.st === OG.DOLOR) {
    // Le entra un tajo: encaja hacia atras en los 0.24 s que dura.
    po.a = 'dolor';
    po.f = O.t < 0.03 ? 0 : O.t < 0.10 ? 1 : O.t < 0.17 ? 2 : 3;
    return po;
  }

  if (O.st === OG.ABIERTO) {
    // Cada motivo se ve distinto (ver OG.POR_*).
    const por = O.abiertoPor;
    po.a = 'dolor';
    if (por === OG.POR_PARED) {
      // Contra la pared: rebota y se queda ATURDIDO, bamboleandose con las
      // estrellas encima. Es el castigo grande (1.25 s) y tiene que parecerlo.
      if (O.t < 0.06) po.f = 1;
      else if (O.t < O.abiertoT - 0.2) { po.f = 3 + (((O.t * 4) | 0) & 1); po.estrellas = O.t; }
      else po.f = 5;
      return po;
    }
    if (por === OG.POR_PARADA) {
      // Le han parado el garrote: rebota de la espada, se le va el cuerpo atras.
      po.f = O.t < 0.06 ? 1 : O.t < 0.16 ? 2 : O.t < 0.34 ? 3 : O.t < 0.45 ? 4 : 5;
      return po;
    }
    // Despues de un ataque: JADEA. La parte baja de la respiracion (del 3 al
    // 5) al doble de velocidad: es el mismo cuerpo que en reposo, pero cansado.
    po.a = 'espera';
    po.f = [3, 4, 5, 4][((O.t * 12) | 0) % 4];
    return po;
  }

  if (O.st === OG.ATACA && O.atk >= 0) {
    const [ciclo, a0, a1] = OG.ATAQUES[O.atk];
    const t = O.atkT;
    if (O.atk === OG.EMBESTIDA) {
      po.a = 'corre';
      const n = FRAMES.corre.length;
      if (t < a0) {
        // ESCARBA: corre en el sitio, cada vez mas rapido. El aviso del toro.
        const u = t / a0;
        po.f = Math.floor(t * CORRE_FPS * (0.6 + 0.6 * u)) % n;
        po.dx = -6 * u;                       // se echa atras para arrancar
      } else if (t < a1) {
        po.f = Math.floor((t - a0) * CORRE_FPS * 1.2) % n;
      } else {
        // Frena sin haber chocado: vuelve al paso.
        po.a = 'anda';
        po.f = Math.floor((t - a1) * 12) % FRAMES.anda.length;
      }
      return po;
    }
    const g = GUIONES[O.atk];
    const fin = [a0, a1, ciclo];
    const ini = [0, a0, a1];
    for (const [a, f, fase, u] of g) {
      const hasta = ini[fase] + (fin[fase] - ini[fase]) * u;
      if (t < hasta || (fase === VUELTA && u === 1)) { po.a = a; po.f = f; break; }
    }
    // LA ESTELA: el garrote pasa de estar en alto a estar delante en UN
    // fotograma. Sin nada entre medias, el ojo no ve un golpe: ve un salto.
    // La media luna rellena ese hueco durante la parte activa, igual que el
    // arco del tajo de ella.
    const u = (t - a0) / (a1 - a0 + 0.05);
    if (O.atk === OG.GARROTE && u >= 0 && u < 1) po.estela = { tipo: 'arco', u };
    if (O.atk === OG.BARRIDO) {
      if (t < a0) {
        // Se echa atras para tomar impulso, cada vez mas: la estocada sale
        // de mas lejos y por eso se ve venir.
        const k = t / a0;
        po.dx = -22 * k * k;
        po.sy = 1 - 0.04 * k;
      } else if (u < 1) {
        po.dx = -22 * Math.max(0, 1 - u * 3);
        po.estela = { tipo: 'estocada', u };
      }
    }
    return po;
  }

  if (O.st === OG.ANDA) {
    const v = Math.abs(O.vx) || OG.VEL;
    po.a = 'anda';
    po.f = Math.floor(O.animT * v / PASO_PX) % FRAMES.anda.length;
    return po;
  }

  // ESPERA: respira. El reposo del pack es de IDA Y VUELTA y solo se hornea
  // la ida (del 0 al 5): la vuelta se hace aqui.
  const n = FRAMES.espera.length;
  const k = Math.floor(O.animT * ESPERA_FPS) % (2 * n - 2);
  po.f = k < n ? k : 2 * n - 2 - k;
  return po;
}

// Cada pisada del ogro al andar: un numero que sube en cada una (el paso cae
// en los fotogramas 2 y 7 del ciclo). La escena hace temblar el suelo cuando
// cambia, y asi el temblor va con el pie y no con un reloj aparte.
export function pisadaOgro(O) {
  const v = Math.abs(O.vx) || OG.VEL;
  return Math.floor((O.animT * v / PASO_PX - 2) / 5);
}

// Cuanto hay que bajar un fotograma del salto para que apoye en el suelo.
function alSuelo(fr) { return -(fr[5] + fr[3] - 1); }

// A que altura del suelo esta lo mas bajo del ogro en esta pose: 0 si apoya.
// Es para la sombra, que se encoge cuando el pisoton lo levanta del suelo.
export function vueloOgro(po) {
  return Math.max(0, alSuelo(FRAMES[po.a][po.f]) - po.dy);
}

// ---------- Dibujar ----------
// El estado horneado es solo un lienzo pequeño para TEÑIR un fotograma (el
// destello blanco al recibir): se pinta el fotograma, se tiñe con
// 'source-atop' y se vuelca. Teñir la hoja entera costaria otra hoja de 20 MB
// en memoria para un efecto que dura una decima de segundo.
export function bakeOgro() {
  return { tinte: document.createElement('canvas') };
}

// Dibuja al ogro con la RAIZ (entre los pies) en (x, y). `flash` va de 0 a 1:
// el destello blanco del golpe que le entra.
export function drawOgro(g, S, x, y, dir, po, flash = 0) {
  if (!lista()) return;
  const [sx, sy, w, h, ox, oy] = FRAMES[po.a][po.f];
  const px = Math.round(x + po.dx * dir), py = Math.round(y + po.dy);
  g.save();
  g.translate(px, py);
  if (dir < 0) g.scale(-1, 1);
  if (po.sy !== 1) g.scale(1, po.sy);
  g.drawImage(HOJA, sx, sy, w, h, ox, oy, w, h);
  if (flash > 0) {
    const c = S.tinte;
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    const t = c.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, w, h);
    t.drawImage(HOJA, sx, sy, w, h, 0, 0, w, h);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = '#ffffff';
    t.fillRect(0, 0, w, h);
    g.globalAlpha = Math.min(1, flash);
    g.drawImage(c, 0, 0, w, h, ox, oy, w, h);
    g.globalAlpha = 1;
  }
  if (po.estela) estela(g, po.estela);
  g.restore();
  if (po.estrellas) estrellas(g, px, py - 205, po.estrellas);
}

// LAS ESTELAS, en coordenadas de la raiz y mirando a la derecha (el espejo ya
// esta puesto). Medidas sobre los fotogramas: el hombro del garrote cae en
// (40, -170); con el garrote en alto la punta esta a (-27, -395) y en el
// fotograma del golpe a (295, -193). Las dos a ~230 px del hombro, asi que
// el arco es un circulo de ese radio.
const HOMBRO_X = 40, HOMBRO_Y = -170;
function estela(g, e) {
  if (e.tipo === 'arco') {
    // Al empezar cubre todo el recorrido, de en alto (-1.86 rad) a delante
    // (-0.09); luego la cola alcanza a la cabeza y se apaga. Tres cintas como
    // las del tajo de ella, pero en madera y hueso, no en acero.
    const cabeza = -0.09 + 0.55 * e.u, cola = -1.86 + 1.75 * e.u;
    if (cola >= cabeza) return;
    for (const [r0, r1, col, al] of [[196, 262, '#b89a5a', 0.28],
                                     [214, 250, '#efe2b4', 0.5],
                                     [228, 238, '#fffbe8', 0.9]]) {
      g.globalAlpha = al * (1 - e.u);
      g.fillStyle = col;
      g.beginPath();
      g.arc(HOMBRO_X, HOMBRO_Y, r1, cola, cabeza);
      g.arc(HOMBRO_X, HOMBRO_Y, r0, cabeza, cola, true);
      g.closePath(); g.fill();
    }
  } else {
    // ESTOCADA: rayas horizontales por detras del garrote, que se acortan
    // hacia la punta. Es lo que dice "va en linea recta" y no "cae".
    for (const [y, x0, x1, col] of [[-196, 40, 250, '#efe2b4'],
                                    [-176, 10, 290, '#fffbe8'],
                                    [-156, 50, 230, '#efe2b4']]) {
      const xa = x0 + (x1 - x0) * e.u * 0.7;
      g.globalAlpha = 0.8 * (1 - e.u);
      g.fillStyle = col;
      g.fillRect(Math.round(xa), y, Math.round(x1 - xa), 3);
    }
  }
  g.globalAlpha = 1;
}

// Las estrellas del aturdido: tres destellos de oro girando sobre la cabeza.
function estrellas(g, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * 2.094;
    const ex = Math.round(x + Math.cos(a) * 34), ey = Math.round(y + Math.sin(a) * 9);
    g.fillStyle = '#ffd24a';
    g.fillRect(ex - 1, ey - 4, 3, 9);
    g.fillRect(ex - 4, ey - 1, 9, 3);
    g.fillStyle = '#fff6c8';
    g.fillRect(ex - 1, ey - 1, 3, 3);
  }
}
