// PRUEBA DE PUNTA A PUNTA de las actualizaciones.
//
//   node tools/ver-app.js x.png "espera3000;archivo:tools/prueba-ota.js;espera14000;archivo:tools/prueba-ota.js" "https://efranorqm.github.io/romina-arcade/"
//
// EL CUARTO ARGUMENTO ES OBLIGATORIO Y NO ES UN CAPRICHO. Por defecto ver-app
// sirve el juego en http://localhost:8080, y desde ahi la descarga falla con
// un error de CORS que NO existe en el telefono: alli Capacitor sirve la app
// por https://localhost. La primera vez que corri esto dio "FALLO AL BAJAR" y
// parecia un fallo del actualizador; lo era del banco de pruebas.
//
// Se comprobo aparte, con un script de Node sin politica de origen, que los 56
// ficheros se bajan bien y que GitHub Pages si manda Access-Control-Allow-Origin.
// Sirviendo desde el propio origen https, la descarga funciona entera.

// LA PRUEBA DE PUNTA A PUNTA. Se sirve el juego desde GitHub Pages (origen
// https real, como Capacitor) y se finge un telefono en la 1.0.4.
(async () => {
  if (!window.__ota) {
    window.__ota = 1;
    const m = await import('./js/update.js');
    window.__m = m;
    try { localStorage.setItem('rom.ver', '1.0.4'); } catch(e) {}
    window.__antes = {
      version: m.versionActual(),
      origen: location.origin,
    };
    m.buscaActualizacion();
    return 'buscando desde la 1.0.4 en ' + location.origin;
  }
  const m = window.__m, U = m.Update;
  let pend=null, tieneGaleria=false, ficheros=0;
  try { pend = localStorage.getItem('rom.pend'); } catch(e) {}
  if (pend) {
    try {
      const c = await caches.open('rom-' + pend);
      tieneGaleria = !!(await c.match(new Request('/romina-arcade/js/games/galeria.js')))
                  || !!(await c.match(new Request('/js/games/galeria.js')));
      ficheros = (await c.keys()).length;
    } catch(e) {}
  }
  return JSON.stringify({
    antes: window.__antes,
    estado: U.estado, msg: U.msg,
    encontro: U.disponible,
    descargada: pend,
    ficherosEnCache: ficheros,
    galeriaDescargada: tieneGaleria,
  }, null, 1);
})();
