// Entra a ROMINA y fuerza al ogro a hacer un ataque concreto, para poder ver
// el pisoton, las ondas y el garrotazo sin tener que jugar la pelea entera.
//   window.__at = 0 garrote | 1 pisoton | 2 barrido | 3 embestida
(() => {
  const A = window.__arcade;
  if (!A) return 'sin __arcade';
  if (!window.__vp) {
    window.__vp = 1;
    A.sm.go(A.GAMES.find(g => g.meta.id === 'caballero'));
    return 'entrando';
  }
  const s = A.sm.cur;
  if (!s || !s.O) return 'aun no';
  const O = s.O, K = s.K;
  K.x = 520; K.vx = 0; K.dir = 1;
  O.x = 760; O.dir = -1;
  O.st = 2;                       // ATACA
  O.atk = window.__at === undefined ? 1 : window.__at;
  O.atkT = window.__t === undefined ? 0.66 : window.__t;
  O.golpeo = 0;
  return 'ataque ' + O.atk + ' en t=' + O.atkT.toFixed(2);
})();
