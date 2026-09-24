// Que REINICIAR desde la app estrene la version bajada, y SOLO esa.
//
//   node tools/prueba-reinicio.mjs              # la prueba
//   node tools/prueba-reinicio.mjs --control=apk    # APK "fresco": TIENE que fallar la vuelta 1
//   node tools/prueba-reinicio.mjs --control=cache  # lo bajado "fresco": TIENE que fallar la 2
//   node tools/prueba-reinicio.mjs --recarga    # reinicia con location.reload() a secas
//
// POR QUE EXISTE. Recargar la pagina no es cerrar la app: el navegador puede
// reusar de memoria lo que cargo en la sesion anterior (se vio el 23-09-2026
// con tools/emula-telefono.js). Un boton de REINICIAR que recargara y siguiera
// ejecutando el codigo viejo -- o PEOR, una mezcla de modulos de dos versiones
// -- dejaria el juego roto justo despues de actualizar. Y eso no se ve mirando
// el menu: el numero de version sale de localStorage, no del codigo.
//
// COMO LO MIDE. Tres copias de www/ en C:/tmp/rq: la "vieja" (el APK), la
// "nueva" y la "nuevisima" (las que se bajan). A cada modulo se le anade una
// linea que, AL EJECUTARSE, apunta de que copia es. Se arranca la vieja, se
// baja la nueva con el actualizador de verdad y se reinicia con la funcion del
// juego (reiniciaApp de update.js); y otra vez, de la nueva a la nuevisima,
// que es el caso de todos los dias en el telefono: de una version bajada a
// otra. Tras cada reinicio, las marcas tienen que ser todas de la que toca, y
// tantas como modulos habia antes.
//
// LAS CABECERAS SON LAS DEL TELEFONO, que es lo que decide si el navegador
// reusa de memoria: la copia vieja con "Cache-Control: no-cache", como la
// sirve Capacitor (WebViewLocalServer.java), y las bajadas con "max-age=600",
// como GitHub Pages (update.js las guarda SIN cabeceras de cache: propia()).
// Los dos controles rompen eso a proposito, cada uno en su vuelta:
// --control=apk sirve la vieja con max-age=3600, y --control=cache guarda lo
// bajado CON max-age. Si la vuelta que toca no falla, la prueba no mide nada.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = 'C:/tmp/rq';          // ruta CORTA: con una larga, la CacheStorage de Chrome falla
const CONTROL = ((process.argv.find(a => a.startsWith('--control=')) || '').split('=')[1]) || null;
if (CONTROL && CONTROL !== 'apk' && CONTROL !== 'cache') throw new Error('--control=apk o --control=cache');
const RECARGA = process.argv.includes('--recarga');
const V_VIEJA = '9.9.1', V_NUEVA = '9.9.2', V_NUEVISIMA = '9.9.3';

// ---------- 1. Las tres copias, marcadas ----------
function ficheros(dir) {
  const out = [];
  (function recorre(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) recorre(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  })(dir);
  return out;
}

function copia(dst, marca, cambia) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(path.join(RAIZ, 'www'), dst, { recursive: true });
  const modulos = ficheros(dst).filter(rel => rel.startsWith('js/') && rel.endsWith('.js'));
  for (const rel of modulos) {
    const p = path.join(dst, rel);
    let src = cambia(rel, fs.readFileSync(p, 'utf8'));
    src += `\n;(globalThis.__rq || (globalThis.__rq = {}))[new URL(import.meta.url).pathname] = '${marca}';\n`;
    fs.writeFileSync(p, src);
  }
  return modulos.length;
}

// Cada copia apunta su actualizador a la siguiente y, en --control=cache,
// guarda lo bajado con una cabecera de cache "fresca" (lo que propia() NO hace).
function actualizador(version, origen) {
  return (rel, src) => {
    if (rel !== 'js/update.js') return src;
    src = src.replace(/export const VERSION_APK = '[^']+';/, `export const VERSION_APK = '${version}';`);
    if (origen) src = src.replace(/const ORIGEN = '[^']+';/, `const ORIGEN = '${origen}';`);
    if (CONTROL === 'cache') {
      const antes = src;
      src = src.replace("headers: tipo ? { 'Content-Type': tipo } : {}",
                        "headers: { 'Content-Type': tipo, 'Cache-Control': 'max-age=3600' }");
      if (src === antes) throw new Error('--control: no se encontro la linea de propia() en update.js');
    }
    return src;
  };
}

// El manifiesto, como lo escribe tools/publica.mjs.
function manifiesto(dir, version) {
  const archivos = ficheros(dir).filter(rel => rel !== 'sw.js' && rel !== 'version.json').sort();
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, archivos }, null, 2));
  return archivos.length;
}

const nMod = copia(TMP + '/vieja', 'vieja', actualizador(V_VIEJA, 'http://localhost:8091'));
copia(TMP + '/nueva', 'nueva', actualizador(V_NUEVA, 'http://localhost:8092'));
copia(TMP + '/nuevisima', 'nuevisima', actualizador(V_NUEVISIMA, null));
const nArch = manifiesto(TMP + '/nueva', V_NUEVA);
manifiesto(TMP + '/nuevisima', V_NUEVISIMA);
console.log(`copias: ${nMod} modulos en cada una, ${nArch} ficheros en el manifiesto`);

