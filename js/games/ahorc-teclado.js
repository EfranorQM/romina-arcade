// AHORCADO - el teclado en pantalla y los botones.
//
// Es donde pasa el 90% de la partida, asi que su geometria no es de gusto:
//
//   4 filas alfabeticas 7-7-7-6 con la Ñ tras la N: A-G / H-N / Ñ-T / U-Z.
//   Alfabetico y no QWERTY porque aqui no se escribe, se busca "que me falta",
//   y eso se busca en orden.
//
//   Tecla de 66x70 px virtuales. El lienzo es 540x1200 sobre una pantalla de
//   1080x2400, o sea 2 px fisicos por virtual: 132x140 fisicos = 8.2 x 8.7 mm
//   en el Note 10 (409 ppi). Material pide 48dp = 7.5 mm; queda por encima.
//   Separacion 6 horizontal y 8 vertical; una fila de 7 mide 7*66+6*6 = 498,
//   asi que el margen lateral es 21 px (42 fisicos, fuera de la franja del
//   gesto de volver de MIUI). Filas en y = 850 + f*78; la ultima termina en
//   1154 y deja 46 px (92 fisicos) para la barra de gestos.
//
//   El area de toque de cada tecla es su celda MAS la mitad de los huecos:
//   72x78, sin zonas muertas. Un pulgar que cae entre dos teclas siempre elige
//   una.
//
// LA LETRA SE COMPROMETE AL SOLTAR, no al apoyar. En el 'down' la tecla se
// hunde, suena y el muneco la mira con esperanza; la letra solo cuenta si el
// dedo se levanta dentro de la misma celda. Deslizar fuera cancela, como un
// boton de Android. En un juego de pensar un mal toque no puede costar un
// globo, y asi ella puede arrepentirse.
//
// El teclado entero se HORNEA en un canvas y se blitea de una vez; solo se
// vuelve a hornear cuando cambia el estado de una tecla. Las teclas con
// animacion (hundida, temblando, recien acertada) se pintan encima de su celda
// ese frame. Sin el horneado eran 27 rectangulos redondeados con borde y letra
// cada frame, y 27 letras por 3 colores son 81 cadenas en la cache de font.js
// (tope 160), que con el HUD la harian rotar.

import { text, measure } from '../font.js';

export const FILAS = ['ABCDEFG', 'HIJKLMN', 'ÑOPQRST', 'UVWXYZ'];
export const KX0 = 21, KY0 = 850, KW = 66, KH = 70, KSX = 72, KSY = 78;
export const PANEL_Y = 716;        // desde aqui el fondo es opaco (#0d0620)
export const ZONA_TECLADO_Y = 846; // de aqui para abajo el toque es del teclado
const TINTA = '#1a1030', PANEL = '#0d0620';
const LETRA_ESC = 5;               // 25x35 px: 3.1 x 4.4 mm en el telefono

export const LIBRE = 0, ACERTADA = 1, FALLADA = 2;

// Colores de los globos, para el puntito de la tecla que costo uno.
export const COLORES_GLOBO = ['#ff5c9d', '#5cffd8', '#ffe14d', '#b48cff', '#ff9b4d', '#8aff6a'];

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
export { rrect };

export function posTecla(letra) {
  for (let f = 0; f < FILAS.length; f++) {
    const c = FILAS[f].indexOf(letra);
    if (c >= 0) return { x: KX0 + c * KSX, y: KY0 + f * KSY, f, c };
  }
  if (letra === 'BORRAR') return { x: KX0 + 6 * KSX, y: KY0 + 3 * KSY, f: 3, c: 6 };
  return null;
}

export class Teclado {
  constructor() {
    this.modo = 'oculto';           // 'oculto' | 'adivinar' | 'escribir'
    this.estado = {};               // letra -> LIBRE/ACERTADA/FALLADA
    this.globo = {};                // letra -> indice de color del globo que costo
    this.anim = {};                 // letra -> { press, shake, pop }
    this.dedos = new Map();         // pointerId -> letra apoyada
    this.bake = null; this.dirty = true;
    this.entrada = -1;              // segundos desde que empezo a subir; -1 = quieto
    this.t = 0;
    this.reset();
  }

  reset() {
    for (const f of FILAS) for (const L of f) { this.estado[L] = LIBRE; this.anim[L] = { press: 0, shake: 0, pop: 0 }; }
    this.anim.BORRAR = { press: 0, shake: 0, pop: 0 };
    this.dedos.clear();
    this.dirty = true;
  }

  mostrar(modo) {
    if (this.modo === 'oculto' && modo !== 'oculto') this.entrada = 0;
    this.modo = modo; this.dirty = true;
  }
  ocultar() { this.modo = 'oculto'; this.dedos.clear(); }

