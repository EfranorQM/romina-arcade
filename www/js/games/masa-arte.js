// LA MASA - el dibujo. Todo lo que se ve: la masa (piel, placas, ojos,
// organos, avisos), la caballera con su espada y el tajo.
//
// Pixel art a 270x600 como NEON FIST, y con su misma regla: los avisos son lo
// mas brillante de la pantalla. La masa se rasteriza como el blob de
// SYMBIOTE (columnas verticales por capa, cero trazos), y encima van las
// PLACAS como costras de hueso en el borde de su sector, la PARADA como
// piedra gris, y la HERIDA como un agujero con el nucleo latiendo. Nada de
// eso necesita fotogramas: la forma es la fisica, y el dibujo solo la pinta.
//
// La carne cambia de tono con cada muda (unos grados hacia el naranja por
// ronda): la ronda 6 tiene que verse OTRA cosa aunque tuviera la misma
// silueta.

import { bake, bakeFlash, bakeFlip, spr } from '../gfx.js';
import { NR, NORG, NP, angDe, radioEn, LATIGO, GARRA, HOJA, REPOSO, C_AVISO, C_GOLPE, C_SIGUE,
         AVISO, EMBISTE, ATURDIDA, MUDANDO, ORGANO, ULT_RONDA } from './masa-cuerpo.js';
import { DIRX, DIRY, ALCANCE, TAJO_T } from './masa-caballera.js';

// La paleta de NEON FIST (la arena es la misma) mas la carne de SYMBIOTE.
export const P = {
  out: '#07030f', bg: '#140a26', dk: '#25123f', dk2: '#3d1a5c',
  pur: '#6a1f7a', vio: '#a3218f', mag: '#e0249a', pink: '#ff5cc8',
  nvy: '#1d47a0', blue: '#2a8ce0', cy: '#4de0f0',
  ye: '#f2f24a', gold: '#ffcd75', grey: '#d9dce6', grey2: '#8a8f99', wh: '#ffffff',
  bone: '#ffe8a8', bone2: '#c9b07a', hole: '#1a0306',
};

// ---------- Carne por ronda ----------
// Cuatro tonos (borde, carne, brillo, herida viva) que giran 4 grados hacia el
// naranja por muda. Se calculan una vez.
function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
export const CARNE = [];
for (let r = 0; r < ULT_RONDA + 1; r++) {
  // Hacia el naranja (sube el tono), no hacia el magenta: la arena es morada y
  // una masa morada en la ronda 7 se fundia con el suelo, medido en la hoja.
  // Con 8 grados por ronda la ultima era una papa dorada y las placas de hueso
  // desaparecian sobre ella; con 4 sigue siendo carne, mas caliente.
  const h = 350 + r * 4;
  CARNE.push({ deep: hsl2hex(h, 78, 14), mid: hsl2hex(h, 76, 32), lit: hsl2hex(h, 74, 46), hi: hsl2hex(h, 100, 65) });
}

// ---------- La piel: columnas por capa ----------
const NS = 48;
const _rad = new Float32Array(NS);
const _top = new Int32Array(256), _bot = new Int32Array(256);

function shell(g, M, cx, cy, scale, offX, offY, color, sx, sy) {
  for (let s = 0; s < NS; s++) {
    const f = (s / NS) * NR;
    const i0 = f | 0, i1 = (i0 + 1) % NR, t = f - i0;
    const sm = t * t * (3 - 2 * t);
    _rad[s] = (M.rad[i0] * (1 - sm) + M.rad[i1] * sm) * scale;
  }
  let minX = 1e9, maxX = -1e9;
  for (let s = 0; s < NS; s++) {
    const a = (s / NS) * Math.PI * 2;
    const x = Math.round(cx + offX + Math.cos(a) * _rad[s] * sx);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
  }
  const w = maxX - minX + 1;
  if (w <= 0 || w > 255) return;
  for (let i = 0; i < w; i++) { _top[i] = 1e9; _bot[i] = -1e9; }
  let px = 0, py = 0, first = 1;
  for (let s = 0; s <= NS; s++) {
    const si = s % NS, a = (si / NS) * Math.PI * 2;
    const x = Math.round(cx + offX + Math.cos(a) * _rad[si] * sx);
    const y = Math.round(cy + offY + Math.sin(a) * _rad[si] * sy);
    if (first) { first = 0; px = x; py = y; continue; }
    const dx = x - px, dy = y - py, n = Math.max(Math.abs(dx), 1);
    for (let k = 0; k <= n; k++) {
      const xx = Math.round(px + dx * k / n) - minX, yy = Math.round(py + dy * k / n);
      if (xx < 0 || xx >= w) continue;
      if (yy < _top[xx]) _top[xx] = yy;
      if (yy > _bot[xx]) _bot[xx] = yy;
    }
    px = x; py = y;
  }
  g.fillStyle = color;
  for (let i = 0; i < w; i++) { if (_bot[i] < _top[i]) continue; g.fillRect(minX + i, _top[i], 1, _bot[i] - _top[i] + 1); }
}

