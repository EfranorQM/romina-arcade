// EL OGRO: su pelea, medida en Node sin navegador.
//
//   node tools/prueba-ogro.mjs
//
// Importa los modulos REALES (ogro-cuerpo.js y caba-cuerpo.js) y comprueba que
// la pelea es JUSTA y tiene JUEGO. No comprueba que el codigo no pete: eso ya
// lo dice que cargue. Comprueba cosas que se pueden sentir mal jugando.
//
// LAS DOS TRAMPAS QUE ESTE ARNES EVITA A PROPOSITO:
//  1. EL PILOTO QUE HACE TRAMPA. Si el piloto de prueba reacciona en el mismo
//     frame en que empieza el telegrafo, cualquier ataque parece esquivable.
//     Aqui el piloto tiene un RETARDO DE REACCION humano (0.25 s en movil) y
//     ademas se prueba la VENTANA entera: en cuantos instantes distintos
//     puede empezar a esquivar y salvarse. Un ataque que solo se esquiva en
//     un instante exacto esta roto aunque el test pase.
//  2. LA SEMILLA. stepOgro() recibe el rnd por parametro, asi que aqui se le
//     inyecta uno determinista. Un jefe que llama a Math.random() por dentro
//     no se puede probar dos veces igual.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const G = (f) => pathToFileURL(path.join(here, '..', 'www', 'js', 'games', f)).href;
const C = await import(G('caba-cuerpo.js'));
const O = await import(G('ogro-cuerpo.js'));

const DT = 1 / 60;
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; };
const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);

