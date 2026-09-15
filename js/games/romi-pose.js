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
  // LA PROPORCION, medida. La cabeza tiene 53 px de ancho y el bajo del
  // vestido tenia 102: CASI EL DOBLE. Salia una campana enorme con una cabeza
  // pequeña encima -- pesada abajo, y por eso "no se sentia comoda" en
  // movimiento: la silueta se leia como un cono, no como una persona.
  // Con 37 el bajo queda en ~82 px = 1.55 veces la cabeza, que es la
  // proporcion de una princesa de cuento estilizada y deja ver el cuerpo.
  falAncho: 37,             // medio ancho de la falda abajo
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
  // EL GIRO DEL CUERPO, -1..1. Es LA pieza que faltaba: el sprite se dibujaba
  // siempre de frente (los hombros sumaban 0 en las 51 poses, la cara tenia
  // los dos ojos identicos) y por eso "se sentia como si estuviera mirandote"
  // en vez de encarar al enemigo de lado. Con giro > 0 el cuerpo se escorza
  // hacia +x, que es donde ella mira por convencion.
  // Con giro = 0 TODO queda bit a bit como estaba: es inerte por defecto.
  giro: 0,
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
  // Los GESTOS son tablas en dibujaCara(), asi que añadir uno nuevo cuesta
  // una linea, no un dibujo. Y como se combinan libremente (9 ojos x 6 bocas)
  // salen 54 caras distintas sin horneaar ni un fotograma de mas.
  ojos: 'normal',           // normal | cerrados | esfuerzo | dolor
                            // alegre | sorpresa | decidida | cansada | reojo
  boca: 'sonrisa',          // sonrisa | abierta | apretada
                            // grito | triste | sonrisota
};

export function pose(cambios) { return Object.assign({}, BASE, cambios); }

