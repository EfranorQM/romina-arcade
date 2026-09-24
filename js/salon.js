// EL SALON RECREATIVO del menu: el fondo y las maquinas.
//
// El menu era una estanteria de caratulas sobre un degradado. Ahora cada juego
// es una MAQUINA de arcade, en fila en un salon: marquesina encendida con su
// nombre, la pantalla con su portada, el panel con la palanca y los botones, y
// la puerta de las monedas. Detras, el salon: el cartel de neon de ROMINA'S
// ARCADE, una fila de maquinas lejanas que se mueve mas despacio al arrastrar
// (da profundidad), dos lamparas y la moqueta de salon recreativo.
//
// Aqui solo se DIBUJA. El arrastre, el muelle y los toques siguen en menu.js,
// medidos por tools/prueba-menu.mjs.
import { text as textoFuente, measure } from './font.js';
import { supersample } from './core.js';

// EL TEXTO CON SOBREMUESTREO. font.js hornea cada cadena a x1 y la dibuja
// dividida por el sobremuestreo, asi que con ss:2 TODO texto sale a la mitad
// (SURVIVAL, que tambien va a ss:2, vive asi desde siempre y sus escalas estan
// elegidas contando con ello: no se toca la fuente). Aqui se le pide la escala
// por el sobremuestreo: sale del tamaño pedido y, de paso, el doble de nitido.
// measure(s, esc) sigue dando el ancho de verdad.
export function text(g, s, x, y, color, esc = 1) { textoFuente(g, s, x, y, color, esc * supersample()); }
export function textCenter(g, s, cx, y, color, esc = 1) { text(g, s, Math.round(cx - measure(String(s), esc) / 2), y, color, esc); }

// ---------- Medidas (px virtuales del menu, 600x270) ----------
// La maquina, a escala 1 (la del centro): 120 x 192. La pantalla es 3:4, como
// las portadas, y en vertical, como las maquinas de verdad de los 80.
export const MQ_W = 120, MQ_H = 192;
export const PANTALLA = { x: 21, y: 33, w: 78, h: 104 };
export const SUELO_Y = 196;         // donde la pared toca el suelo
const ESC = 2;                      // se hornea al doble: el menu va a 1200x540

const OSC = '#07040d';

function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * ESC); cv.height = Math.ceil(h * ESC);
  const d = cv.getContext('2d');
  d.imageSmoothingEnabled = false;
  d.scale(ESC, ESC);
  return { cv, d };
}
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const oscurece = (h, f) => { const [r, g, b] = hex(h); return `rgb(${r * f | 0},${g * f | 0},${b * f | 0})`; };

