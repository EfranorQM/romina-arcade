// FURIA - la moto y la piloto, en 3D.
//
// Se construyen con piezas de three.js (cilindros, toros, perfiles extruidos)
// y se mueven con la fisica de moto-world.js, que sigue siendo 2D: la moto
// vive en el plano z=0 y la camara la mira un poco desde arriba y desde
// delante. Eso es lo "entre 3D y 2D": se juega de costado, se ve con volumen.
//
// UNIDADES: metros. 43 px de la fisica = 1 m (moto-3d.js, K). Con eso la
// distancia entre ejes de la fisica (64 px) sale 1.49 m y la rueda (12 px) de
// 0.28 m de radio, que son las de una moto de cross de verdad.
//
// EJES LOCALES: +X hacia delante, +Y arriba, +Z hacia la camara. El origen es
// la linea del chasis, a medio camino entre los dos ejes de la fisica; el
// suelo queda ~0.52 m por debajo con la moto parada. La camara ve el LADO
// DERECHO de la moto (+Z), que es donde van el escape y el disco trasero.

import * as THREE from '../vendor/three-moto.js';

const HW = 0.744;               // media distancia entre ejes (32 px / 43)
export const RUEDA_R = 0.279;   // radio de la rueda (12 px / 43)

// ---------- Colores ----------
// La moto en el rosa de FURIA y la piloto en azul marino: con la piloto del
// mismo color que la moto, las dos manchas se leian como una sola (se vio en
// la version 2D). El casco blanco es lo mas claro de la escena a proposito:
// es donde se mira.
const COL = {
  plastico: '#ff2e63', blanco: '#f3f1ee', asiento: '#1b1c21', motor: '#2a2e35',
  tapa: '#7d8590', chasis: '#c3c9d2', neumatico: '#17181b', llanta: '#d9dde3',
  buje: '#f0b45a', escape: '#b88a52', silencioso: '#c9ced6', negro: '#121317',
  muelle: '#f0b45a', jersey: '#233a7a', jersey2: '#ff2e63', pantalon: '#1c2033',
  bota: '#f3f1ee', guante: '#ff2e63', casco: '#f7f5f2', visera: '#1a1d26',
  gafas: '#ffb347', pelo: '#16121a', piel: '#e9b999',
};

function mat(color, rough = 0.55, metal = 0.0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

// Un cilindro de a a b (Vector3). Para los tubos del chasis y del escape.
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function tubo(a, b, r, material, seg = 8) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  _d.copy(b).sub(a).normalize();
  m.quaternion.setFromUnitVectors(_up, _d);
  return m;
}
// Recoloca un cilindro de longitud 1 entre a y b (para lo que se mueve).
function estira(m, a, b) {
  const len = a.distanceTo(b);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  _d.copy(b).sub(a);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
  m.scale.set(1, len, 1);
}
const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);

// Un perfil lateral (lista de [x, y]) extruido a lo ancho y centrado en z. Es
// como se hacen las piezas de plastico: su forma se lee de perfil, que es como
// se ve la moto, y el bisel les da el volumen redondeado.
function perfil(puntos, ancho, material, bisel = 0.02) {
  const s = new THREE.Shape();
  s.moveTo(puntos[0][0], puntos[0][1]);
  for (let i = 1; i < puntos.length; i++) s.lineTo(puntos[i][0], puntos[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, ancho - bisel * 2), bevelEnabled: bisel > 0,
    bevelThickness: bisel, bevelSize: bisel, bevelSegments: 2, curveSegments: 6,
  });
  g.translate(0, 0, -(ancho - bisel * 2) / 2);
  return new THREE.Mesh(g, material);
}

