// ROMINA'S ARCADE — arranque, bucle de tiempo fijo, gestor de escenas y menu.
import { VW, VH, BASE_VW, BASE_VH, MENU_VW, MENU_VH, setVirtual, setSmooth, setSupersample, baseTransform, requestOrientation, giroNativo, isLandscape, initCanvas, view, makeRng, Save, cam, MENSAJES_RECORD } from './core.js';
import { initInput, pointers, toques } from './input.js';
import { initAudio, unlockAudio, SFX, toggleMute, suspendAudio, resumeAudio, playMusic, stopMusic, SONGS, currentSong } from './audio.js';
import { text, textCenter, measure } from './font.js';
import { particles, updateParticles, drawParticles } from './gfx.js';
import { GAMES } from './games.js';
import { Menu } from './menu.js';
import { drawBoton, tocaBoton, drawPantalla, onInputPantalla, olvidaToques } from './pausa.js';
import { iniciaUpdate, latido } from './update.js';

let g = null;
const rnd = makeRng(0x1234abcd);

// ---------- PAUSA ----------
// Un solo interruptor para toda la app. Lo enciende el sistema (ella salio de
// la app) y lo apaga ella al tocar para seguir; la pieza del boton de pausa
// usa este mismo interruptor, para que no haya dos pausas distintas que puedan
// contradecirse.
//
// `motivo` dice quien pauso: 'sistema' (se fue de la app) o 'usuario' (toco el
// boton). Importa para la musica: al volver de fuera el AudioContext esta
// suspendido y NO se reanuda hasta que ella decida seguir, o la cancion
// arrancaria sola encima de una pantalla quieta.
export const Pausa = {
  activa: false,
  motivo: null,
  entrar(motivo) {
    if (this.activa) return;
    this.activa = true; this.motivo = motivo || 'usuario';
    suspendAudio();
  },
  salir() {
    if (!this.activa) return;
    this.activa = false; this.motivo = null;
    // El acumulador se limpia AQUI tambien, no solo al volver a ser visible: si
    // ella dejo la pausa puesta un rato mirando la pantalla, el bucle siguio
    // dibujando y acc pudo quedar con un resto. Sin esto, el primer frame de
    // vuelta simularia ese resto de golpe.
    prev = performance.now(); acc = 0;
    resumeAudio();
  },
};

// ---------- La pantalla de pausa y su boton (pausa.js) ----------
// Se enchufan en los dos huecos que Pausa deja: con esto puestos, el cartel
// generico de mas abajo no se usa nunca, y el interruptor sigue siendo UNO.
//
// Se registran aqui, junto al interruptor, y no dentro de pausa.js: asi
// pausa.js no importa nada de main.js y no hay un ciclo entre los dos modulos.
// ---------- Soltarle al juego los dedos que tenia apoyados ----------
// EL FALLO QUE ESTO EVITA, que es el mismo que main.js ya documenta para el
// aviso de girar. Mientras hay pausa el juego no recibe NADA, ni siquiera los
// 'up'. Asi que un dedo que estaba apretando el disparo cuando entra la pausa
// nunca recibe su 'up': SURVIVAL guarda this.fireId y this.firing = true
// (survival.js:1180) y solo los limpia con el 'up' de ESE id, que ya no va a
// llegar. Al seguir, Roma dispara sola para siempre y el boton no responde.
// Lo mismo con la cruceta (padId), con el acelerador de FURIA (rightId,
// furia.js:377) y con el stick de LAST WAVE y NEON FIST.
//
// La cura es avisar de la soltada ANTES de cerrar la puerta: a cada dedo que
// input.js tenga vivo (input.js:5) se le manda un 'up' en su ultima posicion
// conocida, que es exactamente lo que el juego habria recibido si ella hubiera
// levantado la mano. Se manda antes de poner Pausa.activa, para que el evento
// llegue por la via normal.
function soltarDedos() {
  if (!sm.cur || !sm.cur.onInput) return;
  for (const [id, p] of pointers) {
    sm.cur.onInput({ type: 'up', x: p.x, y: p.y, id }, ctx);
  }
}

// ---------- La pantalla de pausa y su boton (pausa.js) ----------
// Se enchufan en los dos huecos que Pausa deja: con esto puestos, el cartel
// generico de mas abajo no se usa nunca, y el interruptor sigue siendo UNO.
//
// Se registran aqui, junto al interruptor, y no dentro de pausa.js: asi
// pausa.js no importa nada de main.js y no hay un ciclo entre los dos modulos.
//
// `antes` se encadena en vez de sustituirse: Pausa.entrar es de la pieza de la
// pausa automatica y hace su trabajo (suspender el audio); esto solo le suma
// soltar los dedos, y solo cuando lo que se pausa es un juego.
const _entrar = Pausa.entrar;
Pausa.entrar = function (motivo) {
  if (this.activa) return;
  if (esJuego(sm.cur)) soltarDedos();
  olvidaToques();
  _entrar.call(this, motivo);
};

