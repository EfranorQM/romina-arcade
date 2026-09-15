// EL OGRO - como se dibuja una pose.
//
// Misma tecnica que ella: una POSE son unos veinte numeros y el dibujo entero
// se compone de atras hacia adelante. El rasterizador se REUSA de romi-art.js
// (elipse, poly, curva, linea, contorno) -- no se copia.
//
// LA SILUETA ES EL DISEÑO. A x1.95 sobre el fondo del campo, un ogro se
// reconoce por su forma antes que por ningun detalle: hombros enormes, cabeza
// HUNDIDA entre ellos (sin cuello), joroba, brazos larguisimos que le llegan
// por debajo de las rodillas, piernas cortas y abiertas. Si esa silueta se
// lee a contraluz, el ogro funciona; si no, no lo arregla ningun detalle.
//
// (Esta leccion es fresca y cara: en el sprite de ella se invirtio mucho en
// escorzar la cara -- 15.5% de las celdas -- y no se noto, porque tocaba
// RASGOS FINOS y no la silueta. Aqui todo lo que se dibuja o cambia la
// silueta o cambia un area grande de color.)

import { elipse, poly, linea, curva, contorno } from './romi-art.js';
import { W, H, EJE, PIES, P } from './ogro-art.js';

function makeLienzo() { return { w: W, h: H, d: new Array(W * H).fill(null) }; }

// La pose de reposo. Todo en celdas del lienzo, con los pies en PIES=260 y el
// eje del cuerpo en EJE=128.
export const BASE = {
  cadX: EJE, cadY: PIES - 74,   // la cadera (las piernas son cortas)
  torX: 0, torY: -52,           // el torso respecto a la cadera
  incl: 0,                      // cuanto se inclina adelante
  // LA CABEZA, hundida pero NO tragada. Con -22 los ojos caian en y=116 y la
  // linea de hombros esta en y=102: el torso se los comia y el ogro se
  // quedaba sin cara. Los ojos tienen que quedar POR ENCIMA de y=102 con
  // margen: con -46 caen en 92, diez pixeles por encima del hombro. Sigue
  // hundida (una cabeza humana iria mucho mas alta) pero mira. Es el tipo de
  // fallo que solo se ve renderizando, no leyendo el codigo.
  cabX: 10, cabY: -46,          // la cabeza, HUNDIDA y adelantada
  bocaAb: 0,                    // 0..1 cuanto abre la boca (rugir)
  hombAncho: 62,                // medio ancho de los hombros
  jorobaY: -8,                  // la joroba sobre el hombro de atras
  // Los brazos: el DERECHO lleva el garrote, el izquierdo cuelga.
  // EL BRAZO DEL GARROTE va ADELANTADO. Pegado al costado el arma quedaba
  // detras del cuerpo y casi no se veia -- y el garrote es lo que el usuario
  // pidio por su nombre. Adelantarlo 22 px lo saca de la silueta del torso.
  // La mano NO puede caer tan abajo: el garrote son 150 px mas desde el puño,
  // asi que con la mano a +54 la maza apuntando al suelo se salia del lienzo
  // por abajo. A +26 el brazo sigue largo (un ogro los tiene por debajo de la
  // rodilla) y el arma cabe en todos los angulos.
  codD: [52, 8], manD: [82, 26],
  codI: [-46, 34], manI: [-56, 78],
  // En reposo apunta abajo-adelante, pero NO tanto que la maza se salga del
  // lienzo por abajo (medido: a 0.75 se sale, a 0.45 cabe con margen). A 0.45
  // la maza queda a la altura de la rodilla, a la vista y leyendose que pesa.
  garAng: 0.45,                 // el angulo del garrote
  garVis: 1,                    // 0 = escondido (durante la embestida)
  estela: null,                 // [a0, a1] el barrido del garrote
  piernaSep: 30,                // cuanto separa las piernas
  flexion: 0,                   // 0..1 cuanto dobla las rodillas
  ojos: 'normal',               // normal | furia | dolor | cerrados
  sangra: 0,                    // 0..1 cuanto marca el daño (fase 3)
};

export function pose(cambios) { return Object.assign({}, BASE, cambios); }

