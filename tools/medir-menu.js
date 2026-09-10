// Mide cuanto tarda el menu en dibujar un frame, dentro del navegador.
//
// El presupuesto es 16.7 ms por frame para ir a 60fps, y el Redmi Note 10 es
// bastante mas lento que un PC: si aqui el dibujo ya se come una parte grande
// del presupuesto, en el telefono se cae. Por eso se mide antes de dar por
// bueno el menu, no despues de que ella note tirones.
//
// Uso:  node tools/ver-app.js salida.png "espera1200;archivo:tools/medir-menu.js;espera3000;archivo:tools/medir-menu.js"
// La primera llamada instrumenta, la segunda devuelve las estadisticas.
(() => {
  const esc = window.__arcade && window.__arcade.sm.cur;
  if (!esc) return 'no hay escena';

  if (!window.__medidas) {
    window.__medidas = [];
    const original = esc.draw.bind(esc);
    esc.draw = function (g, c) {
      const t0 = performance.now();
      original(g, c);
      window.__medidas.push(performance.now() - t0);
    };
    return 'instrumentado';
  }

  // Se descartan los primeros frames: ahi se hornean las caratulas y las
  // cadenas de la fuente, y ese coste es de una sola vez.
  const a = window.__medidas.slice(30).sort((x, y) => x - y);
  if (a.length < 10) return 'pocas muestras: ' + a.length;
  const q = f => +a[Math.min(a.length - 1, Math.floor(a.length * f))].toFixed(3);
  return {
    frames: a.length,
    mediana_ms: q(0.5),
    p95_ms: q(0.95),
    peor_ms: +a[a.length - 1].toFixed(3),
    presupuesto_60fps_ms: 16.7,
    porcentaje_del_presupuesto: +((q(0.5) / 16.7) * 100).toFixed(1),
  };
})()
