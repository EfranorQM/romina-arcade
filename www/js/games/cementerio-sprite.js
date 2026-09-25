// EL CEMENTERIO - como se DIBUJA. Las capas del pack (tools/cementerio-atlas.py)
// y las piezas del nivel, con la MISMA CARA que bosque-sprite.js (drawFondo,
// drawHoguera, drawTroncos, drawSombrasRamas, drawRamas, P): la escena elige
// el modulo segun el nivel y pinta igual.
//
// Todo va a x2, como ella. Las capas lejanas corren mas despacio (PARALAJE);
// el suelo corre con ella. Entre dos tramos de suelo, una tumba abierta.

import { PIEZAS, ESCALA, PERIODO, FILA, CRIPTA, ARBOL } from './cementerio-atlas.js';
import { TRONCO_R, tramos } from './caba-nivel.js';
import { sombra } from './bosque-sprite.js';

const HOJA = new Image();
HOJA.src = new URL('../../img/cementerio.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
export function cargaCementerio() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// Colores para lo que la escena pinta encima (polvo, astillas, chispas). Los
// mismos nombres que en el bosque: la escena no sabe en que nivel esta.
export const P = {
  polvo1: '#c8cf9a', polvo2: '#828f58', polvo3: '#535d4e',
  hoja1: '#b8f06e', hoja2: '#4b5235',
  madera1: '#f1e6b3', madera2: '#8d8959', corteza: '#26291c',
  foso: '#0a0b09',
  fuego1: '#b8f06e', fuego2: '#75a64e',
};

const PARALAJE = { cielo: 0.04, lapidas: 0.16, arboles: 0.28, muro: 0.55 };
const TILE = PERIODO * ESCALA;          // 960 px de pantalla por repeticion

function pieza(g, nom, x, y) {
  const [sx, sy, w, h] = PIEZAS[nom];
  g.drawImage(HOJA, sx, sy, w, h, Math.round(x), Math.round(y), w * ESCALA, h * ESCALA);
}
function capa(g, nom, cx, factor, VW) {
  const y = FILA[nom] * ESCALA;
  let x = -(((cx * factor) % TILE) + TILE) % TILE;
  for (; x < VW; x += TILE) pieza(g, nom, x, y);
}

// EL FONDO: del cielo al suelo, con la cripta al final y el arbol del cristal
// donde diga el nivel.
export function drawFondo(g, N, cx, VW, VH, t) {
  if (!lista()) { g.fillStyle = '#2b3024'; g.fillRect(0, 0, VW, VH); return; }
  capa(g, 'cielo', cx, PARALAJE.cielo, VW);
  capa(g, 'lapidas', cx, PARALAJE.lapidas, VW);
  capa(g, 'arboles', cx, PARALAJE.arboles, VW);
  // LA CRIPTA, al final del camino: la salida (como el arbol con cara).
  const cw = (CRIPTA.x1 - CRIPTA.x0) * ESCALA;
  const kx = N.def.arbol - cx - cw / 2;
  if (kx < VW && kx > -cw) {
    pieza(g, 'cripta', kx, CRIPTA.y0 * ESCALA);
    // sus ventanas verdes laten
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.12 + 0.08 * Math.sin(t * 2.2);
    g.fillStyle = '#75a64e';
    g.fillRect(Math.round(kx + 14), Math.round(CRIPTA.y0 * ESCALA + 110), cw - 28, 120);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  capa(g, 'muro', cx, PARALAJE.muro, VW);
  // EL ARBOL DEL CRISTAL, un hito (y su cristal late)
  const aw = (ARBOL.x1 - ARBOL.x0) * ESCALA;
  for (const ax0 of N.def.hitos || []) {
    const ax = ax0 - cx - aw / 2;
    if (ax > VW || ax < -aw) continue;
    pieza(g, 'arbolCristal', ax, ARBOL.y0 * ESCALA);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.18 + 0.12 * Math.sin(t * 3.1 + ax0);
    g.fillStyle = '#b8f06e';
    g.fillRect(Math.round(ax + aw * 0.43), Math.round(ARBOL.y0 * ESCALA + 150), Math.round(aw * 0.14), 70);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  // LOS FUEGOS FATUOS: luces verdes que suben despacio y se apagan (las
  // luciernagas del bosque, aqui almas).
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const fx = (i * 211.7 + t * (6 + (i % 4) * 3)) % 1400 - 100;
    const x = ((fx - cx * 0.55) % 1400 + 1400) % 1400 - 100;
    const y = 300 - ((t * (10 + (i % 3) * 5) + i * 71) % 240) + Math.sin(t * 1.3 + i) * 8;
    const a = Math.max(0, Math.sin(t * (0.8 + (i % 4) * 0.25) + i * 1.7));
    if (a < 0.05) continue;
    g.globalAlpha = 0.45 * a; g.fillStyle = '#b8f06e';
    g.fillRect(Math.round(x) - 2, Math.round(y) - 3, 4, 6);
    g.globalAlpha = 0.15 * a;
    g.fillRect(Math.round(x) - 6, Math.round(y) - 7, 12, 14);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // El suelo de detras: entero, tambien sobre las tumbas.
  capa(g, 'sueloFondo', cx, 1, VW);
  // EL PISO, por tramos: entre dos tramos, la tumba abierta.
  const yPiso = FILA.sueloPiso * ESCALA;
  for (const [x0, x1] of tramos(N.def)) {
    const a = Math.max(x0 - cx, 0), b = Math.min(x1 - cx, VW);
    if (b <= a) continue;
    g.save();
    g.beginPath(); g.rect(Math.round(a), yPiso, Math.round(b - a), VH - yPiso); g.clip();
    let x = -((cx % TILE) + TILE) % TILE;
    for (; x < VW; x += TILE) pieza(g, 'sueloPiso', x, yPiso);
    g.restore();
  }
  const [, , fw, fh] = PIEZAS.fosoFondo;
  for (const [x0, x1] of N.def.fosos) {
    const a = Math.round(x0 - cx), b = Math.round(x1 - cx);
    if (b < -20 || a > VW + 20) continue;
    g.save();
    g.beginPath(); g.rect(a, yPiso, b - a, VH - yPiso); g.clip();
    for (let x = a; x < b; x += fw * ESCALA) pieza(g, 'fosoFondo', x, yPiso);
    g.fillStyle = P.foso; g.fillRect(a, yPiso + fh * ESCALA, b - a, VH - yPiso - fh * ESCALA);
    g.restore();
    pieza(g, 'fosoI', a, yPiso);
    pieza(g, 'fosoD', b - PIEZAS.fosoD[2] * ESCALA, yPiso);
  }
  // LAS LAPIDAS de la tumba ancha (lo que en el bosque es un tocon).
  for (const T of N.tocones) {
    const x = (T.x0 + T.x1) / 2 - cx - (PIEZAS.lapida[2] * ESCALA) / 2;
    if (x > VW || x < -120) continue;
    pieza(g, 'lapida', x, T.top - 8);
  }
}

// LAS HOGUERAS: una pira de huesos; encendida, con fuego verde y su luz.
export function drawHoguera(g, N, cx, t) {
  for (const hx of N.def.hogueras) una(g, hx - cx, N.def.suelo, hx <= N.hoguera, t);
}
function una(g, x, y, encendida, t) {
  if (x < -100 || x > 1300) return;
  const [, , w, h] = PIEZAS.hoguera;
  sombra(g, x, y + 2, 34, 5, 0.3);
  if (encendida) {
    g.globalCompositeOperation = 'lighter';
    const f = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3);
    g.globalAlpha = 0.12 * f; g.fillStyle = P.fuego2;
    g.fillRect(Math.round(x - 90), y - 120, 180, 130);
    g.globalAlpha = 0.12 * f;
    g.fillRect(Math.round(x - 50), y - 80, 100, 90);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  pieza(g, 'hoguera', x - (w * ESCALA) / 2, y - h * ESCALA + 4);
  if (encendida) {
    const k = Math.floor(t * 10) % 4;
    const [, , fw, fh] = PIEZAS['fuego' + k];
    pieza(g, 'fuego' + k, x - (fw * ESCALA) / 2, y - h * ESCALA - fh * ESCALA + 12);
  } else {
    // apagada: un hilo de humo verdoso
    g.fillStyle = '#5e673d';
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.6 + i / 3) % 1);
      g.globalAlpha = 0.5 * (1 - u);
      g.fillRect(Math.round(x - 3 + Math.sin(u * 6 + i) * 6), Math.round(y - 20 - u * 70), 6, 6);
    }
    g.globalAlpha = 1;
  }
}

// LAS CALAVERAS que ruedan (lo que en el bosque son troncos), con su sombra.
export function drawTroncos(g, N, cx) {
  const [, , w, h] = PIEZAS.calavera0;
  for (const T of N.troncos) {
    const x = T.x - cx;
    if (x < -80 || x > 1300) continue;
    if (!T.cae) sombra(g, x, N.def.suelo + 2, TRONCO_R + 2, 5, 0.35);
    const k = (((Math.round(-T.giro / (Math.PI / 4)) % 8) + 8) % 8);
    pieza(g, 'calavera' + k, x - (w * ESCALA) / 2, T.y - h * ESCALA + 6);
  }
}

// En el cementerio no caen ramas.
export function drawSombrasRamas() {}
export function drawRamas() {}
