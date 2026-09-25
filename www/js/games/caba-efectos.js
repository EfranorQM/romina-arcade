// LOS EFECTOS de lo que hace Romina: saltar, caer, esquivar, acertar un tajo,
// la guardia, la parada y el golpe que recibe. Los usan las dos escenas (la
// pelea, caballero.js, y la aventura, caba-aventura.js) con las mismas
// llamadas, asi que un salto se ve igual en el salon que en el bosque.
//
// POR QUE (24-09-2026): "sus efectos son tan basicos". Cada accion soltaba
// 9-12 pixeles de polvo en direcciones al azar y poco mas: el salto no
// despegaba, la esquiva eran dos sombras fijas pegadas a ella y un tajo que
// acertaba se distinguia de uno al aire por el sonido. Ahora cada cosa tiene
// SU forma, y se lee a la escala del telefono (x1.95): nada de menos de 3 px,
// y lo que importa en blanco o en oro sobre el fondo oscuro.
//   SALTAR     un aro de polvo en el suelo y dos nubes que salen a los lados;
//              ella se estira al despegar
//   CAER       el aro y las nubes mas grandes cuanto mas cae, y se aplasta
//   ESQUIVAR   un aro violeta, rayas de velocidad y COPIAS de ella que se
//              quedan atras y se apagan (las del frame en que estaba)
//   ACERTAR    el CORTE: una raya blanca que cruza al enemigo en el sentido
//              del golpe (el reves sube, el derecho baja, el remate cae), una
//              estrella en el punto del impacto y chispas hacia donde empuja
//   GUARDIA    un arco de acero delante de ella mientras la mantiene; en la
//              ventana de la PARADA, de oro (lo mismo que dice su boton)
//   PARADA     un aro de oro que se abre, la estrella y chispas por todos lados
//   LE DAN     el borde de la pantalla se enrojece un instante
//   EL AVISO   de un ataque enemigo: un destello del color del BOTON que lo
//              contesta (azul SALTAR, violeta ESQUIVAR, acero GUARDIA) y, en
//              PASEO, el boton mismo encima del que ataca
//   UNO CAE    un enemigo derrotado: el polvo al tocar el suelo y, al final,
//              se deshace en humo (o en chispas de su fuego)
//
// Todo vive en coordenadas del MUNDO y se pinta con la camara (cx). Solo
// fillRect a pixel entero, sin degradados: en el Redmi un degradado cuesta 15
// veces un liso (ver la memoria de medir el pintado).

import { drawSilueta } from './romi-sprite.js';
import { textCenter } from '../font.js';
import { BLOQ_SUBE, BLOQUEA } from './caba-cuerpo.js';

const BLANCO = '#ffffff', ORO = '#ffe066', ORO2 = '#ffb62e', ACERO = '#d4dcf0', ACERO2 = '#8a97b8';
const OSC = '#1a0e14';      // el contorno de todo el arcade: separa lo blanco de lo claro
const VIOLETA = '#b48cff', ROJO = '#c41c5a';
// El color del CORTE de cada golpe: el reves y el derecho del rosa del combo,
// el remate y el contraataque de oro (como el x3 y el CONTRA! del marcador).
const COLOR_GOLPE = ['#ff8fbc', '#ff8fbc', ORO, ORO];

// `polvo`: los tres tonos del suelo de la escena (claro, medio, oscuro).
export function makeEfectos(polvo) {
  return { cosas: [], chispas: [], copias: [], polvo, rojo: 0, estira: null, t: 0, paso: 0 };
}

// ---------------------------------------------------------------- lo que pasa
// Despega de un salto en (x, y), los pies.
export function despega(F, x, y) {
  F.cosas.push({ tipo: 'aro', x, y, t: 0, dur: 0.24, r0: 12, r1: 46, col: F.polvo[0], s: 4 });
  nubes(F, x, y, 80, 6, 13, 0.28);
  F.estira = { t: 0, dur: 0.12, ex: 0.88, ey: 1.13 };
}

// Toca suelo en (x, y). `fuerza` 0..1: lo que venia cayendo (la escena pasa
// la velocidad de caida). Bajar un escalon no se ve como caer de un salto.
export function aterriza(F, x, y, fuerza) {
  const f = Math.max(0, Math.min(1, fuerza));
  if (f < 0.15) return;
  F.cosas.push({ tipo: 'aro', x, y, t: 0, dur: 0.28, r0: 16, r1: 50 + 34 * f, col: F.polvo[0], s: 4 });
  nubes(F, x, y, 80 + 80 * f, 7, 15 + 7 * f, 0.32 + 0.12 * f);
  F.estira = { t: 0, dur: 0.13, ex: 1 + 0.16 * f, ey: 1 - 0.14 * f };
}

