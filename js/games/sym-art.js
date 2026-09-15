// SYMBIOTE - arte estilo CARRION.
//
// Tres piezas: la criatura de carne, los tentaculos, y la iluminacion oscura.
//
// REGLA DE PALETA que lo sostiene todo: el entorno vive entre 8% y 38% de
// luminancia en grises azulados, y NADA del entorno puede ser rojo. Toda la
// carne y la sangre viven arriba del 45% de saturacion en la banda roja. Esa
// separacion de tono es lo que hace legible a la criatura sobre un laboratorio
// oscuro sin necesidad de contornos ni brillos artificiales.

// ---------- Paleta ----------
export const PAL = {
  // Entorno: grises azulados, jamas rojos
  void:    '#05070a',
  bgDeep:  '#080b10',
  bgMid:   '#0d1119',
  bgHigh:  '#151b24',
  metal:   '#1e2733',
  metalLit:'#28323f',
  metalHi: '#36434f',
  edge:    '#4a5866',
  grate:   '#12171d',
  pipe:    '#1a212a',
  pipeLit: '#242d38',
  floor:   '#0c1015',
  floorLit:'#323d49',
  panel:   '#161d26',
  panelLit:'#222c38',
  rail:    '#33414f',
  rust:    '#5a3a28',
  rustLit: '#7d5236',
  // Luces
  warm:    '#ffb45a',
  cold:    '#7fd4ff',
  green:   '#4ade9a',
  alarm:   '#ff2d3a',
  // Carne y sangre
  fleshDeep:'#3d0810',
  fleshDark:'#5e0d1a',
  flesh:    '#8e1224',
  fleshMid: '#b81322',
  fleshLit: '#c9203a',
  fleshHi:  '#ff4d63',
  blood:    '#e01228',
  bone:     '#ffe8a8',
};

// ---------- La criatura ----------
// No es un sprite ni metaballs (eso pediria evaluar un campo por pixel).
// Son 12 radios de control con resorte propio, muestreados en 48 angulos y
// rasterizados como columnas verticales. Cada radio late por su cuenta, y eso
// es lo que la hace leer como masa de carne humeda en vez de una pelota.
const NR = 12, NS = 48;
const _rad = new Float32Array(NS);       // scratch: radio interpolado por angulo
const _top = new Int32Array(256);        // scratch: extremos de columna
const _bot = new Int32Array(256);

export function makeBlob(baseR) {
  const b = {
    rad: new Float32Array(NR), vel: new Float32Array(NR),
    // r0 es el radio en reposo. Se guarda porque blobUpdate() recalcula `base`
    // en cada frame: antes lo pisaba con una constante 12, asi que el argumento
    // de makeBlob() no tenia ningun efecto y la criatura salia siempre diminuta
    // por mas que se pidiera una masa grande. Ese era el motivo real de que se
    // viera como un punto con palos.
    r0: baseR, base: baseR, sx: 1, sy: 1, t: 0,
  };
  for (let i = 0; i < NR; i++) b.rad[i] = baseR;
  return b;
}

// squeezeX/Y: la criatura se aplasta al pasar por un hueco. El area se conserva
// mas o menos, asi que se lee como algo incompresible y no como un globo.
export function blobUpdate(b, dt, squeezeX, squeezeY, grow) {
  b.t += dt;
  b.base = b.r0 + grow * 10;
  for (let i = 0; i < NR; i++) {
    // Dos senos desfasados por punto: con uno solo parece un circulo respirando.
    const target = b.base * (1 + 0.10 * Math.sin(b.t * 3.1 + i * 1.7)
                               + 0.05 * Math.sin(b.t * 5.7 + i * 0.9));
    b.vel[i] += (target - b.rad[i]) * 40 * dt;
    b.vel[i] *= 0.86;
    b.rad[i] += b.vel[i] * dt;
  }
  const k = Math.min(1, 12 * dt);
  b.sx += (squeezeX - b.sx) * k;
  b.sy += (squeezeY - b.sy) * k;
}

