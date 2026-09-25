// LOS ENEMIGOS - como se DIBUJAN. Los dibujos (tools/enemigos-atlas.py) y lo
// que la escena pinta encima: su sombra, el destello al recibir, el temblor
// del aviso de la acometida, los puntos de vida y las bolas de fuego. La
// logica vive en caba-enemigos.js, sin DOM.
//
// Los dibujos van en TRES hojas (HOJA_DE): los de siempre en img/enemigos.png,
// los del final del bosque en img/enemigos2.png y los vampiros del cementerio
// en img/enemigos3.png (juntos pasaban de 4096 px de alto, lo que muchos
// moviles no suben a la grafica).

import { LOBO, KITSUNE, FUEGO, KARASU, YAMABUSHI, ALFA, VAMPIRA, VAMPIRO, CONDESA, SANGRE, HOJA_DE } from './enemigos-atlas.js';
import * as EN from './caba-enemigos.js';
import { sombra } from './bosque-sprite.js';
import { CAE_T, COLOR_RESPUESTA } from './caba-efectos.js';

const HOJAS = ['../../img/enemigos.png', '../../img/enemigos2.png', '../../img/enemigos3.png'].map(ruta => {
  const im = new Image();
  im.src = new URL(ruta, import.meta.url).href;
  return im;
});
function lista(h) { const im = HOJAS[h]; return im.complete && im.naturalWidth > 0; }
export function cargaEnemigos() {
  return Promise.all(HOJAS.map((im, h) => new Promise((ok, mal) => {
    if (lista(h)) return ok();
    im.addEventListener('load', () => ok(), { once: true });
    im.addEventListener('error', mal, { once: true });
  })));
}

// Colores para lo que la escena pinta encima (chispas, polvo, sangre).
export const P = {
  lobo1: '#2c2c3c', lobo2: '#5a5a70', sangre: '#8b1a2b',
  kitsune1: '#ffd27a', kitsune2: '#8e1c2c',
  fuego1: '#6be8ff', fuego2: '#1e9cd8', fuego3: '#e8ffff',
  oro: '#ffe066',
  // los tengus: la tunica roja y las plumas (claras: las suyas, casi negras,
  // no se ven sobre el bosque); el lobo blanco
  tengu1: '#b8483a', tengu2: '#e07a52', pluma: '#9a90b0',
  alfa1: '#e8dcc0', alfa2: '#b8ae98',
  acero: '#e8f0ff',
  // los vampiros: la sangre y las brasas en que se deshacen
  sangre1: '#c41c2c', sangre2: '#ff4a3a', sangre3: '#6a0c18', brasa: '#ffb040',
};

const ATLAS = { lobo: LOBO, kitsune: KITSUNE, karasu: KARASU, yamabushi: YAMABUSHI, alfa: ALFA,
                vampira: VAMPIRA, vampiro: VAMPIRO, condesa: CONDESA };
// Cuantos fotogramas tiene cada animacion (lo que necesita EN.pose).
const CUENTA = {};
for (const [k, A] of Object.entries(ATLAS)) {
  CUENTA[k] = {};
  for (const [n, f] of Object.entries(A)) CUENTA[k][n] = f.length;
}
const esLobo = E => E.tipo === 'lobo' || E.tipo === 'alfa';

// LA SILUETA BLANCA (el destello del golpe), fotograma a fotograma segun se
// necesita: con dos hojas, copiarlas enteras en blanco eran otros 27 MB.
const BLANCAS = new Map();
function blanca(h, fr) {
  const clave = h + ':' + fr[0] + ',' + fr[1];
  let cv = BLANCAS.get(clave);
  if (cv || !lista(h)) return cv || null;
  cv = document.createElement('canvas');
  cv.width = fr[2]; cv.height = fr[3];
  const c = cv.getContext('2d');
  c.drawImage(HOJAS[h], fr[0], fr[1], fr[2], fr[3], 0, 0, fr[2], fr[3]);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
  BLANCAS.set(clave, cv);
  return cv;
}

