// ROMINA - como se dibuja una pose.
//
// Una POSE son unos veinte numeros (donde esta la cadera, cuanto se inclina el
// torso, donde caen las manos, cuanto vuela la falda...). Con ellos se compone
// el dibujo entero, de atras hacia adelante, como se pinta de verdad: primero
// el pelo de detras, luego la falda, el cuerpo, los brazos, y al final la cara
// y la corona.
//
// Dibujar un fotograma nuevo es escribir una pose nueva, no teclear 23.000
// celdas. Y cada fotograma sigue siendo un dibujo ENTERO distinto.

import { W, H, P, makeLienzo, elipse, poly, linea, curva, contorno, aCanvas } from './romi-art.js';
import { dibujaEspada, dibujaEscudo, ESP_LARGO } from './romi-armas.js';

// La pose de reposo. Todo en celdas del lienzo de 128x180, con los pies en
// y=176 y el eje del cuerpo en x=64.
export const BASE = {
  cadX: 64, cadY: 112,      // la cadera: el centro de todo
  torX: 0, torY: -34,       // el torso, respecto a la cadera
  incl: 0,                  // inclinacion del torso, en radianes
  cabX: 0, cabY: -28,       // la cabeza, respecto al torso
  cabGiro: 0,               // giro de la cabeza
  falAncho: 46,             // medio ancho de la falda abajo
  falAlto: 64,              // cuanto baja la falda desde la cadera
  falVuelo: 0,              // cuanto se abre hacia atras (al correr o saltar)
  falOnda: 0,               // desfase del borde ondulado
  // Los SIETE GAJOS de la falda. Es lo que sustituye a las piernas: cada gajo
  // se mueve por su cuenta y con retardo respecto al vecino, que es lo que
  // hace que la tela se lea como tela. El indice 0 es el gajo de ATRAS y el 6
  // el de DELANTE.
  //   falGajos[i]  -1..1  cuanto se va ese gajo hacia atras
  //   falBorde[i]  -1..1  cuanto sube (-) o baja (+) el bajo de ese gajo
  falGajos: null,
  falBorde: null,
  hombD: 15, hombI: -15,    // los hombros
  // Los brazos: codo y mano, respecto al hombro
  // El codo y la mano, respecto al hombro. Medido en el render: con la mano a
  // (24,40) desde un hombro alto, las manos tapaban las mejillas.
  codD: [13, 22], manD: [21, 44],
  codI: [-13, 22], manI: [-21, 44],
  piernaD: 0, piernaI: 0,   // cuanto adelanta cada pie (0 = juntos bajo la falda)
  esp: 1,                   // 1 = espada visible, 0 = escondida
  espAng: 1.2,              // angulo de la espada
  estela: null,             // [angDesde, angHasta] : el barrido de la hoja
  escAng: 0,                // angulo del escudo
  escX: -34, escY: 16,      // el escudo, en el antebrazo izquierdo
  escZ: 0,                  // 1 = el escudo va DELANTE del cuerpo (bloquear)
  ojos: 'normal',           // normal | cerrados | esfuerzo | dolor
  boca: 'sonrisa',          // sonrisa | abierta | apretada
};

export function pose(cambios) { return Object.assign({}, BASE, cambios); }

