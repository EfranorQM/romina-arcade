// Sprites horneados desde arrays de strings + particulas + efectos retro.
import { Pool } from './core.js';

// Hornea un sprite (array de strings + mapa de colores) a un canvas offscreen.
// '.' o ' ' = transparente. Se llama UNA vez al arrancar, nunca por frame.
export function bake(rows, map, scale = 1) {
  const h = rows.length, w = rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = map[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  cv._w = w; cv._h = h;
  return cv;
}

// Variante toda blanca, para el destello al recibir golpe.
export function bakeFlash(rows, scale = 1) {
  const map = {};
  for (const row of rows) for (const ch of row) if (ch !== '.' && ch !== ' ') map[ch] = '#ffffff';
  return bake(rows, map, scale);
}

// Espejo horizontal (para personajes que miran a ambos lados).
export function bakeFlip(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(src.width, 0); c.scale(-1, 1);
  c.drawImage(src, 0, 0);
  cv._w = src._w; cv._h = src._h;
  return cv;
}

// Dibuja centrado en (x,y), redondeado a pixel entero.
export function spr(g, s, x, y) {
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
}

// ---------- Particulas ----------
const mkP = () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, col: '#fff', size: 1, grav: 0, _i: 0 });
export const particles = new Pool(260, mkP, null);

export function burst(x, y, n, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const spd = opts.speed || 60, cols = opts.colors || ['#ffffff'];
  const life = opts.life || 0.4, size = opts.size || 2, grav = opts.grav || 0;
  for (let i = 0; i < n; i++) {
    const p = particles.spawn();
    if (!p) return;
    const a = rnd() * Math.PI * 2, v = spd * (0.35 + rnd() * 0.65);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
    p.max = p.life = life * (0.6 + rnd() * 0.6);
    p.col = cols[(rnd() * cols.length) | 0];
    p.size = size; p.grav = grav;
  }
}

export function updateParticles(dt) {
  for (let i = particles.n - 1; i >= 0; i--) {
    const p = particles.items[i];
    p.life -= dt;
    if (p.life <= 0) { particles.free(p); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

export function drawParticles(g) {
  for (let i = 0; i < particles.n; i++) {
    const p = particles.items[i];
    const s = p.life / p.max > 0.4 ? p.size : Math.max(1, p.size - 1);
    g.fillStyle = p.col;
    g.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
}

// ---------- Fondos ----------
export function makeStars(rnd, w, h, layers) {
  const out = [];
  for (const L of layers) {
    const arr = [];
    for (let i = 0; i < L.n; i++) arr.push({ x: rnd() * w, y: rnd() * h });
    out.push({ stars: arr, speed: L.speed, col: L.col, size: L.size || 1 });
  }
  return out;
}

export function updateStars(field, dt, h) {
  for (const L of field) {
    for (const s of L.stars) {
      s.y += L.speed * dt;
      if (s.y > h) { s.y -= h; }
    }
  }
}

export function drawStars(g, field) {
  for (const L of field) {
    g.fillStyle = L.col;
    for (const s of L.stars) g.fillRect(Math.round(s.x), Math.round(s.y), L.size, L.size);
  }
}
