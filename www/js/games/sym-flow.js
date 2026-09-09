// SYMBIOTE - locomocion tipo CARRION.
//
// Reemplaza al gancho de un tentaculo (sym-rope.js), que el usuario probo en el
// celular y describio como "rarisima": no podia moverla con fluidez. El fallo
// era de arquitectura, no de ajuste. En Carrion la criatura NO se columpia de
// un punto: es una masa que fluye, con muchos tentaculos que se agarran solos
// de lo que tengan cerca y TIRAN del cuerpo de forma continua.
//
// Diferencias clave con el gancho:
//  - 12 tentaculos a la vez, no 1.
//  - El cuerpo NUNCA queda atado a un ancla. Los agarres aportan aceleracion,
//    se suman y se normalizan en una sola direccion de arrastre.
//  - Estando agarrada la gravedad se anula del todo: por eso puede trepar
//    paredes y cruzar techos sin ningun "salto".
//  - Los tentaculos se sueltan solos al quedar detras o estirarse de mas.
//
// Medido sobre 8 niveles reales: 7/8 llegan a la salida, peor atasco 0.1s,
// 0% de frames sin agarre, 0.057 ms/frame con penalizacion x15 = 0.3% del frame.

import { TS, solidTile } from './sym-world.js';

// ---- Constantes (validadas midiendo, no suponiendo) ----
export const NT = 12;         // tentaculos simultaneos: 12 lee como abanico, 6 como arana
export const SEG = 8;         // particulas por tentaculo
const SUB = 3, ITERS = 3;
// REACH es el numero mas sensible del sistema. Con 132 la criatura no alcanza
// ninguna pared desde el centro de una sala y se cae; con 288 alcanza el 95%.
export const REACH = 288;
const RING = 16;              // anclajes candidatos en brujula fija
const MIN_GRIP = 2;           // nunca soltar por debajo de esto o cae al vacio
const HAUL = 2600;            // px/s^2 de arrastre
const GRAV = 1400;
const MAXSPD = 620;
const AIR = 0.992;
export const BODY_R = 10;

export const SEEK = 0, GRIP = 1, REL = 2;

const COS = new Float32Array(RING), SIN = new Float32Array(RING);
for (let k = 0; k < RING; k++) {
  const a = (k / RING) * Math.PI * 2;
  COS[k] = Math.cos(a); SIN[k] = Math.sin(a);
}

export function makeCreature(x, y) {
  return {
    x, y, ox: x, oy: y,
    st: new Uint8Array(NT), gx: new Float32Array(NT), gy: new Float32Array(NT),
    life: new Float32Array(NT), cool: new Float32Array(NT),
    px: new Float32Array(NT * SEG), py: new Float32Array(NT * SEG),
    pox: new Float32Array(NT * SEG), poy: new Float32Array(NT * SEG),
    ringX: new Float32Array(RING), ringY: new Float32Array(RING),
    ringHit: new Uint8Array(RING),
    scanK: 0, gripsLast: 0,
    hp: 100, bloodiness: 0,
  };
}

// DDA contra tiles. El tope de pasos se calcula generoso porque un rayo
// diagonal cruza casi el doble de tiles que uno recto: quedarse corto hace
// que el rayo falle en silencio justo en las diagonales.
const _h = new Float32Array(3);   // [x, y, dist]  dist -1 = sin impacto
export function ray(solid, x0, y0, dx, dy, maxD) {
  let cx = Math.floor(x0 / TS), cy = Math.floor(y0 / TS);
  if (solid(cx, cy)) { _h[0] = x0; _h[1] = y0; _h[2] = 0; return _h; }
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const idx = dx !== 0 ? Math.abs(TS / dx) : 1e30;
  const idy = dy !== 0 ? Math.abs(TS / dy) : 1e30;
  let tx = dx !== 0 ? ((dx > 0 ? (cx + 1) * TS - x0 : x0 - cx * TS) / Math.abs(dx)) : 1e30;
  let ty = dy !== 0 ? ((dy > 0 ? (cy + 1) * TS - y0 : y0 - cy * TS) / Math.abs(dy)) : 1e30;
  const cap = Math.ceil(maxD / TS) * 2 + 8;
  let t = 0;
  for (let g = 0; g < cap; g++) {
    if (tx < ty) { t = tx; tx += idx; cx += sx; }
    else { t = ty; ty += idy; cy += sy; }
    if (t > maxD) { _h[2] = -1; return _h; }
    if (solid(cx, cy)) { _h[0] = x0 + dx * t; _h[1] = y0 + dy * t; _h[2] = t; return _h; }
  }
  _h[2] = -1; return _h;
}

