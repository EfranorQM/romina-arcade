// LAS PELEAS, medidas con reflejos de PERSONA: cada dificultad tiene que
// cumplir los reflejos que declara (DIFICULTADES[dif].reflejos, caba-partida.js).
//
//   node tools/prueba-peleas.mjs
//
// POR QUE EXISTE (24-09-2026). "Es muy dificil incluso en el modo facil". Los
// arneses de antes median cada ataque con reflejos de 0.25 s (los de un piloto,
// no los de una persona: ver, elegir entre cuatro botones y pulsar cuesta
// 0.35 s a quien juega mucho, 0.45 a una persona normal y 0.55-0.65 a quien
// juega poco), y nadie jugaba la pelea ENTERA. Jugada entera, con los numeros
// de la v1.0.24:
//   - el garrotazo daba 0.42 / 0.32 / 0.23 s para levantar la guardia;
//   - en NORMAL una persona normal (0.45 s) no ganaba NINGUNA de 40 peleas, en
//     FURIA nadie, y en PASEO ganaba mas el que machacaba ATACAR sin defenderse
//     (28 de 40) que quien se defendia con 0.60 s (3 de 40, con el primer
//     piloto; 37 con el bueno, perdiendo 4 de sus 6 corazones);
//   - el pisoton de cerca no lo libraba NADA (dos corazones fijos).
// Lo que se mide aqui:
//   1  cuanto tiempo deja cada ataque para contestarlo, desde que empieza su
//      aviso, en cada dificultad: tiene que llegar a sus reflejos
//   2  la pelea entera contra el ogro (tools/piloto-ogro.mjs) y el machacon
//   3  el bosque entero (tools/piloto-aventura.mjs) y el machacon
// Los pilotos reaccionan con una normal (desviacion 0.08 s) alrededor de los
// reflejos de la dificultad, y la semilla es fija: dos corridas dan lo mismo.
import * as C from '../www/js/games/caba-cuerpo.js';
import * as O from '../www/js/games/ogro-cuerpo.js';
import * as N from '../www/js/games/caba-nivel.js';
import * as EN from '../www/js/games/caba-enemigos.js';
import * as P from '../www/js/games/caba-partida.js';
import { pelea, normal } from './piloto-ogro.mjs';
import { piloto as decide } from './piloto-aventura.mjs';

const DT = 1 / 60, VW = 1200;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };
let fallos = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  MAL  ') + msg); if (!c) fallos++; };
const f2 = v => v.toFixed(2);
const semilla = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

