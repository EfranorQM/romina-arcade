// LA ARENA - como se DIBUJA. El salon del castillo (CraftPix, ver
// tools/arena-atlas.py) y las piezas que caen o se pisan en el. La logica vive
// en caba-arena.js, sin DOM; aqui solo se pinta lo que ella dice.
//
// Todo va a x2, como ella: el salon esta dibujado a 480x270 (alargado a 600) y
// se pinta a 1200x540, la misma densidad de pixel que la caballera.

import { PIEZAS, ESCALA, LLAMAS } from './arena-atlas.js';
import { REPISAS, TIPOS, AVISO_T, VIDA_ESCOMBRO } from './caba-arena.js';
import { SUELO } from './caba-cuerpo.js';

const HOJA = new Image();
HOJA.src = new URL('../../img/arena.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
// Para las vistas previas de tools/ (espera a 'load', no a decode(): ver
// cargaOgro en ogro-sprite.js).
export function cargaArena() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// Colores para lo que la escena pinta encima: polvo de piedra, astillas de la
// alfombra, las grietas del pisoton. Sacados del salon.
export const P = {
  polvo1: '#e2d8c2',   // polvo de piedra, claro
  polvo2: '#b8ab98',
  polvo3: '#7c6f66',   // la sombra de la piedra
  alfom1: '#9a3a40',   // la alfombra
  alfom2: '#5a1e24',   // la alfombra en sombra (grietas)
  grieta: '#2e0e12',
};

function pieza(g, nom, x, y) {
  const [sx, sy, w, h] = PIEZAS[nom];
  g.drawImage(HOJA, sx, sy, w, h, Math.round(x), Math.round(y), w * ESCALA, h * ESCALA);
}

// Una elipse de sombra por bandas de 1 px (como la de ella: sin antialias).
function sombra(g, x, y, rx, ry, a) {
  g.globalAlpha = a; g.fillStyle = '#000000';
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const u = dy / ry;
    if (u * u > 1) continue;
    const w = rx * Math.sqrt(1 - u * u);
    g.fillRect(Math.round(x - w), Math.round(y + dy), Math.round(w * 2), 1);
  }
  g.globalAlpha = 1;
}

// EL FONDO: el salon entero y las velas. `t` es el reloj de la escena.
export function drawSalon(g, t) {
  if (!lista()) { g.fillStyle = '#2b1f2e'; g.fillRect(0, 0, 1200, 540); return; }
  pieza(g, 'salon', 0, 0);
  // Las velas parpadean: un halo que respira a destiempo en cada una. Es poco
  // (un 12 % de brillo arriba o abajo), pero es lo que hace que el salon este
  // vivo en vez de ser una foto.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < LLAMAS.length; i++) {
    const [lx, ly] = LLAMAS[i];
    const f = 0.5 + 0.5 * Math.sin(t * (5.3 + (i % 5) * 0.7) + i * 1.7) * Math.sin(t * 2.1 + i);
    g.globalAlpha = 0.06 + 0.08 * f;
    g.fillStyle = '#ffb040';
    const x = Math.round(lx * ESCALA), y = Math.round(ly * ESCALA);
    g.fillRect(x - 5, y - 7, 10, 12);
    g.fillRect(x - 3, y - 11, 6, 20);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// LAS REPISAS, con la sombra que dejan en el suelo: es lo que dice que flotan
// a media altura y no que estan pintadas en la pared.
export function drawRepisas(g) {
  if (!lista()) return;
  for (const r of REPISAS) {
    sombra(g, (r.x0 + r.x1) / 2, SUELO - 2, (r.x1 - r.x0) / 2 - 10, 7, 0.28);
    pieza(g, 'repisa', r.x0 - 2, r.y - 2);
  }
}

// LOS ESCOMBROS, apoyados en el suelo. El ultimo segundo y medio antes de
// desmoronarse parpadean: asi no desaparecen de golpe con ella subida encima.
export function drawEscombros(g, A) {
  if (!lista()) return;
  for (const e of A.escombros) {
    const [, , w, h] = PIEZAS['cascote' + e.tipo];
    const queda = VIDA_ESCOMBRO - e.t;
    if (queda < 1.5 && ((queda * 10) | 0) & 1) continue;
    sombra(g, e.x, SUELO - 2, e.ancho / 2 + 4, 5, 0.3);
    pieza(g, 'cascote' + e.tipo, e.x - w * ESCALA / 2, SUELO + 6 - h * ESCALA);
  }
}

// LAS PIEDRAS que caen, en dos capas: la SOMBRA va en el suelo, por detras de
// ella y del ogro; la PIEDRA, por delante de todo (le cae encima).
// Primero el AVISO: una sombra que crece y un hilo de polvo que se escurre de
// la boveda justo encima. Luego la piedra cayendo, con la sombra cada vez mas
// negra.
export function drawSombrasPiedras(g, A) {
  if (!lista()) return;
  for (const p of A.piedras) {
    const T = TIPOS[p.tipo];
    const cerca = p.fase === 'aviso' ? (p.t / AVISO_T) * 0.6 : 0.6 + 0.4 * Math.min(1, (p.y + 60) / (SUELO + 60));
    sombra(g, p.x, SUELO - 2, (T.ancho / 2) * (0.5 + 0.5 * cerca), 5 + 3 * cerca, 0.15 + 0.35 * cerca);
  }
}

export function drawPiedras(g, A, t) {
  if (!lista()) return;
  for (const p of A.piedras) {
    const [, , w, h] = PIEZAS['cascote' + p.tipo];
    if (p.fase === 'aviso') {
      // polvo que se escurre de la boveda: tres granos que bajan a destiempo
      g.fillStyle = P.polvo2;
      for (let k = 0; k < 3; k++) {
        const fy = ((t * 380 + k * 97 + p.id * 53) % 300);
        g.fillRect(Math.round(p.x - 8 + k * 7), Math.round(fy), 3, 3);
      }
      continue;
    }
    // la piedra cayendo
    pieza(g, 'cascote' + p.tipo, p.x - w * ESCALA / 2, p.y - h * ESCALA);
  }
}
