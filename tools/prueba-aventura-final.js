// PRUEBA DEL FINAL DE LA AVENTURA: que cada forma de acabar el bosque acabe,
// con la escena de verdad (caba-aventura.js) corriendo en la app.
//
//   node tools/servidor-estatico.js www 8080
//   node tools/ver-app.js final.png "espera1200;archivo:tools/prueba-aventura-final.js;disparo"
//
// POR QUE EXISTE. El 23-09-2026 ella perdio el ultimo corazon cayendo a un foso
// y la pantalla "se quedo volviendo negra y encendiendo congelada": el cuerpo
// seguia cayendo, el nivel avisaba OTRA caida, la escena volvia a 'cae' (el
// fundido a negro), de ahi a 'final'... sin llegar nunca al resultado. El arnes
// del nivel (prueba-nivel.mjs, 5) mira el aviso; esto mira la escena entera.
//
// Por cada caso se apunta la secuencia de fases, fotograma a fotograma. El
// ultimo es el del fallo, y la captura (disparo) tiene que ser su resultado.
(async () => {
  const A = window.__arcade, LS = localStorage;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  // Los mismos modulos que usa la escena (misma direccion, misma instancia).
  const AV = await import('/js/games/caba-aventura.js');
  const C = await import('/js/games/caba-cuerpo.js');
  const N = await import('/js/games/caba-nivel.js');
  const def = N.BOSQUE, [f0, f1] = def.fosos[0], enFoso = (f0 + f1) / 2;
  LS.removeItem('rom.error');
  A.sm.go(A.GAMES.find(G => G.meta.id === 'caballero'));
  await espera(900);
  const S = A.sm.cur;

  async function caso(prepara, ms) {
    AV.empieza(S);
    S.av.fase = 'juego'; S.av.faseT = 0;         // sin el cartel de entrada
    prepara(S.K);
    const fases = [], msgs = [];
    let sigue = true;
    const mira = () => {
      if (!sigue) return;
      const f = S.av.fase;
      if (fases[fases.length - 1] !== f) fases.push(f);
      if (S.av.msg && msgs[msgs.length - 1] !== S.av.msg) msgs.push(S.av.msg);
      requestAnimationFrame(mira);
    };
    mira();
    await espera(ms);
    sigue = false;
    return { fases: fases.join(' > '), msgs, vida: S.K.hp, caidas: S.av.caidas, gano: S.av.gano, res: !!S.av.res };
  }
  const alFoso = (K, hp) => { K.x = enFoso; K.y = def.suelo + 10; K.vx = 0; K.vy = 0; K.enSuelo = false; K.hp = hp; };

  const res = [];
  const apunta = (nombre, ok, e) => res.push((ok ? 'ok   ' : 'MAL  ') + nombre + '   [' + e.fases + ']');

  // 1. Cae con corazones de sobra: vuelve a jugar con uno menos.
  let e = await caso(K => alFoso(K, 3), 2500);
  apunta('cae con 3 corazones: vuelve a jugar con 2', e.fases === 'juego > cae > juego' && e.vida === 2 && e.caidas === 1, e);

  // 2. Llega a la salida. Desde el 24-09-2026 la guarda el lobo blanco: con
  //    el en pie no se acaba (se le dice), y vencido, gana y sale el resultado.
  // (el jefe, dormido: despierto, aullaria y su lobo la echaria de alli)
  e = await caso(K => { for (const E of S.av.N.enemigos) if (E.T.jefe) E.despiertaX = Infinity; K.x = def.salida + 2; }, 2500);
  apunta('llega a la salida con el jefe en pie: sigue jugando y se le dice', e.fases === 'juego' && !e.gano && e.msgs.some(m => /GUARDA/.test(m)),
         { fases: e.fases + ' / ' + e.msgs.join(' | ') });
  e = await caso(K => {
    for (const E of S.av.N.enemigos) if (E.T.jefe) { E.vivo = false; E.hp = 0; E.st = 6; E.muertoT = 9; }
    K.x = def.salida + 2;
  }, 5000);
  apunta('llega a la salida con el jefe vencido: gana y sale el resultado', e.fases === 'juego > final > resultado' && e.gano && e.res, e);

  // 3. Pierde el ultimo corazon en el aire sobre un foso (un golpe en pleno
  //    salto): el cuerpo cae por el, y se acaba sin pasar por 'cae'.
  e = await caso(K => { alFoso(K, 0); K.y = def.suelo - 150; K.vivo = false; K.st = C.MUERTO; K.muereT = 0; }, 5000);
  apunta('derrotada en el aire sobre un foso: acaba sin fundido de caida', e.fases === 'juego > final > resultado' && !e.gano && e.res, e);

  // 4. EL DEL FALLO: el ultimo corazon se pierde cayendo. Una caida, el final,
  //    el resultado, y ahi se queda (8 s: el bucle daba una vuelta cada 3,3 s).
  e = await caso(K => alFoso(K, 1), 8000);
  apunta('pierde el ultimo corazon cayendo: UNA caida y se queda en el resultado', e.fases === 'juego > cae > final > resultado' && e.caidas === 1 && e.res, e);

  const error = LS.getItem('rom.error');
  if (error) res.push('MAL  sin errores en pantalla: ' + error);
  return { resumen: res, veredicto: res.every(r => r.startsWith('ok')) ? 'TODO OK' : 'FALLOS' };
})();