// ============================================================
console.log('\n1. EL TIEMPO PARA CONTESTAR CADA ATAQUE (desde que empieza su aviso)');
// Un ataque del ogro, forzado, con ella a `dist`; resp(t) es lo que pulsa.
function ogro(dif, atk, dist, resp) {
  const og = O.makeOgro(600, { ...P.opcionesOgro(dif, null), hp: 99 }); og.dir = 1;
  const K = C.makeCaballero(600 + dist, P.opcionesElla(dif)); K.dir = -1;
  O.empujaCuerpo(og, K);
  og.st = O.ATACA; og.atk = atk; og.atkT = 0; og.golpeo = 0;
  let pierde = 0, acabo = false;
  for (let n = 0; n < 300; n++) {
    C.stepCaballero(K, resp(n * DT), DT);
    O.stepOgro(og, K, DT, () => 0.5);
    if (og.st !== O.ATACA) acabo = true;
    if (acabo) { og.st = O.ESPERA; og.esperaT = 99; og.atk = -1; }   // solo este ataque
    O.empujaCuerpo(og, K);
    const g = O.golpeaA(og, K);
    if (g) { const hp = K.hp; C.herir(K, g.x, g.tipo, g.dano); pierde += hp - K.hp; }
    if (acabo && !og.ondas.some(w => w.vivo)) break;
  }
  return pierde;
}
// Un ataque de un enemigo del bosque, forzado, con ella en 1000 mirandole.
function bosque(dif, tipo, atk, dist, resp) {
  const def = { ...N.BOSQUE, fosos: [], tocones: [], troncos: [], ramas: [], enemigos: [[tipo, 1000 + dist]], hoguera: 99999, salida: 99999 };
  const L = N.makeNivel(def, semilla(8), P.opcionesBosque(dif));
  const K = C.makeCaballero(1000, { y: def.suelo, ...P.opcionesElla(dif) });
  const E = L.enemigos[0];
  E.despierto = true; E.recarga = 0; E.x0 = 0; E.x1 = 99999;
  E.atk = atk; E.st = EN.AVISO; E.t = 0; E.animT = 0; E.vx = 0; E.dir = -1;
  let pierde = 0;
  for (let n = 0; n < 300; n++) {
    const hp = K.hp;
    C.stepCaballero(K, resp(n * DT), DT, N.mundo(L));
    N.stepNivel(L, K, DT, VW);
    pierde += hp - K.hp;
    if ((E.st === EN.RECUPERA || E.st === EN.AGOTADA || E.st === EN.ESPERA) && !L.fuegos.some(F => !F.propio && !F.fin) && n > 10) break;
  }
  return pierde;
}
const guardia = tr => t => ({ ...NADA, bloquea: t >= tr });
const esquiva = (tr, dx) => t => ({ ...NADA, esquiva: Math.abs(t - tr) < DT / 2, dx: Math.abs(t - tr) < DT / 2 ? dx : 0 });
const salta = tr => t => ({ ...NADA, salta: Math.abs(t - tr) < DT / 2 });
// Los tiempos de reaccion (por frames) con los que la respuesta salva.
function tramo(prueba) {
  const ok = [];
  for (let k = 0; k * DT <= 1.6; k++) if (prueba(k * DT) === 0) ok.push(k * DT);
  if (!ok.length) return null;
  let huecos = 0;
  for (let i = 1; i < ok.length; i++) if (ok[i] - ok[i - 1] > DT * 1.5) huecos++;
  return { de: ok[0], a: ok[ok.length - 1], huecos };
}
const texto = t => t ? f2(t.de) + '..' + f2(t.a) + ' s' : 'NINGUNO';
// Contestar al reaccionar: vale desde el primer instante hasta, como poco, los
// reflejos de la dificultad (sin huecos).
const plazo = (t, refl) => t && t.de === 0 && t.a >= refl && !t.huecos;
// Los de CARRERA se contestan cuando vienen: el tramo tiene que cubrir los
// reflejos de la dificultad con 0.1 s de sobra por cada lado.
const cubre = (t, refl) => t && t.de <= refl - 0.1 && t.a >= refl + 0.1 && !t.huecos;
for (const dif of P.ORDEN) {
  const refl = P.DIFICULTADES[dif].reflejos;
  console.log('  -- ' + P.DIFICULTADES[dif].nombre + ': reflejos de ' + f2(refl) + ' s');
  const casos = [
    ['el GARROTE a 100 px: GUARDIA', plazo, tramo(tr => ogro(dif, O.GARROTE, 100, guardia(tr)))],
    ['el BARRIDO a 100 px: ESQUIVAR hacia el', plazo, tramo(tr => ogro(dif, O.BARRIDO, 100, esquiva(tr, -1)))],
    ['el BARRIDO a 100 px: ESQUIVAR hacia atras', plazo, tramo(tr => ogro(dif, O.BARRIDO, 100, esquiva(tr, 0)))],
    ['la EMBESTIDA a 300 px: atravesarla', cubre, tramo(tr => ogro(dif, O.EMBESTIDA, 300, esquiva(tr, -1)))],
    ['el ZARPAZO del lobo a 110 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'lobo', 'zarpazo', 110, guardia(tr)))],
    ['la ACOMETIDA del lobo a 250 px: atravesarla', cubre, tramo(tr => bosque(dif, 'lobo', 'acomete', 250, esquiva(tr, 1)))],
    ['la BOLA de la kitsune a 500 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'kitsune', 'lanza', 500, guardia(tr)))],
    ['el CORRO de la kitsune a 120 px: ESQUIVAR', plazo, tramo(tr => bosque(dif, 'kitsune', 'corro', 120, esquiva(tr, 0)))],
  ];
  for (const [nom, regla, t] of casos) ok(regla(t, refl), nom + ' vale reaccionando en ' + texto(t));
  // El pisoton se SALTA, de lejos (la onda) y de cerca (el pie): se cronometra
  // con lo que se ve venir, asi que lo que se mide es que el tramo exista y
  // sea ancho.
  for (const d of [100, 300]) {
    const t = tramo(tr => ogro(dif, O.PISOTON, d, salta(tr)));
    ok(t && t.a - t.de >= 0.2 && !t.huecos, 'el PISOTON a ' + d + ' px se salta: tramo de ' + (t ? Math.round((t.a - t.de + DT) * 1000) + ' ms' : 'NADA'));
  }
}

// ============================================================
console.log('\n2. LA PELEA ENTERA CONTRA EL OGRO (tools/piloto-ogro.mjs, 30 peleas)');
const PELEAS = 30;
function juega(dif, reac, op = {}) {
  const rs = [];
  for (let s = 1; s <= PELEAS; s++) rs.push(pelea(dif, reac, s * 7919, op));
  const cor = P.DIFICULTADES[dif].corazones, gana = rs.filter(r => r.gano);
  const que = {};
  for (const r of rs) for (const k in r.que) que[k] = (que[k] || 0) + r.que[k];
  return {
    gana: gana.length / PELEAS,
    pierde: rs.reduce((a, r) => a + (cor - r.hp), 0) / PELEAS,
    t: gana.length ? gana.reduce((a, r) => a + r.t, 0) / gana.length : 0,
    que: Object.entries(que).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + (v / PELEAS).toFixed(1)).join(', '),
  };
}
const GANA = { paseo: 0.9, normal: 0.8, furia: 0.5 };
const pct = v => Math.round(v * 100) + ' %';
for (const dif of P.ORDEN) {
  const D = P.DIFICULTADES[dif];
  const bien = juega(dif, D.reflejos), lento = juega(dif, D.reflejos + 0.1), mach = juega(dif, 0.4, { machacon: true });
  console.log('  -- ' + D.nombre + ': con ' + f2(D.reflejos) + ' s gana el ' + pct(bien.gana) + ' (' + bien.t.toFixed(0) + ' s, pierde ' + bien.pierde.toFixed(1) + '/' + D.corazones + '; ' + bien.que + ')');
  console.log('     con ' + f2(D.reflejos + 0.1) + ' s, el ' + pct(lento.gana) + '; el que no se defiende, el ' + pct(mach.gana) + ' (pierde ' + mach.pierde.toFixed(1) + '/' + D.corazones + ')');
  ok(bien.gana >= GANA[dif], D.nombre + ': con sus reflejos se gana al menos el ' + pct(GANA[dif]) + ' de las peleas');
  if (dif === 'paseo') {
    ok(mach.gana < bien.gana && mach.pierde >= 3 * bien.pierde, 'PASEO: defenderse vale la pena (el que no se defiende gana menos y pierde el triple de vida)');
  } else {
    ok(mach.gana <= 0.1, D.nombre + ': sin defenderse no se gana');
  }
}

// ============================================================
console.log('\n3. EL BOSQUE ENTERO (tools/piloto-aventura.mjs, 16 partidas)');
function recorre(dif, mu, sem, machacon = false) {
  const def = N.BOSQUE, rnd = semilla(sem * 31 + 7);
  const reac = () => Math.max(12, Math.round(normal(rnd, mu, 0.08) * 60));
  const L = N.makeNivel(def, semilla(sem), P.opcionesBosque(dif));
  const K = C.makeCaballero(160, { y: def.suelo, ...P.opcionesElla(dif) });
  const m = {};
  let espera = 0;
  for (let f = 0; f < 60 * 300; f++) {
    if (espera > 0) { espera--; if (!espera && !N.vuelveDelFoso(L, K)) return { llego: false }; continue; }
    C.stepCaballero(K, decide(f, K, L, m, sem, reac, machacon), DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) {
      if (e.tipo === 'cae') espera = 30;
      if (e.tipo === 'salida') return { llego: true, hp: K.hp };
    }
    N.camara(L, K, VW, DT);
    if (!K.vivo) return { llego: false };
  }
  return { llego: false, atascada: true };
}
for (const dif of P.ORDEN) {
  const D = P.DIFICULTADES[dif];
  const rs = [];
  for (let s = 1; s <= 16; s++) rs.push(recorre(dif, D.reflejos, s));
  const llegan = rs.filter(r => r.llego);
  const pierde = rs.reduce((a, r) => a + (r.llego ? D.corazones - r.hp : D.corazones), 0) / rs.length;
  const mach = [];
  for (let s = 1; s <= 12; s++) mach.push(recorre(dif, 0.4, s, true));
  console.log('  -- ' + D.nombre + ': con ' + f2(D.reflejos) + ' s llega en ' + llegan.length + '/16 perdiendo ' + pierde.toFixed(1) + '/' + D.corazones +
              (rs.some(r => r.atascada) ? ' (' + rs.filter(r => r.atascada).length + ' ATASCADAS: el piloto, no el bosque)' : '') +
              '; el que no se defiende llega en ' + mach.filter(r => r.llego).length + '/12');
  ok(llegan.length >= 15, D.nombre + ': con sus reflejos se pasa el bosque casi siempre');
  ok(mach.filter(r => r.llego).length <= 1, D.nombre + ': sin defenderse no se pasa');
}

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTODO OK');
process.exit(fallos ? 1 : 0);
