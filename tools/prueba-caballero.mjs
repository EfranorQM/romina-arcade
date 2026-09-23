// EL CABALLERO: su fisica, medida en Node sin navegador.
//
//   node tools/prueba-caballero.mjs
//
// Importa el modulo REAL del juego (www/js/games/caba-cuerpo.js) y comprueba
// que el salto, la rodada y el tajo son lo que dice el diseño. Si se toca una
// constante de alli, se vuelve a correr esto.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const C = await import(pathToFileURL(path.join(here, '..', 'www', 'js', 'games', 'caba-cuerpo.js')).href);
const { makeCaballero, stepCaballero, espadaActiva, invulnerable, herir, pose,
        SUELO, VEL, JUMP_V, ROLL_T, ROLL_CD, TAJO_T, TAJO_A0, TAJO_A1, AX0, AX1, HP0 } = C;

// El atlas es solo datos (sin DOM): de el sale cuantos fotogramas tiene de
// verdad cada pose, en vez de una tabla aparte que se quedaria vieja.
const A = await import(pathToFileURL(path.join(here, '..', 'www', 'js', 'games', 'romi-atlas.js')).href);

const DT = 1 / 60;
const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
let fallos = 0;
function ok(cond, msg) { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; }
const nada = { dx: 0, salta: false, golpea: false, rueda: false, saltaAbajo: false };
function corre(K, secs, inp) {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) stepCaballero(K, inp || nada, DT);
}

console.log('== 1) ANDAR ==');
{
  const K = makeCaballero(300);
  const x0 = K.x;
  corre(K, 1, { ...nada, dx: 1 });
  const v = K.x - x0;
  console.log(`en 1 s recorre ${fmt(v)} px (tope teorico ${VEL})`);
  ok(v > VEL * 0.9 && v <= VEL, 'alcanza casi su velocidad tope en 1 s');
  // Cruzar la arena
  const K2 = makeCaballero(AX0);
  let t = 0;
  while (K2.x < AX1 - 1 && t < 10) { stepCaballero(K2, { ...nada, dx: 1 }, DT); t += DT; }
  console.log(`cruza la arena (${AX1 - AX0} px) en ${fmt(t)} s`);
  ok(t >= 3.5 && t <= 6, 'cruzar la arena lleva entre 3.5 y 6 s');
  // Frenar
  const K3 = makeCaballero(300);
  corre(K3, 1, { ...nada, dx: 1 });
  const xf = K3.x;
  corre(K3, 0.5);
  console.log(`tras soltar, patina ${fmt(K3.x - xf)} px`);
  ok(K3.x - xf < 24, 'al soltar frena en menos de 24 px (no patina)');
}

console.log('== 2) SALTAR ==');
{
  const K = makeCaballero(300);
  let apex = SUELO, t = 0;
  stepCaballero(K, { ...nada, salta: true, saltaAbajo: true }, DT);
  while (!K.enSuelo && t < 3) {
    stepCaballero(K, { ...nada, saltaAbajo: true }, DT);
    apex = Math.min(apex, K.y); t += DT;
  }
  const alto = SUELO - apex;
  console.log(`salto completo: ${fmt(alto)} px de alto, ${fmt(t)} s en el aire`);
  // Los umbrales van en la escala del juego: Romina mide 180 px, asi que un
  // salto util son 100-132 (0.6-0.7 de su altura).
  ok(alto >= 100 && alto <= 132, 'el salto completo sube entre 100 y 132 px (0.6-0.7 de su altura)');
  ok(t >= 0.45 && t <= 0.62, 'el vuelo dura entre 0.45 y 0.62 s');

  // Cortado: se suelta el boton enseguida
  const K2 = makeCaballero(300);
  let apex2 = SUELO, t2 = 0;
  stepCaballero(K2, { ...nada, salta: true, saltaAbajo: true }, DT);
  while (!K2.enSuelo && t2 < 3) {
    stepCaballero(K2, { ...nada, saltaAbajo: false }, DT);
    apex2 = Math.min(apex2, K2.y); t2 += DT;
  }
  const alto2 = SUELO - apex2;
  console.log(`salto cortado: ${fmt(alto2)} px de alto, ${fmt(t2)} s`);
  ok(alto2 < alto * 0.75, 'soltar pronto deja el salto por debajo del 75% del completo');
  ok(alto2 > 30, 'pero sube algo util (mas de 30 px)');
}

