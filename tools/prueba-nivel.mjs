// Arnes del NIVEL de la aventura (www/js/games/caba-nivel.js): mueve el modelo
// real, sin DOM, y mide lo que decide si el bosque es justo.
//
//   node tools/prueba-nivel.mjs
//
// Como los arneses de la pelea: nada de "parece que se puede". Se mide cuanto
// margen hay para cada respuesta (el salto sobre un foso, sobre un tronco, la
// esquiva que lo atraviesa, apartarse de una rama), y un PILOTO con reflejos de
// persona (0.25 s) recorre el nivel entero. Un piloto que reacciona en el mismo
// frame lo haria todo y no demostraria nada (ver la memoria del arnes que
// miente); por eso reacciona tarde, y por eso tambien corre uno TONTO, que solo
// anda hacia la derecha: si el tonto llega, los obstaculos no sirven.

import * as C from '../www/js/games/caba-cuerpo.js';
import * as N from '../www/js/games/caba-nivel.js';
import * as EN from '../www/js/games/caba-enemigos.js';
import * as P from '../www/js/games/caba-partida.js';
import * as MD from '../www/js/games/caba-mandos.js';
import { Stick } from '../www/js/input.js';
import { piloto as decide, REAC } from './piloto-aventura.mjs';

const DT = 1 / 60, VW = 1200;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };
let fallos = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  MAL  ') + msg); if (!c) fallos++; };
const ms = s => Math.round(s * 1000) + ' ms';

