// SYMBIOTE - modulo de NIVEL + ENEMIGOS.
// Genera el laboratorio (BSP + MST + corredores en bucle + red de tuberias),
// lo hornea a un canvas del tamano del nivel, y corre la IA de los cinco
// enemigos con las cuatro invariantes de juego limpio del diseno.
// No conoce al jugador ni al simbionte: recibe todo por el objeto `world`.
//
// CERO ASIGNACION POR FRAME en update/draw. Todo lo que hace falta se reserva
// en genLevel()/makeEnemyPool()/bakeTiles(). raycast() escribe en un scratch de
// modulo y lo devuelve: EL LLAMADOR DEBE COPIAR lo que necesite antes de la
// siguiente llamada.
import { VW, VH, Pool, clamp, cam } from '../core.js';
import { bake, bakeFlash, bakeFlip, spr, burst } from '../gfx.js';
import { SFX } from '../audio.js';

// ---------------------------------------------------------------------------
// Constantes de rejilla
// ---------------------------------------------------------------------------

// Tamano de tile en px virtuales. A 540x1200 la pantalla muestra 22.5 x 50
// tiles, el mismo encuadre legible que los otros tres juegos (TS=16 daria 33.8
// tiles de ancho y las salas se leerian como un mapa lejano).
export const TS = 24;

// Tipos de tile. SOLID=0 para que un Uint8Array recien creado sea roca maciza.
export const T_SOLID = 0;    // pared: bloquea, ancla tentaculos
export const T_FLOOR = 1;    // suelo de laboratorio, transitable
export const T_PIPE = 2;     // interior de tuberia (rail vertical)
export const T_GLASS = 3;    // cristal: transitable, se rompe al tocarlo
export const T_VENT = 4;     // reservado v2, nunca generado en v1
export const T_DOOR = 5;     // puerta: transitable, se cierra 0.6s en alarma
export const T_HAZARD = 6;   // charco acido: 1 de dano cada 0.5s
export const T_EXIT = 7;     // salida del nivel
export const T_ENTRY = 8;    // punto de aparicion
export const T_MOUTH = 9;    // boca de tuberia (entrada/salida del rail)

// Transitable a pie: lo que cuenta para el flood fill de conectividad.
// GLASS entra porque se rompe al tocarlo; ninguna decoracion puede ser jamas
// la razon de que una salida sea inalcanzable.
export function walkable(t) {
  return t === T_FLOOR || t === T_DOOR || t === T_HAZARD ||
         t === T_EXIT || t === T_ENTRY || t === T_GLASS;
}

// Solido para colision y anclaje de tentaculo: todo lo que no se puede pisar
// ni es tuberia. Las bocas y el interior de tuberia NO son solidos.
export function isSolidTile(t) {
  return t === T_SOLID || t === T_VENT;
}

// ---------------------------------------------------------------------------
// Paleta (subconjunto del documento de diseno usado por este modulo)
// ---------------------------------------------------------------------------
// Paleta CARRION: laboratorio oscuro e industrial. Todo el entorno vive entre
// 8% y 38% de luminancia en grises azulados, y NADA de aqui puede ser rojo:
// esa separacion de tono es lo que deja legible a la criatura de carne sobre
// el fondo sin necesidad de contornos ni brillos falsos.
const P = {
  out:      '#05070a',
  labWhite: '#4a5866',
  labLight: '#36434f',
  floor:    '#0c1015',
  grout:    '#080b10',
  wall:     '#1e2733',
  wallMid:  '#161d26',
  wallDark: '#12171d',
  shadow:   '#0d1119',
  deep:     '#0a0e14',
  nearBlk:  '#070a0f',
  darkest:  '#05070a',
  pipeIn:   '#05070a',
  pipeMet:  '#1a212a',
  green:    '#4ade9a',
  greenMid: '#22a06a',
  greenDeep:'#12603f',
  yellow:   '#f2c14e',
  orange:   '#ff8c28',
  bright:   '#ffb43c',
  red:      '#e02030',
  navy:     '#1d47a0',
  visor:    '#4de0f0',
  gold:     '#ffe14d',
  skin:     '#e8b48c',
  pants:    '#3d4654',
  coat:     '#f4f7fa',
  coatSh:   '#cdd6e0',
  plate:    '#74828f',
  shieldC:  '#515c68',
  wound:    '#c81e2d',
  white:    '#ffffff',
};

// ---------------------------------------------------------------------------
// Consulta de tiles. Fuera de limites = solido (el borde del nivel es macizo).
// ---------------------------------------------------------------------------

// Id de tile en coordenadas de TILE. Fuera de limites -> T_SOLID.
export function tileIdx(L, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return T_SOLID;
  return L.tiles[ty * L.w + tx];
}

// px de mundo -> id de tile. Fuera de limites -> T_SOLID.
export function tileAt(L, x, y) {
  return tileIdx(L, Math.floor(x / TS), Math.floor(y / TS));
}

// px de mundo -> bloquea el movimiento? Fuera de limites -> true.
export function solidAt(L, x, y) {
  return isSolidTile(tileAt(L, x, y));
}

// coordenadas de TILE -> bloquea? Version rapida para bucles internos.
export function solidTile(L, tx, ty) {
  return isSolidTile(tileIdx(L, tx, ty));
}

// ---------------------------------------------------------------------------
// Raycast DDA (Amanatides-Woo) contra el tilemap.
// ---------------------------------------------------------------------------

// Scratch de modulo: raycast() NUNCA asigna. El llamador debe copiar hit/x/y/nx/
// ny/dist antes de volver a llamar, porque el siguiente raycast lo sobrescribe.
const _ray = { hit: false, x: 0, y: 0, nx: 0, ny: 0, dist: 0 };

// DDA desde (x0,y0) en direccion (dx,dy) NORMALIZADA hasta maxDist px.
// Devuelve el scratch de modulo _ray (ver aviso arriba). hit=false => fallo.
// Si el origen ya esta dentro de un solido devuelve hit=true dist=0 normal 0,0.
export function raycast(L, x0, y0, dx, dy, maxDist) {
  let cx = Math.floor(x0 / TS), cy = Math.floor(y0 / TS);
  if (solidTile(L, cx, cy)) {
    _ray.hit = true; _ray.x = x0; _ray.y = y0; _ray.nx = 0; _ray.ny = 0; _ray.dist = 0;
    return _ray;
  }
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const idx = dx !== 0 ? Math.abs(TS / dx) : 1e30;
  const idy = dy !== 0 ? Math.abs(TS / dy) : 1e30;
  let tx = dx !== 0 ? ((dx > 0 ? (cx + 1) * TS - x0 : x0 - cx * TS) / Math.abs(dx)) : 1e30;
  let ty = dy !== 0 ? ((dy > 0 ? (cy + 1) * TS - y0 : y0 - cy * TS) / Math.abs(dy)) : 1e30;
  let t = 0, face = 0;
  // Tope duro de 256 pasos: un vector de direccion degenerado (0,0) no puede
  // colgar el bucle nunca.
  for (let gstep = 0; gstep < 256; gstep++) {
    if (tx < ty) { t = tx; tx += idx; cx += sx; face = 0; }
    else         { t = ty; ty += idy; cy += sy; face = 1; }
    if (t > maxDist) { _ray.hit = false; _ray.dist = -1; return _ray; }
    if (solidTile(L, cx, cy)) {
      _ray.hit = true;
      _ray.x = x0 + dx * t; _ray.y = y0 + dy * t;
      _ray.nx = face === 0 ? -sx : 0;
      _ray.ny = face === 1 ? -sy : 0;
      _ray.dist = t;
      return _ray;
    }
  }
  _ray.hit = false; _ray.dist = -1;
  return _ray;
}

// Linea de vision entre dos puntos del mundo: true si ninguna pared se cruza.
// Usa raycast internamente, asi que TAMBIEN pisa el scratch _ray.
export function lineOfSight(L, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return true;
  const h = raycast(L, x0, y0, dx / d, dy / d, d);
  return !h.hit;
}

// ---------------------------------------------------------------------------
// Generacion del nivel
// ---------------------------------------------------------------------------

// Rampa de tamano del diseno, topada a profundidad 6: mas alla solo se anade
// caminata, y caminar no es lo divertido.
function levelW(d) { return Math.min(MAXW, 32 + Math.min(d, 6) * 2); }
// Tope duro en 88: el canon fija el nivel maximo en 44x88 tiles = 1056x2112 px,
// que es lo que dimensiona el canvas horneado y la capa de sangre.
function levelH(d) { return Math.min(MAXH, 72 + Math.min(d, 6) * 3); }
function roomTarget(d) { return 10 + Math.round(Math.min(d, 6) * 2.667); }

// Buffers de trabajo de la generacion. Se reservan al tamano maximo posible
// (44x88) una sola vez y se reutilizan en cada intento y en cada nivel, asi que
// regenerar tras una muerte no asigna ni un byte.
const MAXW = 44, MAXH = 88, MAXN = MAXW * MAXH;
const _seen = new Uint8Array(MAXN);
const _dist = new Int32Array(MAXN);
const _distE = new Int32Array(MAXN);
const _distX = new Int32Array(MAXN);
const _queue = new Int32Array(MAXN);

// Salas y hojas BSP preasignadas: objetos reutilizados, nunca literales.
const MAXROOMS = 40;
const _leaves = new Array(MAXROOMS * 2);
for (let i = 0; i < _leaves.length; i++) _leaves[i] = { x: 0, y: 0, w: 0, h: 0 };
let _nLeaves = 0;

const _rooms = new Array(MAXROOMS);
for (let i = 0; i < MAXROOMS; i++) {
  _rooms[i] = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, kind: 0, alarm: -1, used: 0 };
}
let _nRooms = 0;

const MAXPIPES = 6;
const _pipes = new Array(MAXPIPES);
for (let i = 0; i < MAXPIPES; i++) {
  _pipes[i] = { x: 0, y0: 0, y1: 0, cx: 0, topY: 0, botY: 0, saving: 0, used: 0 };
}
let _nPipes = 0;

// Candidatos de tuberia: se reserva el maximo teorico y se reutiliza.
const MAXCAND = 256;
const _cand = new Array(MAXCAND);
for (let i = 0; i < MAXCAND; i++) _cand[i] = { col: 0, yA: 0, yB: 0, saving: 0, len: 0 };
let _nCand = 0;

// El nivel devuelto: UN solo objeto de modulo reutilizado. genLevel() lo
// rellena; el juego lo guarda por referencia y sobrevive a un reset de nivel.
const _level = {
  w: 0, h: 0, tiles: new Uint8Array(MAXN),
  pxW: 0, pxH: 0,
  spawnX: 0, spawnY: 0, exitX: 0, exitY: 0,
  spawnTX: 0, spawnTY: 0, exitTX: 0, exitTY: 0,
  rooms: null, nRooms: 0,
  pipes: null, nPipes: 0,
  levelIndex: 0, seed: 0, attempts: 0, fallback: false,
  // Vencimiento de espuma acida por tile (numero de frame). Ver foamBlocks().
  foam: new Uint16Array(MAXN),
  frame: 0,
};

// Flood fill de 4 vecinos desde una celda. Escribe en _seen y devuelve el
// numero de celdas alcanzadas. usePipes incluye PIPE/MOUTH en el grafo.
function flood(tiles, w, h, start, usePipes) {
  const n = w * h;
  _seen.fill(0, 0, n);
  let qh = 0, qt = 0;
  _queue[qt++] = start; _seen[start] = 1;
  let count = 1;
  while (qh < qt) {
    const p = _queue[qh++], x = p % w, y = (p / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (_seen[np]) continue;
      const t = tiles[np];
      if (!(walkable(t) || (usePipes && (t === T_PIPE || t === T_MOUTH)))) continue;
      _seen[np] = 1; _queue[qt++] = np; count++;
    }
  }
  return count;
}

// BFS de distancias en tiles. Escribe en el Int32Array `out` (-1 = inalcanzable).
function bfsDist(tiles, w, h, start, usePipes, out) {
  const n = w * h;
  out.fill(-1, 0, n);
  let qh = 0, qt = 0;
  _queue[qt++] = start; out[start] = 0;
  while (qh < qt) {
    const p = _queue[qh++], x = p % w, y = (p / w) | 0;
    const nd = out[p] + 1;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (out[np] >= 0) continue;
      const t = tiles[np];
      if (!(walkable(t) || (usePipes && (t === T_PIPE || t === T_MOUTH)))) continue;
      out[np] = nd; _queue[qt++] = np;
    }
  }
}

// Particion BSP: parte siempre la hoja de mayor area hasta llegar al objetivo.
// Mas predecible que una recursion a profundidad fija, que en un mapa de 32
// tiles de ancho se queda en 8 hojas y produce salas gigantes vacias.
function bspSplit(rnd, W, H, want) {
  _nLeaves = 1;
  const L0 = _leaves[0];
  L0.x = 1; L0.y = 1; L0.w = W - 2; L0.h = H - 2;
  const MINL = 7;
  let guard = 0;
  while (_nLeaves < want && _nLeaves < _leaves.length - 1 && guard++ < 400) {
    let bi = -1, ba = 0;
    for (let i = 0; i < _nLeaves; i++) {
      const L = _leaves[i];
      if (L.w < MINL * 2 && L.h < MINL * 2) continue;
      const a = L.w * L.h;
      if (a > ba) { ba = a; bi = i; }
    }
    if (bi < 0) break;
    const L = _leaves[bi];
    const canV = L.w >= MINL * 2, canH = L.h >= MINL * 2;
    const vert = canV && (!canH || L.w / L.h > 0.75);
    const A = L, B = _leaves[_nLeaves];
    if (vert) {
      const c = Math.floor(L.w * (0.38 + rnd() * 0.24));
      if (c < MINL || L.w - c < MINL) break;
      B.x = L.x + c; B.y = L.y; B.w = L.w - c; B.h = L.h;
      A.w = c;
    } else {
      const c = Math.floor(L.h * (0.38 + rnd() * 0.24));
      if (c < MINL || L.h - c < MINL) break;
      B.x = L.x; B.y = L.y + c; B.w = L.w; B.h = L.h - c;
      A.h = c;
    }
    _nLeaves++;
  }
}

