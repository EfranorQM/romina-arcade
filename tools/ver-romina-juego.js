// Entra a ROMINA y la deja en mitad del tajo, para verla a escala de pantalla
// sobre el campo de batalla (que es donde de verdad se juzga el sprite).
(() => {
  const A = window.__arcade;
  if (!A) return 'sin __arcade';
  if (!window.__vr) {
    window.__vr = 1;
    const G = A.GAMES.find(g => g.meta.id === 'caballero');
    A.sm.go(G);
    return 'entrando a ROMINA';
  }
  const s = A.sm.cur;
  if (!s || !s.K) return 'aun no';
  // El fotograma del impacto del tajo: TAJO_A0..TAJO_A1 es 0.08..0.15
  s.K.st = 4; s.K.tajoT = 0.11; s.K.dir = 1;
  return 'tajo en el frame del impacto';
})();
