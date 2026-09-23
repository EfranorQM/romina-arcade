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
export const VERSION_APK = '1.0.16';

// Que version se esta usando ahora mismo.
export function versionActual() {
  return LS.ver || VERSION_APK;
}

// --- Estado visible para el menu ---
export const Update = {
  estado: 'reposo',   // reposo | buscando | bajando | lista | aldia | error
  msg: '',
  progreso: 0,        // 0..1 mientras baja
  disponible: null,   // version encontrada, si hay uno
};

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
  // Aqui solo queda CONFIRMAR que la version estrenada funciona. Si el juego
  // casca antes de los 20 s, este temporizador no llega a saltar, la marca
  // 'sosp' se queda puesta y el proximo arranque la revierte sola.
  if (LS.sosp) {
    setTimeout(() => {
      console.log('[update] la version', LS.sosp, 'va bien: confirmada');
      LS.sosp = null;
    }, 20000);
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
  if (Update.estado === 'buscando' || Update.estado === 'bajando') return;
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
      // Se guarda con la ruta LOCAL, que es la que pedira el juego
      await cache.put(new Request('/' + rel), res.clone());
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
