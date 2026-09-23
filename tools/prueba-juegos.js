// Arranca los cinco juegos uno tras otro y comprueba que ninguno revienta.
//
// Cada juego calcula sus posiciones y hornea sus sprites contra VW/VH en
// init(), y esta app acaba de cambiar como se fija esa resolucion. Un fallo ahi
// no se ve en el menu: se ve al entrar al cuarto juego, cuando ya se creia todo
// terminado. Esto entra en los cinco, los corre unos frames y devuelve el parte.
//
// Uso:  node tools/ver-app.js x.png "espera1200;archivo:tools/prueba-juegos.js;espera6000;archivo:tools/prueba-juegos.js"
(() => {
  const A = window.__arcade;
  if (!A) return 'la app no expuso __arcade';

  if (!window.__pj) {
    window.__pj = { i: 0, parte: [], errores: [] };
    // Cualquier excepcion durante la prueba se apunta, no se pierde en consola.
    window.addEventListener('error', e => {
      window.__pj.errores.push(String(e.message));
    });

    window.__pjTimer = setInterval(() => {
      const st = window.__pj;
      if (st.i >= A.GAMES.length) { clearInterval(window.__pjTimer); return; }
      const G = A.GAMES[st.i];
      const cur = A.sm.cur;
      // Si el juego que se lanzo ya esta corriendo, se apunta como bueno y se
      // pasa al siguiente. Se mira meta.id porque sm.cur es el objeto del juego.
      if (cur && cur.meta.id === G.meta.id) {
        st.parte.push({
          juego: G.meta.id,
          lienzo: A.ctx.VW + 'x' + A.ctx.VH,
          esperado: (G.meta.vw || 270) + 'x' + (G.meta.vh || 600),
          ok: A.ctx.VW === (G.meta.vw || 270) && A.ctx.VH === (G.meta.vh || 600),
        });
        st.i++;
        if (st.i < A.GAMES.length) {
          A.sm.go(A.GAMES[st.i], { seed: 12345 });
        }
      } else if (!st.lanzado) {
        st.lanzado = true;
        A.sm.go(G, { seed: 12345 });
      }
    }, 260);
    // Arranca el primero.
    A.sm.go(A.GAMES[0], { seed: 12345 });
    window.__pj.lanzado = true;
    return 'probando los ' + A.GAMES.length + ' juegos';
  }

  const st = window.__pj;
  clearInterval(window.__pjTimer);
  return {
    probados: st.parte.length,
    de: A.GAMES.length,
    detalle: st.parte,
    // main.js atrapa los fallos de las escenas (para enseñarlos en pantalla)
    // y apunta el primero en rom.error: tambien cuenta.
    errores: st.errores.concat(localStorage.getItem('rom.error') ? [localStorage.getItem('rom.error')] : []),
  };
})()