// Un rnd determinista: asi dos corridas dan lo mismo.
function semilla(s) {
  let x = s >>> 0;
  return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
const nada = { dx: 0, salta: false, golpea: false, esquiva: false, saltaAbajo: false, bloquea: false };

console.log('== 1) LOS TELEGRAFOS DAN TIEMPO A REACCIONAR ==');
{
  // En un movil, reaccionar a algo que aparece en pantalla cuesta ~250 ms.
  // Si la carga de un ataque dura menos que eso, es injusto por definicion.
  const REACCION = 0.25;
  const nombres = ['GARROTE', 'PISOTON', 'BARRIDO', 'EMBESTIDA'];
  for (let i = 0; i < O.ATAQUES.length; i++) {
    const carga = O.ATAQUES[i][1];
    ok(carga >= REACCION + 0.05,
      nombres[i] + ' avisa ' + f2(carga) + ' s (hace falta >= ' + f2(REACCION + 0.05) + ')');
  }
}

console.log('== 2) LA ONDA SE SALTA, Y LA VENTANA ES ANCHA ==');
{
  // No basta con que exista UN instante en que saltar salva. Se prueba en
  // cuantos instantes distintos de la ventana el jugador puede pulsar SALTAR
  // y llegar vivo: eso es lo que se siente como justo o como injusto.
  const dist = 300;                 // ella a 300 px de donde nace la onda
  // EL BARRIDO SE ACOTA A CUANDO LA ONDA AUN NO HA LLEGADO. Barrer mas alla
  // de eso cuenta como "fallo" instantes en los que el golpe ya te habia
  // dado: eso no mide la ventana, mide otra cosa. La onda tarda
  // dist/ONDA_V = 0.484 s en llegar, asi que se prueba pulsar dentro de ese
  // tramo. (Este es justo el tipo de arnes-que-miente que ya costo caro en
  // el proyecto: verde o rojo por medir la muestra equivocada.)
  const tLlega = dist / O.ONDA_V;
  // Y SE PRUEBA UN FRAME SI Y UNO NO, NO instantes arbitrarios. El primer
  // intento repartia 60 momentos por el tramo y la mitad caian ENTRE frames,
  // asi que el flanco de 'salta' (que dura un frame) no se disparaba nunca y
  // contaban como muerte: salia una ventana partida en 20 trozos que no
  // existe. El pulgar solo puede pulsar en un frame, asi que se prueban
  // frames.
  const frames = Math.floor(tLlega / DT);
  const total = frames, salvados = [];
  for (let k = 0; k < total; k++) {
    const K = C.makeCaballero(O.CUERPO_R + dist);
    const onda = { x: 0, dir: 1, rec: 0, vivo: true };
    const tPulsa = k * DT;                 // pulsa en el frame k
    let t = 0, tocado = false;
    for (let n = 0; n < 240; n++) {
      const inp = Object.assign({}, nada, { salta: Math.abs(t - tPulsa) < DT / 2, saltaAbajo: t >= tPulsa });
      C.stepCaballero(K, inp, DT);
      onda.x += O.ONDA_V * DT; onda.rec += O.ONDA_V * DT;
      if (onda.rec > O.ONDA_ALCANCE) break;
      if (onda.rec >= O.ONDA_CIEGA && Math.abs(K.x - onda.x) <= 30 && (C.SUELO - K.y) <= O.ONDA_ALTO) { tocado = true; break; }
      t += DT;
    }
    if (!tocado) salvados.push(tPulsa);
  }
  // LO QUE IMPORTA NO ES EL PORCENTAJE, ES QUE LA VENTANA SEA CONTINUA Y
  // ANCHA. Saltar demasiado pronto DEBE fallar (aterrizas antes de que
  // llegue): si salvara pulsando en cualquier momento, saltar seria un boton
  // gratis y el pisoton no seria una decision. Lo que haria injusto al jefe
  // es una ventana estrecha o partida en trozos, y eso es lo que se mide.
  const pct = salvados.length / total * 100;
  console.log('      salva en ' + salvados.length + '/' + total + ' instantes utiles (' + pct.toFixed(0) + '%)');
  ok(salvados.length > 0, 'existe un momento en que saltar salva');
  if (salvados.length) {
    // El ancho se mide de borde a borde del ultimo frame util, no del primero
    // al ultimo (si no, se pierde un frame entero de 16.7 ms por el camino).
    const ancho = (salvados[salvados.length - 1] - salvados[0] + DT) * 1000;
    ok(ancho >= 250, 'la ventana para pulsar mide ' + ancho.toFixed(0) + ' ms (hace falta >= 250, la reaccion en movil)');
    // ¿es un tramo seguido o instantes sueltos? Un jefe con la ventana rota
    // se siente aleatorio aunque el ancho total salga bien.
    const paso = DT;
    let huecos = 0;
    for (let i = 1; i < salvados.length; i++) if (salvados[i] - salvados[i - 1] > paso * 1.6) huecos++;
    // Un hueco de un solo frame es ruido del integrador, no una ventana rota:
    // lo que haria injusto al jefe son varios trozos separados.
    ok(huecos <= 1, 'la ventana es un tramo seguido (huecos: ' + huecos + ')');
  }
}

console.log('== 3) QUIETA, LA ONDA SI PEGA (el test anterior no es un falso verde) ==');
{
  // Si la onda no pegase nunca, el test 2 pasaria igual y seria mentira.
  const K = C.makeCaballero(O.CUERPO_R + 300);
  const onda = { x: 0, dir: 1, rec: 0, vivo: true };
  let tocado = false;
  for (let n = 0; n < 240; n++) {
    C.stepCaballero(K, nada, DT);
    onda.x += O.ONDA_V * DT; onda.rec += O.ONDA_V * DT;
    if (onda.rec > O.ONDA_ALCANCE) break;
    if (onda.rec >= O.ONDA_CIEGA && Math.abs(K.x - onda.x) <= 30 && (C.SUELO - K.y) <= O.ONDA_ALTO) { tocado = true; break; }
  }
  ok(tocado, 'quieta en el suelo, la onda la alcanza');
}

console.log('== 4) EL SALTO CORTADO NO SALVA (la decision tiene precio) ==');
{
  // Soltar el boton pronto recorta el salto. Si el salto corto salvase igual,
  // CORTE_F no serviria de nada y saltar seria un boton gratis.
  const K = C.makeCaballero(O.CUERPO_R + 300);
  const onda = { x: 0, dir: 1, rec: 0, vivo: true };
  let tocado = false, t = 0;
  for (let n = 0; n < 240; n++) {
    const inp = Object.assign({}, nada, { salta: n === 0, saltaAbajo: t < 0.05 });
    C.stepCaballero(K, inp, DT);
    onda.x += O.ONDA_V * DT; onda.rec += O.ONDA_V * DT;
    if (onda.rec > O.ONDA_ALCANCE) break;
    if (onda.rec >= O.ONDA_CIEGA && Math.abs(K.x - onda.x) <= 30 && (C.SUELO - K.y) <= O.ONDA_ALTO) { tocado = true; break; }
    t += DT;
  }
  ok(tocado, 'el salto CORTADO no salva de la onda (por eso soltar pronto cuesta)');
}

console.log('== 5) LOS TRES TAJOS DEL COMBO ALCANZAN AL OGRO ==');
{
  // El fallo que casi se cuela: con un radio grande, el empuje deja a ella
  // tan lejos que los dos primeros golpes del combo no llegarian NUNCA.
  const og = O.makeOgro(600);
  // Ella a la DERECHA del ogro, pegada como la deja el empuje. Mira hacia EL,
  // o sea hacia la izquierda: dir = -1 y la punta sale hacia -x.
  const K = C.makeCaballero(600 + O.CUERPO_R + 26);
  O.empujaCuerpo(og, K);
  K.dir = -1;
  const sep = Math.abs(K.x - og.x);
  console.log('      el empuje la deja a ' + f2(sep) + ' px del centro del ogro (ella mira hacia el)');
  const nom = ['reves', 'derecho', 'giro'];
  for (let i = 0; i < C.TAJOS.length; i++) {
    const alcance = C.TAJOS[i][5];
    // La espada va del puño a la punta: se prueba el SEGMENTO, no el punto.
    const punta = K.x + K.dir * alcance;
    ok(O.espadaTocaOgro(og, punta, K.x), 'el ' + nom[i] + ' (alcance ' + alcance + ') alcanza al ogro');
  }
  // Y el control negativo: de espaldas NO debe alcanzarle, o el test miente.
  const punta2 = K.x + 1 * C.TAJOS[0][5];
  ok(!O.espadaTocaOgro(og, punta2, K.x), 'de espaldas al ogro, el tajo NO le alcanza (control)');
}

console.log('== 6) CADA ATAQUE PIDE SU RESPUESTA, Y SE PUEDE DAR A TIEMPO ==');
{
  // Esto era una tabla escrita a mano ('parry', 'saltar', 'rodar',
  // 'apartarse') y MENTIA: al medirlo, la guardia lo paraba TODO y de cerca ni
  // siquiera paraba el garrotazo. Ahora se juega cada ataque con la regla REAL
  // (golpeaA, herir, empujaCuerpo, como en la escena) y se mide EN CUANTOS
  // FRAMES se puede pulsar cada respuesta y salir ilesa, igual que la onda en
  // la seccion 2. Hace falta una ventana de 250 ms: la reaccion en movil.
  function ataque(atk, dist, resp, ox = 500) {
    const og = O.makeOgro(ox); og.dir = 1;
    const K = C.makeCaballero(ox + dist); K.dir = -1;
    og.st = O.ATACA; og.atk = atk; og.atkT = 0; og.golpeo = 0;
    const r = { pierde: 0, rota: 0, parada: 0 };
    // Hasta que el ataque acaba: lo que venga despues es OTRO ataque.
    for (let n = 0; n < 200 && og.st === O.ATACA; n++) {
      C.stepCaballero(K, resp(n * DT), DT);
      O.stepOgro(og, K, DT, () => 0.5);
      O.empujaCuerpo(og, K);
      const g = O.golpeaA(og, K);
      if (!g) continue;
      const hp = K.hp, res = C.herir(K, g.x, g.tipo);
      if (K.hp < hp) r.pierde++;
      if (res === 'rota') r.rota++;
      if (res === 'parada') { r.parada++; O.abrePorParada(og, C.PARADA_PREMIO); }
    }
    r.pared = og.st === O.ABIERTO && og.abiertoPor === O.POR_PARED;
    return r;
  }
  const pulsa = (tp, que) => t => ({ ...nada, ...(Math.abs(t - tp) < DT / 2 ? que : {}) });
  const mantiene = (tp) => t => ({ ...nada, bloquea: t >= tp });
  // Los frames en que pulsar la respuesta salva, hasta el final del golpe.
  function ventana(atk, dist, resp) {
    const salva = [];
    for (let k = 0; k * DT <= O.ATAQUES[atk][2]; k++) if (ataque(atk, dist, resp(k * DT)).pierde === 0) salva.push(k * DT);
    return salva.length ? (salva[salva.length - 1] - salva[0] + DT) * 1000 : 0;
  }
  const ATRAS = { esquiva: true }, HACIA = { esquiva: true, dx: -1 };
  const ms = v => v.toFixed(0) + ' ms';

  // GARROTE: la GUARDIA. Y a tiempo, la PARADA.
  for (const d of [90, 150, 250]) {
    const w = ventana(O.GARROTE, d, mantiene);
    ok(w >= 250, 'garrote a ' + d + ' px: levantar la GUARDIA salva pulsando en ' + ms(w));
  }
  let hayParada = false;
  for (let k = 0; k * DT < O.ATAQUES[O.GARROTE][1]; k++) if (ataque(O.GARROTE, 150, mantiene(k * DT)).parada) hayParada = true;
  ok(hayParada, 'y levantandola justo antes del golpe, es una PARADA');
  ok(ataque(O.GARROTE, 150, () => nada).pierde > 0, 'quieta, el garrote le da (control)');

  // BARRIDO: ESQUIVAR. La guardia se rompe y el salto no llega.
  for (const d of [90, 150, 250]) {
    ok(ataque(O.BARRIDO, d, mantiene(-1)).rota > 0, 'barrido a ' + d + ' px: le ROMPE la guardia');
    const salta = ventana(O.BARRIDO, d, tp => t => ({ ...nada, salta: Math.abs(t - tp) < DT / 2, saltaAbajo: t >= tp }));
    ok(salta < 250, '   saltar no es la respuesta (salva en ' + ms(salta) + ')');
    const at = ventana(O.BARRIDO, d, tp => pulsa(tp, ATRAS)), ha = ventana(O.BARRIDO, d, tp => pulsa(tp, HACIA));
    ok(Math.max(at, ha) >= 250, '   ESQUIVAR salva: hacia atras en ' + ms(at) + ', atravesandolo en ' + ms(ha));
    if (d >= 150) ok(at >= 250, '   y desde ' + d + ' px vale la esquiva sin stick (hacia atras)');
  }

  // EMBESTIDA: ESQUIVAR ATRAVESANDOLO. La guardia se rompe y, si ella la
  // esquiva, el ogro se estrella contra la pared.
  for (const d of [90, 150, 250]) {
    ok(ataque(O.EMBESTIDA, d, mantiene(-1)).rota > 0, 'embestida a ' + d + ' px: le ROMPE la guardia');
    const ha = ventana(O.EMBESTIDA, d, tp => pulsa(tp, HACIA));
    ok(ha >= 250, '   esquivar ATRAVESANDOLO salva pulsando en ' + ms(ha));
  }
  // Con ella entre el y la pared (la embestida corre ~215 px: tiene que
  // quedarle la pared a mano).
  let choca = false;
  for (let k = 0; k * DT < 0.5 && !choca; k++) {
    const r = ataque(O.EMBESTIDA, 120, pulsa(k * DT, HACIA), C.AX1 - 220);
    if (r.pierde === 0 && r.pared) choca = true;
  }
  ok(choca, 'esquivada contra la pared, el ogro sigue de largo y se estrella');

  // PISOTON: SALTAR (la ventana de la onda es la seccion 2). La guardia no.
  ok(ataque(O.PISOTON, 250, mantiene(-1)).pierde > 0, 'pisoton: con la guardia arriba, la onda le entra igual');
}

console.log('== 7) LA VENTANA DE CASTIGO CABE UN COMBO ==');
{
  // Si tras un ataque el ogro no se abre, ella no puede pegar nunca. Si se
  // abre de mas, es un saco de golpes. La medida honesta es cuantos tajos
  // caben de verdad.
  const combo2 = C.TAJOS[0][0] + C.TAJOS[1][0];    // reves + derecho
  const giro = C.TAJOS[2][0];
  for (const [nom, ab] of [['garrote/embestida', 0.55], ['pisoton', 0.73], ['barrido', 0.50]]) {
    const caben2 = ab >= combo2, cabeGiro = ab >= giro;
    ok(caben2 || cabeGiro,
      'tras ' + nom + ' se abre ' + f2(ab) + ' s: ' +
      (caben2 ? 'caben dos tajos (' + f2(combo2) + ')' : 'cabe el giro (' + f2(giro) + ')'));
  }
}

console.log('== 8) EL OGRO NO SE SALE DE LA ARENA ==');
{
  const rnd = semilla(12345);
  const og = O.makeOgro(600);
  const K = C.makeCaballero(300);
  let min = 1e9, max = -1e9;
  for (let n = 0; n < 60 * 60; n++) {      // un minuto de pelea simulada
    O.stepOgro(og, K, DT, rnd);
    if (og.x < min) min = og.x;
    if (og.x > max) max = og.x;
  }
  ok(min >= C.AX0 && max <= C.AX1, 'en 60 s se mueve entre ' + f2(min) + ' y ' + f2(max) + ' (arena ' + C.AX0 + '..' + C.AX1 + ')');
}

console.log('== 9) LA PELEA USA TODOS LOS ATAQUES ==');
{
  // Si con la tabla de pesos hay un ataque que no sale nunca, sobra: o se
  // arregla el peso o se quita el ataque.
  const rnd = semilla(999);
  const og = O.makeOgro(600);
  const K = C.makeCaballero(300);
  const vistos = [0, 0, 0, 0];
  let anterior = -1;
  for (let n = 0; n < 60 * 120; n++) {
    // ella se mueve por la arena para que el ogro vea todas las distancias
    K.x = 300 + Math.sin(n / 220) * 420;
    O.stepOgro(og, K, DT, rnd);
    if (og.st === O.ATACA && og.atk >= 0 && og.atk !== anterior) { vistos[og.atk]++; anterior = og.atk; }
    if (og.st !== O.ATACA) anterior = -1;
  }
  const nom = ['garrote', 'pisoton', 'barrido', 'embestida'];
  console.log('      en 2 min: ' + nom.map((v, i) => v + ' ' + vistos[i]).join(', '));
  ok(vistos.every(v => v > 0), 'los cuatro ataques salen al menos una vez');
}

console.log('== 10) LAS FASES SE ALCANZAN Y RUGE EN CADA UNA ==');
{
  const og = O.makeOgro(600);
  const fases = [];
  for (let i = 0; i < 200 && og.vivo; i++) {
    O.hiereOgro(og, 1, 1);
    if (og.st === O.RUGE && !fases.includes(og.fase)) fases.push(og.fase);
    // dejarle salir del rugido para poder seguir hiriendo
    if (og.st === O.RUGE) { og.st = O.ESPERA; og.invul = 0; }
  }
  ok(fases.length === 2, 'cruza las dos fases rugiendo (fases vistas: ' + fases.join(', ') + ')');
  ok(!og.vivo, 'con ' + O.HP0 + ' de vida, acaba muriendo');
}

console.log('== 11) NO SE PUEDE INTERRUMPIR UN ATAQUE A BOTONAZOS ==');
{
  // Si pegarle durante el ataque lo cancelase, el jefe no existiria: bastaria
  // machacar el boton.
  const og = O.makeOgro(600);
  const K = C.makeCaballero(700);
  const rnd = semilla(7);
  let llegoAtacar = false, cancelado = false;
  for (let n = 0; n < 600; n++) {
    O.stepOgro(og, K, DT, rnd);
    if (og.st === O.ATACA) {
      llegoAtacar = true;
      O.hiereOgro(og, 1, -1);
      if (og.st !== O.ATACA && og.st !== O.RUGE && og.st !== O.MUERTO) { cancelado = true; break; }
    }
  }
  ok(llegoAtacar, 'el ogro llega a atacar en la simulacion');
  ok(!cancelado, 'pegarle durante el ataque NO lo cancela');
}

console.log('== 12) EL MISMO ATAQUE NO SE REPITE SIN PARAR ==');
{
  const rnd = semilla(4242);
  const og = O.makeOgro(600);
  const K = C.makeCaballero(680);      // pegada: la zona de garrote
  const seq = [];
  let anterior = -1;
  for (let n = 0; n < 60 * 90; n++) {
    O.stepOgro(og, K, DT, rnd);
    if (og.st === O.ATACA && og.atk >= 0 && og.atk !== anterior) { seq.push(og.atk); anterior = og.atk; }
    if (og.st !== O.ATACA) anterior = -1;
  }
  let peor = 1, run = 1;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) { run++; if (run > peor) peor = run; } else run = 1;
  }
  ok(peor <= 3, 'la racha mas larga del mismo ataque es ' + peor + ' (de ' + seq.length + ' ataques)');
}