Pausa.dibujar = gg => drawPantalla(gg, VW, VH, Pausa.motivo);
Pausa.onInput = (ev, c) => {
  // El motivo viaja hasta pausa.js porque cambia LA COLOCACION de las opciones:
  // con el subtitulo de 'sistema' puesto, SEGUIR y AL MENU bajan para no
  // montarse con el. El dibujo y el acierto del toque tienen que ver la misma
  // posicion, asi que los dos reciben el mismo motivo.
  const accion = onInputPantalla(ev, VW, VH, Pausa.motivo);
  if (accion === 'seguir') {
    // Primero salir y luego el sonido: salir() reanuda el AudioContext, y un
    // blip disparado con el contexto todavia suspendido se programa para un
    // instante ya pasado y no se oye.
    Pausa.salir(); olvidaToques(); SFX.blip();
  } else if (accion === 'menu') {
    Pausa.salir(); olvidaToques(); SFX.select();
    c.toMenu();
  }
};

// ---------- Gestor de escenas con cambio diferido ----------
const sm = {
  cur: null, next: null, nextArgs: null,
  go(scene, args) { this.next = scene; this.nextArgs = args || {}; },
  flush() {
    if (!this.next) return;
    if (this.cur && this.cur.destroy) this.cur.destroy();
    particles.clear(); cam.reset();
    this.cur = this.next; this.next = null;
    // La resolucion se fija ANTES de init(): los juegos hornean sprites y
    // calculan posiciones contra VW/VH, asi que deben leer ya el valor nuevo.
    const m = this.cur.meta;
    // El filtrado se elige ANTES de setVirtual: asignar canvas.width resetea el
    // contexto, y setVirtual reaplica el modo que se haya dejado puesto aqui.
    setSmooth(!!m.smooth);
    // Cuantas veces mas grande es el lienzo real que el virtual. Va con el
    // filtrado, y por el mismo motivo: setVirtual reaplica lo que se deje puesto
    // aqui. Lo piden los juegos que quieren mas detalle del que cabe en el
    // lienzo virtual, y cuesta el cuadruple de relleno.
    //
    // NO va atado a meta.smooth. Lo estuvo, y era un error: un juego de PIXEL
    // ART tambien lo quiere, porque le deja dibujar sprites con el doble de
    // celdas sin agrandarlos en pantalla. Atado, un juego nitido que pidiera
    // ss:2 lo recibia como 1 y todo su arte salia al doble de tamano.
    setSupersample(m.ss || 1);
    // meta.wide = escena apaisada (el menu y el fin de partida). Sin el, es un
    // juego y va vertical. Se le pide el giro al telefono ANTES de fijar la
    // resolucion, para que el navegador ya este girando cuando el juego mida.
    const wide = !!m.wide;
    requestOrientation(wide);
    setVirtual(m.vw || (wide ? MENU_VW : BASE_VW), m.vh || (wide ? MENU_VH : BASE_VH));
    if (this.cur.init) this.cur.init(ctx, this.nextArgs);
    // Los juegos que sabian recolocarse al girar lo siguen haciendo una vez, al
    // entrar: ahora su lienzo ya no cambia de forma en toda la partida.
    if (this.cur.onResize) this.cur.onResize();
    // La musica vive en la capa compartida: cada juego solo declara su cancion.
    const song = SONGS[this.cur.meta.id];
    if (song) playMusic(song); else stopMusic();
  },
};

// Contexto compartido que recibe cada juego.
const ctx = {
  // Getters, no copias: con resolucion variable un valor copiado al arrancar
  // se quedaria en 270x600 aunque el juego activo pida 540x1200.
  get VW() { return VW; },
  get VH() { return VH; },
  rnd,
  gameOver(score) {
    const m = sm.cur.meta;
    const isRecord = Save.submit(m.id, Math.floor(score));
    // La pantalla de fin de partida SE QUEDA EN LA ORIENTACION DEL JUEGO. Antes
    // era siempre apaisada, y al morir en uno de los cinco juegos verticales el
    // telefono giraba solo para ensenar el puntaje y volvia a girar al empezar
    // otra partida: dos rotaciones, con sus dos animaciones, entre una partida y
    // la siguiente. Ahora hereda el formato del juego del que viene y no gira
    // nadie. Se copia tambien la resolucion para que el lienzo no cambie de
    // forma al morir.
    GameOver.meta.wide = !!m.wide;
    GameOver.meta.vw = m.vw || (m.wide ? MENU_VW : BASE_VW);
    GameOver.meta.vh = m.vh || (m.wide ? MENU_VH : BASE_VH);
    sm.go(GameOver, { id: m.id, score: Math.floor(score), isRecord, title: m.title });
  },
  toMenu() { sm.go(Menu, {}); },
  // La pausa se comparte con los juegos: la pieza del boton de pausa la
  // enciende desde aqui, para que no haya dos pausas distintas.
  pausa: Pausa,
};

// ---------- Escena: MENU ----------
// Vive en menu.js (la estanteria de caratulas). Aqui solo se le dice a donde
// ir cuando el usuario elige un juego: el menu no conoce el gestor de escenas.
Menu.onLaunch = G => sm.go(G, { seed: (Math.random() * 0xffffffff) >>> 0 });

