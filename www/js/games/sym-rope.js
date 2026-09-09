// SYMBIOTE - fisica de tentaculos (Verlet) y cuerpo del simbionte.
// Es la pieza que define como se siente el juego: si el balanceo esta mal,
// no hay gore ni nivel que lo salve.
//
// Unidades canonicas (docs/SYMBIOTE-CANON.md): 540x1200 virtual, TS=24.
// Todas las constantes salieron de simular la fisica, no de suponerla.

// --- Constantes de cuerda ---
export const SEG = 14;          // particulas por tentaculo
export const REST = 12;         // separacion en reposo -> largo max 13*12 = 156
export const TENT_MAX = 6;      // 2 de la jugadora + 4 para agarres y miembros
const SUB = 2;                  // substeps por frame
const ITERS = 3;                // iteraciones de restriccion por substep

// --- Constantes de movimiento (validadas por simulacion) ---
export const GRAV = 1400;       // px/s^2
export const SWING = 2200;      // px/s^2 tangencial
export const AUTH = 620;        // px/s, caida de autoridad
export const MAXSPD = 900;      // px/s
const AIR = 0.999;              // amortiguacion por substep
export const REEL_IN = 220, REEL_OUT = 260;
export const LEN_MIN = 40, LEN_MAX = 156;
export const WALK = 78;         // px/s caminando: lento a proposito
export const BODY_R = 14;

// Estados de tentaculo
export const T_FREE = 0, T_FLYING = 1, T_ANCHORED = 2, T_GRIP = 3, T_RETRACT = 4;

// Scratch de modulo: raycast devuelve aqui para no asignar por frame.
// OJO: quien llame debe copiar lo que necesite ANTES del siguiente raycast.
const _hit = new Float32Array(5);   // [x, y, nx, ny, dist]  dist -1 = sin impacto

// DDA de Amanatides-Woo contra el tilemap.
// solidFn(tx,ty) -> bool. Fuera de limites cuenta como solido.
export function rayTiles(solidFn, TS, x0, y0, dx, dy, maxD) {
  let cx = Math.floor(x0 / TS), cy = Math.floor(y0 / TS);
  if (solidFn(cx, cy)) {
    _hit[0] = x0; _hit[1] = y0; _hit[2] = 0; _hit[3] = 0; _hit[4] = 0;
    return _hit;
  }
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const idx = dx !== 0 ? Math.abs(TS / dx) : 1e30;
  const idy = dy !== 0 ? Math.abs(TS / dy) : 1e30;
  let tx = dx !== 0 ? ((dx > 0 ? (cx + 1) * TS - x0 : x0 - cx * TS) / Math.abs(dx)) : 1e30;
  let ty = dy !== 0 ? ((dy > 0 ? (cy + 1) * TS - y0 : y0 - cy * TS) / Math.abs(dy)) : 1e30;
  let t = 0, face = 0;
  // Tope duro de pasos: una direccion degenerada no puede colgar el juego.
  for (let gstep = 0; gstep < 256; gstep++) {
    if (tx < ty) { t = tx; tx += idx; cx += sx; face = 0; }
    else { t = ty; ty += idy; cy += sy; face = 1; }
    if (t > maxD) { _hit[4] = -1; return _hit; }
    if (solidFn(cx, cy)) {
      _hit[0] = x0 + dx * t; _hit[1] = y0 + dy * t;
      _hit[2] = face === 0 ? -sx : 0;
      _hit[3] = face === 1 ? -sy : 0;
      _hit[4] = t;
      return _hit;
    }
  }
  _hit[4] = -1;
  return _hit;
}