// ---------- El dibujo ----------
export function dibujaPose(p) {
  const L = makeLienzo();
  const cad = [p.cadX, p.cadY];
  const tor = [cad[0] + p.torX, cad[1] + p.torY];
  const cab = [tor[0] + p.cabX + Math.sin(p.incl) * 20, tor[1] + p.cabY];

  // === 1. El pelo de DETRAS: una masa ancha que cae por la espalda ===
  // Cae por DETRAS: estrecho a la altura de la cara (no la tapa) y se ensancha
  // a media espalda. Antes salia igual de ancho arriba que abajo y se comia la
  // cara y los hombros, como un casco marron.
  const pelAtras = [];
  // MEDIA MELENA: acaba en el hombro (34 px por debajo de la cara), no en la
  // cintura. Se ensancha un poco a la altura de la mandibula y se recoge al
  // final, que es como cae un pelo liso cortado a esa altura.
  const LARGO = 34;
  const anchoPelo = t => 20 + Math.sin(t * 2.2) * 4 - t * t * 5;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pelAtras.push(cab[0] - anchoPelo(t) - p.cabGiro * 6, cab[1] - 14 + t * LARGO);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pelAtras.push(cab[0] + anchoPelo(t) - p.cabGiro * 6, cab[1] - 14 + t * LARGO);
  }
  poly(L, pelAtras, P.pel2);
  // El pelo en SOMBRA por el lado de dentro: sin esto la melena es una mancha
  // plana. La luz viene de la derecha, asi que el lado izquierdo se oscurece.
  const pelSombra = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pelSombra.push(cab[0] - anchoPelo(t) - p.cabGiro * 6, cab[1] - 14 + t * LARGO);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pelSombra.push(cab[0] - anchoPelo(t) * 0.35 - p.cabGiro * 6, cab[1] - 14 + t * LARGO);
  }
  poly(L, pelSombra, P.pel1);
  // Mechones sueltos que salen de la masa
  for (const [dx, dy, cx, cy, ex, ey, g] of [
    [-16, 0, -22, 12, -19, 24, 8],
    [16, 0, 22, 11, 20, 22, 8],
    [-10, 8, -20, 20, -15, 30, 5],
    [12, 9, 21, 21, 17, 29, 5],
  ]) curva(L, cab[0] + dx, cab[1] + dy, cab[0] + cx, cab[1] + cy, cab[0] + ex, cab[1] + ey, g, g * 0.5, P.pel1);
  // BRILLO del pelo: la banda clara que recorre la melena por el lado de la
  // luz. Es LO que hace que un pelo negro se lea como pelo y no como un
  // agujero -- y pel4 estaba definido en la paleta pero no se usaba en ningun
  // sitio. Va en dos trazos rotos, como se pinta un reflejo en pixel art.
  for (const [t0, t1, gr] of [[0.12, 0.42, 4], [0.54, 0.80, 3]]) {
    const y0 = cab[1] - 14 + t0 * LARGO, y1 = cab[1] - 14 + t1 * LARGO;
    const x0 = cab[0] + anchoPelo(t0) * 0.62 - p.cabGiro * 6;
    const x1 = cab[0] + anchoPelo(t1) * 0.58 - p.cabGiro * 6;
    curva(L, x0, y0, (x0 + x1) / 2 + 2, (y0 + y1) / 2, x1, y1, gr, gr * 0.6, P.pel4);
  }

  // === 2. La FALDA, por GAJOS ===
  //
  // NO HAY PIES. El vestido llega al suelo y es lo UNICO que se mueve: no hay
  // piernas, ni botas, ni tobillos. Una princesa con falda larga no ensena los
  // pies al andar, y los que habia (dos botas marrones asomando) se veian como
  // dos piedras deslizandose. Todo el movimiento lo lleva la tela.
  //
  // Para eso la falda deja de ser UN poligono rigido con cuatro numeros y pasa
  // a ser SIETE GAJOS verticales independientes. Cada gajo tiene su propio
  // desplazamiento, y se mueven con RETARDO de uno a otro: cuando ella arranca,
  // el gajo de delante sale primero y el de atras llega tarde. Eso es lo que
  // hace que la tela parezca tela y no un cono pintado.
  //
  // p.falGajos es un array de 7 numeros (-1..1): cuanto se desplaza cada gajo
  // hacia atras. p.falBorde son 7 numeros mas: cuanto sube o baja el bajo de
  // cada gajo, que es lo que hace ondear el borde.
  const fy0 = cad[1] - 6, fy1 = cad[1] + p.falAlto;
  const vuelo = p.falVuelo;
  // EL ARRANQUE DE LA FALDA. A0 es el medio ancho con el que sale de la
  // cintura. Estaba en 17 -- el MISMO que aCadera del corpino -- y con la
  // apertura en t*t*t (que para t pequeña es casi plana) el perfil medido
  // fila a fila daba esto: y92 talle 25 px, y106 ya 37 px, y de y106 a y116
  // ONCE FILAS CLAVADAS EN 37. Un tubo del ancho de la cadera metido bajo el
  // cinturon, y el salto de 25 a 37 en catorce filas se veia como un escalon
  // justo donde ella es mas estrecha.
  //
  // Ahora sale en 13 (pegada al talle, que es 11) y se abre desde el primer
  // momento: t*t da pendiente ya en t pequeña, y el termino lineal reparte
  // los primeros pixeles. Asi la cadera se LEE, que es lo que faltaba entre
  // el torax y la falda.
  const A0 = 13;
  const NG = 7;                          // gajos
  const gj = p.falGajos || new Array(NG).fill(0);
  const gb = p.falBorde || new Array(NG).fill(0);

  // El bajo de la falda, gajo a gajo. Se calcula primero porque lo usan la
  // silueta, la cenefa y el forro: asi los tres coinciden SIEMPRE, que era un
  // fallo latente (se recalculaba la onda tres veces con formulas distintas).
  const bajo = [];
  for (let i = 0; i <= NG; i++) {
    const u = i / NG;                    // 0 = atras del todo, 1 = delante
    const g = gj[Math.min(NG - 1, i)] || 0;
    const b = gb[Math.min(NG - 1, i)] || 0;
    // ancho base + el vuelo general + lo que este gajo se ha ido hacia atras
    const x = cad[0] - p.falAncho - vuelo + u * (p.falAncho * 2 + vuelo * 1.3);
    bajo.push([x - g * 9, fy1 + Math.sin(u * 9 + p.falOnda) * 4 + b * 5]);
  }

  // El medio ancho de la falda a la altura t (0 = cintura, 1 = el bajo).
  // La cadera se abre PRONTO (el termino en t, que domina al principio) y la
  // campana llega despues (el termino en t*t*t). Con la formula anterior
  // -- t*t*t + t*4 desde A0=17 -- los primeros 20 px de falda salian planos.
  const anchoFalda = t =>
    A0 + t * 9 + t * t * 5 + t * t * t * (p.falAncho - A0 - 14);

  // --- La silueta: de la cadera al bajo, pasando por cada gajo ---
  const falda = [];
  const NB = 12;
  // lado de atras (izquierda), de arriba a abajo
  for (let i = 0; i <= NB; i++) {
    const t = i / NB;
    const y = fy0 + t * p.falAlto;
    const an = anchoFalda(t);
    falda.push(cad[0] - an - vuelo * t * t - (gj[0] || 0) * 9 * t * t, y);
  }
  // el bajo, gajo a gajo
  for (const [bx, by] of bajo) falda.push(bx, by);
  // lado de delante (derecha), de abajo a arriba
  for (let i = NB; i >= 0; i--) {
    const t = i / NB;
    const y = fy0 + t * p.falAlto;
    const an = anchoFalda(t);
    falda.push(cad[0] + an + vuelo * 0.3 * t * t - (gj[NG - 1] || 0) * 4 * t * t, y);
  }
  poly(L, falda, P.ves2);

  // --- Los PLIEGUES: la linea de sombra entre gajo y gajo ---
  // Es lo que hace que se vea CUAL gajo se ha movido. Sin esto la falda es una
  // mancha y da igual cuanto la deformes: no se nota que haya tela dentro.
  for (let i = 1; i < NG; i++) {
    const u = i / NG;
    const [bx, by] = bajo[i];
    const xTop = cad[0] + (u - 0.5) * 2 * A0 * 0.8;
    const g = gj[i] || 0;
    // El pliegue se curva: sale recto de la cadera y se abre al llegar al bajo
    const col = g > 0.15 ? P.ves1 : g < -0.15 ? P.ves3 : P.ves1;
    curva(L, xTop, fy0 + 6, (xTop + bx) / 2 - g * 4, fy0 + p.falAlto * 0.55,
             bx, by - 3, 1.6, 2.6, col);
  }

  // --- Brillo del vestido, en el lado de la luz (delante) ---
  for (let i = 0; i < 3; i++) {
    const idx = NG - 1 - i;
    const [bx, by] = bajo[Math.max(0, idx)];
    curva(L, cad[0] + 11, fy0 + 9,
             cad[0] + 22 + i * 4, fy0 + p.falAlto * 0.5,
             bx - 4, by - 8, 4 - i, 2, P.ves3);
  }

  // --- (AQUI IBA LA ENAGUA) ---
  // Habia una enagua clara (fal2) que asomaba por el bajo en cuanto
  // falVuelo pasaba de 6. Fuera, y por dos medidas:
  //
  // 1. Se veia como una MANCHA, no como una enagua. Renderizada a x2.2 era
  //    un triangulo rosa palido de 780 celdas en mitad del bajo, con forma
  //    de montaña: no se leia como tela de debajo, se leia como un agujero
  //    claro en el vestido.
  // 2. PARPADEABA. En idle el vuelo es 0, asi que no existia (0 celdas
  //    medidas); al arrancar a correr aparecia de golpe y al parar
  //    desaparecia. Un trozo de ropa no aparece y desaparece al andar.
  //
  // Lo que hacia falta ahi no era otra prenda, sino que el propio vestido
  // tuviera hondo: eso lo dan los pliegues de abajo, que SI estan siempre y
  // se hacen mas hondos cuanto mas vuela la tela.
  // OJO: el primer intento de estos pliegues salia de un punto casi comun a
  // media falda, y los siete radiaban desde ahi hasta el bajo: a x2.2 se veia
  // un ABANICO de varillas en mitad del vestido, mas llamativo que la enagua
  // que habia quitado. Un pliegue de tela no nace de un punto -- nace ARRIBA,
  // repartido a lo ancho de la cadera, y BAJA casi vertical siguiendo su
  // gajo. Asi que ahora arrancan separados (cada uno sobre su gajo), no se
  // cruzan, y son finos: solo tienen que dar hondo, no dibujarse.
  {
    const hondo = Math.min(1, Math.abs(vuelo) / 24);
    for (let i = 1; i < NG; i++) {
      const [bx, by] = bajo[i];
      const u = i / NG;
      // arriba: repartido a lo ancho de la cadera, cada pliegue en su sitio
      const xTop = cad[0] + (u - 0.5) * 2 * (A0 + 4);
      // baja siguiendo su gajo, sin cortar a los vecinos
      const xm = xTop + (bx - xTop) * 0.5;
      curva(L, xTop, fy0 + p.falAlto * 0.32,
               xm, fy0 + p.falAlto * 0.66,
               bx * 0.88 + cad[0] * 0.12, by - 7,
               0.9 + hondo * 0.5, 1.4 + hondo * 1.1, P.ves1);
    }
  }

  // --- CENEFA de oro y FORRO blanco, sobre el bajo ya calculado ---
  // Los tres (silueta, cenefa, forro) usan el MISMO array `bajo`, asi que no
  // pueden desalinearse. Antes cada uno recalculaba la onda por su cuenta.
  for (let i = 0; i < bajo.length - 1; i++) {
    const [x0, y0] = bajo[i], [x1, y1] = bajo[i + 1];
    const N = Math.max(3, Math.round(Math.abs(x1 - x0) / 2));
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      elipse(L, x, y - 7, 3, 2, P.oro2);
      if ((i * N + k) % 5 === 0) elipse(L, x, y - 7, 2, 2.5, P.oro3);
      elipse(L, x, y - 1, 4, 3.5, P.bla2);
      elipse(L, x, y + 2, 4, 2.5, P.bla1);
    }
  }

  // === 3. (NO HAY PIERNAS) ===
  // Aqui se dibujaban dos botas asomando por el bajo. Fuera: el vestido llega
  // al suelo y todo el movimiento lo llevan los gajos de la falda. Es lo que
  // hace una princesa con falda larga, y ademas evita el problema de origen --
  // un pie de 8 px de ancho no tiene celdas para leerse como un pie.

  // === 4. El TORSO: corpino con CINTURA ===
  // El talle es lo que faltaba. Antes el corpino era un trapecio de 19 a 15 y
  // la falda arrancaba en 13, con 13 px de nada en medio: se leia como un torax
  // posado encima de una cadera, sin union. Ahora el contorno del cuerpo pasa
  // por CUATRO anchos -- pecho 19, talle 11, cadera 17 -- y el vientre se
  // dibuja hasta enganchar con la falda, sin hueco.
  const th = 34;
  const sx = Math.sin(p.incl) * 8;                  // desplazamiento por inclinarse
  const yPecho = tor[1] - th * 0.5;                 // arriba del corpino
  const yTalle = tor[1] + th * 0.5 - 1;             // la cintura: lo mas estrecho
  const yCad   = cad[1] - 2;                        // donde engancha la falda
  // aCadera tiene que CASAR con A0, el arranque de la falda (13): el vientre
  // acaba justo donde la tela empieza. Estaba en 17 y sobresalia 4 px por
  // fuera de la falda a cada lado, lo que ensanchaba la cadera por debajo del
  // cinturon y remataba el escalon.
  const aPecho = 19, aTalle = 11, aCadera = 14;
  // El contorno, con el talle metido: un reloj de arena suave. Los vertices
  // van en orden (lado derecho hacia abajo, lado izquierdo hacia arriba).
  const cuerpo = [
    tor[0] - aPecho + sx, yPecho,
    tor[0] + aPecho + sx, yPecho,
    tor[0] + (aPecho - 3) + sx * 0.7, yPecho + th * 0.34,
    tor[0] + aTalle + sx * 0.3, yTalle,
    cad[0] + aCadera, yCad,
    cad[0] - aCadera, yCad,
    tor[0] - aTalle + sx * 0.3, yTalle,
    tor[0] - (aPecho - 3) + sx * 0.7, yPecho + th * 0.34,
  ];
  poly(L, cuerpo, P.ves2);
  // Sombra a la izquierda y brillo a la derecha, siguiendo la MISMA curva:
  // es lo que hace que se lea como un volumen y no como una plancha.
  poly(L, [tor[0] - aPecho + sx, yPecho,
           tor[0] - aPecho + 7 + sx, yPecho,
           tor[0] - aTalle + 4 + sx * 0.3, yTalle,
           cad[0] - aCadera + 5, yCad,
           cad[0] - aCadera, yCad,
           tor[0] - aTalle + sx * 0.3, yTalle,
           tor[0] - (aPecho - 3) + sx * 0.7, yPecho + th * 0.34], P.ves1);
  poly(L, [tor[0] + aPecho - 8 + sx, yPecho,
           tor[0] + aPecho + sx, yPecho,
           tor[0] + (aPecho - 3) + sx * 0.7, yPecho + th * 0.34,
           tor[0] + aTalle + sx * 0.3, yTalle,
           cad[0] + aCadera, yCad,
           cad[0] + aCadera - 6, yCad,
           tor[0] + aTalle - 5 + sx * 0.3, yTalle], P.ves3);
  // Las dos costuras del corpino, que marcan el talle aunque la silueta sea
  // pequeña en pantalla. En los vestidos de las referencias son lo que da la
  // sensacion de cuerpo ajustado.
  for (const s of [-1, 1]) {
    curva(L, tor[0] + s * 12 + sx, yPecho + 3,
             tor[0] + s * 7.5 + sx * 0.4, tor[1] + 6,
             tor[0] + s * 9, yTalle - 1, 2, 2, P.ves1);
  }
  // El escote y el cuello
  elipse(L, tor[0] + sx, yPecho + 1, 11, 5, P.piel2);
  linea(L, cab[0], cab[1] + 12, tor[0] + sx * 0.75, yPecho + 2, 11, P.piel2);
  // RIBETE DE ORO en el escote. Sus referencias lo tienen y es lo que separa
  // un vestido de una camiseta rosa: el borde del corpino rematado en oro.
  for (let i = -1; i <= 1; i += 2) {
    curva(L, tor[0] + sx + i * 11, yPecho + 2,
             tor[0] + sx + i * 16, yPecho + 1,
             tor[0] + sx + i * (aPecho - 2), yPecho + 3, 2.5, 2.5, P.oro2);
  }
  linea(L, tor[0] + sx - 10, yPecho + 4, tor[0] + sx + 10, yPecho + 4, 2, P.oro3);
  // El COLLAR: una gargantilla fina con su gota. Detalle de princesa.
  linea(L, cab[0] - 7, cab[1] + 19, cab[0] + 7, cab[1] + 19, 2, P.oro2);
  elipse(L, cab[0] + 1, cab[1] + 22, 2.5, 3, P.joya2);
  elipse(L, cab[0], cab[1] + 21, 1, 1, P.bla2);
  // Cinturon de oro EN EL TALLE (antes iba recto y ancho, lo que borraba la
  // cintura justo donde hacia falta verla). Ahora es estrecho y se cine.
  for (let i = -aTalle; i <= aTalle; i++) {
    const u = i / aTalle;
    elipse(L, tor[0] + i * 1.0 + sx * 0.3, yTalle + Math.abs(u) * 1.5, 1.6, 3, P.oro2);
  }
  elipse(L, tor[0] + sx * 0.3, yTalle, 5, 4.5, P.oro3);
  elipse(L, tor[0] + sx * 0.3, yTalle, 2.5, 2.5, P.joya);
  // La joya del pecho
  elipse(L, tor[0] + Math.sin(p.incl) * 7, tor[1] - 6, 5, 5, P.oro2);
  elipse(L, tor[0] + Math.sin(p.incl) * 7, tor[1] - 6, 3, 3, P.joya2);

  // === 5. Los BRAZOS ===
  for (const [lado, hom, codo, mano] of [
    [-1, p.hombI, p.codI, p.manI],
    [1, p.hombD, p.codD, p.manD],
  ]) {
    const hx = tor[0] + hom + Math.sin(p.incl) * 8, hy = tor[1] - th * 0.18;
    const cx = hx + codo[0], cy = hy + codo[1];
    const mx = hx + mano[0], my = hy + mano[1];
    // MANGA abullonada del hombro. Tres bandas en vez de dos: base, luz y
    // brillo, mas el pliegue de abajo donde la tela se recoge. Con dos tonos
    // salia una pelota plana pegada al hombro.
    elipse(L, hx, hy + 3, 12, 11, P.ves1);          // el fondo, en sombra
    elipse(L, hx + lado * 1, hy + 1, 11, 10, P.ves3);
    elipse(L, hx - lado * 2, hy - 1, 7.5, 6.5, P.ves4);
    // los pliegues de la manga, que es lo que la hace tela y no globo
    for (const a of [-0.6, 0.1, 0.8]) {
      curva(L, hx + Math.cos(a) * 3, hy + 8,
               hx + Math.cos(a) * 7, hy + 5,
               hx + Math.cos(a) * 10, hy + 9, 1.8, 1.2, P.ves1);
    }
    // el puño de oro donde acaba la manga
    elipse(L, hx + lado * 2, hy + 10, 8, 3, P.oro2);
    // Antebrazo y brazo, con una banda de sombra por debajo
    linea(L, hx, hy + 6, cx, cy, 9, P.piel2);
    linea(L, cx, cy, mx, my, 8, P.piel2);
    linea(L, hx - lado, hy + 9, cx - lado, cy + 2, 3, P.piel1);
    linea(L, cx - lado, cy + 2, mx - lado, my + 2, 2.5, P.piel1);
    // La mano, con el nudillo insinuado
    elipse(L, mx, my, 6, 6, P.piel3);
    elipse(L, mx + lado * 2, my - 1, 3, 3.5, P.piel2);
  }

  // === 6. El ESCUDO, en el antebrazo izquierdo ===
  // Ya no se dibuja aqui: es una pieza con estructura propia (tablones, cruz,
  // remache) en romi-armas.js, que se rota entera.
  // Si escZ es 0 va detras del brazo; al BLOQUEAR va delante de todo, que es
  // justo lo que hace legible el gesto: se parapeta.
  if (p.esc !== 0 && !p.escZ) {
    dibujaEscudo(L, tor[0] + p.escX, tor[1] + p.escY, p.escAng);
  }

  // === 7. La ESPADA, en la mano derecha ===
  if (p.esp !== 0) {
    const hx = tor[0] + p.hombD + Math.sin(p.incl) * 8, hy = tor[1] - th * 0.18;
    const mx = hx + p.manD[0], my = hy + p.manD[1];
    // La ESTELA del barrido, ANTES de la hoja para que la hoja quede encima.
    // Es lo que faltaba en el tajo: sin ella la espada solo aparecia en otro
    // sitio y el golpe no se leia como un golpe.
    if (p.estela) {
      const [a0, a1] = p.estela;
      // El barrido gira alrededor del HOMBRO, no de la mano. Medido: entre el
      // fotograma de carga y el de impacto la mano salta 53 px, asi que un
      // arco trazado desde la mano actual con el angulo anterior sale de un
      // sitio donde la espada no estuvo nunca -- y se veia como una cinta
      // flotando separada del filo. Desde el hombro, el arco pasa por donde
      // la hoja pasó de verdad.
      const ex = hx, ey = hy;
      const RM = Math.hypot(mx - hx, my - hy);   // cuanto saca el brazo
      // El barrido es una CINTA RELLENA, no un manojo de rayos: se traza el
      // borde de fuera en un sentido y el de dentro en el otro, y se rellena.
      // (Con lineas radiales sueltas salia un abanico de varillas, como un
      // abanico de verdad, que era peor que no tener estela.)
      //
      // Tres cintas concentricas, de la mas ancha y apagada a la mas fina y
      // blanca justo en el filo: asi se lee de donde viene y hacia donde va.
      // Los radios van desde el HOMBRO: la punta esta a RM+ESP_LARGO.
      // La estela es FINA: tres cintas de 5, 3 y 2 px de grosor pegadas al
      // borde que recorrio la punta. Una cinta gruesa y opaca (el primer
      // intento) tapaba media pantalla y se leia como una mancha, no como un
      // filo pasando: en pixel art la estela se SUGIERE.
      const RF = RM + ESP_LARGO;
      const CAPAS = [
        [0.00, 1.00, 5.0, 10, P.ace2],   // todo el arco, fina y apagada
        [0.40, 1.00, 3.5,  5, P.ace3],   // el tramo reciente
        [0.72, 1.00, 2.0,  0, P.ace4],   // justo tras el filo, blanca
      ];
      for (const [u0, u1, gr, sep, col] of CAPAS) {
        const N = 20;
        const cinta = [];
        for (let i = 0; i <= N; i++) {            // borde exterior
          const u = u0 + (u1 - u0) * (i / N);
          const a = a0 + (a1 - a0) * u;
          const r = RF - sep;
          cinta.push(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        }
        for (let i = N; i >= 0; i--) {            // borde interior, de vuelta
          const u = u0 + (u1 - u0) * (i / N);
          const a = a0 + (a1 - a0) * u;
          // se afila hacia atras: mas fina cuanto mas vieja
          const r = RF - sep - gr * (0.35 + 0.65 * (i / N));
          cinta.push(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        }
        poly(L, cinta, col);
      }
    }
    dibujaEspada(L, mx, my, p.espAng);
  }


  // === 8. La CABEZA ===
  const chx = cab[0] + p.cabGiro * 4;
  elipse(L, chx, cab[1], 21, 23, P.piel2);
  elipse(L, chx + 4, cab[1] - 3, 15, 17, P.piel3);   // luz en la cara
  // El flequillo y el pelo de delante
  const flequi = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, ang = Math.PI * (1 + t);
    flequi.push(chx + Math.cos(ang) * 23, cab[1] + Math.sin(ang) * 25);
  }
  flequi.push(chx + 20, cab[1] - 2, chx + 12, cab[1] - 12, chx, cab[1] - 6, chx - 12, cab[1] - 13, chx - 21, cab[1] - 1);
  poly(L, flequi, P.pel2);
  // Mechones del flequillo, mas claros
  for (const [dx, dy, cx2, cy2, ex2, ey2] of [
    [-20, -8, -12, -20, -2, -10], [-4, -14, 4, -22, 12, -12], [12, -12, 19, -18, 22, -4],
  ]) curva(L, chx + dx, cab[1] + dy, chx + cx2, cab[1] + cy2, chx + ex2, cab[1] + ey2, 7, 5, P.pel3);
  // Los dos mechones largos que enmarcan la cara
  curva(L, chx - 20, cab[1] - 6, chx - 24, cab[1] + 8, chx - 20, cab[1] + 22, 8, 5, P.pel2);
  curva(L, chx + 20, cab[1] - 6, chx + 24, cab[1] + 8, chx + 21, cab[1] + 20, 8, 5, P.pel2);

  // La cara
  dibujaCara(L, chx, cab[1], p);

  // === 9. La CORONA ===
  const cy3 = cab[1] - 22;
  // El aro: con sombra abajo y brillo arriba, no una fila de bolas iguales.
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * 4.5, cy3 + 3, 3, 3, P.oro1);
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * 4.5, cy3 + 2, 3, 3, P.oro2);
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * 4.5, cy3 + 0.5, 2.5, 1.5, P.oro3);
  // Las puntas, cada una con su cara en sombra: asi tienen volumen.
  for (const [dx, alto] of [[-9, 7], [0, 11], [9, 7]]) {
    poly(L, [chx + dx - 4, cy3, chx + dx + 4, cy3, chx + dx, cy3 - alto], P.oro2);
    poly(L, [chx + dx - 4, cy3, chx + dx, cy3, chx + dx, cy3 - alto], P.oro1);
    poly(L, [chx + dx + 1, cy3 - 1, chx + dx + 3, cy3 - 1, chx + dx, cy3 - alto + 1], P.oro3);
  }
  // Las piedras, con su brillo de un pixel arriba a la izquierda
  elipse(L, chx, cy3 - 11, 3.5, 3.5, P.joya);
  elipse(L, chx - 1, cy3 - 12, 1.2, 1.2, P.bla2);
  for (const s of [-1, 1]) {
    elipse(L, chx + s * 9, cy3 - 7, 2.5, 2.5, P.joya2);
    elipse(L, chx + s * 9 - 1, cy3 - 8, 1, 1, P.bla2);
  }

  // === 10. El ESCUDO POR DELANTE, al bloquear ===
  // Va al final del todo, incluso por delante de la cabeza y la corona: al
  // parapetarse ella mete la cabeza DETRAS del escudo, y si el escudo se
  // dibuja antes, la cara le queda encima y no se lee el bloqueo.
  if (p.esc !== 0 && p.escZ) {
    dibujaEscudo(L, tor[0] + p.escX, tor[1] + p.escY, p.escAng);
  }

  contorno(L, P.out, false);
  return L;
}

