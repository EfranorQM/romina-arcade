// LA PARTIDA DE ROMINA, medida en Node sin navegador.
//
//   node tools/prueba-caba-partida.mjs
//
// Lo que rodea a la pelea (www/js/games/caba-partida.js): que las tres
// dificultades sean JUSTAS jugadas con la regla real, que los puntos y la nota
// premien lo que dicen, que la primera pelea enseñe sin atascarse, y que las
// canciones del arcade no lleven notas que no suenan.
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const G = (f) => pathToFileURL(path.join(here, '..', 'www', 'js', f)).href;
const C = await import(G('games/caba-cuerpo.js'));
const O = await import(G('games/ogro-cuerpo.js'));
const P = await import(G('games/caba-partida.js'));
const AU = await import(G('audio.js'));

const DT = 1 / 60;
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '   ok  ' : '   MAL ') + msg); if (!cond) fallos++; };
const nada = { dx: 0, salta: false, golpea: false, esquiva: false, saltaAbajo: false, bloquea: false };
const ms = v => v.toFixed(0) + ' ms';

// Un ataque del ogro contra ella, con la regla REAL de la escena (golpeaA,
// herir, empujaCuerpo), en la dificultad `dif`. Igual que la seccion 6 de
// prueba-ogro.mjs, que mide la dificultad normal.
function ataque(dif, atk, dist, resp) {
  const og = O.makeOgro(500, P.opcionesOgro(dif, null)); og.dir = 1;
  const K = C.makeCaballero(500 + dist, P.opcionesElla(dif)); K.dir = -1;
  og.st = O.ATACA; og.atk = atk; og.atkT = 0; og.golpeo = 0;
  const r = { pierde: 0, parada: 0 };
  for (let n = 0; n < 240 && og.st === O.ATACA; n++) {
    C.stepCaballero(K, resp(n * DT), DT);
    O.stepOgro(og, K, DT, () => 0.5);
    O.empujaCuerpo(og, K);
    const g = O.golpeaA(og, K);
    if (!g) continue;
    const hp = K.hp, res = C.herir(K, g.x, g.tipo, g.dano);
    if (K.hp < hp) r.pierde++;
    if (res === 'parada') { r.parada++; O.abrePorParada(og, C.PARADA_PREMIO); }
  }
  return r;
}
// En cuantos frames se puede pulsar la respuesta y salir ilesa, hasta el final
// del golpe (con el aviso al ritmo de la dificultad).
function ventana(dif, atk, dist, resp) {
  const D = P.DIFICULTADES[dif], a = O.ATAQUES[atk];
  const finGolpe = a[1] / D.ritmoCarga + (a[2] - a[1]);
  const salva = [];
  for (let k = 0; k * DT <= finGolpe; k++) if (ataque(dif, atk, dist, resp(k * DT)).pierde === 0) salva.push(k * DT);
  return salva.length ? (salva[salva.length - 1] - salva[0] + DT) * 1000 : 0;
}
const mantiene = (tp) => t => ({ ...nada, bloquea: t >= tp });
const pulsa = (tp, que) => t => ({ ...nada, ...(Math.abs(t - tp) < DT / 2 ? que : {}) });
const ATRAS = { esquiva: true }, HACIA = { esquiva: true, dx: -1 };