  marcar(letra, st, globoIdx) {
    this.estado[letra] = st;
    if (globoIdx !== undefined) this.globo[letra] = globoIdx;
    if (st === ACERTADA) this.anim[letra].pop = 0.16;
    this.dirty = true;
  }
  temblar(letra) { this.anim[letra].shake = 0.25; }

  // Que tecla cae bajo (x,y), o null. La celda incluye la mitad de los huecos.
  hit(x, y) {
    if (this.modo === 'oculto') return null;
    if (y < KY0 - 4 || x < KX0 - 3) return null;
    const c = Math.floor((x - KX0 + 3) / KSX), f = Math.floor((y - KY0 + 4) / KSY);
    if (f < 0 || f >= FILAS.length || c < 0 || c >= 7) return null;
    if (c < FILAS[f].length) return FILAS[f][c];
    if (f === 3 && c === 6 && this.modo === 'escribir') return 'BORRAR';
    return null;
  }

  // 'down': hunde la tecla y se la queda ese dedo. Devuelve la letra o null.
  down(ev) {
    const L = this.hit(ev.x, ev.y);
    if (!L) return null;
    this.dedos.set(ev.id, L);
    this.anim[L].press = 0.08;
    return L;
  }
  // 'up': devuelve { letra, ok } con ok=true si solto dentro de la misma celda.
  up(ev) {
    const L = this.dedos.get(ev.id);
    if (!L) return null;
    this.dedos.delete(ev.id);
    return { letra: L, ok: this.hit(ev.x, ev.y) === L };
  }
  // Un dedo que se sale de la celda ya no la tiene hundida (se ve que cancelo).
  move(ev) {
    const L = this.dedos.get(ev.id);
    if (!L) return;
    if (this.hit(ev.x, ev.y) !== L) this.anim[L].press = 0;
  }
  soltarTodo() { this.dedos.clear(); }
  apoyada(L) { for (const v of this.dedos.values()) if (v === L) return true; return false; }

  update(dt) {
    this.t += dt;
    if (this.entrada >= 0) { this.entrada += dt; if (this.entrada > 0.55 + 0.33) this.entrada = -1; }
    for (const L in this.anim) {
      const a = this.anim[L];
      if (a.press > 0 && !this.apoyada(L)) a.press -= dt;
      if (a.shake > 0) a.shake -= dt;
      if (a.pop > 0) a.pop -= dt;
    }
  }

  // ---------- Dibujo ----------
  _tecla(g, L, x, y, esc, alpha) {
    const st = this.estado[L] || LIBRE;
    g.save();
    g.globalAlpha = alpha;
    if (esc !== 1) { g.translate(x + KW / 2, y + KH / 2); g.scale(esc, esc); g.translate(-x - KW / 2, -y - KH / 2); }
    rrect(g, x, y, KW, KH, 12);
    if (L === 'BORRAR') {
      g.fillStyle = 'rgba(255,92,157,0.14)'; g.fill();
      g.strokeStyle = 'rgba(255,92,157,0.5)'; g.lineWidth = 2; g.stroke();
      // Icono de borrar: una flecha-etiqueta hacia la izquierda con una x.
      const cx = x + KW / 2, cy = y + KH / 2;
      g.beginPath(); g.moveTo(cx - 20, cy); g.lineTo(cx - 8, cy - 12); g.lineTo(cx + 18, cy - 12);
      g.lineTo(cx + 18, cy + 12); g.lineTo(cx - 8, cy + 12); g.closePath();
      g.strokeStyle = '#ff5c9d'; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
      g.beginPath(); g.moveTo(cx - 1, cy - 5); g.lineTo(cx + 9, cy + 5); g.moveTo(cx + 9, cy - 5); g.lineTo(cx - 1, cy + 5); g.stroke();
    } else if (st === ACERTADA) {
      g.fillStyle = '#5cffd8'; g.fill();
      text(g, L, x + 21, y + 18, TINTA, LETRA_ESC);
    } else if (st === FALLADA) {
      g.strokeStyle = 'rgba(255,92,157,0.40)'; g.lineWidth = 2; g.stroke();
      g.globalAlpha = alpha * 0.45;
      text(g, L, x + 21, y + 21, '#ff5c9d', LETRA_ESC);
      g.globalAlpha = alpha;
      // La tecla lleva puesto el globo que costo.
      const gi = this.globo[L];
      if (gi !== undefined) {
        g.fillStyle = COLORES_GLOBO[gi]; g.beginPath(); g.arc(x + KW - 10, y + 10, 4, 0, 7); g.fill();
      }
    } else {
      g.fillStyle = 'rgba(255,255,255,0.09)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
      text(g, L, x + 21, y + 18, '#ffffff', LETRA_ESC);
    }
    g.restore();
  }