// ---------- 2. Los servidores, con las cabeceras del telefono ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.png': 'image/png', '.json': 'application/json' };
function sirve(raiz, puerto, cabeceras) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(raiz, p), (e, d) => {
      const h = { ...cabeceras };
      if (e) { res.writeHead(404, h); return res.end('404'); }
      h['Content-Type'] = TIPOS[path.extname(p)] || 'application/octet-stream';
      res.writeHead(200, h); res.end(d);
    });
  }).listen(puerto);
}
const GITHUB = { 'Cache-Control': 'max-age=600', 'Access-Control-Allow-Origin': '*' };
const servidores = [
  sirve(TMP + '/vieja', 8090, { 'Cache-Control': CONTROL === 'apk' ? 'max-age=3600' : 'no-cache' }),
  sirve(TMP + '/nueva', 8091, GITHUB),
  sirve(TMP + '/nuevisima', 8092, GITHUB),
];

// ---------- 3. Los guiones en la pagina ----------
const marcas = `(() => { const m = globalThis.__rq || {}; const c = {};
  for (const v of Object.values(m)) c[v] = (c[v] || 0) + 1; return { cuenta: c, total: Object.keys(m).length }; })()`;
// 'antes' cuenta las marcas y baja la siguiente version.
fs.writeFileSync(TMP + '/antes.js', `(async () => {
  const antes = ${marcas};
  const U = await import('/js/update.js');
  await U.buscaActualizacion();
  for (let i = 0; i < 600 && U.Update.estado !== 'lista'; i++) await new Promise(r => setTimeout(r, 100));
  return { antes, estado: U.Update.estado, msg: U.Update.msg, pend: localStorage.getItem('rom.pend') };
})()`);
fs.writeFileSync(TMP + '/reinicia.js', RECARGA
  ? `location.reload(); 'recargando'`
  : `import('/js/update.js').then(U => { U.reiniciaApp(); return 'reiniciando'; })`);
// 'despues' cuenta lo que se ejecuto tras el reinicio.
fs.writeFileSync(TMP + '/despues.js', `(async () => {
  const U = await import('/js/update.js');
  return { despues: ${marcas}, version: U.versionActual(), apk: U.VERSION_APK,
           ver: localStorage.getItem('rom.ver'), sosp: localStorage.getItem('rom.sosp') };
})()`);

fs.rmSync(TMP + '/perfil', { recursive: true, force: true });
const vuelta = [
  'archivo:' + TMP + '/antes.js',
  'archivo:' + TMP + '/reinicia.js',
  'espera1500', 'hasta20000:window.__arcade', 'espera2500',
  'archivo:' + TMP + '/despues.js',
];
const pasos = ['hasta20000:window.__arcade', 'espera1500', ...vuelta, ...vuelta].join(';');
const salida = await new Promise(res => {
  const p = spawn(process.execPath, [path.join(RAIZ, 'tools/ver-app.js'), TMP + '/x.png', pasos, 'http://localhost:8090/'],
                  { env: { ...process.env, PERFIL: TMP + '/perfil' } });
  let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', () => res(out));
});
servidores.forEach(s => s.close());

// ---------- 4. El veredicto ----------
const lee = nombre => salida.split('\n').filter(s => s.includes(nombre + '.js -> '))
  .map(l => JSON.parse(l.slice(l.indexOf(' -> ') + 4)));
const A = lee('antes'), D = lee('despues');
for (const l of salida.split('\n')) if (/fallo|ERROR/.test(l) && !/favicon|404/.test(l)) console.log('  ' + l.trim());
let fallos = 0, vuelta_ = 0;
const fallosVuelta = [0, 0];
const ok = (c, m) => { console.log((c ? '   ok  ' : '   MAL ') + m); if (!c) { fallos++; fallosVuelta[vuelta_]++; } };
[['vieja', 'nueva', V_NUEVA, 'del APK a una version bajada'],
 ['nueva', 'nuevisima', V_NUEVISIMA, 'de una version bajada a otra']].forEach(([de, a, v, que], i) => {
  const an = A[i], ds = D[i];
  vuelta_ = i;
  console.log(`\n== ${i + 1}) ${que}: ${de} -> ${a} ==`);
  console.log('   antes:   ' + JSON.stringify(an));
  console.log('   despues: ' + JSON.stringify(ds));
  const total = an ? an.antes.total : 0;
  ok(an && total > 40 && an.antes.cuenta[de] === total, `corre la ${de}: sus ${total} modulos marcados "${de}"`);
  ok(an && an.estado === 'lista' && an.pend === v, `baja la ${v} con el actualizador de verdad`);
  const otros = ds ? Object.entries(ds.despues.cuenta).filter(([k]) => k !== a) : [];
  ok(ds && otros.length === 0, 'tras reiniciar no se ejecuta NADA de otra version' +
     (otros.length ? ' -> ' + otros.map(([k, n]) => `${n} de la ${k}`).join(', ') : ''));
  ok(ds && ds.despues.cuenta[a] === total, `se ejecutan TODOS los modulos de la ${a} (${ds ? ds.despues.cuenta[a] || 0 : 0} de ${total})`);
  ok(ds && ds.version === v && ds.apk === v, `el juego dice ${v} y el codigo es el de la ${v}`);
});
if (!CONTROL) {
  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
  process.exit(fallos ? 1 : 0);
}
// Un control es bueno si falla SU vuelta: la 1 con el APK fresco; con lo
// bajado fresco, la 1 tiene que pasar (lo viejo venia del APK) y fallar la 2.
const bueno = CONTROL === 'apk' ? fallosVuelta[0] > 0
                                : fallosVuelta[0] === 0 && fallosVuelta[1] > 0;
console.log(bueno ? `\nCONTROL OK: la prueba detecta el codigo viejo (--control=${CONTROL})`
                  : `\nCONTROL MAL: con --control=${CONTROL} tenia que fallar la vuelta ${CONTROL === 'apk' ? 1 : 2}, y solo esa`);
process.exit(bueno ? 0 : 1);
