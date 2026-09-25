// EL BOTON DE PAUSA Y SU PANTALLA, compartidos por los SIETE juegos.
//
// POR QUE VIVE AQUI Y NO EN CADA JUEGO. La alternativa era copiar boton,
// cartel y arbitraje de toques en los seis archivos: seis sitios donde se
// puede olvidar un 'up', seis dibujados que mantener, y los juegos que vengan
// naceran sin pausa. El bucle de main.js ya tiene las tres cosas que hacen
// falta -- es quien llama a update(), quien reparte la entrada y quien dibuja
// el ULTIMO, encima de todo, incluido el bloom de SURVIVAL (survival.js:1274)
// -- asi que la pausa se cuela entre esas tres y los seis juegos la reciben
// sin tocar una linea suya. Los juegos no saben que existe.
//
// COMO SE ENGANCHA. main.js ya tiene el interruptor `Pausa` (entrar/salir,
// para el update y suspende el audio) y deja dos huecos para esta pieza:
// Pausa.dibujar y Pausa.onInput. Aqui se rellenan los dos. No hay un segundo
// estado de pausa: el de main.js es el unico.
//
// LO UNICO que un juego puede decir es meta.pausaY, y solo dos lo necesitan.
// Ver posBoton().

import { text, measure } from './font.js';
import { supersample } from './core.js';

// font.js divide el texto entre el sobremuestreo (SURVIVAL cuenta con ello en
// su HUD), asi que aqui se le pide ya multiplicado y se centra con el ancho
// virtual, como hace salon.js. Sin esto, en los juegos con ss:2 (SURVIVAL y
// FURIA) el cartel de pausa salia a la mitad de tamano y corrido a la
// izquierda: el textCenter de font.js centraba con el ancho entero y pintaba
// la mitad. El panel ya estaba medido con el tamano entero.
function textCenter(g, s, cx, y, color, esc) {
  text(g, s, Math.round(cx - measure(String(s), esc) / 2), y, color, esc * supersample());
}

// ---------- El tamano del boton no puede ser una constante ----------
// Se mide en px VIRTUALES, y esos valen distinto en cada juego. Medido contra
// la pantalla del Redmi Note 10 (1080x2400, 409 ppi), que es el telefono real:
//
//     lienzo        escala   30 px virtuales son
//     270x600        x4.00     120 px fisicos = 7.5 mm
//     540x1200       x2.00      60 px fisicos = 3.7 mm   <- FURIA y SYMBIOTE
//     600x270        x4.00     120 px fisicos = 7.5 mm   <- SURVIVAL
//
// O sea que un boton de lado fijo mide bien en cuatro juegos y LA MITAD del
// minimo en los otros dos (Material pide 48dp, que en este telefono son
// 48/160*409 = 123 px fisicos = 7.5 mm). Por eso el lado es una proporcion del
// lienzo y no un numero:
//
//     u = (VW + VH) / 870      270+600 = 870 -> 1.00
//                             540+1200 =1740 -> 2.00
//                              600+270 = 870 -> 1.00
//
// Con lado = 30*u el dibujo mide 120 px fisicos = 7.5 mm en LOS TRES formatos,
// y el area de toque (un 40% mayor) 10.4 mm. Todo lo demas de esta pieza --
// grosores, huecos, escala de la fuente -- se multiplica por la misma u.
function unidad(VW, VH) { return (VW + VH) / 870; }

