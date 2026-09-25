// ACTUALIZACIONES desde dentro de la app.
//
// POR QUE EXISTE. Cada cambio obligaba a pasar el APK al telefono y
// reinstalarlo a mano. Esto lo evita: el juego entero son 54 ficheros de texto
// (1.1 MB, sin imagenes ni audio porque todo se dibuja y se sintetiza por
// codigo), asi que bajarse una version nueva cuesta lo mismo que cargar una
// pagina.
//
// COMO. Un Service Worker se pone delante de las peticiones de los .js: si hay
// una version descargada la sirve desde la cache, y si no deja pasar la del
// APK. No toca NADA nativo -- es todo JavaScript -- asi que no puede romper la
// compilacion. Funciona porque Capacitor sirve la app por https://localhost,
// que cuenta como origen seguro.
//
// LAS CINCO REGLAS QUE LO HACEN SEGURO. Esto va al telefono de ella, asi que
// un fallo no puede dejarla sin juego:
//
//   1. La version que funciona NO se toca hasta que la nueva este entera.
//      Se descarga a una cache aparte y solo al final se cambia el puntero.
//   2. Si falla UN solo fichero, se tira la descarga entera y no pasa nada.
//   3. La version nueva se estrena en el SIGUIENTE arranque, nunca a mitad de
//      partida.
//   4. Si la version nueva casca al arrancar, se vuelve sola a la anterior.
//   5. Sin internet todo sigue igual. El APK siempre lleva una copia completa.

// De donde se bajan las actualizaciones. GitHub Pages sobre el repo publico.
const ORIGEN = 'https://efranorqm.github.io/romina-arcade';

// Cuanto se espera a la red antes de rendirse. En un movil con mala cobertura,
// quedarse colgado es peor que no actualizar.
const TIMEOUT = 12000;

// --- Estado, guardado en localStorage ---
// version:  la que se esta usando ahora
// pendiente: una descargada y lista, que se estrenara al reiniciar
// sospechosa: una que acaba de estrenarse y todavia no ha demostrado que va
const LS = {
  get ver()  { try { return localStorage.getItem('rom.ver') || null; } catch { return null; } },
  set ver(v) { try { localStorage.setItem('rom.ver', v); } catch {} },
  get pend()  { try { return localStorage.getItem('rom.pend') || null; } catch { return null; } },
  set pend(v) { try { v ? localStorage.setItem('rom.pend', v) : localStorage.removeItem('rom.pend'); } catch {} },
  get sosp()  { try { return localStorage.getItem('rom.sosp') || null; } catch { return null; } },
  set sosp(v) { try { v ? localStorage.setItem('rom.sosp', v) : localStorage.removeItem('rom.sosp'); } catch {} },
};

// La version que trae el APK de fabrica. La reescribe tools/publica.mjs en
// cada publicacion, para que el numero que se ve en el menu sea el de verdad.
export const VERSION_APK = '1.0.29';

// Que version se esta usando ahora mismo.
export function versionActual() {
  return LS.ver || VERSION_APK;
}

// --- Estado visible para el menu ---
export const Update = {
  // reposo | buscando | hay | bajando | lista | reiniciando | aldia | error
  //   hay:          se encontro una version nueva y AUN NO se ha bajado (la
  //                 comprobacion de cada arranque; ella decide si la baja)
  //   reiniciando:  ella toco REINICIAR y la pagina esta a punto de recargar
  estado: 'reposo',
  msg: '',
  progreso: 0,        // 0..1 mientras baja
  disponible: null,   // version encontrada, si hay uno
  notas: [],          // las novedades de esa version, si el manifiesto las trae
};

// La version que se ESTRENA en este arranque, o null. index.html la deja
// marcada como sospechosa (rom.sosp) hasta que demuestre que va, asi que en
// el primer arranque de una version nueva las dos marcas coinciden. Se lee al
// cargar el modulo, antes de que latido() la confirme y borre la marca: el
// menu lo usa para decirle a ella que ya la tiene.
export const recienEstrenada = (() => {
  try {
    const s = localStorage.getItem('rom.sosp');
    return s && s === localStorage.getItem('rom.ver') ? s : null;
  } catch { return null; }
})();

