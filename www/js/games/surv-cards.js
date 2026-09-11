// SURVIVAL — la pantalla de recompensa: tres cartas, se toca una.
//
// Aparece tras matar a cada jefe. El juego se queda quieto detras (no hay
// cuenta atras a proposito: que ella lea las tres con calma), y las cartas
// entran volando escalonadas para que se note que es un premio.
//
// El marco de cada carta lo dicta su RAREZA: cuanto mejor, mas adornado. Es lo
// unico que las distingue de un vistazo, asi que se dibuja con cuidado.

import { text, textCenter, measure } from '../font.js';

// La carta y su sitio. Tres caben en 600 px de ancho con aire de sobra.
export const CARD_W = 150, CARD_H = 150;
const GAP = 24;
export const CARD_Y = 84;

// Donde cae la carta i (0,1,2) ya colocada.
export function cardX(i, vw) {
  const total = 3 * CARD_W + 2 * GAP;
  return (vw - total) / 2 + i * (CARD_W + GAP);
}

// Que carta cae bajo un toque, o -1. El area es la de la carta mas un margen:
// un pulgar no apunta fino y fallar el toque en la pantalla de premio seria
// especialmente molesto.
export function cardAt(x, y, vw) {
  for (let i = 0; i < 3; i++) {
    const cx = cardX(i, vw);
    if (x >= cx - 6 && x <= cx + CARD_W + 6 &&
        y >= CARD_Y - 6 && y <= CARD_Y + CARD_H + 6) return i;
  }
  return -1;
}

// Parte un nombre largo en dos lineas por el hueco que deja las dos mitades
// mas parejas. Encogerlo a escala 1 era peor: al lado de un IMAN a escala 2,
// un COMBO ARDIENTE pequeño se leia como texto secundario y no como el titulo
// de la carta. Comprobado que las nueve habilidades caben partidas asi.
const nameCache = new Map();
function nameLines(str, maxW) {
  if (nameCache.has(str)) return nameCache.get(str);
  let out = [str];
  if (measure(str, 2) > maxW) {
    const w = str.split(' ');
    let best = null, bd = 1e9;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
      const d = Math.abs(measure(a, 2) - measure(b, 2));
      if (d < bd) { bd = d; best = [a, b]; }
    }
    if (best && best.every(l => measure(l, 2) <= maxW)) out = best;
  }
  nameCache.set(str, out);
  return out;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// ---------- El marco, segun rareza ----------
// Cada estilo suma algo al anterior en vez de ser un dibujo distinto: asi se
// leen como una escala y no como cuatro cosas sueltas.
function frame(g, x, y, w, h, rar, t, sel) {
  const c = rar.color;
  const style = rar.frame;

  // Fondo: casi negro, tenido del color de la rareza.
  g.fillStyle = 'rgba(8,4,20,0.92)';
  g.fillRect(x, y, w, h);
  const bg = g.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, rgba(c, style === 'gruesa' ? 0.22 : 0.13));
  bg.addColorStop(1, rgba(c, 0.02));
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);

  // Las buenas respiran: un halo que late FUERA de la carta. Se dibuja como
  // anillos de borde y no como un rectangulo lleno: relleno teñia el interior
  // de amarillo o violeta y las cartas buenas perdian el fondo oscuro.
  if (style === 'esquinas' || style === 'gruesa') {
    const pulse = 0.5 + Math.sin(t * 3) * 0.5;
    const rings = style === 'gruesa' ? 7 : 4;
    const peak = style === 'gruesa' ? 0.20 : 0.13;
    for (let i = 1; i <= rings; i++) {
      // La caida va al cuadrado: lineal dejaba los anillos casi igual de
      // opacos y el halo se leia como un recuadro solido, no como un brillo.
      const f = 1 - i / (rings + 1);
      g.strokeStyle = rgba(c, peak * pulse * f * f);
      g.lineWidth = 1;
      g.strokeRect(x - i * 2, y - i * 2, w + i * 4, h + i * 4);
    }
  }

  // Linea principal. La seleccionada se pone blanca.
  g.strokeStyle = sel ? '#ffffff' : c;
  g.lineWidth = style === 'gruesa' ? 3 : style === 'esquinas' ? 2 : style === 'doble' ? 2 : 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // RARA en adelante: segunda linea por dentro.
  if (style === 'doble' || style === 'esquinas' || style === 'gruesa') {
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    g.globalAlpha = 1;
  }

  // EPICA en adelante: cantoneras que sobresalen.
  if (style === 'esquinas' || style === 'gruesa') {
    const L = 14, o = 2;          // `o` las mete hacia dentro: pegadas al borde
    g.lineWidth = style === 'gruesa' ? 3 : 2;                 // pisaban la cinta
    g.beginPath();
    for (const [cx, cy, dx, dy] of [
      [x + o, y + o, 1, 1], [x + w - o, y + o, -1, 1],
      [x + o, y + h - o, 1, -1], [x + w - o, y + h - o, -1, -1],
    ]) {
      g.moveTo(cx + dx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * L);
    }
    g.stroke();
  }

  // LEGENDARIA: chispas girando alrededor. Es la unica que se mueve sola, y por
  // eso se reconoce sin leer la palabra.
  if (style === 'gruesa') {
    for (let i = 0; i < 6; i++) {
      const a = t * 1.3 + i * (Math.PI / 3);
      const px = x + w / 2 + Math.cos(a) * (w / 2 + 9);
      const py = y + h / 2 + Math.sin(a) * (h / 2 + 9);
      g.fillStyle = rgba(c, 0.5 + Math.sin(t * 5 + i) * 0.3);
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
  }
}