// Un intento de construccion. Devuelve true si el nivel es valido.
// EL ORDEN DE LOS CINCO PASOS ES ESTRUCTURAL, no cosmetico:
// A particion, B conexion, C entrada/salida, D flood fill de validacion,
// E tuberias (solo sobre SOLID) + decoracion + borde + segundo flood fill.
// Tallar tuberias antes de validar puede cortar corredores; restringir el
// tallado a tiles SOLID hace imposible desconectar el grafo por construccion.
function buildAttempt(rnd, levelIndex, tiles) {
  const W = levelW(levelIndex), H = levelH(levelIndex);
  const n = W * H;
  tiles.fill(T_SOLID, 0, n);
  const IX = (x, y) => y * W + x;

  // --- A: BSP, una sala por hoja ---
  bspSplit(rnd, W, H, roomTarget(levelIndex));
  _nRooms = 0;
  for (let i = 0; i < _nLeaves && _nRooms < MAXROOMS; i++) {
    const L = _leaves[i];
    const maxW = L.w - 2, maxH = L.h - 2;
    if (maxW < 4 || maxH < 4) continue;
    // ALTURA MINIMA 5 TILES = 120px de vano libre. La cuerda va de 40 a 156px,
    // asi que por debajo de eso no cabe ni medio arco de pendulo y la sala se
    // convierte en un pasillo donde solo se puede caminar.
    const rw = Math.min(maxW, 5 + rnd.int(0, 4));
    const rh = Math.min(maxH, Math.max(5, 5 + rnd.int(0, 5)));
    if (rh < 5) continue;                       // hoja demasiado plana: se salta
    const rx = L.x + 1 + rnd.int(0, L.w - rw - 2);
    const ry = L.y + 1 + rnd.int(0, L.h - rh - 2);
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) tiles[IX(x, y)] = T_FLOOR;
    }
    const R = _rooms[_nRooms++];
    R.x = rx; R.y = ry; R.w = rw; R.h = rh;
    R.cx = rx + (rw >> 1); R.cy = ry + (rh >> 1);
    R.kind = 0; R.alarm = -1; R.used = 0;
  }
  if (_nRooms < 6) return false;

  // Ordenar por cy: la entrada queda arriba y la salida abajo, asi la direccion
  // de progreso del nivel es siempre "hacia abajo" y se lee sin explicacion.
  for (let i = 1; i < _nRooms; i++) {
    const R = _rooms[i];
    let j = i - 1;
    while (j >= 0 && _rooms[j].cy > R.cy) { _rooms[j + 1] = _rooms[j]; j--; }
    _rooms[j + 1] = R;
  }

  // --- B: MST del vecino mas cercano + corredores en bucle ---
  // ANCHO MINIMO 3 TILES = 72px. Con 2 tiles (48px) el cuerpo del simbionte,
  // que mide ~60px de ancho, no pasa balanceandose: el pasillo borraria el
  // verbo principal del juego y ella tendria que caminar todo el nivel.
  const CORR = 3;
  const carveH = (x0, x1, y) => {
    const a = x0 < x1 ? x0 : x1, b = x0 < x1 ? x1 : x0;
    for (let x = a; x <= b; x++) {
      if (x < 1 || x >= W - 1) continue;
      for (let k = -1; k <= CORR - 2; k++) {
        const yy = y + k;
        if (yy < 1 || yy >= H - 1) continue;
        if (tiles[IX(x, yy)] === T_SOLID) tiles[IX(x, yy)] = T_FLOOR;
      }
    }
  };
  const carveV = (y0, y1, x) => {
    const a = y0 < y1 ? y0 : y1, b = y0 < y1 ? y1 : y0;
    for (let y = a; y <= b; y++) {
      if (y < 1 || y >= H - 1) continue;
      for (let k = -1; k <= CORR - 2; k++) {
        const xx = x + k;
        if (xx < 1 || xx >= W - 1) continue;
        if (tiles[IX(xx, y)] === T_SOLID) tiles[IX(xx, y)] = T_FLOOR;
      }
    }
  };
  const connect = (a, b) => {
    if (rnd.chance(0.5)) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
    else                 { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
  };

  // MST con los indices en el propio _seen reutilizado como marca de "dentro".
  _seen.fill(0, 0, _nRooms);
  _seen[0] = 1;
  for (let k = 1; k < _nRooms; k++) {
    let bi = -1, bj = -1, bd = 1e9;
    for (let i = 0; i < _nRooms; i++) {
      if (!_seen[i]) continue;
      for (let j = 0; j < _nRooms; j++) {
        if (_seen[j]) continue;
        const A = _rooms[i], B = _rooms[j];
        const d = Math.abs(A.cx - B.cx) + Math.abs(A.cy - B.cy);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    if (bj < 0) break;
    connect(_rooms[bi], _rooms[bj]);
    _seen[bj] = 1;
  }
  // Bucles: 2+min(d,4) corredores extra para que nunca sea un laberinto de
  // callejones sin salida (donde un cuerpo que va a 900px/s se estrella).
  const loops = 2 + Math.min(levelIndex, 4);
  for (let k = 0; k < loops; k++) {
    const a = rnd.int(0, _nRooms - 1), b = rnd.int(0, _nRooms - 1);
    if (a !== b) connect(_rooms[a], _rooms[b]);
  }

  // --- C: entrada arriba, salida abajo ---
  const entry = _rooms[0], exit = _rooms[_nRooms - 1];
  entry.kind = 1; exit.kind = 2;
  const eIdx = IX(entry.cx, entry.cy), xIdx = IX(exit.cx, exit.cy);
  tiles[eIdx] = T_ENTRY;
  tiles[xIdx] = T_EXIT;

  // --- D: PRIMER flood fill, antes de escribir una sola tuberia ---
  flood(tiles, W, H, eIdx, false);
  if (!_seen[xIdx]) return false;
  // Toda sala debe ser alcanzable o habra enemigos y decoracion en un bolsillo
  // muerto que ella no puede ver nunca.
  for (let i = 0; i < _nRooms; i++) {
    if (!_seen[IX(_rooms[i].cx, _rooms[i].cy)]) return false;
  }

  // Distancias a pie desde entrada y desde salida: sirven para puntuar cuanto
  // ahorra DE VERDAD cada tuberia.
  bfsDist(tiles, W, H, eIdx, false, _distE);
  bfsDist(tiles, W, H, xIdx, false, _distX);
  const walkRoute = _distE[xIdx];
  if (walkRoute < 0) return false;

  // --- E: tuberias. SOLO sobre tiles que ahora mismo son SOLID ---
  // Un pozo se talla desde el primer tile FUERA de cada sala, asi que la boca
  // es adyacente a suelo de sala POR CONSTRUCCION: cero bocas rotas.
  _nCand = 0;
  for (let i = 0; i < _nRooms && _nCand < MAXCAND; i++) {
    for (let j = i + 1; j < _nRooms && _nCand < MAXCAND; j++) {
      const A = _rooms[i], B = _rooms[j];
      const x0 = Math.max(A.x, B.x), x1 = Math.min(A.x + A.w - 1, B.x + B.w - 1);
      if (x1 < x0) continue;                       // sin solape de columnas
      if (Math.abs(A.cy - B.cy) < 10) continue;    // demasiado cerca: no es atajo
      const top = A.cy < B.cy ? A : B, bot = A.cy < B.cy ? B : A;
      const yA = top.y + top.h, yB = bot.y - 1;
      if (yB - yA < 4) continue;
      let col = -1;
      for (let x = x0; x <= x1; x++) {
        let ok = true;
        for (let y = yA; y <= yB; y++) if (tiles[y * W + x] !== T_SOLID) { ok = false; break; }
        if (ok && tiles[(yA - 1) * W + x] === T_FLOOR && tiles[(yB + 1) * W + x] === T_FLOOR) {
          col = x; break;
        }
      }
      if (col < 0) continue;
      const len = yB - yA + 1;
      const a = IX(top.cx, top.cy), b = IX(bot.cx, bot.cy);
      if (_distE[a] < 0 || _distE[b] < 0 || _distX[a] < 0 || _distX[b] < 0) continue;
      const via = Math.min(_distE[a] + len + _distX[b], _distE[b] + len + _distX[a]);
      const C = _cand[_nCand++];
      C.col = col; C.yA = yA; C.yB = yB; C.len = len; C.saving = walkRoute - via;
    }
  }
  // Ordenar por ahorro real y, a igualdad, por longitud (espectaculo).
  // Insercion sobre <=256 elementos y una sola vez por nivel: es gratis.
  for (let i = 1; i < _nCand; i++) {
    const C = _cand[i];
    let j = i - 1;
    while (j >= 0 && (_cand[j].saving < C.saving ||
          (_cand[j].saving === C.saving && _cand[j].len < C.len))) {
      _cand[j + 1] = _cand[j]; j--;
    }
    _cand[j + 1] = C;
  }
  const wantPipes = 2 + Math.min(levelIndex, 3);
  _nPipes = 0;
  for (let i = 0; i < _nCand && _nPipes < wantPipes; i++) {
    const C = _cand[i];
    let ok = true;
    for (let y = C.yA; y <= C.yB; y++) if (tiles[y * W + C.col] !== T_SOLID) { ok = false; break; }
    if (!ok) continue;                              // otra tuberia ya paso por aqui
    for (let y = C.yA; y <= C.yB; y++) tiles[y * W + C.col] = T_PIPE;
    tiles[C.yA * W + C.col] = T_MOUTH;
    tiles[C.yB * W + C.col] = T_MOUTH;
    const Pp = _pipes[_nPipes++];
    Pp.x = C.col; Pp.y0 = C.yA; Pp.y1 = C.yB;
    Pp.cx = C.col * TS + TS * 0.5;
    Pp.topY = C.yA * TS + TS * 0.5;
    Pp.botY = C.yB * TS + TS * 0.5;
    Pp.saving = C.saving; Pp.used = 0;
  }

  // Zona franca alrededor de las bocas: ninguna decoracion puede caer en el
  // tile de suelo justo fuera de una boca. Funcionalmente da igual (puerta y
  // acido son transitables) pero visualmente una boca debe abrirse a suelo liso
  // para que se lea como entrada y no como un charco raro.
  const mouthClear = (x, y) => {
    for (let i = 0; i < _nPipes; i++) {
      const Pp = _pipes[i];
      if (x !== Pp.x) continue;
      if (y === Pp.y0 - 1 || y === Pp.y1 + 1) return true;
    }
    return false;
  };

  // Decoracion. TODO lo de aqui es NO BLOQUEANTE por definicion: cristal y
  // acido son transitables, la puerta es transitable, la alarma es un mueble.
  for (let i = 0; i < _nRooms; i++) {
    const R = _rooms[i];
    if (R.kind !== 0) continue;
    // Cristal en la pared superior del 45% de las salas: entradas dramaticas.
    if (rnd.chance(0.45)) {
      const y = R.y - 1;
      if (y >= 1) for (let x = R.x; x < R.x + R.w; x++) {
        if (tiles[IX(x, y)] === T_SOLID) tiles[IX(x, y)] = T_GLASS;
      }
    }
    // Un tile de acido en el 30%: castiga el balanceo descuidado, nunca atrapa.
    if (rnd.chance(0.30)) {
      const hx = R.x + rnd.int(0, R.w - 1), hy = R.y + rnd.int(0, R.h - 1);
      if (tiles[IX(hx, hy)] === T_FLOOR && !mouthClear(hx, hy)) tiles[IX(hx, hy)] = T_HAZARD;
    }
    // Puerta en el borde de sala: teatro de alarma, no barrera.
    if (rnd.chance(0.35)) {
      const dx = R.x + rnd.int(0, R.w - 1);
      const dy = rnd.chance(0.5) ? R.y : R.y + R.h - 1;
      if (tiles[IX(dx, dy)] === T_FLOOR && !mouthClear(dx, dy)) tiles[IX(dx, dy)] = T_DOOR;
    }
    // Panel de alarma: una posicion en el mundo, no un tile. Es lo que corre a
    // pulsar el cientifico. -1 = esta sala no tiene.
    if (rnd.chance(0.5)) {
      R.alarm = IX(R.x + rnd.int(0, R.w - 1), R.y + rnd.int(0, R.h - 1));
    } else R.alarm = -1;
  }

  // Sellar el borde: nada puede salirse del mapa.
  for (let x = 0; x < W; x++) { tiles[IX(x, 0)] = T_SOLID; tiles[IX(x, H - 1)] = T_SOLID; }
  for (let y = 0; y < H; y++) { tiles[IX(0, y)] = T_SOLID; tiles[IX(W - 1, y)] = T_SOLID; }

  // --- SEGUNDO flood fill: la asercion en tiempo de ejecucion ---
  flood(tiles, W, H, eIdx, false);
  if (!_seen[xIdx]) return false;

  _level.w = W; _level.h = H;
  _level.pxW = W * TS; _level.pxH = H * TS;
  _level.spawnTX = entry.cx; _level.spawnTY = entry.cy;
  _level.exitTX = exit.cx; _level.exitTY = exit.cy;
  _level.spawnX = entry.cx * TS + TS * 0.5;
  _level.spawnY = entry.cy * TS + TS * 0.5;
  _level.exitX = exit.cx * TS + TS * 0.5;
  _level.exitY = exit.cy * TS + TS * 0.5;
  _level.nRooms = _nRooms; _level.nPipes = _nPipes;
  return true;
}

// Plan B garantizado: un pozo vertical con salas conectadas a lo largo. Feo
// pero SIEMPRE jugable. genLevel jamas debe devolver null: un nivel que ella
// no puede terminar es el peor bug posible.
function buildFallback(levelIndex, tiles) {
  const W = levelW(levelIndex), H = levelH(levelIndex);
  const n = W * H;
  tiles.fill(T_SOLID, 0, n);
  const IX = (x, y) => y * W + x;
  const cx = W >> 1;
  for (let y = 3; y < H - 3; y++) { tiles[IX(cx, y)] = T_FLOOR; tiles[IX(cx - 1, y)] = T_FLOOR; }
  _nRooms = 0;
  const step = 8;
  for (let y = 4; y < H - 6 && _nRooms < MAXROOMS; y += step) {
    const rw = 6, rh = 5;
    const rx = clamp(cx - 3 + ((_nRooms & 1) ? 3 : -3), 2, W - rw - 2);
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = rx; xx < rx + rw; xx++) tiles[IX(xx, yy)] = T_FLOOR;
      // Pasillo hasta el pozo central
      const a = Math.min(rx + rw - 1, cx - 1), b = Math.max(rx, cx);
      for (let xx = a; xx <= b; xx++) tiles[IX(xx, y + 2)] = T_FLOOR;
    }
    const R = _rooms[_nRooms++];
    R.x = rx; R.y = y; R.w = rw; R.h = rh;
    R.cx = rx + 3; R.cy = y + 2; R.kind = 0; R.alarm = -1; R.used = 0;
  }
  if (_nRooms < 2) {
    // Imposible en la practica (H>=72), pero deja el mapa en estado coherente.
    _nRooms = 0;
    for (let y = 3; y < H - 3; y++) for (let x = 2; x < W - 2; x++) tiles[IX(x, y)] = T_FLOOR;
    const R = _rooms[_nRooms++];
    R.x = 2; R.y = 3; R.w = W - 4; R.h = H - 6; R.cx = cx; R.cy = 5; R.kind = 1; R.alarm = -1; R.used = 0;
    const R2 = _rooms[_nRooms++];
    R2.x = 2; R2.y = H - 8; R2.w = W - 4; R2.h = 4; R2.cx = cx; R2.cy = H - 6; R2.kind = 2; R2.alarm = -1; R2.used = 0;
  }
  const entry = _rooms[0], exit = _rooms[_nRooms - 1];
  entry.kind = 1; exit.kind = 2;
  tiles[IX(entry.cx, entry.cy)] = T_ENTRY;
  tiles[IX(exit.cx, exit.cy)] = T_EXIT;
  for (let x = 0; x < W; x++) { tiles[IX(x, 0)] = T_SOLID; tiles[IX(x, H - 1)] = T_SOLID; }
  for (let y = 0; y < H; y++) { tiles[IX(0, y)] = T_SOLID; tiles[IX(W - 1, y)] = T_SOLID; }
  _nPipes = 0;

  _level.w = W; _level.h = H;
  _level.pxW = W * TS; _level.pxH = H * TS;
  _level.spawnTX = entry.cx; _level.spawnTY = entry.cy;
  _level.exitTX = exit.cx; _level.exitTY = exit.cy;
  _level.spawnX = entry.cx * TS + TS * 0.5;
  _level.spawnY = entry.cy * TS + TS * 0.5;
  _level.exitX = exit.cx * TS + TS * 0.5;
  _level.exitY = exit.cy * TS + TS * 0.5;
  _level.nRooms = _nRooms; _level.nPipes = _nPipes;
}

