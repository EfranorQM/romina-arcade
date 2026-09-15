// SURVIVAL — el arte. Roma, los siete enemigos y los diez jefes, dibujados por
// codigo como todo en esta app.
//
// El juego original usaba emojis (👻 💀 🌑 ⚡ ...) dentro de divs. Aqui cada
// criatura tiene su forma de verdad: la DUDA es un fantasma con la sabana
// ondeando, el MURO lleva su escudo por delante, los CELOS son una llama. Se
// hornean UNA vez a un canvas y despues solo se estiran, que es lo que permite
// tener treinta enemigos en pantalla sin bajar de 60fps.
//
// Todo se dibuja dentro de una caja de SZ x SZ centrada en (SZ/2, SZ/2), asi
// el motor puede colocarlos por su centro sin saber nada de cada dibujo.

import { builders2 } from './surv-art2.js';

const SZ = 64;                     // lado de la lamina de cada criatura

// Cada sprite se hornea a su propio canvas. `f` recibe el contexto ya centrado.
//
// La lamina es MAS GRANDE que la figura (MARGEN por cada lado) porque el glow
// se hornea aqui dentro y necesita sitio: en la lamina justa de 64 solo
// quedaban 6-9 px libres alrededor del cuerpo, y a la escala a la que se dibuja
// (0.56) eso son menos de 4 px en pantalla. Medido con tools/_a/medir.html.
//
// La figura se sigue dibujando en coordenadas de SZ centradas en el origen: el
// margen lo absorbe el translate, asi que ningun dibujo de criatura cambia.
function bake(f, size = SZ) {
  const N = size + MARGEN * 2;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const d = cv.getContext('2d');
  d.imageSmoothingEnabled = false;
  d.translate(N / 2, N / 2);
  glowCol = null;                  // lo rellena halo() si la figura pide neon
  f(d, size);
  return glowCol ? conGlow(cv, glowCol, glowA) : cv;
}

// Cuanto crece la lamina por cada lado. Con 16 el halo que rodea a la figura
// pasa de 121 a 213 pixeles de PANTALLA encendidos sobre el cielo del bioma
// (medido en tools/_a/wcag2.html, los 80 pares criatura-bioma).
//
// Probado tambien a 4, 10 y 12: el coste por frame sale el MISMO dentro del
// ruido de la medida (+-0.5 ms), porque lo que se paga no es el area de la
// lamina sino mezclar un sprite que ahora lleva mucho pixel semitransparente.
// Como el margen sale gratis, se coge el que deja sitio al desenfoque largo.
const MARGEN = 16;

// `halo()` ya NO dibuja nada: solo APUNTA de que color quiere brillar la
// figura. El disco que dibujaba antes quedaba DENTRO del cuerpo opaco (medido:
// sobresalia -1.3 a -3.2 px en las siete criaturas) y lo tapaba el propio
// dibujo que venia despues, asi que se pagaba un gradiente radial por criatura
// para no ver ni un pixel de neon. El radio que recibia se ignora a proposito:
// el glow de verdad sale de la SILUETA, no de un circulo.
let glowCol = null, glowA = 0.5;
function halo(d, r, col, a = 0.5) { glowCol = col; glowA = a; }

// El glow: se lee la silueta del sprite ya horneado, se tine del color y se
// desenfoca reduciendola y volviendola a ampliar. El navegador hace ese
// desenfoque bilineal en la GPU y aqui se paga UNA vez por criatura (medido:
// 0.59 ms cada una, 16.5 ms las 28 juntas), no por frame como shadowBlur.
//
// Son tres pasadas de radio creciente sumadas con 'lighter': la corta pega el
// neon al borde de la figura y la larga lo derrama. Con una sola pasada o se
// ve un contorno duro o se ve una nube sin borde.
const PASADAS = [[3, 0.50], [6, 0.55], [12, 0.60]];