console.log('== 3) COYOTE Y BUFFER ==');
{
  // Saltar 3 frames DESPUES de salir del borde: el coyote lo permite.
  const K = makeCaballero(300);
  K.enSuelo = false; K.y = SUELO - 1; K.vy = 0; K.coyote = 0.08;
  corre(K, 3 * DT);
  stepCaballero(K, { ...nada, salta: true, saltaAbajo: true }, DT);
  ok(K.vy < -300, 'el coyote deja saltar justo despues de salir del borde');
  // Pulsar en el aire justo antes de aterrizar: el buffer lo guarda.
  const K2 = makeCaballero(300);
  stepCaballero(K2, { ...nada, salta: true, saltaAbajo: true }, DT);
  while (K2.y < SUELO - 30 || K2.vy < 0) stepCaballero(K2, { ...nada, saltaAbajo: true }, DT);
  stepCaballero(K2, { ...nada, salta: true }, DT);   // pulsa en el aire
  let saltoOtraVez = false;
  for (let i = 0; i < 12; i++) { stepCaballero(K2, { ...nada, saltaAbajo: true }, DT); if (K2.vy < -300) saltoOtraVez = true; }
  ok(saltoOtraVez, 'el buffer guarda un salto pulsado justo antes de tocar suelo');
}

console.log('== 4) RODAR ==');
{
  const K = makeCaballero(200);
  const x0 = K.x;
  stepCaballero(K, { ...nada, rueda: true }, DT);
  let inv = 0, n = 0;
  while (K.st === C.RUEDA) { stepCaballero(K, nada, DT); if (invulnerable(K)) inv += DT; n++; }
  const d = K.x - x0;
  console.log(`rodada: ${fmt(d)} px en ${fmt(n * DT)} s, invulnerable ${fmt(inv * 1000)} ms`);
  ok(d >= 150 && d <= 230, 'la rodada avanza entre 150 y 230 px (algo mas de un cuerpo)');
  ok(inv > 0.15 && inv < ROLL_T, 'es invulnerable en el medio, pero NO toda la rodada');
  // El enfriamiento impide encadenarlas
  const K2 = makeCaballero(200);
  stepCaballero(K2, { ...nada, rueda: true }, DT);
  corre(K2, ROLL_T);
  const x1 = K2.x;
  stepCaballero(K2, { ...nada, rueda: true }, DT);
  corre(K2, 0.1);
  ok(Math.abs(K2.x - x1) < 40, 'no se puede encadenar una rodada con otra');
}

