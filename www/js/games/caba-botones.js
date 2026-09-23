// LOS MANDOS de ROMINA: cuatro medallones de oro con su icono, y el stick.
//
// Antes eran cuadrados rosas translucidos con el nombre dentro (SALTA, TAJO,
// RUEDA, ESCUDO): parecian botones de depuracion encima de un salon de
// castillo, y ESCUDO nombraba algo que ella no lleva. Ahora cada boton es un
// medallon con aro de oro (como los candelabros del salon), cara de su color
// y un icono en pixel art, con el nombre debajo:
//
//   ATACAR   rojo, una espada          el grande: es el que mas se pulsa
//   SALTAR   azul (su capa), dos flechas hacia arriba
//   ESQUIVAR violeta, un salto en arco con su flecha
//   GUARDIA  acero, la espada de traves parando un golpe
//
// Y cuentan lo que pasa, no solo que se han pulsado: se hunden al apretarlos
// y sueltan un aro; ESQUIVAR se tapa y se vuelve a llenar mientras recarga;
// GUARDIA brilla en oro justo en la ventana de la PARADA (asi se aprende el
// momento); y tras una parada ATACAR late en oro y dice CONTRA.
//
// Todo se hornea UNA vez en init (cada medallon en reposo y apretado, los
// aros, la tapa): un circulo rasterizado pixel a pixel son ~80 rectangulos, y
// cuatro botones con sus capas por frame serian miles.

import { text, measure } from '../font.js';

const OSC = '#1a0e14';                                          // contorno
const ORO = ['#6e3f14', '#b8801f', '#ffd76a', '#fff2b8'];       // sombra .. brillo
const CARAS = {
  atacar:   ['#b8204e', '#8e1140', '#5a0a28'],
  saltar:   ['#3a6cc0', '#24478c', '#152c5c'],
  esquivar: ['#7a48b4', '#533084', '#321b54'],
  guardia:  ['#71829c', '#4a586e', '#2c3444'],
  // los del resultado: OTRA VEZ del color de ATACAR (es el que se quiere
  // pulsar), DIFICULTAD de acero y MENU de azul
  otra:       ['#b8204e', '#8e1140', '#5a0a28'],
  dificultad: ['#71829c', '#4a586e', '#2c3444'],
  menu:       ['#3a6cc0', '#24478c', '#152c5c'],
  // el ARMARIO, en la pantalla de elegir, y LISTO, para salir de el
  armario:    ['#7a48b4', '#533084', '#321b54'],
  listo:      ['#48b070', '#26804a', '#16502e'],
};
// Las caras de las NOTAS del final: oro la S, y luego rosa, azul y gris.
const NOTAS = {
  S: ['#ffe066', '#e0a820', '#a86a10'],
  A: ['#ff8fbc', '#ef4a84', '#a8205a'],
  B: ['#6aa0e8', '#3a6cc0', '#24478c'],
  C: ['#9aa4b4', '#6a7486', '#4a5262'],
};
// Los colores del icono
const IC = {
  k: OSC, w: '#ffffff', s: '#d4dcec', g: '#8a96ac',
  y: '#ffd76a', o: '#b8801f', b: '#7a4424',
};

// ---------- Pixeles ----------
function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Una rejilla de pixeles con nombre de color, que se contornea sola: cualquier
// hueco pegado (en cruz) a un pixel pintado se vuelve contorno. Asi los iconos
// se dibujan con lineas gruesas y el contorno sale siempre parejo.
function rejilla(n) {
  const px = new Array(n * n).fill(null);
  const R = {
    n,
    pon(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < n && y < n) px[y * n + x] = c; },
    // Una linea de grosor g (en pixeles) de (x0,y0) a (x1,y1).
    linea(x0, y0, x1, y1, c, g = 1) {
      const pasos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
      for (let i = 0; i <= pasos; i++) {
        const u = i / pasos, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        for (let a = 0; a < g; a++) for (let b = 0; b < g; b++) R.pon(x + a - (g - 1) / 2, y + b - (g - 1) / 2, c);
      }
    },
    contorno() {
      const antes = px.slice();
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (antes[y * n + x]) continue;
        const v = (xx, yy) => xx >= 0 && yy >= 0 && xx < n && yy < n && antes[yy * n + xx] && antes[yy * n + xx] !== 'k';
        if (v(x - 1, y) || v(x + 1, y) || v(x, y - 1) || v(x, y + 1)) px[y * n + x] = 'k';
      }
    },
    px,
  };
  return R;
}

