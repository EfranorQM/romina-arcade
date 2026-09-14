// AHORCADO - el dibujo: cielo, estanque, rana, globos, el muneco y las
// particulas.
//
// Estilo "manguera de goma" de dibujo animado de los anos 30: cada extremidad
// se traza dos veces, primero en tinta gruesa (9 px, extremos redondos) y
// encima el color (5 px). Es el unico juego del arcade con contorno de tinta y
// personaje de caricatura; pertenece por lo demas -- noche saturada, los tres
// acentos del motor (rosa, cian, amarillo), la fuente 5x7 en las esquinas.
//
// A 540x1200 con meta.smooth cada px virtual son 2 fisicos en el Note 10: la
// cabeza (r 34) mide 8.3 mm, los trazos de la cara 3-4 px = 6-8 fisicos. Se
// juzgo en la hoja de contactos de tools/ver-ahorcado.html a tamano real, no
// en el codigo.
//
// Cada punto se dibuja INTERPOLADO entre su posicion anterior y la actual con
// el alpha del bucle (main.js), como SURVIVAL: a 90 Hz la pantalla ensena mas
// frames que pasos simula la fisica, y sin esto un tercio serian repetidos.

import * as F from './ahorc-fisica.js';
import { drawCara } from './ahorc-cara.js';
import { text, measure } from '../font.js';

export const TINTA = '#1a1030';
export const PIEL = '#ffe6c7', SUETER = '#ff8fb8', PANTALON = '#4a3f8a';
export const COLORES = ['#ff5c9d', '#5cffd8', '#ffe14d', '#b48cff', '#ff9b4d', '#8aff6a'];
const PANEL = '#0d0620';
export const AGUA_Y = F.WATER;

// Posicion interpolada del punto i.
const _p = [0, 0];
export function P(S, i, a) { _p[0] = S.ox[i] + (S.x[i] - S.ox[i]) * a; _p[1] = S.oy[i] + (S.y[i] - S.oy[i]) * a; return _p; }
function px(S, i, a) { return S.ox[i] + (S.x[i] - S.ox[i]) * a; }
function py(S, i, a) { return S.oy[i] + (S.y[i] - S.oy[i]) * a; }

// ---------- Cielo: horneado una vez ----------
// Degradado, luna con halo y 40 estrellas sembradas (sin parpadeo rapido: en
// una partida larga cansa la vista). 540x640: hasta el agua.
let cielo = null;
export function hornearCielo(rnd) {
  const cv = document.createElement('canvas');
  cv.width = 540; cv.height = 640;
  const d = cv.getContext('2d');
  const gr = d.createLinearGradient(0, 0, 0, 640);
  gr.addColorStop(0, '#120a2e'); gr.addColorStop(0.55, '#2a1660'); gr.addColorStop(1, '#4a2a7a');
  d.fillStyle = gr; d.fillRect(0, 0, 540, 640);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 540, y = rnd() * 520, s = rnd() < 0.3 ? 2 : 1;
    d.fillStyle = 'rgba(255,255,255,' + (0.4 + rnd() * 0.4).toFixed(2) + ')';
    d.fillRect(x, y, s, s);
  }
  const halo = d.createRadialGradient(430, 150, 40, 430, 150, 220);
  halo.addColorStop(0, 'rgba(255,242,200,0.18)'); halo.addColorStop(1, 'rgba(255,242,200,0)');
  d.fillStyle = halo; d.fillRect(200, -80, 460, 460);
  d.fillStyle = '#fff2c8'; d.beginPath(); d.arc(430, 150, 70, 0, 7); d.fill();
  // Dos crateres suaves para que sea luna y no disco.
  d.fillStyle = 'rgba(200,180,140,0.35)';
  d.beginPath(); d.arc(410, 135, 14, 0, 7); d.fill();
  d.beginPath(); d.arc(450, 175, 9, 0, 7); d.fill();
  d.beginPath(); d.arc(440, 120, 6, 0, 7); d.fill();
  cielo = cv;
  return cv;
}
export function soltarCielo() { cielo = null; aguaGr = null; }