console.log('== 5) TAJO ==');
{
  const K = makeCaballero(300);
  stepCaballero(K, { ...nada, golpea: true }, DT);
  let act = 0, n = 0;
  while (K.st === C.TAJO) { if (espadaActiva(K)) act += DT; stepCaballero(K, nada, DT); n++; }
  console.log(`tajo 1: ciclo ${fmt(n * DT * 1000)} ms, activo ${fmt(act * 1000)} ms (${Math.round(act / (n * DT) * 100)}%)`);
  // El PRIMER golpe del combo dura 260 ms a proposito: es el rapido.
  ok(Math.abs(n * DT - C.TAJOS[0][0]) < 0.03, `el primer golpe dura ${C.TAJOS[0][0] * 1000} ms`);
  ok(act >= 0.05 && act <= 0.09, 'la ventana activa esta entre 50 y 90 ms');
  // Se puede cancelar con un rodar
  const K2 = makeCaballero(300);
  stepCaballero(K2, { ...nada, golpea: true }, DT);
  corre(K2, 0.05);
  stepCaballero(K2, { ...nada, rueda: true }, DT);
  ok(K2.st === C.RUEDA, 'el rodar cancela el tajo');
  // EL COMBO AVANZA, pero correr sigue siendo mas rapido. Esto es lo que
  // impide que machacar el boton sea la mejor forma de cruzar la arena --
  // medido, con el empuje original el tercer golpe salia a 294 px/s contra
  // los 240 de correr.
  const K3 = makeCaballero(300);
  const x0 = K3.x;
  let vmax = 0;
  const golpes = [0, 12, 26];
  for (let i = 0; i < 70; i++) {
    stepCaballero(K3, { ...nada, golpea: golpes.includes(i) }, DT);
    vmax = Math.max(vmax, Math.abs(K3.vx));
  }
  const avance = K3.x - x0;
  const K4 = makeCaballero(300);
  const x1 = K4.x;
  corre(K4, 70 * DT, { ...nada, dx: 1 });
  console.log(`el combo avanza ${fmt(avance)} px (punta ${fmt(vmax)} px/s); corriendo, ${fmt(K4.x - x1)} px`);
  ok(avance >= 55 && avance <= 130, 'el combo avanza entre 55 y 130 px (media zancada por golpe)');
  ok(vmax < VEL, 'pero su punta NO llega a la velocidad de correr');
  ok(avance < (K4.x - x1), 'correr sigue siendo mas rapido que machacar el boton');
}

console.log('== 6) DAÑO ==');
{
  const K = makeCaballero(300);
  ok(herir(K, 400), 'el primer golpe entra');
  ok(K.hp === HP0 - 1, 'quita un corazon');
  ok(!herir(K, 400), 'el segundo golpe seguido NO entra (i-frames)');
  corre(K, 1.05);
  ok(herir(K, 400), 'pasado el iframe vuelve a entrar');
  // Rodando es invulnerable en el medio
  const K2 = makeCaballero(300);
  stepCaballero(K2, { ...nada, rueda: true }, DT);
  corre(K2, 0.12);
  ok(!herir(K2, 400), 'rodando (en el medio) no le entra');
  // Morir
  const K3 = makeCaballero(300);
  for (let i = 0; i < HP0; i++) { K3.iframe = 0; herir(K3, 400); }
  ok(!K3.vivo, `muere con ${HP0} golpes`);
}