// ---------- Una maquina ----------
// Se hornea UNA vez por juego, sin la portada: la portada se pinta encima en
// cada frame (la de ROMINA llega tarde, cuando cargan sus dibujos).
export function horneaMaquina(meta) {
  const { cv, d } = lienzo(MQ_W, MQ_H);
  const c0 = meta.colors[0], c1 = meta.colors[1] || c0;
  const cuerpo = '#1c1230', cuerpo2 = '#140c24';

  // El mueble: los laterales, un poco mas anchos abajo.
  d.fillStyle = OSC; d.fillRect(0, 2, MQ_W, MQ_H - 2);
  d.fillStyle = cuerpo; d.fillRect(1, 3, MQ_W - 2, MQ_H - 4);
  d.fillStyle = cuerpo2; d.fillRect(1, 150, MQ_W - 2, MQ_H - 151);
  // Las franjas de color de los laterales (el arte del mueble).
  d.fillStyle = c0; d.fillRect(3, 30, 2, 118); d.fillRect(MQ_W - 5, 30, 2, 118);
  d.fillStyle = oscurece(c0, 0.5); d.fillRect(6, 30, 1, 118); d.fillRect(MQ_W - 7, 30, 1, 118);

  // LA MARQUESINA: la caja de luz con el nombre.
  d.fillStyle = OSC; d.fillRect(4, 3, MQ_W - 8, 24);
  const mg = d.createLinearGradient(0, 5, 0, 25);
  mg.addColorStop(0, oscurece(c1, 0.95)); mg.addColorStop(1, oscurece(c1, 0.45));
  d.fillStyle = mg; d.fillRect(6, 5, MQ_W - 12, 20);
  d.fillStyle = 'rgba(255,255,255,0.18)'; d.fillRect(6, 5, MQ_W - 12, 2);
  // El nombre, con su sombra; si no cabe, se estrecha para que quepa. Oscuro
  // sobre marquesina clara y blanco sobre oscura: en blanco, sobre el dorado de
  // ROMINA o el amarillo de NEON FIST, no se leia.
  const ancho = measure(meta.title, 2), hueco = MQ_W - 16;
  const k = Math.min(1, hueco / ancho);
  const [r1, g1, b1] = hex(c1);
  const clara = 0.299 * r1 + 0.587 * g1 + 0.114 * b1 > 140;
  d.save();
  d.translate(MQ_W / 2, 8); d.scale(k, 1);
  text(d, meta.title, -ancho / 2 + 1, 1, clara ? 'rgba(255,255,255,0.45)' : OSC, 2);
  text(d, meta.title, -ancho / 2, 0, clara ? '#1a0e14' : '#ffffff', 2);
  d.restore();

  // EL BISEL de la pantalla.
  d.fillStyle = OSC; d.fillRect(8, 29, MQ_W - 16, 112);
  d.fillStyle = '#0c0814'; d.fillRect(10, 31, MQ_W - 20, 108);
  d.fillStyle = '#241a36'; d.fillRect(10, 31, MQ_W - 20, 1);
  d.fillStyle = OSC; d.fillRect(PANTALLA.x - 1, PANTALLA.y - 1, PANTALLA.w + 2, PANTALLA.h + 2);

  // EL PANEL DE MANDOS: inclinado, un poco mas ancho que el bisel.
  for (let y = 0; y < 16; y++) {
    const ext = Math.round(y * 0.4);
    d.fillStyle = y === 0 ? '#4a3670' : y < 3 ? '#35255a' : '#2a1d48';
    d.fillRect(6 - ext, 142 + y, MQ_W - 12 + ext * 2, 1);
  }
  d.fillStyle = OSC; d.fillRect(0, 158, MQ_W, 2);
  // La palanca: la base, el palo y la bola roja.
  d.fillStyle = '#0c0814'; d.fillRect(30, 151, 13, 4);
  d.fillStyle = '#1a1a1a'; d.fillRect(35, 144, 3, 9);
  d.fillStyle = '#e02840'; d.fillRect(33, 141, 7, 6);
  d.fillStyle = '#ff7080'; d.fillRect(34, 142, 2, 2);
  // Los botones, de los colores del juego.
  for (const [bx, by, col] of [[70, 149, c0], [81, 147, c1], [92, 149, '#ffe066']]) {
    d.fillStyle = OSC; d.fillRect(bx - 1, by - 1, 8, 7);
    d.fillStyle = col; d.fillRect(bx, by, 6, 5);
    d.fillStyle = 'rgba(255,255,255,0.45)'; d.fillRect(bx + 1, by, 3, 1);
  }

  // LA PUERTA DE LAS MONEDAS.
  d.fillStyle = OSC; d.fillRect(42, 165, 36, 22);
  d.fillStyle = '#0e0818'; d.fillRect(43, 166, 34, 20);
  for (const sx of [51, 65]) {
    d.fillStyle = '#3a1a08'; d.fillRect(sx - 1, 169, 6, 11);
    d.fillStyle = '#ff9a3c'; d.fillRect(sx + 1, 171, 2, 7);
  }
  // El zocalo.
  d.fillStyle = OSC; d.fillRect(0, MQ_H - 4, MQ_W, 4);
  return cv;
}

// Las rayas de la pantalla (scanlines) y el brillo del cristal, horneados una
// vez para el tamaño de pantalla del centro.
let rayas = null;
export function rayasPantalla() {
  if (rayas) return rayas;
  const { cv, d } = lienzo(PANTALLA.w, PANTALLA.h);
  d.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < PANTALLA.h; y += 1) d.fillRect(0, y + 0.5, PANTALLA.w, 0.5);
  // el reflejo del cristal: una banda en diagonal
  d.fillStyle = 'rgba(255,255,255,0.07)';
  d.beginPath(); d.moveTo(0, 18); d.lineTo(PANTALLA.w, -8); d.lineTo(PANTALLA.w, 6); d.lineTo(0, 32); d.closePath(); d.fill();
  rayas = cv;
  return cv;
}