// ---------- Escena: GAME OVER ----------
// HEREDA LA ORIENTACION DEL JUEGO DEL QUE VIENE, y ese es el detalle que la
// hace no molestar. Antes era siempre apaisada, asi que al morir en cualquiera
// de los cinco juegos verticales el telefono GIRABA solo para ensenar el
// puntaje, y volvia a girar al entrar de nuevo a jugar: dos rotaciones entre
// una partida y la siguiente, cada una con su animacion del sistema.
//
// Ahora se queda como estaba el juego. La unica que sigue siendo apaisada de
// verdad es la que viene de SURVIVAL o del menu, que ya lo eran.
//
// El dibujado no puede llevar coordenadas fijas, entonces: las mismas lineas
// tienen que caber en 600x270 y en 270x600. Se colocan como fracciones de VH y
// la escala del puntaje se elige segun el ancho que haya.
const GameOver = {
  meta: { id: '_over', title: 'FIN', wide: true, vw: 600, vh: 270 },
  init(c, a) {
    this.score = a.score; this.isRecord = a.isRecord; this.gameId = a.id; this.title = a.title;
    this.t = 0; this.canTap = false;
    if (a.isRecord) SFX.record(); else SFX.gameover();
    this.msg = a.isRecord ? RECORD_MSGS[(Math.random() * RECORD_MSGS.length) | 0] : null;
  },
  update(dt) { this.t += dt; if (this.t > 0.55) this.canTap = true; },
  draw(g) {
    g.fillStyle = '#0d0620'; g.fillRect(0, 0, VW, VH);
    const cx = VW / 2;
    // Todo se coloca en fracciones de la altura, no en pixeles fijos: esta
    // pantalla sale tanto apaisada (600x270) como de pie (270x600).
    const y = f => Math.round(VH * f);
    // El puntaje es lo que ella mira, asi que se lleva todo el tamano que quepa.
    // A 7 ocupa 7*6-1 = 41 px por cifra: en un lienzo de 270 de ancho, cinco
    // cifras se saldrian. Se elige la escala mas grande que entre.
    const cifras = String(this.score).length;
    const esc = Math.max(3, Math.min(7, Math.floor((VW - 24) / (cifras * 6))));
    textCenter(g, this.title, cx, y(0.10), '#5a4a88', 2);
    if (this.isRecord) {
      const f = Math.sin(this.t * 8) > 0 ? '#ffe14d' : '#ff5c9d';
      textCenter(g, 'RECORD NUEVO!', cx, y(0.19), f, VW < 400 ? 2 : 3);
    } else {
      textCenter(g, 'FIN DEL JUEGO', cx, y(0.19), '#ff5c9d', VW < 400 ? 2 : 3);
    }
    textCenter(g, String(this.score), cx, y(0.31), '#ffffff', esc);
    textCenter(g, 'MEJOR ' + Save.best(this.gameId), cx, y(0.56), '#8a7ab8', 2);
    if (this.msg) {
      // Mensaje carinoso, solo al romper record.
      textCenter(g, this.msg[0], cx, y(0.66), '#5cffd8', 2);
      if (this.msg[1]) textCenter(g, this.msg[1], cx, y(0.73), '#5cffd8', 2);
    }
    if (this.canTap && Math.sin(this.t * 4) > -0.3) {
      textCenter(g, 'TOCA PARA JUGAR', cx, VH - 44, '#ffffff', 2);
      textCenter(g, 'MANTEN PARA MENU', cx, VH - 24, '#5a4a88', 2);
    }
  },
  onInput(ev) {
    if (!this.canTap) return;
    if (ev.type === 'down') { this.holdT = 0; this.holding = true; }
    if (ev.type === 'up' && this.holding) {
      this.holding = false;
      const G = GAMES.find(x => x.meta.id === this.gameId);
      if (this.holdT > 0.45) { SFX.blip(); sm.go(Menu, {}); }
      else { SFX.select(); sm.go(G, { seed: (Math.random() * 0xffffffff) >>> 0 }); }
    }
  },
};

// Mensajitos al romper record: viven en core.js (MENSAJES_RECORD) para que los
// juegos con su propio final, como ROMINA, digan los mismos.
const RECORD_MSGS = MENSAJES_RECORD;

// Los juegos necesitan medir el hold en game over.
const _goUpdate = GameOver.update;
GameOver.update = function (dt) { _goUpdate.call(this, dt); if (this.holding) this.holdT = (this.holdT || 0) + dt; };


// Una escena es un JUEGO si esta en el registro de juegos. NO sirve meta.wide:
// SURVIVAL es apaisado y es un juego (survival.js:73), asi que ese flag habla
// de la FORMA del lienzo, no de si hay una partida en marcha.
//
// Solo los juegos se pausan. El menu y el fin de partida no: ahi no hay nada
// que perder, y encontrarse una pausa encima de una pantalla que ya estaba
// quieta seria solo un toque de mas. Ademas el fin de partida activa su 'toca
// para jugar' desde update(): pausado, se quedaria muerto sin salida.
function esJuego(scene) {
  return !!scene && GAMES.indexOf(scene) !== -1;
}

// ---------- Bucle de tiempo fijo ----------
const STEP = 1000 / 60, MAX_STEPS = 5, MAX_FRAME = 250;
let acc = 0, prev = 0, raf = 0, frameNo = 0;

