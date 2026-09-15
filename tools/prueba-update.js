// Los casos de FALLO: lo que pasa cuando algo va mal. Es lo que de verdad
// importa, porque esto va al telefono de ella.
(async () => {
  if (!window.__pf) {
    window.__pf = { r: {} };
    const m = await import('./js/update.js');
    window.__pf.m = m;

    // CASO 1: el origen no responde (sin internet / servidor caido)
    const fetchReal = window.fetch;
    window.fetch = () => Promise.reject(new Error('sin red'));
    try { localStorage.setItem('rom.ver', '0.0.1'); } catch(e){}
    m.Update.estado = 'reposo';
    await m.buscaActualizacion();
    window.__pf.r.sinRed = m.Update.estado + ' / ' + m.Update.msg;

    // CASO 2: el manifiesto llega corrupto
    window.fetch = () => Promise.resolve(new Response('{"esto":"no vale"}', {status:200}));
    m.Update.estado = 'reposo';
    await m.buscaActualizacion();
    window.__pf.r.corrupto = m.Update.estado + ' / ' + m.Update.msg;

    // CASO 3: el manifiesto va bien pero UN fichero da 404
    let n = 0;
    window.fetch = (u) => {
      const s = String(u);
      if (s.includes('version.json')) return Promise.resolve(new Response(
        JSON.stringify({version:'9.9.9', archivos:['js/core.js','js/main.js','js/audio.js']}), {status:200}));
      n++;
      if (n === 2) return Promise.resolve(new Response('', {status:404}));
      return Promise.resolve(new Response('// ok', {status:200}));
    };
    m.Update.estado = 'reposo';
    await m.buscaActualizacion();
    window.__pf.r.ficheroRoto = m.Update.estado + ' / ' + m.Update.msg;
    // y lo importante: NO puede quedar una version a medias pendiente
    try { window.__pf.r.pendTrasFallo = localStorage.getItem('rom.pend') || '(ninguna, bien)'; } catch(e){}
    // ni una cache basura
    window.__pf.r.cachesTrasFallo = (await caches.keys()).filter(k=>k.includes('9.9.9')).length;

    window.fetch = fetchReal;
    try { localStorage.removeItem('rom.ver'); localStorage.removeItem('rom.pend'); } catch(e){}
    return 'probando los fallos...';
  }
  // CASO 4: el juego sigue vivo despues de todo esto
  const r = window.__pf.r;
  r.juegoVivo = !!window.__arcade;
  r.juegos = window.__arcade ? window.__arcade.GAMES.length : 0;
  return JSON.stringify(r, null, 1);
})();