// ---------- El fondo ----------
// Lo caro de pintar en cada frame son los DEGRADADOS. Medido en Chrome sin GPU,
// a 1200x540: la pared costaba 0,77 ms, la sombra del suelo 0,40 y la luz de la
// maquina del centro 1,6, cuando un rectangulo liso de ese tamaño cuesta 0,05.
// Asi que lo que no cambia se hornea una vez y se copia:
//   - la pared de arriba, con sus lamparas: quieta;
//   - la fila de maquinas lejanas, con la pared de detras y la franja que las
//     hunde: una tira que se repite cada seis maquinas y corre al arrastrar;
//   - la moqueta con su sombra: la sombra solo cambia en vertical y la moqueta
//     solo corre en horizontal, asi que horneada da lo mismo que encima.
// La luz cambia de color al arrastrar (mezcla las dos maquinas que se cruzan) y
// no se puede hornear: va en bandas lisas, como se pinta la luz en pixel art.

// La MOQUETA: el suelo de todos los salones recreativos, negro con figuras de
// neon. Una tira que se repite y corre con el arrastre.
const MOQ_W = 160, MOQ_H = 74;
let moqueta = null;
function horneaMoqueta() {
  const { cv, d } = lienzo(MOQ_W, MOQ_H);
  d.fillStyle = '#0c0818'; d.fillRect(0, 0, MOQ_W, MOQ_H);
  const cols = ['#ff5c9d', '#5cffd8', '#ffe14d', '#9a64e0'];
  // figuras sueltas, repartidas a mano para que no se vea la rejilla
  const figs = [[12, 8, 0, 0], [46, 22, 1, 1], [80, 6, 2, 2], [118, 18, 3, 0], [150, 34, 0, 1], [26, 40, 2, 3],
                [64, 50, 3, 2], [100, 44, 1, 0], [136, 58, 2, 1], [8, 62, 1, 2], [90, 66, 0, 3], [40, 70, 3, 1]];
  for (const [x, y, c, f] of figs) {
    d.fillStyle = cols[c];
    if (f === 0) { d.fillRect(x, y, 6, 1); d.fillRect(x + 2, y - 2, 1, 5); }              // cruz
    else if (f === 1) { d.fillRect(x, y, 4, 4); d.fillStyle = '#0c0818'; d.fillRect(x + 1, y + 1, 2, 2); }  // cuadro
    else if (f === 2) { for (let i = 0; i < 5; i++) d.fillRect(x + i, y + (i & 1), 1, 1); } // zigzag
    else { d.fillRect(x, y + 2, 1, 1); d.fillRect(x + 1, y + 1, 1, 1); d.fillRect(x + 2, y, 1, 1); d.fillRect(x + 3, y + 1, 1, 1); d.fillRect(x + 4, y + 2, 1, 1); } // arco
  }
  // La sombra que la oscurece hacia delante, para que se lea el texto, y el
  // borde donde empieza (la moqueta mide lo que va del suelo al pie: 74).
  const s = d.createLinearGradient(0, 0, 0, MOQ_H);
  s.addColorStop(0, 'rgba(8,4,20,0.25)'); s.addColorStop(1, 'rgba(8,4,20,0.85)');
  d.fillStyle = s; d.fillRect(0, 0, MOQ_W, MOQ_H);
  d.fillStyle = '#2a1d48'; d.fillRect(0, 0, MOQ_W, 1);
  return cv;
}

// LA PARED y la fila de maquinas lejanas.
const LEJ_Y = 112;                  // de aqui al suelo, la fila lejana
const PASO = 46;                    // de una maquina lejana a la siguiente
const PANT_LEJ = ['#4de0f0', '#ff5c9d', '#ffe14d', '#5cffd8', '#9a64e0', '#ff9a3c'];
const PERIODO = PASO * PANT_LEJ.length;   // la fila se repite cada seis
let pared = null, lejanas = null, paredVW = 0;