// ---------- Arranque ----------
// Se llama UNA vez al cargar la app, antes de nada.
export async function iniciaUpdate() {
  // OJO: registrar el worker y estrenar la version pendiente YA LO HA HECHO
  // index.html, antes de cargar ningun modulo. Tiene que ser asi: un
  // <script type="module"> pide todos sus imports en cuanto se parsea, asi que
  // para cuando esta funcion corre, games.js y los diez juegos ya se han
  // pedido. Hacerlo aqui llegaba tarde -- la actualizacion se descargaba,
  // decia "AL DIA", y seguia ejecutando el codigo viejo.
  //
  // Aqui solo quedaria CONFIRMAR que la version estrenada funciona, y eso ya
  // no lo hace un reloj: lo hace latido(), abajo.
  // Y rehacer como propia la cache en uso, si la bajo el actualizador viejo.
  reparaCache(LS.ver).catch(() => {});
}

// ---------- La confirmacion: el juego tiene que DEMOSTRAR que va ----------
// Cada fotograma que main.js pinta ENTERO (sin excepcion en update ni en
// draw) es un latido. A los LATIDOS_OK, la version estrenada queda confirmada.
//
// ANTES ERA UN RELOJ DE 20 s, y fallaba al reves: si ella cerraba la app antes
// de los 20 s, o Android la dormia en segundo plano (los temporizadores se
// paran y luego mata el proceso), el siguiente arranque la daba por rota y
// volvia a la version del APK -- la v1.0.8, con el ROMINA de pruebas, sin
// ogro ni aventura. Le paso el 23-09-2026 con la v1.0.18: "solo me aparece el
// mapa". Una version rota de verdad no llega a pintar dos segundos: se queda
// en negro, o el bucle revienta en cada fotograma y no suma latidos.
const LATIDOS_OK = 120;          // 2 s de juego en primer plano
let latidos = 0;
export function latido() {
  if (latidos < 0) return;
  if (++latidos < LATIDOS_OK) return;
  latidos = -1;
  if (LS.sosp) {
    console.log('[update] la version', LS.sosp, 'va bien: confirmada');
    LS.sosp = null;
  }
}

function manda(msg) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
  }
}

// ---------- Buscar y descargar ----------
// Lo llama el boton del menu. Nunca lanza: los errores se cuentan en
// Update.estado, porque esto corre en el movil de ella.
export async function buscaActualizacion() {
  if (Update.estado === 'buscando' || Update.estado === 'bajando' ||
      Update.estado === 'reiniciando') return;
  Update.estado = 'buscando'; Update.msg = 'BUSCANDO...'; Update.progreso = 0;

  try {
    // 1. El manifiesto: que version hay y que ficheros la componen.
    const man = await pideJSON(ORIGEN + '/version.json?t=' + Date.now());
    // Se distingue "no llego nada" de "llego algo que no vale": con un solo
    // mensaje, quedarse sin cobertura decia RESPUESTA RARA y desconcertaba.
    if (man === null) {
      return fallo(navigator.onLine === false ? 'SIN INTERNET' : 'NO SE PUDO CONECTAR');
    }
    if (!man.version || !Array.isArray(man.archivos)) {
      return fallo('RESPUESTA RARA');
    }
    Update.disponible = man.version;
    Update.notas = notasDe(man);

    if (!esMasNueva(man.version, versionActual())) {
      Update.estado = 'aldia'; Update.msg = 'YA ESTAS AL DIA';
      return;
    }

    // 2. Descargar TODO a una cache nueva. La actual no se toca (REGLA 1).
    Update.estado = 'bajando'; Update.msg = 'BAJANDO ' + man.version;
    const nombre = 'rom-' + man.version;
    const cache = await caches.open(nombre);
    let hechos = 0;

    for (const rel of man.archivos) {
      const url = ORIGEN + '/' + rel + '?v=' + man.version;
      const res = await conTimeout(fetch(url, { cache: 'no-store' }));
      if (!res || !res.ok) {
        // REGLA 2: si falla uno, se tira todo y no pasa nada.
        await caches.delete(nombre);
        return fallo('FALLO AL BAJAR');
      }
      // Se guarda con la ruta LOCAL, que es la que pedira el juego, y COMO
      // PROPIA (ver propia(), abajo)
      await cache.put(new Request('/' + rel), await propia(res));
      hechos++;
      Update.progreso = hechos / man.archivos.length;
    }

    // 3. Comprobar que esta entera antes de darla por buena.
    const claves = await cache.keys();
    if (claves.length < man.archivos.length) {
      await caches.delete(nombre);
      return fallo('LLEGO INCOMPLETA');
    }

    // 4. Queda lista para el PROXIMO arranque (REGLA 3).
    LS.pend = man.version;
    Update.estado = 'lista';
    Update.msg = 'LISTA: REINICIA LA APP';
    limpiaViejas(man.version);
  } catch (e) {
    console.warn('[update]', e);
    fallo(navigator.onLine === false ? 'SIN INTERNET' : 'NO SE PUDO');
  }
}

