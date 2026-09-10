// Menu del arcade: una estanteria de caratulas que se arrastra de lado.
//
// La portada del centro esta de frente y grande; las de los lados se alejan,
// se encogen y se inclinan hacia dentro, como cajas puestas de canto en un
// estante. Debajo de cada una va su reflejo. Se arrastra el dedo y la fila
// corre con inercia hasta encajar sola en la portada mas cercana.
//
// Es la unica escena apaisada junto al fin de partida: su lienzo (VW x VH) es
// 600x270, y al entrar a un juego el telefono gira a vertical.
import { VW, VH, Save, clamp } from './core.js';
import { text, textCenter, measure } from './font.js';
import { SFX, toggleMute } from './audio.js';
import { GAMES } from './games.js';
import { cover, CW, CH } from './covers.js';

// ---------- Geometria de la estanteria ----------
// El escenario tiene 270 de alto y hay que repartirlo sin que nada se corte:
//   0..18    titulo del arcade
//   18..146  las caratulas (la del centro mide 118 y APOYA en el estante)
//   146..212 nombre del juego, su lema y el record
//   212..270 reflejo, puntos de posicion y el rotulo del sonido
const SEL_H = 118;            // alto de la caratula del centro
const SEP = 88;               // separacion entre caratulas contiguas, en px
const SIDE_SQUEEZE = 0.62;    // cuanto se estrecha una caratula por cada paso
const SIDE_SCALE = 0.70;      // cuanto encoge por cada paso que se aleja
const SHELF_Y = 146;          // linea del estante: donde apoyan las caratulas
const MAX_VISIBLE = 3;        // pasos a cada lado que se dibujan

// Fisica del arrastre. Los numeros salen de tools/prueba-menu.mjs, que simula
// este mismo modelo miles de pasos: con ellos el peor encaje tarda 0.92 s y no
// hay rebote en ninguna combinacion de posicion y velocidad.
const K = 90;                 // rigidez del muelle que lleva al destino
const C = 2 * Math.sqrt(K);   // amortiguacion CRITICA: lo mas rapido sin rebote
const GLIDE = 0.16;           // cuanto pesa el impulso al elegir destino
const MAX_SALTOS = 3;         // caratulas que puede cruzar un solo gesto
const FLICK = 0.055;          // px/frame -> velocidad de la fila
const TAP_SLOP = 8;           // px de movimiento que aun cuentan como toque