console.log('== 1) LAS TRES DIFICULTADES SON JUSTAS ==');
{
  const nom = ['garrote', 'pisoton', 'barrido', 'embestida'];
  const guardias = {};
  for (const dif of P.ORDEN) {
    const D = P.DIFICULTADES[dif];
    console.log('   -- ' + D.nombre + ': ' + D.corazones + ' corazones, el ogro con ' + D.ogroHp + ' de vida');
    // El aviso mas corto tiene que dar tiempo a reaccionar en un movil.
    let corto = 9, cual = '';
    O.ATAQUES.forEach((a, i) => { const c = a[1] / D.ritmoCarga; if (c < corto) { corto = c; cual = nom[i]; } });
    ok(corto >= 0.30, 'el aviso mas corto (' + cual + ') dura ' + corto.toFixed(2) + ' s (hace falta >= 0.30)');
    // La guardia contra el garrotazo, y la parada.
    const g = ventana(dif, O.GARROTE, 150, mantiene);
    guardias[dif] = g;
    ok(g >= (dif === 'furia' ? 200 : 250), 'levantar la GUARDIA contra el garrotazo salva pulsando en ' + ms(g));
    let parada = false;
    for (let k = 0; k * DT < 1 && !parada; k++) if (ataque(dif, O.GARROTE, 150, mantiene(k * DT)).parada) parada = true;
    ok(parada, 'y a tiempo, es una PARADA');
    // Esquivar el barrido y la embestida.
    const b = Math.max(ventana(dif, O.BARRIDO, 150, tp => pulsa(tp, ATRAS)), ventana(dif, O.BARRIDO, 150, tp => pulsa(tp, HACIA)));
    ok(b >= 250, 'ESQUIVAR el barrido salva pulsando en ' + ms(b));
    const e = ventana(dif, O.EMBESTIDA, 150, tp => pulsa(tp, HACIA));
    ok(e >= 250, 'atravesar la embestida salva pulsando en ' + ms(e));
  }
  ok(guardias.paseo >= guardias.normal && guardias.normal >= guardias.furia,
     'la guardia es mas facil cuanto mas facil la dificultad (' + ms(guardias.paseo) + ' > ' + ms(guardias.normal) + ' > ' + ms(guardias.furia) + ')');
}

console.log('== 2) LOS PUNTOS PREMIAN LO QUE DICEN ==');
{
  const gana = (o) => ({ gano: true, t: 100, vida: 2, vidaMax: 4, paradas: 1, contras: 1, dano: 24, ogroHp: 24, ...o });
  const pierde = (o) => ({ gano: false, t: 100, vida: 0, vidaMax: 4, paradas: 0, contras: 0, dano: 20, ogroHp: 24, ...o });
  for (const dif of P.ORDEN) {
    const peorVictoria = P.puntua(gana({ vida: 1, paradas: 0, contras: 0, t: 999 }), dif).puntos;
    const mejorDerrota = P.puntua(pierde({ dano: 24 }), dif).puntos;
    ok(peorVictoria > mejorDerrota, P.DIFICULTADES[dif].nombre + ': la peor victoria (' + peorVictoria + ') vale mas que la mejor derrota (' + mejorDerrota + ')');
  }
  const base = P.puntua(gana(), 'normal').puntos;
  ok(P.puntua(gana({ vida: 4 }), 'normal').puntos > base, 'con mas vida, mas puntos');
  ok(P.puntua(gana({ t: 60 }), 'normal').puntos > base, 'ganando antes, mas puntos');
  ok(P.puntua(gana({ paradas: 3, contras: 3 }), 'normal').puntos > base, 'parando y contraatacando, mas puntos');
  ok(P.puntua(gana(), 'furia').puntos > base && P.puntua(gana(), 'paseo').puntos < base, 'la misma pelea vale mas en furia y menos en paseo');
  // Las notas: la S pide casi perfeccion; una pelea normal saca B o C.
  const perfecta = P.puntua(gana({ vida: 4, t: 70, paradas: 4, contras: 3 }), 'normal');
  const justa = P.puntua(gana({ vida: 1, t: 140, paradas: 0, contras: 0 }), 'normal');
  const media = P.puntua(gana({ vida: 2, t: 110, paradas: 1, contras: 1 }), 'normal');
  console.log('      perfecta ' + perfecta.base + ' (' + perfecta.nota + '), media ' + media.base + ' (' + media.nota + '), justa ' + justa.base + ' (' + justa.nota + ')');
  ok(perfecta.nota === 'S', 'sin perder vida, rapida y parando: S');
  ok(justa.nota === 'C', 'ganando por los pelos: C');
  ok(media.nota === 'B' || media.nota === 'C', 'una victoria corriente: B o C, no regalada');
  ok(P.puntua(gana({ vida: 4, t: 70, paradas: 4, contras: 3 }), 'paseo').nota === 'S', 'la nota no depende de la dificultad (la S de paseo cuesta lo mismo)');
}

