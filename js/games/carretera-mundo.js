// carretera-mundo.js - FURIA: la carretera, el trafico y las reglas, sin DOM.
//
// Todo lo que decide la partida vive aqui para que tools/prueba-carretera.mjs
// juegue exactamente lo mismo que el telefono. Como se pinta esta en
// carretera-arte.js, y el porque de cada numero, en docs/FURIA-CANON.md.
//
// La carretera es la de Out Run: una tira de tramos de 200 unidades, cada uno
// con su curva y su altura. La moto va a JZ por delante de la camara; x es su
// posicion de lado, en medios anchos de carretera (-1 y 1 son los bordillos).

export const SEG = 200;                     // largo de un tramo
export const ANCHO = 1500;                  // medio ancho de la carretera
export const CARRILES = [-2 / 3, 0, 2 / 3];
export const VMAX = SEG * 60;               // 60 tramos por segundo = 262 km/h
export const ACEL = VMAX / 5;               // de parada al tope en 5 s
export const FUERA_LIM = VMAX * 0.4;        // tope por la hierba
export const FUERA_FRENO = VMAX * 0.8;
export const CENTRIF = 0.2;                 // cuanto abre la curva
export const GIRO = 2.1;                    // x por segundo con el dedo apretado, a tope
export const BORDE = 1.22;                  // hasta donde puede ir por el arcen
export const MOTO_W = 0.16;
export const CAM_H = 950;
export const CAM_D = 1 / Math.tan((50 * Math.PI) / 180);
export const JZ = CAM_H * CAM_D * 1.2;      // de la camara a la moto
export const TURBO = 1.3, T_TURBO = 2;
export const CHOQUE_T = 1.5, INVUL_T = 1.6;
export const KMH = 262;

// Los coches: el ancho (en unidades del mundo) decide el choque. El dibujo de
// cada uno esta en carretera-arte.js, en el mismo orden.
export const COCHES = [
  { nombre: 'coche', w: 620 },
  { nombre: 'furgo', w: 650 },
  { nombre: 'camion', w: 700 },
];
export const N_COLORES = 9;

// Los ocho niveles. largo en tramos; trafico en coches cada 100 tramos; vc,
// la velocidad de los coches como fraccion de la de la moto; holgura, cuanto
// tiempo sobra respecto a ir siempre a tope (medido en el arnes).
export const NIVELES = [
  { nombre: 'LA COSTA', bioma: 'costa', cielo: 'dia', largo: 2300, holgura: 1.55, trafico: 1.3, vc: [0.3, 0.5], curva: 3.0, lomas: 20, charcos: 2, turbos: 3, corazones: 7 },
  { nombre: 'EL CAÑON', bioma: 'canon', cielo: 'atardecer', largo: 2450, holgura: 1.48, trafico: 1.5, vc: [0.32, 0.52], curva: 3.3, lomas: 28, charcos: 3, turbos: 3, corazones: 7 },
  { nombre: 'EL BOSQUE', bioma: 'bosque', cielo: 'amanecer', largo: 2600, holgura: 1.42, trafico: 1.65, vc: [0.34, 0.54], curva: 3.5, lomas: 30, charcos: 3, turbos: 3, corazones: 8 },
  { nombre: 'LA NIEVE', bioma: 'nieve', cielo: 'dia', largo: 2700, holgura: 1.37, trafico: 1.8, vc: [0.35, 0.56], curva: 3.6, lomas: 34, charcos: 4, turbos: 3, corazones: 8 },
  { nombre: 'COSTA AL ATARDECER', bioma: 'costa', cielo: 'atardecer', largo: 2800, holgura: 1.32, trafico: 1.95, vc: [0.36, 0.58], curva: 3.8, lomas: 30, charcos: 4, turbos: 4, corazones: 8 },
  { nombre: 'EL CAÑON DE NOCHE', bioma: 'canon', cielo: 'noche', largo: 2900, holgura: 1.28, trafico: 2.1, vc: [0.38, 0.6], curva: 3.9, lomas: 34, charcos: 4, turbos: 4, corazones: 9 },
  { nombre: 'EL BOSQUE DE NOCHE', bioma: 'bosque', cielo: 'noche', largo: 3000, holgura: 1.24, trafico: 2.25, vc: [0.38, 0.62], curva: 4.0, lomas: 36, charcos: 5, turbos: 4, corazones: 9 },
  { nombre: 'LA CUMBRE', bioma: 'nieve', cielo: 'atardecer', largo: 3150, holgura: 1.2, trafico: 2.4, vc: [0.4, 0.64], curva: 4.0, lomas: 40, charcos: 5, turbos: 4, corazones: 10 },
];

