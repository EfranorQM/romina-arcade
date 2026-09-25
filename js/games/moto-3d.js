// FURIA - el mundo en 3D: luz, cielo, camara, particulas, estrellas y la moto.
//
// LO QUE ES "ENTRE 3D Y 2D". La partida sigue siendo 2D: la fisica
// (moto-world.js) vive en un plano, en px, y esta medida con su arnes. Aqui
// ese plano se pone en un mundo de verdad -- con profundidad, luz, sombras y
// niebla -- y la camara lo mira de costado, un poco desde arriba y desde
// delante. Se juega de lado; se ve con volumen.
//
// Las piezas: moto-pista3d.js (terreno en corte, lomas, montañas, nubes,
// salida y meta), moto-decor.js (arboles, rocas, flores... de Kenney),
// moto-obs3d.js (los obstaculos), moto-modelo.js (la moto y la piloto) y
// moto-bioma.js (los colores de cada nivel).
//
// El render va a un lienzo WebGL propio que furia.js copia en el suyo, debajo
// del HUD. El renderizador se crea UNA vez para toda la vida de la app: crear
// y tirar contextos WebGL en cada partida acaba en el tope del navegador.

import * as THREE from '../vendor/three-moto.js';
import * as W from './moto-world.js';
import { creaMoto } from './moto-modelo.js';
import { mundo as mundoDe } from './moto-bioma.js';
import { decora } from './moto-decor.js';
import { K, hash, creaSuelo, construyeTerreno, construyeFondo, construyeMetas } from './moto-pista3d.js';
import { construyeObstaculos } from './moto-obs3d.js';

export { K };
const HWpx = W.WHEELBASE * 0.5;
export const mundo = mundoDe;

// ---------- Estado del modulo ----------
let R = null, canvasGL = null;
let escena = null, camara = null, sol = null, hemi = null;
let cieloMat = null, cieloMesh = null, disco = null, estrellasCielo = null;
let nivelGrupo = null;                      // lo que se tira al cambiar de nivel
let moto = null;
let N = null;                               // datos del nivel
const cam = { x: 0, y: 0, span: W.CAM.spanMin, sac: 0, sacT: 0, lista: false, fov: 32, aire: 0 };

// El render sale a una fraccion del lienzo del juego y se estira al copiarlo.
// Arranca en 0.75 y baja sola si el telefono no llega (ver vigilaRendimiento).
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
  // una zona pequeña es lo que la deja nitida bajo la moto.
  const sc = sol.shadow.camera;
  sc.left = -18; sc.right = 18; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 90;
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

  // Sol o luna: un disco con halo.
  disco = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaHalo(), color: '#ffffff', depthWrite: false, fog: false, blending: THREE.AdditiveBlending, transparent: true }));
  disco.renderOrder = -9;
  escena.add(disco);

  // Estrellas del cielo, solo de noche, en la franja que ve la camara.
  const pos = [];
  for (let i = 0; i < 420; i++) {
    const a = hash(i * 3.1) * Math.PI - Math.PI / 2, e = 0.02 + Math.pow(hash(i * 7.7), 1.4) * 0.33;
    pos.push(Math.sin(a) * Math.cos(e) * 600, Math.sin(e) * 600, -Math.cos(a) * Math.cos(e) * 600);
  }
  const eg = new THREE.BufferGeometry();
  eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  estrellasCielo = new THREE.Points(eg, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }));
  estrellasCielo.renderOrder = -9;
  escena.add(estrellasCielo);

  moto = creaMoto();
  escena.add(moto.grupo);
  creaParticulas();
  creaAmbiente();
  creaEstrellasPremio();
}