// Genera un nivel. `rnd` es el RNG sembrado del juego (nunca Math.random).
// Devuelve SIEMPRE un nivel valido: 12 intentos con la semilla desplazada por
// 0x9e3779b9 y, si todos fallan, un pozo vertical garantizado.
// El objeto devuelto es de modulo y se reutiliza en cada llamada.
export function genLevel(rnd, levelIndex) {
  const seed0 = (rnd() * 4294967296) >>> 0;
  let ok = false, a = 0;
  for (; a < 12 && !ok; a++) {
    // RNG local por intento: la misma semilla da el mismo nivel, asi que un
    // reintento tras morir reconstruye el nivel identico sin guardar el mapa.
    const r = makeAttemptRng((seed0 + a * 0x9e3779b9) >>> 0);
    ok = buildAttempt(r, levelIndex, _level.tiles);
  }
  if (!ok) { buildFallback(levelIndex, _level.tiles); _level.fallback = true; }
  else _level.fallback = false;
  _level.attempts = a;
  _level.seed = seed0;
  _level.levelIndex = levelIndex;
  _level.rooms = _rooms; _level.pipes = _pipes;
  _level.foam.fill(0, 0, _level.w * _level.h);
  _level.frame = 0;
  // Campo de ruta a la salida: se calcula UNA vez aqui, nunca por frame.
  buildRouteField(_level);
  // GARANTIA DE APERTURA: pared colgable a la vista del punto de entrada. Sin
  // esto los primeros 10 segundos pueden ser una sala rasa sin nada que hacer.
  ensureSwingableSpawn(_level);
  // Copia independiente: _level es un objeto de modulo reusado, asi que generar
  // el nivel 2 sobrescribiria el nivel 1 mientras el juego todavia lo usa
  // (salida y tiles cambiaban bajo los pies de la jugadora).
  return cloneLevel(_level);
}

// Copia profunda de lo que el juego consulta despues de generar.
function cloneLevel(L) {
  const out = {};
  for (const k in L) {
    const v = L[k];
    if (v instanceof Uint8Array) out[k] = new Uint8Array(v);
    else if (v instanceof Int8Array) out[k] = new Int8Array(v);
    else if (v instanceof Int16Array) out[k] = new Int16Array(v);
    else if (v instanceof Int32Array) out[k] = new Int32Array(v);
    else if (v instanceof Uint16Array) out[k] = new Uint16Array(v);
    else if (v instanceof Uint32Array) out[k] = new Uint32Array(v);
    else if (v instanceof Float32Array) out[k] = new Float32Array(v);
    else if (Array.isArray(v)) out[k] = v.slice();
    else out[k] = v;
  }
  return out;
}

// Comprueba que desde el spawn hay al menos un ancla de tentaculo dentro del
// alcance de 240px lanzando 16 rayos en abanico. Si no la hay, sube el techo de
// la sala de entrada un tile (siempre es SOLID por encima) y vuelve a mirar.
// Solo toca tiles YA solidos y jamas rompe la conectividad.
function ensureSwingableSpawn(L) {
  L.swingOK = false;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const h = raycast(L, L.spawnX, L.spawnY, Math.cos(a), Math.sin(a), 240);
      if (h.hit && h.dist > 40) { L.swingOK = true; return; }
    }
    // Pase 2: abre el techo de la sala de entrada para que el vano sea de al
    // menos 5 tiles y quepa un arco de pendulo completo.
    const R = L.rooms[0];
    const top = R.y - 1;
    if (top >= 2) {
      for (let x = R.x; x < R.x + R.w; x++) {
        if (L.tiles[top * L.w + x] === T_SOLID) L.tiles[top * L.w + x] = T_FLOOR;
      }
      R.y = top; R.h += 1; R.cy = R.y + (R.h >> 1);
    } else break;
  }
  // Con el borde sellado siempre hay pared en algun sitio; este flag solo dice
  // si la habia YA a tiro desde el spawn.
  L.swingOK = true;
}

// xorshift32 identico al de core.js, para que un intento sea reproducible sin
// consumir el RNG del juego.
function makeAttemptRng(seed) {
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

// Comprueba que la salida es alcanzable desde el spawn. El juego puede llamarla
// como asercion; genLevel ya la garantiza. usePipes incluye la red de tuberias.
export function exitReachable(L, usePipes) {
  flood(L.tiles, L.w, L.h, L.spawnTY * L.w + L.spawnTX, !!usePipes);
  return _seen[L.exitTY * L.w + L.exitTX] === 1;
}

// Distancia a pie en tiles del spawn a la salida (-1 si no hay ruta).
export function walkRouteLength(L) {
  bfsDist(L.tiles, L.w, L.h, L.spawnTY * L.w + L.spawnTX, false, _dist);
  return _dist[L.exitTY * L.w + L.exitTX];
}

// ---------------------------------------------------------------------------
// Tuberias: rail 1-D, no fisica.
// ---------------------------------------------------------------------------

// Boca de tuberia dentro de `r` px de (x,y). Devuelve el indice de tuberia y
// escribe cual extremo en _pipeEnd (0 = arriba, 1 = abajo). -1 si ninguna.
let _pipeEnd = 0;
export function pipeMouthNear(L, x, y, r) {
  const r2 = r * r;
  let best = -1, bd = r2;
  for (let i = 0; i < L.nPipes; i++) {
    const p = L.pipes[i];
    let dx = x - p.cx, dy = y - p.topY;
    let d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; _pipeEnd = 0; }
    dy = y - p.botY; d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; _pipeEnd = 1; }
  }
  return best;
}

// Extremo de la ultima pipeMouthNear con exito: 0 arriba, 1 abajo.
export function pipeMouthEnd() { return _pipeEnd; }

// Velocidad de recorrido dentro de la tuberia (px/s). 2.44x la caminata de
// 78px/s, que es lo que convierte un pozo de 20 tiles en ~2.1s ahorrados.
export const PIPE_SPEED = 190;

// DESGASTE DENTRO DE LA TUBERIA: 4 de vida por segundo. Los enemigos no pueden
// entrar, asi que sin esto una tuberia seria un refugio infinito donde
// atrincherarse sin riesgo y esperar. Con el desgaste sirve para reposicionarse
// (los ~3s de un pozo largo cuestan 12 de vida, menos de una bala) pero nunca
// para esconderse. El modulo del juego ademas no avanza el cronometro de
// progreso mientras ella este dentro.
export const PIPE_DRAIN = 4;

// Dano acumulado por estar dentro de una tuberia durante dt segundos.
export function pipeDrain(dt) { return PIPE_DRAIN * dt; }

// Avanza al jugador por el rail. `pos` es la Y actual en px de mundo, `sy` la
// componente Y del stick. Devuelve la nueva Y, ya recortada al pozo.
// El x se fija en p.cx por el llamador: dentro no hay ningun caso de colision,
// que es exactamente por lo que puede ser rapido Y fiable a la vez.
export function pipeAdvance(L, pipeIndex, pos, sy, dt) {
  const p = L.pipes[pipeIndex];
  return clamp(pos + sy * PIPE_SPEED * dt, p.topY, p.botY);
}

// true si el jugador llego a un extremo del pozo (hay que expulsarlo).
export function pipeAtEnd(L, pipeIndex, pos) {
  const p = L.pipes[pipeIndex];
  return pos <= p.topY + 0.5 || pos >= p.botY - 0.5;
}

// ---------------------------------------------------------------------------
// Espuma del hazmat: niega el anclaje de tentaculo por tile durante 6s.
// Se guarda un numero de frame de vencimiento en un Uint16Array, comparado con
// un contador global: cero trabajo por frame, ninguna asignacion, nunca una
// lista de objetos de espuma.
// ---------------------------------------------------------------------------
const FOAM_FRAMES = 360;   // 6s a 60Hz

// Marca un tile como cubierto de espuma durante 6 segundos.
export function foamTile(L, tx, ty) {
  if (tx < 1 || ty < 1 || tx >= L.w - 1 || ty >= L.h - 1) return;
  // El contador es Uint16 y da la vuelta cada ~18 min; se guarda +1 para que 0
  // signifique siempre "sin espuma".
  L.foam[ty * L.w + tx] = ((L.frame + FOAM_FRAMES) % 65535) + 1;
}

// true si ese tile no admite anclaje de tentaculo ahora mismo.
export function foamBlocks(L, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return false;
  const v = L.foam[ty * L.w + tx];
  if (v === 0) return false;
  const now = (L.frame % 65535) + 1;
  const d = v - now;
  return d > 0 && d <= FOAM_FRAMES;
}

// Rompe un cristal: pasa a suelo y devuelve true (el llamador repinta ese tile).
export function shatterGlass(L, tx, ty) {
  if (tileIdx(L, tx, ty) !== T_GLASS) return false;
  L.tiles[ty * L.w + tx] = T_FLOOR;
  return true;
}

// Rompe una pared (carga del enforcer). Devuelve true si algo cambio; el
// llamador debe repintar SOLO ese tile en el canvas horneado, nunca rehacerlo.
export function shatterWall(L, tx, ty) {
  // El borde nunca se rompe: seria un agujero al vacio fuera del mapa.
  if (tx < 1 || ty < 1 || tx >= L.w - 1 || ty >= L.h - 1) return false;
  if (L.tiles[ty * L.w + tx] !== T_SOLID) return false;
  L.tiles[ty * L.w + tx] = T_FLOOR;
  return true;
}

// ---------------------------------------------------------------------------
// Horneado de tiles y pintado del nivel
// ---------------------------------------------------------------------------

// 12x12 de arte por tile, horneado a escala 2 = 24px = TS. Se hornea UNA vez.
const A_FLOOR = [
  '111111111111','122222222221','122222222221','122222222221',
  '122222222221','122222222221','122222222221','122222222221',
  '122222222221','122222222221','122222222221','111111111111',
];
const A_WALL = [
  '333333333333','344444444443','344444444443','344444444443',
  '344444444443','333333333333','334444444433','334444444433',
  '334444444433','334444444433','334444444433','333333333333',
];
const A_GLASS = [
  '555555555555','566666666665','567666666665','566666666665',
  '566666666665','566666666665','566666666665','566666666665',
  '566666666765','566666666665','566666666665','555555555555',
];
const A_HAZARD = [
  '111111111111','188888888881','189999999881','188999998881',
  '189999999981','188899999881','189999998881','188999999981',
  '189998999881','188999998881','188888888881','111111111111',
];
const A_DOOR = [
  'aaaaaaaaaaaa','abbbbbbbbbba','abbccccccbba','abbccccccbba',
  'abbccccccbba','abbbbbbbbbba','abbbbbbbbbba','abbccccccbba',
  'abbccccccbba','abbccccccbba','abbbbbbbbbba','aaaaaaaaaaaa',
];
const A_EXIT = [
  '111111111111','1dddddddddd1','1deeeeeeeed1','1dee1111eed1',
  '1de111111ed1','1de1eeee1ed1','1de1eeee1ed1','1de111111ed1',
  '1dee1111eed1','1deeeeeeeed1','1dddddddddd1','111111111111',
];
const A_ENTRY = [
  '111111111111','122222222221','12222ff22221','1222ffff2221',
  '122ffffff221','122222222221','122222222221','122ffffff221',
  '1222ffff2221','12222ff22221','122222222221','111111111111',
];
const A_PIPE = [
  'gghhhhhhhhgg','ghiiiiiiiihg','ghiiiiiiiihg','ghiiiiiiiihg',
  'ghiiiiiiiihg','ghiiiiiiiihg','ghiiiiiiiihg','ghiiiiiiiihg',
  'ghiiiiiiiihg','ghiiiiiiiihg','ghiiiiiiiihg','gghhhhhhhhgg',
];
const A_MOUTH = [
  'gggggggggggg','ghhhhhhhhhhg','ghiiiiiiiihg','ghiijjjjiihg',
  'ghijjjjjjihg','ghijjjjjjihg','ghijjjjjjihg','ghijjjjjjihg',
  'ghiijjjjiihg','ghiiiiiiiihg','ghhhhhhhhhhg','gggggggggggg',
];
const TMAP = {
  '1': P.grout,  '2': P.floor,   '3': P.wallDark, '4': P.wall,
  '5': P.visor,  '6': P.labLight,'7': P.white,    '8': P.greenDeep,
  '9': P.greenMid,'a': P.deep,   'b': P.wallMid,  'c': P.shadow,
  'd': P.gold,   'e': P.green,   'f': P.deep,
  'g': P.pipeMet,'h': P.nearBlk, 'i': P.pipeIn,   'j': P.darkest,
};