// Empieza una esquiva en (x, y) hacia `dir` (hacia donde se mueve).
export function esquiva(F, x, y, dir) {
  F.cosas.push({ tipo: 'aro', x, y, t: 0, dur: 0.22, r0: 10, r1: 52, col: VIOLETA, s: 4 });
  for (let i = 0; i < 3; i++) raya(F, x, y, dir, i);
  F.estira = { t: 0, dur: 0.1, ex: 1.12, ey: 0.9 };
}

// Mientras esquiva (cada paso): deja copias de ella y rayas de velocidad.
// `pose`/`frame`: lo que se esta dibujando (C.pose). Una copia cada dos pasos:
// a 640 px/s son 21 px entre copia y copia, que es lo que hace leer la
// velocidad sin que se empasten.
export function estela(F, K, pose, frame, invulnerable) {
  F.paso++;
  if (F.paso % 2 === 0) F.copias.push({ x: K.x, y: K.y, dir: K.dir, pose, frame, t: 0, dur: invulnerable ? 0.22 : 0.12 });
  if (invulnerable && F.paso % 3 === 0) raya(F, K.x, K.y, K.esqDir, F.paso);
}

// Un tajo que ACIERTA: (x, y) el punto del impacto, `dir` hacia donde mira
// ella, `golpe` 0 1 2 (el del combo) o 3 (el contraataque).
export function acierta(F, x, y, dir, golpe) {
  const g = Math.max(0, Math.min(3, golpe));
  // El angulo del corte, mirando a la derecha: el reves sube, el derecho baja
  // y el remate (y el contraataque, que usa sus dibujos) cae casi a plomo.
  const ang = [-0.55, 0.55, 1.15, 1.05][g];
  const a = dir > 0 ? ang : Math.PI - ang;
  F.cosas.push({ tipo: 'corte', x, y, t: 0, dur: [0.15, 0.15, 0.2, 0.22][g], a,
                 largo: [110, 110, 150, 170][g], s: [5, 5, 7, 8][g], col: COLOR_GOLPE[g] });
  F.cosas.push({ tipo: 'estrella', x, y, t: 0, dur: [0.1, 0.1, 0.14, 0.16][g], L: [18, 18, 26, 30][g], s: [4, 4, 6, 6][g], col: g >= 2 ? ORO : BLANCO });
  if (g >= 2) F.cosas.push({ tipo: 'anillo', x, y, t: 0, dur: 0.24, r0: 10, r1: 52, col: ORO, s: 4 });
  chispas(F, x, y, dir, [7, 8, 12, 14][g], [BLANCO, COLOR_GOLPE[g], ORO], 0.95, 220, 440);
}

// LA PARADA: el golpe rebota en su espada, en (x, y).
export function para(F, x, y) {
  F.cosas.push({ tipo: 'anillo', x, y, t: 0, dur: 0.32, r0: 14, r1: 88, col: ORO, s: 4 });
  F.cosas.push({ tipo: 'estrella', x, y, t: 0, dur: 0.22, L: 36, s: 6, col: ORO });
  chispas(F, x, y, 0, 16, [ORO, BLANCO, ORO2], Math.PI, 240, 400, 300);
}

// Un golpe parado con la guardia ya vieja (sin premio): menos, y de acero.
export function bloquea(F, x, y, dir) {
  F.cosas.push({ tipo: 'anillo', x, y, t: 0, dur: 0.18, r0: 10, r1: 42, col: ACERO, s: 3 });
  chispas(F, x, y, -dir, 8, [ACERO, BLANCO, ACERO2], 0.9, 160, 300);
}

// Le entra un golpe a ella.
export function herida(F) { F.rojo = 1; }

// EL AVISO de un ataque: sobre la cabeza del que ataca, en (x, y), un destello
// y un aro del color del boton que lo contesta (`resp`: guardia, esquivar o
// saltar). Con `icono` (un medallon pequeño, caba-botones.js horneaMini) el
// boton sale ademas encima mientras dura el aviso (`dur`): es lo que se hace
// en PASEO. El color es el de la cara de cada boton, aclarado para que se lea
// sobre el bosque y el salon.
export const COLOR_RESPUESTA = { guardia: '#d8e4ff', esquivar: '#c49cff', saltar: '#78b4ff' };
export function aviso(F, x, y, resp, dur, icono) {
  const col = COLOR_RESPUESTA[resp] || BLANCO;
  F.cosas.push({ tipo: 'estrella', x, y, t: 0, dur: 0.3, L: 22, s: 5, col });
  F.cosas.push({ tipo: 'anillo', x, y, t: 0, dur: 0.35, r0: 8, r1: 46, col, s: 3 });
  if (icono) F.cosas.push({ tipo: 'icono', x, y: y - 36, t: 0, dur: Math.max(0.45, dur), img: icono });
}

