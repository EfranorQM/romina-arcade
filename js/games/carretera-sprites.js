// carretera-sprites.js - FURIA: los dibujos de la carretera, todos por codigo.
//
// Cuatro paisajes (costa, cañon, bosque, nieve) y cuatro cielos (dia,
// atardecer, amanecer, noche). El suelo de cada paisaje es el de dia y el
// cielo lo tiñe; de noche los pilotos de los coches y los catadioptricos de
// los postes brillan. Todo se hornea UNA vez por nivel (sprites()) al doble de
// su tamaño y luego solo se estira: pintar por codigo cada frame costaria
// cientos de trazos por arbol.

import { FONT5x7 } from '../font.js';

export const W = 1200, H = 540;
export const NN = 24;                       // pasos de niebla

export function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function mezcla(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const c = i => Math.round(A[i] + (B[i] - A[i]) * t);
  return 'rgb(' + c(0) + ',' + c(1) + ',' + c(2) + ')';
}
function hex(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const c = i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return '#' + c(0) + c(1) + c(2);
}
export function caja(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}
export function elipse(g, x, y, rx, ry, rot) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
}
export function corazon(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.95);
  g.bezierCurveTo(x - r * 1.35, y + r * 0.1, x - r * 0.95, y - r * 1.0, x, y - r * 0.38);
  g.bezierCurveTo(x + r * 0.95, y - r * 1.0, x + r * 1.35, y + r * 0.1, x, y + r * 0.95);
  g.closePath();
}

// ---------- Colores ----------
export const BIOMAS = {
  costa: { cesped: ['#86c95d', '#7abd53'], asfalto: ['#8e939c', '#898e97'], raya: '#f7f7f2', charco: ['#3d5f86', 'AGUA'] },
  canon: { cesped: ['#e4ab6a', '#d89d5c'], asfalto: ['#8f8a88', '#8a8583'], raya: '#faf3e6', charco: ['#f0d08e', 'ARENA'] },
  bosque: { cesped: ['#5c9c48', '#51903f'], asfalto: ['#80858d', '#7b8088'], raya: '#f3f3ee', charco: ['#5b4332', 'BARRO'] },
  nieve: { cesped: ['#f3f7fc', '#e4ecf5'], asfalto: ['#8d939e', '#888e99'], raya: '#ffffff', charco: ['#c6ecff', 'HIELO'] },
};
export const CIELOS = {
  dia: { grad: ['#2a86e0', '#7cc0f0', '#d4ecf8'], tinte: null, astro: 'sol', ax: 0.8, ay: 0.12, ar: 26, ac: '#fffbe8', halo: '255,250,220', nubes: 0.92, estrellas: 0 },
  atardecer: { grad: ['#3a2a6c', '#d9687e', '#ffc58c'], tinte: ['#ff8a5c', 0.22], astro: 'sol', ax: 0.7, ay: 0.4, ar: 46, ac: '#fff0c4', halo: '255,196,140', nubes: 0.6, estrellas: 0.25 },
  amanecer: { grad: ['#5d86cc', '#eeb0c2', '#fde4cc'], tinte: ['#ffb6c6', 0.14], astro: 'sol', ax: 0.24, ay: 0.38, ar: 36, ac: '#fff6de', halo: '255,225,205', nubes: 0.85, estrellas: 0 },
  noche: { grad: ['#050918', '#111838', '#252a52'], tinte: ['#0b1030', 0.68], astro: 'luna', ax: 0.72, ay: 0.15, ar: 20, ac: '#eef0ff', halo: '200,210,255', nubes: 0.12, estrellas: 1 },
};
const tinta = (c, C) => (C.tinte ? hex(c, C.tinte[0], C.tinte[1]) : c);

// Los colores de la calzada, con sus pasos de niebla ya mezclados: pintar un
// tramo es elegir un color hecho, no mezclarlo.
function colores(D) {
  const B = BIOMAS[D.bioma], C = CIELOS[D.cielo], niebla = C.grad[2];
  const noche = D.cielo === 'noche';
  const base = {
    cesped: B.cesped.map(c => tinta(c, C)),
    borde: noche ? ['#9aa0b0', '#8a2a3a'] : ['#f4f4f4', tinta('#e2374f', C)],
    asfalto: B.asfalto.map(c => tinta(c, C)),
    raya: [noche ? '#c9ccd8' : tinta(B.raya, C)],
  };
  const out = { niebla, charco: tinta(B.charco[0], C), charcoNombre: B.charco[1], suelo: tinta(B.cesped[0], C) };
  for (const k in base) out[k] = base[k].map(c => { const r = []; for (let i = 0; i <= NN; i++) r.push(mezcla(c, niebla, i / NN)); return r; });
  return out;
}

// ---------- Fondos ----------
const onda = (x, Wd, a) => { let y = 0; for (const [amp, n, f] of a) y += amp * Math.sin((x / Wd) * Math.PI * 2 * n + f); return y; };

