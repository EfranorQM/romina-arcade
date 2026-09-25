// FURIA - los obstaculos en 3D. Cada uno ocupa en el dibujo lo mismo que su
// regla de choque (moto-world.js, choques): si la roca dibujada fuera mas
// pequeña que su colision, se moriria contra aire.
//
// Rocas y troncos son modelos de Kenney coloreados por el bioma; cajas,
// rampas, turbo y barro se construyen aqui. Lo quieto se junta por material
// al final (una rampa suelta eran once mallas); lo que cambia -- troncos y
// cajas que se rompen, flechas del turbo que se encienden -- va aparte.

import * as THREE from '../vendor/three-moto.js';
import * as W from './moto-world.js';
import { junta } from './moto-modelo.js';
import { creaPlantador } from './moto-decor.js';
import { K, hash } from './moto-pista3d.js';

export function construyeObstaculos(destino, T, obs, mundo) {
  const quietos = new THREE.Group();
  const P = creaPlantador(mundo);             // rocas y troncos de Kenney
  const vivos = { rompibles: new Map(), turbos: [] };

  const m = {
    madera: new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.8, flatShading: true }),
    madera2: new THREE.MeshStandardMaterial({ color: '#8a5a30', roughness: 0.9 }),
    madera3: new THREE.MeshStandardMaterial({ color: '#a8743e', roughness: 0.85 }),
    raya: new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: 0.6 }),
    negro: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 }),
    senal: new THREE.MeshStandardMaterial({ color: '#ffcc2a', roughness: 0.5 }),
    rosa: new THREE.MeshStandardMaterial({ color: '#ff2e63', roughness: 0.5 }),
    caja: new THREE.MeshStandardMaterial({ map: texturaCaja(), roughness: 0.85 }),
    barro: new THREE.MeshStandardMaterial({ color: mundo.bioma.colBarro, roughness: mundo.id === 'nieve' ? 0.9 : 0.25, metalness: 0 }),
  };

  for (const ob of obs) {
    const x = ob.x / K, y = -W.groundBase(T, ob.x) / K;
    if (ob.kind === W.OB_ROCK) {
      // La colision llega a 1.6*h de alto y 0.55*w a cada lado.
      const alto = 1.6 * ob.h / K, ancho = 1.1 * ob.w / K;
      const nombre = ['rock_tallA', 'rock_tallB', 'rock_tallC'][Math.floor(hash(ob.x) * 3)];
      const g = P.modelo(nombre);
      const ex = ancho / (g.bb[3] - g.bb[0]), ey = alto / (g.bb[4] - g.bb[1]);
      P.pon(nombre, x, y - 0.04, 0.1, hash(ob.x * 3) < 0.5 ? 0 : Math.PI, ex, 1, true, 0, ey / ex);
      for (let j = 0; j < 3; j++) {             // piedras sueltas alrededor
        const px = x + (hash(ob.x * 3 + j) - 0.5) * 1.8, pz = (j - 1) * 1.0 + 0.2;
        P.pon(['rock_smallA', 'rock_smallB', 'rock_smallC'][j], px, -W.groundBase(T, px * K) / K - 0.02, pz, j * 2, 1.4 + hash(ob.x + j), 1, true);
      }
    } else if (ob.kind === W.OB_LOG) {
      // Tronco atravesado en la pista: el log_large de Kenney girado para que
      // cruce la pista. Alto = h, como su colision.
      const P2 = creaPlantador(mundo);
      const g = P2.modelo('log_large');
      const e = (ob.h / K) / (g.bb[4] - g.bb[1]);
      const largo = 3.4 / (g.bb[3] - g.bb[0]);
      const grupoT = new THREE.Group();
      P2.pon('log_large', 0, -0.03, 0, Math.PI / 2 + (hash(ob.x) - 0.5) * 0.2, e, 1, true, 0, 1);
      P2.funde(grupoT);
      grupoT.children.forEach(c => { c.scale.z = largo / e; });
      grupoT.position.set(x, y, 0);
      destino.add(grupoT);
      vivos.rompibles.set(ob, grupoT);
    } else if (ob.kind === W.OB_CAJA) {
      // Cajas de madera: una, o dos apiladas. Alto = h.
      const grupoC = new THREE.Group();
      const lado = ob.w / K, alto = ob.h / K / ob.pisos;
      for (let p = 0; p < ob.pisos; p++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(lado, alto, 0.95), m.caja);
        c.position.set((p ? 0.04 : 0), alto * (p + 0.5), 0);
        c.rotation.y = (hash(ob.x + p) - 0.5) * 0.3;
        c.castShadow = c.receiveShadow = true;
        grupoC.add(c);
      }
      grupoC.position.set(x, y, 0.15);
      destino.add(grupoC);
      vivos.rompibles.set(ob, grupoC);
    } else if (ob.kind === W.OB_RAMP || ob.kind === W.OB_RAMPA_G) {
      rampa(quietos, T, ob, m);
    } else if (ob.kind === W.OB_TURBO) {
      // La flecha del turbo: una lamina en el suelo con chevrones que se
      // encienden en ola (moto-3d.js la anima).
      const w = ob.w / K;
      const g = new THREE.PlaneGeometry(w, 2.4);
      g.rotateX(-Math.PI / 2);
      const t = texturaTurbo();
      const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
      const f = new THREE.Mesh(g, mat);
      f.position.set(x, y + 0.02, 0);
      f.rotation.z = -W.groundAngle(T, ob.x);
      f.renderOrder = 2;
      destino.add(f);
      vivos.turbos.push({ mat, t });
      // Dos conos a los lados.
      P.pon('pylon', x - w / 2, y - 0.01, 1.35, 0, 3, 1, true);
      P.pon('pylon', x - w / 2, y - 0.01, -1.35, 0, 3, 1, true);
    } else if (ob.kind === W.OB_BARRO) {
      // El barro: una lamina que sigue el suelo, brillante (mojado) salvo en
      // la nieve. El color del suelo de debajo ya lo pinta el terreno; esta
      // lamina le da el brillo y los charcos.
      const x0 = ob.x - ob.w * 0.5, x1 = ob.x + ob.w * 0.5, n = Math.ceil(ob.w / 10);
      const p = [], ix = [];
      for (let i = 0; i <= n; i++) {
        const xx = x0 + (x1 - x0) * i / n, yy = -W.groundBase(T, xx) / K + 0.015;
        const borde = Math.sin(i / n * Math.PI);
        p.push(xx / K, yy, 1.2 * borde + 0.1, xx / K, yy, -1.2 * borde - 0.1);
        if (i < n) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setIndex(ix); g.computeVertexNormals();
      const b = new THREE.Mesh(g, m.barro);
      b.receiveShadow = true;
      quietos.add(b);
    } else if (ob.kind === W.OB_PIT) {
      // El pozo ya esta en el terreno. Una senal de peligro detras de la
      // pista lo anuncia desde lejos; el foso del salto gigante lleva dos.
      const sx = x - ob.w / K * 0.5 - 1.6, sy = -W.groundBase(T, sx * K) / K;
      senal(quietos, sx, sy, m);
      if (ob.foso) {
        const sx2 = x + ob.w / K * 0.5 + 1.2;
        senal(quietos, sx2, -W.groundBase(T, sx2 * K) / K, m);
      }
    }
  }
  P.funde(quietos);
  junta(quietos);
  quietos.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  destino.add(quietos);
  return vivos;
}

