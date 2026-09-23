// EL CABALLERO - su fisica y su maquina de estados. SIN DOM: el juego y el
// arnes de Node (tools/prueba-caballero.mjs) mueven exactamente este modelo,
// como en el AHORCADO.
//
// Es el segundo juego del arcade con SUELO y gravedad (el otro es FURIA), y el
// primero donde se camina. Por eso el eje Y NO lo manda el pulgar: lo manda la
// fisica. El pulgar solo mueve en X y decide cuando se salta.
//
// Nada de esto viene de otro juego del arcade. Los numeros salen de simular
// aqui, no de copiar los de NEON FIST (que es un juego cenital sin gravedad).

// TODO AL DOBLE respecto al primer intento: el lienzo es 1200x540 y la
// protagonista mide 128x180 en vez de 22x30, asi que las distancias, las
// velocidades y las alturas se duplican para que la sensacion sea la misma.
export const AX0 = 60, AX1 = 1140;     // paredes de la arena, en px virtuales
export const SUELO = 452;              // la linea donde apoyan los pies
export const ALTO = 180, ANCHO = 128;  // Romina, en celdas

// --- Andar ---
export const VEL = 240;                // px/s. Cruza la arena en 4.5 s.
const ACEL = 1800, FREN = 2800;        // px/s^2: arranca rapido, frena mas
const AIRE_CTRL = 0.55;                // cuanto manda el pulgar en el aire

// --- Saltar ---
// Gravedad ASIMETRICA: sube mas lento de lo que cae. Es lo que hace que el
// salto se sienta con peso en vez de flotante, y es gratis.
export const JUMP_V = 860;
export const GRAV_UP = 3000, GRAV_DN = 4200;
// Soltar pronto recorta el salto. Con 0.35 el salto corto se quedaba en 12 px
// (medido): inutil, no servia ni para esquivar un barrido. Con 0.55 son 27 px,
// la mitad del completo, que es una decision de verdad.
const CORTE_T = 0.09, CORTE_F = 0.55;
const COYOTE = 0.08, BUFFER = 0.10;    // margenes invisibles que salvan el salto

// --- Esquivar: un SALTO EVASIVO ---
// Antes era una rodada, pero el pack de ella no trae voltereta y la montada
// con la agachada se leia como estar de rodillas resbalando. Ahora es un
// saltito bajo y rapido dibujado con SU salto (impulso, recogida en el aire
// con la capa al viento, aterrizaje agachada), invulnerable casi todo el
// vuelo. Sin tocar el stick va HACIA ATRAS sin dejar de mirar al ogro (para
// contestar al caer); con el stick, hacia donde apunta.
//
// Medido: 620 de impulso con la gravedad del salto son 64 px de alto y 0.38 s
// en el aire, y a 640 px/s recorre ~245 px. Invulnerable de 0.02 a 0.36: todo
// el vuelo menos el aterrizaje.
//
// LOS NUMEROS SALEN DE LA PELEA, no del dibujo (tools/prueba-ogro.mjs, seccion
// 6). Con el salto de la rodada (190 px, invulnerable 240 ms), esquivar hacia
// atras un barrido de cerca solo salvaba pulsando en 117 ms concretos: el
// garrote llega a 340 px y el salto la dejaba dentro. Con 245 px y 340 ms la
// ventana es de 200 ms pegada al ogro y de 400 desde 150 px. Mas largo (700)
// salvaba de todo pulsando cuando fuera, y la pelea seria machacar ESQUIVAR.
export const ESQ_VX = 640, ESQ_VY = 620;
export const ESQ_CD = 0.62;
export const ESQ_INV0 = 0.02, ESQ_INV1 = 0.36;