function conGlow(src, col, a) {
  const N = src.width;
  // Silueta tenida: el sprite como mascara y el color encima.
  const m = document.createElement('canvas');
  m.width = N; m.height = N;
  const md = m.getContext('2d');
  md.drawImage(src, 0, 0);
  md.globalCompositeOperation = 'source-in';
  md.fillStyle = col; md.fillRect(0, 0, N, N);

  const o = document.createElement('canvas');
  o.width = N; o.height = N;
  const d = o.getContext('2d');
  d.globalCompositeOperation = 'lighter';
  for (const [q, pa] of PASADAS) {
    const lw = Math.max(2, Math.round(N / q));
    const lo = document.createElement('canvas');
    lo.width = lw; lo.height = lw;
    const ld = lo.getContext('2d');
    ld.imageSmoothingEnabled = true;
    ld.drawImage(m, 0, 0, lw, lw);
    d.imageSmoothingEnabled = true;
    // El alpha que pedia cada halo() se respeta, pero COMPRIMIDO. Los valores
    // viejos (0.22 a 0.50) estaban medidos para un disco DEBAJO del cuerpo, que
    // es otra cosa: usados tal cual, el PESO (0.22) se quedaba en 0.0 px de
    // glow visible y no se notaba nada. Mapeados a 0.75-1.10 todos brillan y se
    // conserva quien queria brillar mas que quien menos.
    d.globalAlpha = pa * (0.75 + (a - 0.22) * (0.35 / 0.28));
    d.drawImage(lo, 0, 0, N, N);
  }
  d.globalAlpha = 1;
  d.globalCompositeOperation = 'source-over';
  // La figura, entera y opaca, encima de su propio resplandor.
  d.drawImage(src, 0, 0);
  return o;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

// Dos ojos iguales, que es lo que hace que algo se lea como criatura y no como
// mancha. `w` los separa, `r` es su tamano.
function eyes(d, y, w, r, col = '#ffffff', pupil = '#12061c') {
  for (const s of [-1, 1]) {
    d.fillStyle = col;
    d.beginPath(); d.ellipse(s * w, y, r, r * 1.15, 0, 0, 7); d.fill();
    d.fillStyle = pupil;
    d.beginPath(); d.ellipse(s * w, y + r * 0.15, r * 0.42, r * 0.55, 0, 0, 7); d.fill();
  }
}

// ---------- DUDA: un fantasma con la sabana ondeando ----------
// Es el enemigo de la primera ola, el primero que ella ve: tiene que leerse al
// instante y no dar miedo de verdad.
const duda = () => bake(d => {
  halo(d, 26, '#b98cff', 0.34);
  d.fillStyle = '#d9c2ff';
  d.beginPath();
  d.arc(0, -4, 15, Math.PI, 0);                 // cupula de la cabeza
  d.lineTo(15, 8);
  // Las tres ondas del borde de abajo.
  for (let i = 0; i < 3; i++) {
    const x0 = 15 - i * 10, x1 = x0 - 10;
    d.quadraticCurveTo((x0 + x1) / 2, 8 + (i % 2 ? -7 : 9), x1, 8);
  }
  d.lineTo(-15, -4);
  d.closePath(); d.fill();
  // Sombra interior, para que no sea una silueta plana.
  d.fillStyle = 'rgba(120,80,180,0.30)';
  d.beginPath(); d.arc(6, 0, 11, 0, 7); d.fill();
  eyes(d, -6, 5.5, 3.6);
  // Boquita de sorpresa.
  d.fillStyle = '#4a2a6a';
  d.beginPath(); d.ellipse(0, 3, 2.6, 3.4, 0, 0, 7); d.fill();
});

// ---------- OLVIDO: una calavera que se deshace ----------
const olvido = () => bake(d => {
  halo(d, 26, '#7de0d0', 0.3);
  d.fillStyle = '#e8f4f0';
  d.beginPath(); d.arc(0, -5, 14, Math.PI * 0.98, Math.PI * 2.02); d.fill();
  d.fillRect(-14, -5, 28, 9);
  // Mandibula, separada del craneo: la marca de una calavera.
  d.beginPath(); d.moveTo(-9, 5); d.lineTo(9, 5); d.lineTo(6, 13); d.lineTo(-6, 13);
  d.closePath(); d.fill();
  // Cuencas vacias, hundidas.
  d.fillStyle = '#0d2a28';
  for (const s of [-1, 1]) {
    d.beginPath(); d.ellipse(s * 6, -6, 4.4, 5.2, 0, 0, 7); d.fill();
  }
  // Un punto de luz dentro de cada cuenca: sigue estando "vivo".
  d.fillStyle = '#7de0d0';
  for (const s of [-1, 1]) { d.beginPath(); d.arc(s * 6, -5, 1.7, 0, 7); d.fill(); }
  d.fillStyle = '#0d2a28';
  d.fillRect(-1.6, 0, 3.2, 4);                    // nariz
  for (let i = -1; i <= 1; i++) d.fillRect(i * 4 - 0.8, 6, 1.6, 6);   // dientes
});

// ---------- TRISTEZA: una nube oscura llorando ----------
const tristeza = () => bake(d => {
  halo(d, 28, '#5b6cff', 0.32);
  // La nube: tres bultos y una base plana.
  d.fillStyle = '#3a3f6b';
  for (const [x, y, r] of [[-10, -4, 11], [2, -9, 13], [12, -3, 10]]) {
    d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
  }
  d.fillRect(-19, -4, 38, 10);
  // Brillo arriba, sombra abajo.
  d.fillStyle = 'rgba(140,150,220,0.35)';
  d.beginPath(); d.arc(0, -12, 11, Math.PI, 0); d.fill();
  eyes(d, -3, 7, 4, '#cdd4ff', '#161a3a');
  // Lagrimas cayendo.
  d.fillStyle = '#6bd8ff';
  for (const [x, y, h] of [[-8, 9, 7], [7, 12, 9]]) {
    d.beginPath();
    d.moveTo(x, y); d.quadraticCurveTo(x + 3, y + h * 0.6, x, y + h);
    d.quadraticCurveTo(x - 3, y + h * 0.6, x, y);
    d.fill();
  }
});

// ---------- RELAMPAGO: un rayo, con la punta hacia abajo ----------
// La primera version era un zigzag simetrico y a tamano de juego se leia como
// una mancha amarilla. Ahora es un rayo clasico: dos trazos anchos arriba que
// se estrechan en una punta larga abajo, que es hacia donde embiste.
const dasher = () => bake(d => {
  halo(d, 26, '#ffe14d', 0.42);
  const bolt = (sc, col) => {
    d.save(); d.scale(sc, sc);
    d.fillStyle = col;
    d.beginPath();
    d.moveTo(-3, -19);      // arriba
    d.lineTo(11, -19);
    d.lineTo(2, -3);        // el quiebre del medio
    d.lineTo(12, -3);
    d.lineTo(-6, 20);       // la punta, larga y afilada
    d.lineTo(-1, -1);
    d.lineTo(-11, -1);
    d.closePath(); d.fill();
    d.restore();
  };
  bolt(1.15, '#ff9d1f');            // borde naranja
  bolt(1, '#ffe14d');
  bolt(0.6, '#fffce8');             // nucleo blanco
  // Chispas de la estela.
  d.fillStyle = 'rgba(255,225,120,0.8)';
  for (const [x, y, w] of [[-16, -12, 4], [16, -6, 4], [-15, 4, 3], [15, 10, 3]]) {
    d.fillRect(x, y, w, 3);
  }
});

// ---------- TRACKER: un ojo mecanico que te sigue ----------
const tracker = () => bake(d => {
  halo(d, 27, '#ff7b3d', 0.34);
  // Carcasa exterior.
  d.fillStyle = '#43304a';
  d.beginPath(); d.arc(0, 0, 16, 0, 7); d.fill();
  // Anillo de la mira, con sus cuatro muescas.
  d.strokeStyle = '#ff7b3d'; d.lineWidth = 2.5;
  d.beginPath(); d.arc(0, 0, 13, 0, 7); d.stroke();
  d.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    d.beginPath();
    d.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
    d.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    d.stroke();
  }
  // El ojo: iris naranja y pupila negra, mirando al frente.
  d.fillStyle = '#ffb066'; d.beginPath(); d.arc(0, 0, 8, 0, 7); d.fill();
  d.fillStyle = '#2a0f0a'; d.beginPath(); d.arc(0, 0, 4.2, 0, 7); d.fill();
  d.fillStyle = 'rgba(255,255,255,0.9)';
  d.beginPath(); d.arc(-2.6, -2.6, 1.9, 0, 7); d.fill();
});

