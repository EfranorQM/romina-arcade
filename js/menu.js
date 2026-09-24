// Menu del arcade: un SALON RECREATIVO. Cada juego es una maquina (su
// marquesina con el nombre, su portada en la pantalla, la palanca, los botones
// y las monedas), en fila; se arrastra el dedo y la fila corre con inercia
// hasta encajar sola en la maquina mas cercana. La del centro esta de frente,
// encendida y grande; las de los lados se alejan, se encogen, se inclinan
// hacia dentro y se apagan. Detras, el salon (salon.js): el cartel de neon, una
// fila de maquinas lejanas que corre mas despacio y la moqueta.
//
// Antes era una estanteria de caratulas sobre un degradado. El arrastre, el
// muelle y los toques son los de entonces, medidos por tools/prueba-menu.mjs:
// solo cambio el dibujo (y la separacion, porque una maquina es mas ancha).
//
// Es la unica escena apaisada junto al fin de partida: su lienzo (VW x VH) es
// 600x270, dibujado a x2 (ss: 2) para que las maquinas y las portadas se vean
// nitidas, y al entrar a un juego el telefono gira a vertical.
import { VW, VH, Save, clamp } from './core.js';
import { measure } from './font.js';
import { SFX, toggleMute } from './audio.js';
import { GAMES } from './games.js';
import { cover } from './covers.js';
import { horneaMaquina, rayasPantalla, drawFondo, drawLetrero, MQ_W, MQ_H, PANTALLA, SUELO_Y,
         text, textCenter } from './salon.js';
import { Update, buscaActualizacion, compruebaActualizacion, versionActual, recienEstrenada } from './update.js';
import { Aviso } from './aviso-update.js';

// La comprobacion de actualizaciones del arranque se pide UNA vez por sesion
// (init() corre cada vez que se vuelve de un juego). Y la celebracion de una
// version recien estrenada dura unos segundos de menu, tambien una sola vez.
let comprobacionPedida = false;
let celebracion = recienEstrenada ? 5 : 0;

