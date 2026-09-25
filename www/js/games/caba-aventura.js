// LA AVENTURA de ROMINA: el modo que se juega por niveles que avanzan.
//
// Vive dentro de la escena de ROMINA (caballero.js) y no como escena aparte:
// el arcade solo pausa las escenas que estan en su lista de juegos (main.js,
// esJuego), y la aventura tiene que poder pausarse. La escena le pasa el mando
// cuando this.fase === 'aventura'; todo lo de aqui recibe la escena como S y
// usa sus botones, su stick y su Romina (S.K), asi que los mandos se dibujan y
// se tocan igual que en la pelea.
//
// Fases (S.av.fase):
//   entrada    el cartel del nivel y ella entrando andando. Se salta tocando.
//   juego      el nivel (caba-nivel.js)
//   cae        se acaba de caer a un foso: la pantalla se funde y vuelve
//   final      ha llegado a la salida, o se ha quedado sin corazones
//   resultado  el tiempo, la vida, la nota; OTRA VEZ, ELEGIR o MENU

import { VW, cam, Save } from '../core.js';
import { burst, particles } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, SONGS, playMusic } from '../audio.js';
import { vibrate } from '../input.js';
import * as C from './caba-cuerpo.js';
import * as P from './caba-partida.js';
import * as N from './caba-nivel.js';
import * as EN from './caba-enemigos.js';
import * as BT from './caba-botones.js';
import * as MD from './caba-mandos.js';
import * as FX from './caba-efectos.js';
import { drawRomina } from './romi-sprite.js';
import { drawBosque, drawHoguera, drawTroncos, drawSombrasRamas, drawRamas, sombra, P as PB } from './bosque-sprite.js';
import { drawEnemigo, drawFuego, P as PE } from './enemigos-sprite.js';

const ALTO = 540;
const ENTRADA_T = 2.4, FINAL_T = 2.4, CAE_T = 0.9;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, bloquea: false };
const ORO = '#ffe066', ROSA = '#ef4a84', BLANCO = '#fff4fa';
// LO QUE SE GUARDA. El 24-09-2026 el bosque crecio (los tengus y el lobo
// blanco, 3300 px mas): el tiempo y las notas del bosque corto no se pueden
// comparar con los del largo, asi que se guardan aparte, y el NUEVO! de la
// pestaña vuelve a salir hasta que lo juegue.
export const GUARDADO = 'caba.bosque2', VISTA = 'caba.aventuraVista2';
// El polvo de los EFECTOS (saltar, caer): mas claro que el del bosque. Con el
// suyo (#cecb85) sobre el camino (#adaa6d) el aro y las nubes no se veian.
const POLVO_FX = ['#fff8d8', '#ece6b8', PB.polvo3];

// Empezar el bosque (desde el principio, o desde la ultima hoguera a la que
// llego: `desdeHoguera` es su x).
export function empieza(S, desdeHoguera = 0) {
  const def = N.BOSQUE;
  const L = N.makeNivel(def, Math.random, P.opcionesBosque(S.dif));
  if (desdeHoguera) L.hoguera = desdeHoguera;
  const x0 = desdeHoguera ? desdeHoguera + 40 : 40;
  S.K = C.makeCaballero(x0, { ...P.opcionesElla(S.dif), y: def.suelo });
  L.seguroX = desdeHoguera ? desdeHoguera + 40 : 160;
  N.camara(L, S.K, VW, 0, true);
  S.av = {
    N: L, fase: 'entrada', faseT: 0, t: 0, tJuego: 0,
    golpes: 0, caidas: 0, desdeHoguera, gano: false, acabada: false, res: null, funde: 0,
    msg: '', msgT: 0, hitstop: 0,
    // cuantas veces le ha parado el yamabushi un golpe (lo dice las primeras)
    rechazos: 0,
    // Los EFECTOS de lo que hace ella: los mismos que en la pelea.
    fx: FX.makeEfectos(POLVO_FX),
  };
  S.salta = false; S.golpea = false; S.esquiva = false;
  S.combo = 0; S.comboT = 0; S.leccion = null;
  S.fase = 'aventura'; S.faseT = 0;
  Save.guarda(VISTA, true);                     // ya no hace falta el NUEVO
  playMusic(SONGS.caballeroBosque || SONGS.caballero);
}

