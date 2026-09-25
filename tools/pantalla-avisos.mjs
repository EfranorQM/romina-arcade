// ¿SE VE A QUIEN ATACA? Juega los dos niveles de la aventura con el piloto
// (tools/piloto-aventura.mjs, por tramos de hoguera, 8 partidas por tramo) y
// mira, en cada fotograma de cada AVISO, donde cae el atacante en la pantalla:
// cuanto de su cuerpo tapan los medallones de los botones (caba-mandos.js) y
// cuanto queda fuera del lienzo. Y cuanto se mueve la camara.
//
//   node tools/pantalla-avisos.mjs [paseo|normal|furia]
//   CAM=vieja node tools/pantalla-avisos.mjs      # con la camara de antes
//
// POR QUE (25-09-2026). En una captura de la app, la condesa lanzaba debajo de
// GUARDIA. Medido: 2 de cada 3 lluvias EMPEZABAN con ella fuera de la pantalla
// (despertaba a 760 px, con el borde a 744, y lanzaba en el acto: ahora un jefe
// espera 1 s al despertar). Y con la camara de entonces, que solo miraba hacia
// donde miraba ella, los que atacan de lejos avisaban con el cuerpo bajo los
// botones: la kitsune, el 17 % (fuego rastrero) y el 10 % (bola); la condesa,
// el 4 %. Con la camara que encuadra la pelea (caba-nivel.js camara): 3 %,
// 1,5 % y 0, y la camara recorre un 3 % menos (cambia algo mas de sentido, 21
// veces por minuto frente a 18, pero con vaivenes un 16 % mas cortos).
//
// El cuerpo es el rectangulo de su T.ancho a cada lado y T.alto de alto sobre
// el suelo (el dibujo es algo mas ancho: por eso la camara deja 60 px).
import * as C from '../www/js/games/caba-cuerpo.js';
import * as N from '../www/js/games/caba-nivel.js';
import * as EN from '../www/js/games/caba-enemigos.js';
import * as P from '../www/js/games/caba-partida.js';
import { BOTONES } from '../www/js/games/caba-mandos.js';
import { normal } from './piloto-ogro.mjs';
import { piloto as decide } from './piloto-aventura.mjs';

const DT = 1 / 60, VW = N.LIENZO;
const semilla = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const dif = process.argv[2] || 'paseo';

// Que parte del cuerpo queda debajo de algun medallon, y que parte fuera.
function tapa(sx, E, suelo) {
  let n = 0, t = 0, f = 0;
  const y0 = suelo - (E.alt || 0);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const x = sx - E.T.ancho + (i + 0.5) / 12 * 2 * E.T.ancho, y = y0 - (j + 0.5) / 12 * E.T.alto;
    n++;
    if (x < 0 || x > VW) { f++; continue; }
    for (const k in BOTONES) { const b = BOTONES[k]; if (Math.hypot(x - b.x, y - b.y) < b.r) { t++; break; } }
  }
  return [t / n, f / n];
}

// La camara de antes del 25-09-2026, para comparar.
function camaraVieja(L, K, VW, dt, instantanea = false) {
  const obj = K.x - VW * (K.dir >= 0 ? N.CAM_DELANTE : 1 - N.CAM_DELANTE);
  const max = L.def.ancho - VW;
  const dest = Math.max(0, Math.min(max, obj));
  L.camX = instantanea ? dest : L.camX + (dest - L.camX) * (1 - Math.exp(-dt * 3.2));
  L.camX = Math.max(K.x - VW + 120, Math.min(K.x - 120, L.camX));
  L.camX = Math.max(0, Math.min(max, L.camX));
}
const camara = process.env.CAM === 'vieja' ? camaraVieja : N.camara;

const aviso = {};
let camRec = 0, giros = 0, frames = 0, ellaTapada = 0;
for (const def of N.ORDEN_NIVELES.map(id => N.NIVELES[id])) {
  const H = def.hogueras;
  for (const [desde, hasta] of [[0, H[0]], [H[0], H[1]], [H[1], 0]]) {
    for (let sem = 1; sem <= 8; sem++) {
      const rnd = semilla(sem * 31 + 7), D = P.DIFICULTADES[dif];
      const reac = () => Math.max(12, Math.round(normal(rnd, D.reflejos, 0.08) * 60));
      const L = N.makeNivel(def, semilla(sem), P.opcionesBosque(dif));
      if (desde) { L.hoguera = desde; L.seguroX = desde + 40; }
      const K = C.makeCaballero(desde ? desde + 40 : 160, { y: def.suelo, ...P.opcionesElla(dif) });
      camara(L, K, VW, 0, true);
      const m = {};
      let espera = 0, fin = false, sentido = 0;
      for (let f = 0; f < 60 * 300 && !fin; f++) {
        if (espera > 0) { espera--; if (!espera && !N.vuelveDelFoso(L, K)) break; continue; }
        C.stepCaballero(K, decide(f, K, L, m, sem, reac, false), DT, N.mundo(L));
        for (const e of N.stepNivel(L, K, DT, VW)) {
          if (e.tipo === 'cae') espera = 30;
          if (e.tipo === 'salida') fin = true;
        }
        for (const E of L.enemigos) {
          if (E.st !== EN.AVISO || !E.atk || !E.vivo) continue;
          const k = E.tipo + ':' + E.atk;
          const c = aviso[k] || (aviso[k] = { n: 0, tapa: 0, fuera: 0 });
          const [t, fu] = tapa(E.x - L.camX, E, def.suelo);
          c.n++; c.tapa += t; c.fuera += fu;
        }
        if (hasta && K.x >= hasta - 20) fin = true;
        const c0 = L.camX;
        camara(L, K, VW, DT);
        const dc = L.camX - c0;
        if (Math.abs(dc) > 0.5) { if (sentido && Math.sign(dc) !== sentido) giros++; sentido = Math.sign(dc); }
        camRec += Math.abs(dc); frames++;
        if (K.x - L.camX > N.LIBRE - 20) ellaTapada++;
        if (!K.vivo) break;
      }
    }
  }
}

console.log('CAMARA ' + (process.env.CAM === 'vieja' ? 'VIEJA' : 'NUEVA') + ', ' + P.DIFICULTADES[dif].nombre +
  ': recorre ' + Math.round(camRec) + ' px; cambia de sentido ' + (giros / (frames / 3600)).toFixed(1) +
  ' veces por minuto; ella junto a los botones el ' + (100 * ellaTapada / frames).toFixed(2) + ' % del tiempo');
console.log('DURANTE LOS AVISOS (fotogramas, y cuanto del cuerpo del que ataca, de media):');
let peor = 0;
for (const [k, c] of Object.entries(aviso).sort()) {
  peor = Math.max(peor, c.fuera / c.n);
  console.log('  ' + k.padEnd(20), String(c.n).padStart(6), ('tapado ' + (100 * c.tapa / c.n).toFixed(1) + '%').padStart(14),
    ('fuera ' + (100 * c.fuera / c.n).toFixed(1) + '%').padStart(13));
}
console.log(peor < 0.01 ? 'ok   ningun enemigo avisa fuera de la pantalla' : 'MAL  hay avisos fuera de la pantalla (hasta el ' + (100 * peor).toFixed(0) + ' %)');