console.log('== 7) POSES ==');
{
  const K = makeCaballero(300);
  const vistas = new Set();
  vistas.add(pose(K)[0]);
  corre(K, 0.8, { ...nada, dx: 1 }); vistas.add(pose(K)[0]);
  stepCaballero(K, { ...nada, salta: true, saltaAbajo: true }, DT); corre(K, 0.1, { ...nada, saltaAbajo: true }); vistas.add(pose(K)[0]);
  corre(K, 0.6); vistas.add(pose(K)[0]);
  stepCaballero(K, { ...nada, rueda: true }, DT); vistas.add(pose(K)[0]);
  corre(K, 0.4);
  stepCaballero(K, { ...nada, golpea: true }, DT); vistas.add(pose(K)[0]);
  console.log('poses vistas: ' + [...vistas].join(', '));
  ok(vistas.has('idle') && vistas.has('run') && vistas.has('jump') && vistas.has('roll') && vistas.has('atk'),
     'las cinco poses principales se alcanzan jugando');
  // Los fotogramas nunca se salen del array. Se comprueba contra el numero
  // REAL de fotogramas de cada pose, sacado del ATLAS (la caballera pintada a
  // mano), no contra una tabla escrita aqui: la tabla se quedo vieja en cuanto
  // cambio el dibujo, y un tope fijo deja pasar un desbordamiento.
  const CUENTA = {};
  for (const k in A.FRAMES) CUENTA[k] = A.FRAMES[k].length;
  const K2 = makeCaballero(300);
  let malo = null;
  const vistos = {};
  for (let i = 0; i < 4000; i++) {
    const inp = { dx: Math.sin(i / 17), salta: i % 53 === 0, golpea: i % 29 === 0,
                  rueda: i % 71 === 0, saltaAbajo: i % 53 < 8, bloquea: i % 97 < 30 };
    stepCaballero(K2, inp, DT);
    const [p, f] = pose(K2);
    if (!(p in CUENTA)) malo = ['pose desconocida', p];
    else if (!(f >= 0 && f < CUENTA[p])) malo = [p, f];
    (vistos[p] = vistos[p] || new Set()).add(f);
    if (!isFinite(K2.x) || !isFinite(K2.y)) malo = ['NaN', K2.x];
  }
  ok(!malo, 'tras 4000 frames aporreando los botones, ningun fotograma fuera de rango ni NaN' + (malo ? ' -> ' + malo : ''));
  // Todos los fotogramas del tajo se alcanzan de verdad jugando: si uno no
  // sale nunca, es un dibujo que nadie va a ver.
  const fAtk = vistos.atk ? vistos.atk.size : 0;
  console.log(`fotogramas del tajo alcanzados: ${fAtk} de ${CUENTA.atk}`);
  ok(fAtk === CUENTA.atk, `los ${CUENTA.atk} fotogramas del tajo se alcanzan jugando`);

  // TODOS los fotogramas de TODAS las poses tienen que salir jugando. Un
  // dibujo que no se alcanza nunca es trabajo tirado, y al subir run de 4 a 6
  // y jump de 3 a 7 es exactamente el riesgo: que el mapeo no llegue a los
  // nuevos. Se aporrea con un piloto que ademas bloquea y recibe golpes.
  // El piloto tiene que hacer TODO lo que hace una persona, no solo aporrear:
  // tambien quedarse QUIETO (o los fotogramas de respirar no salen nunca) y
  // COMER GOLPES MIENTRAS BLOQUEA (o no salen los del impacto del escudo).
  // La primera version solo aporreaba y daba 3 falsos fallos por eso: el
  // arnes medía al piloto, no al juego.
  // TRES GUIONES DELIBERADOS en vez de un piloto aporreando con modulos.
  //
  // El piloto de modulos (i%13, i%31...) no vale para esto: encadenaba el
  // combo pero seguia pulsando y cortaba el giro antes de su ultimo
  // fotograma, y al arreglar eso rompia el bloqueo. Un guion que HACE LA
  // ACCION ENTERA como la haria una persona es mas corto y no miente.
  const v3 = {};
  const anota = K => { const [p2, f2] = pose(K); (v3[p2] = v3[p2] || new Set()).add(f2); };
  const jugar = (K, n, inp) => { for (let i = 0; i < n; i++) { stepCaballero(K, inp, DT); anota(K); } };

  // GUION 1: el combo entero de tres, dejando que el giro REMATE.
  {
    const K = makeCaballero(300);
    jugar(K, 1, { ...nada, golpea: true });
    jugar(K, 11, nada);
    jugar(K, 1, { ...nada, golpea: true });   // enlaza el 2
    jugar(K, 13, nada);
    jugar(K, 1, { ...nada, golpea: true });   // enlaza el 3
    jugar(K, 40, nada);                       // y se le deja acabar
    // Y un combo que se QUEDA EN DOS: es lo que pasa cuando alguien encadena
    // dos y se para. Sin esto el ultimo fotograma de atk2 no se ve nunca,
    // porque siempre se enlazaba al tercero.
    jugar(K, 40, nada);
    jugar(K, 1, { ...nada, golpea: true });
    jugar(K, 12, nada);
    jugar(K, 1, { ...nada, golpea: true });   // enlaza el 2 ...
    jugar(K, 30, nada);                       // ... y lo deja terminar
    // Y un golpe suelto, el arranque limpio
    jugar(K, 30, nada);
    jugar(K, 1, { ...nada, golpea: true });
    jugar(K, 25, nada);
  }

  // GUION 2: el escudo -- levantar, aguantar, comer un golpe, y empujar.
  {
    const K = makeCaballero(300);
    jugar(K, 3, { ...nada, bloquea: true });        // subiendo (frame 0)
    jugar(K, 20, { ...nada, bloquea: true });       // plantada (frame 1)
    herir(K, K.x + K.dir * 60);                     // le entra: 2 y 3
    jugar(K, 20, { ...nada, bloquea: true });
    // el EMPUJON: atacar con el escudo arriba
    jugar(K, 1, { ...nada, bloquea: true, golpea: true });
    jugar(K, 20, { ...nada, bloquea: true });
    jugar(K, 10, nada);
  }

  // GUION 3: moverse, saltar, aterrizar, rodar, respirar y que le peguen.
  {
    const K = makeCaballero(300);
    jugar(K, 90, { ...nada, dx: 1 });                       // correr
    jugar(K, 1, { ...nada, dx: 1, salta: true, saltaAbajo: true });
    jugar(K, 40, { ...nada, dx: 1, saltaAbajo: true });     // salto entero
    jugar(K, 15, nada);                                     // y el aterrizaje
    jugar(K, 1, { ...nada, rueda: true });
    jugar(K, 25, nada);                                     // la rodada
    jugar(K, 120, nada);                                    // respirar
    K.iframe = 0; herir(K, K.x + 60);
    jugar(K, 25, nada);                                     // el dolor entero
  }

  // GUION 4: un tajo EN EL AIRE (tiene su propia animacion), y la derrota.
  {
    const K = makeCaballero(300);
    jugar(K, 1, { ...nada, salta: true, saltaAbajo: true });
    jugar(K, 6, { ...nada, saltaAbajo: true });
    jugar(K, 1, { ...nada, golpea: true, saltaAbajo: true });
    jugar(K, 20, { ...nada, saltaAbajo: true });            // el tajo aereo entero
    jugar(K, 40, nada);
    for (let i = 0; i < HP0; i++) { K.iframe = 0; herir(K, K.x + 60); }
    anota(K);                                                 // de rodillas
  }

  for (const nombre in CUENTA) {
    const vistas = v3[nombre] ? v3[nombre].size : 0;
    const faltan = [];
    for (let f = 0; f < CUENTA[nombre]; f++) if (!v3[nombre] || !v3[nombre].has(f)) faltan.push(f);
    console.log(`  ${nombre.padEnd(6)} ${vistas}/${CUENTA[nombre]}` + (faltan.length ? '  faltan: ' + faltan.join(',') : ''));
    ok(faltan.length === 0, `todos los fotogramas de ${nombre} se alcanzan jugando`);
  }
}