// ---------------------------------------------------------------- update
export function update(S, dt) {
  const A = S.av;
  A.faseT += dt; A.t += dt;
  if (A.msgT > 0) A.msgT -= dt;
  if (A.funde > 0) A.funde = Math.max(0, A.funde - dt * 2.5);
  if (A.fase === 'entrada') return entrada(S, dt);
  if (A.fase === 'resultado') { FX.step(A.fx, dt); C.stepCaballero(S.K, NADA, dt, N.mundo(A.N)); return; }
  if (A.fase === 'cae') {
    FX.step(A.fx, dt);
    // Sigue cayendo, y a mitad del fundido vuelve al ultimo sitio seguro.
    C.stepCaballero(S.K, NADA, dt, N.mundo(A.N));
    if (A.faseT >= CAE_T) {
      if (N.vuelveDelFoso(A.N, S.K)) {
        camara(S, 0, true);
        A.fase = 'juego'; A.faseT = 0; A.funde = 1;
        A.msg = 'CUIDADO CON LOS FOSOS'; A.msgT = 1.4;
      } else {
        // Era el ultimo corazon: del negro vuelve el bosque, con su cartel.
        A.funde = 1;
        termina(S, false);
      }
    }
    return;
  }
  juego(S, dt);
  if (A.fase === 'final' && A.faseT >= FINAL_T) cierra(S);
}

function entrada(S, dt) {
  const A = S.av, K = S.K;
  // Entra andando hasta su sitio.
  C.stepCaballero(K, { ...NADA, dx: K.x < (A.desdeHoguera ? A.desdeHoguera + 120 : 170) ? 1 : 0 }, dt, N.mundo(A.N));
  camara(S, dt);
  if (A.faseT >= ENTRADA_T) empiezaJuego(S);
}
function empiezaJuego(S) {
  const A = S.av;
  A.fase = 'juego'; A.faseT = 0;
}

function juego(S, dt) {
  const A = S.av, K = S.K, L = A.N;
  if (A.hitstop > 0) { A.hitstop -= dt; return; }
  FX.step(A.fx, dt);
  const activo = A.fase === 'juego';
  if (activo) A.tJuego += dt;
  const inp = activo ? {
    dx: MD.curvaStick(S.stick.dx),
    salta: S.salta,
    golpea: S.golpea, esquiva: S.esquiva, bloquea: S.bGuardia.pressed,
  } : (A.gano ? { ...NADA, dx: 1 } : NADA);
  S.salta = false; S.golpea = false; S.esquiva = false;
  const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId, antesCd = K.esqCd;
  const antesY = K.y, antesVy = K.vy;

  const M = N.mundo(L);
  C.stepCaballero(K, inp, dt, M);

  // Lo mismo que en la pelea: cada cosa que hace se oye y se ve.
  if (K.tajoId !== antesTajo) {
    SFX.espadazo();
    const n = C.golpeCombo(K);
    S.combo = n + 1; S.comboT = 1.0;
    vibrate(n === 2 ? 12 : 5);
  }
  if (S.comboT > 0) S.comboT -= dt;
  if (antesCd > 0 && K.esqCd <= 0) S.pulsos.esquivar = 1;
  if (!antesSuelo && K.enSuelo) {
    burst(K.x - L.camX, K.y, 9, { rnd: Math.random, colors: [PB.polvo1, PB.polvo2], speed: 120, life: 0.32, size: 4, grav: 520 });
    FX.aterriza(A.fx, K.x, K.y, antesVy / 1100);
    SFX.aterriza(); cam.shake(1.5, 0.08);
  }
  if (antesSt !== C.SALTA && K.st === C.SALTA) { SFX.salto(); vibrate(6); FX.despega(A.fx, K.x, antesY); }
  if (K.st === C.ESQUIVA) { const [ep, ef] = C.pose(K); FX.estela(A.fx, K, ep, ef, C.invulnerable(K)); }
  if (antesSt !== C.ESQUIVA && K.st === C.ESQUIVA) {
    SFX.esquiva(); vibrate(8);
    FX.esquiva(A.fx, K.x, antesY, K.esqDir);
    burst(K.x - L.camX, K.y, 10, { rnd: Math.random, colors: [PB.polvo1, PB.polvo3], speed: 140, life: 0.3, size: 4, grav: 400 });
  }
  if (K.st === C.CORRE && K.enSuelo && ((A.t * 12) | 0) % 3 === 0) {
    burst(K.x - L.camX - K.dir * 14, K.y, 1, { rnd: Math.random, colors: [PB.polvo2], speed: 44, life: 0.24, size: 3, grav: 240 });
  }

  // El nivel: troncos, ramas, fosos, hoguera, salida.
  for (const e of N.stepNivel(L, K, dt, VW)) {
    const ex = e.x - L.camX;
    if (e.tipo === 'tronco') SFX.rodar();
    else if (e.tipo === 'golpeTronco' || e.tipo === 'golpeRama') {
      A.golpes++;
      duele(S);
      burst(ex, e.y, 16, { rnd: Math.random, colors: [PB.madera1, PB.madera2, PB.corteza], speed: 280, life: 0.5, size: 4, grav: 700 });
      if (e.tipo === 'golpeTronco' && K.st === C.DOLOR) { A.msg = 'SALTALO O ESQUIVALO'; A.msgT = 1.3; }
    } else if (e.tipo === 'rama') {
      SFX.aterriza(); cam.shake(2, 0.1);
      burst(ex, e.y, 14, { rnd: Math.random, colors: [PB.madera2, PB.hoja1, PB.hoja2], speed: 220, life: 0.5, size: 4, grav: 800 });
    } else if (e.tipo === 'cae') {
      // Una caida solo cuenta jugando: con la partida ya acabada, pasar a
      // 'cae' deshacia el final (ver stepNivel, 'Caer a un foso').
      if (!activo) continue;
      A.caidas++;
      SFX.cae ? SFX.cae() : SFX.hurt(); vibrate(40);
      A.fase = 'cae'; A.faseT = 0;
      return;
    } else if (e.tipo === 'hoguera') {
      SFX.powerup(); vibrate(20);
      A.msg = e.cura ? 'LA HOGUERA TE CURA' : 'HOGUERA ENCENDIDA'; A.msgT = 1.6;
      burst(ex, e.y - 20, 22, { rnd: Math.random, colors: [PB.fuego1, PB.fuego2, BLANCO], speed: 200, life: 0.7, size: 4, grav: -80 });
    } else if (e.tipo === 'salida') {
      termina(S, true);
    } else if (e.tipo === 'guardada') {
      A.msg = 'EL LOBO BLANCO GUARDA LA SALIDA'; A.msgT = 1.6;
    } else enemigo(S, e, ex);
  }
  camara(S, dt);
  if (activo && !K.vivo) termina(S, false);
}

