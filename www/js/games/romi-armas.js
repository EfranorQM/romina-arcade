// ROMINA - la ESPADA y el ESCUDO, dibujados aparte.
//
// POR QUE UN MODULO PROPIO. Antes la espada era una linea gris de 8 px con una
// cruz de oro, y el escudo un pentagono plano. A 128x180 eso se nota: son las
// dos piezas que mas se miran porque son las que se mueven en un juego de
// pelea. Sus referencias tienen ESTRUCTURA -- la hoja con su filo central y su
// punta, la guarda curvada hacia arriba, el pomo redondo; el escudo con sus
// tablones de madera, el refuerzo en cruz, el remache del centro y el borde de
// acero.
//
// Cada arma se describe en SU sistema de coordenadas (el mango en el origen,
// la hoja hacia +x) y se rota al colocarla. Asi el detalle es el mismo apunte
// donde apunte, que es lo que fallaba cuando se dibujaba con lineas sueltas.

import { P, elipse, poly, linea } from './romi-art.js';

// Un rotador: convierte (dx,dy) del arma a coordenadas del lienzo.
function rota(ox, oy, ang) {
  const co = Math.cos(ang), si = Math.sin(ang);
  return (dx, dy) => [ox + dx * co - dy * si, oy + dx * si + dy * co];
}
// Un poligono dado en coordenadas del arma
function polyR(L, R, pts, col) {
  const o = [];
  for (const [dx, dy] of pts) o.push(...R(dx, dy));
  poly(L, o, col);
}

// ---------- LA ESPADA ----------
// Origen = el puño. La hoja va hacia +x. Longitud total 74 px: pomo en -8,
// guarda en +6, punta en +66.
export const ESP_LARGO = 66;

export function dibujaEspada(L, ox, oy, ang) {
  const R = rota(ox, oy, ang);

  // --- La hoja ---
  // Cuerpo: recto hasta x=52 y ahi arranca la punta, como una espada de verdad
  // (antes era un rectangulo romo que acababa de golpe).
  polyR(L, R, [[10, -5], [52, -5], [66, 0], [52, 5], [10, 5]], P.ace2);
  // El bisel de arriba, mas claro: es lo que le da volumen a una hoja plana
  polyR(L, R, [[10, -5], [52, -5], [64, -0.5], [52, -1.5], [10, -1.5]], P.ace3);
  // El filo central (fuller), una acanaladura oscura por el medio
  polyR(L, R, [[14, -1.5], [50, -1.5], [56, 0], [50, 1.5], [14, 1.5]], P.ace1);
  // El brillo del filo de abajo
  polyR(L, R, [[12, 3.5], [54, 3.5], [60, 2], [12, 2]], P.ace4);

  // --- La guarda ---
  // Se abre a los lados y las PUNTAS se curvan hacia la HOJA, como la de su
  // referencia. (Antes se abrian hacia la punta de la espada y parecia un
  // ancla; con la curva al reves se lee como una cruz de espada de verdad.)
  for (const s of [-1, 1]) {
    const a = R(7, s * 3), b = R(6, s * 10), c = R(9.5, s * 14.5);
    linea(L, a[0], a[1], b[0], b[1], 5.5, P.oro2);
    linea(L, b[0], b[1], c[0], c[1], 4, P.oro2);
    // el remate de la punta, algo mas claro
    const [tx, ty] = R(10, s * 15);
    elipse(L, tx, ty, 2.5, 2.5, P.oro3);
    // brillo por el borde de arriba del brazo
    const a2 = R(7, s * 3), b2 = R(6.5, s * 10);
    linea(L, a2[0], a2[1] - 1, b2[0], b2[1] - 1, 1.6, P.oro3);
  }
  // El bloque central de la guarda, de donde sale la hoja
  polyR(L, R, [[3, -6.5], [10, -5], [10, 5], [3, 6.5]], P.oro2);
  polyR(L, R, [[3, -6.5], [10, -5], [10, -2.5], [3, -3.5]], P.oro3);

  // --- La empuñadura: cuero con anillas de oro ---
  polyR(L, R, [[-6, -3.5], [3, -3.5], [3, 3.5], [-6, 3.5]], P.mad1);
  for (const x of [-4.5, -1.5, 1.5]) {
    const a = R(x, -3.5), b = R(x, 3.5);
    linea(L, a[0], a[1], b[0], b[1], 2, P.oro2);
  }

  // --- El pomo: un disco de oro con la joya de ella ---
  const [px_, py_] = R(-8, 0);
  elipse(L, px_, py_, 5.5, 5.5, P.oro2);
  elipse(L, px_ - 1, py_ - 1, 3.5, 3.5, P.oro3);
  elipse(L, px_, py_, 2, 2, P.joya);
}