function fallo(msg) {
  Update.estado = 'error'; Update.msg = msg; Update.progreso = 0;
}

// ---------- La comprobacion de cada arranque ----------
// Solo MIRA si hay una version nueva: no baja nada. Si la hay, el menu le
// ensena el aviso y ella decide. Es muda a proposito: sin internet, con el
// servidor caido o con una respuesta rara no pasa NADA -- no la avisamos de
// un fallo que ella no ha pedido. Una por arranque, y son ~2 KB.
let comprobada = false;
export async function compruebaActualizacion() {
  if (comprobada) return;
  comprobada = true;
  if (Update.estado !== 'reposo') return;          // ya esta en ello por su cuenta
  try {
    const man = await pideJSON(ORIGEN + '/version.json?t=' + Date.now());
    if (!man || !man.version || !Array.isArray(man.archivos)) return;
    if (Update.estado !== 'reposo') return;        // mientras tanto toco la version
    if (!esMasNueva(man.version, versionActual())) return;
    Update.disponible = man.version;
    Update.notas = notasDe(man);
    Update.estado = 'hay';
  } catch { /* muda: ver arriba */ }
}

// Las novedades del manifiesto (tools/publica.mjs --nota "..."), listas para
// la fuente del juego, que solo tiene MAYUSCULAS sin tildes (y la Ñ, el ¡):
// se pasan a mayusculas, se quitan las tildes sin tocar la Ñ, y lo que la
// fuente no sabe dibujar se cambia por un espacio. Como mucho tres.
const DIBUJABLE = /[A-ZÑ0-9 .,!¡?:;\-+=/*%()<>"#_]/;
function notasDe(man) {
  if (!Array.isArray(man.notas)) return [];
  return man.notas.filter(n => typeof n === 'string' && n.trim()).slice(0, 3).map(n =>
    n.toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/\u0001/g, 'Ñ').split('').map(c => DIBUJABLE.test(c) ? c : ' ').join('')
     .replace(/\s+/g, ' ').trim());
}

// ---------- REINICIAR sin salir de la app ----------
// Recarga la pagina: index.html estrena la version pendiente al arrancar,
// igual que al abrir la app de cero, y los modulos se piden otra vez.
//
// RECARGAR NO ES CERRAR LA APP: el navegador puede reusar de memoria el
// codigo de la carga anterior y seguir ejecutando el viejo, o una mezcla de
// dos versiones. Aqui NO pasa, y esta MEDIDO con tools/prueba-reinicio.mjs
// (todos los modulos de la nueva y ninguno de otra, del APK a una bajada y de
// una bajada a otra). Pero depende de dos cosas, y si cambia alguna vuelve el
// problema (lo demuestran los --control de esa prueba):
//   - Capacitor sirve los ficheros del APK con "Cache-Control: no-cache"
//     (WebViewLocalServer.java), asi que no se reusan sin preguntar.
//   - propia() guarda lo bajado SIN cabeceras de cache.
export function reiniciaApp() {
  if (Update.estado === 'reiniciando') return;
  Update.estado = 'reiniciando';
  // Un instante para que se vea REINICIANDO y el fundido: recargar en seco
  // parece que la app se ha colgado.
  setTimeout(() => location.reload(), 450);
}

// ---------- Lo descargado se guarda como PROPIO ----------
// Guardada tal cual, la respuesta de GitHub conservaba su direccion
// (github.io/...), y al servirla el worker el navegador la tomaba por suya: los
// modulos calculaban sus imports y sus dibujos desde GitHub (medido: 70 de 71
// ficheros se pedian directamente alli, saltandose la cache: sin internet no
// arrancaba), y los dibujos eran "de otro sitio" (el traje de Romina no se
// podia pintar). Una respuesta hecha aqui no tiene direccion: el worker la
// sirve como del propio telefono. Se conserva el Content-Type: un modulo sin
// el suyo no se ejecuta.
//
// Y NADA MAS, a proposito: sin cabeceras de cache, el navegador no puede
// reusar de memoria estos ficheros al recargar. Es lo que hace que REINICIAR
// (reiniciaApp) estrene de verdad la version nueva. Si aqui se guardara el
// "max-age=600" de GitHub, tools/prueba-reinicio.mjs --control=cache muestra
// lo que pasaria: se seguiria ejecutando la version anterior.
async function propia(res) {
  const tipo = res.headers.get('Content-Type');
  return new Response(await res.blob(), { status: 200, headers: tipo ? { 'Content-Type': tipo } : {} });
}

// Las caches bajadas ANTES de este arreglo (por el actualizador viejo) tienen
// las respuestas con la direccion de GitHub: se rehacen como propias, en
// segundo plano. Sirven desde el siguiente arranque.
async function reparaCache(v) {
  if (!v || typeof caches === 'undefined') return;
  const nombre = 'rom-' + v;
  if (!(await caches.has(nombre))) return;
  const c = await caches.open(nombre);
  let n = 0;
  for (const req of await c.keys()) {
    const r = await c.match(req);
    if (!r || !r.url || new URL(r.url).origin === location.origin) continue;
    await c.put(req, await propia(r));
    n++;
  }
  if (n) console.log('[update] cache', nombre, 'rehecha como propia:', n, 'ficheros');
}

// Compara "1.2.3" con "1.10.0" numericamente (no como texto, que diria que
// "1.9" > "1.10").
export function esMasNueva(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function pideJSON(url) {
  const res = await conTimeout(fetch(url, { cache: 'no-store' }));
  if (!res || !res.ok) return null;
  // Si el cuerpo no es JSON valido (una pagina de error del proveedor, por
  // ejemplo), tambien cuenta como "no llego nada".
  try { return await res.json(); } catch { return null; }
}

// fetch con tope de tiempo: en cobertura mala, colgarse es peor que fallar.
function conTimeout(prom) {
  return Promise.race([
    prom.catch(() => null),
    new Promise(r => setTimeout(() => r(null), TIMEOUT)),
  ]);
}

async function borraCache(version) {
  try { await caches.delete('rom-' + version); } catch {}
}

// Deja solo la que se usa y la que se acaba de bajar: sin esto, cada
// actualizacion dejaria 1 MB muerto en el telefono para siempre.
async function limpiaViejas(salvar) {
  try {
    const usada = versionActual();
    for (const n of await caches.keys()) {
      if (!n.startsWith('rom-')) continue;
      const v = n.slice(4);
      if (v !== salvar && v !== usada) await caches.delete(n);
    }
  } catch {}
}