// ---------- Los iconos (rejilla de 15, se pintan a x3) ----------
const ICONOS = {
  // La espada en diagonal: hoja de acero con el filo claro, gavilanes de oro,
  // puño de cuero y pomo.
  atacar() {
    const R = rejilla(15);
    R.linea(5, 9, 12, 2, 's', 2);
    R.linea(6, 9, 13, 2, 'w', 1);          // el filo que brilla
    R.pon(13, 1, 's');
    R.linea(2, 7, 7, 12, 'y', 2);          // los gavilanes
    R.linea(3, 11, 1, 13, 'b', 2);         // el puño
    R.pon(0, 14, 'y'); R.pon(1, 14, 'y'); R.pon(0, 13, 'y');
    R.contorno();
    return R;
  },
  // Dos flechas hacia arriba: saltar.
  saltar() {
    const R = rejilla(15);
    R.linea(7, 1, 2, 6, 'w', 2); R.linea(7, 1, 12, 6, 'w', 2);
    R.linea(7, 7, 2, 12, 's', 2); R.linea(7, 7, 12, 12, 's', 2);
    R.contorno();
    return R;
  },
  // Un salto en arco con la punta de flecha al caer: la esquiva es un salto
  // evasivo, no una voltereta.
  // (El primer intento, con trazo de 2, se cerraba en una "A" rellena, y el
  // segundo, con la punta de dos rayas, no se leia como flecha. Va a mano: un
  // arco de UN pixel y la punta MACIZA, un triangulo apuntando abajo.)
  esquivar() {
    return aMano([
      '...............',
      '...............',
      '.....wwww......',
      '...ww....ww....',
      '..w........w...',
      '.w..........w..',
      '.w..........w..',
      '.w........wwwww',
      'w..........www.',
      'w...........w..',
      '...............',
      '...............',
      'sss.ss.........',
      '...............',
      '...............',
    ]);
  },
  // La espada de traves parando un golpe que cae: la chispa de oro encima.
  guardia() {
    const R = rejilla(15);
    R.linea(4, 9, 13, 9, 's', 2);
    R.linea(5, 9, 13, 9, 'w', 1);
    R.linea(3, 6, 3, 12, 'y', 2);          // los gavilanes
    R.linea(0, 9, 2, 9, 'b', 2);           // el puño
    // el golpe que cae y se para: tres rayas que convergen sobre la hoja (con
    // una base horizontal debajo parecia una corona)
    R.linea(5, 2, 7, 6, 'y', 1);
    R.linea(9, 1, 9, 6, 'y', 1);
    R.linea(13, 2, 11, 6, 'y', 1);
    R.contorno();
    return R;
  },
  // OTRA VEZ: la flecha que da la vuelta.
  otra() {
    return aMano([
      '...............',
      '......www......',
      '....ww...ww.w..',
      '...w.......ww..',
      '..w.......www..',
      '..w............',
      '.w.............',
      '.w.............',
      '.w.............',
      '..w.........w..',
      '..w.........w..',
      '...w.......w...',
      '....ww...ww....',
      '......www......',
      '...............',
    ]);
  },
  // DIFICULTAD: tres barras que suben, como las de la cobertura.
  dificultad() {
    return aMano([
      '...............',
      '...............',
      '...............',
      '..........yyy..',
      '..........yyy..',
      '..........yyy..',
      '......sss.yyy..',
      '......sss.yyy..',
      '......sss.yyy..',
      '..www.sss.yyy..',
      '..www.sss.yyy..',
      '..www.sss.yyy..',
      '..www.sss.yyy..',
      '...............',
      '...............',
    ]);
  },
  // MENU: la estanteria del arcade, cuatro portadas.
  menu() {
    return aMano([
      '...............',
      '...............',
      '..wwww...wwww..',
      '..wwww...wwww..',
      '..wwww...wwww..',
      '..wwww...wwww..',
      '...............',
      '...............',
      '...............',
      '..ssss...ssss..',
      '..ssss...ssss..',
      '..ssss...ssss..',
      '..ssss...ssss..',
      '...............',
      '...............',
    ]);
  },
};