function hazCielo(D) {
  const C = CIELOS[D.cielo], c = lienzo(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H / 2 + 40);
  gr.addColorStop(0, C.grad[0]);
  gr.addColorStop(0.62, C.grad[1]);
  gr.addColorStop(1, C.grad[2]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const r = azar(7);
  if (C.estrellas) {
    for (let i = 0; i < 160 * C.estrellas; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.65).toFixed(2) + ')';
      const s = r() < 0.12 ? 2.2 : 1.3;
      g.fillRect(r() * W, r() * H * 0.42, s, s);
    }
  }
  const x = C.ax * W, y = C.ay * H;
  const hal = g.createRadialGradient(x, y, C.ar * 0.4, x, y, C.ar * 5);
  hal.addColorStop(0, 'rgba(' + C.halo + ',0.85)');
  hal.addColorStop(1, 'rgba(' + C.halo + ',0)');
  g.fillStyle = hal;
  g.fillRect(x - C.ar * 5, y - C.ar * 5, C.ar * 10, C.ar * 10);
  g.fillStyle = C.ac;
  elipse(g, x, y, C.ar, C.ar); g.fill();
  if (C.astro === 'luna') {
    g.fillStyle = C.grad[0];
    elipse(g, x + C.ar * 0.45, y - C.ar * 0.25, C.ar * 0.86, C.ar * 0.86); g.fill();
  }
  return c;
}

function hazNubes(D) {
  const C = CIELOS[D.cielo], Wd = 2400, c = lienzo(Wd, 190), g = c.getContext('2d'), r = azar(11);
  if (C.nubes < 0.2) return c;
  const nube = (x, y, s) => {
    g.fillStyle = 'rgba(255,255,255,' + C.nubes + ')';
    for (const [dx, dy, rr] of [[0, 0, 22], [24, -8, 26], [50, 0, 20], [26, 8, 22]]) { elipse(g, x + dx * s, y + dy * s, rr * s * 1.3, rr * s * 0.8); g.fill(); }
    g.fillStyle = 'rgba(160,180,210,' + (C.nubes * 0.45).toFixed(2) + ')';
    elipse(g, x + 26 * s, y + 14 * s, 46 * s, 6 * s); g.fill();
  };
  for (let i = 0; i < 9; i++) {
    const x = r() * Wd, y = 40 + r() * 90, s = 0.8 + r() * 1.1;
    nube(x, y, s);
    nube(x - Wd, y, s);
  }
  if (C.tinte) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = C.tinte[0];
    g.globalAlpha = C.tinte[1] * 0.8;
    g.fillRect(0, 0, Wd, 190);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  return c;
}

// La franja lejana de cada paisaje (2400 de ancho, se repite sin costura).
function hazLejos(D) {
  const C = CIELOS[D.cielo], Wd = 2400, Hd = 170, c = lienzo(Wd, Hd), g = c.getContext('2d');
  const r = azar(23), niebla = C.grad[2];
  const t = col => hex(tinta(col, C), niebla, 0.25);
  if (D.bioma === 'costa') {
    g.fillStyle = t('#a9c8e2');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, 92 + onda(x, Wd, [[26, 3, 0.5], [14, 7, 1.2], [6, 13, 2.2]]));
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
    g.fillStyle = t('#86aed3');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, Math.min(Hd - 22, 140 + onda(x, Wd, [[30, 2, 2.4], [12, 9, 0.3]])));
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
    g.fillStyle = t('#4c9bd6');
    g.fillRect(0, Hd - 24, Wd, 24);
    g.strokeStyle = D.cielo === 'noche' ? 'rgba(200,210,255,0.35)' : 'rgba(255,255,255,0.6)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % Wd, yy = Hd - 18 + (i % 3) * 5;
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 20, yy); g.stroke();
    }
  } else if (D.bioma === 'canon') {
    // Mesetas: cumbre plana y paredes rectas.
    for (const [col, base, alto] of [['#b87a8a', 100, 60], ['#9c5a62', 130, 40]]) {
      g.fillStyle = t(col);
      g.beginPath(); g.moveTo(0, Hd); g.lineTo(0, base);
      let x = 0;
      while (x < Wd) {
        const w = 90 + r() * 220, h = alto * (0.5 + r() * 0.8);
        const w2 = Math.min(w, Wd - x);
        g.lineTo(x, base); g.lineTo(x + w2 * 0.12, base - h); g.lineTo(x + w2 * 0.88, base - h); g.lineTo(x + w2, base);
        x += w + r() * 60;
      }
      g.lineTo(Wd, base); g.lineTo(Wd, Hd); g.closePath(); g.fill();
    }
  } else if (D.bioma === 'bosque') {
    g.fillStyle = t('#7ea3a6');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, 70 + onda(x, Wd, [[34, 3, 0.9], [16, 8, 2.0], [7, 17, 0.4]]));
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
    g.fillStyle = t('#5b8a80');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, 112 + onda(x, Wd, [[24, 4, 2.2], [10, 11, 1.1]]));
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
  } else {
    // Nieve: picos blancos con la cara en sombra azul.
    const picos = [];
    let x = -80;
    while (x < Wd) { const w = 160 + r() * 200, h = 60 + r() * 70; picos.push([x, w, h]); x += w * 0.7; }
    g.fillStyle = t('#c9d8ea');
    g.beginPath(); g.moveTo(0, Hd); g.lineTo(0, 140);
    for (const [x0, w, h] of picos) { g.lineTo(x0, 140); g.lineTo(x0 + w / 2, 140 - h); g.lineTo(x0 + w, 140); }
    g.lineTo(Wd, 140); g.lineTo(Wd, Hd); g.closePath(); g.fill();
    for (const [x0, w, h] of picos) {
      g.fillStyle = t('#ffffff');
      g.beginPath(); g.moveTo(x0 + w / 2, 140 - h); g.lineTo(x0 + w / 2 - w * 0.16, 140 - h * 0.62); g.lineTo(x0 + w / 2 + w * 0.05, 140 - h * 0.7); g.lineTo(x0 + w / 2 + w * 0.2, 140 - h * 0.58); g.closePath(); g.fill();
      g.fillStyle = t('#9fb6d4');
      g.beginPath(); g.moveTo(x0 + w / 2, 140 - h); g.lineTo(x0 + w, 140); g.lineTo(x0 + w * 0.62, 140); g.closePath(); g.fill();
    }
    g.fillStyle = t('#dce7f3');
    g.fillRect(0, 138, Wd, Hd - 138);
  }
  return c;
}