// --- Tajo: un COMBO DE TRES, no un golpe suelto ---
//
// Un solo ataque con el mismo tiempo siempre se siente pobre por mucho que se
// dibuje bien: pulsas y pasa lo mismo. Tres golpes encadenados dan ritmo, y el
// tercero es una decision (si lo alcanzas, pega el doble y empuja).
//
// Cada golpe es mas lento y mas fuerte que el anterior. Si los tres fueran
// iguales seria el mismo boton tres veces, no un combo.
//
//   [ciclo, activa0, activa1, avance, daño, alcance]
//
// EL ALCANCE SALE DEL DIBUJO. La caballera pintada a mano (romi-atlas.js)
// lleva una espada larga, y la estela de cada tajo llega a 144 / 134 / 146 px
// de sus pies. Con los alcances de la muñeca de antes (74 / 78 / 92) la estela
// le cruzaba la barriga al ogro y el golpe no contaba. Ahora el daño llega
// hasta un poco antes del borde de la estela, que es la parte que se desvanece.
// Lo vigila la seccion 8 de tools/prueba-caballero.mjs.
export const TAJOS = [
  [0.26, 0.07, 0.13, 26, 1, 120],  // 1 REVES:   rapido, de abajo arriba
  [0.30, 0.09, 0.16, 34, 1, 115],  // 2 DERECHO: de arriba abajo
  [0.46, 0.16, 0.28, 58, 2, 130],  // 3 REMATE:  se echa atras y cae con todo
];
// Ventana para encadenar: desde que acaba la parte activa hasta un poco
// despues del final del ciclo. Medido: da 250-300 ms de margen, comodo en un
// movil donde el dedo no ve el boton (por debajo de 150 ms frustra).
export const ENLACE_EXTRA = 0.12;
// Cuanto se conserva del enlace tras acabar el combo entero, antes de que
// vuelva a empezar por el primero.
export const COMBO_OLVIDO = 0.34;

export const TAJO_T = 0.30;                        // compat: el golpe de en medio
export const TAJO_A0 = 0.08, TAJO_A1 = 0.15;       // ventana activa (idem)
export const ALCANCE = 110;            // del centro del cuerpo a la punta de la espada (en guardia)
const TAJO_FREN = 0.45;                // cuanta velocidad conserva al cortar

// --- Vida ---
export const HP0 = 4;
export const IFRAME = 1.0;

// Al recibir un golpe sale despedida hacia atras en un saltito: es lo que hace
// LEER que le han dado (antes se quedaba de pie con la espada en alto, que
// parecia un ataque). 380 son ~24 px de alto y 0.23 s en el aire, dentro de
// los 0.28 s del dolor. El ultimo golpe la lanza mas lejos.
const DOLOR_VY = 380, DOLOR_VX = 140;
const MUERE_VY = 520, MUERE_VX = 230;

// Estados
export const QUIETO = 0, CORRE = 1, SALTA = 2, ESQUIVA = 3, TAJO = 4, DOLOR = 5, MUERTO = 6, BLOQUEA = 7;
// Cuanto tarda la guardia en levantarse: antes de eso NO protege. Es lo que
// impide que la guardia sea un boton de invulnerabilidad.
export const BLOQ_SUBE = 0.10;

// --- La GUARDIA: ella para con la ESPADA, no con escudo ---
//
// SOLO PARA EL GARROTAZO. Es el unico ataque del ogro que cae de frente y a la
// altura de la espada; el barrido, la embestida y las ondas le ROMPEN la
// guardia y entran igual. Antes paraba cualquier golpe de frente, y la pelea
// se ganaba con el dedo apoyado en el boton: los otros tres botones sobraban
// y el diseño (cada ataque, su respuesta) no existia.
//
// Y tiene dos verbos segun CUANDO se pulsa:
//  1. PARADA. Si el garrotazo llega en los primeros 0.18 s de levantarla, no
//     solo lo para: rebota al ogro y lo deja abierto, y el siguiente ATACAR
//     es un CONTRAATAQUE. Es el premio por leer el golpe en vez de taparse.
//  2. GUARDIA. Aguantada, para el garrotazo sin premio y se anda al 40%.
export const PARADA_VENT = 0.18;       // ventana de la parada, desde BLOQ_SUBE
// Cuanto dura la ocasion de contraatacar (y cuanto se queda abierto el ogro).
// Tras la parada hay 0.15 s de congelacion y ~0.25 de reaccion; el filo del
// contraataque sale 0.10 s despues de pulsar. Con 0.55 no llegaba.
export const PARADA_PREMIO = 0.8;

// EL CONTRAATAQUE: tras una parada, ATACAR no empieza el combo por el reves:
// sale el remate (sus dibujos) mas RAPIDO y con mas daño. Misma forma que
// TAJOS: [ciclo, activa0, activa1, avance, daño, alcance].
export const CONTRA = [0.42, 0.10, 0.22, 46, 3, 130];