function frame(now) {
  raf = requestAnimationFrame(frame);      // primero: el bucle sobrevive a una excepcion
  frameNo++;
  let dt = now - prev; prev = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;      // absorbe pausas (background, GC, MIUI)
  // Al reanudar (salir de pausa, volver al primer plano) `prev` se pone con
  // performance.now(), pero el `now` que trae el primer rAF suele ser ANTERIOR
  // a ese instante: dt sale negativo, el acumulador queda por debajo de cero y
  // el alpha de interpolacion tambien, o sea que ese frame se dibuja todo un
  // pelo hacia ATRAS. Es un tiron justo al reanudar. Un frame de cero dt es lo
  // correcto ahi: no ha pasado tiempo de juego.
  if (dt < 0) dt = 0;
  acc += dt;
  let n = 0;
  const s = STEP / 1000;
  // Con el telefono en la orientacion equivocada el JUEGO se pausa: si siguiera
  // corriendo, ella perderia la partida mientras gira el aparato.
  //
  // Las pantallas de interfaz (menu y fin de partida) NO se pausan nunca. Si se
  // pausaran y el bloqueo de orientacion fallara -- MIUI lo rechaza a veces, y
  // basta con que ella tenga el giro bloqueado en ajustes -- el fin de partida
  // se quedaria congelado para siempre: su 'toca para jugar' se activa desde
  // update(), asi que ni jugar ni volver al menu funcionarian. La app quedaria
  // muerta sin forma de salir.
  // Con el puente nativo esto es SIEMPRE false: el sistema gira solo, no hay
  // nada que esperar ni que avisar. Ver avisoDeGiro().
  const girando = avisoDeGiro();
  // La pausa de verdad (ella salio de la app, o toco el boton) se suma a la del
  // giro. Se comprueba DESPUES de sm.flush() mas abajo? No: aqui, porque el
  // valor tiene que ser el mismo para todo el frame, igual que `girando`.
  const pausa = (girando && !(sm.cur && sm.cur.meta.wide)) || Pausa.activa;
  while (acc >= STEP && n < MAX_STEPS) {
    sm.flush();
    if (!pausa) {
      if (sm.cur && sm.cur.update) sm.cur.update(s, ctx);
      updateParticles(s);
      cam.update(s, rnd);
    }
    acc -= STEP; n++;
  }
  if (n === MAX_STEPS && acc > STEP) acc = 0;   // corta la espiral de la muerte

  // ---------- ALPHA DE RENDER ----------
  // Cuanto de un paso de simulacion ha pasado YA pero todavia no se ha
  // simulado, de 0 a 1. La escena que sepa interpolar dibuja en
  // pos_anterior + (pos - pos_anterior) * alpha, y asi cada frame de pantalla
  // ensena una posicion distinta aunque no le toque simular.
  //
  // POR QUE HACE FALTA. La simulacion va a 60 pasos por segundo y la pantalla
  // de un telefono moderno de gama media va a 90 o 120. Sin interpolar, el
  // bucle dibuja SIEMPRE el ultimo estado simulado, asi que a 120 Hz la mitad
  // de los frames son una copia identica del anterior. Simulando este mismo
  // bucle paso a paso:
  //
  //     60 Hz     0/599 frames repetidos =  0.0%
  //     90 Hz   200/599 frames repetidos = 33.4%
  //    120 Hz   299/599 frames repetidos = 49.9%
  //    144 Hz   350/599 frames repetidos = 58.4%
  //
  // Y el salto no es pequeno: a la escala real del telefono (1080x2340
  // apaisado sobre el lienzo de 600x270 = x3.90) Roma avanza 12.35 px FISICOS
  // de golpe y una bala 21.45.
  //
  // Midiendo el bucle REAL con el movimiento REAL de Roma, contando frames
  // repetidos y la desviacion del avance entre frame y frame de pantalla:
  //
  //              repetidos        desviacion del avance (px fisicos)
  //     90 Hz    53/159 -> 0/159        5.82 -> 0.32
  //    120 Hz    79/159 -> 1/159        6.17 -> 0.49
  //    144 Hz    93/159 -> 1/159        6.08 -> 0.44
  //
  // Doce veces mas parejo a 120 Hz, y el salto maximo por frame baja de 12.35
  // px fisicos a 6.17. Lo que cuesta son dos restas y dos multiplicaciones por
  // entidad: 0.00012 ms por frame de los 16.67, medido con 107 entidades.
  //
  // NO se sube la simulacion al refresco de la pantalla, que era la otra
  // forma de arreglarlo. Seria mas suave sobre el papel (desviacion 0), pero
  // cambia LA PARTIDA: la colision bala-enemigo es puntual, asi que al doble de
  // pasos se comprueba el doble de veces y entran impactos que a 60 Hz se
  // colaban de largo -- medido, un 1.25% mas de aciertos a 120 Hz. Y el azar
  // se consume por paso: 7200 tiradas en un minuto en vez de 3600, o sea otra
  // partida con la misma semilla. El telefono de 120 Hz tendria un juego mas
  // facil y sus records no serian comparables con los de 60. Interpolar no
  // toca la simulacion: la partida es la misma en los dos, solo se ve mejor.
  //
  // El alpha se pasa como TERCER argumento, detras de ctx, y las escenas que
  // no lo usan lo ignoran: las cinco que no interpolan siguen recibiendo
  // exactamente los mismos dos argumentos de siempre.
  //
  // Con el juego en pausa (girando el telefono) el alpha se fija en 1: si
  // siguiera avanzando con el acumulador, lo dibujado seguiria deslizandose
  // hacia una posicion futura que nadie va a simular.
  const alpha = pausa ? 1 : acc / STEP;

  // El transform base se reaplica cada frame: lleva el sobremuestreo, y la
  // camara hace translate() ENCIMA de el. Sin esto, el temblor se acumularia.
  baseTransform();
  g.save();
  if (cam.x || cam.y) g.translate(cam.x, cam.y);
  if (sm.cur && sm.cur.draw) sm.cur.draw(g, ctx, alpha);
  drawParticles(g);
  g.restore();

  // El boton de pausa, encima de la escena y de sus particulas -- y por tanto
  // tambien encima del bloom de SURVIVAL, que se aplica dentro de su draw
  // (survival.js:1274) -- pero DEBAJO del cartel de pausa y del aviso de girar.
  //
  // Se dibuja fuera del save/restore de la camara a proposito: con el temblor
  // de pantalla puesto, un boton fijo que de pronto se sacude parece un fallo.
  // El HUD de los juegos si tiembla, porque lo pintan ellos dentro de su draw;
  // este no, y es lo que se quiere.
  if (esJuego(sm.cur) && !Pausa.activa && !girando) drawBoton(g, VW, VH, sm.cur.meta);

  drawPausa(g);
  drawRotateHint(g);
  // Un fotograma entero sin excepcion: la version que corre demuestra que va
  // (ver latido() en update.js). Va al final a proposito: si update o draw
  // revientan, no se llega aqui y no cuenta.
  latido();
}