// El ARMARIO: un vestido colgado de su percha.
ICONOS.armario = () => aMano([
  '.......s.......',
  '......s.s......',
  '........s......',
  '.......s.......',
  '....wwwwwww....',
  '....ww...ww....',
  '.....wwwww.....',
  '.....wwwww.....',
  '....wwwwwww....',
  '...wwwwwwwww...',
  '...wwwwwwwww...',
  '..wwwwwwwwwww..',
  '..wwwwwwwwwww..',
  '...............',
  '...............',
]);
// LISTO: la marca de hecho.
ICONOS.listo = () => aMano([
  '...............',
  '...............',
  '...............',
  '............ww.',
  '...........www.',
  '..........www..',
  '.ww......www...',
  '.www....www....',
  '..www..www.....',
  '...wwwwww......',
  '....wwww.......',
  '.....ww........',
  '...............',
  '...............',
  '...............',
]);

// Un icono dibujado a mano, fila a fila ('.' vacio; el resto, colores de IC).
function aMano(filas) {
  const R = rejilla(filas.length);
  filas.forEach((fila, y) => [...fila].forEach((c, x) => { if (c !== '.') R.pon(x, y, c); }));
  R.contorno();
  return R;
}

function pintaRejilla(c, R, x0, y0, esc) {
  for (let y = 0; y < R.n; y++) for (let x = 0; x < R.n; x++) {
    const k = R.px[y * R.n + x];
    if (!k) continue;
    c.fillStyle = IC[k];
    c.fillRect(x0 + x * esc, y0 + y * esc, esc, esc);
  }
}

// ---------- El medallon ----------
// Pixel a pixel sobre ImageData: contorno, aro de oro iluminado desde arriba a
// la izquierda (como la luz de las velas en el salon), una ranura, y la cara
// en tres bandas de su color. `claro` es la version apretada.
function medallon(r, cara, claro) {
  const M = 4;                                     // margen para la sombra
  const w = r * 2 + M * 2;
  const cv = lienzo(w, w);
  const c = cv.getContext('2d');
  const img = c.createImageData(w, w);
  const d = img.data;
  const pon = (x, y, h, a) => {
    const i = (y * w + x) * 4, [R, G, B] = hex(h);
    d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = a;
  };
  const C = claro ? [cara[0], cara[0], cara[1]] : cara;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const px = x - M - r + 0.5, py = y - M - r + 0.5;
    const dist = Math.hypot(px, py);
    // la sombra que lo despega del salon (abajo), solo en reposo
    if (dist > r) {
      if (!claro && Math.hypot(px, py - 3) <= r) pon(x, y, OSC, 110);
      continue;
    }
    // la luz: 1 arriba-izquierda, -1 abajo-derecha
    const luz = dist > 0 ? (-px - py) / (dist * Math.SQRT2) : 0;
    if (dist > r - 2) pon(x, y, OSC, 255);
    else if (dist > r - 6) {
      const k = luz > 0.6 ? 3 : luz > 0.15 ? 2 : luz > -0.45 ? 1 : 0;
      pon(x, y, ORO[claro ? Math.min(3, k + 1) : k], 255);
    } else if (dist > r - 7) pon(x, y, OSC, 235);
    else {
      const t = luz * 0.55 - (py / r) * 0.45;
      const k = t > 0.3 ? 0 : t > -0.25 ? 1 : 2;
      pon(x, y, C[k], claro ? 240 : 205);
    }
  }
  c.putImageData(img, 0, 0);
  return { cv, M };
}

// Un aro fino de oro a radio r (para el pulso al apretar y el brillo).
function aro(r, color, grueso) {
  const w = r * 2 + 2;
  const cv = lienzo(w, w);
  const c = cv.getContext('2d');
  c.fillStyle = color;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - r - 0.5, y - r - 0.5);
    if (d <= r && d > r - grueso) c.fillRect(x, y, 1, 1);
  }
  return cv;
}

// La tapa oscura de la cara, para la recarga (se pega solo la parte de arriba).
function tapa(r) {
  const rr = r - 6, w = rr * 2;
  const cv = lienzo(w, w);
  const c = cv.getContext('2d');
  c.fillStyle = OSC;
  for (let y = 0; y < w; y++) {
    const dy = y - rr + 0.5, half = Math.sqrt(Math.max(0, rr * rr - dy * dy));
    c.fillRect(Math.round(rr - half), y, Math.round(half * 2), 1);
  }
  return cv;
}