// ---------- El garrote ----------
// Mango 58 + maza 92 = 150 px, con la MASA EN LA PUNTA. Esa proporcion es lo
// que hace que se lea pesado: un palo uniforme se lee como un baston.
const GAR_MANGO = 58, GAR_MAZA = 92;
export const GAR_LARGO = GAR_MANGO + GAR_MAZA;

function dibujaGarrote(L, ox, oy, ang) {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const R = (d, o) => [ox + cos * d - sin * o, oy + sin * d + cos * o];

  // El mango: fino donde lo agarra, engordando hacia la maza.
  const m0 = R(-10, 0), m1 = R(GAR_MANGO, 0);
  linea(L, m0[0], m0[1], m1[0], m1[1], 13, P.mad1);
  linea(L, m0[0], m0[1], m1[0], m1[1], 9, P.mad2);

  // LA MAZA: un tronco que se ensancha. Se dibuja como una serie de elipses
  // que crecen, porque asi el contorno queda irregular y se lee como madera
  // basta y no como un cilindro de metal.
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const d = GAR_MANGO + t * GAR_MAZA;
    const r = 15 + t * 15 + Math.sin(t * 7) * 2.5;
    const c = R(d, 0);
    elipse(L, c[0], c[1], r, r * 0.94, P.mad1);
  }
  // La cara iluminada de la maza, desplazada: es lo que le da volumen.
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const d = GAR_MANGO + t * GAR_MAZA;
    const r = 15 + t * 15;
    const c = R(d, -r * 0.3);
    elipse(L, c[0], c[1], r * 0.62, r * 0.5, P.mad2);
  }
  const alto = R(GAR_MANGO + GAR_MAZA * 0.72, -12);
  elipse(L, alto[0], alto[1], 12, 9, P.mad3);

  // LOS CLAVOS. Cuatro nudos oscuros grandes, no veinte puntitos: a tamaño de
  // juego un punto de 2 px desaparece, pero un nudo de 7 se lee.
  for (const [d, o] of [[82, -16], [104, 14], [124, -10], [140, 8]]) {
    const c = R(d, o);
    elipse(L, c[0], c[1], 7, 6, P.cue1);
    elipse(L, c[0] - 1, c[1] - 1, 4, 3.5, P.mad1);
  }
  // La correa de cuero del puño
  const p1 = R(-6, 0), p2 = R(10, 0);
  linea(L, p1[0], p1[1], p2[0], p2[1], 15, P.cue2);
  linea(L, p1[0], p1[1], p2[0], p2[1], 11, P.cue1);
}