// La cara: ojos grandes con brillo, cejas, nariz de un pixel y boca.
function dibujaCara(L, cx, cy, p) {
  const oy = cy + 2;
  if (p.ojos === 'cerrados') {
    for (const dx of [-8, 8]) {
      curva(L, cx + dx - 5, oy, cx + dx, oy + 3, cx + dx + 5, oy, 2.5, 2.5, P.out);
    }
  } else {
    const alto = p.ojos === 'esfuerzo' ? 4 : p.ojos === 'dolor' ? 3 : 6;
    for (const dx of [-8, 8]) {
      // El ojo: blanco, iris cafe en dos tonos, pupila y DOS brillos.
      // OJO CON EL SOMBREADO: probe una sombra de parpado sobre el blanco y
      // una linea bajo el ojo, y a 46 px de cara se comian el ojo entero --
      // quedaban dos manchas oscuras con cara de enfado permanente. A este
      // tamaño el ojo se lee por CONTRASTE (blanco grande, pupila negra), no
      // por bandas de sombra. Renderizado a x7 para verlo, no a ojo.
      elipse(L, cx + dx, oy, 5, alto + 1, P.ojoB);
      elipse(L, cx + dx + 1, oy + 1, 3.5, alto * 0.75, P.ojo2);
      elipse(L, cx + dx + 1, oy + 1.5, 3, alto * 0.62, P.ojo);
      elipse(L, cx + dx + 1, oy + 1, 1.8, alto * 0.42, P.out);
      elipse(L, cx + dx - 1, oy - 1.5, 1.5, 1.5, P.ojoB);   // el brillo grande
      elipse(L, cx + dx + 2.5, oy + 2, 0.9, 0.9, P.ojoB);   // el chispazo chico
      // Pestañas arriba
      linea(L, cx + dx - 5, oy - alto, cx + dx + 5, oy - alto - 1, 2.5, P.out);
      // la pestaña que sobresale en el rabillo, como en las referencias
      const s = Math.sign(dx);
      curva(L, cx + dx + s * 4, oy - alto, cx + dx + s * 6, oy - alto - 1.5,
               cx + dx + s * 7.5, oy - alto - 2.5, 2, 1, P.out);
    }
  }
  // Cejas
  // CEJAS. Finas y separadas del ojo: con 2.5 px de grosor y pegadas encima
  // se leian como un ceño de enfado permanente, hasta en la cara de reposo.
  // Ahora son de 2 px, dos pixeles mas arriba, y en pel2 (no pel1) para que
  // no compitan en negro con la pupila.
  const cejaY = p.ojos === 'esfuerzo' || p.ojos === 'dolor' ? oy - 12 : oy - 13.5;
  const cejaIncl = p.ojos === 'esfuerzo' ? 2 : p.ojos === 'dolor' ? -2 : 0;
  curva(L, cx - 12, cejaY + cejaIncl, cx - 7.5, cejaY - 2.5, cx - 3.5, cejaY - 1 - cejaIncl, 2, 1.5, P.pel2);
  curva(L, cx + 3.5, cejaY - 1 - cejaIncl, cx + 7.5, cejaY - 2.5, cx + 12, cejaY + cejaIncl, 1.5, 2, P.pel2);
  // Nariz
  elipse(L, cx + 1, oy + 8, 1.5, 1.5, P.piel1);
  // Boca
  if (p.boca === 'abierta') {
    elipse(L, cx + 1, oy + 14, 4, 4.5, P.out);
    elipse(L, cx + 1, oy + 15, 3, 3, P.boca);
    elipse(L, cx + 1, oy + 16.5, 2, 1.2, P.ves4);   // la lengua, insinuada
  } else if (p.boca === 'apretada') {
    linea(L, cx - 4, oy + 14, cx + 6, oy + 14, 2.5, P.boca);
    linea(L, cx - 3, oy + 15.5, cx + 5, oy + 15.5, 1.4, P.ves4);  // el labio
  } else {
    curva(L, cx - 4, oy + 13, cx + 1, oy + 16, cx + 6, oy + 13, 2.5, 2.5, P.boca);
    // el labio de abajo, mas claro: es lo que hace que la sonrisa tenga boca
    curva(L, cx - 3, oy + 15, cx + 1, oy + 17, cx + 5, oy + 15, 1.6, 1.6, P.ves4);
  }
  // Colorete
  elipse(L, cx - 13, oy + 7, 4, 2.5, P.piel1);
  elipse(L, cx + 14, oy + 7, 4, 2.5, P.piel1);
}

export function horneaPose(p) { return aCanvas(dibujaPose(p)); }