console.log('== 3) LA PRIMERA PELEA ENSEÑA, Y NO SE ATASCA ==');
{
  let M = P.makeMaestro(null);
  ok(JSON.stringify(P.permitidos(M)) === JSON.stringify([O.GARROTE]), 'al principio el ogro solo da garrotazos');
  let e = P.empieza(M, O.GARROTE);
  ok(e && e.lento && e.leccion.boton === 'guardia', 'el primero sale a camara lenta, con el consejo de GUARDIA');
  P.acaba(M);
  e = P.empieza(M, O.GARROTE);
  ok(e && !e.lento, 'el segundo ya no va lento, pero el consejo sigue');
  P.anota(M, 'para'); P.anota(M, 'golpe');
  ok(P.acaba(M) === null, 'parado pero comiendose el golpe: NO cuenta');
  P.empieza(M, O.GARROTE); P.anota(M, 'para');
  const L = P.acaba(M);
  ok(L && L.atk === O.GARROTE, 'parandolo limpio, aprende el garrotazo');
  ok(JSON.stringify(P.permitidos(M)) === JSON.stringify([O.GARROTE, O.PISOTON]), 'y el ogro suelta el pisoton');
  // Tres pisotones sin saltar: se suelta el siguiente igual.
  for (let i = 0; i < P.INTENTOS; i++) { P.empieza(M, O.PISOTON); P.anota(M, 'golpe'); P.acaba(M); }
  ok(P.permitidos(M).includes(O.BARRIDO), 'sin aprender el pisoton en ' + P.INTENTOS + ' intentos, suelta el barrido igual');
  ok(P.empieza(M, O.PISOTON) !== null, 'pero el consejo del pisoton sigue saliendo');
  P.acaba(M);
  // Y en la pelea siguiente ya no frena el juego: el consejo sale sin camara lenta.
  const M3 = P.makeMaestro(P.paraGuardar(M));
  const e3 = P.empieza(M3, O.PISOTON);
  ok(e3 && !e3.lento, 'en la pelea siguiente, el consejo del pisoton (ya soltado) sale sin camara lenta');
  // Lo guardado se recupera tal cual.
  const M2 = P.makeMaestro(JSON.parse(JSON.stringify(P.paraGuardar(M))));
  ok(JSON.stringify(P.permitidos(M2)) === JSON.stringify(P.permitidos(M)), 'lo aprendido se guarda y se recupera');
  // Aprenderlo todo: el ogro vuelve a tener todos sus ataques.
  for (const [atk, que] of [[O.PISOTON, 'salta'], [O.BARRIDO, 'esquiva'], [O.EMBESTIDA, 'esquiva']]) {
    P.empieza(M, atk); P.anota(M, que); P.acaba(M);
  }
  ok(P.permitidos(M) === null && P.lecciona(M) === null, 'aprendidas las cuatro, el ogro usa todo y ya no hay consejos');
  // Y el ogro de verdad respeta la lista.
  const rnd = (() => { let x = 7; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; })();
  const og = O.makeOgro(600, P.opcionesOgro('normal', [O.GARROTE]));
  const K = C.makeCaballero(300);
  const vistos = new Set();
  for (let n = 0; n < 60 * 60; n++) {
    K.x = 300 + Math.sin(n / 220) * 420;
    O.stepOgro(og, K, DT, rnd);
    if (og.st === O.ATACA) vistos.add(og.atk);
  }
  ok(vistos.size === 1 && vistos.has(O.GARROTE), 'con solo el garrotazo permitido, en un minuto el ogro no usa otro');
}