function scanSlot(C, solid, k) {
  const h = ray(solid, C.x, C.y, COS[k], SIN[k], REACH);
  if (h[2] >= 0) { C.ringX[k] = h[0]; C.ringY[k] = h[1]; C.ringHit[k] = 1; }
  else C.ringHit[k] = 0;
}

// Elige donde agarrarse. El aim SESGA la puntuacion pero nunca excluye: si solo
// se excluyeran los anclajes contrarios, al apuntar hacia arriba en una sala
// descartaria el suelo (lo unico agarrable) y caeria.
function pickGrip(C, i, ax, ay) {
  let best = -1, bs = -1e9;
  for (let k = 0; k < RING; k++) {
    if (!C.ringHit[k]) continue;
    const dx = C.ringX[k] - C.x, dy = C.ringY[k] - C.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > REACH) continue;                 // revalidar contra la posicion ACTUAL
    const align = (dx / d) * ax + (dy / d) * ay;
    const score = align * 2.0 + (1 - d / REACH) * 0.8;
    // Separacion: sin esto los 12 tentaculos se apilan en la misma esquina.
    let dup = 0;
    for (let j = 0; j < NT; j++) {
      if (j === i || C.st[j] !== GRIP) continue;
      const ex = C.gx[j] - C.ringX[k], ey = C.gy[j] - C.ringY[k];
      if (ex * ex + ey * ey < 400) { dup = 1; break; }
    }
    if (dup) continue;
    if (score > bs) { bs = score; best = k; }
  }
  if (best < 0) return false;
  C.gx[i] = C.ringX[best]; C.gy[i] = C.ringY[best];
  C.st[i] = GRIP; C.life[i] = 0;
  const b = i * SEG;
  for (let s = 0; s < SEG; s++) {
    const f = s / (SEG - 1), p = b + s;
    C.px[p] = C.pox[p] = C.x + (C.gx[i] - C.x) * f;
    C.py[p] = C.poy[p] = C.y + (C.gy[i] - C.y) * f;
  }
  return true;
}

export function blocked(x, y, solid) {
  const r = BODY_R - 2;
  return solid(Math.floor((x - r) / TS), Math.floor(y / TS)) ||
         solid(Math.floor((x + r) / TS), Math.floor(y / TS)) ||
         solid(Math.floor(x / TS), Math.floor((y - r) / TS)) ||
         solid(Math.floor(x / TS), Math.floor((y + r) / TS));
}

