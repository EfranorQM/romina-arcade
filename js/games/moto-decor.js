// FURIA - el decorado: arboles, rocas, matas, flores, vallas, gradas...
//
// Los modelos son de Kenney (moto-kenney.js, horneados por
// tools/hornea-modelos.mjs) y se colorean aqui segun el bioma: cada vertice
// trae su material (hojas, corteza, piedra...) y el bioma dice de que color es
// cada uno (moto-bioma.js). En la nieve, ademas, las caras que miran hacia
// arriba se vuelven blancas: pinos y rocas salen nevados por arriba sin un
// solo modelo nuevo.
//
// RENDIMIENTO. Cada pieza plantada se funde (con su posicion, giro y escala ya
// aplicados) en una malla por TRAMO de 50 m de pista: un tramo entero, con sus
// decenas de arboles y cientos de matas, es UNA llamada de dibujo, y los tramos
// que no se ven los descarta la camara. Lo pegado a la pista da sombra (otra
// malla por tramo); lo lejano no paga la pasada de sombras.

import * as THREE from '../vendor/three-moto.js';
import { MATS, MODELOS } from './moto-kenney.js';

const TRAMO = 50;

// ---------- Los modelos ----------
const cache = new Map();
function modelo(nombre) {
  let g = cache.get(nombre);
  if (g) return g;
  const m = MODELOS[nombre];
  if (!m) throw new Error('modelo desconocido: ' + nombre);
  const bin = Uint8Array.from(atob(m.d), c => c.charCodeAt(0));
  const dv = new DataView(bin.buffer);
  const v = m.v, bb = m.bb;
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), mat = new Uint8Array(v);
  for (let k = 0; k < v; k++) for (let c = 0; c < 3; c++) {
    const q = dv.getInt16((k * 3 + c) * 2, true);
    pos[k * 3 + c] = bb[c] + (q + 32767) / 65534 * (bb[c + 3] - bb[c]);
    nor[k * 3 + c] = dv.getInt8(v * 6 + k * 3 + c) / 127;
  }
  for (let k = 0; k < v; k++) mat[k] = dv.getUint8(v * 9 + k);
  const idx = new Uint16Array(m.i);
  for (let k = 0; k < m.i; k++) idx[k] = dv.getUint16(v * 10 + k * 2, true);
  g = { v, pos, nor, mat, idx, bb };
  cache.set(nombre, g);
  return g;
}

// ---------- El que planta ----------
// Acumula piezas por tramo y al final las funde.
export function creaPlantador(mundo) {
  const colores = MATS.map(n => new THREE.Color(mundo.mats[n] || '#ff00ff'));
  const nieve = new THREE.Color('#f4f8fc');
  const nevado = !!mundo.bioma.nevado;
  const tramos = new Map();                 // clave -> { pos:[], nor:[], col:[], idx:[], n }
  const _c = new THREE.Color();

  function cubo(x, sombra) {
    const k = Math.floor(x / TRAMO) + (sombra ? ':s' : ':n');
    let t = tramos.get(k);
    if (!t) { t = { pos: [], nor: [], col: [], idx: [], n: 0, sombra }; tramos.set(k, t); }
    return t;
  }

  // Planta `nombre` en (x, y, z) con giro en Y, escala y matiz (0.85-1.15).
  // incl: inclinacion en Z (para una valla en cuesta).
  function pon(nombre, x, y, z, giro, esc, matiz = 1, sombra = false, incl = 0, escY = 1) {
    const g = modelo(nombre);
    const t = cubo(x, sombra);
    const cg = Math.cos(giro), sg = Math.sin(giro), ci = Math.cos(incl), si = Math.sin(incl);
    // Se gira sobre el CENTRO de su planta. Los del kit de carreras traen el
    // origen en una esquina de su baldosa (x de -0.35 a 0.65, z de -1.65 a
    // -0.65): girada 180 grados, la grada daba la vuelta alrededor de esa
    // esquina y acababa pegada a la pista, enseñando la espalda.
    const cx = (g.bb[0] + g.bb[3]) * 0.5, cz = (g.bb[2] + g.bb[5]) * 0.5;
    const base = t.n;
    for (let k = 0; k < g.v; k++) {
      let px = (g.pos[k * 3] - cx) * esc, py = g.pos[k * 3 + 1] * esc * escY, pz = (g.pos[k * 3 + 2] - cz) * esc;
      let nx = g.nor[k * 3], ny = g.nor[k * 3 + 1], nz = g.nor[k * 3 + 2];
      // giro en Y
      let rx = px * cg + pz * sg, rz = -px * sg + pz * cg;
      let mx = nx * cg + nz * sg, mz = -nx * sg + nz * cg;
      // inclinacion en Z
      const qx = rx * ci - py * si, qy = rx * si + py * ci;
      const ox = mx * ci - ny * si, oy = mx * si + ny * ci;
      t.pos.push(x + qx, y + qy, z + rz);
      t.nor.push(ox, oy, mz);
      _c.copy(colores[g.mat[k]]).multiplyScalar(matiz);
      if (nevado) {
        const s = Math.min(1, Math.max(0, (oy - 0.35) / 0.45));
        _c.lerp(nieve, s * s * (3 - 2 * s) * 0.92);
      }
      t.col.push(_c.r, _c.g, _c.b);
    }
    for (let k = 0; k < g.idx.length; k++) t.idx.push(base + g.idx[k]);
    t.n += g.v;
  }

  function funde(grupo) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    let tri = 0;
    for (const t of tramos.values()) {
      if (!t.n) continue;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
      bg.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
      bg.setIndex(t.n > 65535 ? new THREE.BufferAttribute(new Uint32Array(t.idx), 1) : new THREE.BufferAttribute(new Uint16Array(t.idx), 1));
      bg.computeBoundingSphere();
      const m = new THREE.Mesh(bg, mat);
      m.castShadow = t.sombra;
      m.receiveShadow = true;
      grupo.add(m);
      tri += t.idx.length / 3;
    }
    tramos.clear();
    return tri;
  }

  return { pon, funde, modelo };
}

