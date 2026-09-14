// Prueba dirigida de AHORCADO dentro de la app real (se evalua con ver-app.js,
// paso `archivo:`). Cada llamada avanza una fase y devuelve lo que vio.
//
//   VERTICAL=1 node tools/ver-app.js x.png "espera900;js:__arcade.sm.go(__arcade.GAMES[6],{seed:7});espera2500;toca261:856;espera1200;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js;espera300;archivo:tools/prueba-ahorcado-app.js"
//
// Fases:
//   1. el teclado: las 27 teclas responden en el centro y en las cuatro
//      esquinas de su celda de 72x78 (135 de 135), y no hay huecos entre
//      teclas: cada punto de la franja cae en alguna.
//   2. compromiso al soltar: apoyar en A y soltar en B no usa ninguna letra y
//      el muneco resopla (UFF).
//   3. un toque en la cabeza no cuesta nada y pone cara de EH.
//   4. frotar la barriga durante 0.6 s (a tiempo real) y 5. leer que dio cosquillas.
(() => {
  const A = window.__arcade;
  if (!A) return 'no hay __arcade';
  const J = A.sm.cur;
  if (!J || J.meta.id !== 'ahorcado') return 'ahorcado no esta activo';
  const st = window.__pa || (window.__pa = { fase: 0 });
  st.fase++;
  const S = J.S;

  if (st.fase === 1) {
    const T = J.tec;
    const filas = ['ABCDEFG', 'HIJKLMN', 'ÑOPQRST', 'UVWXYZ'];
    let ok = 0, total = 0, mal = [];
    for (let f = 0; f < 4; f++) for (let c = 0; c < filas[f].length; c++) {
      const L = filas[f][c], x0 = 21 + c * 72, y0 = 850 + f * 78;
      // Centro y cuatro esquinas de la celda de toque (72x78, con medio hueco).
      for (const [dx, dy] of [[33, 35], [-2, -3], [68, -3], [-2, 73], [68, 73]]) {
        total++;
        if (T.hit(x0 + dx, y0 + dy) === L) ok++; else mal.push(L + '@' + (x0 + dx) + ',' + (y0 + dy) + '->' + T.hit(x0 + dx, y0 + dy));
      }
    }
    // Huecos: barrer la franja de las cuatro filas de 7 teclas cada 4 px.
    let huecos = 0;
    // (la septima casilla de la cuarta fila esta vacia adivinando: no cuenta)
    for (let y = 850; y < 850 + 3 * 78 + 70; y += 4) for (let x = 21; x < 21 + 7 * 72 - 6; x += 4) if (!(y >= 850 + 3 * 78 - 4 && x >= 21 + 6 * 72 - 3) && !T.hit(x, y)) huecos++;
    return { fase: 'teclado', aciertos: ok + '/' + total, mal: mal.slice(0, 8), huecos, estado: J.estado, palabra: J.palabra };
  }

  if (st.fase === 2) {
    const antes = J.usadas.size;
    J.onInput({ type: 'down', x: 54, y: 885, id: 21 });
    const expectante = J.cara.reac;
    J.onInput({ type: 'move', x: 100, y: 885, id: 21 });
    J.onInput({ type: 'move', x: 126, y: 885, id: 21 });
    J.onInput({ type: 'up', x: 126, y: 885, id: 21 });
    return { fase: 'cancelar', usadasAntes: antes, usadasDespues: J.usadas.size, caraAlApoyar: expectante, caraAlCancelar: J.cara.reac, fallos: J.fallos };
  }

  if (st.fase === 3) {
    const x = S.x[5], y = S.y[5];
    J.onInput({ type: 'down', x, y, id: 22 });
    const agarro = S.grab;
    J.onInput({ type: 'up', x, y, id: 22 });
    return { fase: 'toque', agarro, cara: J.cara.reac, fallos: J.fallos, usadas: J.usadas.size, velCabeza: Math.round(Math.hypot(S.x[5] - S.ox[5], S.y[5] - S.oy[5]) * 60) };
  }

  if (st.fase === 4) {
    // Las cosquillas se miden con el reloj real (velocidad entre eventos y
    // tiempo de frote en update), asi que el frote se manda a lo largo de
    // 0.6 s con un temporizador, y la fase 5 lee el resultado.
    const cx = (S.x[1] + S.x[2] + S.x[3] + S.x[4]) / 4, cy = (S.y[1] + S.y[2] + S.y[3] + S.y[4]) / 4;
    J.onInput({ type: 'down', x: cx, y: cy, id: 23 });
    let i = 0;
    st.frote = setInterval(() => {
      const S2 = J.S, cx2 = (S2.x[1] + S2.x[2] + S2.x[3] + S2.x[4]) / 4, cy2 = (S2.y[1] + S2.y[2] + S2.y[3] + S2.y[4]) / 4;
      J.onInput({ type: 'move', x: cx2 + ((i & 1) ? 14 : -14), y: cy2 + ((i & 2) ? 8 : -8), id: 23 });
      if (++i >= 36) { clearInterval(st.frote); st.durante = { cosquillas: J.cosquillas, cara: J.cara.reac, frota: J.frota }; J.onInput({ type: 'up', x: cx2, y: cy2, id: 23 }); }
    }, 16);
    return { fase: 'cosquillas: frotando 0.6 s' };
  }

  if (st.fase === 5) {
    return { fase: 'cosquillas', durante: st.durante, fallos: J.fallos, usadas: J.usadas.size };
  }
  return 'sin mas fases';
})()
