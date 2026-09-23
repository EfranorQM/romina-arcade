// PRUEBA DEL ARRANQUE: estrenar una version, confirmarla y revertirla, con el
// service worker de verdad (index.html + sw.js + update.js).
//
//   node tools/ver-app.js x.png "espera1500;archivo:tools/prueba-arranque.js;js:location.reload();espera700;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js;js:location.reload();espera4000;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js;js:location.reload();espera1200;archivo:tools/prueba-arranque.js"
//
// (Con serve.js en marcha: el worker solo se registra en localhost o https.)
//
// POR QUE EXISTE. El 23-09-2026 el telefono de ella volvio solo a la version
// del APK (la v1.0.8, con el ROMINA de pruebas) despues de actualizar a la
// v1.0.18: un arranque cerrado antes de los 20 s del reloj de confirmacion se
// dio por roto y el siguiente arranque revertio... al APK. Esto comprueba las
// tres reglas que lo arreglan:
//   - se revierte a la version ANTERIOR, no al APK;
//   - se confirma por latidos (fotogramas pintados enteros), no por reloj;
//   - el worker se entera siempre de que version servir, tambien "ninguna".
//
// Se hace con dos versiones de mentira, 9.9.1 y 9.9.2: sus caches son copias
// de los ficheros de www/ mas un /quien.txt con su nombre. Pidiendo quien.txt
// se sabe de que cache esta sirviendo el worker (sin cache: 404, el "APK").
// Cada llamada hace UN paso y apunta en localStorage por cual va.
(async () => {
  const LS = localStorage;
  const fase = +(LS.getItem('prueba.fase') || 0);
  const res = JSON.parse(LS.getItem('prueba.res') || '[]');
  const espera = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 40 && !window.__arcade; i++) await espera(100);

  async function quien() {
    try { const r = await fetch('/quien.txt', { cache: 'no-store' }); return r.ok ? (await r.text()) : 'APK (' + r.status + ')'; }
    catch (e) { return 'error'; }
  }
  async function hazCache(v) {
    const man = await (await fetch('/version.json', { cache: 'no-store' })).json();
    const c = await caches.open('rom-' + v);
    for (const rel of man.archivos) {
      const r = await fetch('/' + rel, { cache: 'no-store' });
      await c.put(new Request('/' + rel), r);
    }
    await c.put(new Request('/quien.txt'), new Response(v));
  }
  const estado = async () => ({
    ver: LS.getItem('rom.ver'), prev: LS.getItem('rom.prev'), sosp: LS.getItem('rom.sosp'), pend: LS.getItem('rom.pend'),
    sirve: await quien(), caches: (await caches.keys()).filter(n => n.startsWith('rom-')).sort().join(','),
    juego: !!(window.__arcade && window.__arcade.sm.cur),
  });
  const apunta = (nombre, ok, e) => { res.push({ nombre, ok, ...e }); LS.setItem('prueba.res', JSON.stringify(res)); };
  const sigue = n => LS.setItem('prueba.fase', String(n));

  if (fase === 0) {
    // Esta la 9.9.1 y se acaba de bajar la 9.9.2.
    for (const n of await caches.keys()) if (n.startsWith('rom-')) await caches.delete(n);
    await hazCache('9.9.1'); await hazCache('9.9.2');
    LS.setItem('rom.ver', '9.9.1'); LS.setItem('rom.pend', '9.9.2');
    LS.removeItem('rom.sosp'); LS.removeItem('rom.prev');
    LS.setItem('prueba.res', '[]');
    sigue(1);
    return 'preparado: 9.9.1 en uso, 9.9.2 lista';
  }
  if (fase === 1) {
    // Se ha estrenado la 9.9.2, a prueba. Se "cierra" enseguida (el reload).
    const e = await estado();
    apunta('estrena la 9.9.2 a prueba, recordando la 9.9.1', e.ver === '9.9.2' && e.prev === '9.9.1' && e.sosp === '9.9.2' && e.sirve === '9.9.2' && e.juego, e);
    sigue(2);
    return e;
  }
  if (fase === 2) {
    // Cerrada antes de confirmarse: vuelve a la 9.9.1 (NO al APK) y se borra la 9.9.2.
    const e = await estado();
    apunta('cerrada antes de confirmarse, vuelve a la ANTERIOR', e.ver === '9.9.1' && !e.sosp && e.sirve === '9.9.1' && !e.caches.includes('9.9.2') && e.juego, e);
    // Se vuelve a bajar la 9.9.2, y esta vez se deja jugar.
    await hazCache('9.9.2'); LS.setItem('rom.pend', '9.9.2');
    sigue(3);
    return e;
  }
  if (fase === 3) {
    // 4 s despues de estrenarla: confirmada por latidos.
    const e = await estado();
    apunta('tras 2 s pintando, queda confirmada', e.ver === '9.9.2' && !e.sosp && e.sirve === '9.9.2' && e.juego, e);
    sigue(4);
    return e;
  }
  if (fase === 4) {
    // Confirmada, un reinicio no la revierte.
    const e = await estado();
    apunta('confirmada, un reinicio no la toca', e.ver === '9.9.2' && e.sirve === '9.9.2' && e.juego, e);
    // Y si no hay anterior a la que volver: al APK, sin mezclas.
    LS.setItem('rom.sosp', '9.9.2'); LS.removeItem('rom.prev');
    sigue(5);
    return e;
  }
  if (fase === 5) {
    const e = await estado();
    apunta('sin anterior, vuelve al APK y el worker deja de servir la borrada', !e.ver && e.sirve.startsWith('APK') && e.juego, e);
    sigue(6);
    for (const n of await caches.keys()) if (n.startsWith('rom-')) await caches.delete(n);
    return { resumen: res.map(r => (r.ok ? 'ok   ' : 'MAL  ') + r.nombre), veredicto: res.every(r => r.ok) ? 'TODO OK' : 'FALLOS' };
  }
  return 'ya hecho (fase ' + fase + '): borra prueba.fase para repetir';
})();