// UN ENEMIGO CAE en (x, y): el polvo cuando toca el suelo (el salto hacia
// atras lo pinta enemigos-sprite.js) y, cuando se va apagando, humo que sube
// (el lobo) o chispas de su fuego azul (la kitsune).
// UN NUMERO QUE SUBE Y SE APAGA (el +1 del vampiro que se cura).
export function numero(F, x, y, txt, col) {
  F.cosas.push({ tipo: 'numero', x, y, t: 0, dur: 0.9, txt, col });
}

export const CAE_T = 0.36;               // lo que tarda en tocar el suelo
export function muerte(F, x, y, tipo) {
  F.cosas.push({ tipo: 'aro', x, y, t: -CAE_T, dur: 0.32, r0: 18, r1: 70, col: F.polvo[0], s: 4 });
  nubes(F, x, y, 120, 8, 17, 0.42, CAE_T);
  // (El humo del lobo, gris violeta claro: del color de su pelo, #3c3450, no
  // se veia sobre el verde oscuro del bosque.)
  const cols = tipo === 'kitsune' ? ['#6be8ff', '#e8ffff', '#1e9cd8']
    : tipo === 'vampira' || tipo === 'vampiro' || tipo === 'condesa' ? ['#ffb040', '#ff4a3a', '#6a0c18']
    : ['#9a90b0', '#c8c0dc', '#6a6080'];
  for (let i = 0; i < 20; i++) {
    F.chispas.push({ x: x + (Math.random() - 0.5) * 70, y: y - 8 - Math.random() * 70, vx: (Math.random() - 0.5) * 50,
                     vy: -50 - Math.random() * 70, grav: -40, t: -(1.1 + Math.random() * 0.5), dur: 0.7,
                     s: Math.random() < 0.5 ? 6 : 4, col: cols[i % 3], humo: true });
  }
}

// ---------------------------------------------------------------- el paso
export function step(F, dt) {
  F.t += dt;
  for (const c of F.cosas) c.t += dt;
  F.cosas = F.cosas.filter(c => c.t < c.dur);
  for (const c of F.copias) c.t += dt;
  F.copias = F.copias.filter(c => c.t < c.dur);
  for (const p of F.chispas) {
    p.t += dt;
    if (p.t < 0) continue;                  // con retraso: todavia no ha salido
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.nube) { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
  }
  F.chispas = F.chispas.filter(p => p.t < p.dur);
  if (F.rojo > 0) F.rojo = Math.max(0, F.rojo - dt / 0.35);
  if (F.estira) { F.estira.t += dt; if (F.estira.t >= F.estira.dur) F.estira = null; }
}

// Cuanto se estira o se aplasta ella ahora: [ancho, alto], alrededor de los
// pies. Vuelve a 1 con una curva que frena al final.
export function escala(F) {
  const E = F.estira;
  if (!E) return [1, 1];
  const k = 1 - E.t / E.dur, u = k * k;
  return [1 + (E.ex - 1) * u, 1 + (E.ey - 1) * u];
}

// ---------------------------------------------------------------- pintar
// Lo que va DETRAS de ella: las copias de la esquiva y lo que esta en el suelo.
export function drawDetras(g, F, cx) {
  for (const c of F.copias) {
    const u = c.t / c.dur;
    drawSilueta(g, c.x - cx, c.y, c.dir, c.pose, c.frame, VIOLETA, 0.55 * (1 - u));
  }
  for (const c of F.cosas) {
    if (c.tipo !== 'aro' || c.t < 0) continue;
    const u = c.t / c.dur, r = c.r0 + (c.r1 - c.r0) * sale(u);
    g.globalAlpha = 0.85 * (1 - u); g.fillStyle = c.col;
    elipse(g, c.x - cx, c.y + 1, r, r * 0.2, c.s);
  }
  g.globalAlpha = 1;
}