// ---------- Hornear ----------
// Para cada boton: medallon en reposo y apretado con el icono ya puesto, y
// sus aros. `btns` = { atacar: Button, saltar: ..., ... }.
export function hornea(btns) {
  const H = {};
  for (const k in btns) {
    const r = btns[k].r;
    const esc = 3;                        // 15 x 3 = 45 px: cabe en la cara de r 32
    const R = ICONOS[k]();
    const hazle = (claro) => {
      const m = medallon(r, CARAS[k], claro);
      const c = m.cv.getContext('2d');
      const lado = R.n * esc;
      pintaRejilla(c, R, Math.round(m.M + r - lado / 2), Math.round(m.M + r - lado / 2), esc);
      return m;
    };
    H[k] = {
      reposo: hazle(false), apretado: hazle(true),
      tapa: tapa(r),
      pulsos: [4, 7, 10, 13, 16].map(e => aro(r + e, ORO[2], 3)),
      brillo: aro(r + 5, ORO[3], 4),
    };
  }
  // Las NOTAS del final (S A B C): un medallon grande por nota.
  H.notas = {};
  for (const n in NOTAS) H.notas[n] = medallon(64, NOTAS[n], false);
  // El stick: una base de oro fino y un pomo pequeño.
  H.stick = {
    base: aro(60, ORO[2], 3), baseOsc: aro(62, OSC, 2),
    pomo: medallon(22, CARAS.guardia, false),
    pomoApretado: medallon(22, CARAS.guardia, true),
  };
  return H;
}

// ---------- Dibujar ----------
// Un boton. `e` = { apretado, pulso (0..1, el aro que se abre al apretar),
// recarga (0..1, lo que le falta), brillo (0..1), frio (no se puede usar),
// nombre }.
export function boton(g, H, k, b, e) {
  const h = H[k];
  const m = e.apretado ? h.apretado : h.reposo;
  const baja = e.apretado ? 2 : 0;
  const x0 = Math.round(b.x - b.r - m.M), y0 = Math.round(b.y - b.r - m.M + baja);
  g.globalAlpha = e.frio ? 0.45 : 1;
  g.drawImage(m.cv, x0, y0);
  // LA RECARGA: la cara se tapa y se va destapando de abajo arriba.
  if (e.recarga > 0) {
    const t = h.tapa, alto = Math.round(t.height * Math.min(1, e.recarga));
    if (alto > 0) {
      g.globalAlpha = 0.62;
      g.drawImage(t, 0, 0, t.width, alto, Math.round(b.x - t.width / 2), Math.round(b.y - t.height / 2 + baja), t.width, alto);
    }
  }
  // EL BRILLO: un aro de oro que late (la parada, el contraataque).
  if (e.brillo > 0) {
    g.globalAlpha = Math.min(1, e.brillo);
    g.drawImage(h.brillo, Math.round(b.x - h.brillo.width / 2), Math.round(b.y - h.brillo.height / 2 + baja));
  }
  // EL PULSO: al apretar, un aro que se abre y se apaga.
  if (e.pulso > 0) {
    const i = Math.min(h.pulsos.length - 1, Math.floor((1 - e.pulso) * h.pulsos.length));
    const a = h.pulsos[i];
    g.globalAlpha = e.pulso * 0.9;
    g.drawImage(a, Math.round(b.x - a.width / 2), Math.round(b.y - a.height / 2));
  }
  g.globalAlpha = e.frio ? 0.5 : 1;
  rotulo(g, e.nombre, b.x, b.y + b.r + 5, e.colorNombre || '#ffe6a0');
  g.globalAlpha = 1;
}

// Texto con contorno oscuro: se lee sobre la alfombra roja y sobre el muro. El
// contorno crece con la letra (2 px hasta escala 4, luego la mitad de la
// escala): con 2 px fijos, un titulo a escala 8 parecia sin contorno.
export function rotulo(g, s, cx, y, color, esc = 2) {
  const x = Math.round(cx - measure(s, esc) / 2);
  const o = Math.max(2, Math.round(esc / 2));
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]) text(g, s, x + dx, y + dy, OSC, esc);
  text(g, s, x, y, color, esc);
}

// ---------- El armario ----------
// Una MUESTRA de color: un medallon pequeño con la cara del color de la prenda
// (`caras` = claro, medio, oscuro). {cv, M} como los otros medallones.
export function muestra(caras, r = 26) { return medallon(r, caras, false); }

