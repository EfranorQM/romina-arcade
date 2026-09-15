// Comprueba que el sistema de actualizaciones arranca bien en el navegador.
(() => {
  const r = {};
  r.swSoportado = 'serviceWorker' in navigator;
  r.controlador = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  r.caches = typeof caches !== 'undefined';
  r.juegoVivo = !!window.__arcade;
  r.juegos = window.__arcade ? window.__arcade.GAMES.length : 0;
  try { r.version = localStorage.getItem('rom.ver') || '(la del APK)'; } catch(e) { r.version = 'LS bloqueado'; }
  return JSON.stringify(r);
})();