// Junta en UNA malla por material las piezas quietas de un grupo. Cada malla
// es una llamada de dibujo (y otra mas en la pasada de sombras), y en un
// movil cada llamada cuesta CPU: la moto suelta eran ~110 mallas y la escena
// entera 233 llamadas por frame (tools/medir-furia.js). Lo que se mueve
// (ruedas, horquilla, basculante) se marca con userData.mueve y se queda
// aparte; lo que lleva textura tambien.
export function junta(padre) {
  const grupos = new Map();
  for (const m of [...padre.children]) {
    if (!m.isMesh || m.userData.mueve || m.material.map) continue;
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    if (!grupos.has(m.material)) grupos.set(m.material, []);
    grupos.get(m.material).push(g);
    padre.remove(m);
  }
  for (const [material, geos] of grupos) {
    let n = 0;
    for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
      g.dispose();
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const malla = new THREE.Mesh(bg, material);
    malla.castShadow = !material.isMeshBasicMaterial;
    padre.add(malla);
  }
}

// El corazon de las placas: la moto es de ella.
function texturaPlaca() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = COL.blanco; g.fillRect(0, 0, 128, 128);
  g.fillStyle = COL.plastico;
  g.beginPath();
  g.moveTo(64, 104);
  g.bezierCurveTo(10, 66, 22, 18, 64, 42);
  g.bezierCurveTo(106, 18, 118, 66, 64, 104);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- La rueda ----------
// Neumatico con tacos (lo que hace que se VEA girar: un toro liso parece
// quieto por mas que ruede), llanta, seis radios gruesos y buje dorado. Los
// radios de verdad miden 4 mm y a esta distancia no llegan ni a un pixel:
// seis de 12 mm si se ven, y es lo que cuenta la vuelta.
function creaRueda(M, disco) {
  const g = new THREE.Group();
  const giro = new THREE.Group();
  g.add(giro);
  const tuboR = 0.058;
  const neu = new THREE.Mesh(new THREE.TorusGeometry(RUEDA_R - tuboR, tuboR, 8, 28), M.neumatico);
  neu.castShadow = true;
  giro.add(neu);
  const taco = new THREE.BoxGeometry(0.035, 0.03, 0.09);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const k = new THREE.Mesh(taco, M.neumatico);
    k.position.set(Math.cos(a) * (RUEDA_R - 0.008), Math.sin(a) * (RUEDA_R - 0.008), 0);
    k.rotation.z = a;
    giro.add(k);
  }
  const llanta = new THREE.Mesh(new THREE.TorusGeometry(RUEDA_R - tuboR * 2 - 0.004, 0.014, 6, 28), M.llanta);
  giro.add(llanta);
  const radio = new THREE.CylinderGeometry(0.009, 0.009, RUEDA_R - tuboR * 2 - 0.03, 5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = new THREE.Mesh(radio, M.llanta);
    const rr = (RUEDA_R - tuboR * 2) * 0.5;
    r.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
    r.rotation.z = a - Math.PI / 2;
    giro.add(r);
  }
  const buje = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 10), M.buje);
  buje.rotation.x = Math.PI / 2;
  giro.add(buje);
  if (disco) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.01, 18), M.chasis);
    d.rotation.x = Math.PI / 2;
    d.position.z = 0.07;
    giro.add(d);
  }
  junta(giro);
  g.userData.giro = giro;
  return g;
}

