// LA AVENTURA - un nivel que avanza. SIN DOM, como caba-cuerpo.js y
// caba-arena.js: la escena y el arnes (tools/prueba-nivel.mjs) mueven
// exactamente esto.
//
// Anderson pidio que el juego no fuera solo pelear contra un jefe: "distintos
// obstaculos, mapas, enemigos". Eligio NIVELES QUE AVANZAN (Romina va hacia la
// derecha por un camino mas largo que la pantalla y la camara la sigue) y
// dejar la pelea contra el ogro como modo aparte.
//
// Un nivel es DATOS (BOSQUE, abajo) y aqui vive lo que pasa en el:
//   FOSOS     huecos en el camino. El suelo son tramos (bloques de
//             caba-cuerpo.js con `sinSuelo`), y entre dos tramos no hay nada.
//             Caer cuesta un corazon y se vuelve al ultimo sitio seguro.
//   TOCONES   bloques en mitad de un foso ancho: se cruza en dos saltos.
//   TRONCOS   ruedan hacia ella por el camino. No se paran con la guardia ni
//             con la espada: se saltan, o se atraviesan esquivando.
//   RAMAS     caen de los arboles con aviso (su sombra), como los cascotes del
//             salon. Vienen de arriba: la guardia ni se entera; hay que
//             apartarse.
//   HOGUERA   a mitad de camino: si cae, sigue desde ahi.
//   SALIDA    llegar a ella es acabar el nivel.
// Cada cosa pide una respuesta distinta de los cuatro botones, que es la ley
// del juego (ver ogro-cuerpo.js): no hay un boton que valga para todo.

import * as C from './caba-cuerpo.js';
import * as EN from './caba-enemigos.js';

// ---------- El bosque ----------
// Todo en px del lienzo (1200x540). El camino del pack esta en las filas
// 177..225 del dibujo (x2: 354..450); ella pisa por el centro, en 392.
export const BOSQUE = {
  id: 'bosque', nombre: 'EL BOSQUE',
  ancho: 7400,
  suelo: 392,
  // [x0, x1] de cada foso. Los anchos salen del salto medido en
  // tools/prueba-nivel.mjs: corriendo se cruzan 170 px como mucho, y un foso
  // de 120 ya solo deja 233 ms para despegar (uno de 150, 117: injusto con el
  // pulgar). Por eso van de 100 a 120, y el ancho lleva un tocon en medio.
  fosos: [[1260, 1370], [2780, 2900], [4640, 4740], [5760, 6060]],
  // Tocones en mitad del foso ancho: [x0, x1, alto sobre el camino].
  tocones: [[5865, 5955, 16]],
  // Zonas donde ruedan troncos mientras ella este dentro: [x0, x1, cada].
  // La primera empieza DESPUES del primer lobo: se aprende una cosa cada vez.
  // (Acaba lejos del foso siguiente: un tronco que llega justo al aterrizar
  // del salto no se puede saltar.)
  troncos: [[1950, 2450, 2.6], [5300, 5650, 2.4]],
  // Zonas donde caen ramas: [x0, x1, cada].
  ramas: [[3550, 4150, 2.0]],
  hoguera: 4200,
  // LOS ENEMIGOS: [tipo, x, y donde se despierta]. Primero uno de cada, solo
  // (el lobo antes de los troncos, la kitsune antes de las ramas); luego
  // mezclados con obstaculos (un lobo bajo las ramas; la kitsune disparando
  // mientras ruedan troncos: guardia arriba, salto abajo), y al final dos
  // lobos. Los que comparten tramo se despiertan cuando ella pasa por su
  // sitio (el tercer numero), no por distancia: por distancia, los dos lobos
  // de las ramas se sumaban a la pelea con la kitsune. Y lejos de los bordes
  // de los fosos: peleando al borde, apartarse es caerse.
  enemigos: [['lobo', 1700], ['kitsune', 3300], ['lobo', 3950, 3750], ['lobo', 4330, 4150],
             ['kitsune', 5250], ['lobo', 6400], ['lobo', 6900, 6650]],
  salida: 7050,
  // El arbol con cara, al final del camino: el que guarda la salida.
  arbol: 7050,
};