// ---------- El dibujo ----------
export function dibujaPose(p) {
  const L = makeLienzo();
  const cad = [p.cadX, p.cadY];
  const tor = [cad[0] + p.torX + Math.sin(p.incl) * 14, cad[1] + p.torY];
  const cab = [tor[0] + p.cabX + Math.sin(p.incl) * 18, tor[1] + p.cabY];
  const s = Math.sin(p.incl);

  // === 1. EL GARROTE, si va por detras del cuerpo ===
  const hxD = tor[0] + p.hombAncho * 0.72 + s * 10;
  const hyD = tor[1] - 6;
  const mxD = hxD + p.manD[0], myD = hyD + p.manD[1];
  if (p.garVis && p.garAng < -0.2) dibujaGarrote(L, mxD, myD, p.garAng);

  // === 2. EL BRAZO IZQUIERDO (el de atras), mas oscuro ===
  // Va ANTES que el cuerpo: queda detras. Y en un tono mas apagado, que es
  // como se lee la profundidad sin dibujar nada mas.
  {
    const hx = tor[0] - p.hombAncho * 0.72 + s * 10, hy = tor[1] - 4;
    const cx = hx + p.codI[0], cy = hy + p.codI[1];
    const mx = hx + p.manI[0], my = hy + p.manI[1];
    linea(L, hx, hy, cx, cy, 30, P.pie0);
    linea(L, cx, cy, mx, my, 25, P.pie0);
    elipse(L, mx, my, 17, 16, P.pie0);          // el puño
    elipse(L, hx, hy + 2, 27, 25, P.pie0);      // el hombro
    // Un canto iluminado por el borde de fuera: sin esto el brazo de atras se
    // funde con el torso y el ogro pierde un brazo entero de silueta.
    linea(L, hx - 16, hy + 6, cx - 12, cy, 7, P.pie1);
    linea(L, cx - 12, cy, mx - 10, my - 4, 6, P.pie1);
  }

  // === 3. LAS PIERNAS: cortas, gruesas y abiertas ===
  const flex = p.flexion;
  for (const lado of [-1, 1]) {
    const px0 = cad[0] + lado * p.piernaSep * 0.55;
    const rodX = cad[0] + lado * p.piernaSep;
    const rodY = cad[1] + 34 - flex * 12;
    const pieX = cad[0] + lado * (p.piernaSep + 6);
    const col = lado < 0 ? P.pie0 : P.pie1;
    linea(L, px0, cad[1], rodX, rodY, 40, col);
    linea(L, rodX, rodY, pieX, PIES - 8, 36, col);
    // El pie: ancho y plano, que es lo que sostiene a un ogro.
    elipse(L, pieX + lado * 4, PIES - 8, 26, 12, col);
    elipse(L, pieX + lado * 4, PIES - 10, 22, 9, lado < 0 ? P.pie1 : P.pie2);
    // Las uñas
    for (const u of [-1, 0, 1]) {
      elipse(L, pieX + lado * 16 + u * 7, PIES - 10, 3.5, 4, P.hue1);
    }
  }

  // === 4. EL TORSO: una masa con joroba, no un tronco ===
  // La silueta clave. El pecho es enorme y la cintura casi no existe: un ogro
  // no tiene talle.
  const th = 76;
  const yHom = tor[1] - th * 0.42;
  const yBar = cad[1] - 6;
  const cuerpo = [
    tor[0] - p.hombAncho + s * 6, yHom + 8,
    tor[0] - p.hombAncho * 0.86 + s * 8, yHom - 10,
    tor[0] + p.hombAncho * 0.9 + s * 8, yHom - 8,
    tor[0] + p.hombAncho + s * 6, yHom + 10,
    tor[0] + p.hombAncho * 0.82, yHom + 44,
    cad[0] + 44, yBar,
    cad[0] - 42, yBar,
    tor[0] - p.hombAncho * 0.8, yHom + 44,
  ];
  poly(L, cuerpo, P.pie1);
  // LA JOROBA sobre el hombro de atras: es lo que mas dice "ogro" de toda la
  // silueta, y a x1.95 mide 40x28 px de pantalla -- se ve.
  elipse(L, tor[0] - p.hombAncho * 0.5 + s * 6, yHom + p.jorobaY - 4, 34, 26, P.pie1);
  elipse(L, tor[0] - p.hombAncho * 0.5 + s * 4, yHom + p.jorobaY - 8, 26, 18, P.pie0);
  // La BARRIGA, que cuelga: la parte iluminada.
  elipse(L, cad[0] + 6, yBar - 26, 46, 34, P.pie2);
  elipse(L, cad[0] + 12, yBar - 30, 32, 22, P.pie1);
  // La sombra del pecho por el lado de atras
  poly(L, [tor[0] - p.hombAncho + s * 6, yHom + 8,
           tor[0] - p.hombAncho * 0.86 + s * 8, yHom - 10,
           tor[0] - p.hombAncho * 0.3, yHom - 4,
           tor[0] - p.hombAncho * 0.36, yHom + 46,
           tor[0] - p.hombAncho * 0.8, yHom + 44], P.pie0);

  // LA CORREA de cuero cruzada: rompe la masa verde y da escala.
  curva(L, tor[0] - p.hombAncho * 0.7, yHom + 2,
           tor[0], yHom + 30,
           cad[0] + 40, yBar - 16, 15, 12, P.cue2);
  curva(L, tor[0] - p.hombAncho * 0.7, yHom - 1,
           tor[0], yHom + 27,
           cad[0] + 40, yBar - 19, 6, 5, P.cue1);

  // === 5. LA LUZ DE BORDE ===
  // NO es decoracion. Medido: la piel base (pie1) es el 33% de las celdas del
  // ogro y da solo 8.9 de contraste contra la muralla del fondo y 4.9 contra
  // el suelo claro -- por debajo del umbral en que dos tonos COLAPSAN. Una
  // banda de pie4 por el lado iluminado despega la silueta entera sin tocar
  // el interior y sin añadir ningun rasgo fino.
  luzDeBorde(L, p);

  // === 6. LA CABEZA: hundida entre los hombros, sin cuello ===
  const chx = cab[0], chy = cab[1];
  // El craneo: ancho arriba, mandibula enorme.
  elipse(L, chx, chy, 34, 30, P.pie1);
  elipse(L, chx + 6, chy - 6, 26, 21, P.pie2);      // la luz
  // LA MANDIBULA, que sobresale: es la mitad de la silueta de la cabeza.
  elipse(L, chx + 8, chy + 20, 30, 20, P.pie1);
  elipse(L, chx + 12, chy + 18, 22, 14, P.pie2);
  // EL ALERO de la frente. En hueso claro cruzaba la cara entera y se leia
  // como unas GAFAS blancas: el rasgo mas llamativo de la cabeza era un
  // accidente. Ahora es la propia frente en sombra, que es lo que hace un
  // ceño de verdad, con solo el canto superior iluminado.
  poly(L, [chx - 28, chy - 10, chx + 28, chy - 13, chx + 25, chy - 1, chx - 25, chy + 1], P.pie0);
  poly(L, [chx - 28, chy - 10, chx + 28, chy - 13, chx + 26, chy - 9, chx - 26, chy - 6], P.pie2);

  // LOS CUERNOS: dos, hacia atras y arriba. Silueta pura.
  // Salen de los LADOS y van hacia ATRAS y arriba, como los de un toro.
  // Saliendo de la coronilla parecian antenas.
  for (const lado of [-1, 1]) {
    const bx = chx + lado * 30, by = chy - 8;
    curva(L, bx, by, bx + lado * 20, by - 18, bx + lado * 16 - 10, by - 38, 16, 5, P.cuer);
    curva(L, bx, by - 2, bx + lado * 17, by - 18, bx + lado * 14 - 10, by - 36, 9, 3, P.hue1);
  }

  // LOS OJOS: naranja incandescente, el unico color calido del cuerpo. Son
  // dos manchas grandes bajo el alero -- a tamaño de juego el ojo entero mide
  // 16x12 px de pantalla, asi que se lee de lejos, que es lo que hace que el
  // ogro te MIRE.
  if (p.ojos !== 'cerrados') {
    const abre = p.ojos === 'furia' ? 1.35 : p.ojos === 'dolor' ? 0.7 : 1;
    for (const lado of [-1, 1]) {
      const ox = chx + lado * 14 + 4, oy = chy + 4;
      elipse(L, ox, oy, 9 * abre, 7 * abre, P.out);
      elipse(L, ox, oy, 7 * abre, 5.2 * abre, P.ojo);
      elipse(L, ox + 2, oy - 1, 3 * abre, 2.4 * abre, P.dien);
    }
  } else {
    for (const lado of [-1, 1]) {
      const ox = chx + lado * 14 + 4, oy = chy + 4;
      linea(L, ox - 8, oy, ox + 8, oy, 5, P.pie0);
    }
  }

  // LA BOCA y los COLMILLOS. bocaAb la abre para rugir.
  const bw = 26, bh = 5 + p.bocaAb * 20;
  elipse(L, chx + 8, chy + 24, bw, bh, P.out);
  if (p.bocaAb > 0.25) {
    elipse(L, chx + 8, chy + 26, bw - 7, bh - 4, '#4a1410');
    elipse(L, chx + 8, chy + 30 + p.bocaAb * 5, bw - 13, bh * 0.35, P.ojo);
  }
  // Los colmillos de abajo, que asoman SIEMPRE: parte de la silueta.
  for (const [dx, alto] of [[-14, 15], [-2, 11], [16, 17], [26, 10]]) {
    poly(L, [chx + 8 + dx - 5, chy + 26, chx + 8 + dx + 5, chy + 26,
             chx + 8 + dx, chy + 26 - alto], P.hue1);
    poly(L, [chx + 8 + dx - 5, chy + 26, chx + 8 + dx, chy + 26,
             chx + 8 + dx, chy + 26 - alto], P.dien);
  }
  // La nariz: un hocico chato y ancho
  elipse(L, chx + 20, chy + 10, 11, 8, P.pie1);
  elipse(L, chx + 24, chy + 12, 3.5, 3, P.pie0);
  elipse(L, chx + 16, chy + 12, 3.5, 3, P.pie0);

  // Las HERIDAS de la fase 3: manchas oscuras grandes, no arañazos finos.
  if (p.sangra > 0) {
    for (const [dx, dy, r] of [[-30, -10, 13], [20, 26, 10], [-12, 44, 15]]) {
      elipse(L, tor[0] + dx, tor[1] + dy, r * p.sangra, r * 0.7 * p.sangra, '#6b1220');
    }
  }

  // === 7. EL BRAZO DERECHO (el de delante) y su garrote ===
  {
    const hx = hxD, hy = hyD;
    const cx = hx + p.codD[0], cy = hy + p.codD[1];
    const mx = mxD, my = myD;
    elipse(L, hx, hy + 2, 30, 28, P.pie1);       // el hombro, enorme
    elipse(L, hx + 4, hy - 4, 22, 19, P.pie2);
    linea(L, hx, hy + 4, cx, cy, 34, P.pie1);
    linea(L, cx, cy, mx, my, 28, P.pie1);
    // la banda de luz por encima del brazo
    linea(L, hx + 2, hy - 2, cx + 2, cy - 6, 14, P.pie2);
    linea(L, cx + 2, cy - 5, mx + 2, my - 6, 11, P.pie2);
    elipse(L, mx, my, 19, 18, P.pie1);           // el puño
    elipse(L, mx + 3, my - 3, 12, 11, P.pie2);
  }

  // LA ESTELA del garrote, antes de la maza para que la maza quede encima.
  if (p.estela && p.garVis) {
    const [a0, a1] = p.estela;
    const RM = Math.hypot(mxD - hxD, myD - hyD) + GAR_LARGO;
    for (const [u0, u1, gr, col] of [[0, 1, 16, P.mad1], [0.45, 1, 9, P.mad2], [0.75, 1, 5, P.mad3]]) {
      const cinta = [];
      const N = 18;
      for (let i = 0; i <= N; i++) {
        const u = u0 + (u1 - u0) * (i / N), a = a0 + (a1 - a0) * u;
        cinta.push(hxD + Math.cos(a) * RM, hyD + Math.sin(a) * RM);
      }
      for (let i = N; i >= 0; i--) {
        const u = u0 + (u1 - u0) * (i / N), a = a0 + (a1 - a0) * u;
        const r = RM - gr * (0.35 + 0.65 * (i / N));
        cinta.push(hxD + Math.cos(a) * r, hyD + Math.sin(a) * r);
      }
      poly(L, cinta, col);
    }
  }

  if (p.garVis && p.garAng >= -0.2) dibujaGarrote(L, mxD, myD, p.garAng);

  contorno(L, P.out, false);
  return L;
}

// La luz de borde: recorre la silueta ya pintada y marca de pie4 las celdas
// que tienen vacio a su derecha-arriba (el lado del que viene la luz).
function luzDeBorde(L, p) {
  const copia = L.d.slice();
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const c = copia[y * W + x];
      if (c !== P.pie1 && c !== P.pie2) continue;
      // ¿toca el vacio por arriba o por la derecha?
      if (copia[(y - 1) * W + x] === null || copia[y * W + x + 1] === null) {
        L.d[y * W + x] = P.pie4;
      }
    }
  }
}

export function horneaPose(p) {
  const L = dibujaPose(p);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const img = c.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < L.d.length; i++) {
    const col = L.d[i];
    if (!col) continue;
    d[i * 4] = parseInt(col.substr(1, 2), 16);
    d[i * 4 + 1] = parseInt(col.substr(3, 2), 16);
    d[i * 4 + 2] = parseInt(col.substr(5, 2), 16);
    d[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}
