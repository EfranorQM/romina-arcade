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
// Deja apuntado si hubo PARADA (`paro`) y cuando se fijo el picado (`fija`).
let paro = false, fija = null, cae = null, sombra = null;
function bosque(dif, tipo, atk, dist, resp) {
  const def = { ...N.BOSQUE, fosos: [], tocones: [], troncos: [], ramas: [], enemigos: [[tipo, 1000 + dist]], hogueras: [], salida: 99999 };
  const L = N.makeNivel(def, semilla(8), P.opcionesBosque(dif));
  const K = C.makeCaballero(1000, { y: def.suelo, ...P.opcionesElla(dif) });
  const E = L.enemigos[0];
  E.despierto = true; E.recarga = 0; E.x0 = 0; E.x1 = 99999;
  E.atk = atk; E.st = EN.AVISO; E.t = 0; E.animT = 0; E.vx = 0; E.dir = -1;
  let pierde = 0;
  paro = false; fija = null; cae = null; sombra = null;
  if (atk === 'salto') { E.saltoX0 = E.x; E.saltoX1 = 1000 - E.T.salto.pasa; }
  for (let n = 0; n < 300; n++) {
    const hp = K.hp;
    C.stepCaballero(K, resp(n * DT, K), DT, N.mundo(L));
    N.stepNivel(L, K, DT, VW);
    pierde += hp - K.hp;
    if (K.parada > 0) paro = true;
    if (E.fase === 'fija' && fija === null) fija = (n + 1) * DT;
    if (atk === 'salto' && E.atk === 'estocada' && cae === null) cae = (n + 1) * DT;
    if (L.fuegos.some(F => F.gota) && sombra === null) sombra = (n + 1) * DT;
    if (E.st === EN.ESPERA && n > 10) E.recarga = 99;       // solo este ataque
    if ((E.st === EN.RECUPERA || E.st === EN.AGOTADA || E.st === EN.ESPERA || E.st === EN.HUYE) && !L.fuegos.some(F => !F.propio && !F.fin) && n > 10) break;
  }
  return pierde;
}
const guardia = tr => t => ({ ...NADA, bloquea: t >= tr });
const esquiva = (tr, dx) => t => ({ ...NADA, esquiva: Math.abs(t - tr) < DT / 2, dx: Math.abs(t - tr) < DT / 2 ? dx : 0 });
const salta = tr => t => ({ ...NADA, salta: Math.abs(t - tr) < DT / 2 });
// Los tiempos de reaccion (por frames) con los que la respuesta salva.
function tramo(prueba, hasta = 1.6) {
  const ok = [];
  for (let k = 0; k * DT <= hasta; k++) if (prueba(k * DT) === 0) ok.push(k * DT);
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
    // Los que se SALTAN se cronometran (saltar pronto es caer antes): su
    // tramo tiene que cubrir los reflejos de la dificultad, como los de carrera.
    ['el BARRIDO BAJO del lobo a 110 px: SALTAR', cubre, tramo(tr => bosque(dif, 'lobo', 'barre', 110, salta(tr)))],
  ];
  for (const [nom, regla, t] of casos) ok(regla(t, refl), nom + ' vale reaccionando en ' + texto(t));
  // LOS DEL FINAL DEL BOSQUE (24-09-2026).
  const nuevos = [
    ['el TAJO del cuervo a 110 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'karasu', 'tajo', 110, guardia(tr)))],
    ['el DESENVAINE del yamabushi a 140 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'yamabushi', 'iai', 140, guardia(tr)))],
    ['el ZARPAZO HACIA ARRIBA del jefe a 110 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'alfa', 'levanta', 110, guardia(tr)))],
  ];
  // El relampago se salta por el ritmo, desde lo que tarda en arrancar: como
  // el barrido, a las dos puntas de la distancia a la que lo suelta.
  for (const d of [310, 390, 460]) nuevos.push(['el RELAMPAGO del yamabushi a ' + d + ' px: SALTAR', cubre, tramo(tr => bosque(dif, 'yamabushi', 'relampago', d, salta(tr)))]);
  for (const [nom, regla, t] of nuevos) ok(regla(t, refl), nom + ' vale reaccionando en ' + texto(t));
  // EL PICADO se contesta desde que se FIJA (antes la sigue, y esquivar no la
  // saca de debajo): desde ahi, como los demas, del primer instante a sus
  // reflejos. Hacia los dos lados.
  bosque(dif, 'karasu', 'picado', 300, () => NADA);
  const tf = fija;
  for (const lado of [1, -1]) {
    const t = tramo(r => bosque(dif, 'karasu', 'picado', 300, esquiva(tf + r, lado)), 1.0);
    ok(plazo(t, refl), 'el PICADO del cuervo (se fija a los ' + f2(tf) + ' s): ESQUIVAR hacia ' + (lado > 0 ? 'delante' : 'atras') + ' vale reaccionando en ' + texto(t));
  }
  // Andando no se sale de su sombra, ni se salta, ni la guardia lo para: el
  // picado pide ESQUIVAR.
  {
    const andando = tramo(r => bosque(dif, 'karasu', 'picado', 300, t => ({ ...NADA, dx: t >= tf + r ? 1 : 0 })), 1.0);
    const saltando = tramo(r => bosque(dif, 'karasu', 'picado', 300, salta(tf + r)), 1.0);
    const parando = tramo(r => bosque(dif, 'karasu', 'picado', 300, guardia(tf + r)), 1.0);
    ok(!plazo(andando, refl) && !saltando && !parando, 'el PICADO no se libra andando (' + texto(andando) + '), saltando (' + texto(saltando) + ') ni con la guardia (' + texto(parando) + ')');
  }
  // EL JEFE: su zarpazo hacia arriba no se salta (es lo que lo distingue del
  // barrido).
  {
    const t = tramo(tr => bosque(dif, 'alfa', 'levanta', 110, salta(tr)));
    ok(!t, 'el ZARPAZO HACIA ARRIBA no se libra saltando (' + texto(t) + ')');
  }
  // LOS VAMPIROS DEL CEMENTERIO (25-09-2026).
  const vamp = [
    ['la ZARPA de la vampira a 110 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'vampira', 'zarpa', 110, guardia(tr)))],
    ['el MORDISCO de la vampira a 120 px: ESQUIVAR hacia atras', plazo, tramo(tr => bosque(dif, 'vampira', 'muerde', 120, esquiva(tr, -1)))],
    ['la ESTOCADA del vampiro a 140 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'vampiro', 'estocada', 140, guardia(tr)))],
    ['el TAJO BAJO del vampiro a 110 px: SALTAR', cubre, tramo(tr => bosque(dif, 'vampiro', 'bajo', 110, salta(tr)))],
    ['el DARDO de la condesa a 500 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'condesa', 'dardo', 500, guardia(tr)))],
    ['la ZARPA de la condesa a 110 px: GUARDIA', plazo, tramo(tr => bosque(dif, 'condesa', 'zarpa', 110, guardia(tr)))],
  ];
  for (const [nom, regla, t] of vamp) ok(regla(t, refl), nom + ' vale reaccionando en ' + texto(t));
  {
    // el mordisco rompe la guardia
    const t = tramo(tr => bosque(dif, 'vampira', 'muerde', 120, guardia(tr)));
    ok(!t, 'el MORDISCO no se para con la guardia (' + texto(t) + ')');
  }
  // EL SALTO POR ENCIMA: cae a su espalda y la estocada llega por detras. Se
  // contesta GIRANDOSE (el stick hacia el) y levantando la guardia; el plazo
  // cuenta desde que cae (su aviso).
  {
    bosque(dif, 'vampiro', 'salto', 250, () => NADA);
    const tc = cae;
    // (cae a su IZQUIERDA: ella mira a la derecha, hacia donde estaba el)
    const girar = tr => t => t < tc + tr ? NADA : t < tc + tr + 0.05 ? { ...NADA, dx: -0.5 } : { ...NADA, bloquea: true };
    const t = tramo(r => bosque(dif, 'vampiro', 'salto', 250, girar(r)), 1.0);
    ok(plazo(t, refl), 'el SALTO del vampiro (cae a su espalda a los ' + f2(tc || 0) + ' s): GIRARSE Y GUARDIA vale reaccionando en ' + texto(t));
    const sinGirar = tramo(r => bosque(dif, 'vampiro', 'salto', 250, t => ({ ...NADA, bloquea: t >= (tc || 0) + r })), 1.0);
    ok(!sinGirar, 'la estocada por la espalda no se para SIN girarse (' + texto(sinGirar) + ')');
  }
  // LA LLUVIA: desde que salen las sombras, andar hasta salir de la suya (y
  // quedarse entre dos) vale del primer instante a los reflejos.
  {
    const salir = tr => {
      let x0 = null;
      return (t, K) => {
        if (t < tr) return NADA;
        if (x0 === null) x0 = K.x;
        return Math.abs(K.x - x0) < 72 ? { ...NADA, dx: 1 } : NADA;
      };
    };
    bosque(dif, 'condesa', 'lluvia', 400, () => NADA);
    const ts = sombra;
    const t = tramo(r => bosque(dif, 'condesa', 'lluvia', 400, salir(ts + r)), 1.4);
    ok(plazo(t, refl), 'la LLUVIA de la condesa (las sombras salen a los ' + f2(ts || 0) + ' s): SALIR DE LA SOMBRA andando vale reaccionando en ' + texto(t));
    const quieta = bosque(dif, 'condesa', 'lluvia', 400, () => NADA);
    const guardando = bosque(dif, 'condesa', 'lluvia', 400, guardia(0));
    ok(quieta > 0 && guardando > 0, 'la LLUVIA le da si se queda quieta (' + quieta + ') o con la guardia (' + guardando + ')');
  }
  // LA PARADA del desenvaine (lo que lo aturde): reaccionando con los
  // reflejos de la dificultad, la guardia sube a tiempo de PARARLO, no solo
  // de taparse. Es lo que abre al yamabushi.
  {
    const ok0 = [];
    for (let k = 0; k * DT <= 1.2; k++) { if (bosque(dif, 'yamabushi', 'iai', 140, guardia(k * DT)) === 0 && paro) ok0.push(k * DT); }
    const t = ok0.length ? { de: ok0[0], a: ok0[ok0.length - 1], huecos: 0 } : null;
    ok(t && t.de <= refl && t.a >= refl, 'la PARADA del desenvaine sale reaccionando en ' + texto(t) + ' (sus reflejos, ' + f2(refl) + ' s, dentro)');
  }
  // El FUEGO RASTRERO se salta cuando llega (se ve venir por el suelo, como la
  // onda del ogro): que el tramo exista y sea ancho.
  {
    const t = tramo(tr => bosque(dif, 'kitsune', 'rastrero', 500, salta(tr)), 3.2);
    ok(t && t.a - t.de >= 0.2 && !t.huecos, 'el FUEGO RASTRERO a 500 px se salta: tramo de ' + (t ? Math.round((t.a - t.de + DT) * 1000) + ' ms (' + texto(t) + ')' : 'NADA'));
  }
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
// EL BOSQUE, POR TRAMOS DE HOGUERA A HOGUERA. Desde el 24-09-2026 es largo
// (10700 px, dos hogueras) y en el juego perder devuelve a la ultima hoguera
// con todos los corazones: lo que se mide es cada tramo con los suyos. Los dos
// primeros son camino (se pasan casi siempre); el ultimo es la pelea del jefe
// (el yamabushi y el lobo blanco con su manada) y se le pide lo que al ogro.
// El que no se defiende se mide en el bosque entero y sin hogueras.
console.log('\n3. LOS NIVELES, POR TRAMOS (tools/piloto-aventura.mjs, 16 partidas por tramo)');
function recorre(dif, mu, sem, machacon = false, desde = 0, hasta = 0, def = N.BOSQUE) {
  const rnd = semilla(sem * 31 + 7);
  const reac = () => Math.max(12, Math.round(normal(rnd, mu, 0.08) * 60));
  const L = N.makeNivel(def, semilla(sem), P.opcionesBosque(dif));
  if (desde) { L.hoguera = desde; L.seguroX = desde + 40; }
  const K = C.makeCaballero(desde ? desde + 40 : 160, { y: def.suelo, ...P.opcionesElla(dif) });
  const m = {};
  let espera = 0;
  for (let f = 0; f < 60 * 300; f++) {
    if (espera > 0) { espera--; if (!espera && !N.vuelveDelFoso(L, K)) return { llego: false }; continue; }
    C.stepCaballero(K, decide(f, K, L, m, sem, reac, machacon), DT, N.mundo(L));
    for (const e of N.stepNivel(L, K, DT, VW)) {
      if (e.tipo === 'cae') espera = 30;
      if (e.tipo === 'salida') return { llego: true, hp: K.hp };
    }
    // (a 20 px de la hoguera: encenderla cura, y se mediria la vida curada)
    if (hasta && K.x >= hasta - 20) return { llego: true, hp: K.hp };
    N.camara(L, K, VW, DT);
    if (!K.vivo) return { llego: false };
  }
  return { llego: false, atascada: true };
}
for (const def of [N.BOSQUE, N.CEMENTERIO]) {
const H = def.hogueras;
const TRAMOS = [['hasta la 1a hoguera', 0, H[0]], ['de la 1a a la 2a', H[0], H[1]], ['de la 2a al final (el jefe)', H[1], 0]];
console.log('  ==== ' + def.nombre);
for (const dif of P.ORDEN) {
  const D = P.DIFICULTADES[dif];
  console.log('  -- ' + D.nombre + ' (reflejos de ' + f2(D.reflejos) + ' s, ' + D.corazones + ' corazones)');
  TRAMOS.forEach(([nom, desde, hasta], i) => {
    const rs = [];
    for (let s = 1; s <= 16; s++) rs.push(recorre(dif, D.reflejos, s, false, desde, hasta, def));
    const llegan = rs.filter(r => r.llego).length;
    const pierde = rs.reduce((a, r) => a + (r.llego ? D.corazones - r.hp : D.corazones), 0) / rs.length;
    const jefe = i === TRAMOS.length - 1, pide = jefe ? Math.ceil(16 * GANA[dif]) : 15;
    ok(llegan >= pide, D.nombre + ' ' + nom + ': llega en ' + llegan + '/16 (pide ' + pide + ') perdiendo ' + pierde.toFixed(1) + '/' + D.corazones +
       (rs.some(r => r.atascada) ? ' (' + rs.filter(r => r.atascada).length + ' ATASCADAS: el piloto, no el bosque)' : ''));
  });
  const mach = [];
  for (let s = 1; s <= 12; s++) mach.push(recorre(dif, 0.4, s, true, 0, 0, def));
  const mll = mach.filter(r => r.llego);
  if (dif === 'paseo') {
    // En PASEO, como contra el ogro: defenderse tiene que valer mucho mas
    // (menos de la mitad llegan, y perdiendo el triple o todo). Ojo: desde que
    // ENCENDER UNA HOGUERA CURA, cada tramo empieza con la vida llena y quien
    // machaca se arrastra de tramo en tramo; lo que lo para es el jefe. En el
    // cementerio llegaba 11 de 16 hasta que la zarpa de la condesa, si entra,
    // encadena otra (25-09-2026); y 7 de 12 cuando empezo a lanzar al caer de
    // su brinco, hasta que la lluvia apunto adonde va ella (quien corre sin
    // mirar se come las gotas).
    const bien = [];
    for (let s = 1; s <= 12; s++) bien.push(recorre(dif, D.reflejos, s, false, 0, 0, def));
    const pierde = bien.reduce((a, r) => a + (r.llego ? D.corazones - r.hp : D.corazones), 0) / bien.length;
    const mpierde = mach.reduce((a, r) => a + (r.llego ? D.corazones - r.hp : D.corazones), 0) / mach.length;
    ok(mll.length <= 6 && mpierde >= Math.min(3 * pierde, D.corazones),
       'PASEO: defenderse vale la pena (el nivel entero sin hogueras: defendiendose pierde ' + pierde.toFixed(1) + '; sin defenderse llega en ' + mll.length + '/12 y pierde ' + mpierde.toFixed(1) + ')');
  } else ok(mll.length <= 1, D.nombre + ': sin defenderse no se pasa (llega en ' + mll.length + '/12)');
}
}

console.log(fallos ? '\n' + fallos + ' FALLOS' : '\nTODO OK');
process.exit(fallos ? 1 : 0);