// Rasteriza una capa del cuerpo como columnas verticales. Cada columna es un
// fillRect alineado a entero, asi que el pixel queda nitido y no hay trazos.
function shell(g, b, cx, cy, scale, offX, offY, color) {
  // Radio interpolado suavemente entre los 12 puntos de control
  for (let s = 0; s < NS; s++) {
    const f = (s / NS) * NR;
    const i0 = f | 0, i1 = (i0 + 1) % NR;
    const t = f - i0;
    const sm = t * t * (3 - 2 * t);          // suavizado, evita esquinas
    _rad[s] = (b.rad[i0] * (1 - sm) + b.rad[i1] * sm) * scale;
  }
  // Extremos por columna
  let minX = 1e9, maxX = -1e9;
  for (let s = 0; s < NS; s++) {
    const a = (s / NS) * Math.PI * 2;
    const x = Math.round(cx + offX + Math.cos(a) * _rad[s] * b.sx);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const w = maxX - minX + 1;
  if (w <= 0 || w > 255) return;
  for (let i = 0; i < w; i++) { _top[i] = 1e9; _bot[i] = -1e9; }
  let px = 0, py = 0, first = 1, fx = 0, fy = 0;
  for (let s = 0; s <= NS; s++) {
    const si = s % NS;
    const a = (si / NS) * Math.PI * 2;
    const x = Math.round(cx + offX + Math.cos(a) * _rad[si] * b.sx);
    const y = Math.round(cy + offY + Math.sin(a) * _rad[si] * b.sy);
    if (first) { first = 0; px = fx = x; py = fy = y; continue; }
    // Rasteriza el segmento del contorno en las columnas que cruza
    const dx = x - px, dy = y - py;
    const n = Math.max(Math.abs(dx), 1);
    for (let k = 0; k <= n; k++) {
      const xx = Math.round(px + dx * k / n) - minX;
      const yy = Math.round(py + dy * k / n);
      if (xx < 0 || xx >= w) continue;
      if (yy < _top[xx]) _top[xx] = yy;
      if (yy > _bot[xx]) _bot[xx] = yy;
    }
    px = x; py = y;
  }
  g.fillStyle = color;
  for (let i = 0; i < w; i++) {
    if (_bot[i] < _top[i]) continue;
    g.fillRect(minX + i, _top[i], 1, _bot[i] - _top[i] + 1);
  }
}

// Tres capas concentricas: borde oscuro, carne media y brillo arriba-izquierda.
// Es lo que la convierte en masa humeda en vez de mancha plana.
export function drawBlob(g, b, cx, cy, hurt) {
  shell(g, b, cx, cy, 1.00, 0, 0, hurt ? PAL.fleshHi : PAL.fleshDeep);
  shell(g, b, cx, cy, 0.82, 0, 0, hurt ? '#ffffff' : PAL.flesh);
  shell(g, b, cx, cy, 0.55, -2, -2, hurt ? '#ffffff' : PAL.fleshLit);
  // Ojo: un solo punto vivo que da direccion y "mirada"
  g.fillStyle = PAL.bone;
  g.fillRect(Math.round(cx - 2), Math.round(cy - 3), 3, 3);
  g.fillStyle = PAL.void;
  g.fillRect(Math.round(cx - 1), Math.round(cy - 2), 1, 2);
}

// ---------- Tentaculos ----------
// Se afinan por pasos de media grosura en vez de por pixel: mucho mas barato y
// el escalon se lee como segmentacion organica, que ademas queda mejor.
export function drawTentacle(g, C, i, SEG, camX, camY, gripped) {
  const b = i * SEG;
  // Se rellena el ESPACIO ENTRE nodos, no solo los nodos: dibujando unicamente
  // las 8 particulas el tentaculo se ve como una fila de puntos sueltos, no
  // como un brazo. Cada tramo se interpola segun su longitud real.
  for (let pass = 0; pass < 2; pass++) {
    for (let s = 0; s < SEG - 1; s++) {
      const p = b + s, q = p + 1;
      // Catmull-Rom: se usa el nodo anterior y el siguiente para curvar el
      // tramo. Uniendo los nodos con rectas el tentaculo salia en zigzag
      // anguloso; asi describe una curva organica.
      const pm = b + Math.max(0, s - 1), pn = b + Math.min(SEG - 1, s + 2);
      const ax = C.px[pm] - camX, ay = C.py[pm] - camY;
      const x0 = C.px[p] - camX, y0 = C.py[p] - camY;
      const x1 = C.px[q] - camX, y1 = C.py[q] - camY;
      const bx = C.px[pn] - camX, by = C.py[pn] - camY;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(2, Math.ceil(len / 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (s + t) / (SEG - 1);
        // Grosor: base gruesa que nace de la masa y se afina a la punta. Con el
        // cuerpo en radio 22 un tentaculo de 8px se veia como un hilo pegado a
        // una pelota; 14 en la base lo hace leer como extension de la carne.
        const w = Math.max(3, Math.round(14 - f * 10));
        const x = Math.round(0.5 * ((2 * x0) + (-ax + x1) * t +
          (2 * ax - 5 * x0 + 4 * x1 - bx) * t2 + (-ax + 3 * x0 - 3 * x1 + bx) * t3));
        const y = Math.round(0.5 * ((2 * y0) + (-ay + y1) * t +
          (2 * ay - 5 * y0 + 4 * y1 - by) * t2 + (-ay + 3 * y0 - 3 * y1 + by) * t3));
        if (pass === 0) {
          // Primera pasada: contorno oscuro continuo
          g.fillStyle = PAL.fleshDeep;
          g.fillRect(x - (w >> 1) - 1, y - (w >> 1) - 1, w + 2, w + 2);
        } else {
          g.fillStyle = f < 0.35 ? PAL.fleshMid : f < 0.7 ? PAL.flesh : PAL.fleshDark;
          g.fillRect(x - (w >> 1), y - (w >> 1), w, w);
        }
      }
    }
  }
  // La punta agarrada se marca: dice de un vistazo de que esta sujeta
  if (gripped) {
    const tip = b + SEG - 1;
    g.fillStyle = PAL.fleshHi;
    g.fillRect(Math.round(C.px[tip] - camX) - 2, Math.round(C.py[tip] - camY) - 2, 4, 4);
  }
}

// ---------- Iluminacion ----------
// Buffer de luz a MEDIA resolucion: el campo de luz es de baja frecuencia, asi
// que bajarle la resolucion es gratis visualmente pero corta a la cuarta parte
// la acumulacion aditiva. Solo el multiply final va a resolucion completa.
// Nada de getImageData ni bucles por pixel: todo son drawImage.
let LB = null, LBC = null, LAMP = null;

export function bakeLights() {
  if (LAMP) return;
  LAMP = {};
  const COLS = { warm: PAL.warm, red: PAL.alarm, cold: PAL.cold, green: PAL.green };
  for (const k in COLS) {
    const R = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = R * 2;
    const c = cv.getContext('2d');
    const img = c.createImageData && c.createImageData(R * 2, R * 2);
    if (!img) { LAMP[k] = cv; continue; }   // entorno sin canvas real: sin luz
    const d = img.data;
    const h = COLS[k];
    const cr = parseInt(h.substr(1, 2), 16);
    const cg = parseInt(h.substr(3, 2), 16);
    const cb = parseInt(h.substr(5, 2), 16);
    for (let y = 0; y < R * 2; y++) {
      for (let x = 0; x < R * 2; x++) {
        const dx = (x - R) / R, dy = (y - R) / R;
        const d2 = dx * dx + dy * dy;
        // Caida cuadratica que llega EXACTAMENTE a cero en el borde: si no
        // llegara a cero se verian costuras cuadradas donde se solapan.
        const a = d2 >= 1 ? 0 : (1 - d2) * (1 - d2);
        const o = (y * R * 2 + x) * 4;
        d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = (a * 255) | 0;
      }
    }
    c.putImageData(img, 0, 0);
    LAMP[k] = cv;
  }
}

export function ensureLightBuffer(vw, vh) {
  const w = Math.ceil(vw / 2), h = Math.ceil(vh / 2);
  if (!LB || LB.width !== w || LB.height !== h) {
    LB = document.createElement('canvas');
    LB.width = w; LB.height = h;
    LBC = LB.getContext('2d');
    LBC.imageSmoothingEnabled = false;
  }
}

// Empieza un frame de luz: se limpia a la oscuridad ambiente.
export function lightBegin(ambient, alarm) {
  if (!LBC) return;
  LBC.globalCompositeOperation = 'source-over';
  LBC.fillStyle = ambient;
  LBC.fillRect(0, 0, LB.width, LB.height);
  if (alarm > 0) {
    // Estado de alarma: un relleno rojo de poca alfa ANTES de las lamparas.
    LBC.globalAlpha = alarm * 0.35;
    LBC.fillStyle = PAL.alarm;
    LBC.fillRect(0, 0, LB.width, LB.height);
    LBC.globalAlpha = 1;
  }
  LBC.globalCompositeOperation = 'lighter';
}

// Anade una lampara. x,y en coordenadas de pantalla; r en px virtuales.
export function addLight(x, y, r, kind, intensity) {
  if (!LBC || !LAMP) return;
  const img = LAMP[kind] || LAMP.warm;
  const hr = r / 2;
  LBC.globalAlpha = intensity === undefined ? 1 : intensity;
  LBC.drawImage(img, x / 2 - hr, y / 2 - hr, hr * 2, hr * 2);
  LBC.globalAlpha = 1;
}

// Compone la luz sobre la escena ya dibujada: un solo multiply a full res.
export function lightApply(g, vw, vh) {
  if (!LB) return;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(LB, 0, 0, LB.width, LB.height, 0, 0, vw, vh);
  g.globalCompositeOperation = 'source-over';
}

// ---------- Tiles del laboratorio ----------
// Arte oscuro e industrial. Todo gris azulado: ni un rojo, para que la criatura
// destaque sola.
const T_METAL = [
  '3333333333333333',
  '3111111111111112',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3122222222222212',
  '3111111111111112',
  '3222222222222222',
];
const T_PANEL = [
  '3333333333333333',
  '3111111111111113',
  '3144444444444413',
  '3144111111114413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144122222214413',
  '3144111111114413',
  '3144444444444413',
  '3111111111111113',
  '3333333333333333',
];
const T_GRATE = [
  '3333333333333333',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3010101010101013',
  '3101010101010103',
  '3333333333333333',
];

const MAP_METAL = { '1': PAL.metal, '2': PAL.metalLit, '3': PAL.void, '4': PAL.panelLit };
const MAP_PANEL = { '1': PAL.panel, '2': PAL.panelLit, '3': PAL.void, '4': PAL.metal };
const MAP_GRATE = { '0': PAL.grate, '1': PAL.pipe, '3': PAL.void };

export const TILE_ART = {
  metal: { rows: T_METAL, map: MAP_METAL },
  panel: { rows: T_PANEL, map: MAP_PANEL },
  grate: { rows: T_GRATE, map: MAP_GRATE },
};
