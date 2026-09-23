// ROMINA - como se DIBUJA.
//
// Es una caballera PINTADA A MANO en pixel art ("FemaleKnight" de retsuto, con
// el pelo y los ojos negros; ver tools/romina-atlas.py). Este modulo no elige
// la pose: eso lo hace C.pose() en caba-cuerpo.js, que el arnes de Node puede
// comprobar sin navegador. Aqui solo se pone el fotograma en su sitio.
//
// POR QUE SE CAMBIO: la Romina de antes era una muñeca compuesta por codigo
// (una pose de ~20 numeros sobre piezas rigidas) y, tras muchas rondas de
// ajuste, sus animaciones seguian sin vida. Lo mismo que el ogro.

import { FRAMES } from './romi-atlas.js';

// ---------- La hoja ----------
// Se pide al importar, no al entrar en la pelea: para cuando ella sale ya esta.
const HOJA = new Image();
HOJA.src = new URL('../../img/romina.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
// Para las vistas previas de tools/ (ver cargaOgro en ogro-sprite.js: se espera
// a 'load' y no a decode(), por el reloj virtual de tools/ver.js).
export function cargaRomina() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// ---------- Paleta ----------
// Para lo que la escena pinta de ella sin ser ella: los corazones, las chispas
// de la espada al parar, la sangre. Son los colores de la hoja, con los mismos
// nombres que usaba la Romina de antes para no tocar la escena.
export const P = {
  ves2: '#f04830',   // el rojo de la falda
  ves3: '#d83018',
  ves4: '#ffc0c0',   // el brillo del corazon
  ace2: '#a8a8a8',   // el acero
  ace3: '#d8d8d8',
  ace4: '#ffffff',
  oro3: '#ffc060',   // la empuñadura
};

// La SILUETA BLANCA de la hoja: el destello del golpe recibido. Se hace una
// vez, cuando la hoja ya ha llegado (antes no hay de donde sacarla).
let BLANCA = null;
function blanca() {
  if (BLANCA || !lista()) return BLANCA;
  const cv = document.createElement('canvas');
  cv.width = HOJA.naturalWidth; cv.height = HOJA.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(HOJA, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  BLANCA = cv;
  return cv;
}

// Dibuja a Romina con los PIES en (x, y). No hay nada que hornear: la hoja ya
// viene hecha.
//   rastro (0..1): la estela de sombras de la ESQUIVA. Se pasa mientras es
//     invulnerable, que es justo lo que tiene que leerse ("ahora no le entra").
//   blanco (0..1): el destello del golpe recibido, encima del dibujo.
//   haciaX: hacia donde se MUEVE (la estela queda detras de eso, no de hacia
//     donde mira: esquivando hacia atras mira al ogro y se va de espaldas).
export function drawRomina(g, x, y, dir, pose, frame, rastro = 0, blanco = 0, haciaX = dir) {
  if (!lista()) return;
  const arr = FRAMES[pose] || FRAMES.idle;
  const [sx, sy, w, h, ox, oy] = arr[Math.min(frame, arr.length - 1)];
  const px = Math.round(x), py = Math.round(y);
  if (rastro > 0) {
    // Dos sombras por detras, cada vez mas tenues: el salto se ve rapido sin
    // tener mas fotogramas.
    for (const [atras, al] of [[38, 0.16], [19, 0.32]]) {
      g.globalAlpha = al * rastro;
      pinta(g, HOJA, px - haciaX * atras, py, dir, sx, sy, w, h, ox, oy);
    }
    g.globalAlpha = 1;
  }
  pinta(g, HOJA, px, py, dir, sx, sy, w, h, ox, oy);
  const B = blanco > 0 ? blanca() : null;
  if (B) {
    g.globalAlpha = Math.min(1, blanco);
    pinta(g, B, px, py, dir, sx, sy, w, h, ox, oy);
    g.globalAlpha = 1;
  }
}

function pinta(g, img, px, py, dir, sx, sy, w, h, ox, oy) {
  g.save();
  g.translate(px, py);
  if (dir < 0) g.scale(-1, 1);
  g.drawImage(img, sx, sy, w, h, ox, oy, w, h);
  g.restore();
}