// ---------- Pantalla de pausa ----------
// Se dibuja ENCIMA de la escena, sin borrarla: ella ve el juego quieto detras y
// entiende que sigue ahi, esperandola.
//
// Va DEBAJO del aviso de girar en el orden de dibujo: si las dos cosas pasan a
// la vez (vuelve a la app con el telefono mal puesto), lo primero que tiene que
// hacer es girar, no tocar.
//
// Si la pieza del boton de pausa trae su propia pantalla, la pone en
// Pausa.dibujar y esta no se usa. Asi no hay dos carteles distintos.
function drawPausa(gg) {
  if (!Pausa.activa) return;
  if (Pausa.dibujar) { Pausa.dibujar(gg); return; }
  gg.save();
  // Velo oscuro pero no opaco: la partida detras se sigue viendo, y asi ella
  // entiende que sigue ahi esperandola. Medido sobre SURVIVAL, el brillo medio
  // del lienzo baja de 26.6 a 13.2: a la mitad, que es bastante para que se lea
  // el cartel y poco para que el juego desaparezca.
  gg.fillStyle = 'rgba(6,3,16,0.72)';
  gg.fillRect(0, 0, VW, VH);
  const cx = VW / 2, cy = VH / 2;

  // Panel opaco detras del texto. NO es adorno: los juegos escriben en mitad de
  // la pantalla (SURVIVAL pone ahi el rotulo de la ola) y sin el, las dos
  // lineas se montan una encima de otra y no se lee ninguna. El panel tapa esa
  // franja entera.
  //
  // Las medidas salen de measure(), no a ojo: el lienzo del menu tiene 600 de
  // ancho y el de un juego vertical 270, y un ancho fijo que quepa en uno se
  // sale del otro.
  // La caja se calcula desde las medidas REALES de la fuente, no a ojo: el
  // lienzo del menu tiene 600 de ancho y el de un juego vertical solo 270, y un
  // tamano fijo que quepa en uno se sale del otro. La fuente es de 7 px de alto
  // por escala (font.js:65), asi que las dos lineas ocupan 21 y 14.
  const H1 = 7 * 3, H2 = 7 * 2, HUECO = 8;
  const w1 = measure('PAUSA', 3), w2 = measure('TOCA PARA SEGUIR', 2);
  const pw = Math.min(VW - 12, Math.max(w1, w2) + 28);
  const ph = H1 + HUECO + H2 + 28;
  const px = Math.round(cx - pw / 2), py = Math.round(cy - ph / 2);
  gg.fillStyle = 'rgba(13,6,32,0.95)';
  gg.fillRect(px, py, pw, ph);
  gg.strokeStyle = '#5a4a88'; gg.lineWidth = 1;
  gg.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  // Las dos lineas se apilan desde arriba del panel: textCenter recibe el BORDE
  // SUPERIOR del texto (font.js:121), no su centro.
  const y1 = py + 14;
  textCenter(gg, 'PAUSA', cx, y1, '#ffffff', 3);
  // Parpadeo con el reloj REAL, no con un contador: aqui no hay update() que
  // avance, justamente porque esto es la pausa.
  if (Math.sin(performance.now() / 1000 * 3) > -0.3) {
    textCenter(gg, 'TOCA PARA SEGUIR', cx, y1 + H1 + HUECO, '#5cffd8', 2);
  }
  gg.restore();
}

