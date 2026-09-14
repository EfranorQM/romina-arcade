// AHORCADO: la fisica del muneco colgado de globos, medida en Node sin
// navegador. Es la prueba que la memoria del proyecto exige antes de compilar:
// cada constante de www/js/games/ahorc-fisica.js sale de aqui, y si se toca una
// hay que volver a correr esto.
//
//   node tools/prueba-ahorcado.mjs
//
// Importa el modulo REAL del juego (no una copia), y cada prueba tiene su
// umbral: el proceso termina con codigo 1 si alguno falla.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const F = await import(pathToFileURL(path.join(here, '..', 'www', 'js', 'games', 'ahorc-fisica.js')).href);
const { makeMono, step, pop, tie, grab, release, impulse, DT, N, B0, CAB, PR, PL, RR, RL, CR, CL, NUDO,
        KNOT_HOME_Y, CEIL, WATER, GRAV } = F;

const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
let fallos = 0;
function ok(cond, msg) { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; }
function run(S, secs, fn, wind = true) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { step(S, wind); if (fn) fn(i * DT); } }
function feetY(S) { return (S.y[PR] + S.y[PL]) / 2; }
function feetX(S) { return (S.x[PR] + S.x[PL]) / 2; }
function nan(S) { for (let i = 0; i < N; i++) if (!isFinite(S.x[i]) || !isFinite(S.y[i])) return true; return false; }

console.log('== 1) ENTRADA: nudo de 150 a 236 ==');
{
  const S = makeMono(270, 150); S.knot.ty = KNOT_HOME_Y;
  let minBal = 1e9, tAsent = -1;
  run(S, 4, t => { for (let b = 0; b < 6; b++) minBal = Math.min(minBal, S.y[B0 + b]); if (tAsent < 0 && Math.abs(S.knot.y - KNOT_HOME_Y) < 2 && Math.abs(S.knot.vy) < 5) tAsent = t; });
  console.log(`globo mas alto y=${fmt(minBal)} (techo ${CEIL}, borde ${fmt(minBal - 29)}); nudo asentado a ${fmt(tAsent)} s`);
  ok(tAsent > 0 && tAsent <= 2, 'asentado en <= 2 s');
  ok(minBal >= CEIL - 0.5, 'ningun globo sube del techo');
  ok(!nan(S), 'sin NaN');
}

console.log('== 2) REPOSO 20 s con viento ==');
{
  const S = makeMono(); run(S, 5); S.maxErr = 0;
  let minFx = 1e9, maxFx = -1e9, minBal = 1e9, headTop = 1e9;
  run(S, 20, () => { const fx = feetX(S); minFx = Math.min(minFx, fx); maxFx = Math.max(maxFx, fx); for (let b = 0; b < 6; b++) minBal = Math.min(minBal, S.y[B0 + b]); headTop = Math.min(headTop, S.y[CAB] - 34); });
  const bal = maxFx - minFx;
  console.log(`balanceo de pies ${fmt(bal)} px; pies y=${fmt(feetY(S))}; globo mas alto y=${fmt(minBal)}; borde de la cabeza y=${fmt(headTop)}; err max ${(S.maxErr * 100).toFixed(2)}%`);
  ok(bal >= 40 && bal <= 70, 'balanceo entre 40 y 70 px');
  ok(S.maxErr <= 0.02, 'error de restriccion <= 2%');
  ok(headTop >= 80, 'la cabeza no pisa la pausa');
  ok(!nan(S), 'sin NaN');
}

console.log('== 3) EMPUJON 400 px/s en las piernas, sin viento ==');
{
  const S = makeMono(); run(S, 5, null, false);
  for (const i of [RR, RL, PR, PL]) impulse(S, i, -400, 0);
  const peaks = []; let prev = feetX(S) - 270, prevD = 0, lastBig = 0;
  for (let i = 0; i < 1200; i++) {
    step(S, false); const v = feetX(S) - 270; const d = v - prev;
    if (prevD > 0 && d <= 0 && v > 3) peaks.push([i * DT, v]);
    if (prevD < 0 && d >= 0 && v < -3) peaks.push([i * DT, v]);
    if (Math.abs(v) > 4) lastBig = i * DT;
    prev = v; prevD = d;
  }
  const per = peaks.length >= 3 ? peaks[2][0] - peaks[0][0] : NaN;
  console.log(`periodo ${fmt(per)} s; picos ${peaks.slice(0, 6).map(p => fmt(p[1])).join(' / ')} px; se calma (<4 px) a ${fmt(lastBig)} s; pendulo teorico ${fmt(2 * Math.PI * Math.sqrt((feetY(S) - S.knot.y) / GRAV))} s`);
  ok(per >= 2.0 && per <= 2.5, 'periodo entre 2.0 y 2.5 s');
  ok(lastBig < 20, 'se calma antes de 20 s');
}

