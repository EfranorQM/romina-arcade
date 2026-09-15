// EL CABALLERO - el campo de batalla. Cuatro capas con parallax, horneadas
// UNA vez en tiras anchas y repetidas; por frame son cuatro drawImage.
//
// La paleta es de piedra y tormenta: ni un morado de neon. El contraste que
// separa al caballero del fondo es de VALOR -- el fondo vive entre el 8% y el
// 34% de luminancia, y el acero del caballero esta por encima del 55%.

import { P as PC } from './caba-art.js';

export const P = {
  cielo0: '#2b1f2e',   // arriba del todo, casi noche
  cielo1: '#4a2c33',   // banda media
  cielo2: '#7d4436',   // el resplandor del horizonte: una batalla lejana ardiendo
  sol:    '#d9793f',
  lej1:   '#241c26',   // montañas del fondo
  lej2:   '#2e2430',
  cast1:  '#221c28',   // la muralla en ruinas
  cast2:  '#332a3a',
  cast3:  '#413546',
  humo:   '#3a2c33',
  sue1:   '#4a3b33',   // tierra iluminada
  sue2:   '#382c27',   // tierra media
  sue3:   '#241c1a',   // tierra en sombra
  sue4:   '#1a1416',   // el borde de abajo
  hier:   '#5a4a33',   // hierro: lanzas y escudos clavados
  hier2:  '#7a6748',
  sang:   '#5e1a22',   // manchas viejas en la tierra
  hueso:  '#b8a986',
};

// Anchos de cada tira horneada. Se repiten en bucle, asi que el ancho manda
// cuanto tarda en notarse el patron: 800 y 900 no son multiplos, y a
// velocidades distintas el conjunto no se repite nunca a la vista.
const W_CIELO = 1200, W_LEJOS = 1600, W_MURO = 1800, W_SUELO = 1200;

// RNG propio para que el fondo sea SIEMPRE el mismo (no cambia entre partidas:
// es un sitio, no un nivel generado).
function rnd(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function tira(w, h, dibuja) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  dibuja(c, w, h);
  return cv;
}