// ---------- Los troncos ----------
// Con 30 de radio a 330 px/s, saltarlo solo salvaba pulsando en 117 ms: el
// tronco tardaba 0.28 s en pasarle por debajo y ella solo esta 0.4 s por
// encima de su altura. Mas pequeño y mas rapido pasa antes (medido en
// tools/prueba-nivel.mjs, seccion 3).
export const TRONCO_R = 24;           // radio (48 de diametro: el salto sube 116)
export const TRONCO_V = 380;          // px/s rodando hacia ella
export const TRONCO_G = 2400;         // al caer por un foso
// ---------- Las ramas ----------
export const RAMA_AVISO = 0.75;       // la sombra en el suelo antes de caer
// Sale de arriba de la pantalla, bajo la franja del marcador: ahi se la ve
// temblar durante el aviso (antes caia desde fuera y el aviso eran tres
// hojitas verdes sobre el verde del bosque, que no se veian).
export const RAMA_Y0 = 70, RAMA_V0 = 240, RAMA_G = 3000;
export const RAMA_ANCHO = 64, RAMA_ALTO = 22;
// ---------- Caer a un foso ----------
export const CAIDA_Y = 260;           // tanto por debajo del camino: ya no se ve
export const CAIDA_IFRAME = 1.4;      // al volver, un rato sin que nada le toque
const SEGURO_MARGEN = 60;             // se vuelve a un sitio con suelo a los dos lados

// Los tramos de camino: lo que queda entre los fosos.
export function tramos(def) {
  const out = [];
  let x = -200;
  for (const [a, b] of def.fosos) { out.push([x, a]); x = b; }
  out.push([x, def.ancho + 200]);
  return out;
}

// `dif`: lo que la dificultad le hace a los enemigos (P.opcionesBosque).
export function makeNivel(def, rnd = Math.random, dif = {}) {
  const suelo = tramos(def).map(([x0, x1]) => ({ x0, x1, top: def.suelo }));
  const tocones = def.tocones.map(([x0, x1, alto]) => ({ x0, x1, top: def.suelo - alto }));
  // Cada enemigo vive en su tramo de camino, apartado de los bordes: el lobo
  // 300 px y la kitsune 150. Asi la pelea no es de espaldas a un foso (con el
  // lobo a 90 px, esquivar hacia atras era caerse) ni en el sitio donde ella
  // aterriza del salto.
  const enemigos = (def.enemigos || []).map(([tipo, x, despiertaX], i) => {
    const s = suelo.find(t => x >= t.x0 && x <= t.x1);
    const m = tipo === 'lobo' ? 300 : 150;
    const E = EN.makeEnemigo(tipo, x, def.suelo, Math.max(s.x0, 0) + m, Math.min(s.x1, def.ancho) - m, i + 1, dif, [s.x0, s.x1]);
    if (despiertaX !== undefined) E.despiertaX = despiertaX;
    return E;
  });
  return {
    def, rnd,
    suelo, tocones, enemigos, fuegos: [], vencidos: 0,
    camX: 0,
    troncos: [], ramas: [],
    relojTroncos: def.troncos.map(() => 0.8),   // el primero llega enseguida
    relojRamas: def.ramas.map(() => 0.6),
    hoguera: false,                              // ¿ha llegado ya?
    seguroX: 160,                                // donde vuelve si cae
    salio: false,
    caidas: 0,
    id: 0,
  };
}

// Lo que la fisica de ella necesita (ver caba-cuerpo.js, `mundo`).
export function mundo(N) {
  return {
    sinSuelo: true,
    x0: 60, x1: N.def.ancho - 40,
    repisas: [],
    bloques: N.tocones.length ? N.suelo.concat(N.tocones) : N.suelo,
  };
}

// ¿Hay camino bajo esta x? (Para que los troncos se caigan por los fosos.)
export function hayCamino(N, x) {
  for (const s of N.suelo) if (x >= s.x0 && x <= s.x1) return true;
  return false;
}

// Donde empieza la hoguera: si ha llegado, alli; si no, el principio.
export function inicio(N) { return N.hoguera ? N.def.hoguera : 160; }

// ---------- La camara ----------
// Va un poco por delante de hacia donde mira: se ve lo que viene. Suave, para
// que girarse en una pelea no la haga dar bandazos, y sin salirse del nivel.
export const CAM_DELANTE = 0.38;
export function camara(N, K, VW, dt, instantanea = false) {
  const obj = K.x - VW * (K.dir >= 0 ? CAM_DELANTE : 1 - CAM_DELANTE);
  const max = N.def.ancho - VW;
  const dest = Math.max(0, Math.min(max, obj));
  N.camX = instantanea ? dest : N.camX + (dest - N.camX) * (1 - Math.exp(-dt * 3.2));
  // Ella nunca se sale de cuadro, vaya la camara como vaya.
  N.camX = Math.max(K.x - VW + 120, Math.min(K.x - 120, N.camX));
  N.camX = Math.max(0, Math.min(max, N.camX));
}