// ---------- Aviso de girar el telefono ----------
// La app pide el giro por software y desde el APK lo consigue SIEMPRE: el
// puente nativo llama a setRequestedOrientation(), que manda sobre el ajuste de
// giro del usuario. Con el puente puesto este aviso no deberia verse nunca.
//
// PERO SE QUEDA, y no por si acaso: es la red de seguridad que main.js ya
// documentaba. Sin puente -- el navegador de escritorio, o un APK antiguo --
// screen.orientation.lock() se rechaza y la escena se ve de lado; sin este
// aviso no hay ninguna pista de que hacer. Borrarlo seria cambiar un fallo
// visible y con instrucciones por uno mudo.
//
// LO QUE SI CAMBIA es cuanto se espera antes de ensenarlo. Con el puente, el
// giro no lo hace ella: lo hace el sistema, y tarda. Entre que la escena pide
// apaisado y que el WebView se ha redimensionado hay una animacion de rotacion
// de la ventana, y durante ese rato la orientacion real NO coincide con la que
// la escena quiere -- que es exactamente la condicion que dispara el aviso.
// Con el medio segundo de siempre, el cartel "GIRA EL TELEFONO" parpadearia en
// cada entrada y salida de SURVIVAL justo mientras el telefono esta girando
// solo, que es el peor momento posible para pedirle a ella que lo gire.
//
// Asi que con puente la espera sube a 1.6 s, holgado por encima de lo que tarda
// una rotacion de ventana en un Note 10 (la animacion del sistema ronda los
// 300-500 ms, y el WebView redimensiona detras). Si a los 1.6 s sigue sin
// cuadrar es que el giro de verdad no ocurrio, y entonces el aviso hace falta.
const ESPERA_AVISO_WEB = 0.5;      // sin puente: lo tiene que girar ella, no hay nada que esperar
const ESPERA_AVISO_NATIVO = 1.6;   // con puente: se le da tiempo al sistema a girar solo
let mismatchT = 0;

// True cuando la orientacion real no es la que la escena necesita, y ya lleva
// asi el tiempo de gracia. La cuenta se lleva aqui, no en el dibujo, para que
// la pausa y el aviso entren y salgan exactamente a la vez.
//
// Se evalua UNA vez por frame y se cachea: la llaman el bucle (para pausar) y
// el dibujo (para el aviso), y si cada llamada sumara al contador, la espera se
// cumpliria al doble de velocidad.
let mmFrame = -1, mmVal = false, mmPrev = 0;

function orientationMismatch() {
  if (mmFrame === frameNo) return mmVal;
  mmFrame = frameNo;
  const m = sm.cur && sm.cur.meta;
  if (!m) { mmVal = false; return false; }
  if (!!m.wide === isLandscape()) {
    mismatchT = 0; mmPrev = 0; mmVal = false; return false;
  }
  // Se cuenta en segundos REALES, no en pasos de 1/60: el Note 10 puede ir a
  // 90 Hz, y sumando un sesentavo por frame el tiempo de gracia se cumpliria en
  // un tercio del tiempo, que es justo el parpadeo que la espera existe para
  // evitar.
  const ahora = performance.now();
  mismatchT += Math.min(0.25, (ahora - (mmPrev || ahora)) / 1000);
  mmPrev = ahora;
  // Con el puente nativo el giro lo hace el SISTEMA y tarda: hay que dejarle
  // terminar su animacion de rotacion antes de decidir que no ocurrio. Ver la
  // nota de arriba sobre las dos esperas.
  mmVal = mismatchT >= (giroNativo() ? ESPERA_AVISO_NATIVO : ESPERA_AVISO_WEB);
  return mmVal;
}

// ---------- Si hay que molestarla pidiendole que gire el telefono ----------
//
// CON PUENTE NATIVO, NUNCA. El puente llama a setRequestedOrientation() en cada
// cambio de escena, asi que cada pantalla se pone sola en su orientacion sin
// importar como este el telefono: el menu y SURVIVAL de lado, los otros cinco
// juegos de pie. Pedirle que gire seria pedirle que arregle algo que el sistema
// ya esta arreglando, y el cartel solo podia salir mientras la ventana giraba,
// que es el peor momento para taparle la pantalla.
//
// SIN PUENTE (el navegador de escritorio, o un APK viejo) el aviso se queda:
// ahi screen.orientation.lock() no manda sobre nadie y la unica forma de ver la
// escena derecha es que la gire ella. Es la red de seguridad que documenta el
// comentario de la pausa mas arriba: sin ella, con el lock rechazado, el fin de
// partida se quedaria congelado y la app no tendria salida.
function avisoDeGiro() {
  return !giroNativo() && orientationMismatch();
}

function drawRotateHint(gg) {
  if (!avisoDeGiro()) return;
  const quiere = !!sm.cur.meta.wide;              // true = apaisada
  gg.save();

  // El canvas esta girado respecto al telefono, asi que el aviso se dibuja
  // sobre el lienzo tal cual: es lo unico que se ve derecho al girarlo.
  gg.fillStyle = 'rgba(6,3,16,0.86)';
  gg.fillRect(0, 0, VW, VH);
  const cx = VW / 2, cy = VH / 2;
  textCenter(gg, 'GIRA EL', cx, cy - 34, '#ffffff', 3);
  textCenter(gg, 'TELEFONO', cx, cy - 6, '#ffffff', 3);
  textCenter(gg, quiere ? 'DE LADO' : 'DE PIE', cx, cy + 28, '#5cffd8', 2);
  // Flecha curva insinuando el giro.
  const t = performance.now() / 1000;
  const k = 0.5 + Math.sin(t * 3) * 0.5;
  gg.strokeStyle = 'rgba(255,92,157,' + (0.35 + k * 0.5).toFixed(2) + ')';
  gg.lineWidth = 2;
  gg.beginPath();
  gg.arc(cx, cy + 62, 18, Math.PI * 0.85, Math.PI * 2.05);
  gg.stroke();
  gg.restore();
}