// La camara, y las particulas con ella: el arcade las pinta en coordenadas de
// pantalla, asi que el polvo de un aterrizaje se quedaria quieto en pantalla
// mientras el bosque corre (medio paso por detras de donde cayo).
function camara(S, dt, instantanea = false) {
  const L = S.av.N, antes = L.camX;
  N.camara(L, S.K, VW, dt, instantanea);
  const d = L.camX - antes;
  if (d) for (let i = 0; i < particles.n; i++) particles.items[i].x -= d;
}

// LO QUE PASA CON LOS ENEMIGOS: cada cosa, su sonido y su chispa (como en la
// pelea contra el ogro: sin eso los golpes no pesan).
function enemigo(S, e, ex) {
  const A = S.av, K = S.K;
  if (e.tipo === 'aviso') {
    if (e.atk === 'zarpazo' || e.atk === 'acomete' || e.atk === 'barre' || e.atk === 'levanta') SFX.grune();
    else if (e.atk === 'lanza' || e.atk === 'rastrero') SFX.crece();
    else if (e.atk === 'corro') SFX.alarm();
    else if (e.atk === 'tajo' || e.atk === 'iai' || e.atk === 'relampago') SFX.desenvaina();
    else if (e.atk === 'picado') SFX.graznido();
    // EL AVISO BRILLA DEL COLOR DEL BOTON que lo contesta; en PASEO, el boton
    // sale encima (para quien todavia no se sabe cada ataque de memoria).
    const E = e.enemigo, resp = EN.RESPUESTA[e.atk];
    if (E && resp) FX.aviso(A.fx, E.x, E.y - E.T.alto - 28, resp, E.T[e.atk].aviso, S.dif === 'paseo' ? S.mini[resp] : null);
  } else if (e.tipo === 'fuego') {
    SFX.dash();
  } else if (e.tipo === 'fija') {
    // EL PICADO SE FIJA: va a caer donde esta su sombra. Es el momento de
    // esquivar, y ahi (en la sombra) sale el aviso del boton.
    SFX.picado(); vibrate(8);
    const E = e.enemigo;
    FX.aviso(A.fx, e.x, e.y - 30, 'esquivar', E.T.picado.fija, S.dif === 'paseo' ? S.mini.esquivar : null);
  } else if (e.tipo === 'aterriza') {
    cam.shake(4, 0.16); vibrate(16); SFX.aterriza();
    FX.aterriza(A.fx, e.x, e.y, 1.2);
    burst(ex, e.y, 16, { rnd: Math.random, colors: [PB.polvo1, PB.polvo2, PE.pluma], speed: 260, life: 0.45, size: 4, grav: 500 });
  } else if (e.tipo === 'relampago') {
    SFX.dash(); cam.shake(2, 0.1);
  } else if (e.tipo === 'aullido') {
    // EL JEFE AULLA: la primera vez se dice quien es; si llama, a quien
    SFX.aullido(); cam.shake(3, 0.5); vibrate(30);
    A.msg = e.llama ? 'EL LOBO BLANCO LLAMA A SU MANADA' : 'EL LOBO BLANCO AULLA'; A.msgT = 1.8;
  } else if (e.tipo === 'rechazo') {
    // EL YAMABUSHI LE PARA EL GOLPE: acero contra acero
    A.hitstop = 5 / 60; cam.shake(2.5, 0.1); SFX.clang(); vibrate(12);
    FX.bloquea(A.fx, e.x, e.y, -e.enemigo.dir);
    burst(ex, e.y, 12, { rnd: Math.random, colors: [PE.acero, ORO, '#ffffff'], speed: 280, life: 0.35, size: 3, grav: 300 });
    if (e.aullando) { A.msg = 'AULLANDO NO LE HACES NADA'; A.msgT = 1.2; }
    else if (A.rechazos++ < 3) { A.msg = 'SE CUBRE: PARA SU TAJO Y PEGA'; A.msgT = 1.6; }
  } else if (e.tipo === 'corro') {
    cam.shake(3, 0.2); vibrate(12); SFX.explode();
    burst(ex, e.y - 80, 20, { rnd: Math.random, colors: [PE.fuego1, PE.fuego2, PE.fuego3], speed: 300, life: 0.5, size: 4, grav: -40 });
  } else if (e.tipo === 'golpe' || e.tipo === 'quema') {
    A.golpes++;
    duele(S);
    const atk = e.rastrero ? 'rastrero' : e.enemigo && e.enemigo.atk;
    // Los que se SALTAN lo dicen siempre (no es lo que se espera de un zarpazo
    // ni de un fuego); los demas, solo si le rompen la guardia.
    if (atk === 'barre' || atk === 'rastrero') {
      A.msg = atk === 'barre' ? 'SALTA EL BARRIDO' : 'SALTA EL FUEGO'; A.msgT = 1.2;
    } else if (atk === 'picado' || atk === 'relampago') {
      A.msg = atk === 'picado' ? 'ESQUIVA: SAL DE SU SOMBRA' : 'SALTA EL RELAMPAGO'; A.msgT = 1.3;
    } else if (atk === 'levanta' && e.aire) {
      A.msg = 'ESE SE PARA CON LA GUARDIA'; A.msgT = 1.3;
    } else if (e.r === 'rota') {
      A.msg = atk === 'acomete' ? 'ESQUIVALO' : atk === 'corro' ? 'APARTATE DEL FUEGO' : 'GUARDIA ROTA';
      A.msgT = 1.2;
    }
  } else if (e.tipo === 'parada' || e.tipo === 'devuelto') {
    // LA PARADA: el golpe rebota; con la bola, se la devuelve
    A.hitstop = 9 / 60; cam.shake(4, 0.14); SFX.clang(); vibrate(26);
    A.msg = e.tipo === 'devuelto' ? 'DEVUELTA!' : e.aturde ? 'PARADA! ESTA ATURDIDO' : 'PARADA!'; A.msgT = e.aturde ? 1.3 : 0.9;
    FX.para(A.fx, K.x + K.dir * 44, K.y - 110);
    burst(K.x - A.N.camX + K.dir * 44, K.y - 110, 18, { rnd: Math.random, colors: [ORO, BLANCO, '#ffffff'], speed: 320, life: 0.5, size: 4, grav: 120 });
  } else if (e.tipo === 'bloqueo' || e.tipo === 'apagado') {
    A.hitstop = 4 / 60; cam.shake(2.5, 0.1); SFX.clang(); vibrate(14);
    FX.bloquea(A.fx, K.x + K.dir * 40, K.y - 110, K.dir);
    const col = e.tipo === 'apagado' ? [PE.fuego1, PE.fuego3] : ['#d4dcf0', '#8a97b8'];
    burst(K.x - A.N.camX + K.dir * 40, K.y - 110, 10, { rnd: Math.random, colors: col, speed: 220, life: 0.35, size: 3, grav: 300 });
  } else if (e.tipo === 'tajo') {
    // ELLA LE DA: congelacion segun el golpe, y su color saltando
    const E = e.enemigo;
    A.hitstop = (e.contra ? 11 : e.fuerte ? 8 : 5) / 60;
    cam.shake(e.contra ? 6 : e.fuerte ? 4 : 3, 0.12);
    SFX.corta(); vibrate(e.fuerte || e.contra ? 22 : 14);
    FX.acierta(A.fx, E.x - K.dir * 12, e.y, K.dir, e.contra ? 3 : e.fuerte ? 2 : K.combo);
    const cols = E.tipo === 'lobo' ? [PE.lobo1, PE.lobo2, PE.sangre] : E.tipo === 'kitsune' ? [PE.kitsune1, PE.kitsune2, PE.fuego1]
      : E.tipo === 'alfa' ? [PE.alfa1, PE.alfa2, PE.sangre] : [PE.tengu1, PE.tengu2, PE.pluma];
    burst(ex, e.y, e.muere ? 26 : 14, { rnd: Math.random, colors: cols, speed: e.muere ? 340 : 260, life: 0.5, size: 4, grav: 620 });
    if (e.contra) {
      A.msg = 'CONTRAATAQUE'; A.msgT = 0.8;
      burst(ex, e.y, 14, { rnd: Math.random, colors: [ORO, BLANCO], speed: 340, life: 0.5, size: 4, grav: 200 });
    }
    if (e.muere) { SFX.explode(); FX.muerte(A.fx, E.x + K.dir * 22, E.y, E.tipo); }
  } else if (e.tipo === 'quemado') {
    SFX.corta(); cam.shake(3, 0.12);
    burst(ex, e.y, 18, { rnd: Math.random, colors: [ORO, PE.fuego1, PE.fuego3], speed: 300, life: 0.5, size: 4, grav: 200 });
  }
}