// ---------- MURO: un bloque que lleva su escudo por delante ----------
// El escudo va ARRIBA porque el juego bloquea justo las balas que caen desde
// arriba: quien lo mire tiene que entender por donde NO puede dañarlo. En la
// primera version flotaba separado y parecia un paraguas; ahora lo lleva
// apoyado sobre los hombros, tocando el cuerpo.
const muro = () => bake(d => {
  halo(d, 29, '#6bf0ff', 0.28);
  // Cuerpo de piedra.
  d.fillStyle = '#4a5568';
  d.fillRect(-15, -4, 30, 22);
  d.fillStyle = '#5d6b80';
  d.fillRect(-15, -4, 30, 6);
  d.strokeStyle = '#333c4d'; d.lineWidth = 1.5;
  d.beginPath();
  d.moveTo(-15, 6); d.lineTo(15, 6);
  d.moveTo(0, 6); d.lineTo(0, 18);
  d.stroke();
  d.strokeStyle = '#2a3140'; d.lineWidth = 2;
  d.strokeRect(-15, -4, 30, 22);
  eyes(d, 11, 6, 3, '#9fe8ff', '#16202c');
  // El escudo: un blason apoyado sobre el bloque, no flotando.
  d.fillStyle = '#3f5d70';
  d.beginPath();
  d.moveTo(-17, -6); d.lineTo(17, -6);
  d.lineTo(17, -14); d.quadraticCurveTo(0, -24, -17, -14);
  d.closePath(); d.fill();
  d.fillStyle = 'rgba(107,240,255,0.35)';
  d.beginPath();
  d.moveTo(-13, -8); d.lineTo(13, -8);
  d.lineTo(13, -13); d.quadraticCurveTo(0, -20, -13, -13);
  d.closePath(); d.fill();
  d.strokeStyle = '#6bf0ff'; d.lineWidth = 2.4;
  d.beginPath();
  d.moveTo(-17, -6); d.lineTo(17, -6);
  d.lineTo(17, -14); d.quadraticCurveTo(0, -24, -17, -14);
  d.closePath(); d.stroke();
});