// `o` es la DIFICULTAD (ver caba-partida.js): hp, sus corazones, y paradaVent,
// cuanto dura la ventana de la parada. Sin ella, la de siempre.
export function makeCaballero(x, o = {}) {
  const hpMax = o.hp || HP0;
  return {
    hpMax, paradaVent: o.paradaVent || PARADA_VENT,
    x, y: o.y !== undefined ? o.y : SUELO, vx: 0, vy: 0, dir: 1,
    st: QUIETO, t: 0,
    enSuelo: true, coyote: 0, buffer: 0, cortable: 0, aterriza: 0,
    esqT: 0, esqCd: 0, esqDir: 1,
    bloqT: 0, bloqHit: 0, parada: 0,
    tajoT: 0, tajoId: 0, golpeo: 0, combo: 0, comboOlvido: 0, contra: 0,
    hp: hpMax, iframe: 0, hurtT: 0, hurtIni: 0, muereT: 0,
    animT: 0, frame: 0,
    vivo: true,
  };
}

// --- Repisas y escombros ---
// `mundo` es opcional: { repisas: [{x0, x1, y}], bloques: [{x0, x1, top}] }.
// Sin el, el suelo es plano como siempre, y el arnes mide lo mismo que antes.
//   REPISAS: se atraviesan desde abajo y se aterriza encima (plataformas de un
//   solo sentido). Asi se sube de un salto sin darse con la cabeza.
//   BLOQUES (los escombros de la boveda): solidos. Se aterriza encima y cortan
//   el paso por los lados: hay que saltarlos o subirse.
// LA AVENTURA (caba-nivel.js) añade tres cosas, y la pelea no usa ninguna:
//   x0, x1    las paredes del nivel, que es mas ancho que la pantalla (sin
//             ellas, las de la arena: AX0 y AX1)
//   sinSuelo  no hay suelo en todas partes: el suelo son BLOQUES, un tramo por
//             trozo de camino, y entre dos tramos hay un FOSO. Como son
//             bloques, dentro del foso sus paredes cortan el paso: no se sale
//             andando.
export const PIES_R = 16;     // se sigue de pie con el centro hasta 16 px fuera del borde
export const CUERPO_K = 22;   // medio ancho del cuerpo, para chocar de lado con un bloque

// La superficie en la que aterriza al bajar de yAntes a y en x, o null.
function aterrizaEn(x, yAntes, y, mundo) {
  let mejor = y >= SUELO && !(mundo && mundo.sinSuelo) ? SUELO : null;
  const cruza = (top, x0, x1) => {
    if (x >= x0 - PIES_R && x <= x1 + PIES_R && yAntes <= top + 0.01 && y >= top &&
        (mejor === null || top < mejor)) mejor = top;
  };
  if (mundo) {
    for (const p of mundo.repisas || []) cruza(p.y, p.x0, p.x1);
    for (const b of mundo.bloques || []) cruza(b.top, b.x0, b.x1);
  }
  return mejor;
}

// ¿Tiene algo bajo los pies a esta altura?
export function apoyada(x, y, mundo) {
  if (!mundo) return y >= SUELO - 0.01;
  if (y >= SUELO - 0.01 && !mundo.sinSuelo) return true;
  for (const p of mundo.repisas || []) if (Math.abs(y - p.y) < 0.5 && x >= p.x0 - PIES_R && x <= p.x1 + PIES_R) return true;
  for (const b of mundo.bloques || []) if (Math.abs(y - b.top) < 0.5 && x >= b.x0 - PIES_R && x <= b.x1 + PIES_R) return true;
  return false;
}

// La superficie mas alta que hay bajo (x, y): para la sombra, que tiene que caer
// sobre la repisa cuando salta encima de ella, no en el suelo de abajo. Sobre
// un foso no hay nada: Infinity (y no se pinta sombra).
export function sueloBajo(x, y, mundo) {
  let s = mundo && mundo.sinSuelo ? Infinity : SUELO;
  if (mundo) {
    for (const p of mundo.repisas || []) if (x >= p.x0 - PIES_R && x <= p.x1 + PIES_R && p.y >= y - 0.5 && p.y < s) s = p.y;
    for (const b of mundo.bloques || []) if (x >= b.x0 - PIES_R && x <= b.x1 + PIES_R && b.top >= y - 0.5 && b.top < s) s = b.top;
  }
  return s;
}

// ¿Hay algo que pisar bajo esta x? (Solo la aventura: el suelo son bloques.)
function haySuelo(x, mundo) {
  for (const b of mundo.bloques || []) if (x >= b.x0 - PIES_R && x <= b.x1 + PIES_R) return true;
  return false;
}

