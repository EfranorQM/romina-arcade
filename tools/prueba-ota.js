// PRUEBA DE PUNTA A PUNTA, CON REINICIO.
//
//   node tools/ver-app.js x.png "espera3000;archivo:tools/prueba-ota.js;espera14000;archivo:tools/prueba-ota.js;js:location.reload();espera5000;archivo:tools/prueba-ota.js" "https://efranorqm.github.io/romina-arcade/"
//
// EL CUARTO ARGUMENTO ES OBLIGATORIO. Por defecto ver-app sirve en
// http://localhost:8080 y desde ahi la descarga falla con CORS, un error que
// NO existe en el telefono (Capacitor sirve por https://localhost).
//
// LO QUE DE VERDAD HAY QUE COMPROBAR es el ULTIMO paso: que tras recargar,
// window.__arcade.GAMES incluya el juego nuevo. Las versiones anteriores de
// esta prueba se quedaban en "descargada: 1.0.5" y daban por bueno el
// sistema -- pero descargar no es ejecutar, y el codigo viejo seguia
// corriendo. Ese fallo llego al telefono.
(async () => {
  const marca = () => { try { return localStorage.getItem('rom.fase'); } catch(e){ return null; } };
  const poner = v => { try { localStorage.setItem('rom.fase', v); } catch(e){} };

  const fase = marca();

  if (!fase) {
    // FASE 1: fingir un telefono en una version vieja y buscar
    poner('buscando');
    const m = await import('./js/update.js');
    window.__m = m;
    try { localStorage.setItem('rom.ver', '1.0.4'); } catch(e) {}
    m.buscaActualizacion();
    return 'FASE 1: buscando desde la 1.0.4';
  }

  if (fase === 'buscando') {
    const m = window.__m || await import('./js/update.js');
    const U = m.Update;
    let pend=null; try { pend = localStorage.getItem('rom.pend'); } catch(e){}
    if (U.estado !== 'lista') {
      return JSON.stringify({ fase:'1', estado:U.estado, msg:U.msg });
    }
    poner('reiniciando');
    return JSON.stringify({ fase:'1 OK', estado:U.estado, descargada:pend,
                            juegosAhora: window.__arcade.GAMES.length });
  }

  if (fase === 'reiniciando') {
    // FASE 2: despues de recargar. AQUI se decide si el sistema sirve.
    poner('hecho');
    let ver=null, sosp=null;
    try { ver = localStorage.getItem('rom.ver'); sosp = localStorage.getItem('rom.sosp'); } catch(e){}
    const ids = window.__arcade ? window.__arcade.GAMES.map(g=>g.meta.id) : [];
    // Y que el codigo servido sea el nuevo de verdad
    let gamesTieneGaleria = null, sello = null;
    try {
      const r = await fetch('js/games.js', { cache:'no-store' });
      gamesTieneGaleria = (await r.text()).includes('galeria');
    } catch(e) {}
    // EL SELLO es lo que distingue de verdad "se descargo" de "se ejecuta":
    // se lee del juego YA CARGADO en memoria, no de un fichero.
    try {
      const g = window.__arcade.GAMES.find(x => x.meta.id === 'galeria');
      if (g) { g.init({ gameOver(){} }, {}); sello = g.sello; }
    } catch(e) { sello = 'error: ' + e.message; }
    return JSON.stringify({
      fase: '2 TRAS REINICIAR',
      versionActiva: ver,
      enPruebas: sosp,
      juegos: ids.length,
      tieneGaleria: ids.includes('galeria'),
      gamesJsServidoEsNuevo: gamesTieneGaleria,
      sello,
      VEREDICTO: ids.includes('galeria') ? 'FUNCIONA: el juego nuevo se ejecuta'
                                         : 'FALLA: descargo pero no ejecuta',
    }, null, 1);
  }
  return 'fase desconocida: ' + fase;
})();