  _hornear() {
    if (!this.bake) { this.bake = document.createElement('canvas'); this.bake.width = 540; this.bake.height = 1200 - PANEL_Y; }
    const c = this.bake.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, -PANEL_Y);
    c.clearRect(0, PANEL_Y, 540, 1200 - PANEL_Y);
    for (let f = 0; f < FILAS.length; f++) for (let ci = 0; ci < FILAS[f].length; ci++) {
      this._tecla(c, FILAS[f][ci], KX0 + ci * KSX, KY0 + f * KSY, 1, 1);
    }
    if (this.modo === 'escribir') this._tecla(c, 'BORRAR', KX0 + 6 * KSX, KY0 + 3 * KSY, 1, 1);
    this.dirty = false;
  }

  draw(g) {
    if (this.modo === 'oculto') return;
    const letras = [];
    for (let f = 0; f < FILAS.length; f++) for (const L of FILAS[f]) letras.push(L);
    if (this.modo === 'escribir') letras.push('BORRAR');
    // Entrada: cada tecla sube 40 px con alfa 0->1 en 220 ms, con 12 ms de
    // escalon: las 27 tardan 0.55 s en estar puestas.
    if (this.entrada >= 0) {
      for (let k = 0; k < letras.length; k++) {
        const L = letras[k], p = posTecla(L);
        const u = Math.max(0, Math.min(1, (this.entrada - k * 0.012) / 0.22));
        const e = 1 - (1 - u) * (1 - u);
        this._tecla(g, L, p.x, p.y + 40 * (1 - e), 1, e);
      }
      return;
    }
    if (this.dirty) this._hornear();
    g.drawImage(this.bake, 0, PANEL_Y);
    // Encima, solo las que estan haciendo algo.
    for (const L of letras) {
      const a = this.anim[L];
      if (a.press <= 0 && a.shake <= 0 && a.pop <= 0) continue;
      const p = posTecla(L);
      // Se tapa la tecla horneada con el panel y se pinta la animada.
      g.fillStyle = PANEL; g.fillRect(p.x - 4, p.y - 5, KW + 8, KH + 10);
      let esc = 1, dx = 0;
      if (a.press > 0) esc = 0.92;
      if (a.pop > 0) { const u = 1 - a.pop / 0.16; esc = 1 + Math.sin(u * Math.PI) * 0.12; }
      if (a.shake > 0) dx = Math.sin((0.25 - a.shake) / 0.25 * Math.PI * 6) * 3;
      this._tecla(g, L, p.x + dx, p.y, esc, 1);
    }
  }
}

// ---------- Botones grandes (SOLA / A DOS, tejuelas de pista, ESPACIO, LISTO...) ----------
// Compromiso al soltar dentro, igual que las teclas. `on` = false lo apaga
// (LISTO con menos de tres letras).
export class Botones {
  constructor() { this.lista = []; this.dedos = new Map(); this.t = 0; }
  poner(lista) { this.lista = lista; this.dedos.clear(); for (const b of lista) { b.on = b.on !== false; b.press = 0; } }
  vaciar() { this.lista = []; this.dedos.clear(); }
  hit(x, y) {
    for (const b of this.lista) if (b.on && x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) return b;
    return null;
  }
  down(ev) { const b = this.hit(ev.x, ev.y); if (!b) return null; this.dedos.set(ev.id, b); b.press = 1; return b; }
  up(ev) {
    const b = this.dedos.get(ev.id); if (!b) return null;
    this.dedos.delete(ev.id); b.press = 0;
    return this.hit(ev.x, ev.y) === b ? b : null;
  }
  update(dt) { this.t += dt; }
  draw(g) {
    for (const b of this.lista) {
      g.save();
      const esc = b.press ? 0.94 : 1;
      if (esc !== 1) { g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(esc, esc); g.translate(-b.x - b.w / 2, -b.y - b.h / 2); }
      g.globalAlpha = b.on ? 1 : 0.35;
      rrect(g, b.x, b.y, b.w, b.h, Math.min(20, b.h / 2));
      g.fillStyle = b.fill || 'rgba(255,255,255,0.09)'; g.fill();
      g.strokeStyle = b.col || '#ffffff'; g.lineWidth = 3; g.stroke();
      const esc2 = b.esc || 4;
      const w = measure(b.txt, esc2);
      text(g, b.txt, Math.round(b.x + (b.w - w) / 2), Math.round(b.y + (b.h - 7 * esc2) / 2), b.col || '#ffffff', esc2);
      if (b.sub) {
        const w2 = measure(b.sub, 2);
        text(g, b.sub, Math.round(b.x + (b.w - w2) / 2), Math.round(b.y + b.h - 22), '#8a7ab8', 2);
      }
      g.restore();
    }
  }
}
