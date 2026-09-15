// LA MASA: la pelea entera, medida en Node sin navegador.
//
//   node tools/prueba-masa.mjs            # las pruebas con umbral (exit 1 si falla)
//   node tools/prueba-masa.mjs detalle    # ademas, cada partida ronda por ronda
//
// Importa los modulos REALES del juego (masa-pelea.js y lo que arrastra) y
// hace pelear a cuatro pilotos FISICOS contra la masa, con la geometria real:
// se mueven a 78 px/s, la espada llega a 19 + 13 px, el dash son 51 px, el
// ciclo de tajo 0.26 s, reaccionan a los avisos con latencia humana (0.22 s
// con ruido) y a veces no reaccionan. Ningun piloto es simbolico: un piloto
// que "elige el acto G" sin caminar hasta la masa mide al piloto, no al juego.
//
//   MANIAS   pega siempre por abajo (ruido de 20 grados), esquiva siempre a
//            su derecha, y repite TAJO TAJO DASH. Es la jugadora con habitos:
//            la masa TIENE que aprenderla.
//   VARIADO  cada acercamiento por un lado al azar, esquiva al azar, actos al
//            azar. La masa NO tiene que inventarse nada de el.
//   LISTA    entra por el sector mas blando, esquiva fuera de la linea
//            amarilla, no machaca. Es la jugadora buena: tiene que poder ganar.
//   MACHACA  se pega y aporrea el boton. Tiene que perder, pero no en 6 s.
//
// Cada umbral esta aqui y no en la cabeza de nadie: si se toca una constante
// del cuerpo o de la mente, se vuelve a correr esto.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const G = p => import(pathToFileURL(path.join(here, '..', 'www', 'js', p)).href);
const Pelea = await G('games/masa-pelea.js');
const Cuerpo = await G('games/masa-cuerpo.js');
const Cab = await G('games/masa-caballera.js');
const { makePelea, stepPelea, PE } = Pelea;
const { radioEn, NR, EV, ULT_RONDA, NORG } = Cuerpo;

const DETALLE = process.argv.includes('detalle');
export const DT = 1 / 60;
const fmt = v => (Math.round(v * 10) / 10).toFixed(1);
const pct = v => Math.round(v * 100) + '%';
let fallos = 0;
function ok(cond, msg) { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; }

