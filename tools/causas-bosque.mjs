// QUE SE LLEVA LOS CORAZONES en el bosque: cada golpe con su enemigo y su
// ataque, en 16 partidas del piloto (tools/piloto-aventura.mjs) con reflejos
// de persona, y donde muere la que no llega. Lo que prueba-peleas.mjs dice
// con un si o un no, esto lo dice con nombres: es lo que hay que mirar para
// ajustar un enemigo.
//
//   node tools/causas-bosque.mjs [paseo normal furia] [--desde X] [--hasta X]
//                                [--machacon] [--reac 0.75] [--nivel cementerio]
//
// --desde X empieza en la hoguera de X (con ella encendida); --hasta X acaba
// al llegar a X (a 20 px: encender una hoguera cura). --machacon: el piloto
// que no se defiende; --reac: otros reflejos (por defecto, los de la
// dificultad).
import * as C from '../www/js/games/caba-cuerpo.js';
import * as N from '../www/js/games/caba-nivel.js';
import * as P from '../www/js/games/caba-partida.js';
import { piloto as decide } from './piloto-aventura.mjs';
import { normal } from './piloto-ogro.mjs';

const DT = 1 / 60, VW = 1200;
const semilla = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const machacon = process.argv.includes('--machacon');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const desde = arg('--desde', 0), hasta = arg('--hasta', 0), mu = arg('--reac', 0);
const nivel = process.argv.includes('--nivel') ? process.argv[process.argv.indexOf('--nivel') + 1] : 'bosque';
const difs = process.argv.slice(2).filter((a, i, v) => !a.startsWith('--') && !(v[i - 1] || '').startsWith('--'));
for (const dif of difs.length ? difs : P.ORDEN) {
  const D = P.DIFICULTADES[dif];
  const causas = {}, tiempos = [], muertes = {};
  let llegan = 0;
  for (let sem = 1; sem <= 16; sem++) {
    const def = N.NIVELES[nivel], rnd = semilla(sem * 31 + 7);
    const reac = () => Math.max(12, Math.round(normal(rnd, mu || (machacon ? 0.4 : D.reflejos), 0.08) * 60));
    const L = N.makeNivel(def, semilla(sem), P.opcionesBosque(dif));
    if (desde) { L.hoguera = desde; L.seguroX = desde + 40; }
    const K = C.makeCaballero(desde ? desde + 40 : 160, { y: def.suelo, ...P.opcionesElla(dif) });
    const m = {};
    let espera = 0, fin = null, ultimo = '?';
    for (let f = 0; f < 60 * 400 && !fin; f++) {
      if (espera > 0) { espera--; if (!espera && !N.vuelveDelFoso(L, K)) fin = 'foso'; continue; }
      const hp = K.hp;
      C.stepCaballero(K, decide(f, K, L, m, sem, reac, machacon), DT, N.mundo(L));
      for (const e of N.stepNivel(L, K, DT, VW)) {
        if (e.tipo === 'cae') { espera = 30; const k = 'foso ' + Math.round(K.x / 100) * 100; causas[k] = (causas[k] || 0) + 1; ultimo = k; }
        if (e.tipo === 'salida') { fin = 'llega'; tiempos.push(f * DT); }
        if (hasta && K.x >= hasta - 20 && !fin) { fin = 'llega'; tiempos.push(f * DT); }
        if ((e.tipo === 'golpe' || e.tipo === 'quema') && hp > K.hp) {
          const E = e.enemigo, k = E ? E.tipo + '.' + (e.rastrero ? 'rastrero' : E.atk) : e.rastrero ? 'kitsune.rastrero' : e.gota ? 'condesa.gota' : e.sangre ? 'condesa.dardo' : 'fuego';
          causas[k] = (causas[k] || 0) + 1; ultimo = k;
        }
        if ((e.tipo === 'golpeTronco' || e.tipo === 'golpeRama') && hp > K.hp) { causas[e.tipo] = (causas[e.tipo] || 0) + 1; ultimo = e.tipo; }
      }
      N.camara(L, K, VW, DT);
      if (!K.vivo && !fin) fin = 'muere';
    }
    if (fin === 'llega') llegan++;
    else muertes[(fin || 'atascada') + ' (' + ultimo + ', x ' + Math.round(K.x) + ')'] = 1 + (muertes[(fin || 'atascada') + ' (' + ultimo + ', x ' + Math.round(K.x) + ')'] || 0);
  }
  console.log('--', D.nombre, machacon ? '(MACHACON)' : '', 'llega', llegan + '/16', tiempos.length ? 'en ' + (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(0) + ' s' : '');
  console.log('   corazones por causa (en 16):', Object.entries(causas).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
  if (Object.keys(muertes).length) console.log('   no llega:', Object.entries(muertes).map(([k, v]) => k + ' x' + v).join('; '));
}