// ---------- Donde va el boton ----------
// ARRIBA Y CENTRADO. La esquina de arriba es lo normal para una pausa, pero
// midiendo caja por caja el HUD REAL de los seis, LAS DOS ESQUINAS ESTAN
// OCUPADAS EN LOS SEIS: a la izquierda va siempre 'ROMINA' con las vidas o el
// puntaje (skyline.js:457, neonfist.js:965, lastwave.js:1090, symbiote.js:367,
// furia.js:338, survival.js:1634) y a la derecha el puntaje y los avisos
// (skyline.js:461, neonfist.js:977, lastwave.js:1093, symbiote.js:370,
// furia.js:340, survival.js:1639). El centro de arriba, en cambio, esta libre
// en cuatro de los seis desde y=0. Los dos que no:
//
//     FURIA     la barra de progreso de pista cruza a lo ancho, y 11..27
//               (furia.js:329-336)          -> pausaY 28
//     SURVIVAL  el combo (y 12..19), el nombre del jefe (y 14..21) y su barra
//               (y 25..33) (survival.js:1650,1681,1684)  -> pausaY 34
//
// Por eso el juego puede pedir que se baje con meta.pausaY, en px virtuales de
// SU lienzo. Sin el, el boton va pegado arriba. Es un campo opcional: los
// cuatro que no lo ponen quedan exactamente igual que antes.
export function posBoton(VW, VH, meta) {
  const u = unidad(VW, VH);
  const lado = Math.round(30 * u);
  const y = (meta && meta.pausaY !== undefined) ? meta.pausaY : 2;
  return { x: Math.round(VW / 2 - lado / 2), y: Math.round(y), w: lado, h: lado, u };
}

// El area de toque es un 40% mayor que el dibujo: un pulgar no apunta fino, y
// aqui equivocarse cuesta una vida. Aun asi el boton es CHICO y esta en el
// borde de arriba, lejos de donde ella tiene los pulgares jugando.
export function tocaBoton(ev, VW, VH, meta) {
  const b = posBoton(VW, VH, meta);
  const pad = Math.round(6 * b.u);
  return ev.x >= b.x - pad && ev.x <= b.x + b.w + pad
      && ev.y >= b.y - pad && ev.y <= b.y + b.h + pad;
}

export function drawBoton(g, VW, VH, meta) {
  const b = posBoton(VW, VH, meta), u = b.u;
  g.save();
  // Poco contraste A PROPOSITO: es un boton que casi nunca se toca y no puede
  // competir con el HUD ni con lo que esta pasando en pantalla.
  g.globalAlpha = 0.34;
  g.fillStyle = '#0d0620';
  g.fillRect(b.x, b.y, b.w, b.h);
  g.globalAlpha = 0.5;
  g.strokeStyle = '#8a7ab8';
  g.lineWidth = Math.max(1, Math.round(u));
  g.strokeRect(b.x + 0.5 * u, b.y + 0.5 * u, b.w - u, b.h - u);
  // Las dos barras del simbolo. Dibujadas y no escritas con la fuente: no hay
  // glifo de pausa en FONT5x7 (font.js:4) y dos '1' se leerian como un numero.
  g.globalAlpha = 0.82;
  g.fillStyle = '#e8e0ff';
  const bw = Math.round(4 * u), bh = Math.round(13 * u);
  const cy = b.y + Math.round((b.h - bh) / 2);
  g.fillRect(b.x + Math.round(b.w / 2 - 6 * u), cy, bw, bh);
  g.fillRect(b.x + Math.round(b.w / 2 + 2 * u), cy, bw, bh);
  g.restore();
}

// ---------- La pantalla de pausa ----------
// Las dos opciones se calculan en UN solo sitio y de ahi salen tanto el dibujo
// como el acierto del toque. Un cartel y un area tocable calculados por
// separado acaban desalineados en cuanto uno de los dos cambia, y el sintoma
// (un boton que se ve pero no responde) es de los que no se notan probando.
//
// EL SUBTITULO CORRE LAS OPCIONES HACIA ABAJO, y no es un retoque de gusto: con
// la linea 'TU PARTIDA TE ESPERA' puesta, el hueco entre el titulo y 'SEGUIR'
// (10 px virtuales) no daba para una linea de 7 px, y las dos se MONTABAN una
// sobre otra. Medido reproduciendo la aritmetica de este archivo, el solape era
// de 3 px virtuales en los dos formatos de u=1 y de 6 en 540x1200: en los TRES.
// Y salia justo en la pausa mas frecuente, la de volver a la app.
//
// Por eso `sub` entra como parametro y no se decide aqui dentro: las posiciones
// las tienen que ver iguales el dibujo Y el acierto del toque, que es lo que el
// parrafo de arriba exige. Si opciones() adivinara el subtitulo por su cuenta,
// opcionEn() tendria que adivinarlo igual y a la primera que uno de los dos
// cambiara, el cartel y su area tocable quedarian desalineados.
function opciones(VW, VH, sub) {
  const u = unidad(VW, VH);
  // La escala de la fuente tiene que ser ENTERA o los trazos salen desiguales
  // (font.js:120). Por eso aqui se duplica en 540x1200 y no se interpola.
  const e = u > 1.5 ? 2 : 1;
  // La fuente mide 7 px de alto por unidad de escala (font.js:65).
  const alto = 7 * 3 * e;
  const sep = Math.round(16 * u);
  // Lo que baja todo cuando hay subtitulo: su alto (7*e) mas un respiro igual
  // al que ya separa el titulo de 'SEGUIR'. Sin subtitulo suma cero y las dos
  // opciones quedan EXACTAMENTE donde estaban.
  const bajada = sub ? 7 * e + Math.round(8 * u) : 0;
  // Se apilan bajo el titulo. textCenter recibe el BORDE SUPERIOR (font.js:146).
  const y0 = Math.round(VH / 2 + 4 * u) + bajada;
  return [
    { txt: 'SEGUIR',  y: y0,                 esc: 3 * e, alto, col: '#5cffd8', accion: 'seguir' },
    { txt: 'AL MENU', y: y0 + alto + sep,    esc: 3 * e, alto, col: '#ff5c9d', accion: 'menu' },
  ];
}

