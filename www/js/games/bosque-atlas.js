// GENERADO por tools/bosque-atlas.py -- no se edita a mano.
//
// El bosque de la aventura ("Free Pixel Art Fantasy Game Battlegrounds" de
// CraftPix, el 3) y las piezas del nivel, en PIXELES DEL DIBUJO: en el
// juego se pinta a x2, como ella. Cada pieza: [x, y, ancho, alto] en
// img/bosque.png.
export const ESCALA = 2;
// Las capas empalman consigo mismas cada 480 px del dibujo.
export const PERIODO = 480;
// En que fila del dibujo empieza cada capa (se guardaron recortadas).
export const FILA = { lejos: 0, arboles: 0, helechos: 28, lianas: 0, caminoFondo: 123, caminoPiso: 178 };
// El arbol con cara: su caja en el dibujo original, para ponerlo en su sitio.
export const ARBOL = { x0: 159, y0: 0, x1: 333, y1: 178 };
export const PIEZAS = {
  lejos: [0, 0, 480, 104],
  arboles: [0, 105, 480, 104],
  helechos: [0, 210, 480, 112],
  lianas: [0, 323, 480, 104],
  caminoFondo: [0, 428, 480, 55],
  caminoPiso: [0, 484, 480, 92],
  arbol: [0, 577, 174, 178],
  tronco0: [175, 577, 27, 27],
  tronco1: [203, 577, 27, 27],
  tronco2: [231, 577, 27, 27],
  tronco3: [259, 577, 27, 27],
  tronco4: [287, 577, 27, 27],
  tronco5: [315, 577, 27, 27],
  tronco6: [343, 577, 27, 27],
  tronco7: [371, 577, 27, 27],
  rama0: [399, 577, 48, 48],
  rama1: [0, 756, 48, 48],
  rama2: [49, 756, 48, 48],
  rama3: [98, 756, 48, 48],
  rama4: [147, 756, 48, 48],
  rama5: [196, 756, 48, 48],
  rama6: [245, 756, 48, 48],
  rama7: [294, 756, 48, 48],
  tocon: [343, 756, 47, 86],
  fosoFondo: [391, 756, 40, 92],
  fosoI: [432, 756, 6, 92],
  fosoD: [439, 756, 6, 92],
  hoguera: [446, 756, 30, 12],
  fuego0: [0, 849, 16, 20],
  fuego1: [17, 849, 16, 20],
  fuego2: [34, 849, 16, 20],
  fuego3: [51, 849, 16, 20],
};
