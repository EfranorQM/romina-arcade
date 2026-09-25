// FURIA - el mundo en 3D: terreno, decorado, obstaculos, luz y camara.
//
// LO QUE ES "ENTRE 3D Y 2D". La partida sigue siendo 2D: la fisica
// (moto-world.js) vive en un plano, en px, y esta medida con su arnes. Aqui
// ese plano se pone en un mundo de verdad -- con profundidad, luz, sombras y
// niebla -- y la camara lo mira de costado, un poco desde arriba y desde
// delante. Se juega de lado; se ve con volumen.
//
// EL TERRENO VA EN CORTE, como un diorama: la pista es la cara de arriba de un
// bloque de tierra cortado en vertical hacia la camara, y en el corte se ven
// las capas del suelo. Asi el perfil que usa la fisica -- lo unico que
// importa para jugar -- se lee exacto como el borde entre la pista y el corte,
// y los pozos son agujeros de verdad en los dos.
//
// El render va a un lienzo WebGL propio que furia.js copia en el suyo, debajo
// del HUD. El renderizador se crea UNA vez para toda la vida de la app: crear
// y tirar contextos WebGL en cada partida acaba en el tope del navegador.

import * as THREE from '../vendor/three-moto.js';
import * as W from './moto-world.js';
import { creaMoto, junta } from './moto-modelo.js';

export const K = 43;                         // px de la fisica por metro
const HWpx = W.WHEELBASE * 0.5;

// ---------- Ambientes ----------
// Uno por nivel, en ciclo. Solo cambian color y luz: la geometria no depende
// de esto. `estratos` son las capas del corte, de arriba abajo.
export const AMBIENTES = [
  { nombre: 'MEDIODIA', cielo: ['#2f7fd6', '#86c2ee', '#e3f1f4'], niebla: '#cfe2ea', nieblaLejos: 330,
    sol: '#fff1d0', solI: 2.6, solDir: [0.35, 0.85, 0.55], disco: [0.8, 0.95], discoCol: '#fff6dc',
    cieloL: '#cfe6ff', sueloL: '#6b5a3a', hemiI: 1.25,
    hierba: '#79ad45', hierba2: '#5a8c33', tierra: '#b98a55', tierra2: '#9b6c3e',
    estratos: ['#4c3a22', '#6e4a2c', '#a4673a', '#c68b52', '#8b8d8f', '#5f6369'],
    arbol: '#3d7a3b', arbol2: '#2d6536', tronco: '#6b4a2e', monte: ['#6f98bf', '#9ab8d2'],
    nube: '#ffffff', estrellas: false, faro: false },
  { nombre: 'ATARDECER', cielo: ['#2b1d5e', '#b8456b', '#ffb070'], niebla: '#d9807a', nieblaLejos: 300,
    sol: '#ffc98a', solI: 2.4, solDir: [-0.3, 0.45, 0.75], disco: [0.72, 0.5], discoCol: '#ffe0a0',
    cieloL: '#ffb8a0', sueloL: '#3a2440', hemiI: 1.0,
    hierba: '#8b8a3e', hierba2: '#6c6a30', tierra: '#c28a5a', tierra2: '#a06a44',
    estratos: ['#3e2a26', '#6a3e2c', '#a45a3a', '#c98052', '#7d6e78', '#4f4658'],
    arbol: '#3e5a38', arbol2: '#34482f', tronco: '#5a3a2a', monte: ['#6a3a6e', '#a0507a'],
    nube: '#ffb4a0', estrellas: false, faro: false },
  { nombre: 'NOCHE', cielo: ['#040818', '#0f1f48', '#2c4380'], niebla: '#15244c', nieblaLejos: 250,
    sol: '#c4dcff', solI: 2.1, solDir: [0.4, 0.75, 0.55], disco: [0.28, 0.8], discoCol: '#e8f2ff',
    cieloL: '#6a88d0', sueloL: '#141a34', hemiI: 1.2,
    hierba: '#2c5a4c', hierba2: '#20453a', tierra: '#9a8580', tierra2: '#7a6863',
    estratos: ['#2a2430', '#3c3040', '#5a4250', '#6e5460', '#4a4e62', '#33374a'],
    arbol: '#1f423e', arbol2: '#183532', tronco: '#3a2e30', monte: ['#1a2750', '#26356a'],
    nube: '#3a4a7a', estrellas: true, faro: true },
  { nombre: 'AMANECER', cielo: ['#3a5a9a', '#e8a0a0', '#ffd9a0'], niebla: '#eebfa8', nieblaLejos: 310,
    sol: '#ffe0b0', solI: 2.4, solDir: [0.55, 0.4, 0.6], disco: [0.22, 0.5], discoCol: '#fff0c8',
    cieloL: '#ffd0c0', sueloL: '#4a3a40', hemiI: 1.1,
    hierba: '#6c9c52', hierba2: '#517d3e', tierra: '#b98c62', tierra2: '#9a6e4a',
    estratos: ['#4a3628', '#704a34', '#a86a48', '#cc9068', '#8a8290', '#5e5868'],
    arbol: '#3b6c48', arbol2: '#2e583c', tronco: '#654634', monte: ['#8a7aa8', '#b89ab8'],
    nube: '#fff0f0', estrellas: false, faro: false },
];
export function ambiente(nivel) { return AMBIENTES[(nivel - 1) % AMBIENTES.length]; }

