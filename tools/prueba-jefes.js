// Saca los DIEZ jefes uno tras otro, deja correr su habilidad unos segundos y
// comprueba que ninguno revienta ni se queda quieto.
//
// Es la prueba que mas falta hacia: cada jefe tiene codigo propio (invoca
// dudas, se vuelve invisible, revierte tus balas, se clona...) y un fallo en
// uno solo no se ve hasta llegar a la ola 50 jugando.
//
// Uso:  node tools/ver-app.js x.png "espera900;js:...survival...;espera600;archivo:tools/prueba-jefes.js;espera30000;archivo:tools/prueba-jefes.js"
(() => {
  const A = window.__arcade;
  if (!A) return 'no hay __arcade';

  if (!window.__pj2) {
    const st = window.__pj2 = { i: 0, parte: [], errores: [] };
    window.addEventListener('error', e => st.errores.push(String(e.message)));

    const g = A.sm.cur;
    const IDS = ['celos', 'rutina', 'inseguridad', 'miedo', 'mentira',
                 'silencio', 'vicio', 'tiempo', 'abandono', 'ego'];

    // Roma no debe morir durante la prueba: sin esto el juego termina a mitad
    // y los ultimos jefes no llegan a probarse.
    g.lives = 999;

    st.timer = setInterval(() => {
      const cur = A.sm.cur;
      if (!cur || cur.meta.id !== 'survival') { clearInterval(st.timer); return; }

      const jefe = cur.enemies.find(e => e.boss);
      if (jefe && !st.viendo) {
        st.viendo = jefe;
        st.visto = 0;
      }

      if (st.viendo) {
        st.visto++;
        // Tras ~2.4 s con el jefe en pantalla, se apunta lo que hizo.
        if (st.visto >= 8) {
          const b = st.viendo;
          st.parte.push({
            jefe: b.def.name,
            habilidad: b.def.ability,
            vivo: !b.dead,
            seMovio: Math.abs(b.y) > 5,
            balas: cur.ebullets.length,
            enemigos: cur.enemies.length,
            invisible: !!b.invisible,
            fase2: !!b.phase2,
          });
          // Se limpia todo y se pide el siguiente.
          cur.enemies.length = 0;
          cur.ebullets.length = 0;
          cur.bullets.length = 0;
          st.viendo = null;
          st.i++;
          if (st.i >= IDS.length) { clearInterval(st.timer); return; }
          cur.wave = 4;
          cur.waveActive = false;
          cur.nextWaveT = 0.05;
          cur.bossBag = [IDS[st.i]];
          cur.lives = 999;
        }
        return;
      }

      // Sin jefe en pantalla: pedir el que toca. Pero SOLO si no hay ya uno
      // en camino: el jefe entra 1.6 s despues del aviso, y la primera version
      // reiniciaba la ola cada 300 ms, borrandolo antes de que llegara a nacer.
      if (cur.bossPending) return;
      cur.enemies.length = 0;
      cur.wave = 4;
      cur.waveActive = false;
      cur.nextWaveT = 0.05;
      cur.bossBag = [IDS[st.i]];
      cur.lives = 999;
    }, 300);

    return 'probando los 10 jefes';
  }

  const st = window.__pj2;
  clearInterval(st.timer);
  return { probados: st.parte.length, de: 10, detalle: st.parte, errores: st.errores };
})()