// ---------- El reparto ----------
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// Elige de una lista [nombre, peso, escMin, escMax] con un numero 0..1.
function elige(lista, u) {
  let total = 0;
  for (const it of lista) total += it[1];
  let a = u * total;
  for (const it of lista) { a -= it[1]; if (a <= 0) return it; }
  return lista[lista.length - 1];
}

// Planta el decorado de un nivel entero.
//   largo: metros de pista. suelo(x, z): altura del terreno detras de la pista.
//   libres: [[x0, x1]] donde no plantar en el borde (pozos, rampas: se tienen
//   que ver bien). sem: semilla del nivel.
export function decora(grupo, mundo, { largo, suelo, libres, sem, inicio, fin }) {
  const P = creaPlantador(mundo);
  const B = mundo.bioma;
  const libre = (x) => libres.some(([a, b]) => x > a - 1.5 && x < b + 1.5);

  const franja = (def, z0, z1, sombra, desde, hasta) => {
    let i = 0;
    for (let x = desde; x < hasta; i++) {
      const u1 = hash(x * 3.1 + sem + z0), u2 = hash(x * 7.7 + sem * 1.3 + z1), u3 = hash(x * 11.3 + sem * 0.7);
      const it = elige(def.lista, u1);
      const z = z0 + (z1 - z0) * Math.pow(u2, 0.85);
      if (!(z0 > -3 && libre(x))) {
        const esc = it[2] + (it[3] - it[2]) * u3;
        P.pon(it[0], x, suelo(x, z) - 0.03, z, u2 * 6.28, esc, 0.86 + hash(x * 5.3 + sem) * 0.28, sombra);
      }
      x += def.cada * (0.5 + hash(x * 2.9 + sem + i) * 1.0);
    }
  };
  // El borde NO da sombra: matas de 30 cm no la hacen notar, y eran la franja
  // con mas piezas (una cada 80 cm) en la pasada de sombras.
  franja(B.borde, -1.8, -2.9, false, -40, largo + 60);
  franja(B.cerca, -3.2, -12, true, -40, largo + 60);
  franja(B.medio, -12, -45, false, -60, largo + 80);
  franja(B.lejos, -45, -110, false, -120, largo + 160);

  // Vallas de madera al borde de la pista, a tramos (en la pradera).
  if (B.vallas) {
    for (let x = 10; x < largo; ) {
      const tramo = 14 + hash(x + sem) * 26;
      if (hash(x * 1.7 + sem) < 0.45) {
        for (let s = x; s < x + tramo && s < largo - 20; s += 2.2) {
          if (libre(s)) continue;
          const y0 = suelo(s, -3.1), y1 = suelo(s + 2.2, -3.1);
          P.pon(hash(s) < 0.7 ? 'fence_simple' : 'fence_planks', s + 1.1, (y0 + y1) / 2 - 0.05, -3.1, 0, 2.2, 1, true, Math.atan2(y1 - y0, 2.2));
        }
      }
      x += tramo + 10 + hash(x * 3 + sem) * 30;
    }
  }

  // La salida y la meta: gradas, carpas, banderas y barreras rojas y blancas
  // a lo largo del borde. Es lo que dice "carrera" de un vistazo.
  for (const [xc, grande] of [[inicio, false], [fin, true]]) {
    // Las gradas miran a +z (hacia la pista) sin girarlas.
    const n = grande ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const x = xc - 8 + k * 4.6;
      P.pon('grandStand', x, suelo(x, -11) - 0.05, -11, 0, 4.5, 1, false);
    }
    P.pon('tentLong', xc + 9, suelo(xc + 9, -7) - 0.03, -7, 0, 2.8, 1, true);
    P.pon('tent', xc + 16, suelo(xc + 16, -7.5) - 0.03, -7.5, 0, 2.8, 1, true);
    for (let s = xc - 16; s < xc + 18; s += 1.02) {
      P.pon(Math.floor((s - xc) / 1.02) % 2 ? 'barrierRed' : 'barrierWhite', s, suelo(s, -2.05) - 0.02, -2.05, 0, 4.1, 1, true);
    }
    for (let s = xc - 12; s < xc + 14; s += 6) P.pon('flagRed', s, suelo(s, -2.6) - 0.02, -2.6, Math.PI / 2, 1.7, 1, true);
  }

  // En el bosque, un campamento de vez en cuando: tienda y hoguera.
  const hogueras = [];
  if (B.campamento) {
    for (let x = 60; x < largo - 40; x += 70 + hash(x + sem) * 60) {
      const z = -5.5 - hash(x * 2 + sem) * 3;
      P.pon('tent_detailedOpen', x, suelo(x, z) - 0.03, z - 1.8, 0.3, 3.2, 1, true);
      P.pon('campfire_logs', x + 2.2, suelo(x + 2.2, z) + 0.01, z, 0, 3.4, 1, true);
      P.pon('log_large', x + 3.8, suelo(x + 3.8, z) - 0.02, z - 0.4, 1.2, 1.8, 1, true);
      hogueras.push([x + 2.2, suelo(x + 2.2, z) + 0.25, z]);
    }
  }

  const tri = P.funde(grupo);
  return { tri, hogueras };
}
