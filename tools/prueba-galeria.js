// Prueba GALERIA en los dos caminos: SIN puente (caratulas) y CON un puente
// fingido (fotos). El puente falso devuelve imagenes generadas, asi que se
// comprueba el camino entero -- permiso, carga, recorte y juego -- sin
// necesidad de un telefono.
(async () => {
  const A = window.__arcade;
  if (!A) return 'sin arcade';

  if (!window.__pg) {
    window.__pg = { fase: 1 };
    A.sm.go(A.GAMES.find(g => g.meta.id === 'galeria'));
    return 'FASE 1: sin puente -> deberia usar caratulas';
  }

  if (window.__pg.fase === 1) {
    const s = A.sm.cur;
    const r1 = { usaFotos: s.usaFotos, imgs: s.imgs.length, jugable: !!s.cartas().length };
    // Ahora se INSTALA un puente falso y se vuelve a entrar
    const svg = (n, col) => 'data:image/svg+xml;base64,' + btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="144">
       <rect width="192" height="144" fill="${col}"/>
       <text x="96" y="80" font-size="48" fill="#fff" text-anchor="middle">${n}</text></svg>`);
    const cols = ['#c0392b','#27ae60','#2980b9','#8e44ad','#d35400','#16a085'];
    window.AndroidFotos = {
      hayPermiso: () => true,
      pedirPermiso: () => {},
      recientes: (n) => JSON.stringify(
        Array.from({length: Math.min(n, 12)}, (_, i) => ({ id: i, src: svg(i + 1, cols[i % 6]) }))),
    };
    window.__pg.fase = 2;
    window.__pg.r1 = r1;
    A.sm.go(A.GAMES.find(g => g.meta.id === 'galeria'));
    return 'FASE 2: con puente falso -> deberia usar fotos';
  }

  // FASE 2: comprobar que cambio a fotos
  const s = A.sm.cur;
  // jugar un poco
  let aciertos = 0;
  for (let i = 0; i < 4; i++) {
    const obj = s.pide;
    const c = s.cartas().find(x => x.idx === obj && x.y > 70 && x.y < 400);
    if (!c) break;
    s.onInput({ type: 'down', x: c.x + c.w / 2, y: c.y + c.h / 2 }, A.ctx);
    if (s.pide !== obj) aciertos++;
  }
  return JSON.stringify({
    sinPuente: window.__pg.r1,
    conPuente: { usaFotos: s.usaFotos, imgs: s.imgs.length, aciertos, puntos: s.puntos, vidas: s.vidas },
    sello: s.sello,
    VEREDICTO: (!window.__pg.r1.usaFotos && window.__pg.r1.jugable && s.usaFotos && aciertos > 0)
      ? 'BIEN: sin fotos juega con caratulas, con fotos usa las fotos'
      : 'REVISAR',
  }, null, 1);
})();