// ex, ey: aplastarlo alrededor de los pies (el golpe que recibe).
function pinta(g, img, x, y, dir, fr, ex = 1, ey = 1) {
  const [sx, sy, w, h, ox, oy] = fr;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (dir < 0) g.scale(-1, 1);
  if (ex !== 1 || ey !== 1) g.scale(ex, ey);
  g.drawImage(img, sx, sy, w, h, ox, oy, w, h);
  g.restore();
}
// Lo mismo desde la silueta blanca de un fotograma (sin su x, y en la hoja).
function pintaBlanca(g, cv, x, y, dir, fr, ex = 1, ey = 1) {
  const [, , w, h, ox, oy] = fr;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (dir < 0) g.scale(-1, 1);
  if (ex !== 1 || ey !== 1) g.scale(ex, ey);
  g.drawImage(cv, 0, 0, w, h, ox, oy, w, h);
  g.restore();
}

// UN ENEMIGO, con su sombra. `cx` es la camara.
export function drawEnemigo(g, E, cx, t) {
  const h = HOJA_DE[E.tipo];
  if (E.oculto || !lista(h)) return;
  if (E.st === EN.MUERTO && E.muertoT > 2) return;
  const x = E.x - cx;
  if (x < -200 || x > 1400) return;
  const [anim, k] = EN.pose(E, CUENTA[E.tipo]);
  const arr = ATLAS[E.tipo][anim] || ATLAS[E.tipo].idle;
  const fr = arr[Math.min(k, arr.length - 1)];
  // Tumbado se desvanece: del segundo 1.2 al 2 (y se deshace en humo, que lo
  // pone caba-efectos.js muerte()).
  const a = E.st === EN.MUERTO ? Math.max(0, Math.min(1, (2 - E.muertoT) / 0.8)) : 1;
  // EL ULTIMO GOLPE LO LANZA: un salto hacia atras antes de caer (el lobo;
  // la kitsune se convierte en su fuego, que ya es su muerte del pack). Antes
  // se desplomaba en el sitio con dos fotogramas y no pesaba.
  const vuela = E.st === EN.MUERTO && esLobo(E) && E.muertoT < CAE_T ? Math.sin(Math.PI * E.muertoT / CAE_T) * 58 : 0;
  // EL CUERVO EN EL AIRE: su sombra se queda en el camino, y es el aviso del
  // picado (drawSombraPicado, abajo); el se dibuja arriba.
  const alt = E.alt || 0;
  if (E.tipo === 'karasu' && E.atk === 'picado' && E.st === EN.ATACA) drawSombraPicado(g, E, x, t);
  else sombra(g, x, E.y + 2, (E.T.ancho + 10) * (1 - vuela / 160), 6, 0.32 * a);
  // LA ACOMETIDA SE VE VENIR: agachado, tiembla (como el ogro en su finta).
  // El relampago, igual: agachado con la mano en la katana.
  // (y los avisos de un solo fotograma: la estocada del vampiro, la zarpa de
  // la condesa)
  const tiembla = E.st === EN.AVISO && (E.atk === 'acomete' || E.atk === 'relampago' || E.atk === 'estocada' ||
                                        (E.tipo === 'condesa' && E.atk === 'zarpa')) ? (((t * 40) | 0) & 1 ? 2 : -2) : 0;
  // EL GOLPE SE NOTA: aplastado y ensanchado mientras destella.
  const k2 = E.flash > 0 ? Math.min(1, E.flash / 0.1) : 0;
  const ex = 1 + 0.14 * k2, ey = 1 - 0.12 * k2;
  const img = HOJAS[h], y = E.y - vuela - alt;
  // EL RELAMPAGO: copias que se quedan atras mientras cruza.
  if (E.tipo === 'yamabushi' && E.st === EN.ATACA && E.atk === 'relampago') drawRelampago(g, E, x, img, fr);
  g.globalAlpha = a;
  pinta(g, img, x + tiembla, y, E.dir, fr, ex, ey);
  if (E.flash > 0) {
    const B = blanca(h, fr);
    if (B) { g.globalAlpha = k2 * 0.8 * a; pintaBlanca(g, B, x + tiembla, y, E.dir, fr, ex, ey); }
  }
  g.globalAlpha = 1;
  if (E.st === EN.AULLA) drawAullido(g, E, x, t);
  // LA VIDA: puntos sobre la cabeza, solo si ya le han dado (y no a los que
  // estan enteros: el camino se llenaria de marcadores).
  if (E.vivo && E.hp < E.hpMax) {
    const yv = Math.round(y - E.T.alto - 22), w = E.hpMax * 12;
    for (let i = 0; i < E.hpMax; i++) {
      g.fillStyle = '#10080c'; g.fillRect(Math.round(x - w / 2 + i * 12), yv, 10, 6);
      g.fillStyle = i < E.hp ? '#e83a5a' : '#3a2030'; g.fillRect(Math.round(x - w / 2 + i * 12) + 1, yv + 1, 8, 4);
    }
  }
}