// ---------- Arranque ----------
function boot() {
  const el = document.getElementById('c');
  g = initCanvas(el);
  initAudio();
  // Las actualizaciones: se arrancan aparte y sin await. Si fallara (sin
  // Service Worker, sin permiso, lo que sea), el juego tiene que seguir
  // cargando igual -- por eso el catch se traga todo y no hay nada que
  // esperar aqui.
  try { iniciaUpdate().catch(() => {}); } catch {}
  initInput(el, ev => {
    if (ev.type === 'down') unlockAudio();   // desbloqueo de audio en el primer toque
    // Con el aviso de girar puesto sobre un juego pausado se descartan los
    // toques nuevos: si se dejaran pasar, la escena acumularia pulsaciones que
    // update() no consume y se aplicarian todas de golpe al reanudar.
    //
    // Pero el 'up' SIEMPRE pasa. Un dedo apoyado en el boton de disparo cuando
    // entra la pausa tiene que poder soltarse; si se le come el 'up', el juego
    // se queda creyendo que sigue pulsado y el boton no vuelve a responder.
    if (ev.type !== 'up' && avisoDeGiro()
        && !(sm.cur && sm.cur.meta.wide)) return;
    // ---------- Toques con la pausa puesta ----------
    // Nada llega al juego mientras esta pausado, o acumularia pulsaciones que
    // update() no consume y se aplicarian todas de golpe al seguir.
    //
    // Se reanuda con el 'up', no con el 'down'. Por que: ella vuelve a la app y
    // apoya el dedo; si el 'down' reanudara, ese mismo dedo se quedaria puesto
    // encima del boton de disparo o de la cruceta, y el juego arrancaria con un
    // control apretado que ella no pidio. Soltando, el 'up' que reanuda no lo
    // ve nadie y la partida empieza con las manos quietas.
    //
    // Si la pieza del boton de pausa pone su propio Pausa.onInput (para su menu
    // de SEGUIR / SALIR), manda ese y esto no corre.
    if (Pausa.activa) {
      if (Pausa.onInput) Pausa.onInput(ev, ctx);
      // Primero salir y luego el sonido: salir() reanuda el AudioContext, y un
      // blip disparado con el contexto todavia suspendido se programa para un
      // instante ya pasado y no se oye.
      else if (ev.type === 'up') { Pausa.salir(); SFX.blip(); }
      return;
    }
    // ---------- El boton de pausa se queda el toque ----------
    // Va ANTES que el juego y se lo come entero: en cinco de los seis juegos
    // cualquier punto de la pantalla es un control (SKYLINE salta con un toque
    // en cualquier sitio, skyline.js:387; el stick de LAST WAVE nace donde
    // caiga el dedo, lastwave.js:957; SYMBIOTE arrastra desde donde sea,
    // symbiote.js:294), asi que no hay forma de poner un boton que no le robe
    // sitio a alguien. Lo que si se puede es que robe POCO y en el sitio menos
    // usado: 30 px virtuales arriba del todo y centrados, lejos de donde caen
    // los pulgares.
    //
    // Se pausa en el 'down' y no en el 'up' porque el 'up' de ese mismo dedo ya
    // no llega al juego (la pausa esta puesta y esta rama devuelve antes), asi
    // que no queda ningun control creyendose apretado. Es el caso contrario al
    // de SALIR de la pausa, que si necesita el 'up' (ver pausa.js).
    if (ev.type === 'down' && esJuego(sm.cur) && tocaBoton(ev, VW, VH, sm.cur.meta)) {
      olvidaToques();
      Pausa.entrar('usuario');
      return;
    }
    if (sm.cur && sm.cur.onInput) sm.cur.onInput(ev, ctx);
  });
  // ---------- Salir de la app y volver ----------
  //
  // QUE PASABA ANTES. El manejador viejo paraba el bucle al ocultarse y lo
  // volvia a arrancar al volver, de golpe. Medido con tools/ver-app.js sobre
  // SURVIVAL: al volver el juego habia avanzado 0.5 s antes de que ella pudiera
  // mirar la pantalla. Vuelve a la app y ya la estan disparando.
  //
  // QUE HACE AHORA. Al ocultarse para el bucle y pausa el juego; al volver,
  // arranca el bucle otra vez -- hace falta, o no se dibujaria la pantalla de
  // pausa -- pero deja la pausa PUESTA. Ella decide cuando seguir.
  //
  // El menu y el fin de partida no se pausan (ver esJuego): ahi no hay partida
  // que proteger.
  //
  // POR QUE DOS EVENTOS Y NO UNO.
  //   'visibilitychange' cubre bloquear la pantalla, una llamada, cambiar de
  //   app y apagar/encender: en todos ellos Android lleva la Activity hasta
  //   onStop, y el WebView marca el documento como oculto.
  //   NO cubre bajar la barra de notificaciones ni un dialogo encima: ahi la
  //   Activity solo llega a onPause, sigue VISIBLE detras, y el documento nunca
  //   se marca oculto. Ese caso se ve con 'blur', que si llega al perder el
  //   foco de ventana.
  // Capacitor no ayuda: su Bridge (Bridge.java:1348-1370) solo avisa a los
  // PLUGINS en onPause/onResume, y el plugin @capacitor/app no esta instalado
  // (node_modules/@capacitor solo tiene android, cli y core). No se suma: seria
  // una dependencia nueva para algo que los eventos del DOM ya dan.
  //
  // 'pagehide' no se usa: en un WebView solo llega al descargar la pagina, o
  // sea al cerrar la app de verdad, y entonces ya no hay nada que pausar.
  //
  // LO IMPORTANTE: el bucle se para y se arranca desde UN solo sitio.
  // Si cada manejador pidiera su rAF, dos eventos seguidos dejarian DOS bucles
  // vivos. No es teorico: medido con dos 'visibilitychange' seguidos sobre el
  // codigo viejo, los frames por segundo se multiplicaron por 3.17 -- tres
  // bucles pintando lo mismo, gastando bateria para siempre. Y ahora que hay
  // dos fuentes de eventos (visibilitychange y blur) pasaria de verdad: al
  // bloquear la pantalla llegan LOS DOS.
  let corriendo = true;
  function pararBucle() {
    if (!corriendo) return;
    corriendo = false;
    cancelAnimationFrame(raf);
  }
  function arrancarBucle() {
    if (corriendo) return;
    corriendo = true;
    // El reloj se resincroniza SIEMPRE aqui. Sin esto el primer rAF de vuelta
    // trae el hueco entero: medido, 2015 ms tras dos segundos parado. Aunque
    // MAX_FRAME lo recorte a 250, eso son 5 pasos de simulacion (el tope) en un
    // solo frame, y los enemigos darian un salto de 83 ms de golpe.
    prev = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  }

  function seFue() {
    pararBucle();
    // suspendAudio() para tambien el temporizador del secuenciador (audio.js:39):
    // sin eso el reloj de la musica sigue corriendo minimizado y al volver
    // suelta de golpe todas las notas que se acumularon.
    suspendAudio();
    if (esJuego(sm.cur)) Pausa.entrar('sistema');
  }

  function volvio() {
    // El bucle vuelve SIEMPRE, este pausado o no: la pantalla de pausa hay que
    // dibujarla, y el menu tiene que seguir moviendose.
    arrancarBucle();
    // El audio solo se reanuda si NO quedamos en pausa. Si quedamos, lo
    // reanudara Pausa.salir() cuando ella toque: asi la cancion no arranca sola
    // encima de una pantalla quieta.
    if (!Pausa.activa) resumeAudio();
    // La escena puede querer enterarse de que volvimos. GALERIA lo usa: si
    // ella acaba de conceder el permiso de fotos en el dialogo del sistema,
    // este es el momento en que se puede comprobar (el dialogo es asincrono y
    // no devuelve nada al JavaScript).
    const esc = sm.cur;
    if (esc && typeof esc.resume === 'function') {
      try { esc.resume(); } catch (e) { /* una escena no puede tumbar la app */ }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) seFue(); else volvio();
  });
  // La barra de notificaciones y los dialogos: la Activity se pausa pero el
  // documento sigue visible, asi que 'visibilitychange' no llega y este si.
  window.addEventListener('blur', seFue);
  // Al volver el foco NO se llama a volvio() si el documento sigue oculto: en
  // Android el foco puede volver un instante antes que la visibilidad, y
  // arrancar el bucle ahi lo dejaria corriendo contra una pantalla apagada.
  window.addEventListener('focus', () => { if (!document.hidden) volvio(); });
  sm.go(Menu, {});
  prev = performance.now();
  raf = requestAnimationFrame(frame);
}

