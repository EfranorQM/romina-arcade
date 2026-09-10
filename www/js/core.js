// Nucleo del motor: canvas virtual, bucle de tiempo fijo, RNG, pools, guardado.
//
// LA APP TIENE DOS ORIENTACIONES, y cada escena declara la suya con meta.wide:
//
//   El MENU es apaisado (600x270). Es la cara de la app: la estanteria de
//   caratulas necesita ancho para que la fila se lea.
//
//   Los JUEGOS son verticales (270x600, o 540x1200 los que piden detalle).
//   Estan medidos asi -- sus saltos, sus oleadas, su terreno -- y ademas un
//   lienzo de pie dentro de una pantalla acostada solo podria ocupar una franja
//   de 122px de ancho: la mitad del espacio para el que fueron dibujados.
//
// Por eso al entrar a un juego se pide vertical al telefono y al volver al menu
// se pide horizontal. El giro es parte del diseno, no un efecto secundario.
export let VW = 600, VH = 270;
export const BASE_VW = 270, BASE_VH = 600;      // lienzo vertical de un juego
export const MENU_VW = 600, MENU_VH = 270;      // lienzo apaisado del menu

export const view = { scale: 1, ox: 0, oy: 0 };
export let canvas = null, g = null;

export function initCanvas(el) {
  canvas = el;
  canvas.width = VW; canvas.height = VH;   // backbuffer diminuto: NO multiplicar por devicePixelRatio
  g = canvas.getContext('2d', { alpha: false, desynchronized: true });
  g.imageSmoothingEnabled = false;
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 100));
  return g;
}

// Modo de filtrado. Los juegos de pixel art necesitan el nearest-neighbour
// (smooth=false, el defecto); un juego que dibuja con curvas y degradados en
// vez de sprites horneados pide smooth=true via meta.smooth, y entonces el
// escalado y los bordes salen suaves en vez de escalonados.
let smoothMode = false;
export function setSmooth(on) {
  smoothMode = !!on;
  if (g) g.imageSmoothingEnabled = smoothMode;
}

// Cambia la resolucion virtual entre escenas. OJO: asignar canvas.width RESETEA
// todo el estado del contexto 2D, incluido imageSmoothingEnabled; hay que
// volver a ponerlo aqui o el juego entero se dibuja borroso sin avisar.
export function setVirtual(w, h) {
  if (w === VW && h === VH) { g.imageSmoothingEnabled = smoothMode; return; }
  VW = w; VH = h;
  canvas.width = VW; canvas.height = VH;
  g.imageSmoothingEnabled = smoothMode;
  fit();
}

// ---------- Orientacion ----------
// Se le PIDE al telefono que gire: horizontal para el menu, vertical para los
// juegos. lock() solo funciona en pantalla completa y en algunos navegadores
// rechaza siempre; cuando falla, la app se sigue viendo bien (fit() la centra
// con barras), solo que el usuario tiene que girar el telefono el mismo.
export function requestOrientation(wide) {
  try {
    const so = screen.orientation;
    if (so && so.lock) {
      const p = so.lock(wide ? 'landscape' : 'portrait');
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* navegador sin la API: se queda como este */ }
}

export function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

export function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / VW, vh / VH);
  const w = VW * scale, h = VH * scale;
  const s = canvas.style;
  s.width = w + 'px'; s.height = h + 'px';
  s.left = ((vw - w) * 0.5) + 'px';
  s.top = ((vh - h) * 0.5) + 'px';
  view.scale = scale; view.ox = (vw - w) * 0.5; view.oy = (vh - h) * 0.5;
}

// ---------- RNG sembrado (xorshift32) ----------
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const r = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

// ---------- Pool de objetos: swap-remove, capacidad fija, O(1) ----------
export class Pool {
  constructor(cap, make, reset) {
    this.cap = cap; this.reset = reset;
    this.items = new Array(cap);
    for (let i = 0; i < cap; i++) { this.items[i] = make(); this.items[i]._i = i; }
    this.n = 0;
  }
  spawn() {
    if (this.n >= this.cap) return null;   // lleno: se descarta en silencio, nunca crece (evita GC)
    return this.items[this.n++];
  }
  free(o) {
    const i = o._i, last = this.n - 1;
    if (i > last) return;
    const tail = this.items[last];
    this.items[i] = tail; tail._i = i;
    this.items[last] = o; o._i = last;
    this.n--;
    if (this.reset) this.reset(o);
  }
  clear() { this.n = 0; }
  get length() { return this.n; }
}

// ---------- Colisiones ----------
export const aabb = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

export const circle = (ax, ay, ar, bx, by, br) => {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy < r * r;
};

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Persistencia: solo records y mute. Nunca lanza excepcion. ----------
const KEY = 'romina_arcade_v1';
let saveData = { scores: {}, mute: false };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) saveData = Object.assign(saveData, JSON.parse(raw));
} catch (e) { /* modo incognito o storage bloqueado: seguimos en memoria */ }

function persist() { try { localStorage.setItem(KEY, JSON.stringify(saveData)); } catch (e) {} }

export const Save = {
  best(id) { return saveData.scores[id] || 0; },
  // Devuelve true si es record nuevo.
  submit(id, score) {
    const prev = saveData.scores[id] || 0;
    if (score > prev) { saveData.scores[id] = score; persist(); return true; }
    return false;
  },
  get muted() { return saveData.mute; },
  toggleMute() { saveData.mute = !saveData.mute; persist(); return saveData.mute; },
};

// ---------- Camara / screen shake ----------
export const cam = {
  x: 0, y: 0, t: 0, mag: 0,
  shake(mag, dur) { if (mag > this.mag) { this.mag = mag; this.t = dur; } },
  update(dt, rnd) {
    if (this.t > 0) {
      this.t -= dt;
      const k = this.mag * (this.t > 0 ? 1 : 0);
      this.x = Math.round((rnd() * 2 - 1) * k);
      this.y = Math.round((rnd() * 2 - 1) * k);
      if (this.t <= 0) { this.mag = 0; this.x = 0; this.y = 0; }
    }
  },
  reset() { this.x = 0; this.y = 0; this.t = 0; this.mag = 0; },
};