// ---------- Un paso del nivel ----------
// Mueve troncos y ramas, mira si ella ha caido a un foso, si ha llegado a la
// hoguera o a la salida. Devuelve lo que ha pasado, para que la escena ponga el
// polvo y el sonido: [{ tipo, x, y }].
//   tronco     sale un tronco rodando (por la derecha de la pantalla)
//   golpeTronco / golpeRama   le da a ella (ya herida con C.herir)
//   rama       una rama choca contra el camino y se rompe
//   cae        ella se ha caido a un foso (la escena decide si sigue)
//   hoguera    acaba de llegar a la hoguera
//   salida     acaba de llegar a la salida
// y los de los enemigos (ver caba-enemigos.js), con `enemigo` o del fuego:
//   aviso golpe parada bloqueo fuego corro devuelto apagado quema quemado
//   tajo       la espada de ella le da a un enemigo (`muere` si lo tumba)
export function stepNivel(N, K, dt, VW) {
  const ev = [], def = N.def, rnd = N.rnd;

  // --- LOS ENEMIGOS: se mueven despues de ella y al final se arbitra, como
  // en la pelea (ver caballero.js).
  for (const E of N.enemigos) {
    if (E.st === EN.MUERTO && E.muertoT > 2) continue;
    for (const e of EN.stepEnemigo(E, K, dt, rnd, N.fuegos)) { e.enemigo = E; ev.push(e); }
    EN.empuja(E, K);
  }
  ev.push(...EN.stepFuegos(N.fuegos, K, N.enemigos, dt));
  // La espada: UN golpe por tajo (K.golpeo), a todos los que alcance.
  if (C.espadaActiva(K) && !K.golpeo) {
    let dio = false;
    for (const E of N.enemigos) {
      if (!EN.espadaToca(E, K)) continue;
      if (EN.hiere(E, C.danoTajo(K), K.dir)) {
        dio = true;
        if (!E.vivo) N.vencidos++;
        ev.push({ tipo: 'tajo', x: E.x, y: E.y - E.T.alto * 0.55, enemigo: E, muere: !E.vivo, contra: !!K.contra, fuerte: K.combo === 2 });
      }
    }
    if (dio) K.golpeo = 1;
  }
  for (const e of ev) if (e.tipo === 'quemado' && !N.enemigos.find(E => E.id === e.id).vivo) N.vencidos++;

  // --- Donde volveria si cae: el ultimo sitio pisado con suelo a los dos lados.
  if (K.vivo && K.enSuelo && Math.abs(K.y - def.suelo) < 1) {
    for (const s of N.suelo) {
      if (K.x >= s.x0 + SEGURO_MARGEN && K.x <= s.x1 - SEGURO_MARGEN) { N.seguroX = K.x; break; }
    }
  }

  // --- Los troncos: mientras ella este en su zona, uno cada tanto.
  def.troncos.forEach(([x0, x1, cada], i) => {
    if (K.x < x0 || K.x > x1 || !K.vivo) return;
    N.relojTroncos[i] -= dt;
    if (N.relojTroncos[i] > 0) return;
    N.relojTroncos[i] = cada * (0.85 + rnd() * 0.3);
    const x = N.camX + VW + 90;
    if (x > def.ancho + 100) return;
    N.troncos.push({ id: ++N.id, x, y: def.suelo, vy: 0, giro: 0, cae: false });
    ev.push({ tipo: 'tronco', x, y: def.suelo });
  });
  for (const T of N.troncos) {
    T.x -= TRONCO_V * dt;
    T.giro -= TRONCO_V * dt / TRONCO_R;
    // Por un foso se cae: el camino se acaba bajo su centro.
    if (!T.cae && !hayCamino(N, T.x)) { T.cae = true; }
    if (T.cae) { T.vy += TRONCO_G * dt; T.y += T.vy * dt; }
    // ¿Le da a ella? Solo si sus pies estan por debajo de lo alto del tronco.
    // (Con un poco de perdon en los dos ejes: rozarlo con la capa no cuenta.)
    if (!T.fuera && !T.cae && K.vivo && Math.abs(T.x - K.x) < TRONCO_R + C.CUERPO_K - 10 &&
        K.y > T.y - 2 * TRONCO_R + 10) {
      const r = C.herir(K, T.x, 'tronco');
      if (r === true || r === 'rota') ev.push({ tipo: 'golpeTronco', x: T.x, y: T.y - TRONCO_R });
    }
    if (T.x < N.camX - 300 || T.y > def.suelo + 400) T.fuera = true;
  }
  N.troncos = N.troncos.filter(T => !T.fuera);

  // --- Las ramas: caen cerca de ella, un poco por delante de hacia donde va.
  def.ramas.forEach(([x0, x1, cada], i) => {
    if (K.x < x0 || K.x > x1 || !K.vivo) return;
    N.relojRamas[i] -= dt;
    if (N.relojRamas[i] > 0) return;
    N.relojRamas[i] = cada * (0.8 + rnd() * 0.4);
    const x = K.x + K.vx * 0.5 + (rnd() - 0.5) * 120;
    if (N.ramas.some(R => Math.abs(R.x - x) < 90)) return;
    N.ramas.push({ id: ++N.id, x, y: RAMA_Y0, vy: 0, t: 0, fase: 'aviso', giro: rnd() * 6.28 });
  });
  for (const R of N.ramas) {
    R.t += dt;
    if (R.fase === 'aviso') { if (R.t >= RAMA_AVISO) { R.fase = 'cae'; R.vy = RAMA_V0; } continue; }
    R.vy += RAMA_G * dt; R.y += R.vy * dt; R.giro += dt * 5;
    // En toda la caida, no solo al llegar: si salta debajo, la encuentra.
    if (!R.fuera && K.vivo && Math.abs(K.x - R.x) < RAMA_ANCHO / 2 + C.CUERPO_K - 8 &&
        R.y > K.y - 170 && R.y - RAMA_ALTO < K.y) {
      const r = C.herir(K, R.x, 'piedra');
      if (r === true) { ev.push({ tipo: 'golpeRama', x: R.x, y: R.y }); R.fuera = true; continue; }
    }
    if (R.y >= def.suelo && hayCamino(N, R.x)) { R.fuera = true; ev.push({ tipo: 'rama', x: R.x, y: def.suelo }); }
    else if (R.y > def.suelo + 400) R.fuera = true;
  }
  N.ramas = N.ramas.filter(R => !R.fuera);

  // --- Caer a un foso. Solo VIVA: el cuerpo de la que ya perdio sigue cayendo
  // por el foso, y avisarlo otra vez metia la escena en un bucle (fundido a
  // negro, "te ha podido", fundido a negro...) que no acababa nunca: la
  // pantalla "se quedo volviendo negra y encendiendo congelada" (23-09-2026).
  if (K.vivo && K.y > def.suelo + CAIDA_Y && !N.cayo) { N.cayo = true; N.caidas++; ev.push({ tipo: 'cae', x: K.x, y: K.y }); }

  // --- La hoguera y la salida.
  if (!N.hoguera && K.vivo && K.x >= def.hoguera) { N.hoguera = true; ev.push({ tipo: 'hoguera', x: def.hoguera, y: def.suelo }); }
  if (!N.salio && K.vivo && K.x >= def.salida) { N.salio = true; ev.push({ tipo: 'salida', x: def.salida, y: def.suelo }); }
  return ev;
}

// Ella vuelve del foso: un corazon menos, y de pie en el ultimo sitio seguro.
// Si era el ultimo corazon, se acaba (la escena lo ve en K.vivo).
export function vuelveDelFoso(N, K) {
  K.hp = Math.max(0, K.hp - 1);
  if (K.hp <= 0) { K.vivo = false; K.st = C.MUERTO; K.muereT = 0; return false; }
  N.cayo = false;
  K.x = N.seguroX; K.y = N.def.suelo; K.vx = 0; K.vy = 0;
  K.enSuelo = true; K.st = C.QUIETO; K.animT = 0; K.aterriza = 0;
  K.iframe = CAIDA_IFRAME;
  // Nada rodando encima al volver: los troncos que la esperaban se van.
  N.troncos = N.troncos.filter(T => Math.abs(T.x - K.x) > 500);
  N.ramas = [];
  N.fuegos = [];
  return true;
}
