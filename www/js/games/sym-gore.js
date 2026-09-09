// SYMBIOTE - sangre, desmembramiento y sensacion de matar.
//
// La idea central: la CANTIDAD de sangre es ilimitada pero su COSTE es fijo.
// Las manchas se estampan una sola vez en una capa persistente en espacio de
// mundo a media resolucion, y despues son gratis para siempre. 500 manchas
// cuestan lo mismo que 5: un unico drawImage por frame.

import { Pool } from '../core.js';

// Paleta de sangre. Tres tonos por forma en vez de globalAlpha: cambiar el
// estado del contexto por estampa cuesta mas que el propio blit.
export const BLOOD_FRESH = '#e01228';
export const BLOOD_MID   = '#b81322';
export const BLOOD_DEEP  = '#8e0f1c';
const BLOOD_SHADOW = '#33060e';
const BLOOD_RIM    = '#ff5566';

// Limites verificados contra el presupuesto de frame.
const STAMPS_PER_FRAME = 40;   // una cadena de muertes puede pedir 80 y trabar el driver
const SPRAY_CAP = 48;
const DEBRIS_CAP = 40;
const DRIP_CAP = 12;

let splats = null;             // [kind][shape][tint] -> canvas horneado

// Hornea las manchas al arrancar. Cada forma lleva un borde claro arriba-izq y
// una sombra abajo-der, para que la silueta contraste TANTO contra un suelo
// clinico claro como dentro de una tuberia oscura. Un solo rojo no puede.
export function bakeGore(rnd) {
  if (splats) return;
  splats = [];
  const KINDS = [
    { w: 6,  h: 6,  n: 6 },    // 0 gota
    { w: 14, h: 14, n: 6 },    // 1 estrella de impacto
    { w: 22, h: 18, n: 6 },    // 2 charco
    { w: 10, h: 18, n: 6 },    // 3 chorreon de pared
  ];
  const TINTS = [BLOOD_FRESH, BLOOD_MID, BLOOD_DEEP];

  for (let k = 0; k < KINDS.length; k++) {
    const spec = KINDS[k];
    splats[k] = [];
    for (let s = 0; s < spec.n; s++) {
      splats[k][s] = [];
      // Mascara irregular, estable por semilla de forma.
      const mask = [];
      for (let y = 0; y < spec.h; y++) {
        const row = [];
        for (let x = 0; x < spec.w; x++) {
          const cx = (x - spec.w / 2) / (spec.w / 2);
          const cy = (y - spec.h / 2) / (spec.h / 2);
          const d = cx * cx + cy * cy;
          const wob = 0.55 + rnd() * 0.5;
          row.push(d < wob ? 1 : 0);
        }
        mask.push(row);
      }
      for (let t = 0; t < TINTS.length; t++) {
        const cv = document.createElement('canvas');
        cv.width = spec.w; cv.height = spec.h;
        const c = cv.getContext('2d');
        for (let y = 0; y < spec.h; y++) {
          for (let x = 0; x < spec.w; x++) {
            if (!mask[y][x]) continue;
            const up = y === 0 || !mask[y - 1][x];
            const lf = x === 0 || !mask[y][x - 1];
            const dn = y === spec.h - 1 || !mask[y + 1][x];
            const rt = x === spec.w - 1 || !mask[y][x + 1];
            c.fillStyle = (up || lf) ? BLOOD_RIM : (dn || rt) ? BLOOD_SHADOW : TINTS[t];
            c.fillRect(x, y, 1, 1);
          }
        }
        splats[k][s][t] = cv;
      }
    }
  }
}

// Capa de sangre: canvas en espacio de MUNDO a media resolucion.
// Nunca se limpia durante la partida. Nunca hacer getImageData sobre ella:
// una lectura en un canvas con respaldo de GPU cuesta 5-15ms y revienta el frame.
export function makeGoreLayer(pxW, pxH) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(pxW / 2);
  cv.height = Math.ceil(pxH / 2);
  const c = cv.getContext('2d', { alpha: true });
  c.imageSmoothingEnabled = false;
  return {
    cv, c,
    // Cuenta de charcos por tile para fusionarlos (sin esto, diez muertes son
    // diez circulos identicos en vez de una escena del crimen).
    poolGrid: null,
    stamps: 0,
  };
}

export function resetStamps(G) { G.stamps = 0; }

