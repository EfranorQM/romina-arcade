// El GARROTAZO en el instante del impacto, para ver la estela.
(() => {
  const A = window.__arcade;
  if (!A) return 'sin __arcade';
  if (!window.__vg) { window.__vg = 1; A.sm.go(A.GAMES.find(g => g.meta.id === 'caballero')); return 'entrando'; }
  const s = A.sm.cur; if (!s || !s.O) return 'aun no';
  const O = s.O, K = s.K;
  K.x = 560; K.vx = 0; K.dir = 1; K.st = 7; K.bloqT = 0.14;   // ella bloqueando
  O.x = 800; O.dir = -1;
  O.st = 2; O.atk = 0; O.atkT = 0.47; O.golpeo = 0;           // garrote, activo
  return 'garrotazo';
})();