// LA SOMBRA DEL PICADO: crece y se oscurece mientras sube y se queda encima,
// y cuando se fija (va a caer) se le enciende el aro del color de ESQUIVAR, del
// tamaño de lo que alcanza. Es lo que hay que mirar: donde cae.
function drawSombraPicado(g, E, x, t) {
  const A = E.T.picado;
  const lleno = E.fase === 'sube' ? Math.min(1, E.t / A.sube) : 1;
  const r = A.radio + 8;
  sombra(g, x, E.y + 2, r * (0.45 + 0.55 * lleno), 10 * (0.5 + 0.5 * lleno), 0.3 + 0.3 * lleno);
  if (E.fase === 'sube') return;
  // el aro: hasta donde le da (su radio mas el cuerpo de ella). Tenue y
  // lento mientras la sigue; fijo, parpadeando fuerte.
  const R = A.radio + 22, fijo = E.fase === 'fija' || E.fase === 'cae';
  const parpadeo = ((t * (fijo ? 12 : 4)) | 0) & 1;
  g.fillStyle = COLOR_RESPUESTA.esquivar;
  g.globalAlpha = fijo ? (parpadeo ? 0.95 : 0.6) : (parpadeo ? 0.35 : 0.2);
  const y = Math.round(E.y + 1);
  // una elipse de puntos gruesos (fillRect: pixel), aplastada como el suelo
  for (let i = 0; i < 28; i++) {
    const u = i / 28 * Math.PI * 2;
    g.fillRect(Math.round(x + Math.cos(u) * R) - 3, Math.round(y + Math.sin(u) * R * 0.18) - 2, 6, 4);
  }
  g.globalAlpha = 1;
}

// LAS COPIAS DEL RELAMPAGO: tres detras de el, cada vez mas tenues, y un
// trazo de acero a la altura de la katana.
function drawRelampago(g, E, x, img, fr) {
  const d = -E.dir;
  for (let i = 3; i >= 1; i--) {
    g.globalAlpha = 0.14 * (4 - i);
    pinta(g, img, x + d * i * 34, E.y, E.dir, fr);
  }
  g.globalAlpha = 0.8;
  g.fillStyle = P.acero;
  const largo = Math.min(260, E.t * Math.abs(E.vx));
  g.fillRect(Math.round(E.dir > 0 ? x - largo : x), Math.round(E.y - 74), Math.round(largo), 3);
  g.globalAlpha = 1;
}