function texturaRadial(stops, lado = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  for (const [p, a] of stops) gr.addColorStop(p, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, lado, lado);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texturaHalo = () => texturaRadial([[0, 1], [0.16, 1], [0.2, 0.45], [0.45, 0.12], [1, 0]]);
const texturaBlanda = () => texturaRadial([[0, 0.9], [0.5, 0.45], [1, 0]], 64);

// ---------- El nivel ----------
export function nivel(T, obs, estrellas, n) {
  if (!R) return;
  if (nivelGrupo) { escena.remove(nivelGrupo); libera(nivelGrupo); }
  nivelGrupo = new THREE.Group();
  escena.add(nivelGrupo);
  const M = mundoDe(n), CI = M.cielo;
  const sem = n * 173.3;
  N = { T, obs, estrellas, n, M, CI, t: 0 };

  // Luz y cielo.
  cieloMat.uniforms.cA.value.set(CI.cielo[0]);
  cieloMat.uniforms.cM.value.set(CI.cielo[1]);
  cieloMat.uniforms.cB.value.set(CI.cielo[2]);
  escena.fog = new THREE.Fog(CI.niebla, 45, CI.nieblaLejos);
  hemi.color.set(CI.cieloL); hemi.groundColor.set(CI.sueloL); hemi.intensity = CI.hemiI;
  sol.color.set(CI.sol); sol.intensity = CI.solI;
  R.toneMappingExposure = CI.exp;
  disco.material.color.set(CI.discoCol);
  estrellasCielo.visible = CI.estrellas;
  moto.faro(CI.faro);

  const suelo = creaSuelo(T, sem);
  N.Tsuave = suelo.Tsuave;
  construyeTerreno(nivelGrupo, T, obs, M, suelo);
  construyeFondo(nivelGrupo, T, M, suelo);
  construyeMetas(nivelGrupo, T);
  // Donde el borde de la pista se deja limpio: pozos y rampas se tienen que
  // ver bien, sin una flor delante.
  const libres = obs.filter(o => o.kind === W.OB_PIT || o.kind === W.OB_RAMP || o.kind === W.OB_RAMPA_G)
    .map(o => [(o.x - o.w * 0.5) / K, (o.x + o.w * 0.5) / K]);
  const dec = decora(nivelGrupo, M, { largo: T.len / K, suelo: suelo.fondoY, libres, sem, inicio: 1.5, fin: (T.len - 200) / K });
  N.hogueras = dec.hogueras;
  N.vivos = construyeObstaculos(nivelGrupo, T, obs, M);
  preparaEstrellasPremio(estrellas);
  preparaAmbiente(M);
  preparaHogueras(dec.hogueras);

  cam.lista = false;
  moto.reinicia();
  for (const p of parts) p.vida = 0;
  // Se compilan YA los shaders de todo lo que puede salir en el nivel (el
  // polvo y el haz del faro, aunque aun no se vean): compilarlos la primera
  // vez que aparecen daba un tiron en mitad de la partida.
  for (const p of humos) p.s.visible = true;
  colocaCamara(120 / K, -W.groundY(T, 120) / K, 0, 0, false, true);
  R.compile(escena, camara);
  for (const p of humos) { p.vida = 0; p.s.visible = false; }
}

function libera(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

// ---------- Estrellas que se cogen ----------
// Una estrella de oro facetada que gira, y un halo detras: dos mallas
// instanciadas para todas las del nivel. Al cogerla, desaparece con un
// estallido de chispas doradas.
let premio = null, premioHalo = null;
const PREMIO_MAX = 60;
function creaEstrellasPremio() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.14 : 0.32;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 });
  g.translate(0, 0, -0.04);
  premio = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffc93a', emissive: '#ff9a00', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 }), PREMIO_MAX);
  premio.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  premio.frustumCulled = false;
  premio.castShadow = true;
  premioHalo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texturaRadial([[0, 0.8], [0.35, 0.35], [1, 0]], 64), color: '#ffd76a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), PREMIO_MAX);
  premioHalo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  premioHalo.frustumCulled = false;
  escena.add(premio, premioHalo);
}
function preparaEstrellasPremio(lista) {
  N.premio = lista.slice(0, PREMIO_MAX);
  N.premioT = N.premio.map(() => 0);        // tiempo desde que se cogio
  premio.count = premioHalo.count = N.premio.length;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function mueveEstrellasPremio(dt, t) {
  const cx = cam.x;
  for (let i = 0; i < N.premio.length; i++) {
    const e = N.premio[i];
    const x = e.x / K, y = -e.y / K;
    let esc = Math.abs(x - cx) < 40 ? 1 : 0;
    if (e.got) {
      N.premioT[i] += dt;
      esc = Math.max(0, 1 - N.premioT[i] * 6) * (1 + N.premioT[i] * 4);
    }
    const bote = Math.sin(t * 3 + i) * 0.06;
    _e.set(0, t * 2.4 + i, 0);
    premio.setMatrixAt(i, _m4.compose(_p.set(x, y + bote, 0), _q.setFromEuler(_e), _s.set(esc, esc, esc)));
    const h = esc * (0.95 + Math.sin(t * 5 + i * 2) * 0.1);
    _q.identity();
    premioHalo.setMatrixAt(i, _m4.compose(_p.set(x, y + bote, -0.1), _q, _s.set(h, h, h)));
  }
  premio.instanceMatrix.needsUpdate = true;
  premioHalo.instanceMatrix.needsUpdate = true;
}
export function cogeEstrella(e) {
  chispas(e.x, e.y, 14, '#ffd76a');
}

// ---------- Particulas ----------
// Terrones, chispas y confeti: bolas facetadas instanciadas, una sola llamada.
// Humo: sprites blandos. Todo con pool fijo: nada se crea mientras se juega.
const parts = [], humos = [];
let partMesh = null;
const _col = new THREE.Color();
function creaParticulas() {
  const n = 200;
  partMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), n);
  partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  partMesh.frustumCulled = false;
  partMesh.castShadow = true;
  for (let i = 0; i < n; i++) {
    parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.05, vida: 0, max: 1, gira: 0, grav: 18, plano: false });
    partMesh.setColorAt(i, _col.set('#8a6a44'));
  }
  escena.add(partMesh);
  const tex = texturaBlanda();
  for (let i = 0; i < 30; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#d8c4a4', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    escena.add(s);
    humos.push({ s, vida: 0, max: 1, vx: 0, vy: 0, r0: 0.3, r1: 1 });
  }
}
let partI = 0, humoI = 0;
function lanza(x, y, z, vx, vy, vz, r, vida, color, grav = 18, plano = false) {
  const p = parts[partI];
  partMesh.setColorAt(partI, _col.set(color));
  partI = (partI + 1) % parts.length;
  p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
  p.r = r; p.max = p.vida = vida; p.gira = Math.random() * 8; p.grav = grav; p.plano = plano;
}
// Terrones desde un punto de la fisica (px), con color.
export function tierra(xpx, ypx, n, color, fuerza = 1, haciaAtras = 1) {
  if (!partMesh) return;
  const base = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const c = '#' + base.clone().multiplyScalar(0.8 + Math.random() * 0.4).getHexString();
    lanza(xpx / K, -ypx / K + 0.05, (Math.random() - 0.5) * 0.6,
      (-haciaAtras * (1 + Math.random() * 3) + (Math.random() - 0.5) * 1.5) * fuerza,
      (1.5 + Math.random() * 3.5) * fuerza, (Math.random() - 0.3) * 2 * fuerza,
      0.03 + Math.random() * 0.06, 0.5 + Math.random() * 0.6, c);
  }
  partMesh.instanceColor.needsUpdate = true;
}
function chispas(xpx, ypx, n, color) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3;
    lanza(xpx / K, -ypx / K, 0.2, Math.cos(a) * v, Math.sin(a) * v + 1, (Math.random() - 0.5), 0.04 + Math.random() * 0.03, 0.35 + Math.random() * 0.3, color, 4);
  }
  partMesh.instanceColor.needsUpdate = true;
}
export function confeti(xpx, ypx) {
  const cols = ['#ff2e63', '#ffd23a', '#5ad0ff', '#7dff8a', '#ffffff', '#b07cff'];
  for (let k = 0; k < 90; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 4 + Math.random() * 6;
    lanza(xpx / K + (Math.random() - 0.5) * 3, -ypx / K + 0.5, (Math.random() - 0.5) * 2,
      Math.cos(a) * v * 0.5, -Math.sin(a) * v, (Math.random() - 0.5) * 2, 0.05 + Math.random() * 0.04,
      1.6 + Math.random() * 1.2, cols[k % cols.length], 5, true);
  }
  partMesh.instanceColor.needsUpdate = true;
}
export function humo(xpx, ypx, n, fuerza = 1, color) {
  for (let k = 0; k < n; k++) {
    const h = humos[humoI];
    humoI = (humoI + 1) % humos.length;
    h.s.position.set(xpx / K + (Math.random() - 0.5) * 0.4, -ypx / K + 0.15, 0.3 + Math.random() * 0.6);
    h.vx = (Math.random() - 0.7) * 1.5 * fuerza; h.vy = 0.3 + Math.random() * 0.6;
    h.max = h.vida = 0.6 + Math.random() * 0.5;
    h.r0 = 0.25 * fuerza; h.r1 = (0.9 + Math.random() * 0.6) * fuerza;
    h.s.material.color.set(color || (N ? N.M.bioma.tierra : '#d8c4a4')).lerp(_col.set('#ffffff'), 0.35);
    h.s.visible = true;
  }
}
function mueveParticulas(dt) {
  if (!N) return;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.vida <= 0) { partMesh.setMatrixAt(i, _m4.makeScale(0, 0, 0)); continue; }
    p.vida -= dt;
    p.vy -= p.grav * dt;
    if (p.plano) { p.vx *= 1 - 1.5 * dt; p.vy = Math.max(p.vy, -1.6); }   // el confeti planea
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const suelo = -W.sueloVisible(N.T, N.obs, p.x * K) / K;
    if (p.y < suelo + p.r && Math.abs(p.z) < 1.8) { p.y = suelo + p.r; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    const esc = p.r * Math.min(1, p.vida / p.max * 2.5);
    _e.set(p.gira * p.vida, p.gira * 0.7 * p.vida, p.plano ? p.gira * p.vida * 2 : 0);
    const ex = p.plano ? esc * 1.6 : esc, ey = p.plano ? esc * 0.25 : esc;
    partMesh.setMatrixAt(i, _m4.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(ex, ey, esc)));
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