// ---------- Ruido determinista ----------
// El decorado no puede cambiar entre frames ni entre dos partidas del mismo
// nivel: sale de la posicion, no del azar.
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function ruido(x) {                         // suave, 0..1
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

// ---------- Estado del modulo ----------
let R = null, canvasGL = null;
let escena = null, camara = null, sol = null, hemi = null;
let cieloMat = null, cieloMesh = null, disco = null, estrellas = null;
let nivelGrupo = null;                      // lo que se tira al cambiar de nivel
let moto = null;
let N = null;                               // datos del nivel: T, obs, amb, mallas
const cam = { x: 0, y: 0, span: W.CAM.spanMin, sac: 0, sacT: 0, lista: false };

// El render sale a una fraccion del lienzo del juego y se estira al copiarlo.
// Arranca en 0.75 y baja sola si el telefono no llega (ver frame()).
let calidad = 0.75, anchoJ = 1200, altoJ = 540;
const medidor = { t0: 0, n: 0, suma: 0, bajo: 0 };

export function inicia(ancho, alto) {
  anchoJ = ancho; altoJ = alto;
  if (!R) {
    canvasGL = document.createElement('canvas');
    R = new THREE.WebGLRenderer({ canvas: canvasGL, antialias: true, alpha: false, powerPreference: 'high-performance' });
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFShadowMap;
    R.setPixelRatio(1);
  }
  ajustaTamano();
  if (!escena) creaEscenaFija();
}

function ajustaTamano() {
  const w = Math.max(320, Math.round(anchoJ * calidad)), h = Math.max(144, Math.round(altoJ * calidad));
  if (canvasGL.width !== w || canvasGL.height !== h) R.setSize(w, h, false);
  if (camara) { camara.aspect = anchoJ / altoJ; camara.updateProjectionMatrix(); }
}
export function lienzo() { return canvasGL; }
// Para las herramientas de medida (tools/medir-furia.js).
export function renderer() { return R; }
export function laEscena() { return escena; }
export function calidadActual() { return calidad; }

// ---------- Lo que no cambia entre niveles ----------
function creaEscenaFija() {
  escena = new THREE.Scene();
  camara = new THREE.PerspectiveCamera(32, anchoJ / altoJ, 0.5, 900);

  hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  escena.add(hemi);
  sol = new THREE.DirectionalLight('#ffffff', 2.5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  // La sombra cubre lo que se ve de pista y poco mas: un mapa grande sobre
  // una zona pequena es lo que la deja nitida bajo la moto.
  const sc = sol.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 80;
  sol.shadow.bias = -0.0006;
  sol.shadow.normalBias = 0.02;
  escena.add(sol, sol.target);

  // Cielo: una esfera por dentro con un degradado vertical. No lleva niebla:
  // es el fondo contra el que la niebla funde lo lejano.
  cieloMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cA: { value: new THREE.Color() }, cM: { value: new THREE.Color() }, cB: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 cA; uniform vec3 cM; uniform vec3 cB; varying vec3 vP;'
      + 'void main(){ float h = vP.y; vec3 c = h > 0.03 ? mix(cM, cA, smoothstep(0.03, 0.3, h)) : mix(cB, cM, smoothstep(-0.04, 0.03, h));'
      + ' gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  cieloMesh = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), cieloMat);
  cieloMesh.renderOrder = -10;
  escena.add(cieloMesh);

  // Sol o luna: un disco con halo, siempre a la misma altura en el cielo.
  disco = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(), color: '#ffffff', depthWrite: false, fog: false, blending: THREE.AdditiveBlending, transparent: true }));
  disco.renderOrder = -9;
  escena.add(disco);

  // Estrellas, solo de noche.
  const pos = [];
  // En la franja de cielo que ve la camara (casi de lado): de 1 a 20 grados.
  for (let i = 0; i < 420; i++) {
    const a = hash(i * 3.1) * Math.PI - Math.PI / 2, e = 0.02 + Math.pow(hash(i * 7.7), 1.4) * 0.33;
    pos.push(Math.sin(a) * Math.cos(e) * 600, Math.sin(e) * 600, -Math.cos(a) * Math.cos(e) * 600);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  estrellas = new THREE.Points(eg, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }));
  estrellas.renderOrder = -9;
  escena.add(estrellas);

  moto = creaMoto();
  escena.add(moto.grupo);
  creaParticulas();
}

function texturaHalo() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.16, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaBlanda() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- El nivel ----------
const C = (hex) => new THREE.Color(hex);
const _col = new THREE.Color();

// Filas del terreno, de delante (el corte) hacia atras. Entre +1.6 y -1.6 es
// la pista: ahi la altura es EXACTAMENTE la de la fisica, o las ruedas
// flotarian o se hundirian. Las filas de +-0.15 son las roderas.
// La fila -1.63 esta pegada a la -1.62 para que el pozo tenga pared de fondo
// vertical: sin ella, la hierba de detras bajaba en rampa hasta el fondo y el
// pozo se leia como un hoyo de cesped.
const FILAS = [1.8, 1.62, 1.1, 0.5, 0.15, -0.15, -0.5, -1.1, -1.62, -1.63, -2.3, -3.4, -5.2, -8, -12];
const PISTA = 1.62;

// Altura del terreno detras de la pista: sigue al perfil suavizado y se
// levanta en lomas cuanto mas lejos. Una funcion, no una malla guardada,
// porque la usan el terreno, el fondo y cada arbol que se planta.
let semF = 0;                               // semilla del nivel para las lomas
function fondoY(Tsuave, x, z) {
  x += semF;
  const lejos = Math.max(0, -z - PISTA);
  const base = Tsuave(x - semF);
  const lomas = (ruido(x * 0.05 + z * 0.02) - 0.35) * Math.min(1, lejos / 25) * 2.5
              + (ruido(x * 0.013 - z * 0.01 + 40) - 0.35) * Math.min(1, lejos / 70) * 9;
  const bache = (ruido(x * 0.7 + z * 0.9) - 0.5) * Math.min(1, lejos / 3) * 0.35;
  return base + lomas + bache + lejos * 0.015;
}