let aguaGr = null;
// ---------- Estanque ----------
export function drawFondo(g, t) {
  if (cielo) g.drawImage(cielo, 0, 0);
  if (!aguaGr) {
    aguaGr = g.createLinearGradient(0, AGUA_Y, 0, 716);
    aguaGr.addColorStop(0, '#1b2c6e'); aguaGr.addColorStop(1, '#0d1440');
  }
  g.fillStyle = aguaGr; g.fillRect(0, AGUA_Y, 540, 716 - AGUA_Y);
  // Linea de la superficie.
  g.fillStyle = 'rgba(180,200,255,0.35)'; g.fillRect(0, AGUA_Y, 540, 2);
  // Estela de la luna: tres elipses blancas al 10% que se desplazan 8 px/s.
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let k = 0; k < 3; k++) {
    const x = 430 + Math.sin(t * 0.5 + k * 2.1) * 16 + ((t * 8 + k * 40) % 120) - 60;
    g.beginPath(); g.ellipse(x, 652 + k * 18, 40 - k * 8, 3, 0, 0, 7); g.fill();
  }
  // Fundido al panel de abajo, para que el teclado no tenga un canto duro.
  const f = g.createLinearGradient(0, 704, 0, 724);
  f.addColorStop(0, 'rgba(13,6,32,0)'); f.addColorStop(1, PANEL);
  g.fillStyle = f; g.fillRect(0, 704, 540, 20);
  g.fillStyle = PANEL; g.fillRect(0, 724, 540, 1200 - 724);
}

// ---------- Sombra del muneco sobre el agua ----------
// Vende la altura sin ningun numero: cuanto mas cerca del agua, mas chica y
// mas oscura, y se estira al columpiarse. Sustituye al reflejo de los globos,
// que era lo mas caro del dibujo.
export function drawSombra(g, S, a) {
  const fx = (px(S, F.PR, a) + px(S, F.PL, a)) / 2, fy = (py(S, F.PR, a) + py(S, F.PL, a)) / 2;
  const h = Math.max(0, Math.min(206, AGUA_Y - fy));
  const vx = ((S.x[F.PR] - S.ox[F.PR]) + (S.x[F.PL] - S.ox[F.PL])) * 30;
  let rx = 24 + 40 * (1 - h / 206) + Math.abs(vx) * 0.05;
  const ry = rx / 4, alpha = 0.10 + 0.18 * (1 - h / 206);
  g.fillStyle = 'rgba(5,3,20,' + alpha.toFixed(3) + ')';
  g.beginPath(); g.ellipse(fx, AGUA_Y + 4, rx, ry, 0, 0, 7); g.fill();
}

// ---------- La rana ----------
// `r` = { x, y, boca 0..1, mira {x,y}, salto (px hacia arriba), enBarriga }
export function drawRana(g, r) {
  const x = r.x, y = r.y - r.salto;
  if (!r.enBarriga) {
    // Nenufar.
    g.fillStyle = '#2f8f5a'; g.beginPath(); g.ellipse(r.x, r.y + 8, 30, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#1b2c6e'; g.beginPath(); g.moveTo(r.x, r.y + 8); g.lineTo(r.x + 30, r.y + 4); g.lineTo(r.x + 30, r.y + 12); g.closePath(); g.fill();
  }
  // Cuerpo.
  g.fillStyle = '#8aff6a'; g.strokeStyle = TINTA; g.lineWidth = 3;
  g.beginPath(); g.ellipse(x, y, 16, 11, 0, 0, 7); g.fill(); g.stroke();
  // Patas.
  g.beginPath(); g.ellipse(x - 12, y + 8, 7, 4, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(x + 12, y + 8, 7, 4, 0, 0, 7); g.fill(); g.stroke();
  // Ojos saltones, con las pupilas mirando al muneco.
  for (const s of [-1, 1]) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + s * 8, y - 10, 6, 0, 7); g.fill(); g.stroke();
    let dx = 0, dy = 0;
    if (r.mira) { const ddx = r.mira.x - x, ddy = r.mira.y - y, d = Math.hypot(ddx, ddy) || 1; dx = ddx / d * 2.5; dy = ddy / d * 2.5; }
    g.fillStyle = TINTA; g.beginPath(); g.arc(x + s * 8 + dx, y - 10 + dy, 2.6, 0, 7); g.fill();
  }
  // Boca: se abre segun lo cerca que tenga los pies.
  const ab = r.boca;
  if (ab > 0.1) {
    g.fillStyle = '#5a1030'; g.beginPath(); g.ellipse(x, y + 2, 6 + 5 * ab, 2 + 6 * ab, 0, 0, 7); g.fill();
    if (ab > 0.6) { g.fillStyle = '#ff7aa8'; g.beginPath(); g.ellipse(x, y + 4 + 2 * ab, 3, 2 + 2 * ab, 0, 0, 7); g.fill(); }
  } else {
    g.strokeStyle = TINTA; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x - 7, y + 2); g.quadraticCurveTo(x, y + 6, x + 7, y + 2); g.stroke();
  }
}