// Que opcion cae bajo un toque, o null.
function opcionEn(x, y, VW, VH, sub) {
  const u = unidad(VW, VH);
  for (const o of opciones(VW, VH, sub)) {
    const w = measure(o.txt, o.esc);
    // A lo ancho se es generoso -- toda la franja central vale, no solo las
    // letras -- pero a lo alto NO, o las dos opciones se solapan y elegir
    // 'SEGUIR' mandaria al menu, que es el error que mas duele: pierde la
    // partida. El margen de arriba y abajo es medio hueco entre las dos.
    const mx = w / 2 + 24 * u;
    const my = 8 * u;
    if (y >= o.y - my && y <= o.y + o.alto + my && Math.abs(x - VW / 2) <= mx) return o.accion;
  }
  return null;
}

// La linea que solo sale al volver de fuera. Vive aqui arriba y no dentro del
// dibujo porque tres sitios la necesitan: el dibujo, el ancho del panel y --
// via subtitulo(motivo) -- la colocacion de las opciones.
const SUB = 'TU PARTIDA TE ESPERA';

// Hay subtitulo unicamente cuando la pausa la puso el SISTEMA. Una sola
// funcion, para que el dibujo y el acierto del toque no puedan discrepar.
export function subtitulo(motivo) { return motivo === 'sistema' ? SUB : null; }

// ---------- Lo que main.js enchufa en Pausa.dibujar ----------
export function drawPantalla(g, VW, VH, motivo) {
  const u = unidad(VW, VH);
  const e = u > 1.5 ? 2 : 1;
  const sub = subtitulo(motivo);
  g.save();
  // Velo oscuro pero no opaco: la partida se sigue viendo detras y asi ella
  // entiende que sigue ahi, quieta, esperandola.
  g.fillStyle = 'rgba(6,3,16,0.72)';
  g.fillRect(0, 0, VW, VH);

  const cx = VW / 2;
  const ops = opciones(VW, VH, sub);
  // Panel opaco detras del texto. NO es adorno: los juegos escriben en mitad de
  // la pantalla (SURVIVAL pone ahi el rotulo de la ola, survival.js:1772) y sin
  // el las lineas se montan unas sobre otras y no se lee ninguna.
  //
  // La caja sale de measure(), no a ojo: el lienzo apaisado tiene 600 de ancho
  // y el vertical 270, y un tamano fijo que quepa en uno se sale del otro.
  const hTit = 7 * 4 * e;
  // El subtitulo entra en la cuenta del ancho: son 20 caracteres, que a escala
  // 2 miden 238 px virtuales -- mas que 'PAUSA' a escala 8 (190). Sin contarlo,
  // el panel le quedaria estrecho y la linea se saldria por los dos lados.
  const anchos = [measure('PAUSA', 4 * e), ...ops.map(o => measure(o.txt, o.esc))];
  if (sub) anchos.push(measure(sub, e));
  const pw = Math.min(VW - 12 * u, Math.max(...anchos) + 36 * u);
  const yTit = Math.round(VH / 2 - 34 * u);
  const py = yTit - Math.round(14 * u);
  const ph = (ops[ops.length - 1].y + ops[ops.length - 1].alto) - py + Math.round(14 * u);
  const px = Math.round(cx - pw / 2);
  g.fillStyle = 'rgba(13,6,32,0.95)';
  g.fillRect(px, py, pw, ph);
  g.strokeStyle = '#5a4a88'; g.lineWidth = Math.max(1, Math.round(u));
  g.strokeRect(px + 0.5 * u, py + 0.5 * u, pw - u, ph - u);

  textCenter(g, 'PAUSA', cx, yTit, '#ffffff', 4 * e);
  if (sub) {
    // Al volver de fuera ella NO pidio la pausa: hay que decirle por que esta
    // ahi, o parece que el juego se colgo mientras no miraba.
    //
    // Va CENTRADA en el hueco que opciones() abrio al pasarle `sub`, no pegada
    // al titulo: asi queda a la misma distancia del titulo y de 'SEGUIR', y no
    // vuelve a montarse encima de ninguno de los dos.
    const finTit = yTit + hTit;
    textCenter(g, sub, cx, Math.round((finTit + ops[0].y - 7 * e) / 2), '#8a7ab8', e);
  }
  for (const o of ops) textCenter(g, o.txt, cx, o.y, o.col, o.esc);
  g.restore();
}