export function nivel(T, obs, n) {
  if (!R) return;
  if (nivelGrupo) { escena.remove(nivelGrupo); libera(nivelGrupo); }
  nivelGrupo = new THREE.Group();
  escena.add(nivelGrupo);
  const amb = ambiente(n);
  N = { T, obs, amb, n, troncos: new Map() };
  semF = n * 173.3;

  // Luz y cielo del ambiente.
  cieloMat.uniforms.cA.value.set(amb.cielo[0]);
  cieloMat.uniforms.cM.value.set(amb.cielo[1]);
  cieloMat.uniforms.cB.value.set(amb.cielo[2]);
  escena.fog = new THREE.Fog(amb.niebla, 45, amb.nieblaLejos);
  hemi.color.set(amb.cieloL); hemi.groundColor.set(amb.sueloL); hemi.intensity = amb.hemiI;
  sol.color.set(amb.sol); sol.intensity = amb.solI;
  disco.material.color.set(amb.discoCol);
  estrellas.visible = amb.estrellas;
  moto.faro(amb.faro);

  // Perfil suavizado (media movil ancha) para lo que no es pista: las lomas
  // del fondo no deben copiar cada bache.
  const mX = (x) => W.groundY(T, x * K);
  const suave = new Float32Array(T.n);
  for (let i = 0; i < T.n; i++) {
    let s = 0, c = 0;
    for (let k = -12; k <= 12; k++) { const j = Math.min(T.n - 1, Math.max(0, i + k)); s += T.h[j]; c++; }
    suave[i] = -(s / c) / K;
  }
  const Tsuave = (xm) => {
    const fi = Math.min(T.n - 1.001, Math.max(0, xm * K / W.STEP)), i = fi | 0, f = fi - i;
    return suave[i] * (1 - f) + suave[Math.min(T.n - 1, i + 1)] * f;
  };
  N.Tsuave = Tsuave;

  construyeTerreno(T, obs, amb, Tsuave, mX);
  construyeFondo(T, amb, Tsuave);
  construyeArboles(T, amb, Tsuave);
  construyeObstaculos(T, obs);
  construyeMetas(T, amb);

  cam.lista = false;
  moto.reinicia();
  for (const p of parts) p.vida = 0;
  // Se compilan YA los shaders de todo lo que puede salir en el nivel (el
  // polvo y el haz del faro, aunque aun no se vean): compilarlos la primera
  // vez que aparecen daba un tiron en mitad de la partida, y en un movil
  // compilar un shader son decenas de ms.
  for (const p of humos) p.s.visible = true;
  colocaCamara(120 / K, -W.groundY(T, 120) / K, 0, 0, false);
  R.compile(escena, camara);
  for (const p of humos) { p.vida = 0; p.s.visible = false; }
}

// Perfil de la pista en m, con los pozos: en cada borde se repite la x con
// dos alturas, asi las paredes del agujero salen verticales.
function perfilConPozos(T, obs) {
  const pozos = obs.filter(o => o.kind === W.OB_PIT).map(o => [o.x - o.w * 0.5, o.x + o.w * 0.5, W.groundY(T, o.x) + W.POZO_PROF]);
  const out = [];
  let p = 0;
  const lim = T.len + 400;
  // Antes de la salida el suelo sigue plano 60 m: la camara ve hacia atras y
  // sin esto asomaba el borde del mundo a la izquierda.
  for (let x = -60 * K; x < 0; x += W.STEP * 4) out.push({ x, y: W.groundY(T, 0), pozo: false });
  for (let i = 0; i < T.n; i++) {
    const x = i * W.STEP;
    if (x > lim) break;
    while (p < pozos.length && pozos[p][1] < x) p++;
    const pz = pozos[p];
    if (pz && x > pz[0] && x < pz[1]) {
      // Bordes del pozo: se meten al pasar por el primer punto de dentro.
      if (!out.length || out[out.length - 1].x < pz[0]) {
        out.push({ x: pz[0], y: W.groundY(T, pz[0]), pozo: false });
        out.push({ x: pz[0] + 0.01, y: pz[2], pozo: true });
      }
      out.push({ x, y: pz[2], pozo: true });
      const sig = (i + 1) * W.STEP;
      if (sig >= pz[1]) {
        out.push({ x: pz[1] - 0.01, y: pz[2], pozo: true });
        out.push({ x: pz[1], y: W.groundY(T, pz[1]), pozo: false });
      }
    } else {
      out.push({ x, y: W.groundY(T, x), pozo: false });
    }
  }
  const fin = out[out.length - 1];
  for (let x = fin.x + W.STEP * 4; x < fin.x + 80 * K; x += W.STEP * 4) out.push({ x, y: fin.y, pozo: false });
  return out;
}

