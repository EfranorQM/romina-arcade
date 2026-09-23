// ROMINA - la pelea contra el ogro, en el salon del castillo.
//
// Se juega de LADO. Pulgar izquierdo = mover. Cuatro botones a la derecha:
// ATACAR (el grande), SALTAR, ESQUIVAR y GUARDIA (que se mantiene). Cada uno
// es la respuesta a un ataque del ogro: la guardia para el garrotazo (y a
// tiempo es una PARADA que da CONTRAATAQUE), el salto libra la onda del
// pisoton y la esquiva, el barrido y la embestida. Se dibujan en
// caba-botones.js.
//
// Aqui solo se arbitra: la fisica de ella esta en caba-cuerpo.js, la del ogro
// en ogro-cuerpo.js y la de la arena (repisas, cascotes, escombros) en
// caba-arena.js, las tres sin DOM y con su arnes en tools/. Lo que se ve sale
// de romi-sprite.js, ogro-sprite.js y arena-sprite.js.

import { VW, cam } from '../core.js';
import { burst, particles } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';
import * as C from './caba-cuerpo.js';
import { drawRomina, P as PR } from './romi-sprite.js';
import * as BT from './caba-botones.js';
import * as AR from './caba-arena.js';
import { drawSalon, drawRepisas, drawEscombros, drawSombrasPiedras, drawPiedras, P as PA } from './arena-sprite.js';
import * as OG from './ogro-cuerpo.js';
import { bakeOgro, drawOgro, poseOgro, pisadaOgro, vueloOgro, P as POG } from './ogro-sprite.js';

// La paleta de la INTERFAZ (botones, textos, corazones, chispas del acero).
// Es la de la Romina de antes, que se borro con su codigo: el rosa se quedo
// porque es el color del juego en el menu, no el de su ropa.
const PC = {
  ves1: '#8e1140', ves2: '#c41c5a', ves3: '#ef4a84', ves4: '#ff8fbc',
  bla2: '#fff4fa', oro3: '#ffe066',
  ace1: '#4a5570', ace2: '#8a97b8', ace3: '#d4dcf0', ace4: '#ffffff',
};