// Numeros pseudoaleatorios con semilla (para que el arnes mida siempre igual).
function semilla(s) { return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Un nivel de pruebas con un solo foso [a, b] (y lo que se le pida).
function nivelCon(extra) {
  return { ...N.BOSQUE, fosos: [], tocones: [], troncos: [], ramas: [], enemigos: [], hoguera: 99999, salida: 99999, ...extra };
}

// ============================================================
console.log('\n1. EL SALTO: el foso mas ancho que se cruza, y el margen de cada foso del bosque');
// Corre desde lejos (a tope, o con el stick a `dx`) y salta en el frame k,
// con un TOQUE: el flanco de un frame, como un pulgar. ¿Llega?
function cruza(def, k, conEsquiva = false, dx = 1) {
  const L = N.makeNivel(def, semilla(1));
  const [a] = def.fosos[0];
  const K = C.makeCaballero(a - 520, { y: def.suelo });
  const M = N.mundo(L);
  for (let f = 0; f < 400; f++) {
    const inp = { ...NADA, dx };
    if (f === k) { if (conEsquiva) inp.esquiva = true; else inp.salta = true; }
    C.stepCaballero(K, inp, DT, M);
    if (K.y > def.suelo + 40) return false;                       // se ha caido
    if (f > k && K.enSuelo && K.x > def.fosos[0][1]) return true;  // al otro lado
  }
  return false;
}
function ventana(def, conEsquiva) {
  const buenos = [];
  for (let k = 0; k < 200; k++) if (cruza(def, k, conEsquiva)) buenos.push(k);
  return buenos.length ? { n: buenos.length, desde: buenos[0], hasta: buenos[buenos.length - 1] } : { n: 0 };
}
let maxSalto = 0, maxEsquiva = 0;
for (let w = 60; w <= 420; w += 10) {
  const def = nivelCon({ fosos: [[2000, 2000 + w]] });
  if (ventana(def, false).n > 0) maxSalto = w;
  if (ventana(def, true).n > 0) maxEsquiva = w;
}
console.log('  foso mas ancho que se salta corriendo: ' + maxSalto + ' px; esquivando hacia delante: ' + maxEsquiva + ' px');
ok(maxSalto >= 160, 'se salta un foso de al menos 160 px');
for (const [a, b] of N.BOSQUE.fosos) {
  const w = b - a;
  // El foso ancho tiene su tocon: se mide aparte, en dos saltos.
  if (N.BOSQUE.tocones.some(([t0, t1]) => t0 > a && t1 < b)) continue;
  const v = ventana(nivelCon({ fosos: [[2000, 2000 + w]] }), false);
  console.log('  foso de ' + w + ' px: se llega saltando en ' + v.n + ' frames seguidos (' + ms(v.n * DT) + ')');
  ok(v.n * DT >= 0.2, 'el foso de ' + w + ' px da al menos 200 ms para saltar');
  ok(w <= maxSalto - 30, 'el foso de ' + w + ' px deja 30 px de margen al salto maximo');
}

// ============================================================
console.log('\n1b. EL PULGAR: un toque, el stick a medias y pulsando cerca del borde');
// POR QUE EXISTE (24-09-2026): "morimos facilmente con los huecos, porque al
// oprimir el boton de saltar no es suficiente para pasar el hueco". La
// seccion 1 decia que todo iba bien porque MANTENIA el boton y el stick a
// tope, y un pulgar hace otra cosa: TOCA (50-100 ms; el salto se recortaba si
// se soltaba antes de 90) y mueve el stick unos milimetros (la velocidad iba
// en proporcion, y hacian falta ~10 mm para correr a tope). Con aquello el
// foso de 120 se cruzaba 1 vez de cada 9 con el stick a tope y NINGUNA por
// debajo de 8 mm. Aqui se juega como el pulgar: el stick REAL (input.js) con
// la curva de la escena (caba-mandos.js), un toque de un frame, y pulsando
// alrededor del borde con +-90 ms de error (una persona que apunta al borde).
{
  const stickA = mm => {
    const S = new Stick(MD.STICK_R, MD.STICK_MUERTO);
    S.down({ id: 1, x: 0, y: 0 }); S.move({ id: 1, x: mm / MD.MM, y: 0 });
    return MD.curvaStick(S.dx);
  };
  console.log('  el stick: ' + [1, 2, 3, 4, 4.5, 6].map(mm => mm + ' mm -> ' + Math.round(stickA(mm) * 100) + '%').join(', '));
  ok(stickA(1) === 0, 'con el pulgar apoyado (1 mm de temblor) no se mueve');
  ok(stickA(4.5) === 1, 'con 4.5 mm de pulgar ya corre a tope');
  ok(stickA(3) >= 0.6, 'con 3 mm corre al menos al 60 %');
  // Pulsando alrededor del frame en que su centro cruza el borde, con peso
  // normal (sigma 90 ms): la fraccion de toques que cruzan.
  const pulgar = (w, dx, sigma) => {
    const def = nivelCon({ fosos: [[2000, 2000 + w]] });
    const L = N.makeNivel(def, semilla(1)), K = C.makeCaballero(2000 - 520, { y: def.suelo }), M = N.mundo(L);
    let kB = 0;
    for (let f = 0; f < 400; f++) { C.stepCaballero(K, { ...NADA, dx }, DT, M); if (K.x >= 2000) { kB = f; break; } }
    let p = 0, tot = 0;
    for (let k = kB - 40; k <= kB + 40; k++) {
      const peso = Math.exp(-0.5 * (((k - kB) * DT) / sigma) ** 2);
      tot += peso; if (cruza(def, k, false, dx)) p += peso;
    }
    return p / tot;
  };
  for (const [a, b] of N.BOSQUE.fosos) {
    const w = b - a;
    if (N.BOSQUE.tocones.some(([t0, t1]) => t0 > a && t1 < b)) continue;
    const pa = pulgar(w, stickA(5), 0.09), pb = pulgar(w, stickA(3), 0.09), pc = pulgar(w, stickA(5), 0.12);
    console.log('  foso de ' + w + ' px: con 5 mm de stick lo cruza el ' + Math.round(pa * 100) + ' % de los toques; con 3 mm, el ' +
                Math.round(pb * 100) + ' %; con +-120 ms de error, el ' + Math.round(pc * 100) + ' %');
    ok(pa >= 0.9, 'el foso de ' + w + ' px se cruza con un toque 9 de cada 10 veces (' + Math.round(pa * 100) + ' %)');
    ok(pc >= 0.8, '   y con un pulso peor (+-120 ms), 8 de cada 10 (' + Math.round(pc * 100) + ' %)');
  }
  // EL BORDE PERDONA: cayendo un poco antes del otro lado, se sube. Pero solo
  // por el lado HACIA el que va: por el que se aleja seria una pared invisible
  // (medido al hacerlo: se quedaba clavada a 24 px del borde, sin caerse).
  const def = nivelCon({ fosos: [[2000, 2120]] });
  const L = N.makeNivel(def, semilla(1)), M = N.mundo(L);
  const K = C.makeCaballero(1900, { y: def.suelo });
  for (let f = 0; f < 90; f++) C.stepCaballero(K, { ...NADA, dx: 1 }, DT, M);
  ok(K.y > def.suelo + 40, 'andando sin saltar se cae al foso: el agarre no es una pared en el borde de salida');
}

// ============================================================
console.log('\n2. EL FOSO ANCHO Y SU TOCON: dos saltos');
{
  const [a, b] = N.BOSQUE.fosos.find(([a, b]) => N.BOSQUE.tocones.some(([t0, t1]) => t0 > a && t1 < b));
  const [t0, t1, alto] = N.BOSQUE.tocones.find(([t0, t1]) => t0 > a && t1 < b);
  // Sin el tocon no se puede: si no, el tocon sobraria.
  const sinTocon = ventana(nivelCon({ fosos: [[a, b]] }), false);
  ok(sinTocon.n === 0, 'el foso de ' + (b - a) + ' px NO se cruza de un salto (' + sinTocon.n + ' frames)');
  // Primer salto: al tocon.
  let alTocon = 0;
  for (let k = 0; k < 200; k++) {
    const L = N.makeNivel(nivelCon({ fosos: [[a, b]], tocones: [[t0, t1, alto]] }), semilla(1));
    const K = C.makeCaballero(a - 520, { y: L.def.suelo }), M = N.mundo(L);
    let llego = false;
    for (let f = 0; f < 300 && !llego; f++) {
      C.stepCaballero(K, { ...NADA, dx: f < k + 20 ? 1 : 0, salta: f === k }, DT, M);
      if (K.y > L.def.suelo + 40) break;
      if (f > k && K.enSuelo && K.x >= t0 - C.PIES_R && K.x <= t1 + C.PIES_R && K.y < L.def.suelo - 1) llego = true;
    }
    if (llego) alTocon++;
  }
  console.log('  al tocon (a ' + (t0 - a) + ' px del borde, ' + alto + ' px de alto): ' + alTocon + ' frames (' + ms(alTocon * DT) + ')');
  ok(alTocon * DT >= 0.15, 'el salto al tocon da al menos 150 ms');
  // Segundo salto: del tocon al otro lado, arrancando parada encima.
  let alOtro = 0;
  for (let k = 0; k < 120; k++) {
    const L = N.makeNivel(nivelCon({ fosos: [[a, b]], tocones: [[t0, t1, alto]] }), semilla(1));
    const K = C.makeCaballero((t0 + t1) / 2, { y: L.def.suelo - alto }), M = N.mundo(L);
    let llego = false;
    for (let f = 0; f < 300 && !llego; f++) {
      C.stepCaballero(K, { ...NADA, dx: 1, salta: f === k }, DT, M);
      if (K.y > L.def.suelo + 40) break;
      if (f > k && K.enSuelo && K.x > b) llego = true;
    }
    if (llego) alOtro++;
  }
  console.log('  del tocon al otro lado (' + (b - t1) + ' px): ' + alOtro + ' frames (' + ms(alOtro * DT) + ')');
  ok(alOtro * DT >= 0.15, 'el salto del tocon al otro lado da al menos 150 ms');
}

// ============================================================
console.log('\n3. LOS TRONCOS: saltarlos o atravesarlos esquivando');
// Ella quieta; un tronco sale a 700 px. Se pulsa la respuesta en el frame k.
function contraTronco(k, que, dxResp) {
  const def = nivelCon({});
  const L = N.makeNivel(def, semilla(3));
  const K = C.makeCaballero(1000, { y: def.suelo });
  const M = N.mundo(L);
  L.troncos.push({ id: 1, x: 1700, y: def.suelo, vy: 0, giro: 0, cae: false });
  for (let f = 0; f < 240; f++) {
    const inp = { ...NADA };
    if (f === k) { inp[que] = true; inp.dx = dxResp; }
    const hp = K.hp;
    C.stepCaballero(K, inp, DT, M);
    N.stepNivel(L, K, DT, VW);
    if (K.hp < hp) return false;
    if (!L.troncos.length || L.troncos[0].x < K.x - 200) return true;
  }
  return true;
}
function ventanaTronco(que, dx) {
  let n = 0, primero = -1, ultimo = -1;
  for (let k = 0; k < 200; k++) if (contraTronco(k, que, dx)) { n++; if (primero < 0) primero = k; ultimo = k; }
  return { n, primero, ultimo };
}
{
  const nada = contraTronco(9999, 'salta', 0);
  ok(!nada, 'quieta sin hacer nada, el tronco le da');
  const s = ventanaTronco('salta', 0);
  const e = ventanaTronco('esquiva', 1);        // esquiva HACIA el tronco: lo atraviesa
  const eAtras = ventanaTronco('esquiva', 0);   // esquiva hacia atras: se aleja, y vuelve a llegar
  // Llega en (700 - radio - cuerpo) / 330 s: pulsar antes de eso no sirve.
  console.log('  saltar: ' + s.n + ' frames (' + ms(s.n * DT) + ')   esquivar hacia el: ' + e.n + ' frames (' + ms(e.n * DT) + ')   esquivar hacia atras: ' + eAtras.n + ' frames');
  ok(s.n * DT >= 0.25, 'saltar el tronco da al menos 250 ms');
  ok(e.n * DT >= 0.12, 'atravesarlo esquivando da al menos 120 ms (la esquiva es la respuesta dificil)');
  // La guardia NO lo para: rompe la guardia.
  const def = nivelCon({});
  const L = N.makeNivel(def, semilla(3));
  const K = C.makeCaballero(1000, { y: def.suelo });
  const M = N.mundo(L);
  L.troncos.push({ id: 1, x: 1400, y: def.suelo, vy: 0, giro: 0, cae: false });
  let golpe = false;
  for (let f = 0; f < 120 && !golpe; f++) {
    const hp = K.hp;
    C.stepCaballero(K, { ...NADA, bloquea: true }, DT, M);
    N.stepNivel(L, K, DT, VW);
    if (K.hp < hp) golpe = true;
  }
  ok(golpe, 'con la guardia puesta, el tronco le entra igual');
}
// Un tronco que llega a un foso se cae por el.
{
  const def = nivelCon({ fosos: [[1300, 1440]] });
  const L = N.makeNivel(def, semilla(3));
  const K = C.makeCaballero(900, { y: def.suelo });
  L.troncos.push({ id: 1, x: 1800, y: def.suelo, vy: 0, giro: 0, cae: false });
  let hp = K.hp;
  for (let f = 0; f < 300; f++) { C.stepCaballero(K, NADA, DT, N.mundo(L)); N.stepNivel(L, K, DT, VW); }
  ok(K.hp === hp && L.troncos.length === 0, 'el tronco se cae por el foso y no llega a ella');
}

// ============================================================
console.log('\n4. LAS RAMAS: su sombra avisa, y apartarse basta');
{
  const def = nivelCon({ ramas: [[0, 99999, 1.6]] });
  // Quieta: le caen encima.
  let golpes = 0;
  for (let s = 1; s <= 20; s++) {
    const L = N.makeNivel(def, semilla(s));
    const K = C.makeCaballero(1500, { y: def.suelo });
    for (let f = 0; f < 60 * 4; f++) { C.stepCaballero(K, NADA, DT, N.mundo(L)); N.stepNivel(L, K, DT, VW); }
    if (K.hp < K.hpMax) golpes++;
  }
  ok(golpes >= 15, 'quieta, las ramas le dan (' + golpes + ' de 20)');
  // Con reflejos de persona: 0.25 s despues de ver la sombra, corre hacia el
  // lado contrario al de la sombra durante medio segundo.
  let salvadas = 0, total = 0;
  for (let s = 1; s <= 20; s++) {
    const L = N.makeNivel(def, semilla(s));
    const K = C.makeCaballero(1500, { y: def.suelo });
    const visto = new Map();
    let huye = 0, dir = 0;
    for (let f = 0; f < 60 * 6; f++) {
      for (const R of L.ramas) if (!visto.has(R.id)) visto.set(R.id, f);
      const amenaza = L.ramas.find(R => f - visto.get(R.id) === 15 && Math.abs(R.x - K.x) < 80);
      if (amenaza) { huye = 30; dir = amenaza.x > K.x ? -1 : 1; }
      const inp = { ...NADA, dx: huye > 0 ? dir : 0 };
      if (huye > 0) huye--;
      const hp = K.hp;
      C.stepCaballero(K, inp, DT, N.mundo(L));
      N.stepNivel(L, K, DT, VW);
      if (K.x < 400 || K.x > 2600) K.x = 1500;
      if (K.hp < hp) total++;
    }
    if (K.hp === K.hpMax) salvadas++;
  }
  ok(salvadas >= 17, 'reaccionando a 0.25 s se libra de todas en ' + salvadas + ' de 20 partidas');
  const aviso = N.RAMA_AVISO + Math.sqrt(2 * (def.suelo - N.RAMA_Y0) / N.RAMA_G);
  console.log('  de la sombra al golpe: unos ' + ms(aviso));
  ok(aviso >= 1.0, 'la rama avisa al menos 1 s antes de llegar al suelo');
}

// ============================================================
console.log('\n5. CAER A UN FOSO: un corazon, y se vuelve a un sitio seguro');
{
  const def = nivelCon({ fosos: [[1300, 1440]] });
  const L = N.makeNivel(def, semilla(5));
  const K = C.makeCaballero(900, { y: def.suelo });
  let cae = false;
  for (let f = 0; f < 400 && !cae; f++) {
    C.stepCaballero(K, { ...NADA, dx: 1 }, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) if (e.tipo === 'cae') cae = true;
  }
  ok(cae, 'andando sin saltar, se cae al foso');
  const hp = K.hp;
  const sigue = N.vuelveDelFoso(L, K);
  ok(sigue && K.hp === hp - 1, 'vuelve con un corazon menos');
  ok(K.x < 1300 - 50 && K.enSuelo && K.y === def.suelo, 'de pie en el camino, lejos del borde (x=' + Math.round(K.x) + ')');
  // Y ahi no se vuelve a caer sola: quieta un rato, sigue en el camino.
  for (let f = 0; f < 120; f++) { C.stepCaballero(K, NADA, DT, N.mundo(L)); N.stepNivel(L, K, DT, VW); }
  ok(K.enSuelo && K.y === def.suelo, 'quieta al volver, no se cae');
  // Con el ultimo corazon, se acaba.
  K.hp = 1; K.y = def.suelo + 300;
  ok(N.vuelveDelFoso(L, K) === false && !K.vivo, 'con el ultimo corazon, caer la derrota');
  // Y el cuerpo sigue cayendo por el foso SIN volver a avisar: cada aviso
  // devolvia la escena a 'cae' y la partida no acababa nunca (el bucle de
  // fundidos a negro del 23-09-2026).
  let otra = 0;
  for (let f = 0; f < 600; f++) {
    C.stepCaballero(K, NADA, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) if (e.tipo === 'cae') otra++;
  }
  ok(otra === 0, 'derrotada en el foso, el cuerpo no avisa otra caida en 10 s (' + otra + ')');
}
// Si pierde el ultimo corazon EN EL AIRE sobre un foso (un golpe en pleno
// salto), el cuerpo cae por el sin contar como caida.
{
  const def = nivelCon({ fosos: [[1300, 1440]] });
  const L = N.makeNivel(def, semilla(5));
  const K = C.makeCaballero(1370, { y: def.suelo - 150 });
  K.enSuelo = false; K.hp = 0; K.vivo = false; K.st = C.MUERTO; K.muereT = 0;
  let avisos = 0;
  for (let f = 0; f < 600; f++) {
    C.stepCaballero(K, NADA, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) if (e.tipo === 'cae') avisos++;
  }
  ok(K.y > def.suelo + 300 && avisos === 0, 'derrotada en el aire sobre un foso, cae sin avisar caida (y=' + Math.round(K.y) + ', ' + avisos + ' avisos)');
}
// La esquiva hacia ATRAS (sin stick) se queda en el borde; la de hacia
// delante (con stick) cruza: esa se elige.
{
  const def = nivelCon({ fosos: [[1300, 1440]] });
  const L = N.makeNivel(def, semilla(5));
  const K = C.makeCaballero(1480, { y: def.suelo });     // de espaldas al foso, mirando a la derecha
  for (let f = 0; f < 60; f++) C.stepCaballero(K, { ...NADA, esquiva: f === 0 }, DT, N.mundo(L));
  ok(K.enSuelo && K.y === def.suelo && K.x >= 1440 - C.PIES_R, 'esquivando hacia atras al borde de un foso, se queda en el borde (x=' + Math.round(K.x) + ')');
  const K2 = C.makeCaballero(1250, { y: def.suelo });
  for (let f = 0; f < 60; f++) C.stepCaballero(K2, { ...NADA, dx: f < 2 ? 1 : 0, esquiva: f === 1 }, DT, N.mundo(L));
  ok(K2.enSuelo && K2.x > 1440, 'esquivando hacia delante, cruza el foso (x=' + Math.round(K2.x) + ')');
}

// ============================================================
console.log('\n6. LA CAMARA: ella siempre en cuadro, y sin salirse del nivel');
{
  const L = N.makeNivel(N.BOSQUE, semilla(6));
  const K = C.makeCaballero(160, { y: N.BOSQUE.suelo });
  let peor = 0, fuera = false;
  for (let f = 0; f < 60 * 40; f++) {
    // corre, y de vez en cuando se da la vuelta
    const dx = Math.sin(f / 90) > -0.3 ? 1 : -1;
    C.stepCaballero(K, { ...NADA, dx }, DT, N.mundo(L));
    if (K.y > N.BOSQUE.suelo) { K.y = N.BOSQUE.suelo; K.enSuelo = true; K.vy = 0; }
    N.camara(L, K, VW, DT);
    const sx = K.x - L.camX;
    if (sx < 100 || sx > VW - 100) fuera = true;
    peor = Math.max(peor, Math.abs(sx - VW / 2));
    if (L.camX < 0 || L.camX > N.BOSQUE.ancho - VW) fuera = true;
  }
  ok(!fuera, 'ella nunca a menos de 100 px del borde y la camara dentro del nivel');
}

// ============================================================
console.log('\n7. EL PILOTO: recorre el bosque entero, enemigos incluidos, con reflejos de persona');
// El piloto es el de tools/piloto-aventura.mjs (el mismo que se ve en la
// grabadora): reacciona REAC frames despues de ver cada cosa, nunca antes.
function recorre(sem, tonto = false, reac = REAC, dif = 'normal', machacon = false) {
  const def = N.BOSQUE;
  const L = N.makeNivel(def, semilla(sem), P.opcionesBosque(dif));
  const K = C.makeCaballero(160, { y: def.suelo, ...P.opcionesElla(dif) });
  const m = {};
  let esperaVuelta = 0, t = 0, golpes = 0;
  for (let f = 0; f < 60 * 300; f++) {
    t += DT;
    if (esperaVuelta > 0) { esperaVuelta--; if (!esperaVuelta && !N.vuelveDelFoso(L, K)) return { llego: false, t, caidas: L.caidas, hp: 0, x: K.x, golpes }; continue; }
    const inp = tonto ? { ...NADA, dx: 1 } : decide(f, K, L, m, sem, reac, machacon);
    const hp = K.hp;
    C.stepCaballero(K, inp, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) {
      if (e.tipo === 'cae') esperaVuelta = 30;
      if (e.tipo === 'salida') return { llego: true, t, caidas: L.caidas, hp: K.hp, vencidos: L.vencidos, golpes };
    }
    if (K.hp < hp) golpes++;
    N.camara(L, K, VW, DT);
    if (!K.vivo) return { llego: false, t, caidas: L.caidas, hp: 0, x: K.x, golpes };
  }
  return { llego: false, t, caidas: L.caidas, hp: K.hp, x: K.x, golpes };
}
{
  const res = [];
  for (let s = 1; s <= 12; s++) res.push(recorre(s));
  const llegan = res.filter(r => r.llego);
  const media = llegan.reduce((a, r) => a + r.t, 0) / Math.max(1, llegan.length);
  const vida = llegan.reduce((a, r) => a + r.hp, 0) / Math.max(1, llegan.length);
  console.log('  llega en ' + llegan.length + ' de 12, en ' + media.toFixed(1) + ' s de media, con ' + vida.toFixed(1) +
              ' de 4 corazones; enemigos vencidos: ' + llegan.map(r => r.vencidos).join(' '));
  for (const r of res) if (!r.llego) console.log('    no llega: acaba en x=' + Math.round(r.x) + ' tras ' + r.t.toFixed(1) + ' s (' + r.golpes + ' golpes, ' + r.caidas + ' caidas)');
  ok(llegan.length >= 10, 'el piloto llega a la salida en al menos 10 de 12 partidas');
  // Y uno con los reflejos de una persona normal (0.45 s: ver `reflejos` en
  // caba-partida.js), en las tres dificultades. Este piloto se sabe todas las
  // respuestas (devuelve las bolas, guarda las distancias): lo que dice es si
  // con reflejos normales SE PUEDE, y si FURIA muerde mas. Lo que cuesta
  // aprenderlas no lo mide. (Con 0.35, los reflejos que pide FURIA, las dos
  // salian sin un rasguño y la comparacion no decia nada.)
  const perdidosDe = {};
  for (const dif of ['paseo', 'normal', 'furia']) {
    const rs = [];
    for (let s = 1; s <= 12; s++) rs.push(recorre(s, false, 27, dif));
    const ll = rs.filter(r => r.llego);
    const perdidos = rs.reduce((a, r) => a + (P.DIFICULTADES[dif].corazones - r.hp), 0) / rs.length;
    perdidosDe[dif] = perdidos;
    console.log('  con 0.45 s de reflejos, en ' + dif + ': llega en ' + ll.length + ' de 12, perdiendo ' + perdidos.toFixed(2) +
                ' corazones de media (de ' + P.DIFICULTADES[dif].corazones + ')');
    if (dif !== 'furia') ok(ll.length >= 11, 'en ' + dif + ', con reflejos normales, se pasa casi siempre');
  }
  ok(perdidosDe.furia > perdidosDe.normal, 'FURIA muerde mas que NORMAL');
  // EL MACHACON: salta los fosos y los troncos y ataca, pero no se defiende.
  // Si pasara, la guardia, la esquiva y apartarse sobrarian.
  {
    const rs = [];
    for (let s = 1; s <= 12; s++) rs.push(recorre(s, false, 21, 'normal', true));
    const ll = rs.filter(r => r.llego).length;
    console.log('  el machacon (ataca y salta, no se defiende), en normal: llega en ' + ll + ' de 12');
    ok(ll <= 3, 'sin defenderse, no se pasa');
  }
  const tonto = recorre(1, true);
  console.log('  el tonto (solo corre): ' + (tonto.llego ? 'LLEGA' : 'no llega') + ', ' + tonto.caidas + ' caidas');
  ok(!tonto.llego, 'el que solo corre no llega: los obstaculos cuentan');
}

// ============================================================
console.log('\n8. EL LOBO: el zarpazo se para (y a tiempo, PARADA); la acometida se esquiva');
// Ella quieta en 1000 mirando al lobo. La respuesta se da k frames despues de
// que empiece el aviso. Resultado: 'golpe', 'parada', 'bloqueo' o 'libre'.
function contraLobo(atk, resp, k) {
  const def = nivelCon({ enemigos: [['lobo', atk === 'zarpazo' ? 1130 : 1270]] });
  const L = N.makeNivel(def, semilla(8));
  const K = C.makeCaballero(1000, { y: def.suelo });
  const E = L.enemigos[0];
  E.despierto = true; E.recarga = 0;
  let empezo = -1, res = null;
  for (let f = 0; f < 150; f++) {
    if (empezo < 0 && E.st === EN.AVISO) { empezo = f; E.atk = atk; }
    const inp = { ...NADA };
    if (empezo >= 0 && f >= empezo + k) {
      if (resp === 'guardia') inp.bloquea = true;
      if (f === empezo + k) {
        if (resp === 'esquivaHacia') { inp.esquiva = true; inp.dx = 1; }
        if (resp === 'esquivaAtras') inp.esquiva = true;
        if (resp === 'salta') inp.salta = true;
      }
    }
    const hp = K.hp;
    C.stepCaballero(K, inp, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) {
      if (e.tipo === 'parada') res = 'parada';
      else if (e.tipo === 'bloqueo') res = res || 'bloqueo';
    }
    if (K.hp < hp) return 'golpe';
    if (empezo >= 0 && E.st === EN.RECUPERA) return res || 'libre';
  }
  return res || 'libre';
}
function ventanaLobo(atk, resp, que = r => r !== 'golpe') {
  let n = 0;
  for (let k = 0; k < 60; k++) if (que(contraLobo(atk, resp, k))) n++;
  return n;
}
{
  ok(contraLobo('zarpazo', 'nada', 0) === 'golpe', 'zarpazo sin hacer nada: le da');
  const g = ventanaLobo('zarpazo', 'guardia'), p = ventanaLobo('zarpazo', 'guardia', r => r === 'parada');
  console.log('  zarpazo: la guardia lo para en ' + g + ' frames (' + ms(g * DT) + '); de ellos, PARADA en ' + p + ' (' + ms(p * DT) + ')');
  ok(g * DT >= 0.25, 'la guardia para el zarpazo con al menos 250 ms de margen');
  ok(p * DT >= 0.15, 'la parada del zarpazo tiene al menos 150 ms');
  ok(contraLobo('zarpazo', 'guardia', REAC) !== 'golpe', 'levantando la guardia a los 0.25 s del aviso, lo para');
  ok(contraLobo('acomete', 'nada', 0) === 'golpe', 'acometida sin hacer nada: le da');
  ok(ventanaLobo('acomete', 'guardia') === 0, 'la guardia NO para la acometida (le rompe la guardia)');
  const e = ventanaLobo('acomete', 'esquivaHacia'), s = ventanaLobo('acomete', 'salta'), a = ventanaLobo('acomete', 'esquivaAtras');
  console.log('  acometida: esquivando hacia el ' + e + ' frames (' + ms(e * DT) + '), saltando ' + s + ' (' + ms(s * DT) + '), esquivando hacia atras ' + a);
  ok(e * DT >= 0.2, 'atravesar la acometida esquivando da al menos 200 ms');
  ok(contraLobo('acomete', 'esquivaHacia', REAC) !== 'golpe', 'esquivando a los 0.25 s del aviso, la atraviesa');
}
// EL REPERTORIO: un lobo solo usa los ataques que el nivel dice que sabe. (El
// primero en llevar repertorio, 24-09-2026, acometia sin saber: la acometida
// se elegia por distancia sin mirarlo, y lo delato una grabacion.)
{
  for (const [sabe, dist] of [[['zarpazo'], 250], [['barre'], 250], [['zarpazo'], 110], [['acomete'], 110]]) {
    const def = nivelCon({ enemigos: [['lobo', 1000 + dist, undefined, { ataques: sabe }]] });
    const L = N.makeNivel(def, semilla(4), P.opcionesBosque('normal'));
    const K = C.makeCaballero(1000, { y: def.suelo, hp: 999 });
    K.hpMax = 999;
    const usados = new Set();
    for (let f = 0; f < 60 * 30; f++) {
      C.stepCaballero(K, { ...NADA, dx: f % 240 < 120 ? 0.3 : -0.3 }, DT, N.mundo(L));
      for (const e of N.stepNivel(L, K, DT, VW)) if (e.tipo === 'aviso') usados.add(e.atk);
      K.iframe = 0.5;
    }
    ok([...usados].every(a => sabe.includes(a)), 'un lobo que solo sabe ' + sabe + ' (ella a ' + dist + ' px) usa: ' + ([...usados].join(', ') || 'nada'));
  }
}
// Un combo entero lo tumba: tres tajos (1 + 1 + 2) contra sus 3 de vida.
{
  const def = nivelCon({ enemigos: [['lobo', 1100]] });
  const L = N.makeNivel(def, semilla(9));
  const K = C.makeCaballero(1000, { y: def.suelo });
  const E = L.enemigos[0]; E.despierto = true; E.recarga = 5;
  for (let f = 0; f < 90; f++) {
    C.stepCaballero(K, { ...NADA, golpea: f % 16 === 0 && f < 48 }, DT, N.mundo(L));
    N.stepNivel(L, K, DT, VW);
  }
  ok(!E.vivo, 'un combo entero de tres tajos tumba al lobo');
}

// ============================================================
console.log('\n9. LA KITSUNE: la bola se para (y con PARADA se devuelve); del corro hay que apartarse');
function contraKitsune(atk, resp, k) {
  const def = nivelCon({ enemigos: [['kitsune', atk === 'lanza' ? 1500 : 1120]] });
  const L = N.makeNivel(def, semilla(10));
  const K = C.makeCaballero(1000, { y: def.suelo });
  const E = L.enemigos[0];
  E.despierto = true; E.recarga = 0;
  let empezo = -1, res = null;
  for (let f = 0; f < 200; f++) {
    if (empezo < 0 && E.st === EN.AVISO) empezo = f;
    const inp = { ...NADA };
    if (empezo >= 0 && f >= empezo + k) {
      if (resp === 'guardia') inp.bloquea = true;
      if (resp === 'aparta') inp.dx = -1;
      if (f === empezo + k) {
        if (resp === 'esquivaHacia') { inp.esquiva = true; inp.dx = 1; }
        if (resp === 'esquivaAtras') inp.esquiva = true;
        if (resp === 'salta') inp.salta = true;
      }
    }
    const hp = K.hp;
    C.stepCaballero(K, inp, DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) {
      if (e.tipo === 'devuelto') res = 'devuelto';
      else if (e.tipo === 'apagado') res = res || 'apagado';
    }
    if (K.hp < hp) return 'golpe';
    if (atk === 'lanza' && empezo >= 0 && E.st !== EN.AVISO && !L.fuegos.some(F => !F.propio && !F.fin) && f > empezo + 40) return res || 'libre';
    if (atk === 'corro' && E.st === EN.AGOTADA) return 'libre';
  }
  return res || 'libre';
}
function ventanaKitsune(atk, resp, que = r => r !== 'golpe') {
  let n = 0;
  for (let k = 0; k < 120; k++) if (que(contraKitsune(atk, resp, k))) n++;
  return n;
}
{
  ok(contraKitsune('lanza', 'nada', 0) === 'golpe', 'bola de fuego sin hacer nada: le da');
  const g = ventanaKitsune('lanza', 'guardia'), p = ventanaKitsune('lanza', 'guardia', r => r === 'devuelto');
  const s = ventanaKitsune('lanza', 'salta'), e = ventanaKitsune('lanza', 'esquivaHacia');
  console.log('  bola: la guardia la para en ' + g + ' frames, la DEVUELVE en ' + p + ' (' + ms(p * DT) + '); saltando se libra en ' + s + '; esquivando hacia ella en ' + e + ' (' + ms(e * DT) + ')');
  ok(g * DT >= 0.5, 'la guardia para la bola con al menos 500 ms de margen (se la ve venir)');
  ok(p * DT >= 0.15, 'devolverla con una parada tiene al menos 150 ms');
  ok(s === 0, 'saltar no la libra: va a la altura del pecho');
  // La devuelta le quema a ella.
  {
    const def = nivelCon({ enemigos: [['kitsune', 1500]] });
    const L = N.makeNivel(def, semilla(10));
    const K = C.makeCaballero(1000, { y: def.suelo });
    const E = L.enemigos[0]; E.despierto = true; E.recarga = 0;
    let quemada = false;
    for (let f = 0; f < 240 && !quemada; f++) {
      const F = L.fuegos.find(F => !F.propio && !F.fin);
      // la guardia se levanta justo para la parada: 0.2 s antes de que llegue
      const llega = F ? (F.x - K.x - EN.FUEGO_R - C.CUERPO_K) / Math.abs(F.vx) : 9;
      C.stepCaballero(K, { ...NADA, bloquea: !!F && llega < 0.2 }, DT, N.mundo(L));
      for (const e of N.stepNivel(L, K, DT, VW)) if (e.tipo === 'quemado') quemada = true;
    }
    ok(quemada && E.hp === 1, 'la bola devuelta le quema a ella (vida ' + E.hp + ' de 2)');
  }
  ok(contraKitsune('corro', 'nada', 0) === 'golpe', 'corro de fuego sin hacer nada: le da');
  ok(ventanaKitsune('corro', 'guardia') === 0, 'la guardia NO para el corro');
  const ap = contraKitsune('corro', 'aparta', REAC), ea = contraKitsune('corro', 'esquivaAtras', REAC);
  console.log('  corro: apartandose andando a los 0.25 s: ' + ap + '; esquivando hacia atras a los 0.25 s: ' + ea);
  ok(ap !== 'golpe' || ea !== 'golpe', 'apartarse a tiempo libra del corro');
}

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTODO OK');
process.exit(fallos ? 1 : 0);
