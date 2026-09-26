// carretera-arte.js - FURIA: como se ve la carretera. Solo pinta: las reglas
// viven en carretera-mundo.js y los dibujos en carretera-sprites.js.
//
// Es el pseudo 3D de Out Run: cada borde de tramo se proyecta a pantalla y
// los tramos se pintan de lejos a cerca, con lo que hay encima (arboles,
// coches, corazones) metido entre medias. Asi una loma tapa lo que hay detras
// sin calcular nada mas. El mundo se pinta en un lienzo propio a la calidad
// que aguante el telefono (Pintor.q, ver furia.js) y el marcador va encima.

import * as M from './carretera-mundo.js';
import { W, H, NN, lienzo, caja, elipse, corazon, sprites, cocheImg } from './carretera-sprites.js';

const XS = (H / 2) * (16 / 9);          // escala de lado: la proporcion del boceto
const YS = H / 2;
const DIST = 170;                       // tramos que se pintan
export const SUELO = H / 2 + (M.CAM_D / M.JZ) * M.CAM_H * YS;   // donde pisa la moto
const lerp = (a, b, t) => a + (b - a) * t;

// Lo que pinta cada papel del decorado, y su ancho en el mundo.
const PAPEL = {
  poste: S => ({ img: S.poste, w: 70 }),
  curva: (S, v) => ({ img: S.curva[v > 0 ? 1 : 0], w: 700 }),
  valla: S => ({ img: S.valla, w: 1700 }),
  arco: (S, v) => ({ img: S.arcos[v], w: 3700 }),
};

export class Pintor {
  constructor() {
    this.q = 2;
    this.c = null;
    this.g = null;
    const n = DIST + 2;
    this.bx = new Float32Array(n);
    this.by = new Float32Array(n);
    this.bw = new Float32Array(n);
    this.bs = new Float32Array(n);
    this.bz = new Float32Array(n);
    this.vis = new Uint8Array(n);
    this.cub = [];
    for (let i = 0; i < n; i++) this.cub.push([]);
    this.parts = [];
    this.clima = [];
  }

  nivel(L) {
    this.L = L;
    this.S = sprites(L.D);
    // Turbos y charcos, tramo a tramo: cada tramo pinta su rodaja justo
    // despues de su asfalto, antes de lo que tenga encima.
    this.decal = new Array(L.nSeg).fill(null);
    for (const t of L.turbos) for (let i = t.i0; i <= t.i1; i++) this.decal[i] = { tipo: 'turbo', carril: t.carril, j: i - t.i0, n: t.i1 - t.i0 + 1 };
    for (const c of L.charcos) for (let i = c.i0; i <= c.i1; i++) this.decal[i] = { tipo: 'charco', carril: c.carril, j: i - c.i0, n: c.i1 - c.i0 + 1 };
    this.parts.length = 0;
    this.clima.length = 0;
    const D = L.D;
    if (D.bioma === 'nieve') for (let i = 0; i < 80; i++) this.clima.push({ k: 'copo', x: Math.random() * W, y: Math.random() * H, r: 1.2 + Math.random() * 2.4, v: 40 + Math.random() * 70, f: Math.random() * 6 });
    if (D.bioma === 'bosque' && D.cielo === 'noche') for (let i = 0; i < 26; i++) this.clima.push({ k: 'luz', x: Math.random() * W, y: H * (0.45 + Math.random() * 0.3), r: 2 + Math.random() * 2, v: 0, f: Math.random() * 6 });
  }

