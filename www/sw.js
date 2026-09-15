// El Service Worker que sirve la version descargada del juego.
//
// Se pone delante de cada peticion y, si hay una version descargada en la
// cache, la devuelve; si no, deja pasar la del APK.
//
// EL FALLO QUE COSTO UNA VERSION ENTERA. La primera version guardaba la
// version activa en una VARIABLE:
//
//     let VERSION = null;                    // <- mal
//     onmessage: if (d.tipo === 'usa') VERSION = d.version;
//
// Y la pagina se la mandaba UNA VEZ al arrancar. Parecia razonable, pero un
// Service Worker NO VIVE PERMANENTEMENTE: el navegador lo mata cuando esta
// inactivo (Android lo hace agresivamente, para ahorrar bateria) y lo revive
// en cuanto llega una peticion. Al revivir, VERSION volvia a null y a partir
// de ese momento servia SIEMPRE los ficheros del APK.
//
// El sintoma era exactamente lo que se vio en el telefono: la descarga decia
// "completada", el menu decia "AL DIA" -- porque ese numero vive en
// localStorage, que si persiste -- pero el codigo nuevo no se ejecutaba nunca.
//
// LA REGLA: un Service Worker no puede recordar NADA entre peticiones. Todo lo
// que necesite saber tiene que leerlo de un sitio que sobreviva a que lo maten.
// Aqui se guarda en la propia Cache API, que es lo unico a lo que tiene acceso
// sincrono-ish y que persiste (localStorage NO esta disponible en un worker).
//
// LA OTRA REGLA: ante cualquier duda, dejar pasar la peticion normal. Esto
// corre en el telefono de ella y un fallo aqui la dejaria sin juego, asi que
// no hay un solo camino que pueda acabar en error sin salida.

// Donde se apunta que version hay que servir. Es una entrada mas de la Cache
// API, con una URL inventada que nunca se pediria de verdad.
const MARCA = 'rom-marca';
const URL_MARCA = '/__version__';

// Cache de la version en memoria: leer la marca en CADA peticion seria lento
// (son decenas de modulos al arrancar). Pero es solo un atajo -- si esta
// vacia, se lee de la marca, que es la fuente de verdad.
let memo = null;

self.addEventListener('install', () => {
  // Tomar el control cuanto antes, sin esperar a que se cierren pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'usa') {
    memo = d.version || null;
    // Y se APUNTA, para que sobreviva a que maten el worker.
    const trabajo = guardaMarca(d.version);
    e.waitUntil(trabajo);
    // Se CONFIRMA a quien lo mando. El index espera esta confirmacion antes de
    // cargar el juego: sin ella, los modulos se pedirian antes de que el
    // worker supiera que version servir.
    if (e.ports && e.ports[0]) {
      const port = e.ports[0];
      trabajo.then(() => port.postMessage({ ok: true, version: memo }))
             .catch(() => port.postMessage({ ok: false }));
    }
  }
  // Para diagnosticar desde la app: responde que version esta sirviendo.
  if (d.tipo === 'dime' && e.ports && e.ports[0]) {
    const port = e.ports[0];
    leeVersion().then(v => port.postMessage({ version: v, memo }));
  }
});

async function guardaMarca(version) {
  try {
    const c = await caches.open(MARCA);
    if (version) {
      await c.put(new Request(URL_MARCA), new Response(String(version)));
    } else {
      await c.delete(new Request(URL_MARCA));
    }
  } catch (err) { /* sin cache: se seguira sirviendo lo del APK */ }
}

async function leeVersion() {
  if (memo !== null) return memo;
  try {
    const c = await caches.open(MARCA);
    const r = await c.match(new Request(URL_MARCA));
    if (r) {
      memo = (await r.text()) || null;
      return memo;
    }
  } catch (err) { /* idem */ }
  return null;
}

self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo se tocan las peticiones GET del propio origen. Todo lo demas (la
  // descarga de la actualizacion incluida) pasa de largo.
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(sirve(req, url));
});

async function sirve(req, url) {
  const version = await leeVersion();
  if (version) {
    try {
      const cache = await caches.open('rom-' + version);
      // Se busca por la RUTA, no por la URL entera: asi da igual el host y los
      // parametros con los que el navegador pida el modulo.
      //
      // Se prueban dos formas porque la app puede estar servida en la raiz (en
      // el telefono, donde Capacitor sirve desde /) o en un subdirectorio (al
      // probarla en GitHub Pages, bajo /romina-arcade/). Sin la segunda, las
      // pruebas en Pages no encontraban nada y parecia un fallo del sistema.
      let hit = await cache.match(new Request(url.pathname));
      if (!hit) {
        const scope = new URL(self.registration.scope).pathname;  // p.ej. /romina-arcade/
        if (scope !== '/' && url.pathname.startsWith(scope)) {
          hit = await cache.match(new Request('/' + url.pathname.slice(scope.length)));
        }
      }
      if (hit) return hit;
    } catch (err) {
      // Cache rota o sin permiso: se sigue al plan B sin hacer ruido.
    }
  }
  // PLAN B, y tambien el camino normal: lo sirve el APK.
  try {
    return await fetch(req);
  } catch (err) {
    // Ni cache ni red. Se devuelve un error limpio en vez de una excepcion,
    // que en un modulo ES se ve como pantalla en blanco.
    return new Response('', { status: 504, statusText: 'sin conexion' });
  }
}
