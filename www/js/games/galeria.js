// GALERIA - toca la foto que te piden, antes de que se acabe el tiempo.
//
// JUEGA CON LAS FOTOS DEL TELEFONO. Las cuarenta mas recientes bajan haciendo
// scroll y hay que encontrar la que se muestra arriba. Cada partida es
// distinta porque la galeria cambia, y reconocer una foto vuestra entre
// cuarenta es mucho mas divertido que buscar una caratula.
//
// LAS FOTOS NO SALEN DEL TELEFONO. El puente nativo las lee, las reduce a
// miniaturas de 192 px y se las pasa a este JavaScript. No hay ni una peticion
// de red, no se guardan en ningun sitio y viven solo mientras dura la partida.
//
// SIEMPRE SE PUEDE JUGAR. Si ella no da el permiso, si la galeria esta vacia o
// si no hay puente nativo (probandolo en el navegador), se juega con las
// caratulas del arcade. El juego nunca se queda en una pantalla de error.
//
// Y ADEMAS SIRVE PARA PROBAR LAS ACTUALIZACIONES: lleva la version bien
// visible en el pie y un color que cambia con cada publicacion. Que el numero
// del menu cambie prueba que la descarga funciono; que este juego muestre el
// numero nuevo prueba que el codigo nuevo se esta EJECUTANDO, que no es lo
// mismo (y ese fue un fallo real que llego al telefono).

import { VW, VH, clamp } from '../core.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { burst } from '../gfx.js';
import { cover, CW, CH } from '../covers.js';
import { GAMES } from '../games.js';
import { versionActual } from '../update.js';
import { Fotos } from '../fotos.js';

// El color cambia con la version: es la señal VISUAL de que el codigo nuevo
// esta corriendo. Un numero se puede quedar cacheado en un sitio y no en otro;
// si el marco cambia de color, es que este fichero es el nuevo.
function colorDeVersion(v) {
  const n = String(v).split('.').reduce((a, x) => a * 100 + (parseInt(x, 10) || 0), 0);
  const tonos = ['#5cffd8', '#ff5c9d', '#ffe066', '#7fb3ff', '#b47cff', '#ff9d5c'];
  return tonos[n % tonos.length];
}

const FILAS = 3;          // cuantas columnas de caratulas bajan a la vez
const T0 = 6.0;           // segundos que da la primera ronda
const T_MIN = 2.2;        // por rapido que se vaya, nunca menos que esto
const BANDA = 92;         // franja de arriba: la foto que hay que buscar
// Medido en pantalla: con 34x44 la miniatura era una mancha de color y no se
// reconocia nada. A 56x72 se distingue de que foto se trata, que es el juego.
const PIE = 44;           // franja de abajo: marcador y version