console.log('== 4) SEIS POPS cada 2 s ==');
{
  const S = makeMono(); run(S, 5);
  const rest = [];
  for (let p = 1; p <= 5; p++) {
    const y0 = S.knot.y; S.maxErr = 0; pop(S);
    let maxY = -1e9, tSet = -1;
    run(S, 2, t => { maxY = Math.max(maxY, S.knot.y); if (tSet < 0 && t > 0.2 && Math.abs(S.knot.y - S.knot.ty) < 1.5 && Math.abs(S.knot.vy) < 8) tSet = t; });
    rest.push(fmt(feetY(S)));
    console.log(`  pop ${p}: nudo baja ${fmt(S.knot.y - y0)} (sobrepaso ${fmt(maxY - S.knot.ty)}, asentado ${fmt(tSet)} s), pies y=${fmt(feetY(S))}, err ${(S.maxErr * 100).toFixed(1)}%`);
    ok(Math.abs(S.knot.y - y0 - 40) <= 1, `pop ${p} baja 40 +- 1`);
    ok(maxY - S.knot.ty <= 10 && tSet > 0 && tSet <= 1.5, `pop ${p} sobrepaso <= 10 y asentado <= 1.5 s`);
  }
  console.log(`  pies en reposo con 5..1 globos: ${rest.join(', ')} (agua ${WATER})`);
  let maxFy = -1e9; run(S, 20, () => { maxFy = Math.max(maxFy, Math.max(S.y[PR], S.y[PL])); });
  console.log(`  con 1 globo el pie mas bajo llega a y=${fmt(maxFy)}`);
  ok(maxFy >= 630 && maxFy <= 642, 'con 1 globo los pies rozan el agua (630..642)');
  // Postura de nervioso al cuarto pop: la pone el juego, aqui se comprueba que no rompe nada.
  const S2 = makeMono(); run(S2, 5); for (let p = 0; p < 4; p++) { pop(S2); run(S2, 1); }
  F.setPostura(S2, { twoHands: true, knees: true }); S2.maxErr = 0; run(S2, 3);
  console.log(`  postura nervioso: err ${(S2.maxErr * 100).toFixed(1)}%, mano izq a ${fmt(Math.hypot(S2.x[F.MANO] - S2.x[NUDO], S2.y[F.MANO] - S2.y[NUDO]))} del nudo`);
  ok(S2.maxErr <= 0.10, 'postura: error transitorio <= 10%');
}

console.log('== 5) CAIDA ==');
{
  const S = makeMono(); run(S, 5); for (let p = 0; p < 5; p++) { pop(S); run(S, 2); }
  pop(S);
  const v0 = Math.hypot(S.x[NUDO] - S.ox[NUDO], S.y[NUDO] - S.oy[NUDO]) / DT;
  let tHip = -1, maxHead = -1e9, tFloat = -1, xmin = 1e9, xmax = -1e9;
  run(S, 4, t => {
    if (tHip < 0 && (S.y[CR] + S.y[CL]) / 2 > WATER) tHip = t;
    maxHead = Math.max(maxHead, S.y[CAB]);
    let vmax = 0; for (let i = 0; i < B0; i++) { vmax = Math.max(vmax, Math.hypot(S.x[i] - S.ox[i], S.y[i] - S.oy[i]) / DT); xmin = Math.min(xmin, S.x[i]); xmax = Math.max(xmax, S.x[i]); }
    if (tFloat < 0 && t > 0.6 && vmax < 6) tFloat = t;
  });
  console.log(`vel heredada del nudo ${fmt(v0)} px/s; cadera al agua a ${fmt(tHip)} s; cabeza max y=${fmt(maxHead)}; flota quieto a ${fmt(tFloat)} s; cabeza final y=${fmt(S.y[CAB])}; x del cuerpo ${fmt(xmin)}..${fmt(xmax)}`);
  ok(v0 < 1, 'sin velocidad heredada');
  ok(tHip > 0 && tHip <= 0.8, 'cadera al agua en <= 0.8 s');
  ok(tFloat > 0 && tFloat <= 3, 'flota quieto en <= 3 s');
  ok(S.y[CAB] >= 638 && S.y[CAB] <= 652, 'la cabeza queda a flor de agua (638..652)');
  ok(xmin >= 120 && xmax <= 420, 'el cuerpo no se va a los topes');
  ok(!nan(S), 'sin NaN');
}