// El degradado de la pared, para un lienzo cuyo y=0 cae en la y0 del salon:
// la tira lejana lo lleva detras y tiene que empalmar con el de arriba.
function degradadoPared(d, y0) {
  const p = d.createLinearGradient(0, -y0, 0, SUELO_Y - y0);
  p.addColorStop(0, '#170b30'); p.addColorStop(1, '#0e0720');
  return p;
}

function horneaPared(VW) {
  const a = lienzo(VW, LEJ_Y);
  a.d.fillStyle = degradadoPared(a.d, 0); a.d.fillRect(0, 0, VW, LEJ_Y);
  // Las LAMPARAS del techo (su cono se pinta encima de la fila lejana).
  for (const lx of [96, VW - 96]) {
    a.d.fillStyle = '#2a1d48'; a.d.fillRect(lx - 1, 0, 2, 18);
    a.d.fillStyle = '#3a2a60'; a.d.fillRect(lx - 9, 18, 18, 5);
    a.d.fillStyle = '#ffe9b0'; a.d.fillRect(lx - 7, 23, 14, 2);
  }
  pared = a.cv;
  // Las maquinas lejanas: siluetas con la pantalla encendida y una franja
  // oscura que las hunde, porque estan al fondo. La tira mide un periodo mas
  // que el lienzo: asi cualquier desplazamiento sale de un solo recorte.
  const w = PERIODO + VW, h = SUELO_Y - LEJ_Y, y = 118 - LEJ_Y;
  const b = lienzo(w, h), d = b.d;
  d.fillStyle = degradadoPared(d, LEJ_Y); d.fillRect(0, 0, w, h);
  for (let n = 0; n * PASO < w; n++) {
    const x = n * PASO;
    d.fillStyle = '#1a1036'; d.fillRect(x, y, 34, h - y);
    d.fillStyle = '#120a28'; d.fillRect(x, y, 34, 3);
    d.fillStyle = PANT_LEJ[n % PANT_LEJ.length];
    d.globalAlpha = 0.18; d.fillRect(x + 7, y + 10, 20, 24);
    d.globalAlpha = 0.5; d.fillRect(x + 4, y + 2, 26, 4);
    d.globalAlpha = 1;
  }
  d.fillStyle = 'rgba(14,7,32,0.55)'; d.fillRect(0, 0, w, h);
  lejanas = b.cv;
  paredVW = VW;
}

// El salon entero, detras de las maquinas. `desliza` es cuanto se ha
// arrastrado la fila (en px): el fondo lejano corre mas despacio que el suelo.
// Los desplazamientos se redondean al pixel del lienzo (medio pixel virtual) y
// no al virtual: la fila lejana corre a 0,3 y, a pixeles enteros, avanzaba a
// saltos al arrastrar despacio.
export function drawFondo(g, VW, t, desliza, luz) {
  if (!pared || paredVW !== VW) horneaPared(VW);
  if (!moqueta) moqueta = horneaMoqueta();
  g.drawImage(pared, 0, 0, VW, LEJ_Y);

  // La fila lejana corre a un tercio de lo que corre la de delante: es lo que
  // hace que se lea como un salon y no como un escaparate.
  const h = SUELO_Y - LEJ_Y;
  const W = Math.round(desliza * 0.3 * ESC) / ESC;       // cuanto ha corrido
  const w0 = ((W % PERIODO) + PERIODO) % PERIODO;        // su trozo de tira
  g.drawImage(lejanas, w0 * ESC, 0, VW * ESC, h * ESC, 0, LEJ_Y, VW, h);
  // Sus pantallas titilan, cada una a su ritmo: van encima de la tira, con el
  // alfa ya rebajado por la franja oscura que en la tira tienen encima.
  for (let m = Math.floor(W / PASO); m * PASO - W < VW; m++) {
    g.fillStyle = PANT_LEJ[((m % 6) + 6) % 6];
    g.globalAlpha = 0.09 * (0.5 + 0.5 * Math.sin(t * 2 + m * 1.3));
    g.fillRect(m * PASO - W + 7, 128, 20, 24);
  }
  g.globalAlpha = 1;

  // El cono de luz de las lamparas.
  g.fillStyle = 'rgba(255,233,176,0.05)';
  for (const lx of [96, VW - 96]) {
    g.beginPath(); g.moveTo(lx - 7, 25); g.lineTo(lx + 7, 25); g.lineTo(lx + 52, SUELO_Y); g.lineTo(lx - 52, SUELO_Y); g.closePath(); g.fill();
  }

  // EL SUELO: la moqueta, corriendo con la fila.
  const M = Math.round(desliza * 0.8 * ESC) / ESC;
  const mo = ((-M % MOQ_W) + MOQ_W) % MOQ_W;
  for (let x = mo - MOQ_W; x < VW; x += MOQ_W) g.drawImage(moqueta, x, SUELO_Y, MOQ_W, MOQ_H);

  // La luz de la maquina del centro, derramada por la pared y el suelo: cuatro
  // circulos del mismo alfa, uno dentro de otro. En el centro suman lo que
  // sumaba el degradado (0,15 frente a 0,16), y cada banda cuesta un
  // rectangulo liso en vez de un degradado.
  if (luz) {
    const [r, gg, b] = hex(luz);
    g.fillStyle = `rgba(${r},${gg},${b},0.04)`;
    for (const rad of [190, 145, 100, 55]) {
      g.beginPath(); g.arc(VW / 2, 120, rad, 0, Math.PI * 2); g.fill();
    }
  }
}