// ---------- Ambiente: nieve que cae, luciernagas, motas al sol ----------
// Una nube de puntos que sigue a la camara y se recicla: 300 puntos, una
// llamada. Cada bioma la usa a su manera.
let amb = null;
const AMB_N = 300;
function creaAmbiente() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(AMB_N * 3), 3));
  const mat = new THREE.PointsMaterial({ map: texturaRadial([[0, 1], [0.4, 0.7], [1, 0]], 32), size: 0.12, transparent: true, depthWrite: false, color: '#ffffff' });
  amb = new THREE.Points(g, mat);
  amb.frustumCulled = false;
  escena.add(amb);
  amb.userData.v = new Float32Array(AMB_N * 3);
}
function preparaAmbiente(M) {
  const tipo = M.bioma.particulas;
  amb.userData.tipo = tipo;
  const mat = amb.material;
  if (tipo === 'nieve') { mat.color.set('#ffffff'); mat.size = 0.13; mat.blending = THREE.NormalBlending; mat.opacity = 0.9; }
  else if (tipo === 'luciernagas') { mat.color.set('#d8ff6a'); mat.size = 0.16; mat.blending = THREE.AdditiveBlending; mat.opacity = 1; }
  else { mat.color.set(M.cielo.estrellas ? '#8aa0ff' : '#fff3c8'); mat.size = 0.06; mat.blending = THREE.AdditiveBlending; mat.opacity = 0.6; }
  mat.needsUpdate = true;
  const p = amb.geometry.attributes.position.array;
  for (let i = 0; i < AMB_N; i++) recicla(i, p, true);
  amb.geometry.attributes.position.needsUpdate = true;
}
function recicla(i, p, inicial) {
  const v = amb.userData.v, tipo = amb.userData.tipo;
  const x = cam.x + (Math.random() - 0.3) * 40, z = 2 - Math.random() * 22;
  const y0 = (N && N.Tsuave ? N.Tsuave(x) : 0);
  p[i * 3] = x; p[i * 3 + 2] = z;
  if (tipo === 'nieve') {
    p[i * 3 + 1] = y0 + (inicial ? Math.random() * 14 : 12 + Math.random() * 3);
    v[i * 3] = -0.4 - Math.random() * 0.5; v[i * 3 + 1] = -1.2 - Math.random() * 0.8; v[i * 3 + 2] = 0;
  } else if (tipo === 'luciernagas') {
    p[i * 3 + 1] = y0 + 0.3 + Math.random() * 3;
    v[i * 3] = (Math.random() - 0.5) * 0.4; v[i * 3 + 1] = (Math.random() - 0.5) * 0.3; v[i * 3 + 2] = Math.random() * 6.28;
  } else {
    p[i * 3 + 1] = y0 + Math.random() * 6;
    v[i * 3] = 0.1 + Math.random() * 0.2; v[i * 3 + 1] = (Math.random() - 0.5) * 0.1; v[i * 3 + 2] = Math.random() * 6.28;
  }
}
function mueveAmbiente(dt, t) {
  const p = amb.geometry.attributes.position.array, v = amb.userData.v, tipo = amb.userData.tipo;
  const n = tipo === 'luciernagas' ? 90 : tipo === 'nieve' ? AMB_N : 120;
  amb.geometry.setDrawRange(0, n);
  for (let i = 0; i < n; i++) {
    if (tipo === 'nieve') {
      p[i * 3] += (v[i * 3] + Math.sin(t + i) * 0.3) * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt;
    } else {
      p[i * 3] += (v[i * 3] + Math.sin(t * 0.7 + v[i * 3 + 2]) * 0.2) * dt;
      p[i * 3 + 1] += (v[i * 3 + 1] + Math.cos(t * 0.9 + v[i * 3 + 2]) * 0.15) * dt;
    }
    const y0 = N.Tsuave(p[i * 3]);
    if (p[i * 3] < cam.x - 16 || p[i * 3] > cam.x + 28 || p[i * 3 + 1] < y0 - 1 || p[i * 3 + 1] > y0 + 16) recicla(i, p, false);
  }
  amb.geometry.attributes.position.needsUpdate = true;
  // Las luciernagas parpadean todas a la vez un poco (una sola opacidad).
  if (tipo === 'luciernagas') amb.material.opacity = 0.55 + Math.sin(t * 3) * 0.35;
}

