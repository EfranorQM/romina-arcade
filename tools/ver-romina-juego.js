// Entra a ROMINA y la deja CORRIENDO, para ver la tela a escala de pantalla.
(() => {
  const A = window.__arcade;
  if (!A) return 'sin __arcade';
  if (!window.__vr) {
    window.__vr = 1;
    A.sm.go(A.GAMES.find(g => g.meta.id === 'caballero'));
    return 'entrando';
  }
  const s = A.sm.cur;
  if (!s || !s.K) return 'aun no';
  s.K.st = 1; s.K.vx = 240; s.K.dir = 1; s.K.x = 300;
  return 'corriendo';
})();