// EL AULLIDO: arcos que salen del hocico y se abren.
function drawAullido(g, E, x, t) {
  const hx = x + E.dir * 36, hy = E.y - 160;
  g.fillStyle = '#fff4dc';
  for (let a = 0; a < 3; a++) {
    const u = ((t * 1.6 + a / 3) % 1);
    const R = 18 + u * 90;
    g.globalAlpha = (1 - u) * 0.85;
    for (let i = -4; i <= 4; i++) {
      const ang = -Math.PI / 2 + E.dir * (0.5 + i * 0.16);
      g.fillRect(Math.round(hx + Math.cos(ang) * R) - 2, Math.round(hy + Math.sin(ang) * R) - 2, 5, 5);
    }
  }
  g.globalAlpha = 1;
}

// LAS BOLAS DE FUEGO: la bola del pack girando, con su halo; al chocar, el
// estallido (los ultimos fotogramas del pack). La devuelta por una parada
// lleva el halo de oro: ahora es de ella.
export function drawFuego(g, F, cx) {
  if (!lista(0)) return;
  const x = F.x - cx;
  if (x < -120 || x > 1320) return;
  if (F.rastrero) return drawRastrero(g, F, x);
  if (F.gota) return drawGota(g, F, x);
  if (F.sangre) return drawDardo(g, F, x);
  const n = FUEGO.vuela.length;
  const k = F.fin > 0 ? Math.min(n - 1, 5 + Math.floor(F.fin / 0.36 * (n - 5))) : Math.floor(F.t / 0.06) % 5;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = F.fin > 0 ? 0.25 : 0.35;
  g.fillStyle = F.propio ? P.oro : P.fuego2;
  g.fillRect(Math.round(x - 22), Math.round(F.y - 22), 44, 44);
  g.globalAlpha = F.fin > 0 ? 0.15 : 0.2;
  g.fillRect(Math.round(x - 34), Math.round(F.y - 14), 68, 28);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  pinta(g, HOJAS[0], x, F.y, F.vx > 0 ? 1 : -1, FUEGO.vuela[k]);
}

// LA LLAMA RASTRERA: la llama del pack, grande y con la base APOYADA en el
// camino (se coloca con su propio fotograma: su raiz es la de la bola, que va
// por el aire), y detras una cola de lenguas de fuego seguidas que parpadean y
// bajan hacia atras. Una silueta a ras de suelo que se ve venir y pide
// SALTAR, como la onda del pisoton. (La caja de luz de la bola, a ras de
// suelo, se leia como un rectangulo cian; y con lenguas sueltas, como barras.)
function drawRastrero(g, F, x) {
  const n = FUEGO.rastrero.length, dir = F.vx > 0 ? 1 : -1;
  const k = F.fin > 0 ? Math.min(n - 1, 8 + Math.floor(F.fin / 0.36 * (n - 8))) : Math.floor(F.t / 0.05) % 8;
  const apaga = F.fin > 0 ? Math.max(0, 1 - F.fin / 0.36) : 1;
  const y = F.y, E = 2.2;
  // el resplandor, fino, sobre el camino
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.3 * apaga; g.fillStyle = P.fuego2;
  g.fillRect(Math.round(x - (dir > 0 ? 100 : -10) - 10), y - 3, 120, 5);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  // la cola: lenguas solapadas, cada una con su borde oscuro, su cuerpo y su
  // nucleo blanco, mas bajas cuanto mas atras
  for (let i = 7; i >= 0; i--) {
    const tx = Math.round(x - dir * (10 + i * 9));
    const h = Math.max(3, (34 - i * 4) * (0.7 + 0.3 * Math.sin(F.t * 28 + i * 1.9))) * apaga;
    g.globalAlpha = Math.min(1, (1.15 - i / 8)) * apaga;
    g.fillStyle = P.fuego2; g.fillRect(tx - 6, Math.round(y - h), 12, Math.round(h));
    g.fillStyle = P.fuego1; g.fillRect(tx - 4, Math.round(y - h * 0.72), 8, Math.round(h * 0.72));
    g.fillStyle = P.fuego3; g.fillRect(tx - 2, Math.round(y - h * 0.38), 4, Math.round(h * 0.38));
  }
  // la llama de delante, con la base en el suelo
  const fr = FUEGO.rastrero[k];
  g.globalAlpha = apaga;
  pinta(g, HOJAS[0], x, y - (fr[5] + fr[3]) * E + 2, dir, fr, E, E);
  g.globalAlpha = 1;
}

