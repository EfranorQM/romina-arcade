// AHORCADO: la lista de palabras y las canciones, validadas en Node.
//
//   node tools/prueba-palabras.mjs
//
// 1. Cada palabra de www/js/games/ahorc-palabras.js cumple lo que el juego
//    da por hecho: solo [A-ZÑ ], 4..14 caracteres, un espacio como mucho, sin
//    repetidas entre categorias, y cada categoria con al menos 12. Y la
//    eleccion respeta sus reglas: nunca dos seguidas de la misma categoria ni
//    una palabra repetida en la partida.
// 2. Dos bots juegan la lista entera por tercio de dificultad:
//      FRECUENCIA (piloto tonto): prueba E A O S R N I D L C T U M P B G V Y Q
//      H F Z J Ñ X K W en ese orden, sin usar la pista. Es la cota INFERIOR.
//      LISTO: conoce la categoria y la lista y elige la letra que mas
//      candidatas cubre. Cota SUPERIOR (Romina no conoce la lista).
//    La lectura que dieron: sin pista, 6 fallos son brutales (el tonto gana
//    menos del 20%); la categoria es lo que hace jugable el juego, y por eso se
//    enseña siempre.
// 3. Un modelo de la racha con tres perfiles de fallos por palabra, para
//    elegir cuantos globos se recuperan por palabra ganada (+3 con tope 6).
// 4. Las dos canciones de AHORCADO contra la tabla de notas del secuenciador:
//    una nota fuera de la tabla no suena ni avisa (audio.js).
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const P = await import(pathToFileURL(path.join(here, '..', 'www', 'js', 'games', 'ahorc-palabras.js')).href);

let fallos = 0;
const ok = (c, m) => { console.log((c ? '   ok  ' : '   MAL ') + m); if (!c) fallos++; };

// ---------- 1) La lista ----------
console.log('== 1) LA LISTA ==');
{
  const vistas = new Map(); const malas = [], dup = [];
  for (const x of P.LISTA) {
    if (!/^[A-ZÑ]+( [A-ZÑ]+)?$/.test(x.w) || x.w.length < 4 || x.w.length > 14) malas.push(x.w);
    if (vistas.has(x.w)) dup.push(x.w + ' (' + vistas.get(x.w) + '/' + x.cat + ')'); else vistas.set(x.w, x.cat);
  }
  const porCat = {}; for (const x of P.LISTA) porCat[x.cat] = (porCat[x.cat] || 0) + 1;
  console.log(P.LISTA.length + ' palabras en ' + Object.keys(porCat).length + ' categorias: ' + Object.entries(porCat).map(([c, n]) => c + ' ' + n).join(', '));
  ok(malas.length === 0, 'todas con el formato del juego' + (malas.length ? ': ' + malas.join(' ') : ''));
  ok(dup.length === 0, 'sin repetidas' + (dup.length ? ': ' + dup.join(' ') : ''));
  ok(Object.values(porCat).every(n => n >= 12), 'cada categoria con al menos 12');
  const conEnye = P.LISTA.filter(x => x.w.includes('Ñ')).length;
  ok(conEnye >= 10, 'al menos 10 con Ñ (hay ' + conEnye + ')');
  ok(P.NUESTRAS.length >= 1 && P.NUESTRAS.every(x => x.w.length <= 14 && x.pista.length > 0 && x.pista.length <= 108), 'NOSOTROS: ' + P.NUESTRAS.length + ' palabras, cada una con pista de hasta tres lineas');
  // Las nuestras NO salen en SOLA: 2000 elecciones sin una sola.
  { let seed3 = 5; const r3 = () => { seed3 ^= seed3 << 13; seed3 >>>= 0; seed3 ^= seed3 >>> 17; seed3 ^= seed3 << 5; seed3 >>>= 0; return seed3 / 4294967296; };
    let coladas = 0; const nuestras = new Set(P.NUESTRAS.map(x => x.w));
    for (let n = 1; n <= 2000; n++) { const e = P.elegir(r3, (n % 12) + 1, null); if (nuestras.has(e.w) || e.cat === 'NOSOTROS') coladas++; }
    ok(coladas === 0, 'ninguna de NOSOTROS se cuela en SOLA'); }
  let seed = 99; const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  let seguidas = 0, repetidas = 0;
  for (let p = 0; p < 200; p++) {
    let cat = null; const vistasP = new Set();
    for (let n = 1; n <= 10; n++) { const e = P.elegir(rnd, n, cat); if (e.cat === cat) seguidas++; if (vistasP.has(e.w)) repetidas++; vistasP.add(e.w); cat = e.cat; }
  }
  ok(seguidas === 0, 'nunca dos seguidas de la misma categoria');
  ok(repetidas === 0, 'nunca una palabra repetida en la partida');
}

