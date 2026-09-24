// EL AVISO DE ACTUALIZACION, encima del salon del menu.
//
// Antes todo el aviso era el rotulo de abajo a la izquierda: 'v1.0.22' se
// convertia en 'BAJANDO 42%' y luego en 'REINICIA LA APP', en letra pequena,
// y ella tenia que cerrar la app y volver a abrirla. Anderson (23-09-2026):
// "que tuviera un mejor diseno el aviso ... y una opcion de reiniciar
// directamente desde la app como otros juegos".
//
// Ahora es un cartel con el aire del letrero de neon del salon (el tubo rosa,
// el resplandor, los corazones) que va contando lo que pasa, siempre con un
// boton para lo siguiente:
//
//     buscando     BUSCANDO...                         (sin botones)
//     hay          ¡NUEVA VERSION! 1.0.22 > 1.0.23     LUEGO | ACTUALIZAR
//                  y sus novedades, si las trae
//     bajando      BAJANDO... y una barra de bloques   OCULTAR
//     lista        ¡LISTA!                             LUEGO | REINICIAR
//     reiniciando  REINICIANDO... y un fundido a negro
//     aldia        ¡YA ESTAS AL DIA!                   VALE
//     error        NO SE PUDO y el motivo              CERRAR | REINTENTAR
//
// Es una VISTA de Update (update.js): dibuja el estado que haya, no guarda
// uno propio. Lo unico suyo es si esta abierto y si ella ya dijo LUEGO.
//
// Los botones se resuelven con el 'up' y solo si el 'down' cayo en el mismo,
// como en la pausa (pausa.js): se puede uno arrepentir arrastrando el dedo
// fuera, y un dedo que venia de antes no elige nada.
import { measure } from './font.js';
import { text, textCenter, corazon } from './salon.js';
import { SFX } from './audio.js';
import { Update, buscaActualizacion, reiniciaApp, versionActual } from './update.js';

// El ancho del cartel, en px virtuales del menu (600x270). Se ensancha lo que
// pidan las novedades, hasta ANCHO_MAX, para que una frase de hasta 34 letras
// quepa en una linea: partidas en dos, el cartel crecia hasta tapar el salon.
const ANCHO_MIN = 372, ANCHO_MAX = 460;
const PAD = 14;
const BOTON_H = 28;
const ENTRA = 0.22;             // s que tarda en aparecer

// Los colores son los del letrero del salon (salon.js, drawLetrero).
const ROSA = '#ff5c9d', ROSA_TUBO = '#ff7ab0', ROSA_LUZ = '#ff2d7a', ROSA_CLARO = '#ffd0e4';
const CIAN = '#5cffd8', CIAN_CLARO = '#b0fff0', CIAN_LUZ = '#20ffc8';
const LILA = '#c8b8ff', LILA_OSCURO = '#7a6aa8', MORADO = '#5a4a88';