// Gancho para las herramientas de tools/: permite llevar la app a una escena
// concreta sin jugar hasta ella. No lo usa nada del juego.
// `cancion` devuelve el NOMBRE del tema que suena: es la unica forma de
// comprobar desde fuera que SURVIVAL cambia de musica al entrar el jefe.
window.__arcade = {
  sm, ctx, Menu, GameOver, GAMES, view, Pausa, toques,
  get cancion() {
    const s = currentSong();
    return s ? (Object.keys(SONGS).find(k => SONGS[k] === s) || '?') : null;
  },

  // ---------- El boton ATRAS de Android ----------
  // Lo llama MainActivity.java desde su OnBackPressedCallback. Devuelve que ha
  // hecho, y 'cerrar' significa "yo no lo he usado, cierra la app".
  //
  // El orden es el de un boton de VOLVER, un paso atras cada vez:
  //     jugando        -> pausa          (no se pierde la partida)
  //     en pausa       -> al menu
  //     en el menu     -> cerrar la app
  //     fin de partida -> al menu        (en vez de cerrar sin querer)
  //
  // Vive en __arcade y no en un evento del DOM porque el nativo tiene que
  // ESPERAR la respuesta para decidir si cierra, y un evento no devuelve nada.
  atras() {
    if (Pausa.activa) { Pausa.salir(); olvidaToques(); SFX.select(); ctx.toMenu(); return 'menu'; }
    if (esJuego(sm.cur)) { Pausa.entrar('usuario'); SFX.blip(); return 'pausa'; }
    // El fin de partida tambien retrocede al menu: es una pantalla intermedia,
    // y cerrar la app desde ahi seria una sorpresa desagradable.
    if (sm.cur && sm.cur.meta && sm.cur.meta.id === '_over') { SFX.blip(); ctx.toMenu(); return 'menu'; }
    return 'cerrar';
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