function construyeTerreno(T, obs, amb, Tsuave) {
  const prof = perfilConPozos(T, obs);
  const nP = prof.length, nF = FILAS.length;
  const pos = new Float32Array(nP * nF * 3), col = new Float32Array(nP * nF * 3);
  const cH = C(amb.hierba), cH2 = C(amb.hierba2), cT = C(amb.tierra), cT2 = C(amb.tierra2), cOsc = C('#0b0a0c');
  for (let i = 0; i < nP; i++) {
    const xm = prof[i].x / K, ym = -prof[i].y / K;
    // Altura de la pista SIN el pozo: de ella arranca la hierba de detras.
    // Hundiendo tambien la hierba, por la pared de atras del pozo se veia el
    // cielo; asi el pozo es una zanja que cruza la pista y nada mas.
    const ySup = -W.groundY(T, Math.max(0, prof[i].x)) / K;
    for (let f = 0; f < nF; f++) {
      const z = FILAS[f];
      const enPista = z <= PISTA + 0.2 && z >= -PISTA;
      let y = enPista ? ym : fondoY(Tsuave, xm, z);
      // Detras de la pista la hierba empieza a la altura del borde, sin escalon.
      if (!enPista && z > -2.4) y = ySup + (y - ySup) * 0.25;
      if (z === -1.63) y = prof[i].pozo ? ySup : ym;
      const k = (i * nF + f) * 3;
      pos[k] = xm; pos[k + 1] = y; pos[k + 2] = z;
      // Color: tierra en la pista, con roderas; hierba fuera; negro en el pozo.
      const r = hash(xm * 3.7 + z * 11.3);
      if (prof[i].pozo && enPista) _col.copy(cOsc);
      else if (prof[i].pozo && z === -1.63) _col.copy(C(amb.estratos[1])).multiplyScalar(0.6);
      else if (z > PISTA) _col.copy(cH2).lerp(cH, 0.4 + r * 0.3);
      else if (Math.abs(z) < 0.2) _col.copy(cT2).lerp(cT, 0.1 + r * 0.25);
      else if (enPista) _col.copy(cT).lerp(cT2, r * 0.45 + (Math.abs(z) > 1.2 ? 0.25 : 0));
      else _col.copy(cH).lerp(cH2, r * 0.6 + Math.max(0, ruido(xm * 0.2 + z) - 0.5));
      col[k] = _col.r; col[k + 1] = _col.g; col[k + 2] = _col.b;
    }
  }
  // Orden de los vertices: con las filas yendo hacia -z, (a, b, c) deja la
  // normal hacia ARRIBA. Al reves, la cara de arriba se descartaba entera y
  // por la pista se veia el cielo.
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
  nivelGrupo.add(m);

  // --- El corte: la pared de delante, con las capas del suelo ---
  // Las capas se miden desde el perfil SUAVIZADO y no desde la superficie:
  // en un corte de verdad los estratos van casi horizontales, y el pozo los
  // corta en vez de hundirlos. Cada capa lleva sus propios vertices, con su
  // color liso: compartiendolos, el color se degradaba de una a otra y el
  // corte salia como una mancha marron sin capas.
  const PROF = [0, 0.16, 0.5, 1.15, 2.05, 3.3, 5.0, 14];
  const est = [C(amb.hierba2)].concat(amb.estratos.map(C));
  const limite = (i, d) => {
    const xm = prof[i].x / K, ym = -prof[i].y / K, base = Tsuave(xm);
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
  nivelGrupo.add(m2);
}

// Lomas de detras y montanas lejanas. Mallas bajas: a esa distancia la niebla
// hace el trabajo.
function construyeFondo(T, amb, Tsuave) {
  const x0 = -80, x1 = T.len / K + 120, paso = 2.5;
  const ZS = [-11.5, -16, -23, -32, -45, -62, -85, -115];
  const nx = Math.ceil((x1 - x0) / paso) + 1, nz = ZS.length;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const cH = C(amb.hierba), cH2 = C(amb.hierba2), cA = C(amb.arbol2);
  for (let i = 0; i < nx; i++) {
    const x = x0 + i * paso;
    for (let j = 0; j < nz; j++) {
      const z = ZS[j];
      const k = (i * nz + j) * 3;
      pos[k] = x; pos[k + 1] = fondoY(Tsuave, x, z) - (j === 0 ? 0.08 : 0); pos[k + 2] = z;
      _col.copy(cH).lerp(cH2, hash(x * 1.3 + z) * 0.7).lerp(cA, Math.min(0.6, j * 0.09));
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
  nivelGrupo.add(m);

  // Dos cordilleras. Muy anchas: a 200 m la camara ve cientos de metros.
  // Bajas: la camara mira casi de lado y el cielo que ve llega a ~11 grados;
  // con 70 m de pico las montanas subian a 13 y tapaban el sol y la luna.
  const cords = [
    { z: -170, alto: 16, base: -30, color: amb.monte[1], f: 0.021, s: 3 },
    { z: -290, alto: 30, base: -30, color: amb.monte[0], f: 0.011, s: 9 },
  ];
  const med = Tsuave(T.len / K * 0.5);
  for (const c of cords) {
    const xa = -300, xb = T.len / K + 450, pasoM = 7;
    const n = Math.ceil((xb - xa) / pasoM) + 1;
    const p = [], ix = [];
    for (let i = 0; i < n; i++) {
      const x = xa + i * pasoM;
      const pico = Math.pow(ruido(x * c.f + c.s), 1.6) * c.alto + ruido(x * c.f * 4 + c.s * 2) * c.alto * 0.18;
      p.push(x, med + c.base + 26 + pico, c.z, x, med + c.base - 60, c.z);
      if (i < n - 1) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const gm = new THREE.BufferGeometry();
    gm.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    gm.setIndex(ix);
    gm.computeVertexNormals();
    nivelGrupo.add(new THREE.Mesh(gm, new THREE.MeshBasicMaterial({ color: c.color })));
  }

  // Nubes: bolas aplastadas en grupos, lejos. De noche no: tapaban la luna
  // y las estrellas con manchas oscuras.
  if (amb.estrellas) return;
  const nubG = new THREE.IcosahedronGeometry(1, 1);
  const nNub = Math.ceil((T.len / K + 400) / 40) * 4;
  const nubes = new THREE.InstancedMesh(nubG, new THREE.MeshLambertMaterial({ color: amb.nube, flatShading: true }), nNub);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3();
  let k = 0;
  for (let gx = -150; k < nNub; gx += 40) {
    const cx = gx + hash(gx) * 25, cy = med + 45 + hash(gx * 3) * 40, cz = -210 - hash(gx * 7) * 60;
    for (let b = 0; b < 4 && k < nNub; b++) {
      const r = 7 + hash(gx + b * 13) * 7;
      pv.set(cx + (b - 1.5) * r * 0.9, cy + hash(gx * 5 + b) * 3, cz);
      s.set(r * 1.4, r * 0.6, r);
      mm.compose(pv, q, s);
      nubes.setMatrixAt(k++, mm);
    }
  }
  nivelGrupo.add(nubes);
}

// Arboles: pinos (dos conos) y frondosos (una bola facetada), instanciados:
// cientos de arboles en seis llamadas de dibujo. Los que quedan cerca de la
// pista dan sombra; los de lejos no pagan ese coste.
function construyeArboles(T, amb, Tsuave) {
  const len = T.len / K + 60;
  const puestos = [];
  // La semilla del nivel entra en cada tirada: con solo la x, los arboles
  // salian en el mismo sitio en los ocho niveles.
  const sem = N.n * 91.7;
  for (let x = -40; x < len; ) {
    // Ninguno pegado a la pista: a 3 m de la camara un arbol de 5 m tapaba
    // media pantalla. Los mas cercanos, a 7 m, y cuanto mas lejos, mas.
    const z = -7 - Math.pow(hash(x * 1.7 + sem), 0.8) * 70;
    const esc = 0.8 + hash(x * 2.9 + sem) * 0.9;
    puestos.push({ x, z, esc, tipo: hash(x * 4.1 + sem) < 0.62 ? 0 : 1, tono: hash(x * 6.3 + sem) });
    x += 1.2 + hash(x * 3.3 + sem) * 3.4;
  }
  const pinos = puestos.filter(p => p.tipo === 0), redondos = puestos.filter(p => p.tipo === 1);
  const mTr = new THREE.MeshLambertMaterial({ color: amb.tronco, flatShading: true });
  const mHo = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const gTr = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 5); gTr.translate(0, 0.7, 0);
  const gC1 = new THREE.ConeGeometry(1.1, 2.2, 7); gC1.translate(0, 2.2, 0);
  const gC2 = new THREE.ConeGeometry(0.75, 1.7, 7); gC2.translate(0, 3.3, 0);
  const gBo = new THREE.IcosahedronGeometry(1.25, 0); gBo.translate(0, 2.3, 0);
  const cA = C(amb.arbol), cA2 = C(amb.arbol2);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3();
  function planta(lista, geos) {
    const mallas = geos.map(([g, m]) => new THREE.InstancedMesh(g, m, lista.length));
    lista.forEach((p, i) => {
      pv.set(p.x, fondoY(Tsuave, p.x, p.z) - 0.1, p.z);
      q.setFromAxisAngle(_Y, p.tono * 6.28);
      s.set(p.esc, p.esc * (0.9 + p.tono * 0.3), p.esc);
      mm.compose(pv, q, s);
      _col.copy(cA).lerp(cA2, p.tono);
      for (const ms of mallas) { ms.setMatrixAt(i, mm); if (ms.material === mHo) ms.setColorAt(i, _col); }
    });
    for (const ms of mallas) { ms.castShadow = true; nivelGrupo.add(ms); }
  }
  planta(pinos, [[gTr, mTr], [gC1, mHo], [gC2, mHo]]);
  planta(redondos, [[gTr, mTr], [gBo, mHo]]);
}
const _Y = new THREE.Vector3(0, 1, 0);

// ---------- Obstaculos ----------
function construyeObstaculos(T, obs) {
  // Todo va a un grupo aparte que al final se junta por material (moto-
  // modelo.js, junta): una rampa sola eran once mallas. Los troncos no se
  // juntan, porque desaparecen al romperse.
  const destino = nivelGrupo;
  nivelGrupo = new THREE.Group();
  const mRoca = new THREE.MeshStandardMaterial({ color: '#8d8f96', roughness: 0.9, flatShading: true });
  const mRoca2 = new THREE.MeshStandardMaterial({ color: '#6c6e75', roughness: 0.95, flatShading: true });
  const mCorteza = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.95, flatShading: true });
  const mCorte = new THREE.MeshStandardMaterial({ color: '#d8b27a', roughness: 0.8 });
  const mMadera = new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.8, flatShading: true });
  const mMadera2 = new THREE.MeshStandardMaterial({ color: '#8a5a30', roughness: 0.9 });
  const mRaya = new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: 0.6 });
  const mNegro = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 });
  const mSenal = new THREE.MeshStandardMaterial({ color: '#ffcc2a', roughness: 0.5 });
  for (const ob of obs) {
    const x = ob.x / K, y = -W.groundY(T, ob.x) / K;
    if (ob.kind === W.OB_ROCK) {
      // Roca: la colision llega a 1.6*h de alto y 0.55*w a cada lado; la
      // roca dibujada ocupa eso mismo, o se muere contra aire.
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 0.78 + hash(ob.x * 0.13 + i * 1.7) * 0.34;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
      }
      g.computeVertexNormals();
      const alto = 1.6 * ob.h / K, rx = 0.55 * ob.w / K;
      const m = new THREE.Mesh(g, mRoca);
      m.scale.set(rx * 1.05, alto * 0.62, 0.95);
      m.position.set(x, y + alto * 0.38, 0.1);
      m.rotation.y = hash(ob.x) * 3;
      m.castShadow = m.receiveShadow = true;
      nivelGrupo.add(m);
      for (let j = 0; j < 3; j++) {           // piedras sueltas alrededor
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + hash(ob.x + j) * 0.14, 0), mRoca2);
        r.position.set(x + (hash(ob.x * 3 + j) - 0.5) * 1.4, y + 0.06, (j - 1) * 0.9 + 0.3);
        r.rotation.set(j, j * 2, 0);
        r.castShadow = true;
        nivelGrupo.add(r);
      }
    } else if (ob.kind === W.OB_LOG) {
      // Tronco atravesado en la pista. Alto = h, como su colision.
      const r = ob.h / K * 0.5;
      const g = new THREE.CylinderGeometry(r, r * 1.05, 3.4, 9);
      const m = new THREE.Mesh(g, [mCorteza, mCorte, mCorte]);
      m.rotation.x = Math.PI / 2;
      m.rotation.y = (hash(ob.x) - 0.5) * 0.25;
      m.position.set(x, y + r * 0.95, 0);
      m.castShadow = m.receiveShadow = true;
      destino.add(m);
      N.troncos.set(ob, m);
    } else if (ob.kind === W.OB_RAMP) {
      // Rampa de tablones: sube de 0 a 1.5*h en su ancho, con el labio pintado.
      const w = ob.w / K, h = ob.h * 1.5 / K;
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0); s.lineTo(w / 2, h); s.lineTo(w / 2, 0); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 2.6, bevelEnabled: false });
      g.translate(0, 0, -1.3);
      const m = new THREE.Mesh(g, mMadera);
      m.position.set(x, y - 0.02, 0);
      m.castShadow = m.receiveShadow = true;
      nivelGrupo.add(m);
      const nT = 5;                            // juntas de los tablones
      for (let i = 1; i < nT; i++) {
        const t = i / nT;
        const j = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 2.62), mMadera2);
        j.position.set(x - w / 2 + w * t, y + h * t + 0.012, 0);
        j.rotation.z = Math.atan2(h, w);
        nivelGrupo.add(j);
      }
      for (let i = 0; i < 6; i++) {           // labio a rayas amarillas y negras
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 2.62 / 6), i % 2 ? mNegro : mRaya);
        b.position.set(x + w / 2 - 0.04, y + h - 0.02, -1.3 + (i + 0.5) * 2.62 / 6);
        nivelGrupo.add(b);
      }
    } else if (ob.kind === W.OB_PIT) {
      // El pozo ya esta en el terreno. Una senal de peligro detras de la
      // pista lo anuncia desde lejos.
      const sx = x - ob.w / K * 0.5 - 1.6, sy = -W.groundY(T, sx * K) / K;
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), mMadera2);
      palo.position.set(sx, sy + 0.65, -2.0);
      const tri = new THREE.Shape();
      tri.moveTo(-0.32, 0); tri.lineTo(0.32, 0); tri.lineTo(0, 0.52); tri.closePath();
      const senal = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), mSenal);
      senal.position.set(sx, sy + 1.1, -1.95);
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), mNegro);
      ex.position.set(sx, sy + 1.33, -1.9);
      const pt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), mNegro);
      pt.position.set(sx, sy + 1.19, -1.9);
      palo.castShadow = senal.castShadow = true;
      nivelGrupo.add(palo, senal, ex, pt);
    }
  }
  junta(nivelGrupo);
  nivelGrupo.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  destino.add(nivelGrupo);
  nivelGrupo = destino;
}