// Lo que va DELANTE de todo: cortes, estrellas, aros, rayas y chispas.
export function drawDelante(g, F, cx) {
  for (const c of F.cosas) {
    if (c.t < 0) continue;
    const u = c.t / c.dur, x = c.x - cx, y = c.y;
    if (c.tipo === 'icono') {
      // El boton que lo contesta: entra de golpe (un poco grande), flota y se
      // va al final del aviso.
      const e = c.t < 0.1 ? 1.35 - 0.35 * c.t / 0.1 : 1, w = c.img.width * e;
      g.globalAlpha = Math.min(1, (c.dur - c.t) / 0.12);
      g.drawImage(c.img, Math.round(x - w / 2), Math.round(y - w / 2 + Math.sin(c.t * 9) * 2), Math.round(w), Math.round(w));
      g.globalAlpha = 1;
      continue;
    }
    if (c.tipo === 'numero') {
      g.globalAlpha = Math.min(1, (1 - u) * 2);
      textCenter(g, c.txt, Math.round(x), Math.round(y - 40 * sale(u)), c.col, 4);
      g.globalAlpha = 1;
      continue;
    }
    if (c.tipo === 'corte') {
      // ENTERO DESDE EL PRIMER FRAME: el golpe congela el mundo (hitstop) y
      // los efectos con el, asi que el frame del impacto es el que mas dura en
      // pantalla. Creciendo desde cero, justo ese no enseñaba nada. Se alarga
      // un poco y luego se afina y se va. Con CONTORNO: el enemigo destella en
      // blanco en ese mismo instante, y una raya blanca sobre el no se veia.
      const L = c.largo * (0.85 + 0.15 * Math.min(1, u / 0.25)) / 2, ca = Math.cos(c.a) * L, sa = Math.sin(c.a) * L;
      const s = Math.max(1, Math.round(c.s * (u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7)));
      g.globalAlpha = 0.8 * (1 - u * u); g.fillStyle = OSC;
      linea(g, x - ca, y - sa, x + ca, y + sa, s + 8);
      g.globalAlpha = 1 - u * u; g.fillStyle = c.col;
      linea(g, x - ca, y - sa, x + ca, y + sa, s + 4);
      g.fillStyle = BLANCO;
      linea(g, x - ca, y - sa, x + ca, y + sa, s);
    } else if (c.tipo === 'estrella') {
      const L = Math.round(c.L * (1 - u * 0.6));
      g.globalAlpha = 0.7 * (1 - u * 0.5); g.fillStyle = OSC;
      estrella(g, Math.round(x), Math.round(y), L + 3, c.s + 4);
      g.globalAlpha = 1 - u * 0.5; g.fillStyle = c.col;
      estrella(g, Math.round(x), Math.round(y), L, c.s);
      g.fillStyle = BLANCO; estrella(g, Math.round(x), Math.round(y), Math.round(L * 0.5), Math.max(2, c.s - 2));
    } else if (c.tipo === 'anillo') {
      const r = c.r0 + (c.r1 - c.r0) * sale(u);
      g.globalAlpha = 0.5 * (1 - u); g.fillStyle = OSC;
      elipse(g, x, y, r, r, c.s + 3);
      g.globalAlpha = 0.95 * (1 - u); g.fillStyle = c.col;
      elipse(g, x, y, r, r, c.s);
    } else if (c.tipo === 'raya') {
      // Una raya de velocidad: nace detras de ella y se encoge hacia atras.
      const L = c.largo * (1 - u), x0 = x - c.dir * 26;
      g.globalAlpha = 0.7 * (1 - u); g.fillStyle = c.col;
      g.fillRect(Math.round(c.dir > 0 ? x0 - L : x0), Math.round(y), Math.round(L), 3);
    }
  }
  for (const p of F.chispas) {
    if (p.t < 0) continue;
    const u = p.t / p.dur, s = u < 0.6 ? p.s : Math.max(2, p.s - 1);
    g.globalAlpha = p.nube ? 0.7 * (1 - u) : p.humo ? 0.75 * (1 - u) : 1; g.fillStyle = p.col;
    const lado = p.nube ? Math.round(p.s + (p.s1 - p.s) * u) : s;
    g.fillRect(Math.round(p.x - cx - lado / 2), Math.round(p.y - lado / 2), lado, lado);
  }
  g.globalAlpha = 1;
}

