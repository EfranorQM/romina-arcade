// EL CABALLERO - campo de pruebas.
//
// AVISO: esto TODAVIA NO ES EL JUEGO. Es el patio donde se prueba lo unico que
// decide si el juego vale la pena -- como se siente correr, saltar, rodar y
// cortar en horizontal. No hay jefe, no hay vidas que perder, no se puede
// morir: hay muñecos de paja que se parten para sentir el impacto de la
// espada, y ya. El jefe entra cuando esto se sienta bien.
//
// Se juega de LADO. Pulgar izquierdo = mover. Tres botones a la derecha:
// SALTAR (arriba), TAJO (el grande) y RODAR (el chico).

import { VW, VH, cam } from '../core.js';
import { burst, particles } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, Button, vibrate } from '../input.js';
import * as C from './caba-cuerpo.js';
import { drawRomina, P as PR } from './romi-sprite.js';
// La paleta de la Romina de antes se queda para la INTERFAZ (botones, textos,
// corazones): el rosa es el color del juego en el menu, no el de su ropa.
import { P as PC } from './romi-art.js';
import { bakeMundo, drawMundo, P as PM } from './caba-mundo.js';
import * as OG from './ogro-cuerpo.js';
import { bakeOgro, drawOgro, poseOgro, pisadaOgro, vueloOgro, P as POG } from './ogro-sprite.js';

const SUELO = C.SUELO;