// Salida y meta: dos arcos, el de la meta a cuadros. Y banderines cada 12 m
// al borde de la pista: con el suelo liso no habia nada que contara la
// velocidad, y un poste que pasa rapido es lo que la cuenta.
function construyeMetas(T, amb) {
  const mPoste = new THREE.MeshStandardMaterial({ color: '#e8e8ec', roughness: 0.4, metalness: 0.3 });
  // Pancarta al borde de la pista, DE CARA a la camara: un arco atravesado
  // (como en una carrera de verdad) se veria de canto desde el costado.
  const arco = (xpx, textura, raya) => {
    const x = xpx / K, y = -W.groundY(T, xpx) / K;
    for (const dx of [-1.9, 1.9]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), mPoste);
      p.position.set(x + dx, -W.groundY(T, xpx + dx * K) / K + 1.7, -2.3); p.castShadow = true;
      nivelGrupo.add(p);
    }
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.85),
      new THREE.MeshStandardMaterial({ map: textura, roughness: 0.6, side: THREE.DoubleSide }));
    b.position.set(x, y + 3.0, -2.28); b.castShadow = true;
    nivelGrupo.add(b);
    if (raya) {                         // la linea de meta pintada en la pista
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 3.3),
        new THREE.MeshStandardMaterial({ map: raya, roughness: 0.7 }));
      r.position.set(x, y + 0.01, 0); r.receiveShadow = true;
      nivelGrupo.add(r);
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
    const x = 6 + i * 12, y = -W.groundY(T, x * K) / K;
    mm.makeTranslation(x, y, -1.95);
    postes.setMatrixAt(i, mm);
    ban[i % 2].setMatrixAt(i, mm);
    ban[1 - i % 2].setMatrixAt(i, cero);
  }
  postes.castShadow = true;
  nivelGrupo.add(postes, ban[0], ban[1]);
}
// La pancarta de la salida: FURIA en blanco sobre el rosa de la moto.
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
function texturaCuadros(nx, ny) {
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

function libera(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

// ---------- Particulas ----------
// Terrones: bolas facetadas instanciadas, una sola llamada de dibujo. Humo:
// sprites blandos. Todo con pool fijo: nada se crea mientras se juega.
const parts = [], humos = [];
let partMesh = null;
function creaParticulas() {
  const n = 140;
  partMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), n);
  partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  partMesh.frustumCulled = false;
  partMesh.castShadow = true;
  for (let i = 0; i < n; i++) {
    parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.05, vida: 0, max: 1, gira: 0 });
    partMesh.setColorAt(i, _col.set('#8a6a44'));
  }
  escena.add(partMesh);
  const tex = texturaBlanda();
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#d8c4a4', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    escena.add(s);
    humos.push({ s, vida: 0, max: 1, vx: 0, vy: 0, r0: 0.3, r1: 1 });
  }
}
let partI = 0, humoI = 0;
// Terrones desde un punto de la fisica (px), con color.
export function tierra(xpx, ypx, n, color, fuerza = 1, haciaAtras = 1) {
  if (!partMesh) return;
  _col.set(color);
  for (let k = 0; k < n; k++) {
    const p = parts[partI];
    partMesh.setColorAt(partI, _col.clone().multiplyScalar(0.8 + Math.random() * 0.4));
    partI = (partI + 1) % parts.length;
    p.x = xpx / K; p.y = -ypx / K + 0.05; p.z = (Math.random() - 0.5) * 0.6;
    p.vx = (-haciaAtras * (1 + Math.random() * 3) + (Math.random() - 0.5) * 1.5) * fuerza;
    p.vy = (1.5 + Math.random() * 3.5) * fuerza;
    p.vz = (Math.random() - 0.3) * 2 * fuerza;
    p.r = 0.03 + Math.random() * 0.06;
    p.max = p.vida = 0.5 + Math.random() * 0.6;
    p.gira = Math.random() * 6;
  }
  partMesh.instanceColor.needsUpdate = true;
}
export function humo(xpx, ypx, n, fuerza = 1) {
  for (let k = 0; k < n; k++) {
    const h = humos[humoI];
    humoI = (humoI + 1) % humos.length;
    h.s.position.set(xpx / K + (Math.random() - 0.5) * 0.4, -ypx / K + 0.15, 0.3 + Math.random() * 0.6);
    h.vx = (Math.random() - 0.7) * 1.5 * fuerza; h.vy = 0.3 + Math.random() * 0.6;
    h.max = h.vida = 0.6 + Math.random() * 0.5;
    h.r0 = 0.25 * fuerza; h.r1 = (0.9 + Math.random() * 0.6) * fuerza;
    h.s.material.color.set(N ? N.amb.tierra : '#d8c4a4').lerp(_col.set('#ffffff'), 0.35);
    h.s.visible = true;
  }
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function mueveParticulas(dt) {
  if (!N) return;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.vida <= 0) { partMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); continue; }
    p.vida -= dt;
    p.vy -= 18 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const suelo = -W.sueloVisible(N.T, N.obs, p.x * K) / K;
    if (p.y < suelo + p.r && Math.abs(p.z) < 1.8) { p.y = suelo + p.r; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    const esc = p.r * Math.min(1, p.vida / p.max * 2.5);
    _e.set(p.gira * p.vida, p.gira * 0.7 * p.vida, 0);
    partMesh.setMatrixAt(i, _m4.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(esc, esc, esc)));
  }
  partMesh.instanceMatrix.needsUpdate = true;
  for (const h of humos) {
    if (h.vida <= 0) { if (h.s.visible) h.s.visible = false; continue; }
    h.vida -= dt;
    const t = 1 - h.vida / h.max;
    h.s.position.x += h.vx * dt; h.s.position.y += h.vy * dt;
    const r = h.r0 + (h.r1 - h.r0) * t;
    h.s.scale.set(r, r, r);
    h.s.material.opacity = (1 - t) * 0.55;
  }
}

