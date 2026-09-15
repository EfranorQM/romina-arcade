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
  hombD: 15, hombI: -15,    // los hombros
  // Los brazos: codo y mano, respecto al hombro
  // El codo y la mano, respecto al hombro. Medido en el render: con la mano a
  // (24,40) desde un hombro alto, las manos tapaban las mejillas.
  codD: [13, 22], manD: [21, 44],
  codI: [-13, 22], manI: [-21, 44],
  piernaD: 0, piernaI: 0,   // cuanto adelanta cada pie (0 = juntos bajo la falda)
  esp: 1,                   // 1 = espada visible, 0 = escondida
  espAng: 1.2,              // angulo de la espada
  escAng: 0,                // angulo del escudo
  escX: -34, escY: 16,      // el escudo, en el antebrazo izquierdo
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
  // Mechones sueltos que salen de la masa
  for (const [dx, dy, cx, cy, ex, ey, g] of [
    [-16, 0, -22, 12, -19, 24, 8],
    [16, 0, 22, 11, 20, 22, 8],
    [-10, 8, -20, 20, -15, 30, 5],
    [12, 9, 21, 21, 17, 29, 5],
  ]) curva(L, cab[0] + dx, cab[1] + dy, cab[0] + cx, cab[1] + cy, cab[0] + ex, cab[1] + ey, g, g * 0.5, P.pel1);

  // === 2. La FALDA, de atras hacia adelante ===
  const fy0 = cad[1] - 4, fy1 = cad[1] + p.falAlto;
  const vuelo = p.falVuelo;
  // Capa de fuera (la mas oscura), con el borde ondulado
  const falda = [];
  const NB = 14;
  for (let i = 0; i <= NB; i++) {
    const t = i / NB;
    const y = fy0 + t * p.falAlto;
    const an = 13 + t * t * (p.falAncho - 13);
    falda.push(cad[0] - an - vuelo * t * t, y);
  }
  // Borde de abajo, ondulado como los vestidos de las referencias
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const x = cad[0] - p.falAncho - vuelo + u * (p.falAncho * 2 + vuelo * 0.4);
    const onda = Math.sin(u * 9 + p.falOnda) * 5;
    falda.push(x, fy1 + onda);
  }
  for (let i = NB; i >= 0; i--) {
    const t = i / NB;
    const y = fy0 + t * p.falAlto;
    const an = 13 + t * t * (p.falAncho - 13);
    falda.push(cad[0] + an + vuelo * 0.3 * t * t, y);
  }
  poly(L, falda, P.ves2);

  // La abertura del centro: la enagua clara que asoma
  const enagua = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    enagua.push(cad[0] - (4 + t * t * 26), fy0 + 8 + t * (p.falAlto - 8));
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    enagua.push(cad[0] + (4 + t * t * 26), fy0 + 8 + t * (p.falAlto - 8));
  }
  poly(L, enagua, P.fal2);
  // Pliegues de la enagua
  for (const d of [-16, 0, 16]) {
    curva(L, cad[0] + d * 0.3, fy0 + 14, cad[0] + d * 0.7, fy0 + 38, cad[0] + d, fy1 - 4, 2, 3, P.fal1);
  }
  // Brillo de la falda, en el lado de la luz
  for (let i = 0; i < 3; i++) {
    const t = 0.3 + i * 0.2;
    curva(L, cad[0] + 12, fy0 + 10, cad[0] + 24 + i * 4, fy0 + 30, cad[0] + 30 + i * 6 + vuelo * 0.2, fy1 - 8, 4, 2, P.ves3);
  }
  // El forro blanco del borde de abajo
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = cad[0] - p.falAncho - vuelo + u * (p.falAncho * 2 + vuelo * 1.3);
    const onda = Math.sin(u * 9 + p.falOnda) * 5;
    elipse(L, x, fy1 + onda - 1, 4, 3.5, P.bla2);
    elipse(L, x, fy1 + onda + 2, 4, 2.5, P.bla1);
  }

  // === 3. Las PIERNAS, si asoman (al correr o saltar) ===
  for (const [lado, adel] of [[-1, p.piernaI], [1, p.piernaD]]) {
    if (Math.abs(adel) < 2) continue;
    const px0 = cad[0] + lado * 9, py0 = cad[1] + 12;
    const pie = [px0 + adel, py0 + p.falAlto - 10];
    linea(L, px0, py0, pie[0], pie[1], 13, P.piel2);
    elipse(L, pie[0], pie[1] + 3, 8, 5, P.bla2);   // el zapatito
  }

  // === 4. El TORSO: corpino ajustado ===
  const tw = 19, th = 34;
  const cuerpo = [
    tor[0] - tw + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
    tor[0] + tw + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
    tor[0] + 15, tor[1] + th * 0.5,
    tor[0] - 15, tor[1] + th * 0.5,
  ];
  poly(L, cuerpo, P.ves2);
  // Sombra del corpino a la izquierda y brillo a la derecha
  poly(L, [tor[0] - tw + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
           tor[0] - tw + 7 + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
           tor[0] - 9, tor[1] + th * 0.5, tor[0] - 15, tor[1] + th * 0.5], P.ves1);
  poly(L, [tor[0] + 7 + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
           tor[0] + tw + Math.sin(p.incl) * 8, tor[1] - th * 0.5,
           tor[0] + 15, tor[1] + th * 0.5, tor[0] + 9, tor[1] + th * 0.5], P.ves3);
  // El escote y el cuello
  elipse(L, tor[0] + Math.sin(p.incl) * 8, tor[1] - th * 0.5 + 1, 11, 5, P.piel2);
  linea(L, cab[0], cab[1] + 12, tor[0] + Math.sin(p.incl) * 6, tor[1] - th * 0.5 + 2, 11, P.piel2);
  // Cinturon de oro en la cintura
  for (let i = -16; i <= 16; i++) elipse(L, tor[0] + i * 0.95, tor[1] + th * 0.5 - 1, 2, 3, P.oro2);
  elipse(L, tor[0], tor[1] + th * 0.5 - 1, 5, 4, P.oro3);
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
    // Manga abullonada del hombro (las referencias la tienen)
    elipse(L, hx, hy + 2, 11, 10, P.ves3);
    elipse(L, hx - lado * 2, hy, 8, 7, P.ves4);
    // Antebrazo y brazo
    linea(L, hx, hy + 6, cx, cy, 9, P.piel2);
    linea(L, cx, cy, mx, my, 8, P.piel2);
    elipse(L, mx, my, 6, 6, P.piel3);       // la mano
  }

  // === 6. El ESCUDO, en la mano izquierda ===
  if (p.esc !== 0) {
    const ex = tor[0] + p.escX, ey = tor[1] + p.escY;
    const a = p.escAng;
    const co = Math.cos(a), si = Math.sin(a);
    const R = (dx, dy) => [ex + dx * co - dy * si, ey + dx * si + dy * co];
    // Forma de escudo: cuadrado arriba, punta abajo
    const e = [];
    for (const [dx, dy] of [[-15, -18], [15, -18], [15, 6], [0, 22], [-15, 6]]) e.push(...R(dx, dy));
    poly(L, e, P.ace2);
    // Bisel de arriba y borde de oro
    const b = [];
    for (const [dx, dy] of [[-15, -18], [15, -18], [15, -13], [-15, -13]]) b.push(...R(dx, dy));
    poly(L, b, P.ace3);
    for (const [dx, dy] of [[-15, -18], [15, -18], [15, 6], [0, 22], [-15, 6]]) {
      const [qx, qy] = R(dx, dy);
      elipse(L, qx, qy, 2.5, 2.5, P.oro2);
    }
    // El emblema: un corazon de oro (es Romina, no un blason cualquiera)
    const [hx2, hy2] = R(0, -2);
    elipse(L, hx2 - 4, hy2 - 3, 4.5, 4.5, P.oro3);
    elipse(L, hx2 + 4, hy2 - 3, 4.5, 4.5, P.oro3);
    poly(L, [hx2 - 8, hy2 - 2, hx2 + 8, hy2 - 2, hx2, hy2 + 10], P.oro3);
  }

  // === 7. La ESPADA, en la mano derecha ===
  if (p.esp !== 0) {
    const hx = tor[0] + p.hombD + Math.sin(p.incl) * 8, hy = tor[1] - th * 0.18;
    const mx = hx + p.manD[0], my = hy + p.manD[1];
    const a = p.espAng;
    const lx = mx + Math.cos(a) * 62, ly = my + Math.sin(a) * 62;
    const gx = mx + Math.cos(a) * 8, gy = my + Math.sin(a) * 8;
    // Guarda de oro, perpendicular a la hoja
    linea(L, gx - Math.sin(a) * 9, gy + Math.cos(a) * 9, gx + Math.sin(a) * 9, gy - Math.cos(a) * 9, 5, P.oro2);
    // La hoja: cuerpo y filo
    linea(L, gx, gy, lx, ly, 8, P.ace2);
    linea(L, gx - Math.sin(a) * 2, gy + Math.cos(a) * 2, lx - Math.sin(a) * 2, ly + Math.cos(a) * 2, 3, P.ace4);
    // El pomo
    elipse(L, mx - Math.cos(a) * 5, my - Math.sin(a) * 5, 4, 4, P.oro3);
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
  for (let i = -3; i <= 3; i++) elipse(L, chx + i * 4.5, cy3 + 2, 3, 3.5, P.oro2);
  for (const [dx, alto] of [[-9, 7], [0, 11], [9, 7]]) {
    poly(L, [chx + dx - 4, cy3, chx + dx + 4, cy3, chx + dx, cy3 - alto], P.oro3);
  }
  elipse(L, chx, cy3 - 11, 3.5, 3.5, P.joya);
  elipse(L, chx - 9, cy3 - 7, 2.5, 2.5, P.joya2);
  elipse(L, chx + 9, cy3 - 7, 2.5, 2.5, P.joya2);

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
      elipse(L, cx + dx, oy, 5, alto + 1, P.ojoB);
      elipse(L, cx + dx + 1, oy + 1, 3.5, alto * 0.75, P.ojo2);
      elipse(L, cx + dx + 1, oy + 1.5, 3, alto * 0.62, P.ojo);
      elipse(L, cx + dx + 1, oy + 1, 1.8, alto * 0.42, P.out);
      elipse(L, cx + dx - 1, oy - 1.5, 1.5, 1.5, P.ojoB);   // el brillo
      // Pestañas arriba
      linea(L, cx + dx - 5, oy - alto, cx + dx + 5, oy - alto - 1, 2.5, P.out);
    }
  }
  // Cejas
  const cejaY = p.ojos === 'esfuerzo' || p.ojos === 'dolor' ? oy - 11 : oy - 12;
  const cejaIncl = p.ojos === 'esfuerzo' ? 2 : p.ojos === 'dolor' ? -2 : 0;
  curva(L, cx - 13, cejaY + cejaIncl, cx - 8, cejaY - 3, cx - 3, cejaY - 1 - cejaIncl, 2.5, 2, P.pel1);
  curva(L, cx + 3, cejaY - 1 - cejaIncl, cx + 8, cejaY - 3, cx + 13, cejaY + cejaIncl, 2, 2.5, P.pel1);
  // Nariz
  elipse(L, cx + 1, oy + 8, 1.5, 1.5, P.piel1);
  // Boca
  if (p.boca === 'abierta') {
    elipse(L, cx + 1, oy + 14, 4, 4.5, P.boca);
    elipse(L, cx + 1, oy + 13, 3, 2, P.out);
  } else if (p.boca === 'apretada') {
    linea(L, cx - 4, oy + 14, cx + 6, oy + 14, 2.5, P.boca);
  } else {
    curva(L, cx - 4, oy + 13, cx + 1, oy + 16, cx + 6, oy + 13, 2.5, 2.5, P.boca);
  }
  // Colorete
  elipse(L, cx - 13, oy + 7, 4, 2.5, P.piel1);
  elipse(L, cx + 14, oy + 7, 4, 2.5, P.piel1);
}

export function horneaPose(p) { return aCanvas(dibujaPose(p)); }