// Estado de todos los tentaculos en arrays planos (struct-of-arrays).
// Se asigna UNA vez; nada aqui genera basura por frame.
export function makeRope() {
  const NP = TENT_MAX * SEG;
  return {
    px: new Float32Array(NP), py: new Float32Array(NP),
    ox: new Float32Array(NP), oy: new Float32Array(NP),
    pin: new Uint8Array(NP),
    state: new Uint8Array(TENT_MAX),
    ax: new Float32Array(TENT_MAX), ay: new Float32Array(TENT_MAX),
    len: new Float32Array(TENT_MAX),
    grip: new Int16Array(TENT_MAX),      // uid del enemigo agarrado, o -1
    tipVX: new Float32Array(TENT_MAX), tipVY: new Float32Array(TENT_MAX),
    wet: new Float32Array(TENT_MAX),     // segundos que el tentaculo sigue ensangrentado
  };
}

// Cuerpo del simbionte: posicion Verlet propia.
export function makeBody(x, y) {
  return {
    x, y, ox: x, oy: y,
    onGround: false,
    attached: -1,          // indice de tentaculo del que cuelga, o -1
    hp: 100, bloodiness: 0,
  };
}

// Lanza un tentaculo desde el cuerpo hacia (dx,dy) normalizado.
// Devuelve el indice usado, o -1 si no hay libre.
export function fire(R, B, dx, dy, solidFn, TS, maxRange) {
  let t = -1;
  for (let i = 0; i < TENT_MAX; i++) if (R.state[i] === T_FREE) { t = i; break; }
  if (t < 0) return -1;

  const h = rayTiles(solidFn, TS, B.x, B.y, dx, dy, maxRange);
  const base = t * SEG;

  if (h[4] < 0) {
    // Sin impacto: el tentaculo vuela y se retrae solo.
    R.state[t] = T_RETRACT;
  } else {
    // Ancla 1px afuera de la cara para que la punta no se hunda en el muro.
    R.ax[t] = h[0] + h[2];
    R.ay[t] = h[1] + h[3];
    R.state[t] = T_ANCHORED;
    R.len[t] = Math.min(LEN_MAX, Math.max(LEN_MIN, Math.hypot(R.ax[t] - B.x, R.ay[t] - B.y)));
    B.attached = t;
  }
  R.grip[t] = -1;

  // Estira la cadena en linea recta del cuerpo al ancla (o a la maxima distancia).
  const ex = R.state[t] === T_ANCHORED ? R.ax[t] : B.x + dx * maxRange;
  const ey = R.state[t] === T_ANCHORED ? R.ay[t] : B.y + dy * maxRange;
  for (let s = 0; s < SEG; s++) {
    const f = s / (SEG - 1);
    const i = base + s;
    R.px[i] = R.ox[i] = B.x + (ex - B.x) * f;
    R.py[i] = R.oy[i] = B.y + (ey - B.y) * f;
    R.pin[i] = 0;
  }
  R.pin[base] = 1;                              // raiz: la lleva el cuerpo
  if (R.state[t] === T_ANCHORED) R.pin[base + SEG - 1] = 1;   // punta: clavada al ancla
  return t;
}

// Suelta un tentaculo. NO tocar ox/oy del cuerpo: la velocidad es implicita en
// (x-ox) y igualarlos tiraria toda la inercia, que es lo mas satisfactorio.
export function release(R, B, t) {
  if (t < 0 || R.state[t] === T_FREE) return;
  R.state[t] = T_RETRACT;
  R.grip[t] = -1;
  R.pin[t * SEG + SEG - 1] = 0;
  if (B.attached === t) B.attached = -1;
}