// Le entra un golpe: congelacion, temblor, sonido y el rojo de su falda.
function duele(S) {
  const K = S.K, A = S.av;
  FX.herida(A.fx);
  A.hitstop = 7 / 60; cam.shake(5, 0.16); SFX.hurt(); vibrate(34);
  burst(K.x - A.N.camX, K.y - 90, 12, { rnd: Math.random, colors: ['#c41c5a', '#ef4a84'], speed: 240, life: 0.45, size: 4, grav: 500 });
}

function termina(S, gano) {
  const A = S.av;
  // Una partida se acaba UNA vez (la musica, la nota, el resultado).
  if (A.acabada) return;
  A.acabada = true;
  A.fase = 'final'; A.faseT = 0; A.gano = gano;
  if (gano) { S.K.iframe = 1e9; SFX.record(); vibrate(30); playMusic(SONGS.caballeroVictoria); }
  else { playMusic(SONGS.caballeroDerrota); }
}

// LA NOTA de la aventura: por lo que le ha costado llegar, no por el tiempo
// (el tiempo se guarda aparte, como mejor marca).
function cierra(S) {
  const A = S.av, K = S.K;
  const perdidos = K.hpMax - Math.max(0, K.hp);
  const nota = !A.gano ? null : perdidos === 0 ? 'S' : perdidos <= 1 ? 'A' : perdidos <= 2 ? 'B' : 'C';
  const guardado = Save.dato(GUARDADO, { hecho: false, mejorT: 0, notas: {} });
  let recordT = false;
  if (A.gano) {
    guardado.hecho = true;
    if (!A.desdeHoguera && (!guardado.mejorT || A.tJuego < guardado.mejorT)) { guardado.mejorT = A.tJuego; recordT = true; }
    const orden = ['C', 'B', 'A', 'S'];
    const antes = guardado.notas[S.dif];
    if (!antes || orden.indexOf(nota) > orden.indexOf(antes)) guardado.notas[S.dif] = nota;
    Save.guarda(GUARDADO, guardado);
  }
  A.res = { gano: A.gano, t: A.tJuego, vida: Math.max(0, K.hp), vidaMax: K.hpMax, caidas: A.caidas,
            // (los lobos de la manada que el jefe no llego a llamar no cuentan)
            vencidos: A.N.vencidos, enemigos: A.N.enemigos.filter(E => !E.oculto).length,
            nota, recordT, mejorT: guardado.mejorT, hoguera: A.N.hoguera, desdeHoguera: A.desdeHoguera };
  if (recordT) SFX.record();
  A.fase = 'resultado'; A.faseT = 0; A.sello = false;
}