// Los bloques cortan el paso: con los pies por debajo de su techo no se entra.
function chocaBloques(K, xAntes, mundo) {
  if (!mundo || !mundo.bloques) return;
  for (const b of mundo.bloques) {
    if (K.y <= b.top + 1) continue;                 // va por encima: no choca
    if (K.x + CUERPO_K > b.x0 && K.x - CUERPO_K < b.x1) {
      K.x = xAntes <= (b.x0 + b.x1) / 2 ? b.x0 - CUERPO_K : b.x1 + CUERPO_K;
      K.vx = 0;
    }
  }
}

// Un paso. `inp` = { dx, salta, golpea, esquiva, saltaAbajo, bloquea }: dx es
// el stick (-1..1), saltaAbajo y bloquea son botones MANTENIDOS y los otros
// tres son FLANCOS (true solo en el frame en que se pulsan).
export function stepCaballero(K, inp, dt, mundo) {
  if (!K.vivo) { caeDerrotada(K, dt, mundo); return; }
  K.t += dt; K.animT += dt;
  if (K.iframe > 0) K.iframe -= dt;
  if (K.esqCd > 0) K.esqCd -= dt;
  if (K.hurtT > 0) K.hurtT -= dt;

  // Buffer de salto: si pulsa un poco antes de tocar suelo, se le guarda.
  if (inp.salta) K.buffer = BUFFER;
  if (K.buffer > 0) K.buffer -= dt;

  const puedeActuar = K.st !== ESQUIVA && K.st !== DOLOR;

  if (K.bloqHit > 0) K.bloqHit -= dt;
  if (K.aterriza > 0) K.aterriza -= dt;
  if (K.parada > 0) K.parada -= dt;

  // --- GUARDIA: mientras se mantiene el boton y este en el suelo ---
  if (inp.bloquea && K.enSuelo && puedeActuar && K.st !== TAJO) {
    if (K.st !== BLOQUEA) { K.st = BLOQUEA; K.bloqT = 0; K.animT = 0; }
    K.bloqT += dt;
  } else if (K.st === BLOQUEA) {
    K.st = QUIETO; K.bloqT = 0; K.animT = 0;
  }

  // --- ESQUIVAR: manda sobre todo lo demas, y cancela el tajo ---
  if (inp.esquiva && K.esqCd <= 0 && puedeActuar && K.enSuelo) {
    const conStick = Math.abs(inp.dx) > 0.3;
    // Sin stick, hacia atras y mirando al frente; con stick, hacia alli.
    const sentido = conStick ? Math.sign(inp.dx) : -K.dir;
    if (conStick) K.dir = sentido;
    K.st = ESQUIVA; K.esqT = 0; K.esqCd = ESQ_CD; K.esqDir = sentido; K.esqAtras = !conStick;
    K.vx = sentido * ESQ_VX; K.vy = -ESQ_VY;
    K.enSuelo = false; K.coyote = 0; K.buffer = 0; K.cortable = 0;
    K.animT = 0;
  }

  // --- Saltar ---
  if (K.buffer > 0 && (K.enSuelo || K.coyote > 0) && K.st !== ESQUIVA && K.st !== DOLOR) {
    K.vy = -JUMP_V; K.enSuelo = false; K.coyote = 0; K.buffer = 0;
    K.cortable = CORTE_T;
    K.st = SALTA; K.animT = 0;
  }
  // Salto cortable: soltar pronto lo deja a la mitad de alto.
  if (K.cortable > 0) {
    K.cortable -= dt;
    if (!inp.saltaAbajo && K.vy < 0) { K.vy *= CORTE_F; K.cortable = 0; }
  }

  // --- Tajo: arrancar, ENCADENAR o CONTRAATACAR ---
  // Con la guardia arriba, ATACAR la baja y pega: el tajo manda.
  if (inp.golpea && K.st !== ESQUIVA && K.st !== DOLOR) {
    if (K.parada > 0) {
      // EL CONTRAATAQUE: la parada acaba de abrir al ogro. Sale el remate,
      // rapido, sea cual sea el golpe del combo en que estuviera.
      K.parada = 0; K.contra = 1; K.combo = 2;
      K.st = TAJO; K.tajoT = 0; K.tajoId++; K.golpeo = 0; K.animT = 0;
      K.comboOlvido = COMBO_OLVIDO;
      K.vx = K.dir * CONTRA[3] * 3.2;
    } else {
      const enCombo = K.st === TAJO;
      // Se puede encadenar solo DESPUES de que el filo haya pasado: encadenar
      // antes convertiria el combo en un machaque sin ritmo.
      const [ciclo, , a1] = tajoDe(K);
      const puedeEnlazar = enCombo && !K.contra && K.tajoT >= a1 && K.tajoT <= ciclo + ENLACE_EXTRA
                           && K.combo < TAJOS.length - 1;
      if (!enCombo || puedeEnlazar) {
        // Si viene de encadenar, sube el contador; si no, empieza por el primero.
        K.combo = puedeEnlazar ? K.combo + 1 : 0;
        K.contra = 0;
        K.st = TAJO; K.tajoT = 0; K.tajoId++; K.golpeo = 0; K.animT = 0;
        K.comboOlvido = COMBO_OLVIDO;
        // Cada golpe empuja hacia delante: es lo que hace que el combo AVANCE
        // en vez de picotear en el sitio. Es un IMPULSO que se frena enseguida,
        // no velocidad sostenida: medido, con velocidad sostenida el tercer
        // golpe salia a 294 px/s -- mas rapido que correr (240) -- y eso haria
        // del machaque la mejor forma de cruzar la arena.
        K.vx = K.vx * TAJO_FREN * 0.5 + K.dir * TAJOS[K.combo][3] * 3.2;
      }
    }
  }
  // El combo se olvida si pasa el rato sin seguir
  if (K.comboOlvido > 0) {
    K.comboOlvido -= dt;
    if (K.comboOlvido <= 0 && K.st !== TAJO) K.combo = 0;
  }

  // --- Movimiento en X ---
  if (K.st === ESQUIVA) {
    // Sin control: el salto ya va lanzado. Es lo que lo hace un compromiso.
    K.esqT += dt;
  } else if (K.st === DOLOR) {
    K.vx *= 0.86;
    if (K.t - K.hurtIni > 0.28) { K.st = QUIETO; K.animT = 0; }
  } else if (K.st === TAJO) {
    // Durante el tajo manda el impulso del golpe y SU rozamiento, no el freno
    // del suelo. Con el freno del suelo (FREN = 2800, o sea 46 px/s por
    // frame) encima, el impulso se evaporaba y el combo avanzaba 6 px en vez
    // de los 101 que decia el barrido: el simulador no modelaba este freno.
    // El pulgar aun corrige un poco la direccion, pero no acelera.
    if (Math.abs(inp.dx) > 0.08) K.vx += Math.sign(inp.dx) * 300 * dt;
  } else {
    // Con la guardia en alto se avanza al 40%: protegerse cuesta movilidad.
    const ctrl = (K.enSuelo ? 1 : AIRE_CTRL) * (K.st === BLOQUEA ? 0.4 : 1);
    const quiere = inp.dx * VEL * (K.st === BLOQUEA ? 0.4 : 1);
    if (Math.abs(inp.dx) > 0.08) {
      K.dir = inp.dx < 0 ? -1 : 1;
      const a = (Math.abs(quiere) > Math.abs(K.vx) || Math.sign(quiere) !== Math.sign(K.vx)) ? ACEL : FREN;
      K.vx += Math.sign(quiere - K.vx) * a * ctrl * dt;
      if (Math.abs(K.vx - quiere) < 12) K.vx = quiere;
    } else if (K.enSuelo) {
      const f = FREN * dt;
      K.vx = Math.abs(K.vx) <= f ? 0 : K.vx - Math.sign(K.vx) * f;
    }
  }

  gravedad(K, dt, mundo);

  // --- Ciclo del tajo ---
  if (K.st === TAJO) {
    K.tajoT += dt;
    // El impulso del golpe se frena poco a poco: empuja al salir y se apaga.
    // Barrido en Node (mult x roza): con 3.2 y 0.96 el combo avanza 101 px --
    // media zancada por golpe -- con punta de 193 px/s, por debajo de los 240
    // de correr. Con 0.88 avanzaba 2 px (nada) y con mult 6 corria mas que ella.
    K.vx *= 0.96;
    if (K.tajoT >= tajoDe(K)[0]) {
      K.st = K.enSuelo ? QUIETO : SALTA; K.animT = 0;
      // El contraataque es un remate: tras el, el combo vuelve a empezar.
      if (K.contra) { K.contra = 0; K.combo = 0; }
      // Si no, no se resetea el combo aqui: comboOlvido da la ventana.
    }
  }

  // --- Estado de animacion ---
  if (K.st === QUIETO || K.st === CORRE) {
    K.st = (!K.enSuelo) ? SALTA : (Math.abs(K.vx) > 16 ? CORRE : QUIETO);
  }
}