  // ---------- Efectos (en pantalla) ----------
  efecto(tipo, x, y, n) {
    const P = this.parts;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random();
      if (tipo === 'chispa') P.push({ k: 'linea', x, y, vx: Math.cos(a) * 300 * s + (Math.random() - 0.5) * 200, vy: -Math.abs(Math.sin(a)) * 320 * s - 60, g: 900, t: 0, v: 0.35 + s * 0.4, c: '#ffd36b', r: 2 });
      else if (tipo === 'polvo') P.push({ k: 'bola', x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 120, vy: -30 - s * 60, g: 60, t: 0, v: 0.5 + s * 0.4, c: this.S.col.suelo, r: 5 + s * 8 });
      else if (tipo === 'gota') P.push({ k: 'bola', x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 260, vy: -120 - s * 220, g: 900, t: 0, v: 0.5 + s * 0.3, c: this.S.col.charco, r: 2.5 + s * 3 });
      else if (tipo === 'brillo') P.push({ k: 'bola', x, y, vx: Math.cos(a) * 200 * s, vy: Math.sin(a) * 200 * s, g: 0, t: 0, v: 0.45, c: '#ffd1e6', r: 3 });
      else if (tipo === 'confeti') P.push({ k: 'papel', x: Math.random() * W, y: -10 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 90 + s * 140, g: 30, t: 0, v: 3.5, c: ['#ff5c7a', '#ffd23f', '#62c5d8', '#8f5ad6', '#ffffff', '#3fae72'][i % 6], r: 5, f: Math.random() * 6 });
    }
  }

  // ---------- Un frame ----------
  // V: pos, x (interpolados), inc, fase, t, dt, px, fondoY, celebra,
  // parpadeo, turbo (0-1), sacude, choque, resbala.
  //
  // pinta() lo hace en su propio lienzo, a la calidad q, y lo devuelve para
  // estirarlo; dibujaEn() pinta directo en otro contexto a la escala dada (a
  // calidad completa, furia.js pinta asi en la pantalla y se ahorra copiar
  // una pantalla entera de pixeles cada frame).
  pinta(V) {
    const q = this.q, cw = Math.round(W * q), ch = Math.round(H * q);
    if (!this.c || this.c.width !== cw || this.c.height !== ch) {
      this.c = lienzo(cw, ch);
      this.g = this.c.getContext('2d');
    }
    this.dibujaEn(this.g, q, V);
    return this.c;
  }

  dibujaEn(g, q, V) {
    const L = this.L, S = this.S;
    g.save();
    g.setTransform(q, 0, 0, q, 0, 0);
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const sx = V.sacude ? (Math.random() - 0.5) * V.sacude : 0, sy = V.sacude ? (Math.random() - 0.5) * V.sacude : 0;
    g.fillStyle = S.col.suelo;
    g.fillRect(0, 0, W, H);
    g.translate(sx, sy);

    // --- Fondo: cielo y paisaje, que se desliza con las curvas ---
    const F = S.fondo, hy = H / 2 + V.fondoY;
    g.drawImage(F.cielo, -8, -8, W + 16, H + 16);
    mosaico(g, F.nubes, V.px * 0.2, hy - 262, 2400, 190);
    mosaico(g, F.lejos, V.px * 0.45, hy - 160, 2400, 170);
    mosaico(g, F.cerca, V.px, hy - 94, 2400, 110);
    g.fillStyle = S.col.niebla;
    g.fillRect(-10, hy + 15, W + 20, H - hy);

    // --- Proyectar los bordes de los tramos ---
    const pos = Math.max(0, V.pos), jx = V.x;
    const base = Math.min(L.nSeg - 1, Math.floor(pos / M.SEG));
    const pct = pos / M.SEG - base;
    const zj = pos + M.JZ, ij = M.tramoDe(L, zj);
    const jy = lerp(L.y[ij], L.y[ij + 1], Math.min(1, zj / M.SEG - ij));
    const camY = jy + M.CAM_H;
    const nMax = Math.min(DIST, L.nSeg - base);
    let x = 0, dx = -(L.curva[base] * pct);
    for (let k = 0; k <= nMax; k++) {
      const i = base + k;
      const cz = i * M.SEG - pos;
      const sc = M.CAM_D / Math.max(1, cz);
      this.bz[k] = cz;
      this.bs[k] = sc;
      this.bx[k] = W / 2 - sc * (jx * M.ANCHO - x) * XS;
      this.by[k] = H / 2 - sc * (L.y[i] - camY) * YS;
      this.bw[k] = sc * M.ANCHO * XS;
      if (k < nMax) { x += dx; dx += L.curva[i]; }
    }
    let maxy = H;
    for (let k = 0; k < nMax; k++) {
      const v = !(this.bz[k] <= M.CAM_D || this.by[k + 1] >= this.by[k] || this.by[k + 1] >= maxy);
      this.vis[k] = v ? 1 : 0;
      if (v) maxy = this.by[k + 1];
    }

    // --- Lo que se mueve, repartido por tramos ---
    for (let k = 0; k < nMax; k++) this.cub[k].length = 0;
    const z0 = base * M.SEG;
    for (const c of L.coches) {
      const n = Math.floor((c.z - z0) / M.SEG);
      if (n >= 0 && n < nMax) { c._dz = (c.z - z0) / M.SEG - n; this.cub[n].push(c); }
    }
    for (const h of L.corazones) {
      if (h.cogido) continue;
      const n = Math.floor((h.z - z0) / M.SEG);
      if (n >= 0 && n < nMax) { h._dz = (h.z - z0) / M.SEG - n; this.cub[n].push(h); }
    }

    // --- De lejos a cerca: asfalto, decorado y trafico ---
    for (let k = nMax - 1; k >= 0; k--) {
      const i = base + k, f = k / DIST;
      const fi = Math.min(NN, Math.round((1 - Math.exp(-f * f * 2.6)) * NN * 1.08));
      if (this.vis[k]) this.tramo(g, k, i, fi);
      if (this.bz[k] > M.CAM_D * 2 && k > 0) {
        const alfa = f > 0.8 ? (1 - f) / 0.2 : 1;
        const cosas = L.cosas[i];
        for (const o of cosas) {
          const fab = PAPEL[o.rol];
          const sp = fab ? fab(S, o.v) : S[o.rol][o.v % S[o.rol].length];
          this.dibuja(g, k, 0, sp.img, sp.w * o.s, o.x, 0, o.x < 0 ? 1 : o.x > 0 ? 0 : 0.5, alfa);
        }
        if (k > 3) {
          for (const o of this.cub[k]) {
            if (o.tipo !== undefined) this.coche(g, k, o, alfa, V.t);
            else this.dibuja(g, k, o._dz, S.corazon, 330, o.x, 150 + Math.sin(V.t * 5 + o.z * 0.01) * 22, 0.5, alfa);
          }
        }
      }
    }
    g.globalAlpha = 1;

    // --- El faro, de noche ---
    if (S.faro) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55;
      g.drawImage(S.faro, W / 2 - 620 + V.inc * 60, hy + 6, 1240, SUELO - hy - 6);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    // --- La moto ---
    const bote = V.choque ? 0 : Math.abs(V.x) > 1 ? Math.sin(V.t * 43) * 2.6 : V.resbala ? Math.sin(V.t * 30) * 1.4 : Math.sin(V.t * 31) * 0.5;
    motoDetras(g, W / 2, SUELO + bote, 1.45, V.inc, V.fase, { parpadeo: V.parpadeo, noche: S.noche, celebra: V.celebra });

    // --- Particulas, clima y velocidad ---
    this.particulas(g, V.dt);
    this.tiempo(g, V);
    if (V.turbo > 0) lineasVelocidad(g, V.turbo, V.t, hy);
    g.restore();
  }

  // Un tramo: cesped, bordillos, asfalto y rayas; y su rodaja de turbo o charco.
  tramo(g, k, i, fi) {
    const C = this.S.col, par = Math.floor(i / 3) % 2 === 0 ? 0 : 1;
    const x1 = this.bx[k], y1 = this.by[k], w1 = this.bw[k];
    const x2 = this.bx[k + 1], y2 = this.by[k + 1] - 0.7, w2 = this.bw[k + 1];
    g.fillStyle = C.cesped[par][fi];
    g.fillRect(-12, y2, W + 24, y1 - y2);
    const r1 = w1 / 6, r2 = w2 / 6;
    g.fillStyle = C.borde[par][fi];
    cuad(g, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2);
    cuad(g, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2);
    g.fillStyle = C.asfalto[par][fi];
    cuad(g, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
    if (par === 0) {
      const l1 = w1 / 32, l2 = w2 / 32;
      g.fillStyle = C.raya[0][fi];
      for (const u of [-1 / 3, 1 / 3]) {
        const a = x1 + u * w1, b = x2 + u * w2;
        cuad(g, a - l1, y1, a + l1, y1, b + l2, y2, b - l2, y2);
      }
    }
    const d = this.decal[i];
    if (!d) return;
    const u = M.CARRILES[d.carril];
    if (d.tipo === 'turbo') {
      // Una flecha por tramo, que corre hacia la moto: se lee TURBO.
      const a1 = x1 + (u - 0.26) * w1, b1 = x1 + (u + 0.26) * w1, c2 = x2 + u * w2, m1 = x1 + u * w1;
      g.fillStyle = 'rgba(20,120,160,0.55)';
      cuad(g, a1, y1, b1, y1, x2 + (u + 0.26) * w2, y2, x2 + (u - 0.26) * w2, y2);
      g.fillStyle = d.j % 2 ? '#5ff0ff' : '#b8fbff';
      g.beginPath(); g.moveTo(a1, y1); g.lineTo(c2, y2); g.lineTo(b1, y1); g.lineTo(m1, y1 - (y1 - y2) * 0.45); g.closePath(); g.fill();
    } else {
      // El charco: rodajas cuyo ancho sigue una elipse.
      const e1 = Math.sin((Math.PI * d.j) / d.n) * 0.27, e2 = Math.sin((Math.PI * (d.j + 1)) / d.n) * 0.27;
      g.fillStyle = C.charco;
      g.globalAlpha = 0.85;
      cuad(g, x1 + (u - e1) * w1, y1, x1 + (u + e1) * w1, y1, x2 + (u + e2) * w2, y2, x2 + (u - e2) * w2, y2);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      cuad(g, x1 + (u - e1 * 0.3) * w1, y1, x1 + (u - e1 * 0.05) * w1, y1, x2 + (u - e2 * 0.05) * w2, y2, x2 + (u - e2 * 0.3) * w2, y2);
      g.globalAlpha = 1;
    }
  }

  // Un sprite plantado en el tramo k (dz: cuanto dentro del tramo), a xw
  // medios anchos del centro y alto unidades del suelo.
  dibuja(g, k, dz, img, w, xw, alto, ancla, alfa) {
    const sc = lerp(this.bs[k], this.bs[k + 1], dz), K = sc * XS;
    const sx = lerp(this.bx[k], this.bx[k + 1], dz) + K * xw * M.ANCHO;
    const sy = lerp(this.by[k], this.by[k + 1], dz) - K * alto;
    const dw = w * K;
    if (dw < 0.6) return null;
    const dh = (dw * img.height) / img.width, x0 = sx - dw * ancla;
    if (x0 > W || x0 + dw < 0 || sy - dh > H) return null;
    g.globalAlpha = alfa;
    g.drawImage(img, x0, sy - dh, dw, dh);
    return { x0, y0: sy - dh, dw, dh };
  }

  coche(g, k, c, alfa, t) {
    const img = cocheImg(this.S, c);
    const r = this.dibuja(g, k, c._dz, img, M.COCHES[c.tipo].w, c.x, 0, 0.5, alfa);
    if (!r || c.intermitente <= 0 || Math.floor(t * 5) % 2) return;
    // El intermitente, del lado al que se va a cambiar.
    const lado = c.destino > c.carril ? 1 : -1;
    const lx = r.x0 + r.dw * (lado > 0 ? 0.9 : 0.1), ly = r.y0 + r.dh * img.luzY;
    g.globalAlpha = alfa;
    g.fillStyle = 'rgba(255,190,40,0.45)';
    elipse(g, lx, ly, r.dw * 0.11, r.dw * 0.11); g.fill();
    g.fillStyle = '#ffc12e';
    elipse(g, lx, ly, r.dw * 0.05, r.dw * 0.045); g.fill();
    g.globalAlpha = 1;
  }

  particulas(g, dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
      if (p.t > p.v) { P.splice(i, 1); continue; }
      const a = p.k === 'papel' ? 1 : 1 - p.t / p.v;
      g.globalAlpha = a;
      g.fillStyle = p.c;
      if (p.k === 'linea') {
        g.strokeStyle = p.c;
        g.lineWidth = p.r;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
      } else if (p.k === 'papel') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.t * 7 + p.f);
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        g.restore();
      } else { elipse(g, p.x, p.y, p.r, p.r); g.fill(); }
    }
    g.globalAlpha = 1;
  }

  // Nieve que cae (y se inclina con la velocidad) o luciernagas.
  tiempo(g, V) {
    if (!this.clima.length) return;
    const dt = V.dt, vel = V.vel || 0;
    for (const p of this.clima) {
      if (p.k === 'copo') {
        p.y += p.v * dt + vel * 60 * dt * (p.y / H);
        p.x += (Math.sin(V.t + p.f) * 20 - V.px * 0) * dt + (p.x - W / 2) * vel * 0.9 * dt;
        if (p.y > H || p.x < -10 || p.x > W + 10) { p.y = -5; p.x = W / 2 + (Math.random() - 0.5) * W * 1.1; }
        g.fillStyle = 'rgba(255,255,255,0.85)';
        elipse(g, p.x, p.y, p.r, p.r); g.fill();
      } else {
        p.f += dt;
        const x = p.x + Math.sin(p.f * 0.7) * 30, y = p.y + Math.sin(p.f * 1.3) * 14;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.5 + 0.5 * Math.sin(p.f * 3);
        g.fillStyle = '#d8ff7a';
        elipse(g, x, y, p.r, p.r); g.fill();
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
    }
  }
}