// ---------- 2) Los bots ----------
console.log('== 2) LOS BOTS ==');
const FREQ = 'EAOSRNIDLCTUMPBGVYQHFZJÑXKW';
function play(word, maxFail = 6) {
  const set = new Set(word.replace(/ /g, ''));
  let f = 0, hits = 0;
  for (const L of FREQ) { if (set.has(L)) { hits++; if (hits === set.size) return f; } else { f++; if (f >= maxFail) return f; } }
  return f;
}
const porCat = {}; for (const x of P.LISTA) (porCat[x.cat] = porCat[x.cat] || []).push(x.w);
function playSmart(word, cat, maxFail = 6) {
  const n = word.length;
  let cands = porCat[cat].filter(w => w.length === n);
  const known = new Array(n).fill(null), tried = new Set();
  let f = 0; const left = new Set(word.replace(/ /g, ''));
  while (left.size && f < maxFail) {
    const count = {};
    for (const w of cands) for (const L of new Set(w)) if (L !== ' ' && !tried.has(L)) count[L] = (count[L] || 0) + 1;
    let best = null, bc = -1;
    for (const L in count) if (count[L] > bc) { bc = count[L]; best = L; }
    if (!best) { for (const L of FREQ) if (!tried.has(L)) { best = L; break; } }
    tried.add(best);
    if (word.includes(best)) { left.delete(best); for (let i = 0; i < n; i++) if (word[i] === best) known[i] = best; }
    else f++;
    cands = cands.filter(w => { for (let i = 0; i < n; i++) { if (known[i] && w[i] !== known[i]) return false; if (!known[i] && w[i] !== ' ' && tried.has(w[i])) return false; } return true; });
  }
  return f;
}
const all = P.LISTA.map(x => ({ w: x.w, cat: x.cat, t: P.tercio(x), f: play(x.w), s: playSmart(x.w, x.cat) }));
for (let t = 0; t < 3; t++) {
  const xs = all.filter(x => x.t === t);
  const win = xs.filter(x => x.f < 6).length, wins = xs.filter(x => x.s < 6).length;
  const mean = xs.reduce((a, x) => a + Math.min(x.f, 6), 0) / xs.length, means = xs.reduce((a, x) => a + x.s, 0) / xs.length;
  console.log('tercio ' + ['facil', 'medio', 'dificil'][t] + ': ' + xs.length + ' palabras | frecuencia gana ' + (100 * win / xs.length).toFixed(0) + '% (' + mean.toFixed(2) + ' fallos) | listo gana ' + (100 * wins / xs.length).toFixed(0) + '% (' + means.toFixed(2) + ' fallos)');
}
const imposibles = all.filter(x => x.s >= 6).map(x => x.w);
console.log('el bot listo pierde: ' + (imposibles.join(' ') || 'ninguna'));
ok(imposibles.length <= 5, 'como mucho 5 palabras que ni el bot listo saca');

// ---------- 3) La racha ----------
console.log('== 3) LA RACHA (globos recuperados por palabra) ==');
const DIST = {
  casual: [0.15, 0.20, 0.22, 0.18, 0.12, 0.08, 0.05],
  buena:  [0.30, 0.28, 0.20, 0.12, 0.06, 0.03, 0.01],
  torpe:  [0.06, 0.12, 0.18, 0.22, 0.18, 0.14, 0.10],
};
let seed2 = 777; const rng2 = () => { seed2 ^= seed2 << 13; seed2 >>>= 0; seed2 ^= seed2 >>> 17; seed2 ^= seed2 << 5; seed2 >>>= 0; return seed2 / 4294967296; };
function draw(d) { const r = rng2(); let acc = 0; for (let k = 0; k < d.length; k++) { acc += d[k]; if (r < acc) return k; } return 6; }
function partida(d, recup) {
  let globos = 6, n = 0, pts = 0;
  for (;;) {
    n++;
    const f = draw(d);
    if (f >= globos) return [n - 1, pts];
    globos -= f;
    const mult = n <= 2 ? 1 : n <= 5 ? 2 : 3;
    pts += (100 + 15 * 7 + 25 * globos) * mult + (f === 0 ? 100 : 0) + 5 * 7;
    globos = Math.min(6, globos + recup);
  }
}
for (const nombre in DIST) for (const recup of [3, 4]) {
  const rs = [], ps = []; for (let i = 0; i < 2000; i++) { const [n, p] = partida(DIST[nombre], recup); rs.push(n); ps.push(p); }
  rs.sort((a, b) => a - b); ps.sort((a, b) => a - b);
  console.log(nombre.padEnd(7) + ' +' + recup + ': palabras mediana ' + rs[1000] + ' (p25 ' + rs[500] + ', p75 ' + rs[1500] + ', p90 ' + rs[1800] + '); puntos mediana ' + ps[1000] + ' p90 ' + ps[1800]);
}

// ---------- 4) Las canciones ----------
console.log('== 4) LAS CANCIONES ==');
{
  const src = fs.readFileSync(path.join(here, '..', 'www', 'js', 'audio.js'), 'utf8');
  const NOTAS = 'CDEFGABcdefgabxyz';
  for (const nombre of ['ahorcado', 'ahorcadoPanico']) {
    const m = src.match(new RegExp(nombre + ':\\s*\\{\\s*bpm:\\s*(\\d+),\\s*tracks:\\s*\\[([\\s\\S]*?)\\]\\s*\\}'));
    ok(!!m, 'SONGS.' + nombre + ' existe');
    if (!m) continue;
    const pistas = [...m[2].matchAll(/wave:'(\w+)'[^}]*pattern:'([^']+)'/g)];
    for (const [, wave, pat] of pistas) {
      const malas = [...pat].filter(c => c !== '.' && (wave === 'noise' ? !'Hh'.includes(c) : !NOTAS.includes(c)));
      ok(malas.length === 0 && (pat.length % 12 === 0 || pat.length % 16 === 0), nombre + ' ' + wave + ': ' + pat.length + ' pasos, ' + (malas.length ? 'notas invalidas ' + malas.join('') : 'todas las notas existen'));
    }
  }
}

console.log(fallos ? '\n' + fallos + ' comprobaciones MAL' : '\ntodo ok');
process.exit(fallos ? 1 : 0);
