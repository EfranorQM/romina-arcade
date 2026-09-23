// ROMINA - la pelea contra el ogro, en el salon del castillo.
//
// Se juega de LADO. Pulgar izquierdo = mover. Cuatro botones a la derecha:
// ATACAR (el grande), SALTAR, ESQUIVAR y GUARDIA (que se mantiene). Cada uno
// es la respuesta a un ataque del ogro: la guardia para el garrotazo (y a
// tiempo es una PARADA que da CONTRAATAQUE), el salto libra la onda del
// pisoton y la esquiva, el barrido y la embestida. Se dibujan en
// caba-botones.js.
//
// LA PARTIDA tiene cinco fases (this.fase):
//   elige      la dificultad (paseo, normal, furia), sobre el salon quieto
//   entrada    ella llega corriendo, el cartel ROMINA contra EL OGRO, el ogro
//              ruge y A PELEAR. Se salta tocando la pantalla.
//   pelea      la pelea. La primera vez ENSEÑA: el ogro suelta sus ataques de
//              uno en uno, el primero de cada tipo a camara lenta y con su
//              consejo (el maestro, en caba-partida.js)
//   final      el golpe que la acaba, a camara lenta, y su cartel
//   resultado  la nota, los puntos y el record; OTRA VEZ, DIFICULTAD o MENU
//   armario    (desde elegir) el traje: colores de capa, falda y estela que se
//              ganan con las MEDALLAS (ver caba-partida.js)
// Hasta aqui la pelea empezaba de golpe y se reiniciaba sola a los 3 s: sin
// principio, sin final y sin record. La dificultad elegida y lo aprendido se
// guardan (Save.dato), y los puntos van al record del menu.
//
// Aqui solo se arbitra: la fisica de ella esta en caba-cuerpo.js, la del ogro
// en ogro-cuerpo.js, la de la arena (repisas, cascotes, escombros) en
// caba-arena.js y la de la partida en caba-partida.js, las cuatro sin DOM y con
// su arnes en tools/. Lo que se ve sale de romi-sprite.js, ogro-sprite.js,
// arena-sprite.js y caba-botones.js.

import { VW, cam, Save, MENSAJES_RECORD } from '../core.js';
import { burst, particles } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX, SONGS, playMusic } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';
import * as C from './caba-cuerpo.js';
import * as P from './caba-partida.js';
import { drawRomina, vestir, P as PR } from './romi-sprite.js';
import * as BT from './caba-botones.js';
import * as AR from './caba-arena.js';
import { drawSalon, drawRepisas, drawEscombros, drawSombrasPiedras, drawPiedras, P as PA } from './arena-sprite.js';
import * as OG from './ogro-cuerpo.js';
import { bakeOgro, drawOgro, poseOgro, pisadaOgro, vueloOgro, P as POG } from './ogro-sprite.js';
import * as AV from './caba-aventura.js';
import * as NV from './caba-nivel.js';
import { drawBosque } from './bosque-sprite.js';

// La paleta de la INTERFAZ (botones, textos, corazones, chispas del acero).
// Es la de la Romina de antes, que se borro con su codigo: el rosa se quedo
// porque es el color del juego en el menu, no el de su ropa.
const PC = {
  ves1: '#8e1140', ves2: '#c41c5a', ves3: '#ef4a84', ves4: '#ff8fbc',
  bla2: '#fff4fa', oro3: '#ffe066',
  ace1: '#4a5570', ace2: '#8a97b8', ace3: '#d4dcf0', ace4: '#ffffff',
};

const SUELO = C.SUELO;
const ALTO = 540;
const NADA = { dx: 0, salta: false, golpea: false, esquiva: false, saltaAbajo: false, bloquea: false };
// Lo que dura cada cosa de la partida, en segundos de reloj (no de pelea).
const ENTRADA_T = 2.6, FINAL_T = 2.6;
// La camara lenta: la del primer aviso de cada ataque (la pelea que enseña) y
// la del golpe final.
const LENTO_LECCION = 0.35, LENTO_FINAL = 0.3;