// Posiciones de los ojos sobre el cuerpo (angulo, fraccion del radio). Uno por
// ronda: cada muda abre un ojo mas. "Te esta mirando" se ve sin decirlo.
const OJOS = [[-1.57, 0.45], [-0.75, 0.55], [-2.4, 0.55], [0.1, 0.5], [3.0, 0.5], [0.9, 0.55], [-3.9, 0.3]];

// ---------- La masa ----------
// t: reloj del juego (para parpadeos). flash: frames de destello blanco por tajo.
export function drawMasa(g, M, K, t, flash) {
  const c = CARNE[Math.min(CARNE.length - 1, M.ronda - 1)];
  const cx = M.x, cy = M.y;
  const on10 = ((t * 10) | 0) & 1, on14 = ((t * 14) | 0) & 1;

  // --- Avisos, DEBAJO de todo ---
  if (M.st === AVISO) {
    // El carril de la embestida: puntos amarillos marchando, como el charger.
    g.fillStyle = P.ye;
    const march = (t * 90) % 10;
    for (let d = 14; d < 170; d += 10) {
      const x = cx + M.lx * (d + march), y = cy + M.ly * (d + march);
      if (x < 12 || x > 258 || y < 45 || y > 390) break;
      g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }
  }
  for (let o = 0; o < NORG; o++) {
    const org = M.org[o];
    if (!org.tipo || org.st !== C_AVISO) continue;
    // Linea de puntos de la base al blanco, y un anillo donde va a caer:
    // dice A DONDE va a pegar, que es lo unico que hace falta para esquivarlo.
    const b = o * NP, bx = M.px[b], by = M.py[b];
    const dx = org.tx - bx, dy = org.ty - by, d = Math.hypot(dx, dy) || 1;
    g.fillStyle = P.ye;
    const march = (t * 80) % 8;
    for (let k = 10 + march; k < d - 6; k += 8) g.fillRect(Math.round(bx + dx / d * k) - 1, Math.round(by + dy / d * k) - 1, 3, 3);
    g.fillStyle = on10 ? P.wh : P.ye;
    for (let k = 0; k < 8; k++) {
      const a = k * 0.785 + t * 3;
      g.fillRect(Math.round(org.tx + Math.cos(a) * 9) - 1, Math.round(org.ty + Math.sin(a) * 9) - 1, 3, 3);
    }
  }

  // --- Organos, DEBAJO del cuerpo: nacen de dentro de la carne, y asi su
  // contorno no parte el cuerpo con una raya negra (probado encima: parecia
  // pegado con cinta).
  for (let o = 0; o < NORG; o++) { const org = M.org[o]; if (org.tipo) drawCadena(g, M, o, t, c); }

  // --- Cuerpo: tres capas ---
  const expuesta = M.expuesta > 0 && on14;
  const aturdida = M.st === ATURDIDA;
  const sx = 1, sy = 1;
  shell(g, M, cx, cy, 1.00, 0, 0, flash > 0 ? P.wh : c.deep, sx, sy);
  shell(g, M, cx, cy, 0.82, 0, 0, flash > 0 ? P.wh : expuesta ? c.hi : aturdida ? P.dk2 : c.mid, sx, sy);
  shell(g, M, cx, cy, 0.55, -2, -2, flash > 0 ? P.wh : expuesta ? P.wh : aturdida ? P.pur : c.lit, sx, sy);

  // --- Borde por sector: placas, parada, herida ---
  for (let i = 0; i < NR; i++) {
    const a0 = angDe(i);
    const frozen = M.frozen >= 0 && (i === M.frozen || i === (M.frozen + 1) % NR || i === (M.frozen + NR - 1) % NR);
    if (M.placa[i] > 0) {
      // Costra de hueso: tantas hileras de escamas como nivel, la de fuera
      // clara y las de dentro mas sucias.
      for (let j = -2; j <= 2; j++) {
        const a = a0 + j * 0.085;
        const r = radioEn(M, a);
        for (let row = 0; row < M.placa[i]; row++) {
          const rr = r - 1 - row * 3;
          g.fillStyle = frozen ? (row === 0 ? P.grey : P.grey2) : row === 0 ? P.bone : P.bone2;
          g.fillRect(Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 3, 3);
        }
      }
    } else if (frozen) {
      // Piedra: el sector se pone gris y deja de respirar.
      for (let j = -2; j <= 2; j++) {
        const a = a0 + j * 0.085, r = radioEn(M, a) - 1;
        g.fillStyle = j === 0 ? P.wh : P.grey;
        g.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3);
        g.fillStyle = P.grey2;
        g.fillRect(Math.round(cx + Math.cos(a) * (r - 4)) - 1, Math.round(cy + Math.sin(a) * (r - 4)) - 1, 3, 3);
      }
    }
    if (M.herida === i) {
      // Agujero en la carne con el nucleo latiendo a la vista: 3 s de ventana.
      const r = radioEn(M, a0) - 6;
      const hx = Math.round(cx + Math.cos(a0) * r), hy = Math.round(cy + Math.sin(a0) * r);
      g.fillStyle = P.hole; g.fillRect(hx - 4, hy - 4, 9, 9);
      const lat = 1 + Math.round(Math.sin(t * 9) * 1);
      g.fillStyle = c.hi; g.fillRect(hx - lat, hy - lat, 2 * lat + 1, 2 * lat + 1);
    }
  }

  // --- Ojos: uno por ronda, todos mirandola ---
  const nOjos = Math.min(OJOS.length, M.ronda);
  const cerrados = M.st === MUDANDO && M.convT > 0;
  for (let k = 0; k < nOjos; k++) {
    const a = OJOS[k][0], fr = OJOS[k][1];
    const r = radioEn(M, a) * fr;
    const ex = Math.round(cx + Math.cos(a) * r), ey = Math.round(cy + Math.sin(a) * r);
    if (cerrados || aturdida) {
      g.fillStyle = P.hole; g.fillRect(ex - 2, ey, 5, 1);
      continue;
    }
    g.fillStyle = P.bone; g.fillRect(ex - 2, ey - 2, 5, 5);
    const dx = K.x - ex, dy = K.y - ey, d = Math.hypot(dx, dy) || 1;
    const px = Math.round(dx / d), py = Math.round(dy / d);
    g.fillStyle = P.hole; g.fillRect(ex - 1 + px, ey - 1 + py, 2, 2);
  }

  // --- Aturdida: las tres chispas del charger ---
  if (aturdida) {
    g.fillStyle = P.ye;
    for (let k = 0; k < 3; k++) {
      const a = t * 7 + k * 2.094;
      g.fillRect(Math.round(cx + Math.cos(a) * 16) - 1, Math.round(cy - radioEn(M, -1.57) - 6 + Math.sin(a) * 4) - 1, 3, 3);
    }
  }
}