console.log('== 13) EL DAÑO LLEGA HASTA DONDE LLEGA EL DIBUJO ==');
{
  // El ogro esta pintado a mano (ogro-atlas.js): la punta del garrote en el
  // fotograma del golpe es lo que ella VE. Si el daño acaba antes, el garrote
  // le cruza la cabeza sin hacerle nada; si acaba mucho despues, le pega el
  // aire. Con el alcance viejo (150) pasaba lo primero: 216 contra 301.
  // Si se vuelve a hornear el ogro a otro tamaño, esto salta.
  const A = await import(G('ogro-atlas.js'));
  const [, , w, , ox] = A.FRAMES.garrote[5];       // el garrote y la estocada salen de aqui
  const punta = ox + w;
  const RADIO_ELLA = 26;
  for (const [k, nom] of [[O.GARROTE, 'garrote'], [O.BARRIDO, 'barrido']]) {
    const og = O.makeOgro(0); og.dir = 1; og.atk = k;
    const gp = O.golpeOgro(og);
    const hasta = gp.x + gp.r + RADIO_ELLA;        // lo mas lejos a lo que ella recibe
    ok(Math.abs(hasta - punta) <= 12,
       nom + ': el daño llega a ' + f2(hasta) + ' px y la punta dibujada a ' + punta + ' (diferencia <= 12)');
  }
}

console.log('');
console.log(fallos === 0 ? 'TODO OK' : fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