const facil = (a, b, p) => a + (b - a) * p * p;
const suave = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- La pista de un nivel ----------
// Todo sale de rnd: con la misma semilla, la misma pista en el juego y en el
// arnes. Devuelve los tramos (curva y altura de cada borde), el decorado por
// tramo, los puntos de control, la meta y lo que hay en la calzada.
export function hazNivel(n, rnd) {
  const D = NIVELES[clamp(n, 1, NIVELES.length) - 1];
  const curva = [], y = [0], curvas = [];
  const ult = () => y[y.length - 1];
  const tramo = (entra, dura, sale, c, alto) => {
    const y0 = ult(), y1 = y0 + (alto || 0) * SEG, tot = entra + dura + sale;
    for (let i = 0; i < entra; i++) { curva.push(facil(0, c, i / entra)); y.push(suave(y0, y1, (i + 1) / tot)); }
    for (let i = 0; i < dura; i++) { curva.push(c); y.push(suave(y0, y1, (entra + i + 1) / tot)); }
    for (let i = 0; i < sale; i++) { curva.push(suave(c, 0, i / sale)); y.push(suave(y0, y1, (entra + dura + i + 1) / tot)); }
  };
  const loma = f => (rnd() < 0.5 ? -1 : 1) * D.lomas * (0.45 + rnd() * 0.55) * (f || 1);

  tramo(0, 50, 0, 0, 0);                     // la salida
  while (curva.length < D.largo) {
    const t = rnd(), lado = rnd() < 0.5 ? -1 : 1;
    if (t < 0.2) {
      tramo(20, (30 + rnd() * 50) | 0, 20, 0, rnd() < 0.65 ? loma() : 0);
    } else if (t < 0.78) {
      const c = lado * D.curva * (0.45 + rnd() * 0.55), ini = curva.length;
      tramo((25 + rnd() * 25) | 0, (35 + rnd() * 55) | 0, (25 + rnd() * 25) | 0, c, rnd() < 0.35 ? loma(0.6) : 0);
      curvas.push({ ini, c });
    } else {
      // Eses: dos curvas seguidas, una a cada lado.
      const c = lado * D.curva * (0.4 + rnd() * 0.35);
      curvas.push({ ini: curva.length, c });
      tramo(20, (25 + rnd() * 20) | 0, 20, c, 0);
      curvas.push({ ini: curva.length, c: -c });
      tramo(20, (25 + rnd() * 20) | 0, 20, -c, 0);
    }
    if (rnd() < 0.3) tramo(0, (15 + rnd() * 25) | 0, 0, 0, 0);
  }
  const meta = curva.length;
  tramo(0, 320, 0, 0, 0);                    // tras la meta: se sigue viendo carretera

  const nSeg = curva.length;
  const L = {
    n, D, nSeg, meta,
    curva: Float32Array.from(curva), y: Float32Array.from(y),
    controles: [Math.round(meta * 0.36), Math.round(meta * 0.7)],
    salida: 10,
    cosas: [], coches: [], corazones: [], turbos: [], charcos: [],
  };
  // El tiempo: lo justo para ir a tope, por la holgura del nivel. Se reparte
  // entre la salida y los dos controles.
  const total = Math.round(D.holgura * (meta / 60 + 3));
  L.t0 = Math.round(total * 0.42);
  L.extra = Math.round((total - L.t0) / 2);

  // Decorado: papeles, no dibujos. Cada paisaje pone el suyo (arbol = palmera
  // en la costa, cactus en el cañon, pino en el bosque y la nieve).
  for (let i = 0; i < nSeg; i++) {
    const c = [];
    if (i % 7 === 0) c.push({ rol: 'arbol', x: -(1.4 + rnd() * 0.9), s: 0.85 + rnd() * 0.35, v: (rnd() * 3) | 0 });
    if (i % 9 === 4) c.push({ rol: rnd() < 0.55 ? 'arbusto' : 'roca', x: 1.35 + rnd() * 0.8, s: 0.8 + rnd() * 0.4, v: (rnd() * 3) | 0 });
    if (i % 13 === 8) c.push({ rol: 'arbol', x: 1.55 + rnd() * 1.1, s: 0.85 + rnd() * 0.35, v: (rnd() * 3) | 0 });
    if (i % 17 === 3) c.push({ rol: 'arbusto', x: -(1.35 + rnd() * 0.5), s: 0.7 + rnd() * 0.3, v: (rnd() * 3) | 0 });
    if (i % 31 === 19) c.push({ rol: 'especial', x: (rnd() < 0.5 ? -1 : 1) * (1.55 + rnd() * 0.8), s: 1, v: (rnd() * 3) | 0 });
    if (i % 8 === 0) c.push({ rol: 'poste', x: i % 16 === 0 ? -1.3 : 1.3, s: 1, v: 0 });
    if (i % 190 === 100) c.push({ rol: 'valla', x: (i % 380 < 190 ? -1 : 1) * 1.42, s: 1, v: 0 });
    L.cosas.push(c);
  }
  for (const cu of curvas) {
    if (Math.abs(cu.c) < 2.2) continue;
    const lado = cu.c > 0 ? -1 : 1;           // fuera de la curva
    for (let k = -3; k < 4; k++) {
      const s = L.cosas[cu.ini + k * 6];
      if (s) s.push({ rol: 'curva', x: lado * 1.3, s: 1, v: cu.c > 0 ? 1 : -1 });
    }
  }
  L.cosas[L.salida].push({ rol: 'arco', x: 0, s: 1, v: 0 });
  for (const ci of L.controles) L.cosas[ci].push({ rol: 'arco', x: 0, s: 1, v: 1 });
  L.cosas[meta].push({ rol: 'arco', x: 0, s: 1, v: 2 });

  // Lo que hay en la calzada. Cada cosa guarda sitio: charcos y turbos no se
  // pisan entre si ni caen en la salida.
  const ocupado = [];
  const libre = (i0, i1) => i0 > 140 && i1 < meta - 40 && ocupado.every(([a, b]) => i1 < a - 30 || i0 > b + 30);
  const recta = (i0, n2) => { for (let i = i0; i < i0 + n2; i++) if (Math.abs(L.curva[i]) > 0.6) return false; return true; };
  for (let k = 0, intentos = 0; k < D.turbos && intentos < 400; intentos++) {
    const i0 = (140 + rnd() * (meta - 260)) | 0;
    if (!libre(i0, i0 + 6) || !recta(i0, 50)) continue;
    L.turbos.push({ i0, i1: i0 + 5, carril: (rnd() * 3) | 0 });
    ocupado.push([i0, i0 + 5]);
    k++;
  }
  for (let k = 0, intentos = 0; k < D.charcos && intentos < 400; intentos++) {
    const i0 = (160 + rnd() * (meta - 280)) | 0;
    if (!libre(i0, i0 + 4)) continue;
    L.charcos.push({ i0, i1: i0 + 3, carril: (rnd() * 3) | 0 });
    ocupado.push([i0, i0 + 3]);
    k++;
  }
  // Corazones: en fila por un carril o cruzando de un carril a otro.
  for (let k = 0; k < D.corazones; k++) {
    const i0 = (110 + rnd() * (meta - 220)) | 0;
    const a = (rnd() * 3) | 0;
    const b = rnd() < 0.55 ? a : (a + 1 + ((rnd() * 2) | 0)) % 3;
    for (let j = 0; j < 6; j++) {
      L.corazones.push({ z: (i0 + j * 3) * SEG + SEG / 2, x: CARRILES[a] + (CARRILES[b] - CARRILES[a]) * (j / 5), cogido: false });
    }
  }
  // Trafico: repartido por la pista, sin tres coches de lado a lado.
  const nC = Math.round((meta / 100) * D.trafico);
  const hueco = ((meta - 110) * SEG) / nC;
  let z = 75 * SEG;
  for (let k = 0; k < nC; k++) {
    z += hueco * (0.55 + rnd() * 0.9);
    if (z > (meta - 30) * SEG) break;
    const cerca = c => L.coches.some(o => o.carril === c && Math.abs(o.z - z) < 14 * SEG);
    const opciones = [0, 1, 2].filter(c => !cerca(c) && [0, 1, 2].some(o => o !== c && !cerca(o)));
    if (!opciones.length) continue;
    const carril = opciones[(rnd() * opciones.length) | 0];
    const q = rnd(), v = VMAX * (D.vc[0] + rnd() * (D.vc[1] - D.vc[0]));
    L.coches.push({
      z, carril, destino: carril, x: CARRILES[carril], v, vBase: v,
      tipo: q < 0.14 ? 2 : q < 0.32 ? 1 : 0, color: (rnd() * N_COLORES) | 0,
      intermitente: 0, pensar: 2 + rnd() * 5, pasado: false,
    });
  }
  return L;
}

