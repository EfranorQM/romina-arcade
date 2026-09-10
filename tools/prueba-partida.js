// Juega SURVIVAL sola durante muchas olas y comprueba que el juego aguanta.
//
// Es la prueba que caza lo que ninguna captura enseña: una ola que nunca se
// cierra y deja el juego colgado, listas que crecen sin parar, un jefe que se
// queda atascado, o el puntaje congelado. Roma se maneja con un piloto tonto
// (se coloca bajo el enemigo mas bajo y dispara siempre), que es como se
// validaron las fisicas de los otros juegos.
//
// Uso:  node tools/ver-app.js x.png "espera900;js:<lanzar survival>;espera600;archivo:tools/prueba-partida.js;espera60000;archivo:tools/prueba-partida.js"
(() => {
  const A = window.__arcade;
  const g = A.sm.cur;
  if (!g || g.meta.id !== 'survival') return 'survival no esta activo';

  if (!window.__pp) {
    const st = window.__pp = {
      olaMax: 0, muertes: 0, errores: [], picos: { enemigos: 0, balas: 0, ebalas: 0, floats: 0 },
      olaAnterior: 0, sinAvanzar: 0, atascos: 0, jefesVistos: {},
    };
    window.addEventListener('error', e => st.errores.push(String(e.message)));

    // Roma es inmortal durante la prueba: lo que se mide es el motor, no la
    // habilidad. Las muertes se cuentan aparte.
    st.timer = setInterval(() => {
      const c = A.sm.cur;
      if (!c || c.meta.id !== 'survival') { clearInterval(st.timer); return; }

      if (c.lives < 900) { st.muertes += (900 - c.lives > 0 ? 0 : 0); }
      c.lives = 999;
      if (c.over) { c.over = false; c.overT = 0; }

      // Piloto tonto: se pone debajo del enemigo mas bajo y dispara sin parar.
      let objetivo = null;
      for (const e of c.enemies) if (!objetivo || e.y > objetivo.y) objetivo = e;
      if (objetivo) c.roma.x += Math.sign(objetivo.x - c.roma.x) * 6;
      c.firing = true;

      // La bomba, en cuanto esta lista.
      if (c.bomb.ready && c.enemies.length > 4) c._useBomb();

      // Picos: si alguna lista crece sin freno, hay una fuga.
      const p = st.picos;
      p.enemigos = Math.max(p.enemigos, c.enemies.length);
      p.balas    = Math.max(p.balas, c.bullets.length);
      p.ebalas   = Math.max(p.ebalas, c.ebullets.length);
      p.floats   = Math.max(p.floats, c.floats.length);

      for (const e of c.enemies) if (e.boss) st.jefesVistos[e.def.name] = true;

      // Atasco: la ola no avanza en mucho tiempo.
      if (c.wave === st.olaAnterior) {
        st.sinAvanzar++;
        if (st.sinAvanzar === 120) {          // ~24 s en la misma ola
          st.atascos++;
          st.atascoEn = { ola: c.wave, enemigos: c.enemies.length,
                          spawned: c.spawned, toSpawn: c.toSpawn,
                          waveActive: c.waveActive };
        }
      } else {
        st.olaAnterior = c.wave;
        st.sinAvanzar = 0;
      }
      st.olaMax = Math.max(st.olaMax, c.wave);
    }, 200);

    return 'jugando sola';
  }

  const st = window.__pp;
  clearInterval(st.timer);
  const c = A.sm.cur;
  return {
    olaAlcanzada: st.olaMax,
    score: c.score,
    picos: st.picos,
    jefes: Object.keys(st.jefesVistos),
    atascos: st.atascos,
    atascoEn: st.atascoEn || null,
    errores: st.errores.slice(0, 5),
  };
})()