// Sprites horneados de tile, indexados por tipo. null = no se dibuja.
let TILE_SPR = null;
// Rejilla del cristal roto, foam y flechas de tuberia: se hornean tambien.
let FOAM_SPR = null, ARROW_UP = null, ARROW_DN = null, ALARM_SPR = null;

// Hornea todo el arte de tiles y enemigos. Llamar UNA vez desde init().
// Es idempotente: si ya se horneo, no hace nada.
export function bakeTiles() {
  if (TILE_SPR) return;
  TILE_SPR = new Array(10).fill(null);
  TILE_SPR[T_FLOOR]  = bake(A_FLOOR,  TMAP, 2);
  TILE_SPR[T_GLASS]  = bake(A_GLASS,  TMAP, 2);
  TILE_SPR[T_HAZARD] = bake(A_HAZARD, TMAP, 2);
  TILE_SPR[T_DOOR]   = bake(A_DOOR,   TMAP, 2);
  TILE_SPR[T_EXIT]   = bake(A_EXIT,   TMAP, 2);
  TILE_SPR[T_ENTRY]  = bake(A_ENTRY,  TMAP, 2);
  TILE_SPR[T_PIPE]   = bake(A_PIPE,   TMAP, 2);
  TILE_SPR[T_MOUTH]  = bake(A_MOUTH,  TMAP, 2);
  TILE_SPR[T_SOLID]  = bake(A_WALL,   TMAP, 2);
  TILE_SPR[T_VENT]   = TILE_SPR[T_SOLID];
  FOAM_SPR = bake([
    '.11111111111.','1223232232321','1232323323231','1233232232321',
    '1232332323231','1223232332321','1232323223231','.11111111111.',
  ], { '1': P.greenMid, '2': P.green, '3': P.greenDeep }, 2);
  ARROW_UP = bake([
    '...11...','..1221..','.122221.','12222221',
    '..1221..','..1221..','..1221..','..1111..',
  ], { '1': P.out, '2': P.green }, 2);
  ARROW_DN = bake([
    '..1111..','..1221..','..1221..','..1221..',
    '12222221','.122221.','..1221..','...11...',
  ], { '1': P.out, '2': P.green }, 2);
  ALARM_SPR = bake([
    '11111111','12222221','12333321','12344321',
    '12344321','12333321','12222221','11111111',
  ], { '1': P.out, '2': P.wallMid, '3': P.orange, '4': P.bright }, 2);
  bakeEnemyArt();
}

// Hornea el nivel entero en un canvas offscreen a escala 1:1 virtual (max
// 1056x2112 = 8.5 MB) para blitear el rectangulo visible con UN drawImage de 9
// argumentos por frame, en vez de ~1100 blits por tile.
export function bakeLevelCanvas(L) {
  bakeTiles();
  const cv = document.createElement('canvas');
  cv.width = L.pxW; cv.height = L.pxH;
  const c = cv.getContext('2d', { alpha: false });
  c.imageSmoothingEnabled = false;
  c.fillStyle = P.darkest;
  c.fillRect(0, 0, L.pxW, L.pxH);
  for (let ty = 0; ty < L.h; ty++) {
    for (let tx = 0; tx < L.w; tx++) {
      const s = TILE_SPR[L.tiles[ty * L.w + tx]];
      if (s) c.drawImage(s, tx * TS, ty * TS);
    }
  }
  // Paneles de alarma sobre el suelo de sus salas.
  for (let i = 0; i < L.nRooms; i++) {
    const a = L.rooms[i].alarm;
    if (a < 0) continue;
    const ax = (a % L.w) * TS + TS * 0.5, ay = ((a / L.w) | 0) * TS + TS * 0.5;
    spr(c, ALARM_SPR, ax, ay);
  }
  L.canvas = cv; L.cctx = c;
  return cv;
}

// Repinta UN tile en el canvas horneado (cristal roto, pared reventada por el
// enforcer). Un punado de drawImage en el instante del impacto, nunca rehacer
// el canvas entero.
export function repaintTile(L, tx, ty) {
  if (!L.cctx || tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return;
  const c = L.cctx;
  c.fillStyle = P.darkest;
  c.fillRect(tx * TS, ty * TS, TS, TS);
  const s = TILE_SPR[L.tiles[ty * L.w + tx]];
  if (s) c.drawImage(s, tx * TS, ty * TS);
}

// Dibuja el nivel: un solo blit del rectangulo visible. `cam` es una WorldCam.
// Si por lo que sea no hay canvas horneado, cae a pintar SOLO los tiles
// visibles (nunca el nivel entero).
export function drawLevel(g, L, wcam) {
  const cx = Math.round(wcam.x), cy = Math.round(wcam.y);
  if (L.canvas) {
    g.drawImage(L.canvas, cx, cy, VW, VH, 0, 0, VW, VH);
  } else {
    const t0x = Math.max(0, (cx / TS) | 0), t0y = Math.max(0, (cy / TS) | 0);
    const t1x = Math.min(L.w - 1, ((cx + VW) / TS) | 0);
    const t1y = Math.min(L.h - 1, ((cy + VH) / TS) | 0);
    g.fillStyle = P.darkest;
    g.fillRect(0, 0, VW, VH);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const s = TILE_SPR[L.tiles[ty * L.w + tx]];
        if (s) g.drawImage(s, tx * TS - cx, ty * TS - cy);
      }
    }
  }
  // Espuma acida encima: solo los tiles visibles, y solo los que la tienen.
  const t0x = Math.max(0, (cx / TS) | 0), t0y = Math.max(0, (cy / TS) | 0);
  const t1x = Math.min(L.w - 1, ((cx + VW) / TS) | 0);
  const t1y = Math.min(L.h - 1, ((cy + VH) / TS) | 0);
  for (let ty = t0y; ty <= t1y; ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      if (foamBlocks(L, tx, ty)) {
        g.drawImage(FOAM_SPR, tx * TS - cx + 1, ty * TS - cy + 4);
      }
    }
  }
}

// Dibuja los adornos de tuberia: anillo pulsante en las bocas cercanas y flecha
// que dice a que sala lleva cada extremo. Es lo que hace la red legible DESDE
// FUERA; sin esto una tuberia es un agujero negro y nadie entra dos veces.
export function drawPipeHints(g, L, wcam, px, py, t) {
  const cx = Math.round(wcam.x), cy = Math.round(wcam.y);
  const pulse = 1 + Math.sin(t * 5.0);
  for (let i = 0; i < L.nPipes; i++) {
    const p = L.pipes[i];
    for (let e = 0; e < 2; e++) {
      const mx = p.cx, my = e === 0 ? p.topY : p.botY;
      const dx = mx - px, dy = my - py;
      if (dx * dx + dy * dy > 120 * 120) continue;
      const sx = Math.round(mx - cx), sy = Math.round(my - cy);
      if (sx < -TS || sy < -TS || sx > VW + TS || sy > VH + TS) continue;
      const r = Math.round(9 + pulse * 2);
      g.fillStyle = P.green;
      g.fillRect(sx - r, sy - r, r * 2, 1);
      g.fillRect(sx - r, sy + r, r * 2, 1);
      g.fillRect(sx - r, sy - r, 1, r * 2);
      g.fillRect(sx + r, sy - r, 1, r * 2 + 1);
      spr(g, e === 0 ? ARROW_UP : ARROW_DN, sx, sy + (e === 0 ? -16 : 16));
    }
  }
}

// ---------------------------------------------------------------------------
// Ruta a la salida. La flecha NO puede apuntar en linea recta a la salida: en
// un nivel con pasillos en bucle esa direccion atraviesa muros y la manda
// contra una pared o a un callejon. Se calcula un campo de distancia BFS DESDE
// la salida una sola vez por nivel, y la flecha marca el SIGUIENTE PASO de la
// ruta real, no el rumbo.
// ---------------------------------------------------------------------------

// Campo de distancia en tiles hasta la salida. Se rellena en buildRouteField().
const _toExit = new Int32Array(MAXN);

// Calcula el campo de ruta. Se llama una vez por nivel desde genLevel().
// usePipes=true porque la red de tuberias es ruta legitima.
function buildRouteField(L) {
  bfsDist(L.tiles, L.w, L.h, L.exitTY * L.w + L.exitTX, true, _toExit);
}

// Devuelve el punto de ruta al que hay que ir desde (x,y): el centro del tile
// vecino con MENOR distancia a la salida, mirando en un radio de 3 tiles para
// que la flecha no tiemble de tile en tile. Escribe en el scratch _wp.
// El llamador debe copiar wp.x/wp.y antes de la siguiente llamada.
const _wp = { x: 0, y: 0, dist: -1, valid: false };
export function routeWaypoint(L, x, y) {
  const tx = clamp(Math.floor(x / TS), 0, L.w - 1);
  const ty = clamp(Math.floor(y / TS), 0, L.h - 1);
  let here = _toExit[ty * L.w + tx];
  // Si esta dentro de un muro (recien reventado, o el cuerpo pegado al techo),
  // se busca el tile transitable mas cercano en un anillo de 2.
  if (here < 0) {
    let bd = 1e9, bx = tx, by = ty;
    for (let ry = -2; ry <= 2; ry++) {
      for (let rx = -2; rx <= 2; rx++) {
        const nx = tx + rx, ny = ty + ry;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const v = _toExit[ny * L.w + nx];
        if (v >= 0 && v < bd) { bd = v; bx = nx; by = ny; }
      }
    }
    if (bd > 1e8) { _wp.valid = false; _wp.dist = -1; return _wp; }
    here = bd; _wp.x = bx * TS + TS * 0.5; _wp.y = by * TS + TS * 0.5;
    _wp.dist = here; _wp.valid = true;
    return _wp;
  }
  // Descenso de gradiente hasta 3 tiles: se queda con el mejor del anillo.
  let bd = here, bx = tx, by = ty;
  for (let ry = -3; ry <= 3; ry++) {
    for (let rx = -3; rx <= 3; rx++) {
      const nx = tx + rx, ny = ty + ry;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const v = _toExit[ny * L.w + nx];
      if (v >= 0 && v < bd) { bd = v; bx = nx; by = ny; }
    }
  }
  _wp.x = bx * TS + TS * 0.5; _wp.y = by * TS + TS * 0.5;
  _wp.dist = here; _wp.valid = true;
  return _wp;
}

// Chevron de 18px pegado al borde apuntando al SIGUIENTE NODO DE LA RUTA (no a
// la salida en linea recta), con la distancia real de ruta en tiles. Se oculta
// si la salida ya esta en pantalla. NO es un minimapa: una flecha no hay que
// interpretarla, y una que apunta por la ruta nunca la estrella contra un muro.
// Devuelve la distancia de ruta en tiles (el llamador dibuja el numero).
export function drawExitArrow(g, L, wcam, px, py) {
  const ex = L.exitX, ey = L.exitY;
  const sxe = ex - wcam.x, sye = ey - wcam.y;
  const onScreen = sxe > 0 && sye > 0 && sxe < VW && sye < VH;
  const wp = routeWaypoint(L, px, py);
  const routeTiles = wp.valid ? wp.dist : -1;
  // Direccion: al waypoint de ruta si lo hay; si la ruta esta rota (mapa
  // mutado por una carga), cae al rumbo directo antes que no dibujar nada.
  let dx, dy;
  if (wp.valid && (wp.x !== px || wp.y !== py)) { dx = wp.x - px; dy = wp.y - py; }
  else { dx = ex - px; dy = ey - py; }
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) { dx = ex - px; dy = ey - py; d = Math.sqrt(dx * dx + dy * dy); }
  if (onScreen || d < 1) return -1;
  const M = 26;
  const cxs = VW * 0.5, cys = VH * 0.5;
  // Recorte del rayo desde el centro de la pantalla contra el marco interior.
  const ux = dx / d, uy = dy / d;
  let k = 1e9;
  if (ux > 0.0001) k = Math.min(k, (VW - M - cxs) / ux);
  else if (ux < -0.0001) k = Math.min(k, (M - cxs) / ux);
  if (uy > 0.0001) k = Math.min(k, (VH - M - cys) / uy);
  else if (uy < -0.0001) k = Math.min(k, (M - cys) / uy);
  const ax = Math.round(cxs + ux * k), ay = Math.round(cys + uy * k);
  // Tinte cian -> blanco segun se acorta la RUTA (no el rumbo): asi el color
  // dice cuanto falta de verdad, no cuanto falta en linea recta.
  const rt = routeTiles >= 0 ? routeTiles : Math.round(d / TS);
  g.fillStyle = rt < 16 ? P.white : P.visor;
  // Triangulo de 18px dibujado como filas de fillRect (nada de path ni arc).
  for (let i = 0; i < 9; i++) {
    const w = 2 * (9 - i);
    const ox = Math.round(ux * (9 - i)), oy = Math.round(uy * (9 - i));
    g.fillRect(ax + ox - (w >> 1), ay + oy - 1, w, 2);
  }
  return rt;
}