// Un paso completo de fisica. stickX/stickY es el joystick (-1..1).
// solidFn(tx,ty) consulta el tilemap. Devuelve la velocidad del cuerpo en px/s.
export function step(R, B, dtFrame, stickX, stickY, solidFn, TS) {
  const dt = dtFrame / SUB;
  const dt2 = dt * dt;

  for (let sub = 0; sub < SUB; sub++) {
    // ---- Cuerpo ----
    let vx = (B.x - B.ox) * AIR, vy = (B.y - B.oy) * AIR;
    B.ox = B.x; B.oy = B.y;
    vy += GRAV * dt2;

    const t = B.attached;
    if (t >= 0 && R.state[t] === T_ANCHORED) {
      const ddx = B.x - R.ax[t], ddy = B.y - R.ay[t];
      const d = Math.hypot(ddx, ddy) || 1;
      const nx = ddx / d, ny = ddy / d;      // radial
      const tx = -ny, ty = nx;                // tangencial

      // Empuje tangencial con caida de autoridad. SIN esto la velocidad se pega
      // al tope y el arco del pendulo desaparece: se siente como acelerar recto.
      const push = stickX * tx + stickY * ty;
      const tv = (vx * tx + vy * ty) / dt;
      const fall = Math.max(0, 1 - Math.abs(tv) / AUTH);
      vx += tx * push * SWING * fall * dt2;
      vy += ty * push * SWING * fall * dt2;

      // Recoger / soltar cuerda: acorta el pendulo y acelera la cadencia.
      const radial = stickX * nx + stickY * ny;
      if (radial < -0.3) R.len[t] = Math.max(LEN_MIN, R.len[t] - REEL_IN * dt);
      else if (radial > 0.3) R.len[t] = Math.min(LEN_MAX, R.len[t] + REEL_OUT * dt);
    } else {
      // Sin colgar: control debil. Caminar es lento a proposito, para que
      // columpiarse se sienta como volar.
      vx += stickX * 900 * dt2;
      if (B.onGround) {
        const cap = WALK * dt;
        if (vx > cap) vx = cap; else if (vx < -cap) vx = -cap;
      }
    }

    // Tope de velocidad ANTES de integrar, para que la restriccion vea algo sano.
    const spd = Math.hypot(vx, vy) / dt;
    if (spd > MAXSPD) { const k = (MAXSPD * dt) / (spd * dt); vx *= k; vy *= k; }

    let nx2 = B.x + vx, ny2 = B.y + vy;

    // Restriccion de cuerda: SOLO tira, nunca empuja. Esa asimetria es lo que
    // deja caer por dentro del arco y quedar floja al pasar por arriba.
    if (t >= 0 && R.state[t] === T_ANCHORED) {
      const dx2 = nx2 - R.ax[t], dy2 = ny2 - R.ay[t];
      const d2 = Math.hypot(dx2, dy2);
      if (d2 > R.len[t]) {
        const k = R.len[t] / d2;
        nx2 = R.ax[t] + dx2 * k;
        ny2 = R.ay[t] + dy2 * k;
      }
    }

    // Barrido contra tiles: nunca teletransportar. A 900px/s son 15px por frame
    // contra tiles de 24, y SUB=2 lo baja a 7.5px = 3.2x de margen.
    sweepBody(B, nx2, ny2, solidFn, TS);

    // ---- Tentaculos ----
    for (let i = 0; i < TENT_MAX; i++) {
      if (R.state[i] === T_FREE) continue;
      const base = i * SEG;
      // La raiz siempre sigue al cuerpo.
      R.px[base] = B.x; R.py[base] = B.y;
      R.ox[base] = B.x; R.oy[base] = B.y;
      if (R.state[i] === T_ANCHORED) {
        const tip = base + SEG - 1;
        R.px[tip] = R.ax[i]; R.py[tip] = R.ay[i];
        R.ox[tip] = R.ax[i]; R.oy[tip] = R.ay[i];
      }
      for (let s = 0; s < SEG; s++) {
        const p = base + s;
        if (R.pin[p]) continue;
        const x = R.px[p], y = R.py[p];
        const pvx = (x - R.ox[p]) * AIR, pvy = (y - R.oy[p]) * AIR;
        R.ox[p] = x; R.oy[p] = y;
        R.px[p] = x + pvx;
        R.py[p] = y + pvy + GRAV * dt2;
      }
    }

    // Restricciones de distancia
    for (let k = 0; k < ITERS; k++) {
      for (let i = 0; i < TENT_MAX; i++) {
        if (R.state[i] === T_FREE) continue;
        const base = i * SEG;
        for (let s = 0; s < SEG - 1; s++) {
          const a = base + s, c = a + 1;
          const dx3 = R.px[c] - R.px[a], dy3 = R.py[c] - R.py[a];
          const dd = dx3 * dx3 + dy3 * dy3;
          if (dd < 1e-9) continue;            // puntos coincidentes -> NaN
          const dist = Math.sqrt(dd);
          const diff = (dist - REST) / dist * 0.5;
          const wx = dx3 * diff, wy = dy3 * diff;
          if (!R.pin[a]) { R.px[a] += wx; R.py[a] += wy; }
          if (!R.pin[c]) { R.px[c] -= wx; R.py[c] -= wy; }
        }
      }
    }
  }

  // Retraccion: el tentaculo se recoge hacia el cuerpo y se libera.
  for (let i = 0; i < TENT_MAX; i++) {
    if (R.state[i] !== T_RETRACT) continue;
    const base = i * SEG;
    let far = 0;
    for (let s = 1; s < SEG; s++) {
      const p = base + s;
      R.px[p] += (B.x - R.px[p]) * 0.35;
      R.py[p] += (B.y - R.py[p]) * 0.35;
      const d = Math.hypot(R.px[p] - B.x, R.py[p] - B.y);
      if (d > far) far = d;
    }
    if (far < 6) { R.state[i] = T_FREE; R.grip[i] = -1; }
    if (R.wet[i] > 0) R.wet[i] -= dtFrame;
  }

  return Math.hypot(B.x - B.ox, B.y - B.oy) / dtFrame;
}