// ---------- La moto en el mundo ----------
// Cuanto cuelga cada rueda por debajo de su anclaje: lo que haga falta para
// que APOYE en el suelo que se ve, entre tope y tope de la suspension. La
// fisica no guarda donde esta la rueda (su resorte es virtual), asi que se
// calcula aqui. Comprime al instante (la rueda nunca atraviesa el suelo) y se
// extiende con suavidad (el muelle tarda en estirarse).
const DMIN = 3, DMAX = W.SUSP_MAX;          // px (el pozo usa el mismo tope)
const rv = { dT: 12, dD: 12 };
function cuelga(B, lado, dt) {
  const c = Math.cos(B.ang), s = Math.sin(B.ang);
  const ax = B.x + lado * c * HWpx, ay = B.y + lado * s * HWpx;
  let d = (W.sueloVisible(N.T, N.obs, ax) - W.WHEEL_R - ay) / Math.max(0.3, c);
  d = (W.sueloVisible(N.T, N.obs, ax - s * d) - W.WHEEL_R - ay) / Math.max(0.3, c);
  d = Math.min(DMAX, Math.max(DMIN, d));
  const clave = lado > 0 ? 'dD' : 'dT';
  if (d < rv[clave]) rv[clave] = d;
  else rv[clave] += (d - rv[clave]) * Math.min(1, dt * 14);
  return rv[clave];
}