// ---------------------------------------------------------------------------
// Camara del mundo. La `cam` compartida del motor es SOLO SHAKE: su update()
// pisa x/y con offsets aleatorios cada frame, asi que cualquier scroll escrito
// ahi se destruye. Esta clase es la que hace scroll; el shake se suma aparte y
// NUNCA se mete en el clamp, o se recortaria justo en los bordes del nivel,
// que es donde mas accion hay.
// ---------------------------------------------------------------------------
export class WorldCam {
  constructor() {
    this.x = 0; this.y = 0;
    this.lax = 0; this.lay = 0;      // look-ahead suavizado
    this.maxX = 0; this.maxY = 0;
  }
  // Coloca la camara centrada en (x,y) sin suavizado. Para el arranque y el
  // reinicio instantaneo tras morir.
  snap(L, x, y) {
    this.maxX = Math.max(0, L.pxW - VW);
    this.maxY = Math.max(0, L.pxH - VH);
    this.lax = 0; this.lay = 0;
    this.x = clamp(x - VW * 0.5, 0, this.maxX);
    this.y = clamp(y - VH * 0.5, 0, this.maxY);
  }
  // Sigue a (x,y) con zona muerta 108x240 y adelanto de 88px en la direccion de
  // marcha. La zona muerta es ancha y alta a proposito: un cuerpo que oscila en
  // un pendulo con una zona muerta estrecha marea.
  follow(L, x, y, vx, vy, dt) {
    this.maxX = Math.max(0, L.pxW - VW);
    this.maxY = Math.max(0, L.pxH - VH);
    const DZW = 108, DZH = 240, LOOK = 88, SPD = 900;
    const sp = Math.sqrt(vx * vx + vy * vy);
    const k = sp > 1 ? Math.min(1, sp / SPD) / sp : 0;
    const tax = vx * k * LOOK, tay = vy * k * LOOK;
    // Suavizado 0.12/frame, escalado por dt para no depender del framerate.
    const s = Math.min(1, 0.12 * dt * 60);
    this.lax += (tax - this.lax) * s;
    this.lay += (tay - this.lay) * s;
    const tx = x + this.lax, ty = y + this.lay;
    const cx = this.x + VW * 0.5, cy = this.y + VH * 0.5;
    let dx = tx - cx, dy = ty - cy;
    if (dx > DZW * 0.5) this.x += dx - DZW * 0.5;
    else if (dx < -DZW * 0.5) this.x += dx + DZW * 0.5;
    if (dy > DZH * 0.5) this.y += dy - DZH * 0.5;
    else if (dy < -DZH * 0.5) this.y += dy + DZH * 0.5;
    this.x = clamp(this.x, 0, this.maxX);
    this.y = clamp(this.y, 0, this.maxY);
  }
  // Rectangulo de camara inflado por `pad` px: la invariante R2 (nada dispara
  // desde fuera de pantalla) se comprueba con esto.
  contains(x, y, pad) {
    return x >= this.x - pad && x <= this.x + VW + pad &&
           y >= this.y - pad && y <= this.y + VH + pad;
  }
}
// Alias historico por si el modulo del juego prefiere el nombre corto.
export { WorldCam as Camera };

// ---------------------------------------------------------------------------
// ENEMIGOS
// ---------------------------------------------------------------------------

// Indices de tipo de enemigo.
export const E_SCIENTIST = 0, E_GUARD = 1, E_TURRET = 2, E_HAZMAT = 3, E_ENFORCER = 4;

// Estados. Se comparten entre tipos porque cada tipo solo usa los suyos.
export const ST_IDLE = 0, ST_PANIC = 1, ST_TRIP = 2, ST_COWER = 3, ST_ALARM = 4,
             ST_PATROL = 5, ST_SUSPECT = 6, ST_AIM = 7, ST_FIRE = 8, ST_RECOVER = 9,
             ST_COVER = 10, ST_STAGGER = 11, ST_SLEEP = 12, ST_DETECT = 13,
             ST_LOCK = 14, ST_BEAM = 15, ST_COOL = 16, ST_TELEGRAPH = 17,
             ST_ATTACK = 18, ST_CHARGE = 19, ST_STUN = 20, ST_DEAD = 21;

// Tabla de estadisticas. Todos los numeros salen del documento de diseno.
// w/h son la caja de colision en px; sw/sh el sprite dibujado.
export const ENEMY_TYPES = {
  scientist: {
    id: E_SCIENTIST, name: 'CIENTIFICO',
    hp: 10, w: 16, h: 26, sw: 20, sh: 28,
    walk: 60, panic: 176, alarmRun: 192,
    damage: 0, weight: 50,
    // CANON: 6 por yank (no 12). Con 12 y 6-9 cientificos por sala la primera
    // mitad del nivel era trivialmente curable y la vida quedaba plana.
    healYank: 6, healHoist: 3,
    tripChance: 0.18, tripTime: 0.70, alarmChance: 0.35, alarmRange: 520,
    scareRange: 180, contagion: 260, pressTime: 0.90,
    grabbable: true, firstLevel: 0,
  },
  guard: {
    id: E_GUARD, name: 'GUARDIA',
    hp: 45, w: 16, h: 26, sw: 20, sh: 28,
    walk: 92, repos: 140,
    damage: 22, weight: 26,
    healYank: 12, healHoist: 6,
    visRange: 200, visHalfAngle: 0.6109,   // 35 grados
    hearRange: 80,
    telegraph: 0.420, burst: 3, burstGap: 0.140,
    bulletSpeed: 300, recover: 1.60, stagger: 0.50,
    coverFrac: 0.40, backupDelay: 2.0, suspectHold: 1.2,
    grabbable: true, firstLevel: 1,
  },
  turret: {
    id: E_TURRET, name: 'TORRETA',
    hp: 60, w: 22, h: 22, sw: 24, sh: 24,
    walk: 0, damage: 4, weight: 8,
    healYank: 0, healHoist: 0,
    range: 340, sweepArc: 2.0944, sweepTime: 2.0,   // 120 grados en 2s
    detect: 0.50, lock: 0.320, beam: 0.80, cool: 1.40,
    tick: 0.0833, losDrop: 0.60,
    grabbable: true, yankKills: true, firstLevel: 3,
  },
  hazmat: {
    id: E_HAZMAT, name: 'HAZMAT',
    hp: 70, w: 18, h: 28, sw: 22, sh: 30,
    walk: 80, damage: 10, weight: 10,
    healYank: 12, healHoist: 6,
    telegraph: 0.60, coneRange: 180, coneHalfAngle: 0.45, sprayTime: 1.0,
    cooldown: 2.2,
    grabbable: true, firstLevel: 2,
  },
  enforcer: {
    id: E_ENFORCER, name: 'EJECUTOR',
    hp: 120, w: 24, h: 32, sw: 28, sh: 34,
    walk: 68, chargeSpeed: 520, chargeTime: 1.10,
    damage: 30, weight: 6,
    healYank: 0, healHoist: 6,
    telegraph: 0.70, wallStun: 1.40, wallSelfDamage: 40,
    cooldown: 1.6, chargeRange: 320,
    grabbable: false, yankImmune: true, firstLevel: 4,
  },
};
// Acceso por indice de tipo, sin buscar por nombre en el bucle caliente.
export const ENEMY_BY_ID = [
  ENEMY_TYPES.scientist, ENEMY_TYPES.guard, ENEMY_TYPES.turret,
  ENEMY_TYPES.hazmat, ENEMY_TYPES.enforcer,
];

// Rampa de cantidad por nivel (d = levelIndex, 0..7), del documento.
function countFor(type, d) {
  switch (type) {
    case E_SCIENTIST: return 4 + d;
    case E_GUARD:     return d < 1 ? 0 : Math.min(6, d);
    case E_HAZMAT:    return d < 2 ? 0 : Math.min(3, d - 1);
    case E_TURRET:    return d < 3 ? 0 : Math.min(4, d - 2);
    case E_ENFORCER:  return d < 4 ? 0 : Math.min(2, d - 4);
  }
  return 0;
}

// Topes por tipo del diseno. La suma con la rampa maxima (11+6+3+4+2=26) cabe
// holgadamente en el pool de 32.
export const ENEMY_CAP = 32;
export const BULLET_CAP = 24;

// ---------------------------------------------------------------------------
// Arte de enemigos
// ---------------------------------------------------------------------------
const SCI_A = [
  '..1111....','.122221...','.123321...','.122221...',
  '..1441....','.144441...','.1444441..',
  '.144441...','.14  41...','.155.51...',
  '.155.51...','.155.51...','.11..11...','..1..1....',
];
const SCI_B = [
  '..1111....','.122221...','.123321...','.122221...',
  '..1441....','.144441...','.1444441..',
  '.144441...','..1441....','..1551....',
  '.1551.....','.155..1...','.11...11..','.1.....1..',
];
const SCI_TRIP = [
  '..........','..........','..........','..........',
  '.1111111..','144444441.','143444441.',
  '1444444441','.11111111.','.1.1..1.1.',
  '1551551551','.11..11...','..........','..........',
];
const SCI_COWER = [
  '..........','..........','..1111....','.122221...',
  '.123321...','.122221...','.1444441..',
  '14444441..','14444441..','.155551...',
  '.155551...','.1111 1...','..........','..........',
];
const SCIMAP = { '1': P.out, '2': P.skin, '3': P.deep, '4': P.coat, '5': P.pants };
const SCIMAP2 = { '1': P.out, '2': P.skin, '3': P.deep, '4': P.coatSh, '5': P.pants };

const GRD_A = [
  '..1111....','.122221...','.123321...','.122221...',
  '..1441....','.144441...','.1444441..',
  '.145541...','.144441...','.155.51...',
  '.155.51...','.155.51...','.11..11...','..1..1....',
];
const GRD_B = [
  '..1111....','.122221...','.123321...','.122221...',
  '..1441....','.144441...','.1444441..',
  '.145541...','..1441....','..1551....',
  '.1551.....','.155..1...','.11...11..','.1.....1..',
];
const GRDMAP = { '1': P.out, '2': P.navy, '3': P.visor, '4': P.navy, '5': P.pants };
const GRDMAP2 = { '1': P.out, '2': P.navy, '3': P.visor, '4': P.shieldC, '5': P.pants };

const HAZ_A = [
  '..1111....','.122221...','.123321...','.122221...',
  '.1222221..','12222221..','12222221..',
  '12266221..','.1222221..','.122221...',
  '.12..21...','.12..21...','.11..11...','..1..1....',
  '..........',
];
const HAZ_B = [
  '..1111....','.122221...','.123321...','.122221...',
  '.1222221..','12222221..','12222221..',
  '12266221..','.1222221..','..12221...',
  '.122.21...','.12...1...','.11...11..','..1....1..',
  '..........',
];
const HAZMAP = { '1': P.out, '2': P.yellow, '3': P.pants, '6': P.greenDeep };
const HAZMAP2 = { '1': P.out, '2': P.bright, '3': P.pants, '6': P.green };

const ENF_A = [
  '...1111.....','..122221....','..123321....','..122221....',
  '.11444411...','1444444441..','1444554441..',
  '1444444441..','1444444441..','.14444441...',
  '.155..551...','.155..551...','.155..551...','.111..111...',
  '..11..11....','..1....1....','............',
];
const ENF_B = [
  '...1111.....','..122221....','..123321....','..122221....',
  '.11444411...','1444444441..','1444554441..',
  '1444444441..','.14444441...','..144441....',
  '.1551.551...','.155...51...','.155...11...','.111....1...',
  '..11........','..1.........','............',
];
const ENFMAP = { '1': P.out, '2': P.plate, '3': P.red, '4': P.plate, '5': P.shieldC };
const ENFMAP2 = { '1': P.out, '2': P.plate, '3': P.bright, '4': P.shieldC, '5': P.plate };

const TUR_A = [
  '111111111111','122222222221','123333333321','123444444321',
  '123455554321','123455554321','123444444321','.1233333321.',
  '..12222221..','...122221...','....1221....','.....11.....',
];
const TURMAP = { '1': P.out, '2': P.wallDark, '3': P.wallMid, '4': P.pipeMet, '5': P.visor };
const TURMAP_D = { '1': P.out, '2': P.wallDark, '3': P.wallMid, '4': P.pipeMet, '5': P.bright };
const TURMAP_L = { '1': P.out, '2': P.wallDark, '3': P.wallMid, '4': P.pipeMet, '5': P.red };

// Sprites por tipo. [tipo][frame], mas el destello blanco compartido por tipo.
let ESPR = null, ESPR_L = null, EFLASH = null;

function bakeEnemyArt() {
  if (ESPR) return;
  // ESPR[t] mira a la DERECHA; ESPR_L[t] es el espejo.
  ESPR = new Array(5); ESPR_L = new Array(5); EFLASH = new Array(5);
  ESPR[E_SCIENTIST] = [
    bake(SCI_A, SCIMAP, 2), bake(SCI_B, SCIMAP2, 2),
    bake(SCI_TRIP, SCIMAP, 2), bake(SCI_COWER, SCIMAP, 2),
  ];
  ESPR[E_GUARD] = [bake(GRD_A, GRDMAP, 2), bake(GRD_B, GRDMAP2, 2)];
  ESPR[E_TURRET] = [bake(TUR_A, TURMAP, 2), bake(TUR_A, TURMAP_D, 2), bake(TUR_A, TURMAP_L, 2)];
  ESPR[E_HAZMAT] = [bake(HAZ_A, HAZMAP, 2), bake(HAZ_B, HAZMAP2, 2)];
  ESPR[E_ENFORCER] = [bake(ENF_A, ENFMAP, 2), bake(ENF_B, ENFMAP2, 2)];
  for (let t = 0; t < 5; t++) {
    const arr = ESPR[t];
    ESPR_L[t] = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) ESPR_L[t][i] = bakeFlip(arr[i]);
  }
  // Destello blanco: siempre significa impacto, nunca compite con el decorado
  // (las paredes del laboratorio son #f2f6f8, no blanco puro).
  EFLASH[E_SCIENTIST] = bakeFlash(SCI_A, 2);
  EFLASH[E_GUARD] = bakeFlash(GRD_A, 2);
  EFLASH[E_TURRET] = bakeFlash(TUR_A, 2);
  EFLASH[E_HAZMAT] = bakeFlash(HAZ_A, 2);
  EFLASH[E_ENFORCER] = bakeFlash(ENF_A, 2);
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