// ---------- EL ESCUDO ----------
// Origen = el centro. "Arriba" del escudo es -y. Mide 34 de ancho y 44 de alto.
export function dibujaEscudo(L, ox, oy, ang) {
  const R = rota(ox, oy, ang);

  // La silueta: hombros rectos arriba, lados que caen y punta abajo.
  const SIL = [[-17, -22], [17, -22], [17, 0], [11, 14], [0, 22], [-11, 14], [-17, 0]];
  // 1. El borde de acero (toda la silueta)
  polyR(L, R, SIL, P.ace2);
  // 2. Bisel claro arriba y a la izquierda: de donde viene la luz
  polyR(L, R, [[-17, -22], [17, -22], [17, -18], [-17, -18]], P.ace3);
  polyR(L, R, [[-17, -22], [-13, -22], [-13, 2], [-17, 0]], P.ace3);
  // 3. Sombra del borde por abajo
  polyR(L, R, [[13, 2], [17, 0], [11, 14], [0, 22], [-4, 18]], P.ace1);

  // 4. La cara de MADERA, metida 4 px del borde: los tablones.
  const CARA = [[-13, -18], [13, -18], [13, 0], [8, 11], [0, 18], [-8, 11], [-13, 0]];
  polyR(L, R, CARA, P.mad2);
  // Las juntas verticales entre tablones (4 tablones, como la referencia)
  for (const x of [-7, 0, 7]) {
    const a = R(x, -18), b = R(x * 0.55, 15);
    linea(L, a[0], a[1], b[0], b[1], 1.6, P.mad1);
  }
  // Veta clara en los dos tablones de la izquierda (la luz)
  for (const x of [-10.5, -3.5]) {
    const a = R(x, -17), b = R(x * 0.6, 12);
    linea(L, a[0], a[1], b[0], b[1], 3, P.mad3);
  }

  // 5. El refuerzo en CRUZ de oro
  polyR(L, R, [[-13, -4], [13, -4], [13, 4], [-13, 4]], P.oro2);
  polyR(L, R, [[-4, -18], [4, -18], [3, 16], [-3, 16]], P.oro2);
  // Brillo de la cruz
  polyR(L, R, [[-13, -4], [13, -4], [13, -1.5], [-13, -1.5]], P.oro3);
  polyR(L, R, [[-4, -18], [-1.5, -18], [-1.5, 16], [-3, 16]], P.oro3);

  // 6. El remache del centro: acero con el CORAZON de ella dentro
  const [cx, cy] = R(0, 0);
  elipse(L, cx, cy, 8.5, 8.5, P.ace3);
  elipse(L, cx, cy, 7, 7, P.ace1);
  elipse(L, cx - 1, cy - 1, 6, 6, P.ves2);
  // el corazon
  elipse(L, cx - 2.2, cy - 1.5, 2.4, 2.4, P.ves4);
  elipse(L, cx + 2.2, cy - 1.5, 2.4, 2.4, P.ves4);
  poly(L, [cx - 4.4, cy - 0.5, cx + 4.4, cy - 0.5, cx, cy + 5], P.ves4);

  // 7. Los remaches del borde
  for (const [dx, dy] of [[-14, -19], [14, -19], [-15, -8], [15, -8], [-13, 4], [13, 4], [0, 19]]) {
    const [qx, qy] = R(dx, dy);
    elipse(L, qx, qy, 2, 2, P.ace3);
    elipse(L, qx, qy, 1, 1, P.ace4);
  }
}