// Hogueras del campamento: un resplandor aditivo que tiembla.
let brasas = [];
function preparaHogueras(lista) {
  brasas = [];
  const tex = texturaRadial([[0, 1], [0.3, 0.5], [1, 0]], 64);
  for (const [x, y, z] of lista) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ff9a3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y + 0.3, z);
    s.scale.set(2.4, 2.4, 1);
    nivelGrupo.add(s);
    brasas.push(s);
  }
}

// ---------- La moto en el mundo ----------
// Cuanto cuelga cada rueda por debajo de su anclaje: lo que haga falta para
// que APOYE en el suelo que se ve, entre tope y tope de la suspension.
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
const pose = { agache: 0, aire: 0, cuerpo: 0, hunde: 0, viento: 0, truco: { id: null, k: 0 }, celebra: 0 };
let giroRueda = 0;

// ---------- Camara ----------
// Encuadre de moto-world.js (W.CAM): el ancho de mundo que se ve en el plano
// de la pista crece con la velocidad (y un escalon mas con el turbo), y la moto
// va al 28 % desde la izquierda. En un vuelo alto se abre un poco mas para que
// se vea donde se va a caer. Un poco por encima (se ve la cara de arriba de la
// pista, que es lo que da el volumen) y un poco por delante (se ve la moto de
// tres cuartos, con la cara de la piloto).
const PITCH = 0.085, YAW = 0.16;
// Solo para las herramientas (tools/ver-app.js): fijar el ancho de la vista
// para mirar la moto de cerca. En el juego se queda a 0.
export const depura = { span: 0 };
const _look = new THREE.Vector3();
function colocaCamara(bx, by, vx, dt, muerto, alto) {
  const objetivoSpan = depura.span || W.span(muerto ? 0 : vx) * (1 + cam.aire * 0.3);
  const k = cam.lista ? Math.min(1, dt * 1.6) : 1;
  cam.span += (objetivoSpan - cam.span) * k;
  const spanM = cam.span / K;
  const tx = bx + spanM * (0.5 - W.CAM.bikeAt);
  const suelo = N ? N.Tsuave(tx) : by;
  // En alto la camara sube con la moto (3/4 de su altura): con la mitad, en
  // el salto gigante la moto se salia por arriba de la pantalla.
  const sobre = Math.max(0, by - suelo);
  const ty = suelo + sobre * (sobre > 2 ? 0.8 : 0.55) + 1.35;
  if (!cam.lista || alto) { cam.x = tx; cam.y = ty; cam.lista = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt * 7);
  cam.y += (ty - cam.y) * Math.min(1, dt * (sobre > 2 ? 7 : 4.5));
  if (Math.abs(camara.fov - cam.fov) > 0.01) { camara.fov += (cam.fov - camara.fov) * Math.min(1, dt * 5); camara.updateProjectionMatrix(); }
  const tanV = Math.tan(THREE.MathUtils.degToRad(32 / 2));
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
  // El sol, la sombra y el cielo siguen a la camara.
  const a = N.CI;
  sol.position.set(cam.x + a.solDir[0] * 40, cam.y + a.solDir[1] * 40, a.solDir[2] * 40);
  sol.target.position.set(cam.x, cam.y - 1, 0);
  cieloMesh.position.copy(camara.position);
  estrellasCielo.position.copy(camara.position);
  disco.position.set(camara.position.x + (a.disco[0] - 0.5) * 700, camara.position.y + 8 + a.disco[1] * 75, -560);
  const rd = a.estrellas ? 70 : 150;
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
// e = { x, y, ang (interpolados, px), B (la fisica), dt, muerto, lean, tiempo,
//       truco: { id, k }, celebra: 0..1 }
export function frame(e) {
  if (!R || !N) return null;
  const B = e.B, dt = e.dt;
  N.t += dt;
  mueveParticulas(dt);
  mueveEstrellasPremio(dt, N.t);
  mueveAmbiente(dt, N.t);
  for (const tb of N.vivos.turbos) tb.t.offset.x = -((N.t * 1.6) % 1);
  for (const s of brasas) { const f = 2.2 + Math.sin(N.t * 13 + s.position.x) * 0.25 + Math.sin(N.t * 7.3) * 0.2; s.scale.set(f, f, 1); }

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
  pose.truco = e.truco || { id: null, k: 0 };
  pose.celebra += ((e.celebra || 0) - pose.celebra) * Math.min(1, dt * 6);
  moto.actualiza(dT, dD, giroRueda, pose, N.t);
  moto.cae(dt, sueloM);
  moto.turbo(B.turbo > 0, N.t);

  // Turbo: chispas del escape y un poco mas de angulo (se siente la
  // velocidad). En un vuelo alto, la camara se abre un poco.
  if (B.turbo > 0 && !e.muerto && Math.random() < 0.7) {
    const c = Math.cos(e.ang), s = Math.sin(e.ang);
    lanza(e.x / K - c * 0.9, -e.y / K + s * 0.9 + 0.2, 0.15, -2 - Math.random() * 2, 0.5 + Math.random(), 0, 0.035, 0.25, Math.random() < 0.5 ? '#5ff0ff' : '#ffffff', 2);
    partMesh.instanceColor.needsUpdate = true;
  }
  cam.fov = B.turbo > 0 ? 35 : 32;
  const alt = (W.groundY(N.T, e.x) - e.y) / K;
  cam.aire += ((B.onGround ? 0 : Math.min(1, Math.max(0, (alt - 1.5) / 3))) - cam.aire) * Math.min(1, dt * 2);

  colocaCamara(e.x / K, -e.y / K, B.vx, dt, e.muerto);
  vigilaRendimiento();
  R.render(escena, camara);
  return canvasGL;
}

// La piloto sale despedida al estrellarse.
export function choque(vxpx, vypx) { moto.suelta(vxpx / K, -vypx / K, N); }

// Un tronco o una caja rotos desaparecen; salta madera.
export function rompe(ob) {
  const m = N && N.vivos.rompibles.get(ob);
  if (m) m.visible = false;
  tierra(ob.x, W.groundY(N.T, ob.x) - ob.h * 0.5, 18, ob.kind === W.OB_CAJA ? '#c08a4e' : '#a0703f', 1.4, -0.4);
}

// ---------- Calidad automatica ----------
// Si los frames tardan de mas (a 60 Hz, mas de 22 ms de media durante un
// segundo y medio), el render baja de resolucion un escalon; si van sobrados
// mucho rato, sube. Ultimo escalon: sin sombras.
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