// Contador de uid: un indice de pool NUNCA sirve como referencia duradera
// porque el pool usa swap-remove. Todo lo que quiera recordar un enemigo entre
// frames (el tentaculo que lo agarra, por ejemplo) guarda su uid.
let _uid = 1;

function mkEnemy() {
  return {
    _i: 0, uid: 0, type: 0, alive: 0,
    x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0,     // hx/hy = home / punto de patrulla A
    bx: 0, by: 0,                                // punto de patrulla B
    hp: 0, maxHp: 0, st: 0, t: 0, face: 1,
    frame: 0, animT: 0, flash: 0, stagger: 0,
    aimX: 0, aimY: 0, shots: 0, shotT: 0,        // vector BLOQUEADO en el lock
    cool: 0, alertT: 0, room: 0, alarmIdx: -1,
    ang: 0, sweep: 0, grip: 0, gripT: 0, gore: 0,
    dead: 0, spawnT: 0, backup: 0, mercy: 0,
  };
}
// reset OBLIGATORIO: Pool recicla EL MISMO objeto en el siguiente spawn(), asi
// que sin esto un enemigo nuevo hereda hp<=0, dead=1, grip, stagger... y vuelve
// a la vida ya muerto o congelado. Nunca pasar null como reset en este juego.
function rstEnemy(e) {
  e.uid = 0; e.type = 0; e.alive = 0;
  e.x = 0; e.y = 0; e.vx = 0; e.vy = 0; e.hx = 0; e.hy = 0; e.bx = 0; e.by = 0;
  e.hp = 0; e.maxHp = 0; e.st = 0; e.t = 0; e.face = 1;
  e.frame = 0; e.animT = 0; e.flash = 0; e.stagger = 0;
  e.aimX = 1; e.aimY = 0; e.shots = 0; e.shotT = 0;
  e.cool = 0; e.alertT = 0; e.room = 0; e.alarmIdx = -1;
  e.ang = 0; e.sweep = 0; e.grip = 0; e.gripT = 0; e.gore = 0;
  e.dead = 0; e.spawnT = 0; e.backup = 0; e.mercy = 0;
}

// Crea el pool de enemigos. cap por defecto ENEMY_CAP (32).
export function makeEnemyPool(cap) {
  return new Pool(cap || ENEMY_CAP, mkEnemy, rstEnemy);
}