// La gravedad, el aterrizaje (en el suelo, una repisa o un escombro), el
// avance en X y las paredes. Aparte porque tambien la usa la derrota: el
// ultimo golpe la lanza por el aire y tiene que caer.
function gravedad(K, dt, mundo) {
  if (!K.enSuelo) {
    const yAntes = K.y;
    K.vy += (K.vy < 0 ? GRAV_UP : GRAV_DN) * dt;
    K.y += K.vy * dt;
    const s = K.vy >= 0 ? aterrizaEn(K.x, yAntes, K.y, mundo) : null;
    if (s !== null) {
      // ATERRIZAJE. Se guarda cuanto venia cayendo para que el dibujo pueda
      // amortiguar: caer de un salto entero y bajar un escalon no se ven
      // igual. Dura poco (0.12 s) y NO quita el control -- solo se dibuja.
      if (K.vy > 300) K.aterriza = 0.12;
      K.y = s; K.vy = 0; K.enSuelo = true;
      if (K.st === SALTA) { K.st = QUIETO; K.animT = 0; }
      // La esquiva acaba al tocar suelo, con su agachada de aterrizaje.
      if (K.st === ESQUIVA) { K.st = QUIETO; K.vx = 0; K.aterriza = 0.12; K.animT = 0; }
    }
  } else if (!apoyada(K.x, K.y, mundo)) {
    // Se le acaba la repisa (o el escombro) bajo los pies: empieza a caer. El
    // coyote que ya tenia le deja saltar un instante, como al borde del suelo.
    K.enSuelo = false; K.vy = 0;
  } else {
    K.coyote = COYOTE;
  }
  if (K.coyote > 0 && !K.enSuelo) K.coyote -= dt;

  const xAntes = K.x;
  K.x += K.vx * dt;
  // LA ESQUIVA HACIA ATRAS NO TIRA AL FOSO. Es la de defenderse (la que sale
  // sin tocar el stick), y en la aventura se pelea con fosos a la espalda:
  // esquivar un zarpazo no puede costar dos corazones. Se queda en el borde.
  // La de hacia delante (con el stick) si cruza fosos: esa se elige.
  if (K.st === ESQUIVA && K.esqAtras && mundo && mundo.sinSuelo &&
      haySuelo(xAntes, mundo) && !haySuelo(K.x, mundo)) { K.x = xAntes; K.vx = 0; }
  const x0 = mundo && mundo.x0 !== undefined ? mundo.x0 : AX0;
  const x1 = mundo && mundo.x1 !== undefined ? mundo.x1 : AX1;
  if (K.x < x0) { K.x = x0; K.vx = 0; }
  else if (K.x > x1) { K.x = x1; K.vx = 0; }
  chocaBloques(K, xAntes, mundo);
}