// ---------- DIVISOR: dos mitades a punto de separarse ----------
const divisor = () => bake(d => {
  halo(d, 27, '#8cff6b', 0.3);
  // Las dos mitades, ya despegadas por el centro.
  for (const s of [-1, 1]) {
    d.fillStyle = s < 0 ? '#7ad95c' : '#5fbf45';
    d.beginPath();
    d.arc(s * 2.5, 0, 14, s < 0 ? Math.PI / 2 : -Math.PI / 2,
          s < 0 ? Math.PI * 1.5 : Math.PI / 2);
    d.closePath(); d.fill();
  }
  // La grieta.
  d.strokeStyle = '#1f3a16'; d.lineWidth = 2;
  d.beginPath(); d.moveTo(0, -14); d.lineTo(0, 14); d.stroke();
  // Un ojo en cada mitad: van a ser dos criaturas.
  for (const s of [-1, 1]) {
    d.fillStyle = '#eaffe0';
    d.beginPath(); d.arc(s * 7, -3, 3.6, 0, 7); d.fill();
    d.fillStyle = '#1f3a16';
    d.beginPath(); d.arc(s * 7, -3, 1.7, 0, 7); d.fill();
  }
});

// ================= JEFES =================
// Van a 84 px en vez de 64: en pantalla se ven claramente mas grandes que la
// tropa, que es lo que hace que dé respeto verlos aparecer.
const BZ = 84;

// ---------- CELOS: una llama con ojos ----------
const celos = () => bake(d => {
  halo(d, 38, '#ff4400', 0.42);
  // Tres capas de fuego, de la mas oscura a la mas clara.
  const flame = (h, w, col) => {
    d.fillStyle = col;
    d.beginPath();
    d.moveTo(0, -h);
    d.bezierCurveTo(w, -h * 0.35, w * 0.75, h * 0.45, 0, h * 0.62);
    d.bezierCurveTo(-w * 0.75, h * 0.45, -w, -h * 0.35, 0, -h);
    d.fill();
  };
  flame(34, 22, '#ff3b00');
  flame(26, 15, '#ff8a1f');
  flame(16, 9, '#ffd84d');
  eyes(d, 2, 7, 4.4, '#fff4d0', '#7a1500');
  // Ceño: dos trazos inclinados. Sin esto la llama no se ve enfadada.
  d.strokeStyle = '#7a1500'; d.lineWidth = 2.6; d.lineCap = 'round';
  for (const s of [-1, 1]) {
    d.beginPath();
    d.moveTo(s * 3, -6); d.lineTo(s * 11, -3);
    d.stroke();
  }
}, BZ);

