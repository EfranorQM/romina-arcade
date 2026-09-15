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
  console.log(`tajo: ciclo ${fmt(n * DT * 1000)} ms, activo ${fmt(act * 1000)} ms (${Math.round(act / (n * DT) * 100)}%)`);
  ok(Math.abs(n * DT - TAJO_T) < 0.03, `el ciclo dura ${TAJO_T * 1000} ms`);
  ok(act >= 0.05 && act <= 0.09, 'la ventana activa esta entre 50 y 90 ms');
  // Se puede cancelar con un rodar
  const K2 = makeCaballero(300);
  stepCaballero(K2, { ...nada, golpea: true }, DT);
  corre(K2, 0.05);
  stepCaballero(K2, { ...nada, rueda: true }, DT);
  ok(K2.st === C.RUEDA, 'el rodar cancela el tajo');
  // Golpear corriendo conserva algo de impulso
  const K3 = makeCaballero(300);
  corre(K3, 1, { ...nada, dx: 1 });
  const v0 = K3.vx;
  stepCaballero(K3, { ...nada, dx: 1, golpea: true }, DT);
  console.log(`al cortar corriendo conserva ${Math.round(K3.vx / v0 * 100)}% de su velocidad`);
  ok(K3.vx > v0 * 0.25 && K3.vx < v0 * 0.7, 'cortar corriendo conserva entre el 25% y el 70%');
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
  // Los fotogramas nunca se salen del array
  const K2 = makeCaballero(300);
  let malo = null;
  for (let i = 0; i < 2000; i++) {
    const inp = { dx: Math.sin(i / 17), salta: i % 53 === 0, golpea: i % 29 === 0, rueda: i % 71 === 0, saltaAbajo: i % 53 < 8 };
    stepCaballero(K2, inp, DT);
    const [p, f] = pose(K2);
    if (!(f >= 0 && f <= 3)) malo = [p, f];
    if (!isFinite(K2.x) || !isFinite(K2.y)) malo = ['NaN', K2.x];
  }
  ok(!malo, 'tras 2000 frames aporreando los botones, ningun fotograma fuera de rango ni NaN' + (malo ? ' -> ' + malo : ''));
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