// LA GUARDIA: un arco de acero delante de ella mientras la mantiene (y de oro
// en la ventana de la PARADA). `ventana`: si esta en ella. Se pinta despues de
// ella: el arco va por delante del cuerpo.
export function drawGuardia(g, K, cx, t, ventana) {
  if (K.st !== BLOQUEA) return;
  const sube = Math.min(1, K.bloqT / BLOQ_SUBE);
  const choque = K.bloqHit > 0;
  const R = 56 + (ventana ? 4 + 3 * Math.sin(t * 40) : 0) + (choque ? 6 : 0);
  const ox = K.x - cx + K.dir * 8, oy = K.y - 96;
  const abre = 1.1 * sube;
  const arco = (r, col, alfa, grueso) => {
    const n = Math.max(3, Math.round(2 * abre * r / 3));
    g.globalAlpha = alfa;
    for (let i = 0; i <= n; i++) {
      const a = -abre + (2 * abre) * i / n;
      const px = ox + K.dir * Math.cos(a) * r, py = oy + Math.sin(a) * r;
      // mas grueso en el centro, fino en las puntas
      const s = Math.max(2, Math.round(grueso * (1 - 0.55 * Math.abs(a) / 1.1)));
      g.fillStyle = OSC; g.fillRect(Math.round(px - s / 2) - 1, Math.round(py - s / 2) - 1, s + 2, s + 2);
      g.fillStyle = col; g.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
    }
  };
  if (choque) arco(R, BLANCO, 1, 7);
  else if (ventana) { arco(R + 9, '#fff2b8', 0.55, 4); arco(R, ORO, 1, 7); }
  else arco(R, ACERO, 0.75 * sube, 6);
  g.globalAlpha = 1;
}

// EL BORDE ROJO del golpe recibido, en coordenadas de pantalla.
export function drawPantalla(g, F, VW, VH) {
  if (F.rojo <= 0) return;
  g.fillStyle = ROJO;
  for (const [a, w] of [[0.5, 16], [0.25, 34]]) {
    g.globalAlpha = a * F.rojo;
    g.fillRect(0, 0, VW, w); g.fillRect(0, VH - w, VW, w);
    g.fillRect(0, w, w, VH - 2 * w); g.fillRect(VW - w, w, w, VH - 2 * w);
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- piezas
function sale(u) { return 1 - (1 - u) * (1 - u); }

// Dos nubes de polvo que salen a los lados por el suelo, cada una de cuatro bolas.
function nubes(F, x, y, vel, s0, s1, dur, retraso = 0) {
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      F.chispas.push({ nube: true, x: x + lado * (4 + i * 8), y: y - 4 - (i % 2) * 6, vx: lado * vel * (1 - i * 0.18), vy: -18 - i * 8,
                       grav: 0, t: -retraso, dur: dur * (1 - i * 0.1), s: s0, s1: s1 - i * 2, col: F.polvo[i === 2 ? 1 : 0] });
    }
  }
}

// Chispas que salen de (x, y) hacia `dir` (0: hacia todos lados) dentro de
// +-abre radianes, un poco hacia arriba.
function chispas(F, x, y, dir, n, cols, abre, v0, v1, grav = 900) {
  for (let i = 0; i < n; i++) {
    const base = dir === 0 ? -Math.PI / 2 : dir > 0 ? -0.25 : Math.PI + 0.25;
    const a = base + (Math.random() * 2 - 1) * abre;
    const v = v0 + Math.random() * (v1 - v0);
    F.chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav, t: 0, dur: 0.28 + Math.random() * 0.18,
                     s: Math.random() < 0.4 ? 5 : 4, col: cols[i % cols.length] });
  }
}

// Una raya de velocidad detras de ella, a una altura del cuerpo.
function raya(F, x, y, dir, k) {
  const alto = [46, 92, 136][((k % 3) + 3) % 3] + ((k * 13) % 11);
  F.cosas.push({ tipo: 'raya', x, y: y - alto, dir, t: 0, dur: 0.16, largo: 70 + ((k * 29) % 40),
                 col: k % 2 ? VIOLETA : BLANCO });
}

// Una elipse de puntos gordos (el contorno, no relleno).
function elipse(g, x, y, rx, ry, s) {
  const n = Math.max(12, Math.round(2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2) / (s * 0.8)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(x + Math.cos(a) * rx - s / 2), Math.round(y + Math.sin(a) * ry - s / 2), s, s);
  }
}
// Una linea de puntos gordos de (x0,y0) a (x1,y1): sin antialias, como todo.
function linea(g, x0, y0, x1, y1, s) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, s * 0.5)));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    g.fillRect(Math.round(x0 + (x1 - x0) * u - s / 2), Math.round(y0 + (y1 - y0) * u - s / 2), s, s);
  }
}
// Una estrella de cuatro puntas con las diagonales mas cortas.
function estrella(g, x, y, L, s) {
  const m = Math.floor(s / 2);
  g.fillRect(x - L, y - m, L * 2, s); g.fillRect(x - m, y - L, s, L * 2);
  const D = Math.round(L * 0.55), d = Math.max(2, s - 2);
  for (let i = -D; i <= D; i += 2) { g.fillRect(x + i - 1, y + i - 1, d, d); g.fillRect(x + i - 1, y - i - 1, d, d); }
}