// La franja cercana: colinas, rocas rojas, una fila de pinos o lomas nevadas.
function hazCerca(D) {
  const C = CIELOS[D.cielo], Wd = 2400, Hd = 110, c = lienzo(Wd, Hd), g = c.getContext('2d');
  const r = azar(31), niebla = C.grad[2];
  const t = col => tinta(col, C);
  const alto = x => 52 + onda(x, Wd, [[18, 4, 0.7], [10, 9, 2.1]]);
  if (D.bioma === 'costa') {
    g.fillStyle = t('#62ad4f');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, alto(x));
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
    for (let i = 0; i < 150; i++) {
      const x = 12 + r() * (Wd - 24), y = alto(x) + 6 + r() * 16;
      g.fillStyle = t(r() < 0.5 ? '#4b9440' : '#3f8a3a');
      elipse(g, x, y, 6 + r() * 5, 6 + r() * 4); g.fill();
    }
  } else if (D.bioma === 'canon') {
    g.fillStyle = t('#c9794a');
    g.beginPath(); g.moveTo(0, Hd); g.lineTo(0, 70);
    let x = 0;
    while (x < Wd) {
      const w = 40 + r() * 90, h = 20 + r() * 50, w2 = Math.min(w, Wd - x);
      g.lineTo(x, 70); g.lineTo(x + w2 * 0.2, 70 - h); g.lineTo(x + w2 * 0.5, 70 - h * (0.8 + r() * 0.3)); g.lineTo(x + w2 * 0.8, 70 - h); g.lineTo(x + w2, 70);
      x += w + r() * 80;
    }
    g.lineTo(Wd, 70); g.lineTo(Wd, Hd); g.closePath(); g.fill();
    g.fillStyle = t('#b0643c');
    g.fillRect(0, 68, Wd, Hd - 68);
  } else if (D.bioma === 'bosque') {
    g.fillStyle = t('#2f5a3a');
    g.fillRect(0, 80, Wd, Hd - 80);
    for (let x = 8; x < Wd - 8; x += 9 + r() * 12) {
      const h = 34 + r() * 40;
      g.beginPath(); g.moveTo(x - 11, 84); g.lineTo(x, 84 - h); g.lineTo(x + 11, 84); g.closePath(); g.fill();
    }
  } else {
    g.fillStyle = t('#eef3f9');
    g.beginPath(); g.moveTo(0, Hd);
    for (let x = 0; x <= Wd; x += 10) g.lineTo(x, alto(x) + 8);
    g.lineTo(Wd, Hd); g.closePath(); g.fill();
    for (let i = 0; i < 90; i++) {
      const x = 12 + r() * (Wd - 24), y = alto(x) + 14 + r() * 14, h = 12 + r() * 14;
      g.fillStyle = t('#3f6a5a');
      g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x, y - h); g.lineTo(x + 6, y); g.closePath(); g.fill();
      g.fillStyle = t('#ffffff');
      g.beginPath(); g.moveTo(x - 3, y - h * 0.55); g.lineTo(x, y - h); g.lineTo(x + 3, y - h * 0.55); g.closePath(); g.fill();
    }
  }
  // El pie de la franja se funde con la niebla: sin costura contra la carretera.
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, Hd * 0.45, 0, Hd);
  const [a, b, cc] = rgb(niebla);
  gr.addColorStop(0, `rgba(${a},${b},${cc},0)`);
  gr.addColorStop(1, `rgba(${a},${b},${cc},0.8)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, Wd, Hd);
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------- Sprites: se hornean al doble y se estiran ----------
function sprite(cw, ch, dibuja) {
  const c = lienzo(cw * 2, ch * 2), g = c.getContext('2d');
  g.scale(2, 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  dibuja(g);
  return c;
}
// Lo tiñe el cielo (atardecer calido, noche azul oscura).
function tintaSprite(c, cielo) {
  const C = CIELOS[cielo];
  if (!C.tinte) return c;
  const g = c.getContext('2d');
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = C.tinte[0];
  g.globalAlpha = C.tinte[1];
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
  return c;
}

function palmera(r) {
  return sprite(220, 330, g => {
    const inc = 14 + r() * 18, cx = 84, tx = cx + inc, ty = 72;
    const P = t => {
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
      return [a * cx + b * (cx + inc * 0.12) + d * tx, a * 330 + b * 190 + d * ty];
    };
    g.fillStyle = '#8b6b4a';
    g.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = P(i / 20), w = 8.5 - i * 0.2; if (i === 0) g.moveTo(x - w, y); else g.lineTo(x - w, y); }
    for (let i = 20; i >= 0; i--) { const [x, y] = P(i / 20), w = 8.5 - i * 0.2; g.lineTo(x + w, y); }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,45,25,0.45)';
    g.lineWidth = 1.3;
    for (let i = 1; i < 20; i++) { const [x, y] = P(i / 20), w = 8.5 - i * 0.2; g.beginPath(); g.moveTo(x - w, y + 1.5); g.lineTo(x + w, y - 1.5); g.stroke(); }
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI + (r() - 0.5) * 0.2, len = 62 + r() * 26;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.42;
      const mx = tx + Math.cos(a) * len * 0.55, my = ty + Math.sin(a) * len * 0.75;
      const dx = ex - tx, dy = ey - ty, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 8, ny = (dx / l) * 8;
      g.fillStyle = i % 2 ? '#2e9448' : '#3aae57';
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx + nx, my + ny, ex, ey); g.quadraticCurveTo(mx - nx * 0.4, my - ny * 0.4, tx, ty + 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,70,30,0.5)';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
    }
    g.fillStyle = '#6b4a2b';
    for (const [ox, oy] of [[-5, 6], [4, 7], [0, 11]]) { elipse(g, tx + ox, ty + oy, 4.5, 4.5); g.fill(); }
  });
}

function cactus(r) {
  return sprite(160, 300, g => {
    const x = 80, verde = '#3f8f4f', claro = '#5fb36a', osc = '#2c6b3a';
    const brazo = (lado, y0, alto) => {
      const bx = x + lado * 34;
      g.fillStyle = verde;
      caja(g, lado < 0 ? bx - 12 : x, y0 - 12, 46, 20, 10); g.fill();
      caja(g, bx - 12, y0 - alto, 24, alto + 4, 12); g.fill();
      g.fillStyle = claro;
      g.fillRect(bx - 5, y0 - alto + 8, 3, alto - 14);
    };
    g.fillStyle = 'rgba(0,0,0,0.18)';
    elipse(g, x, 296, 40, 5); g.fill();
    if (r() < 0.85) brazo(-1, 150 + r() * 40, 60 + r() * 40);
    if (r() < 0.7) brazo(1, 120 + r() * 50, 50 + r() * 40);
    g.fillStyle = verde;
    caja(g, x - 20, 40, 40, 258, 20); g.fill();
    g.fillStyle = osc;
    g.fillRect(x + 8, 60, 6, 230);
    g.fillStyle = claro;
    g.fillRect(x - 12, 58, 4, 232);
    g.fillRect(x - 2, 50, 3, 240);
    g.fillStyle = '#f7e9a8';
    for (let i = 0; i < 26; i++) g.fillRect(x - 18 + (i % 4) * 11, 60 + i * 9, 1.6, 1.6);
    if (r() < 0.5) { g.fillStyle = '#ff7aa8'; elipse(g, x, 42, 7, 5); g.fill(); }
  });
}

function pino(r, nevado) {
  return sprite(180, 360, g => {
    const x = 90;
    g.fillStyle = 'rgba(0,0,0,0.2)';
    elipse(g, x, 354, 60, 6); g.fill();
    g.fillStyle = '#6b4a30';
    g.fillRect(x - 8, 300, 16, 56);
    const verde = r() < 0.5 ? '#2f7a45' : '#2a6e4a', sombra = '#235c3a';
    for (let p = 0; p < 4; p++) {
      const yb = 318 - p * 70, ancho = 86 - p * 16, alto = 110 - p * 8;
      g.fillStyle = verde;
      g.beginPath(); g.moveTo(x - ancho, yb); g.lineTo(x, yb - alto); g.lineTo(x + ancho, yb); g.quadraticCurveTo(x, yb + 14, x - ancho, yb); g.closePath(); g.fill();
      g.fillStyle = sombra;
      g.beginPath(); g.moveTo(x, yb - alto); g.lineTo(x + ancho, yb); g.quadraticCurveTo(x + ancho * 0.5, yb + 8, x + 4, yb + 6); g.closePath(); g.fill();
      if (nevado) {
        g.fillStyle = '#f4f8ff';
        g.beginPath(); g.moveTo(x - ancho * 0.55, yb - alto * 0.48); g.lineTo(x, yb - alto); g.lineTo(x + ancho * 0.5, yb - alto * 0.5);
        g.quadraticCurveTo(x + ancho * 0.2, yb - alto * 0.4, x, yb - alto * 0.46); g.quadraticCurveTo(x - ancho * 0.25, yb - alto * 0.38, x - ancho * 0.55, yb - alto * 0.48); g.closePath(); g.fill();
        g.fillStyle = '#e6eefb';
        g.beginPath(); g.moveTo(x - ancho, yb); g.quadraticCurveTo(x - ancho * 0.5, yb - 10, x, yb + 4); g.quadraticCurveTo(x - ancho * 0.5, yb + 12, x - ancho, yb); g.closePath(); g.fill();
      }
    }
  });
}

function arbusto(r, flores) {
  return sprite(160, 100, g => {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    elipse(g, 80, 94, 70, 7); g.fill();
    const bolas = [[40, 70, 30], [80, 55, 40], [120, 68, 32], [60, 80, 24], [104, 82, 24]];
    for (const [x, y, rr] of bolas) { g.fillStyle = '#3f9a45'; elipse(g, x, y, rr, rr * 0.85); g.fill(); }
    for (const [x, y, rr] of bolas) { g.fillStyle = '#5bb85a'; elipse(g, x - rr * 0.25, y - rr * 0.3, rr * 0.55, rr * 0.45); g.fill(); }
    if (flores) {
      g.fillStyle = flores;
      for (let i = 0; i < 7; i++) { elipse(g, 30 + r() * 100, 40 + r() * 42, 3.4, 3.4); g.fill(); }
    }
  });
}

function matojo(r) {
  return sprite(150, 90, g => {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    elipse(g, 75, 86, 60, 5); g.fill();
    g.strokeStyle = '#8a7a42';
    g.lineWidth = 2.2;
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + r() * Math.PI, l = 30 + r() * 38;
      g.beginPath(); g.moveTo(75, 86); g.quadraticCurveTo(75 + Math.cos(a) * l * 0.5, 86 + Math.sin(a) * l * 0.9, 75 + Math.cos(a) * l, 86 + Math.sin(a) * l * 0.8); g.stroke();
    }
    g.strokeStyle = '#a89652';
    g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + r() * Math.PI, l = 20 + r() * 30;
      g.beginPath(); g.moveTo(75, 86); g.lineTo(75 + Math.cos(a) * l, 86 + Math.sin(a) * l * 0.8); g.stroke();
    }
  });
}

function monton() {
  return sprite(180, 80, g => {
    g.fillStyle = '#c9d8ec';
    elipse(g, 90, 72, 86, 22); g.fill();
    g.fillStyle = '#f4f8ff';
    elipse(g, 70, 60, 60, 24); g.fill();
    elipse(g, 120, 64, 46, 18); g.fill();
    g.fillStyle = '#ffffff';
    elipse(g, 62, 50, 34, 10); g.fill();
  });
}

function roca(tono) {
  return sprite(150, 90, g => {
    const [base, luz, osc, capa] = tono;
    g.fillStyle = 'rgba(0,0,0,0.2)';
    elipse(g, 75, 86, 70, 6); g.fill();
    g.fillStyle = base;
    g.beginPath(); g.moveTo(8, 86); g.lineTo(20, 40); g.lineTo(58, 14); g.lineTo(104, 22); g.lineTo(138, 56); g.lineTo(144, 86); g.closePath(); g.fill();
    g.fillStyle = luz;
    g.beginPath(); g.moveTo(20, 40); g.lineTo(58, 14); g.lineTo(104, 22); g.lineTo(80, 44); g.lineTo(40, 50); g.closePath(); g.fill();
    g.fillStyle = osc;
    g.beginPath(); g.moveTo(104, 22); g.lineTo(138, 56); g.lineTo(144, 86); g.lineTo(96, 86); g.lineTo(80, 44); g.closePath(); g.fill();
    if (capa) {
      g.fillStyle = capa;
      g.beginPath(); g.moveTo(18, 44); g.lineTo(58, 14); g.lineTo(104, 22); g.lineTo(118, 36); g.quadraticCurveTo(80, 30, 60, 34); g.quadraticCurveTo(36, 40, 18, 44); g.closePath(); g.fill();
    }
  });
}

// La roca del cañon: una columna de capas rojas.
function columna(r) {
  return sprite(130, 260, g => {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    elipse(g, 65, 256, 58, 6); g.fill();
    const capas = ['#c8683c', '#d98052', '#b85a34', '#e0925e', '#c46a40'];
    let y = 256;
    for (let i = 0; y > 40; i++) {
      const h = 26 + r() * 22, w = 34 + Math.sin(i * 1.7) * 10 + (i === 0 ? 14 : 0);
      g.fillStyle = capas[i % capas.length];
      caja(g, 65 - w, y - h, w * 2, h + 2, 8); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.fillRect(65 + w * 0.3, y - h, w * 0.7, h);
      y -= h - 2;
    }
    g.fillStyle = '#a24c2c';
    caja(g, 35, y - 18, 60, 22, 6); g.fill();
  });
}

function sombrilla(col) {
  return sprite(150, 170, g => {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    elipse(g, 75, 164, 64, 6); g.fill();
    g.fillStyle = '#f2e6c8';
    caja(g, 20, 150, 110, 12, 4); g.fill();
    g.fillStyle = col;
    g.fillRect(20, 153, 110, 3);
    g.strokeStyle = '#8e8e96';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(75, 162); g.lineTo(75, 44); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(8, 60); g.quadraticCurveTo(75, -10, 142, 60); g.closePath(); g.fill();
    g.save();
    g.beginPath(); g.moveTo(8, 60); g.quadraticCurveTo(75, -10, 142, 60); g.closePath(); g.clip();
    g.fillStyle = col;
    for (let i = 0; i < 6; i += 2) {
      const a0 = 8 + i * 22.3, a1 = a0 + 22.3;
      g.beginPath(); g.moveTo(75, 22); g.lineTo(a0, 62); g.lineTo(a1, 62); g.closePath(); g.fill();
    }
    g.restore();
  });
}

// El molino de agua del desierto.
function molino() {
  return sprite(160, 360, g => {
    g.strokeStyle = '#6e6259';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(40, 356); g.lineTo(76, 80); g.moveTo(120, 356); g.lineTo(84, 80); g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const y1 = 350 - i * 46, y2 = y1 - 46, t1 = (356 - y1) / 276, t2 = (356 - y2) / 276;
      g.beginPath();
      g.moveTo(40 + 36 * t1, y1); g.lineTo(120 - 36 * t2, y2);
      g.moveTo(120 - 36 * t1, y1); g.lineTo(40 + 36 * t2, y2);
      g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      g.save(); g.translate(80, 70); g.rotate((i / 12) * Math.PI * 2);
      g.fillStyle = i % 2 ? '#b8aca0' : '#d8ccc0';
      g.beginPath(); g.moveTo(8, -3); g.lineTo(52, -7); g.lineTo(52, 7); g.lineTo(8, 3); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = '#8a8078';
    elipse(g, 80, 70, 8, 8); g.fill();
    g.fillStyle = '#9e3a2e';
    g.beginPath(); g.moveTo(84, 70); g.lineTo(150, 58); g.lineTo(150, 84); g.closePath(); g.fill();
  });
}

function cabana() {
  return sprite(220, 170, g => {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    elipse(g, 110, 164, 104, 7); g.fill();
    g.fillStyle = '#8a5a36';
    g.fillRect(24, 80, 172, 84);
    g.strokeStyle = '#6a4226';
    g.lineWidth = 2;
    for (let y = 88; y < 164; y += 11) { g.beginPath(); g.moveTo(24, y); g.lineTo(196, y); g.stroke(); }
    g.fillStyle = '#5a3a24';
    g.beginPath(); g.moveTo(8, 86); g.lineTo(110, 22); g.lineTo(212, 86); g.closePath(); g.fill();
    g.fillStyle = '#7a4e30';
    g.beginPath(); g.moveTo(110, 22); g.lineTo(212, 86); g.lineTo(196, 86); g.lineTo(110, 34); g.closePath(); g.fill();
    g.fillStyle = '#ffd98a';
    g.fillRect(48, 104, 34, 30);
    g.fillStyle = '#6a4226';
    g.fillRect(63, 104, 4, 30); g.fillRect(48, 117, 34, 4);
    g.fillStyle = '#4a2e1c';
    g.fillRect(122, 108, 32, 56);
    g.fillStyle = '#7a7a82';
    g.fillRect(150, 30, 16, 36);
  });
}

function muneco() {
  return sprite(120, 170, g => {
    g.fillStyle = 'rgba(40,60,100,0.18)';
    elipse(g, 60, 164, 50, 6); g.fill();
    g.fillStyle = '#f7faff';
    elipse(g, 60, 132, 40, 34); g.fill();
    elipse(g, 60, 82, 30, 26); g.fill();
    elipse(g, 60, 42, 22, 20); g.fill();
    g.fillStyle = '#d6e2f2';
    elipse(g, 72, 138, 24, 24); g.fill();
    g.fillStyle = '#e8364f';
    caja(g, 38, 58, 44, 10, 4); g.fill();
    g.fillRect(64, 62, 10, 26);
    g.fillStyle = '#2a2a33';
    elipse(g, 53, 38, 3, 3); g.fill(); elipse(g, 67, 38, 3, 3); g.fill();
    for (const y of [78, 92, 106]) { elipse(g, 60, y, 3, 3); g.fill(); }
    g.fillStyle = '#ff8c2a';
    g.beginPath(); g.moveTo(60, 44); g.lineTo(80, 48); g.lineTo(60, 50); g.closePath(); g.fill();
    g.fillStyle = '#2a2a33';
    g.fillRect(40, 16, 40, 5); g.fillRect(46, 0, 28, 18);
    g.strokeStyle = '#6b4a30';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 84); g.lineTo(6, 66); g.moveTo(88, 84); g.lineTo(114, 64); g.stroke();
  });
}

// Chevrones negros sobre amarillo, del lado de fuera de la curva.
function cartel(dir) {
  return sprite(150, 120, g => {
    g.fillStyle = '#6d7480';
    g.fillRect(30, 50, 7, 70); g.fillRect(113, 50, 7, 70);
    g.fillStyle = '#1d1f26';
    caja(g, 4, 6, 142, 60, 6); g.fill();
    g.fillStyle = '#ffd23f';
    caja(g, 8, 10, 134, 52, 4); g.fill();
    g.fillStyle = '#1d1f26';
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 36;
      g.beginPath();
      if (dir > 0) { g.moveTo(x, 16); g.lineTo(x + 16, 16); g.lineTo(x + 32, 36); g.lineTo(x + 16, 56); g.lineTo(x, 56); g.lineTo(x + 16, 36); }
      else { g.moveTo(x + 32, 16); g.lineTo(x + 16, 16); g.lineTo(x, 36); g.lineTo(x + 16, 56); g.lineTo(x + 32, 56); g.lineTo(x + 16, 36); }
      g.closePath(); g.fill();
    }
  });
}

// El poste del arcen, con su catadioptrico (de noche brilla).
function poste(noche) {
  return sprite(24, 90, g => {
    g.fillStyle = noche ? '#8e93a3' : '#e9ecf2';
    caja(g, 8, 6, 8, 84, 3); g.fill();
    g.fillStyle = '#2a2c33';
    g.fillRect(8, 16, 8, 8);
    if (noche) {
      g.globalCompositeOperation = 'lighter';
      const h = g.createRadialGradient(12, 20, 0.5, 12, 20, 11);
      h.addColorStop(0, 'rgba(255,90,90,1)');
      h.addColorStop(1, 'rgba(255,90,90,0)');
      g.fillStyle = h;
      g.fillRect(0, 8, 24, 24);
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = noche ? '#ffd0d0' : '#e2374f';
    g.fillRect(9.5, 17.5, 5, 5);
  });
}

// Letras de la fuente del juego (5x7), pintadas a mano en un sprite.
export function letras(g, txt, cx, y, px, color) {
  const ancho = txt.length * 6 * px - px;
  let x = cx - ancho / 2;
  g.fillStyle = color;
  for (const ch of txt) {
    const f = FONT5x7[ch] || FONT5x7[ch.toUpperCase()];
    if (f) for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) if (f[row][col] === '1') g.fillRect(x + col * px, y + row * px, px + 0.15, px + 0.15);
    x += 6 * px;
  }
}

function valla() {
  return sprite(300, 190, g => {
    g.fillStyle = '#5f6672';
    g.fillRect(60, 110, 10, 80); g.fillRect(230, 110, 10, 80);
    g.fillStyle = '#ffffff';
    caja(g, 6, 6, 288, 112, 8); g.fill();
    g.strokeStyle = '#e8436a';
    g.lineWidth = 6;
    caja(g, 10, 10, 280, 104, 6); g.stroke();
    g.fillStyle = '#e8436a';
    corazon(g, 58, 60, 24); g.fill();
    letras(g, 'FURIA', 180, 42, 6, '#1c1d24');
  });
}

// Los arcos que cruzan la carretera: salida (rosa), control (azul) y meta (a cuadros).
function arco(txt, tipo) {
  const Wd = 720, Hd = 300, c = lienzo(Wd, Hd), g = c.getContext('2d');
  g.fillStyle = '#e8e8ee';
  g.fillRect(40, 60, 22, 240); g.fillRect(Wd - 62, 60, 22, 240);
  g.fillStyle = '#b3b7c2';
  g.fillRect(56, 60, 6, 240); g.fillRect(Wd - 46, 60, 6, 240);
  if (tipo === 2) {
    const q = 20;
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < (Wd - 60) / q; xx++) {
      g.fillStyle = (xx + yy) % 2 ? '#15161b' : '#ffffff';
      g.fillRect(30 + xx * q, 18 + yy * q, q, q);
    }
    g.fillStyle = '#ffffff';
    caja(g, Wd / 2 - 110, 22, 220, 52, 8); g.fill();
    letras(g, txt, Wd / 2, 27, 6, '#15161b');
  } else {
    g.fillStyle = tipo === 1 ? '#2b9fd8' : '#e8436a';
    caja(g, 30, 16, Wd - 60, 64, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(30, 20, Wd - 60, 6);
    letras(g, txt, Wd / 2, 27, 6, '#ffffff');
  }
  return c;
}

// Coches vistos desde atras (0 coche, 1 furgoneta, 2 camion). De noche, con
// los pilotos encendidos y la chapa a oscuras.
export const COLORES = ['#3d7bd9', '#f2c14e', '#3fae72', '#eeeeee', '#8f5ad6', '#f07c2a', '#34374a', '#d8474b', '#62c5d8'];
function coche(col, tipo, noche) {
  const alto = tipo === 2 ? 150 : tipo === 1 ? 112 : 86;
  const c = lienzo(256, (alto + 10) * 2), g = c.getContext('2d');
  g.scale(2, 2);
  g.lineJoin = 'round';
  const b = alto;
  const osc = mezcla(col, '#000000', 0.3), cla = mezcla(col, '#ffffff', 0.18);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  elipse(g, 64, b + 2, 64, 7); g.fill();
  g.fillStyle = '#141418';
  caja(g, 9, b - 20, 22, 21, 4); g.fill();
  caja(g, 97, b - 20, 22, 21, 4); g.fill();
  let luz = b - 42;
  if (tipo === 2) {
    g.fillStyle = '#ebe8e1';
    caja(g, 2, 0, 124, b - 26, 5); g.fill();
    g.strokeStyle = '#cfcabe';
    g.lineWidth = 2;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(2 + i * 20.7, 5); g.lineTo(2 + i * 20.7, b - 31); g.stroke(); }
    g.strokeStyle = '#8e897d';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(64, 4); g.lineTo(64, b - 30); g.stroke();
    g.fillStyle = col;
    g.fillRect(2, b - 52, 124, 11);
    g.fillStyle = '#2a2b31';
    caja(g, 4, b - 29, 120, 13, 3); g.fill();
    luz = b - 27;
    g.fillStyle = '#e01f38';
    caja(g, 8, luz, 18, 7, 2); g.fill();
    caja(g, 102, luz, 18, 7, 2); g.fill();
  } else {
    const furgo = tipo === 1;
    g.fillStyle = col;
    caja(g, 3, furgo ? 6 : 36, 122, b - (furgo ? 12 : 42), 10); g.fill();
    if (!furgo) {
      g.fillStyle = cla;
      g.beginPath(); g.moveTo(14, 40); g.lineTo(26, 8); g.quadraticCurveTo(64, 2, 102, 8); g.lineTo(114, 40); g.closePath(); g.fill();
      const lg = g.createLinearGradient(0, 12, 0, 38);
      lg.addColorStop(0, '#34445c');
      lg.addColorStop(1, '#161f2c');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(22, 37); g.lineTo(31, 13); g.quadraticCurveTo(64, 8, 97, 13); g.lineTo(106, 37); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath(); g.moveTo(34, 35); g.lineTo(41, 15); g.lineTo(51, 14); g.lineTo(44, 35); g.closePath(); g.fill();
    } else {
      g.fillStyle = '#1b2433';
      caja(g, 12, 14, 49, 30, 4); g.fill();
      caja(g, 67, 14, 49, 30, 4); g.fill();
      g.strokeStyle = osc;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(64, 8); g.lineTo(64, b - 18); g.stroke();
    }
    g.fillStyle = '#e01f38';
    caja(g, 7, luz, 24, 11, 4); g.fill();
    caja(g, 97, luz, 24, 11, 4); g.fill();
    g.fillStyle = '#ff8190';
    caja(g, 10, luz + 2, 12, 4, 2); g.fill();
    caja(g, 106, luz + 2, 12, 4, 2); g.fill();
    g.fillStyle = '#26272d';
    caja(g, 5, b - 22, 118, 9, 4); g.fill();
    g.fillStyle = '#f1efe6';
    caja(g, 49, b - 36, 30, 11, 2); g.fill();
    g.fillStyle = '#555';
    g.fillRect(53, b - 32, 22, 2.5);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(8, furgo ? 9 : 39, 112, 3);
    g.fillStyle = osc;
    g.fillRect(3, b - 26, 122, 3);
  }
  if (noche) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(10,14,40,0.45)';
    g.fillRect(0, 0, 128, luz - 2);
    g.globalCompositeOperation = 'lighter';
    for (const lx of [19, 109]) {
      const h = g.createRadialGradient(lx, luz + 5, 1, lx, luz + 5, 22);
      h.addColorStop(0, 'rgba(255,60,80,0.95)');
      h.addColorStop(1, 'rgba(255,60,80,0)');
      g.fillStyle = h;
      g.fillRect(lx - 22, luz - 17, 44, 44);
    }
    g.globalCompositeOperation = 'source-over';
  }
  // Donde van los intermitentes, en fraccion del dibujo.
  c.luzY = (luz + 5) / (alto + 10);
  return c;
}

function corazonSprite(noche) {
  return sprite(96, 96, g => {
    g.globalCompositeOperation = 'lighter';
    const h = g.createRadialGradient(48, 48, 4, 48, 48, 46);
    h.addColorStop(0, noche ? 'rgba(255,90,160,0.85)' : 'rgba(255,120,170,0.5)');
    h.addColorStop(1, 'rgba(255,90,160,0)');
    g.fillStyle = h;
    g.fillRect(0, 0, 96, 96);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ff3d86';
    corazon(g, 48, 50, 23); g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    corazon(g, 48, 50, 23); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    elipse(g, 38, 40, 6, 4, -0.6); g.fill();
  });
}

// El haz del faro sobre la carretera, de noche: un trapecio de luz.
function faro() {
  const c = lienzo(600, 300), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 300, 0, 0);
  gr.addColorStop(0, 'rgba(255,240,200,0.55)');
  gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(230, 300); g.lineTo(370, 300); g.lineTo(600, 0); g.lineTo(0, 0); g.closePath(); g.fill();
  return c;
}

// ---------- Todo lo de un paisaje con su cielo ----------
// Se hornea al empezar el nivel y se guarda solo el de ahora: hornear cuesta
// 7-10 ms y guardar cada uno ~19 MB (medido).
const cache = new Map();
export function sprites(D) {
  const clave = D.bioma + '/' + D.cielo;
  if (cache.has(clave)) return cache.get(clave);
  const r = azar(clave.length * 131 + D.bioma.charCodeAt(0));
  const noche = D.cielo === 'noche';
  const T = c => tintaSprite(c, D.cielo);
  const S = { arbol: [], arbusto: [], roca: [], especial: [] };
  if (D.bioma === 'costa') {
    for (let i = 0; i < 3; i++) S.arbol.push({ img: T(palmera(r)), w: 1250 });
    S.arbusto.push({ img: T(arbusto(r, '#ff8fb1')), w: 900 }, { img: T(arbusto(r, '#ffffff')), w: 820 }, { img: T(arbusto(r, '#ffd23f')), w: 860 });
    S.roca.push({ img: T(roca(['#9a8f86', '#bdb3a8', '#7d736b'])), w: 800 });
    for (const col of ['#e8364f', '#2b9fd8', '#ffb321']) S.especial.push({ img: T(sombrilla(col)), w: 760 });
  } else if (D.bioma === 'canon') {
    for (let i = 0; i < 3; i++) S.arbol.push({ img: T(cactus(r)), w: 560 });
    for (let i = 0; i < 2; i++) S.arbusto.push({ img: T(matojo(r)), w: 760 });
    S.roca.push({ img: T(columna(r)), w: 700 }, { img: T(roca(['#b86a42', '#d98a5c', '#8e4a2c'])), w: 900 });
    S.especial.push({ img: T(molino()), w: 700 });
  } else {
    const nieve = D.bioma === 'nieve';
    for (let i = 0; i < 3; i++) S.arbol.push({ img: T(pino(r, nieve)), w: 1000 });
    if (nieve) {
      S.arbusto.push({ img: T(monton()), w: 1000 });
      S.roca.push({ img: T(roca(['#8f959e', '#aeb4bd', '#737983', '#f4f8ff'])), w: 820 });
      S.especial.push({ img: T(muneco()), w: 520 });
    } else {
      S.arbusto.push({ img: T(arbusto(r, null)), w: 880 }, { img: T(arbusto(r, '#fff3a0')), w: 800 });
      S.roca.push({ img: T(roca(['#8c918a', '#a9ada5', '#6f756d', '#5d9a4a'])), w: 820 });
      S.especial.push({ img: T(cabana()), w: 1700 });
    }
  }
  S.curva = [T(cartel(-1)), T(cartel(1))];
  S.poste = poste(noche);
  S.valla = T(valla());
  // El arco de salida lleva el nombre del nivel.
  S.arcos = [T(arco(D.nombre, 0)), T(arco('CONTROL', 1)), T(arco('META', 2))];
  // Coches: los nueve colores; furgonetas y camiones, uno de cada tres.
  S.coches = [0, 1, 2].map(tipo => COLORES.map((col, i) => (tipo === 0 || i % 3 === 0 ? T(coche(col, tipo, noche)) : null)));
  S.corazon = corazonSprite(noche);
  S.faro = noche ? faro() : null;
  S.fondo = { cielo: hazCielo(D), nubes: hazNubes(D), lejos: hazLejos(D), cerca: hazCerca(D) };
  S.col = colores(D);
  S.noche = noche;
  cache.set(clave, S);
  if (cache.size > 1) cache.delete(cache.keys().next().value);
  return S;
}

export function cocheImg(S, k) {
  const fila = S.coches[k.tipo];
  return fila[k.color] || fila[k.color - (k.color % 3)];
}