// Derrotada: sale despedida por el ultimo golpe, cae y se queda de rodillas.
function caeDerrotada(K, dt, mundo) {
  K.muereT += dt;
  if (K.aterriza > 0) K.aterriza -= dt;
  if (K.enSuelo) K.vx *= 0.8;
  gravedad(K, dt, mundo);
}

// Los numeros del tajo que esta dando: el del combo o el contraataque.
function tajoDe(K) { return K.contra ? CONTRA : TAJOS[K.combo]; }

// La espada esta cortando en este frame.
export function espadaActiva(K) {
  if (K.st !== TAJO) return false;
  const [, a0, a1] = tajoDe(K);
  return K.tajoT >= a0 && K.tajoT < a1;
}
// Hay contraataque esperando: la parada acaba de abrir al ogro.
export function hayParada(K) { return K.parada > 0; }

// Cuanto daño hace el golpe que esta saliendo ahora.
export function danoTajo(K) {
  return K.st === TAJO ? tajoDe(K)[4] : 0;
}
// Que numero de golpe del combo es (0,1,2). Para el sonido y las chispas.
export function golpeCombo(K) { return K.combo; }

// Punto de la punta de la espada (para colisiones y chispas).
export function puntaEspada(K) {
  // El alcance depende del golpe: el tercero (el giro) llega mas lejos, y eso
  // tiene que notarse en la colision, no solo en el dibujo.
  const alc = K.st === TAJO ? tajoDe(K)[5] : ALCANCE;
  return [K.x + K.dir * alc, K.y - 16];
}