export function bakeMundo(SUELO, VH) {
  // --- Cielo: bandas horizontales + el resplandor del incendio lejano ---
  const cielo = tira(W_CIELO, SUELO + 4, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.cielo0); g.addColorStop(0.55, P.cielo1);
    g.addColorStop(0.86, P.cielo2); g.addColorStop(1, P.sol);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Nubes de humo: bandas alargadas, mas densas cerca del horizonte.
    const r = rnd(7);
    c.fillStyle = P.humo;
    for (let i = 0; i < 26; i++) {
      const y = h * (0.28 + r() * 0.55);
      const x = r() * w, lw = 40 + r() * 120, lh = 2 + (r() * 3 | 0);
      c.globalAlpha = 0.18 + r() * 0.25;
      c.fillRect(x, y, lw, lh);
      c.fillRect(x + 10, y - lh, lw * 0.6, lh);
    }
    c.globalAlpha = 1;
  });

  // --- Montañas lejanas: dos filas de siluetas ---
  const lejos = tira(W_LEJOS, SUELO + 4, (c, w, h) => {
    const base = h - 52;
    for (const [col, alto, paso, off] of [[P.lej1, 104, 192, 0], [P.lej2, 68, 124, 62]]) {
      c.fillStyle = col;
      const r = rnd(11 + alto);
      for (let x = -paso; x < w + paso; x += paso) {
        const pico = alto * (0.6 + r() * 0.7);
        // Triangulo dibujado por columnas: pixel art, sin bordes suaves
        for (let i = 0; i < paso; i++) {
          const u = i / paso;
          const hh = pico * (1 - Math.abs(u - 0.5) * 2);
          if (hh > 0) c.fillRect(x + off + i, base - hh, 1, hh + 52);
        }
      }
    }
  });

  // --- La muralla en ruinas: bloques con huecos, y estandartes rotos ---
  const muro = tira(W_MURO, SUELO + 4, (c, w, h) => {
    const r = rnd(23);
    const base = h - 20;
    let x = 0;
    while (x < w) {
      const ancho = 68 + (r() * 92 | 0);
      // Alturas MUY dispares (de 24 a 150): con el rango estrecho de antes la
      // muralla se leia como una fila de ladrillos iguales, no como ruinas.
      const alto = r() < 0.3 ? 48 + (r() * 52 | 0) : 120 + (r() * 180 | 0);
      const hueco = r() < 0.22;            // un tramo derruido
      if (!hueco) {
        // Cuerpo del muro
        c.fillStyle = P.cast1; c.fillRect(x, base - alto, ancho, alto + 20);
        c.fillStyle = P.cast2; c.fillRect(x + 1, base - alto + 1, ancho - 2, alto);
        // Cara iluminada a la izquierda de cada torre: le da volumen. Sin
        // esto la muralla es una mancha plana del mismo tono.
        c.fillStyle = P.cast3; c.fillRect(x + 1, base - alto + 1, 6, alto);
        // Grietas: dos o tres cortes verticales que bajan desde arriba
        c.fillStyle = P.cast1;
        for (let k = 0; k < 2 + (r() * 2 | 0); k++) {
          const gx = x + 10 + (r() * (ancho - 20) | 0);
          const gl = 16 + (r() * (alto * 0.5) | 0);
          for (let gy = 0; gy < gl; gy++) c.fillRect(gx + ((gy * 0.18) | 0), base - alto + 8 + gy, 2, 2);
        }
        // Sillares: lineas horizontales cada 7 px, desfasadas
        c.fillStyle = P.cast1;
        for (let y = base - alto + 14; y < base; y += 14) c.fillRect(x + 1, y, ancho - 2, 2);
        for (let y = base - alto + 14, k = 0; y < base; y += 14, k++) {
          const mx = x + 4 + ((k & 1) ? ancho * 0.5 : ancho * 0.25);
          c.fillRect(mx, y - 14, 2, 14);
        }
        // Almenas rotas arriba
        c.fillStyle = P.cast3;
        for (let i = 0; i < ancho; i += 20) {
          if (r() < 0.65) c.fillRect(x + i, base - alto - 12, 12, 14);
        }
        // Un estandarte colgando, de vez en cuando
        if (r() < 0.3) {
          const bx = x + 12 + (r() * (ancho - 28) | 0), by = base - alto + 16;
          const bl = 32 + (r() * 32 | 0);
          c.fillStyle = PC.cap1; c.fillRect(bx, by, 14, bl);
          c.fillStyle = PC.cap2; c.fillRect(bx + 2, by, 10, bl - 6);
          // Roto abajo: dos picos
          c.fillStyle = PC.cap1;
          c.fillRect(bx + 2, by + bl - 6, 4, 6); c.fillRect(bx + 8, by + bl - 8, 4, 8);
        }
      }
      x += ancho + (hueco ? 40 : 4);
    }
  });

  // --- El suelo: tierra en tres tonos, con lanzas, escudos y huesos ---
  const suelo = tira(W_SUELO, VH - SUELO + 60, (c, w, h) => {
    const r = rnd(31);
    // El horizonte de tierra empieza 30 px por encima de SUELO (la parte de
    // atras del campo, que se ve en perspectiva plana)
    c.fillStyle = P.sue2; c.fillRect(0, 0, w, h);
    c.fillStyle = P.sue1; c.fillRect(0, 52, w, 12);
    c.fillStyle = P.sue3; c.fillRect(0, 64, w, h - 64);
    c.fillStyle = P.sue4; c.fillRect(0, h - 20, w, 20);
    // Surcos y piedras
    for (let i = 0; i < 140; i++) {
      const x = r() * w, y = 68 + r() * (h - 96);
      c.fillStyle = r() < 0.5 ? P.sue2 : P.sue4;
      c.fillRect(x, y, 6 + (r() * 24 | 0), 2 + (r() * 4 | 0));
    }
    // Manchas viejas de sangre
    c.globalAlpha = 0.5;
    c.fillStyle = P.sang;
    for (let i = 0; i < 10; i++) {
      const x = r() * w, y = 72 + r() * (h - 104);
      const ww = 16 + (r() * 44 | 0);
      c.fillRect(x, y, ww, 4); c.fillRect(x + 6, y + 4, ww - 14, 2);
    }
    c.globalAlpha = 1;
    // Lanzas clavadas y escudos caidos EN LA FRANJA DE ATRAS (y < 26), para
    // que no estorben a la pelea, que ocurre en la linea del suelo.
    for (let i = 0; i < 20; i++) {
      const x = r() * w, alto = 28 + (r() * 32 | 0);
      const incl = r() < 0.5 ? 1 : -1;
      c.fillStyle = P.hier;
      for (let k = 0; k < alto; k++) c.fillRect(x + ((k * incl * 0.22) | 0), 56 - k, 2, 2);
      c.fillStyle = P.hier2;
      const tx = x + ((alto * incl * 0.22) | 0);
      c.fillRect(tx - 2, 56 - alto - 6, 6, 8);
    }
    for (let i = 0; i < 6; i++) {
      const x = r() * w;
      c.fillStyle = P.hier; c.fillRect(x, 40, 24, 16);
      c.fillStyle = PC.cap1; c.fillRect(x + 4, 42, 16, 12);
      c.fillStyle = P.hier2; c.fillRect(x + 10, 46, 4, 4);
    }
    // Algun hueso suelto
    c.fillStyle = P.hueso;
    for (let i = 0; i < 9; i++) {
      const x = r() * w, y = 36 + r() * 16;
      c.fillRect(x, y, 10, 2); c.fillRect(x - 2, y - 2, 4, 6); c.fillRect(x + 8, y - 2, 4, 6);
    }
  });

  return { cielo, lejos, muro, suelo };
}

// Dibuja el fondo. `camX` es cuanto se ha desplazado la camara.
export function drawMundo(g, W, camX, VW, VH, SUELO) {
  // El cielo apenas se mueve; cada capa mas cercana, mas rapido.
  capa(g, W.cielo, camX * 0.04, 0, VW);
  capa(g, W.lejos, camX * 0.12, 0, VW);
  capa(g, W.muro, camX * 0.30, 0, VW);
  capa(g, W.suelo, camX * 1.00, SUELO - 60, VW);
}

function capa(g, cv, off, y, VW) {
  const w = cv.width;
  let x = -(((off % w) + w) % w);
  while (x < VW) { g.drawImage(cv, Math.round(x), y); x += w; }
}