// ---------- RUTINA: un engranaje-reloj que gira siempre igual ----------
// La primera version metia los ojos dentro del engranaje y parecian tornillos,
// y el reloj no se veia. Ahora la esfera es blanca y grande (el reloj manda),
// y los ojos van EN la esfera, donde se leen.
const rutina = () => bake(d => {
  halo(d, 38, '#9aa5b5', 0.34);
  // Dientes.
  d.fillStyle = '#7b859a';
  for (let i = 0; i < 10; i++) {
    d.save(); d.rotate(i * Math.PI / 5);
    d.fillRect(-5, -34, 10, 13);
    d.restore();
  }
  d.fillStyle = '#8a94a6'; d.beginPath(); d.arc(0, 0, 25, 0, 7); d.fill();
  d.fillStyle = '#5d6678'; d.beginPath(); d.arc(0, 0, 21, 0, 7); d.fill();
  // La esfera del reloj, clara: es lo que se ve primero.
  d.fillStyle = '#e8edf5'; d.beginPath(); d.arc(0, 0, 17, 0, 7); d.fill();
  // Marcas de las horas.
  d.strokeStyle = '#6e7889'; d.lineWidth = 1.6;
  for (let i = 0; i < 12; i++) {
    const a2 = i * Math.PI / 6;
    const r0 = i % 3 === 0 ? 11.5 : 13.5;
    d.beginPath();
    d.moveTo(Math.cos(a2) * r0, Math.sin(a2) * r0);
    d.lineTo(Math.cos(a2) * 16, Math.sin(a2) * 16);
    d.stroke();
  }
  // Manecillas, bien contrastadas sobre la esfera clara.
  d.strokeStyle = '#2b3240'; d.lineCap = 'round';
  d.lineWidth = 2.8;
  d.beginPath(); d.moveTo(0, 1); d.lineTo(0, -10); d.stroke();
  d.lineWidth = 2.2;
  d.beginPath(); d.moveTo(0, 1); d.lineTo(9, 5); d.stroke();
  d.fillStyle = '#2b3240'; d.beginPath(); d.arc(0, 1, 2.2, 0, 7); d.fill();
  // Los ojos, sobre la esfera y por encima de las manecillas.
  eyes(d, -7, 7, 3.4, '#ffffff', '#2b3240');
}, BZ);

// ---------- INSEGURIDAD: un torbellino ----------
const inseguridad = () => bake(d => {
  halo(d, 40, '#b06bff', 0.4);
  // Espiral: se dibuja como una polilinea que se cierra hacia dentro.
  d.strokeStyle = '#b06bff'; d.lineWidth = 5; d.lineCap = 'round';
  d.beginPath();
  for (let i = 0; i <= 90; i++) {
    const t = i / 90, a = t * Math.PI * 5, r = 34 * (1 - t * 0.88);
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.72 - t * 4;
    i ? d.lineTo(x, y) : d.moveTo(x, y);
  }
  d.stroke();
  d.strokeStyle = 'rgba(226,196,255,0.85)'; d.lineWidth = 2;
  d.beginPath();
  for (let i = 0; i <= 90; i++) {
    const t = i / 90, a = t * Math.PI * 5 + 0.5, r = 30 * (1 - t * 0.88);
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.72 - t * 4;
    i ? d.lineTo(x, y) : d.moveTo(x, y);
  }
  d.stroke();
  eyes(d, 0, 7, 4, '#ffffff', '#3b0a5c');
}, BZ);

// ---------- MIEDO: un corazon roto ----------
const miedo = () => bake(d => {
  halo(d, 38, '#ff2d5e', 0.4);
  // Las dos mitades del corazon, separadas por la grieta.
  const half = (s, col) => {
    d.save(); d.scale(s, 1);
    d.fillStyle = col;
    d.beginPath();
    d.moveTo(1, 26);
    d.bezierCurveTo(-26, 6, -20, -18, -8, -18);
    d.bezierCurveTo(-2, -18, 1, -12, 1, -9);
    d.lineTo(1, 26);
    d.fill();
    d.restore();
  };
  half(1, '#e01a48');
  half(-1, '#ff3d68');
  // La grieta en zigzag.
  d.strokeStyle = '#4a0316'; d.lineWidth = 3; d.lineJoin = 'round';
  d.beginPath();
  d.moveTo(0, -13); d.lineTo(-5, -4); d.lineTo(4, 3); d.lineTo(-3, 12); d.lineTo(1, 26);
  d.stroke();
  eyes(d, -4, 9, 3.8, '#ffd9e2', '#4a0316');
}, BZ);

// ---------- MENTIRA: un ojo que se esconde ----------
const mentira = () => bake(d => {
  halo(d, 38, '#6bf0ff', 0.36);
  // Parpados: la forma de almendra de un ojo.
  d.fillStyle = '#123040';
  d.beginPath();
  d.moveTo(-32, 0);
  d.quadraticCurveTo(0, -26, 32, 0);
  d.quadraticCurveTo(0, 26, -32, 0);
  d.fill();
  d.strokeStyle = '#6bf0ff'; d.lineWidth = 2.5;
  d.beginPath();
  d.moveTo(-32, 0); d.quadraticCurveTo(0, -26, 32, 0);
  d.quadraticCurveTo(0, 26, -32, 0);
  d.stroke();
  // Iris y pupila.
  d.fillStyle = '#2ec4e6'; d.beginPath(); d.arc(0, 0, 13, 0, 7); d.fill();
  d.fillStyle = '#04141c'; d.beginPath(); d.arc(0, 0, 7, 0, 7); d.fill();
  d.fillStyle = 'rgba(255,255,255,0.9)';
  d.beginPath(); d.arc(-4, -4, 3, 0, 7); d.fill();
  // Pestanas.
  d.strokeStyle = '#6bf0ff'; d.lineWidth = 2; d.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const x = i * 11;
    d.beginPath(); d.moveTo(x, -12); d.lineTo(x * 1.15, -20); d.stroke();
  }
}, BZ);