// Una cadena: Catmull-Rom entre sus puntos, gruesa en la base y fina en la
// punta (como los tentaculos de SYMBIOTE). Cada tipo con su punta: el latigo
// acaba en nada, la garra en una una de hueso, la hoja es una lamina gris con
// filo blanco. Avisando, la punta parpadea amarilla; golpeando, blanca.
function drawCadena(g, M, o, t, c) {
  const org = M.org[o];
  const b = o * NP, n = org.n;
  if (org.grow <= 0.02) return;
  const aviso = org.st === C_AVISO && (((t * 10) | 0) & 1);
  const golpe = org.st === C_GOLPE || org.st === C_SIGUE;
  const hoja = org.tipo === HOJA, garra = org.tipo === GARRA;
  const w0 = hoja ? 7 : garra ? 9 : 6, w1 = hoja ? 3 : garra ? 4 : 2;
  for (let pass = 0; pass < 2; pass++) {
    for (let s = 0; s < n - 1; s++) {
      const p = b + s, q = p + 1;
      const pm = b + Math.max(0, s - 1), pn = b + Math.min(n - 1, s + 2);
      const ax = M.px[pm], ay = M.py[pm], x0 = M.px[p], y0 = M.py[p], x1 = M.px[q], y1 = M.py[q], bx = M.px[pn], by = M.py[pn];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(2, Math.ceil(len / 2));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u;
        const f = (s + u) / (n - 1);
        const w = Math.max(2, Math.round(w0 + (w1 - w0) * f));
        const x = Math.round(0.5 * ((2 * x0) + (-ax + x1) * u + (2 * ax - 5 * x0 + 4 * x1 - bx) * u2 + (-ax + 3 * x0 - 3 * x1 + bx) * u3));
        const y = Math.round(0.5 * ((2 * y0) + (-ay + y1) * u + (2 * ay - 5 * y0 + 4 * y1 - by) * u2 + (-ay + 3 * y0 - 3 * y1 + by) * u3));
        if (pass === 0) {
          g.fillStyle = hoja ? P.out : c.deep;
          g.fillRect(x - (w >> 1) - 1, y - (w >> 1) - 1, w + 2, w + 2);
        } else {
          let col;
          if (hoja) col = f < 0.22 ? c.mid : (golpe ? P.wh : aviso && f > 0.5 ? P.ye : P.grey);
          else col = golpe && f > 0.5 ? P.wh : aviso && f > 0.5 ? P.ye : f < 0.35 ? c.lit : f < 0.7 ? c.mid : c.deep;
          g.fillStyle = col;
          g.fillRect(x - (w >> 1), y - (w >> 1), w, w);
          // El filo de la hoja: una linea blanca a un lado, perpendicular al
          // tramo. Sin ella era un hueso gris; con ella es una lamina.
          if (hoja && f >= 0.22) {
            const sl = Math.hypot(x1 - x0, y1 - y0) || 1;
            const nx = -(y1 - y0) / sl, ny = (x1 - x0) / sl;
            g.fillStyle = P.wh;
            g.fillRect(Math.round(x + nx * (w >> 1)), Math.round(y + ny * (w >> 1)), 1, 1);
          }
        }
      }
    }
  }
  // La punta
  const tip = b + n - 1, tx = Math.round(M.px[tip]), ty = Math.round(M.py[tip]);
  if (garra) {
    g.fillStyle = golpe ? P.wh : aviso ? P.ye : P.bone;
    g.fillRect(tx - 3, ty - 3, 6, 6);
    g.fillStyle = P.bone2; g.fillRect(tx - 1, ty - 1, 2, 2);
  } else if (hoja) {
    g.fillStyle = golpe ? P.wh : aviso ? P.ye : P.wh; g.fillRect(tx - 2, ty - 2, 4, 4);
  } else {
    g.fillStyle = golpe ? P.wh : aviso ? P.ye : c.hi; g.fillRect(tx - 1, ty - 1, 3, 3);
  }
}