// ---------- La moto ----------
export function nuevaMoto(L) {
  return {
    pos: 0, x: 0, vx: 0, v: 0,
    choque: 0, lado: 1, invul: 0, turbo: 0, resbala: 0, bamboleo: 0,
    tiempo: L.t0, pasados: 0, fin: null, corriendo: false, t: 0,
    corazones: 0, choques: 0, adelantos: 0,
    ev: [],
  };
}

// La curva y la altura donde esta la moto (para el dibujo y para el arnes).
export function tramoDe(L, z) { return clamp(Math.floor(z / SEG), 0, L.nSeg - 1); }
export function alturaEn(L, z) {
  const i = tramoDe(L, z), p = clamp(z / SEG - i, 0, 1);
  return L.y[i] + (L.y[i + 1] - L.y[i]) * p;
}

// ---------- Un paso de 1/60 s ----------
// dir: -1, 0 o 1 (el dedo). Los sucesos que el juego tiene que oir o pintar
// se dejan en J.ev: { k: 'choque' | 'corazon' | 'turbo' | 'charco' |
// 'control' | 'meta' | 'tiempo' | 'adelanto' | 'bajo' }.
export function paso(L, J, dir, dt, rnd) {
  const zj = J.pos + JZ, i = tramoDe(L, zj), c = L.curva[i];
  const pct = J.v / VMAX;
  J.t += dt;

  if (J.fin) {
    // Tras la meta (o sin tiempo) la moto rueda sola hasta pararse, derecha.
    J.fin.t += dt;
    J.v = Math.max(0, J.v - VMAX * (J.fin.k === 'meta' ? 0.3 : 0.45) * dt);
    J.vx *= Math.max(0, 1 - dt * 6);
    J.x += (clamp(J.x, -0.66, 0.66) - J.x) * Math.min(1, dt * 1.5);
    J.pos += J.v * dt;
    trafico(L, J, dt, rnd);
    return;
  }

  if (J.choque > 0) {
    J.choque -= dt;
    J.v = Math.max(0, J.v - VMAX * 1.2 * dt);
    J.x += J.lado * dt * 0.8 * pct;
    J.vx = 0;
    if (J.choque <= 0) {
      J.v = VMAX * 0.14;
      J.invul = INVUL_T;
      J.x = clamp(J.x, -0.9, 0.9);
    }
  } else if (J.corriendo) {
    // Girar con un poco de inercia: el dedo manda, la moto tarda un pelo.
    const lat = dir * GIRO * Math.max(0.25, pct);
    J.vx += (lat - J.vx) * Math.min(1, dt * 10);
    J.x += J.vx * dt;
    J.x -= dt * 2 * pct * pct * c * CENTRIF;
    if (J.resbala > 0) {
      J.resbala -= dt;
      J.x += Math.sin(J.t * 17) * 0.35 * dt;
    }
    const tope = VMAX * (J.turbo > 0 ? TURBO : 1) * (J.resbala > 0 ? 0.62 : 1);
    if (J.v < tope) J.v = Math.min(tope, J.v + ACEL * dt * (J.turbo > 0 ? 2.5 : 1));
    else J.v = Math.max(tope, J.v - ACEL * 1.6 * dt);
    if (Math.abs(J.x) > 1 && J.v > FUERA_LIM) J.v = Math.max(FUERA_LIM, J.v - FUERA_FRENO * dt);
    if (J.turbo > 0) J.turbo -= dt;
    if (J.invul > 0) J.invul -= dt;
  }
  J.x = clamp(J.x, -BORDE, BORDE);
  const zAntes = zj;
  J.pos += J.v * dt;
  const zAhora = J.pos + JZ;
  trafico(L, J, dt, rnd);

  if (!J.corriendo) return;

  // Choques con coches: solo si la moto va mas rapida (los de detras frenan).
  if (J.invul <= 0 && J.choque <= 0) {
    for (const k of L.coches) {
      const d = k.z - zAhora;
      if (d < -60 || d > 170) continue;
      const w = COCHES[k.tipo].w / ANCHO;
      if (Math.abs(J.x - k.x) < (MOTO_W + w) * 0.42 && J.v > k.v * 0.9) {
        J.choque = CHOQUE_T;
        J.lado = Math.sign(J.x - k.x) || (rnd() < 0.5 ? -1 : 1);
        J.choques++;
        J.turbo = 0;
        J.resbala = 0;
        J.ev.push({ k: 'choque', coche: k });
        break;
      }
    }
  }
  // Adelantamientos: un coche que queda atras sin haber chocado.
  for (const k of L.coches) {
    if (!k.pasado && k.z < zAhora - 120 && k.z > zAhora - 2000) {
      k.pasado = true;
      if (J.choque <= 0) { J.adelantos++; J.ev.push({ k: 'adelanto' }); }
    }
  }
  // Corazones, turbos y charcos.
  for (const h of L.corazones) {
    if (h.cogido || h.z > zAhora + 160 || h.z < zAntes - 160) continue;
    if (Math.abs(h.x - J.x) < 0.23 && J.choque <= 0) {
      h.cogido = true;
      J.corazones++;
      J.ev.push({ k: 'corazon', h });
    }
  }
  const iAhora = tramoDe(L, zAhora);
  if (J.choque <= 0) {
    for (const tb of L.turbos) {
      if (iAhora >= tb.i0 && iAhora <= tb.i1 && Math.abs(J.x - CARRILES[tb.carril]) < 0.3) {
        if (J.turbo <= 0) J.ev.push({ k: 'turbo' });
        J.turbo = T_TURBO;
      }
    }
    for (const ch of L.charcos) {
      if (iAhora >= ch.i0 && iAhora <= ch.i1 && Math.abs(J.x - CARRILES[ch.carril]) < 0.3) {
        if (J.resbala <= 0) J.ev.push({ k: 'charco' });
        J.resbala = 0.9;
        J.turbo = 0;
      }
    }
  }
  // El reloj, los controles y la meta.
  const antes = J.tiempo;
  J.tiempo -= dt;
  if (J.tiempo <= 5 && Math.ceil(J.tiempo) < Math.ceil(antes) && J.tiempo > 0) J.ev.push({ k: 'bajo', s: Math.ceil(J.tiempo) });
  if (J.pasados < 2 && iAhora >= L.controles[J.pasados]) {
    J.pasados++;
    J.tiempo += L.extra;
    J.ev.push({ k: 'control', extra: L.extra });
  }
  if (iAhora >= L.meta) {
    J.fin = { k: 'meta', t: 0, sobra: Math.max(0, Math.ceil(J.tiempo)) };
    J.ev.push({ k: 'meta' });
  } else if (J.tiempo <= 0) {
    J.tiempo = 0;
    J.fin = { k: 'tiempo', t: 0 };
    J.ev.push({ k: 'tiempo' });
  }
}