// ---------- Geometria del salon ----------
// El escenario tiene 270 de alto y hay que repartirlo sin que nada se corte:
//   0..28    el cartel de neon
//   26..218  las maquinas (la del centro mide 192 y PISA en y 218; las de los
//            lados, mas al fondo, pisan mas arriba: es lo que da la distancia)
//   218..270 el lema y el record del juego, los puntos, la version y el sonido
// (El nombre del juego va en la marquesina de su maquina.)
const SEP = 100;              // separacion entre maquinas contiguas, en px
const SIDE_SQUEEZE = 0.62;    // cuanto se estrecha una maquina por cada paso
const SIDE_SCALE = 0.72;      // cuanto encoge por cada paso que se aleja
const PISA_Y = SUELO_Y + 22;  // donde pisa la maquina del centro
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
  // wide: el lienzo de esta escena ES el escenario apaisado. ss: 2, dibujado al
  // doble para que las maquinas y sus portadas se vean nitidas.
  meta: { id: '_menu', title: 'MENU', wide: true, vw: 600, vh: 270, ss: 2 },

  init() {
    this.t = 0;
    // `pos` es la posicion continua en la fila: 0 = primer juego centrado,
    // 1.5 = a medio camino entre el segundo y el tercero. El encaje la lleva
    // siempre hacia el entero mas cercano.
    // Al volver de un juego, su maquina sigue en el centro: si acaba de jugar
    // a ROMINA y quiere otra, la tiene delante y no tiene que ir a buscarla.
    // Solo al abrir la app se empieza por el primero.
    this.pos = Math.round(this.pos || 0);
    this.vel = 0;
    this.dest = this.pos;       // maquina a la que se esta yendo
    this.drag = null;
    // Se fija ya: si se dejara sin definir, el primer update tras volver de un
    // juego veria un cambio de seleccion que no ocurrio y sonaria un blip.
    this._lastSel = this.sel;
    this.covers = GAMES.map(G => cover(G.meta));
    // Se hornean al entrar al menu, no al arrancar la app: entrar y salir de un
    // juego no las vuelve a dibujar porque cover() las cachea por id.
    // Las maquinas tambien, una por juego (sin la portada, que se pinta encima
    // en cada frame: la de ROMINA llega tarde, cuando cargan sus dibujos).
    this.maquinas = this.maquinas || GAMES.map(G => horneaMaquina(G.meta));
    // Si hay version nueva, que se entere sin tener que tocar nada: se mira
    // un rato despues de abrir, para no competir con la carga del salon. Es
    // muda si no hay red (update.js, compruebaActualizacion).
    if (!comprobacionPedida) { comprobacionPedida = true; setTimeout(compruebaActualizacion, 2500); }
  },

  // El juego elegido: el entero mas cercano, traido al rango 0..N-1.
  get sel() { return mod(Math.round(this.pos), GAMES.length); },

  update(dt) {
    this.t += dt;
    Aviso.update(dt);
    if (celebracion > 0) celebracion -= dt;
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
    const h = MQ_H * sc;
    const w = MQ_W * sc;
    // Estrechamiento: simula el giro hacia dentro sin usar transformaciones 3D.
    const squeeze = 1 - (1 - SIDE_SQUEEZE) * Math.min(1, ad * 0.85);
    // Posicion horizontal: los pasos se comprimen al alejarse, que es lo que
    // da la sensacion de fuga. Sin esto la fila se ve plana.
    const dir = Math.sign(d);
    const comp = ad <= 1 ? ad : 1 + (ad - 1) * 0.55;
    const x = VW / 2 + dir * comp * SEP;
    // Las del fondo pisan mas arriba: estan mas lejos en el salon.
    const base = PISA_Y - 10 * Math.min(ad, 2);
    return { d, ad, x, w: w * squeeze, h, sc, base, front: 1 - Math.min(1, ad) };
  },

  draw(g) {
    // ---------- El salon: pared, maquinas lejanas, lamparas, moqueta ----------
    // La luz de la maquina del centro MEZCLA los colores de las dos que se
    // estan cruzando: con el del juego elegido a secas, todo el salon cambiaba
    // de golpe al pasar el punto medio del arrastre.
    const selG = this.glowColor();
    drawFondo(g, VW, this.t, this.pos * SEP, selG);
    drawLetrero(g, VW, this.t);

    // ---------- Las maquinas, de fuera hacia dentro ----------
    // Se dibujan por distancia descendente para que la del centro tape a las
    // otras: si se dibujaran en orden de indice, la de la derecha se le
    // montaria encima.
    for (const { i, s } of this.visible().sort((a, b) => b.s.ad - a.s.ad)) {
      this.drawMaquina(g, i, s);
    }

    // ---------- El lema y el record del juego elegido ----------
    // (El nombre va en la marquesina de su maquina.) Se desvanece mientras la
    // fila esta en movimiento: leerlo corriendo marea. Cuanto falta para
    // encajar se mide contra el entero mas cercano y NO contra sel: sel esta
    // acotado a 0..N-1 y pos no, asi que al dar la vuelta la resta valdria
    // varias unidades y el texto se apagaria de golpe.
    const G = GAMES[this.sel].meta;
    const settle = clamp(1 - Math.abs(this.pos - Math.round(this.pos)) * 3.5, 0, 1);
    if (settle > 0.02) {
      textCenter(g, G.tag || '', VW / 2, PISA_Y + 5, fade(G.colors[0], settle), 2);
      const best = Save.best(G.id);
      textCenter(g, best > 0 ? 'MEJOR ' + best : 'SIN RECORD AUN',
                 VW / 2, PISA_Y + 23, fade(best > 0 ? '#c8b8ff' : '#5a4a88', settle), 2);
    }

    // ---------- Flechas de que hay mas a los lados ----------
    // La fila da la vuelta, asi que las flechas no avisan de un tope: son la
    // pista de que esto se arrastra de lado.
    const puls = 0.55 + Math.sin(this.t * 3) * 0.25;
    arrow(g, 14, 120, -1, hexA('#c8b8ff', puls));
    arrow(g, VW - 16, 120, 1, hexA('#c8b8ff', puls));

    // ---------- Puntos de posicion y sonido ----------
    const dotY = VH - 7, dw = 10;
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

    // ---------- Version y boton de actualizar, abajo a la izquierda ----------
    // Simetrico con el rotulo del sonido. Se toca la version para buscar una
    // actualizacion. Lo que pasa se cuenta en el cartel (aviso-update.js); el
    // rotulo solo recuerda lo que ella dejo para LUEGO, y parpadea para que
    // se vea que se puede tocar.
    const est = Update.estado;
    const parpa = 0.55 + 0.45 * Math.sin(this.t * 4);
    let vtxt, vcol;
    if (Aviso.abierto)           { vtxt = 'v' + versionActual(); vcol = '#5a4a88'; }
    else if (est === 'hay')      { vtxt = 'NUEVA ' + Update.disponible + ' >'; vcol = fade('#ff5c9d', parpa); }
    else if (est === 'bajando')  { vtxt = 'BAJANDO ' + Math.round(Update.progreso * 100) + '%'; vcol = '#5cffd8'; }
    else if (est === 'lista')    { vtxt = 'REINICIAR >';    vcol = fade('#5cffd8', parpa); }
    else if (est === 'buscando') { vtxt = 'BUSCANDO...';    vcol = '#c8b8ff'; }
    else                         { vtxt = 'v' + versionActual(); vcol = '#5a4a88'; }
    text(g, vtxt, 10, VH - 18, vcol, 2);
    this._vw = measure(vtxt, 2);
    // Barra de progreso mientras baja con el cartel oculto
    if (est === 'bajando' && !Aviso.abierto) {
      g.fillStyle = '#2a1a58'; g.fillRect(10, VH - 6, 90, 2);
      g.fillStyle = '#5cffd8'; g.fillRect(10, VH - 6, Math.round(90 * Update.progreso), 2);
    }

    // ---------- Recien actualizada ----------
    // El primer arranque de una version nueva se le dice, unos segundos, bajo
    // el cartel del salon: si no, "ya esta" solo lo sabria mirando el numero.
    if (celebracion > 0 && recienEstrenada) this.drawCelebracion(g, celebracion);

    // ---------- El aviso de actualizacion, encima de todo ----------
    Aviso.draw(g, VW, VH);
  },

  // Una pastilla con el borde de neon cian, que baja, se queda y se va.
  drawCelebracion(g, quedan) {
    const a = clamp(Math.min(quedan, 5 - quedan) * 3, 0, 1);
    const et = '¡ACTUALIZADA A LA ' + recienEstrenada + '!';
    const w = measure(et, 2) + 28, h = 24;
    const x = Math.round(VW / 2 - w / 2), y = Math.round(34 - (1 - a) * 8);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(32,255,200,0.25)';
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#0c1a24';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#5cffd8';
    g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    textCenter(g, et, VW / 2, y + 5, '#b0fff0', 2);
    g.restore();
  },

  // UNA MAQUINA en su ranura: el mueble, su portada en la pantalla con las
  // rayas y el reflejo del cristal, y la luz: la del centro encendida, las de
  // los lados en penumbra.
  drawMaquina(g, i, s) {
    const G = GAMES[i].meta;
    const x = s.x - s.w / 2, y = s.base - s.h;
    // Su sombra en la moqueta.
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(Math.round(x - 3), Math.round(s.base - 1), Math.round(s.w + 6), 3);
    // Encogidas, suaves: con el pixel duro, las de los lados parpadeaban al
    // arrastrar (cada pixel caia en un sitio distinto en cada frame).
    const suave = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = s.front < 0.99;
    g.drawImage(this.maquinas[i], x, y, s.w, s.h);
    const kx = s.w / MQ_W, ky = s.h / MQ_H;
    const px = x + PANTALLA.x * kx, py = y + PANTALLA.y * ky, pw = PANTALLA.w * kx, ph = PANTALLA.h * ky;
    g.drawImage(this.covers[i], px, py, pw, ph);
    g.drawImage(rayasPantalla(), px, py, pw, ph);
    g.imageSmoothingEnabled = suave;
    // Las de los lados, en penumbra: solo la del centro esta encendida.
    if (s.front < 1) {
      g.fillStyle = hexA('#080418', 0.6 * (1 - s.front));
      g.fillRect(Math.round(x), Math.round(y), Math.ceil(s.w), Math.ceil(s.h));
    }
    // La del centro: la marquesina y la pantalla echan luz alrededor.
    if (s.front > 0.3) {
      const a = (s.front - 0.3) / 0.7;
      g.fillStyle = hexA(G.colors[0], 0.22 * a);
      g.fillRect(Math.round(x + 2 * kx), Math.round(y - 3), Math.round(s.w - 4 * kx), 3);
      g.fillStyle = hexA(G.colors[0], 0.12 * a);
      g.fillRect(Math.round(px - 3), Math.round(py - 3), Math.round(pw + 6), Math.round(ph + 6));
      // Y la pantalla respira un poco: esta encendida, no es una foto.
      g.fillStyle = hexA('#ffffff', 0.03 * a * (0.5 + 0.5 * Math.sin(this.t * 4)));
      g.fillRect(Math.round(px), Math.round(py), Math.round(pw), Math.round(ph));
    }
  },

  // ---------- Arrastre ----------
  onInput(ev) {
    // Con el aviso de actualizacion abierto, los toques son suyos: el salon de
    // detras no se toca. Si el cartel salio a mitad de un arrastre, el dedo se
    // da por soltado, o la fila se quedaria esperando un 'up' que no llega.
    if (Aviso.onInput(ev)) {
      if (this.drag) { this.drag = null; this.dest = Math.round(this.pos); }
      return;
    }
    if (ev.type === 'down') {
      // El toque en el rotulo de sonido no arrastra.
      if (ev.y > VH - 26 && ev.x > VW - 96) { toggleMute(); SFX.blip(); return; }
      // Ni el de la version: ahi se buscan actualizaciones. La zona de toque
      // es mas ancha que el texto (minimo 70 px) para que se pueda dar con el
      // pulgar aunque ponga solo 'v1.0.0'. Si ya hay algo en marcha (una
      // version encontrada, bajando o lista), se vuelve a abrir su cartel.
      if (ev.y > VH - 26 && ev.x < Math.max(70, (this._vw || 0) + 16)) {
        SFX.blip();
        const est = Update.estado;
        Aviso.abre();
        if (est !== 'hay' && est !== 'bajando' && est !== 'lista') buscaActualizacion();
        return;
      }
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
      const left = s.x - s.w / 2, top = s.base - s.h;
      if (x >= left - 3 && x <= left + s.w + 3 && y >= top - 3 && y <= s.base + 3) {
        return { i, d: s.d };
      }
    }
    // Un toque bajo las maquinas, sobre el texto, tambien lanza el juego.
    if (y > PISA_Y + 2 && y < VH - 24 && Math.abs(x - VW / 2) < 120) {
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