// ---------- La caballera ----------
// Romina de NEON FIST con hombrera y sin puno: la espada se dibuja aparte,
// fina, en px de pantalla, para que pueda ser un filo y no un bloque.
// 1=contorno 2=chaqueta 3=brillo 4=piel 5=pelo 6=botas 8=hombrera
const ROM_D = [
  '..5555..',
  '.155551.',
  '.144441.',
  '.141141.',
  '.183321.',
  '.182221.',
  '.122221.',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const ROM_U = [
  '..5555..',
  '.155551.',
  '.155551.',
  '.132231.',
  '.123381.',
  '.122281.',
  '.122221.',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const ROM_R = [
  '..5551..',
  '.155541.',
  '.144441.',
  '.141141.',
  '.123381.',
  '.123381.',
  '.123221.',
  '.122221.',
  '.122221.',
  '.166661.',
  '.16..61.',
  '.11..11.',
];
const RMAP = { '1': P.out, '2': P.mag, '3': P.pink, '4': P.gold, '5': P.vio, '6': P.dk, '8': P.grey };

export function bakeCaballera() {
  const rrows = [ROM_D, ROM_U, ROM_R, ROM_R];
  const S = { rom: new Array(4), blanca: bakeFlash(ROM_D, 3) };
  for (let d = 0; d < 4; d++) {
    const rows = rrows[d], flip = d === 2;
    let a = bake(rows, RMAP, 3), w = bakeWalk(rows, RMAP);
    if (flip) { a = bakeFlip(a); w = bakeFlip(w); }
    S.rom[d] = [a, w];
  }
  return S;
}

function bakeWalk(rows, map) {
  const out = new Array(rows.length);
  out[0] = rows[0].replace(/./g, '.');
  for (let i = 1; i < rows.length; i++) out[i] = rows[i - 1];
  return bake(out, map, 3);
}

// La espada y el tajo. El ciclo dura TAJO_T: arranque (la hoja atras),
// ventana activa (el arco) y recuperacion (el arco se apaga). El arco es lo
// mas brillante que hay junto a ella, como el puno cyan de NEON FIST: dice de
// donde sale el dano.
export function drawCaballera(g, K, S, t) {
  const blink = K.iframe > 0 && (((K.iframe * 15) | 0) & 1);
  const frame = K.walkF ? 1 : 0;
  const fx = DIRX[K.face], fy = DIRY[K.face];
  const px = -fy, py = fx;                    // perpendicular (lado de la mano)
  const x = Math.round(K.x), y = Math.round(K.y);
  const el = K.pT > 0 ? TAJO_T - K.pT : -1;
  const fase = el < 0 ? -1 : el < TAJO_T * 0.269 ? 0 : el < TAJO_T * 0.577 ? 1 : 2;

  // La espada en reposo o levantada, por detras del cuerpo si mira arriba
  const detras = K.face === 1;
  const espada = () => {
    if (K.stag > 0) return;                    // descolocada: la espada se le cayo a un lado (se dibuja abajo)
    g.fillStyle = P.grey;
    if (fase === 0) {
      // Arranque: hoja alzada al lado contrario del golpe
      for (let k = 0; k < 12; k++) g.fillRect(x + px * 7 - fx * k, y + py * 7 - fy * k, 2, 2);
    } else if (fase < 0 || fase === 2) {
      for (let k = 0; k < 11; k++) g.fillRect(x + px * 8 + fx * (k - 3), y + py * 8 + fy * (k - 3), 2, 2);
      g.fillStyle = P.wh; g.fillRect(x + px * 8 + fx * 7, y + py * 8 + fy * 7, 2, 2);
    }
  };
  if (detras) espada();
  spr(g, blink ? S.blanca : S.rom[K.face][frame], K.x, K.y);
  if (!detras) espada();
  if (K.stag > 0) {
    // Descolocada: estrellitas y la espada abajo
    g.fillStyle = P.grey; g.fillRect(x + 8, y + 12, 9, 2);
    g.fillStyle = P.ye;
    for (let k = 0; k < 3; k++) { const a = t * 9 + k * 2.1; g.fillRect(x + Math.round(Math.cos(a) * 10) - 1, y - 20 + Math.round(Math.sin(a) * 3) - 1, 3, 3); }
  }
  // El arco del tajo: durante la ventana activa entero y blanco; en la
  // recuperacion queda su estela cyan apagandose.
  if (fase >= 1) {
    const cx = K.x + fx * ALCANCE, cy = K.y + fy * ALCANCE;
    const base = Math.atan2(fy, fx);
    const rec = fase === 2 ? 1 - (el - TAJO_T * 0.577) / (TAJO_T * 0.423) : 1;
    g.globalAlpha = fase === 1 ? 1 : 0.6 * rec;
    for (let k = -6; k <= 6; k++) {
      const a = base + k * 0.17;
      const r = 13 - Math.abs(k) * 0.6;
      const ax = Math.round(cx + Math.cos(a) * r - fx * 6), ay = Math.round(cy + Math.sin(a) * r - fy * 6);
      g.fillStyle = fase === 1 ? (Math.abs(k) < 3 ? P.wh : P.cy) : P.cy;
      g.fillRect(ax - 1, ay - 1, 3, 3);
      if (fase === 1 && Math.abs(k) < 4) { g.fillStyle = P.wh; g.fillRect(ax - 2, ay - 2, 5, 5); }
    }
    g.globalAlpha = 1;
  }
}

// La silueta blanca de ella (para la ceremonia y el rastro del dash).
export function drawSilueta(g, S, x, y, alpha) {
  g.globalAlpha = alpha;
  spr(g, S.blanca, x, y);
  g.globalAlpha = 1;
}