const SUELO = C.SUELO;

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
    this.K = C.makeCaballero(160);
    // LA ARENA: el salon del castillo, con sus repisas, y los cascotes que
    // hace caer el pisoton (ver caba-arena.js).
    this.A = AR.makeArena();

    this.stick = new Stick(80, 14);
    // Cuatro botones en la esquina de abajo a la derecha, en el mismo sitio
    // que los de antes (medidos para el pulgar). Los radios son de DIBUJO; el
    // area de toque es r+pad. GUARDIA es el unico que se mantiene apretado;
    // los otros tres son toques.
    this.bSalta = new Button(1096, 300, 34, 20);
    this.bAtaca = new Button(1132, 428, 40, 20);
    this.bEsquiva = new Button(1016, 452, 32, 20);
    this.bGuardia = new Button(1016, 336, 32, 20);
    this.salta = false; this.golpea = false; this.esquiva = false;
    // Los medallones, horneados una vez (ver caba-botones.js), y el aro que
    // suelta cada uno al apretarlo (1 -> 0).
    this.H = BT.hornea({ atacar: this.bAtaca, saltar: this.bSalta, esquivar: this.bEsquiva, guardia: this.bGuardia });
    this.pulsos = { atacar: 0, saltar: 0, esquivar: 0, guardia: 0 };

    this.camX = 0;
    this.t = 0; this.hitstop = 0;
    this.golpes = 0; this.saltos = 0; this.esquivas = 0;
    this.msg = ''; this.msgT = 0;
    this.combo = 0; this.comboT = 0;

    // EL OGRO. (Los muñecos de paja del patio de pruebas se fueron con el
    // salon: en una pelea de jefe solo estorbaban la vista.)
    this.O = OG.makeOgro(880);
    this.SO = bakeOgro();
    this.flashO = 0;          // el destello blanco del ogro al recibir un tajo
    this.chispa = 0;          // la estrella de oro de la PARADA
    this.grietas = [];        // las marcas que deja el pisoton en el suelo
    this.fin = 0;             // >0 cuando acaba la pelea (gana o pierde)
    this.finT = 0;
  },

  update(dt, ctx) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    // Despues del hitstop a proposito: el destello dura TODA la congelacion
    // del golpe y se apaga cuando el mundo vuelve a moverse.
    if (this.flashO > 0) this.flashO -= dt;
    if (this.chispa > 0) this.chispa -= dt;

    const K = this.K;
    const inp = {
      dx: this.stick.dx,
      salta: this.salta, saltaAbajo: this.bSalta.pressed,
      golpea: this.golpea, esquiva: this.esquiva, bloquea: this.bGuardia.pressed,
    };
    const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId;
    const antesCd = K.esqCd;
    this.salta = false; this.golpea = false; this.esquiva = false;
    for (const k in this.pulsos) if (this.pulsos[k] > 0) this.pulsos[k] -= dt / 0.25;

    const M = AR.mundo(this.A);
    C.stepCaballero(K, inp, dt, M);

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
    const stAntes = O.st;

    // EL ORDEN IMPORTA: ella se mueve, luego el ogro, y AL FINAL se arbitra
    // quien toca a quien. Con ella rodando a 660 px/s un frame de desfase son
    // 11 px: la diferencia entre esquivar y comer el golpe.
    OG.stepOgro(O, K, dt);
    // El cuerpo del ogro es SOLIDO: sin esto ella se mete dentro de la
    // barriga y todas las distancias dejan de significar nada. (Esquivando lo
    // atraviesa: es la respuesta a la embestida. Ver OG.empujaCuerpo.)
    OG.empujaCuerpo(O, K);

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

    // El ogro acaba de quedar ABIERTO: se avisa, porque es CUANDO pegar.
    if (O.st === OG.ABIERTO && stAntes !== OG.ABIERTO) {
      this.msg = 'AHORA'; this.msgT = 0.55;
    }
    if (O.st === OG.RUGE && stAntes !== OG.RUGE) {
      cam.shakeDecay(5, 0.7); vibrate(30);
      this.msg = O.fase >= 3 ? 'FURIA' : 'RUGE'; this.msgT = 1.0;
      burst(O.x, SUELO - 150, 18, { rnd: Math.random, colors: [POG.ojo, POG.dien],
                                    speed: 220, life: 0.6, size: 4, grav: -60 });
    }
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
        this.hitstop = 9 / 60; cam.shake(4, 0.14); SFX.clang(); vibrate(26);
        this.msg = 'PARADA!'; this.msgT = 0.8;
        this.chispa = 0.25;
        burst(K.x + K.dir * 44, K.y - 110, 18,
              { rnd: Math.random, colors: [PC.oro3, PC.bla2, PC.ace4],
                speed: 320, life: 0.5, size: 4, grav: 120 });
      } else if (r === 'bloqueado') {
        this.hitstop = 4 / 60; cam.shake(2.5, 0.1); SFX.clang(); vibrate(14);
        burst(K.x + K.dir * 40, K.y - 110, 8,
              { rnd: Math.random, colors: [PC.ace3, PC.ace2], speed: 200,
                life: 0.35, size: 3, grav: 300 });
      } else if (r === 'rota') {
        // Con la guardia arriba contra algo que no se para: se le rompe, le
        // entra igual, y se le dice por que (es como se aprende que el
        // barrido se esquiva y la onda se salta).
        this.duele(K);
        this.msg = golpe.tipo === 'onda' || golpe.tipo === 'pisoton' ? 'SALTA LAS ONDAS' : 'GUARDIA ROTA';
        this.msgT = 1.0;
        burst(K.x + K.dir * 30, K.y - 100, 12,
              { rnd: Math.random, colors: [PC.ace3, PC.ace2, PC.ace1], speed: 260,
                life: 0.45, size: 4, grav: 500 });
      } else if (r === true) {
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
    if (this.fin === 0) {
      if (!O.vivo) { this.fin = 1; this.finT = 0; cam.shakeDecay(6, 0.9); }
      else if (!K.vivo) { this.fin = 2; this.finT = 0; }
    } else {
      this.finT += dt;
      // A los 3 s se reinicia la pelea, para poder volver a probar.
      if (this.finT > 3) {
        this.K = C.makeCaballero(260);
        this.O = OG.makeOgro(880);
        this.A = AR.makeArena();
        this.grietas.length = 0;
        this.fin = 0; this.finT = 0;
      }
    }

    // --- Camara: FIJA. La arena mide 1080 y el lienzo 1200, asi que cabe
    // entera. Seguir a Romina dejaba media pantalla de fondo vacio al llegar
    // a la pared derecha (medido: con K.x=1140 el borde de la arena caia en
    // pantalla x=600), y con un jefe de 232 px la camara movil ademas lo
    // sacaba de cuadro. Fija, el combate entero se ve siempre.
    this.camX = 0;
  },

  onInput(ev, ctx) {
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

  // Le entra un golpe de verdad (el ogro o un cascote): congelacion, temblor,
  // sonido y la sangre en el rojo de su falda.
  duele(K) {
    this.hitstop = 7 / 60; cam.shake(5, 0.16); SFX.golpe ? SFX.golpe() : SFX.clang();
    vibrate(34);
    burst(K.x, K.y - 90, 12, { rnd: Math.random, colors: [PR.ves2, PR.ves3],
                               speed: 240, life: 0.45, size: 4, grav: 500 });
  },

  draw(g, ctx) {
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
      if (!parpadea) drawOgro(g, this.SO, O.x - cx, SUELO, O.dir, po, Math.max(0, this.flashO) / 0.1 * 0.75);
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
    const [p, f] = C.pose(K);
    // El DESTELLO del golpe recibido: blanca entera los primeros 0.1 s. Y
    // mientras dura, no parpadea: el destello es lo que tiene que verse.
    const desde = K.vivo ? K.t - K.hurtIni : K.muereT;
    const blanco = (K.st === C.DOLOR || K.st === C.MUERTO) ? Math.max(0, 1 - desde / 0.1) : 0;
    const parpadea = !blanco && K.iframe > 0 && (((K.iframe * 14) | 0) & 1);
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

    this.drawHud(g);
    this.drawControles(g);
  },

  drawHud(g) {
    // Franja de arriba
    g.globalAlpha = 0.45; g.fillStyle = '#2b1526'; g.fillRect(0, 0, VW, 56); g.globalAlpha = 1;

    // LOS CORAZONES de ella. Cuatro, y se vacian: es lo unico que hacia falta
    // para que la pelea tenga consecuencia, porque hasta hoy era inmortal
    // (C.herir no se llamaba desde ningun sitio).
    const K = this.K;
    for (let i = 0; i < C.HP0; i++) {
      const hx = 14 + i * 30, hy = 12;
      const lleno = i < K.hp;
      g.fillStyle = lleno ? PC.ves2 : '#3a2030';
      g.fillRect(hx + 4, hy, 14, 6); g.fillRect(hx, hy + 4, 22, 8);
      g.fillRect(hx + 3, hy + 12, 16, 4); g.fillRect(hx + 7, hy + 16, 8, 4);
      if (lleno) { g.fillStyle = PC.ves4; g.fillRect(hx + 4, hy + 2, 5, 5); }
    }

    // LA BARRA DEL OGRO, con las dos marcas de fase: asi se ve venir el
    // cambio en vez de que sorprenda.
    const O = this.O;
    const bw = 380, bx = VW / 2 - bw / 2, by = 16;
    g.fillStyle = '#1a1014'; g.fillRect(bx - 3, by - 3, bw + 6, 20);
    g.fillStyle = '#3a2030'; g.fillRect(bx, by, bw, 14);
    const fr = Math.max(0, O.hp / OG.HP0);
    g.fillStyle = O.fase >= 3 ? '#ff4a1e' : O.fase >= 2 ? POG.pie3 : POG.pie2;
    g.fillRect(bx, by, Math.round(bw * fr), 14);
    g.fillStyle = POG.pie4; g.fillRect(bx, by, Math.round(bw * fr), 3);
    for (const u of [OG.FASE2, OG.FASE3]) {
      g.fillStyle = '#1a1014'; g.fillRect(bx + Math.round(bw * u) - 1, by - 2, 3, 18);
    }
    text(g, 'OGRO', bx, by + 20, POG.pie4, 2);

    const s = `TAJOS ${this.golpes}  SALTOS ${this.saltos}  ESQUIVAS ${this.esquivas}`;
    text(g, s, VW - 14 - measure(s, 2), 36, '#c9a9bc', 2);

    // El cartel de fin de pelea.
    if (this.fin === 1) {
      textCenter(g, 'OGRO ABATIDO', VW / 2, 150, PC.oro3, 6);
      textCenter(g, 'otra vez en ' + Math.max(0, Math.ceil(3 - this.finT)), VW / 2, 200, PC.bla2, 3);
    } else if (this.fin === 2) {
      textCenter(g, 'TE HA PODIDO', VW / 2, 150, PC.ves3, 6);
      textCenter(g, 'otra vez en ' + Math.max(0, Math.ceil(3 - this.finT)), VW / 2, 200, PC.bla2, 3);
    }
    if (this.msgT > 0) textCenter(g, this.msg, VW / 2, 72, PC.oro3, 4);
    // El CONTADOR DE COMBO. Crece con cada golpe encadenado y el tercero sale
    // en oro y mas grande: es lo que hace ver el ritmo del combo mientras se
    // juega, no solo sentirlo.
    if (this.comboT > 0 && this.combo > 1) {
      const u = Math.min(1, this.comboT * 3);
      const esc = this.combo === 3 ? 6 : 5;
      const col = this.combo === 3 ? PC.oro3 : PC.ves4;
      g.globalAlpha = Math.min(1, u * 1.4);
      textCenter(g, 'x' + this.combo, VW / 2, 118, col, esc);
      if (this.combo === 3) textCenter(g, 'REMATE', VW / 2, 164, PC.bla2, 3);
      g.globalAlpha = 1;
    }
  },

  drawControles(g) {
    // El stick: solo se ve entero cuando el pulgar lo despierta.
    BT.stick(g, this.H, this.stick, 150, SUELO + 38);
    const K = this.K, P = this.pulsos;
    const late = 0.55 + 0.45 * Math.sin(this.t * 14);
    const contra = K.parada > 0;
    // GUARDIA brilla en oro en la ventana de la PARADA: asi se aprende cuando.
    const enVentana = K.st === C.BLOQUEA && K.bloqT >= C.BLOQ_SUBE && K.bloqT < C.BLOQ_SUBE + C.PARADA_VENT;
    BT.boton(g, this.H, 'saltar', this.bSalta, { apretado: this.bSalta.pressed, pulso: P.saltar, nombre: 'SALTAR' });
    BT.boton(g, this.H, 'guardia', this.bGuardia, { apretado: this.bGuardia.pressed, pulso: P.guardia,
      brillo: enVentana ? 1 : 0, nombre: 'GUARDIA' });
    BT.boton(g, this.H, 'esquivar', this.bEsquiva, { apretado: this.bEsquiva.pressed, pulso: P.esquivar,
      recarga: K.esqCd > 0 ? K.esqCd / C.ESQ_CD : 0, nombre: 'ESQUIVAR' });
    // ATACAR: tras una parada late en oro y dice CONTRA.
    BT.boton(g, this.H, 'atacar', this.bAtaca, { apretado: this.bAtaca.pressed, pulso: P.atacar,
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

  destroy() { this.A = null; },
};