// ---------------------------------------------------------------- input
export function input(S, ev) {
  const A = S.av;
  if (A.fase === 'entrada') {
    if (ev.type === 'down' && A.faseT > 0.3) empiezaJuego(S);
    return;
  }
  if (A.fase === 'resultado') {
    if (ev.type !== 'down' || A.faseT < 0.9) return;
    if (S.bOtra.hit(ev)) {
      S.pulsos.otra = 1; SFX.select();
      // Si perdio despues de la hoguera, OTRA VEZ sigue desde ella.
      empieza(S, !A.res.gano && A.res.hoguera);
    } else if (S.bDif.hit(ev)) {
      S.pulsos.dificultad = 1; SFX.select();
      S.nueva(); S.fase = 'elige'; S.faseT = 0; playMusic(SONGS.caballero);
    } else if (S.bMenu.hit(ev)) { SFX.blip(); S.ctx.toMenu(); }
    return;
  }
  if (A.fase !== 'juego') { S.sueltaMandos(ev); return; }
  S.mandos(ev);
}

// ---------------------------------------------------------------- draw
export function draw(S, g) {
  const A = S.av, K = S.K, L = A.N;
  const cx = Math.round(L.camX);
  drawBosque(g, L, cx, VW, ALTO, A.t);
  drawHoguera(g, L, cx, A.t);
  drawSombrasRamas(g, L, cx);
  drawTroncos(g, L, cx);
  // Los enemigos, por detras de ella (ella queda delante, mas cerca).
  for (const E of L.enemigos) drawEnemigo(g, E, cx, A.t);

  // Lo que los efectos dejan en el suelo y las copias de la esquiva.
  FX.drawDetras(g, A.fx, cx);
  // Su sombra, sobre lo que tenga debajo (sobre un foso, ninguna).
  const bajo = C.sueloBajo(K.x, K.y, N.mundo(L));
  if (bajo !== Infinity) {
    const altura = bajo - K.y;
    sombra(g, K.x - cx, bajo - 2, Math.max(13, 30 - altura * 0.075), Math.max(2.5, 7 - altura * 0.018),
           Math.max(0.12, 0.42 - altura * 0.0019));
  }
  // Ella (como en la pelea: destello blanco al recibir, parpadeo invulnerable).
  let [p, f] = C.pose(K);
  if (A.gano && A.fase !== 'juego' && K.vivo && K.enSuelo && K.st === C.QUIETO) { p = 'atk'; f = 5; }
  const desde = K.vivo ? K.t - K.hurtIni : K.muereT;
  const blanco = (K.st === C.DOLOR || K.st === C.MUERTO) ? Math.max(0, 1 - desde / 0.1) : 0;
  const parpadea = A.fase === 'juego' && !blanco && K.iframe > 0 && K.iframe < 1e8 && (((K.iframe * 14) | 0) & 1);
  const [ex, ey] = FX.escala(A.fx);
  if (!parpadea) drawRomina(g, K.x - cx, K.y, K.dir, p, f, 0, blanco, K.dir, ex, ey);
  FX.drawGuardia(g, K, cx, A.t, K.bloqT >= C.BLOQ_SUBE && K.bloqT < C.BLOQ_SUBE + K.paradaVent);

  drawRamas(g, L, cx, A.t);
  // Las bolas de fuego, por delante de todo: le vienen a ella.
  for (const F of L.fuegos) drawFuego(g, F, cx);
  // Los cortes, las estrellas y las chispas de los efectos.
  FX.drawDelante(g, A.fx, cx);
  if (A.fase === 'juego' || A.fase === 'final') FX.drawPantalla(g, A.fx, VW, ALTO);

  // El fundido de la caida (se oscurece mientras cae y se aclara al volver).
  const oscuro = A.fase === 'cae' ? Math.min(1, Math.max(0, (A.faseT - 0.25) / 0.5)) : A.funde;
  if (oscuro > 0) { g.globalAlpha = oscuro; g.fillStyle = '#000000'; g.fillRect(0, 0, VW, ALTO); g.globalAlpha = 1; }

  if (A.fase === 'juego' || A.fase === 'cae' || A.fase === 'final') drawHud(S, g);
  if (A.fase === 'juego') S.drawControles(g);
  if (A.fase === 'entrada') drawEntrada(S, g);
  else if (A.fase === 'final') drawFinal(S, g);
  else if (A.fase === 'resultado') drawResultado(S, g);
}