export default {
  meta: {
    id: 'caballero', title: 'ROMINA', tag: 'CONTRA EL OGRO',
    colors: ['#ef4a84', '#ffe066'],
    // Apaisado y GRANDE: 1200x540. Ella y el salon son pixel art pintado a x2;
    // el ogro es un dibujo pintado a mano, reducido y puesto a 1:1.
    // Sin meta.smooth: es pixel art, tiene que quedar nitido.
    vw: 1200, vh: 540, wide: true,
    pausaY: 2,
  },

  init(ctx, args) {
    this.ctx = ctx;
    this.stick = new Stick(80, 14);
    // Cuatro botones en la esquina de abajo a la derecha, en el mismo sitio
    // que los de antes (medidos para el pulgar). Los radios son de DIBUJO; el
    // area de toque es r+pad. GUARDIA es el unico que se mantiene apretado;
    // los otros tres son toques.
    this.bSalta = new Button(1096, 300, 34, 20);
    this.bAtaca = new Button(1132, 428, 40, 20);
    this.bEsquiva = new Button(1016, 452, 32, 20);
    this.bGuardia = new Button(1016, 336, 32, 20);
    // Los tres del resultado, debajo del panel.
    this.bOtra = new Button(600, 474, 40, 14);
    this.bDif = new Button(452, 480, 32, 14);
    this.bMenu = new Button(748, 480, 32, 14);
    // El ARMARIO (en la pantalla de elegir) y LISTO (para salir de el).
    this.bArmario = new Button(96, 470, 32, 14);
    this.bListo = new Button(1104, 474, 36, 14);
    // Los medallones, horneados una vez (ver caba-botones.js).
    this.H = BT.hornea({ atacar: this.bAtaca, saltar: this.bSalta, esquivar: this.bEsquiva, guardia: this.bGuardia,
                         otra: this.bOtra, dificultad: this.bDif, menu: this.bMenu,
                         armario: this.bArmario, listo: this.bListo });
    // El armario: una muestra por prenda, las medallas y el candado.
    this.muestras = {};
    for (const parte of P.PARTES) {
      for (const pr of P.ARMARIO[parte]) this.muestras[parte + '/' + pr.id] = BT.muestra(carasDe(parte, pr));
    }
    this.medallaImg = BT.horneaMedallas();
    this.candado = BT.horneaCandado();
    this.aroElegido = BT.aroElegido(26 + 6);
    this.SO = bakeOgro();

    // La dificultad de la ultima vez, y lo que ya aprendio (la primera pelea
    // enseña, las siguientes ya no).
    const d = Save.dato('caba.dif', 'normal');
    this.dif = P.DIFICULTADES[d] ? d : 'normal';
    this.maestro = P.makeMaestro(Save.dato('caba.lecciones', null));
    // LAS MEDALLAS ganadas y EL TRAJE puesto (solo con prendas ganadas).
    this.medallas = Save.dato('caba.medallas', []);
    this.traje = P.trajeValido(Save.dato('caba.traje', null), this.medallas);
    vestir(P.tintesDe(this.traje));
    this.armarioNuevo = false;     // hay prendas ganadas que aun no ha visto
    // EL MODO: la AVENTURA (niveles que avanzan, caba-aventura.js) o la pelea
    // contra el ogro. Se recuerda, como la dificultad.
    this.modo = Save.dato('caba.modo', 'pelea') === 'aventura' ? 'aventura' : 'pelea';
    this.vistaBosque = NV.makeNivel(NV.BOSQUE);
    this.av = null;

    this.nueva();
    this.fase = 'elige'; this.faseT = 0;
  },

  // Una pelea nueva, en la dificultad elegida: ella, el ogro (con los ataques
  // que el maestro le deja usar) y el salon limpio. El ogro no decide nada
  // hasta el A PELEAR.
  nueva() {
    this.K = C.makeCaballero(160, P.opcionesElla(this.dif));
    this.O = OG.makeOgro(880, P.opcionesOgro(this.dif, P.permitidos(this.maestro)));
    this.O.esperaT = 999;
    // LA ARENA: el salon del castillo, con sus repisas, y los cascotes que
    // hace caer el pisoton (ver caba-arena.js).
    this.A = AR.makeArena();
    this.salta = false; this.golpea = false; this.esquiva = false;
    this.pulsos = { atacar: 0, saltar: 0, esquivar: 0, guardia: 0, otra: 0, dificultad: 0, menu: 0, armario: 0, listo: 0 };
    this.aviso = ''; this.avisoT = 0;
    this.camX = 0;
    this.t = 0; this.hitstop = 0;
    this.msg = ''; this.msgT = 0;
    this.combo = 0; this.comboT = 0;
    this.flashO = 0;          // el destello blanco del ogro al recibir un tajo
    this.chispa = 0;          // la estrella de oro de la PARADA
    this.destello = 0;        // el fogonazo blanco del golpe que lo tumba
    this.grietas = [];        // las marcas que deja el pisoton en el suelo
    // Lo que se cuenta para la nota.
    this.tPelea = 0; this.paradas = 0; this.contras = 0;
    this.paredes = 0; this.usoGuardia = false;     // para las medallas
    this.golpes = 0; this.saltos = 0; this.esquivas = 0;
    // La pelea que enseña: el consejo que se ve, y si va a camara lenta.
    this.leccion = null; this.leccionT = 0; this.lento = false;
    this.maestro.vistas = {}; this.maestro.actual = null;
    // El final.
    this.gano = false; this.res = null;
    this.stVisto = undefined; this.atkVisto = undefined;
    this.rugido = false; this.grito = false; this.sonoFinal = false; this.rugioVictoria = false;
  },

  // Empezar a pelear: una pelea nueva y su entrada.
  comenzar() {
    this.nueva();
    this.K.x = 70;                 // llega corriendo desde la izquierda
    this.fase = 'entrada'; this.faseT = 0;
    playMusic(SONGS.caballero);    // la marcha de antes de la pelea
  },

  update(dt, ctx) {
    this.faseT += dt;
    this.t += dt;
    for (const k in this.pulsos) if (this.pulsos[k] > 0) this.pulsos[k] -= dt / 0.25;
    if (this.destello > 0) this.destello -= dt;
    if (this.avisoT > 0) this.avisoT -= dt;
    if (this.fase === 'aventura') { AV.update(this, dt); return; }
    if (this.fase === 'elige' || this.fase === 'resultado' || this.fase === 'armario') { this.quietos(dt); return; }
    if (this.fase === 'entrada') { this.entrada(dt); return; }
    // LA PELEA y el FINAL: el mundo, a camara lenta si toca.
    let w = dt;
    if (this.lento) w *= LENTO_LECCION;
    if (this.fase === 'final' && this.faseT < 1.1) w *= LENTO_FINAL;
    this.pelea(w);
    if (this.fase === 'final') this.final();
  },

  // Mientras se elige o se lee la nota: los dos respiran en su sitio (y si ella
  // cayo, se queda de rodillas; si cayo el ogro, se queda tumbado).
  quietos(dt) {
    const K = this.K, O = this.O;
    C.stepCaballero(K, NADA, dt, AR.mundo(this.A));
    OG.stepOgro(O, K, dt);
    if (O.st === OG.ESPERA || O.st === OG.ANDA) { O.st = OG.ESPERA; O.esperaT = 999; }
    if (this.msgT > 0) this.msgT -= dt;
  },

  // LA ENTRADA: ella llega corriendo, el cartel, el ogro ruge y A PELEAR.
  entrada(dt) {
    const K = this.K, O = this.O, t = this.faseT;
    C.stepCaballero(K, { ...NADA, dx: K.x < 170 ? 1 : 0 }, dt, AR.mundo(this.A));
    // El reloj del ogro corre para sus poses, pero todavia no decide nada.
    O.t += dt; O.animT += dt;
    if (!this.rugido && t >= 0.9) {
      this.rugido = true;
      O.st = OG.RUGE; O.t = 0; O.dir = -1;
      cam.shakeDecay(6, 0.9); vibrate(30); SFX.explode();
      burst(O.x, SUELO - 150, 18, { rnd: Math.random, colors: [POG.ojo, POG.dien],
                                    speed: 220, life: 0.6, size: 4, grav: -60 });
    }
    if (O.st === OG.RUGE && O.t >= OG.RUGE_T) { O.st = OG.ESPERA; O.t = 0; }
    if (!this.grito && t >= 2.1) { this.grito = true; playMusic(SONGS.caballeroPelea); SFX.espadazo(); }
    if (t >= ENTRADA_T) this.empiezaPelea();
  },

  empiezaPelea() {
    const O = this.O;
    if (O.st === OG.RUGE) { O.st = OG.ESPERA; O.t = 0; }
    O.esperaT = 0.8 * O.pausa;     // un respiro antes del primer ataque
    if (this.K.x < 170) this.K.x = 170;
    this.fase = 'pelea'; this.faseT = 0;
    if (!this.grito) { this.grito = true; playMusic(SONGS.caballeroPelea); }
  },

  // EL FINAL: el golpe que lo acaba se ve a camara lenta; luego su musica, y si
  // perdio, el ogro ruge sobre ella. A los 2.6 s, la nota.
  final() {
    const O = this.O, t = this.faseT;
    if (!this.sonoFinal && t >= 0.8) {
      this.sonoFinal = true;
      playMusic(this.gano ? SONGS.caballeroVictoria : SONGS.caballeroDerrota);
    }
    if (!this.gano) {
      if (!this.rugioVictoria && O.st !== OG.ATACA && t > 0.9) {
        this.rugioVictoria = true; O.st = OG.RUGE; O.t = 0; O.vx = 0; cam.shakeDecay(4, 0.6);
      }
      if (O.st === OG.ESPERA || O.st === OG.ANDA) { O.st = OG.ESPERA; O.esperaT = 999; }
    }
    if (t >= FINAL_T) this.cierra();
  },

  termina(gano) {
    this.fase = 'final'; this.faseT = 0; this.gano = gano;
    this.lento = false; this.leccion = null;
    if (gano) {
      cam.shakeDecay(6, 0.9); this.destello = 0.3;
      // Ya no la toca nada: ni un cascote que venga cayendo.
      this.K.iframe = 1e9;
    }
    if (this.maestro.actual) P.acaba(this.maestro);
    this.guardaLecciones();
  },

  // LA NOTA: se puntua, se guarda el record y se enseña.
  cierra() {
    const K = this.K, O = this.O;
    const r = { gano: this.gano, t: this.tPelea, vida: Math.max(0, K.hp), vidaMax: K.hpMax,
                paradas: this.paradas, contras: this.contras,
                dano: O.hpMax - Math.max(0, O.hp), ogroHp: O.hpMax };
    const p = P.puntua(r, this.dif);
    const record = Save.submit('caballero', p.puntos);
    // LAS MEDALLAS de esta pelea: las que no tenia se guardan y se anuncian.
    const conseguidas = P.medallasDe({ ...r, nota: p.nota, paredes: this.paredes, usoGuardia: this.usoGuardia,
                                       dif: this.dif, alumna: !P.lecciona(this.maestro), aprendio: !!O.contra });
    const nuevas = conseguidas.filter(id => !this.medallas.includes(id));
    if (nuevas.length) {
      this.medallas = this.medallas.concat(nuevas);
      Save.guarda('caba.medallas', this.medallas);
      this.armarioNuevo = true;
    }
    // Al romper el record, los mensajitos del arcade; si no, el de la pelea.
    const lista = record ? MENSAJES_RECORD : this.gano ? P.FRASES[p.nota] : P.FRASES.pierde;
    this.res = { ...r, ...p, record, mejor: Save.best('caballero'), nuevas,
                 frase: lista[(Math.random() * lista.length) | 0].join(' ') };
    this.avisoOido = -1;
    if (record) SFX.record();
    this.selloOido = false;
    this.fase = 'resultado'; this.faseT = 0;
  },

  guardaLecciones() {
    const M = this.maestro;
    if (M.cambios) { Save.guarda('caba.lecciones', P.paraGuardar(M)); M.cambios = false; }
  },

  // EL OGRO EMPIEZA UN ATAQUE: si le queda que aprender, el consejo (y la
  // primera vez, camara lenta durante el aviso).
  empiezaAtaque(atk) {
    const M = this.maestro;
    if (M.actual) this.acabaAtaque();
    const e = P.empieza(M, atk);
    if (e) {
      this.leccion = e.leccion; this.leccionT = Infinity;
      if (e.lento) this.lento = true;
    }
  },
  // ...y lo acaba (con sus ondas ya idas): ¿lo contesto bien?
  acabaAtaque() {
    const M = this.maestro;
    const L = P.acaba(M);
    if (L) { this.msg = 'ASI SE HACE!'; this.msgT = 1.2; SFX.acierto(); }
    // (El cartel de lo que el ogro aprendio no se acorta: no es una leccion.)
    if (this.leccion && this.leccion.atk !== undefined) this.leccionT = Math.min(this.leccionT, 0.9);
    this.O.permitidos = P.permitidos(M);
    this.guardaLecciones();
  },

  // Un paso de la pelea (tambien del final, sin mandos).
  pelea(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    const activo = this.fase === 'pelea';
    if (activo) this.tPelea += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.leccionT !== Infinity && this.leccionT > 0) { this.leccionT -= dt; if (this.leccionT <= 0) this.leccion = null; }
    // Despues del hitstop a proposito: el destello dura TODA la congelacion
    // del golpe y se apaga cuando el mundo vuelve a moverse.
    if (this.flashO > 0) this.flashO -= dt;
    if (this.chispa > 0) this.chispa -= dt;

    const K = this.K, Mae = this.maestro;
    const inp = activo ? {
      dx: this.stick.dx,
      salta: this.salta, saltaAbajo: this.bSalta.pressed,
      golpea: this.golpea, esquiva: this.esquiva, bloquea: this.bGuardia.pressed,
    } : NADA;
    const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId;
    const antesCd = K.esqCd;
    this.salta = false; this.golpea = false; this.esquiva = false;

    const M = AR.mundo(this.A);
    C.stepCaballero(K, inp, dt, M);
    if (activo && K.st === C.BLOQUEA) this.usoGuardia = true;

    // --- Sonidos y efectos de lo que acaba de pasar ---
    // Cada golpe del combo suena distinto: el tercero (el giro) mas grave y
    // con temblor. Si los tres sonaran igual, el combo no se oiria como combo.
    if (K.tajoId !== antesTajo) {
      const n = C.golpeCombo(K);
      SFX.espadazo();
      this.golpes++;
      if (K.contra) {
        // EL CONTRAATAQUE: sale en oro, no cuenta como combo.
        this.combo = 0; this.comboT = 0;
        this.msg = 'CONTRAATAQUE'; this.msgT = 0.8;
        cam.shake(3, 0.1); vibrate(16);
        burst(K.x + K.dir * 30, K.y - 90, 12, { rnd: Math.random, colors: [PC.oro3, PC.bla2],
                                              speed: 220, life: 0.4, size: 4, grav: 120 });
      } else {
        this.combo = n + 1;
        this.comboT = 1.0;
        if (n === 2) { cam.shake(2.5, 0.1); vibrate(12); }
        else vibrate(5);
      }
    }
    // ESQUIVAR vuelve a estar listo: el boton lo dice con su aro.
    if (antesCd > 0 && K.esqCd <= 0) this.pulsos.esquivar = 1;
    // El polvo sale de DONDE PISA (el suelo, una repisa o un escombro), no
    // siempre de la linea del suelo.
    if (!antesSuelo && K.enSuelo) {
      // Aterrizaje: polvo y un temblor chiquito
      burst(K.x, K.y, 9, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2], speed: 120, life: 0.32, size: 4, grav: 520 });
      SFX.aterriza(); cam.shake(1.5, 0.08);
    }
    if (antesSt !== C.SALTA && K.st === C.SALTA) { SFX.salto(); this.saltos++; vibrate(6); }
    if (antesSt !== C.ESQUIVA && K.st === C.ESQUIVA) {
      SFX.rodar(); this.esquivas++; vibrate(8);
      P.anota(Mae, 'esquiva');
      // Para el ogro que aprende: ¿se fue hacia el o lejos de el?
      if (activo) OG.anotaHabito(this.O, Math.sign(K.esqDir) === Math.sign(this.O.x - K.x) ? 'hacia' : 'atras');
      // el polvo del impulso, del suelo del que despega
      burst(K.x, K.y, 10, { rnd: Math.random, colors: [PA.polvo1, PA.polvo3], speed: 140, life: 0.3, size: 4, grav: 400 });
    }
    // Polvo al correr
    if (K.st === C.CORRE && K.enSuelo && ((this.t * 12) | 0) % 3 === 0) {
      burst(K.x - K.dir * 14, K.y, 1, { rnd: Math.random, colors: [PA.polvo2], speed: 44, life: 0.24, size: 3, grav: 240 });
    }
    if (this.comboT > 0) this.comboT -= dt;

    // ================== EL OGRO ==================
    const O = this.O;
    const ondasAntes = O.ondas.length;
    // Como estaba el ogro la ULTIMA VEZ QUE SE MIRO, no antes de su paso: el
    // rugido (y la parada) los pone el golpe de ella, que va DESPUES en este
    // mismo paso. Con el estado de antes del paso, el cambio no se veia nunca
    // y ni el aviso de FURIA ni su musica salieron jamas.
    const stAntes = this.stVisto !== undefined ? this.stVisto : O.st;
    const atkAntes = this.atkVisto !== undefined ? this.atkVisto : O.atk;

    // EL ORDEN IMPORTA: ella se mueve, luego el ogro, y AL FINAL se arbitra
    // quien toca a quien. Con ella esquivando a 640 px/s un frame de desfase
    // son 11 px: la diferencia entre esquivar y comer el golpe.
    OG.stepOgro(O, K, dt);
    // El cuerpo del ogro es SOLIDO: sin esto ella se mete dentro de la
    // barriga y todas las distancias dejan de significar nada. (Esquivando lo
    // atraviesa: es la respuesta a la embestida. Ver OG.empujaCuerpo.)
    OG.empujaCuerpo(O, K);

    // LA PELEA QUE ENSEÑA: cuando empieza un ataque, el maestro decide si hay
    // consejo; mientras dura, se apunta lo que ella hace; y al acabar (con sus
    // ondas ya idas), si lo aprendio.
    if (activo && O.st === OG.ATACA && (stAntes !== OG.ATACA || O.atk !== atkAntes)) this.empiezaAtaque(O.atk);
    // Una onda que le pasa por DEBAJO: la ha saltado.
    for (const w of O.ondas) {
      if (!w.vivo) continue;
      const lado = Math.sign(w.x - K.x);
      if (w.lado && lado && lado !== w.lado && SUELO - K.y > OG.ONDA_ALTO) {
        P.anota(Mae, 'salta');
        if (activo) OG.anotaHabito(O, 'salto');
      }
      if (lado) w.lado = lado;
    }
    if (Mae.actual && O.st !== OG.ATACA && !O.ondas.some(w => w.vivo)) this.acabaAtaque();
    // La camara lenta del primer aviso dura lo que el aviso.
    if (this.lento && (O.st !== OG.ATACA || O.atkT >= OG.ATAQUES[O.atk][1])) this.lento = false;

    // El pisoton acaba de nacer: temblor, polvo, una grieta en el suelo... y
    // la boveda suelta cascotes. En furia, uno mas.
    if (O.ondas.length > ondasAntes) {
      cam.shakeDecay(7, 0.55); vibrate(28);
      SFX.aterriza();
      this.hitstop = 5 / 60;
      burst(O.x, SUELO, 22, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2, PA.alfom1],
                              speed: 320, life: 0.7, size: 5, grav: 900 });
      this.grietas.push({ x: O.x, w: 70, t: 1 });
      if (this.grietas.length > 6) this.grietas.shift();
      AR.sueltaPiedras(this.A, O, K, Math.random, O.fase >= 3 ? 3 : 2);
    }
    // Las grietas se borran despacio: quedan como memoria de la pelea.
    for (const gr of this.grietas) gr.t -= dt * 0.08;
    while (this.grietas.length && this.grietas[0].t <= 0) this.grietas.shift();

    // El ogro acaba de quedar ABIERTO: se avisa, porque es CUANDO pegar. (Tras
    // una parada no: ahi manda el PARADA! y el CONTRA! del boton.)
    if (activo && O.st === OG.ABIERTO && stAntes !== OG.ABIERTO && O.abiertoPor !== OG.POR_PARADA) {
      this.msg = 'AHORA'; this.msgT = 0.55;
      if (O.abiertoPor === OG.POR_PARED) this.paredes++;
    }
    if (activo && O.st === OG.RUGE && stAntes !== OG.RUGE) {
      cam.shakeDecay(5, 0.7); vibrate(30);
      this.msg = O.fase >= 3 ? 'FURIA' : 'RUGE'; this.msgT = 1.0;
      burst(O.x, SUELO - 150, 18, { rnd: Math.random, colors: [POG.ojo, POG.dien],
                                    speed: 220, life: 0.6, size: 4, grav: -60 });
      // En su furia, la musica se le acelera con el.
      if (O.fase >= 3) playMusic(SONGS.caballeroFuria);
      // Y si ha aprendido algo de ella, se anuncia: una contramedida que no
      // se ve es trampa. El cartel dura lo que el rugido y un poco mas.
      if (O.contra && P.CONTRAS[O.contra]) {
        this.leccion = P.CONTRAS[O.contra]; this.leccionT = 4.5;
        SFX.alarm();
      }
    }
    this.stVisto = O.st; this.atkVisto = O.atk;
    // Un paso pesado hace temblar el suelo un poquito. Va con el PIE del
    // dibujo (pisadaOgro), no con un reloj: un temblor que no coincide con la
    // pisada se nota mas que no tener temblor.
    const pisada = pisadaOgro(O);
    if (O.st === OG.ANDA && pisada !== this._paso) {
      this._paso = pisada;
      cam.shakeDecay(1.2, 0.08);
      burst(O.x, SUELO, 3, { rnd: Math.random, colors: [PA.polvo2], speed: 60,
                             life: 0.3, size: 3, grav: 300 });
    }

    // --- ELLA LE PEGA AL OGRO ---
    // UN golpe por tajo: K.golpeo se pone a 0 al empezar cada tajo y aqui se
    // marca al acertar. Sin eso cada fotograma de la parte activa volvia a
    // pegar (y con el hitstop de por medio, un tajo eran cuatro golpes).
    // Y el daño sale de K.combo (0, 1, 2: que golpe del combo es), NO de
    // K.tajoId, que cuenta TODOS los tajos de la pelea: con tajoId el segundo
    // tajo pegaba como el remate y desde el tercero TAJOS[3] no existia y el
    // update reventaba -- el ogro dejaba de recibir daño y no se podia ganar.
    if (C.espadaActiva(K) && O.vivo && !K.golpeo) {
      const [px] = C.puntaEspada(K);
      if (OG.espadaTocaOgro(O, px, K.x)) {
        const dano = C.danoTajo(K);
        if (OG.hiereOgro(O, dano, K.dir)) {
          K.golpeo = 1;
          const fuerte = K.combo === 2;
          this.hitstop = (K.contra ? 11 : fuerte ? 8 : 5) / 60;
          this.flashO = 0.1;
          cam.shake(K.contra ? 6 : fuerte ? 4 : 3, 0.12);
          if (K.contra) {
            this.contras++;
            burst(O.x + K.dir * -20, SUELO - 130, 16, { rnd: Math.random, colors: [PC.oro3, PC.bla2, PC.ace4],
                                                       speed: 340, life: 0.5, size: 4, grav: 200 });
          }
          SFX.corta(); vibrate(fuerte ? 22 : 14);
          burst(O.x + K.dir * -30, SUELO - 120, 14,
                { rnd: Math.random, colors: [POG.pie3, POG.pie2, '#8b1a2b'],
                  speed: 260, life: 0.5, size: 4, grav: 620 });
        }
      }
    }
    // --- EL OGRO LE PEGA A ELLA ---
    // QUE le pega lo dice OG.golpeaA (el garrote con su tipo de golpe, o una
    // onda), y si le entra lo decide C.herir: la misma regla que mide el arnes.
    // Cinco ramas, que son las cinco que devuelve C.herir().
    const golpe = O.vivo && K.vivo ? OG.golpeaA(O, K) : null;
    if (golpe) {
      const r = C.herir(K, golpe.x, golpe.tipo, golpe.dano);
      if (r === 'parada') {
        // LA PARADA: el garrote rebota y el ogro se queda abierto lo que dura
        // la ocasion de contraatacar (el premio de ella lo pone herir()).
        OG.abrePorParada(O, C.PARADA_PREMIO);
        this.paradas++; P.anota(Mae, 'para'); OG.anotaHabito(O, 'guardia');
        this.hitstop = 9 / 60; cam.shake(4, 0.14); SFX.clang(); vibrate(26);
        this.msg = 'PARADA!'; this.msgT = 0.8;
        this.chispa = 0.25;
        burst(K.x + K.dir * 44, K.y - 110, 18,
              { rnd: Math.random, colors: [PC.oro3, PC.bla2, PC.ace4],
                speed: 320, life: 0.5, size: 4, grav: 120 });
      } else if (r === 'bloqueado') {
        P.anota(Mae, 'para'); OG.anotaHabito(O, 'guardia');
        this.hitstop = 4 / 60; cam.shake(2.5, 0.1); SFX.clang(); vibrate(14);
        burst(K.x + K.dir * 40, K.y - 110, 8,
              { rnd: Math.random, colors: [PC.ace3, PC.ace2], speed: 200,
                life: 0.35, size: 3, grav: 300 });
      } else if (r === 'rota') {
        // Con la guardia arriba contra algo que no se para: se le rompe, le
        // entra igual, y se le dice por que (es como se aprende que el
        // barrido se esquiva y la onda se salta).
        P.anota(Mae, 'golpe');
        this.duele(K);
        this.msg = golpe.tipo === 'onda' || golpe.tipo === 'pisoton' ? 'SALTA LAS ONDAS' : 'GUARDIA ROTA';
        this.msgT = 1.0;
        burst(K.x + K.dir * 30, K.y - 100, 12,
              { rnd: Math.random, colors: [PC.ace3, PC.ace2, PC.ace1], speed: 260,
                life: 0.45, size: 4, grav: 500 });
      } else if (r === true) {
        P.anota(Mae, 'golpe');
        this.duele(K);
      }
    }

    // --- LA ARENA: cascotes que caen, escombros que revientan ---
    // La espada va como TRAMO (del cuerpo a la punta): rompe el escombro que
    // cruce, igual que al ogro.
    let espada = null;
    if (C.espadaActiva(K)) { const [px] = C.puntaEspada(K); espada = [Math.min(K.x, px), Math.max(K.x, px)]; }
    for (const e of AR.stepArena(this.A, K, O, dt, espada)) {
      if (e.tipo === 'impacto') {
        cam.shake(3, 0.12); vibrate(10); SFX.aterriza();
        burst(e.x, SUELO, 16, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2, PA.polvo3],
                                speed: 260, life: 0.55, size: 4, grav: 800 });
      } else if (e.tipo === 'golpea') {
        this.duele(K);
        burst(e.x, e.y, 18, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2, PA.polvo3],
                              speed: 300, life: 0.5, size: 5, grav: 800 });
      } else if (e.tipo === 'ogro') {
        this.flashO = 0.1; this.hitstop = 6 / 60; cam.shake(4, 0.14); SFX.corta(); vibrate(18);
        this.msg = 'CASCOTAZO'; this.msgT = 0.8;
        burst(e.x, e.y, 18, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2, PA.polvo3],
                              speed: 300, life: 0.5, size: 5, grav: 800 });
      } else if (e.tipo === 'rompe') {
        cam.shake(1.5, 0.08); SFX.clang();
        burst(e.x, e.y, 14, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2, PA.polvo3],
                              speed: 240, life: 0.5, size: 5, grav: 800 });
      } else if (e.tipo === 'onda') {
        burst(e.x, SUELO, 10, { rnd: Math.random, colors: [PA.polvo1, PA.polvo2],
                                speed: 200, life: 0.4, size: 4, grav: 600 });
      }
    }

    // --- ¿Se acabo? ---
    if (activo) {
      if (!O.vivo) this.termina(true);
      else if (!K.vivo) this.termina(false);
    }

    // --- Camara: FIJA. La arena mide 1080 y el lienzo 1200, asi que cabe
    // entera. Seguir a Romina dejaba media pantalla de fondo vacio al llegar
    // a la pared derecha (medido: con K.x=1140 el borde de la arena caia en
    // pantalla x=600), y con un jefe de 232 px la camara movil ademas lo
    // sacaba de cuadro. Fija, el combate entero se ve siempre.
    this.camX = 0;
  },

  onInput(ev, ctx) {
    if (this.fase === 'aventura') { AV.input(this, ev); return; }
    // EL ARMARIO: tocar una muestra la pone (si esta ganada) o dice como se gana.
    if (this.fase === 'armario') {
      if (ev.type !== 'down') return;
      if (this.bListo.hit(ev)) {
        this.pulsos.listo = 1; SFX.select();
        Save.guarda('caba.traje', this.traje);
        this.fase = 'elige'; this.faseT = 0;
        return;
      }
      for (const m of this.muestrasEnPantalla()) {
        if (Math.hypot(ev.x - m.x, ev.y - m.y) > 34) continue;
        const pr = P.prenda(m.parte, m.id);
        if (P.disponible(m.parte, m.id, this.medallas)) {
          this.traje = { ...this.traje, [m.parte]: m.id };
          vestir(P.tintesDe(this.traje));
          SFX.select(); vibrate(8);
          this.aviso = NOMBRE_PARTE[m.parte] + ' ' + pr.nombre;
        } else {
          const med = P.medallaDe(m.parte, m.id);
          SFX.blip();
          this.aviso = 'SE GANA CON ' + med.nombre + ': ' + med.pide;
        }
        this.avisoT = 3;
        return;
      }
      return;
    }
    // ELEGIR: tocar una de las tres (o el armario).
    if (this.fase === 'elige') {
      if (ev.type !== 'down') return;
      if (this.bArmario.hit(ev)) {
        this.pulsos.armario = 1; SFX.select();
        this.fase = 'armario'; this.faseT = 0; this.aviso = ''; this.avisoT = 0; this.armarioNuevo = false;
        return;
      }
      // Las pestanas: AVENTURA o EL OGRO.
      for (const m of ['aventura', 'pelea']) {
        const c = this.pestana(m);
        if (ev.x >= c.x && ev.x <= c.x + c.w && ev.y >= c.y && ev.y <= c.y + c.h) {
          if (this.modo !== m) { this.modo = m; Save.guarda('caba.modo', m); SFX.select(); vibrate(8); }
          return;
        }
      }
      for (let i = 0; i < 3; i++) {
        const c = this.tarjeta(i);
        if (ev.x >= c.x && ev.x <= c.x + c.w && ev.y >= c.y && ev.y <= c.y + c.h) {
          this.dif = P.ORDEN[i];
          Save.guarda('caba.dif', this.dif);
          SFX.select(); vibrate(10);
          if (this.modo === 'aventura') AV.empieza(this);
          else this.comenzar();
          return;
        }
      }
      return;
    }
    // LA ENTRADA se salta tocando.
    if (this.fase === 'entrada') {
      if (ev.type === 'down' && this.faseT > 0.3) this.empiezaPelea();
      return;
    }
    // EL RESULTADO: sus tres botones, cuando ya se ha visto la nota.
    if (this.fase === 'resultado') {
      if (ev.type !== 'down' || this.faseT < 0.9) return;
      if (this.bOtra.hit(ev)) { this.pulsos.otra = 1; SFX.select(); this.comenzar(); }
      else if (this.bDif.hit(ev)) {
        this.pulsos.dificultad = 1; SFX.select();
        this.nueva(); this.fase = 'elige'; this.faseT = 0; playMusic(SONGS.caballero);
      } else if (this.bMenu.hit(ev)) { SFX.blip(); this.ctx.toMenu(); }
      return;
    }
    if (this.fase !== 'pelea') { this.sueltaMandos(ev); return; }
    this.mandos(ev);
  },

  // LOS MANDOS de la pelea, que son tambien los de la aventura: el stick a la
  // izquierda y los cuatro botones a la derecha.
  mandos(ev) {
    if (ev.type === 'down') {
      if (this.bEsquiva.down(ev)) { this.esquiva = true; this.pulsos.esquivar = 1; return; }
      if (this.bGuardia.down(ev)) { this.pulsos.guardia = 1; return; }
      if (this.bAtaca.down(ev)) { this.golpea = true; this.pulsos.atacar = 1; return; }
      if (this.bSalta.down(ev)) { this.salta = true; this.pulsos.saltar = 1; return; }
      if (ev.x < VW * 0.45 && ev.y > 240) { this.stick.down(ev); return; }
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev); this.bSalta.up(ev); this.bAtaca.up(ev); this.bEsquiva.up(ev); this.bGuardia.up(ev);
    }
  },
  // Fuera de juego solo se sueltan (un dedo que se levanta no se queda pegado).
  sueltaMandos(ev) {
    if (ev.type !== 'down') { this.stick.up(ev); this.bSalta.up(ev); this.bAtaca.up(ev); this.bEsquiva.up(ev); this.bGuardia.up(ev); }
  },

  // Le entra un golpe de verdad (el ogro o un cascote): congelacion, temblor,
  // sonido y la sangre en el rojo de su falda.
  duele(K) {
    this.hitstop = 7 / 60; cam.shake(5, 0.16); SFX.golpe ? SFX.golpe() : SFX.clang();
    vibrate(34);
    burst(K.x, K.y - 90, 12, { rnd: Math.random, colors: [PR.ves2, PR.ves3],
                               speed: 240, life: 0.45, size: 4, grav: 500 });
  },

  draw(g, ctx) {
    if (this.fase === 'aventura') { AV.draw(this, g); return; }
    // Eligiendo la AVENTURA, detras se ve el bosque y no el salon.
    if (this.modo === 'aventura' && (this.fase === 'elige' || this.fase === 'armario')) {
      drawBosque(g, this.vistaBosque, 0, VW, ALTO, this.t);
      if (this.fase === 'elige') this.drawElige(g); else this.drawArmario(g);
      return;
    }
    const K = this.K, cx = this.camX;
    // EL SALON y sus repisas (ver caba-arena.js y arena-sprite.js).
    drawSalon(g, this.t);
    drawRepisas(g);

    // LAS GRIETAS que deja el pisoton, en la alfombra. Se borran despacio:
    // quedan como memoria de la pelea.
    for (const gr of this.grietas) {
      const gx = Math.round(gr.x - cx);
      g.globalAlpha = Math.min(0.85, gr.t);
      g.fillStyle = PA.grieta;
      for (let i = -3; i <= 3; i++) {
        const w = Math.round((1 - Math.abs(i) / 4) * gr.w * 0.22);
        g.fillRect(gx + i * 11 - (w >> 1), SUELO - 1 + ((i * 7) % 3), w, 3);
      }
      g.fillStyle = PA.alfom2;
      g.fillRect(gx - gr.w / 2, SUELO + 2, gr.w, 2);
      g.globalAlpha = 1;
    }

    // LOS ESCOMBROS y la sombra de lo que va a caer: en el suelo, por detras
    // de ellos dos.
    drawEscombros(g, this.A);
    drawSombrasPiedras(g, this.A);

    // LAS ONDAS del pisoton: una cresta de polvo y piedra que barre la
    // alfombra. A 34 px de alto son silueta de verdad, no un detalle, y se ven
    // viajar porque a 620 px/s avanzan 10 px por fotograma. (Antes eran del
    // verde del ogro: una onda de su color parecia parte de el, no del suelo.)
    for (const w of this.O.ondas) {
      if (!w.vivo) continue;
      const wx = Math.round(w.x - cx);
      const alturas = [6, 14, 26, 34, 22, 10];
      for (let i = 0; i < alturas.length; i++) {
        const h = alturas[i];
        const bx = wx + (i - 2.5) * 10 * w.dir;
        g.fillStyle = i === 3 ? PA.polvo1 : i < 3 ? PA.polvo2 : PA.polvo3;
        g.fillRect(Math.round(bx - 5), SUELO - h, 10, h);
        g.fillStyle = PA.grieta;
        g.fillRect(Math.round(bx - 5), SUELO - h, 10, 2);
      }
      // el polvo que levanta por delante
      g.fillStyle = PA.polvo2;
      g.fillRect(wx + 26 * w.dir, SUELO - 8, 8, 8);
    }

    // EL OGRO. Se dibuja antes que ella: ella queda por delante, que es lo
    // que hace leer quien esta mas cerca de la camara.
    {
      const O = this.O;
      const po = poseOgro(O);
      // su sombra: tan ancha como su postura (los pies van de -64 a +60), y
      // se encoge y se aclara cuando salta, como la de ella.
      const vuelo = vueloOgro(po);
      const osw = Math.max(40, 76 - vuelo * 0.3), osh = Math.max(5, 10 - vuelo * 0.05);
      g.globalAlpha = Math.max(0.15, 0.38 - vuelo * 0.003); g.fillStyle = '#000000';
      for (let dy = -Math.ceil(osh); dy <= Math.ceil(osh); dy++) {
        const u = dy / osh;
        if (u * u > 1) continue;
        const ww = osw * Math.sqrt(1 - u * u);
        g.fillRect(Math.round(O.x - cx - ww), SUELO - 2 + dy, Math.round(ww * 2), 1);
      }
      g.globalAlpha = 1;
      const parpadea = O.invul > 0 && O.st !== OG.RUGE && ((O.invul * 16) | 0) & 1;
      // El destello al 75 %, no al 100: con la media luna blanca del tajo de
      // ella encima, un ogro blanco entero se leia como una mancha sin forma.
      // LA FINTA se VE: mientras aguanta el garrote en alto, tiembla.
      const tiembla = O.reteniendo ? (((this.t * 40) | 0) & 1 ? 2 : -2) : 0;
      if (!parpadea) drawOgro(g, this.SO, O.x - cx + tiembla, SUELO, O.dir, po, Math.max(0, this.flashO) / 0.1 * 0.75);
    }

    // Sombra de Romina. Era un fillRect: un rectangulo negro de 5 px que se
    // veia como una barra debajo de los pies, y saltando aun peor. Ahora es
    // una ELIPSE rasterizada a la rejilla -- se dibuja por bandas de pixeles
    // enteros, sin antialias, para que sea pixel art como el resto.
    //
    // Se encoge Y se aclara con la altura: es lo que hace leer a que altura
    // esta en el aire, que es informacion util al saltar. Cae sobre lo que
    // tenga DEBAJO (el suelo, una repisa o un escombro): con la sombra siempre
    // en el suelo, al saltar sobre una repisa parecia que flotaba en el vacio.
    const bajo = C.sueloBajo(K.x, K.y, AR.mundo(this.A));
    const altura = bajo - K.y;
    const sw = Math.max(13, 30 - altura * 0.075);   // semiancho
    const sh = Math.max(2.5, 7 - altura * 0.018);   // semialto
    const sx0 = K.x - cx;
    g.globalAlpha = Math.max(0.12, 0.42 - altura * 0.0019);
    g.fillStyle = '#000000';
    // Elipse por bandas: cada fila de pixeles es un rectangulo de 1 px de alto
    for (let dy = -Math.ceil(sh); dy <= Math.ceil(sh); dy++) {
      const u = dy / sh;
      if (u * u > 1) continue;
      const w = sw * Math.sqrt(1 - u * u);
      g.fillRect(Math.round(sx0 - w), bajo - 2 + dy, Math.round(w * 2), 1);
    }
    g.globalAlpha = 1;

    // Romina. La estela de cada tajo ya viene DIBUJADA en sus fotogramas (la
    // media luna blanca del pack), asi que la escena ya no pinta el arco que
    // pintaba para la muñeca de antes: saldrian dos estelas una encima de otra.
    let [p, f] = C.pose(K);
    // GANO: en cuanto esta quieta, la espada en alto (el final del reves, que
    // acaba con la hoja arriba).
    if (this.gano && this.fase !== 'pelea' && K.vivo && K.enSuelo && (K.st === C.QUIETO || K.st === C.CORRE)) {
      p = 'atk'; f = 5;
    }
    // El DESTELLO del golpe recibido: blanca entera los primeros 0.1 s. Y
    // mientras dura, no parpadea: el destello es lo que tiene que verse.
    const desde = K.vivo ? K.t - K.hurtIni : K.muereT;
    const blanco = (K.st === C.DOLOR || K.st === C.MUERTO) ? Math.max(0, 1 - desde / 0.1) : 0;
    const parpadea = this.fase === 'pelea' && !blanco && K.iframe > 0 && (((K.iframe * 14) | 0) & 1);
    // La estela de sombras de la ESQUIVA, detras de hacia donde se mueve.
    const rastro = K.st === C.ESQUIVA && C.invulnerable(K) ? 1 : 0;
    if (!parpadea) drawRomina(g, K.x - cx, K.y, K.dir, p, f, rastro, blanco, K.st === C.ESQUIVA ? K.esqDir : K.dir);
    // LA CHISPA DE LA PARADA: una estrella de oro donde la espada para el
    // garrote. Dura un cuarto de segundo y se encoge.
    if (this.chispa > 0) {
      const u = this.chispa / 0.25, sx = Math.round(K.x + K.dir * 44 - cx), sy = Math.round(K.y - 112);
      const L = Math.round(10 + 22 * u);
      g.fillStyle = PC.bla2;
      g.fillRect(sx - L, sy - 2, L * 2, 4); g.fillRect(sx - 2, sy - L, 4, L * 2);
      g.fillStyle = PC.oro3;
      const D = Math.round(L * 0.6);
      for (let i = -D; i <= D; i += 2) { g.fillRect(sx + i - 1, sy + i - 1, 3, 3); g.fillRect(sx + i - 1, sy - i - 1, 3, 3); }
    }

    // Lo que cae de la boveda, por delante de todo: le cae ENCIMA.
    drawPiedras(g, this.A, this.t);

    // El fogonazo del golpe que lo tumba.
    if (this.destello > 0) {
      g.globalAlpha = Math.min(0.8, this.destello / 0.3 * 0.8);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, VW, ALTO);
      g.globalAlpha = 1;
    }

    // Y encima, lo de cada fase.
    if (this.fase === 'pelea' || this.fase === 'final') this.drawHud(g);
    if (this.fase === 'pelea') { this.drawLeccion(g); this.drawControles(g); }
    else if (this.fase === 'final') this.drawFinal(g);
    else if (this.fase === 'elige') this.drawElige(g);
    else if (this.fase === 'armario') this.drawArmario(g);
    else if (this.fase === 'entrada') this.drawEntrada(g);
    else if (this.fase === 'resultado') this.drawResultado(g);
  },

  drawHud(g) {
    // Franja de arriba
    g.globalAlpha = 0.45; g.fillStyle = '#2b1526'; g.fillRect(0, 0, VW, 56); g.globalAlpha = 1;

    // LOS CORAZONES de ella: los de su dificultad (seis, cuatro o tres), y se
    // vacian.
    const K = this.K;
    for (let i = 0; i < K.hpMax; i++) corazon(g, 14 + i * 30, 12, i < K.hp);

    // LA BARRA DEL OGRO, con las dos marcas de fase: asi se ve venir el
    // cambio en vez de que sorprenda.
    const O = this.O;
    const bw = 380, bx = VW / 2 - bw / 2, by = 16;
    g.fillStyle = '#1a1014'; g.fillRect(bx - 3, by - 3, bw + 6, 20);
    g.fillStyle = '#3a2030'; g.fillRect(bx, by, bw, 14);
    const fr = Math.max(0, O.hp / O.hpMax);
    g.fillStyle = O.fase >= 3 ? '#ff4a1e' : O.fase >= 2 ? POG.pie3 : POG.pie2;
    g.fillRect(bx, by, Math.round(bw * fr), 14);
    g.fillStyle = POG.pie4; g.fillRect(bx, by, Math.round(bw * fr), 3);
    for (const u of [OG.FASE2, OG.FASE3]) {
      g.fillStyle = '#1a1014'; g.fillRect(bx + Math.round(bw * u) - 1, by - 2, 3, 18);
    }
    text(g, 'OGRO', bx, by + 20, POG.pie4, 2);

    // EL RELOJ y la dificultad, arriba a la derecha: el tiempo cuenta para la
    // nota.
    const s = P.DIFICULTADES[this.dif].nombre + '   ' + reloj(this.tPelea);
    text(g, s, VW - 14 - measure(s, 2), 36, '#c9a9bc', 2);

    if (this.fase !== 'pelea') return;
    // Con un consejo arriba, los avisos bajan un poco para no pisarlo.
    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, this.leccion ? 150 : 72, PC.oro3, 4);
    // El CONTADOR DE COMBO. Crece con cada golpe encadenado y el tercero sale
    // en oro y mas grande: es lo que hace ver el ritmo del combo mientras se
    // juega, no solo sentirlo.
    if (this.comboT > 0 && this.combo > 1 && !this.leccion) {
      const u = Math.min(1, this.comboT * 3);
      const esc = this.combo === 3 ? 6 : 5;
      const col = this.combo === 3 ? PC.oro3 : PC.ves4;
      g.globalAlpha = Math.min(1, u * 1.4);
      textCenter(g, 'x' + this.combo, VW / 2, 118, col, esc);
      if (this.combo === 3) textCenter(g, 'REMATE', VW / 2, 164, PC.bla2, 3);
      g.globalAlpha = 1;
    }
  },

  // EL CONSEJO de la pelea que enseña: arriba, sobre una franja oscura, y su
  // boton brilla abajo (ver drawControles).
  drawLeccion(g) {
    const L = this.leccion;
    if (!L) return;
    const a = this.leccionT === Infinity ? 1 : Math.max(0, Math.min(1, this.leccionT / 0.3));
    g.globalAlpha = 0.55 * a; g.fillStyle = '#10080e'; g.fillRect(0, 60, VW, 76); g.globalAlpha = a;
    BT.rotulo(g, L.texto[0], VW / 2, 68, PC.oro3, 4);
    BT.rotulo(g, L.texto[1], VW / 2, 106, PC.bla2, 3);
    g.globalAlpha = 1;
  },

  drawControles(g) {
    // El stick: solo se ve entero cuando el pulgar lo despierta.
    BT.stick(g, this.H, this.stick, 150, SUELO + 38);
    const K = this.K, Pu = this.pulsos;
    const late = 0.55 + 0.45 * Math.sin(this.t * 14);
    const contra = K.parada > 0;
    // GUARDIA brilla en oro en la ventana de la PARADA: asi se aprende cuando.
    const enVentana = K.st === C.BLOQUEA && K.bloqT >= C.BLOQ_SUBE && K.bloqT < C.BLOQ_SUBE + K.paradaVent;
    // Y el boton de la leccion que se esta enseñando, late.
    const ens = this.leccion ? this.leccion.boton : null;
    const br = (k, b) => Math.max(b || 0, ens === k ? late : 0);
    BT.boton(g, this.H, 'saltar', this.bSalta, { apretado: this.bSalta.pressed, pulso: Pu.saltar,
      brillo: br('saltar'), nombre: 'SALTAR' });
    BT.boton(g, this.H, 'guardia', this.bGuardia, { apretado: this.bGuardia.pressed, pulso: Pu.guardia,
      brillo: br('guardia', enVentana ? 1 : 0), nombre: 'GUARDIA' });
    BT.boton(g, this.H, 'esquivar', this.bEsquiva, { apretado: this.bEsquiva.pressed, pulso: Pu.esquivar,
      recarga: K.esqCd > 0 ? K.esqCd / C.ESQ_CD : 0, brillo: br('esquivar'), nombre: 'ESQUIVAR' });
    // ATACAR: tras una parada late en oro y dice CONTRA.
    BT.boton(g, this.H, 'atacar', this.bAtaca, { apretado: this.bAtaca.pressed, pulso: Pu.atacar,
      brillo: contra ? late : 0, nombre: contra ? 'CONTRA!' : 'ATACAR', colorNombre: contra ? PC.oro3 : undefined });
    // Las marcas del COMBO encima de ATACAR: una por golpe encadenado.
    if (this.comboT > 0 && this.combo > 0) {
      const b = this.bAtaca;
      for (let i = 0; i < 3; i++) {
        const x = b.x - 16 + i * 16, y = b.y - b.r - 14;
        g.fillStyle = '#1a0e14';
        g.fillRect(x - 5, y - 2, 10, 5); g.fillRect(x - 2, y - 5, 5, 11);
        g.fillStyle = i < this.combo ? (this.combo === 3 ? PC.oro3 : PC.ves4) : '#4a2a38';
        g.fillRect(x - 3, y - 1, 7, 3); g.fillRect(x - 1, y - 3, 3, 7);
      }
    }
  },

  // ---------- ELEGIR EL MODO Y LA DIFICULTAD ----------
  tarjeta(i) { return { x: 90 + i * 350, y: 196, w: 320, h: 226 }; },
  pestana(m) { return m === 'aventura' ? { x: 270, y: 124, w: 320, h: 52 } : { x: 610, y: 124, w: 320, h: 52 }; },

  drawElige(g) {
    velo(g, 0.55);
    // El titulo, debajo del boton de pausa del arcade.
    BT.rotulo(g, 'ROMINA', VW / 2, 56, PC.ves3, 9);
    // Las pestanas del modo: la elegida, con su marco encendido.
    for (const [m, nombre] of [['aventura', 'AVENTURA'], ['pelea', 'CONTRA EL OGRO']]) {
      const c = this.pestana(m), sel = this.modo === m;
      BT.marco(g, c.x, c.y, c.w, c.h, sel);
      BT.rotulo(g, nombre, c.x + c.w / 2, c.y + 14, sel ? PC.oro3 : '#8a7a98', 3);
    }
    // NUEVO, sobre la pestaña de la aventura, hasta que la juegue una vez: la
    // primera vez que se publico, no la encontro.
    if (!Save.dato('caba.aventuraVista', false) && Math.sin(this.t * 6) > -0.4) {
      const c = this.pestana('aventura');
      BT.rotulo(g, 'NUEVO!', c.x - 76, c.y + 14, '#5cffd8', 3);
    }
    for (let i = 0; i < 3; i++) {
      const key = P.ORDEN[i], D = P.DIFICULTADES[key], c = this.tarjeta(i);
      const sel = key === this.dif;
      BT.marco(g, c.x, c.y, c.w, c.h, sel);
      const mx = c.x + c.w / 2;
      BT.rotulo(g, D.nombre, mx, c.y + 20, sel ? PC.oro3 : PC.bla2, 5);
      // sus corazones
      const ancho = D.corazones * 28 - 6;
      for (let k = 0; k < D.corazones; k++) corazon(g, Math.round(mx - ancho / 2 + k * 28), c.y + 74, true);
      if (this.modo === 'aventura') {
        // En la aventura no hay puntos: el lema del bosque y la mejor nota.
        textCenter(g, LEMA_BOSQUE[key], mx, c.y + 118, '#e8d8e8', 2);
        const B = Save.dato('caba.bosque', null), nota = B && B.notas && B.notas[key];
        textCenter(g, nota ? 'MEJOR NOTA ' + nota : 'SIN NOTA AUN', mx, c.y + 150, nota ? '#ffd76a' : '#8a7ab8', 2);
      } else {
        textCenter(g, D.lema, mx, c.y + 118, '#e8d8e8', 2);
        textCenter(g, 'PUNTOS x' + D.mult, mx, c.y + 150, '#c8b8ff', 2);
      }
      if (sel) textCenter(g, 'LA DE LA ULTIMA VEZ', mx, c.y + 190, '#b8801f', 2);
    }
    if (this.modo === 'aventura') {
      // La aventura: que nivel es, y su mejor tiempo.
      BT.rotulo(g, NV.BOSQUE.nombre + ': LLEGA AL ARBOL DEL FINAL', VW / 2, 438, '#c8e8a0', 2);
      const B = Save.dato('caba.bosque', null);
      if (B && B.mejorT) BT.rotulo(g, 'MEJOR TIEMPO ' + reloj(B.mejorT), VW / 2, 464, '#c8b8ff', 2);
    } else {
      // Si todavia le queda que aprender, se le dice: la primera pelea enseña.
      if (P.lecciona(this.maestro)) {
        BT.rotulo(g, 'EL OGRO TE IRA ENSEÑANDO SUS ATAQUES UNO A UNO', VW / 2, 438, '#9fe0c0', 2);
      }
      const mejor = Save.best('caballero');
      if (mejor > 0) BT.rotulo(g, 'MEJOR ' + mejor, VW / 2, 464, '#c8b8ff', 2);
    }
    if (Math.sin(this.t * 4) > -0.3) BT.rotulo(g, 'TOCA UNA PARA EMPEZAR', VW / 2, 494, PC.bla2, 2);
    // EL ARMARIO, abajo a la izquierda, con cuantas medallas lleva. Si hay
    // prendas nuevas, late.
    BT.boton(g, this.H, 'armario', this.bArmario, { pulso: this.pulsos.armario, nombre: 'ARMARIO',
      brillo: this.armarioNuevo ? 0.55 + 0.45 * Math.sin(this.t * 6) : 0 });
    text(g, 'MEDALLAS ' + this.medallas.length + '/' + P.MEDALLAS.length, 140, 462, '#ffd76a', 2);
  },

  // ---------- EL ARMARIO ----------
  // A la izquierda ella con el traje puesto (respira y, cada poco, da un tajo
  // para que se vea la estela); a la derecha, una fila de muestras por prenda.
  // Las que no se han ganado llevan candado, y tocarlas dice que medalla hace
  // falta: el armario ES la lista de medallas (cada una gana una prenda).
  muestrasEnPantalla() {
    const out = [];
    P.PARTES.forEach((parte, fila) => {
      P.ARMARIO[parte].forEach((pr, i) => out.push({ parte, id: pr.id, x: 640 + i * 104, y: 132 + fila * 104 }));
    });
    return out;
  },

  drawArmario(g) {
    velo(g, 0.8);
    BT.rotulo(g, 'ARMARIO', 230, 18, PC.ves3, 5);     // a un lado: en medio esta la pausa
    // ELLA, a x2, en su caja.
    BT.marco(g, 40, 70, 380, 400);
    g.save();
    g.beginPath(); g.rect(46, 76, 368, 388); g.clip();
    const tt = this.faseT % 2.4;
    const [p, f] = tt < 1.5 ? ['idle', Math.floor(tt / 0.11) % 9] : ['atk3', Math.min(10, Math.floor((tt - 1.5) / 0.07))];
    g.translate(150, 452); g.scale(2, 2);
    drawRomina(g, 0, 0, 1, p, f);
    g.restore();
    // LAS MUESTRAS
    BT.marco(g, 440, 70, 720, 330);
    P.PARTES.forEach((parte, fila) => {
      const y = 132 + fila * 104;
      text(g, NOMBRE_PARTE[parte], 464, y - 10, '#ffd76a', 3);
      text(g, P.prenda(parte, this.traje[parte]).nombre, 464, y + 20, '#e8d8e8', 2);
    });
    for (const m of this.muestrasEnPantalla()) {
      const cv = this.muestras[m.parte + '/' + m.id];
      g.drawImage(cv.cv, Math.round(m.x - 26 - cv.M), Math.round(m.y - 26 - cv.M));
      if (this.traje[m.parte] === m.id) {
        const a = this.aroElegido;
        g.drawImage(a, Math.round(m.x - a.width / 2), Math.round(m.y - a.height / 2));
      }
      if (!P.disponible(m.parte, m.id, this.medallas)) {
        g.globalAlpha = 0.55; g.fillStyle = '#0d0610';
        g.fillRect(m.x - 18, m.y - 18, 36, 36);
        g.globalAlpha = 1;
        g.drawImage(this.candado, Math.round(m.x - this.candado.width / 2), Math.round(m.y - this.candado.height / 2));
      }
    }
    // Lo que se acaba de tocar, o como se usa.
    const texto = this.avisoT > 0 ? this.aviso : 'TOCA UN COLOR PARA PONERTELO';
    BT.rotulo(g, texto, 800, 420, this.avisoT > 0 ? PC.oro3 : '#c8b8ff', 2);
    // Cuantas lleva, y salir.
    text(g, 'MEDALLAS ' + this.medallas.length + '/' + P.MEDALLAS.length, 60, 488, '#ffd76a', 2);
    for (let i = 0; i < P.MEDALLAS.length; i++) {
      const med = this.medallas.includes(P.MEDALLAS[i].id) ? this.medallaImg.oro : this.medallaImg.gris;
      g.drawImage(med.cv, 250 + i * 36 - 16 - med.M, 494 - 16 - med.M);
    }
    BT.boton(g, this.H, 'listo', this.bListo, { pulso: this.pulsos.listo, nombre: 'LISTO' });
  },

  // ---------- LA ENTRADA ----------
  drawEntrada(g) {
    const t = this.faseT;
    // Franjas de cine: entran, y se van al A PELEAR.
    const b = Math.round(64 * Math.max(0, Math.min(1, t / 0.3, (ENTRADA_T - t) / 0.3)));
    g.fillStyle = '#000000'; g.fillRect(0, 0, VW, b); g.fillRect(0, ALTO - b, VW, b);
    // El cartel: ROMINA entra por la izquierda y EL OGRO por la derecha.
    if (t > 0.25 && t < 2.2) {
      const e1 = suave((t - 0.25) / 0.35), e2 = suave((t - 0.45) / 0.35);
      g.globalAlpha = t > 1.9 ? Math.max(0, (2.2 - t) / 0.3) : 1;
      BT.rotulo(g, 'ROMINA', -400 + (VW / 2 + 400) * e1, 130, PC.ves3, 8);
      if (t > 0.55) BT.rotulo(g, 'CONTRA', VW / 2, 202, PC.bla2, 3);
      BT.rotulo(g, 'EL OGRO', VW + 400 - (VW / 2 + 400) * e2, 236, POG.pie4, 8);
      g.globalAlpha = 1;
    }
    if (t >= 2.1) {
      g.globalAlpha = Math.min(1, (t - 2.1) / 0.08);
      BT.rotulo(g, 'A PELEAR!', VW / 2, 180, PC.oro3, 8);
      g.globalAlpha = 1;
    }
    if (t > 0.3 && t < 2.1) {
      g.globalAlpha = 0.6;
      textCenter(g, 'TOCA PARA EMPEZAR YA', VW / 2, ALTO - 44, '#ffffff', 2);
      g.globalAlpha = 1;
    }
  },

  // ---------- EL FINAL ----------
  drawFinal(g) {
    const t = this.faseT;
    if (t < 0.4) return;
    g.globalAlpha = Math.min(1, (t - 0.4) / 0.3);
    if (this.gano) BT.rotulo(g, 'OGRO ABATIDO', VW / 2, 150, PC.oro3, 7);
    else BT.rotulo(g, 'TE HA PODIDO', VW / 2, 150, PC.ves3, 7);
    g.globalAlpha = 1;
  },

  // ---------- EL RESULTADO ----------
  drawResultado(g) {
    const R = this.res, t = this.faseT;
    if (!R) return;
    velo(g, Math.min(0.6, t * 2));
    BT.marco(g, 250, 30, 700, 400);
    const D = P.DIFICULTADES[this.dif];
    if (R.gano) BT.rotulo(g, 'VICTORIA', VW / 2, 50, PC.oro3, 5);
    else BT.rotulo(g, 'TE HA PODIDO', VW / 2, 50, PC.ves3, 5);
    textCenter(g, 'DIFICULTAD ' + D.nombre, VW / 2, 98, '#c8b8ff', 2);

    // A la izquierda, LA NOTA: cae como un sello y rebota. Si perdio, cuanto
    // le quito al ogro.
    if (R.gano) {
      if (t > 0.45) {
        const u = Math.min(1, (t - 0.45) / 0.25);
        const esc = 1 + (1 - u) * 1.6;
        if (u >= 1 && !this.selloOido) { this.selloOido = true; cam.shake(4, 0.12); SFX.clang(); vibrate(20); }
        BT.nota(g, this.H, R.nota, 400, 226, esc);
      }
    } else {
      const fr = R.dano / R.ogroHp;
      textCenter(g, 'LE QUITASTE', 400, 146, '#e8d8e8', 3);
      BT.rotulo(g, Math.round(fr * 100) + '%', 400, 180, PC.oro3, 8);
      g.fillStyle = '#1a1014'; g.fillRect(297, 257, 206, 20);
      g.fillStyle = '#3a2030'; g.fillRect(300, 260, 200, 14);
      g.fillStyle = POG.pie2; g.fillRect(300, 260, Math.round(200 * fr), 14);
      textCenter(g, 'DE LA VIDA', 400, 288, '#e8d8e8', 2);
    }

    // A la derecha, lo que cuenta.
    const fila = (y, et, val) => {
      text(g, et, 530, y, '#ffd76a', 3);
      if (val !== null) text(g, val, 910 - measure(val, 3), y, '#ffffff', 3);
    };
    fila(140, 'TIEMPO', reloj(R.t));
    fila(184, 'VIDA', null);
    const ancho = R.vidaMax * 28 - 6;
    for (let k = 0; k < R.vidaMax; k++) corazon(g, 910 - ancho + k * 28, 184, k < R.vida);
    fila(228, 'PARADAS', String(R.paradas));
    fila(272, 'CONTRAATAQUES', String(R.contras));

    // Los PUNTOS, que suben contando, y el record.
    g.fillStyle = '#b8801f'; g.fillRect(290, 314, 620, 2);
    const cuenta = Math.min(R.puntos, Math.round(R.puntos * Math.max(0, (t - 0.6) / 0.8)));
    BT.rotulo(g, 'PUNTOS ' + cuenta, VW / 2, 328, PC.bla2, 5);
    if (t > 1.4) {
      if (R.record) {
        const col = Math.sin(this.t * 8) > 0 ? '#ffe14d' : '#ff5c9d';
        BT.rotulo(g, 'RECORD NUEVO!', VW / 2, 374, col, 3);
      } else {
        textCenter(g, 'MEJOR ' + R.mejor, VW / 2, 378, '#8a7ab8', 2);
      }
      BT.rotulo(g, R.frase, VW / 2, 404, '#5cffd8', 2);
    }

    // LAS MEDALLAS NUEVAS: una tras otra, bajan por la esquina de arriba a la
    // izquierda con su premio. (En el centro las tapaba el boton de pausa.)
    const nuevas = R.nuevas || [];
    for (let i = 0; i < nuevas.length; i++) {
      const t0 = 1.6 + i * 2.0, u = t - t0;
      if (u < 0 || u > 2.0) continue;
      if (this.avisoOido < i) { this.avisoOido = i; SFX.powerup(); vibrate(20); }
      const baja = Math.min(1, u / 0.25) * Math.min(1, (2.0 - u) / 0.25);
      const y = Math.round(-76 + 82 * baja);
      const med = P.MEDALLAS.find(m => m.id === nuevas[i]);
      const [parte, id] = med.premio;
      BT.marco(g, 12, y, 440, 70, true);
      const mi = this.medallaImg.oro;
      g.drawImage(mi.cv, 30 - mi.M, y + 19 - mi.M);
      text(g, med.nombre, 76, y + 13, PC.oro3, 3);
      text(g, 'PREMIO: ' + NOMBRE_PARTE[parte] + ' ' + P.prenda(parte, id).nombre, 76, y + 44, PC.bla2, 2);
    }

    // Los botones, cuando ya se ha visto todo.
    if (t > 0.9) {
      BT.boton(g, this.H, 'dificultad', this.bDif, { pulso: this.pulsos.dificultad, nombre: 'DIFICULTAD' });
      BT.boton(g, this.H, 'otra', this.bOtra, { pulso: this.pulsos.otra, nombre: 'OTRA VEZ',
        brillo: 0.4 + 0.3 * Math.sin(this.t * 5) });
      BT.boton(g, this.H, 'menu', this.bMenu, { pulso: this.pulsos.menu, nombre: 'MENU' });
    }
  },

  destroy() { this.A = null; this.av = null; },
};