const _bi = { x: 0, y: 0, ang: 0 };
const sueloM = (xm) => -W.sueloVisible(N.T, N.obs, xm * K) / K;

// Estado de la piloto: se suaviza, para que no salte de postura.
const pose = { agache: 0, aire: 0, cuerpo: 0, hunde: 0, viento: 0 };
let giroRueda = 0;

// ---------- Camara ----------
// Encuadre de moto-world.js (W.CAM): el ancho de mundo que se ve en el plano
// de la pista crece con la velocidad, y la moto va al 28 % desde la izquierda.
// La camara se pone a la distancia que da ese ancho con su angulo de vision,
// un poco por encima (se ve la cara de arriba de la pista, que es lo que da el
// volumen) y un poco por delante (se ve la moto de tres cuartos, con la cara
// de la piloto, y no de perfil plano).
const PITCH = 0.085, YAW = 0.16;
// Solo para las herramientas (tools/ver-app.js): fijar el ancho de la vista
// para mirar la moto de cerca. En el juego se queda a 0.
export const depura = { span: 0 };
const _look = new THREE.Vector3();
function colocaCamara(bx, by, vx, dt, muerto) {
  const objetivoSpan = depura.span || W.span(muerto ? 0 : vx);
  const k = cam.lista ? Math.min(1, dt * 1.6) : 1;
  cam.span += (objetivoSpan - cam.span) * k;
  const spanM = cam.span / K;
  // Punto al que se mira: por delante de la moto lo justo para que la moto
  // quede al 28 %, y un poco por encima del suelo.
  const tx = bx + spanM * (0.5 - W.CAM.bikeAt);
  const suelo = N ? N.Tsuave(tx) : by;
  const ty = Math.max(by, suelo) * 0.55 + suelo * 0.45 + 1.35;
  if (!cam.lista) { cam.x = tx; cam.y = ty; cam.lista = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt * 7);
  cam.y += (ty - cam.y) * Math.min(1, dt * 3.2);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const dist = spanM / (2 * tanV * camara.aspect);
  _look.set(cam.x, cam.y, 0);
  camara.position.set(
    cam.x + Math.sin(YAW) * Math.cos(PITCH) * dist,
    cam.y + Math.sin(PITCH) * dist,
    Math.cos(YAW) * Math.cos(PITCH) * dist);
  if (cam.sacT > 0) {
    cam.sacT -= dt;
    const m = cam.sac * Math.min(1, cam.sacT * 4) * 0.06;
    camara.position.x += (Math.random() - 0.5) * m;
    camara.position.y += (Math.random() - 0.5) * m;
  }
  camara.lookAt(_look);
  // El sol, la sombra y el cielo siguen a la camara: la sombra cubre lo que
  // se ve, y el cielo nunca se acaba.
  const a = N.amb;
  sol.position.set(cam.x + a.solDir[0] * 40, cam.y + a.solDir[1] * 40, a.solDir[2] * 40);
  sol.target.position.set(cam.x, cam.y - 1, 0);
  cieloMesh.position.copy(camara.position);
  estrellas.position.copy(camara.position);
  // Bajo en el cielo, que es donde lo ve una camara que mira casi de lado:
  // mas arriba quedaba fuera del encuadre en todos los niveles.
  disco.position.set(camara.position.x + (a.disco[0] - 0.5) * 700, camara.position.y + 8 + a.disco[1] * 75, -560);
  const rd = N.amb.estrellas ? 70 : 150;
  disco.scale.set(rd, rd, 1);
}
export function sacude(mag, dur) { if (mag >= cam.sac || cam.sacT <= 0) { cam.sac = mag; cam.sacT = dur; } }