function drawHud(S, g) {
  const A = S.av, K = S.K, L = A.N;
  g.globalAlpha = 0.45; g.fillStyle = '#1a2014'; g.fillRect(0, 0, VW, 56); g.globalAlpha = 1;
  for (let i = 0; i < K.hpMax; i++) corazon(g, 14 + i * 30, 12, i < K.hp);
  // EL CAMINO: una linea con la hoguera, el arbol del final y ella encima. Es
  // lo que dice cuanto falta, que en un nivel largo es lo que se pregunta. A
  // la izquierda, junto a los corazones: en el centro la tapaba la pausa.
  const bw = 300, bx = 14 + K.hpMax * 30 + 30, by = 22, fin = L.def.salida;
  g.fillStyle = '#10140c'; g.fillRect(bx - 3, by - 3, bw + 6, 10);
  g.fillStyle = '#4c5f40'; g.fillRect(bx, by, bw, 4);
  const u = Math.max(0, Math.min(1, K.x / fin));
  g.fillStyle = '#adaa6d'; g.fillRect(bx, by, Math.round(bw * u), 4);
  for (const [a, b] of L.def.fosos) { g.fillStyle = '#0b0907'; g.fillRect(bx + Math.round(bw * a / fin), by, Math.max(2, Math.round(bw * (b - a) / fin)), 4); }
  for (const h of L.def.hogueras) {
    const hx = bx + Math.round(bw * h / fin);
    g.fillStyle = h <= L.hoguera ? '#ff9628' : '#6a6a60'; g.fillRect(hx - 3, by - 8, 6, 8);
  }
  g.fillStyle = '#6a8a4a'; g.fillRect(bx + bw - 4, by - 12, 8, 12);
  g.fillStyle = ROSA; g.fillRect(bx + Math.round(bw * u) - 4, by - 6, 8, 8);
  g.fillStyle = BLANCO; g.fillRect(bx + Math.round(bw * u) - 2, by - 4, 4, 4);
  text(g, L.def.nombre, bx, by + 14, '#c8d8b0', 2);
  // EL JEFE, en cuanto aulla: su nombre y su vida, a la derecha (la pausa
  // esta en el centro).
  const J = N.jefeVivo(L);
  if (J && J.aullidos > 0) {
    const jw = 220, jx = VW - 110 - jw, jy = 22;
    g.fillStyle = '#10140c'; g.fillRect(jx - 3, jy - 3, jw + 6, 12);
    g.fillStyle = '#3a2030'; g.fillRect(jx, jy, jw, 6);
    g.fillStyle = '#e83a5a'; g.fillRect(jx, jy, Math.round(jw * J.hp / J.hpMax), 6);
    text(g, 'EL LOBO BLANCO', jx, jy + 14, '#f0e8d8', 2);
  }
  const s = P.DIFICULTADES[S.dif].nombre + '   ' + reloj(A.tJuego);
  text(g, s, VW - 14 - measure(s, 2), 36, '#c8d8b0', 2);
  if (A.msgT > 0 && A.fase === 'juego') {
    g.globalAlpha = Math.min(1, A.msgT * 3);
    textCenter(g, A.msg, VW / 2, 84, ORO, 4);
    g.globalAlpha = 1;
  }
  if (S.comboT > 0 && S.combo > 1) {
    g.globalAlpha = Math.min(1, S.comboT * 4);
    textCenter(g, 'x' + S.combo, VW / 2, 130, S.combo === 3 ? ORO : '#ff8fbc', 5);
    g.globalAlpha = 1;
  }
}

