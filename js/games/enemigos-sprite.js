// LOS ENEMIGOS - como se DIBUJAN. Los dibujos (tools/enemigos-atlas.py) y lo
// que la escena pinta encima: su sombra, el destello al recibir, el temblor
// del aviso de la acometida, los puntos de vida y las bolas de fuego. La
// logica vive en caba-enemigos.js, sin DOM.

import { LOBO, KITSUNE, FUEGO } from './enemigos-atlas.js';
import * as EN from './caba-enemigos.js';
import { sombra } from './bosque-sprite.js';

const HOJA = new Image();
HOJA.src = new URL('../../img/enemigos.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
export function cargaEnemigos() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// Colores para lo que la escena pinta encima (chispas, polvo, sangre).
export const P = {
  lobo1: '#2c2c3c', lobo2: '#5a5a70', sangre: '#8b1a2b',
  kitsune1: '#ffd27a', kitsune2: '#8e1c2c',
  fuego1: '#6be8ff', fuego2: '#1e9cd8', fuego3: '#e8ffff',
  oro: '#ffe066',
};

const ATLAS = { lobo: LOBO, kitsune: KITSUNE };
// Cuantos fotogramas tiene cada animacion (lo que necesita EN.pose).
const CUENTA = {};
for (const [k, A] of Object.entries(ATLAS)) {
  CUENTA[k] = {};
  for (const [n, f] of Object.entries(A)) CUENTA[k][n] = f.length;
}

// La silueta blanca (el destello del golpe), hecha una vez.
let BLANCA = null;
function blanca() {
  if (BLANCA || !lista()) return BLANCA;
  const cv = document.createElement('canvas');
  cv.width = HOJA.naturalWidth; cv.height = HOJA.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(HOJA, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
  BLANCA = cv;
  return cv;
}

function pinta(g, img, x, y, dir, fr) {
  const [sx, sy, w, h, ox, oy] = fr;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (dir < 0) g.scale(-1, 1);
  g.drawImage(img, sx, sy, w, h, ox, oy, w, h);
  g.restore();
}

// UN ENEMIGO, con su sombra. `cx` es la camara.
export function drawEnemigo(g, E, cx, t) {
  if (!lista()) return;
  if (E.st === EN.MUERTO && E.muertoT > 2) return;
  const x = E.x - cx;
  if (x < -200 || x > 1400) return;
  const [anim, k] = EN.pose(E, CUENTA[E.tipo]);
  const arr = ATLAS[E.tipo][anim] || ATLAS[E.tipo].idle;
  const fr = arr[Math.min(k, arr.length - 1)];
  // Tumbado se desvanece: del segundo 1.2 al 2.
  const a = E.st === EN.MUERTO ? Math.max(0, Math.min(1, (2 - E.muertoT) / 0.8)) : 1;
  sombra(g, x, E.y + 2, E.T.ancho + 10, 6, 0.32 * a);
  // LA ACOMETIDA SE VE VENIR: agachado, tiembla (como el ogro en su finta).
  const tiembla = E.st === EN.AVISO && E.atk === 'acomete' ? (((t * 40) | 0) & 1 ? 2 : -2) : 0;
  g.globalAlpha = a;
  pinta(g, HOJA, x + tiembla, E.y, E.dir, fr);
  if (E.flash > 0) {
    const B = blanca();
    if (B) { g.globalAlpha = Math.min(1, E.flash / 0.1) * 0.8 * a; pinta(g, B, x + tiembla, E.y, E.dir, fr); }
  }
  g.globalAlpha = 1;
  // LA VIDA: puntos sobre la cabeza, solo si ya le han dado (y no a los que
  // estan enteros: el camino se llenaria de marcadores).
  if (E.vivo && E.hp < E.hpMax) {
    const y = E.y - E.T.alto - 22, w = E.hpMax * 12;
    for (let i = 0; i < E.hpMax; i++) {
      g.fillStyle = '#10080c'; g.fillRect(Math.round(x - w / 2 + i * 12), y, 10, 6);
      g.fillStyle = i < E.hp ? '#e83a5a' : '#3a2030'; g.fillRect(Math.round(x - w / 2 + i * 12) + 1, y + 1, 8, 4);
    }
  }
}

// LAS BOLAS DE FUEGO: la bola del pack girando, con su halo; al chocar, el
// estallido (los ultimos fotogramas del pack). La devuelta por una parada
// lleva el halo de oro: ahora es de ella.
export function drawFuego(g, F, cx) {
  if (!lista()) return;
  const x = F.x - cx;
  if (x < -120 || x > 1320) return;
  const n = FUEGO.vuela.length;
  const k = F.fin > 0 ? Math.min(n - 1, 5 + Math.floor(F.fin / 0.36 * (n - 5))) : Math.floor(F.t / 0.06) % 5;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = F.fin > 0 ? 0.25 : 0.35;
  g.fillStyle = F.propio ? P.oro : P.fuego2;
  g.fillRect(Math.round(x - 22), Math.round(F.y - 22), 44, 44);
  g.globalAlpha = F.fin > 0 ? 0.15 : 0.2;
  g.fillRect(Math.round(x - 34), Math.round(F.y - 14), 68, 28);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  pinta(g, HOJA, x, F.y, F.vx > 0 ? 1 : -1, FUEGO.vuela[k]);
}
