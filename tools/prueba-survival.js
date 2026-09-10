// Prueba dirigida de SURVIVAL: comprueba que los controles responden, que las
// balas matan, que los diez jefes salen con su habilidad y que nada revienta.
//
// Se ejecuta por pasos: cada llamada avanza una fase y devuelve lo que vio.
// Los toques se mandan en coordenadas de PANTALLA, asi que aqui se convierten
// desde las del lienzo usando la misma vista que usa el juego. Hacerlo a ojo
// fallaba: el lienzo mide 600x270 y la ventana 1200x540.
(() => {
  const A = window.__arcade;
  if (!A) return 'no hay __arcade';
  const g = A.sm.cur;
  if (!g || g.meta.id !== 'survival') return 'survival no esta activo';

  const st = window.__sv || (window.__sv = { fase: 0 });

  // De coordenadas del lienzo a coordenadas de pantalla (para los toques).
  const v = A.view;
  const px = x => v.ox + x * v.scale;
  const py = y => v.oy + y * v.scale;

  st.fase++;

  if (st.fase === 1) {
    // Donde hay que tocar para cada control, en pantalla.
    return {
      fase: 'coordenadas',
      fuego: [Math.round(px(600 - 48)), Math.round(py(270 - 44))],
      bomba: [Math.round(px(600 - 104)), Math.round(py(270 - 32))],
      pad:   [Math.round(px(52)), Math.round(py(270 - 48))],
      lienzo: [g.meta.vw, g.meta.vh],
      escala: +v.scale.toFixed(3),
    };
  }

  if (st.fase === 2) {
    return {
      fase: 'estado tras jugar',
      vidas: g.lives,
      ola: g.wave,
      enemigos: g.enemies.length,
      balas: g.bullets.length,
      disparando: g.firing,
      movimiento: g.padDX,
      score: g.score,
    };
  }

  if (st.fase === 3) {
    // Salta directo a la ola de un jefe concreto para probar su habilidad.
    const id = st.boss || 'celos';
    g.wave = 4;
    g.waveActive = false;
    g.nextWaveT = 0.05;
    g.enemies.length = 0;
    g.bossBag = [id];          // la bolsa fuerza cual sale
    return 'preparado jefe ' + id;
  }

  if (st.fase === 4) {
    const b = g.enemies.find(e => e.boss);
    return {
      fase: 'jefe',
      hay: !!b,
      cual: b ? b.def.name : null,
      habilidad: b ? b.def.ability : null,
      vida: b ? b.hp + '/' + b.maxHp : null,
      balasEnemigas: g.ebullets.length,
      ola: g.wave,
    };
  }

  return { fase: 'fin', score: g.score, ola: g.wave, vidas: g.lives };
})()