// ---------- SILENCIO: una figura encapuchada callando ----------
// La primera version era un ovalo negro con una pastilla encima: no habia
// figura. Ahora se ven los hombros y un brazo que sube hasta la boca, que es
// lo que hace legible el gesto de "shhh".
const silencio = () => bake(d => {
  halo(d, 40, '#7a68b8', 0.42);
  // Manto: hombros anchos y capucha en punta.
  d.fillStyle = '#332a4d';
  d.beginPath();
  d.moveTo(0, -34);
  d.quadraticCurveTo(14, -32, 17, -14);     // lado derecho de la capucha
  d.quadraticCurveTo(30, -8, 30, 32);       // hombro y manto
  d.lineTo(-30, 32);
  d.quadraticCurveTo(-30, -8, -17, -14);
  d.quadraticCurveTo(-14, -32, 0, -34);
  d.fill();
  // Borde iluminado del manto.
  d.strokeStyle = 'rgba(180,160,240,0.55)'; d.lineWidth = 2;
  d.beginPath();
  d.moveTo(0, -34);
  d.quadraticCurveTo(-14, -32, -17, -14);
  d.quadraticCurveTo(-30, -8, -30, 32);
  d.stroke();
  // El hueco oscuro de la capucha.
  d.fillStyle = '#0e0a1a';
  d.beginPath(); d.ellipse(0, -12, 13, 16, 0, 0, 7); d.fill();
  // Dos luces por ojos.
  d.fillStyle = '#c9b6ff';
  for (const sx of [-1, 1]) {
    d.beginPath(); d.ellipse(sx * 5.5, -14, 2.8, 4.2, 0, 0, 7); d.fill();
  }
  // El brazo que sube hasta la boca: manga y mano.
  d.fillStyle = '#453a63';
  d.beginPath();
  d.moveTo(-20, 30); d.quadraticCurveTo(-10, 16, -2, 4);
  d.lineTo(7, 10); d.quadraticCurveTo(-2, 24, -8, 32);
  d.closePath(); d.fill();
  d.fillStyle = '#d8c8ff';
  d.beginPath(); d.ellipse(0, 2, 6.5, 7.5, -0.35, 0, 7); d.fill();
  // El dedo, cruzando por delante del hueco de la capucha.
  d.strokeStyle = '#e6dcff'; d.lineWidth = 4.5; d.lineCap = 'round';
  d.beginPath(); d.moveTo(1, 2); d.lineTo(-1, -9); d.stroke();
}, BZ);

// ---------- VICIO: una serpiente enroscada ----------
const vicio = () => bake(d => {
  halo(d, 38, '#8cff6b', 0.36);
  // El cuerpo: una S gruesa que se afila hacia la cola.
  d.strokeStyle = '#4fa83a'; d.lineWidth = 13; d.lineCap = 'round';
  d.beginPath();
  d.moveTo(-22, 26);
  d.bezierCurveTo(18, 20, -20, 2, 14, -8);
  d.stroke();
  d.strokeStyle = '#6fd455'; d.lineWidth = 9;
  d.beginPath();
  d.moveTo(-22, 26);
  d.bezierCurveTo(18, 20, -20, 2, 14, -8);
  d.stroke();
  // La cabeza.
  d.fillStyle = '#7ee85f';
  d.beginPath(); d.ellipse(12, -16, 14, 11, -0.3, 0, 7); d.fill();
  // Ojos de reptil: pupila vertical.
  for (const s of [-1, 1]) {
    d.fillStyle = '#ffe14d';
    d.beginPath(); d.arc(8 + s * 5, -21 + s * 2, 3.6, 0, 7); d.fill();
    d.fillStyle = '#12300a';
    d.beginPath(); d.ellipse(8 + s * 5, -21 + s * 2, 1.2, 3, 0, 0, 7); d.fill();
  }
  // Lengua bifida.
  d.strokeStyle = '#ff3d68'; d.lineWidth = 2; d.lineCap = 'round';
  d.beginPath(); d.moveTo(24, -13); d.lineTo(32, -11); d.stroke();
  d.beginPath(); d.moveTo(32, -11); d.lineTo(37, -14); d.moveTo(32, -11); d.lineTo(37, -8);
  d.stroke();
}, BZ);

