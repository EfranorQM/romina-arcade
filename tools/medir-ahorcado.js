// Mide cuanto tardan update() y draw() de AHORCADO por frame, dentro del
// navegador. La fisica va aparte del dibujo porque tienen presupuestos
// distintos (< 0.1 ms y < 3 ms en el telefono, que es ~5x mas lento que la PC).
//
// Uso:  VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[6],{seed:7});espera2500;toca261:856;espera800;archivo:tools/medir-ahorcado.js;espera5000;archivo:tools/medir-ahorcado.js"
// La primera llamada instrumenta, la segunda devuelve las estadisticas.
(() => {
  const esc = window.__arcade && window.__arcade.sm.cur;
  if (!esc || esc.meta.id !== 'ahorcado') return 'ahorcado no esta activo';
  if (!window.__ma) {
    window.__ma = { d: [], u: [] };
    const d0 = esc.draw.bind(esc), u0 = esc.update.bind(esc);
    esc.draw = function (g, c, a) { const t = performance.now(); d0(g, c, a); window.__ma.d.push(performance.now() - t); };
    esc.update = function (dt, c) { const t = performance.now(); u0(dt, c); window.__ma.u.push(performance.now() - t); };
    return 'instrumentado';
  }
  const stats = arr => {
    const a = arr.slice(20).sort((x, y) => x - y);
    if (a.length < 10) return 'pocas muestras';
    const q = f => +a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(3);
    return { n: a.length, mediana: q(0.5), p95: q(0.95), peor: +a[a.length - 1].toFixed(3) };
  };
  return { dibujo_ms: stats(window.__ma.d), fisica_ms: stats(window.__ma.u) };
})()