// EL CARTEL DE NEON: ROMINA'S ARCADE, con su marco de tubo y dos corazones.
// De vez en cuando ARCADE parpadea, como un tubo viejo.
export function drawLetrero(g, VW, t) {
  const t1 = "ROMINA'S", t2 = 'ARCADE';
  const w1 = measure(t1, 2), w2 = measure(t2, 2), gap = 8;
  const W = w1 + gap + w2, x0 = Math.round(VW / 2 - W / 2), y0 = 7;
  const fallo = (t % 7.3) > 7.0 && ((t * 20) | 0) % 2 === 0;
  // el resplandor: el texto repetido alrededor, en tenue
  g.globalAlpha = 0.35;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    text(g, t1, x0 + dx, y0 + dy, '#ff2d7a', 2);
    if (!fallo) text(g, t2, x0 + w1 + gap + dx, y0 + dy, '#20ffc8', 2);
  }
  g.globalAlpha = 1;
  text(g, t1, x0, y0, '#ffb0d0', 2);
  text(g, t2, x0 + w1 + gap, y0, fallo ? '#1a4a44' : '#b0fff0', 2);
  // el marco de tubo
  const fx = x0 - 12, fy = y0 - 5, fw = W + 24, fh = 24;
  g.fillStyle = 'rgba(255,45,122,0.35)';
  g.fillRect(fx - 1, fy - 1, fw + 2, 3); g.fillRect(fx - 1, fy + fh - 2, fw + 2, 3);
  g.fillRect(fx - 1, fy - 1, 3, fh + 2); g.fillRect(fx + fw - 2, fy - 1, 3, fh + 2);
  g.fillStyle = '#ff7ab0';
  g.fillRect(fx, fy, fw, 1); g.fillRect(fx, fy + fh - 1, fw, 1);
  g.fillRect(fx, fy, 1, fh); g.fillRect(fx + fw - 1, fy, 1, fh);
  // los corazones a los lados
  for (const hx of [fx - 18, fx + fw + 8]) corazon(g, hx, fy + 7, '#ff5c9d', 0.5 + 0.5 * Math.sin(t * 3));
}

// Tambien lo usa el aviso de actualizacion (aviso-update.js), a los lados de
// su titulo, como aqui a los lados del cartel.
export function corazon(g, x, y, col, a) {
  g.globalAlpha = 0.6 + 0.4 * a;
  g.fillStyle = col;
  g.fillRect(x + 1, y, 3, 2); g.fillRect(x + 6, y, 3, 2);
  g.fillRect(x, y + 1, 10, 3); g.fillRect(x + 1, y + 4, 8, 2);
  g.fillRect(x + 3, y + 6, 4, 2); g.fillRect(x + 4, y + 8, 2, 1);
  g.globalAlpha = 1;
}