console.log('== 6) ARRASTRE del pie derecho a (420,500) y suelta ==');
{
  const S = makeMono(); run(S, 5);
  grab(S, PR, 420, 500); S.maxErr = 0;
  let kxMax = -1e9;
  run(S, 1.5, () => { kxMax = Math.max(kxMax, S.knot.x); });
  console.log(`pie en (${fmt(S.x[PR])},${fmt(S.y[PR])}); nudo cedio hasta x=${fmt(kxMax)}; err ${(S.maxErr * 100).toFixed(1)}% arrastrando`);
  ok(S.maxErr <= 0.05, 'error <= 5% arrastrando');
  release(S); S.maxErr = 0; run(S, 0.5);
  ok(S.maxErr <= 0.05, 'error <= 5% al soltar');
  run(S, 6); console.log(`6 s despues: nudo (${fmt(S.knot.x)},${fmt(S.knot.y)})`);
}

console.log('== 7) ARRASTRE ABSURDO: cabeza hacia la pausa ==');
{
  const S = makeMono(); run(S, 5);
  grab(S, CAB, 270, -100); let minHead = 1e9, minBal = 1e9;
  run(S, 2, () => { minHead = Math.min(minHead, S.y[CAB]); for (let b = 0; b < 6; b++) minBal = Math.min(minBal, S.y[B0 + b]); });
  console.log(`cabeza sube hasta y=${fmt(minHead)} (borde ${fmt(minHead - 34)}), globo mas alto ${fmt(minBal)}, nudo y=${fmt(S.knot.y)}`);
  ok(minHead - 34 >= 80, 'el borde de la cabeza queda >= 80');
  ok(minBal >= CEIL - 0.5, 'los globos respetan el techo');
  ok(!nan(S), 'sin NaN');
}

console.log('== 8) ATAR 3 globos desde 3 ==');
{
  const S = makeMono(); run(S, 5); for (let p = 0; p < 3; p++) { pop(S); run(S, 2); }
  const y0 = S.knot.y; S.maxErr = 0;
  for (let b = 0; b < 6; b++) if (!S.alive[b]) { tie(S, b); run(S, 0.12); }
  let tSet = -1; run(S, 3, t => { if (tSet < 0 && t > 0.2 && Math.abs(S.knot.y - S.knot.ty) < 1.5 && Math.abs(S.knot.vy) < 8) tSet = t; });
  console.log(`nudo de ${fmt(y0)} a ${fmt(S.knot.y)} en ${fmt(tSet)} s; err ${(S.maxErr * 100).toFixed(1)}%`);
  ok(tSet > 0 && tSet <= 2, 'sube en <= 2 s');
  ok(S.maxErr <= 0.05, 'error <= 5%');
}

console.log('== 9) ARRASTRE VIOLENTO: el dedo da vueltas a 3000 px/s ==');
{
  const S = makeMono(); run(S, 5);
  grab(S, F.MANO, 270, 400); S.maxErr = 0;
  run(S, 4, t => { F.moveGrab(S, 270 + Math.cos(t * 9) * 200, 420 + Math.sin(t * 9) * 180); });
  release(S); run(S, 1);
  console.log(`err max ${(S.maxErr * 100).toFixed(1)}%; NaN=${nan(S)}`);
  ok(!nan(S), 'sin NaN');
  ok(S.maxErr <= 0.5, 'nunca se estira mas del 50% (el muelle del dedo cede)');
}

console.log('== 10) COSTE ==');
{
  const S = makeMono(); const t0 = performance.now(); for (let i = 0; i < 20000; i++) step(S);
  const ms = (performance.now() - t0) / 20000;
  console.log(`${ms.toFixed(4)} ms por paso (Node)`);
  ok(ms <= 0.03, '<= 0.03 ms por paso');
}

console.log(fallos ? `\n${fallos} comprobaciones MAL` : '\ntodo ok');
process.exit(fallos ? 1 : 0);