// Las MEDALLAS: de oro con su estrella (ganada) o gris con una interrogacion.
export function horneaMedallas(r = 16) {
  const hazla = (caras, icono) => {
    const m = medallon(r, caras, false);
    pintaRejilla(m.cv.getContext('2d'), icono, m.M + r - 5, m.M + r - 5, 1);
    return m;
  };
  return {
    oro: hazla(NOTAS.S, aMano([
      '.....w.....',
      '....www....',
      '....www....',
      'wwwwwwwwwww',
      '.wwwwwwwww.',
      '..wwwwwww..',
      '..wwwwwww..',
      '.wwww.wwww.',
      '.www...www.',
      'ww.......ww',
      '...........',
    ])),
    gris: hazla(NOTAS.C, aMano([
      '...wwww....',
      '..w....w...',
      '.......w...',
      '......w....',
      '.....w.....',
      '.....w.....',
      '...........',
      '.....w.....',
      '...........',
      '...........',
      '...........',
    ])),
  };
}

// El CANDADO de lo que todavia no se ha ganado, a x2.
export function horneaCandado() {
  const R = aMano([
    '..ooooo..',
    '.o.....o.',
    '.o.....o.',
    'yyyyyyyyy',
    'yyyykyyyy',
    'yyyykyyyy',
    'yyyyyyyyy',
    '.........',
    '.........',
  ]);
  const cv = lienzo(R.n * 2, R.n * 2);
  pintaRejilla(cv.getContext('2d'), R, 0, 0, 2);
  return cv;
}

// Un aro de oro para lo elegido (la muestra puesta).
export function aroElegido(r) { return aro(r, ORO[3], 3); }

// Un PANEL con marco de oro, como los medallones: contorno oscuro, aro de oro
// (claro arriba e izquierda, oscuro abajo y derecha) y el fondo oscuro. `claro`
// lo resalta (la dificultad elegida).
export function marco(g, x, y, w, h, claro = false, fondo = '#1e1220', alfa = 0.92) {
  x = Math.round(x); y = Math.round(y);
  g.globalAlpha = alfa;
  g.fillStyle = fondo; g.fillRect(x + 6, y + 6, w - 12, h - 12);
  g.globalAlpha = 1;
  g.fillStyle = OSC;
  g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h);
  const a = claro ? ORO[3] : ORO[2], b = claro ? ORO[2] : ORO[1];
  g.fillStyle = a; g.fillRect(x + 2, y + 2, w - 4, 3); g.fillRect(x + 2, y + 2, 3, h - 4);
  g.fillStyle = b; g.fillRect(x + 2, y + h - 5, w - 4, 3); g.fillRect(x + w - 5, y + 2, 3, h - 4);
  g.fillStyle = OSC;
  g.fillRect(x + 5, y + 5, w - 10, 1); g.fillRect(x + 5, y + h - 6, w - 10, 1);
  g.fillRect(x + 5, y + 5, 1, h - 10); g.fillRect(x + w - 6, y + 5, 1, h - 10);
}

// La NOTA del final: su medallon y la letra encima, a escala `esc` (el golpe
// de sello del resultado la trae grande y la deja en 1).
export function nota(g, H, n, cx, cy, esc = 1) {
  const m = H.notas[n];
  if (!m) return;
  g.save();
  g.translate(Math.round(cx), Math.round(cy));
  if (esc !== 1) g.scale(esc, esc);
  g.drawImage(m.cv, -m.cv.width / 2, -m.cv.height / 2);
  rotulo(g, n, 0, -42, '#fff8e0', 12);
  g.restore();
}

// El stick: la base de oro donde se apoyo el pulgar y el pomo donde esta.
// Sin pulgar, una base tenue con dos flechas donde suele ir.
export function stick(g, H, st, reposoX, reposoY) {
  const S = H.stick;
  if (st.active) {
    const ox = Math.round(st.ox), oy = Math.round(st.oy);
    g.globalAlpha = 0.5;
    g.drawImage(S.baseOsc, ox - 63, oy - 63);
    g.globalAlpha = 0.85;
    g.drawImage(S.base, ox - 61, oy - 61);
    g.globalAlpha = 1;
    const p = S.pomoApretado;
    g.drawImage(p.cv, Math.round(ox + st.dx * 60 - 22 - p.M), Math.round(oy + st.dy * 60 - 22 - p.M));
  } else {
    g.globalAlpha = 0.28;
    g.drawImage(S.base, reposoX - 61, reposoY - 61);
    g.fillStyle = ORO[2];
    for (const s of [-1, 1]) {
      // un triangulo de 7 filas mirando hacia fuera
      for (let i = 0; i < 7; i++) {
        const w = 7 - i;
        g.fillRect(reposoX + s * (30 + i) - (s < 0 ? 1 : 0), reposoY - w, 1, w * 2);
      }
    }
    g.globalAlpha = 1;
  }
}
