// Entra a GALERIA, juega solo y devuelve el parte.
(() => {
  const A = window.__arcade;
  if (!A) return 'sin arcade';
  if (!window.__pg) {
    window.__pg = 1;
    A.sm.go(A.GAMES.find(g => g.meta.id === 'galeria'));
    return 'entrando a GALERIA';
  }
  const s = A.sm.cur;
  if (!s || !s.cartas) return 'no es galeria: ' + (s && s.meta && s.meta.id);
  // Juega: toca la carta correcta 5 veces
  let aciertos = 0;
  for (let i = 0; i < 5; i++) {
    const objetivo = s.pide;
    const c = s.cartas().find(x => x.idx === objetivo && x.y > 62 && x.y < 500);
    if (!c) break;
    s.onInput({ type: 'down', x: c.x + c.w / 2, y: c.y + c.h / 2 }, A.ctx);
    if (s.pide !== objetivo) aciertos++;
  }
  return JSON.stringify({
    id: s.meta.id, version: s.ver, color: s.colorVer,
    cartasEnPantalla: s.cartas().length,
    aciertos, puntos: s.puntos, vidas: s.vidas, ronda: s.ronda,
  });
})();