console.log('== 8) EL TAJO LLEGA HASTA DONDE LLEGA LA ESTELA ==');
{
  // La caballera lleva espada larga y cada tajo dibuja una estela en media
  // luna. Si el daño acaba mucho antes que la estela, se ve la estela cruzar
  // al enemigo y el golpe no cuenta: lo peor que puede sentir quien juega.
  // Con los alcances de la muñeca de antes (74/78/92) pasaba por 50-70 px.
  // Se mide el borde delantero de los fotogramas del FILO (los de la estela)
  // y el alcance tiene que caer en los ultimos 30 px, que son la parte de la
  // estela que ya se desvanece -- y nunca por delante de ella.
  const FILO = [['atk', 2, 2], ['atk2', 3, 2], ['atk3', 6, 2]];   // [pose, primero, cuantos]
  for (let i = 0; i < 3; i++) {
    const [nom, f0, nf] = FILO[i];
    let borde = -1e9;
    for (let f = f0; f < f0 + nf; f++) {
      const [, , w, , ox] = A.FRAMES[nom][f];
      borde = Math.max(borde, ox + w);
    }
    const alc = C.TAJOS[i][5];
    ok(alc <= borde && alc >= borde - 30,
       `${nom}: el daño llega a ${alc} px y la estela dibujada a ${borde} (en sus ultimos 30)`);
  }
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