// Estampa una mancha en la capa. kind 0..3, dir en radianes para las direccionales.
export function stamp(G, kind, x, y, rnd, dark) {
  if (!splats || G.stamps >= STAMPS_PER_FRAME) return;
  G.stamps++;
  const shapes = splats[kind];
  const s = shapes[(rnd() * shapes.length) | 0];
  const tint = dark ? 0 : (1 + ((rnd() * 2) | 0));   // sobre fondo oscuro, el tono vivo
  const img = s[tint];
  // Media resolucion: coordenadas de mundo / 2, redondeadas a entero.
  G.c.drawImage(img, Math.round(x / 2 - img.width / 2), Math.round(y / 2 - img.height / 2));
}

// Charco que crece: al tercer impacto en el mismo tile se estampa uno grande
// y se marca la celda para que no siga creciendo.
export function stampPool(G, x, y, tx, ty, mw, rnd) {
  if (!G.poolGrid) return stamp(G, 2, x, y, rnd, false);
  const i = ty * mw + tx;
  const v = G.poolGrid[i];
  if (v === -1) return;
  G.poolGrid[i] = v + 1;
  if (v + 1 >= 3) {
    G.poolGrid[i] = -1;
    if (splats && G.stamps < STAMPS_PER_FRAME) {
      G.stamps++;
      G.c.fillStyle = BLOOD_DEEP;
      G.c.fillRect(Math.round(x / 2 - 17), Math.round(y / 2 - 13), 34, 26);
      G.c.fillStyle = BLOOD_MID;
      G.c.fillRect(Math.round(x / 2 - 15), Math.round(y / 2 - 11), 30, 22);
    }
  } else {
    stamp(G, 2, x, y, rnd, false);
  }
}

// Un unico drawImage por frame, con coordenadas de origen enteras para que no
// haya remuestreo ni arrastre al hacer scroll.
export function drawGore(g, G, camX, camY, vw, vh) {
  const sx = Math.max(0, (camX / 2) | 0);
  const sy = Math.max(0, (camY / 2) | 0);
  const sw = Math.min(G.cv.width - sx, Math.ceil(vw / 2) + 1);
  const sh = Math.min(G.cv.height - sy, Math.ceil(vh / 2) + 1);
  if (sw <= 0 || sh <= 0) return;
  g.drawImage(G.cv, sx, sy, sw, sh, sx * 2 - camX, sy * 2 - camY, sw * 2, sh * 2);
}

// ---------- Spray arterial ----------
// No se usa burst(): emite en circulo completo y eso lee como explosion, no
// como herida. Esto es un cono en la direccion del golpe, en tres pulsos.
const mkSpray = () => ({ x:0, y:0, vx:0, vy:0, life:0, size:1, _i:0 });
const rstSpray = o => { o.life = 0; o.vx = 0; o.vy = 0; };

export function makeSprayPool() { return new Pool(SPRAY_CAP, mkSpray, rstSpray); }

// Emite un pulso. Si el pool esta lleno recicla el mas viejo: si no, el spray
// desaparece justo en las muertes grandes, que son las que mas lo necesitan.
export function sprayPulse(P, x, y, dirX, dirY, n, rnd) {
  for (let i = 0; i < n; i++) {
    let p = P.spawn();
    if (!p) {
      let oldest = 0, lo = 1e9;
      for (let k = 0; k < P.n; k++) if (P.items[k].life < lo) { lo = P.items[k].life; oldest = k; }
      p = P.items[oldest];
    }
    const a = Math.atan2(dirY, dirX) + (rnd() - 0.5) * 1.04;   // cono de 60 grados
    const sp = 480 + rnd() * 360;
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = 0.35 + rnd() * 0.35;
    p.size = i < n / 2 ? 2 : 1;
  }
}

// Avanza el spray. Al chocar contra solido deja mancha y a veces un chorreon.
export function updateSpray(P, dt, G, solidAt, rnd, onWall) {
  for (let i = P.n - 1; i >= 0; i--) {
    const p = P.items[i];
    p.life -= dt;
    if (p.life <= 0) { P.free(p); continue; }
    p.vy += 700 * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (solidAt(nx, ny)) {
      stamp(G, 1, p.x, p.y, rnd, false);
      if (onWall) onWall(p.x, p.y);
      P.free(p);
      continue;
    }
    p.x = nx; p.y = ny;
  }
}

