// LA MASA - Romina con espada contra una masa que aprende de ella.
//
// La pelea entera vive en masa-pelea.js (sin DOM): aqui solo estan el pulgar,
// el sonido, las particulas, el HUD, la ceremonia de la muda y la pantalla
// final. Todo lo que decide quien gana se mide en tools/prueba-masa.mjs.
//
// El bucle: siete rondas. Ella mata a la masa, la masa MUDA (2.6 s: convulsion
// a camara lenta, su ultima pelea repetida en silueta blanca alrededor -- "te
// esta estudiando", y es verdad literal: en ese instante se decide que le
// crece), y vuelve con un organo nuevo que contrarresta lo que ella hace. Un
// letrero de cuatro palabras lo dice SOLO cuando es verdad. La septima
// muerte es la victoria.
//
// La misma arena, los mismos controles y los mismos numeros de Romina que en
// NEON FIST: el pulgar ya sabe jugar esto.

import { VW, VH, makeRng, clamp, cam, Save } from '../core.js';
import { bake, spr, burst } from '../gfx.js';
import { text, textCenter, measure } from '../font.js';
import { SFX } from '../audio.js';
import { Stick, Button, vibrate, pointers } from '../input.js';
import { makePelea, stepPelea, PE, T_MUDA, T_CONVULSION, replayLargo, replayIdx } from './masa-pelea.js';
import { EV, AVISO, MUDANDO, ULT_RONDA, RUMIA, NR, LATIGO, GARRA, HOJA, tieneCadena, step as stepMasa } from './masa-cuerpo.js';
import { HP0 as HP_CAB, AX0, AX1, AY0, AY1 } from './masa-caballera.js';
import { drawMasa, drawCaballera, drawSilueta, bakeCaballera, P as PAL } from './masa-arte.js';
import { resumen } from './masa-mente.js';

const AW = AX1 - AX0, AH = AY1 - AY0;

// Glifos de los botones
const ESPADA = [
  '.......11.',
  '......131.',
  '.....131..',
  '....131...',
  '...131....',
  '.1131.....',
  '1131......',
  '1311......',
  '.11.1.....',
  '....1.....',
];
const EMAP = { '1': PAL.out, '3': PAL.wh };
const CHEV = [
  '..1..1..',
  '.11.11..',
  '111111..',
  '.11.11..',
  '..1..1..',
];
const VMAP = { '1': PAL.ye };
const CORAZON = [
  '.11.11.',
  '1221221',
  '1222221',
  '.12221.',
  '..121..',
  '...1...',
];
const HMAP = { '1': PAL.out, '2': PAL.mag };
const HMAP_OFF = { '1': PAL.out, '2': PAL.dk };

// Lo que dice la pantalla final segun como acabo.
const MSGS_GANA = ['LA MATASTE ROMINA', 'NADIE TE APRENDE', 'ERES IMPOSIBLE'];
const MSGS_PIERDE = ['TE CONOCIA DEMASIADO', 'CAMBIA DE LADO', 'LA PROXIMA NO TE LEE'];