export const Aviso = {
  abierto: false,
  descartado: false,            // dijo LUEGO a la version encontrada: no se reabre solo
  hayVisto: false,              // ya se le enseñó la version encontrada
  listaVista: false,            // ya se le enseñó el ¡LISTA!: no se reabre solo
  t: 0,                         // tiempo desde que se abrio, para la entrada
  _pulsado: null, _pulsadoId: -1,
  _botones: [],                 // donde quedaron dibujados, para el toque

  abre() {
    if (!this.abierto) { this.abierto = true; this.t = 0; }
    this._pulsado = null; this._pulsadoId = -1;
    this._negro = 0;
  },

  cierra() {
    this.abierto = false;
    this._pulsado = null; this._pulsadoId = -1;
    // Lo que ya se ha dicho no se queda colgado en el rotulo de abajo.
    if (Update.estado === 'aldia' || Update.estado === 'error') Update.estado = 'reposo';
  },

  // El boton ATRAS de Android: cierra el cartel como su boton de salir.
  atras() {
    if (!this.abierto) return false;
    if (Update.estado !== 'reiniciando') this.accion(this.salida());
    return true;
  },

  // Lo llama el menu en cada frame: el cartel solo sale solo en el menu, nunca
  // a mitad de partida.
  update(dt) {
    if (this.abierto) this.t += dt;
    // La comprobacion del arranque encontro una version: se le enseña UNA vez.
    // Si dice LUEGO, se queda en el rotulo de abajo, que sigue siendo tocable.
    if (Update.estado === 'hay' && !this.descartado && !this.hayVisto) {
      this.hayVisto = true;
      this.abre();
      SFX.coin();
    }
    // Al terminar de bajar, el cartel vuelve a salir aunque lo hubiera ocultado:
    // es el momento de reiniciar, y es lo que ella estaba esperando.
    if (Update.estado === 'lista' && !this.listaVista) {
      this.listaVista = true;
      this.abre();
      SFX.powerup();
    }
  },

  // ---------- Que dice el cartel en cada estado ----------
  contenido() {
    const de = versionActual(), a = Update.disponible;
    switch (Update.estado) {
      case 'buscando':
        return { titulo: 'BUSCANDO' + puntos(this.t), botones: [] };
      case 'hay':
        return { titulo: '¡NUEVA VERSION!', versiones: [de, a], corazones: true,
                 notas: Update.notas.length ? Update.notas : ['TRAE COSAS NUEVAS PARA TI'],
                 botones: [['luego', 'LUEGO'], ['actualizar', 'ACTUALIZAR']] };
      case 'bajando':
        return { titulo: 'BAJANDO' + puntos(this.t), versiones: [de, a], barra: true,
                 botones: [['ocultar', 'OCULTAR']] };
      case 'lista':
        return { titulo: '¡LISTA!', versiones: [de, a], corazones: true,
                 notas: ['REINICIA PARA ESTRENARLA'],
                 botones: [['luego', 'LUEGO'], ['reiniciar', 'REINICIAR']] };
      case 'reiniciando':
        return { titulo: 'REINICIANDO' + puntos(this.t), versiones: [de, a], botones: [] };
      case 'aldia':
        return { titulo: '¡YA ESTAS AL DIA!', notas: ['TIENES LA ' + de + ', LA ULTIMA'],
                 botones: [['vale', 'VALE']] };
      case 'error':
        return { titulo: 'NO SE PUDO', tituloColor: ROSA, notas: [Update.msg || 'ALGO FALLO'],
                 botones: [['cerrar', 'CERRAR'], ['reintentar', 'REINTENTAR']] };
      default:
        return null;
    }
  },

  // El boton que hace de "salir": el primero, el de la izquierda.
  salida() {
    const c = this.contenido();
    return c && c.botones.length ? c.botones[0][0] : 'cerrar';
  },

  accion(id) {
    switch (id) {
      case 'actualizar':
      case 'reintentar':
        SFX.select(); buscaActualizacion(); break;
      case 'reiniciar':
        SFX.select(); reiniciaApp(); break;
      case 'luego':
        SFX.blip();
        if (Update.estado === 'hay') this.descartado = true;
        this.cierra(); break;
      default:            // ocultar, vale, cerrar: la descarga sigue si la habia
        SFX.blip(); this.cierra();
    }
  },

  // ---------- Dibujo ----------
  draw(g, VW, VH) {
    const c = this.abierto && this.contenido();
    if (!c) { this._botones = []; return; }
    const k = Math.min(1, this.t / ENTRA);
    const e = 1 - Math.pow(1 - k, 3);                    // sale rapido y frena

    // El velo: el salon se queda detras, a oscuras, como en la pausa.
    g.fillStyle = 'rgba(6,3,16,' + (0.72 * e).toFixed(3) + ')';
    g.fillRect(0, 0, VW, VH);

    // La altura sale del contenido: cada estado dice cosas distintas.
    const notas = c.notas || [];
    const rombos = notas.length > 1 ? 12 : 0;
    const anchoNotas = notas.length ? Math.max(...notas.map(n => measure(n, 2))) + rombos : 0;
    const ANCHO = Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, anchoNotas + 2 * PAD + 4));
    const cabe = ANCHO - 2 * PAD - 4 - rombos;         // lo que mide una linea de texto
    const lineas = notas.flatMap(n => parte(n, cabe, 2));
    let h = PAD + 21;                                    // el titulo, a escala 3
    if (c.versiones) h += 10 + 14;
    if (c.barra) h += 14 + 12 + 8 + 14;
    if (lineas.length) h += 12 + lineas.length * 14 + (lineas.length - 1) * 6;
    if (c.botones.length) h += 16 + BOTON_H;
    h += PAD;
    const x0 = Math.round(VW / 2 - ANCHO / 2);
    const y0 = Math.round(VH / 2 - h / 2 + (1 - e) * 14);

    g.save();
    g.globalAlpha = e;
    // El cartel y su tubo de neon, que respira como el del letrero.
    g.fillStyle = '#120a28';
    g.fillRect(x0, y0, ANCHO, h);
    g.fillStyle = '#1c1238';
    g.fillRect(x0 + 2, y0 + 2, ANCHO - 4, 1);            // un filo de luz arriba
    // Las lineas de barrido de una pantalla de recreativa, muy tenues: sin
    // ellas el cartel es un plano de color; mas fuertes, ensucian el texto.
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let ly = y0 + 5; ly < y0 + h - 3; ly += 3) g.fillRect(x0 + 3, ly, ANCHO - 6, 1);
    const luz = 0.28 + 0.12 * Math.sin(this.t * 3);
    g.fillStyle = 'rgba(255,45,122,' + luz.toFixed(3) + ')';
    g.fillRect(x0 - 2, y0 - 2, ANCHO + 4, 3); g.fillRect(x0 - 2, y0 + h - 1, ANCHO + 4, 3);
    g.fillRect(x0 - 2, y0 - 2, 3, h + 4); g.fillRect(x0 + ANCHO - 1, y0 - 2, 3, h + 4);
    g.fillStyle = ROSA_TUBO;
    g.fillRect(x0, y0, ANCHO, 1); g.fillRect(x0, y0 + h - 1, ANCHO, 1);
    g.fillRect(x0, y0, 1, h); g.fillRect(x0 + ANCHO - 1, y0, 1, h);

    const cx = VW / 2;
    let y = y0 + PAD;
    // El titulo, con el resplandor del letrero: el mismo texto alrededor, tenue.
    // Los puntos suspensivos no pueden mover el titulo: se centra contando los
    // TRES aunque se vean menos (asi queda centrado del todo con los tres y no
    // baila), y el resplandor va en la misma x.
    const colT = c.tituloColor || ROSA_CLARO;
    const sinPuntos = c.titulo.replace(/\.+$/, '');
    const tx = Math.round(cx - measure(sinPuntos + (sinPuntos !== c.titulo ? '...' : ''), 3) / 2);
    g.globalAlpha = e * 0.35;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(g, c.titulo, tx + dx, y + dy, ROSA_LUZ, 3);
    g.globalAlpha = e;
    text(g, c.titulo, tx, y, colT, 3);
    if (c.corazones) {
      const w = measure(c.titulo, 3);
      corazon(g, Math.round(cx - w / 2 - 22), y + 5, ROSA, 0.5 + 0.5 * Math.sin(this.t * 3));
      corazon(g, Math.round(cx + w / 2 + 12), y + 5, ROSA, 0.5 + 0.5 * Math.sin(this.t * 3 + 1));
    }
    y += 21;

    // De que version a cual: la de ahora apagada, la nueva encendida.
    if (c.versiones) {
      y += 10;
      const [de, a] = c.versiones;
      const wDe = measure(de, 2), wA = measure(a || '', 2), hueco = 30;
      let x = Math.round(cx - (wDe + hueco + wA) / 2);
      text(g, de, x, y, LILA_OSCURO, 2);
      flecha(g, x + wDe + 9, y + 2, MORADO);
      x += wDe + hueco;
      g.globalAlpha = e * 0.4;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(g, a || '', x + dx, y + dy, CIAN_LUZ, 2);
      g.globalAlpha = e;
      text(g, a || '', x, y, CIAN_CLARO, 2);
      y += 14;
    }

    // La barra de la descarga: bloques, como la vida en una recreativa.
    if (c.barra) {
      y += 14;
      const N = 24, bw = 11, gap = 2, W = N * (bw + gap) - gap;
      const bx = Math.round(cx - W / 2);
      const p = Math.max(0, Math.min(1, Update.progreso));
      const llenos = Math.floor(p * N);
      g.fillStyle = 'rgba(92,255,216,0.18)';
      if (llenos) g.fillRect(bx - 2, y - 2, llenos * (bw + gap) + 2, 16);
      for (let i = 0; i < N; i++) {
        const lleno = i < llenos;
        const punta = i === llenos && p < 1 && Math.sin(this.t * 14) > 0;
        g.fillStyle = lleno ? CIAN : punta ? '#2e8a78' : '#241646';
        g.fillRect(bx + i * (bw + gap), y, bw, 12);
        if (lleno) { g.fillStyle = CIAN_CLARO; g.fillRect(bx + i * (bw + gap), y, bw, 2); }
      }
      y += 12 + 8;
      textCenter(g, Math.round(p * 100) + '%', cx, y, CIAN, 2);
      y += 14;
    }

    // Las novedades, o lo que haya que decir. Una sola frase va centrada; si
    // son varias, van como LISTA: alineadas a la izquierda, con un rombo al
    // empezar cada una y el trozo que no cabe metido bajo su texto. Centradas
    // una a una, el final de una novedad partida se quedaba suelto en medio.
    if (lineas.length) {
      y += 12;
      if (notas.length === 1) {
        for (const l of lineas) { textCenter(g, l, cx, y, LILA, 2); y += 14 + 6; }
      } else {
        const trozos = notas.map(n => parte(n, cabe, 2));
        const ancho = 12 + Math.max(...trozos.flat().map(l => measure(l, 2)));
        const lx = Math.round(cx - ancho / 2);
        for (const ts of trozos) {
          rombo(g, lx, y + 4, ROSA);
          for (const l of ts) { text(g, l, lx + 12, y, LILA, 2); y += 14 + 6; }
        }
      }
      y -= 6;
    }

    // Los botones: el de salir a la izquierda y el que sigue a la derecha,
    // como en los dialogos de Android. El que sigue es el grande y rosa.
    this._botones = [];
    if (c.botones.length) {
      y += 16;
      const tam = c.botones.map(([id, et], n) => {
        const principal = n === c.botones.length - 1 && c.botones.length > 1;
        return { id, et, principal, w: Math.max(principal ? 132 : 100, measure(et, 2) + (principal ? 36 : 28)) };
      });
      const hueco = 16;
      const W = tam.reduce((s, b) => s + b.w, 0) + hueco * (tam.length - 1);
      let bx = Math.round(cx - W / 2);
      for (const b of tam) {
        const pulsado = this._pulsado === b.id;
        boton(g, bx, y, b.w, BOTON_H, b.et, b.principal, pulsado, this.t);
        this._botones.push({ id: b.id, x: bx, y, w: b.w, h: BOTON_H });
        bx += b.w + hueco;
      }
    }
    g.restore();

    // REINICIANDO: el salon se funde a negro, y entonces recarga (update.js).
    if (Update.estado === 'reiniciando') {
      this._negro = Math.min(1, (this._negro || 0) + 1 / 24);
      g.fillStyle = 'rgba(0,0,0,' + this._negro.toFixed(3) + ')';
      g.fillRect(0, 0, VW, VH);
    }
  },

  // ---------- Toques ----------
  // Devuelve true si el cartel se quedo el toque (con el abierto, siempre:
  // lo de debajo no se puede tocar).
  onInput(ev) {
    if (!this.abierto) return false;
    if (ev.type === 'down') {
      const b = this.botonEn(ev.x, ev.y);
      this._pulsado = b; this._pulsadoId = ev.id;
      return true;
    }
    if (ev.type === 'up' || ev.type === 'cancel') {
      const mio = ev.id === this._pulsadoId ? this._pulsado : null;
      this._pulsado = null; this._pulsadoId = -1;
      if (mio && ev.type === 'up' && this.botonEn(ev.x, ev.y) === mio) this.accion(mio);
      return true;
    }
    return true;
  },

  // El area de toque es un poco mayor que el dibujo: se aprieta con el pulgar.
  botonEn(x, y) {
    for (const b of this._botones) {
      if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) return b.id;
    }
    return null;
  },
};

