// El AVISO DE ACTUALIZACION de punta a punta, con toques de verdad, y una foto
// de cada paso para mirarlo.
//
//   node tools/prueba-aviso.mjs [carpeta-de-fotos]     (por defecto vistas/aviso)
//
// Monta el telefono como tools/prueba-reinicio.mjs: el APK en :8090 con las
// cabeceras de Capacitor y la version nueva en :8091, como GitHub, con dos
// novedades en su manifiesto. Y hace lo que haria ella:
//   1  abre la app: a los pocos segundos sale SOLO el cartel ¡NUEVA VERSION!
//   2  toca LUEGO: el cartel se va y el rotulo de abajo se queda avisando
//   3  toca el rotulo: vuelve el cartel
//   4  toca ACTUALIZAR: BAJANDO, con su barra (el servidor va lento a proposito)
//   5  sale ¡LISTA! y toca REINICIAR: fundido a negro, y la app arranca otra vez
//   6  corre la version nueva y lo celebra: ¡ACTUALIZADA A LA 9.9.2!
// Y el caso malo, en otra pasada: falta un fichero en el servidor -> NO SE PUDO,
// con REINTENTAR; CERRAR lo quita y el rotulo vuelve a su sitio.
//
// Los toques van por el mismo camino que un dedo (ver-app.js, tocaen:), al
// sitio donde el cartel dibujo cada boton: si el area de toque y el dibujo no
// coincidieran, esto fallaria.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = 'C:/tmp/rqa';         // ruta CORTA: con una larga, la CacheStorage de Chrome falla
const FOTOS = path.resolve(process.argv[2] || path.join(RAIZ, 'vistas', 'aviso'));
const V_VIEJA = '9.9.1', V_NUEVA = '9.9.2';
const NOTAS = ['Un aviso más bonito', 'Botón para reiniciar sin salir'];
fs.mkdirSync(FOTOS, { recursive: true });

// ---------- Las copias: la del APK y la que se baja ----------
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
function copia(dst, version, origen) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(path.join(RAIZ, 'www'), dst, { recursive: true });
  const upd = path.join(dst, 'js/update.js');
  let src = fs.readFileSync(upd, 'utf8')
    .replace(/export const VERSION_APK = '[^']+';/, `export const VERSION_APK = '${version}';`);
  if (origen) src = src.replace(/const ORIGEN = '[^']+';/, `const ORIGEN = '${origen}';`);
  fs.writeFileSync(upd, src);
}
copia(TMP + '/vieja', V_VIEJA, 'http://localhost:8091');
copia(TMP + '/nueva', V_NUEVA, null);
const archivos = ficheros(TMP + '/nueva').filter(r => r !== 'sw.js' && r !== 'version.json').sort();
fs.writeFileSync(TMP + '/nueva/version.json', JSON.stringify({ version: V_NUEVA, archivos, notas: NOTAS }, null, 2));

// ---------- Los servidores ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.png': 'image/png', '.json': 'application/json' };
let falta = null;                 // en la pasada mala, un fichero que "no esta" en la DESCARGA
function sirve(raiz, puerto, cabeceras, lento) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const responde = () => fs.readFile(path.join(raiz, p), (e, d) => {
      const h = { ...cabeceras };
      // Solo le falta al servidor de la descarga (el lento): si le faltara al
      // del APK, la app no llegaria ni a arrancar.
      if (e || (lento && p === falta)) { res.writeHead(404, h); return res.end('404'); }
      h['Content-Type'] = TIPOS[path.extname(p)] || 'application/octet-stream';
      res.writeHead(200, h); res.end(d);
    });
    // La nueva va lenta (70 ms por fichero, unos 5 s en total), como el
    // telefono con datos: si no, BAJANDO dura un parpadeo y no se puede mirar.
    if (lento && !p.endsWith('version.json')) setTimeout(responde, 70); else responde();
  }).listen(puerto);
}
const servidores = [
  sirve(TMP + '/vieja', 8090, { 'Cache-Control': 'no-cache' }, false),
  sirve(TMP + '/nueva', 8091, { 'Cache-Control': 'max-age=600', 'Access-Control-Allow-Origin': '*' }, true),
];

// ---------- Los guiones de la pagina ----------
// Asas a los modulos (la MISMA instancia que usa el menu) y donde cae cada
// boton en la pantalla: el lienzo del menu mide 600x270 virtuales.
fs.writeFileSync(TMP + '/asas.js', `(async () => {
  window.__av = await import('/js/aviso-update.js');
  window.__up = await import('/js/update.js');
  window.__boton = id => {
    const b = window.__av.Aviso._botones.find(b => b.id === id);
    if (!b) return null;
    const r = document.getElementById('c').getBoundingClientRect();
    return [r.left + (b.x + b.w / 2) * r.width / 600, r.top + (b.y + b.h / 2) * r.height / 270];
  };
  window.__rotulo = () => {
    const r = document.getElementById('c').getBoundingClientRect();
    return [r.left + 30 * r.width / 600, r.top + (270 - 12) * r.height / 270];
  };
  return 'asas puestas';
})()`);
fs.writeFileSync(TMP + '/estado.js', `(() => ({ estado: window.__up.Update.estado, abierto: window.__av.Aviso.abierto,
  botones: window.__av.Aviso._botones.map(b => b.id), notas: window.__up.Update.notas,
  version: window.__up.versionActual(), apk: window.__up.VERSION_APK,
  recien: window.__up.recienEstrenada, progreso: Math.round(window.__up.Update.progreso * 100) }))()`);