export default {
  meta: {
    id: 'galeria', title: 'GALERIA', tag: 'TOCA LA QUE TE PIDEN',
    colors: ['#7fb3ff', '#ffe066'],
  },

  init(ctx, args) {
    this.ctx = ctx;
    // Se arranca con las CARATULAS: asi el juego es jugable desde el primer
    // frame, sin esperar a la galeria. Las fotos, si llegan, entran despues.
    this.usaFotos = false;
    this.pidiendo = false;
    this.imgs = GAMES.filter(g => g.meta.id !== 'galeria').map(g => cover(g.meta));
    this.nombres = GAMES.filter(g => g.meta.id !== 'galeria').map(g => g.meta.title);
    this.n = this.imgs.length;

    this.col = [];
    for (let i = 0; i < FILAS; i++) {
      this.col.push({ x: 0, y: -i * 90, vel: 46 + i * 9, orden: this.baraja() });
    }
    this.puntos = 0;
    this.racha = 0;
    this.vidas = 3;
    this.t = 0;
    this.tiempo = T0;
    this.ronda = 0;
    this.msg = ''; this.msgT = 0;
    this.fin = false;
    this.ver = versionActual();
    this.colorVer = colorDeVersion(this.ver);
    this.sello = 'SELLO-B';
    this.pide = this.nuevoObjetivo();

    // Y ahora, las fotos. Sin await: el juego ya funciona.
    this.cargaFotos();
  },

  // Trae las fotos del telefono si se puede. Al acabar, cambia las caratulas
  // por las fotos sin cortar la partida.
  async cargaFotos() {
    if (!Fotos.hayPuente()) return;          // navegador: se queda en caratulas
    if (!Fotos.hayPermiso()) {
      // Se pide UNA vez. El dialogo es asincrono, asi que el resultado se
      // recoge en resume(), cuando la app recupera el foco.
      this.pidiendo = true;
      this.msg = 'BUSCANDO TUS FOTOS'; this.msgT = 1.6;
      Fotos.pedirPermiso();
      return;
    }
    const fotos = await Fotos.recientes(40);
    if (!fotos.length) return;               // galeria vacia: caratulas
    this.imgs = fotos;
    this.nombres = fotos.map((_, i) => 'FOTO ' + (i + 1));
    this.n = fotos.length;
    this.usaFotos = true;
    for (const col of this.col) col.orden = this.baraja();
    this.pide = this.nuevoObjetivo();
    this.msg = 'CON TUS FOTOS'; this.msgT = 1.4;
  },

  // La app vuelve a primer plano: puede que acabe de conceder el permiso.
  resume() {
    if (this.pidiendo && Fotos.hayPermiso()) {
      this.pidiendo = false;
      this.cargaFotos();
    }
  },

  // Un orden aleatorio de las caratulas, para que cada columna baje distinta.
  baraja() {
    const a = this.imgs.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  nuevoObjetivo() {
    this.ronda++;
    this.tiempo = Math.max(T_MIN, T0 - this.ronda * 0.22);
    return (Math.random() * this.n) | 0;
  },

  // Donde cae cada caratula ahora mismo. Se calcula en un solo sitio para que
  // el dibujo y el toque no puedan discrepar: si se calcularan por separado,
  // tocarias una y se marcaria otra.
  cartas() {
    const out = [];
    const escala = 0.62;
    const w = CW * escala, h = CH * escala;
    const sep = h + 16;
    const margen = (VW - FILAS * w) / (FILAS + 1);
    for (let c = 0; c < FILAS; c++) {
      const col = this.col[c];
      const x = margen + c * (w + margen);
      // cuantas caben en pantalla, mas una arriba y otra abajo
      const total = Math.ceil(VH / sep) + 2;
      for (let k = 0; k < total; k++) {
        const y = ((col.y + k * sep) % (sep * total) + sep * total) % (sep * total) - sep;
        const idx = col.orden[(k + c * 3) % col.orden.length];
        out.push({ x, y, w, h, idx });
      }
    }
    return out;
  },

  // Dibuja una carta. Las fotos vienen en cualquier proporcion, asi que se
  // RECORTAN al centro en vez de deformarse: una foto estirada no se reconoce,
  // y reconocerla es el juego entero.
  dibujaCarta(g, img, x, y, w, h, brilla) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (!img || !img.width) {
      g.fillStyle = '#2a1a58'; g.fillRect(x, y, w, h);
      return;
    }
    const escala = Math.max(w / img.width, h / img.height);
    const sw = w / escala, sh = h / escala;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    // marco: el de la buscada, encendido
    g.strokeStyle = brilla ? this.colorVer : '#3a2a68';
    g.lineWidth = brilla ? 2 : 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  },

  update(dt, ctx) {
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.fin) return;

    for (const col of this.col) col.y += col.vel * dt * (1 + this.ronda * 0.04);

    this.tiempo -= dt;
    if (this.tiempo <= 0) {
      this.falla('SE ACABO EL TIEMPO');
    }
  },

  falla(por) {
    this.vidas--;
    this.racha = 0;
    this.msg = por; this.msgT = 1.0;
    SFX.hurt();
    if (this.vidas <= 0) {
      this.fin = true;
      // gameOver ya guarda el record por dentro (Save.submit): hacerlo aqui
      // tambien seria contarlo dos veces.
      this.ctx.gameOver(this.puntos);
    } else {
      this.pide = this.nuevoObjetivo();
    }
  },

  onInput(ev, ctx) {
    if (ev.type !== 'down' || this.fin) return;
    for (const c of this.cartas()) {
      // Solo cuentan las que se VEN: si no, se podria acertar tocando una
      // carta escondida bajo la franja del titulo.
      if (c.y + c.h < BANDA || c.y > VH - PIE) continue;
      if (ev.x >= c.x && ev.x <= c.x + c.w && ev.y >= c.y && ev.y <= c.y + c.h) {
        if (c.idx === this.pide) {
          this.racha++;
          this.puntos += 10 + this.racha * 2;
          this.msg = this.racha > 1 ? 'RACHA x' + this.racha : 'BIEN'; this.msgT = 0.7;
          SFX.blip();
          burst(c.x + c.w / 2, c.y + c.h / 2, 12, {
            rnd: Math.random, colors: [this.colorVer, '#ffffff'],
            speed: 150, life: 0.4, size: 3, grav: 60,
          });
          this.pide = this.nuevoObjetivo();
        } else {
          this.falla('ESA NO');
        }
        return;
      }
    }
  },

  draw(g, ctx) {
    g.fillStyle = '#0d0620';
    g.fillRect(0, 0, VW, VH);

    // Las caratulas bajando, RECORTADAS bajo la franja de arriba y sobre la de
    // abajo: sin el recorte se metian por detras del texto y ni el titulo ni
    // el marcador se leian.
    g.save();
    g.beginPath();
    g.rect(0, BANDA, VW, VH - BANDA - PIE);
    g.clip();
    for (const c of this.cartas()) {
      const esObj = c.idx === this.pide;
      g.globalAlpha = esObj ? 1 : 0.62;
      this.dibujaCarta(g, this.imgs[c.idx], c.x, c.y, c.w, c.h, esObj);
      g.globalAlpha = 1;
    }
    g.restore();

    // Franja de arriba: que hay que tocar
    g.fillStyle = '#12082a';
    g.fillRect(0, 0, VW, BANDA);
    g.fillStyle = this.colorVer;
    g.fillRect(0, BANDA - 2, VW, 2);

    // QUE HAY QUE BUSCAR. Con fotos se ensena LA FOTO en pequeño, porque un
    // nombre ('FOTO 17') no dice nada: el juego es reconocerla de vista. Con
    // caratulas se ensena su nombre, que si identifica el juego.
    text(g, 'BUSCA', 10, 8, '#8a7ab8', 2);
    if (this.usaFotos) {
      const mw = 56, mh = 72;
      this.dibujaCarta(g, this.imgs[this.pide], VW / 2 - mw / 2, 10, mw, mh, true);
    } else {
      textCenter(g, this.nombres[this.pide], VW / 2, 38, '#ffe066', 3);
    }

    // La barra de tiempo
    const u = clamp(this.tiempo / Math.max(T_MIN, T0 - this.ronda * 0.22), 0, 1);
    g.fillStyle = '#2a1a58'; g.fillRect(14, BANDA - 10, VW - 28, 4);
    g.fillStyle = u > 0.35 ? this.colorVer : '#ff5c9d';
    g.fillRect(14, BANDA - 10, Math.round((VW - 28) * u), 4);

    // Pie: el marcador y la version, sobre fondo propio
    g.fillStyle = '#12082a';
    g.fillRect(0, VH - PIE, VW, PIE);
    g.fillStyle = this.colorVer;
    g.fillRect(0, VH - PIE, VW, 2);

    text(g, 'PUNTOS ' + this.puntos, 10, VH - PIE + 10, '#c8b8ff', 2);
    let vx = VW - 10;
    for (let i = 0; i < 3; i++) {
      vx -= 14;
      g.fillStyle = i < this.vidas ? '#ff5c9d' : '#3a2a68';
      g.fillRect(vx, VH - PIE + 10, 10, 10);
    }

    // LA VERSION, bien visible. Es para lo que existe este juego: si el numero
    // de aqui coincide con el del menu despues de actualizar, el codigo nuevo
    // se esta ejecutando de verdad y no solo se ha descargado.
    const vt = 'v' + this.ver;
    text(g, vt, 10, VH - PIE + 26, this.colorVer, 2);

    if (this.msgT > 0) {
      g.globalAlpha = Math.min(1, this.msgT * 2.5);
      textCenter(g, this.msg, VW / 2, VH / 2 - 10, '#ffe066', 3);
      g.globalAlpha = 1;
    }
  },
};