function drawEntrada(S, g) {
  const t = S.av.faseT;
  const b = Math.round(64 * Math.max(0, Math.min(1, t / 0.3, (ENTRADA_T - t) / 0.3)));
  g.fillStyle = '#000000'; g.fillRect(0, 0, VW, b); g.fillRect(0, ALTO - b, VW, b);
  if (t > 0.2 && t < ENTRADA_T - 0.1) {
    g.globalAlpha = Math.min(1, (t - 0.2) / 0.3, (ENTRADA_T - 0.1 - t) / 0.3);
    BT.rotulo(g, S.av.desdeHoguera ? 'DESDE LA HOGUERA' : 'NIVEL 1', VW / 2, 110, '#c8d8b0', 3);
    BT.rotulo(g, N.BOSQUE.nombre, VW / 2, 146, ORO, 8);
    BT.rotulo(g, 'LLEGA AL ARBOL DEL FINAL', VW / 2, 230, BLANCO, 2);
    g.globalAlpha = 1;
  }
  if (t > 0.3) {
    g.globalAlpha = 0.6;
    textCenter(g, 'TOCA PARA EMPEZAR YA', VW / 2, ALTO - 44, '#ffffff', 2);
    g.globalAlpha = 1;
  }
}

function drawFinal(S, g) {
  const t = S.av.faseT;
  if (t < 0.3) return;
  g.globalAlpha = Math.min(1, (t - 0.3) / 0.3);
  if (S.av.gano) BT.rotulo(g, 'SALISTE DEL BOSQUE', VW / 2, 150, ORO, 6);
  else BT.rotulo(g, 'EL BOSQUE TE HA PODIDO', VW / 2, 150, ROSA, 6);
  g.globalAlpha = 1;
}

