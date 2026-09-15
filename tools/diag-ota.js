// Diagnostico: por que el codigo descargado no se ejecuta.
(async () => {
  const r = { paso: 'inspeccion' };
  try { r.ver = localStorage.getItem('rom.ver'); r.pend = localStorage.getItem('rom.pend'); r.sosp = localStorage.getItem('rom.sosp'); } catch(e) {}
  r.caches = await caches.keys();
  r.sw = {
    controlando: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    scriptURL: navigator.serviceWorker && navigator.serviceWorker.controller
               ? navigator.serviceWorker.controller.scriptURL : null,
  };
  // que registros hay
  const regs = await navigator.serviceWorker.getRegistrations();
  r.registros = regs.map(g => ({ scope: g.scope, activo: !!g.active, esperando: !!g.waiting }));
  // Lo clave: el SW sabe QUE VERSION tiene que servir?
  // Se le pregunta con un canal de mensajes.
  if (navigator.serviceWorker.controller) {
    r.respuestaSW = await new Promise(res => {
      const ch = new MessageChannel();
      ch.port1.onmessage = e => res(e.data);
      setTimeout(() => res('SIN RESPUESTA (el sw no contesta preguntas)'), 1500);
      navigator.serviceWorker.controller.postMessage({ tipo: 'dime' }, [ch.port2]);
    });
  }
  // Y lo definitivo: pedir games.js y ver si trae galeria
  try {
    const res = await fetch('/js/games.js', { cache: 'no-store' });
    const txt = await res.text();
    r.gamesJsTieneGaleria = txt.includes('galeria');
    r.gamesJsLargo = txt.length;
  } catch(e) { r.gamesJsError = String(e); }
  r.juegosCargados = window.__arcade ? window.__arcade.GAMES.map(g=>g.meta.id) : [];
  return JSON.stringify(r, null, 1);
})();