// ---------- La moto ----------
export function creaMoto() {
  const M = {
    plastico: mat(COL.plastico, 0.35, 0.0),
    blanco: mat(COL.blanco, 0.4),
    asiento: mat(COL.asiento, 0.8),
    motor: mat(COL.motor, 0.45, 0.6),
    tapa: mat(COL.tapa, 0.3, 0.8),
    chasis: mat(COL.chasis, 0.3, 0.75),
    neumatico: mat(COL.neumatico, 0.9),
    llanta: mat(COL.llanta, 0.25, 0.85),
    buje: mat(COL.buje, 0.3, 0.7),
    escape: mat(COL.escape, 0.3, 0.8),
    silencioso: mat(COL.silencioso, 0.3, 0.7),
    negro: mat(COL.negro, 0.6),
    muelle: mat(COL.muelle, 0.35, 0.5),
    faro: new THREE.MeshBasicMaterial({ color: '#fff4d6' }),
    piloto: new THREE.MeshBasicMaterial({ color: '#ff2a3a' }),
  };
  const moto = new THREE.Group();          // se mueve y gira con la fisica
  const P = [];                            // piezas que dan sombra
  const pon = (m) => { moto.add(m); P.push(m); return m; };

  // --- Ruedas: cuelgan de la suspension, se colocan cada frame ---
  const ruedaT = creaRueda(M, true), ruedaD = creaRueda(M, false);
  moto.add(ruedaT, ruedaD);

  // --- Chasis (tubos) ---
  const cab = v3(0.44, 0.30), cabB = v3(0.50, 0.16);   // pipa de direccion
  const piv = v3(-0.11, -0.12);                         // pivote del basculante
  for (const z of [-0.08, 0.08]) {
    pon(tubo(v3(cab.x, cab.y, z * 0.6), v3(-0.10, 0.06, z), 0.022, M.chasis));      // viga
    pon(tubo(v3(-0.10, 0.06, z), v3(piv.x, piv.y, z), 0.022, M.chasis));
    pon(tubo(v3(-0.08, 0.10, z), v3(-0.62, 0.22, z * 0.8), 0.014, M.chasis));        // subchasis
  }
  pon(tubo(cabB, v3(0.25, -0.26), 0.022, M.chasis));                                 // descendente
  pon(tubo(v3(0.25, -0.26), v3(-0.10, -0.32), 0.02, M.chasis));                      // cuna
  pon(tubo(v3(-0.10, -0.32), v3(piv.x, piv.y), 0.02, M.chasis));

  // --- Motor ---
  const bloque = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.30, 0.24), M.motor);
  bloque.position.set(0.01, -0.16, 0);
  pon(bloque);
  const culata = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.16), M.motor);
  culata.position.set(0.14, 0.03, 0); culata.rotation.z = -0.35;
  pon(culata);
  for (let i = 0; i < 3; i++) {          // aletas de la culata
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.19), M.tapa);
    a.position.set(0.15 - i * 0.012, -0.01 + i * 0.04, 0); a.rotation.z = -0.35;
    moto.add(a);
  }
  const embrague = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), M.tapa);
  embrague.rotation.x = Math.PI / 2; embrague.position.set(0.02, -0.16, 0.13);
  moto.add(embrague);
  const radiador = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.3), M.negro);
  radiador.position.set(0.38, 0.03, 0); radiador.rotation.z = -0.3;
  pon(radiador);

  // --- Plasticos ---
  // Deposito y aletas del radiador en una pieza: sube desde el motor a la pipa.
  pon(perfil([[0.47, 0.33], [0.53, 0.14], [0.36, -0.06], [0.14, 0.0], [0.03, 0.17], [0.02, 0.27], [0.24, 0.33]], 0.32, M.plastico, 0.025));
  // Asiento: plano y largo, negro.
  pon(perfil([[0.13, 0.33], [0.1, 0.26], [-0.56, 0.24], [-0.64, 0.28], [-0.56, 0.31], [-0.1, 0.33]], 0.2, M.asiento, 0.02));
  // Tapa lateral trasera, blanca, con el corazon.
  pon(perfil([[-0.08, 0.25], [-0.6, 0.26], [-0.52, 0.08], [-0.2, 0.03]], 0.25, M.blanco, 0.015));
  const placaT = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17),
    new THREE.MeshStandardMaterial({ map: texturaPlaca(), roughness: 0.5 }));
  placaT.position.set(-0.32, 0.155, 0.141);
  moto.add(placaT);
  // Guardabarros trasero: sube hacia atras.
  pon(perfil([[-0.5, 0.27], [-1.08, 0.38], [-1.08, 0.35], [-0.52, 0.22]], 0.19, M.plastico, 0.01));
  // Guardabarros delantero: ALTO, sujeto a la tija como en una moto de cross
  // de verdad. No sigue a la rueda: la rueda sube hacia el.
  pon(perfil([[0.52, 0.2], [0.74, 0.25], [0.98, 0.18], [1.06, 0.12], [1.02, 0.12], [0.94, 0.15], [0.74, 0.21], [0.55, 0.17]], 0.15, M.plastico, 0.012));
  // Placa del frontal, blanca.
  pon(perfil([[0.49, 0.2], [0.56, 0.21], [0.53, 0.44], [0.45, 0.44]], 0.2, M.blanco, 0.01));
  // Faro pequeno bajo la placa y piloto trasero: de noche son lo que se ve.
  const faro = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.faro);
  faro.position.set(0.56, 0.26, 0); moto.add(faro);
  const piloto = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), M.piloto);
  piloto.position.set(-1.05, 0.34, 0); moto.add(piloto);

  // --- Escape: colector que sale de la culata y rodea el motor por el lado
  // derecho, y silencioso bajo el colin ---
  const curva = new THREE.CatmullRomCurve3([
    v3(0.23, 0.02, 0.07), v3(0.31, -0.1, 0.13), v3(0.18, -0.24, 0.17),
    v3(-0.1, -0.16, 0.18), v3(-0.34, 0.07, 0.16),
  ]);
  pon(new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.026, 7), M.escape));
  pon(tubo(v3(-0.34, 0.08, 0.16), v3(-0.86, 0.22, 0.14), 0.056, M.silencioso, 12));
  const tapon = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 12), M.negro);
  tapon.position.set(-0.87, 0.225, 0.14); tapon.rotation.z = Math.PI / 2 + 0.26;
  moto.add(tapon);

  // --- Estriberas ---
  for (const z of [-0.17, 0.17]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.09), M.chasis);
    e.position.set(-0.02, -0.13, z); moto.add(e);
  }

  // --- Lo que se mueve con la suspension ---
  // Horquilla: la barra gruesa baja de la tija; la fina, cromada, sube del eje.
  // Al comprimirse se solapan mas, que es como se ve trabajar una horquilla.
  const horqA = [], horqB = [];
  for (const z of [-0.085, 0.085]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), M.buje);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 10), M.llanta);
    a.castShadow = b.castShadow = true;
    a.userData.z = b.userData.z = z;
    a.userData.mueve = b.userData.mueve = true;
    moto.add(a, b); horqA.push(a); horqB.push(b);
  }
  const tija = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.24), M.chasis);
  tija.position.set(0.44, 0.31, 0); moto.add(tija);
  const tijaB = tija.clone(); tijaB.position.set(0.49, 0.18, 0); moto.add(tijaB);
  // Manillar: torretas, barra ancha y punos.
  pon(tubo(v3(0.43, 0.32), v3(0.41, 0.4), 0.016, M.negro));
  pon(tubo(v3(0.38, 0.41, -0.4), v3(0.41, 0.41, 0), 0.014, M.negro));
  pon(tubo(v3(0.41, 0.41, 0), v3(0.38, 0.41, 0.4), 0.014, M.negro));
  for (const z of [-0.36, 0.36]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8), M.negro);
    p.rotation.x = Math.PI / 2; p.position.set(0.385, 0.41, z); moto.add(p);
  }
  // Basculante (dos brazos) y amortiguador con su muelle dorado.
  const basc = [];
  for (const z of [-0.1, 0.1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.035), M.chasis);
    b.castShadow = true; b.userData.z = z; b.userData.mueve = true;
    moto.add(b); basc.push(b);
  }
  const muelle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 10), M.muelle);
  const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 6), M.llanta);
  muelle.userData.mueve = vastago.userData.mueve = true;
  moto.add(muelle, vastago);

  for (const m of P) m.castShadow = true;
  junta(moto);

  // Haz del faro, solo de noche: un cono aditivo que se abre hacia delante.
  // Una luz de verdad obligaria a recompilar todos los materiales con una luz
  // mas; el cono cuesta un dibujo y es lo que se ve de noche en una foto.
  const hazG = new THREE.ConeGeometry(0.7, 4, 20, 1, true);
  hazG.translate(0, -2, 0);
  hazG.rotateZ(Math.PI / 2);
  const haz = new THREE.Mesh(hazG, new THREE.MeshBasicMaterial({
    color: '#ffe7b0', transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, fog: false }));
  haz.position.set(0.57, 0.26, 0);
  haz.rotation.z = -0.12;
  haz.visible = false;
  moto.add(haz);

  const piloto3 = creaPiloto();
  moto.add(piloto3.grupo);

  // --- La piloto sale despedida ---
  // Al estrellarse se suelta de la moto y cae por su cuenta: gira, rebota y
  // se arrastra. Se cuelga de un pivote en la cadera para que gire sobre su
  // centro y no sobre la moto.
  const pivote = new THREE.Object3D();
  const caida = { suelta: false, vx: 0, vy: 0, vz: 0, w: 0 };
  function suelta(vx, vy, mundo) {
    if (caida.suelta) return;
    const escena = moto.parent;
    moto.updateMatrixWorld(true);
    const cad = new THREE.Vector3(-0.13, 0.47, 0).applyMatrix4(moto.matrixWorld);
    pivote.position.copy(cad);
    pivote.rotation.set(0, 0, 0);
    escena.add(pivote);
    pivote.updateMatrixWorld(true);
    pivote.attach(piloto3.grupo);
    caida.suelta = true;
    caida.vx = vx * 0.8 + 1; caida.vy = Math.max(3.5, vy + 4); caida.vz = 1.2;
    caida.w = -(5 + Math.random() * 5);
    caida.mundo = mundo;
  }
  function cae(dt, sueloEn) {
    if (!caida.suelta) return;
    caida.vy -= 18 * dt;
    pivote.position.x += caida.vx * dt;
    pivote.position.y += caida.vy * dt;
    pivote.position.z = Math.min(0.8, pivote.position.z + caida.vz * dt);
    pivote.rotation.z += caida.w * dt;
    const s = sueloEn(pivote.position.x) + 0.28;
    if (pivote.position.y < s) {
      pivote.position.y = s;
      caida.vy = Math.abs(caida.vy) > 2 ? -caida.vy * 0.35 : 0;
      caida.vx *= 0.55; caida.w *= 0.6; caida.vz *= 0.5;
    }
  }
  function reinicia() {
    if (caida.suelta) {
      moto.add(piloto3.grupo);
      piloto3.grupo.position.set(0, 0, 0);
      piloto3.grupo.rotation.set(0, 0, 0);
      if (pivote.parent) pivote.parent.remove(pivote);
      caida.suelta = false;
    }
  }

  // Estado visual que se suaviza entre frames.
  const S = { dT: 0.3, dD: 0.3 };

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  // dT, dD: cuanto cuelga cada eje por debajo de su anclaje en el chasis, en m.
  // giro: angulo de las ruedas. pose: lo que pide la piloto (ver creaPiloto).
  function actualiza(dT, dD, giro, pose, t) {
    S.dT = dT; S.dD = dD;
    ruedaT.position.set(-HW, -dT, 0);
    ruedaD.position.set(HW, -dD, 0);
    ruedaT.userData.giro.rotation.z = -giro;
    ruedaD.userData.giro.rotation.z = -giro;

    // Horquilla, de la tija al eje delantero.
    for (let i = 0; i < 2; i++) {
      const z = horqA[i].userData.z;
      _a.set(0.44, 0.31, z);                 // tija de arriba
      _b.set(HW, -dD, z);                    // eje
      _c.copy(_b).sub(_a).normalize();
      estira(horqA[i], _a, _c.clone().multiplyScalar(0.37).add(_a));
      estira(horqB[i], _b, _c.clone().multiplyScalar(-0.36).add(_b));
    }
    // Basculante del pivote al eje trasero.
    for (const b of basc) {
      _a.set(piv.x, piv.y, b.userData.z);
      _b.set(-HW, -dT, b.userData.z);
      estira(b, _a, _b);
      b.rotation.z = Math.atan2(_b.y - _a.y, _b.x - _a.x) - Math.PI / 2;
      b.scale.set(1, _a.distanceTo(_b), 1);
    }
    // Amortiguador: de bajo el asiento a un tercio del basculante.
    _a.set(-0.06, 0.2, 0);
    _b.set(piv.x + (-HW - piv.x) * 0.3, piv.y + (-dT - piv.y) * 0.3, 0);
    estira(muelle, _a, _c.copy(_b).sub(_a).multiplyScalar(0.62).add(_a));
    estira(vastago, _a, _b);

    pose.suelta = caida.suelta ? 1 : 0;
    piloto3.pose(pose, t);
  }

  return {
    grupo: moto, actualiza, piloto: piloto3, suelta, cae, reinicia,
    get caida() { return caida.suelta; },
    faro(on) { haz.visible = on; },
  };
}