// '', '.', '..', '...' en bucle: que se vea que esta trabajando.
function puntos(t) { return '.'.repeat(Math.floor(t * 3) % 4); }

// Corta una linea en trozos que quepan en `ancho`, por palabras.
function parte(s, ancho, esc) {
  const out = [];
  let linea = '';
  for (const p of String(s).split(' ')) {
    const prueba = linea ? linea + ' ' + p : p;
    if (measure(prueba, esc) <= ancho || !linea) linea = prueba;
    else { out.push(linea); linea = p; }
  }
  if (linea) out.push(linea);
  return out;
}

// Un boton de recreativa: la cara, un filo de luz arriba y el canto abajo.
// Apretado, baja lo que medía el canto: se hunde.
function boton(g, x, y, w, h, et, principal, pulsado, t) {
  const canto = pulsado ? 1 : 4;
  const dy = pulsado ? 3 : 0;
  if (principal) {
    // El que sigue respira un poco, para que se vea que es el camino.
    const brillo = pulsado ? 0 : 0.5 + 0.5 * Math.sin(t * 4);
    g.fillStyle = 'rgba(255,45,122,' + (0.18 + 0.14 * brillo).toFixed(3) + ')';
    g.fillRect(x - 3, y - 3 + dy, w + 6, h + 6 - dy);
    g.fillStyle = '#a8174f';
    g.fillRect(x, y + dy, w, h - dy);
    g.fillStyle = pulsado ? '#e84a8a' : ROSA;
    g.fillRect(x, y + dy, w, h - canto - dy);
    g.fillStyle = '#ffa3c8';
    g.fillRect(x + 2, y + dy + 2, w - 4, 2);
    const ty = y + dy + Math.round((h - canto - 14) / 2);
    textCenter(g, et, x + w / 2, ty + 1, '#6a0f35', 2);
    textCenter(g, et, x + w / 2, ty, '#ffffff', 2);
  } else {
    g.fillStyle = '#0e0820';
    g.fillRect(x, y + dy, w, h - dy);
    g.fillStyle = pulsado ? '#2a1a50' : '#1c1038';
    g.fillRect(x, y + dy, w, h - canto - dy);
    g.fillStyle = MORADO;
    g.fillRect(x, y + dy, w, 1); g.fillRect(x, y + h - canto - 1, w, 1);
    g.fillRect(x, y + dy, 1, h - canto - dy); g.fillRect(x + w - 1, y + dy, 1, h - canto - dy);
    const ty = y + dy + Math.round((h - canto - 14) / 2);
    textCenter(g, et, x + w / 2, ty, LILA, 2);
  }
}

// La flecha entre las dos versiones: un chevron de pixeles.
function flecha(g, x, y, col) {
  g.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    g.fillRect(x + k, y + k, 2, 2);
    g.fillRect(x + k, y + 8 - k, 2, 2);
  }
}

// Un rombo de 5x5 para empezar cada novedad.
function rombo(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(x + 2, y, 1, 1); g.fillRect(x + 1, y + 1, 3, 1);
  g.fillRect(x, y + 2, 5, 1); g.fillRect(x + 1, y + 3, 3, 1); g.fillRect(x + 2, y + 4, 1, 1);
}