// Como se llama cada parte del traje en pantalla.
const NOMBRE_PARTE = { capa: 'CAPA', falda: 'FALDA', estela: 'ESTELA' };
// Lo que dice cada dificultad en la AVENTURA (en la pelea es su lema, que
// habla del ogro).
const LEMA_BOSQUE = { paseo: 'EL BOSQUE CON CALMA', normal: 'EL BOSQUE DE VERDAD', furia: 'EL BOSQUE NO PERDONA' };

// La cara de la muestra de una prenda (claro, medio, oscuro): de la falda, sus
// tonos de la parte que mas se ve.
function carasDe(parte, pr) {
  const t = pr.tonos;
  return parte === 'falda' ? [t[4], t[3], t[1]] : [t[2], t[1], t[0]];
}

// Un corazon de pixel: lleno (rojo con brillo) o vacio.
function corazon(g, hx, hy, lleno) {
  g.fillStyle = lleno ? PC.ves2 : '#3a2030';
  g.fillRect(hx + 4, hy, 14, 6); g.fillRect(hx, hy + 4, 22, 8);
  g.fillRect(hx + 3, hy + 12, 16, 4); g.fillRect(hx + 7, hy + 16, 8, 4);
  if (lleno) { g.fillStyle = PC.ves4; g.fillRect(hx + 4, hy + 2, 5, 5); }
}

// Oscurece el salon para que se lea lo de encima.
function velo(g, a) {
  g.globalAlpha = a; g.fillStyle = '#0d0610'; g.fillRect(0, 0, VW, ALTO); g.globalAlpha = 1;
}

// 83.4 s -> '1:23'
function reloj(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

// Entrada con frenada: rapido al principio, suave al llegar.
function suave(u) { u = Math.max(0, Math.min(1, u)); return 1 - (1 - u) * (1 - u) * (1 - u); }