// ---------- TIEMPO: un reloj de arena ----------
const tiempo = () => bake(d => {
  halo(d, 38, '#ffd84d', 0.38);
  // Marco de madera.
  d.fillStyle = '#c9903a';
  d.fillRect(-24, -32, 48, 6);
  d.fillRect(-24, 26, 48, 6);
  // El cristal: dos conos que se tocan por el centro.
  d.fillStyle = 'rgba(200,230,255,0.18)';
  d.beginPath();
  d.moveTo(-19, -26); d.lineTo(19, -26); d.lineTo(2, 0); d.lineTo(19, 26);
  d.lineTo(-19, 26); d.lineTo(-2, 0);
  d.closePath(); d.fill();
  d.strokeStyle = '#e8f0ff'; d.lineWidth = 2; d.stroke();
  // La arena: casi toda abajo, poca arriba. El tiempo ya casi se acaba.
  d.fillStyle = '#ffd84d';
  d.beginPath();
  d.moveTo(-11, -16); d.lineTo(11, -16); d.lineTo(1, 0); d.lineTo(-1, 0);
  d.closePath(); d.fill();
  d.beginPath();
  d.moveTo(-17, 24); d.lineTo(17, 24); d.lineTo(3, 6); d.lineTo(-3, 6);
  d.closePath(); d.fill();
  // El hilo de arena cayendo.
  d.fillRect(-1, 0, 2, 8);
  eyes(d, 14, 7, 3.2, '#fff6d0', '#7a5510');
}, BZ);

// ---------- ABANDONO: alguien que se va, ya medio borrado ----------
// La primera version era una silueta gris plana sin lectura. Ahora se le ven
// las piernas caminando y el cuerpo se deshace de abajo hacia arriba: se esta
// yendo y desapareciendo a la vez.
const abandono = () => bake(d => {
  halo(d, 38, '#9a86d8', 0.38);
  const cuerpo = '#2f2740';
  // Piernas a media zancada: sin esto no se lee que camina.
  d.strokeStyle = cuerpo; d.lineWidth = 7; d.lineCap = 'round';
  d.beginPath(); d.moveTo(-4, 12); d.lineTo(-13, 32); d.stroke();
  d.beginPath(); d.moveTo(4, 12); d.lineTo(11, 30); d.stroke();
  // Torso, de espaldas.
  d.fillStyle = cuerpo;
  d.beginPath();
  d.moveTo(-13, 16);
  d.quadraticCurveTo(-16, -8, 0, -10);
  d.quadraticCurveTo(16, -8, 13, 16);
  d.closePath(); d.fill();
  // Cabeza.
  d.beginPath(); d.arc(0, -21, 11, 0, 7); d.fill();
  // Un brazo colgando, visible por el lado iluminado.
  d.strokeStyle = cuerpo; d.lineWidth = 5.5;
  d.beginPath(); d.moveTo(-12, -4); d.lineTo(-16, 12); d.stroke();
  // Contraluz por la izquierda: la luz queda detras de ella.
  d.strokeStyle = 'rgba(200,180,255,0.8)'; d.lineWidth = 2.6;
  d.beginPath(); d.arc(0, -21, 11, Math.PI * 0.7, Math.PI * 1.6); d.stroke();
  d.beginPath();
  d.moveTo(-13, 16); d.quadraticCurveTo(-16, -8, 0, -10);
  d.stroke();
  // Se deshace: trozos que se sueltan del contorno.
  d.fillStyle = 'rgba(154,134,216,0.6)';
  for (const [x, y, w, h] of [[-19, 6, 5, 3], [16, 2, 4, 3], [-17, 20, 4, 3],
                              [15, 18, 5, 3], [-8, 34, 5, 3], [7, 36, 4, 3]]) {
    d.fillRect(x, y, w, h);
  }
}, BZ);

// ---------- EGO: un espejo con un reflejo que no eres tu ----------
const ego = () => bake(d => {
  halo(d, 38, '#ff8ad4', 0.36);
  // Marco ovalado.
  d.fillStyle = '#c98ae0';
  d.beginPath(); d.ellipse(0, 0, 25, 32, 0, 0, 7); d.fill();
  // Cristal.
  const gl = d.createLinearGradient(-18, -28, 18, 28);
  gl.addColorStop(0, '#5f3d78'); gl.addColorStop(0.5, '#8a5fa8'); gl.addColorStop(1, '#3d2450');
  d.fillStyle = gl;
  d.beginPath(); d.ellipse(0, 0, 20, 27, 0, 0, 7); d.fill();
  // El reflejo: un corazon como el de Roma, pero al reves y en su color.
  d.save();
  d.translate(0, 2); d.scale(0.55, -0.55);
  d.fillStyle = '#ff8ad4';
  d.beginPath();
  d.moveTo(0, 20);
  d.bezierCurveTo(-24, 2, -18, -18, -7, -18);
  d.bezierCurveTo(-2, -18, 0, -13, 0, -10);
  d.bezierCurveTo(0, -13, 2, -18, 7, -18);
  d.bezierCurveTo(18, -18, 24, 2, 0, 20);
  d.fill();
  d.restore();
  // Destello diagonal sobre el cristal.
  d.fillStyle = 'rgba(255,255,255,0.22)';
  d.beginPath();
  d.moveTo(-14, -20); d.lineTo(-4, -24); d.lineTo(10, 18); d.lineTo(0, 22);
  d.closePath(); d.fill();
}, BZ);

