// FURIA - la pista y el paisaje: terreno en corte, lomas, montañas, nubes,
// salida y meta. Los colores salen del bioma y del cielo (moto-bioma.js).
//
// EL TERRENO VA EN CORTE, como un diorama: la pista es la cara de arriba de un
// bloque de tierra cortado en vertical hacia la camara, y en el corte se ven
// las capas del suelo. Asi el perfil que usa la fisica -- lo unico que
// importa para jugar -- se lee exacto como el borde entre la pista y el corte,
// y los pozos son agujeros de verdad en los dos.

import * as THREE from '../vendor/three-moto.js';
import * as W from './moto-world.js';

export const K = 43;                         // px de la fisica por metro
const C = (hex) => new THREE.Color(hex);
const _col = new THREE.Color();

// Ruido determinista: el paisaje no puede cambiar entre frames ni entre dos
// partidas del mismo nivel.
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function ruido(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

// Filas del terreno, de delante (el corte) hacia atras. Entre +1.6 y -1.6 es
// la pista: ahi la altura es EXACTAMENTE la de la fisica, o las ruedas
// flotarian o se hundirian. Las filas de +-0.15 son las roderas.
// La fila -1.63 esta pegada a la -1.62 para que el pozo tenga pared de fondo
// vertical: sin ella, la hierba de detras bajaba en rampa hasta el fondo y el
// pozo se leia como un hoyo de cesped.
const FILAS = [1.8, 1.62, 1.1, 0.5, 0.15, -0.15, -0.5, -1.1, -1.62, -1.63, -2.3, -3.4, -5.2, -8, -12];
const PISTA = 1.62;

// El suelo de detras de la pista: sigue al perfil suavizado y se levanta en
// lomas cuanto mas lejos. Una funcion, porque la usan el terreno, el fondo y
// cada cosa que se planta.
export function creaSuelo(T, sem) {
  const suave = new Float32Array(T.n);
  const h = T.base || T.h;
  for (let i = 0; i < T.n; i++) {
    let s = 0, c = 0;
    for (let k = -12; k <= 12; k++) { const j = Math.min(T.n - 1, Math.max(0, i + k)); s += h[j]; c++; }
    suave[i] = -(s / c) / K;
  }
  const Tsuave = (xm) => {
    const fi = Math.min(T.n - 1.001, Math.max(0, xm * K / W.STEP)), i = fi | 0, f = fi - i;
    return suave[i] * (1 - f) + suave[Math.min(T.n - 1, i + 1)] * f;
  };
  const fondoY = (x, z) => {
    const xs = x + sem;
    const lejos = Math.max(0, -z - PISTA);
    const lomas = (ruido(xs * 0.05 + z * 0.02) - 0.35) * Math.min(1, lejos / 25) * 2.5
                + (ruido(xs * 0.013 - z * 0.01 + 40) - 0.35) * Math.min(1, lejos / 70) * 9;
    const bache = (ruido(xs * 0.7 + z * 0.9) - 0.5) * Math.min(1, lejos / 3) * 0.35;
    // Pegado a la pista, a la altura de su borde (sin escalon).
    const borde = -W.groundBase(T, Math.max(0, x * K)) / K;
    const lejano = Tsuave(x) + lomas + bache + lejos * 0.015;
    const u = Math.min(1, lejos / 1.2);
    return borde + (lejano - borde) * (z > -2.4 ? 0.25 * u : u);
  };
  return { Tsuave, fondoY };
}

// Perfil de la pista en m, con los pozos: en cada borde se repite la x con
// dos alturas, asi las paredes del agujero salen verticales. Es el suelo SIN
// rampas: la rampa es de madera y va encima (moto-obs3d.js).
function perfilConPozos(T, obs) {
  const gb = (x) => W.groundBase(T, x);
  const pozos = obs.filter(o => o.kind === W.OB_PIT).map(o => [o.x - o.w * 0.5, o.x + o.w * 0.5, gb(o.x) + W.POZO_PROF]);
  const out = [];
  let p = 0;
  const lim = T.len + 400;
  // Antes de la salida el suelo sigue plano 60 m: la camara ve hacia atras y
  // sin esto asomaba el borde del mundo a la izquierda.
  for (let x = -60 * K; x < 0; x += W.STEP * 4) out.push({ x, y: gb(0), pozo: false });
  for (let i = 0; i < T.n; i++) {
    const x = i * W.STEP;
    if (x > lim) break;
    while (p < pozos.length && pozos[p][1] < x) p++;
    const pz = pozos[p];
    if (pz && x > pz[0] && x < pz[1]) {
      if (!out.length || out[out.length - 1].x < pz[0]) {
        out.push({ x: pz[0], y: gb(pz[0]), pozo: false });
        out.push({ x: pz[0] + 0.01, y: pz[2], pozo: true });
      }
      out.push({ x, y: pz[2], pozo: true });
      if ((i + 1) * W.STEP >= pz[1]) {
        out.push({ x: pz[1] - 0.01, y: pz[2], pozo: true });
        out.push({ x: pz[1], y: gb(pz[1]), pozo: false });
      }
    } else out.push({ x, y: gb(x), pozo: false });
  }
  const fin = out[out.length - 1];
  for (let x = fin.x + W.STEP * 4; x < fin.x + 80 * K; x += W.STEP * 4) out.push({ x, y: fin.y, pozo: false });
  return out;
}

export function construyeTerreno(grupo, T, obs, mundo, suelo) {
  const B = mundo.bioma;
  const prof = perfilConPozos(T, obs);
  const nP = prof.length, nF = FILAS.length;
  const pos = new Float32Array(nP * nF * 3), col = new Float32Array(nP * nF * 3);
  const cH = C(B.hierba), cH2 = C(B.hierba2), cT = C(B.tierra), cT2 = C(B.tierra2), cOsc = C('#0b0a0c');
  const cBarro = C(B.colBarro);
  const enBarro = (x) => T.barro && T.barro.some(z => x > z[0] && x < z[1]);
  for (let i = 0; i < nP; i++) {
    const xm = prof[i].x / K, ym = -prof[i].y / K;
    const ySup = -W.groundBase(T, Math.max(0, prof[i].x)) / K;
    const barro = enBarro(prof[i].x);
    for (let f = 0; f < nF; f++) {
      const z = FILAS[f];
      const enPista = z <= PISTA + 0.2 && z >= -PISTA;
      let y = enPista ? ym : suelo.fondoY(xm, z);
      if (z === -1.63) y = prof[i].pozo ? ySup : ym;
      const k = (i * nF + f) * 3;
      pos[k] = xm; pos[k + 1] = y; pos[k + 2] = z;
      // Color: tierra en la pista, con roderas; hierba fuera; negro en el pozo.
      const r = hash(xm * 3.7 + z * 11.3);
      if (prof[i].pozo && enPista) _col.copy(cOsc);
      else if (prof[i].pozo && z === -1.63) _col.copy(C(B.estratos[1])).multiplyScalar(0.6);
      else if (barro && enPista && Math.abs(z) < 1.4) _col.copy(cBarro).multiplyScalar(0.85 + r * 0.25);
      else if (z > PISTA) _col.copy(cH2).lerp(cH, 0.4 + r * 0.3);
      else if (Math.abs(z) < 0.2) _col.copy(cT2).lerp(cT, 0.1 + r * 0.25);
      else if (enPista) _col.copy(cT).lerp(cT2, r * 0.45 + (Math.abs(z) > 1.2 ? 0.25 : 0));
      else _col.copy(cH).lerp(cH2, r * 0.6 + Math.max(0, ruido(xm * 0.2 + z) - 0.5));
      col[k] = _col.r; col[k + 1] = _col.g; col[k + 2] = _col.b;
    }
  }
  // Con las filas yendo hacia -z, (a, b, c) deja la normal hacia ARRIBA. Al
  // reves, la cara de arriba se descartaba entera y se veia el cielo.
  const idx = [];
  for (let i = 0; i < nP - 1; i++) for (let f = 0; f < nF - 1; f++) {
    const a = i * nF + f, b = (i + 1) * nF + f, c = a + 1, d = b + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  grupo.add(m);

  // --- El corte, con las capas del suelo ---
  // Las capas se miden desde el perfil SUAVIZADO: en un corte de verdad van
  // casi horizontales, y el pozo las corta en vez de hundirlas. Cada capa con
  // sus propios vertices y color liso (compartiendolos salia una mancha).
  const PROF = [0, 0.16, 0.5, 1.15, 2.05, 3.3, 5.0, 14];
  const est = [C(B.hierba2)].concat(B.estratos.map(C));
  const limite = (i, d) => {
    const xm = prof[i].x / K, ym = -prof[i].y / K, base = suelo.Tsuave(xm);
    if (d === 0) return ym;
    if (d === PROF.length - 1) return base - PROF[d];
    const onda = (ruido(xm * 0.45 + d * 7.3) - 0.5) * 0.4 + (ruido(xm * 2.1 + d) - 0.5) * 0.08;
    return Math.min(ym - 0.02 * d, base - PROF[d] + onda);
  };
  const nB = PROF.length - 1;
  const pos2 = new Float32Array(nP * nB * 2 * 3), col2 = new Float32Array(nP * nB * 2 * 3);
  for (let i = 0; i < nP; i++) {
    const xm = prof[i].x / K;
    for (let d = 0; d < nB; d++) {
      const arriba = limite(i, d), abajo = Math.min(arriba, limite(i, d + 1));
      _col.copy(est[Math.min(est.length - 1, d)]).multiplyScalar(0.9 + hash(Math.floor(xm * 1.3) + d * 17) * 0.16);
      if (prof[i].pozo && d < 3) _col.lerp(cOsc, 0.6);
      const k = ((i * nB + d) * 2) * 3;
      pos2[k] = xm; pos2[k + 1] = arriba; pos2[k + 2] = FILAS[0];
      pos2[k + 3] = xm; pos2[k + 4] = abajo; pos2[k + 5] = FILAS[0];
      col2[k] = col2[k + 3] = _col.r; col2[k + 1] = col2[k + 4] = _col.g; col2[k + 2] = col2[k + 5] = _col.b;
    }
  }
  const idx2 = [];
  for (let i = 0; i < nP - 1; i++) for (let d = 0; d < nB; d++) {
    const a = (i * nB + d) * 2, b = ((i + 1) * nB + d) * 2;
    idx2.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  g2.setAttribute('color', new THREE.BufferAttribute(col2, 3));
  g2.setIndex(idx2);
  g2.computeVertexNormals();
  const m2 = new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m2.receiveShadow = true;
  grupo.add(m2);
}

// Lomas de detras, cordilleras y nubes. Mallas bajas: a esa distancia la
// niebla hace el trabajo.
export function construyeFondo(grupo, T, mundo, suelo) {
  const B = mundo.bioma, CI = mundo.cielo;
  const x0 = -80, x1 = T.len / K + 120, paso = 2.5;
  const ZS = [-11.5, -16, -23, -32, -45, -62, -85, -115];
  const nx = Math.ceil((x1 - x0) / paso) + 1, nz = ZS.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const cH = C(B.hierba), cH2 = C(B.hierba2), cL = C(CI.monte[1]);
  for (let i = 0; i < nx; i++) {
    const x = x0 + i * paso;
    for (let j = 0; j < nz; j++) {
      const z = ZS[j];
      const k = (i * nz + j) * 3;
      pos[k] = x; pos[k + 1] = suelo.fondoY(x, z) - (j === 0 ? 0.08 : 0); pos[k + 2] = z;
      _col.copy(cH).lerp(cH2, hash(x * 1.3 + z) * 0.7).lerp(cL, Math.min(0.35, j * 0.05));
      col[k] = _col.r; col[k + 1] = _col.g; col[k + 2] = _col.b;
    }
  }
  const idx = [];
  for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const a = i * nz + j, b = (i + 1) * nz + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  grupo.add(m);

  // Dos cordilleras, bajas: con picos de 70 m tapaban el sol y la luna.
  const med = suelo.Tsuave(T.len / K * 0.5);
  for (const c of [{ z: -170, alto: 16, color: CI.monte[1], f: 0.021, s: 3 }, { z: -290, alto: 30, color: CI.monte[0], f: 0.011, s: 9 }]) {
    const xa = -300, xb = T.len / K + 450, pasoM = 7;
    const n = Math.ceil((xb - xa) / pasoM) + 1;
    const p = [], ix = [];
    for (let i = 0; i < n; i++) {
      const x = xa + i * pasoM;
      const pico = Math.pow(ruido(x * c.f + c.s), 1.6) * c.alto + ruido(x * c.f * 4 + c.s * 2) * c.alto * 0.18;
      p.push(x, med - 4 + pico, c.z, x, med - 90, c.z);
      if (i < n - 1) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    gm.setIndex(ix);
    grupo.add(new THREE.Mesh(gm, new THREE.MeshBasicMaterial({ color: c.color })));
  }

  // Nubes: laminas con una nube blanda pintada, de cara a la camara (que mira
  // casi siempre en la misma direccion), en una sola malla instanciada. Las
  // bolas facetadas de antes parecian piedras flotando. De noche, ninguna.
  if (CI.estrellas) return;
  const n = Math.ceil((T.len / K + 500) / 55);
  const nubes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texturaNube(), color: CI.nube, transparent: true, depthWrite: false, fog: false }), n);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const gx = -200 + k * 55 + hash(k * 3.3) * 30;
    const ancho = 45 + hash(k * 7.1) * 50;
    pv.set(gx, med + 22 + hash(k * 5.7) * 30, -330 - hash(k * 9.1) * 60);
    s.set(ancho, ancho * 0.42, 1);
    nubes.setMatrixAt(k, mm.compose(pv, q, s));
  }
  nubes.renderOrder = -8;
  grupo.add(nubes);
}