// ---------- Una carta ----------
// `card` = {skill, level, rarity}. `anim` de 0 a 1 es su entrada.
function drawCard(g, card, x, y, t, anim, sel) {
  const rar = card.rarity, s = card.skill;

  g.save();
  // Entra deslizandose desde abajo y creciendo. Al elegirla, da un saltito.
  const ease = 1 - Math.pow(1 - anim, 3);
  const dy = (1 - ease) * 34;
  const k = sel ? 1 + Math.sin(Math.min(1, sel) * Math.PI) * 0.07 : 1;
  g.globalAlpha = ease;
  g.translate(x + CARD_W / 2, y + CARD_H / 2 + dy);
  g.scale(k, k);
  g.translate(-CARD_W / 2, -CARD_H / 2);

  frame(g, 0, 0, CARD_W, CARD_H, rar, t, sel);

  // Cinta de rareza arriba. Va bien saturada y con su linea de cierre: al 20%
  // la COMUN quedaba gris sobre gris y parecia un encabezado inerte.
  g.fillStyle = rgba(rar.color, 0.32);
  g.fillRect(1, 1, CARD_W - 2, 15);
  g.fillStyle = rgba(rar.color, 0.75);
  g.fillRect(1, 16, CARD_W - 2, 1);
  textCenter(g, rar.name, CARD_W / 2, 5, '#ffffff', 1);

  // Nombre, siempre a escala 2: partido en dos lineas si no cabe de una.
  const nl = nameLines(s.name, CARD_W - 14);
  let y2 = 28;
  for (const line of nl) {
    textCenter(g, line, CARD_W / 2, y2, '#ffffff', 2);
    y2 += 18;
  }

  // Nivel: solo si es una subida. En la primera no se enseña, que distraeria.
  y2 += 4;
  if (card.level > 1) {
    const txt = 'NIV ' + card.level;
    const w = measure(txt, 1);
    g.fillStyle = rgba(rar.color, 0.9);
    g.fillRect(CARD_W / 2 - w / 2 - 4, y2, w + 8, 11);
    textCenter(g, txt, CARD_W / 2, y2 + 2, '#0d0620', 1);
    y2 += 17;
  }

  // Separador: cierra el bloque del titulo y llena el hueco que quedaba entre
  // el nombre y la descripcion.
  g.fillStyle = rgba(rar.color, 0.30);
  g.fillRect(CARD_W / 2 - 26, y2 + 3, 52, 1);
  y2 += 12;

  // Que hace, en dos lineas.
  for (const line of s.desc(card.level)) {
    textCenter(g, line, CARD_W / 2, y2, '#c9b8e8', 1);
    y2 += 12;
  }

  // Pastillas de nivel abajo: cuantos tiene y cuantos le quedan. Es lo que
  // enseña que esto se puede seguir mejorando.
  if (s.max > 1) {
    const n = s.max, pw = 14, gap = 4;
    const tot = n * pw + (n - 1) * gap;
    let px = CARD_W / 2 - tot / 2;
    for (let i = 0; i < n; i++) {
      const on = i < card.level;
      g.fillStyle = on ? rar.color : 'rgba(255,255,255,0.13)';
      g.fillRect(px, CARD_H - 18, pw, 4);
      px += pw + gap;
    }
  } else {
    // Las de un solo nivel (la LEGENDARIA) no tienen pastillas que enseñar: en
    // su hueco va lo que de verdad las define, que no se pueden mejorar mas.
    textCenter(g, 'UNICA', CARD_W / 2, CARD_H - 22, rgba(rar.color, 0.75), 1);
  }
  g.restore();
}

// ---------- La pantalla entera ----------
// `st` es el estado que lleva el juego: {cards, anim, sel, selT, title}.
export function drawPicker(g, st, vw, vh, t) {
  // Oscurecer lo que hay detras, sin taparlo del todo: que se vea que el juego
  // sigue ahi esperando.
  g.fillStyle = 'rgba(6,3,16,0.82)';
  g.fillRect(0, 0, vw, vh);

  const head = Math.min(1, st.anim * 2);
  g.globalAlpha = head;
  textCenter(g, st.title, vw / 2, 30, '#ffe14d', 1);
  textCenter(g, 'ELIGE TU RECOMPENSA', vw / 2, 48, '#ff3ec9', 2);
  g.globalAlpha = 1;

  for (let i = 0; i < st.cards.length; i++) {
    // Escalonadas: cada una entra 0.12 s despues de la anterior.
    const a = Math.max(0, Math.min(1, (st.anim - i * 0.12) / 0.3));
    if (a <= 0) continue;
    const sel = st.sel === i ? st.selT : 0;
    drawCard(g, st.cards[i], cardX(i, vw), CARD_Y, t, a, sel);
  }
}