// ---------- Lo que main.js enchufa en Pausa.onInput ----------
// Devuelve 'seguir', 'menu' o null. Quien llama decide que hacer: esta pieza no
// conoce el gestor de escenas.
//
// SE RESUELVE CON EL 'up', NO CON EL 'down'. Dos motivos, los dos medidos en
// los juegos que ya existen:
//
//  - Reanudando en el 'down', ese mismo dedo se queda apoyado encima de lo que
//    haya debajo -- el boton de disparo de SURVIVAL, la cruceta, el acelerador
//    de FURIA -- y la partida arranca con un control apretado que ella no
//    pidio. Soltando, el 'up' que reanuda no lo ve nadie.
//
//  - Es el mismo cuidado que main.js ya documenta para el aviso de girar
//    (main.js, initInput): con la pausa puesta no pasa nada al juego, PERO un
//    dedo que ya estaba apoyado cuando entro la pausa tiene que poder soltarse.
//    Aqui ese peligro no existe porque el juego no recibe NADA mientras hay
//    pausa; el que se come el 'up' es este menu, y por eso se exige que el
//    'down' haya caido tambien dentro de la misma opcion: un dedo que venia de
//    antes levanta un 'up' suelto sin 'down' propio, y ese no debe elegir nada.
let abajoEn = null, abajoId = -1;

// `motivo` entra porque con subtitulo las opciones estan mas abajo (ver
// opciones()). Si aqui no se supiera, el area tocable se quedaria donde el
// cartel YA no esta: 'SEGUIR' se veria dibujado y no responderia, y peor aun,
// tocarlo caeria en el hueco de arriba. Es justo el desajuste contra el que
// avisa el comentario de opciones().
export function onInputPantalla(ev, VW, VH, motivo) {
  const sub = subtitulo(motivo);
  if (ev.type === 'down') {
    abajoEn = opcionEn(ev.x, ev.y, VW, VH, sub);
    abajoId = ev.id;
    return null;
  }
  if (ev.type === 'up' || ev.type === 'cancel') {
    const mio = (ev.id === abajoId) ? abajoEn : null;
    abajoEn = null; abajoId = -1;
    if (!mio) return null;
    // Tiene que soltar DENTRO de la misma opcion en la que apoyo: asi puede
    // arrepentirse arrastrando el dedo fuera, como en cualquier boton.
    return opcionEn(ev.x, ev.y, VW, VH, sub) === mio ? mio : null;
  }
  return null;
}

// Se llama al entrar y al salir de la pausa: si no, un 'down' a medias
// sobrevive de una pausa a la siguiente y el primer 'up' elige solo.
export function olvidaToques() { abajoEn = null; abajoId = -1; }