// Es invulnerable ahora mismo (esquivando o por i-frames).
export function invulnerable(K) {
  if (K.iframe > 0) return true;
  return K.st === ESQUIVA && K.esqT >= ESQ_INV0 && K.esqT <= ESQ_INV1;
}

// Le llega un golpe desde sx. `tipo` dice QUE golpe es, porque la guardia solo
// vale contra algunos:
//   'garrote'                      la guardia lo para (y si es a tiempo, PARADA)
//   'barrido' 'embestida' 'pisoton' 'onda'   le ROMPEN la guardia
//   'piedra'                       cae del techo: la guardia ni se entera
// En la aventura (caba-enemigos.js) se paran tambien el ZARPAZO del lobo y
// el FUEGO de la kitsune; el corro de fuego y los troncos la rompen.
// Devuelve 'parada' o 'bloqueado' si la guardia lo para, 'rota' si entra
// rompiendole la guardia, true si entra sin mas, y false si no le entra
// (esquivando o recien golpeada). `dano`: cuantos corazones quita.
export const PARABLES = new Set(['garrote', 'zarpazo', 'fuego']);
export function herir(K, sx, tipo = 'garrote', dano = 1) {
  if (!K.vivo) return false;
  const enGuardia = K.st === BLOQUEA && K.bloqT >= BLOQ_SUBE && (sx - K.x) * K.dir > 0;
  if (enGuardia && PARABLES.has(tipo)) {
    // PARADA: si el golpe llega en la ventana justo despues de levantar la
    // guardia, no es un bloqueo cualquiera -- rebota al ogro y le deja
    // abierto. Es lo que premia LEER el ataque en vez de taparse siempre.
    if (K.bloqT < BLOQ_SUBE + K.paradaVent) {
      K.parada = PARADA_PREMIO; K.bloqHit = 0.22; K.vx = -K.dir * 40;
      return 'parada';
    }
    K.bloqHit = 0.22; K.vx = -K.dir * 90;
    return 'bloqueado';
  }
  if (invulnerable(K)) return false;
  const rota = enGuardia && tipo !== 'piedra';
  K.hp = Math.max(0, K.hp - dano); K.iframe = IFRAME;
  K.st = DOLOR; K.hurtIni = K.t; K.hurtT = 0.28; K.animT = 0;
  K.contra = 0; K.parada = 0;
  const lejos = K.x < sx ? -1 : 1;
  K.vx = lejos * DOLOR_VX;
  if (K.enSuelo) { K.vy = -DOLOR_VY; K.enSuelo = false; }
  if (K.hp <= 0) {
    // El ultimo golpe la lanza mas lejos: cae, y se queda de rodillas.
    K.vivo = false; K.st = MUERTO; K.muereT = 0;
    K.vx = lejos * MUERE_VX; K.vy = -MUERE_VY; K.enSuelo = false;
  }
  return rota ? 'rota' : true;
}