console.log('== 4) LAS MEDALLAS Y EL ARMARIO ==');
{
  const A = await import(G('games/romi-atlas.js'));
  // Una pelea de base que NO gana ninguna medalla, y lo que cambia cada una.
  const base = { gano: false, t: 200, vida: 1, vidaMax: 4, paradas: 0, contras: 0, dano: 5, ogroHp: 24,
                 paredes: 0, usoGuardia: true, dif: 'normal', nota: null, alumna: false };
  ok(P.medallasDe(base).length === 0, 'una pelea perdida y sin nada especial no gana medallas');
  const casos = {
    victoria: { gano: true, nota: 'C' }, alumna: { alumna: true },
    intacta: { gano: true, vida: 4, nota: 'C' }, paradas: { paradas: 5 }, contras: { contras: 3 },
    pared: { paredes: 2 }, singuardia: { gano: true, usoGuardia: false, nota: 'C' },
    relampago: { gano: true, t: 50, nota: 'C' }, furia: { gano: true, dif: 'furia', nota: 'C' },
    notaS: { gano: true, nota: 'S' },
  };
  for (const med of P.MEDALLAS) {
    const got = P.medallasDe({ ...base, ...casos[med.id] });
    ok(got.includes(med.id), med.nombre + ' se gana con: ' + med.pide);
  }
  ok(!P.medallasDe({ ...base, paradas: 4 }).includes('paradas') && !P.medallasDe({ ...base, gano: true, t: 61 }).includes('relampago'),
     'y no se regalan (4 paradas no son 5; 61 s no es menos de un minuto)');
  // Cada prenda que no es la de siempre se gana con UNA medalla, y cada
  // medalla da UNA prenda que existe: el armario es la lista de medallas.
  let sinMedalla = [], premios = new Set();
  for (const parte of P.PARTES) {
    P.ARMARIO[parte].forEach((pr, i) => {
      const m = P.medallaDe(parte, pr.id);
      if (i === 0 ? m : !m) sinMedalla.push(parte + ' ' + pr.id);
    });
  }
  for (const m of P.MEDALLAS) premios.add(m.premio.join('/'));
  ok(sinMedalla.length === 0, 'las prendas de siempre son gratis y cada otra tiene su medalla' + (sinMedalla.length ? ' -> ' + sinMedalla : ''));
  ok(premios.size === P.MEDALLAS.length && P.MEDALLAS.every(m => P.ARMARIO[m.premio[0]].some(p => p.id === m.premio[1])),
     'cada medalla da una prenda distinta, y existe');
  // Los tonos encajan con los colores que tiñen en la hoja.
  let malos = [];
  const hex = /^#[0-9a-f]{6}$/i;
  for (const parte of P.PARTES) {
    for (const pr of P.ARMARIO[parte]) {
      const t = P.tintesDe({ ...P.TRAJE0, [parte]: pr.id });
      for (const k of ['capa', 'falda', 'ribete', 'estela']) {
        if (t[k].length !== A.TINTES[k].length || !t[k].every(c => hex.test(c))) malos.push(parte + ' ' + pr.id + ' ' + k);
      }
    }
  }
  ok(malos.length === 0, 'cada prenda trae tantos tonos como colores tiñe la hoja (capa 3, falda 5, ribete 2, estela 3)' + (malos.length ? ' -> ' + malos : ''));
  // Un traje guardado con algo que no se ha ganado, o que ya no existe, vuelve a lo de siempre.
  const t1 = P.trajeValido({ capa: 'dorada', falda: 'azul', estela: 'nada' }, ['paradas']);
  ok(t1.capa === 'azul' && t1.falda === 'azul' && t1.estela === 'blanca', 'un traje guardado solo conserva lo ganado');
  ok(JSON.stringify(P.trajeValido(null, [])) === JSON.stringify(P.TRAJE0), 'sin traje guardado, el de siempre');
}

console.log('== 5) LAS CANCIONES NO LLEVAN NOTAS QUE NO SUENAN ==');
{
  // El secuenciador ignora en silencio lo que no conoce: una nota mal escrita
  // es un hueco en la musica que nadie ve en el codigo.
  //
  // Y las pistas de una cancion tienen que volver a cuadrar: la mas larga ha de
  // ser un multiplo exacto de las otras. (No "de 16": la nana del AHORCADO va
  // en 3/4, con compases de 12, y la primera version de esta prueba la daba
  // por mala.)
  const NOTAS = 'CDEFGABcdefgabxyz';
  let malas = [];
  for (const [k, s] of Object.entries(AU.SONGS)) {
    const largo = Math.max(...s.tracks.map(t => t.pattern.length));
    for (const t of s.tracks) {
      for (const c of t.pattern) {
        if (c === '.') continue;
        if (t.wave === 'noise' ? !'Hh'.includes(c) : !NOTAS.includes(c)) malas.push(k + ':' + c);
      }
      if (largo % t.pattern.length) malas.push(k + ': una pista de ' + t.pattern.length + ' no cuadra con ' + largo);
    }
  }
  ok(malas.length === 0, Object.keys(AU.SONGS).length + ' canciones, todas con notas validas y pistas que cuadran' + (malas.length ? ' -> ' + malas.join(', ') : ''));
  for (const k of ['caballero', 'caballeroPelea', 'caballeroFuria', 'caballeroVictoria', 'caballeroDerrota']) ok(!!AU.SONGS[k], 'existe ' + k);
}

console.log('');
console.log(fallos === 0 ? 'TODO OK' : fallos + ' FALLOS');
process.exit(fallos ? 1 : 0);