// ---------- Globos ----------
const gradCache = new Map();
function gradGlobo(g, col) {
  let gr = gradCache.get(col);
  if (!gr) {
    gr = g.createRadialGradient(-8, -10, 4, 0, 0, 30);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, col); gr.addColorStop(1, sombra(col));
    gradCache.set(col, gr);
  }
  return gr;
}
function sombra(hex) {
  const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 'rgb(' + Math.round(r * 0.55) + ',' + Math.round(gg * 0.5) + ',' + Math.round(b * 0.6) + ')';
}

// `squish[b]` = segundos que le quedan al aplastamiento del toque (0 = nada).
// `sueltas` = cuerdas liberadas que se encogen hacia el puño: [{b, t, x, y}].
export function drawGlobos(g, S, a, squish, sueltas, extraGlobos) {
  const kx = px(S, F.NUDO, a), ky = py(S, F.NUDO, a);
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.6)';
  for (let b = 0; b < 6; b++) {
    if (!S.alive[b]) continue;
    const bx = px(S, F.B0 + b, a), by = py(S, F.B0 + b, a);
    g.beginPath(); g.moveTo(kx, ky);
    g.quadraticCurveTo((kx + bx) / 2 + (bx > kx ? -6 : 6), (ky + by) / 2 + 6, bx, by + F.BALLOON_RY - 2);
    g.stroke();
  }
  // Cuerda del globo que acaba de reventar, encogiendose 0.6 s.
  if (sueltas) for (const s of sueltas) {
    const u = 1 - s.t / 0.6;
    g.strokeStyle = 'rgba(255,255,255,' + (0.6 * u).toFixed(2) + ')';
    g.beginPath(); g.moveTo(kx, ky); g.quadraticCurveTo(kx + (s.x - kx) * 0.5 * u + 10 * u, ky + (s.y - ky) * 0.6 * u, kx + (s.x - kx) * u, ky + (s.y - ky) * u); g.stroke();
  }
  for (let b = 0; b < 6; b++) {
    if (!S.alive[b]) continue;
    const bx = px(S, F.B0 + b, a), by = py(S, F.B0 + b, a);
    let sx = 1, sy = 1;
    if (squish && squish[b] > 0) { const u = squish[b] / 0.12; sx = 1 + 0.15 * u; sy = 1 - 0.15 * u; }
    globo(g, bx, by, COLORES[b], sx, sy);
  }
  // Globos que suben a atarse (los de una palabra ganada).
  if (extraGlobos) for (const e of extraGlobos) globo(g, e.x, e.y, COLORES[e.b], 1, 1, true);
}