function correr(pasos, perfil, foto) {
  fs.rmSync(perfil, { recursive: true, force: true });
  return new Promise(res => {
    const p = spawn(process.execPath, [path.join(RAIZ, 'tools/ver-app.js'), foto, pasos.join(';'), 'http://localhost:8090/'],
                    { env: { ...process.env, PERFIL: perfil } });
    let out = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', () => res(out));
  });
}
const E = 'archivo:' + TMP + '/estado.js', ASAS = 'archivo:' + TMP + '/asas.js';

// ---------- Pasada buena ----------
const buena = await correr([
  'hasta20000:window.__arcade', ASAS,
  'hasta15000:window.__av.Aviso.abierto', 'espera600', E, 'disparo',              // 1 sale solo
  "tocaen:window.__boton('luego')", 'espera400', E, 'disparo',                     // 2 LUEGO
  'tocaen:window.__rotulo()', 'espera600', E,                                      // 3 el rotulo lo reabre
  "tocaen:window.__boton('actualizar')", 'espera1800', E, 'disparo',               // 4 bajando
  "hasta20000:window.__up.Update.estado === 'lista'", 'espera600', E, 'disparo',  // 5 lista
  "tocaen:window.__boton('reiniciar')", 'espera250', 'disparo',                    //   el fundido
  'espera1500', 'hasta20000:window.__arcade', ASAS, 'espera900', E, 'disparo',    // 6 celebra
], TMP + '/perfil', path.join(FOTOS, 'aviso.png'));

// ---------- Pasada mala: falta un fichero ----------
falta = '/js/games/furia.js';
const mala = await correr([
  'hasta20000:window.__arcade', ASAS,
  'hasta15000:window.__av.Aviso.abierto', 'espera400',
  "tocaen:window.__boton('actualizar')",
  "hasta20000:window.__up.Update.estado === 'error'", 'espera600', E, 'disparo',  // NO SE PUDO
  "tocaen:window.__boton('cerrar')", 'espera400', E,                               // CERRAR
], TMP + '/perfil2', path.join(FOTOS, 'aviso-error.png'));
servidores.forEach(s => s.close());

// ---------- El veredicto ----------
const lee = salida => salida.split('\n').filter(s => s.includes('estado.js -> '))
  .map(l => JSON.parse(l.slice(l.indexOf(' -> ') + 4)));
for (const s of (buena + mala).split('\n')) if (/fallo|ERROR|agoto/.test(s) && !/favicon|404/.test(s)) console.log('  ' + s.trim());
const B = lee(buena), M = lee(mala);
let fallos = 0;
const ok = (c, m, e) => { console.log((c ? '   ok  ' : '   MAL ') + m + (c || !e ? '' : '  -> ' + JSON.stringify(e))); if (!c) fallos++; };
const [s1, s2, s3, s4, s5, s6] = B;
console.log('== la pasada buena ==');
ok(s1 && s1.abierto && s1.estado === 'hay' && s1.botones.join() === 'luego,actualizar',
   '1 al abrir la app sale solo ¡NUEVA VERSION!, con LUEGO y ACTUALIZAR', s1);
ok(s1 && s1.notas.join('|') === 'UN AVISO MAS BONITO|BOTON PARA REINICIAR SIN SALIR',
   '  con las novedades del manifiesto, en mayusculas y sin tildes', s1 && s1.notas);
ok(s2 && !s2.abierto && s2.estado === 'hay', '2 LUEGO lo cierra y la version sigue esperando en el rotulo', s2);
ok(s3 && s3.abierto && s3.estado === 'hay', '3 tocar el rotulo vuelve a abrir el cartel', s3);
ok(s4 && s4.abierto && s4.estado === 'bajando' && s4.progreso > 0 && s4.progreso < 100,
   `4 ACTUALIZAR la baja con su barra (${s4 ? s4.progreso : '?'}% en la foto)`, s4);
ok(s5 && s5.abierto && s5.estado === 'lista' && s5.botones.join() === 'luego,reiniciar',
   '5 al acabar sale ¡LISTA!, con LUEGO y REINICIAR', s5);
ok(s6 && s6.version === V_NUEVA && s6.apk === V_NUEVA, '6 REINICIAR arranca la app con la version nueva', s6);
ok(s6 && s6.recien === V_NUEVA, '  y la celebra: ¡ACTUALIZADA A LA ' + V_NUEVA + '!', s6);
console.log('== la pasada mala (falta un fichero) ==');
ok(M[0] && M[0].abierto && M[0].estado === 'error' && M[0].botones.join() === 'cerrar,reintentar',
   'NO SE PUDO, con CERRAR y REINTENTAR', M[0]);
ok(M[1] && !M[1].abierto && M[1].estado === 'reposo' && M[1].version === V_VIEJA,
   'CERRAR lo quita, el rotulo vuelve a su sitio y sigue la version de antes', M[1]);
console.log('\nfotos en ' + FOTOS);
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