export function drawSpray(g, P, camX, camY) {
  g.fillStyle = BLOOD_FRESH;
  for (let i = 0; i < P.n; i++) {
    const p = P.items[i];
    g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
  }
}

// ---------- Restos ----------
const mkDeb = () => ({ x:0, y:0, vx:0, vy:0, rot:0, vr:0, life:0, kind:0, rest:0, _i:0 });
const rstDeb = o => { o.life = 0; o.vx = 0; o.vy = 0; o.rest = 0; o.rot = 0; };

export function makeDebrisPool() { return new Pool(DEBRIS_CAP, mkDeb, rstDeb); }

// Lanza pedazos de cuerpo. n depende del tipo de muerte: cuanto mas violenta,
// mas pedazos. Eso evita que el gore se vuelva papel tapiz.
export function spawnDebris(D, x, y, n, dirX, dirY, rnd) {
  for (let i = 0; i < n; i++) {
    const d = D.spawn();
    if (!d) return;
    const a = Math.atan2(dirY, dirX) + (rnd() - 0.5) * 2.2;
    const sp = 120 + rnd() * 260;
    d.x = x; d.y = y;
    d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp - 80;
    d.rot = rnd() * 6.28; d.vr = (rnd() - 0.5) * 14;
    d.life = 6 + rnd() * 4;
    d.kind = i % 6;
    d.rest = 0;
  }
}

// Los restos dejan rastro de sangre mientras vuelan y se quedan quietos al caer.
export function updateDebris(D, dt, G, solidAt, rnd) {
  for (let i = D.n - 1; i >= 0; i--) {
    const d = D.items[i];
    d.life -= dt;
    if (d.life <= 0) { D.free(d); continue; }
    if (d.rest > 0) { d.rest -= dt; continue; }
    d.vy += 900 * dt;
    d.rot += d.vr * dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (solidAt(nx, d.y)) { d.vx *= -0.35; }
    else d.x = nx;
    if (solidAt(d.x, ny)) {
      if (Math.abs(d.vy) > 60) {
        stampPool(G, d.x, d.y, 0, 0, 0, rnd);
        d.vy *= -0.3;
      } else { d.vy = 0; d.rest = 1e9; stamp(G, 2, d.x, d.y, rnd, false); }
      d.vx *= 0.6;
    } else {
      d.y = ny;
      if (rnd() < 0.25) stamp(G, 0, d.x, d.y, rnd, false);
    }
  }
}

export function drawDebris(g, D, camX, camY, cols) {
  for (let i = 0; i < D.n; i++) {
    const d = D.items[i];
    const w = 3 + (d.kind % 3) * 2;
    g.fillStyle = BLOOD_DEEP;
    g.fillRect(Math.round(d.x - camX - w / 2) - 1, Math.round(d.y - camY - w / 2) - 1, w + 2, w + 2);
    g.fillStyle = cols[d.kind % cols.length];
    g.fillRect(Math.round(d.x - camX - w / 2), Math.round(d.y - camY - w / 2), w, w);
  }
}

// ---------- Chorreones de pared ----------
const mkDrip = () => ({ x:0, y:0, len:0, maxLen:0, spd:0, _i:0 });
const rstDrip = o => { o.len = 0; o.maxLen = 0; };

export function makeDripPool() { return new Pool(DRIP_CAP, mkDrip, rstDrip); }

export function spawnDrip(P, x, y, rnd) {
  const d = P.spawn();
  if (!d) return;
  d.x = x; d.y = y; d.len = 0;
  d.maxLen = 6 + rnd() * 16;
  d.spd = 12 + rnd() * 16;
}

// El chorreon se PINTA en la capa permanente mientras baja: efecto animado que
// deja un resultado permanente, a 24px de relleno por frame para los doce.
export function updateDrips(P, dt, G) {
  for (let i = P.n - 1; i >= 0; i--) {
    const d = P.items[i];
    const adv = d.spd * dt;
    d.len += adv;
    G.c.fillStyle = BLOOD_DEEP;
    G.c.fillRect(Math.round(d.x / 2), Math.round((d.y + d.len) / 2), 1, 1);
    if (d.len >= d.maxLen) {
      G.c.fillStyle = BLOOD_MID;
      G.c.fillRect(Math.round(d.x / 2) - 1, Math.round((d.y + d.len) / 2), 2, 2);
      P.free(d);
    }
  }
}