// Un paso completo. (aimx,aimy) es la direccion normalizada hacia el dedo;
// pulling indica si la jugadora esta arrastrando.
export function step(C, dt, aimx, aimy, pulling, solid) {
  // Anillo de anclajes: 4 ranuras por frame, o las 16 de golpe si se quedo sin
  // agarre. Ese rescate es lo que garantiza que nunca se queda colgada sin nada.
  if (C.gripsLast === 0) { for (let k = 0; k < RING; k++) scanSlot(C, solid, k); }
  else for (let n = 0; n < 4; n++) { scanSlot(C, solid, C.scanK); C.scanK = (C.scanK + 1) % RING; }

  let ng = 0;
  for (let i = 0; i < NT; i++) {
    if (C.st[i] === GRIP) {
      C.life[i] += dt;
      const dx = C.gx[i] - C.x, dy = C.gy[i] - C.y, d = Math.hypot(dx, dy) || 1;
      const align = (dx / d) * aimx + (dy / d) * aimy;
      const over = d > REACH * 1.04, behind = align < -0.55, aged = C.life[i] > 1.1;
      // MIN_GRIP es imprescindible: sin el, apuntar hacia arriba suelta todos
      // los agarres del suelo a la vez y la criatura cae sin recuperarse.
      if (over || ((behind || aged) && C.gripsLast > MIN_GRIP)) { C.st[i] = REL; C.cool[i] = 0.03; }
      else ng++;
    } else if (C.st[i] === REL) {
      C.cool[i] -= dt; if (C.cool[i] <= 0) C.st[i] = SEEK;
    } else {
      pickGrip(C, i, aimx, aimy);
    }
  }
  C.gripsLast = ng;

  const sdt = dt / SUB, sdt2 = sdt * sdt;
  for (let sub = 0; sub < SUB; sub++) {
    let vx = (C.x - C.ox) * AIR, vy = (C.y - C.oy) * AIR;
    C.ox = C.x; C.oy = C.y;

    let hx = 0, hy = 0, n = 0;
    for (let i = 0; i < NT; i++) {
      if (C.st[i] !== GRIP) continue;
      const dx = C.gx[i] - C.x, dy = C.gy[i] - C.y, d = Math.hypot(dx, dy) || 1;
      hx += dx / d; hy += dy / d; n++;
    }

    if (n > 0) {
      const hm = Math.hypot(hx, hy) || 1;
      hx /= hm; hy /= hm;
      // El dedo manda; el tiron de los agarres solo aporta un cuarto.
      let mixX = aimx * 0.75 + hx * 0.25, mixY = aimy * 0.75 + hy * 0.25;
      // DESLIZAMIENTO sobre la superficie. Es la correccion que arreglo los
      // atascos: apuntar hacia una esquina concava clavaba a la criatura 88
      // segundos, porque la fuerza empujaba al muro y el barrido la frenaba
      // cada frame. Proyectando el empuje sobre la pared, resbala y sigue.
      const probe = BODY_R + 4;
      if (mixX !== 0 && blocked(C.x + Math.sign(mixX) * probe, C.y, solid)) mixX = 0;
      if (mixY !== 0 && blocked(C.x, C.y + Math.sign(mixY) * probe, solid)) mixY = 0;
      if (mixX === 0 && mixY === 0) {
        // Esquina cerrada: se busca el eje libre mas cercano en vez de parar.
        if (!blocked(C.x, C.y - probe, solid)) mixY = -1;
        else if (!blocked(C.x + probe, C.y, solid)) mixX = 1;
        else if (!blocked(C.x - probe, C.y, solid)) mixX = -1;
        else if (!blocked(C.x, C.y + probe, solid)) mixY = 1;
      }
      const mm = Math.hypot(mixX, mixY) || 1;
      const k = pulling ? 1 : 0.25;
      vx += (mixX / mm) * HAUL * k * sdt2;
      vy += (mixY / mm) * HAUL * k * sdt2;
      // Agarrada NO hay gravedad: es lo que permite trepar muros y techos.
    } else {
      vy += GRAV * sdt2;
    }

    const spd = Math.hypot(vx, vy) / sdt;
    if (spd > MAXSPD) { const s = MAXSPD / spd; vx *= s; vy *= s; }

    // Barrido por ejes: nunca teletransportar dentro de un muro.
    const steps = Math.max(1, Math.ceil(Math.hypot(vx, vy) / (TS * 0.4)));
    const stx = vx / steps, sty = vy / steps;
    let movedX = 0, movedY = 0;
    for (let s = 0; s < steps; s++) {
      if (!blocked(C.x + stx, C.y, solid)) { C.x += stx; movedX += stx; }
      if (!blocked(C.x, C.y + sty, solid)) { C.y += sty; movedY += sty; }
    }
    C.ox = C.x - movedX;
    C.oy = C.y - movedY;
  }

  // Cuerda de cada tentaculo. Verlet con largo en reposo ADAPTATIVO: un
  // tentaculo agarrado abarca justo hasta su ancla, sin holgura ni tirones.
  for (let i = 0; i < NT; i++) {
    const b = i * SEG;
    const gripped = C.st[i] === GRIP;
    C.px[b] = C.x; C.py[b] = C.y;
    C.pox[b] = C.x; C.poy[b] = C.y;
    if (gripped) {
      const tip = b + SEG - 1;
      C.px[tip] = C.gx[i]; C.py[tip] = C.gy[i];
      C.pox[tip] = C.gx[i]; C.poy[tip] = C.gy[i];
    }
    for (let s = 1; s < SEG; s++) {
      const p = b + s;
      if (gripped && s === SEG - 1) continue;
      const x = C.px[p], y = C.py[p];
      const vx2 = (x - C.pox[p]) * 0.94, vy2 = (y - C.poy[p]) * 0.94;
      C.pox[p] = x; C.poy[p] = y;
      C.px[p] = x + vx2;
      C.py[p] = y + vy2 + GRAV * dt * dt * 0.25;
    }
    let rl = REACH / (SEG - 1);
    if (gripped) rl = Math.max(4, Math.hypot(C.gx[i] - C.x, C.gy[i] - C.y) / (SEG - 1));
    for (let k = 0; k < ITERS; k++) {
      for (let s = 0; s < SEG - 1; s++) {
        const a = b + s, c = a + 1;
        const dx = C.px[c] - C.px[a], dy = C.py[c] - C.py[a];
        const dd = dx * dx + dy * dy;
        if (dd < 1e-9) continue;              // puntos coincidentes -> NaN
        const dist = Math.sqrt(dd);
        const diff = (dist - rl) / dist * 0.5;
        const wx = dx * diff, wy = dy * diff;
        if (s !== 0) { C.px[a] += wx; C.py[a] += wy; }
        if (!(gripped && c === b + SEG - 1)) { C.px[c] -= wx; C.py[c] -= wy; }
      }
    }
  }

  return C.gripsLast;
}

export function speedOf(C, dt) {
  return Math.hypot(C.x - C.ox, C.y - C.oy) / dt;
}
