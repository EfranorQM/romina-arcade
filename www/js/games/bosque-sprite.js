// EL BOSQUE - como se DIBUJA. Las capas del pack (tools/bosque-atlas.py) y las
// piezas del nivel. La logica vive en caba-nivel.js, sin DOM; aqui solo se
// pinta lo que el dice.
//
// Todo va a x2, como ella. Las capas lejanas corren mas despacio que el camino
// (PARALAJE): es lo que hace que el bosque tenga fondo en vez de ser un
// decorado pegado. El camino corre con ella, a 1.
//
// `cx` es la camara: la x del nivel que cae en el borde izquierdo de la
// pantalla.

import { PIEZAS, ESCALA, PERIODO, FILA, ARBOL } from './bosque-atlas.js';
import { TRONCO_R, RAMA_AVISO, RAMA_ANCHO, RAMA_Y0, tramos } from './caba-nivel.js';

const HOJA = new Image();
HOJA.src = new URL('../../img/bosque.png', import.meta.url).href;
function lista() { return HOJA.complete && HOJA.naturalWidth > 0; }
export function cargaBosque() {
  return new Promise((ok, mal) => {
    if (lista()) return ok();
    HOJA.addEventListener('load', () => ok(), { once: true });
    HOJA.addEventListener('error', mal, { once: true });
  });
}

// Colores para lo que la escena pinta encima (polvo, astillas, chispas).
export const P = {
  polvo1: '#cecb85', polvo2: '#adaa6d', polvo3: '#6e6c37',
  hoja1: '#879661', hoja2: '#4c5f40',
  madera1: '#cecb85', madera2: '#8b7347', corteza: '#3a2d24',
  foso: '#0b0907',
  fuego1: '#ffe066', fuego2: '#ff9628',
};

// Las capas y cuanto corren respecto al camino.
const PARALAJE = { lejos: 0.12, arboles: 0.3, helechos: 0.62, lianas: 0.8 };
const TILE = PERIODO * ESCALA;          // 960 px de pantalla por repeticion

function pieza(g, nom, x, y) {
  const [sx, sy, w, h] = PIEZAS[nom];
  g.drawImage(HOJA, sx, sy, w, h, Math.round(x), Math.round(y), w * ESCALA, h * ESCALA);
}

// Una capa repetida a lo ancho de la pantalla, corrida segun su paralaje.
function capa(g, nom, cx, factor, VW) {
  const y = FILA[nom] * ESCALA;
  let x = -(((cx * factor) % TILE) + TILE) % TILE;
  for (; x < VW; x += TILE) pieza(g, nom, x, y);
}

// Una elipse de sombra por bandas de 1 px (sin antialias, como la de ella).
export function sombra(g, x, y, rx, ry, a) {
  g.globalAlpha = a; g.fillStyle = '#000000';
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const u = dy / ry;
    if (u * u > 1) continue;
    const w = rx * Math.sqrt(1 - u * u);
    g.fillRect(Math.round(x - w), Math.round(y + dy), Math.round(w * 2), 1);
  }
  g.globalAlpha = 1;
}

// EL FONDO: todo lo que va por detras de ella, del cielo al camino.
export function drawBosque(g, N, cx, VW, VH, t) {
  if (!lista()) { g.fillStyle = '#2d3226'; g.fillRect(0, 0, VW, VH); return; }
  capa(g, 'lejos', cx, PARALAJE.lejos, VW);
  capa(g, 'arboles', cx, PARALAJE.arboles, VW);
  capa(g, 'helechos', cx, PARALAJE.helechos, VW);
  capa(g, 'lianas', cx, PARALAJE.lianas, VW);
  // Las luciernagas: puntos que se encienden y se apagan, derivando. Las del
  // pack eran quietas; estas viven.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const fx = (i * 173.3 + t * (9 + (i % 5) * 3)) % 1400 - 100;
    const x = ((fx - cx * 0.62) % 1400 + 1400) % 1400 - 100;
    const y = 70 + ((i * 97) % 190) + Math.sin(t * 0.9 + i) * 10;
    const a = Math.max(0, Math.sin(t * (1.1 + (i % 4) * 0.3) + i * 2.1));
    if (a < 0.05) continue;
    g.globalAlpha = 0.5 * a; g.fillStyle = '#e8ff9a';
    g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    g.globalAlpha = 0.18 * a;
    g.fillRect(Math.round(x) - 5, Math.round(y) - 5, 10, 10);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // La hierba de detras del camino: entera, tambien sobre los fosos.
  capa(g, 'caminoFondo', cx, 1, VW);

  // EL ARBOL CON CARA, al final del camino (su tronco centrado en def.arbol).
  const ax = N.def.arbol - cx - ((ARBOL.x1 - ARBOL.x0) * ESCALA) / 2;
  if (ax < VW && ax > -(ARBOL.x1 - ARBOL.x0) * ESCALA) pieza(g, 'arbol', ax, ARBOL.y0 * ESCALA);

  // EL PISO del camino, por tramos: entre dos tramos, el foso.
  const yPiso = FILA.caminoPiso * ESCALA;
  for (const [x0, x1] of tramos(N.def)) {
    const a = Math.max(x0 - cx, 0), b = Math.min(x1 - cx, VW);
    if (b <= a) continue;
    g.save();
    g.beginPath(); g.rect(Math.round(a), yPiso, Math.round(b - a), VH - yPiso); g.clip();
    let x = -((cx % TILE) + TILE) % TILE;
    for (; x < VW; x += TILE) pieza(g, 'caminoPiso', x, yPiso);
    g.restore();
  }
  // LOS FOSOS: al asomarse se ve la pared del fondo, de tierra, que se hunde
  // en negro; y a los lados, el corte del camino.
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
  // LOS TOCONES del foso ancho.
  for (const T of N.tocones) {
    const x = (T.x0 + T.x1) / 2 - cx - (PIEZAS.tocon[2] * ESCALA) / 2;
    if (x > VW || x < -120) continue;
    pieza(g, 'tocon', x, T.top - 8);
  }
}