export function globo(g, x, y, col, sx = 1, sy = 1, conCola = false) {
  g.save();
  g.translate(x, y);
  // Inclinacion con la velocidad no hace falta: la cuerda ya la cuenta.
  g.scale(sx, sy);
  if (conCola) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, F.BALLOON_RY); g.quadraticCurveTo(6, F.BALLOON_RY + 20, -4, F.BALLOON_RY + 44); g.stroke(); }
  g.fillStyle = gradGlobo(g, col);
  g.beginPath(); g.ellipse(0, 0, F.BALLOON_RX, F.BALLOON_RY, 0, 0, 7); g.fill();
  g.strokeStyle = TINTA; g.lineWidth = 3; g.stroke();
  // Nudito.
  g.fillStyle = col; g.beginPath(); g.moveTo(-5, F.BALLOON_RY - 1); g.lineTo(5, F.BALLOON_RY - 1); g.lineTo(0, F.BALLOON_RY + 6); g.closePath(); g.fill(); g.stroke();
  // Brillo.
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath(); g.ellipse(-8, -10, 6, 9, -0.4, 0, 7); g.fill();
  g.restore();
}

// ---------- El cuerpo ----------
function manguera(g, pts, col, grosor) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = TINTA; g.lineWidth = grosor + 4;
  trazo(g, pts);
  g.strokeStyle = col; g.lineWidth = grosor;
  trazo(g, pts);
}
function trazo(g, pts) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  if (pts.length === 6) {
    // Tres puntos: curva suave por el del medio (rodilla).
    const mx = pts[2], my = pts[3];
    g.quadraticCurveTo(mx, my, pts[4], pts[5]);
  } else for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
function bola(g, x, y, r, col) {
  g.fillStyle = TINTA; g.beginPath(); g.arc(x, y, r + 2.5, 0, 7); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}

