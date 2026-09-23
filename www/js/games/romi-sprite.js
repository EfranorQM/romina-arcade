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

// Dibuja a Romina con los PIES en (x, y). No hay nada que hornear: la hoja ya
// viene hecha. `rastro` (0..1) es la estela de sombras de la rodada: se pasa
// mientras es invulnerable, que es justo lo que tiene que leerse ("ahora no
// le entra").
export function drawRomina(g, x, y, dir, pose, frame, rastro = 0) {
  if (!lista()) return;
  const arr = FRAMES[pose] || FRAMES.idle;
  const [sx, sy, w, h, ox, oy] = arr[Math.min(frame, arr.length - 1)];
  const px = Math.round(x), py = Math.round(y);
  if (rastro > 0) {
    // Dos sombras por detras, cada vez mas tenues: el deslizamiento se ve
    // rapido sin tener mas fotogramas.
    for (const [atras, al] of [[34, 0.18], [17, 0.34]]) {
      g.globalAlpha = al * rastro;
      pinta(g, px - dir * atras, py, dir, sx, sy, w, h, ox, oy);
    }
    g.globalAlpha = 1;
  }
  pinta(g, px, py, dir, sx, sy, w, h, ox, oy);
}

function pinta(g, px, py, dir, sx, sy, w, h, ox, oy) {
  g.save();
  g.translate(px, py);
  if (dir < 0) g.scale(-1, 1);
  g.drawImage(HOJA, sx, sy, w, h, ox, oy, w, h);
  g.restore();
}