export const Menu = {
  // wide: el lienzo de esta escena ES el escenario apaisado.
  meta: { id: '_menu', title: 'MENU', wide: true, vw: 600, vh: 270 },

  init() {
    this.t = 0;
    // `pos` es la posicion continua en la fila: 0 = primer juego centrado,
    // 1.5 = a medio camino entre el segundo y el tercero. El encaje la lleva
    // siempre hacia el entero mas cercano.
    this.pos = 0;
    this.vel = 0;
    this.dest = 0;              // caratula a la que se esta yendo
    this.drag = null;
    // Se fija ya: si se dejara sin definir, el primer update tras volver de un
    // juego veria un cambio de seleccion que no ocurrio y sonaria un blip.
    this._lastSel = this.sel;
    this.covers = GAMES.map(G => cover(G.meta));
    // Se hornean al entrar al menu, no al arrancar la app: entrar y salir de un
    // juego no las vuelve a dibujar porque cover() las cachea por id.
  },

  // El juego elegido: el entero mas cercano, traido al rango 0..N-1.
  get sel() { return mod(Math.round(this.pos), GAMES.length); },

  update(dt) {
    this.t += dt;
    if (this.drag) return;                  // con el dedo puesto manda el dedo
    // Muelle criticamente amortiguado hacia la caratula de destino, que se
    // eligio UNA vez al soltar el dedo. Un muelle libre recalculando el objetivo
    // cada paso tardaba casi cuatro segundos en asentarse y, al tocar una
    // caratula lateral, se quedaba una corta.
    const a = (this.dest - this.pos) * K - this.vel * C;
    this.vel += a * dt;
    this.pos += this.vel * dt;
    // Llegado: a menos de medio pixel y casi parado. Perseguir el cero exacto
    // son decimas que nadie ve.
    if (Math.abs(this.vel) < 0.05 && Math.abs(this.pos - this.dest) * SEP < 0.5) {
      this.pos = this.dest; this.vel = 0;
    }
    // La fila es un anillo: `pos` se mantiene cerca de cero restandole vueltas
    // enteras. Sin esto crece sin limite en un arrastre largo y la precision en
    // coma flotante acabaria haciendo saltar la animacion. El destino se corre
    // con ella, o la animacion daria un salto en ese momento.
    const N = GAMES.length;
    if (this.pos < -N || this.pos > N) {
      const k = Math.round(this.pos / N) * N;
      this.pos -= k; this.dest -= k;
    }
    // Aviso sonoro al cruzar de una portada a otra.
    const s = this.sel;
    if (s !== this._lastSel) { if (this._lastSel !== undefined) SFX.blip(); this._lastSel = s; }
  },

  // A que caratula ir al soltar el dedo: la mas cercana, mas lo que empuje el
  // impulso del gesto, con un tope para que un manotazo no de vueltas sin fin.
  destinoTras(vel) {
    const salto = clamp(Math.round(vel * GLIDE), -MAX_SALTOS, MAX_SALTOS);
    return Math.round(this.pos) + salto;
  },

  // Donde y como cae la ranura que esta a `d` pasos del centro (d puede ser
  // fraccionario). Con la fila circular no se recorren indices sino ranuras:
  // cada una muestra el juego que le toque dando la vuelta al array.
  slotAt(d) {
    if (Math.abs(d) > MAX_VISIBLE) return null;
    const ad = Math.abs(d);
    // Escala: la del centro entera, las de los lados encogidas. Se usa una
    // curva y no una recta para que el centro destaque de verdad.
    const sc = Math.pow(SIDE_SCALE, ad * 0.8);
    const h = SEL_H * sc;
    const w = CW / CH * h;
    // Estrechamiento: simula el giro hacia dentro sin usar transformaciones 3D.
    const squeeze = 1 - (1 - SIDE_SQUEEZE) * Math.min(1, ad * 0.85);
    // Posicion horizontal: los pasos se comprimen al alejarse, que es lo que
    // da la sensacion de fuga. Sin esto la fila se ve plana.
    const dir = Math.sign(d);
    const comp = ad <= 1 ? ad : 1 + (ad - 1) * 0.55;
    const x = VW / 2 + dir * comp * SEP;
    return { d, ad, x, w: w * squeeze, h, sc, front: 1 - Math.min(1, ad) };
  },

  draw(g) {
    // ---------- Fondo: el mueble del arcade ----------
    const bg = g.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#1a0b3a'); bg.addColorStop(0.55, '#12082a'); bg.addColorStop(1, '#080418');
    g.fillStyle = bg; g.fillRect(0, 0, VW, VH);
    // Resplandor detras de la caratula elegida. El color se MEZCLA entre las
    // dos caratulas que se estan cruzando: tomando el del juego elegido a secas,
    // el fondo entero cambiaba de golpe al pasar el punto medio del arrastre.
    const selG = this.glowColor();
    const halo = g.createRadialGradient(VW / 2, SHELF_Y - 56, 8, VW / 2, SHELF_Y - 56, 150);
    halo.addColorStop(0, hexA(selG, 0.20));
    halo.addColorStop(1, hexA(selG, 0));
    g.fillStyle = halo; g.fillRect(0, 0, VW, VH);
    // Suelo del estante: una linea de luz y su degradado hacia abajo.
    const fl = g.createLinearGradient(0, SHELF_Y, 0, VH);
    fl.addColorStop(0, hexA(selG, 0.14)); fl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fl; g.fillRect(0, SHELF_Y, VW, VH - SHELF_Y);
    g.fillStyle = hexA(selG, 0.45); g.fillRect(0, SHELF_Y, VW, 1);

    // ---------- Marquesina, centrada arriba ----------
    // En una linea sola: en dos ocupaba el alto que necesitan las caratulas y
    // dejaba un hueco muerto a la izquierda de la fila.
    const t1 = "ROMINA'S", t2 = 'ARCADE';
    const w1 = measure(t1, 2), w2 = measure(t2, 2), gapT = 8;
    const tx = Math.round(VW / 2 - (w1 + gapT + w2) / 2);
    text(g, t1, tx, 8, '#ff5c9d', 2);
    text(g, t2, tx + w1 + gapT, 8, '#5cffd8', 2);

    // ---------- Las caratulas, de fuera hacia dentro ----------
    // Se dibujan por distancia descendente para que la del centro tape a las
    // otras: si se dibujaran en orden de indice, la de la derecha se le
    // montaria encima.
    for (const { i, s } of this.visible().sort((a, b) => b.s.ad - a.s.ad)) {
      this.drawCover(g, i, s);
    }

    // ---------- Texto del juego elegido ----------
    const G = GAMES[this.sel].meta;
    // Se desvanece mientras la fila esta en movimiento: leerlo corriendo marea.
    // Cuanto falta para encajar, medido contra el entero mas cercano y NO
    // contra sel: sel esta acotado a 0..N-1 y pos no, asi que al dar la vuelta
    // la resta valdria varias unidades y el texto se apagaria de golpe.
    const settle = clamp(1 - Math.abs(this.pos - Math.round(this.pos)) * 3.5, 0, 1);
    if (settle > 0.02) {
      const ty = SHELF_Y + 14;
      textCenter(g, G.title, VW / 2, ty, fade(G.colors[0], settle), 3);
      textCenter(g, G.tag || '', VW / 2, ty + 26, fade('#8a7ab8', settle), 2);
      const best = Save.best(G.id);
      textCenter(g, best > 0 ? 'MEJOR ' + best : 'SIN RECORD AUN',
                 VW / 2, ty + 44, fade(best > 0 ? '#c8b8ff' : '#5a4a88', settle), 2);
    }

    // ---------- Flechas de que hay mas a los lados ----------
    // La fila da la vuelta, asi que las flechas no avisan de un tope: son la
    // pista de que esto se arrastra de lado.
    const puls = 0.55 + Math.sin(this.t * 3) * 0.25;
    arrow(g, 14, SHELF_Y - 52, -1, hexA('#c8b8ff', puls));
    arrow(g, VW - 16, SHELF_Y - 52, 1, hexA('#c8b8ff', puls));

    // ---------- Puntos de posicion y sonido ----------
    const dotY = VH - 12, dw = 10;
    const dx0 = VW / 2 - (GAMES.length - 1) * dw / 2;
    for (let i = 0; i < GAMES.length; i++) {
      const on = i === this.sel;
      g.fillStyle = on ? selG : '#3a2a68';
      const r = on ? 3 : 2;
      g.fillRect(Math.round(dx0 + i * dw - r / 2), dotY - (r >> 1), r, r);
    }
    // El rotulo del sonido se ancla midiendolo, no con un margen a ojo: con
    // 'SONIDO OFF' (una letra mas) se salia del lienzo por la derecha.
    const snd = Save.muted ? 'SONIDO OFF' : 'SONIDO ON';
    text(g, snd, VW - measure(snd, 2) - 10, VH - 18,
         Save.muted ? '#5a4a88' : '#7a6aa8', 2);
  },

  drawCover(g, i, s) {
    const img = this.covers[i];
    const G = GAMES[i].meta;
    const x = s.x - s.w / 2, y = SHELF_Y - s.h;
    // Sombra en el estante, mas ancha cuanto mas cerca esta la caratula.
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(Math.round(x - 2), SHELF_Y, Math.round(s.w + 4), 2);
    // La caratula.
    g.drawImage(img, Math.round(x), Math.round(y), Math.round(s.w), Math.round(s.h));
    // Reflejo bajo el estante: la misma imagen volteada, desvaneciendose.
    const rh = Math.round(s.h * 0.42);
    g.save();
    g.globalAlpha = 0.20 + s.front * 0.12;
    g.translate(0, SHELF_Y * 2 + 1);
    g.scale(1, -1);
    g.drawImage(img, 0, 0, CW, Math.round(CH * 0.42),
                Math.round(x), Math.round(SHELF_Y - rh), Math.round(s.w), rh);
    g.restore();
    // El reflejo se apaga hacia abajo con una banda oscura encima. El degradado
    // se cachea por altura: sin esto se creaban siete objetos por frame, uno
    // por caratula, solo para tirarlos.
    g.fillStyle = fadeBand(g, rh);
    g.fillRect(Math.round(x) - 1, SHELF_Y + 1, Math.round(s.w) + 2, rh);
    // Las caratulas de los lados se oscurecen: solo la del centro va a plena luz.
    if (s.front < 1) {
      g.fillStyle = hexA('#080418', 0.55 * (1 - s.front));
      g.fillRect(Math.round(x), Math.round(y), Math.round(s.w), Math.round(s.h));
    }
    // Marco encendido en la del centro.
    if (s.front > 0.4) {
      g.strokeStyle = hexA(G.colors[0], (s.front - 0.4) / 0.6);
      g.lineWidth = 1;
      g.strokeRect(Math.round(x) - 0.5, Math.round(y) - 0.5, Math.round(s.w) + 1, Math.round(s.h) + 1);
    }
  },

  // ---------- Arrastre ----------
  onInput(ev) {
    if (ev.type === 'down') {
      // El toque en el rotulo de sonido no arrastra.
      if (ev.y > VH - 26 && ev.x > VW - 96) { toggleMute(); SFX.blip(); return; }
      this.drag = { id: ev.id, x0: ev.x, last: ev.x, pos0: this.pos, moved: 0, t: 0, vx: 0 };
      this.vel = 0;
      this.dest = this.pos;      // mientras el dedo esta puesto, manda el dedo
      return;
    }
    const dr = this.drag;
    if (!dr || ev.id !== dr.id) return;

    if (ev.type === 'move') {
      const dx = ev.x - dr.x0;
      dr.moved = Math.max(dr.moved, Math.abs(dx));
      // Un paso de fila por cada SEP pixeles arrastrados: la caratula sigue al
      // dedo, que es lo que hace que el gesto se sienta fisico.
      // La fila es circular: se arrastra sin topes en ningun sentido.
      this.pos = dr.pos0 - dx / SEP;
      // Velocidad instantanea, para el impulso al soltar.
      dr.vx = ev.x - dr.last;
      dr.last = ev.x;
      return;
    }

    if (ev.type === 'up') {
      this.drag = null;
      if (dr.moved <= TAP_SLOP) {
        // Fue un toque, no un arrastre. En la caratula del centro: jugar.
        // En una lateral: traerla al centro.
        const hit = this.pick(ev.x, ev.y);
        if (!hit) { this.dest = Math.round(this.pos); return; }
        // Se mira la RANURA, no el indice: con la fila circular el mismo juego
        // puede estar a la izquierda y a la derecha a la vez.
        if (Math.abs(hit.d) < 0.5) this.launch(hit.i);
        else { SFX.blip(); this.dest = Math.round(this.pos + hit.d); }
        return;
      }
      // Al soltar tras arrastrar: el impulso del gesto decide a que caratula se
      // va, y de ahi en adelante solo se anima hacia ella.
      this.vel = clamp(-dr.vx / FLICK / SEP, -30, 30);
      this.dest = this.destinoTras(this.vel);
    }
  },

  // Que caratula hay bajo (x,y). Se prueba de la mas cercana al centro hacia
  // fuera, que es el orden inverso al de dibujado: asi gana la que esta encima.
  pick(x, y) {
    const cands = this.visible().sort((a, b) => a.s.ad - b.s.ad);
    for (const { i, s } of cands) {
      const left = s.x - s.w / 2, top = SHELF_Y - s.h;
      if (x >= left - 3 && x <= left + s.w + 3 && y >= top - 3 && y <= SHELF_Y + 3) {
        return { i, d: s.d };
      }
    }
    // Un toque bajo el estante, sobre el texto, tambien lanza el juego.
    if (y > SHELF_Y + 10 && y < VH - 24 && Math.abs(x - VW / 2) < 120) {
      return { i: this.sel, d: 0 };
    }
    return null;
  },

  // Color del ambiente: el del juego que se esta centrando, mezclado con el del
  // vecino hacia el que se arrastra, en proporcion a lo avanzado del gesto.
  glowColor() {
    const N = GAMES.length;
    const lo = Math.floor(this.pos), t = this.pos - lo;
    const a = GAMES[mod(lo, N)].meta.colors[0];
    const b = GAMES[mod(lo + 1, N)].meta.colors[0];
    return mix(a, b, t);
  },

  // Las ranuras que hay que dibujar ahora, con el juego que le toca a cada una.
  // El centro de la fila esta en round(pos); alrededor se abren MAX_VISIBLE
  // ranuras a cada lado, y el juego de cada una sale de dar la vuelta al array.
  visible() {
    const out = [];
    const c = Math.round(this.pos);
    for (let k = -MAX_VISIBLE; k <= MAX_VISIBLE; k++) {
      const idx = c + k;                    // indice sin acotar de esta ranura
      const s = this.slotAt(idx - this.pos);
      if (s) out.push({ i: mod(idx, GAMES.length), s });
    }
    return out;
  },

  launch(i) {
    SFX.select();
    this.onLaunch(GAMES[i]);
  },

  // El gestor de escenas lo rellena al arrancar: el menu no importa main.js.
  onLaunch() {},
};

