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

import { FRAMES, TINTES } from './romi-atlas.js';

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

// ---------- EL ARMARIO: la hoja teñida ----------
// `t` = { capa, falda, ribete, estela }: los tonos nuevos, de oscuro a claro,
// en el orden de TINTES (ver tintesDe en caba-partida.js). Se tiñe cambiando
// COLORES EXACTOS: la hoja tiene 40 y la capa, la falda y la estela tienen los
// suyos propios (la estela, con blancos que solo usa ella). Cuesta recorrer la
// hoja una vez (unas decenas de ms), asi que cada traje se tiñe una sola vez y
// se guarda. Sin traje (o con el de siempre), se dibuja la hoja original.
const tenidas = new Map();
let vestida = null;          // la hoja con la que se dibuja (null = la original)
let pendiente = null;        // un traje pedido antes de que llegara la hoja
export function vestir(t) {
  if (!lista()) { pendiente = t; return; }
  pendiente = null;
  const clave = JSON.stringify(t);
  const igual = (a, b) => a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
  if (!t || (igual(t.capa, TINTES.capa) && igual(t.falda, TINTES.falda) && igual(t.ribete, TINTES.ribete)
             && igual(t.estela, ['#eaeaea', '#f0f0f0', '#ffffff']))) { vestida = null; return; }
  if (!tenidas.has(clave)) tenidas.set(clave, tine(t));
  vestida = tenidas.get(clave);
}
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function tine(t) {
  const cv = document.createElement('canvas');
  cv.width = HOJA.naturalWidth; cv.height = HOJA.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(HOJA, 0, 0);
  const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data;
  const mapa = new Map();
  for (const parte of ['capa', 'falda', 'ribete', 'estela']) {
    TINTES[parte].forEach((de, i) => { const [r, g, b] = rgb(de); mapa.set((r << 16) | (g << 8) | b, rgb(t[parte][i])); });
  }
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = mapa.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (n) { d[i] = n[0]; d[i + 1] = n[1]; d[i + 2] = n[2]; }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

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
  if (pendiente) vestir(pendiente);
  const hoja = vestida || HOJA;
  const arr = FRAMES[pose] || FRAMES.idle;
  const [sx, sy, w, h, ox, oy] = arr[Math.min(frame, arr.length - 1)];
  const px = Math.round(x), py = Math.round(y);
  if (rastro > 0) {
    // Dos sombras por detras, cada vez mas tenues: el salto se ve rapido sin
    // tener mas fotogramas.
    for (const [atras, al] of [[38, 0.16], [19, 0.32]]) {
      g.globalAlpha = al * rastro;
      pinta(g, hoja, px - haciaX * atras, py, dir, sx, sy, w, h, ox, oy);
    }
    g.globalAlpha = 1;
  }
  pinta(g, hoja, px, py, dir, sx, sy, w, h, ox, oy);
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