// EL DARDO DE SANGRE de la condesa: el del pack, con un halo rojo (de oro si
// ella lo ha devuelto: ahora es suyo); al chocar, el salpicon.
function drawDardo(g, F, x) {
  if (!lista(2)) return;
  const dir = F.vx > 0 ? 1 : -1;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = F.fin > 0 ? 0.2 : 0.3;
  g.fillStyle = F.propio ? P.oro : P.sangre1;
  g.fillRect(Math.round(x - 30), Math.round(F.y - 14), 60, 28);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  if (F.fin > 0) {
    const n = SANGRE.salpica.length, k = Math.min(n - 1, Math.floor(F.fin / 0.36 * n));
    return pinta(g, HOJAS[2], x, F.y, dir, SANGRE.salpica[k], 1.6, 1.6);
  }
  pinta(g, HOJAS[2], x, F.y, dir, SANGRE.dardo[Math.floor(F.t / 0.07) % SANGRE.dardo.length], 1.6, 1.6);
}

// LA GOTA DE LA LLUVIA: primero su SOMBRA ROJA en el suelo y la gota
// formandose arriba, temblando (el aviso, como la rama del bosque); luego la
// gota cayendo y el salpicon al llegar. (La primera sombra, un anillo de
// puntos rojo oscuro, no se veia sobre la tierra agrietada.)
function drawGota(g, F, x) {
  if (!lista(2)) return;
  const u = Math.min(1, F.t / F.cae);
  const r = EN.GOTA_R + 12;
  if (F.fin <= 0) {
    sombra(g, x, F.suelo + 2, r * (0.6 + 0.4 * u), 8 * (0.6 + 0.4 * u), 0.3 + 0.35 * u);
    // un charco rojo que se enciende, y su borde, grueso y vivo, que late
    // (y al final parpadea)
    g.globalAlpha = 0.18 + 0.22 * u;
    g.fillStyle = P.sangre1;
    for (let dy = -5; dy <= 5; dy++) {
      const w = r * Math.sqrt(1 - (dy / 6) ** 2);
      g.fillRect(Math.round(x - w), Math.round(F.suelo + 2 + dy), Math.round(w * 2), 1);
    }
    const late = u > 0.7 && ((F.t * 12) | 0) & 1;
    g.globalAlpha = late ? 1 : 0.55 + 0.35 * u;
    g.fillStyle = late ? P.sangre2 : P.sangre1;
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2;
      g.fillRect(Math.round(x + Math.cos(a) * r) - 3, Math.round(F.suelo + 2 + Math.sin(a) * r * 0.2) - 2, 6, 4);
    }
    g.globalAlpha = 1;
    // la gota, arriba, formandose y temblando
    if (F.t < F.cae) {
      const tiembla = Math.round(Math.sin(F.t * 60 + F.x) * (1 + 2 * u));
      pinta(g, HOJAS[2], x + tiembla, EN.GOTA_Y0 - 16, 1, SANGRE.gota[0], 1.2 + 1.0 * u, 1.2 + 1.0 * u);
    }
  }
  if (F.fin > 0) {
    const n = SANGRE.salpica.length, k = Math.min(n - 1, Math.floor(F.fin / 0.36 * n));
    g.globalAlpha = Math.max(0, 1 - F.fin / 0.36);
    pinta(g, HOJAS[2], x, F.suelo - 30, 1, SANGRE.salpica[k], 2.2, 2.2);
    g.globalAlpha = 1;
  } else if (F.t >= F.cae) {
    pinta(g, HOJAS[2], x, F.y - 24, 1, SANGRE.gota[Math.floor(F.t / 0.06) % SANGRE.gota.length], 2.2, 2.2);
  }
}