export default {
  meta: { id: 'masa', title: 'LA MASA', tag: 'APRENDE DE TI', colors: ['#ff4d63', '#ffe8a8'] },

  init(ctx, args) {
    this.ctx = ctx;
    const rnd = this.rnd = makeRng(args.seed >>> 0);
    this.P = makePelea(rnd);
    this.S = bakeCaballera();
    this.floor = bakeFloor();
    this.sEspada = bake(ESPADA, EMAP, 4);
    this.sChev = bake(CHEV, VMAP, 4);
    this.sCor = bake(CORAZON, HMAP, 2);
    this.sCorOff = bake(CORAZON, HMAP_OFF, 2);

    this.stick = new Stick(45, 8);
    this.bTajo = new Button(206, 462, 39, 12);
    this.bDash = new Button(126, 516, 28, 12);
    this.golpe = false; this.dash = false;

    this.t = 0; this.beat = 0;
    this.hitstop = 0; this.flashT = 0; this.flashMax = 0; this.flashCol = PAL.wh;
    this.masaFlash = 0;
    this.msg = ''; this.msgT = 0; this.msgCol = PAL.ye;
    this.letrero = null; this.letreroT = 0;
    this.trailX = new Float32Array(8); this.trailY = new Float32Array(8); this.trailN = 0;
    this.swingVisto = 0; this.dashVisto = 0;
    this.fin = false; this.finT = 0; this.esRecord = false; this.gano = false; this.msgFin = '';
    this.best = Save.best('masa');
    this.botones = [];
    this.abajo = null; this.abajoId = -1;    // toque apoyado sobre un boton de la pantalla final
  },

  fullFlash(col, frames) { this.flashCol = col; this.flashMax = frames / 60; this.flashT = this.flashMax; },

  // ---------- Bucle ----------

  update(dt, ctx) {
    if (this.hitstop > 0) { this.hitstop -= dt; if (this.flashT > 0) this.flashT -= dt; return; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.masaFlash > 0) this.masaFlash -= dt;
    this.beat += dt;
    this.t += dt;

    if (this.fin) {
      this.finT += dt;
      // La masa sigue viva en la pantalla final: respira y la mira.
      const M = this.P.M;
      M.st = MUDANDO; M.convT = 0;
      stepMasa(M, this.P.K, dt, this.rnd, null);
      return;
    }

    const P = this.P, M = P.M, K = P.K, rnd = this.rnd;
    const inp = { dx: this.stick.dx, dy: this.stick.dy, golpe: this.golpe, dash: this.dash };
    this.golpe = false; this.dash = false;
    stepPelea(P, inp, dt);

    // --- Lo que hizo ella ---
    if (K.swingId !== this.swingVisto) { this.swingVisto = K.swingId; SFX.tajo(); }
    if (K.dashId !== this.dashVisto) { this.dashVisto = K.dashId; this.trailN = 0; SFX.dash(); vibrate(8); }
    if (K.dT > 0) { this.trailX[this.trailN & 7] = K.x; this.trailY[this.trailN & 7] = K.y; this.trailN++; }

    // --- Lo que hizo la masa ---
    for (let i = 0; i < M.evN; i++) {
      const t = M.evT[i], x = M.evX[i], y = M.evY[i], a = M.evA[i];
      if (t === EV.TAJO) {
        this.masaFlash = 4 / 60;
        burst(x, y, M.ultDmg > 1 ? 12 : 7, { rnd, colors: [PAL.wh, '#ff4d63', '#8e1224', PAL.ye], speed: 130, life: 0.25, size: 3 });
        this.hitstop = Math.max(this.hitstop, (M.ultDmg > 1 ? 6 : 4) / 60);
        cam.shake(M.ultDmg > 1 ? 4 : 2, 0.1);
        SFX.hit(); vibrate(14);
      } else if (t === EV.CLANG) {
        burst(x, y, 4, { rnd, colors: [PAL.wh, PAL.grey], speed: 120, life: 0.2, size: 2 });
        this.hitstop = Math.max(this.hitstop, 3 / 60);
        SFX.brick();
      } else if (t === EV.PARADA_OK) {
        burst(x, y, 10, { rnd, colors: [PAL.wh, PAL.grey, PAL.ye], speed: 160, life: 0.3, size: 3 });
        this.hitstop = Math.max(this.hitstop, 6 / 60);
        cam.shake(4, 0.2);
        SFX.brick(); vibrate(20);
        this.aviso('PARADA', PAL.grey);
      } else if (t === EV.TAJO_ORG) {
        burst(x, y, 5, { rnd, colors: [PAL.wh, '#ff4d63'], speed: 110, life: 0.22, size: 2 });
        this.hitstop = Math.max(this.hitstop, 2 / 60);
        SFX.hit();
      } else if (t === EV.CORTE) {
        burst(x, y, 16, { rnd, colors: ['#ff4d63', '#8e1224', '#3d0810', PAL.wh], speed: 160, life: 0.5, size: 3, grav: 120 });
        this.hitstop = Math.max(this.hitstop, 7 / 60);
        cam.shake(4, 0.2);
        SFX.explode(); vibrate(22);
        this.aviso('CORTADO', '#ff4d63');
      } else if (t === EV.AVISO || t === EV.CAD_AVISO) {
        SFX.alarm();
      } else if (t === EV.EMBISTE || t === EV.CAD_GOLPE) {
        SFX.dash();
      } else if (t === EV.PARED) {
        cam.shake(4, 0.18); SFX.punch();
        burst(x, y, 8, { rnd, colors: [PAL.ye, PAL.wh], speed: 130, life: 0.3, size: 2 });
      } else if (t === EV.DANO) {
        this.fullFlash(PAL.wh, 5); cam.shake(6, 0.3);
        SFX.hurt(); vibrate(30);
        burst(K.x, K.y, 10, { rnd, colors: [PAL.wh, PAL.pink, PAL.mag], speed: 150, life: 0.3, size: 3 });
      } else if (t === EV.EXPUESTA) {
        burst(x, y, 14, { rnd, colors: [PAL.wh, PAL.ye, PAL.pink], speed: 170, life: 0.35, size: 3 });
        cam.shake(3, 0.15); SFX.wave();
      } else if (t === EV.CRECE) {
        burst(x, y, 8, { rnd, colors: ['#ff4d63', PAL.bone, PAL.wh], speed: 70, life: 0.4, size: 2 });
        SFX.crece();
      } else if (t === EV.MUERE) {
        this.fullFlash(PAL.wh, 8); cam.shake(7, 0.4);
        this.hitstop = Math.max(this.hitstop, 9 / 60);
        burst(x, y, 30, { rnd, colors: [PAL.wh, '#ff4d63', '#8e1224', PAL.bone], speed: 220, life: 0.6, size: 3, grav: 150 });
        SFX.explode(); vibrate(40);
      }
    }
    for (let i = 0; i < P.evN; i++) {
      const t = P.evT[i];
      if (t === PE.MUDA) { this.letrero = P.lineas; this.letreroT = 0; SFX.muda(); }
      else if (t === PE.RONDA) { this.aviso('RONDA ' + M.ronda, PAL.wh); SFX.wave(); this.letrero = null; }
      else if (t === PE.PATRON_ROTO) { this.aviso('PATRON ROTO', PAL.ye); }
      else if (t === PE.PARADA) { SFX.blip(); }
      else if (t === PE.GANA) { this.terminar(true); }
      else if (t === PE.PIERDE) { this.terminar(false); }
    }
    if (this.letrero) this.letreroT += dt;
  },

  aviso(msg, col) { this.msg = msg; this.msgCol = col; this.msgT = 1.0; },

  // La pantalla final es propia (como la del AHORCADO): la masa que ella
  // fabrico, con sus habitos en palabras, se queda a la vista.
  terminar(gano) {
    this.fin = true; this.finT = 0; this.gano = gano;
    // La misma limpieza que hace morir(): si ella muere con la parada armada o
    // con la masa EXPUESTA, en la pantalla final se quedaba gris o
    // parpadeando en blanco para siempre (la rama fin no descuenta nada).
    const M = this.P.M;
    M.frozen = -1; M.frozenT = 0; M.expuesta = 0; M.aimOn = 0;
    const pts = Math.floor(this.P.score);
    this.esRecord = Save.submit('masa', pts);
    if (this.esRecord) SFX.record(); else if (gano) SFX.powerup(); else SFX.gameover();
    const msgs = gano ? MSGS_GANA : MSGS_PIERDE;
    this.msgFin = msgs[Math.floor(this.rnd() * msgs.length)];
    this.botones = [
      { id: 'otra', x: 24, y: 506, w: 222, h: 38, txt: 'OTRA VEZ', col: '#5cffd8' },
      { id: 'menu', x: 24, y: 552, w: 222, h: 38, txt: 'AL MENU', col: '#ff5c9d' },
    ];
    this.trailN = 0;
  },

  // ---------- Pulgar ----------

  onInput(ev, ctx) {
    if (this.fin) {
      if (this.finT < 0.6) return;
      if (ev.type === 'down') { this.abajo = this.botonEn(ev); this.abajoId = ev.id; }
      else if (ev.type === 'up') {
        // El 'up' SINTETICO que manda la pausa (soltarDedos) llega con el dedo
        // todavia en la tabla de punteros: ese no cuenta como toque. Es el
        // mismo truco del AHORCADO.
        const sintetico = pointers.has(ev.id);
        const b = this.botonEn(ev);
        if (!sintetico && b && b === this.abajo && ev.id === this.abajoId) {
          if (b.id === 'otra') { SFX.select(); this.reiniciar(); }
          else { SFX.blip(); ctx.toMenu(); }
        }
        this.abajo = null;
      }
      return;
    }
    if (ev.type === 'down') {
      // Arbitraje fijo, el de NEON FIST: el boton chico, el grande, el stick.
      if (this.bDash.down(ev)) { this.dash = true; return; }
      if (this.bTajo.down(ev)) { this.golpe = true; return; }
      if (ev.x < 130 && ev.y > 400) { this.stick.down(ev); return; }
      if (ev.y <= AY1 + 10) this.golpe = true;   // tocar la arena tambien corta
    } else if (ev.type === 'move') {
      this.stick.move(ev);
    } else {
      this.stick.up(ev); this.bTajo.up(ev); this.bDash.up(ev);
    }
  },

  botonEn(ev) {
    for (const b of this.botones) if (ev.x >= b.x - 6 && ev.x <= b.x + b.w + 6 && ev.y >= b.y - 6 && ev.y <= b.y + b.h + 6) return b;
    return null;
  },

  reiniciar() {
    const seed = (this.rnd() * 0xffffffff) >>> 0;
    this.init(this.ctx, { seed });
  },

  // ---------- Dibujo ----------

  draw(g, ctx) {
    const P = this.P, M = P.M, K = P.K;
    g.fillStyle = PAL.out; g.fillRect(0, 0, VW, VH);
    g.drawImage(this.floor, AX0 - 6, AY0 - 6);
    const beatOn = ((this.beat * 2.4) | 0) & 1;
    g.fillStyle = beatOn ? '#ff4d63' : '#8e1224';
    g.fillRect(AX0 + AW / 2 - 14, AY0 - 3, 28, 3);
    g.fillRect(AX0 + AW / 2 - 14, AY1, 28, 3);
    g.fillRect(AX0 - 3, AY0 + AH / 2 - 14, 3, 28);
    g.fillRect(AX1, AY0 + AH / 2 - 14, 3, 28);

    if (this.fin) { this.drawFin(g); return; }

    // La ceremonia: su ultima pelea en silueta blanca alrededor, a 4x.
    if (P.estado === 'muda' && P.mudaT > 0.5 && P.mudaT < T_MUDA - 0.2) {
      const largo = replayLargo(P);
      const f = (P.mudaT - 0.5) / (T_MUDA - 0.7);
      const k = Math.floor(f * largo);
      for (let j = 5; j >= 0; j--) {
        const idx = k - j * 9;
        if (idx < 0) continue;
        const ri = replayIdx(P, idx);
        drawSilueta(g, this.S, P.rx[ri], P.ry[ri], 0.12 + (5 - j) * 0.09);
      }
    }

    drawMasa(g, M, K, this.t, this.masaFlash);

    // Rastro del dash: silueta blanca, 4 imagenes
    if (K.dT > 0 && this.trailN > 1) {
      for (let k = 3; k >= 0; k--) {
        const idx = this.trailN - 1 - k * 2;
        if (idx < 0) continue;
        drawSilueta(g, this.S, this.trailX[idx & 7], this.trailY[idx & 7], 0.15 + (3 - k) * 0.1);
      }
    }
    drawCaballera(g, K, this.S, this.t);

    if (this.flashT > 0) {
      g.globalAlpha = (this.flashT / this.flashMax) * 0.5;
      g.fillStyle = this.flashCol; g.fillRect(0, 0, VW, VH);
      g.globalAlpha = 1;
    }

    this.drawHud(g);
    this.drawControls(g);
  },

  drawHud(g) {
    const P = this.P, M = P.M, K = P.K;
    g.fillStyle = PAL.out; g.fillRect(0, 0, VW, AY0 - 6);
    // Corazones
    for (let i = 0; i < HP_CAB; i++) spr(g, i < K.hp ? this.sCor : this.sCorOff, 12 + i * 16, 9);
    // 'RONDA n' y siete pastillas, una por muda: cabe a la izquierda del boton
    // de pausa (que vive en el centro de la franja).
    text(g, 'RONDA ' + M.ronda, 6, 20, '#8a7ab8', 2);
    for (let i = 0; i < ULT_RONDA; i++) {
      g.fillStyle = i < M.ronda ? '#ff4d63' : PAL.dk;
      g.fillRect(92 + i * 4, 24, 3, 6);   // paso 4: la septima acaba en 118 y el boton de pausa empieza en 120
    }
    // Vida de la masa: barra de carne con marco de hueso, arriba en el centro
    const bw = 96, bx = VW - 6 - bw, by = 27;
    g.fillStyle = PAL.bone2; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle = PAL.dk; g.fillRect(bx, by, bw, 4);
    const f = clamp(M.hp / M.hpMax, 0, 1);
    g.fillStyle = M.expuesta > 0 && (((this.t * 14) | 0) & 1) ? PAL.wh : '#ff4d63';
    g.fillRect(bx, by, Math.round(bw * f), 4);
    // Puntaje
    const s = String(Math.floor(P.score));
    text(g, s, VW - 6 - measure(s, 3), 3, PAL.wh, 3);

    // Letrero de la muda: APRENDIO (o MUDA) y lo que aprendio, letra a letra.
    // Va DENTRO de la arena, en la mitad donde no esta la masa: debajo de la
    // arena pisaba el boton de la espada.
    if (this.letrero && P.estado === 'muda') {
      const lineas = this.letrero;
      const conNombre = lineas.length && lineas[0] !== 'CRECIO' && lineas[0] !== 'NO ME PILLO NADA';
      const y0 = M.y < (AY0 + AY1) / 2 ? AY1 - 74 : AY0 + 14;
      // 48 letras/s desde los 0.8 s: a 24 la segunda linea no terminaba de
      // escribirse antes de que la muda acabara (2.6 s) y se cortaba a medias.
      if (this.letreroT > 0.6) textCenter(g, conNombre ? 'APRENDIO' : 'MUDA', VW / 2, y0, conNombre ? PAL.ye : PAL.pink, 3);
      let t0 = 0.8;
      for (let i = 0; i < Math.min(3, lineas.length); i++) {
        const n = Math.floor((this.letreroT - t0) * 48);
        if (n > 0) textCenter(g, lineas[i].slice(0, n), VW / 2, y0 + 26 + i * 18, i === 0 ? PAL.wh : '#8a7ab8', 2);
        t0 += lineas[i].length / 48 + 0.15;
      }
    } else if (this.msgT > 0) {
      textCenter(g, this.msg, VW / 2, AY1 + 10, this.msgCol, 3);
    }
  },

  drawControls(g) {
    if (this.stick.active) {
      const ox = Math.round(this.stick.ox), oy = Math.round(this.stick.oy);
      g.globalAlpha = 0.3; g.fillStyle = PAL.cy;
      g.fillRect(ox - 34, oy - 34, 68, 3); g.fillRect(ox - 34, oy + 31, 68, 3);
      g.fillRect(ox - 34, oy - 34, 3, 68); g.fillRect(ox + 31, oy - 34, 3, 68);
      g.globalAlpha = 1; g.fillStyle = PAL.wh;
      g.fillRect(Math.round(ox + this.stick.dx * 34) - 5, Math.round(oy + this.stick.dy * 34) - 5, 11, 11);
    } else {
      g.globalAlpha = 0.16; g.fillStyle = PAL.cy;
      g.fillRect(46, 498, 40, 3); g.fillRect(64, 480, 3, 40);
      g.globalAlpha = 1;
    }
    const K = this.P.K;
    g.globalAlpha = this.bDash.pressed ? 0.95 : (K.dCd > 0 ? 0.3 : 0.7);
    g.fillStyle = PAL.dk2; g.fillRect(this.bDash.x - 28, this.bDash.y - 28, 56, 56);
    g.globalAlpha = 1;
    spr(g, this.sChev, this.bDash.x, this.bDash.y);
    g.globalAlpha = this.bTajo.pressed ? 0.95 : 0.75;
    g.fillStyle = '#8e1224'; g.fillRect(this.bTajo.x - 38, this.bTajo.y - 38, 76, 76);
    g.globalAlpha = 1;
    spr(g, this.sEspada, this.bTajo.x, this.bTajo.y);
  },

  // TU MONSTRUO: la masa grande, con sus organos, mirandola; sus habitos en
  // palabras; el puntaje; y los dos botones.
  drawFin(g) {
    const P = this.P, M = P.M;
    g.fillStyle = 'rgba(7,3,15,0.86)'; g.fillRect(0, 0, VW, VH);
    // La masa al doble, centrada arriba
    const fake = { x: M.x, y: M.y + 80 };
    g.save();
    // Recorte: a 2x un latigo de la ronda 7 se salia de su franja y cruzaba el
    // titulo y el puntaje.
    g.beginPath(); g.rect(0, 64, VW, 200); g.clip();
    g.translate(Math.round(VW / 2 - M.x * 2), Math.round(160 - M.y * 2));
    g.scale(2, 2);
    drawMasa(g, M, fake, this.t, 0);
    g.restore();

    const titulo = this.gano ? 'LA MATASTE' : 'TU MONSTRUO';
    textCenter(g, titulo, VW / 2, 40, this.gano ? PAL.ye : '#ff4d63', 3);   // debajo del boton de pausa
    const pts = Math.floor(P.score);
    textCenter(g, String(pts), VW / 2, 268, PAL.wh, 5);
    if (this.esRecord) {
      const f = Math.sin(this.finT * 8) > 0 ? '#ffe14d' : '#ff5c9d';
      textCenter(g, 'RECORD NUEVO!', VW / 2, 312, f, 2);
    } else textCenter(g, 'MEJOR ' + Save.best('masa'), VW / 2, 312, '#8a7ab8', 2);
    textCenter(g, this.gano ? 'SIETE MUDAS' : 'LLEGASTE A LA RONDA ' + M.ronda, VW / 2, 334, PAL.wh, 2);
    // Sus habitos en palabras. Si no le puso nombre a ninguno pero si le
    // crecieron cosas, se dice lo que LLEVA PUESTO, leido del mismo M que
    // dibuja drawMasa: 'NO TE APRENDIO NADA' encima de un bicho con dos placas
    // y un latigo se leia como una mentira.
    let hab = resumen(P.mn);
    let titulo2 = 'TE APRENDIO:';
    if (!hab.length) {
      const partes = [];
      let placas = 0;
      for (let s = 0; s < NR; s++) if (M.placa[s]) placas++;
      if (placas) partes.push(placas > 1 ? placas + ' PLACAS' : 'UNA PLACA');
      if (tieneCadena(M, LATIGO) >= 0) partes.push('UN LATIGO');
      if (tieneCadena(M, GARRA) >= 0) partes.push('UNA GARRA');
      if (tieneCadena(M, HOJA) >= 0) partes.push('LA HOJA');
      if (M.patas) partes.push('PATAS');
      if (M.parada) partes.push('LA PARADA');
      if (partes.length) { titulo2 = 'LE CRECIO:'; hab = partes.slice(0, 3); }
      else titulo2 = 'NO TE APRENDIO NADA';
    }
    textCenter(g, titulo2, VW / 2, 366, '#8a7ab8', 2);
    for (let i = 0; i < hab.length; i++) textCenter(g, hab[i], VW / 2, 386 + i * 18, PAL.bone, 2);
    textCenter(g, this.msgFin, VW / 2, 462, '#5cffd8', 2);
    if (this.finT >= 0.6) {
      for (const b of this.botones) {
        const hot = this.abajo === b;
        g.fillStyle = hot ? b.col : PAL.dk; g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = b.col; g.fillRect(b.x, b.y, b.w, 2); g.fillRect(b.x, b.y + b.h - 2, b.w, 2);
        textCenter(g, b.txt, b.x + b.w / 2, b.y + 8, hot ? PAL.out : b.col, 3);
      }
    }
  },

  destroy() { this.floor = null; this.P = null; this.S = null; },
};

// Piso de la arena: el de NEON FIST.
function bakeFloor() {
  const w = AX1 - AX0 + 12, h = AY1 - AY0 + 12;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = PAL.bg; c.fillRect(0, 0, w, h);
  c.fillStyle = PAL.dk;
  for (let x = 6; x < w - 6; x += 24) c.fillRect(x, 6, 1, h - 12);
  for (let y = 6; y < h - 6; y += 24) c.fillRect(6, y, w - 12, 1);
  c.fillStyle = PAL.dk2;
  c.fillRect(3, 3, w - 6, 3); c.fillRect(3, h - 6, w - 6, 3);
  c.fillRect(3, 3, 3, h - 6); c.fillRect(w - 6, 3, 3, h - 6);
  c.fillStyle = '#5e0d1a';
  const B = 12;
  c.fillRect(3, 3, B, 3); c.fillRect(3, 3, 3, B);
  c.fillRect(w - 3 - B, 3, B, 3); c.fillRect(w - 6, 3, 3, B);
  c.fillRect(3, h - 6, B, 3); c.fillRect(3, h - 3 - B, 3, B);
  c.fillRect(w - 3 - B, h - 6, B, 3); c.fillRect(w - 6, h - 3 - B, 3, B);
  return cv;
}