// ---------- ROMA: el corazon que defiende la linea ----------
// Se hornea en varias versiones porque cambia de color con los poderes, y
// recolorear por frame costaria mucho mas que tener cinco laminas.
function romaHeart(col, glow) {
  return bake(d => {
    halo(d, 26, glow, 0.5);
    // Corazon.
    d.fillStyle = col;
    d.beginPath();
    d.moveTo(0, 17);
    d.bezierCurveTo(-21, 2, -16, -15, -6, -15);
    d.bezierCurveTo(-2, -15, 0, -11, 0, -8);
    d.bezierCurveTo(0, -11, 2, -15, 6, -15);
    d.bezierCurveTo(16, -15, 21, 2, 0, 17);
    d.fill();
    // Brillo humedo arriba a la izquierda: le da volumen.
    d.fillStyle = 'rgba(255,255,255,0.45)';
    d.beginPath(); d.ellipse(-6, -7, 4.5, 3.2, -0.5, 0, 7); d.fill();
    // Contorno claro.
    d.strokeStyle = 'rgba(255,255,255,0.55)'; d.lineWidth = 1.4;
    d.beginPath();
    d.moveTo(0, 17);
    d.bezierCurveTo(-21, 2, -16, -15, -6, -15);
    d.bezierCurveTo(-2, -15, 0, -11, 0, -8);
    d.bezierCurveTo(0, -11, 2, -15, 6, -15);
    d.bezierCurveTo(16, -15, 21, 2, 0, 17);
    d.stroke();
  }, 56);
}

// ---------- Cache ----------
// Los sprites se hornean la PRIMERA vez que se piden y se guardan. Asi entrar
// y salir del juego no vuelve a dibujarlos.
// La tropa de los biomas vive en surv-art2.js: treinta criaturas en un solo
// archivo no se pueden leer.
const BUILDERS = {
  duda, olvido, tristeza, dasher, tracker, muro, divisor,
  celos, rutina, inseguridad, miedo, mentira, silencio, vicio, tiempo, abandono, ego,
  ...builders2(bake, halo),        // la tropa de los biomas, con el mismo horno
};

const cache = new Map();

export function sprite(id) {
  let s = cache.get(id);
  if (!s) {
    const b = BUILDERS[id];
    s = b ? b() : duda();          // un tipo desconocido sale como duda, nunca vacio
    cache.set(id, s);
  }
  return s;
}

// Las cinco caras de Roma: normal y una por cada poder activo.
const ROMA_COLORS = {
  normal: ['#ff3ec9', '#ff3ec9'],
  mega:   ['#ffe66d', '#ffd84d'],
  turbo:  ['#b06bff', '#b06bff'],
  shield: ['#6bf0ff', '#6bf0ff'],
  double: ['#ff9ee0', '#ff3ec9'],
};

export function roma(mode) {
  const key = 'roma_' + mode;
  let s = cache.get(key);
  if (!s) {
    const [c, g] = ROMA_COLORS[mode] || ROMA_COLORS.normal;
    s = romaHeart(c, g);
    cache.set(key, s);
  }
  return s;
}

// Cuanto hay que multiplicar el tamano de dibujado para que el CUERPO siga
// midiendo lo mismo en pantalla ahora que la lamina lleva margen.
//
// NO es una constante: hay tres tamanos de figura (64 las criaturas, 84 los
// jefes, 56 Roma) y el margen es el mismo para las tres, asi que el factor sale
// distinto en cada una (1.500, 1.381, 1.571). Con una sola constante los jefes
// saldrian un 9% mas grandes de lo que miden hoy. Por eso se pregunta por el
// sprite ya horneado, que es quien sabe su lamina.
export function factor(s) {
  return s.width / (s.width - MARGEN * 2);
}

export { SZ, BZ, MARGEN };