function senal(grupo, sx, sy, m) {
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), m.madera2);
  palo.position.set(sx, sy + 0.65, -2.0);
  const tri = new THREE.Shape();
  tri.moveTo(-0.32, 0); tri.lineTo(0.32, 0); tri.lineTo(0, 0.52); tri.closePath();
  const s = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }), m.senal);
  s.position.set(sx, sy + 1.1, -1.95);
  const ex = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), m.negro);
  ex.position.set(sx, sy + 1.33, -1.9);
  const pt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), m.negro);
  pt.position.set(sx, sy + 1.19, -1.9);
  palo.castShadow = s.castShadow = true;
  grupo.add(palo, s, ex, pt);
}

// La rampa: exactamente el perfil de la fisica (de x0 a x1 sube hr en linea
// recta, ver aplicaRampas), de tablones, con travesaños de apoyo que se ven de
// costado, y el labio pintado a rayas. La grande, ademas, con postes y una
// pancarta rosa.
function rampa(grupo, T, ob, m) {
  const x0 = ob.x0 / K, x1 = ob.x1 / K, y0 = -W.groundBase(T, ob.x0) / K, y1 = -W.groundBase(T, ob.x1) / K;
  const alto = ob.hr / K, ancho = ob.kind === W.OB_RAMPA_G ? 3.0 : 2.6;
  // La cara de arriba y la trasera, como un prisma.
  const s = new THREE.Shape();
  s.moveTo(x0, y0 - 0.02); s.lineTo(x1, y1 + alto); s.lineTo(x1, y1 - 0.3); s.lineTo(x0, y0 - 0.3); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: ancho, bevelEnabled: false });
  g.translate(0, 0, -ancho / 2);
  const r = new THREE.Mesh(g, m.madera);
  r.castShadow = r.receiveShadow = true;
  grupo.add(r);
  // Juntas de los tablones
  const nT = Math.round((x1 - x0) / 0.3);
  const ang = Math.atan2(y1 + alto - y0, x1 - x0);
  for (let i = 1; i < nT; i++) {
    const t = i / nT;
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, ancho + 0.02), m.madera2);
    j.position.set(x0 + (x1 - x0) * t, y0 + (y1 + alto - y0) * t + 0.012, 0);
    j.rotation.z = ang;
    grupo.add(j);
  }
  // Travesaños en el costado que ve la camara: una X de listones.
  const zc = ancho / 2 + 0.02;
  const listón = (ax, ay, bx, by) => {
    const l = Math.hypot(bx - ax, by - ay);
    const b = new THREE.Mesh(new THREE.BoxGeometry(l, 0.07, 0.04), m.madera3);
    b.position.set((ax + bx) / 2, (ay + by) / 2, zc);
    b.rotation.z = Math.atan2(by - ay, bx - ax);
    grupo.add(b);
  };
  const xm = (x0 + x1) / 2, ym = (y0 + y1 + alto) / 2;
  listón(xm, y0 + 0.05, x1 - 0.05, y1 + alto - 0.05);
  listón(xm, ym - 0.05, x1 - 0.05, y1 + 0.05);
  listón(x1 - 0.03, y1, x1 - 0.03, y1 + alto);
  // El labio, a rayas amarillas y negras.
  const nR = 6;
  for (let i = 0; i < nR; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, ancho / nR), i % 2 ? m.negro : m.raya);
    b.position.set(x1 - 0.04, y1 + alto - 0.02, -ancho / 2 + (i + 0.5) * ancho / nR);
    grupo.add(b);
  }
  if (ob.kind === W.OB_RAMPA_G) {
    // Postes y pancarta detras: el salto gigante se anuncia desde lejos.
    for (const dx of [-0.6, 0.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), m.negro);
      p.position.set(x1 + dx, y1 + 1.6, -2.6);
      p.castShadow = true;
      grupo.add(p);
    }
    const pan = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.06), m.rosa);
    pan.position.set(x1, y1 + 2.9, -2.6);
    pan.castShadow = true;
    grupo.add(pan);
    const fl = new THREE.Shape();
    fl.moveTo(-0.5, -0.18); fl.lineTo(0.2, -0.18); fl.lineTo(0.2, -0.32); fl.lineTo(0.55, 0); fl.lineTo(0.2, 0.32); fl.lineTo(0.2, 0.18); fl.lineTo(-0.5, 0.18); fl.closePath();
    const fg = new THREE.ExtrudeGeometry(fl, { depth: 0.02, bevelEnabled: false });
    const f = new THREE.Mesh(fg, m.raya);
    f.position.set(x1, y1 + 2.9, -2.56);
    grupo.add(f);
  }
}

// ---------- Texturas ----------
function texturaCaja() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c08a4e'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#b07a42';
  for (let i = 0; i < 4; i++) g.fillRect(8, 8 + i * 12, 48, 5);
  g.strokeStyle = '#7a4e26'; g.lineWidth = 8;
  g.strokeRect(4, 4, 56, 56);
  g.beginPath(); g.moveTo(8, 56); g.lineTo(56, 8); g.stroke();
  g.fillStyle = '#5a3818';
  for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { g.beginPath(); g.arc(a, b, 2.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tres chevrones cian sobre fondo transparente. `t.offset` los hace correr.
function texturaTurbo() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,40,70,0.55)';
  g.fillRect(0, 6, 128, 52);
  for (let i = 0; i < 3; i++) {
    const x = 18 + i * 36;
    g.fillStyle = i === 2 ? '#ffffff' : '#5ff0ff';
    g.beginPath();
    g.moveTo(x, 12); g.lineTo(x + 22, 32); g.lineTo(x, 52); g.lineTo(x - 10, 52); g.lineTo(x + 12, 32); g.lineTo(x - 10, 12);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
