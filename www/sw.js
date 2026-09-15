// El Service Worker que sirve la version descargada del juego.
//
// Se pone delante de cada peticion de un .js. Si hay una version descargada
// en la cache, la devuelve; si no, deja pasar la del APK.
//
// LA REGLA DE ORO: ante CUALQUIER duda, dejar pasar la peticion normal. Este
// fichero corre en el telefono de ella y un fallo aqui dejaria la app en
// blanco. Por eso no hay un solo camino que pueda acabar en error sin salida:
// todo lo envuelve un try y el plan B siempre es "que lo sirva el APK".

let VERSION = null;        // que cache hay que consultar

self.addEventListener('install', e => {
  // Tomar el control cuanto antes, sin esperar a que se cierren pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.tipo === 'usa') VERSION = d.version || null;
});

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
  // Sin version marcada, o si es la del APK, no hay nada que interceptar.
  if (VERSION) {
    try {
      const cache = await caches.open('rom-' + VERSION);
      // Se busca por la RUTA, no por la URL entera: asi da igual el host y los
      // parametros con los que el navegador pida el modulo.
      const hit = await cache.match(new Request(url.pathname));
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
