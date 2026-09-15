// EL OGRO - la paleta y las medidas del jefe.
//
// POR QUE OTRO FICHERO Y NO REUSAR romi-art.js: el rasterizador (elipse, poly,
// curva, contorno) SI se reusa -- se importa de alli, no se copia. Lo que
// cambia es la paleta y el tamaño del lienzo, y eso es lo que vive aqui.
//
// EL TAMAÑO, medido contra lo que ella puede hacer:
//   Ella mide 167 px visibles y de pie alcanza 98 (su hombro) + 74 (el tajo
//   corto) = 172 px de altura.
//   Saltando, el apex REAL es 116.2 px -- NO los 123.3 que da la formula
//   JUMP_V^2/(2*GRAV_UP). La diferencia son 7 px y viene del integrador de
//   Euler a 60 fps, que es como se mueve el juego de verdad. Medir con la
//   formula aqui habria dejado la cara del ogro 7 px fuera de alcance.
//   Asi que saltando llega a 116 + 98 + 30 = 244 px.
//
//   Con el cuerpo a 232 px: de pie le pegas al vientre (172 < 232) y para
//   darle en la CARA (la mandibula esta a 178) hay que saltar. Eso es
//   exactamente lo que pide un jefe grande: que la altura sea una decision.
export const W = 300, H = 268;   // el lienzo de un fotograma del ogro
export const EJE = 128;          // donde cae el eje del cuerpo dentro del lienzo
export const PIES = 260;         // la fila donde apoya los pies
export const ALTO_CUERPO = 232;  // de la coronilla al suelo
export const ALTO_MANDIBULA = 178;

// ---------- Paleta ----------
// VERDE OLIVA, y el eje de TONO es lo que la separa de todo lo demas: ella es
// rosa y oro, el fondo marron y granate, el ogro verde. A tamaño de juego el
// tono se lee antes que la forma.
//
// LA RAMPA DE PIEL va en saltos de 30-41 de luminancia (37/67/107/148/189).
// Muy por encima de los ~14 en que dos tonos vecinos COLAPSAN al encoger, que
// es el fallo que ya costo caro en la cara de ella.
export const P = {
  // El contorno: casi negro con tiro verde. Da 17.0 de contraste contra el
  // suelo por el que camina -- mejor que el de ella (15.7), que ya se acepto.
  out:  '#0a0f0c',

  pie0: '#1b2c1e',   // piel en sombra profunda (el hueco bajo la joroba)
  pie1: '#33502e',   // piel base
  pie2: '#557f3a',   // piel iluminada
  pie3: '#7cae4c',   // piel al sol
  // LA LUZ DE BORDE. No es decoracion: pie1 (que es el 33% de las celdas del
  // ogro) da solo 8.9 de contraste contra la muralla del fondo y 4.9 contra
  // el suelo claro -- por debajo del umbral de colapso. Una banda de 2-3 px
  // de pie4 por el lado iluminado despega la silueta sin tocar el interior y
  // sin añadir ningun rasgo fino.
  pie4: '#b0d46c',

  cue1: '#2a1a14',   // el cuero de las correas, en sombra
  cue2: '#5a3a22',   // el cuero
  cuer: '#6b4a28',   // los cuernos

  mad1: '#6b6152',   // la madera del garrote, en sombra
  mad2: '#9c9079',   // la madera
  mad3: '#c4b89c',   // la madera al sol

  hue1: '#c9bc92',   // hueso: el alero de la frente, los colmillos
  hue2: '#f2e8c4',   // hueso iluminado

  ojo:  '#ff4a1e',   // los ojos: naranja incandescente. El unico calido del
                     // cuerpo, y lo que lo hace mirar.
  dien: '#ffd24a',   // los dientes de abajo
};

// Cuanto mide el ogro en "Rominas", para las pruebas.
export const EN_ROMINAS = ALTO_CUERPO / 167;