// `cara` es el estado de ahorc-cara.js; `t` el reloj; `tinte` el color del
// globo mas bajo (para la coronilla) o null; `mojado` pinta el pelo pegado.
export function drawCuerpo(g, S, a, cara, t, tinte) {
  const kx = px(S, F.NUDO, a), ky = py(S, F.NUDO, a);
  const hrx = px(S, F.HR, a), hry = py(S, F.HR, a), hlx = px(S, F.HL, a), hly = py(S, F.HL, a);
  const crx = px(S, F.CR, a), cry = py(S, F.CR, a), clx = px(S, F.CL, a), cly = py(S, F.CL, a);
  const cx = px(S, F.CAB, a), cy = py(S, F.CAB, a);
  // Piernas: cadera -> rodilla -> pie, curva por la rodilla.
  manguera(g, [crx, cry, px(S, F.RR, a), py(S, F.RR, a), px(S, F.PR, a), py(S, F.PR, a)], PANTALON, 5);
  manguera(g, [clx, cly, px(S, F.RL, a), py(S, F.RL, a), px(S, F.PL, a), py(S, F.PL, a)], PANTALON, 5);
  // Zapatos.
  bola(g, px(S, F.PR, a), py(S, F.PR, a) + 2, 6, TINTA);
  bola(g, px(S, F.PL, a), py(S, F.PL, a) + 2, 6, TINTA);
  // Brazo derecho, hasta el puño en el nudo (detras de la cabeza).
  manguera(g, [hrx, hry, kx, ky], PIEL, 5);
  // Torso: hombros y caderas con panza de 12 px por lado.
  g.fillStyle = SUETER; g.strokeStyle = TINTA; g.lineWidth = 6; g.lineJoin = 'round';
  const mx = (hlx + crx) / 2, my = (hly + cry) / 2;
  g.beginPath();
  g.moveTo(hlx, hly); g.lineTo(hrx, hry);
  g.quadraticCurveTo((hrx + crx) / 2 + 12, (hry + cry) / 2, crx, cry);
  g.lineTo(clx, cly);
  g.quadraticCurveTo((hlx + clx) / 2 - 12, (hly + cly) / 2, hlx, hly);
  g.closePath(); g.stroke(); g.fill();
  // Cuello de la chompa.
  g.strokeStyle = '#e06a98'; g.lineWidth = 3; g.beginPath(); g.moveTo(hlx + 4, hly + 6); g.lineTo(hrx - 4, hry + 6); g.stroke();
  // Brazo izquierdo y mano. Si se esta tapando los ojos, la mano va DESPUES de
  // la cara (mas abajo), o queda detras de la cabeza y no tapa nada.
  const manoDelante = S.eyes;
  if (!manoDelante) {
    manguera(g, [hlx, hly, px(S, F.MANO, a), py(S, F.MANO, a)], PIEL, 5);
    bola(g, px(S, F.MANO, a), py(S, F.MANO, a), 6, PIEL);
  }
  // El puño sobre las cuerdas.
  bola(g, kx, ky, 9, PIEL);
  // Cabeza.
  g.fillStyle = PIEL; g.strokeStyle = TINTA; g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, F.HEAD_R, 0, 7); g.fill(); g.stroke();
  // Tinte del globo mas bajo sobre la coronilla: los globos son la luz cercana.
  if (tinte) {
    g.save(); g.beginPath(); g.arc(cx, cy, F.HEAD_R - 2, 0, 7); g.clip();
    g.globalAlpha = 0.10; g.fillStyle = tinte; g.fillRect(cx - 40, cy - 40, 80, 30);
    g.restore();
  }
  // Marco de la cara: arriba = 0.6 * arriba del mundo + 0.4 * (cabeza - medio de hombros).
  // Flotando, la cara mira a camara aunque el cuerpo este tumbado: de perfil
  // no se leia la expresion de empapado, y es el remate de la derrota.
  let ux = 0, uy = -0.6;
  const sx = (hlx + hrx) / 2, sy = (hly + hry) / 2;
  const dx = cx - sx, dy = cy - sy, d = Math.hypot(dx, dy) || 1;
  if (cara.mechon) { ux = 0; uy = -1; }
  else { ux += dx / d * 0.4; uy += dy / d * 0.4; }
  const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
  // Pelo: tres trazos en la coronilla, inclinados en contra de la velocidad.
  const vx = (S.x[F.CAB] - S.ox[F.CAB]) * 60;
  const lean = -Math.max(-1, Math.min(1, vx / 300)) * 0.35;
  g.save(); g.translate(cx, cy); g.rotate(Math.atan2(ux, -uy) + lean);
  g.strokeStyle = TINTA; g.lineWidth = 5; g.lineCap = 'round';
  if (cara.mechon) {
    g.beginPath(); g.moveTo(-14, -30); g.quadraticCurveTo(-24, -38, -30, -26); g.stroke();
    g.beginPath(); g.moveTo(0, -33); g.quadraticCurveTo(-8, -44, -18, -36); g.stroke();
  } else {
    g.beginPath(); g.moveTo(-12, -30); g.quadraticCurveTo(-18, -44, -8, -46); g.stroke();
    g.beginPath(); g.moveTo(0, -33); g.quadraticCurveTo(-2, -50, 8, -48); g.stroke();
    g.beginPath(); g.moveTo(12, -31); g.quadraticCurveTo(16, -44, 24, -40); g.stroke();
  }
  g.restore();
  drawCara(g, cara, cx, cy, ux, uy, t);
  if (manoDelante) {
    manguera(g, [hlx, hly, px(S, F.MANO, a), py(S, F.MANO, a)], PIEL, 5);
    bola(g, px(S, F.MANO, a), py(S, F.MANO, a), 9, PIEL);
  }
}