function drawResultado(S, g) {
  const A = S.av, R = A.res, t = A.faseT;
  if (!R) return;
  g.globalAlpha = Math.min(0.6, t * 2); g.fillStyle = '#0a0d08'; g.fillRect(0, 0, VW, ALTO); g.globalAlpha = 1;
  BT.marco(g, 250, 30, 700, 400);
  BT.rotulo(g, R.gano ? 'BOSQUE SUPERADO' : 'TE HA PODIDO', VW / 2, 50, R.gano ? ORO : ROSA, 5);
  textCenter(g, 'DIFICULTAD ' + P.DIFICULTADES[S.dif].nombre, VW / 2, 98, '#c8b8ff', 2);
  if (R.gano && t > 0.45) {
    const u = Math.min(1, (t - 0.45) / 0.25);
    if (u >= 1 && !A.sello) { A.sello = true; cam.shake(4, 0.12); SFX.clang(); vibrate(20); }
    BT.nota(g, S.H, R.nota, 400, 226, 1 + (1 - u) * 1.6);
  } else if (!R.gano) {
    textCenter(g, R.hoguera ? 'LA HOGUERA TE ESPERA' : 'VUELVE A INTENTARLO', 400, 200, '#e8d8e8', 2);
  }
  const fila = (y, et, val) => {
    text(g, et, 530, y, '#ffd76a', 3);
    if (val !== null) text(g, val, 910 - measure(val, 3), y, '#ffffff', 3);
  };
  fila(140, 'TIEMPO', reloj(R.t));
  fila(184, 'VIDA', null);
  const ancho = R.vidaMax * 28 - 6;
  for (let k = 0; k < R.vidaMax; k++) corazon(g, 910 - ancho + k * 28, 184, k < R.vida);
  fila(228, 'ENEMIGOS', R.vencidos + '/' + R.enemigos);
  fila(272, 'CAIDAS', String(R.caidas));
  if (R.mejorT) fila(316, 'MEJOR TIEMPO', reloj(R.mejorT));
  if (t > 1.0 && R.recordT) {
    const col = Math.sin(A.t * 8) > 0 ? '#ffe14d' : '#ff5c9d';
    BT.rotulo(g, 'MEJOR TIEMPO NUEVO!', VW / 2, 366, col, 3);
  } else if (t > 1.0 && R.gano && R.desdeHoguera) {
    textCenter(g, 'DESDE LA HOGUERA NO CUENTA EL TIEMPO', VW / 2, 372, '#8a7ab8', 2);
  }
  if (t > 0.9) {
    BT.boton(g, S.H, 'dificultad', S.bDif, { pulso: S.pulsos.dificultad, nombre: 'ELEGIR' });
    BT.boton(g, S.H, 'otra', S.bOtra, { pulso: S.pulsos.otra, nombre: !R.gano && R.hoguera ? 'DESDE LA HOGUERA' : 'OTRA VEZ',
      brillo: 0.4 + 0.3 * Math.sin(A.t * 5) });
    BT.boton(g, S.H, 'menu', S.bMenu, { pulso: S.pulsos.menu, nombre: 'MENU' });
  }
}

// Un corazon de pixel: lleno (rojo con brillo) o vacio. (El mismo de la pelea.)
function corazon(g, hx, hy, lleno) {
  g.fillStyle = lleno ? '#c41c5a' : '#3a2030';
  g.fillRect(hx + 4, hy, 14, 6); g.fillRect(hx, hy + 4, 22, 8);
  g.fillRect(hx + 3, hy + 12, 16, 4); g.fillRect(hx + 7, hy + 16, 8, 4);
  if (lleno) { g.fillStyle = '#ff8fbc'; g.fillRect(hx + 4, hy + 2, 5, 5); }
}

function reloj(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}