function texturaNube() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 110;
  const g = c.getContext('2d');
  const bola = (x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.8})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  // Base ancha y plana, bultos arriba: la silueta de un cumulo.
  bola(70, 72, 42, 0.9); bola(128, 58, 50, 1); bola(185, 70, 40, 0.9);
  bola(100, 48, 34, 0.9); bola(155, 44, 32, 0.85); bola(128, 80, 60, 0.6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Salida y meta: pancartas al borde de la pista, DE CARA a la camara (un arco
// atravesado se veria de canto desde el costado). Y banderines cada 12 m: con
// el suelo liso no habia nada que contara la velocidad.
export function construyeMetas(grupo, T) {
  const mPoste = new THREE.MeshStandardMaterial({ color: '#e8e8ec', roughness: 0.4, metalness: 0.3 });
  const arco = (xpx, textura, raya) => {
    const x = xpx / K, y = -W.groundBase(T, xpx) / K;
    for (const dx of [-1.9, 1.9]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), mPoste);
      p.position.set(x + dx, -W.groundBase(T, xpx + dx * K) / K + 1.7, -2.3); p.castShadow = true;
      grupo.add(p);
    }
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.85),
      new THREE.MeshStandardMaterial({ map: textura, roughness: 0.6, side: THREE.DoubleSide }));
    b.position.set(x, y + 3.0, -2.28); b.castShadow = true;
    grupo.add(b);
    if (raya) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 3.3),
        new THREE.MeshStandardMaterial({ map: raya, roughness: 0.7 }));
      r.position.set(x, y + 0.01, 0); r.receiveShadow = true;
      grupo.add(r);
    }
  };
  arco(T.len - 200, texturaCuadros(16, 4), texturaCuadros(2, 14));
  // La salida, justo detras de donde arranca la moto: mas adelante quedaba
  // debajo del cartel de NIVEL, en el centro de la pantalla.
  arco(60, texturaSalida());
  const mB = [new THREE.MeshStandardMaterial({ color: '#ff2e63', roughness: 0.6, side: THREE.DoubleSide }),
              new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide })];
  const gP = new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5); gP.translate(0, 0.55, 0);
  const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.36, -0.11); tri.lineTo(0, -0.22); tri.closePath();
  const gBan = new THREE.ExtrudeGeometry(tri, { depth: 0.01, bevelEnabled: false }); gBan.translate(0, 1.08, 0);
  const n = Math.floor((T.len - 300) / K / 12);
  const postes = new THREE.InstancedMesh(gP, mPoste, n);
  const ban = [new THREE.InstancedMesh(gBan, mB[0], n), new THREE.InstancedMesh(gBan, mB[1], n)];
  const mm = new THREE.Matrix4(), cero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const x = 6 + i * 12, y = -W.groundBase(T, x * K) / K;
    mm.makeTranslation(x, y, -1.95);
    postes.setMatrixAt(i, mm);
    ban[i % 2].setMatrixAt(i, mm);
    ban[1 - i % 2].setMatrixAt(i, cero);
  }
  postes.castShadow = true;
  grupo.add(postes, ban[0], ban[1]);
}
function texturaSalida() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 40;
  const g = c.getContext('2d');
  g.fillStyle = '#ff2e63'; g.fillRect(0, 0, 256, 40);
  g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FURIA', 128, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function texturaCuadros(nx, ny) {
  const c = document.createElement('canvas');
  c.width = nx * 8; c.height = ny * 8;
  const g = c.getContext('2d');
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    g.fillStyle = (i + j) % 2 ? '#111111' : '#ffffff';
    g.fillRect(i * 8, j * 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