function mkBullet() {
  return { _i: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, owner: 0 };
}
function rstBullet(b) {
  b.x = 0; b.y = 0; b.vx = 0; b.vy = 0; b.life = 0; b.dmg = 0; b.owner = 0;
}
// Crea el pool de balas. cap por defecto BULLET_CAP (24).
export function makeBulletPool(cap) {
  return new Pool(cap || BULLET_CAP, mkBullet, rstBullet);
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

// Busca un tile de suelo libre dentro de una sala. Devuelve el indice o -1.
function findFloorIn(L, R, rnd) {
  for (let tries = 0; tries < 24; tries++) {
    const tx = R.x + rnd.int(0, R.w - 1), ty = R.y + rnd.int(0, R.h - 1);
    if (L.tiles[ty * L.w + tx] === T_FLOOR) return ty * L.w + tx;
  }
  return -1;
}

// Busca un tile de techo (SOLID con suelo debajo) para colgar una torreta.
function findCeilingIn(L, R) {
  const ty = R.y - 1;
  if (ty < 1) return -1;
  for (let tx = R.x; tx < R.x + R.w; tx++) {
    if (isSolidTile(L.tiles[ty * L.w + tx]) && L.tiles[(ty + 1) * L.w + tx] === T_FLOOR) {
      return ty * L.w + tx;
    }
  }
  return -1;
}

// Coloca un enemigo ya reservado en (x,y) con los valores iniciales de su tipo.
function initEnemy(e, type, x, y, roomIdx) {
  const S = ENEMY_BY_ID[type];
  e.uid = _uid++; e.type = type; e.alive = 1;
  e.x = x; e.y = y; e.vx = 0; e.vy = 0;
  e.hx = x; e.hy = y; e.bx = x; e.by = y;
  e.hp = e.maxHp = S.hp;
  e.t = 0; e.face = 1; e.frame = 0; e.animT = 0; e.flash = 0; e.stagger = 0;
  e.aimX = 1; e.aimY = 0; e.shots = 0; e.shotT = 0; e.cool = 0; e.alertT = 0;
  e.room = roomIdx; e.alarmIdx = -1; e.ang = 0; e.sweep = 0;
  e.grip = 0; e.gripT = 0; e.gore = 0; e.dead = 0; e.spawnT = 0;
  e.backup = 0; e.mercy = 0;
  e.st = type === E_SCIENTIST ? ST_IDLE
       : type === E_GUARD ? ST_PATROL
       : type === E_TURRET ? ST_SLEEP
       : ST_PATROL;
}

// Puebla el nivel segun la rampa del diseno. NUNCA aparece nada en la sala de
// entrada ni a menos de 240px del spawn: la primera sala es siempre segura.
export function spawnEnemies(L, pool, rnd, levelIndex) {
  pool.clear();
  const d = Math.min(levelIndex, 7);
  const SAFE2 = 240 * 240;

  // APERTURA GARANTIZADA: 2 cientificos a la vista del punto de entrada, entre
  // 150 y 420px y con linea de vision. Sin esto los primeros 10 segundos pueden
  // no tener nada que hacer, y la matanza tiene que venir ANTES del peligro:
  // es el orden correcto para una fantasia de poder. Solo son presas indefensas
  // (dano 0), asi que no viola la regla anti-muerte-barata.
  // Tres niveles de exigencia decrecientes; el ultimo NO pide linea de vision,
  // solo cercania, para que la garantia se cumpla siempre aunque la sala de
  // entrada sea un recodo. Nunca dentro de 110px (no aparecen encima de ella).
  let opening = 0;
  for (let tier = 0; tier < 3 && opening < 2; tier++) {
    const near = tier === 0 ? 150 : 110;
    const far  = tier === 0 ? 420 : (tier === 1 ? 620 : 900);
    const needLOS = tier < 2;
    for (let tries = 0; tries < 260 && opening < 2; tries++) {
      const ri = rnd.int(0, L.nRooms - 1);
      const R = L.rooms[ri];
      const idx = findFloorIn(L, R, rnd);
      if (idx < 0) continue;
      const tx = idx % L.w, ty = (idx / L.w) | 0;
      const wx = tx * TS + TS * 0.5, wy = ty * TS + TS * 0.5;
      const dx = wx - L.spawnX, dy = wy - L.spawnY;
      const dd = dx * dx + dy * dy;
      if (dd < near * near || dd > far * far) continue;
      if (needLOS && !lineOfSight(L, L.spawnX, L.spawnY, wx, wy)) continue;
      const e = pool.spawn();
      if (!e) break;
      initEnemy(e, E_SCIENTIST, wx, wy, ri);
      const j = findFloorIn(L, R, rnd);
      if (j >= 0) { e.bx = (j % L.w) * TS + TS * 0.5; e.by = ((j / L.w) | 0) * TS + TS * 0.5; }
      e.alarmIdx = R.alarm;
      opening++;
    }
  }
  L.openingScientists = opening;

  for (let type = 0; type < 5; type++) {
    // Los de la apertura ya cuentan contra la cuota de cientificos.
    const want = countFor(type, d) - (type === E_SCIENTIST ? opening : 0);
    for (let k = 0; k < want; k++) {
      const e = pool.spawn();
      if (!e) return;                          // pool lleno: se descarta en silencio
      let placed = false;
      for (let tries = 0; tries < 30 && !placed; tries++) {
        const ri = rnd.int(1, Math.max(1, L.nRooms - 1));
        const R = L.rooms[ri];
        if (R.kind === 1) continue;            // nunca en la sala de entrada
        let idx;
        if (type === E_TURRET) idx = findCeilingIn(L, R);
        else idx = findFloorIn(L, R, rnd);
        if (idx < 0) continue;
        const tx = idx % L.w, ty = (idx / L.w) | 0;
        const wx = tx * TS + TS * 0.5;
        // La torreta CUELGA del techo: su centro debe quedar en el tile de
        // suelo de debajo, no dentro del tile solido del montaje. Si se deja
        // dentro del muro, todo rayo suyo nace en solido y lineOfSight
        // devuelve false siempre: la torreta no dispara jamas y parece rota.
        const wy = type === E_TURRET ? (ty + 1) * TS + 10 : ty * TS + TS * 0.5;
        const dx = wx - L.spawnX, dy = wy - L.spawnY;
        if (dx * dx + dy * dy < SAFE2) continue;
        if (solidAt(L, wx, wy)) continue;
        initEnemy(e, type, wx, wy, ri);
        // Ruta de patrulla: segundo punto dentro de la misma sala, asi que un
        // guardia nunca se va a pasear a un sitio donde ella no lo vera.
        const j = findFloorIn(L, R, rnd);
        if (j >= 0) { e.bx = (j % L.w) * TS + TS * 0.5; e.by = ((j / L.w) | 0) * TS + TS * 0.5; }
        e.alarmIdx = R.alarm;
        if (type === E_TURRET) { e.ang = Math.PI * 0.5; e.sweep = rnd.range(0, 6.28); }
        placed = true;
      }
      if (!placed) pool.free(e);
    }
  }
}

// Aparicion de refuerzos: 2 guardias en la puerta mas cercana al jugador, pero
// nunca dentro del rectangulo de camara ni a menos de 240px de ella.
export const GUARD_LIVE_CAP = 6;
export function spawnReinforcements(L, pool, rnd, px, py, n, wcam) {
  let made = 0;
  // Tope de 6 guardias vivos: sin el, las oleadas de lockdown cada 20s llenan
  // el pool de 32 y no queda sitio para nada mas.
  let live = countAlive(pool, E_GUARD);
  for (let k = 0; k < n; k++) {
    if (live >= GUARD_LIVE_CAP) break;
    for (let tries = 0; tries < 40; tries++) {
      const ri = rnd.int(0, L.nRooms - 1);
      const R = L.rooms[ri];
      if (R.kind === 1) continue;
      const idx = findFloorIn(L, R, rnd);
      if (idx < 0) continue;
      const tx = idx % L.w, ty = (idx / L.w) | 0;
      const wx = tx * TS + TS * 0.5, wy = ty * TS + TS * 0.5;
      const dx = wx - px, dy = wy - py;
      if (dx * dx + dy * dy < 240 * 240) continue;
      if (wcam && wcam.contains(wx, wy, 16)) continue;
      const e = pool.spawn();
      if (!e) return made;
      initEnemy(e, E_GUARD, wx, wy, ri);
      e.spawnT = 1.2;                          // 1.2s de aviso antes de actuar
      made++; live++;
      break;
    }
  }
  return made;
}

// Cuenta cuantos enemigos vivos de un tipo hay. Para los topes de refuerzos.
export function countAlive(pool, type) {
  let n = 0;
  for (let i = 0; i < pool.n; i++) if (pool.items[i].type === type) n++;
  return n;
}

// Busca un enemigo por uid. Devuelve el objeto o null. NUNCA guardar el indice.
export function findByUid(pool, uid) {
  if (!uid) return null;
  for (let i = 0; i < pool.n; i++) if (pool.items[i].uid === uid) return pool.items[i];
  return null;
}

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------

// Movimiento con colision de tiles, eje a eje. `e` es el enemigo.
function moveEnemy(L, e, dt) {
  const S = ENEMY_BY_ID[e.type];
  const hw = S.w * 0.5, hh = S.h * 0.5;
  let nx = e.x + e.vx * dt;
  if (!solidAt(L, nx - hw, e.y - hh + 2) && !solidAt(L, nx + hw, e.y - hh + 2) &&
      !solidAt(L, nx - hw, e.y + hh - 1) && !solidAt(L, nx + hw, e.y + hh - 1)) {
    e.x = nx;
  } else e.vx = 0;
  // Gravedad ligera: los enemigos caminan por el suelo, no vuelan.
  e.vy += 1400 * dt;
  if (e.vy > 700) e.vy = 700;
  let ny = e.y + e.vy * dt;
  if (!solidAt(L, e.x - hw, ny + hh) && !solidAt(L, e.x + hw, ny + hh) &&
      !solidAt(L, e.x - hw, ny - hh) && !solidAt(L, e.x + hw, ny - hh)) {
    e.y = ny;
  } else {
    if (e.vy > 0) e.y = (Math.floor((ny + hh) / TS)) * TS - hh - 0.01;
    e.vy = 0;
  }
}

// Camina hacia (tx,ty) a `spd` px/s. Solo horizontal: la Y la resuelve la
// gravedad, asi que nadie escala paredes.
function walkToward(e, tx, spd) {
  const dx = tx - e.x;
  if (Math.abs(dx) < 3) { e.vx = 0; return true; }
  e.vx = dx > 0 ? spd : -spd;
  e.face = dx > 0 ? 1 : -1;
  return false;
}

// Contagio de panico: SOLO se llama desde scare(), nunca por frame. Es O(n^2)
// con n<=32 (1024 comparaciones) que es gratis una vez y mortal cada frame.
function scare(pool, L, e, world) {
  if (e.type !== E_SCIENTIST) return;
  if (e.st === ST_PANIC || e.st === ST_ALARM || e.st === ST_COWER || e.st === ST_TRIP) return;
  const S = ENEMY_TYPES.scientist;
  // Con probabilidad 0.35 corre a la alarma si hay una sin pulsar cerca.
  const R = L.rooms[e.room];
  if (R && R.alarm >= 0 && R.used === 0 && world.rnd.chance(S.alarmChance)) {
    const ax = (R.alarm % L.w) * TS + TS * 0.5, ay = ((R.alarm / L.w) | 0) * TS + TS * 0.5;
    const dx = ax - e.x, dy = ay - e.y;
    if (dx * dx + dy * dy < S.alarmRange * S.alarmRange) {
      e.st = ST_ALARM; e.t = 0; e.alarmIdx = R.alarm;
      return;
    }
  }
  e.st = ST_PANIC; e.t = 0; e.cool = 0;
  // Los vecinos reciben un temporizador escalonado de 180ms: la sala se vacia
  // en una ola visible en vez de saltar todos en el mismo frame.
  const c2 = S.contagion * S.contagion;
  for (let i = 0; i < pool.n; i++) {
    const o = pool.items[i];
    if (o === e || o.type !== E_SCIENTIST || o.st !== ST_IDLE) continue;
    const dx = o.x - e.x, dy = o.y - e.y;
    if (dx * dx + dy * dy < c2 && o.alertT <= 0) o.alertT = 0.18;
  }
}

// Dispara una bala desde (x,y) con el vector YA BLOQUEADO (ax,ay) normalizado.
function fireBullet(world, x, y, ax, ay, dmg, ownerUid) {
  if (!world.bulletPool) return;
  const b = world.bulletPool.spawn();
  if (!b) return;
  const S = ENEMY_TYPES.guard;
  b.x = x; b.y = y;
  b.vx = ax * S.bulletSpeed; b.vy = ay * S.bulletSpeed;
  b.life = 3.0; b.dmg = dmg; b.owner = ownerUid;
  if (world.onShoot) world.onShoot(x, y, ax, ay);
}

// Actualiza todos los enemigos.
// world = { px, py, alive, alert, rnd, bulletPool, wcam, onShoot, onAlarm,
//           onDamage, onFoam, onShatter, mercy, playerInPipe }
// Ninguna propiedad es obligatoria salvo px/py/rnd; el modulo comprueba antes
// de llamar cualquier callback.
export function updateEnemies(pool, L, dt, world) {
  L.frame++;
  const px = world.px, py = world.py;
  const rnd = world.rnd;
  const wcam = world.wcam;
  const mercy = world.mercy > 0;
  const playerHidden = !!world.playerInPipe;   // en tuberia nadie la ve

  // R4: el numero de guardias APUNTANDO se RECUENTA cada frame. Un contador
  // mutable se filtra por los caminos de muerte/aturdimiento/perdida de vision
  // y acaba silenciando a todos los guardias para siempre, con pinta de que el
  // juego esta roto.
  let aiming = 0;
  for (let i = 0; i < pool.n; i++) if (pool.items[i].st === ST_AIM) aiming++;

  for (let i = pool.n - 1; i >= 0; i--) {
    const e = pool.items[i];
    const S = ENEMY_BY_ID[e.type];
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.cool > 0) e.cool -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }   // aviso de refuerzo

    // El aturdimiento por tentaculo CANCELA un apuntado pendiente: atacar es
    // siempre la respuesta correcta a una sala de guardias.
    if (e.stagger > 0) {
      e.stagger -= dt;
      e.vx = 0;
      if (e.st === ST_AIM || e.st === ST_LOCK || e.st === ST_TELEGRAPH) { e.st = ST_SUSPECT; e.t = 0; }
      if (e.type !== E_TURRET) moveEnemy(L, e, dt);
      continue;
    }
    // Agarrado por un tentaculo: el modulo del jugador manda sobre su posicion.
    if (e.grip) { e.gripT += dt; continue; }

    const dx = px - e.x, dy = py - e.y;
    const dist2 = dx * dx + dy * dy;
    const dist = Math.sqrt(dist2);

    switch (e.type) {

      // ---- CIENTIFICO: la presa. Nunca una amenaza. ----
      case E_SCIENTIST: {
        if (e.alertT > 0) { e.alertT -= dt; if (e.alertT <= 0) scare(pool, L, e, world); }
        if (e.st === ST_IDLE) {
          // Vaiven entre dos puntos a 30px/s (el diseno pide 30 en el paseo,
          // 60 es su tope de caminata).
          const tgt = (e.frame & 1) ? e.bx : e.hx;
          if (walkToward(e, tgt, 30)) e.frame ^= 1;
          if (!playerHidden && dist < S.scareRange && lineOfSight(L, e.x, e.y, px, py)) {
            scare(pool, L, e, world);
          }
        } else if (e.st === ST_PANIC) {
          // Reapunta la huida cada 250ms; asi no vibra ni se queda pegado.
          if (e.t >= 0.25) {
            e.t = 0;
            const d = dist || 1;
            e.aimX = -dx / d; e.aimY = -dy / d;
            // Acorralado: si la huida choca en menos de 40px, se acurruca.
            const h = raycast(L, e.x, e.y, e.aimX, e.aimY, 40);
            if (h.hit) { e.st = ST_COWER; e.t = 0; e.vx = 0; break; }
          }
          e.vx = e.aimX * S.panic;
          e.face = e.aimX > 0 ? 1 : -1;
          // Empujon: si va a chocar con otro cientifico, lo aparta. Se pisan
          // entre ellos por escapar de ella, que es exactamente la imagen.
          e.cool -= 0;
          if (e.shotT <= 0) {
            e.shotT = 0.25;
            for (let j = 0; j < pool.n; j++) {
              const o = pool.items[j];
              if (o === e || o.type !== E_SCIENTIST || o.st === ST_TRIP) continue;
              const ox = o.x - e.x, oy = o.y - e.y;
              if (ox * ox + oy * oy < 18 * 18) {
                o.vx += (ox >= 0 ? 80 : -80);
                if (rnd.chance(0.5)) { o.st = ST_TRIP; o.t = 0; o.vx = 0; }
                break;
              }
            }
          } else e.shotT -= dt;
          // Cada 600ms, 18% de tropezar: la ventana de piedad que convierte una
          // persecucion en una ejecucion y hace que matar sea una eleccion.
          e.animT += dt;
          if (e.animT >= 0.6) {
            e.animT = 0;
            if (rnd.chance(S.tripChance)) { e.st = ST_TRIP; e.t = 0; e.vx = 0; }
          }
        } else if (e.st === ST_TRIP) {
          e.vx = 0;
          if (e.t >= S.tripTime) { e.st = ST_PANIC; e.t = 0; }
        } else if (e.st === ST_COWER) {
          e.vx = 0;
          e.face = dx > 0 ? 1 : -1;
        } else if (e.st === ST_ALARM) {
          const R = L.rooms[e.room];
          if (!R || R.alarm < 0 || R.used) { e.st = ST_PANIC; e.t = 0; break; }
          const ax = (R.alarm % L.w) * TS + TS * 0.5;
          if (walkToward(e, ax, S.alarmRun)) {
            // 0.9s pulsando con un tono ascendente. Matarlo aqui lo cancela.
            e.animT += dt;
            if (e.animT >= S.pressTime) {
              R.used = 1;
              if (world.onAlarm) world.onAlarm(e.x, e.y);
              e.st = ST_PANIC; e.t = 0; e.animT = 0;
            }
          } else e.animT = 0;
        }
        moveEnemy(L, e, dt);
        break;
      }

      // ---- GUARDIA: la amenaza real, bajo cuatro invariantes. ----
      case E_GUARD: {
        const seesRaw = !playerHidden && dist < S.visRange &&
                        lineOfSight(L, e.x, e.y, px, py);
        // Cono de vision de 35 grados de semiangulo, mas oido a 80px.
        let sees = false;
        if (seesRaw) {
          const d = dist || 1;
          const fx = e.face, dot = (dx / d) * fx;
          sees = dot > Math.cos(S.visHalfAngle) || dist < S.hearRange;
        }
        const lowHp = e.hp < S.hp * S.coverFrac;

        if (e.st === ST_PATROL) {
          const tgt = (e.frame & 1) ? e.bx : e.hx;
          if (walkToward(e, tgt, S.walk)) e.frame ^= 1;
          if (sees || (world.alert >= 2 && dist < 420 && seesRaw)) { e.st = ST_SUSPECT; e.t = 0; }
        } else if (e.st === ST_SUSPECT) {
          e.vx = 0;
          e.face = dx > 0 ? 1 : -1;
          if (!seesRaw && e.t > S.suspectHold) { e.st = ST_PATROL; e.t = 0; break; }
          // R2: no dispara desde fuera de pantalla. R4: como mucho 2 a la vez.
          // Un guardia fuera de camara se queda en SUSPECT indefinidamente.
          const onScreen = !wcam || wcam.contains(e.x, e.y, 16);
          if (e.t > 0.4 && seesRaw && onScreen && aiming < 2 && !mercy && e.cool <= 0) {
            e.st = ST_AIM; e.t = 0; aiming++;
            // R3: el vector se calcula UNA VEZ aqui y las balas lo usan sin
            // cambiarlo. Moverse en perpendicular SIEMPRE funciona; ese es el
            // mejor momento del juego (pasar arcando junto a una linea roja).
            const d = dist || 1;
            e.aimX = dx / d; e.aimY = dy / d;
          }
        } else if (e.st === ST_AIM) {
          e.vx = 0;
          // R1: 420ms de telegrafia mas el viaje de la bala = 1087ms de aviso a
          // 100px y 2220ms a 270px, contra un lunge de 180ms.
          if (e.t >= S.telegraph) { e.st = ST_FIRE; e.t = 0; e.shots = 0; e.shotT = 0; }
        } else if (e.st === ST_FIRE) {
          e.vx = 0;
          e.shotT -= dt;
          if (e.shotT <= 0 && e.shots < S.burst) {
            fireBullet(world, e.x + e.aimX * 12, e.y + e.aimY * 12, e.aimX, e.aimY, S.damage, e.uid);
            e.shots++; e.shotT = S.burstGap;
          }
          if (e.shots >= S.burst) { e.st = lowHp ? ST_COVER : ST_RECOVER; e.t = 0; e.cool = 0.5; }
        } else if (e.st === ST_RECOVER) {
          // Se reposiciona alejandose 1.6s. No puede disparar.
          walkToward(e, e.x - (dx > 0 ? 60 : -60), S.repos);
          if (e.t >= S.recover) { e.st = ST_PATROL; e.t = 0; }
        } else if (e.st === ST_COVER) {
          e.vx = 0;
          e.cool = Math.max(e.cool, 0.8);       // dispara la mitad de a menudo
          if (e.t >= S.backupDelay && !e.backup) {
            e.backup = 1;
            if (world.onBackup) world.onBackup(e.x, e.y);
          }
          if (e.t >= S.backupDelay + 1.0) { e.st = ST_SUSPECT; e.t = 0; }
        }
        e.animT += dt;
        if (e.animT > 0.16) { e.animT = 0; e.frame ^= 1; }
        moveEnemy(L, e, dt);
        break;
      }

      // ---- TORRETA: un puzle espacial. No se mueve: hay que resolverla. ----
      case E_TURRET: {
        const inRange = !playerHidden && dist < S.range;
        const los = inRange && lineOfSight(L, e.x, e.y, px, py);
        if (e.st === ST_SLEEP) {
          // Barrido de 120 grados en 2s, linea gris tenue.
          e.sweep += dt * (S.sweepArc * 2 / S.sweepTime);
          e.ang = Math.PI * 0.5 + Math.sin(e.sweep) * S.sweepArc * 0.5;
          if (los) {
            const d = dist || 1;
            const a = Math.atan2(dy / d, dx / d);
            let da = a - e.ang;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) < S.sweepArc * 0.5) { e.st = ST_DETECT; e.t = 0; e.alertT = 0; }
          }
        } else if (e.st === ST_DETECT) {
          // 500ms SIGUIENDOLA: la fase de puro pavor, ves que te sigue antes
          // de que se comprometa.
          if (!los) { e.alertT += dt; if (e.alertT > S.losDrop) { e.st = ST_SLEEP; e.t = 0; } }
          else {
            e.alertT = 0;
            e.ang = Math.atan2(dy, dx);
            if (e.t >= S.detect) {
              e.st = ST_LOCK; e.t = 0;
              // R3 tambien aqui: al bloquear deja de seguir.
              const d = dist || 1;
              e.aimX = dx / d; e.aimY = dy / d;
            }
          }
        } else if (e.st === ST_LOCK) {
          if (e.t >= S.lock) { e.st = ST_BEAM; e.t = 0; e.shotT = 0; }
        } else if (e.st === ST_BEAM) {
          // 0.8s de rayo continuo por el vector BLOQUEADO. 4 de dano cada 1/12s
          // = 48 dps: cruzarlo cuesta un tick, quedarse dentro mata en ~2.1s.
          e.shotT -= dt;
          if (e.shotT <= 0) {
            e.shotT = S.tick;
            if (world.onBeamTick) world.onBeamTick(e.x, e.y, e.aimX, e.aimY, S.range, S.damage);
          }
          if (e.t >= S.beam) { e.st = ST_COOL; e.t = 0; }
        } else if (e.st === ST_COOL) {
          if (e.t >= S.cool) { e.st = los ? ST_DETECT : ST_SLEEP; e.t = 0; e.alertT = 0; }
        }
        break;                                   // estatica: no se mueve nunca
      }

      // ---- HAZMAT: te borra los anclajes, no la vida. ----
      case E_HAZMAT: {
        const los = !playerHidden && dist < S.coneRange * 1.4 && lineOfSight(L, e.x, e.y, px, py);
        if (e.st === ST_PATROL) {
          const tgt = (e.frame & 1) ? e.bx : e.hx;
          if (walkToward(e, tgt, S.walk)) e.frame ^= 1;
          if (los && e.cool <= 0 && (!wcam || wcam.contains(e.x, e.y, 16))) {
            e.st = ST_TELEGRAPH; e.t = 0;
            e.face = dx > 0 ? 1 : -1;
          }
        } else if (e.st === ST_TELEGRAPH) {
          // 600ms levantando el pulverizador, boquilla verde encendida.
          e.vx = 0;
          if (e.t >= S.telegraph) {
            e.st = ST_ATTACK; e.t = 0;
            const d = dist || 1;
            e.aimX = dx / d; e.aimY = dy / d;   // tambien bloqueado al empezar
          }
        } else if (e.st === ST_ATTACK) {
          e.vx = 0;
          // Marca de espuma: los tiles del cono no admiten anclaje 6s. Es lo
          // unico del juego que le quita el verbo principal.
          e.shotT -= dt;
          if (e.shotT <= 0) {
            e.shotT = 0.12;
            const steps = 6;
            for (let s = 1; s <= steps; s++) {
              const r = (S.coneRange * s) / steps;
              const fx = e.x + e.aimX * r, fy = e.y + e.aimY * r;
              if (solidAt(L, fx, fy)) break;
              foamTile(L, Math.floor(fx / TS), Math.floor(fy / TS));
            }
            if (world.onFoam) world.onFoam(e.x, e.y, e.aimX, e.aimY, S.coneRange);
          }
          if (e.t >= S.sprayTime) { e.st = ST_PATROL; e.t = 0; e.cool = S.cooldown; }
        }
        e.animT += dt;
        if (e.animT > 0.2) { e.animT = 0; e.frame ^= 1; }
        moveEnemy(L, e, dt);
        break;
      }

      // ---- EJECUTOR: invierte tu agarre y rompe las paredes. ----
      case E_ENFORCER: {
        const los = !playerHidden && dist < S.chargeRange && lineOfSight(L, e.x, e.y, px, py);
        if (e.st === ST_PATROL) {
          if (los) { walkToward(e, px, S.walk); }
          else { const tgt = (e.frame & 1) ? e.bx : e.hx; if (walkToward(e, tgt, S.walk)) e.frame ^= 1; }
          if (los && dist < S.chargeRange && e.cool <= 0 &&
              (!wcam || wcam.contains(e.x, e.y, 16))) {
            e.st = ST_TELEGRAPH; e.t = 0; e.vx = 0;
            e.face = dx > 0 ? 1 : -1;
          }
        } else if (e.st === ST_TELEGRAPH) {
          // 700ms agachado, el cuerpo se comprime y aparecen 3 galones amarillos
          // marcando EL CARRIL de la carga: se ve exactamente por donde viene.
          e.vx = 0;
          if (e.t >= S.telegraph) {
            e.st = ST_CHARGE; e.t = 0;
            e.aimX = e.face; e.aimY = 0;        // carga en linea recta, bloqueada
          }
        } else if (e.st === ST_CHARGE) {
          e.vx = e.aimX * S.chargeSpeed;
          // Impacto contra pared: se autoaturde 1.4s, se hace 40 de dano y
          // REVIENTA el muro, abriendo rutas nuevas. Esa es la leccion de "usa
          // la sala", ensenada por un enemigo sin una sola linea de texto.
          const probeX = e.x + e.aimX * (S.w * 0.5 + 6);
          if (solidAt(L, probeX, e.y)) {
            const tx = Math.floor(probeX / TS);
            let broke = false;
            for (let k = -1; k <= 1; k++) {
              const ty = Math.floor((e.y + k * TS) / TS);
              if (shatterWall(L, tx, ty)) { if (world.onShatter) world.onShatter(tx, ty); broke = true; }
            }
            e.hp -= S.wallSelfDamage;
            e.st = ST_STUN; e.t = 0; e.vx = 0; e.flash = 0.12;
            cam.shake(broke ? 5 : 3, 0.2);
            if (world.onEnemyHurt) world.onEnemyHurt(e, S.wallSelfDamage);
          } else if (e.t >= S.chargeTime) { e.st = ST_PATROL; e.t = 0; e.cool = S.cooldown; }
        } else if (e.st === ST_STUN) {
          e.vx = 0;
          if (e.t >= S.wallStun) { e.st = ST_PATROL; e.t = 0; e.cool = S.cooldown; }
        }
        e.animT += dt;
        if (e.animT > 0.22) { e.animT = 0; e.frame ^= 1; }
        moveEnemy(L, e, dt);
        break;
      }
    }

    if (e.hp <= 0 && !e.dead) {
      e.dead = 1;
      if (world.onEnemyDeath) world.onEnemyDeath(e);
      pool.free(e);
    }
  }
}