// ---------- El dibujo ----------
export function dibujaPose(p) {
  const L = makeLienzo();
  const cad = [p.cadX, p.cadY];
  const tor = [cad[0] + p.torX, cad[1] + p.torY];
  const cab = [tor[0] + p.cabX + Math.sin(p.incl) * 20, tor[1] + p.cabY];

  // Las derivadas del giro, que usan el torso y los hombros.
  //   g   el giro acotado a -1..1
  //   eD  cuanto CRECE el lado de delante  (perspectiva: se acerca)
  //   eI  cuanto ENCOGE el lado de detras  (se aleja)
  // El de atras encoge mucho mas de lo que el de delante crece (0.38 contra
  // 0.10) porque asi es como funciona el escorzo de verdad: lo que se va no
  // se dobla de tamaño, se come.
  const g = Math.max(-1, Math.min(1, p.giro || 0));
  const gA = Math.abs(g);
  const eD = 1 + 0.10 * g, eI = 1 - 0.38 * g;

  // === 1. El pelo de DETRAS: una masa ancha que cae por la espalda ===
  // Cae por DETRAS: estrecho a la altura de la cara (no la tapa) y se ensancha
  // a media espalda. Antes salia igual de ancho arriba que abajo y se comia la
  // cara y los hombros, como un casco marron.
  // EL PELO SIGUE A LA CABEZA, pero solo un poco. Iba a -cabGiro*6 mientras
  // la cara va a +cabGiro*4: se separaban 10 px por unidad de giro, asi que a
  // giro alto la mejilla asomaba 7 celdas por fuera de la melena y quedaba un
  // hueco de piel en la sien. Medido, con -1.5 la mejilla asoma 0.6/2.6/3.4
  // celdas a giro 0.3/0.65/0.8 -- que es lo correcto en un 3/4: la mejilla de
  // delante SI sobresale del pelo, pero no se escapa de la cabeza.
  // (El primer intento fue +2.5, que dejaba la holgura en ~0 y ademas
  // invertia el signo en las cuatro poses de cabGiro negativo. Medido y
  // descartado: conservar el signo y bajar la magnitud es el cambio barato.)
  const pelAtras = [];
  // MEDIA MELENA: acaba en el hombro (34 px por debajo de la cara), no en la
  // cintura. Se ensancha un poco a la altura de la mandibula y se recoge al
  // final, que es como cae un pelo liso cortado a esa altura.
  const LARGO = 34;
  // El ancho de la melena va ATADO al del ovalo de la cara (19): con la
  // cabeza mas pequeña, la formula vieja (base 20) dejaba el pelo asomando
  // por fuera del craneo como una peluca suelta.
  const anchoPelo = t => 18 + Math.sin(t * 2.2) * 3.5 - t * t * 4.5;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pelAtras.push(cab[0] - anchoPelo(t) - p.cabGiro * 1.5, cab[1] - 14 + t * LARGO);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pelAtras.push(cab[0] + anchoPelo(t) - p.cabGiro * 1.5, cab[1] - 14 + t * LARGO);
  }
  poly(L, pelAtras, P.pel2);
  // El pelo en SOMBRA por el lado de dentro: sin esto la melena es una mancha
  // plana. La luz viene de la derecha, asi que el lado izquierdo se oscurece.
  const pelSombra = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pelSombra.push(cab[0] - anchoPelo(t) - p.cabGiro * 1.5, cab[1] - 14 + t * LARGO);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pelSombra.push(cab[0] - anchoPelo(t) * 0.35 - p.cabGiro * 1.5, cab[1] - 14 + t * LARGO);
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
    const x0 = cab[0] + anchoPelo(t0) * 0.62 - p.cabGiro * 1.5;
    const x1 = cab[0] + anchoPelo(t1) * 0.58 - p.cabGiro * 1.5;
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
               // mas finos: en la falda estrecha los de 2.5 px se leian como
               // rayas pintadas y no como tela.
               0.8 + hondo * 0.4, 1.1 + hondo * 0.8, P.ves1);
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
      // La cenefa se dimensiono para un bajo de 102 px; en uno de 84 unos
      // remates de 4 px de radio se comen el vestido. Afinada en proporcion.
      elipse(L, x, y - 6, 2.4, 1.7, P.oro2);
      if ((i * N + k) % 5 === 0) elipse(L, x, y - 6, 1.7, 2.1, P.oro3);
      elipse(L, x, y - 1, 3.2, 2.9, P.bla2);
      elipse(L, x, y + 1.6, 3.2, 2.1, P.bla1);
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
  // EL TORSO YA NO ES UN RELOJ DE ARENA DE ESPEJO. Con el giro, el lado de
  // delante crece un poco y el de atras se come bastante -- que es como
  // funciona el escorzo: lo que se aleja no se encoge suave, desaparece.
  //
  // aCaderaI tiene SUELO en 12 y no es un parche: medido, con giro 0.42 (el
  // de correr) 14*eI da 12.0 y el arranque de la falda (A0) es 13, o sea el
  // vientre se metia por dentro de la tela y abria un hueco. Ademas es cierto
  // anatomicamente: la pelvis gira menos que los hombros.
  const aPecho = 19, aTalle = 11, aCadera = 14;
  const aPechoD = aPecho * eD, aPechoI = aPecho * eI;
  const aTalleD = aTalle * eD, aTalleI = aTalle * eI;
  const aCaderaD = aCadera * eD, aCaderaI = Math.max(12, aCadera * eI);
  // La banda de sombra del lado de atras engorda con el giro: al escorzarse,
  // mas superficie del torso queda de canto y en sombra.
  const bandaS = 7 + 5 * g;
  // El contorno, con el talle metido: un reloj de arena suave. Los vertices
  // van en orden (lado derecho hacia abajo, lado izquierdo hacia arriba).
  const cuerpo = [
    tor[0] - aPechoI + sx, yPecho,
    tor[0] + aPechoD + sx, yPecho,
    tor[0] + (aPechoD - 3) + sx * 0.7, yPecho + th * 0.34,
    tor[0] + aTalleD + sx * 0.3, yTalle,
    cad[0] + aCaderaD, yCad,
    cad[0] - aCaderaI, yCad,
    tor[0] - aTalleI + sx * 0.3, yTalle,
    tor[0] - (aPechoI - 3) + sx * 0.7, yPecho + th * 0.34,
  ];
  poly(L, cuerpo, P.ves2);
  // Sombra a la izquierda y brillo a la derecha, siguiendo la MISMA curva:
  // es lo que hace que se lea como un volumen y no como una plancha.
  poly(L, [tor[0] - aPechoI + sx, yPecho,
           tor[0] - aPechoI + bandaS + sx, yPecho,
           tor[0] - aTalleI + (4 + 3 * g) + sx * 0.3, yTalle,
           cad[0] - aCaderaI + 5, yCad,
           cad[0] - aCaderaI, yCad,
           tor[0] - aTalleI + sx * 0.3, yTalle,
           tor[0] - (aPechoI - 3) + sx * 0.7, yPecho + th * 0.34], P.ves1);
  poly(L, [tor[0] + aPechoD - 8 + sx, yPecho,
           tor[0] + aPechoD + sx, yPecho,
           tor[0] + (aPechoD - 3) + sx * 0.7, yPecho + th * 0.34,
           tor[0] + aTalleD + sx * 0.3, yTalle,
           cad[0] + aCaderaD, yCad,
           cad[0] + aCaderaD - 6, yCad,
           tor[0] + aTalleD - 5 + sx * 0.3, yTalle], P.ves3);
  // Las dos costuras del corpino, que marcan el talle aunque la silueta sea
  // pequeña en pantalla. En los vestidos de las referencias son lo que da la
  // sensacion de cuerpo ajustado.
  for (const s of [-1, 1]) {
    const e = s > 0 ? eD : eI;
    curva(L, tor[0] + s * 12 * e + sx, yPecho + 3,
             tor[0] + s * 7.5 * e + sx * 0.4, tor[1] + 6,
             tor[0] + s * 9 * e, yTalle - 1, 2, 2, P.ves1);
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
  for (let i = -Math.round(aTalleI); i <= Math.round(aTalleD); i++) {
    const u = i / (i < 0 ? aTalleI : aTalleD);
    elipse(L, tor[0] + i * 1.0 + sx * 0.3, yTalle + Math.abs(u) * 1.5, 1.6, 3, P.oro2);
  }
  elipse(L, tor[0] + sx * 0.3, yTalle, 5, 4.5, P.oro3);
  elipse(L, tor[0] + sx * 0.3, yTalle, 2.5, 2.5, P.joya);
  // La joya del pecho
  elipse(L, tor[0] + Math.sin(p.incl) * 7, tor[1] - 6, 5, 5, P.oro2);
  elipse(L, tor[0] + Math.sin(p.incl) * 7, tor[1] - 6, 3, 3, P.joya2);

  // === 5. Los BRAZOS ===
  // CON EL GIRO, LOS DOS BRAZOS DEJAN DE SER IGUALES. El de delante baja un
  // poco y crece; el de atras se recoge hacia el eje, SUBE y encoge. Ese
  // desnivel de hombros es, junto con los ojos, lo que hace que el cuerpo se
  // lea de lado y no de frente.
  //
  // LA GUARDA izqDetras NO ES OPCIONAL: en bash y block el brazo izquierdo NO
  // esta detras -- cruza al frente sujetando el escudo (manI[0] positivo y
  // escZ=1). Recogerlo hacia el eje ahi lo ALEJARIA del escudo, que es
  // justamente el fallo que costo arreglar en esas dos animaciones.
  const izqDetras = (p.manI[0] < 0) && !p.escZ;
  const hombOfD = p.hombD * (1 - 0.18 * g);
  const hombOfI = p.hombI * (1 - (izqDetras ? 0.62 : 0) * g);
  for (const [lado, hom, codo, mano, dy, sc] of [
    [-1, hombOfI, p.codI, p.manI, -2.6 * g, 1 - 0.22 * g],
    [1, hombOfD, p.codD, p.manD, 2.2 * g, 1 + 0.06 * g],
  ]) {
    const hx = tor[0] + hom + Math.sin(p.incl) * 8, hy = tor[1] - th * 0.18 + dy;
    const cx = hx + codo[0], cy = hy + codo[1];
    const mx = hx + mano[0], my = hy + mano[1];
    // MANGA abullonada del hombro. Tres bandas en vez de dos: base, luz y
    // brillo, mas el pliegue de abajo donde la tela se recoge. Con dos tonos
    // salia una pelota plana pegada al hombro.
    elipse(L, hx, hy + 3, 12 * sc, 11 * sc, P.ves1);          // el fondo, en sombra
    elipse(L, hx + lado * 1, hy + 1, 11 * sc, 10 * sc, P.ves3);
    // El brillo especular se APAGA en el hombro de atras: lo que se aleja no
    // recibe la luz de frente. Es lo que remata la lectura de volumen.
    if (!(lado === -1 && g > 0.25 && izqDetras)) {
      elipse(L, hx - lado * 2, hy - 1, 7.5 * sc, 6.5 * sc, P.ves4);
    }
    // los pliegues de la manga, que es lo que la hace tela y no globo
    for (const a of [-0.6, 0.1, 0.8]) {
      curva(L, hx + Math.cos(a) * 3, hy + 8,
               hx + Math.cos(a) * 7, hy + 5,
               hx + Math.cos(a) * 10, hy + 9, 1.8, 1.2, P.ves1);
    }
    // el puño de oro donde acaba la manga
    elipse(L, hx + lado * 2, hy + 10, 8 * sc, 3, P.oro2);
    // Antebrazo y brazo, con una banda de sombra por debajo
    linea(L, hx, hy + 6, cx, cy, 9 * sc, P.piel2);
    linea(L, cx, cy, mx, my, 8 * sc, P.piel2);
    linea(L, hx - lado, hy + 9, cx - lado, cy + 2, 3, P.piel1);
    linea(L, cx - lado, cy + 2, mx - lado, my + 2, 2.5, P.piel1);
    // La mano, con el nudillo insinuado
    elipse(L, mx, my, 6 * sc, 6 * sc, P.piel3);
    elipse(L, mx + lado * 2, my - 1, 3 * sc, 3.5 * sc, P.piel2);
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
    // La espada cuelga del hombro derecho YA DESPLAZADO por el giro, o el
    // arma se despega de la mano que la sostiene.
    const hx = tor[0] + hombOfD + Math.sin(p.incl) * 8, hy = tor[1] - th * 0.18 + 2.2 * g;
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
  // LA CABEZA, un punto mas pequeña. El cuerpo medido daba 2.69 cabezas de
  // alto -- territorio "chibi" (2 a 4) -- cuando una princesa estilizada va
  // en 3.2-3.6. Bajando el ovalo de 21x23 a 19x21 el cuerpo sube a ~3.0
  // cabezas y, sobre todo, la cabeza deja de competir en ancho con el bajo
  // del vestido. La CARA no encoge: los rasgos siguen en su sitio, solo se
  // recorta el ovalo que los rodea.
  const chx = cab[0] + p.cabGiro * 4;
  elipse(L, chx, cab[1], 19, 21, P.piel2);
  elipse(L, chx + 4, cab[1] - 3, 14, 15.5, P.piel3);   // luz en la cara
  // El flequillo y el pelo de delante
  const flequi = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, ang = Math.PI * (1 + t);
    flequi.push(chx + Math.cos(ang) * 21, cab[1] + Math.sin(ang) * 23);
  }
  flequi.push(chx + 18, cab[1] - 2, chx + 11, cab[1] - 11, chx, cab[1] - 5.5, chx - 11, cab[1] - 12, chx - 19, cab[1] - 1);
  poly(L, flequi, P.pel2);
  // Mechones del flequillo, mas claros
  for (const [dx, dy, cx2, cy2, ex2, ey2] of [
    [-18, -7, -11, -18, -2, -9], [-4, -13, 4, -20, 11, -11], [11, -11, 17, -16, 20, -4],
  ]) curva(L, chx + dx, cab[1] + dy, chx + cx2, cab[1] + cy2, chx + ex2, cab[1] + ey2, 6.5, 4.5, P.pel3);
  // Los dos mechones largos que enmarcan la cara
  curva(L, chx - 18, cab[1] - 6, chx - 21.5, cab[1] + 7, chx - 18, cab[1] + 20, 7, 4.5, P.pel2);
  curva(L, chx + 18, cab[1] - 6, chx + 21.5, cab[1] + 7, chx + 19, cab[1] + 18, 7, 4.5, P.pel2);

  // La cara
  dibujaCara(L, chx, cab[1], p);

  // === 9. La CORONA ===
  // LA CORONA, medida contra la cabeza nueva. Daba 33 px de ancho para una
  // cara de 34: 0.97x, o sea calada hasta las orejas como un casco. Una
  // corona se apoya DENTRO del craneo, asi que tiene que ir por 0.8-0.85.
  // Con el paso de 3.8 y seis bolas en vez de siete queda en ~27 px.
  const cy3 = cab[1] - 20;
  const PASO = 3.8;
  // El aro: con sombra abajo y brillo arriba, no una fila de bolas iguales.
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * PASO, cy3 + 3, 2.6, 2.6, P.oro1);
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * PASO, cy3 + 2, 2.6, 2.6, P.oro2);
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * PASO, cy3 + 0.5, 2.2, 1.3, P.oro3);
  // Las puntas, cada una con su cara en sombra: asi tienen volumen.
  for (const [dx, alto] of [[-7.6, 6], [0, 9.5], [7.6, 6]]) {
    poly(L, [chx + dx - 3.4, cy3, chx + dx + 3.4, cy3, chx + dx, cy3 - alto], P.oro2);
    poly(L, [chx + dx - 3.4, cy3, chx + dx, cy3, chx + dx, cy3 - alto], P.oro1);
    poly(L, [chx + dx + 0.8, cy3 - 1, chx + dx + 2.6, cy3 - 1, chx + dx, cy3 - alto + 1], P.oro3);
  }
  // Las piedras, con su brillo de un pixel arriba a la izquierda
  elipse(L, chx, cy3 - 9.5, 3, 3, P.joya);
  elipse(L, chx - 1, cy3 - 10.5, 1.1, 1.1, P.bla2);
  for (const s of [-1, 1]) {
    elipse(L, chx + s * 7.6, cy3 - 6, 2.2, 2.2, P.joya2);
    elipse(L, chx + s * 7.6 - 1, cy3 - 7, 0.9, 0.9, P.bla2);
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
  // LA CARA, REDIBUJADA PARA EL TAMAÑO AL QUE SE JUEGA.
  //
  // El sprite mide 128x180 y la cara 56 px de alto, pero JUGANDO el lienzo de
  // 1200x540 se estira x1.95: la cara acaba en 109 px de pantalla, casi tres
  // veces mas pequeña que en tools/ver-cara.html (que la pinta a x5.5). Por
  // eso "en el HTML se ve genial y jugando se siente simple": es el mismo
  // dibujo, visto 2.8 veces mas chico.
  //
  // Lo que se pierde al encoger NO es parejo. Los rasgos finos se disuelven y
  // los de contraste sobreviven. Medido a x1.95: el chispazo del ojo caia a
  // 2 px, la nariz a 3, el labio a 3 -- manchitas que no se leen como rasgos.
  // Mientras tanto las CEJAS (3 px de grosor, oscuras) eran lo primero que se
  // veia y aplastaban los ojos: cara de enfado permanente hasta en reposo.
  // Eso era el "sin vida".
  //
  // Asi que se redibuja con la ley que siguen Soul Knight, Stardew y Dead
  // Cells -- POCAS FORMAS, MUY CONTRASTADAS -- pero aprovechando que aqui hay
  // 56 px de cara y no 7:
  //   1. El OJO manda. Mas grande y mas abierto, con el blanco amplio y la
  //      pupila bien negra: es lo unico que aguanta cualquier escala.
  //   2. Las CEJAS obedecen. Finas, mas altas y en un tono que no compite con
  //      la pupila. Expresan, no gritan.
  //   3. El COLORETE en rosa fundido, no en marron recortado.
  //   4. Fuera lo que mide 2-3 px y no aporta (el chispazo, la nariz de
  //      elipse). La nariz pasa a ser una sombra suave de dos celdas.
  // EL GIRO DE LA CARA, normalizado. cabGiro llega de 0 a 0.8 segun la pose;
  // G lo lleva a 0..1 con una curva de arranque rapido (el exponente 0.65),
  // porque los primeros grados de giro son los que mas se notan en una cara.
  //
  // El guardian de la regresion es el Math.pow: con cabGiro = 0 da
  // exactamente 0, asi que las 19 poses que no declaran cabGiro quedan bit a
  // bit como estaban. (El `|| 1` de dentro del sign no protege nada -- con
  // cabGiro=0 vale 1 y sign da +1 -- pero es inofensivo porque el pow ya ha
  // anulado todo. Se deja por claridad del signo cuando cabGiro != 0.)
  const G = Math.sign(p.cabGiro || 1) * Math.pow(Math.min(1, Math.abs(p.cabGiro) / 0.8), 0.65);
  const aG = Math.abs(G), sG = Math.sign(G) || 1;

  const oy = cy + 2;
  const OJX = 8.5;              // separacion de los ojos respecto al centro

  // ---- LOS OJOS ----
  // Cada gesto define tres cosas: cuanto se abre el ojo (alto), si el parpado
  // lo tapa por arriba (tapa) y hacia donde mira la pupila (mirX, mirY).
  // Mover la PUPILA es lo que mas expresion da por menos pixeles: la misma
  // cara mirando al frente, de reojo o hacia arriba son tres personajes
  // distintos, y no cuesta un dibujo nuevo -- cuesta dos numeros.
  const OJOS = {
    normal:   { alto: 7,   tapa: 0,   mirX: 0,    mirY: 0,    ceja:  0   },
    cerrados: { alto: 0,   tapa: 0,   mirX: 0,    mirY: 0,    ceja:  0   },
    // OJO CON SUMAR 'alto' PEQUEÑO Y 'tapa' GRANDE: se restan del mismo ojo.
    // Medido, dolor y cansada quedaban en 22-24 celdas de blanco visible (la
    // cara normal tiene 148): dos rendijas negras, no unos ojos entornados.
    // Si el ojo ya es bajo, el parpado tiene que ser suave.
    esfuerzo: { alto: 5,   tapa: 0.8, mirX: 0.6,  mirY: 0,    ceja:  2.5 },
    dolor:    { alto: 4.5, tapa: 0.6, mirX: 0,    mirY: 0.5,  ceja: -2.5 },
    // --- los nuevos ---
    // ALEGRE: ojos en arco hacia arriba, la sonrisa de los ojos. Es la cara
    // de victoria, y en pixel art se hace con la curva al REVES que cerrados.
    alegre:   { alto: 0,   tapa: 0,   mirX: 0,    mirY: 0,    ceja:  1,   arco: 1 },
    // SORPRESA: ojo muy abierto y pupila pequeña -- el truco clasico. La
    // pupila chica en un blanco grande es lo que lee como susto.
    sorpresa: { alto: 8.5, tapa: 0,   mirX: 0,    mirY: 0,    ceja:  3,   pup: 0.62 },
    // DECIDIDA: entrecerrados y mirando al frente, cejas bajas. La cara de
    // encarar al jefe. Distinta de 'esfuerzo': aqui no sufre, amenaza.
    decidida: { alto: 5.5, tapa: 0.7, mirX: 0.5,  mirY: 0,    ceja:  1.8 },
    // CANSADA: parpados caidos y mirada baja, sin el ceño del dolor.
    cansada:  { alto: 5,   tapa: 1.2, mirX: 0,    mirY: 0.7,  ceja: -1   },
    // DE REOJO: mira a un lado sin girar la cabeza. Sirve para que MIRE al
    // enemigo cuando lo tiene al lado, que es puro caracter.
    reojo:    { alto: 6.5, tapa: 0.3, mirX: 1.0,  mirY: 0,    ceja:  0.5 },
  };
  const E = OJOS[p.ojos] || OJOS.normal;

  if (E.alto === 0) {
    // Ojo cerrado (o en arco de alegria). El grosor importa: con 3 px los dos
    // arcos se leian como una VENDA cruzando la cara. 2.2 basta.
    const s2 = E.arco ? -1 : 1;     // arco hacia arriba = alegre
    // ESTA RAMA TAMBIEN ESCORZA, y no es un detalle: cuatro poses usan
    // 'cerrados' con cabGiro -0.5 y -0.8 (la rodada), o sea los giros mas
    // fuertes de todo el set. Si solo escorzara la rama de ojos abiertos, en
    // los fotogramas mas dramaticos la cara giraria al maximo con dos ojos
    // perfectamente simetricos -- justo el sintoma que se quiere curar.
    for (const dx of [-OJX, OJX]) {
      const lado = Math.sign(dx);
      const atras = lado * sG < 0;               // el ojo del lado que se aleja
      const kx = atras ? 1 - 0.55 * aG : 1 + 0.05 * aG;
      const des = -sG * aG * 1.6 * (atras ? 1.7 : 0.6);
      const ox = cx + dx * (atras ? 1 - 0.30 * aG : 1) + des;
      curva(L, ox - 5.5 * kx, oy - 0.5 * s2,
               ox, oy + 2.6 * s2,
               ox + 5.5 * kx, oy - 0.5 * s2, 2.2, 2.2, P.out);
      curva(L, ox + lado * 4.8 * kx, oy - 0.8, ox + lado * 6.6 * kx, oy - 2,
               ox + lado * 8 * kx, oy - 3.2, 1.8, 0.9, P.out);
    }
  } else {
    const alto = E.alto;
    const pup = E.pup || 1;          // sorpresa achica la pupila
    for (const dx of [-OJX, OJX]) {
      const s = Math.sign(dx);
      // EL ESCORZO. En una cara de 3/4 los dos ojos NO son iguales: el del
      // lado que se aleja se ve mas estrecho y mas pegado al borde de la
      // cara. Medido, hoy los dos daban 12 celdas de blanco EN TODOS los
      // gestos (delta 0 = cara frontal); con esto el delta va de 4 celdas a
      // giro 0.3 (7.8 px de pantalla) a 8 celdas a giro 0.8 (15.6 px).
      const atras = s * sG < 0;                  // ¿es el ojo que se aleja?
      const kx = atras ? 1 - 0.55 * aG : 1 + 0.05 * aG;   // cuanto se comprime
      const des = -sG * aG * 1.6 * (atras ? 1.7 : 0.6);   // y cuanto se corre
      // LA PUPILA TIENE SUELO. Sin el, en 'sorpresa' (que ya achica la pupila
      // a 0.62) el ojo de atras se quedaba en 8 celdas de negro: una mota, no
      // una pupila. Y la pupila es el ancla de contraste de toda la cara.
      const kPup = Math.max(0.78, kx);
      const cxo = cx + dx * (atras ? 1 - 0.30 * aG : 1) + des;
      // la pupila se desplaza segun la mirada: hacia donde ella mira
      // La pupila se mueve DENTRO del blanco, nunca fuera: el blanco tiene
      // 5.6 de radio y la pupila 2.2, asi que el centro no puede alejarse mas
      // de ~2.6 px del centro del ojo o asoma por el borde y parece bizca.
      const TOPE = 2.6 * kx;
      const mx = Math.max(-TOPE, Math.min(TOPE, E.mirX * s * 1.6 * kx));
      const my = Math.max(-2, Math.min(2, E.mirY * 2));
      const px = cxo + s * 0.5 * kx + mx;
      const py = oy + 0.6 + my;
      // 1. El blanco, GRANDE: es el que hace que el ojo se lea de lejos.
      elipse(L, cxo, oy, 5.6 * kx, alto + 1.2, P.ojoB);
      // 2. El iris en DOS tonos: el claro asoma por abajo, donde da la luz.
      elipse(L, px, py + 0.9, 3.8 * pup * kPup, alto * 0.78, P.ojo2);
      elipse(L, px, py - 0.2, 3.8 * pup * kPup, alto * 0.72, P.ojo);
      // 3. La pupila, negra y gorda: el ancla de contraste de toda la cara.
      elipse(L, px, py, 2.2 * pup * kPup, alto * 0.5, P.out);
      // 4. UN brillo, y grande. El chispazo de 0.9 px se caia a 2 px: fuera.
      elipse(L, px - s * 1.4 * kx, py - 2.4, 1.9 * kPup, 1.9, P.ojoB);
      // 5. El PARPADO que baja por arriba. Es lo que separa 'cansada' de
      //    'normal' sin cambiar nada mas, y se pinta en piel para que parezca
      //    parpado y no sombra.
      if (E.tapa > 0) {
        elipse(L, cxo, oy - alto - 1.2 + E.tapa, 5.8 * kx, E.tapa + 1.4, P.piel2);
      }
      // 6. La linea de pestañas, gruesa y solo ARRIBA.
      curva(L, cxo - 5.6 * kx, oy - alto + 0.5 + E.tapa,
               cxo, oy - alto - 2 + E.tapa,
               cxo + 5.6 * kx, oy - alto + 0.5 + E.tapa, 2.6, 2.6, P.out);
      curva(L, cxo + s * 5 * kx, oy - alto + 0.5 + E.tapa,
               cxo + s * 7 * kx, oy - alto - 1 + E.tapa,
               cxo + s * 8.5 * kx, oy - alto - 2.5 + E.tapa, 2.2, 1, P.out);
    }
  }

  // ---- LAS CEJAS ----
  // La ALTURA se ancla SIEMPRE a la misma distancia del borde de arriba del
  // ojo: antes bajaba con el gesto y acababa tocandolo, y volvia el ceño. Lo
  // que expresa es la INCLINACION (E.ceja), no la altura. Y van sobre la
  // FRENTE, no dentro del flequillo, en tono propio (P.ceja): medido por el
  // perfil vertical, caian en y34..40 justo donde esta el pelo.
  const cejaY = oy - (E.alto || 5) - 4.5;
  for (const s of [-1, 1]) {
    curva(L, cx + s * 12, cejaY + E.ceja,
             cx + s * 7.8, cejaY - 2,
             cx + s * 3.8, cejaY - 0.5 - E.ceja, 1.8, 1.3, P.ceja);
  }

  // LA NARIZ: dos celdas de sombra suave. Era una elipse que a x1.95 quedaba
  // en 3 px -- un lunar.
  elipse(L, cx + 1, oy + 7.5, 1.6, 1.2, P.piel1);

  // ---- LA BOCA ----
  // Tambien por tabla. Una boca son dos curvas (el labio de arriba en P.boca
  // y el de abajo en P.rubor) o una elipse si esta abierta.
  const B = p.boca;
  if (B === 'abierta' || B === 'grito') {
    // GRITO: la misma boca abierta pero mas alta y estirada. Para el salto y
    // el golpe fuerte.
    const h = B === 'grito' ? 6.2 : 4.8;
    const w = B === 'grito' ? 3.6 : 4.2;
    elipse(L, cx + 1, oy + 14, w, h, P.out);
    elipse(L, cx + 1, oy + 14.6, w - 1, h - 1.4, P.boca);
    elipse(L, cx + 1, oy + 15.6 + h * 0.15, w - 2.2, 1.3, P.rubor);
  } else if (B === 'apretada') {
    curva(L, cx - 5, oy + 13.4, cx + 1, oy + 14.6, cx + 6.5, oy + 13.4, 2.6, 2.6, P.boca);
    curva(L, cx - 3.5, oy + 15.2, cx + 1, oy + 16, cx + 5, oy + 15.2, 1.6, 1.6, P.rubor);
  } else if (B === 'triste') {
    // La sonrisa AL REVES: comisuras hacia abajo. Un solo signo cambiado y es
    // otra cara entera.
    curva(L, cx - 5, oy + 15.6, cx + 1, oy + 12.6, cx + 6.5, oy + 15.6, 2.6, 2.6, P.boca);
  } else if (B === 'sonrisota') {
    // La sonrisa ANCHA de victoria: mas abierta y con el labio marcado.
    curva(L, cx - 6.5, oy + 12.4, cx + 1, oy + 17.4, cx + 8, oy + 12.4, 3, 3, P.boca);
    curva(L, cx - 4.5, oy + 14.8, cx + 1, oy + 18.4, cx + 6, oy + 14.8, 2, 2, P.rubor);
  } else {
    curva(L, cx - 5, oy + 12.8, cx + 1, oy + 16.4, cx + 6.5, oy + 12.8, 2.8, 2.8, P.boca);
    curva(L, cx - 3.5, oy + 15, cx + 1, oy + 17.2, cx + 5, oy + 15, 1.8, 1.8, P.rubor);
  }

  // EL COLORETE, en ROSA y fundido. En piel1 (un marron de sombra) salian dos
  // manchas que a tamaño de juego parecian suciedad en los pomulos.
  for (const s of [-1, 1]) {
    const bx = cx + s * 13 + 0.5;
    elipse(L, bx, oy + 6.5, 4.2, 2.8, P.rubor);
    elipse(L, bx, oy + 6.5, 2.6, 1.6, P.piel1);
  }
}

export function horneaPose(p) { return aCanvas(dibujaPose(p)); }