// ---------- Particulas: un array fijo, sin GC ----------
const NP = 96;
const parts = [];
for (let i = 0; i < NP; i++) parts.push({ on: false, tipo: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', size: 4, rot: 0, vr: 0, grav: 0 });
let pi = 0;
export const JIRON = 1, GOTA = 2, BURBUJA = 3, CONFETI = 4, ANILLO = 5;
export function particula(tipo, x, y, vx, vy, life, col, size, grav, rot) {
  const p = parts[pi]; pi = (pi + 1) % NP;
  p.on = true; p.tipo = tipo; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.col = col; p.size = size; p.grav = grav || 0; p.rot = rot || 0; p.vr = (Math.random() - 0.5) * 12;
}
export function limpiarParticulas() { for (const p of parts) p.on = false; }
export function updateParticulas(dt) {
  for (const p of parts) {
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) { p.on = false; continue; }
    p.vy += p.grav * dt;
    // El anillo usa vx como velocidad de CRECIMIENTO del radio, no se mueve.
    if (p.tipo !== ANILLO) { p.x += p.vx * dt; p.y += p.vy * dt; }
    p.rot += p.vr * dt;
    if (p.tipo === BURBUJA && p.y < AGUA_Y) p.on = false;
    if (p.tipo === GOTA && p.y > AGUA_Y + 4 && p.vy > 0) p.on = false;
  }
}
export function drawParticulas(g) {
  for (const p of parts) {
    if (!p.on) continue;
    const u = p.life / p.max;
    if (p.tipo === JIRON) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, u * 2);
      g.fillStyle = p.col; g.beginPath(); g.moveTo(-p.size, p.size * 0.6); g.lineTo(p.size, 0); g.lineTo(-p.size * 0.4, -p.size); g.closePath(); g.fill();
      g.restore();
    } else if (p.tipo === GOTA) {
      g.fillStyle = p.col; g.globalAlpha = Math.min(1, u * 1.5);
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill(); g.globalAlpha = 1;
    } else if (p.tipo === BURBUJA) {
      g.strokeStyle = 'rgba(200,220,255,0.7)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x + Math.sin(p.rot) * 3, p.y, p.size, 0, 7); g.stroke();
    } else if (p.tipo === CONFETI) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, u * 2);
      g.fillStyle = p.col; g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
      g.restore();
    } else if (p.tipo === ANILLO) {
      const r = p.size + (1 - u) * p.vx;
      g.strokeStyle = p.col; g.globalAlpha = u * 0.8; g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
  }
  g.globalAlpha = 1;
}

// ---------- Las casillas de la palabra ----------
// Centradas en x=270 entre y 744 y 796. Ancho = clamp(floor(500/L) - 6, 30, 48),
// L = caracteres incluidos espacios; un espacio es un hueco de medio ancho sin
// raya. `letras[i]` = lo que se ve en la casilla i ('' = nada), `col[i]` su
// color, `voltea[i]` = segundos que le quedan al volteo (0 = quieta). `y0` es
// el borde superior del bloque (52 px de alto); por defecto el del panel, pero
// al escribir la secreta en A DOS se dibujan en el cielo, donde hay sitio.
export function geoCasillas(palabra) {
  const L = palabra.length;
  const w = Math.max(30, Math.min(48, Math.floor(500 / Math.max(L, 1)) - 6)), hueco = 6;
  let total = 0;
  for (let i = 0; i < L; i++) total += (palabra[i] === ' ' ? w * 0.5 : w) + (i < L - 1 ? hueco : 0);
  const xs = []; let x = 270 - total / 2;
  for (let i = 0; i < L; i++) { const cw = palabra[i] === ' ' ? w * 0.5 : w; xs.push(x); x += cw + hueco; }
  return { w, xs };
}
export function drawCasillas(g, palabra, letras, cols, voltea, cursor, y0 = 744) {
  const geo = geoCasillas(palabra);
  const w = geo.w, esc = w >= 40 ? 4 : 3;
  for (let i = 0; i < palabra.length; i++) {
    const x = geo.xs[i];
    if (palabra[i] === ' ') continue;
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y0 + 49, w, 3);
    const L = letras[i];
    if (!L) continue;
    let sx = 1;
    if (voltea && voltea[i] > 0) { const u = voltea[i] / 0.2; sx = Math.abs(Math.cos(u * Math.PI)); if (u > 0.5) continue; }
    g.save();
    g.translate(x + w / 2, y0 + 26); g.scale(Math.max(0.05, sx), 1);
    text(g, L, Math.round(-measure(L, esc) / 2), Math.round(-7 * esc / 2), cols[i] || '#ffffff', esc);
    g.restore();
  }
  // Cursor de escritura (A DOS).
  if (cursor !== undefined && cursor >= 0) {
    const i = Math.min(cursor, palabra.length);
    const x = i < geo.xs.length ? geo.xs[i] : (geo.xs.length ? geo.xs[geo.xs.length - 1] + w + 6 : 270 - w / 2);
    g.fillStyle = '#5cffd8'; g.fillRect(x + 2, y0 + 8, 3, 38);
  }
}