// LAS HOGUERAS: apagadas hasta que llega; encendidas, con su luz.
export function drawHoguera(g, N, cx, t) {
  for (const hx of N.def.hogueras) una(g, hx - cx, N.def.suelo, hx <= N.hoguera, t);
}
function una(g, x, y, encendida, t) {
  if (x < -100 || x > 1300) return;
  const [, , w, h] = PIEZAS.hoguera;
  sombra(g, x, y + 2, 34, 5, 0.3);
  if (encendida) {
    // la luz en el suelo y en el aire
    g.globalCompositeOperation = 'lighter';
    const f = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3);
    g.globalAlpha = 0.10 * f; g.fillStyle = P.fuego2;
    g.fillRect(Math.round(x - 90), y - 120, 180, 130);
    g.globalAlpha = 0.10 * f;
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
    // apagada: un hilo de humo
    g.fillStyle = '#6a6a60';
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.6 + i / 3) % 1);
      g.globalAlpha = 0.5 * (1 - u);
      g.fillRect(Math.round(x - 3 + Math.sin(u * 6 + i) * 6), Math.round(y - 20 - u * 70), 6, 6);
    }
    g.globalAlpha = 1;
  }
}

// LOS TRONCOS que ruedan, con su sombra en el camino.
export function drawTroncos(g, N, cx) {
  const [, , w, h] = PIEZAS.tronco0;
  for (const T of N.troncos) {
    const x = T.x - cx;
    if (x < -80 || x > 1300) continue;
    if (!T.cae) sombra(g, x, N.def.suelo + 2, TRONCO_R + 4, 5, 0.35);
    const k = (((Math.round(-T.giro / (Math.PI / 4)) % 8) + 8) % 8);
    pieza(g, 'tronco' + k, x - (w * ESCALA) / 2, T.y - h * ESCALA + 2);
  }
}

// LAS RAMAS: primero su sombra (el aviso), luego la rama girando al caer.
export function drawSombrasRamas(g, N, cx) {
  for (const R of N.ramas) {
    const x = R.x - cx;
    const cerca = R.fase === 'aviso' ? (R.t / RAMA_AVISO) * 0.6 : 0.6 + 0.4 * Math.min(1, (R.y - RAMA_Y0) / (N.def.suelo - RAMA_Y0));
    sombra(g, x, N.def.suelo + 2, (RAMA_ANCHO / 2) * (0.5 + 0.5 * cerca), 4 + 3 * cerca, 0.15 + 0.35 * cerca);
  }
}
export function drawRamas(g, N, cx, t) {
  for (const R of N.ramas) {
    const x = R.x - cx;
    if (R.fase === 'aviso') {
      // LA RAMA, ARRIBA, TEMBLANDO cada vez mas antes de soltarse, y hojas
      // claras que se desprenden (sobre el verde oscuro del bosque).
      const u = Math.min(1, R.t / RAMA_AVISO);
      const tiembla = Math.round(Math.sin(t * 50 + R.id) * (1 + 3 * u));
      const [, , w, h] = PIEZAS.rama0;
      pieza(g, 'rama0', x - (w * ESCALA) / 2 + tiembla, RAMA_Y0 - (h * ESCALA) / 2 - 10);
      g.fillStyle = P.hoja1;
      for (let k = 0; k < 3; k++) {
        const fy = RAMA_Y0 + ((t * 160 + k * 53 + R.id * 41) % 140) * u;
        g.fillRect(Math.round(x - 16 + k * 14 + Math.sin(t * 6 + k) * 6), Math.round(fy), 6, 6);
      }
      continue;
    }
    const k = (((Math.round(R.giro / (Math.PI / 4)) % 8) + 8) % 8);
    const [, , w, h] = PIEZAS['rama' + k];
    pieza(g, 'rama' + k, x - (w * ESCALA) / 2, R.y - (h * ESCALA) / 2 - 10);
  }
}