// xorshift32, el de core.js (core.js toca document al cargar, asi que se copia)
export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.gauss = (m, sd) => { const u = 1 - r(), v = r(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return r;
}

// ---------- Pilotos ----------
// Todos comparten el mismo cuerpo: caminan hasta un punto alrededor de la
// masa, pegan cuando la tienen delante, y ante un aviso reaccionan (o no) con
// un dash. Lo que cambia es de que lado entran, hacia donde esquivan y que
// repiten.
function piloto(o) {
  return {
    nombre: o.nombre,
    crea(r) {
      return { ang: 0, reAng: 0, tellT: -1, reac: false, lat: 0.22, tGolpe: 0, idx: 0, lado: r() < 0.5 ? 1 : -1, esp: 0, pref: r() * Math.PI * 2 };
    },
    paso(P, st, r) {
      const { K, M } = P;
      const inp = { dx: 0, dy: 0, golpe: false, dash: false };
      if (P.estado !== 'pelea') return inp;
      const dxm = M.x - K.x, dym = M.y - K.y, d = Math.hypot(dxm, dym) || 1;
      const angK = Math.atan2(K.y - M.y, K.x - M.x);
      const rad = radioEn(M, angK);
      const dist = o.dist === undefined ? 20 : o.dist;

      // Reaccion a un aviso: con latencia humana y a veces sin reaccionar. Si
      // reacciona, esquiva con el dash; si el dash esta en enfriamiento (lo
      // acaba de gastar en su combo), camina fuera de la linea amarilla, que
      // es lo que haria cualquiera.
      if (M.aimOn && st.tellT < 0) { st.tellT = 0; st.reac = false; st.dashed = false; st.lat = Math.max(0.12, r.gauss(0.22, 0.05)); }
      if (!M.aimOn) st.tellT = -1;
      if (st.tellT >= 0) {
        st.tellT += DT;
        if (st.tellT >= st.lat) {
          if (!st.reac) { st.reac = true; st.reacOk = r() < o.reaccion; }
          if (st.reacOk) {
            if (K.dCd <= 0 && !st.dashed) {
              st.dashed = true;
              const e = o.esquiva(P, st, r);
              inp.dx = e[0]; inp.dy = e[1]; inp.dash = true;
            } else {
              const ax = M.aimX - M.x, ay = M.aimY - M.y, am = Math.hypot(ax, ay) || 1;
              let px = -ay / am, py = ax / am;
              if ((K.x - M.x) * px + (K.y - M.y) * py < 0) { px = -px; py = -py; }
              inp.dx = px; inp.dy = py;
            }
            return inp;
          }
        }
      }
      // Mientras la masa embiste nadie camina hacia ella: si esta en su linea,
      // sale de ella; si no, espera quieta. Sin esto el piloto volvia a "su
      // sitio" (que se mueve con la masa) y se metia debajo del toro.
      // Del toro solo se aparta quien REACCIONO al aviso: antes se apartaban
      // todos, incluido el que no habia reaccionado, y con latencia cero. Eso
      // escondia dano real de la embestida.
      if (M.st === Cuerpo.EMBISTE && st.reacOk) {
        const px = -M.ly, py = M.lx;
        const rel = (K.x - M.x) * px + (K.y - M.y) * py;
        const adelante = (K.x - M.x) * M.lx + (K.y - M.y) * M.ly;
        if (adelante > -10 && Math.abs(rel) < 40) { const sg = rel >= 0 ? 1 : -1; inp.dx = px * sg; inp.dy = py * sg; }
        return inp;
      }
      // De que lado entra: se decide al acercarse y cada pocos segundos.
      st.reAng -= DT;
      if (d > rad + 60 || st.reAng <= 0) { st.ang = o.angulo(P, st, r); st.reAng = 1.5 + r() * 2; }
      const tx = M.x + Math.cos(st.ang) * (rad + dist), ty = M.y + Math.sin(st.ang) * (rad + dist);
      const ex = tx - K.x, ey = ty - K.y, ed = Math.hypot(ex, ey);
      if (ed > 7) { inp.dx = ex / ed; inp.dy = ey / ed; return inp; }
      // Ya esta en su sitio: la masa tiene que quedarle delante (cara cardinal).
      const fx = Cab.DIRX[K.face], fy = Cab.DIRY[K.face];
      const proj = dxm * fx + dym * fy, lat = Math.abs(dxm * fy - dym * fx);
      if (proj < 0 || lat > 13 + rad * 0.8) { inp.dx = dxm / d * 0.5; inp.dy = dym / d * 0.5; return inp; }
      // Actua a su tempo
      st.tGolpe -= DT;
      if (st.tGolpe <= 0) {
        const acto = o.acto(P, st, r);
        st.tGolpe = o.tempo(st, r);
        if (acto === 'D') { const e = o.esquiva(P, st, r); inp.dx = e[0]; inp.dy = e[1]; inp.dash = true; }
        else if (acto === 'G') inp.golpe = true;
      }
      return inp;
    },
  };
}

// Direccion de esquiva RELATIVA a la masa: bin 0 hacia ella, 2 a su derecha, 4 atras, 6 izquierda.
function relDir(P, bin) {
  const { K, M } = P;
  const at = Math.atan2(M.y - K.y, M.x - K.x) + bin * Math.PI / 4;
  return [Math.cos(at), Math.sin(at)];
}
// La ventana de 3 sectores mas blanda (menos placa; una herida cuenta como blandisima).
function sectorBlando(P, r) {
  const M = P.M;
  let best = 0, bc = 1e9;
  for (let c = 0; c < NR; c++) {
    let cost = 0;
    for (let k = -1; k <= 1; k++) { const s = (c + k + NR) % NR; cost += M.placa[s] * 3 + (M.herida === s ? -6 : 0); }
    cost += r() * 0.5;
    if (cost < bc) { bc = cost; best = c; }
  }
  return best * Math.PI * 2 / NR;
}

export const PILOTOS = {
  MANIAS: piloto({
    nombre: 'MANIAS', reaccion: 0.8,
    // Le gusta pegar por abajo, pero no cruza la arena por eso: si ya esta a
    // menos de 50 grados de su lado, pega desde donde esta.
    angulo: (P, st, r) => {
      const quiere = Math.PI / 2 + r.gauss(0, 20 * Math.PI / 180);
      const ahora = Math.atan2(P.K.y - P.M.y, P.K.x - P.M.x);
      let d = ahora - quiere; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      return Math.abs(d) < 40 * Math.PI / 180 ? ahora : quiere;
    },
    esquiva: (P) => relDir(P, 2),
    acto: (P, st) => { const a = ['G', 'G', 'D'][st.idx % 3]; st.idx++; return a; },
    tempo: () => 0.42,
  }),
  VARIADO: piloto({
    nombre: 'VARIADO', reaccion: 0.8,
    angulo: (P, st, r) => r() * Math.PI * 2,
    esquiva: (P, st, r) => relDir(P, Math.floor(r() * 8)),
    acto: (P, st, r) => r() < 0.72 ? 'G' : 'D',
    tempo: (st, r) => 0.35 + r() * 0.4,
  }),
  LISTA: piloto({
    nombre: 'LISTA', reaccion: 0.92,
    angulo: (P, st, r) => sectorBlando(P, r) + r.gauss(0, 10 * Math.PI / 180),
    esquiva: (P, st, r) => {
      // Fuera de la linea amarilla: perpendicular a la direccion del aviso,
      // hacia el lado que la aleja del objetivo.
      const { K, M } = P;
      const ax = M.aimX - M.x, ay = M.aimY - M.y, am = Math.hypot(ax, ay) || 1;
      let px = -ay / am, py = ax / am;
      const s = (K.x - M.x) * px + (K.y - M.y) * py;
      if (s < 0) { px = -px; py = -py; }
      return [px, py];
    },
    acto: (P, st) => { const a = ['G', 'G', 'W'][st.idx % 3]; st.idx++; return a; },
    tempo: (st, r) => 0.36 + r() * 0.1,
  }),
  MACHACA: piloto({
    nombre: 'MACHACA', reaccion: 0.5, dist: 12,
    angulo: (P, st, r) => st.pref + r.gauss(0, 40 * Math.PI / 180),
    esquiva: (P, st, r) => relDir(P, Math.floor(r() * 8)),
    acto: () => 'G',
    tempo: () => 0.27,
  }),
};

// ---------- Una partida ----------
function partida(nombrePiloto, seed, maxS = 400) {
  const r = rng(seed);
  const pil = PILOTOS[nombrePiloto];
  const st = pil.crea(r);
  const P = makePelea(r);
  const res = { seed, gano: false, rondas: 1, tiempos: [], conect: [], dados: [], clangs: [], lineas: [], paradas: 0, paradasOk: 0, patronRoto: 0, nan: false, maxErr: 0, orgs: 0, placas: 0, danoRonda: [], ms: 0, fuente: [0, 0, 0, 0], embestidas: 0, esquivas: 0, aMedias: false, tReloj: 0 };
  let dados0 = 0, con0 = 0, cl0 = 0, hp0 = P.K.hp;
  const t0 = process.hrtime.bigint();
  let pasos = 0;
  for (let t = 0; t < maxS && !P.over; t += DT) {
    const inp = pil.paso(P, st, r);
    stepPelea(P, inp, DT);
    pasos++;
    for (let i = 0; i < P.evN; i++) {
      const e = P.evT[i];
      if (e === PE.MUDA || e === PE.GANA) {
        res.tiempos.push(P.rondaT);
        res.dados.push(P.tajosDados - dados0); res.conect.push(P.tajosConectados - con0); res.clangs.push(P.clangs - cl0);
        res.danoRonda.push(hp0 - P.K.hp);
        dados0 = P.tajosDados; con0 = P.tajosConectados; cl0 = P.clangs;
        if (e === PE.MUDA) res.lineas.push(P.lineas.slice());
      }
      if (e === PE.RONDA) { hp0 = P.K.hp; res.rondas = P.M.ronda; }
      if (e === PE.PATRON_ROTO) res.patronRoto++;
    }
    const M = P.M;
    for (let i = 0; i < M.evN; i++) {
      const e = M.evT[i];
      if (e === EV.DANO) res.fuente[Math.min(3, M.evA[i] | 0)]++;
      else if (e === EV.EMBISTE) res.embestidas++;
    }
    if (inp.dash && P.estado === 'pelea') res.esquivas++;
    if (!isFinite(M.x) || !isFinite(M.y)) { res.nan = true; break; }
    for (let k = 0; k < NORG * 7; k++) if (!isFinite(M.px[k])) { res.nan = true; break; }
    if (res.nan) break;
  }
  // La ronda a medias en la que murio tambien cuenta: sin esto, el piloto
  // que muere en la ronda 2 no deja ningun dato de la ronda 2.
  if (!P.gano && P.tajosDados - dados0 >= 4) {
    res.aMedias = true;                 // la ultima de `tiempos` no es una ronda terminada
    res.tiempos.push(P.rondaT);
    res.dados.push(P.tajosDados - dados0); res.conect.push(P.tajosConectados - con0); res.clangs.push(P.clangs - cl0);
    res.danoRonda.push(hp0 - P.K.hp);
  }
  res.ms = Number(process.hrtime.bigint() - t0) / 1e6 / pasos;
  // Tiempo de RELOJ: P.t no lo sirve porque la camara lenta de la muda lo
  // acorta, y lo que ella espera sentada es el reloj.
  res.tReloj = pasos * DT;
  res.gano = P.gano;
  res.rondas = P.M.ronda;
  res.paradas = P.paradasArmadas; res.paradasOk = P.mn.paradasOk;
  res.maxErr = P.M.maxErr;
  res.hpFin = P.K.hp;
  for (let o = 0; o < NORG; o++) if (P.M.org[o].tipo) res.orgs++;
  for (let s = 0; s < NR; s++) if (P.M.placa[s]) res.placas++;
  res.habitos = P.mn.habitos.slice();
  res.tFin = P.t;
  return res;
}

function media(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN; }

// ---------- Las pruebas ----------
if (process.env.SOLO_PILOTOS) { /* otro script solo queria los pilotos */ }
else {
// Con 20 semillas el TODO OK era una propiedad del primo 7919: cambiandolo,
// algun umbral fallaba 8 de cada 12 veces. 100 partidas por piloto cuestan
// unos segundos y los porcentajes ya no bailan.
const SEEDS = 100;
const todo = {};
for (const nombre of Object.keys(PILOTOS)) {
  const rs = [];
  for (let s = 1; s <= SEEDS; s++) rs.push(partida(nombre, s * 7919 + 13));
  todo[nombre] = rs;
  const ganadas = rs.filter(x => x.gano).length;
  const rondas = media(rs.map(x => x.rondas));
  // Ratio de tajos que conectan (cuerpo, sin CLANG) por ronda, promediado
  const porRonda = [];
  for (let k = 0; k < ULT_RONDA; k++) {
    const c = rs.filter(x => x.dados[k] !== undefined);
    if (!c.length) break;
    porRonda.push({ t: media(c.map(x => x.tiempos[k])), con: media(c.map(x => x.conect[k] / Math.max(1, x.dados[k]))), clang: media(c.map(x => x.clangs[k] / Math.max(1, x.dados[k]))), dano: media(c.map(x => x.danoRonda[k])), n: c.length });
  }
  console.log(`\n== ${nombre} == gana ${ganadas}/${SEEDS}, llega a ronda ${fmt(rondas)}, ${fmt(media(rs.map(x => x.ms)) * 1000)} us/paso, err max ${(Math.max(...rs.map(x => x.maxErr)) * 100).toFixed(1)}%, paradas ${rs.reduce((a, x) => a + x.paradas, 0)} (aciertan ${rs.reduce((a, x) => a + x.paradasOk, 0)}), patron roto ${rs.reduce((a, x) => a + x.patronRoto, 0)}`);
  console.log('   ronda:  ' + porRonda.map((p, i) => `${i + 1}`.padStart(6)).join(''));
  console.log('   dura s: ' + porRonda.map(p => fmt(p.t).padStart(6)).join(''));
  console.log('   conect: ' + porRonda.map(p => pct(p.con).padStart(6)).join(''));
  console.log('   clang:  ' + porRonda.map(p => pct(p.clang).padStart(6)).join(''));
  console.log('   dano:   ' + porRonda.map(p => fmt(p.dano).padStart(6)).join(''));
  console.log('   n:      ' + porRonda.map(p => String(p.n).padStart(6)).join(''));
  // Que dijo la primera muda
  const primeras = {};
  for (const x of rs) { const l = (x.lineas[0] || ['(no llego)'])[0]; primeras[l] = (primeras[l] || 0) + 1; }
  const fu = [0, 1, 2, 3].map(k => rs.reduce((a, x) => a + x.fuente[k], 0));
  const emb = rs.reduce((a, x) => a + x.embestidas, 0);
  console.log(`   dano: embestida ${fu[0]} de ${emb} (${pct(fu[0] / Math.max(1, emb))}), latigo ${fu[1]}, garra ${fu[2]}, hoja ${fu[3]}; esquivas pedidas ${rs.reduce((a, x) => a + x.esquivas, 0)}`);
  console.log('   muda 1: ' + Object.entries(primeras).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(' | '));
  const hab = {};
  for (const x of rs) for (const h of x.habitos) hab[h] = (hab[h] || 0) + 1;
  console.log('   habitos: ' + Object.entries(hab).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(' | '));
  if (DETALLE) for (const x of rs) console.log(`     seed ${x.seed}: ${x.gano ? 'GANA' : 'pierde'} r${x.rondas} hp${x.hpFin} t=${fmt(x.tFin)} rondas ${x.tiempos.map(fmt).join('/')} conect ${x.conect.map((c, i) => pct(c / Math.max(1, x.dados[i]))).join('/')} mudas ${x.lineas.map(l => l[0]).join(' > ')}`);
}

console.log('\n== UMBRALES ==');
const M_ = todo.MANIAS, V_ = todo.VARIADO, L_ = todo.LISTA, C_ = todo.MACHACA;
const conectR = (rs, k) => media(rs.filter(x => x.dados[k] !== undefined).map(x => x.conect[k] / Math.max(1, x.dados[k])));
// Una ronda cuenta para la duracion solo si se TERMINO: la ronda a medias en
// la que murio es la ultima de `tiempos` cuando aMedias esta puesto.
const terminada = (x, k) => x.tiempos[k] !== undefined && !(x.aMedias && k === x.tiempos.length - 1);
const duraR = (rs, k) => media(rs.filter(x => terminada(x, k)).map(x => x.tiempos[k]));

console.log('-- lo que se aprende --');
ok(conectR(M_, 1) <= 0.82, `MANIAS conecta <= 82% en la ronda 2 (${pct(conectR(M_, 1))}): la placa le tapa su lado`);
ok(conectR(V_, 1) >= 0.88, `VARIADO conecta >= 88% en la ronda 2 (${pct(conectR(V_, 1))}): a el no le crece nada que estorbe`);
ok(conectR(M_, 1) <= conectR(V_, 1) - 0.1, `MANIAS conecta al menos 10 puntos menos que VARIADO en la ronda 2`);
const m1 = M_.filter(x => x.lineas[0] && x.lineas[0][0] !== 'CRECIO' && x.lineas[0][0] !== 'NO ME PILLO NADA').length;
ok(m1 >= SEEDS * 0.9, `MANIAS: la muda 1 le aprende algo con nombre en >= 90% (${m1}/${SEEDS})`);
const v1 = V_.filter(x => x.lineas[0] && x.lineas[0][0].startsWith('TAJO POR')).length;
ok(v1 <= SEEDS * 0.25, `VARIADO: la muda 1 NO le inventa un lado en > 75% (${v1}/${SEEDS} con placa)`);
// 'A TU DER', no 'A TU DERECHA': las palabras se acortaron para que el letrero
// cupiera en 270 px (masa-mente.js).
const mEsq = M_.filter(x => x.habitos.some(h => h.startsWith('ESQUIVAS A TU DER'))).length;
ok(mEsq >= SEEDS * 0.7, `MANIAS: le aprende la esquiva a la derecha en >= 70% (${mEsq}/${SEEDS})`);
const cPar = C_.reduce((a, x) => a + x.paradas, 0), cParOk = C_.reduce((a, x) => a + x.paradasOk, 0);
ok(cPar >= 20 && cParOk / cPar >= 0.45, `MACHACA: la masa le apuesta paradas y aciertan >= 45% (${cParOk}/${cPar})`);
const vPar = V_.reduce((a, x) => a + x.paradas, 0);
ok(vPar <= cPar * 0.3, `VARIADO: la masa casi no le apuesta paradas (${vPar} vs ${cPar} a MACHACA)`);
const lRoto = L_.reduce((a, x) => a + x.patronRoto, 0);
ok(lRoto >= 20, `LISTA rompe el patron y expone a la masa (${lRoto} veces en ${SEEDS} partidas)`);

console.log('-- el ritmo --');
// La ronda 1 es la misma para todos (la masa aun no sabe nada): lo que cambia
// es cuanto camina cada piloto. El de manias cruza la arena para pegar por su
// lado y es el mas lento.
for (const [n, rs, tope] of [['MANIAS', M_, 55], ['VARIADO', V_, 50], ['LISTA', L_, 45]]) {
  const d1 = duraR(rs, 0);
  ok(d1 >= 14 && d1 <= tope, `${n}: la ronda 1 dura entre 14 y ${tope} s (${fmt(d1)})`);
  for (let k = 1; k < ULT_RONDA; k++) {
    const c = rs.filter(x => terminada(x, k));
    if (c.length < 10) break;          // con menos de diez partidas es una anecdota, no una medida
    const dk = media(c.map(x => x.tiempos[k]));
    ok(dk <= 60, `${n}: la ronda ${k + 1} dura <= 60 s (${fmt(dk)}, ${c.length} partidas)`);
  }
}
console.log('-- quien gana --');
ok(L_.filter(x => x.gano).length >= SEEDS * 0.6, `LISTA gana >= 60% (${L_.filter(x => x.gano).length}/${SEEDS})`);
const lGana = L_.filter(x => x.gano);
ok(lGana.length >= 10 && media(lGana.map(x => x.tReloj)) <= 300,
   `LISTA, cuando gana, tarda <= 5 min de reloj (${fmt(media(lGana.map(x => x.tReloj)))} s en ${lGana.length} victorias)`);
ok(C_.filter(x => x.gano).length <= SEEDS * 0.3, `MACHACA gana <= 30% (${C_.filter(x => x.gano).length}/${SEEDS})`);
ok(media(C_.map(x => x.tFin)) >= 40, `MACHACA aguanta >= 40 s (${fmt(media(C_.map(x => x.tFin)))} s): no muere en seis segundos`);
ok(media(M_.map(x => x.rondas)) >= 2, `MANIAS llega a la ronda 2 de media (${fmt(media(M_.map(x => x.rondas)))}): pierde por sus manias, pero le da tiempo a verlas`);

console.log('-- la fisica --');
const all = [...M_, ...V_, ...L_, ...C_];
ok(!all.some(x => x.nan), 'sin NaN en 80 partidas');
ok(Math.max(...all.map(x => x.maxErr)) <= 0.10, `error de restriccion en reposo <= 10% (menos de 1 px en un tramo de 9) (${(Math.max(...all.map(x => x.maxErr)) * 100).toFixed(1)}%)`);
ok(media(all.map(x => x.ms)) <= 0.03, `<= 0.03 ms/paso (${(media(all.map(x => x.ms))).toFixed(4)})`);

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
}