// Donde cae en pantalla un punto de la fisica, en FRACCION del ancho y del
// alto (0..1): el lienzo WebGL y el del HUD no miden lo mismo.
const _pr = new THREE.Vector3();
export function aPantalla(xpx, ypx) {
  _pr.set(xpx / K, -ypx / K, 0).project(camara);
  return [_pr.x * 0.5 + 0.5, -_pr.y * 0.5 + 0.5];
}

// ---------- Un frame ----------
// e = { x, y, ang (interpolados, px), B (el estado de la fisica), dt,
//       muerto, lean, tiempo }
export function frame(e) {
  if (!R || !N) return null;
  const B = e.B;
  mueveParticulas(e.dt);
  const dt = e.dt;

  // Moto: posicion y giro de la fisica, pasados a metros y con y hacia arriba.
  moto.grupo.position.set(e.x / K, -e.y / K, 0);
  moto.grupo.rotation.z = -e.ang;
  _bi.x = e.x; _bi.y = e.y; _bi.ang = e.ang;
  const dT = cuelga(_bi, -1, dt) / K, dD = cuelga(_bi, 1, dt) / K;
  giroRueda += (B.vx / W.WHEEL_R) * dt;
  const k = Math.min(1, dt * 7);
  const suelo = B.onGround ? 1 : 0;
  pose.agache += (Math.min(1, B.vx / 520) * suelo - pose.agache) * k;
  pose.aire += ((B.onGround ? 0 : Math.min(1, B.air * 3)) - pose.aire) * k;
  pose.cuerpo += (e.lean - pose.cuerpo) * Math.min(1, dt * 9);
  const comp = Math.max(0, (12 - Math.min(dT, dD) * K) / 12);
  pose.hunde += (comp * 0.12 - pose.hunde) * Math.min(1, dt * 16);
  pose.viento += (Math.min(1, B.vx / 400) - pose.viento) * k;
  moto.actualiza(dT, dD, giroRueda, pose, e.tiempo);
  // La piloto, si salio despedida, cae por su cuenta.
  moto.cae(dt, sueloM);

  colocaCamara(e.x / K, -e.y / K, B.vx, dt, e.muerto);
  vigilaRendimiento();
  R.render(escena, camara);
  return canvasGL;
}

// La piloto sale despedida al estrellarse.
export function choque(vxpx, vypx) { moto.suelta(vxpx / K, -vypx / K, N); }

// El tronco roto desaparece; salta madera.
export function rompeTronco(ob) {
  const m = N && N.troncos.get(ob);
  if (m) m.visible = false;
  tierra(ob.x, W.groundY(N.T, ob.x) - ob.h * 0.5, 16, '#a0703f', 1.3, -0.4);
}

// ---------- Calidad automatica ----------
// El telefono de ella no es el PC. Si los frames tardan de mas (a 60 Hz, mas
// de 22 ms de media durante un segundo y medio), el render baja de resolucion
// un escalon; si van sobrados mucho rato, sube. El juego no cambia: solo lo
// nitido que sale.
function vigilaRendimiento() {
  const ahora = performance.now();
  if (medidor.t0) {
    const d = ahora - medidor.t0;
    if (d < 200) { medidor.suma += d; medidor.n++; }
  }
  medidor.t0 = ahora;
  if (medidor.n >= 90) {
    const media = medidor.suma / medidor.n;
    if (media > 22 && calidad > 0.5) { calidad = Math.max(0.5, calidad - 0.125); ajustaTamano(); medidor.bajo = 0; }
    // Ultimo escalon: sin sombras. Es lo que mas cuesta despues de la
    // resolucion (medido: un 40 % del frame).
    else if (media > 24 && R.shadowMap.enabled) { R.shadowMap.enabled = false; recompila(); }
    else if (media < 17.5) { if (++medidor.bajo >= 4 && calidad < 0.75) { calidad += 0.125; ajustaTamano(); medidor.bajo = 0; } }
    else medidor.bajo = 0;
    medidor.n = 0; medidor.suma = 0;
  }
}
export function fuerzaCalidad(q) { calidad = q; ajustaTamano(); }
function recompila() {
  escena.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
}

export function sal() {
  // Se deja el renderizador vivo (ver arriba) pero se suelta el nivel.
  if (nivelGrupo) { escena.remove(nivelGrupo); libera(nivelGrupo); nivelGrupo = null; }
  N = null;
}

