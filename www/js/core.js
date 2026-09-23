// Nucleo del motor: canvas virtual, bucle de tiempo fijo, RNG, pools, guardado.
//
// LA APP TIENE DOS ORIENTACIONES, y cada escena declara la suya con meta.wide:
//
//   El MENU es apaisado (600x270). Es la cara de la app: la estanteria de
//   caratulas necesita ancho para que la fila se lea. SURVIVAL tambien lo es,
//   por la misma razon que el original del que viene: se agarra con las dos
//   manos y los dos pulgares caen en las esquinas de abajo.
//
//   Los OTROS CINCO JUEGOS son verticales (270x600, o 540x1200 los que piden
//   detalle).
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
//
// OJO: esta bandera solo manda DENTRO del lienzo. El ultimo escalado -- el que
// estira el lienzo hasta la pantalla, y es el que multiplica por cuatro -- lo
// hace el navegador segun el CSS, y durante mucho tiempo #c llevaba
// 'image-rendering: pixelated' fijo para toda la app. O sea que SURVIVAL
// suavizaba por dentro y el navegador se lo volvia a escalonar por fuera: se
// pagaba el coste de suavizar y se veia pixelado igual. Por eso la clase CSS
// se pone AQUI, siguiendo al modo del juego.
let smoothMode = false;
export function setSmooth(on) {
  smoothMode = !!on;
  if (g) g.imageSmoothingEnabled = smoothMode;
  if (canvas) canvas.classList.toggle('pixelado', !smoothMode);
}

// ---------- Sobremuestreo ----------
// El lienzo REAL se hace SS veces mas grande que el virtual, y todo el dibujado
// se multiplica por SS con el transform base. Los juegos siguen escribiendo sus
// posiciones y radios en coordenadas de VWxVH sin enterarse de nada.
//
// Hace falta porque las criaturas se hornean a 64px y se dibujan a ~36: con el
// lienzo a 1x, la mitad del detalle que tienen los sprites no cabe en ningun
// pixel. Medido en un telefono real: el lienzo de 600x270 se estira x4, asi que
// cada pixel virtual sale como un bloque de 4x4.
let SS = 1;
export function supersample() { return SS; }
export function setSupersample(n) {
  const v = Math.max(1, n || 1);
  if (v === SS) return;
  SS = v;
  if (canvas) { canvas.width = VW * SS; canvas.height = VH * SS; baseTransform(); fit(); }
}

// Reaplica el transform base. El bucle lo llama al empezar cada frame, porque
// la camara hace translate() encima y hay que partir siempre del mismo sitio.
export function baseTransform() {
  if (g) { g.setTransform(SS, 0, 0, SS, 0, 0); g.imageSmoothingEnabled = smoothMode; }
}

// Cambia la resolucion virtual entre escenas. OJO: asignar canvas.width RESETEA
// todo el estado del contexto 2D, incluido imageSmoothingEnabled y el
// transform; hay que volver a ponerlos aqui o el juego entero se dibuja
// borroso, o a la escala equivocada, sin avisar.
export function setVirtual(w, h) {
  if (w === VW && h === VH && canvas.width === VW * SS) { baseTransform(); return; }
  VW = w; VH = h;
  canvas.width = VW * SS; canvas.height = VH * SS;
  baseTransform();
  fit();
}

// ---------- Orientacion ----------
// Se le PIDE al telefono que gire: horizontal para el menu y SURVIVAL, vertical
// para los otros cinco juegos. Hay DOS vias, y se intentan en este orden.
//
// VIA 1, la buena: el puente nativo (AndroidGiro, en MainActivity.java).
// Llama a setRequestedOrientation(), que es la actividad diciendo en que
// orientacion quiere dibujarse. Manda sobre el ajuste de giro del usuario: el
// telefono se pone de lado solo para SURVIVAL aunque ella tenga la rotacion
// bloqueada, que es lo que hace cualquier juego apaisado de la tienda.
//
// VIA 2, la de siempre: screen.orientation.lock(). Se queda como respaldo para
// el navegador de escritorio y para un APK viejo sin el puente. Falla mucho:
// exige pantalla completa en varios motores y, sobre todo, queda POR DEBAJO de
// la preferencia del sistema -- con el giro bloqueado en ajustes, que es como
// esta el Note 10 de Romina, la promesa se rechaza y el juego se queda de pie.
// Ese fallo es justo el que dejaba el cartel de "GIRA EL TELEFONO" encima.
//
// Si las dos fallan la app se sigue viendo bien (fit() la centra con barras);
// solo que el usuario tiene que girar el telefono el mismo, y para eso sigue
// estando el aviso de main.js.