function cuad(g, x1, y1, x2, y2, x3, y3, x4, y4) {
  g.beginPath();
  g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4);
  g.closePath();
  g.fill();
}

function mosaico(g, img, off, y, w, h) {
  let x = -(((off % w) + w) % w);
  for (; x < W + 10; x += w) g.drawImage(img, x - 1, y, w + 2, h);
}

// Rayas que salen del horizonte con el turbo.
function lineasVelocidad(g, a, t, hy) {
  g.strokeStyle = 'rgba(255,255,255,' + (0.35 * a).toFixed(3) + ')';
  g.lineWidth = 2.5;
  g.beginPath();
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + 0.3;
    const f = ((t * 2.2 + i * 0.37) % 1);
    const r0 = 260 + f * 500, r1 = r0 + 90;
    const cx = W / 2, cy = hy;
    const ex = Math.cos(ang), ey = Math.sin(ang) * 0.55;
    if (Math.abs(ex) < 0.35 && ey < 0) continue;
    g.moveTo(cx + ex * r0, cy + ey * r0);
    g.lineTo(cx + ex * r1, cy + ey * r1);
  }
  g.stroke();
}

// ---------- La moto vista de espaldas: rueda, colin y la piloto ----------
// Origen en el punto donde la rueda toca el suelo; mide ~116 de alto. De
// espaldas los brazos van hacia delante y no se ven: solo asoman los codos.
// celebra (0-1): se endereza y levanta el puño derecho en la meta.
export function motoDetras(g, x, y, s, inc, t, o) {
  o = o || {};
  const cel = o.celebra || 0;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.34)';
  elipse(g, x + Math.sin(inc) * 8 * s, y + 1, 30 * s, 6 * s);
  g.fill();
  if (o.parpadeo) g.globalAlpha = 0.4;
  g.translate(x, y);
  g.rotate(inc);
  g.scale(s, s);
  const TRAJE = '#24262f', TRAJE2 = '#3a3e4d', ROSA = '#ff5c7a', ROSA2 = '#c23a5a', GRIS = '#3b3e49', NEGRO = '#15161b';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Costados de la moto, que asoman entre las piernas.
  g.fillStyle = GRIS;
  g.beginPath(); g.moveTo(-17, -38); g.lineTo(-21, -58); g.lineTo(-10, -62); g.lineTo(-9, -38); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(17, -38); g.lineTo(21, -58); g.lineTo(10, -62); g.lineTo(9, -38); g.closePath(); g.fill();
  // Piernas: muslo hacia la rodilla (algo abierta) y la bota en la estribera.
  for (const sx of [-1, 1]) {
    g.fillStyle = TRAJE;
    g.beginPath();
    g.moveTo(sx * 8, -66); g.quadraticCurveTo(sx * 27, -60, sx * 25, -46);
    g.lineTo(sx * 21, -27); g.lineTo(sx * 13, -28); g.quadraticCurveTo(sx * 14, -44, sx * 8, -50);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath(); g.moveTo(sx * 12, -64); g.quadraticCurveTo(sx * 25, -58, sx * 24, -48); g.lineTo(sx * 21, -50); g.quadraticCurveTo(sx * 21, -58, sx * 11, -61); g.closePath(); g.fill();
    g.fillStyle = NEGRO;
    caja(g, sx > 0 ? 12 : -22, -31, 10, 12, 3); g.fill();
    g.fillStyle = '#8f98a8';
    caja(g, sx > 0 ? 9 : -17, -21, 8, 2.6, 1.3); g.fill();
  }
  // Rueda trasera, con tacos que corren.
  g.fillStyle = '#131317';
  caja(g, -10, -37, 20, 37, 9); g.fill();
  g.strokeStyle = '#3d3e47';
  g.lineWidth = 1.6;
  const fase = (t * 70) % 7;
  for (let k = 0; k < 6; k++) {
    const yy = -35 + k * 7 + fase;
    if (yy > -34 && yy < -3) { g.beginPath(); g.moveTo(-6, yy); g.lineTo(6, yy); g.stroke(); }
  }
  // Escape, a la derecha.
  g.fillStyle = '#a7afbd';
  elipse(g, 17, -27, 6, 5.6); g.fill();
  g.fillStyle = '#2a2a30';
  elipse(g, 17, -27, 3.2, 3); g.fill();
  // Portamatriculas y matricula sobre la rueda.
  g.fillStyle = NEGRO;
  g.fillRect(-2, -46, 4, 6);
  g.fillStyle = '#f3f1ea';
  caja(g, -7.5, -43, 15, 7, 1.5); g.fill();
  g.fillStyle = '#4a4a55';
  g.fillRect(-5.5, -40.5, 11, 1.4);
  // Colin rosa, pequeño, con la luz.
  g.fillStyle = ROSA;
  g.beginPath(); g.moveTo(-12, -47); g.lineTo(12, -47); g.lineTo(9, -60); g.lineTo(-9, -60); g.closePath(); g.fill();
  g.fillStyle = ROSA2;
  g.fillRect(-12, -49, 24, 2.5);
  g.fillStyle = '#ff2442';
  caja(g, -8, -56, 16, 4, 2); g.fill();
  g.fillStyle = '#ffc2ca';
  g.fillRect(-5, -55, 10, 1.2);
  // Lo de arriba (la piloto) se inclina un poco mas que la moto hacia dentro
  // de la curva, y en la meta se endereza.
  g.save();
  g.translate(Math.sin(inc) * 7, -cel * 7);
  // Codos: asoman a los lados del cuerpo (los brazos van hacia delante).
  g.fillStyle = TRAJE;
  elipse(g, -21, -80, 6.5, 8, 0.35); g.fill();
  if (cel < 0.5) { elipse(g, 21, -80, 6.5, 8, -0.35); g.fill(); }
  // Espalda, redonda, con el corazon.
  const gr = g.createLinearGradient(0, -94, 0, -60);
  gr.addColorStop(0, TRAJE2);
  gr.addColorStop(1, TRAJE);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-13, -60);
  g.bezierCurveTo(-19, -66, -22, -80, -18, -88);
  g.quadraticCurveTo(0, -97, 18, -88);
  g.bezierCurveTo(22, -80, 19, -66, 13, -60);
  g.closePath(); g.fill();
  g.fillStyle = ROSA;
  corazon(g, 0, -76, 6.5); g.fill();
  // El puño en alto, en la meta.
  if (cel >= 0.5) {
    const a = Math.min(1, (cel - 0.5) * 3);
    g.strokeStyle = TRAJE;
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(17, -87); g.lineTo(26, -98 - 14 * a); g.lineTo(28, -112 - 18 * a); g.stroke();
    g.fillStyle = NEGRO;
    elipse(g, 28.5, -115 - 18 * a, 5.5, 5.5); g.fill();
  }
  // Coleta: sale por debajo del casco y se mueve con el viento.
  const v = Math.sin(t * 9) * 2.5 - inc * 16;
  g.fillStyle = '#0e0e12';
  g.beginPath();
  g.moveTo(-4, -93);
  g.bezierCurveTo(-5 + v * 0.3, -88, -4 + v * 0.7, -84, v, -79);
  g.bezierCurveTo(3.5 + v * 0.7, -84, 5 + v * 0.3, -88, 4, -93);
  g.closePath(); g.fill();
  g.fillStyle = ROSA;
  caja(g, -3.4, -91, 6.8, 2.6, 1); g.fill();
  // Casco blanco con franja rosa.
  g.fillStyle = '#f3f3f6';
  elipse(g, 0, -103, 13.5, 13.5); g.fill();
  g.save();
  elipse(g, 0, -103, 13.5, 13.5); g.clip();
  g.fillStyle = ROSA;
  g.fillRect(-3.6, -118, 7.2, 30);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  elipse(g, 0, -91, 16, 6); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, -103, 10.5, -2.6, -1.5); g.stroke();
  g.restore();
  if (o.noche) {
    g.globalCompositeOperation = 'lighter';
    const h = g.createRadialGradient(0, -54, 1, 0, -54, 17);
    h.addColorStop(0, 'rgba(255,60,90,0.5)');
    h.addColorStop(1, 'rgba(255,60,90,0)');
    g.fillStyle = h;
    g.fillRect(-17, -71, 34, 34);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}