// Avanza las balas y comprueba el impacto contra tiles y contra el jugador.
// Devuelve el dano total encajado este frame (0 si no le dieron).
export function updateBullets(pool, L, dt, world) {
  let dmg = 0;
  const px = world.px, py = world.py, pr = world.playerRadius || 14;
  for (let i = pool.n - 1; i >= 0; i--) {
    const b = pool.items[i];
    b.life -= dt;
    if (b.life <= 0) { pool.free(b); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (solidAt(L, b.x, b.y)) {
      if (world.onBulletHitWall) world.onBulletHitWall(b.x, b.y);
      pool.free(b); continue;
    }
    if (!world.playerInPipe && world.alive !== 0) {
      const ddx = b.x - px, ddy = b.y - py, rr = pr + 3;
      if (ddx * ddx + ddy * ddy < rr * rr) { dmg += b.dmg; pool.free(b); }
    }
  }
  return dmg;
}

// Dibuja las balas: nucleo 4x4 ambar, estela 2px detras, pixel blanco delante.
export function drawBullets(g, pool, wcam) {
  const cx = Math.round(wcam.x), cy = Math.round(wcam.y);
  g.fillStyle = P.orange;
  for (let i = 0; i < pool.n; i++) {
    const b = pool.items[i];
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy);
    const s = 1 / 300;
    g.fillRect(x - Math.round(b.vx * s * 6) - 1, y - Math.round(b.vy * s * 6) - 1, 2, 2);
  }
  g.fillStyle = P.bright;
  for (let i = 0; i < pool.n; i++) {
    const b = pool.items[i];
    g.fillRect(Math.round(b.x - cx) - 2, Math.round(b.y - cy) - 2, 4, 4);
  }
  g.fillStyle = P.white;
  for (let i = 0; i < pool.n; i++) {
    const b = pool.items[i];
    g.fillRect(Math.round(b.x - cx + b.vx * 0.012), Math.round(b.y - cy + b.vy * 0.012), 1, 1);
  }
}

// ---------------------------------------------------------------------------
// Dibujo de enemigos
// ---------------------------------------------------------------------------

// Elige el fotograma segun el estado. Cada estado del cientifico tiene una
// SILUETA DISTINTA: la reaccion se lee de un vistazo a un brazo de distancia,
// y esa legibilidad ES la fantasia de poder.
function enemyFrame(e) {
  if (e.type === E_SCIENTIST) {
    if (e.st === ST_TRIP) return 2;
    if (e.st === ST_COWER) return 3;
    return e.frame & 1;
  }
  if (e.type === E_TURRET) {
    return e.st === ST_LOCK || e.st === ST_BEAM ? 2 : (e.st === ST_DETECT ? 1 : 0);
  }
  return e.frame & 1;
}

// Dibuja todos los enemigos visibles, mas sus telegrafias (linea roja de
// apuntado, rayo de torreta, cono de espuma, carril de carga).
export function drawEnemies(g, pool, wcam, t) {
  const cx = Math.round(wcam.x), cy = Math.round(wcam.y);
  const tt = t || 0;

  // PASE 1: telegrafias que van DEBAJO de los cuerpos (lineas de mira).
  for (let i = 0; i < pool.n; i++) {
    const e = pool.items[i];
    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx < -80 || sy < -80 || sx > VW + 80 || sy > VH + 80) continue;

    if (e.type === E_GUARD && e.st === ST_AIM) {
      // La lectura mas importante de la pantalla: 1px rojo del canon a donde
      // ella estaba AL BLOQUEAR, pulsando a opacidad plena los ultimos 120ms.
      const S = ENEMY_TYPES.guard;
      const last = e.t > S.telegraph - 0.12;
      g.fillStyle = last ? P.red : P.wound;
      drawRay(g, sx, sy, e.aimX, e.aimY, 420, 1);
    } else if (e.type === E_TURRET) {
      const S = ENEMY_TYPES.turret;
      if (e.st === ST_SLEEP) {
        g.fillStyle = P.shadow;
        drawRay(g, sx, sy, Math.cos(e.ang), Math.sin(e.ang), S.range, 1);
      } else if (e.st === ST_DETECT) {
        g.fillStyle = P.bright;
        drawRay(g, sx, sy, Math.cos(e.ang), Math.sin(e.ang), S.range, 1);
      } else if (e.st === ST_LOCK) {
        g.fillStyle = P.red;
        drawRay(g, sx, sy, e.aimX, e.aimY, S.range, 1);
      } else if (e.st === ST_BEAM) {
        g.fillStyle = P.red;
        drawRay(g, sx, sy, e.aimX, e.aimY, S.range, 6);
        g.fillStyle = P.white;
        drawRay(g, sx, sy, e.aimX, e.aimY, S.range, 2);
      }
    } else if (e.type === E_HAZMAT && (e.st === ST_TELEGRAPH || e.st === ST_ATTACK)) {
      const S = ENEMY_TYPES.hazmat;
      g.fillStyle = e.st === ST_ATTACK ? P.green : P.greenMid;
      const ax = e.st === ST_ATTACK ? e.aimX : e.face, ay = e.st === ST_ATTACK ? e.aimY : 0;
      drawRay(g, sx, sy, ax, ay, S.coneRange, e.st === ST_ATTACK ? 4 : 1);
    } else if (e.type === E_ENFORCER && e.st === ST_TELEGRAPH) {
      // Tres galones amarillos delante marcando el carril: se ve por donde va
      // a pasar antes de que arranque.
      g.fillStyle = P.bright;
      for (let k = 1; k <= 3; k++) {
        const ox = sx + e.face * (26 + k * 22);
        for (let r = 0; r < 6; r++) {
          g.fillRect(ox - e.face * r, sy - 6 + r, 2, 2);
          g.fillRect(ox - e.face * r, sy + 6 - r, 2, 2);
        }
      }
    }
  }

  // PASE 2: cuerpos.
  for (let i = 0; i < pool.n; i++) {
    const e = pool.items[i];
    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx < -40 || sy < -40 || sx > VW + 40 || sy > VH + 40) continue;
    if (e.spawnT > 0) {
      // Refuerzo llegando: solo un marcador parpadeante, nunca un cuerpo que
      // aparece de la nada encima de ella.
      if (((e.spawnT * 8) | 0) & 1) { g.fillStyle = P.orange; g.fillRect(sx - 3, sy - 12, 6, 24); }
      continue;
    }
    let s;
    if (e.flash > 0) s = EFLASH[e.type];
    else {
      const f = enemyFrame(e);
      s = (e.face < 0 ? ESPR_L : ESPR)[e.type][f];
    }
    if (s) spr(g, s, sx, sy);
    // Pip amarillo de sospecha: el guardia dice "te oi" antes de apuntar.
    if (e.type === E_GUARD && e.st === ST_SUSPECT) {
      g.fillStyle = P.yellow;
      g.fillRect(sx - 1, sy - 24, 2, 6);
      g.fillRect(sx - 1, sy - 16, 2, 2);
    }
    // Barra de vida solo si esta herido: sin ruido de HUD cuando esta intacto.
    if (e.hp < e.maxHp && e.hp > 0) {
      const w = 18, fw = Math.max(1, Math.round(w * e.hp / e.maxHp));
      g.fillStyle = P.out; g.fillRect(sx - w / 2 - 1, sy - 22, w + 2, 3);
      g.fillStyle = e.hp < e.maxHp * 0.4 ? P.red : P.green;
      g.fillRect(sx - w / 2, sy - 21, fw, 1);
    }
  }
  // Suprime el aviso de variable no usada manteniendo la firma con `t`.
  if (tt < 0) return;
}

// Traza una linea con fillRects de `w` px de grosor. Sin stroke(): un stroke
// se antialiasea sobre coordenadas fraccionarias y produce exactamente la
// pelusa gris que imageSmoothingEnabled=false existe para evitar.
function drawRay(g, x0, y0, dx, dy, len, w) {
  const step = 3;
  const n = (len / step) | 0;
  const h = w >> 1;
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + dx * i * step), y = Math.round(y0 + dy * i * step);
    if (x < -8 || y < -8 || x > VW + 8 || y > VH + 8) continue;
    g.fillRect(x - h, y - h, w, w);
  }
}

// ---------------------------------------------------------------------------
// Utilidades de combate que el modulo del jugador necesita
// ---------------------------------------------------------------------------

// Enemigo mas cercano al rayo (x0,y0)->(dx,dy) dentro de maxDist, con asistencia
// de puntería: cuenta cualquiera cuyo centro este a menos de `assist` px de la
// linea (distancia perpendicular), y gana el mas cercano a lo largo del rayo.
// Ella nunca falla a un cientifico al que apunto claramente.
export function enemyAlongRay(pool, x0, y0, dx, dy, maxDist, assist) {
  let best = null, bt = maxDist;
  const a = assist || 44;
  for (let i = 0; i < pool.n; i++) {
    const e = pool.items[i];
    if (e.spawnT > 0) continue;
    const ex = e.x - x0, ey = e.y - y0;
    const along = ex * dx + ey * dy;
    if (along < 0 || along > maxDist) continue;
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp > a) continue;
    if (along < bt) { bt = along; best = e; }
  }
  return best;
}

// Aplica dano a un enemigo. `stagger` en segundos cancela un apuntado pendiente.
// Devuelve true si murio con este golpe.
export function damageEnemy(e, amount, stagger) {
  if (!e || e.hp <= 0) return false;
  e.hp -= amount;
  e.flash = 0.12;
  if (stagger > 0 && e.stagger < stagger) e.stagger = stagger;
  return e.hp <= 0;
}

// Vida que devuelve matar a este enemigo con cada verbo (0 = no alimenta).
export function healFor(e, byYank) {
  const S = ENEMY_BY_ID[e.type];
  return byYank ? (S.healYank || 0) : (S.healHoist || 0);
}

// Cuantas curaciones/particulas de sangre corresponden. Expuesto por comodidad
// del modulo del jugador; aqui no se dibuja ni una gota.
export function isGrabbable(e) {
  const S = ENEMY_BY_ID[e.type];
  return !!S.grabbable && !S.yankImmune;
}

// Rompe el cristal que el cuerpo acaba de tocar y devuelve true si algo cayo.
// El llamador reparcha ese tile del canvas horneado y lanza los 8 fragmentos.
export function touchGlass(L, x, y, rnd) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  if (!shatterGlass(L, tx, ty)) return false;
  repaintTile(L, tx, ty);
  burst(tx * TS + TS * 0.5, ty * TS + TS * 0.5, 8,
    { rnd: rnd, colors: [P.visor, P.labLight, P.white], speed: 190, life: 0.45, size: 2, grav: 620 });
  SFX.brick();
  cam.shake(2.5, 0.12);
  return true;
}