// True si el puente nativo esta presente. Se consulta en cada llamada y no una
// sola vez al cargar: el interfaz lo inyecta MainActivity.onCreate(), y aunque
// en la practica ya esta puesto antes de que corra este modulo, comprobarlo
// aqui cuesta nada y no depende del orden de arranque.
export function giroNativo() {
  return typeof AndroidGiro !== 'undefined' && !!AndroidGiro
      && typeof AndroidGiro.pedir === 'function';
}

export function requestOrientation(wide) {
  // El puente primero. Si contesta, no se toca screen.orientation: llamar a
  // lock() ADEMAS no aporta nada y en Android encima puede devolver un rechazo
  // ruidoso en la consola por una orientacion que ya esta concedida.
  try {
    if (giroNativo()) { AndroidGiro.pedir(!!wide); return; }
  } catch (e) { /* el puente fallo: se cae al respaldo de abajo */ }
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

// Mensajitos al romper record. Cortos: nunca interrumpen la accion. Los usan
// el fin de partida del arcade (main.js) y los juegos con final propio.
export const MENSAJES_RECORD = [
  ['ERES INCREIBLE', 'ROMINA'],
  ['NADIE COMO TU'],
  ['TE AMO', 'CAMPEONA'],
  ['IMPARABLE'],
  ['ESA ES MI CHICA'],
  ['BRUTAL ROMINA'],
];

// ---------- Persistencia: records, mute y datos sueltos. Nunca lanza excepcion. ----------
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
  // Datos sueltos de cada juego que no son un record: la dificultad elegida,
  // lo que ya aprendio. Van en el mismo guardado, bajo `datos`, asi que un
  // guardado viejo (sin ese campo) sigue sirviendo tal cual.
  dato(clave, def) {
    const d = saveData.datos;
    return d && Object.prototype.hasOwnProperty.call(d, clave) ? d[clave] : def;
  },
  guarda(clave, v) { (saveData.datos = saveData.datos || {})[clave] = v; persist(); },
};

// ---------- Camara / screen shake ----------
export const cam = {
  x: 0, y: 0, t: 0, mag: 0,
  // El temblor de siempre: constante y se corta de golpe. Lo usan los seis
  // juegos anteriores y NO se toca -- cambiarle la curva bajaria a la mitad
  // la media de FURIA y SURVIVAL, que estan medidos con esta.
  shake(mag, dur) { if (mag > this.mag) { this.mag = mag; this.t = dur; } },

  // EL TEMBLOR DE JEFE, en su propio canal. Decae linealmente en vez de
  // cortarse: eso es lo que hace que un pisoton se lea como un golpe que
  // retumba y se apaga, y no como una vibracion que alguien apaga con un
  // interruptor.
  //
  // Va en un canal APARTE y los dos se SUMAN, para que el retumbe largo del
  // jefe y el pico corto de un aterrizaje puedan sonar a la vez. Con un solo
  // canal, el pico del aterrizaje no se oiria por encima del retumbe.
  jm: 0, jt: 0, jd: 0,
  shakeDecay(mag, dur) {
    if (mag * dur >= this.jm * this.jt) { this.jm = mag; this.jt = dur; this.jd = dur; }
  },
  update(dt, rnd) {
    let k = 0;
    if (this.t > 0) {
      this.t -= dt;
      k += this.mag * (this.t > 0 ? 1 : 0);
      if (this.t <= 0) this.mag = 0;
    }
    if (this.jt > 0) {
      this.jt -= dt;
      k += this.jm * Math.max(0, this.jt / this.jd);
      if (this.jt <= 0) this.jm = 0;
    }
    // Tope de 8 px: sumar dos canales sin limite destapa el borde del lienzo.
    if (k > 8) k = 8;
    if (k > 0) {
      this.x = Math.round((rnd() * 2 - 1) * k);
      this.y = Math.round((rnd() * 2 - 1) * k);
    } else if (this.x || this.y) { this.x = 0; this.y = 0; }
  },
  reset() { this.x = 0; this.y = 0; this.t = 0; this.mag = 0; this.jm = 0; this.jt = 0; },
};