// ---------- La piloto ----------
// De pie sobre las estriberas, que es como se lleva una moto de cross. Las
// piernas y los brazos se resuelven con cinematica inversa de dos huesos: se
// dice donde esta la cadera y donde tienen que estar pies y manos (estriberas
// y punos, que son fijos), y las rodillas y los codos salen solos. Asi la
// postura cambia moviendo SOLO la cadera y el torso, y las extremidades nunca
// se despegan de la moto.
const L = { muslo: 0.4, tibia: 0.41, brazo: 0.29, antebrazo: 0.28, torso: 0.5, cuello: 0.14 };

function creaPiloto() {
  const M = {
    jersey: mat(COL.jersey, 0.7), jersey2: mat(COL.jersey2, 0.6),
    pantalon: mat(COL.pantalon, 0.75), bota: mat(COL.bota, 0.45),
    guante: mat(COL.guante, 0.6), casco: mat(COL.casco, 0.25, 0.05),
    visera: mat(COL.visera, 0.2, 0.3), gafas: mat(COL.gafas, 0.15, 0.4),
    pelo: mat(COL.pelo, 0.6), negro: mat(COL.negro, 0.6), rosa: mat(COL.jersey2, 0.35),
  };
  const grupo = new THREE.Group();
  const sombra = [];
  const add = (m) => { grupo.add(m); sombra.push(m); return m; };

  // Una capsula de largo fijo, apuntando a +Y desde su base.
  function hueso(r, largo, material) {
    const g = new THREE.CapsuleGeometry(r, largo, 3, 8);
    g.translate(0, largo / 2, 0);
    return add(new THREE.Mesh(g, material));
  }
  const piernas = [], brazos = [];
  for (const lado of [-1, 1]) {
    piernas.push({
      lado, muslo: hueso(0.068, L.muslo, M.pantalon), tibia: hueso(0.058, L.tibia, M.pantalon),
      bota: add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.11), M.bota)),
      rodillera: add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.jersey2)),
    });
    brazos.push({
      lado, brazo: hueso(0.052, L.brazo, M.jersey), antebrazo: hueso(0.046, L.antebrazo, M.jersey),
      mano: add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), M.guante)),
    });
  }
  // Torso: capsula ancha y aplastada, con el dorsal claro detras.
  const torsoG = new THREE.CapsuleGeometry(0.15, L.torso - 0.2, 4, 10);
  torsoG.translate(0, L.torso / 2, 0);
  torsoG.scale(1, 1, 1.25);
  const torso = add(new THREE.Mesh(torsoG, M.jersey));
  const franja = new THREE.Mesh(new THREE.CapsuleGeometry(0.152, 0.08, 3, 10), M.jersey2);
  franja.geometry.translate(0, L.torso * 0.62, 0); franja.geometry.scale(1, 1, 1.26);
  torso.add(franja);
  const cadera = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.pantalon));
  cadera.scale.set(1, 0.8, 1.25);

  // Casco de cross: calota, mentonera saliente, pico y gafas.
  const cabeza = new THREE.Group();
  grupo.add(cabeza);
  const calota = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), M.casco);
  calota.scale.set(1.1, 1, 0.95);
  const franjaC = new THREE.Mesh(new THREE.SphereGeometry(0.147, 14, 10, 0, Math.PI * 2, 0.9, 0.35), M.rosa);
  franjaC.scale.copy(calota.scale); franjaC.rotation.z = -0.5;
  const menton = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.2), M.casco);
  menton.position.set(0.12, -0.08, 0); menton.rotation.z = 0.5;
  const pico = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.018, 0.2), M.rosa);
  pico.position.set(0.14, 0.1, 0); pico.rotation.z = 0.28;
  const gafas = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.19), M.gafas);
  gafas.position.set(0.125, 0.012, 0);
  const cristal = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.16), M.visera);
  cristal.position.set(0.146, 0.012, 0);
  const correa = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.012, 4, 20), M.negro);
  correa.rotation.x = Math.PI / 2; correa.rotation.z = 0.12; correa.position.y = 0.01;
  cabeza.add(calota, franjaC, menton, pico, gafas, cristal, correa);
  for (const m of [calota, menton, pico]) { m.castShadow = true; }

  // Coleta: asoma por detras del casco y se la lleva el viento. Cadena de
  // cuatro bolas que se calcula con retraso: al acelerar se estira hacia
  // atras, parada cuelga, y en el aire flota.
  // Tramos alargados que se solapan: con bolas sueltas se leia como un
  // collar de cuentas, no como pelo.
  const coleta = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055 - i * 0.008, 8, 6), M.pelo);
    b.scale.set(1.5, 0.85, 0.85);
    grupo.add(b); coleta.push(b);
  }
  const angC = [0, 0, 0, 0, 0];

  // Sombra solo de lo que hace silueta: manos, rodilleras, botas y coleta no
  // cambian la sombra y cada una seria otra llamada en la pasada de sombras.
  for (const m of sombra) m.castShadow = true;
  for (const pr of piernas) { pr.bota.castShadow = false; pr.rodillera.castShadow = false; }
  for (const br of brazos) { br.mano.castShadow = false; br.antebrazo.castShadow = false; }

  // --- IK de dos huesos ---
  // A raiz, C objetivo, polo hacia donde se dobla la articulacion. Deja la
  // articulacion en J.
  const _ac = new THREE.Vector3(), _p = new THREE.Vector3(), J = new THREE.Vector3();
  function ik(A, C, l1, l2, polo) {
    _ac.copy(C).sub(A);
    let d = _ac.length();
    const dMax = (l1 + l2) * 0.999;
    if (d > dMax) { _ac.multiplyScalar(dMax / d); d = dMax; }
    _ac.normalize();
    const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    _p.copy(polo).addScaledVector(_ac, -polo.dot(_ac)).normalize();
    J.copy(A).addScaledVector(_ac, l1 * cosA).addScaledVector(_p, l1 * sinA);
    return J;
  }
  const _y = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
  function apunta(m, desde, hacia) {
    m.position.copy(desde);
    _dir.copy(hacia).sub(desde).normalize();
    m.quaternion.setFromUnitVectors(_y, _dir);
  }

  const cad = new THREE.Vector3(), cuello = new THREE.Vector3(), hombro = new THREE.Vector3();
  const pie = new THREE.Vector3(), mano = new THREE.Vector3(), rod = new THREE.Vector3(), codo = new THREE.Vector3();
  const poloRod = new THREE.Vector3(), poloCodo = new THREE.Vector3(), cab = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // pose = { agache 0-1, aire 0-1, cuerpo -1..1 (atras/adelante), hunde m, viento 0-1 }
  function pose(p, t) {
    // Cadera: de pie sobre las estriberas. El agache la baja y la echa atras,
    // el cuerpo la adelanta o atrasa (asi se inclina la moto de verdad), el
    // aterrizaje la hunde (las piernas hacen de segunda suspension).
    cad.set(-0.13 - p.agache * 0.05 + p.cuerpo * 0.13 - p.aire * 0.02,
            0.47 - p.agache * 0.08 - p.hunde + p.aire * 0.05 - Math.abs(p.cuerpo) * 0.04, 0);
    // Torso: a 38 grados de la horizontal parada; mas tumbado agachada.
    const incl = 0.66 - p.agache * 0.18 + p.cuerpo * 0.12 + p.aire * 0.08;
    cuello.set(cad.x + Math.cos(incl) * L.torso, cad.y + Math.sin(incl) * L.torso, 0);
    apunta(torso, cad, cuello);
    cadera.position.copy(cad);
    cadera.rotation.z = incl - 0.6;

    // Cabeza: un poco mas erguida que el torso, mirando adelante.
    const ic = incl + 0.55;
    cab.set(cuello.x + Math.cos(ic) * L.cuello + 0.02, cuello.y + Math.sin(ic) * L.cuello, 0);
    cabeza.position.copy(cab);
    cabeza.rotation.z = -0.15 - p.agache * 0.1;

    // Piernas: de la cadera a la estribera; la rodilla se dobla hacia delante
    // y un poco hacia fuera (aprieta la moto con las rodillas).
    for (const pr of piernas) {
      const z = pr.lado * 0.12;
      tmp.set(cad.x, cad.y - 0.04, z);
      pie.set(-0.02, -0.07, pr.lado * 0.19);
      // Suelta de la moto: las piernas pedalean en el aire.
      if (p.suelta) pie.set(cad.x + Math.sin(t * 9 + pr.lado) * 0.3, cad.y - 0.62, pr.lado * 0.3);
      poloRod.set(1, 0.1, pr.lado * 0.35);
      rod.copy(ik(tmp, pie, L.muslo, L.tibia, poloRod));
      apunta(pr.muslo, tmp, rod);
      apunta(pr.tibia, rod, pie);
      pr.rodillera.position.copy(rod);
      pr.bota.position.set(pie.x + 0.03, pie.y - 0.02, pie.z);
    }
    // Brazos: del hombro al puno; codos hacia fuera y arriba ("codos arriba",
    // la postura de ataque de cross).
    for (const br of brazos) {
      hombro.set(cuello.x - Math.cos(incl) * 0.05, cuello.y - Math.sin(incl) * 0.05, br.lado * 0.19);
      mano.set(0.385, 0.41, br.lado * 0.34);
      if (p.suelta) mano.set(hombro.x + Math.cos(t * 11 + br.lado * 2) * 0.3, hombro.y + 0.35, br.lado * 0.45);
      poloCodo.set(-0.3, 0.4, br.lado * 1.0);
      codo.copy(ik(hombro, mano, L.brazo, L.antebrazo, poloCodo));
      apunta(br.brazo, hombro, codo);
      apunta(br.antebrazo, codo, mano);
      br.mano.position.copy(mano);
    }
    // Coleta: cada tramo persigue un angulo que depende del viento (se tiende
    // hacia atras) y de la gravedad (cuelga), con retraso y un vaiven.
    let x = cab.x - 0.15, y = cab.y - 0.02;
    for (let i = 0; i < coleta.length; i++) {
      const objetivo = -Math.PI / 2 - (0.25 + p.viento * 1.15) * (1 + i * 0.12)
        + Math.sin(t * (7 + p.viento * 6) - i * 0.9) * (0.08 + p.viento * 0.12) + p.aire * 0.5;
      angC[i] += (objetivo - angC[i]) * 0.25;
      x += Math.cos(angC[i]) * 0.035;
      y += Math.sin(angC[i]) * 0.035;
      coleta[i].position.set(x, y, 0);
      coleta[i].rotation.z = angC[i];
      x += Math.cos(angC[i]) * 0.035;
      y += Math.sin(angC[i]) * 0.035;
    }
  }

  return { grupo, pose };
}