// ---------- El trafico ----------
// Cada coche sigue a su carril a su paso, frena detras del de delante (y
// detras de la moto si ella va mas despacio) y a veces cambia de carril con
// el intermitente puesto. Nunca se cruza delante de la moto si ella viene
// cerca por ese carril: eso no se puede esquivar.
function trafico(L, J, dt, rnd) {
  const zj = J.pos + JZ;
  for (const k of L.coches) {
    const d = k.z - zj;
    // Lejos de la moto no hace falta afinar: siguen a su paso.
    if (d > 420 * SEG || d < -60 * SEG) { k.z += k.v * dt; continue; }
    let vObj = k.vBase;
    for (const o of L.coches) {
      if (o === k) continue;
      const dd = o.z - k.z;
      if (dd > 0 && dd < 14 * SEG && Math.abs(o.x - k.x) < 0.45) vObj = Math.min(vObj, o.v);
    }
    if (d < 0 && d > -9 * SEG && Math.abs(J.x - k.x) < 0.4 && J.v < k.v) vObj = Math.min(vObj, J.v * 0.9);
    k.v += (vObj - k.v) * Math.min(1, dt * 3);
    k.z += k.v * dt;
    // Cambio de carril.
    if (k.intermitente > 0) {
      k.intermitente -= dt;
      if (k.intermitente <= 0) {
        if (estorba(J, k) || ocupado(L, k, k.destino)) k.destino = k.carril;
        else k.carril = k.destino;
      }
    } else if (d > 30 * SEG && d < 260 * SEG) {
      k.pensar -= dt;
      if (k.pensar <= 0) {
        k.pensar = 3 + rnd() * 5;
        const nl = k.carril + (rnd() < 0.5 ? -1 : 1);
        if (rnd() < 0.45 && nl >= 0 && nl <= 2 && !ocupado(L, k, nl) && !estorba(J, k)) {
          k.destino = nl;
          k.intermitente = 1.1;
        }
      }
    }
    const ox = CARRILES[k.carril];
    k.x += clamp(ox - k.x, -1.1 * dt, 1.1 * dt);
  }
}

// Hay otro coche en ese carril cerca (delante o detras)?
function ocupado(L, k, nl) {
  for (const o of L.coches) if (o !== k && Math.abs(o.z - k.z) < 12 * SEG && (o.carril === nl || o.destino === nl)) return true;
  return false;
}

// Se le cruzaria a la moto? Si ella lo alcanza en menos de ~2,2 s, no se
// cambia, venga ella por el carril que venga: tambien ella puede estar
// cambiandose, y un coche que se mete delante sin tiempo para reaccionar no
// se puede esquivar (medido: 3 a 11 choques asi por nivel con 1,3 s y
// mirando solo el carril de la moto).
function estorba(J, k) {
  const d = k.z - (J.pos + JZ);
  const alcance = Math.max(0, J.v - k.v) * 2.2 + 10 * SEG;
  return d > -10 * SEG && d < alcance;
}

// ---------- Puntos ----------
export const PUNTOS = { corazon: 50, adelanto: 10, segundo: 40, sinChoques: 500, meta: 600 };
export function puntosMeta(J) {
  return PUNTOS.meta + J.fin.sobra * PUNTOS.segundo + (J.choques === 0 ? PUNTOS.sinChoques : 0);
}