// Que pose y que fotograma toca dibujar. Devuelve [pose, frame].
//
// Las poses son las de romi-atlas.js: una caballera PINTADA A MANO (ver
// tools/romina-atlas.py), no la muñeca por codigo de antes. Cuantos
// fotogramas tiene cada una lo dice el atlas, y el arnes comprueba contra el
// que todos se alcanzan jugando y ninguno se sale.
//
// El pack no trae esquiva, ni golpe recibido, ni derrota: las tres salen de
// SU salto, que es lo que de verdad hace el cuerpo (despega, va recogida por
// el aire con la capa al viento y cae agachada). Montarlas con la agachada
// quieta, como antes, se leia como estar de rodillas.
export function pose(K) {
  // DERROTA: despedida por el aire, el golpe contra el suelo y de rodillas.
  if (K.st === MUERTO) {
    if (!K.enSuelo) return ['jump', 3];
    return K.aterriza > 0 ? ['jump', 8] : ['dead', 0];
  }
  // GOLPE RECIBIDO: sale despedida recogida (el destello blanco lo pone la
  // escena) y cae agachada.
  if (K.st === DOLOR) return K.enSuelo ? ['jump', 8] : ['jump', 3];
  // GUARDIA: 0 levantandola, 1 plantada, 2 el impacto (la espada salta arriba)
  // y 3 rehacerse. El 0 dura lo que tarda en subir (BLOQ_SUBE), que es justo
  // cuando todavia no para.
  if (K.st === BLOQUEA) {
    if (K.bloqHit > 0) return ['block', K.bloqHit > 0.12 ? 2 : 3];
    return ['block', K.bloqT < BLOQ_SUBE ? 0 : 1];
  }
  // ESQUIVA: el impulso, la recogida en el aire subiendo y bajando. El
  // aterrizaje lo pone K.aterriza, como en el salto. El impulso hacia delante
  // es el del salto (se inclina hacia donde va); hacia atras se agacha: con el
  // del salto parecia que se lanzaba contra el ogro antes de irse.
  if (K.st === ESQUIVA) {
    if (K.esqT < 0.05) return ['jump', K.esqDir === K.dir ? 0 : 8];
    return ['jump', K.vy < -200 ? 2 : 3];
  }
  if (K.st === TAJO) {
    const [ciclo, a0, a1] = tajoDe(K);
    const t = K.tajoT;
    // EN EL AIRE: su tajo aereo, sea el golpe que sea del combo.
    if (!K.enSuelo) return ['air', t < a0 ? 0 : t < (a0 + a1) / 2 ? 1 : t < a1 ? 2 : 3];
    // Cada golpe del combo tiene SU animacion, y cada una reparte sus
    // fotogramas en tres tramos: la CARGA hasta activa0, el FILO (los dos
    // fotogramas con la estela) justo en la parte activa, y la VUELTA hasta
    // el ciclo. Asi la estela se ve EXACTAMENTE cuando el golpe hace daño.
    // El contraataque usa los dibujos del remate con sus tiempos, mas cortos.
    const [nombre, carga, filo, vuelta] = [['atk', 2, 2, 2], ['atk2', 3, 2, 3], ['atk3', 6, 2, 3]][K.combo];
    return [nombre, reparte(t, a0, a1, ciclo, carga, filo, vuelta)];
  }
  // SALTAR: fotogramas mapeados por la VELOCIDAD vertical, no por un reloj,
  // para que el dibujo sea siempre lo que el cuerpo hace de verdad. JUMP_V es
  // 860: del 1 al 5 sube (en el 4 y el 5 levanta la espada), el 6 y el 7 caen.
  if (!K.enSuelo) {
    const v = K.vy;
    // El 0 es el IMPULSO agachado: los dos primeros frames tras despegar, que
    // es lo unico que dura la flexion. (El salto es instantaneo -- no hay
    // ventana de anticipacion en el suelo -- asi que si este fotograma no se
    // ata aqui no se alcanza NUNCA y es un dibujo tirado. Lo cazo el arnes.)
    if (K.st === SALTA && K.animT < 0.04) return ['jump', 0];
    if (v < -620) return ['jump', 1];    // acaba de despegar
    if (v < -420) return ['jump', 2];
    if (v < -220) return ['jump', 3];
    if (v <  -40) return ['jump', 4];
    if (v <  160) return ['jump', 5];    // la cumbre: casi parada
    if (v <  520) return ['jump', 6];    // cayendo
    return ['jump', 7];                  // buscando el suelo
  }
  // ATERRIZAJE: se dibuja amortiguando aunque ya tenga el control. Va despues
  // del aire y antes de correr, porque se puede aterrizar andando.
  if (K.aterriza > 0) return ['jump', 8];
  if (K.st === CORRE) {
    // El ciclo avanza con la DISTANCIA recorrida, no con el reloj: asi los
    // pies no patinan cuando acelera o frena. Medido en el dibujo, el pie
    // apoyado retrocede ~39 px por fotograma, que a 240 px/s serian 6 por
    // segundo: parece correr a camara lenta. A 32 px por fotograma (7.5 por
    // segundo) resbala un poco y se ve correr de verdad.
    return ['run', Math.floor(Math.abs(K.x) / 32) % 6];
  }
  // Respirar: nueve fotogramas, un ciclo por segundo.
  return ['idle', Math.floor(K.animT / 0.11) % 9];
}

// Reparte los fotogramas de un tajo en sus tres tramos (ver pose()).
function reparte(t, a0, a1, ciclo, nCarga, nFilo, nVuelta) {
  if (t < a0) return Math.min(nCarga - 1, Math.floor(t / a0 * nCarga));
  if (t < a1) return nCarga + Math.min(nFilo - 1, Math.floor((t - a0) / (a1 - a0) * nFilo));
  const u = (t - a1) / Math.max(1e-6, ciclo - a1);
  return nCarga + nFilo + Math.min(nVuelta - 1, Math.floor(u * nVuelta));
}
