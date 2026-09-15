// Entra a ROMINA, la planta y le sube el ESCUDO, para ver el bloqueo a escala
// de pantalla: los brazos, y si el puño cae sobre el escudo.
//
// Se ejecuta DOS veces: la primera entra al juego, la segunda ya coloca. El
// estado del escudo es bloqT (cuanto lleva arriba) y bloqHit (el retroceso del
// impacto), que son los que lee pose() en caba-cuerpo.js.
(() => {
  const A = window.__arcade;
  if (!A) return 'sin __arcade';
  if (!window.__vb) {
    window.__vb = 1;
    A.sm.go(A.GAMES.find(g => g.meta.id === 'caballero'));
    return 'entrando';
  }
  const s = A.sm.cur;
  if (!s || !s.K) return 'aun no';
  const K = s.K;
  K.x = 300; K.vx = 0; K.dir = 1;
  K.bloqT = 0.5;                   // ya arriba del todo: el fotograma 1
  if (window.__vb === 2) K.bloqHit = 0.2;   // y el del impacto
  window.__vb++;
  return 'bloqT=' + K.bloqT + ' bloqHit=' + K.bloqHit;
})();