// Mezcla de dos colores '#rrggbb'. El resultado se cuantiza a 16 pasos para
// que hexA() y el cache de la fuente no vean un color distinto cada frame.
function mix(a, b, t) {
  t = Math.round(clamp(t, 0, 1) * 16) / 16;
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const r = Math.round((A >> 16 & 255) + ((B >> 16 & 255) - (A >> 16 & 255)) * t);
  const g = Math.round((A >> 8 & 255) + ((B >> 8 & 255) - (A >> 8 & 255)) * t);
  const bl = Math.round((A & 255) + ((B & 255) - (A & 255)) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// Resto SIEMPRE positivo: el % de JavaScript devuelve negativo con negativos,
// y aqui se usa para dar la vuelta al array de juegos.
function mod(n, m) { return ((n % m) + m) % m; }

// ---------- Utilidades de color ----------
// Un color '#rrggbb' con alfa. Se usa mucho por frame, asi que se cachea.
// Banda que apaga el reflejo, cacheada por altura.
const bandCache = new Map();
function fadeBand(g, rh) {
  let b = bandCache.get(rh);
  if (b === undefined) {
    b = g.createLinearGradient(0, SHELF_Y, 0, SHELF_Y + rh);
    b.addColorStop(0, 'rgba(8,4,24,0.35)');
    b.addColorStop(1, 'rgba(8,4,24,1)');
    if (bandCache.size > 80) bandCache.clear();
    bandCache.set(rh, b);
  }
  return b;
}

const aCache = new Map();
function hexA(hex, a) {
  const k = hex + '|' + a.toFixed(3);
  let v = aCache.get(k);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
    if (aCache.size > 400) aCache.clear();
    aCache.set(k, v);
  }
  return v;
}

// La fuente hornea un canvas por color, asi que un desvanecido continuo crearia
// un canvas por frame. Se cuantiza a seis pasos: el cache no se descontrola.
function fade(hex, t) {
  return hexA(hex, Math.round(clamp(t, 0, 1) * 6) / 6);
}

function arrow(g, x, y, dir, col) {
  g.fillStyle = col;
  for (let k = 0; k < 7; k++) {
    g.fillRect(x + dir * k, y - 7 + k, 2, 2);
    g.fillRect(x + dir * k, y + 7 - k, 2, 2);
  }
}
