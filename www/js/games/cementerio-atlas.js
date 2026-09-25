// GENERADO por tools/cementerio-atlas.py -- no se edita a mano.
//
// El cementerio de la aventura ("Free Pixel Art Fantasy Game Battlegrounds"
// de CraftPix, el 4) y las piezas del nivel, en PIXELES DEL DIBUJO: en el
// juego se pinta a x2, como ella. Cada pieza: [x, y, ancho, alto] en
// img/cementerio.png.
export const ESCALA = 2;
// Las capas empalman consigo mismas cada 480 px del dibujo.
export const PERIODO = 480;
// En que fila del dibujo empieza cada capa (se guardaron recortadas).
export const FILA = { cielo: 0, lapidas: 38, arboles: 5, muro: 94, sueloFondo: 126, sueloPiso: 178 };
// La cripta (la salida) y el arbol del cristal: su caja en el dibujo original.
export const CRIPTA = { x0: 91, y0: 5, x1: 188, y1: 136 };
export const ARBOL = { x0: 277, y0: 0, x1: 410, y1: 152 };
export const PIEZAS = {
  cielo: [0, 0, 480, 140],
  lapidas: [0, 141, 480, 102],
  arboles: [0, 244, 480, 135],
  muro: [0, 380, 480, 46],
  sueloFondo: [0, 427, 480, 52],
  sueloPiso: [0, 480, 480, 92],
  cripta: [0, 573, 97, 131],
  arbolCristal: [98, 573, 133, 152],
  calavera0: [232, 573, 32, 32],
  calavera1: [265, 573, 32, 32],
  calavera2: [298, 573, 32, 32],
  calavera3: [331, 573, 32, 32],
  calavera4: [364, 573, 32, 32],
  calavera5: [397, 573, 32, 32],
  calavera6: [430, 573, 32, 32],
  calavera7: [0, 726, 32, 32],
  lapida: [33, 726, 40, 86],
  fosoFondo: [74, 726, 40, 92],
  fosoI: [115, 726, 6, 92],
  fosoD: [122, 726, 6, 92],
  hoguera: [129, 726, 30, 12],
  fuego0: [160, 726, 16, 20],
  fuego1: [177, 726, 16, 20],
  fuego2: [194, 726, 16, 20],
  fuego3: [211, 726, 16, 20],
};