export default {
  meta: {
    id: 'caballero', title: 'ROMINA', tag: 'PRUEBA DE MOVIMIENTO',
    colors: ['#ef4a84', '#ffe066'],
    // Apaisado y GRANDE: 1200x540 para que Romina quepa a 128x180 con detalle.
    // Sin meta.smooth: es pixel art, tiene que quedar nitido.
    vw: 1200, vh: 540, wide: true,
    pausaY: 2,
  },

  init(ctx, args) {
    this.ctx = ctx;
    this.K = C.makeCaballero(160);
    this.W = bakeMundo(SUELO, VH);

    this.stick = new Stick(80, 14);
    // Los tres botones, en triangulo en la esquina de abajo a la derecha. Los
    // radios son de DIBUJO; el area de toque es r+pad y NO se solapa: los
    // centros estan a 62 px (TAJO-SALTA) y 60 (TAJO-RUEDA), y la suma de sus
    // radios de toque es 54. Medido a 0.254 mm/px: separaciones de 15 mm, muy
    // por encima de los 9 mm en que un pulgar empieza a equivocarse.
    // Cuatro botones en la esquina de abajo a la derecha. ESCUDO es el unico
    // que se mantiene apretado; los otros tres son toques.
    this.bSalta = new Button(1096, 300, 34, 20);
    this.bTajo  = new Button(1132, 428, 40, 20);
    this.bRueda = new Button(1016, 452, 32, 20);
    this.bEscudo = new Button(1016, 336, 32, 20);
    this.salta = false; this.golpea = false; this.rueda = false;

    this.camX = 0;
    this.t = 0; this.hitstop = 0;
    this.golpes = 0; this.saltos = 0; this.rodadas = 0;
    this.msg = ''; this.msgT = 0;
    this.combo = 0; this.comboT = 0;

    // EL OGRO. Los muñecos de paja se quedan como decorado del fondo (ya no
    // son el objetivo): ahora hay un jefe de verdad.
    this.pajas = [];
    for (let i = 0; i < 3; i++) this.pajas.push({ x: 180 + i * 130, roto: 0, t: 0 });

    this.O = OG.makeOgro(880);
    this.SO = bakeOgro();
    this.flashO = 0;          // el destello blanco del ogro al recibir un tajo
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

    const K = this.K;
    const inp = {
      dx: this.stick.dx,
      salta: this.salta, saltaAbajo: this.bSalta.pressed,
      golpea: this.golpea, rueda: this.rueda, bloquea: this.bEscudo.pressed,
    };
    const antesSuelo = K.enSuelo, antesSt = K.st, antesTajo = K.tajoId;
    const antesEsc = K.escId, antesParada = K.parada;
    this.salta = false; this.golpea = false; this.rueda = false;

    C.stepCaballero(K, inp, dt);

    // --- Sonidos y efectos de lo que acaba de pasar ---
    // Cada golpe del combo suena distinto: el tercero (el giro) mas grave y
    // con temblor. Si los tres sonaran igual, el combo no se oiria como combo.
    if (K.tajoId !== antesTajo) {
      const n = C.golpeCombo(K);
      SFX.espadazo();
      this.golpes++;
      this.combo = n + 1;
      this.comboT = 1.0;
      if (n === 2) { cam.shake(2.5, 0.1); vibrate(12); }
      else vibrate(5);
    }
    // El EMPUJON de escudo
    if (K.escId !== antesEsc) {
      SFX.clang(); vibrate(14); cam.shake(2, 0.08);
      burst(K.x + K.dir * 40, SUELO - 70, 7, { rnd: Math.random, colors: [PC.ace3, PC.oro3], speed: 170, life: 0.3, size: 4, grav: 180 });
      this.msg = 'EMPUJON'; this.msgT = 0.6;
    }
    // La PARADA perfecta: destello de oro y el aviso
    if (K.parada > 0 && antesParada <= 0) {
      SFX.clang(); vibrate(22); cam.shake(4, 0.14); this.hitstop = 7 / 60;
      burst(K.x + K.dir * 34, SUELO - 74, 18, { rnd: Math.random, colors: [PC.oro3, PC.bla2, PC.ace4], speed: 300, life: 0.5, size: 4, grav: 60 });
      this.msg = 'PARADA!'; this.msgT = 0.9;
    }
    if (!antesSuelo && K.enSuelo) {
      // Aterrizaje: polvo y un temblor chiquito
      burst(K.x, SUELO, 9, { rnd: Math.random, colors: [PM.sue1, PM.sue2], speed: 120, life: 0.32, size: 4, grav: 520 });
      SFX.aterriza(); cam.shake(1.5, 0.08);
    }
    if (antesSt !== C.SALTA && K.st === C.SALTA) { SFX.salto(); this.saltos++; vibrate(6); }
    if (antesSt !== C.RUEDA && K.st === C.RUEDA) {
      SFX.rodar(); this.rodadas++; vibrate(8);
      burst(K.x, SUELO, 8, { rnd: Math.random, colors: [PM.sue1, PM.sue3], speed: 100, life: 0.28, size: 4, grav: 400 });
    }
    // Polvo al correr
    if (K.st === C.CORRE && K.enSuelo && ((this.t * 12) | 0) % 3 === 0) {
      burst(K.x - K.dir * 14, SUELO, 1, { rnd: Math.random, colors: [PM.sue2], speed: 44, life: 0.24, size: 3, grav: 240 });
    }

    // --- La espada contra los muñecos ---
    if (C.espadaActiva(K)) {
      const [px, py] = C.puntaEspada(K);
      for (const p of this.pajas) {
        if (p.roto > 0) continue;
        if (Math.abs(p.x - px) < 34 && Math.abs(p.x - K.x) < C.ALCANCE + 20) {
          p.roto = 2.0;
          this.hitstop = 5 / 60;
          cam.shake(3, 0.12);
          SFX.corta(); vibrate(16);
          burst(p.x, SUELO - 40, 16, { rnd: Math.random, colors: [PM.hueso, PM.hier2, PM.sue1], speed: 260, life: 0.5, size: 4, grav: 560 });
          this.msg = 'CORTADO'; this.msgT = 0.7;
        }
      }
    }
    // El EMPUJON no corta, pero tumba el muñeco de un golpe de escudo.
    if (C.escudoActivo(K)) {
      const [ex, ey] = C.puntaEscudo(K);
      for (const p of this.pajas) {
        if (p.roto > 0) continue;
        if (Math.abs(p.x - ex) < 40) {
          p.roto = 1.4; this.hitstop = 4 / 60; cam.shake(2.5, 0.1);
          burst(p.x, SUELO - 50, 10, { rnd: Math.random, colors: [PM.hueso, PM.sue1], speed: 200, life: 0.4, size: 4, grav: 520 });
        }
      }
    }
    if (this.comboT > 0) this.comboT -= dt;
    for (const p of this.pajas) if (p.roto > 0) { p.roto -= dt; if (p.roto <= 0) p.t = 0; }

    // ================== EL OGRO ==================
    const O = this.O;
    const ondasAntes = O.ondas.length;
    const stAntes = O.st;

    // EL ORDEN IMPORTA: ella se mueve, luego el ogro, y AL FINAL se arbitra
    // quien toca a quien. Con ella rodando a 660 px/s un frame de desfase son
    // 11 px: la diferencia entre esquivar y comer el golpe.
    OG.stepOgro(O, K, dt);
    // El cuerpo del ogro es SOLIDO: sin esto ella se mete dentro de la
    // barriga y todas las distancias dejan de significar nada.
    OG.empujaCuerpo(O, K);

    // El pisoton acaba de nacer: temblor, polvo y una grieta en el suelo.
    if (O.ondas.length > ondasAntes) {
      cam.shakeDecay(7, 0.55); vibrate(28);
      SFX.aterriza();
      this.hitstop = 5 / 60;
      burst(O.x, SUELO, 22, { rnd: Math.random, colors: [PM.sue1, PM.sue2, PM.hueso],
                              speed: 320, life: 0.7, size: 5, grav: 900 });
      this.grietas.push({ x: O.x, w: 70, t: 1 });
      if (this.grietas.length > 6) this.grietas.shift();
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
      burst(O.x, SUELO, 3, { rnd: Math.random, colors: [PM.sue2], speed: 60,
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
        const dano = C.TAJOS[K.combo][4];
        if (OG.hiereOgro(O, dano, K.dir)) {
          K.golpeo = 1;
          const fuerte = K.combo === 2;
          this.hitstop = (fuerte ? 8 : 5) / 60;
          this.flashO = 0.1;
          cam.shake(fuerte ? 4 : 3, 0.12);
          SFX.corta(); vibrate(fuerte ? 22 : 14);
          burst(O.x + K.dir * -30, SUELO - 120, 14,
                { rnd: Math.random, colors: [POG.pie3, POG.pie2, '#8b1a2b'],
                  speed: 260, life: 0.5, size: 4, grav: 620 });
        }
      }
    }
    // El EMPUJON de escudo no hace daño, pero lo aparta.
    if (C.escudoActivo(K) && O.vivo && Math.abs(O.x - K.x) < OG.CUERPO_R + 60) {
      if (O.st !== OG.ATACA) { O.x += K.dir * 26; cam.shake(2.5, 0.1); SFX.clang(); }
    }

    // --- EL OGRO LE PEGA A ELLA ---
    // Cuatro ramas, que son las cuatro que devuelve C.herir().
    if (O.vivo && K.vivo) {
      let sx = null, dano = 0;
      if (OG.garroteActivo(O)) {
        const gp = OG.golpeOgro(O);
        if (Math.abs(K.x - gp.x) < gp.r + 26) { sx = gp.x; dano = gp.dano; }
      }
      const w = OG.ondaGolpea(O, K);
      if (!sx && w) { sx = w.x; dano = OG.ONDA_DANO; }
      if (sx !== null) {
        const r = C.herir(K, sx);
        if (r === 'parada') {
          // El PARRY: el premio ya lo pone herir() (K.parada). Aqui se le
          // devuelve el golpe al ogro: se queda abierto.
          O.st = OG.ABIERTO; O.t = 0; O.abiertoT = 0.55; O.atk = -1;
          O.abiertoPor = OG.POR_PARADA;
          this.hitstop = 9 / 60; cam.shake(4, 0.14); SFX.clang(); vibrate(26);
          this.msg = 'PARADA!'; this.msgT = 0.8;
          burst(K.x + K.dir * 30, SUELO - 90, 14,
                { rnd: Math.random, colors: [PC.ace4, PC.ace3, PC.oro3],
                  speed: 300, life: 0.45, size: 4, grav: 200 });
        } else if (r === 'bloqueado') {
          this.hitstop = 4 / 60; cam.shake(2.5, 0.1); SFX.clang(); vibrate(14);
          burst(K.x + K.dir * 26, SUELO - 80, 8,
                { rnd: Math.random, colors: [PC.ace3, PC.ace2], speed: 200,
                  life: 0.35, size: 3, grav: 300 });
        } else if (r === true) {
          // Le entra de verdad.
          for (let i = 1; i < dano; i++) if (K.hp > 0) { K.hp--; }
          if (K.hp < 0) K.hp = 0;
          if (K.hp <= 0) { K.vivo = false; K.st = C.MUERTO; }
          this.hitstop = 7 / 60; cam.shake(5, 0.16); SFX.golpe ? SFX.golpe() : SFX.clang();
          vibrate(34);
          burst(K.x, SUELO - 90, 12, { rnd: Math.random, colors: [PR.ves2, PR.ves3],
                                       speed: 240, life: 0.45, size: 4, grav: 500 });
        }
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
      if (this.bRueda.down(ev)) { this.rueda = true; return; }
      if (this.bEscudo.down(ev)) return;
      if (this.bTajo.down(ev)) { this.golpea = true; return; }
      if (this.bSalta.down(ev)) { this.salta = true; return; }
      if (ev.x < VW * 0.45 && ev.y > 240) { this.stick.down(ev); return; }
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev); this.bSalta.up(ev); this.bTajo.up(ev); this.bRueda.up(ev); this.bEscudo.up(ev);
    }
  },

  draw(g, ctx) {
    const K = this.K, cx = this.camX;
    drawMundo(g, this.W, cx, VW, VH, SUELO);

    // Muñecos de paja
    for (const p of this.pajas) {
      const x = Math.round(p.x - cx);
      if (x < -20 || x > VW + 20) continue;
      if (p.roto > 0) {
        // Partido: el poste queda, la paja en el suelo
        g.fillStyle = PM.hier; g.fillRect(x - 3, SUELO - 24, 6, 24);
        g.fillStyle = PM.hueso; g.fillRect(x - 14, SUELO - 6, 28, 6);
      } else {
        // Un muñeco de entrenamiento: poste, brazos en cruz, torso de paja
        // atado con cuerda y un yelmo viejo encima.
        g.fillStyle = PM.hier; g.fillRect(x - 3, SUELO - 108, 6, 108);
        g.fillStyle = PM.hier; g.fillRect(x - 34, SUELO - 82, 70, 6);   // los brazos
        g.fillStyle = PM.hueso; g.fillRect(x - 18, SUELO - 90, 42, 52); // la paja
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 72, 42, 4);   // cuerdas
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 54, 42, 4);
        g.fillStyle = PM.sue2; g.fillRect(x - 18, SUELO - 90, 42, 4);
        // El yelmo
        g.fillStyle = PM.hier; g.fillRect(x - 18, SUELO - 118, 38, 30);
        g.fillStyle = PM.sue4; g.fillRect(x - 12, SUELO - 108, 26, 8);   // la ranura
        g.fillStyle = PM.hier2; g.fillRect(x - 18, SUELO - 118, 38, 4);
      }
    }

    // LAS GRIETAS que deja el pisoton. Van pintadas SOBRE el suelo ya
    // horneado, sin rehornear la tira: son un array y se dibujan encima.
    for (const gr of this.grietas) {
      const gx = Math.round(gr.x - cx);
      g.globalAlpha = Math.min(0.85, gr.t);
      g.fillStyle = PM.sue4;
      for (let i = -3; i <= 3; i++) {
        const w = Math.round((1 - Math.abs(i) / 4) * gr.w * 0.22);
        g.fillRect(gx + i * 11 - (w >> 1), SUELO - 1 + ((i * 7) % 3), w, 3);
      }
      g.fillStyle = PM.sue3;
      g.fillRect(gx - gr.w / 2, SUELO + 2, gr.w, 2);
      g.globalAlpha = 1;
    }

    // LAS ONDAS del pisoton. Una cresta de seis rectangulos: a 34 px de alto
    // son silueta de verdad, no un detalle. Se ven viajar porque a 620 px/s
    // avanzan 10 px por fotograma.
    for (const w of this.O.ondas) {
      if (!w.vivo) continue;
      const wx = Math.round(w.x - cx);
      const alturas = [6, 14, 26, 34, 22, 10];
      for (let i = 0; i < alturas.length; i++) {
        const h = alturas[i];
        const bx = wx + (i - 2.5) * 10 * w.dir;
        g.fillStyle = i === 3 ? POG.pie3 : i < 3 ? POG.pie2 : POG.pie1;
        g.fillRect(Math.round(bx - 5), SUELO - h, 10, h);
      }
      // el polvo que levanta por delante
      g.fillStyle = PM.sue2;
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
    // esta en el aire, que es informacion util al saltar.
    const altura = SUELO - K.y;
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
      g.fillRect(Math.round(sx0 - w), SUELO - 2 + dy, Math.round(w * 2), 1);
    }
    g.globalAlpha = 1;

    // Romina. La estela de cada tajo ya viene DIBUJADA en sus fotogramas (la
    // media luna blanca del pack), asi que la escena ya no pinta el arco que
    // pintaba para la muñeca de antes: saldrian dos estelas una encima de otra.
    const [p, f] = C.pose(K);
    const parpadea = K.iframe > 0 && (((K.iframe * 14) | 0) & 1);
    const rastro = K.st === C.RUEDA && C.invulnerable(K) ? 1 : 0;
    if (!parpadea) drawRomina(g, K.x - cx, K.y, K.dir, p, f, rastro);

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

    const s = `TAJOS ${this.golpes}  SALTOS ${this.saltos}  RODADAS ${this.rodadas}`;
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
    // Stick: solo se ve cuando el pulgar lo despierta
    if (this.stick.active) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy);
      g.globalAlpha = 0.25; g.fillStyle = PC.ves4;
      g.fillRect(ox - 60, oy - 60, 120, 4); g.fillRect(ox - 60, oy + 56, 120, 4);
      g.fillRect(ox - 60, oy - 60, 4, 120); g.fillRect(ox + 56, oy - 60, 4, 120);
      g.globalAlpha = 1; g.fillStyle = PC.bla2;
      g.fillRect(Math.round(ox + this.stick.dx * 60) - 8, Math.round(oy + this.stick.dy * 60) - 8, 17, 17);
    } else {
      g.globalAlpha = 0.18; g.fillStyle = PC.ves4;
      g.fillRect(116, SUELO + 36, 68, 4); g.fillRect(148, SUELO + 8, 4, 60);
      g.globalAlpha = 1;
    }
    const K = this.K;
    boton(g, this.bSalta, 34, PC.ves1, PC.ves4, 'SALTA', false);
    boton(g, this.bTajo, 40, PC.ves1, PC.oro3, 'TAJO', false);
    boton(g, this.bRueda, 32, PC.ves1, PC.ves4, 'RUEDA', K.rollCd > 0);
    boton(g, this.bEscudo, 32, PC.ace1, PC.ace3, 'ESCUDO', false);
  },

  destroy() { this.W = null; },
};

function boton(g, b, r, fondo, borde, txt, frio) {
  g.globalAlpha = frio ? 0.28 : (b.pressed ? 0.95 : 0.62);
  g.fillStyle = fondo;
  g.fillRect(b.x - r, b.y - r, r * 2, r * 2);
  g.fillStyle = borde;
  g.fillRect(b.x - r, b.y - r, r * 2, 4);
  g.fillRect(b.x - r, b.y + r - 4, r * 2, 4);
  g.fillRect(b.x - r, b.y - r, 4, r * 2);
  g.fillRect(b.x + r - 4, b.y - r, 4, r * 2);
  g.globalAlpha = 1;
  textCenter(g, txt, b.x, b.y - 7, frio ? '#5a5560' : '#ffffff', 2);
}