// Mueve el cuerpo a (nx,ny) con barrido DDA, deteniendose en el primer solido.
// Mata la velocidad SOLO en el eje bloqueado, para poder deslizar por muros.
function sweepBody(B, nx, ny, solidFn, TS) {
  const dx = nx - B.x, dy = ny - B.y;
  const dist = Math.hypot(dx, dy);
  B.onGround = false;

  if (dist < 0.0001) { checkGround(B, solidFn, TS); return; }

  const steps = Math.max(1, Math.ceil(dist / (TS * 0.4)));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    // Eje X
    const tryX = B.x + sx;
    if (!bodyBlocked(tryX, B.y, solidFn, TS)) B.x = tryX;
    else { B.ox = B.x; }                       // choque lateral: pierde vx
    // Eje Y
    const tryY = B.y + sy;
    if (!bodyBlocked(B.x, tryY, solidFn, TS)) B.y = tryY;
    else {
      if (sy > 0) B.onGround = true;
      B.oy = B.y;                              // choque vertical: pierde vy
    }
  }
  checkGround(B, solidFn, TS);
}

function checkGround(B, solidFn, TS) {
  if (bodyBlocked(B.x, B.y + BODY_R + 2, solidFn, TS)) B.onGround = true;
}

// El cuerpo es un circulo; se prueban 4 puntos cardinales del radio.
function bodyBlocked(x, y, solidFn, TS) {
  const r = BODY_R - 2;
  return solidFn(Math.floor((x - r) / TS), Math.floor(y / TS)) ||
         solidFn(Math.floor((x + r) / TS), Math.floor(y / TS)) ||
         solidFn(Math.floor(x / TS), Math.floor((y - r) / TS)) ||
         solidFn(Math.floor(x / TS), Math.floor((y + r) / TS));
}

// Dibuja un tentaculo como limbo organico: puntos gruesos que se afinan hacia
// la punta. Se usan fillRect en vez de trazos para mantener el pixel nitido.
export function drawTentacle(g, R, i, camX, camY, colBody, colEdge) {
  if (R.state[i] === T_FREE) return;
  const base = i * SEG;
  for (let s = 0; s < SEG; s++) {
    const p = base + s;
    // Conicidad: 9px en la raiz -> 3px en la punta.
    const w = Math.round(9 - (s / (SEG - 1)) * 6);
    const x = Math.round(R.px[p] - camX - w / 2);
    const y = Math.round(R.py[p] - camY - w / 2);
    g.fillStyle = colEdge;
    g.fillRect(x - 1, y - 1, w + 2, w + 2);
    g.fillStyle = colBody;
    g.fillRect(x, y, w, w);
  }
}
